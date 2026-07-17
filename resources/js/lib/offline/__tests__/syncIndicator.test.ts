import { describe, expect, it } from 'vitest';
import { SyncSnapshot } from '../syncService';
import { deriveSyncIndicator } from '../syncIndicator';

function snap(overrides: Partial<SyncSnapshot>): SyncSnapshot {
    return {
        state: 'idle',
        online: true,
        pending: 0,
        failed: 0,
        lastError: null,
        ...overrides,
    };
}

describe('deriveSyncIndicator (Fase 15)', () => {
    it('🟢 Online saat idle, online, tanpa antrean', () => {
        const ui = deriveSyncIndicator(snap({}));
        expect(ui.emoji).toBe('🟢');
        expect(ui.label).toBe('Online');
    });

    it('🔵 Sedang Sinkronisasi saat state syncing', () => {
        const ui = deriveSyncIndicator(snap({ state: 'syncing', pending: 2 }));
        expect(ui.emoji).toBe('🔵');
        expect(ui.label).toBe('Sedang Sinkronisasi');
    });

    it('🟡 Pending Sync saat ada pending (idle)', () => {
        const ui = deriveSyncIndicator(snap({ pending: 3 }));
        expect(ui.emoji).toBe('🟡');
        expect(ui.label).toContain('Pending Sync');
        expect(ui.label).toContain('3');
    });

    it('🔴 Sinkronisasi Gagal saat ada failed', () => {
        const ui = deriveSyncIndicator(snap({ failed: 1, pending: 2 }));
        expect(ui.emoji).toBe('🔴');
        expect(ui.label).toContain('Gagal');
        expect(ui.label).toContain('1');
    });

    it('🔴 Offline saat tidak online & antrean kosong', () => {
        const ui = deriveSyncIndicator(snap({ online: false }));
        expect(ui.emoji).toBe('🔴');
        expect(ui.label).toBe('Offline');
    });

    it('failed diprioritaskan di atas pending', () => {
        const ui = deriveSyncIndicator(
            snap({ failed: 2, pending: 5, online: false }),
        );
        expect(ui.label).toContain('Gagal');
    });
});
