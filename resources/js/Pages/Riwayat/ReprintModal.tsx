import Modal from '@/Components/Modal';
import PrintButton from '@/Components/PrintButton';
import { ReceiptProfile } from '@/Pages/Kasir/kasir';
import { ReceiptPreview } from '@/Pages/Kasir/ReceiptModal';
import { TransactionDetail } from './riwayat';

/**
 * Cetak ulang struk dari Riwayat (PRD 5.5) — memakai komponen Receipt
 * yang sama dengan Fase 5 (template tunggal, area cetak #receipt-print).
 */
export default function ReprintModal({
    show,
    detail,
    profile,
    onClose,
}: {
    show: boolean;
    detail: TransactionDetail | null;
    profile: ReceiptProfile;
    onClose: () => void;
}) {
    if (detail === null) return null;

    return (
        <Modal show={show} onClose={onClose} maxWidth="sm">
            <div className="p-6">
                <h2 className="text-lg font-bold text-slate-900">
                    Cetak Ulang Struk
                </h2>
                <p className="text-sm text-slate-500">
                    {detail.invoice_number}
                </p>

                {/* Preview struk sebelum print (PRD 5.5) */}
                <div className="mt-4 max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 py-4">
                    <div className="shadow-sm">
                        <ReceiptPreview receipt={detail} profile={profile} />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        Tutup
                    </button>
                    <PrintButton receipt={detail} profile={profile} />
                </div>
            </div>
        </Modal>
    );
}
