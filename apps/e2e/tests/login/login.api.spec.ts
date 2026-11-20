import { test, expect } from '@playwright/test';
import { customer } from '../../utils/config';

test.describe('login api', () => {
  test('valid credentials return a token and the user', async ({ request }) => {
    const response = await request.post('auth/login', {
      data: { email: customer.email, password: customer.password },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.user.email).toBe(customer.email);
    expect(body.user.role).toBe('CUSTOMER');
  });

  test('wrong password is rejected with 401', async ({ request }) => {
    const response = await request.post('auth/login', {
      data: { email: customer.email, password: 'not-the-password' },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.message).toBe('Invalid credentials');
  });
});
