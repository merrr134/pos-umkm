import { ReceiptProfile, ReceiptTransaction } from '@/Pages/Kasir/kasir';

/**
 * Encoder ESC/POS untuk thermal printer 58mm (Fase 14 — PRD 5.5).
 *
 * Kertas 58mm = 32 kolom pada font standar. Layout mengikuti persis
 * komponen <Receipt /> (struk browser): header toko di tengah, info
 * transaksi label–nilai, daftar item dengan catatan, ringkasan sampai
 * TOTAL, lalu footer dari Profil Toko — desain struk tidak berubah.
 */

/** Lebar baris printer 58mm pada font standar ESC/POS. */
export const LINE_WIDTH = 32;

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/**
 * Builder perintah ESC/POS. Teks di-encode sebagai byte tunggal
 * (ASCII); karakter di luar 0x20–0x7E diganti '?' karena code page
 * printer thermal berbeda-beda antar merek — teks struk (Bahasa
 * Indonesia + angka id-ID) seluruhnya ASCII.
 */
export class EscPosEncoder {
    private bytes: number[] = [];

    /** ESC @ — reset printer ke kondisi awal. */
    init(): this {
        this.bytes.push(ESC, 0x40);
        return this;
    }

    /** ESC a 0 — rata kiri. */
    alignLeft(): this {
        this.bytes.push(ESC, 0x61, 0x00);
        return this;
    }

    /** ESC a 1 — rata tengah. */
    alignCenter(): this {
        this.bytes.push(ESC, 0x61, 0x01);
        return this;
    }

    /** ESC E n — tebal on/off. */
    bold(on: boolean): this {
        this.bytes.push(ESC, 0x45, on ? 0x01 : 0x00);
        return this;
    }

    /** Teks mentah tanpa ganti baris. */
    text(value: string): this {
        for (const char of value) {
            const code = char.codePointAt(0) ?? 0x3f;
            this.bytes.push(code >= 0x20 && code <= 0x7e ? code : 0x3f);
        }
        return this;
    }

    /** Satu baris teks + line feed. */
    line(value = ''): this {
        return this.text(value).newline();
    }

    /** LF — ganti baris. */
    newline(): this {
        this.bytes.push(LF);
        return this;
    }

    /** Garis pemisah selebar kertas (padanan .receipt-sep). */
    separator(): this {
        return this.line('-'.repeat(LINE_WIDTH));
    }

    /** ESC d n — maju n baris kertas. */
    feed(lines: number): this {
        this.bytes.push(ESC, 0x64, Math.max(0, Math.min(255, lines)));
        return this;
    }

    /**
     * GS V 66 0 — partial cut. Printer 58mm tanpa pemotong mengabaikan
     * perintah ini, jadi aman dikirim ke semua printer.
     */
    cut(): this {
        this.bytes.push(GS, 0x56, 0x42, 0x00);
        return this;
    }

    /** Baris dua kolom: label kiri, nilai rata kanan, lebar 32. */
    row(left: string, right: string): this {
        const space = LINE_WIDTH - right.length;
        if (left.length >= space) {
            // Label kepanjangan → nilai turun ke baris sendiri rata kanan
            for (const part of wrapText(left, LINE_WIDTH)) this.line(part);
            return this.line(right.padStart(LINE_WIDTH));
        }
        return this.line(left.padEnd(space) + right);
    }

    encode(): Uint8Array {
        return Uint8Array.from(this.bytes);
    }
}

/** Pecah teks per kata agar muat lebar kolom; kata panjang dipotong. */
export function wrapText(value: string, width: number): string[] {
    const lines: string[] = [];
    let current = '';

    for (const word of value.split(/\s+/).filter((w) => w !== '')) {
        let piece = word;
        while (piece.length > width) {
            if (current !== '') {
                lines.push(current);
                current = '';
            }
            lines.push(piece.slice(0, width));
            piece = piece.slice(width);
        }
        if (current === '') {
            current = piece;
        } else if (current.length + 1 + piece.length <= width) {
            current += ' ' + piece;
        } else {
            lines.push(current);
            current = piece;
        }
    }

    if (current !== '') lines.push(current);
    return lines.length > 0 ? lines : [''];
}

function formatNumber(value: number): string {
    return value.toLocaleString('id-ID');
}

/** Format tanggal sama dengan struk browser (ReceiptModal). */
function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Susun struk transaksi menjadi bytes ESC/POS — isi & urutan identik
 * dengan komponen <Receipt /> agar hasil Bluetooth sama dengan browser.
 */
export function encodeReceipt(
    receipt: ReceiptTransaction,
    profile: ReceiptProfile,
): Uint8Array {
    const enc = new EscPosEncoder().init();
    const isCash = receipt.payment_method === 'tunai';

    // Header toko — rata tengah (logo gambar dilewati: teks saja)
    enc.alignCenter().bold(true);
    for (const part of wrapText(profile.name, LINE_WIDTH)) enc.line(part);
    enc.bold(false);
    if (profile.phone) {
        for (const part of wrapText(`Telp: ${profile.phone}`, LINE_WIDTH)) {
            enc.line(part);
        }
    }
    if (profile.address) {
        for (const part of wrapText(profile.address, LINE_WIDTH)) {
            enc.line(part);
        }
    }

    enc.alignLeft().separator();

    // Info transaksi
    enc.row('No', receipt.invoice_number);
    enc.row('Tanggal', formatDateTime(receipt.date));
    enc.row('Kasir', receipt.kasir);

    enc.separator();

    // Daftar item — nama, catatan, qty x harga, subtotal kanan
    for (const item of receipt.items) {
        for (const part of wrapText(item.product_name, LINE_WIDTH)) {
            enc.line(part);
        }
        if (item.note) {
            for (const part of wrapText(`* ${item.note}`, LINE_WIDTH - 2)) {
                enc.line(`  ${part}`);
            }
        }
        enc.row(
            `${item.quantity} x ${formatNumber(item.price)}`,
            formatNumber(item.subtotal),
        );
    }

    enc.separator();

    // Ringkasan — baris pajak tidak muncul jika pajak OFF (PRD 5.13.B)
    enc.row('Subtotal', formatNumber(receipt.subtotal));
    if (receipt.discount > 0) {
        enc.row('Diskon', `-${formatNumber(receipt.discount)}`);
    }
    if (receipt.tax_name !== null) {
        enc.row(
            `${receipt.tax_name} (${receipt.tax_percent}%)`,
            formatNumber(receipt.tax_amount),
        );
    }
    if (receipt.rounding !== 0) {
        enc.row(
            'Pembulatan',
            `${receipt.rounding > 0 ? '' : '-'}${formatNumber(Math.abs(receipt.rounding))}`,
        );
    }
    enc.bold(true).row('TOTAL', formatNumber(receipt.total)).bold(false);
    enc.row(
        `Bayar (${receipt.payment_method_label})`,
        formatNumber(isCash ? (receipt.paid_amount ?? 0) : receipt.total),
    );
    if (isCash) {
        enc.row('Kembalian', formatNumber(receipt.change_amount ?? 0));
    }

    // Footer Struk dari Profil Toko
    if (profile.footer) {
        enc.separator().alignCenter();
        for (const part of wrapText(profile.footer, LINE_WIDTH)) {
            enc.line(part);
        }
        enc.alignLeft();
    }

    return enc.feed(3).cut().encode();
}

/** Struk singkat untuk tombol "Tes Cetak" pada panel printer. */
export function encodeTestPrint(storeName: string): Uint8Array {
    return new EscPosEncoder()
        .init()
        .alignCenter()
        .bold(true)
        .line(storeName)
        .bold(false)
        .line('Tes cetak berhasil')
        .line(
            new Date().toLocaleString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            }),
        )
        .alignLeft()
        .separator()
        .feed(3)
        .cut()
        .encode();
}
