<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\Customer;
use App\Models\PartRequirement;
use App\Models\ServiceOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OfficeShellController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:255'],
        ]);
        $organizationId = $request->user()->organization_id;
        $like = '%'.trim($validated['q']).'%';

        $customers = Customer::query()
            ->where('organization_id', $organizationId)
            ->where(function ($builder) use ($like): void {
                $builder
                    ->whereLike('customer_number', $like)
                    ->orWhereLike('legacy_customer_number', $like)
                    ->orWhereLike('first_name', $like)
                    ->orWhereLike('last_name', $like)
                    ->orWhereLike('company_name', $like)
                    ->orWhereLike('primary_phone', $like)
                    ->orWhereLike('secondary_phone', $like)
                    ->orWhereHas('serviceLocations', fn ($locations) => $locations
                        ->whereLike('street', $like)
                        ->orWhereLike('postal_code', $like)
                        ->orWhereLike('city', $like));
            })
            ->with('serviceLocations')
            ->limit(8)
            ->get()
            ->map(fn (Customer $customer) => [
                'type' => 'customer',
                'id' => $customer->id,
                'title' => $customer->company_name ?: trim(
                    implode(' ', array_filter([$customer->first_name, $customer->last_name]))
                ),
                'subtitle' => implode(' · ', array_filter([
                    $customer->customer_number,
                    $customer->primary_phone,
                    $customer->serviceLocations->first()?->city,
                ])),
                'href' => '/office/customers?customer='.$customer->id,
            ]);

        $orders = ServiceOrder::query()
            ->where('organization_id', $organizationId)
            ->where(function ($builder) use ($like): void {
                $builder
                    ->whereLike('order_number', $like)
                    ->orWhereLike('legacy_order_number', $like)
                    ->orWhereLike('fault_description', $like)
                    ->orWhereHas('customer', fn ($customer) => $customer
                        ->whereLike('first_name', $like)
                        ->orWhereLike('last_name', $like)
                        ->orWhereLike('company_name', $like));
            })
            ->with('customer')
            ->latest()
            ->limit(8)
            ->get()
            ->map(fn (ServiceOrder $order) => [
                'type' => 'order',
                'id' => $order->id,
                'title' => $order->order_number,
                'subtitle' => implode(' · ', array_filter([
                    $order->customer?->company_name ?: trim(
                        implode(' ', array_filter([
                            $order->customer?->first_name,
                            $order->customer?->last_name,
                        ]))
                    ),
                    $order->fault_description,
                ])),
                'href' => '/office/orders?order='.$order->id,
            ]);

        $assets = Asset::query()
            ->where('organization_id', $organizationId)
            ->where(function ($builder) use ($like): void {
                $builder
                    ->whereLike('model', $like)
                    ->orWhereLike('serial_number', $like)
                    ->orWhereLike('production_number', $like)
                    ->orWhereLike('legacy_article_id', $like);
            })
            ->with(['customer', 'manufacturer'])
            ->limit(8)
            ->get()
            ->map(fn (Asset $asset) => [
                'type' => 'asset',
                'id' => $asset->id,
                'title' => trim(implode(' ', array_filter([
                    $asset->manufacturer?->name,
                    $asset->model,
                ]))) ?: 'Gerät',
                'subtitle' => implode(' · ', array_filter([
                    $asset->serial_number ? 'SN '.$asset->serial_number : null,
                    $asset->customer?->company_name ?: trim(
                        implode(' ', array_filter([
                            $asset->customer?->first_name,
                            $asset->customer?->last_name,
                        ]))
                    ),
                ])),
                'href' => '/office/assets?asset='.$asset->id,
            ]);

        return response()->json([
            'data' => [...$customers, ...$orders, ...$assets],
        ]);
    }

    public function notifications(Request $request): JsonResponse
    {
        $organizationId = $request->user()->organization_id;
        $partRequirements = PartRequirement::query()
            ->where('organization_id', $organizationId)
            ->where('status', 'requested')
            ->with('serviceOrder:id,order_number')
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (PartRequirement $requirement) => [
                'id' => 'part-'.$requirement->id,
                'type' => 'part',
                'title' => 'Teil angefordert',
                'body' => implode(' · ', array_filter([
                    $requirement->serviceOrder?->order_number,
                    $requirement->description,
                ])),
                'href' => '/office/inventory',
                'created_at' => $requirement->created_at,
            ]);
        $orders = ServiceOrder::query()
            ->where('organization_id', $organizationId)
            ->where('status', 'awaiting_scheduling')
            ->with('customer')
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (ServiceOrder $order) => [
                'id' => 'order-'.$order->id,
                'type' => 'order',
                'title' => 'Auftrag zu planen',
                'body' => implode(' · ', array_filter([
                    $order->order_number,
                    $order->customer?->company_name ?: trim(
                        implode(' ', array_filter([
                            $order->customer?->first_name,
                            $order->customer?->last_name,
                        ]))
                    ),
                ])),
                'href' => '/office/planning?order='.$order->id,
                'created_at' => $order->created_at,
            ]);
        $notifications = $partRequirements
            ->concat($orders)
            ->sortByDesc('created_at')
            ->take(12)
            ->values();

        return response()->json([
            'data' => $notifications,
            'meta' => ['count' => $notifications->count()],
        ]);
    }
}
