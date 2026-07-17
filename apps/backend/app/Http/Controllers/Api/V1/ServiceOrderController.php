<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreServiceOrderRequest;
use App\Models\ServiceOrder;
use App\Models\StatusHistory;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ServiceOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:200'],
            'status' => ['nullable', 'string', 'max:64'],
            'priority' => ['nullable', 'string', 'max:32'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
        ]);
        $organizationId = $request->user()->organization_id;
        $query = trim((string) ($validated['q'] ?? ''));

        $orders = ServiceOrder::query()
            ->where('organization_id', $organizationId)
            ->when($validated['status'] ?? null, fn ($builder, $status) => $builder->where('status', $status))
            ->when($validated['priority'] ?? null, fn ($builder, $priority) => $builder->where('priority', $priority))
            ->when($query !== '', function ($builder) use ($query): void {
                $builder->where(function ($builder) use ($query): void {
                    $builder
                        ->whereLike('order_number', "%{$query}%")
                        ->orWhereLike('fault_description', "%{$query}%")
                        ->orWhereHas('customer', function ($builder) use ($query): void {
                            $builder
                                ->whereLike('first_name', "%{$query}%")
                                ->orWhereLike('last_name', "%{$query}%")
                                ->orWhereLike('company_name', "%{$query}%");
                        })
                        ->orWhereHas('serviceLocation', function ($builder) use ($query): void {
                            $builder
                                ->whereLike('street', "%{$query}%")
                                ->orWhereLike('postal_code', "%{$query}%")
                                ->orWhereLike('city', "%{$query}%");
                        });
                });
            })
            ->with([
                'customer',
                'serviceLocation',
                'asset.manufacturer',
                'visits' => fn ($builder) => $builder
                    ->with('technician')
                    ->orderByDesc('visit_number'),
            ])
            ->latest()
            ->paginate($validated['per_page'] ?? 25);

        return response()->json($orders);
    }

    public function show(Request $request, string $serviceOrder): JsonResponse
    {
        return response()->json([
            'data' => $this->findForOrganization($request, $serviceOrder)->load([
                'customer',
                'serviceLocation',
                'asset.manufacturer',
                'appointmentConstraints',
                'visits.technician',
            ]),
        ]);
    }

    public function store(StoreServiceOrderRequest $request): JsonResponse
    {
        $organizationId = $request->user()?->organization_id
            ?? $request->header('X-Organization-ID');

        abort_if($organizationId === null, 422, 'Organization context is required.');

        $order = DB::transaction(function () use ($request, $organizationId): ServiceOrder {
            $sequenceDate = today()->toDateString();
            DB::table('order_number_sequences')->insertOrIgnore([
                'organization_id' => $organizationId,
                'sequence_date' => $sequenceDate,
                'current_value' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $sequenceRow = DB::table('order_number_sequences')
                ->where('organization_id', $organizationId)
                ->where('sequence_date', $sequenceDate)
                ->lockForUpdate()
                ->first();
            $sequence = ((int) $sequenceRow->current_value) + 1;
            DB::table('order_number_sequences')
                ->where('id', $sequenceRow->id)
                ->update([
                    'current_value' => $sequence,
                    'updated_at' => now(),
                ]);

            $order = ServiceOrder::query()->create([
                ...$request->safe()->except('appointment'),
                'organization_id' => $organizationId,
                'order_number' => sprintf('A-%s-%03d', now()->format('Ymd'), $sequence),
                'source' => 'phone',
                'status' => 'awaiting_scheduling',
                'created_by' => $request->user()?->id,
            ]);

            $appointment = $request->validated('appointment');
            if (is_array($appointment) && ($appointment['starts_at'] ?? null)) {
                $order->appointmentConstraints()->create([
                    'organization_id' => $organizationId,
                    'type' => 'availability_window',
                    'starts_at' => $appointment['starts_at'],
                    'ends_at' => $appointment['ends_at'] ?? null,
                    'is_hard' => $appointment['is_hard'] ?? false,
                ]);
            }

            return $order;
        });

        return response()->json([
            'data' => $order->load(['customer', 'serviceLocation']),
        ], 201);
    }

    public function technicians(Request $request): JsonResponse
    {
        $technicians = User::query()
            ->where('organization_id', $request->user()->organization_id)
            ->where('role_code', 'technician')
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'phone']);

        return response()->json(['data' => $technicians]);
    }

    public function assign(Request $request, string $serviceOrder): JsonResponse
    {
        $organizationId = $request->user()->organization_id;
        $this->findForOrganization($request, $serviceOrder);
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
            'duration_minutes' => ['nullable', 'integer', 'min:5', 'max:1440'],
        ]);

        $visit = DB::transaction(function () use (
            $request,
            $serviceOrder,
            $validated,
            $organizationId,
        ): Visit {
            $order = ServiceOrder::query()
                ->where('organization_id', $organizationId)
                ->lockForUpdate()
                ->findOrFail($serviceOrder);
            DispatchController::ensureNoConflict(
                $organizationId,
                $validated['technician_id'],
                $validated['planned_start_at'],
                $validated['planned_end_at'],
            );
            $from = $order->status;
            $visitNumber = ((int) $order->visits()->max('visit_number')) + 1;
            $visit = $order->visits()->create([
                'organization_id' => $organizationId,
                'technician_id' => $validated['technician_id'],
                'planned_date' => date('Y-m-d', strtotime($validated['planned_start_at'])),
                'planned_start_at' => $validated['planned_start_at'],
                'planned_end_at' => $validated['planned_end_at'],
                'dispatcher_duration_minutes' => $validated['duration_minutes'] ?? null,
                'status' => 'planned',
                'visit_number' => $visitNumber,
            ]);
            $order->update(['status' => 'planned']);
            StatusHistory::query()->create([
                'organization_id' => $organizationId,
                'subject_type' => ServiceOrder::class,
                'subject_id' => $order->id,
                'from_status' => $from,
                'to_status' => 'planned',
                'changed_by' => $request->user()->id,
                'metadata' => ['visit_id' => $visit->id],
                'created_at' => now(),
            ]);

            return $visit;
        });

        return response()->json([
            'data' => $visit->load(['serviceOrder.customer', 'technician']),
        ], 201);
    }

    private function findForOrganization(Request $request, string $id): ServiceOrder
    {
        return ServiceOrder::query()
            ->where('organization_id', $request->user()->organization_id)
            ->findOrFail($id);
    }
}
