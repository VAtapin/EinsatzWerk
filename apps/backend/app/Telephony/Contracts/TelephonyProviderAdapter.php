<?php

namespace App\Telephony\Contracts;

use App\Telephony\Data\NormalizedCallEvent;

interface TelephonyProviderAdapter
{
    public function provider(): string;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function normalize(array $payload): NormalizedCallEvent;
}
