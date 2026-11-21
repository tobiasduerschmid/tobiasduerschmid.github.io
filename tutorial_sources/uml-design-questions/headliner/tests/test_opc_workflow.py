"""Tests for the Order Processing Center, run on the devstack."""

from datetime import datetime, timedelta, timezone

import pytest

from devstack import build_stack
from infra.http import ServiceClient

CAMPERS = ["Ines Moreau", "Jon Park"]
LAKESIDE_START = datetime(2027, 8, 20, 12, 0, tzinfo=timezone.utc)


def camping_trip(campers=CAMPERS):
    """Weekend passes and a campsite at Lakeside Fest, in the OPC's JSON form."""
    return {
        "buyer": {
            "fan_id": "fan-31", "name": "Ines Moreau", "email": "ines@example.com"
        },
        "attendees": [{"name": name, "age_group": "adult"} for name in CAMPERS],
        "festival_id": "lakeside-fest",
        "festival_start": LAKESIDE_START.isoformat(),
        "items": [
            {"type": "FestivalPass", "supplier_id": "box-office", "attendees": campers,
             "festival_id": "lakeside-fest", "unit_price": 32900},
            {"type": "LodgingStay", "supplier_id": "lodging", "attendees": campers,
             "check_in": "2027-08-19T15:00:00+00:00", "nights": 3,
             "unit": "Lakeshore campsite", "nightly_rate": 6500},
        ],
        "payment": {"card_token": "tok_visa", "amount": 95600},
    }


@pytest.fixture
def stack():
    return build_stack()


def call_opc(stack, endpoint, body):
    return ServiceClient("opc", stack.network, caller="website").call(endpoint, body)


def place(stack, order):
    response = call_opc(stack, "PurchaseOrderService.submit", {"order": order})
    stack.run_until_idle()
    return response["order_id"]


def status(stack, order_id):
    return call_opc(stack, "OrderTrackingService.status", {"order_id": order_id})


def test_a_trip_is_confirmed_once_every_supplier_confirms(stack):
    order_id = place(stack, camping_trip())

    assert status(stack, order_id)["status"] == "confirmed"
    assert status(stack, order_id)["suppliers"] == {
        "box-office": "confirmed",
        "lodging": "confirmed",
    }


def test_the_fans_card_is_charged_the_order_amount(stack):
    order_id = place(stack, camping_trip())

    assert stack.stubs.bank.captured_for(order_id) == 95600


def test_an_item_for_someone_not_on_the_order_is_refused(stack):
    order = camping_trip(campers=["Ines Moreau", "Kai Brandt"])

    with pytest.raises(ValueError, match="Kai Brandt"):
        call_opc(stack, "PurchaseOrderService.submit", {"order": order})


def test_a_fan_can_cancel_before_the_deadline(stack):
    order_id = place(stack, camping_trip())

    call_opc(stack, "PurchaseOrderService.cancel", {"order_id": order_id})
    stack.run_until_idle()

    assert status(stack, order_id)["status"] == "cancelled"


def test_no_cancellation_after_the_deadline(stack):
    order_id = place(stack, camping_trip())
    deadline = datetime.fromisoformat(status(stack, order_id)["cancel_by"])
    one_minute_late = deadline + timedelta(minutes=1)
    stack.clock.advance((one_minute_late - stack.clock.now()).total_seconds())

    with pytest.raises(ValueError, match="deadline"):
        call_opc(stack, "PurchaseOrderService.cancel", {"order_id": order_id})


def test_history_lists_each_order_of_a_fan(stack):
    first, second = place(stack, camping_trip()), place(stack, camping_trip())

    history = call_opc(stack, "OrderTrackingService.history", {"fan_id": "fan-31"})

    assert [order["order_id"] for order in history["orders"]] == [first, second]
