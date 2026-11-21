"""Starting the OPC: its parts, its endpoints on the network, and its scheduled jobs."""

from dataclasses import dataclass
from functools import partial

from infra.broker import Broker
from infra.clock import Clock
from infra.db import Database
from infra.http import Network, ServiceClient
from infra.scheduler import Scheduler
from services.opc.api import (
    OrderTrackingService,
    PurchaseOrderService,
    SupplierCallbackService,
    endpoints,
)
from services.opc.cancellation_task import CANCEL_INTERVAL_S, CancellationTask
from services.opc.events import TripEvents
from services.opc.gateways.registry import gateway_for
from services.opc.intake import Intake
from services.opc.invoice_task import InvoiceTask
from services.opc.payment_task import PaymentTask
from services.opc.repository import OrderRepository
from services.opc.supplier_task import RETRY_INTERVAL_S, SupplierOrderTask
from services.opc.workflow import WorkflowManager

LATENCY_MS = {"PurchaseOrderService.submit": 200}  # typical response times


@dataclass
class Opc:
    orders: OrderRepository
    workflow: WorkflowManager


def start_opc(
    network: Network,
    broker: Broker,
    scheduler: Scheduler,
    clock: Clock,
    order_db: Database,
) -> Opc:
    """Serve the OPC's endpoints and schedule its jobs. The caller wires its queues."""
    orders = OrderRepository(order_db)
    events = TripEvents(broker)
    gateways = partial(gateway_for, network=network, clock=clock)
    payments = PaymentTask(ServiceClient("bank", network, caller="opc"), orders)
    supplier_orders = SupplierOrderTask(orders, gateways)
    invoices = InvoiceTask(orders, gateways, events)
    cancellations = CancellationTask(orders, payments, gateways, events, clock)
    services = endpoints(
        PurchaseOrderService(Intake(orders, broker), cancellations),
        OrderTrackingService(orders),
        SupplierCallbackService(broker),
    )
    for name, handler in services.items():
        network.register("opc", name, handler, LATENCY_MS.get(name, 0))
    scheduler.every(RETRY_INTERVAL_S, supplier_orders.resend_unsent, "opc-resend")
    scheduler.every(
        CANCEL_INTERVAL_S, cancellations.cancel_supplier_orders, "opc-cancellations"
    )
    return Opc(orders, WorkflowManager(orders, payments, supplier_orders, invoices))
