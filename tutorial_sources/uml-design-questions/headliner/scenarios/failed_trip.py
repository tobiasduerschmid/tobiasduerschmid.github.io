"""Reproduces support ticket SUP-2291: a Neon Nights trip that was charged, then failed.

Run it from the repository root: python3 -m scenarios.failed_trip
"""

from devstack import build_stack
from services.website.cart import Cart, CartLine, Guest
from services.website.checkout import FanAccount

FAN = FanAccount("fan-204", "Priya Natarajan", "priya@example.com")
GUESTS = ("Priya Natarajan", "Dev Natarajan")


def main() -> None:
    # The shuttle operator had no seats left on the downtown run that night.
    stack = build_stack(supplier_decisions={"shuttle": "reject"})
    cart = Cart(
        "neon-nights",
        [Guest(GUESTS[0]), Guest(GUESTS[1], "teen")],
        [
            CartLine("stay", "nn-glamping-bell", GUESTS),
            CartLine("ride", "nn-downtown-shuttle", GUESTS),
        ],
    )
    order_id = stack.website.book(FAN, cart, "tok_visa")["order_id"]
    stack.run_until_idle()

    charged = stack.stubs.bank.captured_for(order_id) / 100
    print(f"Trip {order_id} for Neon Nights: {stack.website.track(order_id)['status']}")
    print(f"Charged to the fan's card: ${charged:,.2f}")
    print("Bookings at the suppliers:")
    for supplier in (stack.stubs.box_office, stack.stubs.lodging, stack.stubs.shuttle):
        for reference, booking in supplier.bookings.items():
            print(f"  {reference}: {booking}")


if __name__ == "__main__":
    main()
