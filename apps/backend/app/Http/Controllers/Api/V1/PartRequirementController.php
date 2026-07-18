<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PartRequirement;
use App\Models\ServiceOrder;
use App\Models\StatusHistory;
use App\Services\OperationalMessageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PartRequirementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(['requested', 'approved', 'ordered', 'received', 'rejected'])],
        ]);
        $requirements = PartRequirement::query()
            ->where('organization_id', $request->user()->organization_id)
            ->when($validated['status'] ?? null, fn ($builder, $status) => $builder->where('status', $status))
            ->with([
                'product',
                'requestedBy:id,name',
                'approvedBy:id,name',
                'visit.technician:id,name',
                'serviceOrder.customer',
                'serviceOrder.serviceLocation',
            ])
            ->orderByRaw("CASE status WHEN 'requested' THEN 1 WHEN 'approved' THEN 2 WHEN 'ordered' THEN 3 ELSE 4 END")
            ->latest()
            ->get();

        return response()->json(['data' => $requirements]);
    }

    public function transition(
        Request $request,
        string $partRequirement,
        OperationalMessageService $messages,
    ): JsonResponse {
        $requirement = PartRequirement::query()
            ->where('organization_id', $request->user()->organization_id)
            ->findOrFail($partRequirement);
        $validated = $request->validate([
            'status' => ['required', Rule::in(['approved', 'ordered', 'received', 'rejected'])],
            'supplier_reference' => ['nullable', 'string', 'max:255'],
            'office_notes' => ['nullable', 'string', 'max:5000'],
        ]);
        $allowed = [
            'requested' => ['approved', 'rejected'],
            'approved' => ['ordered', 'rejected'],
            'ordered' => ['received'],
        ];
        abort_unless(in_array($validated['status'], $allowed[$requirement->status] ?? [], true), 409);

        DB::transaction(function () use ($request, $requirement, $validated): void {
            $status = $validated['status'];
            $requirement->update([
                'status' => $status,
                'approved_by' => $status === 'approved'
                    ? $request->user()->id
                    : $requirement->approved_by,
                'approved_at' => $status === 'approved'
                    ? now()
                    : $requirement->approved_at,
                'ordered_at' => $status === 'ordered' ? now() : $requirement->ordered_at,
                'received_at' => $status === 'received' ? now() : null,
                'supplier_reference' => $validated['supplier_reference']
                    ?? $requirement->supplier_reference,
                'office_notes' => $validated['office_notes']
                    ?? $requirement->office_notes,
            ]);

            if (! in_array($status, ['received', 'rejected'], true)) {
                return;
            }
            $hasOutstanding = PartRequirement::query()
                ->where('service_order_id', $requirement->service_order_id)
                ->whereNotIn('status', ['received', 'rejected'])
                ->exists();
            if ($hasOutstanding) {
                return;
            }
            $order = ServiceOrder::query()
                ->where('organization_id', $request->user()->organization_id)
                ->lockForUpdate()
                ->findOrFail($requirement->service_order_id);
            if ($order->status !== 'awaiting_parts') {
                return;
            }
            $from = $order->status;
            $order->update(['status' => 'awaiting_scheduling']);
            StatusHistory::query()->create([
                'organization_id' => $order->organization_id,
                'subject_type' => ServiceOrder::class,
                'subject_id' => $order->id,
                'from_status' => $from,
                'to_status' => 'awaiting_scheduling',
                'changed_by' => $request->user()->id,
                'reason' => $status === 'received'
                    ? 'Alle benötigten Teile sind eingetroffen.'
                    : 'Alle offenen Teileanforderungen sind erledigt.',
                'metadata' => ['part_requirement_id' => $requirement->id],
                'created_at' => now(),
            ]);
        });
        $requirement->refresh()->load([
            'product',
            'serviceOrder.customer',
            'visit.technician',
        ]);
        if ($requirement->visit?->technician) {
            $statusLabels = [
                'approved' => 'freigegeben',
                'ordered' => 'bestellt',
                'received' => 'eingetroffen',
                'rejected' => 'abgelehnt',
            ];
            $messages->send(
                $request->user(),
                $requirement->visit->technician,
                'Status der Teileanforderung geändert',
                implode("\n", array_filter([
                    $requirement->serviceOrder->order_number.' · '.
                        $requirement->description,
                    'Status: '.($statusLabels[$requirement->status] ?? $requirement->status),
                    $requirement->office_notes,
                ])),
                $requirement->serviceOrder,
                $requirement->visit,
                in_array($requirement->status, ['received', 'rejected'], true)
                    ? 'high'
                    : 'normal',
                false,
                [
                    'event' => 'part_requirement_'.$requirement->status,
                    'part_requirement_id' => $requirement->id,
                ],
            );
        }

        return response()->json(['data' => $requirement]);
    }
}
