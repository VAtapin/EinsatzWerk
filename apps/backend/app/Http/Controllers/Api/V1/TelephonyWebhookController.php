<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TelephonyIntegration;
use App\Telephony\PhoneNumberMatcher;
use App\Telephony\TelephonyAdapterManager;
use App\Telephony\TelephonyCallPresenter;
use App\Telephony\TelephonyIngestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TelephonyWebhookController extends Controller
{
    public function contacts(
        Request $request,
        string $provider,
        string $key,
        PhoneNumberMatcher $matcher,
        TelephonyCallPresenter $presenter,
    ): JsonResponse {
        $integration = $this->integration($provider, $key);
        $validated = $request->validate([
            'phone' => ['nullable', 'string', 'max:255', 'required_without:number'],
            'number' => ['nullable', 'string', 'max:255', 'required_without:phone'],
        ]);
        $phone = $validated['phone'] ?? $validated['number'];
        $frontend = rtrim((string) config('services.frontend.url'), '/');
        $contacts = $matcher
            ->find($integration->organization_id, $phone)
            ->map(function (array $match) use ($phone, $frontend, $presenter): array {
                $customer = $match['customer'];
                $payload = $presenter->customer($customer);

                return [
                    'id' => $customer->id,
                    'entity_id' => $customer->id,
                    'entity_type' => 'customer',
                    'first_name' => $customer->first_name,
                    'last_name' => $customer->last_name,
                    'company_name' => $customer->company_name,
                    'email' => $customer->email,
                    'email_for_3cx' => $customer->email
                        ?: "unknown+{$customer->id}@einsatz-werk.invalid",
                    'business_phone' => $customer->primary_phone,
                    'business_phone_2' => $customer->secondary_phone,
                    'contact_url' => $frontend.'/office/call-intake?'.http_build_query([
                        'customer' => $customer->id,
                        'phone' => $phone,
                        'source' => 'telephony',
                    ]),
                    'customer' => $payload,
                    'matched_by' => $match['matched_by'],
                ];
            });

        return response()->json([
            'data' => $contacts,
            'meta' => [
                'provider' => $provider,
                'matches' => $contacts->count(),
            ],
        ]);
    }

    public function events(
        Request $request,
        string $provider,
        string $key,
        TelephonyAdapterManager $adapters,
        TelephonyIngestService $ingest,
        TelephonyCallPresenter $presenter,
    ): JsonResponse {
        $integration = $this->integration($provider, $key);
        $payload = [...$request->query(), ...$request->all()];
        if ($payload === []) {
            $decoded = json_decode($request->getContent(), true);
            $payload = is_array($decoded) ? $decoded : [];
        }
        $call = $ingest->ingest(
            $integration,
            $adapters->for($provider)->normalize($payload),
        );

        return response()->json([
            'data' => $presenter->present($call),
            'message' => 'Telephony event accepted.',
        ]);
    }

    private function integration(string $provider, string $key): TelephonyIntegration
    {
        abort_unless(
            preg_match('/^[A-Za-z0-9]{40,128}$/', $key) === 1,
            404,
        );

        return TelephonyIntegration::query()
            ->where('provider', strtolower($provider))
            ->where('webhook_key_hash', hash('sha256', $key))
            ->where('enabled', true)
            ->firstOrFail();
    }
}
