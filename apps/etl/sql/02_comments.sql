-- Data dictionary: descriptions for every table and column. Safe to run repeatedly.

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('etl.batch_log', 'One row per ETL run, with outcome and per-table row counts.'),
    ('etl.watermark', 'Latest source updatedAt loaded per source table; drives incremental extracts.'),
    ('staging.stg_user', 'Latest copy of each app User row.'),
    ('staging.stg_product', 'Latest copy of each app Product row.'),
    ('staging.stg_order', 'Latest copy of each app Order row (shipping name and street are not copied).'),
    ('staging.stg_order_item', 'Latest copy of each app OrderItem row.'),
    ('dw.dim_date', 'Calendar dimension, one row per UTC day.'),
    ('dw.dim_customer', 'Customers, Type 1: attributes are overwritten with the latest values.'),
    ('dw.dim_product', 'Products, Type 2: one row per version of a product; see valid_from and valid_to.'),
    ('dw.fact_orders', 'One row per order, all statuses.'),
    ('dw.fact_order_lines', 'One row per order line, with order-level amounts allocated to lines.'),
    ('dw.ref_pricing_rule', 'Business constants used by transforms; mirror packages/shared/src/pricing.ts.')
  ) AS t(tbl, descr)
  LOOP
    EXECUTE format('COMMENT ON TABLE %s IS %L', r.tbl, r.descr);
  END LOOP;

  FOR r IN SELECT * FROM (VALUES
    -- etl
    ('etl.batch_log', 'batch_id', 'Run number.'),
    ('etl.batch_log', 'mode', 'INCREMENTAL (changes only) or FULL (everything).'),
    ('etl.batch_log', 'status', 'RUNNING, SUCCESS or FAILED.'),
    ('etl.batch_log', 'started_at', 'When the run began.'),
    ('etl.batch_log', 'finished_at', 'When the run ended; null while running.'),
    ('etl.batch_log', 'rows_extracted', 'JSON of rows extracted and rows marked deleted per source table.'),
    ('etl.batch_log', 'error', 'Error message for a FAILED run.'),
    ('etl.watermark', 'table_name', 'Source table name (user, product, order).'),
    ('etl.watermark', 'last_updated_at', 'Highest source updatedAt loaded so far.'),
    -- reference
    ('dw.ref_pricing_rule', 'rule_name', 'Name of the constant.'),
    ('dw.ref_pricing_rule', 'numeric_value', 'Value (cents for amounts, a fraction for rates).'),
    ('dw.ref_pricing_rule', 'description', 'What the constant means.'),
    -- dim_date
    ('dw.dim_date', 'date_key', 'Surrogate key in yyyymmdd form.'),
    ('dw.dim_date', 'full_date', 'The calendar date.'),
    ('dw.dim_date', 'year', 'Calendar year.'),
    ('dw.dim_date', 'quarter', 'Calendar quarter, 1 to 4.'),
    ('dw.dim_date', 'month', 'Month number, 1 to 12.'),
    ('dw.dim_date', 'month_name', 'English month name.'),
    ('dw.dim_date', 'year_month', 'Year and month as yyyy-mm.'),
    ('dw.dim_date', 'day', 'Day of month.'),
    ('dw.dim_date', 'day_of_week', 'ISO day of week, 1 = Monday.'),
    ('dw.dim_date', 'day_name', 'English day name.'),
    ('dw.dim_date', 'week_of_year', 'ISO week number.'),
    ('dw.dim_date', 'is_weekend', 'True for Saturday and Sunday.'),
    -- dim_customer
    ('dw.dim_customer', 'customer_key', 'Surrogate key; -1 is the Unknown member.'),
    ('dw.dim_customer', 'customer_id', 'Source User id.'),
    ('dw.dim_customer', 'name', 'Customer name.'),
    ('dw.dim_customer', 'email', 'Customer email (personal data).'),
    ('dw.dim_customer', 'role', 'CUSTOMER or ADMIN (UNKNOWN for the Unknown member).'),
    ('dw.dim_customer', 'created_at', 'When the account was created in the app.'),
    ('dw.dim_customer', 'is_deleted', 'True if the user no longer exists in the source.'),
    ('dw.dim_customer', '_batch_id', 'ETL batch that last changed this row.'),
    ('dw.dim_customer', '_loaded_at', 'When this row was last written.'),
    -- dim_product
    ('dw.dim_product', 'product_key', 'Surrogate key of this product version; -1 is the Unknown member.'),
    ('dw.dim_product', 'product_id', 'Source Product id (shared by all versions).'),
    ('dw.dim_product', 'sku', 'Stock keeping unit.'),
    ('dw.dim_product', 'name', 'Product name in this version.'),
    ('dw.dim_product', 'description', 'Product description in this version.'),
    ('dw.dim_product', 'category', 'Product category in this version.'),
    ('dw.dim_product', 'price_cents', 'List price in cents in this version.'),
    ('dw.dim_product', 'currency', 'Lower-case ISO currency code.'),
    ('dw.dim_product', 'active', 'Whether the product was visible in the shop in this version.'),
    ('dw.dim_product', 'valid_from', 'Start of this version (inclusive).'),
    ('dw.dim_product', 'valid_to', 'End of this version (exclusive); 9999-12-31 for the current version.'),
    ('dw.dim_product', 'is_current', 'True for the latest version.'),
    ('dw.dim_product', 'is_deleted', 'True if the product no longer exists in the source.'),
    ('dw.dim_product', '_batch_id', 'ETL batch that last changed this row.'),
    ('dw.dim_product', '_loaded_at', 'When this row was last written.'),
    -- fact_orders
    ('dw.fact_orders', 'order_id', 'Source Order id (degenerate dimension).'),
    ('dw.fact_orders', 'date_key', 'dim_date key of the order creation date (UTC).'),
    ('dw.fact_orders', 'paid_date_key', 'dim_date key of the payment date (UTC); null if unpaid.'),
    ('dw.fact_orders', 'customer_key', 'dim_customer key.'),
    ('dw.fact_orders', 'status', 'PENDING, PAID, FAILED or CANCELLED.'),
    ('dw.fact_orders', 'coupon_code', 'Coupon applied to the order, if any.'),
    ('dw.fact_orders', 'shipping_country', 'Two-letter destination country code.'),
    ('dw.fact_orders', 'shipping_city', 'Destination city.'),
    ('dw.fact_orders', 'line_count', 'Number of order lines.'),
    ('dw.fact_orders', 'units', 'Total quantity across lines.'),
    ('dw.fact_orders', 'subtotal_cents', 'Sum of line amounts before discount.'),
    ('dw.fact_orders', 'discount_cents', 'Coupon discount.'),
    ('dw.fact_orders', 'shipping_cents', 'Shipping charged.'),
    ('dw.fact_orders', 'tax_cents', 'Sales tax charged.'),
    ('dw.fact_orders', 'total_cents', 'Amount charged to the customer.'),
    ('dw.fact_orders', 'currency', 'Lower-case ISO currency code of the order; all *_cents amounts without _usd are in it.'),
    ('dw.fact_orders', 'created_at', 'When the order was created.'),
    ('dw.fact_orders', 'paid_at', 'When payment was confirmed; null if unpaid.'),
    ('dw.fact_orders', 'source_updated_at', 'The order updatedAt value that was loaded.'),
    ('dw.fact_orders', 'shipping_waived_cents', 'Shipping fee (in the order currency) not charged because of a FREESHIP coupon; 0 if none or if shipping was already free.'),
    ('dw.fact_orders', '_batch_id', 'ETL batch that last rebuilt this row.'),
    ('dw.fact_orders', '_loaded_at', 'When this row was last written.'),
    -- fact_order_lines
    ('dw.fact_order_lines', 'order_item_id', 'Source OrderItem id.'),
    ('dw.fact_order_lines', 'order_id', 'Parent order (fact_orders.order_id).'),
    ('dw.fact_order_lines', 'date_key', 'dim_date key of the order creation date (UTC).'),
    ('dw.fact_order_lines', 'paid_date_key', 'dim_date key of the payment date (UTC); null if unpaid.'),
    ('dw.fact_order_lines', 'customer_key', 'dim_customer key.'),
    ('dw.fact_order_lines', 'product_key', 'dim_product version valid when the order was placed.'),
    ('dw.fact_order_lines', 'status', 'Status of the parent order.'),
    ('dw.fact_order_lines', 'quantity', 'Units ordered.'),
    ('dw.fact_order_lines', 'unit_price_cents', 'Price per unit at order time.'),
    ('dw.fact_order_lines', 'line_amount_cents', 'quantity x unit price.'),
    ('dw.fact_order_lines', 'allocated_discount_cents', 'Share of the order discount.'),
    ('dw.fact_order_lines', 'allocated_shipping_cents', 'Share of the order shipping.'),
    ('dw.fact_order_lines', 'allocated_tax_cents', 'Share of the order tax.'),
    ('dw.fact_order_lines', 'line_total_cents', 'line amount - discount + shipping + tax.'),
    ('dw.fact_orders', 'fx_rate', 'Units of the order currency per 1 USD at the time of purchase.'),
    ('dw.fact_orders', 'subtotal_usd_cents', 'subtotal converted to USD (value / fx_rate, rounded per component).'),
    ('dw.fact_orders', 'discount_usd_cents', 'discount converted to USD.'),
    ('dw.fact_orders', 'shipping_usd_cents', 'shipping converted to USD.'),
    ('dw.fact_orders', 'tax_usd_cents', 'tax converted to USD.'),
    ('dw.fact_orders', 'total_usd_cents', 'Sum of the converted components (subtotal - discount + shipping + tax); can differ by a cent or two from converting total_cents directly.'),
    ('dw.fact_orders', 'shipping_waived_usd_cents', 'shipping_waived_cents converted to USD.'),
    ('dw.fact_order_lines', 'line_amount_usd_cents', 'Share of the order subtotal in USD (allocated, so lines add up to subtotal_usd_cents).'),
    ('dw.fact_order_lines', 'allocated_discount_usd_cents', 'Share of the order discount in USD.'),
    ('dw.fact_order_lines', 'allocated_shipping_usd_cents', 'Share of the order shipping in USD.'),
    ('dw.fact_order_lines', 'allocated_tax_usd_cents', 'Share of the order tax in USD.'),
    ('dw.fact_order_lines', 'line_total_usd_cents', 'line amount - discount + shipping + tax, in USD.'),
    ('dw.fact_order_lines', '_batch_id', 'ETL batch that last rebuilt this row.'),
    ('dw.fact_order_lines', '_loaded_at', 'When this row was last written.')
  ) AS t(tbl, col, descr)
  LOOP
    EXECUTE format('COMMENT ON COLUMN %s.%I IS %L', r.tbl, r.col, r.descr);
  END LOOP;

  -- Staging housekeeping columns.
  FOR r IN SELECT * FROM (VALUES
    ('staging.stg_user'), ('staging.stg_product'), ('staging.stg_order'), ('staging.stg_order_item')
  ) AS t(tbl)
  LOOP
    EXECUTE format('COMMENT ON COLUMN %s._batch_id IS %L', r.tbl, 'ETL batch that last touched this row.');
    EXECUTE format('COMMENT ON COLUMN %s._loaded_at IS %L', r.tbl, 'When this row was last written.');
    EXECUTE format('COMMENT ON COLUMN %s._deleted_at IS %L', r.tbl, 'Set when the row disappeared from the source.');
  END LOOP;

  -- Remaining staging columns mirror the source columns of the same name.
  FOR r IN
    SELECT c.table_name, c.column_name,
           CASE c.table_name WHEN 'stg_user' THEN 'User' WHEN 'stg_product' THEN 'Product'
                WHEN 'stg_order' THEN 'Order' ELSE 'OrderItem' END AS source_table
    FROM information_schema.columns c
    WHERE c.table_schema = 'staging'
      AND col_description(('staging.' || c.table_name)::regclass, c.ordinal_position) IS NULL
  LOOP
    EXECUTE format('COMMENT ON COLUMN staging.%I.%I IS %L', r.table_name, r.column_name,
                   'Copied from the app ' || r.source_table || ' table (column ' || r.column_name || ', snake_case).');
  END LOOP;
END
$$;
