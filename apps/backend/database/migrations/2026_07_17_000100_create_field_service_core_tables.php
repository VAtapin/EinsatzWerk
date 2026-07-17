<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_areas', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->string('code', 64);
            $table->string('name');
            $table->string('color', 16)->nullable();
            $table->boolean('active')->default(true);
            $table->jsonb('settings')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'code']);
        });

        Schema::create('service_area_postal_codes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('service_area_id')->constrained()->cascadeOnDelete();
            $table->string('postal_code', 16);
            $table->string('city')->nullable();
            $table->string('dialing_code')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'postal_code']);
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->string('customer_number', 64);
            $table->string('legacy_customer_number', 128)->nullable();
            $table->string('customer_type', 32)->default('person');
            $table->string('title')->nullable();
            $table->string('first_name')->nullable();
            $table->string('last_name');
            $table->string('company_name')->nullable();
            $table->string('email')->nullable();
            $table->string('primary_phone')->nullable();
            $table->string('secondary_phone')->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 32)->default('active');
            $table->jsonb('legacy_data')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'customer_number']);
            $table->unique(['organization_id', 'legacy_customer_number']);
            $table->index(['organization_id', 'last_name']);
        });

        Schema::create('service_locations', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('service_area_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 32)->default('service');
            $table->string('name')->nullable();
            $table->string('contact_person')->nullable();
            $table->string('street')->nullable();
            $table->string('house_number')->nullable();
            $table->string('address_addition')->nullable();
            $table->string('postal_code', 16)->nullable();
            $table->string('city')->nullable();
            $table->string('country', 2)->default('DE');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->text('access_notes')->nullable();
            $table->text('parking_notes')->nullable();
            $table->jsonb('opening_hours')->nullable();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
            $table->index(['organization_id', 'postal_code']);
        });

        Schema::create('manufacturers', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->jsonb('aliases')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->unique(['organization_id', 'name']);
        });

        Schema::create('asset_types', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->string('code', 64);
            $table->string('name');
            $table->boolean('active')->default(true);
            $table->jsonb('settings')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'code']);
        });

        Schema::create('assets', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('service_location_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUlid('asset_type_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUlid('manufacturer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('model')->nullable();
            $table->string('serial_number')->nullable();
            $table->string('production_number')->nullable();
            $table->date('purchase_date')->nullable();
            $table->date('installation_date')->nullable();
            $table->date('warranty_until')->nullable();
            $table->string('status', 32)->default('active');
            $table->string('legacy_article_id', 128)->nullable();
            $table->jsonb('custom_attributes')->nullable();
            $table->jsonb('legacy_data')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['organization_id', 'serial_number']);
            $table->index(['organization_id', 'legacy_article_id']);
        });

        Schema::create('service_orders', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->string('order_number', 64);
            $table->string('legacy_order_number', 128)->nullable();
            $table->foreignUlid('customer_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('service_location_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('asset_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUlid('service_area_id')->nullable()->constrained()->nullOnDelete();
            $table->string('source', 32)->default('phone');
            $table->string('priority', 32)->default('normal');
            $table->string('status', 64)->default('new');
            $table->text('fault_description');
            $table->text('customer_message')->nullable();
            $table->text('dispatcher_notes')->nullable();
            $table->date('preferred_date')->nullable();
            $table->string('warranty_type', 64)->nullable();
            $table->string('payment_type', 64)->nullable();
            $table->foreignUlid('created_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'order_number']);
            $table->index(['organization_id', 'status', 'priority']);
        });

        Schema::create('appointment_constraints', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('service_order_id')->constrained()->cascadeOnDelete();
            $table->string('type', 64);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->unsignedTinyInteger('weekday')->nullable();
            $table->boolean('is_hard')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('technician_profiles', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->string('technician_number', 64);
            $table->string('status', 32)->default('available');
            $table->unsignedSmallInteger('daily_capacity_minutes')->default(480);
            $table->jsonb('working_hours')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'technician_number']);
            $table->unique('user_id');
        });

        Schema::create('visits', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('service_order_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('technician_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->date('planned_date')->nullable();
            $table->timestamp('planned_start_at')->nullable();
            $table->timestamp('planned_end_at')->nullable();
            $table->unsignedSmallInteger('normative_duration_minutes')->nullable();
            $table->unsignedSmallInteger('predicted_duration_minutes')->nullable();
            $table->unsignedSmallInteger('dispatcher_duration_minutes')->nullable();
            $table->timestamp('actual_arrival_at')->nullable();
            $table->timestamp('actual_start_at')->nullable();
            $table->timestamp('actual_end_at')->nullable();
            $table->string('status', 64)->default('planned');
            $table->unsignedSmallInteger('visit_number')->default(1);
            $table->text('diagnosis')->nullable();
            $table->text('work_performed')->nullable();
            $table->string('result', 64)->nullable();
            $table->boolean('follow_up_required')->default(false);
            $table->text('technician_notes')->nullable();
            $table->text('dispatcher_notes')->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->timestamps();
            $table->index(['organization_id', 'planned_date', 'technician_id']);
            $table->unique(['service_order_id', 'visit_number']);
        });

        Schema::create('routes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('technician_id')->references('id')->on('users')->restrictOnDelete();
            $table->date('route_date');
            $table->foreignUlid('service_area_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 32)->default('draft');
            $table->unsignedInteger('total_distance_meters')->nullable();
            $table->unsignedInteger('estimated_duration_seconds')->nullable();
            $table->string('optimization_provider')->nullable();
            $table->jsonb('optimization_data')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'technician_id', 'route_date']);
        });

        Schema::create('route_stops', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('route_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('visit_id')->nullable()->constrained()->nullOnDelete();
            $table->string('stop_type', 32)->default('visit');
            $table->unsignedSmallInteger('sequence');
            $table->timestamp('planned_arrival_at')->nullable();
            $table->timestamp('planned_departure_at')->nullable();
            $table->unsignedSmallInteger('service_duration_minutes')->nullable();
            $table->unsignedInteger('travel_duration_seconds')->nullable();
            $table->unsignedInteger('travel_distance_meters')->nullable();
            $table->boolean('locked')->default(false);
            $table->string('source', 32)->default('manual');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->jsonb('optimization_metadata')->nullable();
            $table->timestamps();
            $table->unique(['route_id', 'sequence']);
        });

        Schema::create('products', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->string('article_number', 128)->nullable();
            $table->string('legacy_article_number', 128)->nullable();
            $table->string('name');
            $table->string('type', 32)->default('unclassified');
            $table->foreignUlid('manufacturer_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('price', 14, 4)->nullable();
            $table->decimal('purchase_price', 14, 4)->nullable();
            $table->decimal('tax_rate', 6, 3)->nullable();
            $table->boolean('active')->default(true);
            $table->jsonb('legacy_data')->nullable();
            $table->timestamps();
            $table->index(['organization_id', 'article_number']);
        });

        Schema::create('commercial_documents', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('document_number', 128);
            $table->string('legacy_document_number', 128);
            $table->string('type', 32)->default('unclassified');
            $table->date('document_date')->nullable();
            $table->jsonb('legacy_data')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'legacy_document_number']);
            $table->index(['organization_id', 'document_date']);
        });

        Schema::create('commercial_document_lines', function (Blueprint $table) {
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
            $table->unique(['commercial_document_id', 'line_number']);
            $table->index(['organization_id', 'article_number']);
        });

        Schema::create('part_requirements', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('service_order_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('visit_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUlid('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('description');
            $table->decimal('quantity', 12, 3)->default(1);
            $table->string('status', 32)->default('requested');
            $table->foreignUlid('requested_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('visit_parts', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('visit_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('description');
            $table->decimal('quantity', 12, 3);
            $table->decimal('unit_price', 14, 4)->nullable();
            $table->timestamps();
        });

        Schema::create('status_history', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->string('subject_type');
            $table->ulid('subject_id');
            $table->string('from_status', 64)->nullable();
            $table->string('to_status', 64);
            $table->foreignUlid('changed_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamp('created_at');
            $table->index(['organization_id', 'subject_type', 'subject_id']);
        });

        Schema::create('import_runs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->string('source_type', 64);
            $table->string('source_name');
            $table->string('source_hash', 64);
            $table->string('status', 32)->default('pending');
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('processed_rows')->default(0);
            $table->unsignedInteger('created_rows')->default(0);
            $table->unsignedInteger('updated_rows')->default(0);
            $table->unsignedInteger('warning_rows')->default(0);
            $table->unsignedInteger('error_rows')->default(0);
            $table->jsonb('metadata')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'source_type', 'source_hash']);
        });

        Schema::create('import_rows', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('import_run_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('source_row');
            $table->string('source_key')->nullable();
            $table->string('status', 32);
            $table->string('entity_type')->nullable();
            $table->ulid('entity_id')->nullable();
            $table->jsonb('raw_data');
            $table->jsonb('warnings')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();
            $table->unique(['import_run_id', 'source_row']);
            $table->index(['organization_id', 'source_key']);
        });

        Schema::create('legacy_tour_entries', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('import_run_id')->constrained()->cascadeOnDelete();
            $table->string('source_sheet');
            $table->unsignedInteger('source_row');
            $table->string('legacy_document_number')->nullable();
            $table->date('service_date')->nullable();
            $table->string('appointment_sequence')->nullable();
            $table->string('customer_name')->nullable();
            $table->string('city')->nullable();
            $table->string('result_code')->nullable();
            $table->decimal('amount', 14, 4)->nullable();
            $table->jsonb('raw_data');
            $table->timestamps();
            $table->unique(['import_run_id', 'source_sheet', 'source_row']);
            $table->index(['organization_id', 'service_date']);
        });
    }

    public function down(): void
    {
        foreach ([
            'legacy_tour_entries', 'import_rows', 'import_runs',
            'status_history', 'visit_parts',
            'part_requirements', 'commercial_document_lines',
            'commercial_documents', 'products', 'route_stops', 'routes', 'visits',
            'technician_profiles', 'appointment_constraints', 'service_orders',
            'assets', 'asset_types', 'manufacturers', 'service_locations',
            'customers', 'service_area_postal_codes', 'service_areas',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
