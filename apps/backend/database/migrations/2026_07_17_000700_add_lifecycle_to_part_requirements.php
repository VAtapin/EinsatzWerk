<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('part_requirements', function (Blueprint $table) {
            $table->foreignUlid('approved_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('ordered_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->string('supplier_reference')->nullable();
            $table->text('office_notes')->nullable();
            $table->index(['organization_id', 'status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('part_requirements', function (Blueprint $table) {
            $table->dropIndex(['organization_id', 'status', 'created_at']);
            $table->dropConstrainedForeignId('approved_by');
            $table->dropColumn([
                'approved_at',
                'ordered_at',
                'received_at',
                'supplier_reference',
                'office_notes',
            ]);
        });
    }
};
