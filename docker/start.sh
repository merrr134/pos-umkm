#!/bin/sh
# Start-up produksi (Railway): siapkan storage, migrasi DB, cache, lalu jalan.
set -e

cd /app

# Pastikan direktori storage ada (penting bila Volume Railway di-mount
# di /app/storage — mount menimpa isi image, jadi dibuat ulang di sini).
mkdir -p \
  storage/framework/cache \
  storage/framework/sessions \
  storage/framework/views \
  storage/logs \
  storage/app/public \
  bootstrap/cache
chmod -R 775 storage bootstrap/cache || true

# Symlink public/storage -> storage/app/public (untuk akses gambar publik).
php artisan storage:link || true

# Migrasi database (aman diulang; --force utk non-interaktif produksi).
php artisan migrate --force

# Seed data awal (owner + pengaturan) HANYA pada deploy pertama (DB kosong).
# Guard ini mencegah password owner ter-reset pada deploy berikutnya.
php artisan tinker --execute="\App\Models\User::count()===0 && \Illuminate\Support\Facades\Artisan::call('db:seed', ['--force'=>true]);" || true

# Cache konfigurasi/route/view untuk performa (pakai env dari Railway).
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Jalankan server. Railway menyuntik $PORT (dibaca Caddyfile).
exec frankenphp run --config /etc/frankenphp/Caddyfile
