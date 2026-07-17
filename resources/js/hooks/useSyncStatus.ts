import { syncService, SyncSnapshot } from '@/lib/offline/syncService';
import { useEffect, useState } from 'react';

/**
 * Snapshot status sinkronisasi untuk UI (Fase 15) — subscribe ke
 * syncService (instance tunggal); ikut ter-update saat online/offline
 * karena syncService menyiarkan ulang pada kedua event tersebut.
 */
export default function useSyncStatus(): SyncSnapshot {
    const [snapshot, setSnapshot] = useState<SyncSnapshot>(
        syncService.getSnapshot(),
    );

    useEffect(() => {
        setSnapshot(syncService.getSnapshot());
        return syncService.subscribe(setSnapshot);
    }, []);

    return snapshot;
}
