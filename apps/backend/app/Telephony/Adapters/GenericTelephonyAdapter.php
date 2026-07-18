<?php

namespace App\Telephony\Adapters;

use App\Telephony\Contracts\TelephonyProviderAdapter;
use App\Telephony\Data\NormalizedCallEvent;
use App\Telephony\Support\PayloadReader;

class GenericTelephonyAdapter implements TelephonyProviderAdapter
{
    public function provider(): string
    {
        return 'generic';
    }

    public function normalize(array $payload): NormalizedCallEvent
    {
        $providerEvent = PayloadReader::string($payload, ['event', 'event_type', 'type', 'status'])
            ?? 'incoming';
        $status = $this->status($providerEvent);

        return new NormalizedCallEvent(
            provider: $this->provider(),
            providerEvent: $providerEvent,
            status: $status,
            direction: $this->direction(
                PayloadReader::string($payload, ['direction', 'call_direction']),
                $providerEvent,
            ),
            externalCallId: PayloadReader::string($payload, [
                'call_id', 'callid', 'external_call_id', 'id',
            ]),
            fromNumber: PayloadReader::string($payload, [
                'from', 'from_number', 'caller', 'caller_id', 'number',
            ]),
            toNumber: PayloadReader::string($payload, [
                'to', 'to_number', 'called', 'did',
            ]),
            callerName: PayloadReader::string($payload, [
                'caller_name', 'from_name', 'name',
            ]),
            extension: PayloadReader::string($payload, [
                'extension', 'agent', 'dn', 'sipuid',
            ]),
            durationSeconds: PayloadReader::integer($payload, [
                'duration', 'duration_seconds', 'length',
            ]),
            occurredAt: PayloadReader::date($payload, [
                'occurred_at', 'timestamp', 'received_at', 'time', 'date',
            ]),
            payload: $payload,
        );
    }

    protected function status(string $event): string
    {
        $event = strtolower($event);

        return match (true) {
            str_contains($event, 'missed'),
            str_contains($event, 'unanswered'),
            str_contains($event, 'notanswered') => 'missed',
            str_contains($event, 'hang'),
            str_contains($event, 'hung'),
            str_contains($event, 'end'),
            str_contains($event, 'disconnect'),
            str_contains($event, 'complete'),
            str_contains($event, 'terminated') => 'ended',
            str_contains($event, 'accept'),
            str_contains($event, 'answer'),
            str_contains($event, 'connect'),
            str_contains($event, 'talk') => 'accepted',
            default => 'ringing',
        };
    }

    protected function direction(?string $direction, string $event): string
    {
        $value = strtolower((string) $direction.' '.$event);

        return str_contains($value, 'out') ? 'outgoing' : 'incoming';
    }
}
