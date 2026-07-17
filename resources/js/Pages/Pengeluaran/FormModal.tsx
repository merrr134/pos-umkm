import { UploadIcon, XIcon } from '@/Components/Icons';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { useForm } from '@inertiajs/react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';
import {
    ExpenseCategoryOption,
    ExpenseRow,
    PaymentMethodOption,
    todayLocalDate,
} from './pengeluaran';

const inputClass =
    'block w-full rounded-xl border-slate-200 py-2.5 px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

const ACCEPTED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
];

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024; // 5 MB

interface ExpenseFormData {
    expense_date: string;
    expense_category_id: string;
    title: string;
    amount: string;
    payment_method: string;
    notes: string;
    receipt: File | null;
    [key: string]: string | File | null;
}

// Validasi realtime sisi client — mengikuti aturan ExpenseRequest
function validateExpense(data: ExpenseFormData): Record<string, string> {
    const errors: Record<string, string> = {};

    if (data.expense_date === '') {
        errors.expense_date = 'Tanggal pengeluaran wajib diisi.';
    }
    if (data.expense_category_id === '') {
        errors.expense_category_id = 'Kategori wajib dipilih.';
    }
    if (data.title.trim() === '') {
        errors.title = 'Judul pengeluaran wajib diisi.';
    }
    if (data.amount === '' || Number(data.amount) <= 0) {
        errors.amount = 'Nominal harus lebih dari 0.';
    }
    if (data.payment_method === '') {
        errors.payment_method = 'Metode pembayaran wajib dipilih.';
    }
    if (data.receipt !== null) {
        if (!ACCEPTED_TYPES.includes(data.receipt.type)) {
            errors.receipt =
                'Bukti harus berformat jpg, jpeg, png, webp, atau pdf.';
        } else if (data.receipt.size > MAX_RECEIPT_SIZE) {
            errors.receipt = 'Ukuran bukti maksimal 5 MB.';
        }
    }

    return errors;
}

/**
 * Modal Tambah/Edit Pengeluaran (Fase 9) — komponen yang sama untuk
 * keduanya. Nomor (EXP-0001) & user pencatat otomatis dari server.
 * Bukti baru menggantikan file lama.
 */
export default function FormModal({
    show,
    expense,
    categories,
    methods,
    onClose,
}: {
    show: boolean;
    expense: ExpenseRow | null;
    categories: ExpenseCategoryOption[];
    methods: PaymentMethodOption[];
    onClose: () => void;
}) {
    const form = useForm<ExpenseFormData>({
        expense_date: todayLocalDate(),
        expense_category_id: '',
        title: '',
        amount: '',
        payment_method: '',
        notes: '',
        receipt: null,
    });
    const { data, setData, processing, errors, clearErrors, reset } = form;

    const [touched, setTouched] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (show) {
            setData({
                expense_date: expense?.expense_date ?? todayLocalDate(),
                expense_category_id:
                    expense !== null ? String(expense.expense_category_id) : '',
                title: expense?.title ?? '',
                amount: expense !== null ? String(expense.amount) : '',
                payment_method: expense?.payment_method ?? '',
                notes: expense?.notes ?? '',
                receipt: null,
            });
            setTouched({});
            clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show, expense]);

    // Kategori aktif saja yang bisa dipilih; kategori lama milik
    // pengeluaran yang diedit tetap tampil agar tidak "hilang"
    const selectableCategories = useMemo(
        () =>
            categories.filter(
                (category) =>
                    category.is_active ||
                    category.id === expense?.expense_category_id,
            ),
        [categories, expense],
    );

    const activeMethods = useMemo(
        () => methods.filter((method) => method.is_active),
        [methods],
    );

    // Preview file bukti — file baru diprioritaskan dari file tersimpan
    const newReceiptPreview = useMemo(() => {
        if (data.receipt === null) {
            return null;
        }

        return {
            isPdf: data.receipt.type === 'application/pdf',
            name: data.receipt.name,
            url: data.receipt.type.startsWith('image/')
                ? URL.createObjectURL(data.receipt)
                : null,
        };
    }, [data.receipt]);

    useEffect(
        () => () => {
            if (newReceiptPreview?.url) {
                URL.revokeObjectURL(newReceiptPreview.url);
            }
        },
        [newReceiptPreview],
    );

    const clientErrors = useMemo(() => validateExpense(data), [data]);

    const fieldError = (field: string): string | undefined =>
        (touched[field] ? clientErrors[field] : undefined) ??
        (errors as Record<string, string>)[field];

    const markTouched = (field: string) =>
        setTouched((previous) => ({ ...previous, [field]: true }));

    const close = () => {
        reset();
        clearErrors();
        onClose();
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        setTouched({
            expense_date: true,
            expense_category_id: true,
            title: true,
            amount: true,
            payment_method: true,
            receipt: true,
        });

        if (Object.keys(clientErrors).length > 0) {
            return;
        }

        const options = {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: close,
        };

        if (expense) {
            // Method spoofing: multipart harus dikirim via POST
            form.transform((data) => ({ ...data, _method: 'put' }));
            form.post(route('pengeluaran.update', expense.id), options);
        } else {
            form.transform((data) => data);
            form.post(route('pengeluaran.store'), options);
        }
    };

    return (
        <Modal show={show} onClose={close} maxWidth="xl">
            <form onSubmit={submit} className="max-h-[90vh] overflow-y-auto p-6">
                <h2 className="text-lg font-bold text-slate-900">
                    {expense ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    {expense
                        ? `Perbarui pengeluaran ${expense.expense_number}. Nomor & pencatat tidak dapat diubah.`
                        : 'Nomor pengeluaran dibuat otomatis (EXP-0001). Pengeluaran tidak mempengaruhi stok.'}
                </p>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                        <label
                            htmlFor="expense-date"
                            className="block font-medium text-slate-900"
                        >
                            Tanggal <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="expense-date"
                            type="date"
                            value={data.expense_date}
                            className={inputClass + ' mt-2'}
                            onChange={(e) => {
                                setData('expense_date', e.target.value);
                                markTouched('expense_date');
                            }}
                        />
                        <InputError
                            message={fieldError('expense_date')}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="expense-category"
                            className="block font-medium text-slate-900"
                        >
                            Kategori <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="expense-category"
                            value={data.expense_category_id}
                            className={inputClass + ' mt-2'}
                            onChange={(e) => {
                                setData('expense_category_id', e.target.value);
                                markTouched('expense_category_id');
                            }}
                        >
                            <option value="">Pilih kategori…</option>
                            {selectableCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                    {!category.is_active ? ' (nonaktif)' : ''}
                                </option>
                            ))}
                        </select>
                        <InputError
                            message={fieldError('expense_category_id')}
                            className="mt-2"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label
                            htmlFor="expense-title"
                            className="block font-medium text-slate-900"
                        >
                            Judul <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="expense-title"
                            type="text"
                            value={data.title}
                            maxLength={100}
                            placeholder="Contoh: Beli gas 3kg untuk dapur"
                            className={inputClass + ' mt-2'}
                            onChange={(e) => {
                                setData('title', e.target.value);
                                markTouched('title');
                            }}
                        />
                        <InputError
                            message={fieldError('title')}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="expense-amount"
                            className="block font-medium text-slate-900"
                        >
                            Nominal (Rp) <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="expense-amount"
                            type="number"
                            min={1}
                            value={data.amount}
                            placeholder="Contoh: 25000"
                            className={inputClass + ' mt-2'}
                            onChange={(e) => {
                                setData('amount', e.target.value);
                                markTouched('amount');
                            }}
                        />
                        <InputError
                            message={fieldError('amount')}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="expense-method"
                            className="block font-medium text-slate-900"
                        >
                            Metode Pembayaran{' '}
                            <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="expense-method"
                            value={data.payment_method}
                            className={inputClass + ' mt-2'}
                            onChange={(e) => {
                                setData('payment_method', e.target.value);
                                markTouched('payment_method');
                            }}
                        >
                            <option value="">Pilih metode…</option>
                            {activeMethods.map((method) => (
                                <option key={method.code} value={method.code}>
                                    {method.name}
                                </option>
                            ))}
                        </select>
                        <InputError
                            message={fieldError('payment_method')}
                            className="mt-2"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label
                            htmlFor="expense-notes"
                            className="block font-medium text-slate-900"
                        >
                            Catatan
                        </label>
                        <textarea
                            id="expense-notes"
                            value={data.notes}
                            rows={2}
                            placeholder="Catatan tambahan (opsional)"
                            className={inputClass + ' mt-2'}
                            onChange={(e) => setData('notes', e.target.value)}
                        />
                        <InputError
                            message={fieldError('notes')}
                            className="mt-2"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <span className="block font-medium text-slate-900">
                            Bukti Pengeluaran
                        </span>
                        <p className="mt-0.5 text-sm text-slate-500">
                            jpg, jpeg, png, webp, atau pdf — maksimal 5 MB
                            (opsional).
                            {expense?.receipt_url &&
                                ' Bukti baru akan menggantikan file lama.'}
                        </p>

                        {newReceiptPreview === null ? (
                            <label
                                htmlFor="expense-receipt"
                                className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-5 text-slate-500 transition-colors hover:border-[#0A45FE] hover:text-[#0A45FE]"
                            >
                                <UploadIcon className="h-5 w-5" />
                                <span className="font-medium">
                                    Pilih file bukti…
                                </span>
                                <input
                                    id="expense-receipt"
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                                    className="hidden"
                                    onChange={(e) => {
                                        setData(
                                            'receipt',
                                            e.target.files?.[0] ?? null,
                                        );
                                        markTouched('receipt');
                                    }}
                                />
                            </label>
                        ) : (
                            <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                                {newReceiptPreview.url ? (
                                    <img
                                        src={newReceiptPreview.url}
                                        alt="Preview bukti"
                                        className="h-16 w-16 rounded-lg object-cover"
                                    />
                                ) : (
                                    <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-red-50 text-xs font-bold uppercase text-red-500">
                                        PDF
                                    </span>
                                )}
                                <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                                    {newReceiptPreview.name}
                                </p>
                                <button
                                    type="button"
                                    aria-label="Hapus file bukti"
                                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                    onClick={() => setData('receipt', null)}
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        {expense?.receipt_url && newReceiptPreview === null && (
                            <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                {expense.receipt_is_pdf ? (
                                    <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-red-50 text-xs font-bold uppercase text-red-500">
                                        PDF
                                    </span>
                                ) : (
                                    <img
                                        src={expense.receipt_url}
                                        alt="Bukti tersimpan"
                                        className="h-16 w-16 rounded-lg object-cover"
                                    />
                                )}
                                <p className="text-sm text-slate-600">
                                    Bukti tersimpan saat ini.
                                </p>
                            </div>
                        )}

                        <InputError
                            message={fieldError('receipt')}
                            className="mt-2"
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={close}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={
                            processing || Object.keys(clientErrors).length > 0
                        }
                        className="rounded-xl bg-[#0A45FE] px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1] disabled:opacity-60"
                    >
                        {processing ? 'Menyimpan…' : 'Simpan Pengeluaran'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
