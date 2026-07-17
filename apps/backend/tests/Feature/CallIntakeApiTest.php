<?php

namespace Tests\Feature;

use App\Models\Asset;
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
        $asset = $visible->assets()->create([
            'organization_id' => $organization->id,
            'service_location_id' => $visible->serviceLocations()->firstOrFail()->id,
            'model' => 'ecoTEC plus',
            'serial_number' => '21087465123',
            'status' => 'active',
        ]);
        $this->customer($otherOrganization->id, 'K-90001', 'Müller', '030 999999');

        $response = $this
            ->withHeader('X-Organization-ID', $organization->id)
            ->getJson('/api/v1/customers/search?q=Müller');

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visible->id)
            ->assertJsonPath('data.0.primary_phone', '03332 123456')
            ->assertJsonPath('data.0.secondary_phone', null)
            ->assertJsonPath('data.0.email', null)
            ->assertJsonPath('data.0.assets.0.id', $asset->id)
            ->assertJsonPath('data.0.assets.0.serial_number', '21087465123');
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
        $asset = $customer->assets()->create([
            'organization_id' => $organization->id,
            'service_location_id' => $location->id,
            'model' => 'ecoTEC plus',
            'serial_number' => '21087465123',
            'status' => 'active',
        ]);

        $response = $this
            ->withHeader('X-Organization-ID', $organization->id)
            ->postJson('/api/v1/service-orders', [
                'customer_id' => $customer->id,
                'service_location_id' => $location->id,
                'asset_id' => $asset->id,
                'priority' => 'high',
                'fault_description' => 'Heizung wird nicht warm.',
                'customer_message' => 'Bitte vor Anfahrt anrufen.',
                'dispatcher_notes' => 'Zugang über den Hof.',
                'appointment' => [
                    'starts_at' => '2026-07-20T08:00:00+02:00',
                    'ends_at' => '2026-07-20T10:00:00+02:00',
                    'is_hard' => true,
                ],
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.customer_id', $customer->id)
            ->assertJsonPath('data.asset_id', $asset->id)
            ->assertJsonPath('data.status', 'awaiting_scheduling');

        $this->assertDatabaseHas('service_orders', [
            'organization_id' => $organization->id,
            'customer_id' => $customer->id,
            'asset_id' => $asset->id,
            'priority' => 'high',
            'source' => 'phone',
            'customer_message' => 'Bitte vor Anfahrt anrufen.',
            'dispatcher_notes' => 'Zugang über den Hof.',
        ]);
        $this->assertDatabaseHas('appointment_constraints', [
            'organization_id' => $organization->id,
            'service_order_id' => $response->json('data.id'),
            'type' => 'availability_window',
            'is_hard' => true,
        ]);
    }

    public function test_dispatcher_can_create_a_customer_without_phone_normalization(): void
    {
        $organization = Organization::query()->create(['name' => 'EinsatzWerk Demo']);
        $this->signIn($organization);

        $response = $this->postJson('/api/v1/customers', [
            'first_name' => 'Petra',
            'last_name' => 'Neumann',
            'primary_phone' => '55176',
            'email' => 'petra@example.test',
            'street' => 'Am Markt',
            'house_number' => '3',
            'postal_code' => '16303',
            'city' => 'Schwedt/Oder',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.display_name', 'Petra Neumann')
            ->assertJsonPath('data.primary_phone', '55176')
            ->assertJsonPath('data.location.postal_code', '16303');
        $this->assertMatchesRegularExpression(
            '/^K-\d{8}-001$/',
            $response->json('data.customer_number'),
        );
        $this->assertDatabaseHas('customers', [
            'organization_id' => $organization->id,
            'primary_phone' => '55176',
        ]);
        $this->assertDatabaseHas('service_locations', [
            'customer_id' => $response->json('data.id'),
            'postal_code' => '16303',
            'is_primary' => true,
        ]);
    }

    public function test_dispatcher_can_add_an_asset_to_the_selected_customer(): void
    {
        $organization = Organization::query()->create(['name' => 'EinsatzWerk Demo']);
        $this->signIn($organization);
        $customer = $this->customer($organization->id, 'K-10041', 'Müller', '55176');

        $response = $this->postJson("/api/v1/customers/{$customer->id}/assets", [
            'model' => 'ecoTEC plus',
            'serial_number' => '21087465123',
            'production_number' => 'FD-2026',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.customer_id', $customer->id)
            ->assertJsonPath('data.serial_number', '21087465123')
            ->assertJsonPath('data.status', 'active');
        $this->assertDatabaseHas('assets', [
            'organization_id' => $organization->id,
            'customer_id' => $customer->id,
            'service_location_id' => $customer->serviceLocations()->firstOrFail()->id,
            'serial_number' => '21087465123',
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

    public function test_asset_from_another_customer_cannot_be_used_for_an_order(): void
    {
        $organization = Organization::query()->create(['name' => 'EinsatzWerk Demo']);
        $this->signIn($organization);
        $customer = $this->customer($organization->id, 'K-10041', 'Müller', '03332 123456');
        $otherCustomer = $this->customer($organization->id, 'K-10042', 'Schmidt', '03332 987654');
        $foreignAsset = Asset::query()->create([
            'organization_id' => $organization->id,
            'customer_id' => $otherCustomer->id,
            'service_location_id' => $otherCustomer->serviceLocations()->firstOrFail()->id,
            'model' => 'Fremdes Gerät',
            'serial_number' => 'RAW-0001',
            'status' => 'active',
        ]);

        $response = $this
            ->withHeader('X-Organization-ID', $organization->id)
            ->postJson('/api/v1/service-orders', [
                'customer_id' => $customer->id,
                'service_location_id' => $customer->serviceLocations()->firstOrFail()->id,
                'asset_id' => $foreignAsset->id,
                'priority' => 'normal',
                'fault_description' => 'Test',
            ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('asset_id');
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
