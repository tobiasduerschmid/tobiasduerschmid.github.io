# Modularity — coupling, cohesion, and packaging

> Synthesised from *Clean Architecture* parts III–IV (Martin), *Just Enough Software Architecture* ch. 11 (Fairbanks), *OOSC2* ch. 3 (Meyer), and *Software Architecture in Practice* ch. 7 (Bass et al. on modifiability).

This reference covers the rules that govern **how modules / packages / components relate to each other** — what makes a good module boundary, why some packagings age well and others rot, and how to think about coupling and cohesion at a scale larger than the class.

Read this whenever you trigger any of: "where should this new code live", "this file is getting too big", "should these be separate packages", "I'm seeing Shotgun Surgery / Divergent Change", "should this be a separate service", "monorepo or split repos".

## Table of contents

1. [Coupling and cohesion](#coupling-and-cohesion)
2. [Component cohesion principles (REP / CCP / CRP)](#component-cohesion-principles)
3. [Component coupling principles (ADP / SDP / SAP)](#component-coupling-principles)
4. [Encapsulation strategies](#encapsulation-strategies)
5. [Package by layer vs package by feature vs package by component](#package-by-layer-vs-feature-vs-component)
6. [Where to draw a module boundary in practice](#where-to-draw-a-module-boundary-in-practice)
7. [Conway's Law — modules and team boundaries](#conways-law)

---

## Coupling and cohesion

These two concepts (Constantine, Yourdon, Myers — 1970s) underlie almost every modularity rule.

**Cohesion** = how strongly the elements *inside* a module belong together. High cohesion = "all of these belong here". Low cohesion = "these were thrown together because they all start with the same letter".

**Coupling** = how strongly modules depend on each other. Low coupling = "I can change this module without touching that one". High coupling = "every change ripples".

**The goal: high cohesion within modules, low coupling between modules.** Almost every concrete design rule is an instance of this.

### Cohesion — the spectrum (low to high)

Constantine's classification, in order from worst to best:

1. **Coincidental.** Elements grouped for no semantic reason — a `utils.js` with `parseDate`, `httpRetry`, and `formatCurrency`. *Always* a smell.
2. **Logical.** Grouped by category, not by collaboration — "all the validators" in one module. Each one is independent; the module is just a container.
3. **Temporal.** Grouped because they happen at the same time — "all the startup code" in one module. The pieces don't know about each other; only the runtime ordering ties them.
4. **Procedural.** Sequential execution of related steps. Better — there's a real flow — but the steps may not share much state.
5. **Communicational.** Operate on the same data. Better still.
6. **Sequential.** Output of one is input of next. Forms a pipeline.
7. **Functional.** All elements contribute to a single, well-defined task. The gold standard — *Clean Code*'s "do one thing" applied to a module.

In practice, aim for **functional cohesion** at the class / module level. **Coincidental cohesion** is the failure mode to watch for — `utils`, `helpers`, `common`, `misc` are usually coincidental.

### Coupling — the spectrum (high to low, worst to best)

1. **Content.** Module A reaches into module B's internals (private fields, friend access, monkey-patching). The most fragile coupling — any internal change breaks A.
2. **Common.** Modules share global state. Every change to the state risks breaking every consumer.
3. **External.** Modules depend on a shared external resource (file format, environment variable, schema).
4. **Control.** A passes a flag to B that tells B *what* to do. B's logic is partly in A.
5. **Stamp.** A passes a whole data structure to B, B uses only part. B is coupled to the parts of the structure it doesn't even use.
6. **Data.** A passes B exactly the data it needs. The minimum.
7. **Message-passing.** A sends B a message; the message is the contract. The loosest possible coupling.

Aim for **data** or **message-passing** between modules. The big enemies are **content coupling** (e.g. accessing private fields via reflection, monkey-patching) and **common coupling** (singletons, mutable globals, "shared state" in modules).

### The connection to SOLID

- **SRP** ≈ improve cohesion (don't pile in extra responsibilities).
- **OCP / DIP / ISP** ≈ reduce coupling (depend on abstractions, depend only on what you use).
- **LSP** ≈ make polymorphic coupling safe.
- **Information Hiding** ≈ minimize the surface area of coupling.

---

## Component cohesion principles

When you're grouping classes into a deployable component (package, library, JAR, gem, npm package), three principles, often in tension:

**REP — Reuse / Release Equivalence Principle.**
> *The granule of reuse is the granule of release.*
The unit you reuse is the unit you release. Classes / modules grouped into a component should be reusable together — meaningful as a single unit. They should also share a release cycle and version number.

**CCP — Common Closure Principle.**
> *Gather into components those classes that change for the same reasons and at the same times. Separate into different components those classes that change at different times and for different reasons.*
This is **SRP for components.** A component should have one reason to change. If a single business rule change forces edits across many components, the boundaries are wrong.

**CRP — Common Reuse Principle.**
> *Don't force users of a component to depend on things they don't need.*
This is **ISP for components.** If you depend on a component, you depend on its whole release. So, don't bundle classes that aren't used together — you'd be dragging unrelated transitive deps into every consumer.

These three are in tension. REP and CRP both tend to make components *smaller* (so you only get what you reuse, what you release together is what's reused together). CCP makes them *larger* (so a single change is contained). Component design lives on the triangle these form. Early-stage components often start CCP-heavy (avoid premature splits); mature components shift toward CRP/REP as the reuse pattern stabilizes.

---

## Component coupling principles

Three rules govern dependencies *between* components:

**ADP — Acyclic Dependencies Principle.**
> *Allow no cycles in the component dependency graph.*

Cycles destroy independent deploy / develop / release. If A→B→C→A, then any change in any of them forces all three to be tested and released together — they're effectively one big component. Worse, you can't reason about any one in isolation.

Fixes: invert the dependency that creates the cycle (DIP), or extract the shared piece into a fourth component everyone depends on.

**SDP — Stable Dependencies Principle.**
> *Depend in the direction of stability.*

Stability = how hard a component is to change, often measured by the number of dependents (more dependents = more pinned by them). A component should depend only on components more stable than itself. Otherwise, an unstable thing can shake stable things every time it changes.

Practical implication: domain logic (high stability — slow-changing, many dependents) should not depend on UI code (low stability — fast-changing). It's the *opposite* of the natural direction. Use DIP to invert.

**SAP — Stable Abstractions Principle.**
> *A component's abstractness should match its stability.*

The most stable components should also be the most abstract — interfaces, abstract classes, protocols, traits. Otherwise stability becomes rigidity (you have stuff that's hard to change *and* full of details you can't extend).

The least stable components should be concrete (so they can be replaced wholesale).

---

## Encapsulation strategies

From *Just Enough Software Architecture* ch. 11 — three strategies for encapsulating a module:

1. **Hide internals behind a public API.** The classic — the `public` keyword, module exports, `__all__`. The internal implementation is free to change so long as the public API stays compatible.

2. **Hide variation.** Identify what is likely to change (storage format, algorithm, third-party dependency, threading) and put it behind an interface. (This is also OCP and DIP and Information Hiding — same insight.)

3. **Hide data behind operations.** Don't expose the data structure; expose operations on it. `addOrder(order)` rather than `orders.push(order)` lets you change the internal collection without touching every caller.

**Effective encapsulation has measurable signs**: the count of imports across a module boundary is *small*, and most of those imports are *abstract types* (interfaces, protocols).

---

## Package by layer vs feature vs component

How you group files at the package / directory level matters more than people think. *Clean Architecture* ch. 34 ("The Missing Chapter") lays out three options.

### Package by layer

```
app/
  controllers/   (UserController, OrderController, PaymentController)
  services/      (UserService,    OrderService,    PaymentService)
  repositories/  (UserRepository, OrderRepository, PaymentRepository)
```

The technical role is the top-level grouping. Easy to find "all the controllers"; mirrors the framework.

**Drawbacks:**
- A single feature ("add user soft-delete") touches at least three packages.
- Every developer has read access to all controllers and all repositories — encapsulation is at the file level only; nothing prevents `OrderController` from reaching into `UserRepository`.
- The package structure tells you nothing about what the system *does*. It tells you what framework you're using. (See "Screaming Architecture" in [architecture.md](architecture.md).)

### Package by feature

```
app/
  user/        (UserController, UserService, UserRepository)
  order/       (OrderController, OrderService, OrderRepository)
  payment/     (PaymentController, PaymentService, PaymentRepository)
```

Each feature is one package. A feature change is one-package change. The directory listing screams what the system is about.

**Drawback:** still no encapsulation between features — `OrderController` can directly import `UserRepository`. The cross-cutting boundaries (controller / service / repository) aren't enforced.

### Package by component

```
app/
  user/
    UserComponent  (public; what other features can call)
    internal/      (UserService, UserRepository — package-private)
  order/
    OrderComponent
    internal/
  payment/
    PaymentComponent
    internal/
```

(Package-private visibility, internal modules, etc. — the language enforces encapsulation.) Each feature has a public *component* facade and hides its internals. Cross-feature calls go through the facade. **The compiler now enforces the architecture.**

This is Simon Brown's recommendation in *Software Architecture for Developers*, and Martin's "Missing Chapter" advice in *Clean Architecture*.

### Practical rule

- **Tiny project (< ~5 features):** package by layer is fine.
- **Medium project:** package by feature is the sweet spot for most. Discipline replaces enforcement; periodic review keeps cross-feature calls in check.
- **Large project / multiple teams:** package by component, with the language enforcing module boundaries. The cost (extra ceremony to expose something publicly) is more than paid back by the encapsulation.

---

## Where to draw a module boundary in practice

The hardest design decision in the small. Heuristics, in priority order:

1. **At a stable, well-named concept.** A module called `Invoicing` will still be called that in five years. A module called `OrderProcessor` is suspiciously verb-y. A module called `Utilities` will never make sense. The longer a name will survive, the better the boundary.

2. **At a different rate of change.** If two pieces of code never change together but always change for unrelated reasons, they should be in different modules (CCP). If two pieces always change together, putting them in different modules creates Shotgun Surgery (CCP again).

3. **At a different actor / stakeholder.** SRP — code that serves the finance team and code that serves the support team should be in different modules.

4. **At a volatility seam.** Frameworks, third-party APIs, file formats, network protocols all change on someone else's schedule. Put a boundary between the volatile piece and your stable code, with the volatile piece behind an interface owned by your stable code (DIP).

5. **At a team boundary** (Conway's Law — see below). One team should own a module; modules shouldn't span teams.

6. **At a deployable / scalable unit.** If the system needs to scale one part separately, that part may want to be a separate component / service.

**Bad reasons to draw a boundary:**
- "It feels like it should be its own thing" without a concrete reason.
- "We might need it elsewhere later" — premature; YAGNI.
- "The class is too big" — split, but split *along a real concept*, not arbitrarily by size.
- "All my files are getting big" — that's a refactoring trigger, not a boundary trigger; first try to extract within the class / module.

---

## Conway's Law

> *Any organization that designs a system will produce a design whose structure is a copy of the organization's communication structure.* — Melvin Conway, 1967

Module boundaries that don't match team boundaries are unstable: high-cost coordination across the boundary, high-bandwidth communication that ought to be inside one team's heads. Conversely, a team boundary will *create* a module boundary even if the design wasn't there.

**Implication for design:** when picking module boundaries, consider who owns each module. A module shared between two teams will become a coordination tax. A module wholly within one team is cheap. (This is also why microservices — and any other deployable-component split — should track team structure, not aspirational engineering.)

**The "inverse Conway maneuver":** restructure the org to match the design you want. Hard but sometimes the right move at scale.

---

## Cross-references

- For SRP, OCP, DIP and the underlying class-level rules: [design-principles.md](design-principles.md)
- For when high coupling / low cohesion shows up as a smell, and how to refactor toward better modularity: [refactoring.md](refactoring.md) — *Divergent Change*, *Shotgun Surgery*, *Feature Envy*, *Data Class*
- For the architecture-level extension (the dependency rule, layers, boundaries between deployable units): [architecture.md](architecture.md)
- For when to make the call vs when to defer it: [decision-protocol.md](decision-protocol.md)
