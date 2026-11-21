"""Shuttle Planner: how many seats each shuttle departure needs."""

from collections import Counter

from infra.broker import Message


class ShuttlePlanner:
    def __init__(self) -> None:
        self._seats: Counter[tuple[str, str]] = Counter()  # (route, departure) -> seats

    def on_supplier_event(self, message: Message) -> None:
        status = message.routing_key.rsplit(".", 1)[-1]
        for ride in message.body["items"]:
            seats = len(ride["attendees"])
            if status == "confirmed":
                self.book_seats(ride["route"], ride["departure"], seats)
            elif status == "cancelled":
                self.release_seats(ride["route"], ride["departure"], seats)

    def book_seats(self, route: str, departure: str, seats: int) -> None:
        self._seats[route, departure] += seats

    def release_seats(self, route: str, departure: str, seats: int) -> None:
        self._seats[route, departure] -= seats

    def seats_booked(self, route: str, departure: str) -> int:
        return self._seats[route, departure]
