import Link from 'next/link';
import { StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { requireUser } from '@/lib/session';
import type { Order } from '@/lib/types';

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  const { token } = await requireUser();
  if (!orderId) return <p>No order specified.</p>;

  let order = await api<Order>(`/orders/${orderId}`, { token });
  if (order.status === 'PENDING') {
    // The webhook may be late or missing: ask Stripe directly and finish the order if it was paid.
    try {
      order = await api<Order>(`/orders/${orderId}/sync`, { method: 'POST', token });
    } catch {
      // Keep showing the pending state; the customer can refresh or use "Check payment status".
    }
  }
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-2xl font-bold">Thank you for your order</h1>
      <p className="mt-2 text-sm text-slate-600">Order {order.id}</p>
      <p className="mt-4">
        <StatusBadge status={order.status} />
      </p>
      {order.status === 'PENDING' && (
        <p className="mt-3 text-sm text-slate-600">
          We are confirming your payment. Refresh this page in a moment.
        </p>
      )}
      <p className="mt-4 text-lg font-bold">{formatMoney(order.totalCents, order.currency)}</p>
      <div className="mt-6 flex justify-center gap-4 text-sm">
        <Link href={`/orders/${order.id}`} className="text-indigo-700 underline">
          View order
        </Link>
        <Link href="/" className="text-indigo-700 underline">
          Keep shopping
        </Link>
      </div>
    </div>
  );
}
