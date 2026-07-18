<?php

namespace App\Telephony\Support;

use Carbon\CarbonImmutable;
use Throwable;

final class PayloadReader
{
    /**
     * @param  array<string, mixed>  $payload
     * @param  array<int, string>  $keys
     */
    public static function first(array $payload, array $keys): mixed
    {
        $flattened = self::flatten($payload);

        foreach ($keys as $key) {
            $normalized = strtolower(str_replace(['-', '_', '.'], '', $key));
            if (array_key_exists($normalized, $flattened)) {
                return $flattened[$normalized];
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function string(array $payload, array $keys): ?string
    {
        $value = self::first($payload, $keys);
        if ($value === null || is_array($value) || is_object($value)) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function integer(array $payload, array $keys): ?int
    {
        $value = self::first($payload, $keys);

        return is_numeric($value) ? max(0, (int) round((float) $value)) : null;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function date(array $payload, array $keys): CarbonImmutable
    {
        $value = self::string($payload, $keys);
        if ($value !== null) {
            try {
                return CarbonImmutable::parse($value);
            } catch (Throwable) {
                // Provider timestamps are optional and not always ISO formatted.
            }
        }

        return CarbonImmutable::now();
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private static function flatten(array $payload): array
    {
        $result = [];
        $walk = function (array $values) use (&$walk, &$result): void {
            foreach ($values as $key => $value) {
                $normalized = strtolower(str_replace(['-', '_', '.'], '', (string) $key));
                if (! array_key_exists($normalized, $result)) {
                    $result[$normalized] = $value;
                }
                if (is_array($value) && ! array_is_list($value)) {
                    $walk($value);
                }
            }
        };
        $walk($payload);

        return $result;
    }
}
