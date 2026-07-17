import { RoundingMethod } from '@/types';

/* Tipe & helper bersama layar Kasir (Fase 4–5) */

export function formatRupiah(value: number): string {
    return 'Rp ' + value.toLocaleString('id-ID');
}

export interface KasirProduct {
    id: number;
    name: string;
    price: number;
    photo_url: string | null;
    category_id: number;
    status: 'aktif' | 'habis';
    track_stock: boolean;
    stock: number;
    sellable: boolean;
}

export interface CartItem {
    product: KasirProduct;
    qty: number;
    note: string;
}

export type DiscountType = 'nominal' | 'percent';

export interface ActivePaymentMethod {
    id: number;
    name: string;
    code: string;
}

export interface TaxSettings {
    enabled: boolean;
    name: string;
    percent: number;
    rounding_method: RoundingMethod;
}

export interface ReceiptProfile {
    name: string;
    logo: string | null;
    address: string | null;
    phone: string | null;
    footer: string | null;
}

export interface ReceiptItem {
    product_name: string;
    price: number;
    quantity: number;
    subtotal: number;
    note: string | null;
}

/** Data struk hasil transaksi — seluruhnya snapshot dari server. */
export interface ReceiptTransaction {
    id: number;
    invoice_number: string;
    date: string;
    kasir: string;
    items: ReceiptItem[];
    subtotal: number;
    discount: number;
    tax_name: string | null;
    tax_percent: number;
    tax_amount: number;
    rounding: number;
    total: number;
    payment_method: string;
    payment_method_label: string;
    paid_amount: number | null;
    change_amount: number | null;
    customer_phone: string | null;
}

/**
 * Nilai pembulatan (bisa +/−) — cermin Transaction::calculateRounding
 * di backend (PRD 5.13.B).
 */
export function calculateRounding(
    amount: number,
    method: RoundingMethod,
): number {
    if (method === 'none' || !method.includes('_')) return 0;

    const [direction, stepRaw] = method.split('_', 2);
    const step = Number(stepRaw);
    if (!step || step <= 0) return 0;

    let rounded = amount;
    if (direction === 'up') rounded = Math.ceil(amount / step) * step;
    else if (direction === 'down') rounded = Math.floor(amount / step) * step;
    else if (direction === 'nearest') rounded = Math.round(amount / step) * step;

    return rounded - amount;
}
