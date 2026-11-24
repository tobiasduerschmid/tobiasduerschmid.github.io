"""Trip orders and their supplier orders, as the OPC keeps them in the Order DB."""

from dataclasses import asdict

from infra.db import Database
from services.opc.model.orders import TripOrder
from services.opc.model.suppliers import Invoice, SupplierOrder
from services.opc.payloads import (
    item_from_payload,
    item_to_payload,
    order_from_payload,
    order_to_payload,
)

FIRST_ORDER_NUMBER = 1001


class OrderRepository:
    def __init__(self, db: Database) -> None:
        self._db = db

    def new_order_id(self) -> str:
        return f"HL-{FIRST_ORDER_NUMBER + len(self._db.find('orders'))}"

    def add(self, order: TripOrder) -> None:
        self._db.insert("orders", {
            "id": order.order_id,
            "fan_id": order.buyer.fan_id,
            "festival_id": order.festival_id,
            "status": order.status,
            "order": order_to_payload(order),
        })

    def get(self, order_id: str) -> TripOrder:
        row = self._db.get("orders", order_id)
        order = order_from_payload(order_id, row["order"])
        order.status = row["status"]
        attendees = {attendee.name: attendee for attendee in order.attendees}
        order.supplier_orders = [
            self._supplier_order(supplier_row, attendees)
            for supplier_row in self._db.find("supplier_orders", trip_order_id=order_id)
        ]
        return order

    def save(self, order: TripOrder) -> None:
        """Store the order's status and payment."""
        self._db.update(
            "orders",
            order.order_id,
            status=order.status,
            order=order_to_payload(order),
        )

    def orders_of(self, fan_id: str) -> list[dict]:
        return self._db.find("orders", fan_id=fan_id)

    def add_supplier_order(self, supplier_order: SupplierOrder) -> None:
        self._db.insert("supplier_orders", {
            "id": supplier_order.supplier_order_id,
            "trip_order_id": supplier_order.trip_order_id,
            "supplier_id": supplier_order.supplier_id,
            "items": [item_to_payload(item) for item in supplier_order.items],
            "status": supplier_order.status,
            "invoice": None,
            "sent": False,
        })

    def save_supplier_order(self, supplier_order: SupplierOrder) -> None:
        """Store a supplier order's status and invoice."""
        invoice = supplier_order.invoice
        self._db.update(
            "supplier_orders",
            supplier_order.supplier_order_id,
            status=supplier_order.status,
            invoice=asdict(invoice) if invoice else None,
        )

    def mark_sent(self, supplier_order: SupplierOrder) -> None:
        """Record that the supplier has received the order."""
        self._db.update("supplier_orders", supplier_order.supplier_order_id, sent=True)

    def supplier_order(self, supplier_order_id: str) -> SupplierOrder:
        row = self._db.get("supplier_orders", supplier_order_id)
        return next(
            supplier_order
            for supplier_order in self.get(row["trip_order_id"]).supplier_orders
            if supplier_order.supplier_order_id == supplier_order_id
        )

    def supplier_orders_where(self, **criteria: object) -> list[SupplierOrder]:
        return [
            self.supplier_order(row["id"])
            for row in self._db.find("supplier_orders", **criteria)
        ]

    def _supplier_order(self, row: dict, attendees: dict) -> SupplierOrder:
        invoice = Invoice(**row["invoice"]) if row["invoice"] else None
        return SupplierOrder(
            supplier_id=row["supplier_id"],
            trip_order_id=row["trip_order_id"],
            items=[item_from_payload(item, attendees) for item in row["items"]],
            status=row["status"],
            invoice=invoice,
        )
