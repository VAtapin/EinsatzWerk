<?php

namespace App\Telephony;

use App\Models\Customer;
use App\Models\TelephonyCall;

class TelephonyCallPresenter
{
    public function __construct(private readonly PhoneNumberMatcher $matcher) {}

    /**
     * @return array<string, mixed>
     */
    public function present(TelephonyCall $call): array
    {
        $call->loadMissing([
            'customer.serviceLocations',
            'customer.assets.manufacturer',
            'customer.serviceOrders',
            'integration:id,name,provider',
            'acknowledgedBy:id,name',
        ]);
        $matches = $call->customer
            ? collect([[
                'customer' => $call->customer,
                'score' => 100,
                'matched_by' => $call->matched_by ?? 'assigned',
            ]])
            : $this->matcher->find($call->organization_id, $call->from_number);

        return [
            'id' => $call->id,
            'provider' => $call->provider,
            'integration' => $call->integration,
            'external_call_id' => $call->external_call_id,
            'direction' => $call->direction,
            'status' => $call->status,
            'from_number' => $call->from_number,
            'to_number' => $call->to_number,
            'caller_name' => $call->caller_name,
            'extension' => $call->extension,
            'started_at' => $call->started_at,
            'answered_at' => $call->answered_at,
            'ended_at' => $call->ended_at,
            'duration_seconds' => $call->duration_seconds,
            'acknowledged_at' => $call->acknowledged_at,
            'acknowledged_by' => $call->acknowledgedBy,
            'customer' => $call->customer ? $this->customer($call->customer) : null,
            'matches' => $matches->map(fn (array $match) => [
                ...$this->customer($match['customer']),
                'matched_by' => $match['matched_by'],
                'score' => $match['score'],
            ])->values(),
            'created_at' => $call->created_at,
            'updated_at' => $call->updated_at,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function customer(Customer $customer): array
    {
        $customer->loadMissing([
            'serviceLocations',
            'assets.manufacturer',
            'serviceOrders',
        ]);

        return [
            'id' => $customer->id,
            'customer_number' => $customer->customer_number,
            'legacy_customer_number' => $customer->legacy_customer_number,
            'display_name' => $customer->company_name ?: trim(implode(' ', array_filter([
                $customer->first_name,
                $customer->last_name,
            ]))),
            'first_name' => $customer->first_name,
            'last_name' => $customer->last_name,
            'company_name' => $customer->company_name,
            'primary_phone' => $customer->primary_phone,
            'secondary_phone' => $customer->secondary_phone,
            'email' => $customer->email,
            'notes' => $customer->notes,
            'service_locations' => $customer->serviceLocations,
            'assets' => $customer->assets,
            'open_orders' => $customer->serviceOrders
                ->whereNotIn('status', ['completed', 'cancelled'])
                ->values(),
        ];
    }
}
