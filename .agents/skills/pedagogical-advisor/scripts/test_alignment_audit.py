#!/usr/bin/env python3
"""Regression tests for consequential structural-audit failure modes (stdlib only)."""
from __future__ import annotations

import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from audit_alignment import audit

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "audit_alignment.py"
SAMPLE = ROOT / "examples" / "course-spec.sample.json"


class AlignmentAuditTests(unittest.TestCase):
    def setUp(self):
        self.course = json.loads(SAMPLE.read_text(encoding="utf-8"))

    def messages(self, result):
        return "\n".join(item["message"] for item in result["findings"])

    def remove_evidence(self):
        for item in self.course["assessments"]:
            item.pop("independent_evidence", None)

    def test_described_individual_observation_supplies_declared_coverage(self):
        result = audit(self.course)
        self.assertEqual(result["issue_counts"]["critical"], 0)
        for oid in ("C1", "C2"):
            self.assertEqual(result["coverage"][oid]["independent_assessments"], ["A3"])
        self.assertEqual(result["coverage"]["C3"]["independent_assessments"], [])
        self.assertIsNone(result["score"])
        self.assertEqual(result["audit_type"], "structural_lint")
        self.assertIn("not verified independence", result["coverage_note"])

    def test_policy_prohibition_or_negated_prohibition_never_establishes_independence(self):
        for wording in ("prohibited", "AI is not prohibited", "prohibited for first attempt"):
            with self.subTest(wording=wording):
                self.remove_evidence()
                for item in self.course["assessments"]:
                    item["ai_status"] = wording
                result = audit(self.course)
                self.assertEqual(result["coverage"]["C1"]["independent_assessments"], [])
                self.assertIn("Outcome C1 requires independence", self.messages(result))

    def test_legacy_true_flag_without_description_does_not_count(self):
        self.remove_evidence()
        self.course["assessments"][2]["independent_assurance"] = True
        result = audit(self.course)
        self.assertEqual(result["coverage"]["C2"]["independent_assessments"], [])
        self.assertIn("flag alone does not count", self.messages(result))

    def test_missing_or_whitespace_observation_evidence_or_conditions_does_not_count(self):
        for field in ("observation", "evidence", "conditions"):
            for invalid in (None, "   ", True):
                with self.subTest(field=field, invalid=invalid):
                    course = copy.deepcopy(self.course)
                    course["assessments"][2]["independent_evidence"][field] = invalid
                    result = audit(course)
                    self.assertEqual(result["coverage"]["C1"]["independent_assessments"], [])
                    self.assertIn("lacks described", self.messages(result))

    def test_evidence_coverage_is_scoped_to_explicit_outcomes(self):
        self.course["assessments"][2]["independent_evidence"]["outcomes"] = ["C1"]
        result = audit(self.course)
        self.assertEqual(result["coverage"]["C1"]["independent_assessments"], ["A3"])
        self.assertEqual(result["coverage"]["C2"]["independent_assessments"], [])
        self.assertIn("Outcome C2 requires independence", self.messages(result))

    def test_evidence_cannot_reference_outcomes_outside_assessment(self):
        self.course["assessments"][2]["independent_evidence"]["outcomes"].append("C3")
        result = audit(self.course)
        self.assertIn("references outcomes outside its assessment: C3", self.messages(result))
        self.assertEqual(result["coverage"]["C1"]["independent_assessments"], [])

    def test_duplicate_outcome_does_not_overwrite_independence_requirement(self):
        self.remove_evidence()
        self.course["outcomes"].append({"id": "C1", "statement": "Different definition", "independent": False})
        result = audit(self.course)
        self.assertEqual(result["duplicate_ids"]["outcomes"], ["C1"])
        self.assertIn("Outcome C1 requires independence", self.messages(result))

    def test_duplicate_module_and_assessment_ids_are_critical(self):
        self.course["modules"].append(copy.deepcopy(self.course["modules"][0]))
        self.course["assessments"].append(copy.deepcopy(self.course["assessments"][2]))
        result = audit(self.course)
        self.assertEqual(result["duplicate_ids"]["modules"], ["M1"])
        self.assertEqual(result["duplicate_ids"]["assessments"], ["A3"])
        self.assertEqual(result["coverage"]["C1"]["independent_assessments"], [])
        duplicate_findings = [item for item in result["findings"] if "Duplicate" in item["message"]]
        self.assertTrue(all(item["severity"] == "critical" for item in duplicate_findings))

    def test_malformed_structures_report_findings_without_crashing(self):
        for course in (None, [], {"outcomes": [False, {"id": []}], "modules": None},
                       {"outcomes": [{"id": "C1", "independent": "yes"}],
                        "modules": [{"id": [], "outcomes": [[], "C1"]}], "workload": None}):
            with self.subTest(course=course):
                self.assertGreater(audit(course)["issue_counts"]["critical"], 0)

    def test_boolean_weight_is_not_a_number_and_unknown_reference_is_reported(self):
        self.course["assessments"][0]["weight"] = True
        self.course["modules"][0]["outcomes"].append("MISSING")
        result = audit(self.course)
        self.assertIn("needs a numeric weight", self.messages(result))
        self.assertIn("Unknown outcome references: MISSING", self.messages(result))

    def test_zero_marker_hours_is_valid(self):
        self.course["workload"]["estimated_marker_hours_per_week"] = 0
        result = audit(self.course)
        self.assertNotIn("No valid marker workload estimate", self.messages(result))

    def test_cli_text_and_json_exit_status_agree_for_valid_and_invalid_input(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "course.json"
            for valid in (True, False):
                if not valid:
                    self.remove_evidence()
                path.write_text(json.dumps(self.course), encoding="utf-8")
                for flags in ([], ["--json"]):
                    with self.subTest(valid=valid, flags=flags):
                        result = subprocess.run([sys.executable, "-B", str(SCRIPT), str(path), *flags],
                                                capture_output=True, text=True, check=False)
                        self.assertEqual(result.returncode, 0 if valid else 1, result.stderr)
                        if flags:
                            self.assertIsNone(json.loads(result.stdout)["score"])
                        else:
                            self.assertIn("Structural lint", result.stdout)
                            self.assertNotIn("/100", result.stdout)


if __name__ == "__main__":
    unittest.main()
