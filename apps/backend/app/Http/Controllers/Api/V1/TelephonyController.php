<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TelephonyCall;
use App\Models\TelephonyIntegration;
use App\Telephony\TelephonyAdapterManager;
use App\Telephony\TelephonyCallPresenter;
use App\Telephony\TelephonyIngestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TelephonyController extends Controller
{
    public function integrations(Request $request): JsonResponse
    {
        return response()->json([
            'data' => TelephonyIntegration::query()
                ->where('organization_id', $request->user()->organization_id)
                ->withCount('calls')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function storeIntegration(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'provider' => ['required', Rule::in(['3cx', 'placetel', 'generic'])],
            'name' => ['required', 'string', 'max:255'],
            'enabled' => ['sometimes', 'boolean'],
            'settings' => ['nullable', 'array'],
        ]);
        [$integration, $key] = $this->createIntegration(
            $request->user()->organization_id,
            $validated,
        );

        return response()->json([
            'data' => $integration,
            'credentials' => $this->credentials($integration, $key),
        ], 201);
    }

    public function updateIntegration(
        Request $request,
        string $telephonyIntegration,
    ): JsonResponse {
        $integration = $this->ownedIntegration($request, $telephonyIntegration);
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'enabled' => ['sometimes', 'boolean'],
            'settings' => ['nullable', 'array'],
        ]);
        $integration->update($validated);

        return response()->json(['data' => $integration->fresh()]);
    }

    public function rotateIntegrationKey(
        Request $request,
        string $telephonyIntegration,
    ): JsonResponse {
        $integration = $this->ownedIntegration($request, $telephonyIntegration);
        $key = Str::random(64);
        $integration->update(['webhook_key_hash' => hash('sha256', $key)]);

        return response()->json([
            'data' => $integration->fresh(),
            'credentials' => $this->credentials($integration, $key),
        ]);
    }

    public function calls(
        Request $request,
        TelephonyCallPresenter $presenter,
    ): JsonResponse {
        $validated = $request->validate([
            'after' => ['nullable', 'date'],
            'active' => ['nullable', 'boolean'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $calls = TelephonyCall::query()
            ->where('organization_id', $request->user()->organization_id)
            ->when(
                $validated['after'] ?? null,
                fn ($builder, $after) => $builder->where('updated_at', '>', $after),
            )
            ->when(
                $validated['active'] ?? false,
                fn ($builder) => $builder->whereIn('status', ['ringing', 'accepted']),
            )
            ->with([
                'customer.serviceLocations',
                'customer.assets.manufacturer',
                'customer.serviceOrders',
                'integration:id,name,provider',
                'acknowledgedBy:id,name',
            ])
            ->latest('updated_at')
            ->limit($validated['limit'] ?? 50)
            ->get();

        return response()->json([
            'data' => $calls->map(fn (TelephonyCall $call) => $presenter->present($call)),
            'meta' => ['server_time' => now()->toISOString()],
        ]);
    }

    public function acknowledge(
        Request $request,
        string $telephonyCall,
        TelephonyCallPresenter $presenter,
    ): JsonResponse {
        $call = TelephonyCall::query()
            ->where('organization_id', $request->user()->organization_id)
            ->findOrFail($telephonyCall);
        $call->update([
            'acknowledged_at' => now(),
            'acknowledged_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $presenter->present($call->fresh())]);
    }

    public function simulate(
        Request $request,
        TelephonyAdapterManager $adapters,
        TelephonyIngestService $ingest,
        TelephonyCallPresenter $presenter,
    ): JsonResponse {
        $validated = $request->validate([
            'integration_id' => ['required', 'string'],
            'event' => ['required', 'string', 'max:64'],
            'call_id' => ['nullable', 'string', 'max:191'],
            'from' => ['required', 'string', 'max:255'],
            'to' => ['nullable', 'string', 'max:255'],
            'caller_name' => ['nullable', 'string', 'max:255'],
            'duration' => ['nullable', 'integer', 'min:0'],
        ]);
        $integration = $this->ownedIntegration($request, $validated['integration_id']);
        $payload = [
            ...$validated,
            'call_id' => $validated['call_id'] ?? 'simulated-'.Str::ulid(),
            'occurred_at' => now()->toISOString(),
        ];
        $call = $ingest->ingest(
            $integration,
            $adapters->for($integration->provider)->normalize($payload),
        );

        return response()->json(['data' => $presenter->present($call)], 201);
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array{TelephonyIntegration, string}
     */
    private function createIntegration(string $organizationId, array $values): array
    {
        $key = Str::random(64);
        $integration = TelephonyIntegration::query()->create([
            ...$values,
            'organization_id' => $organizationId,
            'provider' => strtolower($values['provider']),
            'webhook_key_hash' => hash('sha256', $key),
        ]);

        return [$integration, $key];
    }

    /**
     * @return array<string, mixed>
     */
    private function credentials(TelephonyIntegration $integration, string $key): array
    {
        $api = rtrim((string) config('app.url'), '/').'/api/v1';
        $base = "{$api}/telephony/{$integration->provider}/{$key}";

        return [
            'key' => $key,
            'contact_lookup_url' => "{$base}/contacts?phone=[Number]",
            'event_webhook_url' => "{$base}/events",
            'placetel_subscription' => $integration->provider === 'placetel' ? [
                'service' => 'einsatzwerk',
                'url' => "{$base}/events",
                'incoming' => true,
                'outgoing' => true,
                'accepted' => true,
                'hungup' => true,
                'phone' => true,
            ] : null,
        ];
    }

    private function ownedIntegration(
        Request $request,
        string $id,
    ): TelephonyIntegration {
        return TelephonyIntegration::query()
            ->where('organization_id', $request->user()->organization_id)
            ->findOrFail($id);
    }
}
