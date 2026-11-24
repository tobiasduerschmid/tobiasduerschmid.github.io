"""Tests for the generator that copies Headliner and its diagrams into the tutorial YAML.

The UML design questions tutorial shows one codebase in every step. Its source of
truth is tutorial_sources/uml-design-questions; build_yaml.py writes it into
_data/tutorials/uml-design-questions.yml between two marker comments.
"""

import importlib.util
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "uml_design_questions_build_yaml",
    ROOT / "scripts/uml_design_questions/build_yaml.py",
)
build_yaml = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build_yaml)

HEAD = 'title: "Demo"\n# The author keeps this comment.\nbackend: pyodide\n\n'
TAIL = """
steps:
  - title: "Events"
    diagram_challenge:
      reply:
        diagrams:
          - id: events
            type: component
            source: *d_event_consumers
            links: *l_event_consumers
"""
SOURCES = {
    "README.md": "# Headliner\n\nFestival trips.\n",
    "deploy/broker.toml": '[[bindings]]\nqueue = "loyalty.trips"\npattern = "trip.*"\n',
    "infra/__init__.py": '"""Shared runtime library."""\n',
    "services/opc/intake.py": "def accept(payload):\n    return payload\n",
    # Text a careless emitter would change: leading and trailing blanks, a
    # tab, YAML punctuation, several trailing newlines, and no final newline.
    "services/opc/odd.py": "    indented = 1  \n\tTAB = '#: - [x] {y}'\n\n\n",
    "stubs/no_newline.py": "LAST = 'line'",
}
CACHES = {
    "infra/__pycache__/broker.cpython-312.pyc": "compiled",
    ".pytest_cache/README.md": "cache",
}
DIAGRAM = "@startuml\ncomponent OPC <<BackendService>>\n@enduml\n"
# Labels a careless emitter would mangle: YAML punctuation, a quote, a colon.
LINKS = [
    {"text": "OPC", "path": "services/opc/intake.py", "line": 1},
    {"text": "+place(order)", "path": "services/opc/intake.py", "line": 2},
    {"text": 'po: Say "hi" #1', "path": "deploy/broker.toml", "line": 3},
]


@pytest.fixture
def project(tmp_path):
    headliner = tmp_path / "headliner"
    for path, text in {**SOURCES, **CACHES}.items():
        (headliner / path).parent.mkdir(parents=True, exist_ok=True)
        (headliner / path).write_text(text)
    diagrams = tmp_path / "diagrams"
    diagrams.mkdir()
    (diagrams / "event-consumers.component.uml").write_text(DIAGRAM)
    (diagrams / "event-consumers.links.yml").write_text(yaml.safe_dump(LINKS, sort_keys=False))
    tutorial = tmp_path / "tutorial.yml"
    tutorial.write_text(HEAD + "# BEGIN GENERATED\n# END GENERATED\n" + TAIL)
    return {"tutorial": tutorial, "headliner": headliner, "diagrams": diagrams}


def run(project, mode):
    return build_yaml.main([mode], **project)


def written(project):
    return yaml.safe_load(project["tutorial"].read_text())


def test_generated_block_lists_every_source_file_exactly_once(project):
    assert run(project, "--write") == 0

    paths = [spec["path"] for spec in written(project)["shared_files"]]

    assert paths == sorted(SOURCES)


def test_shared_files_hold_the_exact_source_text_read_only(project):
    run(project, "--write")

    for spec in written(project)["shared_files"]:
        assert spec["content"] == SOURCES[spec["path"]], spec["path"]
        assert spec["readonly"] is True, spec["path"]


def test_toml_files_use_the_ini_editor_language_and_toml_print_language(project):
    run(project, "--write")

    specs = {spec["path"]: spec for spec in written(project)["shared_files"]}

    assert specs["deploy/broker.toml"]["language"] == "ini"
    assert specs["deploy/broker.toml"]["print_language"] == "toml"


def test_python_and_markdown_files_use_their_editor_languages(project):
    run(project, "--write")

    specs = {spec["path"]: spec for spec in written(project)["shared_files"]}

    assert specs["services/opc/intake.py"]["language"] == "python"
    assert specs["README.md"]["language"] == "markdown"
    assert "print_language" not in specs["services/opc/intake.py"]


def test_each_diagram_is_an_anchor_that_challenge_blocks_reference(project):
    run(project, "--write")

    data = written(project)
    [diagram] = data["steps"][0]["diagram_challenge"]["reply"]["diagrams"]

    assert data["x-diagrams"] == {"event_consumers": DIAGRAM.rstrip("\n")}
    assert diagram["source"] == DIAGRAM.rstrip("\n")


def test_each_diagram_s_code_links_are_an_anchor_that_challenge_blocks_reference(project):
    run(project, "--write")

    data = written(project)
    [diagram] = data["steps"][0]["diagram_challenge"]["reply"]["diagrams"]

    assert data["x-diagram-links"] == {"event_consumers": LINKS}
    assert diagram["links"] == LINKS


def test_a_diagram_without_a_links_sidecar_gets_no_links_anchor(project):
    (project["diagrams"] / "outages.component.uml").write_text(DIAGRAM)

    run(project, "--write")

    assert set(written(project)["x-diagram-links"]) == {"event_consumers"}


def test_check_mode_fails_after_a_links_edit(project):
    run(project, "--write")
    edited = [dict(LINKS[0], line=2)] + LINKS[1:]
    (project["diagrams"] / "event-consumers.links.yml").write_text(yaml.safe_dump(edited))

    assert run(project, "--check") == 1


@pytest.mark.parametrize("bad", [
    {"text": "OPC", "path": "services/opc/intake.py"},
    {"text": "OPC", "path": "services/opc/intake.py", "line": "2"},
    {"text": "OPC", "path": "services/opc/intake.py", "line": 0},
    {"text": "", "path": "services/opc/intake.py", "line": 1},
    {"text": "OPC", "path": "services/opc/intake.py", "line": 1, "column": 4},
])
def test_a_malformed_link_is_refused_with_its_file_name(project, bad):
    (project["diagrams"] / "event-consumers.links.yml").write_text(yaml.safe_dump([bad]))

    with pytest.raises(ValueError, match="event-consumers.links.yml"):
        run(project, "--write")


def test_hand_written_yaml_outside_the_markers_is_untouched(project):
    run(project, "--write")

    text = project["tutorial"].read_text()
    before, rest = text.split("# BEGIN GENERATED", 1)
    after = rest.split("# END GENERATED\n", 1)[1]

    assert before == HEAD
    assert after == TAIL


def test_writing_twice_changes_nothing(project):
    run(project, "--write")
    first = project["tutorial"].read_text()

    run(project, "--write")

    assert project["tutorial"].read_text() == first


def test_check_mode_passes_while_the_yaml_matches_the_sources(project):
    run(project, "--write")

    assert run(project, "--check") == 0


def test_check_mode_fails_after_a_source_edit(project):
    run(project, "--write")
    before = project["tutorial"].read_text()
    (project["headliner"] / "services/opc/intake.py").write_text("def accept():\n    pass\n")

    assert run(project, "--check") == 1
    assert project["tutorial"].read_text() == before, "--check never writes"


def test_check_mode_fails_after_a_diagram_edit(project):
    run(project, "--write")
    (project["diagrams"] / "event-consumers.component.uml").write_text("@startuml\n@enduml\n")

    assert run(project, "--check") == 1


def test_a_file_type_without_an_editor_language_is_refused(project):
    (project["headliner"] / "deploy/schema.json").write_text("{}\n")

    with pytest.raises(ValueError, match="deploy/schema.json"):
        run(project, "--write")


def test_a_yaml_file_without_the_markers_is_refused(project):
    project["tutorial"].write_text(HEAD + TAIL)

    with pytest.raises(ValueError, match="BEGIN GENERATED"):
        run(project, "--write")


def test_the_tutorial_yaml_matches_headliner_and_its_diagrams():
    assert build_yaml.main(["--check"]) == 0, (
        "run python3 scripts/uml_design_questions/build_yaml.py --write"
    )
