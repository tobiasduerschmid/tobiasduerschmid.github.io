# Architecture — boundaries, dependencies, and quality attributes

> Synthesised from *Clean Architecture* (Martin, 2017), *Software Architecture in Practice* (Bass / Clements / Kazman, 3rd/4th ed.), *Software Architecture for Developers* (Brown), *Just Enough Software Architecture* (Fairbanks, 2010), and *Architecting Software-Intensive Systems*.

This reference covers the **system-level** rules — how to draw layer boundaries, where to put a service split, how to reason about quality attributes (modifiability, performance, security, availability, testability, usability, interoperability), and how to do "just enough" architecture without over-investing.

Read this whenever you trigger any of: "design a new component", "introduce a layer / boundary / service", "what's the right architecture for X", "how should this scale", "this is touching too many parts of the system", or "I'm choosing between two architectures and don't know how to decide".

## Table of contents

1. [What architecture is](#what-architecture-is)
2. [The dependency rule](#the-dependency-rule)
3. [Layers, ports, and adapters](#layers-ports-and-adapters)
4. [Screaming architecture — let intent shape structure](#screaming-architecture)
5. [Boundaries — when to draw them, what they cost](#boundaries)
6. [Quality attributes and tactics](#quality-attributes-and-tactics)
7. [Risk-driven architecture — Fairbanks' "just enough"](#risk-driven-architecture)
8. [Documenting architecture (lightweight)](#documenting-architecture)
9. [Common architectural styles](#common-architectural-styles)

---

## What architecture is

> *The software architecture of a system is the set of structures needed to reason about the system, which comprise software elements, relations among them, and properties of both.* — Bass et al., *SAiP*

> *Architecture represents the significant design decisions that shape a system, where significant is measured by cost of change.* — Grady Booch

Architecture is the **decisions whose cost grows fastest if you get them wrong**. Examples: which boundaries are deployable units, where data lives, what the dependency direction is between major components, which quality attribute (latency? availability? security? modifiability?) wins when two conflict.

Architecture is *not*: the framework you chose, the database vendor, the language. Those are **details** (and *Clean Architecture* parts V–VI argue at length they're details, not architecture). The architecture is the part that survives a framework change.

Good architecture **keeps options open**. It defers decisions that don't have to be made yet — which DB, which UI framework, which third-party service — by structuring the code so any of them can be chosen later.

---

## The dependency rule

> *Source code dependencies must point only inward, toward higher-level policies.* — Martin, *Clean Architecture* ch. 22

This is the single most important rule in this file. The **direction of source-code dependency** must point from less-stable / lower-level (UI, frameworks, DB, devices, external services) toward more-stable / higher-level (use cases / business rules / domain entities).

The classic four concentric circles of *Clean Architecture*:

```
                  ┌──────────────────────────────────┐
                  │  Frameworks & Drivers            │   ← UI, DB, web, devices
                  │  ┌────────────────────────────┐  │
                  │  │  Interface Adapters        │   ← controllers, presenters,
                  │  │  ┌──────────────────────┐  │     gateways
                  │  │  │  Use Cases           │   ← application-specific rules
                  │  │  │  ┌────────────────┐  │  │
                  │  │  │  │  Entities       │ ← enterprise-wide business rules
                  │  │  │  └────────────────┘  │  │
                  │  │  └──────────────────────┘  │
                  │  └────────────────────────────┘  │
                  └──────────────────────────────────┘
                             dependencies →
                             (always inward)
```

**Concrete cues** that the rule is being violated:
- A `domain/`, `entities/`, or `core/` file that imports `requests`, `flask`, `django.db`, `sqlalchemy`, `axios`, `react`, `os.environ`, `boto3`, or any framework / vendor symbol.
- A test of business logic that requires a real DB connection.
- A change in the DB schema requires editing 20 files in the domain.

**The fix** is *Dependency Inversion* (see [design-principles.md](design-principles.md) — DIP): the domain defines an interface (`OrderRepository`, `EmailGateway`, `Clock`), the infrastructure layer implements it. The interface lives in the domain; the implementation lives at the edge. Compile-time dependencies point inward; data flow at runtime can go either direction.

The benefit: the domain becomes (a) testable without infrastructure, (b) replaceable on the infrastructure side without touching the domain, (c) durable across framework / vendor / library churn.

---

## Layers, ports, and adapters

The "ports and adapters" architecture (Alistair Cockburn, also known as Hexagonal Architecture) is the practical embodiment of the dependency rule.

```
┌─────────────────────────────────────┐
│           Application Core          │
│      (use cases + domain entities)  │
│                                     │
│   ┌────────────┐    ┌────────────┐  │
│   │   Driving  │    │   Driven   │  │
│   │    Port    │    │    Port    │  │
│   └────────────┘    └────────────┘  │
└─────────────────────────────────────┘
       ▲                    │
       │                    ▼
  Driving Adapter      Driven Adapter
  (HTTP, CLI, GraphQL,  (DB, message bus,
   gRPC, scheduler)      email, file, S3)
```

- **Ports** = interfaces in the domain layer.
- **Driving adapters** call into the domain (HTTP controllers, CLI handlers, scheduler triggers — they drive the application).
- **Driven adapters** are called by the domain (DB repository implementations, email senders — the application drives them).

**Practical implications for code organization:**
- Domain is at the centre, has no `import` of any framework.
- Driving adapters convert framework-shaped requests into domain calls.
- Driven adapters implement domain-defined interfaces.
- Each adapter is replaceable: swap Postgres for MongoDB by writing a new driven adapter.

Note that "layers" and "hexagonal" are compatible. A 4-layer architecture (Presentation / Application / Domain / Infrastructure) is a layered version of hexagonal where Presentation and Infrastructure are the adapter rings.

---

## Screaming architecture

> *The architecture of an application should scream what the application is, not what framework it uses.* — *Clean Architecture* ch. 21

If the top-level directories of your project are `controllers/`, `services/`, `repositories/`, `models/` — your project is screaming "I'm a Rails / Django / Spring app". That's a framework artefact, not what the system *is*.

If the top-level directories are `Onboarding/`, `Billing/`, `Catalog/`, `Fulfillment/` — your project is screaming "I'm an e-commerce platform with these four bounded contexts". A new developer reading the directory tree learns what the system does in 30 seconds.

This is the architectural extension of *intention-revealing names*. Apply it at every level: source tree, package structure, even URL path schemes.

---

## Boundaries

> *Boundaries are walls within an architecture that separate volatile elements from stable elements.* — *Clean Architecture* ch. 17

Drawing a boundary has costs and benefits.

**Benefits:**
- Independent development (each side has a separate team or schedule).
- Independent deploy (each side can ship without the other).
- Independent reasoning (you can understand and change one side without loading the other into your head).
- Pluggability (the volatile side can be swapped).

**Costs:**
- Plumbing — interfaces, data shape conversion, wire formats.
- Latency — if the boundary is a network call, every cross-boundary call costs ms.
- Distributed-system failure modes — partial failure, partition tolerance, eventual consistency.
- Coordination on the contract — once two sides exist, evolving the contract is harder.

**Choose a boundary type to match the actual need:**
- **Source-level boundary** (different package / module, no runtime overhead) — the cheapest. Use unless you need more.
- **Deployment boundary** (different binary / container) — adds independent release.
- **Process boundary** (different OS process, IPC) — adds isolation, fault containment.
- **Service boundary** (different network endpoint) — adds independent scaling, language choice, team ownership; pays the network tax.

A common mistake is jumping straight to service boundaries (microservices) for benefits that only required source-level boundaries. *Clean Architecture* ch. 27 ("Services: Great and Small") makes the case bluntly: services don't replace good design — they amplify it (or amplify its absence).

**Where to draw a boundary** — recap from [modularity.md](modularity.md):
- At a stable, well-named concept.
- Where rates of change differ.
- Where the actor / stakeholder differs (SRP).
- Where volatility lives (frameworks, third parties).
- At a team boundary (Conway's Law).
- Where independent scaling is needed.

---

## Quality attributes and tactics

> *Architecture serves the quality attributes.* — Bass et al., *SAiP*

Functional requirements say *what* the system does. **Quality attributes** (sometimes called non-functional requirements, or "the -ilities") say *how well* it does it. Architecture decisions live and die by quality attributes; functional requirements can usually be met by any architecture.

The standard list (Bass et al., *SAiP* part II; Meyer's external quality factors in *OOSC2* ch. 1):

- **Modifiability.** How easy is it to make likely changes? *The* quality attribute most served by clean code, SOLID, low coupling, high cohesion, and the dependency rule.
- **Testability.** How easy is it to detect a failure? Highly correlated with modifiability — testable code is well-decomposed code.
- **Performance.** Latency, throughput, jitter. The classic engineering-tradeoff axis.
- **Availability.** What fraction of the time is the system usable? Tactics: redundancy, failover, graceful degradation, retries with backoff, circuit breakers.
- **Security.** Confidentiality, integrity, authentication, authorization, audit. Tactics: defense in depth, least privilege, validate at the boundary, fail closed.
- **Usability.** Can the user get the job done? Often architectural — supporting undo / cancel / progress requires designs (command pattern, saga) that aren't free to retrofit.
- **Interoperability.** How well does the system work with others? Tactics: stable wire formats, versioned APIs, adapters at boundaries.
- **Deployability.** How easy is it to ship a new version? Tactics: small deployable units, feature flags, blue-green deployment.

**Quality attributes trade off.** You cannot maximize all simultaneously. Concrete examples:
- **Performance vs Modifiability.** Inlining everything is fast and rigid. Heavy abstraction is slow and flexible.
- **Security vs Usability.** Stricter auth (re-prompt every action) is more secure and worse to use.
- **Availability vs Consistency.** CAP theorem — you can't have both during a partition.
- **Modifiability vs Performance.** A pluggable architecture pays per-call indirection cost.

Architecture is **the practice of being explicit about which trade-offs you are making.** *SAiP* part II is structured around per-attribute "tactics" — concrete moves to dial each attribute up or down — and per-attribute "design checklists" of questions to ask yourself.

**For this project's typical work** (LLM-assisted code in a Jekyll site with browser-based tutorial widgets), the quality attributes that usually matter most are:

1. **Modifiability** (this is a teaching site that changes constantly; making a change must be cheap).
2. **Testability** (tutorials run in the browser; tests have to be possible without a server).
3. **Usability** (students need keyboard support, screen-reader support, low cognitive load — see WCAG 2.2 AA).
4. **Performance** (page load and tutorial widget responsiveness).

Performance and security in the strict sense (confidentiality / data protection at scale) are usually less load-bearing here.

---

## Risk-driven architecture

> *The amount of architectural design effort should be proportional to the risks faced.* — Fairbanks, *Just Enough Software Architecture*

The biggest mistake in architecture is doing **too much** of it before knowing what's risky, or doing **too little** when something risky is hidden in plain sight.

Fairbanks' three-step risk-driven model:

1. **Identify the risks.** What about this design might fail? Performance under load? Concurrency? A third-party API behaviour we don't fully understand? Cross-team integration? Data migration?
2. **Pick a technique to address each risk.** A model, a prototype, a load test, a thought experiment, a written tradeoff analysis, an architectural pattern.
3. **Stop when the risks are acceptable.** Don't keep doing architecture for its own sake.

If the risk is *low* — a CRUD form for an internal tool — almost no architecture work is justified. Pick a stack, follow conventions, ship.

If the risk is *high* — building a payment system, a real-time collaborative editor, a system that must integrate with five legacy services — architecture work pays. Sketch the structure, identify the boundaries, prototype the risky parts, document the trade-offs.

This is the antidote to both **Big Design Up Front** (waste effort on plans that don't survive contact with reality) and **No Design Up Front** (ship a prototype that calcifies into a Big Ball of Mud).

For LLM-assisted coding, the practical implication: when the user asks "how should I structure X?", **ask back what the risks are**. A new tutorial widget is mostly "follow the existing pattern" risk-low work; a new persistence layer that must survive a future migration to a backend service is risk-high work that warrants more design.

---

## Documenting architecture

The minimum viable architecture document is small. Match the medium to the audience.

### C4 model (Simon Brown)

Four levels of zoom:

1. **Context** — one box (the system) inside boxes (people, external systems). Audience: anyone, including non-technical.
2. **Containers** — applications, services, databases, queues. Audience: developers and ops.
3. **Components** — internal modules of one container. Audience: developers in that container.
4. **Code** — class diagrams (rarely worth drawing by hand; let the IDE generate).

Most teams need just (1) and (2) drawn, plus (3) for the container they live in. Brown's website has detailed examples; the diagrams skill in this project ([`../diagrams/SKILL.md`](../diagrams/SKILL.md)) covers rendering.

### Architectural Decision Records (ADRs)

Short documents (1 page) capturing one decision: the context, the options considered, the choice, the consequences. Lightweight; commitable to the repo (`docs/adr/0001-record-architecture-decisions.md`). Captures the "why" that future maintainers will lose otherwise.

### Lightweight architecture description (Brown)

Per *Software Architecture for Developers*, a "software guidebook" of ~10 sections (context, functional requirements, quality requirements, constraints, principles, software architecture, code, data, infrastructure, deployment, operations, decision log) — written as the code is written, not before. Most projects benefit from at least sections 1, 6, and 12.

### Don't over-document

> *Documenting an architecture in detail is enormously expensive and the documents go stale within months.* — paraphrased from Bass et al.

The right amount of documentation is the amount that lets a new developer become productive without interviewing the originals. For a small project, that's an `ARCHITECTURE.md` with the C4 context+container diagrams, the major decisions, and a "how to add a new X" walkthrough. For a large project, more.

---

## Common architectural styles

A short reference of the recurring patterns. *Just Enough Software Architecture* ch. 14 has a fuller catalog.

- **Layered.** UI → Application → Domain → Infrastructure. Strict layering says each layer only calls the one below; relaxed allows skipping. The default for most line-of-business apps. Modifiability good, performance OK.

- **Pipe-and-filter.** Stages process data and pass it on. Unix shells, Apache Beam, build pipelines. Excellent for data processing.

- **Publish-subscribe.** Events posted to a bus; subscribers react. Decouples producers from consumers; supports plug-in extension. Be careful: makes flow harder to trace; debugging is harder.

- **Client-server / N-tier.** Database tier, application tier, presentation tier. The web's default for two decades.

- **Microservices.** Independently deployable services, each owning its data. Adds independent scaling and team-ownership benefits at the cost of distributed-system complexity. Worth it when you have multiple teams; almost never worth it for one team.

- **Event-sourced + CQRS.** Source of truth is the event log; read models are projections. Excellent for audit-heavy domains (finance, healthcare); over-engineered for most CRUD.

- **Hexagonal / Ports & Adapters.** Already covered above. The layered architecture's modern friend.

- **Big Ball of Mud.** No discernible structure. The most common architecture in practice (Foote & Yoder, 1997). Easy to start, expensive to maintain. Avoid by drawing boundaries early — but only the boundaries the risks actually demand.

---

## Cross-references

- For the dependency rule in class-level form (DIP) and the underlying principles: [design-principles.md](design-principles.md)
- For component-level cohesion and coupling: [modularity.md](modularity.md)
- For the line-, function-, name-level craft architecture sits on top of: [clean-code.md](clean-code.md)
- For big-picture refactors (extract service, split layers): [refactoring.md](refactoring.md)
- For the long-form pause-before-changing protocol when an architecture decision is non-trivial: [decision-protocol.md](decision-protocol.md)
