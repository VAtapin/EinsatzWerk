<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreServiceOrderRequest;
use App\Models\ServiceOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ServiceOrderController extends Controller
{
    public function store(StoreServiceOrderRequest $request): JsonResponse
    {
        $organizationId = $request->user()?->organization_id
            ?? $request->header('X-Organization-ID');

        abort_if($organizationId === null, 422, 'Organization context is required.');

        $order = DB::transaction(function () use ($request, $organizationId): ServiceOrder {
            $sequence = ServiceOrder::query()
                ->where('organization_id', $organizationId)
                ->whereDate('created_at', today())
                ->lockForUpdate()
                ->count() + 1;

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
}
