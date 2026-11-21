"""Answer keys for the UML design questions tutorial, derived by running Headliner.

Every fact comes from exercising Headliner's devstack: the broker's bindings
and consumers, requests on the simulated network, how gateways behave, and
which orders the data model accepts. Nothing here searches source text.

    python3 scripts/uml_design_questions/facts.py           # print the facts
    python3 scripts/uml_design_questions/facts.py --write   # update facts.json
"""

import argparse
import json
import logging
import sys
import tomllib
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import get_type_hints

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "tutorial_sources/uml-design-questions"
HEADLINER = SOURCES / "headliner"
FACTS_JSON = SOURCES / "facts.json"

sys.dont_write_bytecode = True  # keep the student-facing tree free of caches
sys.path.insert(0, str(HEADLINER))
sys.path.insert(0, str(Path(__file__).resolve().parent))  # for diagram_facts

import diagram_facts  # noqa: E402

from devstack import build_stack  # noqa: E402
from infra.broker import Broker, Message, topic_matches  # noqa: E402
from infra.db import connect  # noqa: E402
from infra.http import ServiceClient  # noqa: E402
from services.opc.gateways.base import SupplierUnavailable  # noqa: E402
from services.opc.gateways.experiences import ExperienceGateway  # noqa: E402
from services.opc.gateways.registry import SUPPLIERS, gateway_for  # noqa: E402
from services.opc.model.items import (  # noqa: E402
    Experience,
    FestivalPass,
    LodgingStay,
    ShuttleRide,
    TransportItem,
    TripItem,
)
from services.opc.model.orders import Attendee, Payment, TripOrder  # noqa: E402
from services.opc.model.suppliers import SupplierOrder  # noqa: E402
from services.opc.payloads import order_from_payload  # noqa: E402
from services.website.cart import Cart, CartLine, Guest  # noqa: E402
from services.website.checkout import FanAccount  # noqa: E402
from services.website.clients import BoxOfficeClient, CatalogClient  # noqa: E402
from services.website.pricing import TripPricer  # noqa: E402

FAN = FanAccount("fan-90", "Rosa Diaz", "rosa@example.com")
GROUP = ("Rosa Diaz", "Sam Diaz", "Ava Ruiz", "Noah Ruiz", "Zoe Park")
LAKESIDE_EXPERIENCES = ("lf-sunrise-yoga", "lf-silent-disco", "lf-meet-the-tides")
GATEWAY_METHODS = ("cancel", "parse_invoice", "place")
STATUS_METHODS = ("mark_processing", "mark_confirmed", "mark_failed", "mark_cancelling")
OUTAGES = ("bank", "lodging", "broker", "mail_relay")


def extract() -> dict:
    """Every fact that the tutorial's answer keys and diagrams rely on."""
    return {
        "event_consumers": event_consumers(),
        "gateway_contracts": gateway_contracts(),
        "failed_trips": failed_trips(),
        "data_model": data_model(),
        "outages": {service: outage_outcome(service) for service in OUTAGES},
        "checkout_latency": checkout_latency(),
        "capstone": capstone(),
        **diagram_facts.extract(),  # "diagrams", and "evidence": path:line per note
    }


# --- Carts, and watching the stack work ------------------------------------------


def camping_cart() -> Cart:
    pair = GROUP[:2]
    return Cart(
        "lakeside-fest",
        [Guest(name) for name in pair],
        [CartLine("stay", "lf-lakeshore-campsite", pair)],
    )


def glamping_cart() -> Cart:
    """Neon Nights with a GlampingCo bell tent and the downtown shuttle."""
    pair = GROUP[:2]
    return Cart(
        "neon-nights",
        [Guest(pair[0]), Guest(pair[1], "teen")],
        [
            CartLine("stay", "nn-glamping-bell", pair),
            CartLine("ride", "nn-downtown-shuttle", pair),
        ],
    )


def group_cart() -> Cart:
    """Five attendees at Lakeside Fest with three experiences."""
    lines = [CartLine("experience", offer, GROUP) for offer in LAKESIDE_EXPERIENCES]
    return Cart(
        "lakeside-fest",
        [Guest(name) for name in GROUP[:4]] + [Guest(GROUP[4], "teen")],
        [
            CartLine("stay", "lf-lakeview-lodge", GROUP),
            CartLine("ride", "lf-station-shuttle", GROUP),
            *lines,
        ],
    )


def book(stack, cart: Cart) -> dict:
    return stack.website.book(FAN, cart, "tok_visa")


def external_services() -> set[str]:
    """Services other organizations run, as deploy/services.toml lists them."""
    with open(HEADLINER / "deploy/services.toml", "rb") as file:
        return set(tomllib.load(file)["external"])


@dataclass
class Effect:
    """Something the stack did: a request, a trip status change, or a publish."""

    kind: str  # "request", "status", or "publish"
    name: str  # "service.endpoint", "mark_failed()", or a routing key
    caller: str = ""
    service: str = ""
    payload: dict = field(default_factory=dict)
    seconds: float = 0.0

    def describe(self) -> str:
        return f"publish {self.name}" if self.kind == "publish" else self.name


def record_requests(stack, log: list[Effect]) -> None:
    """From now on, add every request on the stack's network to log."""
    send = stack.network.request

    def recorded(caller, service, endpoint, payload):
        start = stack.clock.now()
        effect = Effect("request", f"{service}.{endpoint}", caller, service, payload)
        log.append(effect)
        try:
            return send(caller, service, endpoint, payload)
        finally:
            effect.seconds = (stack.clock.now() - start).total_seconds()

    stack.network.request = recorded


def requests_by(log: list[Effect], caller: str) -> list[Effect]:
    return [e for e in log if e.kind == "request" and e.caller == caller]


@contextmanager
def recorded_trip_effects() -> Iterator[list[Effect]]:
    """Log each trip-order status change and each published message, in order."""
    log: list[Effect] = []
    originals = {name: getattr(TripOrder, name) for name in STATUS_METHODS}
    publish = Broker.publish

    def recorder(name):
        def mark(order):
            log.append(Effect("status", f"{name}()"))
            return originals[name](order)

        return mark

    def recorded_publish(broker, exchange, routing_key, message):
        log.append(Effect("publish", routing_key))
        return publish(broker, exchange, routing_key, message)

    for name in STATUS_METHODS:
        setattr(TripOrder, name, recorder(name))
    Broker.publish = recorded_publish
    try:
        yield log
    finally:
        for name, original in originals.items():
            setattr(TripOrder, name, original)
        Broker.publish = publish


# --- T1: who receives trip events --------------------------------------------------


def event_consumers() -> dict:
    stack = build_stack()

    def receivers(routing_key: str) -> list[str]:
        queues = receiving_queues(stack, routing_key)
        return sorted(stack.component_of(queue) for queue in queues)

    return {
        "trip.confirmed": receivers("trip.confirmed"),
        "trip.cancelled": receivers("trip.cancelled"),
        "external_forwarders": external_forwarders("trip.confirmed"),
    }


def receiving_queues(stack, routing_key: str) -> set[str]:
    """Queues that get a copy of a message published to trips with routing_key."""
    return {
        binding.queue
        for binding in stack.broker.bindings()
        if binding.exchange == "trips" and topic_matches(binding.pattern, routing_key)
    }


def observed_event(routing_key: str) -> dict:
    """The body of a real routing_key event, from a booked trip."""
    stack, seen = build_stack(), []
    stack.broker.declare_queue("facts.observer")
    stack.broker.bind("facts.observer", "trips", routing_key)
    stack.broker.consume("facts.observer", seen.append, component="FactsObserver")
    book(stack, camping_cart())
    stack.run_until_idle()
    return seen[0].body


def external_forwarders(routing_key: str) -> list[str]:
    """Receivers that send the event's own fields on to another organization.

    Each receiver gets the event on a fresh stack of its own, so every request
    that follows is its own.
    """
    event, external = observed_event(routing_key), external_services()
    forwarders = []
    for queue in sorted(receiving_queues(build_stack(), routing_key)):
        stack, log = build_stack(), []
        record_requests(stack, log)
        stack.deliver(queue, Message(routing_key, event))
        if any(e.service in external and set(e.payload) & set(event) for e in log):
            forwarders.append(stack.component_of(queue))
    return sorted(forwarders)


# --- Capstone Q-e: the SupplierGateway hierarchy -------------------------------------


def gateway_contracts() -> dict:
    classes = sorted({cls for cls, _ in SUPPLIERS.values()}, key=lambda c: c.__name__)
    return {
        "fails_cancel_when_online": sorted(
            gateway_class.__name__
            for supplier_id, (gateway_class, service) in SUPPLIERS.items()
            if cancel_fails_while_online(supplier_id, service)
        ),
        "overrides": {
            cls.__name__: [name for name in GATEWAY_METHODS if name in vars(cls)]
            for cls in classes
        },
        "experience_place_inheritors": [
            cls.__name__ for cls in classes if cls.place is ExperienceGateway.place
        ],
    }


def cancel_fails_while_online(supplier_id: str, service: str) -> bool:
    """Whether cancelling a placed order can raise while the supplier is reachable."""
    for lead_time in (timedelta(hours=48), timedelta(days=30)):
        stack = build_stack()
        starts = stack.clock.now() + lead_time
        item = sample_item(service, supplier_id, starts)
        order = SupplierOrder(supplier_id, "HL-9001", [item])
        gateway = gateway_for(supplier_id, stack.network, stack.clock)
        gateway.place(order)
        try:
            gateway.cancel(order)
        except SupplierUnavailable:
            raise RuntimeError(f"{service} should be reachable here") from None
        except Exception:  # any other exception is one the contract rules out
            return True
    return False


def sample_item(service: str, supplier_id: str, starts: datetime) -> TripItem:
    guest = [Attendee("Rosa Diaz")]
    if service == "box_office":
        return FestivalPass(supplier_id, guest, "lakeside-fest", 32900)
    if service == "lodging":
        return LodgingStay(supplier_id, guest, starts, 2, "Bell tent", 18900)
    if service == "shuttle":
        return ShuttleRide(supplier_id, guest, starts, "Downtown", 2500)
    return Experience(supplier_id, guest, "lf-sunrise-yoga", 3500)


# --- T3: what happens when a supplier rejects --------------------------------------


def failed_trips() -> dict:
    stack = build_stack(supplier_decisions={"shuttle": "reject"})
    with recorded_trip_effects() as log:
        record_requests(stack, log)
        book(stack, glamping_cart())
        stack.run_until_idle()
    requests = [effect.name for effect in log if effect.kind == "request"]
    rejected = next(
        position
        for position, effect in enumerate(log)
        if (effect.kind, effect.name) == ("publish", "supplier.shuttle.rejected")
    )
    branch = [
        effect.describe()
        for effect in log[rejected + 1:]
        if effect.kind != "request" or effect.caller == "opc"
    ]
    missing = []
    if "bank.refund" not in branch:
        missing.append("refund")
    if not any(name.endswith(".cancel") for name in branch):
        missing.append("cancel confirmed suppliers")
    return {
        "capture_before_first_answer": requests.index("bank.capture")
        < requests.index("opc.SupplierCallbackService.answer"),
        "reject_branch_calls": branch,
        "missing": missing,
    }


# --- T4: what the data model allows ------------------------------------------------


def data_model() -> dict:
    """Which of the product team's six trip ideas the model accepts today."""
    hints = get_type_hints(TripOrder)
    payment = next(name for name, hint in hints.items() if hint is Payment)
    ideas = {
        1: accepts(lambda: trip(friends(3), buyer="Rosa Diaz")),
        2: accepts(lambda: trip(friends(10))),
        3: accepts(lambda: trip(friends(3), stays=[(0, 1), (2,)])),
        4: hints[payment] is not Payment,  # a second card needs a list of payments
        5: accepts(lambda: trip(friends(2), passes_for=1, meet_and_greet=True)),
        6: get_type_hints(SupplierOrder)["trip_order_id"] is not str,
    }
    return {
        "allowed": [idea for idea, allowed in ideas.items() if allowed],
        "split_payment_multiplicity": f"{TripOrder.__name__}-{Payment.__name__}",
    }


def friends(count: int) -> list[dict]:
    return [{"name": f"Friend {n}", "age_group": "adult"} for n in range(1, count + 1)]


def trip(attendees, buyer=None, stays=(), passes_for=None, meet_and_greet=False):
    """A Lakeside Fest trip order, built from the OPC's JSON form."""
    names = [attendee["name"] for attendee in attendees]
    items = [_item("FestivalPass", "box-office", names[:passes_for],
                   festival_id="lakeside-fest", unit_price=32900)]
    items += [_item("LodgingStay", "glampingco", [names[i] for i in stay],
                    check_in="2027-08-19T15:00Z", nights=3, unit="Bell tent",
                    nightly_rate=18900) for stay in stays]
    if meet_and_greet:
        items.append(_item("Experience", "meet-and-greet", names,
                           experience_id="lf-meet-the-tides", unit_price=9900))
    return order_from_payload("HL-9001", {
        "buyer": {"fan_id": "fan-90", "name": buyer or names[0], "email": FAN.email},
        "attendees": attendees,
        "festival_id": "lakeside-fest",
        "festival_start": "2027-08-20T12:00Z",
        "items": items,
        "payment": {"card_token": "tok_visa", "amount": 100000},
    })


def _item(item_type: str, supplier_id: str, attendees: list[str], **details) -> dict:
    return {"type": item_type, "supplier_id": supplier_id, "attendees": attendees,
            **details}


def accepts(build) -> bool:
    try:
        build()
    except ValueError:
        return False
    return True


# --- T5: outages -------------------------------------------------------------------


def outage_outcome(service: str) -> str:
    """What happens to a camping trip booked while service is down."""
    stack = build_stack(down=(service,))
    response = book(stack, camping_cart())
    if "order_id" not in response:
        return "cannot_submit"
    stack.run_until_idle()
    status_while_down = stack.website.track(response["order_id"])["status"]
    mails_while_down = stack.stubs.mail_relay.delivered_to(FAN.email)
    stack.network.restore(service)
    stack.run_until_idle()
    if stack.website.track(response["order_id"])["status"] != "confirmed":
        return "never_finishes"
    if status_while_down != "confirmed":
        return "finish_afterwards"
    if not mails_while_down and stack.stubs.mail_relay.delivered_to(FAN.email):
        return "emails_wait"
    return "unaffected"


# --- T6: latency on the checkout path ------------------------------------------------


def checkout_latency() -> dict:
    """The group checkout as built, and as it would run with the keyed fix."""
    stack, log = build_stack(), []
    record_requests(stack, log)
    started = stack.clock.now()
    if book(stack, group_cart()).get("message") != "Order received":
        raise RuntimeError("the group checkout was not received")
    elapsed = (stack.clock.now() - started).total_seconds()
    calls = requests_by(log, "website")
    quotes = [call.seconds for call in calls if call.name == "box_office.quote"]
    checks = [call.seconds for call in calls if call.name == "experiences.capacity"]
    # The keyed fix: one bulk quote instead of a quote per attendee, and the
    # capacity checks in parallel, so they take as long as the slowest one.
    keyed_fix = (
        elapsed - sum(quotes) + bulk_quote_seconds(stack) - sum(checks) + max(checks)
    )
    external = external_services()
    return {
        "external_calls": sum(call.service in external for call in calls),
        "elapsed_seconds": round(elapsed, 2),
        "keyed_fix_seconds": round(keyed_fix, 2),
        "call_ms": [[call.name, round(call.seconds * 1000)] for call in calls],
    }


def bulk_quote_seconds(stack) -> float:
    """How long one bulk quote for the group's passes takes."""
    box_office = BoxOfficeClient(ServiceClient("box_office", stack.network, "website"))
    started = stack.clock.now()
    box_office.quote_passes(
        "lakeside-fest", [guest.age_group for guest in group_cart().guests]
    )
    return (stack.clock.now() - started).total_seconds()


# --- Capstone ------------------------------------------------------------------------


def capstone() -> dict:
    return {
        "website_reads_order_db": website_reads_order_db(),
        "rideshare_must_implement": sorted(TransportItem.__abstractmethods__),
        "refund_before_cancel": refund_before_cancel(),
        "glampingco_48h_stays_booked": glampingco_48h_stays_booked(),
        "service_fee": service_fee(),
    }


def website_reads_order_db() -> bool:
    """My trips shows the OPC's orders without a request to any service."""
    stack = build_stack()
    order_id = book(stack, camping_cart())["order_id"]
    stack.run_until_idle()
    log: list[Effect] = []
    record_requests(stack, log)
    trips = stack.website.my_trips(FAN.fan_id)
    return [trip["order_id"] for trip in trips] == [order_id] and not log


def confirmed_glamping_trip(stack) -> str:
    order_id = book(stack, glamping_cart())["order_id"]
    stack.run_until_idle()
    return order_id


def refund_before_cancel() -> bool:
    stack = build_stack()
    order_id = confirmed_glamping_trip(stack)
    log: list[Effect] = []
    record_requests(stack, log)
    stack.website.cancel(order_id)
    stack.run_until_idle()
    calls = [call.name for call in requests_by(log, "opc")]
    cancels = [i for i, name in enumerate(calls) if name.endswith(".cancel")]
    return bool(cancels) and calls.index("bank.refund") < min(cancels)


def glampingco_48h_stays_booked() -> bool:
    """A cancellation two days before GlampingCo check-in leaves the tent booked."""
    stack = build_stack()
    order_id = confirmed_glamping_trip(stack)
    order = stack.opc.orders.get(order_id)
    stay = next(item for item in order.items if isinstance(item, LodgingStay))
    two_days_before = stay.check_in - timedelta(hours=48)
    stack.clock.advance((two_days_before - stack.clock.now()).total_seconds())
    stack.website.cancel(order_id)
    stack.run_until_idle()
    return stack.stubs.lodging.bookings[f"{order_id}-glampingco"] == "confirmed"


def service_fee() -> float:
    """The fee as a share of what suppliers charge, from a priced cart."""
    stack = build_stack()
    with open(HEADLINER / "deploy/website.toml", "rb") as file:
        catalog = CatalogClient(connect(tomllib.load(file)["CATALOG_DSN"]))
    box_office = BoxOfficeClient(ServiceClient("box_office", stack.network, "website"))
    quote = TripPricer(catalog, box_office).price(group_cart())
    return round(quote.service_fee / quote.subtotal, 2)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--write", action="store_true", help=f"update {FACTS_JSON}")
    arguments = parser.parse_args()
    logging.basicConfig(level=logging.CRITICAL)  # partner refusals are logged
    text = json.dumps(extract(), indent=2) + "\n"
    if arguments.write:
        FACTS_JSON.write_text(text)
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
