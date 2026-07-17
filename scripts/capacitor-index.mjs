/**
 * Tulis entry point Capacitor (public/build/index.html) — Fase 17.
 *
 * Vite (laravel-vite-plugin) mengeluarkan aset ke public/build TANPA
 * index.html karena aplikasi ini server-rendered (Laravel + Inertia).
 * Capacitor mewajibkan sebuah index.html sebagai entry WebView, jadi
 * skrip ini menuliskannya SETELAH `vite build` (dipasang di npm script
 * "build") agar selalu ada dan tidak terhapus saat Vite mengosongkan
 * outDir.
 *
 * Di produksi, set env CAP_SERVER_URL (lihat capacitor.config.ts) →
 * Capacitor memuat situs live langsung dan halaman ini hanya tampil
 * sekejap sebagai splash sebelum WebView berpindah. Bila server.url
 * tidak diset, halaman ini menjadi penanda konfigurasi.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = resolve(root, 'public/build/index.html');

const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0A45FE" />
    <title>Pitou Cafe POS</title>
    <style>
        html, body { margin: 0; height: 100%; background: #0A45FE; }
        body {
            display: flex; align-items: center; justify-content: center;
            font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
            color: #fff; text-align: center; padding: 24px;
        }
        .logo {
            width: 96px; height: 96px; border-radius: 24px; background: #fff;
            color: #0A45FE; font-size: 52px; font-weight: 800; line-height: 96px;
            margin: 0 auto 20px;
        }
        h1 { font-size: 20px; margin: 0 0 8px; }
        p { font-size: 14px; opacity: .85; margin: 0; max-width: 320px; }
    </style>
</head>
<body>
    <main>
        <div class="logo">P</div>
        <h1>Pitou Cafe POS</h1>
        <p>Memuat aplikasi… Jika layar ini menetap, atur <code>CAP_SERVER_URL</code> ke alamat server aplikasi sebelum build.</p>
    </main>
</body>
</html>
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, html, 'utf8');
console.log('Capacitor entry ditulis: public/build/index.html');
