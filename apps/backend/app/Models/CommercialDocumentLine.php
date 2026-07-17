<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommercialDocumentLine extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'legacy_data' => 'array',
            'quantity' => 'decimal:4',
            'net_unit_price' => 'decimal:4',
            'gross_unit_price' => 'decimal:4',
        ];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(
            CommercialDocument::class,
            'commercial_document_id',
        );
    }
}
