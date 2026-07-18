<?php

namespace App\Telephony;

use App\Telephony\Adapters\GenericTelephonyAdapter;
use App\Telephony\Adapters\PlacetelTelephonyAdapter;
use App\Telephony\Adapters\ThreeCxTelephonyAdapter;
use App\Telephony\Contracts\TelephonyProviderAdapter;
use Illuminate\Validation\ValidationException;

class TelephonyAdapterManager
{
    public function for(string $provider): TelephonyProviderAdapter
    {
        return match (strtolower($provider)) {
            '3cx', 'threecx', 'three-cx' => app(ThreeCxTelephonyAdapter::class),
            'placetel' => app(PlacetelTelephonyAdapter::class),
            'generic' => app(GenericTelephonyAdapter::class),
            default => throw ValidationException::withMessages([
                'provider' => "Unbekannter Telefonieanbieter: {$provider}",
            ]),
        };
    }
}
