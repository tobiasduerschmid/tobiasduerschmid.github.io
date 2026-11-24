"""The interface the OPC orders trip items through, one gateway per supplier."""

from abc import ABC, abstractmethod

from infra.clock import Clock
from infra.http import ServiceClient, ServiceUnavailable
from services.opc.model.suppliers import Invoice, SupplierOrder


class SupplierUnavailable(Exception):
    """The supplier could not be reached. The same request can be sent again later."""


class SupplierGateway(ABC):
    """Talks to one supplier's booking API for the OPC.

    A supplier answers each placed order later, through the OPC's
    SupplierCallbackService, so place() only hands the order over.
    """

    def __init__(self, client: ServiceClient, clock: Clock) -> None:
        self._client = client
        self._clock = clock

    @abstractmethod
    def place(self, order: SupplierOrder) -> dict:
        """Hand order to the supplier and return its acknowledgement.

        Raises SupplierUnavailable if the supplier cannot be reached.
        """

    @abstractmethod
    def cancel(self, order: SupplierOrder) -> None:
        """Cancel a placed or confirmed order.

        Raises SupplierUnavailable if the supplier cannot be reached, so the
        caller can try again later. Raises no other exception.
        """

    @abstractmethod
    def parse_invoice(self, payload: dict) -> Invoice:
        """Read the invoice a supplier sends with its confirmation."""

    def _send(self, endpoint: str, order: SupplierOrder, **details: object) -> dict:
        request = {
            "reference": order.supplier_order_id,
            "supplier": order.supplier_id,
            "amount": order.total(),
            "sent_at": self._clock.now().isoformat(),
            **details,
        }
        try:
            return self._client.call(endpoint, request)
        except ServiceUnavailable as error:
            unreachable = f"{self._client.service} is unreachable"
            raise SupplierUnavailable(unreachable) from error
