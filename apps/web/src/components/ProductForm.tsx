import { saveProductAction } from '@/app/actions';
import { centsToDollars } from '@/lib/money';
import type { Product } from '@/lib/types';
import { Button, Field } from './ui';

export function ProductForm({ product }: { product?: Product }) {
  return (
    <form action={saveProductAction} className="max-w-xl space-y-4">
      {product && <input type="hidden" name="id" value={product.id} />}
      <Field label="SKU" name="sku" defaultValue={product?.sku} />
      <Field label="Name" name="name" defaultValue={product?.name} />
      <label className="block text-sm font-medium text-slate-700">
        Description
        <textarea
          name="description"
          defaultValue={product?.description}
          rows={3}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Price (USD)"
          name="price"
          defaultValue={product ? centsToDollars(product.priceCents) : ''}
          placeholder="19.99"
        />
        <Field label="Stock" name="stock" type="number" defaultValue={product?.stock ?? 0} />
      </div>
      <Field label="Category" name="category" defaultValue={product?.category} />
      <Field
        label="Image URL (optional)"
        name="imageUrl"
        type="url"
        required={false}
        defaultValue={product?.imageUrl ?? ''}
      />
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" name="active" defaultChecked={product?.active ?? true} />
        Active (visible in the shop)
      </label>
      <Button type="submit">{product ? 'Save changes' : 'Create product'}</Button>
    </form>
  );
}
