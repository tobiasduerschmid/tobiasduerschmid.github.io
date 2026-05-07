# Decision Protocol — the pause before non-trivial code changes

> The long-form version of the "pause" referenced in `SKILL.md`. Read this when the change is **non-trivial** — adding a feature, restructuring a module, deciding where new behaviour lives, or anything that crosses a layer boundary.

This file exists because the **largest single failure mode** in LLM-written code is jumping straight from "I understand the request" to "I am writing code", skipping the seconds of design thinking that would change *where* the code goes, *what* the function looks like, and *what its contract is*. Those seconds save hours of later refactoring.

This is **not a rigid checklist**. It is a script for an internal monologue. Once it is automatic, it takes seconds. The first few times you walk it explicitly, it will feel slow — that is the cost of building the habit.

## Table of contents

1. [Step 0 — Trivial vs non-trivial](#step-0--trivial-vs-non-trivial)
2. [Step 1 — Name the concern](#step-1--name-the-concern)
3. [Step 2 — Find the right place](#step-2--find-the-right-place)
4. [Step 3 — Articulate the contract](#step-3--articulate-the-contract)
5. [Step 4 — Identify the test](#step-4--identify-the-test)
6. [Step 5 — Refactor first, if needed (Beck's rule)](#step-5--refactor-first-if-needed)
7. [Step 6 — Stay in scope](#step-6--stay-in-scope)
8. [Step 7 — Self-check before declaring done](#step-7--self-check-before-declaring-done)
9. [Anti-patterns to watch for](#anti-patterns-to-watch-for)

---

## Step 0 — Trivial vs non-trivial

Before doing anything, decide: **does this change need the protocol?**

**Trivial — skip the protocol:**
- Typo / wording fix in a string or comment.
- Renaming one identifier across one file.
- Bumping a dependency version (assuming it builds and tests pass).
- Adding a CSS color variable that follows the existing pattern.
- Moving a single existing line to a more sensible spot.

**Non-trivial — walk the protocol:**
- Adding a feature, even a small one.
- Adding or changing a function signature, type, or schema.
- Splitting / merging files, modules, classes.
- Adding a new dependency.
- Changing error-handling behaviour.
- Adding a new I/O point (DB call, network call, file write).
- Adding a new test that pins behaviour.
- Anything that crosses a module / layer / package boundary.

When in doubt, walk it. The protocol is short.

---

## Step 1 — Name the concern

Articulate, in **one sentence without "and"**, what this change is responsible for. Examples:

- ✓ *"This change adds the rule that a refund request older than 30 days requires manager approval."*
- ✓ *"This change persists the user's chosen tutorial step so reloads don't lose progress."*
- ✓ *"This change wraps the SendGrid client behind an `EmailGateway` interface so we can test without hitting the network."*

Examples that fail the test (because they need "and"):

- ✗ *"Adds the 30-day refund rule **and** logs the decision **and** sends a notification."* — three concerns. Likely three changes (or one orchestrator change + three single-concern changes).
- ✗ *"Persists the tutorial step **and** also fixes the dark-mode bug while I'm here."* — two unrelated changes. Two PRs.

**Why this matters.** If you can't name the concern in one sentence, you don't yet know what you're doing — and code written from confusion has confused structure. Name it first; the code follows.

**For ambiguous user requests** ("clean this up", "make this better", "refactor this"), the first job is to *name the concern back to the user* and confirm. Otherwise you are guessing what they wanted.

---

## Step 2 — Find the right place

Now that you've named the concern, look at the existing structure: **is there already a module / class / function whose job is concerns like this one?**

- If **yes**, the change goes there. Adding a refund rule to an existing `RefundPolicy` class is the right move; creating a new `RefundManagerService` next to it is wrong.
- If **no**, you are about to introduce a new boundary. **Pause and decide where it lives** before writing the code. Ask:
  - What's the right name for the new unit? (See the *Names* section in [clean-code.md](clean-code.md).)
  - What's its responsibility, in one sentence (Step 1 again, recursively)?
  - Where in the package / directory tree does it belong? (See [modularity.md](modularity.md) — package by feature / component / layer.)
  - Which side of any layer boundary is it on? (See [architecture.md](architecture.md) — the dependency rule.)

**Watch out for the path of least resistance.** It is always tempting to put the code "where you happened to be looking when you got the request". That's how `Utils.java` files swell to 4000 lines and `helpers.ts` becomes the project's true centre of gravity. Wrong-place code is a slow tax: every future reader has to re-derive why it lives there.

**Rules of thumb for "where it goes":**
- **Move method to where the data lives** (Feature Envy refactoring). If the new logic mostly operates on `Order`, it lives on `Order` (or on a class very close to it), not on `User`.
- **Group by reason-to-change** (CCP). Code that will change together belongs in the same module.
- **Cross fewer boundaries when possible.** If the change can live inside one feature module, that's better than threading it through three layers.

---

## Step 3 — Articulate the contract

For any new function / method / class / module you're about to write or change, name its **contract**:

- **Inputs.** What types? What range / preconditions? Required or optional?
- **Outputs.** What type? What guarantees about the value? Empty-list semantics? Optional / null / `Result` semantics?
- **Side effects.** What does this touch besides its return value? DB? File? Network? Mutates an argument? Logs?
- **Failure modes.** What can go wrong? Does it throw? What types? Does it return an error? Does it ever return a partial result?
- **Invariants.** What is true before and after? (E.g. "the input list is not modified"; "this leaves the connection pool in the same state".)

**You do not always have to write this down.** For a small private helper, just thinking it through is enough. For a public API or a function that will be called from many places, write it as a docstring; that *is* the contract becoming text.

**Contract first, implementation second.** If you can't articulate the contract, the code that follows will be fuzzy. Conversely, once the contract is clear, the implementation often writes itself.

**Trust the contract.** Once a function's contract is clear, callers should not defensively re-validate. The contract says "non-empty list"; callers who pass non-empty lists succeed; callers who don't are violating the contract — that's their bug, not yours. (See [design-principles.md](design-principles.md) — Design by Contract.)

---

## Step 4 — Identify the test

You don't always have to *write* a test. (This codebase mixes test-required and test-optional changes.) But you do have to be able to **describe**, in one sentence, the test that would catch a regression in the contract you just articulated.

Examples:

- ✓ *"A test that calls `refund(order_id, age_in_days=31, requester=non_manager)` and expects `ApprovalRequired` exception."*
- ✓ *"A test that calls `getStudentProgress('test-tutorial')` after `setStudentProgress('test-tutorial', step=3)` and expects step=3."*
- ✓ *"A test that calls `EmailGateway.send(...)` with a fake adapter and expects the adapter to have recorded one message with the right subject and body."*

If you can't describe the test, the contract is not yet clear — go back to Step 3.

**For pure refactorings** (no behaviour change), the test is "the existing test suite passes unchanged". This is *the* property that defines refactoring; if you broke a test, you weren't refactoring.

**For non-trivial behaviour changes**, write the test — even if "the codebase doesn't usually have tests". A single new test pins the new contract; future changes can't silently regress it. The cost is small; the leverage is enormous.

---

## Step 5 — Refactor first, if needed

Beck's rule:

> *When you find you have to add a feature to a program, and the program's code is not structured in a convenient way to add the feature, first refactor the program to make it easy to add the feature, then add the feature.*

Look at the place where the new code is going to land. **If the existing structure makes the addition awkward, refactor the existing structure first** — as a separate, behaviour-preserving change, with the test suite green at every step.

Common preparatory refactorings:
- **Extract Function** to give a name to a block you're about to modify. Then the modification is small and local.
- **Move Method** so that the new logic lands close to the data it operates on (avoiding new Feature Envy).
- **Replace Conditional with Polymorphism** if you're about to add a new branch to a switch that already has 5 — and you'd be repeating that switch elsewhere (Single Choice Principle).
- **Introduce Parameter Object** if you're about to add a 7th parameter — bundle the related ones first.

**Two hats** (see [refactoring.md](refactoring.md)): wear the refactoring hat first (no behaviour change, tests green throughout), then take it off and put on the feature hat.

**When NOT to refactor first:**
- The deadline is hours away.
- You don't have the tests needed to refactor safely. (Then the right move is *add tests*, *then refactor*, *then feature*. Three small steps beat one big risky step.)
- The refactor is much bigger than the feature itself, in which case the right thing may be to do the feature in a quick local way, ship, *then* do the bigger refactor as its own work.

---

## Step 6 — Stay in scope

> *Refactoring and adding function are two different hats; wear one at a time.* — Fowler

While you're working, you will notice adjacent code that *also* needs cleanup. The temptation is "while I'm here, let me also fix this". Resist.

**Why:**
- Mixing makes the change hard to review (reviewers can't tell which line is the feature, which is the cleanup).
- If something goes wrong, you can't revert the feature without losing the cleanup (or vice versa).
- The feature and the cleanup may have different urgency / risk profiles.
- Bundled changes hide each other in the diff, increasing the chance one is wrong.

**Instead:**
- For *preparatory* refactoring that the feature actually requires — fine, do it first as a separate commit (Step 5).
- For *opportunistic* cleanup of unrelated nearby code — surface it. Make a note (TODO file, follow-up issue, mention in PR description). Don't silently bundle.
- For *security or correctness fixes* you spot in passing — don't ignore them. Either fix them as a separate, clearly-flagged commit, or surface them so the user can prioritize.

**The Boy Scout Rule** ("leave the campsite cleaner than you found it") is real, but its scope is **the code you're already touching for another reason** — not "every adjacent file". A diff that touches 30 files for what was supposed to be a 3-file feature is a code review nightmare.

---

## Step 7 — Self-check before declaring done

Before saying "this change is done", run the eight-point self-check from `SKILL.md`:

1. **Concern named.** Could you state in one sentence what each new/changed unit is responsible for?
2. **Names carry weight.** Every new identifier reveals intent; nothing is misleading; nothing required mental translation.
3. **Contract explicit.** Inputs, outputs, side effects, failure modes of any non-trivial new function are clear from the signature, types, and (for public APIs) docstring — or pinned by a test.
4. **Dependencies point inward.** No domain code imports infrastructure; volatile concerns sit behind interfaces / dependency-injected.
5. **No premature defence.** Not catching exceptions you can't actually handle, not null-checking inside trusted boundaries, not adding "just in case" abstractions.
6. **No unrelated changes.** This change does not bundle a refactor of adjacent code unless the refactor was needed to make the change itself clean.
7. **The future reader test.** Could you (six months from now, half-asleep) understand the change without reading the diff?
8. **Tests describe behaviour, not implementation.** A reasonable refactor of internals shouldn't break the test.

If any check fails, fix it now. Cleanup later almost never happens.

---

## Anti-patterns to watch for

The recurring failure modes in LLM-written code:

- **"Tests pass, ship it."** Functional correctness is the floor, not the ceiling. The change isn't done when it works; it's done when it's also reasoned-about and structured for change.

- **Defensive programming everywhere.** Try/catch around `1 + 1`, null-checks on values that came from validated input, "just in case" branches that handle conditions the system makes impossible. This is ritual safety — it doesn't actually catch bugs (they're already absent) and it obscures the real algorithm.

- **The kitchen-sink service class.** A `UserService` that does validation, persistence, business logic, formatting, notification, and audit logging. Almost always wrong. (See SRP in [design-principles.md](design-principles.md).)

- **Premature abstraction.** Adding an interface, a factory, a generic, a hook "in case we need it later". Pay the abstraction tax when the second instance arrives, not before. (See *Speculative Generality* in [refactoring.md](refactoring.md).)

- **Path-of-least-resistance code placement.** Putting a new function "where the imports already exist", instead of where the *concern* belongs. (See Step 2.)

- **Comments to apologize for code.** A 6-line comment explaining what the code does is the code's confession that it isn't clear. Fix the code; delete the comment.

- **Mixing refactor and feature.** A change that is half cleanup and half new behaviour, with no clear seam between them. Two changes pretending to be one. (See Step 6.)

- **"Useful" abstractions with no second user.** A `BaseHandler<T extends Request, R extends Response>` with one subclass and one usage. The abstraction's only payoff is when it has multiple users; one user is just indirection.

- **Domain code that imports infrastructure.** The DB driver, the HTTP framework, the env var, the logger. The dependency is pointing the wrong way. Invert it. (See [architecture.md](architecture.md) — dependency rule.)

- **The "while I'm here" tax.** A 3-file feature that touches 30 files because of in-passing cleanup. Hard to review, hard to revert, easy to break.

---

## Cross-references

The other reference files are the **deeper** material this protocol points to:

- For the line-, function-, name-, comment-level rules: [clean-code.md](clean-code.md)
- For SOLID and Design by Contract: [design-principles.md](design-principles.md)
- For module-level cohesion / coupling and packaging: [modularity.md](modularity.md)
- For the smell catalog and refactoring recipes: [refactoring.md](refactoring.md)
- For the dependency rule, layers, quality attributes: [architecture.md](architecture.md)
