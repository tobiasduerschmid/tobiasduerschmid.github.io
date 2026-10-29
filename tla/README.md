# Official TLA+ tools browser bridge

This directory owns the Java adapter around the official SANY parser, PlusCal translator,
TLC checker, and FastTool evaluator. Browser transport and the tutorial interface are
separate modules under `js/tla/`. Model checking runs on the learner's device; there is no
verification service. The upstream JAR is pinned and unmodified; see the runtime's
`js/vendor/tlaplus/1.8.0-fc6878c603f0/PROVENANCE.md` and `SHA256SUMS`.

## Build and test

Use a JDK supporting `javac --release 11`:

```sh
python3 tla/build.py --jdk /path/to/jdk/home --test
```

The script verifies the checked-in upstream JAR, compiles against it (including its bundled
Gson 2.14.0), and updates the bridge JAR and `SHA256SUMS`. It performs no downloads and does
not duplicate upstream dependency classes. Temporary compilers and classes do not belong
in the repository. Update the browser's runtime manifest with
the new bridge checksum after rebuilding.

The tests invoke the actual public JSON bridge through Java, including consecutive
exploration operations in one JVM and rejection of cross-model JVM reuse. Run them independently with:

```sh
python3 tla/test_bridge.py --java /path/to/jdk/home/bin/java
```

These tests verify the engine adapter; browser initialization, cancellation, accessibility,
and UI behavior require the corresponding browser tests.

## JSON interface, version 1

CheerpJ loads both JARs in library mode, then calls
`await lib.sebook.tla.Bridge.execute(JSON.stringify(request))`. The returned Java string
contains JSON. Calls must be serialized in one isolated JVM. Initialize with
`sebook.tla.workRoot=/files/sebook-tla` when using CheerpJ's writable virtual filesystem.

```json
{
  "operation": "check",
  "entry": "Model.tla",
  "config": "Model.cfg",
  "files": {"Model.tla": "...", "Model.cfg": "...", "Helper.tla": "..."},
  "translatePlusCal": false,
  "maxTimeMs": 30000,
  "maxStates": 100000,
  "maxTraceStates": 500,
  "maxChoices": 200
}
```

Files are a flat map of `.tla` and `.cfg` filenames. Absolute paths, traversal, and binary
overrides are rejected. Each `check`, `explore-init`, and `parse` requires a fresh JVM;
only `parse` permits a missing config. PlusCal translation is requested explicitly and
uses the upstream `Translator` on each workspace module containing an upstream algorithm
marker. It updates only temporary modules; the caller's configuration is preserved. Each
translated module is returned by filename in `generatedFiles`. This includes PlusCal
modules imported by a separate assessment harness entry module.

Operations:

- `parse`: SANY syntax, semantic analysis, and level checking; no verification claim.
- `check`: full upstream TLC checking with the supplied configuration, one worker,
  deterministic fingerprint seed, and the configured invariants and temporal properties.
- `explore-init`: retains a FastTool and returns `states` containing possible initial states.
- `explore-next`: takes `stateId`, returns `choices` for enabled `Next` actions. Each choice
  has `id`, `label`, `state`, `location`, and `withinConstraints`. Initial states also carry
  `withinConstraints`. This is local exploration, not a proof or exhaustive check;
  implicit temporal stuttering is handled by TLC during verification.
- `evaluate`: takes `stateId` and `operator`, evaluates a named zero-argument module
  operator in the retained state. It returns a typed `value`. It does not parse arbitrary
  watch-expression strings. `explore-eval` is an alias.
- `reset`: releases the exploration workspace and state IDs. It does not make the JVM
  reusable for a new model.

Every response has `version: 1`, `engine`, `status`, `reason`, `diagnostics`, `output`,
and `outputTruncated`. Successful parsing/exploration uses `status: "complete"` but its
`reason` is operation-specific. Only `check` with `reason: "exhausted-state-space"` means
TLC finished exploring the configured finite model. Model checking is not a proof for
all parameter values or infinite models.

Check responses use `complete`, `counterexample`, `error`, or `incomplete`. Completion is
derived from TLC's success event plus an empty pending-state queue, never from the absence
of a failure string. An engine-requested early exit with queued states is `incomplete`.
The bridge observes evaluated `TLCSet("exit", TRUE)` through upstream's Java-override
registration API, delegates the operation unchanged, and reports `incomplete`/`engine-stop`
even when its final queue is empty. Error classification and traces use TLC's machine
event codes and actual state objects.
`stats` contains upstream `generated`, `distinct`, and `remaining` counts as decimal
strings. `engineCode` preserves the upstream exit code.

Counterexamples have `trace: {kind, states, loopIndex?, truncated}`. `loopIndex` is a
zero-based target in the complete trace; stuttering targets the last state. When a trace
is shortened for display, `truncated` is true and any loop target is instead exposed as
`fullLoopIndex`, so the UI cannot draw a false loop on the shortened path. A display limit
does not erase an already established counterexample.

A state has `{id, values, action?, location?}`. Each value has `{name?, type, text,
children?, childrenTruncated?}`. `text` comes from the upstream value printer. Sets,
tuples, functions, records, integers, strings, booleans, and model values remain distinct;
they are not coerced into untyped JSON arrays or objects. Child previews stop at 200
items/depth 12 and label truncation. Lazy or symbolic values retain their upstream type
and printed form without forcing enumeration.

Locations use one-based line/column coordinates and the `.tla` filename. PlusCal action
locations are mapped to original algorithm lines using the upstream translation mapping;
the translated span is nested in `generatedLocation`. A location with `generated: true`
has no original-source mapping and must not highlight the same coordinates in the
untranslated editor.

## Resource and session behavior

TLC's budget monitor requests a stop after the state/time limit; a stop is `incomplete`.
The browser must also enforce a wall-clock deadline and destroy the isolated JVM to
cancel parsing, very large individual expressions, or unresponsive native work. A cooperative
state limit can be exceeded slightly between polls. Exploration stops collecting after
`maxChoices`, returns the collected choices with `incomplete`/`choice-limit`, and retains
at most 10,000 state objects. Starting another model requires destroying the iframe/JVM,
which invalidates old IDs.

Console output is capped at 256 KiB and explicitly marked when shortened. The bridge
rejects a second parse/check/explore-init with `error`/`fresh-session-required`: upstream
TLC retains process-wide state, including liveness errors, so it must not be reused for
another model. Recorders are unsubscribed after runs and per-request files are removed on
completion. An exploration keeps its private files until reset. Desktop
JMX monitoring is replaced by a no-op adapter because it relies on native management
facilities; this does not alter model-checking semantics.
