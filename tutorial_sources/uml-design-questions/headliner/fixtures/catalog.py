"""The catalog the devstack starts with: festivals, and what suppliers offer at each."""

from infra.db import Database


def _rows(columns: tuple[str, ...], *rows: tuple) -> list[dict]:
    return [dict(zip(columns, row, strict=True)) for row in rows]


FESTIVALS = _rows(
    ("id", "name", "starts", "sales_open"),
    ("desert-bloom", "Desert Bloom", "2027-04-16T16:00Z", "2026-10-01T17:00Z"),
    ("neon-nights", "Neon Nights", "2027-07-09T14:00Z", "2027-01-15T17:00Z"),
    ("lakeside-fest", "Lakeside Fest", "2027-08-20T12:00Z", "2027-02-01T17:00Z"),
    ("sunset-sessions", "Sunset Sessions", "2027-09-17T15:00Z", "2027-06-11T12:00Z"),
)
LODGING = _rows(
    ("id", "festival_id", "supplier_id", "unit", "check_in", "nights", "nightly_rate"),
    ("nn-glamping-bell", "neon-nights", "glampingco", "Bell tent for two",
     "2027-07-08T15:00Z", 3, 18900),
    ("nn-city-hotel", "neon-nights", "lodging", "Hotel room downtown",
     "2027-07-08T15:00Z", 3, 21900),
    ("lf-glamping-cabin", "lakeside-fest", "glampingco", "Glamping cabin for four",
     "2027-08-19T15:00Z", 3, 29500),
    ("lf-lakeview-lodge", "lakeside-fest", "lodging", "Lakeview lodge for six",
     "2027-08-19T15:00Z", 3, 42000),
    ("lf-lakeshore-campsite", "lakeside-fest", "lodging", "Lakeshore campsite",
     "2027-08-19T15:00Z", 3, 6500),
)
SHUTTLES = _rows(
    ("id", "festival_id", "supplier_id", "route", "departure", "fare"),
    ("nn-downtown-shuttle", "neon-nights", "shuttle", "Downtown to Neon Nights",
     "2027-07-09T10:00Z", 2500),
    ("lf-station-shuttle", "lakeside-fest", "shuttle", "Union Station to Lakeside Fest",
     "2027-08-20T09:00Z", 2500),
    ("lf-vip-shuttle", "lakeside-fest", "vip-shuttle", "VIP lounge to Lakeside Fest",
     "2027-08-20T10:00Z", 8900),
)
EXPERIENCES = _rows(
    ("id", "festival_id", "supplier_id", "name", "unit_price"),
    ("lf-sunrise-yoga", "lakeside-fest", "experiences",
     "Sunrise yoga on the dock", 3500),
    ("lf-silent-disco", "lakeside-fest", "experiences",
     "Silent disco in the pines", 2800),
    ("lf-meet-the-tides", "lakeside-fest", "meet-and-greet",
     "Meet-and-greet: The Tides", 9900),
)


def load_catalog(db: Database) -> None:
    tables = {
        "festivals": FESTIVALS,
        "lodging": LODGING,
        "shuttles": SHUTTLES,
        "experiences": EXPERIENCES,
    }
    for table, rows in tables.items():
        for row in rows:
            db.insert(table, row)
