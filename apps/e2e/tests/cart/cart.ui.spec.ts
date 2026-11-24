import { test, expect } from '../../utils/fixtures';
import { createProduct } from '../../utils/api';
import { LoginPage } from '../../pages/login.page';
import { ShopPage } from '../../pages/shop.page';
import { ProductPage } from '../../pages/product.page';
import { CartPage } from '../../pages/cart.page';
import { Header } from '../../pages/header.component';

test(
  'a shopper adds two items and sees the right totals in the cart',
  { tag: ['@pricing', '@regression'] },
  async ({ page, apiRequest, adminToken, shopper }) => {
    // Arrange: a US$50.00 product made through the API, and a new customer
    const product = await createProduct(apiRequest, adminToken, 5000);
    const loginPage = new LoginPage(page);
    const shopPage = new ShopPage(page);
    const productPage = new ProductPage(page);
    const cartPage = new CartPage(page);
    const header = new Header(page);

    // Act: log in, find the product, add two to the cart
    await loginPage.goto();
    await loginPage.login(shopper.credentials);
    await expect(header.logOutButton).toBeVisible();

    await shopPage.search(product.sku);
    await shopPage.openProduct(product.name);
    await productPage.addToCart(2);

    // Assert: 2 x $50.00 = $100.00, which reaches the free shipping threshold
    await expect(page).toHaveURL('/cart');
    await expect(cartPage.item(product.name)).toBeVisible();
    await expect(cartPage.summaryRow('Subtotal')).toContainText('$100.00');
    await expect(cartPage.summaryRow('Shipping')).toContainText('Free');
    await expect(cartPage.summaryRow('Tax (8%)')).toContainText('$8.00');
    await expect(cartPage.summaryRow('Total')).toContainText('$108.00');
    await expect(header.cartLink).toHaveText('Cart (2)');
  },
);
