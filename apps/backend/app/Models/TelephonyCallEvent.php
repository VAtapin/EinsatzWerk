<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TelephonyCallEvent extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'occurred_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function call(): BelongsTo
    {
        return $this->belongsTo(TelephonyCall::class, 'telephony_call_id');
    }

    public function integration(): BelongsTo
    {
        return $this->belongsTo(TelephonyIntegration::class, 'telephony_integration_id');
    }
}
