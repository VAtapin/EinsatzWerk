<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table): void {
            $table->foreignUlid('service_order_id')
                ->nullable()
                ->after('recipient_id')
                ->constrained()
                ->nullOnDelete();
            $table->foreignUlid('visit_id')
                ->nullable()
                ->after('service_order_id')
                ->constrained()
                ->nullOnDelete();
            $table->string('type', 32)->default('user')->after('visit_id');
            $table->string('severity', 16)->default('normal')->after('type');
            $table->boolean('requires_ack')->default(false)->after('severity');
            $table->timestamp('delivered_at')->nullable()->after('read_at');
            $table->timestamp('acknowledged_at')->nullable()->after('delivered_at');
            $table->foreignUlid('acknowledged_by')
                ->nullable()
                ->after('acknowledged_at')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
            $table->jsonb('metadata')->nullable()->after('acknowledged_by');
            $table->index(['organization_id', 'recipient_id', 'read_at']);
            $table->index(['organization_id', 'requires_ack', 'acknowledged_at']);
            $table->index(['organization_id', 'service_order_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table): void {
            $table->dropForeign(['service_order_id']);
            $table->dropForeign(['visit_id']);
            $table->dropForeign(['acknowledged_by']);
            $table->dropIndex(['organization_id', 'recipient_id', 'read_at']);
            $table->dropIndex(['organization_id', 'requires_ack', 'acknowledged_at']);
            $table->dropIndex(['organization_id', 'service_order_id', 'created_at']);
            $table->dropColumn([
                'service_order_id',
                'visit_id',
                'type',
                'severity',
                'requires_ack',
                'delivered_at',
                'acknowledged_at',
                'acknowledged_by',
                'metadata',
            ]);
        });
    }
};
