import psycopg
from psycopg import sql
from psycopg.rows import tuple_row

from .config import SQL_DIR, source_url, warehouse_url


def connect_source() -> psycopg.Connection:
    """Read-only, repeatable-read snapshot of the app database."""
    conn = psycopg.connect(source_url(), row_factory=tuple_row)
    conn.isolation_level = psycopg.IsolationLevel.REPEATABLE_READ
    conn.read_only = True
    return conn


def connect_warehouse(autocommit: bool = False) -> psycopg.Connection:
    # Source timestamps are UTC without a zone; make sure the warehouse reads them as UTC.
    return psycopg.connect(
        warehouse_url(), autocommit=autocommit, options="-c timezone=UTC", row_factory=tuple_row
    )


def ensure_warehouse_database() -> None:
    """Create the warehouse database next to the app database if it does not exist."""
    target = psycopg.conninfo.conninfo_to_dict(warehouse_url())["dbname"]
    with psycopg.connect(source_url(), autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target,)).fetchone()
        if not exists:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(target)))
            print(f"Created database {target}")


def run_sql_file(conn: psycopg.Connection, name: str, params: dict | None = None) -> None:
    """Run a multi-statement SQL file (client-side binding allows several statements)."""
    text = (SQL_DIR / name).read_text()
    with psycopg.ClientCursor(conn) as cur:
        cur.execute(text, params)
