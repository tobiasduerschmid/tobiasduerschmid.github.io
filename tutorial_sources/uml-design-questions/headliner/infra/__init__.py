"""Shared runtime library for Headliner's services.

In production, every service runs on its own machines. For development, tests,
and repro scripts, devstack.py runs them all in one process on top of this
package:

- infra.clock: simulated time.
- infra.http: calls between services by name, with latency and outages.
- infra.broker: work queues and topic exchanges.
- infra.db: table stores, reached by DSN.
- infra.scheduler: recurring jobs.
- infra.subscriptions: consumers that declare their bindings in code.
"""
