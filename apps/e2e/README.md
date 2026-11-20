# E2E tests (Playwright + TypeScript)

This is my test automation framework for the shop. Right now it has API tests. UI tests will be added later in the same package, using the same helpers and fixtures.

The tests run against the real app on my machine (API on port 4000, database in Docker). Nothing is mocked.

## Setup (one time)

Do the "Getting started" steps in the root [README](../../README.md) first, so the database is migrated and seeded and the API is running (`pnpm dev`).

Then, from the repo root:

```bash
pnpm install
cp apps/e2e/.env.example apps/e2e/.env
```

Open `apps/e2e/.env` and fill in the admin and customer logins. They are the demo accounts that `pnpm db:seed` creates, listed in the "Demo accounts" table in the root README. The `.env` file is git-ignored, so never commit it.

UI tests will also need a browser. When we get there:

```bash
pnpm --filter @shop/e2e exec playwright install chromium
```

> `pnpm db:seed` wipes users, orders and products. The tests do not need it between runs, because every test creates its own data.

## Running the tests

All commands run from the repo root.

| What I want                     | Command                             |
| ------------------------------- | ----------------------------------- |
| All API tests                   | `pnpm test:api`                     |
| Everything (API and UI)         | `pnpm test:e2e`                     |
| Only the quick smoke checks     | `pnpm test:api --grep @smoke`       |
| Only one area                   | `pnpm test:api --grep @pricing`     |
| One test by name                | `pnpm test:api -g "wrong password"` |
| Step through a test (debugger)  | `pnpm test:api --debug`             |
| Watch tests run in the UI mode  | `pnpm test:api --ui`                |
| Open the last HTML report       | `pnpm --filter @shop/e2e report`    |
| Format and type check the tests | `pnpm check:e2e`                    |

If a test fails, a trace is saved for it. The HTML report links to it, and it shows every request and response.

## Folder layout

```
apps/e2e
├── playwright.config.ts   projects: api and ui-chromium
├── tests/                 one folder per feature
│   ├── health/
│   ├── login/
│   ├── admin/
│   ├── cart/
│   ├── pricing/           data-driven: one table of cases, one loop
│   └── access/            who can call what: endpoints x callers
└── utils/
    ├── api.ts             helpers: login, createProduct, registerCustomer, addToCart, getCart
    ├── fixtures.ts        shared setup: adminToken, shopper
    ├── config.ts          reads the admin and customer logins from .env
    └── test-data.ts       generates random passwords for test users
```

Test files end in `.api.spec.ts` or `.ui.spec.ts`. The suffix decides which Playwright project runs them.

## Tags

| Tag           | Meaning                                                   |
| ------------- | --------------------------------------------------------- |
| `@smoke`      | The quickest, most important checks. If these fail, stop. |
| `@regression` | The wider suite that protects existing behaviour.         |
| `@pricing`    | Price, shipping, discount and tax calculations.           |
| `@security`   | Access control: who may call which endpoint.              |

## Adding a test

1. Put it in the folder for its feature, in a file named `something.api.spec.ts`.
2. Import `test` and `expect` from `utils/fixtures`, not from `@playwright/test`, so the fixtures are available.
3. Ask for what the test needs in its arguments, for example `async ({ request, adminToken, shopper })`.
4. Add a tag, either on the `describe` or on the single test.
5. Run `pnpm check:e2e` and the tests before opening a pull request.

## Rules I follow

- Every test creates its own data and does not depend on another test or on a fixed ID.
- Unique values (SKUs, emails) come from `randomUUID`, so parallel runs can't collide.
- Expected numbers are worked out by hand from `docs/requirements.md`, not copied from what the app returns.
- If a test fails, I find out why before changing the expected value. It may be a bug.
- Passwords and tokens never go into logs, error messages or committed files.
- Helpers throw errors that say what failed (for example `Login failed for <email>: HTTP 401`).
