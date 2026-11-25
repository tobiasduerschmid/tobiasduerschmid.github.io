# C4 tutorial: expected test results

This is the oracle for `scripts/tests/c4-tutorial-content.test.js`. For every graded step it lists each test (description and `tests[].c4` predicate) and its role, then the result of that test on the step's seed, its solution, and every model in `alternatives/step-N/` (for step 9 also `models/step-9-reference-b.yml`), with the core's message and the hints whose conditions hold when the test fails.

How the results were obtained: the real core (`js/ArchUML/c4/c4-core.js`) evaluated every predicate with `ArchUMLC4.query.evaluate`, with the step's `c4.checks` configuration (the step's keys over the tutorial's, merged by sub-key) as `checksConfig` and the step's authored starter as `seedModel`, as the content test does. The first line of each alternative states the results it must give, and every row below agrees with it. Every conditional hint holds on at least one model on which its test fails; the wrong models whose first line says which hint they reach are partial repairs kept for that purpose. A later disagreement between the core and this table is a core bug or a content defect to resolve, never a reason to edit this table silently.

Conventions: the step's `c4.checks` configuration (severity overrides) applies to `checks:` predicates, as spec §7.2 requires; the tutorial sets `checks.honorFileIgnores: false`, so a `checks.ignore` entry in `design.yml` cannot pass a `checks:` test. `same_as_seed` compares with the step's authored starter file (`files[].content` for `design.yml`), not with a snapshot of the learner's file (spec §8); its interface form matches the interface in the starter file and requires the same id, the same provider, and equal data. "E/W" is the model's error and warning count under default options (solutions must be 0/0). Step 1 is quiz-only and has no tests.

Seeds: every seed fails at least one test its step targets. Tests marked "guard" pass on the seed by design, because they protect a part the step supplies (spec §11: "each seed fails at least one targeted test; guard predicates … are exempt"). A guard must still fail on the named wrong model that breaks the part it protects.

Spec status: every predicate is in the spec §8 vocabulary. Step 8's tests 3 and 4 use the scenario-step query `step: {scenario, from, to, in_fragment, reply}` and rely on the two §6.3 reply rules (a reply may answer a request made before its enclosing fragment; open requests are kept per branch). Step 7's test 3 uses `same_as_seed: {interface: …}`. The content test compares every row.

## Step 2: Zooming In to Confirm

| Test | Description | Predicate | Role | Spec status |
|---|---|---|---|---|
| T1 | The saved view who-decides shows the component that decides enrollment | `{ view: { view: who-decides, shows: [ policy ] } }` | targeted (fails on the seed) | §8 |

Overview (P = pass, F = fail):

| Model | E/W | T1 | Intent |
|---|---|---|---|
| `seed` | 0/0 | F | Starter file: fails the criteria the step targets. |
| `solution` | 0/0 | P | Reference solution: passes every test with 0 errors and 0 warnings. |
| `correct-1-synonym-selector` | 0/0 | P | CORRECT (synonym selector "component of api", reworded description): must pass T1. |
| `correct-2-titled-focused-view` | 0/0 | P | CORRECT (custom view with a title, a direction, and an exclude): must pass T1. |
| `wrong-1-keyword-stuffed-container-view` | 0/0 | F | WRONG (keyword-stuffed: the description names the Enrollment Policy, but the view stops at containers): must fail T1. |
| `wrong-2-context-view` | 0/0 | F | WRONG (the saved view never zooms in, as on the seed, but with a real description): must fail T1. |
| `wrong-3-deleted-target` | 0/0 | F | WRONG (deleted target: the Enrollment Policy and the request to it are gone): must fail T1 (unknown element policy). |
| `wrong-4-selector-typo` | 1/0 | F | WRONG (the selector names an element that does not exist, "API"): must fail T1 as a learner-facing failure, not an author error (spec §8, missing selectors). |

Expected results with reasons:

| Model | Test | Expected | Reason | Hints shown on failure |
|---|---|---|---|---|
| `seed` | T1 | fail | The view who-decides does not show policy | The Level That Answers the Question |
| `solution` | T1 | pass | The view who-decides is as required | — |
| `correct-1-synonym-selector` | T1 | pass | The view who-decides is as required | — |
| `correct-2-titled-focused-view` | T1 | pass | The view who-decides is as required | — |
| `wrong-1-keyword-stuffed-container-view` | T1 | fail | The view who-decides does not show policy | The Level That Answers the Question; A View That Stops Too Early; Level and Scope Together |
| `wrong-2-context-view` | T1 | fail | The view who-decides does not show policy | The Level That Answers the Question |
| `wrong-3-deleted-target` | T1 | fail | unknown element policy | The Level That Answers the Question; The Policy Is Gone |
| `wrong-4-selector-typo` | T1 | fail | The view who-decides cannot be drawn. There is no element named API | The Level That Answers the Question |

## Step 3: Context View Repair

| Test | Description | Predicate | Role | Spec status |
|---|---|---|---|---|
| T1 | People: every role in the requirements appears in the context view | `{ view: { view: context of registration, shows: [ { type: person, name_any: [ adviser, advisor, counselor, counsellor ] } ] } }` | targeted (fails on the seed) | §8 |
| T2 | People: each role has a person of its own | `{ absent: { element: { id: student, name_any: [ adviser, advisor, counselor, counsellor ] } } }` | guard (passes on the seed) | §8 |
| T3 | Relationships: every relationship says what it asks for | `{ checks: { max_warnings: 0, rules: [ rdd/no-reason, c4/vague-relationship ] } }` | targeted (fails on the seed) | §8 |
| T4 | Kept parts: Course Registration still sends requests to the Billing System | `{ exists: { relationship: { from: registration, to: billing } } }` | guard (passes on the seed) | §8 |
| T5 | Names: no element has a generic name | `{ checks: { max_warnings: 0, rules: [ c4/generic-name ] } }` | targeted (fails on the seed) | §8 |
| T6 | Element types: each box’s type matches who builds and runs it | `{ count: { element: { type: system } }, equals: 2 }` | targeted (fails on the seed) | §8 |
| T7 | Kept parts: the stored data survives your repairs | `{ exists: { element: { type: container, kind: database, in: registration } } }` | targeted (fails on the seed) | §8 |
| T8 | Kept parts: the student, the Planner Web App, and the Billing System still appear in the container view | `{ view: { view: containers of registration, shows: [ student, web, billing ] } }` | guard (passes on the seed) | §8 |

Overview (P = pass, F = fail):

| Model | E/W | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | Intent |
|---|---|---|---|---|---|---|---|---|---|---|
| `seed` | 0/1 | F | P | F | P | F | F | F | P | Starter file: fails the criteria the step targets. |
| `solution` | 0/0 | P | P | P | P | P | P | P | P | Reference solution: passes every test with 0 errors and 0 warnings. |
| `correct-1-renamed-ids-synonyms` | 0/0 | P | P | P | P | P | P | P | P | CORRECT (renamed ids registration-store and faculty-advisor; synonyms Faculty Advisor and Enrollment Service; reworded billing request): must pass T1-T8. |
| `correct-2-other-levels` | 0/0 | P | P | P | P | P | P | P | P | CORRECT (adviser relationship declared at the system level; billing relationship declared one level deeper on a component): must pass T1-T8. |
| `wrong-1-keyword-stuffed-student` | 0/0 | P | F | P | P | P | P | P | P | WRONG (keyword-stuffed: the adviser role is written into the student's name instead of a second person): must pass T1 and fail T2. |
| `wrong-10-old-store-system-kept` | 0/1 | P | P | P | P | P | F | P | P | WRONG (partial repair: the database container was added, but the old Enrollment Records system was not removed): must fail T6 only; reaches "Now Remove the Old Box". |
| `wrong-11-store-without-kind` | 0/0 | P | P | P | P | P | P | F | P | WRONG (partial repair: the store moved inside Course Registration as a container, but without kind database): must fail T7 only; reaches "Shape and Type Text". |
| `wrong-12-store-inside-old-system` | 0/1 | P | P | P | P | P | F | F | P | WRONG (the database container was added inside the old Enrollment Records system instead of Course Registration): must fail T6 and T7, pass the rest; reaches "Inside the Right System". |
| `wrong-13-student-disconnected` | 0/1 | P | P | P | P | P | P | P | F | WRONG (the student's relationship to the Planner Web App was removed while the web app's relationships were repaired): must fail T8 only; reaches "The Student Dropped Out". |
| `wrong-2-external-database` | 0/0 | P | P | P | P | P | F | F | P | WRONG (the store stays a software system, now marked external; other repairs done): must fail T6 and T7. |
| `wrong-3-deleted-billing-relationship` | 0/1 | P | P | P | F | P | P | P | F | WRONG (deleted target: the unlabeled billing relationship was removed instead of described): must fail T4 and T8, pass the rest. |
| `wrong-4-deleted-database` | 0/0 | P | P | P | P | P | P | F | P | WRONG (deleted target: the store was deleted instead of moved inside Course Registration): must fail T7 only. |
| `wrong-5-stuffed-student-plus-registrar` | 0/1 | P | F | P | P | P | P | P | P | WRONG (reviewer counter-model s3-A: the keyword-stuffed student plus an unconnected Registrar, so two people exist): must fail T2 only. |
| `wrong-6-adviser-connected-to-billing` | 0/0 | F | P | P | P | P | P | P | P | WRONG (the adviser is named correctly but connected only to the Billing System, so the context view leaves the adviser out): must fail T1 only. |
| `wrong-7-billing-labelled-uses` | 0/1 | P | P | F | P | P | P | P | P | WRONG (partial repair: the billing relationship now has a description, but only "uses"): must fail T3 only; reaches "Words That Fit Any Arrow". |
| `wrong-8-student-pays-billing` | 0/0 | P | P | P | F | P | P | P | F | WRONG (the unlabeled billing relationship was replaced by one from the student, who pays the tuition): must fail T4 and T8, pass the rest; reaches "From the Right Sender" and "The Billing System Dropped Out". |
| `wrong-9-backend-name-kept` | 0/0 | P | P | P | P | F | P | P | P | WRONG (partial repair: every other problem fixed, but the generic name "Backend" kept): must fail T5 only; reaches "Name It After Its Job" and "Change the Name, Keep the Id". |

Expected results with reasons:

| Model | Test | Expected | Reason | Hints shown on failure |
|---|---|---|---|---|
| `seed` | T1 | fail | The view context of registration does not show an element matching {"type":"person","name_any":["adviser","advisor","counselor","counsellor"]} | The Role in FR-12 |
| `seed` | T2 | pass | No element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]} | — |
| `seed` | T3 | fail | The checks report 1 warning (at most 0 allowed): rdd/no-reason on backend: Backend's relationship to Billing System has no description. A reader cannot tell what Backend asks for. | Read Every Arrow Aloud; An Arrow With No Words |
| `seed` | T4 | pass | Found relationship {"from":"registration","to":"billing"} | — |
| `seed` | T5 | fail | The checks report 1 warning (at most 0 allowed): c4/generic-name on backend: 'Backend' could name a part of any system. A reader cannot tell what this one does. | Names That Fit Any System |
| `seed` | T6 | fail | 3 match element {"type":"system"}; expected exactly 2 | Who Builds It? |
| `seed` | T7 | fail | No element {"type":"container","kind":"database","in":"registration"} yet | Keep the Data |
| `seed` | T8 | pass | The view containers of registration is as required | — |
| `solution` | T1 | pass | The view context of registration is as required | — |
| `solution` | T2 | pass | No element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]} | — |
| `solution` | T3 | pass | The checks report no more findings than allowed | — |
| `solution` | T4 | pass | Found relationship {"from":"registration","to":"billing"} | — |
| `solution` | T5 | pass | The checks report no more findings than allowed | — |
| `solution` | T6 | pass | 2 match element {"type":"system"} | — |
| `solution` | T7 | pass | Found element {"type":"container","kind":"database","in":"registration"} | — |
| `solution` | T8 | pass | The view containers of registration is as required | — |
| `correct-1-renamed-ids-synonyms` | T1 | pass | The view context of registration is as required | — |
| `correct-1-renamed-ids-synonyms` | T2 | pass | No element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]} | — |
| `correct-1-renamed-ids-synonyms` | T3 | pass | The checks report no more findings than allowed | — |
| `correct-1-renamed-ids-synonyms` | T4 | pass | Found relationship {"from":"registration","to":"billing"} | — |
| `correct-1-renamed-ids-synonyms` | T5 | pass | The checks report no more findings than allowed | — |
| `correct-1-renamed-ids-synonyms` | T6 | pass | 2 match element {"type":"system"} | — |
| `correct-1-renamed-ids-synonyms` | T7 | pass | Found element {"type":"container","kind":"database","in":"registration"} | — |
| `correct-1-renamed-ids-synonyms` | T8 | pass | The view containers of registration is as required | — |
| `correct-2-other-levels` | T1 | pass | The view context of registration is as required | — |
| `correct-2-other-levels` | T2 | pass | No element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]} | — |
| `correct-2-other-levels` | T3 | pass | The checks report no more findings than allowed | — |
| `correct-2-other-levels` | T4 | pass | Found relationship {"from":"registration","to":"billing"} | — |
| `correct-2-other-levels` | T5 | pass | The checks report no more findings than allowed | — |
| `correct-2-other-levels` | T6 | pass | 2 match element {"type":"system"} | — |
| `correct-2-other-levels` | T7 | pass | Found element {"type":"container","kind":"database","in":"registration"} | — |
| `correct-2-other-levels` | T8 | pass | The view containers of registration is as required | — |
| `wrong-1-keyword-stuffed-student` | T1 | pass | The view context of registration is as required | — |
| `wrong-1-keyword-stuffed-student` | T2 | fail | Found student matching element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]}, but there should be none | One Box per Role; Two Goals, Two People |
| `wrong-1-keyword-stuffed-student` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-1-keyword-stuffed-student` | T4 | pass | Found relationship {"from":"registration","to":"billing"} | — |
| `wrong-1-keyword-stuffed-student` | T5 | pass | The checks report no more findings than allowed | — |
| `wrong-1-keyword-stuffed-student` | T6 | pass | 2 match element {"type":"system"} | — |
| `wrong-1-keyword-stuffed-student` | T7 | pass | Found element {"type":"container","kind":"database","in":"registration"} | — |
| `wrong-1-keyword-stuffed-student` | T8 | pass | The view containers of registration is as required | — |
| `wrong-10-old-store-system-kept` | T1 | pass | The view context of registration is as required | — |
| `wrong-10-old-store-system-kept` | T2 | pass | No element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]} | — |
| `wrong-10-old-store-system-kept` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-10-old-store-system-kept` | T4 | pass | Found relationship {"from":"registration","to":"billing"} | — |
| `wrong-10-old-store-system-kept` | T5 | pass | The checks report no more findings than allowed | — |
| `wrong-10-old-store-system-kept` | T6 | fail | 3 match element {"type":"system"}; expected exactly 2 | Who Builds It?; Now Remove the Old Box |
| `wrong-10-old-store-system-kept` | T7 | pass | Found element {"type":"container","kind":"database","in":"registration"} | — |
| `wrong-10-old-store-system-kept` | T8 | pass | The view containers of registration is as required | — |
| `wrong-11-store-without-kind` | T1 | pass | The view context of registration is as required | — |
| `wrong-11-store-without-kind` | T2 | pass | No element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]} | — |
| `wrong-11-store-without-kind` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-11-store-without-kind` | T4 | pass | Found relationship {"from":"registration","to":"billing"} | — |
| `wrong-11-store-without-kind` | T5 | pass | The checks report no more findings than allowed | — |
| `wrong-11-store-without-kind` | T6 | pass | 2 match element {"type":"system"} | — |
| `wrong-11-store-without-kind` | T7 | fail | No element {"type":"container","kind":"database","in":"registration"} yet | Keep the Data; Shape and Type Text |
| `wrong-11-store-without-kind` | T8 | pass | The view containers of registration is as required | — |
| `wrong-12-store-inside-old-system` | T1 | pass | The view context of registration is as required | — |
| `wrong-12-store-inside-old-system` | T2 | pass | No element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]} | — |
| `wrong-12-store-inside-old-system` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-12-store-inside-old-system` | T4 | pass | Found relationship {"from":"registration","to":"billing"} | — |
| `wrong-12-store-inside-old-system` | T5 | pass | The checks report no more findings than allowed | — |
| `wrong-12-store-inside-old-system` | T6 | fail | 3 match element {"type":"system"}; expected exactly 2 | Who Builds It?; One Level Down |
| `wrong-12-store-inside-old-system` | T7 | fail | No element {"type":"container","kind":"database","in":"registration"} yet | Keep the Data; Inside the Right System |
| `wrong-12-store-inside-old-system` | T8 | pass | The view containers of registration is as required | — |
| `wrong-13-student-disconnected` | T1 | pass | The view context of registration is as required | — |
| `wrong-13-student-disconnected` | T2 | pass | No element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]} | — |
| `wrong-13-student-disconnected` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-13-student-disconnected` | T4 | pass | Found relationship {"from":"registration","to":"billing"} | — |
| `wrong-13-student-disconnected` | T5 | pass | The checks report no more findings than allowed | — |
| `wrong-13-student-disconnected` | T6 | pass | 2 match element {"type":"system"} | — |
| `wrong-13-student-disconnected` | T7 | pass | Found element {"type":"container","kind":"database","in":"registration"} | — |
| `wrong-13-student-disconnected` | T8 | fail | The view containers of registration does not show student | Something Right Went Missing; The Student Dropped Out |
| `wrong-2-external-database` | T1 | pass | The view context of registration is as required | — |
| `wrong-2-external-database` | T2 | pass | No element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]} | — |
| `wrong-2-external-database` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-2-external-database` | T4 | pass | Found relationship {"from":"registration","to":"billing"} | — |
| `wrong-2-external-database` | T5 | pass | The checks report no more findings than allowed | — |
| `wrong-2-external-database` | T6 | fail | 3 match element {"type":"system"}; expected exactly 2 | Who Builds It?; One Level Down; External Means Another Owner |
| `wrong-2-external-database` | T7 | fail | No element {"type":"container","kind":"database","in":"registration"} yet | Keep the Data |
| `wrong-2-external-database` | T8 | pass | The view containers of registration is as required | — |
| `wrong-3-deleted-billing-relationship` | T1 | pass | The view context of registration is as required | — |
| `wrong-3-deleted-billing-relationship` | T2 | pass | No element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]} | — |
| `wrong-3-deleted-billing-relationship` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-3-deleted-billing-relationship` | T4 | fail | No relationship {"from":"registration","to":"billing"} yet | Keep What Was Right; Restore the Request |
| `wrong-3-deleted-billing-relationship` | T5 | pass | The checks report no more findings than allowed | — |
| `wrong-3-deleted-billing-relationship` | T6 | pass | 2 match element {"type":"system"} | — |
| `wrong-3-deleted-billing-relationship` | T7 | pass | Found element {"type":"container","kind":"database","in":"registration"} | — |
| `wrong-3-deleted-billing-relationship` | T8 | fail | The view containers of registration does not show billing | Something Right Went Missing; The Billing System Dropped Out |
| `wrong-4-deleted-database` | T1 | pass | The view context of registration is as required | — |
| `wrong-4-deleted-database` | T2 | pass | No element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]} | — |
| `wrong-4-deleted-database` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-4-deleted-database` | T4 | pass | Found relationship {"from":"registration","to":"billing"} | — |
| `wrong-4-deleted-database` | T5 | pass | The checks report no more findings than allowed | — |
| `wrong-4-deleted-database` | T6 | pass | 2 match element {"type":"system"} | — |
| `wrong-4-deleted-database` | T7 | fail | No element {"type":"container","kind":"database","in":"registration"} yet | Keep the Data |
| `wrong-4-deleted-database` | T8 | pass | The view containers of registration is as required | — |
| `wrong-5-stuffed-student-plus-registrar` | T1 | pass | The view context of registration is as required | — |
| `wrong-5-stuffed-student-plus-registrar` | T2 | fail | Found student matching element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]}, but there should be none | One Box per Role; Give the Student Back Its Name |
| `wrong-5-stuffed-student-plus-registrar` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-5-stuffed-student-plus-registrar` | T4 | pass | Found relationship {"from":"registration","to":"billing"} | — |
| `wrong-5-stuffed-student-plus-registrar` | T5 | pass | The checks report no more findings than allowed | — |
| `wrong-5-stuffed-student-plus-registrar` | T6 | pass | 2 match element {"type":"system"} | — |
| `wrong-5-stuffed-student-plus-registrar` | T7 | pass | Found element {"type":"container","kind":"database","in":"registration"} | — |
| `wrong-5-stuffed-student-plus-registrar` | T8 | pass | The view containers of registration is as required | — |
| `wrong-6-adviser-connected-to-billing` | T1 | fail | The view context of registration does not show an element matching {"type":"person","name_any":["adviser","advisor","counselor","counsellor"]} | The Role in FR-12; Name and Connection; The Name Readers Expect |
| `wrong-6-adviser-connected-to-billing` | T2 | pass | No element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]} | — |
| `wrong-6-adviser-connected-to-billing` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-6-adviser-connected-to-billing` | T4 | pass | Found relationship {"from":"registration","to":"billing"} | — |
| `wrong-6-adviser-connected-to-billing` | T5 | pass | The checks report no more findings than allowed | — |
| `wrong-6-adviser-connected-to-billing` | T6 | pass | 2 match element {"type":"system"} | — |
| `wrong-6-adviser-connected-to-billing` | T7 | pass | Found element {"type":"container","kind":"database","in":"registration"} | — |
| `wrong-6-adviser-connected-to-billing` | T8 | pass | The view containers of registration is as required | — |
| `wrong-7-billing-labelled-uses` | T1 | pass | The view context of registration is as required | — |
| `wrong-7-billing-labelled-uses` | T2 | pass | No element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]} | — |
| `wrong-7-billing-labelled-uses` | T3 | fail | The checks report 1 warning (at most 0 allowed): c4/vague-relationship on backend: 'uses' could label any arrow. A reader cannot tell what Registration API asks of Billing System. | Read Every Arrow Aloud; Words That Fit Any Arrow |
| `wrong-7-billing-labelled-uses` | T4 | pass | Found relationship {"from":"registration","to":"billing"} | — |
| `wrong-7-billing-labelled-uses` | T5 | pass | The checks report no more findings than allowed | — |
| `wrong-7-billing-labelled-uses` | T6 | pass | 2 match element {"type":"system"} | — |
| `wrong-7-billing-labelled-uses` | T7 | pass | Found element {"type":"container","kind":"database","in":"registration"} | — |
| `wrong-7-billing-labelled-uses` | T8 | pass | The view containers of registration is as required | — |
| `wrong-8-student-pays-billing` | T1 | pass | The view context of registration is as required | — |
| `wrong-8-student-pays-billing` | T2 | pass | No element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]} | — |
| `wrong-8-student-pays-billing` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-8-student-pays-billing` | T4 | fail | No relationship {"from":"registration","to":"billing"} yet | Keep What Was Right; From the Right Sender |
| `wrong-8-student-pays-billing` | T5 | pass | The checks report no more findings than allowed | — |
| `wrong-8-student-pays-billing` | T6 | pass | 2 match element {"type":"system"} | — |
| `wrong-8-student-pays-billing` | T7 | pass | Found element {"type":"container","kind":"database","in":"registration"} | — |
| `wrong-8-student-pays-billing` | T8 | fail | The view containers of registration does not show billing | Something Right Went Missing; The Billing System Dropped Out |
| `wrong-9-backend-name-kept` | T1 | pass | The view context of registration is as required | — |
| `wrong-9-backend-name-kept` | T2 | pass | No element {"id":"student","name_any":["adviser","advisor","counselor","counsellor"]} | — |
| `wrong-9-backend-name-kept` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-9-backend-name-kept` | T4 | pass | Found relationship {"from":"registration","to":"billing"} | — |
| `wrong-9-backend-name-kept` | T5 | fail | The checks report 1 warning (at most 0 allowed): c4/generic-name on backend: 'Backend' could name a part of any system. A reader cannot tell what this one does. | Names That Fit Any System; Name It After Its Job; Change the Name, Keep the Id |
| `wrong-9-backend-name-kept` | T6 | pass | 2 match element {"type":"system"} | — |
| `wrong-9-backend-name-kept` | T7 | pass | Found element {"type":"container","kind":"database","in":"registration"} | — |
| `wrong-9-backend-name-kept` | T8 | pass | The view containers of registration is as required | — |

## Step 4: Responsibilities from Requirements

| Test | Description | Predicate | Role | Spec status |
|---|---|---|---|---|
| T1 | Every requirement is traced to a responsibility | `{ checks: { max_warnings: 0, rules: [ rdd/uncovered-requirement ] } }` | targeted (fails on the seed) | §8 |
| T2 | Course Registration owns at least one decision | `{ exists: { responsibility: { of: registration, kind: decide } } }` | targeted (fails on the seed) | §8 |
| T3 | Every responsibility is an obligation, not a field, method, or screen action | `{ checks: { max_warnings: 0, rules: [ rdd/not-an-obligation ] } }` | targeted (fails on the seed) | §8 |
| T4 | Every responsibility belongs to the system you are designing | `{ absent: { responsibility: { of: billing } } }` | guard (passes on the seed) | §8 |

Overview (P = pass, F = fail):

| Model | E/W | T1 | T2 | T3 | T4 | Intent |
|---|---|---|---|---|---|---|
| `seed` | 0/1 | F | F | F | P | Starter file: fails the criteria the step targets. |
| `solution` | 0/0 | P | P | P | P | Reference solution: passes every test with 0 errors and 0 warnings. |
| `correct-1-renamed-ids-reworded` | 0/0 | P | P | P | P | CORRECT (renamed ids, reworded promises): must pass T1-T4. |
| `correct-2-draft-rewritten` | 0/0 | P | P | P | P | CORRECT (the teammate's statement rewritten as a guarantee; an extra KNOW of passed courses that the decision uses; one responsibility traced to two requirements): must pass T1-T4. |
| `wrong-1-keyword-stuffed-billing` | 0/1 | P | F | P | F | WRONG (keyword-stuffed: the right responsibilities, written on the Billing System): must pass T1 and T3, fail T2 and T4. |
| `wrong-2-no-decide-derived-fact` | 0/0 | P | F | P | P | WRONG (no DECIDE: only the derived prerequisite fact is recorded): must fail T2. |
| `wrong-3-draft-kept` | 0/1 | P | P | F | P | WRONG (the teammate's screen action kept beside the new responsibilities): must fail T3. |
| `wrong-4-method-name` | 0/1 | P | P | F | P | WRONG (a KNOW written as a method call with empty parentheses): must fail T3. |
| `wrong-5-shorthand-untraced` | 0/0 | F | P | P | P | WRONG (responsibilities as shorthand strings, so nothing traces to a requirement): must fail T1, pass T2-T4. |
| `wrong-6-stuffed-billing-plus-decide` | 0/0 | P | P | P | F | WRONG (reviewer counter-model s4-H: wrong-1 plus an untraced DECIDE on Course Registration): must pass T1-T3, fail T4. |
| `wrong-7-requirements-emptied` | 0/0 | P | P | P | P | WRONG BUT UNREACHABLE (reviewer counter-model s4-E: requirements emptied, one untraced DECIDE): passes T1-T4; locked_fields: [requirements] binds the YAML surface too (spec §11), so the runtime reverts this edit. |

Expected results with reasons:

| Model | Test | Expected | Reason | Hints shown on failure |
|---|---|---|---|---|
| `seed` | T1 | fail | The checks report 3 warnings (at most 0 allowed): rdd/uncovered-requirement: No responsibility traces to the requirement FR-21.; rdd/uncovered-requirement: No responsibility traces to the requirement FR-22.; rdd/uncovered-requirement: No responsibility traces to the requirement FR-23. | One Requirement at a Time |
| `seed` | T2 | fail | No responsibility {"of":"registration","kind":"decide"} yet | Spot the Judgment |
| `seed` | T3 | fail | The checks report 1 warning (at most 0 allowed): rdd/not-an-obligation on registration: 'click Enroll for every section in a plan' reads like a field, a method, or a screen step. A responsibility is a promise a reader can check. | Promises, Not Parts |
| `seed` | T4 | pass | No responsibility {"of":"billing"} | — |
| `solution` | T1 | pass | The checks report no more findings than allowed | — |
| `solution` | T2 | pass | Found responsibility {"of":"registration","kind":"decide"} | — |
| `solution` | T3 | pass | The checks report no more findings than allowed | — |
| `solution` | T4 | pass | No responsibility {"of":"billing"} | — |
| `correct-1-renamed-ids-reworded` | T1 | pass | The checks report no more findings than allowed | — |
| `correct-1-renamed-ids-reworded` | T2 | pass | Found responsibility {"of":"registration","kind":"decide"} | — |
| `correct-1-renamed-ids-reworded` | T3 | pass | The checks report no more findings than allowed | — |
| `correct-1-renamed-ids-reworded` | T4 | pass | No responsibility {"of":"billing"} | — |
| `correct-2-draft-rewritten` | T1 | pass | The checks report no more findings than allowed | — |
| `correct-2-draft-rewritten` | T2 | pass | Found responsibility {"of":"registration","kind":"decide"} | — |
| `correct-2-draft-rewritten` | T3 | pass | The checks report no more findings than allowed | — |
| `correct-2-draft-rewritten` | T4 | pass | No responsibility {"of":"billing"} | — |
| `wrong-1-keyword-stuffed-billing` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-1-keyword-stuffed-billing` | T2 | fail | No responsibility {"of":"registration","kind":"decide"} yet | Spot the Judgment |
| `wrong-1-keyword-stuffed-billing` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-1-keyword-stuffed-billing` | T4 | fail | Found sys-eligibility, sys-open-seats, sys-holds, sys-full-section matching responsibility {"of":"billing"}, but there should be none | Your System, Not Its Neighbors; All on the Wrong Box |
| `wrong-2-no-decide-derived-fact` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-2-no-decide-derived-fact` | T2 | fail | No responsibility {"of":"registration","kind":"decide"} yet | Spot the Judgment; Knowing Is Not Deciding; Write the Judgment |
| `wrong-2-no-decide-derived-fact` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-2-no-decide-derived-fact` | T4 | pass | No responsibility {"of":"billing"} | — |
| `wrong-3-draft-kept` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-3-draft-kept` | T2 | pass | Found responsibility {"of":"registration","kind":"decide"} | — |
| `wrong-3-draft-kept` | T3 | fail | The checks report 1 warning (at most 0 allowed): rdd/not-an-obligation on registration: 'click Enroll for every section in a plan' reads like a field, a method, or a screen step. A responsibility is a promise a reader can check. | Promises, Not Parts; Find the Flagged Statement; A Rewriting Pattern |
| `wrong-3-draft-kept` | T4 | pass | No responsibility {"of":"billing"} | — |
| `wrong-4-method-name` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-4-method-name` | T2 | pass | Found responsibility {"of":"registration","kind":"decide"} | — |
| `wrong-4-method-name` | T3 | fail | The checks report 1 warning (at most 0 allowed): rdd/not-an-obligation on registration: 'openSeats()' reads like a field, a method, or a screen step. A responsibility is a promise a reader can check. | Promises, Not Parts; Find the Flagged Statement; A Rewriting Pattern |
| `wrong-4-method-name` | T4 | pass | No responsibility {"of":"billing"} | — |
| `wrong-5-shorthand-untraced` | T1 | fail | The checks report 3 warnings (at most 0 allowed): rdd/uncovered-requirement: No responsibility traces to the requirement FR-21.; rdd/uncovered-requirement: No responsibility traces to the requirement FR-22.; rdd/uncovered-requirement: No responsibility traces to the requirement FR-23. | One Requirement at a Time; Traces Need the Map Form; The Failure Case Counts Too |
| `wrong-5-shorthand-untraced` | T2 | pass | Found responsibility {"of":"registration","kind":"decide"} | — |
| `wrong-5-shorthand-untraced` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-5-shorthand-untraced` | T4 | pass | No responsibility {"of":"billing"} | — |
| `wrong-6-stuffed-billing-plus-decide` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-6-stuffed-billing-plus-decide` | T2 | pass | Found responsibility {"of":"registration","kind":"decide"} | — |
| `wrong-6-stuffed-billing-plus-decide` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-6-stuffed-billing-plus-decide` | T4 | fail | Found sys-eligibility, sys-open-seats, sys-holds, sys-full-section matching responsibility {"of":"billing"}, but there should be none | Your System, Not Its Neighbors; Split Across Two Systems |
| `wrong-7-requirements-emptied` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-7-requirements-emptied` | T2 | pass | Found responsibility {"of":"registration","kind":"decide"} | — |
| `wrong-7-requirements-emptied` | T3 | pass | The checks report no more findings than allowed | — |
| `wrong-7-requirements-emptied` | T4 | pass | No responsibility {"of":"billing"} | — |

## Step 5: Allocation to Containers

| Test | Description | Predicate | Role | Spec status |
|---|---|---|---|---|
| T1 | A container refines the enrollment decision | `{ exists: { responsibility: { of: { type: container }, refines: sys-eligibility } } }` | targeted (fails on the seed) | §8 |
| T2 | A container refines the all-or-nothing seat hold | `{ exists: { responsibility: { of: { type: container }, refines: sys-holds } } }` | targeted (fails on the seed) | §8 |
| T3 | A container refines knowing which section was full | `{ exists: { responsibility: { of: { type: container }, refines: sys-full-section } } }` | targeted (fails on the seed) | §8 |
| T4 | A container refines rearranging drafts without waiting for the server | `{ exists: { responsibility: { of: { type: container, kind: browser_app }, refines: sys-drafts } } }` | targeted (fails on the seed) | §8 |
| T5 | The worked example still refines the open-seats knowledge | `{ exists: { responsibility: { of: { type: container }, refines: sys-open-seats } } }` | guard (passes on the seed) | §8 |
| T6 | No decision runs in the browser app | `{ absent: { responsibility: { of: web, kind: decide } } }` | targeted (fails on the seed) | §8 |
| T7 | Every container names its technology, even if it is still to be decided | `{ every: { type: container, in: registration }, satisfies: { technology: present } }` | targeted (fails on the seed) | §8 |
| T8 | Every technology names what a container is built with, not where it runs | `{ checks: { max_warnings: 0, rules: [ c4/infrastructure-container ] } }` | guard (passes on the seed) | §8 |
| T9 | The Planner Web App sends plans to the Registration API, with a technology | `{ exists: { relationship: { from: web, to: api, technology: present, derived: exclude } } }` | targeted (fails on the seed) | §8 |
| T10 | Every relationship says what it asks for | `{ checks: { max_warnings: 0, rules: [ rdd/no-reason, c4/vague-relationship ] } }` | guard (passes on the seed) | §8 |

Overview (P = pass, F = fail):

| Model | E/W | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 | Intent |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `seed` | 0/1 | F | F | F | F | P | F | F | P | F | P | Starter file: fails the criteria the step targets. |
| `solution` | 0/0 | P | P | P | P | P | P | P | P | P | P | Reference solution: passes every test with 0 errors and 0 warnings. |
| `correct-1-renamed-ids-tbd` | 0/0 | P | P | P | P | P | P | P | P | P | P | CORRECT (renamed container responsibility ids, reworded promises, TBD technologies): must pass T1-T10. |
| `correct-2-refines-list-deeper-relationship` | 0/0 | P | P | P | P | P | P | P | P | P | P | CORRECT (one responsibility refines two system responsibilities; the database relationship declared one level deeper on a component): must pass T1-T10. |
| `correct-3-browser-shows-answer` | 0/0 | P | P | P | P | P | P | P | P | P | P | CORRECT (the browser's DO that shows the API's answer refines the enrollment decision; the API keeps the DECIDE): must pass T1-T10. |
| `wrong-1-keyword-stuffed-no-link` | 0/0 | F | P | P | P | P | P | P | P | P | P | WRONG (keyword-stuffed: the API repeats the decision's words without a refines link): must fail T1. |
| `wrong-10-web-kind-changed` | 0/0 | P | P | P | F | P | F | P | P | P | P | WRONG (reviewer case: the teammate's DECIDE kept and the Planner Web App's kind changed to application): must fail T4 and T6. |
| `wrong-11-uses-label` | 0/1 | P | P | P | P | P | P | P | P | P | F | WRONG (the web app's relationship to the API is labeled "uses"): must pass T9, fail T10. |
| `wrong-12-relationship-without-technology` | 0/1 | P | P | P | P | P | P | P | P | F | P | WRONG (the web app's relationship to the API names no technology): must fail T9, pass T10. |
| `wrong-13-relationship-reversed` | 0/0 | P | P | P | P | P | P | P | P | F | P | WRONG (the relationship is drawn from the API to the web app): must fail T9, pass T10. |
| `wrong-14-worked-example-unlinked` | 0/0 | P | P | P | P | F | P | P | P | P | P | WRONG (the worked example kept, but its refines link removed while rewording): must fail T5 only; reaches "Check the Link", not "Restore It". |
| `wrong-15-hold-without-link` | 0/0 | P | F | P | P | P | P | P | P | P | P | WRONG (partial allocation: the API's seat-hold DO written by hand, without refines): must fail T2 only; reaches "A Link, Not a Lookalike" and "Let the Tray Write the Link". |
| `wrong-16-full-section-without-link` | 0/0 | P | P | F | P | P | P | P | P | P | P | WRONG (partial allocation: the API's full-section KNOW written by hand, without refines): must fail T3 only; reaches "A Link, Not a Lookalike" and "Let the Tray Write the Link". |
| `wrong-17-api-technology-missing` | 0/1 | P | P | P | P | P | P | F | P | P | P | WRONG (partial repair: the database names its product, but the Registration API names no technology): must fail T7 only; reaches "Undecided Is Allowed". |
| `wrong-18-first-hold-unlinked` | 0/0 | P | F | F | P | P | P | P | P | P | P | WRONG (early partial allocation: the API's seat-hold DO written by hand without refines, and no full-section KNOW yet): must fail T2 and T3 only; T2 reaches "A Link, Not a Lookalike" but not yet "Let the Tray Write the Link". |
| `wrong-19-worked-example-renamed-unlinked` | 0/0 | P | P | P | P | F | P | P | P | P | P | WRONG (the worked example's id renamed and its refines link dropped): must fail T5 only; reaches "Check the Link", not "Restore It". |
| `wrong-2-browser-decides` | 0/0 | P | P | P | P | P | F | P | P | P | P | WRONG (the browser app refines the enrollment decision instead of the API): must pass T1, fail T6. |
| `wrong-20-deleted-example-other-seat-know` | 0/0 | P | P | P | P | F | P | P | P | P | P | WRONG (the worked example deleted, and another Registration API KNOW about seats added without refines): must fail T5 only; reaches "Restore It", not "Check the Link". |
| `wrong-21-deleted-example-full-section-says-open` | 0/0 | P | P | P | P | F | P | P | P | P | P | WRONG (the worked example deleted, and the API's full-section KNOW reworded with "no open seats"): must fail T5 only; reaches "Restore It", not "Check the Link". |
| `wrong-22-drafts-do-unlinked` | 0/0 | P | P | P | F | P | P | P | P | P | P | WRONG (partial allocation: the Planner Web App's rearrange-drafts DO written by hand, without refines): must fail T4 only; reaches "A Link, Not a Lookalike". |
| `wrong-23-database-docker` | 0/1 | P | P | P | P | P | P | P | F | P | P | WRONG (the database names where it runs, Docker, instead of its product): must fail T8 only; reaches "Databases Name Their Product". |
| `wrong-3-two-owners` | 0/0 | P | P | P | P | P | F | P | P | P | P | WRONG (both the browser app and the API refine the enrollment decision): must pass T1, fail T6. |
| `wrong-4-database-decides` | 0/0 | P | P | P | P | P | P | P | P | P | P | WRONG DESIGN THAT PASSES (the database decides, as in the knowledge check): must pass T1-T10; only the reviewer can reject it. |
| `wrong-5-deleted-worked-example` | 0/0 | P | P | P | P | F | P | P | P | P | P | WRONG (deleted target: the worked example's refinement was removed): must fail T5. |
| `wrong-6-missing-technology` | 0/0 | P | P | P | P | P | P | F | P | P | P | WRONG (the database container names no technology): must fail T7. |
| `wrong-7-unlinked-browser-decide` | 0/0 | P | P | P | P | P | F | P | P | P | P | WRONG (reviewer counter-model s5-B: the teammate's browser DECIDE kept, with no refines link): must fail T6 only. |
| `wrong-8-drafts-on-the-server` | 0/0 | P | P | P | F | P | P | P | P | P | P | WRONG (the API, not the browser app, refines rearranging drafts without the server): must fail T4. |
| `wrong-9-docker-technology` | 0/1 | P | P | P | P | P | P | P | F | P | P | WRONG (the API names where it runs, Docker, instead of what it is built with): must fail T8. |

Expected results with reasons:

| Model | Test | Expected | Reason | Hints shown on failure |
|---|---|---|---|---|
| `seed` | T1 | fail | No responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} yet | Follow the Tray |
| `seed` | T2 | fail | No responsibility {"of":{"type":"container"},"refines":"sys-holds"} yet | Follow the Tray |
| `seed` | T3 | fail | No responsibility {"of":{"type":"container"},"refines":"sys-full-section"} yet | Follow the Tray |
| `seed` | T4 | fail | No responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} yet | Follow the Tray |
| `seed` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `seed` | T6 | fail | Found web#1 matching responsibility {"of":"web","kind":"decide"}, but there should be none | Where the Browser Runs |
| `seed` | T7 | fail | api, db does not satisfy {"technology":"present"} | Containers Name What They Are Built With |
| `seed` | T8 | pass | The checks report no more findings than allowed | — |
| `seed` | T9 | fail | No relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} yet | Who Sends the Plan |
| `seed` | T10 | pass | The checks report no more findings than allowed | — |
| `solution` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `solution` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `solution` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `solution` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `solution` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `solution` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `solution` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `solution` | T8 | pass | The checks report no more findings than allowed | — |
| `solution` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `solution` | T10 | pass | The checks report no more findings than allowed | — |
| `correct-1-renamed-ids-tbd` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `correct-1-renamed-ids-tbd` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `correct-1-renamed-ids-tbd` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `correct-1-renamed-ids-tbd` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `correct-1-renamed-ids-tbd` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `correct-1-renamed-ids-tbd` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `correct-1-renamed-ids-tbd` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `correct-1-renamed-ids-tbd` | T8 | pass | The checks report no more findings than allowed | — |
| `correct-1-renamed-ids-tbd` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `correct-1-renamed-ids-tbd` | T10 | pass | The checks report no more findings than allowed | — |
| `correct-2-refines-list-deeper-relationship` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `correct-2-refines-list-deeper-relationship` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `correct-2-refines-list-deeper-relationship` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `correct-2-refines-list-deeper-relationship` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `correct-2-refines-list-deeper-relationship` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `correct-2-refines-list-deeper-relationship` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `correct-2-refines-list-deeper-relationship` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `correct-2-refines-list-deeper-relationship` | T8 | pass | The checks report no more findings than allowed | — |
| `correct-2-refines-list-deeper-relationship` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `correct-2-refines-list-deeper-relationship` | T10 | pass | The checks report no more findings than allowed | — |
| `correct-3-browser-shows-answer` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `correct-3-browser-shows-answer` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `correct-3-browser-shows-answer` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `correct-3-browser-shows-answer` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `correct-3-browser-shows-answer` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `correct-3-browser-shows-answer` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `correct-3-browser-shows-answer` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `correct-3-browser-shows-answer` | T8 | pass | The checks report no more findings than allowed | — |
| `correct-3-browser-shows-answer` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `correct-3-browser-shows-answer` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-1-keyword-stuffed-no-link` | T1 | fail | No responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} yet | Follow the Tray; A Link, Not a Lookalike; Let the Tray Write the Link |
| `wrong-1-keyword-stuffed-no-link` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-1-keyword-stuffed-no-link` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-1-keyword-stuffed-no-link` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-1-keyword-stuffed-no-link` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-1-keyword-stuffed-no-link` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-1-keyword-stuffed-no-link` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-1-keyword-stuffed-no-link` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-1-keyword-stuffed-no-link` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-1-keyword-stuffed-no-link` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-10-web-kind-changed` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-10-web-kind-changed` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-10-web-kind-changed` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-10-web-kind-changed` | T4 | fail | No responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} yet | Follow the Tray; Where It Runs |
| `wrong-10-web-kind-changed` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-10-web-kind-changed` | T6 | fail | Found web#2 matching responsibility {"of":"web","kind":"decide"}, but there should be none | Where the Browser Runs; Two Owners for One Decision |
| `wrong-10-web-kind-changed` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-10-web-kind-changed` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-10-web-kind-changed` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-10-web-kind-changed` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-11-uses-label` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-11-uses-label` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-11-uses-label` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-11-uses-label` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-11-uses-label` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-11-uses-label` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-11-uses-label` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-11-uses-label` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-11-uses-label` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-11-uses-label` | T10 | fail | The checks report 1 warning (at most 0 allowed): c4/vague-relationship on web: 'uses' could label any arrow. A reader cannot tell what Planner Web App asks of Registration API. | Read Every Arrow Aloud; A Verb and a Preposition |
| `wrong-12-relationship-without-technology` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-12-relationship-without-technology` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-12-relationship-without-technology` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-12-relationship-without-technology` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-12-relationship-without-technology` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-12-relationship-without-technology` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-12-relationship-without-technology` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-12-relationship-without-technology` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-12-relationship-without-technology` | T9 | fail | No relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} yet | Who Sends the Plan; How It Travels |
| `wrong-12-relationship-without-technology` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-13-relationship-reversed` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-13-relationship-reversed` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-13-relationship-reversed` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-13-relationship-reversed` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-13-relationship-reversed` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-13-relationship-reversed` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-13-relationship-reversed` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-13-relationship-reversed` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-13-relationship-reversed` | T9 | fail | No relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} yet | Who Sends the Plan; Read It From the Sender |
| `wrong-13-relationship-reversed` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-14-worked-example-unlinked` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-14-worked-example-unlinked` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-14-worked-example-unlinked` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-14-worked-example-unlinked` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-14-worked-example-unlinked` | T5 | fail | No responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} yet | The Worked Example Went Missing; Check the Link |
| `wrong-14-worked-example-unlinked` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-14-worked-example-unlinked` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-14-worked-example-unlinked` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-14-worked-example-unlinked` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-14-worked-example-unlinked` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-15-hold-without-link` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-15-hold-without-link` | T2 | fail | No responsibility {"of":{"type":"container"},"refines":"sys-holds"} yet | Follow the Tray; A Link, Not a Lookalike; Let the Tray Write the Link |
| `wrong-15-hold-without-link` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-15-hold-without-link` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-15-hold-without-link` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-15-hold-without-link` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-15-hold-without-link` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-15-hold-without-link` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-15-hold-without-link` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-15-hold-without-link` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-16-full-section-without-link` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-16-full-section-without-link` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-16-full-section-without-link` | T3 | fail | No responsibility {"of":{"type":"container"},"refines":"sys-full-section"} yet | Follow the Tray; A Link, Not a Lookalike; Let the Tray Write the Link |
| `wrong-16-full-section-without-link` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-16-full-section-without-link` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-16-full-section-without-link` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-16-full-section-without-link` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-16-full-section-without-link` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-16-full-section-without-link` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-16-full-section-without-link` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-17-api-technology-missing` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-17-api-technology-missing` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-17-api-technology-missing` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-17-api-technology-missing` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-17-api-technology-missing` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-17-api-technology-missing` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-17-api-technology-missing` | T7 | fail | api does not satisfy {"technology":"present"} | Containers Name What They Are Built With; Undecided Is Allowed |
| `wrong-17-api-technology-missing` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-17-api-technology-missing` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-17-api-technology-missing` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-18-first-hold-unlinked` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-18-first-hold-unlinked` | T2 | fail | No responsibility {"of":{"type":"container"},"refines":"sys-holds"} yet | Follow the Tray; A Link, Not a Lookalike |
| `wrong-18-first-hold-unlinked` | T3 | fail | No responsibility {"of":{"type":"container"},"refines":"sys-full-section"} yet | Follow the Tray |
| `wrong-18-first-hold-unlinked` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-18-first-hold-unlinked` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-18-first-hold-unlinked` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-18-first-hold-unlinked` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-18-first-hold-unlinked` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-18-first-hold-unlinked` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-18-first-hold-unlinked` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-19-worked-example-renamed-unlinked` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-19-worked-example-renamed-unlinked` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-19-worked-example-renamed-unlinked` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-19-worked-example-renamed-unlinked` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-19-worked-example-renamed-unlinked` | T5 | fail | No responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} yet | The Worked Example Went Missing; Check the Link |
| `wrong-19-worked-example-renamed-unlinked` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-19-worked-example-renamed-unlinked` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-19-worked-example-renamed-unlinked` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-19-worked-example-renamed-unlinked` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-19-worked-example-renamed-unlinked` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-2-browser-decides` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-2-browser-decides` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-2-browser-decides` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-2-browser-decides` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-2-browser-decides` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-2-browser-decides` | T6 | fail | Found web#2 matching responsibility {"of":"web","kind":"decide"}, but there should be none | Where the Browser Runs; Flagging Is Not Deciding |
| `wrong-2-browser-decides` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-2-browser-decides` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-2-browser-decides` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-2-browser-decides` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-20-deleted-example-other-seat-know` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-20-deleted-example-other-seat-know` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-20-deleted-example-other-seat-know` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-20-deleted-example-other-seat-know` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-20-deleted-example-other-seat-know` | T5 | fail | No responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} yet | The Worked Example Went Missing; Restore It |
| `wrong-20-deleted-example-other-seat-know` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-20-deleted-example-other-seat-know` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-20-deleted-example-other-seat-know` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-20-deleted-example-other-seat-know` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-20-deleted-example-other-seat-know` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-21-deleted-example-full-section-says-open` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-21-deleted-example-full-section-says-open` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-21-deleted-example-full-section-says-open` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-21-deleted-example-full-section-says-open` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-21-deleted-example-full-section-says-open` | T5 | fail | No responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} yet | The Worked Example Went Missing; Restore It |
| `wrong-21-deleted-example-full-section-says-open` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-21-deleted-example-full-section-says-open` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-21-deleted-example-full-section-says-open` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-21-deleted-example-full-section-says-open` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-21-deleted-example-full-section-says-open` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-22-drafts-do-unlinked` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-22-drafts-do-unlinked` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-22-drafts-do-unlinked` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-22-drafts-do-unlinked` | T4 | fail | No responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} yet | Follow the Tray; A Link, Not a Lookalike |
| `wrong-22-drafts-do-unlinked` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-22-drafts-do-unlinked` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-22-drafts-do-unlinked` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-22-drafts-do-unlinked` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-22-drafts-do-unlinked` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-22-drafts-do-unlinked` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-23-database-docker` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-23-database-docker` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-23-database-docker` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-23-database-docker` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-23-database-docker` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-23-database-docker` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-23-database-docker` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-23-database-docker` | T8 | fail | The checks report 1 warning (at most 0 allowed): c4/infrastructure-container on db: Docker says where Registration Database runs, not what it is built with. Where it runs belongs in a deployment view. | Built With, Not Run On; Databases Name Their Product |
| `wrong-23-database-docker` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-23-database-docker` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-3-two-owners` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-3-two-owners` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-3-two-owners` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-3-two-owners` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-3-two-owners` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-3-two-owners` | T6 | fail | Found web#2 matching responsibility {"of":"web","kind":"decide"}, but there should be none | Where the Browser Runs; Two Owners for One Decision; Flagging Is Not Deciding |
| `wrong-3-two-owners` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-3-two-owners` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-3-two-owners` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-3-two-owners` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-4-database-decides` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-4-database-decides` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-4-database-decides` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-4-database-decides` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-4-database-decides` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-4-database-decides` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-4-database-decides` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-4-database-decides` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-4-database-decides` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-4-database-decides` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-5-deleted-worked-example` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-5-deleted-worked-example` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-5-deleted-worked-example` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-5-deleted-worked-example` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-5-deleted-worked-example` | T5 | fail | No responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} yet | The Worked Example Went Missing; Restore It |
| `wrong-5-deleted-worked-example` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-5-deleted-worked-example` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-5-deleted-worked-example` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-5-deleted-worked-example` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-5-deleted-worked-example` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-6-missing-technology` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-6-missing-technology` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-6-missing-technology` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-6-missing-technology` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-6-missing-technology` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-6-missing-technology` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-6-missing-technology` | T7 | fail | db does not satisfy {"technology":"present"} | Containers Name What They Are Built With; Data Stores Too |
| `wrong-6-missing-technology` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-6-missing-technology` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-6-missing-technology` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-7-unlinked-browser-decide` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-7-unlinked-browser-decide` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-7-unlinked-browser-decide` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-7-unlinked-browser-decide` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-7-unlinked-browser-decide` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-7-unlinked-browser-decide` | T6 | fail | Found web#2 matching responsibility {"of":"web","kind":"decide"}, but there should be none | Where the Browser Runs; Two Owners for One Decision |
| `wrong-7-unlinked-browser-decide` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-7-unlinked-browser-decide` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-7-unlinked-browser-decide` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-7-unlinked-browser-decide` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-8-drafts-on-the-server` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-8-drafts-on-the-server` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-8-drafts-on-the-server` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-8-drafts-on-the-server` | T4 | fail | No responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} yet | Follow the Tray; Waiting for the Server |
| `wrong-8-drafts-on-the-server` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-8-drafts-on-the-server` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-8-drafts-on-the-server` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-8-drafts-on-the-server` | T8 | pass | The checks report no more findings than allowed | — |
| `wrong-8-drafts-on-the-server` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-8-drafts-on-the-server` | T10 | pass | The checks report no more findings than allowed | — |
| `wrong-9-docker-technology` | T1 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-eligibility"} | — |
| `wrong-9-docker-technology` | T2 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-holds"} | — |
| `wrong-9-docker-technology` | T3 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-full-section"} | — |
| `wrong-9-docker-technology` | T4 | pass | Found responsibility {"of":{"type":"container","kind":"browser_app"},"refines":"sys-drafts"} | — |
| `wrong-9-docker-technology` | T5 | pass | Found responsibility {"of":{"type":"container"},"refines":"sys-open-seats"} | — |
| `wrong-9-docker-technology` | T6 | pass | No responsibility {"of":"web","kind":"decide"} | — |
| `wrong-9-docker-technology` | T7 | pass | Every element matching {"type":"container","in":"registration"} satisfies {"technology":"present"} | — |
| `wrong-9-docker-technology` | T8 | fail | The checks report 1 warning (at most 0 allowed): c4/infrastructure-container on api: Docker says where Registration API runs, not what it is built with. Where it runs belongs in a deployment view. | Built With, Not Run On; Applications Name Their Language |
| `wrong-9-docker-technology` | T9 | pass | Found relationship {"from":"web","to":"api","technology":"present","derived":"exclude"} | — |
| `wrong-9-docker-technology` | T10 | pass | The checks report no more findings than allowed | — |

## Step 6: Inside the Registration API

| Test | Description | Predicate | Role | Spec status |
|---|---|---|---|---|
| T1 | The coordinator refines nothing about the API’s eligibility decision | `{ absent: { responsibility: { of: coordinator, refines: api-eligibility } } }` | guard (passes on the seed) | §8 |
| T2 | The component the coordinator asks for an eligibility decision makes that decision, and no other component does | `{ every: { type: component, has_responsibility: { kind: decide, refines: api-eligibility } }, satisfies: { id: policy } }` | targeted (fails on the seed) | §8 |
| T3 | Exactly one component owns seat holds | `{ count: { element: { type: component, in: api, owns_any: [ seat hold, held seat, seat reservation, reserved seat ] } }, equals: 1 }` | targeted (fails on the seed) | §8 |
| T4 | The component that owns seat holds is the one that writes them to the database | `{ exists: { relationship: { from: { type: component, in: api, owns_any: [ seat hold, held seat, seat reservation, reserved seat ] }, to: db } } }` | targeted (fails on the seed) | §8 |
| T5 | Every responsibility of the Registration API is refined by a component | `{ absent: { responsibility: { of: api, leaf: true } } }` | targeted (fails on the seed) | §8 |
| T6 | Every request names a responsibility that its target, or one of its children, has | `{ checks: { max_errors: 0, rules: [ model/responsibility-owner, model/unknown-reference ] } }` | targeted (fails on the seed) | §8 |

Overview (P = pass, F = fail):

| Model | E/W | T1 | T2 | T3 | T4 | T5 | T6 | Intent |
|---|---|---|---|---|---|---|---|---|
| `seed` | 2/4 | P | F | F | F | F | F | Starter file: fails the criteria the step targets. |
| `solution` | 0/0 | P | P | P | P | P | P | Reference solution: passes every test with 0 errors and 0 warnings. |
| `correct-1-renamed-ids-synonyms` | 0/0 | P | P | P | P | P | P | CORRECT (renamed KNOW ids, reworded promises, owns synonym "held seats"): must pass T1-T6. |
| `correct-2-deeper-relationship-code` | 0/0 | P | P | P | P | P | P | CORRECT (the database relationship declared one level deeper on a code element; Strategy code inside the policy; owns synonym "seat reservations"): must pass T1-T6. |
| `wrong-1-decide-moved-to-coordinator` | 0/0 | F | F | P | P | P | P | WRONG (DECIDE moved to the coordinator, which is no longer locked; the policy only knows): must fail T1 and T2, pass T3-T6. |
| `wrong-10-seat-gateway-also-decides` | 0/0 | P | F | P | P | P | P | WRONG (the Seat Gateway also gets a DECIDE that refines the API's eligibility decision): must fail T2 only; reaches "One Decision, One Owner". |
| `wrong-11-gateway-knows-nothing` | 0/0 | P | P | P | P | F | P | WRONG (partial completion: the Seat Gateway holds seats but has no KNOW yet): must fail T5 only; reaches "What Else Must It Know?", not "Knowledge Needs a Link Too". |
| `wrong-12-gateway-know-unlinked` | 0/0 | P | P | P | P | F | P | WRONG (partial completion: the Seat Gateway's full-section KNOW written without refines): must fail T5 only; reaches "What Else Must It Know?" and "Knowledge Needs a Link Too". |
| `wrong-13-hold-on-coordinator` | 1/0 | P | P | P | P | P | F | WRONG (the quiz case: seats-hold-all moved from the Seat Gateway to the coordinator, the request left as it is): must fail T6 only; reaches "On the Target, Not a Sibling". |
| `wrong-2-keyword-stuffed-seat-gateway` | 0/0 | P | F | P | P | P | P | WRONG (keyword-stuffed: the eligibility DECIDE sits on the Seat Gateway; the policy has the id with an empty promise): must fail T2, pass the rest. |
| `wrong-3-deleted-policy` | 1/0 | P | F | P | P | F | F | WRONG (deleted target: the Enrollment Policy is gone, so the coordinator asks nobody): must fail T2 (unknown element policy), T5, and T6, pass T1, T3, T4. |
| `wrong-4-no-writer-recorded` | 0/0 | P | P | F | F | P | P | WRONG (no component records that it owns seat holds): must fail T3 and T4. |
| `wrong-5-two-writers` | 0/1 | P | P | F | P | P | P | WRONG (two components claim to be the only writer of seat holds): must fail T3. |
| `wrong-6-mismatched-id` | 1/0 | P | P | P | P | P | F | WRONG (the Seat Gateway has seats-hold instead of the requested seats-hold-all): must fail T6. |
| `wrong-7-owner-does-not-write` | 0/0 | P | P | P | F | P | P | WRONG (reviewer counter-model s6-C: the policy claims seat holds while the Seat Gateway writes them): must fail T4 only. |
| `wrong-8-unrefined-hold` | 0/0 | P | P | P | P | F | P | WRONG (reviewer counter-model s6-G: the Seat Gateway's hold refines nothing, so the API's hold is refined by no component): must fail T5 only. |
| `wrong-9-policy-decide-unlinked` | 0/0 | P | F | P | P | F | P | WRONG (partial completion: the Enrollment Policy has the requested DECIDE, but without refines): must fail T2 and T5, pass the rest; reaches "Link It Upward". |

Expected results with reasons:

| Model | Test | Expected | Reason | Hints shown on failure |
|---|---|---|---|---|
| `seed` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `seed` | T2 | fail | No element matches {"type":"component","has_responsibility":{"kind":"decide","refines":"api-eligibility"}} yet, so there is nothing to check | Follow the Request |
| `seed` | T3 | fail | 0 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]}; expected exactly 1 | Who Writes Seat Holds? |
| `seed` | T4 | fail | No relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} yet | Owner and Writer |
| `seed` | T5 | fail | Found api-eligibility, api-open-seats, api-holds, api-full-section matching responsibility {"of":"api","leaf":true}, but there should be none | One Refinement Each |
| `seed` | T6 | fail | The checks report 2 errors (at most 0 allowed): model/unknown-reference on coordinator: There is no responsibility `policy-eligibility`; model/unknown-reference on coordinator: There is no responsibility `seats-hold-all` | Read the Requests |
| `solution` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `solution` | T2 | pass | Every element matching {"type":"component","has_responsibility":{"kind":"decide","refines":"api-eligibility"}} satisfies {"id":"policy"} | — |
| `solution` | T3 | pass | 1 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]} | — |
| `solution` | T4 | pass | Found relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} | — |
| `solution` | T5 | pass | No responsibility {"of":"api","leaf":true} | — |
| `solution` | T6 | pass | The checks report no more findings than allowed | — |
| `correct-1-renamed-ids-synonyms` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `correct-1-renamed-ids-synonyms` | T2 | pass | Every element matching {"type":"component","has_responsibility":{"kind":"decide","refines":"api-eligibility"}} satisfies {"id":"policy"} | — |
| `correct-1-renamed-ids-synonyms` | T3 | pass | 1 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]} | — |
| `correct-1-renamed-ids-synonyms` | T4 | pass | Found relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} | — |
| `correct-1-renamed-ids-synonyms` | T5 | pass | No responsibility {"of":"api","leaf":true} | — |
| `correct-1-renamed-ids-synonyms` | T6 | pass | The checks report no more findings than allowed | — |
| `correct-2-deeper-relationship-code` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `correct-2-deeper-relationship-code` | T2 | pass | Every element matching {"type":"component","has_responsibility":{"kind":"decide","refines":"api-eligibility"}} satisfies {"id":"policy"} | — |
| `correct-2-deeper-relationship-code` | T3 | pass | 1 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]} | — |
| `correct-2-deeper-relationship-code` | T4 | pass | Found relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} | — |
| `correct-2-deeper-relationship-code` | T5 | pass | No responsibility {"of":"api","leaf":true} | — |
| `correct-2-deeper-relationship-code` | T6 | pass | The checks report no more findings than allowed | — |
| `wrong-1-decide-moved-to-coordinator` | T1 | fail | Found coordinator#2 matching responsibility {"of":"coordinator","refines":"api-eligibility"}, but there should be none | Sequencing Is Not Deciding; The Request Already Exists; Asking Is Not Refining |
| `wrong-1-decide-moved-to-coordinator` | T2 | fail | coordinator does not satisfy {"id":"policy"} | Follow the Request |
| `wrong-1-decide-moved-to-coordinator` | T3 | pass | 1 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]} | — |
| `wrong-1-decide-moved-to-coordinator` | T4 | pass | Found relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} | — |
| `wrong-1-decide-moved-to-coordinator` | T5 | pass | No responsibility {"of":"api","leaf":true} | — |
| `wrong-1-decide-moved-to-coordinator` | T6 | pass | The checks report no more findings than allowed | — |
| `wrong-10-seat-gateway-also-decides` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `wrong-10-seat-gateway-also-decides` | T2 | fail | seats does not satisfy {"id":"policy"} | Follow the Request; One Decision, One Owner |
| `wrong-10-seat-gateway-also-decides` | T3 | pass | 1 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]} | — |
| `wrong-10-seat-gateway-also-decides` | T4 | pass | Found relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} | — |
| `wrong-10-seat-gateway-also-decides` | T5 | pass | No responsibility {"of":"api","leaf":true} | — |
| `wrong-10-seat-gateway-also-decides` | T6 | pass | The checks report no more findings than allowed | — |
| `wrong-11-gateway-knows-nothing` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `wrong-11-gateway-knows-nothing` | T2 | pass | Every element matching {"type":"component","has_responsibility":{"kind":"decide","refines":"api-eligibility"}} satisfies {"id":"policy"} | — |
| `wrong-11-gateway-knows-nothing` | T3 | pass | 1 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]} | — |
| `wrong-11-gateway-knows-nothing` | T4 | pass | Found relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} | — |
| `wrong-11-gateway-knows-nothing` | T5 | fail | Found api-open-seats, api-full-section matching responsibility {"of":"api","leaf":true}, but there should be none | One Refinement Each; What Else Must It Know? |
| `wrong-11-gateway-knows-nothing` | T6 | pass | The checks report no more findings than allowed | — |
| `wrong-12-gateway-know-unlinked` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `wrong-12-gateway-know-unlinked` | T2 | pass | Every element matching {"type":"component","has_responsibility":{"kind":"decide","refines":"api-eligibility"}} satisfies {"id":"policy"} | — |
| `wrong-12-gateway-know-unlinked` | T3 | pass | 1 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]} | — |
| `wrong-12-gateway-know-unlinked` | T4 | pass | Found relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} | — |
| `wrong-12-gateway-know-unlinked` | T5 | fail | Found api-full-section matching responsibility {"of":"api","leaf":true}, but there should be none | One Refinement Each; What Else Must It Know?; Knowledge Needs a Link Too |
| `wrong-12-gateway-know-unlinked` | T6 | pass | The checks report no more findings than allowed | — |
| `wrong-13-hold-on-coordinator` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `wrong-13-hold-on-coordinator` | T2 | pass | Every element matching {"type":"component","has_responsibility":{"kind":"decide","refines":"api-eligibility"}} satisfies {"id":"policy"} | — |
| `wrong-13-hold-on-coordinator` | T3 | pass | 1 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]} | — |
| `wrong-13-hold-on-coordinator` | T4 | pass | Found relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} | — |
| `wrong-13-hold-on-coordinator` | T5 | pass | No responsibility {"of":"api","leaf":true} | — |
| `wrong-13-hold-on-coordinator` | T6 | fail | The checks report 1 error (at most 0 allowed): model/responsibility-owner on coordinator: `seats-hold-all` belongs to component `coordinator`, which is neither `seats`, a part of it, nor an element that contains `seats` but not `coordinator`; a collaborator asks its target for help the target provides | Read the Requests; The Id Must Match; On the Target, Not a Sibling |
| `wrong-2-keyword-stuffed-seat-gateway` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `wrong-2-keyword-stuffed-seat-gateway` | T2 | fail | seats does not satisfy {"id":"policy"} | Follow the Request |
| `wrong-2-keyword-stuffed-seat-gateway` | T3 | pass | 1 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]} | — |
| `wrong-2-keyword-stuffed-seat-gateway` | T4 | pass | Found relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} | — |
| `wrong-2-keyword-stuffed-seat-gateway` | T5 | pass | No responsibility {"of":"api","leaf":true} | — |
| `wrong-2-keyword-stuffed-seat-gateway` | T6 | pass | The checks report no more findings than allowed | — |
| `wrong-3-deleted-policy` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `wrong-3-deleted-policy` | T2 | fail | unknown element policy | Follow the Request; The Policy Is Gone |
| `wrong-3-deleted-policy` | T3 | pass | 1 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]} | — |
| `wrong-3-deleted-policy` | T4 | pass | Found relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} | — |
| `wrong-3-deleted-policy` | T5 | fail | Found api-eligibility matching responsibility {"of":"api","leaf":true}, but there should be none | One Refinement Each |
| `wrong-3-deleted-policy` | T6 | fail | The checks report 1 error (at most 0 allowed): model/unknown-reference on coordinator: There is no element `policy` | Read the Requests |
| `wrong-4-no-writer-recorded` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `wrong-4-no-writer-recorded` | T2 | pass | Every element matching {"type":"component","has_responsibility":{"kind":"decide","refines":"api-eligibility"}} satisfies {"id":"policy"} | — |
| `wrong-4-no-writer-recorded` | T3 | fail | 0 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]}; expected exactly 1 | Who Writes Seat Holds?; The Same Fact at Both Levels |
| `wrong-4-no-writer-recorded` | T4 | fail | No relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} yet | Owner and Writer; Claim and Relationship Together |
| `wrong-4-no-writer-recorded` | T5 | pass | No responsibility {"of":"api","leaf":true} | — |
| `wrong-4-no-writer-recorded` | T6 | pass | The checks report no more findings than allowed | — |
| `wrong-5-two-writers` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `wrong-5-two-writers` | T2 | pass | Every element matching {"type":"component","has_responsibility":{"kind":"decide","refines":"api-eligibility"}} satisfies {"id":"policy"} | — |
| `wrong-5-two-writers` | T3 | fail | 2 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]}; expected exactly 1 | Who Writes Seat Holds?; Only One Writer; The Same Fact at Both Levels |
| `wrong-5-two-writers` | T4 | pass | Found relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} | — |
| `wrong-5-two-writers` | T5 | pass | No responsibility {"of":"api","leaf":true} | — |
| `wrong-5-two-writers` | T6 | pass | The checks report no more findings than allowed | — |
| `wrong-6-mismatched-id` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `wrong-6-mismatched-id` | T2 | pass | Every element matching {"type":"component","has_responsibility":{"kind":"decide","refines":"api-eligibility"}} satisfies {"id":"policy"} | — |
| `wrong-6-mismatched-id` | T3 | pass | 1 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]} | — |
| `wrong-6-mismatched-id` | T4 | pass | Found relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} | — |
| `wrong-6-mismatched-id` | T5 | pass | No responsibility {"of":"api","leaf":true} | — |
| `wrong-6-mismatched-id` | T6 | fail | The checks report 1 error (at most 0 allowed): model/unknown-reference on coordinator: There is no responsibility `seats-hold-all` | Read the Requests; The Id Must Match |
| `wrong-7-owner-does-not-write` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `wrong-7-owner-does-not-write` | T2 | pass | Every element matching {"type":"component","has_responsibility":{"kind":"decide","refines":"api-eligibility"}} satisfies {"id":"policy"} | — |
| `wrong-7-owner-does-not-write` | T3 | pass | 1 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]} | — |
| `wrong-7-owner-does-not-write` | T4 | fail | No relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} yet | Owner and Writer; A Claim Without a Write; Claim and Relationship Together |
| `wrong-7-owner-does-not-write` | T5 | pass | No responsibility {"of":"api","leaf":true} | — |
| `wrong-7-owner-does-not-write` | T6 | pass | The checks report no more findings than allowed | — |
| `wrong-8-unrefined-hold` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `wrong-8-unrefined-hold` | T2 | pass | Every element matching {"type":"component","has_responsibility":{"kind":"decide","refines":"api-eligibility"}} satisfies {"id":"policy"} | — |
| `wrong-8-unrefined-hold` | T3 | pass | 1 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]} | — |
| `wrong-8-unrefined-hold` | T4 | pass | Found relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} | — |
| `wrong-8-unrefined-hold` | T5 | fail | Found api-holds matching responsibility {"of":"api","leaf":true}, but there should be none | One Refinement Each |
| `wrong-8-unrefined-hold` | T6 | pass | The checks report no more findings than allowed | — |
| `wrong-9-policy-decide-unlinked` | T1 | pass | No responsibility {"of":"coordinator","refines":"api-eligibility"} | — |
| `wrong-9-policy-decide-unlinked` | T2 | fail | No element matches {"type":"component","has_responsibility":{"kind":"decide","refines":"api-eligibility"}} yet, so there is nothing to check | Follow the Request; Link It Upward |
| `wrong-9-policy-decide-unlinked` | T3 | pass | 1 match element {"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]} | — |
| `wrong-9-policy-decide-unlinked` | T4 | pass | Found relationship {"from":{"type":"component","in":"api","owns_any":["seat hold","held seat","seat reservation","reserved seat"]},"to":"db"} | — |
| `wrong-9-policy-decide-unlinked` | T5 | fail | Found api-eligibility matching responsibility {"of":"api","leaf":true}, but there should be none | One Refinement Each |
| `wrong-9-policy-decide-unlinked` | T6 | pass | The checks report no more findings than allowed | — |

## Step 7: Change Impact Across Control Styles

| Test | Description | Predicate | Role | Spec status |
|---|---|---|---|---|
| T1 | The new eligibility rule is a DECIDE that refines the API's eligibility decision | `{ count: { responsibility: { of: policy, kind: decide, refines: api-eligibility } }, at_least: 2 }` | targeted (fails on the seed) | §8 |
| T2 | The coordinator is unchanged since the step began | `{ same_as_seed: { id: coordinator } }` | guard (passes on the seed) | §8 |
| T3 | The Enrollment API is unchanged since the step began | `{ same_as_seed: { interface: { id: enrollment-api } } }` | guard (passes on the seed) | §8 (interface predicate) |

Overview (P = pass, F = fail):

| Model | E/W | T1 | T2 | T3 | Intent |
|---|---|---|---|---|---|
| `seed` | 0/0 | F | P | P | Starter file: fails the criteria the step targets. |
| `solution` | 0/0 | P | P | P | Reference solution: passes every test with 0 errors and 0 warnings. |
| `correct-1-reworded-with-id` | 0/0 | P | P | P | CORRECT (reworded cap rule with its own id; reworded KNOW): must pass T1-T3. |
| `correct-2-with-code` | 0/0 | P | P | P | CORRECT (the same change plus Strategy code inside the policy, one rule class per eligibility rule): must pass T1-T3. |
| `wrong-1-decide-moved-to-coordinator` | 0/0 | F | F | P | WRONG (DECIDE moved to the coordinator: design A's shape): must fail T1 and T2, pass T3. |
| `wrong-2-keyword-stuffed-seat-gateway` | 0/0 | F | P | P | WRONG (keyword-stuffed: the cap rule written on the Seat Gateway): must fail T1, pass T2 and T3. |
| `wrong-3-unlinked-rule` | 0/0 | F | P | P | WRONG (the cap rule is in the policy but refines nothing): must fail T1, pass T2 and T3. |
| `wrong-4-coordinator-also-asks` | 0/0 | P | F | P | WRONG (right rule in the policy, but the coordinator gains a second request for caps): must pass T1 and T3, fail T2. |
| `wrong-5-deleted-policy` | 1/0 | F | P | P | WRONG (deleted target: the Enrollment Policy is gone): must fail T1 (unknown element policy), pass T2 and T3. |
| `wrong-6-cap-folded-into-existing-rule` | 0/0 | F | P | P | WRONG (the cap folded into the wording of the existing DECIDE, so it has no rule of its own): must fail T1, pass T2 and T3. |
| `wrong-7-outcome-field-added` | 0/0 | P | P | F | WRONG (right rule in the policy, plus a new optional outcome field for the cap: compatible, but the description clients read changed): must pass T1 and T2, fail T3. |
| `wrong-8-reason-codes-new-version` | 0/0 | P | P | F | WRONG (right rule in the policy, plus reason codes in a version 2 outcome: a legitimate design, but every client changes): must pass T1 and T2, fail T3. |
| `wrong-9-interface-moved-to-coordinator` | 3/0 | P | F | F | WRONG (right rule in the policy, but the Enrollment API moved onto the coordinator, which the web app calls; its operation now realizes an ancestor's responsibilities, three model/realizes-owner errors): must pass T1, fail T2 and T3. |

Expected results with reasons:

| Model | Test | Expected | Reason | Hints shown on failure |
|---|---|---|---|---|
| `seed` | T1 | fail | 1 match responsibility {"of":"policy","kind":"decide","refines":"api-eligibility"}; expected at least 2 | Where Eligibility Rules Live |
| `seed` | T2 | pass | Unchanged from the starting design | — |
| `seed` | T3 | pass | Unchanged from the starting design | — |
| `solution` | T1 | pass | 2 match responsibility {"of":"policy","kind":"decide","refines":"api-eligibility"} | — |
| `solution` | T2 | pass | Unchanged from the starting design | — |
| `solution` | T3 | pass | Unchanged from the starting design | — |
| `correct-1-reworded-with-id` | T1 | pass | 2 match responsibility {"of":"policy","kind":"decide","refines":"api-eligibility"} | — |
| `correct-1-reworded-with-id` | T2 | pass | Unchanged from the starting design | — |
| `correct-1-reworded-with-id` | T3 | pass | Unchanged from the starting design | — |
| `correct-2-with-code` | T1 | pass | 2 match responsibility {"of":"policy","kind":"decide","refines":"api-eligibility"} | — |
| `correct-2-with-code` | T2 | pass | Unchanged from the starting design | — |
| `correct-2-with-code` | T3 | pass | Unchanged from the starting design | — |
| `wrong-1-decide-moved-to-coordinator` | T1 | fail | 1 match responsibility {"of":"policy","kind":"decide","refines":"api-eligibility"}; expected at least 2 | Where Eligibility Rules Live; Design A’s Shape |
| `wrong-1-decide-moved-to-coordinator` | T2 | fail | coordinator was changed; it should stay as it was | Prediction Meets Reality; Ask, Do Not Decide |
| `wrong-1-decide-moved-to-coordinator` | T3 | pass | Unchanged from the starting design | — |
| `wrong-2-keyword-stuffed-seat-gateway` | T1 | fail | 1 match responsibility {"of":"policy","kind":"decide","refines":"api-eligibility"}; expected at least 2 | Where Eligibility Rules Live |
| `wrong-2-keyword-stuffed-seat-gateway` | T2 | pass | Unchanged from the starting design | — |
| `wrong-2-keyword-stuffed-seat-gateway` | T3 | pass | Unchanged from the starting design | — |
| `wrong-3-unlinked-rule` | T1 | fail | 1 match responsibility {"of":"policy","kind":"decide","refines":"api-eligibility"}; expected at least 2 | Where Eligibility Rules Live; Knowing Is Not Applying; Link the New Rule |
| `wrong-3-unlinked-rule` | T2 | pass | Unchanged from the starting design | — |
| `wrong-3-unlinked-rule` | T3 | pass | Unchanged from the starting design | — |
| `wrong-4-coordinator-also-asks` | T1 | pass | 2 match responsibility {"of":"policy","kind":"decide","refines":"api-eligibility"} | — |
| `wrong-4-coordinator-also-asks` | T2 | fail | coordinator was changed; it should stay as it was | Prediction Meets Reality; A New Request |
| `wrong-4-coordinator-also-asks` | T3 | pass | Unchanged from the starting design | — |
| `wrong-5-deleted-policy` | T1 | fail | unknown element policy | Where Eligibility Rules Live; The Policy Is Gone |
| `wrong-5-deleted-policy` | T2 | pass | Unchanged from the starting design | — |
| `wrong-5-deleted-policy` | T3 | pass | Unchanged from the starting design | — |
| `wrong-6-cap-folded-into-existing-rule` | T1 | fail | 1 match responsibility {"of":"policy","kind":"decide","refines":"api-eligibility"}; expected at least 2 | Where Eligibility Rules Live |
| `wrong-6-cap-folded-into-existing-rule` | T2 | pass | Unchanged from the starting design | — |
| `wrong-6-cap-folded-into-existing-rule` | T3 | pass | Unchanged from the starting design | — |
| `wrong-7-outcome-field-added` | T1 | pass | 2 match responsibility {"of":"policy","kind":"decide","refines":"api-eligibility"} | — |
| `wrong-7-outcome-field-added` | T2 | pass | Unchanged from the starting design | — |
| `wrong-7-outcome-field-added` | T3 | fail | enrollment-api was changed; it should stay as it was | What Clients Already Read; A Change Every Client Reads |
| `wrong-8-reason-codes-new-version` | T1 | pass | 2 match responsibility {"of":"policy","kind":"decide","refines":"api-eligibility"} | — |
| `wrong-8-reason-codes-new-version` | T2 | pass | Unchanged from the starting design | — |
| `wrong-8-reason-codes-new-version` | T3 | fail | enrollment-api was changed; it should stay as it was | What Clients Already Read; A Change Every Client Reads |
| `wrong-9-interface-moved-to-coordinator` | T1 | pass | 2 match responsibility {"of":"policy","kind":"decide","refines":"api-eligibility"} | — |
| `wrong-9-interface-moved-to-coordinator` | T2 | fail | coordinator was changed; it should stay as it was | Prediction Meets Reality |
| `wrong-9-interface-moved-to-coordinator` | T3 | fail | enrollment-api moved from api to coordinator; it should stay as it was | What Clients Already Read; Same Interface, Same Place |

## Step 8: A Failed Seat Hold

| Test | Description | Predicate | Role | Spec status |
|---|---|---|---|---|
| T1 | Every scenario step follows a relationship or answers an earlier request | `{ checks: { max_errors: 0, rules: [ xlevel/scenario-step ] } }` | guard (passes on the seed) | §8 |
| T2 | The happy path keeps its participants | `{ view: { view: dynamic enroll, shows: [ web, coordinator, policy, seats, billing-gateway ] } }` | guard (passes on the seed) | §8 |
| T3 | Failure branch: the Planner Web App learns which section was full, without a new relationship | `{ exists: { step: { scenario: enroll, from: coordinator, to: web, in_fragment: alt, reply: true } } }` | targeted (fails on the seed) | §8 (step query) |
| T4 | Tuition is requested only inside a branch | `{ exists: { step: { scenario: enroll, from: coordinator, to: billing-gateway, in_fragment: alt } } }` | targeted (fails on the seed) | §8 (step query) |

Overview (P = pass, F = fail):

| Model | E/W | T1 | T2 | T3 | T4 | Intent |
|---|---|---|---|---|---|---|
| `seed` | 0/0 | P | P | F | F | Starter file: fails the criteria the step targets. |
| `solution` | 0/0 | P | P | P | P | Reference solution: passes every test with 0 errors and 0 warnings. |
| `correct-1-direct-reply` | 0/0 | P | P | P | P | CORRECT (the coordinator replies to the web app directly; reworded conditions): must pass T1-T4. |
| `correct-2-map-form-nested` | 0/0 | P | P | P | P | CORRECT (map-form steps; the seat branch nested inside an eligibility branch with its own refusal reply; needs per-branch reply bookkeeping, spec §6.3): must pass T1-T4. |
| `correct-3-canvas-two-replies` | 0/0 | P | P | P | P | CORRECT (made on the canvas of dynamic enroll: the billing step wrapped in an alt, and two replies drawn in its second branch through the step form): must pass T1-T4. |
| `wrong-1-teammate-draft` | 1/0 | F | P | F | P | WRONG (the teammate's draft: the Seat Gateway reports straight to the web app): must fail T1 and T3, pass T2 and T4. |
| `wrong-2-shortcut-relationship` | 0/0 | P | P | F | P | WRONG (the draft plus a new Seat Gateway to web app relationship that silences the step check): must pass T1, T2, T4, fail T3. |
| `wrong-3-billing-dropped-report-in-opt` | 0/0 | P | F | F | F | WRONG (deleted target: the billing step was dropped, and the report sits in an opt instead of an alt branch): must pass T1, fail T2, T3, and T4. |
| `wrong-4-emptied-scenario` | 0/1 | P | F | F | F | WRONG (the scenario emptied, so no step can be invalid): must pass T1, fail T2, T3, and T4; shows why T2 guards T1. |
| `wrong-5-unconditional-report` | 0/0 | P | P | F | F | WRONG (reviewer counter-model s8-D: the report appended at top level, with no alt and billing still unconditional): must pass T1 and T2, fail T3 and T4. |
| `wrong-6-report-in-success-branch` | 0/0 | P | P | P | P | WRONG DESIGN THAT PASSES (the report sits in the success branch, beside billing): must pass T1-T4; the checks cannot tell branches apart, so only the reviewer catches it. |
| `wrong-7-declared-callback` | 0/0 | P | P | F | P | WRONG (a new relationship lets the coordinator call the web app, so the report is a forward step, not a reply): must pass T1, T2, T4, fail T3. |
| `wrong-8-reply-then-report-to-web` | 1/0 | F | P | F | P | WRONG (partial repair: the gateway now replies to the coordinator, but the report to the student still goes from the gateway): must fail T1 and T3, pass T2 and T4; reaches "The Shape of a Reply". |
| `wrong-9-alt-without-billing-branch` | 0/0 | P | P | P | F | WRONG (partial repair: the alt holds only the failure branch, and billing still runs after it at top level): must fail T4 only; reaches "Move It Into a Branch". |

Expected results with reasons:

| Model | Test | Expected | Reason | Hints shown on failure |
|---|---|---|---|---|
| `seed` | T1 | pass | The checks report no more findings than allowed | — |
| `seed` | T2 | pass | The view dynamic enroll is as required | — |
| `seed` | T3 | fail | No step {"scenario":"enroll","from":"coordinator","to":"web","in_fragment":"alt","reply":true} yet | The Student Must Find Out |
| `seed` | T4 | fail | No step {"scenario":"enroll","from":"coordinator","to":"billing-gateway","in_fragment":"alt"} yet | No Seat, No Tuition |
| `solution` | T1 | pass | The checks report no more findings than allowed | — |
| `solution` | T2 | pass | The view dynamic enroll is as required | — |
| `solution` | T3 | pass | Found step {"scenario":"enroll","from":"coordinator","to":"web","in_fragment":"alt","reply":true} | — |
| `solution` | T4 | pass | Found step {"scenario":"enroll","from":"coordinator","to":"billing-gateway","in_fragment":"alt"} | — |
| `correct-1-direct-reply` | T1 | pass | The checks report no more findings than allowed | — |
| `correct-1-direct-reply` | T2 | pass | The view dynamic enroll is as required | — |
| `correct-1-direct-reply` | T3 | pass | Found step {"scenario":"enroll","from":"coordinator","to":"web","in_fragment":"alt","reply":true} | — |
| `correct-1-direct-reply` | T4 | pass | Found step {"scenario":"enroll","from":"coordinator","to":"billing-gateway","in_fragment":"alt"} | — |
| `correct-2-map-form-nested` | T1 | pass | The checks report no more findings than allowed | — |
| `correct-2-map-form-nested` | T2 | pass | The view dynamic enroll is as required | — |
| `correct-2-map-form-nested` | T3 | pass | Found step {"scenario":"enroll","from":"coordinator","to":"web","in_fragment":"alt","reply":true} | — |
| `correct-2-map-form-nested` | T4 | pass | Found step {"scenario":"enroll","from":"coordinator","to":"billing-gateway","in_fragment":"alt"} | — |
| `correct-3-canvas-two-replies` | T1 | pass | The checks report no more findings than allowed | — |
| `correct-3-canvas-two-replies` | T2 | pass | The view dynamic enroll is as required | — |
| `correct-3-canvas-two-replies` | T3 | pass | Found step {"scenario":"enroll","from":"coordinator","to":"web","in_fragment":"alt","reply":true} | — |
| `correct-3-canvas-two-replies` | T4 | pass | Found step {"scenario":"enroll","from":"coordinator","to":"billing-gateway","in_fragment":"alt"} | — |
| `wrong-1-teammate-draft` | T1 | fail | The checks report 1 error (at most 0 allowed): xlevel/scenario-step on seats: Step 5, Seat Gateway to Planner Web App, follows no relationship in the model and answers no earlier request. A scenario can only use collaborations the design has. | Steps Ride on Relationships; Neither Relationship Nor Request |
| `wrong-1-teammate-draft` | T2 | pass | The view dynamic enroll is as required | — |
| `wrong-1-teammate-draft` | T3 | fail | No step {"scenario":"enroll","from":"coordinator","to":"web","in_fragment":"alt","reply":true} yet | The Student Must Find Out |
| `wrong-1-teammate-draft` | T4 | pass | Found step {"scenario":"enroll","from":"coordinator","to":"billing-gateway","in_fragment":"alt"} | — |
| `wrong-2-shortcut-relationship` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-2-shortcut-relationship` | T2 | pass | The view dynamic enroll is as required | — |
| `wrong-2-shortcut-relationship` | T3 | fail | No step {"scenario":"enroll","from":"coordinator","to":"web","in_fragment":"alt","reply":true} yet | The Student Must Find Out; A Shortcut Is Not a Repair |
| `wrong-2-shortcut-relationship` | T4 | pass | Found step {"scenario":"enroll","from":"coordinator","to":"billing-gateway","in_fragment":"alt"} | — |
| `wrong-3-billing-dropped-report-in-opt` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-3-billing-dropped-report-in-opt` | T2 | fail | The view dynamic enroll does not show billing-gateway | Keep the Happy Path; Find the Missing Participant; Fragments Hold Steps |
| `wrong-3-billing-dropped-report-in-opt` | T3 | fail | No step {"scenario":"enroll","from":"coordinator","to":"web","in_fragment":"alt","reply":true} yet | The Student Must Find Out; Only When a Section Is Full |
| `wrong-3-billing-dropped-report-in-opt` | T4 | fail | No step {"scenario":"enroll","from":"coordinator","to":"billing-gateway","in_fragment":"alt"} yet | No Seat, No Tuition; Keep the Billing Step |
| `wrong-4-emptied-scenario` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-4-emptied-scenario` | T2 | fail | The view dynamic enroll does not show web | Keep the Happy Path; Fragments Hold Steps |
| `wrong-4-emptied-scenario` | T3 | fail | No step {"scenario":"enroll","from":"coordinator","to":"web","in_fragment":"alt","reply":true} yet | The Student Must Find Out |
| `wrong-4-emptied-scenario` | T4 | fail | No step {"scenario":"enroll","from":"coordinator","to":"billing-gateway","in_fragment":"alt"} yet | No Seat, No Tuition; Keep the Billing Step |
| `wrong-5-unconditional-report` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-5-unconditional-report` | T2 | pass | The view dynamic enroll is as required | — |
| `wrong-5-unconditional-report` | T3 | fail | No step {"scenario":"enroll","from":"coordinator","to":"web","in_fragment":"alt","reply":true} yet | The Student Must Find Out; Only When a Section Is Full |
| `wrong-5-unconditional-report` | T4 | fail | No step {"scenario":"enroll","from":"coordinator","to":"billing-gateway","in_fragment":"alt"} yet | No Seat, No Tuition |
| `wrong-6-report-in-success-branch` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-6-report-in-success-branch` | T2 | pass | The view dynamic enroll is as required | — |
| `wrong-6-report-in-success-branch` | T3 | pass | Found step {"scenario":"enroll","from":"coordinator","to":"web","in_fragment":"alt","reply":true} | — |
| `wrong-6-report-in-success-branch` | T4 | pass | Found step {"scenario":"enroll","from":"coordinator","to":"billing-gateway","in_fragment":"alt"} | — |
| `wrong-7-declared-callback` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-7-declared-callback` | T2 | pass | The view dynamic enroll is as required | — |
| `wrong-7-declared-callback` | T3 | fail | No step {"scenario":"enroll","from":"coordinator","to":"web","in_fragment":"alt","reply":true} yet | The Student Must Find Out; Only When a Section Is Full; Answer the Request |
| `wrong-7-declared-callback` | T4 | pass | Found step {"scenario":"enroll","from":"coordinator","to":"billing-gateway","in_fragment":"alt"} | — |
| `wrong-8-reply-then-report-to-web` | T1 | fail | The checks report 1 error (at most 0 allowed): xlevel/scenario-step on seats: Step 6, Seat Gateway to Planner Web App, follows no relationship in the model and answers no earlier request. A scenario can only use collaborations the design has. | Steps Ride on Relationships; Neither Relationship Nor Request; The Shape of a Reply |
| `wrong-8-reply-then-report-to-web` | T2 | pass | The view dynamic enroll is as required | — |
| `wrong-8-reply-then-report-to-web` | T3 | fail | No step {"scenario":"enroll","from":"coordinator","to":"web","in_fragment":"alt","reply":true} yet | The Student Must Find Out; Answer the Request |
| `wrong-8-reply-then-report-to-web` | T4 | pass | Found step {"scenario":"enroll","from":"coordinator","to":"billing-gateway","in_fragment":"alt"} | — |
| `wrong-9-alt-without-billing-branch` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-9-alt-without-billing-branch` | T2 | pass | The view dynamic enroll is as required | — |
| `wrong-9-alt-without-billing-branch` | T3 | pass | Found step {"scenario":"enroll","from":"coordinator","to":"web","in_fragment":"alt","reply":true} | — |
| `wrong-9-alt-without-billing-branch` | T4 | fail | No step {"scenario":"enroll","from":"coordinator","to":"billing-gateway","in_fragment":"alt"} yet | No Seat, No Tuition; Move It Into a Branch |

## Step 9: Transfer: Makerspace Equipment Loans

| Test | Description | Predicate | Role | Spec status |
|---|---|---|---|---|
| T1 | The model has no errors | `{ checks: { max_errors: 0 } }` | guard (passes on the seed) | §8 |
| T2 | Every requirement is traced to a responsibility | `{ checks: { max_warnings: 0, rules: [ rdd/uncovered-requirement ] } }` | targeted (fails on the seed) | §8 |

Overview (P = pass, F = fail):

| Model | E/W | T1 | T2 | Intent |
|---|---|---|---|---|
| `seed` | 0/0 | P | F | Starter file: fails the criteria the step targets. |
| `solution` | 0/0 | P | P | Reference solution: passes every test with 0 errors and 0 warnings. |
| `reference-b` | 0/0 | P | P | Reference design 2 (kept only in the solution explanation): passes every test. |
| `correct-1-renamed-reference-b` | 0/0 | P | P | CORRECT (reference design 2 with renamed ids): must pass T1 and T2. |
| `correct-2-components-split-traces` | 0/0 | P | P | CORRECT (traces split across two DO responsibilities; relationships declared one level deeper on components of the Loans API): must pass T1 and T2. |
| `wrong-1-person-responsibilities` | 1/0 | F | P | WRONG (responsibilities on a person): must fail T1 (schema/misplaced-field), pass T2. |
| `wrong-2-sibling-refines` | 1/0 | F | P | WRONG (the Desk App refines a responsibility of its sibling, the Loans API): must fail T1 (model/refines-not-ancestor), pass T2. |
| `wrong-3-ms3-untraced` | 0/0 | P | F | WRONG (no responsibility traces MS-3, in map form): must pass T1, fail T2. |
| `wrong-4-traces-on-external-system` | 0/1 | P | P | WRONG DESIGN THAT PASSES (keyword-stuffed: every trace sits on the external Card System): must pass T1 and T2; only the rubric's scope question catches it. |
| `wrong-5-unknown-view-selector` | 1/0 | F | P | WRONG (a saved view names a system that does not exist): must fail T1 (view/unknown-selector), pass T2. |
| `wrong-6-requirements-emptied` | 0/1 | P | P | WRONG BUT UNREACHABLE (requirements emptied, one untraced responsibility): passes T1 and T2; locked_fields: [requirements] binds the YAML surface too (spec §11), so the runtime reverts this edit. |

Expected results with reasons:

| Model | Test | Expected | Reason | Hints shown on failure |
|---|---|---|---|---|
| `seed` | T1 | pass | The checks report no more findings than allowed | — |
| `seed` | T2 | fail | The checks report 3 warnings (at most 0 allowed): rdd/uncovered-requirement: No responsibility traces to the requirement MS-1.; rdd/uncovered-requirement: No responsibility traces to the requirement MS-2.; rdd/uncovered-requirement: No responsibility traces to the requirement MS-3. | Every Requirement Has a Home |
| `solution` | T1 | pass | The checks report no more findings than allowed | — |
| `solution` | T2 | pass | The checks report no more findings than allowed | — |
| `reference-b` | T1 | pass | The checks report no more findings than allowed | — |
| `reference-b` | T2 | pass | The checks report no more findings than allowed | — |
| `correct-1-renamed-reference-b` | T1 | pass | The checks report no more findings than allowed | — |
| `correct-1-renamed-reference-b` | T2 | pass | The checks report no more findings than allowed | — |
| `correct-2-components-split-traces` | T1 | pass | The checks report no more findings than allowed | — |
| `correct-2-components-split-traces` | T2 | pass | The checks report no more findings than allowed | — |
| `wrong-1-person-responsibilities` | T1 | fail | The checks report 1 error (at most 0 allowed): schema/misplaced-field on member: `responsibilities` is not allowed on person `member`: a person is an actor, not a design participant; put the person's goal in `description` | Read the Diagnostics |
| `wrong-1-person-responsibilities` | T2 | pass | The checks report no more findings than allowed | — |
| `wrong-2-sibling-refines` | T1 | fail | The checks report 1 error (at most 0 allowed): model/refines-not-ancestor on desk: `api-may-borrow` belongs to container `api`, which does not contain `desk`; a responsibility can only refine one of an enclosing element | Read the Diagnostics; Refinement Points Up |
| `wrong-2-sibling-refines` | T2 | pass | The checks report no more findings than allowed | — |
| `wrong-3-ms3-untraced` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-3-ms3-untraced` | T2 | fail | The checks report 1 warning (at most 0 allowed): rdd/uncovered-requirement: No responsibility traces to the requirement MS-3. | Every Requirement Has a Home; Map Form Carries Traces; Every Part Needs a Trace |
| `wrong-4-traces-on-external-system` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-4-traces-on-external-system` | T2 | pass | The checks report no more findings than allowed | — |
| `wrong-5-unknown-view-selector` | T1 | fail | The checks report 1 error (at most 0 allowed): view/unknown-selector: The view for-developer cannot be drawn. There is no element named makerspace | Read the Diagnostics; A Saved View Names Nothing |
| `wrong-5-unknown-view-selector` | T2 | pass | The checks report no more findings than allowed | — |
| `wrong-6-requirements-emptied` | T1 | pass | The checks report no more findings than allowed | — |
| `wrong-6-requirements-emptied` | T2 | pass | The checks report no more findings than allowed | — |
