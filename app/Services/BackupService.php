<?php

namespace App\Services;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Backup & Restore database (Fase 11 — PRD 5.13.E). Backup berupa
 * file SQL berisi DATA seluruh tabel bisnis (skema dikelola oleh
 * migration) — portabel antara MySQL (produksi) dan SQLite (test).
 * Restore dijalankan dalam DB::transaction() → gagal = rollback,
 * data lama tetap aman. File backup lama tidak pernah ikut terhapus.
 */
class BackupService
{
    /** Penanda file backup valid — dicek saat validasi restore. */
    public const MARKER = '-- Pitou Cafe POS Backup';

    /**
     * Tabel bisnis, urut aman-dependensi (DATABASE.md §9):
     * INSERT mengikuti urutan ini, DELETE kebalikannya.
     */
    private const TABLES = [
        'users',
        'categories',
        'products',
        'suppliers',
        'purchases',
        'purchase_items',
        'stock_movements',
        'transactions',
        'transaction_items',
        'expense_categories',
        'expenses',
        'payment_methods',
        'settings',
        'activity_logs',
    ];

    public function disk(): Filesystem
    {
        return Storage::disk('backups');
    }

    /**
     * Daftar file backup, terbaru dulu.
     *
     * @return list<array{name: string, size: int, created_at: string}>
     */
    public function list(): array
    {
        return collect($this->disk()->files())
            ->filter(fn (string $file) => $this->isValidName($file))
            ->map(fn (string $file) => [
                'name' => $file,
                'size' => (int) $this->disk()->size($file),
                'created_at' => date('c', (int) $this->disk()->lastModified($file)),
            ])
            ->sortByDesc('name')
            ->values()
            ->all();
    }

    /** Buat backup baru → nama file `backup-YYYYMMDD-HHmmss.sql`. */
    public function create(): string
    {
        $base = 'backup-'.now()->format('Ymd-His');
        $name = $base.'.sql';
        $counter = 1;

        while ($this->disk()->exists($name)) {
            $name = $base.'-'.$counter++.'.sql';
        }

        $this->disk()->put($name, $this->dump());

        return $name;
    }

    /** Nama file backup yang sah — sekaligus tolak path traversal. */
    public function isValidName(string $name): bool
    {
        return preg_match('/^backup-\d{8}-\d{6}(-\d+)?\.sql$/', $name) === 1;
    }

    /** Konten adalah backup Pitou Cafe POS yang sah? */
    public function isValidContent(string $content): bool
    {
        return str_contains($content, self::MARKER);
    }

    /**
     * Restore dari konten SQL — file divalidasi, lalu seluruh
     * statement dijalankan dalam satu transaction (gagal → rollback).
     */
    public function restore(string $content): void
    {
        if (! $this->isValidContent($content)) {
            throw ValidationException::withMessages([
                'file' => 'File bukan backup Pitou Cafe POS yang valid.',
            ]);
        }

        $statements = $this->splitStatements($content);

        if ($statements === []) {
            throw ValidationException::withMessages([
                'file' => 'File backup tidak berisi data.',
            ]);
        }

        DB::transaction(function () use ($statements) {
            foreach ($statements as $statement) {
                DB::unprepared($statement);
            }
        });
    }

    /** Dump data seluruh tabel bisnis sebagai statement SQL. */
    private function dump(): string
    {
        $pdo = DB::connection()->getPdo();
        $tables = array_values(array_filter(
            self::TABLES,
            fn (string $table) => Schema::hasTable($table),
        ));

        $lines = [
            self::MARKER,
            '-- Dibuat: '.now()->toDateTimeString(),
            '-- Berisi data; skema dikelola oleh migration.',
            '',
        ];

        // Kosongkan tabel urut kebalikan dependensi (anak dulu)
        foreach (array_reverse($tables) as $table) {
            $lines[] = "DELETE FROM {$table};";
        }

        foreach ($tables as $table) {
            foreach (DB::table($table)->orderBy('id')->cursor() as $row) {
                $row = (array) $row;
                $columns = implode(', ', array_keys($row));
                $values = implode(', ', array_map(
                    fn ($value) => match (true) {
                        $value === null => 'NULL',
                        is_int($value), is_float($value) => (string) $value,
                        default => $pdo->quote((string) $value),
                    },
                    array_values($row),
                ));

                $lines[] = "INSERT INTO {$table} ({$columns}) VALUES ({$values});";
            }
        }

        return implode("\n", $lines)."\n";
    }

    /**
     * Pecah konten SQL menjadi statement — sadar-string (titik koma
     * atau baris baru di dalam nilai berkutip tidak memecah statement).
     *
     * @return list<string>
     */
    private function splitStatements(string $content): array
    {
        // Buang baris komentar
        $sql = collect(preg_split('/\R/', $content))
            ->reject(fn (string $line) => str_starts_with(trim($line), '--'))
            ->implode("\n");

        $statements = [];
        $current = '';
        $inString = false;
        $length = strlen($sql);
        // MySQL meng-escape dengan backslash (\' \\), SQLite dengan ''
        $backslashEscapes = in_array(
            DB::connection()->getDriverName(),
            ['mysql', 'mariadb'],
            true,
        );

        for ($i = 0; $i < $length; $i++) {
            $char = $sql[$i];

            if ($inString && $backslashEscapes && $char === '\\') {
                $current .= $char.($sql[$i + 1] ?? '');
                $i++;
                continue;
            }

            if ($char === "'") {
                // '' di dalam string = escape kutip, bukan penutup
                if ($inString && ($sql[$i + 1] ?? '') === "'") {
                    $current .= "''";
                    $i++;
                    continue;
                }

                $inString = ! $inString;
            }

            if ($char === ';' && ! $inString) {
                $statement = trim($current);

                if ($statement !== '') {
                    $statements[] = $statement;
                }

                $current = '';
                continue;
            }

            $current .= $char;
        }

        if (trim($current) !== '') {
            $statements[] = trim($current);
        }

        return $statements;
    }
}
