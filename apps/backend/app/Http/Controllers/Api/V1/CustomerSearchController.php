<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerSearchController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $query = trim((string) $request->string('q'));
        $organizationId = $request->user()?->organization_id
            ?? $request->header('X-Organization-ID');

        abort_if($organizationId === null, 422, 'Organization context is required.');

        $customers = Customer::query()
            ->where('organization_id', $organizationId)
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
                        ->orWhereHas('serviceLocations', function ($builder) use ($like): void {
                            $builder
                                ->whereLike('street', $like)
                                ->orWhereLike('postal_code', $like)
                                ->orWhereLike('city', $like);
                        });
                });
            })
            ->with([
                'serviceLocations' => fn ($builder) => $builder->where('is_primary', true),
                'assets' => fn ($builder) => $builder
                    ->where('status', 'active')
                    ->latest('purchase_date'),
            ])
            ->orderBy('last_name')
            ->limit(20)
            ->get();

        return response()->json([
            'data' => $customers->map(fn (Customer $customer) => [
                'id' => $customer->id,
                'customer_number' => $customer->customer_number,
                'legacy_customer_number' => $customer->legacy_customer_number,
                'display_name' => trim(implode(' ', array_filter([
                    $customer->first_name,
                    $customer->last_name,
                ]))),
                'company_name' => $customer->company_name,
                'primary_phone' => $customer->primary_phone,
                'secondary_phone' => $customer->secondary_phone,
                'email' => $customer->email,
                'notes' => $customer->notes,
                'location' => $customer->serviceLocations->first(),
                'assets' => $customer->assets,
            ]),
        ]);
    }
}
