"""Festival add-ons, booked through the experience provider's API."""

from services.opc.gateways.base import SupplierGateway
from services.opc.model.suppliers import Invoice, SupplierOrder


class ExperienceGateway(SupplierGateway):
    def place(self, order: SupplierOrder) -> dict:
        bookings = [
            {
                "experience_id": experience.experience_id,
                "participants": [attendee.name for attendee in experience.attendees],
            }
            for experience in order.items
        ]
        return self._send("place", order, bookings=bookings)

    def cancel(self, order: SupplierOrder) -> None:
        self._send("cancel", order)

    def parse_invoice(self, payload: dict) -> Invoice:
        amount = payload["amount"]["value"]
        return Invoice(amount=amount, reference=payload["invoice_id"])
