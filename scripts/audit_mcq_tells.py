#!/usr/bin/env python3
"""Audit MCQ "tells" in SEBook + tutorial quiz YAML.

Two test-wiseness patterns let a student pick the right answer without knowing
the material. This script flags both:

  1. LENGTH TELL — the correct option's visible length is >= LENGTH_RATIO_THRESHOLD
     times the *median* of the wrong options, AND the absolute gap is >=
     LENGTH_ABS_GAP_MIN characters. The absolute gap filter avoids noise on
     very short options where ratios swing wildly.

  2. BOLD TELL — at least one correct option contains **bold** markdown and
     *no* wrong option contains bold. (Italic and inline code are also tells
     in principle, but bold is the one we keep accidentally using as visual
     emphasis on the "right" answer, so we flag it specifically.)

The fix is almost always to *shorten the correct option* (move qualifying
parentheticals into `option_feedback` / `explanation`) and strip the emphasis,
not to pad the distractors. Padding distractors makes the quiz tedious and
dilutes the misconception each one is meant to encode. See the project's
quiz-format skill for the full rule.

Usage:
    python3 scripts/audit_mcq_tells.py                     # CSV to stdout, summary to stderr
    python3 scripts/audit_mcq_tells.py --summary-only      # just the summary
    python3 scripts/audit_mcq_tells.py --top 20            # 20 worst length-ratio hits
    python3 scripts/audit_mcq_tells.py --file <path.yml>   # restrict to one file

Exit code is always 0 (report-only). Promote to non-zero once the backlog is fixed.
"""

from __future__ import annotations

import argparse
import csv
import re
import statistics
import sys
from pathlib import Path

import yaml

ROOTS = [Path("_data/quizzes"), Path("_data/tutorials")]
BOLD_RE = re.compile(r"\*\*(?!\s)([^*]+?)\*\*")

LENGTH_RATIO_THRESHOLD = 1.8
LENGTH_ABS_GAP_MIN = 20
MIN_WRONG_OPTIONS = 2


def visible_length(s) -> int:
    if s is None:
        return 0
    return len(str(s).strip())


def has_bold(s) -> bool:
    return bool(BOLD_RE.search(str(s)))


def iter_quiz_questions(data):
    """Yield (question_dict, location_str) for every MCQ in the YAML.

    Handles both standalone quizzes (top-level `questions:`) and tutorial
    quizzes nested under `steps[*].quiz.questions`.
    """
    if not isinstance(data, dict):
        return

    if isinstance(data.get("questions"), list):
        for i, q in enumerate(data["questions"]):
            if isinstance(q, dict):
                qid = q.get("id", i + 1)
                yield q, f"questions[{i}] (id={qid})"

    steps = data.get("steps")
    if isinstance(steps, list):
        for si, step in enumerate(steps):
            if not isinstance(step, dict):
                continue
            step_id = step.get("id", si)
            quiz = step.get("quiz")
            if isinstance(quiz, dict) and isinstance(quiz.get("questions"), list):
                for qi, q in enumerate(quiz["questions"]):
                    if isinstance(q, dict):
                        qid = q.get("id", qi + 1)
                        yield q, f"steps[{step_id}].quiz.questions[{qi}] (id={qid})"


def analyze_question(q: dict):
    qtype = q.get("type", "single")
    if qtype == "parsons":
        return None
    options = q.get("options")
    if not isinstance(options, list) or len(options) < 3:
        return None

    if qtype == "single":
        ci = q.get("correct_index")
        if not isinstance(ci, int) or not (0 <= ci < len(options)):
            return None
        correct_indices = {ci}
    elif qtype == "multiple":
        ci = q.get("correct_indices") or []
        if not isinstance(ci, list) or not ci:
            return None
        correct_indices = {i for i in ci if isinstance(i, int) and 0 <= i < len(options)}
        if not correct_indices:
            return None
    else:
        return None

    correct_opts = [options[i] for i in correct_indices]
    wrong_opts = [opt for i, opt in enumerate(options) if i not in correct_indices]
    if len(wrong_opts) < MIN_WRONG_OPTIONS or not correct_opts:
        return None

    correct_lens = [visible_length(o) for o in correct_opts]
    wrong_lens = [visible_length(o) for o in wrong_opts]
    max_correct = max(correct_lens)
    median_wrong = statistics.median(wrong_lens)

    length_tell = False
    length_ratio = None
    if median_wrong > 0:
        length_ratio = max_correct / median_wrong
        if length_ratio >= LENGTH_RATIO_THRESHOLD and (max_correct - median_wrong) >= LENGTH_ABS_GAP_MIN:
            length_tell = True

    correct_has_bold = any(has_bold(o) for o in correct_opts)
    wrong_has_bold = any(has_bold(o) for o in wrong_opts)
    bold_tell = correct_has_bold and not wrong_has_bold

    if not (length_tell or bold_tell):
        return None

    return {
        "type": qtype,
        "n_options": len(options),
        "n_correct": len(correct_opts),
        "max_correct_len": max_correct,
        "median_wrong_len": int(median_wrong),
        "length_ratio": round(length_ratio, 2) if length_ratio else None,
        "length_tell": length_tell,
        "bold_tell": bold_tell,
        "question_preview": (q.get("question") or "")[:80].replace("\n", " "),
    }


def scan(paths):
    rows = []
    scanned = 0
    for path in paths:
        if "_old" in path.name or "_backup" in path.name:
            continue
        scanned += 1
        try:
            with path.open() as f:
                data = yaml.safe_load(f)
        except Exception as e:
            print(f"# parse-error: {path}: {e}", file=sys.stderr)
            continue
        for q, loc in iter_quiz_questions(data):
            hit = analyze_question(q)
            if hit is None:
                continue
            rows.append({"file": str(path), "location": loc, **hit})
    return scanned, rows


def collect_paths(restrict_file: str | None):
    if restrict_file:
        p = Path(restrict_file)
        return [p] if p.exists() else []
    out = []
    for root in ROOTS:
        if root.exists():
            out.extend(sorted(root.glob("*.yml")))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--summary-only", action="store_true", help="suppress CSV; just print the summary")
    ap.add_argument("--top", type=int, default=0, help="print only the N highest length-ratio hits")
    ap.add_argument("--file", help="restrict to a single YAML file")
    args = ap.parse_args()

    paths = collect_paths(args.file)
    scanned, rows = scan(paths)

    if args.top:
        rows = sorted(rows, key=lambda r: r["length_ratio"] or 0, reverse=True)[: args.top]

    if rows and not args.summary_only:
        writer = csv.DictWriter(sys.stdout, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

    files_with_tells = {r["file"] for r in rows}
    length_only = sum(1 for r in rows if r["length_tell"] and not r["bold_tell"])
    bold_only = sum(1 for r in rows if r["bold_tell"] and not r["length_tell"])
    both = sum(1 for r in rows if r["length_tell"] and r["bold_tell"])
    print(
        f"\n# audit_mcq_tells: scanned {scanned} files, "
        f"{len(files_with_tells)} flagged, "
        f"{len(rows)} questions "
        f"(length-only={length_only}, bold-only={bold_only}, both={both})",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
