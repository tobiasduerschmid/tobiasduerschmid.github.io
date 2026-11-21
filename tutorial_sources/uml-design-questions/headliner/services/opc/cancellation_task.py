"""Cancelling trip orders at the fan's request."""

import logging

from infra.clock import Clock
from services.opc.events import TripEvents
from services.opc.gateways.base import SupplierUnavailable
from services.opc.payment_task import PaymentTask
from services.opc.repository import OrderRepository
from services.opc.supplier_task import GatewayLookup

CANCEL_INTERVAL_S = 60  # how often to work through supplier orders being cancelled

log = logging.getLogger(__name__)


class CancellationTask:
    def __init__(
        self,
        orders: OrderRepository,
        payments: PaymentTask,
        gateways: GatewayLookup,
        events: TripEvents,
        clock: Clock,
    ) -> None:
        self._orders = orders
        self._payments = payments
        self._gateways = gateways
        self._events = events
        self._clock = clock

    def cancel(self, order_id: str) -> None:
        """Cancel a trip order; raises ValueError when it can no longer be cancelled."""
        order = self._orders.get(order_id)
        if order.status not in ("processing", "confirmed"):
            raise ValueError(f"{order_id} is {order.status} and cannot be cancelled")
        if self._clock.now() > order.cancellation_deadline():
            raise ValueError(f"{order_id} is past its cancellation deadline")
        self._payments.refund(order)
        order.mark_cancelling()
        self._orders.save(order)
        for supplier_order in order.supplier_orders:
            if supplier_order.status in ("placed", "confirmed"):
                supplier_order.mark_cancelling()
                self._orders.save_supplier_order(supplier_order)

    def cancel_supplier_orders(self) -> None:
        """Cancel every supplier order marked for cancellation; runs on a schedule."""
        for supplier_order in self._orders.supplier_orders_where(status="cancelling"):
            try:
                self._gateways(supplier_order.supplier_id).cancel(supplier_order)
            except SupplierUnavailable:
                continue  # the supplier is unreachable; the next run tries again
            except Exception:
                log.exception("could not cancel %s", supplier_order.supplier_order_id)
                continue
            supplier_order.mark_cancelled()
            self._orders.save_supplier_order(supplier_order)
            self._events.supplier_order_changed(supplier_order)
            self._finish(supplier_order.trip_order_id)

    def _finish(self, order_id: str) -> None:
        order = self._orders.get(order_id)
        if all(s.status in ("cancelled", "rejected") for s in order.supplier_orders):
            order.mark_cancelled()
            self._orders.save(order)
            self._events.cancelled(order)
