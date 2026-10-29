"""Check learner-test grading through real pytest runs in isolated workspaces."""

import importlib.util
from pathlib import Path
import sys

import pytest


ROOT = Path(__file__).resolve().parents[2]
REFERENCE = 'def credits():\n    return [("u2", 50)]\n'
MISSING_CREDIT = 'def credits():\n    return []\n'
OBSERVE_THEN_COUNT = '''from rewards import credits

def test_credit():
    calls = credits()
    assert calls[0] == ("u2", 50)
    assert len(calls) == 1
'''


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location(
        'grading_helper_under_test', ROOT / 'assets/tutorials/python_test_grading.py')
    grader = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(grader)
    monkeypatch.syspath_prepend(str(tmp_path))
    module = tmp_path / 'rewards.py'
    module.write_text(REFERENCE)
    test_file = tmp_path / 'test_rewards.py'
    test_file.write_text(OBSERVE_THEN_COUNT)
    yield grader.check_suite, test_file, module
    for name, loaded in list(sys.modules.items()):
        filename = getattr(loaded, '__file__', '') or ''
        if filename and Path(filename).is_relative_to(tmp_path):
            sys.modules.pop(name, None)


def test_missing_call_can_be_detected_before_the_count_assertion(workspace):
    check, test_file, module = workspace
    check(test_file, 'rewards', REFERENCE)
    check(test_file, 'rewards', MISSING_CREDIT, expect_failure=True,
          allowed_mutation_errors=(IndexError,))
    assert module.read_text() == REFERENCE


def test_observation_errors_require_explicit_permission_for_that_mutant(workspace):
    check, test_file, _ = workspace
    with pytest.raises(AssertionError, match='must reject this changed behavior'):
        check(test_file, 'rewards', MISSING_CREDIT, expect_failure=True)


@pytest.mark.parametrize('assertion', [
    'assert calls == [("u2", 50)]',
    'if calls != [("u2", 50)]:\n        pytest.fail("wrong credit")',
])
def test_ordinary_assertion_failures_still_detect_mutants(workspace, assertion):
    check, test_file, _ = workspace
    test_file.write_text('import pytest\nfrom rewards import credits\n'
                         'def test_credit():\n    calls = credits()\n    ' + assertion + '\n')
    check(test_file, 'rewards', REFERENCE)
    check(test_file, 'rewards', MISSING_CREDIT, expect_failure=True)


@pytest.mark.parametrize('outcome', [
    'raise RuntimeError("IndexError: list index out of range")',
    'raise ValueError("unrelated failure")',
    'raise SystemExit(0)',
    'pytest.skip("not exercised")',
])
def test_allowed_observation_error_does_not_credit_other_failures(workspace, outcome):
    check, test_file, module = workspace
    test_file.write_text('import pytest\ndef test_credit():\n    ' + outcome + '\n')
    with pytest.raises(AssertionError):
        check(test_file, 'rewards', MISSING_CREDIT, expect_failure=True,
              allowed_mutation_errors=(IndexError,))
    assert module.read_text() == REFERENCE


@pytest.mark.parametrize('source', [
    'def test_broken_syntax(:\n    pass\n',
    'def helper_without_a_test():\n    pass\n',
    '''import pytest
@pytest.fixture
def recording():
    raise IndexError("fixture setup failed")
def test_credit(recording):
    assert recording == [("u2", 50)]
''',
    '''import pytest
@pytest.fixture
def recording():
    yield [("u2", 50)]
    raise IndexError("fixture teardown failed")
def test_credit(recording):
    assert recording == [("u2", 50)]
''',
])
def test_collection_and_fixture_errors_never_count_as_mutant_detection(workspace, source):
    check, test_file, _ = workspace
    test_file.write_text(source)
    with pytest.raises(AssertionError):
        check(test_file, 'rewards', MISSING_CREDIT, expect_failure=True,
              allowed_mutation_errors=(IndexError,))


def test_mutation_error_allowance_does_not_relax_passing_reference_checks(workspace):
    check, test_file, _ = workspace
    with pytest.raises(AssertionError, match='must pass on this valid implementation'):
        check(test_file, 'rewards', MISSING_CREDIT,
              allowed_mutation_errors=(IndexError,))
