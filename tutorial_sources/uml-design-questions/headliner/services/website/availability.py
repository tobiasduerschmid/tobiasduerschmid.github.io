"""Room left on the experiences in a cart."""

from services.website.cart import Cart
from services.website.clients import ExperienceClient
from services.website.errors import SoldOut


class AvailabilityGuard:
    """Stops a checkout when an experience in the cart has no room for its guests."""

    def __init__(self, experiences: ExperienceClient) -> None:
        self._experiences = experiences

    def check(self, cart: Cart) -> None:
        for line in cart.lines_of("experience"):
            group_size = len(line.guest_names)
            if not self._experiences.check_capacity(line.offer_id, group_size):
                raise SoldOut(f"{line.offer_id} has no room left for your group.")
