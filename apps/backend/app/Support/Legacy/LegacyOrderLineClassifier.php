<?php

namespace App\Support\Legacy;

final class LegacyOrderLineClassifier
{
    /**
     * @param  array<string, mixed>  $data
     * @return array{classification: string, confidence: string, reason: string, device_type: ?string}
     */
    public function classify(array $data): array
    {
        $art = $this->normalize($data['Art'] ?? '');
        $code = $this->normalize($data['Code'] ?? '');
        $articleNumber = $this->normalize($data['Artikelnummer'] ?? '');
        $description = $this->normalize($data['Bezeichnung'] ?? '');
        $additionalText = $this->normalize($data['Zusatztext'] ?? '');
        $text = trim(implode(' ', array_filter([
            $code,
            $articleNumber,
            $description,
            $additionalText,
        ])));

        if (in_array($art, ['titel', 'titelsumme', 'zwischensumme', 'alternativ'], true)) {
            return $this->result('structural', 'high', "Art={$art}");
        }

        // Explicit legacy codes take precedence over words in Zusatztext.
        // For example Code=f may mention included Altgeräteabtransport but the
        // row itself is still the delivery position.
        if ($code === 'al') {
            return $this->result('disposal', 'high', 'Code=AL');
        }

        if (in_array($code, ['f', 'fe'], true)) {
            return $this->result('delivery', 'high', "Code={$code}");
        }

        if ($code === 'g') {
            return $this->result('warranty', 'high', 'Code=G');
        }

        if ($this->matches($text, [
            'sonder(?:nachlass|rabatt)', 'nachlass', 'gutschrift', 'werbebonus',
            'anzahlung', 'rabatt', 'preisnachlass',
        ])) {
            return $this->result('discount', 'high', 'Rabatt/Gutschrift im Text');
        }

        if ($this->matches($text, [
            'altger[aä]t', 'abtransport', 'entsorgung', 'verschrottung',
        ])) {
            return $this->result('disposal', 'high', 'Altgerät/Entsorgung');
        }

        if ($this->matches($text, [
            'garantie', 'werksgarantie', 'garantieverl[aä]ngerung',
        ])) {
            return $this->result('warranty', 'high', 'Garantie');
        }

        if ($this->matches($text, [
            'erstpr[uü]fung', 'vde[ /-]', 'pr[uü]fung nach 0701',
            'sicherheitspr[uü]fung',
        ])) {
            return $this->result('inspection', 'high', 'Prüfung/VDE');
        }

        if ($this->matches($text, [
            'anlieferung', 'fahrtkosten', 'transportkosten', 'lieferpauschale',
        ])) {
            return $this->result('delivery', 'high', 'Lieferung/Fahrtkosten');
        }

        if (str_starts_with($code, 'aw ') || str_starts_with($code, 'kfz ') ||
            $this->matches($text, [
                'arbeitsleistung', 'montagekosten', 'kundendienst',
                'reparaturleistung', 'lohnkosten', 'arbeitszeit',
            ])) {
            return $this->result('labor', 'high', 'Arbeitsleistung');
        }

        if ($code === 'dl' || $this->matches($text, [
            'ersatzteil', 'schalterblende', 'verbindungsschlauch',
            'dichtungssatz', 't[uü]rdichtung', 'schubkasten', 'schublade',
            'heizstab', 'drucksensor', 'z[uü]ndelektrode',
        ])) {
            return $this->result('spare_part', 'high', 'Ersatzteil');
        }

        if ($code === 'ein schränke' || $code === 'm' ||
            $this->matches($text, [
                'einbaum[oö]bel', 'k[uü]chenm[oö]bel', 'arbeitsplatte',
                'wandabschlussprofil', 'sp[uü]lenschrank', 'unterschrank',
                'oberschrank', 'hochschrank', 'sockelblende',
            ])) {
            return $this->result('furniture', 'high', 'Möbel/Kücheneinrichtung');
        }

        $deviceType = $this->deviceType($text, $code);
        if ($deviceType !== null) {
            return $this->result('device', 'high', 'Geräteart erkannt', $deviceType);
        }

        if ($this->matches($text, [
            'armatur', 'einbausp[uü]le', 'sp[uü]le', 'k[uü]chenzubeh[oö]r',
            'kleinmaterial', 'besteckeinsatz', 'kochtopf', 'pfanne',
        ])) {
            return $this->result('accessory', 'high', 'Zubehör');
        }

        if ($this->looksLikeBrandedModel($description) &&
            ! $this->matches($text, [
                'zubeh[oö]r', 'blende', 'filter', 'schlauch', 'dichtung',
                'schalter', 'korb', 'griff', 'platte', 't[uü]r',
            ])) {
            return $this->result(
                'device',
                'medium',
                'Hersteller und Modellbezeichnung erkannt',
                'other',
            );
        }

        if ($code === 'hw') {
            return $this->result('accessory', 'medium', 'Code=HW');
        }

        return $this->result('other', 'low', 'Keine eindeutige Klassifikation');
    }

    private function deviceType(string $text, string $code): ?string
    {
        $codeTypes = [
            'ein herd' => 'cooking',
            'ein geschirrspüler' => 'dishwasher',
            'ein kühlen' => 'refrigeration',
            'ein hauben' => 'extractor_hood',
        ];
        if (isset($codeTypes[$code])) {
            return $codeTypes[$code];
        }

        $patterns = [
            'washing_machine' => [
                'waschmaschine', 'waschautomat', 'frontlader', 'toplader',
                'waschtrockner',
            ],
            'dryer' => ['w[aä]schetrockner', '(?<!wasch)trockner'],
            'dishwasher' => ['geschirrsp[uü]ler', 'sp[uü]lmaschine'],
            'refrigeration' => [
                'k[uü]hlschrank', 'k[uü]hlautomat', 'k[uü]hlkombi',
                'k[uü]hl-?gefrier', 'gefrierschrank', 'gefriertruhe',
                'einbauk[uü]hl',
            ],
            'cooking' => [
                'backofen', '(?<!anschluss)\\bherd\\b', 'herd-set',
                'herd-kombination', 'kochfeld', 'induktions-?set',
            ],
            'extractor_hood' => [
                'dunstabzug', 'abzugshaube', 'dunsthaube', 'wandhaube',
                'flachschirmhaube',
            ],
            'microwave' => ['mikrowelle', 'mikrowellenger[aä]t'],
            'vacuum_cleaner' => ['staubsauger', 'bodenstaubsauger'],
            'coffee_machine' => ['kaffeeautomat', 'kaffeemaschine', 'kaffeevollautomat'],
            'small_appliance' => [
                'wasserkocher', 'toaster', 'b[uü]geleisen', 'k[uü]chenmaschine',
                'handmixer', 'standmixer', 'fritteuse',
            ],
        ];

        foreach ($patterns as $type => $typePatterns) {
            if ($this->matches($text, $typePatterns)) {
                return $type;
            }
        }

        return null;
    }

    private function looksLikeBrandedModel(string $description): bool
    {
        if ($description === '') {
            return false;
        }

        $brand = preg_match(
            '~^(?:aeg|bauknecht|beko|blomberg|bosch|candy|constructa|dyson|'.
            'electrolux|fagor|gorenje|grundig|juno|k[uü]ppersbusch|lg|'.
            'liebherr|miele|neff|pan(?:asonic)?|philips|pkm|privileg|rowenta|'.
            'samsung|seg|severin|siemens|smeg|tef(?:al)?|whirlpool|zanussi)\\b~iu',
            $description,
        ) === 1;

        return $brand
            && preg_match('/[a-z]*\\d+[a-z0-9 .+\\/-]*/iu', $description) === 1;
    }

    /**
     * @param  list<string>  $patterns
     */
    private function matches(string $text, array $patterns): bool
    {
        return preg_match('~(?:'.implode('|', $patterns).')~iu', $text) === 1;
    }

    private function normalize(mixed $value): string
    {
        return mb_strtolower(trim((string) $value), 'UTF-8');
    }

    /**
     * @return array{classification: string, confidence: string, reason: string, device_type: ?string}
     */
    private function result(
        string $classification,
        string $confidence,
        string $reason,
        ?string $deviceType = null,
    ): array {
        return [
            'classification' => $classification,
            'confidence' => $confidence,
            'reason' => $reason,
            'device_type' => $deviceType,
        ];
    }
}
