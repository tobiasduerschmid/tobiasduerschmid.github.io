"""The devstack: all of Headliner, and stand-ins for other systems, in one process.

Tests and repro scripts start it with build_stack(). It reads deploy/*.toml,
starts every service on a simulated network, wires the message broker's
consumers, and schedules the recurring jobs. Time moves only on its fake clock.
"""

import tomllib
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from fixtures.catalog import load_catalog
from infra import subscriptions
from infra.broker import Broker, Message, MessageHandler
from infra.clock import FakeClock
from infra.db import create_database
from infra.http import Network, ServiceClient, ServiceDirectory
from infra.scheduler import Scheduler
from services.affiliates.relay import AffiliateRelay
from services.loyalty.points import LoyaltyProgram
from services.notifications.consumers import TripNotifications
from services.notifications.mailer import Mailer
from services.opc.api import ANSWERED_QUEUE
from services.opc.intake import RECEIVED_QUEUE
from services.opc.service import Opc, start_opc
from services.reporting.warehouse_etl import WarehouseETL
from services.shuttle_planner.planner import ShuttlePlanner
from services.support_console.app import SupportConsole
from services.website.app import WebsiteApp, create_app
from stubs.start import Stubs, start_stubs

DEPLOY = Path(__file__).resolve().parent / "deploy"
START = datetime(2027, 6, 11, 9, 0, tzinfo=timezone.utc)
CATALOG_LATENCY_MS = 20  # one query to the Catalog DB
TICK_S = 30  # how far the clock moves between rounds of queued work
QUIET_ROUNDS = 4  # rounds without a delivered message before the stack is idle


@dataclass
class Consumers:
    """The services that consume events from the trips exchange."""

    notifications: TripNotifications
    loyalty: LoyaltyProgram
    warehouse: WarehouseETL
    affiliates: AffiliateRelay
    support_console: SupportConsole
    shuttle_planner: ShuttlePlanner


@dataclass
class Stack:
    clock: FakeClock
    network: Network
    broker: Broker
    scheduler: Scheduler
    website: WebsiteApp
    opc: Opc
    consumers: Consumers
    stubs: Stubs
    _consumers: dict[str, tuple[str, MessageHandler]] = field(default_factory=dict)

    def consume(self, queue: str, handler: MessageHandler, component: str) -> None:
        """Make handler, part of component, the consumer of queue."""
        self.broker.consume(queue, handler, component)
        self._consumers[queue] = (component, handler)

    def subscribe(self, consumer: object, prefix: str, component: str) -> None:
        """Bind and consume the queues that consumer declares with consumes()."""
        queues = subscriptions.subscribe(
            self.broker, consumer, prefix=prefix, component=component
        )
        for queue, handler in queues.items():
            self._consumers[queue] = (component, handler)

    def component_of(self, queue: str) -> str:
        """The component that consumes queue."""
        return self._consumers[queue][0]

    def deliver(self, queue: str, message: Message) -> None:
        """Hand message straight to queue's consumer, as the broker would."""
        self._consumers[queue][1](message)

    def run_until_idle(self) -> None:
        """Let time pass, delivering messages and running due jobs, until work stops."""
        quiet = 0
        while quiet < QUIET_ROUNDS:
            delivered = self.broker.drain()
            self.scheduler.run_due()
            delivered += self.broker.drain()
            quiet = 0 if delivered else quiet + 1
            self.clock.advance(TICK_S)


def build_stack(
    *, down: tuple[str, ...] = (), supplier_decisions: Mapping[str, str] | None = None
) -> Stack:
    """Start everything, then take down the services named in down.

    supplier_decisions maps a supplier id to "confirm" or "reject".
    """
    clock = FakeClock(START)
    network, scheduler = Network(clock), Scheduler(clock)
    broker = Broker(network)
    broker.load_config(DEPLOY / "broker.toml")
    directory = ServiceDirectory.from_toml(DEPLOY / "services.toml")
    order_db = create_database(
        directory.address("order-db"), replica_dsn=directory.address("order-db-replica")
    )
    catalog_db = create_database(
        directory.address("catalog-db"), clock=clock, latency_ms=CATALOG_LATENCY_MS
    )
    load_catalog(catalog_db)
    with open(DEPLOY / "website.toml", "rb") as settings:
        website = create_app(network, clock, tomllib.load(settings))
    stack = Stack(
        clock,
        network,
        broker,
        scheduler,
        website,
        start_opc(network, broker, scheduler, clock, order_db),
        _consumers(network),
        start_stubs(network, scheduler, clock, supplier_decisions or {}),
    )
    _wire_queues(stack)
    for service in down:
        network.take_down(service)
    return stack


def _consumers(network: Network) -> Consumers:
    def client(service: str, caller: str) -> ServiceClient:
        return ServiceClient(service, network, caller)

    return Consumers(
        notifications=TripNotifications(Mailer(client("mail_relay", "notifications"))),
        loyalty=LoyaltyProgram(),
        warehouse=WarehouseETL(),
        affiliates=AffiliateRelay(client("affiliate_partners", "affiliates")),
        support_console=SupportConsole(client("opc", "support_console")),
        shuttle_planner=ShuttlePlanner(),
    )


def _wire_queues(stack: Stack) -> None:
    opc, consumers = stack.opc, stack.consumers
    stack.consume(RECEIVED_QUEUE, opc.workflow.on_order_received, "OPC")
    stack.consume(ANSWERED_QUEUE, opc.workflow.on_supplier_answered, "OPC")
    stack.subscribe(consumers.notifications, "notifications", "Notifications")
    stack.consume("loyalty.trips", consumers.loyalty.on_trip_confirmed, "Loyalty")
    stack.consume("warehouse.all", consumers.warehouse.on_event, "WarehouseETL")
    stack.consume(
        "affiliates.trips", consumers.affiliates.on_trip_event, "AffiliateRelay"
    )
    stack.consume(
        "support.cancellations",
        consumers.support_console.on_trip_cancelled,
        "SupportConsole",
    )
    stack.consume(
        "shuttle.planning",
        consumers.shuttle_planner.on_supplier_event,
        "ShuttlePlanner",
    )
