"""VIP shuttles: the shuttle API, with lounge access at both ends of the ride."""

from services.opc.gateways.shuttle import ShuttleGateway
from services.opc.model.suppliers import SupplierOrder


class VipShuttleGateway(ShuttleGateway):
    def place(self, order: SupplierOrder) -> dict:
        lounge_passes = [
            attendee.name for ride in order.items for attendee in ride.attendees
        ]
        return self._send(
            "place",
            order,
            rides=self._rides(order),
            service_class="vip",
            lounge_passes=lounge_passes,
        )
