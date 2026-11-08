import Link from 'next/link';
import { formatCents } from '@shop/shared';
import { StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { requireUser } from '@/lib/session';
import type { Order } from '@/lib/types';

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: orderId } = await searchParams;
  const { token } = await requireUser();
  if (!orderId) return <p>No order specified.</p>;

  const order = await api<Order>(`/orders/${orderId}`, { token });
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
      <p className="mt-4 text-lg font-bold">{formatCents(order.totalCents)}</p>
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
