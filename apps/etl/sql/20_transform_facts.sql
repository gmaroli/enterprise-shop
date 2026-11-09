-- Fact loads. Orders touched in this batch are deleted from both facts and rebuilt.
--
-- Every amount is stored twice: in the order's own currency (*_cents) and in USD (*_usd_cents).
-- USD amounts are converted per component (value / fx_rate, rounded to the cent) and the USD total
-- is the sum of the converted components, so the USD figures always add up; this can differ by a
-- cent or two from converting the local total directly. At a rate of 1 (USD orders) both are equal.

DELETE FROM dw.fact_order_lines
WHERE order_id IN (SELECT id FROM staging.stg_order WHERE _batch_id = %(batch_id)s);

DELETE FROM dw.fact_orders
WHERE order_id IN (SELECT id FROM staging.stg_order WHERE _batch_id = %(batch_id)s);

-- Orders (dates are UTC calendar dates).
WITH rules AS (
  SELECT
    (SELECT numeric_value FROM dw.ref_pricing_rule WHERE rule_name = 'flat_shipping_cents') AS flat_usd,
    (SELECT numeric_value FROM dw.ref_pricing_rule WHERE rule_name = 'free_shipping_threshold_cents') AS threshold_usd
),
src AS (
  SELECT
    o.*,
    c.customer_key,
    round(o.subtotal_cents / o.fx_rate)::int AS subtotal_usd,
    round(o.discount_cents / o.fx_rate)::int AS discount_usd,
    round(o.shipping_cents / o.fx_rate)::int AS shipping_usd,
    round(o.tax_cents / o.fx_rate)::int      AS tax_usd,
    -- FREESHIP removes the flat fee that would otherwise apply below the free-shipping threshold,
    -- both converted to the order currency the same way the app converts them.
    CASE WHEN o.coupon_code = 'FREESHIP' AND o.shipping_cents = 0
              AND o.subtotal_cents < round(r.threshold_usd * o.fx_rate)
         THEN round(r.flat_usd * o.fx_rate)::int
         ELSE 0 END AS waived
  FROM staging.stg_order o
  CROSS JOIN rules r
  LEFT JOIN dw.dim_customer c ON c.customer_id = o.user_id
  WHERE o._batch_id = %(batch_id)s AND o._deleted_at IS NULL
)
INSERT INTO dw.fact_orders
  (order_id, date_key, paid_date_key, customer_key, status, coupon_code, shipping_country,
   shipping_city, line_count, units, subtotal_cents, discount_cents, shipping_cents, tax_cents,
   total_cents, currency, created_at, paid_at, source_updated_at, shipping_waived_cents,
   fx_rate, subtotal_usd_cents, discount_usd_cents, shipping_usd_cents, tax_usd_cents,
   total_usd_cents, shipping_waived_usd_cents, _batch_id)
SELECT
  s.id,
  to_char(s.created_at AT TIME ZONE 'UTC', 'YYYYMMDD')::int,
  to_char(s.paid_at AT TIME ZONE 'UTC', 'YYYYMMDD')::int,
  COALESCE(s.customer_key, -1),
  s.status,
  s.coupon_code,
  s.shipping_country,
  s.shipping_city,
  (SELECT count(*) FROM staging.stg_order_item i
    WHERE i.order_id = s.id AND i._deleted_at IS NULL),
  (SELECT COALESCE(sum(i.quantity), 0) FROM staging.stg_order_item i
    WHERE i.order_id = s.id AND i._deleted_at IS NULL),
  s.subtotal_cents, s.discount_cents, s.shipping_cents, s.tax_cents, s.total_cents,
  s.currency, s.created_at, s.paid_at, s.updated_at,
  s.waived,
  s.fx_rate,
  s.subtotal_usd, s.discount_usd, s.shipping_usd, s.tax_usd,
  s.subtotal_usd - s.discount_usd + s.shipping_usd + s.tax_usd,
  round(s.waived / s.fx_rate)::int,
  %(batch_id)s
FROM src s;

-- Order lines with allocation of order-level amounts (local currency and USD).
WITH lines AS (
  SELECT
    i.id AS order_item_id, i.order_id, i.product_id, i.quantity, i.unit_price_cents,
    i.quantity * i.unit_price_cents AS line_amount_cents,
    o.user_id, o.status, o.created_at, o.paid_at,
    o.subtotal_cents, o.discount_cents, o.shipping_cents, o.tax_cents,
    fo.subtotal_usd_cents, fo.discount_usd_cents, fo.shipping_usd_cents, fo.tax_usd_cents,
    row_number() OVER (
      PARTITION BY i.order_id
      ORDER BY i.quantity * i.unit_price_cents DESC, i.id ASC
    ) AS rn
  FROM staging.stg_order_item i
  JOIN staging.stg_order o ON o.id = i.order_id
  JOIN dw.fact_orders fo   ON fo.order_id = o.id
  WHERE o._batch_id = %(batch_id)s AND o._deleted_at IS NULL AND i._deleted_at IS NULL
),
base AS (
  -- Each share is rounded down; the leftover cents go to the largest line (rn = 1) below.
  SELECT l.*,
    CASE WHEN subtotal_cents = 0 THEN 0 ELSE (discount_cents::bigint * line_amount_cents / subtotal_cents)::int END AS discount_base,
    CASE WHEN subtotal_cents = 0 THEN 0 ELSE (shipping_cents::bigint * line_amount_cents / subtotal_cents)::int END AS shipping_base,
    CASE WHEN subtotal_cents = 0 THEN 0 ELSE (tax_cents::bigint * line_amount_cents / subtotal_cents)::int END AS tax_base,
    CASE WHEN subtotal_cents = 0 THEN 0 ELSE (subtotal_usd_cents::bigint * line_amount_cents / subtotal_cents)::int END AS amount_usd_base,
    CASE WHEN subtotal_cents = 0 THEN 0 ELSE (discount_usd_cents::bigint * line_amount_cents / subtotal_cents)::int END AS discount_usd_base,
    CASE WHEN subtotal_cents = 0 THEN 0 ELSE (shipping_usd_cents::bigint * line_amount_cents / subtotal_cents)::int END AS shipping_usd_base,
    CASE WHEN subtotal_cents = 0 THEN 0 ELSE (tax_usd_cents::bigint * line_amount_cents / subtotal_cents)::int END AS tax_usd_base
  FROM lines l
),
alloc AS (
  SELECT b.*,
    discount_base + CASE WHEN rn = 1 THEN discount_cents - sum(discount_base) OVER w ELSE 0 END AS alloc_discount,
    shipping_base + CASE WHEN rn = 1 THEN shipping_cents - sum(shipping_base) OVER w ELSE 0 END AS alloc_shipping,
    tax_base      + CASE WHEN rn = 1 THEN tax_cents      - sum(tax_base)      OVER w ELSE 0 END AS alloc_tax,
    amount_usd_base   + CASE WHEN rn = 1 THEN subtotal_usd_cents - sum(amount_usd_base)   OVER w ELSE 0 END AS amount_usd,
    discount_usd_base + CASE WHEN rn = 1 THEN discount_usd_cents - sum(discount_usd_base) OVER w ELSE 0 END AS alloc_discount_usd,
    shipping_usd_base + CASE WHEN rn = 1 THEN shipping_usd_cents - sum(shipping_usd_base) OVER w ELSE 0 END AS alloc_shipping_usd,
    tax_usd_base      + CASE WHEN rn = 1 THEN tax_usd_cents      - sum(tax_usd_base)      OVER w ELSE 0 END AS alloc_tax_usd
  FROM base b
  WINDOW w AS (PARTITION BY order_id)
)
INSERT INTO dw.fact_order_lines
  (order_item_id, order_id, date_key, paid_date_key, customer_key, product_key, status, quantity,
   unit_price_cents, line_amount_cents, allocated_discount_cents, allocated_shipping_cents,
   allocated_tax_cents, line_total_cents,
   line_amount_usd_cents, allocated_discount_usd_cents, allocated_shipping_usd_cents,
   allocated_tax_usd_cents, line_total_usd_cents, _batch_id)
SELECT
  a.order_item_id,
  a.order_id,
  to_char(a.created_at AT TIME ZONE 'UTC', 'YYYYMMDD')::int,
  to_char(a.paid_at AT TIME ZONE 'UTC', 'YYYYMMDD')::int,
  COALESCE(c.customer_key, -1),
  COALESCE(p.product_key, -1),
  a.status,
  a.quantity,
  a.unit_price_cents,
  a.line_amount_cents,
  a.alloc_discount,
  a.alloc_shipping,
  a.alloc_tax,
  a.line_amount_cents - a.alloc_discount + a.alloc_shipping + a.alloc_tax,
  a.amount_usd,
  a.alloc_discount_usd,
  a.alloc_shipping_usd,
  a.alloc_tax_usd,
  a.amount_usd - a.alloc_discount_usd + a.alloc_shipping_usd + a.alloc_tax_usd,
  %(batch_id)s
FROM alloc a
LEFT JOIN dw.dim_customer c ON c.customer_id = a.user_id
-- Product version valid when the order was placed; if none covers that moment
-- (for example history loaded after the fact), use the earliest version.
LEFT JOIN LATERAL (
  SELECT d.product_key
  FROM dw.dim_product d
  WHERE d.product_id = a.product_id
  ORDER BY (a.created_at >= d.valid_from AND a.created_at < d.valid_to) DESC, d.valid_from ASC
  LIMIT 1
) p ON true;
