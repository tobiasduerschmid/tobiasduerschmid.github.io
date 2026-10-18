#!/usr/bin/env python3
"""Lint declared course coverage and plans; do not score teaching quality.

This dependency-free check does not validate the complete JSON Schema or verify
that learning, independence, fairness, or assessment validity has been established.
Human review of the tasks and actual evidence is required.
"""
from __future__ import annotations

import argparse
import json
import math
from collections import Counter, defaultdict
from pathlib import Path


LIMITATIONS = (
    "Structural lint of declared plans only. Presence and coverage do not establish "
    "pedagogical quality, learning, independent capability, fairness, or assessment "
    "validity. Review task content, assistance conditions, accessibility, and actual "
    "evidence separately. This is not a complete JSON Schema validator."
)


def load(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise SystemExit(f"Cannot parse {path}: {exc}") from exc


def has_text(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def audit(data: dict) -> dict:
    findings = []
    strengths = []

    def flag(severity, message):
        findings.append({"severity": severity, "message": message})

    if not isinstance(data, dict):
        flag("critical", "Course specification must be a JSON object.")
        data = {}

    def records(name):
        value = data.get(name, [])
        if not isinstance(value, list):
            flag("critical", f"{name} must be an array of objects.")
            return []
        result = []
        for position, item in enumerate(value, 1):
            if not isinstance(item, dict):
                flag("critical", f"{name} entry {position} must be an object.")
            else:
                result.append(item)
        return result

    outcome_records = records("outcomes")
    modules = records("modules")
    assessments = records("assessments")
    duplicate_ids = {}
    for name, items in (("outcomes", outcome_records), ("modules", modules),
                        ("assessments", assessments)):
        counts = Counter()
        for position, item in enumerate(items, 1):
            item_id = item.get("id")
            if not has_text(item_id):
                flag("critical", f"{name} entry {position} needs a nonempty string ID.")
            else:
                counts[item_id] += 1
        duplicate_ids[name] = sorted(key for key, count in counts.items() if count > 1)
        if duplicate_ids[name]:
            flag("critical", f"Duplicate {name} IDs: {', '.join(duplicate_ids[name])}. "
                 "Resolve these before interpreting coverage.")

    # Keep the first definition, never silently replace it with a later record.
    outcomes = {}
    for outcome in outcome_records:
        if has_text(outcome.get("id")):
            outcomes.setdefault(outcome["id"], outcome)
        if "independent" in outcome and not isinstance(outcome["independent"], bool):
            flag("critical", f"Outcome {outcome.get('id', '?')} independent must be Boolean.")
    if not outcomes:
        flag("critical", "No course outcomes are defined.")

    mod_cov = defaultdict(list)
    assess_cov = defaultdict(list)
    independent_cov = defaultdict(list)
    unknown = set()

    def references(obj, label):
        refs = obj.get("outcomes", [])
        if not isinstance(refs, list) or not refs:
            flag("critical", f"{label} needs a nonempty outcomes array.")
            return []
        result = []
        for oid in refs:
            if not has_text(oid):
                flag("critical", f"{label} has a non-string or empty outcome reference.")
            elif oid in result:
                flag("warning", f"{label} repeats outcome reference {oid}.")
            else:
                result.append(oid)
                if oid not in outcomes:
                    unknown.add(oid)
        return result

    for module in modules:
        mid = module.get("id") if has_text(module.get("id")) else "?"
        for oid in references(module, f"Module {mid}"):
            mod_cov[oid].append(mid)
        if not has_text(module.get("formative_evidence")):
            flag("warning", f"Module {mid} has no described formative evidence.")
        practice = module.get("practice")
        if not isinstance(practice, list) or not any(has_text(item) for item in practice):
            flag("critical", f"Module {mid} has no practice specified.")

    for assessment in assessments:
        aid = assessment.get("id") if has_text(assessment.get("id")) else "?"
        refs = references(assessment, f"Assessment {aid}")
        for oid in refs:
            assess_cov[oid].append(aid)
        if not has_text(assessment.get("feedback")):
            flag("warning", f"Assessment {aid} has no feedback plan.")
        if not has_text(assessment.get("ai_status")):
            flag("warning", f"Assessment {aid} has no task-specific AI status.")

        evidence = assessment.get("independent_evidence")
        if assessment.get("independent_assurance") is True and evidence is None:
            flag("warning", f"Assessment {aid} declares independent_assurance but gives no "
                 "independent_evidence observation, evidence, and conditions; the flag alone does not count.")
        if evidence is None:
            continue
        if not isinstance(evidence, dict):
            flag("critical", f"Assessment {aid} independent_evidence must be an object.")
            continue
        evidence_refs = references(evidence, f"Assessment {aid} independent_evidence")
        missing = [field for field in ("observation", "evidence", "conditions")
                   if not has_text(evidence.get(field))]
        if missing:
            flag("critical", f"Assessment {aid} independent_evidence lacks described "
                 f"{', '.join(missing)}; it does not count toward independent coverage.")
        invalid_refs = set(evidence_refs) - set(refs)
        if invalid_refs:
            flag("critical", f"Assessment {aid} independent_evidence references outcomes outside "
                 f"its assessment: {', '.join(sorted(invalid_refs))}.")
        if assessment.get("independent_assurance") is False:
            flag("warning", f"Assessment {aid} has independent_evidence but the legacy "
                 "independent_assurance flag is false; reconcile the declarations.")
        # Descriptions are necessary, but are not verified assurance. Policy text
        # such as 'prohibited' never contributes independent coverage.
        if (not missing and not invalid_refs and has_text(assessment.get("id"))
                and aid not in duplicate_ids["assessments"]
                and assessment.get("independent_assurance") is not False):
            for oid in evidence_refs:
                if oid in outcomes and oid not in duplicate_ids["outcomes"]:
                    independent_cov[oid].append(aid)

    for oid, outcome in outcomes.items():
        if not mod_cov[oid]:
            flag("critical", f"Outcome {oid} is not linked to practice in any module.")
        elif len(set(mod_cov[oid])) == 1:
            flag("suggestion", f"Outcome {oid} is linked to one module; check whether "
                 "that module supplies sufficient repeated practice.")
        if not assess_cov[oid]:
            flag("critical", f"Outcome {oid} is not linked to an assessment.")
        if outcome.get("independent") is True and not independent_cov[oid]:
            flag("critical", f"Outcome {oid} requires independence but has no assessment with "
                 "a described, outcome-specific individual observation, evidence, and assistance conditions. "
                 "An AI prohibition or Boolean assurance flag is insufficient.")

    if unknown:
        flag("critical", "Unknown outcome references: " + ", ".join(sorted(unknown)))

    weights = []
    for assessment in assessments:
        weight = assessment.get("weight")
        if (isinstance(weight, bool) or not isinstance(weight, (int, float))
                or not math.isfinite(weight) or not 0 <= weight <= 100):
            flag("critical", f"Assessment {assessment.get('id', '?')} needs a numeric "
                 "weight from 0 to 100.")
        else:
            weights.append(weight)
    if weights and len(weights) == len(assessments):
        total = sum(weights)
        if abs(total - 100) > 0.01:
            flag("warning", f"Assessment weights total {total:g}%, not 100%.")
        else:
            strengths.append("Declared assessment weights total 100%.")

    for field, label in (("access", "access/inclusion"), ("evaluation", "course evaluation")):
        if not isinstance(data.get(field), dict) or not data[field]:
            flag("warning", f"No {label} plan is present.")
        else:
            strengths.append(f"Declared {label} information is present (content not evaluated).")
    workload = data.get("workload", {})
    if not isinstance(workload, dict):
        flag("critical", "workload must be an object.")
        workload = {}
    for field, label in (("student_hours_per_week", "weekly student workload"),
                         ("estimated_marker_hours_per_week", "marker workload")):
        value = workload.get(field)
        if (isinstance(value, bool) or not isinstance(value, (int, float))
                or not math.isfinite(value) or value < 0):
            flag("warning", f"No valid {label} estimate.")

    # Literal keyword prompts only: absence does not diagnose a learning problem.
    practice_text = " ".join(
        item.lower() for module in modules
        if isinstance(module.get("practice"), list)
        for item in module["practice"] if isinstance(item, str)
    )
    for name in ("retrieval", "worked example", "feedback", "transfer"):
        if name not in practice_text:
            flag("suggestion", f"Keyword check: '{name}' is not named in practice descriptions. "
                 "Review its relevance; wording alone cannot establish whether the practice occurs.")

    counts = {severity: sum(item["severity"] == severity for item in findings)
              for severity in ("critical", "warning", "suggestion")}
    return {
        "audit_type": "structural_lint",
        "status": "review_required" if counts["critical"] else "no_critical_structural_findings",
        "limitations": LIMITATIONS,
        "score": None,
        "score_note": "Deprecated in v2: the former arbitrary numerical score was not a "
                      "validated measure of alignment or pedagogical quality. Use issue_counts.",
        "issue_counts": counts,
        "strengths": strengths,
        "findings": findings,
        "duplicate_ids": duplicate_ids,
        "coverage": {
            oid: {"modules": mod_cov[oid], "assessments": assess_cov[oid],
                  "independent_assessments": independent_cov[oid]}
            for oid in outcomes
        },
        "coverage_note": "independent_assessments lists declared evidence plans with the required "
                         "descriptions, not verified independence. Duplicate IDs make coverage ambiguous.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("course_json", type=Path)
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args()
    result = audit(load(args.course_json))
    if args.as_json:
        print(json.dumps(result, indent=2))
    else:
        print(f"Course structural lint: {result['status']}")
        print(result["limitations"])
        print("Issue counts: " + ", ".join(f"{key}={value}" for key, value in result["issue_counts"].items()))
        if result["strengths"]:
            print("\nPresent declarations:")
            for item in result["strengths"]:
                print("  +", item)
        if result["findings"]:
            print("\nFindings:")
            for item in result["findings"]:
                print(f"  [{item['severity'].upper()}] {item['message']}")
        print("\nDeclared outcome coverage:")
        for oid, coverage in result["coverage"].items():
            print(f"  {oid}: modules={coverage['modules']} assessments={coverage['assessments']} "
                  f"independent_evidence_plans={coverage['independent_assessments']}")
        print(result["coverage_note"])
    # Machine-readable and human-readable forms have the same exit status.
    return 1 if result["issue_counts"]["critical"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
