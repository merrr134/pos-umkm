<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Category;
use App\Models\User;
use App\Services\BackupService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class BackupTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('backups');
    }

    public function test_backup_page_and_actions_are_owner_only(): void
    {
        $this->get('/backup')->assertRedirect('/login');

        foreach (['admin', 'kasir'] as $role) {
            $actor = User::factory()->create(['role' => $role]);

            $this->actingAs($actor)->get('/backup')->assertForbidden();
            $this->actingAs($actor)->post('/backup')->assertForbidden();
            $this->actingAs($actor)->post('/backup/restore')->assertForbidden();
            $this->actingAs($actor)
                ->delete('/backup/backup-20260717-120000.sql')
                ->assertForbidden();
        }

        $this->actingAs(User::factory()->owner()->create())
            ->get('/backup')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Backup/Index')
                ->has('backups'));
    }

    public function test_owner_can_create_backup_with_correct_name_and_content(): void
    {
        $owner = User::factory()->owner()->create();
        Category::factory()->create(['name' => 'Kopi Panas']);

        $this->actingAs($owner)
            ->post('/backup')
            ->assertRedirect()
            ->assertSessionHas('success');

        $files = Storage::disk('backups')->files();
        $this->assertCount(1, $files);
        $this->assertMatchesRegularExpression(
            '/^backup-\d{8}-\d{6}(-\d+)?\.sql$/',
            $files[0],
        );

        $content = Storage::disk('backups')->get($files[0]);
        $this->assertStringContainsString(BackupService::MARKER, $content);
        $this->assertStringContainsString('Kopi Panas', $content);
        $this->assertStringContainsString('INSERT INTO categories', $content);

        // Backup tercatat di Activity Log
        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $owner->id,
            'module' => 'Backup',
            'activity' => 'Backup Database',
        ]);
    }

    public function test_backup_list_is_paginated(): void
    {
        $owner = User::factory()->owner()->create();

        for ($i = 0; $i < 12; $i++) {
            Storage::disk('backups')->put(
                sprintf('backup-20260717-1200%02d.sql', $i),
                BackupService::MARKER,
            );
        }

        $this->actingAs($owner)
            ->get('/backup')
            ->assertInertia(fn (Assert $page) => $page
                ->has('backups.data', 10)
                ->where('backups.total', 12));
    }

    public function test_owner_can_download_backup(): void
    {
        $owner = User::factory()->owner()->create();
        Storage::disk('backups')->put(
            'backup-20260717-120000.sql',
            BackupService::MARKER,
        );

        $this->actingAs($owner)
            ->get('/backup/backup-20260717-120000.sql/download')
            ->assertOk()
            ->assertDownload('backup-20260717-120000.sql');
    }

    public function test_owner_can_delete_backup_and_traversal_is_rejected(): void
    {
        $owner = User::factory()->owner()->create();
        Storage::disk('backups')->put(
            'backup-20260717-120000.sql',
            BackupService::MARKER,
        );

        // Nama file di luar pola backup → 404 (anti path traversal)
        $this->actingAs($owner)
            ->delete('/backup/bukan-backup.sql')
            ->assertNotFound();

        $this->actingAs($owner)
            ->delete('/backup/backup-20260717-120000.sql')
            ->assertRedirect()
            ->assertSessionHas('success');

        Storage::disk('backups')->assertMissing('backup-20260717-120000.sql');
    }

    public function test_restore_from_existing_backup_replaces_data_and_keeps_old_files(): void
    {
        $owner = User::factory()->owner()->create();
        $keep = Category::factory()->create(['name' => 'Sebelum Backup']);

        // Backup saat kategori "Sebelum Backup" ada
        $backupName = app(BackupService::class)->create();

        // Data baru setelah backup — harus hilang setelah restore
        Category::factory()->create(['name' => 'Setelah Backup']);

        $this->actingAs($owner)
            ->post("/backup/{$backupName}/restore")
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('categories', ['name' => 'Sebelum Backup']);
        $this->assertDatabaseMissing('categories', ['name' => 'Setelah Backup']);
        $this->assertSame($keep->id, Category::firstOrFail()->id);

        // File backup lama tetap ada + backup pengaman otomatis dibuat
        Storage::disk('backups')->assertExists($backupName);
        $this->assertCount(2, Storage::disk('backups')->files());

        // Restore tercatat di Activity Log (log dibuat SETELAH restore)
        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $owner->id,
            'module' => 'Backup',
            'activity' => 'Restore Database',
        ]);
    }

    public function test_restore_from_uploaded_sql_file(): void
    {
        $owner = User::factory()->owner()->create();
        Category::factory()->create(['name' => 'Data Asli']);

        $content = app(BackupService::class)->disk()->get(
            app(BackupService::class)->create(),
        );

        Category::factory()->create(['name' => 'Data Tambahan']);

        $this->actingAs($owner)
            ->post('/backup/restore', [
                'file' => UploadedFile::fake()->createWithContent(
                    'cadangan.sql',
                    (string) $content,
                ),
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('categories', ['name' => 'Data Asli']);
        $this->assertDatabaseMissing('categories', ['name' => 'Data Tambahan']);
    }

    public function test_invalid_restore_file_is_rejected_and_data_is_safe(): void
    {
        $owner = User::factory()->owner()->create();
        Category::factory()->create(['name' => 'Aman']);

        // Ekstensi salah
        $this->actingAs($owner)
            ->post('/backup/restore', [
                'file' => UploadedFile::fake()->createWithContent(
                    'backup.txt',
                    BackupService::MARKER,
                ),
            ])
            ->assertSessionHasErrors('file');

        // Konten bukan backup Pitou Cafe POS (tanpa marker)
        $this->actingAs($owner)
            ->post('/backup/restore', [
                'file' => UploadedFile::fake()->createWithContent(
                    'random.sql',
                    'DROP TABLE users;',
                ),
            ])
            ->assertSessionHasErrors('file');

        // Data tidak tersentuh
        $this->assertDatabaseHas('categories', ['name' => 'Aman']);
        $this->assertDatabaseHas('users', ['id' => $owner->id]);
    }
}
