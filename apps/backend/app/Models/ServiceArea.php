<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceArea extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'settings' => 'array',
        ];
    }

    public function postalCodes(): HasMany
    {
        return $this->hasMany(ServiceAreaPostalCode::class);
    }
}
