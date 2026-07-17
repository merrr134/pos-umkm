<?php

namespace App\Http\Controllers;

use App\Services\ActivityLogService;
use App\Services\BackupService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Backup & Restore Database (Fase 11 — PRD 5.13.E). Owner only
 * (route group). Restore selalu didahului backup otomatis (PRD
 * Bab 17) dan tidak pernah menghapus file backup lama.
 */
class BackupController extends Controller
{
    public function __construct(
        private readonly BackupService $backups,
        private readonly ActivityLogService $activityLog,
    ) {}

    public function index(Request $request): Response
    {
        $files = $this->backups->list();
        $page = max(1, (int) $request->query('page', '1'));
        $perPage = 10;

        return Inertia::render('Backup/Index', [
            'backups' => new LengthAwarePaginator(
                array_slice($files, ($page - 1) * $perPage, $perPage),
                count($files),
                $perPage,
                $page,
                ['path' => $request->url()],
            ),
        ]);
    }

    /** Backup manual — file `backup-YYYYMMDD-HHmmss.sql`. */
    public function store(): RedirectResponse
    {
        $name = $this->backups->create();

        $this->activityLog->log(
            ActivityLogService::MODULE_BACKUP,
            'Backup Database',
            "Membuat backup {$name}",
        );

        return back()->with('success', "Backup {$name} berhasil dibuat.");
    }

    public function download(string $file): StreamedResponse
    {
        abort_unless(
            $this->backups->isValidName($file) && $this->backups->disk()->exists($file),
            404,
        );

        return $this->backups->disk()->download($file);
    }

    public function destroy(string $file): RedirectResponse
    {
        abort_unless(
            $this->backups->isValidName($file) && $this->backups->disk()->exists($file),
            404,
        );

        $this->backups->disk()->delete($file);

        $this->activityLog->log(
            ActivityLogService::MODULE_BACKUP,
            'Hapus Backup',
            "Menghapus file backup {$file}",
        );

        return back()->with('success', "Backup {$file} berhasil dihapus.");
    }

    /** Restore dari file backup yang tersimpan di server. */
    public function restoreExisting(string $file): RedirectResponse
    {
        abort_unless(
            $this->backups->isValidName($file) && $this->backups->disk()->exists($file),
            404,
        );

        $this->runRestore((string) $this->backups->disk()->get($file), $file);

        return back()->with('success', "Database berhasil dipulihkan dari {$file}.");
    }

    /** Restore dari file .sql yang diunggah. */
    public function restoreUpload(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'extensions:sql', 'max:51200'],
        ], [
            'file.required' => 'Pilih file backup (.sql) terlebih dahulu.',
            'file.extensions' => 'File harus berekstensi .sql.',
            'file.max' => 'Ukuran file maksimal 50 MB.',
        ]);

        $uploadedName = $request->file('file')->getClientOriginalName();

        $this->runRestore(
            (string) $request->file('file')->get(),
            $uploadedName,
        );

        return back()->with('success', "Database berhasil dipulihkan dari {$uploadedName}.");
    }

    /**
     * Jalur restore bersama: backup otomatis dulu (PRD Bab 17 —
     * jaring pengaman), lalu restore dalam transaction (gagal =
     * rollback, file backup lama tetap utuh), lalu catat log.
     */
    private function runRestore(string $content, string $sourceName): void
    {
        $safety = $this->backups->create();

        $this->backups->restore($content);

        $this->activityLog->log(
            ActivityLogService::MODULE_BACKUP,
            'Restore Database',
            "Memulihkan database dari {$sourceName} (backup pengaman: {$safety})",
        );
    }
}
