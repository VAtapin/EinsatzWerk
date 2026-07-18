<?php

use App\Models\ServiceOrderItem;
use App\Support\Legacy\LegacyOrderLineClassifier;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_orders', function (Blueprint $table): void {
            $table->dropUnique(['organization_id', 'order_number']);
            $table->index(
                ['organization_id', 'order_number'],
                'service_orders_organization_order_number_index',
            );
        });

        Schema::create('service_order_items', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('service_order_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('customer_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('source_row')->nullable();
            $table->string('legacy_art')->nullable();
            $table->string('legacy_number', 128);
            $table->string('article_number', 128)->nullable();
            $table->string('code', 128)->nullable();
            $table->date('line_date')->nullable();
            $table->string('description')->nullable();
            $table->text('additional_text')->nullable();
            $table->decimal('quantity', 14, 4)->nullable();
            $table->decimal('net_unit_price', 14, 4)->nullable();
            $table->decimal('gross_unit_price', 14, 4)->nullable();
            $table->string('serial_number')->nullable();
            $table->string('legacy_customer_number', 128);
            $table->string('classification', 32)->default('other');
            $table->string('classification_confidence', 16)->default('low');
            $table->string('classification_reason')->nullable();
            $table->string('device_type', 64)->nullable();
            $table->jsonb('legacy_data');
            $table->timestamps();

            $table->index(['organization_id', 'legacy_number']);
            $table->index(['organization_id', 'article_number']);
            $table->index(['organization_id', 'classification']);
            $table->index(['customer_id', 'line_date']);
        });

        Schema::table('assets', function (Blueprint $table): void {
            $table->foreignUlid('source_order_item_id')
                ->nullable()
                ->after('service_location_id')
                ->constrained('service_order_items')
                ->nullOnDelete();
            $table->index(
                ['organization_id', 'source_order_item_id'],
                'assets_organization_source_order_item_index',
            );
        });

        $this->convertLegacyCommercialLines();
        $this->clearRealDocuments();

        Schema::dropIfExists('commercial_document_lines');
        Schema::dropIfExists('commercial_documents');
    }

    public function down(): void
    {
        Schema::create('commercial_documents', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('document_number', 128);
            $table->string('legacy_document_number', 128);
            $table->string('type', 32)->default('unclassified');
            $table->date('document_date')->nullable();
            $table->jsonb('legacy_data')->nullable();
            $table->timestamps();
            $table->index(['organization_id', 'document_date']);
        });

        Schema::create('commercial_document_lines', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('commercial_document_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('line_number');
            $table->string('legacy_art')->nullable();
            $table->string('article_number', 128)->nullable();
            $table->string('code', 128)->nullable();
            $table->string('description')->nullable();
            $table->text('additional_text')->nullable();
            $table->decimal('quantity', 14, 4)->nullable();
            $table->decimal('net_unit_price', 14, 4)->nullable();
            $table->decimal('gross_unit_price', 14, 4)->nullable();
            $table->string('serial_number')->nullable();
            $table->string('classification', 32)->default('unclassified');
            $table->jsonb('legacy_data');
            $table->timestamps();
            $table->index(['organization_id', 'article_number']);
        });

        Schema::table('assets', function (Blueprint $table): void {
            $table->dropForeign(['source_order_item_id']);
            $table->dropIndex('assets_organization_source_order_item_index');
            $table->dropColumn('source_order_item_id');
        });

        Schema::dropIfExists('service_order_items');

        Schema::table('service_orders', function (Blueprint $table): void {
            $table->dropIndex('service_orders_organization_order_number_index');
            $table->unique(['organization_id', 'order_number']);
        });
    }

    private function convertLegacyCommercialLines(): void
    {
        if (! Schema::hasTable('commercial_documents') ||
            ! Schema::hasTable('commercial_document_lines')) {
            return;
        }

        $classifier = new LegacyOrderLineClassifier;
        $locations = DB::table('service_locations')
            ->orderByDesc('is_primary')
            ->orderBy('created_at')
            ->get(['id', 'customer_id'])
            ->unique('customer_id')
            ->pluck('id', 'customer_id');

        $this->removePreviouslyDerivedLegacyAssets();

        DB::table('commercial_documents')
            ->orderBy('id')
            ->chunk(200, function ($documents) use ($classifier, $locations): void {
                foreach ($documents as $document) {
                    $customerId = $document->customer_id
                        ?: $this->resolveCustomerId($document);
                    if ($customerId === null) {
                        continue;
                    }

                    $orderId = (string) Str::ulid();
                    $orderTimestamp = $document->document_date
                        ? $document->document_date.' 00:00:00'
                        : ($document->created_at ?: now());
                    DB::table('service_orders')->insert([
                        'id' => $orderId,
                        'organization_id' => $document->organization_id,
                        'order_number' => $document->document_number,
                        'legacy_order_number' => $document->legacy_document_number,
                        'customer_id' => $customerId,
                        'service_location_id' => $locations[$customerId] ?? null,
                        'asset_id' => null,
                        'service_area_id' => null,
                        'source' => 'legacy',
                        'priority' => 'normal',
                        'status' => 'completed',
                        'fault_description' => '',
                        'customer_message' => null,
                        'dispatcher_notes' => 'Aus lsArtikel.txt übernommen.',
                        'preferred_date' => $document->document_date,
                        'warranty_type' => null,
                        'payment_type' => null,
                        'created_by' => null,
                        'closed_at' => $orderTimestamp,
                        'created_at' => $orderTimestamp,
                        'updated_at' => $orderTimestamp,
                    ]);

                    DB::table('commercial_document_lines')
                        ->where('commercial_document_id', $document->id)
                        ->orderBy('line_number')
                        ->get()
                        ->each(function ($line) use (
                            $classifier,
                            $customerId,
                            $document,
                            $locations,
                            $orderId,
                            $orderTimestamp,
                        ): void {
                            $raw = $this->decodeJson($line->legacy_data);
                            $classification = $classifier->classify($raw);
                            $itemId = (string) Str::ulid();

                            DB::table('service_order_items')->insert([
                                'id' => $itemId,
                                'organization_id' => $document->organization_id,
                                'service_order_id' => $orderId,
                                'customer_id' => $customerId,
                                'source_row' => $raw['source_row'] ?? null,
                                'legacy_art' => $raw['Art'] ?? $line->legacy_art,
                                'legacy_number' => $raw['Nummer']
                                    ?? $document->legacy_document_number,
                                'article_number' => $raw['Artikelnummer']
                                    ?? $line->article_number,
                                'code' => $raw['Code'] ?? $line->code,
                                'line_date' => $document->document_date,
                                'description' => $raw['Bezeichnung']
                                    ?? $line->description,
                                'additional_text' => $raw['Zusatztext']
                                    ?? $line->additional_text,
                                'quantity' => $line->quantity,
                                'net_unit_price' => $line->net_unit_price,
                                'gross_unit_price' => $line->gross_unit_price,
                                'serial_number' => $raw['Seriennummer']
                                    ?? $line->serial_number,
                                'legacy_customer_number' => $raw['Kundennummer']
                                    ?? $this->legacyCustomerNumber($customerId),
                                'classification' => $classification['classification'],
                                'classification_confidence' => $classification['confidence'],
                                'classification_reason' => $classification['reason'],
                                'device_type' => $classification['device_type'],
                                'legacy_data' => json_encode(
                                    $raw,
                                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
                                ),
                                'created_at' => $orderTimestamp,
                                'updated_at' => $orderTimestamp,
                            ]);

                            DB::table('import_rows')
                                ->where(
                                    'entity_type',
                                    'App\\Models\\CommercialDocumentLine',
                                )
                                ->where('entity_id', $line->id)
                                ->update([
                                    'entity_type' => ServiceOrderItem::class,
                                    'entity_id' => $itemId,
                                ]);

                            if ($classification['classification'] === 'device') {
                                DB::table('assets')->insert([
                                    'id' => (string) Str::ulid(),
                                    'organization_id' => $document->organization_id,
                                    'customer_id' => $customerId,
                                    'service_location_id' => $locations[$customerId] ?? null,
                                    'source_order_item_id' => $itemId,
                                    'asset_type_id' => null,
                                    'manufacturer_id' => null,
                                    'model' => $raw['Bezeichnung'] ?: null,
                                    'serial_number' => $raw['Seriennummer'] ?: null,
                                    'production_number' => null,
                                    'purchase_date' => $document->document_date,
                                    'installation_date' => null,
                                    'warranty_until' => null,
                                    'status' => 'active',
                                    'legacy_article_id' => $raw['Artikelnummer'] ?: null,
                                    'custom_attributes' => json_encode([
                                        'legacy_number' => $raw['Nummer'] ?? null,
                                        'code' => $raw['Code'] ?? null,
                                        'device_type' => $classification['device_type'],
                                        'classification_confidence' => $classification['confidence'],
                                    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                                    'legacy_data' => json_encode(
                                        $raw,
                                        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
                                    ),
                                    'notes' => $raw['Zusatztext'] ?: null,
                                    'created_at' => $orderTimestamp,
                                    'updated_at' => $orderTimestamp,
                                ]);
                            }
                        });
                }
            });

        DB::table('import_runs')
            ->where('source_type', 'commercial_document_lines')
            ->update(['source_type' => 'service_order_items']);
    }

    private function clearRealDocuments(): void
    {
        foreach (['customer_documents', 'visit_documents'] as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            DB::table($table)
                ->get(['disk', 'path'])
                ->each(function ($document): void {
                    try {
                        Storage::disk($document->disk)->delete($document->path);
                    } catch (Throwable) {
                        // The database still has to be cleared if an old file is unavailable.
                    }
                });
            DB::table($table)->delete();
        }
    }

    private function removePreviouslyDerivedLegacyAssets(): void
    {
        DB::table('assets')
            ->whereNotNull('legacy_data')
            ->orderBy('id')
            ->get(['id', 'legacy_data'])
            ->each(function ($asset): void {
                $raw = $this->decodeJson($asset->legacy_data);
                if (array_key_exists('Nummer', $raw) &&
                    array_key_exists('Kundennummer', $raw)) {
                    DB::table('assets')->where('id', $asset->id)->delete();
                }
            });
    }

    private function resolveCustomerId(object $document): ?string
    {
        $legacy = $this->decodeJson($document->legacy_data);
        $customerNumber = $legacy['customer_number'] ?? null;

        if (! $customerNumber) {
            return null;
        }

        return DB::table('customers')
            ->where('organization_id', $document->organization_id)
            ->where('legacy_customer_number', $customerNumber)
            ->value('id');
    }

    private function legacyCustomerNumber(string $customerId): string
    {
        return (string) DB::table('customers')
            ->where('id', $customerId)
            ->value('legacy_customer_number');
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeJson(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        $decoded = json_decode((string) $value, true);

        return is_array($decoded) ? $decoded : [];
    }
};
