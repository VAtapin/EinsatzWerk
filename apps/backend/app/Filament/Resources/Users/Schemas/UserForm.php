<?php

namespace App\Filament\Resources\Users\Schemas;

use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class UserForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('organization_id')
                    ->label('Betrieb')
                    ->relationship('organization', 'name')
                    ->searchable()
                    ->preload()
                    ->nullable(),
                TextInput::make('name')
                    ->label('Name')
                    ->required()
                    ->maxLength(255),
                TextInput::make('email')
                    ->label('E-Mail')
                    ->email()
                    ->required()
                    ->maxLength(255),
                TextInput::make('phone')
                    ->label('Telefon')
                    ->tel()
                    ->maxLength(255),
                Select::make('role_code')
                    ->label('Rolle')
                    ->options([
                        'superadmin' => 'Superadmin',
                        'office_admin' => 'Office Admin',
                        'dispatcher' => 'Disposition',
                        'technician' => 'Techniker',
                    ])
                    ->required(),
                Select::make('status')
                    ->label('Status')
                    ->options([
                        'active' => 'Aktiv',
                        'inactive' => 'Inaktiv',
                        'suspended' => 'Gesperrt',
                    ])
                    ->required()
                    ->default('active'),
                TextInput::make('password')
                    ->label('Passwort')
                    ->password()
                    ->revealable()
                    ->minLength(12)
                    ->required(fn (string $operation): bool => $operation === 'create')
                    ->dehydrated(fn (?string $state): bool => filled($state))
                    ->helperText('Beim Bearbeiten leer lassen, um das Passwort nicht zu ändern.'),
            ]);
    }
}
