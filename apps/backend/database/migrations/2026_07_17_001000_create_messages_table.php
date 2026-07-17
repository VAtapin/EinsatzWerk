<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('sender_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreignUlid('recipient_id')->nullable()->references('id')->on('users')->cascadeOnDelete();
            $table->string('subject');
            $table->text('body');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->index(['organization_id', 'recipient_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
