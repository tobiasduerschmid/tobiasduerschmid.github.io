"""The things a trip order buys from suppliers. Prices are in cents."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from services.opc.model.orders import Attendee

ONE_DAY = timedelta(days=1)


@dataclass
class TripItem(ABC):
    """One thing on a trip order, bought from one supplier for some attendees."""

    supplier_id: str
    attendees: list[Attendee]

    def __post_init__(self) -> None:
        if not self.attendees:
            raise ValueError(f"{type(self).__name__} needs at least one attendee")

    @abstractmethod
    def price(self) -> int:
        """What the supplier charges for this item."""

    @abstractmethod
    def supplier_kind(self) -> str:
        """The kind of supplier that provides this item, such as "lodging"."""

    @abstractmethod
    def cancellation_deadline(self, festival_start: datetime) -> datetime:
        """The last moment a fan can cancel this item for a refund."""


@dataclass
class FestivalPass(TripItem):
    festival_id: str
    unit_price: int

    def price(self) -> int:
        return self.unit_price * len(self.attendees)

    def supplier_kind(self) -> str:
        return "pass"

    def cancellation_deadline(self, festival_start: datetime) -> datetime:
        return festival_start - ONE_DAY


@dataclass
class LodgingStay(TripItem):
    """A campsite, tent, cabin, or hotel room that its attendees share."""

    check_in: datetime
    nights: int
    unit: str
    nightly_rate: int

    def price(self) -> int:
        return self.nightly_rate * self.nights

    def supplier_kind(self) -> str:
        return "lodging"

    def cancellation_deadline(self, festival_start: datetime) -> datetime:
        return self.check_in - ONE_DAY


@dataclass
class Experience(TripItem):
    """An add-on at the festival, such as sunrise yoga or an artist meet-and-greet."""

    experience_id: str
    unit_price: int

    def price(self) -> int:
        return self.unit_price * len(self.attendees)

    def supplier_kind(self) -> str:
        return "experience"

    def cancellation_deadline(self, festival_start: datetime) -> datetime:
        return festival_start - ONE_DAY


@dataclass
class TransportItem(TripItem):
    """A ride to or from the festival."""

    departure: datetime

    def cancellation_deadline(self, festival_start: datetime) -> datetime:
        return self.departure - ONE_DAY


@dataclass
class ShuttleRide(TransportItem):
    route: str
    fare: int

    def price(self) -> int:
        return self.fare * len(self.attendees)

    def supplier_kind(self) -> str:
        return "shuttle"
