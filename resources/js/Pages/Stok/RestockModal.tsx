import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { StockRow } from './stok';

const inputClass =
    'block w-full rounded-xl border-slate-200 py-2.5 px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

/**
 * Modal Restock manual (Fase 7) — menambah stok + catatan opsional.
 * Pembelian dari supplier menyusul di Fase 8.
 */
export default function RestockModal({
    product,
    onClose,
}: {
    product: StockRow | null;
    onClose: () => void;
}) {
    const [quantity, setQuantity] = useState('');
    const [note, setNote] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (product !== null) {
            setQuantity('');
            setNote('');
            setErrors({});
        }
    }, [product]);

    const qty = Number(quantity);
    const stockAfter =
        product !== null && quantity !== '' ? product.stock + qty : null;

    const submit = () => {
        if (product === null) return;

        if (quantity === '' || qty < 1) {
            setErrors({ quantity: 'Jumlah restock minimal 1.' });
            return;
        }

        router.post(
            route('stok.restock', product.id),
            { quantity: qty, note: note.trim() },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setProcessing(true),
                onSuccess: () => onClose(),
                onError: (serverErrors) => setErrors(serverErrors),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <Modal show={product !== null} onClose={onClose} maxWidth="md">
            <div className="p-6">
                <h2 className="text-lg font-bold text-slate-900">Restock</h2>
                <p className="mt-1 text-slate-500">
                    <span className="font-semibold text-slate-800">
                        {product?.name}
                    </span>{' '}
                    — stok saat ini{' '}
                    <span className="font-semibold text-slate-800">
                        {product?.stock}
                    </span>
                </p>

                <div className="mt-5">
                    <label
                        htmlFor="restock-quantity"
                        className="block font-medium text-slate-900"
                    >
                        Jumlah Stok <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="restock-quantity"
                        type="number"
                        min={1}
                        value={quantity}
                        placeholder="0"
                        className={inputClass + ' mt-2'}
                        onChange={(e) => setQuantity(e.target.value)}
                    />
                    {stockAfter !== null && errors.quantity === undefined && (
                        <p className="mt-1.5 text-sm text-slate-500">
                            Stok menjadi:{' '}
                            <span className="font-semibold text-slate-800">
                                {stockAfter}
                            </span>
                        </p>
                    )}
                    <InputError message={errors.quantity} className="mt-2" />
                </div>

                <div className="mt-4">
                    <label
                        htmlFor="restock-note"
                        className="block font-medium text-slate-900"
                    >
                        Catatan
                    </label>
                    <textarea
                        id="restock-note"
                        value={note}
                        rows={2}
                        maxLength={255}
                        placeholder="Contoh: restock dari gudang"
                        className={inputClass + ' mt-2'}
                        onChange={(e) => setNote(e.target.value)}
                    />
                    <InputError message={errors.note} className="mt-2" />
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={processing}
                        className="rounded-xl bg-[#0A45FE] px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1] disabled:opacity-60"
                    >
                        {processing ? 'Menyimpan…' : 'Simpan Restock'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
