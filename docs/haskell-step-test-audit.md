# Haskell student-check contract audit

This audit compares each lesson's instructions with its student checks. The goal is to reject plausible mistaken implementations while accepting different correct algorithms. The three published tutorials contain **27 lessons and 44 gate groups**. Their independent fixtures contain **54 correct programs and 91 incorrect programs**: 145 complete `Main.hs` programs. The backend demonstration adds one lesson, two gate groups, and five programs, bringing the execution matrix to **150 programs**.

**Real MicroHs matrix: passed.** All 56 correct programs passed every applicable gate; all 94 deliberately incorrect programs were rejected by at least one gate. Every fixture module compiled before grading. The run applied 248 student gate checks, in addition to the 150 fixture-compilation checks. Compiler-backed signature and backend regressions also passed; verification details appear below.

## Method

For every lesson, the audit read the task, starter, reference solution, and each YAML gate. Inputs were chosen from the stated domain to distinguish boundaries, ordering, multiplicity, empty structures, type relationships, and likely incorrect algorithms. Fixtures implement complete algorithms; they do not recognize a table of the gate examples or obtain their source from the reference solution.

[`tests/haskell-step-gates.spec.js`](../tests/haskell-step-gates.spec.js) runs the real MicroHs backend. It first evaluates `True` to check that each fixture module compiles, then evaluates **each current YAML gate separately**. Every correct program must pass every gate; every incorrect program must fail at least one. Ordinary behavioral mutants must fail on results without unrelated compiler or runtime errors. Cases marked `gateErrorExpected` intentionally expose a missing declaration or incompatible interface when a gate is checked. `compileErrorExpected` is reserved for an intentionally invalid module, rather than a valid module that cannot accept a required test application.

The former weaknesses below are findings from contract and source review. They describe distinguishable candidate mistakes; they are not claims about student error prevalence or demonstrated learning gains. The independent fixture results below validate the specific implementations in this audit.

## Foundations: ten lessons

Source: [`_data/tutorials/haskell.yml`](../_data/tutorials/haskell.yml). Fixtures: [`haskell-foundations-gate-cases.js`](../tests/fixtures/haskell-foundations-gate-cases.js), with 20 correct and 38 incorrect programs.

| Lesson key | Contract | Audit finding and revised checks |
| --- | --- | --- |
| `session-time` | Subtract two pizza prices; report a negative shortfall; nonnegative whole-dollar inputs. | Existing free, exact-budget, ordinary, and shortfall cases discriminate the principal mistakes. Retained checks accept direct arithmetic or repeated helper application; they reject doubling the remaining balance, buying one pizza, and clamping a shortfall. |
| `numeric-price-contract` | Numeric sample amounts 9.50 and 12.00; explicit `Double -> Double -> Bool` interface; comparison includes equality. | Retain separate declaration, sample-value, and numeric-boundary gates. Numeric inference alone must not satisfy the explicitly requested declaration. Equivalent declaration formatting and type aliases are legitimate; a generic `Ord` interface is broader than the required monomorphic interface. |
| `stock-adjustment` | Practice mode overrides victory; clamp `stock + change` to the supplied nonnegative capacity. | Old negative-change examples all ended at zero. Added signed changes that leave positive stock, a different capacity, and a one-unit capacity overflow. These distinguish emptying stock on every negative change and reusing the example's capacity. Nested conditions and min/max remain valid. |
| `local-bindings` | At least four snacks receive floor(subtotal/4) off; add the fee once, even for an empty order. | Added four inexpensive snacks and three expensive snacks. The old examples allowed discount eligibility to depend on a subtotal threshold instead of quantity. Existing rounding and fee cases remain. Correct `let` and reordered `where` groups are accepted. |
| `tuples` | Preserve the name, add a signed bonus, and retain the original pair. | Added a zero bonus with a nonzero score, an empty name with a nonzero bonus/score, and a negative final score. These reject unrequested resets and score clamping. Pair selectors and tuple patterns both satisfy the value contract. |
| `lists` | Place an arbitrary element at both ends; retain the middle; empty input receives two copies. | Existing string, nested-string, duplicate, and empty cases remain. Function-valued elements, observed by application, now expose unnecessary `Eq`/`Ord` requirements. Singleton concatenation and recursive end construction are both accepted. |
| `swap-front` | Swap only the first two arbitrary elements; preserve the full tail and short inputs. | Existing shape and tail cases distinguish exact-two patterns, pairwise swapping, and tail loss. Function-valued elements challenge unnecessary comparison constraints. Prefix reversal and guarded head/tail access remain valid alternatives to constructor equations. |
| `recursion` | Count every occurrence greater than or equal to the unchanged threshold, including signed scores; empty input yields zero. | The old negative example accidentally had the same count under absolute-value comparison. Added sign-sensitive negative-threshold and zero-threshold contrasts. Guards and an accumulator helper are accepted; strict comparison, early stopping, magnitude comparison, and deduplication are rejected by distinct cases. |
| `route-candidates` | Route-first Cartesian combinations; positive platforms; nonempty names; preserve names, order, and repeats. | Retained empty, invalid-platform, ordering, and repeated-entry cases. Clarified unchanged route names and added a name with surrounding spaces to expose unrequested normalization. Prefiltered comprehensions and nested recursion remain valid. |
| `budget` | Longest affordable prefix in input order; reduce the remaining budget; stop at the first unaffordable item; allow free snacks. | Existing exact spending, later free items, zero budget, and first-unaffordable cases already distinguish the principal errors. Retained checks accept remaining-budget or accumulated-spending strategies and reject skipping, independent price checks, and stopping before free items. |

## Functions and laziness: eight lessons

Source: [`_data/tutorials/haskell-functions.yml`](../_data/tutorials/haskell-functions.yml). Fixtures: [`haskell-functions-gate-cases.js`](../tests/fixtures/haskell-functions-gate-cases.js), with 16 correct and 24 incorrect programs.

| Lesson key | Contract | Audit finding and revised checks |
| --- | --- | --- |
| `map-filter` | Select original `Int` scores at least 10, then double them; preserve order and repeats. | Existing boundaries distinguish selection before transformation, strict cutoffs, and reversed results. A representative input is now explicitly `[Int]` to exercise the supplied interface. Mapping/filtering and direct recursion are both accepted. |
| `captured-settings` | Reusable window with nonnegative `Int` offset/count; skip before taking; preserve arbitrary elements and short inputs. | Added zero offset with a positive count, function-valued elements, and explicit `Int` settings. These separate zero-offset handling and unnecessary comparison constraints. Both take/drop and recursive skip/collect implementations remain valid. |
| `currying` | Curried `Int` discount subtracts the amount from each score, preserving negative results, order, and repeats. | Existing tests already distinguish reversed operands, clamping, fixed amount, and zero/negative amounts. Representative amount and score types are now pinned to `Int`. The requested nested-lambda rewrite remains a manual source-form task. |
| `higher-order-types` | Convert each second field; preserve arbitrary labels, order, repeats, and empty input; input and result types may differ. | Added function-valued labels, inputs, and results, observed through application. The old examples could not expose unjustified comparison constraints on these roles. Map and direct recursion remain accepted. |
| `left-folds` | Finite decimal digits 0–9 produce an `Integer`; empty input yields zero; leading zeroes are allowed. | Added zero singleton, trailing zero, and an explicitly typed 20-digit input. These exercise place value and arbitrary precision without imposing rules for invalid digits. Fold and recursive prefix accumulation both satisfy the contract. |
| `recursive-accumulators` | Preserve a nonnegative count seed; classify each occurrence into exactly one counter using an arbitrary predicate. | Existing seeds, repeats, empty, all-pass, and all-fail cases remain. Added a predicate over function-valued items to expose an unnecessary `Eq` requirement. Recursion and tail-call form still require source inspection. |
| `lazy-lists` | Return up to the first requested matches; preserve order; stop after enough matches; zero count requires no search. | Retained finite shortages, an actual infinite matching range, and a zero-count infinite range with no matches. Added function-valued items. Positive-count infinite probes have enough matches after a finite prefix; no impossible-search termination requirement is imposed. |
| `playlist` | Select by inclusive original-score cutoff; report every selected title in order and add the bonus for each occurrence. | Clarified that empty titles are valid, added repeated empty-title results, and pinned representative inputs to `Int`. Existing negative, empty, no-selection, ordering, and repeated-title cases remain. Fold, transformations, and recursion are accepted. |

## Data and pure state: nine lessons

Source: [`_data/tutorials/haskell-data.yml`](../_data/tutorials/haskell-data.yml). Fixtures: [`haskell-data-gate-cases.js`](../tests/fixtures/haskell-data-gate-cases.js), with 18 correct and 29 incorrect programs.

| Lesson key | Contract | Audit finding and revised checks |
| --- | --- | --- |
| `variants` | Nonnegative `Integer` event payloads; whole travel quarters, negative fight delta, unchanged heal delta; no cap here. | Added large travel/fight payloads and healing above 100. These challenge bounded arithmetic and accidental use of the later simulator's cap. Ordinary zero and travel-division boundaries remain; constructor equations and helper decomposition are accepted. |
| `records` | Add nonnegative healing to existing health in [0,100], cap at 100, and preserve the arbitrary name and original value. | Replaced direct `Hero` equality/shared-helper observations with a gate-local constructor observer. Added zero-health, cap boundaries, huge healing, and empty-name cases. One correct fixture omits the sample `healthOf`/`renameHero` helpers, and neither requires an `Eq`/`Show` instance; equivalent record update is also accepted by value checks. |
| `generic-functions` | `Ord`-generic inclusive bounds with low ≤ high; preserve order and duplicates; empty input yields empty output. | Retained integer/string partitions and added exactly representable `Double`, `Char`, and `Bool` instances. These challenge common specialization without adding reversed-bound requirements. Multiple instantiations do not prove the most general signature or absence of every extra constraint. |
| `recursive-data` | One `Stop` for each input string, in order, ending with `End`; empty input yields `End`. | Gate-local constructor observation removes an accidental `Eq Trail` requirement and dependence on supplied `toList`. Added empty/whitespace names and a longer trail. Recursive construction and a fold over reversed input are both accepted. |
| `persistent-trails` | Delete exactly the zero-based index; preserve other stops; negative/out-of-range indices leave an equal trail. | Independent observers and constructor-built inputs cover first/middle/last, repeated names, empty names, negative indices, and just/far-outside indices. Direct reconstruction and whole-trail rebuilding are both valid result strategies; sharing is not measured. |
| `branching-data` | Count nodes with nonempty label lists; traverse through unlabeled parents; `NoRoute` contributes zero. | Added empty-string labels, a wider child list, and a deeper unlabeled path. A list containing `""` is still nonempty. These distinguish counting labels, pruning unlabeled roots, shallow traversal, and discarding empty label strings. Recursive sums and pending-node traversal are accepted. |
| `search-min-removal` | For a finite valid unique-key BST, remove only the smallest key and retain ordering and all other keys. | Independent inorder observation avoids helper coupling and exact tree-shape constraints. Added a deeper left path, negative keys, the minimum's right child, and a retained right subtree with its own left child. The direct-recursion fixture omits the sample `toAscList` helper. A differently shaped valid rebuilt BST is also accepted. |
| `expression-trees` | Evaluate every finite expression according to `Number`, `Plus`, and `Times`, respecting its represented grouping. | Added a large `Integer`, negative addition, deeper right nesting, and signed mixed subtrees. Existing zero/product/grouping cases remain. Constructor equations and a recursive combination helper are valid; representation printing is not a requirement. |
| `expedition` | Start at 100; process nonnegative events in order; decide mode from pre-event health; cap restoration; death at ≤0 is terminal. | Retained 40/41, integer-division, and death boundaries; added travel-cap contrasts, zero events, defensive healing, and heal-to-40 versus heal-to-41 interactions. Recursion and a fold with an absorbing terminal result satisfy the finite-list value contract. |

The backend demo had a separate shape weakness: a definition restricted to exactly three inputs could pass its two original sample lists. Its revised checks include empty, singleton, repeated, and four-element inputs. Two correct and three wrong complete programs cover this demonstration separately from the 27 published lessons.

## Signature checking and type evidence

The numeric-price exercise explicitly requires a **declared, monomorphic** `Double -> Double -> Bool` interface. A function that merely infers a compatible numeric use, or declares `Ord a => a -> a -> Bool`, does not meet that requirement even if sample outputs are correct. Comment text, expression annotations, and local shadow declarations also do not supply the required top-level declaration.

The backend now replaces source-level type-shape comparison with **top-level declaration presence plus real MicroHs `Data.Typeable` evidence in a separate checking module with its own imports**. A scoped `default ()` prevents the probe's `Fractional` ambiguity from being silently defaulted to `Double`. Compiler resolution accepts imports, qualification, and equivalent type aliases without requiring one spelling. All 19 signature-backend cases passed, including imported and parameterized aliases, wrong primitives, shadowed primitive names, generic `Ord`/`Fractional`/`RealFrac` declarations, and recovery after a compilation error. The Boolean command still has to succeed independently. Temporary checker imports are removed with MicroHs's exact qualified-import syntax; their source files survive until the following operation has consumed cleanup and reload. Collision checks preserve learner-owned files.

Other polymorphic gates use function-valued elements where an unconstrained element type is required. They observe a returned function by applying it at a concrete argument, rather than compare functions for equality. This rejects common added `Eq`/`Ord` restrictions without claiming to prove equality of arbitrary functions. Multi-type range checks similarly provide evidence for the intended `Ord` interface, not proof of maximal polymorphism.

## Assessment limits

**No finite suite proves every program correct for every possible input.** These gates and independently written fixtures provide diagnostic evidence on meaningful partitions. They cannot prove absence of sample-specific code, completeness over all inputs, or student understanding.

The assessment separates three kinds of evidence:

- **Executable results and required type uses:** the automated gates check returned values, ordering, multiplicity, boundaries, and selected interface relationships. The numeric-price declaration is an explicit additional requirement.
- **Learning process and source form:** predictions, explanations, type derivations, added examples, requested `let`/lambda rewrites, recursive style, and later retrieval require self-check, quiz evidence, or source review. Correct alternative algorithms passing a result gate do not certify completion of those learning activities.
- **Construction cost and sharing:** equal original/result values do not establish physical object identity, heap allocation, compiler optimization, direct reconstruction, or asymptotic cost. Constructor-count explanations describe the stated direct source algorithm; fully rebuilding an equal result can pass the value contract.

Inputs respect each exercise's stated domain. The audit does not add invalid decimal digits, reversed interval bounds, negative event payloads, invalid BSTs, cyclic trees, or invalid starting health. Actual infinite ranges are used only for the lazy-list stopping contract, with finite-prefix matches or zero requested results. The results establish discrimination for the tested algorithms and cases, not exhaustive correctness or a general security boundary against deliberately adversarial submissions.

## Verification

The site was rebuilt successfully with `bundle exec jekyll build` before final verification. Tests used the rebuilt site on localhost and the real vendored MicroHs compiler, with independent browser contexts.

| Verification | Result |
| --- | --- |
| Declaration-presence, alias-cycle, and tutorial-schema tests | 58 passed |
| All-step gate matrix, compiler signature cases, and backend regressions | 61 passed: 32 matrix/inventory cases, 19 signature cases, and 10 backend cases |
| Full tutorial journeys, capstones, print views, signature feedback, detached instructions, and cycle diagnostics | 14 passed; all 27 supplied starters fail an appropriate gate and all 27 supplied solutions pass |
| Scoped screen and print accessibility suites | 4 passed; nine affected URLs checked in each audit, zero findings |
| Signature lesson with interactive accessibility checkpoints enabled | Passed through quoted inputs, compiler failure, missing declaration, corrected types, and wrong comparison |

A further 29-case signature/core-backend compatibility run passed after concurrent interpreter edits to the shared runtime. This checks the grading and existing execution paths; it does not assess the separate interpreter feature.

The scoped accessibility reports are `tmp/haskell-gate-audit-wcag22-results.json` and `tmp/haskell-gate-audit-print-results.json`. These automated checks complement manual accessibility review; they do not certify every criterion or unrelated site page.

To rerun the core regression set against the configured local preview:

```sh
node --test scripts/tests/haskell-signature-checks.test.js scripts/tests/haskell-cycle-analysis.test.js scripts/tests/haskell-tutorial-content.test.js
npx playwright test tests/haskell-step-gates.spec.js tests/haskell-signature-backend.spec.js tests/haskell-course-backend.spec.js --workers=3 --fully-parallel
npx playwright test tests/haskell-tutorial.spec.js tests/haskell-cycle-diagnostics.spec.js
A11Y_INTERACTIVE_CHECKS=1 npx playwright test tests/haskell-tutorial.spec.js --grep 'price lesson distinguishes'
```

The three matrix workers are safe because each test owns its browser context and in-memory compiler workspace. No test changes the static server's source files. The matrix fixtures deliberately vary algorithms and type representations; the student gates under test supply no fixture source or expected verdicts.
