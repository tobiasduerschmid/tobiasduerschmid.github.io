"""Starting the stand-ins for every system that another organization runs."""

from collections.abc import Mapping
from dataclasses import dataclass

from infra.clock import FakeClock
from infra.http import Network
from infra.scheduler import Scheduler
from stubs.affiliate_partners import AffiliatePartners
from stubs.bank import Bank
from stubs.box_office import BoxOffice
from stubs.experiences import ExperienceProvider
from stubs.lodging import LodgingProvider
from stubs.mail_relay import MailRelay
from stubs.shuttle import ShuttleProvider


@dataclass
class Stubs:
    bank: Bank
    box_office: BoxOffice
    lodging: LodgingProvider
    shuttle: ShuttleProvider
    experiences: ExperienceProvider
    mail_relay: MailRelay
    affiliate_partners: AffiliatePartners


def start_stubs(
    network: Network,
    scheduler: Scheduler,
    clock: FakeClock,
    decisions: Mapping[str, str],
) -> Stubs:
    """Put every stand-in on the network. decisions: see SupplierSystem."""
    return Stubs(
        bank=Bank(network),
        box_office=BoxOffice(network, scheduler, decisions),
        lodging=LodgingProvider(network, scheduler, decisions),
        shuttle=ShuttleProvider(network, scheduler, decisions),
        experiences=ExperienceProvider(network, scheduler, clock, decisions),
        mail_relay=MailRelay(network),
        affiliate_partners=AffiliatePartners(network),
    )
