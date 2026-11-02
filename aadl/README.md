# AADL browser bridge

The browser executes OSATE's parser, validator, instantiator, property accessors,
and flow-latency analysis. The Java bridge projects their semantic objects into
JSON; JavaScript does not parse AADL or calculate an alternative latency result.

The pinned AADL tooling 0.3.0 distribution actually reports **OSATE
2.21.0-SNAPSHOT (b8308b7)** and language server **0.3.0 (895e0b9)**. Its bundled
runtime must not be described as the separate OSATE 2.20.0 stable release.
`dependencies.json` records the official release archive and every unchanged
JAR in the browser closure. The selected 51 upstream JARs total about 26 MB;
the native CLI launcher, native JRE, and unrelated desktop plugins are excluded.

## Build and verify

Use a JDK supporting `--release 21`. The current artifact was compiled with
OpenJDK 25.0.2. Builds do not download dependencies.

```sh
python3 aadl/build.py --jdk /path/to/jdk --test
```

To import the pinned files from an extracted official distribution first:

```sh
python3 aadl/build.py --jdk /path/to/jdk \
  --distribution /path/to/osate-cli-0.3.0-macos-arm64 --test
```

Every imported JAR must match `dependencies.json`. The build emits a deterministic
bridge JAR, `SHA256SUMS`, and `js/aadl/runtime-manifest.mjs`. Browser loading checks
each SHA-256 before transferring the bytes to its isolated execution frame.
The dependency archive's own license and copyright notices are retained beside
the artifacts; each unchanged JAR retains its embedded notices.

`test_bridge.py` runs the actual engine and JSON boundary. Its cases cover the
18–22 ms model, a 21 ms violation, equivalent microsecond values, missing input,
invalid directions, an absent root, authored source paths, and repeated changed
snapshots in one JVM. `test_type_annotations.py` compares the compatibility
adapter with OpenJDK's native reflection bytes. These native tests do not replace
the separate real-browser tests.

## Browser runtime compatibility

`aadl-runtime-frame.html` pins the official CheerpJ **5.0** loader by SRI.
`js/aadl/frame.js` selects **Java 25**, disables the experimental WasmGC engine,
and sets Guice's `guice_bytecode_gen_option=DISABLED`. OSATE's Java 21 bytecode
runs unchanged on that Java 25 runtime.

The Java 21 trial failed inside CheerpJ's JIT for
`java.lang.reflect.Proxy$ProxyBuilder.addElementType`. The Java 25 trial advanced
further but lacked the native method
`java.lang.reflect.Field.getTypeAnnotationBytes0`. `TypeAnnotationBytes` supplies
that exact method through CheerpJ's documented native-method API: it returns the
original class-file `RuntimeVisibleTypeAnnotations` attribute, with its original
constant-pool references. It returns null only when that field has no such
attribute. It throws if the original class resource cannot be read. This is not
an empty annotation stub. Tests compare unannotated fields, generic type-use
annotations, arrays, and nested generics with OpenJDK's actual native output.

The callback captures the helper from the application library because the
callback's own library context uses the JDK class loader. Remove this narrow
adapter only after a pinned CheerpJ upgrade passes both annotation parity and
the real OSATE browser cases.

## JSON and lifecycle

`Bridge.initialize()` initializes language services before the client starts its
analysis deadline. `Bridge.execute(json)` accepts:

```json
{"version":1,"operation":"analyze","root":"Rover_Budget::Loop.budget","files":{"model.aadl":"..."}}
```

`validate` also instantiates and projects the model; `analyze` additionally runs
OSATE's flow-latency switch. Results include diagnostics, components and features,
resolved connection endpoints and their context-specific segments, actual
bindings, flow instances, effective latency properties, and native analysis
values. Source locations refer to authored paths, never generated instance files.

Language injectors remain warm. Every request creates a new Xtext resource set
and unique virtual directory, loads every source file, validates before selecting
the root, and instantiates in that same resource set. After projection and
analysis, it unloads and removes every resource, clears the URI resource map,
and deletes the request directory. No instance or analysis report is reopened
from a prior request. A cleanup failure is an error without model evidence.

The client retains a completed or invalid idle session. Canceling an active
request, a deadline, an engine/protocol error, or disposal destroys the entire
frame. Idle edits keep the warm language services. Response IDs and complete
source snapshot checks reject late or stale evidence. The frame's private port
is separate from the tutorial DOM and storage; its virtual filesystem uses the
existing in-memory IndexedDB adapter.

`complete` means the engine operation finished. It is not an assertion of model
adequacy, safety, scheduling feasibility, or exercise success. In particular,
OSATE assigns zero contribution to some missing latency inputs. The trusted
exercise profile must check required contributors and properties independently.
Copied instance property associations can lack source provenance; the bridge
reports `sourceAvailable: false`, rather than inventing an authored location.

See [runtime evidence](../docs/aadl/runtime.md) and the
[backend design](../docs/aadl/backend-design.md) for scope and limitations.
