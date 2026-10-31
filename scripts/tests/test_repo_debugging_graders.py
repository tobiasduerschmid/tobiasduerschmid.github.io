"""Replay the repository-debugging tutorial's authored checks on native Python.

Run with ``python3 scripts/tests/test_repo_debugging_graders.py``. Each candidate
materializes one lesson in a temporary directory, as the Pyodide runtime does,
and runs the lesson's actual check commands. Valid repairs and tests must pass
every check; plausible mistakes must fail exactly the checks that describe them,
by assertion. tests/repo-debugging-tutorial.spec.js covers the Pyodide runtime.
"""

import contextlib
import importlib.util
import io
from pathlib import Path
import re
import sys
import tempfile
import unittest

import pytest
import yaml

try:  # optional: the tutorial's editor lints learner files with pyflakes
    from pyflakes.api import check as pyflakes_check
    from pyflakes.reporter import Reporter as PyflakesReporter
except ImportError:
    pyflakes_check = None


ROOT = Path(__file__).resolve().parents[2]
TUTORIAL = yaml.safe_load((ROOT / "_data/tutorials/repo-debugging.yml").read_text())
STEPS = {step["key"]: step for step in TUTORIAL["steps"]}


def _load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


_load("tutorial_test_grading", "assets/tutorials/python_test_grading.py")
GRADING = _load("helpdesk_grading", "assets/tutorials/helpdesk_grading.py")

# The seeded fault in each lesson's starter package.
STARTER_FAULT = {
    "orient": None,
    "reproduce": "reply-not-saved",
    "green-bar": "id-from-count",
    "root-cause": "raw-priority",
    "ai-patches": "reopen-inverted",
    "weakened-test": "any-priority",
    "capstone": "close-saved-early",
}
# Team tests that fail on each starter; the instructions describe these failures.
STARTER_RED_TEAM_TESTS = {
    "orient": set(),
    "reproduce": set(),
    "green-bar": {"test_new_ticket_does_not_overwrite_existing"},
    "root-cause": {"test_queue_accepts_mixed_case_priority"},
    "ai-patches": {"test_reopen_next_day"},
    "weakened-test": set(),
    "capstone": {"test_closing_twice_is_conflict", "test_reopen_next_day"},
}


def files_of(key, solution=False):
    step = STEPS[key]
    files = {item["path"]: item["content"] for item in step["files"]}
    if solution:
        files.update({item["path"]: item["content"] for item in step["solution"].get("files", [])})
    return files


def replaced(source, old, new):
    """Edit lesson source, failing loudly if the edit no longer applies."""
    assert source.count(old) == 1, f"expected one match for:\n{old}"
    return source.replace(old, new)


def apply_diff(source, diff):
    """Apply a single-hunk unified diff body (context, -, + lines) to source."""
    lines = diff.splitlines()
    old = "".join(line[1:] + "\n" for line in lines if line[:1] in " -")
    new = "".join(line[1:] + "\n" for line in lines if line[:1] in " +")
    return replaced(source, old, new)


def regression_test(body):
    """A learner's test_regression.py: the lesson's starter plus one test body."""
    return files_of("reproduce")["test_regression.py"] + "\n\n" + body.strip() + "\n"


@contextlib.contextmanager
def workspace(files):
    with tempfile.TemporaryDirectory(prefix="repo-debugging-") as temporary:
        directory = Path(temporary)
        for path, source in files.items():
            (directory / path).parent.mkdir(parents=True, exist_ok=True)
            (directory / path).write_text(source)
        previous_path = sys.path[:]
        try:
            yield directory
        finally:
            sys.path[:] = previous_path
            GRADING._forget_workspace_modules()


def outcomes(key, files):
    """Run a lesson's check commands; map each description to None or (type, message)."""
    results = {}
    with workspace(files) as directory:
        for check in STEPS[key]["tests"]:
            command = check["command"].replace("/tutorial", str(directory))
            try:
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    exec(command, {})
            except Exception as error:  # recorded and asserted on by the caller
                results[check["description"]] = (type(error).__name__, str(error)[-3000:])
            else:
                results[check["description"]] = None
        for path, source in files.items():
            assert (directory / path).read_text() == source, f"a check left {path} modified"
    return results


class _FailedTests:
    def __init__(self):
        self.failed = set()

    def pytest_runtest_logreport(self, report):
        if report.failed:
            self.failed.add(report.nodeid.split("::")[-1])


def team_failures(files):
    with workspace(files) as directory:
        GRADING.fresh_app(directory)  # puts the workspace first on sys.path
        GRADING._forget_workspace_modules()
        collector = _FailedTests()
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            pytest.main([str(directory / "test_helpdesk.py"), "-q", "-p", "no:cacheprovider"],
                        plugins=[collector])
        return collector.failed


class LessonMaterials(unittest.TestCase):
    def test_every_lesson_reseeds_the_whole_repository(self):
        package = sorted(GRADING.REFERENCE)
        for key, step in STEPS.items():
            with self.subTest(step=key):
                paths = [item["path"] for item in step["files"]]
                learner_test = "test_learning.py" if key == "orient" else "test_regression.py"
                self.assertEqual(sorted(paths), sorted(
                    package + ["README.md", "test_helpdesk.py", learner_test, "debugging_log.md"]))
                self.assertTrue(all(item.get("reseed") for item in step["files"]))
                self.assertIn(step["open_file"], paths)
                self.assertTrue(set(step["run_files"]) <= set(paths))

    def test_starter_package_is_the_reference_plus_the_lessons_fault(self):
        for key, fault in STARTER_FAULT.items():
            with self.subTest(step=key):
                expected = dict(GRADING.REFERENCE)
                if fault:
                    path, source = GRADING.faulty(fault)
                    expected[path] = source
                package = {path: source for path, source in files_of(key).items()
                           if path.startswith("helpdesk/")}
                self.assertEqual(package, expected)

    def test_published_solutions_restore_the_reference_package(self):
        for key in STEPS:
            with self.subTest(step=key):
                package = {path: source for path, source in files_of(key, solution=True).items()
                           if path.startswith("helpdesk/")}
                self.assertEqual(package, GRADING.REFERENCE)

    def test_team_suite_fails_exactly_where_the_instructions_say(self):
        for key, red in STARTER_RED_TEAM_TESTS.items():
            with self.subTest(step=key):
                self.assertEqual(team_failures(files_of(key)), red)
                self.assertEqual(team_failures(files_of(key, solution=True)), set())

    def test_patches_shown_to_learners_are_the_graded_patches(self):
        diffs = re.findall(r"```diff\n(.*?)```", STEPS["ai-patches"]["instructions"], re.S)
        starter = files_of("ai-patches")["helpdesk/service.py"]
        self.assertEqual(len(diffs), 2)
        for diff, fault in zip(diffs, ("patch-a", "patch-b")):
            with self.subTest(patch=fault):
                self.assertEqual(apply_diff(starter, diff), GRADING.faulty(fault)[1])

    def test_pull_request_diff_is_the_weakened_team_test(self):
        [diff] = re.findall(r"```diff\n(.*?)```", STEPS["weakened-test"]["instructions"], re.S)
        restored = files_of("weakened-test", solution=True)["test_helpdesk.py"]
        self.assertEqual(apply_diff(restored, diff), files_of("weakened-test")["test_helpdesk.py"])

    @unittest.skipIf(pyflakes_check is None, "pyflakes is not installed")
    def test_editor_lint_does_not_point_at_the_seeded_faults(self):
        for key in STEPS:
            for path, source in files_of(key).items():
                if path.endswith(".py"):
                    with self.subTest(step=key, path=path):
                        report = io.StringIO()
                        pyflakes_check(source, path, PyflakesReporter(report, report))
                        self.assertEqual(report.getvalue(), "")

    def test_checks_name_only_existing_rules_and_faults(self):
        for key, step in STEPS.items():
            for check in step.get("tests", []):
                with self.subTest(step=key, check=check["description"]):
                    for name in re.findall(r"'([a-z_]+)'", check["command"]):
                        self.assertIn(name, GRADING.RULES)
                    for name in re.findall(r"suite_detects\('[^']+', '([a-z-]+)'\)", check["command"]):
                        self.assertIn(name, GRADING.FAULTS)


class LessonChecks(unittest.TestCase):
    def description(self, key, fragment):
        matches = [check["description"] for check in STEPS[key]["tests"]
                   if fragment in check["description"]]
        self.assertEqual(len(matches), 1, (key, fragment))
        return matches[0]

    def assert_accepted(self, key, changes=None, solution=True):
        files = files_of(key, solution)
        files.update(changes or {})
        failures = {name: result for name, result in outcomes(key, files).items() if result}
        self.assertEqual(failures, {})

    def assert_rejected(self, key, changes, expected, solution=True):
        """Exactly the ``expected`` checks fail, each by assertion; the rest pass."""
        files = files_of(key, solution)
        files.update(changes)
        results = outcomes(key, files)
        failed = {name for name, result in results.items() if result}
        self.assertEqual(failed, {self.description(key, fragment) for fragment in expected}, results)
        for name in failed:
            self.assertEqual(results[name][0], "AssertionError", results[name])

    def test_published_solutions_pass_every_check(self):
        for key in STEPS:
            with self.subTest(step=key):
                self.assert_accepted(key)

    def test_starters_fail_the_lessons_own_checks(self):
        expected = {
            "orient": ["hands out the tickets it keeps"],
            "reproduce": ["original code", "once replies are saved", "fetched again"],
            "green-bar": ["never overwrites", "never reused", "reuses the newest", "correct store"],
            "root-cause": ["mixed case", "new ticket stores", "Changing a ticket", "raw text",
                           "correct code"],
            "ai-patches": ["day 9", "day 10", "saved as open", "Assistant A", "Assistant B",
                           "correct reopen"],
            "weakened-test": ["such as ASAP", "fails again"],
            # The same unsaved close also breaks reopening, which only the catch-all covers.
            "capstone": ["is saved", "leave the queue", "twice", "original code", "correct code",
                         "Every other"],
        }
        for key, fragments in expected.items():
            with self.subTest(step=key):
                self.assert_rejected(key, {}, fragments, solution=False)

    def test_hidden_checks_ignore_edited_team_tests(self):
        trivial = "def test_everything_is_fine():\n    assert True\n"
        for key, fault in STARTER_FAULT.items():
            if key in ("orient", "weakened-test"):
                continue  # their graded artifacts are the editable test files themselves
            with self.subTest(step=key):
                files = files_of(key, solution=True)
                files["test_helpdesk.py"] = trivial
                path, source = GRADING.faulty(fault)
                files[path] = source
                failed = {name for name, result in outcomes(key, files).items() if result}
                self.assertTrue(failed, "an edited team suite hid the seeded fault")
                self.assertTrue(all("regression test" not in name and "Your tests" not in name
                                    for name in failed), failed)

    # ---- Lesson 1: orientation ------------------------------------------------

    def test_orient_accepts_other_learning_tests_that_pin_the_copy(self):
        prefix = files_of("orient")["test_learning.py"]
        for body in (
            "def test_reply_on_loaded_copy_stays_out_of_store():\n"
            "    store = TicketStore()\n"
            "    store.save(Ticket(id=1, title='Lost wristband', priority='normal'))\n"
            "    store.get(1).replies.append({'author': 'Sam', 'text': 'Hi'})\n"
            "    assert store.get(1).replies == []\n",
            "def test_each_get_returns_a_new_object():\n"
            "    store = TicketStore()\n"
            "    store.save(Ticket(id=1, title='Lost wristband', priority='normal'))\n"
            "    assert store.get(1) is not store.get(1)\n",
        ):
            with self.subTest(body=body.splitlines()[0]):
                self.assert_accepted("orient", {"test_learning.py": prefix + "\n\n" + body})

    def test_orient_rejects_learning_tests_that_miss_the_claim(self):
        prefix = files_of("orient")["test_learning.py"]
        wrong_prediction = (
            "def test_changing_a_loaded_ticket_does_not_change_the_store():\n"
            "    store = TicketStore()\n"
            "    store.save(Ticket(id=1, title='Lost wristband', priority='normal'))\n"
            "    store.get(1).title = 'Found it'\n"
            "    assert store.get(1).title == 'Found it'\n")
        self.assert_rejected("orient", {"test_learning.py": prefix + "\n\n" + wrong_prediction},
                             ["pass on the real store", "hands out the tickets it keeps"])
        # The response dictionary is always new, so this cannot observe the store's copies.
        through_api = (
            "from helpdesk import create_app\n\n"
            "def test_changing_a_response_does_not_change_the_ticket():\n"
            "    app = create_app()\n"
            "    ticket = app.post('/tickets', {'title': 'Lost wristband', 'priority': 'low'}).json\n"
            "    ticket['title'] = 'Found it'\n"
            "    assert app.get(f\"/tickets/{ticket['id']}\").json['title'] == 'Lost wristband'\n")
        self.assert_rejected("orient", {"test_learning.py": prefix + "\n\n" + through_api},
                             ["hands out the tickets it keeps"])

    # ---- Lesson 2: reproduce --------------------------------------------------

    def test_reproduce_accepts_other_fixes_and_tests(self):
        starter = files_of("reproduce")["helpdesk/service.py"]
        rebuilt = replaced(starter, "        ticket.replies.append(clean_reply(author, text))\n",
                           "        reply = clean_reply(author, text)\n"
                           "        ticket.replies = [*ticket.replies, reply]\n"
                           "        self.store.save(ticket)\n")
        self.assert_accepted("reproduce", {"helpdesk/service.py": rebuilt})
        through_store = regression_test(
            "def test_reply_reaches_the_store(app):\n"
            "    ticket = create(app)\n"
            "    app.post(f\"/tickets/{ticket['id']}/replies\", {'author': 'Priya', 'text': 'Found it!'})\n"
            "    assert len(app.service.store.get(ticket['id']).replies) == 1\n")
        self.assert_accepted("reproduce", {"test_regression.py": through_store})

    def test_reproduce_rejects_a_test_that_reads_only_the_reply_response(self):
        symptom_only = regression_test(
            "def test_reply_appears(app):\n"
            "    ticket = create(app)\n"
            "    response = app.post(f\"/tickets/{ticket['id']}/replies\", {'author': 'Priya', 'text': 'Hi'})\n"
            "    assert response.status == 201\n"
            "    assert response.json['replies'] == [{'author': 'Priya', 'text': 'Hi'}]\n")
        self.assert_rejected("reproduce", {"test_regression.py": symptom_only}, ["original code"])

    def test_reproduce_rejects_removing_the_stores_copies(self):
        self.assert_rejected("reproduce", {
            "helpdesk/service.py": files_of("reproduce")["helpdesk/service.py"],
            "helpdesk/store.py": GRADING.faulty("live-objects")[1],
        }, ["hands out copies"])

    # ---- Lesson 3: green bar --------------------------------------------------

    def test_green_bar_accepts_other_id_sources_and_assertions(self):
        store = files_of("green-bar", solution=True)["helpdesk/store.py"]
        with_count = replaced(replaced(replaced(
            store, '"""\nimport copy\n', '"""\nimport copy\nimport itertools\n'),
            "        self._last_id = 0\n", "        self._ids = itertools.count(1)\n"),
            "        self._last_id += 1\n        return self._last_id\n",
            "        return next(self._ids)\n")
        self.assert_accepted("green-bar", {"helpdesk/store.py": with_count})
        increasing = regression_test(
            "def test_new_id_is_larger_than_any_deleted_id(app):\n"
            "    create(app)\n"
            "    newest = create(app)\n"
            "    app.delete(f\"/tickets/{newest['id']}\")\n"
            "    assert create(app)['id'] > newest['id']\n")
        self.assert_accepted("green-bar", {"test_regression.py": increasing})

    def test_green_bar_rejects_the_max_plus_one_fix(self):
        self.assert_rejected("green-bar", {"helpdesk/store.py": GRADING.faulty("id-from-max")[1]},
                             ["never reused"])

    def test_green_bar_rejects_a_test_that_deletes_the_oldest_ticket(self):
        oldest = regression_test(
            "def test_delete_then_create(app):\n"
            "    first = create(app)\n"
            "    second = create(app)\n"
            "    app.delete(f\"/tickets/{first['id']}\")\n"
            "    assert create(app)['id'] not in (first['id'], second['id'])\n")
        self.assert_rejected("green-bar", {"test_regression.py": oldest}, ["reuses the newest"])

    # ---- Lesson 4: root cause -------------------------------------------------

    def test_root_cause_accepts_rebinding_and_a_queue_based_test(self):
        starter = files_of("root-cause")["helpdesk/service.py"]
        rebound = starter.replace("        clean_priority(priority)\n",
                                  "        priority = clean_priority(priority)\n")
        self.assertEqual(rebound.count("priority = clean_priority(priority)"), 2)
        self.assert_accepted("root-cause", {"helpdesk/service.py": rebound})
        through_queue = regression_test(
            "def test_changed_priority_keeps_the_queue_working(app):\n"
            "    ticket = create(app, 'Shuttle times', 'low')\n"
            "    app.post(f\"/tickets/{ticket['id']}/priority\", {'priority': 'URGENT'})\n"
            "    assert app.get('/queue').status == 200\n")
        self.assert_accepted("root-cause", {"test_regression.py": through_queue})

    def test_root_cause_rejects_normalizing_only_in_the_queue(self):
        starter = files_of("root-cause")["helpdesk/service.py"]
        symptom_fix = replaced(starter, "PRIORITY_RANK[ticket.priority]",
                               "PRIORITY_RANK[ticket.priority.lower()]")
        self.assert_rejected("root-cause", {"helpdesk/service.py": symptom_fix},
                             ["new ticket stores", "Changing a ticket"])

    def test_root_cause_rejects_repairing_creation_only(self):
        self.assert_rejected("root-cause",
                             {"helpdesk/service.py": GRADING.faulty("raw-priority-change")[1]},
                             ["Changing a ticket"])

    def test_root_cause_rejects_a_test_of_the_creation_path(self):
        creation = regression_test(
            "def test_mixed_case_creation_is_lowercased(app):\n"
            "    ticket = create(app, 'Shuttle times', 'High')\n"
            "    assert app.get(f\"/tickets/{ticket['id']}\").json['priority'] == 'high'\n")
        self.assert_rejected("root-cause", {"test_regression.py": creation}, ["raw text"])

    # ---- Lesson 5: AI patches -------------------------------------------------

    def test_ai_patches_accept_other_repairs_and_one_combined_test(self):
        starter = files_of("ai-patches")["helpdesk/service.py"]
        negated = replaced(starter, "        if day - ticket.closed_on <= REOPEN_WINDOW_DAYS:\n",
                           "        if not day - ticket.closed_on <= REOPEN_WINDOW_DAYS:\n")
        self.assert_accepted("ai-patches", {"helpdesk/service.py": negated})
        patch_b_saved = replaced(GRADING.faulty("patch-b")[1],
                                 '        ticket.status, ticket.closed_on = "open", None\n',
                                 '        ticket.status, ticket.closed_on = "open", None\n'
                                 '        self.store.save(ticket)\n')
        self.assert_accepted("ai-patches", {"helpdesk/service.py": patch_b_saved})
        combined = regression_test(
            "def test_day_seven_reopen_is_saved(app):\n"
            "    ticket = create(app)\n"
            "    app.post(f\"/tickets/{ticket['id']}/close\", {'day': 2})\n"
            "    assert app.post(f\"/tickets/{ticket['id']}/reopen\", {'day': 9}).status == 200\n"
            "    assert app.get(f\"/tickets/{ticket['id']}\").json['status'] == 'open'\n")
        self.assert_accepted("ai-patches", {"test_regression.py": combined})

    def test_ai_patches_reject_applying_either_patch(self):
        self.assert_rejected("ai-patches", {"helpdesk/service.py": GRADING.faulty("patch-a")[1]},
                             ["day 9"])
        self.assert_rejected("ai-patches", {"helpdesk/service.py": GRADING.faulty("patch-b")[1]},
                             ["saved as open"])

    def test_ai_patches_reject_tests_that_catch_only_one_patch(self):
        day_nine = regression_test(
            "def test_day_nine(app):\n"
            "    ticket = create(app)\n"
            "    app.post(f\"/tickets/{ticket['id']}/close\", {'day': 2})\n"
            "    assert app.post(f\"/tickets/{ticket['id']}/reopen\", {'day': 9}).status == 200\n")
        self.assert_rejected("ai-patches", {"test_regression.py": day_nine}, ["Assistant B"])
        reload_only = regression_test(
            "def test_reopen_is_saved(app):\n"
            "    ticket = create(app)\n"
            "    app.post(f\"/tickets/{ticket['id']}/close\", {'day': 2})\n"
            "    app.post(f\"/tickets/{ticket['id']}/reopen\", {'day': 4})\n"
            "    assert app.get(f\"/tickets/{ticket['id']}\").json['status'] == 'open'\n")
        self.assert_rejected("ai-patches", {"test_regression.py": reload_only}, ["Assistant A"])

    # ---- Lesson 6: weakened test ----------------------------------------------

    def test_weakened_test_accepts_another_validation_spelling(self):
        validation = replaced(
            files_of("weakened-test", solution=True)["helpdesk/validation.py"],
            "    if not isinstance(priority, str) or priority.strip().lower() not in PRIORITY_RANK:\n"
            "        raise ValidationError(f\"priority must be one of: {', '.join(PRIORITY_RANK)}\")\n"
            "    return priority.strip().lower()\n",
            "    cleaned = priority.strip().lower() if isinstance(priority, str) else None\n"
            "    if cleaned not in PRIORITY_RANK:\n"
            "        raise ValidationError(f\"unknown priority: {priority!r}\")\n"
            "    return cleaned\n")
        self.assert_accepted("weakened-test", {"helpdesk/validation.py": validation})

    def test_weakened_test_rejects_keeping_the_agents_test(self):
        self.assert_rejected("weakened-test",
                             {"test_helpdesk.py": files_of("weakened-test")["test_helpdesk.py"]},
                             ["fails again"])

    def test_weakened_test_rejects_restoring_the_test_without_fixing_the_code(self):
        self.assert_rejected("weakened-test",
                             {"helpdesk/validation.py": files_of("weakened-test")["helpdesk/validation.py"]},
                             ["such as ASAP"])

    def test_weakened_test_rejects_case_sensitive_validation(self):
        strict = replaced(files_of("weakened-test", solution=True)["helpdesk/validation.py"],
                          "priority.strip().lower() not in PRIORITY_RANK", "priority not in PRIORITY_RANK")
        self.assert_rejected("weakened-test", {"helpdesk/validation.py": strict},
                             ["any letter case", "Every other"])

    # ---- Lesson 7: capstone ---------------------------------------------------

    def test_capstone_accepts_a_redundant_second_save(self):
        starter = files_of("capstone")["helpdesk/service.py"]
        twice = replaced(starter, '        ticket.closed_on = day\n        return ticket.to_dict()\n',
                         '        ticket.closed_on = day\n        self.store.save(ticket)\n'
                         '        return ticket.to_dict()\n')
        self.assert_accepted("capstone", {"helpdesk/service.py": twice})

    def test_capstone_rejects_the_assistants_queue_patch(self):
        starter = files_of("capstone")["helpdesk/service.py"]
        assistant = replaced(starter, 'if ticket.status == "open"]', 'if ticket.status != "closed"]')
        self.assert_rejected("capstone", {"helpdesk/service.py": assistant},
                             ["is saved", "leave the queue", "twice", "Every other"])

    def test_capstone_rejects_a_test_of_the_close_response(self):
        response_only = regression_test(
            "def test_close_response(app):\n"
            "    ticket = create(app)\n"
            "    response = app.post(f\"/tickets/{ticket['id']}/close\", {'day': 2})\n"
            "    assert response.json['status'] == 'closed'\n")
        self.assert_rejected("capstone", {"test_regression.py": response_only}, ["original code"])


if __name__ == "__main__":
    unittest.main()
