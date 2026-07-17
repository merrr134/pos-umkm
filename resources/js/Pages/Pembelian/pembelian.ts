/* Tipe & helper bersama halaman Pembelian (Fase 9) */

export interface PurchaseRow {
    id: number;
    invoice_number: string;
    purchase_date: string; // YYYY-MM-DD
    supplier: string;
    items_count: number;
    total: number;
    user: string;
}

export interface PurchaseDetailItem {
    product: string;
    quantity: number;
    cost_price: number;
    subtotal: number;
}

export interface PurchaseDetail {
    id: number;
    invoice_number: string;
    purchase_date: string;
    supplier: { code: string; name: string };
    user: string;
    items: PurchaseDetailItem[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    notes: string | null;
    created_at: string;
}

export interface SupplierOption {
    id: number;
    code: string;
    name: string;
    status: 'aktif' | 'nonaktif';
}

export interface ProductOption {
    id: number;
    name: string;
    cost_price: number | null;
    stock: number;
}

export interface PurchaseStats {
    total: number;
    hari_ini: number;
    bulan_ini: number;
    total_nilai: number;
}

export function formatPurchaseDate(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}
