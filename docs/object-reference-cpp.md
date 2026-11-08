# C++ value and reference trace producer

The object-reference lab executes editable C++17 locally with the same pinned
YoWASP Clang and WASI runtime as the ordinary C++ tutorial backend. It is not a
C++ interpreter or a source-pattern simulation. No student source is sent to a
compilation service.

## Components and interfaces

- `js/object-reference-cpp-worker.js` loads the existing pinned compiler,
  Tree-sitter C++ grammar and observer header. Its module-worker interface emits
  `{type:'ready'}`, accepts `{type:'trace', code}`, emits `{type:'running'}` just
  before execution, then emits `{type:'result', trace}` or `{type:'error', message}`.
  The lab controller owns cancellation and startup/compile/execution deadlines.
- `js/object-reference-cpp-instrument.mjs` validates source boundaries, retains
  Clang preprocessing line markers, validates a bounded Tree-sitter syntax
  subset, inserts observer calls and decodes the resulting records. Both
  execution adapters use this module unchanged.
- `js/object-reference-cpp-runtime.hpp` observes actual live C++ storage through
  lexical RAII guards. It serializes read-only snapshots independently from
  source parsing and compiler transport. It never dereferences pointer values.
- `scripts/build-object-reference-cpp-traces.mjs` exports `traceCpp(code)` and
  accepts a JSON array of `{id, code}` records on stdin, returning a JSON object
  mapping IDs to traces. It compiles **trusted repository-authored source** with
  native `clang++` (`CXX` may select another Clang binary). This native build tool
  is not a sandbox and must not process untrusted submissions. Temporary source
  and binaries live under the system temporary directory and are removed.

The trace shape is `{steps, error, truncated}`. Each step has `event`, `line`,
`visualizedLine`, `scopes`, `objects`, and accumulated `output`. Scope bindings
carry `name`, `target`, and `semantics` (`value`, `reference`, or
`object-reference`). Objects carry deterministic lifetime IDs, type and displayed
value. String values include quotes. Identical scalar/string values do not merge.
Value copies have separate storage IDs; references share their existing target;
pointer bindings remain separate slots and share a pointee target when equal.

## Supported programs

Write a complete program with `int main()` and ordinary free functions. Supported
variables and named parameters are arithmetic scalar types, `std::string`, local
references and const references, and single-level pointers. Locals must be
initialized; default-constructed strings are allowed. `auto` may deduce one of
these supported types. Each declaration statement must declare **one variable**;
split `int x=4, y=id(x);` into `int x=4; int y=id(x);` so the caller's storage is
observed before a later initializer can borrow it. Basic expressions, calls, string operations, assignments,
return, nested blocks, and **braced** `if`/`else`, `while`, and `do`/`while` are
supported. `std::cout` and `std::cerr` accumulate in the trace's output.

Explicit copy-in/out is ordinary value-return code followed by a caller assignment.
`#include <iostream>` and `#include <string>` are allowed; the observer provides
those standard headers. `#define` and `#undef` are expanded by Clang before syntax
instrumentation, preserving precedence, repeated evaluation and variable capture.
For repeated side effects use separate statements, such as
`#define TWICE(action) do { action; action; } while(false)`.
Unsequenced side effects and returning stack addresses are compilation errors.

Unsupported constructs fail with a visible diagnostic: global variables,
classes/structs/enums, containers/arrays, indexing, dynamic allocation, lambdas,
casts, templates, function prototypes, unnamed/default/variadic parameters,
reference/pointer return declarators, references to pointers, multiple pointer
indirection, static/extern/thread-local/volatile locals, `for`, condition-variable
declarations, unbraced control bodies, exception handling, and additional headers
or preprocessor directives. Raw string literals and quoted literals spanning
physical source lines are rejected **before** preprocessing; use ordinary quoted
strings with `\n` escapes. Directive-looking text inside comments or ordinary
quoted literals is never treated as a source directive. Multiple declarators in
one statement are rejected. Unsupported inferred value and pointee types fail a compiler
static assertion instead of being silently omitted. Standard-library internals
are not traced. This is a bounded teaching lab, not a full C++ debugger or an
undefined-behavior detector.

## Observation and lifetime rules

Snapshots follow complete declaration and expression statements; function-entry
snapshots highlight the function definition line and precede the first body
statement. This differs from Python's call-site entry mapping. A return snapshot is taken **before**
evaluating its return expression; effects of that expression appear in nested
calls or the next completed caller statement. Closing-brace snapshots still show
locals whose lifetime is about to end. Compiler preprocessing maps expanded
statements to their original macro invocation line, so a single source line can
have several different states. The initial snapshot uses line zero.
Successful completion appends an empty-scope `final` state with line zero,
the last visualized source line and accumulated output. The pre-return state
remains available for inspecting locals. Runtime failures retain the last
observed state with an explicit `error` event.

Nested block scopes have independent IDs and visible names such as
`main · block at line 7`; function scopes use their function name. Watch guards
are declared after each variable and disappear before its storage expires.
References may alias only an **already observed whole object of the same type**,
ignoring `const` qualification. An untracked reference never creates an object
reader or takes ownership of storage. References to string characters or other
subobjects, temporary literals, and conversion temporaries are unsupported and
stop with an explicit error before any value read. For example,
`char& first=s.front()` and `read(4)` with a `const int&` parameter are rejected;
`int x=4; read(x)` remains supported. Identity checks use both address and actual
C++ type, so a character at the same address as a short string cannot alias the
whole string card. Single-level pointers may point to arithmetic scalars or
strings only, including deduced `auto`, `auto*`, and `const auto` declarations.
Pointers to expired storage produce an explicit dangling-target card. Null
pointers produce a `nullptr` card. Targets outside observed storage are explicitly
unavailable, with distinct IDs for distinct pointer addresses. Raw pointers do
not encode storage generations: after an observed address is reused, its pointer
card explicitly reports ambiguous provenance instead of claiming a live alias.
The observer does not dereference null, dangling, unobserved, or ambiguous targets.
A student's own invalid dereference still has ordinary C++ undefined behavior.

Both compilers use C++17, `-O0`, `-fno-exceptions`, and
`-fno-elide-constructors`. The last flag disables optional named-return copy
elision so returned local storage and caller storage have independent observable
lifetimes. Required C++17 prvalue elision remains in force. This is one valid
compiler execution of the program; do not claim the trace demonstrates every
allowed implementation choice, memory layout, allocation behavior, or undefined
behavior outcome. IDs identify observed storage lifetimes, not memory addresses.

## Bounds

- Source: 16,000 characters; preprocessed source: 64,000 characters.
- Trace: 240 observed states plus a final/error marker, 1,000 observation/loop-condition operations, 24 active scopes,
  192 binding lifetimes and 128 scalar/string storage lifetimes.
- Individual observed strings: 4,096 bytes; program output: 16 KiB;
  total serialized trace/compiler transport: 2 MiB.
- WASI program memory: 128 MiB, including a 1 MiB stack. Compiler memory is separate.
- Native build: 30 seconds per compiler invocation, three seconds per executable.
  Browser host deadlines and worker termination also bound uninstrumented library
  work and pathological execution. A worker cannot interrupt its own synchronous
  WASM execution using a cooperative message.

Resource limits report incomplete traces with an error; compilation failures do
not reuse an earlier binary. Each run has a fresh compiler filesystem and program
instance. The producer adds no persistence, controls, colors or keyboard shortcuts.

## Verification

Run the native behavioral suite:

```sh
node --test scripts/tests/object-reference-cpp-traces.test.js
```

Run actual Chromium/Clang/WASI parity and recovery checks (requires local listening
and a Playwright Chromium installation):

```sh
node --test scripts/tests/object-reference-cpp-worker.test.js
```

The latter compares actual native and WASI traces for value/reference/string/
pointer/copy-in-out/macro behavior, then verifies compilation errors cannot run an
old binary and corrected edits execute successfully. UI, accessibility, playback,
print and tutorial integration remain the shared lab's separate verification scope.
