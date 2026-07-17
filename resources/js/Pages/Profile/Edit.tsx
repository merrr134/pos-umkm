import { UploadIcon, UserCircleIcon, XIcon } from '@/Components/Icons';
import InputError from '@/Components/InputError';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, Role } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler, useEffect, useMemo } from 'react';
import { ROLE_LABELS } from '@/Pages/Users/users';

const inputClass =
    'block w-full rounded-xl border-slate-200 py-2.5 px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

interface Profile {
    name: string;
    username: string;
    role: Role;
    photo_url: string | null;
}

/** Form nama, username, foto — role tidak bisa diubah (Fase 11). */
function ProfileInfoForm({ profile }: { profile: Profile }) {
    const form = useForm<{
        name: string;
        username: string;
        photo: File | null;
        [key: string]: string | File | null;
    }>({
        name: profile.name,
        username: profile.username,
        photo: null,
    });
    const { data, setData, processing, errors } = form;

    const photoPreview = useMemo(
        () =>
            data.photo !== null && data.photo.type.startsWith('image/')
                ? URL.createObjectURL(data.photo)
                : null,
        [data.photo],
    );

    useEffect(
        () => () => {
            if (photoPreview) {
                URL.revokeObjectURL(photoPreview);
            }
        },
        [photoPreview],
    );

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        // Method spoofing: multipart harus dikirim via POST
        form.transform((data) => ({ ...data, _method: 'put' }));
        form.post(route('profile.update'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => setData('photo', null),
        });
    };

    return (
        <form
            onSubmit={submit}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
            <h2 className="text-lg font-bold text-slate-900">
                Informasi Profil
            </h2>
            <p className="mt-1 text-sm text-slate-500">
                Perbarui nama, username, dan foto profil Anda. Role tidak
                dapat diubah.
            </p>

            <div className="mt-5 flex items-center gap-4">
                {photoPreview ? (
                    <img
                        src={photoPreview}
                        alt="Preview foto"
                        className="h-16 w-16 rounded-full object-cover"
                    />
                ) : profile.photo_url ? (
                    <img
                        src={profile.photo_url}
                        alt={profile.name}
                        className="h-16 w-16 rounded-full object-cover"
                    />
                ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0A45FE] text-white">
                        <UserCircleIcon className="h-9 w-9" />
                    </span>
                )}
                <div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {ROLE_LABELS[profile.role]}
                    </span>
                    <p className="mt-1 text-xs text-slate-400">
                        Foto jpg/jpeg/png/webp, maksimal 2 MB.
                    </p>
                </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                    <label
                        htmlFor="profile-name"
                        className="block font-medium text-slate-900"
                    >
                        Nama
                    </label>
                    <input
                        id="profile-name"
                        type="text"
                        value={data.name}
                        className={inputClass + ' mt-2'}
                        onChange={(e) => setData('name', e.target.value)}
                    />
                    <InputError message={errors.name} className="mt-2" />
                </div>

                <div>
                    <label
                        htmlFor="profile-username"
                        className="block font-medium text-slate-900"
                    >
                        Username
                    </label>
                    <input
                        id="profile-username"
                        type="text"
                        value={data.username}
                        className={inputClass + ' mt-2'}
                        onChange={(e) => setData('username', e.target.value)}
                    />
                    <InputError message={errors.username} className="mt-2" />
                </div>

                <div className="sm:col-span-2">
                    {data.photo === null ? (
                        <label
                            htmlFor="profile-photo"
                            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-4 text-slate-500 transition-colors hover:border-[#0A45FE] hover:text-[#0A45FE]"
                        >
                            <UploadIcon className="h-5 w-5" />
                            <span className="font-medium">
                                Ganti foto profil…
                            </span>
                            <input
                                id="profile-photo"
                                type="file"
                                accept=".jpg,.jpeg,.png,.webp"
                                className="hidden"
                                onChange={(e) =>
                                    setData(
                                        'photo',
                                        e.target.files?.[0] ?? null,
                                    )
                                }
                            />
                        </label>
                    ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                            <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                                {data.photo.name}
                            </p>
                            <button
                                type="button"
                                aria-label="Batalkan ganti foto"
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                onClick={() => setData('photo', null)}
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                    <InputError message={errors.photo} className="mt-2" />
                </div>
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    type="submit"
                    disabled={processing}
                    className="rounded-xl bg-[#0A45FE] px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1] disabled:opacity-60"
                >
                    {processing ? 'Menyimpan…' : 'Simpan Profil'}
                </button>
            </div>
        </form>
    );
}

/** Form ubah password — wajib password saat ini. */
function PasswordForm() {
    const { data, setData, put, processing, errors, reset } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        put(route('profile.password'), {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    return (
        <form
            onSubmit={submit}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
            <h2 className="text-lg font-bold text-slate-900">Ubah Password</h2>
            <p className="mt-1 text-sm text-slate-500">
                Password baru minimal 8 karakter.
            </p>

            <div className="mt-5 grid gap-5">
                <div>
                    <label
                        htmlFor="current-password"
                        className="block font-medium text-slate-900"
                    >
                        Password Saat Ini
                    </label>
                    <input
                        id="current-password"
                        type="password"
                        value={data.current_password}
                        className={inputClass + ' mt-2'}
                        onChange={(e) =>
                            setData('current_password', e.target.value)
                        }
                    />
                    <InputError
                        message={errors.current_password}
                        className="mt-2"
                    />
                </div>

                <div>
                    <label
                        htmlFor="new-password"
                        className="block font-medium text-slate-900"
                    >
                        Password Baru
                    </label>
                    <input
                        id="new-password"
                        type="password"
                        value={data.password}
                        className={inputClass + ' mt-2'}
                        onChange={(e) => setData('password', e.target.value)}
                    />
                    <InputError message={errors.password} className="mt-2" />
                </div>

                <div>
                    <label
                        htmlFor="confirm-password"
                        className="block font-medium text-slate-900"
                    >
                        Konfirmasi Password Baru
                    </label>
                    <input
                        id="confirm-password"
                        type="password"
                        value={data.password_confirmation}
                        className={inputClass + ' mt-2'}
                        onChange={(e) =>
                            setData('password_confirmation', e.target.value)
                        }
                    />
                    <InputError
                        message={errors.password_confirmation}
                        className="mt-2"
                    />
                </div>
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    type="submit"
                    disabled={processing}
                    className="rounded-xl bg-[#0A45FE] px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1] disabled:opacity-60"
                >
                    {processing ? 'Menyimpan…' : 'Ubah Password'}
                </button>
            </div>
        </form>
    );
}

export default function Edit({ profile }: PageProps<{ profile: Profile }>) {
    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                        Profil Saya
                    </h1>
                    <p className="hidden text-sm text-slate-500 sm:block">
                        Kelola informasi akun Anda.
                    </p>
                </div>
            }
        >
            <Head title="Profil Saya" />

            <div className="mx-auto mt-2 grid max-w-4xl gap-5 lg:grid-cols-2">
                <ProfileInfoForm profile={profile} />
                <PasswordForm />
            </div>
        </AuthenticatedLayout>
    );
}
