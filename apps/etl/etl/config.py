"""Settings come from the repo-root .env (shared with the API and web app)."""

import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
SQL_DIR = Path(__file__).resolve().parents[1] / "sql"

load_dotenv(ROOT / ".env")


def _strip_prisma_params(url: str) -> str:
    """psycopg does not understand Prisma's ?schema=public query parameter."""
    parts = urlparse(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k != "schema"]
    return urlunparse(parts._replace(query=urlencode(query)))


def source_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is not set (see .env.example)")
    return _strip_prisma_params(url)


def warehouse_url() -> str:
    url = os.environ.get("WAREHOUSE_URL")
    if not url:
        raise SystemExit("WAREHOUSE_URL is not set (see .env.example)")
    return url
