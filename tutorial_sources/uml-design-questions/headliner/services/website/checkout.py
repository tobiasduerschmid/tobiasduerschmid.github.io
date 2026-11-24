"""Checkout: what happens when a fan presses Book now."""

from collections.abc import Mapping
from dataclasses import asdict, dataclass
from datetime import datetime

from infra.clock import Clock
from services.website.availability import AvailabilityGuard
from services.website.cart import Cart
from services.website.clients import BankClient, CatalogClient, OpcClient
from services.website.errors import NotOnSale
from services.website.payments import requires_valid_card
from services.website.pricing import PricedLine, Quote, TripPricer

PASS_SUPPLIER = "box-office"  # every festival sells its passes through the box office


@dataclass(frozen=True)
class FanAccount:
    """The signed-in fan."""

    fan_id: str
    name: str
    email: str


class CheckoutController:
    def __init__(
        self,
        cards: BankClient,
        catalog: CatalogClient,
        pricer: TripPricer,
        guard: AvailabilityGuard,
        opc: OpcClient,
        clock: Clock,
    ) -> None:
        self.cards = cards
        self._catalog = catalog
        self._pricer = pricer
        self._guard = guard
        self._opc = opc
        self._clock = clock

    @requires_valid_card
    def submit(self, fan: FanAccount, cart: Cart, card_token: str) -> dict:
        """Book the cart, and return what the fan sees next."""
        festival = self._catalog.festival(cart.festival_id)
        self._require_on_sale(festival)
        quote = self._pricer.price(cart)
        self._guard.check(cart)
        order_id = self._opc.submit(trip_order(fan, cart, festival, quote, card_token))
        return {"message": "Order received", "order_id": order_id}

    def _require_on_sale(self, festival: dict) -> None:
        now, name = self._clock.now(), festival["name"]
        if now < datetime.fromisoformat(festival["sales_open"]):
            raise NotOnSale(f"{name} trips go on sale at {festival['sales_open']}.")
        if now >= datetime.fromisoformat(festival["starts"]):
            raise NotOnSale(f"{name} has started, so its trips are no longer on sale.")


def trip_order(
    fan: FanAccount, cart: Cart, festival: dict, quote: Quote, card_token: str
) -> dict:
    """The trip order in the JSON form that the OPC's PurchaseOrderService takes."""
    return {
        "buyer": asdict(fan),
        "attendees": [asdict(guest) for guest in cart.guests],
        "festival_id": festival["id"],
        "festival_start": festival["starts"],
        "items": [_item(line, festival["id"]) for line in quote.lines],
        "payment": {"card_token": card_token, "amount": quote.total},
    }


def _item(line: PricedLine, festival_id: str) -> dict:
    offer = line.offer
    item = {
        "supplier_id": offer.get("supplier_id", PASS_SUPPLIER),
        "attendees": [guest.name for guest in line.guests],
    }
    if line.kind == "pass":
        item |= {"type": "FestivalPass", "festival_id": festival_id}
        return item | {"unit_price": line.amount}
    if line.kind == "stay":
        item["type"] = "LodgingStay"
        return item | _pick(offer, "check_in", "nights", "unit", "nightly_rate")
    if line.kind == "ride":
        item["type"] = "ShuttleRide"
        return item | _pick(offer, "departure", "route", "fare")
    item |= {"type": "Experience", "experience_id": offer["id"]}
    return item | {"unit_price": offer["unit_price"]}


def _pick(offer: Mapping, *keys: str) -> dict:
    return {key: offer[key] for key in keys}
