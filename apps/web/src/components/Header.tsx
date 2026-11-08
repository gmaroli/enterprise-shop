import Link from 'next/link';
import { logoutAction } from '@/app/actions';
import { api } from '@/lib/api';
import { getToken, getUser } from '@/lib/session';
import type { Cart } from '@/lib/types';
import { Button } from './ui';

export async function Header() {
  const user = await getUser();
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
