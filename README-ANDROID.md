# Pitou Cafe POS — Packaging Android (Capacitor)

Dokumentasi build aplikasi Android untuk **Pitou Cafe POS** (Fase 17).
Aplikasi web (Laravel + React/Inertia + PWA) dibungkus sebagai aplikasi
Android native menggunakan **Capacitor 6**.

- **App ID:** `com.pitou.pos`
- **App Name:** `Pitou Cafe` (label native; ubah di
  `android/app/src/main/res/values/strings.xml` bila nama toko berbeda)
- **WebDir:** `public/build`

> ⚠️ **Penting — aplikasi ini server-rendered.**
> Pitou Cafe POS memakai Laravel + Inertia (bukan SPA statis), sehingga
> halaman awal butuh server. Untuk shell native yang memuat aplikasi
> **live**, set alamat server sebelum build:
>
> ```bash
> # PowerShell
> $env:CAP_SERVER_URL = "https://pos.pitoucafe.com"
> # bash
> export CAP_SERVER_URL="https://pos.pitoucafe.com"
> ```
>
> Nilai ini dibaca `capacitor.config.ts` → `server.url`, sehingga WebView
> memuat situs live (PWA, service worker, offline, sync tetap berjalan).
> Tanpa `CAP_SERVER_URL`, WebView memuat entry statis di `public/build`
> (splash + penanda konfigurasi).

---

## Prasyarat

| Alat | Versi |
|---|---|
| Node.js | ≥ 20 |
| PHP + Composer | sesuai proyek |
| JDK | 17 |
| Android SDK / Android Studio | Platform 34, Build-Tools 34 |
| Gradle | dibundel via `gradlew` |

Set `ANDROID_HOME` (atau `ANDROID_SDK_ROOT`) ke lokasi Android SDK.

---

## 1. Sinkronisasi Capacitor

Setiap kali kode web berubah, build ulang lalu sinkronkan ke Android:

```bash
npm install
npm run build          # tsc + vite build + tulis public/build/index.html
npx cap sync android   # salin web assets + update plugin native
```

Atau ringkas dengan skrip bawaan:

```bash
npm run cap:sync       # = npm run build && cap sync android
```

Buka di Android Studio (opsional):

```bash
npx cap open android
```

---

## 2. Build APK Debug

```bash
cd android
./gradlew assembleDebug          # Linux/macOS
gradlew.bat assembleDebug        # Windows
```

Hasil: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 3. Build APK Release

Siapkan keystore (sekali saja):

```bash
keytool -genkey -v -keystore pitou-release.keystore \
  -alias pitou -keyalg RSA -keysize 2048 -validity 10000
```

Set kredensial (env atau `android/gradle.properties`):

```bash
export PITOU_KEYSTORE=/path/pitou-release.keystore
export PITOU_KEYSTORE_PASSWORD=******
export PITOU_KEY_ALIAS=pitou
export PITOU_KEY_PASSWORD=******
```

Build:

```bash
cd android
./gradlew assembleRelease
```

Hasil: `android/app/build/outputs/apk/release/app-release.apk`
(bila keystore tidak diset → `app-release-unsigned.apk`).

---

## 4. Build AAB (Android App Bundle)

```bash
cd android
./gradlew bundleRelease
```

Hasil: `android/app/build/outputs/bundle/release/app-release.aab`

---

## 5. Install APK ke Perangkat

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

`-r` = install ulang (update) tanpa mencopot data. Aktifkan **USB
debugging** di perangkat terlebih dahulu.

---

## 6. Update Aplikasi

1. Ubah kode web seperti biasa.
2. `npm run build`
3. `npx cap sync android`
4. Naikkan `versionCode` (dan `versionName`) di
   `android/app/build.gradle`.
5. Build ulang APK/AAB.

Jika memakai `CAP_SERVER_URL` (mode server live), pembaruan UI cukup
di-deploy ke server — WebView memuat versi terbaru tanpa rebuild APK,
selama struktur native (plugin/permission) tidak berubah.

---

## 7. Aset & Konfigurasi

- **Ikon & splash** digenerate dari brand (`scripts/android-assets.php`):
  `php scripts/android-assets.php` menulis ulang mipmap (adaptive +
  round) dan `splash.png` semua densitas. Warna primary `#0A45FE`.
- **Splash native**: plugin `@capacitor/splash-screen`
  (`capacitor.config.ts`) — latar primary, logo di tengah, fade-out.
- **Permission** (`AndroidManifest.xml`): Internet, Network State,
  Bluetooth (printer Fase 14), Camera (foto). Storage **tidak** diminta
  karena upload memakai file picker sistem (scoped storage).
- **Deep link**: skema `pitoupos://` dan App Link `https://` (ubah host
  di `strings.xml` → `deep_link_host` ke domain produksi).

---

## 8. Troubleshooting Umum

| Masalah | Solusi |
|---|---|
| `cap sync` gagal: butuh `index.html` | Jalankan `npm run build` dulu (menulis `public/build/index.html`). |
| `SDK location not found` | Set `ANDROID_HOME`, atau buat `android/local.properties` berisi `sdk.dir=/path/Android/Sdk`. |
| `Unsupported Java` / Gradle error | Pakai **JDK 17** (`java -version`). |
| Layar splash menetap | `CAP_SERVER_URL` belum diset — WebView memuat entry statis, bukan aplikasi. Set env lalu rebuild. |
| Bluetooth printer tak terdeteksi | Web Bluetooth di WebView terbatas; Fase 14 otomatis fallback ke print browser. Untuk akses penuh gunakan mode server (`CAP_SERVER_URL`) di Chromium. |
| APK release tak ter-sign | Set variabel `PITOU_KEYSTORE*` sebelum `assembleRelease`. |
| `adb: no devices` | Aktifkan USB debugging & jalankan `adb devices`. |

---

## 9. Kompatibilitas PWA / Offline / Bluetooth / WhatsApp

- **Service Worker, Manifest, Offline, Sync (Fase 15)** berjalan saat
  WebView memuat aplikasi via `CAP_SERVER_URL` (origin https).
- **Bluetooth (Fase 14)** tidak berubah — tetap fallback ke print
  browser bila Web Bluetooth tak tersedia.
- **Kamera** — input file `capture` memakai kamera perangkat.
- **WhatsApp (Fase 16)** — `wa.me` terbuka di browser Android eksternal.
