import type { OrderStatus, Role } from '@shop/shared';

export type User = { id: string; email: string; name: string; role: Role };

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  priceCents: number;
  stock: number;
  category: string;
  imageUrl: string | null;
  active: boolean;
  /** Price in the shopper's currency (present on public product endpoints). */
  displayPriceCents?: number;
  displayCurrency?: string;
};

export type ProductPage = { items: Product[]; total: number; page: number; pageSize: number };

export type CartTotals = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  appliedCoupon: string | null;
};

export type CartItem = {
  productId: string;
  sku: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  stock: number;
  available: boolean;
};

export type Cart = {
  currency: string;
  shippingRules: { flatShippingCents: number; freeShippingThresholdCents: number };
  items: CartItem[];
  totals: CartTotals;
};

export type OrderItem = {
  id: string;
  sku: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
};

export type Order = {
  id: string;
  status: OrderStatus;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  couponCode: string | null;
  currency: string;
  fxRate: string;
  shippingName: string;
  shippingLine1: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingCountry: string;
  createdAt: string;
  paidAt: string | null;
  items: OrderItem[];
};

export type ExchangeRate = { currency: string; perUsd: number; source: string; updatedAt: string };
