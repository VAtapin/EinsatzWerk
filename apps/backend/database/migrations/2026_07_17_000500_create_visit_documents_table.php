<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visit_documents', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('visit_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32);
            $table->string('disk', 32)->default('local');
            $table->string('path');
            $table->string('original_name')->nullable();
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size')->nullable();
            $table->foreignUlid('created_by')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->jsonb('metadata')->nullable();
            $table->timestamps();
            $table->index(['organization_id', 'visit_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visit_documents');
    }
};
