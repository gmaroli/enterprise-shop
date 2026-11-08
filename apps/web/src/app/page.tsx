import Link from 'next/link';
import { api } from '@/lib/api';
import { ProductCard } from '@/components/ProductCard';
import type { ProductPage } from '@/lib/types';

type SearchParams = Promise<{ q?: string; category?: string; page?: string }>;

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const { q = '', category = '', page = '1' } = await searchParams;
  const qs = new URLSearchParams({ page, pageSize: '12' });
  if (q) qs.set('q', q);
  if (category) qs.set('category', category);

  const [products, categories] = await Promise.all([
    api<ProductPage>(`/products?${qs}`),
    api<string[]>('/products/categories'),
  ]);
  const pages = Math.max(1, Math.ceil(products.total / products.pageSize));
  const current = products.page;

  const link = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    for (const [key, value] of Object.entries(overrides)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const s = params.toString();
    return s ? `/?${s}` : '/';
  };

  return (
    <div>
      <form action="/" className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search products"
          aria-label="Search products"
          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        {category && <input type="hidden" name="category" value={category} />}
        <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Search</button>
      </form>

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link
          href={link({ category: '', page: '' })}
          className={`rounded-full border px-3 py-1 ${!category ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'}`}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c}
            href={link({ category: c, page: '' })}
            className={`rounded-full border px-3 py-1 ${category === c ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'}`}
          >
            {c}
          </Link>
        ))}
      </div>

      <p className="mb-4 text-sm text-slate-600">
        {products.total} product{products.total === 1 ? '' : 's'}
      </p>

      {products.items.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-10 text-center text-slate-500">
          No products match your search.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-4 text-sm">
          {current > 1 && <Link href={link({ page: String(current - 1) })}>Previous</Link>}
          <span>
            Page {current} of {pages}
          </span>
          {current < pages && <Link href={link({ page: String(current + 1) })}>Next</Link>}
        </nav>
      )}
    </div>
  );
}
