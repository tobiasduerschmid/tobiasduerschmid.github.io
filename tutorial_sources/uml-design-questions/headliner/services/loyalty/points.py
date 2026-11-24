"""Loyalty points: fans earn one point for each dollar of a confirmed trip."""

from infra.broker import Message

POINTS_PER_DOLLAR = 1


class LoyaltyProgram:
    def __init__(self) -> None:
        self._balances: dict[str, int] = {}

    def on_trip_confirmed(self, message: Message) -> None:
        self.award(message.body["fan_id"], message.body["total"])

    def award(self, fan_id: str, amount_cents: int) -> None:
        points = amount_cents // 100 * POINTS_PER_DOLLAR
        self._balances[fan_id] = self.balance(fan_id) + points

    def balance(self, fan_id: str) -> int:
        return self._balances.get(fan_id, 0)
