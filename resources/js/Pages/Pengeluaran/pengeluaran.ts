/* Tipe & helper bersama halaman Pengeluaran (Fase 9) */

export interface ExpenseRow {
    id: number;
    expense_number: string;
    expense_date: string; // YYYY-MM-DD
    expense_category_id: number;
    category: string;
    title: string;
    amount: number;
    payment_method: string;
    notes: string | null;
    receipt_url: string | null;
    receipt_is_pdf: boolean;
    user: string;
    created_at: string;
    deleted_at: string | null;
}

export interface ExpenseCategoryOption {
    id: number;
    name: string;
    is_active: boolean;
    expenses_count: number;
}

export interface PaymentMethodOption {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
}

export interface ExpenseStats {
    total: number;
    hari_ini: number;
    bulan_ini: number;
    total_nominal: number;
}

export interface ExpenseFilters {
    search: string;
    category: number | null;
    payment_method: string | null;
    date_from: string;
    date_to: string;
    trashed: boolean;
}

export function formatExpenseDate(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

/** Tanggal hari ini (timezone lokal) untuk default form — YYYY-MM-DD. */
export function todayLocalDate(): string {
    return new Date().toLocaleDateString('en-CA');
}
