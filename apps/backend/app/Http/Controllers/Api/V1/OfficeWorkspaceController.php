<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\CommercialDocument;
use App\Models\Customer;
use App\Models\Organization;
use App\Models\Product;
use App\Models\ServiceArea;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Models\VisitDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OfficeWorkspaceController extends Controller
{
    public function analytics(Request $request): JsonResponse
    {
        $organizationId = $request->user()->organization_id;
        $statusCounts = ServiceOrder::query()
            ->where('organization_id', $organizationId)
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');
        $dailyOrders = ServiceOrder::query()
            ->where('organization_id', $organizationId)
            ->where('created_at', '>=', now()->subDays(13)->startOfDay())
            ->selectRaw('DATE(created_at) as day, count(*) as total')
            ->groupByRaw('DATE(created_at)')
            ->orderBy('day')
            ->get();
        $topProblems = ServiceOrder::query()
            ->where('organization_id', $organizationId)
            ->whereNotNull('fault_category')
            ->select('fault_category', DB::raw('count(*) as total'))
            ->groupBy('fault_category')
            ->orderByDesc('total')
            ->limit(8)
            ->get();
        $technicians = User::query()
            ->where('organization_id', $organizationId)
            ->where('role_code', 'technician')
            ->withCount([
                'assignedVisits as visits_today' => fn ($builder) => $builder->whereDate('planned_date', today()),
                'assignedVisits as visits_open' => fn ($builder) => $builder->whereNotIn('status', ['completed', 'cancelled']),
            ])
            ->orderBy('name')
            ->get(['id', 'name', 'status']);

        return response()->json(['data' => [
            'summary' => [
                'orders' => (int) $statusCounts->sum(),
                'completed' => (int) ($statusCounts['completed'] ?? 0),
                'active' => (int) collect($statusCounts)->except(['completed', 'cancelled'])->sum(),
                'awaiting_parts' => (int) ($statusCounts['awaiting_parts'] ?? 0),
                'customers' => Customer::query()->where('organization_id', $organizationId)->count(),
                'assets' => Asset::query()->where('organization_id', $organizationId)->count(),
                'products' => Product::query()->where('organization_id', $organizationId)->count(),
                'technicians' => $technicians->count(),
            ],
            'status_counts' => $statusCounts,
            'daily_orders' => $dailyOrders,
            'top_problems' => $topProblems,
            'technicians' => $technicians,
        ]]);
    }

    public function assets(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'in:active,inactive'],
        ]);
        $query = trim((string) ($validated['q'] ?? ''));
        $assets = Asset::query()
            ->where('organization_id', $request->user()->organization_id)
            ->when($validated['status'] ?? null, fn ($builder, $status) => $builder->where('status', $status))
            ->when($query !== '', function ($builder) use ($query): void {
                $like = "%{$query}%";
                $builder->where(fn ($builder) => $builder
                    ->whereLike('model', $like)
                    ->orWhereLike('serial_number', $like)
                    ->orWhereLike('production_number', $like)
                    ->orWhereLike('legacy_article_id', $like)
                    ->orWhereHas('customer', fn ($customer) => $customer
                        ->whereLike('first_name', $like)
                        ->orWhereLike('last_name', $like)
                        ->orWhereLike('company_name', $like)));
            })
            ->with(['customer', 'serviceLocation', 'manufacturer'])
            ->latest()
            ->limit(100)
            ->get();

        return response()->json(['data' => $assets]);
    }

    public function technicians(Request $request): JsonResponse
    {
        $organizationId = $request->user()->organization_id;
        $technicians = User::query()
            ->where('organization_id', $organizationId)
            ->where('role_code', 'technician')
            ->with([
                'assignedVisits' => fn ($builder) => $builder
                    ->whereDate('planned_date', today())
                    ->with(['serviceOrder.customer', 'serviceOrder.serviceLocation'])
                    ->orderBy('planned_start_at'),
            ])
            ->withCount([
                'assignedVisits as visits_total',
                'assignedVisits as visits_open' => fn ($builder) => $builder->whereNotIn('status', ['completed', 'cancelled']),
                'assignedVisits as visits_today' => fn ($builder) => $builder->whereDate('planned_date', today()),
            ])
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $technicians]);
    }

    public function serviceAreas(Request $request): JsonResponse
    {
        return response()->json(['data' => ServiceArea::query()
            ->where('organization_id', $request->user()->organization_id)
            ->with(['postalCodes' => fn ($builder) => $builder->orderBy('postal_code')])
            ->withCount('postalCodes')
            ->orderBy('name')
            ->get()]);
    }

    public function documents(Request $request): JsonResponse
    {
        $organizationId = $request->user()->organization_id;

        return response()->json(['data' => [
            'commercial' => CommercialDocument::query()
                ->where('organization_id', $organizationId)
                ->with('customer:id,first_name,last_name,company_name')
                ->withCount('lines')
                ->latest('document_date')
                ->limit(100)
                ->get(),
            'service' => VisitDocument::query()
                ->where('organization_id', $organizationId)
                ->with(['visit.serviceOrder.customer', 'visit.technician:id,name'])
                ->latest()
                ->limit(100)
                ->get(),
        ]]);
    }

    public function settings(Request $request): JsonResponse
    {
        return response()->json(['data' => Organization::query()
            ->whereKey($request->user()->organization_id)
            ->firstOrFail()]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'legal_name' => ['nullable', 'string', 'max:255'],
            'timezone' => ['required', 'timezone'],
            'locale' => ['required', 'string', 'in:de,en'],
            'currency' => ['required', 'string', 'size:3'],
            'settings' => ['nullable', 'array'],
        ]);
        $organization = Organization::query()
            ->whereKey($request->user()->organization_id)
            ->firstOrFail();
        $organization->update($validated);

        return response()->json(['data' => $organization->fresh()]);
    }
}
