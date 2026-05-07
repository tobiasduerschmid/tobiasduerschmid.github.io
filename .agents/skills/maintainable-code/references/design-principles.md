# Design Principles — class- and module-level rules

> Synthesised from *Clean Architecture* (Martin, 2017), *OOSC2* (Meyer, 1997), *Agile Software Development: Principles, Patterns, and Practices* (Martin, 2002).

This reference covers the **principles that govern the relationship between classes and modules** — when to split, how dependencies should flow, what stable interfaces look like, how to make a contract explicit. Read this whenever you trigger any of: "should this be its own class / module", "where should I put this method", "how should these depend on each other", or "I'm about to write a defensive null check".

## Table of contents

1. [SOLID](#solid)
   - [SRP — Single Responsibility](#srp--single-responsibility-principle)
   - [OCP — Open-Closed](#ocp--open-closed-principle)
   - [LSP — Liskov Substitution](#lsp--liskov-substitution-principle)
   - [ISP — Interface Segregation](#isp--interface-segregation-principle)
   - [DIP — Dependency Inversion](#dip--dependency-inversion-principle)
2. [Information Hiding](#information-hiding)
3. [Design by Contract](#design-by-contract)
4. [Single Choice Principle](#single-choice-principle)
5. [Uniform Access Principle](#uniform-access-principle)
6. [Command-Query Separation](#command-query-separation)
7. [How the principles relate](#how-the-principles-relate)

---

## SOLID

The five principles that make up the acronym (Robert C. Martin, 1990s–2000s) are the most widely-applied rules at the class / module scale. Each one targets a specific failure mode.

### SRP — Single Responsibility Principle

> *A module should be responsible to one, and only one, actor.* — *Clean Architecture*, ch. 7

A class / module should have **one reason to change**. The "actor" framing is sharper than the older "one responsibility" wording: a responsibility is a duty owed to a specific stakeholder. If two methods serve different stakeholders, they are two responsibilities.

**Symptom 1 — accidental duplication.** Two methods in the same class are textually similar (even share helper code) but serve different actors. If one actor's needs change, the shared helper changes, and the *other* actor's behaviour silently breaks. Cure: split, even if there's surface duplication.

**Symptom 2 — merge conflicts.** When a class is touched in every PR by every team, that's the actor-mixing showing up in source control.

**The mistake people make:** confusing SRP with "do one thing". A function does one thing; a class is responsible to one *actor*. A `Customer` class can have `getName()`, `getAddress()`, `recordPurchase()`, `requestRefund()` — all serve the same actor (the customer-relations subsystem). It's wrong only if `calculateTaxableIncome()` (serving the finance subsystem) lives there too.

**Where this hits LLM-written code:** a single "service" class that does validation, persistence, business logic, formatting, *and* notification. Almost always wrong. Each of those concerns has a different reason to change.

### OCP — Open-Closed Principle

> *A software artifact should be open for extension but closed for modification.* — Bertrand Meyer (original), 1988; refined by Martin

You should be able to add new behaviour without modifying existing, working, tested code. The mechanism: identify the axis of variation, abstract it behind an interface, add new variants by adding new implementations rather than editing the consumers.

The classic example: a `Shape` hierarchy. Bad version — `area(shape)` does `if (shape is Circle) ... else if (shape is Square) ...`. Adding a `Triangle` requires editing `area()` (and probably `perimeter()`, and `render()`, and ...). Good version — each shape has its own `area()` method, polymorphism dispatches. Adding `Triangle` adds one class; existing code is untouched.

**Information Hiding is the engine of OCP.** If the consumer depends only on the interface, the implementation can be replaced or augmented without touching the consumer. (See [Information Hiding](#information-hiding).)

**Caveat — don't over-engineer.** Don't add abstraction "in case we need it later" (Speculative Generality smell). The right time to introduce the OCP-friendly abstraction is when you've seen the second variation, not when you imagined it. (See [refactoring.md](refactoring.md) — *Speculative Generality*.)

### LSP — Liskov Substitution Principle

> *Subtypes must be substitutable for their base types.* — Barbara Liskov, 1987

If `S` is a subtype of `T`, then any program written against `T` should keep working when given an instance of `S`. In contract terms: the subtype's preconditions must be no stronger, and its postconditions and invariants must be no weaker, than the parent's.

The canonical violation: `Square extends Rectangle` and overrides `setWidth` and `setHeight` to keep the sides equal. A test that worked on `Rectangle` (`rect.setWidth(5); rect.setHeight(3); assert rect.area() == 15`) now fails when given a `Square`. The hierarchy is a lie — `Square` is not a behavioural subtype of `Rectangle`.

**Practical cues:**
- If you have to check the runtime type (`if (x instanceof Foo) ...`), the substitutability is broken.
- If a subclass throws an exception the parent didn't declare, that's a stronger precondition — LSP violation.
- If a subclass returns less information than the parent (e.g. an empty list where the parent returned all items), that's a weaker postcondition — LSP violation.
- "Refused bequest" — a subclass that inherits methods it doesn't actually want — is an LSP smell. Often, the inheritance was the wrong relationship; prefer composition.

### ISP — Interface Segregation Principle

> *Clients should not be forced to depend upon interfaces that they do not use.* — Martin

A "fat" interface forces every implementer to deal with methods irrelevant to its use case, and every consumer to be coupled to symbols it doesn't call. Split fat interfaces by client need.

Practical example: an `Operations` interface with 30 methods used by 5 clients, where each client uses 5–8 methods. If you change one method, all 5 clients recompile (and may re-test, redeploy). Better: 5 small interfaces, each tailored to a client's needs, the implementing class implements all of them.

**Modern languages make this cheap.** Structural typing (Go, TypeScript), traits (Rust), protocols (Swift), and duck typing (Python) all let a single concrete type satisfy many small interfaces. There's no reason to make the consumer depend on the kitchen sink.

### DIP — Dependency Inversion Principle

> *High-level modules should not depend on low-level modules. Both should depend on abstractions. Abstractions should not depend on details. Details should depend on abstractions.* — Martin

This is the cornerstone of *Clean Architecture*. Without DIP, the natural direction of dependency is "high-level policy uses low-level mechanism" — the business logic imports the database driver, the HTTP framework, the email client. That couples the policy to volatile details, and makes the policy untestable except through its details.

DIP **inverts** this: define an abstraction (interface, protocol, trait) **in the high-level module**, and have the low-level module implement it. The high-level module depends on the abstraction it owns; the low-level module depends on it too. The compile-time dependency points from the detail to the abstraction.

```
Without DIP:                 With DIP:

  PaymentService                PaymentService ────────► PaymentGateway
       │                                                         ▲    (interface, owned
       ▼                                                         │     by high-level)
  StripeAPI                     StripeAPIGateway ─────────────────┘
                                (low-level, depends on
                                 the abstraction it implements)
```

In practice: define `PaymentGateway` as an interface in your domain layer, write a `StripeGateway` implementation in your infrastructure layer, and **inject** the gateway (constructor parameter, function argument) where needed. Tests use a `FakeGateway`. Switching to PayPal is a new implementation; the domain doesn't change.

**Concrete cues that the dependency direction is wrong:**
- Domain code `import`s ORM types, HTTP framework types, file paths, env vars, loggers.
- Tests of business logic require a real DB / network connection.
- Replacing a third-party library means hunting through 30 files.

DIP doesn't mean "abstract everything" — only the unstable / volatile dependencies. Stable dependencies (the standard library, well-known utility types, primitive operations) need no inversion.

---

## Information Hiding

> *Modules should be designed to hide secrets — design decisions that are likely to change.* — David Parnas, 1972

Information hiding is *older* than object-orientation and outlives every framework fad. It is the foundation of all the other principles in this file.

The technique:
1. Identify the design decisions that might change (storage format, algorithm, third-party choice, threading model).
2. Encapsulate each in a module.
3. Expose a stable interface that does *not* leak the decision.
4. Clients of the interface depend only on what's stable.

**Secrets to hide:**
- Data representation (is `users` an array, a hash, a DB-backed iterator?).
- Algorithm choice (sort, hash, cache eviction).
- Third-party dependencies (which logger, which HTTP client, which DB driver).
- Threading / concurrency model.
- Optimization tricks (memoization, caching, lazy loading).
- Configuration source (env var? file? service?).

**OOSC2 ch. 23.5 — *Selective exports*.** Information hiding is not just "private fields with public getters". It's deciding, for each piece of state and behaviour, *who needs to see this?* and exposing accordingly. Public access to a class is a permanent commitment; treat it as a contract.

**The Law of Demeter** is a corollary: a method should only call methods of (a) its own object, (b) its parameters, (c) objects it creates, (d) its direct components. *Train wrecks* like `account.getOwner().getAddress().getCity()` leak the structure of `account` — if the structure changes, every train wreck breaks.

---

## Design by Contract

> *A precondition expresses constraints under which a routine will function properly. A postcondition expresses properties of the state resulting from a routine's execution. A class invariant must be satisfied by every instance whenever the instance is observable from the outside.* — *OOSC2* ch. 11

Design by Contract (DbC), Bertrand Meyer's term, is the discipline of making each routine's contract explicit:

- **Precondition.** What the caller must guarantee for the routine to work. (Inputs in valid range; required state; resource available.)
- **Postcondition.** What the routine guarantees, *if* the precondition was met. (Output relationship; state change; side effects.)
- **Invariant.** What is true about an object at all observable moments — across every method call.

**The big consequence: trust your contracts.** If `transfer(from, to, amount)` has the precondition `from.balance >= amount`, **it does not need to defensively check this inside**. The caller's job was to ensure it. Defensive checks duplicate validation logic and obscure the actual algorithm.

This is one of the most common failure modes in LLM-written code: try/catch around things that can't fail, null-checks at every layer, validations re-applied every call. The cure: validate **once, at the boundary**, then trust.

**Where to validate:** at the *trust boundary*. User input, external API responses, file reads, deserialization — all untrusted. Translate them into trusted internal types at the boundary; from then on, the type system carries the contract.

**Languages without runtime contract support** (most of them — only Eiffel has it natively) approximate DbC with:
- **Types.** A `NonEmptyList<T>` cannot be empty by construction.
- **Assertions** at the entry of public methods (precondition) and exit (postcondition). Strip in production if needed.
- **Tests** that pin the contract.
- **Docstrings on public APIs** that document contract explicitly.

**The contract documents the routine**, not the implementation. A reader who knows the contract can use the routine without reading the body.

---

## Single Choice Principle

> *Whenever a software system must support a set of alternatives, one and only one module in the system should know their exhaustive list.* — *OOSC2* ch. 4

If your system handles, say, "movie type" with values `regular`, `children`, `new_release`, that list should be enumerated **once**. Adding `student_discount` should be a one-place change.

Violations look like: a `switch` on movie type in `calculatePrice()`, *and* in `calculateRentalPoints()`, *and* in `formatLabel()`, *and* in `validateMembership()`. Adding a type means hunting down five switches and getting all of them right.

The cure: **polymorphism**. Each movie type is a class (or strategy / state object); the type-specific logic lives on the type. Adding `StudentDiscount` adds a class; existing code is untouched. (This is also OCP and Replace Conditional with Polymorphism — they're the same insight from different angles.)

**Note**: not every conditional is a Single Choice violation. A one-off `if (user.isAdmin)` inside one function is fine. The principle bites when the *same* dispatch on the *same* set of alternatives appears in many places.

---

## Uniform Access Principle

> *All services offered by a module should be available through a uniform notation, which does not betray whether they are implemented through storage or through computation.* — Meyer

The client of `account.balance` should not have to care whether `balance` is a stored field, a computed property, or a network call to a remote ledger. The notation is the same; the implementation can change without ripple.

Languages support this differently:
- Eiffel, Kotlin, C#, Swift, Python (with `@property`) — yes, properties look like fields.
- Java, classic JavaScript — no, methods look like methods (`getBalance()`); changing a field to a method is a breaking change.

**For LLM-written code:** prefer the language's "uniform" form when available. In Java, default to getter methods (`getX()`) for any field that may eventually become computed. In TypeScript / Kotlin / Swift / Python, use properties / computed members. The point is to keep the implementation choice changeable.

---

## Command-Query Separation

> *Asking a question should not change the answer.* — Meyer (paraphrased)

Every routine should be either:
- A **command** that performs an action (and returns nothing — `void` / `unit`).
- A **query** that returns a value (and has no observable side effects).

**Not both.** `pop()` that both removes and returns the top element of a stack is a *known* CQS violation that's tolerated for ergonomics; everything else, separate.

**Why:** mixing makes the code lie. `if (account.set("balance", 100))` looks like a query (`if` expects a boolean condition) but it's actually mutating state. Readers miss that. Separated: `account.setBalance(100)` (command, void) and `account.balance` (query, returns balance).

CQS is a **micro-version** of SRP: even a single function should have only one role.

---

## How the principles relate

These aren't independent rules; they're facets of the same core idea: **separate things that change for different reasons, and depend only on what's stable**.

- **SRP** says: don't put two responsibilities in one class.
- **OCP** says: when you've identified an axis of variation, make it extensible without modification.
- **LSP** says: subtypes must respect the contract of their parent.
- **ISP** says: don't force clients to depend on interface methods they don't use.
- **DIP** says: high-level policy must not depend on low-level details — invert with an abstraction.
- **Information Hiding** is the underlying mechanism: hide what changes, expose what's stable.
- **Design by Contract** is how you make the stable interface explicit.
- **Single Choice** is OCP applied to a switchable enumeration.
- **Uniform Access** is information hiding applied to data-vs-computation.
- **CQS** is information hiding applied to side effects.

If you internalise the underlying idea ("separate concerns, hide volatility, expose stable contracts"), you can re-derive each rule when you need it.

---

## Cross-references

- For the smell catalog (Refused Bequest, Inappropriate Intimacy, Feature Envy, etc.) and how to refactor toward these principles: [refactoring.md](refactoring.md)
- For the architecture-level extension of DIP (the dependency rule, layers, boundaries): [architecture.md](architecture.md)
- For module-level extensions (component cohesion, component coupling, packaging): [modularity.md](modularity.md)
- For the function-, name-, and comment-level craft these principles operate on: [clean-code.md](clean-code.md)
