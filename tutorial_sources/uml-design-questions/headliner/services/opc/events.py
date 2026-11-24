"""What the OPC tells the rest of Headliner, on the trips exchange."""

from infra.broker import Broker
from services.opc.model.orders import TripOrder
from services.opc.model.suppliers import SupplierOrder
from services.opc.payloads import item_to_payload

EXCHANGE = "trips"


class TripEvents:
    """Publishes trip.<status> and supplier.<kind>.<status> events."""

    def __init__(self, broker: Broker) -> None:
        self._broker = broker

    def confirmed(self, order: TripOrder) -> None:
        self._broker.publish(EXCHANGE, "trip.confirmed", self._trip(order))

    def failed(self, order: TripOrder) -> None:
        self._broker.publish(EXCHANGE, "trip.failed", self._trip(order))

    def cancelled(self, order: TripOrder) -> None:
        self._broker.publish(EXCHANGE, "trip.cancelled", self._trip(order))

    def supplier_order_changed(self, supplier_order: SupplierOrder) -> None:
        """Announce that a supplier confirmed, rejected, or cancelled an order."""
        routing_key = f"supplier.{supplier_order.kind}.{supplier_order.status}"
        self._broker.publish(EXCHANGE, routing_key, {
            "supplier_order_id": supplier_order.supplier_order_id,
            "trip_order_id": supplier_order.trip_order_id,
            "supplier_id": supplier_order.supplier_id,
            "items": [item_to_payload(item) for item in supplier_order.items],
        })

    def _trip(self, order: TripOrder) -> dict:
        return {
            "order_id": order.order_id,
            "fan_id": order.buyer.fan_id,
            "fan_name": order.buyer.name,
            "fan_email": order.buyer.email,
            "festival_id": order.festival_id,
            "total": order.payment.amount,
            "items": [item_to_payload(item) for item in order.items],
        }
