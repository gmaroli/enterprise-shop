import type { Locator, Page } from '@playwright/test';

export class ProductPage {
  private readonly quantityInput: Locator;
  private readonly addToCartButton: Locator;

  constructor(page: Page) {
    this.quantityInput = page.getByLabel('Quantity');
    this.addToCartButton = page.getByRole('button', { name: 'Add to cart' });
  }

  async addToCart(quantity: number) {
    await this.quantityInput.fill(String(quantity));
    await this.addToCartButton.click();
  }
}
