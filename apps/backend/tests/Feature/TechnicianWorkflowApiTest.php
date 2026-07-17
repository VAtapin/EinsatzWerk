<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Organization;
use App\Models\Product;
use App\Models\ServiceLocation;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TechnicianWorkflowApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_technician_can_run_the_assigned_visit_from_start_to_completion(): void
    {
        Storage::fake('local');
        [$organization, $technician, $visit] = $this->assignedVisit();
        Sanctum::actingAs($technician, ['technician']);

        $this->getJson('/api/v1/technician/today')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visit->id)
            ->assertJsonPath('data.0.customer.name', 'Peter Müller');

        $this->postJson("/api/v1/technician/visits/{$visit->id}/start")
            ->assertOk()
            ->assertJsonPath('data.status', 'in_progress');

        $product = Product::query()->create([
            'organization_id' => $organization->id,
            'article_number' => '0020107723',
            'name' => 'Umwälzpumpe',
            'type' => 'part',
            'price' => 189,
        ]);

        $this->postJson("/api/v1/technician/visits/{$visit->id}/parts", [
            'product_id' => $product->id,
            'description' => 'Umwälzpumpe',
            'quantity' => 1,
        ])->assertCreated();
        $this->postJson("/api/v1/technician/visits/{$visit->id}/used-parts", [
            'product_id' => $product->id,
            'description' => 'Umwälzpumpe',
            'quantity' => 1,
            'unit_price' => 189,
        ])->assertCreated();
        $this->post("/api/v1/technician/visits/{$visit->id}/photos", [
            'photo' => UploadedFile::fake()->create('anlage.jpg', 100, 'image/jpeg'),
        ], ['Accept' => 'application/json'])->assertCreated();
        $this->postJson("/api/v1/technician/visits/{$visit->id}/signature", [
            'data_url' => 'data:image/png;base64,'.base64_encode('test-signature'),
            'signer_name' => 'Peter Müller',
        ])->assertCreated();

        $this->postJson("/api/v1/technician/visits/{$visit->id}/complete", [
            'diagnosis' => 'Umwälzpumpe defekt.',
            'work_performed' => 'Pumpe erneuert und Anlage geprüft.',
            'result' => 'fixed',
            'follow_up_required' => false,
            'technician_notes' => 'Kunde informiert.',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->assertDatabaseHas('service_orders', [
            'id' => $visit->service_order_id,
            'status' => 'completed',
        ]);
        $this->assertDatabaseHas('part_requirements', [
            'visit_id' => $visit->id,
            'product_id' => $product->id,
            'status' => 'requested',
        ]);
        $this->assertDatabaseHas('visit_parts', [
            'visit_id' => $visit->id,
            'description' => 'Umwälzpumpe',
        ]);
        $this->assertDatabaseHas('visit_documents', [
            'visit_id' => $visit->id,
            'type' => 'service_report',
            'mime_type' => 'application/pdf',
        ]);
        $this->assertDatabaseCount('status_history', 2);
    }

    public function test_technician_cannot_open_a_visit_assigned_to_someone_else(): void
    {
        [$organization, , $visit] = $this->assignedVisit();
        $otherTechnician = User::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Other Technician',
            'email' => 'other@example.test',
            'role_code' => 'technician',
            'password' => 'secret',
        ]);
        Sanctum::actingAs($otherTechnician, ['technician']);

        $this->getJson("/api/v1/technician/visits/{$visit->id}")->assertNotFound();
    }

    /**
     * @return array{Organization, User, Visit}
     */
    private function assignedVisit(): array
    {
        $organization = Organization::query()->create(['name' => 'EinsatzWerk Demo']);
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
            'last_name' => 'Müller',
            'first_name' => 'Peter',
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
            'status' => 'planned',
            'fault_description' => 'Heizung wird nicht warm.',
        ]);
        $visit = Visit::query()->create([
            'organization_id' => $organization->id,
            'service_order_id' => $order->id,
            'technician_id' => $technician->id,
            'planned_date' => today(),
            'planned_start_at' => now()->setTime(10, 30),
            'planned_end_at' => now()->setTime(11, 30),
            'status' => 'planned',
        ]);

        return [$organization, $technician, $visit];
    }
}
