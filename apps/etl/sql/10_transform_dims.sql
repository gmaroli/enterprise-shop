-- Dimension loads. %(batch_id)s is the current batch; staging rows touched by this batch
-- (including rows marked deleted) are the change set.

-- Customers: Type 1 upsert.
INSERT INTO dw.dim_customer (customer_id, name, email, role, created_at, is_deleted, _batch_id)
SELECT u.id, u.name, u.email, u.role, u.created_at, u._deleted_at IS NOT NULL, %(batch_id)s
FROM staging.stg_user u
WHERE u._batch_id = %(batch_id)s
ON CONFLICT (customer_id) DO UPDATE SET
  name       = EXCLUDED.name,
  email      = EXCLUDED.email,
  role       = EXCLUDED.role,
  created_at = EXCLUDED.created_at,
  is_deleted = EXCLUDED.is_deleted,
  _batch_id  = EXCLUDED._batch_id,
  _loaded_at = now();

-- Products, Type 2 step 1: close the current version when a tracked attribute changed.
UPDATE dw.dim_product d
SET valid_to   = s.updated_at,
    is_current = false,
    _batch_id  = %(batch_id)s
FROM staging.stg_product s
WHERE s._batch_id = %(batch_id)s
  AND s._deleted_at IS NULL
  AND d.product_id = s.id
  AND d.is_current
  AND (d.sku, d.name, d.description, d.category, d.price_cents, d.currency, d.active)
      IS DISTINCT FROM
      (s.sku, s.name, s.description, s.category, s.price_cents, s.currency, s.active);

-- Products, Type 2 step 2: open a version for new products and for products just closed.
INSERT INTO dw.dim_product
  (product_id, sku, name, description, category, price_cents, currency, active,
   valid_from, valid_to, is_current, _batch_id)
SELECT
  s.id, s.sku, s.name, s.description, s.category, s.price_cents, s.currency, s.active,
  COALESCE((SELECT max(p.valid_to) FROM dw.dim_product p WHERE p.product_id = s.id), s.created_at),
  '9999-12-31 00:00:00+00', true, %(batch_id)s
FROM staging.stg_product s
WHERE s._batch_id = %(batch_id)s
  AND s._deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM dw.dim_product d WHERE d.product_id = s.id AND d.is_current
  );

-- Products deleted in the source keep their history; flag them.
UPDATE dw.dim_product d
SET is_deleted = true, _batch_id = %(batch_id)s
FROM staging.stg_product s
WHERE s._batch_id = %(batch_id)s AND s._deleted_at IS NOT NULL AND d.product_id = s.id;
