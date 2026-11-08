# Architecture

```
Browser ──> apps/web (Next.js, :3001) ──server-side fetch──> apps/api (NestJS, :4000) ──> Postgres (:5432)
                                                                   │
                                                                   └──> Stripe (Checkout, test mode)
Stripe ──webhook──> apps/api  /api/webhooks/stripe
```

- **apps/web** renders pages on the server and calls the API from the server only. Login stores the JWT in an httpOnly cookie (`shop_token`). Forms use Next.js server actions; errors come back as `?error=` on the redirect.
- **apps/api** is a NestJS REST API with the global prefix `/api`. Modules: auth, products (plus admin routes), cart, orders, payments (Stripe webhook), health. Auth uses a bearer JWT and a roles guard. Request bodies are validated with zod schemas from `packages/shared`.
- **packages/db** holds the Prisma schema, migrations and seed. Models: User, Product, Cart, CartItem, Order, OrderItem.
- **packages/shared** holds pricing, role/permission helpers and the zod schemas used by both apps.

## Checkout flow
1. Web calls `POST /api/orders/checkout` with the shipping address and optional coupon.
2. API recomputes totals from the database, creates a `PENDING` order with item snapshots, and creates a Stripe Checkout session (line items, tax line, discount coupon, shipping option).
3. Web redirects the browser to Stripe. On return it shows `/checkout/success?order=<id>`.
4. Stripe calls the webhook. `checkout.session.completed` marks the order `PAID`, decrements stock and empties the cart in one transaction.

## Environment
See `.env.example`. One `.env` at the repo root is shared by the API, the web app and Prisma.

## Ports
Web 3001, API 4000, Postgres 5432. Port 3000 is deliberately unused here.
