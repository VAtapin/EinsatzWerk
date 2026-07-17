<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_orders', function (Blueprint $table): void {
            $table->string('fault_category')->nullable()->after('priority');
            $table->index(['organization_id', 'fault_category']);
        });
    }

    public function down(): void
    {
        Schema::table('service_orders', function (Blueprint $table): void {
            $table->dropIndex(['organization_id', 'fault_category']);
            $table->dropColumn('fault_category');
        });
    }
};
