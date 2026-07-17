import {
    AlertTriangleIcon,
    FolderIcon,
    PlusIcon,
    PencilIcon,
    SearchIcon,
    TrashIcon,
} from '@/Components/Icons';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import Pagination from '@/Components/Pagination';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Category, PageProps, Paginated } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler, useEffect, useRef, useState } from 'react';

const inputClass =
    'block w-full rounded-xl border-slate-200 py-2.5 px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

// Warna chip ikon kategori bergiliran (dekoratif, meniru desain)
const chipColors = [
    'bg-blue-50 text-blue-600',
    'bg-amber-50 text-amber-600',
    'bg-green-50 text-green-600',
    'bg-purple-50 text-purple-600',
    'bg-red-50 text-red-600',
    'bg-cyan-50 text-cyan-600',
];

function CategoryFormModal({
    show,
    category,
    onClose,
}: {
    show: boolean;
    category: Category | null;
    onClose: () => void;
}) {
    const { data, setData, post, put, processing, errors, reset, clearErrors } =
        useForm({ name: '' });

    useEffect(() => {
        if (show) {
            setData('name', category?.name ?? '');
            clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show, category]);

    const close = () => {
        reset();
        clearErrors();
        onClose();
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        const options = { preserveScroll: true, onSuccess: close };

        if (category) {
            put(route('kategori.update', category.id), options);
        } else {
            post(route('kategori.store'), options);
        }
    };

    return (
        <Modal show={show} onClose={close} maxWidth="md">
            <form onSubmit={submit} className="p-6">
                <h2 className="text-lg font-bold text-slate-900">
                    {category ? 'Edit Kategori' : 'Tambah Kategori'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    {category
                        ? 'Perbarui nama kategori produk.'
                        : 'Buat kategori baru untuk mengelompokkan produk.'}
                </p>

                <div className="mt-5">
                    <label
                        htmlFor="category-name"
                        className="block font-medium text-slate-900"
                    >
                        Nama Kategori <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="category-name"
                        type="text"
                        value={data.name}
                        autoFocus
                        placeholder="Contoh: Kopi, Makanan, Snack"
                        className={inputClass + ' mt-2'}
                        onChange={(e) => setData('name', e.target.value)}
                    />
                    <InputError message={errors.name} className="mt-2" />
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
                        disabled={processing || data.name.trim() === ''}
                        className="rounded-xl bg-[#0A45FE] px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1] disabled:opacity-60"
                    >
                        {processing ? 'Menyimpan…' : 'Simpan'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

function DeleteCategoryModal({
    category,
    onClose,
}: {
    category: Category | null;
    onClose: () => void;
}) {
    const [processing, setProcessing] = useState(false);

    const confirmDelete = () => {
        if (!category) return;

        router.delete(route('kategori.destroy', category.id), {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => {
                setProcessing(false);
                onClose();
            },
        });
    };

    return (
        <Modal show={category !== null} onClose={onClose} maxWidth="md">
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                        <AlertTriangleIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Hapus Kategori
                        </h2>
                        <p className="mt-1 text-slate-500">
                            Yakin ingin menghapus kategori{' '}
                            <span className="font-semibold text-slate-800">
                                {category?.name}
                            </span>
                            ? Kategori yang masih dipakai produk tidak bisa
                            dihapus.
                        </p>
                    </div>
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
                        disabled={processing}
                        onClick={confirmDelete}
                        className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60"
                    >
                        {processing ? 'Menghapus…' : 'Hapus'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export default function Index({
    categories,
    filters,
}: PageProps<{
    categories: Paginated<Category>;
    filters: { search: string };
}>) {
    const { errors } = usePage().props;
    const { store } = usePage<PageProps>().props;

    const [search, setSearch] = useState(filters.search);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Category | null>(null);
    const [deleting, setDeleting] = useState<Category | null>(null);

    const isFirstRender = useRef(true);

    // Search realtime + debounce 300ms (PRD Bab 11)
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timer = window.setTimeout(() => {
            router.get(
                route('kategori'),
                search ? { search } : {},
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search]);

    const openCreate = () => {
        setEditing(null);
        setShowForm(true);
    };

    const openEdit = (category: Category) => {
        setEditing(category);
        setShowForm(true);
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                        Kategori
                    </h1>
                    <p className="hidden text-sm text-slate-500 sm:block">
                        Kelola semua kategori produk di {store.name}.
                    </p>
                </div>
            }
        >
            <Head title="Kategori" />

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Header card */}
                <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Daftar Kategori
                        </h2>
                        <p className="mt-0.5 text-sm text-slate-500">
                            Kelola semua kategori produk di {store.name}.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative">
                            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                placeholder="Cari kategori..."
                                className={inputClass + ' pl-10 sm:w-56'}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A45FE] px-4 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1]"
                        >
                            <PlusIcon className="h-4 w-4" />
                            Tambah Kategori
                        </button>
                    </div>
                </div>

                {errors.category && (
                    <div className="mx-5 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:mx-6">
                        {errors.category}
                    </div>
                )}

                {/* Tabel */}
                <div className="overflow-x-auto px-5 sm:px-6">
                    <table className="w-full min-w-[480px] text-left">
                        <thead>
                            <tr className="border-b border-slate-100 text-sm text-slate-500">
                                <th className="py-3.5 pr-4 font-medium">No</th>
                                <th className="py-3.5 pr-4 font-medium">
                                    Nama Kategori
                                </th>
                                <th className="py-3.5 pr-4 font-medium">
                                    Jumlah Produk
                                </th>
                                <th className="py-3.5 text-right font-medium">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="py-12 text-center text-slate-500"
                                    >
                                        {filters.search
                                            ? 'Kategori tidak ditemukan. Coba kata kunci lain.'
                                            : 'Belum ada kategori. Tambah kategori pertamamu.'}
                                    </td>
                                </tr>
                            )}
                            {categories.data.map((category, index) => (
                                <tr
                                    key={category.id}
                                    className="border-b border-slate-50 last:border-0"
                                >
                                    <td className="py-4 pr-4 text-slate-500">
                                        {(categories.from ?? 1) + index}
                                    </td>
                                    <td className="py-4 pr-4">
                                        <div className="flex items-center gap-3">
                                            <span
                                                className={
                                                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ' +
                                                    chipColors[
                                                        category.id %
                                                            chipColors.length
                                                    ]
                                                }
                                            >
                                                <FolderIcon className="h-5 w-5" />
                                            </span>
                                            <span className="font-semibold text-slate-900">
                                                {category.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-4 pr-4 text-slate-600">
                                        {category.products_count ?? 0} Produk
                                    </td>
                                    <td className="py-4 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <button
                                                type="button"
                                                aria-label={`Edit ${category.name}`}
                                                className="rounded-lg p-2 text-[#0A45FE] transition-colors hover:bg-blue-50"
                                                onClick={() =>
                                                    openEdit(category)
                                                }
                                            >
                                                <PencilIcon className="h-5 w-5" />
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={`Hapus ${category.name}`}
                                                className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50"
                                                onClick={() =>
                                                    setDeleting(category)
                                                }
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-5 py-4 sm:px-6">
                    <Pagination paginator={categories} />
                </div>
            </div>

            <CategoryFormModal
                show={showForm}
                category={editing}
                onClose={() => setShowForm(false)}
            />
            <DeleteCategoryModal
                category={deleting}
                onClose={() => setDeleting(null)}
            />
        </AuthenticatedLayout>
    );
}
