<?php

namespace App\Console\Commands;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class BootstrapEinsatzWerk extends Command
{
    protected $signature = 'einsatzwerk:bootstrap
        {--organization-name=EinsatzWerk : Organization display name}
        {--organization-slug=einsatzwerk : Organization login code}
        {--name=Sabine Becker : Initial office user name}
        {--email= : Initial office user email}
        {--role=office_admin : office_admin, dispatcher, technician, or superadmin}';

    protected $description = 'Create or update the initial organization and user';

    public function handle(): int
    {
        $email = mb_strtolower(trim((string) ($this->option('email') ?: '')));
        $password = (string) env('EINSATZWERK_BOOTSTRAP_PASSWORD', '');
        $role = (string) $this->option('role');

        if (! in_array($role, ['office_admin', 'dispatcher', 'technician', 'superadmin'], true)) {
            $this->error('Unsupported role.');

            return self::FAILURE;
        }

        if ($email === '') {
            $email = mb_strtolower(trim((string) $this->ask('E-Mail')));
        }

        if ($password === '') {
            $password = (string) $this->secret('Initial password');
        }

        if (! filter_var($email, FILTER_VALIDATE_EMAIL) || Str::length($password) < 12) {
            $this->error('A valid email and a password of at least 12 characters are required.');

            return self::FAILURE;
        }

        $organization = $role === 'superadmin'
            ? null
            : Organization::query()->updateOrCreate(
                ['slug' => (string) $this->option('organization-slug')],
                [
                    'name' => (string) $this->option('organization-name'),
                    'status' => 'active',
                ],
            );

        $user = User::query()->updateOrCreate(
            [
                'organization_id' => $organization?->id,
                'email' => $email,
            ],
            [
                'name' => (string) $this->option('name'),
                'role_code' => $role,
                'status' => 'active',
                'password' => $password,
            ],
        );

        $user->tokens()->delete();

        $this->info(sprintf(
            'User %s prepared%s.',
            $user->email,
            $organization ? " for {$organization->slug}" : ' for Filament superadmin',
        ));

        return self::SUCCESS;
    }
}
