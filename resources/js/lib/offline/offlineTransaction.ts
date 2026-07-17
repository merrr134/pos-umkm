import {
    CartItem,
    DiscountType,
    ReceiptTransaction,
    TaxSettings,
} from '@/Pages/Kasir/kasir';
import { decrementSnapshotStock } from './kasirCache';
import { enqueueTransaction } from './offlineQueue';
import { syncService } from './syncService';

/**
 * Pembuatan transaksi saat offline (Fase 15 — PRD 5.14).
 *
 * Transaksi TIDAK dikirim ke server; disimpan ke antrean IndexedDB
 * dengan status pending + client_uuid untuk dedup, lalu disinkronkan
 * otomatis oleh syncService saat online. Struk lokal dikembalikan agar
 * kasir tetap bisa menunjukkan/cetak struk (nomor invoice final akan
 * diassign server saat sinkronisasi — PRD Bab 12).
 */

export const OFFLINE_INVOICE_PREFIX = 'OFFLINE-';

/** UUID v4 — fallback manual bila crypto.randomUUID tidak tersedia. */
export function generateClientUuid(): string {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export interface OfflineTransactionInput {
    cart: CartItem[];
    discountType: DiscountType;
    discountValue: string;
    subtotal: number;
    discount: number;
    tax: number;
    rounding: number;
    total: number;
    taxSettings: TaxSettings;
    methodCode: string;
    methodLabel: string;
    paidAmount: number | null;
    customerPhone: string | null;
    kasirName: string;
}

/**
 * Simpan transaksi ke antrean offline; mengembalikan struk lokal.
 * Stok pada snapshot Kasir ikut dikurangi supaya transaksi offline
 * berikutnya melihat sisa stok terkini.
 */
export async function createOfflineTransaction(
    input: OfflineTransactionInput,
): Promise<ReceiptTransaction> {
    const clientUuid = generateClientUuid();
    const isCash = input.methodCode === 'tunai';

    const payload: Record<string, unknown> = {
        client_uuid: clientUuid,
        items: input.cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.qty,
            note: item.note !== '' ? item.note : null,
        })),
        discount_type:
            Number(input.discountValue) > 0 ? input.discountType : null,
        discount_value:
            Number(input.discountValue) > 0 ? input.discountValue : null,
        payment_method: input.methodCode,
        paid_amount: isCash ? input.paidAmount : null,
        customer_phone: input.customerPhone,
    };

    // Struk lokal — perhitungan sama dengan PaymentModal; nilai final
    // (invoice, pajak) tetap dihitung ulang server saat sinkronisasi.
    const receipt: ReceiptTransaction = {
        id: 0,
        invoice_number:
            OFFLINE_INVOICE_PREFIX +
            clientUuid.slice(0, 8).toUpperCase(),
        date: new Date().toISOString(),
        kasir: input.kasirName,
        items: input.cart.map((item) => ({
            product_name: item.product.name,
            price: item.product.price,
            quantity: item.qty,
            subtotal: item.product.price * item.qty,
            note: item.note !== '' ? item.note : null,
        })),
        subtotal: input.subtotal,
        discount: input.discount,
        tax_name: input.taxSettings.enabled ? input.taxSettings.name : null,
        tax_percent: input.taxSettings.enabled ? input.taxSettings.percent : 0,
        tax_amount: input.tax,
        rounding: input.rounding,
        total: input.total,
        payment_method: input.methodCode,
        payment_method_label: input.methodLabel,
        paid_amount: isCash ? input.paidAmount : null,
        change_amount:
            isCash && input.paidAmount !== null
                ? input.paidAmount - input.total
                : null,
        customer_phone: input.customerPhone,
    };

    await enqueueTransaction(payload, receipt);
    await decrementSnapshotStock(
        input.cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.qty,
        })),
    );
    await syncService.refresh();

    return receipt;
}

/** Apakah struk berasal dari transaksi offline yang belum tersinkron. */
export function isOfflineReceipt(receipt: ReceiptTransaction): boolean {
    return receipt.invoice_number.startsWith(OFFLINE_INVOICE_PREFIX);
}
