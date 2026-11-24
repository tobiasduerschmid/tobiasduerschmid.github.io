"""Tests for the supplier gateways the OPC orders items through."""

from datetime import datetime, timezone

import pytest

from infra.clock import FakeClock
from infra.http import Network
from services.opc.gateways.base import SupplierUnavailable
from services.opc.gateways.registry import gateway_for
from services.opc.model.items import FestivalPass, LodgingStay
from services.opc.model.orders import Attendee
from services.opc.model.suppliers import Invoice, SupplierOrder

NOW = datetime(2027, 6, 11, 9, 0, tzinfo=timezone.utc)
CHECK_IN = datetime(2027, 8, 19, 15, 0, tzinfo=timezone.utc)
ANA, BEN = Attendee("Ana Lima"), Attendee("Ben Okafor", "teen")


@pytest.fixture
def clock():
    return FakeClock(NOW)


@pytest.fixture
def network(clock):
    return Network(clock)


def record_requests(network, service, endpoint):
    """Serve endpoint on a stand-in supplier service; return the requests it gets."""
    requests = []
    network.register(
        service, endpoint, lambda request: requests.append(request) or {"ok": True}
    )
    return requests


def passes_order():
    passes = FestivalPass("box-office", [ANA, BEN], "lakeside-fest", 32900)
    return SupplierOrder("box-office", "HL-1001", [passes])


def test_place_sends_each_ticket_holder_to_the_box_office(network, clock):
    requests = record_requests(network, "box_office", "place")

    gateway_for("box-office", network, clock).place(passes_order())

    assert requests[0]["reference"] == "HL-1001-box-office"
    assert requests[0]["amount"] == 2 * 32900
    assert requests[0]["tickets"] == [
        {"holder": "Ana Lima", "age_group": "adult"},
        {"holder": "Ben Okafor", "age_group": "teen"},
    ]


def test_an_unreachable_supplier_raises_supplier_unavailable(network, clock):
    record_requests(network, "box_office", "place")
    network.take_down("box_office")

    with pytest.raises(SupplierUnavailable, match="box_office"):
        gateway_for("box-office", network, clock).place(passes_order())


def test_cancel_names_the_supplier_order(network, clock):
    requests = record_requests(network, "lodging", "cancel")
    stay = LodgingStay("lodging", [ANA], CHECK_IN, 2, "Lakeview cabin", 21000)

    gateway_for("lodging", network, clock).cancel(
        SupplierOrder("lodging", "HL-1001", [stay])
    )

    assert [request["reference"] for request in requests] == ["HL-1001-lodging"]


def test_each_supplier_invoice_format_is_read_in_cents(network, clock):
    lodging = gateway_for("lodging", network, clock)
    box_office = gateway_for("box-office", network, clock)

    assert lodging.parse_invoice({"folio": "F-88", "amount_due": "567.00"}) == (
        Invoice(56700, "F-88")
    )
    assert box_office.parse_invoice({"invoice_no": "BO-9", "total_cents": 65800}) == (
        Invoice(65800, "BO-9")
    )


def test_an_unknown_supplier_has_no_gateway(network, clock):
    with pytest.raises(LookupError, match="campervans"):
        gateway_for("campervans", network, clock)
