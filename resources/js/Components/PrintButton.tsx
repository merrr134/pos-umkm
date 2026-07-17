import { PrinterIcon } from '@/Components/Icons';
import usePrinter from '@/hooks/usePrinter';
import { printReceipt } from '@/lib/printReceipt';
import { ReceiptProfile, ReceiptTransaction } from '@/Pages/Kasir/kasir';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Tombol cetak dengan penanganan gagal (PRD Bab 9, Fase 12) +
 * animasi printer kecil saat mencetak (PRD Bab 14, Fase 13) —
 * status kembali normal setelah dialog print browser selesai
 * (event afterprint, fallback timeout).
 *
 * Fase 14: bila data struk diberikan dan printer Bluetooth sedang
 * terhubung, cetak dikirim sebagai ESC/POS via Bluetooth lebih dulu;
 * gagal apa pun → fallback otomatis ke print browser dengan pemberi-
 * tahuan. Transaksi sudah tersimpan sebelum tombol ini tampil, jadi
 * kegagalan cetak tidak pernah menghilangkan data; struk juga selalu
 * bisa dicetak ulang dari Riwayat Transaksi.
 */
export default function PrintButton({
    label = 'Cetak Struk',
    receipt,
    profile,
}: {
    label?: string;
    receipt?: ReceiptTransaction;
    profile?: ReceiptProfile;
}) {
    const reduced = useReducedMotion();
    const printerStatus = usePrinter();
    const [failed, setFailed] = useState(false);
    const [printing, setPrinting] = useState(false);
    const [notice, setNotice] = useState<{
        type: 'success' | 'warn';
        text: string;
    } | null>(null);

    useEffect(() => {
        const done = () => setPrinting(false);
        window.addEventListener('afterprint', done);

        return () => window.removeEventListener('afterprint', done);
    }, []);

    useEffect(() => {
        if (printing) {
            // Fallback bila browser tidak memicu afterprint
            const timer = window.setTimeout(() => setPrinting(false), 2500);

            return () => window.clearTimeout(timer);
        }
    }, [printing]);

    const handlePrint = async () => {
        setPrinting(true);
        setNotice(null);

        // Jalur Bluetooth-first hanya bila data struk tersedia
        if (receipt && profile) {
            const result = await printReceipt(receipt, profile);

            if (result.via === 'bluetooth') {
                setPrinting(false);
                setFailed(false);
                setNotice({
                    type: 'success',
                    text: 'Struk dicetak lewat printer Bluetooth.',
                });
                return;
            }

            // Fallback browser print sudah dijalankan di printReceipt
            if (result.fallbackReason !== null) {
                setNotice({
                    type: 'warn',
                    text: `${result.fallbackReason} Struk dialihkan ke cetak browser.`,
                });
            }
            if (!result.ok) {
                setPrinting(false);
                setFailed(true);
            } else {
                setFailed(false);
            }
            return;
        }

        // Tanpa data struk → perilaku lama: dialog print browser
        try {
            window.print();
            setFailed(false);
        } catch {
            setPrinting(false);
            setFailed(true);
        }
    };

    return (
        <div className="flex flex-col items-end gap-2">
            {failed && (
                <p role="alert" className="text-sm text-red-600">
                    Gagal membuka dialog cetak. Periksa printer, lalu coba
                    lagi — transaksi sudah tersimpan.
                </p>
            )}
            {notice && (
                <p
                    role="status"
                    className={
                        'text-sm ' +
                        (notice.type === 'success'
                            ? 'text-green-600'
                            : 'text-amber-600')
                    }
                >
                    {notice.text}
                </p>
            )}
            <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0A45FE] px-6 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1]"
            >
                {printing ? (
                    <>
                        <motion.span
                            className="inline-flex"
                            animate={
                                reduced ? undefined : { y: [0, 2, 0] }
                            }
                            transition={{
                                duration: 0.5,
                                repeat: Infinity,
                                ease: 'easeInOut',
                            }}
                        >
                            <PrinterIcon className="h-4 w-4" />
                        </motion.span>
                        Mencetak…
                    </>
                ) : (
                    <>
                        <PrinterIcon className="h-4 w-4" />
                        {failed ? 'Coba Lagi' : label}
                    </>
                )}
            </button>
            {receipt && profile && printerStatus === 'connected' && (
                <p className="text-xs text-slate-400">
                    Printer Bluetooth terhubung — struk dicetak via Bluetooth.
                </p>
            )}
        </div>
    );
}
