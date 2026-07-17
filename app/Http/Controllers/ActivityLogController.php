<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\User;
use App\Services\ActivityLogService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Activity Log (Fase 11 — PRD 5.13.F). Owner only (route group).
 * Append-only: halaman ini murni baca; tidak ada route ubah/hapus.
 */
class ActivityLogController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $role = $request->query('role');
        $module = $request->query('module');
        $dateFrom = $this->parseDate($request->query('date_from'));
        $dateTo = $this->parseDate($request->query('date_to'));

        $logs = ActivityLog::query()
            ->with(['user' => fn ($query) => $query->withTrashed()->select('id', 'name')])
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('activity', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhereHas('user', function ($query) use ($search) {
                            $query->withTrashed()->where('name', 'like', "%{$search}%");
                        });
                });
            })
            ->when(
                in_array($role, User::ROLES, true),
                fn ($query) => $query->where('role', $role),
            )
            ->when(
                in_array($module, ActivityLogService::MODULES, true),
                fn ($query) => $query->where('module', $module),
            )
            ->when($dateFrom !== null, fn ($query) => $query
                ->whereDate('created_at', '>=', $dateFrom->toDateString()))
            ->when($dateTo !== null, fn ($query) => $query
                ->whereDate('created_at', '<=', $dateTo->toDateString()))
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (ActivityLog $log) => [
                'id' => $log->id,
                'time' => $log->created_at->toIso8601String(),
                'user' => $log->user->name,
                'role' => $log->role,
                'module' => $log->module,
                'activity' => $log->activity,
                'description' => $log->description,
                'ip_address' => $log->ip_address,
                'user_agent' => $log->user_agent,
            ]);

        return Inertia::render('ActivityLog/Index', [
            'logs' => $logs,
            'filters' => [
                'search' => $search,
                'role' => in_array($role, User::ROLES, true) ? $role : null,
                'module' => in_array($module, ActivityLogService::MODULES, true) ? $module : null,
                'date_from' => $dateFrom?->toDateString() ?? '',
                'date_to' => $dateTo?->toDateString() ?? '',
            ],
            'modules' => ActivityLogService::MODULES,
            'roles' => User::ROLES,
        ]);
    }

    private function parseDate(?string $value): ?CarbonImmutable
    {
        return rescue(
            fn () => $value !== null && $value !== ''
                ? CarbonImmutable::parse($value)
                : null,
            null,
            report: false,
        );
    }
}
