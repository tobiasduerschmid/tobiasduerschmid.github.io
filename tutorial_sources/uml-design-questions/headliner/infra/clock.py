"""The clock that services read the time from."""

from datetime import datetime, timedelta
from typing import Protocol


class Clock(Protocol):
    """Anything that can tell the current time."""

    def now(self) -> datetime: ...


class FakeClock(Clock):
    """Simulated time. It moves only when advanced, so every run sees the same times."""

    def __init__(self, start: datetime) -> None:
        if start.tzinfo is None:
            raise ValueError("FakeClock needs a timezone-aware start time")
        self._now = start

    def now(self) -> datetime:
        return self._now

    def advance(self, seconds: float) -> None:
        """Move time forward, as waiting or a slow remote call would."""
        if seconds < 0:
            raise ValueError("time cannot move backwards")
        self._now += timedelta(seconds=seconds)
