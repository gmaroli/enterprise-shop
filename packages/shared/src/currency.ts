/**
 * Prices are stored in USD cents. Other currencies are derived with an exchange rate
 * expressed as units of the currency per 1 USD (for example AUD 1.52).
 */
export const CURRENCIES = ['USD', 'AUD', 'GBP', 'CAD', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const BASE_CURRENCY: Currency = 'USD';

const EUR_COUNTRIES = ['DE', 'FR', 'ES', 'IT', 'NL', 'IE', 'AT', 'BE', 'PT', 'FI'] as const;
const OTHER_COUNTRIES = ['US', 'AU', 'GB', 'CA'] as const;

export const SUPPORTED_COUNTRIES = [...OTHER_COUNTRIES, ...EUR_COUNTRIES] as const;
export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

export const COUNTRY_NAMES: Record<SupportedCountry, string> = {
  US: 'United States',
  AU: 'Australia',
  GB: 'United Kingdom',
  CA: 'Canada',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  IE: 'Ireland',
  AT: 'Austria',
  BE: 'Belgium',
  PT: 'Portugal',
  FI: 'Finland',
};

const COUNTRY_CURRENCY: Record<string, Currency> = {
  US: 'USD',
  AU: 'AUD',
  GB: 'GBP',
  CA: 'CAD',
  ...Object.fromEntries(EUR_COUNTRIES.map((c) => [c, 'EUR' as Currency])),
};

export function isSupportedCountry(value: string | null | undefined): value is SupportedCountry {
  return !!value && (SUPPORTED_COUNTRIES as readonly string[]).includes(value.toUpperCase());
}

export function isCurrency(value: string | null | undefined): value is Currency {
  return !!value && (CURRENCIES as readonly string[]).includes(value);
}

/** Currency used for a country; countries we do not price in fall back to USD. */
export function currencyForCountry(country: string | null | undefined): Currency {
  return COUNTRY_CURRENCY[country?.trim().toUpperCase() ?? ''] ?? BASE_CURRENCY;
}

/** Converts USD cents to the currency's cents, rounded to the nearest cent. */
export function convertFromUsd(usdCents: number, ratePerUsd: number): number {
  return Math.round(usdCents * ratePerUsd);
}

/** Converts a currency's cents back to USD cents, rounded to the nearest cent. */
export function convertToUsd(cents: number, ratePerUsd: number): number {
  return Math.round(cents / ratePerUsd);
}
