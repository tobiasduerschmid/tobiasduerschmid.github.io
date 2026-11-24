"""Message queues and topic exchanges, served by the devstack's message broker."""

import copy
import tomllib
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import NamedTuple

from infra.http import Network, ServiceClient, ServiceUnavailable

SERVICE = "broker"  # the broker's name on the network
CLIENT = "amqp-client"  # how publishers appear in Network.call_log


class BrokerUnavailable(ServiceUnavailable):
    """The message broker could not be reached, so it did not take the message."""


@dataclass(frozen=True)
class Message:
    """A message as its consumer receives it."""

    routing_key: str  # for a message sent straight to a queue: the queue's name
    body: dict


MessageHandler = Callable[[Message], None]


class Binding(NamedTuple):
    """Messages published to exchange go to queue when their key matches pattern."""

    queue: str
    exchange: str
    pattern: str


class _Consumer(NamedTuple):
    component: str
    handler: MessageHandler


def topic_matches(pattern: str, routing_key: str) -> bool:
    """Tell whether a binding pattern matches a routing key of dot-separated words.

    In a pattern, ``*`` matches exactly one word and ``#`` matches zero or more words.
    """
    return _words_match(pattern.split("."), routing_key.split("."))


def _words_match(pattern: list[str], words: list[str]) -> bool:
    if not pattern:
        return not words
    first, rest = pattern[0], pattern[1:]
    if first == "#":
        return any(_words_match(rest, words[skip:]) for skip in range(len(words) + 1))
    if not words:
        return False
    return (first == "*" or first == words[0]) and _words_match(rest, words[1:])


class Broker:
    """The message broker: work queues plus topic exchanges.

    The broker is the ``broker`` service on the network. publish() and send()
    are requests to it, so they raise BrokerUnavailable while it is down.
    Consumers receive messages only when drain() runs.
    """

    def __init__(self, network: Network) -> None:
        self._exchanges: set[str] = set()
        self._queues: dict[str, deque[Message]] = {}
        self._consumers: dict[str, _Consumer] = {}
        self._bindings: list[Binding] = []
        network.register(SERVICE, "publish", self._route)
        network.register(SERVICE, "send", self._enqueue)
        self._client = ServiceClient(SERVICE, network, caller=CLIENT)

    def load_config(self, path: str | Path) -> None:
        """Declare the exchanges, queues, and bindings that a TOML file lists."""
        with open(path, "rb") as file:
            config = tomllib.load(file)
        for exchange in config.get("exchanges", []):
            if exchange["type"] != "topic":
                raise ValueError(f"{exchange['name']} is not a topic exchange")
            self.declare_exchange(exchange["name"])
        for queue in config.get("queues", []):
            self.declare_queue(queue["name"])
        for binding in config.get("bindings", []):
            self.declare_queue(binding["queue"])
            self.bind(binding["queue"], binding["exchange"], binding["pattern"])

    def declare_exchange(self, name: str) -> None:
        """Create a topic exchange, unless it already exists."""
        self._exchanges.add(name)

    def declare_queue(self, name: str) -> None:
        """Create a queue, unless it already exists."""
        self._queues.setdefault(name, deque())

    def bind(self, queue: str, exchange: str, pattern: str) -> None:
        """Give queue a copy of every message on exchange whose key matches pattern."""
        self._require_queue(queue)
        self._require_exchange(exchange)
        binding = Binding(queue, exchange, pattern)
        if binding not in self._bindings:
            self._bindings.append(binding)

    def bindings(self) -> list[Binding]:
        """Every binding, from configuration and from code, in the order made."""
        return list(self._bindings)

    def consume(self, queue: str, handler: MessageHandler, component: str) -> None:
        """Make handler, which runs in component, the consumer of queue."""
        self._require_queue(queue)
        if queue in self._consumers:
            raise ValueError(
                f"{self._consumers[queue].component} already consumes {queue}"
            )
        self._consumers[queue] = _Consumer(component, handler)

    def publish(self, exchange: str, routing_key: str, message: dict) -> None:
        """Publish message; every queue with a matching binding gets its own copy."""
        self._request(
            "publish",
            {"exchange": exchange, "routing_key": routing_key, "message": message},
        )

    def send(self, queue: str, message: dict) -> None:
        """Put message straight onto queue, without an exchange."""
        self._request("send", {"queue": queue, "message": message})

    def drain(self) -> int:
        """Deliver queued messages to their consumers; return how many they handled.

        Each queue delivers in order, including messages queued during the drain.
        A consumer that raises ServiceUnavailable leaves its message at the head of
        its queue, where it waits for a later drain(). Other errors propagate.
        """
        handled = 0
        waiting: set[str] = set()
        while ready := self._ready_queues(waiting):
            for queue in ready:
                if self._deliver_next(queue):
                    handled += 1
                else:
                    waiting.add(queue)
        return handled

    def _ready_queues(self, waiting: set[str]) -> list[str]:
        return [
            queue
            for queue in self._consumers
            if self._queues[queue] and queue not in waiting
        ]

    def _deliver_next(self, queue: str) -> bool:
        consumer, messages = self._consumers[queue], self._queues[queue]
        try:
            consumer.handler(messages[0])
        except ServiceUnavailable:
            return False  # a service the consumer needs is down
        except Exception as error:
            error.add_note(f"while {consumer.component} consumed from {queue}")
            raise
        messages.popleft()
        return True

    def _route(self, request: dict) -> dict:
        exchange, routing_key = request["exchange"], request["routing_key"]
        self._require_exchange(exchange)
        for queue in self._matching_queues(exchange, routing_key):
            self._queues[queue].append(
                Message(routing_key, copy.deepcopy(request["message"]))
            )
        return {}

    def _matching_queues(self, exchange: str, routing_key: str) -> set[str]:
        return {
            binding.queue
            for binding in self._bindings
            if binding.exchange == exchange
            and topic_matches(binding.pattern, routing_key)
        }

    def _enqueue(self, request: dict) -> dict:
        queue = request["queue"]
        self._require_queue(queue)
        self._queues[queue].append(Message(queue, request["message"]))
        return {}

    def _request(self, endpoint: str, payload: dict) -> None:
        try:
            self._client.call(endpoint, payload)
        except ServiceUnavailable as error:
            raise BrokerUnavailable(f"broker is down; {endpoint} failed") from error

    def _require_queue(self, name: str) -> None:
        if name not in self._queues:
            raise LookupError(f"no queue named {name!r}")

    def _require_exchange(self, name: str) -> None:
        if name not in self._exchanges:
            raise LookupError(f"no exchange named {name!r}")
