<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MessageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $messages = Message::query()
            ->where('organization_id', $user->organization_id)
            ->where(fn ($builder) => $builder
                ->where('sender_id', $user->id)
                ->orWhere('recipient_id', $user->id)
                ->orWhereNull('recipient_id'))
            ->with(['sender:id,name', 'recipient:id,name'])
            ->latest()
            ->limit(100)
            ->get();

        return response()->json(['data' => $messages]);
    }

    public function store(Request $request): JsonResponse
    {
        $organizationId = $request->user()->organization_id;
        $validated = $request->validate([
            'recipient_id' => [
                'nullable',
                Rule::exists('users', 'id')->where('organization_id', $organizationId),
            ],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:10000'],
        ]);
        $message = Message::query()->create([
            ...$validated,
            'organization_id' => $organizationId,
            'sender_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $message->load(['sender:id,name', 'recipient:id,name'])], 201);
    }

    public function read(Request $request, string $message): JsonResponse
    {
        $message = Message::query()
            ->where('organization_id', $request->user()->organization_id)
            ->where(fn ($builder) => $builder
                ->where('recipient_id', $request->user()->id)
                ->orWhereNull('recipient_id'))
            ->findOrFail($message);
        $message->update(['read_at' => now()]);

        return response()->json(['data' => $message]);
    }
}
