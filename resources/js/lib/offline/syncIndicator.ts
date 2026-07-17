import { SyncSnapshot } from './syncService';

/**
 * Turunan tampilan indikator sinkronisasi (Fase 15 — PRD 5.14):
 * 🟢 Online · 🟡 Pending Sync · 🔵 Sedang Sinkronisasi · 🔴 Gagal/Offline.
 * Fungsi murni — dipakai komponen SyncIndicator dan diuji unit.
 */

export interface SyncIndicatorUi {
    emoji: '🟢' | '🟡' | '🔵' | '🔴';
    label: string;
    /** Kelas warna titik indikator (Tailwind). */
    dotClass: string;
}

export function deriveSyncIndicator(snapshot: SyncSnapshot): SyncIndicatorUi {
    if (snapshot.state === 'syncing') {
        return {
            emoji: '🔵',
            label: 'Sedang Sinkronisasi',
            dotClass: 'bg-blue-500 motion-safe:animate-pulse',
        };
    }

    if (snapshot.failed > 0) {
        return {
            emoji: '🔴',
            label: `Sinkronisasi Gagal (${snapshot.failed})`,
            dotClass: 'bg-red-500',
        };
    }

    if (snapshot.pending > 0) {
        return {
            emoji: '🟡',
            label: `Pending Sync (${snapshot.pending})`,
            dotClass: 'bg-amber-400',
        };
    }

    if (!snapshot.online) {
        return {
            emoji: '🔴',
            label: 'Offline',
            dotClass: 'bg-red-500',
        };
    }

    return { emoji: '🟢', label: 'Online', dotClass: 'bg-green-500' };
}
