<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'legacy_data' => 'array',
            'active' => 'boolean',
            'price' => 'decimal:4',
            'purchase_price' => 'decimal:4',
            'tax_rate' => 'decimal:3',
        ];
    }
}
