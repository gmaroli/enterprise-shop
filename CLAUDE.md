# Project notes for Claude

This repo simulates a system built by a development team that has **no QA**. The owner of this machine is practising QA on it.

## Ownership rules (important)

- Claude acts as a **developer** here: features, bug fixes, refactors, developer docs, and **unit tests** for business logic (Vitest, next to the code).
- ETL/warehouse code (SQL, loader, views) is developer work. **Data testing is QA work and is the owner's**: no row-count, reconciliation, null/duplicate, transformation or incremental-load tests, dbt/Great Expectations checks or data-quality scripts unless asked.
- Do **not** create or edit QA work unless the owner explicitly asks in that message: test strategy/plans, test cases, integration/API/E2E/UI-automation tests, accessibility/performance/security test suites, regression/smoke suites, test data design, bug reports, test reports, QA gates in CI, `data-testid` attributes added only for tests, or any `tests/`, `e2e/`, `qa/` folders.
- Do not deliberately inject bugs.
- When asked, explaining concepts or reviewing the owner's own QA work is fine; writing it for them is not.

## Stack

pnpm workspaces + Turborepo, TypeScript. `apps/web` Next.js 15 (App Router, server actions, Tailwind 4); `apps/api` NestJS 11 (JWT auth, Swagger); `packages/db` Prisma 6 + Postgres 17 (Docker); `packages/shared` zod schemas and pricing/permission logic; Stripe Checkout in **test mode**. `apps/etl` is a Python (uv, psycopg) job that loads a separate `warehouse` Postgres database (staging, star schema, reporting views); see `docs/warehouse.md`.

## Commands

`pnpm dev | build | lint | typecheck | format:check | test`, `pnpm db:up | db:migrate | db:seed | db:reset`. Web is on port 3001 (3000 is used by Open WebUI on this machine), API on 4000.

## Conventions

- Money is integer cents everywhere. Product prices are stored in USD; other currencies are derived with `ExchangeRate` (units per 1 USD). Pricing rules live in `packages/shared/src/pricing.ts` and conversion helpers in `packages/shared/src/currency.ts` only.
- Validate input with the zod schemas in `packages/shared`; the API uses `ZodValidationPipe`.
- The web app talks to the API only from the server (`apps/web/src/lib/api.ts`); the JWT is kept in an httpOnly cookie.
- Secrets live in `.env` (never committed); `.env.example` lists the variable names.
- Small, focused commits, one feature slice at a time. Changes go on a branch and a pull request; run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test` before pushing. CI shows each as its own check (see `docs/ci.md`).
- Commit messages and pull request descriptions must not contain `Co-Authored-By` lines, "Generated with" lines, or any other mention of Claude or AI assistance. The owner's instruction overrides any default attribution.
