import Dropdown from '@/Components/Dropdown';
import {
    BoxIcon,
    CartIcon,
    ChartIcon,
    CheckCircleIcon,
    ChevronDownIcon,
    ClockIcon,
    FolderIcon,
    GearIcon,
    LogOutIcon,
    MenuIcon,
    UserCircleIcon,
    WalletIcon,
    XIcon,
} from '@/Components/Icons';
import InstallPrompt from '@/Components/InstallPrompt';
import { RippleEffect, ToastShell } from '@/Components/motion';
import PitouLogo from '@/Components/PitouLogo';
import SyncIndicator from '@/Components/SyncIndicator';
import useAutoLogout from '@/hooks/useAutoLogout';
import { syncService } from '@/lib/offline/syncService';
import { PageProps, Role } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { motion } from 'framer-motion';
import {
    ComponentType,
    PropsWithChildren,
    ReactNode,
    SVGAttributes,
    useEffect,
    useState,
} from 'react';

// Sidebar slide-in hanya sekali per sesi tab — layout ikut remount
// tiap navigasi Inertia, jangan animasi ulang terus-menerus
let sidebarHasAnimated = false;

const roleLabels: Record<Role, string> = {
    owner: 'Owner',
    admin: 'Admin',
    kasir: 'Kasir',
};

interface MenuItem {
    label: string;
    icon: ComponentType<SVGAttributes<SVGElement>>;
    routeName?: string; // tanpa route = modul fase berikutnya (disabled)
    roles: Role[];
}

// Sidebar sesuai PRD 4.1 — menu tanpa route dibangun di fase berikutnya
const menuItems: MenuItem[] = [
    {
        label: 'Kasir (POS)',
        icon: CartIcon,
        routeName: 'kasir',
        roles: ['owner', 'admin', 'kasir'],
    },
    {
        label: 'Produk',
        icon: BoxIcon,
        routeName: 'produk',
        roles: ['owner', 'admin'],
    },
    {
        label: 'Kategori',
        icon: FolderIcon,
        routeName: 'kategori',
        roles: ['owner', 'admin'],
    },
    {
        label: 'Pengeluaran',
        icon: WalletIcon,
        routeName: 'pengeluaran',
        // Kasir view only (Fase 9) — paralel Supplier & Pembelian
        roles: ['owner', 'admin', 'kasir'],
    },
    {
        label: 'Riwayat Transaksi',
        icon: ClockIcon,
        routeName: 'riwayat',
        roles: ['owner', 'admin', 'kasir'],
    },
    {
        label: 'Laporan',
        icon: ChartIcon,
        routeName: 'laporan',
        // Kasir hanya laporan penjualan miliknya (dialihkan di server)
        roles: ['owner', 'admin', 'kasir'],
    },
    {
        label: 'Pengaturan',
        icon: GearIcon,
        routeName: 'pengaturan',
        roles: ['owner', 'admin'],
    },
];

function SidebarContent({ role }: { role: Role }) {
    const { store } = usePage<PageProps>().props;

    const items = menuItems.filter((item) => item.roles.includes(role));

    return (
        <>
            <div className="flex items-center gap-3 px-5 pb-5 pt-6">
                {store.logo ? (
                    <img
                        src={store.logo}
                        alt={store.name}
                        className="h-9 w-9 shrink-0 object-contain"
                    />
                ) : (
                    <PitouLogo className="h-9 w-9" />
                )}
                <span className="truncate text-lg font-bold uppercase tracking-wide text-slate-900">
                    {store.name}
                </span>
            </div>

            <div className="mx-5 h-px bg-slate-200" />

            <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5">
                {items.map((item) => {
                    const IconComponent = item.icon;

                    if (item.routeName === undefined) {
                        return (
                            <div
                                key={item.label}
                                className="flex cursor-default items-center gap-3 rounded-xl px-3.5 py-2.5 text-slate-400"
                                title="Tersedia di fase berikutnya"
                            >
                                <IconComponent className="h-5 w-5 shrink-0" />
                                <span className="truncate font-medium">
                                    {item.label}
                                </span>
                                <span className="ms-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    Segera
                                </span>
                            </div>
                        );
                    }

                    // Sub-halaman (mis. laporan.penjualan) ikut
                    // menyalakan menu induknya
                    const active =
                        route().current(item.routeName) ||
                        route().current(`${item.routeName}.*`);

                    return (
                        <Link
                            key={item.label}
                            href={route(item.routeName)}
                            className={
                                'flex items-center gap-3 rounded-xl px-3.5 py-2.5 font-medium transition-colors duration-150 ' +
                                (active
                                    ? 'bg-[#0A45FE] text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
                            }
                        >
                            <IconComponent className="h-5 w-5 shrink-0" />
                            <span className="truncate">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <UserCard />
        </>
    );
}

/** Avatar user — foto profil, atau ikon default bila kosong (Fase 11). */
function UserAvatar({
    photoUrl,
    name,
    sizeClass,
}: {
    photoUrl: string | null;
    name: string;
    sizeClass: string;
}) {
    if (photoUrl) {
        return (
            <img
                src={photoUrl}
                alt={name}
                className={
                    sizeClass + ' shrink-0 rounded-full object-cover'
                }
            />
        );
    }

    return (
        <span
            className={
                sizeClass +
                ' flex shrink-0 items-center justify-center rounded-full bg-[#0A45FE] text-white'
            }
        >
            <UserCircleIcon className="h-[60%] w-[60%]" />
        </span>
    );
}

function UserCard() {
    const user = usePage<PageProps>().props.auth.user;

    return (
        <div className="border-t border-slate-200 p-4">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <UserAvatar
                    photoUrl={user.photo_url}
                    name={user.name}
                    sizeClass="h-10 w-10"
                />
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">
                        {user.name}
                    </p>
                    <p className="truncate text-sm text-slate-500">
                        {roleLabels[user.role]}
                    </p>
                </div>
                <Link
                    href={route('logout')}
                    method="post"
                    as="button"
                    title="Keluar"
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                    <LogOutIcon className="h-5 w-5" />
                </Link>
            </div>
        </div>
    );
}

/**
 * Fase 12 (PRD Bab 9) — banner offline + toast kegagalan request.
 * Request yang gagal (server tak terjangkau) tidak membuat blank
 * screen: halaman tetap utuh + pesan jelas & actionable.
 */
function ConnectionStatus() {
    const [online, setOnline] = useState(true);
    const [failure, setFailure] = useState<string | null>(null);

    useEffect(() => {
        setOnline(navigator.onLine);

        const goOnline = () => setOnline(true);
        const goOffline = () => setOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        // Kegagalan jaringan saat request Inertia → toast, bukan crash
        const offException = router.on('exception', (event) => {
            event.preventDefault();
            setFailure(
                navigator.onLine
                    ? 'Gagal terhubung ke server. Silakan coba lagi.'
                    : 'Anda sedang offline. Periksa koneksi internet, lalu coba lagi.',
            );
        });

        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
            offException();
        };
    }, []);

    useEffect(() => {
        if (failure !== null) {
            const timer = window.setTimeout(() => setFailure(null), 5000);

            return () => window.clearTimeout(timer);
        }
    }, [failure]);

    return (
        <>
            {!online && (
                <div
                    role="alert"
                    className="fixed inset-x-0 top-0 z-[60] bg-red-600 px-4 py-1.5 text-center text-sm font-semibold text-white"
                >
                    🔴 Offline — fitur yang membutuhkan server tidak tersedia
                    sampai koneksi kembali.
                </div>
            )}
            <ToastShell
                show={failure !== null}
                className="fixed right-4 top-4 z-[60] flex items-center gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 shadow-lg sm:right-6 sm:top-6"
            >
                <XIcon className="h-5 w-5 shrink-0 rounded-full bg-red-50 p-0.5 text-red-600" />
                <p className="font-medium text-slate-800">{failure}</p>
                <button
                    type="button"
                    aria-label="Tutup notifikasi"
                    className="ms-2 text-slate-400 hover:text-slate-600"
                    onClick={() => setFailure(null)}
                >
                    <XIcon className="h-4 w-4" />
                </button>
            </ToastShell>
        </>
    );
}

function FlashToast() {
    const { flash } = usePage<PageProps>().props;
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (flash.success) {
            setVisible(true);
            const timer = window.setTimeout(() => setVisible(false), 3500);

            return () => window.clearTimeout(timer);
        }
    }, [flash]);

    return (
        <ToastShell
            show={visible && flash.success !== null}
            className="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-xl border border-green-200 bg-white px-4 py-3 shadow-lg sm:right-6 sm:top-6"
        >
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-green-600" />
            <p className="font-medium text-slate-800">{flash.success}</p>
            <button
                type="button"
                aria-label="Tutup notifikasi"
                className="ms-2 text-slate-400 hover:text-slate-600"
                onClick={() => setVisible(false)}
            >
                <XIcon className="h-4 w-4" />
            </button>
        </ToastShell>
    );
}

export default function Authenticated({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const user = usePage<PageProps>().props.auth.user;
    // Fade transition antar halaman — key berganti hanya saat pindah
    // komponen halaman (filter/search di halaman sama tidak remount)
    const pageComponent = usePage().component;

    useAutoLogout();

    // Fase 15 — pemicu sinkronisasi otomatis (saat online kembali &
    // saat aplikasi dibuka dengan antrean pending); idempotent
    useEffect(() => {
        syncService.init();
    }, []);

    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Kunci scroll latar saat sidebar mobile terbuka agar halaman di
    // belakang overlay tidak ikut bergeser (mencegah header/ikon menu
    // "berpindah" saat digulir). Dipulihkan otomatis saat ditutup.
    useEffect(() => {
        if (!sidebarOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [sidebarOpen]);

    // Tutup sidebar otomatis saat berpindah halaman (mis. klik menu).
    useEffect(() => {
        const off = router.on('navigate', () => setSidebarOpen(false));
        return () => off();
    }, []);

    return (
        <div className="min-h-screen bg-[#f5f6fa]">
            <RippleEffect />
            <ConnectionStatus />
            <FlashToast />
            {/* Ajakan install PWA (Fase 15) */}
            <InstallPrompt />

            {/* Sidebar — desktop; slide-in saat load (PRD Bab 14) */}
            <motion.aside
                className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex"
                initial={
                    sidebarHasAnimated ? false : { x: -24, opacity: 0 }
                }
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                onAnimationComplete={() => {
                    sidebarHasAnimated = true;
                }}
            >
                <SidebarContent role={user.role} />
            </motion.aside>

            {/* Sidebar — mobile (overlay) */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div
                        className="absolute inset-0 bg-slate-900/40"
                        onClick={() => setSidebarOpen(false)}
                    />
                    <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl">
                        <button
                            type="button"
                            aria-label="Tutup menu"
                            className="absolute right-3 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <XIcon className="h-5 w-5" />
                        </button>
                        <SidebarContent role={user.role} />
                    </aside>
                </div>
            )}

            <div className="flex min-h-screen flex-col lg:pl-64">
                {/* Header */}
                <header className="flex items-center justify-between gap-4 px-4 pb-2 pt-5 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            aria-label="Buka menu"
                            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 lg:hidden"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <MenuIcon className="h-5 w-5" />
                        </button>
                        <div className="min-w-0">{header}</div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                    {/* Indikator sinkronisasi offline (Fase 15) */}
                    <SyncIndicator />

                    <Dropdown>
                        <Dropdown.Trigger>
                            <button
                                type="button"
                                className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-2 pr-3 shadow-sm transition-colors hover:bg-slate-50"
                            >
                                <UserAvatar
                                    photoUrl={user.photo_url}
                                    name={user.name}
                                    sizeClass="h-8 w-8"
                                />
                                <span className="hidden max-w-32 truncate font-medium text-slate-800 sm:block">
                                    {user.name}
                                </span>
                                <ChevronDownIcon className="h-4 w-4 text-slate-400" />
                            </button>
                        </Dropdown.Trigger>

                        <Dropdown.Content>
                            <div className="border-b border-slate-100 px-4 py-2">
                                <p className="truncate text-sm font-semibold text-slate-800">
                                    {user.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {roleLabels[user.role]}
                                </p>
                            </div>
                            <Dropdown.Link href={route('profile')}>
                                Profil Saya
                            </Dropdown.Link>
                            {(user.role === 'owner' ||
                                user.role === 'admin') && (
                                <Dropdown.Link href={route('users')}>
                                    Manajemen Pengguna
                                </Dropdown.Link>
                            )}
                            {user.role === 'owner' && (
                                <>
                                    <Dropdown.Link href={route('backup')}>
                                        Backup & Restore
                                    </Dropdown.Link>
                                    <Dropdown.Link
                                        href={route('activity-log')}
                                    >
                                        Activity Log
                                    </Dropdown.Link>
                                </>
                            )}
                            <Dropdown.Link
                                href={route('logout')}
                                method="post"
                                as="button"
                            >
                                Keluar
                            </Dropdown.Link>
                        </Dropdown.Content>
                    </Dropdown>
                    </div>
                </header>

                <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8">
                    <motion.div
                        key={pageComponent}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                        {children}
                    </motion.div>
                </main>
            </div>
        </div>
    );
}
