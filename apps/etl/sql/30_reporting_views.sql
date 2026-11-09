-- Reporting layer. "Paid" means order status PAID; sales are dated by payment date.

CREATE OR REPLACE VIEW reporting.v_daily_sales AS
SELECT
  d.full_date                AS sales_date,
  count(*)                   AS orders,
  sum(f.units)               AS units,
  sum(f.subtotal_cents)      AS subtotal_cents,
  sum(f.discount_cents)      AS discount_cents,
  sum(f.shipping_cents)      AS shipping_cents,
  sum(f.tax_cents)           AS tax_cents,
  sum(f.total_cents)         AS total_cents
FROM dw.fact_orders f
JOIN dw.dim_date d ON d.date_key = f.paid_date_key
WHERE f.status = 'PAID'
GROUP BY d.full_date;

CREATE OR REPLACE VIEW reporting.v_sales_by_product AS
SELECT
  cur.sku,
  cur.name,
  cur.category,
  count(DISTINCT l.order_id)                                  AS orders,
  sum(l.quantity)                                             AS units,
  sum(l.line_amount_cents)                                    AS gross_cents,
  sum(l.allocated_discount_cents)                             AS discount_cents,
  sum(l.line_amount_cents - l.allocated_discount_cents)       AS net_cents
FROM dw.fact_order_lines l
JOIN dw.dim_product p   ON p.product_key = l.product_key
JOIN dw.dim_product cur ON cur.product_id = p.product_id AND cur.is_current
WHERE l.status = 'PAID'
GROUP BY cur.sku, cur.name, cur.category;

CREATE OR REPLACE VIEW reporting.v_sales_by_category_month AS
SELECT
  d.year_month,
  p.category,
  sum(l.quantity)                                       AS units,
  sum(l.line_amount_cents)                              AS gross_cents,
  sum(l.line_amount_cents - l.allocated_discount_cents) AS net_cents
FROM dw.fact_order_lines l
JOIN dw.dim_product p ON p.product_key = l.product_key
JOIN dw.dim_date d    ON d.date_key = l.paid_date_key
WHERE l.status = 'PAID'
GROUP BY d.year_month, p.category;

CREATE OR REPLACE VIEW reporting.v_customer_summary AS
SELECT
  c.customer_id,
  c.name,
  c.email,
  count(*) FILTER (WHERE f.status = 'PAID')                          AS paid_orders,
  count(*) FILTER (WHERE f.status IN ('CANCELLED', 'FAILED'))        AS unsuccessful_orders,
  COALESCE(sum(f.total_cents) FILTER (WHERE f.status = 'PAID'), 0)   AS lifetime_total_cents,
  round(avg(f.total_cents) FILTER (WHERE f.status = 'PAID'))         AS avg_order_value_cents,
  min(pd.full_date) FILTER (WHERE f.status = 'PAID')                 AS first_paid_date,
  max(pd.full_date) FILTER (WHERE f.status = 'PAID')                 AS last_paid_date
FROM dw.dim_customer c
LEFT JOIN dw.fact_orders f ON f.customer_key = c.customer_key
LEFT JOIN dw.dim_date pd   ON pd.date_key = f.paid_date_key
WHERE c.customer_key <> -1 AND c.role = 'CUSTOMER'
GROUP BY c.customer_id, c.name, c.email;

CREATE OR REPLACE VIEW reporting.v_order_status_summary AS
SELECT
  status,
  count(*)         AS orders,
  sum(total_cents) AS total_cents,
  round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct_of_orders
FROM dw.fact_orders
GROUP BY status;

CREATE OR REPLACE VIEW reporting.v_coupon_usage AS
SELECT
  coupon_code,
  count(*)            AS paid_orders,
  sum(discount_cents) AS discount_cents,
  sum(subtotal_cents) AS subtotal_cents,
  sum(shipping_waived_cents) AS shipping_waived_cents
FROM dw.fact_orders
WHERE status = 'PAID' AND coupon_code IS NOT NULL
GROUP BY coupon_code;

CREATE OR REPLACE VIEW reporting.v_etl_runs AS
SELECT batch_id, mode, status, started_at, finished_at,
       round(extract(epoch FROM finished_at - started_at)::numeric, 2) AS seconds,
       rows_extracted, error
FROM etl.batch_log
ORDER BY batch_id DESC;

CREATE OR REPLACE VIEW reporting.v_data_dictionary AS
SELECT
  c.table_schema,
  c.table_name,
  c.ordinal_position AS position,
  c.column_name,
  c.data_type,
  c.is_nullable = 'YES' AS nullable,
  col_description(
    (quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass,
    c.ordinal_position
  ) AS description
FROM information_schema.columns c
WHERE c.table_schema IN ('etl', 'staging', 'dw')
ORDER BY c.table_schema, c.table_name, c.ordinal_position;
