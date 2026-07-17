<?php

namespace App\Filament\Resources\Organizations\Schemas;

use Filament\Forms\Components\KeyValue;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class OrganizationForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name')
                    ->label('Name')
                    ->required()
                    ->maxLength(255),
                TextInput::make('slug')
                    ->label('Login-Code')
                    ->required()
                    ->alphaDash()
                    ->unique(ignoreRecord: true)
                    ->maxLength(80),
                TextInput::make('legal_name')
                    ->label('Rechtlicher Name')
                    ->maxLength(255),
                Select::make('status')
                    ->label('Status')
                    ->options([
                        'active' => 'Aktiv',
                        'suspended' => 'Gesperrt',
                        'inactive' => 'Inaktiv',
                    ])
                    ->required()
                    ->default('active'),
                Select::make('locale')
                    ->label('Sprache')
                    ->options(['de' => 'Deutsch', 'en' => 'English'])
                    ->required()
                    ->default('de'),
                TextInput::make('timezone')
                    ->label('Zeitzone')
                    ->required()
                    ->default('Europe/Berlin'),
                TextInput::make('currency')
                    ->label('Währung')
                    ->required()
                    ->maxLength(3)
                    ->default('EUR'),
                KeyValue::make('settings')
                    ->label('Erweiterte Einstellungen')
                    ->columnSpanFull(),
            ]);
    }
}
