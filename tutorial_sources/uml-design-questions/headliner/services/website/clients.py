"""Clients for the systems the Trip Website calls while a fan books."""

from infra.db import Database
from infra.http import ServiceClient

OFFER_TABLES = {"stay": "lodging", "ride": "shuttles", "experience": "experiences"}


class CatalogClient:
    """Festivals and supplier offers, from the Catalog DB."""

    def __init__(self, db: Database) -> None:
        self._db = db

    def festival(self, festival_id: str) -> dict:
        return self._db.get("festivals", festival_id)

    def offer(self, kind: str, offer_id: str) -> dict:
        return self._db.get(OFFER_TABLES[kind], offer_id)


class BankClient:
    def __init__(self, bank: ServiceClient) -> None:
        self._bank = bank

    def validate(self, card_token: str, amount: int) -> bool:
        """Ask whether the card can pay amount cents. 0 checks that the card is open."""
        request = {"card_token": card_token, "amount": amount}
        return self._bank.call("validate", request)["valid"]


class BoxOfficeClient:
    def __init__(self, box_office: ServiceClient) -> None:
        self._box_office = box_office

    def quote_pass(self, festival_id: str, age_group: str) -> int:
        request = {"festival_id": festival_id, "age_group": age_group}
        return self._box_office.call("quote", request)["price"]

    def quote_passes(self, festival_id: str, age_groups: list[str]) -> list[int]:
        """Quote several passes in one request, in the order of age_groups."""
        request = {"festival_id": festival_id, "age_groups": age_groups}
        return self._box_office.call("quotes", request)["prices"]


class ExperienceClient:
    def __init__(self, experiences: ServiceClient) -> None:
        self._experiences = experiences

    def check_capacity(self, experience_id: str, count: int) -> bool:
        request = {"experience_id": experience_id, "count": count}
        return self._experiences.call("capacity", request)["available"]


class OpcClient:
    """The Order Processing Center's purchase order and order tracking services."""

    def __init__(self, opc: ServiceClient) -> None:
        self._opc = opc

    def submit(self, order: dict) -> str:
        response = self._opc.call("PurchaseOrderService.submit", {"order": order})
        return response["order_id"]

    def cancel(self, order_id: str) -> None:
        self._opc.call("PurchaseOrderService.cancel", {"order_id": order_id})

    def track(self, order_id: str) -> dict:
        return self._opc.call("OrderTrackingService.status", {"order_id": order_id})
