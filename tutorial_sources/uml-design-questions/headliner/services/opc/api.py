"""The OPC's web services: purchase orders, order tracking, and supplier callbacks."""

from infra.broker import Broker
from infra.http import RequestHandler
from services.opc.cancellation_task import CancellationTask
from services.opc.intake import Intake
from services.opc.repository import OrderRepository

ANSWERED_QUEUE = "supplier.answered"


class PurchaseOrderService:
    """Takes new trip orders and cancellations from the Trip Website."""

    def __init__(self, intake: Intake, cancellations: CancellationTask) -> None:
        self._intake = intake
        self._cancellations = cancellations

    def submit(self, request: dict) -> dict:
        return {"order_id": self._intake.accept(request["order"])}

    def cancel(self, request: dict) -> dict:
        self._cancellations.cancel(request["order_id"])
        return {"status": "cancelling"}


class OrderTrackingService:
    """Answers questions about trip orders and their supplier orders."""

    def __init__(self, orders: OrderRepository) -> None:
        self._orders = orders

    def status(self, request: dict) -> dict:
        order = self._orders.get(request["order_id"])
        return {
            "order_id": order.order_id,
            "status": order.status,
            "cancel_by": order.cancellation_deadline().isoformat(),
            "suppliers": {s.supplier_id: s.status for s in order.supplier_orders},
        }

    def history(self, request: dict) -> dict:
        rows = self._orders.orders_of(request["fan_id"])
        orders = [{"order_id": row["id"], "status": row["status"]} for row in rows]
        return {"orders": orders}


class SupplierCallbackService:
    """Receives suppliers' answers to placed orders and queues them for the workflow."""

    def __init__(self, broker: Broker) -> None:
        self._broker = broker

    def answer(self, request: dict) -> dict:
        self._broker.send(ANSWERED_QUEUE, request)
        return {"received": True}


def endpoints(
    purchase_orders: PurchaseOrderService,
    tracking: OrderTrackingService,
    callbacks: SupplierCallbackService,
) -> dict[str, RequestHandler]:
    """The OPC's endpoints on the network, by name."""
    return {
        "PurchaseOrderService.submit": purchase_orders.submit,
        "PurchaseOrderService.cancel": purchase_orders.cancel,
        "OrderTrackingService.status": tracking.status,
        "OrderTrackingService.history": tracking.history,
        "SupplierCallbackService.answer": callbacks.answer,
    }
