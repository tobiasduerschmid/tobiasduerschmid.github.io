"""Exercise the refresher's actual grading commands against student solutions.

Run with: python3 -m unittest discover -s scripts/tests -p test_cs131_python_checks.py
Requires PyYAML, as do the repository's other tutorial authoring scripts.
Each candidate runs in a disposable subprocess so broken recursion or a cyclic
linked list cannot wedge the test runner or contaminate a later submission.
"""

import contextlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest

import yaml


REPO = Path(__file__).resolve().parents[2]
TUTORIAL = REPO / "_data/tutorials/cs131-refresher.yml"


def source(text):
    return textwrap.dedent(text).strip() + "\n"


POINT = source('''
    class Point:
        def __init__(self, x=0, y=0):
            self.x_, self.y_ = x, y
        def display(self):
            print(self.x_, ', ', self.y_)
    def modify(p):
        p.x_ = 50
        p = Point(20, 30)
''')

REFERENCES = POINT + source('''
    def swap_coords(point):
        point.x_, point.y_ = point.y_, point.x_
    def swap_points(first, second):
        first, second = second, first
''')

RECURSION = source('''
    def find_biggest(values):
        if len(values) == 1:
            return values[0]
        return max(values[0], find_biggest(values[1:]))
    def index_of_biggest(values):
        if len(values) == 1:
            return 0
        previous = index_of_biggest(values[:-1])
        return len(values) - 1 if values[-1] > values[previous] else previous
''')

DELETE = source('''
    def del_item(values, item):
        if not values:
            return []
        rest = del_item(values[1:], item)
        if values[0] != item:
            rest.insert(0, values[0])
        return rest
''')

LINKED = source('''
    class List:
        class Node:
            def __init__(self, value):
                self.val, self.next = value, None
        def __init__(self):
            self.head = None
        def add_to_front(self, val):
            node = self.Node(val)
            node.next, self.head = self.head, node
        def values(self):
            answer, cursor = [], self.head
            while cursor is not None:
                answer.append(cursor.val)
                cursor = cursor.next
            return answer
        def print_items(self):
            for value in self.values():
                print(value)
''')

# Rebuilding an equal-valued tail still violates the promise to leave nodes and
# links unchanged, even though a second traversal would print the same values.
REBUILD_LINKED_TAIL = source('''
    def duplicate_nodes(node, node_type):
        if node is None:
            return None
        duplicate = node_type(node.val)
        duplicate.next = duplicate_nodes(node.next, node_type)
        return duplicate
''')


VALID_ALTERNATIVES = {
    1: {
        "homework punctuation and tuple assignment": POINT,
        "formatted display and renamed receiver": source('''
            class Point:
                def __init__(point, x=0, y=0):
                    point.x_ = x
                    point.y_ = y
                def display(point):
                    print(' ( {} , {} ) '.format(point.x_, point.y_))
            def modify(point):
                point.x_ = 50
                point = Point(20, 30)
        '''),
    },
    2: {
        "simultaneous swaps and renamed parameters": REFERENCES,
        "temporary-variable swaps": POINT + source('''
            def swap_coords(p):
                saved = p.x_
                p.x_ = p.y_
                p.y_ = saved
            def swap_points(left, right):
                saved = left
                left = right
                right = saved
        '''),
    },
    4: {
        "prefix recursion and max of recursive candidates": RECURSION,
        "nested recursive helpers with indices": source('''
            def find_biggest(values):
                def scan(offset, best):
                    if offset == len(values):
                        return best
                    return scan(offset + 1, max(best, values[offset]))
                return scan(1, values[0])
            def index_of_biggest(values):
                def scan(offset, best):
                    if offset == len(values):
                        return best
                    candidate = offset if values[offset] > values[best] else best
                    return scan(offset + 1, candidate)
                return scan(1, 0)
        '''),
        "mutating maximum traversal is permitted by homework 3a": RECURSION.replace(
            "return max(values[0], find_biggest(values[1:]))",
            "first = values.pop(0)\n    return max(first, find_biggest(values))",
        ),
    },
    5: {
        "mutating a fresh result is allowed": DELETE,
        "recursive helper and private accumulator": source('''
            def del_item(values, item):
                result = []
                def collect(offset):
                    if offset == len(values):
                        return
                    if values[offset] != item:
                        result.append(values[offset])
                    collect(offset + 1)
                collect(0)
                return result
        '''),
        "single-item shortcut with separate empty case": source('''
            def del_item(values, item):
                if not values:
                    return []
                if len(values) == 1:
                    return [] if values[0] == item else values[:]
                middle = len(values) // 2
                return del_item(values[:middle], item) + del_item(values[middle:], item)
        '''),
    },
    7: {
        "simultaneous link updates": LINKED,
        "recursive traversal and whitespace variations": LINKED.replace(
            "answer, cursor = [], self.head\n        while cursor is not None:\n"
            "            answer.append(cursor.val)\n            cursor = cursor.next\n        return answer",
            "def walk(node):\n            if node is None:\n                return []\n"
            "            return [node.val] + walk(node.next)\n        return walk(self.head)",
        ).replace("print(value)", "print(' ', value, ' ')")
    },
}


INVALID_SOLUTIONS = {
    1: {
        "coordinates reversed": POINT.replace("self.x_, self.y_ = x, y", "self.x_, self.y_ = y, x"),
        "missing defaults": POINT.replace("x=0, y=0", "x, y"),
        "hardcoded display": POINT.replace("print(self.x_, ', ', self.y_)", "print('(3, 4)')"),
        "return instead of print": POINT.replace("print(self.x_, ', ', self.y_)", "return (self.x_, self.y_)"),
        "prints correctly but returns a value": POINT.replace("print(self.x_, ', ', self.y_)", "print(self.x_, ', ', self.y_)\n        return (self.x_, self.y_)"),
        "different rebinding behavior": POINT.replace("p = Point(20, 30)", "p.x_, p.y_ = 20, 30"),
    },
    2: {
        "coordinate overwrite": REFERENCES.replace("point.x_, point.y_ = point.y_, point.x_", "point.x_ = point.y_\n    point.y_ = point.x_"),
        "no swap attempted": REFERENCES.replace("first, second = second, first", "pass"),
        "both parameters assigned unrelated values": REFERENCES.replace("first, second = second, first", "first = None\n    second = None"),
        "both parameters become the second object": REFERENCES.replace("first, second = second, first", "first = second\n    second = first"),
        "mutates caller objects": REFERENCES.replace("first, second = second, first", "first.x_, second.x_ = second.x_, first.x_\n    first, second = second, first"),
    },
    4: {
        "all-negative maximum initialized to zero": RECURSION.replace("return values[0]", "return max(0, values[0])"),
        "wrong singleton index": RECURSION.replace("return 0", "return 1"),
        "float indices cannot index Python lists": RECURSION.replace("return 0", "return 0.0").replace("previous = index_of_biggest(values[:-1])", "previous = int(index_of_biggest(values[:-1]))").replace("return len(values) - 1 if values[-1] > values[previous] else previous", "return float(len(values) - 1 if values[-1] > values[previous] else previous)"),
        "missing index shift": RECURSION.replace("len(values) - 1 if", "len(values) - 2 if"),
        "fractional maximum truncated": RECURSION.replace("return values[0]", "return int(values[0])").replace("max(values[0],", "max(int(values[0]),"),
        "fractional values compared as integers": RECURSION.replace("values[-1] > values[previous]", "int(values[-1]) > int(values[previous])"),
        "dead recursive text does not count": source('''
            def find_biggest(values):
                if False:
                    find_biggest(values[1:])
                return max(values)
            def index_of_biggest(values):
                if False:
                    index_of_biggest(values[1:])
                return values.index(max(values))
        '''),
        "loop hidden in a called helper": RECURSION + source('''
            recursive_biggest = find_biggest
            def loop_helper(values):
                best = values[0]
                for value in values:
                    best = max(best, value)
                return best
            def find_biggest(values):
                if len(values) > 1:
                    find_biggest(values[1:])
                return loop_helper(values)
        '''),
    },
    5: {
        "only first match removed": source('''
            def del_item(values, item):
                if not values:
                    return []
                if values[0] == item:
                    return values[1:]
                return [values[0]] + del_item(values[1:], item)
        '''),
        "input is consumed": DELETE.replace("rest = del_item(values[1:], item)", "rest = del_item(values[1:], item)\n    values.pop()"),
        "no-match output aliases input": DELETE.replace("if not values:", "if item not in values:\n        return values\n    if not values:"),
        "identity instead of equality": DELETE.replace("values[0] != item", "values[0] is not item"),
        "tuple instead of list": DELETE.replace("return rest", "return tuple(rest)"),
        "generator expression": source('''
            def del_item(values, item):
                if not values:
                    return []
                rest = del_item(values[1:], item)
                return list(value for value in values[:1] if value != item) + rest
        '''),
    },
    7: {
        "old chain discarded": LINKED.replace("node.next, self.head = self.head, node", "self.head = node"),
        "insertion makes a cycle": LINKED.replace("node.next, self.head = self.head, node", "self.head = node\n        node.next = self.head"),
        "values hardcoded to sample": LINKED.replace("return answer", "return [3, 2, 1]"),
        "values consumes the head": LINKED.replace("cursor = cursor.next", "cursor = cursor.next\n            self.head = cursor"),
        "all printed on one line": LINKED.replace("print(value)", "print(value, end=' ' )"),
        "insertion returns the node": LINKED.replace("node.next, self.head = self.head, node", "node.next, self.head = self.head, node\n        return node"),
        "values replaces an equal-valued tail": REBUILD_LINKED_TAIL + LINKED.replace("return answer", "if self.head is not None:\n            self.head.next = duplicate_nodes(self.head.next, self.Node)\n        return answer"),
        "printing replaces an equal-valued tail": REBUILD_LINKED_TAIL + LINKED.replace("print(value)", "print(value)\n        if self.head is not None:\n            self.head.next = duplicate_nodes(self.head.next, self.Node)"),
    },
}


def evaluate_candidate(step, candidate, timeout=5, previous_candidate=None):
    """Run the published check commands against one isolated submission."""
    with tempfile.TemporaryDirectory(prefix="cs131-check-") as directory:
        workspace = Path(directory)
        filename = Path(step["files"][0]["path"]).name
        (workspace / filename).write_text(candidate)
        payload = {
            "commands": [test["command"].replace("/tutorial/", str(workspace) + "/") for test in step["tests"]],
            "previous_candidate": previous_candidate,
        }
        result = subprocess.run(
            [sys.executable, str(Path(__file__).resolve()), "--candidate"],
            input=json.dumps(payload), text=True, capture_output=True, timeout=timeout,
        )
        if result.returncode:
            raise AssertionError(f"Candidate runner failed: {result.stderr}")
        return json.loads(result.stdout)


class RefresherPythonChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tutorial = yaml.safe_load(TUTORIAL.read_text())

    def test_published_solutions_pass_every_check(self):
        for index in VALID_ALTERNATIVES:
            step = self.tutorial["steps"][index]
            candidate = step["solution"]["files"][0]["content"]
            with self.subTest(step=index + 1):
                self.assertEqual(evaluate_candidate(step, candidate), [])

    def test_correct_alternatives_are_accepted(self):
        for index, alternatives in VALID_ALTERNATIVES.items():
            for name, candidate in alternatives.items():
                with self.subTest(step=index + 1, solution=name):
                    self.assertEqual(evaluate_candidate(self.tutorial["steps"][index], candidate), [])

    def test_plausible_wrong_solutions_are_rejected(self):
        for index, alternatives in INVALID_SOLUTIONS.items():
            for name, candidate in alternatives.items():
                with self.subTest(step=index + 1, solution=name):
                    self.assertTrue(evaluate_candidate(self.tutorial["steps"][index], candidate), "Incorrect solution passed all checks")

    def test_missing_definitions_cannot_reuse_a_previous_submission(self):
        for index in VALID_ALTERNATIVES:
            step = self.tutorial["steps"][index]
            previous = step["solution"]["files"][0]["content"]
            with self.subTest(step=index + 1):
                failures = evaluate_candidate(step, "pass\n", previous_candidate=previous)
                self.assertEqual(len(failures), len(step["tests"]), "A check reused stale definitions")

    def test_nonterminating_candidate_is_bounded(self):
        with self.assertRaises(subprocess.TimeoutExpired):
            evaluate_candidate(self.tutorial["steps"][4], "while True:\n    pass\n", timeout=0.5)


def run_candidate():
    failures = []
    payload = json.load(sys.stdin)
    for index, command in enumerate(payload["commands"]):
        namespace = {}
        if payload["previous_candidate"]:
            with contextlib.redirect_stdout(io.StringIO()):
                exec(compile(payload["previous_candidate"], "<previous-submission>", "exec"), namespace)
        try:
            exec(compile(command, "<tutorial-check>", "exec"), namespace)
        except Exception as error:
            failures.append(f"Check {index + 1}: {type(error).__name__}: {error}")
    print(json.dumps(failures))


if __name__ == "__main__":
    if "--candidate" in sys.argv:
        run_candidate()
    else:
        unittest.main()
