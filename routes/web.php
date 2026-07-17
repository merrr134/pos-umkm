<?php

use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ExpenseCategoryController;
use App\Http\Controllers\KasirController;
use App\Http\Controllers\LaporanController;
use App\Http\Controllers\PembelianController;
use App\Http\Controllers\PengeluaranController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RiwayatController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\StokController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\Settings\PaymentMethodController;
use App\Http\Controllers\Settings\SettingController;
use App\Http\Controllers\TransactionController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Splash screen — landing awal aplikasi, lalu diarahkan ke Kasir/Login
Route::get('/', function () {
    return Inertia::render('Splash');
})->name('splash');

// Kasir (POS) — landing page setelah login (PRD 4.1: Owner, Admin, Kasir)
Route::middleware(['auth', 'role:owner,admin,kasir'])->group(function () {
    Route::get('/kasir', [KasirController::class, 'index'])->name('kasir');
    Route::post('/kasir/hitung', [KasirController::class, 'calculate'])->name('kasir.hitung');
    // Fase 15 — snapshot data Kasir untuk cache offline (IndexedDB)
    Route::get('/kasir/offline-data', [KasirController::class, 'offlineData'])->name('kasir.offline-data');
    // Fase 5 — simpan transaksi (pembayaran) + data struk
    Route::post('/kasir/bayar', [TransactionController::class, 'store'])->name('kasir.bayar');

    // Fase 6 — Riwayat Transaksi (PRD 5.11); kasir hanya melihat
    // transaksinya sendiri (dijaga query + TransactionPolicy)
    Route::get('/riwayat', [RiwayatController::class, 'index'])->name('riwayat');
    Route::get('/riwayat/{transaction}', [RiwayatController::class, 'show'])->name('riwayat.show');

    // Fase 7 — Manajemen Stok (PRD 5.8): kasir hanya melihat (view only)
    Route::get('/stok', [StokController::class, 'index'])->name('stok');
    Route::get('/stok/riwayat', [StokController::class, 'movements'])->name('stok.riwayat');
});

// Penyesuaian stok & restock — Owner dan Admin, Kasir tidak boleh (Fase 7)
Route::middleware(['auth', 'role:owner,admin'])->group(function () {
    Route::post('/stok/{product}/penyesuaian', [StokController::class, 'adjust'])->name('stok.penyesuaian');
    Route::post('/stok/{product}/restock', [StokController::class, 'restock'])->name('stok.restock');
});

// Fase 8 — Supplier (PRD 5.9, sub-tab Produk): kasir view only
Route::middleware(['auth', 'role:owner,admin,kasir'])->group(function () {
    Route::get('/supplier', [SupplierController::class, 'index'])->name('supplier');

    // Fase 9 — Pembelian: kasir view only; append-only (tanpa edit/hapus)
    Route::get('/pembelian', [PembelianController::class, 'index'])->name('pembelian');
    Route::get('/pembelian/{purchase}', [PembelianController::class, 'show'])->name('pembelian.show');
});

// Tambah & edit supplier — Owner dan Admin (SupplierPolicy)
Route::middleware(['auth', 'role:owner,admin'])->group(function () {
    Route::post('/supplier', [SupplierController::class, 'store'])->name('supplier.store');
    Route::put('/supplier/{supplier}', [SupplierController::class, 'update'])->name('supplier.update');

    // Simpan pembelian — Owner dan Admin (Fase 9)
    Route::post('/pembelian', [PembelianController::class, 'store'])->name('pembelian.store');
});

// Soft delete & restore supplier — hanya Owner (SupplierPolicy)
Route::middleware(['auth', 'role:owner'])->group(function () {
    Route::delete('/supplier/{supplier}', [SupplierController::class, 'destroy'])->name('supplier.destroy');
    Route::post('/supplier/{supplier}/restore', [SupplierController::class, 'restore'])
        ->withTrashed()
        ->name('supplier.restore');
});

// Fase 9 — Pengeluaran (PRD 5.10): kasir view only
Route::middleware(['auth', 'role:owner,admin,kasir'])->group(function () {
    Route::get('/pengeluaran', [PengeluaranController::class, 'index'])->name('pengeluaran');
});

// Tambah & edit pengeluaran + kelola kategori — Owner dan Admin (ExpensePolicy)
Route::middleware(['auth', 'role:owner,admin'])->group(function () {
    Route::post('/pengeluaran', [PengeluaranController::class, 'store'])->name('pengeluaran.store');
    Route::put('/pengeluaran/{expense}', [PengeluaranController::class, 'update'])->name('pengeluaran.update');

    // Kategori pengeluaran dinamis (PRD 5.10)
    Route::post('/pengeluaran/kategori', [ExpenseCategoryController::class, 'store'])->name('pengeluaran.kategori.store');
    Route::put('/pengeluaran/kategori/{expenseCategory}', [ExpenseCategoryController::class, 'update'])->name('pengeluaran.kategori.update');
    Route::delete('/pengeluaran/kategori/{expenseCategory}', [ExpenseCategoryController::class, 'destroy'])->name('pengeluaran.kategori.destroy');
});

// Soft delete & restore pengeluaran — hanya Owner (ExpensePolicy)
Route::middleware(['auth', 'role:owner'])->group(function () {
    Route::delete('/pengeluaran/{expense}', [PengeluaranController::class, 'destroy'])->name('pengeluaran.destroy');
    Route::post('/pengeluaran/{expense}/restore', [PengeluaranController::class, 'restore'])
        ->withTrashed()
        ->name('pengeluaran.restore');
});

// Fase 10 — Laporan (PRD 5.12): kasir hanya laporan penjualan
// miliknya sendiri (dashboard dialihkan; scope di controller)
Route::middleware(['auth', 'role:owner,admin,kasir'])->group(function () {
    Route::get('/laporan', [LaporanController::class, 'index'])->name('laporan');
    Route::get('/laporan/penjualan', [LaporanController::class, 'penjualan'])->name('laporan.penjualan');
    Route::get('/laporan/penjualan/export/{format}', [LaporanController::class, 'penjualanExport'])
        ->whereIn('format', ['pdf', 'excel'])
        ->name('laporan.penjualan.export');
});

// Laporan pembelian, pengeluaran, stok (memuat laba/biaya) — Owner & Admin
Route::middleware(['auth', 'role:owner,admin'])->group(function () {
    Route::get('/laporan/pembelian', [LaporanController::class, 'pembelian'])->name('laporan.pembelian');
    Route::get('/laporan/pembelian/export/{format}', [LaporanController::class, 'pembelianExport'])
        ->whereIn('format', ['pdf', 'excel'])
        ->name('laporan.pembelian.export');

    Route::get('/laporan/pengeluaran', [LaporanController::class, 'pengeluaran'])->name('laporan.pengeluaran');
    Route::get('/laporan/pengeluaran/export/{format}', [LaporanController::class, 'pengeluaranExport'])
        ->whereIn('format', ['pdf', 'excel'])
        ->name('laporan.pengeluaran.export');

    Route::get('/laporan/stok', [LaporanController::class, 'stok'])->name('laporan.stok');
    Route::get('/laporan/stok/export/{format}', [LaporanController::class, 'stokExport'])
        ->whereIn('format', ['pdf', 'excel'])
        ->name('laporan.stok.export');
});

// Pembatalan transaksi — hanya Owner (PRD 5.4)
Route::middleware(['auth', 'role:owner'])->group(function () {
    Route::post('/riwayat/{transaction}/batal', [RiwayatController::class, 'cancel'])->name('riwayat.batal');
});

// Produk & Kategori (PRD 4.1) — Owner & Admin
Route::middleware(['auth', 'role:owner,admin'])->group(function () {
    Route::get('/produk', [ProductController::class, 'index'])->name('produk');
    Route::post('/produk', [ProductController::class, 'store'])->name('produk.store');
    Route::put('/produk/{product}', [ProductController::class, 'update'])->name('produk.update');
    Route::delete('/produk/{product}', [ProductController::class, 'destroy'])->name('produk.destroy');

    Route::get('/kategori', [CategoryController::class, 'index'])->name('kategori');
    Route::post('/kategori', [CategoryController::class, 'store'])->name('kategori.store');
    Route::put('/kategori/{category}', [CategoryController::class, 'update'])->name('kategori.update');
    Route::delete('/kategori/{category}', [CategoryController::class, 'destroy'])->name('kategori.destroy');
});

// Fase 11 — Manajemen Pengguna (PRD 5.13.D): Owner full, Admin view only
Route::middleware(['auth', 'role:owner,admin'])->group(function () {
    Route::get('/users', [UserController::class, 'index'])->name('users');
});

Route::middleware(['auth', 'role:owner'])->group(function () {
    Route::post('/users', [UserController::class, 'store'])->name('users.store');
    Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
    Route::post('/users/{user}/toggle-status', [UserController::class, 'toggleStatus'])->name('users.toggle-status');
    Route::post('/users/{user}/reset-password', [UserController::class, 'resetPassword'])->name('users.reset-password');
});

// Fase 11 — Backup & Restore + Activity Log (PRD 5.13.E/F): Owner only
Route::middleware(['auth', 'role:owner'])->group(function () {
    Route::get('/backup', [BackupController::class, 'index'])->name('backup');
    Route::post('/backup', [BackupController::class, 'store'])->name('backup.store');
    Route::post('/backup/restore', [BackupController::class, 'restoreUpload'])->name('backup.restore');
    Route::get('/backup/{file}/download', [BackupController::class, 'download'])->name('backup.download');
    Route::post('/backup/{file}/restore', [BackupController::class, 'restoreExisting'])->name('backup.restore-file');
    Route::delete('/backup/{file}', [BackupController::class, 'destroy'])->name('backup.destroy');

    Route::get('/activity-log', [ActivityLogController::class, 'index'])->name('activity-log');
});

// Fase 11 — Profil Saya: semua role; role/status tidak bisa diubah
Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile');
    Route::put('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::put('/profile/password', [ProfileController::class, 'updatePassword'])->name('profile.password');
});

// Pengaturan (PRD 5.13) — Owner penuh; Admin terbatas (Pajak & Biaya, Metode Pembayaran)
Route::middleware(['auth', 'role:owner,admin'])->prefix('pengaturan')->group(function () {
    Route::get('/', [SettingController::class, 'index'])->name('pengaturan');

    // Profil Toko hanya untuk Owner (PRD 5.13.A).
    // POST karena upload logo (multipart/form-data).
    Route::post('/profil', [SettingController::class, 'updateStoreProfile'])
        ->middleware('role:owner')
        ->name('pengaturan.profil');

    Route::put('/pajak', [SettingController::class, 'updateTax'])
        ->name('pengaturan.pajak');

    // Fase 16 — pengaturan WhatsApp (Owner & Admin)
    Route::put('/whatsapp', [SettingController::class, 'updateWhatsapp'])
        ->name('pengaturan.whatsapp');

    Route::put('/metode-pembayaran/{paymentMethod}', [PaymentMethodController::class, 'update'])
        ->name('pengaturan.metode-pembayaran');
});

require __DIR__.'/auth.php';
