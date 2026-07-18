<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerDocument;
use App\Models\Organization;
use App\Models\ServiceLocation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class LegacyOrderMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_converts_every_legacy_line_to_an_order_item_and_clears_documents(): void
    {
        $migration = require database_path(
            'migrations/2026_07_18_000400_convert_legacy_articles_to_order_items.php',
        );
        $migration->down();

        $organization = Organization::query()->create([
            'name' => 'EinsatzWerk',
            'slug' => 'einsatzwerk',
        ]);
        $customer = Customer::query()->create([
            'organization_id' => $organization->id,
            'customer_number' => '24847',
            'legacy_customer_number' => '24847',
            'last_name' => 'Müller',
        ]);
        ServiceLocation::query()->create([
            'organization_id' => $organization->id,
            'customer_id' => $customer->id,
            'street' => 'Friedrichstraße',
            'postal_code' => '16303',
            'city' => 'Schwedt/Oder',
            'is_primary' => true,
        ]);

        $documentId = (string) Str::ulid();
        DB::table('commercial_documents')->insert([
            'id' => $documentId,
            'organization_id' => $organization->id,
            'customer_id' => $customer->id,
            'document_number' => 'L3821',
            'legacy_document_number' => 'L3821',
            'type' => 'unclassified',
            'document_date' => '2017-04-28',
            'legacy_data' => json_encode(['customer_number' => '24847']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->insertLegacyLine($organization->id, $documentId, 1, [
            'Art' => '',
            'Nummer' => 'L3821',
            'Artikelnummer' => 'f',
            'Code' => 'f',
            'Datum' => '28.04.2017',
            'Bezeichnung' => 'Anlieferung Standgerät',
            'Zusatztext' => 'Aufstellung und Altgeräteabtransport',
            'Anzahl' => '000000001,000',
            'Einzelpreis' => '000000032,773',
            'Bruttoeinzelpreis' => '000000039,000',
            'Seriennummer' => '',
            'Kundennummer' => '24847',
            'source_row' => 2,
        ]);
        $this->insertLegacyLine($organization->id, $documentId, 2, [
            'Art' => '',
            'Nummer' => 'L3821',
            'Artikelnummer' => '99041',
            'Code' => 'EK 45546',
            'Datum' => '28.04.2017',
            'Bezeichnung' => 'PKM KG 220.4 A++',
            'Zusatztext' => 'Kühl-Gefrierkombination',
            'Anzahl' => '000000001,000',
            'Einzelpreis' => '000000419,328',
            'Bruttoeinzelpreis' => '000000499,000',
            'Seriennummer' => '',
            'Kundennummer' => '24847',
            'source_row' => 3,
        ]);

        Storage::fake('local');
        Storage::disk('local')->put('customer-documents/old.pdf', 'old');
        CustomerDocument::query()->create([
            'organization_id' => $organization->id,
            'customer_id' => $customer->id,
            'name' => 'old.pdf',
            'disk' => 'local',
            'path' => 'customer-documents/old.pdf',
        ]);

        $migration->up();

        $this->assertDatabaseHas('service_orders', [
            'organization_id' => $organization->id,
            'order_number' => 'L3821',
            'source' => 'legacy',
            'status' => 'completed',
        ]);
        $this->assertDatabaseCount('service_order_items', 2);
        $this->assertDatabaseHas('service_order_items', [
            'legacy_number' => 'L3821',
            'classification' => 'delivery',
        ]);
        $this->assertDatabaseHas('service_order_items', [
            'legacy_number' => 'L3821',
            'classification' => 'device',
            'additional_text' => 'Kühl-Gefrierkombination',
        ]);
        $this->assertDatabaseHas('assets', [
            'customer_id' => $customer->id,
            'model' => 'PKM KG 220.4 A++',
        ]);
        $this->assertDatabaseCount('customer_documents', 0);
        Storage::disk('local')->assertMissing('customer-documents/old.pdf');
        $this->assertFalse(Schema::hasTable('commercial_documents'));
        $this->assertFalse(Schema::hasTable('commercial_document_lines'));
    }

    /**
     * @param  array<string, mixed>  $raw
     */
    private function insertLegacyLine(
        string $organizationId,
        string $documentId,
        int $lineNumber,
        array $raw,
    ): void {
        DB::table('commercial_document_lines')->insert([
            'id' => (string) Str::ulid(),
            'organization_id' => $organizationId,
            'commercial_document_id' => $documentId,
            'line_number' => $lineNumber,
            'legacy_art' => $raw['Art'],
            'article_number' => $raw['Artikelnummer'],
            'code' => $raw['Code'],
            'description' => $raw['Bezeichnung'],
            'additional_text' => $raw['Zusatztext'],
            'quantity' => str_replace(',', '.', $raw['Anzahl']),
            'net_unit_price' => str_replace(',', '.', $raw['Einzelpreis']),
            'gross_unit_price' => str_replace(',', '.', $raw['Bruttoeinzelpreis']),
            'serial_number' => $raw['Seriennummer'],
            'classification' => 'unclassified',
            'legacy_data' => json_encode($raw, JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
