<?php

namespace App\Services;

use App\Models\Visit;
use App\Models\VisitDocument;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Facades\Storage;

class ServiceReportGenerator
{
    public function generate(Visit $visit): VisitDocument
    {
        $visit->loadMissing([
            'serviceOrder.customer',
            'serviceOrder.serviceLocation',
            'serviceOrder.asset',
            'technician',
            'usedParts',
            'documents',
        ]);
        $signature = $visit->documents->firstWhere('type', 'signature');
        $signatureData = $signature && Storage::disk($signature->disk)->exists($signature->path)
            ? 'data:'.$signature->mime_type.';base64,'.base64_encode(
                Storage::disk($signature->disk)->get($signature->path),
            )
            : null;
        $options = new Options;
        $options->set('defaultFont', 'DejaVu Sans');
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml(view('reports.service-report', [
            'visit' => $visit,
            'order' => $visit->serviceOrder,
            'customer' => $visit->serviceOrder->customer,
            'location' => $visit->serviceOrder->serviceLocation,
            'signatureData' => $signatureData,
            'signatureName' => $signature?->metadata['signer_name'] ?? null,
        ])->render());
        $dompdf->setPaper('A4');
        $dompdf->render();

        $path = "organizations/{$visit->organization_id}/visits/{$visit->id}/servicebericht.pdf";
        Storage::disk('local')->put($path, $dompdf->output());

        return VisitDocument::query()->updateOrCreate(
            ['visit_id' => $visit->id, 'type' => 'service_report'],
            [
                'organization_id' => $visit->organization_id,
                'disk' => 'local',
                'path' => $path,
                'original_name' => "Servicebericht-{$visit->serviceOrder->order_number}.pdf",
                'mime_type' => 'application/pdf',
                'size' => Storage::disk('local')->size($path),
                'created_by' => $visit->technician_id,
                'metadata' => ['generated_at' => now()->toIso8601String()],
            ],
        );
    }
}
