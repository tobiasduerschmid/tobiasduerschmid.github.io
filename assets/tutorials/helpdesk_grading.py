"""Reference package, seeded faults, and behavior checks for the repository-debugging tutorial.

The tutorial's checks call this module from Pyodide. ``check`` exercises the
learner's current package through its public API, independent of any editable
test file. ``suite_detects`` and ``suite_accepts`` judge a learner-written test
file by running it against this reference package, with one seeded fault or
none, and then restore the learner's files.

``REFERENCE`` is the help desk with every bug fixed. Each lesson's starter
package is ``REFERENCE`` with that lesson's fault applied;
scripts/tests/test_repo_debugging_graders.py keeps the YAML in step with it.
"""

import contextlib
import io
from pathlib import Path
import sys

from tutorial_test_grading import check_suite


REFERENCE = {
    "helpdesk/__init__.py": r'''"""Festival Help Desk: tickets for the info tent at a music festival.

Requests enter through api.py, which calls service.py for the rules;
service.py reads and writes tickets through store.py.
"""
from helpdesk.api import create_app

__all__ = ["create_app"]
''',
    "helpdesk/api.py": r'''"""Entry point: routes requests to the service and turns errors into status codes.

Paths look like the real HTTP API, e.g. POST /tickets/3/close {"day": 2}.
"""
import re
import traceback

from helpdesk.errors import Conflict, NotFound, ValidationError
from helpdesk.service import TicketService
from helpdesk.store import TicketStore

STATUS_FOR = {ValidationError: 400, NotFound: 404, Conflict: 409}


class Response:
    def __init__(self, status, json=None):
        self.status = status
        self.json = json

    def __repr__(self):
        return f"Response({self.status}, {self.json!r})"


class App:
    def __init__(self, service):
        self.service = service
        self.routes = [
            ("POST", r"/tickets", self._create),
            ("GET", r"/tickets/(\d+)", self._get),
            ("DELETE", r"/tickets/(\d+)", self._delete),
            ("POST", r"/tickets/(\d+)/replies", self._reply),
            ("POST", r"/tickets/(\d+)/priority", self._priority),
            ("POST", r"/tickets/(\d+)/close", self._close),
            ("POST", r"/tickets/(\d+)/reopen", self._reopen),
            ("GET", r"/queue", self._queue),
        ]

    def get(self, path):
        return self.handle("GET", path, {})

    def post(self, path, body=None):
        return self.handle("POST", path, body or {})

    def delete(self, path):
        return self.handle("DELETE", path, {})

    def handle(self, method, path, body):
        for route_method, pattern, action in self.routes:
            match = re.fullmatch(pattern, path)
            if match and route_method == method:
                try:
                    return action(body, *map(int, match.groups()))
                except tuple(STATUS_FOR) as error:
                    return Response(STATUS_FOR[type(error)], {"error": str(error)})
                except Exception:
                    traceback.print_exc()  # the server log
                    return Response(500, {"error": "internal server error"})
        return Response(404, {"error": f"no route for {method} {path}"})

    def _create(self, body):
        ticket = self.service.create_ticket(body.get("title"), body.get("priority"))
        return Response(201, ticket)

    def _get(self, body, ticket_id):
        return Response(200, self.service.get_ticket(ticket_id))

    def _delete(self, body, ticket_id):
        self.service.delete_ticket(ticket_id)
        return Response(204)

    def _reply(self, body, ticket_id):
        ticket = self.service.add_reply(ticket_id, body.get("author"), body.get("text"))
        return Response(201, ticket)

    def _priority(self, body, ticket_id):
        return Response(200, self.service.set_priority(ticket_id, body.get("priority")))

    def _close(self, body, ticket_id):
        return Response(200, self.service.close_ticket(ticket_id, body.get("day")))

    def _reopen(self, body, ticket_id):
        return Response(200, self.service.reopen_ticket(ticket_id, body.get("day")))

    def _queue(self, body):
        return Response(200, self.service.queue())


def create_app():
    return App(TicketService(TicketStore()))
''',
    "helpdesk/service.py": r'''"""Business rules. Each write loads a ticket, changes that copy, and saves it."""
from helpdesk.errors import Conflict, NotFound
from helpdesk.models import PRIORITY_RANK, REOPEN_WINDOW_DAYS, Ticket
from helpdesk.validation import clean_priority, clean_reply, clean_title


class TicketService:
    def __init__(self, store):
        self.store = store

    def _load(self, ticket_id):
        ticket = self.store.get(ticket_id)
        if ticket is None:
            raise NotFound(f"no ticket {ticket_id}")
        return ticket

    def create_ticket(self, title, priority):
        ticket = Ticket(id=self.store.next_id(), title=clean_title(title),
                        priority=clean_priority(priority))
        self.store.save(ticket)
        return ticket.to_dict()

    def get_ticket(self, ticket_id):
        return self._load(ticket_id).to_dict()

    def delete_ticket(self, ticket_id):
        if not self.store.delete(ticket_id):
            raise NotFound(f"no ticket {ticket_id}")

    def add_reply(self, ticket_id, author, text):
        ticket = self._load(ticket_id)
        ticket.replies.append(clean_reply(author, text))
        self.store.save(ticket)
        return ticket.to_dict()

    def set_priority(self, ticket_id, priority):
        ticket = self._load(ticket_id)
        ticket.priority = clean_priority(priority)
        self.store.save(ticket)
        return ticket.to_dict()

    def close_ticket(self, ticket_id, day):
        ticket = self._load(ticket_id)
        if ticket.status == "closed":
            raise Conflict(f"ticket {ticket_id} is already closed")
        ticket.status = "closed"
        ticket.closed_on = day
        self.store.save(ticket)
        return ticket.to_dict()

    def reopen_ticket(self, ticket_id, day):
        ticket = self._load(ticket_id)
        if ticket.status != "closed":
            raise Conflict(f"ticket {ticket_id} is not closed")
        if day - ticket.closed_on > REOPEN_WINDOW_DAYS:
            raise Conflict(f"ticket {ticket_id} was closed too long ago")
        ticket.status = "open"
        ticket.closed_on = None
        self.store.save(ticket)
        return ticket.to_dict()

    def queue(self):
        waiting = [ticket for ticket in self.store.all() if ticket.status == "open"]
        waiting.sort(key=lambda ticket: (PRIORITY_RANK[ticket.priority], ticket.id))
        return [ticket.to_dict() for ticket in waiting]
''',
    "helpdesk/store.py": r'''"""In-memory storage that behaves like a database table.

get() and all() return copies, the way a database returns rows. Changing a
loaded ticket changes nothing here until the service calls save().
"""
import copy


class TicketStore:
    def __init__(self):
        self._rows = {}
        self._last_id = 0

    def next_id(self):
        self._last_id += 1
        return self._last_id

    def get(self, ticket_id):
        row = self._rows.get(ticket_id)
        return copy.deepcopy(row) if row is not None else None

    def all(self):
        return [copy.deepcopy(row) for row in self._rows.values()]

    def save(self, ticket):
        self._rows[ticket.id] = copy.deepcopy(ticket)

    def delete(self, ticket_id):
        return self._rows.pop(ticket_id, None) is not None
''',
    "helpdesk/validation.py": r'''"""Input rules shared by every write path. Each function returns the cleaned value."""
from helpdesk.errors import ValidationError
from helpdesk.models import PRIORITY_RANK


def clean_title(title):
    if not isinstance(title, str) or not title.strip():
        raise ValidationError("title must contain text")
    return title.strip()


def clean_priority(priority):
    if not isinstance(priority, str) or priority.strip().lower() not in PRIORITY_RANK:
        raise ValidationError(f"priority must be one of: {', '.join(PRIORITY_RANK)}")
    return priority.strip().lower()


def clean_reply(author, text):
    if not isinstance(author, str) or not author.strip():
        raise ValidationError("author must contain text")
    if not isinstance(text, str) or not text.strip():
        raise ValidationError("reply text must contain text")
    return {"author": author.strip(), "text": text.strip()}
''',
    "helpdesk/models.py": r'''"""The ticket record and the constants the README rules refer to."""
from dataclasses import dataclass, field

PRIORITY_RANK = {"urgent": 0, "high": 1, "normal": 2, "low": 3}
REOPEN_WINDOW_DAYS = 7


@dataclass
class Ticket:
    id: int
    title: str
    priority: str
    status: str = "open"
    closed_on: int | None = None
    replies: list = field(default_factory=list)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "priority": self.priority,
            "status": self.status,
            "closed_on": self.closed_on,
            "replies": [dict(reply) for reply in self.replies],
        }
''',
    "helpdesk/errors.py": r'''"""Errors raised by the service. api.py turns each one into a status code."""


class ValidationError(Exception):
    """The request breaks an input rule. (400)"""


class NotFound(Exception):
    """No ticket has that ID. (404)"""


class Conflict(Exception):
    """The request is valid, but not in the ticket's current state. (409)"""
''',
}


# Each fault edits REFERENCE with exact replacements that must match once.
FAULTS = {
    # Lesson 1 mutant: a store that hands out the objects it keeps.
    "live-objects": ("helpdesk/store.py", [
        ("        return copy.deepcopy(row) if row is not None else None\n",
         "        return row\n"),
        ("        return [copy.deepcopy(row) for row in self._rows.values()]\n",
         "        return list(self._rows.values())\n"),
    ]),
    # Lesson 2: a reply is added to the loaded copy but never saved.
    "reply-not-saved": ("helpdesk/service.py", [
        ("        ticket.replies.append(clean_reply(author, text))\n"
         "        self.store.save(ticket)\n",
         "        ticket.replies.append(clean_reply(author, text))\n"),
    ]),
    # Lesson 3: IDs come from the row count, so deletes recycle them.
    "id-from-count": ("helpdesk/store.py", [
        ("        self._rows = {}\n        self._last_id = 0\n",
         "        self._rows = {}\n"),
        ("        self._last_id += 1\n        return self._last_id\n",
         "        return len(self._rows) + 1\n"),
    ]),
    # Lesson 3 mutant: the plausible repair that still recycles the newest ID.
    "id-from-max": ("helpdesk/store.py", [
        ("        self._rows = {}\n        self._last_id = 0\n",
         "        self._rows = {}\n"),
        ("        self._last_id += 1\n        return self._last_id\n",
         "        return max(self._rows, default=0) + 1\n"),
    ]),
    # Lesson 4: both write paths validate the priority but store the raw text.
    "raw-priority": ("helpdesk/service.py", [
        ("        ticket = Ticket(id=self.store.next_id(), title=clean_title(title),\n"
         "                        priority=clean_priority(priority))\n",
         "        clean_priority(priority)\n"
         "        ticket = Ticket(id=self.store.next_id(), title=clean_title(title),\n"
         "                        priority=priority)\n"),
        ("        ticket.priority = clean_priority(priority)\n",
         "        clean_priority(priority)\n        ticket.priority = priority\n"),
    ]),
    # Lesson 4 mutant: creation repaired, priority changes still raw.
    "raw-priority-change": ("helpdesk/service.py", [
        ("        ticket.priority = clean_priority(priority)\n",
         "        clean_priority(priority)\n        ticket.priority = priority\n"),
    ]),
    # Lesson 5: the reopen window check is inverted.
    "reopen-inverted": ("helpdesk/service.py", [
        ("        if day - ticket.closed_on > REOPEN_WINDOW_DAYS:\n",
         "        if day - ticket.closed_on <= REOPEN_WINDOW_DAYS:\n"),
    ]),
    # Lesson 5: Assistant A negates <= as >=, which also rejects day 7.
    "patch-a": ("helpdesk/service.py", [
        ("        if day - ticket.closed_on > REOPEN_WINDOW_DAYS:\n",
         "        if day - ticket.closed_on >= REOPEN_WINDOW_DAYS:\n"),
    ]),
    # Lesson 5: Assistant B's rewrite drops the save.
    "patch-b": ("helpdesk/service.py", [
        ("        if day - ticket.closed_on > REOPEN_WINDOW_DAYS:\n"
         "            raise Conflict(f\"ticket {ticket_id} was closed too long ago\")\n"
         "        ticket.status = \"open\"\n"
         "        ticket.closed_on = None\n"
         "        self.store.save(ticket)\n",
         "        days_closed = day - ticket.closed_on\n"
         "        if days_closed > REOPEN_WINDOW_DAYS:\n"
         "            raise Conflict(f\"ticket {ticket_id} was closed too long ago\")\n"
         "        ticket.status, ticket.closed_on = \"open\", None\n"),
    ]),
    # Lesson 6: validation accepts any non-empty priority.
    "any-priority": ("helpdesk/validation.py", [
        ("    if not isinstance(priority, str) or priority.strip().lower() not in PRIORITY_RANK:\n",
         "    if not isinstance(priority, str) or not priority.strip():\n"),
    ]),
    # Lesson 6 mutant: an unknown priority crashes instead of returning 400.
    "unknown-priority-crashes": ("helpdesk/validation.py", [
        ("        raise ValidationError(f\"priority must be one of: {', '.join(PRIORITY_RANK)}\")\n",
         "        raise KeyError(priority)\n"),
    ]),
    # Lesson 7: the teammate's queue cache is not cleared when a ticket closes.
    "queue-cache-stale": ("helpdesk/service.py", [
        ("        ticket.closed_on = day\n"
         "        self.store.save(ticket)\n"
         "        self._changed()\n",
         "        ticket.closed_on = day\n"
         "        self.store.save(ticket)\n"),
    ], "queue-cache"),
}

# Correct alternatives, written as the same kind of edits. Learner tests must
# accept them, so a test that rejects correct code cannot earn credit.
VARIANTS = {
    # Lesson 3: a store whose IDs start at 101; rule 2 promises no first number.
    "ids-from-101": ("helpdesk/store.py", [
        ("        self._last_id = 0\n", "        self._last_id = 100\n"),
    ]),
    # Lesson 5: Assistant C keeps B's rewrite but also keeps the save.
    "patch-c": ("helpdesk/service.py", [
        ("        if day - ticket.closed_on > REOPEN_WINDOW_DAYS:\n"
         "            raise Conflict(f\"ticket {ticket_id} was closed too long ago\")\n"
         "        ticket.status = \"open\"\n"
         "        ticket.closed_on = None\n",
         "        days_closed = day - ticket.closed_on\n"
         "        if days_closed > REOPEN_WINDOW_DAYS:\n"
         "            raise Conflict(f\"ticket {ticket_id} was closed too long ago\")\n"
         "        ticket.status, ticket.closed_on = \"open\", None\n"),
    ]),
    # Lesson 7: a teammate's cache for GET /queue, cleared after every write.
    "queue-cache": ("helpdesk/service.py", [
        ('"""Business rules. Each write loads a ticket, changes that copy, and saves it."""\n',
         '"""Business rules. Each write loads a ticket, changes that copy, and saves it."""\n'
         "import copy\n\n"),
        ("        self.store = store\n",
         "        self.store = store\n"
         "        self._queue = None  # the info tent screen polls GET /queue\n\n"
         "    def _changed(self):\n"
         "        \"\"\"Forget the cached queue after any write.\"\"\"\n"
         "        self._queue = None\n"),
        ("                        priority=clean_priority(priority))\n"
         "        self.store.save(ticket)\n",
         "                        priority=clean_priority(priority))\n"
         "        self.store.save(ticket)\n"
         "        self._changed()\n"),
        ("            raise NotFound(f\"no ticket {ticket_id}\")\n\n    def add_reply",
         "            raise NotFound(f\"no ticket {ticket_id}\")\n"
         "        self._changed()\n\n    def add_reply"),
        ("        ticket.replies.append(clean_reply(author, text))\n"
         "        self.store.save(ticket)\n",
         "        ticket.replies.append(clean_reply(author, text))\n"
         "        self.store.save(ticket)\n"
         "        self._changed()\n"),
        ("        ticket.priority = clean_priority(priority)\n"
         "        self.store.save(ticket)\n",
         "        ticket.priority = clean_priority(priority)\n"
         "        self.store.save(ticket)\n"
         "        self._changed()\n"),
        ("        ticket.closed_on = day\n"
         "        self.store.save(ticket)\n",
         "        ticket.closed_on = day\n"
         "        self.store.save(ticket)\n"
         "        self._changed()\n"),
        ("        ticket.closed_on = None\n"
         "        self.store.save(ticket)\n",
         "        ticket.closed_on = None\n"
         "        self.store.save(ticket)\n"
         "        self._changed()\n"),
        ("    def queue(self):\n"
         "        waiting = [ticket for ticket in self.store.all() if ticket.status == \"open\"]\n"
         "        waiting.sort(key=lambda ticket: (PRIORITY_RANK[ticket.priority], ticket.id))\n"
         "        return [ticket.to_dict() for ticket in waiting]\n",
         "    def queue(self):\n"
         "        if self._queue is None:\n"
         "            waiting = [ticket for ticket in self.store.all() if ticket.status == \"open\"]\n"
         "            waiting.sort(key=lambda ticket: (PRIORITY_RANK[ticket.priority], ticket.id))\n"
         "            self._queue = [ticket.to_dict() for ticket in waiting]\n"
         "        return copy.deepcopy(self._queue)\n"),
    ]),
}


def _edited(table, name):
    """Apply one named entry's exact edits to REFERENCE, or to its base variant."""
    path, edits, *base = table[name]
    source = variant_source(base[0])[1] if base else REFERENCE[path]
    for old, new in edits:
        assert source.count(old) == 1, f"{name}: expected one match for {old!r}"
        source = source.replace(old, new)
    return path, source


def faulty(name):
    """Return ``(path, source)`` for one named fault."""
    return _edited(FAULTS, name)


def variant_source(name):
    """Return ``(path, source)`` for one named correct variant."""
    return _edited(VARIANTS, name)


def _module_name(path):
    return path[:-len(".py")].replace("/", ".").removesuffix(".__init__")


def _forget_workspace_modules():
    """Drop cached package and test modules so the next import reads the files."""
    for name in list(sys.modules):
        if name == "helpdesk" or name.startswith(("helpdesk.", "test_")):
            del sys.modules[name]


@contextlib.contextmanager
def pinned(directory, sources):
    """Temporarily replace package files with ``sources``; always restore them."""
    root = Path(directory)
    saved = {}
    try:
        for path, source in sources.items():
            target = root / path
            saved[target] = target.read_text() if target.exists() else None
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(source)
        _forget_workspace_modules()
        yield
    finally:
        for target, original in saved.items():
            if original is None:
                target.unlink(missing_ok=True)
            else:
                target.write_text(original)
        _forget_workspace_modules()


def _judge_suite(test_file, fault=None, variant=None, test_name=None):
    directory = Path(test_file).parent
    if fault:
        path, source = faulty(fault)
    elif variant:
        path, source = variant_source(variant)
    else:
        path, source = "helpdesk/service.py", REFERENCE["helpdesk/service.py"]
    with pinned(directory, REFERENCE):
        check_suite(test_file, _module_name(path), replacement_source=source,
                    expect_failure=fault is not None, test_name=test_name)


def suite_detects(test_file, fault, test_name=None):
    """The learner's tests (or one named test) fail, by assertion, on ``fault``."""
    _judge_suite(test_file, fault=fault, test_name=test_name)


def suite_accepts(test_file, variant=None, test_name=None):
    """The learner's tests pass on REFERENCE, or on one correct variant."""
    _judge_suite(test_file, variant=variant, test_name=test_name)


def fresh_app(directory):
    """Import the learner's current package from ``directory`` and build an app."""
    sys.dont_write_bytecode = True
    _forget_workspace_modules()
    location = str(Path(directory))
    if location in sys.path:
        sys.path.remove(location)
    sys.path.insert(0, location)
    from helpdesk.api import create_app
    return create_app()


# ---- Behavior rules, one README promise each --------------------------------

def _create(app, title="Lost wristband", priority="normal"):
    response = app.post("/tickets", {"title": title, "priority": priority})
    assert response.status == 201, f"creating a ticket returned {response}"
    return response.json


def _fetch(app, ticket):
    response = app.get(f"/tickets/{ticket['id']}")
    assert response.status == 200, f"fetching ticket {ticket['id']} returned {response}"
    return response.json


def _close(app, ticket, day):
    return app.post(f"/tickets/{ticket['id']}/close", {"day": day})


def _reopen(app, ticket, day):
    return app.post(f"/tickets/{ticket['id']}/reopen", {"day": day})


def _queue_ids(app):
    response = app.get("/queue")
    assert response.status == 200, f"GET /queue returned {response}"
    return [ticket["id"] for ticket in response.json]


def tickets_are_created_and_fetched(app):
    ticket = _create(app, "  Lost wristband  ", "low")
    expected = {"title": "Lost wristband", "priority": "low", "status": "open",
                "closed_on": None, "replies": []}
    assert {key: ticket.get(key) for key in expected} == expected, ticket
    assert _fetch(app, ticket) == ticket
    assert app.post("/tickets", {"title": "   ", "priority": "low"}).status == 400


def unknown_ids_are_404(app):
    assert app.get("/tickets/99").status == 404
    assert app.delete("/tickets/99").status == 404
    assert app.post("/tickets/99/replies", {"author": "Sam", "text": "Hi"}).status == 404


def deleted_ticket_is_gone(app):
    ticket = _create(app)
    assert app.delete(f"/tickets/{ticket['id']}").status == 204
    assert app.get(f"/tickets/{ticket['id']}").status == 404
    assert app.delete(f"/tickets/{ticket['id']}").status == 404


def new_ticket_never_overwrites(app):
    first = _create(app, "Lost wristband")
    second = _create(app, "Locker key")
    assert app.delete(f"/tickets/{first['id']}").status == 204
    third = _create(app, "Water refill map")
    assert _fetch(app, second)["title"] == "Locker key"
    assert third["id"] not in (first["id"], second["id"])


def ids_never_reused_after_deleting_newest(app):
    first = _create(app, "Lost wristband")
    second = _create(app, "Locker key")
    assert app.delete(f"/tickets/{second['id']}").status == 204
    third = _create(app, "Water refill map")
    assert third["id"] not in (first["id"], second["id"]), (first, second, third)
    assert app.delete(f"/tickets/{first['id']}").status == 204
    assert app.delete(f"/tickets/{third['id']}").status == 204
    fourth = _create(app, "Shuttle times")
    assert fourth["id"] not in (first["id"], second["id"], third["id"]), fourth


def priority_is_lowercased_on_create(app):
    ticket = _create(app, "Shuttle times", "High")
    assert ticket["priority"] == "high", ticket
    assert _fetch(app, ticket)["priority"] == "high"


def priority_is_lowercased_on_change(app):
    ticket = _create(app, "Shuttle times", "low")
    response = app.post(f"/tickets/{ticket['id']}/priority", {"priority": "URGENT"})
    assert response.status == 200, response
    assert response.json["priority"] == "urgent", response
    assert _fetch(app, ticket)["priority"] == "urgent"


def priority_is_stored_lowercase(app):
    ticket = _create(app, "Shuttle times", "High")
    assert app.service.store.get(ticket["id"]).priority == "high"
    assert app.post(f"/tickets/{ticket['id']}/priority", {"priority": "URGENT"}).status == 200
    assert app.service.store.get(ticket["id"]).priority == "urgent"


def unknown_priority_is_rejected(app):
    for priority in ("asap", "ASAP", "", None):
        response = app.post("/tickets", {"title": "Stage lights", "priority": priority})
        assert response.status == 400, (priority, response)
    ticket = _create(app, "Stage lights", "normal")
    response = app.post(f"/tickets/{ticket['id']}/priority", {"priority": "whenever"})
    assert response.status == 400, response
    assert _fetch(app, ticket)["priority"] == "normal"


def queue_handles_mixed_case(app):
    low = _create(app, "Merch question", "low")
    high = _create(app, "Shuttle times", "High")
    urgent = _create(app, "Medical tent", "URGENT")
    assert _queue_ids(app) == [urgent["id"], high["id"], low["id"]]


def queue_orders_by_priority_then_age(app):
    low = _create(app, "Merch question", "low")
    urgent = _create(app, "Medical tent", "urgent")
    normal = _create(app, "Locker key", "normal")
    later_urgent = _create(app, "Lost phone", "urgent")
    assert _queue_ids(app) == [urgent["id"], later_urgent["id"], normal["id"], low["id"]]


def queue_tracks_every_change(app):
    """Each write shows up in the queue, even right after the queue was viewed."""
    first = _create(app, "Locker key", "normal")
    assert _queue_ids(app) == [first["id"]]
    second = _create(app, "Medical tent", "low")
    assert _queue_ids(app) == [first["id"], second["id"]]
    assert app.post(f"/tickets/{second['id']}/priority", {"priority": "urgent"}).status == 200
    assert _queue_ids(app) == [second["id"], first["id"]]
    assert _close(app, second, 2).status == 200
    assert _queue_ids(app) == [first["id"]]
    assert app.delete(f"/tickets/{first['id']}").status == 204
    assert _queue_ids(app) == []


def closed_tickets_leave_queue(app):
    stays = _create(app, "Locker key", "normal")
    leaves = _create(app, "Medical tent", "urgent")
    assert _close(app, leaves, 2).status == 200
    assert _queue_ids(app) == [stays["id"]]


def reply_is_returned(app):
    ticket = _create(app)
    response = app.post(f"/tickets/{ticket['id']}/replies", {"author": " Sam ", "text": " On it! "})
    assert response.status == 201, response
    assert response.json["replies"] == [{"author": "Sam", "text": "On it!"}], response


def reply_survives_reload(app):
    ticket = _create(app)
    for author, text in (("Sam", "On it!"), ("Priya", "Found it at the merch tent.")):
        assert app.post(f"/tickets/{ticket['id']}/replies",
                        {"author": author, "text": text}).status == 201
    assert _fetch(app, ticket)["replies"] == [
        {"author": "Sam", "text": "On it!"},
        {"author": "Priya", "text": "Found it at the merch tent."},
    ]


def blank_reply_is_rejected(app):
    ticket = _create(app)
    response = app.post(f"/tickets/{ticket['id']}/replies", {"author": "Sam", "text": "   "})
    assert response.status == 400, response
    assert _fetch(app, ticket)["replies"] == []


def close_is_saved(app):
    ticket = _create(app)
    response = _close(app, ticket, 2)
    assert response.status == 200, response
    assert (response.json["status"], response.json["closed_on"]) == ("closed", 2), response
    stored = _fetch(app, ticket)
    assert (stored["status"], stored["closed_on"]) == ("closed", 2), stored


def closing_twice_is_conflict(app):
    ticket = _create(app)
    assert _close(app, ticket, 2).status == 200
    assert _close(app, ticket, 5).status == 409
    assert _fetch(app, ticket)["closed_on"] == 2


def reopen_allowed_through_day_seven(app):
    ticket = _create(app)
    assert _close(app, ticket, 2).status == 200
    response = _reopen(app, ticket, 9)
    assert response.status == 200, response
    assert response.json["status"] == "open", response


def reopen_rejected_after_day_seven(app):
    ticket = _create(app)
    assert _close(app, ticket, 2).status == 200
    assert _reopen(app, ticket, 10).status == 409
    stored = _fetch(app, ticket)
    assert (stored["status"], stored["closed_on"]) == ("closed", 2), stored


def reopen_is_saved(app):
    ticket = _create(app)
    assert _close(app, ticket, 2).status == 200
    assert _reopen(app, ticket, 4).status == 200
    stored = _fetch(app, ticket)
    assert (stored["status"], stored["closed_on"]) == ("open", None), stored
    assert _close(app, ticket, 5).status == 200


def reopening_open_ticket_is_conflict(app):
    ticket = _create(app)
    assert _reopen(app, ticket, 3).status == 409


def store_hands_out_copies(app):
    from helpdesk.models import Ticket
    from helpdesk.store import TicketStore
    store = TicketStore()
    store.save(Ticket(id=1, title="Lost wristband", priority="normal"))
    loaded = store.get(1)
    loaded.title = "Changed"
    loaded.replies.append({"author": "Sam", "text": "Hi"})
    store.all()[0].status = "closed"
    again = store.get(1)
    assert (again.title, again.replies, again.status) == ("Lost wristband", [], "open")


RULES = {rule.__name__: rule for rule in (
    tickets_are_created_and_fetched, unknown_ids_are_404, deleted_ticket_is_gone,
    new_ticket_never_overwrites, ids_never_reused_after_deleting_newest,
    priority_is_lowercased_on_create, priority_is_lowercased_on_change,
    priority_is_stored_lowercase, unknown_priority_is_rejected,
    queue_handles_mixed_case, queue_orders_by_priority_then_age,
    queue_tracks_every_change, closed_tickets_leave_queue,
    reply_is_returned, reply_survives_reload, blank_reply_is_rejected,
    close_is_saved, closing_twice_is_conflict, reopen_allowed_through_day_seven,
    reopen_rejected_after_day_seven, reopen_is_saved,
    reopening_open_ticket_is_conflict, store_hands_out_copies,
)}


def check(directory, *names):
    """Run the named rules, each on a freshly imported app."""
    for name in names:
        rule = RULES[name]
        app = fresh_app(directory)
        # A 500 prints a traceback; the failed assertion already reports it.
        with contextlib.redirect_stderr(io.StringIO()):
            rule(app)


def check_all_except(directory, *names):
    """Run every rule not already reported by a lesson's own checks."""
    unknown = set(names) - set(RULES)
    assert not unknown, f"unknown rules: {sorted(unknown)}"
    check(directory, *(name for name in RULES if name not in names))
