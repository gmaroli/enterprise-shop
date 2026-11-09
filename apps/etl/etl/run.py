"""ETL entry point: python -m etl init | run [--full] | status"""

import argparse
import json

from .db import (
    connect_source,
    connect_warehouse,
    ensure_warehouse_database,
    run_sql_file,
)
from .extract_load import extract_and_load

TARGET_TABLES = (
    "dw.dim_customer",
    "dw.dim_product",
    "dw.fact_orders",
    "dw.fact_order_lines",
)


def init() -> None:
    ensure_warehouse_database()
    with connect_warehouse() as wh:
        for script in ("00_init.sql", "01_hardening.sql", "02_comments.sql", "30_reporting_views.sql"):
            run_sql_file(wh, script)
    print("Warehouse is ready.")


def _start_batch(mode: str) -> int:
    with connect_warehouse(autocommit=True) as log:
        row = log.execute(
            "INSERT INTO etl.batch_log (mode) VALUES (%s) RETURNING batch_id", (mode,)
        ).fetchone()
        return row[0]


def _finish_batch(batch_id: int, status: str, stats: dict | None, error: str | None) -> None:
    with connect_warehouse(autocommit=True) as log:
        log.execute(
            "UPDATE etl.batch_log SET status = %s, finished_at = now(), rows_extracted = %s, "
            "error = %s WHERE batch_id = %s",
            (status, json.dumps(stats) if stats else None, error, batch_id),
        )


def run(full: bool) -> None:
    mode = "FULL" if full else "INCREMENTAL"
    batch_id = _start_batch(mode)
    print(f"Batch {batch_id} ({mode}) started")
    try:
        # One warehouse transaction per batch: staging, dimensions, facts and watermarks
        # all commit together or not at all.
        with connect_source() as src, connect_warehouse() as wh:
            stats = extract_and_load(src, wh, batch_id, full)
            params = {"batch_id": batch_id}
            run_sql_file(wh, "10_transform_dims.sql", params)
            run_sql_file(wh, "20_transform_facts.sql", params)
            run_sql_file(wh, "40_post_load.sql")
            wh.commit()
    except Exception as exc:
        _finish_batch(batch_id, "FAILED", None, str(exc))
        raise
    _finish_batch(batch_id, "SUCCESS", stats, None)

    for table, counts in stats.items():
        print(f"  {table:<11} extracted {counts['extracted']:>5}  marked deleted {counts['marked_deleted']}")
    print(f"Batch {batch_id} finished")


def status() -> None:
    with connect_warehouse() as wh:
        print("Recent batches:")
        for row in wh.execute(
            "SELECT batch_id, mode, status, started_at, "
            "round(extract(epoch FROM finished_at - started_at)::numeric, 2) "
            "FROM etl.batch_log ORDER BY batch_id DESC LIMIT 5"
        ):
            print("  ", *row)
        print("Row counts:")
        for table in TARGET_TABLES:
            count = wh.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
            print(f"   {table:<22} {count}")


def main() -> None:
    parser = argparse.ArgumentParser(prog="etl", description="Enterprise Shop warehouse loader")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init", help="create the warehouse database, schemas, tables and views")
    run_parser = sub.add_parser("run", help="load changes from the app database")
    run_parser.add_argument("--full", action="store_true", help="reload everything, ignoring watermarks")
    sub.add_parser("status", help="show recent batches and row counts")

    args = parser.parse_args()
    if args.command == "init":
        init()
    elif args.command == "run":
        run(args.full)
    else:
        status()
