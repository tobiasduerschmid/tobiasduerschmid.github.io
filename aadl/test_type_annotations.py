#!/usr/bin/env python3
"""Compare the browser compatibility adapter with OpenJDK's actual native bytes."""
import argparse
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
JDK = Path("/opt/homebrew/opt/openjdk")
FIXTURE = """import java.lang.annotation.*;
import java.lang.reflect.*;
import java.util.*;
import sebook.aadl.TypeAnnotationBytes;
public class AnnotationContract {
  @Target(ElementType.TYPE_USE) @Retention(RetentionPolicy.RUNTIME)
  @interface Mark { String value(); }
  String plain;
  List<@Mark("generic") String> generic;
  @Mark("element") String @Mark("array") [] array;
  @Mark("outer") Map<String, List<@Mark("inner") Integer>> nested;
  public static void main(String[] args) throws Exception {
    Method nativeBytes = Field.class.getDeclaredMethod("getTypeAnnotationBytes0");
    nativeBytes.setAccessible(true);
    for (String name : List.of("plain", "generic", "array", "nested")) {
      Field field = AnnotationContract.class.getDeclaredField(name);
      byte[] expected = (byte[]) nativeBytes.invoke(field);
      byte[] actual = TypeAnnotationBytes.field(field);
      if (!Arrays.equals(expected, actual)) throw new AssertionError("Annotation bytes differ: " + name);
      if (!name.equals("plain") && (actual == null || actual.length == 0)) throw new AssertionError("Lost type annotations: " + name);
    }
  }
}
"""


class TypeAnnotationContract(unittest.TestCase):
    def test_browser_adapter_preserves_native_field_annotations(self):
        source = ROOT / "aadl/src/sebook/aadl/TypeAnnotationBytes.java"
        self.assertTrue(source.is_file(), "The precise native compatibility adapter is not implemented.")
        with tempfile.TemporaryDirectory(prefix="aadl-annotations-") as directory:
            work = Path(directory)
            fixture = work / "AnnotationContract.java"
            fixture.write_text(FIXTURE)
            subprocess.run([str(JDK / "bin/javac"), "--release", "21", "-d", directory, str(source), str(fixture)], check=True)
            subprocess.run([str(JDK / "bin/java"), "--add-opens=java.base/java.lang.reflect=ALL-UNNAMED", "-cp", directory, "AnnotationContract"], check=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--jdk", type=Path, default=JDK)
    args, remaining = parser.parse_known_args()
    JDK = args.jdk
    unittest.main(argv=[__file__, *remaining])
