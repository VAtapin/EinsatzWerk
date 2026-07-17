<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ServiceLocation;
use App\Models\ServiceOrder;
use App\Models\StatusHistory;
use App\Models\Visit;
use App\Models\VisitDocument;
use App\Services\ServiceReportGenerator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TechnicianVisitController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string', 'max:64'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $visits = $this->queryFor($request)
            ->when($validated['status'] ?? null, fn ($builder, $status) => $builder->where('status', $status))
            ->when($validated['from'] ?? null, fn ($builder, $date) => $builder->whereDate('planned_date', '>=', $date))
            ->when($validated['to'] ?? null, fn ($builder, $date) => $builder->whereDate('planned_date', '<=', $date))
            ->orderByDesc('planned_start_at')
            ->limit(100)
            ->get()
            ->map($this->payload(...));

        return response()->json(['data' => $visits]);
    }

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

    public function usePart(Request $request, string $visit): JsonResponse
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
            'unit_price' => ['nullable', 'numeric', 'min:0'],
        ]);
        $part = $visit->usedParts()->create([
            ...$validated,
            'organization_id' => $request->user()->organization_id,
        ]);

        return response()->json(['data' => $part], 201);
    }

    public function uploadPhoto(Request $request, string $visit): JsonResponse
    {
        $visit = $this->findFor($request, $visit);
        abort_unless($visit->status === 'in_progress', 409);
        $validated = $request->validate([
            'photo' => ['required', 'image', 'max:10240'],
        ]);
        $file = $validated['photo'];
        $path = $file->store(
            "organizations/{$visit->organization_id}/visits/{$visit->id}/photos",
            'local',
        );
        $document = $visit->documents()->create([
            'organization_id' => $visit->organization_id,
            'type' => 'photo',
            'disk' => 'local',
            'path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $document], 201);
    }

    public function signature(Request $request, string $visit): JsonResponse
    {
        $visit = $this->findFor($request, $visit);
        abort_unless($visit->status === 'in_progress', 409);
        $validated = $request->validate([
            'data_url' => ['required', 'string', 'starts_with:data:image/png;base64,'],
            'signer_name' => ['required', 'string', 'max:255'],
        ]);
        $binary = base64_decode(substr($validated['data_url'], 22), true);
        abort_if($binary === false || strlen($binary) > 2_000_000, 422, 'Ungültige Unterschrift.');
        $path = "organizations/{$visit->organization_id}/visits/{$visit->id}/signature.png";
        Storage::disk('local')->put($path, $binary);
        $document = VisitDocument::query()->updateOrCreate(
            ['visit_id' => $visit->id, 'type' => 'signature'],
            [
                'organization_id' => $visit->organization_id,
                'disk' => 'local',
                'path' => $path,
                'original_name' => 'Unterschrift.png',
                'mime_type' => 'image/png',
                'size' => strlen($binary),
                'created_by' => $request->user()->id,
                'metadata' => [
                    'signer_name' => $validated['signer_name'],
                    'signed_at' => now()->toIso8601String(),
                ],
            ],
        );

        return response()->json(['data' => $document], 201);
    }

    public function complete(
        Request $request,
        string $visit,
        ServiceReportGenerator $reportGenerator,
    ): JsonResponse {
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
        abort_if(
            $validated['result'] !== 'parts_required'
                && ! $visit->documents()->where('type', 'signature')->exists(),
            422,
            'Die Kundenunterschrift fehlt.',
        );

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
        if ($visit->refresh()->status === 'completed') {
            $reportGenerator->generate($visit);
        }

        return response()->json(['data' => $this->payload($visit->refresh())]);
    }

    public function document(Request $request, string $visit, string $document): StreamedResponse
    {
        $visit = $this->findFor($request, $visit);
        $documentModel = $visit->documents()->findOrFail($document);

        return Storage::disk($documentModel->disk)->download(
            $documentModel->path,
            $documentModel->original_name,
            ['Content-Type' => $documentModel->mime_type],
        );
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

    public function customers(Request $request): JsonResponse
    {
        $query = trim((string) $request->string('q'));
        $customerIds = Visit::query()
            ->where('visits.organization_id', $request->user()->organization_id)
            ->where('visits.technician_id', $request->user()->id)
            ->join('service_orders', 'service_orders.id', '=', 'visits.service_order_id')
            ->distinct()
            ->pluck('service_orders.customer_id');
        $customers = Customer::query()
            ->where('organization_id', $request->user()->organization_id)
            ->whereIn('id', $customerIds)
            ->when($query !== '', function ($builder) use ($query): void {
                $like = "%{$query}%";
                $builder->where(fn ($builder) => $builder
                    ->whereLike('first_name', $like)
                    ->orWhereLike('last_name', $like)
                    ->orWhereLike('company_name', $like)
                    ->orWhereLike('primary_phone', $like));
            })
            ->with(['serviceLocations', 'assets'])
            ->orderBy('last_name')
            ->limit(100)
            ->get();

        return response()->json(['data' => $customers]);
    }

    public function createEmergency(Request $request): JsonResponse
    {
        $organizationId = $request->user()->organization_id;
        $validated = $request->validate([
            'customer_id' => [
                'required',
                Rule::exists('customers', 'id')->where('organization_id', $organizationId),
            ],
            'service_location_id' => [
                'required',
                Rule::exists('service_locations', 'id')->where('organization_id', $organizationId),
            ],
            'asset_id' => [
                'nullable',
                Rule::exists('assets', 'id')->where('organization_id', $organizationId),
            ],
            'fault_category' => ['required', 'string', 'max:255'],
            'fault_description' => ['required', 'string', 'max:5000'],
            'priority' => ['required', Rule::in(['low', 'normal', 'high', 'urgent'])],
        ]);
        abort_unless(
            ServiceLocation::query()
                ->whereKey($validated['service_location_id'])
                ->where('customer_id', $validated['customer_id'])
                ->exists(),
            422,
            'Service location does not belong to customer.',
        );
        if ($validated['asset_id'] ?? null) {
            abort_unless(
                Asset::query()
                    ->whereKey($validated['asset_id'])
                    ->where('customer_id', $validated['customer_id'])
                    ->exists(),
                422,
                'Asset does not belong to customer.',
            );
        }

        $visit = DB::transaction(function () use ($request, $organizationId, $validated): Visit {
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
                ->update(['current_value' => $sequence, 'updated_at' => now()]);
            $order = ServiceOrder::query()->create([
                ...$validated,
                'organization_id' => $organizationId,
                'order_number' => sprintf('A-%s-%03d', now()->format('Ymd'), $sequence),
                'source' => 'technician',
                'status' => 'planned',
                'created_by' => $request->user()->id,
            ]);
            $visit = $order->visits()->create([
                'organization_id' => $organizationId,
                'technician_id' => $request->user()->id,
                'planned_date' => today(),
                'planned_start_at' => now(),
                'planned_end_at' => now()->addHour(),
                'dispatcher_duration_minutes' => 60,
                'status' => 'planned',
                'visit_number' => 1,
            ]);

            return $visit;
        });

        return response()->json(['data' => $this->payload($this->findFor($request, $visit->id))], 201);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'locale' => ['required', 'string', 'in:de,en'],
            'password' => ['nullable', 'string', 'min:12'],
        ]);
        if (blank($validated['password'] ?? null)) {
            unset($validated['password']);
        }
        $request->user()->update($validated);

        return response()->json(['data' => $request->user()->fresh()]);
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
                'usedParts.product',
                'documents',
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
            'used_parts' => $visit->usedParts,
            'documents' => $visit->documents->map(fn (VisitDocument $document) => [
                'id' => $document->id,
                'type' => $document->type,
                'name' => $document->original_name,
                'mime_type' => $document->mime_type,
                'metadata' => $document->metadata,
                'download_path' => "/technician/visits/{$visit->id}/documents/{$document->id}",
            ]),
            'work_duration_minutes' => $visit->actual_start_at && $visit->actual_end_at
                ? $visit->actual_start_at->diffInMinutes($visit->actual_end_at)
                : null,
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
