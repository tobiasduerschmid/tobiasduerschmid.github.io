"""Tests for the view facts that the UML design questions tutorial's diagrams must match.

Each diagram answers one request about Headliner. diagram_facts.py derives what
a correct view contains by running and inspecting Headliner, and finds the line
that each note's evidence cites. The diagram tests in
scripts/tests/uml-design-questions-diagrams.test.js compare the diagrams with
these facts, so the values pinned here come from the design spec and the code.
"""

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True  # keep the student-facing Headliner tree free of caches
SPEC = importlib.util.spec_from_file_location(
    "uml_design_questions_diagram_facts",
    ROOT / "scripts/uml_design_questions/diagram_facts.py",
)
diagram_facts = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(diagram_facts)

VIEWS = diagram_facts.views()
HEADLINER = ROOT / "tutorial_sources/uml-design-questions/headliner"


def calls(view):
    return {(c["caller"], c["provider"], c["interface"]) for c in view["calls"]}


# --- Component views ----------------------------------------------------------------


def test_event_consumer_view_shows_the_exchange_its_publisher_and_its_consumers():
    view = VIEWS["event_consumers"]

    assert view["components"] == [
        "AffiliatePartners", "AffiliateRelay", "Loyalty", "MailRelay", "Notifications",
        "OPC", "ShuttlePlanner", "SupportConsole", "WarehouseETL", "trips",
    ]
    assert view["publishers"] == ["OPC"]


def test_each_consumer_binds_its_own_queue_with_the_configured_and_coded_keys():
    view = VIEWS["event_consumers"]

    assert view["queues"] == {
        "AffiliateRelay": "affiliates.trips",
        "Loyalty": "loyalty.trips",
        "Notifications": "notifications.trips",
        "ShuttlePlanner": "shuttle.planning",
        "SupportConsole": "support.cancellations",
        "WarehouseETL": "warehouse.all",
    }
    assert view["bindings"] == {
        "AffiliateRelay": ["trip.*"],
        "Loyalty": ["trip.confirmed"],
        "Notifications": ["trip.confirmed", "trip.cancelled", "trip.failed"],
        "ShuttlePlanner": ["supplier.shuttle.*"],
        "SupportConsole": ["trip.cancelled"],
        "WarehouseETL": ["#"],
    }


def test_event_consumer_view_calls_are_the_publish_and_the_calls_events_trigger():
    assert calls(VIEWS["event_consumers"]) == {
        ("OPC", "trips", "Publish"),
        ("AffiliateRelay", "AffiliatePartners", "Webhook"),
        ("Notifications", "MailRelay", "SMTP"),
    }


def test_trip_order_path_view_shows_twelve_components_and_leaves_out_the_rest():
    view = VIEWS["outages"]

    assert view["components"] == [
        "Bank", "BoxOffice", "CatalogDB", "ExperienceProvider", "LodgingProvider",
        "MailRelay", "MessageBroker", "Notifications", "OPC", "OrderDB",
        "ShuttleProvider", "TripWebsite",
    ]
    assert view["left_out"] == [
        "AffiliatePartners", "AffiliateRelay", "Loyalty", "ShuttlePlanner", "WarehouseETL",
    ]


def test_trip_order_path_connectors_say_whether_the_fan_waits():
    waits = {(c["caller"], c["provider"], c["interface"]): c["fan_waits"]
             for c in VIEWS["outages"]["calls"]}

    assert waits == {
        ("TripWebsite", "Bank", "CardService"): True,
        ("TripWebsite", "CatalogDB", "SQL"): True,
        ("TripWebsite", "BoxOffice", "Quotes"): True,
        ("TripWebsite", "ExperienceProvider", "Capacity"): True,
        ("TripWebsite", "OPC", "PurchaseOrderService"): True,
        ("OPC", "OrderDB", "SQL"): True,
        ("OPC", "MessageBroker", "Publish"): True,
        ("OPC", "Bank", "CardService"): False,
        ("OPC", "BoxOffice", "Booking"): False,
        ("OPC", "LodgingProvider", "Booking"): False,
        ("OPC", "ShuttleProvider", "Booking"): False,
        ("OPC", "ExperienceProvider", "Booking"): False,
        ("BoxOffice", "OPC", "SupplierCallbackService"): False,
        ("LodgingProvider", "OPC", "SupplierCallbackService"): False,
        ("ShuttleProvider", "OPC", "SupplierCallbackService"): False,
        ("ExperienceProvider", "OPC", "SupplierCallbackService"): False,
        ("Notifications", "MailRelay", "SMTP"): False,
    }


def test_trip_order_path_queues_feed_the_opc_workflow_and_notifications():
    assert VIEWS["outages"]["queued"] == [
        {"provider": "MessageBroker", "consumer": "Notifications",
         "queues": ["notifications.trips"]},
        {"provider": "MessageBroker", "consumer": "OPC",
         "queues": ["orders.received", "supplier.answered"]},
    ]


def test_website_connections_include_the_order_history_read_of_the_order_db():
    view = VIEWS["website_connections"]

    assert view["components"] == [
        "Bank", "BoxOffice", "CatalogDB", "ExperienceProvider", "OPC", "OrderDB",
        "TripWebsite",
    ]
    assert calls(view) == {
        ("TripWebsite", "Bank", "CardService"),
        ("TripWebsite", "BoxOffice", "Quotes"),
        ("TripWebsite", "CatalogDB", "SQL"),
        ("TripWebsite", "ExperienceProvider", "Capacity"),
        ("TripWebsite", "OPC", "OrderTrackingService"),
        ("TripWebsite", "OPC", "PurchaseOrderService"),
        ("TripWebsite", "OrderDB", "SQL"),
    }


# --- Sequence views -----------------------------------------------------------------


def test_a_trip_order_is_received_before_it_is_charged_and_placed():
    assert VIEWS["failed_trips"]["timeline"] == [
        "opc.PurchaseOrderService.submit",
        "website.responds",
        "bank.capture",
        "supplier.place",
        "opc.SupplierCallbackService.answer",
    ]


def test_a_cancellation_refunds_within_the_request_and_cancels_suppliers_later():
    assert VIEWS["cancellation"]["timeline"] == [
        "opc.PurchaseOrderService.cancel",
        "bank.refund",
        "website.responds",
        "supplier.cancel",
    ]


def test_checkout_view_durations_for_the_calls_it_does_not_draw():
    assert VIEWS["checkout"] == {"bulk_quote_ms": 400, "catalog_query_ms": 20}


# --- Class views --------------------------------------------------------------------


def test_data_model_view_classes_and_hierarchy():
    view = VIEWS["data_model"]

    assert view["classes"] == [
        "Attendee", "Experience", "Fan", "FestivalPass", "LodgingStay", "Payment",
        "ShuttleRide", "SupplierOrder", "TransportItem", "TripItem", "TripOrder",
    ]
    assert view["left_out"] == ["Invoice"]
    assert view["abstract"] == ["TransportItem", "TripItem"]
    assert view["generalizations"] == [
        ["Experience", "TripItem"], ["FestivalPass", "TripItem"],
        ["LodgingStay", "TripItem"], ["ShuttleRide", "TransportItem"],
        ["TransportItem", "TripItem"],
    ]


def test_data_model_multiplicities_come_from_type_hints_and_validators():
    ends = {(a["from"], a["role"], a["to"]): (a["opposite"], a["multiplicity"], a["composition"])
            for a in VIEWS["data_model"]["associations"]}

    assert ends == {
        ("TripOrder", "buyer", "Fan"): ("0..*", "1", False),
        ("TripOrder", "attendees", "Attendee"): ("1", "1..8", True),
        ("TripOrder", "items", "TripItem"): ("1", "1..*", True),
        ("TripOrder", "payment", "Payment"): ("1", "1", True),
        ("TripOrder", "supplier_orders", "SupplierOrder"): ("1", "0..*", True),
        ("TripItem", "attendees", "Attendee"): ("1..*", "1..*", False),
        ("SupplierOrder", "items", "TripItem"): ("0..1", "0..*", False),
    }


def test_trip_item_view_lists_the_operations_each_class_defines():
    view = VIEWS["trip_items"]
    every = {"cancellation_deadline": "defined", "price": "defined", "supplier_kind": "defined"}

    assert view["abstract"] == ["TransportItem", "TripItem"]
    assert view["operations"] == {
        "TripItem": {"cancellation_deadline": "abstract", "price": "abstract",
                     "supplier_kind": "abstract"},
        "FestivalPass": every,
        "LodgingStay": every,
        "Experience": every,
        "TransportItem": {"cancellation_deadline": "defined"},
        "ShuttleRide": {"price": "defined", "supplier_kind": "defined"},
    }


def test_gateway_view_places_each_class_in_its_package():
    packages = VIEWS["gateways"]["packages"]
    gateways, partners = "services::opc::gateways", "services::opc::partners"

    assert packages == {
        "SupplierGateway": gateways, "SupplierUnavailable": gateways,
        "BoxOfficeGateway": gateways, "LodgingGateway": gateways,
        "ShuttleGateway": gateways, "ExperienceGateway": gateways,
        "GlampingCoGateway": partners, "MeetAndGreetGateway": partners,
        "VipShuttleGateway": partners, "ManualCancellationRequired": partners,
    }


def test_gateway_view_hierarchy_overrides_and_raised_exceptions():
    view = VIEWS["gateways"]

    assert sorted(map(tuple, view["generalizations"])) == [
        ("BoxOfficeGateway", "SupplierGateway"),
        ("ExperienceGateway", "SupplierGateway"),
        ("GlampingCoGateway", "LodgingGateway"),
        ("LodgingGateway", "SupplierGateway"),
        ("MeetAndGreetGateway", "ExperienceGateway"),
        ("ShuttleGateway", "SupplierGateway"),
        ("VipShuttleGateway", "ShuttleGateway"),
    ]
    assert view["operations"]["SupplierGateway"] == {
        "cancel": "abstract", "parse_invoice": "abstract", "place": "abstract",
    }
    assert view["operations"]["GlampingCoGateway"] == {"cancel": "defined"}
    assert view["operations"]["MeetAndGreetGateway"] == {"cancel": "defined"}
    assert view["operations"]["VipShuttleGateway"] == {"place": "defined"}
    assert view["raises"] == [
        ["GlampingCoGateway", "ManualCancellationRequired"],
        ["MeetAndGreetGateway", "ManualCancellationRequired"],
        ["SupplierGateway", "SupplierUnavailable"],
    ]


def test_import_view_only_the_opc_imports_the_broker_client():
    view = VIEWS["imports"]

    assert view["broker_client_importers"] == ["services::opc"]
    assert view["website_imports_from_opc"] is False
    assert view["uses"]["OpcClient"] == ["ServiceClient"]
    assert view["uses"]["Intake"] == ["Broker"]
    assert view["uses"]["TripEvents"] == ["Broker"]
    assert view["uses"]["TripNotifications"] == ["Message", "consumes"]


def test_import_view_packages_follow_the_python_packages():
    packages = VIEWS["imports"]["packages"]

    assert packages["OpcClient"] == "services::website"
    assert packages["Intake"] == "services::opc"
    assert packages["TripNotifications"] == "services::notifications"
    assert packages["Broker"] == "infra"
    assert packages["ServiceClient"] == "infra"


# --- Evidence -----------------------------------------------------------------------


def test_every_evidence_symbol_is_on_the_line_it_names():
    evidence = diagram_facts.evidence()

    assert evidence, "the diagrams' notes cite evidence"
    for symbol, ref in evidence.items():
        path, line = ref.rsplit(":", 1)
        text = (HEADLINER / path).read_text().splitlines()[int(line) - 1]
        assert symbol in text, f"{ref} does not contain {symbol!r}"


def test_an_evidence_symbol_that_is_not_unique_in_its_file_is_refused():
    try:
        diagram_facts.line_of("deploy/broker.toml", 'exchange = "trips"')
    except ValueError as error:
        assert "deploy/broker.toml" in str(error)
    else:
        raise AssertionError("an ambiguous symbol must not get a line number")
