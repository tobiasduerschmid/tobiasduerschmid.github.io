# Python item review

Scope: every original Python quiz and flashcard plus the six shared Python output questions. Teaching authority is the supplied handouts/homework. The Essential Python appendix explicitly excluded from assessment is not used as sole evidence.

Removed dependency on slicing, cyclic copying and deepcopy memoization; reduced duplicated practice and added missing base initialization/duck typing. Kept core reference/copy traces.

| Original item | Decision | Teaching / practice evidence |
| --- | --- | --- |
| `cs131-v2-python-two-parameters-one-list` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-v2-python-old-row-still-reachable` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-v2-python-shallow-copy-slot-versus-child` | Retained: source-aligned retrieval/application. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `cs131-v2-python-deep-copy-before-later-edit` | Retained: source-aligned retrieval/application. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `cs131-v2-python-returned-alias-after-field-change` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-v2-python-edits-through-two-paths` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-v2-python-class-counter-instance-stamp` | Revised: typed output replaces recognition of a keyed trace; preserves taught objective and worked explanation. | Essential Python handout pp. 6–7 (class fields versus instance fields); Quiz 1 Problem 2A (object-state tracing). |
| `cs131-v2-python-custom-equality-projection` | Revised: typed output replaces recognition of a keyed trace; preserves taught objective and worked explanation. | Essential Python handout pp. 11–13 (equality versus identity); Homework PYTHON5 (object reasoning). |
| `cs131-v2-python-inherited-method-calls-hook` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 14–16 (inheritance); Homework PYTHON5 A–B. |
| `cs131-v2-python-constructor-copy-reference` | Revised: replace implausible constructor-rerun/automatic-refresh distractors with copy versus variable-alias confusions. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `cs131-v2-python-copy-contract-checks` | Retained: source-aligned retrieval/application. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `cs131-v2-python-mutated-argument-and-returned-copy` | Retained: source-aligned retrieval/application. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `cs131-v2-python-build-detached-row-edit` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-v2-python-build-mutate-then-detach` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-v2-python-repair-nested-copy` | Retained: source-aligned retrieval/application. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `cs131-v2-python-return-reference-before-rebind` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-python-holder-rebinding` | Revised: typed output replaces recognition of a keyed trace; preserves taught objective and worked explanation. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-python-slice-write` | Replaced by cs131-python-string-rebinding: slice assignment is not established in supplied teaching; practice immutable rebinding instead. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-python-comprehension-shares-row` | Revised as cs131-python-shared-versus-new-rows: same aliasing objective with explicit list construction, avoiding incidental comprehension syntax. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-python-tuple-child-copy` | Retained: source-aligned retrieval/application. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `cs131-python-default-dictionary-rebind` | Revised: typed output replaces recognition of a keyed trace; preserves taught objective and worked explanation. | Essential Python handout pp. 25–27 (definition-time defaults and None repair); Function Palooza, Default Parameters. |
| `cs131-python-immutable-default-time` | Revised: typed output replaces recognition of a keyed trace; preserves taught objective and worked explanation. | Essential Python handout pp. 25–27 (definition-time defaults and None repair); Function Palooza, Default Parameters. |
| `cs131-python-constructor-default-sharing` | Revised: typed output replaces recognition of a keyed trace; preserves taught objective and worked explanation. | Essential Python handout pp. 25–27 (definition-time defaults and None repair); Function Palooza, Default Parameters. |
| `cs131-python-none-default-contract` | Revised: use the taught None repair directly; remove unrelated truthiness and dictionary-copy APIs. | Essential Python handout pp. 25–27 (definition-time defaults and None repair); Function Palooza, Default Parameters. |
| `cs131-python-deepcopy-operation-boundary` | Replaced by cs131-python-initialize-inherited-state: deepcopy memoization/within-copy alias preservation is not taught; PYTHON5 explicitly asks for base-constructor repair. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `cs131-python-returned-list-detaches` | Removed: duplicates returned-alias-after-field-change; retain the shorter trace with the same objective. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-python-shallow-parameter-records` | Revised: typed output replaces recognition of a keyed trace; preserves taught objective and worked explanation. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `cs131-python-error-keeps-mutation` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 22–24; Function Palooza, Exception Handling; Homework PYTHON5 B.1 (exception recovery). |
| `cs131-v2-python-card-track-container-slot` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-v2-python-card-repair-reset-procedure` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-v2-python-card-compare-shallow-children` | Retained: source-aligned retrieval/application. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `cs131-v2-python-card-evaluate-double-shallow-copy` | Retained: source-aligned retrieval/application. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `cs131-v2-python-card-method-result-alias` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-v2-python-card-write-independent-nested-edit` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-v2-python-card-class-stamps-not-live-links` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 6–7 (class fields versus instance fields); Quiz 1 Problem 2A (object-state tracing). |
| `cs131-v2-python-card-custom-equality-change` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 11–13 (equality versus identity); Homework PYTHON5 (object reasoning). |
| `cs131-v2-python-card-explain-overridden-hook` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 14–16 (inheritance); Homework PYTHON5 A–B. |
| `cs131-v2-python-card-create-two-observable-results` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-python-card-default-snapshot` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 25–27 (definition-time defaults and None repair); Function Palooza, Default Parameters. |
| `cs131-python-card-default-set` | Revised as cs131-python-card-default-list-rebind: retain default-sharing reasoning with the lecture’s list operations. | Essential Python handout pp. 25–27 (definition-time defaults and None repair); Function Palooza, Default Parameters. |
| `cs131-python-card-supplied-empty` | Revised: use the lecture’s explicit None guard, keeping the repair about defaults rather than truthiness. | Essential Python handout pp. 25–27 (definition-time defaults and None repair); Function Palooza, Default Parameters. |
| `cs131-python-card-holder-local` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-python-card-slice-ownership` | Replaced by cs131-python-card-string-argument: remove untaught slice-assignment detail and practice immutable-value repair. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-python-card-tuple-replace` | Retained: source-aligned retrieval/application. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `cs131-python-card-copy-dictionary-boundary` | Retained: source-aligned retrieval/application. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `cs131-python-card-independent-deep-items` | Replaced by cs131-python-card-duck-typed-call: remove untaught deepcopy memoization and cover PYTHON5 duck typing. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `cs131-python-card-returned-alias-repair` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-python-card-copy-not-depth` | Removed: duplicates evaluate-double-shallow-copy, which already asks for a counterexample. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `cs131-python-card-two-parameter-child` | Retained: source-aligned retrieval/application. | Essential Python handout pp. 9, 20–24; Homework PYTHON2–3; Quiz 1 Problem 2A–D; F23 Midterm Problem 1, pp. 2–3. |
| `cs131-python-card-cycle-copy` | Replaced by cs131-python-card-base-initializer: remove untaught cyclic deepcopy behavior; practice explicit base initialization. | Essential Python handout p. 10 (copy depth); Homework PYTHON4 A.1–A.5; F24 Midterm V1 Problem 4, pp. 7–8. |
| `python-output-alias` | Retained objective; calibrated as intermediate output prediction. Explicit references/generator function replace incidental syntax where needed. | Essential Python pp. 9, 20–24; Quiz 1 Problem 2B–D. |
| `python-output-copy-depth` | Retained objective; calibrated as intermediate output prediction. Explicit references/generator function replace incidental syntax where needed. | Essential Python p. 10; Homework PYTHON4; F24 Midterm Problem 4. |
| `python-output-argument` | Retained objective; calibrated as intermediate output prediction. Explicit references/generator function replace incidental syntax where needed. | Essential Python pp. 22–24; Homework PYTHON2–3; Quiz 1 Problem 2B. |
| `python-output-default` | Retained objective; calibrated as intermediate output prediction. Explicit references/generator function replace incidental syntax where needed. | Essential Python pp. 25–27; Function Palooza, Default Parameters. |
| `python-output-repeated-row` | Retained objective; calibrated as intermediate output prediction. Explicit references/generator function replace incidental syntax where needed. | Essential Python pp. 20–21 (shared rows); Quiz 1 Problem 2C–D. |
| `python-output-generator` | Retained objective; calibrated as intermediate output prediction. Explicit references/generator function replace incidental syntax where needed. | Control Palooza, Generators (pause/resume and one shared iterator); Homework CTRL3; F24 Final Problem 6. |

Replacement item evidence:
- `cs131-python-string-rebinding`: Essential Python handout pp. 17–18, 28 (immutable strings); Homework PYTHON2 (immutable argument rebinding).
- `cs131-python-shared-versus-new-rows`: Essential Python handout pp. 20–21 (lists of references); Quiz 1 Problem 2C–D.
- `cs131-python-initialize-inherited-state`: Essential Python handout pp. 14–16; Homework PYTHON5 A.1–A.2 (missing base constructor and repair).
- `cs131-python-card-default-list-rebind`: Essential Python handout pp. 25–27 (definition-time defaults and None repair); Function Palooza, Default Parameters.
- `cs131-python-card-string-argument`: Essential Python handout pp. 17–18, 22–24, 28; Homework PYTHON2.
- `cs131-python-card-duck-typed-call`: Homework PYTHON5 B.1–B.3; Essential Python, Inheritance (not the excluded appendix).
- `cs131-python-card-base-initializer`: Essential Python handout pp. 14–16; Homework PYTHON5 A.1–A.2.

Deck counts:
- Python References and Parameters: 9 quiz, 7 flashcards.
- Python Copies and Nested Objects: 10 quiz, 6 flashcards.
- Python Classes and Defaults: 8 quiz, 8 flashcards.
