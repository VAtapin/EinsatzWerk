<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SuperadminPanelTest extends TestCase
{
    use RefreshDatabase;

    public function test_superadmin_opens_organization_management_without_a_dashboard(): void
    {
        Organization::query()->create(['name' => 'EinsatzWerk Pilot']);
        $superadmin = User::query()->create([
            'name' => 'System Admin',
            'email' => 'admin@example.test',
            'role_code' => 'superadmin',
            'password' => 'secret-password',
        ]);

        $this->actingAs($superadmin->refresh())
            ->get('/superadmin/organizations')
            ->assertOk()
            ->assertSee('Betriebe');

        $this->assertFalse(
            collect(app('router')->getRoutes())
                ->contains(fn ($route): bool => $route->getName() === 'filament.superadmin.pages.dashboard'),
        );
    }
}
