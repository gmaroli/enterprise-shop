# API overview

Base URL `http://localhost:4000/api`. Interactive docs: `/api/docs` (JSON at `/api/docs-json`). Protected endpoints take `Authorization: Bearer <token>`; get a token from `POST /auth/login`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | /health | none | Liveness and database check |
| POST | /auth/register | none | Create customer account, returns token |
| POST | /auth/login | none | Log in, returns token |
| GET | /auth/me | user | Current user |
| GET | /products | none | Search/list (`q`, `category`, `page`, `pageSize`) |
| GET | /products/categories | none | Category names |
| GET | /products/:id | none | One active product |
| GET/POST | /admin/products | admin | List all / create |
| GET/PUT/DELETE | /admin/products/:id | admin | Read / update / deactivate |
| GET | /cart | user | My cart and totals (`coupon` preview) |
| POST | /cart/items | user | Add item |
| PATCH/DELETE | /cart/items/:productId | user | Set quantity / remove |
| DELETE | /cart | user | Empty cart |
| POST | /orders/checkout | user | Create order and Stripe session |
| GET | /orders | user | My orders (`all=true` for admins) |
| GET | /orders/:id | owner/admin | Order details |
| POST | /orders/:id/sync | owner/admin | Re-check a pending order with Stripe and complete it if paid |
| POST | /webhooks/stripe | Stripe signature | Payment events |
