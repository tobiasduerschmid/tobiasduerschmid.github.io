#!/usr/bin/env python3
"""Regenerate prepared labs with the same producers used for browser edits.

Run with the project's Python dependencies: python3 scripts/build-object-reference-traces.py
Use --check in validation to detect stale code or stale reference snapshots.
Requires PyYAML, Node.js and clang++. Native C++ execution is only for the
trusted authored examples in this repository, never learner submissions.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

import yaml


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "_data/object_reference_examples.yml"
CPP_SOURCE = ROOT / "_data/object_reference_cpp_examples.yml"
OUTPUT = ROOT / "_data/object_reference_labs.json"


def build():
    module_spec = importlib.util.spec_from_file_location("object_reference_tracer", ROOT / "js/object-reference-tracer.py")
    tracer = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(tracer)
    examples = yaml.safe_load(SOURCE.read_text())
    for name, example in examples.items():
        example["trace"] = json.loads(tracer.trace_code(example["code"]))
        if example["trace"]["error"] or example["trace"]["truncated"]:
            raise ValueError("Prepared example must finish without errors or omissions: " + name)
    cpp_examples = yaml.safe_load(CPP_SOURCE.read_text())
    if examples.keys() & cpp_examples.keys():
        raise ValueError("Object-reference example IDs must be unique across languages.")
    compiled = subprocess.run(
        ["node", str(ROOT / "scripts/build-object-reference-cpp-traces.mjs")],
        input=json.dumps([{"id": name, "code": example["code"]} for name, example in cpp_examples.items()]),
        text=True, capture_output=True, check=True, timeout=180)
    traces = json.loads(compiled.stdout)
    for name, example in cpp_examples.items():
        if example.get("language") != "cpp":
            raise ValueError("C++ example must declare language: cpp: " + name)
        example["trace"] = traces[name]
        if example["trace"]["error"] or example["trace"]["truncated"]:
            raise ValueError("Prepared C++ example must finish without errors or omissions: " + name
                             + ": " + str(example["trace"]["error"]))
    examples.update(cpp_examples)
    # Compact snapshots keep chapter embeds small; source prose/code stays in YAML.
    return json.dumps(examples, ensure_ascii=True, separators=(",", ":")) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    result = build()
    if arguments.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != result:
            sys.exit("Prepared traces are stale. Run scripts/build-object-reference-traces.py.")
        print("Prepared object-reference traces are current.")
    else:
        OUTPUT.write_text(result)
        print("Wrote " + str(OUTPUT.relative_to(ROOT)))
