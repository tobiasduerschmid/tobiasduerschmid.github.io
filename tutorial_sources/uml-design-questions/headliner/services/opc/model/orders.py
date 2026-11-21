"""Trip orders: who buys, who goes, what they get, and how they pay."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

from services.opc.model import rules
from services.opc.model.items import TripItem
from services.opc.model.suppliers import SupplierOrder

MAX_ATTENDEES = 8


@dataclass(frozen=True)
class Fan:
    """A Headliner account holder."""

    fan_id: str
    name: str
    email: str


@dataclass(frozen=True)
class Attendee:
    """Someone who goes on the trip."""

    name: str
    age_group: Literal["adult", "teen"] = "adult"


@dataclass
class Payment:
    """The card payment for a trip order, in cents."""

    card_token: str
    amount: int
    capture_id: str | None = None


@dataclass
class TripOrder:
    """A fan's order for a festival trip."""

    order_id: str
    buyer: Fan
    attendees: list[Attendee]
    items: list[TripItem]
    payment: Payment
    festival_id: str
    festival_start: datetime
    status: str = "received"
    supplier_orders: list[SupplierOrder] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not 1 <= len(self.attendees) <= MAX_ATTENDEES:
            raise ValueError(f"a trip order has 1 to {MAX_ATTENDEES} attendees")
        if not self.items:
            raise ValueError("a trip order has at least one item")
        rules.check_item_attendees(self)
        rules.check_experience_attendees(self)

    def total(self) -> int:
        """What the suppliers charge for the whole order, in cents."""
        return sum(item.price() for item in self.items)

    def cancellation_deadline(self) -> datetime:
        """The last moment the fan can cancel the order for a refund."""
        start = self.festival_start
        return min(item.cancellation_deadline(start) for item in self.items)

    def mark_processing(self) -> None:
        self.status = "processing"

    def mark_confirmed(self) -> None:
        self.status = "confirmed"

    def mark_failed(self) -> None:
        self.status = "failed"

    def mark_cancelling(self) -> None:
        self.status = "cancelling"

    def mark_cancelled(self) -> None:
        self.status = "cancelled"
