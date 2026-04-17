---
title: SOLID
layout: sebook
---

> **Want hands-on practice?** Jump into the [Interactive SOLID Tutorial](/SEBook/tools/solid-tutorial.html) — feel the pain of rigid code first, then refactor step by step with auto-graded exercises, live UML diagrams, and quizzes for every principle.

# Problem

Software is never finished. Requirements shift. Teams grow. What was "one small change" last month becomes a three-day yak-shaving exercise next month because a helper method is wired into four different features. Every developer eventually inherits a class that does too much and trembles when touched.

The core problem is: **How do we structure object-oriented code so that change is localized, safe, and cheap — instead of tangling every new feature into every old one?**

SOLID is a set of five design principles that answer this question. Each principle targets a different kind of tangle. Together, they define what Martin calls a *well-designed* object-oriented system: one where behavior can be extended without rewriting, dependencies point from detail to policy, and subtypes can be trusted to honor their contracts.

# Context

SOLID principles apply when:

* **Code will evolve.** New features will be added, policies will change, and multiple developers will touch the same modules over months or years.
* **Multiple actors drive change.** Different business stakeholders (finance, HR, compliance, UX, etc.) will each want modifications for reasons that have nothing to do with each other.
* **Testing and swapping implementations matters.** Systems that talk to databases, payment providers, or external APIs need to be testable without spinning up the real dependencies.

SOLID is *not* a blanket rule for every line of code. One-off scripts, throwaway prototypes, and domains where only a single implementation exists typically do not benefit — and can actively suffer — from the abstractions SOLID encourages. The principles are tools for managing complexity, not boxes to tick.

# The Five Principles

The name SOLID is an acronym coined by Michael Feathers, collecting five principles that Robert C. Martin had developed and refined through the late 1990s and early 2000s:

| Letter | Principle | One-sentence intuition |
|---|---|---|
| **S** | Single Responsibility | A class should answer to one actor — one team, one stakeholder, one reason to change. |
| **O** | Open/Closed | You should be able to add new behavior without modifying existing tested code. |
| **L** | Liskov Substitution | A subtype must be safely usable anywhere its parent type is expected. |
| **I** | Interface Segregation | Clients should not be forced to depend on methods they do not use. |
| **D** | Dependency Inversion | High-level policy should not depend on low-level details — both should depend on abstractions. |

## Single Responsibility Principle (SRP)

> *A module should have one, and only one, reason to change.* — Martin

The most commonly misunderstood principle. Despite its name, SRP is **not** about doing "one thing" — it is about serving one **actor**. An actor is a person, team, or stakeholder group that requests changes to the system. If a class's methods are requested to change by the Finance team *and* by the HR team, those two actors can collide: a change one team asks for may silently break something the other team relied on.

The classic symptom is the *God Class* or *Large Class* code smell — a module that grows indefinitely because it's the landing site for every new feature. The fix is to split the class along the lines of the actors it serves, so each actor can evolve their slice of the system without bumping into the others.

**Common misconception:** "A class should have only one method." This leads to hyper-decomposition — hundreds of tiny classes that cost more coordination than they save. SRP is about *cohesion* (methods grouped because they change together), not about minimizing method count.

## Open/Closed Principle (OCP)

> *Software entities should be open for extension, but closed for modification.* — Meyer, later Martin

The goal is to design modules so that *new behavior* can be added by writing *new code* — without editing the existing, tested modules. The classic OCP violation is a long `if/elif` chain selecting behavior on a string type: every new variant forces a developer to open the old code, find the chain, and slap on another branch, risking regressions in every previously-working case.

The standard fix is polymorphism: replace the chain with an abstract base class (or interface) and move each branch into its own subclass. A *router* object loops over subclasses without knowing what specific variants exist.

**Common misconception:** "Never modify existing code." OCP is not a prohibition on editing code — bug fixes, internal refactoring, and performance improvements are all fine. OCP is about the axis of **extension**: when a *new feature* of the kind the design anticipated arrives, you should not have to rewrite what is already working. Predicting *which* axis of variation matters is itself a design skill.

## Liskov Substitution Principle (LSP)

> *If S is a subtype of T, then objects of type T may be replaced with objects of type S without altering any desirable property of the program.* — Liskov, 1987

LSP is about **behavioral substitutability**: a subclass must honor every promise the parent class makes. Three rules operationalize this:

1. **Preconditions may be equal or weaker** in the subclass (accept at least what the parent accepts).
2. **Postconditions may be equal or stronger** (guarantee at least what the parent guarantees).
3. **Invariants must be preserved.**

Break any of these and code that trusts the parent's contract will blow up when it meets a subclass instance.

The classic LSP violation shows up as the *Refused Bequest* code smell: a subclass inherits a method it cannot meaningfully implement, so it either throws `NotImplementedError` or returns a bogus "success: false" value. Both options violate the parent's contract — the second version is arguably *more* dangerous because it fails silently.

**Common misconception:** "If X is-a Y in the real world, then X should extend Y in code." Real-world taxonomy is not the same as behavioral substitutability. The canonical example: a geometric square *is* a rectangle, but `Square extends Rectangle` violates LSP because setting width independently of height breaks the Rectangle contract. The fix is usually to separate the hierarchy so subclasses cannot inherit methods they cannot honor.

## Interface Segregation Principle (ISP)

> *Clients should not be forced to depend on methods they do not use.* — Martin

ISP targets *fat interfaces*: abstractions that bundle together more than any single client actually needs. When a simple client must implement every method of a huge interface — stubbing out the ones it doesn't care about, or raising exceptions — you have an ISP violation. The code looks type-safe but is full of latent crashes.

The fix is to split the fat interface into smaller, role-based interfaces, and have each client depend only on the roles it actually uses.

**Common misconception:** "ISP is just SRP for interfaces." They address different concerns:

* **SRP** is about what a class does *internally* — one responsibility, one actor.
* **ISP** is about what a class exposes to its *clients* — no client should depend on methods it does not need.

A class can satisfy SRP (single actor) while still violating ISP (exposing a bloated interface some clients can't fulfill). ISP also plays a protective role with LSP: if a subtype never inherits a method it cannot support, it cannot accidentally violate that method's contract.

## Dependency Inversion Principle (DIP)

> *High-level modules should not depend on low-level modules. Both should depend on abstractions. Abstractions should not depend on details; details should depend on abstractions.* — Martin

DIP is the principle most responsible for making code *testable* and *swappable*. The "inversion" refers to flipping the traditional arrow of dependency: instead of a high-level policy module reaching down into a concrete database or network client, the high-level module defines an **abstraction** that describes what it needs, and the low-level module implements that abstraction.

Crucially, the abstraction is **owned by the high-level module**. The interface describes the *policy's needs*, not the *detail's capabilities*. This is what lets you swap the real Postgres client for an in-memory fake during testing, or switch from SendGrid to Mailgun without touching your order-processing logic.

**Common misconception:** "Dependency Inversion is the same as Dependency Injection." They are not the same:

* **DIP** is an *architectural decision* — depending on abstractions instead of concretions.
* **DI** (Dependency Injection) is a *mechanism* — passing dependencies through a constructor, setter, or container.

DI is the most common way to *implement* DIP, but you can do DI without DIP (injecting a concrete class) and DIP without DI (using a factory or service locator). Just passing a concrete `PostgresClient` through a constructor gets you DI without DIP; defining a `Repository` abstraction and injecting a `PostgresRepository` that implements it gets you both.

# How the Principles Reinforce Each Other

SOLID is not five independent rules — the principles interact:

* **LSP enables OCP.** If every subtype honors the parent's contract, a router can iterate polymorphically without knowing which subclass it has — so new subclasses extend the system without modifying the router.
* **DIP enables OCP.** If high-level modules depend on abstractions, new implementations can be plugged in as extensions — again, without modifying existing code.
* **ISP reduces LSP risk.** Smaller interfaces mean fewer methods a subtype could violate. If a class never inherits `refund()`, it cannot break `refund()`'s postcondition.
* **SRP + OCP prevent God Classes.** SRP keeps each class narrow enough to understand; OCP keeps it stable enough to trust.

When students master a single principle, the next one usually clicks faster. When they master the interconnections, they can refactor real systems — not just textbook examples.

# When NOT to Apply SOLID

Applying SOLID to a problem that doesn't need it creates new problems:

* **Single-use scripts or prototypes.** If the code will be read once and deleted, extension points are wasted effort.
* **Single-variant modules.** An abstract base class with exactly one concrete implementation is premature abstraction. Wait for the second variant to appear, then extract the interface.
* **Simple value objects.** A `Point2D` with `x` and `y` needs no interface.
* **Boilerplate domains.** Some CRUD code really is just CRUD. Splitting five lines across four classes because "it would follow SRP" obscures the intent rather than clarifying it.

The judgment of *when to apply* SOLID — and when to stop — is itself the mark of senior design skill. The principles are tools, not a scorecard.

# Further Reading

* Robert C. Martin. *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall, 2017.
* Robert C. Martin. *Agile Software Development, Principles, Patterns, and Practices*. Prentice Hall, 2002.
* Barbara Liskov. "Data Abstraction and Hierarchy." *OOPSLA '87 Addendum to the Proceedings*. 1987.
* Raimund Krämer. "SOLID Principles: Common Misconceptions." 2024. [raimund-kraemer.dev](https://raimund-kraemer.dev/solid-principles-common-misconceptions/)
