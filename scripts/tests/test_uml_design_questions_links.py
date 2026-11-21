"""Code links of the UML design questions tutorial's diagrams.

Each diagram in tutorial_sources/uml-design-questions/diagrams has a sidecar,
<name>.links.yml, that lists the labels a student may double-click to open the
code behind them: {text, path, line}. build_yaml.py copies each list into the
tutorial YAML under an anchor such as &l_event_consumers, which the reply's
diagram uses as `links: *l_event_consumers` next to `source: *d_event_consumers`.

These tests hold every link to its drawing and to Headliner's code: its text is
a label of the diagram, its path is a shared file, its line exists, and that
line names what the label names. scripts/tests/uml-design-questions-diagrams.test.js
checks that each text is exactly one label of the rendered drawing.
"""

import re
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
DIAGRAMS = ROOT / "tutorial_sources/uml-design-questions/diagrams"
HEADLINER = ROOT / "tutorial_sources/uml-design-questions/headliner"
TUTORIAL = yaml.safe_load((ROOT / "_data/tutorials/uml-design-questions.yml").read_text(encoding="utf-8"))
SHARED = {spec["path"]: spec["content"] for spec in TUTORIAL.get("shared_files") or []}
DIAGRAM_FILES = sorted(DIAGRAMS.glob("*.uml"))
MIN_LINKS, MAX_LINKS = 5, 12


def stem(path):
    return path.name.split(".")[0]


def sidecar(diagram):
    return diagram.with_name(stem(diagram) + ".links.yml")


def links_of(diagram):
    path = sidecar(diagram)
    assert path.exists(), f"{diagram.name} has no {path.name}"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert isinstance(data, list), f"{path.name} is a list of links"
    return data


# --- Labels in an ArchUML source ---------------------------------------------------

DECLARATION = re.compile(
    r"^(?:abstract\s+class|class|interface|enum|component|participant|actor|package|box|"
    r"node|database|queue|portin|portout|provide|require)\s+(.+)$")
MESSAGE = re.compile(r"^\S+\s*[-.<>|*o]*[-.][-.<>|*o]*\s*\S+?\s*:\s*(.+)$")
MEMBER = re.compile(r"^([+\-#~])\s*(?:\{\w+\}\s*)*(.+)$")
FRAGMENT = re.compile(r"^(?:loop|alt|else|opt|par|break|critical|group)\s+(\[.+\])$")


def drawn_lines(source):
    """Source lines that draw labels: no @layout block, notes, or markers."""
    in_layout = in_note = False
    for raw in source.splitlines():
        line = raw.strip()
        if line == "@layout":
            in_layout = True
        elif line == "@endlayout":
            in_layout = False
        elif re.match(r"^note\b", line) and not re.search(r"\bnote\b.*:", line):
            in_note = True
        elif line == "end note":
            in_note = False
        elif not (in_layout or in_note or line.startswith("@")):
            yield line


def labels(source):
    """The texts a diagram shows for its elements, members, and messages."""
    found = set()
    for line in drawn_lines(source):
        declared = DECLARATION.match(line)
        if declared:
            rest = re.sub(r"\s+as\s+\w+\s*$", "", declared.group(1).rstrip("{ ").strip())
            rest = re.sub(r"\s*<<[^>]*>>", "", rest).strip()
            found.add(rest.strip('"'))
        member = MEMBER.match(line)
        if member:
            found.add(member.group(1) + member.group(2).strip())
        fragment = FRAGMENT.match(line)
        if fragment:
            found.add(fragment.group(1))
        message = MESSAGE.match(line)
        if message and not declared:
            found.add(message.group(1).strip())
        found.update(re.findall(r'"([^"]+)"', line))
    return found


# --- Identifiers on a code line ------------------------------------------------------

def primary_identifier(text):
    """What a label names: the type of a lifeline `name: Type`, else its first name."""
    lifeline = re.match(r"^[\w\[\]]+\s*:\s*([A-Za-z_]\w*)$", text)
    if lifeline:
        return lifeline.group(1)
    names = re.findall(r"[A-Za-z_][\w.]*\w|[A-Za-z_]", text)
    assert names, f"{text!r} names nothing"
    return names[0]


def normalized(text):
    """Lower case without underscores, so `card_token` and `cardToken` agree."""
    return text.lower().replace("_", "")


ALL_LINKS = [
    pytest.param(diagram, link, id=f"{stem(diagram)}: {link.get('text')}")
    for diagram in DIAGRAM_FILES if sidecar(diagram).exists()
    for link in links_of(diagram)
]


def test_every_diagram_has_between_five_and_twelve_code_links():
    for diagram in DIAGRAM_FILES:
        count = len(links_of(diagram))
        assert MIN_LINKS <= count <= MAX_LINKS, f"{diagram.name}: {count} links"


def test_every_link_has_exactly_a_text_a_path_and_a_line():
    for diagram in DIAGRAM_FILES:
        for link in links_of(diagram):
            assert set(link) == {"text", "path", "line"}, f"{diagram.name}: {link}"
            assert isinstance(link["text"], str) and link["text"].strip() == link["text"] != ""
            assert isinstance(link["line"], int) and not isinstance(link["line"], bool)


def test_link_texts_are_unique_within_a_diagram():
    for diagram in DIAGRAM_FILES:
        texts = [link["text"] for link in links_of(diagram)]
        assert len(texts) == len(set(texts)), f"{diagram.name}: {texts}"


@pytest.mark.parametrize("diagram, link", ALL_LINKS)
def test_each_link_text_is_a_label_of_its_diagram(diagram, link):
    shown = labels(diagram.read_text(encoding="utf-8"))
    assert link["text"] in shown, f"{link['text']!r} is not a label of {diagram.name}"


@pytest.mark.parametrize("diagram, link", ALL_LINKS)
def test_each_link_opens_a_line_of_a_shared_file(diagram, link):
    assert link["path"] in SHARED, f"{link['path']} is not a shared file"
    count = len(SHARED[link["path"]].splitlines())
    assert 1 <= link["line"] <= count, f"{link['path']} has {count} lines, not {link['line']}"


@pytest.mark.parametrize("diagram, link", ALL_LINKS)
def test_each_linked_line_names_what_the_label_names(diagram, link):
    lines = (HEADLINER / link["path"]).read_text(encoding="utf-8").splitlines()
    line = lines[link["line"] - 1]
    name = primary_identifier(link["text"])
    assert normalized(name) in normalized(line), (
        f"{link['path']}:{link['line']} does not name {name!r}: {line.strip()!r}")


def reply_diagrams():
    """Every diagram a reply shows, contrast views included."""
    for step in TUTORIAL.get("steps") or []:
        reply = (step.get("diagram_challenge") or {}).get("reply") or {}
        yield from reply.get("diagrams") or []
        contrast = (reply.get("contrast") or {}).get("diagram")
        if contrast:
            yield contrast


def test_every_reply_diagram_carries_the_links_of_its_source():
    sources = TUTORIAL["x-diagrams"]
    by_source = {text: name for name, text in sources.items()}
    for diagram in reply_diagrams():
        name = by_source.get(diagram["source"])
        assert name, f"{diagram['id']} does not use a generated source"
        expected = links_of(DIAGRAMS / next(p.name for p in DIAGRAM_FILES if stem(p).replace("-", "_") == name))
        assert diagram.get("links") == expected, f"{diagram['id']}: use links: *l_{name}"


# --- The oracle helpers themselves ---------------------------------------------------

def test_labels_reads_names_members_messages_ports_and_guards_but_not_notes_or_layout():
    source = "\n".join([
        "@startuml",
        "participant web: TripWebsite",
        'component OPC <<BackendService>> {',
        '  portin "loyalty.trips" as loyalty_queue',
        "}",
        "abstract class SupplierGateway {",
        "  + {abstract} place(order)",
        "}",
        "web -> po: capture(cardToken, amount)",
        "loop [for each supplier order]",
        "note top of OPC",
        "Hidden note text",
        "end note",
        "@layout",
        "OPC @pos(0, 0)",
        "@endlayout",
        "@enduml",
    ])

    shown = labels(source)

    assert {"web: TripWebsite", "OPC", "loyalty.trips", "SupplierGateway", "+place(order)",
            "capture(cardToken, amount)", "[for each supplier order]"} <= shown
    assert "Hidden note text" not in shown
    assert not any("@pos" in text for text in shown)


def test_primary_identifier_is_a_lifeline_type_or_the_first_name():
    assert primary_identifier("po: PurchaseOrderService") == "PurchaseOrderService"
    assert primary_identifier("supplier[i]: SupplierProvider") == "SupplierProvider"
    assert primary_identifier("capture(cardToken, amount)") == "capture"
    assert primary_identifier("loyalty.trips") == "loyalty.trips"
    assert primary_identifier("Notifications") == "Notifications"
