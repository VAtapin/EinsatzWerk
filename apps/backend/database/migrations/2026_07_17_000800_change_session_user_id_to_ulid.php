<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        match (DB::getDriverName()) {
            'pgsql' => DB::statement(
                'ALTER TABLE sessions ALTER COLUMN user_id TYPE VARCHAR(26) USING user_id::VARCHAR'
            ),
            'mysql', 'mariadb' => DB::statement(
                'ALTER TABLE sessions MODIFY user_id VARCHAR(26) NULL'
            ),
            default => Schema::table('sessions', function (Blueprint $table): void {
                $table->string('user_id', 26)->nullable()->change();
            }),
        };
    }

    public function down(): void
    {
        // ULID user identifiers cannot be converted back to bigint without data loss.
    }
};
