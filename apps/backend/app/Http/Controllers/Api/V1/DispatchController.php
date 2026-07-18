<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Route as FieldRoute;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Models\Visit;
use App\Services\MapProviderService;
use App\Services\OperationalMessageService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DispatchController extends Controller
{
    public function board(Request $request): JsonResponse
    {
        $validated = $request->validate(['date' => ['required', 'date']]);
        $organizationId = $request->user()->organization_id;
        $technicians = User::query()
            ->where('organization_id', $organizationId)
            ->where('role_code', 'technician')
            ->where('status', 'active')
            ->with(['assignedVisits' => fn ($builder) => $builder
                ->whereDate('planned_date', $validated['date'])
                ->with(['serviceOrder.customer', 'serviceOrder.serviceLocation'])
                ->orderBy('planned_start_at')])
            ->orderBy('name')
            ->get(['id', 'name', 'phone']);
        $unassigned = ServiceOrder::query()
            ->where('organization_id', $organizationId)
            ->whereIn('status', ['awaiting_scheduling', 'planned'])
            ->whereDoesntHave('visits', fn ($builder) => $builder
                ->whereIn('status', ['planned', 'en_route', 'arrived', 'in_progress']))
            ->with(['customer', 'serviceLocation'])
            ->oldest()
            ->get();

        return response()->json([
            'data' => [
                'date' => $validated['date'],
                'technicians' => $technicians,
                'unassigned_orders' => $unassigned,
            ],
        ]);
    }

    public function reschedule(
        Request $request,
        string $visit,
        OperationalMessageService $messages,
    ): JsonResponse {
        $organizationId = $request->user()->organization_id;
        $visitModel = Visit::query()
            ->where('organization_id', $organizationId)
            ->findOrFail($visit);
        $validated = $request->validate([
            'technician_id' => [
                'required',
                Rule::exists('users', 'id')
                    ->where('organization_id', $organizationId)
                    ->where('role_code', 'technician')
                    ->where('status', 'active'),
            ],
            'planned_start_at' => ['required', 'date'],
            'planned_end_at' => ['required', 'date', 'after:planned_start_at'],
            'lock_version' => ['required', 'integer'],
        ]);

        abort_if(
            (int) $validated['lock_version'] !== $visitModel->lock_version,
            409,
            'Der Einsatz wurde zwischenzeitlich geändert.',
        );
        $previous = [
            'technician_id' => $visitModel->technician_id,
            'planned_start_at' => $visitModel->planned_start_at?->toISOString(),
            'planned_end_at' => $visitModel->planned_end_at?->toISOString(),
        ];
        $previousTechnician = $visitModel->technician;
        $this->ensureNoConflict(
            $organizationId,
            $validated['technician_id'],
            $validated['planned_start_at'],
            $validated['planned_end_at'],
            $visitModel->id,
        );
        $visitModel->update([
            'technician_id' => $validated['technician_id'],
            'planned_date' => date('Y-m-d', strtotime($validated['planned_start_at'])),
            'planned_start_at' => $validated['planned_start_at'],
            'planned_end_at' => $validated['planned_end_at'],
            'lock_version' => $visitModel->lock_version + 1,
        ]);
        $visitModel->load([
            'serviceOrder.customer',
            'serviceOrder.serviceLocation',
            'technician',
        ]);
        if ($previousTechnician && $previousTechnician->isNot($visitModel->technician)) {
            $messages->send(
                $request->user(),
                $previousTechnician,
                'Einsatz wurde neu zugewiesen',
                $visitModel->serviceOrder->order_number.
                    ' ist nicht mehr Teil Ihrer Tour.',
                $visitModel->serviceOrder,
                $visitModel,
                'high',
                false,
                ['event' => 'visit_reassigned', 'previous' => $previous],
            );
        }
        $messages->send(
            $request->user(),
            $visitModel->technician,
            'Einsatzplan geändert',
            implode("\n", [
                $visitModel->serviceOrder->order_number.' · '.
                    ($visitModel->serviceOrder->customer?->company_name ?: trim(
                        ($visitModel->serviceOrder->customer?->first_name ?? '').' '.
                        ($visitModel->serviceOrder->customer?->last_name ?? ''),
                    )),
                'Neuer Termin: '.$visitModel->planned_start_at?->format('d.m.Y H:i').
                    '–'.$visitModel->planned_end_at?->format('H:i'),
            ]),
            $visitModel->serviceOrder,
            $visitModel,
            'urgent',
            true,
            [
                'event' => 'visit_rescheduled',
                'previous' => $previous,
                'current' => [
                    'technician_id' => $visitModel->technician_id,
                    'planned_start_at' => $visitModel->planned_start_at?->toISOString(),
                    'planned_end_at' => $visitModel->planned_end_at?->toISOString(),
                ],
            ],
        );

        return response()->json([
            'data' => $visitModel,
        ]);
    }

    public function buildRoute(
        Request $request,
        MapProviderService $maps,
        OperationalMessageService $messages,
    ): JsonResponse {
        $organizationId = $request->user()->organization_id;
        $validated = $request->validate([
            'date' => ['required', 'date'],
            'technician_id' => [
                'required',
                Rule::exists('users', 'id')
                    ->where('organization_id', $organizationId)
                    ->where('role_code', 'technician'),
            ],
        ]);
        $visits = Visit::query()
            ->where('organization_id', $organizationId)
            ->where('technician_id', $validated['technician_id'])
            ->whereDate('planned_date', $validated['date'])
            ->whereNotIn('status', ['cancelled'])
            ->with(['serviceOrder.customer', 'serviceOrder.serviceLocation'])
            ->orderBy('planned_start_at')
            ->get();
        abort_if($visits->isEmpty(), 422, 'Für diesen Techniker sind keine Stopps geplant.');
        $points = [];
        foreach ($visits as $visit) {
            $location = $visit->serviceOrder->serviceLocation;
            $wasMissing = $location->latitude === null || $location->longitude === null;
            $points[] = $maps->geocode($location);
            if ($wasMissing && $visit->isNot($visits->last())) {
                usleep(1_100_000);
            }
        }
        $calculated = $maps->route($points);
        $route = FieldRoute::query()->updateOrCreate(
            [
                'organization_id' => $organizationId,
                'technician_id' => $validated['technician_id'],
                'route_date' => $validated['date'],
            ],
            [
                'status' => 'calculated',
                'total_distance_meters' => $calculated['distance'],
                'estimated_duration_seconds' => $calculated['duration'],
                'optimization_provider' => config('services.maps.routing_provider'),
                'optimization_data' => ['geometry' => $calculated['geometry']],
            ],
        );
        $route->stops()->delete();
        foreach ($visits as $index => $visit) {
            $point = $points[$index];
            $route->stops()->create([
                'organization_id' => $organizationId,
                'visit_id' => $visit->id,
                'sequence' => $index + 1,
                'planned_arrival_at' => $visit->planned_start_at,
                'planned_departure_at' => $visit->planned_end_at,
                'service_duration_minutes' => $visit->dispatcher_duration_minutes,
                'source' => 'manual',
                'latitude' => $point['latitude'],
                'longitude' => $point['longitude'],
            ]);
        }
        $technician = User::query()->findOrFail($validated['technician_id']);
        $messages->send(
            $request->user(),
            $technician,
            'Tagesroute aktualisiert',
            sprintf(
                'Ihre Route am %s enthält %d Einsätze · %.1f km · ca. %d Min. Fahrzeit.',
                CarbonImmutable::parse($validated['date'])->format('d.m.Y'),
                $visits->count(),
                $calculated['distance'] / 1000,
                (int) round($calculated['duration'] / 60),
            ),
            $visits->first()->serviceOrder,
            $visits->first(),
            'high',
            true,
            [
                'event' => 'route_updated',
                'route_id' => $route->id,
                'visit_ids' => $visits->pluck('id')->all(),
            ],
        );

        return response()->json(['data' => $this->routePayload($route->refresh())]);
    }

    public function route(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['required', 'date'],
            'technician_id' => ['required', 'string'],
        ]);
        $route = FieldRoute::query()
            ->where('organization_id', $request->user()->organization_id)
            ->where('technician_id', $validated['technician_id'])
            ->whereDate('route_date', $validated['date'])
            ->firstOrFail();

        return response()->json(['data' => $this->routePayload($route)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function routePayload(FieldRoute $route): array
    {
        $route->load(['stops.visit.serviceOrder.customer', 'stops.visit.serviceOrder.serviceLocation']);

        return [
            'id' => $route->id,
            'date' => $route->route_date,
            'distance_meters' => $route->total_distance_meters,
            'duration_seconds' => $route->estimated_duration_seconds,
            'provider' => $route->optimization_provider,
            'geometry' => $route->optimization_data['geometry'] ?? null,
            'stops' => $route->stops->map(fn ($stop) => [
                'id' => $stop->id,
                'sequence' => $stop->sequence,
                'latitude' => (float) $stop->latitude,
                'longitude' => (float) $stop->longitude,
                'visit_id' => $stop->visit_id,
                'customer' => trim(
                    $stop->visit->serviceOrder->customer->first_name.' '.
                    $stop->visit->serviceOrder->customer->last_name,
                ),
                'address' => $stop->visit->serviceOrder->serviceLocation,
            ]),
        ];
    }

    public static function ensureNoConflict(
        string $organizationId,
        string $technicianId,
        string $startsAt,
        string $endsAt,
        ?string $ignoreVisitId = null,
    ): void {
        $normalizedStart = CarbonImmutable::parse($startsAt)->toDateTimeString();
        $normalizedEnd = CarbonImmutable::parse($endsAt)->toDateTimeString();
        $conflict = Visit::query()
            ->where('organization_id', $organizationId)
            ->where('technician_id', $technicianId)
            ->whereNotIn('status', ['cancelled', 'completed'])
            ->when($ignoreVisitId, fn ($builder) => $builder->whereKeyNot($ignoreVisitId))
            ->where('planned_start_at', '<', $normalizedEnd)
            ->where('planned_end_at', '>', $normalizedStart)
            ->exists();

        abort_if($conflict, 422, 'Der Techniker hat in diesem Zeitraum bereits einen Einsatz.');
    }
}
