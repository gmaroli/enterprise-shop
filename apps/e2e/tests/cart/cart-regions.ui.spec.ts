import { test, expect } from '../../utils/fixtures';
import { createProduct } from '../../utils/api';
import { LoginPage } from '../../pages/login.page';
import { ShopPage } from '../../pages/shop.page';
import { ProductPage } from '../../pages/product.page';
import { CartPage } from '../../pages/cart.page';
import { Header } from '../../pages/header.component';

type RegionCase = {
  country: string;
  currency: string;
  subtotal: string;
  shipping: string;
  tax: string;
  total: string;
};

// One US$50.00 product, quantity 1. Seed rates per USD: AUD 1.52, GBP 0.78, CAD 1.37, EUR 0.92.
const regions: RegionCase[] = [
  {
    country: 'US',
    currency: 'USD',
    subtotal: '$50.00',
    shipping: '$7.50',
    tax: '$4.00',
    total: '$61.50',
  },
  {
    country: 'AU',
    currency: 'AUD',
    subtotal: '$76.00',
    shipping: '$11.40',
    tax: '$6.08',
    total: '$93.48',
  },

  {
    country: 'GB',
    currency: 'GBP',
    subtotal: '£39.00',
    shipping: '£5.85',
    tax: '£3.12',
    total: '£47.97',
  },

  {
    country: 'CA',
    currency: 'CAD',
    subtotal: 'CA$68.50',
    shipping: 'CA$10.28',
    tax: 'CA$5.48',
    total: 'CA$84.26',
  },
  {
    country: 'DE',
    currency: 'EUR',
    subtotal: '€46.00',
    shipping: '€6.90',
    tax: '€3.68',
    total: '€56.58',
  },
];

for (const region of regions) {
  test.describe(`cart in ${region.country}`, { tag: ['@pricing', '@regression'] }, () => {
    test.use({ country: region.country });

    test(`shows ${region.currency} totals`, async ({ page, apiRequest, adminToken, shopper }) => {
      const product = await createProduct(apiRequest, adminToken, 5000);
      const loginPage = new LoginPage(page);
      const shopPage = new ShopPage(page);
      const productPage = new ProductPage(page);
      const cartPage = new CartPage(page);
      const header = new Header(page);

      await loginPage.goto();
      await loginPage.login(shopper.credentials);
      await expect(header.logOutButton).toBeVisible();

      await shopPage.search(product.sku);
      await shopPage.openProduct(product.name);
      await productPage.addToCart(1);

      await expect(page).toHaveURL('/cart');
      await expect(header.currencyLabel).toHaveText(region.currency);
      await expect(cartPage.summaryRow('Subtotal')).toContainText(region.subtotal);
      await expect(cartPage.summaryRow('Shipping')).toContainText(region.shipping);
      await expect(cartPage.summaryRow('Tax (8%)')).toContainText(region.tax);
      await expect(cartPage.summaryRow('Total')).toContainText(region.total);
    });
  });
}
