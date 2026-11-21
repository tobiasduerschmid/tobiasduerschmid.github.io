"""Tests for the services that act on trip events."""

from datetime import datetime, timezone

from infra.clock import FakeClock
from infra.http import Network, ServiceClient
from services.loyalty.points import LoyaltyProgram
from services.notifications.mailer import SENDER, Mailer
from services.shuttle_planner.planner import ShuttlePlanner
from stubs.mail_relay import MailRelay

NOW = datetime(2027, 6, 11, 9, 0, tzinfo=timezone.utc)


def test_the_mailer_sends_through_the_mail_relay():
    network = Network(FakeClock(NOW))
    relay = MailRelay(network)
    mailer = Mailer(ServiceClient("mail_relay", network, caller="notifications"))

    mailer.send("ines@example.com", "Your packing list", "Bring a rain jacket.")

    assert relay.delivered == [
        {
            "from": SENDER,
            "to": "ines@example.com",
            "subject": "Your packing list",
            "body": "Bring a rain jacket.",
        }
    ]


def test_loyalty_points_are_one_per_whole_dollar():
    loyalty = LoyaltyProgram()

    loyalty.award("fan-31", 95699)
    loyalty.award("fan-31", 1000)

    assert loyalty.balance("fan-31") == 956 + 10
    assert loyalty.balance("fan-32") == 0


def test_the_shuttle_planner_counts_seats_per_departure():
    planner = ShuttlePlanner()
    route, departure = "Union Station to Lakeside Fest", "2027-08-20T09:00:00+00:00"

    planner.book_seats(route, departure, 4)
    planner.book_seats(route, departure, 2)
    planner.release_seats(route, departure, 1)

    assert planner.seats_booked(route, departure) == 5
    assert planner.seats_booked(route, "2027-08-20T10:00:00+00:00") == 0
