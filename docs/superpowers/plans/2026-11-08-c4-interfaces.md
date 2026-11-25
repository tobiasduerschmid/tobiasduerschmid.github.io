# C4 Interfaces Implementation Plan (Milestone 1b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add interface descriptions (syntax and semantics) to the DOM-free C4 core: `provides` as interfaces with operations, types, constraints, allowed values and their meanings, units, formats, errors, examples, a shared vocabulary, and `realizes` links; `uses` on relationships, including event emitters and queue or topic peers; the `interfaces of <element>` and `interface <id>` views; the `with interfaces` annotation; `interface/*` checks; interface predicates; splice-based edit commands; descriptions; UML component text; facade, CLI, and JSON Schema support.

**Architecture:** The same hand-maintained UMD core modules under `js/ArchUML/c4/` gain the interface code; no new core file and no core-manifest change (spec §1 J9), because Milestone 2 embeds a copy of the core manifest. The pure selector grammar moves into `c4-schema.js` so the model and the projection share it. The `Model` and `ViewModel` contracts only gain fields. Milestone 1's fixture stays byte for byte as it is (J13); the interface reference model (spec §4.2: interfaces plus the chapter amendments to FR-07, the browser node, the API pod's technology, and the code-view label) is a second fixture, on which this plan re-asserts every Milestone 1 invariant.

**Tech Stack:** Plain JavaScript (ES2020 syntax, no `import`/`export`, no AMD), vendored `yaml` 2.9.1, Node 22 `node:test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-11-08-c4-model-design.md` (sections 4.2, 4.6, 4.8, 4.10, 4.11, 5.1–5.3, 6.3 deployment paths, 6.6, 7.2, 8, 13, 14 are normative for this plan; decisions J7–J14).

**Depends on:** Milestone 1 (`docs/superpowers/plans/2026-11-08-c4-core.md`) complete and green. Runs in parallel with Milestone 2. The interface addendum was merged into the spec on 2026-11-08 (controller ruling), before Milestone 1 is green; J13 keeps Milestone 1 independent of it: Milestone 1's fixture stays the pre-revision block, and only Task 3 here copies the new §4.2 block (interfaces plus the chapter review's four amendments) into the second fixture.

## Global Constraints

- Repository rules: never commit (the user commits both repositories); no temporary files in the repo (scratch → the session scratchpad); stage nothing.
- Touch only these files: `js/ArchUML/c4/c4-schema.js`, `c4-yaml.js`, `c4-model.js`, `c4-projection.js`, `c4-checks.js`, `c4-query.js`, `c4-edit.js`, `c4-describe.js`, `c4-uml.js`, `c4-core.js`, `cli.js`, `schema/1/design.schema.json`, new files under `js/ArchUML/tests/c4/`, and the existing Milestone 1 test files only where Task 0 lists a change. Never `manifest.json`, `c4-render.js`, the bundle, site files, or `js/ArchUML/tests/c4/fixtures/course-registration.yml`.
- Every Milestone 1 test stays green. A Milestone 1 test changes only when Task 0 lists it: the facade version assertion (`'1.0.0'` → `'1.1.0'`, Task 10) and any test that compares whole objects that gain fields (rewritten to compare the fields it means). Each such change is recorded in the Task 0 audit file with its reason.
- Contracts only grow: new fields on `Model`, `Element`, `Relationship`, `ViewModel`; no field is renamed, removed, or retyped (`Element.provides` stays a flat string list).
- UMD wrapper, failsafe parsing, splice-only edits, the diagnostic shape, the id pattern, and canonical selectors exactly as the Milestone 1 Global Constraints.
- Rule ids, severities, exemptions, messages, and hints exactly as spec §7.2; `interface/*` rules run only on a model with at least one full-form interface or one `uses` entry, so shorthand-only models (the Milestone 1 fixture among them) keep their Milestone 1 diagnostics exactly.
- Milestone 2 runs at the same time and owns `c4-render.js`, the bundle, `REFERENCE.md`, and the site; anything this plan needs there is listed in Appendix A, not done here. Tests here never load the bundle to parse component text with keywords (that parser support arrives in Appendix A Task 11).
- Tests are named after behaviour and assert spec values exactly.

## Review Focus

1. Shorthand-to-full conversion keeps derived operation ids, so `uses: app.post-orders` written before the conversion still resolves after it, and the bytes outside the replaced `provides` value are unchanged → tests in Task 1 and Task 8.
2. `uses` across levels and directions: a component-level relationship using a container's interface (the coordinator handles it, delegation), event emission to a subscriber, emission into a topic, and broker peers; summaries carrying inherited uses → tests in Tasks 3, 4, 5, and 6.
3. Milestone 1 compatibility: the Milestone 1 fixture is untouched (it keeps the pre-revision block, J13), the new fixture keeps every Milestone 1 invariant (14 elements, 8 relationships, seven selectors, `'Container view of Course Registration: 3 containers, 1 person, 1 external system, 4 relationships.'`, zero errors and warnings, byte preservation of every Milestone 1 command), and the Task 0 audit lists every Milestone 1 test the new fields touch → Tasks 0, 3, 6, 8.
4. Untrusted text in syntax lines, interface names, type names, keywords, and examples (`"`, `{`, `}`, `<`, `>`, `-->`, `@enduml`, `<script>`, newlines) must not inject component-diagram statements → test in Task 9 (structural) and Appendix A Task 11 (parsed by the bundle).
5. Failsafe typing: `required` converts only inside field maps; field names such as `required`, `external`, and `instances` stay field names; `version: 1.10`, `code: 401`, and example values keep their exact text, and the card prints examples from their source text → tests in Task 2 and Task 5.

## Shared Types (added by Tasks 2–5; every task may rely on them)

```js
// Model additions (c4-model.normalize)
Model.vocabulary: [{ term, meaning, path }]                 // top-level shared dictionary
Model.interfaces: Map<id, Interface>                        // document order
Element.interfaceIds: string[]                              // interfaces declared on the element (never on code elements)
Element.provides: string[]                                  // unchanged type: syntax lines of its interfaces; on code elements the Milestone 1 strings
Relationship.uses: [{ interfaceId, operationId /* null = whole interface */, text, path,
                      kind /* 'request' | 'emit' | 'channel' | 'broker-peer' */, inherited /* false unless taken from summarized relationships */ }]
Relationship.requests: string[]                             // its responsibility plus every responsibility realized by a used operation
Interface = { id, providerId, shorthand, documentFormat, name, description, style, technology, version,
  restrictions: string[], errors: ErrorDef[], operations: Operation[], types: Map<name, TypeDef>, vocabulary: [{ term, meaning, path }], path }
Operation = { id, interfaceId, syntax, placeholders: string[], input: TypeUse | null, output: TypeUse | null, purpose,
  sideEffects: string[], restrictions: string[], errors: ErrorDef[],
  examples: [{ input, output, inputText, outputText, note, path }], realizes: string[], path }
ErrorDef = { name, code, when, path }
TypeUse = { typeText, type: TypeRef } | { fields: Field[] }
TypeRef = { name, list, primitive, canonical, spelling /* the alias or generic spelling written, else null */, defined } | { text, invalid: true }
TypeDef = { name, description, fields: Field[], path }
Field = { name, typeText, type: TypeRef | null, meaning, unit, format, required /* default true */,
  values: [{ value, meaning }] | null, valuesForm: 'list' | 'map' | null, constraints: string[], example, path }

// ViewModel additions (c4-projection.projectView)
ViewModel.key                                               // unchanged meaning: schema.selectorKey (canonical base without "with …", or the custom view id)
ViewModel.selector                                          // canonical selector including "with …"
ViewModel.annotations: string[]                             // effective annotations (custom view's plus the suffix's)
ViewModel.edges[].interfaces: [{ interfaceId, name, operationIds, inherited }]   // always filled; drawn only when annotated
ViewModel.edges[].technologySource: 'relationship' | 'interface' | null
ViewModel.nodes[].interfaces: [{ interfaceId, name, declaredOnName, delegatedFromName }]   // [] unless annotated
ViewModel.nodes[].pinAdjusted: boolean                      // filled by the renderer's layout (Appendix A Task 9); the core sets false
ViewModel.notation: … | 'uml-component' | 'interface-card'
ViewModel.uml (uml-component) = spec §5.3 rule 6
ViewModel.card (interface-card) = spec §5.3
// uml-sequence items gain operation: { interfaceId, operationId, syntax } | null when annotated with interfaces (spec §5.2 item 12)

// Selector grammar (c4-schema): parseSelector(text) → { type, scopeId, interfaceId, ofId, viewId, annotations, base, canonical } | { error }
// canonicalSelector(parsed) → string; selectorKey(parsed) → string
// Description (c4-describe.describe(viewModel, { panels })) — unchanged shape; no presentation field
```

---

### Task 0: Audit the Milestone 1 tests and record where the selector grammar lives

**Files:** none in the repository. The audit is a note in the session scratchpad, reported in the Task 10 checkpoint.

- [ ] **Step 1: Find whole-object comparisons and text edits of the fixture.** From the site root run `grep -nE "deepEqual\((.*\.)?(edges|nodes|relationships|elements|uml|card|model|viewModel|vm)\b" js/ArchUML/tests/c4/*.test.js`, `grep -nE "deepEqual\([^,]*(\.get\(|\[0\]|\.find\()" js/ArchUML/tests/c4/*.test.js`, and `grep -n "\.replace(" js/ArchUML/tests/c4/*.test.js`. For each hit decide: (a) unaffected (compares picked fields or a fixture that 1b does not change), or (b) affected because the compared object gains `interfaces`, `technologySource`, `selector`, `annotations`, `interfaceIds`, `uses`, `requests`, or `pinAdjusted`; list every (b) hit with its file, test name, and the field-picking rewrite.
- [ ] **Step 2: Find the responsibility-owner cases.** `grep -n "responsibility-owner" js/ArchUML/tests/c4/*.test.js`: a violating case whose responsibility belongs to an ancestor of the target outside the source's chain becomes valid under spec §4.6; list it with a replacement violating case (a responsibility of an unrelated sibling).
- [ ] **Step 3: Record where Milestone 1 parses selectors** (`grep -n "canonicalSelector\|parseSelector" js/ArchUML/c4/*.js`): the module, the functions, and their callers (layout-key canonicalization in `c4-model.js`, `changeElementId`, `pinPosition`). Task 1 moves the grammar into `c4-schema.js` and leaves thin delegating wrappers where Milestone 1 callers import it.
- [ ] **Step 4: Checkpoint.** The audit lists, per hit, "unchanged" or the exact rewrite. Expected (from the Milestone 1 plan): `schema.test.js` "the reference fixture parses as YAML", the three property tests in `yaml-collections.test.js`, and every test reading `fixtures/course-registration.yml` stay unchanged, because that file does not change; candidates for (b) are whole-edge or whole-node comparisons in `projection-c4.test.js` (context and container views), whole-relationship comparisons in `model-references.test.js`, and the version assertion in `core.test.js`.

---

### Task 1: `c4-schema.js` — interface catalogs, parsers, and the selector grammar

**Files:** Modify `js/ArchUML/c4/c4-schema.js` (and, per the Task 0 record, make the Milestone 1 selector functions delegate to it); Test `js/ArchUML/tests/c4/interfaces-schema.test.js`

**Interfaces (added to `ArchUMLC4Parts.schema`):** constants `INTERFACE_STYLES`, `STYLE_LABELS` (`{rest: 'REST', rpc: 'RPC', graphql: 'GraphQL', soap: 'SOAP', message: 'Message', event: 'Event', stream: 'Stream', library: 'Library', file: 'File'}`), `ERROR_WARNING_STYLES` (`rest, rpc, graphql, soap, message`), `SYNC_STYLES` (`rest, rpc, graphql, soap`), `EMITTER_STYLES` (`event, stream`), `BROKER_KINDS` (`queue, topic`), `INTERFACE_ORDER`, `OPERATION_ORDER`, `TYPE_ORDER` (`description, fields`), `FIELD_ORDER`, `EXAMPLE_KEYS` (`input, output, note`), `ERROR_KEYS` (`when, code`), `COLLABORATOR_ORDER` (`description, technology, connector, responsibility, uses, choices`; if Milestone 1 keeps its collaborator key list inside `c4-model.js`, move it here and have the model import it), `STEP_KEYS` (Milestone 1's step keys plus `uses`), `PRIMITIVE_TYPES`, `NUMERIC_TYPES` (`integer, number, decimal`), `TEMPORAL_TYPES` (`date, datetime, time, duration`), `TYPE_ALIASES` (`{str: 'string', int: 'integer', float: 'number', double: 'number', bool: 'boolean', dateTime: 'datetime', timestamp: 'datetime'}`), `TYPE_NAME_PATTERN` (`^[A-Za-z][A-Za-z0-9_]*$`), `FIELD_NAME_PATTERN` (`^[A-Za-z_][A-Za-z0-9_-]*$`), `IDENTIFIER_FIELD_PATTERN` (`^id$|_ids?$|Ids?$`), `QUANTITY_WORDS` (`price, amount, cost, fee, weight, distance, size, temperature`), `DATE_WORDS` (`date, time, deadline, birthday, dob`), `DATE_SUFFIX_WORDS` (`at, on`), `HTTP_METHODS`, `LEAK_WORDS` (spec §7.2 list), `ANNOTATION_BASES` (`{interfaces: ['landscape', 'context', 'containers', 'components', 'dynamic'], styles: ['landscape', 'context', 'containers', 'components'], tactics: <same as styles>, patterns: <styles> + 'code'}`), `INTERFACE_VIEW_FIELDS` (`{interfaces: ['view', 'title', 'description', 'show_title', 'exclude', 'direction'], interface: ['view', 'title', 'description', 'show_title']}`); `interfaces` added to the view annotation values; `interfaces`, `interface` added to `RESERVED_VIEW_IDS`; `vocabulary` added to the top-level keys. `TYPED_FIELDS` does not gain `required` (Task 2 converts it locally). Functions `deriveOperationId(syntax, takenSet) → string`; `parseTypeExpression(text) → TypeRef`; `parseUsesRef(text) → { interfaceId, operationId } | { error: 'uses-syntax' }`; `placeholders(syntax) → string[]` (`{name}` occurrences, in order); `splitWords(name) → string[]` (split at `_ - . /`, whitespace, and lower-to-upper case changes; lowercased); `leakWords(text) → string[]`; `parseSelector`, `canonicalSelector`, `selectorKey` (spec §5.1 grammar).

- [ ] **Step 1: Write the failing tests**

```js
test('operation ids derive from a call, an HTTP method and path, or the first words', () => {
  assert.equal(schema.deriveOperationId('evaluate(plan) -> EnrollmentOutcome', new Set()), 'evaluate');
  assert.equal(schema.deriveOperationId('POST /orders', new Set()), 'post-orders');
  assert.equal(schema.deriveOperationId('GET /readers/{id}', new Set()), 'get-readers-id');
  assert.equal(schema.deriveOperationId('send ChargeRequested to the queue billing.charges', new Set()), 'send-chargerequested-to');
  assert.equal(schema.deriveOperationId('→ ★', new Set()), 'op');
  assert.equal(schema.deriveOperationId('POST /orders', new Set(['post-orders'])), 'post-orders-2');
});
test('operation ids ignore a UML visibility marker and leading underscores', () => {
  assert.equal(schema.deriveOperationId('+ decide(student, section): Decision', new Set()), 'decide');
  assert.equal(schema.deriveOperationId('_refresh(cache)', new Set()), 'refresh');
});
test('derived operation ids are stable for a list read twice', () => {
  const ids = list => { const taken = new Set(); return list.map(s => schema.deriveOperationId(s, taken)); };
  const list = ['POST /orders', 'POST /orders', 'cancel(order)'];
  assert.deepEqual(ids(list), ['post-orders', 'post-orders-2', 'cancel']);
  assert.deepEqual(ids(list), ids(list));
});
test('type expressions read primitives, local types, lists, and other languages\' spellings', () => {
  assert.deepEqual(schema.parseTypeExpression('string[]'), { name: 'string', list: true, primitive: true, canonical: 'string[]', spelling: null });
  assert.deepEqual(schema.parseTypeExpression('EnrollmentOutcome'), { name: 'EnrollmentOutcome', list: false, primitive: false, canonical: 'EnrollmentOutcome', spelling: null });
  assert.deepEqual(schema.parseTypeExpression('str'), { name: 'string', list: false, primitive: true, canonical: 'string', spelling: 'str' });
  assert.deepEqual(schema.parseTypeExpression('dateTime'), { name: 'datetime', list: false, primitive: true, canonical: 'datetime', spelling: 'dateTime' });
  assert.equal(schema.parseTypeExpression('List<str>').canonical, 'string[]');
  assert.equal(schema.parseTypeExpression('list[Section]').canonical, 'Section[]');
  assert.equal(schema.parseTypeExpression('a number').invalid, true);
  assert.equal(schema.parseTypeExpression('string[][]').invalid, true);
});
test('uses references split at the single dot', () => {
  assert.deepEqual(schema.parseUsesRef('enrollment-api.submit-plan'), { interfaceId: 'enrollment-api', operationId: 'submit-plan' });
  assert.deepEqual(schema.parseUsesRef('enrollment-api'), { interfaceId: 'enrollment-api', operationId: null });
  assert.equal(schema.parseUsesRef('a.b.c').error, 'uses-syntax');
  assert.equal(schema.parseUsesRef('1api').error, 'uses-syntax');
});
test('placeholders are read from syntax lines', () => {
  assert.deepEqual(schema.placeholders('DELETE /v1/enrollments/{id}'), ['id']);
  assert.deepEqual(schema.placeholders('GET /terms/{term}/sections/{section_id}'), ['term', 'section_id']);
  assert.deepEqual(schema.placeholders('evaluate(plan) -> EnrollmentOutcome'), []);
});
test('interface catalogs and key orders match spec §4.11', () => {
  assert.deepEqual(schema.INTERFACE_STYLES, ['rest', 'rpc', 'graphql', 'soap', 'message', 'event', 'stream', 'library', 'file']);
  assert.deepEqual(schema.INTERFACE_ORDER, ['name', 'description', 'style', 'technology', 'version', 'restrictions', 'errors', 'operations', 'types', 'vocabulary']);
  assert.deepEqual(schema.OPERATION_ORDER, ['syntax', 'input', 'output', 'purpose', 'side_effects', 'restrictions', 'errors', 'examples', 'realizes']);
  assert.deepEqual(schema.FIELD_ORDER, ['type', 'meaning', 'unit', 'format', 'required', 'values', 'constraints', 'example']);
  assert.deepEqual(schema.PRIMITIVE_TYPES, ['string', 'integer', 'number', 'decimal', 'boolean', 'date', 'datetime', 'time', 'duration', 'uuid', 'uri', 'binary', 'any']);
  assert.deepEqual(schema.COLLABORATOR_ORDER, ['description', 'technology', 'connector', 'responsibility', 'uses', 'choices']);
  assert.ok(schema.RESERVED_VIEW_IDS.includes('interfaces') && schema.RESERVED_VIEW_IDS.includes('interface'));
  assert.ok(schema.ANNOTATION_BASES.interfaces.includes('dynamic') && !schema.ANNOTATION_BASES.interfaces.includes('code'));
  assert.ok(!('required' in schema.TYPED_FIELDS));
});
test('the selector grammar parses interface views, the with suffix, and layout keys', () => {
  assert.equal(schema.parseSelector('Interfaces of api').canonical, 'interfaces of api');
  assert.equal(schema.parseSelector('Interfaces of API').canonical, 'interfaces of API'); // element ids stay exact (spec §4.10)
  assert.equal(schema.parseSelector('interface Enrollment-API').interfaceId, 'enrollment-api');
  assert.equal(schema.parseSelector('Containers of registration with patterns, interfaces').canonical, 'containers of registration with interfaces, patterns');
  assert.equal(schema.selectorKey(schema.parseSelector('Containers of registration with interfaces')), 'containers of registration');
  const long = schema.parseSelector('Interface enrollment-api of api');
  assert.equal(long.canonical, 'interface enrollment-api');
  assert.equal(long.ofId, 'api');
  assert.ok(schema.parseSelector('containers of registration with colours').error);
  assert.equal(schema.canonicalSelector(schema.parseSelector('Container of Registration')), 'containers of registration');
});
test('leak words are found after splitting names into words', () => {
  assert.deepEqual(schema.splitWords('SeatTable'), ['seat', 'table']);
  assert.deepEqual(schema.leakWords('row_id'), ['row id']);
  assert.deepEqual(schema.leakWords('SELECT * FROM seats'), ['select']);
  for (const name of ['class_section', 'section_ids', 'request_id', 'next_cursor']) assert.deepEqual(schema.leakWords(name), []);
});
test('identifier field names are recognized', () => {
  for (const name of ['id', 'student_id', 'section_ids', 'studentId', 'sectionIds']) assert.match(name, schema.IDENTIFIER_FIELD_PATTERN);
  for (const name of ['units', 'amount', 'paid', 'width']) assert.doesNotMatch(name, schema.IDENTIFIER_FIELD_PATTERN);
});
```

- [ ] **Step 2: Run** `node --test js/ArchUML/tests/c4/interfaces-schema.test.js` → FAIL.
- [ ] **Step 3: Implement.** `deriveOperationId`: NFKD and strip marks; drop a leading `[+\-#~]\s*` and leading `_`; `^\s*([A-Za-z][A-Za-z0-9_]*)\s*\(` → the identifier; else `^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)` → slug of method and path; else slug of the first three words; empty or not starting with a letter → `op`; `uniqueId` for collisions. `parseTypeExpression`: `List<T>`, `list[T]`, `Array<T>`, `array<T>` → `T[]` with the written text as `spelling`; one trailing `[]`; alias lookup; anything else that does not match `TYPE_NAME_PATTERN` → `{text, invalid: true}`. Selector functions: move Milestone 1's grammar here unchanged for the seven bases, then add the two interface bases and the suffix; keywords and interface ids are lowercased in the canonical form (interface ids are unique ignoring case); element ids keep their exact spelling (spec §4.10).
- [ ] **Step 4: Run** the test file → PASS; `npm run test:unit` → PASS (Milestone 1 suites unchanged, including `layout keys are canonicalized`).
- [ ] **Step 5: Checkpoint** (no commit; `git -C js/ArchUML status --short` lists only `c4/c4-schema.js`, the delegating wrappers named in the Task 0 record, and the new test).

---

### Task 2: `c4-yaml.js` and `c4-model.js` — interface normalization

**Files:** Modify `js/ArchUML/c4/c4-yaml.js` (`flowText`), `js/ArchUML/c4/c4-model.js`; Create `js/ArchUML/tests/c4/fixtures/interfaces-shop.yml` (the spec §4.11 example block, verbatim); Test `js/ArchUML/tests/c4/interfaces-model.test.js`

**Interfaces:** `yaml.flowText(parsed, path) → string`: for a flow collection, its source slice with line breaks folded to single spaces; for a block collection, a flow rendering built from each scalar's source token (quotes kept as written); for a scalar, its source token. `normalize` fills `Model.vocabulary`, `Model.interfaces`, `Element.interfaceIds`, and `Element.provides` per Shared Types, including example `inputText`/`outputText` from `flowText`; structural diagnostics `schema/type`, `schema/value`, `schema/unknown-key` (suggestions from the new key lists; the comma hint), `schema/id-format`, `schema/misplaced-field` (`provides` on a person; full-form `provides` on a code element; per-base view fields on custom views over `interfaces of` and `interface`, using `schema.parseSelector` on `views.*.view`), `model/duplicate-id` (interface ids against interface and element ids, ignoring case; a shorthand's own element id excepted). Layout keys normalize with `schema.selectorKey`. This task does not resolve references (Task 3).

- [ ] **Step 1: Write the failing tests** (until Task 3 adds the second fixture, the reference here is Milestone 1's fixture plus the fragments each test pastes in):
  - `a shorthand provides list becomes one interface named after its element` — shop fixture: `model.interfaces.get('app')` has `providerId: 'app'`, `shorthand: true`, `name: 'Shop App interface'`, `style: null`; `operations.map(o => o.id)` deepEqual `['get-readers-id', 'post-orders']`; `elements.get('app').provides` deepEqual `['GET /readers/{id}', 'POST /orders']`; `interfaceIds` deepEqual `['app']`.
  - `a code element keeps its provides strings and declares no interface` — Milestone 1 fixture with `provides: ["+ evaluate(student, section): RuleResult"]` on `EnrollmentRule`: `interfaces.size === 0`, `elements.get('EnrollmentRule').provides` deepEqual that list, no diagnostic; a full-form `provides` map on `EnrollmentRule` → `schema/misplaced-field` whose message contains `operations`.
  - `the full form keeps the syntactic and semantic views` — shop fixture: `card-payments` has `style: 'rest'`, `technology: 'JSON/HTTPS'`, `version: '3'`; operation `charge` has `syntax: 'POST /v3/charges'`, `input.fields.map(f => f.name)` deepEqual `['amount', 'card_token', 'idempotency_key']`, `output.typeText === 'Charge'`, `errors.map(e => [e.name, e.code])` deepEqual `[['card-declined', '402'], ['invalid-amount', '400']]`, `sideEffects.length === 1`, `examples[0].note === 'A 12.50 USD charge that succeeds.'`, `examples[0].inputText === '{amount: 1250, card_token: tok_visa, idempotency_key: order-77}'`; `vocabulary` deepEqual one term `idempotency key`.
  - `operation, field, error, and value shorthands expand` — `refund` has `syntax: 'POST /v3/refunds'`, `purpose: null`, `errors: []`; field `Charge.id` has `typeText: 'string'`, `meaning: null`, `required: true`; field `Charge.status` has `values` deepEqual `[{value: 'succeeded', meaning: null}, {value: 'failed', meaning: null}]` and `valuesForm: 'list'`; an error written as a string has `when` = the string and `code: null`.
  - `values maps, constraints, interface-level restrictions and errors, and the shared vocabulary are read` — after pasting the revised §4.2 Enrollment API and top-level `vocabulary`: field `status.values` deepEqual `[{value: 'enrolled', meaning: 'the student now holds a seat in every section of the plan'}, {value: 'refused', meaning: 'the student holds no new seat; reason says why'}]`; `section_ids.constraints` deepEqual `['1 to 8 items, no duplicates']`; interface `restrictions.length === 2`, `errors.map(e => e.name)` deepEqual `['unauthorized', 'too-many-requests']`; `model.vocabulary.map(v => v.term)` deepEqual `['quarter unit']`.
  - `a document format has types and no operations` — `{name: Transcript, style: file, description: …, types: {Transcript: {fields: {…}}}}` → `documentFormat: true`, `operations` deepEqual `[]`, no diagnostic.
  - `the provides list of a full-form element flattens to syntax lines` — `elements.get('payments').provides` deepEqual `['POST /v3/charges', 'POST /v3/refunds']`.
  - Review Focus 5: `failsafe typing keeps version, codes, and example values verbatim` — `version: 1.10` → `'1.10'`; `code: 401` → `'401'`; example `output: {ok: no, mode: on}` → `{ok: 'no', mode: 'on'}` and `outputText === '{ok: no, mode: on}'`; `required: false` → `false`; `required: maybe` → `schema/type` at the value's line.
  - Review Focus 5: `field names that equal typed keys stay field names` — inline input `{required: boolean, external: {type: boolean, meaning: x}, instances: integer}` → three fields with `typeText` `'boolean'`, `'boolean'`, `'integer'` and no diagnostic.
  - `examples keep the spelling of their source` — the revised §4.2 example: `outputText === '{status: enrolled, units_enrolled: 8, decided_at: "2027-01-05T09:30:00-08:00"}'`; a block-form example input prints as one flow line with its quoted scalars quoted.
  - `mixing strings and maps in provides is a type error` → `schema/type`.
  - `an empty provides list or map declares no interface` — `provides: []` and `provides: {}` → `interfaces.size === 0`, `interfaceIds` deepEqual `[]`, no diagnostic.
  - `unknown keys in interfaces, operations, types, fields, errors, and examples are reported with suggestions` — `stlye` (message contains `style`), `purpos` (`purpose`), `feilds` (`fields`), `meanig` (`meaning`), `constriants` (`constraints`), `wehn` (`when`), `ouptut` (`output`); `x-notes` accepted.
  - `a comma inside a flow-map value is explained` — `units: {type: number, unit: quarter units, meaning: total units, after this attempt}` → `schema/unknown-key` on `after this attempt` whose hint contains `block map`; the hint is absent for an ordinary misspelt key.
  - `style values are validated with suggestions` — `style: restful` → `schema/value`, message contains `rest`.
  - `provides on a person is a misplaced field` → `schema/misplaced-field`, message `People do not provide interfaces; they may use one through \`uses\`` (spec §4.4 wording).
  - `interface ids share the element namespace` — two containers each declaring `orders` → one `model/duplicate-id` at the second key; an interface `billing` on another element → `model/duplicate-id` naming the element `billing`; interface ids `EnrollmentAPI` and `enrollmentapi` → `model/duplicate-id`; the shop's shorthand `app` on element `app` → no diagnostic.
  - `custom interface views accept only their fields` — `views: {x: {view: interfaces of api, include: [db]}}` → `schema/misplaced-field` at `include` in `load().diagnostics`; `{view: interface enrollment-api, direction: down}` → `schema/misplaced-field` at `direction`; `{view: dynamic enroll, annotations: [interfaces]}` → no diagnostic.
  - `layout keys normalize to the selector key` — layout key `Containers of registration with interfaces` → `model.layout` has `containers of registration`.
  - `interface, operation, type, field, and error names are validated` — `1api`, `Enrollment-Request`, `9x`, `Bad Error` → `schema/id-format` each, ranges on their keys.
  - `an example needs input, output, or note` — `examples: [{}]` → `schema/value`.
- [ ] **Step 2: Run** `node --test js/ArchUML/tests/c4/interfaces-model.test.js` → FAIL.
- [ ] **Step 3: Implement** `flowText` in the YAML adapter (CST tokens are kept, spec §4.9) and a `normalizeProvides(element, value, path, ctx)` helper inside `c4-model.js` (walks the shorthand or full form with paths; ranges from `yaml.rangeOf`; derived operation ids through `schema.deriveOperationId`; `required` converted inside field maps only; no typed conversion or unknown-key check on the keys of `fields`, inline field maps, `errors`, `values`, `vocabulary`, or `examples`).
- [ ] **Step 4: Run** the test file → PASS; `npm run test:unit` → PASS.
- [ ] **Step 5: Checkpoint.**

---

### Task 3: `c4-model.js` — `uses`, `responsibility`, `realizes`, type references, and the fixtures

**Files:** Modify `js/ArchUML/c4/c4-model.js`; Create `js/ArchUML/tests/c4/fixtures/course-registration-interfaces.yml` (the spec §4.2 block, verbatim, including its `yaml-language-server` comment: interfaces plus the chapter review's amendments), `fixtures/interfaces-events.yml`, `fixtures/interfaces-endpoint.yml`, `fixtures/interfaces-l14-booking.yml` (blocks below); Tests `js/ArchUML/tests/c4/interfaces-references.test.js`, `js/ArchUML/tests/c4/interfaces-invariants.test.js`

**Interfaces:** `Relationship.uses` with `kind` and `inherited`, `Relationship.requests`; per-field `TypeRef.defined`; reference diagnostics `model/unknown-reference` (interfaces, operations, `realizes` ids; suggestions; an element id in `uses` gets the hint naming its interfaces), `model/interface-provider` (spec §4.11, J7), `model/realizes-owner`, the widened `model/responsibility-owner` (spec §4.6), `xlevel/scenario-step` for a step `uses` outside its relationship's uses, and `schema/misplaced-field` for `uses` on deployment-node collaborators. Undefined types and spellings are not model diagnostics: Task 6 reports them as `interface/undefined-type` and `interface/type-spelling` from `TypeRef`.

`fixtures/interfaces-events.yml` (an event emitter, a topic, a subscriber, and an external subscriber):

```yaml
schema: c4-design/1
name: Campus Orders
systems:
  orders-system:
    name: Campus Orders
    description: Takes orders for course materials and ships them to students.
    containers:
      orders:
        name: Order Service
        technology: Java, Spring Boot
        description: Takes orders and announces every placed order.
        responsibilities:
          - do: announce every placed order to the services that act on it
            id: orders-announce
        collaborators:
          order-topic: {description: publishes placed orders to, technology: AMQP, connector: event, uses: order-events}
          analytics: {description: delivers placed orders to, technology: HTTPS webhook, connector: event, uses: order-events.order-placed}
        provides:
          order-events:
            name: Order events
            description: Announces each order a student places.
            style: event
            technology: AMQP, JSON
            version: 1
            operations:
              order-placed:
                syntax: OrderPlaced on the topic orders.placed
                output: OrderPlaced
                purpose: When a student places an order, the Order Service announces it once the order is stored.
                side_effects:
                  - None for the publisher; each subscriber decides what to do.
                examples:
                  - output: {order_id: o-1001, total: 2599, placed_at: "2027-01-05T10:00:00Z"}
                realizes: [orders-announce]
            types:
              OrderPlaced:
                description: One placed order.
                fields:
                  order_id:
                    type: string
                    meaning: identifies the order in every later event about it
                  total:
                    type: integer
                    meaning: amount the student pays, including sales tax
                    unit: US cents
                  placed_at:
                    type: datetime
                    meaning: the moment the order was stored
                    format: ISO 8601 in UTC
      order-topic:
        name: Order Topic
        kind: topic
        technology: RabbitMQ
        description: Carries placed-order events to every subscriber.
        responsibilities:
          - do: deliver every placed-order event to each subscriber
      shipping:
        name: Shipping Service
        technology: Python
        description: Packs and ships the materials of every placed order.
        responsibilities:
          - do: ship the materials of every placed order
        collaborators:
          order-topic: {description: subscribes to placed orders from, technology: AMQP, connector: event, uses: order-events.order-placed}
  analytics:
    name: Analytics Platform
    external: true
    description: Reports sales figures to the bookstore's managers.
```

`fixtures/interfaces-endpoint.yml`: the interface reference model with the Enrollment API moved onto a new component inside the API, so a component offers the remote interface (spec §4.11 Placement). Built once by hand from `course-registration-interfaces.yml`: move the `enrollment-api` entry out of `api.provides` (delete `provides` from `api`) into the block below as `enrollment-endpoint`, keeping every key from `description` through `vocabulary` and setting `realizes: [endpoint-do-1]` on `submit-plan`; add the block under `api.components`; replace `web`'s collaborators with `endpoint: {description: submits plans to, technology: JSON/HTTPS, uses: enrollment-endpoint.submit-plan}`. It has 15 elements and no model diagnostics, and is used only by the tests named in this plan.

```yaml
endpoint:
  name: Enrollment Endpoint
  technology: Python, FastAPI router
  stereotypes: [interfacer]
  responsibilities:
    - do: accept enrollment requests over HTTPS and return their outcomes
      id: endpoint-do-1
  collaborators:
    coordinator: passes each plan to
  provides:
    enrollment-endpoint:
      name: Enrollment endpoint
      # The remaining keys, from description through vocabulary, are copied from the
      # reference model's Enrollment API, with realizes: [endpoint-do-1] on submit-plan.
      style: rest
      technology: JSON/HTTPS
```

`fixtures/interfaces-l14-booking.yml` (the lecture's createBooking syntactic view, transcribed with its own type spellings):

```yaml
schema: c4-design/1
name: Flight Booking
systems:
  gds:
    name: Global Distribution System
    description: Lets booking systems and airlines exchange flights and bookings.
    provides:
      flight-booking:
        name: Flight Booking API
        style: rest
        operations:
          create-booking:
            syntax: POST /createBooking
            input:
              flightNumber:
                type: str
                meaning: The flight number using the code of the operating airline
              date:
                type: dateTime
                meaning: The date of the departing flight according to the time zone of the departure airport
              seat:
                type: str
                meaning: Seat number (same label as on the plane)
              paymentReference: PaymentMethod
              travelerName:
                type: str
                meaning: Full name of the person traveling in ASCII
```

- [ ] **Step 1: Write the failing tests**
  - Review Focus 3, `interfaces-invariants.test.js`: `the interface reference model keeps every Milestone 1 invariant` — on `course-registration-interfaces.yml`: `load` has no diagnostics; `elements.size === 14`; `rootIds` deepEqual `['student', 'registration', 'billing']`; `relationships.length === 8`; `listViews` gives the seven Milestone 1 selectors; the container view's brief equals `'Container view of Course Registration: 3 containers, 1 person, 1 external system, 4 relationships.'`; `check` with defaults gives no error and no warning; `[...model.interfaces.keys()]` deepEqual `['enrollment-api', 'tuition-charges']`; the chapter amendments are present (`requirements` FR-07 text starts `A student who lacks a prerequisite`; the `browser` node has one collaborator to `ingress`; `api-pod` has `technology: 'Kubernetes pod'`); the 2026-11-09 decisions are present (`Object.keys(requirements)` deepEqual `['FR-07', 'FR-09', 'FR-11']`; `registration` has the responsibility `sys-billing` with `requirements: ['FR-11']`; `api-billing` has `refines: 'sys-billing'`, so `rdd/uncovered-requirement` and `rdd/unrefined` report nothing for billing; the system's description contains no `conflict-free`; Tuition Charges' `charge-tuition` has `syntax: 'send ChargeRequested to the queue billing.charges'`). The Milestone 1 fixture is not changed by these decisions (J13). (These assertions run once Tasks 4, 6, and 9 have landed; until then the file asserts what exists and grows with them.)
  - `the Milestone 1 fixture is unchanged` — the SHA-256 of `fixtures/course-registration.yml` equals the value recorded in the Task 0 audit.
  - `uses resolves to interfaces and operations` — relationship `web->coordinator` has `uses` deepEqual `[{interfaceId: 'enrollment-api', operationId: 'submit-plan', text: 'enrollment-api.submit-plan', path: ['systems', 'registration', 'containers', 'web', 'collaborators', 'coordinator', 'uses'], kind: 'request', inherited: false}]`; `billing-gateway->billing` uses `tuition-charges.charge-tuition` (`kind: 'request'`); a list `uses: [a, b.x]` yields two entries in order.
  - Review Focus 2: `a request may target the provider, a descendant, or an ancestor outside the source's chain` — `web → coordinator` using `enrollment-api` (ancestor of the target) → no diagnostic; on the endpoint fixture, a `web → api` relationship using `enrollment-endpoint` (descendant of the target) → no diagnostic; `seats → db` using `enrollment-api` (provider contains the source) → `model/interface-provider` whose message names `Registration API`; `web → db` using `tuition-charges` → `model/interface-provider`.
  - Review Focus 2: `emitters and broker peers resolve by J7` — events fixture: `orders->order-topic` has `kind: 'channel'`, `orders->analytics` `kind: 'emit'`, `shipping->order-topic` `kind: 'broker-peer'`; removing `orders`' relationship to `order-topic` makes the shipping use `model/interface-provider`; a `message` interface provided by the source of a relationship to a non-broker target → `model/interface-provider`.
  - `a collaborator responsibility may belong to an ancestor of the target outside the source's chain` — `web → coordinator` with `responsibility: api-holds` → no diagnostic; `responsibility: sys-holds` (owned by `registration`, which contains `web`) → `model/responsibility-owner`.
  - `requests combine the responsibility with what the used operations realize` — `relationships.find(r => r.id === 'web->coordinator').requests` deepEqual `['api-eligibility', 'api-holds', 'api-billing']`.
  - `unknown interfaces, operations, and responsibilities are reported with suggestions` — `uses: enrolment-api.submit-plan` → `model/unknown-reference`, message contains `enrollment-api`; `uses: enrollment-api.submit` → message contains `submit-plan`; `uses: api.submit-plan` → hint contains `api is an element; name one of its interfaces: enrollment-api`; `realizes: [nope]` → `model/unknown-reference`.
  - `realizes must name a responsibility of the provider or its descendants` — `realizes: [sys-holds]` → `model/realizes-owner`; `realizes: [coordinator-do-1]` (id added) → no model diagnostic (Task 6 reports `interface/realizes-internal`).
  - `types from other languages load without errors` — booking fixture: `load().diagnostics` has no error; the `flightNumber` field's `type` is `{name: 'string', …, spelling: 'str'}`; `paymentReference` has `type.defined === false`.
  - `a scenario step's uses must be among its relationship's uses` — step `{from: web, to: coordinator, description: submits the plan to, uses: enrollment-api.submit-plan}` → no diagnostic; `uses: tuition-charges.charge-tuition` → `xlevel/scenario-step`.
  - `uses on a deployment-node collaborator is a misplaced field`.
  - `the second fixture equals the spec §4.2 block` — a run-step check (the spec lives in the site repository): see Step 4.
- [ ] **Step 2: Run** `node --test js/ArchUML/tests/c4/interfaces-references.test.js js/ArchUML/tests/c4/interfaces-invariants.test.js` → FAIL.
- [ ] **Step 3: Implement** reference resolution after the element walk (interfaces need the whole tree): resolve `uses` with their kinds, `responsibility`, `realizes`, step `uses`, then type expressions per interface. Create the four fixtures.
- [ ] **Step 4: Run** the test files → PASS; then `node -e "const fs=require('fs');const s=fs.readFileSync('docs/superpowers/specs/2026-11-08-c4-model-design.md','utf8');const b=s.split('### 4.2')[1].match(/\`\`\`yaml\n([\s\S]*?)\`\`\`/)[1];process.exit(b===fs.readFileSync('js/ArchUML/tests/c4/fixtures/course-registration-interfaces.yml','utf8')?0:1)"` → exit 0; then `npm run test:unit` → PASS with every Milestone 1 suite unchanged.
- [ ] **Step 5: Checkpoint.**

---

### Task 4: `c4-projection.js` — selectors, annotations, listing, sets, and edge interfaces

**Files:** Modify `js/ArchUML/c4/c4-projection.js`; Test `js/ArchUML/tests/c4/interfaces-projection.test.js`

**Interfaces:** `parseSelector` delegates to `schema.parseSelector`; `resolveView` validates scope types (`interfaces of` → system, container, component; `ofId` must be the interface's provider; each annotation only on `schema.ANNOTATION_BASES`); `listViews(model, { interfaces })`; `breadcrumbs` for the two new types (spec §5.1); `providedInterfaces(model, elementId) → [{ interfaceId, name, declaredOnId, declaredOnName, delegatedFromId, delegatedFromName }]`, `requiredInterfaces(model, elementId) → [{ interfaceId, name, providerId }]`, `interfaceConsumers(model, elementId) → [{ interfaceId, elementId, throughId, person }]` (spec §5.3 rules 1–3, exported for checks, query, and the editor); C4 projection adds `selector`, `annotations`, `edges[].interfaces` (with inherited summary uses), `edges[].technologySource`, `nodes[].interfaces`, `nodes[].pinAdjusted: false` (spec §5.2 items 9–11) and keeps `key = schema.selectorKey(…)`; dynamic projection adds `operation` to messages when annotated (item 12); deployment projection leaves out a derived instance link when explicit node collaborators connect the node hosting its source instance to the node hosting its target instance, directly or through other nodes of the same environment, in the relationship's direction (spec §6.3).

- [ ] **Step 1: Write the failing tests** (model: `course-registration-interfaces.yml` unless stated)

```js
test('interface selectors with the wrong scope are diagnosed', () => {
  assert.equal(p.resolveView(model, 'interfaces of student').diagnostic.rule, 'view/wrong-scope-type');
  assert.equal(p.resolveView(model, 'interfaces of EnrollmentPolicy').diagnostic.rule, 'view/wrong-scope-type');
  assert.equal(p.resolveView(model, 'interface nowhere').diagnostic.rule, 'view/unknown-selector');
  const d = p.resolveView(model, 'interface of api').diagnostic;
  assert.equal(d.rule, 'view/unknown-selector');
  assert.match(d.message, /interfaces of api/);
  assert.equal(p.resolveView(model, 'code of policy with interfaces').diagnostic.rule, 'view/wrong-scope-type');
  assert.ok(p.resolveView(model, 'code of policy with patterns').request);
  assert.ok(p.resolveView(model, 'dynamic enroll with interfaces').request);
  assert.ok(p.resolveView(model, 'interface Enrollment-API').request);
  const wrongProvider = p.resolveView(model, 'interface enrollment-api of web').diagnostic;
  assert.equal(wrongProvider.rule, 'view/wrong-scope-type');
  assert.match(wrongProvider.message, /Registration API/);
});
test('listViews lists interface views only on request', () => {
  const base = ['landscape', 'context of registration', 'containers of registration', 'components of api',
    'code of policy', 'dynamic enroll', 'deployment production'];
  assert.deepEqual(p.listViews(model).map(v => v.selector), base);
  assert.deepEqual(p.listViews(model, { interfaces: true }).map(v => v.selector), base.concat([
    'interfaces of registration', 'interfaces of web', 'interfaces of api', 'interfaces of coordinator',
    'interfaces of billing-gateway', 'interfaces of billing', 'interface enrollment-api', 'interface tuition-charges']));
});
test('breadcrumbs treat interface views as views of their element', () => {
  const crumbs = sel => p.breadcrumbs(model, p.resolveView(model, sel).request).map(b => b.label);
  assert.deepEqual(crumbs('interfaces of api'), ['Landscape', 'Context: Course Registration', 'Containers: Course Registration', 'Interfaces of Registration API']);
  assert.deepEqual(crumbs('interface enrollment-api'), ['Landscape', 'Context: Course Registration', 'Containers: Course Registration', 'Interface description: Enrollment API']);
});
```

  - `provided and required sets follow spec §5.3` — `providedInterfaces(model, 'api')` deepEqual `[{interfaceId: 'enrollment-api', name: 'Enrollment API', declaredOnId: null, declaredOnName: null, delegatedFromId: null, delegatedFromName: null}]`; `providedInterfaces(model, 'coordinator')` deepEqual `[{interfaceId: 'enrollment-api', name: 'Enrollment API', declaredOnId: null, declaredOnName: null, delegatedFromId: 'api', delegatedFromName: 'Registration API'}]`; `providedInterfaces(model, 'registration')` deepEqual `[]`; `requiredInterfaces(model, 'registration')` deepEqual `[{interfaceId: 'tuition-charges', name: 'Tuition Charges', providerId: 'billing'}]`; endpoint fixture: `providedInterfaces(endpoint, 'api')` has `declaredOnId: 'endpoint'`, `declaredOnName: 'Enrollment Endpoint'`; events fixture: `providedInterfaces(events, 'orders')` lists `order-events`, `requiredInterfaces(events, 'shipping')` lists `order-events` with `providerId: 'orders'`, `requiredInterfaces(events, 'orders')` and `requiredInterfaces(events, 'order-topic')` are `[]` (emissions are not requirements).
  - `consumers are lifted, and broker peers carry their topic` — `interfaceConsumers(model, 'billing')` maps to `[['tuition-charges', 'registration', null]]`; `interfaceConsumers(events, 'orders')` maps to `[['order-events', 'analytics', null], ['order-events', 'shipping', 'order-topic']]`.
  - Review Focus 2: `derived edges carry the interfaces of their sources` — container view: edge `web→api` has `interfaces` deepEqual `[{interfaceId: 'enrollment-api', name: 'Enrollment API', operationIds: ['submit-plan'], inherited: false}]`; edge `api→billing` carries `tuition-charges` with `['charge-tuition']`; context view edge `registration→billing` carries `tuition-charges`; edge `api→db` has `interfaces: []`.
  - Review Focus 2: `an explicit summary without uses carries the uses it summarizes` — add `registration → billing: {description: requests tuition charges from, technology: AMQP, connector: message}` → the context edge `registration→billing` is the explicit one and has `interfaces` deepEqual `[{interfaceId: 'tuition-charges', name: 'Tuition Charges', operationIds: ['charge-tuition'], inherited: true}]`.
  - `an explicit relationship keeps its own interfaces when it wins over derived ones` — add `web → api: {description: makes API calls to, technology: JSON/HTTPS, uses: enrollment-api}` → the single edge `web→api` has `interfaces` deepEqual `[{interfaceId: 'enrollment-api', name: 'Enrollment API', operationIds: [], inherited: false}]`.
  - `a relationship without technology takes the agreed technology of its interfaces` — remove `technology` from `web`'s collaborator → container edge `web→api` has `technology: 'JSON/HTTPS'`, `technologySource: 'interface'`; with a second used interface whose technology is `gRPC` → `technology: null`, `technologySource: null`; the declared case has `technologySource: 'relationship'`.
  - `nodes list provided interfaces only when annotated` — `containers of registration`: every node has `interfaces: []` and `annotations: []`; `containers of registration with interfaces`: `api` → `[{interfaceId: 'enrollment-api', name: 'Enrollment API', declaredOnName: null, delegatedFromName: null}]`, `billing` → `[{interfaceId: 'tuition-charges', name: 'Tuition Charges', declaredOnName: null, delegatedFromName: null}]`, `selector === 'containers of registration with interfaces'`, `key === 'containers of registration'`, and the node and edge ids equal those of the plain view; `components of api with interfaces`: `coordinator` → `delegatedFromName: 'Registration API'`.
  - `a custom view's annotations and the suffix combine` — `views: {overview: {view: containers of registration, annotations: [patterns]}}`; `projectView(model, 'overview with interfaces')` has `annotations` deepEqual `['interfaces', 'patterns']` and `key === 'overview'`.
  - `an explicit node route replaces the derived browser-to-pod path` — `deployment production` on the second fixture: `uml.links` include `browser→ingress` (`'sends HTTPS requests to'`) and `ingress→api-pod` (`'forwards HTTPS requests to'`), keep `api→db` and `api→billing`, and contain no `web→api` link; on the Milestone 1 fixture the links stay exactly as its Milestone 1 test lists them (`web→api` included); removing `ingress`' collaborator from the second fixture brings `web→api` back.
  - `dynamic views with interfaces name the operation of each step` — `dynamic enroll with interfaces`: the first message has `operation` deepEqual `{interfaceId: 'enrollment-api', operationId: 'submit-plan', syntax: 'POST /v1/enrollments'}`; the coordinator's internal steps have `operation: null`; `dynamic enroll` (plain) has `operation: null` everywhere.
- [ ] **Step 2–5:** run `node --test js/ArchUML/tests/c4/interfaces-projection.test.js` → FAIL, implement, run → PASS and `npm run test:unit` → PASS, checkpoint.

---

### Task 5: `c4-projection.js` — interfaces view and interface card models

**Files:** Modify `js/ArchUML/c4/c4-projection.js`; Test `js/ArchUML/tests/c4/interfaces-views.test.js`

**Interfaces:** `projectView` for `interfaces of` (notation `uml-component`, `uml` per spec §5.3 rules 1–6) and `interface` (notation `interface-card`, `card` per spec §5.3). Assembly labels: operation syntax lines joined by `', '`, the first two only, then `' (+N more)'`; `null` for a whole-interface use; `' (through <broker name>)'` appended for broker-peer uses. Example texts come from the model (`inputText`, `outputText`); projection never calls the YAML adapter.

- [ ] **Step 1: Write the failing tests**
  - `the interfaces view of the API shows its consumer, itself, and its provider` — `projectView(model, 'interfaces of api')`: `notation === 'uml-component'`, `title === 'Interface view: Registration API'`, `uml.direction === 'down'`; `uml.components.map(c => [c.id, c.role])` deepEqual `[['web', 'consumer'], ['api', 'scope'], ['billing', 'provider']]`; `uml.components[1].requires` deepEqual `[{interfaceId: 'tuition-charges', name: 'Tuition Charges'}]`; `uml.components[2].external === true`, `typeLabel === 'Software System, external'`; `uml.assemblies` deepEqual `[{interfaceId: 'enrollment-api', providerId: 'api', consumerId: 'web', label: 'POST /v1/enrollments', throughId: null, throughName: null}, {interfaceId: 'tuition-charges', providerId: 'billing', consumerId: 'api', label: 'send ChargeRequested to the queue billing.charges', throughId: null, throughName: null}]`; `uml.people` deepEqual `[]`, `uml.notes` deepEqual `[]`.
  - `the coordinator handles the API's interface` — `interfaces of coordinator`: components `[['web', 'consumer'], ['coordinator', 'scope']]`; the scope's `provides[0].delegatedFromName === 'Registration API'`; `uml.notes` deepEqual `['Enrollment API belongs to Registration API; Registration Coordinator handles its calls.']`.
  - `consumers and providers are lifted to the scope's level` — `interfaces of billing`: components `[['registration', 'consumer'], ['billing', 'scope']]`; `interfaces of registration`: `[['registration', 'scope'], ['billing', 'provider']]`.
  - `people appear as a note, not as components` — add person `adviser` (`name: Adviser`) with `api: {description: checks enrollment outcomes through, technology: JSON/HTTPS, uses: enrollment-api}` → no component `adviser`; `uml.people` deepEqual `[{id: 'adviser', name: 'Adviser', interfaceIds: ['enrollment-api']}]`; `uml.notes[0] === 'Also used directly by Adviser (person).'`.
  - `offered-through interfaces are noted` — endpoint fixture, `interfaces of api`: the scope provides `enrollment-endpoint` with `declaredOnName: 'Enrollment Endpoint'`; `uml.notes` deepEqual `['Enrollment endpoint is offered through Enrollment Endpoint.']`.
  - `broker peers are drawn from the publisher with the topic in the label` — events fixture, `interfaces of orders`: components `[['analytics', 'consumer'], ['shipping', 'consumer'], ['orders', 'scope']]`; assemblies' labels `['OrderPlaced on the topic orders.placed', 'OrderPlaced on the topic orders.placed (through Order Topic)']`.
  - `an element without interfaces shows itself with an empty-state text` — `interfaces of db`: one component, `uml.assemblies` deepEqual `[]`, `uml.emptyText === 'Registration Database provides and uses no described interfaces yet.'`.
  - `assembly labels list two operations and count the rest; whole-interface uses have no label` — add `list-plans: GET /v1/plans` and `cancel-plan: DELETE /v1/enrollments/{id}` to the Enrollment API and `web` uses `[enrollment-api.submit-plan, enrollment-api.list-plans, enrollment-api.cancel-plan]` → label `'POST /v1/enrollments, GET /v1/plans (+1 more)'`; `uses: enrollment-api` → `label: null`.
  - `exclude removes consumers and their assemblies; direction comes from a custom view` — `{view: interfaces of api, exclude: [web]}` → no `web` component, one assembly; `{view: interfaces of api, direction: right}` → `uml.direction === 'right'`.
  - `the card holds both views and the field rows` — `projectView(model, 'interface enrollment-api')`: `notation === 'interface-card'`, `title === 'Interface description: Enrollment API'`, `card.typeLabel === 'REST interface · JSON/HTTPS · version 1'`, `card.provider` deepEqual `{id: 'api', name: 'Registration API', typeLabel: 'Container: Python, FastAPI'}`; `card.usedBy` deepEqual `[{elementId: 'web', name: 'Planner Web App', typeLabel: 'Container: TypeScript, React', operationIds: ['submit-plan']}]`; `card.handledBy` deepEqual `[{elementId: 'coordinator', name: 'Registration Coordinator', operationIds: ['submit-plan']}]`; `card.all.errors.map(e => e.name)` deepEqual `['unauthorized', 'too-many-requests']`; `card.operations[0]` has `id: 'submit-plan'`, `syntax: 'POST /v1/enrollments'`, `input` deepEqual `{typeText: 'EnrollmentRequest'}`, `errors.map(e => e.name)` deepEqual `['invalid-plan', 'unknown-section']`, `examples[0].outputText === '{status: enrolled, units_enrolled: 8, decided_at: "2027-01-05T09:30:00-08:00"}'`, and `realizes` deepEqual `[{id: 'api-eligibility', kind: 'decide', text: 'whether a student may enroll in a section', ownerName: 'Registration API'}, {id: 'api-holds', kind: 'do', text: 'hold a seat in every section of a plan, or in none', ownerName: 'Registration API'}, {id: 'api-billing', kind: 'do', text: 'request the tuition charge for every completed enrollment', ownerName: 'Registration API'}]`; `card.types.map(t => t.name)` deepEqual `['EnrollmentRequest', 'EnrollmentOutcome']`; the `units_enrolled` row deepEqual `{name: 'units_enrolled', typeText: 'number', required: true, inPath: false, values: null, constraints: [], meaning: 'total units the student holds in the term after this attempt', unit: 'quarter units', format: null, example: null}`; the `status` row's `values` deepEqual `[{value: 'enrolled', meaning: 'the student now holds a seat in every section of the plan'}, {value: 'refused', meaning: 'the student holds no new seat; reason says why'}]`; `card.vocabulary` deepEqual `[{term: 'section', meaning: 'one scheduled offering of a course in one term', shared: false}, {term: 'plan', meaning: 'the sections a student wants to take together in one term', shared: false}, {term: 'quarter unit', meaning: 'the UCLA credit unit; most courses are worth 4 quarter units', shared: true}]`.
  - `message, shorthand, and document-format interfaces project their own cards` — `interface tuition-charges`: `typeLabel === 'Message interface · AMQP, JSON · version 2'`, `operations[0].output === null`, `operations[0].errors[0].code === null`; shop `interface app`: `shorthand: true`, `typeLabel === 'Interface · syntax only'`, `operations.map(o => o.syntax)` deepEqual `['GET /readers/{id}', 'POST /orders']`, `purpose: null`; a `file` interface with types only: `documentFormat: true`, `operations` deepEqual `[]`.
  - `inline field maps and path parameters appear as table rows` — shop `interface card-payments`: a `types` entry `{name: 'charge input', owner: {operationId: 'charge', part: 'input'}}` with field names `['amount', 'card_token', 'idempotency_key']`; an operation `get-plan: {syntax: GET /v1/plans/{id}, input: {id: {type: string, meaning: …}}, …}` → `placeholders` deepEqual `['id']` and the `id` row has `inPath: true`.
- [ ] **Step 2–5:** run `node --test js/ArchUML/tests/c4/interfaces-views.test.js` → FAIL, implement, run → PASS, checkpoint.

---

### Task 6: `c4-checks.js` — interface rules

**Files:** Modify `js/ArchUML/c4/c4-checks.js`; Test `js/ArchUML/tests/c4/interfaces-checks.test.js`

**Interfaces:** `RULES` gains `model/interface-provider`, `model/realizes-owner` (documentation entries; produced by the model) and every `interface/*` rule with id, severity, category, title, message pattern, hint, rationale, and source exactly as spec §7.2; the rules run only when the model has a full-form interface or a `uses` entry; error and restriction counts include the interface level; `interface/unspecified-use` is silent when a summarized or summarizing relationship names an interface; `c4/cross-container-technology` counts `technologySource: 'interface'`; `applyConfig`'s incompleteness set gains `interface/no-syntax`, `untyped-field`, `undefined-type`, `no-purpose`, `no-errors`, `no-unit`, `no-format`, and `suppressIncompleteFor` accepts interface ids. Diagnostics carry `element` = provider id (relationship rules: source id), `path` to the offending node, and `interface` (and `operation`, `field` where one applies).

- [ ] **Step 1: Write the failing tests**
  - Review Focus 3: `the interface reference model has no interface diagnostics` — `run` + `applyConfig` with defaults on `course-registration-interfaces.yml` → no error, no warning, and no diagnostic in category `interface`.
  - `the shop example reports exactly the interface diagnostics its comments name` — category `interface`, mapped to `rule severity element`, sorted: `['interface/no-errors warning payments', 'interface/no-meaning info payments', 'interface/no-meaning info payments', 'interface/no-purpose warning payments', 'interface/unused info app', 'interface/unused-operation info payments']` (the operation is `refund`; the fields `Charge.id`, and `Charge.status` for its values).
  - `the event fixture reports only the missing errors of an event, as info` — events fixture → exactly `[{rule: 'interface/no-errors', severity: 'info', element: 'orders'}]` in category `interface`.
  - `the lecture's createBooking loads with suggestions, not errors` — booking fixture: no error; category `interface`, mapped to `rule severity`, sorted: `interface/no-errors warning`, `interface/no-format warning` (`date`), `interface/no-meaning info` (`paymentReference`), `interface/no-purpose warning`, `interface/type-spelling info` (`str`), `interface/type-spelling info` (`dateTime`), `interface/undefined-type warning` (`PaymentMethod`, hint `Add PaymentMethod under Types, or use a primitive such as string.`), `interface/unused info`.
  - One passing and one violating fixture per rule, asserting rule id, severity, element, and range line:
    - `interface/no-syntax` (full-form operation without `syntax`; an interface with neither operations nor types → warning; a document format passes);
    - `interface/untyped-field` (`{meaning: x}` without `type` → warning);
    - `interface/undefined-type` (output `Section` not defined → warning; `type: a number` → warning with the prose hint; `Charge[]` defined → nothing);
    - `interface/type-spelling` (`int` and `List<int>` in one interface → one info per spelling, message names `integer` and `integer[]`);
    - `interface/no-purpose` (shop `refund` → warning at the `refund` key; shorthand interfaces exempt; a document format without `description` → warning);
    - `interface/no-errors` (shop `refund` → **warning**, style `rest`; `message` → warning; `event` → **info** with the delivery hint; `library` on a component → info; style unset on a container → **info**; interface-level errors satisfy every operation);
    - `interface/no-unit` (`number`, `integer`, `decimal` without `unit` → warning, also with a `meaning`, whose hint mentions moving the unit when the meaning contains `cents`; `unit: items` passes; a `values` map with a meaning per value passes; a `values` list does not; identifier names `id`, `section_id`, `section_ids`, `sectionId` exempt; `price: string` → **info**; `title: string` → nothing);
    - `interface/no-format` (`date`, `datetime`, `time`, `duration` without `format` → warning; removing `format` from `decided_at` → one warning; `starts_on: string`, `created_at: string`, `birthday: string` → **info**; `seat: string`, `timeout: string` → nothing);
    - `interface/example-mismatch` (output key `units` instead of `units_enrolled` → warning naming `units`; missing required `decided_at`; `status: accepted`; `units_enrolled: eight`; `reason` absent passes because it is optional; an event example checked against `output`);
    - `interface/realizes-internal` (`realizes: [api-eligibility, api-holds, coordinator-do-1]` → warning naming `Registration Coordinator`; `policy-decide-1`, which refines `api-eligibility`, passes);
    - `interface/in-process-across-boundary` (Milestone 1 fixture with `web → api: {…, uses: coordinator.evaluate}` → warning on `web`; endpoint fixture → nothing; `coordinator → policy` using a `library` interface of `policy` → nothing);
    - `interface/requested-not-advertised` (`web → coordinator` with `responsibility: api-holds` and `submit-plan.realizes: [api-eligibility]` → warning; with the reference `realizes` → nothing; `responsibility: policy-decide-1` while `realizes` lists `api-eligibility` → nothing, refinement relates them);
    - `interface/syntax-only` (shorthand interface used by `web → api` → info; used between sibling components → nothing);
    - `interface/no-meaning` (shop `Charge.id` → info; shop `Charge.status` values → info; the same values on an interface used only inside one container → nothing);
    - `interface/no-example` (full-form operation used across containers without examples → info; unused operation → nothing);
    - `interface/unrealized` (internal container with responsibilities, operation without `realizes` → info; external provider and provider without responsibilities → nothing);
    - `interface/leaks-implementation` (field `row_id`, type `SeatTable`, syntax `SELECT seats` → info; `class_section`, `request_id`, and `next_cursor` → nothing);
    - `interface/conflicting-vocabulary` (an interface redefining the shared `quarter unit` with another meaning → info naming the interface and "the shared vocabulary"; `' Quarter  unit '` with the same meaning modulo case and whitespace → nothing; the same term defined differently in two interfaces → info naming both);
    - `interface/style-mismatch` (`connector: message` with a `rest` interface → info; `call` with a `message` interface → info; the reference model and the event fixture → nothing);
    - `interface/unspecified-use` (component → external system without `uses` → info whose hint contains `Tuition Charges`; target without interfaces → hint suggests describing the interface relied on; a summary `registration → billing` without `uses` whose detail names `tuition-charges` → nothing; a detail without `uses` whose summary names it → nothing; person → system and container → container in one system → nothing);
    - `interface/unused` (an interface nobody uses → info; used only by a whole-interface `uses` → nothing; entry point: an unused interface on `web` while `student → web` has no `uses` → nothing, and the same interface on `db` → info; the event interface used only by an emission into the topic → info);
    - `interface/unused-operation` (shop `refund` → info; with `uses: card-payments` (whole interface) → nothing);
    - `interface/no-version` (shop `card-payments` without `version` → info; the reference Enrollment API without `version` → nothing, it is not used across a system boundary);
    - `interface/unbound-parameter` (`GET /v1/plans/{id}` without an input field `id` → info; with it → nothing; shorthand exempt).
  - `a used interface's technology satisfies c4/cross-container-technology` — `web`'s collaborator without `technology` but using `enrollment-api` → no `c4/cross-container-technology`; a second interface without technology → the rule fires.
  - `interface rules stay silent on shorthand-only models` — the Milestone 1 fixture → no diagnostic in category `interface`; replacing `web`'s collaborator with `api: {description: submits plans to, technology: JSON/HTTPS, uses: coordinator.evaluate}` switches the rules on: category `interface` maps to `rule element`, sorted, `['interface/in-process-across-boundary web', 'interface/syntax-only coordinator', 'interface/unspecified-use billing-gateway']`.
  - `no interface message names a value of the reference model` — collect every `interface/*` message and hint produced over all fixtures in this file; none contains `quarter unit`, `US cents`, `nine digits`, `ISO 8601`, `six-digit`, or a vocabulary term of the reference model.
  - `incompleteness rules on an interface wait until it has lost focus` — `applyConfig(…, {suppressIncompleteFor: ['card-payments']})` hides `interface/no-purpose` and `interface/no-errors` on `refund` and still shows `interface/no-meaning` when info is not hidden.
- [ ] **Step 2–5:** run `node --test js/ArchUML/tests/c4/interfaces-checks.test.js` → FAIL, implement, run → PASS and `npm run test:unit` → PASS (the Milestone 1 golden test included), checkpoint.

---

### Task 7: `c4-query.js` — interface predicates

**Files:** Modify `js/ArchUML/c4/c4-query.js`; Create `js/ArchUML/tests/c4/fixtures/interfaces-step2-seed.yml`; Test `js/ArchUML/tests/c4/interfaces-query.test.js`

**Interfaces:** queries `interface:` and `operation:`; element filter `provides_interface`; relationship filter `uses`, `uses_interface` (`present · absent · whole`), `requests`; interface, operation, and field filters exactly spec §8 (`restrictions` and `errors_at_least` count the interface level; `realizes` under J12; `realizes_any`; `realizes_at_least`; `type_any`; `constraints`; `values: present · absent · meaningful`); `same_as_seed: {interface: <filter>, part: all | syntax}` (matches taken in the seed; an empty match set fails; same id and provider; data equal ignoring paths; `syntax` compares only the syntactic view); unresolved ids fail with `unknown interface X`, `unknown operation X.Y`, `unknown responsibility X`; `validatePredicate` knows the new keys and suggests corrections.

`fixtures/interfaces-step2-seed.yml` (the interface tutorial's step 2 seed; Milestone 5 reuses it): `course-registration-interfaces.yml` with ids on three internal responsibilities (`coordinator-do-1` on "sequence one enrollment attempt", `coordinator-decide-1` on "which step of the attempt runs next", `seats-know-1` on "which seats are held for each attempt") and, in `enrollment-api` only: the interface's `restrictions`, `errors`, and `vocabulary` removed; `purpose`, `side_effects`, `restrictions`, `errors`, `examples`, and `realizes` removed from `submit-plan`; every field's `meaning`, `unit`, `format`, and `example` removed, and the `status` values map written as the list `[enrolled, refused]`; `uses` removed from `web`'s collaborator. Constraints, types, required flags, the top-level vocabulary, and the whole Tuition Charges interface stay.

- [ ] **Step 1: Write the failing tests**
  - `the twelve interface examples in spec §8 pass on the reference model` (the YAML block, parsed with the vendored YAML library and evaluated one by one with `seedModel` = the reference model; each `passed === true`).
  - `the step 2 seed passes only the examples it should` — `seedModel` = the seed: examples 1, 7, 8, and 9 pass; 2–6 and 10–12 fail.
  - `realizes counts refinements only when they cover the parent` — ids `policy-decide-1` and `seats-do-1` on the refining responsibilities and `realizes: [policy-decide-1, seats-do-1]` → `{operation: {of: enrollment-api, realizes: [api-eligibility, api-holds]}}` passes; adding a second DECIDE `policy-decide-2` that refines `api-eligibility` → `{realizes: api-eligibility}` fails and `{realizes: api-holds}` passes; `realizes: [api-holds]` alone → the list predicate fails and `{realizes: api-holds}` passes.
  - `realizes_any and realizes_at_least read the written list` — on the seed with `realizes: [coordinator-do-1]`: `{realizes_any: [coordinator-do-1, seats-know-1]}` passes, `{realizes: api-eligibility}` fails, `{realizes_at_least: 1}` passes; on the seed itself `{realizes_at_least: 1}` fails.
  - `inherited restrictions and errors count for the operation` — example 10 passes although `submit-plan` declares no restrictions; removing the interface's `restrictions` makes it fail; `{errors_at_least: 4}` passes and `{errors_at_least: 5}` fails.
  - `requests read the responsibilities realized by the used operation` — example 11 passes; without `web`'s `uses` it fails; `{from: web, to: api, requests: api-billing}` passes.
  - `whole-interface and operation uses match as specified` — `web`'s collaborator with `uses: enrollment-api`: `{relationship: {from: web, to: api, uses: enrollment-api}}` passes; `uses: enrollment-api.submit-plan` fails; `uses_interface: whole` passes; with the reference `uses`, `uses_interface: whole` fails.
  - `uses_interface distinguishes relationships with and without interfaces` — `exists: relationship {from: seats, to: db, uses_interface: absent}` passes; `{from: web, to: api, uses_interface: absent}` fails.
  - `field filters read constraints, values, and type lists` — example 12 passes; on the seed it fails (values without meanings); `{input_has_field: {name_any: [section_ids], constraints: absent}}` fails; `{output_has_field: {name_any: [units_enrolled], type_any: [integer, number, decimal]}}` passes.
  - `provides_interface with an empty filter matches every provider` — `count: element {provides_interface: {}}` with `equals: 3` passes (`api`, `coordinator` through delegation, `billing`).
  - `interface filters select by provider, containment, style, and use` — `exists: interface {in: registration, style: rest}` passes; `exists: interface {of: billing, used_by: billing-gateway}` passes; `exists: interface {of: billing, used_by: web}` fails.
  - `same_as_seed on an interface compares the chosen part` — seed = reference: adding `list-plans: GET /v1/plans` → example 9 (`part: syntax`) fails; changing `submit-plan.purpose` → example 9 passes and `{same_as_seed: {interface: {id: enrollment-api}}}` fails; moving `provides` from `api` to `coordinator` → fails; deleting the Enrollment API → fails; an interface filter that matches nothing in the seed → fails; changing the coordinator's description → both pass.
  - `unresolved interface, operation, and responsibility ids fail` — `uses: enrolment-api` → `passed: false`, message `unknown interface enrolment-api`; `operation: {of: enrollment-api, id: submit}` → `unknown operation enrollment-api.submit`; `has_operation: {realizes: nope}` → `unknown responsibility nope`; `interface: {id: Enrollment-API}` resolves.
  - `unknown predicate keys are author errors with suggestions` — `has_operations` → message contains `has_operation`; `unit_anyy` → `unit_any`; `realize_any` → `realizes_any`; keys left out of the vocabulary on purpose (`shorthand`, `version`, `operations_at_least`) are unknown keys.
  - `a checks predicate over interface rules must reach the asserted severity` — `validatePredicate({checks: {max_errors: 0, rules: ['interface/no-unit']}})` reports an error; `{max_warnings: 0, rules: ['interface/no-unit']}` is valid; `{max_warnings: 0, rules: ['interface/no-meaning']}` reports an error (info only).
- [ ] **Step 2–5:** run `node --test js/ArchUML/tests/c4/interfaces-query.test.js` → FAIL, implement (create the seed fixture by hand from the second fixture), run → PASS, checkpoint.

---

### Task 8: `c4-edit.js` — interface commands and cascades

**Files:** Modify `js/ArchUML/c4/c4-edit.js`; Test `js/ArchUML/tests/c4/interfaces-edit.test.js`

**Interfaces:** commands (all return `{ text, edits, selection } | { error }`; `selection` carries `interfaceId`, `operationId`, `typeName`, or `fieldName` where relevant):
- `expandProvidesShorthand {elementId}` (one splice replacing the `provides` value with the full form: `name: <Element> interface` and `operations: {<derived id>: <syntax>}`);
- `addInterface {elementId, name, id?, style?, technology?}` (slug id from the name, `uniqueId` against the shared namespace; expands a shorthand list first, as one result), `updateInterface {interfaceId, field, value}` (`value: null` deletes; fields of `INTERFACE_ORDER` except `operations`, `types`, `vocabulary`, `restrictions`, `errors`), `removeInterface {interfaceId}`, `changeInterfaceId {interfaceId, newId}` (errors `id-format`, `id-taken`, `shorthand`);
- `setRestrictions {interfaceId, operationId?, items: string[]}` (operation level when `operationId` is given, else interface level; `[]` deletes the key);
- `addOperation {interfaceId, syntax, id?}` (string form), `updateOperation {interfaceId, operationId, field, value}` (switches the string form to a map only when a non-syntax field is set), `renameOperation {interfaceId, operationId, newId}`, `removeOperation {interfaceId, operationId}`, `moveOperation {interfaceId, from, to}`;
- `setError {interfaceId, operationId?, name, value}` (`value`: a string, `{when, code}`, or `null`; interface level when `operationId` is absent);
- `addExample {interfaceId, operationId, inputText?, outputText?, note?}`, `updateExample {interfaceId, operationId, index, inputText?, outputText?, note?}`, `removeExample {interfaceId, operationId, index}` — each text must parse as a single flow node (else `{error: 'example-syntax', message, line}`) and is spliced in verbatim;
- `setType {interfaceId, typeName, value}` (`null` refused with `{error: 'type-in-use', uses: [...]}` while referenced), `renameType {interfaceId, typeName, newName}` (rewrites `T` and `T[]` in `input`, `output`, field types);
- `setField {interfaceId, owner: {typeName} | {operationId, part: 'input' | 'output'}, fieldName, field}` (writes the type string when `field` has only `type`; a flow map for syntax-only keys; a block map once `field` has a `meaning`; types written in standard spelling; `null` deletes), `renameField {interfaceId, owner, fieldName, newName}`, `setValues {interfaceId, owner, fieldName, values}` (`values`: a list, or a map from value to meaning; `null` deletes);
- `setVocabularyTerm {interfaceId | null, term, meaning}` (`null` interface = the top-level vocabulary; `meaning: null` deletes);
- `setUses {relationshipId, uses: string[]}` (refuses unresolvable entries with `{error: 'unknown-interface'}` and entries J7 forbids with `{error: 'interface-provider'}`; `[]` deletes the key; switches a string collaborator to the map form, keys in `COLLABORATOR_ORDER`; one entry → scalar, several → flow list);
- `setList {elementId, field: 'provides', items}` refuses a full-form `provides` (`{error: 'provides-full-form'}`, no edits);
- cascades: `changeElementId` rewrites `uses` entries and `interface <id>` selectors naming the element's shorthand interface, `interfaces of <id>` selectors, and the `of <id>` of `interface <i> of <id>`; `deleteElement` follows spec §4.10 (no reference inside a subtree the command removes is listed or edited; `uses` whose provider is a strict descendant of a surviving target; `realizes` on a surviving ancestor's operation); `moveElement` removes the `uses`, `responsibility`, and `realizes` entries that stop resolving, in the same splice; `removeResponsibility` removes the id from `realizes`; `removeInterface`/`removeOperation` remove the `uses` entries naming them (relationships and scenario steps); `dependentsOf` and the new `interfaceDependentsOf(model, interfaceId)` list every such site.

- [ ] **Step 1: Write the failing tests** (model: `course-registration-interfaces.yml` unless stated)
  - `setUses removes and adds uses inside a flow map` — `setUses {relationshipId: 'web->coordinator', uses: []}` turns the line into `coordinator: {description: submits plans to, technology: JSON/HTTPS}` exactly, and `setUses(…, ['enrollment-api.submit-plan'])` on that result restores the fixture byte for byte.
  - `setUses turns a string collaborator into a block map` — `setUses {relationshipId: 'coordinator->billing-gateway', uses: []}` is a no-op without edits; on a variant where `billing-gateway` provides `["request(enrollment) -> ChargeId"]`, `setUses(…, ['billing-gateway.request'])` turns `billing-gateway: asks for tuition charges through` into a block map with `description` then `uses`, indented like its siblings; `setUses(…, [])` keeps the map form and the reloaded relationship has `uses: []`.
  - `setUses refuses unknown and forbidden interfaces` — `['enrolment-api']` → `{error: 'unknown-interface'}`; on `seats->db`, `['enrollment-api']` → `{error: 'interface-provider'}`; no edits in either case.
  - Review Focus 1: `expanding a shorthand list keeps its derived operation ids` — shop fixture with `uses: app.post-orders` added on a new relationship from `payments`; after `expandProvidesShorthand {elementId: 'app'}` the reloaded model has `interfaces.get('app').shorthand === false`, operation ids `['get-readers-id', 'post-orders']`, name `'Shop App interface'`, and no `model/unknown-reference`; exactly one edit, whose range is the old `provides` value.
  - `addInterface on a shorthand element expands first and returns one result` — the second interface appears after `app` in `provides`; undoing the single edit restores the input.
  - `addOperation writes the string form and updateOperation switches to the map form only when needed` — `addOperation {interfaceId: 'enrollment-api', syntax: 'GET /v1/enrollments/{id}'}` → reloaded operation id `get-v1-enrollments-id` with only `syntax`; `updateOperation … field: 'syntax'` keeps the string form; `field: 'purpose'` writes a block map with `syntax` then `purpose`.
  - `setField writes the type string, a flow map for syntax, and a block map once a meaning is set` — `setField … {type: number}` → `units: number`; `{type: number, required: false}` → `units: {type: number, required: false}`; `{type: number, meaning: credits counted, unit: items}` → a block map with keys in `FIELD_ORDER`; `{type: str}` writes `type: string`.
  - `setValues writes a list or a map of meanings` — `status` → `values: [a, b]`, then `{a: first, b: second}` → a block map under `values`.
  - `setRestrictions and setError write at the interface or operation level` — `setError {interfaceId: 'enrollment-api', name: 'unavailable', value: {code: '503', when: …}}` adds to the interface's `errors` in `ERROR_KEYS` order (`when` before `code`); with `operationId: 'submit-plan'` it adds to the operation's.
  - `examples are written from the text the user typed` — `addExample {interfaceId: 'enrollment-api', operationId: 'submit-plan', inputText: '{student_id: "905123456", term: 2027-spring, section_ids: ["187204"]}', outputText: '{status: refused, units_enrolled: 4, decided_at: "2027-03-30T08:00:00-07:00", reason: section full}'}` writes both texts verbatim (`units_enrolled: 4` unquoted); `updateExample … outputText: '{status: refused,'` → `{error: 'example-syntax'}` with a line, no edits.
  - `renameType rewrites lists and inline references` — `EnrollmentOutcome` → `PlanOutcome` rewrites `output` and any `PlanOutcome[]` field type in the same interface only.
  - `changeInterfaceId rewrites uses and selectors` — `enrollment-api` → `enrollments`: `uses: enrollments.submit-plan`, a top-level `view: interface enrollment-api` becomes `view: interface enrollments`; shop `app` → `{error: 'shorthand'}`; to `tuition-charges` → `{error: 'id-taken'}`; to `billing` → `{error: 'id-taken'}` (an element id).
  - `renameOperation rewrites operation uses only` — `submit-plan` → `enroll`: `uses: enrollment-api.enroll`; a whole-interface `uses: enrollment-api` elsewhere stays; a scenario step's `uses` is rewritten too.
  - `changeElementId rewrites the shorthand interface's references and of-clauses` — shop variant with a relationship using `app.post-orders`, a custom view `{view: interfaces of app}`, a top-level `view: interface app`, and a view `{view: interface card-payments of payments}`: `app` → `shop-app` rewrites them to `uses: shop-app.post-orders`, `interfaces of shop-app`, `interface shop-app`; `payments` → `card-provider` rewrites `interface card-payments of card-provider`.
  - `deletes never edit inside a removed subtree` — (a) endpoint-style variant with `web → api: {description: makes calls to, technology: JSON/HTTPS, uses: coordinator.evaluate}` and `provides: ["evaluate(plan) -> EnrollmentOutcome"]` on `coordinator`: `deleteElement coordinator` keeps that collaborator with its description and technology and removes only `uses`; (b) `deleteElement billing` returns exactly one edit for the `billing-gateway → billing` collaborator (plus the Milestone 1 cascade edits elsewhere), and `applyEdits` does not throw; (c) `dependentsOf(model, 'api')` lists no `uses` entry whose path lies under a collaborator that the delete removes; (d) an operation on `api` with `realizes: [api-eligibility, policy-decide-1]` (id added) → `deleteElement policy` leaves `realizes: [api-eligibility]`.
  - `removeOperation and removeResponsibility cascade` — `removeOperation submit-plan` removes `web`'s `uses` key; `removeResponsibility` of `api-holds` leaves `realizes: [api-eligibility, api-billing]`.
  - `moving an element removes references that stop resolving` — add a container `worker` to `registration`; `moveElement {elementId: 'coordinator', newParentId: 'worker'}` lists `web`'s `uses: enrollment-api.submit-plan` (the Enrollment API's provider is no longer an ancestor of the target) and removes it in the same splice; `dependentsOf` for the move lists it before confirmation.
  - `setType refuses to delete a referenced type` → `{error: 'type-in-use'}` listing `submit-plan output`.
  - `setList refuses a full-form provides` — `setList {elementId: 'api', field: 'provides', items: ['x']}` → `{error: 'provides-full-form'}`, no edits; on the shop's `app` it rewrites the list.
  - Review Focus 3: `every Milestone 1 command leaves text outside its edits unchanged on the interface fixture` (the Milestone 1 byte-preservation runs repeated on `course-registration-interfaces.yml`).
  - Byte preservation and identity: `every interface command leaves text outside its edits unchanged` on the interface fixture, the shop fixture, the event fixture, a four-space copy, and a CRLF copy; `add then remove restores the original text` for interface, operation, error (both levels), restriction, example, type, field, value, vocabulary term (both levels), and `uses`.
  - `commands are refused while YAML errors exist` (one interface command).
- [ ] **Step 2–5:** run `node --test js/ArchUML/tests/c4/interfaces-edit.test.js` → FAIL, implement with the Milestone 1 splice primitives (`setEntry`, `deleteEntry`, `appendItem`, `renameKey`, `replaceValue`) and the canonical orders from Task 1, run → PASS, checkpoint.

---

### Task 9: `c4-describe.js` and `c4-uml.js` — interface descriptions and component text

**Files:** Modify `js/ArchUML/c4/c4-describe.js`, `js/ArchUML/c4/c4-uml.js`; Test `js/ArchUML/tests/c4/interfaces-describe.test.js`

**Interfaces:** `describe(viewModel, { panels })` for `uml-component` and `interface-card` views and annotated C4 and dynamic views (spec §6.6 "Accessible text"); `toUml(viewModel)` returns `{ type: 'component', text, ids }` for `uml-component` views (spec §6.6 rules: `layout vertical` or `layout horizontal` always; `e`/`p`/`r` numbering in view order; the C4 type line as `<<keyword>>`; one provide port per assembly; names escaped as specified; connector labels with newlines folded and nothing else changed).

- [ ] **Step 1: Write the failing tests**
  - `the interfaces view brief counts provided and required interfaces` — `'Interface view of Registration API: provides 1 interface, requires 1 interface, 2 connected elements.'`; items include `'Registration API provides Enrollment API, used by Planner Web App (POST /v1/enrollments).'`, `'Registration API requires Tuition Charges from Billing System (send ChargeRequested to the queue billing.charges).'`, and the legend sentence of spec §6.6; `interfaces of coordinator` includes the delegated note.
  - `the card description has the syntactic, semantic, data-type, vocabulary, and used-by sections` — brief `'Interface description of Enrollment API (REST interface, JSON/HTTPS, version 1), provided by Registration API: 1 operation, 2 types, 4 errors.'`; headings deepEqual `['Syntactic view', 'Semantic view', 'Data types', 'Shared vocabulary', 'Used by']`; items include `'submit-plan: POST /v1/enrollments. Input: EnrollmentRequest. Output: EnrollmentOutcome.'`, `'units_enrolled: number; unit: quarter units; meaning: total units the student holds in the term after this attempt.'`, `'status: string; one of enrolled (the student now holds a seat in every section of the plan), refused (the student holds no new seat; reason says why); meaning: whether the plan was accepted.'`, `'section_ids: string[]; constraints: 1 to 8 items, no duplicates; format: six-digit section ids; meaning: the sections the student wants to take together.'`, `'reason: string, optional; meaning: the reason for a refusal in words a student understands.'`, an item starting `'All operations: Usage restrictions: Only the Planner Web App may call it'`, and a semantic item starting `'submit-plan: POST /v1/enrollments. Purpose: When a client submits'`; the example item contains `units_enrolled: 8` (unquoted).
  - `the syntax-only panel leaves out meanings and absences` — `describe(card, {panels: 'syntax'})` has headings `['Syntactic view', 'Data types', 'Used by']`, the `units_enrolled` item equals `'units_enrolled: number.'`, and no item contains `not stated`.
  - `absences are stated neutrally without naming rules` — shop `refund`: items `'Purpose: not stated.'` and `'Errors: none stated.'`; shorthand card: `'Semantic view: not described yet.'`; no item contains `interface/`.
  - `annotated views mention interfaces and plain views do not` — `containers of registration with interfaces`: the `Registration API` element item contains `'Provides Enrollment API.'`; the relationship item for `web→api` contains `'via Enrollment API'`; in `containers of registration` no item contains `'via '` and the brief equals the Milestone 1 brief exactly; `dynamic enroll with interfaces` has a message item containing `(POST /v1/enrollments)`.
  - `component text matches the spec` — `toUml(projectView(model, 'interfaces of api'))` has `text` equal to the spec §6.6 block exactly and `ids` deepEqual `{e1: 'web', e2: 'api', e3: 'billing', p1: 'enrollment-api', r1: 'enrollment-api', r2: 'tuition-charges', p2: 'tuition-charges'}`.
  - `each consumer gets its own ball` — add `mobile` (a `mobile_app` container) with `api: {description: submits plans to, technology: JSON/HTTPS, uses: enrollment-api.submit-plan}`: the text has two `provide "Enrollment API" as p…` lines on the API's component and two assemblies, each from a different provide port.
  - `offered-through and delegated marks stay out of port names` — endpoint fixture, `interfaces of api`: the port line is `provide "Enrollment endpoint" as p1`, and no line contains `offered through`.
  - Review Focus 4: `generated component text cannot inject statements` — interface name `Evil" } --> x\n@enduml`, element names `<script>` and `Seat {Gateway}`, technology `a >> b <<c`, syntax line `a --> b }`: every component line matches `^component "[^"{}\n]*" as e\d+ <<[^<>{}\n"]*>> \{$`, every port line matches `^  (provide|require) "[^"{}\n]*" as [pr]\d+$`, every connector line matches `^[p]\d+ --> r\d+( : [^\n]*)?$`, the text has exactly one `@startuml` and one `@enduml`, and the connector label is `a --> b }` (only newlines folded; Appendix A Task 11 parses it with the bundle).
  - `REST path templates keep their braces in connector labels` — shop variant where `payments` uses `app.get-readers-id`: the connector line ends with `: GET /readers/{id}`.
  - `the direction is always emitted` — the plain view's second line is `layout vertical`; `{view: interfaces of api, direction: right}` → `layout horizontal`.
- [ ] **Step 2–5:** run `node --test js/ArchUML/tests/c4/interfaces-describe.test.js` → FAIL, implement, run → PASS, checkpoint.

---

### Task 10: Facade, CLI, JSON Schema, and performance

**Files:** Modify `js/ArchUML/c4/c4-core.js`, `js/ArchUML/c4/cli.js`, `js/ArchUML/c4/c4-schema.js` (`toJsonSchema()`), `js/ArchUML/c4/schema/1/design.schema.json` (regenerated), `js/ArchUML/tests/c4/core.test.js` (version assertion `'1.0.0'` → `'1.1.0'`, the change Task 0 lists); Tests `js/ArchUML/tests/c4/interfaces-core.test.js`, `js/ArchUML/tests/c4/interfaces-cli.test.js`

**Interfaces (added to `ArchUMLC4`):**

```js
ArchUMLC4.version = '1.1.0';
ArchUMLC4.listViews(design, { interfaces })            // option added
ArchUMLC4.interfacesOf(design, elementId) → { provided: [{ interfaceId, name, declaredOnId, declaredOnName, delegatedFromId, delegatedFromName }],
                                              required: [{ interfaceId, name, providerId }] }
ArchUMLC4.usableInterfaces(design, { sourceId, targetId }) → [{ interfaceId, name, providerId, providerName,
    relation /* 'target' | 'entered' | 'inside-target' | 'emitted' | 'channel' | 'broker-peer' */,
    operations: [{ id, syntax, realizes }] }]          // spec §4.11 rule, document order; in-process interfaces of components omitted for a source in another container
ArchUMLC4.interfaceDependentsOf(design, interfaceId) → [{ kind, path, label }]
ArchUMLC4.describe(viewModel, { panels })              // option added
```

CLI: `views --interfaces`; `uml --view "interfaces of <id>"` prints component text; `describe --view "interface <id>" [--panels syntax]` prints the card description.

- [ ] **Step 1: Write the failing tests**
  - `usableInterfaces offers exactly the interfaces J7 allows, in document order` — `{sourceId: 'web', targetId: 'coordinator'}` → `[{interfaceId: 'enrollment-api', …, relation: 'entered'}]`; `{sourceId: 'seats', targetId: 'db'}` → `[]`; `{sourceId: 'billing-gateway', targetId: 'billing'}` → `tuition-charges` with `relation: 'target'` and operations `[{id: 'charge-tuition', syntax: 'send ChargeRequested to the queue billing.charges', realizes: []}]`; endpoint fixture `{web, api}` → `enrollment-endpoint` with `relation: 'inside-target'`; events fixture `{orders, analytics}` → `order-events` `emitted`, `{orders, order-topic}` → `channel`, `{shipping, order-topic}` → `broker-peer`.
  - `usableInterfaces leaves out in-process interfaces across containers` — with `provides: ["decide(student, section) -> Decision"]` on `policy`: `{sourceId: 'web', targetId: 'api'}` → ids `['enrollment-api']`; `{sourceId: 'coordinator', targetId: 'policy'}` → ids `['policy']`.
  - `interfacesOf returns the provided and required sets` — `api` → provided `['enrollment-api']`, required `['tuition-charges']`; `coordinator` → provided `enrollment-api` with `delegatedFromId: 'api'`.
  - `every manifest file still loads in order and publishes version 1.1.0` (Milestone 1 load-order test with the updated assertion).
  - `the committed JSON Schema equals the generated one`; corpus: accepted — shorthand list, empty list, full form, operation, field, error, and value shorthands, a values map, constraints as a string and a list, interface-level restrictions and errors, a document format, top-level `vocabulary`, `required: false`, `required: "false"`, `version: 1.10`, `code: 401`, `uses` as a string and as a list, a step `uses`, `annotations: [interfaces]` on a dynamic custom view, fields named `required` and `external`, `str` as a field type; rejected — mixed `provides` list, `stlye`, `style: restful`, a field map with an unknown key (the comma typo `{type: string, meaning: a, b}`), `uses` on a deployment-node collaborator, an example with no keys, `include` on an `interfaces of` custom view. `c4-schema.js` and the JSON Schema agree on every corpus document.
  - CLI: `views --interfaces` on the second fixture prints 15 lines (the seven plus the eight of Task 4); `uml --view "interfaces of api"` prints text starting `@startuml\nlayout vertical\ncomponent "Planner Web App" as e1 <<Container: TypeScript, React>> {`; `describe --view "interface enrollment-api"` prints the Task 9 brief; `check` on the second fixture exits 0; `check --strict` on the shop fixture exits 2 (warnings); `check` on the booking fixture exits 0 (no errors).
  - Performance (Milestone 1 Review Focus 5 extended): `a generated 300-element model with 100 interfaces and 300 operations loads, checks, and projects every listed view, interface views included, within 3 seconds`.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement; regenerate the schema with `node js/ArchUML/c4/cli.js schema > js/ArchUML/c4/schema/1/design.schema.json`. **Step 4:** `npm run test:unit` → PASS (all suites, Milestone 1 included). **Step 5:** Checkpoint: `git status --short` and `git -C js/ArchUML status --short` list only the files named in this plan; `git -C js/ArchUML diff --stat -- tests/c4/fixtures/course-registration.yml` is empty; report the Task 0 audit, that the submodule changed, and that the merged spec (§4.2) must be in the user's commit together with the second fixture.

---

## Tasks in other plans

The interface work outside the core lives in the plans of the milestones that own those files:

- Rendering (Milestone 2): Tasks 9–12 of `docs/superpowers/plans/2026-11-08-c4-rendering.md` (interface annotations, the HTML card, the bundle's component-diagram fixes, the delegated interfaces view). They start once this plan is green.
- Editor (Milestone 3): the amendment to Task 8 and Tasks 13–16 of `docs/superpowers/plans/2026-11-08-c4-editor.md` (Interfaces section and form, Uses picker, interface views, review prompts and frames).
- Chapter (Milestone 4): the interface changes in `docs/superpowers/plans/2026-11-08-c4-chapter.md` (`## Interface Descriptions`, quiz item 13, three flashcards, the interoperability link).
- Tutorial (Milestone 5): the change-impact addition and the follow-up tutorial "Describe an interface" in `docs/superpowers/plans/2026-11-08-c4-tutorial.md` (decision D10; its step 2 seed is this plan's `fixtures/interfaces-step2-seed.yml`).
