import { test, expect, request } from '@playwright/test';

test.describe('login api', () => {
  test('valid credentials return a token and the user', async ({ request }) => {
    const response = await request.post('auth/login', {
      data: { email: 'customer@shop.test', password: 'Customer123!' },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user.role).toBe('CUSTOMER');
  });

  test('wrong password is rejected with 401', async ({ request }) => {
    const response = await request.post('auth/login', {
      data: { email: 'customer@shop.test', password: 'not-the-password' },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.message).toBe('Invalid credentials');
  });
});
