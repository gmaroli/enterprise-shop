import { saveRateAction } from '@/app/actions';
import { Button, ErrorBanner } from '@/components/ui';
import { api } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import type { ExchangeRate } from '@/lib/types';

export default async function AdminRatesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  await requireAdmin();
  const rates = await api<ExchangeRate[]>('/rates');

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Exchange rates</h1>
      <p className="mb-6 text-sm text-slate-600">
        Units of each currency per 1 USD. Product prices are stored in USD and converted with these rates; each order keeps the
        rate it was charged at. USD is the base currency and cannot be changed.
      </p>
      <ErrorBanner message={error} />
      <table className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-4 py-2">Currency</th>
            <th className="px-4 py-2">Per 1 USD</th>
            <th className="px-4 py-2">Source</th>
            <th className="px-4 py-2">Updated</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rates.map((r) => (
            <tr key={r.currency}>
              <td className="px-4 py-2 font-semibold">{r.currency}</td>
              <td className="px-4 py-2">
                {r.currency === 'USD' ? (
                  r.perUsd
                ) : (
                  <form action={saveRateAction} id={`rate-${r.currency}`} className="flex items-center gap-2">
                    <input type="hidden" name="currency" value={r.currency} />
                    <input
                      name="perUsd"
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      defaultValue={r.perUsd}
                      aria-label={`${r.currency} per USD`}
                      className="w-28 rounded-md border border-slate-300 px-2 py-1"
                    />
                    <Button variant="secondary" type="submit">
                      Save
                    </Button>
                  </form>
                )}
              </td>
              <td className="px-4 py-2">{r.source}</td>
              <td className="px-4 py-2">{new Date(r.updatedAt).toLocaleString()}</td>
              <td className="px-4 py-2" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
