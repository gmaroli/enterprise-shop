# Enterprise Shop

A demo e-commerce system (storefront, admin, REST API, Postgres, Stripe test-mode payments) organised as a pnpm + Turborepo monorepo.

| Part | Path | Port |
| --- | --- | --- |
| Web (Next.js, App Router) | `apps/web` | http://localhost:3001 |
| API (NestJS, Swagger at `/api/docs`) | `apps/api` | http://localhost:4000 |
| Database package (Prisma, migrations, seed) | `packages/db` | Postgres on 5432 |
| Shared logic (pricing, zod schemas, permissions) | `packages/shared` | |
| Shared TS config | `packages/config` | |
| Analytics warehouse loader (Python) | `apps/etl` | database `warehouse` on 5432 |
| Infrastructure (Docker Compose) | `infra/` | |
| Documentation | `docs/` | |

## Prerequisites
Node 22+, pnpm 12, Docker Desktop, and `uv` (Python tooling, for `apps/etl`).

## Run it locally
```bash
pnpm install
cp .env.example .env          # then edit: JWT_SECRET and the Stripe keys
pnpm db:up                    # starts Postgres in Docker
pnpm db:migrate               # applies migrations
pnpm db:seed                  # users and products (pnpm db:reset wipes and reloads)
pnpm dev                      # web on :3001, API on :4000
```

Seeded accounts:

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@shop.test | Admin123! |
| Customer | customer@shop.test | Customer123! |

## Country and currency
The storefront detects the visitor's country from their IP using a bundled database (no account, no network calls) and shows prices in that country's currency (USD, AUD, GBP, CAD, EUR). On localhost there is no public address, so set `GEO_DEV_IP` in `.env` (for example `1.1.1.1` = Australia, `8.8.8.8` = United States, `81.2.69.142` = United Kingdom). The header selector overrides detection. Admins edit the demo exchange rates at `/admin/rates`.

## Stripe (test mode only)
1. Create a free Stripe account and open the **test mode** dashboard.
2. Copy the test secret key (`sk_test_...`) into `STRIPE_SECRET_KEY` in `.env`.
3. The Stripe CLI is a dev dependency of this repo (nothing is installed globally). With `STRIPE_SECRET_KEY` set in `.env`, forward webhooks with:
   `pnpm stripe:listen`
   It authenticates with the key from `.env` (no `stripe login` needed) and prints a `whsec_...` value; put that in `STRIPE_WEBHOOK_SECRET`. Leave it running in its own terminal.
4. Restart the API. Pay with Stripe's test cards (for example `4242 4242 4242 4242`, any future expiry, any CVC). See Stripe's docs for more test card numbers.

Never use live keys with this project.

## Scripts
`pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (unit tests), `pnpm db:up`, `pnpm db:down`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:seed:demo` (demo order history), `pnpm db:reset`, `pnpm warehouse:init | warehouse:run | warehouse:full | warehouse:status`.

## More
- [docs/requirements.md](docs/requirements.md): features and business rules
- [docs/architecture.md](docs/architecture.md): how the pieces fit together
- [docs/api.md](docs/api.md): endpoint overview (full detail in Swagger)
- [docs/warehouse.md](docs/warehouse.md): data warehouse model, rules and how to run the ETL
