import type { Locator, Page } from '@playwright/test';

export class CartPage {
  private readonly page: Page;
  private readonly summary: Locator;

  constructor(page: Page) {
    this.page = page;
    this.summary = page.getByRole('complementary');
  }

  item(name: string): Locator {
    return this.page.getByRole('listitem').filter({ hasText: name });
  }

  summaryRow(label: string): Locator {
    return this.summary.locator('div').filter({ has: this.page.getByText(label, { exact: true }) });
  }
}
