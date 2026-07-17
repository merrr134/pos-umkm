import { Role } from '@/types';

/* Tipe & helper bersama halaman Manajemen Pengguna (Fase 11) */

export interface UserRow {
    id: number;
    name: string;
    username: string;
    role: Role;
    is_active: boolean;
    photo_url: string | null;
    last_login_at: string | null; // ISO 8601
    last_login_ip: string | null;
}

export interface UserStats {
    total: number;
    aktif: number;
    nonaktif: number;
    total_role: number;
}

export const ROLE_LABELS: Record<Role, string> = {
    owner: 'Owner',
    admin: 'Admin',
    kasir: 'Kasir',
};

export function formatLastLogin(iso: string | null): string {
    if (iso === null) {
        return 'Belum pernah login';
    }

    return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
