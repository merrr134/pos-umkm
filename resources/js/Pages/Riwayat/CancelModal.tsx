import { AlertTriangleIcon } from '@/Components/Icons';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { TransactionRow } from './riwayat';

/**
 * Dialog pembatalan transaksi (PRD 5.4) — Owner only.
 * Alasan wajib diisi + konfirmasi kedua sebelum submit.
 */
export default function CancelModal({
    transaction,
    onClose,
}: {
    transaction: TransactionRow | null;
    onClose: () => void;
}) {
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (transaction !== null) {
            setReason('');
            setError(null);
            setConfirming(false);
        }
    }, [transaction]);

    const goToConfirm = () => {
        if (reason.trim() === '') {
            setError('Alasan pembatalan wajib diisi.');
            return;
        }

        setError(null);
        setConfirming(true);
    };

    const submit = () => {
        if (transaction === null) return;

        router.post(
            route('riwayat.batal', transaction.id),
            { cancel_reason: reason.trim() },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setProcessing(true),
                onSuccess: () => onClose(),
                onError: (errors) => {
                    setError(
                        errors.cancel_reason ??
                            'Pembatalan gagal. Silakan coba lagi.',
                    );
                    setConfirming(false);
                },
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <Modal show={transaction !== null} onClose={onClose} maxWidth="md">
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                        <AlertTriangleIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-slate-900">
                            {confirming
                                ? 'Konfirmasi Pembatalan'
                                : 'Batalkan Transaksi'}
                        </h2>

                        {!confirming ? (
                            <>
                                <p className="mt-1 text-slate-500">
                                    Transaksi{' '}
                                    <span className="font-semibold text-slate-800">
                                        {transaction?.invoice_number}
                                    </span>{' '}
                                    akan dibatalkan dan stok produk
                                    dikembalikan. Tindakan ini tidak bisa
                                    diurungkan.
                                </p>

                                <label
                                    htmlFor="cancel-reason"
                                    className="mt-4 block font-medium text-slate-900"
                                >
                                    Alasan Pembatalan{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="cancel-reason"
                                    value={reason}
                                    rows={3}
                                    maxLength={255}
                                    placeholder="Contoh: salah input pesanan"
                                    className="mt-2 block w-full rounded-xl border-slate-200 px-4 py-2.5 text-slate-900 placeholder-slate-400 shadow-sm focus:border-red-500 focus:ring-red-500"
                                    onChange={(e) => {
                                        setReason(e.target.value);
                                        if (e.target.value.trim() !== '') {
                                            setError(null);
                                        }
                                    }}
                                />
                                <InputError
                                    message={error ?? undefined}
                                    className="mt-2"
                                />
                            </>
                        ) : (
                            /* Konfirmasi kedua sebelum submit (spesifikasi Fase 6) */
                            <>
                                <p className="mt-1 text-slate-500">
                                    Yakin membatalkan transaksi{' '}
                                    <span className="font-semibold text-slate-800">
                                        {transaction?.invoice_number}
                                    </span>
                                    ? Status berubah menjadi{' '}
                                    <span className="font-semibold text-red-600">
                                        Dibatalkan
                                    </span>{' '}
                                    dan stok dikembalikan sesuai qty transaksi.
                                </p>
                                <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                                    <p className="text-slate-500">Alasan:</p>
                                    <p className="mt-0.5 font-medium text-slate-800">
                                        {reason.trim()}
                                    </p>
                                </div>
                                <InputError
                                    message={error ?? undefined}
                                    className="mt-2"
                                />
                            </>
                        )}
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    {!confirming ? (
                        <>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={goToConfirm}
                                disabled={reason.trim() === ''}
                                className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60"
                            >
                                Lanjutkan
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => setConfirming(false)}
                                disabled={processing}
                                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                            >
                                Kembali
                            </button>
                            <button
                                type="button"
                                onClick={submit}
                                disabled={processing}
                                className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60"
                            >
                                {processing
                                    ? 'Membatalkan…'
                                    : 'Ya, Batalkan Transaksi'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
}
