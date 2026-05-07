# Refactoring — when, why, and how

> Synthesised from *Refactoring: Improving the Design of Existing Code* (Fowler, 1999/2018), with cross-references to *Clean Code* (Martin) ch. 17 (Smells and Heuristics).

This reference is the **catalog of what to look for and what to do about it**. Read it whenever you trigger any of: long function, big class, duplicated code, switch on type, long parameter list, divergent change, shotgun surgery, feature envy, message chains, or "this code is hard to follow but I can't say why".

## Table of contents

1. [What refactoring is, and isn't](#what-refactoring-is-and-isnt)
2. [When to refactor](#when-to-refactor)
3. [The two hats](#the-two-hats)
4. [The smell catalog (Fowler's five categories)](#the-smell-catalog)
5. [The most common refactorings, by smell](#the-most-common-refactorings-by-smell)
6. [Don't refactor when…](#dont-refactor-when)

---

## What refactoring is, and isn't

> *Refactoring is the process of changing a software system in such a way that it does not alter the external behavior of the code yet improves its internal structure.* — Fowler

The defining property: **observable behaviour does not change**. If the test suite passes before and after, with no change to the test suite itself (other than maybe renaming), it was a refactor. If the tests had to change, it was a redesign or a feature change — not a refactor.

**Refactoring is *not*:**
- Adding features ("while I'm here, let me add this option").
- Fixing bugs ("while I'm here, let me also fix this").
- Performance optimization (which often *trades* readability for speed).
- Big rewrites ("we're refactoring the auth system" usually means rewriting).

**Refactoring *is*:**
- Renaming a variable to better reveal intent.
- Extracting a function from a long block.
- Moving a method to where its data lives.
- Replacing a switch with polymorphism.
- Inlining a one-line function whose name no longer adds value.
- Splitting a class along the lines of two responsibilities.

Each individual refactoring is *small* and *mechanical*. The discipline is doing many of them in sequence, with the test suite running between each, so you never go more than a few minutes between green builds. *Refactoring* the book is structured as a catalog of these small, named transformations, each with its own mechanics.

---

## When to refactor

Fowler's three triggers, in priority order:

### 1. The Rule of Three

The first time you do something, just do it. The second time you do something similar, wince at the duplication but do it anyway. The third time, refactor.

Three is the smallest sample size where you can see the pattern. Earlier abstraction is *Speculative Generality* — making a guess about how the variation will line up before you've seen it. The third instance shows you the actual variation, and the abstraction can be tailored to it.

### 2. When you add a feature

> *When you find you have to add a feature to a program, and the program's code is not structured in a convenient way to add the feature, first refactor the program to make it easy to add the feature, then add the feature.* — Kent Beck

This is the **preparatory refactoring** pattern, and it is the single highest-leverage habit. You're already loading the relevant code into your head to add the feature; that's the moment to clean up what makes the code hard to change.

### 3. When you fix a bug

A bug in a piece of code is a strong signal that the code wasn't easy to reason about. After the fix, refactor to make a future bug less likely (or more obvious). The Boy Scout rule: leave the code cleaner than you found it.

### 4. When you do a code review

Reviewing code with the author present is a great refactoring opportunity — the author has the context fresh, the reviewer brings outside eyes, and the changes are still small.

---

## The two hats

> *When you use refactoring to develop software, you divide your time between two distinct activities: adding function and refactoring. When you add function, you shouldn't be changing existing code; you are just adding new capabilities. … When you refactor, you make a resolution not to add any function; you only restructure the code.* — Fowler

This is the most important habit. **Wear one hat at a time.** Either you are adding a feature (in which case the structure is what it is — cope with it, get the feature in) or you are refactoring (in which case the behaviour is what it is — restructure without changing what it does).

The reason: mixing the two makes both harder. A pure refactor can run with the existing test suite as a safety net. A pure feature is small enough to review. A mixed change is hard to review, hard to test ("did the test break because of the refactor or the feature?"), hard to revert if something goes wrong.

In practice, you may **switch hats often** within a single session. That's fine. The discipline is knowing which hat you're wearing at each moment.

---

## The smell catalog

Fowler categorizes 22+ smells into five groups. Recognising them is most of the skill.

### Bloaters — code that has grown too big

| Smell | What it looks like | Why it's bad |
|---|---|---|
| **Long Method** | Function > ~20 lines, multiple paragraphs separated by blank lines or comments | Too much to hold in head; mixes levels of abstraction |
| **Large Class** | Class with many fields, many methods, hundreds of lines | Almost certainly violates SRP; multiple responsibilities packed in |
| **Primitive Obsession** | Lots of strings, ints, hashes representing domain concepts (`"USD"`, `12.50`, a tuple `(lat, lng)`) | The domain concept has no name, no methods; logic about the concept is scattered |
| **Long Parameter List** | 4+ parameters; parameters that always travel together | Hard to call correctly; signals a missing concept |
| **Data Clumps** | Same group of fields appearing together (`startDate, endDate` everywhere; `street, city, zip` everywhere) | Missing class — these fields *are* a concept |

### OO Abusers — using OO badly

| Smell | What it looks like | Why it's bad |
|---|---|---|
| **Switch Statements** | Type code drives behaviour via switch / long if-else | Single Choice violation; OCP violation; same switch repeated across the system |
| **Temporary Field** | Field on a class set only sometimes; null otherwise | Indicates the field belongs on a different object — extract |
| **Refused Bequest** | Subclass inherits methods it doesn't want / overrides to no-op | Wrong inheritance — prefer composition |
| **Alternative Classes with Different Interfaces** | Two classes do the same thing but with different method names | Missed abstraction — unify |

### Change Preventers — make changes hard

| Smell | What it looks like | Why it's bad |
|---|---|---|
| **Divergent Change** | One module is touched in *every* PR for *different* reasons | SRP violation — multiple responsibilities in one place |
| **Shotgun Surgery** | One change requires touching many modules | CCP violation — the responsibility was scattered |
| **Parallel Inheritance Hierarchies** | Adding a class to one hierarchy forces a class in another (every `Foo` has its `FooBuilder`) | Coupled hierarchies — fold one into the other |

### Dispensables — things that shouldn't be there

| Smell | What it looks like | Why it's bad |
|---|---|---|
| **Comments** explaining what code does | `// loop over the items` | Code should be self-explanatory; rewrite to make the comment redundant |
| **Duplicate Code** | Same / very similar code in multiple places | A change has to happen N times; one will be missed |
| **Lazy Class** | Class that doesn't earn its keep | Inline it |
| **Data Class** | Class with only fields, getters, setters; logic about its data lives elsewhere | Move the logic to where its data is (Feature Envy in reverse) |
| **Dead Code** | Functions / branches / fields nothing uses | Deletes don't break — the version control remembers if you ever need it back |
| **Speculative Generality** | Hooks / abstractions / parameters added "in case we need them" | YAGNI — pay the abstraction tax when you actually need it |

### Couplers — too much coupling

| Smell | What it looks like | Why it's bad |
|---|---|---|
| **Feature Envy** | A method on `A` calls `b.x()`, `b.y()`, `b.z()` more than it touches `A`'s own state | The method belongs on `B`, not `A` — Move Method |
| **Inappropriate Intimacy** | Two classes know each other's internal structure | Reduce by introducing a clean interface; possibly merge if they're really the same concept |
| **Message Chains** | `a.getB().getC().getD().doThing()` (Law of Demeter violation) | Caller is coupled to the chain's structure; one structural change breaks all chains |
| **Middle Man** | A class that just delegates to another | If most of its methods just forward, inline it |

---

## The most common refactorings, by smell

The most-used items from Fowler's catalog, paired with the smells they treat. This is not exhaustive — the book has ~70 recipes — but these handle most cases.

### For Long Method / Long Function

- **Extract Function (formerly Extract Method).** Pull a coherent block out into its own named function. The most-used refactoring in the book; if you do nothing else, do this.
- **Replace Temp with Query.** A `temp = expensiveCalculation()` line becomes a `getCalculation()` query. Lets the temp variable die; lets the calculation be reused.
- **Introduce Parameter Object.** A long parameter list becomes one parameter that is a small struct / class. (Treats Long Parameter List too.)
- **Replace Loop with Pipeline.** `for` over a collection with mapping / filtering / accumulating becomes `.filter().map().reduce()`. (When the language supports it, and when readability improves — not always.)
- **Decompose Conditional.** Replace `if (cond) { /* ten lines */ } else { /* ten lines */ }` with `if (cond) { extractedFn() } else { otherExtractedFn() }`. Names the branches.

### For Switch Statements / Type Code

- **Replace Conditional with Polymorphism.** The big one. The switch becomes the dispatch the language already does for free.
- **Replace Type Code with Subclasses / Strategy / State.** The "type code" int / enum becomes a hierarchy where each variant has its own class.
- **Introduce Null Object.** Replace `if (obj == null) { /* default */ } else { obj.do() }` with a `NullObject` that responds to `do()` with the default. Caller no longer null-checks.

### For Primitive Obsession / Data Clumps

- **Extract Class.** A bag of fields that travel together (`(lat, lng)`, `(startDate, endDate)`, `(street, city, zip)`) becomes a class.
- **Replace Primitive with Object.** A `String currencyCode` becomes a `Currency` class with validation, formatting, and equality.
- **Replace Data Value with Object.** Even a single primitive can earn an object if it has invariants — `EmailAddress` validates, `UserId` is type-distinct from `OrderId`.

### For Feature Envy / Inappropriate Intimacy

- **Move Method / Move Field.** Move it to the class that has the data.
- **Extract Class** to break up an over-intimate pair.
- **Hide Delegate.** If `client.getServer().sendRequest()` is leaking the structure, replace with `client.sendRequest()` — the client hides the server.

### For Duplicate Code

- **Extract Function.** If duplication is in two places of the same class.
- **Pull Up Method.** If duplication is in subclasses.
- **Form Template Method.** If subclasses do similar things in different orders, hoist the orchestration into the parent and let subclasses fill in the steps.
- **Substitute Algorithm.** If two duplicates do the same thing different ways, pick one.

### For Divergent Change

- **Extract Class.** Split out the responsibilities; each goes to its own class with its own reason to change.

### For Shotgun Surgery

- **Move Method / Move Field** the related pieces *into one place* (often introducing a new class) so that future changes are local.

### For Long Parameter List

- **Introduce Parameter Object.** Group parameters that travel together.
- **Preserve Whole Object.** If you're passing `customer.getName()`, `customer.getAddress()`, `customer.getId()`, just pass `customer`.
- **Replace Parameter with Method.** If a parameter is computable from another parameter or from an object, drop it.

### For Comments

- **Extract Function.** Replace `// This computes the discount` with `discount = computeDiscount(order)`.
- **Rename.** Replace `// d means days` with `elapsedDays`.
- **Extract Variable** to give a name to an expression: `if (platform.toLowerCase().indexOf("mac") > -1 && browser.toLowerCase().indexOf("ie") > -1)` becomes `if (isMacIE())`.

### For Speculative Generality

- **Inline.** Inline the unused abstraction layer; let the concrete code be concrete until the second instance demands the abstraction.
- **Collapse Hierarchy.** A subclass with no extra behaviour merges with its parent.
- **Remove Parameter.** Unused parameters earn no keep.
- **Rename Method.** A name that gestures at "future" generality (`processGenericThing`) becomes the name of what it actually does (`renderInvoice`).

---

## Don't refactor when…

Refactoring is not always the right move.

- **Right before a hard deadline.** Refactoring increases short-term risk for long-term gain. If the deadline is tomorrow, ship the feature; refactor next week.
- **You don't have tests.** Without a safety net, refactoring is rolling dice. If the area lacks tests, your first move is to *add tests* (Fowler's *Adding Tests* recipes — characterization tests, golden master tests). Then refactor.
- **The code is going to be deleted soon.** Don't polish what's about to die.
- **You're tempted to "rewrite" rather than refactor.** Big rewrites have an enormous failure rate; small steady refactorings preserve working code along the way. The right move is almost always to refactor toward the rewrite, in small steps, on a green test suite. If you literally must rewrite, do so **behind a feature flag**, with both implementations running until the new one passes the same tests.

---

## Cross-references

- For why these refactorings are worth doing — the underlying principles: [design-principles.md](design-principles.md), [modularity.md](modularity.md)
- For the line-, function-, name-level rules these refactorings enforce: [clean-code.md](clean-code.md)
- For the architecture-level analogues (move *modules*, extract *services*, change layer boundaries): [architecture.md](architecture.md)
- For when to apply preparatory refactoring vs. add the feature directly: [decision-protocol.md](decision-protocol.md)
