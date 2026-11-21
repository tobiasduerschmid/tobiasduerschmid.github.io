"""Supplier answers: record each one, then settle the trip order once all are in."""

from services.opc.events import TripEvents
from services.opc.model.suppliers import SupplierOrder
from services.opc.repository import OrderRepository
from services.opc.supplier_task import GatewayLookup


class InvoiceTask:
    def __init__(
        self, orders: OrderRepository, gateways: GatewayLookup, events: TripEvents
    ) -> None:
        self._orders = orders
        self._gateways = gateways
        self._events = events

    def on_answer(self, answer: dict) -> None:
        """Handle a supplier's answer: {"supplier_order_id", "decision", "invoice"}."""
        supplier_order = self._orders.supplier_order(answer["supplier_order_id"])
        if supplier_order.status != "placed":
            return  # answered before, or cancelled meanwhile
        if answer["decision"] == "confirm":
            gateway = self._gateways(supplier_order.supplier_id)
            supplier_order.confirm(gateway.parse_invoice(answer["invoice"]))
        else:
            supplier_order.reject()
        self._orders.save_supplier_order(supplier_order)
        self._events.supplier_order_changed(supplier_order)
        self._settle(supplier_order)

    def _settle(self, supplier_order: SupplierOrder) -> None:
        order = self._orders.get(supplier_order.trip_order_id)
        if order.status != "processing":
            return
        if supplier_order.status == "rejected":
            order.mark_failed()
            self._orders.save(order)
            self._events.failed(order)
        elif all(s.status == "confirmed" for s in order.supplier_orders):
            order.mark_confirmed()
            self._orders.save(order)
            self._events.confirmed(order)
