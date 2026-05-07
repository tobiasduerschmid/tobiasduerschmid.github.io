# Clean Code — line-level craft

> Synthesised from *Clean Code* (Martin, 2008), *OOSC2* ch. 26 "A sense of style" (Meyer, 1997), and *Refactoring* (Fowler) chapters on composing methods.

This reference covers the line-, function-, and class-level craft that makes code readable. Read it whenever you trigger any of: long function, deep nesting, many parameters, comment explaining what code does, defensive try/catch / null check, or "this code is hard to follow".

## Table of contents

1. [Names](#names)
2. [Functions](#functions)
3. [Comments](#comments)
4. [Formatting and structure](#formatting-and-structure)
5. [Error handling](#error-handling)
6. [Boundaries (third-party code)](#boundaries-third-party-code)
7. [Tests as first-class code](#tests-as-first-class-code)
8. [Classes / modules at the small scale](#classes--modules-at-the-small-scale)

---

## Names

Names are the primary cognitive load in reading code. A bad name forces the reader to keep a translation table in their head; a good name lets them keep the actual problem in their head.

**Use intention-revealing names.** The name should answer *why it exists, what it does, and how it is used*. `int d; // elapsed time in days` is two failures: the comment is a smell (see Comments), and `d` carries no intent. `int elapsedTimeInDays` carries the intent without the comment. Likewise `getUsers()` is fine if it returns users; `getThem()` requires the reader to track what "them" refers to.

**Avoid disinformation.** Don't call something `accountList` if it isn't a `List` (use `accounts` or `accountGroup`). Don't use `l` and `O` in code (visually indistinguishable from `1` and `0`). Don't reuse a name in a sub-scope to mean a different thing.

**Make meaningful distinctions.** `getActiveAccount()` vs `getActiveAccounts()` vs `getActiveAccountInfo()` is meaningless noise — the reader cannot tell from the names which one to call. Either there's a real distinction (then encode it in the name: `findAccountById` vs `listActiveAccounts`) or there isn't (then there should be one function, not three).

**Use pronounceable, searchable names.** Code is discussed verbally and grepped textually. `genymdhms` is unpronounceable and unsearchable; `generationTimestamp` is both. Single-letter names (`i`, `j`, `e` for an exception) are fine in tiny scopes (a 3-line loop) but not when their lifetime exceeds a screen.

**Avoid encodings.** Hungarian notation (`strName`, `iCount`), member prefixes (`m_name`), and interface prefixes (`IShape`) all encode information the type system or naming convention can carry. They were workarounds for old tooling; modern editors render them as noise.

**Avoid mental mapping.** `for (int i = 0; i < 10; i++) { Customer c = customers[i]; ... }` requires the reader to remember `c` is a customer. `for (Customer customer : customers) { ... }` does not.

**Class names are nouns or noun phrases.** `Customer`, `WikiPage`, `Account`, `AddressParser`. *Not* verbs. *Not* `Manager`, `Processor`, `Data`, `Info` (these are noise — what does it actually *do*?).

**Method/function names are verbs or verb phrases.** `postPayment`, `deletePage`, `save`. Predicates that return booleans read as questions: `isEmpty()`, `hasNext()`, `isAuthenticated()`.

**One word per concept.** Don't use `fetch`, `retrieve`, and `get` interchangeably across the codebase to mean the same thing. Pick one and use it consistently. Conversely, don't pun: don't use `add` to mean "concatenate" in one place and "create new" in another.

**Use solution-domain names where the reader is technical** (`EventQueue`, `VisitorPattern`, `JobScheduler`) **and problem-domain names where the reader is domain-driven** (`Invoice`, `LedgerEntry`, `PolicyHolder`). When in doubt, prefer problem-domain names — they age better and survive technology changes.

**Add context only where needed.** Variables `firstName`, `lastName`, `street`, `city` floating around are confusing; gather them into an `Address` (or pass an `address` parameter and access `address.city`). Conversely, don't add gratuitous context: in a `gas-station-deluxe` codebase, `GSDAccountAddress` over `Address` is noise — the package already provides the context.

---

## Functions

> *The first rule of functions is that they should be small. The second rule of functions is that they should be smaller than that.* — *Clean Code*

**Small.** Aim for ~5–20 lines. The Steve McConnell ceiling of 100–200 lines is too generous; *Clean Code* argues for an order of magnitude tighter. The reason is not aesthetic — it is that a function reads top-to-bottom and your working memory is finite. If the function doesn't fit on one screen, the reader is paging.

**Do one thing.** A function should do one thing, do it well, and do it only. The test: can you extract a meaningful function from inside it that is *not* just a restatement of its name? If yes, the outer function was doing more than one thing. (E.g. `payEmployee()` that includes `if (employee.isPayday()) { calculatePay(); deliverPay(); }` is doing three things.)

**One level of abstraction per function.** Mixing levels — `getHtml()` (high), `String pagePathName = PathParser.render(pagePath)` (medium), `.append("\n")` (low) — confuses the reader about whether a phrase is a fundamental concept or a detail. Extract the lower-level steps into named functions. This is the *Stepdown Rule*: the file reads top-to-bottom as a narrative, with each function calling those one level below it.

**Few arguments.** 0 (niladic) > 1 (monadic) > 2 (dyadic) > 3 (triadic, suspect) > 4+ (avoid). Each argument is a thing the reader has to track; tests have to cover the combinations. If you have 4+ that travel together, they are probably a missing concept — introduce a parameter object.

**No flag arguments.** `render(true)` is a code smell. The boolean says "this function does two things — pick one". Split into two functions: `renderForSuite()` and `renderForSingleTest()`.

**No output arguments.** `appendFooter(report)` modifies `report` — but the reader can't tell from the call site whether `report` is in/out/inout. Prefer `report.appendFooter()` (the modification target is the receiver, where readers expect it) or a return value.

**Have no side effects.** Or if you do, name them. `checkPassword(user, pw)` that *also* logs the user in is a bug waiting to be filed. Either it's `checkPassword` (pure, returns a bool) or it's `checkPasswordAndLogIn` (and the second action is in the name).

**Command-Query Separation** (Meyer): a function either *does* something (command, returns void / unit, may have side effects) or *answers* something (query, returns a value, has no side effects). Mixing them — `if (set("username", "bob")) ...` where `set` both mutates and returns the previous value — produces code that is impossible to reason about. Two functions: `set` (command) and `getPrevious` (query).

**Prefer exceptions to error-return codes.** `if (deletePage(page) == E_OK) { if (registry.deleteReference(page) == E_OK) ... }` produces a Christmas tree of nested ifs. With exceptions, the happy path reads top-to-bottom, the error handling lives in one `catch` block, and the two concerns are separated. (See [Error handling](#error-handling).)

**Don't repeat yourself.** Duplication is the root of most software evil — change one copy, forget the other, and you have a bug. The cure is naming the concept and extracting a function. *But*: be careful with **incidental duplication** that happens to look similar but evolves separately. Three look-alike copies of a 4-line block are not always worth abstracting; sometimes the duplication is honest and the abstraction would couple unrelated concerns. (See [refactoring.md](refactoring.md) — *Speculative Generality*.)

**Structured programming.** Every function should have one entry and (ideally) one exit. *Clean Code* relaxes this for small functions: multiple `return`s are fine if they make the logic clearer; `break` and `continue` in small loops are fine. The principle to keep is: a function's control flow should be obvious.

---

## Comments

> *Comments do not make up for bad code … rather than spend your time writing the comments that explain the mess you've made, spend it cleaning that mess.* — *Clean Code*, ch. 4

The default is **no comment**. A comment is an apology — code that should have been clear enough to not need one. Worse, comments lie: they drift out of sync with the code, no compiler checks them, and a stale comment is more harmful than no comment.

The legitimate uses of comments:

- **Legal / license headers** at the top of a file. Required by policy.
- **Informative comments** that convey something the code can't, e.g. the format of a regex, the protocol-defined meaning of a magic number, or a link to the bug / spec / RFC the code implements.
- **Explanation of intent** — *why* a non-obvious choice was made (e.g. "we sort by `id` not `created_at` because the sort must be deterministic for cache keys"). This is the highest-value kind of comment.
- **Clarification** of an opaque API the code is calling, when you can't make it clearer.
- **Warning of consequences** ("don't run this against prod — it issues real refunds"; "this test takes 30 minutes; only run in nightly").
- **TODO** comments — but only with a specific actionable plan, not a vague gesture. Many TODOs become commit-message archaeology over time.
- **Public API docs** (Javadoc / JSDoc / docstrings). These document the *contract*: preconditions, postconditions, exceptions, examples. They are the contract becoming text.

The illegitimate uses (delete on sight):

- **Redundant comments** that say what the code already says: `i++; // increment i`.
- **Mandated comments** — comments required by team policy on every variable, even when the name is self-explanatory. Quickly degrade to noise.
- **Journal comments** — change history at the top of a file. That's what `git log` is for.
- **Noise comments** — `/** Default constructor. */`, `/** the day */`, etc.
- **Closing-brace comments** — `} // end of for` is a sign the block is too long; shrink the block.
- **Commented-out code** — delete it. Version control remembers; the comment-out only adds noise.
- **Function headers** — if the function needs a header to explain what it does, the function is not small enough or not named well enough.

The test for any comment: *if I deleted it, would a future reader be confused?* If no — delete. If yes — first try to fix the code (rename, extract, restructure) so the comment becomes redundant. Only if the code can't carry the meaning does the comment earn its place.

---

## Formatting and structure

Formatting is communication. Inconsistent formatting forces the reader to context-switch between styles; it also signals "no one cares here".

**Vertical formatting (file-level).**
- A source file is like a newspaper article: name (filename) gives the headline, top-of-file shows high-level concepts, lower in the file shows details.
- Concepts that are tightly related belong vertically near each other. Variables are declared near their first use; private helpers live just below the public function that calls them.
- Blank lines separate concepts. Tightly-coupled lines (a variable and the line that uses it; the lines of a single algorithmic step) stay packed.
- Files larger than ~500 lines are usually doing too much. Split.

**Horizontal formatting (line-level).**
- Lines should fit a screen — 80–120 characters depending on team conventions. Wrapping survives in version control diffs; horizontal scrolling does not.
- Indentation reflects nesting. Don't collapse `if (x) doThing();` onto one line; make the structure visible.
- Avoid alignment tricks (`=` aligned across many assignments) that look pretty but break on rename.
- Don't put multiple statements on one line. Don't fight the language's natural rhythm.

**Team rules.** Within a single codebase, formatting must be consistent. If the project has a formatter (Prettier, Black, gofmt, rustfmt, etc.), let it run; don't fight it. If there's a `.editorconfig` or style guide, follow it. Personal aesthetic loses to team consistency.

**The newspaper metaphor.** When you're done with a file, scan it top to bottom: does it tell a story? Top: high-level orchestration / public API. Middle: the main steps. Bottom: low-level helpers. If you have to jump up and down to understand what something does, the order is wrong.

---

## Error handling

> *Error handling is important, but if it obscures logic, it's wrong.* — *Clean Code*, ch. 7

**Exceptions, not return codes.** Return codes pollute every call site with `if (result != OK)` checks. Exceptions let the happy path read top-to-bottom; errors are routed to one place. (Languages without exceptions — Go, Rust — have alternatives: explicit `Result`/`Option` with the `?` operator, errors-as-values with early return. The principle is the same: keep the happy path uncluttered.)

**Write the try/catch first.** When implementing something that can fail (DB call, network, file I/O), structure the function as `try { /* happy path */ } catch (...) { /* recovery */ }` first. This forces you to think about the failure modes up front, rather than bolting them on later.

**Provide context with exceptions.** A bare `throw new IOException();` is useless. Include enough information that the catcher (and the eventual log reader) can act: which file, which user, which operation. Wrap low-level exceptions into domain-meaningful ones at the boundary (`throw new InvoiceNotFoundException(id, e)` is more useful than re-raising `SQLException`).

**Define exception classes in terms of the caller's needs.** Don't force the caller to `catch (FileNotFoundException | SQLException | NetworkException ...)` if all they care about is "operation failed, retry later". Wrap into `TransientFailureException` at the boundary.

**Define the normal flow.** Use *Special Case* and *Null Object* patterns to avoid scattering `if (x == null)` checks. If `getMealAndExpenses()` returns either a real meal or a "no expenses today" object that responds to the same interface, the caller doesn't need a null check.

**Don't return null.** Returning `null` forces every caller to null-check. Prefer: an empty collection (for "no items"), an `Optional` / `Maybe` / `Result` type (for "may be absent"), or throwing an exception (for "this should not have happened"). The first two are far more common than the third.

**Don't pass null.** Passing `null` into a function makes the function's contract fuzzy — what should it do? Crash? Treat as default? Silently ignore? Either the parameter is required (and the contract is "non-null"), or it's optional (and the parameter type encodes that).

**Validate at the boundary, trust inside.** User input, network responses, DB rows, file contents — all untrusted. Validate them at the moment they enter your trusted code. Inside the trusted code, types and contracts carry the load; don't re-validate everywhere. **This is one of the highest-leverage rules — it removes most defensive code.**

**Don't catch what you can't handle.** A `catch (Exception e) { log(e); }` that re-throws or swallows is worse than the unhandled exception, because it loses the stack trace and hides the bug. Either you can recover (translate to a domain exception, retry, fall back) or you can't (let it propagate to the framework's top-level handler).

---

## Boundaries (third-party code)

Third-party code (libraries, frameworks, services) is volatile in a way your code is not. Wrapping it isolates the volatility.

**Wrap third-party APIs in your own interface.** Your code calls `EmailService.send(toAddress, body)`. Internally that calls SendGrid, or SES, or whatever. The boundary is one file; the rest of the system doesn't know which provider is in play. Swapping providers is then a one-file change.

**Use learning tests.** Before integrating a third-party library, write small tests that exercise the parts you intend to use. The tests serve as: documentation, regression detection when the library upgrades, and a sandbox for understanding the API.

**Use code that doesn't exist yet.** When integrating with a service whose API isn't ready, define the interface *as you wish it existed*, code against it, and adapt later. This keeps your domain code clean and surfaces unrealistic API expectations early.

**Clean boundaries.** Don't let third-party types (`HttpRequest`, `JdbcRow`, `S3Object`) leak past their boundary. Inside the boundary, work in the third-party language. Outside, work in your domain.

---

## Tests as first-class code

Test code is **production code**. It is read more often than it is written. Sloppy tests rot fastest and are abandoned first. (This is *Clean Code* ch. 9 and explicitly Bertrand Meyer's argument that quality applies to all software, including verification.)

**F.I.R.S.T.**:
- **Fast.** Slow tests don't run; tests that don't run don't catch bugs.
- **Independent.** Tests don't depend on each other or on order. Each test sets up its own state.
- **Repeatable.** Run anywhere — laptop, CI, plane — same answer.
- **Self-validating.** Pass/fail, no human reading log output.
- **Timely.** Written close to (or before — TDD) the production code that motivates them. Retroactive tests reverse-engineer the implementation, not the contract.

**One assert per test (one concept per test).** Each test has one reason to fail. When it fails, you know exactly what broke. Multi-assert tests turn a regression into a debugging puzzle.

**Tests are documentation of the contract.** A test name reads as a sentence: `parsesEmptyStringAsZero`, `rejectsExpiredTokens`. The body shows arrange / act / assert. A reader who doesn't know the system should be able to read the tests and learn what the code is supposed to do.

**Don't test implementation; test behaviour.** A test that breaks when you rename a private helper is testing implementation. Refactor-survivability is the test of test quality. Mock at architectural boundaries (DB, network) — not at internal seams.

**Domain-specific testing language.** Build helpers (`given().a_user_with(role).and_an_account_balance(100); when().attempts_to_purchase(item); then().receives_a(InsufficientFundsError)`) so the test reads as a domain story, not as plumbing.

The dual-standard for test code: it doesn't need the same memory/CPU efficiency as production, but it does need the same readability and design quality.

---

## Classes / modules at the small scale

This section is the bridge to [design-principles.md](design-principles.md). Here, just the small-scale rules.

**Classes should be small.** Measured by responsibilities, not lines. A class with 70 methods is doing too much; identify the cohesive sub-clusters and split. The *Single Responsibility Principle* (Martin) is the rigorous version: each class has one reason to change. (See [design-principles.md](design-principles.md).)

**Encapsulation.** Public surface is an obligation; private is freedom. Default to private (or the language equivalent — `_underscore` in Python, no `pub` in Rust). Loosen only when there's a specific need.

**Cohesion.** A class is cohesive when its methods and fields work together — most methods touch most fields. Low cohesion (some methods touch one set of fields, others touch a different set) is a signal that two classes are sharing one shell. Split.

**Organize for change.** The class structure should make likely changes easy and unlikely changes possible. If "we need to add a new payment method" should be a one-class change, the design wins; if it's a 12-file change, the design is wrong (Shotgun Surgery; see [refactoring.md](refactoring.md)).

**Dependencies between classes** — see [modularity.md](modularity.md) and [design-principles.md](design-principles.md) for SOLID, the dependency rule, and component coupling.

---

## Cross-references

- For *when* to refactor, the catalog of smells, and concrete refactoring recipes: [refactoring.md](refactoring.md)
- For *why* a class should be small, what "responsibility" means, and the SOLID principles: [design-principles.md](design-principles.md)
- For module-level cohesion / coupling and packaging strategies: [modularity.md](modularity.md)
- For the dependency rule, layers, quality attributes, and the architecture-level frame: [architecture.md](architecture.md)
- For the long-form pause-before-changing-code protocol: [decision-protocol.md](decision-protocol.md)
