import { test, expect } from '@playwright/test';
import { admin } from '../../utils/config';

test.describe('admin products api', () => {
  test('an admin can create a product', async ({ request }) => {
    // 1. Login as a seeded admin to get a token
    const login = await request.post('auth/login', {
      data: { email: admin.email, password: admin.password },
    });
    expect(login.status()).toBe(200);
    const { accessToken } = await login.json();

    // 2. Create a product with a unique SKU
    const sku = `QA-${Date.now()}`;
    const response = await request.post('admin/products', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        sku,
        name: `QA test product ${sku}`,
        description: 'Created by an automated test',
        priceCents: 5000,
        stock: 100,
        category: 'Accessories',
      },
    });

    // 3. Check the result
    expect(response.status()).toBe(201);
    const product = await response.json();
    expect(product.sku).toBe(sku);
    expect(product.priceCents).toBe(5000);
    expect(product.stock).toBe(100);
    expect(product.active).toBe(true);
  });
});
