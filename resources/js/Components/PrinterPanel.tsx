import {
    AlertTriangleIcon,
    BluetoothIcon,
    CheckCircleIcon,
    PrinterIcon,
    XIcon,
} from '@/Components/Icons';
import { ToastShell } from '@/Components/motion';
import usePrinter from '@/hooks/usePrinter';
import { encodeTestPrint } from '@/lib/escpos';
import { PrinterError, printerService } from '@/lib/printerService';
import { useEffect, useRef, useState } from 'react';

/**
 * Panel status & kontrol printer Bluetooth (Fase 14 — PRD 5.5).
 *
 * Indikator: 🟢 Terhubung / 🟡 Menghubungkan… / 🔴 Tidak Terhubung.
 * Tombol: Hubungkan Printer, Putuskan Printer, Tes Cetak.
 * Semua pesan (toast) dalam Bahasa Indonesia; kegagalan apa pun tidak
 * menghalangi transaksi — cetak selalu bisa fallback ke browser.
 */

const STATUS_UI = {
    connected: { dot: 'bg-green-500', label: 'Printer Terhubung' },
    connecting: {
        dot: 'bg-amber-400 motion-safe:animate-pulse',
        label: 'Menghubungkan...',
    },
    disconnected: { dot: 'bg-red-500', label: 'Tidak Terhubung' },
} as const;

interface PanelToast {
    type: 'success' | 'error';
    message: string;
}

export default function PrinterPanel({
    storeName = 'Pitou Cafe',
}: {
    storeName?: string;
}) {
    const status = usePrinter();
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState<PanelToast | null>(null);
    const toastTimer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(toastTimer.current), []);

    const showToast = (type: PanelToast['type'], message: string) => {
        setToast({ type, message });
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 4000);
    };

    const errorMessage = (error: unknown): string =>
        error instanceof PrinterError
            ? error.message
            : 'Terjadi kesalahan pada printer. Coba lagi.';

    const handleConnect = async () => {
        if (!printerService.isSupported()) {
            showToast(
                'error',
                'Browser ini tidak mendukung Web Bluetooth. Struk tetap bisa dicetak lewat browser.',
            );
            return;
        }

        setBusy(true);
        try {
            await printerService.connect();
            const name = printerService.getDeviceName();
            showToast(
                'success',
                name
                    ? `Printer "${name}" berhasil terhubung.`
                    : 'Printer berhasil terhubung.',
            );
        } catch (error) {
            showToast('error', errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    const handleDisconnect = () => {
        printerService.disconnect();
        showToast('success', 'Printer diputuskan.');
    };

    const handleTestPrint = async () => {
        setBusy(true);
        try {
            await printerService.print(encodeTestPrint(storeName));
            showToast('success', 'Tes cetak terkirim ke printer.');
        } catch (error) {
            showToast('error', errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    const ui = STATUS_UI[status];
    const connected = status === 'connected';

    const buttonClass =
        'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

    return (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
            {/* Indikator status */}
            <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 rounded-full ${ui.dot}`}
                />
                {ui.label}
            </span>

            {connected ? (
                <>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={handleTestPrint}
                        className={buttonClass}
                    >
                        <PrinterIcon className="h-3.5 w-3.5" />
                        Tes Cetak
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={handleDisconnect}
                        className={buttonClass}
                    >
                        <XIcon className="h-3.5 w-3.5" />
                        Putuskan Printer
                    </button>
                </>
            ) : (
                <button
                    type="button"
                    disabled={busy || status === 'connecting'}
                    onClick={handleConnect}
                    className={buttonClass}
                >
                    <BluetoothIcon className="h-3.5 w-3.5" />
                    Hubungkan Printer
                </button>
            )}

            {/* Toast printer — Bahasa Indonesia */}
            <ToastShell
                show={toast !== null}
                className={
                    'fixed right-4 top-4 z-[70] flex max-w-sm items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg sm:right-6 sm:top-6 print:hidden ' +
                    (toast?.type === 'success'
                        ? 'border-green-200'
                        : 'border-red-200')
                }
            >
                {toast?.type === 'success' ? (
                    <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                ) : (
                    <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                )}
                <p className="text-sm font-medium text-slate-800">
                    {toast?.message}
                </p>
            </ToastShell>
        </div>
    );
}
