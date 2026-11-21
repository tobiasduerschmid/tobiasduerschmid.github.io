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
    "checkout_latency",
    "capstone",
    "diagrams",  # what each diagram must show (diagram_facts.py)
    "evidence",
}


def test_facts_match_spec_keys():
    assert set(FACTS) == SPEC_KEYS
    assert set(FACTS["capstone"]) == {
        "website_reads_order_db",
        "rideshare_must_implement",
        "refund_before_cancel",
        "glampingco_48h_stays_booked",
        "service_fee",
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


def test_checkout_latency():
    latency = FACTS["checkout_latency"]

    assert latency["external_calls"] == 9
    assert 8.0 <= latency["elapsed_seconds"] <= 8.8
    assert latency["keyed_fix_seconds"] < 2.0


def test_capstone():
    assert FACTS["capstone"] == {
        "website_reads_order_db": True,
        "rideshare_must_implement": ["price", "supplier_kind"],
        "refund_before_cancel": True,
        "glampingco_48h_stays_booked": True,
        "service_fee": 0.12,
    }


def test_facts_json_is_current():
    written = json.loads(facts_module.FACTS_JSON.read_text())

    assert written == json.loads(json.dumps(FACTS))
