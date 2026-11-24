import { test as base, expect } from '@playwright/test';
import { login, registerCustomer } from './api';
import { admin } from './config';
import type { APIRequestContext } from '@playwright/test';
import { apiBaseURL, webBaseURL } from './urls';

type Shopper = Awaited<ReturnType<typeof registerCustomer>>;

type Fixtures = {
  adminToken: string;
  shopper: Shopper;
  apiRequest: APIRequestContext;
  /** The shopper's country (ISO code). Decides the currency the shop shows. */
  country: string;
};

export const test = base.extend<Fixtures>({
  // An option: tests change it with test.use({ country: 'AU' }). US keeps CI and local runs identical.
  country: ['US', { option: true }],

  // Same page as always, but with the country cookie set before the test starts.
  page: async ({ page, context, country }, use) => {
    await context.addCookies([{ name: 'shop_country', value: country, url: webBaseURL }]);
    await use(page);
  },

  apiRequest: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({ baseURL: apiBaseURL });
    await use(context);
    await context.dispose();
  },
  adminToken: async ({ apiRequest }, use) => {
    await use(await login(apiRequest, admin));
  },
  shopper: async ({ apiRequest }, use) => {
    await use(await registerCustomer(apiRequest));
  },
});

export { expect };
