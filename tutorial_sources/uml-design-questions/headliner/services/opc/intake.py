"""Intake: the first step for every trip order the OPC receives."""

from infra.broker import Broker
from services.opc.payloads import order_from_payload
from services.opc.repository import OrderRepository

RECEIVED_QUEUE = "orders.received"


class Intake:
    """Checks a new trip order, stores it, and queues it for the workflow."""

    def __init__(self, orders: OrderRepository, broker: Broker) -> None:
        self._orders = orders
        self._broker = broker

    def accept(self, payload: dict) -> str:
        """Take a trip order in its JSON form and return its order id."""
        order = order_from_payload(self._orders.new_order_id(), payload)
        self._orders.add(order)
        self._broker.send(RECEIVED_QUEUE, {"order_id": order.order_id})
        return order.order_id
