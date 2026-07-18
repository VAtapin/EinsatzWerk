<?php

namespace App\Telephony\Data;

use Carbon\CarbonImmutable;

final readonly class NormalizedCallEvent
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public string $provider,
        public string $providerEvent,
        public string $status,
        public string $direction,
        public ?string $externalCallId,
        public ?string $fromNumber,
        public ?string $toNumber,
        public ?string $callerName,
        public ?string $extension,
        public ?int $durationSeconds,
        public CarbonImmutable $occurredAt,
        public array $payload,
    ) {}
}
