import { test as base, expect } from '@playwright/test';
import { login, registerCustomer } from './api';
import { admin } from './config';

type Shopper = Awaited<ReturnType<typeof registerCustomer>>;

type Fixtures = {
  adminToken: string;
  shopper: Shopper;
};

export const test = base.extend<Fixtures>({
  adminToken: async ({ request }, use) => {
    await use(await login(request, admin));
  },
  shopper: async ({ request }, use) => {
    await use(await registerCustomer(request));
  },
});

export { expect };
