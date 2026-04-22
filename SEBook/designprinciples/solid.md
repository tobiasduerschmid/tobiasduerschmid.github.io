---
title: SOLID
layout: sebook
---

> **Want hands-on practice?** Jump into the [Interactive SOLID Tutorial](/SEBook/tools/solid-tutorial.html) — feel the pain of rigid code first, then refactor step by step with auto-graded exercises, live UML diagrams, and quizzes for every principle.

# Problem

Software is never finished. Requirements shift. Teams grow. What was "one small change" last month becomes a three-day yak-shaving exercise next month because a helper method is wired into four different features. Every developer eventually inherits a class that does too much and trembles when touched.

The core problem is: **How do we structure object-oriented code so that change is localized, safe, and cheap — instead of tangling every new feature into every old one?**

SOLID is a set of five design principles that answer this question. Each principle targets a different kind of tangle. Together, they define what Robert C. Martin calls a *well-designed* object-oriented system: one where behavior can be extended without rewriting, dependencies point from detail to policy, and subtypes can be trusted to honor their contracts.

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

> *A module should have one, and only one, reason to change.* — Robert C. Martin

The Single Responsibility Principle is arguably the most misunderstood of the SOLID principles due to its poorly chosen name. It is **not** about a class "doing one thing" or "having only one method". Instead, SRP is fundamentally **about people**.

A more accurate definition is that **a module should be responsible to one, and only one, actor**. An actor is a specific stakeholder, user, or team (like Finance, HR, or Database Administrators) that will request modifications to the software. If a class serves multiple actors, changes requested by one might silently break functionality relied upon by another.

**Why SRP is Important:**
When a class serves multiple actors, changes requested by one actor may silently break functionality relied upon by another. If you **do not follow SRP**, your codebase becomes a minefield of tangled dependencies; a simple bug fix for the Finance team might inadvertently break the HR team's reporting module. Following SRP leads to better design by ensuring that each module is highly cohesive and immune to changes driven by unrelated business functions.

**Common Misconceptions:**
* **"A class should only have one job":** This confuses SRP with the rule that a *function* should only do one thing. A class can have multiple methods and properties as long as they all serve the same actor.
* **"You should describe a class without using 'and'":** This is a flawed rule because descriptions can be arbitrarily rephrased. SRP is about cohesive business reasons for change, not grammar.

**Examples of Violations & Fixes:**

* **The Employee Class (Actor Violation):** An `Employee` class contains `calculatePay()` (for Accounting), `reportHours()` (for HR), and `save()` (for DBAs). If Accounting tweaks the overtime algorithm, it might accidentally break the HR reports.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class Employee {
  + calculatePay()
  + reportHours()
  + save()
}
note right of Employee
  Violates SRP: Serves three different actors
  (Accounting, HR, and DBAs). Changes requested
  by one actor might unintentionally break logic
  relied upon by another.
end note
@enduml'></div>

  **Fix:** Extract a plain `EmployeeData` structure and create three separate classes (`PayCalculator`, `HourReporter`, `EmployeeSaver`) that do not know about each other, eliminating merge conflicts and accidental duplication.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class EmployeeData
class PayCalculator {
  + calculatePay()
}
class HourReporter {
  + reportHours()
}
class EmployeeSaver {
  + save()
}
PayCalculator ..> EmployeeData
HourReporter ..> EmployeeData
EmployeeSaver ..> EmployeeData
note bottom of EmployeeData
  Fix: Each class serves exactly one actor.
  A change by Accounting only touches PayCalculator;
  HR and DBA code is untouched.
end note
@enduml'></div>

* **The Report Generator:** A `Report` class that generates, prints, saves, and emails reports. Changing the email format might break the printing logic. **Fix:** Refactor into `ReportGenerator`, `ReportPrinter`, `ReportSaver`, and `EmailSender`.

**Broader Engineering Applications:**
Applying SRP strategically (only when actual axes of change emerge) maximizes **cohesion** and minimizes **coupling**. Highly cohesive classes are easier to unit test, reuse, and maintain, preventing the growth of "God Classes" and drastically reducing version control merge conflicts across teams.

## Open/Closed Principle (OCP)

> *Software entities (classes, modules, functions, etc.) should be open for extension, but closed for modification.* — Bertrand Meyer, 1988

The Open/Closed Principle dictates that as an application's requirements change, you should be able to extend the behavior of a module with new functionalities **by adding new code**, rather than altering existing, tested code.

**Why OCP is Important:**
Every time you modify existing, working code, you risk introducing regressions. If you **do not follow OCP**, adding a new feature requires surgically modifying core components, which means re-testing the entire system. By relying on abstraction and polymorphism, OCP allows you to plug in new functionality (extensions) without ever touching the existing router or core logic, making the system incredibly stable and safely extensible.

**Common Misconceptions:**
* **"Closed for modification means code can never be changed":** This restriction only applies to adding new features. If there is a bug, you must absolutely modify the code to fix it.
* **"OCP should be applied everywhere":** Anticipating every conceivable future change leads to "Abstraction Hell." Conforming to OCP is expensive. It should be applied strategically where change is actually anticipated.

**Examples of Violations & Fixes:**

* **The Payment Processor Problem:**
  A `PaymentProcessor` class uses complex `switch` or `if/else` statements to handle different payment types. Adding PayPal requires modifying the existing method.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class PaymentProcessor {
  + processPayment(type: String, amount: Double)
}
note right of PaymentProcessor
  Violates OCP: Adding a new payment type
  requires modifying this method to add a new if/else branch,
  risking bugs in existing payment logic.
end note
@enduml'></div>

  **Fix:** Program against an interface using the Strategy Pattern. Create a `PaymentMethod` interface and separate `CreditCardPayment` and `PayPalPayment` classes.

* **Drawing Shapes Problem:**
  A `drawAllShapes()` method evaluates a `ShapeType` enum to draw. Adding a `Triangle` forces modification of the loop.
  **Fix:** Give the `Shape` interface a `draw()` method, relying on polymorphism so the caller never changes.

**Broader Engineering Applications:**
Abstraction is the key to OCP. By relying on interfaces, higher-level architectural components (like core business rules) are protected from changes in lower-level components (like UI or database plugins). This dramatically reduces the risk of regressions and allows for independent deployability of new features.

## Liskov Substitution Principle (LSP)

> *Let $\Phi(x)$ be a property provable about objects $x$ of type $T$. Then $\Phi(y)$ should be true for objects $y$ of type $S$ where $S$ is a subtype of $T$.* — Barbara Liskov, 1987

LSP goes beyond standard object-oriented structural subtyping (matching method signatures) to demand **behavioral substitutability**. An object of a superclass should be completely replaceable by an object of its subclass without causing unexpected behaviors or breaking the program. A subclass must honor the contract established by its parent.

**Why LSP is Important:**
LSP is the foundation for safe polymorphism. It empowers the Open/Closed Principle (OCP) by ensuring new subclasses can be plugged in seamlessly. If you **do not follow LSP**, clients are forced to perform defensive type-checking (`if (obj instanceof Square)`) to avoid crashes or unexpected behaviors. Violating LSP pollutes the architecture with legacy bugs and destroys the trustworthiness of abstractions.

To guarantee behavioral substitutability, subclasses must follow strict Design-by-Contract rules:
1. **Preconditions cannot be strengthened:** A subclass method must accept the same or a wider range of valid inputs as the parent.
2. **Postconditions cannot be weakened:** A subclass method must guarantee the same or a stricter range of outputs as the parent.
3. **Invariants must be preserved:** Core properties of the parent state must remain true.

**Common Misconceptions:**
* **Treating "Is-A" as Direct Inheritance:** In the real world, a square "is a" rectangle, and an ostrich "is a" bird. However, in OOP, this naive taxonomy creates incorrect hierarchies if behavioral substitutability is violated.
* **Self-Consistent Models are Valid:** A `Square` class might perfectly enforce its own mathematical rules internally, but validity cannot be judged in isolation. It must be judged from the perspective of the *client's expectations* of the parent class.

**Examples of Violations & Fixes:**
* **The Square/Rectangle Problem:** If `Square` inherits from `Rectangle`, overriding `setWidth` to automatically change `height` breaks a client's expectation that a rectangle's dimensions mutate independently. Passing a `Square` where a `Rectangle` is expected causes area calculation assertions to fail.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class Rectangle {
  + setWidth(w: int)
  + setHeight(h: int)
  + getArea() : int
}
class Square {
  + setWidth(w: int)
  + setHeight(h: int)
}
Square --|> Rectangle
note right of Square
  Violates LSP: Overriding setWidth to also
  change height breaks the client behavioral
  expectation of a Rectangle (that width and
  height mutate independently).
end note
@enduml'></div>

  **Fix:** `Square` and `Rectangle` should be siblings implementing a common `Shape` interface — neither inherits the other, so neither can break the other's contract.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface Shape {
  + getArea() : int
}
class Rectangle {
  + setWidth(w: int)
  + setHeight(h: int)
  + getArea() : int
}
class Square {
  + setSide(s: int)
  + getArea() : int
}
Rectangle ..|> Shape
Square ..|> Shape
note right of Shape
  Fix: Neither subtype inherits the other.
  Clients typed to Shape get only getArea();
  no client can set width independently and
  be surprised by a Square coupling it to height.
end note
@enduml'></div>

* **The Bird/Ostrich Problem:** `Ostrich` inherits `fly()` from `Bird` but overrides it to do nothing or throw an exception. This is a classic *Refused Bequest* code smell. **Fix:** Extract a `FlyingBird` interface rather than forcing `Ostrich` to inherit behaviors it shouldn't have. Avoid overriding non-abstract methods.

**Broader Engineering Applications:**
LSP is the foundation for safe polymorphism. It empowers the Open/Closed Principle (OCP) by ensuring new subclasses can be plugged in seamlessly without requiring clients to perform defensive type-checking (`instanceof` or long `if/else` chains). Violating LSP leads to architectural pollution and legacy bugs (like Java's `Stack` extending `Vector`, mistakenly exposing random-access array methods that break strict LIFO stack behavior).

## Interface Segregation Principle (ISP)

> *Clients should not be forced to depend on methods they do not use.* — Robert C. Martin

The Interface Segregation Principle (ISP) dictates that instead of creating large, general-purpose "fat" interfaces, developers should design small, client-specific interfaces tailored to specific roles.

**Why ISP is Important:**
When a client depends on a bloated interface, it becomes artificially coupled to all other clients of that interface. If you **do not follow ISP**, a change to an unused method forces recompilation and redeployment of completely unrelated clients (in statically typed languages). Even in dynamic languages, it introduces fragility and unwanted architectural "baggage"—if the unused component breaks or requires a heavy dependency, your module crashes or bloats unnecessarily. Following ISP leads to better design by ensuring modules are highly cohesive, lightweight, and completely isolated from changes they don't care about.

**Common Misconceptions:**
* **"Every method needs its own interface":** Taking ISP to the extreme leads to interface proliferation ($2^n-1$ interfaces for $n$ methods). ISP should group methods by cohesive client needs, not just fracture them endlessly.
* **"ISP is only for statically typed languages":** While dynamic languages don't suffer from forced recompilation, depending on unneeded modules still violates the architectural concept behind ISP (the Common Reuse Principle).

**Examples of Violations & Fixes:**

* **The File Server System:** A `FileServer` interface declares `uploadFile()`, `downloadFile()`, and `changePermissions()`. A `UserClient` only needs upload/download but is forced to depend on permissions.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface FileServer {
  + uploadFile()
  + downloadFile()
  + changePermissions()
}
class UserClient
class AdminClient
UserClient ..> FileServer : depends on
AdminClient ..> FileServer : depends on
note left of UserClient
  Violates ISP: UserClient is forced to depend
  on changePermissions(), which it never uses.
  A change to permissions forces UserClient to recompile.
end note
@enduml'></div>

  **Fix:** Split into `FileServerExchange` (upload/download) and `FileServerAdministration` (permissions). `UserClient` only depends on the former.

* **The Generic Operations (OPS) Class:** `User1`, `User2`, and `User3` all depend on a single `OPS` class with `op1()`, `op2()`, and `op3()`.
  **Fix:** Segregate the operations into `U1Ops`, `U2Ops`, and `U3Ops` interfaces. Let the `OPS` class implement all three, but let each user depend only on the specific interface they need.

## Dependency Inversion Principle (DIP)

> *High-level modules should not depend on low-level modules. Both should depend on abstractions. Abstractions should not depend on details; details should depend on abstractions.* — Robert C. Martin

DIP states that source code dependencies should rely on abstract concepts, like interfaces or abstract classes, rather than on concrete implementations. High-level modules (core business rules) should dictate the contract, and low-level modules (UI, database, I/O) should conform to it.

**Why DIP is Important:**
In traditional programming, high-level policy often directly calls low-level details (e.g., `OrderProcessor` calls `MySQLDatabase`). If you **do not follow DIP**, the high-level policy becomes strictly tethered to the infrastructure. A change in the database library or UI framework triggers cascading rewrites in your core business logic, making the system rigid, fragile, and impossible to unit test. By **inverting the dependency**, you decouple the core logic. This leads to better design because business rules become infinitely reusable, independently deployable, and trivially testable (by swapping the real database for a mock).

**Common Misconceptions:**
* **"DIP is the same as Dependency Injection (DI)":** DIP is a broad architectural strategy. DI is simply a code-level tactic (like passing dependencies via a constructor) to achieve inversion. Using a DI framework like Spring does not guarantee you are following DIP.
* **"Interfaces dictated by low-level code":** Creating an interface that exactly mirrors a specific database library does not achieve inversion. **Interface Ownership** is key: the high-level client must declare and own the interface tailored to its specific needs.
* **"Every class needs an interface":** Dogmatically creating an interface for every single class leads to "abstraction hell" and needless complexity.

**Examples of Violations & Fixes:**

* **The Button and Lamp Scenario:** A smart home `Button` directly turns a `Lamp` on or off.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class Button {
  + detectPress()
}
class Lamp {
  + turnOn()
  + turnOff()
}
Button --> Lamp : depends on
note right of Button
  Violates DIP: High-level policy (Button)
  depends directly on low-level detail (Lamp).
  Button cannot be reused to turn on a Motor.
end note
@enduml'></div>

  **Fix:** Introduce a `Switchable` interface owned by the high-level module. `Button` depends on the abstraction; `Lamp` conforms to it — the dependency arrow now points away from the detail.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface Switchable {
  + activate()
  + deactivate()
}
class Button {
  + detectPress()
}
class Lamp {
  + activate()
  + deactivate()
}
Button --> Switchable : depends on
Switchable <|.. Lamp
note right of Switchable
  Fix: dependency arrow inverted.
  Button now works with any Switchable device
  (Lamp, Fan, Motor) without modification.
end note
@enduml'></div>

* **The Calculator and Console Output:** A `Calculator` class uses a hard-wired `System.out.println` to print results.
  **Fix:** Create a `Printer` interface. Pass a `ConsolePrinter` dependency into the `Calculator` constructor (Dependency Injection). During unit tests, pass a mock printer.

# How the Principles Reinforce Each Other

SOLID is not five independent rules — the principles interact. The diagram below shows how mastering one unlocks others: arrows point from the enabler to the payoff.

<div class="uml-class-diagram-container" data-uml-type="component" data-uml-spec='@startuml
component SRP
component OCP
component LSP
component ISP
component DIP
LSP --> OCP : enables polymorphism
DIP --> OCP : enables pluggable impls
ISP --> LSP : shrinks surface
SRP --> OCP : narrows change
note bottom of OCP
  OCP is the common
  payoff: extend without
  modifying existing code.
end note
@enduml'></div>

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

# Practice

Test your understanding below. The quiz emphasizes *applying* and *evaluating* SOLID in realistic scenarios — most questions will feel harder than pure recall, and that effortful retrieval is exactly what builds durable judgment.

## Knowledge Quiz

{% include quiz.html id="design_principle_solid" %}

## Retrieval Flashcards

{% include flashcards.html id="design_principle_solid" %}

*Pedagogical tip: Before flipping a card, try to name the principle's core idea, its most common misconception, and one concrete example from memory. That generation effect outperforms passive rereading every time.*
