"""The fan's My trips page."""

from collections.abc import Mapping

from infra.db import connect


class OrderHistoryPage:
    """Lists a fan's trip orders, newest first, with their current status."""

    def __init__(self, settings: Mapping[str, str]) -> None:
        self._orders = connect(settings["ORDER_HISTORY_DSN"])

    def render(self, fan_id: str) -> list[dict]:
        rows = self._orders.find("orders", fan_id=fan_id)
        return [
            {
                "order_id": row["id"],
                "festival_id": row["festival_id"],
                "status": row["status"],
                "total": row["order"]["payment"]["amount"],
            }
            for row in reversed(rows)
        ]
