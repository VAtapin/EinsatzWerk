<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Message;
use App\Models\Organization;
use App\Models\ServiceLocation;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OperationalMessagingTest extends TestCase
{
    use RefreshDatabase;

    public function test_assignment_and_rescheduling_require_technician_acknowledgement(): void
    {
        [$dispatcher, $technician, $order] = $this->workspace();
        Sanctum::actingAs($dispatcher, ['office']);

        $visitId = $this->postJson("/api/v1/service-orders/{$order->id}/assign", [
            'technician_id' => $technician->id,
            'planned_start_at' => '2026-07-20T08:00:00+02:00',
            'planned_end_at' => '2026-07-20T09:00:00+02:00',
        ])
            ->assertCreated()
            ->json('data.id');
        $assignment = Message::query()->where('recipient_id', $technician->id)->firstOrFail();
        $this->assertTrue($assignment->requires_ack);
        $this->assertSame('visit_assigned', $assignment->metadata['event']);

        Sanctum::actingAs($technician, ['technician']);
        $this->getJson('/api/v1/technician/messages?unread=1')
            ->assertOk()
            ->assertJsonPath('meta.unread', 1)
            ->assertJsonPath('data.0.service_order.id', $order->id);
        $this->postJson("/api/v1/technician/messages/{$assignment->id}/acknowledge")
            ->assertOk()
            ->assertJsonPath('data.acknowledged_by.id', $technician->id);

        Sanctum::actingAs($dispatcher, ['office']);
        $visit = Visit::query()->findOrFail($visitId);
        $this->patchJson("/api/v1/dispatch/visits/{$visit->id}", [
            'technician_id' => $technician->id,
            'planned_start_at' => '2026-07-20T10:00:00+02:00',
            'planned_end_at' => '2026-07-20T11:00:00+02:00',
            'lock_version' => $visit->lock_version,
        ])->assertOk();

        $rescheduled = Message::query()
            ->where('recipient_id', $technician->id)
            ->where('subject', 'Einsatzplan geändert')
            ->firstOrFail();
        $this->assertTrue($rescheduled->requires_ack);
        $this->assertSame('visit_rescheduled', $rescheduled->metadata['event']);
        $this->assertNotSame(
            $rescheduled->metadata['previous']['planned_start_at'],
            $rescheduled->metadata['current']['planned_start_at'],
        );
    }

    public function test_part_request_and_completion_notify_the_office(): void
    {
        [$dispatcher, $technician, $order] = $this->workspace();
        $visit = Visit::query()->create([
            'organization_id' => $order->organization_id,
            'service_order_id' => $order->id,
            'technician_id' => $technician->id,
            'planned_date' => today(),
            'planned_start_at' => now(),
            'planned_end_at' => now()->addHour(),
            'status' => 'in_progress',
            'visit_number' => 1,
        ]);
        $order->update(['status' => 'in_progress']);
        Sanctum::actingAs($technician, ['technician']);

        $this->postJson("/api/v1/technician/visits/{$visit->id}/parts", [
            'description' => 'Umwälzpumpe',
            'quantity' => 1,
        ])->assertCreated();

        $this->assertDatabaseHas('messages', [
            'recipient_id' => $dispatcher->id,
            'service_order_id' => $order->id,
            'subject' => 'Teil dringend prüfen',
            'severity' => 'high',
        ]);
    }

    public function test_cancellation_is_recorded_and_sent_to_the_assigned_technician(): void
    {
        [$dispatcher, $technician, $order] = $this->workspace();
        Visit::query()->create([
            'organization_id' => $order->organization_id,
            'service_order_id' => $order->id,
            'technician_id' => $technician->id,
            'planned_date' => today(),
            'planned_start_at' => now(),
            'planned_end_at' => now()->addHour(),
            'status' => 'planned',
            'visit_number' => 1,
        ]);
        $order->update(['status' => 'planned']);
        Sanctum::actingAs($dispatcher, ['office']);

        $this->postJson("/api/v1/service-orders/{$order->id}/cancel", [
            'reason' => 'Kunde hat den Termin abgesagt.',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        $this->assertDatabaseHas('messages', [
            'recipient_id' => $technician->id,
            'service_order_id' => $order->id,
            'subject' => 'Einsatz storniert',
            'severity' => 'urgent',
            'requires_ack' => true,
        ]);
        $this->assertDatabaseHas('status_history', [
            'subject_id' => $order->id,
            'to_status' => 'cancelled',
            'reason' => 'Kunde hat den Termin abgesagt.',
        ]);
    }

    public function test_message_attachment_is_available_only_to_conversation_participants(): void
    {
        Storage::fake('local');
        [$dispatcher, $technician, $order] = $this->workspace();
        Sanctum::actingAs($dispatcher, ['office']);
        $messageId = $this->postJson('/api/v1/messages', [
            'recipient_id' => $technician->id,
            'service_order_id' => $order->id,
            'subject' => 'Schadensfoto',
            'body' => 'Bitte vor dem Einsatz prüfen.',
        ])->assertCreated()->json('data.id');
        $attachmentId = $this->post(
            "/api/v1/messages/{$messageId}/attachments",
            ['file' => UploadedFile::fake()->create('hinweis.txt', 10, 'text/plain')],
        )->assertCreated()->json('data.id');

        Sanctum::actingAs($technician, ['technician']);
        $this->get(
            "/api/v1/technician/messages/{$messageId}/attachments/{$attachmentId}",
        )->assertOk();
        $this->assertDatabaseHas('message_attachments', [
            'message_id' => $messageId,
            'original_name' => 'hinweis.txt',
        ]);
    }

    /**
     * @return array{User, User, ServiceOrder}
     */
    private function workspace(): array
    {
        $organization = Organization::query()->create([
            'name' => 'EinsatzWerk',
            'slug' => 'einsatzwerk',
        ]);
        $dispatcher = User::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Sabine Becker',
            'email' => 'office@example.test',
            'role_code' => 'dispatcher',
            'status' => 'active',
            'password' => 'secret-password',
        ]);
        $technician = User::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Thomas Becker',
            'email' => 'technician@example.test',
            'role_code' => 'technician',
            'status' => 'active',
            'password' => 'secret-password',
        ]);
        $customer = Customer::query()->create([
            'organization_id' => $organization->id,
            'customer_number' => 'K-10041',
            'first_name' => 'Peter',
            'last_name' => 'Müller',
            'primary_phone' => '03332 123456',
        ]);
        $location = ServiceLocation::query()->create([
            'organization_id' => $organization->id,
            'customer_id' => $customer->id,
            'street' => 'Friedrichstraße',
            'house_number' => '12',
            'postal_code' => '16303',
            'city' => 'Schwedt/Oder',
            'is_primary' => true,
        ]);
        $order = ServiceOrder::query()->create([
            'organization_id' => $organization->id,
            'order_number' => 'A-20260718-001',
            'customer_id' => $customer->id,
            'service_location_id' => $location->id,
            'priority' => 'high',
            'fault_category' => 'Heizung',
            'fault_description' => 'Heizung wird nicht warm.',
            'status' => 'awaiting_scheduling',
            'created_by' => $dispatcher->id,
        ]);

        return [$dispatcher, $technician, $order];
    }
}
