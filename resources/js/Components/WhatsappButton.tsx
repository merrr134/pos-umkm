import { WhatsAppIcon } from '@/Components/Icons';
import { buildReceiptWaLink, normalizePhone } from '@/lib/whatsapp';
import { ReceiptTransaction } from '@/Pages/Kasir/kasir';
import { PageProps } from '@/types';
import { usePage } from '@inertiajs/react';

/**
 * Tombol "Kirim via WhatsApp" (Fase 16 — PRD 5.5).
 *
 * Muncul HANYA jika pengaturan WhatsApp = ON (shared prop) dan nomor
 * pelanggan terisi — fitur benar-benar opsional. Tidak pernah membuka
 * WhatsApp otomatis: user yang menekan tombol. Klik → buka tautan
 * wa.me di tab baru (tanpa API berbayar). Nomor tidak valid → onError.
 */
export default function WhatsappButton({
    receipt,
    onError,
    className,
    label = 'Kirim via WhatsApp',
}: {
    receipt: ReceiptTransaction;
    onError?: (message: string) => void;
    className?: string;
    label?: string;
}) {
    const { whatsapp, store } = usePage<PageProps>().props;

    // Setting OFF → tombol tidak dirender & tidak ada link WA dibuat.
    if (!whatsapp.enabled) return null;

    // Nomor kosong → tombol tidak muncul (PRD Fase 16 §3).
    if (normalizePhone(receipt.customer_phone) === '') return null;

    const handleSend = () => {
        const link = buildReceiptWaLink(receipt, store.name);

        if (link === null) {
            onError?.('Nomor WhatsApp pelanggan tidak valid.');
            return;
        }

        window.open(link, '_blank', 'noopener,noreferrer');
    };

    return (
        <button
            type="button"
            onClick={handleSend}
            className={
                className ??
                'inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#1da851]'
            }
        >
            <WhatsAppIcon className="h-4 w-4" />
            {label}
        </button>
    );
}
