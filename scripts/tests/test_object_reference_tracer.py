"""Behavioral contracts for the browser lab's portable Python tracer."""

import json
from pathlib import Path
import runpy
import sys
import textwrap
import unittest


TRACER_PATH = Path(__file__).resolve().parents[2] / "js/object-reference-tracer.py"
trace_code = runpy.run_path(str(TRACER_PATH))["trace_code"]


def trace(source):
    return json.loads(trace_code(textwrap.dedent(source).strip()))


def bindings(step, scope_name="Global names"):
    scope = next(scope for scope in step["scopes"] if scope["name"] == scope_name)
    return {binding["name"]: binding["target"] for binding in scope["bindings"]}


def objects(step):
    return {obj["id"]: obj for obj in step["objects"]}


def entries(step, identity):
    return {edge["label"]: edge["target"] for edge in objects(step)[identity]["entries"]}


def values(step, identity):
    graph = objects(step)
    return [graph[edge["target"]]["value"] for edge in graph[identity]["entries"]]


class ObjectReferenceTracerTests(unittest.TestCase):
    def test_playback_skips_pure_multiline_definitions_but_keeps_raw_states_and_function_body(self):
        result = trace("""
            def collect(
                item,
                basket=[]
            ):
                basket.append(item)
                return basket
            source = [3]
            answer = collect(source)
        """)
        raw_lines = [step for step in result["steps"] if step["event"] == "line"]
        definitions = [step for step in raw_lines if step["line"] < 5]
        self.assertTrue(definitions, "Raw definition states must remain available")
        self.assertTrue(all(step.get("skipPlayback") for step in definitions))
        visible = [step for step in result["steps"] if not step.get("skipPlayback")]
        self.assertEqual([(step["event"], step["line"]) for step in visible[:4]],
                         [("initial", 0), ("line", 7), ("line", 8), ("line", 5)])
        body = visible[3]
        self.assertEqual(bindings(body, "collect")["item"], bindings(body)["source"])
        self.assertTrue(any(step["event"] == "return" for step in visible))
        self.assertEqual(visible[-1]["event"], "final")

    def test_playback_skips_class_scaffolding_and_methods_but_keeps_attribute_assignment(self):
        result = trace('''
            class Shelf:
                "Shared items."
                pass
                items = []
                def add(self, item):
                    self.items.append(item)
            shelf = Shelf()
            shelf.add(3)
        ''')
        visible = [step for step in result["steps"] if not step.get("skipPlayback")]
        self.assertEqual([(step["event"], step["line"]) for step in visible[:5]],
                         [("initial", 0), ("line", 4), ("line", 7), ("line", 8), ("line", 6)])
        class_events = [step for step in result["steps"] if step["event"] in ("call", "return")
                        and step["scopes"][-1]["name"] == "class body Shelf"]
        self.assertEqual(len(class_events), 2)
        self.assertTrue(all(step.get("skipPlayback") for step in class_events))

    def test_playback_distinguishes_inline_bodies_from_their_definition_line(self):
        for source, scope_name in (("def sample(): return 7\nanswer = sample()", "sample"),
                                   ("class Sample: items = []\nanswer = Sample()", "class body Sample")):
            with self.subTest(source=source):
                result = trace(source)
                definition = next(step for step in result["steps"] if step["event"] == "line")
                body = next(step for step in result["steps"] if step["event"] == "line"
                            and step["scopes"][-1]["name"] == scope_name)
                self.assertEqual(definition["line"], body["line"])
                self.assertTrue(definition.get("skipPlayback"))
                self.assertFalse(body.get("skipPlayback", False))

    def assert_definition_effect_stays_visible(self, definition):
        result = trace("events = []\ndef effect(value):\n    events.append(value)\n    return value\n"
                       + definition)
        self.assertIsNone(result["error"])
        effect_header = next(step for step in result["steps"] if step["event"] == "line"
                             and step["line"] == 5 and len(step["scopes"]) == 1)
        self.assertFalse(effect_header.get("skipPlayback", False))
        effect_body = [step for step in result["steps"] if step["event"] == "line"
                       and step["scopes"][-1]["name"] == "effect"]
        self.assertTrue(effect_body)
        self.assertTrue(all(not step.get("skipPlayback") for step in effect_body))
        self.assertEqual(len(entries(result["steps"][-1], bindings(result["steps"][-1])["events"])), 1)

    def test_playback_keeps_effectful_defaults_decorators_and_bases(self):
        definitions = (
            "def sample(value=effect(3)):\n    return value",
            "@effect\ndef sample():\n    return 3",
            "class Sample(effect(object)):\n    pass",
            "@effect\nclass Sample:\n    pass",
        )
        for definition in definitions:
            with self.subTest(definition=definition):
                self.assert_definition_effect_stays_visible(definition)

    # The lab's Pyodide 0.27 runs Python 3.12, which evaluates annotations when
    # the def executes. From 3.14 (PEP 649) they run only on first access.
    @unittest.skipIf(sys.version_info >= (3, 14), "annotations are not evaluated at definition time")
    def test_playback_keeps_effectful_annotations(self):
        self.assert_definition_effect_stays_visible("def sample(value: effect(int)):\n    return value")

    def test_playback_skips_decorated_function_entry_but_preserves_decorator_execution(self):
        result = trace("""
            def decorate(function):
                return function
            @decorate
            def sample():
                return [3]
            answer = sample()
        """)
        calls = [step for step in result["steps"] if step["event"] == "call"]
        self.assertEqual({step["scopes"][-1]["name"] for step in calls}, {"decorate", "sample"})
        self.assertTrue(all(step.get("skipPlayback") for step in calls))
        self.assertTrue(all(not step.get("skipPlayback") for step in result["steps"]
                            if step["event"] == "return"))
        bodies = [step for step in result["steps"] if step["event"] == "line"
                  and step["line"] in (2, 5)]
        self.assertEqual(len(bodies), 2)
        self.assertTrue(all(not step.get("skipPlayback") for step in bodies))

    def test_playback_does_not_skip_generator_resumption_or_yield_and_return_states(self):
        result = trace("def generate():\n    yield [3]\n    yield [8]\nitems = generate()\nfirst = next(items)\nsecond = next(items)")
        calls = [step for step in result["steps"] if step["event"] == "call"]
        self.assertEqual(len(calls), 2)
        self.assertTrue(calls[0].get("skipPlayback"))
        self.assertFalse(calls[1].get("skipPlayback", False))
        self.assertTrue(all(not step.get("skipPlayback") for step in result["steps"]
                            if step["event"] == "return"))

    def test_playback_never_skips_errors_or_exception_unwinding_in_a_class(self):
        result = trace("class Broken:\n    missing()")
        failures = [step for step in result["steps"] if step["event"] in ("exception", "error", "return")]
        self.assertTrue(any(step["event"] == "return" for step in failures))
        self.assertTrue(all(not step.get("skipPlayback") for step in failures))
        self.assertFalse(result["steps"][0].get("skipPlayback", False))
        self.assertFalse(result["steps"][-1].get("skipPlayback", False))

    def test_line_steps_show_state_before_execution_and_final_shows_completed_state(self):
        result = trace("first = []\nsecond = first")
        first_line = next(step for step in result["steps"] if step["event"] == "line" and step["line"] == 1)
        second_line = next(step for step in result["steps"] if step["event"] == "line" and step["line"] == 2)
        final = result["steps"][-1]
        self.assertEqual(result["steps"][0]["event"], "initial")
        self.assertEqual(bindings(first_line), {})
        self.assertEqual(set(bindings(second_line)), {"first"})
        self.assertEqual(bindings(final)["first"], bindings(final)["second"])
        self.assertEqual((final["event"], final["line"]), ("final", 0))

    def test_mutation_is_shared_but_rebinding_changes_only_one_name(self):
        result = trace("original = [4]\nalias = original\noriginal.append(9)\noriginal = [7]")
        before_rebinding = next(step for step in result["steps"] if step["line"] == 4)
        final = result["steps"][-1]
        self.assertEqual(bindings(before_rebinding)["original"], bindings(before_rebinding)["alias"])
        self.assertEqual(values(before_rebinding, bindings(before_rebinding)["alias"]), ["4", "9"])
        self.assertNotEqual(bindings(final)["original"], bindings(final)["alias"])
        self.assertEqual(values(final, bindings(final)["original"]), ["7"])
        self.assertEqual(values(final, bindings(final)["alias"]), ["4", "9"])

    def test_shallow_copy_has_a_distinct_outer_list_and_shared_nested_list(self):
        result = trace("original = [[11]]\ncopy = original.copy()\ncopy[0].append(12)")
        final = result["steps"][-1]
        names = bindings(final)
        self.assertNotEqual(names["original"], names["copy"])
        self.assertEqual(entries(final, names["original"])["[0]"], entries(final, names["copy"])["[0]"])
        self.assertEqual(values(final, entries(final, names["copy"])["[0]"]), ["11", "12"])

    def test_function_arguments_share_caller_objects_and_return_keeps_local_scope(self):
        result = trace("""
            def update(items):
                items.append(8)
                return items
            source = [3]
            answer = update(source)
        """)
        entered = next(step for step in result["steps"] if step["event"] == "call")
        returned = next(step for step in result["steps"] if step["event"] == "return")
        final = result["steps"][-1]
        self.assertEqual(bindings(entered, "update")["items"], bindings(entered)["source"])
        self.assertEqual(bindings(returned, "update")["(return value)"], bindings(returned)["source"])
        self.assertEqual(values(returned, bindings(returned)["source"]), ["3", "8"])
        self.assertEqual([scope["name"] for scope in final["scopes"]], ["Global names"])
        self.assertEqual(bindings(final)["answer"], bindings(final)["source"])

    def test_nested_calls_return_a_member_alias_after_self_is_rebound(self):
        result = trace("""
            class Bucket:
                def __init__(self, items):
                    self.items = items
                def detach(self):
                    borrowed = self.items
                    self = Bucket([])
                    self.items.append('local')
                    return borrowed
            def retrieve(bucket):
                return bucket.detach()
            owner = Bucket([3])
            answer = retrieve(owner)
            answer.append(8)
        """)
        method_return = next(step for step in result["steps"] if step["event"] == "return"
                             and step["scopes"][-1]["name"] == "detach")
        outer_return = next(step for step in result["steps"] if step["event"] == "return"
                            and step["scopes"][-1]["name"] == "retrieve")
        final = result["steps"][-1]
        caller_items = entries(method_return, bindings(method_return)["owner"])["items"]
        temporary_owner = bindings(method_return, "detach")["self"]
        self.assertEqual([scope["name"] for scope in method_return["scopes"]],
                         ["Global names", "retrieve", "detach"])
        self.assertNotEqual(temporary_owner, bindings(method_return)["owner"])
        self.assertEqual(bindings(method_return, "detach")["borrowed"], caller_items)
        self.assertEqual(bindings(method_return, "detach")["(return value)"], caller_items)
        self.assertEqual(bindings(outer_return, "retrieve")["(return value)"], caller_items)
        self.assertEqual(bindings(final)["answer"], caller_items)
        self.assertEqual(values(final, caller_items), ["3", "8"])
        self.assertNotIn(temporary_owner, objects(final))

    def test_instances_reference_their_class_and_own_member_objects(self):
        result = trace("""
            class Cart:
                shared = []
                def __init__(self):
                    self.own = []
            left = Cart()
            right = Cart()
            left.shared.append('map')
            left.own.append('key')
        """)
        final = result["steps"][-1]
        names = bindings(final)
        left = entries(final, names["left"])
        right = entries(final, names["right"])
        self.assertEqual(left["__class__"], names["Cart"])
        self.assertEqual(right["__class__"], names["Cart"])
        self.assertNotEqual(left["own"], right["own"])
        self.assertEqual(values(final, left["own"]), ["'key'"])
        self.assertEqual(values(final, right["own"]), [])
        self.assertEqual(values(final, entries(final, names["Cart"])["shared"]), ["'map'"])

    def test_class_body_bindings_are_distinguished_from_function_arguments_and_returns(self):
        result = trace("""
            class Station:
                tags = []
            def build():
                return Station()
            station = build()
        """)
        class_entry = next(step for step in result["steps"] if step["event"] == "call"
                           and step["scopes"][-1]["name"] == "class body Station")
        class_exit = next(step for step in result["steps"] if step["event"] == "return"
                          and step["scopes"][-1]["name"] == "class body Station")
        function_exit = next(step for step in result["steps"] if step["event"] == "return"
                             and step["scopes"][-1]["name"] == "build")
        self.assertIn("class attributes", class_entry["note"])
        self.assertNotIn("arguments", class_entry["note"])
        self.assertIn("Finished class body", class_exit["note"])
        self.assertEqual(values(class_exit, bindings(class_exit, "class body Station")["tags"]), [])
        self.assertNotIn("(return value)", bindings(class_exit, "class body Station"))
        self.assertEqual(objects(function_exit)[bindings(function_exit, "build")["(return value)"]]["type"], "Station")

    def test_compiler_class_metadata_is_hidden_without_hiding_ordinary_bindings(self):
        # Explicit metadata also exercises this contract on Python versions
        # before 3.13, whose compiler does not insert these class-body names.
        result = trace("""
            __firstlineno__ = ["global"]
            class Folder:
                __firstlineno__ = 3
                __static_attributes__ = ("files",)
                files = []
            def inspect_names():
                __static_attributes__ = ["local"]
                return __static_attributes__
            local_result = inspect_names()
        """)
        self.assertIsNone(result["error"])
        self.assertFalse(result["truncated"])
        class_states = [step for step in result["steps"]
                        if any(scope["name"] == "class body Folder" for scope in step["scopes"])]
        self.assertTrue(class_states)
        for step in class_states:
            self.assertNotIn("__firstlineno__", bindings(step, "class body Folder"))
            self.assertNotIn("__static_attributes__", bindings(step, "class body Folder"))
        class_exit = next(step for step in class_states if step["event"] == "return")
        self.assertEqual(values(class_exit, bindings(class_exit, "class body Folder")["files"]), [])
        function_exit = next(step for step in result["steps"]
                             if step["event"] == "return" and step["scopes"][-1]["name"] == "inspect_names")
        self.assertEqual(values(function_exit, bindings(function_exit, "inspect_names")["__static_attributes__"]),
                         ["'local'"])
        final = result["steps"][-1]
        self.assertEqual(values(final, bindings(final)["__firstlineno__"]), ["'global'"])
        self.assertEqual(values(final, bindings(final)["local_result"]), ["'local'"])

    def test_cycles_close_on_the_original_object(self):
        result = trace("cycle = []\ncycle.append(cycle)")
        final = result["steps"][-1]
        identity = bindings(final)["cycle"]
        self.assertEqual(entries(final, identity)["[0]"], identity)
        self.assertEqual(len(final["objects"]), 1)

    def test_inherited_storage_is_reached_through_the_base_class(self):
        result = trace("class Base:\n    shared = []\nclass Child(Base):\n    pass\nitem = Child()")
        final = result["steps"][-1]
        names = bindings(final)
        self.assertEqual(entries(final, names["item"])["__class__"], names["Child"])
        self.assertEqual(entries(final, names["Child"])["base 1"], names["Base"])
        self.assertEqual(values(final, entries(final, names["Base"])["shared"]), [])

    def test_dictionary_keys_values_tuples_and_set_members_are_references(self):
        result = trace("key = ('entry',)\nvalue = [6]\nmapping = {key: value}\nmembers = {key}")
        final = result["steps"][-1]
        names = bindings(final)
        self.assertEqual(entries(final, names["mapping"])["key 1"], names["key"])
        self.assertEqual(entries(final, names["mapping"])["value 1"], names["value"])
        self.assertEqual(entries(final, names["members"])["member 1"], names["key"])

    def test_removed_objects_do_not_reappear_in_the_reachable_graph(self):
        result = trace("item = [1]\ndel item\nreplacement = [2]")
        before_delete = next(step for step in result["steps"] if step["line"] == 2)
        old_identity = bindings(before_delete)["item"]
        final = result["steps"][-1]
        self.assertNotIn(old_identity, objects(final))
        self.assertNotEqual(old_identity, bindings(final)["replacement"])

    def test_runtime_errors_retain_prior_assignments_and_report_the_source_line(self):
        result = trace("saved = [5]\nresult = 1 / 0")
        error = next(step for step in result["steps"] if step["event"] == "error")
        self.assertIn("ZeroDivisionError", result["error"])
        self.assertEqual(error["line"], 2)
        self.assertEqual(values(error, bindings(error)["saved"]), ["5"])

    def test_syntax_errors_report_readable_details_without_executing_source(self):
        result = trace("saved = 1\nif True print('no')")
        self.assertIn("SyntaxError", result["error"])
        self.assertEqual(bindings(result["steps"][-1]), {})
        self.assertEqual(next(step for step in result["steps"] if step["event"] == "error")["line"], 2)

    def test_handled_exceptions_continue_to_the_final_assignment(self):
        result = trace("try:\n    answer = 1 / 0\nexcept ZeroDivisionError:\n    answer = 42")
        final = result["steps"][-1]
        self.assertIsNone(result["error"])
        self.assertEqual(objects(final)[bindings(final)["answer"]]["value"], "42")

    def test_line_budget_stops_an_infinite_loop_with_partial_state(self):
        result = trace("count = 0\nwhile True:\n    count += 1")
        self.assertTrue(result["truncated"])
        self.assertIn("trace limit", result["error"])
        self.assertLessEqual(len(result["steps"]), 400)
        self.assertGreater(int(objects(result["steps"][-1])[bindings(result["steps"][-1])["count"]]["value"]), 0)

    def test_stdout_and_stderr_keep_program_order(self):
        result = trace("import sys\nprint('first')\nprint('second', file=sys.stderr)")
        self.assertEqual(result["steps"][-1]["output"], "first\nsecond\n")

    def test_output_limit_is_explicit_and_does_not_prevent_remaining_execution(self):
        result = trace("print('x' * 9000)\nfinished = True")
        final = result["steps"][-1]
        self.assertEqual(len(final["output"]), 8000)
        self.assertTrue(result["truncated"])
        self.assertIn("Output is limited", final["note"])
        self.assertEqual(objects(final)[bindings(final)["finished"]]["value"], "True")

    def test_output_at_the_limit_is_preserved_without_an_omission(self):
        result = trace("print('x' * 8000, end='')")
        self.assertEqual(result["steps"][-1]["output"], "x" * 8000)
        self.assertFalse(result["truncated"])

    def test_empty_source_has_initial_and_final_states(self):
        result = trace("")
        self.assertIsNone(result["error"])
        self.assertEqual(result["steps"][0]["event"], "initial")
        self.assertEqual(result["steps"][-1]["event"], "final")
        self.assertEqual(bindings(result["steps"][-1]), {})

    def test_graph_omissions_are_explicit_and_every_edge_has_a_target(self):
        result = trace("wide = [list(range(i * 20, i * 20 + 20)) for i in range(10)]")
        final = result["steps"][-1]
        graph = objects(final)
        self.assertTrue(result["truncated"])
        self.assertIn("omitted", final["note"])
        self.assertLessEqual(len(graph), 80)
        self.assertTrue(all(edge["target"] in graph for node in graph.values() for edge in node.get("entries", [])))

    def test_inspection_never_calls_user_repr_properties_equality_or_hash(self):
        result = trace("""
            class Meta(type):
                def __hash__(self):
                    raise RuntimeError('metaclass hashing')
            class Quiet(metaclass=Meta):
                def __repr__(self):
                    raise RuntimeError('repr called')
                def __eq__(self, other):
                    raise RuntimeError('equality called')
                def __hash__(self):
                    raise RuntimeError('hash called')
                @property
                def __dict__(self):
                    raise RuntimeError('property called')
                @property
                def trouble(self):
                    raise RuntimeError('property called')
            value = Quiet()
            alias = value
        """)
        self.assertIsNone(result["error"])
        self.assertEqual(bindings(result["steps"][-1])["value"], bindings(result["steps"][-1])["alias"])

    def test_user_globals_do_not_replace_tracer_helpers(self):
        result = trace("json = 3\ntrace_code = 4\nMAX_NODES = 0\nvalue = [5]")
        self.assertIsNone(result["error"])
        self.assertEqual(values(result["steps"][-1], bindings(result["steps"][-1])["value"]), ["5"])


if __name__ == "__main__":
    unittest.main()
