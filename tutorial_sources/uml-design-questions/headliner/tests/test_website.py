"""Tests for the Trip Website, run on the devstack."""

import pytest

from devstack import build_stack
from services.website.cart import Cart, CartLine, Guest
from services.website.checkout import FanAccount

FAN = FanAccount("fan-31", "Ines Moreau", "ines@example.com")
CAMPERS = ("Ines Moreau", "Jon Park")


@pytest.fixture
def stack():
    return build_stack()


def camping_cart(festival_id="lakeside-fest"):
    return Cart(
        festival_id,
        [Guest(name) for name in CAMPERS],
        [CartLine("stay", "lf-lakeshore-campsite", CAMPERS)],
    )


def test_the_festival_page_shows_adult_and_teen_pass_prices(stack):
    page = stack.website.festival_page("lakeside-fest")

    assert page["name"] == "Lakeside Fest"
    assert page["pass_prices"] == {"adult": 32900, "teen": 19900}


def test_booking_a_trip_returns_its_order_id(stack):
    response = stack.website.book(FAN, camping_cart(), "tok_visa")

    assert response == {"message": "Order received", "order_id": "HL-1001"}


def test_a_booked_trip_is_confirmed_once_its_suppliers_confirm(stack):
    order_id = stack.website.book(FAN, camping_cart(), "tok_visa")["order_id"]

    stack.run_until_idle()

    assert stack.website.track(order_id)["status"] == "confirmed"


def test_my_trips_lists_the_fans_orders_newest_first(stack):
    first = stack.website.book(FAN, camping_cart(), "tok_visa")["order_id"]
    second = stack.website.book(FAN, camping_cart(), "tok_visa")["order_id"]
    stack.run_until_idle()

    trips = stack.website.my_trips(FAN.fan_id)

    assert [trip["order_id"] for trip in trips] == [second, first]


def test_a_festival_that_has_started_is_no_longer_on_sale(stack):
    cart = Cart("desert-bloom", [Guest("Ines Moreau")])

    response = stack.website.book(FAN, cart, "tok_visa")

    assert response == {
        "message": "Desert Bloom has started, so its trips are no longer on sale."
    }
