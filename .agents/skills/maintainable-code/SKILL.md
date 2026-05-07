---
name: maintainable-code
description: >-
  Project rule that every code change must be reasoned about for maintainability before functionality. USE THIS SKILL EVERY SINGLE TIME you write, edit, review, refactor, design, or remove anything that ends up in source code — any function / method / class / module / file in any language (`.js`, `.ts`, `.tsx`, `.jsx`, `.py`, `.rb`, `.go`, `.rs`, `.java`, `.kt`, `.c`, `.cpp`, `.h`, `.cs`, `.swift`, `.scala`, `.php`, `.html`, `.css`, `.scss`, `.sql`, `.sh`, `.yml`, `.json`, `.xml`, etc.), any new file you create, any existing file you edit, any name you choose (variable / function / class / file / module / folder), any control-flow change (if / switch / loop / try-catch / early return / guard clause), any data shape (struct / record / interface / type / schema / table), any dependency you add or remove (npm / pip / gem / cargo / module import / require / `from x import y`), any abstraction boundary (function signature, class API, module export, package boundary, service boundary, IPC, network call, DB call), any side effect (I/O, mutation of shared state, network, file system, DB write, global variable, singleton), any configuration / feature flag / env var, any test you add / change / delete, any error-handling path (throw / catch / null check / Result / Option / panic), any type signature / contract / precondition / invariant, any refactoring (rename / extract / inline / move / replace conditional / introduce parameter object), any architectural choice (layer / package / service / boundary / dependency direction), any concurrency primitive (lock / channel / mutex / atomic / async / await / Promise / Future / thread / process). Trigger when the user asks for "implement X", "add a feature", "fix this bug", "refactor this", "clean this up", "make this better", "this is too complex", "extract this", "move this", "rename this", "split this file", "DRY this", "abstract this", "make this configurable", "add error handling", "add a test", "design X", "how should I structure X", "what's the right architecture for Y", "review my code", "is this idiomatic", "any code smells here", "should this be its own class / function / module / service", or any task whose output ends up in a code repository. The skill embodies the synthesis of Clean Code (Martin), Clean Architecture (Martin), Refactoring (Fowler), Software Architecture in Practice (Bass/Clements/Kazman), Software Architecture for Developers (Brown), Just Enough Software Architecture (Fairbanks), Architecting Software-Intensive Systems, and Object-Oriented Software Construction (Meyer). It is **not optional advice** — code that "works" but is structured poorly imposes a recurring tax on every future reader and every future change. The job is **not done when the tests pass**; it is done when a future maintainer (you, six months from now, half-asleep) can read the code and the change is locally reasoned-about. Reach for sub-skills under `references/` whenever you are about to do non-trivial design or refactoring work.
---

# Maintainable Code

## Why this skill exists, and what it is asking of you

> *Indeed, the ratio of time spent reading versus writing is well over 10 to 1. We are constantly reading old code as part of the effort to write new code. … Therefore, making it easy to read makes it easier to write.* — Robert C. Martin, *Clean Code*

> *When you find you have to add a feature to a program, and the program's code is not structured in a convenient way to add the feature, first refactor the program to make it easy to add the feature, then add the feature.* — Kent Beck, quoted in Fowler's *Refactoring*

> *A simple architecture will always be easier to adapt to changes than a complex one … the more autonomous the modules, the higher the likelihood that a simple change will affect just one module, or a small number of modules, rather than triggering off a chain reaction of changes over the whole system.* — Bertrand Meyer, *OOSC2*

Functional correctness is the **floor**, not the ceiling. The cost of software is dominated by the changes it absorbs over its lifetime — bug fixes, new features, refactors, integrations, replatforms, regulatory updates. Every line of code you write today will be read, modified, debugged, and deleted by someone (often you) under time pressure. The work of making code *easy to change later* is the work that pays compounding interest.

LLMs (you included) have a measurable failure mode here: it is very tempting to optimise for "the prompt was satisfied / the tests are green" and stop. That ships code that *works once*, but accumulates as project debt. This skill exists to make you stop, identify the real concerns, and structure the change so a future reader can re-derive your reasoning without re-running it in their head.

This is a **mindset skill**, not a checklist. The principles below all push in the same direction: *separate things that change for different reasons, name what each thing is responsible for, hide what doesn't matter, and write down what's true.*

## The five pillars

Internalise these five. Almost every concrete rule in the deeper references is an instance of one of them.

### 1. Separation of concerns is the master rule

A concern is a reason a piece of code might change. The *Single Responsibility Principle* (Martin) says it precisely: **a module should have one, and only one, reason to change.** Concerns include: the business rule itself, the user-facing presentation, the I/O / persistence, the transport / serialisation, the error-recovery policy, the logging / telemetry, the concurrency strategy, the configuration / environment, the test scaffolding.

When you write or edit code, name the concerns *before* you write a line. If you cannot say "this function/class/module is responsible for **X** and only **X**" in one sentence without using "and", the boundary is wrong. Mixing concerns is what produces *Divergent Change* (one module touched for many unrelated reasons), *Shotgun Surgery* (one change rippling across many modules), and *Feature Envy* (logic living far from the data it operates on) — three of the heaviest smells from Fowler's *Refactoring*.

### 2. Names carry the design

> *The name of a variable, function, or class, should answer all the big questions. It should tell you why it exists, what it does, and how it is used.* — *Clean Code*

Names are the primary debugging aid for human readers. If you find yourself writing a comment to explain what a function does, the function is misnamed (or doing too much — see pillar 1). Use **intention-revealing** names (`elapsedTimeInDays` not `d`); **avoid disinformation** (don't call it `accountList` if it is not a `List`); **make distinctions meaningful** (`getActiveAccount` vs `getActiveAccountInfo` is meaningless noise); **use the language of the domain** (the same word the user would say). Class names are nouns; method names are verbs; boolean predicates read as questions (`isEmpty()`, `hasNext()`).

A misleading name is worse than no name at all — it actively constructs a false mental model in the reader. Renaming is one of the cheapest, highest-value refactorings; do it when you notice the mismatch, not "later".

### 3. Hide what does not matter; expose only what does

The *Information Hiding* principle (Parnas / Meyer) is older than OO and outlives every language fad: **a module's clients depend on its interface, not its implementation, and the interface should reveal only what the client needs to know.** This is what makes change cheap — if you can change the implementation behind a stable interface, the blast radius of a change is one module.

Practical consequences: prefer narrow public APIs, default to private/internal, return abstractions (interfaces, protocols, traits) rather than concrete types where the caller doesn't need the concrete type, don't leak a database row / ORM entity / framework type through three layers, don't expose a mutable internal collection. The **Law of Demeter** ("only talk to your immediate friends") and the **Uniform Access Principle** (Meyer: clients shouldn't care whether `account.balance` is a stored field or a computed property) are both expressions of this pillar.

### 4. Depend in the direction of stability — and never on details

The *Dependency Rule* (Martin's *Clean Architecture*): **source-code dependencies must point inward, toward higher-level policy.** Business rules / domain entities are the most stable; frameworks, databases, the web, the UI, and third-party services are the least stable. Stable code must not depend on unstable code; the unstable code adapts (via interfaces it doesn't own) to the stable code. This is the *Stable Dependencies Principle* and the *Dependency Inversion Principle* working together.

Concrete cue: if a domain function imports an ORM, an HTTP client, a logger framework, or `os.environ` directly, the dependency is pointing the wrong way. Push the volatile thing behind an interface owned by the domain, and inject it (constructor parameter, function argument, factory). The domain becomes testable, replaceable, and survives the next framework migration.

### 5. Make the contract — and the test that proves it — explicit

> *A contract … is a precise specification of what a routine does (its postcondition and frame), what it requires (its precondition), and what is invariant about its enclosing object.* — *OOSC2*, on Design by Contract

Every non-trivial function has an implicit contract: the inputs it accepts (precondition), the outputs / state it guarantees (postcondition), and the invariants it preserves. Make this contract visible — through types, runtime assertions at boundaries, docstrings on public APIs, or the test that pins the behaviour. Then trust internal callers and **don't pad every function with defensive null-checks and try/except** that obscures the actual logic. Validate at the system boundary (user input, network, file system); inside the boundary, types and the test suite carry the load.

Tests are not a separate concern from design; the *testability* of a unit is a direct readout of how cleanly its concerns are separated and how narrow its contract is. If a function is hard to test (lots of mocking, lots of setup, brittle when refactored), that is a design signal — almost always pointing to one of pillars 1–4.

## Before you change code: the pause

This is the single most important habit. **Before you write or edit a line of non-trivial code**, walk this protocol in your head (it takes seconds once it is automatic). For trivial edits (typo fix, comment tweak, dependency bump that compiles), skip it.

1. **What is the concern?** State it in one sentence without "and". Example: *"This change adds the rule that an order over $500 requires manager approval."*
2. **Where does that concern belong?** Look at the existing structure. Is there already a module / class / function that owns rules like this? If yes, the change goes there. If no, you are about to introduce a new boundary — pause and decide where it lives. Putting it "where it's easy to put it" is how *Big Balls of Mud* are built.
3. **What is the contract of the unit I'm about to write or change?** Inputs (and what they're allowed to be), outputs, side effects, exceptions / failure modes. If you can't articulate it, you don't yet understand the problem well enough to code it.
4. **What test would catch a regression in this contract?** You don't always have to write the test (the codebase / task may dictate), but you have to be able to *describe* it. If you can't describe a test, the contract is fuzzy.
5. **What concerns does this change *not* belong to?** Resist the temptation to "while I'm here" rewrite adjacent code. Refactoring and feature-adding are two different hats (Fowler's *two hats*); wear one at a time.

When the change is non-trivial — adding a feature, restructuring a module, deciding where a new piece of behaviour lives, or anything that crosses a layer boundary — read [`references/decision-protocol.md`](references/decision-protocol.md) for the long-form version, including the "refactor first, then add the feature" workflow.

## Smell-detection triggers — when to STOP and reach for a reference

These are the conditions under which "just shipping" is the wrong move. When you notice any of them while writing or reading code, pause and consult the linked reference before continuing.

| You notice yourself… | Reach for |
|---|---|
| …writing a function longer than ~20 lines, more than ~3 levels of nesting, or with more than ~3 parameters | [`references/clean-code.md`](references/clean-code.md) — Functions section |
| …writing a comment that explains what code *does* (rather than why a non-obvious choice was made) | [`references/clean-code.md`](references/clean-code.md) — Comments section |
| …writing a `switch` / long `if-else if` chain on a *type code* or *enum that drives behaviour* | [`references/refactoring.md`](references/refactoring.md) — *Replace Conditional with Polymorphism* |
| …copy-pasting code with small modifications, or noticing two blocks that "look similar" | [`references/refactoring.md`](references/refactoring.md) — duplication smells, *Extract Function*, *Form Template Method* |
| …passing 4+ parameters to a function, especially if some travel together | [`references/refactoring.md`](references/refactoring.md) — *Long Parameter List*, *Introduce Parameter Object*, *Preserve Whole Object* |
| …having to change several files to add one piece of behaviour (Shotgun Surgery), OR one file changes for many unrelated reasons (Divergent Change) | [`references/modularity.md`](references/modularity.md) — cohesion, SRP, Common Closure |
| …a low-level module importing a high-level one (e.g. domain importing the ORM, business logic importing the HTTP framework) | [`references/design-principles.md`](references/design-principles.md) — DIP, Stable Dependencies |
| …unsure how to split a new feature across modules, or whether to introduce a new layer / service / package | [`references/architecture.md`](references/architecture.md) — boundaries, dependency rule, risk-driven |
| …about to add a try/catch / null check / validation that "feels defensive" | [`references/clean-code.md`](references/clean-code.md) — Error Handling; [`references/design-principles.md`](references/design-principles.md) — Design by Contract |
| …about to introduce an abstraction "in case we need it later" | [`references/refactoring.md`](references/refactoring.md) — *Speculative Generality*; YAGNI |
| …about to design a new component, choose a quality-attribute trade-off, or reason about modifiability / performance / security holistically | [`references/architecture.md`](references/architecture.md) — quality attributes, tactics, risk-driven model |
| …doing a non-trivial change and want the full mental protocol | [`references/decision-protocol.md`](references/decision-protocol.md) |
| …writing or editing **any `.js` / `.mjs` / `.cjs` / `.jsx` / `.ts` / `.tsx` file** — especially anything with `this`, arrow functions, async/await, Promises, modules, mutation, or framework code (React/Vue/Svelte/Angular) | [`references/javascript.md`](references/javascript.md) — JS/TS-specific traps that the language-agnostic principles do not warn you about |

If a row matches, **load the linked file before proceeding**. The references encode hard-won lessons that are not derivable from reading the surrounding code; skipping them is how the same mistakes ship over and over.

## What "done" looks like

Before declaring a code change finished, run this self-check. It is the synthesis of *Clean Code*'s "boy-scout rule", Fowler's "leave the code cleaner than you found it", Meyer's external/internal quality factors, and Bass et al.'s quality-attribute discipline.

- **Concern named.** I can state in one sentence what each new/changed unit is responsible for.
- **Names carry weight.** Every new identifier reveals intent; nothing is misleading; nothing required me to mentally translate (`d` → `elapsedDays`).
- **Contract explicit.** Inputs, outputs, side effects, and failure modes of any non-trivial new function are clear from its signature, type annotations, and a docstring (for public APIs) — or pinned by a test.
- **Dependencies point inward.** No domain code imports infrastructure; volatile concerns sit behind interfaces / dependency-injected.
- **No premature defence.** I am not catching exceptions I can't actually handle, not null-checking inside trusted boundaries, not adding "just in case" abstractions for hypothetical futures.
- **No unrelated changes.** This change does not bundle a refactor of adjacent code unless the refactor was needed to make the change itself clean (Fowler's preparatory refactoring); if I noticed adjacent debt, I surfaced it rather than silently fixing it.
- **The future reader test.** If I (six months from now, half-asleep) opened this file, would I understand the change without reading the diff or the PR description? If not, the code — not the comment — needs work.
- **Tests describe behaviour, not implementation.** A reasonable refactor of internals shouldn't break the test. (See *Clean Code* ch. 9 — F.I.R.S.T. and the dual standard.)
- **The blast radius is local.** If I had to undo this change, the touched surface is small.

If any check fails, the change isn't done — fix it now, while the context is loaded into your head. Cleanup later almost never happens; the *Boy Scout rule* (leave the campsite cleaner than you found it) only works if it is applied *now*, in this commit.

## How to use this skill with the rest of the project

This skill encodes language- and framework-agnostic principles. It composes with the project's other always-loaded skills — they cover surface-specific concerns this one does not:

- **WCAG 2.2 AA compliance** (`wcag-aa-compliance/`) and **light/dark mode** (`light-dark-mode/`) handle browser-output concerns; this skill handles the structure of the code that produces that output.
- **`cookie-storage-tracker/`**, **`keyboard-glossary-tracker/`**, **`tutorial-authoring/`** are domain-specific authoring skills; they live alongside this one.

When two skills conflict (rare), the more specific project rule wins, but **document the trade-off** in the change rather than silently violating maintainability. There is almost always a structuring choice that satisfies both.

This skill exists because the books behind it (Clean Code, Clean Architecture, Refactoring, Software Architecture in Practice, Just Enough Software Architecture, Software Architecture for Developers, Architecting Software-Intensive Systems, OOSC2) accumulate decades of evidence that the cost of software is paid in maintenance, and the cost of bad maintenance is paid forever. Slow down. Name the concern. Place it well. Test the contract. Then ship.

## Reference index

Each reference is a self-contained sub-skill, loaded on demand. The triggers above tell you when to reach for which one. A short tour:

- **[clean-code.md](references/clean-code.md)** — Names, functions, comments, formatting, error handling, boundaries, tests. The line-level craft, drawn from *Clean Code* (Martin) and chapter 26 of *OOSC2* (Meyer).
- **[design-principles.md](references/design-principles.md)** — SOLID (SRP, OCP, LSP, ISP, DIP), Design by Contract, Information Hiding, Single Choice, Uniform Access. The class- and module-level principles, drawn from *Clean Architecture*, *OOSC2*, and *Agile Software Development: Principles, Patterns, and Practices*.
- **[modularity.md](references/modularity.md)** — Coupling and cohesion, component principles (REP/CCP/CRP and ADP/SDP/SAP), encapsulation strategies, package-by-feature vs package-by-layer. Drawn from *Clean Architecture* parts III–IV and *Just Enough Software Architecture* ch. 11.
- **[refactoring.md](references/refactoring.md)** — When to refactor, the two-hats rule, the catalog of code smells (bloaters / OO abusers / change preventers / dispensables / couplers), and the most common refactorings keyed to each. Drawn from Fowler's *Refactoring*.
- **[architecture.md](references/architecture.md)** — The dependency rule, boundaries, layers vs features, the C4 model, quality attributes (modifiability, testability, performance, security, availability, usability, interoperability) and their tactics, the risk-driven model. Drawn from *Clean Architecture*, *Software Architecture in Practice*, *Software Architecture for Developers*, *Just Enough Software Architecture*, and *Architecting Software-Intensive Systems*.
- **[decision-protocol.md](references/decision-protocol.md)** — The long-form reasoning protocol for non-trivial changes: when to refactor first, how to identify the right boundary, how to articulate a contract, how to pick the smallest test that pins the behaviour, how to spot premature abstraction.
- **[javascript.md](references/javascript.md)** — JavaScript- and TypeScript-specific overlay: variable scope and TDZ, `this` and arrow functions, equality and coercion, mutation/immutability, async/await and Promise traps, modules and barrel-file pitfalls, when functional patterns earn their place, the high-leverage TypeScript practices (`strict`, discriminated unions, branded types, `satisfies`), framework concerns (DOM hygiene, listener cleanup, business-logic placement), and the ESLint rules that catch real bugs. Read this whenever you are touching `.js` / `.mjs` / `.cjs` / `.jsx` / `.ts` / `.tsx`.
