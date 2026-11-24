"""The SMTP relay that delivers Headliner's e-mail."""

from infra.http import Network

SEND_LATENCY_MS = 80


class MailRelay:
    def __init__(self, network: Network) -> None:
        self.delivered: list[dict] = []
        network.register("mail_relay", "send", self._send, SEND_LATENCY_MS)

    def delivered_to(self, address: str) -> list[str]:
        """Subjects of the e-mails delivered to address, oldest first."""
        return [mail["subject"] for mail in self.delivered if mail["to"] == address]

    def _send(self, mail: dict) -> dict:
        self.delivered.append(dict(mail))
        return {"queued": True}
