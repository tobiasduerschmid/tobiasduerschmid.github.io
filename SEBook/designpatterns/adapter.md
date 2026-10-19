---
title: Adapter Design Pattern
layout: sebook
---

# Context
In software construction, we frequently encounter situations where an existing system needs to collaborate with a third-party library, a vendor class, or legacy code. However, these external components often have interfaces that do not match the specific "Target" interface our system was designed to use.

A classic real-world analogy is the power outlet adapter. If you take a US laptop to London, the laptop’s plug (the client) expects a US power interface, but the wall outlet (the adaptee) provides a UK plug interface. To make them work together, you need an adapter that translates the interface of the wall outlet into one the laptop can plug into. In software, the Adapter pattern acts as this "middleman", allowing classes to work together that otherwise could not because of incompatible interfaces. The analogy has a limit: a plug adapter does not by itself convert voltage. Likewise, matching software method signatures is not enough; the adapted behavior must satisfy the target contract.

# Problem
The primary challenge occurs when we want to use an existing class, but its interface does not match the one we need. This typically happens for several reasons:
*   **Legacy Code:** We have code written a long time ago that we don’t want to (or can’t) change, but it must fit into a new, more modern architecture.
*   **Vendor Interfaces:** We are using a vendor class that we cannot modify, yet its method names or parameters don't align with our system's requirements.
*   **Syntactic and Semantic Mismatches:** Interfaces may use different method names or parameter shapes. They may also promise different behavior, such as distances in inches rather than meters, different error reporting, or different side effects.

An adapter localizes the translation so client code can continue to depend on its existing contract, supporting the [**Open/Closed Principle**](/SEBook/designprinciples/solid.html#openclosed-principle-ocp) for this kind of change. If the interfaces can safely be aligned directly, a refactoring may be simpler. Owning both classes does not settle the choice: existing clients, version compatibility, or different domain responsibilities may justify keeping their interfaces distinct.

# Solution
The **Adapter Pattern** solves this by creating a class that converts the interface of an "Adaptee" class into the "Target" interface that the "Client" expects.

According to the GoF catalog, there are four key roles in this structure:
1.  **Target:** The domain-specific interface the Client wants to use (e.g., a `Duck` interface with `quack()` and `fly()`). In GoF's motivating example, this is `Shape`.
2.  **Adaptee:** The existing class with an incompatible interface that needs adapting (e.g., a `WildTurkey` class that `gobble()`s instead of `quack()`s). In GoF, this is `TextView`.
3.  **Adapter:** The class that adapts the interface of Adaptee to the Target interface (e.g., `TurkeyAdapter`). In GoF, this is `TextShape`.
4.  **Client:** The class that collaborates with objects conforming to the Target interface, remaining oblivious to the fact that it is communicating with an Adaptee through the Adapter.

In the "Turkey that wants to be a Duck" example, we create a `TurkeyAdapter` that implements the `Duck` interface. When the client calls `quack()` on the adapter, the adapter internally calls `gobble()` on the wrapped turkey object. For the teaching example, a duck-style `fly()` request is mapped to five calls to the turkey's short-distance `fly()`. This is a behavioral mapping chosen for the example, not proof that five short flights satisfy every possible duck-flight contract. If a client required one continuous flight, this adapter would be unsuitable even though its methods have the right names.

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
callout top of text "Client" : Client: knows only the Target interface
callout top of text "Target" : Target: the interface the client expects
callout bottom of text "Adapter" : Adapter: implements Target by translating each call
callout bottom of text "Adaptee" : Adaptee: existing class with an incompatible interface
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
callout top of text "DuckSimulator" : Client: works only with ducks
callout top of text "Duck" : Target: the interface the simulator expects
callout bottom of text "TurkeyAdapter" : Adapter: makes a turkey look like a duck
callout bottom of text "WildTurkey" : Adaptee: existing class that stays unchanged
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
callout right of text "quack()" : The client calls the Target method it knows
callout right of text "gobble()" : Translation: the adapter calls the adaptee method under its own name
callout right of text "LOOP" : Adapting behavior, not just names: one fly() becomes five short flights
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
*   **Loose Coupling:** It decouples the client from the legacy or vendor code. The client only knows the Target interface, allowing many Adaptee changes to be absorbed inside the adapter while the Target contract remains stable. An incompatible behavioral change may still require changing the adapter or reconsidering the contract.
*   **Information Hiding:** It follows the [Information Hiding](/SEBook/designprinciples/informationhiding.html) principle by concealing the "secret" that the system is using a legacy component.
*   **Flexibility vs. Complexity:** While adapters make a system more flexible, they add a layer of indirection that can make it harder to trace the execution flow of the program since the client doesn't know which object is actually receiving the call.

# Design Decisions

## Object Adapter vs. Class Adapter
* **Object Adapter** (via composition): The adapter wraps an instance of the Adaptee. This is the standard approach in Java and most modern languages. It can wrap Adaptee subclasses that preserve the expected contract, and the wrapped object can be selected at runtime. Replacing it later requires an API that permits replacement; the example intentionally keeps its reference fixed.
* **Class Adapter** (via inheritance): The adapter inherits from *both* the Target and the Adaptee simultaneously. This requires either multiple class inheritance (e.g., C++) or — in single-inheritance languages — the Target to be an interface, so the adapter can `extend Adaptee` and `implements Target`. It avoids a separate wrapped object and permits overriding inherited Adaptee behavior, but ties the adapter to that inherited implementation. It cannot wrap arbitrary existing instances of the Adaptee or its subclasses.

**Object Adapters** are often a useful default because they separate the adapter from the adapted instance and do not require inheriting the Adaptee implementation. A class adapter may still be appropriate when overriding that implementation is essential and inheritance is available.

## Adaptation Scope
Not all adapters are created equal. The complexity of adaptation ranges widely:
* **Simple rename:** A target operation forwards to an equivalent adaptee operation with a different name. This is simple only when their behavior already agrees; `quack()` and `gobble()` are interchangeable here because of the deliberately loose teaching contract.
* **Data transformation:** Converting units, reformatting data structures, or translating between protocols. Moderate complexity.
* **Behavioral adaptation:** The adapter adds behavior needed to implement the Target contract. GoF explicitly includes a spectrum from renaming operations to supporting a different set of operations; additional logic is not by itself a violation of Adapter.

Judge the adapter by its responsibility and contract, not its line count. Unit conversion, error translation, or combining several adaptee calls may belong in adaptation. Unrelated business policy should have a separate owner. Test that the adapter preserves the behavior clients rely on, including failure cases.

Kerievsky's *Separate Versions with Adapters* refactoring starts with a class full of version-specific fields and conditionals. Extract one adapter per supported version behind a common interface, checking behavior after each step. The benefit is localized version differences, not a requirement to rename methods or to wait until vendor code becomes unmodifiable (Kerievsky's 2001 *Refactoring to Patterns* draft, pp. 75–82).

# Adapter Is a Family

GoF describes several adaptation choices under its Adapter entry. These are not four mutually exclusive categories: object vs. class adaptation concerns implementation, two-way adaptation concerns which interfaces an object supports, and pluggable adaptation concerns how the mapping is supplied.
1. **Object Adapter:** Wraps an adaptee via composition; adaptation is encapsulated through forwarding via an additional level of indirection (the standard form, favored from a layered/encapsulated perspective).
2. **Class Adapter:** Realized by subclassing both the adapter interface (Target) and the adaptee implementation to yield a single object — avoiding an additional level of indirection. Requires multiple inheritance, or — in single-inheritance languages — the Target being an interface.
3. **Two-Way Adapter:** Conforms to both the target and adaptee interfaces (typically via multiple inheritance), so the adapter is usable wherever either interface is expected. GoF's example is `ConstraintStateVariable`, a subclass of both Unidraw's `StateVariable` and QOCA's `ConstraintVariable`, that adapts each interface to the other so the same object works in either system.
4. **Pluggable Adapter:** A class with built-in interface adaptation. GoF describes three implementations: using abstract operations, using delegate objects, or using parameterized adapters (e.g., Smalltalk's `PluggableAdaptor`, which is parameterized with blocks).

The first two forms (Object Adapter, Class Adapter) are described together inside GoF's Adapter entry, while Two-Way and Pluggable Adapter are discussed among its consequences and implementation choices. When selecting an adapter, decide which of these properties the client needs rather than choosing a variant by name alone.

# Adapter vs. Facade vs. Decorator

These patterns can have similar wrapper structures, but their intents differ. Object count is not a reliable discriminator:

| Pattern | Intent | What the client expects |
|---------|--------|-------------------------|
| **Adapter** | *Convert* an interface to match an expected contract | The existing Target interface; adaptation may use one or several objects |
| **[Façade](/SEBook/designpatterns/facade.html)** | *Simplify* use of a subsystem | A convenient higher-level interface for common tasks |
| **Decorator** | *Add responsibilities* while retaining the component interface | The same component abstraction, with additional behavior |

The key discriminator: Adapter changes *what* the interface looks like. Facade changes *how much* of the interface you see. Decorator changes *what the object does* through the same interface.

## Flashcards

This shared review covers Adapter, Composite, and Facade. Use it after studying all three chapters.

{% include flashcards.html id="design_pattern_structural" %}

## Quiz

{% include quiz.html id="design_pattern_structural" %}
