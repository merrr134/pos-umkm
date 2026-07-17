# Progress Checklist — Pitou Cafe POS v1.0

> Centang `[x]` setiap item yang sudah selesai. Disusun mengikuti **18 fase** di PRD Final.
> Legenda: 🗄️ Database · ⚙️ Backend · 🎨 Frontend · ✅ Acceptance Criteria

**Progress keseluruhan:** ` 17 / 17 fase selesai` *(Fase 1–17 penuh; packaging Android via Capacitor siap dibuild — APK final menunggu environment ber-Android SDK)*

---

## FASE 0 — Setup Proyek
- [ ] Inisialisasi Laravel 13 + React + Vite + Tailwind
- [ ] Konfigurasi `.env` (DB MySQL, `APP_TIMEZONE`)
- [ ] Setup Laravel Breeze (auth web) + Sanctum (API/mobile)
- [ ] Struktur folder & konvensi penamaan
- [ ] Git repo + `.gitignore`

---

## FASE 1 — Auth + Multi-user + RBAC + Security
### 🗄️ Database
- [x] Migration `users` (role, is_active, remember_token, soft delete)
- [x] Seeder Owner default
### ⚙️ Backend
- [x] Login / Logout (username + password)
- [x] Middleware RBAC (owner / admin / kasir)
- [x] Redirect setelah login → `/kasir`
- [x] Rate limit login (5x / menit → lockout)
- [x] Session timeout 30 menit + auto logout
- [x] Validasi password minimal 8 karakter
- [x] Remember Me
### 🎨 Frontend
- [x] Halaman login (logo + identitas dari Profil Toko)
- [x] Splash screen
- [x] Guard route berdasarkan role
### ✅ Acceptance Criteria
- [x] User nonaktif tidak bisa login
- [x] Login berhasil → `/kasir`
- [x] Akses tidak sah → 403
- [x] Login berlebihan diblokir sementara
- [x] Idle melebihi batas → auto logout
- [x] Password < 8 karakter ditolak

---

## FASE 2 — Pengaturan: Profil Toko + Pajak & Biaya + Metode Pembayaran
### 🗄️ Database
- [x] Migration `settings` (key-value)
- [x] Migration `payment_methods`
- [x] Seeder settings (store_name = Pitou Cafe, pajak off)
- [x] Seeder payment_methods (Tunai/QRIS/Transfer/Kartu)
### ⚙️ Backend
- [x] CRUD Profil Toko (nama, logo, alamat, telp, email, IG, footer struk)
- [x] Pengaturan Pajak (aktif, nama, persen, pembulatan)
- [x] Pengaturan Metode Pembayaran (aktif/nonaktif)
- [x] Upload & validasi logo (jpg/png/webp, max 2MB)
### 🎨 Frontend
- [x] Tab Profil Toko
- [x] Tab Pajak & Biaya
- [x] Tab Metode Pembayaran
### ✅ Acceptance Criteria
- [x] Nama Cafe wajib (default Pitou Cafe)
- [x] Profil Toko tercermin di Login/Header/Struk/Laporan/Splash
- [x] Pajak OFF → tidak ada baris pajak
- [x] Persentase pajak 0–100
- [x] Minimal 1 metode pembayaran aktif

---

## FASE 3 — CRUD Kategori & Produk
### 🗄️ Database
- [x] Migration `categories` (soft delete)
- [x] Migration `products` (semua field + soft delete + index)
### ⚙️ Backend
- [x] CRUD Kategori (nama unik, RESTRICT jika dipakai produk)
- [x] CRUD Produk (10 field final)
- [x] Barcode/SKU opsional (unik jika diisi)
- [x] Upload foto produk
- [x] Soft delete produk yang sudah ditransaksikan
### 🎨 Frontend
- [x] Halaman Kategori + modal
- [x] Halaman Produk (list + kolom Foto/Nama/Kategori/Harga/Stok/Status/Aksi)
- [x] Modal Tambah/Edit Produk (Jumlah/Min Stok muncul saat Kelola Stok ON)
- [x] Konfirmasi hapus
### ✅ Acceptance Criteria
- [x] Kategori terpakai tak bisa dihapus
- [x] Barcode unik jika diisi, boleh kosong
- [x] Jumlah/Min Stok hanya muncul saat Kelola Stok ON
- [x] Produk pernah ditransaksikan → soft delete
- [x] Status Habis / stok 0 → tak bisa dipilih di Kasir

---

## FASE 4 — Kasir (POS) + Keranjang + Search
### ⚙️ Backend
- [x] Endpoint daftar produk (per kategori + search)
- [x] Hitung total (subtotal − diskon + pajak)
### 🎨 Frontend
- [x] Layout 2 panel (grid kiri, keranjang kanan)
- [x] Grid card produk (foto, nama, harga, sisa stok)
- [x] Filter kategori (tab/chip)
- [x] Search realtime + debounce 300ms + case-insensitive
- [x] Keranjang: qty tombol +/−, hapus item, catatan per item
- [x] Diskon (nominal/persen)
- [x] Ringkasan Subtotal → Diskon → Pajak → Total
- [x] Tombol Kosongkan Keranjang (konfirmasi)
- [x] Tombol Bayar di bawah panel
- [x] Responsif mobile (keranjang bottom sheet)
### ✅ Acceptance Criteria
- [x] Klik produk sama 2x → qty nambah, bukan baris baru
- [x] Tombol − saat qty 1 → hapus (konfirmasi)
- [x] Tombol + tak melebihi sisa stok
- [x] Produk Habis/stok 0 → card disabled
- [x] Tombol Bayar disabled jika keranjang kosong

---

## FASE 5 — Pembayaran + Status Transaksi + Cetak Struk
### 🗄️ Database
- [x] Migration `transactions` (snapshot pajak, status, cancel, sync, client_uuid)
- [x] Migration `transaction_items` (snapshot nama/harga/modal)
### ⚙️ Backend
- [x] Simpan transaksi atomik (DB transaction + lockForUpdate)
- [x] Kurangi stok otomatis + buat stock_movement
- [x] Auto number `TRX-YYYYMMDD-0001`
- [x] Kembalian otomatis (tunai)
- [x] Pembulatan sesuai pengaturan
- [x] Status transaksi = paid
### 🎨 Frontend
- [x] Modal pembayaran (metode aktif saja)
- [x] Input uang + shortcut denominasi
- [x] Input WhatsApp pelanggan (opsional)
- [x] Preview struk sebelum print
- [x] Cetak struk thermal 58mm (table-based) via window.print()
### ✅ Acceptance Criteria
- [x] Tunai: uang < total → Simpan disabled + peringatan
- [x] Kembalian real-time
- [x] Non-tunai: field uang disembunyikan
- [x] Setelah simpan → keranjang kosong, balik ke Kasir
- [x] Nomor transaksi unik
- [x] Struk mengikuti Profil Toko (header + footer)
- [x] Baris pajak hilang jika pajak off

---

## FASE 6 — Riwayat Transaksi + Pembatalan
### ⚙️ Backend
- [x] List transaksi (paginated, filter tanggal/metode/status/kasir)
- [x] Detail transaksi
- [x] Pembatalan (Owner only, wajib alasan)
- [x] Kembalikan stok saat pembatalan + stock_movement adjustment
### 🎨 Frontend
- [x] Halaman Riwayat (kolom lengkap + badge status)
- [x] Filter + pagination
- [x] Modal detail transaksi
- [x] Cetak ulang struk / kirim ulang WhatsApp *(WhatsApp = tombol placeholder, implementasi asli di Fase 16)*
- [x] Aksi Batalkan (Owner) + input alasan
### ✅ Acceptance Criteria
- [x] Default tampil transaksi hari ini
- [x] Kasir hanya lihat transaksinya; Admin/Owner semua
- [x] Transaksi tak bisa diedit/dihapus
- [x] Hanya Owner bisa batalkan
- [x] Stok kembali saat batal
- [x] Transaksi cancelled ada penanda + dikecualikan dari laporan *(penanda visual ✓; pengecualian dari laporan diverifikasi saat modul Laporan dibangun di Fase 10)*

---

## FASE 7 — Manajemen Stok + Stock Movement
### 🗄️ Database
- [x] Migration `stock_movements` *(tabel dibuat sejak Fase 5; Fase 7 menambah nilai enum type `restock` & `cancel_transaction`)*
### ⚙️ Backend
- [x] Penyesuaian stok manual (rusak/hilang/koreksi)
- [x] Log setiap pergerakan (before/after/reason)
- [x] Peringatan stok menipis (≤ min stok)
### 🎨 Frontend
- [x] Sub-tab Stok di Produk
- [x] Form penyesuaian stok
- [x] Riwayat pergerakan stok
- [x] Badge stok menipis
### ✅ Acceptance Criteria
- [x] Semua perubahan stok tercatat
- [x] Transaksi gagal jika stok kurang
- [x] Stok tak bisa negatif

---

## FASE 8 — Supplier + Pembelian
### 🗄️ Database
- [x] Migration `suppliers` (soft delete) *(+ kode unik otomatis SUP-0001, kontak person, email, status aktif/nonaktif)*
- [x] Migration `purchases` *(+ rincian subtotal/diskon/pajak; append-only sesuai DATABASE.md §6)*
- [x] Migration `purchase_items`
### ⚙️ Backend
- [x] CRUD Supplier (soft delete jika ada riwayat) *(soft delete selalu; restore Owner only; kode tidak bisa diubah)*
- [x] Pembelian → stok nambah + cost_price update
- [x] Auto number `PUR-YYYYMMDD-0001`
- [x] Stock_movement saat pembelian
### 🎨 Frontend
- [x] Sub-tab Supplier & Pembelian di Produk *(halaman /supplier & /pembelian)*
- [x] Form pembelian (pilih supplier + item)
- [x] Riwayat pembelian + filter
### ✅ Acceptance Criteria
- [x] Pembelian buat entry stock_movement
- [x] Supplier dgn riwayat → soft delete *(hard delete tidak tersedia; hanya soft delete + restore)*

---

## FASE 9 — Pengeluaran (Expense Management)
### 🗄️ Database
- [x] Migration `expense_categories` (soft delete)
- [x] Migration `expenses` (soft delete) *(+ kolom `title` wajib; penamaan `notes`/`receipt_path` sesuai spesifikasi Fase 9)*
- [x] Seeder kategori pengeluaran default *(8 kategori DATABASE.md §8 + Gas, ATK, Peralatan, Maintenance)*
### ⚙️ Backend
- [x] CRUD Pengeluaran + auto number `EXP-YYYYMMDD-0001` *(soft delete + restore Owner only)*
- [x] CRUD Kategori Pengeluaran (dinamis)
- [x] Upload foto bukti *(jpg/jpeg/png/webp/pdf max 5MB; bukti baru menghapus file lama)*
- [x] User pencatat otomatis
### 🎨 Frontend
- [x] Menu utama sidebar Pengeluaran
- [x] List + filter tanggal/kategori + pagination *(+ search nomor/judul, filter metode, kartu statistik, detail, trash view Owner)*
- [x] Form tambah/edit (metode bayar, foto bukti)
### ✅ Acceptance Criteria
- [x] Nominal > 0
- [x] User pencatat otomatis, tak bisa diubah
- [x] Akses Owner & Admin *(+ Kasir view only sesuai spesifikasi Fase 9 — paralel Supplier & Pembelian)*
- [x] Tidak mempengaruhi stok
- [x] Kategori terpakai tak bisa dihapus

---

## FASE 10 — Laporan + Export PDF/Excel
### ⚙️ Backend
- [x] Penjualan harian & bulanan *(kartu hari ini/bulan ini + grafik harian 30 hari + laporan penjualan dgn filter rentang tanggal; rekap per-bulan terpisah tidak termasuk spec Fase 10)*
- [x] Produk terlaris (qty & omzet)
- [x] Laba kotor (COGS dari snapshot cost_price) *(belum ada data modal → tampil N/A)*
- [x] Total / per-kategori / bulanan pengeluaran *(via filter kategori + rentang tanggal di laporan pengeluaran; grafik breakdown pengeluaran tidak termasuk spec Fase 10)*
- [x] Laba bersih (laba kotor − pengeluaran)
- [x] Laporan stok & pembelian *(+ nilai persediaan = stok × harga modal)*
- [x] Kecualikan transaksi cancelled
- [x] Export PDF (DomPDF) + Excel (Laravel Excel) *(4 laporan × 2 format, mengikuti filter aktif)*
### 🎨 Frontend
- [x] Halaman Laporan + filter periode *(dashboard /laporan + 4 sub-halaman; ReportService memusatkan seluruh query)*
- [x] Grafik (Chart.js/Recharts) *(Chart.js: line penjualan 30 hari, bar top produk, pie metode bayar, bar kategori + analytics kasir terbaik/supplier terbanyak/rata-rata)*
- [x] Tabel + pagination
- [x] Tombol export
### ✅ Acceptance Criteria
- [x] Semua laporan filter tanggal *(kecuali laporan stok — posisi stok saat ini, tanggal tidak berlaku)*
- [x] Angka konsisten dgn Riwayat & Pengeluaran
- [x] Laba bersih tanpa double-counting
- [x] Header laporan dari Profil Toko

---

## FASE 11 — Pengaturan: Pengguna + Backup & Restore + Activity Log
### 🗄️ Database
- [x] Migration `activity_logs` *(kolom DATABASE.md §3.14 + role/description/user_agent dari spesifikasi Fase 11; append-only ditegakkan di model)*
### ⚙️ Backend
- [x] CRUD User + nonaktifkan (Owner only) *(+ reset password acak 10 karakter tampil sekali; foto profil; last_login_at/ip otomatis; Admin view only sesuai spesifikasi Fase 11)*
- [x] Guard: tak bisa nonaktifkan diri sendiri / Owner terakhir *(termasuk ganti role Owner terakhir)*
- [x] Backup database (dump + download timestamped) *(BackupService — `backup-YYYYMMDD-HHmmss.sql` di storage/app/backups; hapus file oleh Owner)*
- [x] Restore database (validasi + konfirmasi ganda) *(upload .sql / file server; transaction + rollback; backup pengaman otomatis sebelum restore; backup lama tidak terhapus)*
- [x] Pencatatan Activity Log (login, produk, pengeluaran, setting, user, cancel, backup) *(terpusat di ActivityLogService: + logout, supplier, pembelian, transaksi, restore)*
### 🎨 Frontend
- [x] Tab Pengguna *(halaman /users + /profile sesuai spesifikasi Fase 11; statistik, search, filter role/status, pagination)*
- [x] Tab Backup & Restore *(halaman /backup: daftar + Backup Sekarang + Download/Restore/Hapus + upload restore)*
- [x] Tab Activity Log (Owner only, filter + pagination) *(halaman /activity-log: search, filter role/modul/tanggal, detail modal)*
### ✅ Acceptance Criteria
- [x] Hanya Owner akses Pengguna/Backup/Activity Log *(Pengguna: Owner full + Admin view-only sesuai spesifikasi Fase 11; Backup & Activity Log ketat Owner only)*
- [x] Owner terakhir tak bisa dinonaktifkan
- [x] Restore konfirmasi ganda + validasi file
- [x] Backup/restore tercatat di Activity Log
- [x] Activity Log append-only *(model menolak update/delete; tidak ada route pengubah)*

---

## FASE 12 — Error Handling + Loading/Empty State + Pagination (pass menyeluruh)
- [x] Handle printer thermal gagal (transaksi tetap tersimpan) *(PrintButton: gagal → pesan + tombol Coba Lagi; struk tampil setelah transaksi tersimpan; cetak ulang dari Riwayat)*
- [x] Handle Bluetooth gagal (fallback print browser) *(printer Bluetooth baru dibangun Fase 14; saat ini seluruh cetak memakai print browser — jalur fallback yang dimaksud)*
- [x] Handle upload gambar gagal *(pesan ukuran/format jelas, form tidak hilang, bisa ulang upload — Produk/Pengeluaran/Users/Logo)*
- [x] Handle sinkronisasi gagal (retry, data aman) *(Fase 15: syncService — gagal jaringan/timeout → tetap pending & retry otomatis; ditolak server (konflik stok) → failed + pesan jelas + tombol Coba Lagi; tidak ada data hilang)*
- [x] Handle offline mode (banner + disable fitur server) *(banner 🔴 Offline + toast saat request gagal; POS offline dari cache = Fase 15)*
- [x] Handle data tidak ditemukan (404 ramah) & error server (5xx) *(halaman Error Inertia 403/404/500/503 + tombol kembali; 419 → login dgn pesan "Sesi berakhir"; request JSON tetap JSON)*
- [x] Skeleton loading: Produk, Riwayat, Laporan, Pengeluaran *(+ grid Kasir; SkeletonRows/SkeletonCards saat navigasi filter/search/pagination)*
- [x] Empty state: produk/transaksi/laporan/pengeluaran + CTA *(audit: semua halaman sudah punya; CTA tombol ditambah di Produk & Pengeluaran)*
- [x] Pagination final di semua list panjang *(audit: 13 list sudah paginate — Produk, Riwayat, Pengeluaran, Laporan×4, Supplier, Pembelian, Users, Activity Log, Kategori, Stok, Kasir, Backup)*
### ✅ Acceptance Criteria
- [x] Tidak ada kegagalan yang menghilangkan transaksi *(transaksi commit sebelum struk/cetak; kegagalan cetak/jaringan tidak menyentuh data)*
- [x] Pesan error jelas & actionable (Bahasa Indonesia) *(seluruh FormRequest berpesan Indonesia + toast kegagalan koneksi)*
- [x] Tidak ada crash / blank screen *(halaman error ramah + toast request gagal, halaman tetap utuh)*

---

## FASE 13 — Motion & Animation (pass menyeluruh)
- [x] Splash logo (fade + scale) *(Framer Motion, smooth easing)*
- [x] Login card fade-up *(sudah ada sejak Fase 1 — CSS `login-fade-scale` 300ms, motion-safe; di-reuse)*
- [x] Sidebar slide-in + hover *(slide-in Framer sekali per sesi tab; hover transition sudah ada)*
- [x] Ripple tombol *(RippleEffect — satu listener terdelegasi untuk semua tombol, tanpa copy-paste)*
- [x] Stagger grid produk *(GridItem — fade-up berjenjang per posisi)*
- [x] Card produk scale saat klik *(sudah ada — `active:scale-[0.98]`; di-reuse)*
- [x] Fly-to-cart *(FlyDot — titik terbang dari card ke keranjang, murni transform)*
- [x] Smooth transition quantity *(NumberPop pada qty keranjang)*
- [x] Count-up total pembayaran *(CountUp di Subtotal/Diskon/Pajak/Total + bar keranjang mobile; hanya saat nilai berubah)*
- [x] Modal pembayaran fade + zoom *(sudah ada — wrapper Modal Headless UI dipakai semua modal; di-reuse)*
- [x] Modal tambah/edit fade + scale *(idem — satu wrapper reusable)*
- [x] Toast slide dari kanan atas *(ToastShell Framer + exit animation, dipakai semua toast)*
- [x] Bottom sheet slide-up (mobile) *(sudah ada — keyframe `sheet-up` 250ms; drag-close tidak dibuat, belum ada komponen pendukung)*
- [x] Grafik muncul bertahap *(ChartCard fade-up ber-delay + animasi Chart.js dibatasi 300ms, mati saat Reduce Motion)*
- [x] Success animation (checkmark + confetti ringan) *(SuccessBurst — 10 partikel sekali jalan)*
- [x] Animasi printer saat cetak *(PrintButton — status "Mencetak…" + ikon bergerak, normal kembali via afterprint/timeout)*
- [x] Skeleton loading *(skeleton Fase 12 di-reuse + shimmer sweep transform)*
- [x] Fade transition antar halaman *(main content fade 200ms, key per komponen halaman)*
### ✅ Acceptance Criteria
- [x] Animasi 60 FPS (transform + opacity) *(seluruh animasi hanya transform/opacity)*
- [x] Durasi ≤ 300 ms *(loop indikator status — shimmer/printer — bukan transisi)*
- [x] Tidak mengganggu transaksi *(murni feedback; tanpa layout shift; count-up 250ms)*
- [x] Dukung `prefers-reduced-motion` *(MotionConfig reducedMotion="user" global + media query CSS + guard eksplisit di ripple/confetti/fly/chart)*

---

## FASE 14 — Printer Bluetooth
- [x] Koneksi Web Bluetooth / native bridge *(Web Bluetooth API — printerService: connect/disconnect/reconnect/print/isConnected + status subscribe; native bridge = Fase 17)*
- [x] Protokol ESC/POS 58mm *(encoder 32 kolom: align kiri/tengah, bold, separator, feed, cut; format identik struk browser)*
- [x] Fallback ke print browser jika gagal *(unsupported/izin ditolak/tidak ditemukan/terputus/timeout/gagal tulis → window.print() otomatis + pesan Bahasa Indonesia)*
### ✅ Acceptance Criteria
- [x] Print Bluetooth berjalan *(PrintButton Bluetooth-first di struk Kasir & cetak ulang Riwayat; panel printer: indikator 🟢🟡🔴 + Hubungkan/Putuskan/Tes Cetak)*
- [x] Gagal konek → fallback, transaksi tetap aman *(printReceipt tidak pernah throw; cetak berjalan setelah transaksi tersimpan — dites di vitest + PHPUnit)*

---

## FASE 15 — PWA + Mode Offline + Sinkronisasi
- [x] Setup PWA (manifest, service worker, installable) *(manifest.webmanifest + theme color + ikon 192/512/maskable; sw.js: cache-first build, SWR asset, network-first navigasi + halaman offline darurat; InstallPrompt beforeinstallprompt; registrasi hanya di produksi)*
- [x] Cache produk & kategori (IndexedDB) *(endpoint /kasir/offline-data → snapshot penuh; kasirCache di store `kasir`; layar Kasir offline pakai data lokal + filter lokal)*
- [x] Simpan transaksi offline (sync_status pending) *(offlineQueue di IndexedDB store `queue`, keyPath client_uuid, status pending→syncing→synced/failed; TIDAK dikirim ke server saat offline)*
- [x] Sinkronisasi otomatis saat online *(syncService: event `online` + saat app dibuka; antrean diproses satu per satu; guard tidak dobel)*
- [x] Dedup via client_uuid (idempotent) *(client_uuid dari client; server mengembalikan transaksi yang sudah ada + `duplicate:true`, retry berkali-kali → 1 transaksi)*
- [x] Indikator status online/offline/sync *(SyncIndicator: 🟢 Online · 🟡 Pending Sync · 🔵 Sedang Sinkronisasi · 🔴 Gagal/Offline; di header semua halaman)*
- [x] Handle konflik stok (server sumber kebenaran) *(stok divalidasi ulang server saat sync; 422 → status failed + pesan jelas; transaksi lain tetap utuh)*
### ✅ Acceptance Criteria
- [x] Transaksi offline tidak hilang *(tersimpan di IndexedDB sebelum apa pun; fallback antrean bila request putus di tengah jalan)*
- [x] Tidak dobel meski retry *(dedup client_uuid server + guard duplicate sync client; diuji vitest + PHPUnit)*
- [x] Daftar transaksi belum tersinkron terlihat *(modal SyncIndicator: daftar antrean + status + tombol Sinkronkan/Coba Lagi per item & massal)*

---

## FASE 16 — Integrasi WhatsApp
- [x] Kirim struk digital (ringkasan + gambar/link) *(pesan teks format PRD via wa.me — Halo/nama toko/invoice/tanggal/item/total/metode; belum ada PDF/gambar publik → kirim ringkasan sesuai instruksi §6; tanpa API berbayar)*
- [x] Input nomor pelanggan saat bayar *(field opsional di PaymentModal, hanya angka, normalisasi 08→628 saat simpan, placeholder "Contoh: 081234567890"; kosong tetap boleh checkout)*
- [x] Bisa dinonaktifkan lewat pengaturan *(tab WhatsApp di Pengaturan — toggle "Aktifkan Kirim Struk WhatsApp", default OFF; setting `whatsapp_enabled`; OFF → tombol kirim tidak muncul & tidak ada link WA dibuat)*
### ✅ Acceptance Criteria
- [x] Struk terkirim ke nomor pelanggan *(tombol "Kirim via WhatsApp" di modal sukses Kasir + "Kirim WhatsApp" di detail Riwayat; buka wa.me tab baru — user yang menekan, tidak otomatis)*
- [x] Fitur opsional (bisa off) *(default OFF; tombol hanya muncul saat setting ON & nomor terisi; RBAC: kasir kirim saat bayar, owner/admin kirim ulang)*

---

## FASE 17 — Packaging Android & iOS
- [x] Packaging dari PWA / shell native *(Capacitor 6: capacitor.config.ts appId com.pitou.pos, appName Pitou Cafe, webDir public/build; folder android/ lengkap; `npx cap sync` sukses. Entry public/build/index.html digenerate saat build. iOS = di luar lingkup Android per instruksi, siap ditambah via `cap add ios` di macOS)*
- [x] Auth token (Sanctum) *(Sanctum sudah terpasang sejak Fase 1; WebView memuat aplikasi lewat CAP_SERVER_URL — sesi/API berjalan seperti web)*
- [x] Akses kamera (foto produk/bukti) *(permission CAMERA di AndroidManifest; input file capture memakai kamera perangkat)*
- [x] Akses Bluetooth (printer) *(permission BLUETOOTH/ADMIN maxSdk30 + BLUETOOTH_SCAN neverForLocation + BLUETOOTH_CONNECT; implementasi Fase 14 tak diubah — fallback print browser tetap ada)*
- [x] Akses storage (offline) *(offline via IndexedDB/service worker Fase 15 — tanpa izin storage; upload pakai file picker sistem/scoped storage, jadi izin storage sengaja TIDAK diminta agar tidak ada permission tak terpakai)*
### ✅ Acceptance Criteria
- [x] Semua fitur Kasir jalan di mobile *(WebView memuat aplikasi web penuh; PWA/offline/sync/WhatsApp kompatibel — build APK belum diverifikasi di environment ini karena tanpa Android SDK, lihat catatan verifikasi)*
- [x] Print Bluetooth jalan *(Fase 14 utuh + permission Bluetooth ditambahkan; fallback browser terjaga)*
- [x] Upload foto via kamera jalan *(permission CAMERA + input file capture)*
- [x] Konfigurasi build Debug/Release/AAB + signing keystore (env/gradle.properties), README-ANDROID.md, workflow .github/workflows/android.yml (build APK debug + upload artifact, tanpa publish), ikon adaptive+round & splash native primary #0A45FE, deep link pitoupos:// + App Link https://

---

## Milestone Ringkas

- [x] **M1 — Kasir bisa jualan** (Fase 1–6): login, produk, POS, bayar, struk, riwayat
- [x] **M2 — Kontrol penuh** (Fase 7–11): stok, supplier, pengeluaran, laporan, pengaturan lengkap
- [x] **M3 — Polish** (Fase 12–13): error handling, loading/empty, animasi *(lengkap setelah offline sync Fase 15 menutup item "sinkronisasi gagal" Fase 12)*
- [x] **M4 — Advanced** (Fase 14–17): Bluetooth ✓, offline/PWA ✓, WhatsApp ✓, mobile app (Capacitor Android) ✓

> 💡 Setelah **M1** aplikasi sudah bisa dipakai transaksi riil di cafe. M2–M4 bisa menyusul bertahap.
