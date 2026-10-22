"""Run tutorial-authored reference/mutant checks against a learner's pytest suite.

This is diagnostic grading, not a security boundary against hostile test code.
The caller supplies the independent implementation; learner files are restored
after every run, including collection errors and failed assertions.
"""

import contextlib
import importlib
import io
from pathlib import Path
import sys

import pytest


class _Reports:
    def __init__(self):
        self.collected = []
        self.reports = []

    def pytest_collection_finish(self, session):
        self.collected = list(session.items)

    def pytest_runtest_logreport(self, report):
        self.reports.append(report)


def _clear_workspace_imports(directory):
    """Make repeated in-browser pytest runs observe the current file contents."""
    for name, module in list(sys.modules.items()):
        filename = getattr(module, "__file__", "") or ""
        if filename and Path(filename).is_relative_to(directory):
            sys.modules.pop(name, None)
    # CPython and Pyodide can otherwise reuse bytecode after a same-size edit.
    for cache in directory.glob("__pycache__/*.pyc"):
        cache.unlink()
    importlib.invalidate_caches()


def _is_assertion_failure(report):
    if report.when != "call" or not report.failed:
        return False
    crash = getattr(report.longrepr, "reprcrash", None)
    message = getattr(crash, "message", "")
    return message.startswith(("AssertionError", "assert ", "Failed:"))


def check_suite(test_file, module_name, replacement_source=None,
                expect_failure=False, test_name=None, min_tests=1):
    """Require passing tests, or a genuine assertion failure on one mutant.

    ``module_name`` names a module beside ``test_file``. ``test_name`` optionally
    selects an explicitly required test. Mutant checks cannot pass on collection
    errors, skipped tests, fixture failures, or unrelated runtime exceptions.
    Callers also run a passing reference check to validate the same suite.
    """
    test_path = Path(test_file).resolve()
    directory = test_path.parent
    module_path = directory / (module_name.replace(".", "/") + ".py")
    original = module_path.read_text()
    reports = _Reports()
    output = io.StringIO()
    previous_bytecode = sys.dont_write_bytecode
    target = str(test_path) + ("::" + test_name if test_name else "")
    try:
        if replacement_source is not None:
            module_path.write_text(replacement_source)
        sys.dont_write_bytecode = True
        _clear_workspace_imports(directory)
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            status = pytest.main(
                [target, "-q", "--tb=short", "-p", "no:cacheprovider"],
                plugins=[reports],
            )
    finally:
        module_path.write_text(original)
        _clear_workspace_imports(directory)
        sys.dont_write_bytecode = previous_bytecode

    details = output.getvalue()[-12000:]
    assert len(reports.collected) >= min_tests, (
        f"Expected at least {min_tests} runnable test case(s); "
        f"collected {len(reports.collected)}.\n{details}"
    )
    calls = [report for report in reports.reports if report.when == "call"]
    assert len(calls) == len(reports.collected) and not any(
        report.skipped or (report.failed and report.when != "call")
        for report in reports.reports
    ), f"Every selected test must run without skips or fixture errors.\n{details}"
    if expect_failure:
        failures = [report for report in calls if report.failed]
        assert status == 1 and failures and all(
            _is_assertion_failure(report) for report in failures
        ), (
            "The suite must reject this changed behavior with an assertion; "
            "a passing suite or an unrelated error does not demonstrate detection.\n"
            + details
        )
    else:
        assert status == 0 and all(report.passed for report in calls), (
            "The suite must pass on this valid implementation.\n" + details
        )
