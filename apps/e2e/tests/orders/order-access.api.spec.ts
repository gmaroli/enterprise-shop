import { test, expect } from '../../utils/fixtures';
import { findAnyOrderId } from '../../utils/api';

test.describe('order access api', { tag: ['@security', '@regression'] }, () => {
  test('anonymous caller cannot read an order', async ({ request, adminToken }) => {
    const orderId = await findAnyOrderId(request, adminToken);

    const response = await request.get(`orders/${orderId}`);

    expect(response.status()).toBe(401);
  });

  test('a shopper cannot read an order that is not theirs', async ({
    request,
    adminToken,
    shopper,
  }) => {
    const orderId = await findAnyOrderId(request, adminToken);

    const response = await request.get(`orders/${orderId}`, { headers: shopper.auth });

    expect(response.status()).toBe(404);
  });

  test('an admin can read any order', async ({ request, adminToken }) => {
    const orderId = await findAnyOrderId(request, adminToken);

    const response = await request.get(`orders/${orderId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(response.status()).toBe(200);
  });

  test('a shopper gets the same answer for a missing order as for someone else’s', async ({
    request,
    adminToken,
    shopper,
  }) => {
    const realOrderId = await findAnyOrderId(request, adminToken);

    const someoneElses = await request.get(`orders/${realOrderId}`, { headers: shopper.auth });
    const missing = await request.get('orders/does-not-exist', { headers: shopper.auth });

    expect(someoneElses.status()).toBe(missing.status());
    expect(await someoneElses.json()).toEqual(await missing.json());
  });
});

test.describe('order sync api', { tag: ['@security', '@regression'] }, () => {
  test('anonymous caller cannot sync an order', async ({ request, adminToken }) => {
    const orderId = await findAnyOrderId(request, adminToken);

    const response = await request.post(`orders/${orderId}/sync`);

    expect(response.status()).toBe(401);
  });

  test('a shopper cannot tell that someone else’s order exists', async ({
    request,
    adminToken,
    shopper,
  }) => {
    const orderId = await findAnyOrderId(request, adminToken);

    const someoneElses = await request.post(`orders/${orderId}/sync`, { headers: shopper.auth });
    const missing = await request.post('orders/does-not-exist/sync', { headers: shopper.auth });

    expect(someoneElses.status()).toBe(404);
    expect(someoneElses.status()).toBe(missing.status());
    expect(await someoneElses.json()).toEqual(await missing.json());
  });
});
