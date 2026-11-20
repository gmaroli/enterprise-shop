import type { APIRequestContext } from '@playwright/test';
import { generateTestPassword } from './test-data';
import type { Credentials } from './config';

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
  const sku = `QA-${Date.now()}`;
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
  const email = `qa-${Date.now()}@shop.test`;
  const response = await request.post('auth/register', {
    data: {
      email,
      password: generateTestPassword(),
      name: 'QA Customer',
    },
  });
  if (!response.ok()) {
    throw new Error(
      `Registering ${email} failed: HTTP ${response.status()} ${await response.text()}`,
    );
  }
  const body = await response.json();
  return {
    token: body.accessToken as string,
    auth: { Authorization: `Bearer ${body.accessToken}` },
  };
}
