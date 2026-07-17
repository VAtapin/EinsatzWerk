<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Organization;
use App\Models\ServiceLocation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CallIntakeApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_search_is_scoped_to_the_selected_organization(): void
    {
        $organization = Organization::query()->create(['name' => 'EinsatzWerk Demo']);
        $otherOrganization = Organization::query()->create([
            'name' => 'Other Tenant',
            'slug' => 'other',
        ]);
        $this->signIn($organization);

        $visible = $this->customer($organization->id, 'K-10041', 'Müller', '03332 123456');
        $this->customer($otherOrganization->id, 'K-90001', 'Müller', '030 999999');

        $response = $this
            ->withHeader('X-Organization-ID', $organization->id)
            ->getJson('/api/v1/customers/search?q=Müller');

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visible->id)
            ->assertJsonPath('data.0.primary_phone', '03332 123456');
    }

    public function test_dispatcher_can_create_an_order_with_an_appointment_window(): void
    {
        $organization = Organization::query()->create(['name' => 'EinsatzWerk Demo']);
        $this->signIn($organization);
        $customer = $this->customer(
            $organization->id,
            'K-10041',
            'Müller',
            '03332 123456',
        );
        $location = $customer->serviceLocations()->firstOrFail();

        $response = $this
            ->withHeader('X-Organization-ID', $organization->id)
            ->postJson('/api/v1/service-orders', [
                'customer_id' => $customer->id,
                'service_location_id' => $location->id,
                'priority' => 'high',
                'fault_description' => 'Heizung wird nicht warm.',
                'appointment' => [
                    'starts_at' => '2026-07-20T08:00:00+02:00',
                    'ends_at' => '2026-07-20T10:00:00+02:00',
                    'is_hard' => true,
                ],
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.customer_id', $customer->id)
            ->assertJsonPath('data.status', 'awaiting_scheduling');

        $this->assertDatabaseHas('service_orders', [
            'organization_id' => $organization->id,
            'customer_id' => $customer->id,
            'priority' => 'high',
            'source' => 'phone',
        ]);
        $this->assertDatabaseHas('appointment_constraints', [
            'organization_id' => $organization->id,
            'service_order_id' => $response->json('data.id'),
            'type' => 'availability_window',
            'is_hard' => true,
        ]);
    }

    public function test_location_from_another_customer_cannot_be_used_for_an_order(): void
    {
        $organization = Organization::query()->create(['name' => 'EinsatzWerk Demo']);
        $this->signIn($organization);
        $customer = $this->customer($organization->id, 'K-10041', 'Müller', '03332 123456');
        $otherCustomer = $this->customer($organization->id, 'K-10042', 'Schmidt', '03332 987654');

        $response = $this
            ->withHeader('X-Organization-ID', $organization->id)
            ->postJson('/api/v1/service-orders', [
                'customer_id' => $customer->id,
                'service_location_id' => $otherCustomer->serviceLocations()->firstOrFail()->id,
                'priority' => 'normal',
                'fault_description' => 'Test',
            ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('service_location_id');
    }

    public function test_order_numbers_use_a_transactional_daily_sequence(): void
    {
        $organization = Organization::query()->create(['name' => 'EinsatzWerk Demo']);
        $this->signIn($organization);
        $customer = $this->customer($organization->id, 'K-10041', 'Müller', '55176');
        $location = $customer->serviceLocations()->firstOrFail();
        $numbers = [];

        foreach (range(1, 2) as $unused) {
            $numbers[] = $this
                ->withHeader('X-Organization-ID', $organization->id)
                ->postJson('/api/v1/service-orders', [
                    'customer_id' => $customer->id,
                    'service_location_id' => $location->id,
                    'priority' => 'normal',
                    'fault_description' => 'Test',
                ])
                ->assertCreated()
                ->json('data.order_number');
        }

        $this->assertStringEndsWith('-001', $numbers[0]);
        $this->assertStringEndsWith('-002', $numbers[1]);
        $this->assertDatabaseHas('order_number_sequences', [
            'organization_id' => $organization->id,
            'current_value' => 2,
        ]);
    }

    private function customer(
        string $organizationId,
        string $number,
        string $lastName,
        string $phone,
    ): Customer {
        $customer = Customer::query()->create([
            'organization_id' => $organizationId,
            'customer_number' => $number,
            'legacy_customer_number' => $number,
            'first_name' => 'Peter',
            'last_name' => $lastName,
            'primary_phone' => $phone,
        ]);

        ServiceLocation::query()->create([
            'organization_id' => $organizationId,
            'customer_id' => $customer->id,
            'street' => 'Friedrichstraße 12',
            'postal_code' => '16303',
            'city' => 'Schwedt/Oder',
            'is_primary' => true,
        ]);

        return $customer->refresh();
    }

    private function signIn(Organization $organization): void
    {
        if (! $organization->slug) {
            $organization->update(['slug' => 'einsatzwerk-demo']);
        }

        $user = User::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Sabine Becker',
            'email' => 'sabine@example.test',
            'role_code' => 'dispatcher',
            'password' => 'secret',
        ]);

        Sanctum::actingAs($user, ['office']);
    }
}
