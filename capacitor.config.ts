import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Konfigurasi Capacitor — Pitou Cafe POS (Fase 17).
 *
 * appId  : com.pitou.pos
 * appName: "Pitou Cafe" (default Profil Toko; label native diubah di
 *          android/app/src/main/res/values/strings.xml bila nama toko
 *          berbeda — label native tidak bisa membaca DB saat runtime).
 * webDir : public/build (output Vite — lihat catatan di bawah).
 *
 * Catatan penting: aplikasi ini server-rendered (Laravel + Inertia),
 * bukan SPA statis. Untuk build shell native yang memuat aplikasi live,
 * set `server.url` ke domain produksi (mis. https://pos.pitoucafe.com)
 * lewat variabel di bawah. Tanpa server.url, WebView memuat aset statis
 * di webDir (berguna untuk cache PWA / offline shell). Nilai server.url
 * dibiarkan kosong agar `cap sync` tetap berjalan tanpa environment.
 */

const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
    appId: 'com.pitou.pos',
    appName: 'Pitou Cafe',
    webDir: 'public/build',
    backgroundColor: '#0A45FE',
    android: {
        // Skema WebView untuk PWA (service worker, manifest, offline).
        allowMixedContent: false,
    },
    server: {
        androidScheme: 'https',
        // Diisi hanya bila memaketkan aplikasi live (server-rendered).
        ...(serverUrl ? { url: serverUrl, cleartext: false } : {}),
    },
    plugins: {
        SplashScreen: {
            // Splash native — logo di atas warna primary, lalu fade.
            launchShowDuration: 1200,
            launchAutoHide: true,
            launchFadeOutDuration: 350,
            backgroundColor: '#0A45FE',
            androidSplashResourceName: 'splash',
            androidScaleType: 'CENTER_CROP',
            showSpinner: false,
            splashFullScreen: true,
            splashImmersive: false,
        },
    },
};

export default config;
