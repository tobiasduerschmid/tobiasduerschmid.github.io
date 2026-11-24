"""Reproduces ticket PERF-118: group checkouts for Lakeside Fest take over 8 seconds.

Run it from the repository root: python3 -m scenarios.slow_group_checkout
"""

from devstack import build_stack
from services.website.cart import Cart, CartLine, Guest
from services.website.checkout import FanAccount

FAN = FanAccount("fan-512", "Maya Chen", "maya@example.com")
GROUP = ("Maya Chen", "Leo Chen", "Ava Ruiz", "Noah Ruiz", "Zoe Park")
EXPERIENCES = ("lf-sunrise-yoga", "lf-silent-disco", "lf-meet-the-tides")
TARGET_S = 2.0


def main() -> None:
    stack = build_stack()
    cart = Cart(
        "lakeside-fest",
        [Guest(name) for name in GROUP[:4]] + [Guest(GROUP[4], "teen")],
        [
            CartLine("stay", "lf-lakeview-lodge", GROUP),
            CartLine("ride", "lf-station-shuttle", GROUP),
            *(CartLine("experience", experience, GROUP) for experience in EXPERIENCES),
        ],
    )

    started = stack.clock.now()
    response = stack.website.book(FAN, cart, "tok_visa")
    seconds = (stack.clock.now() - started).total_seconds()

    party = f"{len(GROUP)} attendees, {len(EXPERIENCES)} experiences"
    print(f"{party}: {response['message']}")
    print(f"Time until the fan saw it: {seconds:.1f} s (target: {TARGET_S:.1f} s)")


if __name__ == "__main__":
    main()
