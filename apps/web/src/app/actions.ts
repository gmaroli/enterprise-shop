'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  checkoutSchema,
  loginSchema,
  productInputSchema,
  registerSchema,
} from '@shop/shared';
import { api, ApiError, errorMessage } from '@/lib/api';
import { dollarsToCents } from '@/lib/money';
import { clearToken, getToken, requireAdmin, requireUser, setToken } from '@/lib/session';

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

function fail(path: string, message: string): never {
  const sep = path.includes('?') ? '&' : '?';
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

export async function registerAction(form: FormData) {
  const parsed = registerSchema.safeParse({
    email: text(form, 'email'),
    password: text(form, 'password'),
    name: text(form, 'name'),
  });
  if (!parsed.success) fail('/register', parsed.error.issues.map((i) => i.message).join('; '));

  try {
    const session = await api<{ accessToken: string }>('/auth/register', { body: parsed.data });
    await setToken(session.accessToken);
  } catch (error) {
    fail('/register', errorMessage(error));
  }
  redirect('/');
}

export async function loginAction(form: FormData) {
  const parsed = loginSchema.safeParse({ email: text(form, 'email'), password: text(form, 'password') });
  if (!parsed.success) fail('/login', 'Enter a valid email and password');

  try {
    const session = await api<{ accessToken: string }>('/auth/login', { body: parsed.data });
    await setToken(session.accessToken);
  } catch (error) {
    fail('/login', errorMessage(error));
  }
  redirect('/');
}

export async function logoutAction() {
  await clearToken();
  redirect('/');
}

export async function addToCartAction(form: FormData) {
  const productId = text(form, 'productId');
  const quantity = Number(text(form, 'quantity') || '1');
  const back = text(form, 'back') || '/';
  const token = await getToken();
  if (!token) redirect('/login');

  try {
    await api('/cart/items', { token, body: { productId, quantity } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    fail(back, errorMessage(error));
  }
  revalidatePath('/', 'layout');
  redirect('/cart');
}

export async function updateCartAction(form: FormData) {
  const { token } = await requireUser();
  const productId = text(form, 'productId');
  const quantity = Number(text(form, 'quantity'));
  const coupon = text(form, 'coupon');
  const back = coupon ? `/cart?coupon=${encodeURIComponent(coupon)}` : '/cart';

  try {
    if (quantity <= 0) {
      await api(`/cart/items/${productId}`, { method: 'DELETE', token });
    } else {
      await api(`/cart/items/${productId}`, { method: 'PATCH', token, body: { quantity } });
    }
  } catch (error) {
    fail(back, errorMessage(error));
  }
  revalidatePath('/', 'layout');
  redirect(back);
}

export async function removeFromCartAction(form: FormData) {
  const { token } = await requireUser();
  await api(`/cart/items/${text(form, 'productId')}`, { method: 'DELETE', token });
  revalidatePath('/', 'layout');
  redirect('/cart');
}

export async function checkoutAction(form: FormData) {
  const { token } = await requireUser();
  const coupon = text(form, 'couponCode');
  const back = coupon ? `/cart?coupon=${encodeURIComponent(coupon)}` : '/cart';

  const parsed = checkoutSchema.safeParse({
    shippingAddress: {
      name: text(form, 'name'),
      line1: text(form, 'line1'),
      city: text(form, 'city'),
      postalCode: text(form, 'postalCode'),
      country: text(form, 'country'),
    },
    couponCode: coupon || undefined,
  });
  if (!parsed.success) {
    fail(back, parsed.error.issues.map((i) => `${i.path.slice(-1)[0]}: ${i.message}`).join('; '));
  }

  let checkoutUrl: string | null = null;
  try {
    const result = await api<{ orderId: string; checkoutUrl: string | null }>('/orders/checkout', {
      token,
      body: parsed.data,
    });
    checkoutUrl = result.checkoutUrl;
  } catch (error) {
    fail(back, errorMessage(error));
  }
  if (!checkoutUrl) fail(back, 'Could not start payment');
  redirect(checkoutUrl);
}

function productFromForm(form: FormData) {
  const cents = dollarsToCents(text(form, 'price'));
  return productInputSchema.safeParse({
    sku: text(form, 'sku'),
    name: text(form, 'name'),
    description: text(form, 'description'),
    priceCents: cents ?? Number.NaN,
    stock: Number(text(form, 'stock')),
    category: text(form, 'category'),
    imageUrl: text(form, 'imageUrl') || null,
    active: form.get('active') === 'on',
  });
}

export async function saveProductAction(form: FormData) {
  const { token } = await requireAdmin();
  const id = text(form, 'id');
  const here = id ? `/admin/products/${id}` : '/admin/products/new';

  const parsed = productFromForm(form);
  if (!parsed.success) {
    fail(here, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }

  try {
    if (id) await api(`/admin/products/${id}`, { method: 'PUT', token, body: parsed.data });
    else await api('/admin/products', { token, body: parsed.data });
  } catch (error) {
    fail(here, errorMessage(error));
  }
  revalidatePath('/admin/products');
  redirect('/admin/products');
}

export async function deactivateProductAction(form: FormData) {
  const { token } = await requireAdmin();
  await api(`/admin/products/${text(form, 'id')}`, { method: 'DELETE', token });
  revalidatePath('/admin/products');
  redirect('/admin/products');
}

export async function syncOrderAction(form: FormData) {
  const { token } = await requireUser();
  const id = text(form, 'orderId');
  try {
    await api(`/orders/${id}/sync`, { method: 'POST', token });
  } catch (error) {
    fail(`/orders/${id}`, errorMessage(error));
  }
  revalidatePath('/', 'layout');
  redirect(`/orders/${id}`);
}
