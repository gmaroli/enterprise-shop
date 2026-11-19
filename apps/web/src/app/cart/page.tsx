import Link from 'next/link';
import { checkoutAction, removeFromCartAction, updateCartAction } from '@/app/actions';
import { Button, ErrorBanner, Field } from '@/components/ui';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { getRegion } from '@/lib/region';
import { requireUser } from '@/lib/session';
import type { Cart } from '@/lib/types';

type SearchParams = Promise<{ coupon?: string; error?: string }>;

export default async function CartPage({ searchParams }: { searchParams: SearchParams }) {
  const { coupon = '', error } = await searchParams;
  const { token, user } = await requireUser();
  const region = await getRegion();
  const query = new URLSearchParams({ currency: region.currency });
  if (coupon) query.set('coupon', coupon);
  const cart = await api<Cart>(`/cart?${query}`, { token });
  const fmt = (cents: number) => formatMoney(cents, cart.currency);
  const { totals } = cart;
  const blocked = cart.items.some((i) => !i.available);

  if (cart.items.length === 0) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <Link href="/" className="mt-4 inline-block text-indigo-700 underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Your cart</h1>
      <ErrorBanner message={error} />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {cart.items.map((item) => (
              <li
                key={item.productId}
                className="flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-slate-500">
                    {fmt(item.unitPriceCents)} each · SKU {item.sku}
                  </p>
                  {!item.available && (
                    <p className="text-sm font-semibold text-red-600">
                      Not enough stock ({item.stock} available). Reduce the quantity.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <form action={updateCartAction} className="flex items-center gap-2">
                    <input type="hidden" name="productId" value={item.productId} />
                    <input type="hidden" name="coupon" value={coupon} />
                    <input
                      name="quantity"
                      type="number"
                      min={0}
                      max={99}
                      defaultValue={item.quantity}
                      aria-label={`Quantity for ${item.name}`}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <Button variant="secondary" type="submit">
                      Update
                    </Button>
                  </form>
                  <form action={removeFromCartAction}>
                    <input type="hidden" name="productId" value={item.productId} />
                    <Button variant="secondary" type="submit">
                      Remove
                    </Button>
                  </form>
                  <span className="w-24 text-right font-semibold">{fmt(item.lineTotalCents)}</span>
                </div>
              </li>
            ))}
          </ul>

          <form action="/cart" className="mt-4 flex gap-2">
            <input
              name="coupon"
              defaultValue={coupon}
              placeholder="Coupon code"
              aria-label="Coupon code"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <Button variant="secondary" type="submit">
              Apply coupon
            </Button>
          </form>
          {coupon && !totals.appliedCoupon && (
            <p className="mt-2 text-sm text-red-600">Invalid coupon code.</p>
          )}
          {totals.appliedCoupon && (
            <p className="mt-2 text-sm text-green-700">Coupon {totals.appliedCoupon} applied.</p>
          )}
        </div>

        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Order summary</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Subtotal" value={fmt(totals.subtotalCents)} />
            {totals.discountCents > 0 && (
              <Row label="Discount" value={`-${fmt(totals.discountCents)}`} />
            )}
            <Row
              label="Shipping"
              value={totals.shippingCents === 0 ? 'Free' : fmt(totals.shippingCents)}
            />
            <Row label="Tax (8%)" value={fmt(totals.taxCents)} />
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{fmt(totals.totalCents)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-slate-500">
            Free shipping on orders of {fmt(cart.shippingRules.freeShippingThresholdCents)} or more.
            Prices are shown and charged in {cart.currency}.
          </p>

          <form action={checkoutAction} className="mt-5 space-y-3">
            <h3 className="font-semibold">Shipping address</h3>
            <input type="hidden" name="couponCode" value={coupon} />
            <Field label="Full name" name="name" defaultValue={user.name} />
            <Field label="Address" name="line1" />
            <Field label="City" name="city" />
            <Field label="Postal code" name="postalCode" />
            <Field label="Country (2-letter code)" name="country" defaultValue={region.country} />
            <Button type="submit" disabled={blocked} className="w-full">
              Pay with Stripe
            </Button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-600">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
