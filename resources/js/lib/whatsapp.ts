import { ReceiptTransaction } from '@/Pages/Kasir/kasir';

/**
 * Integrasi WhatsApp (Fase 16 — PRD 5.5).
 *
 * Semua murni sisi client: nomor dinormalisasi ke format internasional
 * Indonesia (62…), pesan struk disusun sebagai teks, lalu dibuka lewat
 * tautan https://wa.me/ (tanpa API berbayar / WhatsApp Business API).
 * Fungsi-fungsi ini pure → mudah diuji unit (vitest).
 */

/**
 * Normalisasi nomor telepon Indonesia ke format 62… (hanya angka).
 *
 * - Buang semua karakter non-digit (spasi, tanda hubung, "+", dst).
 * - Awalan "0"  → ganti dengan "62"  (08123… → 628123…).
 * - Awalan "62" → biarkan.
 * - Awalan "8"  → tambah "62" di depan (8123… → 628123…).
 * - Lainnya     → biarkan apa adanya (mis. sudah pakai kode negara lain).
 *
 * Nomor kosong / tak ada digit → kembalikan string kosong.
 */
export function normalizePhone(raw: string | null | undefined): string {
    const digits = (raw ?? '').replace(/\D/g, '');
    if (digits === '') return '';

    if (digits.startsWith('62')) return digits;
    if (digits.startsWith('0')) return '62' + digits.slice(1);
    if (digits.startsWith('8')) return '62' + digits;

    return digits;
}

/**
 * Valid bila, setelah dinormalisasi, berupa nomor Indonesia 62 diikuti
 * 8–13 digit (total 10–15 digit) — cukup longgar untuk semua operator.
 */
export function isValidPhone(raw: string | null | undefined): boolean {
    const normalized = normalizePhone(raw);
    return /^62\d{8,13}$/.test(normalized);
}

/** Format tanggal struk WhatsApp — sama gaya dengan struk (id-ID). */
function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatRupiah(value: number): string {
    return 'Rp ' + value.toLocaleString('id-ID');
}

/**
 * Susun pesan struk digital sesuai format PRD Fase 16:
 * salam, nama toko, no transaksi, tanggal, daftar item, total, metode.
 */
export function buildReceiptMessage(
    receipt: ReceiptTransaction,
    storeName: string,
): string {
    const items = receipt.items
        .map((item) => `- ${item.product_name} x${item.quantity}`)
        .join('\n');

    return [
        'Halo 👋',
        '',
        `Terima kasih telah berbelanja di ${storeName}`,
        '',
        'No Transaksi:',
        receipt.invoice_number,
        '',
        'Tanggal:',
        formatDateTime(receipt.date),
        '',
        'Item:',
        '',
        items,
        '',
        'Total:',
        formatRupiah(receipt.total),
        '',
        'Metode:',
        receipt.payment_method_label,
        '',
        'Terima kasih 🙏',
    ].join('\n');
}

/**
 * Bangun tautan wa.me dengan teks ter-encode. Nomor dinormalisasi lebih
 * dulu; nomor tidak valid → null (pemanggil menampilkan pesan error).
 */
export function buildWaLink(
    phone: string | null | undefined,
    message: string,
): string | null {
    const normalized = normalizePhone(phone);
    if (!isValidPhone(normalized)) return null;

    return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

/**
 * Bangun tautan wa.me langsung dari struk + nama toko — gabungan
 * buildReceiptMessage + buildWaLink. null bila nomor tidak valid.
 */
export function buildReceiptWaLink(
    receipt: ReceiptTransaction,
    storeName: string,
): string | null {
    return buildWaLink(
        receipt.customer_phone,
        buildReceiptMessage(receipt, storeName),
    );
}
