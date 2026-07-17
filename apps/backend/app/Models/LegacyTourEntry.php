<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

class LegacyTourEntry extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'service_date' => 'date',
            'amount' => 'decimal:4',
            'raw_data' => 'array',
        ];
    }
}
