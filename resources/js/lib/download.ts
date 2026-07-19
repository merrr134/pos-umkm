/**
 * Unduh file (Export PDF/Excel, dll) yang bekerja di Android/Capacitor.
 *
 * MASALAH: Android System WebView TIDAK menangani respons unduhan
 * (`Content-Disposition: attachment`) dari klik `<a href>` biasa —
 * tidak ada Download Manager yang terpasang, sehingga tombol Export
 * "tidak menghasilkan file". Di browser biasa, `<a href>` berjalan
 * normal.
 *
 * SOLUSI: saat berjalan native (Capacitor), ambil file lewat WebView
 * (yang punya akses ke server — termasuk via tunnel USB), simpan ke
 * penyimpanan lewat Capacitor Filesystem, lalu buka/ bagikan lewat
 * Share sheet. Di web, biarkan perilaku unduhan bawaan browser.
 */

import { Capacitor } from '@capacitor/core';

/** Ambil nama file dari header Content-Disposition (fallback bila kosong). */
function filenameFromDisposition(
    disposition: string | null,
    fallback: string,
): string {
    if (!disposition) return fallback;
    // filename*=UTF-8''... (RFC 5987) diutamakan, lalu filename="..."
    const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
    if (star) {
        try {
            return decodeURIComponent(star[1].replace(/^"|"$/g, ''));
        } catch {
            /* pakai fallback di bawah */
        }
    }
    const plain = /filename="?([^";]+)"?/i.exec(disposition);
    return plain ? plain[1] : fallback;
}

/** Blob → base64 murni (tanpa prefix data URL) untuk Filesystem. */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Gagal membaca file.'));
        reader.onloadend = () => {
            const result = reader.result as string;
            const comma = result.indexOf(',');
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.readAsDataURL(blob);
    });
}

/** True jika unduhan ditangani secara native (bukan browser). */
export function isNativeDownload(): boolean {
    return Capacitor.isNativePlatform();
}

/**
 * Unduh & buka file di perangkat native. `fallbackName` dipakai bila
 * server tidak mengirim nama file. Melempar error jika gagal (pemanggil
 * menampilkan pesan).
 */
export async function nativeDownload(
    url: string,
    fallbackName: string,
): Promise<void> {
    // Import dinamis: plugin native tidak dibundel untuk jalur web.
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
        throw new Error(`Server menolak permintaan (HTTP ${res.status}).`);
    }
    const blob = await res.blob();
    const name = filenameFromDisposition(
        res.headers.get('content-disposition'),
        fallbackName,
    );
    const base64 = await blobToBase64(blob);

    // Simpan ke Cache (internal, tanpa izin storage) lalu bagikan/buka.
    await Filesystem.writeFile({
        path: name,
        data: base64,
        directory: Directory.Cache,
    });
    const { uri } = await Filesystem.getUri({
        path: name,
        directory: Directory.Cache,
    });

    try {
        await Share.share({ title: name, url: uri });
    } catch (err) {
        // Pengguna menutup share sheet → bukan kegagalan unduhan.
        const msg = err instanceof Error ? err.message : String(err);
        if (!/cancel/i.test(msg)) throw err;
    }
}
