"""Trip prices: passes from the box office, everything else from the catalog."""

from collections.abc import Mapping
from dataclasses import dataclass, field

from services.website.cart import Cart, CartLine, Guest
from services.website.clients import BoxOfficeClient, CatalogClient

SERVICE_FEE_RATE = 0.12  # Headliner's fee on top of supplier prices


@dataclass(frozen=True)
class PricedLine:
    """A guest's festival pass, or a cart line with its catalog offer. In cents."""

    kind: str  # "pass", "stay", "ride", or "experience"
    guests: tuple[Guest, ...]
    amount: int
    offer: Mapping = field(default_factory=dict)  # empty for a pass


@dataclass(frozen=True)
class Quote:
    lines: list[PricedLine]
    service_fee: int

    @property
    def subtotal(self) -> int:
        return sum(line.amount for line in self.lines)

    @property
    def total(self) -> int:
        return self.subtotal + self.service_fee


class TripPricer:
    def __init__(self, catalog: CatalogClient, box_office: BoxOfficeClient) -> None:
        self._catalog = catalog
        self._box_office = box_office

    def price(self, cart: Cart) -> Quote:
        lines = self._passes(cart) + [self._priced(cart, line) for line in cart.lines]
        subtotal = sum(line.amount for line in lines)
        return Quote(lines, service_fee=round(subtotal * SERVICE_FEE_RATE))

    def _passes(self, cart: Cart) -> list[PricedLine]:
        return [
            PricedLine(
                "pass",
                (guest,),
                self._box_office.quote_pass(cart.festival_id, guest.age_group),
            )
            for guest in cart.guests
        ]

    def _priced(self, cart: Cart, line: CartLine) -> PricedLine:
        offer = self._catalog.offer(line.kind, line.offer_id)
        guests = cart.guests_on(line)
        amount = _amount(line.kind, offer, len(guests))
        return PricedLine(line.kind, guests, amount, offer)


def _amount(kind: str, offer: Mapping, guest_count: int) -> int:
    if kind == "stay":
        return offer["nightly_rate"] * offer["nights"]
    per_guest = offer["fare"] if kind == "ride" else offer["unit_price"]
    return per_guest * guest_count
