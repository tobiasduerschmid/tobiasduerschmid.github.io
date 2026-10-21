# Python types in inferred UML

Live Python UML analysis uses the pinned `browser-basedpyright` 1.40.2 library
to infer missing field and method return types. The existing Python UML
extractor still owns diagram structure, visibility, relationships and sequence
analysis. The integration does not implement another Python type-inference
algorithm.

For example, the parameter annotation supplies enough evidence for both the
field and the unannotated getter:

```python
class Student:
    def __init__(self, name: str) -> None:
        self._name = name

    def display_name(self):
        return self._name
```

Implementation details shows `_name: str` and `display_name(): str` with their
existing visibility markers. Design focus maps `str` to `String`. Inference
does not add annotations to the learner's source.

## Why a library

Python's gradual typing permits annotated and unannotated definitions in the
same program. Propagating one parameter annotation through an assignment is
only the first case: aliases, branches, helper calls, generic collections,
multiple field writes and implicit `None` returns require consistent type and
scope rules. BasedPyright already supplies assignment inference, unions,
contextual inference and return inference; its documentation also identifies
where inference remains ambiguous. See its
[type-inference reference](https://docs.basedpyright.com/latest/usage/type-inference/).

The browser distribution runs this established engine locally. Upstream calls
the browser build experimental outside its own playground, so the version is
pinned and integration behavior is covered against the real browser worker.
See the [browser package README](https://github.com/DetachHead/basedpyright/tree/main/packages/browser-pyright).

The alternatives were assessed for this browser integration, not ranked as
general-purpose Python tools:

| Candidate | Assessment |
| --- | --- |
| Pyright / BasedPyright | Assignment and return inference match the task. The existing BasedPyright browser worker avoids maintaining a separate browser port of the engine. [Pyright inference reference](https://github.com/microsoft/pyright/blob/main/docs/type-inference.md). |
| Jedi | Its public `Script.infer` API returns inferred definitions. A local 0.19.2 probe handled the simple field/alias case but failed on a nullable-union case under Python 3.13; that observation is specific to that version and environment. Formatting complete generic type expressions would also need adaptation. [Jedi API](https://jedi.readthedocs.io/en/latest/docs/api.html). |
| Astroid | Supplies static value/instance inference through AST nodes and inference transforms. It was reviewed as a Python-runtime alternative; the selected browser type checker already supplies the type representation and behavior needed here, so no Astroid browser adapter was implemented. [Astroid inference API](https://pylint.readthedocs.io/projects/astroid/en/latest/inference.html). |
| mypy | Provides established static checking and local inference, but its default treatment of wholly unannotated functions as dynamically typed is not the desired getter-inference policy. A Python-runtime integration would need additional adaptation; the working browser checker made that unnecessary. [mypy inference reference](https://mypy.readthedocs.io/en/stable/type_inference_and_annotations.html). |

This selection does not claim that the other libraries cannot solve any of
these cases. An available library met the required behavior, so there was no
reason to implement a custom dataflow solver.

## Integration boundary

- `js/uml-python-types.js` adapts the library's browser worker to an asynchronous
  type query over a complete supplied-source snapshot.
- `js/uml-worker.js` awaits type information before calling the synchronous
  `analyzePythonSources(sources, { ...options, inferredTypes })` extractor.
- `js/uml-analyzer-python.js` uses that evidence for missing class-member types.
  Explicit annotations retain precedence. The structural extractor stays
  callable without library evidence, for callers that need only its existing
  syntax-based result.
- `js/uml-live.js` owns the public asynchronous analysis path for chapter labs,
  tutorials and generated Python workspaces. Python worker failures reject the
  analysis request and are reported visibly by the host. This path does not
  substitute the main-thread structural analyzer for the required type engine.
- Rendering, Design focus projection, accessible descriptions and exported
  diagrams consume the enriched result through their existing paths.

The adapter API is `UMLPythonTypes.createClient({ workerURL?, timeoutMs? })`,
returning `{ infer(sources), dispose() }`. `infer` resolves to:

```js
{
  'student.py': {
    Student: {
      attributes: { _name: 'str' },
      returns: { __init__: 'None', display_name: 'str' }
    }
  }
}
```

Class keys use their source-qualified path, such as `Outer.Inner`, within
their source filename. The adapter queries the language server's document
symbols, then adds uniquely named, never-executed functions with typed receivers
to its worker-only source snapshot. Their `typing.reveal_type` calls query
member reads without assignment-site narrowing, so an initial string write
does not hide a later integer write. The checker expands type aliases in these
diagnostics; an alias such as `Hidden = list[Any]` therefore cannot conceal its
unresolved element type. Known aliases and generic aliases retain their expanded
types, independently in each module.

The adapter accepts diagnostics only for the exact queried document version
and its generated probe lines. Method queries use the effective member too, so
a property setter does not replace the getter's value type with its own `None`
return. Empty diagnostics leave types unspecified, including when incomplete
source prevents a probe from being checked. Failure and disposal reject pending
queries and clear their timers. The original editor text and structural-analysis
source remain unchanged. This is query scaffolding; BasedPyright still performs
the inference.

The library receives source text and bundled type information. It does not run
learner Python, install imported packages, or send source to a remote checking
service. Analysis adds no browser persistence. Worker ownership and the shared
client's stale-result checks prevent a response for an old edit from replacing
the current diagram. The existing ten-second UML worker deadline remains in
effect.

## Interpretation and limits

Inferred types are static information, not observed runtime values or proof
that arbitrary Python executions obey the annotations. The adapter omits inferred
types containing `Any`, `Unknown`, `Unbound` or unresolved type variables,
including partially unknown collections or unions. An unresolved member has no
inferred type suffix. Fully resolved unions, such as `str | None`, remain visible;
explicit source annotations retain precedence through the extractor.
Unavailable imports and unsupported dynamic behavior must not be replaced by
an invented concrete type. Adding an annotation can improve the available
evidence, but the diagram is not a substitute for type-checker diagnostics or
exercise tests.

The adapter omits ambiguous overload returns. The extractor also leaves an
unannotated method return unspecified when a custom decorator obscures the
callable's contract. Explicit declarations remain visible. Known library types,
including literal types and `Never`, are retained without forcing them to a
broader primitive type.

The library can print an imported class using only its short name. When several
supplied classes share that name, the printed type does not identify which class
was inferred. The extractor therefore omits that inferred type, including in
collections and unions, rather than guessing a module. Explicit source aliases
and annotations remain visible; quoted literal values are not class names.

The integration enriches members that the UML structural extractor recognizes;
it does not replace that extractor with a complete Python front end. Existing
limits on nested declarations, dynamic dispatch and sequence expansion still
apply. Return *type* inference is separate from the bounded return-*identity*
analysis used to follow sequence lifelines.

Inferred member types do not establish object ownership, lifecycle or inverse
multiplicity. The structural analyzer carries a typed parameter's multiplicity
through a direct field assignment: `self.part = part` with `part: Part` has the
same target multiplicity as a repeated `self.part: Part = part` declaration.
An unannotated reference without such type evidence keeps an unspecified bound.
A `str` field and return annotation do not prove that every caller passes a
string at runtime.

## Dependency maintenance

The versioned snapshot is `js/vendor/browser-basedpyright/1.40.2/`, containing
`pyright.worker.js`, `LICENSE.txt`, `README.md` and `SHA256SUMS`. The README
records upstream provenance and archive integrity. The adapter verifies the
worker's pinned SHA-256 before executing it. Keep these files together; upgrades
must also update the adapter's pinned digest and the runtime asset manifest.
Do not replace this with a floating CDN import or rebuild the engine from an
unpinned branch. Upgrade the dependency as a reviewed unit, verify its checksums, then run the
type-inference regressions and the affected live UML tests. The browser worker
adapter is the only place that should depend on the library's transport and
type-query representation.

The uncompressed worker is 17,982,887 bytes and embeds its typeshed data.
A local Chrome check on the small `Student` example measured about
765 ms for startup plus the first type result, and 266–271 ms for warm source
updates, including the language server's diagnostic scheduling. These are
measurements of one tiny example on the development machine,
not a general latency guarantee, network-download benchmark or resource budget.

## Verification

After building the site, exercise the actual browser worker and rendered lab:

```sh
PLAYWRIGHT_SERVE_BUILT_SITE=1 npx playwright test tests/uml-python-gradual-types.spec.js --project=chromium
node --test scripts/tests/runtime-supply-chain.test.js
```

The inference regressions cover the parameter-to-field-to-return chain,
aliases, branches, multiple writes, nullable types, unknown inputs, explicit
annotations and fresh source updates. Keep them on the real library path;
supplying a hand-authored inferred-type map cannot validate the inference
engine. Structural analyzer tests remain useful separately for the mapping
into UML and for unchanged relationships and sequence behavior.
