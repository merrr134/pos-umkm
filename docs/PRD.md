# Product Requirements Document (PRD)
## Pitou Cafe POS — v1.0 Final

| | |
|---|---|
| **Nama Aplikasi** | Pitou Cafe POS |
| **Versi** | 1.0 **Final** (production-ready, siap lanjut ke SRS & Database Design) |
| **Status** | Final |
| **Platform** | Web Responsive + PWA + Android/iOS |
| **Tanggal** | 15 Juli 2026 |

---

## 1. Latar Belakang

Banyak UMKM cafe masih mencatat pesanan dan transaksi secara manual. Cara ini rawan salah hitung, sulit direkap, stok tidak terkontrol, dan tidak menyimpan riwayat yang bisa dianalisis.

Pitou Cafe POS adalah sistem kasir lengkap yang mencakup transaksi, manajemen stok, supplier, pengeluaran operasional, multi-user, sampai laporan — ringan, sederhana, dan bisa dipakai di laptop, tablet, maupun HP.

**Prinsip desain:** cepat di layar kasir, lengkap di belakang layar. Setelah login, user **langsung masuk ke halaman Kasir (POS)** — tidak ada halaman perantara.

---

## 2. Tujuan

| # | Tujuan | Metrik Keberhasilan |
|---|---|---|
| 1 | Mempermudah proses transaksi | Rata-rata 1 transaksi < 30 detik |
| 2 | Mengurangi kesalahan perhitungan | Kembalian & pajak otomatis, 0 human error |
| 3 | Mengontrol stok produk | Stok berkurang otomatis tiap transaksi |
| 4 | Menyimpan riwayat transaksi | 100% transaksi tersimpan & immutable |
| 5 | Mencatat pengeluaran operasional | Semua biaya di luar pembelian stok tercatat |
| 6 | Menampilkan laporan penjualan | Laporan harian/bulanan + export PDF & Excel |
| 7 | Tetap jalan saat internet mati | Mode offline + sinkronisasi otomatis |
| 8 | Bisa dipakai lintas perangkat | Web, PWA, Android, iOS |

---

## 3. Target Pengguna & Role

| Role | Deskripsi | Hak Akses |
|---|---|---|
| **Owner** | Pemilik cafe | Semua akses + laporan finansial penuh + manajemen user + pengaturan + backup + activity log |
| **Admin** | Manajer / supervisor | Master data (produk, kategori, stok, supplier), pengeluaran, laporan. Tidak bisa mengelola user, backup, atau melihat activity log |
| **Kasir** | Operasional harian | Kasir (POS), pembayaran, cetak struk, riwayat transaksi miliknya sendiri |

**Requirement:**
- Role-based access control (RBAC) via middleware
- Owner dapat menambah / edit / **menonaktifkan** user
- Guard: user tidak bisa menonaktifkan akun sendiri; Owner terakhir tidak bisa dinonaktifkan/dihapus

---

## 4. Navigasi & Struktur Aplikasi

### 4.1 Sidebar (Final)

| Menu | Route | Akses |
|---|---|---|
| **Kasir (POS)** | `/kasir` | Owner, Admin, Kasir |
| **Produk** | `/produk` | Owner, Admin |
| **Kategori** | `/kategori` | Owner, Admin |
| **Pengeluaran** | `/pengeluaran` | Owner, Admin |
| **Riwayat Transaksi** | `/riwayat` | Owner, Admin, Kasir |
| **Laporan** | `/laporan` | Owner, Admin |
| **Pengaturan** | `/pengaturan` | Owner (Admin terbatas) |
| **Logout** | — | Semua |

> ⛔ **Tidak ada modul Dashboard.** Landing page setelah login adalah **Kasir (POS)**.
>
> 📌 **Pengeluaran adalah menu utama sidebar** (bukan submenu). Modul **Supplier & Pembelian** dan **Manajemen Stok** tetap diakses sebagai sub-tab di dalam **Produk** (menjaga sidebar tetap 8 item sesuai desain final).

### 4.2 Terminologi UI

Seluruh istilah UI menggunakan **Bahasa Indonesia**.

| Sebelumnya | Menjadi |
|---|---|
| Current Order | **Keranjang** |
| Process Payment | **Bayar** |
| Save Order | ⛔ dihapus |
| Split Bill | ⛔ dihapus |
| Dashboard | ⛔ dihapus |

---

## 5. Fitur Utama

### 5.1 Autentikasi

- Login menggunakan **username** dan **password**
- Setelah login berhasil → **redirect langsung ke halaman Kasir (POS)**
- Halaman login menampilkan **logo, nama cafe, dan identitas dari Profil Toko**
- Logout
- Session-based auth untuk web, token-based (Sanctum) untuk mobile
- Password di-hash (bcrypt)
- Opsi **Remember Me** (lihat Bab 13 — Security)

**Acceptance Criteria:**
- ✅ User nonaktif tidak bisa login
- ✅ Login berhasil → langsung ke `/kasir`
- ✅ Halaman dilindungi middleware sesuai role — akses tidak sah → 403
- ✅ Data identitas di halaman login diambil dari Profil Toko

---

### 5.2 Kasir (POS) — Layar Utama

**Layout (desktop / tablet landscape):**
- **Panel kiri:** grid produk
- **Panel kanan:** **Keranjang**
- **Tombol "Bayar"** berada di **bagian bawah panel keranjang**

**Panel Kiri — Grid Produk:**
- Produk ditampilkan dalam **grid card**, setiap card menampilkan:
  - Foto produk
  - Nama produk
  - Harga
  - **Sisa stok**
- Filter per kategori (tab / chip di atas grid)
- **Cari produk** real-time by nama (lihat Bab 11 — Search & Pagination)
- Klik card → item masuk ke Keranjang

> 📌 Pemilihan menu **sepenuhnya melalui grid produk**. Aplikasi ini tidak menggunakan barcode scanner (lihat Bab Out of Scope).

**Panel Kanan — Keranjang:**
- Daftar item: nama, harga satuan, subtotal
- **Quantity menggunakan tombol `+` dan `−`** (bukan input bebas)
- Hapus item
- Catatan pesanan per item (contoh: "es sedikit", "tanpa gula")
- Diskon (nominal atau persen, level transaksi)
- Ringkasan: Subtotal → Diskon → **Pajak** → **Total**
- Tombol **Kosongkan Keranjang** (dengan konfirmasi)
- Tombol **Bayar** — di bagian bawah panel

**Acceptance Criteria:**
- ✅ Produk yang sama diklik 2x → qty bertambah, bukan baris baru
- ✅ Tombol `−` saat qty = 1 → item terhapus (dengan konfirmasi)
- ✅ Tombol `+` tidak bisa melebihi sisa stok (jika Kelola Stok aktif)
- ✅ Produk berstatus **Habis** atau stok = 0 → card tampil disabled/redup, tidak bisa dipilih
- ✅ Total = (Σ subtotal item − diskon) + pajak
- ✅ Tombol **Bayar** disabled jika keranjang kosong
- ✅ Mobile: grid produk dan keranjang stacked (keranjang bisa di-toggle sebagai bottom sheet)

---

### 5.3 Pembayaran

Metode pembayaran yang tampil **mengikuti pengaturan** (hanya metode berstatus aktif yang muncul).

| Metode | Behavior |
|---|---|
| **Tunai** | Input uang pelanggan → kembalian otomatis |
| **QRIS** | Tampilkan QR statis / tandai lunas manual |
| **Transfer Bank** | Tandai lunas manual + input referensi (opsional) |
| **Kartu Debit/Kredit** | Tandai lunas manual (opsional, sesuai pengaturan) |

**Requirement:**
- Hitung total: subtotal − diskon + pajak (mengikuti pengaturan Pajak & Biaya)
- **Pembulatan** total mengikuti metode pembulatan di pengaturan
- Input uang pelanggan (khusus Tunai)
- **Kembalian otomatis** = uang pelanggan − total
- **Shortcut denominasi:** Uang Pas / 20rb / 50rb / 100rb / pembulatan cerdas
- Input nomor WhatsApp pelanggan (opsional) untuk struk digital
- Simpan transaksi (status **`paid`**) — **atomic** dengan pengurangan stok
- Cetak struk

**Acceptance Criteria:**
- ✅ Tunai: uang pelanggan < total → tombol Simpan disabled + peringatan
- ✅ Kembalian dihitung real-time saat mengetik
- ✅ Non-tunai: field uang pelanggan disembunyikan
- ✅ Setelah simpan → keranjang kosong, **kembali ke layar Kasir** siap transaksi berikutnya
- ✅ Nomor transaksi unik & auto-generate: `TRX-YYYYMMDD-0001` (lihat Bab 12 — Auto Number)
- ✅ Metode pembayaran nonaktif tidak muncul sebagai pilihan

---

### 5.4 Status Transaksi

Setiap transaksi memiliki status:

| Status | Arti | Kapan Digunakan |
|---|---|---|
| **`paid`** | Transaksi lunas & selesai | Status default saat transaksi berhasil disimpan |
| **`cancelled`** | Transaksi dibatalkan | Dipakai untuk membatalkan transaksi yang salah input |

**Aturan Penggunaan:**
- Transaksi baru selalu tersimpan dengan status **`paid`**.
- Transaksi **tidak bisa diedit atau dihapus** (immutable). Koreksi hanya lewat **pembatalan** → status berubah menjadi **`cancelled`**.
- **Hanya Owner** yang dapat membatalkan transaksi (audit-sensitive).
- Pembatalan **wajib menyertakan alasan** (`cancel_reason`) dan mencatat siapa & kapan (`cancelled_by`, `cancelled_at`).
- Saat transaksi dibatalkan → **stok dikembalikan otomatis** + entry `stock_movement` bertipe `adjustment` (reason: "cancel transaksi").
- Transaksi `cancelled` **tidak dihitung** di laporan penjualan, omzet, dan laba, tetapi **tetap tampil** di Riwayat Transaksi (dengan badge merah) untuk jejak audit.

**Acceptance Criteria:**
- ✅ Hanya Owner yang bisa membatalkan transaksi
- ✅ Pembatalan wajib input alasan
- ✅ Stok kembali otomatis saat pembatalan
- ✅ Transaksi `cancelled` dikecualikan dari semua perhitungan laporan
- ✅ Transaksi `cancelled` tetap terlihat di riwayat dengan penanda visual

---

### 5.5 Cetak Struk

**Requirement:**
- **Printer USB / jaringan:** via `window.print()` + CSS `@media print`, ukuran thermal **58mm** (fallback A4)
- **Printer Bluetooth:** via Web Bluetooth API (browser) / native bridge (Android/iOS), protokol **ESC/POS**
- **Struk digital via WhatsApp:** kirim ringkasan transaksi + link/gambar struk ke nomor pelanggan

**Isi struk (diambil dari Profil Toko):**
- **Nama Cafe** (default: **Pitou Cafe**), logo, alamat, no. telp, email, Instagram
- Nomor transaksi, tanggal & jam, nama kasir
- Daftar item (nama, qty, harga, subtotal) + catatan
- Subtotal, Diskon, **Pajak (nama & persentase sesuai pengaturan)**, Total
- Metode pembayaran, uang bayar & kembalian (jika tunai)
- **Footer Struk** (teks bebas dari Profil Toko, contoh: "Terima kasih, sampai jumpa lagi!")

**Acceptance Criteria:**
- ✅ Layout struk **table-based**, bukan flexbox (kompatibilitas printer thermal)
- ✅ Preview struk tampil sebelum print
- ✅ Struk bisa dicetak ulang dari Riwayat Transaksi
- ✅ Baris pajak tidak tampil jika pajak dinonaktifkan
- ✅ Header & footer struk mengikuti Profil Toko
- ✅ Penanganan gagal cetak diatur di Bab 9 — Error Handling

---

### 5.6 Produk

**Form Tambah / Edit Produk** (modal) — field **final** sesuai desain:

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| **Nama Produk** | text | ✅ | |
| **Kategori** | select (FK) | ✅ | |
| **Barcode / SKU** | text | ❌ | **Opsional** — disediakan untuk kebutuhan pengembangan di masa depan, **bukan fitur utama**. Unik jika diisi |
| **Harga Jual** | number | ✅ | Rupiah, tanpa desimal |
| **Foto Produk** | file | ❌ | jpg/png/webp, max 2MB |
| **Deskripsi** | textarea | ❌ | |
| **Status** | toggle/select | ✅ | **Aktif** / **Habis** |
| **Kelola Stok** | toggle | ✅ | Jika aktif, stok dipantau |
| **Jumlah Stok** | number | kondisional | Wajib & tampil hanya jika Kelola Stok aktif |
| **Minimum Stok** | number | ❌ | Tampil hanya jika Kelola Stok aktif; trigger peringatan stok menipis |

> ⛔ Field **Harga Modal** tidak ada di form. `cost_price` diisi otomatis dari data Pembelian (harga beli terakhir / rata-rata). Ini menjaga laporan Laba Kotor tetap berjalan tanpa menambah field di form.

**List Produk:**
- Tabel/grid dengan kolom: Foto, Nama, Kategori, Harga, Stok, Status, Aksi
- Search & filter kategori (lihat Bab 11)
- Aksi: Edit, Hapus (soft delete), dengan konfirmasi

**Acceptance Criteria:**
- ✅ Barcode unik jika diisi; boleh kosong
- ✅ Jumlah Stok & Minimum Stok hanya muncul saat Kelola Stok = ON
- ✅ Produk yang sudah pernah ditransaksikan → **soft delete**, tidak hard delete
- ✅ Status Habis / stok 0 → tidak bisa dipilih di layar Kasir

---

### 5.7 Kategori

- Tambah / Edit / Hapus / List kategori
- Nama kategori wajib & unik

**Acceptance Criteria:**
- ✅ Kategori yang masih dipakai produk tidak bisa dihapus (RESTRICT)
- ✅ Konfirmasi sebelum hapus

---

### 5.8 Manajemen Stok *(sub-tab di dalam Produk)*

**Requirement:**
- Stok berkurang **otomatis** saat transaksi disimpan
- Stok bertambah saat **pembelian dari supplier** dicatat
- Stok dikembalikan saat transaksi **dibatalkan**
- **Penyesuaian stok manual** (stock opname) dengan alasan: rusak, hilang, koreksi
- **Riwayat pergerakan stok** (stock movement log): siapa, kapan, dari berapa ke berapa, alasan
- **Peringatan stok menipis** (stok ≤ minimum stok) — badge/notifikasi di halaman Produk

**Acceptance Criteria:**
- ✅ Setiap perubahan stok tercatat di log — tidak ada perubahan "diam-diam"
- ✅ Transaksi gagal jika stok tidak mencukupi (DB transaction + `lockForUpdate()`)
- ✅ Stok tidak bisa negatif

---

### 5.9 Supplier & Pembelian *(sub-tab di dalam Produk)*

**Supplier (CRUD):** Nama, kontak/HP, alamat, catatan

**Pembelian:**
- Pilih supplier → tambah produk + qty + harga beli
- Simpan → **stok otomatis bertambah** + `cost_price` produk terupdate
- Nomor pembelian auto-generate: `PUR-YYYYMMDD-0001`
- Riwayat pembelian + filter tanggal & supplier
- Total pengeluaran pembelian per periode

**Acceptance Criteria:**
- ✅ Menyimpan pembelian otomatis membuat entry di stock movement log
- ✅ Supplier yang punya riwayat pembelian → soft delete (RESTRICT hard delete)

---

### 5.10 Pengeluaran (Expense Management) — *Menu Utama Sidebar*

**Deskripsi:** Mencatat **biaya operasional** cafe yang **tidak mempengaruhi stok**.

> ⚠️ **Berbeda dengan Supplier & Pembelian.**
> - **Supplier & Pembelian** → pembelian barang/inventaris yang **menambah stok**.
> - **Pengeluaran** → biaya operasional (listrik, gaji, sewa, dll) yang **tidak menyentuh stok** sama sekali.

**Kategori Pengeluaran (default seed, dinamis):**
Listrik · Air · Internet / WiFi · Gaji Karyawan · Sewa · Perlengkapan Kebersihan · Transportasi · Lainnya

> Kategori disimpan di tabel `expense_categories` (bukan enum). Owner/Admin bisa menambah, mengedit, menonaktifkan kategori.

**Form Tambah / Edit Pengeluaran:**
| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| **Tanggal** | date | ✅ | Default hari ini |
| **Kategori** | select (FK → expense_categories) | ✅ | |
| **Nominal** | integer (Rupiah) | ✅ | Harus > 0 |
| **Deskripsi** | text | ❌ | |
| **Metode Pembayaran** | select | ✅ | Mengikuti metode aktif |
| **Foto Bukti / Struk** | image | ❌ | Opsional, jpg/png/webp max 2MB |
| **User pencatat** | FK → users | ✅ | Otomatis dari user login |

**Requirement:**
- **CRUD Pengeluaran** + **CRUD Kategori Pengeluaran**
- Nomor pengeluaran auto-generate: `EXP-YYYYMMDD-0001`
- List + **filter rentang tanggal & kategori** + **pagination**
- Total pengeluaran per periode & per kategori
- Upload & preview foto bukti
- Masuk ke **Laporan Pengeluaran** dan perhitungan **Laba Bersih**

**Acceptance Criteria:**
- ✅ Nominal harus > 0
- ✅ User pencatat terisi otomatis, tidak bisa diubah manual
- ✅ Akses: Owner & Admin
- ✅ Pengeluaran **tidak mempengaruhi stok** dan **tidak masuk** ke stock movement log
- ✅ Kategori yang masih dipakai tidak bisa dihapus (RESTRICT)
- ✅ Foto bukti opsional — jika kosong tampil placeholder
- ✅ Metode pembayaran mengikuti yang aktif di Pengaturan

---

### 5.11 Riwayat Transaksi

- List seluruh transaksi (paginated, terbaru di atas)
- Kolom: No. Transaksi, Tanggal/Jam, Jumlah Item, Total, Metode Bayar, Status, Kasir
- **Filter:** rentang tanggal, metode pembayaran, status (paid/cancelled), kasir
- **Detail transaksi** (semua item + catatan + rincian pajak)
- **Cetak ulang struk** / kirim ulang via WhatsApp
- **Batalkan transaksi** (Owner only, lihat 5.4)

**Acceptance Criteria:**
- ✅ Default menampilkan transaksi hari ini
- ✅ Kasir hanya melihat transaksinya sendiri; Admin/Owner melihat semua
- ✅ Transaksi **tidak bisa diedit atau dihapus** — koreksi hanya via pembatalan
- ✅ Transaksi `cancelled` tampil dengan penanda visual

---

### 5.12 Laporan

| Laporan | Isi |
|---|---|
| **Penjualan Harian** | Omzet & jumlah transaksi per hari (grafik + tabel) |
| **Penjualan Bulanan** | Rekap per bulan (grafik + tabel) |
| **Produk Terlaris** | Ranking by qty & by omzet, filter periode |
| **Laba Kotor** *(Gross Profit)* | Omzet − (harga modal × qty terjual) |
| **Total Pengeluaran** | Total biaya operasional per periode |
| **Pengeluaran per Kategori** | Breakdown pengeluaran by kategori (grafik pie/bar) |
| **Pengeluaran Bulanan** | Rekap pengeluaran per bulan (grafik + tabel) |
| **Laba Bersih** *(Net Profit)* | Laba Kotor − Total Pengeluaran Operasional |
| **Laporan Stok** | Stok saat ini, pergerakan stok, produk menipis |
| **Laporan Pembelian** | Pengeluaran pembelian per supplier & per periode |

> 📐 **Rumus:**
> ```
> Laba Kotor (Gross Profit) = Omzet − (Harga Modal × Qty Terjual)
> Laba Bersih (Net Profit)  = Laba Kotor − Total Pengeluaran Operasional
> ```
> "Pengeluaran Operasional" hanya dari modul **Pengeluaran** — **tidak** termasuk Pembelian stok (harga modal sudah dihitung di Laba Kotor via COGS). Ini mencegah double-counting. Transaksi `cancelled` dikecualikan dari seluruh perhitungan.

**Export:** **PDF** (DomPDF) dan **Excel/XLSX** (Laravel Excel) — tersedia di setiap laporan.

**Acceptance Criteria:**
- ✅ Semua laporan bisa difilter rentang tanggal + pagination pada tabel
- ✅ Angka konsisten dengan Riwayat Transaksi & modul Pengeluaran
- ✅ Grafik menggunakan chart library (Chart.js / Recharts)
- ✅ Header laporan (nama cafe, logo) diambil dari Profil Toko

---

### 5.13 Pengaturan

Pengaturan terdiri dari tab berikut. Akses default **Owner**; Admin hanya melihat tab yang diizinkan (Pajak & Biaya, Metode Pembayaran) — **Pengguna, Backup & Restore, dan Activity Log khusus Owner**.

#### A. Profil Toko
| Field | Tipe | Wajib |
|---|---|---|
| Nama Cafe | text | ✅ (default: **Pitou Cafe**) |
| Logo | image | ❌ |
| Alamat | textarea | ❌ |
| Nomor Telepon | text | ❌ |
| Email | email | ❌ |
| Instagram | text | ❌ (opsional) |
| Footer Struk | textarea | ❌ |

Data Profil Toko digunakan di: **Login, Header aplikasi, Struk, Laporan, Splash Screen.**

**Acceptance Criteria:**
- ✅ Nama Cafe wajib, tidak boleh kosong (default "Pitou Cafe" saat pertama install)
- ✅ Perubahan Profil Toko langsung tercermin di Login, Header, Struk, Laporan, Splash Screen
- ✅ Logo yang diupload divalidasi (jpg/png/webp, max 2MB); jika kosong pakai logo default
- ✅ Struk lama tetap konsisten (nama & footer di-render dari setting saat cetak; catatan: perubahan profil bersifat global dan berlaku untuk cetak ulang)

#### B. Pajak & Biaya
| Field | Keterangan |
|---|---|
| Aktifkan Pajak | Toggle ON/OFF |
| Nama Pajak | Contoh: "PPN", "Pajak Restoran" |
| Persentase Pajak | Contoh: 10 (%) |
| Metode Pembulatan | Tanpa pembulatan / ke atas / ke bawah / terdekat (kelipatan 100 / 500 / 1000) |

**Acceptance Criteria:**
- ✅ Pajak OFF → tidak ada baris pajak di keranjang maupun struk
- ✅ Perubahan pajak **tidak mengubah transaksi lama** (nilai pajak di-snapshot per transaksi)
- ✅ Persentase pajak 0–100

#### C. Metode Pembayaran
| Metode | Status |
|---|---|
| Tunai | Aktif / Nonaktif |
| QRIS | Aktif / Nonaktif |
| Transfer Bank | Aktif / Nonaktif |
| Kartu Debit/Kredit | Aktif / Nonaktif (opsional) |

**Acceptance Criteria:**
- ✅ Hanya metode aktif yang muncul di layar Pembayaran
- ✅ Minimal **satu** metode harus aktif — tidak bisa menonaktifkan semuanya

#### D. Pengguna *(Owner only)*
- Tambah / Edit / **Nonaktifkan** user (bukan hapus permanen)
- Role: **Owner, Admin, Kasir**

**Acceptance Criteria:**
- ✅ Hanya Owner yang bisa mengakses tab Pengguna
- ✅ User tidak bisa menonaktifkan dirinya sendiri
- ✅ Owner terakhir tidak bisa dinonaktifkan
- ✅ User nonaktif tidak bisa login, tapi riwayat transaksinya tetap utuh

#### E. Backup & Restore *(Owner only)*
- **Backup Database** — buat cadangan seluruh data (dump `.sql` / arsip)
- **Download Backup** — unduh file backup ke perangkat
- **Restore Database** — pulihkan data dari file backup yang diunggah

**Acceptance Criteria:**
- ✅ Hanya Owner yang bisa mengakses Backup & Restore
- ✅ Backup menghasilkan file yang bisa diunduh (timestamped, contoh: `backup-pitou-20260715-1030.sql`)
- ✅ Restore menampilkan **konfirmasi ganda** + peringatan bahwa data saat ini akan ditimpa
- ✅ Restore memvalidasi format file; file tidak valid → ditolak dengan pesan jelas
- ✅ Proses backup/restore menampilkan loading state; gagal → pesan error, data lama tetap aman
- ✅ Aktivitas backup & restore tercatat di Activity Log

#### F. Activity Log *(Owner only)*
Mencatat aktivitas penting untuk audit. **Minimal** mencatat:
Login · Logout · Tambah Produk · Edit Produk · Hapus Produk · Tambah Pengeluaran · Edit Pengaturan · Tambah/Edit User · Batalkan Transaksi · Backup/Restore

| Field | Keterangan |
|---|---|
| User | Siapa yang melakukan |
| Aktivitas | Deskripsi aksi (contoh: "Menghapus produk Kopi Susu") |
| Modul | Produk / Pengeluaran / Pengaturan / User / Transaksi / Auth |
| Waktu | Timestamp |
| IP Address | Opsional |

**Acceptance Criteria:**
- ✅ **Hanya Owner** yang dapat melihat Activity Log
- ✅ Log bersifat **append-only** — tidak bisa diedit atau dihapus dari UI
- ✅ Bisa difilter berdasarkan user, modul, dan rentang tanggal + pagination
- ✅ Setiap aktivitas dalam daftar minimal tercatat lengkap (user, aktivitas, modul, waktu)

---

### 5.14 Mode Offline & Sinkronisasi Cloud

- Aplikasi berjalan sebagai **PWA** (installable, service worker, cache asset)
- **Offline-first di layar Kasir:** produk & kategori di-cache lokal (IndexedDB)
- Transaksi saat offline → disimpan lokal dengan `sync_status = pending`
- Saat online kembali → **sinkronisasi otomatis** ke server
- Indikator status: 🟢 Online / 🔴 Offline / 🔄 Menyinkronkan (n transaksi pending)
- **Konflik stok:** server adalah sumber kebenaran; jika stok tidak cukup saat sync, transaksi tetap tersimpan tapi ditandai untuk direview

**Acceptance Criteria:**
- ✅ Transaksi offline tidak hilang meski app ditutup
- ✅ Sinkronisasi **idempotent** — 1 transaksi tidak dobel meski di-retry
- ✅ Setiap transaksi punya `client_uuid` unik untuk deduplikasi
- ✅ User dapat melihat daftar transaksi yang belum tersinkron
- ✅ Penanganan gagal sinkronisasi diatur di Bab 9 — Error Handling

---

### 5.15 Aplikasi Mobile (Android & iOS)

- Dibangun dari basis PWA (packaging) atau shell native yang membungkus web app
- Akses fitur perangkat: kamera (foto produk / bukti pengeluaran), Bluetooth (printer thermal), storage (offline)
- Autentikasi via token (Laravel Sanctum)

**Acceptance Criteria:**
- ✅ Semua fitur Kasir berfungsi di mobile
- ✅ Print via Bluetooth berjalan
- ✅ Upload foto via kamera berjalan

---

## 6. Alur Pengguna

### Alur Utama
```
   Login
     ↓
Kasir (POS)
     ↓
Pilih Produk (grid)  ←──┐
     ↓                  │ (tambah item lagi)
  Keranjang ────────────┘
     ↓
 Pembayaran
     ↓
Cetak Struk / Kirim WhatsApp
     ↓
Transaksi Selesai (status: paid)
     ↓
Kembali ke Kasir (POS)
```

### Alur Pendukung
- Kasir → **Produk** → Tambah/Edit Produk (modal) / sub-tab Stok / sub-tab Supplier & Pembelian
- Kasir → **Kategori** → CRUD
- Kasir → **Pengeluaran** → Catat biaya operasional / kelola kategori pengeluaran
- Kasir → **Riwayat Transaksi** → Detail → Cetak Ulang / Kirim WhatsApp / (Owner) Batalkan
- Kasir → **Laporan** → Filter periode → Lihat grafik → Export PDF/Excel
- Kasir → **Pengaturan** → Profil Toko / Pajak & Biaya / Metode Pembayaran / Pengguna / Backup & Restore / Activity Log

### Alur Offline
```
Internet mati → indikator 🔴 Offline
     ↓
Transaksi tetap jalan (data dari cache lokal)
     ↓
Transaksi disimpan lokal (sync_status: pending)
     ↓
Internet kembali → 🔄 sync otomatis → 🟢 Online
```

---

## 7. Desain Database

### 7.1 Daftar Tabel & Kunci

| Tabel | Primary Key | Foreign Key | Unique Index | Normal Index | Soft Delete |
|---|---|---|---|---|---|
| **users** | id | — | username | role, is_active | ✅ |
| **categories** | id | — | name | — | ✅ |
| **products** | id | category_id → categories | barcode (nullable) | category_id, status | ✅ |
| **suppliers** | id | — | — | name | ✅ |
| **purchases** | id | supplier_id → suppliers, user_id → users | invoice_number | purchase_date, supplier_id | ❌ |
| **purchase_items** | id | purchase_id → purchases, product_id → products | — | purchase_id, product_id | ❌ |
| **stock_movements** | id | product_id → products, user_id → users | — | product_id, type, created_at | ❌ |
| **transactions** | id | user_id → users, cancelled_by → users (nullable) | invoice_number, client_uuid | status, payment_method, created_at, sync_status | ❌ |
| **transaction_items** | id | transaction_id → transactions, product_id → products | — | transaction_id, product_id | ❌ |
| **expense_categories** | id | — | name | is_active | ✅ |
| **expenses** | id | user_id → users, expense_category_id → expense_categories | expense_number | expense_date, expense_category_id | ✅ |
| **payment_methods** | id | — | code | is_active | ❌ |
| **settings** | id | — | key | — | ❌ |
| **activity_logs** | id | user_id → users | — | user_id, module, created_at | ❌ |

### 7.2 Kolom Utama per Tabel

- **users** — id, name, username (unique), password, role (`owner`/`admin`/`kasir`), is_active, soft deletes, timestamps
- **categories** — id, name (unique), soft deletes, timestamps
- **products** — id, category_id (FK), name, barcode (unique nullable), price, cost_price (nullable, auto dari pembelian), photo (nullable), description (nullable), status (`aktif`/`habis`), track_stock (bool), stock (int), min_stock (int), soft deletes, timestamps
- **suppliers** — id, name, phone, address, note, soft deletes, timestamps
- **purchases** — id, supplier_id (FK), user_id (FK), invoice_number (unique, `PUR-…`), total, purchase_date, note, timestamps
- **purchase_items** — id, purchase_id (FK), product_id (FK), quantity, cost_price, subtotal, timestamps
- **stock_movements** — id, product_id (FK), user_id (FK), type (`sale`/`purchase`/`adjustment`), reference_type, reference_id, quantity_change, stock_before, stock_after, reason (nullable), timestamps
- **transactions** — id, user_id (FK), client_uuid (unique), invoice_number (unique, `TRX-…`), subtotal, discount, tax_name (snapshot), tax_percent (snapshot), tax_amount (snapshot), rounding (snapshot), total, payment_method, paid_amount (nullable), change_amount (nullable), customer_phone (nullable), **status (`paid`/`cancelled`)**, cancel_reason (nullable), cancelled_by (FK nullable), cancelled_at (nullable), sync_status (`synced`/`pending`), timestamps
- **transaction_items** — id, transaction_id (FK, cascade), product_id (FK), product_name (snapshot), price (snapshot), cost_price (snapshot), quantity, subtotal, note (nullable), timestamps
- **expense_categories** — id, name (unique), is_active (bool), soft deletes, timestamps
- **expenses** — id, user_id (FK), expense_category_id (FK), expense_number (unique, `EXP-…`), expense_date, amount, description (nullable), payment_method, receipt_image (nullable), soft deletes, timestamps
- **payment_methods** — id, name, code (unique), is_active (bool), timestamps
- **settings** — id, key (unique), value — menyimpan Profil Toko (nama default **Pitou Cafe**, logo, alamat, telepon, email, instagram, footer struk) + tax_enabled, tax_name, tax_percent, rounding_method
- **activity_logs** — id, user_id (FK), activity, module, ip_address (nullable), timestamps

### 7.3 Relasi & Aturan Integritas

```
users (1) ──── (N) transactions            [RESTRICT]
users (1) ──── (N) purchases               [RESTRICT]
users (1) ──── (N) expenses                [RESTRICT]
users (1) ──── (N) activity_logs           [RESTRICT]
categories (1) ──── (N) products           [RESTRICT]  — kategori berisi produk tak bisa dihapus
suppliers (1) ──── (N) purchases           [RESTRICT]
expense_categories (1) ──── (N) expenses   [RESTRICT]
products (1) ──── (N) transaction_items    [RESTRICT]  — dijaga soft delete + snapshot
products (1) ──── (N) purchase_items        [RESTRICT]
products (1) ──── (N) stock_movements       [RESTRICT]
transactions (1) ──── (N) transaction_items [CASCADE]  — item ikut terhapus jika induk dihapus (tidak terjadi krn immutable)
purchases (1) ──── (N) purchase_items       [CASCADE]
```

### 7.4 Kebijakan Soft Delete

**Menggunakan Soft Delete** (kolom `deleted_at`) — data bisa dinonaktifkan tanpa hilang, menjaga integritas riwayat:
`users`, `categories`, `products`, `suppliers`, `expense_categories`, `expenses`

**Tidak Soft Delete** (append-only / immutable — tidak boleh dihapus dari UI demi audit & integritas):
`transactions`, `transaction_items`, `purchases`, `purchase_items`, `stock_movements`, `activity_logs`, `payment_methods`, `settings`

> ⚠️ **Snapshot (anti-korupsi data):**
> - `product_name`, `price`, `cost_price` → `transaction_items`: riwayat & laba lama tetap akurat meski produk berubah/di-soft-delete.
> - `tax_name`, `tax_percent`, `tax_amount`, `rounding` → `transactions`: mengubah pengaturan pajak tidak merusak transaksi lama.

---

## 8. Non-Functional Requirements

| Kategori | Requirement |
|---|---|
| **Responsivitas** | Optimal di desktop (≥1280px) & tablet (≥1024px); mobile fully supported |
| **Usability** | Sederhana, minim klik. Seluruh UI Bahasa Indonesia |
| **Performa** | Layar Kasir load < 2 detik; simpan transaksi < 1 detik; animasi 60 FPS |
| **Keamanan** | Auth wajib, password hashed, RBAC, CSRF & SQL injection protection, HTTPS (detail Bab 13) |
| **Integritas Data** | Transaksi immutable; stok update via DB transaction + row lock |
| **Reliabilitas** | Offline-capable; sync idempotent (dedup via `client_uuid`) |
| **Auditability** | Activity Log append-only; transaksi hanya bisa dibatalkan (bukan dihapus) |
| **Kompatibilitas** | Chrome, Edge, Firefox, Safari (2 versi terakhir); Android 8+, iOS 14+ |
| **Aksesibilitas** | Mendukung `prefers-reduced-motion` (lihat Bab 14) |
| **Timezone** | `APP_TIMEZONE` sesuai lokasi cafe |

---

## 9. Error Handling

| Kasus | Perilaku Sistem |
|---|---|
| **Printer Thermal gagal** | Tampilkan toast error + tombol "Coba Lagi"; **transaksi tetap tersimpan**; struk bisa dicetak ulang dari Riwayat |
| **Bluetooth gagal / tidak didukung** | Fallback otomatis ke print browser (`window.print()`); beri tahu user; transaksi tetap aman |
| **Upload gambar gagal** | Tampilkan pesan (ukuran/format/koneksi); form tidak hilang; data lain tetap terisi; user bisa ulang upload |
| **Sinkronisasi gagal** | Transaksi tetap `pending` di lokal; badge 🔄 tetap tampil; retry otomatis + tombol "Sinkron Ulang" manual; tidak ada data hilang |
| **Offline Mode** | Banner 🔴 Offline; fitur yang butuh server (laporan/backup) dinonaktifkan dengan pesan; Kasir tetap jalan dari cache |
| **Data tidak ditemukan (404)** | Tampilkan Empty State ramah + tombol kembali; bukan halaman error mentah |
| **Error server (5xx)** | Halaman/toast error sopan + opsi coba lagi; tidak menampilkan stack trace ke user |

**Acceptance Criteria:**
- ✅ Tidak ada kegagalan yang menyebabkan **kehilangan transaksi**
- ✅ Setiap error menampilkan pesan yang **jelas & actionable** (Bahasa Indonesia), bukan kode teknis
- ✅ Kegagalan printer/Bluetooth selalu punya jalur fallback
- ✅ Sinkronisasi gagal → data aman & bisa di-retry
- ✅ Error tidak membuat aplikasi crash / blank screen

---

## 10. Loading State & Empty State

### 10.1 Loading State (Skeleton)
Halaman yang memuat data menampilkan **skeleton loading** (bukan spinner kosong):
- **Produk** — skeleton grid card
- **Riwayat Transaksi** — skeleton baris tabel
- **Laporan** — skeleton grafik + tabel
- **Pengeluaran** — skeleton baris tabel

### 10.2 Empty State
Saat data kosong, tampilkan ilustrasi/ikon + pesan ramah + CTA:
- **Belum ada produk** → "Belum ada produk. Tambah produk pertamamu." + tombol Tambah Produk
- **Belum ada transaksi** → "Belum ada transaksi hari ini."
- **Belum ada laporan** → "Belum ada data untuk periode ini." (saran ubah filter tanggal)
- **Belum ada pengeluaran** → "Belum ada pengeluaran tercatat." + tombol Tambah Pengeluaran

**Acceptance Criteria:**
- ✅ Setiap halaman berbasis data punya loading state & empty state
- ✅ Skeleton menyerupai layout final agar transisi mulus
- ✅ Empty state menyediakan CTA yang relevan bila memungkinkan

---

## 11. Search & Pagination

### 11.1 Perilaku Search
- **Realtime** — hasil tersaring saat mengetik
- **Debounce** — tunggu ±300 ms setelah ketikan terakhir sebelum memproses (mengurangi beban)
- **Case Insensitive** — "kopi", "Kopi", "KOPI" memberi hasil sama
- Search di Kasir (produk), Produk, Riwayat, Pengeluaran

### 11.2 Pagination
Diterapkan pada list panjang:
- **Produk** (list management)
- **Riwayat Transaksi**
- **Pengeluaran**
- **Laporan** (tabel data)

**Acceptance Criteria:**
- ✅ Search di layar Kasir tidak nge-lag saat mengetik cepat (berkat debounce)
- ✅ Pencarian tidak sensitif huruf besar/kecil
- ✅ Pagination menampilkan info halaman & navigasi; default 15–25 baris per halaman
- ✅ Filter + search + pagination bekerja bersamaan tanpa reset filter

---

## 12. Auto Number

Format nomor otomatis (reset harian, urutan 4 digit):

| Modul | Format | Contoh |
|---|---|---|
| Transaksi | `TRX-YYYYMMDD-0001` | `TRX-20260715-0001` |
| Pembelian | `PUR-YYYYMMDD-0001` | `PUR-20260715-0001` |
| Pengeluaran | `EXP-YYYYMMDD-0001` | `EXP-20260715-0001` |

**Acceptance Criteria:**
- ✅ Nomor unik per modul, tidak pernah dobel (dijaga unique index + generate dalam DB transaction)
- ✅ Urutan reset ke `0001` setiap ganti tanggal
- ✅ Nomor transaksi offline tetap unik setelah sync (dijamin `client_uuid`; nomor final diassign server bila perlu)

---

## 13. Security

| Aspek | Requirement |
|---|---|
| **Rate Limit Login** | Maksimal 5 percobaan gagal per user/IP dalam 1 menit → lockout sementara (throttle Laravel) |
| **Session Timeout** | Sesi kadaluarsa setelah **30 menit** tidak aktif (configurable) |
| **Password Minimal** | Minimal **8 karakter**; divalidasi saat buat/ubah user |
| **Remember Me** | Opsi di halaman login → sesi bertahan lebih lama (remember token) |
| **Auto Logout** | Saat session habis → otomatis logout & redirect ke login dengan pesan "Sesi berakhir, silakan login kembali" |
| **RBAC** | Middleware role di setiap route (lihat Bab 4) |
| **Proteksi Umum** | CSRF token, prepared statement (anti SQL injection), hash password (bcrypt), HTTPS |

**Acceptance Criteria:**
- ✅ Percobaan login berlebihan diblokir sementara + pesan jelas
- ✅ Idle melewati batas → auto logout otomatis
- ✅ Password < 8 karakter ditolak dengan pesan validasi
- ✅ Remember Me memperpanjang sesi sesuai konfigurasi
- ✅ Semua route sensitif terlindungi RBAC

---

## 14. Motion & Animation

**Konsep:** Modern, premium, smooth, cepat, dan **tidak mengganggu proses kasir**. Animasi hanya sebagai *feedback* interaksi — bukan penghias yang memperlambat.

**Aturan teknis:**
- Durasi animasi **150–300 ms**
- Gunakan **`transform`** dan **`opacity`** (GPU-accelerated) agar tetap **60 FPS**
- Hindari animasi pada properti yang memicu reflow (width/height/top/left)

**Daftar Animasi:**
| Area | Animasi |
|---|---|
| Splash Screen | Logo Pitou Cafe **fade + scale** |
| Login | Login card **fade-up** |
| Sidebar | **Slide-in** saat load; **hover** halus pada menu |
| Tombol | **Ripple effect** saat ditekan |
| Grid Produk | Produk muncul dengan **stagger animation** |
| Card Produk | **Scale kecil** saat diklik |
| Tambah ke Keranjang | **Fly-to-cart animation** |
| Quantity | **Smooth transition** saat +/− |
| Total Pembayaran | **Count-up animation** |
| Modal Pembayaran | **Fade + zoom** |
| Modal Tambah/Edit | **Fade + scale** |
| Toast Notification | **Slide** dari kanan atas |
| Bottom Sheet (mobile) | **Slide-up** |
| Grafik Laporan | Muncul **bertahap** |
| Sukses Pembayaran | **Checkmark + confetti ringan** |
| Cetak Struk | **Animasi printer** saat proses |
| Loading Data | **Skeleton loading** di seluruh halaman berbasis data |
| Antar Halaman | **Fade transition** |

**Acceptance Criteria:**
- ✅ Seluruh animasi berjalan minimal **60 FPS**
- ✅ Durasi maksimal **300 ms**
- ✅ Tidak mengganggu / memperlambat proses transaksi
- ✅ Mendukung **`prefers-reduced-motion`** — animasi diminimalkan bila user mengaktifkannya
- ✅ Animasi murni sebagai feedback interaksi, bukan penghambat

---

## 15. Tech Stack

| Layer | Teknologi |
|---|---|
| **Backend** | Laravel 13 |
| **Frontend** | React + Tailwind CSS |
| **Database** | MySQL |
| **Build Tool** | Vite |
| **Auth (web)** | Laravel Breeze |
| **Auth (mobile/API)** | Laravel Sanctum |
| **Offline Storage** | IndexedDB + Service Worker (PWA) |
| **Chart** | Chart.js / Recharts |
| **Export PDF** | DomPDF |
| **Export Excel** | Laravel Excel (maatwebsite) |
| **Printer Thermal** | ESC/POS via Web Bluetooth / native bridge |
| **WhatsApp** | WhatsApp Business API / gateway pihak ketiga |
| **Animasi** | Framer Motion / CSS transitions (transform + opacity) |
| **Icon** | Lucide |

---

## 16. Scope v1.0 Final

### ✅ In Scope
- [ ] Login / Logout (langsung ke Kasir) + Remember Me
- [ ] Multi-role (Owner / Admin / Kasir) + RBAC
- [ ] **Kasir (POS)** — grid card, search realtime, keranjang panel kanan, qty `+`/`−`, tombol Bayar di bawah
- [ ] Pembayaran (Tunai / QRIS / Transfer / Kartu) + pajak + pembulatan + kembalian otomatis
- [ ] **Status Transaksi** (Paid / Cancelled) + pembatalan (Owner)
- [ ] Cetak Struk (USB/jaringan + Bluetooth) + kirim via WhatsApp
- [ ] CRUD Produk (form final 10 field, Barcode/SKU opsional)
- [ ] CRUD Kategori
- [ ] Manajemen Stok + stock movement log + peringatan stok menipis
- [ ] Supplier & Pembelian
- [ ] **Pengeluaran (Expense Management)** — menu utama sidebar, CRUD + kategori dinamis, metode bayar, foto bukti, filter
- [ ] Riwayat Transaksi (filter, detail, cetak ulang, pembatalan)
- [ ] Laporan (penjualan, produk terlaris, laba kotor, total/per-kategori/bulanan pengeluaran, laba bersih, stok, pembelian) + Export PDF & Excel
- [ ] **Pengaturan**: Profil Toko, Pajak & Biaya, Metode Pembayaran, Pengguna, **Backup & Restore**, **Activity Log**
- [ ] Error Handling, Loading & Empty State, Search & Pagination, Auto Number
- [ ] Security (rate limit, session timeout, password min, remember me, auto logout)
- [ ] Motion & Animation
- [ ] PWA + Mode Offline + Sinkronisasi
- [ ] Aplikasi Android & iOS

### ⛔ Out of Scope
- **Dashboard** (dihapus)
- **Barcode Scanner** — scan barcode, barcode USB/kamera, pengaturan barcode (dihapus; field Barcode/SKU tetap ada sebagai opsional untuk pengembangan masa depan)
- **Save Order** & **Split Bill** (dihapus dari desain)
- Integrasi payment gateway (QRIS dinamis / auto-verifikasi)
- Multi-cabang / multi-outlet
- Program loyalti & membership pelanggan
- Manajemen resep / bill of materials
- Manajemen shift & tutup kasir (cash reconciliation)
- Integrasi akuntansi eksternal

---

## 17. Risiko & Asumsi

| Risiko / Asumsi | Mitigasi |
|---|---|
| Scope v1.0 besar untuk sekali rilis | Bangun bertahap per modul (lihat Bab 18) |
| Harga Modal auto dari pembelian → Laba Kotor kosong sebelum ada pembelian | `cost_price` auto dari Pembelian; jika belum ada data → laba kotor "N/A", bukan 0 |
| Printer thermal 58mm beda perilaku antar merek | Layout table-based; test di printer target sejak awal |
| Web Bluetooth tidak didukung Safari/iOS | Fallback ke print browser; native bridge untuk app mobile |
| Sinkronisasi offline rawan duplikat & konflik stok | `client_uuid` untuk idempotensi; server sumber kebenaran; konflik ditandai |
| Restore database berisiko menimpa data | Konfirmasi ganda + validasi file + backup otomatis sebelum restore |
| Pengaturan pajak diubah → transaksi lama ikut berubah | Snapshot pajak per transaksi |
| Perubahan Profil Toko berlaku global (termasuk cetak ulang struk lama) | Diterima untuk v1.0; jika perlu histori profil, masuk pengembangan lanjutan |
| Animasi berat menurunkan performa kasir | Batasi transform+opacity, durasi ≤300 ms, dukung reduced-motion |
| QRIS & Transfer hanya "tandai lunas" — rawan human error | Konfirmasi wajib sebelum simpan; SOP kasir |
| WhatsApp API berbayar & butuh verifikasi bisnis | Fitur opsional, bisa dinonaktifkan |
| Produk dihapus → riwayat rusak | Soft delete + snapshot nama/harga di `transaction_items` |
| Race condition stok saat transaksi bersamaan | DB transaction + `lockForUpdate()` |

---

## 18. Urutan Pengembangan (Saran)

| Fase | Modul |
|---|---|
| **1** | Auth + Multi-user + RBAC + Security (redirect ke Kasir) |
| **2** | Pengaturan: Profil Toko + Pajak & Biaya + Metode Pembayaran |
| **3** | CRUD Kategori & Produk (form final) |
| **4** | **Kasir (POS)** + Keranjang + Search |
| **5** | Pembayaran + Status Transaksi + Cetak Struk (USB/browser) |
| **6** | Riwayat Transaksi + Pembatalan |
| **7** | Manajemen Stok + Stock Movement |
| **8** | Supplier + Pembelian |
| **9** | Pengeluaran (Expense Management) + Kategori Pengeluaran |
| **10** | Laporan + Export PDF/Excel |
| **11** | Pengaturan: Pengguna + Backup & Restore + Activity Log |
| **12** | Error Handling + Loading/Empty State + Pagination (pass menyeluruh) |
| **13** | Motion & Animation (pass menyeluruh) |
| **14** | Printer Bluetooth |
| **15** | PWA + Mode Offline + Sinkronisasi |
| **16** | Integrasi WhatsApp |
| **17** | Packaging Android & iOS |

---

*PRD v1.0 Final — siap dilanjutkan ke tahap SRS dan Database Design.*
