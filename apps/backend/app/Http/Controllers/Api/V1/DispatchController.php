<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Models\Visit;
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
                ->whereNotIn('status', ['cancelled']))
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

    public function reschedule(Request $request, string $visit): JsonResponse
    {
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

        return response()->json([
            'data' => $visitModel->refresh()->load([
                'serviceOrder.customer',
                'serviceOrder.serviceLocation',
                'technician',
            ]),
        ]);
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
