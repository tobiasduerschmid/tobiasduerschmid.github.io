"""Campsites, tents, cabins, and hotel rooms, booked through the lodging API."""

from decimal import Decimal

from services.opc.gateways.base import SupplierGateway
from services.opc.model.suppliers import Invoice, SupplierOrder


class LodgingGateway(SupplierGateway):
    def place(self, order: SupplierOrder) -> dict:
        stays = [
            {
                "unit": stay.unit,
                "check_in": stay.check_in.isoformat(),
                "nights": stay.nights,
                "guests": [attendee.name for attendee in stay.attendees],
            }
            for stay in order.items
        ]
        return self._send("place", order, stays=stays)

    def cancel(self, order: SupplierOrder) -> None:
        self._send("cancel", order)

    def parse_invoice(self, payload: dict) -> Invoice:
        cents = Decimal(payload["amount_due"]) * 100
        return Invoice(amount=int(cents), reference=payload["folio"])
