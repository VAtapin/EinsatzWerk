<?php

namespace Tests\Unit;

use App\Support\Legacy\LegacyOrderLineClassifier;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class LegacyOrderLineClassifierTest extends TestCase
{
    /**
     * @param  array<string, string>  $line
     */
    #[DataProvider('legacyLines')]
    public function test_it_classifies_legacy_order_lines_without_using_serial_number(
        array $line,
        string $expected,
    ): void {
        $result = (new LegacyOrderLineClassifier)->classify($line);

        $this->assertSame($expected, $result['classification']);
    }

    public static function legacyLines(): array
    {
        return [
            'delivery by code' => [[
                'Code' => 'f',
                'Bezeichnung' => 'Anlieferung Standgerät',
                'Zusatztext' => 'Aufstellung und Anschluss',
            ], 'delivery'],
            'old appliance collection' => [[
                'Code' => 'AL',
                'Bezeichnung' => 'Altgerätegutschrift / Sondernachlass',
                'Zusatztext' => '',
            ], 'disposal'],
            'device from additional text' => [[
                'Code' => '',
                'Artikelnummer' => '22806',
                'Bezeichnung' => 'CAN CPDA 244',
                'Zusatztext' => 'Kühlkombi',
            ], 'device'],
            'device from category code' => [[
                'Code' => 'EIN Geschirrspüler',
                'Artikelnummer' => 'E3421',
                'Bezeichnung' => 'Miele G 6360 SCVi',
                'Zusatztext' => '',
            ], 'device'],
            'inspection without code' => [[
                'Code' => '',
                'Artikelnummer' => 'Erst',
                'Bezeichnung' => 'Erstprüfung nach VDE/ VBG',
                'Zusatztext' => '',
            ], 'inspection'],
            'discount before generic hardware' => [[
                'Code' => 'HW',
                'Artikelnummer' => 'HW',
                'Bezeichnung' => 'Sondernachlass',
                'Zusatztext' => '',
            ], 'discount'],
            'spare part' => [[
                'Code' => 'DL',
                'Artikelnummer' => '12345',
                'Bezeichnung' => 'Miele Schalterblende',
                'Zusatztext' => 'Ersatzteil',
            ], 'spare_part'],
        ];
    }
}
