"""The festivals' box office: pass prices, and pass orders from the OPC."""

from collections.abc import Mapping

from infra.http import Network
from infra.scheduler import Scheduler
from stubs.supplier import SupplierSystem

QUOTE_LATENCY_MS = 1100
BULK_QUOTE_LATENCY_MS = 400
PASS_PRICES = {  # cents, by festival and age group
    "desert-bloom": {"adult": 29900, "teen": 17900},
    "neon-nights": {"adult": 24900, "teen": 14900},
    "lakeside-fest": {"adult": 32900, "teen": 19900},
    "sunset-sessions": {"adult": 27900, "teen": 16900},
}


class BoxOffice(SupplierSystem):
    def __init__(
        self, network: Network, scheduler: Scheduler, decisions: Mapping[str, str]
    ) -> None:
        super().__init__("box_office", network, scheduler, decisions)
        network.register("box_office", "quote", self._quote, QUOTE_LATENCY_MS)
        network.register("box_office", "quotes", self._quotes, BULK_QUOTE_LATENCY_MS)

    def invoice(self, order: dict) -> dict:
        reference = f"BO-{order['reference']}"
        return {"invoice_no": reference, "total_cents": order["amount"]}

    def _quote(self, request: dict) -> dict:
        prices = PASS_PRICES[request["festival_id"]]
        return {"price": prices[request["age_group"]]}

    def _quotes(self, request: dict) -> dict:
        prices = PASS_PRICES[request["festival_id"]]
        return {"prices": [prices[group] for group in request["age_groups"]]}
