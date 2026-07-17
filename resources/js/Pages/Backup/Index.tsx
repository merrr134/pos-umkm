import { AlertTriangleIcon, PlusIcon, UploadIcon } from '@/Components/Icons';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import Pagination from '@/Components/Pagination';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps, Paginated } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { FormEventHandler, useEffect, useState } from 'react';

interface BackupRow {
    name: string;
    size: number;
    created_at: string; // ISO 8601
}

function formatSize(bytes: number): string {
    if (bytes >= 1024 * 1024) {
        return (bytes / (1024 * 1024)).toLocaleString('id-ID', {
            maximumFractionDigits: 1,
        }) + ' MB';
    }

    return Math.max(1, Math.round(bytes / 1024)).toLocaleString('id-ID') + ' KB';
}

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/* Konfirmasi hapus file backup */
function DeleteModal({
    backup,
    onClose,
}: {
    backup: BackupRow | null;
    onClose: () => void;
}) {
    const [processing, setProcessing] = useState(false);

    const confirmDelete = () => {
        if (!backup) return;

        router.delete(route('backup.destroy', backup.name), {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: onClose,
        });
    };

    return (
        <Modal show={backup !== null} onClose={onClose} maxWidth="sm">
            <div className="p-6">
                <h2 className="text-lg font-bold text-slate-900">
                    Hapus Backup
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                    Hapus file{' '}
                    <span className="font-semibold">{backup?.name}</span>?
                    File yang dihapus tidak bisa dikembalikan.
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

/**
 * Konfirmasi ganda restore (PRD 5.13.E): peringatan + wajib mengetik
 * PULIHKAN sebelum tombol aktif. Sumber bisa file server / upload.
 */
function RestoreModal({
    show,
    sourceName,
    processing,
    onConfirm,
    onClose,
}: {
    show: boolean;
    sourceName: string;
    processing: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) {
    const [confirmText, setConfirmText] = useState('');

    useEffect(() => {
        if (show) {
            setConfirmText('');
        }
    }, [show]);

    return (
        <Modal show={show} onClose={onClose} maxWidth="md">
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                        <AlertTriangleIcon className="h-6 w-6" />
                    </span>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Restore Database
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Seluruh data saat ini akan{' '}
                            <span className="font-semibold text-red-600">
                                ditimpa
                            </span>{' '}
                            dengan isi <span className="font-semibold">{sourceName}</span>.
                            Backup pengaman dibuat otomatis sebelum restore.
                        </p>
                    </div>
                </div>

                <label
                    htmlFor="restore-confirm"
                    className="mt-5 block text-sm font-medium text-slate-700"
                >
                    Ketik <span className="font-bold">PULIHKAN</span> untuk
                    melanjutkan:
                </label>
                <input
                    id="restore-confirm"
                    type="text"
                    value={confirmText}
                    className="mt-2 block w-full rounded-xl border-slate-200 px-4 py-2.5 text-slate-900 shadow-sm focus:border-red-500 focus:ring-red-500"
                    onChange={(e) => setConfirmText(e.target.value)}
                />

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
                        disabled={processing || confirmText !== 'PULIHKAN'}
                        onClick={onConfirm}
                        className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60"
                    >
                        {processing ? 'Memulihkan…' : 'Restore Sekarang'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export default function Index({
    backups,
}: PageProps<{ backups: Paginated<BackupRow> }>) {
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<BackupRow | null>(null);
    const [restoring, setRestoring] = useState<BackupRow | null>(null);
    const [restoreBusy, setRestoreBusy] = useState(false);

    const uploadForm = useForm<{ file: File | null; [key: string]: File | null }>({
        file: null,
    });
    const [showUploadConfirm, setShowUploadConfirm] = useState(false);

    const createBackup = () => {
        router.post(
            route('backup.store'),
            {},
            {
                preserveScroll: true,
                onStart: () => setCreating(true),
                onFinish: () => setCreating(false),
            },
        );
    };

    const confirmRestoreExisting = () => {
        if (!restoring) return;

        router.post(
            route('backup.restore-file', restoring.name),
            {},
            {
                preserveScroll: true,
                onStart: () => setRestoreBusy(true),
                onFinish: () => setRestoreBusy(false),
                onSuccess: () => setRestoring(null),
            },
        );
    };

    const submitUpload: FormEventHandler = (e) => {
        e.preventDefault();

        if (uploadForm.data.file !== null) {
            setShowUploadConfirm(true);
        }
    };

    const confirmRestoreUpload = () => {
        uploadForm.post(route('backup.restore'), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setShowUploadConfirm(false);
                uploadForm.setData('file', null);
            },
            onError: () => setShowUploadConfirm(false),
        });
    };

    const cellClass =
        'border-y border-slate-200 bg-white px-4 py-4 align-middle transition-colors duration-150 group-hover:bg-slate-50';

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                        Backup & Restore
                    </h1>
                    <p className="hidden text-sm text-slate-500 sm:block">
                        Cadangkan dan pulihkan seluruh data (Owner only).
                    </p>
                </div>
            }
        >
            <Head title="Backup & Restore" />

            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                <button
                    type="button"
                    disabled={creating}
                    onClick={createBackup}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A45FE] px-4 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-[#0838d1] disabled:opacity-60"
                >
                    <PlusIcon className="h-4 w-4" />
                    {creating ? 'Membuat backup…' : 'Backup Sekarang'}
                </button>
            </div>

            {/* Restore dari file upload */}
            <form
                onSubmit={submitUpload}
                className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
                <h2 className="font-bold text-slate-900">
                    Restore dari File (.sql)
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                    Unggah file backup Pitou Cafe POS. Data saat ini akan
                    ditimpa — backup pengaman dibuat otomatis.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label
                        htmlFor="restore-file"
                        className="flex min-w-56 flex-1 cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-slate-500 transition-colors hover:border-[#0A45FE] hover:text-[#0A45FE]"
                    >
                        <UploadIcon className="h-5 w-5 shrink-0" />
                        <span className="truncate font-medium">
                            {uploadForm.data.file?.name ??
                                'Pilih file backup (.sql)…'}
                        </span>
                        <input
                            id="restore-file"
                            type="file"
                            accept=".sql"
                            className="hidden"
                            onChange={(e) =>
                                uploadForm.setData(
                                    'file',
                                    e.target.files?.[0] ?? null,
                                )
                            }
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={uploadForm.data.file === null}
                        className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60"
                    >
                        Restore dari File
                    </button>
                </div>
                <InputError
                    message={uploadForm.errors.file}
                    className="mt-2"
                />
            </form>

            {/* Daftar backup */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto px-5 pt-1 sm:px-6">
                    <table className="w-full min-w-[720px] border-separate [border-spacing:0_10px] text-left">
                        <thead>
                            <tr className="text-sm text-slate-500">
                                <th className="px-4 pt-3 font-medium">
                                    Nama File
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Ukuran
                                </th>
                                <th className="px-4 pt-3 font-medium">
                                    Dibuat
                                </th>
                                <th className="px-4 pt-3 text-right font-medium">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {backups.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-500"
                                    >
                                        Belum ada backup. Klik “Backup
                                        Sekarang” untuk membuat cadangan
                                        pertama.
                                    </td>
                                </tr>
                            )}
                            {backups.data.map((row) => (
                                <tr key={row.name} className="group">
                                    <td
                                        className={
                                            cellClass +
                                            ' rounded-l-xl border-l font-semibold text-[#0A45FE]'
                                        }
                                    >
                                        {row.name}
                                    </td>
                                    <td className={cellClass + ' text-slate-700'}>
                                        {formatSize(row.size)}
                                    </td>
                                    <td className={cellClass + ' text-slate-700'}>
                                        {formatDateTime(row.created_at)}
                                    </td>
                                    <td
                                        className={
                                            cellClass +
                                            ' rounded-r-xl border-r text-right'
                                        }
                                    >
                                        <div className="flex justify-end gap-1">
                                            <a
                                                href={route(
                                                    'backup.download',
                                                    row.name,
                                                )}
                                                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[#0A45FE] transition-colors hover:bg-blue-50"
                                            >
                                                Download
                                            </a>
                                            <button
                                                type="button"
                                                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-amber-600 transition-colors hover:bg-amber-50"
                                                onClick={() =>
                                                    setRestoring(row)
                                                }
                                            >
                                                Restore
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50"
                                                onClick={() =>
                                                    setDeleting(row)
                                                }
                                            >
                                                Hapus
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-5 py-4 sm:px-6">
                    <Pagination paginator={backups} />
                </div>
            </div>

            <DeleteModal backup={deleting} onClose={() => setDeleting(null)} />
            <RestoreModal
                show={restoring !== null}
                sourceName={restoring?.name ?? ''}
                processing={restoreBusy}
                onConfirm={confirmRestoreExisting}
                onClose={() => setRestoring(null)}
            />
            <RestoreModal
                show={showUploadConfirm}
                sourceName={uploadForm.data.file?.name ?? ''}
                processing={uploadForm.processing}
                onConfirm={confirmRestoreUpload}
                onClose={() => setShowUploadConfirm(false)}
            />
        </AuthenticatedLayout>
    );
}
