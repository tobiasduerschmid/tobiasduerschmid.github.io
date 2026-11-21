"""GlampingCo: bell tents and cabins, booked through the standard lodging API."""

from datetime import timedelta

from services.opc.gateways.lodging import LodgingGateway
from services.opc.model.suppliers import SupplierOrder
from services.opc.partners.errors import ManualCancellationRequired

MANUAL_CANCELLATION_WINDOW = timedelta(hours=72)


class GlampingCoGateway(LodgingGateway):
    """GlampingCo's own staff handle cancellations close to check-in."""

    def cancel(self, order: SupplierOrder) -> None:
        check_in = min(stay.check_in for stay in order.items)
        if check_in - self._clock.now() <= MANUAL_CANCELLATION_WINDOW:
            raise ManualCancellationRequired(
                f"GlampingCo cancels {order.supplier_order_id} by phone only: "
                "check-in is less than 72 hours away"
            )
        super().cancel(order)
