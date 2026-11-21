"""Table stores that services reach by DSN, as they would reach PostgreSQL."""

from __future__ import annotations

import copy
from typing import Any

from infra.clock import FakeClock

Row = dict[str, Any]


class Database:
    """A named set of tables. Each row is a dict stored under its "id" column.

    Given a clock, each query takes latency_ms on it, as a round trip to a
    database server would.
    """

    def __init__(
        self, name: str, *, clock: FakeClock | None = None, latency_ms: int = 0
    ) -> None:
        if latency_ms and clock is None:
            raise ValueError("a database with latency needs a clock")
        self.name = name
        self._tables: dict[str, dict[str, Row]] = {}
        self._read_only = False
        self._clock = clock
        self._latency_ms = latency_ms

    def replica(self, name: str) -> Database:
        """Return a read-only database over the same tables, like a read replica."""
        replica = Database(name, clock=self._clock, latency_ms=self._latency_ms)
        replica._tables = self._tables
        replica._read_only = True
        return replica

    def insert(self, table: str, row: Row) -> str:
        """Store a copy of row and return its key: row["id"], or a new key if absent."""
        self._require_writable()
        self._round_trip()
        rows = self._tables.setdefault(table, {})
        key = row.get("id") or f"{table}-{len(rows) + 1}"
        if key in rows:
            raise ValueError(f"{table} already has a row with id {key!r}")
        rows[key] = copy.deepcopy({**row, "id": key})
        return key

    def get(self, table: str, key: str) -> Row:
        """Return a copy of the row stored under key."""
        self._round_trip()
        return copy.deepcopy(self._row(table, key))

    def update(self, table: str, key: str, **changes: Any) -> None:
        """Set the given columns of an existing row."""
        self._require_writable()
        self._round_trip()
        self._row(table, key).update(copy.deepcopy(changes))

    def find(self, table: str, **criteria: Any) -> list[Row]:
        """Return copies of the rows whose columns equal all criteria, oldest first."""
        self._round_trip()
        return [
            copy.deepcopy(row)
            for row in self._tables.get(table, {}).values()
            if all(row.get(column) == value for column, value in criteria.items())
        ]

    def _row(self, table: str, key: str) -> Row:
        try:
            return self._tables[table][key]
        except KeyError:
            raise KeyError(f"{table} has no row with id {key!r}") from None

    def _round_trip(self) -> None:
        if self._clock is not None:
            self._clock.advance(self._latency_ms / 1000)

    def _require_writable(self) -> None:
        if self._read_only:
            raise PermissionError(f"{self.name} is a read-only replica")


_databases: dict[str, Database] = {}  # every running database, by DSN


def create_database(
    dsn: str,
    *,
    replica_dsn: str | None = None,
    clock: FakeClock | None = None,
    latency_ms: int = 0,
) -> Database:
    """Start an empty database at dsn, and a read replica of it at replica_dsn if given.

    Each query takes latency_ms on clock. A database created at a DSN in use
    replaces the old one, so every devstack starts from empty tables.
    """
    database = Database(dsn, clock=clock, latency_ms=latency_ms)
    _databases[dsn] = database
    if replica_dsn is not None:
        _databases[replica_dsn] = database.replica(replica_dsn)
    return database


def connect(dsn: str) -> Database:
    """Connect to the database at dsn. A replica's DSN gives a read-only connection."""
    if dsn not in _databases:
        raise LookupError(f"no database is running at {dsn}")
    return _databases[dsn]
