<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_number_sequences', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->date('sequence_date');
            $table->unsignedInteger('current_value')->default(0);
            $table->timestamps();
            $table->unique(['organization_id', 'sequence_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_number_sequences');
    }
};
