<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_locations', function (Blueprint $table) {
            $table->string('geocoding_provider')->nullable()->after('longitude');
            $table->timestamp('geocoded_at')->nullable()->after('geocoding_provider');
            $table->jsonb('geocoding_data')->nullable()->after('geocoded_at');
        });
    }

    public function down(): void
    {
        Schema::table('service_locations', function (Blueprint $table) {
            $table->dropColumn(['geocoding_provider', 'geocoded_at', 'geocoding_data']);
        });
    }
};
