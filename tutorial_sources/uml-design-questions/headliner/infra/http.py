"""Calls between services by name, over the devstack's simulated network."""

from __future__ import annotations

import copy
import tomllib
from collections.abc import Callable
from pathlib import Path
from typing import NamedTuple

from infra.clock import FakeClock

RequestHandler = Callable[[dict], dict]


class ServiceUnavailable(Exception):
    """A service could not be reached."""


class Call(NamedTuple):
    """One request on the network, as recorded in Network.call_log."""

    caller: str
    service: str
    endpoint: str


class _Endpoint(NamedTuple):
    handler: RequestHandler
    latency_ms: int


class Network:
    """The network between services, simulated in one process.

    Every request is recorded in call_log. It fails at once while its service
    is taken down; otherwise it takes the endpoint's latency on the clock.
    """

    def __init__(self, clock: FakeClock) -> None:
        self.call_log: list[Call] = []
        self._clock = clock
        self._services: dict[str, dict[str, _Endpoint]] = {}
        self._down: set[str] = set()

    def register(
        self, service: str, endpoint: str, handler: RequestHandler, latency_ms: int = 0
    ) -> None:
        """Serve endpoint on service; each request to it takes latency_ms."""
        endpoints = self._services.setdefault(service, {})
        if endpoint in endpoints:
            raise ValueError(f"{service} already serves {endpoint!r}")
        endpoints[endpoint] = _Endpoint(handler, latency_ms)

    def take_down(self, service: str) -> None:
        """Start an outage: requests to service fail until restore()."""
        self._require_known(service)
        self._down.add(service)

    def restore(self, service: str) -> None:
        """End an outage started by take_down()."""
        self._require_known(service)
        self._down.discard(service)

    def request(self, caller: str, service: str, endpoint: str, payload: dict) -> dict:
        """Send payload to an endpoint and wait for its response.

        Payload and response cross the network as copies. Errors raised by the
        handler reach the caller unchanged.
        """
        self._require_known(service)
        target = self._services[service].get(endpoint)
        if target is None:
            raise LookupError(f"{service} has no endpoint {endpoint!r}")
        self.call_log.append(Call(caller, service, endpoint))
        if service in self._down:
            raise ServiceUnavailable(f"{service} is unavailable")
        self._clock.advance(target.latency_ms / 1000)
        return copy.deepcopy(target.handler(copy.deepcopy(payload)))

    def _require_known(self, service: str) -> None:
        if service not in self._services:
            raise LookupError(f"no service named {service!r} is on the network")


class ServiceClient:
    """Calls one service by name, on behalf of one caller."""

    def __init__(self, service: str, network: Network, caller: str) -> None:
        self.service = service
        self.caller = caller
        self._network = network

    def call(self, endpoint: str, payload: dict) -> dict:
        """Call an endpoint and return its response.

        Raises ServiceUnavailable while the service is down. The call takes the
        endpoint's latency on the clock, as a remote call takes real time.
        """
        return self._network.request(self.caller, self.service, endpoint, payload)


class ServiceDirectory:
    """Service addresses by name, as listed in deploy/services.toml."""

    def __init__(self, addresses: dict[str, str]) -> None:
        self._addresses = dict(addresses)

    @classmethod
    def from_toml(cls, path: str | Path) -> ServiceDirectory:
        """Read a file whose [internal] and [external] tables map names to addresses."""
        with open(path, "rb") as file:
            config = tomllib.load(file)
        return cls({**config["internal"], **config["external"]})

    def address(self, service: str) -> str:
        """Return the address the named service listens on."""
        if service not in self._addresses:
            raise LookupError(f"{service!r} is not in the service directory")
        return self._addresses[service]
