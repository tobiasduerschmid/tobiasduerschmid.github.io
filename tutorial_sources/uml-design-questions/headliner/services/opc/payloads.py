"""Trip orders as JSON, the form PurchaseOrderService accepts and the Order DB keeps."""

from dataclasses import asdict, fields
from datetime import datetime

from services.opc.model.items import (
    Experience,
    FestivalPass,
    LodgingStay,
    ShuttleRide,
    TripItem,
)
from services.opc.model.orders import Attendee, Fan, Payment, TripOrder

ITEM_TYPES: dict[str, type[TripItem]] = {
    item_type.__name__: item_type
    for item_type in (FestivalPass, LodgingStay, ShuttleRide, Experience)
}


def order_from_payload(order_id: str, payload: dict) -> TripOrder:
    """Build a trip order; raises ValueError if it breaks a rule of the data model."""
    attendees = {
        attendee["name"]: Attendee(attendee["name"], attendee["age_group"])
        for attendee in payload["attendees"]
    }
    return TripOrder(
        order_id=order_id,
        buyer=Fan(**payload["buyer"]),
        attendees=list(attendees.values()),
        items=[item_from_payload(item, attendees) for item in payload["items"]],
        payment=Payment(**payload["payment"]),
        festival_id=payload["festival_id"],
        festival_start=datetime.fromisoformat(payload["festival_start"]),
    )


def order_to_payload(order: TripOrder) -> dict:
    return {
        "buyer": asdict(order.buyer),
        "attendees": [asdict(attendee) for attendee in order.attendees],
        "festival_id": order.festival_id,
        "festival_start": order.festival_start.isoformat(),
        "items": [item_to_payload(item) for item in order.items],
        "payment": asdict(order.payment),
    }


def item_from_payload(payload: dict, attendees: dict[str, Attendee]) -> TripItem:
    """Build an item whose attendees are named in payload and listed in attendees."""
    values = {name: value for name, value in payload.items() if name != "type"}
    if strangers := set(payload["attendees"]).difference(attendees):
        raise ValueError(f"not attendees of the order: {', '.join(sorted(strangers))}")
    values["attendees"] = [attendees[name] for name in payload["attendees"]]
    for name in ("check_in", "departure"):
        if name in values:
            values[name] = datetime.fromisoformat(values[name])
    return ITEM_TYPES[payload["type"]](**values)


def item_to_payload(item: TripItem) -> dict:
    payload: dict = {"type": type(item).__name__}
    for field in fields(item):
        value = getattr(item, field.name)
        if field.name == "attendees":
            value = [attendee.name for attendee in value]
        elif isinstance(value, datetime):
            value = value.isoformat()
        payload[field.name] = value
    return payload
