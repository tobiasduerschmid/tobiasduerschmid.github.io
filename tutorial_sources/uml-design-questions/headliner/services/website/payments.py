"""Card checks for checkout views."""

import functools
from collections.abc import Callable

from services.website.errors import CardDeclined


def requires_valid_card(view: Callable) -> Callable:
    """Run a checkout view only for a card the bank accepts.

    The view is a method view(controller, fan, cart, card_token), and the
    controller has a BankClient named cards.
    """

    @functools.wraps(view)
    def checked_view(controller, fan, cart, card_token: str):
        if not controller.cards.validate(card_token, amount=0):
            raise CardDeclined("Your card was declined. Please use another card.")
        return view(controller, fan, cart, card_token)

    return checked_view
