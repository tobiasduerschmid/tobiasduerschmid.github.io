"""Write the generated part of the UML design questions tutorial's YAML.

Headliner and the tutorial's diagrams live in tutorial_sources/uml-design-questions.
This script copies them into _data/tutorials/uml-design-questions.yml between the
"# BEGIN GENERATED" and "# END GENERATED" lines and leaves the rest of the file
as its author wrote it:

- shared_files: every Headliner file, read-only so that evidence line numbers hold;
- x-diagrams: each diagram's source under a YAML anchor, such as &d_event_consumers,
  which a challenge step reuses as `source: *d_event_consumers`;
- x-diagram-links: each diagram's code links, from the sidecar next to its source
  (event-consumers.links.yml beside event-consumers.component.uml), under an anchor
  such as &l_event_consumers, which the step reuses as `links: *l_event_consumers`.
  A link is {text, path, line}: double-clicking the label `text` in the drawing
  opens the shared file `path` at `line`.

    python3 scripts/uml_design_questions/build_yaml.py --write   # update the YAML
    python3 scripts/uml_design_questions/build_yaml.py --check   # exit 1 if out of date
"""

import argparse
import json
import re
import sys
from collections.abc import Sequence
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "tutorial_sources/uml-design-questions"
HEADLINER = SOURCES / "headliner"
DIAGRAMS = SOURCES / "diagrams"
TUTORIAL = ROOT / "_data/tutorials/uml-design-questions.yml"

BEGIN = "# BEGIN GENERATED"
END = "# END GENERATED"
NOTICE = (
    "# Written by scripts/uml_design_questions/build_yaml.py from",
    "# tutorial_sources/uml-design-questions. Edit those files, then run it again.",
)
# Editor language and print-view language by file suffix. Monaco 0.44 has no
# TOML grammar, so TOML opens as INI and prints as TOML.
LANGUAGES = {
    ".md": ("markdown", None),
    ".py": ("python", None),
    ".toml": ("ini", "toml"),
}
FILE_INDENT = 4  # column of a shared file's keys, under "  - "
DIAGRAM_INDENT = 2  # column of a diagram's key under x-diagrams


def source_files(headliner: Path) -> list[Path]:
    """Headliner's files in path order, without caches and hidden files."""
    return sorted(
        (
            path
            for path in headliner.rglob("*")
            if path.is_file()
            and not any(
                part.startswith(".") or part == "__pycache__"
                for part in path.relative_to(headliner).parts
            )
        ),
        key=lambda path: path.relative_to(headliner).as_posix(),
    )


def shared_file(relative: str, text: str) -> list[str]:
    """The YAML lines of one read-only shared file."""
    suffix = Path(relative).suffix
    if suffix not in LANGUAGES:
        raise ValueError(f"{relative}: no editor language for {suffix or 'these'} files")
    language, print_language = LANGUAGES[suffix]
    keys = " " * FILE_INDENT
    lines = [f"  - path: {relative}", f"{keys}language: {language}"]
    if print_language:
        lines.append(f"{keys}print_language: {print_language}")
    lines.append(f"{keys}readonly: true")
    return lines + literal_block(f"{keys}content:", text, FILE_INDENT)


def anchor_name(path: Path) -> str:
    """The YAML anchor suffix for a diagram file: event-consumers.* -> event_consumers."""
    name = path.name.split(".")[0].replace("-", "_")
    if not re.fullmatch(r"[a-z][a-z0-9_]*", name):
        raise ValueError(f"{path.name}: cannot name a YAML anchor after this file")
    return name


def diagram_anchor(path: Path) -> list[str]:
    """A diagram's source under a YAML anchor named after its file."""
    name = anchor_name(path)
    text = path.read_text(encoding="utf-8").rstrip("\n")
    key = f"{' ' * DIAGRAM_INDENT}{name}: &d_{name}"
    return literal_block(key, text, DIAGRAM_INDENT)


def links_file(path: Path) -> Path:
    """The code-link sidecar of a diagram: <name>.links.yml beside <name>.<type>.uml."""
    return path.with_name(path.name.split(".")[0] + ".links.yml")


def read_links(sidecar: Path) -> list[dict]:
    """A sidecar's links, each exactly {text, path, line}, in the authored order."""
    links = yaml.safe_load(sidecar.read_text(encoding="utf-8"))
    if not isinstance(links, list):
        raise ValueError(f"{sidecar.name}: expected a list of links")
    for link in links:
        valid = (
            isinstance(link, dict)
            and set(link) == {"text", "path", "line"}
            and isinstance(link["text"], str) and link["text"].strip()
            and isinstance(link["path"], str) and link["path"].strip()
            and isinstance(link["line"], int) and not isinstance(link["line"], bool)
            and link["line"] >= 1
        )
        if not valid:
            raise ValueError(f"{sidecar.name}: each link needs text, path, and a line from 1: {link!r}")
    return links


def links_anchor(path: Path) -> list[str]:
    """A diagram's code links under a YAML anchor, or nothing without a sidecar."""
    sidecar = links_file(path)
    if not sidecar.exists():
        return []
    name = anchor_name(path)
    item = " " * (DIAGRAM_INDENT + 2)
    lines = [f"{' ' * DIAGRAM_INDENT}{name}: &l_{name}"]
    # JSON strings are YAML double-quoted scalars, so any label reads back unchanged.
    for link in read_links(sidecar):
        lines += [
            f"{item}- text: {json.dumps(link['text'], ensure_ascii=False)}",
            f"{item}  path: {json.dumps(link['path'], ensure_ascii=False)}",
            f"{item}  line: {link['line']}",
        ]
    return lines


def literal_block(key: str, text: str, key_indent: int) -> list[str]:
    """`key` followed by text as a YAML literal block that reads back unchanged."""
    if not text:
        return [f'{key} ""']
    trailing = len(text) - len(text.rstrip("\n"))
    chomping = "-" if trailing == 0 else ("" if trailing == 1 else "+")
    body = text.split("\n")
    if trailing:
        body = body[:-1]  # the final line break belongs to the last line
    first = next((line for line in body if line), "")
    # A first line that starts with a blank would set the indentation itself.
    indicator = "2" if first[:1] in (" ", "\t") else ""
    indent = " " * (key_indent + 2)
    return [f"{key} |{indicator}{chomping}"] + [
        f"{indent}{line}" if line else "" for line in body
    ]


def generated_block(headliner: Path, diagrams: Path) -> str:
    lines = [BEGIN, *NOTICE, "shared_files:"]
    for path in source_files(headliner):
        relative = path.relative_to(headliner).as_posix()
        lines += shared_file(relative, path.read_text(encoding="utf-8"))
    lines.append("x-diagrams:")
    for path in sorted(diagrams.glob("*.uml")):
        lines += diagram_anchor(path)
    link_lines = [line for path in sorted(diagrams.glob("*.uml")) for line in links_anchor(path)]
    if link_lines:
        lines += ["x-diagram-links:", *link_lines]
    lines.append(END)
    return "\n".join(lines) + "\n"


def replace_generated(text: str, block: str) -> str:
    """text with the lines from BEGIN through END replaced by block."""
    lines = text.splitlines(keepends=True)
    starts = [i for i, line in enumerate(lines) if line.rstrip("\n") == BEGIN]
    ends = [i for i, line in enumerate(lines) if line.rstrip("\n") == END]
    if len(starts) != 1 or len(ends) != 1 or ends[0] < starts[0]:
        raise ValueError(f'the YAML needs one "{BEGIN}" line before one "{END}" line')
    return "".join(lines[: starts[0]]) + block + "".join(lines[ends[0] + 1:])


def main(
    argv: Sequence[str] | None = None,
    *,
    tutorial: Path = TUTORIAL,
    headliner: Path = HEADLINER,
    diagrams: Path = DIAGRAMS,
) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help=f"update {tutorial}")
    mode.add_argument("--check", action="store_true", help="exit 1 if it is out of date")
    arguments = parser.parse_args(argv)
    current = tutorial.read_text(encoding="utf-8")
    updated = replace_generated(current, generated_block(headliner, diagrams))
    if arguments.check:
        if updated != current:
            print(f"{tutorial} is out of date: run {Path(__file__).name} --write",
                  file=sys.stderr)
            return 1
        return 0
    if updated != current:
        tutorial.write_text(updated, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
