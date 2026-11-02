#!/usr/bin/env python3
"""Exercise the JSON boundary against the pinned OSATE engine, without mocks."""
import argparse
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parent.parent
JAVA = "java"
LIB = ROOT / "js/vendor/aadl/0.3.0"
SOURCE = (ROOT / "docs/aadl/examples/flow-budget.aadl").read_text()


def execute(source=SOURCE, root="Rover_Budget::Loop.budget", operation="analyze", filename="model.aadl"):
    bridge = LIB / "sebook-aadl-bridge.jar"
    if not bridge.is_file():
        raise AssertionError("The real OSATE JSON bridge has not been built.")
    request = {"version": 1, "operation": operation, "files": {filename: source}, "root": root}
    result = subprocess.run([JAVA, "-Xmx512m", "-cp", str(LIB / "*"), "sebook.aadl.Bridge"],
                            input=json.dumps(request), text=True, capture_output=True, timeout=60)
    if result.returncode:
        raise AssertionError(result.stderr)
    return json.loads(result.stdout)


def execute_sequence(sources):
    requests = [{"version": 1, "operation": "analyze", "files": {"model.aadl": source}, "root": "Rover_Budget::Loop.budget"} for source in sources]
    process = subprocess.run([JAVA, "-Xmx512m", "-cp", str(LIB / "*"), "sebook.aadl.Bridge"],
                             input="\n".join(json.dumps(item) for item in requests), text=True, capture_output=True, timeout=60)
    if process.returncode:
        raise AssertionError(process.stderr)
    return [json.loads(line) for line in process.stdout.splitlines() if line.strip()]


class BridgeContract(unittest.TestCase):
    def test_reused_engine_isolates_changed_failed_invalid_and_repaired_snapshots(self):
        results = execute_sequence([
            SOURCE,
            SOURCE.replace("0 ms .. 25 ms", "0 ms .. 21 ms"),
            SOURCE.replace(" {Latency => 8 ms .. 12 ms;}", ""),
            SOURCE.replace("speed: out data port Speed", "speed: in data port Speed"),
            SOURCE,
        ])
        self.assertEqual(5, len(results))
        self.assertEqual(["complete", "complete", "complete", "invalid", "complete"], [item["status"] for item in results])
        self.assertEqual([22.0, 22.0, 10.0, 22.0], [results[index]["analyses"][0]["results"][0]["maximumMs"] for index in [0, 1, 2, 4]])
        self.assertTrue(any(item["severity"] == "error" for item in results[1]["analyses"][0]["results"][0]["diagnostics"]))
        self.assertNotIn("model", results[3])
        self.assertEqual(25.0, results[4]["analyses"][0]["results"][0]["maximumRequirementMs"])

    def test_source_navigation_preserves_authored_subdirectories(self):
        result = execute(operation="validate", filename="architecture/model.aadl")
        self.assertEqual("complete", result["status"], result)
        self.assertEqual("architecture/model.aadl", result["model"]["components"][0]["source"]["file"])

    def test_projection_uses_instantiated_components_and_connection_endpoints(self):
        result = execute(operation="validate")
        self.assertEqual("complete", result["status"], result)
        model = result["model"]
        components = {item["name"]: item for item in model["components"]}
        self.assertEqual({"sensor", "control", "actuator"}, {item["name"] for item in model["components"] if item["parentId"] is not None})
        self.assertEqual("device", components["sensor"]["category"])
        self.assertEqual("Rover_Budget::Controller", components["control"]["classifier"])
        self.assertEqual("model.aadl", components["control"]["source"]["file"])
        endpoints = {feature["id"] for item in model["components"] for feature in item["features"]}
        self.assertEqual(2, len(model["connections"]))
        for connection in model["connections"]:
            self.assertIn(connection["source"], endpoints)
            self.assertIn(connection["target"], endpoints)
            self.assertEqual(model["rootId"], connection["segments"][0]["contextId"])

    def test_latency_preserves_native_range_and_bound(self):
        result = execute()
        self.assertEqual("complete", result["status"], result)
        flow = result["analyses"][0]["results"][0]
        self.assertEqual([18.0, 22.0], [flow["minimumMs"], flow["maximumMs"]])
        self.assertEqual(25.0, flow["maximumRequirementMs"])
        self.assertEqual("SUCCESS", flow["resultType"])

    def test_changed_requirement_can_violate_without_changing_the_computed_range(self):
        result = execute(SOURCE.replace("0 ms .. 25 ms", "0 ms .. 21 ms"))
        flow = result["analyses"][0]["results"][0]
        self.assertEqual(22.0, flow["maximumMs"])
        self.assertTrue(any(item["severity"] == "error" for item in flow["diagnostics"]))

    def test_missing_allocation_exposes_missing_property_despite_native_success(self):
        result = execute(SOURCE.replace(" {Latency => 8 ms .. 12 ms;}", ""))
        flow = result["analyses"][0]["results"][0]
        self.assertEqual([10.0, 10.0], [flow["minimumMs"], flow["maximumMs"]])
        controller_flow = next(item for item in result["model"]["flows"] if item["name"] == "control")
        self.assertFalse(controller_flow["latency"]["present"])

    def test_equivalent_units_keep_the_native_result(self):
        result = execute(SOURCE.replace("8 ms .. 12 ms", "8000 us .. 12000 us"))
        self.assertEqual(22.0, result["analyses"][0]["results"][0]["maximumMs"])

    def test_invalid_direction_never_returns_a_previous_model(self):
        result = execute(SOURCE.replace("speed: out data port Speed", "speed: in data port Speed"))
        self.assertEqual("invalid", result["status"], result)
        self.assertNotIn("model", result)
        self.assertTrue(any(item["severity"] == "error" and item["file"] == "model.aadl" for item in result["diagnostics"]))

    def test_unknown_root_is_invalid_not_successful_process_completion(self):
        result = execute(root="Rover_Budget::Absent.impl")
        self.assertEqual("invalid", result["status"], result)
        self.assertNotIn("model", result)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--java", default="java")
    parser.add_argument("--lib", type=Path, default=LIB)
    args, remaining = parser.parse_known_args()
    JAVA, LIB = args.java, args.lib
    unittest.main(argv=[__file__, *remaining])
