/* Tipe & helper bersama halaman Laporan (Fase 10) */

export interface DashboardStats {
    today_sales: number;
    month_sales: number;
    month_purchases: number;
    month_expenses: number;
    gross_profit: number;
    net_profit: number;
    has_cost_data: boolean;
    today_transactions: number;
    today_items_sold: number;
}

export interface DailySale {
    date: string; // YYYY-MM-DD
    total: number;
}

export interface NamedStat {
    name: string;
    quantity: number;
    total: number;
}

export interface PaymentStat {
    code: string;
    count: number;
    total: number;
}

export interface CountedStat {
    name: string;
    count: number;
    total: number;
}

export interface DashboardCharts {
    sales_daily: DailySale[];
    top_products: NamedStat[];
    payment_methods: PaymentStat[];
    category_sales: NamedStat[];
}

export interface DashboardAnalytics {
    top_product: NamedStat | null;
    best_kasir: CountedStat | null;
    top_supplier: CountedStat | null;
    top_category: NamedStat | null;
    avg_transaction_value: number;
    avg_items_per_transaction: number;
}

export interface SalesReportRow {
    id: number;
    invoice_number: string;
    date: string; // ISO 8601
    kasir: string;
    items_count: number;
    subtotal: number;
    discount: number;
    tax_amount: number;
    total: number;
    status: 'paid' | 'cancelled';
}

export interface PurchaseReportRow {
    id: number;
    invoice_number: string;
    purchase_date: string;
    supplier: string;
    items_count: number;
    total: number;
}

export interface ExpenseReportRow {
    id: number;
    expense_number: string;
    expense_date: string;
    category: string;
    title: string;
    amount: number;
    payment_method: string;
}

export interface StockReportRow {
    id: number;
    name: string;
    category: string;
    stock: number;
    min_stock: number;
    track_stock: boolean;
    status: 'aktif' | 'habis';
    cost_price: number | null;
    price: number;
    stock_value: number;
}

export interface ReportSummary {
    count: number;
    total: number;
}

export const METHOD_LABELS: Record<string, string> = {
    tunai: 'Tunai',
    qris: 'QRIS',
    transfer: 'Transfer Bank',
    kartu: 'Kartu Debit/Kredit',
};

export function formatReportDate(date: string): string {
    return new Date(date.includes('T') ? date : date + 'T00:00:00')
        .toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
}

export function formatDateTime(date: string): string {
    return new Date(date).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
