"""Rules that relate the attendees and items of one trip order."""

from __future__ import annotations

from typing import TYPE_CHECKING

from services.opc.model.items import Experience, FestivalPass

if TYPE_CHECKING:
    from services.opc.model.orders import TripOrder


def check_item_attendees(order: TripOrder) -> None:
    """Every item is for attendees of the order, and every attendee gets an item."""
    on_items = {attendee for item in order.items for attendee in item.attendees}
    if strangers := on_items.difference(order.attendees):
        raise ValueError(f"not attendees of the order: {_names(strangers)}")
    if left_out := set(order.attendees).difference(on_items):
        raise ValueError(f"attendees without any item: {_names(left_out)}")


def check_experience_attendees(order: TripOrder) -> None:
    """Every attendee of an experience holds a festival pass on the same order."""
    pass_holders = {
        attendee
        for item in order.items
        if isinstance(item, FestivalPass)
        for attendee in item.attendees
    }
    for item in order.items:
        if isinstance(item, Experience):
            if without_pass := set(item.attendees).difference(pass_holders):
                raise ValueError(
                    f"{item.experience_id} needs a festival pass for "
                    f"{_names(without_pass)}"
                )


def _names(attendees: set) -> str:
    return ", ".join(sorted(attendee.name for attendee in attendees))
