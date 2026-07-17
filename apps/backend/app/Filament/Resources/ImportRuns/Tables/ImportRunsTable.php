<?php

namespace App\Filament\Resources\ImportRuns\Tables;

use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class ImportRunsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('organization.name')
                    ->label('Betrieb')
                    ->searchable(),
                TextColumn::make('source_name')
                    ->label('Quelle')
                    ->searchable(),
                TextColumn::make('source_type')
                    ->label('Typ')
                    ->badge(),
                TextColumn::make('status')
                    ->label('Status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'completed' => 'success',
                        'completed_with_errors' => 'warning',
                        'running' => 'info',
                        'failed' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('processed_rows')
                    ->label('Verarbeitet')
                    ->numeric()
                    ->sortable(),
                TextColumn::make('created_rows')
                    ->label('Neu')
                    ->numeric(),
                TextColumn::make('updated_rows')
                    ->label('Aktualisiert')
                    ->numeric(),
                TextColumn::make('warning_rows')
                    ->label('Warnungen')
                    ->numeric()
                    ->color('warning'),
                TextColumn::make('error_rows')
                    ->label('Fehler')
                    ->numeric()
                    ->color('danger'),
                TextColumn::make('finished_at')
                    ->label('Abgeschlossen')
                    ->dateTime('d.m.Y H:i')
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('organization_id')
                    ->label('Betrieb')
                    ->relationship('organization', 'name')
                    ->searchable()
                    ->preload(),
                SelectFilter::make('status')
                    ->options([
                        'running' => 'Läuft',
                        'completed' => 'Abgeschlossen',
                        'completed_with_errors' => 'Mit Fehlern',
                        'failed' => 'Fehlgeschlagen',
                    ]),
            ])
            ->defaultSort('created_at', 'desc');
    }
}
