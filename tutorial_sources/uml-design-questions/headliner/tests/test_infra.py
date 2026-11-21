"""Tests for infra, the runtime library the devstack runs every service on."""

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from infra.broker import Broker, BrokerUnavailable, Message, topic_matches
from infra.clock import FakeClock
from infra.db import connect, create_database
from infra.http import Network, ServiceClient, ServiceDirectory, ServiceUnavailable
from infra.scheduler import Scheduler

DEPLOY = Path(__file__).resolve().parent.parent / "deploy"
START = datetime(2027, 6, 11, 9, 0, tzinfo=timezone.utc)
STOCK_DB = "postgres://stock-db.internal/stock"
STOCK_DB_REPLICA = "postgres://stock-db-replica.internal/stock"


@pytest.fixture
def clock():
    return FakeClock(START)


@pytest.fixture
def network(clock):
    return Network(clock)


@pytest.fixture
def broker(network):
    broker = Broker(network)
    broker.declare_exchange("inventory")
    return broker


def serve_inventory(network, latency_ms=0):
    """Put a stand-in inventory service on the network; return a client for it."""
    network.register(
        "inventory", "reserve", lambda payload: {"reserved": True}, latency_ms
    )
    return ServiceClient("inventory", network, caller="storefront")


def subscribe(broker, queue, pattern):
    """Bind a new queue to the inventory exchange; return the list it receives."""
    received = []
    broker.declare_queue(queue)
    broker.bind(queue, "inventory", pattern)
    broker.consume(queue, received.append, component=queue)
    return received


@pytest.mark.parametrize(
    ("pattern", "routing_key", "expected"),
    [
        ("inventory.*", "inventory.restocked", True),
        ("inventory.*", "inventory.restocked.v2", False),
        ("#", "pricing.discount.started", True),
        ("#", "inventory", True),
        ("pricing.discount.*", "inventory.restocked", False),
        ("inventory.#", "inventory.bin.moved", True),
        ("inventory.restocked", "inventory.restocked", True),
    ],
)
def test_topic_matching(pattern, routing_key, expected):
    assert topic_matches(pattern, routing_key) is expected


def test_service_down_raises(network):
    inventory = serve_inventory(network)
    network.take_down("inventory")

    with pytest.raises(ServiceUnavailable, match="inventory"):
        inventory.call("reserve", {"sku": "tent-2p"})


def test_latency_advances_clock(clock, network):
    inventory = serve_inventory(network, latency_ms=1100)

    inventory.call("reserve", {"sku": "tent-2p"})

    assert clock.now() == START + timedelta(seconds=1.1)


def test_call_log_records_every_request_including_failed_ones(network):
    storefront = serve_inventory(network)
    back_office = ServiceClient("inventory", network, caller="back-office")
    storefront.call("reserve", {"sku": "tent-2p"})
    network.take_down("inventory")

    with pytest.raises(ServiceUnavailable):
        back_office.call("reserve", {"sku": "cabin"})

    assert network.call_log == [
        ("storefront", "inventory", "reserve"),
        ("back-office", "inventory", "reserve"),
    ]


def test_service_directory_resolves_names_to_addresses(tmp_path):
    services = tmp_path / "services.toml"
    services.write_text(
        '[internal]\norders = "https://orders.internal"\n'
        '[external]\npayments = "https://api.payments.example/v1"\n'
    )

    directory = ServiceDirectory.from_toml(services)

    assert directory.address("orders") == "https://orders.internal"
    assert directory.address("payments") == "https://api.payments.example/v1"
    with pytest.raises(LookupError):
        directory.address("inventory")


def test_publish_routes_by_binding(broker):
    restocks = subscribe(broker, "restocks", "inventory.restocked")
    audit = subscribe(broker, "audit", "#")
    discounts = subscribe(broker, "discounts", "pricing.discount.*")

    broker.publish("inventory", "inventory.restocked", {"sku": "tent-2p"})
    broker.drain()

    delivered = Message("inventory.restocked", {"sku": "tent-2p"})
    assert restocks == [delivered]
    assert audit == [delivered]
    assert discounts == []


def test_messages_wait_for_drain_and_arrive_in_order(broker):
    received = []
    broker.declare_queue("work")
    broker.consume("work", received.append, component="Worker")

    broker.send("work", {"sku": "tent-2p"})
    broker.send("work", {"sku": "cabin"})
    assert received == []

    assert broker.drain() == 2
    assert received == [
        Message("work", {"sku": "tent-2p"}),
        Message("work", {"sku": "cabin"}),
    ]


def test_drain_also_delivers_what_consumers_queue_meanwhile(broker):
    receipts = []

    def forward(message):
        broker.send("receipts", message.body)

    broker.declare_queue("orders")
    broker.declare_queue("receipts")
    broker.consume("orders", forward, component="Checkout")
    broker.consume("receipts", receipts.append, component="Mailer")
    broker.send("orders", {"sku": "tent-2p"})

    assert broker.drain() == 2
    assert receipts == [Message("receipts", {"sku": "tent-2p"})]


def test_publish_when_broker_down_raises(network, broker):
    received = subscribe(broker, "restocks", "inventory.restocked")
    network.take_down("broker")

    with pytest.raises(BrokerUnavailable):
        broker.publish("inventory", "inventory.restocked", {"sku": "tent-2p"})

    network.restore("broker")
    broker.drain()
    assert received == []


def test_send_when_broker_down_raises(network, broker):
    broker.declare_queue("work")
    network.take_down("broker")

    with pytest.raises(BrokerUnavailable):
        broker.send("work", {"sku": "tent-2p"})


def test_message_waits_while_its_consumer_cannot_reach_a_service(network, broker):
    inventory = serve_inventory(network)
    reserved = []

    def reserve(message):
        inventory.call("reserve", message.body)
        reserved.append(message.body["sku"])

    broker.declare_queue("reservations")
    broker.consume("reservations", reserve, component="Storefront")
    broker.send("reservations", {"sku": "tent-2p"})
    network.take_down("inventory")

    assert broker.drain() == 0
    network.restore("inventory")
    assert broker.drain() == 1
    assert reserved == ["tent-2p"]


def test_load_config_declares_exchanges_queues_and_bindings(network, tmp_path):
    topology = tmp_path / "broker.toml"
    topology.write_text(
        '[[exchanges]]\nname = "pricing"\ntype = "topic"\n'
        '[[queues]]\nname = "restock.requests"\n'
        '[[bindings]]\nqueue = "discount.audit"\nexchange = "pricing"\n'
        'pattern = "pricing.discount.*"\n'
    )
    broker = Broker(network)

    broker.load_config(topology)

    assert broker.bindings() == [("discount.audit", "pricing", "pricing.discount.*")]
    broker.send("restock.requests", {"sku": "tent-2p"})  # the work queue exists


def test_load_config_accepts_only_topic_exchanges(network, tmp_path):
    topology = tmp_path / "broker.toml"
    topology.write_text('[[exchanges]]\nname = "pricing"\ntype = "fanout"\n')

    with pytest.raises(ValueError, match="pricing"):
        Broker(network).load_config(topology)


def test_replica_is_read_only():
    create_database(STOCK_DB, replica_dsn=STOCK_DB_REPLICA)

    with pytest.raises(PermissionError):
        connect(STOCK_DB_REPLICA).insert("stock", {"sku": "tent-2p"})


def test_replica_reads_what_the_primary_wrote():
    create_database(STOCK_DB, replica_dsn=STOCK_DB_REPLICA)
    primary, replica = connect(STOCK_DB), connect(STOCK_DB_REPLICA)
    first = primary.insert("stock", {"sku": "tent-2p", "state": "ordered"})
    primary.insert("stock", {"sku": "cabin", "state": "ordered"})

    primary.update("stock", first, state="shelved")

    assert replica.get("stock", first) == {
        "id": first,
        "sku": "tent-2p",
        "state": "shelved",
    }
    assert [row["sku"] for row in replica.find("stock", state="ordered")] == ["cabin"]


def test_every_query_takes_the_database_latency(clock):
    stock = create_database(STOCK_DB, clock=clock, latency_ms=20)

    key = stock.insert("stock", {"sku": "tent-2p"})
    stock.get("stock", key)
    stock.find("stock", sku="tent-2p")

    assert clock.now() == START + timedelta(seconds=0.06)


def test_a_new_database_starts_empty():
    create_database(STOCK_DB).insert("stock", {"sku": "tent-2p"})

    assert create_database(STOCK_DB).find("stock") == []


def test_scheduled_job_runs_once_per_interval(clock):
    scheduler = Scheduler(clock)
    runs = []
    scheduler.every(60, lambda: runs.append(clock.now()), "sweep")

    clock.advance(59)
    assert scheduler.run_due() == 0
    clock.advance(1)
    assert scheduler.run_due() == 1
    assert scheduler.run_due() == 0
    clock.advance(60)
    assert scheduler.run_due() == 1

    assert runs == [START + timedelta(seconds=60), START + timedelta(seconds=120)]
