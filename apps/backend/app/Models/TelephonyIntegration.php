<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TelephonyIntegration extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected $hidden = ['webhook_key_hash'];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'settings' => 'array',
            'last_event_at' => 'datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function calls(): HasMany
    {
        return $this->hasMany(TelephonyCall::class);
    }
}
