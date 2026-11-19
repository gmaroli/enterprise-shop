import { ErrorBanner } from '@/components/ui';
import { ProductForm } from '@/components/ProductForm';
import { requireAdmin } from '@/lib/session';

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">New product</h1>
      <ErrorBanner message={error} />
      <ProductForm />
    </div>
  );
}
