"""Run authored grading commands against isolated candidate workspaces.

This exercises grading semantics on native Python. The browser suite separately
checks the same published solutions in Pyodide and the tutorial's quiz/UI flow.
"""
import contextlib
import importlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from python_tutorial_candidates import CASES, sol


def run_capture(path):
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        exec(Path(path).read_text(), {"__name__": "__main__"})
    return output.getvalue()


def clear_imports(workspace):
    for name, module in list(sys.modules.items()):
        if str(workspace) in (getattr(module, "__file__", "") or ""):
            del sys.modules[name]
    importlib.invalidate_caches()


def write_files(workspace, files):
    for entry in files:
        target = workspace / entry["path"].removeprefix("/tutorial/")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(entry["content"].replace("/tutorial", str(workspace)))


def evaluate(tutorial, step, source):
    failures = []
    cwd, argv, import_path = Path.cwd(), sys.argv[:], sys.path[:]
    with tempfile.TemporaryDirectory(prefix="python-grader-") as directory:
        workspace = Path(directory)
        try:
            os.chdir(workspace)
            sys.path.insert(0, directory)
            # Earlier lessons supply reusable modules to the later exercises.
            for previous in tutorial["steps"]:
                if previous is step:
                    break
                write_files(workspace, previous.get("files", []))
                write_files(workspace, previous.get("solution", {}).get("files", []))
            write_files(workspace, step.get("files", []))
            write_files(workspace, step.get("solution", {}).get("files", []))
            write_files(workspace, [{"path": step["open_file"], "content": source}])
            for check in step["tests"]:
                clear_imports(workspace)
                namespace = {"__name__": "__main__", "__run_capture": run_capture}
                try:
                    with (
                        contextlib.redirect_stdout(io.StringIO()),
                        contextlib.redirect_stderr(io.StringIO()),
                    ):
                        setup = (
                            tutorial.get("setup_commands", [])
                            + step.get("setup_commands", [])
                        )
                        for command in [*setup, check["command"]]:
                            exec(command.replace("/tutorial", directory), namespace)
                except BaseException as error:
                    failures.append({
                        "check": check["description"],
                        "type": type(error).__name__,
                        "message": str(error),
                    })
                finally:
                    sys.argv = argv[:]
                    os.chdir(workspace)
        finally:
            clear_imports(workspace)
            sys.path[:] = import_path
            sys.argv = argv
            os.chdir(cwd)
    return failures


def main():
    tutorial = json.load(sys.stdin)
    steps = {step["open_file"]: step for step in tutorial["steps"]}
    cases = []
    for filename, step in steps.items():
        solution = next(
            file["content"] for file in step["solution"]["files"]
            if file["path"].removeprefix("/tutorial/") == filename
        )
        cases.append((filename, "published solution", solution, "accept", None))
        cases.append((filename, "stable reference submission", sol(filename), "accept", None))
    cases.extend(CASES)
    results = []
    for filename, name, source, expected, rejection_type in cases:
        compile(source, filename, "exec")
        step = steps[filename]
        assert step["tests"], f"No grading commands for {filename}"
        results.append({
            "name": f"{step['title']}: {name}",
            "expected": expected,
            "rejectionType": rejection_type,
            "failures": evaluate(tutorial, step, source),
        })
    print(json.dumps(results))


if __name__ == "__main__":
    main()
