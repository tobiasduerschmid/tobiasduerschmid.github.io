"""The Support Console: the support team's web app for following up on trips."""

from infra.broker import Message
from infra.http import ServiceClient


class SupportConsole:
    def __init__(self, opc: ServiceClient) -> None:
        self._opc = opc
        self.follow_ups: list[dict] = []  # cancelled trips to call the fan about

    def on_trip_cancelled(self, message: Message) -> None:
        trip = message.body
        self.follow_ups.append({
            "order_id": trip["order_id"],
            "fan_name": trip["fan_name"],
            "fan_email": trip["fan_email"],
        })

    def lookup(self, order_id: str) -> dict:
        """An order's status and its supplier orders, from the OPC."""
        return self._opc.call("OrderTrackingService.status", {"order_id": order_id})

    def orders_of(self, fan_id: str) -> list[dict]:
        history = self._opc.call("OrderTrackingService.history", {"fan_id": fan_id})
        return history["orders"]
