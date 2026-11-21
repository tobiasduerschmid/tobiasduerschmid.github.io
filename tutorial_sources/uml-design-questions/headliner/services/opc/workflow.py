"""The workflow manager: moves queued trip orders and supplier answers along."""

from infra.broker import Message
from services.opc.invoice_task import InvoiceTask
from services.opc.payment_task import PaymentTask
from services.opc.repository import OrderRepository
from services.opc.supplier_task import SupplierOrderTask


class WorkflowManager:
    def __init__(
        self,
        orders: OrderRepository,
        payments: PaymentTask,
        suppliers: SupplierOrderTask,
        invoices: InvoiceTask,
    ) -> None:
        self._orders = orders
        self._payments = payments
        self._suppliers = suppliers
        self._invoices = invoices

    def on_order_received(self, message: Message) -> None:
        order = self._orders.get(message.body["order_id"])
        self._payments.capture(order)
        self._suppliers.place_all(order)

    def on_supplier_answered(self, message: Message) -> None:
        self._invoices.on_answer(message.body)
