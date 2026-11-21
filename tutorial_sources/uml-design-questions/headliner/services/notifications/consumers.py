"""E-mails to fans about their trips."""

from infra.broker import Message
from infra.subscriptions import consumes
from services.notifications.mailer import Mailer

SUBJECTS = {
    "trip.confirmed": "Your trip {order_id} is confirmed",
    "trip.cancelled": "Your trip {order_id} is cancelled",
    "trip.failed": "We could not book your trip {order_id}",
}
BODIES = {
    "trip.confirmed": "Everything is booked. Your tickets arrive a week before.",
    "trip.cancelled": "Your trip is cancelled. We have refunded your card.",
    "trip.failed": "One of our partners could not take your booking.",
}


class TripNotifications:
    """Tells the fan by e-mail when a trip is confirmed, cancelled, or not booked."""

    def __init__(self, mailer: Mailer) -> None:
        self._mailer = mailer

    @consumes("trips", "trip.confirmed", "trip.cancelled", "trip.failed")
    def on_trip_event(self, message: Message) -> None:
        trip, event = message.body, message.routing_key
        self._mailer.send(
            to=trip["fan_email"],
            subject=SUBJECTS[event].format(order_id=trip["order_id"]),
            body=f"Hi {trip['fan_name']},\n\n{BODIES[event]}\n\nHeadliner",
        )
