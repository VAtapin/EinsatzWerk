<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('telephony_integrations', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 32);
            $table->string('name');
            $table->string('webhook_key_hash', 64)->unique();
            $table->boolean('enabled')->default(true);
            $table->jsonb('settings')->nullable();
            $table->timestamp('last_event_at')->nullable();
            $table->timestamps();
            $table->index(['organization_id', 'provider', 'enabled']);
        });

        Schema::create('telephony_calls', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('telephony_integration_id')
                ->constrained('telephony_integrations')
                ->cascadeOnDelete();
            $table->foreignUlid('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUlid('acknowledged_by')
                ->nullable()
                ->references('id')
                ->on('users')
                ->nullOnDelete();
            $table->string('provider', 32);
            $table->string('external_call_id', 191);
            $table->string('direction', 16)->default('incoming');
            $table->string('status', 32)->default('ringing');
            $table->string('from_number')->nullable();
            $table->string('to_number')->nullable();
            $table->string('caller_name')->nullable();
            $table->string('extension')->nullable();
            $table->string('matched_by', 32)->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('answered_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->jsonb('provider_data')->nullable();
            $table->timestamps();
            $table->unique(
                ['telephony_integration_id', 'external_call_id'],
                'telephony_calls_integration_external_unique',
            );
            $table->index(['organization_id', 'status', 'created_at']);
            $table->index(['organization_id', 'from_number']);
        });

        Schema::create('telephony_call_events', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('telephony_integration_id')
                ->constrained('telephony_integrations')
                ->cascadeOnDelete();
            $table->foreignUlid('telephony_call_id')
                ->constrained('telephony_calls')
                ->cascadeOnDelete();
            $table->string('event_key', 64);
            $table->string('provider_event', 64);
            $table->string('normalized_status', 32);
            $table->jsonb('payload');
            $table->timestamp('occurred_at');
            $table->timestamp('created_at');
            $table->unique(
                ['telephony_integration_id', 'event_key'],
                'telephony_events_integration_key_unique',
            );
            $table->index(['organization_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telephony_call_events');
        Schema::dropIfExists('telephony_calls');
        Schema::dropIfExists('telephony_integrations');
    }
};
