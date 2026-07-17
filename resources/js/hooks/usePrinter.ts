import { printerService, PrinterStatus } from '@/lib/printerService';
import { useEffect, useState } from 'react';

/**
 * Status printer Bluetooth untuk UI (Fase 14) — subscribe ke
 * printerService (instance tunggal), otomatis unsubscribe saat
 * komponen dilepas.
 */
export default function usePrinter(): PrinterStatus {
    const [status, setStatus] = useState<PrinterStatus>(
        printerService.getStatus(),
    );

    useEffect(() => {
        setStatus(printerService.getStatus());
        return printerService.subscribe(setStatus);
    }, []);

    return status;
}
