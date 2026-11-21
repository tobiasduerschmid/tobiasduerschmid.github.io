"""Charging and refunding the fan's card, through the bank's CardService."""

from infra.http import ServiceClient
from services.opc.model.orders import TripOrder
from services.opc.repository import OrderRepository


class PaymentTask:
    def __init__(self, bank: ServiceClient, orders: OrderRepository) -> None:
        self._bank = bank
        self._orders = orders

    def capture(self, order: TripOrder) -> None:
        """Charge the order's payment, once even if the order arrives twice."""
        payment = order.payment
        if payment.capture_id is not None:
            return
        response = self._bank.call("capture", {
            "card_token": payment.card_token,
            "amount": payment.amount,
            "reference": order.order_id,
        })
        payment.capture_id = response["capture_id"]
        self._orders.save(order)

    def refund(self, order: TripOrder) -> None:
        """Pay the captured amount back to the fan's card."""
        self._bank.call("refund", {
            "capture_id": order.payment.capture_id,
            "amount": order.payment.amount,
            "reference": order.order_id,
        })
