import { test, expect } from '@playwright/test';
import { customer } from '../../utils/config';

test('a customer can login from the login page', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(customer.email);
  await page.getByLabel('Password').fill(customer.password);
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
});

test('entering incorrect password, throws error and user is not able to login', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(customer.email);
  await page.getByLabel('Password').fill('invalid-password');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Invalid credentials' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(0);
});
