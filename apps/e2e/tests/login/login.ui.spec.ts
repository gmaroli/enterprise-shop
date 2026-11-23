import { test, expect } from '@playwright/test';
import { customer } from '../../utils/config';
import { LoginPage } from '../../pages/login.page';

test('a customer can login from the login page', { tag: '@smoke' }, async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login(customer);

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
});

test('entering incorrect password, throws error and user is not able to login', async ({
  page,
}) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login({ email: customer.email, password: 'invalid-password' });

  await expect(page.getByRole('alert').filter({ hasText: 'Invalid credentials' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(0);
});
