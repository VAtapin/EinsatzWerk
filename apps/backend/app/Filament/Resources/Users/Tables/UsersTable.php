<?php

namespace App\Filament\Resources\Users\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class UsersTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name')
                    ->label('Name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('email')
                    ->label('E-Mail')
                    ->searchable()
                    ->copyable(),
                TextColumn::make('organization.name')
                    ->label('Betrieb')
                    ->placeholder('System'),
                TextColumn::make('role_code')
                    ->label('Rolle')
                    ->badge(),
                TextColumn::make('status')
                    ->label('Status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'success',
                        'suspended' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('last_login_at')
                    ->label('Letzter Login')
                    ->dateTime('d.m.Y H:i')
                    ->placeholder('Noch nie')
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('organization_id')
                    ->label('Betrieb')
                    ->relationship('organization', 'name')
                    ->searchable()
                    ->preload(),
                SelectFilter::make('role_code')
                    ->label('Rolle')
                    ->options([
                        'superadmin' => 'Superadmin',
                        'office_admin' => 'Office Admin',
                        'dispatcher' => 'Disposition',
                        'technician' => 'Techniker',
                    ]),
                SelectFilter::make('status')
                    ->options([
                        'active' => 'Aktiv',
                        'inactive' => 'Inaktiv',
                        'suspended' => 'Gesperrt',
                    ]),
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
