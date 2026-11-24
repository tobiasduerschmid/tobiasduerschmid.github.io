"""Tests for the facts extractor that derives the UML design questions' answer keys."""

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True  # keep the student-facing Headliner tree free of caches
SPEC = importlib.util.spec_from_file_location(
    "uml_design_questions_facts", ROOT / "scripts/uml_design_questions/facts.py"
)
facts_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(facts_module)

FACTS = facts_module.extract()
SPEC_KEYS = {
    "event_consumers",
    "gateway_contracts",
    "failed_trips",
    "data_model",
    "outages",
    "presale_path",
    "checkout_latency",
    "capstone",
    "shared_code",
    "diagrams",  # what each diagram must show (diagram_facts.py)
    "evidence",
}


def test_facts_match_spec_keys():
    assert set(FACTS) == SPEC_KEYS
    assert set(FACTS["capstone"]) == {
        "website_reads_order_db",
        "rideshare_must_implement",
        "unlisted_item_type_is_refused",
        "refund_before_cancel",
        "glampingco_48h_stays_booked",
        "service_fee",
        "my_trips_reads_stored_payment",
        "stuck_cancellation",
    }


def test_event_consumers():
    assert FACTS["event_consumers"] == {
        "trip.confirmed": [
            "AffiliateRelay",
            "Loyalty",
            "Notifications",
            "WarehouseETL",
        ],
        "trip.cancelled": [
            "AffiliateRelay",
            "Notifications",
            "SupportConsole",
            "WarehouseETL",
        ],
        "external_forwarders": ["AffiliateRelay"],
        # A body with fan_name replaced by given_name and family_name: the
        # consumers whose handler raises on a trip event; with the two fields
        # added instead, none does.
        "rename_breaks": ["AffiliateRelay", "Notifications", "SupportConsole"],
        "additive_breaks": [],
        "trip.confirmed.v2": ["WarehouseETL"],
    }


def test_gateway_contracts():
    contracts = FACTS["gateway_contracts"]

    assert contracts["fails_cancel_when_online"] == [
        "GlampingCoGateway",
        "MeetAndGreetGateway",
    ]
    assert contracts["experience_place_inheritors"] == [
        "ExperienceGateway",
        "MeetAndGreetGateway",
    ]
    assert {
        name: methods
        for name, methods in contracts["overrides"].items()
        if name in {"GlampingCoGateway", "MeetAndGreetGateway", "VipShuttleGateway"}
    } == {
        "GlampingCoGateway": ["cancel"],
        "MeetAndGreetGateway": ["cancel"],
        "VipShuttleGateway": ["place"],
    }
    assert contracts["overrides"]["LodgingGateway"] == [
        "cancel",
        "parse_invoice",
        "place",
    ]


def test_failed_trips():
    assert FACTS["failed_trips"] == {
        "capture_before_first_answer": True,
        "reject_branch_calls": ["mark_failed()", "publish trip.failed"],
        "missing": ["refund", "cancel confirmed suppliers"],
        "refunds": 0,
        "fan_can_cancel": False,
        # When the box office rejects first, the others still confirm afterwards.
        "confirmed_after_failure": [
            "supplier.lodging.confirmed",
            "supplier.shuttle.confirmed",
        ],
        "card_check_amount": 0,
    }


def test_data_model():
    assert FACTS["data_model"] == {
        "allowed": [1, 3],
        "split_payment_multiplicity": "TripOrder-Payment",
    }


def test_outages():
    assert FACTS["outages"] == {
        "bank": "cannot_submit",
        "lodging": "finish_afterwards",
        "broker": "cannot_submit",
        "mail_relay": "emails_wait",
    }


def test_presale_path():
    # A cart of passes, a stay, and a shuttle ride, booked during each outage.
    assert FACTS["presale_path"] == {
        "box_office": "cannot_submit",
        "shuttle": "finish_afterwards",
        "experiences": "unaffected",
        "lodging_charged_while_waiting": True,
    }


def test_checkout_latency_variants():
    latency = FACTS["checkout_latency"]

    assert latency["quote_seconds"] == 5.5
    assert latency["check_seconds"] == 2.25
    assert latency["variants"] == {
        "bulk_cached_card": 2.97,
        "bulk_parallel": 1.92,
        "parallel_only": 7.02,
        "bulk_no_checks": 1.02,
    }
    assert latency["variants"]["bulk_parallel"] == latency["keyed_fix_seconds"]
    assert latency["rejected_experience_is_charged_and_failed"] is True


def test_checkout_latency():
    latency = FACTS["checkout_latency"]

    assert latency["external_calls"] == 9
    assert 8.0 <= latency["elapsed_seconds"] <= 8.8
    assert latency["keyed_fix_seconds"] < 2.0


def test_capstone():
    assert FACTS["capstone"] == {
        "website_reads_order_db": True,
        "rideshare_must_implement": ["price", "supplier_kind"],
        # An order that names a kind of item ITEM_TYPES does not list cannot be read.
        "unlisted_item_type_is_refused": True,
        "refund_before_cancel": True,
        "glampingco_48h_stays_booked": True,
        "service_fee": 0.12,
        "my_trips_reads_stored_payment": True,
        "stuck_cancellation": {
            "refunds": 1,
            "tent": "confirmed",
            "trip_cancelled_published": False,
            "support_follow_ups": 0,
        },
    }


def test_shared_code():
    # Found by importing each service in a fresh interpreter: every service
    # loads infra/http.py, although only five of them import it themselves.
    shared = FACTS["shared_code"]
    assert {name: "http" in modules for name, modules in shared["loads"].items()} == dict.fromkeys(
        ["AffiliateRelay", "Loyalty", "Notifications", "OPC", "ShuttlePlanner", "SupportConsole",
         "TripWebsite", "WarehouseETL"], True)
    assert shared["imports"]["http"] == [
        "AffiliateRelay", "Notifications", "OPC", "SupportConsole", "TripWebsite"]
    assert [name for name, modules in shared["loads"].items() if "broker" not in modules] == ["TripWebsite"]
    assert shared["loads"]["Loyalty"] == ["broker", "clock", "http"]
    # The three event-only services take one name from the broker's module.
    assert shared["takes_only_message"] == ["Loyalty", "ShuttlePlanner", "WarehouseETL"]
    assert shared["message_stands_alone"] is True
    assert shared["service_to_service_imports"] == []


def test_importing_a_service_leaves_no_cache_in_the_student_facing_tree():
    facts_module.loaded_shared_modules("loyalty")

    assert not list(facts_module.HEADLINER.rglob("__pycache__"))


def test_facts_json_is_current():
    written = json.loads(facts_module.FACTS_JSON.read_text())

    assert written == json.loads(json.dumps(FACTS))
