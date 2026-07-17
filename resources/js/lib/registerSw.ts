/**
 * Registrasi Service Worker (Fase 15 — PWA).
 *
 * Hanya di build produksi — modul dev Vite tidak boleh di-cache.
 * Kegagalan registrasi TIDAK boleh mengganggu aplikasi (PRD Bab 9):
 * aplikasi tetap berjalan normal tanpa SW, hanya kehilangan
 * kemampuan offline; kegagalan dicatat ke console.
 */
export function registerServiceWorker(): void {
    if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !import.meta.env.PROD
    ) {
        return;
    }

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((error) => {
            console.warn(
                'Service worker gagal didaftarkan — aplikasi tetap berjalan tanpa mode offline.',
                error,
            );
        });
    });
}
