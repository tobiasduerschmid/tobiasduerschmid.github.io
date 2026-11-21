"""Artist meet-and-greets, listed through the experience provider's API."""

from services.opc.gateways.experiences import ExperienceGateway
from services.opc.model.suppliers import SupplierOrder
from services.opc.partners.errors import ManualCancellationRequired


class MeetAndGreetGateway(ExperienceGateway):
    """Each artist's management confirms its meet-and-greets and handles changes."""

    def cancel(self, order: SupplierOrder) -> None:
        raise ManualCancellationRequired(
            f"artist management cancels {order.supplier_order_id} directly"
        )
