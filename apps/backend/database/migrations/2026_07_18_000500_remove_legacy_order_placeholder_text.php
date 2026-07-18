<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('service_orders')
            ->where('source', 'legacy')
            ->update(['fault_description' => '']);
    }

    public function down(): void
    {
        // Source positions remain the authoritative content of imported orders.
    }
};
