<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Profil Saya (Fase 11) — semua role. User hanya bisa mengubah
     * nama, username, password, dan foto miliknya sendiri; role &
     * status tidak pernah bisa diubah dari sini.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('Profile/Edit', [
            'profile' => [
                'name' => $request->user()->name,
                'username' => $request->user()->username,
                'role' => $request->user()->role,
                'photo_url' => $request->user()->photoUrl(),
            ],
        ]);
    }

    /** Update nama/username/foto — foto baru menghapus file lama. */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();

        $payload = [
            'name' => $data['name'],
            'username' => $data['username'],
        ];

        if ($request->hasFile('photo')) {
            $payload['photo'] = $request->file('photo')->store('users', 'public');

            if ($user->photo !== null && $user->photo !== $payload['photo']) {
                Storage::disk('public')->delete($user->photo);
            }
        }

        $user->update($payload);

        return back()->with('success', 'Profil berhasil diperbarui.');
    }

    /** Ubah password sendiri — wajib memasukkan password saat ini. */
    public function updatePassword(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'current_password.required' => 'Password saat ini wajib diisi.',
            'current_password.current_password' => 'Password saat ini salah.',
            'password.min' => 'Password baru minimal 8 karakter.',
            'password.confirmed' => 'Konfirmasi password tidak cocok.',
        ]);

        $request->user()->update(['password' => $validated['password']]);

        return back()->with('success', 'Password berhasil diubah.');
    }
}
