<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'in:active,inactive'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $query = trim((string) ($validated['q'] ?? ''));
        $customers = Customer::query()
            ->where('organization_id', $request->user()->organization_id)
            ->when($validated['status'] ?? null, fn ($builder, $status) => $builder->where('status', $status))
            ->when($query !== '', function ($builder) use ($query): void {
                $like = '%'.$query.'%';
                $builder->where(function ($builder) use ($like): void {
                    $builder
                        ->whereLike('customer_number', $like)
                        ->orWhereLike('legacy_customer_number', $like)
                        ->orWhereLike('first_name', $like)
                        ->orWhereLike('last_name', $like)
                        ->orWhereLike('company_name', $like)
                        ->orWhereLike('primary_phone', $like)
                        ->orWhereLike('secondary_phone', $like)
                        ->orWhereLike('email', $like)
                        ->orWhereHas('serviceLocations', fn ($locations) => $locations
                            ->whereLike('street', $like)
                            ->orWhereLike('postal_code', $like)
                            ->orWhereLike('city', $like));
                });
            })
            ->with([
                'serviceLocations' => fn ($builder) => $builder
                    ->orderByDesc('is_primary')
                    ->oldest(),
            ])
            ->withCount(['assets', 'serviceOrders'])
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->limit($validated['limit'] ?? 50)
            ->get();

        return response()->json(['data' => $customers]);
    }

    public function show(Request $request, string $customer): JsonResponse
    {
        $customer = Customer::query()
            ->where('organization_id', $request->user()->organization_id)
            ->with([
                'serviceLocations' => fn ($builder) => $builder
                    ->orderByDesc('is_primary')
                    ->oldest(),
                'assets' => fn ($builder) => $builder
                    ->with(['manufacturer:id,name', 'serviceLocation'])
                    ->orderByRaw("CASE status WHEN 'active' THEN 1 ELSE 2 END")
                    ->latest(),
                'serviceOrders' => fn ($builder) => $builder
                    ->with(['asset:id,model,serial_number', 'serviceLocation'])
                    ->latest()
                    ->limit(10),
                'commercialDocuments' => fn ($builder) => $builder
                    ->latest('document_date')
                    ->limit(10),
            ])
            ->findOrFail($customer);

        return response()->json(['data' => $customer]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'primary_phone' => ['required', 'string', 'max:255'],
            'secondary_phone' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'street' => ['nullable', 'string', 'max:255'],
            'house_number' => ['nullable', 'string', 'max:64'],
            'postal_code' => ['required', 'string', 'max:16'],
            'city' => ['required', 'string', 'max:255'],
        ]);
        $organizationId = $request->user()->organization_id;
        $duplicate = Customer::query()
            ->where('organization_id', $organizationId)
            ->where('primary_phone', $validated['primary_phone'])
            ->where('last_name', $validated['last_name'])
            ->whereHas('serviceLocations', fn ($builder) => $builder
                ->where('postal_code', $validated['postal_code']))
            ->first();

        if ($duplicate !== null) {
            return response()->json([
                'message' => 'Ein möglicher Dubletten-Kunde wurde gefunden.',
                'duplicate_customer_id' => $duplicate->id,
                'duplicate_customer_number' => $duplicate->customer_number,
            ], 409);
        }

        $customer = DB::transaction(function () use ($validated, $organizationId): Customer {
            $sequenceDate = today()->toDateString();
            DB::table('customer_number_sequences')->insertOrIgnore([
                'organization_id' => $organizationId,
                'sequence_date' => $sequenceDate,
                'current_value' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $sequenceRow = DB::table('customer_number_sequences')
                ->where('organization_id', $organizationId)
                ->where('sequence_date', $sequenceDate)
                ->lockForUpdate()
                ->first();
            $sequence = ((int) $sequenceRow->current_value) + 1;
            DB::table('customer_number_sequences')
                ->where('id', $sequenceRow->id)
                ->update([
                    'current_value' => $sequence,
                    'updated_at' => now(),
                ]);

            $customer = Customer::query()->create([
                'organization_id' => $organizationId,
                'customer_number' => sprintf('K-%s-%03d', now()->format('Ymd'), $sequence),
                'customer_type' => 'person',
                'first_name' => $validated['first_name'] ?? null,
                'last_name' => $validated['last_name'],
                'primary_phone' => $validated['primary_phone'],
                'secondary_phone' => $validated['secondary_phone'] ?? null,
                'email' => $validated['email'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'status' => 'active',
            ]);
            $customer->serviceLocations()->create([
                'organization_id' => $organizationId,
                'type' => 'service',
                'street' => $validated['street'] ?? null,
                'house_number' => $validated['house_number'] ?? null,
                'postal_code' => $validated['postal_code'],
                'city' => $validated['city'],
                'country' => 'DE',
                'is_primary' => true,
            ]);

            return $customer;
        });

        $customer->load(['serviceLocations', 'assets']);

        return response()->json([
            'data' => [
                'id' => $customer->id,
                'customer_number' => $customer->customer_number,
                'legacy_customer_number' => null,
                'display_name' => trim(implode(' ', array_filter([
                    $customer->first_name,
                    $customer->last_name,
                ]))),
                'company_name' => null,
                'primary_phone' => $customer->primary_phone,
                'secondary_phone' => $customer->secondary_phone,
                'email' => $customer->email,
                'notes' => $customer->notes,
                'location' => $customer->serviceLocations->first(),
                'assets' => [],
            ],
        ], 201);
    }
}
