<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Organization;
use App\Models\ServiceLocation;
use App\Models\TelephonyCall;
use App\Models\TelephonyIntegration;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TelephonyIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_3cx_lookup_and_events_open_the_matching_customer_without_changing_the_phone(): void
    {
        [$organization, $user, $customer] = $this->workspace('03332 123456');
        Sanctum::actingAs($user, ['office']);

        $integration = $this->postJson('/api/v1/telephony/integrations', [
            'provider' => '3cx',
            'name' => '3CX Zentrale',
        ])->assertCreated();
        $key = $integration->json('credentials.key');

        $this->getJson("/api/v1/telephony/3cx/{$key}/contacts?phone=%2B493332123456")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $customer->id)
            ->assertJsonPath('data.0.business_phone', '03332 123456')
            ->assertJsonPath('data.0.customer.assets', []);

        $response = $this->postJson("/api/v1/telephony/3cx/{$key}/events", [
            'call_id' => '3cx-call-1001',
            'event' => 'IncomingCall',
            'direction' => 'inbound',
            'party_caller_id' => '+49 3332 123456',
            'party_did' => '100',
            'party_caller_name' => 'Peter Müller',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.provider', '3cx')
            ->assertJsonPath('data.status', 'ringing')
            ->assertJsonPath('data.customer.id', $customer->id);
        $this->assertDatabaseHas('customers', [
            'id' => $customer->id,
            'primary_phone' => '03332 123456',
        ]);
        $this->assertDatabaseHas('telephony_calls', [
            'organization_id' => $organization->id,
            'external_call_id' => '3cx-call-1001',
            'customer_id' => $customer->id,
            'status' => 'ringing',
        ]);
    }

    public function test_placetel_callback_updates_one_call_through_its_lifecycle(): void
    {
        [, $user, $customer] = $this->workspace('030 1234567');
        Sanctum::actingAs($user, ['office']);

        $integration = $this->postJson('/api/v1/telephony/integrations', [
            'provider' => 'placetel',
            'name' => 'Placetel',
        ])->assertCreated();
        $key = $integration->json('credentials.key');

        $this->call(
            'POST',
            "/api/v1/telephony/placetel/{$key}/events",
            [
                'call_id' => 'placetel-call-2001',
                'event' => 'IncomingCall',
                'from' => '+49301234567',
                'to' => '493012340',
            ],
        )
            ->assertOk()
            ->assertJsonPath('data.status', 'ringing')
            ->assertJsonPath('data.customer.id', $customer->id);

        $hungupPayload = [
            'call_id' => 'placetel-call-2001',
            'event' => 'Hungup',
            'direction' => 'incoming',
            'from' => '+49301234567',
            'to' => '493012340',
            'duration' => 37,
            'type' => 'answered',
        ];
        $this->call(
            'POST',
            "/api/v1/telephony/placetel/{$key}/events",
            $hungupPayload,
        )
            ->assertOk()
            ->assertJsonPath('data.status', 'ended')
            ->assertJsonPath('data.duration_seconds', 37);
        $this->call(
            'POST',
            "/api/v1/telephony/placetel/{$key}/events",
            $hungupPayload,
        )->assertOk();

        $this->assertDatabaseCount('telephony_calls', 1);
        $this->assertDatabaseCount('telephony_call_events', 2);
    }

    public function test_invalid_webhook_key_is_rejected_and_calls_are_tenant_scoped(): void
    {
        [$organization, $user] = $this->workspace('03332 123456');
        [$otherOrganization] = $this->workspace(
            '030 999999',
            'other-tenant',
            'other@example.test',
        );
        Sanctum::actingAs($user, ['office']);

        $this->getJson(
            '/api/v1/telephony/3cx/'.str_repeat('x', 64).'/contacts?phone=55176',
        )->assertNotFound();

        $otherIntegration = TelephonyIntegration::query()->create([
            'organization_id' => $otherOrganization->id,
            'provider' => 'generic',
            'name' => 'Foreign PBX',
            'webhook_key_hash' => hash('sha256', 'foreign-key'),
            'enabled' => true,
        ]);
        TelephonyCall::query()->create([
            'organization_id' => $otherOrganization->id,
            'telephony_integration_id' => $otherIntegration->id,
            'provider' => 'generic',
            'external_call_id' => 'foreign-call',
            'direction' => 'incoming',
            'status' => 'ringing',
            'from_number' => '030 999999',
            'started_at' => now(),
        ]);

        $this->getJson('/api/v1/telephony/calls')
            ->assertOk()
            ->assertJsonCount(0, 'data');
        $this->assertNotEquals($organization->id, $otherOrganization->id);
    }

    /**
     * @return array{Organization, User, Customer}
     */
    private function workspace(
        string $phone,
        string $slug = 'einsatzwerk',
        string $email = 'office@example.test',
    ): array {
        $organization = Organization::query()->create([
            'name' => ucfirst($slug),
            'slug' => $slug,
        ]);
        $user = User::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Sabine Becker',
            'email' => $email,
            'role_code' => 'dispatcher',
            'password' => 'secret-password',
        ]);
        $customer = Customer::query()->create([
            'organization_id' => $organization->id,
            'customer_number' => 'K-'.$slug,
            'first_name' => 'Peter',
            'last_name' => 'Müller',
            'primary_phone' => $phone,
        ]);
        ServiceLocation::query()->create([
            'organization_id' => $organization->id,
            'customer_id' => $customer->id,
            'street' => 'Friedrichstraße',
            'house_number' => '12',
            'postal_code' => '16303',
            'city' => 'Schwedt/Oder',
            'is_primary' => true,
        ]);

        return [$organization, $user, $customer];
    }
}
