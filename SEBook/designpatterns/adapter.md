---
title: Adapter Design Pattern
layout: sebook
---

# Context
In software construction, we frequently encounter situations where an existing system needs to collaborate with a third-party library, a vendor class, or legacy code. However, these external components often have interfaces that do not match the specific "Target" interface our system was designed to use.

A classic real-world analogy is the power outlet adapter. If you take a US laptop to London, the laptop’s plug (the client) expects a US power interface, but the wall outlet (the adaptee) provides a European interface. To make them work together, you need an adapter that translates the interface of the wall outlet into one the laptop can plug into. In software, the Adapter pattern acts as this "middleman", allowing classes to work together that otherwise couldn't due to incompatible interfaces.

# Problem
The primary challenge occurs when we want to use an existing class, but its interface does not match the one we need. This typically happens for several reasons:
*   **Legacy Code:** We have code written a long time ago that we don’t want to (or can’t) change, but it must fit into a new, more modern architecture.
*   **Vendor Lock-in:** We are using a vendor class that we cannot modify, yet its method names or parameters don't align with our system's requirements.
*   **Syntactic and Semantic Mismatches:** Two interfaces might differ in syntax (e.g., `getDistance()` in inches vs. `getLength()` in meters) or semantics (e.g., a method that performs a similar action but with different side effects).

Without an adapter, we would be forced to rewrite our existing system code to accommodate every new vendor or legacy class, which violates the **Open/Closed Principle** and creates tight coupling.

# Solution
The **Adapter Pattern** solves this by creating a class that converts the interface of an "Adaptee" class into the "Target" interface that the "Client" expects. 

According to the **course material**, there are four key roles in this structure:
1.  **Target:** The interface the Client wants to use (e.g., a `Duck` interface with `quack()` and `fly()`).
2.  **Adaptee:** The existing class with the incompatible interface that needs adapting (e.g., a `WildTurkey` class that `gobble()`s instead of `quack()`s).
3.  **Adapter:** The class that realizes the Target interface while holding a reference to an instance of the Adaptee. 
4.  **Client:** The class that interacts only with the Target interface, remaining completely oblivious to the fact that it is actually communicating with an Adaptee through the Adapter.

In the "Turkey that wants to be a Duck" example, we create a `TurkeyAdapter` that implements the `Duck` interface. When the client calls `quack()` on the adapter, the adapter internally calls `gobble()` on the wrapped turkey object. This syntactic translation effectively hides the underlying implementation from the client.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
class Client
interface Target {
	+ request(): void
}
class Adapter {
	- adaptee: Adaptee
	+ request(): void
}
class Adaptee {
	+ specificRequest(): void
}
Client --> Target : uses >
Adapter ..|> Target
Adapter --> Adaptee : translates to
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
class DuckSimulator
interface Duck {
	+ quack(): void
	+ fly(): void
}
interface Turkey {
	+ gobble(): void
	+ flyShort(): void
}
class TurkeyAdapter {
	- turkey: Turkey
	+ quack(): void
	+ fly(): void
}
class WildTurkey {
	+ gobble(): void
	+ flyShort(): void
}
DuckSimulator --> Duck : expects >
TurkeyAdapter ..|> Duck
WildTurkey ..|> Turkey
TurkeyAdapter --> Turkey : wraps
@enduml'></div>

## Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant simulator: DuckSimulator
participant adapter: TurkeyAdapter
participant turkey: WildTurkey
simulator -> adapter: quack()
activate adapter
adapter -> turkey: gobble()
deactivate adapter
simulator -> adapter: fly()
activate adapter
loop 5 short bursts
adapter -> turkey: flyShort()
end
deactivate adapter
@enduml'></div>

# Consequences
Applying the Adapter pattern results in several significant architectural trade-offs:
*   **Loose Coupling:** It decouples the client from the legacy or vendor code. The client only knows the Target interface, allowing the Adaptee to evolve independently without breaking the client code.
*   **Information Hiding:** It follows the Information Hiding principle by concealing the "secret" that the system is using a legacy component.
*   **Flexibility vs. Complexity:** While adapters make a system more flexible, they add a layer of indirection that can make it harder to trace the execution flow of the program since the client doesn't know which object is actually receiving the signal.

# Design Decisions

## Object Adapter vs. Class Adapter
* **Object Adapter** (via composition): The adapter wraps an instance of the Adaptee. This is the standard approach in Java and most modern languages. It can adapt an entire class hierarchy (any subclass of the Adaptee works), and the adaptation can be configured at runtime.
* **Class Adapter** (via multiple inheritance): The adapter inherits from *both* the Target and the Adaptee simultaneously. This is only possible in languages that support multiple inheritance (e.g., C++). It avoids the indirection overhead of delegation but ties the adapter to a single concrete Adaptee class.

Modern consensus strongly favors **Object Adapters** for their flexibility and compatibility with single-inheritance languages.

## Adaptation Scope
Not all adapters are created equal. The complexity of adaptation ranges widely:
* **Simple rename:** `quack()` maps directly to `gobble()`. Trivial and low-risk.
* **Data transformation:** Converting units, reformatting data structures, or translating between protocols. Moderate complexity.
* **Behavioral adaptation:** The adaptee's behavior is fundamentally different and the adapter must add logic to bridge the semantic gap. High complexity—and a warning sign that the adapter may be growing into a service.

If an adapter becomes "too thick" (containing significant business logic), it is no longer just translating an interface—it has become a separate component that happens to look like an adapter.

# Adapter is a Family, Not a Single Pattern

Buschmann et al. (POSA5) argue that "the notion that there is a single pattern called ADAPTER is in practice present nowhere except in the table of contents of the Gang-of-Four book." In practice, there are at least four distinct adaptation patterns:
1. **Object Adapter:** Wraps an adaptee via composition (the standard form).
2. **Class Adapter:** Inherits from both target and adaptee (multiple inheritance).
3. **Two-Way Adapter:** Implements both the target and adaptee interfaces, allowing communication in both directions.
4. **Pluggable Adapter:** Uses interfaces or abstract classes to make the adapter configurable, so it can adapt different adaptees without creating new adapter classes.

This insight is educationally important: when a reference says "use the Adapter pattern," you must clarify *which* form of adaptation is needed.

# Adapter vs. Facade vs. Decorator

These three patterns all "wrap" another object, but with different intents:

| Pattern | Intent | Scope |
|---------|--------|-------|
| **Adapter** | *Convert* one interface to match another | One-to-one: translates a single incompatible interface |
| **[Façade](/SEBook/designpatterns/facade.html)** | *Simplify* a complex set of interfaces | Many-to-one: wraps an entire subsystem behind one interface |
| **Decorator** | *Add behavior* to an object without changing its interface | One-to-one: wraps a single object, preserving its interface |

The key discriminator: Adapter changes *what* the interface looks like. Facade changes *how much* of the interface you see. Decorator changes *what the object does* through the same interface.

# Flashcards

{% include flashcards.html id="design_pattern_structural" %}

# Quiz

{% include quiz.html id="design_pattern_structural" %}
