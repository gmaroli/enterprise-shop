import { describe, expect, it } from 'vitest';
import { centsToDollars, dollarsToCents, formatMoney } from './money';

describe('dollarsToCents', () => {
  it('parses whole and decimal amounts', () => {
    expect(dollarsToCents('12')).toBe(1200);
    expect(dollarsToCents('12.3')).toBe(1230);
    expect(dollarsToCents('12.34')).toBe(1234);
    expect(dollarsToCents(' 0.99 ')).toBe(99);
  });

  it('rejects invalid input', () => {
    expect(dollarsToCents('')).toBeNull();
    expect(dollarsToCents('abc')).toBeNull();
    expect(dollarsToCents('-5')).toBeNull();
    expect(dollarsToCents('1.234')).toBeNull();
  });
});

describe('centsToDollars', () => {
  it('formats with two decimals', () => {
    expect(centsToDollars(1234)).toBe('12.34');
    expect(centsToDollars(5)).toBe('0.05');
  });
});

describe('formatMoney', () => {
  it('accepts lower- and upper-case currency codes', () => {
    expect(formatMoney(123456, 'usd')).toBe('$1,234.56');
    expect(formatMoney(123456, 'USD')).toBe('$1,234.56');
  });

  it('uses the currency symbol for other currencies', () => {
    expect(formatMoney(13528, 'AUD')).toContain('135.28');
    expect(formatMoney(13528, 'AUD')).not.toBe(formatMoney(13528, 'USD'));
  });
});
