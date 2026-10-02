# Teaching Haskell and functional programming: misconceptions, evidence, and digital tutorial design

Research report • 2 October 2026 • University learners, especially students with prior imperative or object-oriented programming experience

## Executive findings

**Prioritize the relationship between expressions, types, and function application.** The clearest recurring difficulties in the inspected Haskell studies concern type mismatches, list structure, parentheses, arguments, and signatures. These findings support targeted instruction and diagnostic tasks; they do not establish a population-wide ranking of students' beliefs. [Tirronen, Uusi-Mäkelä, and Isomöttönen, 2015](https://doi.org/10.1017/S0956796815000179); [Németh et al., 2019](https://doi.org/10.4204/EPTCS.295.4); [Wu and Chen, 2017](https://doi.org/10.1145/3133929).

**Do not organize the course around an assumed list of universally difficult abstractions.** In one Haskell cohort, investigators did not observe the specific base-case-as-stopping-condition misconception, reported no conceptual partial-application difficulty, and found little early laziness difficulty. They did observe missing recursive cases. These distinctions challenge blanket assumptions without establishing universal ease. [Tirronen et al., 2015](https://doi.org/10.1017/S0956796815000179).

**Teach learners to predict, explain, modify, and independently construct programs.** Use small worked examples, explicit intermediate types and values, increasingly incomplete solutions, and later retrieval. Research supports parts of this approach in other programming and learning settings, but the complete Haskell sequence proposed below remains a design to evaluate. [Margulieux, Morrison, and Decker, 2020](https://doi.org/10.1186/s40594-020-00222-7); [Renkl, Atkinson, and Maier, 2000](https://escholarship.org/uc/item/81b9j9hs); [Roediger and Karpicke, 2006](https://doi.org/10.1111/j.1467-9280.2006.01693.x).

**Digital tutors are promising instructional tools, but their evaluations often measure something narrower than learning.** Feedback accuracy, program recognition, immediate completion, and positive student comments cannot establish independent understanding or retention. A tutorial should therefore include unseen problems and delayed assessments alongside its automated checks. [Gerdes et al., 2017](https://doi.org/10.1007/s40593-015-0080-x); [Vasconcelos, 2025](https://doi.org/10.4204/EPTCS.424.3).

The recommended first release is a focused sequence on application/types, structural data and recursion, higher-order composition, and demand, with a small IO project. Build a reliable feedback and assessment loop before investing in elaborate visualizations or an unrestricted AI tutor. This prioritization is the review's synthesis, not a tested superiority claim.

## 1. Questions, scope, and method

This report asks what students misunderstand, what teaching evidence can reasonably inform Haskell instruction, and how to translate that evidence into digital tutorials. It covers foundational work through **2 October 2026**, primarily English-language material. University learners with prior programming are the main audience. School studies, first-language learners, other functional languages, and general learning experiments remain explicitly identified.

The approved [scope](memos/scope.md) and [evidence protocol](memos/evidence-protocol.md) guided a **bounded, structured literature review**. This is not an exhaustive systematic review, a meta-analysis, or a validated misconception inventory. Search ranking, full-text availability, English-language coverage, and the choice of citation seeds affect what was found.

### Search and verification

Discovery used the requested **SciSpace, Sider Scholar, and Consensus**, supplemented by direct OpenAlex queries and targeted searches for primary texts. **Elicit was attempted twice but denied API access under the account's current plan**; no Elicit results contributed evidence. Consensus results used as discovery leads were checked against underlying papers; required fetches were performed for its directly used records. Automated summaries were not treated as study findings.

Search families included Haskell student mistakes, types and compilation errors, functional-programming learning, automated feedback, expression evaluation, worked examples, conceptual transfer, and retrieval/spacing. Separate recent-date searching reduced dependence on older, highly cited papers. Backward and forward snowballing expanded from misconception studies and tutor/teaching papers; the [search log](memos/search-log.md) records actual queries, bounds, citation paths, and counts. The [screening ledger](data/screening.json) distinguishes included records, clearly unrelated results, and deferred candidates.

Important claims were checked in publisher material, author manuscripts, institutional repositories, proceedings, or language documentation. “Selected full text” means that relevant methods, results, discussion, or examples were inspected; it does not imply every page was read. Abstract-only and metadata-only records remain visible in the bibliography but do not support numerical or detailed misconception claims.

The final research ledger contains **41 records: 37 included sources and four access-limited leads**. Of the included sources, 35 received selected full-text inspection and two are explicitly limited to abstracts. The package separately records **eight tutorial exemplars and seven language-reference entries**. These counts include conceptual and technical papers as well as learner studies; they are not counts of independent experiments.

### How to read the evidence

| Label | What it can contribute | What it does not establish by itself |
| --- | --- | --- |
| Direct Haskell learner evidence | Errors, explanations, strategies, and outcomes in the studied learners/tasks | Prevalence across all Haskell learners |
| Haskell tool or teaching evaluation | Feasibility, diagnostic accuracy, experience, or a specific comparison | Learning gains unless learning was measured with an adequate comparison |
| Adjacent CS/FP evidence | A relevant instructional mechanism or difficulty in another language/context | An already demonstrated Haskell effect |
| General learning science | Evidence about processes such as retrieval and spacing | An optimal Haskell lesson schedule |
| Tutorial exemplar | A directly observable instructional design | Comparative teaching effectiveness |
| Proposed design | A concrete synthesis ready to pilot | A validated intervention or assessment instrument |

A compiler error is an observation. Calling it a **misconception** additionally requires evidence about the learner's model, such as an explanation, a consistent prediction pattern, or transfer across tasks. Counts of submissions, sessions, errors, IP addresses, and students are different denominators. Several publications also reuse or revisit related corpora; their results must not be counted as independent replications automatically.

## 2. What students misunderstand—and what remains a hypothesis

### 2.1 Difficulties with the clearest direct support

| Observed cluster | Interpretation and evidence boundary | Proposed instructional response |
| --- | --- | --- |
| Types and application grouping | Tirronen et al. observed 55 active students, not all 88 registrants. Type mismatches and precedence featured prominently; several errors could have different underlying causes. | Read an expression's grouping before inferring its type. Contrast a function, its argument, and the result of application. |
| Scalars, lists, and nested lists | Németh et al. identify these distinctions in an error sample. Its category percentages describe errors, not the percentage of learners holding a belief. | Require intermediate values and types for a single element, a list, and a list of lists. |
| Missing arguments and signatures inconsistent with definitions | Wu and Chen analyze repairs across three cohorts; many fixes involve notation, and signatures themselves can be wrong. A compiler location need not identify the intended repair. | Compare definition and signature in both directions. Ask whether the annotation or implementation should change, using the specification. |
| Expression/declaration and REPL confusion | Singer and Archibald's corpus includes a restricted environment that rejects some valid Haskell. Tool affordances are part of the explanation. | Clearly label expression prompts, module editors, and supported syntax; distinguish language errors from environment limitations. |
| Higher-order composition and intermediate transformations | Rivera and colleagues find representation- and task-dependent performance in **Racket**. Understanding individual operators does not ensure successful composition. | Ask for the shape and meaning of each intermediate collection before writing the pipeline; assess recognition and construction separately. |

Sources: [Tirronen et al.](https://doi.org/10.1017/S0956796815000179), [Németh et al.](https://doi.org/10.4204/EPTCS.295.4), [Wu and Chen](https://doi.org/10.1145/3133929), [Singer and Archibald](https://doi.org/10.4204/EPTCS.270.3), [Rivera and Krishnamurthi](https://doi.org/10.1145/3547633), [Rivera, Krishnamurthi, and Goldstone](https://doi.org/10.1145/3501385.3543965). Methodological details and denominators are in the [misconception ledger](notes/misconceptions-sources.json).

The practical implication is not to spend weeks on syntax drills. It is to connect notation to meaning: what is being applied, which value flows where, and which type relationship must hold. A learner who adds parentheses until compilation succeeds needs a different next task from a learner who can explain precisely why those parentheses change the program.

### 2.2 Important diagnostic hypotheses without established prevalence

The following are useful things to **probe**, not an evidence-based ranking of common misconceptions. Their expected answers follow Haskell semantics; the available studies do not establish how frequent each belief is.

| Concept | Plausible misunderstanding to probe | Contrast that can reveal the learner's model |
| --- | --- | --- |
| Expressions and immutable bindings | A binding is an imperative storage cell, or evaluating an expression updates it. | Predict `let n = 3 in (n + 1, n)` and explain why the second component stays `3`. |
| Scope | Reusing a name always refers to the same storage location. | Identify which lexical binding each occurrence refers to in two small nested examples. |
| Curried functions | Multiple written arguments form a tuple, or partial application produces a completed numeric answer. | Compare `Int -> Int -> Int` with `(Int, Int) -> Int`, and infer the type of `sub 10`. |
| Polymorphism | A type variable means unrestricted dynamic values, or repeated `a` occurrences can independently denote different types within one use. | Check whether a proposed implementation satisfies `a -> a`; contrast it with a constrained numeric signature. |
| Type classes | A class is an object-oriented class with instance fields and inheritance semantics. | Explain what an `Eq a` constraint permits in a function body, using several concrete argument types. |
| Pattern matching and algebraic data | Patterns are assignments, or a sum type contains every constructor at once. | Enumerate possible constructors; trace which equation matches and which names it binds. |
| Structural recursion | The base case only “stops a loop,” without contributing a result; recursive results update hidden shared state. | Predict the empty case and show how the result of the smaller problem is combined. |
| Folds | `foldr` necessarily evaluates the last element first, or `foldl` is automatically strict. | Separate parenthesization from demand; use subtraction first, then a short-circuiting combining function. |
| Non-strict evaluation | Every argument is evaluated before application, or obtaining a constructor means all its fields are evaluated. | Contrast `length` with `head` on a list containing an undefined element. |
| IO and monadic sequencing | `IO String` is a `String`, `<-` is ordinary assignment, or `return` exits a block. | Distinguish an action from its result and predict a block containing `return ()` followed by output. |

Authorities for these contrasts: [Haskell 2010 expressions](https://www.haskell.org/onlinereport/haskell2010/haskellch3.html), [declarations and types](https://www.haskell.org/onlinereport/haskell2010/haskellch4.html), [predefined types/classes](https://www.haskell.org/onlinereport/haskell2010/haskellch6.html), [IO](https://www.haskell.org/onlinereport/haskell2010/haskellch7.html), and [Prelude definitions](https://www.haskell.org/onlinereport/haskell2010/haskellch9.html). The [checked diagnostic notes](notes/tutorials.md#twelve-diagnostic-examples-checked-against-authoritative-semantics) provide further examples and version boundaries.

Do not teach a universal imperative-versus-functional dichotomy. Prior knowledge can help as well as interfere. Research on Python/Java transfer suggests that similar syntax with different semantics can be especially misleading, but it does not identify the cause of a particular Haskell student's error. Ask the learner for the rule they applied, then contrast that rule with the actual behavior. [Tshukudu and Cutts, 2020](https://doi.org/10.1145/3372782.3406270).

### 2.3 Avoid introducing new misconceptions while simplifying

An IO action **is a value**; the important distinction is between an action of type `IO a` and its result of type `a`. GHCi's special handling of actions can obscure that distinction because entering an action may execute it and display its result. A tutorial should make this interface behavior explicit. [Haskell IO](https://www.haskell.org/onlinereport/haskell2010/haskellch7.html); [GHCi actions at the prompt](https://downloads.haskell.org/ghc/latest/docs/users_guide/ghci.html#i-o-actions-at-the-prompt).

Similarly, a fold's association is not its runtime evaluation order. A reduction trace is an explanatory model, not a promise about GHC's optimized execution. Introduce one model at a time, state what it abstracts away, and use examples that expose its limits. Avoid universal claims such as “lazy evaluation evaluates nothing until printing,” “foldr works on every infinite list,” or “a compiling program is correct.”

## 3. What the teaching evidence supports

### 3.1 Direct Haskell teaching and tutor evaluations

| Source and design | Supportable finding | Implication for a digital tutorial |
| --- | --- | --- |
| **Ask-Elle**, technical and user evaluations | Stepwise program feedback and property-based counterexamples are feasible. Its evaluations do not establish learning effects. | Diagnose partial work, allow alternative solutions, and assess transfer separately. |
| **Expression evaluation tutor**, 7 instructor and 9 student respondents | Learner-entered rewrite steps can be diagnosed; preferences about detail and strategy differ. | Require a predicted next step and offer controllable detail. |
| **Haskelite**, course experience with 14 forum and 6 tool-questionnaire respondents | Small, self-selected reports suggest usefulness; trace size and unsupported syntax matter. | Use short traces and explicit environment boundaries; do not infer a causal pass-rate gain. |
| **Early assessment**, historical cohorts of 78 and 40 completers | Adding early summative Use-Modify work accompanied an approximately 9-percentage-point later assessment difference; the reported effect was small and confounded. | Pilot early low-stakes, scaffolded work; do not promise the observed effect size. |
| **Blended Haskell MOOC**, 36 survey and 6 focus-group participants | Support and the transition into advanced tasks influenced reported experience. | Make help visible and bridge small exercises to independent projects. |
| **Student-created explanatory videos**, uncontrolled course study of 16 | Improvement and positive perceptions accompanied a demanding authoring activity. | Try short explanations first; video production is not a necessary learning mechanism. |
| **GeckoGraph**, community task experiment | Overall superiority was not established; subgroup results and manuscript reporting inconsistencies warrant caution. | Treat a visual type representation as an optional, evaluated aid. |
| **Goanna**, student-program corpus benchmark | Diagnostic accuracy is a tool-performance outcome; rigorous human evaluation remains future work in the paper. | Test whether learners understand and retain a repair, beyond the tool finding it. |

Sources: [Ask-Elle](https://doi.org/10.1007/s40593-015-0080-x), [Olmer et al., 2014](https://doi.org/10.4204/EPTCS.170.4), [Haskelite](https://doi.org/10.4204/EPTCS.424.3), [Chapman, 2025](https://doi.org/10.1017/S0956796824000182), [Dale and Singer, 2019](https://doi.org/10.25304/rlt.v27.2248), [Feijóo-García and Gardner-McCune, 2020](https://doi.org/10.5220/0009416404120419), [GeckoGraph](https://doi.org/10.1016/j.cola.2025.101381), [Goanna](https://doi.org/10.1007/s10515-026-00656-3).

### 3.2 Pedagogy that can inform Haskell teaching

**Prediction and discussion before construction.** PRIMM—Predict, Run, Investigate, Modify, Make—has encouraging school-level Python evidence. Its classroom study bundles materials, teacher training, and dialogue; it does not validate a solo university Haskell implementation. Preserve the requirement to articulate reasoning when adapting the sequence, rather than merely relabeling five screens. [Sentance, Waite, and Kallia, 2019](https://doi.org/10.1080/08993408.2019.1608781).

**Worked examples with explicit subgoals, followed by fading.** In university Java, subgoal-labeled examples improved some formative and failure/withdrawal outcomes without a significant average exam improvement. Separate fading experiments in non-programming tasks primarily support near transfer. For Haskell, label the decisions—choose data cases, identify a smaller problem, combine its result—and progressively remove help. [Margulieux et al., 2020](https://doi.org/10.1186/s40594-020-00222-7); [Renkl et al., 2000](https://escholarship.org/uc/item/81b9j9hs).

**Retrieval and spaced return.** General experiments distinguish fluent immediate performance from delayed retention; optimal spacing depends on the retention target. A recent programming study also tests incentives to distribute practice across days. Together these justify returning to earlier concepts, but not a universal “every three days” schedule or a guaranteed Haskell effect. [Roediger and Karpicke, 2006](https://doi.org/10.1111/j.1467-9280.2006.01693.x); [Cepeda et al., 2008](https://doi.org/10.1111/j.1467-9280.2008.02209.x); [YeckehZaare and Resnick, 2025](https://doi.org/10.1038/s41539-025-00322-5).

**An explicit model of evaluation.** Notional-machine research supplies a useful framework for explaining execution. A visual simulation is not automatically meaningful to a student. Require learners to relate each representation change to a language rule, and test the explanation without the animation. This is a Haskell design inference from broader work. [Sorva, 2013](https://doi.org/10.1145/2483710.2483713); [Sorva, Lönnberg, and Malmi, 2013; abstract inspected](https://doi.org/10.1080/08993408.2013.807962).

**Feedback must earn its place empirically.** Enhanced compiler-message studies have mixed results: a randomized Java study found no significant benefit for its enhancement, while a historical-cohort study found improvements on error measures. A C study found no general advantage for GPT-generated messages. Clearer-sounding feedback is therefore a hypothesis about help, not a learning outcome. [Denny et al., 2014](https://doi.org/10.1145/2591708.2591748); [Becker et al., 2016](https://doi.org/10.1080/08993408.2016.1225464); [Santos and Becker, 2024](https://doi.org/10.1145/3689535.3689554).

### 3.3 Additional insights from backward and forward snowballing

The expanded citation search added **nine substantively inspected sources**, plus a clearly labeled access-gap lead. Both citation directions were pursued: a backward link identifies a reference in a seed paper; a forward link identifies a later paper citing the seed. Selected edges were checked in primary bibliographies, rather than inferred from topical similarity. Full paths and limits appear in the [misconception snowball notes](notes/snowball-misconceptions.md) and [tutor snowball notes](notes/snowball-tutors.md).

| Citation path | New finding and boundary | Consequence for the proposed tutorial |
| --- | --- | --- |
| Tirronen mistakes → **worked-type examples** (backward) | An exploratory Haskell single-subject study observed specific type-variable, currying, and application difficulties; gains and maintenance varied. | Add worked type derivations with explanations, then test without the derivation aid. |
| Tirronen/Rivera → **Map, Filter, and Conquer** (forward) | In a 27-person Algot/Python crossover, lower effort and faster work did not produce superior conceptual answers; the error difference was nonsignificant after removing Python syntax errors. | Measure reduced syntax burden separately from conceptual understanding. |
| Rivera → **behavioral HOF concepts** (backward) | Racket/Pyret classification tasks reveal difficult behavioral distinctions; changing samples prevent a matched retention estimate. | Contrast `filter` and `takeWhile`, and ask learners to generate a distinguishing example. |
| Rivera planning → **planning notations** (forward) | A novice-course experience report found rigid visual planning troublesome; earlier experienced-student results did not transfer cleanly. | Offer text or sketches and explain their purpose; do not mandate a complex block planner. |
| Haskelite → **recursion tracing** (backward) | On one Pyret tree problem, 10/15 answers were correct but only 1/15 traces were sound and complete. | Score the result and the reasoning separately; adapt the execution model for Haskell's non-strict semantics. |
| Chapman → **Learn-OCaml automated grading** (backward) | A course report describes grader trial-and-error and extensions assessing student tests; learning gains from those extensions were not established. | Require a predicted outcome or discriminating test before repeated submissions. |
| Haskelite → **Stepping OCaml** (backward) | Observed completion-time differences involve changing cohorts, tool coverage, and teaching. | Treat speed and usefulness as secondary to an independent learning check. |
| Olmer → **Haskelite calculus/interpreter** (forward) | The technical design accounts for lazy sharing, guards, and matching; its educational evaluation was still underway. | State exactly what a trace represents, including sharing when relevant. |
| Ask-Elle → **Ladder** (forward) | A Scala/LLM design-recipe feasibility study found feedback failures and learner concerns about dialogue and code generation; it did not test learning gains. | Fade generated help into learner-authored code and evaluate unsupported transfer. |

Sources: [worked-type examples](https://doi.org/10.1017/S0956796814000021), [Map, Filter, and Conquer](https://doi.org/10.1145/3724363.3729111), [behavioral HOF concepts](https://doi.org/10.1145/3446871.3469739), [planning notations](https://doi.org/10.1145/3626252.3630901), [recursion tracing](https://doi.org/10.1145/3159450.3159479), [Learn-OCaml grading](https://doi.org/10.1145/3341719), [Stepping OCaml](https://doi.org/10.4204/EPTCS.295.2), [Haskelite interpreter](https://doi.org/10.1145/3677999.3678274), and [Ladder](https://doi.org/10.1145/3758317.3759682).

These additions sharpen the design priorities: require reasoning even when an answer is correct, evaluate syntax aids without assuming conceptual gains, let learners express plans flexibly, and prevent an autograder or AI dialogue from replacing independent work. They add direct support for investigating some type-related mental models, while leaving their broader prevalence unresolved.

### 3.4 How to resolve apparently conflicting findings

The evidence does not support a single contest between “traditional” and “functional” teaching. Studies ask different questions: Can a learner repair this expression? Can a tutor classify it? Does a course retain more students? Can a student solve an unseen task a week later? A favorable result on one outcome and a null result on another can both be correct.

For decisions, match the outcome to the proposed feature. A type visualizer needs comprehension and transfer measures; a compiler needs diagnostic correctness; a help panel needs successful repair and explanation; a course sequence needs independent programming and retention. A feature can be valuable for access or reduced frustration without claiming a conceptual-learning advantage.

## 4. What established tutorials contribute

Eight contrasting resources were inspected. This is a design comparison, not an effectiveness ranking. Inspection depth varies; the [tutorial notes](notes/tutorials.md) identify the exact pages and unavailable areas.

| Resource | Observable contribution | Proposed use and caution |
| --- | --- | --- |
| [Helsinki Haskell MOOC](https://haskell.mooc.fi/) | Quizzes, source exercises, test feedback, and a substantial progression | Borrow exercise/checkpoint integration; reduce initial command-line and Git burden for a browser-first route. |
| [Haskell Programming from First Principles](https://haskellbook.com/) | Public sample asks readers to predict before using GHCi | Borrow prediction and modification prompts; only selected sample exercises were inspected. |
| [Programming in Haskell, second edition](https://people.cs.nott.ac.uk/pszgmh/pih.html) | A coherent contents-level curriculum and extended examples | Use as a curriculum map; contents inspection cannot establish exercise quality or learning outcomes. |
| [CIS 194, Spring 2013](https://www.cis.upenn.edu/~cis1940/spring13/lectures.html) | Revisable homework, recursion-to-pipeline work, and demand-focused examples | Borrow conceptual contrasts; verify archived code against the chosen current compiler. |
| [Learn You a Haskell, maintained community fork](https://learnyouahaskell.github.io/) | Concrete explanations of higher-order functions and partial application | Pair exposition with unseen tasks; successful transcript reproduction is insufficient evidence. |
| [Haskell Wikibook](https://en.wikibooks.org/wiki/Haskell) | Alternative routes, fold exercises, and early simple IO | Provide a curated path; distinguish reference browsing from a prerequisite sequence. |
| [CodeWorld](https://github.com/google/codeworld) | Browser-based visual programming and a standard-Haskell mode | Consider a motivating project; its educational variant is distinct, and guide exercises were not accessible in this inspection. |
| [Exercism Haskell](https://exercism.org/tracks/haskell) | Specification-based practice and advertised automated/mentor feedback | Use independent problems after instruction; actual mentoring and logged-in feedback were not evaluated. |

There is no single sequence shared by these resources. For example, algebraic data, IO, and the dedicated treatment of laziness appear at different points. That variation offers design alternatives; it is not evidence that any ordering is optimal. The proposed sequence below is selected for the target audience and its prerequisite relationships.

## 5. Proposed digital tutorial curriculum

Everything in this section is an **original design proposal informed by the review**, not a completed intervention study. It specifies observable learning outcomes so that a future implementation can be evaluated.

### 5.1 Entry diagnosis and routes

Start with a short, ungraded diagnostic: predict an expression, explain a binding, read a function signature, and decompose a list-processing problem. Ask about prior language and experience, but route by demonstrated prerequisites rather than self-identification alone. A student familiar with Java may already decompose problems well while misreading application; a first-language learner may need both skills.

Offer concise refreshers instead of forcing everyone through the same prelude. Keep a visible route back to prerequisites. Early success should involve writing or explaining a small program, not completing tool installation. A browser environment can remove setup work initially; later, explicitly bridge to ordinary files, GHCi, and the selected compiler/toolchain so platform competence also develops.

### 5.2 Sequence, objectives, and checkpoints

| Stage | Learner should be able to… | Practice and independent checkpoint |
| --- | --- | --- |
| 1. Expressions, bindings, application | Predict a pure expression; explain lexical bindings; parenthesize application correctly | Contrast minimally different expressions, then explain a new case without execution. |
| 2. Types as relationships | Match definitions and signatures; distinguish values, functions, lists, and tuples | Fill intermediate types, then repair either a definition or an annotation from a specification. |
| 3. Data and case analysis | Represent alternatives with constructors; identify exhaustive cases | Choose a representation for a small domain and justify each pattern. |
| 4. Structural recursion | Derive a function from the shape of its data; explain base and recursive results | Study a labeled example, complete missing steps, then solve a related but unseen task. |
| 5. Higher-order functions | Explain `map`/`filter` behavior; use partial application; plan a composition | Label intermediate collections/types, fade labels, and write an independent pipeline. |
| 6. Folds and reasoning | Distinguish association from demand; connect a fold to a recursion pattern | Compare recursive and fold versions; discriminate with a noncommutative operator. |
| 7. Demand and partial values | Explain which parts are required for a requested result | Predict short demand traces, including a finite observation of an infinite structure. |
| 8. Concrete effects | Separate an IO action from its result and compose a small interaction | Build a small input/validation/output program, then change its specification. |
| 9. Polymorphism, constraints, and shared interfaces | Instantiate repeated type variables consistently; explain `Eq`/`Num` constraints; compare sequencing across `Maybe`, `Either`, and IO after concrete examples | Diagnose a signature/implementation mismatch; explain how sequencing behaves in each context and why its result is not an arbitrary extraction operation. |
| 10. Integration and return | Select representations and functions for a new problem; explain failures and tradeoffs | Complete an independent project, followed later by shorter transfer tasks. |

Types should recur throughout, rather than disappear after stage 2. Introduce the minimum demand model needed by an earlier example, then deepen it in stage 7. A small IO wrapper can provide motivation early without requiring a general monad lecture. Treat that wrapper transparently as supplied code until the learner is ready to explain it.

Begin simple polymorphic signatures during stage 2; stage 9 consolidates their scope and connects constraints to operations. Teach monadic sequencing through concrete successes and failures before naming the shared abstraction. Require learners to explain what changes between contexts, including short-circuiting and external effects. This continuation is a proposed sequence, not a verified optimum, and it should not be compressed into a single metaphor.

A suitable project is a small task-list or reading-log processor: model entries as data, select and transform entries, summarize them, validate an input, and add a simple interface. Start with already parsed data so file formats and libraries do not obscure the current learning objective. Later introduce an imperfect input and require an explicit error case. The project is a proposed integration vehicle, not a research-validated preferred domain.

### 5.3 The lesson interaction

Use a repeated but adaptable learning cycle:

1. **Present a purpose and one small example.** State the target distinction, not a list of features.
2. **Request a prediction and explanation.** Let learners record uncertainty. A prediction is useful even when wrong.
3. **Run or reveal one relevant step.** Keep the original prediction visible beside the result.
4. **Explain the discrepancy.** Ask which rule changed the learner's model; avoid feedback that only says “incorrect.”
5. **Modify a nearby case.** Change one semantic feature so the effect is attributable.
6. **Remove support and construct.** Provide a new specification that cannot be solved by copying a literal answer.
7. **Return after a delay.** Mix the concept with a previously learned one and assess it without the earlier hints.

Not every screen needs all seven steps. A learner demonstrating reliable knowledge can proceed; a learner making inconsistent predictions may benefit from another contrast. Do not adapt from a single wrong click alone. Use at least an explanation or another task before labeling a persistent misconception.

### 5.4 Four sample lesson specifications

These items are proposed teaching materials, **not validated tests**. Their answer logic was checked against language definitions; no local GHC execution was performed in this review.

#### Lesson A: A function still waiting for an argument

```haskell
sub :: Int -> Int -> Int
sub x y = x - y

pairSub :: (Int, Int) -> Int
pairSub (x, y) = x - y
```

Ask learners to predict the type of `sub 10`, the value of `sub 10 3`, and whether `sub (10, 3)` fits the signature. The expected answers are `Int -> Int`, `7`, and a type mismatch. Have them group the applications as `(sub 10) 3`, then compare `pairSub (10, 3)`.

Feedback should identify the argument that was supplied and what remains required. Avoid introducing category theory or point-free notation here. For transfer, give a differently named two-argument function and ask learners to use its partial application inside `map`. Assess the type explanation separately from the final list.

#### Lesson B: Plan a transformation before composing functions

Specification: given `[[Int]]`, keep rows that contain an even number and return each retained row's length. Begin with `[[1,3],[2,3],[],[4]]`. Ask for the intermediate collection and final result before code. Expected: `[[2,3],[4]]`, then `[2,1]`.

One solution is:

```haskell
rowLengths :: [[Int]] -> [Int]
rowLengths rows = map length (filter (any even) rows)
```

A different task—count the even elements in every row—would produce `[0,1,0,1]`. Use that contrast to test whether the learner understood the specification, rather than assuming every wrong answer is a problem with `map`. Fade the intermediate-value aid, then change the task to keep rows of a minimum length and transform their contents. Accept correct solutions with different structure.

In a separate behavioral checkpoint, compare `filter even [2,4,1,6]` with `takeWhile even [2,4,1,6]`: the results are `[2,4,6]` and `[2,4]`. Ask learners to invent another input that distinguishes the functions, then explain why an all-even input is a poor discriminator.

#### Lesson C: Demand only what the result needs

```haskell
xs :: [Int]
xs = [undefined]
```

Ask whether obtaining `length xs` requires the element's value, and contrast it with demanding `head xs`. The former yields `1`; the latter raises the undefined error. Explain the difference between the list's structure and its element, then use a fresh case to test the distinction.

Later compare `foldl (-) 0 [1,2,3]` with `foldr (-) 0 [1,2,3]`: `-6` versus `2`. First write the associations; do not describe them as mandatory execution directions. Only after that introduce `foldr const 0 [1..] :: Integer`, which can yield `1`. Use bounded stepping and a stop control for divergent examples; a frozen browser is not useful feedback.

#### Lesson D: An action and its result

```haskell
main :: IO ()
main = do
  let action = getLine
  name <- action
  return ()
  putStrLn ("Hello, " ++ name)
```

Ask for the types of `action` and `name`, and whether the greeting runs. Expected: `IO String`, `String`, and yes. The key distinction is sequencing an action and binding its result; `return` does not exit this block.

Next, ask learners to write a pure greeting function and use it inside the IO program. The transfer task changes validation requirements, requiring a pure decision plus an effectful response. Explain GHCi's execution of IO actions explicitly so a prompt transcript does not suggest that `IO String` and `String` are interchangeable.

### 5.5 Feedback and assessment behavior

A useful tutorial should distinguish these states in learner-facing language:

| State | Appropriate response |
| --- | --- |
| Syntax or type error | Explain the relevant constraint and point to a small, meaningful region; preserve access to the compiler's original message. |
| Program runs but violates the specification | Show a counterexample with expected and actual behavior, then ask for an explanation. |
| Visible checks pass | State what was checked; request an explanation or a new case before inferring understanding. |
| Correct but unfamiliar solution | Accept it if independently validated; do not reject it merely for differing from a stored model. |
| Incomplete or unsupported analysis | Say what the environment cannot yet assess and offer a useful next step. |
| Timeout or resource limit | Explain the execution limit without equating it automatically with a logical error. |

Offer hints in increasing detail: restate the goal, identify the relevant concept, expose an intermediate relationship, then show part of a solution. Learners should be able to request help without penalty or shame. After a full solution, use a different problem to assess learning; copying the revealed answer is not independent success.

For type feedback, display expected and actual relationships with concrete substitutions and grouped application. For recursion, separate missing cases from incorrect combination. For folds, show the association with a deliberately discriminating operator. For IO, annotate action and result types. Keep these aids tied to the current task and remove them from the independent check.

Ask learners to propose a small test and its expected result before running an implementation. Later, ask them to distinguish a correct implementation from one plausible faulty variant. Grade what the test reveals, not merely the number of submitted cases. For lazy or infinite structures, specify a bounded observation so a test does not accidentally demand an entire unbounded value. Planning can use a short sentence, a typed intermediate expression, or a sketch; require enough detail to explain composition without forcing one notation.

If AI assistance is added, keep deterministic compilation/tests as independent checks, ground feedback in the actual program state, and clearly distinguish an uncertain suggestion from a verified counterexample. Evaluate answer leakage and dependence. The reviewed LLM-message study is not a verdict on every future model; it is a reason to measure the actual learning behavior of the chosen implementation.

### 5.6 Accessibility and platform boundaries

Accessibility is a product requirement, not an optional intervention variable. Provide keyboard operation, visible focus, readable text, text-based error explanations, and equivalents for visual traces. A sequence of labeled expressions should communicate the same rule as an animation. Avoid color-only type relationships and drag-only exercises; allow a textual alternative for reordering steps. Let learners control motion and pace. Apply the repository's WCAG 2.2 AA requirements when this blueprint is implemented.

Identify the supported language and compiler version. A teaching interpreter should explain unsupported constructs as an environment limitation, distinguish them from invalid Haskell, and provide a route to standard tooling. Keep essential help in a predictable place. Exportable code and a clear transition to files and a normal REPL reduce the chance that learners only know how to operate the tutorial.

This report creates research artifacts only. It does not implement or audit an interactive tutorial, and it makes no accessibility-compliance claim for the external resources reviewed.

## 6. Evaluation plan for a future tutorial

### Questions and outcomes

Evaluate whether learners can **explain and independently use** the targeted concepts. Keep the following outcomes separate:

| Outcome | Example measure | Main interpretation risk |
| --- | --- | --- |
| Conceptual prediction | New application, type, or demand example plus explanation | Guessing, memorized surface patterns |
| Independent construction | Implement an unseen specification with equivalent difficulty | Prior knowledge, copied or generated code |
| Debugging understanding | Diagnose, repair, and explain a novel error | Repeated trial-and-error can mimic mastery |
| Retention | Delayed concept and programming tasks | Attrition, practice between sessions |
| Transfer | New representation or problem requiring the same principle | Unmeasured prerequisite difficulty |
| Experience/access | Friction reports, observed barriers, help use | Satisfaction is not learning |

Use a small think-aloud pilot to refine wording and discover unexpected interpretations. Then compare a focused intervention with a credible alternative using similar instructional time, content, and assessment opportunities. For example, test prediction-plus-explanation before execution against example reading with equivalent practice, rather than comparing a complete new platform with an under-resourced control.

Randomize learners when feasible, or use classroom-level assignment while accounting for clustering. Record prior languages and baseline performance. Counterbalance parallel task forms where order could matter. Score explanations with a preregistered rubric and masked condition labels where practical. Measure supported task performance and unsupported transfer separately.

A delayed check around one or two weeks is a reasonable **pilot choice**, not a literature-established optimum. Set the interval according to the intended course retention goal and report intervening practice. Determine sample size from the smallest practically useful effect and the design's clustering/repeated measures; do not invent a sample size from an unrelated study's effect.

### Reporting and decisions

Report assigned, participating, and completing learners separately. Use the learner as the appropriate unit for learner-level conclusions; thousands of interactions do not create thousands of independent participants. Retain null and negative findings, uncertainty intervals, and the distribution of outcomes. Investigate whether a helpful overall average conceals poorer results for learners needing more support.

Set decision criteria before examining results. A feature may merit retention if it improves access or reduces avoidable frustration with no material learning harm, even without a higher mean test score. A feature that speeds completion but weakens independent explanations needs redesign. Usage, streaks, and completion badges should not serve as the main definition of learning.

Collect only necessary learning data, explain collection, and separate research participation from access to instruction where possible. Preserve enough task/version information to interpret logs without collecting unrelated personal information.

## 7. Evidence gaps and research opportunities

Within this retrieved corpus, the largest gaps are:

1. **Belief-level diagnosis.** Many papers analyze errors or repairs. More interview-plus-task work is needed to distinguish notation problems, missing knowledge, and persistent mental models.
2. **Modern Haskell concepts beyond early tasks.** Evidence about contemporary type-class, effect, and monad learning is thinner than the available discussion of syntax and type errors. This search does not establish that such studies do not exist.
3. **Delayed, independent transfer.** Tutor accuracy and favorable perceptions are common outcomes among inspected tools; fewer directly establish what learners can do later without the aid.
4. **Sequence comparisons.** There is no verified universal ordering for recursion, higher-order functions, algebraic data, IO, and laziness in the reviewed material.
5. **Heterogeneous and accessible learning.** Prior-language experience, first-language learners, disability-related access, and self-paced versus classroom conditions need explicit investigation rather than assumed equivalence.
6. **AI support without dependence.** Measure when a suggestion improves the learner's model and when it merely supplies a repair. Current model-specific findings should not be generalized indefinitely.

The most useful next study for this project would test a small misconception-targeted module on application/types or higher-order composition, with an explanation task and delayed independent programming outcome. That would address a concrete local decision while improving the evidence beyond platform satisfaction.

## 8. Research package and use

- [Annotated bibliography](output/bibliography.md): source-level methods, access status, relevance, and limitations.
- [Structured database](output/database.json), [CSV export](output/database.csv), and [BibTeX references](output/bibliography.bib): reusable records, including clearly labeled contextual and access-limited items.
- [Search log](memos/search-log.md) and [screening ledger](data/screening.json): discovery, deduplication, decisions, and citation paths.
- [Misconception research notes](notes/misconceptions.md), [pedagogy notes](notes/pedagogy.md), and [tutorial inspection notes](notes/tutorials.md): detailed extraction and diagnostic examples.
- [Additional misconception snowballing](notes/snowball-misconceptions.md) and [additional tutor snowballing](notes/snowball-tutors.md): new findings and verified citation paths in both directions.
- [Approved scope](memos/scope.md) and [evidence protocol](memos/evidence-protocol.md): review boundaries and appraisal rules.

Use this report to select and test teaching designs. Use the linked primary papers and access labels when making stronger scholarly claims. The distinction between observed difficulty, tested learning effect, and proposed design should remain visible in any tutorial or publication derived from this work.
