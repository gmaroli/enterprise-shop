import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { login, registerCustomer } from '../../utils/api';
import { admin } from '../../utils/config';

type Caller = 'anonymous' | 'customer' | 'admin';

type AccessCase = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string; // no leading slash, same as the other helpers
  data?: Record<string, unknown>;
  expected: Record<Caller, number>;
};

const cases: AccessCase[] = [
  { method: 'GET', path: 'products', expected: { anonymous: 200, customer: 200, admin: 200 } },
  { method: 'GET', path: 'auth/me', expected: { anonymous: 200, customer: 200, admin: 200 } },
  { method: 'GET', path: 'cart', expected: { anonymous: 401, customer: 200, admin: 200 } },
  {
    method: 'GET',
    path: 'admin/products',
    expected: { anonymous: 401, customer: 403, admin: 200 },
  },
  // Invalid body on purpose: a 400 for the admin proves the access check passed
  // without changing the real exchange rate
  {
    method: 'PUT',
    path: 'admin/rates/EUR',
    data: { perUsd: -1 },
    expected: { anonymous: 401, customer: 403, admin: 400 },
  },
];

const callers: Caller[] = ['anonymous', 'customer', 'admin'];

async function headersFor(request: APIRequestContext, caller: Caller) {
  if (caller === 'anonymous') return {};
  if (caller === 'admin') return { Authorization: `Bearer ${await login(request, admin)}` };
  const { auth } = await registerCustomer(request);
  return auth;
}

test.describe('access control api', { tag: ['@security', '@regression'] }, () => {
  for (const c of cases) {
    for (const caller of callers) {
      test(`${c.method} ${c.path} as ${caller} gives ${c.expected[caller]}`, async ({
        request,
      }) => {
        const headers = await headersFor(request, caller);

        const response = await request.fetch(c.path, {
          method: c.method,
          headers,
          data: c.data,
        });

        expect(response.status()).toBe(c.expected[caller]);
      });
    }
  }
});
