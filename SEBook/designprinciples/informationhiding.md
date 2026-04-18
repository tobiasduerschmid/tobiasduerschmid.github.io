---
title: Information Hiding
layout: sebook
---

# Background and Motivation

## A Motivating Story: The PayPal Tangle

Imagine you joined a team building an online store. The first sprint went well: you shipped checkout, refunds, and a wallet. But you used PayPal directly everywhere — `OrderService`, `RefundService`, and `WalletService` each call `PayPal.charge(...)`, `PayPal.refund(...)`, `paypal.authenticate(...)`, and so on. Every service knows that **PayPal exists**, knows how to authenticate to PayPal, and constructs PayPal-specific objects like `PayPalCharge`.

```java
class OrderService {
    public void checkout(Order order, PayPalAccount paypal) {
        paypal.authenticate(...);
        PayPalCharge charge = PayPal.charge(paypal.getAccountToken(), order.getTotal());
        if (charge.wasSuccessful()) {
            // more business logic that depends on the 'charge' object ...
        } else { /* error handling */ }
    }
}

class RefundService {
    public void refund(Order order, PayPalAccount paypal) {
        paypal.authenticate(...);
        PayPalRefund refund = PayPal.refund(paypal.getAccountToken(), order.getTotal());
        // more business logic that depends on the 'refund' object ...
    }
}

class WalletService {
    public void addPaymentMethod(PayPalAccount paypal) {
        paypal.authenticate(...);
        PayPalPaymentMethod payment = PayPal.createPaymentMethod(paypal.getAccountToken());
        // more business logic that depends on the 'payment' object ...
    }
}
```

The PayPal **decision** is duplicated across all three services. Each service authenticates to PayPal, calls a PayPal-specific function, and consumes a PayPal-specific result type. Visually, the dependencies look like this:

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
class OrderService {
    + checkout(order, paypal)
}
class RefundService {
    + refund(order, paypal)
}
class WalletService {
    + addPaymentMethod(paypal)
}
class PayPal <<external API>> {
    + authenticate(...)
    + charge(token, amount)
    + refund(token, amount)
    + createPaymentMethod(token)
}
note bottom of PayPal
  PayPalDecision is
  duplicated everywhere
end note
OrderService ..> PayPal
RefundService ..> PayPal
WalletService ..> PayPal
@enduml'></div>

Three services, three direct dependencies on the PayPal SDK. The "secret" — *which payment provider we use* — is not a secret at all; every service knows it. Two months later, the CFO walks in:

> *"Visa is offering us better rates. Marketing wants Apple Pay for the mobile launch. Legal wants us to add Stripe for the EU rollout because PayPal won't sign their data-processing addendum. How long?"*

You open your editor, search for `PayPal`, and your heart sinks. The string `PayPal` appears in dozens of files — services, tests, error messages, retry logic, even logging. None of those files were *about* payment providers, but every one of them now needs to be edited. You estimate three weeks for the change, two more for regression testing, and a non-trivial probability that something subtle will break in production.

This is not a *coding problem*. This is a **design problem**. The team violated a design principle that has been known for over fifty years: a single difficult, likely-to-change design decision — *which payment provider we use* — was scattered across the entire codebase instead of being **hidden** inside a single module behind a robust interface. Every service "knew the secret". So every service had to be rewritten when the secret changed.

The principle that fixes this is called **Information Hiding**. The fix looks like this:

```java
// 1. Define a vendor-neutral interface — the only contract clients see.
interface PaymentGateway {
    ChargeResult charge(Order order, PaymentDetails payment);
    RefundResult refund(Order order, PaymentDetails payment);
    PaymentMethod createPaymentMethod(PaymentDetails payment);
}

// 2. ONE module hides the PayPal decision.
class PayPalGateway implements PaymentGateway {
    // PayPalDecision lives here — and ONLY here.
    /* implementation of the methods using the PayPal SDK */
}

// 3. Services depend on the abstraction, never on PayPal.
class OrderService {
    public void checkout(Order order, PaymentDetails payment) {
        getPaymentGateway().charge(order, payment);
        // more business logic ...
    }
}

class RefundService {
    public void refund(Order order, PaymentDetails payment) {
        getPaymentGateway().refund(order, payment);
        // more business logic ...
    }
}

class WalletService {
    public void addPaymentMethod(PaymentDetails payment) {
        getPaymentGateway().createPaymentMethod(payment);
        // more business logic ...
    }
}
```

The **decision** to use PayPal is hidden in one module (`PayPalGateway`). Other services don't know that PayPal exists — they only know `PaymentGateway`. The class diagram below makes the new structure obvious:

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
class OrderService {
    + checkout(order, payment)
}
class RefundService {
    + refund(order, payment)
}
class WalletService {
    + addPaymentMethod(payment)
}
interface PaymentGateway {
    + charge(order, payment): ChargeResult
    + refund(order, payment): RefundResult
    + createPaymentMethod(payment): PaymentMethod
}
class PayPalGateway {
    + charge(order, payment)
    + refund(order, payment)
    + createPaymentMethod(payment)
}
class PayPal <<external API>> {
    + authenticate(...)
    + charge(token, amount)
    + refund(token, amount)
    + createPaymentMethod(token)
}
note right of PayPalGateway
  PayPalDecision lives
  in ONLY this class
end note
OrderService ..> PaymentGateway
RefundService ..> PaymentGateway
WalletService ..> PaymentGateway
PayPalGateway ..|> PaymentGateway
PayPalGateway ..> PayPal
@enduml'></div>

When the CFO swaps providers, you write a new `StripeGateway implements PaymentGateway`, change a single line of dependency-injection wiring, and ship. The three services do not change at all — the diagram simply gains a second box (`StripeGateway`) hanging off the same interface.

## The Principle

> *"We propose [...] that one begins with a list of difficult design decisions or design decisions which are likely to change. Each module is then designed to hide such a decision from the others."*
>
> — David L. Parnas, *On the Criteria To Be Used in Decomposing Systems into Modules*, Communications of the ACM, December 1972

In modern phrasing, the Information Hiding principle says:

> **Design decisions that are likely to change independently should be the *secrets* of separate modules. The interfaces between modules should reveal as little as possible — only assumptions considered unlikely to change.**

Two halves are doing work here. *"Difficult or likely-to-change decisions"* is the **what**: identify volatility before you decompose. *"Hide [...] from the others"* is the **how**: make the volatile decision visible to exactly one module, and let the rest of the system reach it only through a stable interface.

The fix in our PayPal story is one module — `PaymentGateway` — that is the **only** code in the system allowed to know that PayPal exists. Every other service depends on `PaymentGateway`, never on PayPal. When the CFO swaps providers, exactly one module changes.

## Where the Principle Comes From: A Brief History

### The Software Crisis

By the mid-1960s, software had quietly become more complex than the hardware that ran it. **Margaret Hamilton**, lead software engineer for the Apollo missions, famously observed that *"the software was more complex [than the hardware] for the manned missions".* In 1968 the NATO conference on software engineering crystallized the **"Software Crisis"** — the recognition that software projects were systematically late, over budget, and failing to meet specifications. Brooks would later capture the same lament in *The Mythical Man-Month*.

A central question came out of that conference: *how do you decompose a large program so that complexity does not bury the team?* For most of the 1960s the answer was: **break the program into the steps of a flowchart, and make each step a module**. This is the natural impulse — it mirrors how humans describe procedures. But it scales badly: when a step's *details* change, every step that depended on those details breaks too.

### David Parnas, 1972, and the KWIC Example

Four years after the NATO conference, **David L. Parnas** published a short, sharp paper titled *On the Criteria To Be Used in Decomposing Systems into Modules*. He took a tiny example program — the **KWIC (Key Word In Context) index** — and decomposed it two ways.

The KWIC system itself is small: it accepts an ordered set of lines, where each line is a sequence of words. Any line can be *circularly shifted* by repeatedly removing the first word and appending it to the end. The system outputs all circular shifts of all lines, sorted alphabetically. This is not just a toy — Unix's "permuted" index for the `man` pages is essentially a real-world KWIC.

Parnas decomposed it two ways:

| Decomposition | Module = ... | When the data structure changes ... |
|---|---|---|
| **Conventional** | one step of the flowchart (read input, shift, alphabetize, print) | almost every module changes, because each step *knows* the shared data structure |
| **Information-hiding** | one *design decision* (e.g., "how lines are stored", "how shifting is implemented") | only the one module that owns the decision changes |

He then traced several plausible changes through both designs: changes to the **processing algorithm** (shift each line as it is read, vs. shift all lines at once, vs. shift lazily on demand); changes to the **data representation** (how lines are stored, whether circular shifts are stored explicitly or as pairs of *(line, offset)*); enhancements to **function** (filter out shifts starting with noise words like "a" and "an"; allow interactive deletion); changes to **performance** (space and time); and changes to **reuse**. The information-hiding decomposition absorbed each change inside one module; the conventional one rippled across most of the system.

Parnas's conclusion was startling at the time:

* Both decompositions *worked*, but the information-hiding one was dramatically easier to change, easier to understand independently, and easier to develop in parallel.
* The mistake of the conventional decomposition was that it treated the *processing sequence* as the criterion for splitting modules — a criterion that exposed every shared assumption to every module.
* The right criterion is: **what design decisions does this module hide?** A module that hides a decision *no one else needs to know* is a good module. A module whose existence cannot be justified by any hidden decision is a bad module.
* A practical test for hiding: imagine **two design alternatives, A and B**, for some volatile decision (e.g., shift-on-read vs. shift-on-demand). If you can design the module's interface so that **both A and B are implementable behind the same API**, you have hidden the decision well — you can switch later without rewriting the clients.

This paper is one of the most cited papers in all of software engineering. Many of the principles you will meet later — encapsulation, abstract data types, object-oriented design, layered architecture, dependency inversion, microservices — are direct descendants of this single argument.

# The Mechanics: Modules, Secrets, and Interfaces

## The Anatomy of a Module: Interface and Secret

A **module** is an independent unit of work. Parnas defined it as *"a work assignment given to a programmer or programming team"* — something one engineer (or one small team) can develop, test, and reason about in isolation. In practice a module can be a function, a class, a package, a library, a microservice, or even an entire team-owned subsystem. The granularity does not matter; what matters is the rule below.

Every module has **two parts**:

| Part | What it is | Who sees it | Stability |
|---|---|---|---|
| **Interface** | The stable contract describing *what* the module does | Visible to every client | Should change rarely |
| **Implementation (the secret)** | The code that fulfills the contract: data structures, algorithms, libraries used, sequence of internal steps | Hidden inside the module | Free to change at any time |

Picture an iceberg: the small tip above water is the interface. The vast bulk below water is the implementation — the secret. The whole point is that the implementation can be *anything you want*, so long as the interface keeps its promises.

A familiar analogy: a **wall power outlet**. The interface is the standard two- or three-prong socket and the guaranteed voltage and frequency. The implementation — solar panels, a coal plant, a nuclear reactor, a wind turbine — is hidden. Your laptop charger doesn't know, doesn't care, and cannot be broken by a change in the power source. The grid can swap solar in at noon and switch to gas at midnight without you ever rewriting your charger.

## Common Secrets Worth Hiding

Parnas's paper was deliberately abstract, but five decades of practice have produced a recognizable list of *categories* of decisions that are almost always worth hiding. Use this as a checklist when you decompose a system:

* **Data structures and data formats.** Whether names are stored as a `String`, a normalized `Person` record, an array of glyphs, or a row in a database. Whether IDs are integers or UUIDs.
* **Storage location.** Whether information lives in memory, on a local disk, in a SQL database, in S3, in Redis, or behind a third-party API.
* **Algorithms and computational steps.** A* vs. Dijkstra for routing. Quicksort vs. mergesort. Greedy vs. dynamic-programming for an optimization. Whether results are cached.
* **External dependencies — libraries, frameworks, vendors.** Axios vs. Fetch. MongoDB vs. Postgres vs. Supabase. PayPal vs. Stripe vs. Braintree. OpenGL vs. Vulkan.
* **Hardware and platform details.** CPU word size, byte ordering, screen resolution, file-path separators, OS-specific APIs.
* **Network protocols.** REST vs. gRPC, JSON vs. Protobuf, HTTP/1.1 vs. HTTP/2 — *as a transport detail*. (Whether the protocol is **stateful or stateless**, however, is often part of the interface; see below.)
* **Internal sequence of operations.** Whether a request is processed in two passes or one, whether validation runs before or after enrichment.

A useful question to ask while designing: *"If I can imagine a future where this decision changes, can I draw a circle around exactly the modules that would have to change"?* If the circle is small (ideally one module), the secret is well hidden. If the circle is large, the system has a structural problem you will pay for later.

## Visible Contract or Secret Detail? Practice Recognizing Each

Information Hiding does not mean *hide everything*. Some things genuinely belong in the interface — they are *promises* the module makes to its clients. The skill is learning which decisions belong on which side of the line.

Try each of these before reading the answer:

| Decision | Decision should be... | Why |
|---|---|---|
| Whether `MortgageCalculator` compounds **monthly or daily** | **Hidden** | Clients want a payment number; how it was computed is implementation detail. Future changes ("daily compounding for VIP customers") shouldn't ripple. |
| Whether the database is **SQL or NoSQL** | **Hidden** | Storage is the canonical secret. The application layer should not know. |
| Whether the network protocol is **stateful or stateless** | **Visible (in the contract)** | Statefulness changes how clients interact (do they reconnect? retransmit? carry a session token?). Clients cannot ignore it. |
| Whether the server is implemented in **Node.js, Java, or Dart** | **Hidden** | The wire protocol is the contract; the implementation language is irrelevant to the client. |
| Whether **PayPal is the payment provider** | **Hidden** | Vendors change. The interface should be `PaymentGateway`, not `PayPalGateway`. |
| Whether a function may **throw an exception** | **Visible** | Callers must handle it. A "silent" exception breaks contracts. |
| Whether requests are **rate-limited** | **Visible** | Callers need to back off. Hiding it produces mysterious failures. |
| Whether a list is stored as an **array or a linked list** | **Hidden** | A canonical Parnas example. Choose the data structure that fits, change it later if needed. |

The general rule: **hide what only the module needs to know to do its job; expose what callers need to know to use it correctly.** Anything in between is a judgment call — and almost always the right call is "hide it until proven otherwise".

## Why Information Hiding Matters: Concrete Benefits

Information Hiding is not an aesthetic. It produces measurable outcomes that teams care about.

1. **Local change.** When a hidden decision changes, exactly one module needs to be edited. The change does not ripple through the codebase, does not require a merge across teams, and does not need a full regression sweep — only the one module's tests need to pass.
2. **Local reasoning.** A developer reading `OrderService` does not need to load PayPal's API, retry logic, or webhook semantics into their head. They only need the contract of `PaymentGateway`. Studies of professional developers find that **program comprehension consumes ~58% of their time** *(Xia et al., 2017, IEEE TSE)* — every byte of detail you can keep out of a reader's head is real, recurring time saved.
3. **Parallel work.** If `PaymentGateway`'s interface is fixed in week 1, two developers can work in parallel: one builds the PayPal implementation behind the interface; another builds `OrderService` against the interface, using a fake. Neither blocks the other.
4. **Independent testability.** A module whose dependencies are abstracted behind interfaces can be tested with stubs and fakes. You do not need a real PayPal account to test `OrderService` — you supply a `FakePaymentGateway` that records what it was asked to do.
5. **Replaceability.** When a vendor raises prices, a library is deprecated, or a database hits a scaling wall, the swap is bounded. The blast radius of "we're changing payment providers" is one module instead of one codebase.

The mirror-image of these benefits is the cost of *failing* to hide information: the **Big Ball of Mud** *(Foote & Yoder, 1997)*, where unmanaged complexity leaves every module knowing every other module's secrets, and a one-line business change requires touching dozens of files. This is the modern face of the 1968 software crisis.

## Deep Modules vs. Shallow Modules

A modern extension of Parnas's idea, due to **John Ousterhout** in *A Philosophy of Software Design* (2018), is the distinction between **deep** and **shallow** modules.

<div style="display:flex;justify-content:center;margin:18px 0;">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 360" width="100%" style="max-width:820px;height:auto;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
  <defs>
    <filter id="ih-node-shadow" x="-14%" y="-14%" width="144%" height="156%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="2.5" stdDeviation="2.6" flood-color="#000" flood-opacity="0.22"/>
    </filter>
  </defs>

  <!-- Panel A: Deep Module -->
  <text x="170" y="28" text-anchor="middle" font-size="18" font-weight="700" fill="#1d8348">Deep module ✓</text>

  <rect x="120" y="50" width="100" height="38" rx="6" ry="6" fill="#dbe8f8" stroke="#4060a0" stroke-width="1.5" filter="url(#ih-node-shadow)"/>
  <text x="170" y="74" text-anchor="middle" font-size="14" fill="#222" font-weight="600">interface</text>

  <rect x="60" y="100" width="220" height="220" rx="6" ry="6" fill="#dbe8f8" stroke="#4060a0" stroke-width="1.5" filter="url(#ih-node-shadow)"/>
  <text x="170" y="200" text-anchor="middle" font-size="14" fill="#222" font-weight="600">implementation</text>
  <text x="170" y="222" text-anchor="middle" font-size="12" fill="#555">(hides a LOT of complexity:</text>
  <text x="170" y="240" text-anchor="middle" font-size="12" fill="#555">data structures, algorithms,</text>
  <text x="170" y="258" text-anchor="middle" font-size="12" fill="#555">libraries, edge cases…)</text>

  <text x="295" y="73" font-size="12" fill="#1d8348" font-style="italic">small</text>
  <text x="295" y="88" font-size="12" fill="#1d8348" font-style="italic">interface</text>
  <text x="295" y="208" font-size="12" fill="#1d8348" font-style="italic">deep</text>
  <text x="295" y="223" font-size="12" fill="#1d8348" font-style="italic">impl.</text>

  <!-- Vertical separator -->
  <line x1="395" y1="40" x2="395" y2="340" stroke="#ccc" stroke-width="1" stroke-dasharray="4 4"/>

  <!-- Panel B: Shallow Module (centered around x=590) -->
  <text x="590" y="28" text-anchor="middle" font-size="18" font-weight="700" fill="#c0392b">Shallow module ✗</text>

  <rect x="450" y="50" width="280" height="60" rx="6" ry="6" fill="#dbe8f8" stroke="#4060a0" stroke-width="1.5" filter="url(#ih-node-shadow)"/>
  <text x="590" y="78" text-anchor="middle" font-size="14" fill="#222" font-weight="600">interface</text>
  <text x="590" y="96" text-anchor="middle" font-size="12" fill="#555">(many methods, lots of detail exposed)</text>

  <rect x="540" y="120" width="100" height="50" rx="6" ry="6" fill="#dbe8f8" stroke="#4060a0" stroke-width="1.5" filter="url(#ih-node-shadow)"/>
  <text x="590" y="150" text-anchor="middle" font-size="14" fill="#222" font-weight="600">impl.</text>

  <text x="745" y="74" font-size="12" fill="#c0392b" font-style="italic">large</text>
  <text x="745" y="89" font-size="12" fill="#c0392b" font-style="italic">interface</text>
  <text x="650" y="143" font-size="12" fill="#c0392b" font-style="italic">tiny</text>
  <text x="650" y="158" font-size="12" fill="#c0392b" font-style="italic">impl.</text>

  <text x="590" y="220" text-anchor="middle" font-size="13" fill="#555">Hides little. Reader pays the cost</text>
  <text x="590" y="240" text-anchor="middle" font-size="13" fill="#555">of a wide interface and gets</text>
  <text x="590" y="260" text-anchor="middle" font-size="13" fill="#555">almost no abstraction in return.</text>
</svg>
</div>

* A **deep module** hides a *lot* of complexity behind a *small* interface. Examples: the file system (`open`, `read`, `write`, `close` — and behind it, hundreds of thousands of lines that handle disks, caching, journaling, permissions, network mounts); a garbage collector (`new` — and a sophisticated runtime behind it); a TCP socket.
* A **shallow module** exposes a wide interface that hides little. Pass-through getters and setters, classes whose methods one-to-one delegate to another class, "service" classes with twenty methods that each do one trivial thing. The reader pays the cost of learning a new interface but gains almost no abstraction.

Deep modules are the *goal* of Information Hiding. Each method on the interface should "buy" the reader a meaningful chunk of hidden complexity. Shallow modules — even if every field is `private` — give you the worst of both worlds: more vocabulary to learn, and no actual hiding.

A simple heuristic: **the bigger the difference between the interface size and the implementation size, the deeper the module**. Deep modules are valuable. Shallow modules are tax.

## Coupling and Cohesion: The Metrics of Hiding

Information Hiding is the *principle*; **coupling** and **cohesion** are the *metrics* that measure how well you applied it.

* **Coupling** = the strength of dependencies *between* modules. **Lower is better.** Two modules are tightly coupled if a small change in one usually requires changes in the other.
* **Cohesion** = the strength of dependencies *within* a module. **Higher is better.** A cohesive module's methods all serve a single, focused purpose.

When secrets are well hidden, coupling drops (because clients only know the interface) and cohesion rises (because everything in a module exists to support that one hidden decision). When secrets leak, the opposite happens.

| | High Coupling, Low Cohesion (bad) | Low Coupling, High Cohesion (good) |
|---|---|---|
| **Change** | Ripples through many modules | Stays inside one module |
| **Understanding** | You must load many modules into memory at once | You can reason about one module in isolation |
| **Testing** | Hard to test in isolation; needs many real dependencies | Easy to test with fakes |
| **Reuse** | Cannot extract one part without dragging others along | Modules are self-contained and portable |

### Not All Dependencies Are Obvious

Coupling has two flavors, and the second is the dangerous one:

* **Syntactic dependency:** Module A *won't compile* without Module B — it imports B, names B's types, calls B's methods. Easy for a tool to detect.
* **Semantic dependency:** Module A *won't function correctly* without Module B, even though A doesn't name B. A and B might both implement the same hidden assumption — for example, two modules that both assume "phone numbers are stored as 10-digit strings without formatting". If you change the assumption in one, the other silently breaks.

Semantic coupling is the reason "we'll just refactor it later" is so often wrong: the syntactic coupling is gone but the *shared assumptions* are still scattered. Information Hiding fights both — but semantic coupling only goes away when the shared assumption *itself* lives in exactly one place.

## Information Hiding ≠ Encapsulation ≠ "Make It Private"

This is the most common misconception about Information Hiding, and it is worth lingering on.

> **"If I make all my fields and methods `private`, I'm doing information hiding".**

No. *Visibility modifiers* (`private`, `protected`, `public`) are a small **language tool** that *helps you* hide things. **Information Hiding is the broader design principle** of choosing what should be hidden in the first place. You can violate Information Hiding while having no `public` fields anywhere:

```java
// Every field is private. The class is still leaking PayPal as a "secret".
public class OrderService {
    private final PayPalClient paypal;          // <-- the secret is in the field type
    private PayPalAuthToken token;              // <-- and in this type
    public PayPalCharge checkout(Order o, ...) {  // <-- and in the return type
        token = paypal.authenticate(...);
        return paypal.charge(o.total(), token);
    }
}
```

`private` did not save us. The PayPal decision is still woven into `OrderService`'s **interface** — the parameter types and return types of its public methods. Anyone who calls `checkout` learns that PayPal exists. The fix is to invent a `PaymentGateway` abstraction and let the *interface* of `OrderService` mention only that abstraction.

A better way to remember the distinction:

| Term | What it means |
|---|---|
| **Information Hiding** | A *design principle*: identify volatile decisions and hide each one inside one module. |
| **Encapsulation** | A *language mechanism*: bundle data and the operations on it into a single unit (a class). |
| **Access modifiers** (`private`, `protected`, `public`) | A *language tool*: restrict who can call which member. Used as one of many tools to enforce encapsulation. |
| **Abstraction** | A *thinking technique*: reason about something using only the properties relevant to your purpose. The interface of a hidden module is an abstraction. |

You need all four in the toolbox. The principle (Information Hiding) tells you *what* to do; the mechanisms (encapsulation, access modifiers, abstraction) help you *enforce* it.

# Applying and Evaluating Information Hiding

## How Information Hiding Relates to Other Concepts

Students often confuse Information Hiding with neighboring ideas. Drawing the distinctions sharpens your ability to apply each.

| Concept | What it says | Relationship to Information Hiding |
|---|---|---|
| **[Separation of Concerns](/SEBook/designprinciples/soc.html)** | Divide the system into distinct sections, each addressing a separate concern. | SoC tells you *which* aspects to separate; Information Hiding tells you *how* to protect each separated decision behind a stable interface. |
| **Modularity** | Split a system into independent work units. | Modularity is the act of splitting; Information Hiding is the *criterion* for splitting well (split along volatile decisions). |
| **Encapsulation** | Bundle data and operations into a single unit. | The language mechanism most often used to enforce Information Hiding. You can encapsulate without hiding (everything `public`); you can hide without language-level encapsulation (a Python module with leading-underscore conventions). |
| **Abstraction** | Reason about something via only its essential properties. | A module's interface *is* an abstraction; Information Hiding is what makes the abstraction trustworthy. |
| **[Single Responsibility (SRP)](/SEBook/designprinciples/solid.html)** | A class should have one reason to change. | SRP is Information Hiding restated for the *class* level — one class hides one secret, so it has one reason to change. |
| **[Dependency Inversion (DIP)](/SEBook/designprinciples/solid.html)** | High-level policy depends on abstractions; details depend on those abstractions. | DIP is the *mechanism* most commonly used to keep secrets hidden across architectural layers. |
| **Low Coupling / High Cohesion** | Modules should depend on each other little, and contain related things. | The metrics by which you measure whether Information Hiding succeeded. |
| **Open/Closed Principle (OCP)** | Open for extension, closed for modification. | When secrets are well hidden, *adding* a new variant (e.g., `StripeGateway`) extends the system without modifying any existing module — the OCP payoff. |

A useful slogan, attributed to Robert C. Martin: **"Gather together the things that change for the same reasons. Separate those things that change for different reasons".** That single sentence captures Information Hiding, SRP, and SoC simultaneously.

## Mechanisms for Hiding

Knowing what to hide is one skill; knowing the *moves* to actually hide it is another. The recurring mechanisms:

1. **Interfaces and abstract types.** Define a contract (`PaymentGateway`) and write all clients against it; let one concrete class (`PayPalGateway`) implement it. The decision "we use PayPal" lives in exactly one file plus the dependency-injection wiring.
2. **Dependency Inversion.** Don't reach down into low-level modules from high-level ones. Define the abstraction the high-level module *needs* and let the low-level module implement it. (See [DIP](/SEBook/designprinciples/solid.html).)
3. **Facade pattern.** Wrap a complex subsystem behind a simple interface; clients see only the facade. Common when a third-party library is itself a tangled mess.
4. **Adapter pattern.** Wrap an external API in your own interface so the rest of the code is insulated from its quirks.
5. **Repository / Gateway pattern.** Hide the storage decision (SQL? NoSQL? in-memory?) behind a domain-shaped interface (`OrderRepository.findById(id)`).
6. **Modules, packages, namespaces.** The crudest mechanism — putting things in different files and folders — already provides a unit of hiding, especially when paired with strong language-level visibility.
7. **Access modifiers.** `private`, `protected`, internal-only modules in Rust/Go/Swift, JavaScript closures. The enforcement layer that prevents accidental leakage.
8. **Abstract data types (ADTs).** Define a type by its operations, not its representation. The original tool Parnas's followers (Liskov, Guttag) developed to operationalize the principle.

You will rarely use only one of these. A good design typically composes several: an `OrderService` depends on a `PaymentGateway` interface (mechanism 1 + 2); the concrete `PayPalGateway` is a facade (3) over the messy PayPal SDK; the SDK is itself adapted (4) so swapping it out is bounded; the whole thing lives in a `payments/` package whose exports are restricted (6 + 7).

## Change Impact Analysis: Evaluating Whether Your Design Hides Well

Information Hiding is verified by *simulating change*. The procedure, used in industry as **change impact analysis**:

1. **List the changes that could plausibly happen.** New payment providers. New currencies. A migration from SQL to NoSQL. A change in regulatory requirements. Brainstorm widely; the discipline of listing forces realism.
2. **Estimate the likelihood of each.** Some are inevitable (libraries get deprecated); some are speculative (a 10× traffic spike).
3. **For each likely change, count the modules that would have to change.** Ideally **one**. If many, the secret is leaking.
4. **Redesign until no change is both *highly likely* and *highly expensive*.** You will not eliminate every tail risk — but you should not be one likely change away from a re-architecture.

This is also the procedure to apply when **reviewing** somebody else's design: open the code, pick a plausible future change, and trace what would have to be edited. A well-hidden design lights up one module; a poorly-hidden one lights up the whole tree.

## A Five-Step Method for Applying Information Hiding

When you are designing (or reviewing) a module, run this checklist:

1. **List the secrets.** What design decisions does this module own? Whether it stores its data as an array vs. a tree; which library it uses; the algorithm; the data format. If you cannot list any secret, the module probably should not exist on its own.
2. **Verify each secret is owned in *exactly one* place.** If two modules both "know" the secret, they are semantically coupled. Pick one.
3. **Inspect the interface for leaks.** Read every public method signature. Does any parameter type, return type, or thrown exception name a vendor, a database, a library, or a low-level data structure? If yes, the secret has leaked into the contract.
4. **Simulate a likely change.** Pick a realistic future change and trace what would need to be edited. If the answer is more than this module, redesign.
5. **Check for shallowness.** Is the implementation behind the interface non-trivial? If your "module" is a thin pass-through, merge it back into its caller — you have added an interface without buying any hiding.

## When NOT to Apply Information Hiding (Trade-offs Are Real)

Like every design principle, mindless application of Information Hiding produces its own pain.

* **Throwaway scripts.** A 50-line cron job does not need a `PaymentGateway` abstraction in front of a `print` statement. Hiding decisions you will never change is wasted ceremony.
* **Single-variant systems with stable scope.** If there will be exactly one database forever — and you are sure of it — a thin abstraction over it is overhead.
* **Premature abstraction.** Inventing a `PaymentGateway` when you know exactly one provider, in a domain you don't yet understand, will usually draw the seam in the wrong place. Wait for the second variant to materialize, then *refactor to* the abstraction. (See *Refactoring to Patterns*, Kerievsky 2004.)
* **Performance-critical inner loops.** Indirection has a cost — usually negligible, but occasionally measurable in tight loops or microservices boundaries. Sometimes you fuse layers deliberately for speed and comment loudly about why.
* **When the "secret" is actually part of the contract.** If callers genuinely need to know the property (e.g., whether a network protocol is stateful), hiding it produces mysterious bugs. Hiding the wrong thing is worse than hiding nothing.

The SE maxim: **the right number of abstractions is the smallest number that lets the system change gracefully.** Beyond that number, every extra layer is a tax paid in indirection, file count, and cognitive load.

## Anti-Patterns: What Poor Information Hiding Looks Like

Recognizing failure is half the skill.

* **Vendor name in the interface.** `OrderService.checkoutWithPayPal(...)`, `UserRepository.saveToMongo(...)`, `Logger.logToSplunk(...)`. The vendor is now part of the contract. Renaming the method when you switch vendors won't help — you'll have to rewrite every caller.
* **Returning the implementation type.** A repository method that returns `MySQLResultSet` instead of `List<Order>`. Every caller now depends on MySQL.
* **Leaky abstractions.** A "database-agnostic" `Repository` interface whose methods accept raw SQL fragments as strings. The interface pretends to hide the database; the parameters say otherwise.
* **Exposed mutable internals.** Returning a reference to an internal `List` instead of an immutable view. Callers can now mutate the module's state without going through its interface.
* **God classes.** A single class with thirty fields and a hundred methods. By construction, it cannot have a small set of secrets — it has too many.
* **Shallow modules.** A "service" class whose every method is a one-line pass-through to another class. The reader pays the cost of two interfaces and gets the abstraction value of one.
* **Conditional types in clients.** `if (paymentProvider == "paypal") { ... } else if (paymentProvider == "stripe") { ... }` scattered across the code. The provider is supposed to be hidden — but every site that branches on it is implicitly knowing the secret. Replace with polymorphism.
* **Documentation as a substitute for hiding.** A long comment explaining "this method is fragile because internally it depends on the order being stored as a list, please don't change it". If a secret has to be documented to clients, it has not been hidden.

## Predict-Before-You-Read: Spot the Violation

For each snippet, silently identify *which secret is leaking* before reading the analysis.

**Snippet A — "private" is not enough**
```java
public class OrderService {
    private final PayPalClient paypal;
    public PayPalCharge checkout(Order o, PayPalAccount acc) {
        paypal.authenticate(acc);
        return paypal.charge(acc.getAccountToken(), o.getTotal());
    }
}
```
> *Analysis:* The fields are `private`, but the **interface** (parameter and return types) names `PayPalClient`, `PayPalAccount`, and `PayPalCharge`. The PayPal decision has leaked into the contract — every caller of `checkout` now compiles against PayPal. Replace with a `PaymentGateway` abstraction that exposes only neutral types.

**Snippet B — leaky storage**
```python
class UserRepository:
    def find_by_email(self, email):
        return self.connection.execute(
            "SELECT * FROM users WHERE email="?, (email,)
        ).fetchall()  # returns a list of sqlite3.Row
```
> *Analysis:* The method signature looks abstract, but the *return value* is a `sqlite3.Row` — a SQLite-specific type. Every caller is now coupled to SQLite. Map to a domain object (`User`) before returning.

**Snippet C — clean**
```python
class PaymentGateway(Protocol):
    def charge(self, order: Order, payment: PaymentDetails) -> ChargeResult: ...
    def refund(self, charge_id: ChargeId) -> RefundResult: ...

class OrderService:
    def __init__(self, gateway: PaymentGateway):
        self._gateway = gateway
    def checkout(self, order: Order, payment: PaymentDetails) -> ChargeResult:
        return self._gateway.charge(order, payment)
```
> *Analysis:* The vendor name appears nowhere in `OrderService`. Swapping providers means writing a new `PaymentGateway` implementation and changing the dependency-injection wiring; no service code is touched. The secret is hidden in exactly one place — the concrete gateway implementation.

## Common Misconceptions

* **"Make it `private` and you're done".** Visibility modifiers are *one* tool. Private fields whose *types* expose the vendor still leak. (See snippet A above.)
* **"Information Hiding is the same as Encapsulation".** Encapsulation is a *mechanism*; Information Hiding is the *principle that decides what to encapsulate*. You can encapsulate the wrong things.
* **"More layers = more hiding".** Stacking facades on facades is shallow-module-ism. Each layer must hide *something* — otherwise it just adds vocabulary.
* **"Hide everything".** Some decisions belong in the contract (statefulness, error behavior, rate limits). Hiding them produces silent failures or unusable APIs.
* **"Once decided, the secrets list never changes".** Reality: as the system evolves, what was once stable becomes volatile (e.g., "we will always be on AWS"). Re-evaluate the secrets when the change pressure arrives.
* **"Microservices automatically hide information".** A microservice with a 50-method REST API exposing every internal field is a distributed God Class. Service boundaries do not magically produce small interfaces; you still have to design them.

## Summary

* **Information Hiding** decomposes a system by *design decisions*, not by processing steps. Each module owns one likely-to-change decision and hides it from the rest of the system.
* Coined by **Parnas (1972)** in response to the **Software Crisis**, it is the foundational principle behind modern modularity, encapsulation, abstract data types, and most of OOP.
* Every module has a stable **interface** (the public contract) and a hidden **implementation** (the secret). Clients depend on the interface; the implementation is free to change.
* Common secrets include data structures, storage, algorithms, libraries, hardware, and processing sequence. Some things — statefulness, rate limits, exception behavior — belong in the interface.
* **Deep modules** hide a lot of complexity behind a small interface. **Shallow modules** add overhead without value.
* Coupling and cohesion are the *metrics* by which Information Hiding is measured. Low coupling, high cohesion = secrets are well hidden.
* Information Hiding is *not* the same as `private`. Visibility modifiers are tools; Information Hiding is the principle that tells you *what* to hide.
* Verify a design with **change impact analysis**: simulate plausible changes and count the modules that would need to change.
* Don't over-apply: throwaway scripts, single-variant systems, and hot inner loops sometimes pay the cost of hiding without enjoying the benefit.

# Further Reading and Practice

## Further Reading

* David L. Parnas. ["On the Criteria To Be Used in Decomposing Systems into Modules"](https://dl.acm.org/doi/10.1145/361598.361623). *Communications of the ACM*, 15(12), 1053–1058. December 1972. — *The original paper. Short, sharp, and one of the most-cited papers in software engineering.*
* John K. Ousterhout. *A Philosophy of Software Design* (2nd ed.). Yaknyam Press, 2021. — *The contemporary treatment. Coined the deep / shallow module distinction.*
* Robert C. Martin. *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall, 2017. — *Connects Information Hiding to SRP, DIP, and modern architecture.*
* Frederick P. Brooks Jr. *The Mythical Man-Month* (Anniversary ed.). Addison-Wesley, 1995. — *The classic essays on the Software Crisis and "No Silver Bullet".*
* Brian Foote and Joseph Yoder. ["Big Ball of Mud".](http://www.laputan.org/mud/) Proceedings of the 4th Pattern Languages of Programs Conference, 1997. — *What systems look like when Information Hiding is abandoned.*
* Xin Xia, Lingfeng Bao, David Lo, Zhenchang Xing, Ahmed E. Hassan, Shanping Li. ["Measuring Program Comprehension: A Large-Scale Field Study with Professionals".](https://doi.org/10.1109/TSE.2017.2734091) *IEEE Transactions on Software Engineering*, 44(10), 951–976, 2018. — *Source for the "developers spend ~58% of their time on program comprehension" finding.*
* Joshua Kerievsky. *Refactoring to Patterns*. Addison-Wesley, 2004. — *On evolving abstractions only when the change pressure proves you need them.*

## Practice

Test your understanding below. Effortful retrieval is exactly what builds durable mental models. Come back tomorrow for the spacing benefit.

### Reflection Questions

1. Pick a class or module in a codebase you've worked on. List the **secrets** it owns. If you cannot list any, what is its justification for existing as a separate module?
2. The lecture argues that "If I make my fields `private`, I have hidden the data". Why is this only half right? Give a small code example where every field is `private` but Information Hiding is still violated.
3. Think of the **operating system** you use daily. Name two *difficult* or *likely-to-change* design decisions an OS hides (e.g., the file system, the scheduler) and describe what would happen to user programs if those decisions stopped being hidden.
4. Some properties of a module belong in its **interface**, not in its hidden implementation — for example, whether a network protocol is stateful or stateless. Why? What makes a property "interface material" rather than "secret material"?
5. The lecture mentions that "program comprehension takes up 58% of professional developers' time". Connect this statistic to the design decisions you make as a programmer: what kinds of information hiding most directly reduce cognitive load on future readers?

### Knowledge Quiz

{% include quiz.html id="design_principle_information_hiding" %}

### Retrieval Flashcards

{% include flashcards.html id="design_principle_information_hiding" %}

*Pedagogical tip: Try to **explain** each concept out loud — to a teammate, a rubber duck, or your imaginary future self — before peeking at the answer. The "generation effect" strengthens memory more than re-reading ever will.*
