-- Warehouse structure. Safe to run repeatedly.

CREATE SCHEMA IF NOT EXISTS etl;
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS dw;
CREATE SCHEMA IF NOT EXISTS reporting;

-- ---------------------------------------------------------------- etl metadata
CREATE TABLE IF NOT EXISTS etl.batch_log (
  batch_id       serial PRIMARY KEY,
  mode           text NOT NULL,                 -- INCREMENTAL | FULL
  status         text NOT NULL DEFAULT 'RUNNING', -- RUNNING | SUCCESS | FAILED
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  rows_extracted jsonb,
  error          text
);

CREATE TABLE IF NOT EXISTS etl.watermark (
  table_name      text PRIMARY KEY,
  last_updated_at timestamptz NOT NULL
);

-- ---------------------------------------------------------------- staging
-- Latest copy of each source row. _batch_id is the batch that last touched the row.
CREATE TABLE IF NOT EXISTS staging.stg_user (
  id          text PRIMARY KEY,
  email       text NOT NULL,
  name        text NOT NULL,
  role        text NOT NULL,
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL,
  _batch_id   integer NOT NULL,
  _loaded_at  timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS staging.stg_product (
  id          text PRIMARY KEY,
  sku         text NOT NULL,
  name        text NOT NULL,
  description text NOT NULL,
  price_cents integer NOT NULL,
  currency    text NOT NULL,
  stock       integer NOT NULL,
  category    text NOT NULL,
  active      boolean NOT NULL,
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL,
  _batch_id   integer NOT NULL,
  _loaded_at  timestamptz NOT NULL DEFAULT now(),
  _deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS staging.stg_order (
  id               text PRIMARY KEY,
  user_id          text NOT NULL,
  status           text NOT NULL,
  subtotal_cents   integer NOT NULL,
  discount_cents   integer NOT NULL,
  shipping_cents   integer NOT NULL,
  tax_cents        integer NOT NULL,
  total_cents      integer NOT NULL,
  currency         text NOT NULL,
  coupon_code      text,
  shipping_country text NOT NULL,
  shipping_city    text NOT NULL,
  created_at       timestamptz NOT NULL,
  updated_at       timestamptz NOT NULL,
  paid_at          timestamptz,
  _batch_id        integer NOT NULL,
  _loaded_at       timestamptz NOT NULL DEFAULT now(),
  _deleted_at      timestamptz
);

CREATE TABLE IF NOT EXISTS staging.stg_order_item (
  id               text PRIMARY KEY,
  order_id         text NOT NULL,
  product_id       text NOT NULL,
  sku              text NOT NULL,
  name             text NOT NULL,
  unit_price_cents integer NOT NULL,
  quantity         integer NOT NULL,
  _batch_id        integer NOT NULL,
  _loaded_at       timestamptz NOT NULL DEFAULT now(),
  _deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS stg_order_batch_idx ON staging.stg_order (_batch_id);
CREATE INDEX IF NOT EXISTS stg_order_item_order_idx ON staging.stg_order_item (order_id);

-- ---------------------------------------------------------------- dimensions
CREATE TABLE IF NOT EXISTS dw.dim_date (
  date_key     integer PRIMARY KEY,   -- yyyymmdd
  full_date    date NOT NULL UNIQUE,
  year         smallint NOT NULL,
  quarter      smallint NOT NULL,
  month        smallint NOT NULL,
  month_name   text NOT NULL,
  year_month   text NOT NULL,         -- yyyy-mm
  day          smallint NOT NULL,
  day_of_week  smallint NOT NULL,     -- 1 = Monday
  day_name     text NOT NULL,
  week_of_year smallint NOT NULL,
  is_weekend   boolean NOT NULL
);

INSERT INTO dw.dim_date
SELECT
  to_char(d, 'YYYYMMDD')::int,
  d::date,
  extract(year FROM d)::smallint,
  extract(quarter FROM d)::smallint,
  extract(month FROM d)::smallint,
  trim(to_char(d, 'Month')),
  to_char(d, 'YYYY-MM'),
  extract(day FROM d)::smallint,
  extract(isodow FROM d)::smallint,
  trim(to_char(d, 'Day')),
  extract(week FROM d)::smallint,
  extract(isodow FROM d) IN (6, 7)
FROM generate_series('2024-01-01'::date, '2030-12-31'::date, interval '1 day') AS g(d)
ON CONFLICT (date_key) DO NOTHING;

-- Type 1 (overwrite): a customer row always shows the latest values.
CREATE TABLE IF NOT EXISTS dw.dim_customer (
  customer_key bigserial PRIMARY KEY,
  customer_id  text NOT NULL UNIQUE,
  name         text NOT NULL,
  email        text NOT NULL,
  role         text NOT NULL,
  created_at   timestamptz,
  is_deleted   boolean NOT NULL DEFAULT false,
  _batch_id    integer,
  _loaded_at   timestamptz NOT NULL DEFAULT now()
);

-- Type 2 (history): a new row is created when a tracked attribute changes.
-- Tracked: sku, name, description, category, price, currency, active. Stock is not tracked.
CREATE TABLE IF NOT EXISTS dw.dim_product (
  product_key bigserial PRIMARY KEY,
  product_id  text NOT NULL,
  sku         text NOT NULL,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  category    text NOT NULL,
  price_cents integer,
  currency    text NOT NULL DEFAULT 'usd',
  active      boolean NOT NULL DEFAULT true,
  valid_from  timestamptz NOT NULL,
  valid_to    timestamptz NOT NULL DEFAULT '9999-12-31 00:00:00+00',
  is_current  boolean NOT NULL DEFAULT true,
  is_deleted  boolean NOT NULL DEFAULT false,
  _batch_id   integer,
  _loaded_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, valid_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS dim_product_one_current_idx
  ON dw.dim_product (product_id) WHERE is_current;

-- "Unknown" members so facts never need a NULL foreign key.
INSERT INTO dw.dim_customer (customer_key, customer_id, name, email, role)
VALUES (-1, '-1', 'Unknown', 'unknown', 'UNKNOWN')
ON CONFLICT (customer_key) DO NOTHING;

INSERT INTO dw.dim_product (product_key, product_id, sku, name, category, valid_from)
VALUES (-1, '-1', 'UNKNOWN', 'Unknown', 'Unknown', '1900-01-01 00:00:00+00')
ON CONFLICT (product_key) DO NOTHING;

-- ---------------------------------------------------------------- facts
-- Grain: one row per order.
CREATE TABLE IF NOT EXISTS dw.fact_orders (
  order_id          text PRIMARY KEY,
  date_key          integer NOT NULL REFERENCES dw.dim_date (date_key),
  paid_date_key     integer REFERENCES dw.dim_date (date_key),
  customer_key      bigint NOT NULL REFERENCES dw.dim_customer (customer_key),
  status            text NOT NULL,
  coupon_code       text,
  shipping_country  text NOT NULL,
  shipping_city     text NOT NULL,
  line_count        integer NOT NULL,
  units             integer NOT NULL,
  subtotal_cents    integer NOT NULL,
  discount_cents    integer NOT NULL,
  shipping_cents    integer NOT NULL,
  tax_cents         integer NOT NULL,
  total_cents       integer NOT NULL,
  currency          text NOT NULL,
  created_at        timestamptz NOT NULL,
  paid_at           timestamptz,
  source_updated_at timestamptz NOT NULL,
  _batch_id         integer NOT NULL,
  _loaded_at        timestamptz NOT NULL DEFAULT now()
);

-- Grain: one row per order line. Order-level discount, shipping and tax are allocated
-- to lines in proportion to line amount; rounding leftovers go to the largest line.
CREATE TABLE IF NOT EXISTS dw.fact_order_lines (
  order_item_id            text PRIMARY KEY,
  order_id                 text NOT NULL,
  date_key                 integer NOT NULL REFERENCES dw.dim_date (date_key),
  paid_date_key            integer REFERENCES dw.dim_date (date_key),
  customer_key             bigint NOT NULL REFERENCES dw.dim_customer (customer_key),
  product_key              bigint NOT NULL REFERENCES dw.dim_product (product_key),
  status                   text NOT NULL,
  quantity                 integer NOT NULL,
  unit_price_cents         integer NOT NULL,
  line_amount_cents        integer NOT NULL,
  allocated_discount_cents integer NOT NULL,
  allocated_shipping_cents integer NOT NULL,
  allocated_tax_cents      integer NOT NULL,
  line_total_cents         integer NOT NULL,
  _batch_id                integer NOT NULL,
  _loaded_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fact_order_lines_order_idx ON dw.fact_order_lines (order_id);
CREATE INDEX IF NOT EXISTS fact_order_lines_product_idx ON dw.fact_order_lines (product_key);
