import Link from 'next/link';
import { formatCents } from '@shop/shared';
import { deactivateProductAction } from '@/app/actions';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import type { ProductPage } from '@/lib/types';

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const { page = '1', q = '' } = await searchParams;
  const { token } = await requireAdmin();
  const qs = new URLSearchParams({ page, pageSize: '20' });
  if (q) qs.set('q', q);
  const data = await api<ProductPage>(`/admin/products?${qs}`, { token });
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="flex gap-3">
          <Link href="/admin/rates" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">
            Exchange rates
          </Link>
          <Link href="/admin/orders" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">
            All orders
          </Link>
          <Link href="/admin/products/new" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
            New product
          </Link>
        </div>
      </div>

      <form action="/admin/products" className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search SKU or name"
          aria-label="Search products"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <Button variant="secondary" type="submit">
          Search
        </Button>
      </form>

      <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-4 py-2">SKU</th>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2">Price (USD)</th>
            <th className="px-4 py-2">Stock</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {data.items.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2 font-mono text-xs">{p.sku}</td>
              <td className="px-4 py-2">{p.name}</td>
              <td className="px-4 py-2">{p.category}</td>
              <td className="px-4 py-2">{formatCents(p.priceCents)}</td>
              <td className="px-4 py-2">{p.stock}</td>
              <td className="px-4 py-2">{p.active ? 'Active' : 'Inactive'}</td>
              <td className="flex gap-2 px-4 py-2">
                <Link href={`/admin/products/${p.id}`} className="text-indigo-700 underline">
                  Edit
                </Link>
                {p.active && (
                  <form action={deactivateProductAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="text-red-600 underline">Deactivate</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pages > 1 && (
        <nav className="mt-4 flex gap-4 text-sm">
          {data.page > 1 && <Link href={`/admin/products?page=${data.page - 1}${q ? `&q=${q}` : ''}`}>Previous</Link>}
          <span>
            Page {data.page} of {pages}
          </span>
          {data.page < pages && <Link href={`/admin/products?page=${data.page + 1}${q ? `&q=${q}` : ''}`}>Next</Link>}
        </nav>
      )}
    </div>
  );
}
