<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\ServiceLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomerLocationController extends Controller
{
    public function store(Request $request, string $customer): JsonResponse
    {
        $organizationId = $request->user()->organization_id;
        $customer = Customer::query()
            ->where('organization_id', $organizationId)
            ->findOrFail($customer);
        $validated = $this->validateLocation($request, $organizationId);
        if ($validated['is_primary'] ?? false) {
            $customer->serviceLocations()->update(['is_primary' => false]);
        }
        $location = $customer->serviceLocations()->create([
            ...$validated,
            'organization_id' => $organizationId,
            'type' => 'service',
            'country' => 'DE',
        ]);

        return response()->json(['data' => $location], 201);
    }

    public function update(
        Request $request,
        string $customer,
        string $serviceLocation,
    ): JsonResponse {
        $organizationId = $request->user()->organization_id;
        $customer = Customer::query()
            ->where('organization_id', $organizationId)
            ->findOrFail($customer);
        $location = ServiceLocation::query()
            ->where('organization_id', $organizationId)
            ->where('customer_id', $customer->id)
            ->findOrFail($serviceLocation);
        $validated = $this->validateLocation($request, $organizationId);
        if ($validated['is_primary'] ?? false) {
            $customer->serviceLocations()
                ->whereKeyNot($location->id)
                ->update(['is_primary' => false]);
        }
        $location->update($validated);

        return response()->json(['data' => $location->fresh()]);
    }

    private function validateLocation(Request $request, string $organizationId): array
    {
        return $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'street' => ['nullable', 'string', 'max:255'],
            'house_number' => ['nullable', 'string', 'max:64'],
            'address_addition' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['required', 'string', 'max:16'],
            'city' => ['required', 'string', 'max:255'],
            'access_notes' => ['nullable', 'string', 'max:5000'],
            'parking_notes' => ['nullable', 'string', 'max:5000'],
            'is_primary' => ['sometimes', 'boolean'],
            'service_area_id' => [
                'nullable',
                Rule::exists('service_areas', 'id')->where('organization_id', $organizationId),
            ],
        ]);
    }
}
