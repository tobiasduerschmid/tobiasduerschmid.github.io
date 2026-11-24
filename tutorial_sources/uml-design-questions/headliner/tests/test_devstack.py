"""Tests for the devstack and the repro scripts that use it."""

import runpy
from datetime import timedelta
from pathlib import Path

from devstack import START, build_stack
from services.website.cart import Cart, CartLine, Guest
from services.website.checkout import FanAccount

ROOT = Path(__file__).resolve().parent.parent
FAN = FanAccount("fan-31", "Ines Moreau", "ines@example.com")


def test_a_new_stack_starts_its_clock_at_start():
    now = build_stack().clock.now()

    assert START <= now < START + timedelta(minutes=1)


def test_each_stack_starts_with_empty_order_history():
    first = build_stack()
    first.website.book(FAN, Cart("lakeside-fest", [Guest("Ines Moreau")]), "tok_visa")

    second = build_stack()

    assert second.website.my_trips(FAN.fan_id) == []


def test_support_can_look_up_a_trip():
    stack = build_stack()
    cart = Cart(
        "lakeside-fest",
        [Guest("Ines Moreau")],
        [CartLine("stay", "lf-lakeshore-campsite", ("Ines Moreau",))],
    )
    order_id = stack.website.book(FAN, cart, "tok_visa")["order_id"]
    stack.run_until_idle()

    assert stack.consumers.support_console.lookup(order_id)["status"] == "confirmed"


def test_each_repro_script_runs_and_reports(capsys):
    for script in ("failed_trip.py", "slow_group_checkout.py"):
        runpy.run_path(str(ROOT / "scenarios" / script), run_name="__main__")

        assert capsys.readouterr().out.strip(), f"{script} printed nothing"
