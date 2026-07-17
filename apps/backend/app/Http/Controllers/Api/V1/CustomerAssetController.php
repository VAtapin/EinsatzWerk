<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerAssetController extends Controller
{
    public function store(Request $request, string $customer): JsonResponse
    {
        $organizationId = $request->user()->organization_id;
        $customerModel = Customer::query()
            ->where('organization_id', $organizationId)
            ->findOrFail($customer);
        $validated = $request->validate([
            'model' => ['required', 'string', 'max:255'],
            'serial_number' => ['nullable', 'string', 'max:255'],
            'production_number' => ['nullable', 'string', 'max:255'],
            'purchase_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);
        $locationId = $customerModel->serviceLocations()
            ->where('is_primary', true)
            ->value('id');

        $asset = Asset::query()->create([
            ...$validated,
            'organization_id' => $organizationId,
            'customer_id' => $customerModel->id,
            'service_location_id' => $locationId,
            'status' => 'active',
        ]);

        return response()->json(['data' => $asset], 201);
    }
}
