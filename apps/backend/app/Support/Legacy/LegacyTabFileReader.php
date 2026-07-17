<?php

namespace App\Support\Legacy;

use Generator;
use RuntimeException;

final class LegacyTabFileReader
{
    /**
     * @return Generator<int, array{row: int, data: array<string, string>}>
     */
    public function rows(string $path): Generator
    {
        $handle = fopen($path, 'rb');

        if ($handle === false) {
            throw new RuntimeException("Legacy file cannot be opened: {$path}");
        }

        try {
            $rawHeaders = fgetcsv($handle, null, "\t", '"', '');

            if ($rawHeaders === false) {
                throw new RuntimeException("Legacy file has no header: {$path}");
            }

            $headers = array_map($this->decode(...), $rawHeaders);

            while ($headers !== [] && end($headers) === '') {
                array_pop($headers);
            }

            $sourceRow = 1;

            while (($rawRow = fgetcsv($handle, null, "\t", '"', '')) !== false) {
                $sourceRow++;
                $row = array_map($this->decode(...), $rawRow);
                $row = array_slice(array_pad($row, count($headers), ''), 0, count($headers));

                yield [
                    'row' => $sourceRow,
                    'data' => array_combine($headers, $row),
                ];
            }
        } finally {
            fclose($handle);
        }
    }

    private function decode(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        return trim(mb_convert_encoding($value, 'UTF-8', 'Windows-1252'));
    }
}
