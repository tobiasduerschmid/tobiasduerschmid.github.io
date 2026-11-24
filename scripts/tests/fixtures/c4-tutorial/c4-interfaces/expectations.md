# Interface tutorial: expected test results

The oracle for the "Describe an interface" part of `scripts/tests/c4-tutorial-content.test.js`. For each graded step (2 and 3) it lists every test with its `tests[].c4` predicate and role, then the result on the seed, the solution, and every model in `alternatives/step-N/`, with the core's message and the hints whose conditions hold when the test fails. Steps 1 and 4 are quiz-only.

How the results were obtained: the real core (`js/ArchUML/c4/c4-core.js` with interface support) evaluated every predicate with `ArchUMLC4.query.evaluate`, with the step's `c4.checks` configuration (the step's keys over the tutorial's, merged by sub-key) as `checksConfig` and the step's authored starter as `seedModel`, as the content test does. Each alternative states its intended results on its second line (`# expect: …`; tests not listed pass), and every row below agrees with it. Every failed test shows a hint, except a test that fails because the id it names was deleted, and every conditional hint holds on at least one model on which its test fails. A later disagreement between the core and this table is a core bug or a content defect to resolve, never a reason to edit this table silently.

Conventions: `same_as_seed` compares with the step's authored starter file. The tutorial sets `checks.honorFileIgnores: false`, so a `checks.ignore` entry in `design.yml` cannot pass a `checks:` test. "E/W" counts errors and warnings under default options. A guard passes on the seed by design and must fail on the wrong model that breaks the part it protects. Two step 2 wrong models pass every test on purpose (`wrong-26-keyword-stuffed-unit`, `wrong-27-vague-purpose`): they are the evidence for the step's "what the checks cannot judge" sentence. Five step 2 wrong models are marked WRONG BUT UNREACHABLE (`wrong-06`, `wrong-07`, `wrong-25`, `wrong-28`, `wrong-29`): they change a part that the step's `locked_fields` protect, so the runtime reverts the edit (spec §11); they stay as evidence that the guard T11 and the deleted-target failures do not depend on the locks.

## Step 2: The Semantic View

| Test | Description | Predicate | Role |
|---|---|---|---|
| T1 | The operation says what it is for and what it changes, with one example | `{ exists: { operation: { of: enrollment-api, id: submit-plan, purpose: present, side_effects: present, examples_at_least: 1 } } }` | targeted (fails on the seed) |
| T2 | Clients learn who may call it and what can go wrong | `{ exists: { operation: { of: enrollment-api, id: submit-plan, restrictions: present, errors_at_least: 2 } } }` | targeted (fails on the seed) |
| T3 | Every request field says what it means | `{ absent: { operation: { of: enrollment-api, id: submit-plan, input_has_field: { meaning: absent } } } }` | targeted (fails on the seed) |
| T4 | Every outcome field says what it means | `{ absent: { operation: { of: enrollment-api, id: submit-plan, output_has_field: { meaning: absent } } } }` | targeted (fails on the seed) |
| T5 | Each status value says what it means for the student | `{ exists: { operation: { of: enrollment-api, id: submit-plan, output_has_field: { name_any: [ status ], values: meaningful } } } }` | targeted (fails on the seed) |
| T6 | The number of units says which kind of unit it counts | `{ exists: { operation: { of: enrollment-api, id: submit-plan, output_has_field: { name_any: [ units_enrolled ], type: number, unit_any: [ quarter ] } } } }` | targeted (fails on the seed) |
| T7 | The term says how it is written | `{ exists: { operation: { of: enrollment-api, id: submit-plan, input_has_field: { name_any: [ term ], format: present } } } }` | targeted (fails on the seed) |
| T8 | The operation is linked to the API responsibilities a client relies on | `{ exists: { operation: { of: enrollment-api, id: submit-plan, realizes: [ api-eligibility, api-holds ] } } }` | targeted (fails on the seed) |
| T9 | The description passes the interface consistency checks | `{ checks: { max_warnings: 0, rules: [ interface/no-unit, interface/no-format, interface/no-purpose, interface/example-mismatch, interface/realizes-internal, interface/undefined-type ] } }` | targeted (fails on the seed) |
| T10 | The web app names the operation it calls | `{ exists: { relationship: { from: web, to: api, uses: enrollment-api.submit-plan } } }` | targeted (fails on the seed) |
| T11 | The given syntactic view is unchanged | `{ same_as_seed: { interface: { id: enrollment-api }, part: syntax } }` | guard (passes on the seed) |
| T12 | The plan check says what it is for, what it changes, and which decision it makes | `{ exists: { operation: { of: enrollment-api, id: check-plan, purpose: present, side_effects: present, realizes: api-eligibility } } }` | targeted (fails on the seed) |
| T13 | Every field of the plan check’s outcome says what it means | `{ absent: { operation: { of: enrollment-api, id: check-plan, output_has_field: { meaning: absent } } } }` | targeted (fails on the seed) |
| T14 | The plan check promises no seat and no charge | `{ absent: { operation: { of: enrollment-api, id: check-plan, realizes_any: [ api-holds, api-billing ] } } }` | guard (passes on the seed) |
| T15 | The web app names the plan check it calls | `{ exists: { relationship: { from: web, to: api, uses: enrollment-api.check-plan } } }` | targeted (fails on the seed) |

Overview (P = pass, F = fail):

| Model | E/W | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 | T11 | T12 | T13 | T14 | T15 | Intent |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `seed` | 0/5 | F | F | F | F | F | F | F | F | F | F | P | F | F | P | F | Starter file: fails the tests the step targets; the guard passes. |
| `solution` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | Reference solution: passes every test with 0 errors and 0 warnings. |
| `correct-1-quarter-credit-units` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | the unit spelled "quarter credit units" and meanings reworded. |
| `correct-2-renamed-errors` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | errors renamed forbidden and no-such-section. |
| `correct-3-errors-on-operation` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | restrictions and errors written only on the operations, none under All operations. |
| `correct-4-summary-at-container-level` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | the web app declares a container-level relationship to the Registration API that names the operation, beside the component-level detail. |
| `correct-5-realizes-refining-components` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | realizes names the component responsibilities that refine the API's decision and holds (J12 coverage). |
| `correct-6-realizes-without-billing` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | realizes lists the decision and the holds only. |
| `correct-7-refusal-example-other-formats` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | a refusal as the example, and formats worded differently. |
| `correct-8-plan-check-other-words` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | the plan check described in other words, linked through the policy's refining DECIDE, and its side effect phrased as a guarantee. |
| `wrong-01-semantics-on-billing` | 0/5 | F | F | F | F | F | F | F | F | F | F | P | F | F | P | F | the semantic view written on Billing's interface; the Enrollment API keeps only its syntax. |
| `wrong-02-unit-on-section-ids-only` | 0/1 | P | P | P | P | P | F | P | P | F | P | P | P | P | P | P | a unit on the list of sections, none on units_enrolled. |
| `wrong-03-unit-units` | 0/0 | P | P | P | P | P | F | P | P | P | P | P | P | P | P | P | unit "units", which names no kind of credit unit. |
| `wrong-04-unit-only-in-meaning` | 0/1 | P | P | P | P | P | F | P | P | F | P | P | P | P | P | P | the unit written only inside the meaning. |
| `wrong-05-values-to-escape-unit` | 0/0 | P | P | P | P | P | F | P | P | P | P | F | P | P | P | P | allowed values with meanings added to units_enrolled instead of a unit (silences the unit rule). |
| `wrong-06-units-retyped-text` | 0/0 | P | P | P | P | P | F | P | P | P | P | F | P | P | P | P | WRONG BUT UNREACHABLE (units_enrolled retyped as text): the locked_fields path enrollment-api.types.*.fields.*.type binds the YAML surface too (spec §11), so the runtime reverts this edit; kept as evidence that guard T11 catches it without the locks. |
| `wrong-07-decided-at-retyped-text` | 0/0 | P | P | P | P | P | P | P | P | P | P | F | P | P | P | P | WRONG BUT UNREACHABLE (decided_at retyped as text, which silences the format rule even without a format): the locked_fields path enrollment-api.types.*.fields.*.type binds the YAML surface too (spec §11), so the runtime reverts this edit; kept as evidence that guard T11 catches it without the locks. |
| `wrong-08-whole-interface-use` | 0/0 | P | P | P | P | P | P | P | P | P | F | P | P | P | P | F | the web app names the whole Enrollment API, not the operations. |
| `wrong-09-no-uses` | 0/0 | P | P | P | P | P | P | P | P | P | F | P | P | P | P | F | the web app names nothing it uses. |
| `wrong-10-realizes-eligibility-only` | 0/0 | P | P | P | P | P | P | P | F | P | P | P | P | P | P | P | realizes the decision only. |
| `wrong-11-realizes-holds-only` | 0/0 | P | P | P | P | P | P | P | F | P | P | P | P | P | P | P | realizes the seat holds only. |
| `wrong-12-realizes-coordinator-sequencing` | 0/1 | P | P | P | P | P | P | P | F | F | P | P | P | P | P | P | realizes the coordinator's sequencing instead of the API's responsibilities. |
| `wrong-13-every-box-ticked` | 0/3 | P | P | P | P | P | P | P | P | F | P | P | P | P | P | P | every Realizes box ticked, private obligations of the components included. |
| `wrong-14-request-meaning-missing` | 0/0 | P | P | F | P | P | P | P | P | P | P | P | P | P | P | P | section_ids has no meaning. |
| `wrong-15-outcome-meaning-missing` | 0/0 | P | P | P | F | P | P | P | P | P | P | P | P | P | P | P | the optional reason has no meaning. |
| `wrong-16-status-values-without-meanings` | 0/0 | P | P | P | P | F | P | P | P | P | P | P | P | P | P | P | status keeps its meaning, but its values have none. |
| `wrong-17-no-example` | 0/0 | F | P | P | P | P | P | P | P | P | P | P | P | P | P | P | no example. |
| `wrong-18-example-wrong-key` | 0/1 | P | P | P | P | P | P | P | P | F | P | P | P | P | P | P | the example's outcome uses a key that is not a field. |
| `wrong-19-example-value-outside-list` | 0/1 | P | P | P | P | P | P | P | P | F | P | P | P | P | P | P | the example's status is not an allowed value. |
| `wrong-20-term-without-format` | 0/0 | P | P | P | P | P | P | F | P | P | P | P | P | P | P | P | term has a meaning but no format. |
| `wrong-21-one-error-only` | 0/1 | P | F | P | P | P | P | P | P | P | P | P | P | P | P | P | one error in all: none under All operations, one on the operation. |
| `wrong-22-no-restrictions` | 0/0 | P | F | P | P | P | P | P | P | P | P | P | P | P | P | P | no usage restrictions anywhere. |
| `wrong-23-operation-added` | 0/1 | P | P | P | P | P | P | P | P | F | P | F | P | P | P | P | an operation added to the given syntactic view. |
| `wrong-24-decided-at-without-format` | 0/1 | P | P | P | P | P | P | P | P | F | P | P | P | P | P | P | decided_at has a meaning but no format. |
| `wrong-25-deleted-interface` | 0/0 | F | F | F | F | F | F | F | F | P | F | F | F | F | F | F | WRONG BUT UNREACHABLE (deleted target: the Enrollment API deleted, so every reference to it fails to resolve): every locked_fields path under enrollment-api binds the YAML surface too (spec §11), so the runtime reverts this edit; kept as the deleted-target evidence spec §8 asks for (no test passes vacuously). |
| `wrong-26-keyword-stuffed-unit` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | the unit names the wrong kind of credit but contains the word the check looks for; it passes every test (what the checks cannot judge). |
| `wrong-27-vague-purpose` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | a purpose that says nothing a client can use; it passes every test (what the checks cannot judge). |
| `wrong-28-reason-made-required` | 0/1 | P | P | P | P | P | P | P | P | F | P | F | P | P | P | P | WRONG BUT UNREACHABLE (reason made required; the example outcome then lacks it): the locked_fields path enrollment-api.types.*.fields.*.required binds the YAML surface too (spec §11), so the runtime reverts this edit; kept as evidence that guard T11 catches it without the locks. |
| `wrong-29-constraints-removed` | 0/0 | P | P | P | P | P | P | P | P | P | P | F | P | P | P | P | WRONG BUT UNREACHABLE (the constraints of section_ids removed): the locked_fields path enrollment-api.types.*.fields.*.constraints binds the YAML surface too (spec §11), so the runtime reverts this edit; kept as evidence that guard T11 catches it without the locks. |
| `wrong-30-unit-without-meaning` | 0/0 | P | P | P | F | P | P | P | P | P | P | P | P | P | P | P | units_enrolled has a unit but no meaning. |
| `wrong-31-no-side-effects` | 0/0 | F | P | P | P | P | P | P | P | P | P | P | P | P | P | P | a purpose, but no side effects for either outcome. |
| `wrong-32-status-meaning-missing` | 0/0 | P | P | P | F | P | P | P | P | P | P | P | P | P | P | P | each status value has a meaning, but the field as a whole has none. |
| `wrong-33-plan-check-undescribed` | 0/2 | P | P | P | P | P | P | P | P | F | P | P | F | F | P | F | submit-plan fully described; the plan check left as given, syntax only, and not used. |
| `wrong-34-plan-check-links-copied` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | P | P | F | P | the plan check copies submit-plan's links: it claims to hold seats and request a charge. |
| `wrong-35-plan-check-no-side-effects` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | F | P | P | P | the plan check has a purpose but says nothing about what it changes. |
| `wrong-36-plan-check-not-linked` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | F | P | P | P | the plan check has a purpose and side effects, but no responsibility. |
| `wrong-37-plan-check-no-purpose` | 0/1 | P | P | P | P | P | P | P | P | F | P | P | F | P | P | P | the plan check says what it changes, but not what it is for. |
| `wrong-38-plan-check-field-without-meaning` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | P | F | P | P | eligible has no meaning. |
| `wrong-39-plan-check-units-without-unit` | 0/1 | P | P | P | P | P | P | P | P | F | P | P | P | P | P | P | units_planned has a meaning but no unit. |
| `wrong-40-plan-check-not-used` | 0/0 | P | P | P | P | P | P | P | P | P | P | P | P | P | P | F | the web app names submit-plan only. |

Failed tests with reasons and hints (every test not listed for a model passes):

| Model | Test | Reason | Hints shown |
|---|---|---|---|
| `seed` | T1 | No operation {"of":"enrollment-api","id":"submit-plan","purpose":"present","side_effects":"present","examples_at_least":1} yet | Purpose, side effects, and an example |
| `seed` | T2 | No operation {"of":"enrollment-api","id":"submit-plan","restrictions":"present","errors_at_least":2} yet | Who may call, and how often; What else can go wrong |
| `seed` | T3 | Found enrollment-api.submit-plan matching operation {"of":"enrollment-api","id":"submit-plan","input_has_field":{"meaning":"absent"}}, but there should be none | Fields still without a meaning |
| `seed` | T4 | Found enrollment-api.submit-plan matching operation {"of":"enrollment-api","id":"submit-plan","output_has_field":{"meaning":"absent"}}, but there should be none | What the outcome tells the client |
| `seed` | T5 | No operation {"of":"enrollment-api","id":"submit-plan","output_has_field":{"name_any":["status"],"values":"meaningful"}} yet | What each value promises |
| `seed` | T6 | No operation {"of":"enrollment-api","id":"submit-plan","output_has_field":{"name_any":["units_enrolled"],"type":"number","unit_any":["quarter"]}} yet | Numbers in the outcome |
| `seed` | T7 | No operation {"of":"enrollment-api","id":"submit-plan","input_has_field":{"name_any":["term"],"format":"present"}} yet | How the term is written |
| `seed` | T8 | No operation {"of":"enrollment-api","id":"submit-plan","realizes":["api-eligibility","api-holds"]} yet | Obligations a client asks for |
| `seed` | T9 | The checks report 5 warnings (at most 0 allowed): interface/no-purpose on api: submit-plan has no Purpose. A client cannot tell whether the operation fits its need.; interface/no-purpose on api: check-plan has no Purpose. A client cannot tell whether the operation fits its need.; interface/no-unit on api: EnrollmentOutcome.units_enrolled is a number with no Unit. Two teams can read the same number differently. | Read the Problems panel |
| `seed` | T10 | No relationship {"from":"web","to":"api","uses":"enrollment-api.submit-plan"} yet | The call the web app makes |
| `seed` | T12 | No operation {"of":"enrollment-api","id":"check-plan","purpose":"present","side_effects":"present","realizes":"api-eligibility"} yet | What a check is for |
| `seed` | T13 | Found enrollment-api.check-plan matching operation {"of":"enrollment-api","id":"check-plan","output_has_field":{"meaning":"absent"}}, but there should be none | Read the check’s outcome as a stranger |
| `seed` | T15 | No relationship {"from":"web","to":"api","uses":"enrollment-api.check-plan"} yet | Both calls the web app makes |
| `wrong-01-semantics-on-billing` | T1 | No operation {"of":"enrollment-api","id":"submit-plan","purpose":"present","side_effects":"present","examples_at_least":1} yet | Purpose, side effects, and an example |
| `wrong-01-semantics-on-billing` | T2 | No operation {"of":"enrollment-api","id":"submit-plan","restrictions":"present","errors_at_least":2} yet | Who may call, and how often; What else can go wrong |
| `wrong-01-semantics-on-billing` | T3 | Found enrollment-api.submit-plan matching operation {"of":"enrollment-api","id":"submit-plan","input_has_field":{"meaning":"absent"}}, but there should be none | Fields still without a meaning |
| `wrong-01-semantics-on-billing` | T4 | Found enrollment-api.submit-plan matching operation {"of":"enrollment-api","id":"submit-plan","output_has_field":{"meaning":"absent"}}, but there should be none | What the outcome tells the client |
| `wrong-01-semantics-on-billing` | T5 | No operation {"of":"enrollment-api","id":"submit-plan","output_has_field":{"name_any":["status"],"values":"meaningful"}} yet | What each value promises |
| `wrong-01-semantics-on-billing` | T6 | No operation {"of":"enrollment-api","id":"submit-plan","output_has_field":{"name_any":["units_enrolled"],"type":"number","unit_any":["quarter"]}} yet | Numbers in the outcome |
| `wrong-01-semantics-on-billing` | T7 | No operation {"of":"enrollment-api","id":"submit-plan","input_has_field":{"name_any":["term"],"format":"present"}} yet | How the term is written |
| `wrong-01-semantics-on-billing` | T8 | No operation {"of":"enrollment-api","id":"submit-plan","realizes":["api-eligibility","api-holds"]} yet | Obligations a client asks for |
| `wrong-01-semantics-on-billing` | T9 | The checks report 5 warnings (at most 0 allowed): interface/no-purpose on api: submit-plan has no Purpose. A client cannot tell whether the operation fits its need.; interface/no-purpose on api: check-plan has no Purpose. A client cannot tell whether the operation fits its need.; interface/no-unit on api: EnrollmentOutcome.units_enrolled is a number with no Unit. Two teams can read the same number differently. | Read the Problems panel |
| `wrong-01-semantics-on-billing` | T10 | No relationship {"from":"web","to":"api","uses":"enrollment-api.submit-plan"} yet | The call the web app makes |
| `wrong-01-semantics-on-billing` | T12 | No operation {"of":"enrollment-api","id":"check-plan","purpose":"present","side_effects":"present","realizes":"api-eligibility"} yet | What a check is for |
| `wrong-01-semantics-on-billing` | T13 | Found enrollment-api.check-plan matching operation {"of":"enrollment-api","id":"check-plan","output_has_field":{"meaning":"absent"}}, but there should be none | Read the check’s outcome as a stranger |
| `wrong-01-semantics-on-billing` | T15 | No relationship {"from":"web","to":"api","uses":"enrollment-api.check-plan"} yet | Both calls the web app makes |
| `wrong-02-unit-on-section-ids-only` | T6 | No operation {"of":"enrollment-api","id":"submit-plan","output_has_field":{"name_any":["units_enrolled"],"type":"number","unit_any":["quarter"]}} yet | Numbers in the outcome; Units belong in Unit |
| `wrong-02-unit-on-section-ids-only` | T9 | The checks report 1 warning (at most 0 allowed): interface/no-unit on api: EnrollmentOutcome.units_enrolled is a number with no Unit. Two teams can read the same number differently. | Read the Problems panel; Check the example against the types |
| `wrong-03-unit-units` | T6 | No operation {"of":"enrollment-api","id":"submit-plan","output_has_field":{"name_any":["units_enrolled"],"type":"number","unit_any":["quarter"]}} yet | Numbers in the outcome; Which kind of unit |
| `wrong-04-unit-only-in-meaning` | T6 | No operation {"of":"enrollment-api","id":"submit-plan","output_has_field":{"name_any":["units_enrolled"],"type":"number","unit_any":["quarter"]}} yet | Numbers in the outcome; Units belong in Unit |
| `wrong-04-unit-only-in-meaning` | T9 | The checks report 1 warning (at most 0 allowed): interface/no-unit on api: EnrollmentOutcome.units_enrolled is a number with no Unit. Two teams can read the same number differently. | Read the Problems panel; Check the example against the types |
| `wrong-05-values-to-escape-unit` | T6 | No operation {"of":"enrollment-api","id":"submit-plan","output_has_field":{"name_any":["units_enrolled"],"type":"number","unit_any":["quarter"]}} yet | Numbers in the outcome; Units belong in Unit |
| `wrong-05-values-to-escape-unit` | T11 | The syntax of enrollment-api was changed; it should stay as it was | The given syntax |
| `wrong-06-units-retyped-text` | T6 | No operation {"of":"enrollment-api","id":"submit-plan","output_has_field":{"name_any":["units_enrolled"],"type":"number","unit_any":["quarter"]}} yet | Numbers in the outcome |
| `wrong-06-units-retyped-text` | T11 | The syntax of enrollment-api was changed; it should stay as it was | The given syntax |
| `wrong-07-decided-at-retyped-text` | T11 | The syntax of enrollment-api was changed; it should stay as it was | The given syntax |
| `wrong-08-whole-interface-use` | T10 | No relationship {"from":"web","to":"api","uses":"enrollment-api.submit-plan"} yet | The call the web app makes; The whole interface or one operation; Which interface it enters through |
| `wrong-08-whole-interface-use` | T15 | No relationship {"from":"web","to":"api","uses":"enrollment-api.check-plan"} yet | Both calls the web app makes |
| `wrong-09-no-uses` | T10 | No relationship {"from":"web","to":"api","uses":"enrollment-api.submit-plan"} yet | The call the web app makes |
| `wrong-09-no-uses` | T15 | No relationship {"from":"web","to":"api","uses":"enrollment-api.check-plan"} yet | Both calls the web app makes |
| `wrong-10-realizes-eligibility-only` | T8 | No operation {"of":"enrollment-api","id":"submit-plan","realizes":["api-eligibility","api-holds"]} yet | Obligations a client asks for; Compare the links with the outcomes; After the decision |
| `wrong-11-realizes-holds-only` | T8 | No operation {"of":"enrollment-api","id":"submit-plan","realizes":["api-eligibility","api-holds"]} yet | Obligations a client asks for; Compare the links with the outcomes; Before a seat is held |
| `wrong-12-realizes-coordinator-sequencing` | T8 | No operation {"of":"enrollment-api","id":"submit-plan","realizes":["api-eligibility","api-holds"]} yet | Obligations a client asks for; Compare the links with the outcomes; A link to the inside |
| `wrong-12-realizes-coordinator-sequencing` | T9 | The checks report 1 warning (at most 0 allowed): interface/realizes-internal on api: submit-plan is linked to 'sequence one enrollment attempt', an obligation private to Registration Coordinator. Clients rely on what Registration API promises, not on how its parts divide the work. | Read the Problems panel; Check the example against the types; A link a client cannot notice |
| `wrong-13-every-box-ticked` | T9 | The checks report 3 warnings (at most 0 allowed): interface/realizes-internal on api: submit-plan is linked to 'sequence one enrollment attempt', an obligation private to Registration Coordinator. Clients rely on what Registration API promises, not on how its parts divide the work.; interface/realizes-internal on api: submit-plan is linked to 'which step of the attempt runs next', an obligation private to Registration Coordinator. Clients rely on what Registration API promises, not on how its parts divide the work.; interface/realizes-internal on api: submit-plan is linked to 'which seats are held for each attempt', an obligation private to Seat Gateway. Clients rely on what Registration API promises, not on how its parts divide the work. | Read the Problems panel; Check the example against the types; A link a client cannot notice |
| `wrong-14-request-meaning-missing` | T3 | Found enrollment-api.submit-plan matching operation {"of":"enrollment-api","id":"submit-plan","input_has_field":{"meaning":"absent"}}, but there should be none | Fields still without a meaning; A list needs a meaning too |
| `wrong-15-outcome-meaning-missing` | T4 | Found enrollment-api.submit-plan matching operation {"of":"enrollment-api","id":"submit-plan","output_has_field":{"meaning":"absent"}}, but there should be none | What the outcome tells the client; Fields still without a meaning |
| `wrong-16-status-values-without-meanings` | T5 | No operation {"of":"enrollment-api","id":"submit-plan","output_has_field":{"name_any":["status"],"values":"meaningful"}} yet | What each value promises; One meaning per value |
| `wrong-17-no-example` | T1 | No operation {"of":"enrollment-api","id":"submit-plan","purpose":"present","side_effects":"present","examples_at_least":1} yet | Purpose, side effects, and an example; One request a real client could send |
| `wrong-18-example-wrong-key` | T9 | The checks report 1 warning (at most 0 allowed): interface/example-mismatch on api: Example 1 of submit-plan does not match its types: units is not a field of EnrollmentOutcome; the required field units_enrolled is missing. An example that contradicts the syntax misleads every client that copies it. | Read the Problems panel; Check the example against the types |
| `wrong-19-example-value-outside-list` | T9 | The checks report 1 warning (at most 0 allowed): interface/example-mismatch on api: Example 1 of submit-plan does not match its types: status: accepted is not one of its values. An example that contradicts the syntax misleads every client that copies it. | Read the Problems panel; Check the example against the types |
| `wrong-20-term-without-format` | T7 | No operation {"of":"enrollment-api","id":"submit-plan","input_has_field":{"name_any":["term"],"format":"present"}} yet | How the term is written; From meaning to format |
| `wrong-21-one-error-only` | T2 | No operation {"of":"enrollment-api","id":"submit-plan","restrictions":"present","errors_at_least":2} yet | What else can go wrong |
| `wrong-22-no-restrictions` | T2 | No operation {"of":"enrollment-api","id":"submit-plan","restrictions":"present","errors_at_least":2} yet | Who may call, and how often; What else can go wrong |
| `wrong-23-operation-added` | T9 | The checks report 1 warning (at most 0 allowed): interface/no-purpose on api: cancel-plan has no Purpose. A client cannot tell whether the operation fits its need. | Read the Problems panel; Check the example against the types |
| `wrong-23-operation-added` | T11 | The syntax of enrollment-api was changed; it should stay as it was | The given syntax |
| `wrong-24-decided-at-without-format` | T9 | The checks report 1 warning (at most 0 allowed): interface/no-format on api: EnrollmentOutcome.decided_at is a date or time with no Format. Which comes first, day or month, and in which time zone? | Read the Problems panel; Check the example against the types |
| `wrong-25-deleted-interface` | T1 | unknown interface enrollment-api | Purpose, side effects, and an example |
| `wrong-25-deleted-interface` | T2 | unknown interface enrollment-api | What else can go wrong |
| `wrong-25-deleted-interface` | T3 | unknown interface enrollment-api | Fields still without a meaning |
| `wrong-25-deleted-interface` | T4 | unknown interface enrollment-api | What the outcome tells the client |
| `wrong-25-deleted-interface` | T5 | unknown interface enrollment-api | What each value promises |
| `wrong-25-deleted-interface` | T6 | unknown interface enrollment-api | Numbers in the outcome |
| `wrong-25-deleted-interface` | T7 | unknown interface enrollment-api | How the term is written |
| `wrong-25-deleted-interface` | T8 | unknown interface enrollment-api | Obligations a client asks for |
| `wrong-25-deleted-interface` | T10 | unknown interface enrollment-api | The call the web app makes |
| `wrong-25-deleted-interface` | T11 | enrollment-api was removed; it should stay as it was | The given syntax |
| `wrong-25-deleted-interface` | T12 | unknown interface enrollment-api | What a check is for |
| `wrong-25-deleted-interface` | T13 | unknown interface enrollment-api | Read the check’s outcome as a stranger |
| `wrong-25-deleted-interface` | T14 | unknown interface enrollment-api | What a check never does |
| `wrong-25-deleted-interface` | T15 | unknown interface enrollment-api | Both calls the web app makes |
| `wrong-28-reason-made-required` | T9 | The checks report 1 warning (at most 0 allowed): interface/example-mismatch on api: Example 1 of submit-plan does not match its types: the required field reason is missing. An example that contradicts the syntax misleads every client that copies it. | Read the Problems panel; Check the example against the types |
| `wrong-28-reason-made-required` | T11 | The syntax of enrollment-api was changed; it should stay as it was | The given syntax |
| `wrong-29-constraints-removed` | T11 | The syntax of enrollment-api was changed; it should stay as it was | The given syntax |
| `wrong-30-unit-without-meaning` | T4 | Found enrollment-api.submit-plan matching operation {"of":"enrollment-api","id":"submit-plan","output_has_field":{"meaning":"absent"}}, but there should be none | What the outcome tells the client; Fields still without a meaning |
| `wrong-31-no-side-effects` | T1 | No operation {"of":"enrollment-api","id":"submit-plan","purpose":"present","side_effects":"present","examples_at_least":1} yet | Purpose, side effects, and an example; What another system can notice |
| `wrong-32-status-meaning-missing` | T4 | Found enrollment-api.submit-plan matching operation {"of":"enrollment-api","id":"submit-plan","output_has_field":{"meaning":"absent"}}, but there should be none | What the outcome tells the client; Fields still without a meaning; A field with values |
| `wrong-33-plan-check-undescribed` | T9 | The checks report 2 warnings (at most 0 allowed): interface/no-purpose on api: check-plan has no Purpose. A client cannot tell whether the operation fits its need.; interface/no-unit on api: PlanCheck.units_planned is a number with no Unit. Two teams can read the same number differently. | Read the Problems panel; Check the example against the types |
| `wrong-33-plan-check-undescribed` | T12 | No operation {"of":"enrollment-api","id":"check-plan","purpose":"present","side_effects":"present","realizes":"api-eligibility"} yet | What a check is for |
| `wrong-33-plan-check-undescribed` | T13 | Found enrollment-api.check-plan matching operation {"of":"enrollment-api","id":"check-plan","output_has_field":{"meaning":"absent"}}, but there should be none | Read the check’s outcome as a stranger |
| `wrong-33-plan-check-undescribed` | T15 | No relationship {"from":"web","to":"api","uses":"enrollment-api.check-plan"} yet | Both calls the web app makes |
| `wrong-34-plan-check-links-copied` | T14 | Found enrollment-api.check-plan matching operation {"of":"enrollment-api","id":"check-plan","realizes_any":["api-holds","api-billing"]}, but there should be none | What a check never does |
| `wrong-35-plan-check-no-side-effects` | T12 | No operation {"of":"enrollment-api","id":"check-plan","purpose":"present","side_effects":"present","realizes":"api-eligibility"} yet | What a check is for; What a check changes |
| `wrong-36-plan-check-not-linked` | T12 | No operation {"of":"enrollment-api","id":"check-plan","purpose":"present","side_effects":"present","realizes":"api-eligibility"} yet | What a check is for; The obligation a check fulfills |
| `wrong-37-plan-check-no-purpose` | T9 | The checks report 1 warning (at most 0 allowed): interface/no-purpose on api: check-plan has no Purpose. A client cannot tell whether the operation fits its need. | Read the Problems panel; Check the example against the types |
| `wrong-37-plan-check-no-purpose` | T12 | No operation {"of":"enrollment-api","id":"check-plan","purpose":"present","side_effects":"present","realizes":"api-eligibility"} yet | What a check is for |
| `wrong-38-plan-check-field-without-meaning` | T13 | Found enrollment-api.check-plan matching operation {"of":"enrollment-api","id":"check-plan","output_has_field":{"meaning":"absent"}}, but there should be none | Read the check’s outcome as a stranger |
| `wrong-39-plan-check-units-without-unit` | T9 | The checks report 1 warning (at most 0 allowed): interface/no-unit on api: PlanCheck.units_planned is a number with no Unit. Two teams can read the same number differently. | Read the Problems panel; Check the example against the types |
| `wrong-40-plan-check-not-used` | T15 | No relationship {"from":"web","to":"api","uses":"enrollment-api.check-plan"} yet | Both calls the web app makes |

## Step 3: A Message Interface From a Brief

| Test | Description | Predicate | Role |
|---|---|---|---|
| T1 | Billing describes the interface this team relies on | `{ exists: { interface: { of: billing, has_operation: { purpose: present } } } }` | targeted (fails on the seed) |
| T2 | The message carries a typed quantity with a unit | `{ exists: { interface: { of: billing, has_operation: { input_has_field: { type_any: [ integer, number, decimal ], unit: present } } } } }` | targeted (fails on the seed) |
| T3 | The operation says what can go wrong | `{ exists: { interface: { of: billing, has_operation: { errors_at_least: 1 } } } }` | targeted (fails on the seed) |
| T4 | The gateway’s relationship names the interface it uses | `{ exists: { relationship: { from: billing-gateway, to: billing, uses_interface: present } } }` | targeted (fails on the seed) |
| T5 | The description passes the interface consistency checks | `{ checks: { max_warnings: 0, rules: [ interface/no-syntax, interface/untyped-field, interface/undefined-type, interface/no-unit, interface/no-format, interface/no-purpose, interface/no-errors, interface/example-mismatch ] } }` | guard (passes on the seed) |
| T6 | Every message field says what it means | `{ absent: { interface: { of: billing, has_operation: { input_has_field: { meaning: absent } } } } }` | guard (passes on the seed) |

Overview (P = pass, F = fail):

| Model | E/W | T1 | T2 | T3 | T4 | T5 | T6 | Intent |
|---|---|---|---|---|---|---|---|---|
| `seed` | 0/0 | F | F | F | F | P | P | Starter file: fails the tests the step targets; the guard passes. |
| `solution` | 0/0 | P | P | P | P | P | P | Reference solution: passes every test with 0 errors and 0 warnings. |
| `correct-1-renamed-ids` | 0/0 | P | P | P | P | P | P | interface, operation, and type ids renamed; the gateway names the renamed operation. |
| `correct-2-inline-fields-decimal-dollars` | 0/0 | P | P | P | P | P | P | the message as an inline field map, amount as a decimal in US dollars, whole-interface use. |
| `correct-3-errors-on-interface` | 0/0 | P | P | P | P | P | P | errors written under All operations; the gateway names the whole interface. |
| `correct-4-minimal` | 0/0 | P | P | P | P | P | P | a short but complete description: one operation, one typed amount with a unit, one error, no example. |
| `wrong-01-interface-on-gateway` | 0/0 | F | F | F | F | P | P | the interface described on the Billing Gateway, the sender, not on Billing. |
| `wrong-02-quantities-as-text` | 0/0 | P | F | P | P | P | P | units and amount typed as text (the string-quantity rule is only info). |
| `wrong-03-no-errors` | 0/1 | P | P | F | P | F | P | the operation lists no errors. |
| `wrong-04-no-purpose` | 0/1 | F | P | P | P | F | P | the operation has no purpose. |
| `wrong-05-numbers-without-units` | 0/2 | P | F | P | P | F | P | units and amount are numbers without a unit. |
| `wrong-06-no-uses` | 0/0 | P | P | P | F | P | P | a full description, but the gateway names nothing it uses. |
| `wrong-07-shorthand-sketch` | 0/0 | F | F | F | P | P | P | the one-line sketch from step 2 restored instead of a description. |
| `wrong-08-undefined-type` | 0/1 | P | F | P | P | F | P | the message type is named but not described. |
| `wrong-09-interface-on-registration-api` | 0/0 | F | F | F | F | P | P | the interface described on the Registration API, keyword-stuffed with Billing's terms. |
| `wrong-10-example-mismatch` | 0/1 | P | P | P | P | F | P | the example writes the amount as text with a currency. |
| `wrong-11-no-syntax` | 0/1 | P | P | P | P | F | P | the operation has no syntax line. |
| `wrong-12-amount-unit-only-in-meaning` | 0/1 | P | P | P | P | F | P | units has a unit, the amount names its unit only in the meaning. |
| `wrong-13-deleted-billing` | 0/0 | F | F | F | F | P | F | the Billing System deleted (deleted target). |
| `wrong-14-field-without-meaning` | 0/0 | P | P | P | P | P | F | request_id has no meaning (the novice profile hides interface/no-meaning, an info). |

Failed tests with reasons and hints (every test not listed for a model passes):

| Model | Test | Reason | Hints shown |
|---|---|---|---|
| `seed` | T1 | No interface {"of":"billing","has_operation":{"purpose":"present"}} yet | Where the interface lives |
| `seed` | T2 | No interface {"of":"billing","has_operation":{"input_has_field":{"type_any":["integer","number","decimal"],"unit":"present"}}} yet | The numbers in the message; Quantities written as text |
| `seed` | T3 | No interface {"of":"billing","has_operation":{"errors_at_least":1}} yet | A message that cannot be charged |
| `seed` | T4 | No relationship {"from":"billing-gateway","to":"billing","uses_interface":"present"} yet | The gateway’s side |
| `wrong-01-interface-on-gateway` | T1 | No interface {"of":"billing","has_operation":{"purpose":"present"}} yet | Where the interface lives; The sender is not the provider |
| `wrong-01-interface-on-gateway` | T2 | No interface {"of":"billing","has_operation":{"input_has_field":{"type_any":["integer","number","decimal"],"unit":"present"}}} yet | The numbers in the message; Quantities written as text |
| `wrong-01-interface-on-gateway` | T3 | No interface {"of":"billing","has_operation":{"errors_at_least":1}} yet | A message that cannot be charged |
| `wrong-01-interface-on-gateway` | T4 | No relationship {"from":"billing-gateway","to":"billing","uses_interface":"present"} yet | The gateway’s side |
| `wrong-02-quantities-as-text` | T2 | No interface {"of":"billing","has_operation":{"input_has_field":{"type_any":["integer","number","decimal"],"unit":"present"}}} yet | The numbers in the message; Quantities written as text |
| `wrong-03-no-errors` | T3 | No interface {"of":"billing","has_operation":{"errors_at_least":1}} yet | A message that cannot be charged; Two kinds of failure |
| `wrong-03-no-errors` | T5 | The checks report 1 warning (at most 0 allowed): interface/no-errors on billing: charge-tuition lists no errors. A client built by another team must know what can go wrong and what to do then. | Read the Problems panel; Check the example against the types |
| `wrong-04-no-purpose` | T1 | No interface {"of":"billing","has_operation":{"purpose":"present"}} yet | Where the interface lives; An operation with a purpose |
| `wrong-04-no-purpose` | T5 | The checks report 1 warning (at most 0 allowed): interface/no-purpose on billing: charge-tuition has no Purpose. A client cannot tell whether the operation fits its need. | Read the Problems panel; Check the example against the types |
| `wrong-05-numbers-without-units` | T2 | No interface {"of":"billing","has_operation":{"input_has_field":{"type_any":["integer","number","decimal"],"unit":"present"}}} yet | The numbers in the message; A number without a unit |
| `wrong-05-numbers-without-units` | T5 | The checks report 2 warnings (at most 0 allowed): interface/no-unit on billing: ChargeRequested.units is a number with no Unit. Two teams can read the same number differently.; interface/no-unit on billing: ChargeRequested.amount is a number with no Unit. Two teams can read the same number differently. | Read the Problems panel; Check the example against the types |
| `wrong-06-no-uses` | T4 | No relationship {"from":"billing-gateway","to":"billing","uses_interface":"present"} yet | The gateway’s side; Name what it uses |
| `wrong-07-shorthand-sketch` | T1 | No interface {"of":"billing","has_operation":{"purpose":"present"}} yet | Where the interface lives; An operation with a purpose |
| `wrong-07-shorthand-sketch` | T2 | No interface {"of":"billing","has_operation":{"input_has_field":{"type_any":["integer","number","decimal"],"unit":"present"}}} yet | The numbers in the message; Quantities written as text |
| `wrong-07-shorthand-sketch` | T3 | No interface {"of":"billing","has_operation":{"errors_at_least":1}} yet | A message that cannot be charged; Two kinds of failure |
| `wrong-08-undefined-type` | T2 | No interface {"of":"billing","has_operation":{"input_has_field":{"type_any":["integer","number","decimal"],"unit":"present"}}} yet | The numbers in the message; Quantities written as text |
| `wrong-08-undefined-type` | T5 | The checks report 1 warning (at most 0 allowed): interface/undefined-type on billing: ChargeRequested is used as a type but not described. A client needs its fields to build or read it. | Read the Problems panel; Check the example against the types |
| `wrong-09-interface-on-registration-api` | T1 | No interface {"of":"billing","has_operation":{"purpose":"present"}} yet | Where the interface lives |
| `wrong-09-interface-on-registration-api` | T2 | No interface {"of":"billing","has_operation":{"input_has_field":{"type_any":["integer","number","decimal"],"unit":"present"}}} yet | The numbers in the message; Quantities written as text |
| `wrong-09-interface-on-registration-api` | T3 | No interface {"of":"billing","has_operation":{"errors_at_least":1}} yet | A message that cannot be charged |
| `wrong-09-interface-on-registration-api` | T4 | No relationship {"from":"billing-gateway","to":"billing","uses_interface":"present"} yet | The gateway’s side |
| `wrong-10-example-mismatch` | T5 | The checks report 1 warning (at most 0 allowed): interface/example-mismatch on billing: Example 1 of charge-tuition does not match its types: amount: 4184.00 USD is not a number. An example that contradicts the syntax misleads every client that copies it. | Read the Problems panel; Check the example against the types |
| `wrong-11-no-syntax` | T5 | The checks report 1 warning (at most 0 allowed): interface/no-syntax on billing: charge-tuition has no syntax line. A client cannot call an operation it cannot write down. | Read the Problems panel; Check the example against the types |
| `wrong-12-amount-unit-only-in-meaning` | T5 | The checks report 1 warning (at most 0 allowed): interface/no-unit on billing: ChargeRequested.amount is a number with no Unit. Two teams can read the same number differently. | Read the Problems panel; Check the example against the types |
| `wrong-13-deleted-billing` | T1 | unknown element billing | Where the interface lives; Billing is gone |
| `wrong-13-deleted-billing` | T2 | unknown element billing | The numbers in the message |
| `wrong-13-deleted-billing` | T3 | unknown element billing | A message that cannot be charged |
| `wrong-13-deleted-billing` | T4 | unknown element billing | The gateway’s side; Billing is gone |
| `wrong-13-deleted-billing` | T6 | unknown element billing | A meaning for every field; Billing is gone |
| `wrong-14-field-without-meaning` | T6 | Found tuition-charges matching interface {"of":"billing","has_operation":{"input_has_field":{"meaning":"absent"}}}, but there should be none | A meaning for every field |
