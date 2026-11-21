"""Shuttle seats to and from the festival grounds."""

from services.opc.gateways.base import SupplierGateway
from services.opc.model.suppliers import Invoice, SupplierOrder


class ShuttleGateway(SupplierGateway):
    def place(self, order: SupplierOrder) -> dict:
        return self._send("place", order, rides=self._rides(order))

    def cancel(self, order: SupplierOrder) -> None:
        self._send("cancel", order, rides=self._rides(order))

    def parse_invoice(self, payload: dict) -> Invoice:
        return Invoice(amount=payload["fare_total_cents"], reference=payload["ref"])

    def _rides(self, order: SupplierOrder) -> list[dict]:
        return [
            {
                "route": ride.route,
                "departure": ride.departure.isoformat(),
                "seats": len(ride.attendees),
            }
            for ride in order.items
        ]
