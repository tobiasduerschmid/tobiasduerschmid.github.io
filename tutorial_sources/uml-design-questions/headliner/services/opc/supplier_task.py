"""Ordering each item of a trip from its supplier."""

from collections.abc import Callable

from services.opc.gateways.base import SupplierGateway, SupplierUnavailable
from services.opc.model.orders import TripOrder
from services.opc.model.suppliers import SupplierOrder
from services.opc.repository import OrderRepository

RETRY_INTERVAL_S = 60  # how often to resend orders a supplier could not take

GatewayLookup = Callable[[str], SupplierGateway]


class SupplierOrderTask:
    """Splits a trip order into one supplier order per supplier and sends each one."""

    def __init__(self, orders: OrderRepository, gateways: GatewayLookup) -> None:
        self._orders = orders
        self._gateways = gateways

    def place_all(self, order: TripOrder) -> None:
        for supplier_order in split_by_supplier(order):
            self._orders.add_supplier_order(supplier_order)
            self._place(supplier_order)
        order.mark_processing()
        self._orders.save(order)

    def resend_unsent(self) -> None:
        """Send again every order a supplier could not take; runs on a schedule."""
        unsent = self._orders.supplier_orders_where(status="placed", sent=False)
        for supplier_order in unsent:
            self._place(supplier_order)

    def _place(self, supplier_order: SupplierOrder) -> None:
        try:
            self._gateways(supplier_order.supplier_id).place(supplier_order)
        except SupplierUnavailable:
            return  # still unsent; resend_unsent tries again
        self._orders.mark_sent(supplier_order)


def split_by_supplier(order: TripOrder) -> list[SupplierOrder]:
    """One supplier order per supplier, with that supplier's items in order."""
    items_by_supplier: dict[str, list] = {}
    for item in order.items:
        items_by_supplier.setdefault(item.supplier_id, []).append(item)
    return [
        SupplierOrder(supplier_id, order.order_id, items)
        for supplier_id, items in items_by_supplier.items()
    ]
