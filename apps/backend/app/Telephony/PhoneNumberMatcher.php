<?php

namespace App\Telephony;

use App\Models\Customer;
use Illuminate\Support\Collection;

class PhoneNumberMatcher
{
    /**
     * Original customer numbers are never changed. Matching keys are derived in memory.
     *
     * @return Collection<int, array{customer: Customer, score: int, matched_by: string}>
     */
    public function find(string $organizationId, ?string $phone, int $limit = 10): Collection
    {
        $phone = trim((string) $phone);
        if ($phone === '') {
            return collect();
        }

        $incomingKeys = $this->keys($phone);

        return Customer::query()
            ->where('organization_id', $organizationId)
            ->where(fn ($builder) => $builder
                ->whereNotNull('primary_phone')
                ->orWhereNotNull('secondary_phone'))
            ->with([
                'serviceLocations' => fn ($builder) => $builder->orderByDesc('is_primary'),
                'assets' => fn ($builder) => $builder->where('status', 'active')->latest(),
                'serviceOrders' => fn ($builder) => $builder
                    ->whereNotIn('status', ['completed', 'cancelled'])
                    ->latest()
                    ->limit(10),
            ])
            ->get()
            ->map(function (Customer $customer) use ($phone, $incomingKeys): ?array {
                $best = null;
                foreach (array_filter([
                    $customer->primary_phone,
                    $customer->secondary_phone,
                ]) as $stored) {
                    $score = trim($stored) === $phone
                        ? 100
                        : (count(array_intersect($incomingKeys, $this->keys($stored))) > 0 ? 80 : 0);
                    if ($score > ($best['score'] ?? 0)) {
                        $best = [
                            'customer' => $customer,
                            'score' => $score,
                            'matched_by' => $score === 100 ? 'raw_exact' : 'derived_exact',
                        ];
                    }
                }

                return $best;
            })
            ->filter()
            ->sortByDesc('score')
            ->take($limit)
            ->values();
    }

    /**
     * @return array<int, string>
     */
    public function keys(?string $phone): array
    {
        $raw = trim((string) $phone);
        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        if ($digits === '') {
            return [];
        }

        $keys = [$digits];
        if (str_starts_with($digits, '00')) {
            $keys[] = substr($digits, 2);
        }
        if (str_starts_with($digits, '49')) {
            $keys[] = '0'.substr($digits, 2);
        } elseif (str_starts_with($digits, '0') && strlen($digits) > 1) {
            $keys[] = '49'.substr($digits, 1);
        }

        return array_values(array_unique(array_filter($keys)));
    }
}
