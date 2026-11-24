"""The lodging provider's booking API, which GlampingCo and other hosts use too."""

from collections.abc import Mapping

from infra.http import Network
from infra.scheduler import Scheduler
from stubs.supplier import SupplierSystem


class LodgingProvider(SupplierSystem):
    def __init__(
        self, network: Network, scheduler: Scheduler, decisions: Mapping[str, str]
    ) -> None:
        super().__init__("lodging", network, scheduler, decisions)

    def invoice(self, order: dict) -> dict:
        amount_due = f"{order['amount'] / 100:.2f}"
        return {"folio": f"F-{order['reference']}", "amount_due": amount_due}
