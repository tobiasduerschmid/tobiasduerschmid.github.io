"""Exercise the authored checks with valid alternatives and weak learner tests."""

import ast
import importlib.util
from pathlib import Path
import sys
import types

import pytest
import yaml


ROOT = Path(__file__).resolve().parents[2]
TUTORIAL = yaml.safe_load((ROOT / '_data/tutorials/test-doubles.yml').read_text())


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    monkeypatch.syspath_prepend(str(tmp_path))
    spec = importlib.util.spec_from_file_location(
        'tutorial_test_grading', ROOT / 'assets/tutorials/python_test_grading.py')
    grader = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(grader)
    monkeypatch.setitem(sys.modules, 'tutorial_test_grading', grader)
    reference = types.ModuleType('tutorial_test_doubles_reference')
    reference.SOURCE = (ROOT / 'assets/tutorials/test_doubles_reference.py').read_text()
    monkeypatch.setitem(sys.modules, 'tutorial_test_doubles_reference', reference)
    yield tmp_path
    for name, module in list(sys.modules.items()):
        filename = getattr(module, '__file__', '') or ''
        if filename and Path(filename).is_relative_to(tmp_path):
            sys.modules.pop(name, None)


def seed(workspace, step_index, solution=True):
    step = TUTORIAL['steps'][step_index]
    for file in step['files']:
        (workspace / file['path']).write_text(file['content'])
    if solution:
        for file in step['solution']['files']:
            (workspace / file['path']).write_text(file['content'])
    return step


def run_gates(workspace, step):
    outcomes = []
    for gate in step['tests']:
        command = gate['command'].replace('/tutorial/', str(workspace) + '/')
        try:
            exec(compile(command, '<tutorial check>', 'exec'), {})
        except AssertionError:
            outcomes.append(False)
        else:
            outcomes.append(True)
    return outcomes


@pytest.mark.parametrize('step_index', range(6))
def test_model_solutions_pass(workspace, step_index):
    step = seed(workspace, step_index)
    assert all(run_gates(workspace, step))


@pytest.mark.parametrize('step_index', [1, 2, 3])
def test_comments_and_equivalent_assertions_do_not_change_credit(workspace, step_index):
    step = seed(workspace, step_index)
    test_file = workspace / 'test_quest_service.py'
    source = test_file.read_text()
    # These are the actual starter comments that previously caused false failures.
    starter = next(file['content'] for file in step['files'] if file['path'] == test_file.name)
    comments = '\n'.join(line for line in starter.splitlines() if line.lstrip().startswith('#'))
    source = source.replace('assert service.daily_quest_title("u456") == "Battle the Lich King"',
                            "actual = service.daily_quest_title(user_id='u456')\n    assert 'Battle the Lich King' == actual")
    source = source.replace('assert spy.calls == [("u2", 50)]', "assert [('u2', 50)] == spy.calls")
    source = source.replace('service.award_streak_bonus("u3", 12)', "service.award_streak_bonus(user_id='u3', days=12)")
    source = source.replace('ledger = Mock()', "ledger = Mock(name='reward ledger')")
    source = source.replace('service.award_streak_bonus("u9", 7)', "service.award_streak_bonus(user_id='u9', days=7)")
    test_file.write_text(source + '\n' + comments + '\n')
    assert all(run_gates(workspace, step))


def test_clock_seam_rejects_an_always_false_function(workspace):
    step = seed(workspace, 0)
    (workspace / 'quest_service.py').write_text(
        'import datetime\n'
        'def is_today_event_day(event_date_str, clock=datetime.datetime):\n'
        '    clock.now()\n'
        '    return False\n')
    assert not all(run_gates(workspace, step))


@pytest.mark.parametrize('step_index', [1, 2, 3, 4])
def test_named_assert_true_tests_cannot_earn_completion(workspace, step_index):
    step = seed(workspace, step_index)
    test_file = workspace / step['run_file']
    tree = ast.parse(test_file.read_text())
    names = [node.name for node in tree.body if isinstance(node, ast.FunctionDef) and node.name.startswith('test_')]
    test_file.write_text('\n'.join(f'def {name}():\n    assert True\n' for name in names))
    assert not all(run_gates(workspace, step))


def test_friday_substring_oracle_is_not_credited(workspace):
    step = seed(workspace, 1)
    test_file = workspace / 'test_quest_service.py'
    test_file.write_text(test_file.read_text().replace(
        'assert service.daily_quest_title("u789") == "No quests today"',
        'assert "No quests today" in service.daily_quest_title("u789")'))
    assert not all(run_gates(workspace, step))


def test_library_spy_must_verify_call_count(workspace):
    step = seed(workspace, 3)
    test_file = workspace / 'test_quest_service.py'
    test_file.write_text(test_file.read_text().replace(
        'ledger.credit.assert_called_once_with("u9", 70)',
        'ledger.credit.assert_called_with("u9", 70)'))
    assert not all(run_gates(workspace, step))


def test_patch_object_is_accepted(workspace):
    step = seed(workspace, 4)
    test_file = workspace / 'test_celebrate.py'
    test_file.write_text('import quest_service\n' + test_file.read_text().replace(
        'patch("quest_service.send_push")', 'patch.object(quest_service, "send_push")'))
    assert all(run_gates(workspace, step))


def test_autospecced_instance_is_a_valid_library_spy(workspace):
    step = seed(workspace, 3)
    test_file = workspace / 'test_quest_service.py'
    source = test_file.read_text().replace('from unittest.mock import Mock',
                                         'from unittest.mock import Mock, create_autospec')
    source = source.replace('ledger = Mock()', 'ledger = create_autospec(Ledger, instance=True)')
    test_file.write_text('class Ledger:\n    def credit(self, user_id, gold): pass\n\n' + source)
    assert all(run_gates(workspace, step))
