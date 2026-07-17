import { ReceiptProfile, ReceiptTransaction } from '@/Pages/Kasir/kasir';
import { encodeReceipt } from './escpos';
import {
    BluetoothPrinterService,
    PrinterError,
    PRINTER_ERROR_MESSAGES,
    printerService,
} from './printerService';

/**
 * Orkestrasi cetak struk (Fase 14 — PRD Bab 9): coba printer
 * Bluetooth dulu, gagal apa pun → fallback otomatis ke print browser.
 *
 * Fungsi ini TIDAK PERNAH melempar error — transaksi sudah tersimpan
 * sebelum cetak dipanggil, dan kegagalan cetak tidak boleh mengganggu
 * alur penyelesaian transaksi (struk selalu bisa dicetak ulang dari
 * Riwayat Transaksi).
 */

export interface PrintResult {
    /** Jalur cetak yang benar-benar dipakai. */
    via: 'bluetooth' | 'browser';
    /** false hanya jika dialog print browser juga gagal dibuka. */
    ok: boolean;
    /**
     * Alasan beralih ke browser (Bahasa Indonesia) — null bila
     * Bluetooth memang tidak dipakai karena printer belum terhubung.
     */
    fallbackReason: string | null;
}

function browserPrint(): boolean {
    try {
        if (typeof window !== 'undefined') {
            window.print();
            return true;
        }
    } catch {
        // jatuh ke return false
    }
    return false;
}

export async function printReceipt(
    receipt: ReceiptTransaction,
    profile: ReceiptProfile,
    service: BluetoothPrinterService = printerService,
): Promise<PrintResult> {
    let fallbackReason: string | null = null;

    if (!service.isSupported()) {
        fallbackReason = PRINTER_ERROR_MESSAGES.unsupported;
    } else if (service.isConnected()) {
        try {
            await service.print(encodeReceipt(receipt, profile));
            return { via: 'bluetooth', ok: true, fallbackReason: null };
        } catch (error) {
            fallbackReason =
                error instanceof PrinterError
                    ? error.message
                    : PRINTER_ERROR_MESSAGES['write-failed'];
        }
    }
    // Printer belum terhubung → langsung print browser tanpa pesan
    // (fallbackReason tetap null; jalur normal tanpa Bluetooth).

    return { via: 'browser', ok: browserPrint(), fallbackReason };
}
