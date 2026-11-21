"""What each diagram of the UML design questions tutorial must show, from Headliner.

The tutorial's diagrams are drawn by hand from Headliner's code. These facts let
scripts/tests/uml-design-questions-diagrams.test.js check them:

- component views: the components, interfaces, queues, and bindings, observed
  while a trip is booked, processed, and cancelled on Headliner's devstack;
- sequence views: the order in which the calls they draw happen;
- class views: classes, hierarchies, operations, and multiplicities, read from
  the classes and found by constructing objects that the validators accept;
- the import view: which classes use which names from other Python packages;
- evidence: the line that each note's path:line citation names.

facts.py adds these to facts.json under "diagrams" and "evidence".
"""

import ast
import inspect
import logging
import sys
import tomllib
from collections import defaultdict
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field, fields, is_dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import UnionType
from typing import get_args, get_origin, get_type_hints

ROOT = Path(__file__).resolve().parents[2]
HEADLINER = ROOT / "tutorial_sources/uml-design-questions/headliner"

sys.dont_write_bytecode = True  # keep the student-facing tree free of caches
if str(HEADLINER) not in sys.path:
    sys.path.insert(0, str(HEADLINER))

from devstack import build_stack  # noqa: E402
from fixtures.catalog import EXPERIENCES, LODGING, SHUTTLES  # noqa: E402
from infra.broker import CLIENT as BROKER_CLIENT  # noqa: E402
from infra.broker import topic_matches  # noqa: E402
from infra.db import Database, connect  # noqa: E402
from infra.http import ServiceClient  # noqa: E402
from services.opc.gateways.base import SupplierGateway  # noqa: E402
from services.opc.gateways.registry import SUPPLIERS, gateway_for  # noqa: E402
from services.opc.model import items as item_module  # noqa: E402
from services.opc.model import orders as order_module  # noqa: E402
from services.opc.model import suppliers as supplier_module  # noqa: E402
from services.opc.model.items import FestivalPass, LodgingStay, TransportItem, TripItem  # noqa: E402
from services.opc.model.orders import Attendee, Fan, Payment, TripOrder  # noqa: E402
from services.opc.model.suppliers import SupplierOrder  # noqa: E402
from services.opc.supplier_task import split_by_supplier  # noqa: E402
from services.website.cart import Cart, CartLine, Guest  # noqa: E402
from services.website.checkout import FanAccount  # noqa: E402
from services.website.clients import BoxOfficeClient, CatalogClient  # noqa: E402

FESTIVAL = "lakeside-fest"
FAN = FanAccount("fan-7", "Rosa Diaz", "rosa@example.com")
EXCHANGE = "trips"

# How the diagrams name Headliner's services (deploy/services.toml).
COMPONENTS = {
    "website": "TripWebsite",
    "opc": "OPC",
    "broker": "MessageBroker",
    "order-db": "OrderDB",
    "order-db-replica": "OrderDB",  # a read-only replica of the same database
    "catalog-db": "CatalogDB",
    "notifications": "Notifications",
    "loyalty": "Loyalty",
    "reporting": "WarehouseETL",
    "affiliates": "AffiliateRelay",
    "support_console": "SupportConsole",
    "shuttle_planner": "ShuttlePlanner",
    "bank": "Bank",
    "box_office": "BoxOffice",
    "lodging": "LodgingProvider",
    "shuttle": "ShuttleProvider",
    "experiences": "ExperienceProvider",
    "mail_relay": "MailRelay",
    "affiliate_partners": "AffiliatePartners",
}
SUPPLIER_SERVICES = {"box_office", "lodging", "shuttle", "experiences"}
BOOKING = {"place": "Booking", "cancel": "Booking"}
# The interface each service provides, by endpoint. The OPC's endpoints are
# named after their interface ("PurchaseOrderService.submit").
INTERFACES = {
    "bank": {"validate": "CardService", "capture": "CardService", "refund": "CardService"},
    "box_office": {"quote": "Quotes", "quotes": "Quotes", **BOOKING},
    "lodging": BOOKING,
    "shuttle": BOOKING,
    "experiences": {"capacity": "Capacity", **BOOKING},
    "broker": {"publish": "Publish", "send": "Publish"},
    "mail_relay": {"send": "SMTP"},
    "affiliate_partners": {"webhook": "Webhook"},
}

# The trip order's runtime path (outages view): the request path, the OPC's
# processing, and the e-mail that tells the fan. The other event consumers
# react to the same events; the reply card lists them as left out.
ORDER_PATH = (
    "TripWebsite", "OPC", "OrderDB", "CatalogDB", "MessageBroker", "Notifications",
    "Bank", "BoxOffice", "LodgingProvider", "ShuttleProvider", "ExperienceProvider",
    "MailRelay",
)
FAILED_TRIP_EVENTS = (
    "opc.PurchaseOrderService.submit", "website.responds", "bank.capture",
    "supplier.place", "opc.SupplierCallbackService.answer",
)
CANCELLATION_EVENTS = (
    "opc.PurchaseOrderService.cancel", "bank.refund", "website.responds",
    "supplier.cancel",
)
# The data model view has room for eleven classes; the reply card lists the rest.
DATA_MODEL_LEFT_OUT = ("Invoice",)
# A trip order owns these: payloads.py builds them from the order's own JSON,
# and the repository saves them in the order's row or under its id. The buyer
# is a fan account that the fan's other orders share.
OWNED_BY_TRIP_ORDER = ("attendees", "items", "payment", "supplier_orders")
PROBE_SIZES = (*range(13), 50)  # list lengths tried against the validators

# Each note cites code as path:line. The symbol is text on that line, unique in
# its file, so the line number follows the code when it moves.
EVIDENCE = (
    # event-consumers.component.uml
    ("deploy/broker.toml", 'name = "trips"'),
    ("deploy/broker.toml", 'pattern = "trip.confirmed"'),
    ("deploy/broker.toml", 'pattern = "#"'),
    ("deploy/broker.toml", 'pattern = "trip.*"'),
    ("deploy/broker.toml", 'pattern = "trip.cancelled"'),
    ("deploy/broker.toml", 'pattern = "supplier.shuttle.*"'),
    ("deploy/services.toml", 'broker = "amqp://'),
    ("services/notifications/consumers.py", '@consumes("trips"'),
    ("infra/broker.py", "``*`` matches exactly one word"),
    ("services/opc/events.py", "Publishes trip.<status> and supplier.<kind>.<status>"),
    # failed-trips.sequence.uml
    ("deploy/broker.toml", 'name = "orders.received"'),
    ("deploy/broker.toml", 'name = "supplier.answered"'),
    ("services/opc/workflow.py", "self._payments.capture(order)"),
    ("services/opc/workflow.py", "self._invoices.on_answer(message.body)"),
    ("services/opc/supplier_task.py", "RETRY_INTERVAL_S = 60"),
    ("services/opc/invoice_task.py", 'if order.status != "processing":'),
    # data-model.class.uml
    ("services/opc/model/orders.py", "payment: Payment"),
    ("services/opc/model/orders.py", "1 <= len(self.attendees) <= MAX_ATTENDEES"),
    ("services/opc/model/orders.py", "if not self.items:"),
    ("services/opc/model/items.py", "if not self.attendees:"),
    ("services/opc/model/suppliers.py", "trip_order_id: str"),
    ("services/opc/model/rules.py", "Every item is for attendees of the order"),
    ("services/opc/model/rules.py", "def check_experience_attendees"),
    # outages-imports.class.uml
    ("services/website/clients.py", "bank: ServiceClient"),
    ("services/website/clients.py", "opc: ServiceClient"),
    ("services/opc/gateways/base.py", "client: ServiceClient, clock: Clock"),
    ("services/opc/intake.py", "orders: OrderRepository, broker: Broker"),
    ("services/opc/events.py", "def __init__(self, broker: Broker)"),
    ("services/notifications/mailer.py", "relay: ServiceClient"),
    ("services/notifications/consumers.py", "def on_trip_event(self, message: Message)"),
    # outages.component.uml
    ("services/opc/intake.py", "self._broker.send(RECEIVED_QUEUE"),
    ("infra/broker.py", "A consumer that raises ServiceUnavailable leaves its message"),
    ("deploy/services.toml", 'order-db = "postgres://'),
    ("deploy/services.toml", 'bank = "https://'),
    ("deploy/services.toml", 'mail_relay = "smtp://'),
    # checkout-latency.sequence.uml
    ("stubs/bank.py", 'LATENCY_MS = {"validate": 300'),
    ("services/website/payments.py", "def requires_valid_card"),
    ("services/website/checkout.py", "@requires_valid_card"),
    ("stubs/box_office.py", "QUOTE_LATENCY_MS = 1100"),
    ("stubs/box_office.py", "BULK_QUOTE_LATENCY_MS = 400"),
    ("services/website/clients.py", "def quote_passes("),
    ("stubs/experiences.py", "lookup_ms=600"),
    ("stubs/experiences.py", "lookup_ms=750"),
    ("stubs/experiences.py", "lookup_ms=900"),
    ("services/opc/service.py", 'LATENCY_MS = {"PurchaseOrderService.submit": 200}'),
    ("devstack.py", "CATALOG_LATENCY_MS = 20"),
    # capstone-website-connections.component.uml
    ("services/website/clients.py", "class CatalogClient:"),
    ("services/website/clients.py", "class BankClient:"),
    ("services/website/clients.py", "class BoxOfficeClient:"),
    ("services/website/clients.py", "class ExperienceClient:"),
    ("services/website/clients.py", "class OpcClient:"),
    # capstone-trip-items.class.uml
    ("services/opc/model/items.py", "class TripItem(ABC):"),
    ("services/opc/model/items.py", "class TransportItem(TripItem):"),
    # capstone-cancellation.sequence.uml
    ("services/opc/cancellation_task.py", "self._payments.refund(order)"),
    ("services/opc/cancellation_task.py", "supplier_order.mark_cancelling()"),
    ("services/opc/cancellation_task.py", "CANCEL_INTERVAL_S = 60"),
    ("services/opc/service.py", "cancellations.cancel_supplier_orders"),
    ("services/opc/cancellation_task.py", "except SupplierUnavailable:"),
    ("services/opc/cancellation_task.py", "except Exception:"),
    ("services/opc/cancellation_task.py", "supplier_order.mark_cancelled()"),
    ("services/opc/partners/glamping_co.py", "MANUAL_CANCELLATION_WINDOW = timedelta(hours=72)"),
    ("services/opc/partners/glamping_co.py", "<= MANUAL_CANCELLATION_WINDOW:"),
    # capstone-gateways.class.uml
    ("services/opc/gateways/base.py", "Raises no other exception."),
    ("services/opc/gateways/base.py", "class SupplierUnavailable(Exception):"),
    ("services/opc/partners/errors.py", "class ManualCancellationRequired(Exception):"),
)


def extract() -> dict:
    return {"diagrams": views(), "evidence": evidence()}


def views() -> dict:
    trip = booked_trip()
    return {
        "event_consumers": event_consumers_view(trip),
        "outages": order_path_view(trip),
        "website_connections": website_connections_view(trip),
        "failed_trips": {"timeline": failed_trip_timeline()},
        "cancellation": {"timeline": trip.cancellation_timeline},
        "checkout": checkout_durations(),
        "data_model": data_model_view(),
        "trip_items": trip_items_view(),
        "gateways": gateways_view(),
        "imports": imports_view(),
    }


# --- Watching a trip on the devstack ---------------------------------------------------


def every_offer_cart() -> Cart:
    """Two fans at Lakeside Fest with every stay, ride, and experience on offer, so the
    trip reaches every supplier, every gateway class, and every kind of trip item."""
    guests = [Guest("Rosa Diaz"), Guest("Sam Diaz", "teen")]
    names = tuple(guest.name for guest in guests)
    lines = [
        CartLine(kind, offer["id"], names)
        for kind, offers in (("stay", LODGING), ("ride", SHUTTLES), ("experience", EXPERIENCES))
        for offer in offers
        if offer["festival_id"] == FESTIVAL
    ]
    return Cart(FESTIVAL, guests, lines)


@dataclass(frozen=True)
class Call:
    """One call from one component to an interface of another."""

    caller: str
    provider: str
    interface: str
    during_request: bool  # made while the website handled a fan's request


@dataclass
class Observation:
    """Calls, messages, and the order of events, as a stack runs."""

    calls: list[Call] = field(default_factory=list)
    published: list[tuple[str, str, str]] = field(default_factory=list)  # who, exchange, key
    sent: list[str] = field(default_factory=list)  # work queues
    timeline: list[str] = field(default_factory=list)
    in_request: bool = False

    def request(self, action: Callable[[], dict]) -> dict:
        """Run a website action as a fan's request."""
        self.in_request = True
        try:
            return action()
        finally:
            self.in_request = False
            self.timeline.append("website.responds")


@contextmanager
def observing(stack) -> Iterator[Observation]:
    """Record every network call and database query on stack."""
    seen = Observation()
    send = stack.network.request
    dsn_names = service_names_by_address()

    def request(caller, service, endpoint, payload):
        who = calling_component() if caller == BROKER_CLIENT else COMPONENTS[caller]
        if (service, endpoint) == ("broker", "publish"):
            seen.published.append((who, payload["exchange"], payload["routing_key"]))
        if (service, endpoint) == ("broker", "send"):
            seen.sent.append(payload["queue"])
        seen.calls.append(Call(who, COMPONENTS[service], interface(service, endpoint),
                               seen.in_request))
        supplier = service in SUPPLIER_SERVICES and endpoint in BOOKING
        seen.timeline.append(f"supplier.{endpoint}" if supplier else f"{service}.{endpoint}")
        return send(caller, service, endpoint, payload)

    def query(method):
        def recorded(database, *args, **kwargs):
            provider = COMPONENTS[dsn_names[database.name]]
            seen.calls.append(Call(calling_component(), provider, "SQL", seen.in_request))
            return method(database, *args, **kwargs)

        return recorded

    queries = {name: getattr(Database, name) for name in ("insert", "get", "update", "find")}
    stack.network.request = request
    for name, method in queries.items():
        setattr(Database, name, query(method))
    try:
        yield seen
    finally:
        stack.network.request = send
        for name, method in queries.items():
            setattr(Database, name, method)


def calling_component() -> str:
    """The component whose code is running: the nearest services.<name> frame."""
    frame = sys._getframe(1)
    while frame is not None:
        module = frame.f_globals.get("__name__", "")
        if module.startswith("services."):
            return COMPONENTS[module.split(".")[1]]
        frame = frame.f_back
    raise LookupError("no Headliner service is on the call stack")


def interface(service: str, endpoint: str) -> str:
    if service == "opc":
        return endpoint.split(".")[0]
    return INTERFACES[service][endpoint]


def service_names_by_address() -> dict[str, str]:
    with open(HEADLINER / "deploy/services.toml", "rb") as file:
        config = tomllib.load(file)
    return {address: name for table in config.values() for name, address in table.items()}


@dataclass
class BookedTrip:
    """A trip booked and cancelled on one stack, with what each phase did."""

    stack: object
    booking: Observation  # Book now, and the processing that follows
    everything: Observation  # also the festival page, tracking, My trips, and cancel
    cancellation_timeline: list[str]


def booked_trip() -> BookedTrip:
    """Book a trip and let it finish, use the website's other pages, then cancel it."""
    stack = build_stack()
    with observing(stack) as booking:
        order_id = booking.request(lambda: book(stack))
        stack.run_until_idle()
    with observing(stack) as browsing:
        browsing.request(lambda: stack.website.festival_page(FESTIVAL))
        browsing.request(lambda: stack.website.track(order_id))
        browsing.request(lambda: stack.website.my_trips(FAN.fan_id))
    with observing(stack) as cancelling, quiet_logs():
        cancelling.request(lambda: stack.website.cancel(order_id))
        stack.run_until_idle()
    phases = (booking, browsing, cancelling)
    everything = Observation(
        calls=[call for phase in phases for call in phase.calls],
        published=[message for phase in phases for message in phase.published],
    )
    timeline = first_occurrences(cancelling.timeline, CANCELLATION_EVENTS)
    return BookedTrip(stack, booking, everything, timeline)


def book(stack) -> str:
    response = stack.website.book(FAN, every_offer_cart(), "tok_visa")
    if response.get("message") != "Order received":
        raise RuntimeError(f"the trip was not booked: {response}")
    return response["order_id"]


@contextmanager
def quiet_logs() -> Iterator[None]:
    """Hide the partner refusals that the cancellation job logs."""
    logging.disable(logging.CRITICAL)
    try:
        yield
    finally:
        logging.disable(logging.NOTSET)


def first_occurrences(timeline: list[str], events: tuple[str, ...]) -> list[str]:
    """events in the order each first happens."""
    return [event for event in dict.fromkeys(timeline) if event in events]


def receivers(stack, exchange: str, routing_key: str) -> set[str]:
    return {
        binding.queue
        for binding in stack.broker.bindings()
        if binding.exchange == exchange and topic_matches(binding.pattern, routing_key)
    }


def unique_calls(observed: list[Call]) -> list[dict]:
    """One entry per connector, with whether the fan waits for any call over it."""
    waits: dict[tuple[str, str, str], bool] = {}
    for call in observed:
        key = (call.caller, call.provider, call.interface)
        waits[key] = waits.get(key, False) or call.during_request
    return [
        {"caller": caller, "provider": provider, "interface": name, "fan_waits": wait}
        for (caller, provider, name), wait in sorted(waits.items())
    ]


# --- Component views ---------------------------------------------------------------


def event_consumers_view(trip: BookedTrip) -> dict:
    """Who publishes to the trips exchange, who consumes from it, and how."""
    stack = trip.stack
    bindings = [b for b in stack.broker.bindings() if b.exchange == EXCHANGE]
    queues = {stack.component_of(b.queue): b.queue for b in bindings}
    patterns: dict[str, list[str]] = defaultdict(list)
    for binding in bindings:
        patterns[stack.component_of(binding.queue)].append(binding.pattern)
    publishers = sorted({who for who, exchange, _ in trip.everything.published
                         if exchange == EXCHANGE})
    consumer_calls = [call for call in trip.everything.calls
                      if call.caller in queues and not call.during_request]
    calls = [{"caller": who, "provider": EXCHANGE, "interface": "Publish"}
             for who in publishers]
    calls += [{key: entry[key] for key in ("caller", "provider", "interface")}
              for entry in unique_calls(consumer_calls)]
    components = {*publishers, EXCHANGE, *queues, *(c["provider"] for c in calls)}
    return {
        "components": sorted(components),
        "publishers": publishers,
        "queues": dict(sorted(queues.items())),
        "bindings": dict(sorted(patterns.items())),
        "calls": sorted(calls, key=lambda c: (c["caller"], c["provider"])),
    }


def order_path_view(trip: BookedTrip) -> dict:
    """The runtime path of the booked trip, from Book now to the fan's e-mail."""
    stack, seen = trip.stack, trip.booking
    queue_of: dict[str, set[str]] = defaultdict(set)
    for queue in seen.sent:
        queue_of[stack.component_of(queue)].add(queue)
    for _, exchange, routing_key in seen.published:
        for queue in receivers(stack, exchange, routing_key):
            queue_of[stack.component_of(queue)].add(queue)
    involved = {c.caller for c in seen.calls} | {c.provider for c in seen.calls} | set(queue_of)
    on_path = set(ORDER_PATH)
    return {
        "components": sorted(on_path & involved),
        "left_out": sorted(involved - on_path),
        "calls": [c for c in unique_calls(seen.calls)
                  if c["caller"] in on_path and c["provider"] in on_path],
        "queued": [
            {"provider": "MessageBroker", "consumer": consumer, "queues": sorted(queues)}
            for consumer, queues in sorted(queue_of.items()) if consumer in on_path
        ],
    }


def website_connections_view(trip: BookedTrip) -> dict:
    """Everything the Trip Website calls, over all of its pages and actions."""
    website_calls = [c for c in trip.everything.calls if c.caller == "TripWebsite"]
    calls = [{key: entry[key] for key in ("caller", "provider", "interface")}
             for entry in unique_calls(website_calls)]
    return {
        "components": sorted({"TripWebsite", *(c["provider"] for c in calls)}),
        "calls": calls,
    }


# --- Sequence views ----------------------------------------------------------------


def failed_trip_timeline() -> list[str]:
    """When a supplier rejects: the order of the calls the failed-trips view draws."""
    stack = build_stack(supplier_decisions={"shuttle": "reject"})
    with observing(stack) as seen:
        seen.request(lambda: book(stack))
        stack.run_until_idle()
    return first_occurrences(seen.timeline, FAILED_TRIP_EVENTS)


def checkout_durations() -> dict:
    """How long the checkout calls take that the checkout view mentions but does not draw."""
    stack = build_stack()
    box_office = BoxOfficeClient(ServiceClient("box_office", stack.network, "website"))
    with open(HEADLINER / "deploy/website.toml", "rb") as file:
        catalog = CatalogClient(connect(tomllib.load(file)["CATALOG_DSN"]))
    return {
        "bulk_quote_ms": elapsed_ms(stack, lambda: box_office.quote_passes(
            FESTIVAL, ["adult", "teen"])),
        "catalog_query_ms": elapsed_ms(stack, lambda: catalog.festival(FESTIVAL)),
    }


def elapsed_ms(stack, action: Callable[[], object]) -> int:
    started = stack.clock.now()
    action()
    return round((stack.clock.now() - started).total_seconds() * 1000)


# --- Class views -------------------------------------------------------------------


def model_classes() -> list[type]:
    return [
        cls
        for module in (order_module, item_module, supplier_module)
        for cls in vars(module).values()
        if inspect.isclass(cls) and cls.__module__ == module.__name__
    ]


def hierarchy(classes: list[type]) -> dict:
    names = {cls.__name__ for cls in classes}
    return {
        "abstract": sorted(cls.__name__ for cls in classes if inspect.isabstract(cls)),
        "generalizations": sorted(
            [cls.__name__, base.__name__]
            for cls in classes
            for base in cls.__bases__
            if base.__name__ in names
        ),
    }


def operations(cls: type, names: frozenset[str]) -> dict[str, str]:
    """Which of names cls defines itself, and whether as an abstract operation."""
    return {
        name: "abstract" if getattr(vars(cls)[name], "__isabstractmethod__", False)
        else "defined"
        for name in sorted(names)
        if name in vars(cls)
    }


def data_model_view() -> dict:
    classes = [c for c in model_classes() if c.__name__ not in DATA_MODEL_LEFT_OUT]
    return {
        "classes": sorted(cls.__name__ for cls in classes),
        "left_out": list(DATA_MODEL_LEFT_OUT),
        **hierarchy(classes),
        "associations": associations(classes),
    }


def associations(classes: list[type]) -> list[dict]:
    """Every field that refers to a model class, with both ends' multiplicities."""
    namespace = {cls.__name__: cls for cls in model_classes()}
    shown = {cls.__name__ for cls in classes}
    result = []
    for owner in classes:
        hints = get_type_hints(owner, localns=namespace)
        own = inspect.get_annotations(owner)  # not the fields a base class declares
        for item in (item for item in fields(owner) if item.name in own):
            target, many, optional = referenced_class(hints[item.name])
            if target is None or target.__name__ not in shown:
                continue
            owned = owner is TripOrder and item.name in OWNED_BY_TRIP_ORDER
            result.append({
                "from": owner.__name__,
                "role": item.name,
                "to": target.__name__,
                "multiplicity": list_multiplicity(owner, item.name) if many
                else ("0..1" if optional else "1"),
                "opposite": "1" if owned else OPPOSITE_ENDS[(owner, item.name)](),
                "composition": owned,
            })
    return result


def referenced_class(hint) -> tuple[type | None, bool, bool]:
    """The model class a type hint refers to, whether it is a list, and whether optional."""
    many, optional = get_origin(hint) is list, isinstance(hint, UnionType)
    arguments = [a for a in get_args(hint) if a is not type(None)] if many or optional else [hint]
    target = arguments[0] if len(arguments) == 1 and is_dataclass(arguments[0]) else None
    return target, many, optional


def list_multiplicity(owner: type, name: str) -> str:
    """Bounds of a list field, from the lengths that a valid object accepts."""
    accepted = [size for size in PROBE_SIZES if LIST_PROBES[(owner, name)](size)]
    if not accepted:
        raise ValueError(f"{owner.__name__}.{name} accepts none of {PROBE_SIZES}")
    upper = "*" if accepted[-1] == PROBE_SIZES[-1] else str(accepted[-1])
    return f"{accepted[0]}..{upper}" if accepted[0] != accepted[-1] else str(accepted[0])


def builds(make: Callable[[], object]) -> bool:
    try:
        make()
    except ValueError:
        return False
    return True


def people(count: int) -> list[Attendee]:
    return [Attendee(f"Friend {number}") for number in range(1, count + 1)]


def weekend_pass(attendees: list[Attendee]) -> FestivalPass:
    return FestivalPass("box-office", attendees, FESTIVAL, 32900)


def trip_order(attendees: list[Attendee], items: list[TripItem], **changes) -> TripOrder:
    details = {
        "order_id": "HL-9001",
        "buyer": Fan(FAN.fan_id, FAN.name, FAN.email),
        "attendees": attendees,
        "items": items,
        "payment": Payment("tok_visa", 90000),
        "festival_id": FESTIVAL,
        "festival_start": datetime(2027, 8, 20, 12, 0, tzinfo=timezone.utc),
    }
    return TripOrder(**{**details, **changes})


def order_with_attendees(size: int) -> object:
    group = people(size)
    return trip_order(group, [weekend_pass(group)] if group else [])


def order_with_items(size: int) -> object:
    group = people(2)
    return trip_order(group, [weekend_pass(group) for _ in range(size)])


def order_with_supplier_orders(size: int) -> object:
    group = people(1)
    orders = [SupplierOrder("box-office", "HL-9001", []) for _ in range(size)]
    return trip_order(group, [weekend_pass(group)], supplier_orders=orders)


LIST_PROBES = {
    (TripOrder, "attendees"): lambda size: builds(lambda: order_with_attendees(size)),
    (TripOrder, "items"): lambda size: builds(lambda: order_with_items(size)),
    (TripOrder, "supplier_orders"): lambda size: builds(
        lambda: order_with_supplier_orders(size)),
    (TripItem, "attendees"): lambda size: builds(lambda: weekend_pass(people(size))),
    (SupplierOrder, "items"): lambda size: builds(
        lambda: SupplierOrder("box-office", "HL-9001", [weekend_pass(people(1))] * size)),
}


def fans_orders() -> str:
    """How many trip orders one fan may buy: two orders may share a buyer."""
    group = people(1)
    both = builds(lambda: [trip_order(group, [weekend_pass(group)], order_id=order_id)
                           for order_id in ("HL-1", "HL-2")])
    return "0..*" if both else "0..1"


def attendees_items() -> str:
    """How many items each attendee of an order is on."""
    pair = people(2)
    without = builds(lambda: trip_order(pair, [weekend_pass(pair[:1])]))
    several = builds(lambda: trip_order(pair, [weekend_pass(pair), weekend_pass(pair)]))
    return f"{0 if without else 1}..{'*' if several else '1'}"


def items_supplier_orders() -> str:
    """How many supplier orders each trip item ends up in once the OPC places it."""
    group = people(2)
    order = trip_order(group, [weekend_pass(group), weekend_pass(group[:1])])
    placed = split_by_supplier(order)
    counts = [sum(any(part is item for part in s.items) for s in placed) for item in order.items]
    return f"0..{max(counts)}"


OPPOSITE_ENDS = {
    (TripOrder, "buyer"): fans_orders,
    (TripItem, "attendees"): attendees_items,
    (SupplierOrder, "items"): items_supplier_orders,
}


def trip_items_view() -> dict:
    classes = [c for c in model_classes() if issubclass(c, TripItem)]
    names = frozenset(TripItem.__abstractmethods__)
    return {
        "classes": sorted(cls.__name__ for cls in classes),
        **hierarchy(classes),
        "operations": {cls.__name__: operations(cls, names) for cls in classes},
    }


def gateways_view() -> dict:
    gateways = [SupplierGateway] + sorted({cls for cls, _ in SUPPLIERS.values()},
                                          key=lambda cls: cls.__name__)
    raised = raised_by_cancel()
    exceptions = sorted({exception for _, exception in raised}, key=lambda c: c.__name__)
    classes = gateways + exceptions
    names = frozenset(SupplierGateway.__abstractmethods__)
    return {
        "classes": sorted(cls.__name__ for cls in classes),
        "packages": {cls.__name__: package_of(cls.__module__) for cls in classes},
        **hierarchy(classes),
        "operations": {cls.__name__: operations(cls, names) for cls in gateways},
        "raises": sorted([raiser, exception.__name__] for raiser, exception in raised),
    }


def package_of(module: str) -> str:
    """The Python package that holds module, written as a UML qualified name."""
    return "::".join(module.split(".")[:-1])


def raised_by_cancel() -> set[tuple[str, type]]:
    """Which class raises which exception when a placed supplier order is cancelled:
    once with each supplier unreachable, and once while online, 48 hours before
    the trip's first check-in."""
    stack = build_stack()
    order_id = book(stack)
    stack.run_until_idle()
    supplier_orders = stack.opc.orders.get(order_id).supplier_orders
    check_in = min(item.check_in for s in supplier_orders for item in s.items
                   if isinstance(item, LodgingStay))
    raised = set()
    for down in (True, False):
        if not down:
            stack.clock.advance((check_in - timedelta(hours=48) - stack.clock.now())
                                .total_seconds())
        for supplier_order in supplier_orders:
            gateway = gateway_for(supplier_order.supplier_id, stack.network, stack.clock)
            service = SUPPLIERS[supplier_order.supplier_id][1]
            if down:
                stack.network.take_down(service)
            try:
                gateway.cancel(supplier_order)
            except Exception as error:  # every exception cancel() raises is a fact
                raised.add((raising_class(error), type(error)))
            finally:
                stack.network.restore(service)
    return raised


def raising_class(error: Exception) -> str:
    """The class whose method raised error."""
    trace = error.__traceback__
    while trace.tb_next is not None:
        trace = trace.tb_next
    return trace.tb_frame.f_code.co_qualname.split(".")[0]


# --- The import view -----------------------------------------------------------------


def imports_view() -> dict:
    """Which classes use names imported from another of Headliner's packages.

    A package here is infra or one service under services/, with its
    subpackages, the unit that the import view draws.
    """
    packages: dict[str, str] = {}  # class -> package
    uses: dict[str, list[str]] = {}  # class -> names it uses from other packages
    imports: set[tuple[str, str]] = set()  # (importing package, imported package)
    broker_importers: set[str] = set()
    for path in sorted(HEADLINER.glob("services/**/*.py")) + sorted(HEADLINER.glob("infra/*.py")):
        package = headliner_package(path.relative_to(HEADLINER).with_suffix("").parts)
        tree = ast.parse(path.read_text(), str(path))
        imported = {  # name -> the Headliner package it comes from
            alias.asname or alias.name: headliner_package(node.module.split("."))
            for node in tree.body
            if isinstance(node, ast.ImportFrom) and node.module
            and node.module.split(".")[0] in ("infra", "services")
            for alias in node.names
        }
        imports |= {(package, source) for source in imported.values()}
        if imported.get("Broker") == "infra":
            broker_importers.add(package)
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                packages[node.name] = package
                used = {n.id for n in ast.walk(node) if isinstance(n, ast.Name)}
                foreign = sorted(n for n in used if imported.get(n, package) != package)
                if foreign:
                    uses[node.name] = foreign
    return {
        "packages": dict(sorted(packages.items())),
        "uses": dict(sorted(uses.items())),
        "broker_client_importers": sorted(p for p in broker_importers
                                          if p.startswith("services::")),
        "website_imports_from_opc": ("services::website", "services::opc") in imports,
    }


def headliner_package(parts) -> str:
    """infra, or services::<name> for a module anywhere under that service."""
    parts = list(parts)
    return "infra" if parts[0] == "infra" else f"services::{parts[1]}"


# --- Evidence ------------------------------------------------------------------------


def line_of(path: str, symbol: str) -> int:
    """The number of the one line of a Headliner file that contains symbol."""
    lines = (HEADLINER / path).read_text().splitlines()
    found = [number for number, text in enumerate(lines, 1) if symbol in text]
    if len(found) != 1:
        raise ValueError(f"{path}: {symbol!r} is on {len(found)} lines, not one")
    return found[0]


def evidence() -> dict[str, str]:
    result: dict[str, str] = {}
    for path, symbol in EVIDENCE:
        if symbol in result:
            raise ValueError(f"{symbol!r} is cited twice; make it unique")
        result[symbol] = f"{path}:{line_of(path, symbol)}"
    return result
