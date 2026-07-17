<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerDocumentController extends Controller
{
    public function store(Request $request, string $customer): JsonResponse
    {
        $organizationId = $request->user()->organization_id;
        Customer::query()
            ->where('organization_id', $organizationId)
            ->findOrFail($customer);
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:10240'],
            'type' => ['nullable', 'string', 'max:64'],
        ]);
        $file = $validated['file'];
        $filename = Str::ulid().'.'.$file->getClientOriginalExtension();
        $path = $file->storeAs(
            "customer-documents/{$organizationId}/{$customer}",
            $filename,
            'local',
        );
        $document = CustomerDocument::query()->create([
            'organization_id' => $organizationId,
            'customer_id' => $customer,
            'uploaded_by' => $request->user()->id,
            'name' => $file->getClientOriginalName(),
            'type' => $validated['type'] ?? 'attachment',
            'disk' => 'local',
            'path' => $path,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
        ]);

        return response()->json(['data' => $document], 201);
    }

    public function download(
        Request $request,
        string $customer,
        string $document,
    ): StreamedResponse {
        $document = CustomerDocument::query()
            ->where('organization_id', $request->user()->organization_id)
            ->where('customer_id', $customer)
            ->findOrFail($document);

        return Storage::disk($document->disk)->download($document->path, $document->name);
    }
}
