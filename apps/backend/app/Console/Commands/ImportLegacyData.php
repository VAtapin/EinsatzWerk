<?php

namespace App\Console\Commands;

use App\Models\CommercialDocument;
use App\Models\CommercialDocumentLine;
use App\Models\Customer;
use App\Models\ImportRow;
use App\Models\ImportRun;
use App\Models\LegacyTourEntry;
use App\Models\Organization;
use App\Models\ServiceArea;
use App\Models\ServiceAreaPostalCode;
use App\Models\ServiceLocation;
use App\Support\Legacy\LegacyTabFileReader;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use OpenSpout\Reader\XLSX\Reader;
use Throwable;

class ImportLegacyData extends Command
{
    protected $signature = 'legacy:import
        {directory : Directory containing Kunden.txt and lsArtikel.txt}
        {--organization= : Existing organization ULID}
        {--force : Re-run a file whose hash was already imported}';

    protected $description = 'Import the current customer legacy export without discarding source values';

    public function handle(LegacyTabFileReader $reader): int
    {
        $directory = rtrim((string) $this->argument('directory'), '/\\');
        $organization = $this->resolveOrganization();

        foreach ([
            'Kunden.txt',
            'lsArtikel.txt',
            'PLZ-Gebiet.xlsx',
            'Tourplan2017.xlsx',
        ] as $filename) {
            if (! is_file($directory.DIRECTORY_SEPARATOR.$filename)) {
                $this->error("Missing required file: {$filename}");

                return self::FAILURE;
            }
        }

        $this->info("Organization: {$organization->name} ({$organization->id})");

        $this->importFile(
            organization: $organization,
            type: 'customers',
            path: $directory.DIRECTORY_SEPARATOR.'Kunden.txt',
            importer: fn (array $data, int $row, ImportRun $run) => $this->importCustomer(
                $organization,
                $data,
                $row,
                $run,
            ),
            reader: $reader,
        );

        $this->importFile(
            organization: $organization,
            type: 'commercial_document_lines',
            path: $directory.DIRECTORY_SEPARATOR.'lsArtikel.txt',
            importer: fn (array $data, int $row, ImportRun $run) => $this->importArticleLine(
                $organization,
                $data,
                $row,
                $run,
            ),
            reader: $reader,
        );

        $this->importPostalCodes(
            $organization,
            $directory.DIRECTORY_SEPARATOR.'PLZ-Gebiet.xlsx',
        );
        $this->importTourplan(
            $organization,
            $directory.DIRECTORY_SEPARATOR.'Tourplan2017.xlsx',
        );

        $this->info('Legacy import completed.');

        return self::SUCCESS;
    }

    private function resolveOrganization(): Organization
    {
        $organizationId = $this->option('organization');

        if ($organizationId) {
            return Organization::query()->findOrFail($organizationId);
        }

        return Organization::query()->firstOrCreate(
            ['name' => 'EinsatzWerk Pilot'],
            [
                'legal_name' => 'EinsatzWerk Pilot',
                'timezone' => 'Europe/Berlin',
                'locale' => 'de',
                'currency' => 'EUR',
                'status' => 'active',
            ],
        );
    }

    /**
     * @param  callable(array<string, string>, int, ImportRun): void  $importer
     */
    private function importFile(
        Organization $organization,
        string $type,
        string $path,
        callable $importer,
        LegacyTabFileReader $reader,
    ): void {
        $hash = hash_file('sha256', $path);
        $run = ImportRun::query()->firstOrNew([
            'organization_id' => $organization->id,
            'source_type' => $type,
            'source_hash' => $hash,
        ]);

        if ($run->exists && $run->status === 'completed' && ! $this->option('force')) {
            $this->warn(sprintf(
                '%s was already imported as run %s; skipping.',
                basename($path),
                $run->id,
            ));

            return;
        }

        DB::transaction(function () use ($run, $organization, $type, $path, $hash): void {
            if ($run->exists) {
                $run->rows()->delete();
            }

            $run->fill([
                'organization_id' => $organization->id,
                'source_type' => $type,
                'source_name' => basename($path),
                'source_hash' => $hash,
                'status' => 'running',
                'total_rows' => 0,
                'processed_rows' => 0,
                'created_rows' => 0,
                'updated_rows' => 0,
                'warning_rows' => 0,
                'error_rows' => 0,
                'started_at' => now(),
                'finished_at' => null,
                'metadata' => ['path' => $path],
            ])->save();
        });

        $this->newLine();
        $this->info('Importing '.basename($path));
        $progress = $this->output->createProgressBar();
        $progress->start();

        $batch = [];
        $processBatch = function (array $sources) use (
            $importer,
            $run,
            $organization,
            $progress,
        ): void {
            DB::transaction(function () use (
                $sources,
                $importer,
                $run,
                $organization,
                $progress,
            ): void {
                foreach ($sources as $source) {
                    try {
                        $importer($source['data'], $source['row'], $run);
                    } catch (Throwable $exception) {
                        ImportRow::query()->updateOrCreate(
                            [
                                'import_run_id' => $run->id,
                                'source_row' => $source['row'],
                            ],
                            [
                                'organization_id' => $organization->id,
                                'source_key' => null,
                                'status' => 'error',
                                'raw_data' => $source['data'],
                                'error' => $exception->getMessage(),
                            ],
                        );

                        $run->error_rows++;
                    }

                    $run->processed_rows++;
                    $run->total_rows++;
                    $progress->advance();
                }
            });

            $run->save();
        };

        foreach ($reader->rows($path) as $source) {
            $batch[] = $source;

            if (count($batch) === 250) {
                $processBatch($batch);
                $batch = [];
            }
        }

        if ($batch !== []) {
            $processBatch($batch);
        }

        $progress->finish();
        $run->update([
            'status' => $run->error_rows > 0 ? 'completed_with_errors' : 'completed',
            'finished_at' => now(),
        ]);
        $this->newLine();
        $this->line(sprintf(
            'Processed %d; created %d; updated %d; warnings %d; errors %d',
            $run->processed_rows,
            $run->created_rows,
            $run->updated_rows,
            $run->warning_rows,
            $run->error_rows,
        ));
    }

    /**
     * @param  array<string, string>  $data
     */
    private function importCustomer(
        Organization $organization,
        array $data,
        int $sourceRow,
        ImportRun $run,
    ): void {
        $legacyNumber = $data['Kundennummer'];
        $warnings = [];

        if ($legacyNumber === '') {
            throw new \RuntimeException('Kundennummer is empty.');
        }

        if ($data['Name'] === '') {
            $warnings[] = 'Name is empty.';
        }

        $customer = Customer::query()->firstOrNew([
            'organization_id' => $organization->id,
            'legacy_customer_number' => $legacyNumber,
        ]);
        $created = ! $customer->exists;

        $customer->fill([
            'customer_number' => $legacyNumber,
            'customer_type' => 'person',
            'title' => $data['Anrede'] ?: null,
            'first_name' => $data['Vorname'] ?: null,
            'last_name' => $data['Name'] ?: '(ohne Name)',
            'email' => $data['Email'] ?: null,
            // Telephone values are intentionally preserved exactly as exported.
            'primary_phone' => $data['Telefon'] ?: null,
            'secondary_phone' => $data['Telefon2'] ?: ($data['Funktelefon'] ?: null),
            'notes' => $this->joinNotes($data),
            'status' => 'active',
            'legacy_data' => $data,
        ])->save();

        ServiceLocation::query()->updateOrCreate(
            [
                'organization_id' => $organization->id,
                'customer_id' => $customer->id,
                'is_primary' => true,
            ],
            [
                'type' => 'service',
                'street' => $data['Strasse'] ?: null,
                'postal_code' => $data['Plz'] ?: null,
                'city' => $data['Ort'] ?: null,
                'country' => match (strtoupper($data['Land'])) {
                    'PL' => 'PL',
                    default => 'DE',
                },
            ],
        );

        ImportRow::query()->updateOrCreate(
            [
                'import_run_id' => $run->id,
                'source_row' => $sourceRow,
            ],
            [
                'organization_id' => $organization->id,
                'source_key' => $legacyNumber,
                'status' => $warnings === [] ? ($created ? 'created' : 'updated') : 'warning',
                'entity_type' => Customer::class,
                'entity_id' => $customer->id,
                'raw_data' => $data,
                'warnings' => $warnings ?: null,
                'error' => null,
            ],
        );

        $counter = $created ? 'created_rows' : 'updated_rows';
        $run->{$counter}++;
        if ($warnings !== []) {
            $run->warning_rows++;
        }
    }

    /**
     * @param  array<string, string>  $data
     */
    private function importArticleLine(
        Organization $organization,
        array $data,
        int $sourceRow,
        ImportRun $run,
    ): void {
        $documentNumber = $data['Nummer'];
        $customerNumber = $data['Kundennummer'];
        $customer = Customer::query()
            ->where('organization_id', $organization->id)
            ->where('legacy_customer_number', $customerNumber)
            ->first();

        if ($documentNumber === '') {
            throw new \RuntimeException('Document number is empty.');
        }

        $warnings = [];
        if ($customer === null) {
            $warnings[] = 'Referenced customer was not found.';
        }

        $document = CommercialDocument::query()->updateOrCreate(
            [
                'organization_id' => $organization->id,
                'legacy_document_number' => $documentNumber,
            ],
            [
                'customer_id' => $customer?->id,
                'document_number' => $documentNumber,
                'type' => 'unclassified',
                'document_date' => $this->parseDate($data['Datum']),
                'legacy_data' => [
                    'source' => 'lsArtikel.txt',
                    'customer_number' => $customerNumber,
                ],
            ],
        );

        $lineNumber = CommercialDocumentLine::query()
            ->where('commercial_document_id', $document->id)
            ->where('legacy_data->source_row', $sourceRow)
            ->value('line_number');
        $created = $lineNumber === null;
        $lineNumber ??= CommercialDocumentLine::query()
            ->where('commercial_document_id', $document->id)
            ->max('line_number') + 1;

        $line = CommercialDocumentLine::query()->updateOrCreate(
            [
                'commercial_document_id' => $document->id,
                'line_number' => $lineNumber,
            ],
            [
                'organization_id' => $organization->id,
                'legacy_art' => $data['Art'] ?: null,
                'article_number' => $data['Artikelnummer'] ?: null,
                'code' => $data['Code'] ?: null,
                'description' => $data['Bezeichnung'] ?: null,
                'additional_text' => $data['Zusatztext'] ?: null,
                'quantity' => $this->parseDecimal($data['Anzahl']),
                'net_unit_price' => $this->parseDecimal($data['Einzelpreis']),
                'gross_unit_price' => $this->parseDecimal($data['Bruttoeinzelpreis']),
                'serial_number' => $data['Seriennummer'] ?: null,
                'classification' => 'unclassified',
                'legacy_data' => [
                    ...$data,
                    'source_row' => $sourceRow,
                ],
            ],
        );

        ImportRow::query()->updateOrCreate(
            [
                'import_run_id' => $run->id,
                'source_row' => $sourceRow,
            ],
            [
                'organization_id' => $organization->id,
                'source_key' => $documentNumber,
                'status' => $warnings === [] ? ($created ? 'created' : 'updated') : 'warning',
                'entity_type' => CommercialDocumentLine::class,
                'entity_id' => $line->id,
                'raw_data' => $data,
                'warnings' => $warnings ?: null,
                'error' => null,
            ],
        );

        $counter = $created ? 'created_rows' : 'updated_rows';
        $run->{$counter}++;
        if ($warnings !== []) {
            $run->warning_rows++;
        }
    }

    /**
     * @param  array<string, string>  $data
     */
    private function joinNotes(array $data): ?string
    {
        $notes = array_values(array_filter([
            $data['Bemerkung'] ?? null,
            $data['Bemerkung1'] ?? null,
            $data['Bemerkung2'] ?? null,
        ]));

        return $notes === [] ? null : implode(PHP_EOL, $notes);
    }

    private function parseDate(string $value): ?string
    {
        if ($value === '') {
            return null;
        }

        return CarbonImmutable::createFromFormat('d.m.Y', $value)->toDateString();
    }

    private function parseDecimal(string $value): ?string
    {
        if ($value === '') {
            return null;
        }

        return str_replace(',', '.', str_replace('.', '', $value));
    }

    private function importPostalCodes(
        Organization $organization,
        string $path,
    ): void {
        $run = $this->prepareWorkbookRun($organization, 'service_areas', $path);

        if ($run === null) {
            return;
        }

        $reader = new Reader;
        $reader->open($path);

        try {
            foreach ($reader->getSheetIterator() as $sheet) {
                $headerFound = false;

                foreach ($sheet->getRowIterator() as $sourceRow => $row) {
                    $values = $this->jsonSafeRow($row->toArray());

                    if (! $headerFound) {
                        $headerFound = ($values[0] ?? null) === 'Ort'
                            && ($values[1] ?? null) === 'PLZ';

                        continue;
                    }

                    if (($values[0] ?? '') === '' && ($values[1] ?? '') === '') {
                        continue;
                    }

                    $regionName = (string) ($values[3] ?? '');
                    $postalCode = (string) ($values[1] ?? '');

                    DB::transaction(function () use (
                        $organization,
                        $run,
                        $sheet,
                        $sourceRow,
                        $values,
                        $regionName,
                        $postalCode,
                    ): void {
                        $area = ServiceArea::query()->firstOrCreate(
                            [
                                'organization_id' => $organization->id,
                                'code' => Str::slug($regionName),
                            ],
                            [
                                'name' => $regionName,
                                'active' => true,
                            ],
                        );

                        $mapping = ServiceAreaPostalCode::query()->updateOrCreate(
                            [
                                'organization_id' => $organization->id,
                                'postal_code' => $postalCode,
                            ],
                            [
                                'service_area_id' => $area->id,
                                'city' => $values[0] ?: null,
                                'dialing_code' => isset($values[2])
                                    ? (string) $values[2]
                                    : null,
                            ],
                        );

                        ImportRow::query()->updateOrCreate(
                            [
                                'import_run_id' => $run->id,
                                'source_row' => $sourceRow,
                            ],
                            [
                                'organization_id' => $organization->id,
                                'source_key' => $postalCode,
                                'status' => $mapping->wasRecentlyCreated ? 'created' : 'updated',
                                'entity_type' => ServiceAreaPostalCode::class,
                                'entity_id' => $mapping->id,
                                'raw_data' => [
                                    'sheet' => $sheet->getName(),
                                    'cells' => $values,
                                ],
                            ],
                        );

                        $run->increment(
                            $mapping->wasRecentlyCreated ? 'created_rows' : 'updated_rows',
                        );
                        $run->increment('processed_rows');
                        $run->increment('total_rows');
                    });
                }
            }
        } finally {
            $reader->close();
        }

        $run->update(['status' => 'completed', 'finished_at' => now()]);
    }

    private function importTourplan(
        Organization $organization,
        string $path,
    ): void {
        $run = $this->prepareWorkbookRun($organization, 'tourplan', $path);

        if ($run === null) {
            return;
        }

        $reader = new Reader;
        $reader->open($path);

        try {
            foreach ($reader->getSheetIterator() as $sheet) {
                foreach ($sheet->getRowIterator() as $sourceRow => $row) {
                    $values = $this->jsonSafeRow($row->toArray());

                    if (count(array_filter($values, fn ($value) => $value !== null && $value !== '')) === 0) {
                        continue;
                    }

                    DB::transaction(function () use (
                        $organization,
                        $run,
                        $sheet,
                        $sourceRow,
                        $values,
                    ): void {
                        $entity = null;

                        if ($sheet->getName() === 'Tabelle3' && $sourceRow > 1) {
                            $entity = LegacyTourEntry::query()->updateOrCreate(
                                [
                                    'import_run_id' => $run->id,
                                    'source_sheet' => $sheet->getName(),
                                    'source_row' => $sourceRow,
                                ],
                                [
                                    'organization_id' => $organization->id,
                                    'legacy_document_number' => $this->stringValue($values[0] ?? null),
                                    'service_date' => $this->dateValue($values[1] ?? null),
                                    'appointment_sequence' => $this->stringValue($values[2] ?? null),
                                    'customer_name' => $this->stringValue($values[3] ?? null),
                                    'city' => $this->stringValue($values[4] ?? null),
                                    'result_code' => $this->stringValue($values[5] ?? null),
                                    'amount' => is_numeric($values[6] ?? null)
                                        ? $values[6]
                                        : null,
                                    'raw_data' => $values,
                                ],
                            );
                        }

                        ImportRow::query()->updateOrCreate(
                            [
                                'import_run_id' => $run->id,
                                'source_row' => $this->workbookSourceRow(
                                    $sheet->getIndex(),
                                    $sourceRow,
                                ),
                            ],
                            [
                                'organization_id' => $organization->id,
                                'source_key' => $sheet->getName().':'.$sourceRow,
                                'status' => $entity?->wasRecentlyCreated === false
                                    ? 'updated'
                                    : 'created',
                                'entity_type' => $entity ? LegacyTourEntry::class : null,
                                'entity_id' => $entity?->id,
                                'raw_data' => [
                                    'sheet' => $sheet->getName(),
                                    'source_row' => $sourceRow,
                                    'cells' => $values,
                                ],
                            ],
                        );

                        $run->increment(
                            $entity?->wasRecentlyCreated === false ? 'updated_rows' : 'created_rows',
                        );
                        $run->increment('processed_rows');
                        $run->increment('total_rows');
                    });
                }
            }
        } finally {
            $reader->close();
        }

        $run->update(['status' => 'completed', 'finished_at' => now()]);
    }

    private function prepareWorkbookRun(
        Organization $organization,
        string $type,
        string $path,
    ): ?ImportRun {
        $hash = hash_file('sha256', $path);
        $run = ImportRun::query()->firstOrNew([
            'organization_id' => $organization->id,
            'source_type' => $type,
            'source_hash' => $hash,
        ]);

        if ($run->exists && $run->status === 'completed' && ! $this->option('force')) {
            $this->warn(basename($path).' was already imported; skipping.');

            return null;
        }

        if ($run->exists) {
            $run->rows()->delete();
        }

        $run->fill([
            'organization_id' => $organization->id,
            'source_type' => $type,
            'source_name' => basename($path),
            'source_hash' => $hash,
            'status' => 'running',
            'total_rows' => 0,
            'processed_rows' => 0,
            'created_rows' => 0,
            'updated_rows' => 0,
            'warning_rows' => 0,
            'error_rows' => 0,
            'started_at' => now(),
            'finished_at' => null,
            'metadata' => ['path' => $path],
        ])->save();

        $this->info('Importing '.basename($path));

        return $run;
    }

    /**
     * @param  array<int, mixed>  $values
     * @return array<int, mixed>
     */
    private function jsonSafeRow(array $values): array
    {
        return array_map(
            fn ($value) => $value instanceof DateTimeInterface
                ? $value->format(DATE_ATOM)
                : $value,
            $values,
        );
    }

    private function dateValue(mixed $value): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        if (is_string($value) && $value !== '') {
            return CarbonImmutable::parse($value)->toDateString();
        }

        return null;
    }

    private function stringValue(mixed $value): ?string
    {
        return $value === null || $value === '' ? null : (string) $value;
    }

    private function workbookSourceRow(int $sheetIndex, int $row): int
    {
        return ($sheetIndex * 1_000_000) + $row;
    }
}
