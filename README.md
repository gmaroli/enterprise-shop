# Enterprise Shop

A demo e-commerce system built as a realistic target for learning and practising software testing and quality engineering. It has a storefront, an admin area, a REST API, a PostgreSQL database, Stripe test-mode payments, multi-currency pricing, and a separate analytics data warehouse with an ETL job.

It is a **local demo**: nothing here is meant to be deployed as-is, and it only ever uses Stripe **test** keys.

## What it does

**For shoppers**
- Browse and search a product catalog (categories, paging).
- Register, log in, and keep a cart that persists between sessions.
- Apply coupons, check out with a shipping address, and pay on Stripe's hosted page.
- Prices, shipping and totals are shown and charged in the shopper's currency (USD, AUD, GBP, CAD or EUR), chosen from the country detected from their IP address or picked in the header.
- View order history and order details.

**For admins**
- Create, edit and deactivate products.
- View all orders.
- Edit the demo exchange rates.

**Behind the scenes**
- A REST API with JWT login, roles, input validation and Swagger documentation.
- Order completion driven by Stripe webhooks, with a fallback that re-checks a payment with Stripe if the webhook was missed.
- An analytics warehouse (staging, star schema, reporting views) loaded incrementally from the app database.

## Architecture

```
Browser ──> apps/web (Next.js) ──server-side calls──> apps/api (NestJS) ──> PostgreSQL (database "shop")
                                                          │
                                                          └──> Stripe Checkout (test mode)
Stripe ──webhook──> apps/api

apps/etl (Python) ──reads──> "shop" database ──loads──> PostgreSQL (database "warehouse")
```

| Part | Path | Default address |
| --- | --- | --- |
| Storefront and admin (Next.js 15, React 19, Tailwind 4) | `apps/web` | http://localhost:3001 |
| REST API (NestJS 11, Swagger at `/api/docs`) | `apps/api` | http://localhost:4000 |
| Warehouse loader (Python, psycopg, SQL files) | `apps/etl` | database `warehouse` |
| Database schema, migrations and seed data (Prisma 6) | `packages/db` | PostgreSQL on port 5432 |
| Shared pricing, currency, permission and validation logic (zod) | `packages/shared` | |
| Shared TypeScript configuration | `packages/config` | |
| Docker Compose for PostgreSQL | `infra/` | |
| Requirements, architecture, API and warehouse docs | `docs/` | |

The repository is a pnpm workspace orchestrated by Turborepo.

## Prerequisites

- **Node.js 22 or newer**
- **pnpm 12** (see https://pnpm.io/installation)
- **Docker Desktop** (runs PostgreSQL)
- **uv** (Python tooling for `apps/etl`; see https://docs.astral.sh/uv/)
- A free **Stripe account** in test mode, only needed to try payments

## Getting started

```bash
git clone <repository-url> enterprise-shop
cd enterprise-shop

pnpm install
cp .env.example .env      # then edit .env (see "Configuration")
pnpm db:up                # start PostgreSQL in Docker
pnpm db:migrate           # create the database tables
pnpm db:seed              # base data: products, two accounts, exchange rates
pnpm db:seed:demo         # optional: ~220 demo orders and 12 demo customers
pnpm warehouse:init       # optional: create the analytics warehouse
pnpm dev                  # web on :3001, API on :4000
```

Open http://localhost:3001. Without Stripe keys everything works except paying.

> `pnpm db:seed` **deletes every user, order and product** before reloading the base data. Only use it on a database you are happy to reset.

**Accounts.** The base seed creates one admin (`admin@shop.test`) and one customer (`customer@shop.test`). Their demo passwords are defined in `packages/db/prisma/seed.ts`. The demo seed adds customers `demo.customer01@shop.test` to `demo.customer12@shop.test`; their password is set in `packages/db/prisma/seed-demo.ts`. You can also register new accounts at `/register`. These are local demo credentials only.

## Configuration

All settings live in one `.env` file at the repository root, shared by the API, the web app, Prisma and the ETL job. `.env` is git-ignored; **never commit it**. `.env.example` lists every variable with safe local defaults.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Connection string for the app database |
| `WAREHOUSE_URL` | Connection string for the analytics warehouse database |
| `API_PORT`, `API_URL` | Port the API listens on and the address the web app uses to reach it |
| `WEB_URL` | Public address of the web app (used for Stripe redirect URLs and CORS) |
| `JWT_SECRET` | Secret used to sign login tokens. **Set your own**, for example with `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | Login token lifetime (default `7d`) |
| `STRIPE_SECRET_KEY` | Your Stripe **test** secret key (starts with `sk_test_`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret printed by `pnpm stripe:listen` |
| `GEO_DEV_IP` | Stand-in IP address used for country detection on localhost |
| `GEO_DEFAULT_COUNTRY` | Country used when nothing can be detected |

If you change the web port, update `WEB_URL` and the port in `apps/web/package.json` to match. The API only reads `.env` when it starts, so restart it after changes.

## Stripe test payments

1. Create a free Stripe account and switch to **test mode** (sandbox).
2. In the dashboard open **Developers > API keys** and put the secret key (`sk_test_...`) in `STRIPE_SECRET_KEY`.
3. In a second terminal run `pnpm stripe:listen`. The Stripe CLI is a dev dependency of this repo, so nothing is installed globally and no `stripe login` is needed. It prints a `whsec_...` signing secret; put it in `STRIPE_WEBHOOK_SECRET`.
4. Restart the API, then pay with a test card such as `4242 4242 4242 4242`, any future expiry date and any CVC. Stripe documents more test cards, including declines and 3D Secure.

Orders become **PAID** when Stripe's webhook arrives. If it never does (for example the listener was not running), open the order and use **Check payment status**, or return to the checkout success page; both ask Stripe directly.

Never use live keys with this project.

## Country and currency

- The web app detects the visitor's country from their IP using a bundled country database (public-domain data; no account and no network calls). A country chosen in the header overrides detection, and "Auto" returns to it.
- Supported currencies: USD (also the fallback), AUD, GBP, CAD and EUR.
- Product prices are stored in USD and converted with exchange rates kept in the database. Admins edit the demo rates at `/admin/rates`. Each order records the currency and rate it was charged at.
- On localhost your address is private and has no country, so `GEO_DEV_IP` stands in for it. Try `1.1.1.1` (Australia), `8.8.8.8` (United States) or `81.2.69.142` (United Kingdom).

## Business rules at a glance

- Coupons: `WELCOME10` takes 10% off the subtotal; `FREESHIP` removes shipping.
- Shipping: a flat fee of 7.50 USD, free for subtotals of 100 USD or more (converted to the shopper's currency).
- Tax: 8% of the discounted subtotal; shipping is not taxed.
- Stock is reduced when an order is paid, not when it is created.

Full details and acceptance criteria are in [docs/requirements.md](docs/requirements.md).

## Data warehouse

`apps/etl` copies orders, customers and products from the app database into a separate `warehouse` database with staging tables, a star schema (dimensions and facts), and reporting views. Amounts are available in the order currency and in USD.

```bash
pnpm warehouse:init     # once: create the database, tables, constraints and views
pnpm warehouse:run      # incremental load (changes since the last successful run)
pnpm warehouse:full     # reload everything
pnpm warehouse:status   # recent runs and row counts
```

The model, rules and limitations are described in [docs/warehouse.md](docs/warehouse.md); a data dictionary is available in the view `reporting.v_data_dictionary`.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the web app and API with live reload |
| `pnpm build` | Build everything |
| `pnpm lint`, `pnpm typecheck` | Static checks |
| `pnpm test` | Run the unit tests |
| `pnpm format` | Format the code with Prettier |
| `pnpm db:up`, `pnpm db:down` | Start or stop PostgreSQL |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:seed` | Reset to the base data (**destructive**) |
| `pnpm db:seed:demo` | Add or regenerate the demo orders |
| `pnpm db:reset` | Drop and recreate the database from migrations, then re-run the base seed (**destructive**) |
| `pnpm warehouse:*` | Warehouse commands (see above) |
| `pnpm stripe:listen` | Forward Stripe test webhooks to the API |

## Testing

`pnpm test` runs the developer unit tests (Vitest), which sit next to the code in `packages/shared`, `apps/api` and `apps/web`. They cover business rules such as pricing, currency conversion, validation, permissions and the Stripe payment decision logic. There are no integration, API, end-to-end, performance, security or data tests in this repository; the project is meant to be tested from outside.

Useful when planning tests:
- [docs/requirements.md](docs/requirements.md) describes intended behaviour.
- The API is documented interactively at http://localhost:4000/api/docs.
- The storefront has no dedicated test hooks (such as `data-testid`); use labels, roles and text.
- The web app reads the `x-forwarded-for` header for country detection, and the `shop_country` cookie pins a country.
- Payment happens on Stripe's hosted page, which is difficult to automate; many teams exercise it manually and test around it.

GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, build and unit tests on pushes and pull requests.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| `pnpm install` stops with `ERR_PNPM_IGNORED_BUILDS` | A dependency has an install script pnpm has not been told about. Run `pnpm approve-builds` and decide per package; the choices are stored in `pnpm-workspace.yaml`. |
| `pnpm db:up` fails | Docker Desktop is not running. |
| Port already in use | Another program uses 3001, 4000 or 5432. Stop it or change the port (and `WEB_URL` / `API_URL` to match). |
| Prices always show USD locally | Set `GEO_DEV_IP` in `.env` and restart the API, or pick a country in the header. |
| Paid order stays `PENDING` | `pnpm stripe:listen` was not running or `STRIPE_WEBHOOK_SECRET` is wrong. Use **Check payment status** on the order. |
| "Stripe is not configured" when paying | `STRIPE_SECRET_KEY` is missing or still a placeholder; restart the API after setting it. |
| Web or API errors after running `pnpm build` while `pnpm dev` was running | Both write to the same output folders. Stop `pnpm dev` and start it again. |
| Environment changes have no effect | Restart the API (and web app) so they re-read `.env`. |

## Security notes

- This is a demo for local use. Seeded accounts, the database password in `infra/docker-compose.yml` and the default values in `.env.example` are placeholders; change them for anything beyond your own machine.
- Keep `.env` out of version control and use Stripe test keys only.
- The country database is built from regional registry data. It is country-level and not always accurate, and it is used only to pre-fill defaults.

## Conventions

- Money is stored as integer cents everywhere. Product prices are in USD; other currencies are derived with the exchange-rate table. Pricing and conversion rules live in `packages/shared`.
- Inputs are validated with the zod schemas in `packages/shared`.
- The web app calls the API only from the server, and the login token is kept in an httpOnly cookie.
- Small, focused commits, one feature slice at a time.

## More documentation

- [docs/requirements.md](docs/requirements.md): features, business rules and acceptance criteria
- [docs/architecture.md](docs/architecture.md): how the pieces fit together and the checkout flow
- [docs/api.md](docs/api.md): endpoint overview (full detail in Swagger)
- [docs/warehouse.md](docs/warehouse.md): warehouse model, rules and limitations

## License

No license has been specified for this project.
