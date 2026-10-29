#!/usr/bin/env python3
"""Build the Java 11 browser bridge against the pinned upstream JAR without downloads."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / "js/vendor/tlaplus/1.8.0-fc6878c603f0"
ENGINE_HASH = "fc6878c603f0fdc18b9fe3e5bf51860cb90ab5b1154e3c371660c036d6bdd63e"


def verify(path, expected):
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != expected:
        raise SystemExit(f"Checksum mismatch for {path.name}: {actual}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jdk", type=Path, help="JDK home containing bin/javac; defaults to JAVA_HOME or PATH")
    parser.add_argument("--test", action="store_true", help="Run the real-engine integration contract tests")
    args = parser.parse_args()
    jdk = args.jdk or (Path(os.environ["JAVA_HOME"]) if os.environ.get("JAVA_HOME") else None)
    javac = str(jdk / "bin/javac") if jdk else shutil.which("javac")
    java = str(jdk / "bin/java") if jdk else shutil.which("java")
    if not javac or not java:
        raise SystemExit("A JDK supporting --release 11 is required. Supply --jdk /path/to/jdk/home.")
    engine = VENDOR / "tla2tools.jar"
    verify(engine, ENGINE_HASH)
    with tempfile.TemporaryDirectory(prefix="sebook-tla-build-") as temporary:
        work = Path(temporary)
        classes = work / "classes"
        classes.mkdir()
        sources = sorted((ROOT / "tla/src").rglob("*.java"))
        subprocess.run([javac, "--release", "11", "-cp", str(engine),
                        "-d", str(classes), *map(str, sources)], check=True)
        files = {path.relative_to(classes).as_posix(): path.read_bytes() for path in classes.rglob("*.class")}
        files["META-INF/MANIFEST.MF"] = b"Manifest-Version: 1.0\nMain-Class: sebook.tla.Bridge\n\n"
        jar = VENDOR / "sebook-tla-bridge.jar"
        with zipfile.ZipFile(jar, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, contents in sorted(files.items()):
                entry = zipfile.ZipInfo(name, date_time=(2026, 10, 28, 0, 0, 0))
                entry.compress_type = zipfile.ZIP_DEFLATED
                entry.external_attr = 0o644 << 16
                archive.writestr(entry, contents)
        artifacts = [engine, jar]
        (VENDOR / "SHA256SUMS").write_text("".join(
            f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n" for path in artifacts))
        print(f"Built {jar.relative_to(ROOT)}")
        if args.test:
            subprocess.run(["python3", str(ROOT / "tla/test_bridge.py"), "--java", java], check=True)


if __name__ == "__main__":
    main()
