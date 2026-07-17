<?php

namespace App\Http\Controllers;

use App\Http\Requests\ExpenseCategoryRequest;
use App\Models\ExpenseCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;

class ExpenseCategoryController extends Controller
{
    /**
     * Kategori Pengeluaran dinamis (PRD 5.10) — Owner/Admin bisa
     * menambah, mengedit, menonaktifkan (dijaga middleware role).
     */
    public function store(ExpenseCategoryRequest $request): RedirectResponse
    {
        ExpenseCategory::create($request->validated());

        return back()->with('success', 'Kategori pengeluaran berhasil ditambahkan.');
    }

    public function update(ExpenseCategoryRequest $request, ExpenseCategory $expenseCategory): RedirectResponse
    {
        $expenseCategory->update($request->validated());

        return back()->with('success', 'Kategori pengeluaran berhasil diperbarui.');
    }

    /**
     * Hapus kategori (soft delete) — kategori yang masih dipakai
     * pengeluaran (termasuk yang terhapus) tidak bisa dihapus
     * (RESTRICT, pola sama Kategori Produk).
     */
    public function destroy(ExpenseCategory $expenseCategory): RedirectResponse
    {
        if ($expenseCategory->expenses()->withTrashed()->exists()) {
            throw ValidationException::withMessages([
                'kategori' => 'Kategori masih digunakan oleh pengeluaran dan tidak bisa dihapus.',
            ]);
        }

        $expenseCategory->delete();

        return back()->with('success', 'Kategori pengeluaran berhasil dihapus.');
    }
}
