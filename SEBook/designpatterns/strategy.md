---
title: Strategy Design Pattern
layout: sebook
---

# Problem

Many classes differ only in *how* they perform a particular task. A duck simulator needs many duck types that all swim and display, but each one *flies* and *quacks* differently. A text composer needs to break paragraphs into lines, but the linebreaking algorithm should be selectable: a fast greedy pass for an interactive editor, the TeX algorithm for high-quality typesetting, or a fixed-width strategy for icon grids. A payment system needs credit card, PayPal, and bank-transfer flows that all share the same checkout pipeline.

If you push every variant into a single class with conditional logic, the class quickly becomes unmaintainable:

```java
class Duck {
    void fly(String type) {
        if (type.equals("mallard")) {
            // flap wings
        } else if (type.equals("rubber")) {
            // do nothing
        } else if (type.equals("decoy")) {
            // do nothing
        } else if (type.equals("rocket")) {
            // launch rockets
        }
        // every new duck adds another branch
    }
}
```

If you push every variant into its own subclass, you end up with deep inheritance hierarchies that fight reality: a `RubberDuck` inherits a `fly()` it must override to do nothing; a `DecoyDuck` inherits both `fly()` and `quack()` it must neutralize. Adding a new behavior axis (e.g., "swim with rockets") combinatorially explodes the class hierarchy.

The core problem is: **How can we vary an algorithm independently of the objects that use it, swap algorithms at runtime, and add new algorithms without touching existing client code?**

# Context

The Strategy pattern (also known as the **Policy** pattern {% cite Gamma1995 %}) applies when:

* **Many related classes differ only in their behavior.** Strategies provide a way to configure a class with one of many behaviors, instead of creating a subclass for each behavior {% cite Gamma1995 %}.
* **You need different variants of an algorithm.** For example, algorithms that reflect different space/time trade-offs, or algorithms tuned for different data shapes.
* **An algorithm uses data that clients shouldn't know about.** Hiding algorithm-specific data structures behind a Strategy interface keeps clients decoupled from implementation details.
* **A class defines many behaviors that appear as multiple conditional statements.** Move the conditional branches into their own Strategy classes so each branch becomes a polymorphic object {% cite FreemanRobson2020 %}.

Common applications include sorting and searching algorithms, validation rules, compression formats, payment processing flows, AI agents in games, layout/linebreaking strategies in text editors, and authentication schemes.

# Solution

The **Strategy pattern** defines a family of algorithms, encapsulates each one as an object, and makes them interchangeable at runtime. The client (the *Context*) holds a reference to a *Strategy* interface and delegates the variable behavior to it.

The pattern involves three roles:

1. **Strategy:** An interface (or abstract class) declaring the operation common to all supported algorithms. The Context uses this interface to invoke the algorithm.
2. **ConcreteStrategy:** A class that implements the Strategy interface with one specific algorithm.
3. **Context:** The class that uses the algorithm. It holds a reference to a Strategy object and forwards work to it. The Context typically exposes a setter so the strategy can be swapped at runtime.

The key insight is **composition over inheritance**: instead of locking each variant into a subclass, the Context *has-a* Strategy and can be re-configured at any time. This is the same insight that makes the [Observer](/SEBook/designpatterns/observer.html) and [State](/SEBook/designpatterns/state.html) patterns work — replace static class hierarchies with dynamic object delegation.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
class Context {
	- strategy: Strategy
	+ setStrategy(strategy: Strategy): void
	+ contextInterface(): void
}
interface Strategy {
	+ algorithmInterface(): void
}
class ConcreteStrategyA {
	+ algorithmInterface(): void
}
class ConcreteStrategyB {
	+ algorithmInterface(): void
}
class ConcreteStrategyC {
	+ algorithmInterface(): void
}
Context o--> Strategy : strategy
ConcreteStrategyA ..|> Strategy
ConcreteStrategyB ..|> Strategy
ConcreteStrategyC ..|> Strategy
note right of Context.contextInterface
	```java
	strategy.algorithmInterface();
	```
end note
@enduml'></div>

**Figure:** the Context aggregates a Strategy and forwards work to it; ConcreteStrategies realize the interface independently. The Context never knows which concrete strategy it holds.

## UML Example Diagram

The classic SimUDuck example {% cite FreemanRobson2020 %} extracts the *fly* and *quack* behaviors out of the `Duck` hierarchy. Each duck *has-a* `FlyBehavior` and a `QuackBehavior`; the concrete strategy classes implement each variation. A `MallardDuck` flies with wings and quacks normally; a `RubberDuck` cannot fly (uses a null-object fly behavior) and squeaks instead.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
abstract class Duck {
	- flyBehavior: FlyBehavior
	- quackBehavior: QuackBehavior
	+ performFly(): void
	+ performQuack(): void
	+ setFlyBehavior(fb: FlyBehavior): void
	+ {abstract} display(): void
}
class MallardDuck
class RubberDuck
interface FlyBehavior {
	+ fly(): void
}
class FlyWithWings
class FlyNullObject
interface QuackBehavior {
	+ quack(): void
}
class Quack
class Squeak
MallardDuck --|> Duck
RubberDuck --|> Duck
Duck o--> FlyBehavior : flyBehavior
Duck o--> QuackBehavior : quackBehavior
FlyWithWings ..|> FlyBehavior
FlyNullObject ..|> FlyBehavior
Quack ..|> QuackBehavior
Squeak ..|> QuackBehavior
note bottom of FlyNullObject
	Null Object Strategy:
	do nothing on fly().
end note
@enduml'></div>

**Figure:** Duck delegates flying and quacking to interchangeable Strategy objects; `RubberDuck` swaps in `FlyNullObject` instead of subclassing to override.

## Sequence Diagram

This sequence shows runtime reconfiguration: a `ModelDuck` starts with a no-op fly behavior, the client swaps in a rocket-powered strategy via `setFlyBehavior`, and the next `performFly()` call now does something completely different — without changing the Duck class.

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant client: Client
participant duck: ModelDuck
participant nullFly: FlyNullObject
participant rocket: FlyRocketPowered
client -> duck: performFly()
activate duck
duck -> nullFly: fly()
activate nullFly
nullFly --> duck
deactivate nullFly
deactivate duck
client -> duck: setFlyBehavior(rocket)
activate duck
deactivate duck
client -> duck: performFly()
activate duck
duck -> rocket: fly()
activate rocket
rocket --> duck
deactivate rocket
deactivate duck
@enduml'></div>

**Figure:** the same Duck object exhibits two different fly behaviors across two `performFly()` calls — runtime swapping is the central capability Strategy enables.

# Code Example

This example follows the SimUDuck design from Head First Design Patterns {% cite FreemanRobson2020 %}. The `Duck` class delegates to two strategy objects; concrete duck subclasses configure their strategies in the constructor; the client can swap a strategy at runtime by calling `setFlyBehavior()`.

> **Teaching example:** These snippets are intentionally small. They show one reasonable mapping of the pattern roles, not a drop-in architecture. In production, always tailor the pattern to the concrete context: lifecycle, ownership, error handling, concurrency, dependency injection, language idioms, and team conventions.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Strategy code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
interface FlyBehavior {
    void fly();
}

interface QuackBehavior {
    void quack();
}

final class FlyWithWings implements FlyBehavior {
    public void fly() {
        System.out.println("Flapping wings");
    }
}

final class FlyNullObject implements FlyBehavior {
    public void fly() {
        // do nothing — can't fly
    }
}

final class FlyRocketPowered implements FlyBehavior {
    public void fly() {
        System.out.println("Flying with a rocket");
    }
}

final class Quack implements QuackBehavior {
    public void quack() {
        System.out.println("Quack!");
    }
}

abstract class Duck {
    protected FlyBehavior flyBehavior;
    protected QuackBehavior quackBehavior;

    void performFly() {
        flyBehavior.fly();
    }

    void performQuack() {
        quackBehavior.quack();
    }

    void setFlyBehavior(FlyBehavior fb) {
        this.flyBehavior = fb;
    }

    abstract void display();
}

final class ModelDuck extends Duck {
    ModelDuck() {
        flyBehavior = new FlyNullObject();
        quackBehavior = new Quack();
    }

    void display() {
        System.out.println("I'm a model duck");
    }
}

public class Demo {
    public static void main(String[] args) {
        Duck model = new ModelDuck();
        model.performFly();                          // does nothing
        model.setFlyBehavior(new FlyRocketPowered());
        model.performFly();                          // "Flying with a rocket"
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <iostream>
#include <memory>

struct FlyBehavior {
    virtual ~FlyBehavior() = default;
    virtual void fly() = 0;
};

struct QuackBehavior {
    virtual ~QuackBehavior() = default;
    virtual void quack() = 0;
};

class FlyWithWings : public FlyBehavior {
public:
    void fly() override { std::cout << "Flapping wings\n"; }
};

class FlyNullObject : public FlyBehavior {
public:
    void fly() override { /* do nothing */ }
};

class FlyRocketPowered : public FlyBehavior {
public:
    void fly() override { std::cout << "Flying with a rocket\n"; }
};

class Quack : public QuackBehavior {
public:
    void quack() override { std::cout << "Quack!\n"; }
};

class Duck {
public:
    virtual ~Duck() = default;

    void performFly() { flyBehavior_->fly(); }
    void performQuack() { quackBehavior_->quack(); }

    void setFlyBehavior(std::unique_ptr<FlyBehavior> fb) {
        flyBehavior_ = std::move(fb);
    }

    virtual void display() const = 0;

protected:
    std::unique_ptr<FlyBehavior> flyBehavior_;
    std::unique_ptr<QuackBehavior> quackBehavior_;
};

class ModelDuck : public Duck {
public:
    ModelDuck() {
        flyBehavior_ = std::make_unique<FlyNullObject>();
        quackBehavior_ = std::make_unique<Quack>();
    }

    void display() const override { std::cout << "I'm a model duck\n"; }
};

int main() {
    ModelDuck model;
    model.performFly();                                            // does nothing
    model.setFlyBehavior(std::make_unique<FlyRocketPowered>());
    model.performFly();                                            // "Flying with a rocket"
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
from abc import ABC, abstractmethod


class FlyBehavior(ABC):
    @abstractmethod
    def fly(self) -> None:
        pass


class QuackBehavior(ABC):
    @abstractmethod
    def quack(self) -> None:
        pass


class FlyWithWings(FlyBehavior):
    def fly(self) -> None:
        print("Flapping wings")


class FlyNullObject(FlyBehavior):
    def fly(self) -> None:
        pass  # do nothing — can't fly


class FlyRocketPowered(FlyBehavior):
    def fly(self) -> None:
        print("Flying with a rocket")


class Quack(QuackBehavior):
    def quack(self) -> None:
        print("Quack!")


class Duck(ABC):
    def __init__(self) -> None:
        self.fly_behavior: FlyBehavior
        self.quack_behavior: QuackBehavior

    def perform_fly(self) -> None:
        self.fly_behavior.fly()

    def perform_quack(self) -> None:
        self.quack_behavior.quack()

    def set_fly_behavior(self, fb: FlyBehavior) -> None:
        self.fly_behavior = fb

    @abstractmethod
    def display(self) -> None:
        pass


class ModelDuck(Duck):
    def __init__(self) -> None:
        super().__init__()
        self.fly_behavior = FlyNullObject()
        self.quack_behavior = Quack()

    def display(self) -> None:
        print("I'm a model duck")


model = ModelDuck()
model.perform_fly()                            # does nothing
model.set_fly_behavior(FlyRocketPowered())
model.perform_fly()                            # "Flying with a rocket"
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
interface FlyBehavior {
  fly(): void;
}

interface QuackBehavior {
  quack(): void;
}

class FlyWithWings implements FlyBehavior {
  fly(): void { console.log("Flapping wings"); }
}

class FlyNullObject implements FlyBehavior {
  fly(): void { /* do nothing — can't fly */ }
}

class FlyRocketPowered implements FlyBehavior {
  fly(): void { console.log("Flying with a rocket"); }
}

class Quack implements QuackBehavior {
  quack(): void { console.log("Quack!"); }
}

abstract class Duck {
  protected flyBehavior!: FlyBehavior;
  protected quackBehavior!: QuackBehavior;

  performFly(): void {
    this.flyBehavior.fly();
  }

  performQuack(): void {
    this.quackBehavior.quack();
  }

  setFlyBehavior(fb: FlyBehavior): void {
    this.flyBehavior = fb;
  }

  abstract display(): void;
}

class ModelDuck extends Duck {
  constructor() {
    super();
    this.flyBehavior = new FlyNullObject();
    this.quackBehavior = new Quack();
  }

  display(): void {
    console.log("I'm a model duck");
  }
}

const model = new ModelDuck();
model.performFly();                          // does nothing
model.setFlyBehavior(new FlyRocketPowered());
model.performFly();                          // "Flying with a rocket"
```
  </div>
</div>

In languages with first-class functions, a strategy is often *just a function* — `Comparator<T>` in Java, `Comparable` in Python's `sorted(key=...)`, a lambda passed to `Array.prototype.sort`. Use an explicit Strategy class when the algorithm needs identity, configuration data, multiple operations, polymorphic dispatch beyond a single call, or test seams.

# Design Decisions

## How does the Strategy access Context data?

When a Strategy needs information from the Context to do its job, there are two main approaches {% cite Gamma1995 %}:

* **Pass data as parameters:** The Context passes everything the Strategy needs through the algorithm interface (e.g., `compose(componentSizes, lineWidth, breaks)`). This keeps Strategy and Context decoupled, but the Context may have to pass data the Strategy doesn't actually need.
* **Pass the Context itself:** The Context passes itself as an argument, and the Strategy queries the Context for whatever data it needs (e.g., `strategy.execute(this)`). This lets the Strategy ask for exactly what it wants but requires Context to expose a richer interface, increasing coupling.

The right choice depends on the algorithm's data needs and how stable the Context's interface is.

## Compile-time vs. runtime strategy selection

* **Runtime selection** (the standard form): the Strategy is held as a field and can be swapped via a setter. This enables dynamic reconfiguration — exactly what `setFlyBehavior()` enables in the duck example.
* **Compile-time selection** (C++ template parameter, generics): the Strategy is bound when the type is instantiated. This is more efficient (no virtual dispatch, possibly inlinable) but cannot change at runtime. Useful when the choice is fixed at configuration time and performance matters {% cite Gamma1995 %}.

## Optional Strategy with default behavior

The Context can be simplified if it's meaningful for the Strategy reference to be absent. The Context checks if a Strategy is set: if so, it delegates; if not, it falls back to a default behavior {% cite Gamma1995 %}. Clients that want the default never have to deal with Strategy objects at all. The [Null Object](/SEBook/designpatterns/state.html#how-to-represent-a-state-in-which-the-object-is-never-doing-anything-either-at-initialization-time-or-as-a-final-state) variant (e.g., `FlyNullObject`) achieves the same effect more uniformly: a "do nothing" Strategy keeps the Context's call site simple (`flyBehavior.fly()`) without null checks.

## Stateless vs. stateful strategies

If a Strategy carries no instance data, it can be shared across many Contexts as a Flyweight or Singleton, saving memory and avoiding repeated allocation. If it carries per-Context configuration (e.g., a `RangeValidator(min=0, max=100)`), each Context needs its own Strategy instance.

# Consequences

Applying the Strategy pattern yields several important consequences {% cite Gamma1995 %}:

* **Families of related algorithms.** Strategy hierarchies define a family of interchangeable algorithms. Common functionality can be factored out via inheritance among ConcreteStrategies.
* **An alternative to subclassing.** Rather than baking each algorithm variant into a Context subclass — which couples algorithm and Context tightly — Strategy encapsulates each algorithm separately. The Context becomes simpler, and algorithms can vary independently.
* **Eliminates conditional statements.** Code with many `if`/`switch` branches selecting between algorithms is a strong code smell pointing to Strategy. Each branch becomes a polymorphic ConcreteStrategy. This is the **polymorphism over conditions** principle that also underlies the [State](/SEBook/designpatterns/state.html) pattern.
* **A choice of implementations.** Strategies can provide different implementations of the *same* behavior with different time/space trade-offs (e.g., a fast approximate sort vs. a careful stable sort), letting the client choose.
* **Clients must know about the strategies.** Because the client typically picks the ConcreteStrategy, it must understand how the strategies differ. If the choice should be hidden from clients, Strategy is the wrong tool.
* **Communication overhead.** The Strategy interface is shared by all ConcreteStrategies. Some may not need all the data the interface passes, leading to wasted preparation in the Context.
* **Increased number of objects.** Strategy adds one class per algorithm variant. Stateless strategies can be shared as flyweights to mitigate this.

# Strategy vs. Related Patterns

| Pattern | Similarity | Difference |
|---|---|---|
| [**State**](/SEBook/designpatterns/state.html) | Identical UML structure: a Context delegates to an interface with multiple implementations. | **State**: behavior changes *implicitly* via internal transitions (the state objects switch each other). **Strategy**: behavior is *explicitly* selected by the client; strategies don't transition between each other {% cite FreemanRobson2020 %}. |
| **Template Method** | Both let you vary parts of an algorithm. | **Template Method** uses inheritance — the base class fixes the skeleton and subclasses override individual steps. **Strategy** uses composition — the entire algorithm is swapped via an external object {% cite Gamma1995 %}. |
| [**Command**](/SEBook/designpatterns/command.html) | Both wrap behavior in an object behind a common interface. | **Command** represents a *request* with a lifecycle (queue, log, undo). **Strategy** represents an *algorithm choice* — there is no request identity, no undo, no queuing. |
| [**Observer**](/SEBook/designpatterns/observer.html) | Both replace static coupling with dynamic delegation. | **Observer** broadcasts state changes to many listeners. **Strategy** routes one operation to one chosen algorithm. |
| **Decorator** | Both can add or change behavior via composition. | **Decorator** wraps an object to add behavior while preserving its interface. **Strategy** replaces an algorithm entirely — there is no chain of wrappers. |

A useful heuristic distinguishing Strategy from State: ask whether *the client* picks the implementation (Strategy) or whether *the object's own internal logic* picks it (State). If a `GumballMachine` switches from `NoQuarterState` to `HasQuarterState` because the user inserted a coin, that's State. If a sort routine accepts a `Comparator` parameter, that's Strategy.

# Pattern Compounds and Idioms

Strategy combines naturally with other patterns:

* **Strategy + [Singleton](/SEBook/designpatterns/singleton.html) / Flyweight:** Stateless strategies (e.g., `Quack`, `Squeak`) carry behavior but no data. They can be implemented as singletons or shared as flyweights to avoid creating one instance per Context.
* **Null Strategy:** A "do nothing" ConcreteStrategy (e.g., `FlyNullObject`, `MuteQuack`) replaces null checks in the Context with uniform polymorphic dispatch. This is the **Null Object** pattern superimposed on Strategy.
* **Strategy + [Factory Method](/SEBook/designpatterns/factory_method.html) / [Abstract Factory](/SEBook/designpatterns/abstract_factory.html):** A factory selects which ConcreteStrategy to instantiate based on configuration, environment, or feature flags — keeping the Context oblivious to selection logic.
* **Strategy in MVC:** In the [MVC](/SEBook/designpatterns/mvc.html) compound pattern, the Controller is a Strategy used by the View. Swapping controllers (e.g., from an editing controller to a read-only controller) reconfigures input behavior without modifying the View.

# Common Examples

| Domain | Strategy interface | Concrete strategies |
|---|---|---|
| Sorting | `Comparator<T>` | natural order, by-field, custom rules |
| Validation | `Validator` | range check, regex match, length check, composed validators |
| Compression | `Compressor` | gzip, zip, lz4, no-op |
| Payment | `PaymentMethod` | credit card, PayPal, bank transfer, gift card |
| Authentication | `AuthStrategy` | password, OAuth, SSO, API key |
| Game AI | `BehaviorStrategy` | aggressive, defensive, patrol, idle |
| Text layout | `Compositor` | simple greedy, TeX optimal, fixed-width array |
| Pricing | `DiscountStrategy` | seasonal, member, bulk, no discount |

# Practical Guidance: When NOT to Use Strategy

Strategy is not free. Skip it when:

* **There is only one algorithm.** A single concrete class with a single method is simpler. Don't create an interface and subclass for a variant that doesn't exist yet — that's speculative abstraction.
* **The variants will never change at runtime *and* clients don't care.** A simple inheritance hierarchy or even a parameter switch may be clearer.
* **The strategies are trivial one-liners.** A function or lambda is often enough; the boilerplate of a class hierarchy is unjustified.
* **The choice is genuinely a state machine.** If "which algorithm" depends on what the object is currently doing, [State](/SEBook/designpatterns/state.html) is the right tool — the structure looks identical but the intent differs.

As with all design patterns, keep [the Rule of Three](/SEBook/designpatterns.html#design-patterns-and-refactoring) in mind: don't introduce Strategy until you have at least three concrete variants or a clear plan for runtime swapping. The simplest code is usually the smartest design.

## Flashcards

{% include flashcards.html id="design_pattern_strategy" %}

## Quiz

{% include quiz.html id="design_pattern_strategy" %}
