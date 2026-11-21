"""Sending e-mail through the mail relay."""

from infra.http import ServiceClient

SENDER = "Headliner Trips <trips@headliner.example>"


class Mailer:
    def __init__(self, relay: ServiceClient) -> None:
        self._relay = relay

    def send(self, to: str, subject: str, body: str) -> None:
        self._relay.call(
            "send", {"from": SENDER, "to": to, "subject": subject, "body": body}
        )
