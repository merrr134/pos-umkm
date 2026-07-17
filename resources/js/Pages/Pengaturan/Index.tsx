import {
    BanknoteIcon,
    CreditCardIcon,
    ImageIcon,
    LandmarkIcon,
    PercentIcon,
    QrCodeIcon,
    StoreIcon,
    UploadIcon,
    WhatsAppIcon,
} from '@/Components/Icons';
import InputError from '@/Components/InputError';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    AppSettings,
    PageProps,
    PaymentMethod,
    RoundingMethod,
} from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    ChangeEvent,
    ComponentType,
    FormEventHandler,
    SVGAttributes,
    useEffect,
    useMemo,
    useState,
} from 'react';

type TabId = 'profil' | 'pajak' | 'metode' | 'whatsapp';

interface TabItem {
    id: TabId;
    label: string;
    description: string;
    icon: ComponentType<SVGAttributes<SVGElement>>;
    ownerOnly?: boolean;
}

const tabs: TabItem[] = [
    {
        id: 'profil',
        label: 'Profil Toko',
        description: 'Identitas cafe dan struk',
        icon: StoreIcon,
        ownerOnly: true,
    },
    {
        id: 'pajak',
        label: 'Pajak & Biaya',
        description: 'Pengaturan pajak dan biaya',
        icon: PercentIcon,
    },
    {
        id: 'metode',
        label: 'Metode Pembayaran',
        description: 'Kelola metode pembayaran',
        icon: CreditCardIcon,
    },
    {
        id: 'whatsapp',
        label: 'WhatsApp',
        description: 'Kirim struk digital via WhatsApp',
        icon: WhatsAppIcon,
    },
];

const roundingOptions: { value: RoundingMethod; label: string }[] = [
    { value: 'none', label: 'Tanpa pembulatan' },
    { value: 'up_100', label: 'Ke atas (kelipatan 100)' },
    { value: 'up_500', label: 'Ke atas (kelipatan 500)' },
    { value: 'up_1000', label: 'Ke atas (kelipatan 1.000)' },
    { value: 'down_100', label: 'Ke bawah (kelipatan 100)' },
    { value: 'down_500', label: 'Ke bawah (kelipatan 500)' },
    { value: 'down_1000', label: 'Ke bawah (kelipatan 1.000)' },
    { value: 'nearest_100', label: 'Terdekat (kelipatan 100)' },
    { value: 'nearest_500', label: 'Terdekat (kelipatan 500)' },
    { value: 'nearest_1000', label: 'Terdekat (kelipatan 1.000)' },
];

const inputClass =
    'block w-full rounded-xl border-slate-200 py-2.5 px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE] disabled:bg-slate-50 disabled:text-slate-400';

function SectionCard({
    title,
    description,
    action,
    children,
}: {
    title: string;
    description: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">
                        {title}
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                        {description}
                    </p>
                </div>
                {action}
            </div>
            <div className="px-5 py-5 sm:px-6">{children}</div>
        </section>
    );
}

function Toggle({
    checked,
    onChange,
    disabled = false,
    label,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={
                'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0A45FE] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ' +
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

function SubmitButton({
    processing,
    children,
}: {
    processing: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            type="submit"
            disabled={processing}
            className="inline-flex items-center justify-center rounded-xl bg-[#0A45FE] px-6 py-2.5 font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[#0838d1] disabled:opacity-60"
        >
            {processing ? 'Menyimpan…' : children}
        </button>
    );
}

/* ============================== Profil Toko ============================== */

function ProfilTokoTab({ settings }: { settings: AppSettings }) {
    const { data, setData, post, processing, errors, progress } = useForm({
        store_name: settings.store_name ?? '',
        store_address: settings.store_address ?? '',
        store_phone: settings.store_phone ?? '',
        store_email: settings.store_email ?? '',
        store_instagram: settings.store_instagram ?? '',
        receipt_footer: settings.receipt_footer ?? '',
        logo: null as File | null,
    });

    const previewUrl = useMemo(
        () => (data.logo ? URL.createObjectURL(data.logo) : null),
        [data.logo],
    );

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const logoSrc = previewUrl ?? settings.store_logo;

    const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
        setData('logo', e.target.files?.[0] ?? null);
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('pengaturan.profil'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => setData('logo', null),
        });
    };

    return (
        <SectionCard
            title="Profil Toko"
            description="Identitas cafe yang tampil di login, header aplikasi, dan struk."
        >
            <form onSubmit={submit} className="space-y-5">
                {/* Logo */}
                <div>
                    <span className="block font-medium text-slate-900">
                        Logo
                    </span>
                    <div className="mt-2 flex items-center gap-4">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                            {logoSrc ? (
                                <img
                                    src={logoSrc}
                                    alt="Logo cafe"
                                    className="h-full w-full object-contain"
                                />
                            ) : (
                                <ImageIcon className="h-8 w-8 text-slate-300" />
                            )}
                        </div>
                        <div>
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
                                <UploadIcon className="h-4 w-4" />
                                {data.logo ? data.logo.name : 'Pilih Logo'}
                                <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp"
                                    className="hidden"
                                    onChange={handleLogoChange}
                                />
                            </label>
                            <p className="mt-1.5 text-sm text-slate-500">
                                Format jpg, jpeg, png, atau webp. Maksimal 2
                                MB.
                            </p>
                            {progress && (
                                <p className="mt-1 text-sm text-[#0A45FE]">
                                    Mengunggah… {progress.percentage}%
                                </p>
                            )}
                        </div>
                    </div>
                    <InputError message={errors.logo} className="mt-2" />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label
                            htmlFor="store_name"
                            className="block font-medium text-slate-900"
                        >
                            Nama Cafe <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="store_name"
                            type="text"
                            value={data.store_name}
                            placeholder="Pitou Cafe"
                            className={inputClass + ' mt-2'}
                            onChange={(e) =>
                                setData('store_name', e.target.value)
                            }
                        />
                        <InputError
                            message={errors.store_name}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="store_phone"
                            className="block font-medium text-slate-900"
                        >
                            Nomor Telepon
                        </label>
                        <input
                            id="store_phone"
                            type="text"
                            value={data.store_phone}
                            placeholder="08xxxxxxxxxx"
                            className={inputClass + ' mt-2'}
                            onChange={(e) =>
                                setData('store_phone', e.target.value)
                            }
                        />
                        <InputError
                            message={errors.store_phone}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="store_email"
                            className="block font-medium text-slate-900"
                        >
                            Email
                        </label>
                        <input
                            id="store_email"
                            type="email"
                            value={data.store_email}
                            placeholder="halo@pitoucafe.com"
                            className={inputClass + ' mt-2'}
                            onChange={(e) =>
                                setData('store_email', e.target.value)
                            }
                        />
                        <InputError
                            message={errors.store_email}
                            className="mt-2"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label
                            htmlFor="store_instagram"
                            className="block font-medium text-slate-900"
                        >
                            Instagram
                        </label>
                        <input
                            id="store_instagram"
                            type="text"
                            value={data.store_instagram}
                            placeholder="@pitoucafe"
                            className={inputClass + ' mt-2'}
                            onChange={(e) =>
                                setData('store_instagram', e.target.value)
                            }
                        />
                        <InputError
                            message={errors.store_instagram}
                            className="mt-2"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label
                            htmlFor="store_address"
                            className="block font-medium text-slate-900"
                        >
                            Alamat
                        </label>
                        <textarea
                            id="store_address"
                            value={data.store_address}
                            rows={2}
                            placeholder="Alamat cafe"
                            className={inputClass + ' mt-2'}
                            onChange={(e) =>
                                setData('store_address', e.target.value)
                            }
                        />
                        <InputError
                            message={errors.store_address}
                            className="mt-2"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label
                            htmlFor="receipt_footer"
                            className="block font-medium text-slate-900"
                        >
                            Footer Struk
                        </label>
                        <textarea
                            id="receipt_footer"
                            value={data.receipt_footer}
                            rows={2}
                            placeholder="Terima kasih, sampai jumpa lagi!"
                            className={inputClass + ' mt-2'}
                            onChange={(e) =>
                                setData('receipt_footer', e.target.value)
                            }
                        />
                        <InputError
                            message={errors.receipt_footer}
                            className="mt-2"
                        />
                    </div>
                </div>

                <div className="flex justify-end border-t border-slate-100 pt-5">
                    <SubmitButton processing={processing}>
                        Simpan Profil
                    </SubmitButton>
                </div>
            </form>
        </SectionCard>
    );
}

/* ============================== Pajak & Biaya ============================ */

function PajakTab({ settings }: { settings: AppSettings }) {
    const { data, setData, put, processing, errors } = useForm({
        tax_enabled: settings.tax_enabled,
        tax_name: settings.tax_name ?? 'Pajak',
        tax_percent: String(settings.tax_percent ?? 0),
        rounding_method: settings.rounding_method ?? 'none',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        put(route('pengaturan.pajak'), { preserveScroll: true });
    };

    return (
        <SectionCard
            title="Pajak & Biaya"
            description="Atur pajak dan biaya yang berlaku pada transaksi."
        >
            <form onSubmit={submit} className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="font-medium text-slate-900">
                            Aktifkan Pajak
                        </p>
                        <p className="text-sm text-slate-500">
                            Aktifkan pajak pada setiap transaksi
                        </p>
                    </div>
                    <Toggle
                        checked={data.tax_enabled}
                        onChange={(value) => setData('tax_enabled', value)}
                        label="Aktifkan Pajak"
                    />
                </div>
                <InputError message={errors.tax_enabled} />

                <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                        <label
                            htmlFor="tax_name"
                            className="block font-medium text-slate-900"
                        >
                            Nama Pajak
                        </label>
                        <input
                            id="tax_name"
                            type="text"
                            value={data.tax_name}
                            disabled={!data.tax_enabled}
                            placeholder="Contoh: PPN, Pajak Restoran"
                            className={inputClass + ' mt-2'}
                            onChange={(e) =>
                                setData('tax_name', e.target.value)
                            }
                        />
                        <InputError
                            message={errors.tax_name}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="tax_percent"
                            className="block font-medium text-slate-900"
                        >
                            Persentase Pajak (%)
                        </label>
                        <div className="relative mt-2">
                            <input
                                id="tax_percent"
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={data.tax_percent}
                                disabled={!data.tax_enabled}
                                className={inputClass + ' pr-10'}
                                onChange={(e) =>
                                    setData('tax_percent', e.target.value)
                                }
                            />
                            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                %
                            </span>
                        </div>
                        <InputError
                            message={errors.tax_percent}
                            className="mt-2"
                        />
                    </div>
                </div>

                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                        <p className="font-medium text-slate-900">
                            Pembulatan
                        </p>
                        <p className="text-sm text-slate-500">
                            Pembulatan total pembayaran
                        </p>
                    </div>
                    <select
                        aria-label="Metode pembulatan"
                        value={data.rounding_method}
                        className={inputClass + ' sm:w-72'}
                        onChange={(e) =>
                            setData(
                                'rounding_method',
                                e.target.value as RoundingMethod,
                            )
                        }
                    >
                        {roundingOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
                <InputError message={errors.rounding_method} />

                <div className="flex justify-end border-t border-slate-100 pt-5">
                    <SubmitButton processing={processing}>
                        Simpan Pajak
                    </SubmitButton>
                </div>
            </form>
        </SectionCard>
    );
}

/* =========================== Metode Pembayaran =========================== */

const methodMeta: Record<
    string,
    {
        description: string;
        icon: ComponentType<SVGAttributes<SVGElement>>;
        chipClass: string;
    }
> = {
    tunai: {
        description: 'Pembayaran menggunakan uang tunai',
        icon: BanknoteIcon,
        chipClass: 'bg-green-50 text-green-600',
    },
    qris: {
        description: 'Pembayaran via QRIS (Semua Bank)',
        icon: QrCodeIcon,
        chipClass: 'bg-purple-50 text-purple-600',
    },
    transfer: {
        description: 'Transfer melalui rekening bank',
        icon: LandmarkIcon,
        chipClass: 'bg-blue-50 text-blue-600',
    },
    kartu: {
        description: 'Pembayaran menggunakan kartu',
        icon: CreditCardIcon,
        chipClass: 'bg-amber-50 text-amber-600',
    },
};

function MetodePembayaranTab({
    paymentMethods,
}: {
    paymentMethods: PaymentMethod[];
}) {
    const { errors } = usePage().props;
    const [togglingId, setTogglingId] = useState<number | null>(null);

    const toggleMethod = (method: PaymentMethod) => {
        setTogglingId(method.id);

        router.put(
            route('pengaturan.metode-pembayaran', method.id),
            { is_active: !method.is_active },
            {
                preserveScroll: true,
                onFinish: () => setTogglingId(null),
            },
        );
    };

    return (
        <SectionCard
            title="Metode Pembayaran"
            description="Kelola metode pembayaran yang tersedia di POS."
        >
            {errors.is_active && (
                <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {errors.is_active}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left">
                    <thead>
                        <tr className="border-b border-slate-100 text-sm text-slate-500">
                            <th className="pb-3 pr-4 font-medium">Metode</th>
                            <th className="pb-3 pr-4 font-medium">
                                Deskripsi
                            </th>
                            <th className="pb-3 pr-4 font-medium">Status</th>
                            <th className="pb-3 text-right font-medium">
                                Aksi
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {paymentMethods.map((method) => {
                            const meta = methodMeta[method.code] ?? {
                                description: '—',
                                icon: CreditCardIcon,
                                chipClass: 'bg-slate-50 text-slate-600',
                            };
                            const MethodIcon = meta.icon;

                            return (
                                <tr
                                    key={method.id}
                                    className="border-b border-slate-50 last:border-0"
                                >
                                    <td className="py-3.5 pr-4">
                                        <div className="flex items-center gap-3">
                                            <span
                                                className={
                                                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' +
                                                    meta.chipClass
                                                }
                                            >
                                                <MethodIcon className="h-5 w-5" />
                                            </span>
                                            <span className="font-medium text-slate-900">
                                                {method.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 pr-4 text-slate-500">
                                        {meta.description}
                                    </td>
                                    <td className="py-3.5 pr-4">
                                        <span
                                            className={
                                                'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ' +
                                                (method.is_active
                                                    ? 'bg-green-50 text-green-700'
                                                    : 'bg-slate-100 text-slate-500')
                                            }
                                        >
                                            {method.is_active
                                                ? 'Aktif'
                                                : 'Nonaktif'}
                                        </span>
                                    </td>
                                    <td className="py-3.5 text-right">
                                        <Toggle
                                            checked={method.is_active}
                                            disabled={
                                                togglingId === method.id
                                            }
                                            onChange={() =>
                                                toggleMethod(method)
                                            }
                                            label={
                                                (method.is_active
                                                    ? 'Nonaktifkan '
                                                    : 'Aktifkan ') +
                                                method.name
                                            }
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <p className="mt-4 text-sm text-slate-400">
                Minimal satu metode pembayaran harus tetap aktif.
            </p>
        </SectionCard>
    );
}

/* ================================= WhatsApp ============================== */

function WhatsappTab({ settings }: { settings: AppSettings }) {
    const { data, setData, put, processing, errors } = useForm({
        whatsapp_enabled: settings.whatsapp_enabled,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        put(route('pengaturan.whatsapp'), { preserveScroll: true });
    };

    return (
        <SectionCard
            title="WhatsApp"
            description="Kirim struk digital ke pelanggan lewat WhatsApp (opsional)."
        >
            <form onSubmit={submit} className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="font-medium text-slate-900">
                            Aktifkan Kirim Struk WhatsApp
                        </p>
                        <p className="text-sm text-slate-500">
                            Saat aktif, tombol “Kirim via WhatsApp” muncul
                            setelah transaksi dan di Riwayat bila nomor
                            pelanggan terisi.
                        </p>
                    </div>
                    <Toggle
                        checked={data.whatsapp_enabled}
                        onChange={(value) =>
                            setData('whatsapp_enabled', value)
                        }
                        label="Aktifkan Kirim Struk WhatsApp"
                    />
                </div>
                <InputError message={errors.whatsapp_enabled} />

                <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Struk dikirim sebagai ringkasan teks melalui tautan
                    wa.me — tanpa biaya, tanpa WhatsApp Business API. Nomor
                    pelanggan otomatis dinormalisasi (08…&nbsp;→&nbsp;628…).
                </div>

                <div className="flex justify-end border-t border-slate-100 pt-5">
                    <SubmitButton processing={processing}>
                        Simpan WhatsApp
                    </SubmitButton>
                </div>
            </form>
        </SectionCard>
    );
}

/* ================================= Halaman =============================== */

export default function Index({
    settings,
    paymentMethods,
}: PageProps<{
    settings: AppSettings;
    paymentMethods: PaymentMethod[];
}>) {
    const { auth, store } = usePage<PageProps>().props;

    // Admin hanya melihat Pajak & Biaya + Metode Pembayaran (PRD 5.13)
    const visibleTabs = tabs.filter(
        (tab) => !tab.ownerOnly || auth.user.role === 'owner',
    );

    const [activeTab, setActiveTab] = useState<TabId>(visibleTabs[0].id);

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                        Pengaturan
                    </h1>
                    <p className="hidden text-sm text-slate-500 sm:block">
                        Kelola pengaturan sistem {store.name} POS.
                    </p>
                </div>
            }
        >
            <Head title="Pengaturan" />

            <div className="flex flex-col gap-5 pt-2 lg:flex-row lg:items-start">
                {/* Menu Pengaturan */}
                <aside className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:w-80">
                    <h2 className="px-2 pb-3 pt-1 text-lg font-bold text-slate-900">
                        Menu Pengaturan
                    </h2>
                    <div className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1.5">
                        {visibleTabs.map((tab) => {
                            const TabIcon = tab.icon;
                            const active = activeTab === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={
                                        'flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 lg:w-full ' +
                                        (active
                                            ? 'bg-[#eef4fd] text-slate-900'
                                            : 'text-slate-600 hover:bg-slate-50')
                                    }
                                >
                                    <span
                                        className={
                                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' +
                                            (active
                                                ? 'bg-white text-[#0A45FE] shadow-sm'
                                                : 'bg-slate-100 text-slate-500')
                                        }
                                    >
                                        <TabIcon className="h-5 w-5" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate font-semibold">
                                            {tab.label}
                                        </span>
                                        <span className="hidden truncate text-sm text-slate-500 sm:block">
                                            {tab.description}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                {/* Konten tab */}
                <div className="min-w-0 flex-1 space-y-5">
                    {activeTab === 'profil' &&
                        auth.user.role === 'owner' && (
                            <ProfilTokoTab settings={settings} />
                        )}
                    {activeTab === 'pajak' && (
                        <PajakTab settings={settings} />
                    )}
                    {activeTab === 'metode' && (
                        <MetodePembayaranTab
                            paymentMethods={paymentMethods}
                        />
                    )}
                    {activeTab === 'whatsapp' && (
                        <WhatsappTab settings={settings} />
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
