import Link from 'next/link';
import { StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import type { Order } from '@/lib/types';

export default async function AdminOrdersPage() {
  const { token } = await requireAdmin();
  const orders = await api<Order[]>('/orders?all=true', { token });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">All orders</h1>
      <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-4 py-2">Order</th>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Customer</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-2">
                <Link href={`/orders/${o.id}`} className="font-mono text-xs text-indigo-700">
                  {o.id}
                </Link>
              </td>
              <td className="px-4 py-2">{new Date(o.createdAt).toLocaleString()}</td>
              <td className="px-4 py-2">{o.shippingName}</td>
              <td className="px-4 py-2">
                <StatusBadge status={o.status} />
              </td>
              <td className="px-4 py-2 text-right">{formatMoney(o.totalCents, o.currency)} <span className="text-xs text-slate-500">{o.currency.toUpperCase()}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
