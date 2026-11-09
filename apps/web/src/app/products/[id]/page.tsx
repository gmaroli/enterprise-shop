import { notFound } from 'next/navigation';
import { addToCartAction } from '@/app/actions';
import { ProductImage } from '@/components/ProductCard';
import { Button, ErrorBanner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { getRegion } from '@/lib/region';
import type { Product } from '@/lib/types';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> };

export default async function ProductPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error } = await searchParams;

  const region = await getRegion();
  let product: Product;
  try {
    product = await api<Product>(`/products/${id}?currency=${region.currency}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const soldOut = product.stock === 0;
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <ProductImage product={product} className="h-80 w-full rounded-lg" />
      <div>
        <span className="text-xs uppercase tracking-wide text-slate-500">{product.category}</span>
        <h1 className="mt-1 text-2xl font-bold">{product.name}</h1>
        <p className="mt-1 text-sm text-slate-500">SKU {product.sku}</p>
        <p className="mt-4 text-3xl font-bold">{formatMoney(product.displayPriceCents ?? product.priceCents, product.displayCurrency ?? 'USD')}</p>
        <p className="mt-4 text-slate-700">{product.description}</p>
        <p className={`mt-4 text-sm font-semibold ${soldOut ? 'text-red-600' : 'text-green-700'}`}>
          {soldOut ? 'Out of stock' : `${product.stock} in stock`}
        </p>

        <div className="mt-6">
          <ErrorBanner message={error} />
          <form action={addToCartAction} className="flex items-end gap-3">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="back" value={`/products/${product.id}`} />
            <label className="text-sm font-medium text-slate-700">
              Quantity
              <input
                name="quantity"
                type="number"
                min={1}
                max={99}
                defaultValue={1}
                disabled={soldOut}
                className="mt-1 block w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <Button type="submit" disabled={soldOut}>
              Add to cart
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
