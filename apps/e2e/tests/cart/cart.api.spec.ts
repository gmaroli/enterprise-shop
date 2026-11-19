import { test, expect } from '@playwright/test';

test.describe('cart totals API', () => {
  test('USD cart, one US$50.00 item, no coupon', async ({ request }) => {
    // Arrange: an admin creates a product that costs US$50.00
    const adminLogin = await request.post('auth/login', {
      data: { email: 'admin@shop.test', password: 'Admin123!' },
    });
    const adminToken = (await adminLogin.json()).accessToken;

    const sku = `QA-${Date.now()}`;
    const created = await request.post('admin/products', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        sku,
        name: `QA test product ${sku}`,
        description: 'Created by an automated test',
        priceCents: 5000,
        stock: 100,
        category: 'Accessories',
      },
    });
    const product = await created.json();

    // Arrange: a brand-new customer with an empty cart
    const register = await request.post('auth/register', {
      data: { email: `qa-${Date.now()}@shop.test`, password: 'Password123!', name: 'QA Customer' },
    });
    const customerToken = (await register.json()).accessToken;
    const customerAuth = { Authorization: `Bearer ${customerToken}` };

    // Act: add one product to the cart, then read the cart
    await request.post('cart/items', {
      headers: customerAuth,
      data: { productId: product.id, quantity: 1 },
    });
    const cartResponse = await request.get('cart', { headers: customerAuth });
    expect(cartResponse.status()).toBe(200);
    const cart = await cartResponse.json();

    // Assert: numbers worked out by hand from docs/requirements.md
    expect(cart.totals.subtotalCents).toBe(5000);
    expect(cart.totals.discountCents).toBe(0);
    expect(cart.totals.shippingCents).toBe(750);
    expect(cart.totals.taxCents).toBe(400);
    expect(cart.totals.totalCents).toBe(6150);
    expect(cart.totals.appliedCoupon).toBeNull();
  });
});
