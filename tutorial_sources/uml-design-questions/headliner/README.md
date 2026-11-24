# Headliner

Headliner sells festival weekends as trip packages: a festival pass, a place to
sleep (a campsite, glamping tent, cabin, or hotel room), shuttle rides, and add-on
experiences such as sunrise yoga or an artist meet-and-greet. Headliner owns none
of these. Suppliers provide them, and a bank handles card payments.

The repository's data covers four festivals: Desert Bloom, Neon Nights, Lakeside
Fest, and Sunset Sessions.

## Services

Headliner's own services live under `services/`:

- Trip Website (`website/`): festival pages, checkout, and My trips for fans.
- Order Processing Center, or OPC (`opc/`): trip-order processing and tracking.
- Notifications (`notifications/`): e-mail to fans.
- Loyalty (`loyalty/`): fans' loyalty points.
- Warehouse ETL (`reporting/`): loads for the reporting warehouse.
- Affiliate Relay (`affiliates/`): commission reporting for influencer partners.
- Support Console (`support_console/`): the support team's web app.
- Shuttle Planner (`shuttle_planner/`): seat counts for each shuttle departure.

Other organizations run the bank's card service, the festival box office, the
lodging provider, the shuttle operator, the experience provider, the mail relay,
and the affiliate partners' webhook. `stubs/` holds deterministic stand-ins for
them.

Shared code lives in `infra/`: calls between services, the message broker,
databases, the clock, and scheduled jobs. Deployment settings live in `deploy/`.

## Running Headliner

Everything runs in one process on the devstack (`devstack.py`), on a fake clock
that starts at 09:00 UTC on June 11, 2027. It needs Python 3.12 and its standard
library; the tests also need pytest. From this folder:

```sh
python3 -m pytest                          # the test suite
python3 -m scenarios.failed_trip           # repro for support ticket SUP-2291
python3 -m scenarios.slow_group_checkout   # repro for ticket PERF-118
```
