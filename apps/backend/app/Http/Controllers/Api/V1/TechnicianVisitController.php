<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StatusHistory;
use App\Models\Visit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TechnicianVisitController extends Controller
{
    public function today(Request $request): JsonResponse
    {
        $validated = $request->validate(['date' => ['nullable', 'date']]);
        $date = $validated['date'] ?? today()->toDateString();

        $visits = $this->queryFor($request)
            ->whereDate('planned_date', $date)
            ->orderBy('planned_start_at')
            ->get()
            ->map($this->payload(...));

        return response()->json(['data' => $visits]);
    }

    public function show(Request $request, string $visit): JsonResponse
    {
        return response()->json([
            'data' => $this->payload($this->findFor($request, $visit)),
        ]);
    }

    public function start(Request $request, string $visit): JsonResponse
    {
        $visit = $this->findFor($request, $visit);

        abort_unless(in_array($visit->status, ['planned', 'en_route', 'arrived'], true), 409);

        DB::transaction(function () use ($request, $visit): void {
            $from = $visit->status;
            $visit->update([
                'status' => 'in_progress',
                'actual_arrival_at' => $visit->actual_arrival_at ?? now(),
                'actual_start_at' => $visit->actual_start_at ?? now(),
                'lock_version' => $visit->lock_version + 1,
            ]);
            $visit->serviceOrder()->update(['status' => 'in_progress']);
            $this->recordStatus($request, $visit, $from, 'in_progress');
        });

        return response()->json(['data' => $this->payload($visit->refresh())]);
    }

    public function requestPart(Request $request, string $visit): JsonResponse
    {
        $visit = $this->findFor($request, $visit);
        abort_unless($visit->status === 'in_progress', 409);

        $validated = $request->validate([
            'product_id' => [
                'nullable',
                Rule::exists('products', 'id')
                    ->where('organization_id', $request->user()->organization_id),
            ],
            'description' => ['required', 'string', 'max:500'],
            'quantity' => ['required', 'numeric', 'gt:0', 'max:9999'],
        ]);

        $part = $visit->partRequirements()->create([
            ...$validated,
            'organization_id' => $request->user()->organization_id,
            'service_order_id' => $visit->service_order_id,
            'status' => 'requested',
            'requested_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $part], 201);
    }

    public function complete(Request $request, string $visit): JsonResponse
    {
        $visit = $this->findFor($request, $visit);
        abort_unless($visit->status === 'in_progress', 409);

        $validated = $request->validate([
            'diagnosis' => ['nullable', 'string', 'max:5000'],
            'work_performed' => ['required', 'string', 'max:5000'],
            'result' => [
                'required',
                Rule::in(['fixed', 'temporary_fix', 'parts_required', 'no_fault']),
            ],
            'follow_up_required' => ['required', 'boolean'],
            'technician_notes' => ['nullable', 'string', 'max:5000'],
        ]);

        DB::transaction(function () use ($request, $visit, $validated): void {
            $nextStatus = $validated['result'] === 'parts_required'
                ? 'awaiting_parts'
                : 'completed';
            $visit->update([
                ...$validated,
                'status' => $nextStatus,
                'actual_end_at' => now(),
                'lock_version' => $visit->lock_version + 1,
            ]);
            $visit->serviceOrder()->update([
                'status' => $nextStatus,
                'closed_at' => $nextStatus === 'completed' ? now() : null,
            ]);
            $this->recordStatus($request, $visit, 'in_progress', $nextStatus);
        });

        return response()->json(['data' => $this->payload($visit->refresh())]);
    }

    public function products(Request $request): JsonResponse
    {
        $query = trim((string) $request->string('q'));
        $products = Product::query()
            ->where('organization_id', $request->user()->organization_id)
            ->where('active', true)
            ->when($query !== '', function (Builder $builder) use ($query): void {
                $builder->where(function (Builder $builder) use ($query): void {
                    $builder
                        ->whereLike('name', "%{$query}%")
                        ->orWhereLike('article_number', "%{$query}%");
                });
            })
            ->orderBy('name')
            ->limit(30)
            ->get();

        return response()->json(['data' => $products]);
    }

    private function queryFor(Request $request): Builder
    {
        return Visit::query()
            ->where('organization_id', $request->user()->organization_id)
            ->where('technician_id', $request->user()->id)
            ->with([
                'serviceOrder.customer',
                'serviceOrder.serviceLocation',
                'serviceOrder.asset.manufacturer',
                'partRequirements.product',
            ]);
    }

    private function findFor(Request $request, string $visit): Visit
    {
        return $this->queryFor($request)->findOrFail($visit);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Visit $visit): array
    {
        $order = $visit->serviceOrder;
        $customer = $order->customer;

        return [
            'id' => $visit->id,
            'status' => $visit->status,
            'planned_start_at' => $visit->planned_start_at,
            'planned_end_at' => $visit->planned_end_at,
            'actual_start_at' => $visit->actual_start_at,
            'actual_end_at' => $visit->actual_end_at,
            'diagnosis' => $visit->diagnosis,
            'work_performed' => $visit->work_performed,
            'result' => $visit->result,
            'follow_up_required' => $visit->follow_up_required,
            'technician_notes' => $visit->technician_notes,
            'order' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'priority' => $order->priority,
                'fault_description' => $order->fault_description,
            ],
            'customer' => [
                'id' => $customer->id,
                'name' => trim("{$customer->first_name} {$customer->last_name}"),
                'primary_phone' => $customer->primary_phone,
            ],
            'location' => $order->serviceLocation,
            'asset' => $order->asset,
            'parts' => $visit->partRequirements,
        ];
    }

    private function recordStatus(
        Request $request,
        Visit $visit,
        string $from,
        string $to,
    ): void {
        StatusHistory::query()->create([
            'organization_id' => $request->user()->organization_id,
            'subject_type' => Visit::class,
            'subject_id' => $visit->id,
            'from_status' => $from,
            'to_status' => $to,
            'changed_by' => $request->user()->id,
            'created_at' => now(),
        ]);
    }
}
