<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MessageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'after' => ['nullable', 'date'],
            'unread' => ['nullable', 'boolean'],
            'requires_ack' => ['nullable', 'boolean'],
            'service_order_id' => ['nullable', 'string'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);
        $messages = Message::query()
            ->where('organization_id', $user->organization_id)
            ->where(fn ($builder) => $builder
                ->where('sender_id', $user->id)
                ->orWhere('recipient_id', $user->id)
                ->orWhereNull('recipient_id'))
            ->when(
                $validated['after'] ?? null,
                fn ($builder, $after) => $builder->where('updated_at', '>', $after),
            )
            ->when(
                $validated['unread'] ?? false,
                fn ($builder) => $builder
                    ->where(fn ($builder) => $builder
                        ->where('recipient_id', $user->id)
                        ->orWhereNull('recipient_id'))
                    ->where('sender_id', '!=', $user->id)
                    ->whereNull('read_at'),
            )
            ->when(
                $validated['requires_ack'] ?? false,
                fn ($builder) => $builder
                    ->where('requires_ack', true)
                    ->whereNull('acknowledged_at'),
            )
            ->when(
                $validated['service_order_id'] ?? null,
                fn ($builder, $order) => $builder->where('service_order_id', $order),
            )
            ->with([
                'sender:id,name,role_code',
                'recipient:id,name,role_code',
                'serviceOrder:id,order_number',
                'visit:id,service_order_id,planned_start_at,planned_end_at',
                'acknowledgedBy:id,name',
                'attachments',
            ])
            ->latest()
            ->limit($validated['limit'] ?? 100)
            ->get();
        Message::query()
            ->whereIn('id', $messages
                ->where('sender_id', '!=', $user->id)
                ->whereNull('delivered_at')
                ->pluck('id'))
            ->update(['delivered_at' => now()]);

        return response()->json([
            'data' => $messages,
            'meta' => [
                'server_time' => now()->toISOString(),
                'unread' => Message::query()
                    ->where('organization_id', $user->organization_id)
                    ->where('recipient_id', $user->id)
                    ->where('sender_id', '!=', $user->id)
                    ->whereNull('read_at')
                    ->count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $organizationId = $request->user()->organization_id;
        $validated = $request->validate([
            'recipient_id' => [
                'nullable',
                Rule::exists('users', 'id')->where('organization_id', $organizationId),
            ],
            'service_order_id' => [
                'nullable',
                Rule::exists('service_orders', 'id')->where('organization_id', $organizationId),
            ],
            'visit_id' => [
                'nullable',
                Rule::exists('visits', 'id')->where('organization_id', $organizationId),
            ],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:10000'],
            'severity' => ['nullable', Rule::in(['normal', 'high', 'urgent'])],
            'requires_ack' => ['nullable', 'boolean'],
        ]);
        $requiresAck = (bool) ($validated['requires_ack'] ?? false);
        if ($requiresAck) {
            abort_unless($validated['recipient_id'] ?? null, 422);
            $recipient = User::query()
                ->where('organization_id', $organizationId)
                ->findOrFail($validated['recipient_id']);
            abort_unless($recipient->role_code === 'technician', 422);
        }
        $message = Message::query()->create([
            ...$validated,
            'organization_id' => $organizationId,
            'sender_id' => $request->user()->id,
            'type' => 'user',
            'severity' => $validated['severity'] ?? 'normal',
            'requires_ack' => $requiresAck,
        ]);

        return response()->json(['data' => $message->load([
            'sender:id,name,role_code',
            'recipient:id,name,role_code',
            'serviceOrder:id,order_number',
            'visit:id,service_order_id',
            'attachments',
        ])], 201);
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

    public function acknowledge(Request $request, string $message): JsonResponse
    {
        $message = Message::query()
            ->where('organization_id', $request->user()->organization_id)
            ->where('recipient_id', $request->user()->id)
            ->where('requires_ack', true)
            ->findOrFail($message);
        $message->update([
            'read_at' => $message->read_at ?? now(),
            'acknowledged_at' => $message->acknowledged_at ?? now(),
            'acknowledged_by' => $request->user()->id,
        ]);

        return response()->json([
            'data' => $message->fresh()->load('acknowledgedBy:id,name'),
        ]);
    }

    public function attach(Request $request, string $message): JsonResponse
    {
        $message = $this->accessibleMessage($request, $message);
        abort_unless($message->sender_id === $request->user()->id, 403);
        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'max:20480',
                'mimes:jpg,jpeg,png,webp,pdf,doc,docx,xls,xlsx,txt',
            ],
        ]);
        $file = $validated['file'];
        $path = $file->store(
            "organizations/{$message->organization_id}/messages/{$message->id}",
            'local',
        );
        $attachment = $message->attachments()->create([
            'organization_id' => $message->organization_id,
            'uploaded_by' => $request->user()->id,
            'disk' => 'local',
            'path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
            'size' => $file->getSize(),
            'created_at' => now(),
        ]);

        return response()->json(['data' => $attachment], 201);
    }

    public function attachment(
        Request $request,
        string $message,
        string $attachment,
    ): StreamedResponse {
        $message = $this->accessibleMessage($request, $message);
        $file = $message->attachments()->findOrFail($attachment);

        return Storage::disk($file->disk)->download(
            $file->path,
            $file->original_name,
            ['Content-Type' => $file->mime_type],
        );
    }

    private function accessibleMessage(Request $request, string $id): Message
    {
        return Message::query()
            ->where('organization_id', $request->user()->organization_id)
            ->where(fn ($builder) => $builder
                ->where('sender_id', $request->user()->id)
                ->orWhere('recipient_id', $request->user()->id)
                ->orWhereNull('recipient_id'))
            ->findOrFail($id);
    }
}
