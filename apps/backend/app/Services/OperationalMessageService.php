<?php

namespace App\Services;

use App\Models\Message;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Support\Collection;

class OperationalMessageService
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function send(
        User $sender,
        User $recipient,
        string $subject,
        string $body,
        ?ServiceOrder $order = null,
        ?Visit $visit = null,
        string $severity = 'normal',
        bool $requiresAcknowledgement = false,
        array $metadata = [],
    ): Message {
        abort_unless(
            $sender->organization_id === $recipient->organization_id,
            422,
            'Sender und Empfänger müssen zum selben Betrieb gehören.',
        );

        return Message::query()->create([
            'organization_id' => $sender->organization_id,
            'sender_id' => $sender->id,
            'recipient_id' => $recipient->id,
            'service_order_id' => $order?->id,
            'visit_id' => $visit?->id,
            'type' => 'system',
            'severity' => $severity,
            'requires_ack' => $requiresAcknowledgement,
            'subject' => $subject,
            'body' => $body,
            'metadata' => $metadata,
        ]);
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return Collection<int, Message>
     */
    public function notifyOffice(
        User $sender,
        string $subject,
        string $body,
        ?ServiceOrder $order = null,
        ?Visit $visit = null,
        string $severity = 'normal',
        array $metadata = [],
    ): Collection {
        return User::query()
            ->where('organization_id', $sender->organization_id)
            ->whereIn('role_code', ['dispatcher', 'office_admin'])
            ->where('status', 'active')
            ->whereKeyNot($sender->id)
            ->get()
            ->map(fn (User $recipient) => $this->send(
                $sender,
                $recipient,
                $subject,
                $body,
                $order,
                $visit,
                $severity,
                false,
                $metadata,
            ));
    }
}
