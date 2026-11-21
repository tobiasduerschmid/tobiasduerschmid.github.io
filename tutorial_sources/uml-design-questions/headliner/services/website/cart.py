"""The fan's cart: who is going, and what they picked from the catalog."""

from dataclasses import dataclass, field
from typing import Literal


@dataclass(frozen=True)
class Guest:
    name: str
    age_group: Literal["adult", "teen"] = "adult"


@dataclass(frozen=True)
class CartLine:
    """A stay, ride, or experience from the catalog, for the guests it names."""

    kind: Literal["stay", "ride", "experience"]
    offer_id: str
    guest_names: tuple[str, ...]


@dataclass
class Cart:
    """A trip to one festival. Every guest gets a festival pass."""

    festival_id: str
    guests: list[Guest]
    lines: list[CartLine] = field(default_factory=list)

    def lines_of(self, kind: str) -> list[CartLine]:
        return [line for line in self.lines if line.kind == kind]

    def guests_on(self, line: CartLine) -> tuple[Guest, ...]:
        by_name = {guest.name: guest for guest in self.guests}
        return tuple(by_name[name] for name in line.guest_names)
