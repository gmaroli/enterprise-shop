import { describe, expect, it } from 'vitest';
import {
  convertFromUsd,
  convertToUsd,
  currencyForCountry,
  isCurrency,
  isSupportedCountry,
} from './currency';

describe('currencyForCountry', () => {
  it('maps supported countries', () => {
    expect(currencyForCountry('US')).toBe('USD');
    expect(currencyForCountry('au')).toBe('AUD');
    expect(currencyForCountry(' gb ')).toBe('GBP');
    expect(currencyForCountry('CA')).toBe('CAD');
    expect(currencyForCountry('DE')).toBe('EUR');
    expect(currencyForCountry('FR')).toBe('EUR');
  });

  it('falls back to USD for other or missing countries', () => {
    expect(currencyForCountry('JP')).toBe('USD');
    expect(currencyForCountry('')).toBe('USD');
    expect(currencyForCountry(null)).toBe('USD');
  });
});

describe('guards', () => {
  it('recognises supported countries and currencies', () => {
    expect(isSupportedCountry('de')).toBe(true);
    expect(isSupportedCountry('JP')).toBe(false);
    expect(isCurrency('AUD')).toBe(true);
    expect(isCurrency('aud')).toBe(false);
  });
});

describe('conversion', () => {
  it('rounds to the nearest cent', () => {
    expect(convertFromUsd(8900, 1.52)).toBe(13528);
    expect(convertFromUsd(1999, 0.78)).toBe(1559);
    expect(convertToUsd(13528, 1.52)).toBe(8900);
  });

  it('is the identity at a rate of 1', () => {
    expect(convertFromUsd(1234, 1)).toBe(1234);
  });
});
