import { describe, expect, it } from 'vitest';
import { calculateTotals, formatCents, normalizeCoupon } from './pricing';

describe('calculateTotals', () => {
  it('returns zeros for an empty cart', () => {
    expect(calculateTotals([])).toEqual({
      subtotalCents: 0,
      discountCents: 0,
      shippingCents: 0,
      taxCents: 0,
      totalCents: 0,
      appliedCoupon: null,
    });
  });

  it('adds flat shipping below the free-shipping threshold', () => {
    const totals = calculateTotals([{ unitPriceCents: 2000, quantity: 2 }]);
    expect(totals.subtotalCents).toBe(4000);
    expect(totals.shippingCents).toBe(750);
    expect(totals.taxCents).toBe(320);
    expect(totals.totalCents).toBe(5070);
  });

  it('gives free shipping at the threshold', () => {
    const totals = calculateTotals([{ unitPriceCents: 10000, quantity: 1 }]);
    expect(totals.shippingCents).toBe(0);
  });

  it('applies WELCOME10 before tax', () => {
    const totals = calculateTotals([{ unitPriceCents: 5000, quantity: 1 }], 'welcome10');
    expect(totals.discountCents).toBe(500);
    expect(totals.taxCents).toBe(360);
    expect(totals.totalCents).toBe(4500 + 750 + 360);
    expect(totals.appliedCoupon).toBe('WELCOME10');
  });

  it('applies FREESHIP', () => {
    const totals = calculateTotals([{ unitPriceCents: 1000, quantity: 1 }], 'FREESHIP');
    expect(totals.shippingCents).toBe(0);
  });

  it('ignores unknown coupons', () => {
    const totals = calculateTotals([{ unitPriceCents: 1000, quantity: 1 }], 'NOPE');
    expect(totals.appliedCoupon).toBeNull();
    expect(totals.discountCents).toBe(0);
  });
});

describe('normalizeCoupon', () => {
  it('trims and upper-cases', () => {
    expect(normalizeCoupon('  freeship ')).toBe('FREESHIP');
  });
  it('returns null for empty input', () => {
    expect(normalizeCoupon('')).toBeNull();
    expect(normalizeCoupon(undefined)).toBeNull();
  });
});

describe('formatCents', () => {
  it('formats USD', () => {
    expect(formatCents(123456)).toBe('$1,234.56');
  });
});
