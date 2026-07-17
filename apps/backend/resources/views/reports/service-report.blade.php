<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "DejaVu Sans", sans-serif; color: #10213d; font-size: 11px; }
        h1 { font-size: 22px; margin: 0; } h2 { font-size: 13px; margin: 20px 0 7px; color: #f05a0a; }
        .header { border-bottom: 3px solid #f05a0a; padding-bottom: 14px; }
        .meta { width: 100%; margin-top: 15px; } .meta td { width: 50%; vertical-align: top; padding: 4px 10px 4px 0; }
        .box { border: 1px solid #dce3ec; padding: 10px; min-height: 35px; }
        table.parts { width: 100%; border-collapse: collapse; } .parts th,.parts td { border-bottom: 1px solid #dce3ec; padding: 6px; text-align: left; }
        .signature { height: 85px; max-width: 260px; } .footer { position: fixed; bottom: 0; color: #64748b; }
    </style>
</head>
<body>
<div class="header">
    <h1>EinsatzWerk · Servicebericht</h1>
    <div>Auftrag {{ $order->order_number }} · Einsatz {{ $visit->visit_number }}</div>
</div>
<table class="meta">
    <tr>
        <td><strong>Kunde</strong><br>{{ trim($customer->first_name.' '.$customer->last_name) }}<br>{{ $customer->primary_phone }}</td>
        <td><strong>Serviceadresse</strong><br>{{ $location->street }} {{ $location->house_number }}<br>{{ $location->postal_code }} {{ $location->city }}</td>
    </tr>
    <tr>
        <td><strong>Techniker</strong><br>{{ $visit->technician?->name }}</td>
        <td><strong>Arbeitszeit</strong><br>{{ $visit->actual_start_at?->format('d.m.Y H:i') }} – {{ $visit->actual_end_at?->format('H:i') }}</td>
    </tr>
</table>
<h2>Fehlerbeschreibung</h2><div class="box">{{ $order->fault_description }}</div>
<h2>Diagnose</h2><div class="box">{{ $visit->diagnosis ?: '—' }}</div>
<h2>Ausgeführte Arbeiten</h2><div class="box">{{ $visit->work_performed }}</div>
<h2>Verwendete Teile</h2>
<table class="parts"><thead><tr><th>Bezeichnung</th><th>Menge</th></tr></thead><tbody>
@forelse($visit->usedParts as $part)<tr><td>{{ $part->description }}</td><td>{{ (float) $part->quantity }}</td></tr>@empty<tr><td colspan="2">Keine Teile erfasst</td></tr>@endforelse
</tbody></table>
<h2>Kundenbestätigung</h2>
@if($signatureData)<img class="signature" src="{{ $signatureData }}"><br>{{ $signatureName }}@else Keine Unterschrift erfasst @endif
<div class="footer">Erstellt am {{ now()->format('d.m.Y H:i') }} · Einsatz-Werk.de</div>
</body>
</html>
