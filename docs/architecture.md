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
- **packages/shared** holds pricing, currency conversion, role/permission helpers and the zod schemas used by both apps.
- **Region and currency:** the web app works out the shopper's country (header selection, otherwise `GET /api/geo`, which looks the forwarded client IP up in a bundled country database) and passes the resulting currency to the API on product, cart and checkout calls. The API converts USD prices with the `ExchangeRate` table.

## Checkout flow

1. Web calls `POST /api/orders/checkout` with the shipping address and optional coupon.
2. API recomputes totals from the database in the shopper's currency (prices converted with the current exchange rate), creates a `PENDING` order with item snapshots, the currency and the rate used, and creates a Stripe Checkout session (line items, tax line, discount coupon, shipping option).
3. Web redirects the browser to Stripe. On return it shows `/checkout/success?order=<id>`.
4. Stripe calls the webhook. For a paid session whose amount and currency match the order, the order is marked `PAID`, stock is decremented and the cart is emptied in one transaction. The order is claimed with a conditional update, so duplicate or simultaneous deliveries are harmless.
5. Fallback: if the order is still `PENDING` when the customer lands on the success page (or presses "Check payment status" on the order page), the web app calls `POST /api/orders/:id/sync`. The API fetches the Checkout Session from Stripe and applies the same logic.

## Environment

See `.env.example`. One `.env` at the repo root is shared by the API, the web app and Prisma.

## Ports

Web 3001, API 4000, Postgres 5432. Port 3000 is deliberately unused here.
