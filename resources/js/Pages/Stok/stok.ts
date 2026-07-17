/* Tipe & helper bersama halaman Manajemen Stok (Fase 7) */

export type StockStatus = 'normal' | 'menipis' | 'habis' | 'untracked';

/** Baris tabel stok — ringkasan per produk. */
export interface StockRow {
    id: number;
    name: string;
    photo_url: string | null;
    category: string | null;
    track_stock: boolean;
    stock: number;
    min_stock: number;
    stock_status: StockStatus;
}

export interface StockStats {
    total: number;
    normal: number;
    menipis: number;
    habis: number;
}

export type MovementType =
    | 'sale'
    | 'purchase'
    | 'adjustment'
    | 'restock'
    | 'cancel_transaction';

/** Baris riwayat pergerakan stok — append-only dari stock_movements. */
export interface MovementRow {
    id: number;
    date: string; // ISO 8601
    product: string;
    type: MovementType;
    quantity_change: number;
    stock_before: number;
    stock_after: number;
    user: string;
    reason: string | null;
}

export const movementTypeLabels: Record<MovementType, string> = {
    sale: 'Penjualan',
    purchase: 'Pembelian',
    adjustment: 'Penyesuaian',
    restock: 'Restock',
    cancel_transaction: 'Pembatalan Transaksi',
};

export function formatMovementDate(iso: string): string {
    return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
