#!/usr/bin/env python3
"""Integration tests against the actual Java bridge and pinned upstream TLA+ engine."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / "js/vendor/tlaplus/1.8.0-fc6878c603f0"
JAVA = "java"
COUNTER = r"""---- MODULE Spec ----
EXTENDS Naturals
VARIABLE x
Init == x = 0
Next == x < 3 /\ x' = x + 1
Bound == x <= 3
TooSmall == x < 2
Watch == x * 2
====
"""


def request(source=COUNTER, config="INIT Init\nNEXT Next\nINVARIANT Bound\nCHECK_DEADLOCK FALSE", **options):
    return {"operation": "check", "files": {"Spec.tla": source, "Spec.cfg": config},
            "entry": "Spec.tla", "config": "Spec.cfg", **options}


def run(*requests):
    completed = subprocess.run(
        [JAVA, "-Xmx512m", "-cp", os.pathsep.join(str(VENDOR / file) for file in
         ["tla2tools.jar", "sebook-tla-bridge.jar"]), "sebook.tla.Bridge"],
        input="".join(json.dumps(item) + "\n" for item in requests),
        text=True, capture_output=True, timeout=40, check=True)
    return [json.loads(line) for line in completed.stdout.splitlines() if line.strip()]


def variable(state, name):
    return next(value for value in state["values"] if value["name"] == name)


class BridgeContract(unittest.TestCase):
    def test_finite_model_is_complete_only_after_exhaustive_check(self):
        result = run(request())[0]
        self.assertEqual("complete", result["status"], result)
        self.assertEqual("exhausted-state-space", result["reason"])
        self.assertEqual("4", result["stats"]["distinct"])

    def test_invariant_failure_contains_actual_shortest_trace(self):
        result = run(request(config="INIT Init\nNEXT Next\nINVARIANT TooSmall"))[0]
        self.assertEqual("counterexample", result["status"], result)
        self.assertEqual("invariant", result["trace"]["kind"])
        self.assertEqual(["0", "1", "2"], [variable(s, "x")["text"] for s in result["trace"]["states"]])
        self.assertEqual("Spec.tla", result["trace"]["states"][1]["location"]["file"])

    def test_deadlock_is_a_counterexample_not_a_success(self):
        result = run(request(config="INIT Init\nNEXT Next"))[0]
        self.assertEqual("counterexample", result["status"], result)
        self.assertEqual("deadlock", result["reason"])
        self.assertEqual("3", variable(result["trace"]["states"][-1], "x")["text"])

    def test_liveness_failure_retains_cycle_destination(self):
        source = r"""---- MODULE Spec ----
EXTENDS Naturals
VARIABLE x
Init == x = 0
Next == x' = 1 - x
Spec == Init /\ [][Next]_x
EventuallyTwo == <>(x = 2)
====
"""
        result = run(request(source, "SPECIFICATION Spec\nPROPERTY EventuallyTwo"))[0]
        self.assertEqual("counterexample", result["status"], result)
        self.assertEqual("liveness", result["reason"])
        self.assertGreaterEqual(result["trace"]["loopIndex"], 0)
        self.assertLess(result["trace"]["loopIndex"], len(result["trace"]["states"]))

    def test_pluscal_is_translated_by_upstream_before_checking(self):
        source = r"""---- MODULE Spec ----
EXTENDS Naturals
(* --algorithm Count
variables x = 0;
begin
Increment: x := x + 1;
end algorithm; *)
Bound == x <= 1
====
"""
        result = run(request(source, "SPECIFICATION Spec\nINVARIANT Bound", translatePlusCal=True))[0]
        self.assertEqual("complete", result["status"], result)
        self.assertIn("BEGIN TRANSLATION", result["generatedFiles"]["Spec.tla"])

    def test_pluscal_counterexample_points_to_the_original_algorithm(self):
        source = """---- MODULE Spec ----
EXTENDS Naturals
(* --algorithm Count
variables x = 0;
begin
Increment: x := x + 1;
end algorithm; *)
Bound == x < 1
====
"""
        result = run(request(source, "SPECIFICATION Spec\nINVARIANT Bound", translatePlusCal=True))[0]
        location = result["trace"]["states"][1]["location"]
        self.assertEqual("counterexample", result["status"])
        self.assertEqual(6, location["line"])
        self.assertGreater(location["generatedLocation"]["line"], location["line"])

    def test_assessment_harness_checks_its_property_despite_a_weakened_learner_config(self):
        source = COUNTER.replace("MODULE Spec", "MODULE Model")
        harness = "---- MODULE SEBookTutorialCheck ----\nEXTENDS Model\nSEBookProperty == (x < 2)\n====\n"
        result = run({"operation": "check", "entry": "SEBookTutorialCheck.tla", "config": "SEBookTutorialCheck.cfg", "files": {
            "Model.tla": source,
            "Model.cfg": "INIT Init\nNEXT Next\nCHECK_DEADLOCK FALSE",
            "SEBookTutorialCheck.tla": harness,
            "SEBookTutorialCheck.cfg": "INIT Init\nNEXT Next\nCHECK_DEADLOCK FALSE\nINVARIANT SEBookProperty",
        }})[0]
        self.assertEqual("counterexample", result["status"], result)
        self.assertEqual("invariant", result["reason"])
        self.assertEqual("2", variable(result["trace"]["states"][-1], "x")["text"])

    def test_pluscal_dependency_is_translated_beneath_a_trusted_assessment_harness(self):
        source = """---- MODULE Model ----
EXTENDS Naturals
(* --algorithm Count
variables x = 0;
begin
Increment: x := 3;
end algorithm; *)
====
"""
        files = {
            "Model.tla": source,
            "Model.cfg": "SPECIFICATION Spec",
            "SEBookTutorialCheck.tla": "---- MODULE SEBookTutorialCheck ----\nEXTENDS Model\nSEBookProperty == (x <= 2)\n====\n",
            "SEBookTutorialCheck.cfg": "SPECIFICATION Spec\nINVARIANT SEBookProperty",
        }
        req = {"operation": "check", "entry": "SEBookTutorialCheck.tla", "config": "SEBookTutorialCheck.cfg",
               "translatePlusCal": True, "files": files}
        failing = run(req)[0]
        fixed = run({**req, "files": {**files, "Model.tla": source.replace("x := 3", "x := 2")}})[0]
        self.assertEqual("counterexample", failing["status"], failing)
        self.assertEqual("invariant", failing["reason"])
        self.assertEqual("Model.tla", failing["trace"]["states"][1]["location"]["file"])
        self.assertEqual(6, failing["trace"]["states"][1]["location"]["line"])
        self.assertIn("Model.tla", failing["generatedFiles"])
        self.assertNotIn("SEBookTutorialCheck.tla", failing["generatedFiles"])
        self.assertEqual("complete", fixed["status"], fixed)

    def test_missing_config_is_an_error_without_terminating_the_jvm(self):
        missing = request()
        del missing["files"]["Spec.cfg"]
        first, second = run(missing, {"operation": "reset"})
        self.assertEqual("error", first["status"])
        self.assertIn("configuration", first["diagnostics"][0]["message"])
        self.assertEqual("complete", second["status"])

    def test_nested_values_preserve_sets_tuples_records_and_model_values(self):
        source = r"""---- MODULE Spec ----
CONSTANT Atom
VARIABLE value
Init == value = [set |-> {Atom, <<1, 2>>}, tuple |-> <<TRUE, "a">>, function |-> [k \in {Atom} |-> 4]]
Next == UNCHANGED value
====
"""
        result = run(request(source, "INIT Init\nNEXT Next\nCONSTANT Atom = Atom", operation="explore-init"))[0]
        self.assertEqual("complete", result["status"], result)
        value = variable(result["states"][0], "value")
        self.assertEqual("record", value["type"])
        fields = {field["name"]: field for field in value["children"]}
        self.assertEqual("tuple", fields["tuple"]["type"])
        self.assertEqual("function", fields["function"]["type"])
        self.assertEqual({"model-value", "tuple"}, {item["type"] for item in fields["set"]["children"]})

    def test_actions_and_watch_operator_use_the_retained_upstream_state(self):
        initial, choices, watched = run(request(operation="explore-init"),
            {"operation": "explore-next", "stateId": "state-0"},
            {"operation": "evaluate", "stateId": "state-1", "operator": "Watch"})
        self.assertEqual("0", variable(initial["states"][0], "x")["text"])
        self.assertEqual("1", variable(choices["choices"][0]["state"], "x")["text"])
        self.assertEqual("2", watched["value"]["text"])

    def test_new_models_require_a_fresh_jvm_even_after_reset(self):
        first, reset, second = run(
            request(config="INIT Init\nNEXT Next\nINVARIANT TooSmall"),
            {"operation": "reset"},
            request())
        self.assertEqual("counterexample", first["status"])
        self.assertEqual("complete", reset["status"])
        self.assertEqual("error", second["status"], second)
        self.assertEqual("fresh-session-required", second["reason"])

    def test_fresh_liveness_sessions_do_not_keep_a_previous_counterexample(self):
        source = r"""---- MODULE Spec ----
VARIABLE done
Init == done = FALSE
Complete == ~done /\ done' = TRUE
Next == Complete
Spec == Init /\ [][Next]_done
EventuallyDone == <>done
====
"""
        config = "SPECIFICATION Spec\nPROPERTY EventuallyDone\nCHECK_DEADLOCK FALSE"
        failing = run(request(source, config))[0]
        fair_source = source.replace("[][Next]_done", "[][Next]_done /\\ WF_done(Complete)")
        fixed = run(request(fair_source, config))[0]
        self.assertEqual("counterexample", failing["status"], failing)
        self.assertEqual("liveness", failing["reason"])
        self.assertEqual("complete", fixed["status"], fixed)
        self.assertNotIn("trace", fixed)

    def test_sany_reports_semantic_errors_without_model_configuration(self):
        result = run(request(COUNTER.replace("x + 1", "Unknown + 1"), operation="parse"))[0]
        self.assertEqual("error", result["status"])
        self.assertTrue(any("Unknown" in item["message"] for item in result["diagnostics"]), result)

    def test_state_budget_is_incomplete_and_never_claims_verification(self):
        result = run(request(COUNTER.replace("x < 3 /\\ ", ""), config="INIT Init\nNEXT Next", maxStates=100))[0]
        self.assertEqual("incomplete", result["status"], result)
        self.assertEqual("state-limit", result["reason"])

    def test_model_requested_early_exit_cannot_claim_exhaustive_verification(self):
        source = COUNTER.replace("EXTENDS Naturals", "EXTENDS Naturals, TLC")
        source = source.replace("x < 3 /\\", 'TLCSet("exit", TRUE) /\\')
        result = run(request(source))[0]
        self.assertEqual("incomplete", result["status"], result)
        self.assertEqual("engine-stop", result["reason"])

    def test_exit_in_init_cannot_claim_exhaustive_verification(self):
        source = COUNTER.replace("EXTENDS Naturals", "EXTENDS Naturals, TLC")
        source = source.replace("Init == x = 0", 'Init == TLCSet("exit", TRUE) /\\ x = 0')
        result = run(request(source))[0]
        self.assertEqual("incomplete", result["status"], result)
        self.assertEqual("engine-stop", result["reason"])

    def test_exit_is_explicit_even_when_its_final_queue_is_empty(self):
        source = COUNTER.replace("EXTENDS Naturals", "EXTENDS Naturals, TLC")
        source = source.replace("x < 3 /\\ x' = x + 1", 'TLCSet("exit", TRUE) /\\ UNCHANGED x')
        result = run(request(source))[0]
        self.assertEqual("0", result["stats"]["remaining"])
        self.assertEqual("incomplete", result["status"], result)
        self.assertEqual("engine-stop", result["reason"])

    def test_exit_false_preserves_normal_checker_behavior(self):
        source = COUNTER.replace("EXTENDS Naturals", "EXTENDS Naturals, TLC")
        source = source.replace("x < 3 /\\", 'TLCSet("exit", FALSE) /\\ x < 3 /\\')
        result = run(request(source))[0]
        self.assertEqual("complete", result["status"], result)
        self.assertEqual("4", result["stats"]["distinct"])

    def test_truncated_stuttering_trace_keeps_its_full_cycle_destination(self):
        source = r"""---- MODULE Spec ----
EXTENDS Naturals
VARIABLE x
Init == x = 0
Next == x < 3 /\ x' = x + 1
Spec == Init /\ [][Next]_x /\ WF_x(Next)
EventuallyFour == <>(x = 4)
====
"""
        result = run(request(source, "SPECIFICATION Spec\nPROPERTY EventuallyFour\nCHECK_DEADLOCK FALSE", maxTraceStates=2))[0]
        self.assertEqual("counterexample", result["status"], result)
        self.assertEqual("liveness", result["reason"])
        self.assertEqual(3, result["trace"]["fullLoopIndex"])
        self.assertNotIn("loopIndex", result["trace"])

    def test_choice_budget_is_explicit(self):
        source = COUNTER.replace("x = 0", "x \\in 0..9")
        result = run(request(source, operation="explore-init", maxChoices=2))[0]
        self.assertEqual("incomplete", result["status"], result)
        self.assertEqual("choice-limit", result["reason"])
        self.assertEqual(2, len(result["states"]))

    def test_trace_display_limit_keeps_failure_and_marks_truncation(self):
        result = run(request(config="INIT Init\nNEXT Next\nINVARIANT TooSmall", maxTraceStates=2))[0]
        self.assertEqual("counterexample", result["status"])
        self.assertEqual(2, len(result["trace"]["states"]))
        self.assertTrue(result["trace"]["truncated"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--java", default="java")
    args, remaining = parser.parse_known_args()
    JAVA = args.java
    unittest.main(argv=[__file__, *remaining])
