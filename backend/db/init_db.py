import os
from pathlib import Path

import duckdb

from .models import CREATE_STATEMENTS


_DB_PATH: str = ""


def init_db() -> None:
    global _DB_PATH
    _DB_PATH = os.environ.get("SMARTDQC_DB_PATH", "/app/data/smartdqc.duckdb")
    Path(_DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with duckdb.connect(_DB_PATH) as conn:
        for stmt in CREATE_STATEMENTS:
            conn.execute(stmt)


def get_db() -> duckdb.DuckDBPyConnection:
    path = _DB_PATH or os.environ.get("SMARTDQC_DB_PATH", "/app/data/smartdqc.duckdb")
    return duckdb.connect(path)
