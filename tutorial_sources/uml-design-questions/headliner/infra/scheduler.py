"""Recurring jobs that run on the clock."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta

from infra.clock import Clock


@dataclass
class _Job:
    name: str
    interval: timedelta
    fn: Callable[[], object]
    next_run: datetime


class Scheduler:
    """Runs recurring jobs once their time has come.

    Nothing runs by itself: run_due() checks which jobs are due, the way a
    cron daemon wakes up and reads its table.
    """

    def __init__(self, clock: Clock) -> None:
        self._clock = clock
        self._jobs: list[_Job] = []

    def every(self, seconds: float, fn: Callable[[], object], name: str) -> None:
        """Run fn every `seconds`, the first time one interval from now."""
        interval = timedelta(seconds=seconds)
        self._jobs.append(_Job(name, interval, fn, self._clock.now() + interval))

    def run_due(self) -> int:
        """Run each job that is due, once, and return how many ran.

        A job runs again one interval after this run, however late this run was.
        """
        now = self._clock.now()
        due = [job for job in self._jobs if job.next_run <= now]
        for job in due:
            job.next_run = now + job.interval
            try:
                job.fn()
            except Exception as error:
                error.add_note(f"in scheduled job {job.name!r}")
                raise
        return len(due)
