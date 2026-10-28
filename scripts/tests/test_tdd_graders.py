"""Exercise TDD YAML graders with valid alternatives and plausible learner mistakes.

Run with ``python3 scripts/tests/test_tdd_graders.py``. Each candidate runs in an
isolated native Python process; the browser suite covers the Pyodide integration.
"""

import ast
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[2]
CONFIG = yaml.safe_load((ROOT / '_data/tutorials/tdd.yml').read_text())


def solution_files(step):
    files = {item['path']: item['content'] for item in step.get('files', [])}
    files.update({item['path']: item['content']
                  for item in step.get('solution', {}).get('files', [])})
    return files


def run_candidate(step_index, files):
    """Execute actual authored checks, preserving setup but clearing check globals."""
    with tempfile.TemporaryDirectory(prefix='tdd-grader-') as directory:
        work = Path(directory)
        for name, source in files.items():
            (work / name).write_text(source)
        sys.path.insert(0, directory)
        spec = importlib.util.spec_from_file_location(
            'tutorial_test_grading', ROOT / 'assets/tutorials/python_test_grading.py')
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
        for command in CONFIG['setup_commands']:
            if 'pyodide_js' in command or 'pyfetch' in command:
                continue
            exec(command.replace('/tutorial', directory), {})
        results = []
        for check in CONFIG['steps'][step_index]['tests']:
            captured = io.StringIO()
            try:
                with contextlib.redirect_stdout(captured), contextlib.redirect_stderr(captured):
                    exec(check['command'].replace('/tutorial', directory), {})
                results.append({'passed': True, 'description': check['description']})
            except Exception as error:
                results.append({'passed': False, 'description': check['description'],
                                'error': f'{type(error).__name__}: {error}'})
        return results


class EquivalentAssertions(ast.NodeTransformer):
    def __init__(self, style):
        self.style = style

    def visit_Compare(self, node):
        self.generic_visit(node)
        if len(node.ops) == 1 and isinstance(node.ops[0], ast.Eq):
            if self.style == 'reversed':
                node.left, node.comparators[0] = node.comparators[0], node.left
            else:
                node.ops = [ast.NotEq()]
                return ast.copy_location(ast.UnaryOp(op=ast.Not(), operand=node), node)
        return node


class VacuousAssertions(ast.NodeTransformer):
    def visit_Assert(self, node):
        return ast.copy_location(ast.Assert(test=ast.Constant(True)), node)


def rewrite_test(source, transform):
    return ast.unparse(ast.fix_missing_locations(transform.visit(ast.parse(source)))) + '\n'


def replaced(source, old, new):
    """Edit a model file, failing loudly if the edit no longer applies."""
    assert old in source, f'model source no longer contains:\n{old}'
    return source.replace(old, new)


class TddGraders(unittest.TestCase):
    def check(self, step_index, files):
        env = {**os.environ, 'PYTEST_DISABLE_PLUGIN_AUTOLOAD': '1'}
        proc = subprocess.run(
            [sys.executable, str(Path(__file__).resolve()), '--candidate'],
            input=json.dumps({'step': step_index, 'files': files}), text=True,
            capture_output=True, env=env, timeout=60,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr[-5000:])
        return json.loads(proc.stdout)

    def assert_accepts(self, step_index, files):
        failed = [item for item in self.check(step_index, files) if not item['passed']]
        self.assertEqual(failed, [], '\n'.join(item['error'] for item in failed))

    def failures(self, step_index, files):
        return [item['description'] for item in self.check(step_index, files)
                if not item['passed']]

    def outcome(self, results, fragment):
        matches = [item['passed'] for item in results if fragment in item['description']]
        self.assertEqual(len(matches), 1, (fragment, results))
        return matches[0]

    def test_all_models_and_two_equivalent_variants(self):
        for index, step in enumerate(CONFIG['steps']):
            for style in ('model', 'reversed', 'negated_inequality'):
                with self.subTest(step=index + 1, style=style):
                    files = solution_files(step)
                    if style != 'model':
                        for name, source in files.items():
                            if name.startswith('test_'):
                                files[name] = rewrite_test(source, EquivalentAssertions(style))
                            else:
                                files[name] = source.replace(
                                    'sum(event.damage for event in self.events)',
                                    'sum(map(lambda event: event.damage, self.events))')
                    self.assert_accepts(index, files)

    def test_vacuous_tests_do_not_earn_oracle_credit(self):
        for index in (0, 2, 3, 4, 5, 6, 7, 8, 9):
            with self.subTest(step=index + 1):
                files = solution_files(CONFIG['steps'][index])
                for name in files:
                    if name.startswith('test_'):
                        files[name] = rewrite_test(files[name], VacuousAssertions())
                results = self.check(index, files)
                self.assertTrue(any(not item['passed'] and
                                    ('detect' in item['description'] or
                                     'rejects' in item['description'])
                                    for item in results), results)

    def test_independent_behavior_rejects_empty_scorer_with_nonnegative_test(self):
        files = solution_files(CONFIG['steps'][3])
        files['scorer.py'] = files['scorer.py'].split('def score(')[0] + (
            'def score(dice):\n    return BattleReport()\n')
        files['test_scorer.py'] = '''from scorer import score

def test_empty_roll_has_zero_damage_and_no_events():
    report = score([])
    assert report.total_damage == 0
    assert report.events == ()

def test_single_one_creates_dragon_flame_event():
    assert score([1]).total_damage >= 0
'''
        failures = [item['description'] for item in self.check(3, files) if not item['passed']]
        self.assertTrue(any('scoring behaviors' in item for item in failures), failures)
        self.assertTrue(any('detect' in item for item in failures), failures)

    def test_event_count_alone_does_not_pin_event_identity(self):
        files = solution_files(CONFIG['steps'][5])
        tree = ast.parse(files['test_scorer.py'])
        target = next(node for node in tree.body if isinstance(node, ast.FunctionDef)
                      and node.name == 'test_two_ones_create_two_dragon_flames')
        target.body = ast.parse(
            'report = score([1, 1])\n'
            'assert report.total_damage == 200\n'
            'assert len(report.events) == 2\n').body
        files['test_scorer.py'] = ast.unparse(ast.fix_missing_locations(tree))
        self.assertFalse(self.check(5, files)[0]['passed'])

    def test_fizzbuzz_cannot_ignore_requested_length(self):
        files = solution_files(CONFIG['steps'][9])
        files['fizzbuzz.py'] = files['fizzbuzz.py'].replace(
            'range(1, n + 1)', 'range(1, 16)')
        files['test_fizzbuzz.py'] = '''from fizzbuzz import fizzbuzz

def test_fizz():
    assert fizzbuzz(15)[2] == 'Fizz'
def test_buzz():
    assert fizzbuzz(15)[4] == 'Buzz'
def test_overlap():
    assert fizzbuzz(15)[14] == 'FizzBuzz'
def test_number():
    assert fizzbuzz(15)[0] == '1'
'''
        results = self.check(9, files)
        self.assertFalse(self.outcome(results, 'FizzBuzz respects'), results)
        self.assertFalse(self.outcome(results, 'wrong length'), results)
        self.assertTrue(self.outcome(results, 'All your tests pass'), results)

    def test_fizzbuzz_accepts_one_parametrized_function(self):
        files = solution_files(CONFIG['steps'][9])
        files['fizzbuzz.py'] = '''def fizzbuzz(n):
    return [('Fizz' * (i % 3 == 0) + 'Buzz' * (i % 5 == 0)) or str(i)
            for i in range(1, n + 1)]
'''
        files['test_fizzbuzz.py'] = '''import pytest
from fizzbuzz import fizzbuzz

@pytest.mark.parametrize('n, expected', [
    (0, []), (2, ['1', '2']), (3, ['1', '2', 'Fizz']),
    (5, ['1', '2', 'Fizz', '4', 'Buzz']),
    (15, ['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8',
          'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz']),
])
def test_sequence(n, expected):
    assert fizzbuzz(n) == expected
'''
        self.assert_accepts(9, files)

    def test_per_die_iteration_accepts_a_generator_expression(self):
        files = solution_files(CONFIG['steps'][5])
        files['scorer.py'] = replaced(files['scorer.py'], '''    events = []

    for die in dice:
        if die == 1:
            events.append(ScoringEvent("Dragon Flame", (1,), 100))
        if die == 5:
            events.append(ScoringEvent("Lightning Spark", (5,), 50))

    return BattleReport(tuple(events))''', '''    singles = {1: ("Dragon Flame", 100), 5: ("Lightning Spark", 50)}
    return BattleReport(tuple(
        ScoringEvent(singles[die][0], (die,), singles[die][1])
        for die in dice if die in singles
    ))''')
        self.assert_accepts(5, files)

    def test_repeated_combos_accept_a_while_loop(self):
        files = solution_files(CONFIG['steps'][8])
        files['scorer.py'] = replaced(files['scorer.py'], '''        number_of_combos = counts[self.die] // self.count

        for _ in range(number_of_combos):
            dice_used = (self.die,) * self.count
            events.append(ScoringEvent(self.name, dice_used, self.damage))

        counts[self.die] %= self.count''', '''        while counts[self.die] >= self.count:
            dice_used = (self.die,) * self.count
            events.append(ScoringEvent(self.name, dice_used, self.damage))
            counts[self.die] -= self.count''')
        self.assert_accepts(8, files)

    def test_fizzbuzz_optional_negative_input_follows_the_learner(self):
        for behavior, implementation, check in (
                ('returns an empty list', 'return []', 'assert fizzbuzz(-1) == []'),
                ('raises its own message', 'raise ValueError("n cannot be negative")',
                 'with pytest.raises(ValueError, match="cannot be negative"):\n'
                 '        fizzbuzz(-1)')):
            with self.subTest(behavior=behavior):
                files = solution_files(CONFIG['steps'][9])
                files['fizzbuzz.py'] = replaced(
                    files['fizzbuzz.py'],
                    'raise ValueError(f"n must be non-negative, got {n}")', implementation)
                files['test_fizzbuzz.py'] = replaced(
                    files['test_fizzbuzz.py'],
                    'with pytest.raises(ValueError, match="non-negative"):\n'
                    '        fizzbuzz(-1)', check)
                self.assert_accepts(9, files)

    def test_learners_may_name_tests_freely(self):
        files = solution_files(CONFIG['steps'][5])
        files['test_scorer.py'] = files['test_scorer.py'].replace('def test_', 'def test_renamed_')
        self.assert_accepts(5, files)

    def test_cycle_three_accepts_a_lookup_refactor_but_not_a_loop(self):
        model = solution_files(CONFIG['steps'][4])
        branches = '''    if dice == [1]:
        return BattleReport((
            ScoringEvent("Dragon Flame", (1,), 100),
        ))
    if dice == [5]:
        return BattleReport((
            ScoringEvent("Lightning Spark", (5,), 50),
        ))
    return BattleReport()'''
        lookup = {**model, 'scorer.py': replaced(model['scorer.py'], branches, '''    singles = {1: ("Dragon Flame", 100), 5: ("Lightning Spark", 50)}
    if len(dice) == 1 and dice[0] in singles:
        name, damage = singles[dice[0]]
        return BattleReport((ScoringEvent(name, (dice[0],), damage),))
    return BattleReport()''')}
        self.assert_accepts(4, lookup)
        loop = {**model, 'scorer.py': replaced(model['scorer.py'], branches, '''    events = []
    for die in dice:
        if die == 1:
            events.append(ScoringEvent("Dragon Flame", (1,), 100))
        if die == 5:
            events.append(ScoringEvent("Lightning Spark", (5,), 50))
    return BattleReport(tuple(events))''')}
        self.assertEqual(self.failures(4, loop), ['score() does not loop over the dice yet'])

    def test_order_guardrail_is_required(self):
        files = solution_files(CONFIG['steps'][6])
        tree = ast.parse(files['test_scorer.py'])
        tree.body = [node for node in tree.body if not (
            isinstance(node, ast.FunctionDef)
            and node.name == 'test_event_order_follows_the_rules_not_the_roll')]
        files['test_scorer.py'] = ast.unparse(tree)
        self.assertEqual(self.failures(6, files),
                         ['Your tests detect wrong damage and events for [5, 1]'])

    def test_fizzbuzz_reports_each_missing_partition(self):
        files = solution_files(CONFIG['steps'][9])
        files['test_fizzbuzz.py'] = '''from fizzbuzz import fizzbuzz

def test_zero():
    assert fizzbuzz(0) == []

def test_numbers():
    assert fizzbuzz(2) == ['1', '2']

def test_three():
    assert fizzbuzz(3)[-1] == 'Fizz'

def test_fifteen():
    assert fizzbuzz(15)[-1] == 'FizzBuzz'
'''
        self.assertEqual(self.failures(9, files),
                         ['Your tests detect a wrong result for multiples of 5'])

    def test_collection_errors_and_skips_do_not_demonstrate_detection(self):
        for replacement in ('import missing_library\n',
                            'import pytest\npytest.skip("unfinished", allow_module_level=True)\n'):
            with self.subTest(source=replacement):
                files = solution_files(CONFIG['steps'][3])
                files['test_scorer.py'] = replacement
                self.assertFalse(self.check(3, files)[0]['passed'])

    def test_green_check_requires_an_executed_test(self):
        files = solution_files(CONFIG['steps'][1])
        files['test_scorer.py'] = '# deleted test\n'
        results = self.check(1, files)
        self.assertFalse(next(item for item in results
                              if item.get('description', '').startswith('Taught'))['passed'])


if __name__ == '__main__':
    if '--candidate' in sys.argv:
        candidate = json.load(sys.stdin)
        print(json.dumps(run_candidate(candidate['step'], candidate['files'])))
    else:
        unittest.main()
