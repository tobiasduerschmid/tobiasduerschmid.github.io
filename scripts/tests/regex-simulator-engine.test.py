"""Public-contract tests for the real Python regex simulator (no browser needed)."""

import importlib.util
import json
from pathlib import Path
import platform
import sys
import unittest

sys.dont_write_bytecode = True

ENGINE_PATH = Path(__file__).resolve().parents[2] / "js/regex-simulator-engine.py"


class RegexEngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("regex_simulator_engine", ENGINE_PATH)
        cls.engine = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.engine)

    def analyze(self, pattern="moss", text="moss fern moss", **options):
        result = self.engine.analyze_regex({"pattern": pattern, "text": text, **options})
        self.assertTrue(result["ok"], result.get("error"))
        return result

    def test_finditer_reports_python_codepoint_spans(self):
        result = self.analyze("moss", "🌿moss fern moss")
        self.assertEqual([(m["start"], m["end"], m["text"]) for m in result["matches"]],
                         [(1, 5, "moss"), (11, 15, "moss")])
        self.assertEqual(result["version"], platform.python_version())
        self.assertIsNone(result["output"])

    def test_named_capture_and_python_backreference(self):
        result = self.analyze(r"(?P<plant>moss) (?P=plant)", "moss moss")
        self.assertEqual(result["matches"][0]["groups"], [
            {"number": 1, "name": "plant", "start": 0, "end": 4, "text": "moss"}])

    def test_unmatched_capture_differs_from_empty_capture(self):
        result = self.analyze(r"(fern)?()moss", "moss")
        self.assertEqual(result["matches"][0]["groups"], [
            {"number": 1, "name": None, "start": -1, "end": -1, "text": None},
            {"number": 2, "name": None, "start": 0, "end": 0, "text": ""}])

    def test_zero_width_matches_keep_python_enumeration(self):
        result = self.analyze(r"|a", "ab")
        self.assertEqual([(m["start"], m["end"]) for m in result["matches"]],
                         [(0, 0), (0, 1), (1, 1), (2, 2)])

    def test_operations_have_distinct_start_and_end_requirements(self):
        cases = [("search", "fern moss", [(5, 9)]),
                 ("match", "fern moss", []), ("match", "moss fern", [(0, 4)]),
                 ("fullmatch", "moss fern", []), ("fullmatch", "moss", [(0, 4)])]
        for operation, text, expected in cases:
            with self.subTest(operation=operation, text=text):
                result = self.analyze("moss", text, operation=operation)
                self.assertEqual([(m["start"], m["end"]) for m in result["matches"]], expected)

    def test_flags_use_python_semantics(self):
        cases = [("IGNORECASE", "moss", "MOSS", ["MOSS"]),
                 ("MULTILINE", "^moss", "fern\nmoss", ["moss"]),
                 ("DOTALL", "m.ss", "m\nss", ["m\nss"]),
                 ("VERBOSE", "m o s s # plant", "moss", ["moss"]),
                 ("ASCII", r"\w+", "mossé", ["moss"])]
        for flag, pattern, text, expected in cases:
            with self.subTest(flag=flag):
                self.assertEqual([m["text"] for m in self.analyze(
                    pattern, text, flags=[flag])["matches"]], expected)

    def test_unicode_word_matching_is_the_default(self):
        self.assertEqual(self.analyze(r"\w+", "mossé")["matches"][0]["text"], "mossé")

    def test_javascript_named_group_syntax_is_a_python_error(self):
        result = self.engine.analyze_regex({"pattern": "(?<plant>moss)", "text": "moss"})
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["field"], "pattern")
        self.assertEqual(result["error"]["position"], 1)

    def test_pattern_error_has_line_and_column(self):
        result = self.engine.analyze_regex({"pattern": "moss\n(", "text": ""})
        self.assertFalse(result["ok"])
        self.assertEqual((result["error"]["position"], result["error"]["line"],
                          result["error"]["column"]), (5, 2, 1))

    def test_variable_width_lookbehind_is_rejected_by_python(self):
        result = self.engine.analyze_regex({"pattern": r"(?<=m+)oss", "text": "moss"})
        self.assertFalse(result["ok"])
        self.assertIn("look-behind", result["error"]["message"])

    def test_candidate_scan_preserves_lookbehind_context(self):
        result = self.analyze(r"(?<=m)oss", "moss fern")
        self.assertEqual(result["probes"], [
            {"position": 0, "matched": False, "start": None, "end": None, "text": None},
            {"position": 1, "matched": True, "start": 1, "end": 4, "text": "oss"}])
        self.assertFalse(result["probesTruncated"])

    def test_candidate_scan_does_not_reanchor_sliced_text(self):
        result = self.analyze("^moss", "fern moss")
        self.assertEqual(len(result["probes"]), 10)
        self.assertFalse(any(probe["matched"] for probe in result["probes"]))

    def test_candidate_scan_includes_empty_input_position(self):
        result = self.analyze("", "")
        self.assertEqual(result["probes"][0]["position"], 0)
        self.assertTrue(result["probes"][0]["matched"])

    def test_match_and_fullmatch_probe_only_the_start(self):
        for operation in ["match", "fullmatch"]:
            with self.subTest(operation=operation):
                result = self.analyze("moss", "moss fern", operation=operation)
                self.assertEqual(len(result["probes"]), 1)
                self.assertEqual(result["probes"][0]["matched"], operation == "match")
                self.assertFalse(result["probesTruncated"])

    def test_candidate_scan_stops_at_100_positions_without_hiding_real_result(self):
        result = self.analyze("moss", "a" * 100 + "moss")
        self.assertEqual(result["matches"][0]["start"], 100)
        self.assertEqual(len(result["probes"]), 100)
        self.assertEqual(result["probes"][-1]["position"], 99)
        self.assertTrue(result["probesTruncated"])

    def test_candidate_limit_is_not_truncation_if_last_position_matches(self):
        result = self.analyze("moss", "a" * 99 + "moss")
        self.assertEqual(result["probes"][-1]["position"], 99)
        self.assertFalse(result["probesTruncated"])

    def test_candidate_limit_at_end_is_not_truncation(self):
        self.assertFalse(self.analyze("moss", "a" * 99)["probesTruncated"])

    def test_display_match_limit_marks_only_omitted_matches(self):
        for count, truncated in [(199, False), (200, False), (201, True)]:
            with self.subTest(count=count):
                result = self.analyze("a", "a" * count)
                self.assertEqual(len(result["matches"]), min(count, 200))
                self.assertEqual(result["truncated"], truncated)

    def test_substitution_expands_python_named_backreferences(self):
        result = self.analyze(r"(?P<plant>moss)", "moss fern moss", operation="sub",
                              replacement=r"<\g<plant>>")
        self.assertEqual(result["output"], "<moss> fern <moss>")

    def test_substitution_replaces_beyond_display_limit(self):
        result = self.analyze("a", "a" * 201, operation="sub", replacement="b")
        self.assertEqual(result["output"], "b" * 201)
        self.assertEqual(len(result["matches"]), 200)
        self.assertTrue(result["truncated"])

    def test_substitution_keeps_python_empty_match_behavior(self):
        result = self.analyze(r"|a", "ab", operation="sub", replacement="fern")
        self.assertEqual(result["output"], "fernfernfernbfern")

    def test_substitution_empty_group_and_escapes(self):
        result = self.analyze(r"(fern)?moss", "moss", operation="sub", replacement=r"\1\n")
        self.assertEqual(result["output"], "\n")

    def test_invalid_replacement_is_reported_even_without_a_match(self):
        for replacement in [r"\2", r"\g<missing>", r"\q"]:
            with self.subTest(replacement=replacement):
                result = self.engine.analyze_regex({"pattern": "moss", "text": "fern",
                    "operation": "sub", "replacement": replacement})
                self.assertFalse(result["ok"])
                self.assertEqual(result["error"]["field"], "replacement")

    def test_replacement_is_only_interpreted_for_sub(self):
        self.assertTrue(self.analyze(replacement=r"\q")["ok"])

    def test_output_limit_accepts_boundary_and_rejects_overflow(self):
        for repetitions, expected_ok in [(99, True), (100, True), (101, False)]:
            with self.subTest(repetitions=repetitions):
                result = self.engine.analyze_regex({"pattern": "a", "text": "a" * repetitions,
                    "operation": "sub", "replacement": "b" * 1000})
                self.assertEqual(result["ok"], expected_ok)
                if expected_ok:
                    self.assertEqual(result["output"], "b" * (repetitions * 1000))
                else:
                    self.assertEqual(result["error"]["field"], "replacement")

    def test_large_group_expansion_is_rejected(self):
        result = self.engine.analyze_regex({"pattern": "(a+)", "text": "a" * 20000,
            "operation": "sub", "replacement": r"\1" * 1000})
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["field"], "replacement")

    def test_input_limits_count_python_characters(self):
        for field, limit in [("pattern", 2000), ("text", 20000), ("replacement", 2000)]:
            for length in [limit - 1, limit, limit + 1]:
                with self.subTest(field=field, length=length):
                    request = {"pattern": "moss", "text": "", "replacement": ""}
                    request[field] = "🌿" * length
                    result = self.engine.analyze_regex(request)
                    self.assertEqual(result["ok"], length <= limit)
                    if length > limit:
                        self.assertEqual(result["error"]["field"], field)

    def test_debug_is_python_compiler_output(self):
        result = self.analyze("moss", "moss")
        self.assertIn("LITERAL 109", result["debug"])
        self.assertIn("SUCCESS", result["debug"])

    def test_explanation_names_python_groups_repeats_and_lookbehind(self):
        result = self.analyze(r"(?P<plant>moss)+(?<=moss)(?P=plant)", "mossmoss")
        explanation = " ".join(row["label"] + " " + row["detail"] for row in result["explanation"])
        for concept in ["plant", "greedy", "lookbehind", "reference"]:
            with self.subTest(concept=concept):
                self.assertIn(concept, explanation.lower())
        self.assertTrue(any(row["depth"] > 0 for row in result["explanation"]))

    def test_json_transport_roundtrips_unicode_and_backslashes(self):
        result = json.loads(self.engine.analyze_regex_json(json.dumps({
            "pattern": r"(?P<plant>moss)", "text": "🌿moss", "operation": "sub",
            "replacement": r"\g<plant>\\"})))
        self.assertTrue(result["ok"])
        self.assertEqual(result["output"], "🌿moss\\")

    def test_explanation_preserves_case_sensitive_group_names(self):
        result = self.analyze(r"(?P<Plant>moss)", "moss")
        self.assertTrue(any("'Plant'" in row["label"] for row in result["explanation"]))

    def test_scoped_unicode_override_is_explained_as_unicode(self):
        result = self.analyze(r"(?u:\w+)", "mossé", flags=["ASCII"])
        self.assertEqual(result["matches"][0]["text"], "mossé")
        category = next(row for row in result["explanation"] if row["label"] == "Character category")
        self.assertIn("Unicode", category["detail"])

    def test_scoped_dotall_changes_dot_explanation(self):
        result = self.analyze(r"(?s:.)", "\n")
        wildcard = next(row for row in result["explanation"] if row["label"] == "Any character")
        self.assertNotIn("except", wildcard["detail"])

    def test_invalid_request_shapes_return_field_errors(self):
        for request in [None, {"text": None}, {"flags": "ASCII"}, {"flags": [None]},
                        {"operation": []}, {"operation": "unknown"}]:
            with self.subTest(request=request):
                result = self.engine.analyze_regex(request)
                self.assertFalse(result["ok"])
                self.assertIn(result["error"]["field"], ["text", "pattern"])

    def test_malformed_json_returns_error_envelope(self):
        result = json.loads(self.engine.analyze_regex_json("{"))
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["field"], "pattern")

    def test_result_text_budget_counts_captures_and_whole_match(self):
        prefix = r"(?=(a{20000}))" * 4
        cases = [(prefix + r"(?=(a{19999}))", True),
                 (prefix + r"(?=(a{20000}))", True),
                 (prefix + r"(?=(a{20000}))a", False)]
        for pattern, expected_ok in cases:
            with self.subTest(pattern=pattern):
                result = self.engine.analyze_regex({"pattern": pattern,
                    "text": "a" * 20000, "operation": "search"})
                self.assertEqual(result["ok"], expected_ok)
                if not expected_ok:
                    self.assertEqual(result["error"]["field"], "text")
                    self.assertIn("100,000", result["error"]["message"])

    def test_result_text_budget_accumulates_across_matches(self):
        for length, expected_ok in [(599, True), (600, False)]:
            with self.subTest(length=length):
                result = self.engine.analyze_regex({"pattern": r"(?=(a+))", "text": "a" * length})
                self.assertEqual(result["ok"], expected_ok)
                if not expected_ok:
                    self.assertEqual(result["error"]["field"], "text")

    def test_capture_record_budget_includes_empty_captures(self):
        cases = [("()" * 25 + "a", "a" * 199, True),
                 ("()" * 25 + "a", "a" * 200, True),
                 ("()" * 3 + "a|" + "()" * 23 + "b", "a" * 200, False)]
        for pattern, text, expected_ok in cases:
            with self.subTest(groups=pattern.count("("), matches=len(text)):
                result = self.engine.analyze_regex({"pattern": pattern, "text": text})
                self.assertEqual(result["ok"], expected_ok)
                if not expected_ok:
                    self.assertEqual(result["error"]["field"], "text")
                    self.assertIn("5,000", result["error"]["message"])

    def test_user_cases_report_positive_and_negative_expectations(self):
        result = self.engine.test_regex({"pattern": "moss", "operation": "fullmatch", "cases": [
            {"id": "positive", "text": "moss", "expected": True},
            {"id": "negative", "text": "fern", "expected": False},
            {"id": "mismatch", "text": "moss fern", "expected": True}]})
        self.assertTrue(result["ok"])
        self.assertEqual(result["cases"], [{"id": "positive", "matched": True, "passed": True},
            {"id": "negative", "matched": False, "passed": True},
            {"id": "mismatch", "matched": False, "passed": False}])
        self.assertEqual((result["passed"], result["total"]), (2, 3))
        self.assertEqual(result["version"], platform.python_version())

    def test_user_cases_search_can_match_inside_text(self):
        result = self.engine.test_regex({"pattern": "moss", "operation": "search", "cases": [
            {"id": "inside", "text": "fern moss", "expected": True}]})
        self.assertTrue(result["ok"])
        self.assertEqual(result["cases"], [{"id": "inside", "matched": True, "passed": True}])

    def test_user_case_empty_match_counts_as_a_match(self):
        result = self.engine.test_regex({"pattern": "", "cases": [
            {"id": "empty", "text": "", "expected": True}]})
        self.assertTrue(result["ok"])
        self.assertEqual(result["passed"], 1)

    def test_user_case_limit_counts_cases(self):
        for count, expected_ok in [(0, False), (49, True), (50, True), (51, False)]:
            with self.subTest(count=count):
                cases = [{"id": str(index), "text": "moss", "expected": True} for index in range(count)]
                result = self.engine.test_regex({"pattern": "moss", "cases": cases})
                self.assertEqual(result["ok"], expected_ok)

    def test_user_case_limit_counts_total_unicode_codepoints(self):
        for extra, expected_ok in [(9999, True), (10000, True), (10001, False)]:
            with self.subTest(extra=extra):
                result = self.engine.test_regex({"pattern": ".+", "cases": [
                    {"id": "first", "text": "🌿" * 10000, "expected": True},
                    {"id": "second", "text": "🌿" * extra, "expected": True}]})
                self.assertEqual(result["ok"], expected_ok)

    def test_user_cases_reject_ambiguous_or_malformed_rows(self):
        valid = {"id": "plant", "text": "moss", "expected": True}
        invalid_suites = [[valid, valid], [{**valid, "expected": "yes"}],
                          [{**valid, "text": None}], [{**valid, "id": ""}], [None]]
        for cases in invalid_suites:
            with self.subTest(cases=cases):
                result = self.engine.test_regex({"pattern": "moss", "cases": cases})
                self.assertFalse(result["ok"])
                self.assertEqual(result["error"]["field"], "text")

    def test_user_cases_restrict_operations(self):
        result = self.engine.test_regex({"pattern": "moss", "operation": "sub", "cases": [
            {"id": "plant", "text": "moss", "expected": True}]})
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["field"], "pattern")

    def test_json_action_dispatches_user_case_suite(self):
        result = json.loads(self.engine.analyze_regex_json(json.dumps({
            "action": "test", "pattern": "moss", "operation": "fullmatch",
            "cases": [{"id": "plant", "text": "moss", "expected": True}]})))
        self.assertTrue(result["ok"])
        self.assertEqual(result["cases"], [{"id": "plant", "matched": True, "passed": True}])

    def test_json_action_rejects_unknown_action(self):
        result = json.loads(self.engine.analyze_regex_json(json.dumps({"action": "unknown"})))
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["field"], "pattern")


if __name__ == "__main__":
    unittest.main()
