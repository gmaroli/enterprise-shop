import { notFound } from 'next/navigation';
import { ErrorBanner } from '@/components/ui';
import { ProductForm } from '@/components/ProductForm';
import { api, ApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import type { Product } from '@/lib/types';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> };

export default async function EditProductPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error } = await searchParams;
  const { token } = await requireAdmin();

  let product: Product;
  try {
    product = await api<Product>(`/admin/products/${id}`, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Edit {product.name}</h1>
      <ErrorBanner message={error} />
      <ProductForm product={product} />
    </div>
  );
}
