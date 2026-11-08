import Link from 'next/link';
import { formatCents } from '@shop/shared';
import { StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { requireUser } from '@/lib/session';
import type { Order } from '@/lib/types';

export default async function OrdersPage() {
  const { token } = await requireUser();
  const orders = await api<Order[]>('/orders', { token });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Your orders</h1>
      {orders.length === 0 ? (
        <p className="text-slate-600">You have not placed any orders yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between p-4">
              <div>
                <Link href={`/orders/${o.id}`} className="font-semibold text-indigo-700">
                  {o.id}
                </Link>
                <p className="text-sm text-slate-500">{new Date(o.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-4">
                <StatusBadge status={o.status} />
                <span className="font-semibold">{formatCents(o.totalCents)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
