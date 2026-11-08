/** All money values are integer cents. */

export const TAX_RATE = 0.08;
export const FREE_SHIPPING_THRESHOLD_CENTS = 10_000;
export const FLAT_SHIPPING_CENTS = 750;

export type PricedLine = { unitPriceCents: number; quantity: number };

export type CouponCode = 'WELCOME10' | 'FREESHIP';

export type CartTotals = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  appliedCoupon: CouponCode | null;
};

export function normalizeCoupon(code: string | undefined | null): CouponCode | null {
  const value = code?.trim().toUpperCase();
  if (value === 'WELCOME10' || value === 'FREESHIP') return value;
  return null;
}

export function calculateTotals(lines: PricedLine[], couponCode?: string | null): CartTotals {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const coupon = lines.length > 0 ? normalizeCoupon(couponCode) : null;

  const discountCents = coupon === 'WELCOME10' ? Math.round(subtotalCents * 0.1) : 0;
  const discountedSubtotal = subtotalCents - discountCents;

  let shippingCents = 0;
  if (lines.length > 0 && coupon !== 'FREESHIP' && subtotalCents < FREE_SHIPPING_THRESHOLD_CENTS) {
    shippingCents = FLAT_SHIPPING_CENTS;
  }

  const taxCents = Math.round(discountedSubtotal * TAX_RATE);
  const totalCents = discountedSubtotal + shippingCents + taxCents;

  return { subtotalCents, discountCents, shippingCents, taxCents, totalCents, appliedCoupon: coupon };
}

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
