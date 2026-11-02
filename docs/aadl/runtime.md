# AADL browser runtime: implementation and evidence

Verified **1 November 2026**. The implemented bridge runs the real OSATE parser,
validator, instantiator, instance projection, and flow-latency analysis entirely
inside a browser JVM. The successful production transport used an opaque-origin
`data:` iframe, a private message port, hash-verified JAR transfers, and the
in-memory filesystem adapter. No hosted model-analysis service was used.

This record covers engine integration. It does not by itself establish tutorial
usability, accessibility, cross-browser support, or physical-system safety.
The separate [native reference record](verification.md) establishes the example
oracles; [backend design](backend-design.md) describes wider capabilities that
remain outside this first implementation.

## Exact implementation

The semantic engine is the unmodified JAR closure from official AADL tooling
**0.3.0**, which reports OSATE **2.21.0-SNAPSHOT (b8308b7)** and language server
**0.3.0 (895e0b9)**. It is not the separately released OSATE 2.20.0 binary.
The original archive and 51 selected upstream JARs are pinned in
[`aadl/dependencies.json`](../../aadl/dependencies.json); the bridge is rebuilt by
[`aadl/build.py`](../../aadl/build.py), and the final transport manifest is
[`js/aadl/runtime-manifest.mjs`](../../js/aadl/runtime-manifest.mjs).

The 52 served artifacts occupy **25,917,027 bytes** in this build. They exclude
the native JRE, CLI process/server launcher, and unrelated desktop plugins.
They retain original per-JAR notices and bytes; distribution license and
copyright notices are preserved alongside them. The
[artifact provenance](../../js/vendor/aadl/0.3.0/PROVENANCE.md) records the release
URL, archive checksum, and licensing. CheerpJ's CDN license is separate.

The browser selects **CheerpJ 5.0, Java 25, WasmGC disabled**, using the official
loader with SRI
`sha384-zXh+ydEgZpoWR7su3jA/GH/WrYrX7jRmHWYHcyFE+q4qEAUnF6oW1zEbkWjyZib8`.
Java 21 bytecode is compiled using OpenJDK 25.0.2 with `--release 21`.

The initial Java 21 experiment reached OSATE initialization but failed in the
vendor JIT for `java.lang.reflect.Proxy$ProxyBuilder.addElementType`. Java 25
avoided that failure but exposed a missing native
`java.lang.reflect.Field.getTypeAnnotationBytes0`. The narrow
[`TypeAnnotationBytes`](../../aadl/src/sebook/aadl/TypeAnnotationBytes.java)
adapter supplies the original class-file annotation attribute through CheerpJ's
documented native callback mechanism. It does not synthesize empty annotations
or change AADL semantics. Native parity tests cover unannotated fields, generic
type-use annotations, array annotations, and nested generics. Guice bytecode
generation is disabled through its existing system-property switch.
[CheerpJ library mode](https://cheerpj.com/docs/guides/library-mode),
[native callbacks](https://cheerpj.com/docs/guides/implementing-native-methods),
[runtime options](https://cheerpj.com/docs/reference/cheerpjInit).

## Snapshot ownership and measured browser results

`Bridge.initialize()` warms immutable language services. Each subsequent request
creates a new Xtext resource set and a new virtual snapshot directory, validates
all files, resolves the requested root, and instantiates into that same resource
set. Projection and analysis finish before resources are unloaded and removed,
the URI resource map is cleared, and the request directory is deleted. The
serialized response contains detached data, not retained model objects.

The final sequence used the same authored filename and root in one warm JVM,
on local macOS ARM64 with Playwright 1.58.2 Chromium. It exercised the production
client and runtime frame; only the small test host was temporary.

| Submitted source | Native browser outcome | Elapsed request time |
| --- | --- | ---: |
| Original flow budget, upper requirement 25 ms | Complete; 18–22 ms; native requirement met | 68.007 s |
| Same model, upper requirement changed to 21 ms | Complete; still 18–22 ms; native errors for exceeded maximum/jitter | 2.140 s |
| Controller's flow latency removed, requirement restored to 25 ms | Complete; 10–10 ms; native requirement met despite missing input | 2.003 s |
| Sensor output changed to an input | Invalid with source diagnostics; no model or analysis | 1.852 s |
| Original source restored | Complete; 18–22 ms against 25 ms | 1.968 s |

Only the first request entered the loading phase: **62.094 s** of its elapsed
time was runtime startup. An earlier implementation discarded Java after every
request; two browser runs then took 70.556 s and 84.364 s. Those measurements
motivated retaining immutable language services while discarding every model
workspace. These are single-machine observations, not performance guarantees.

Idle cancellation between the final sequence's requests preserved the warm
engine. Client tests separately establish that cancellation during startup or
an active request through explicit Stop closes the execution session; late results cannot complete
another request; malformed responses close the session; disposal closes idle
sessions. Full tutorial Stop and UI behavior require the integrated browser suite.

### Source edits during startup

A reported apparent freeze exposed an actual restart path: source changes used
the same hard cancellation as Stop, so an edit during initialization discarded
the JVM and the next debounced check started again from zero. The client now
separates superseding a snapshot from terminating engine work. Edits retain
initialization or let an existing request drain, then dispatch only the newest
queued snapshot. A superseded result cannot update the view or earn credit.
The original startup and execution deadlines remain in force across edits;
explicit Stop and teardown still terminate active work.

The runtime reports verified artifact counts and real Java/language/service
initialization stages. The controller reports elapsed startup time at 15-second
intervals, stopping those updates on completion, cancellation, or teardown.
There is no estimated percentage for initialization. First startup still has
the cost of loading the actual Java engine.

The startup regression was observed failing before the fixes. The updated
focused suite passes 80 tests. The full unit suite passes 3,140 of 3,142;
the two failures are still the unrelated missing song fixture described below.
The actual-engine suite now restores normal Chromium background scheduling
rather than relying on Playwright's default throttling overrides. Its cold-edit
case retains the same runtime frame and resolves the renamed component from
the latest source. Manual inspection of the refreshed in-app browser reached
the resolved diagram and the expected 18–22 ms latency result.
All four actual-engine browser journeys passed with normal scheduling (5.6
minutes total), including Stop during startup, changing lessons during analysis,
invalid-source recovery, and graded solutions. No browser scheduling workaround
was needed.

## Evidence boundaries

The native suite passed nine real-engine contracts, including the same-JVM
baseline → violated bound → missing allocation → invalid model → repair
sequence. The annotation parity test passed against OpenJDK's actual native
bytes. Five client lifecycle tests passed. The final browser sequence reproduced
all five semantic outcomes above through the production transport.

The missing-allocation case is deliberately retained as a negative completeness
example. OSATE returns a native pass at 10 ms; that cannot establish exercise
success or model adequacy. The host must verify the trusted profile's required
contributors and effective properties. The bridge reports when property source
provenance is unavailable instead of fabricating it from a generated instance.

The host limits workspace size and display size, and startup/analysis deadlines
can discard the entire frame. These are not a proven hard instantiation-memory
bound. General scheduling, resource budgeting, AGREE, Resolute, behavioral
simulation, fault analyses, arbitrary annex coverage, offline operation, and
cross-browser performance are not established by this first runtime.

Independent review also exercised legal bus-access component endpoints and a
controller with fast/slow timing modes. Connection boundaries accept resolved
component endpoints for access connections. Native mode labels are retained in
the report, but the current static budget profile marks modal timing coverage
inconclusive; it does not pretend its generic property projection resolves
each system operation mode. Exercise checks preserve the authored port payloads,
component roles, and fixed bounds where required, and follow the selected
end-to-end path rather than the first declared flow of a given kind.

Run the native contracts and regenerate the pinned bridge with:

```sh
python3 aadl/build.py --jdk /path/to/jdk --test
node --test scripts/tests/aadl-client.test.js
```

Temporary browser logs and full result objects were inspected outside the
repository. Permanent tests and the semantic JSON fixtures preserve the relevant
oracles; temporary logs are not source artifacts.

## Integrated tutorial verification

The built SEBook tutorial was exercised with the real browser engine on
1 November 2026. The permanent integration suite verifies automatic diagrams,
21 ms violation and 22 ms equality, missing input, invalid source, repair,
all three graded reference solutions, credit invalidation after editing,
startup cancellation, and changing lessons while analysis is running.
The actual resolved diagram and latency report also pass the automated
WCAG A/AA rules included by axe. A separate five-case suite checks the tutorial
at 1440 px and 320 px in both themes, keyboard focus, and light print with a
saved dark preference. These checks do not constitute a blanket WCAG or PDF/UA
certification.

Monaco coloring is registered from one lexical module in the main editor and
both editor popout types. Fresh-window tests use the real Monaco tokenizer.
Diagram tests and visual review cover communication, deployment, process
boundary forwarding, bus access, live resizing, and readable vertical layouts
at 600 px and 320 px. The actual in-app browser was inspected with highlighted
source, the generated three-component graph, and its 18–22 ms analysis result.

The final full repository unit run reported 3,129 passing tests and two failures
caused by the pre-existing missing `_data/songs/always_code.yml` fixture. Focused
AADL and popout contracts pass. Later presentation-only feedback refinements
were checked with the focused browser component suite. No unrelated song files
were changed.
