/* Tipe bersama halaman Supplier (Fase 8) */

export type SupplierStatus = 'aktif' | 'nonaktif';

export interface SupplierRow {
    id: number;
    code: string;
    name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    status: SupplierStatus;
    created_at: string | null;
    deleted_at: string | null;
}

export interface SupplierStats {
    total: number;
    aktif: number;
    nonaktif: number;
    terhapus: number;
}

export interface SupplierPermissions {
    manage: boolean; // tambah & edit (Owner/Admin)
    delete: boolean; // soft delete (Owner)
    viewTrash: boolean; // daftar terhapus + restore (Owner)
}

export function formatSupplierDate(iso: string | null): string {
    if (iso === null) return '—';

    return new Date(iso).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}
