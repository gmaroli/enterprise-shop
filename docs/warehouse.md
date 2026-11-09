# Data warehouse

An analytics copy of the shop data, kept in a separate Postgres database (`warehouse`) on the same server as the app database. A Python job (`apps/etl`) loads it.

```
app database (shop)  ──extract──>  staging  ──transform──>  dw (star schema)  ──>  reporting views
   User, Product,                  stg_*                     dim_*, fact_*          v_*
   Order, OrderItem
```

## Run it
```bash
pnpm db:up
pnpm warehouse:init      # once: creates the database, schemas, tables, views
pnpm warehouse:run       # incremental load (changes since the last successful batch)
pnpm warehouse:full      # reload everything, ignoring watermarks
pnpm warehouse:status    # recent batches and row counts
```
Optional demo history (about 220 orders over 90 days, 12 extra customers, priced in the shipping country's currency): `pnpm db:seed:demo`. It replaces only its own `demo_` rows and stamps them with the current time so the next incremental load picks them up; run `pnpm warehouse:full` after changing demo data.

Connect with any Postgres client using the `WAREHOUSE_URL` value from your `.env` (see `.env.example` for the format).
To run on a schedule, a cron entry such as `*/15 * * * * cd /path/to/enterprise-shop && pnpm warehouse:run` is enough for local use.

## Schemas
| Schema | Contents |
| --- | --- |
| `etl` | `batch_log` (one row per run), `watermark` (last source `updatedAt` loaded per table) |
| `staging` | `stg_user`, `stg_product`, `stg_order`, `stg_order_item`: latest copy of each source row plus `_batch_id`, `_loaded_at`, `_deleted_at` |
| `dw` | Dimensions `dim_date`, `dim_customer`, `dim_product`; facts `fact_orders`, `fact_order_lines` |
| `reporting` | Views for sales by day, product, category and month, customers, order status, coupons (including shipping waived), sales by currency, ETL runs, and `v_data_dictionary`. Money columns are in USD and end in `_usd_cents`. |

## Model
| Table | Grain | Key notes |
| --- | --- | --- |
| `dim_date` | one calendar day, 2024-01-01 to 2030-12-31 | `date_key` is `yyyymmdd` |
| `dim_customer` | one row per customer | Type 1: values are overwritten; `is_deleted` set if removed in the source |
| `dim_product` | one row per product **version** | Type 2: tracked attributes are sku, name, description, category, price, currency, active (stock is not tracked); `valid_from`, `valid_to`, `is_current` |
| `fact_orders` | one row per order | all statuses; date keys for created and paid; amounts in the order currency and in USD; `fx_rate`; `shipping_waived_cents` |
| `fact_order_lines` | one row per order line | product version valid at order time; order-level amounts allocated to lines |

`customer_key = -1` and `product_key = -1` are "Unknown" members used when a lookup fails.

`dw.ref_pricing_rule` holds the business constants the transforms need (flat shipping fee, free-shipping threshold, tax rate). It must be kept in step with `packages/shared/src/pricing.ts`, because the warehouse does not read the app's code.

## Business rules
- **Dates** are UTC calendar dates. Source timestamps are stored in UTC.
- **Paid** means order status `PAID`. Reporting views count only paid orders, dated by payment date, except `v_order_status_summary` (all statuses) and the per-customer unsuccessful-order count.
- **Money** stays in integer cents. Orders can be in USD, AUD, GBP, CAD or EUR. Amounts without `_usd` are in the order's own `currency`; `*_usd_cents` columns hold the same amounts in USD, the reporting currency.
- **Currency conversion:** `fx_rate` is the units of the order currency per 1 USD that the app used when the order was placed (history is never re-valued with newer rates). Each component (subtotal, discount, shipping, tax) is converted as `value / fx_rate`, rounded to the cent; `total_usd_cents` is the sum of the converted components, so USD amounts always add up and can differ by a cent or two from converting `total_cents` directly. USD orders have `fx_rate = 1` and identical local and USD amounts. Line-level USD amounts are allocated from the order's USD amounts with the same rule as below, so lines add up in USD too.
- **Shipping waived:** for an order with the `FREESHIP` coupon whose shipping charge is 0 and whose subtotal (before discount) is below the free-shipping threshold, `shipping_waived_cents` is the flat shipping fee. The fee and the threshold come from `dw.ref_pricing_rule` (USD) converted with the order's `fx_rate` and rounded, as the app does; `shipping_waived_usd_cents` is that amount converted to USD. In every other case it is 0, including `FREESHIP` orders that would have had free shipping anyway.
- **Allocation:** each line gets a share of the order's discount, shipping and tax in proportion to its `line_amount_cents` (quantity x unit price). Shares are rounded down; the leftover cents go to the largest line (ties broken by lowest line id). `line_total_cents = line_amount - discount + shipping + tax`.
- **Product version lookup:** a line points to the `dim_product` row whose `[valid_from, valid_to)` contains the order's creation time. If none does (for example history loaded after the fact), the earliest version is used.
- **Change detection:** the extract reads rows with `updatedAt >=` the stored watermark (a row at the boundary may be read again; loads are idempotent). Order lines follow their order.
- **Rebuild of facts:** every order touched in a batch is deleted from both facts and rebuilt from staging.
- **Deletes:** rows that disappear from the source are kept in staging with `_deleted_at`, flagged in dimensions, and removed from the facts.
- **Atomic batches:** staging, dimensions, facts and watermarks are written in one transaction; a failed batch leaves no partial data and is recorded in `etl.batch_log` with its error.

## Integrity and structure
`pnpm warehouse:init` is repeatable and applies, in order: tables, constraints and indexes, the data dictionary, and views.

- **Constraints:** NOT NULL on keys and measures; domain checks (status values, roles, currency format, two-letter country, non-negative amounts, positive quantities); foreign keys from facts to dimensions and from order lines to orders (deleting an order removes its lines); a unique "one current version per product" rule; a check that `is_current` agrees with `valid_to`; and an exclusion constraint so a product's versions can never overlap in time.
- **Not enforced:** rules that reconcile values against each other, such as total = subtotal - discount + shipping + tax, or line allocations adding up to the order. These are left to data testing.
- **Staging** has domain checks but no foreign keys, because it is a raw copy loaded in table order.
- **Indexes** support the reporting views: order and line date keys, partial indexes on paid rows, customer and product lookups, and `sku` on the product dimension.
- **Statistics** are refreshed with `ANALYZE` at the end of every load.
- **Data dictionary:** every table and column has a description. Query `reporting.v_data_dictionary`, or `\d+` in psql.

## Known limitations
- Product history is captured when the job runs. Two changes to a product between runs produce one new version, not two.
- Delete detection compares complete id lists, which is fine at this size but would need a different approach for very large tables.
- No late-arriving dimension handling and no scheduler or alerting; runs are started by hand or cron.
- Exchange rates are the app's static demo rates. The warehouse trusts the rate stored on each order and does not fetch or revalue rates.
- Reporting view columns were renamed to carry explicit `_usd_cents` units when multi-currency was added; saved queries against the earlier column names (`total_cents`, `net_cents`, and similar) need updating.
- Schema changes are applied by editing the idempotent SQL files in `apps/etl/sql`, not by versioned migrations. There are no separate database roles; everything uses the `shop` user.
