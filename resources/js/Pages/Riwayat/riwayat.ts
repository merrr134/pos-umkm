import { ReceiptTransaction } from '@/Pages/Kasir/kasir';

/* Tipe bersama halaman Riwayat Transaksi (Fase 6) */

export type TransactionStatus = 'paid' | 'cancelled';

/** Baris tabel riwayat — ringkasan per transaksi. */
export interface TransactionRow {
    id: number;
    invoice_number: string;
    date: string; // ISO 8601
    kasir: string;
    payment_method: string;
    status: TransactionStatus;
    total: number;
    items_count: number;
}

/**
 * Detail transaksi — superset data struk Fase 5 (semua dari snapshot)
 * + status & info pembatalan.
 */
export interface TransactionDetail extends ReceiptTransaction {
    status: TransactionStatus;
    cancel_reason: string | null;
    cancelled_by: string | null;
    cancelled_at: string | null;
}

export interface RiwayatFilters {
    date_from: string;
    date_to: string;
    search: string;
    payment_method: string | null;
    status: string | null;
    kasir: number | null;
}

export function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatDateTime(iso: string): string {
    return `${formatDate(iso)} ${formatTime(iso)}`;
}
