import {
    AlertTriangleIcon,
    BoxIcon,
    CheckCircleIcon,
    FolderIcon,
    ImageIcon,
    MoreVerticalIcon,
    PlusIcon,
    PencilIcon,
    SearchIcon,
    TrashIcon,
    UploadIcon,
} from '@/Components/Icons';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import Pagination from '@/Components/Pagination';
import { SkeletonRows } from '@/Components/TableSkeleton';
import useNavigating from '@/hooks/useNavigating';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Category, PageProps, Paginated, Product } from '@/types';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ChangeEvent,
    ComponentType,
    FormEventHandler,
    SVGAttributes,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

const inputClass =
    'block w-full rounded-xl border-slate-200 py-2.5 px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

function formatRupiah(value: number): string {
    return 'Rp ' + value.toLocaleString('id-ID');
}

function Toggle({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={
                'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0A45FE] focus:ring-offset-2 ' +
                (checked ? 'bg-[#0A45FE]' : 'bg-slate-300')
            }
        >
            <span
                className={
                    'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ' +
                    (checked ? 'translate-x-6' : 'translate-x-1')
                }
            />
        </button>
    );
}

/* ============================ Form Produk ============================ */

interface ProductFormData {
    name: string;
    category_id: string;
    barcode: string;
    price: string;
    description: string;
    status: 'aktif' | 'habis';
    track_stock: boolean;
    stock: string;
    min_stock: string;
    photo: File | null;
    [key: string]: string | boolean | File | null;
}

// Validasi realtime sisi client — mengikuti aturan ProductRequest
function validateProduct(data: ProductFormData): Record<string, string> {
    const errors: Record<string, string> = {};

    if (data.name.trim() === '') {
        errors.name = 'Nama produk wajib diisi.';
    }
    if (data.category_id === '') {
        errors.category_id = 'Kategori wajib dipilih.';
    }
    if (data.price === '' || Number(data.price) <= 0) {
        errors.price = 'Harga jual harus lebih dari 0.';
    }
    if (data.track_stock) {
        if (data.stock === '' || Number(data.stock) < 0) {
            errors.stock =
                data.stock === ''
                    ? 'Jumlah stok wajib diisi saat Kelola Stok aktif.'
                    : 'Jumlah stok tidak boleh negatif.';
        }
        if (data.min_stock !== '' && Number(data.min_stock) < 0) {
            errors.min_stock = 'Minimum stok tidak boleh negatif.';
        }
    }
    if (data.photo && data.photo.size > 2 * 1024 * 1024) {
        errors.photo = 'Ukuran foto maksimal 2 MB.';
    }

    return errors;
}

function ProductFormModal({
    show,
    product,
    categories,
    onClose,
}: {
    show: boolean;
    product: Product | null;
    categories: Category[];
    onClose: () => void;
}) {
    const form = useForm<ProductFormData>({
        name: '',
        category_id: '',
        barcode: '',
        price: '',
        description: '',
        status: 'aktif',
        track_stock: false,
        stock: '',
        min_stock: '',
        photo: null,
    });
    const { data, setData, processing, errors, clearErrors, reset } = form;

    const [touched, setTouched] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (show) {
            setData({
                name: product?.name ?? '',
                category_id: product ? String(product.category_id) : '',
                barcode: product?.barcode ?? '',
                price: product ? String(product.price) : '',
                description: product?.description ?? '',
                status: product?.status ?? 'aktif',
                track_stock: product?.track_stock ?? false,
                stock: product ? String(product.stock) : '',
                min_stock: product ? String(product.min_stock) : '',
                photo: null,
            });
            setTouched({});
            clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show, product]);

    const clientErrors = useMemo(() => validateProduct(data), [data]);

    // Error tampil: validasi client (field yang sudah disentuh) + server
    const fieldError = (field: string): string | undefined =>
        (touched[field] ? clientErrors[field] : undefined) ??
        (errors as Record<string, string>)[field];

    const markTouched = (field: string) =>
        setTouched((previous) => ({ ...previous, [field]: true }));

    const previewUrl = useMemo(
        () => (data.photo ? URL.createObjectURL(data.photo) : null),
        [data.photo],
    );

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const photoSrc = previewUrl ?? product?.photo_url ?? null;

    const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
        setData('photo', e.target.files?.[0] ?? null);
        markTouched('photo');
    };

    const close = () => {
        reset();
        clearErrors();
        onClose();
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        setTouched({
            name: true,
            category_id: true,
            price: true,
            stock: true,
            min_stock: true,
            photo: true,
        });

        if (Object.keys(clientErrors).length > 0) {
            return;
        }

        const options = {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: close,
        };

        if (product) {
            // Method spoofing: multipart harus dikirim via POST
            form.transform((data) => ({ ...data, _method: 'put' }));
            form.post(route('produk.update', product.id), options);
        } else {
            form.transform((data) => data);
            form.post(route('produk.store'), options);
        }
    };

    const hasBlockingErrors = Object.keys(clientErrors).length > 0;

    return (
        <Modal show={show} onClose={close} maxWidth="2xl">
            <form onSubmit={submit} className="max-h-[90vh] overflow-y-auto p-6">
                <h2 className="text-lg font-bold text-slate-900">
                    {product ? 'Edit Produk' : 'Tambah Produk'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    {product
                        ? 'Perbarui informasi produk.'
                        : 'Lengkapi informasi produk baru.'}
                </p>

                {/* Foto produk */}
                <div className="mt-5">
                    <span className="block font-medium text-slate-900">
                        Foto Produk
                    </span>
                    <div className="mt-2 flex items-center gap-4">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            {photoSrc ? (
                                <img
                                    src={photoSrc}
                                    alt="Preview foto produk"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <ImageIcon className="h-8 w-8 text-slate-300" />
                            )}
                        </div>
                        <div>
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
                                <UploadIcon className="h-4 w-4" />
                                {data.photo ? data.photo.name : 'Pilih Foto'}
                                <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp"
                                    className="hidden"
                                    onChange={handlePhotoChange}
                                />
                            </label>
                            <p className="mt-1.5 text-sm text-slate-500">
                                jpg, jpeg, png, webp — maksimal 2 MB.
                            </p>
                        </div>
                    </div>
                    <InputError message={fieldError('photo')} className="mt-2" />
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label
                            htmlFor="product-name"
                            className="block font-medium text-slate-900"
                        >
                            Nama Produk <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="product-name"
                            type="text"
                            value={data.name}
                            placeholder="Contoh: Es Kopi Susu"
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
                            htmlFor="product-category"
                            className="block font-medium text-slate-900"
                        >
                            Kategori <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="product-category"
                            value={data.category_id}
                            className={inputClass + ' mt-2'}
                            onChange={(e) => {
                                setData('category_id', e.target.value);
                                markTouched('category_id');
                            }}
                        >
                            <option value="">Pilih kategori</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                        <InputError
                            message={fieldError('category_id')}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="product-barcode"
                            className="block font-medium text-slate-900"
                        >
                            Barcode / SKU{' '}
                            <span className="text-sm font-normal text-slate-400">
                                (opsional)
                            </span>
                        </label>
                        <input
                            id="product-barcode"
                            type="text"
                            value={data.barcode}
                            placeholder="Kosongkan jika tidak ada"
                            className={inputClass + ' mt-2'}
                            onChange={(e) =>
                                setData('barcode', e.target.value)
                            }
                        />
                        <InputError
                            message={fieldError('barcode')}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="product-price"
                            className="block font-medium text-slate-900"
                        >
                            Harga Jual <span className="text-red-500">*</span>
                        </label>
                        <div className="relative mt-2">
                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                Rp
                            </span>
                            <input
                                id="product-price"
                                type="number"
                                min={1}
                                value={data.price}
                                placeholder="0"
                                className={inputClass + ' pl-11'}
                                onChange={(e) => {
                                    setData('price', e.target.value);
                                    markTouched('price');
                                }}
                            />
                        </div>
                        <InputError
                            message={fieldError('price')}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="product-status"
                            className="block font-medium text-slate-900"
                        >
                            Status <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="product-status"
                            value={data.status}
                            className={inputClass + ' mt-2'}
                            onChange={(e) =>
                                setData(
                                    'status',
                                    e.target.value as 'aktif' | 'habis',
                                )
                            }
                        >
                            <option value="aktif">Aktif</option>
                            <option value="habis">Habis</option>
                        </select>
                        <InputError
                            message={fieldError('status')}
                            className="mt-2"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label
                            htmlFor="product-description"
                            className="block font-medium text-slate-900"
                        >
                            Deskripsi
                        </label>
                        <textarea
                            id="product-description"
                            value={data.description}
                            rows={2}
                            placeholder="Deskripsi singkat produk"
                            className={inputClass + ' mt-2'}
                            onChange={(e) =>
                                setData('description', e.target.value)
                            }
                        />
                        <InputError
                            message={fieldError('description')}
                            className="mt-2"
                        />
                    </div>
                </div>

                {/* Kelola Stok */}
                <div className="mt-5 rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="font-medium text-slate-900">
                                Kelola Stok
                            </p>
                            <p className="text-sm text-slate-500">
                                Pantau jumlah stok produk ini
                            </p>
                        </div>
                        <Toggle
                            checked={data.track_stock}
                            onChange={(value) => {
                                setData('track_stock', value);
                                markTouched('track_stock');
                            }}
                            label="Kelola Stok"
                        />
                    </div>

                    {data.track_stock && (
                        <div className="mt-4 grid gap-5 border-t border-slate-100 pt-4 sm:grid-cols-2">
                            <div>
                                <label
                                    htmlFor="product-stock"
                                    className="block font-medium text-slate-900"
                                >
                                    Jumlah Stok{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="product-stock"
                                    type="number"
                                    min={0}
                                    value={data.stock}
                                    placeholder="0"
                                    className={inputClass + ' mt-2'}
                                    onChange={(e) => {
                                        setData('stock', e.target.value);
                                        markTouched('stock');
                                    }}
                                />
                                <InputError
                                    message={fieldError('stock')}
                                    className="mt-2"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="product-min-stock"
                                    className="block font-medium text-slate-900"
                                >
                                    Minimum Stok
                                </label>
                                <input
                                    id="product-min-stock"
                                    type="number"
                                    min={0}
                                    value={data.min_stock}
                                    placeholder="0"
                                    className={inputClass + ' mt-2'}
                                    onChange={(e) => {
                                        setData('min_stock', e.target.value);
                                        markTouched('min_stock');
                                    }}
                                />
                                <p className="mt-1.5 text-sm text-slate-500">
                                    Peringatan muncul saat stok ≤ nilai ini.
                                </p>
                                <InputError
                                    message={fieldError('min_stock')}
                                    className="mt-2"
                                />
                            </div>
                        </div>
                    )}
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
                        disabled={processing || hasBlockingErrors}
                        className="rounded-xl bg-[#0A45FE] px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1] disabled:opacity-60"
                    >
                        {processing ? 'Menyimpan…' : 'Simpan Produk'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

/* =========================== Konfirmasi Hapus =========================== */

function DeleteProductModal({
    product,
    onClose,
}: {
    product: Product | null;
    onClose: () => void;
}) {
    const [processing, setProcessing] = useState(false);

    const confirmDelete = () => {
        if (!product) return;

        router.delete(route('produk.destroy', product.id), {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => {
                setProcessing(false);
                onClose();
            },
        });
    };

    return (
        <Modal show={product !== null} onClose={onClose} maxWidth="md">
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                        <AlertTriangleIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Hapus Produk
                        </h2>
                        <p className="mt-1 text-slate-500">
                            Yakin ingin menghapus produk{' '}
                            <span className="font-semibold text-slate-800">
                                {product?.name}
                            </span>
                            ? Produk akan disembunyikan dari daftar, riwayat
                            transaksinya tetap tersimpan.
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

/* ============================ Kartu Statistik ============================ */

function StatCard({
    icon: IconComponent,
    chipClass,
    label,
    value,
}: {
    icon: ComponentType<SVGAttributes<SVGElement>>;
    chipClass: string;
    label: string;
    value: number;
}) {
    return (
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span
                className={
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ' +
                    chipClass
                }
            >
                <IconComponent className="h-6 w-6" />
            </span>
            <div className="min-w-0">
                <p className="truncate text-sm text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
            </div>
        </div>
    );
}

/* ================================ Halaman ================================ */

interface ProductStats {
    total: number;
    aktif: number;
    stok_habis: number;
    kategori: number;
}

export default function Index({
    products,
    categories,
    filters,
    stats,
}: PageProps<{
    products: Paginated<Product>;
    categories: Category[];
    filters: { search: string; category: number | null; status: string | null };
    stats: ProductStats;
}>) {
    const { store } = usePage<PageProps>().props;

    const [search, setSearch] = useState(filters.search);
    const [categoryFilter, setCategoryFilter] = useState(
        filters.category !== null ? String(filters.category) : '',
    );
    const [statusFilter, setStatusFilter] = useState(filters.status ?? '');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Product | null>(null);
    const navigating = useNavigating();
    const [deleting, setDeleting] = useState<Product | null>(null);

    const isFirstRender = useRef(true);

    // Search realtime + debounce 300ms; filter kategori & status ikut terkirim
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timer = window.setTimeout(() => {
            const params: Record<string, string> = {};
            if (search) params.search = search;
            if (categoryFilter) params.category = categoryFilter;
            if (statusFilter) params.status = statusFilter;

            router.get(route('produk'), params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search, categoryFilter, statusFilter]);

    const hasActiveFilters =
        search !== '' || categoryFilter !== '' || statusFilter !== '';

    const resetFilters = () => {
        setSearch('');
        setCategoryFilter('');
        setStatusFilter('');
    };

    const openCreate = () => {
        setEditing(null);
        setShowForm(true);
    };

    const openEdit = (product: Product) => {
        setEditing(product);
        setShowForm(true);
    };

    const cellClass =
        'border-y border-slate-200 bg-white px-4 py-4 align-middle transition-colors duration-150 group-hover:bg-slate-50';

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                        Produk
                    </h1>
                    <p className="hidden text-sm text-slate-500 sm:block">
                        Kelola semua produk yang tersedia di {store.name}.
                    </p>
                </div>
            }
        >
            <Head title="Produk" />

            {/* Tab + Tambah Produk (kanan atas) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                    <span className="rounded-lg bg-[#0A45FE] px-4 py-2 text-sm font-semibold text-white">
                        Daftar Produk
                    </span>
                    <Link
                        href={route('kategori')}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
                    >
                        Kategori Produk
                    </Link>
                    <Link
                        href={route('stok')}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
                    >
                        Manajemen Stok
                    </Link>
                    <Link
                        href={route('supplier')}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
                    >
                        Supplier
                    </Link>
                    <Link
                        href={route('pembelian')}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
                    >
                        Pembelian
                    </Link>
                </div>

                <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A45FE] px-4 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1]"
                >
                    <PlusIcon className="h-4 w-4" />
                    Tambah Produk
                </button>
            </div>

            {/* Statistik */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    icon={BoxIcon}
                    chipClass="bg-blue-50 text-[#0A45FE]"
                    label="Total Produk"
                    value={stats.total}
                />
                <StatCard
                    icon={CheckCircleIcon}
                    chipClass="bg-green-50 text-green-600"
                    label="Produk Aktif"
                    value={stats.aktif}
                />
                <StatCard
                    icon={AlertTriangleIcon}
                    chipClass="bg-red-50 text-red-500"
                    label="Stok Habis"
                    value={stats.stok_habis}
                />
                <StatCard
                    icon={FolderIcon}
                    chipClass="bg-purple-50 text-purple-600"
                    label="Kategori"
                    value={stats.kategori}
                />
            </div>

            {/* Card utama: filter + tabel + pagination */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Filter — satu baris: Search, Kategori, Status, Reset */}
                <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center sm:px-6">
                    <div className="relative min-w-0 flex-1">
                        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            placeholder="Cari produk..."
                            className={inputClass + ' pl-10'}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        aria-label="Filter kategori"
                        value={categoryFilter}
                        className={inputClass + ' lg:w-48'}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="">Semua Kategori</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </select>
                    <select
                        aria-label="Filter status"
                        value={statusFilter}
                        className={inputClass + ' lg:w-44'}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">Semua Status</option>
                        <option value="aktif">Aktif</option>
                        <option value="habis">Habis</option>
                    </select>
                    <button
                        type="button"
                        onClick={resetFilters}
                        disabled={!hasActiveFilters}
                        className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-default disabled:opacity-50"
                    >
                        Reset Filter
                    </button>
                </div>

                {/* Tabel */}
                <div className="overflow-x-auto px-5 sm:px-6">
                    <table className="w-full min-w-[760px] border-separate [border-spacing:0_10px] text-left">
                        <thead>
                            <tr className="text-sm text-slate-500">
                                <th className="px-4 pt-3 font-medium">
                                    Produk
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Kategori
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Harga
                                </th>
                                <th className="px-4 pt-3 font-medium">Stok</th>
                                <th className="px-4 pt-3 font-medium">
                                    Status
                                </th>
                                <th className="px-4 pt-3 text-right font-medium">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {navigating && <SkeletonRows cols={6} />}
                            {!navigating && products.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-500"
                                    >
                                        {hasActiveFilters ? (
                                            'Produk tidak ditemukan. Coba ubah pencarian atau filter.'
                                        ) : (
                                            <>
                                                <p>
                                                    Belum ada produk. Tambah
                                                    produk pertamamu.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={openCreate}
                                                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0A45FE] px-4 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1]"
                                                >
                                                    <PlusIcon className="h-4 w-4" />
                                                    Tambah Produk
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            )}
                            {!navigating && products.data.map((product) => (
                                <tr key={product.id} className="group">
                                    {/* Produk: thumbnail + nama + deskripsi */}
                                    <td
                                        className={
                                            cellClass +
                                            ' rounded-l-xl border-l'
                                        }
                                    >
                                        <div className="flex items-center gap-3.5">
                                            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                                                {product.photo_url ? (
                                                    <img
                                                        src={product.photo_url}
                                                        alt={product.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <ImageIcon className="h-6 w-6 text-slate-300" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-slate-900">
                                                    {product.name}
                                                </p>
                                                <p className="max-w-56 truncate text-sm text-slate-500">
                                                    {product.description ??
                                                        '—'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Kategori — badge hijau */}
                                    <td className={cellClass}>
                                        {product.category && (
                                            <span className="inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                                {product.category.name}
                                            </span>
                                        )}
                                    </td>

                                    <td
                                        className={
                                            cellClass +
                                            ' font-semibold text-slate-900'
                                        }
                                    >
                                        {formatRupiah(product.price)}
                                    </td>

                                    {/* Stok */}
                                    <td className={cellClass}>
                                        {product.track_stock ? (
                                            <div>
                                                <p
                                                    className={
                                                        'font-semibold ' +
                                                        (product.stock === 0
                                                            ? 'text-red-600'
                                                            : product.stock <=
                                                                product.min_stock
                                                              ? 'text-amber-600'
                                                              : 'text-slate-900')
                                                    }
                                                >
                                                    {product.stock}
                                                </p>
                                                <p className="text-sm text-slate-500">
                                                    tersedia
                                                </p>
                                            </div>
                                        ) : (
                                            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                                Tidak dilacak
                                            </span>
                                        )}
                                    </td>

                                    {/* Status — badge hijau / merah */}
                                    <td className={cellClass}>
                                        <span
                                            className={
                                                'inline-flex rounded-full px-3 py-1 text-xs font-semibold ' +
                                                (product.status === 'aktif'
                                                    ? 'bg-green-50 text-green-700'
                                                    : 'bg-red-50 text-red-600')
                                            }
                                        >
                                            {product.status === 'aktif'
                                                ? 'Aktif'
                                                : 'Habis'}
                                        </span>
                                    </td>

                                    {/* Aksi: edit, hapus, more */}
                                    <td
                                        className={
                                            cellClass +
                                            ' rounded-r-xl border-r text-right'
                                        }
                                    >
                                        <div className="inline-flex items-center gap-1">
                                            <button
                                                type="button"
                                                aria-label={`Edit ${product.name}`}
                                                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#0A45FE] transition-colors hover:bg-blue-50"
                                                onClick={() =>
                                                    openEdit(product)
                                                }
                                            >
                                                <PencilIcon className="h-5 w-5" />
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={`Hapus ${product.name}`}
                                                className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50"
                                                onClick={() =>
                                                    setDeleting(product)
                                                }
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                            <Menu
                                                as="div"
                                                className="relative"
                                            >
                                                <MenuButton
                                                    aria-label={`Aksi lain ${product.name}`}
                                                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                                >
                                                    <MoreVerticalIcon className="h-5 w-5" />
                                                </MenuButton>
                                                <MenuItems
                                                    anchor="bottom end"
                                                    className="z-50 mt-1 w-44 rounded-xl border border-slate-100 bg-white p-1.5 shadow-lg focus:outline-none"
                                                >
                                                    <MenuItem>
                                                        <button
                                                            type="button"
                                                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 data-[focus]:bg-slate-50"
                                                            onClick={() =>
                                                                openEdit(
                                                                    product,
                                                                )
                                                            }
                                                        >
                                                            <PencilIcon className="h-4 w-4 text-slate-400" />
                                                            Edit Produk
                                                        </button>
                                                    </MenuItem>
                                                    <MenuItem>
                                                        <button
                                                            type="button"
                                                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 data-[focus]:bg-red-50"
                                                            onClick={() =>
                                                                setDeleting(
                                                                    product,
                                                                )
                                                            }
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                            Hapus Produk
                                                        </button>
                                                    </MenuItem>
                                                </MenuItems>
                                            </Menu>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination + dropdown per halaman */}
                <div className="flex flex-col items-center gap-3 px-5 py-4 sm:px-6 lg:flex-row">
                    <div className="min-w-0 flex-1 self-stretch">
                        <Pagination paginator={products} />
                    </div>
                    <select
                        aria-label="Jumlah data per halaman"
                        value={products.per_page}
                        className="shrink-0 rounded-xl border-slate-200 py-2 pl-3 pr-9 text-sm text-slate-600 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]"
                        onChange={() => {}}
                    >
                        <option value={products.per_page}>
                            {products.per_page} / halaman
                        </option>
                    </select>
                </div>
            </div>

            <ProductFormModal
                show={showForm}
                product={editing}
                categories={categories}
                onClose={() => setShowForm(false)}
            />
            <DeleteProductModal
                product={deleting}
                onClose={() => setDeleting(null)}
            />
        </AuthenticatedLayout>
    );
}
