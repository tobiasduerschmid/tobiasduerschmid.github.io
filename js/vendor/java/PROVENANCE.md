# Java tutorial runtime

The browser downloads the unmodified Eclipse compiler 3.26.0 from this directory.
It was published by Eclipse under the [Eclipse Public License 2.0](../elk/0.12.0/LICENSE.md). The original
notice is included as `about.html` in the archive. The installed compiler is
available with its corresponding sources and license information at
[Maven Central](https://repo.maven.apache.org/maven2/org/eclipse/jdt/ecj/3.26.0/).

ASM Core and Tree 9.7.1 instrument classes for the interactive debugger. They
are distributed under the [ASM BSD license](ASM-LICENSE.txt). Upstream artifacts and sources are
published for [ASM](https://repo.maven.apache.org/maven2/org/ow2/asm/asm/9.7.1/)
and [ASM Tree](https://repo.maven.apache.org/maven2/org/ow2/asm/asm-tree/9.7.1/).

The workspace loads the site's existing Gson 2.13.2 archive for JSON messages.
The Java sources and reproducible bridge build are under `tools/java-workspace`.
Run `python3 tools/java-workspace/build.py --javac /path/to/jdk8/bin/javac`
after changing them. The generated manifest pins the digest of every runtime JAR.
