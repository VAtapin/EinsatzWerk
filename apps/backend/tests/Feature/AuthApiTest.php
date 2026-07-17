<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_dispatcher_login_returns_the_call_intake_as_landing_page(): void
    {
        $organization = Organization::query()->create([
            'name' => 'EinsatzWerk Demo',
            'slug' => 'einsatzwerk-demo',
        ]);
        User::query()->create([
            'organization_id' => $organization->id,
            'name' => 'Sabine Becker',
            'email' => 'sabine@example.test',
            'role_code' => 'dispatcher',
            'password' => 'secret',
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'organization' => 'einsatzwerk-demo',
            'email' => 'sabine@example.test',
            'password' => 'secret',
            'device_name' => 'Office Test',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('user.landing_path', '/office/call-intake')
            ->assertJsonStructure(['token', 'user' => ['id', 'role', 'landing_path']]);
    }

    public function test_customer_api_rejects_anonymous_requests(): void
    {
        $this->getJson('/api/v1/customers/search?q=Müller')->assertUnauthorized();
    }
}
