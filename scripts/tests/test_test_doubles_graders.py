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
    exec(reference.SOURCE, reference.__dict__)
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
    source = test_file.read_text()
    original = 'patch("quest_service.send_push", autospec=True)'
    assert original in source
    test_file.write_text('import quest_service\n' + source.replace(
        original, 'patch.object(quest_service, "send_push", autospec=True)'))
    assert all(run_gates(workspace, step))


@pytest.mark.parametrize('binding', ['push_notifier.send_push', 'send_push'])
def test_autospec_can_use_the_defining_module_callable(workspace, binding):
    step = seed(workspace, 4)
    test_file = workspace / 'test_celebrate.py'
    notifier = workspace / 'push_notifier.py'
    original_notifier = notifier.read_text()
    source = test_file.read_text()
    original = 'patch("quest_service.send_push", autospec=True)'
    assert original in source
    source = source.replace(original, f'patch("quest_service.send_push", autospec={binding})')
    test_file.write_text('import push_notifier\nfrom push_notifier import send_push\n' + source)
    assert all(run_gates(workspace, step))
    assert notifier.read_text() == original_notifier


def test_autospecced_instance_is_a_valid_library_spy(workspace):
    step = seed(workspace, 3)
    test_file = workspace / 'test_quest_service.py'
    source = test_file.read_text().replace('from unittest.mock import Mock',
                                         'from unittest.mock import Mock, create_autospec')
    source = source.replace('ledger = Mock()', 'ledger = create_autospec(Ledger, instance=True)')
    test_file.write_text('class Ledger:\n    def credit(self, user_id, gold): pass\n\n' + source)
    assert all(run_gates(workspace, step))


@pytest.mark.parametrize('oracle', [
    'assert spy.calls[0][1] <= 100',
    'assert len(spy.calls) == 1 and spy.calls[0][1] == 100',
    'assert ("u3", 100) in spy.calls',
])
def test_long_streak_requires_exact_reward_recipient_and_count(workspace, oracle):
    step = seed(workspace, 2)
    test_file = workspace / 'test_quest_service.py'
    source = test_file.read_text().replace('assert spy.calls == [("u3", 100)]', oracle)
    test_file.write_text(source)
    assert not all(run_gates(workspace, step))


def test_api_failure_requires_the_exact_fallback(workspace):
    step = seed(workspace, 3)
    test_file = workspace / 'test_quest_service.py'
    source = test_file.read_text().replace(
        'assert service.daily_quest_title("u1") == "No quests today"',
        'assert "No quests" in service.daily_quest_title("u1")')
    test_file.write_text(source)
    assert not all(run_gates(workspace, step))


@pytest.mark.parametrize('step_index', [2, 3])
def test_index_first_then_count_is_a_valid_interaction_oracle(workspace, step_index):
    step = seed(workspace, step_index)
    test_file = workspace / 'test_quest_service.py'
    source = test_file.read_text().replace(
        'assert spy.calls == [("u2", 50)]',
        'assert spy.calls[0] == ("u2", 50)\n    assert len(spy.calls) == 1')
    source = source.replace(
        'ledger.credit.assert_called_once_with("u9", 70)',
        'assert ledger.credit.call_args_list[0].args == ("u9", 70)\n'
        '    assert ledger.credit.call_count == 1')
    test_file.write_text(source)
    assert all(run_gates(workspace, step))


def test_loose_sut_patch_does_not_demonstrate_signature_protection(workspace):
    step = seed(workspace, 4)
    test_file = workspace / 'test_celebrate.py'
    source = test_file.read_text()
    start = source.index('def test_celebrate_milestone_sends_push():')
    end = source.index('\ndef ', start + 1)
    source = source[:start] + source[start:end].replace(', autospec=True', '') + source[end:]
    test_file.write_text(source)
    notifier = workspace / 'push_notifier.py'
    original_notifier = notifier.read_text()
    assert not all(run_gates(workspace, step))
    assert notifier.read_text() == original_notifier


@pytest.mark.parametrize('body', [
    'assert True',
    'from unittest.mock import patch\n'
    '    with patch("xp_calculator._sum_xp", return_value=200):\n'
    '        assert compute_total_xp([]) == 200',
])
def test_clean_suite_must_exercise_the_real_behavior(workspace, body):
    step = seed(workspace, 5)
    test_file = workspace / 'test_xp_clean.py'
    source = test_file.read_text()
    start = source.index('def test_total_xp_for_two_completed_quests():')
    test_file.write_text(source[:start] + '\n'.join(
        f'def test_case_{index}():\n    {body}\n' for index in range(2)))
    assert not all(run_gates(workspace, step))


def test_transfer_requires_the_requested_album_lookup(workspace):
    step = seed(workspace, 5)
    test_file = workspace / 'test_release_alert.py'
    source = test_file.read_text()
    original = 'catalog.is_released.side_effect = lambda album: album == "midnight-mix"'
    assert original in source
    source = source.replace(original, 'catalog.is_released.return_value = True')
    test_file.write_text(source)
    assert not all(run_gates(workspace, step))


def test_transfer_accepts_a_mock_with_a_callable_spec(workspace):
    step = seed(workspace, 5)
    test_file = workspace / 'test_release_alert.py'
    source = test_file.read_text()
    original = 'notifier = create_autospec(Notifier, instance=True)'
    assert original in source
    source = source.replace(original,
        'notifier = Mock()\n    notifier.send = Mock(spec=lambda user_id, message: None)')
    test_file.write_text(source)
    assert all(run_gates(workspace, step))


@pytest.mark.parametrize('replacement', [
    'notifier.send.assert_called_once()',
    'notifier.send.assert_called_with("listener-9", "Now playing: midnight-mix")',
    'assert True',
])
def test_transfer_requires_complete_notification_observation(workspace, replacement):
    step = seed(workspace, 5)
    test_file = workspace / 'test_release_alert.py'
    source = test_file.read_text()
    original = 'notifier.send.assert_called_once_with("listener-9", "Now playing: midnight-mix")'
    assert original in source
    test_file.write_text(source.replace(original, replacement))
    assert not all(run_gates(workspace, step))


@pytest.mark.parametrize('expectation_based', [False, True])
def test_transfer_accepts_handwritten_doubles_and_helper_tests(workspace, expectation_based):
    step = seed(workspace, 5)
    spy = '''
class NotificationDouble:
    def __init__(self, expected):
        self.expected = expected
        self.calls = []

    def send(self, user_id, message):
        self.calls.append((user_id, message))

    def verify(self):
        assert self.calls == self.expected
'''
    if expectation_based:
        spy = '''
class NotificationDouble:
    def __init__(self, expected):
        self.remaining = list(expected)

    def send(self, user_id, message):
        assert self.remaining, "Unexpected notification"
        assert self.remaining.pop(0) == (user_id, message)

    def verify(self):
        assert not self.remaining, "Missing notification"
'''
    source = '''
from release_alert import announce_release
ROLE_REASON = "Catalog supplies controlled inputs; notification double checks the outgoing request."

class CatalogStub:
    def __init__(self, released):
        self.released = released
    def is_released(self, album_id):
        return album_id in self.released
''' + spy + '''
def check_release(user, album, released):
    catalog = CatalogStub({album} if released else set())
    notifier = NotificationDouble([(user, "Now playing: " + album)] if released else [])
    assert announce_release(user, album, catalog, notifier) is released
    notifier.verify()

def test_released_album_announces():
    check_release("new-listener", "different-album", True)

def test_unreleased_album_stays_quiet():
    check_release("another-listener", "future-album", False)
'''
    (workspace / 'test_release_alert.py').write_text(source)
    assert all(run_gates(workspace, step))
