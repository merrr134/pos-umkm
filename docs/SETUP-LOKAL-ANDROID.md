# Catatan Setup — Build & Jalankan APK (Mode Tes Lokal)

Panduan reproducible untuk build APK **Pitou Cafe POS** dan menjalankannya di HP
dengan server berjalan di laptop (Laragon). Disusun dari hasil setup yang sudah
berhasil di mesin ini. Untuk pemakaian nyata (lepas dari laptop), lihat bagian
[Deploy](#7-untuk-pemakaian-nyata-deploy).

> Ringkas: aplikasi ini **web (Laravel + Inertia/React) yang dibungkus Capacitor**.
> APK-nya hanya "cangkang" WebView yang membuka alamat server. Jadi server
> (PHP + MySQL) **harus hidup** dan **terjangkau HP** agar app tidak "offline".

---

## 0. Lokasi tool di mesin ini

| Tool | Lokasi |
|---|---|
| JDK (dari Android Studio, Java 21) | `C:\Program Files\Android\Android Studio\jbr` |
| Android SDK | `C:\Users\sanzz\AppData\Local\Android\Sdk` |
| adb | `C:\Users\sanzz\AppData\Local\Android\Sdk\platform-tools\adb.exe` |
| PHP (Laragon) | `D:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe` |
| MySQL (Laragon) | `D:\laragon\bin\mysql\mysql-8.4.3-winx64` |

Set environment untuk sesi PowerShell/terminal saat build:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
```

---

## 1. Nyalakan server di laptop (WAJIB tiap mau pakai)

1. **Nyalakan MySQL + Apache** lewat **Laragon → tombol "Start All"**
   (cara paling praktis & stabil).
2. **Jalankan Laravel** agar bisa diakses dari HP (bind ke semua interface):

   ```powershell
   php artisan serve --host=0.0.0.0 --port=8000
   ```

   Biarkan jendela ini tetap terbuka selama app dipakai.

> Kalau app menampilkan **error 500**, hampir pasti **MySQL mati**. Cek: nyalakan
> lewat Laragon. (Session driver = database, jadi tiap request butuh MySQL.)

---

## 2. Build APK

```powershell
npm install            # sekali saja / saat dependency berubah
npm run build          # tsc + vite build + tulis public/build/index.html
npx cap sync android   # salin web assets + config ke project Android
cd android
.\gradlew.bat assembleDebug
```

Hasil: `android\app\build\outputs\apk\debug\app-debug.apk`

> Build **pertama** lama (~menit-an) karena download Gradle + SDK 34.
> Build berikutnya cepat (~10-30 detik) karena sudah ke-cache.
> Kalau gagal `Could not unzip ...gradle-*.zip` (zip korup): hapus folder
> `C:\Users\sanzz\.gradle\wrapper\dists\gradle-8.2.1-all` lalu build ulang.

---

## 3. Pilih cara HP terhubung ke server

Alamat server diatur di `capacitor.config.ts` → `server.url`. **Setiap ganti
alamat, harus `npx cap sync android` + rebuild + reinstall.**

### Opsi A — Wireless via hotspot (dipakai sekarang)
1. HP nyalakan **hotspot**, laptop tersambung ke hotspot itu.
2. Cari IP laptop di jaringan hotspot:
   ```powershell
   Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } | Select-Object IPAddress, InterfaceAlias
   ```
3. Set `capacitor.config.ts`:
   ```ts
   url: 'http://<IP-LAPTOP>:8000',   // contoh: http://10.94.242.71:8000
   ```
4. Rebuild + reinstall. **Tanpa kabel**, tapi kalau IP hotspot berubah → ulangi.

### Opsi B — Kabel USB (paling stabil)
1. Set `capacitor.config.ts` → `url: 'http://localhost:8000'`.
2. Rebuild + reinstall.
3. Pasang terowongan USB (ulangi tiap HP dicabut-colok):
   ```powershell
   adb reverse tcp:8000 tcp:8000
   adb reverse --list   # cek: UsbFfs tcp:8000 tcp:8000
   ```

> Tes cepat apakah HP bisa menjangkau server (HP tercolok USB):
> ```powershell
> adb shell 'echo -e "GET / HTTP/1.0\r\n\r\n" | toybox nc -w 3 <IP-LAPTOP> 8000 | head -1'
> ```
> Balasan `HTTP/1.0 200 OK` = terhubung. (Ping/ICMP diblok firewall — abaikan.)

---

## 4. Install / update APK ke HP

Aktifkan **USB debugging** di HP, colok kabel, lalu:

```powershell
adb devices                 # pastikan device muncul
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

`-r` = update tanpa menghapus data. Setelah install, **tutup & buka lagi** app.
(Untuk Opsi A, kabel boleh dicabut setelah install selesai.)

---

## 5. Gambar tidak muncul di app — sudah diperbaiki

**Gejala:** gambar upload (produk/logo/struk) muncul di browser laptop tapi
hilang di aplikasi.

**Sebab:** dulu URL gambar dibuat **absolut** ke `APP_URL`
(`http://pitou-cafe-pos.test`) yang tak terjangkau HP.

**Perbaikan (sudah diterapkan):** `config/filesystems.php` disk `public`:
```php
'url' => env('STORAGE_URL', '/storage'),   // URL relatif, ikut origin app
```
Lalu `php artisan config:clear`. Ini juga otomatis benar setelah deploy.
Kalau butuh URL **absolut** (mis. kirim gambar via WhatsApp), set di `.env`:
`STORAGE_URL=https://domainmu.com/storage`.

---

## 6. Checklist saat app "offline" / error

1. `php artisan serve --host=0.0.0.0 --port=8000` masih jalan? (port 8000 listen)
2. MySQL hidup? (Laragon Start All) — kalau tidak → error 500.
3. **Opsi A:** IP laptop masih sama dengan di `capacitor.config.ts`? HP masih di
   hotspot yang sama? Kalau IP berubah → update config + rebuild + reinstall.
4. **Opsi B:** kabel tercolok & `adb reverse --list` menampilkan tunnel? Kalau
   kosong → `adb reverse tcp:8000 tcp:8000`.

---

## 7. Untuk pemakaian nyata (Deploy)

Mode di atas bergantung laptop. Agar app **mandiri** (dipakai HP mana pun tanpa
laptop/kabel), deploy server ke hosting/VPS lalu:
1. Set `capacitor.config.ts` → `url: 'https://domain-produksi.com'`.
2. Rebuild APK sekali (untuk rilis: `assembleRelease` + keystore, lihat
   `README-ANDROID.md`).
3. Fitur PWA/offline (Fase 15) baru benar-benar aktif di origin `https`.

---

### Referensi terkait
- `README-ANDROID.md` — packaging Android lengkap (release, AAB, aset, deep link).
- `capacitor.config.ts` — `appId com.pitou.pos`, `server.url`, splash screen.
