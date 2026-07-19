# Deploy Pitou Cafe POS ke Railway

Membuat server (Laravel + MySQL) online agar aplikasi **mandiri** — tidak lagi
bergantung pada laptop, kabel USB, atau IP yang berubah. Setelah ini, APK cukup
diarahkan ke domain Railway.

> Perkiraan biaya: Railway memberi kredit awal, lalu ± $5/bln (app) + pemakaian
> MySQL. Butuh akun Railway (login pakai GitHub).

Build memakai **Dockerfile** (FrankenPHP + PHP 8.3) — sudah disiapkan di repo:
`Dockerfile`, `docker/Caddyfile`, `docker/start.sh`, `railway.json`.

---

## 1. Buat project dari GitHub
1. Buka https://railway.app → login dengan GitHub.
2. **New Project → Deploy from GitHub repo** → pilih `merrr134/pos-umkm`.
3. Railway mendeteksi `Dockerfile` dan mulai build. Biarkan dulu (akan gagal
   sampai DB & env diisi — normal).

## 2. Tambah database MySQL
1. Di project yang sama: **New → Database → Add MySQL**.
2. Beri nama service tetap **MySQL** (default) — nama ini dipakai di variabel
   di bawah. Kalau namanya beda, sesuaikan `${{MySQL....}}` menjadi nama service-mu.

## 3. Tambah Volume (WAJIB — agar gambar upload tidak hilang)
Container Railway bersifat *ephemeral*: file yang di-upload (foto produk, logo,
bukti pengeluaran) akan **hilang tiap redeploy** bila disimpan di disk container.
Karena itu pasang Volume:
1. Klik service **app** (pos-umkm) → tab **Settings/Volumes** → **New Volume**.
2. **Mount path:** `/app/storage`
3. Simpan. (Upload kini bertahan di `/app/storage/app/public`.)

## 4. Isi Environment Variables (service app)
Service app → tab **Variables** → **Raw Editor** → tempel:

```
APP_NAME=Pitou Cafe POS
APP_ENV=production
APP_KEY=base64:ISI_DENGAN_KEY_PRODUKSI_ANDA
APP_DEBUG=false
APP_URL=https://GANTI-NANTI.up.railway.app
APP_LOCALE=id
APP_TIMEZONE=Asia/Makassar
LOG_CHANNEL=stderr

DB_CONNECTION=mysql
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_DATABASE=${{MySQL.MYSQLDATABASE}}
DB_USERNAME=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}

SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
CACHE_STORE=database
QUEUE_CONNECTION=database
FILESYSTEM_DISK=local
```

> `${{MySQL.MYSQLHOST}}` dst. = *reference variable* Railway; otomatis terisi
> dari service MySQL (pakai jaringan privat internal, tidak kena biaya egress).
> `APP_KEY` diisi dengan key produksi (dibagikan terpisah/di-generate sendiri
> via `php artisan key:generate --show`; **jangan** commit ke Git). `APP_URL` diisi
> setelah domain dibuat (langkah 5), lalu redeploy.

## 5. Buat domain publik
1. Service app → **Settings → Networking → Generate Domain**.
2. Railway memberi URL, mis. `https://pos-umkm-production.up.railway.app`.
   (Port terdeteksi otomatis dari `$PORT` — Caddyfile sudah menanganinya.)
3. Salin URL itu ke variabel **`APP_URL`** (langkah 4) → service akan redeploy.

## 6. Deploy & verifikasi
- Saat start, `docker/start.sh` otomatis: buat folder storage, `storage:link`,
  **migrasi DB**, **seed data awal HANYA di deploy pertama** (owner + pengaturan),
  cache config, lalu jalankan server.
- Cek tab **Deployments → Logs**: cari `Migrating`/`Migrated` dan server siap.
- Buka `APP_URL` di browser → halaman login muncul.

## 7. Login pertama & keamanan
- Akun awal hasil seed: **username `owner`**, **password `password`**.
- **LOGIN lalu segera GANTI PASSWORD** (menu Profil/Pengguna).
- Data (produk, transaksi, dll) mulai dari kosong — server produksi terpisah
  dari data lokal laptop. (Migrasi data lokal → produksi bisa dilakukan terpisah
  bila diperlukan.)

## 8. Arahkan APK ke server produksi
Setelah web produksi jalan:
1. `capacitor.config.ts` → `server.url: 'https://DOMAIN-RAILWAY-mu'`.
2. `npm run build` → `npx cap sync android` → `gradlew assembleDebug` →
   `adb install -r` (colok USB sekali untuk install).
3. **Cabut kabel, matikan tunnel — tidak dibutuhkan lagi.** Aplikasi kini
   berjalan lewat internet ke server Railway; PWA/offline (Fase 15) aktif penuh
   karena origin sudah `https`.

---

## Troubleshooting
| Masalah | Solusi |
|---|---|
| Build gagal | Buka log build; sering karena env `APP_KEY`/DB belum diisi → lengkapi lalu redeploy. |
| `SQLSTATE... Connection refused` | Variabel `DB_*` belum mereferensi service MySQL; pastikan nama service = `MySQL`. |
| Halaman 500 & tak ada detail | `APP_DEBUG=false` menyembunyikan detail (benar utk produksi); cek **Logs** (LOG_CHANNEL=stderr). |
| Gambar hilang setelah redeploy | Volume belum dipasang di `/app/storage` (langkah 3). |
| Login "Sesi berakhir" berulang | Pastikan `SESSION_DRIVER=database` & `APP_URL` = domain https yang benar. |
