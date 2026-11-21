"""What each supplier's booking system does for Headliner: take orders, answer later."""

from abc import ABC, abstractmethod
from collections.abc import Mapping

from infra.http import Network, ServiceClient, ServiceUnavailable
from infra.scheduler import Scheduler

ANSWER_INTERVAL_S = 30  # suppliers work through their new orders twice a minute
PLACE_LATENCY_MS = 250
CANCEL_LATENCY_MS = 250


class SupplierSystem(ABC):
    """A supplier's booking system, as the devstack runs it.

    It takes each order at once and answers it on its next pass through new
    orders, by calling the OPC's SupplierCallbackService. decisions maps a
    supplier id to "confirm" or "reject"; suppliers confirm by default.
    """

    def __init__(
        self,
        service: str,
        network: Network,
        scheduler: Scheduler,
        decisions: Mapping[str, str],
    ) -> None:
        self.service = service
        self.bookings: dict[str, str] = {}  # order reference -> booking status
        self._decisions = decisions
        self._unanswered: list[dict] = []
        self._opc = ServiceClient("opc", network, caller=service)
        network.register(service, "place", self._place, PLACE_LATENCY_MS)
        network.register(service, "cancel", self._cancel, CANCEL_LATENCY_MS)
        scheduler.every(
            ANSWER_INTERVAL_S, self._answer_new_orders, f"{service}-answers"
        )

    @abstractmethod
    def invoice(self, order: dict) -> dict:
        """This supplier's invoice for an order it confirms."""

    def _place(self, order: dict) -> dict:
        self.bookings[order["reference"]] = "held"
        self._unanswered.append(order)
        return {"accepted": True, "reference": order["reference"]}

    def _cancel(self, request: dict) -> dict:
        self.bookings[request["reference"]] = "cancelled"
        return {"cancelled": True}

    def _answer_new_orders(self) -> None:
        while self._unanswered:
            answer = self._answer(self._unanswered[0])
            try:
                self._opc.call("SupplierCallbackService.answer", answer)
            except ServiceUnavailable:
                return  # the OPC cannot take answers now; try on the next pass
            self._unanswered.pop(0)

    def _answer(self, order: dict) -> dict:
        reference = order["reference"]
        if self._decisions.get(order["supplier"], "confirm") == "reject":
            self.bookings[reference] = "rejected"
            return {"supplier_order_id": reference, "decision": "reject"}
        self.bookings[reference] = "confirmed"
        return {
            "supplier_order_id": reference,
            "decision": "confirm",
            "invoice": self.invoice(order),
        }
