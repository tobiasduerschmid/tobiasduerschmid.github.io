"""Tests for the trip-order data model."""

from datetime import datetime, timedelta, timezone

from services.opc.model.items import FestivalPass, LodgingStay, ShuttleRide
from services.opc.model.orders import Attendee, Fan, Payment, TripOrder
from services.opc.payloads import order_from_payload, order_to_payload

FESTIVAL_START = datetime(2027, 8, 20, 12, 0, tzinfo=timezone.utc)
CHECK_IN = datetime(2027, 8, 19, 15, 0, tzinfo=timezone.utc)
ANA, BEN = Attendee("Ana Lima"), Attendee("Ben Okafor", "teen")


def weekend_pass(*attendees, unit_price=32900):
    return FestivalPass("box-office", list(attendees), "lakeside-fest", unit_price)


def lakeside_order(items):
    return TripOrder(
        order_id="HL-1001",
        buyer=Fan("fan-7", "Ana Lima", "ana@example.com"),
        attendees=[ANA, BEN],
        items=items,
        payment=Payment("tok_visa", 120000),
        festival_id="lakeside-fest",
        festival_start=FESTIVAL_START,
    )


def test_order_total_adds_up_its_item_prices():
    stay = LodgingStay("lodging", [ANA, BEN], CHECK_IN, 3, "Lakeview cabin", 21000)

    passes = [weekend_pass(ANA), weekend_pass(BEN, unit_price=19900)]

    order = lakeside_order([*passes, stay])

    assert order.total() == 32900 + 19900 + 3 * 21000


def test_a_stay_is_priced_per_night_whoever_shares_it():
    for_one = LodgingStay("lodging", [ANA], CHECK_IN, 2, "Bell tent", 18900)
    for_two = LodgingStay("lodging", [ANA, BEN], CHECK_IN, 2, "Bell tent", 18900)

    assert for_one.price() == for_two.price() == 2 * 18900


def test_a_shuttle_ride_is_priced_per_seat():
    departure = datetime(2027, 8, 20, 9, 0, tzinfo=timezone.utc)

    ride = ShuttleRide("shuttle", [ANA, BEN], departure, "Union Station", 2500)

    assert ride.price() == 2 * 2500


def test_a_stay_can_be_cancelled_until_a_day_before_check_in():
    stay = LodgingStay("lodging", [ANA], CHECK_IN, 2, "Bell tent", 18900)

    assert stay.cancellation_deadline(FESTIVAL_START) == CHECK_IN - timedelta(days=1)


def test_a_new_order_is_received_until_its_suppliers_confirm():
    order = lakeside_order([weekend_pass(ANA), weekend_pass(BEN)])
    assert order.status == "received"

    order.mark_processing()
    order.mark_confirmed()

    assert order.status == "confirmed"


def test_an_order_keeps_everything_through_its_json_form():
    stay = LodgingStay("lodging", [ANA, BEN], CHECK_IN, 3, "Lakeview cabin", 21000)
    order = lakeside_order([weekend_pass(ANA), weekend_pass(BEN), stay])

    copy = order_from_payload("HL-1001", order_to_payload(order))

    assert copy == order
