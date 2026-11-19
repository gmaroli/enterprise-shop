import { syncOrderAction } from '@/app/actions';
import { Button, ErrorBanner, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { requireUser } from '@/lib/session';
import type { Order } from '@/lib/types';

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { token } = await requireUser();
  const order = await api<Order>(`/orders/${id}`, { token });
  const fmt = (cents: number) => formatMoney(cents, order.currency);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Order {order.id}</h1>
        <StatusBadge status={order.status} />
      </div>
      <ErrorBanner message={error} />
      {order.status === 'PENDING' && (
        <form
          action={syncOrderAction}
          className="mb-4 flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"
        >
          <input type="hidden" name="orderId" value={order.id} />
          <span className="flex-1 text-amber-900">
            Payment not confirmed yet. If you already paid, check the status with Stripe.
          </span>
          <Button variant="secondary" type="submit">
            Check payment status
          </Button>
        </form>
      )}
      <p className="text-sm text-slate-500">Placed {new Date(order.createdAt).toLocaleString()}</p>
      {order.paidAt && (
        <p className="text-sm text-slate-500">Paid {new Date(order.paidAt).toLocaleString()}</p>
      )}
      {order.currency.toLowerCase() !== 'usd' && (
        <p className="text-sm text-slate-500">
          Charged in {order.currency.toUpperCase()} (1 USD = {Number(order.fxRate)}{' '}
          {order.currency.toUpperCase()} at the time of purchase)
        </p>
      )}

      <ul className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between p-4 text-sm">
            <span>
              {i.name} × {i.quantity}
            </span>
            <span>{fmt(i.unitPriceCents * i.quantity)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-1 text-sm">
        <Line label="Subtotal" value={fmt(order.subtotalCents)} />
        {order.discountCents > 0 && (
          <Line label={`Discount (${order.couponCode})`} value={`-${fmt(order.discountCents)}`} />
        )}
        <Line label="Shipping" value={fmt(order.shippingCents)} />
        <Line label="Tax" value={fmt(order.taxCents)} />
        <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
          <dt>Total</dt>
          <dd>{fmt(order.totalCents)}</dd>
        </div>
      </dl>

      <h2 className="mt-6 font-semibold">Ship to</h2>
      <address className="text-sm not-italic text-slate-700">
        {order.shippingName}
        <br />
        {order.shippingLine1}
        <br />
        {order.shippingCity} {order.shippingPostalCode}, {order.shippingCountry}
      </address>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-600">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
