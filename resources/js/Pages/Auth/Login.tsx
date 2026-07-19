import InputError from '@/Components/InputError';
import PitouLogo from '@/Components/PitouLogo';
import { PageProps } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';

function UserIcon({ className = '' }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    );
}

function LockIcon({ className = '' }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );
}

function EyeIcon({ className = '' }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function EyeOffIcon({ className = '' }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" x2="22" y1="2" y2="22" />
        </svg>
    );
}

function LoginIcon({ className = '' }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" x2="3" y1="12" y2="12" />
        </svg>
    );
}

export default function Login({ status }: { status?: string }) {
    const { store } = usePage<PageProps>().props;

    const sessionExpired = new URLSearchParams(window.location.search).has(
        'expired',
    );

    const [showPassword, setShowPassword] = useState(false);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    const { data, setData, post, processing, errors, reset } = useForm({
        username: '',
        password: '',
        remember: false as boolean,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <div className="flex min-h-screen bg-[#f5f6fa] p-3 sm:p-5">
            <Head title="Masuk" />

            <div className="flex w-full overflow-hidden rounded-3xl">
                {/* Panel kiri — ilustrasi & headline (desktop) */}
                <div className="relative hidden overflow-hidden rounded-3xl bg-gradient-to-b from-white to-[#eef4fd] motion-safe:animate-[login-fade_300ms_ease-out] lg:flex lg:w-[54%] lg:flex-col">
                    {/* Lingkaran dekoratif */}
                    <div className="absolute -right-10 top-24 h-64 w-64 rounded-full bg-[#e1ebfc]" />
                    <div className="absolute right-64 top-16 h-12 w-12 rounded-full bg-[#e1ebfc]" />

                    <div className="relative z-10 flex items-center gap-3 px-10 pt-10">
                        {store.logo ? (
                            <img
                                src={store.logo}
                                alt={store.name}
                                className="h-10 w-10 shrink-0 object-contain"
                            />
                        ) : (
                            <PitouLogo className="h-10 w-10" />
                        )}
                        <span className="text-xl font-bold uppercase tracking-wide text-slate-900">
                            {store.name}
                        </span>
                    </div>

                    <div className="relative z-10 mt-14 px-10 xl:px-16">
                        <h2 className="text-4xl font-extrabold leading-tight text-slate-900 xl:text-5xl">
                            Kelola Cafe Anda
                            <br />
                            Lebih Mudah
                        </h2>
                        <p className="mt-5 max-w-md text-lg text-slate-600">
                            Sistem kasir modern untuk membantu transaksi lebih
                            cepat dan laporan lebih akurat.
                        </p>
                    </div>

                    <img
                        src="/images/login-illustration.png"
                        alt=""
                        className="relative z-10 mt-auto w-full select-none object-contain"
                        draggable={false}
                    />
                </div>

                {/* Panel kanan — form login */}
                <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
                    <div className="w-full max-w-md motion-safe:animate-[login-fade-scale_300ms_ease-out]">
                        {/* Identitas toko (mobile) */}
                        <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
                            {store.logo ? (
                                <img
                                    src={store.logo}
                                    alt={store.name}
                                    className="h-9 w-9 shrink-0 object-contain"
                                />
                            ) : (
                                <PitouLogo className="h-9 w-9" />
                            )}
                            <span className="text-lg font-bold uppercase tracking-wide text-slate-900">
                                {store.name}
                            </span>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
                            <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
                                Selamat Datang Kembali! 👋
                            </h1>
                            <p className="mt-2 text-slate-500">
                                Masuk untuk melanjutkan ke {store.name} POS.
                            </p>

                            {status && (
                                <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
                                    {status}
                                </div>
                            )}

                            {sessionExpired && (
                                <div className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm font-medium text-yellow-800">
                                    Sesi berakhir, silakan login kembali.
                                </div>
                            )}

                            {infoMessage && (
                                <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-800">
                                    {infoMessage}
                                </div>
                            )}

                            <form onSubmit={submit} className="mt-7">
                                <div>
                                    <label
                                        htmlFor="username"
                                        className="block font-medium text-slate-900"
                                    >
                                        Username
                                    </label>

                                    <div className="relative mt-2">
                                        <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                        <input
                                            id="username"
                                            type="text"
                                            name="username"
                                            value={data.username}
                                            autoComplete="username"
                                            autoFocus
                                            placeholder="Masukkan username Anda"
                                            className="block w-full rounded-xl border-slate-200 py-3 pl-11 pr-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]"
                                            onChange={(e) =>
                                                setData(
                                                    'username',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </div>

                                    <InputError
                                        message={errors.username}
                                        className="mt-2"
                                    />
                                </div>

                                <div className="mt-5">
                                    <label
                                        htmlFor="password"
                                        className="block font-medium text-slate-900"
                                    >
                                        Password
                                    </label>

                                    <div className="relative mt-2">
                                        <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                        <input
                                            id="password"
                                            type={
                                                showPassword
                                                    ? 'text'
                                                    : 'password'
                                            }
                                            name="password"
                                            value={data.password}
                                            autoComplete="current-password"
                                            placeholder="Masukkan password Anda"
                                            className="block w-full rounded-xl border-slate-200 py-3 pl-11 pr-12 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]"
                                            onChange={(e) =>
                                                setData(
                                                    'password',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <button
                                            type="button"
                                            tabIndex={-1}
                                            aria-label={
                                                showPassword
                                                    ? 'Sembunyikan password'
                                                    : 'Tampilkan password'
                                            }
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                                            onClick={() =>
                                                setShowPassword(
                                                    (previous) => !previous,
                                                )
                                            }
                                        >
                                            {showPassword ? (
                                                <EyeOffIcon className="h-5 w-5" />
                                            ) : (
                                                <EyeIcon className="h-5 w-5" />
                                            )}
                                        </button>
                                    </div>

                                    <InputError
                                        message={errors.password}
                                        className="mt-2"
                                    />
                                </div>

                                <div className="mt-5 flex items-center justify-between">
                                    <label className="flex items-center gap-2.5">
                                        <input
                                            type="checkbox"
                                            name="remember"
                                            checked={data.remember}
                                            className="h-5 w-5 rounded border-slate-300 text-[#0A45FE] shadow-sm focus:ring-[#0A45FE]"
                                            onChange={(e) =>
                                                setData(
                                                    'remember',
                                                    (e.target.checked ||
                                                        false) as false,
                                                )
                                            }
                                        />
                                        <span className="font-medium text-slate-900">
                                            Ingat saya
                                        </span>
                                    </label>

                                    <button
                                        type="button"
                                        className="font-medium text-[#0A45FE] hover:underline"
                                        onClick={() =>
                                            setInfoMessage(
                                                'Hubungi Owner untuk mereset password Anda.',
                                            )
                                        }
                                    >
                                        Lupa Password?
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#0A45FE] py-3.5 text-lg font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[#0838d1] disabled:opacity-60"
                                >
                                    <LoginIcon className="h-5 w-5" />
                                    Masuk
                                </button>
                            </form>

                            <div className="mt-7 flex items-center gap-4">
                                <div className="h-px flex-1 bg-slate-200" />
                                <span className="text-sm text-slate-400">
                                    atau masuk dengan
                                </span>
                                <div className="h-px flex-1 bg-slate-200" />
                            </div>

                            <button
                                type="button"
                                className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 py-3 font-medium text-slate-800 transition-colors duration-150 hover:bg-slate-50"
                                onClick={() =>
                                    setInfoMessage(
                                        'Akun demo belum tersedia. Silakan login dengan akun Anda.',
                                    )
                                }
                            >
                                <UserIcon className="h-5 w-5" />
                                Akun Demo
                            </button>

                            <p className="mt-8 text-center text-sm text-slate-400">
                                {store.name} POS v1.0.0
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
