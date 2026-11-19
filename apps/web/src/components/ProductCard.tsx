import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import type { Product } from '@/lib/types';

export function ProductImage({
  product,
  className = '',
}: {
  product: Product;
  className?: string;
}) {
  if (product.imageUrl) {
    return (
      <img src={product.imageUrl} alt={product.name} className={`object-cover ${className}`} />
    );
  }
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center bg-gradient-to-br from-indigo-100 to-slate-200 text-4xl font-bold text-indigo-400 ${className}`}
    >
      {product.name.slice(0, 1)}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.stock === 0;
  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <ProductImage product={product} className="h-40 w-full" />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-xs uppercase tracking-wide text-slate-500">{product.category}</span>
        <h3 className="font-semibold group-hover:text-indigo-700">{product.name}</h3>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-bold">
            {formatMoney(
              product.displayPriceCents ?? product.priceCents,
              product.displayCurrency ?? 'USD',
            )}
          </span>
          {soldOut ? (
            <span className="text-xs font-semibold text-red-600">Out of stock</span>
          ) : product.stock <= 10 ? (
            <span className="text-xs font-semibold text-amber-600">Only {product.stock} left</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
