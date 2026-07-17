import { UploadIcon, XIcon } from '@/Components/Icons';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { Role } from '@/types';
import { useForm } from '@inertiajs/react';
import { FormEventHandler, useEffect, useMemo, useState } from 'react';
import { ROLE_LABELS, UserRow } from './users';

const inputClass =
    'block w-full rounded-xl border-slate-200 py-2.5 px-4 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[#0A45FE] focus:ring-[#0A45FE]';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2 MB

interface UserFormData {
    name: string;
    username: string;
    password: string;
    password_confirmation: string;
    role: Role;
    is_active: boolean;
    photo: File | null;
    [key: string]: string | boolean | File | null;
}

// Validasi realtime sisi client — mengikuti aturan UserRequest
function validateUser(
    data: UserFormData,
    editing: boolean,
): Record<string, string> {
    const errors: Record<string, string> = {};

    if (data.name.trim() === '') {
        errors.name = 'Nama wajib diisi.';
    }
    if (data.username.trim() === '') {
        errors.username = 'Username wajib diisi.';
    } else if (!/^[\w-]+$/.test(data.username)) {
        errors.username =
            'Username hanya boleh huruf, angka, strip, dan garis bawah.';
    }
    if (!editing || data.password !== '') {
        if (data.password.length < 8) {
            errors.password = 'Password minimal 8 karakter.';
        } else if (data.password !== data.password_confirmation) {
            errors.password_confirmation = 'Konfirmasi password tidak cocok.';
        }
    }
    if (data.photo !== null) {
        if (!ACCEPTED_TYPES.includes(data.photo.type)) {
            errors.photo = 'Format foto harus jpg, jpeg, png, atau webp.';
        } else if (data.photo.size > MAX_PHOTO_SIZE) {
            errors.photo = 'Ukuran foto maksimal 2 MB.';
        }
    }

    return errors;
}

/**
 * Modal Tambah/Edit Pengguna (Fase 11) — Owner only. Saat edit,
 * password kosong berarti tidak diganti; foto baru menggantikan lama.
 */
export default function FormModal({
    show,
    user,
    onClose,
}: {
    show: boolean;
    user: UserRow | null;
    onClose: () => void;
}) {
    const form = useForm<UserFormData>({
        name: '',
        username: '',
        password: '',
        password_confirmation: '',
        role: 'kasir',
        is_active: true,
        photo: null,
    });
    const { data, setData, processing, errors, clearErrors, reset } = form;

    const [touched, setTouched] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (show) {
            setData({
                name: user?.name ?? '',
                username: user?.username ?? '',
                password: '',
                password_confirmation: '',
                role: user?.role ?? 'kasir',
                is_active: user?.is_active ?? true,
                photo: null,
            });
            setTouched({});
            clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show, user]);

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

    const clientErrors = useMemo(
        () => validateUser(data, user !== null),
        [data, user],
    );

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
            name: true,
            username: true,
            password: true,
            password_confirmation: true,
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

        if (user) {
            // Method spoofing: multipart harus dikirim via POST
            form.transform((data) => ({ ...data, _method: 'put' }));
            form.post(route('users.update', user.id), options);
        } else {
            form.transform((data) => data);
            form.post(route('users.store'), options);
        }
    };

    return (
        <Modal show={show} onClose={close} maxWidth="xl">
            <form onSubmit={submit} className="max-h-[90vh] overflow-y-auto p-6">
                <h2 className="text-lg font-bold text-slate-900">
                    {user ? 'Edit Pengguna' : 'Tambah Pengguna'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    {user
                        ? 'Kosongkan password jika tidak ingin menggantinya.'
                        : 'Password minimal 8 karakter.'}
                </p>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                        <label
                            htmlFor="user-name"
                            className="block font-medium text-slate-900"
                        >
                            Nama <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="user-name"
                            type="text"
                            value={data.name}
                            placeholder="Nama lengkap"
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
                            htmlFor="user-username"
                            className="block font-medium text-slate-900"
                        >
                            Username <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="user-username"
                            type="text"
                            value={data.username}
                            placeholder="untuk login"
                            className={inputClass + ' mt-2'}
                            onChange={(e) => {
                                setData('username', e.target.value);
                                markTouched('username');
                            }}
                        />
                        <InputError
                            message={fieldError('username')}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="user-password"
                            className="block font-medium text-slate-900"
                        >
                            Password{' '}
                            {!user && <span className="text-red-500">*</span>}
                        </label>
                        <input
                            id="user-password"
                            type="password"
                            value={data.password}
                            placeholder={
                                user ? 'Kosongkan jika tetap' : 'Minimal 8 karakter'
                            }
                            className={inputClass + ' mt-2'}
                            onChange={(e) => {
                                setData('password', e.target.value);
                                markTouched('password');
                            }}
                        />
                        <InputError
                            message={fieldError('password')}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="user-password-confirm"
                            className="block font-medium text-slate-900"
                        >
                            Konfirmasi Password{' '}
                            {!user && <span className="text-red-500">*</span>}
                        </label>
                        <input
                            id="user-password-confirm"
                            type="password"
                            value={data.password_confirmation}
                            placeholder="Ulangi password"
                            className={inputClass + ' mt-2'}
                            onChange={(e) => {
                                setData(
                                    'password_confirmation',
                                    e.target.value,
                                );
                                markTouched('password_confirmation');
                            }}
                        />
                        <InputError
                            message={fieldError('password_confirmation')}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="user-role"
                            className="block font-medium text-slate-900"
                        >
                            Role <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="user-role"
                            value={data.role}
                            className={inputClass + ' mt-2'}
                            onChange={(e) =>
                                setData('role', e.target.value as Role)
                            }
                        >
                            {(
                                Object.entries(ROLE_LABELS) as [Role, string][]
                            ).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <InputError
                            message={fieldError('role')}
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="user-status"
                            className="block font-medium text-slate-900"
                        >
                            Status <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="user-status"
                            value={data.is_active ? '1' : '0'}
                            className={inputClass + ' mt-2'}
                            onChange={(e) =>
                                setData('is_active', e.target.value === '1')
                            }
                        >
                            <option value="1">Aktif</option>
                            <option value="0">Nonaktif</option>
                        </select>
                        <InputError
                            message={fieldError('is_active')}
                            className="mt-2"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <span className="block font-medium text-slate-900">
                            Foto Profil
                        </span>
                        <p className="mt-0.5 text-sm text-slate-500">
                            jpg, jpeg, png, atau webp — maksimal 2 MB
                            (opsional).
                            {user?.photo_url &&
                                ' Foto baru akan menggantikan foto lama.'}
                        </p>

                        {photoPreview === null ? (
                            <div className="mt-2 flex items-center gap-3">
                                {user?.photo_url && (
                                    <img
                                        src={user.photo_url}
                                        alt={user.name}
                                        className="h-14 w-14 rounded-full object-cover"
                                    />
                                )}
                                <label
                                    htmlFor="user-photo"
                                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-4 text-slate-500 transition-colors hover:border-[#0A45FE] hover:text-[#0A45FE]"
                                >
                                    <UploadIcon className="h-5 w-5" />
                                    <span className="font-medium">
                                        Pilih foto…
                                    </span>
                                    <input
                                        id="user-photo"
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.webp"
                                        className="hidden"
                                        onChange={(e) => {
                                            setData(
                                                'photo',
                                                e.target.files?.[0] ?? null,
                                            );
                                            markTouched('photo');
                                        }}
                                    />
                                </label>
                            </div>
                        ) : (
                            <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                                <img
                                    src={photoPreview}
                                    alt="Preview foto"
                                    className="h-14 w-14 rounded-full object-cover"
                                />
                                <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                                    {data.photo?.name}
                                </p>
                                <button
                                    type="button"
                                    aria-label="Hapus foto terpilih"
                                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                    onClick={() => setData('photo', null)}
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        <InputError
                            message={fieldError('photo')}
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
                        {processing ? 'Menyimpan…' : 'Simpan Pengguna'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
