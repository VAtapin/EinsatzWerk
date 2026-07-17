<?php

namespace App\Http\Requests;

use App\Models\Asset;
use App\Models\ServiceLocation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreServiceOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $organizationId = $this->user()?->organization_id
            ?? $this->header('X-Organization-ID');

        return [
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
            'priority' => ['required', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'fault_category' => ['required', 'string', 'max:255'],
            'fault_description' => ['required', 'string', 'max:5000'],
            'customer_message' => ['nullable', 'string', 'max:5000'],
            'dispatcher_notes' => ['nullable', 'string', 'max:5000'],
            'preferred_date' => ['nullable', 'date'],
            'appointment.starts_at' => ['nullable', 'date'],
            'appointment.ends_at' => ['nullable', 'date', 'after:appointment.starts_at'],
            'appointment.is_hard' => ['sometimes', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $belongsToCustomer = ServiceLocation::query()
                    ->whereKey($this->input('service_location_id'))
                    ->where('customer_id', $this->input('customer_id'))
                    ->exists();

                if (! $belongsToCustomer) {
                    $validator->errors()->add(
                        'service_location_id',
                        'The service location must belong to the selected customer.',
                    );
                }

                if ($this->filled('asset_id')) {
                    $assetBelongsToCustomer = Asset::query()
                        ->whereKey($this->input('asset_id'))
                        ->where('customer_id', $this->input('customer_id'))
                        ->exists();

                    if (! $assetBelongsToCustomer) {
                        $validator->errors()->add(
                            'asset_id',
                            'The asset must belong to the selected customer.',
                        );
                    }
                }
            },
        ];
    }
}
