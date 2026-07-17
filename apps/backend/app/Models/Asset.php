<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Asset extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'purchase_date' => 'date',
            'installation_date' => 'date',
            'warranty_until' => 'date',
            'custom_attributes' => 'array',
            'legacy_data' => 'array',
        ];
    }

    public function manufacturer(): BelongsTo
    {
        return $this->belongsTo(Manufacturer::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function serviceLocation(): BelongsTo
    {
        return $this->belongsTo(ServiceLocation::class);
    }
}
