import Link from 'next/link';
import { COUNTRY_NAMES, SUPPORTED_COUNTRIES } from '@shop/shared';
import { logoutAction, setCountryAction } from '@/app/actions';
import { api } from '@/lib/api';
import { getRegion } from '@/lib/region';
import { getToken, getUser } from '@/lib/session';
import type { Cart } from '@/lib/types';
import { Button } from './ui';

export async function Header() {
  const user = await getUser();
  const region = await getRegion();
  let cartCount = 0;
  if (user) {
    const token = await getToken();
    const cart = await api<Cart>('/cart', { token }).catch(() => null);
    cartCount = cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-indigo-700">
          Enterprise Shop
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-slate-700">
          <form action={setCountryAction} className="flex items-center gap-1.5 text-xs">
            <label htmlFor="region-country" className="sr-only">
              Country
            </label>
            <select
              id="region-country"
              name="country"
              defaultValue={region.source === 'selected' ? region.country : ''}
              className="rounded-md border border-slate-300 bg-white px-1.5 py-1"
            >
              <option value="">
                Auto ({region.country})
              </option>
              {SUPPORTED_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {COUNTRY_NAMES[c]}
                </option>
              ))}
            </select>
            <span className="font-semibold text-slate-600" title="Prices are shown and charged in this currency">
              {region.currency}
            </span>
            <button className="rounded-md border border-slate-300 px-2 py-1 font-semibold hover:bg-slate-100">Set</button>
          </form>
          <Link href="/">Shop</Link>
          {user && <Link href="/cart">Cart{cartCount > 0 ? ` (${cartCount})` : ''}</Link>}
          {user && <Link href="/orders">Orders</Link>}
          {user?.role === 'ADMIN' && <Link href="/admin/products">Admin</Link>}
          {user ? (
            <form action={logoutAction} className="flex items-center gap-3">
              <span className="text-slate-500">{user.name}</span>
              <Button variant="secondary" type="submit">
                Log out
              </Button>
            </form>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/register" className="rounded-md bg-indigo-600 px-3 py-1.5 text-white">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
