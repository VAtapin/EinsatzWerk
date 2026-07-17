<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Organization;
use App\Models\ServiceLocation;
use App\Models\ServiceOrder;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OfficeDispatchWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_dispatcher_can_list_and_assign_an_order_to_a_technician(): void
    {
        $organization = Organization::query()->create(['name' => 'EinsatzWerk Demo']);
        $dispatcher = User::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Sabine Becker',
            'email' => 'sabine@example.test',
            'role_code' => 'dispatcher',
            'password' => 'secret',
        ]);
        $technician = User::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Thomas Becker',
            'email' => 'thomas@example.test',
            'role_code' => 'technician',
            'password' => 'secret',
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
        $order = ServiceOrder::query()->create([
            'organization_id' => $organization->id,
            'order_number' => 'A-20260717-001',
            'customer_id' => $customer->id,
            'service_location_id' => $location->id,
            'priority' => 'high',
            'status' => 'awaiting_scheduling',
            'fault_description' => 'Heizung wird nicht warm.',
        ]);
        Sanctum::actingAs($dispatcher, ['office']);

        $this->getJson('/api/v1/service-orders?q=Müller')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $order->id);

        $this->getJson('/api/v1/technicians')
            ->assertOk()
            ->assertJsonPath('data.0.id', $technician->id);

        $this->postJson("/api/v1/service-orders/{$order->id}/assign", [
            'technician_id' => $technician->id,
            'planned_start_at' => now()->addDay()->setTime(10, 30)->toIso8601String(),
            'planned_end_at' => now()->addDay()->setTime(11, 30)->toIso8601String(),
            'duration_minutes' => 60,
        ])
            ->assertCreated()
            ->assertJsonPath('data.technician_id', $technician->id)
            ->assertJsonPath('data.status', 'planned');

        $this->assertDatabaseHas('service_orders', [
            'id' => $order->id,
            'status' => 'planned',
        ]);
        $this->assertDatabaseHas('visits', [
            'service_order_id' => $order->id,
            'technician_id' => $technician->id,
            'visit_number' => 1,
        ]);
        $this->assertDatabaseHas('status_history', [
            'subject_id' => $order->id,
            'from_status' => 'awaiting_scheduling',
            'to_status' => 'planned',
        ]);
    }
}
