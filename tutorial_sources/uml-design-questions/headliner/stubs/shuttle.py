"""The shuttle operator's booking API, for standard and VIP seats."""

from collections.abc import Mapping

from infra.http import Network
from infra.scheduler import Scheduler
from stubs.supplier import SupplierSystem


class ShuttleProvider(SupplierSystem):
    def __init__(
        self, network: Network, scheduler: Scheduler, decisions: Mapping[str, str]
    ) -> None:
        super().__init__("shuttle", network, scheduler, decisions)

    def invoice(self, order: dict) -> dict:
        return {"ref": f"SH-{order['reference']}", "fare_total_cents": order["amount"]}
