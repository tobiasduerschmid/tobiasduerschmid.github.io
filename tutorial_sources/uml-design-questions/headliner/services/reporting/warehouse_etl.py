"""Warehouse ETL: loads every event into the reporting warehouse, one row per event."""

from infra.broker import Message


class WarehouseETL:
    def __init__(self) -> None:
        self.rows: list[dict] = []  # the warehouse's events table

    def on_event(self, message: Message) -> None:
        self.rows.append({"event": message.routing_key, **message.body})
