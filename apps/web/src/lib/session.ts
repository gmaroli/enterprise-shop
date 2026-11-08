import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, ApiError } from './api';
import type { User } from './types';

export const TOKEN_COOKIE = 'shop_token';

export async function getToken(): Promise<string | null> {
  return (await cookies()).get(TOKEN_COOKIE)?.value ?? null;
}

export async function setToken(token: string) {
  (await cookies()).set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: (process.env.WEB_URL ?? '').startsWith('https://'),
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearToken() {
  (await cookies()).delete(TOKEN_COOKIE);
}

export async function getUser(): Promise<User | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    return await api<User>('/auth/me', { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function requireUser(): Promise<{ user: User; token: string }> {
  const token = await getToken();
  const user = await getUser();
  if (!user || !token) redirect('/login');
  return { user, token };
}

export async function requireAdmin(): Promise<{ user: User; token: string }> {
  const session = await requireUser();
  if (session.user.role !== 'ADMIN') redirect('/');
  return session;
}
