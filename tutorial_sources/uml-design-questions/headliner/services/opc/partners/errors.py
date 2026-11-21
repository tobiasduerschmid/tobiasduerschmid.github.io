"""Errors that partner gateways raise."""


class ManualCancellationRequired(Exception):
    """The partner takes this cancellation only from a person, by phone or e-mail."""
