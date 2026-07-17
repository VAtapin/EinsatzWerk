<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'organization' => ['required', 'string', 'max:80'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ]);

        $organization = Organization::query()
            ->where('status', 'active')
            ->where(function ($query) use ($credentials): void {
                $query
                    ->whereKey($credentials['organization'])
                    ->orWhere('slug', $credentials['organization']);
            })
            ->first();

        $user = $organization
            ? User::query()
                ->where('organization_id', $organization->id)
                ->where('email', mb_strtolower($credentials['email']))
                ->where('status', 'active')
                ->first()
            : null;

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Die Anmeldedaten sind nicht korrekt.'],
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $token = $user->createToken(
            $credentials['device_name'] ?? 'EinsatzWerk Web',
            $this->abilitiesFor($user),
        );

        return response()->json([
            'token' => $token->plainTextToken,
            'user' => $this->userPayload($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->userPayload($request->user()),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Abgemeldet.']);
    }

    /**
     * @return array<int, string>
     */
    private function abilitiesFor(User $user): array
    {
        return match ($user->role_code) {
            'technician' => ['technician'],
            'dispatcher', 'office_admin' => ['office'],
            default => [],
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'organization_id' => $user->organization_id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role_code,
            'landing_path' => $user->role_code === 'technician'
                ? '/technician/today'
                : '/office/call-intake',
        ];
    }
}
