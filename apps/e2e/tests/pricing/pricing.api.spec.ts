import { test, expect } from '@playwright/test';
import { addToCart, createProduct, registerCustomer, getCart, login } from '../../utils/api';
import { admin } from '../../utils/config';

type PricingCase = {
  name: string;
  unitPriceCents: number;
  quantity: number;
  coupon?: string;
  expected: {
    subtotalCents: number;
    discountCents: number;
    shippingCents: number;
    taxCents: number;
    totalCents: number;
  };
};

const cases: PricingCase[] = [
  {
    name: '1 x US$50.00, no coupon',
    unitPriceCents: 5000,
    quantity: 1,
    expected: {
      subtotalCents: 5000,
      discountCents: 0,
      shippingCents: 750,
      taxCents: 400,
      totalCents: 6150,
    },
  },
  {
    name: '2 x US$50.00, subtotal exactly at the free-shipping threshold',
    unitPriceCents: 5000,
    quantity: 2,
    expected: {
      subtotalCents: 10000,
      discountCents: 0,
      shippingCents: 0,
      taxCents: 800,
      totalCents: 10800,
    },
  },
  {
    name: '1 x US$99.99, one cent below the threshold',
    unitPriceCents: 9999,
    quantity: 1,
    expected: {
      subtotalCents: 9999,
      discountCents: 0,
      shippingCents: 750,
      taxCents: 800,
      totalCents: 11549,
    },
  },
  {
    name: '1 x US$50.00 with coupon WELCOME10',
    unitPriceCents: 5000,
    quantity: 1,
    coupon: 'WELCOME10',
    expected: {
      subtotalCents: 5000,
      discountCents: 500,
      shippingCents: 750,
      taxCents: 360,
      totalCents: 5610,
    },
  },
];

test.describe('cart pricing api (USD)', () => {
  for (const c of cases) {
    test(c.name, async ({ request }) => {
      const adminToken = await login(request, admin);
      const product = await createProduct(request, adminToken, c.unitPriceCents);
      const { auth } = await registerCustomer(request);

      await addToCart(request, auth, product.id, c.quantity);
      const cart = await getCart(request, auth, c.coupon);

      expect(cart.totals).toMatchObject(c.expected);
    });
  }
});
