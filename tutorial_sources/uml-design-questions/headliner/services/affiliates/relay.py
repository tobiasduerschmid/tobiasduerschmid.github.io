"""Affiliate Relay: tells influencer partners about trips, for their commission."""

from infra.broker import Message
from infra.http import ServiceClient


class AffiliateRelay:
    def __init__(self, partners: ServiceClient) -> None:
        self._partners = partners

    def on_trip_event(self, message: Message) -> None:
        trip = message.body
        self._partners.call("webhook", {
            "event": message.routing_key,
            "order_id": trip["order_id"],
            "fan_name": trip["fan_name"],
            "festival_id": trip["festival_id"],
            "total": trip["total"],
        })
