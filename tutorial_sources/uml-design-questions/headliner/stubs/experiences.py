"""The experience provider: listings, capacity, and bookings for festival add-ons."""

from collections.abc import Mapping
from typing import NamedTuple

from infra.clock import FakeClock
from infra.http import Network
from infra.scheduler import Scheduler
from stubs.supplier import SupplierSystem


class Listing(NamedTuple):
    spots_left: int
    lookup_ms: int  # each operator's booking system answers at its own speed


LISTINGS = {
    "lf-sunrise-yoga": Listing(spots_left=40, lookup_ms=600),
    "lf-silent-disco": Listing(spots_left=300, lookup_ms=750),
    "lf-meet-the-tides": Listing(spots_left=12, lookup_ms=900),
}


class ExperienceProvider(SupplierSystem):
    def __init__(
        self,
        network: Network,
        scheduler: Scheduler,
        clock: FakeClock,
        decisions: Mapping[str, str],
    ) -> None:
        super().__init__("experiences", network, scheduler, decisions)
        self._clock = clock
        network.register("experiences", "capacity", self._capacity)

    def invoice(self, order: dict) -> dict:
        return {
            "invoice_id": f"EX-{order['reference']}",
            "amount": {"value": order["amount"], "currency": "USD"},
        }

    def _capacity(self, request: dict) -> dict:
        listing = LISTINGS[request["experience_id"]]
        self._clock.advance(listing.lookup_ms / 1000)
        return {"available": listing.spots_left >= request["count"]}
