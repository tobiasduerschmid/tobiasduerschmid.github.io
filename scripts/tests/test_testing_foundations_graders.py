"""Behavioral regressions for the tutorial's actual authored grading commands."""

import ast
import contextlib
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[2]
TUTORIAL = yaml.safe_load((ROOT / "_data/tutorials/testing-foundations.yml").read_text())
SPEC = importlib.util.spec_from_file_location(
    "tutorial_test_grading", ROOT / "assets/tutorials/python_test_grading.py"
)
GRADING = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GRADING)
sys.modules[SPEC.name] = GRADING


@contextlib.contextmanager
def workspace(step_index, *, solution=True, changes=None):
    """Materialize one lesson as the runtime does, away from the repository."""
    step = TUTORIAL["steps"][step_index]
    with tempfile.TemporaryDirectory() as temporary:
        directory = Path(temporary)
        files = {f["path"]: f["content"] for f in step["files"]}
        if solution:
            files.update({f["path"]: f["content"] for f in step["solution"]["files"]})
        files.update(changes or {})
        for name, source in files.items():
            (directory / name).write_text(source)
        sys.path.insert(0, str(directory))
        try:
            yield directory
        finally:
            GRADING._clear_workspace_imports(directory)
            sys.path.remove(str(directory))


def outcomes(step_index, *, changes=None, solution=True):
    results = []
    with workspace(step_index, solution=solution, changes=changes) as directory:
        for check in TUTORIAL["steps"][step_index]["tests"]:
            try:
                exec(check["command"].replace("/tutorial/", str(directory) + "/"), {})
            except AssertionError as error:
                results.append((False, str(error)))
            else:
                results.append((True, ""))
    return results


class FoundationsGradersTest(unittest.TestCase):
    def assert_all_pass(self, step_index, changes=None):
        result = outcomes(step_index, changes=changes)
        failures = [
            (check["description"], detail)
            for check, (passed, detail) in zip(TUTORIAL["steps"][step_index]["tests"], result)
            if not passed
        ]
        self.assertEqual([], failures)

    def test_published_solutions_satisfy_every_criterion(self):
        for index in range(len(TUTORIAL["steps"])):
            with self.subTest(step=index + 1):
                self.assert_all_pass(index)

    def test_equivalent_single_quote_solutions_are_accepted(self):
        # AST round-tripping preserves behavior while changing quotes, comments,
        # whitespace and parentheses that the old source-scanning gates rejected.
        for index, step in enumerate(TUTORIAL["steps"]):
            changes = {
                f["path"]: ast.unparse(ast.parse(f["content"])) + "\n"
                for f in step["solution"]["files"]
            }
            with self.subTest(step=index + 1):
                self.assert_all_pass(index, changes)

    def test_correct_solutions_keep_original_starter_docstrings(self):
        for index in (3, 4):
            step = TUTORIAL["steps"][index]
            starters = {f["path"]: f["content"] for f in step["files"]}
            changes = {}
            for file in step["solution"]["files"]:
                docstring = ast.get_docstring(ast.parse(starters[file["path"]])) or ""
                changes[file["path"]] = repr(docstring) + "\n" + file["content"]
            with self.subTest(step=index + 1):
                self.assert_all_pass(index, changes)

    def test_parameterized_boundaries_and_discounts_are_accepted(self):
        self.assert_all_pass(1, {"test_squad.py": '''import pytest
from squad import squad_name_valid
@pytest.mark.parametrize("length, expected", [(0, False), (2, False), (3, True),
                                             (5, True), (12, True), (13, False)])
def test_length_contract(length, expected):
    assert squad_name_valid("x" * length) is expected
'''})
        self.assert_all_pass(4, {"test_streaming.py": '''import pytest
from streaming import streaming_price
@pytest.mark.parametrize("plan, expected", [("student", 15), ("family", 21),
                                           ("unlisted", 30), (None, 30)])
def test_plan_contract(plan, expected):
    assert streaming_price(30, plan) == pytest.approx(expected)
'''})

    def test_independent_streak_implementations_are_accepted(self):
        for source in (
            '''def streak_badge(days):
    for minimum, badge in [(100, "💯"), (30, "🔥"), (7, "⚡"), (1, "✨")]:
        if days >= minimum:
            return badge
    return ""
''',
            '''from bisect import bisect_right
def streak_badge(days):
    return ["", "✨", "⚡", "🔥", "💯"][bisect_right([1, 7, 30, 100], days)]
''',
        ):
            with self.subTest(source=source):
                self.assert_all_pass(0, {"streaks.py": source})

    def test_loop_based_boundaries_are_accepted(self):
        self.assert_all_pass(1, {"test_squad.py": '''from squad import squad_name_valid
def test_length_contract():
    for length in [0, 2, 13]:
        assert squad_name_valid("z" * length) is False
    for length in [3, 6, 12]:
        assert squad_name_valid("z" * length) is True
'''})

    def test_independent_loot_oracles_are_accepted(self):
        calls = '''
def test_common_potion_card():
    check_card("Healing Potion", 3, "common", "3× Common Healing Potion", False)
def test_rare_sword_card():
    check_card("Vorpal Sword", 1, "rare", "1× Rare Vorpal Sword", True)
def test_legendary_drop_card():
    check_card("Excalibur", 1, "legendary", "1× Legendary Excalibur", True)
'''
        for oracle in (
            '''    expected = dict(name=name, qty=qty, rarity=rarity, label=label, is_rare=rare)
    for field, value in expected.items():
        assert result[field] == value
''',
            '''    observed = (result.get("name"), result.get("qty"), result.get("rarity"),
                result.get("label"), result.get("is_rare"))
    assert observed == (name, qty, rarity, label, rare)
''',
        ):
            source = ('from loot import build_loot_card\n'
                      'def check_card(name, qty, rarity, label, rare):\n'
                      '    result = build_loot_card(name, qty, rarity)\n' + oracle + calls)
            with self.subTest(oracle=oracle):
                self.assert_all_pass(2, {"test_loot.py": source})

    def test_class_based_discount_tests_are_accepted(self):
        self.assert_all_pass(4, {"test_streaming.py": '''import unittest
from streaming import streaming_price
class PriceTests(unittest.TestCase):
    def test_student(self):
        self.assertAlmostEqual(streaming_price(8, "student"), 4)
    def test_family(self):
        self.assertAlmostEqual(streaming_price(8, "family"), 5.6)
    def test_other(self):
        self.assertEqual(streaming_price(8, "mystery"), 8)
'''})

    def test_alternative_field_projection_is_accepted(self):
        self.assert_all_pass(3, {"test_loot_overspec.py": '''import pytest
from loot import build_loot_card
@pytest.mark.parametrize("name, qty, rarity, expected", [
    ("Potion", 4, "common", dict(name="Potion", qty=4, rarity="common",
                                label="4× Common Potion", is_rare=False)),
    ("Sword", 2, "legendary", dict(name="Sword", qty=2, rarity="legendary",
                                  label="2× Legendary Sword", is_rare=True)),
])
def test_required_fields(name, qty, rarity, expected):
    result = build_loot_card(name, qty, rarity)
    assert {field: result[field] for field in expected} == expected
'''})

    def test_parameterized_public_api_and_subset_checks_are_accepted(self):
        for observation in (
            '''    assert queue.titles() == titles
    assert queue.durations() == durations
    assert queue.track_count() == count
    assert queue.total_duration == total
''',
            '''    observed = (queue.titles(), queue.durations(), queue.track_count(), queue.total_duration)
    assert observed == (titles, durations, count, total)
''',
        ):
            playlist = '''import pytest
from playlist import PlaylistQueue
@pytest.mark.parametrize("tracks, titles, durations, count, total", [
    ([], [], (), 0, 0),
    ([("A", 10)], ["A"], (10,), 1, 10),
    ([("A", 10), ("B", 20)], ["A", "B"], (10, 20), 2, 30),
    ([("C", 25), ("D", 35), ("E", 0)], ["C", "D", "E"], (25, 35, 0), 3, 60),
])
def test_queue_contract(tracks, titles, durations, count, total):
    queue = PlaylistQueue()
    for title, seconds in tracks:
        queue.add(title, seconds)
''' + observation
            loot = '''import pytest
from loot import build_loot_card
@pytest.mark.parametrize("name, qty, rarity, expected", [
    ("Potion", 4, "common", dict(name="Potion", qty=4, rarity="common",
                                label="4× Common Potion", is_rare=False)),
    ("Sword", 2, "legendary", dict(name="Sword", qty=2, rarity="legendary",
                                  label="2× Legendary Sword", is_rare=True)),
])
def test_card(name, qty, rarity, expected):
    result = build_loot_card(name, qty, rarity)
    assert expected.items() <= result.items()
'''
            with self.subTest(observation=observation):
                self.assert_all_pass(3, {"test_brittle_audit.py": playlist,
                                         "test_loot_overspec.py": loot})

    def test_comments_and_always_true_assertions_do_not_prove_boundaries(self):
        tests = '''from squad import squad_name_valid
# min 3, max 12, too long 13, empty string; all required words are present.
def test_boundary_min_valid(): assert True
def test_too_long_just_above_max(): assert True
def test_empty_string(): assert True
'''
        result = outcomes(1, changes={"test_squad.py": tests})
        self.assertTrue(result[0][0], result[0][1])
        self.assertTrue(all(not passed for passed, _ in result[1:]))

    def test_one_boundary_does_not_substitute_for_other_boundaries(self):
        result = outcomes(1, changes={"test_squad.py": '''from squad import squad_name_valid
def test_minimum(): assert squad_name_valid("abc") is True
'''})
        self.assertEqual([True, False, True, False, False, False, True],
                         [passed for passed, _ in result])

    def test_each_loot_test_needs_all_required_fields(self):
        source = TUTORIAL["steps"][2]["solution"]["files"][0]["content"]
        tree = ast.parse(source)
        for node in tree.body:
            if isinstance(node, ast.FunctionDef) and node.name == "test_rare_sword_card":
                node.body[-1] = ast.parse('assert result["is_rare"] is True').body[0]
        result = outcomes(2, changes={"test_loot.py": ast.unparse(tree)})
        self.assertEqual([True, True, False, True], [passed for passed, _ in result])

    def test_weak_family_oracle_cannot_hide_behind_strong_student_oracle(self):
        result = outcomes(4, changes={"test_streaming.py": '''from streaming import streaming_price
def test_student(): assert streaming_price(20, "student") == 10
def test_family(): assert 0 < streaming_price(20, "family") < 20
def test_other(): assert streaming_price(20, "individual") == 20
'''})
        self.assertEqual([True, True, True, True, True, False],
                         [passed for passed, _ in result])

    def test_deleted_playlist_oracles_do_not_count_as_repairs(self):
        result = outcomes(3, changes={"test_brittle_audit.py": '''from playlist import PlaylistQueue
def test_a(): assert True
def test_b(): assert True
def test_c(): assert True
def test_d(): assert True
'''})
        self.assertTrue(result[0][0], result[0][1])
        self.assertTrue(all(not passed for passed, _ in result[1:5]))


class SharedRunnerTest(unittest.TestCase):
    def run_suite(self, source, expect_failure, *, test_name=None):
        with workspace(4, changes={"test_streaming.py": source}) as directory:
            production = directory / "streaming.py"
            before = production.read_text()
            try:
                GRADING.check_suite(
                    directory / "test_streaming.py", "streaming",
                    'def streaming_price(price, plan): return 0\n',
                    expect_failure=expect_failure, test_name=test_name,
                )
            finally:
                self.assertEqual(before, production.read_text())

    def test_assertion_failure_counts_as_detection(self):
        self.run_suite('from streaming import streaming_price\n'
                       'def test_price(): assert streaming_price(10, "other") == 10\n', True)

    def test_runtime_errors_collection_errors_and_skips_are_not_detection(self):
        for source in (
            'def test_price(): assert missing_name == 10\n',
            'from unavailable_module import value\ndef test_price(): assert value == 10\n',
            'this is not valid python!\n',
            'import pytest\n@pytest.mark.skip\ndef test_price(): assert False\n',
            'import pytest\n@pytest.mark.xfail\ndef test_price(): assert False\n',
            'import pytest\n@pytest.fixture\ndef broken(): assert False\n'
            'def test_price(broken): assert False\n',
            '# no executable tests\n',
        ):
            with self.subTest(source=source), self.assertRaises(AssertionError):
                self.run_suite(source, True)

    def test_named_parameterized_test_selection(self):
        self.run_suite('import pytest\nfrom streaming import streaming_price\n'
                       '@pytest.mark.parametrize("price", [10, 20])\n'
                       'def test_price(price): assert streaming_price(price, "other") == price\n'
                       'def test_unrelated(): raise ValueError("not selected")\n',
                       True, test_name="test_price")

    def test_repeated_runs_reload_same_size_source_changes(self):
        source = ('from streaming import streaming_price\n'
                  'def test_price(): assert streaming_price(10, "other") == 1\n')
        with workspace(4, changes={"test_streaming.py": source}) as directory:
            production = directory / "streaming.py"
            original = production.read_text()
            for result, should_fail in ((1, False), (2, True), (1, False)):
                GRADING.check_suite(
                    directory / "test_streaming.py", "streaming",
                    f'def streaming_price(price, plan): return {result}\n',
                    expect_failure=should_fail,
                )
                self.assertEqual(original, production.read_text())


if __name__ == "__main__":
    unittest.main()
