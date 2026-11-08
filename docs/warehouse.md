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
Optional demo history (about 220 orders over 90 days, 12 extra customers): `pnpm db:seed:demo`.

Connect with any Postgres client: `postgresql://shop:shop_local_pw@localhost:5432/warehouse`.
To run on a schedule, a cron entry such as `*/15 * * * * cd /path/to/enterprise-shop && pnpm warehouse:run` is enough for local use.

## Schemas
| Schema | Contents |
| --- | --- |
| `etl` | `batch_log` (one row per run), `watermark` (last source `updatedAt` loaded per table) |
| `staging` | `stg_user`, `stg_product`, `stg_order`, `stg_order_item`: latest copy of each source row plus `_batch_id`, `_loaded_at`, `_deleted_at` |
| `dw` | Dimensions `dim_date`, `dim_customer`, `dim_product`; facts `fact_orders`, `fact_order_lines` |
| `reporting` | Views for sales by day, product, category and month, customers, order status, coupons, ETL runs |

## Model
| Table | Grain | Key notes |
| --- | --- | --- |
| `dim_date` | one calendar day, 2024-01-01 to 2030-12-31 | `date_key` is `yyyymmdd` |
| `dim_customer` | one row per customer | Type 1: values are overwritten; `is_deleted` set if removed in the source |
| `dim_product` | one row per product **version** | Type 2: tracked attributes are sku, name, description, category, price, currency, active (stock is not tracked); `valid_from`, `valid_to`, `is_current` |
| `fact_orders` | one row per order | all statuses; dates keys for created and paid |
| `fact_order_lines` | one row per order line | product version valid at order time; order-level amounts allocated to lines |

`customer_key = -1` and `product_key = -1` are "Unknown" members used when a lookup fails.

## Business rules
- **Dates** are UTC calendar dates. Source timestamps are stored in UTC.
- **Paid** means order status `PAID`. Reporting views count only paid orders, dated by payment date, except `v_order_status_summary` (all statuses) and the per-customer unsuccessful-order count.
- **Money** stays in integer cents, as in the source.
- **Allocation:** each line gets a share of the order's discount, shipping and tax in proportion to its `line_amount_cents` (quantity x unit price). Shares are rounded down; the leftover cents go to the largest line (ties broken by lowest line id). `line_total_cents = line_amount - discount + shipping + tax`.
- **Product version lookup:** a line points to the `dim_product` row whose `[valid_from, valid_to)` contains the order's creation time. If none does (for example history loaded after the fact), the earliest version is used.
- **Change detection:** the extract reads rows with `updatedAt >=` the stored watermark (a row at the boundary may be read again; loads are idempotent). Order lines follow their order.
- **Rebuild of facts:** every order touched in a batch is deleted from both facts and rebuilt from staging.
- **Deletes:** rows that disappear from the source are kept in staging with `_deleted_at`, flagged in dimensions, and removed from the facts.
- **Atomic batches:** staging, dimensions, facts and watermarks are written in one transaction; a failed batch leaves no partial data and is recorded in `etl.batch_log` with its error.

## Known limitations
- Product history is captured when the job runs. Two changes to a product between runs produce one new version, not two.
- Delete detection compares complete id lists, which is fine at this size but would need a different approach for very large tables.
- No late-arriving dimension handling and no scheduler or alerting; runs are started by hand or cron.
