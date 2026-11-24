"""The bank's CardService: card checks, captures, and refunds."""

from infra.http import Network

LATENCY_MS = {"validate": 300, "capture": 300, "refund": 300}
DECLINED_CARDS = {"tok_chargeDeclined"}  # the bank's test token for a declined card


class Bank:
    """The card service Headliner charges fans through."""

    def __init__(self, network: Network) -> None:
        self.captures: dict[str, dict] = {}
        self.refunds: list[dict] = []
        handlers = {
            "validate": self._validate,
            "capture": self._capture,
            "refund": self._refund,
        }
        for endpoint, handler in handlers.items():
            network.register("bank", endpoint, handler, LATENCY_MS[endpoint])

    def captured_for(self, reference: str) -> int:
        """The amount captured for a merchant reference, in cents."""
        return sum(
            capture["amount"]
            for capture in self.captures.values()
            if capture["reference"] == reference
        )

    def _validate(self, request: dict) -> dict:
        return {"valid": request["card_token"] not in DECLINED_CARDS}

    def _capture(self, request: dict) -> dict:
        capture_id = f"cap-{len(self.captures) + 1}"
        self.captures[capture_id] = dict(request)
        return {"capture_id": capture_id}

    def _refund(self, request: dict) -> dict:
        self.refunds.append(dict(request))
        return {"refund_id": f"ref-{len(self.refunds)}"}
