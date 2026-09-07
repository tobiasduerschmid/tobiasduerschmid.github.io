"""Validate the refresher's actual C++ checks against correct and incorrect code.

Run with: python3 -m unittest discover -s scripts/tests -p test_cs131_cpp_checks.py
Requires PyYAML and a local clang++ or g++ compiler. This exercises the grading
oracles with native C++17; browser-worker execution is covered separately.
"""

from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

import yaml


REPO = Path(__file__).resolve().parents[2]
TUTORIAL = REPO / "_data/tutorials/cs131-refresher.yml"
POINT = '''
#include <iostream>
using namespace std;
class Point {
public:
    Point(int x = 0, int y = 0) : x_(x), y_(y) {}
    void display() const { cout << x_ << "," << y_ << "\\n"; }
    int x_, y_;
};
'''
VALUE = "void modify_by_value(Point p) { p = Point(20, 30); }\n"
REFERENCE = "void modify_by_reference(Point& p) { p = Point(20, 30); }\n"
POINTER = "void modify_by_pointer(Point* p) { *p = Point(20, 30); }\n"


def variant(value=VALUE, reference=REFERENCE, pointer=POINTER, prefix="", suffix=""):
    return POINT + prefix + value + reference + pointer + suffix


VALID_ALTERNATIVES = {
    "direct whole-object assignment": variant(),
    "renamed parameters and separate member assignments": variant(
        value="void modify_by_value(Point item) { item.x_=20; item.y_=30; }",
        reference="void modify_by_reference(Point& target) { target.y_=30; target.x_=20; }",
        pointer="void modify_by_pointer(Point* target) { (*target).y_=30; (*target).x_=20; }",
    ),
    "helper function with a learner driver": variant(
        prefix="void assign_target(Point& target) { target = Point(20,30); }\n",
        reference="void modify_by_reference(Point& q) { assign_target(q); }",
        pointer="void modify_by_pointer(Point* q) { assign_target(*q); }",
        suffix="\nint main() { Point sample; sample.display(); }\n",
    ),
    "logging with different display formatting": variant(
        reference='void modify_by_reference(Point& q) { q=Point(20,30); cout << "updated\\n"; }',
        pointer="void modify_by_pointer(Point* q) { *q=Point(20,30); q->display(); }",
    ),
}

# Each vector names the expected result of value, reference, and pointer checks.
# A mistake in one completed function must not hide another function's success.
INCORRECT_IMPLEMENTATIONS = {
    "by-value function accidentally aliases its argument": (
        variant(value="void modify_by_value(Point& p) { p = Point(20,30); }"),
        [False, True, True],
    ),
    "reference function takes a copy": (
        variant(reference="void modify_by_reference(Point p) { p = Point(20,30); }"),
        [True, False, True],
    ),
    "reference function changes only x": (
        variant(reference="void modify_by_reference(Point& p) { p.x_ = 20; }"),
        [True, False, True],
    ),
    "reference only handles the first starting point": (
        variant(reference="void modify_by_reference(Point& p) { if (p.x_==10 && p.y_==10) p = Point(20,30); }"),
        [True, False, True],
    ),
    "pointer is rebound to a heap allocation": (
        variant(pointer="void modify_by_pointer(Point* p) { p = new Point(20,30); delete p; }"),
        [True, True, False],
    ),
    "pointer modifies x then is rebound": (
        variant(pointer="void modify_by_pointer(Point* p) { p->x_=50; p = new Point(20,30); delete p; }"),
        [True, True, False],
    ),
    "pointer changes a local copy": (
        variant(pointer="void modify_by_pointer(Point* p) { Point copy=*p; copy=Point(20,30); }"),
        [True, True, False],
    ),
    "pointer changes only y": (
        variant(pointer="void modify_by_pointer(Point* p) { p->y_=30; }"),
        [True, True, False],
    ),
    "pointer only handles the first starting point": (
        variant(pointer="void modify_by_pointer(Point* p) { if (p->x_==10 && p->y_==10) *p=Point(20,30); }"),
        [True, True, False],
    ),
    "no-ops with hardcoded driver output": (
        variant(
            value="void modify_by_value(Point p) {}",
            reference="void modify_by_reference(Point& p) {}",
            pointer="void modify_by_pointer(Point* p) {}",
            suffix='\nint main() { cout << "(10, 10)\\n(20, 30)\\n(20, 30)\\n"; return 0; }\n',
        ),
        [True, False, False],
    ),
    "swapped final coordinates": (
        variant(
            reference="void modify_by_reference(Point& p) { p=Point(30,20); }",
            pointer="void modify_by_pointer(Point* p) { *p=Point(30,20); }",
        ),
        [True, False, False],
    ),
}


def compile_and_run(compiler, workspace, entry_file):
    executable = workspace / "program"
    compiled = subprocess.run(
        [compiler, "-std=c++17", "-Wall", "-Wextra", "-I", str(workspace),
         str(entry_file), "-o", str(executable)],
        capture_output=True, text=True, timeout=30,
    )
    if compiled.returncode:
        return {"passed": False, "phase": "compile", "message": compiled.stderr}
    try:
        result = subprocess.run(
            [str(executable)], capture_output=True, text=True, timeout=2,
        )
    except subprocess.TimeoutExpired:
        return {"passed": False, "phase": "timeout", "message": "Program exceeded two seconds."}
    return {"passed": result.returncode == 0, "phase": "run",
            "message": result.stderr, "output": result.stdout}


class CppParameterChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tutorial = yaml.safe_load(TUTORIAL.read_text())
        cls.step = cls.tutorial["steps"][0]
        cls.compiler = shutil.which("clang++") or shutil.which("g++")
        if not cls.compiler:
            raise RuntimeError("Install clang++ or g++ to validate the C++ tutorial checks.")

    def grade(self, candidate, commands=None):
        commands = commands if commands is not None else self.step["tests"]
        results = []
        with tempfile.TemporaryDirectory(prefix="cs131-cpp-checks-") as directory:
            workspace = Path(directory)
            learner_file = workspace / "cs131/param_passing.cpp"
            learner_file.parent.mkdir()
            learner_file.write_text(candidate)
            for check in commands:
                entry = workspace / "check.cpp"
                entry.write_text(check["command"])
                results.append(compile_and_run(self.compiler, workspace, entry))
        return results

    def assert_grades(self, candidate, expected):
        results = self.grade(candidate)
        self.assertEqual([result["passed"] for result in results], expected, results)
        self.assertTrue(all(result["phase"] == "run" for result in results), results)

    def test_published_solution_passes_all_checks(self):
        self.assert_grades(self.step["solution"]["files"][0]["content"], [True, True, True])

    def test_equivalent_implementations_pass_without_matching_source_or_output(self):
        for name, candidate in VALID_ALTERNATIVES.items():
            with self.subTest(implementation=name):
                self.assert_grades(candidate, [True, True, True])

    def test_incorrect_implementations_fail_the_relevant_check(self):
        for name, (candidate, expected) in INCORRECT_IMPLEMENTATIONS.items():
            with self.subTest(implementation=name):
                self.assert_grades(candidate, expected)

    def test_starter_can_run_and_only_the_completed_value_example_passes(self):
        self.assert_grades(self.step["files"][0]["content"], [True, False, False])

    def test_missing_definition_cannot_reuse_a_previous_success(self):
        reference_check = [self.step["tests"][1]]
        self.assertTrue(self.grade(variant(), reference_check)[0]["passed"])
        missing = self.grade(variant(reference=""), reference_check)[0]
        self.assertFalse(missing["passed"], missing)
        self.assertEqual(missing["phase"], "compile", missing)

    def test_nonterminating_candidate_is_bounded_in_native_validation(self):
        candidate = variant(pointer="void modify_by_pointer(Point* p) { while (true) {} }")
        result = self.grade(candidate, [self.step["tests"][2]])[0]
        self.assertFalse(result["passed"], result)
        self.assertEqual(result["phase"], "timeout", result)

    def test_cpp_starters_and_solutions_have_runnable_drivers(self):
        for step in self.tutorial["steps"]:
            if step.get("backend") != "cpp":
                continue
            for version, files in [("starter", step["files"]), ("solution", step["solution"]["files"])]:
                with self.subTest(step=step["title"], version=version):
                    with tempfile.TemporaryDirectory(prefix="cs131-cpp-driver-") as directory:
                        workspace = Path(directory)
                        for file in files:
                            target = workspace / file["path"]
                            target.parent.mkdir(parents=True, exist_ok=True)
                            target.write_text(file["content"])
                        result = compile_and_run(self.compiler, workspace, workspace / step["run_file"])
                        self.assertTrue(result["passed"], result)
                        self.assertTrue(result["output"].strip(), "The example driver should display its result.")


if __name__ == "__main__":
    unittest.main()
