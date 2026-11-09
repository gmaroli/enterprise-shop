-- Fact loads. Orders touched in this batch are deleted from both facts and rebuilt.

DELETE FROM dw.fact_order_lines
WHERE order_id IN (SELECT id FROM staging.stg_order WHERE _batch_id = %(batch_id)s);

DELETE FROM dw.fact_orders
WHERE order_id IN (SELECT id FROM staging.stg_order WHERE _batch_id = %(batch_id)s);

-- Orders (dates are UTC calendar dates).
INSERT INTO dw.fact_orders
  (order_id, date_key, paid_date_key, customer_key, status, coupon_code, shipping_country,
   shipping_city, line_count, units, subtotal_cents, discount_cents, shipping_cents, tax_cents,
   total_cents, currency, created_at, paid_at, source_updated_at, shipping_waived_cents, _batch_id)
SELECT
  o.id,
  to_char(o.created_at AT TIME ZONE 'UTC', 'YYYYMMDD')::int,
  to_char(o.paid_at AT TIME ZONE 'UTC', 'YYYYMMDD')::int,
  COALESCE(c.customer_key, -1),
  o.status,
  o.coupon_code,
  o.shipping_country,
  o.shipping_city,
  (SELECT count(*) FROM staging.stg_order_item i
    WHERE i.order_id = o.id AND i._deleted_at IS NULL),
  (SELECT COALESCE(sum(i.quantity), 0) FROM staging.stg_order_item i
    WHERE i.order_id = o.id AND i._deleted_at IS NULL),
  o.subtotal_cents, o.discount_cents, o.shipping_cents, o.tax_cents, o.total_cents,
  o.currency, o.created_at, o.paid_at, o.updated_at,
  -- FREESHIP removes the flat fee that would otherwise apply below the free-shipping threshold.
  CASE WHEN o.coupon_code = 'FREESHIP' AND o.shipping_cents = 0
        AND o.subtotal_cents < (SELECT numeric_value FROM dw.ref_pricing_rule WHERE rule_name = 'free_shipping_threshold_cents')
       THEN (SELECT numeric_value::int FROM dw.ref_pricing_rule WHERE rule_name = 'flat_shipping_cents')
       ELSE 0 END,
  %(batch_id)s
FROM staging.stg_order o
LEFT JOIN dw.dim_customer c ON c.customer_id = o.user_id
WHERE o._batch_id = %(batch_id)s AND o._deleted_at IS NULL;

-- Order lines with allocation of order-level amounts.
WITH lines AS (
  SELECT
    i.id AS order_item_id, i.order_id, i.product_id, i.quantity, i.unit_price_cents,
    i.quantity * i.unit_price_cents AS line_amount_cents,
    o.user_id, o.status, o.created_at, o.paid_at,
    o.subtotal_cents, o.discount_cents, o.shipping_cents, o.tax_cents,
    row_number() OVER (
      PARTITION BY i.order_id
      ORDER BY i.quantity * i.unit_price_cents DESC, i.id ASC
    ) AS rn
  FROM staging.stg_order_item i
  JOIN staging.stg_order o ON o.id = i.order_id
  WHERE o._batch_id = %(batch_id)s AND o._deleted_at IS NULL AND i._deleted_at IS NULL
),
base AS (
  SELECT l.*,
    CASE WHEN subtotal_cents = 0 THEN 0
         ELSE (discount_cents::bigint * line_amount_cents / subtotal_cents)::int END AS discount_base,
    CASE WHEN subtotal_cents = 0 THEN 0
         ELSE (shipping_cents::bigint * line_amount_cents / subtotal_cents)::int END AS shipping_base,
    CASE WHEN subtotal_cents = 0 THEN 0
         ELSE (tax_cents::bigint * line_amount_cents / subtotal_cents)::int END AS tax_base
  FROM lines l
),
alloc AS (
  SELECT b.*,
    discount_base + CASE WHEN rn = 1
      THEN discount_cents - sum(discount_base) OVER (PARTITION BY order_id) ELSE 0 END AS alloc_discount,
    shipping_base + CASE WHEN rn = 1
      THEN shipping_cents - sum(shipping_base) OVER (PARTITION BY order_id) ELSE 0 END AS alloc_shipping,
    tax_base + CASE WHEN rn = 1
      THEN tax_cents - sum(tax_base) OVER (PARTITION BY order_id) ELSE 0 END AS alloc_tax
  FROM base b
)
INSERT INTO dw.fact_order_lines
  (order_item_id, order_id, date_key, paid_date_key, customer_key, product_key, status, quantity,
   unit_price_cents, line_amount_cents, allocated_discount_cents, allocated_shipping_cents,
   allocated_tax_cents, line_total_cents, _batch_id)
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
  %(batch_id)s
FROM alloc a
LEFT JOIN dw.dim_customer c ON c.customer_id = a.user_id
-- Product version valid when the order was placed; if none covers that moment
-- (for example history loaded after the order), use the earliest version.
LEFT JOIN LATERAL (
  SELECT d.product_key
  FROM dw.dim_product d
  WHERE d.product_id = a.product_id
  ORDER BY (a.created_at >= d.valid_from AND a.created_at < d.valid_to) DESC, d.valid_from ASC
  LIMIT 1
) p ON true;
