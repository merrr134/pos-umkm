import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { StockRow } from './stok';

const inputClass =
    'block w-full rounded-xl border-slate-200 py-2.5 px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

type AdjustmentType = 'tambah' | 'kurang';

/**
 * Modal Penyesuaian Stok / stock opname (Fase 7 — PRD 5.8):
 * jenis tambah/kurang, jumlah minimal 1, alasan wajib.
 */
export default function AdjustmentModal({
    product,
    onClose,
}: {
    product: StockRow | null;
    onClose: () => void;
}) {
    const [type, setType] = useState<AdjustmentType>('tambah');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (product !== null) {
            setType('tambah');
            setQuantity('');
            setReason('');
            setErrors({});
        }
    }, [product]);

    const qty = Number(quantity);
    const delta = type === 'tambah' ? qty : -qty;
    const stockAfter =
        product !== null && quantity !== '' ? product.stock + delta : null;

    const validate = (): boolean => {
        const next: Record<string, string> = {};

        if (quantity === '' || qty < 1) {
            next.quantity = 'Jumlah penyesuaian minimal 1.';
        } else if (product !== null && product.stock + delta < 0) {
            next.quantity = `Pengurangan melebihi stok saat ini (sisa ${product.stock}).`;
        }
        if (reason.trim() === '') {
            next.reason = 'Alasan penyesuaian wajib diisi.';
        }

        setErrors(next);

        return Object.keys(next).length === 0;
    };

    const submit = () => {
        if (product === null || !validate()) return;

        router.post(
            route('stok.penyesuaian', product.id),
            { type, quantity: qty, reason: reason.trim() },
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
                <h2 className="text-lg font-bold text-slate-900">
                    Penyesuaian Stok
                </h2>
                <p className="mt-1 text-slate-500">
                    <span className="font-semibold text-slate-800">
                        {product?.name}
                    </span>{' '}
                    — stok saat ini{' '}
                    <span className="font-semibold text-slate-800">
                        {product?.stock}
                    </span>
                </p>

                {/* Jenis: tambah / kurang */}
                <div className="mt-5">
                    <span className="block font-medium text-slate-900">
                        Jenis Penyesuaian <span className="text-red-500">*</span>
                    </span>
                    <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-1">
                        {(
                            [
                                ['tambah', 'Tambah'],
                                ['kurang', 'Kurang'],
                            ] as [AdjustmentType, string][]
                        ).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setType(value)}
                                className={
                                    'rounded-lg px-4 py-2 text-sm font-semibold transition-colors ' +
                                    (type === value
                                        ? value === 'tambah'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-red-600 text-white'
                                        : 'text-slate-500 hover:bg-slate-50')
                                }
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-4">
                    <label
                        htmlFor="adjustment-quantity"
                        className="block font-medium text-slate-900"
                    >
                        Jumlah <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="adjustment-quantity"
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
                            <span
                                className={
                                    'font-semibold ' +
                                    (stockAfter < 0
                                        ? 'text-red-600'
                                        : 'text-slate-800')
                                }
                            >
                                {stockAfter}
                            </span>
                        </p>
                    )}
                    <InputError message={errors.quantity} className="mt-2" />
                </div>

                <div className="mt-4">
                    <label
                        htmlFor="adjustment-reason"
                        className="block font-medium text-slate-900"
                    >
                        Alasan <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        id="adjustment-reason"
                        value={reason}
                        rows={2}
                        maxLength={255}
                        placeholder="Contoh: rusak, hilang, koreksi stock opname"
                        className={inputClass + ' mt-2'}
                        onChange={(e) => setReason(e.target.value)}
                    />
                    <InputError message={errors.reason} className="mt-2" />
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
                        {processing ? 'Menyimpan…' : 'Simpan Penyesuaian'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
