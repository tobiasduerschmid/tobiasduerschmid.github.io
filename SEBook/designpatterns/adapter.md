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

Without an adapter, we would be forced to rewrite our existing system code to accommodate every new vendor or legacy class, which violates the [**Open/Closed Principle**](/SEBook/designprinciples/solid.html#openclosed-principle-ocp) and creates tight coupling.

# Solution
The **Adapter Pattern** solves this by creating a class that converts the interface of an "Adaptee" class into the "Target" interface that the "Client" expects. 

According to the GoF catalog, there are four key roles in this structure:
1.  **Target:** The domain-specific interface the Client wants to use (e.g., a `Duck` interface with `quack()` and `fly()`). In GoF's motivating example, this is `Shape`.
2.  **Adaptee:** The existing class with an incompatible interface that needs adapting (e.g., a `WildTurkey` class that `gobble()`s instead of `quack()`s). In GoF, this is `TextView`.
3.  **Adapter:** The class that adapts the interface of Adaptee to the Target interface (e.g., `TurkeyAdapter`). In GoF, this is `TextShape`.
4.  **Client:** The class that collaborates with objects conforming to the Target interface, remaining oblivious to the fact that it is communicating with an Adaptee through the Adapter.

In the "Turkey that wants to be a Duck" example, we create a `TurkeyAdapter` that implements the `Duck` interface. When the client calls `quack()` on the adapter, the adapter internally calls `gobble()` on the wrapped turkey object. Because turkeys can only fly short distances, the adapter calls the turkey's `fly()` method five times to compensate when a duck-style `fly()` is requested. This syntactic translation effectively hides the underlying implementation from the client.

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
	+ fly(): void
}
class TurkeyAdapter {
	- turkey: Turkey
	+ quack(): void
	+ fly(): void
}
class WildTurkey {
	+ gobble(): void
	+ fly(): void
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
activate turkey
deactivate turkey
deactivate adapter
simulator -> adapter: fly()
activate adapter
loop 5 short bursts
adapter -> turkey: fly()
activate turkey
deactivate turkey
end
deactivate adapter
@enduml'></div>

# Code Example

This example adapts a `Turkey` so client code that expects a `Duck` can keep using the same target interface.

> **Teaching example:** These snippets are intentionally small. They show one reasonable mapping of the pattern roles, not a drop-in architecture. In production, always tailor the pattern to the concrete context: lifecycle, ownership, error handling, concurrency, dependency injection, language idioms, and team conventions.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Adapter code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
interface Duck {
    void quack();
    void fly();
}

interface Turkey {
    void gobble();
    void fly();
}

final class WildTurkey implements Turkey {
    public void gobble() {
        System.out.println("Gobble gobble");
    }

    public void fly() {
        System.out.println("I'm flying a short distance");
    }
}

final class TurkeyAdapter implements Duck {
    private final Turkey turkey;

    TurkeyAdapter(Turkey turkey) {
        this.turkey = turkey;
    }

    public void quack() {
        turkey.gobble();
    }

    public void fly() {
        for (int i = 0; i < 5; i++) {
            turkey.fly();
        }
    }
}

public class Demo {
    static void testDuck(Duck duck) {
        duck.quack();
        duck.fly();
    }

    public static void main(String[] args) {
        testDuck(new TurkeyAdapter(new WildTurkey()));
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <iostream>

struct Duck {
    virtual ~Duck() = default;
    virtual void quack() = 0;
    virtual void fly() = 0;
};

struct Turkey {
    virtual ~Turkey() = default;
    virtual void gobble() = 0;
    virtual void fly() = 0;
};

class WildTurkey : public Turkey {
public:
    void gobble() override {
        std::cout << "Gobble gobble\n";
    }

    void fly() override {
        std::cout << "I'm flying a short distance\n";
    }
};

class TurkeyAdapter : public Duck {
public:
    explicit TurkeyAdapter(Turkey& turkey) : turkey_(turkey) {}

    void quack() override {
        turkey_.gobble();
    }

    void fly() override {
        for (int i = 0; i < 5; ++i) {
            turkey_.fly();
        }
    }

private:
    Turkey& turkey_;
};

void testDuck(Duck& duck) {
    duck.quack();
    duck.fly();
}

int main() {
    WildTurkey turkey;
    TurkeyAdapter adapter(turkey);
    testDuck(adapter);
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
from abc import ABC, abstractmethod


class Duck(ABC):
    @abstractmethod
    def quack(self) -> None:
        pass

    @abstractmethod
    def fly(self) -> None:
        pass


class Turkey(ABC):
    @abstractmethod
    def gobble(self) -> None:
        pass

    @abstractmethod
    def fly(self) -> None:
        pass


class WildTurkey(Turkey):
    def gobble(self) -> None:
        print("Gobble gobble")

    def fly(self) -> None:
        print("I'm flying a short distance")


class TurkeyAdapter(Duck):
    def __init__(self, turkey: Turkey) -> None:
        self._turkey = turkey

    def quack(self) -> None:
        self._turkey.gobble()

    def fly(self) -> None:
        for _ in range(5):
            self._turkey.fly()


def test_duck(duck: Duck) -> None:
    duck.quack()
    duck.fly()


test_duck(TurkeyAdapter(WildTurkey()))
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
interface Duck {
  quack(): void;
  fly(): void;
}

interface Turkey {
  gobble(): void;
  fly(): void;
}

class WildTurkey implements Turkey {
  gobble(): void {
    console.log("Gobble gobble");
  }

  fly(): void {
    console.log("I'm flying a short distance");
  }
}

class TurkeyAdapter implements Duck {
  constructor(private readonly turkey: Turkey) {}

  quack(): void {
    this.turkey.gobble();
  }

  fly(): void {
    for (let i = 0; i < 5; i += 1) {
      this.turkey.fly();
    }
  }
}

function testDuck(duck: Duck): void {
  duck.quack();
  duck.fly();
}

testDuck(new TurkeyAdapter(new WildTurkey()));
```
  </div>
</div>

# Consequences
Applying the Adapter pattern results in several significant architectural trade-offs:
*   **Loose Coupling:** It decouples the client from the legacy or vendor code. The client only knows the Target interface, allowing the Adaptee to evolve independently without breaking the client code.
*   **Information Hiding:** It follows the [Information Hiding](/SEBook/designprinciples/informationhiding.html) principle by concealing the "secret" that the system is using a legacy component.
*   **Flexibility vs. Complexity:** While adapters make a system more flexible, they add a layer of indirection that can make it harder to trace the execution flow of the program since the client doesn't know which object is actually receiving the call.

# Design Decisions

## Object Adapter vs. Class Adapter
* **Object Adapter** (via composition): The adapter wraps an instance of the Adaptee. This is the standard approach in Java and most modern languages. It can adapt an entire class hierarchy (any subclass of the Adaptee works), and the adaptation can be configured at runtime.
* **Class Adapter** (via inheritance): The adapter inherits from *both* the Target and the Adaptee simultaneously. This requires either multiple class inheritance (e.g., C++) or — in single-inheritance languages — the Target to be an interface, so the adapter can `extend Adaptee` and `implements Target`. It avoids the indirection overhead of delegation but ties the adapter to a single concrete Adaptee class.

Modern practice favors **Object Adapters** because they compose with any subclass of the Adaptee, can be reconfigured at runtime, and don't require either party to be open for inheritance (see also Effective Java Item 18: *Favor composition over inheritance*).

## Adaptation Scope
Not all adapters are created equal. The complexity of adaptation ranges widely:
* **Simple rename:** `quack()` maps directly to `gobble()`. Trivial and low-risk.
* **Data transformation:** Converting units, reformatting data structures, or translating between protocols. Moderate complexity.
* **Behavioral adaptation:** The adaptee's behavior is fundamentally different and the adapter must add logic to bridge the semantic gap. High complexity—and a warning sign that the adapter may be growing into a service.

If an adapter becomes "too thick" (containing significant business logic), it is no longer just translating an interface—it has become a separate component that happens to look like an adapter.

# Adapter is a Family, Not a Single Pattern

Buschmann, Henney, and Schmidt observe in *Pattern-Oriented Software Architecture, Volume 5: On Patterns and Pattern Languages* (2007, p. 234) that "the notion that there is a single pattern called Adapter is in practice present nowhere except in the table of contents of the Gang-of-Four book." A deconstruction of GoF's pattern description reveals at least four quite distinct patterns:
1. **Object Adapter:** Wraps an adaptee via composition; adaptation is encapsulated through forwarding via an additional level of indirection (the standard form, favored from a layered/encapsulated perspective).
2. **Class Adapter:** Realized by subclassing both the adapter interface (Target) and the adaptee implementation to yield a single object — avoiding an additional level of indirection. Requires multiple inheritance, or — in single-inheritance languages — the Target being an interface.
3. **Two-Way Adapter:** Conforms to both the target and adaptee interfaces (typically via multiple inheritance), so the adapter is usable wherever either interface is expected. GoF's example is `ConstraintStateVariable`, a subclass of both Unidraw's `StateVariable` and QOCA's `ConstraintVariable`, that adapts each interface to the other so the same object works in either system.
4. **Pluggable Adapter:** A class with built-in interface adaptation. GoF describes three implementations: using abstract operations, using delegate objects, or using parameterized adapters (e.g., Smalltalk's `PluggableAdaptor`, which is parameterized with blocks).

The first two forms (Object Adapter, Class Adapter) are described together inside GoF's Adapter entry, while Two-Way and Pluggable Adapter are surfaced in GoF's Implementation discussion. This insight is educationally important: when a reference says "use the Adapter pattern", you must clarify *which* form of adaptation is needed.

# Adapter vs. Facade vs. Decorator

These three patterns all "wrap" another object, but with different intents:

| Pattern | Intent | Scope |
|---------|--------|-------|
| **Adapter** | *Convert* one interface to match another | One-to-one: translates a single incompatible interface |
| **[Façade](/SEBook/designpatterns/facade.html)** | *Simplify* a complex set of interfaces | Many-to-one: wraps an entire subsystem behind one interface |
| **Decorator** | *Add behavior* to an object without changing its interface | One-to-one: wraps a single object, preserving its interface |

The key discriminator: Adapter changes *what* the interface looks like. Facade changes *how much* of the interface you see. Decorator changes *what the object does* through the same interface.

## Flashcards

{% include flashcards.html id="design_pattern_structural" %}

## Quiz

{% include quiz.html id="design_pattern_structural" %}
