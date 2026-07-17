import { CheckCircleIcon } from '@/Components/Icons';
import Modal from '@/Components/Modal';
import { PageProps } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { UserRow } from './users';

/**
 * Modal Reset Password (Fase 11 — Owner only). Password baru acak
 * 10 karakter dari server, ditampilkan SEKALI di sini — setelah modal
 * ditutup password tidak bisa dilihat lagi.
 */
export default function ResetPasswordModal({
    user,
    onClose,
}: {
    user: UserRow | null;
    onClose: () => void;
}) {
    const { flash } = usePage<PageProps>().props;

    const [processing, setProcessing] = useState(false);
    const [copied, setCopied] = useState(false);

    const newPassword = flash.new_password;

    useEffect(() => {
        if (user !== null) {
            setCopied(false);
        }
    }, [user]);

    const confirmReset = () => {
        if (!user) return;

        router.post(
            route('users.reset-password', user.id),
            {},
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const copyPassword = async () => {
        if (!newPassword) return;

        await navigator.clipboard.writeText(newPassword);
        setCopied(true);
    };

    return (
        <Modal show={user !== null} onClose={onClose} maxWidth="sm">
            <div className="p-6">
                {newPassword ? (
                    <>
                        <div className="flex items-start gap-3">
                            <CheckCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Password Berhasil Direset
                                </h2>
                                <p className="mt-1 text-sm text-slate-600">
                                    Password baru untuk{' '}
                                    <span className="font-semibold">
                                        {user?.name}
                                    </span>
                                    . Salin sekarang — password ini hanya
                                    ditampilkan sekali.
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                            <code className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg font-bold tracking-wider text-slate-900">
                                {newPassword}
                            </code>
                            <button
                                type="button"
                                onClick={copyPassword}
                                className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                {copied ? 'Tersalin ✓' : 'Salin'}
                            </button>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl bg-[#0A45FE] px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1]"
                            >
                                Selesai
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <h2 className="text-lg font-bold text-slate-900">
                            Reset Password
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Reset password{' '}
                            <span className="font-semibold">{user?.name}</span>{' '}
                            (@{user?.username})? Password baru acak 10 karakter
                            akan dibuat dan ditampilkan sekali.
                        </p>
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
                                onClick={confirmReset}
                                className="rounded-xl bg-[#0A45FE] px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1] disabled:opacity-60"
                            >
                                {processing ? 'Mereset…' : 'Reset Password'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}
