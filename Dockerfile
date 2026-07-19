# Pitou Cafe POS — image produksi untuk Railway (Laravel + Inertia/React).
# Multi-stage: build aset Vite dengan Node, lalu jalankan PHP via FrankenPHP.

# ---------- Stage 1: build aset frontend (Vite) ----------
FROM node:20-bookworm-slim AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Menghasilkan public/build (Vite) + public/build/index.html (Capacitor entry)
RUN npm run build

# ---------- Stage 2: aplikasi PHP ----------
FROM dunglas/frankenphp:1-php8.3 AS app

# Ekstensi PHP yang dibutuhkan Laravel + upload gambar (GD).
RUN install-php-extensions pdo_mysql gd zip bcmath intl opcache exif

# Composer dari image resmi.
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Install dependency PHP dulu (cache layer) — butuh composer.json+lock.
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

# Salin seluruh kode aplikasi.
COPY . .

# Aset hasil build dari stage 1.
COPY --from=assets /app/public/build ./public/build

# Selesaikan autoload + optimasi (setelah semua file ada). --no-scripts:
# jangan jalankan artisan saat build (env/DB belum ada); package:discover
# otomatis terjadi saat runtime (start.sh: config:cache).
RUN composer dump-autoload --optimize --no-dev --no-scripts \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs storage/app/public bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Konfigurasi server + skrip start (migrate lalu jalan).
COPY docker/Caddyfile /etc/frankenphp/Caddyfile
COPY docker/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

# Railway menyuntik $PORT; FrankenPHP mendengarkannya (lihat Caddyfile).
CMD ["/usr/local/bin/start.sh"]
