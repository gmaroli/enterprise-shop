import type { APIRequestContext } from '@playwright/test';
import { generateTestPassword } from './test-data';
import type { Credentials } from './config';
import { randomUUID } from 'node:crypto';

export async function login(request: APIRequestContext, credentials: Credentials): Promise<string> {
  const response = await request.post('auth/login', {
    data: { email: credentials.email, password: credentials.password },
  });
  if (!response.ok()) {
    throw new Error(`Login failed for ${credentials.email}: HTTP ${response.status()}`);
  }
  const body = await response.json();
  return body.accessToken;
}

export async function createProduct(
  request: APIRequestContext,
  adminToken: string,
  priceCents: number,
) {
  const sku = `QA-${randomUUID().replace(/-/g, '')}`;
  const response = await request.post('admin/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      sku,
      name: `QA test product ${sku}`,
      description: 'Created by an automated test',
      priceCents,
      stock: 100,
      category: 'Accessories',
    },
  });
  if (!response.ok()) {
    throw new Error(
      `Create Product failed for ${sku}: HTTP ${response.status()} ${await response.text()}`,
    );
  }
  return response.json();
}

export async function registerCustomer(request: APIRequestContext) {
  const credentials = {
    email: `qa-${randomUUID().replace(/-/g, '').slice(0, 15)}@shop.test`,
    password: generateTestPassword(),
  };

  const response = await request.post('auth/register', {
    data: { ...credentials, name: 'QA Customer' },
  });
  if (!response.ok()) {
    throw new Error(
      `Registering ${credentials.email} failed: HTTP ${response.status()} ${await response.text()}`,
    );
  }
  const body = await response.json();
  return {
    token: body.accessToken as string,
    auth: { Authorization: `Bearer ${body.accessToken}` },
    credentials,
  };
}

export async function addToCart(
  request: APIRequestContext,
  auth: Record<string, string>,
  productId: string,
  quantity: number,
) {
  const response = await request.post('cart/items', {
    headers: auth,
    data: { productId, quantity },
  });
  if (!response.ok()) {
    throw new Error(`Adding to cart failed: HTTP ${response.status()} ${await response.text()}`);
  }
}

export async function getCart(
  request: APIRequestContext,
  auth: Record<string, string>,
  coupon?: string,
) {
  const response = await request.get('cart', {
    headers: auth,
    params: coupon ? { coupon } : undefined,
  });
  if (!response.ok()) {
    throw new Error(`Reading the cart failed: HTTP ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

export async function findAnyOrderId(request: APIRequestContext, adminToken: string) {
  const response = await request.get('orders', {
    headers: { Authorization: `Bearer ${adminToken}` },
    params: { all: 'true' },
  });
  if (!response.ok()) {
    throw new Error(`Listing orders failed: HTTP ${response.status()} ${await response.text()}`);
  }
  const orders = await response.json();
  if (!orders.length) {
    throw new Error('No orders found. Run pnpm db:seed:demo to create demo orders.');
  }
  return orders[0].id as string;
}
