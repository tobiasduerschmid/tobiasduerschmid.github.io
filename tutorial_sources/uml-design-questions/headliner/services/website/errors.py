"""Why the Trip Website turns a checkout down. Each message is shown to the fan."""


class CheckoutRefused(Exception):
    """A checkout the website will not submit."""


class CardDeclined(CheckoutRefused):
    pass


class SoldOut(CheckoutRefused):
    pass


class NotOnSale(CheckoutRefused):
    pass
