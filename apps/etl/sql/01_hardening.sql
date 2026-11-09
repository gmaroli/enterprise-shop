-- Integrity rules, indexes and extensions. Safe to run repeatedly.
-- Scope: structure and domain rules only. Cross-column reconciliation (for example totals adding
-- up, allocations summing to the order) is deliberately NOT enforced here.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION etl.add_constraint_if_missing(tbl regclass, cname text, definition text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = tbl AND conname = cname) THEN
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', tbl, cname, definition);
  END IF;
END
$$;

-- "Unknown" members get real values so key columns can be NOT NULL.
UPDATE dw.dim_customer SET created_at = '1900-01-01 00:00:00+00' WHERE customer_key = -1 AND created_at IS NULL;
UPDATE dw.dim_customer SET _batch_id = 0 WHERE customer_key = -1 AND _batch_id IS NULL;
UPDATE dw.dim_product SET price_cents = 0 WHERE product_key = -1 AND price_cents IS NULL;
UPDATE dw.dim_product SET _batch_id = 0 WHERE product_key = -1 AND _batch_id IS NULL;

ALTER TABLE dw.dim_customer ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE dw.dim_customer ALTER COLUMN _batch_id SET NOT NULL;
ALTER TABLE dw.dim_product ALTER COLUMN price_cents SET NOT NULL;
ALTER TABLE dw.dim_product ALTER COLUMN _batch_id SET NOT NULL;

-- ------------------------------------------------------------ etl
SELECT etl.add_constraint_if_missing('etl.batch_log', 'batch_log_mode_chk', $$CHECK (mode IN ('INCREMENTAL', 'FULL'))$$);
SELECT etl.add_constraint_if_missing('etl.batch_log', 'batch_log_status_chk', $$CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED'))$$);
SELECT etl.add_constraint_if_missing('etl.batch_log', 'batch_log_times_chk', $$CHECK (finished_at IS NULL OR finished_at >= started_at)$$);

-- ------------------------------------------------------------ staging (domain rules only, no foreign keys)
SELECT etl.add_constraint_if_missing('staging.stg_user', 'stg_user_role_chk', $$CHECK (role IN ('CUSTOMER', 'ADMIN'))$$);
SELECT etl.add_constraint_if_missing('staging.stg_product', 'stg_product_price_chk', $$CHECK (price_cents >= 0 AND stock >= 0)$$);
SELECT etl.add_constraint_if_missing('staging.stg_order', 'stg_order_status_chk', $$CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED'))$$);
SELECT etl.add_constraint_if_missing('staging.stg_order', 'stg_order_amounts_chk', $$CHECK (subtotal_cents >= 0 AND discount_cents >= 0 AND shipping_cents >= 0 AND tax_cents >= 0 AND total_cents >= 0)$$);
SELECT etl.add_constraint_if_missing('staging.stg_order_item', 'stg_order_item_qty_chk', $$CHECK (quantity > 0 AND unit_price_cents >= 0)$$);

-- ------------------------------------------------------------ dimensions
SELECT etl.add_constraint_if_missing('dw.dim_customer', 'dim_customer_role_chk', $$CHECK (role IN ('CUSTOMER', 'ADMIN', 'UNKNOWN'))$$);
SELECT etl.add_constraint_if_missing('dw.dim_product', 'dim_product_price_chk', $$CHECK (price_cents >= 0)$$);
SELECT etl.add_constraint_if_missing('dw.dim_product', 'dim_product_currency_chk', $$CHECK (currency ~ '^[a-z]{3}$')$$);
SELECT etl.add_constraint_if_missing('dw.dim_product', 'dim_product_validity_chk', $$CHECK (valid_from <= valid_to)$$);
SELECT etl.add_constraint_if_missing('dw.dim_product', 'dim_product_current_chk', $$CHECK (is_current = (valid_to = '9999-12-31 00:00:00+00'::timestamptz))$$);
-- A product's versions can never overlap in time.
SELECT etl.add_constraint_if_missing('dw.dim_product', 'dim_product_no_overlap_excl',
  $$EXCLUDE USING gist (product_id WITH =, tstzrange(valid_from, valid_to) WITH &&)$$);

-- ------------------------------------------------------------ facts
SELECT etl.add_constraint_if_missing('dw.fact_orders', 'fact_orders_status_chk', $$CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED'))$$);
SELECT etl.add_constraint_if_missing('dw.fact_orders', 'fact_orders_amounts_chk',
  $$CHECK (subtotal_cents >= 0 AND discount_cents >= 0 AND shipping_cents >= 0 AND tax_cents >= 0 AND total_cents >= 0 AND shipping_waived_cents >= 0)$$);
SELECT etl.add_constraint_if_missing('dw.fact_orders', 'fact_orders_counts_chk', $$CHECK (line_count >= 0 AND units >= 0)$$);
SELECT etl.add_constraint_if_missing('dw.fact_orders', 'fact_orders_country_chk', $$CHECK (char_length(shipping_country) = 2)$$);
SELECT etl.add_constraint_if_missing('dw.fact_orders', 'fact_orders_currency_chk', $$CHECK (currency ~ '^[a-z]{3}$')$$);

SELECT etl.add_constraint_if_missing('dw.fact_order_lines', 'fact_order_lines_status_chk', $$CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED'))$$);
SELECT etl.add_constraint_if_missing('dw.fact_order_lines', 'fact_order_lines_qty_chk', $$CHECK (quantity > 0 AND unit_price_cents >= 0)$$);
SELECT etl.add_constraint_if_missing('dw.fact_order_lines', 'fact_order_lines_amounts_chk',
  $$CHECK (line_amount_cents >= 0 AND allocated_discount_cents >= 0 AND allocated_shipping_cents >= 0 AND allocated_tax_cents >= 0)$$);
SELECT etl.add_constraint_if_missing('dw.fact_order_lines', 'fact_order_lines_order_fk',
  $$FOREIGN KEY (order_id) REFERENCES dw.fact_orders (order_id) ON DELETE CASCADE$$);

-- ------------------------------------------------------------ reference
SELECT etl.add_constraint_if_missing('dw.ref_pricing_rule', 'ref_pricing_rule_value_chk', $$CHECK (numeric_value >= 0)$$);

-- ------------------------------------------------------------ indexes (match reporting access paths)
CREATE INDEX IF NOT EXISTS fact_orders_date_idx          ON dw.fact_orders (date_key);
CREATE INDEX IF NOT EXISTS fact_orders_paid_date_idx     ON dw.fact_orders (paid_date_key) WHERE status = 'PAID';
CREATE INDEX IF NOT EXISTS fact_orders_customer_idx      ON dw.fact_orders (customer_key);
CREATE INDEX IF NOT EXISTS fact_order_lines_date_idx     ON dw.fact_order_lines (date_key);
CREATE INDEX IF NOT EXISTS fact_order_lines_paid_idx     ON dw.fact_order_lines (paid_date_key) WHERE status = 'PAID';
CREATE INDEX IF NOT EXISTS fact_order_lines_customer_idx ON dw.fact_order_lines (customer_key);
CREATE INDEX IF NOT EXISTS dim_product_sku_idx           ON dw.dim_product (sku);
