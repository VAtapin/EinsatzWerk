<?php

namespace Tests\Unit;

use App\Support\Legacy\LegacyTabFileReader;
use PHPUnit\Framework\TestCase;

class LegacyTabFileReaderTest extends TestCase
{
    public function test_it_preserves_phone_values_exactly_as_exported(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'einsatzwerk-legacy-');
        $contents = "Kundennummer\tName\tTelefon\t\r\n"
            ."10041\tMüller\t55176\t\r\n";
        file_put_contents($path, mb_convert_encoding($contents, 'Windows-1252', 'UTF-8'));

        try {
            $rows = iterator_to_array((new LegacyTabFileReader)->rows($path));
        } finally {
            unlink($path);
        }

        $this->assertSame('55176', $rows[0]['data']['Telefon']);
        $this->assertSame('Müller', $rows[0]['data']['Name']);
    }
}
