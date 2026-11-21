"""The Trip Website: the pages and actions a fan uses."""

from collections.abc import Mapping

from infra.clock import Clock
from infra.db import connect
from infra.http import Network, ServiceClient, ServiceUnavailable
from services.website.availability import AvailabilityGuard
from services.website.cart import Cart
from services.website.checkout import CheckoutController, FanAccount
from services.website.clients import (
    BankClient,
    BoxOfficeClient,
    CatalogClient,
    ExperienceClient,
    OpcClient,
)
from services.website.errors import CheckoutRefused
from services.website.order_history import OrderHistoryPage
from services.website.pricing import TripPricer

TRY_AGAIN = "We could not take your order right now. Please try again in a few minutes."


class WebsiteApp:
    def __init__(
        self,
        checkout: CheckoutController,
        history: OrderHistoryPage,
        catalog: CatalogClient,
        box_office: BoxOfficeClient,
        opc: OpcClient,
    ) -> None:
        self._checkout = checkout
        self._history = history
        self._catalog = catalog
        self._box_office = box_office
        self._opc = opc

    def festival_page(self, festival_id: str) -> dict:
        festival = self._catalog.festival(festival_id)
        adult, teen = self._box_office.quote_passes(festival_id, ["adult", "teen"])
        return {
            "name": festival["name"],
            "starts": festival["starts"],
            "pass_prices": {"adult": adult, "teen": teen},
        }

    def book(self, fan: FanAccount, cart: Cart, card_token: str) -> dict:
        """The Book now button."""
        try:
            return self._checkout.submit(fan, cart, card_token)
        except CheckoutRefused as refusal:
            return {"message": str(refusal)}
        except ValueError as problem:  # the OPC refused the order
            return {"message": f"We cannot book this trip: {problem}."}
        except ServiceUnavailable:
            return {"message": TRY_AGAIN}

    def track(self, order_id: str) -> dict:
        return self._opc.track(order_id)

    def my_trips(self, fan_id: str) -> list[dict]:
        return self._history.render(fan_id)

    def cancel(self, order_id: str) -> dict:
        try:
            self._opc.cancel(order_id)
        except ValueError as reason:
            return {"message": str(reason)}
        return {"message": "Your trip is being cancelled. Your refund is on its way."}


def create_app(
    network: Network, clock: Clock, settings: Mapping[str, str]
) -> WebsiteApp:
    """Build the website from its settings (deploy/website.toml)."""

    def client(service: str) -> ServiceClient:
        return ServiceClient(service, network, caller="website")

    catalog = CatalogClient(connect(settings["CATALOG_DSN"]))
    box_office = BoxOfficeClient(client("box_office"))
    opc = OpcClient(client("opc"))
    checkout = CheckoutController(
        cards=BankClient(client("bank")),
        catalog=catalog,
        pricer=TripPricer(catalog, box_office),
        guard=AvailabilityGuard(ExperienceClient(client("experiences"))),
        opc=opc,
        clock=clock,
    )
    history = OrderHistoryPage(settings)
    return WebsiteApp(checkout, history, catalog, box_office, opc)
