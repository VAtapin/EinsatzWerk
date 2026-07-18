<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Organization extends Model
{
    use HasUlids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Organization $organization): void {
            if ($organization->slug) {
                return;
            }

            $base = Str::slug($organization->name) ?: 'organization';
            $slug = $base;
            $suffix = 2;

            while (static::query()->where('slug', $slug)->exists()) {
                $slug = "{$base}-{$suffix}";
                $suffix++;
            }

            $organization->slug = $slug;
        });
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }

    public function telephonyIntegrations(): HasMany
    {
        return $this->hasMany(TelephonyIntegration::class);
    }
}
