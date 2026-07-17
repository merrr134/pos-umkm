import { PencilIcon, PlusIcon, TrashIcon } from '@/Components/Icons';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { router, useForm } from '@inertiajs/react';
import { FormEventHandler, useEffect, useState } from 'react';
import { ExpenseCategoryOption } from './pengeluaran';

const inputClass =
    'block w-full rounded-xl border-slate-200 py-2.5 px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

/**
 * Modal Kelola Kategori Pengeluaran (PRD 5.10) — Owner/Admin bisa
 * menambah, mengganti nama, menonaktifkan, dan menghapus kategori.
 * Kategori yang masih dipakai pengeluaran tidak bisa dihapus.
 */
export default function CategoryModal({
    show,
    categories,
    onClose,
}: {
    show: boolean;
    categories: ExpenseCategoryOption[];
    onClose: () => void;
}) {
    const addForm = useForm({ name: '', is_active: true });

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [rowError, setRowError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (show) {
            addForm.reset();
            addForm.clearErrors();
            setEditingId(null);
            setConfirmDeleteId(null);
            setRowError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    const submitAdd: FormEventHandler = (e) => {
        e.preventDefault();

        addForm.post(route('pengeluaran.kategori.store'), {
            preserveScroll: true,
            onSuccess: () => addForm.reset(),
        });
    };

    const rowOptions = {
        preserveScroll: true,
        onStart: () => {
            setBusy(true);
            setRowError(null);
        },
        onFinish: () => setBusy(false),
        onError: (errors: Record<string, string>) =>
            setRowError(
                Object.values(errors)[0] ?? 'Terjadi kesalahan. Coba lagi.',
            ),
    };

    const saveRename = (category: ExpenseCategoryOption) => {
        if (editName.trim() === '') {
            setRowError('Nama kategori wajib diisi.');
            return;
        }

        router.put(
            route('pengeluaran.kategori.update', category.id),
            { name: editName, is_active: category.is_active },
            { ...rowOptions, onSuccess: () => setEditingId(null) },
        );
    };

    const toggleActive = (category: ExpenseCategoryOption) => {
        router.put(
            route('pengeluaran.kategori.update', category.id),
            { name: category.name, is_active: !category.is_active },
            rowOptions,
        );
    };

    const confirmDelete = (category: ExpenseCategoryOption) => {
        router.delete(route('pengeluaran.kategori.destroy', category.id), {
            ...rowOptions,
            onSuccess: () => setConfirmDeleteId(null),
        });
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="lg">
            <div className="max-h-[90vh] overflow-y-auto p-6">
                <h2 className="text-lg font-bold text-slate-900">
                    Kelola Kategori Pengeluaran
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    Kategori yang masih dipakai pengeluaran tidak bisa
                    dihapus — nonaktifkan agar tidak muncul di form.
                </p>

                {/* Tambah kategori */}
                <form onSubmit={submitAdd} className="mt-4 flex gap-2">
                    <input
                        type="text"
                        value={addForm.data.name}
                        maxLength={50}
                        placeholder="Nama kategori baru…"
                        aria-label="Nama kategori baru"
                        className={inputClass + ' flex-1'}
                        onChange={(e) => addForm.setData('name', e.target.value)}
                    />
                    <button
                        type="submit"
                        disabled={
                            addForm.processing ||
                            addForm.data.name.trim() === ''
                        }
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#0A45FE] px-4 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1] disabled:opacity-60"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Tambah
                    </button>
                </form>
                <InputError message={addForm.errors.name} className="mt-2" />
                {rowError && (
                    <p className="mt-2 text-sm text-red-600">{rowError}</p>
                )}

                {/* Daftar kategori */}
                <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {categories.map((category) => (
                        <li
                            key={category.id}
                            className="flex flex-wrap items-center gap-2 px-4 py-3"
                        >
                            {editingId === category.id ? (
                                <>
                                    <input
                                        type="text"
                                        value={editName}
                                        maxLength={50}
                                        aria-label={`Nama baru ${category.name}`}
                                        className={inputClass + ' flex-1'}
                                        onChange={(e) =>
                                            setEditName(e.target.value)
                                        }
                                    />
                                    <button
                                        type="button"
                                        disabled={busy}
                                        className="rounded-xl bg-[#0A45FE] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0838d1] disabled:opacity-60"
                                        onClick={() => saveRename(category)}
                                    >
                                        Simpan
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                        onClick={() => setEditingId(null)}
                                    >
                                        Batal
                                    </button>
                                </>
                            ) : confirmDeleteId === category.id ? (
                                <>
                                    <p className="min-w-0 flex-1 text-sm text-slate-700">
                                        Hapus kategori{' '}
                                        <span className="font-semibold">
                                            {category.name}
                                        </span>
                                        ?
                                    </p>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                                        onClick={() => confirmDelete(category)}
                                    >
                                        Hapus
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                        onClick={() =>
                                            setConfirmDeleteId(null)
                                        }
                                    >
                                        Batal
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium text-slate-900">
                                            {category.name}
                                            {!category.is_active && (
                                                <span className="ms-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                                                    Nonaktif
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {category.expenses_count}{' '}
                                            pengeluaran
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        className={
                                            'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ' +
                                            (category.is_active
                                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                : 'bg-green-50 text-green-600 hover:bg-green-100')
                                        }
                                        onClick={() => toggleActive(category)}
                                    >
                                        {category.is_active
                                            ? 'Nonaktifkan'
                                            : 'Aktifkan'}
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`Edit ${category.name}`}
                                        title="Ganti nama"
                                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                        onClick={() => {
                                            setEditingId(category.id);
                                            setEditName(category.name);
                                        }}
                                    >
                                        <PencilIcon className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`Hapus ${category.name}`}
                                        title={
                                            category.expenses_count > 0
                                                ? 'Kategori masih dipakai pengeluaran'
                                                : 'Hapus'
                                        }
                                        disabled={category.expenses_count > 0}
                                        className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                        onClick={() =>
                                            setConfirmDeleteId(category.id)
                                        }
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </>
                            )}
                        </li>
                    ))}
                </ul>

                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </Modal>
    );
}
