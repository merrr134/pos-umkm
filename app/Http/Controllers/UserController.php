<?php

namespace App\Http\Controllers;

use App\Http\Requests\UserRequest;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    /**
     * Manajemen Pengguna (Fase 11 — PRD 5.13.D). Owner full access,
     * Admin view only (route + UserPolicy). Tidak ada hapus permanen —
     * user dinonaktifkan (PRD Bab 3). Password/hash tidak pernah
     * dikirim ke frontend.
     */
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', User::class);

        $search = trim((string) $request->query('search', ''));
        $role = $request->query('role');
        $status = $request->query('status');

        $users = User::query()
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('username', 'like', "%{$search}%");
                });
            })
            ->when(
                in_array($role, User::ROLES, true),
                fn ($query) => $query->where('role', $role),
            )
            ->when(
                in_array($status, ['aktif', 'nonaktif'], true),
                fn ($query) => $query->where('is_active', $status === 'aktif'),
            )
            ->orderBy('name')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'role' => $user->role,
                'is_active' => $user->is_active,
                'photo_url' => $user->photoUrl(),
                'last_login_at' => $user->last_login_at?->toIso8601String(),
                'last_login_ip' => $user->last_login_ip,
            ]);

        return Inertia::render('Users/Index', [
            'users' => $users,
            'filters' => [
                'search' => $search,
                'role' => in_array($role, User::ROLES, true) ? $role : null,
                'status' => in_array($status, ['aktif', 'nonaktif'], true) ? $status : null,
            ],
            'roles' => User::ROLES,
            'stats' => [
                'total' => User::count(),
                'aktif' => User::where('is_active', true)->count(),
                'nonaktif' => User::where('is_active', false)->count(),
                'total_role' => count(User::ROLES),
            ],
            'can' => [
                'manage' => $request->user()->can('create', User::class),
            ],
        ]);
    }

    /** Tambah user — hanya Owner. */
    public function store(UserRequest $request): RedirectResponse
    {
        Gate::authorize('create', User::class);

        $data = $request->validated();

        User::create([
            'name' => $data['name'],
            'username' => $data['username'],
            'password' => $data['password'], // di-hash oleh cast 'hashed'
            'role' => $data['role'],
            'is_active' => $data['is_active'],
            'photo' => $request->hasFile('photo')
                ? $request->file('photo')->store('users', 'public')
                : null,
        ]);

        app(ActivityLogService::class)->log(
            ActivityLogService::MODULE_USER,
            'Tambah User',
            "Menambahkan user {$data['name']} (role {$data['role']})",
        );

        return back()->with('success', "Pengguna {$data['name']} berhasil ditambahkan.");
    }

    /**
     * Edit user — hanya Owner. Password kosong = tidak diganti.
     * Foto baru menggantikan file lama (file lama dihapus).
     */
    public function update(UserRequest $request, User $user): RedirectResponse
    {
        Gate::authorize('update', $user);

        $data = $request->validated();

        $this->guardAgainstLockout(
            $request,
            $user,
            (bool) $data['is_active'],
            $data['role'],
        );

        $payload = [
            'name' => $data['name'],
            'username' => $data['username'],
            'role' => $data['role'],
            'is_active' => $data['is_active'],
        ];

        if (($data['password'] ?? null) !== null && $data['password'] !== '') {
            $payload['password'] = $data['password'];
        }

        if ($request->hasFile('photo')) {
            $payload['photo'] = $request->file('photo')->store('users', 'public');

            if ($user->photo !== null && $user->photo !== $payload['photo']) {
                Storage::disk('public')->delete($user->photo);
            }
        }

        $user->update($payload);

        app(ActivityLogService::class)->log(
            ActivityLogService::MODULE_USER,
            'Edit User',
            "Mengubah user {$user->name}",
        );

        return back()->with('success', 'Pengguna berhasil diperbarui.');
    }

    /** Aktifkan/nonaktifkan user — hanya Owner, dengan guard PRD. */
    public function toggleStatus(Request $request, User $user): RedirectResponse
    {
        Gate::authorize('update', $user);

        $newActive = ! $user->is_active;

        $this->guardAgainstLockout($request, $user, $newActive, $user->role);

        $user->update(['is_active' => $newActive]);

        app(ActivityLogService::class)->log(
            ActivityLogService::MODULE_USER,
            'Edit User',
            ($newActive ? 'Mengaktifkan' : 'Menonaktifkan')." user {$user->name}",
        );

        return back()->with('success', $newActive
            ? "Pengguna {$user->name} diaktifkan."
            : "Pengguna {$user->name} dinonaktifkan.");
    }

    /**
     * Reset password — hanya Owner. Password baru acak 10 karakter,
     * di-hash sebelum disimpan, dan hanya ditampilkan SEKALI lewat
     * flash (tidak pernah disimpan/di-log dalam bentuk plaintext).
     */
    public function resetPassword(Request $request, User $user): RedirectResponse
    {
        Gate::authorize('resetPassword', $user);

        $newPassword = Str::random(10);

        $user->update(['password' => Hash::make($newPassword)]);

        app(ActivityLogService::class)->log(
            ActivityLogService::MODULE_USER,
            'Reset Password',
            "Mereset password user {$user->name}",
        );

        return back()
            ->with('success', "Password {$user->name} berhasil direset.")
            ->with('new_password', $newPassword);
    }

    /**
     * Guard PRD Bab 3 & 5.13.D: tidak bisa menonaktifkan akun sendiri;
     * Owner aktif terakhir tidak bisa dinonaktifkan atau diganti role.
     */
    private function guardAgainstLockout(
        Request $request,
        User $target,
        bool $newActive,
        string $newRole,
    ): void {
        if (! $newActive && $target->id === $request->user()->id) {
            throw ValidationException::withMessages([
                'is_active' => 'Anda tidak dapat menonaktifkan akun sendiri.',
            ]);
        }

        if ($target->isLastActiveOwner() && (! $newActive || $newRole !== User::ROLE_OWNER)) {
            throw ValidationException::withMessages([
                'is_active' => 'Owner terakhir tidak dapat dinonaktifkan atau diganti role-nya.',
            ]);
        }
    }
}
