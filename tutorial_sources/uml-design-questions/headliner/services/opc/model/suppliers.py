"""Supplier orders: the part of a trip order that one supplier fulfils."""

from dataclasses import dataclass

from services.opc.model.items import TripItem


@dataclass(frozen=True)
class Invoice:
    """What a supplier bills for a confirmed supplier order, in cents."""

    amount: int
    reference: str


@dataclass
class SupplierOrder:
    """The items of one trip order that one supplier provides."""

    supplier_id: str
    trip_order_id: str
    items: list[TripItem]
    status: str = "placed"
    invoice: Invoice | None = None

    @property
    def supplier_order_id(self) -> str:
        return f"{self.trip_order_id}-{self.supplier_id}"

    @property
    def kind(self) -> str:
        """The kind of supplier, from its items: "pass", "lodging", and so on."""
        return self.items[0].supplier_kind()

    def total(self) -> int:
        return sum(item.price() for item in self.items)

    def confirm(self, invoice: Invoice) -> None:
        self.status = "confirmed"
        self.invoice = invoice

    def reject(self) -> None:
        self.status = "rejected"

    def mark_cancelling(self) -> None:
        self.status = "cancelling"

    def mark_cancelled(self) -> None:
        self.status = "cancelled"
