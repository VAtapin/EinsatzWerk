<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Organization;
use App\Models\ServiceLocation;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkspaceApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_office_workspace_endpoints_are_tenant_scoped_and_writable(): void
    {
        [$organization, $dispatcher, $technician, $customer] = $this->workspace();
        Sanctum::actingAs($dispatcher, ['office']);

        $this->getJson('/api/v1/office/analytics')
            ->assertOk()
            ->assertJsonPath('data.summary.customers', 1)
            ->assertJsonPath('data.summary.technicians', 1);
        $this->getJson('/api/v1/technicians/workspace')
            ->assertOk()
            ->assertJsonPath('data.0.id', $technician->id);
        $this->patchJson('/api/v1/settings', [
            'name' => 'EinsatzWerk Betrieb',
            'legal_name' => 'EinsatzWerk GmbH',
            'timezone' => 'Europe/Berlin',
            'locale' => 'de',
            'currency' => 'EUR',
            'settings' => [],
        ])->assertOk()->assertJsonPath('data.name', 'EinsatzWerk Betrieb');
        $areaId = $this->postJson('/api/v1/service-areas', [
            'code' => 'NORD',
            'name' => 'Nord',
            'color' => '#ff5a0a',
            'active' => true,
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/v1/service-areas/{$areaId}/postal-codes", [
            'postal_code' => '16303',
            'city' => 'Schwedt/Oder',
        ])->assertCreated();
        $this->getJson('/api/v1/service-areas')
            ->assertOk()
            ->assertJsonPath('data.0.postal_codes.0.postal_code', '16303');
        $this->patchJson("/api/v1/customers/{$customer->id}", [
            'first_name' => 'Peter',
            'last_name' => 'Müller',
            'company_name' => null,
            'primary_phone' => '55176',
            'secondary_phone' => null,
            'email' => 'peter@example.test',
            'notes' => 'Hinterhof',
            'status' => 'active',
        ])->assertOk()->assertJsonPath('data.email', 'peter@example.test');
        $this->postJson('/api/v1/messages', [
            'recipient_id' => $technician->id,
            'subject' => 'Neue Tour',
            'body' => 'Bitte Tour prüfen.',
        ])->assertCreated();
        $this->assertDatabaseHas('messages', [
            'organization_id' => $organization->id,
            'recipient_id' => $technician->id,
        ]);
    }

    public function test_technician_can_use_extended_workspace_and_create_emergency_visit(): void
    {
        [, , $technician, $customer, $location] = $this->workspace();
        $order = ServiceOrder::query()->create([
            'organization_id' => $technician->organization_id,
            'order_number' => 'A-LEGACY-001',
            'customer_id' => $customer->id,
            'service_location_id' => $location->id,
            'priority' => 'normal',
            'fault_category' => 'Wartung',
            'fault_description' => 'Wartung',
            'status' => 'planned',
        ]);
        Visit::query()->create([
            'organization_id' => $technician->organization_id,
            'service_order_id' => $order->id,
            'technician_id' => $technician->id,
            'planned_date' => today(),
            'planned_start_at' => now(),
            'planned_end_at' => now()->addHour(),
            'status' => 'planned',
            'visit_number' => 1,
        ]);
        Sanctum::actingAs($technician, ['technician']);

        $this->getJson('/api/v1/technician/visits')
            ->assertOk()
            ->assertJsonPath('data.0.order.id', $order->id);
        $this->getJson('/api/v1/technician/customers')
            ->assertOk()
            ->assertJsonPath('data.0.id', $customer->id);
        $this->postJson('/api/v1/technician/emergency-visits', [
            'customer_id' => $customer->id,
            'service_location_id' => $location->id,
            'asset_id' => null,
            'fault_category' => 'Sonstiges',
            'fault_description' => 'Zusätzlicher Defekt vor Ort.',
            'priority' => 'high',
        ])->assertCreated()->assertJsonPath('data.order.priority', 'high');
        $this->patchJson('/api/v1/technician/profile', [
            'name' => 'Max Mustermann',
            'phone' => '0170 123456',
            'locale' => 'de',
            'password' => null,
        ])->assertOk()->assertJsonPath('data.phone', '0170 123456');
    }

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
            'password' => 'secret-password',
        ]);
        $technician = User::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Max Mustermann',
            'email' => 'technik@example.test',
            'role_code' => 'technician',
            'password' => 'secret-password',
        ]);
        $customer = Customer::query()->create([
            'organization_id' => $organization->id,
            'customer_number' => 'K-10041',
            'first_name' => 'Peter',
            'last_name' => 'Müller',
            'primary_phone' => '55176',
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

        return [$organization, $dispatcher, $technician, $customer, $location];
    }
}
