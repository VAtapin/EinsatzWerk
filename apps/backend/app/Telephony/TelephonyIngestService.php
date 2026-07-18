<?php

namespace App\Telephony;

use App\Models\TelephonyCall;
use App\Models\TelephonyCallEvent;
use App\Models\TelephonyIntegration;
use App\Telephony\Data\NormalizedCallEvent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TelephonyIngestService
{
    public function __construct(private readonly PhoneNumberMatcher $matcher) {}

    public function ingest(
        TelephonyIntegration $integration,
        NormalizedCallEvent $event,
    ): TelephonyCall {
        return DB::transaction(function () use ($integration, $event): TelephonyCall {
            $externalId = $event->externalCallId
                ?: $this->findOpenCall($integration, $event)?->external_call_id
                ?: 'generated-'.Str::ulid();
            $call = TelephonyCall::query()->firstOrNew([
                'telephony_integration_id' => $integration->id,
                'external_call_id' => $externalId,
            ]);
            $matches = $event->direction === 'incoming'
                ? $this->matcher->find($integration->organization_id, $event->fromNumber)
                : collect();
            $uniqueMatch = $matches->count() === 1 ? $matches->first() : null;

            $call->fill([
                'organization_id' => $integration->organization_id,
                'provider' => $integration->provider,
                'direction' => $event->direction,
                'status' => $event->status,
                'from_number' => $event->fromNumber ?: $call->from_number,
                'to_number' => $event->toNumber ?: $call->to_number,
                'caller_name' => $event->callerName ?: $call->caller_name,
                'extension' => $event->extension ?: $call->extension,
                'customer_id' => $call->customer_id
                    ?: ($uniqueMatch ? $uniqueMatch['customer']->id : null),
                'matched_by' => $call->matched_by
                    ?: ($uniqueMatch ? $uniqueMatch['matched_by'] : null),
                'started_at' => $call->started_at ?: $event->occurredAt,
                'answered_at' => $event->status === 'accepted'
                    ? ($call->answered_at ?: $event->occurredAt)
                    : $call->answered_at,
                'ended_at' => in_array($event->status, ['ended', 'missed'], true)
                    ? $event->occurredAt
                    : $call->ended_at,
                'duration_seconds' => $event->durationSeconds ?? $call->duration_seconds,
                'provider_data' => $event->payload,
            ]);
            $call->save();

            $eventKey = hash('sha256', implode('|', [
                $integration->id,
                $externalId,
                $event->providerEvent,
                $event->status,
                json_encode($event->payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]));
            TelephonyCallEvent::query()->firstOrCreate(
                [
                    'telephony_integration_id' => $integration->id,
                    'event_key' => $eventKey,
                ],
                [
                    'organization_id' => $integration->organization_id,
                    'telephony_call_id' => $call->id,
                    'provider_event' => $event->providerEvent,
                    'normalized_status' => $event->status,
                    'payload' => $event->payload,
                    'occurred_at' => $event->occurredAt,
                    'created_at' => now(),
                ],
            );
            $integration->forceFill(['last_event_at' => now()])->save();

            return $call->refresh()->load([
                'customer.serviceLocations',
                'customer.assets',
                'customer.serviceOrders',
            ]);
        });
    }

    private function findOpenCall(
        TelephonyIntegration $integration,
        NormalizedCallEvent $event,
    ): ?TelephonyCall {
        return TelephonyCall::query()
            ->where('telephony_integration_id', $integration->id)
            ->whereNotIn('status', ['ended', 'missed'])
            ->when($event->fromNumber, fn ($builder, $number) => $builder->where('from_number', $number))
            ->when($event->toNumber, fn ($builder, $number) => $builder->where('to_number', $number))
            ->where('created_at', '>=', now()->subHours(12))
            ->latest()
            ->first();
    }
}
