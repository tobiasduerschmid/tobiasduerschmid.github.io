#!/usr/bin/env python3
"""Audit difficulty coverage in SEBook quiz + flashcard YAML.

Every quiz question (`_data/quizzes/*.yml`) and flashcard card
(`_data/flashcards/*.yml`) must carry a `difficulty:` label with one of the
four values from the quiz-format skill: basic | intermediate | advanced |
expert (lowercase). The label is learner-facing (SEGym difficulty toggles),
so a missing or misspelled value silently drops the item from filtered views.

Deliberately out of scope:
  - `_data/tutorials/*.yml` — tutorial-step quiz difficulty is optional
    authoring metadata (not rendered by the runtime), per the quiz-format
    skill.
  - Aggregator files (those with a top-level `decks:` list) — they contain
    no items of their own.

Usage:
    python3 scripts/audit_difficulty_coverage.py                 # audit everything
    python3 scripts/audit_difficulty_coverage.py --file <path>   # restrict to one file

Exit code is 1 if any item is missing a difficulty or carries an invalid
value, else 0 — safe to wire into CI.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

ROOTS = [Path("_data/quizzes"), Path("_data/flashcards")]
VALID_DIFFICULTIES = {"basic", "intermediate", "advanced", "expert"}


def audit_file(path: Path) -> list[str]:
    data = yaml.safe_load(path.read_text())
    if not isinstance(data, dict) or "decks" in data:
        return []
    items = data.get("questions") or data.get("cards") or []
    violations = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        difficulty = item.get("difficulty")
        label = item.get("id", f"index {index}")
        if difficulty is None:
            violations.append(f"{path} [{label}]: missing difficulty")
        elif difficulty not in VALID_DIFFICULTIES:
            violations.append(f"{path} [{label}]: invalid difficulty {difficulty!r}")
    return violations


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--file", help="restrict the audit to one YAML file")
    args = parser.parse_args(argv)

    files = (
        [Path(args.file)]
        if args.file
        else sorted(f for root in ROOTS for f in root.glob("*.yml"))
    )

    violations = []
    for path in files:
        violations.extend(audit_file(path))

    for line in violations:
        print(line)
    print(
        f"# audit_difficulty_coverage: scanned {len(files)} files, "
        f"{len(violations)} violations",
        file=sys.stderr,
    )
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
