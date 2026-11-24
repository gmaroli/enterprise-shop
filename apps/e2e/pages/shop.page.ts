import type { Locator, Page } from '@playwright/test';

export class ShopPage {
  private readonly page: Page;
  private readonly searchBox: Locator;
  private readonly searchButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchBox = page.getByLabel('Search products');
    this.searchButton = page.getByRole('button', { name: 'Search', exact: true });
  }

  async goto() {
    await this.page.goto('/');
  }

  async search(text: string) {
    await this.searchBox.fill(text);
    await this.searchButton.click();
  }

  productCard(name: string): Locator {
    return this.page.getByRole('link', { name });
  }

  async openProduct(name: string) {
    await this.productCard(name).click();
  }
}
