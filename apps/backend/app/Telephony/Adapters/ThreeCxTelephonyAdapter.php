<?php

namespace App\Telephony\Adapters;

use App\Telephony\Data\NormalizedCallEvent;
use App\Telephony\Support\PayloadReader;

class ThreeCxTelephonyAdapter extends GenericTelephonyAdapter
{
    public function provider(): string
    {
        return '3cx';
    }

    public function normalize(array $payload): NormalizedCallEvent
    {
        $payload = $this->unwrap($payload);
        $providerEvent = PayloadReader::string($payload, [
            'event', 'event_type', 'call_type', 'status', 'participant_status', 'type',
        ]) ?? 'IncomingCall';
        $status = $this->status($providerEvent);
        $duration = PayloadReader::integer($payload, [
            'duration', 'duration_seconds', 'call_duration',
        ]);
        $answered = PayloadReader::first($payload, ['answered', 'call_answered']);

        if ($duration !== null && $status === 'ringing') {
            $status = filter_var($answered, FILTER_VALIDATE_BOOL)
                ? 'ended'
                : ($duration > 0 ? 'ended' : 'missed');
        }

        return new NormalizedCallEvent(
            provider: $this->provider(),
            providerEvent: $providerEvent,
            status: $status,
            direction: $this->direction(
                PayloadReader::string($payload, ['direction', 'call_direction']),
                $providerEvent,
            ),
            externalCallId: PayloadReader::string($payload, [
                'call_id', 'callid', 'legid', 'participant_id', 'id',
            ]),
            fromNumber: PayloadReader::string($payload, [
                'party_caller_id', 'caller_id', 'number', 'from', 'from_number',
            ]),
            toNumber: PayloadReader::string($payload, [
                'party_did', 'did', 'to', 'to_number', 'called_number',
            ]),
            callerName: PayloadReader::string($payload, [
                'party_caller_name', 'caller_name', 'contact_name', 'name',
            ]),
            extension: PayloadReader::string($payload, [
                'agent', 'extension', 'dn', 'party_dn', 'device_id',
            ]),
            durationSeconds: $duration,
            occurredAt: PayloadReader::date($payload, [
                'occurred_at', 'call_start_time', 'call_end_time', 'datetime', 'timestamp',
            ]),
            payload: $payload,
        );
    }

    /**
     * Accepts both 3CX CRM journaling payloads and Call Control WebSocket envelopes.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function unwrap(array $payload): array
    {
        foreach (['AttachedData', 'attached_data', 'Response', 'response', 'RequestData'] as $key) {
            $value = $payload[$key] ?? null;
            if (is_string($value)) {
                $decoded = json_decode($value, true);
                $value = is_array($decoded) ? $decoded : null;
            }
            if (is_array($value)) {
                $payload = [...$payload, ...$value];
            }
        }

        $participants = $payload['participants'] ?? $payload['Participants'] ?? null;
        if (is_array($participants) && isset($participants[0]) && is_array($participants[0])) {
            $payload = [...$payload, ...$participants[0]];
        }

        return $payload;
    }
}
