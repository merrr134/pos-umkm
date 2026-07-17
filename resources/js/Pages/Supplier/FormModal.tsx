import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { useForm } from '@inertiajs/react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';
import { SupplierRow, SupplierStatus } from './supplier';

const inputClass =
    'block w-full rounded-xl border-slate-200 py-2.5 px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

interface SupplierFormData {
    name: string;
    contact_person: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
    status: SupplierStatus;
    [key: string]: string;
}

// Validasi realtime sisi client — mengikuti aturan SupplierRequest
function validateSupplier(data: SupplierFormData): Record<string, string> {
    const errors: Record<string, string> = {};

    if (data.name.trim() === '') {
        errors.name = 'Nama supplier wajib diisi.';
    }
    if (data.email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.email = 'Format email tidak valid.';
    }

    return errors;
}

/**
 * Modal Tambah/Edit Supplier (Fase 8) — komponen yang sama untuk
 * keduanya. Kode supplier otomatis (SUP-0001) dan tidak bisa diubah.
 */
export default function FormModal({
    show,
    supplier,
    onClose,
}: {
    show: boolean;
    supplier: SupplierRow | null;
    onClose: () => void;
}) {
    const form = useForm<SupplierFormData>({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        status: 'aktif',
    });
    const { data, setData, processing, errors, clearErrors, reset } = form;

    const [touched, setTouched] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (show) {
            setData({
                name: supplier?.name ?? '',
                contact_person: supplier?.contact_person ?? '',
                phone: supplier?.phone ?? '',
                email: supplier?.email ?? '',
                address: supplier?.address ?? '',
                notes: supplier?.notes ?? '',
                status: supplier?.status ?? 'aktif',
            });
            setTouched({});
            clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show, supplier]);

    const clientErrors = useMemo(() => validateSupplier(data), [data]);

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

        setTouched({ name: true, email: true });

        if (Object.keys(clientErrors).length > 0) {
            return;
        }

        const options = { preserveScroll: true, onSuccess: close };

        if (supplier) {
            form.put(route('supplier.update', supplier.id), options);
        } else {
            form.post(route('supplier.store'), options);
        }
    };

    return (
        <Modal show={show} onClose={close} maxWidth="xl">
            <form onSubmit={submit} className="max-h-[90vh] overflow-y-auto p-6">
                <h2 className="text-lg font-bold text-slate-900">
                    {supplier ? 'Edit Supplier' : 'Tambah Supplier'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    {supplier
                        ? `Perbarui informasi supplier ${supplier.code}. Kode tidak dapat diubah.`
                        : 'Kode supplier dibuat otomatis (SUP-0001).'}
                </p>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label
                            htmlFor="supplier-name"
                            className="block font-medium text-slate-900"
                        >
                            Nama Supplier <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="supplier-name"
                            type="text"
                            value={data.name}
                            placeholder="Contoh: CV Kopi Nusantara"
                            className={inputClass + ' mt-2'}
                            onChange={(e) => {
                                setData('name', e.target.value);
                                markTouched('name');
                            }}
                        />
                        <InputError
                            message={fieldError('name')}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="supplier-contact"
                            className="block font-medium text-slate-900"
                        >
                            Kontak Person
                        </label>
                        <input
                            id="supplier-contact"
                            type="text"
                            value={data.contact_person}
                            placeholder="Nama penanggung jawab"
                            className={inputClass + ' mt-2'}
                            onChange={(e) =>
                                setData('contact_person', e.target.value)
                            }
                        />
                        <InputError
                            message={fieldError('contact_person')}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="supplier-phone"
                            className="block font-medium text-slate-900"
                        >
                            Telepon
                        </label>
                        <input
                            id="supplier-phone"
                            type="text"
                            value={data.phone}
                            placeholder="08xxxxxxxxxx"
                            className={inputClass + ' mt-2'}
                            onChange={(e) => setData('phone', e.target.value)}
                        />
                        <InputError
                            message={fieldError('phone')}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="supplier-email"
                            className="block font-medium text-slate-900"
                        >
                            Email
                        </label>
                        <input
                            id="supplier-email"
                            type="email"
                            value={data.email}
                            placeholder="nama@contoh.com"
                            className={inputClass + ' mt-2'}
                            onChange={(e) => {
                                setData('email', e.target.value);
                                markTouched('email');
                            }}
                        />
                        <InputError
                            message={fieldError('email')}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="supplier-status"
                            className="block font-medium text-slate-900"
                        >
                            Status <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="supplier-status"
                            value={data.status}
                            className={inputClass + ' mt-2'}
                            onChange={(e) =>
                                setData(
                                    'status',
                                    e.target.value as SupplierStatus,
                                )
                            }
                        >
                            <option value="aktif">Aktif</option>
                            <option value="nonaktif">Nonaktif</option>
                        </select>
                        <InputError
                            message={fieldError('status')}
                            className="mt-2"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label
                            htmlFor="supplier-address"
                            className="block font-medium text-slate-900"
                        >
                            Alamat
                        </label>
                        <textarea
                            id="supplier-address"
                            value={data.address}
                            rows={2}
                            placeholder="Alamat lengkap supplier"
                            className={inputClass + ' mt-2'}
                            onChange={(e) =>
                                setData('address', e.target.value)
                            }
                        />
                        <InputError
                            message={fieldError('address')}
                            className="mt-2"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label
                            htmlFor="supplier-notes"
                            className="block font-medium text-slate-900"
                        >
                            Catatan
                        </label>
                        <textarea
                            id="supplier-notes"
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
                        {processing ? 'Menyimpan…' : 'Simpan Supplier'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
