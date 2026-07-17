<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8"><title>{{ $title }}</title></head>
<body>
@include('reports.partials.header')

<table class="report">
    <thead>
        <tr>
            <th>Nomor</th>
            <th>Tanggal</th>
            <th>Kasir</th>
            <th class="center">Item</th>
            <th class="num">Subtotal</th>
            <th class="num">Diskon</th>
            <th class="num">Pajak</th>
            <th class="num">Total</th>
            <th>Status</th>
        </tr>
    </thead>
    <tbody>
        @forelse ($transactions as $transaction)
            <tr>
                <td>{{ $transaction->invoice_number }}</td>
                <td>{{ $transaction->created_at->format('d/m/Y H:i') }}</td>
                <td>{{ $transaction->user->name }}</td>
                <td class="center">{{ $transaction->items_count }}</td>
                <td class="num">{{ number_format($transaction->subtotal, 0, ',', '.') }}</td>
                <td class="num">{{ number_format($transaction->discount, 0, ',', '.') }}</td>
                <td class="num">{{ number_format($transaction->tax_amount, 0, ',', '.') }}</td>
                <td class="num">{{ number_format($transaction->total, 0, ',', '.') }}</td>
                <td>{{ $transaction->status === 'paid' ? 'Lunas' : 'Dibatalkan' }}</td>
            </tr>
        @empty
            <tr><td colspan="9" class="empty">Belum ada data untuk periode ini.</td></tr>
        @endforelse
    </tbody>
</table>

<p class="summary">
    Jumlah transaksi: {{ $summary['count'] }} &nbsp;·&nbsp;
    Total omzet (lunas): Rp {{ number_format($summary['total'], 0, ',', '.') }}
</p>
</body>
</html>
