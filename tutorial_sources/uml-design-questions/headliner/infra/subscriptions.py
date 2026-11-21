"""Consumers that declare their own bindings, with the consumes() decorator."""

from collections.abc import Callable
from typing import NamedTuple

from infra.broker import Broker, MessageHandler


class Subscription(NamedTuple):
    exchange: str
    patterns: tuple[str, ...]


def consumes(
    exchange: str, *patterns: str
) -> Callable[[MessageHandler], MessageHandler]:
    """Make a method consume the messages on exchange whose keys match a pattern."""

    def mark(handler: MessageHandler) -> MessageHandler:
        handler.subscription = Subscription(exchange, patterns)
        return handler

    return mark


def subscribe(
    broker: Broker, consumer: object, *, prefix: str, component: str
) -> dict[str, MessageHandler]:
    """Give each method of consumer marked with consumes() a queue, and bind it.

    The queue for a method that consumes from exchange is named prefix.exchange.
    Returns the handler of each queue, by queue name.
    """
    handlers = {}
    for name in dir(consumer):
        handler = getattr(consumer, name)
        subscription = getattr(handler, "subscription", None)
        if not isinstance(subscription, Subscription):
            continue
        queue = f"{prefix}.{subscription.exchange}"
        broker.declare_queue(queue)
        for pattern in subscription.patterns:
            broker.bind(queue, subscription.exchange, pattern)
        broker.consume(queue, handler, component)
        handlers[queue] = handler
    return handlers
