"""Write the generated part of the UML design questions tutorial's YAML.

Headliner and the tutorial's diagrams live in tutorial_sources/uml-design-questions.
This script copies them into _data/tutorials/uml-design-questions.yml between the
"# BEGIN GENERATED" and "# END GENERATED" lines and leaves the rest of the file
as its author wrote it:

- shared_files: every Headliner file, read-only so that evidence line numbers hold;
- x-diagrams: each diagram's source under a YAML anchor, such as &d_event_consumers,
  which a challenge step reuses as `source: *d_event_consumers`.

    python3 scripts/uml_design_questions/build_yaml.py --write   # update the YAML
    python3 scripts/uml_design_questions/build_yaml.py --check   # exit 1 if out of date
"""

import argparse
import re
import sys
from collections.abc import Sequence
from pathlib import Path

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


def diagram_anchor(path: Path) -> list[str]:
    """A diagram's source under a YAML anchor named after its file."""
    name = path.name.split(".")[0].replace("-", "_")
    if not re.fullmatch(r"[a-z][a-z0-9_]*", name):
        raise ValueError(f"{path.name}: cannot name a YAML anchor after this file")
    text = path.read_text(encoding="utf-8").rstrip("\n")
    key = f"{' ' * DIAGRAM_INDENT}{name}: &d_{name}"
    return literal_block(key, text, DIAGRAM_INDENT)


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
