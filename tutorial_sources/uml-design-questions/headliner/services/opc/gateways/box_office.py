"""Festival passes, ordered from the festival's box office."""

from services.opc.gateways.base import SupplierGateway
from services.opc.model.suppliers import Invoice, SupplierOrder


class BoxOfficeGateway(SupplierGateway):
    def place(self, order: SupplierOrder) -> dict:
        tickets = [
            {"holder": attendee.name, "age_group": attendee.age_group}
            for item in order.items
            for attendee in item.attendees
        ]
        return self._send("place", order, tickets=tickets)

    def cancel(self, order: SupplierOrder) -> None:
        self._send("cancel", order, void_tickets=True)

    def parse_invoice(self, payload: dict) -> Invoice:
        return Invoice(amount=payload["total_cents"], reference=payload["invoice_no"])
