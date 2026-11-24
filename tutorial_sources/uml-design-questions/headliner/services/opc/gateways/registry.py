"""Which gateway serves each supplier, and which service it calls."""

from infra.clock import Clock
from infra.http import Network, ServiceClient
from services.opc.gateways.base import SupplierGateway
from services.opc.gateways.box_office import BoxOfficeGateway
from services.opc.gateways.experiences import ExperienceGateway
from services.opc.gateways.lodging import LodgingGateway
from services.opc.gateways.shuttle import ShuttleGateway
from services.opc.partners.glamping_co import GlampingCoGateway
from services.opc.partners.meet_and_greet import MeetAndGreetGateway
from services.opc.partners.vip_shuttle import VipShuttleGateway

SUPPLIERS: dict[str, tuple[type[SupplierGateway], str]] = {
    "box-office": (BoxOfficeGateway, "box_office"),
    "lodging": (LodgingGateway, "lodging"),
    "glampingco": (GlampingCoGateway, "lodging"),
    "shuttle": (ShuttleGateway, "shuttle"),
    "vip-shuttle": (VipShuttleGateway, "shuttle"),
    "experiences": (ExperienceGateway, "experiences"),
    "meet-and-greet": (MeetAndGreetGateway, "experiences"),
}


def gateway_for(supplier_id: str, network: Network, clock: Clock) -> SupplierGateway:
    """Return the gateway for a supplier, calling its service on the OPC's behalf."""
    if supplier_id not in SUPPLIERS:
        raise LookupError(f"no gateway for supplier {supplier_id!r}")
    gateway_class, service = SUPPLIERS[supplier_id]
    return gateway_class(ServiceClient(service, network, caller="opc"), clock)
