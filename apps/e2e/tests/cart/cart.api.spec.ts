import { test, expect } from '../../utils/fixtures';
import { createProduct } from '../../utils/api';

test.describe('cart totals api', () => {
  test('USD cart, one US$50.00 item, no coupon', async ({ request, adminToken, shopper }) => {
    // Arrange: an admin creates a product that costs US$50.00
    const product = await createProduct(request, adminToken, 5000);
    const auth = shopper.auth;

    // Act: add one product to the cart, then read the cart
    await request.post('cart/items', {
      headers: auth,
      data: { productId: product.id, quantity: 1 },
    });
    const cartResponse = await request.get('cart', { headers: auth });
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
