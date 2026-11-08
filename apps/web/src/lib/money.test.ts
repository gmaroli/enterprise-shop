import { describe, expect, it } from 'vitest';
import { centsToDollars, dollarsToCents } from './money';

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
