import { PlusIcon, TrashIcon } from '@/Components/Icons';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { formatRupiah } from '@/Pages/Kasir/kasir';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { ProductOption, SupplierOption } from './pembelian';

const inputClass =
    'block w-full rounded-xl border-slate-200 py-2.5 px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

interface ItemRow {
    product_id: string;
    quantity: string;
    cost_price: string;
}

const emptyRow: ItemRow = { product_id: '', quantity: '', cost_price: '' };

function todayString(): string {
    return new Date().toLocaleDateString('en-CA');
}

/**
 * Form Pembelian (Fase 9 — PRD 5.9): pilih supplier + banyak item
 * (produk, qty, harga modal). Subtotal & total dihitung otomatis;
 * angka final tetap dihitung ulang di server.
 */
export default function FormModal({
    show,
    suppliers,
    products,
    onClose,
}: {
    show: boolean;
    suppliers: SupplierOption[];
    products: ProductOption[];
    onClose: () => void;
}) {
    const [supplierId, setSupplierId] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(todayString());
    const [notes, setNotes] = useState('');
    const [rows, setRows] = useState<ItemRow[]>([{ ...emptyRow }]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (show) {
            setSupplierId('');
            setPurchaseDate(todayString());
            setNotes('');
            setRows([{ ...emptyRow }]);
            setErrors({});
        }
    }, [show]);

    // Hanya supplier aktif yang bisa dipilih untuk pembelian baru
    const activeSuppliers = suppliers.filter((s) => s.status === 'aktif');

    const productById = new Map(products.map((p) => [String(p.id), p]));

    const usedProductIds = new Set(
        rows.map((row) => row.product_id).filter((id) => id !== ''),
    );

    const updateRow = (index: number, patch: Partial<ItemRow>) => {
        setRows((previous) =>
            previous.map((row, i) =>
                i === index ? { ...row, ...patch } : row,
            ),
        );
    };

    const selectProduct = (index: number, productId: string) => {
        const product = productById.get(productId);

        updateRow(index, {
            product_id: productId,
            // Prefill harga modal terakhir bila ada
            cost_price:
                product?.cost_price != null
                    ? String(product.cost_price)
                    : rows[index].cost_price,
        });
    };

    const addRow = () => setRows((previous) => [...previous, { ...emptyRow }]);

    const removeRow = (index: number) =>
        setRows((previous) => previous.filter((_, i) => i !== index));

    const rowSubtotal = (row: ItemRow): number => {
        const qty = Number(row.quantity);
        const cost = Number(row.cost_price);

        return qty >= 1 && cost >= 1 ? qty * cost : 0;
    };

    const total = rows.reduce((sum, row) => sum + rowSubtotal(row), 0);

    const validate = (): boolean => {
        const next: Record<string, string> = {};

        if (supplierId === '') {
            next.supplier_id = 'Supplier wajib dipilih.';
        }
        if (purchaseDate === '') {
            next.purchase_date = 'Tanggal pembelian wajib diisi.';
        }

        rows.forEach((row, index) => {
            if (row.product_id === '') {
                next[`items.${index}.product_id`] = 'Produk wajib dipilih.';
            }
            if (row.quantity === '' || Number(row.quantity) < 1) {
                next[`items.${index}.quantity`] = 'Qty minimal 1.';
            }
            if (row.cost_price === '' || Number(row.cost_price) < 1) {
                next[`items.${index}.cost_price`] =
                    'Harga modal harus lebih dari 0.';
            }
        });

        setErrors(next);

        return Object.keys(next).length === 0;
    };

    const submit = () => {
        if (!validate()) return;

        router.post(
            route('pembelian.store'),
            {
                supplier_id: Number(supplierId),
                purchase_date: purchaseDate,
                notes: notes.trim(),
                items: rows.map((row) => ({
                    product_id: Number(row.product_id),
                    quantity: Number(row.quantity),
                    cost_price: Number(row.cost_price),
                })),
            },
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

    // Error umum level items (mis. produk tanpa kelola stok / duplikat)
    const generalError = errors.items;

    return (
        <Modal show={show} onClose={onClose} maxWidth="2xl">
            <div className="max-h-[90vh] overflow-y-auto p-6">
                <h2 className="text-lg font-bold text-slate-900">
                    Tambah Pembelian
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    Nomor pembelian dibuat otomatis (PUR-YYYYMMDD-0001). Stok
                    dan harga modal produk diperbarui setelah disimpan.
                </p>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                        <label
                            htmlFor="purchase-supplier"
                            className="block font-medium text-slate-900"
                        >
                            Supplier <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="purchase-supplier"
                            value={supplierId}
                            className={inputClass + ' mt-2'}
                            onChange={(e) => setSupplierId(e.target.value)}
                        >
                            <option value="">Pilih supplier</option>
                            {activeSuppliers.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                    {supplier.code} — {supplier.name}
                                </option>
                            ))}
                        </select>
                        <InputError
                            message={errors.supplier_id}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="purchase-date"
                            className="block font-medium text-slate-900"
                        >
                            Tanggal <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="purchase-date"
                            type="date"
                            value={purchaseDate}
                            className={inputClass + ' mt-2'}
                            onChange={(e) => setPurchaseDate(e.target.value)}
                        />
                        <InputError
                            message={errors.purchase_date}
                            className="mt-2"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label
                            htmlFor="purchase-notes"
                            className="block font-medium text-slate-900"
                        >
                            Catatan
                        </label>
                        <textarea
                            id="purchase-notes"
                            value={notes}
                            rows={2}
                            maxLength={500}
                            placeholder="Catatan pembelian (opsional)"
                            className={inputClass + ' mt-2'}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                        <InputError message={errors.notes} className="mt-2" />
                    </div>
                </div>

                {/* Daftar item */}
                <div className="mt-5">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">
                            Daftar Item <span className="text-red-500">*</span>
                        </span>
                        <button
                            type="button"
                            onClick={addRow}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-[#0A45FE] transition-colors hover:bg-blue-50"
                        >
                            <PlusIcon className="h-4 w-4" />
                            Tambah Item
                        </button>
                    </div>

                    {generalError && (
                        <p className="mt-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
                            {generalError}
                        </p>
                    )}

                    <div className="mt-3 space-y-3">
                        {rows.map((row, index) => {
                            const product = productById.get(row.product_id);

                            return (
                                <div
                                    key={index}
                                    className="rounded-xl border border-slate-200 p-3"
                                >
                                    <div className="grid gap-3 sm:grid-cols-[1fr_90px_140px_auto] sm:items-start">
                                        <div>
                                            <select
                                                aria-label={`Produk item ${index + 1}`}
                                                value={row.product_id}
                                                className={inputClass}
                                                onChange={(e) =>
                                                    selectProduct(
                                                        index,
                                                        e.target.value,
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    Pilih produk
                                                </option>
                                                {products
                                                    .filter(
                                                        (p) =>
                                                            String(p.id) ===
                                                                row.product_id ||
                                                            !usedProductIds.has(
                                                                String(p.id),
                                                            ),
                                                    )
                                                    .map((p) => (
                                                        <option
                                                            key={p.id}
                                                            value={p.id}
                                                        >
                                                            {p.name} (stok:{' '}
                                                            {p.stock})
                                                        </option>
                                                    ))}
                                            </select>
                                            <InputError
                                                message={
                                                    errors[
                                                        `items.${index}.product_id`
                                                    ]
                                                }
                                                className="mt-1.5"
                                            />
                                        </div>

                                        <div>
                                            <input
                                                type="number"
                                                min={1}
                                                value={row.quantity}
                                                placeholder="Qty"
                                                aria-label={`Qty item ${index + 1}`}
                                                className={inputClass}
                                                onChange={(e) =>
                                                    updateRow(index, {
                                                        quantity:
                                                            e.target.value,
                                                    })
                                                }
                                            />
                                            <InputError
                                                message={
                                                    errors[
                                                        `items.${index}.quantity`
                                                    ]
                                                }
                                                className="mt-1.5"
                                            />
                                        </div>

                                        <div>
                                            <div className="relative">
                                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                                    Rp
                                                </span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={row.cost_price}
                                                    placeholder="Harga modal"
                                                    aria-label={`Harga modal item ${index + 1}`}
                                                    className={
                                                        inputClass + ' pl-9'
                                                    }
                                                    onChange={(e) =>
                                                        updateRow(index, {
                                                            cost_price:
                                                                e.target.value,
                                                        })
                                                    }
                                                />
                                            </div>
                                            <InputError
                                                message={
                                                    errors[
                                                        `items.${index}.cost_price`
                                                    ]
                                                }
                                                className="mt-1.5"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            aria-label={`Hapus item ${index + 1}`}
                                            disabled={rows.length === 1}
                                            onClick={() => removeRow(index)}
                                            className="flex h-11 w-11 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 disabled:cursor-default disabled:opacity-40"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <div className="mt-2 flex justify-between text-sm text-slate-500">
                                        <span>
                                            {product
                                                ? `Stok saat ini: ${product.stock}`
                                                : ''}
                                        </span>
                                        <span>
                                            Subtotal:{' '}
                                            <span className="font-semibold text-slate-800">
                                                {formatRupiah(
                                                    rowSubtotal(row),
                                                )}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Total otomatis */}
                <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <span className="font-medium text-slate-700">Total</span>
                    <span className="text-lg font-bold text-slate-900">
                        {formatRupiah(total)}
                    </span>
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
                        {processing ? 'Menyimpan…' : 'Simpan Pembelian'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
