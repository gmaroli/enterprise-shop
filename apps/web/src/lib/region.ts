import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { currencyForCountry, isSupportedCountry, type Currency } from '@shop/shared';
import { api } from './api';

export const COUNTRY_COOKIE = 'shop_country';

export type Region = {
  country: string;
  currency: Currency;
  /** selected: chosen in the header; ip/dev_ip: detected from the address; default: nothing to go on. */
  source: 'selected' | 'ip' | 'dev_ip' | 'default';
};

/**
 * The shopper's country and currency: an explicit choice wins, otherwise the country is detected
 * from the request IP by the API. Memoised per request.
 */
export const getRegion = cache(async (): Promise<Region> => {
  const selected = (await cookies()).get(COUNTRY_COOKIE)?.value?.toUpperCase();
  if (isSupportedCountry(selected)) {
    return { country: selected, currency: currencyForCountry(selected), source: 'selected' };
  }

  const h = await headers();
  const ip = h.get('x-forwarded-for') ?? h.get('x-real-ip');
  try {
    return await api<Region>('/geo', { headers: ip ? { 'x-client-ip': ip } : {} });
  } catch {
    return { country: 'US', currency: 'USD', source: 'default' };
  }
});
