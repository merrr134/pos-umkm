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
            <th>Supplier</th>
            <th class="center">Jumlah Item</th>
            <th class="num">Total</th>
        </tr>
    </thead>
    <tbody>
        @forelse ($purchases as $purchase)
            <tr>
                <td>{{ $purchase->invoice_number }}</td>
                <td>{{ $purchase->purchase_date->format('d/m/Y') }}</td>
                <td>{{ $purchase->supplier->name }}</td>
                <td class="center">{{ $purchase->items_count }}</td>
                <td class="num">{{ number_format($purchase->total, 0, ',', '.') }}</td>
            </tr>
        @empty
            <tr><td colspan="5" class="empty">Belum ada data untuk periode ini.</td></tr>
        @endforelse
    </tbody>
</table>

<p class="summary">
    Jumlah pembelian: {{ $purchases->count() }} &nbsp;·&nbsp;
    Total: Rp {{ number_format($purchases->sum('total'), 0, ',', '.') }}
</p>
</body>
</html>
