"""Hidden checks on Headliner, the codebase of the UML design questions tutorial.

Students read Headliner's code and its own test suite, so that suite stays
neutral. These checks pin what the tutorial's answer keys rely on: the
seeded design defects and the facts each task asks about. They run against
tutorial_sources/uml-design-questions/headliner.
"""

import runpy
import sys
import tomllib
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import get_type_hints

import pytest

HEADLINER = Path(__file__).resolve().parents[2] / (
    "tutorial_sources/uml-design-questions/headliner"
)
sys.dont_write_bytecode = True  # keep the student-facing tree free of caches
sys.path.insert(0, str(HEADLINER))

from devstack import build_stack  # noqa: E402
from infra.broker import BrokerUnavailable, topic_matches  # noqa: E402
from infra.clock import FakeClock  # noqa: E402
from infra.db import connect  # noqa: E402
from infra.http import Network, ServiceClient  # noqa: E402
from services.opc.gateways.base import SupplierUnavailable  # noqa: E402
from services.opc.gateways.registry import gateway_for  # noqa: E402
from services.opc.gateways.shuttle import ShuttleGateway  # noqa: E402
from services.opc.model.items import (  # noqa: E402
    Experience,
    FestivalPass,
    LodgingStay,
    TransportItem,
)
from services.opc.model.orders import Attendee, Fan, Payment, TripOrder  # noqa: E402
from services.opc.model.suppliers import SupplierOrder  # noqa: E402
from services.opc.partners.errors import ManualCancellationRequired  # noqa: E402
from services.website.cart import Cart, CartLine, Guest  # noqa: E402
from services.website.checkout import FanAccount  # noqa: E402
from services.website.clients import BoxOfficeClient, CatalogClient  # noqa: E402
from services.website.pricing import SERVICE_FEE_RATE, TripPricer  # noqa: E402

START = datetime(2027, 6, 11, 9, 0, tzinfo=timezone.utc)
LAKESIDE_START = datetime(2027, 8, 20, 12, 0, tzinfo=timezone.utc)
CHECK_IN = datetime(2027, 8, 19, 15, 0, tzinfo=timezone.utc)
BUYER = Fan("fan-7", "Rosa Diaz", "rosa@example.com")


# --- T4: what the data model allows -------------------------------------------


def friends(count):
    return [Attendee(f"Friend {number}") for number in range(1, count + 1)]


def weekend_pass(*attendees):
    return FestivalPass("box-office", list(attendees), "lakeside-fest", 32900)


def stay(attendees, check_in=CHECK_IN, supplier_id="glampingco"):
    return LodgingStay(supplier_id, list(attendees), check_in, 2, "Bell tent", 18900)


def trip_order(attendees, items, buyer=BUYER):
    return TripOrder(
        "HL-1001",
        buyer,
        list(attendees),
        items,
        Payment("tok_visa", 90000),
        "lakeside-fest",
        LAKESIDE_START,
    )


def test_attendee_limit():
    trip_order(friends(8), [weekend_pass(*friends(8))])

    with pytest.raises(ValueError, match="1 to 8 attendees"):
        trip_order(friends(9), [weekend_pass(*friends(9))])


def test_buyer_need_not_attend():
    order = trip_order(friends(3), [weekend_pass(*friends(3))])

    assert BUYER.name not in {attendee.name for attendee in order.attendees}


def test_shared_tent_and_cabin_allowed():
    a, b, c = friends(3)

    order = trip_order([a, b, c], [weekend_pass(a, b, c), stay([a, b]), stay([c])])

    assert [len(item.attendees) for item in order.items[1:]] == [2, 1]


def test_meet_and_greet_requires_pass():
    a, b = friends(2)
    meet = Experience("meet-and-greet", [a, b], "lf-meet-the-tides", 9900)

    with pytest.raises(ValueError, match="festival pass"):
        trip_order([a, b], [weekend_pass(a), meet])


def test_payment_is_single():
    assert get_type_hints(TripOrder)["payment"] is Payment


def test_supplier_order_has_one_trip_order():
    assert get_type_hints(SupplierOrder)["trip_order_id"] is str


def test_transport_item_supplies_deadline():
    departure = datetime(2027, 8, 20, 8, 0, tzinfo=timezone.utc)

    class RidesharePickup(TransportItem):
        def price(self):
            return 4000

        def supplier_kind(self):
            return "rideshare"

    class NoPrice(TransportItem):
        def supplier_kind(self):
            return "rideshare"

    pickup = RidesharePickup("rideshare", friends(1), departure)
    assert pickup.cancellation_deadline(LAKESIDE_START) == departure - timedelta(days=1)
    with pytest.raises(TypeError, match="price"):
        NoPrice("rideshare", friends(1), departure)


# --- Capstone Q-e: the SupplierGateway hierarchy ----------------------------------


def supplier_api(network, service):
    """Serve a supplier's place and cancel endpoints; return the requests made."""
    requests = []
    for endpoint in ("place", "cancel"):
        network.register(
            service,
            endpoint,
            lambda body, endpoint=endpoint: requests.append(endpoint) or {},
        )
    return requests


def test_partner_cancel_overrides():
    clock = FakeClock(START)
    network = Network(clock)
    lodging = supplier_api(network, "lodging")
    supplier_api(network, "experiences")
    supplier_api(network, "shuttle")
    glamping = gateway_for("glampingco", network, clock)

    def glamping_order(hours_before_check_in):
        check_in = START + timedelta(hours=hours_before_check_in)
        return SupplierOrder("glampingco", "HL-1", [stay(friends(1), check_in)])

    for hours in (48, 72):
        with pytest.raises(ManualCancellationRequired):
            glamping.cancel(glamping_order(hours))
    glamping.cancel(glamping_order(96))
    meet = Experience("meet-and-greet", friends(1), "lf-meet-the-tides", 9900)
    with pytest.raises(ManualCancellationRequired):
        gateway_for("meet-and-greet", network, clock).cancel(
            SupplierOrder("meet-and-greet", "HL-3", [meet])
        )

    assert lodging == ["cancel"]
    assert type(gateway_for("vip-shuttle", network, clock)).cancel is (
        ShuttleGateway.cancel
    )


def test_manual_cancellation_is_not_supplier_unavailable():
    assert not issubclass(ManualCancellationRequired, SupplierUnavailable)


# --- T3: failure paths in the order workflow --------------------------------------

GUESTS = ["Rosa Diaz", "Sam Diaz"]
NEON_CHECK_IN = datetime(2027, 7, 8, 15, 0, tzinfo=timezone.utc)


def neon_nights_order():
    """Passes, a GlampingCo bell tent, and a shuttle ride, as the website sends them."""
    return {
        "buyer": {"fan_id": "fan-7", "name": "Rosa Diaz", "email": BUYER.email},
        "attendees": [
            {"name": "Rosa Diaz", "age_group": "adult"},
            {"name": "Sam Diaz", "age_group": "teen"},
        ],
        "festival_id": "neon-nights",
        "festival_start": "2027-07-09T14:00:00+00:00",
        "items": [
            {"type": "FestivalPass", "supplier_id": "box-office", "attendees": GUESTS,
             "festival_id": "neon-nights", "unit_price": 24900},
            {"type": "LodgingStay", "supplier_id": "glampingco", "attendees": GUESTS,
             "check_in": NEON_CHECK_IN.isoformat(), "nights": 3,
             "unit": "Bell tent for two", "nightly_rate": 18900},
            {"type": "ShuttleRide", "supplier_id": "shuttle", "attendees": GUESTS,
             "departure": "2027-07-09T10:00:00+00:00", "route": "Downtown",
             "fare": 2500},
        ],
        "payment": {"card_token": "tok_visa", "amount": 128000},
    }


def opc_call(stack, endpoint, body):
    return ServiceClient("opc", stack.network, caller="website").call(endpoint, body)


def submit(stack):
    body = {"order": neon_nights_order()}
    return opc_call(stack, "PurchaseOrderService.submit", body)["order_id"]


def positions(stack, service, *endpoints):
    """Where calls to service's endpoints appear in the network's call log."""
    return [
        position
        for position, call in enumerate(stack.network.call_log)
        if call.service == service and call.endpoint in endpoints
    ]


def supplier_statuses(stack, order_id):
    order = stack.opc.orders.get(order_id)
    return {s.supplier_id: s.status for s in order.supplier_orders}


def test_submit_returns_before_processing():
    stack = build_stack()

    submit(stack)

    assert positions(stack, "bank", "capture") == []
    assert positions(stack, "lodging", "place") == []


def test_capture_happens_before_supplier_answers():
    stack = build_stack()
    submit(stack)

    stack.run_until_idle()

    captures = positions(stack, "bank", "capture")
    answers = positions(stack, "opc", "SupplierCallbackService.answer")
    assert len(captures) == 1 and len(answers) == 3
    assert captures[0] < min(answers)


def test_rejection_marks_failed_without_refund():
    stack = build_stack(supplier_decisions={"shuttle": "reject"})
    order_id = submit(stack)

    stack.run_until_idle()

    assert stack.opc.orders.get(order_id).status == "failed"
    assert stack.stubs.bank.captured_for(order_id) == 128000
    assert positions(stack, "bank", "refund") == []
    assert supplier_statuses(stack, order_id) == {
        "box-office": "confirmed",
        "glampingco": "confirmed",
        "shuttle": "rejected",
    }
    assert stack.stubs.lodging.bookings[f"{order_id}-glampingco"] == "confirmed"
    assert positions(stack, "lodging", "cancel") == []


def test_broker_down_blocks_submit():
    stack = build_stack(down=("broker",))

    with pytest.raises(BrokerUnavailable):
        submit(stack)


def test_lodging_down_delays_processing():
    stack = build_stack(down=("lodging",))
    order_id = submit(stack)
    stack.run_until_idle()
    assert stack.opc.orders.get(order_id).status == "processing"

    stack.network.restore("lodging")
    stack.run_until_idle()

    assert stack.opc.orders.get(order_id).status == "confirmed"


def test_cancellation_refunds_first():
    stack = build_stack()
    order_id = submit(stack)
    stack.run_until_idle()

    opc_call(stack, "PurchaseOrderService.cancel", {"order_id": order_id})
    refunds = positions(stack, "bank", "refund")
    stack.run_until_idle()

    cancels = positions(stack, "box_office", "cancel") + positions(
        stack, "lodging", "cancel"
    ) + positions(stack, "shuttle", "cancel")
    assert len(refunds) == 1 and len(cancels) == 3
    assert refunds[0] < min(cancels)
    assert stack.opc.orders.get(order_id).status == "cancelled"


def test_glampingco_cancellation_48h_stays_cancelling():
    stack = build_stack()
    order_id = submit(stack)
    stack.run_until_idle()
    two_days_before = NEON_CHECK_IN - timedelta(hours=48)
    stack.clock.advance((two_days_before - stack.clock.now()).total_seconds())

    opc_call(stack, "PurchaseOrderService.cancel", {"order_id": order_id})
    stack.run_until_idle()

    assert positions(stack, "bank", "refund") != []
    assert stack.opc.orders.get(order_id).status == "cancelling"
    assert supplier_statuses(stack, order_id) == {
        "box-office": "cancelled",
        "glampingco": "cancelling",
        "shuttle": "cancelled",
    }
    assert stack.stubs.lodging.bookings[f"{order_id}-glampingco"] == "confirmed"


# --- T6, T5, and capstone Q-a and Q-d: the Trip Website ------------------------------

FAN = FanAccount("fan-12", "Maya Chen", "maya@example.com")
GROUP = ("Maya Chen", "Leo Chen", "Ava Ruiz", "Noah Ruiz", "Zoe Park")
EXTERNAL = {"bank", "box_office", "experiences"}


def group_cart():
    """Five Lakeside Fest attendees with a lodge, a shuttle, and three experiences."""
    guests = [Guest(name) for name in GROUP[:4]] + [Guest(GROUP[4], "teen")]
    experiences = ("lf-sunrise-yoga", "lf-silent-disco", "lf-meet-the-tides")
    return Cart(
        "lakeside-fest",
        guests,
        [
            CartLine("stay", "lf-lakeview-lodge", GROUP),
            CartLine("ride", "lf-station-shuttle", GROUP),
            *(CartLine("experience", offer, GROUP) for offer in experiences),
        ],
    )


def timed_requests(stack):
    """Record (service, endpoint, seconds on the fake clock) for every request."""
    timings = []
    request = stack.network.request

    def timed(caller, service, endpoint, payload):
        start = stack.clock.now()
        try:
            return request(caller, service, endpoint, payload)
        finally:
            seconds = (stack.clock.now() - start).total_seconds()
            timings.append((service, endpoint, seconds))

    stack.network.request = timed
    return timings


def checkout(stack, cart):
    """Book cart on the website; return the response and the seconds it took."""
    start = stack.clock.now()
    response = stack.website.book(FAN, cart, "tok_visa")
    return response, (stack.clock.now() - start).total_seconds()


def test_group_checkout_external_calls():
    stack = build_stack()
    first_call = len(stack.network.call_log)

    response, seconds = checkout(stack, group_cart())

    external = [c for c in stack.network.call_log[first_call:] if c.service in EXTERNAL]
    assert response["message"] == "Order received"
    assert Counter(call.service for call in external) == {
        "bank": 1,
        "box_office": 5,
        "experiences": 3,
    }
    assert 8.0 <= seconds <= 8.8


def test_bulk_quote_and_parallel_checks_meet_target():
    stack = build_stack()
    timings = timed_requests(stack)
    _, seconds = checkout(stack, group_cart())
    quotes = [s for service, endpoint, s in timings if endpoint == "quote"]
    checks = [s for service, endpoint, s in timings if endpoint == "capacity"]
    start = stack.clock.now()
    BoxOfficeClient(ServiceClient("box_office", stack.network, "website")).quote_passes(
        "lakeside-fest", [guest.age_group for guest in group_cart().guests]
    )
    bulk_quote = (stack.clock.now() - start).total_seconds()

    keyed_fix = seconds - sum(quotes) + bulk_quote - sum(checks) + max(checks)

    assert len(quotes) == 5 and len(checks) == 3
    assert keyed_fix < 2.0


def test_bank_down_blocks_submit():
    stack = build_stack(down=("bank",))

    response, _ = checkout(stack, group_cart())

    assert "order_id" not in response
    assert positions(stack, "opc", "PurchaseOrderService.submit") == []


def test_service_fee_applied():
    stack = build_stack()
    catalog = CatalogClient(connect("postgres://catalog-db.internal/catalog"))
    box_office = BoxOfficeClient(ServiceClient("box_office", stack.network, "website"))

    quote = TripPricer(catalog, box_office).price(group_cart())

    assert SERVICE_FEE_RATE == 0.12
    assert quote.service_fee == round(quote.subtotal * 0.12)
    assert quote.total == quote.subtotal + quote.service_fee


def test_order_history_reads_replica():
    stack = build_stack()
    response, _ = checkout(stack, group_cart())
    stack.run_until_idle()
    first_call = len(stack.network.call_log)

    trips = stack.website.my_trips(FAN.fan_id)

    assert [trip["order_id"] for trip in trips] == [response["order_id"]]
    assert stack.network.call_log[first_call:] == []
    settings = tomllib.loads((HEADLINER / "deploy/website.toml").read_text())
    replica = connect(settings["ORDER_HISTORY_DSN"])
    assert replica.name == "postgres://order-db-replica.internal/orders"
    with pytest.raises(PermissionError):
        replica.insert("orders", {"fan_id": FAN.fan_id})


# --- T1 and T5: event consumers, and outages -----------------------------------------


def receivers(stack, routing_key):
    return {
        stack.component_of(binding.queue)
        for binding in stack.broker.bindings()
        if binding.exchange == "trips" and topic_matches(binding.pattern, routing_key)
    }


def camping_cart():
    campers = ("Ines Moreau", "Jon Park")
    return Cart(
        "lakeside-fest",
        [Guest(name) for name in campers],
        [CartLine("stay", "lf-lakeshore-campsite", campers)],
    )


def confirmed_trip(stack):
    order_id = stack.website.book(FAN, camping_cart(), "tok_visa")["order_id"]
    stack.run_until_idle()
    return order_id


def test_trip_confirmed_receivers():
    stack = build_stack()
    assert receivers(stack, "trip.confirmed") == {
        "Notifications",
        "Loyalty",
        "WarehouseETL",
        "AffiliateRelay",
    }

    confirmed_trip(stack)

    consumers = stack.consumers
    assert stack.stubs.mail_relay.delivered_to(FAN.email) != []
    assert consumers.loyalty.balance(FAN.fan_id) > 0
    assert "trip.confirmed" in {row["event"] for row in consumers.warehouse.rows}
    assert consumers.support_console.follow_ups == []


def test_trip_cancelled_receivers():
    stack = build_stack()
    assert receivers(stack, "trip.cancelled") == {
        "Notifications",
        "WarehouseETL",
        "AffiliateRelay",
        "SupportConsole",
    }

    order_id = confirmed_trip(stack)
    stack.website.cancel(order_id)
    stack.run_until_idle()

    follow_ups = stack.consumers.support_console.follow_ups
    assert [follow_up["order_id"] for follow_up in follow_ups] == [order_id]


def test_affiliate_relay_calls_partner_webhook():
    stack = build_stack()

    order_id = confirmed_trip(stack)

    received = stack.stubs.affiliate_partners.received
    assert [(event["event"], event["order_id"]) for event in received] == [
        ("trip.confirmed", order_id)
    ]
    assert received[0]["fan_name"] == FAN.name
    assert positions(stack, "affiliate_partners", "webhook") != []


def test_mail_relay_down_only_delays_emails():
    stack = build_stack(down=("mail_relay",))
    order_id = confirmed_trip(stack)
    assert stack.website.track(order_id)["status"] == "confirmed"
    assert stack.stubs.mail_relay.delivered_to(FAN.email) == []

    stack.network.restore("mail_relay")
    stack.run_until_idle()

    assert len(stack.stubs.mail_relay.delivered_to(FAN.email)) == 1


def test_scenarios_run(capsys):
    runpy.run_path(str(HEADLINER / "scenarios/failed_trip.py"), run_name="__main__")
    failed_trip = capsys.readouterr().out
    runpy.run_path(
        str(HEADLINER / "scenarios/slow_group_checkout.py"), run_name="__main__"
    )
    slow_checkout = capsys.readouterr().out

    assert "failed" in failed_trip
    assert "refund" not in failed_trip.lower()
    assert "glampingco" in failed_trip.lower() and "confirmed" in failed_trip
    assert "8.4 s" in slow_checkout
