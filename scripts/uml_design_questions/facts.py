"""Answer keys for the UML design questions tutorial, derived by running Headliner.

Every fact comes from exercising Headliner's devstack: the broker's bindings
and consumers, requests on the simulated network, how gateways behave, and
which orders the data model accepts. Nothing here searches source text.

    python3 scripts/uml_design_questions/facts.py           # print the facts
    python3 scripts/uml_design_questions/facts.py --write   # update facts.json
"""

import argparse
import inspect
import json
import logging
import subprocess
import sys
import textwrap
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
        "presale_path": presale_path(),
        "checkout_latency": checkout_latency(),
        "capstone": capstone(),
        "shared_code": shared_code(),
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


def presale_cart() -> Cart:
    """Passes, a stay, and a shuttle ride, with no experience."""
    pair = GROUP[:2]
    return Cart(
        "lakeside-fest",
        [Guest(name) for name in pair],
        [
            CartLine("stay", "lf-lakeshore-campsite", pair),
            CartLine("ride", "lf-station-shuttle", pair),
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
        "rename_breaks": consumers_that_raise(renamed),
        "additive_breaks": consumers_that_raise(lambda body: body | renamed(body)),
        "trip.confirmed.v2": receivers("trip.confirmed.v2"),
    }


def renamed(body: dict) -> dict:
    """A trip event's body with fan_name replaced by given_name and family_name."""
    rest = {name: value for name, value in body.items() if name != "fan_name"}
    given, _, family = body["fan_name"].partition(" ")
    return rest | {"given_name": given, "family_name": family}


def consumers_that_raise(change) -> list[str]:
    """Consumers whose handler raises on a trip event whose body went through change.

    Every trip event has the body that trip.confirmed has, so one observed
    body serves all three. Each consumer gets the event on a fresh stack.
    """
    body = change(observed_event("trip.confirmed"))
    raising = set()
    for routing_key in ("trip.confirmed", "trip.cancelled", "trip.failed"):
        for queue in sorted(receiving_queues(build_stack(), routing_key)):
            stack = build_stack()
            try:
                stack.deliver(queue, Message(routing_key, dict(body)))
            except Exception:  # any error: the consumer cannot handle the event
                raising.add(stack.component_of(queue))
    return sorted(raising)


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
        "refunds": len(stack.stubs.bank.refunds),
        "fan_can_cancel": fan_can_cancel(stack),
        "confirmed_after_failure": confirmed_after_failure("box-office"),
        "card_check_amount": next(
            effect.payload["amount"] for effect in log if effect.name == "bank.validate"
        ),
    }


def fan_can_cancel(stack) -> bool:
    """Whether the website's cancel action takes the fan's one (failed) trip."""
    [trip] = stack.website.my_trips(FAN.fan_id)
    stack.website.cancel(trip["order_id"])
    return stack.website.track(trip["order_id"])["status"] != trip["status"]


def confirmed_after_failure(rejecting_supplier: str) -> list[str]:
    """Supplier confirmations published after trip.failed, when one supplier rejects."""
    stack = build_stack(supplier_decisions={rejecting_supplier: "reject"})
    with recorded_trip_effects() as log:
        book(stack, glamping_cart())
        stack.run_until_idle()
    published = [effect.name for effect in log if effect.kind == "publish"]
    after = published[published.index("trip.failed") + 1:]
    return sorted(key for key in after if key.endswith(".confirmed"))


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


def presale_path() -> dict:
    """Outages outside the operations team's list, for a cart without experiences."""
    stack = build_stack(down=("lodging",))
    order_id = book(stack, presale_cart())["order_id"]
    stack.run_until_idle()
    waiting = stack.website.track(order_id)["suppliers"]["lodging"] == "placed"
    return {
        "box_office": outage_outcome("box_office", presale_cart()),
        "shuttle": outage_outcome("shuttle", presale_cart()),
        "experiences": outage_outcome("experiences", presale_cart()),
        "lodging_charged_while_waiting": waiting
        and stack.stubs.bank.captured_for(order_id) > 0,
    }


def outage_outcome(service: str, cart: Cart | None = None) -> str:
    """What happens to a trip (a camping trip by default) booked while service is down."""
    stack = build_stack(down=(service,))
    response = book(stack, cart or camping_cart())
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
    bulk = elapsed - sum(quotes) + bulk_quote_seconds(stack)
    keyed_fix = bulk - sum(checks) + max(checks)
    [card_check] = [call.seconds for call in calls if call.name == "bank.validate"]
    external = external_services()
    return {
        "external_calls": sum(call.service in external for call in calls),
        "elapsed_seconds": round(elapsed, 2),
        "keyed_fix_seconds": round(keyed_fix, 2),
        "call_ms": [[call.name, round(call.seconds * 1000)] for call in calls],
        "quote_seconds": round(sum(quotes), 2),
        "check_seconds": round(sum(checks), 2),
        # The checkout's time under each change that a question offers.
        "variants": {
            "bulk_cached_card": round(bulk - card_check, 2),
            "bulk_parallel": round(keyed_fix, 2),
            "parallel_only": round(elapsed - sum(checks) + max(checks), 2),
            "bulk_no_checks": round(bulk - sum(checks), 2),
        },
        "rejected_experience_is_charged_and_failed": rejected_experience_outcome(),
    }


def rejected_experience_outcome() -> bool:
    """A group trip whose experience provider rejects ends charged and failed."""
    stack = build_stack(supplier_decisions={"experiences": "reject"})
    order_id = book(stack, group_cart())["order_id"]
    stack.run_until_idle()
    return (
        stack.website.track(order_id)["status"] == "failed"
        and stack.stubs.bank.captured_for(order_id) > 0
        and not stack.stubs.bank.refunds
    )


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
        "unlisted_item_type_is_refused": unlisted_item_type_is_refused(),
        "refund_before_cancel": refund_before_cancel(),
        "glampingco_48h_stays_booked": glampingco_48h_stays_booked(),
        "service_fee": service_fee(),
        "my_trips_reads_stored_payment": my_trips_reads_stored_payment(),
        "stuck_cancellation": stuck_cancellation(),
    }


def unlisted_item_type_is_refused() -> bool:
    """An order that names a kind of ride the OPC does not list cannot be read,
    although the same order with a listed type can."""
    def ride_order(item_type: str):
        ride = _item(item_type, "shuttle", ["Friend 1"], departure="2027-08-20T08:00Z",
                     route="Union Station", fare=2500)
        return order_from_payload("HL-9002", {
            "buyer": {"fan_id": "fan-90", "name": "Friend 1", "email": FAN.email},
            "attendees": friends(1),
            "festival_id": "lakeside-fest",
            "festival_start": "2027-08-20T12:00Z",
            "items": [ride],
            "payment": {"card_token": "tok_visa", "amount": 2500},
        })

    ride_order(ShuttleRide.__name__)
    try:
        ride_order("RidesharePickup")
    except KeyError:
        return True
    return False


def my_trips_reads_stored_payment() -> bool:
    """Storing a list of payments breaks My trips, but not OrderTrackingService."""
    stack = build_stack()
    order_id = book(stack, camping_cart())["order_id"]
    stack.run_until_idle()
    with open(HEADLINER / "deploy/services.toml", "rb") as file:
        order_db = connect(tomllib.load(file)["internal"]["order-db"])
    stored = order_db.get("orders", order_id)["order"]
    order_db.update("orders", order_id, order=stored | {"payment": [stored["payment"]]})
    tracked = stack.consumers.support_console.orders_of(FAN.fan_id)
    try:
        stack.website.my_trips(FAN.fan_id)
    except (TypeError, KeyError):
        return [order["order_id"] for order in tracked] == [order_id]
    return False


def stuck_cancellation() -> dict:
    """Where a GlampingCo trip ends up when it is cancelled 2 days before check-in."""
    stack = build_stack()
    order_id = confirmed_glamping_trip(stack)
    advance_to_two_days_before_check_in(stack, order_id)
    with recorded_trip_effects() as log:
        stack.website.cancel(order_id)
        stack.run_until_idle()
    return {
        "refunds": len(stack.stubs.bank.refunds),
        "tent": stack.stubs.lodging.bookings[f"{order_id}-glampingco"],
        "trip_cancelled_published": any(
            (effect.kind, effect.name) == ("publish", "trip.cancelled") for effect in log
        ),
        "support_follow_ups": len(stack.consumers.support_console.follow_ups),
    }


def advance_to_two_days_before_check_in(stack, order_id: str) -> None:
    order = stack.opc.orders.get(order_id)
    stay = next(item for item in order.items if isinstance(item, LodgingStay))
    two_days_before = stay.check_in - timedelta(hours=48)
    stack.clock.advance((two_days_before - stack.clock.now()).total_seconds())


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
    advance_to_two_days_before_check_in(stack, order_id)
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


# --- Shared code (step 1) ----------------------------------------------------------------


def shared_code() -> dict:
    """What a change to a shared module reaches, by service."""
    view = diagram_facts.shared_code_view()
    folders = sorted(unit.split("::")[1] for unit in view["packages"] if unit.startswith("services::"))
    service = {f"services::{folder}": diagram_facts.COMPONENTS[folder] for folder in folders}
    loads = {service[f"services::{folder}"]: loaded_shared_modules(folder) for folder in folders}
    taken: dict[str, set[str]] = {name: set() for name in service.values()}
    for (importer, imported), names in ((key.split(" -> "), names) for key, names in view["names"].items()):
        if importer in service and imported.startswith("infra::"):
            taken[service[importer]].update(names)
    return {
        "loads": loads,
        "imports": {
            module: sorted(service[a] for a, b in view["imports"] if a in service and b == f"infra::{module}")
            for module in ("broker", "http")
        },
        "service_to_service_imports": sorted(
            [service[a], service[b]] for a, b in view["imports"] if a in service and b in service),
        "takes_only_message": sorted(name for name, names in taken.items() if names == {Message.__name__}),
        "message_stands_alone": message_stands_alone(),
    }


def loaded_shared_modules(folder: str) -> list[str]:
    """The modules of infra/ in memory once every module of a service is imported,
    in a fresh interpreter, so that nothing else has loaded them."""
    modules = sorted(
        ".".join(path.relative_to(HEADLINER).with_suffix("").parts)
        for path in (HEADLINER / "services" / folder).rglob("*.py"))
    script = textwrap.dedent("""\
        import importlib, sys
        for name in sys.argv[1:]:
            importlib.import_module(name)
        print(*sorted(name.split(".", 1)[1] for name in sys.modules if name.startswith("infra.")))
    """)
    result = subprocess.run([sys.executable, "-B", "-c", script, *modules], cwd=HEADLINER,
                            capture_output=True, text=True, check=True)
    return result.stdout.split()


def message_stands_alone() -> bool:
    """Message's definition runs in a module that imports nothing from Headliner."""
    namespace: dict = {}
    exec("from dataclasses import dataclass\n" + textwrap.dedent(inspect.getsource(Message)), namespace)
    message = namespace["Message"]("trip.confirmed", {"total": 100})
    return (message.routing_key, message.body) == ("trip.confirmed", {"total": 100})


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
