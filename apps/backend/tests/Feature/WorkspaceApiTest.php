<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\ServiceLocation;
use App\Models\ServiceOrder;
use App\Models\ServiceOrderItem;
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

    public function test_legacy_order_items_are_searchable_and_expose_derived_devices(): void
    {
        [$organization, $dispatcher, , $customer, $location] = $this->workspace();
        $order = ServiceOrder::query()->create([
            'organization_id' => $organization->id,
            'order_number' => 'L3821',
            'legacy_order_number' => 'L3821',
            'customer_id' => $customer->id,
            'service_location_id' => $location->id,
            'source' => 'legacy',
            'status' => 'completed',
            'priority' => 'normal',
            'fault_description' => 'Historischer Auftrag',
            'closed_at' => '2017-04-28 00:00:00',
        ]);
        $item = ServiceOrderItem::query()->create([
            'organization_id' => $organization->id,
            'service_order_id' => $order->id,
            'customer_id' => $customer->id,
            'source_row' => 2,
            'legacy_number' => 'L3821',
            'article_number' => '99041',
            'code' => 'EK 45546',
            'line_date' => '2017-04-28',
            'description' => 'PKM KG 220.4 A++',
            'additional_text' => 'Kühl-Gefrierkombination',
            'quantity' => 1,
            'gross_unit_price' => 499,
            'legacy_customer_number' => 'K-10041',
            'classification' => 'device',
            'classification_confidence' => 'high',
            'classification_reason' => 'Geräteart erkannt',
            'device_type' => 'refrigeration',
            'legacy_data' => [
                'Nummer' => 'L3821',
                'Kundennummer' => 'K-10041',
                'Zusatztext' => 'Kühl-Gefrierkombination',
            ],
        ]);
        $asset = Asset::query()->create([
            'organization_id' => $organization->id,
            'customer_id' => $customer->id,
            'service_location_id' => $location->id,
            'source_order_item_id' => $item->id,
            'model' => 'PKM KG 220.4 A++',
            'purchase_date' => '2017-04-28',
            'status' => 'active',
        ]);

        Sanctum::actingAs($dispatcher, ['office']);

        $this->getJson('/api/v1/service-orders?q=Kühl-Gefrierkombination')
            ->assertOk()
            ->assertJsonPath('data.0.id', $order->id)
            ->assertJsonPath('data.0.items_count', 1);
        $this->getJson("/api/v1/service-orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('data.items.0.id', $item->id)
            ->assertJsonPath('data.items.0.assets.0.id', $asset->id);
        $this->getJson('/api/v1/assets?q=L3821')
            ->assertOk()
            ->assertJsonPath('data.0.id', $asset->id)
            ->assertJsonPath(
                'data.0.source_order_item.service_order.order_number',
                'L3821',
            );
        $this->getJson('/api/v1/documents')
            ->assertOk()
            ->assertJsonPath('data.customer', [])
            ->assertJsonPath('data.service', []);
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
