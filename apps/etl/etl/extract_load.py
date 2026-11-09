"""Extract changed rows from the app database and upsert them into staging."""

from dataclasses import dataclass

import psycopg


@dataclass(frozen=True)
class Source:
    name: str  # key in etl.watermark
    staging: str  # staging table
    select: str  # source query; %(since)s filters changed rows when set
    columns: tuple[str, ...]  # staging column names, in select order
    id_query: str  # all ids currently in the source (for delete detection)
    watermark_column: int | None  # index of the updated_at column, or None for no own watermark
    watermark_from: str | None = None  # use another source's watermark (order items follow orders)


SOURCES: tuple[Source, ...] = (
    Source(
        name="user",
        staging="staging.stg_user",
        select='SELECT id, email, name, role::text, "createdAt", "updatedAt" FROM "User"',
        columns=("id", "email", "name", "role", "created_at", "updated_at"),
        id_query='SELECT id FROM "User"',
        watermark_column=5,
    ),
    Source(
        name="product",
        staging="staging.stg_product",
        select=(
            'SELECT id, sku, name, description, "priceCents", currency, stock, category, active, '
            '"createdAt", "updatedAt" FROM "Product"'
        ),
        columns=(
            "id", "sku", "name", "description", "price_cents", "currency", "stock", "category",
            "active", "created_at", "updated_at",
        ),
        id_query='SELECT id FROM "Product"',
        watermark_column=10,
    ),
    Source(
        name="order",
        staging="staging.stg_order",
        select=(
            'SELECT id, "userId", status::text, "subtotalCents", "discountCents", "shippingCents", '
            '"taxCents", "totalCents", currency, "couponCode", "shippingCountry", "shippingCity", '
            '"createdAt", "updatedAt", "paidAt", "fxRate" FROM "Order"'
        ),
        columns=(
            "id", "user_id", "status", "subtotal_cents", "discount_cents", "shipping_cents",
            "tax_cents", "total_cents", "currency", "coupon_code", "shipping_country",
            "shipping_city", "created_at", "updated_at", "paid_at", "fx_rate",
        ),
        id_query='SELECT id FROM "Order"',
        watermark_column=13,
    ),
    Source(
        name="order_item",
        staging="staging.stg_order_item",
        select=(
            'SELECT i.id, i."orderId", i."productId", i.sku, i.name, i."unitPriceCents", i.quantity '
            'FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"'
        ),
        columns=("id", "order_id", "product_id", "sku", "name", "unit_price_cents", "quantity"),
        id_query='SELECT id FROM "OrderItem"',
        watermark_column=None,
        watermark_from="order",
    ),
)


def _since_filter(source: Source) -> str:
    if source.name == "order_item":
        return ' WHERE o."updatedAt" >= %(since)s'
    column = {"user": '"updatedAt"', "product": '"updatedAt"', "order": '"updatedAt"'}[source.name]
    return f" WHERE {column} >= %(since)s"


def _get_watermark(wh: psycopg.Connection, table: str) -> object | None:
    row = wh.execute(
        "SELECT last_updated_at FROM etl.watermark WHERE table_name = %s", (table,)
    ).fetchone()
    return row[0] if row else None


def _upsert(wh: psycopg.Connection, source: Source, rows: list[tuple], batch_id: int) -> None:
    cols = source.columns
    placeholders = ", ".join(["%s"] * len(cols))
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c != "id")
    statement = (
        f"INSERT INTO {source.staging} ({', '.join(cols)}, _batch_id) "
        f"VALUES ({placeholders}, %s) "
        f"ON CONFLICT (id) DO UPDATE SET {updates}, "
        f"_batch_id = EXCLUDED._batch_id, _loaded_at = now(), _deleted_at = NULL"
    )
    with wh.cursor() as cur:
        cur.executemany(statement, [(*row, batch_id) for row in rows])


def _mark_deleted(wh: psycopg.Connection, src: psycopg.Connection, source: Source, batch_id: int) -> int:
    """Rows that no longer exist in the source are kept in staging and flagged."""
    ids = [r[0] for r in src.execute(source.id_query).fetchall()]
    cur = wh.execute(
        f"UPDATE {source.staging} SET _deleted_at = now(), _batch_id = %s "
        f"WHERE _deleted_at IS NULL AND id <> ALL(%s)",
        (batch_id, ids),
    )
    return cur.rowcount


def extract_and_load(
    src: psycopg.Connection, wh: psycopg.Connection, batch_id: int, full: bool
) -> dict[str, dict[str, int]]:
    """Returns per-table counts: extracted rows and rows flagged as deleted."""
    stats: dict[str, dict[str, int]] = {}
    new_watermarks: dict[str, object] = {}

    for source in SOURCES:
        wm_key = source.watermark_from or source.name
        since = None if full else _get_watermark(wh, wm_key)

        query = source.select + (_since_filter(source) if since else "")
        rows = src.execute(query, {"since": since}).fetchall()
        if rows:
            _upsert(wh, source, rows, batch_id)
            if source.watermark_column is not None:
                new_watermarks[source.name] = max(r[source.watermark_column] for r in rows)

        deleted = _mark_deleted(wh, src, source, batch_id)
        stats[source.name] = {"extracted": len(rows), "marked_deleted": deleted}

    for table, value in new_watermarks.items():
        wh.execute(
            "INSERT INTO etl.watermark (table_name, last_updated_at) VALUES (%s, %s) "
            "ON CONFLICT (table_name) DO UPDATE SET last_updated_at = GREATEST("
            "etl.watermark.last_updated_at, EXCLUDED.last_updated_at)",
            (table, value),
        )
    return stats
