import { test, expect } from '@playwright/test';
import { customer } from '../../utils/config';
import { LoginPage } from '../../pages/login.page';
import { Header } from '../../pages/header.component';

test('a customer can login from the login page', { tag: '@smoke' }, async ({ page }) => {
  const loginPage = new LoginPage(page);
  const header = new Header(page);

  await loginPage.goto();
  await loginPage.login(customer);

  await expect(page).toHaveURL('/');
  await expect(header.logOutButton).toBeVisible();
});

test('entering incorrect password, throws error and user is not able to login', async ({
  page,
}) => {
  const loginPage = new LoginPage(page);
  const header = new Header(page);

  await loginPage.goto();
  await loginPage.login({ email: customer.email, password: 'invalid-password' });

  await expect(loginPage.errorMessage('Invalid credentials')).toBeVisible();
  await expect(header.logOutButton).toHaveCount(0);
});

test('customer has successfully logged out', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const header = new Header(page);

  await loginPage.goto();
  await loginPage.login(customer);
  await expect(header.logOutButton).toBeVisible();

  await header.logOutButton.click();
  await expect(header.logOutButton).not.toBeVisible();
  await expect(header.loginLink).toBeVisible();
});
