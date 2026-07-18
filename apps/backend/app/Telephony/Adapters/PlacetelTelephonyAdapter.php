<?php

namespace App\Telephony\Adapters;

use App\Telephony\Data\NormalizedCallEvent;
use App\Telephony\Support\PayloadReader;

class PlacetelTelephonyAdapter extends GenericTelephonyAdapter
{
    public function provider(): string
    {
        return 'placetel';
    }

    public function normalize(array $payload): NormalizedCallEvent
    {
        $providerEvent = PayloadReader::string($payload, [
            'event', 'event_type', 'type', 'status',
        ]) ?? 'IncomingCall';
        $status = $this->status($providerEvent);
        $duration = PayloadReader::integer($payload, [
            'duration', 'duration_seconds', 'length', 'ringing_time',
        ]);
        $callType = strtolower((string) PayloadReader::string($payload, [
            'call_type', 'result', 'type',
        ]));

        if ($status === 'ended' && ($callType === 'missed' || $duration === 0)) {
            $status = 'missed';
        }

        return new NormalizedCallEvent(
            provider: $this->provider(),
            providerEvent: $providerEvent,
            status: $status,
            direction: $this->direction(
                PayloadReader::string($payload, ['direction']),
                $providerEvent,
            ),
            externalCallId: PayloadReader::string($payload, [
                'call_id', 'callid', 'id',
            ]),
            fromNumber: PayloadReader::string($payload, [
                'from', 'from_number', 'caller_id', 'number',
            ]),
            toNumber: PayloadReader::string($payload, [
                'to', 'to_number', 'did',
            ]),
            callerName: PayloadReader::string($payload, [
                'from_name', 'caller_name', 'name',
            ]),
            extension: PayloadReader::string($payload, [
                'sipuid', 'extension', 'agent', 'device', 'mac',
            ]),
            durationSeconds: $duration,
            occurredAt: PayloadReader::date($payload, [
                'occurred_at', 'received_at', 'timestamp', 'time',
            ]),
            payload: $payload,
        );
    }
}
