import {
    AlertTriangleIcon,
    CartIcon,
    CheckCircleIcon,
    CreditCardIcon,
    ImageIcon,
    MinusIcon,
    PencilIcon,
    PlusIcon,
    SearchIcon,
    TrashIcon,
    XIcon,
} from '@/Components/Icons';
import Modal from '@/Components/Modal';
import {
    CountUp,
    FlyDot,
    FlyToCartState,
    GridItem,
    NumberPop,
    ToastShell,
} from '@/Components/motion';
import Pagination from '@/Components/Pagination';
import PrinterPanel from '@/Components/PrinterPanel';
import { SkeletonCards } from '@/Components/TableSkeleton';
import useNavigating from '@/hooks/useNavigating';
import useOnline from '@/hooks/useOnline';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    KasirSnapshot,
    loadKasirSnapshot,
    saveKasirSnapshot,
} from '@/lib/offline/kasirCache';
import { Category, PageProps, Paginated } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivePaymentMethod,
    CartItem,
    DiscountType,
    formatRupiah,
    KasirProduct,
    ReceiptProfile,
    ReceiptTransaction,
    TaxSettings,
} from './kasir';
import PaymentModal from './PaymentModal';
import ReceiptModal from './ReceiptModal';

const inputClass =
    'block w-full rounded-xl border-slate-200 py-2.5 px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

/* ============================== Card Produk ============================== */

function ProductCard({
    product,
    cartQty,
    onAdd,
}: {
    product: KasirProduct;
    cartQty: number;
    onAdd: (source: HTMLButtonElement) => void;
}) {
    const atStockLimit =
        product.track_stock && cartQty >= product.stock && cartQty > 0;
    const clickable = product.sellable && !atStockLimit;

    return (
        <button
            type="button"
            disabled={!clickable}
            onClick={(e) => onAdd(e.currentTarget)}
            aria-label={`Tambah ${product.name} ke keranjang`}
            // Ripple global dilewati — badge qty berada di luar bounds
            data-no-ripple
            className={
                'group relative flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all duration-150 ' +
                (clickable
                    ? 'hover:-translate-y-0.5 hover:border-[#0A45FE]/40 hover:shadow-md active:scale-[0.98]'
                    : 'cursor-not-allowed')
            }
        >
            {/* Badge qty di keranjang */}
            {cartQty > 0 && (
                <span className="absolute -right-1.5 -top-1.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#0A45FE] px-1.5 text-xs font-bold text-white shadow">
                    {cartQty}
                </span>
            )}

            <div
                className={
                    'relative aspect-square w-full shrink-0 overflow-hidden rounded-xl bg-slate-50 ' +
                    (product.sellable ? '' : 'opacity-50')
                }
            >
                {product.photo_url ? (
                    <img
                        src={product.photo_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-10 w-10 text-slate-300" />
                    </div>
                )}

                {/* Badge stok / habis */}
                {!product.sellable ? (
                    <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">
                        Habis
                    </span>
                ) : (
                    product.track_stock && (
                        <span
                            className={
                                'absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-semibold ' +
                                (product.stock <= 5
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-white/90 text-slate-600')
                            }
                        >
                            Sisa {product.stock}
                        </span>
                    )
                )}
            </div>

            <div className="mt-3 flex flex-1 items-end justify-between gap-2">
                <div className={'min-w-0 ' + (product.sellable ? '' : 'opacity-50')}>
                    <p className="truncate font-semibold text-slate-900">
                        {product.name}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-slate-500">
                        {formatRupiah(product.price)}
                    </p>
                </div>
                {clickable && (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0A45FE] text-white shadow-sm transition-colors group-hover:bg-[#0838d1]">
                        <PlusIcon className="h-4 w-4" />
                    </span>
                )}
            </div>
        </button>
    );
}

/* ============================= Item Keranjang ============================ */

function CartItemRow({
    item,
    onIncrease,
    onDecrease,
    onRemove,
    onNoteChange,
}: {
    item: CartItem;
    onIncrease: () => void;
    onDecrease: () => void;
    onRemove: () => void;
    onNoteChange: (note: string) => void;
}) {
    const [showNote, setShowNote] = useState(item.note !== '');

    const atStockLimit =
        item.product.track_stock && item.qty >= item.product.stock;

    return (
        <div className="border-b border-slate-100 py-3.5 last:border-0">
            <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                    {item.product.photo_url ? (
                        <img
                            src={item.product.photo_url}
                            alt={item.product.name}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <ImageIcon className="h-5 w-5 text-slate-300" />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">
                        {item.product.name}
                    </p>
                    <p className="text-sm text-slate-500">
                        {formatRupiah(item.product.price)}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">
                        {formatRupiah(item.product.price * item.qty)}
                    </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            aria-label={`Kurangi ${item.product.name}`}
                            onClick={onDecrease}
                            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0A45FE] text-[#0A45FE] transition-colors hover:bg-blue-50"
                        >
                            <MinusIcon className="h-3.5 w-3.5" />
                        </button>
                        {/* Smooth transition qty (Fase 13) */}
                        <NumberPop
                            value={item.qty}
                            className="min-w-5 text-center font-semibold text-slate-900"
                        />
                        <button
                            type="button"
                            aria-label={`Tambah ${item.product.name}`}
                            disabled={atStockLimit}
                            onClick={onIncrease}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0A45FE] text-white transition-colors hover:bg-[#0838d1] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <PlusIcon className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            aria-label={`Catatan untuk ${item.product.name}`}
                            onClick={() => setShowNote((v) => !v)}
                            className={
                                'rounded-lg p-1.5 transition-colors ' +
                                (item.note !== ''
                                    ? 'text-[#0A45FE] hover:bg-blue-50'
                                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600')
                            }
                        >
                            <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            aria-label={`Hapus ${item.product.name}`}
                            onClick={onRemove}
                            className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                            <TrashIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {atStockLimit && (
                <p className="mt-1.5 text-xs font-medium text-amber-600">
                    Jumlah maksimal — sisa stok {item.product.stock}.
                </p>
            )}

            {showNote && (
                <input
                    type="text"
                    value={item.note}
                    placeholder="Catatan: contoh es sedikit, tanpa gula"
                    className="mt-2.5 block w-full rounded-lg border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#0A45FE] focus:ring-[#0A45FE]"
                    onChange={(e) => onNoteChange(e.target.value)}
                />
            )}
        </div>
    );
}

/* ============================ Panel Keranjang ============================ */

interface CartPanelProps {
    cart: CartItem[];
    discountType: DiscountType;
    discountValue: string;
    subtotal: number;
    discount: number;
    tax: number;
    taxLabel: string | null;
    total: number;
    onIncrease: (productId: number) => void;
    onDecrease: (productId: number) => void;
    onRemove: (productId: number) => void;
    onNoteChange: (productId: number, note: string) => void;
    onDiscountTypeChange: (type: DiscountType) => void;
    onDiscountValueChange: (value: string) => void;
    onClearRequest: () => void;
    onPay: () => void;
}

function CartPanel({
    cart,
    discountType,
    discountValue,
    subtotal,
    discount,
    tax,
    taxLabel,
    total,
    onIncrease,
    onDecrease,
    onRemove,
    onNoteChange,
    onDiscountTypeChange,
    onDiscountValueChange,
    onClearRequest,
    onPay,
}: CartPanelProps) {
    const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">
                        Keranjang
                    </h2>
                    <p className="text-sm text-slate-500">
                        {itemCount === 0
                            ? 'Belum ada item'
                            : `${itemCount} item`}
                    </p>
                </div>
                <button
                    type="button"
                    aria-label="Kosongkan keranjang"
                    disabled={cart.length === 0}
                    onClick={onClearRequest}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-500 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <TrashIcon className="h-5 w-5" />
                </button>
            </div>

            {/* Area yang bisa di-scroll: item + diskon + ringkasan. Di layar
                pendek (mis. HP landscape) seluruh bagian ini dapat digulir,
                sementara tombol Bayar tetap menempel di bawah & bisa diklik. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {/* Daftar item — tumbuh agar ringkasan menempel ke bawah saat
                    item sedikit (tampilan desktop tetap seperti semula). */}
                <div className="min-h-40 flex-1">
                    {cart.length === 0 ? (
                        <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 py-8 text-center">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                <CartIcon className="h-7 w-7" />
                            </span>
                            <div>
                                <p className="font-semibold text-slate-700">
                                    Keranjang kosong
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                    Klik produk untuk menambahkan.
                                </p>
                            </div>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <CartItemRow
                                key={item.product.id}
                                item={item}
                                onIncrease={() => onIncrease(item.product.id)}
                                onDecrease={() => onDecrease(item.product.id)}
                                onRemove={() => onRemove(item.product.id)}
                                onNoteChange={(note) =>
                                    onNoteChange(item.product.id, note)
                                }
                            />
                        ))
                    )}
                </div>

                {/* Diskon */}
                <div className="shrink-0 border-t border-slate-100 pt-4">
                    <label
                        htmlFor="cart-discount"
                        className="block text-sm font-medium text-slate-900"
                    >
                        Diskon
                    </label>
                    <div className="mt-2 flex gap-2">
                        <div className="inline-flex shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-1">
                            <button
                                type="button"
                                onClick={() => onDiscountTypeChange('nominal')}
                                className={
                                    'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ' +
                                    (discountType === 'nominal'
                                        ? 'bg-white text-[#0A45FE] shadow-sm'
                                        : 'text-slate-500')
                                }
                            >
                                Rp
                            </button>
                            <button
                                type="button"
                                onClick={() => onDiscountTypeChange('percent')}
                                className={
                                    'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ' +
                                    (discountType === 'percent'
                                        ? 'bg-white text-[#0A45FE] shadow-sm'
                                        : 'text-slate-500')
                                }
                            >
                                %
                            </button>
                        </div>
                        <input
                            id="cart-discount"
                            type="number"
                            min={0}
                            max={discountType === 'percent' ? 100 : undefined}
                            value={discountValue}
                            placeholder="0"
                            className="block w-full rounded-xl border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#0A45FE] focus:ring-[#0A45FE]"
                            onChange={(e) =>
                                onDiscountValueChange(e.target.value)
                            }
                        />
                    </div>
                </div>

                {/* Ringkasan */}
                <div className="mt-4 shrink-0 space-y-2 border-t border-slate-100 pt-4">
                    {/* Count-up saat nilai berubah (Fase 13 — PRD Bab 14) */}
                    <div className="flex items-center justify-between text-slate-600">
                        <span>Subtotal</span>
                        <span className="font-medium text-slate-900">
                            <CountUp value={subtotal} format={formatRupiah} />
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                        <span>Diskon</span>
                        <span
                            className={
                                'font-medium ' +
                                (discount > 0
                                    ? 'text-red-600'
                                    : 'text-slate-900')
                            }
                        >
                            {discount > 0 ? '− ' : ''}
                            <CountUp value={discount} format={formatRupiah} />
                        </span>
                    </div>
                    {/* Pajak OFF → baris pajak tidak muncul (PRD 5.13.B) */}
                    {taxLabel !== null && (
                        <div className="flex items-center justify-between text-slate-600">
                            <span>{taxLabel}</span>
                            <span className="font-medium text-slate-900">
                                <CountUp value={tax} format={formatRupiah} />
                            </span>
                        </div>
                    )}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="text-lg font-bold text-slate-900">
                            Total
                        </span>
                        <span className="text-xl font-extrabold text-[#0A45FE]">
                            <CountUp value={total} format={formatRupiah} />
                        </span>
                    </div>
                </div>
            </div>

            {/* Tombol Bayar — selalu menempel di bawah panel & bisa diklik
                (PRD 5.2), termasuk saat area di atas digulir. */}
            <button
                type="button"
                disabled={cart.length === 0}
                onClick={onPay}
                className="mt-4 flex w-full shrink-0 items-center justify-center gap-2.5 rounded-xl bg-[#0A45FE] py-3.5 text-lg font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[#0838d1] disabled:cursor-not-allowed disabled:opacity-50"
            >
                <CreditCardIcon className="h-5 w-5" />
                Bayar
            </button>
        </div>
    );
}

/* ============================ Konfirmasi umum ============================ */

function ConfirmModal({
    show,
    title,
    message,
    confirmLabel,
    onConfirm,
    onCancel,
}: {
    show: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <Modal show={show} onClose={onCancel} maxWidth="md">
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                        <AlertTriangleIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            {title}
                        </h2>
                        <p className="mt-1 text-slate-500">{message}</p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

/* ================================ Halaman ================================ */

export default function Index({
    products,
    categories,
    filters,
    paymentMethods,
    taxSettings,
    receiptProfile,
}: PageProps<{
    products: Paginated<KasirProduct>;
    categories: Category[];
    filters: { search: string; category: number | null };
    paymentMethods: ActivePaymentMethod[];
    taxSettings: TaxSettings;
    receiptProfile: ReceiptProfile;
}>) {
    const [search, setSearch] = useState(filters.search);
    const [categoryFilter, setCategoryFilter] = useState<number | null>(
        filters.category,
    );

    const [cart, setCart] = useState<CartItem[]>([]);
    const [discountType, setDiscountType] = useState<DiscountType>('nominal');
    const [discountValue, setDiscountValue] = useState('');

    const [removeCandidate, setRemoveCandidate] = useState<CartItem | null>(
        null,
    );
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showMobileCart, setShowMobileCart] = useState(false);

    // Kunci scroll latar saat bottom sheet keranjang (mobile) terbuka,
    // agar konten di belakang tidak ikut bergeser & sheet stabil.
    useEffect(() => {
        if (!showMobileCart) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [showMobileCart]);

    // Fase 5 — pembayaran, preview struk, toast sukses
    const [showPayment, setShowPayment] = useState(false);
    const [receipt, setReceipt] = useState<ReceiptTransaction | null>(null);
    const [successToast, setSuccessToast] = useState<string | null>(null);
    const toastTimer = useRef<number | undefined>(undefined);

    const isFirstRender = useRef(true);

    // Fase 15 — mode offline: cache snapshot & sumber data lokal
    const online = useOnline();
    const kasirName = usePage<PageProps>().props.auth.user.name;
    const [offlineSnapshot, setOfflineSnapshot] =
        useState<KasirSnapshot | null>(null);
    const [offlineRefresh, setOfflineRefresh] = useState(0);

    // Saat online — simpan snapshot penuh (semua produk + kategori)
    // ke IndexedDB agar layar Kasir tetap jalan offline (PRD 5.14)
    useEffect(() => {
        if (!online) return;

        let cancelled = false;
        axios
            .get(route('kasir.offline-data'))
            .then((response) => {
                if (!cancelled) {
                    void saveKasirSnapshot(response.data as KasirSnapshot);
                }
            })
            .catch(() => {
                // Gagal cache snapshot tidak mengganggu kasir online
            });

        return () => {
            cancelled = true;
        };
    }, [online]);

    // Saat offline — muat snapshot dari IndexedDB (ulang tiap transaksi
    // offline agar sisa stok lokal terkini terlihat)
    useEffect(() => {
        if (online) {
            setOfflineSnapshot(null);
            return;
        }

        let cancelled = false;
        loadKasirSnapshot()
            .then((snapshot) => {
                if (!cancelled) setOfflineSnapshot(snapshot);
            })
            .catch(() => {
                if (!cancelled) setOfflineSnapshot(null);
            });

        return () => {
            cancelled = true;
        };
    }, [online, offlineRefresh]);

    const usingOffline = !online && offlineSnapshot !== null;

    // Search realtime + debounce 300ms (PRD Bab 11); filter kategori chip.
    // Offline: filter lokal, tidak menghubungi server.
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        // Offline → penyaringan dilakukan lokal (lihat displayProducts)
        if (!online) return;

        const timer = window.setTimeout(() => {
            const params: Record<string, string> = {};
            if (search) params.search = search;
            if (categoryFilter) params.category = String(categoryFilter);

            router.get(route('kasir'), params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search, categoryFilter, online]);

    // Peta qty per produk untuk badge & batas stok di grid
    const navigating = useNavigating();

    // Fly-to-cart (Fase 13) — titik terbang dari card ke keranjang
    const [fly, setFly] = useState<FlyToCartState | null>(null);
    const flyKey = useRef(0);

    const triggerFly = (source: HTMLElement) => {
        const target = [
            document.getElementById('cart-fly-target'),
            document.getElementById('cart-fly-target-mobile'),
        ].find((node) => node !== null && node.offsetParent !== null);

        if (!target) {
            return;
        }

        const from = source.getBoundingClientRect();
        const to = target.getBoundingClientRect();

        setFly({
            key: ++flyKey.current,
            from: {
                x: from.left + from.width / 2 - 8,
                y: from.top + from.height / 2 - 8,
            },
            to: {
                x: to.left + to.width / 2 - 8,
                y: to.top + to.height / 2 - 8,
            },
        });
    };

    const cartQtyByProduct = useMemo(() => {
        const map: Record<number, number> = {};
        for (const item of cart) {
            map[item.product.id] = item.qty;
        }
        return map;
    }, [cart]);

    /* --------------------- Sumber data (online/offline) ------------------- */
    // Offline → produk/kategori/metode/pajak dari snapshot IndexedDB.
    const activeTax =
        usingOffline && offlineSnapshot
            ? offlineSnapshot.taxSettings
            : taxSettings;
    const activePaymentMethods =
        usingOffline && offlineSnapshot
            ? offlineSnapshot.paymentMethods
            : paymentMethods;
    const activeReceiptProfile =
        usingOffline && offlineSnapshot
            ? offlineSnapshot.receiptProfile
            : receiptProfile;
    const displayCategories =
        usingOffline && offlineSnapshot
            ? offlineSnapshot.categories
            : categories;

    // Offline: filter produk snapshot lokal (nama + kategori);
    // Online: pakai hasil paginasi server apa adanya.
    const displayProducts = useMemo(() => {
        if (!usingOffline || offlineSnapshot === null) return products.data;

        const term = search.trim().toLowerCase();
        return offlineSnapshot.products.filter((product) => {
            const matchCategory =
                categoryFilter === null ||
                product.category_id === categoryFilter;
            const matchSearch =
                term === '' || product.name.toLowerCase().includes(term);
            return matchCategory && matchSearch;
        });
    }, [
        usingOffline,
        offlineSnapshot,
        products.data,
        search,
        categoryFilter,
    ]);

    /* ------------------------------ Keranjang ----------------------------- */

    const addToCart = (product: KasirProduct) => {
        if (!product.sellable) return;

        setCart((current) => {
            const existing = current.find(
                (item) => item.product.id === product.id,
            );

            // Produk sama diklik lagi → qty bertambah, bukan baris baru
            if (existing) {
                if (
                    product.track_stock &&
                    existing.qty >= product.stock
                ) {
                    return current; // + tidak boleh melebihi sisa stok
                }
                return current.map((item) =>
                    item.product.id === product.id
                        ? { ...item, qty: item.qty + 1 }
                        : item,
                );
            }

            return [...current, { product, qty: 1, note: '' }];
        });
    };

    const increaseQty = (productId: number) => {
        setCart((current) =>
            current.map((item) => {
                if (item.product.id !== productId) return item;
                if (
                    item.product.track_stock &&
                    item.qty >= item.product.stock
                ) {
                    return item;
                }
                return { ...item, qty: item.qty + 1 };
            }),
        );
    };

    const decreaseQty = (productId: number) => {
        const item = cart.find((item) => item.product.id === productId);
        if (!item) return;

        // Tombol − saat qty = 1 → hapus dengan konfirmasi (PRD 5.2)
        if (item.qty === 1) {
            setRemoveCandidate(item);
            return;
        }

        setCart((current) =>
            current.map((item) =>
                item.product.id === productId
                    ? { ...item, qty: item.qty - 1 }
                    : item,
            ),
        );
    };

    const removeItem = (productId: number) => {
        setCart((current) =>
            current.filter((item) => item.product.id !== productId),
        );
    };

    const setNote = (productId: number, note: string) => {
        setCart((current) =>
            current.map((item) =>
                item.product.id === productId ? { ...item, note } : item,
            ),
        );
    };

    const clearCart = () => {
        setCart([]);
        setDiscountValue('');
        setShowClearConfirm(false);
        setShowMobileCart(false);
    };

    /* ----------------------- Perhitungan (PRD 5.2) ------------------------ */
    // Total = (Σ subtotal item − diskon) + pajak
    // Cermin dari KasirController@calculate & TransactionController

    const subtotal = cart.reduce(
        (sum, item) => sum + item.product.price * item.qty,
        0,
    );

    const discountInput = Number(discountValue) || 0;
    const discount =
        discountType === 'percent'
            ? Math.round((subtotal * Math.min(discountInput, 100)) / 100)
            : Math.min(Math.round(discountInput), subtotal);

    const tax = activeTax.enabled
        ? Math.round(((subtotal - discount) * activeTax.percent) / 100)
        : 0;
    const total = subtotal - discount + tax;

    const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

    /* ----------------------- Pembayaran (Fase 5) -------------------------- */

    const handlePay = () => {
        if (cart.length === 0) return;
        setShowPayment(true);
    };

    // Fase 15 — transaksi bisa online (dari server) atau offline (lokal)
    const [lastOffline, setLastOffline] = useState(false);

    const handlePaymentSuccess = (
        transaction: ReceiptTransaction,
        offline: boolean,
    ) => {
        setShowPayment(false);
        setLastOffline(offline);
        setReceipt(transaction); // preview struk sebelum print (PRD 5.5)
    };

    // Selesai: keranjang kosong, kembali ke Kasir, toast sukses (PRD 5.3)
    const finishTransaction = () => {
        const invoice = receipt?.invoice_number;
        const wasOffline = lastOffline;
        setReceipt(null);
        setCart([]);
        setDiscountValue('');
        setShowMobileCart(false);

        setSuccessToast(
            wasOffline
                ? 'Transaksi tersimpan offline — akan disinkronkan otomatis saat online.'
                : invoice
                  ? `Transaksi ${invoice} berhasil disimpan.`
                  : 'Transaksi berhasil disimpan.',
        );
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(
            () => setSuccessToast(null),
            3500,
        );

        if (wasOffline) {
            // Offline: muat ulang snapshot lokal (stok sudah dikurangi)
            setOfflineRefresh((value) => value + 1);
        } else {
            // Segarkan grid produk agar sisa stok terbaru terlihat
            router.reload({ only: ['products'] });
        }
    };

    const cartPanelProps: CartPanelProps = {
        cart,
        discountType,
        discountValue,
        subtotal,
        discount,
        tax,
        taxLabel: activeTax.enabled
            ? `Pajak (${activeTax.name} ${activeTax.percent}%)`
            : null,
        total,
        onIncrease: increaseQty,
        onDecrease: decreaseQty,
        onRemove: (productId) => {
            const item = cart.find((item) => item.product.id === productId);
            if (item) setRemoveCandidate(item);
        },
        onNoteChange: setNote,
        onDiscountTypeChange: setDiscountType,
        onDiscountValueChange: setDiscountValue,
        onClearRequest: () => setShowClearConfirm(true),
        onPay: handlePay,
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                            Kasir (POS)
                        </h1>
                        <p className="hidden text-sm text-slate-500 sm:block">
                            Pilih produk untuk memulai transaksi.
                        </p>
                    </div>
                    {/* Status & kontrol printer Bluetooth (Fase 14) */}
                    <PrinterPanel storeName={receiptProfile.name} />
                </div>
            }
        >
            <Head title="Kasir (POS)" />

            <div className="flex flex-col gap-5 pb-24 lg:flex-row lg:items-start lg:pb-0">
                {/* Panel kiri — search, filter kategori, grid produk */}
                <div className="min-w-0 flex-1">
                    {/* Search */}
                    <div className="relative">
                        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            placeholder="Cari produk atau barcode..."
                            className={inputClass + ' py-3 pl-12'}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Chip kategori */}
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                        <button
                            type="button"
                            onClick={() => setCategoryFilter(null)}
                            className={
                                'shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-150 ' +
                                (categoryFilter === null
                                    ? 'bg-[#0A45FE] text-white shadow-sm'
                                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50')
                            }
                        >
                            Semua
                        </button>
                        {displayCategories.map((category) => (
                            <button
                                key={category.id}
                                type="button"
                                onClick={() => setCategoryFilter(category.id)}
                                className={
                                    'shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-150 ' +
                                    (categoryFilter === category.id
                                        ? 'bg-[#0A45FE] text-white shadow-sm'
                                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50')
                                }
                            >
                                {category.name}
                            </button>
                        ))}
                    </div>

                    {/* Grid produk — skeleton saat memuat (PRD Bab 10).
                        Offline: sumber = snapshot lokal (usingOffline). */}
                    {navigating && !usingOffline ? (
                        <SkeletonCards />
                    ) : displayProducts.length === 0 ? (
                        <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                <SearchIcon className="h-7 w-7" />
                            </span>
                            <div>
                                <p className="font-semibold text-slate-700">
                                    Produk tidak ditemukan
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                    {search || categoryFilter
                                        ? 'Coba ubah kata kunci atau filter kategori.'
                                        : usingOffline
                                          ? 'Data lokal belum tersedia. Hubungkan internet sekali untuk menyimpan katalog.'
                                          : 'Belum ada produk. Tambahkan lewat menu Produk.'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {displayProducts.map((product, index) => (
                                <GridItem
                                    key={product.id}
                                    index={index}
                                    className="h-full"
                                >
                                    <ProductCard
                                        product={product}
                                        cartQty={
                                            cartQtyByProduct[product.id] ?? 0
                                        }
                                        onAdd={(source) => {
                                            triggerFly(source);
                                            addToCart(product);
                                        }}
                                    />
                                </GridItem>
                            ))}
                        </div>
                    )}

                    {/* Pagination hanya untuk data server (online) */}
                    {!usingOffline && (
                        <div className="mt-5">
                            <Pagination paginator={products} />
                        </div>
                    )}
                </div>

                {/* Panel kanan — keranjang (desktop) */}
                <aside className="sticky top-4 hidden w-[350px] shrink-0 self-start lg:block xl:w-[380px]">
                    <div
                        id="cart-fly-target"
                        className="flex max-h-[calc(100vh-2rem)] min-h-[480px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                        <CartPanel {...cartPanelProps} />
                    </div>
                </aside>
            </div>

            {/* Bar keranjang mobile */}
            {!showMobileCart && (
                <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] lg:hidden">
                    <button
                        type="button"
                        id="cart-fly-target-mobile"
                        onClick={() => setShowMobileCart(true)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl bg-[#0A45FE] px-4 py-3 text-white shadow-sm transition-colors hover:bg-[#0838d1]"
                    >
                        <span className="flex items-center gap-2.5">
                            <span className="relative">
                                <CartIcon className="h-5 w-5" />
                                {itemCount > 0 && (
                                    <span className="absolute -right-2.5 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-[#0A45FE]">
                                        {itemCount}
                                    </span>
                                )}
                            </span>
                            <span className="font-semibold">Keranjang</span>
                        </span>
                        <span className="text-lg font-bold">
                            <CountUp value={total} format={formatRupiah} />
                        </span>
                    </button>
                </div>
            )}

            {/* Bottom sheet keranjang (mobile) */}
            {showMobileCart && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div
                        className="absolute inset-0 bg-slate-900/40"
                        onClick={() => setShowMobileCart(false)}
                    />
                    <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-white p-5 pb-6 shadow-xl motion-safe:animate-[sheet-up_250ms_ease-out]">
                        <div className="mx-auto mb-3 h-1.5 w-12 shrink-0 rounded-full bg-slate-200" />
                        <button
                            type="button"
                            aria-label="Tutup keranjang"
                            onClick={() => setShowMobileCart(false)}
                            className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                        >
                            <XIcon className="h-5 w-5" />
                        </button>
                        <CartPanel {...cartPanelProps} />
                    </div>
                </div>
            )}

            {/* Konfirmasi hapus item */}
            <ConfirmModal
                show={removeCandidate !== null}
                title="Hapus Item"
                message={`Hapus ${removeCandidate?.product.name ?? ''} dari keranjang?`}
                confirmLabel="Hapus"
                onConfirm={() => {
                    if (removeCandidate) {
                        removeItem(removeCandidate.product.id);
                    }
                    setRemoveCandidate(null);
                }}
                onCancel={() => setRemoveCandidate(null)}
            />

            {/* Konfirmasi kosongkan keranjang */}
            <ConfirmModal
                show={showClearConfirm}
                title="Kosongkan Keranjang"
                message="Semua item di keranjang akan dihapus. Lanjutkan?"
                confirmLabel="Kosongkan"
                onConfirm={clearCart}
                onCancel={() => setShowClearConfirm(false)}
            />

            {/* Modal pembayaran (Fase 5 — PRD 5.3; Fase 15 — offline) */}
            <PaymentModal
                show={showPayment}
                cart={cart}
                discountType={discountType}
                discountValue={discountValue}
                subtotal={subtotal}
                discount={discount}
                tax={tax}
                taxSettings={activeTax}
                paymentMethods={activePaymentMethods}
                online={online}
                kasirName={kasirName}
                onClose={() => setShowPayment(false)}
                onSuccess={handlePaymentSuccess}
            />

            {/* Preview & cetak struk (PRD 5.5) */}
            <ReceiptModal
                show={receipt !== null}
                receipt={receipt}
                profile={activeReceiptProfile}
                onDone={finishTransaction}
            />

            {/* Toast sukses transaksi */}
            <ToastShell
                show={successToast !== null && successToast !== ''}
                className="fixed right-4 top-4 z-[60] flex items-center gap-3 rounded-xl border border-green-200 bg-white px-4 py-3 shadow-lg sm:right-6 sm:top-6 print:hidden"
            >
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
                <p className="font-medium text-slate-800">{successToast}</p>
            </ToastShell>

            {/* Fly-to-cart overlay (Fase 13) */}
            <FlyDot fly={fly} onDone={() => setFly(null)} />
        </AuthenticatedLayout>
    );
}
