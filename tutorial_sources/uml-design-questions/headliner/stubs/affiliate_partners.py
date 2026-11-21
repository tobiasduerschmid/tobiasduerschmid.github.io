"""The webhook that Headliner's influencer partners receive trip events on."""

from infra.http import Network

WEBHOOK_LATENCY_MS = 150


class AffiliatePartners:
    def __init__(self, network: Network) -> None:
        self.received: list[dict] = []
        network.register(
            "affiliate_partners", "webhook", self._receive, WEBHOOK_LATENCY_MS
        )

    def _receive(self, notification: dict) -> dict:
        self.received.append(dict(notification))
        return {"ok": True}
