<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8"><title>{{ $title }}</title></head>
<body>
@include('reports.partials.header')

<table class="report">
    <thead>
        <tr>
            <th>Produk</th>
            <th>Kategori</th>
            <th class="center">Stok</th>
            <th class="center">Minimum</th>
            <th>Status</th>
            <th class="num">Harga Modal</th>
            <th class="num">Harga Jual</th>
            <th class="num">Nilai Persediaan</th>
        </tr>
    </thead>
    <tbody>
        @forelse ($products as $product)
            <tr>
                <td>{{ $product->name }}</td>
                <td>{{ $product->category->name }}</td>
                <td class="center">{{ $product->track_stock ? $product->stock : '-' }}</td>
                <td class="center">{{ $product->track_stock ? $product->min_stock : '-' }}</td>
                <td>{{ $product->status === 'aktif' ? 'Aktif' : 'Habis' }}</td>
                <td class="num">{{ number_format($product->cost_price ?? 0, 0, ',', '.') }}</td>
                <td class="num">{{ number_format($product->price, 0, ',', '.') }}</td>
                <td class="num">{{ number_format($product->stock * ($product->cost_price ?? 0), 0, ',', '.') }}</td>
            </tr>
        @empty
            <tr><td colspan="8" class="empty">Belum ada produk.</td></tr>
        @endforelse
    </tbody>
</table>

<p class="summary">
    Jumlah produk: {{ $products->count() }} &nbsp;·&nbsp;
    Total nilai persediaan: Rp {{ number_format($totalValue, 0, ',', '.') }}
</p>
</body>
</html>
