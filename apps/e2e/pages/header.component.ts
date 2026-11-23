import type { Locator, Page } from '@playwright/test';

export class Header {
  readonly logOutButton: Locator;
  readonly loginLink: Locator;
  readonly cartLink: Locator;
  readonly ordersLink: Locator;

  constructor(page: Page) {
    this.logOutButton = page.getByRole('button', { name: 'Log out' });
    this.loginLink = page.getByRole('link', { name: 'Log in' });
    this.cartLink = page.getByRole('link', { name: /^Cart/ });
    this.ordersLink = page.getByRole('link', { name: 'Orders' });
  }
}
