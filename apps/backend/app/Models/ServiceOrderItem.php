<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceOrderItem extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'line_date' => 'date',
            'quantity' => 'decimal:4',
            'net_unit_price' => 'decimal:4',
            'gross_unit_price' => 'decimal:4',
            'legacy_data' => 'array',
        ];
    }

    public function serviceOrder(): BelongsTo
    {
        return $this->belongsTo(ServiceOrder::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class, 'source_order_item_id');
    }
}
