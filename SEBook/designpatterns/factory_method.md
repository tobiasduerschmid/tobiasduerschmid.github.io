---
title: Factory Method Pattern
layout: sebook
---

# Context
In software construction, we often find ourselves in situations where a "Creator" class needs to manage a lifecycle of actions—such as preparing, processing, and delivering an item—but the specific type of item it handles varies based on the environment. 

For example, imagine a `PizzaStore` that needs to `orderPizza()`. The store follows a standard process: it must `prepare()`, `bake()`, `cut()`, and `box()` the pizza. However, the specific *type* of pizza (New York style vs. Chicago style) depends on the store's physical location. The "Context" here is a system where the high-level process is stable, but the specific objects being acted upon are volatile and vary based on concrete subclasses.

# Problem
Without a creational pattern, developers often resort to "Big Upfront Logic" using complex conditional statements. You might see code like this:

```java
public Pizza orderPizza(String type) {
    Pizza pizza;
    if (type.equals("cheese")) { pizza = new CheesePizza(); }
    else if (type.equals("greek")) { pizza = new GreekPizza(); }
    // ... more if-else blocks ...
    pizza.prepare();
    pizza.bake();
    pizza.cut();
    pizza.box();
    return pizza;
}
```

This approach presents several critical challenges:
1.  **Violation of [Single Responsibility Principle](/SEBook/designprinciples/solid.html#single-responsibility-principle-srp):** This single method is now responsible for both *deciding which pizza to create* and *managing the baking process*.
2.  **Divergent Change:** Every time the menu changes or the baking process is tweaked, this method must be modified, making it a "hot spot" for bugs.
3.  **Tight Coupling:** The store is "intimately" aware of every concrete pizza class, making it impossible to add new regional styles without rewriting the store's core logic.

# Solution
The **Factory Method Pattern** solves this by defining an interface for creating an object but letting subclasses decide which class to instantiate. It effectively "defers" the responsibility of creation to subclasses.

In our `PizzaStore` example, we typically make the `createPizza()` method **abstract** within the base `PizzaStore` class. This abstract method is the "Factory Method". We then create concrete subclasses like `NYPizzaStore` and `ChicagoPizzaStore`, each implementing `createPizza()` to return their specific regional variants. (GoF also allows the Creator to provide a *default implementation* that subclasses may optionally override — see *Abstract vs. Concrete Creator* below.)

The structure involves four key roles (using GoF's names; the parenthesized names are from the GoF *Application/Document* motivating example):
*   **Product** (`Document`): defines the interface of objects the factory method creates (e.g., `Pizza`). This can be a Java `interface` or an abstract class — both are valid; *Head First* uses an abstract `Pizza` class with default `prepare()`/`bake()`/`cut()`/`box()` implementations that subclasses can override.
*   **ConcreteProduct** (`MyDocument`): implements the `Product` interface (e.g., `NYStyleCheesePizza`).
*   **Creator** (`Application`): declares the factory method, which returns an object of type `Product`. May also define a default implementation that returns a default `ConcreteProduct`. May also call the factory method to create a `Product` (often inside a *Template Method*, in GoF terminology — in our example, `orderPizza()` is the template method that calls `createPizza()`).
*   **ConcreteCreator** (`MyApplication`): overrides the factory method to return an instance of a `ConcreteProduct` (e.g., `NYPizzaStore` returns `NYStyleCheesePizza`).

> **Factory Method vs. "Simple Factory":** A common point of confusion is the **Simple Factory** (sometimes called *Static Factory Method*) — a single non-abstract class with a parameterized method (typically a chain of `if/else` or a `switch`) that returns one of several product types. *Head First Design Patterns* gives Simple Factory only an "honorable mention", noting it is a programming idiom rather than a true design pattern. The GoF Factory Method differs in that it *defers instantiation to subclasses via inheritance* — each `ConcreteCreator` overrides the factory method, rather than one factory class switching on a type parameter.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
abstract class Creator {
    + {abstract} factoryMethod(): Product
    + operation(): void
}
interface Product {
}
class ConcreteCreator {
    + factoryMethod(): Product
}
class ConcreteProduct {
}
ConcreteCreator --|> Creator
ConcreteProduct ..|> Product
Creator --> Product : product
ConcreteCreator ..> ConcreteProduct : <<create>>
note right of Creator
  product =
  factoryMethod();
end note
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
abstract class PizzaStore {
    + {abstract} createPizza(type: String): Pizza
    + orderPizza(type: String): Pizza
}
interface Pizza {
    + prepare(): void
    + bake(): void
    + cut(): void
    + box(): void
}
class NYPizzaStore {
    + createPizza(type: String): Pizza
}
class NYStyleCheesePizza {
}
NYPizzaStore --|> PizzaStore
NYStyleCheesePizza ..|> Pizza
PizzaStore --> Pizza : product
NYPizzaStore ..> NYStyleCheesePizza : <<create>>
@enduml'></div>

## Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
actor customer: Customer
participant store: NYPizzaStore
participant pizza: NYStyleCheesePizza
customer -> store: orderPizza("cheese")
activate store
store -> store: createPizza("cheese")
activate store
deactivate store
store -> pizza: prepare()
activate pizza
pizza --> store
deactivate pizza
store -> pizza: bake()
activate pizza
deactivate pizza
store -> pizza: cut()
activate pizza
deactivate pizza
store -> pizza: box()
activate pizza
deactivate pizza
store --> customer: pizza
deactivate store
@enduml'></div>

# Code Example

The base `PizzaStore` owns the stable ordering algorithm. The factory method, `createPizza`, is the one step subclasses vary.

> **Teaching example:** These snippets are intentionally small. They show one reasonable mapping of the pattern roles, not a drop-in architecture. In production, always tailor the pattern to the concrete context: lifecycle, ownership, error handling, concurrency, dependency injection, language idioms, and team conventions.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Factory Method code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
interface Pizza {
    void prepare();
    void bake();
    void cut();
    void box();
}

final class NYStyleCheesePizza implements Pizza {
    public void prepare() {
        System.out.println("Preparing NY cheese pizza");
    }

    public void bake() {
        System.out.println("Baking thin crust");
    }

    public void cut() {
        System.out.println("Cutting into diagonal slices");
    }

    public void box() {
        System.out.println("Boxing in NY PizzaStore box");
    }
}

abstract class PizzaStore {
    public Pizza orderPizza(String type) {
        Pizza pizza = createPizza(type);
        pizza.prepare();
        pizza.bake();
        pizza.cut();
        pizza.box();
        return pizza;
    }

    protected abstract Pizza createPizza(String type);
}

final class NYPizzaStore extends PizzaStore {
    protected Pizza createPizza(String type) {
        if (!type.equals("cheese")) {
            throw new IllegalArgumentException("Unknown pizza: " + type);
        }
        return new NYStyleCheesePizza();
    }
}

public class Demo {
    public static void main(String[] args) {
        PizzaStore store = new NYPizzaStore();
        store.orderPizza("cheese");
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>

struct Pizza {
    virtual ~Pizza() = default;
    virtual void prepare() = 0;
    virtual void bake() = 0;
    virtual void cut() = 0;
    virtual void box() = 0;
};

struct NYStyleCheesePizza : Pizza {
    void prepare() override { std::cout << "Preparing NY cheese pizza\n"; }
    void bake() override { std::cout << "Baking thin crust\n"; }
    void cut() override { std::cout << "Cutting into diagonal slices\n"; }
    void box() override { std::cout << "Boxing in NY PizzaStore box\n"; }
};

class PizzaStore {
public:
    virtual ~PizzaStore() = default;

    std::unique_ptr<Pizza> orderPizza(const std::string& type) {
        auto pizza = createPizza(type);
        pizza->prepare();
        pizza->bake();
        pizza->cut();
        pizza->box();
        return pizza;
    }

protected:
    virtual std::unique_ptr<Pizza> createPizza(const std::string& type) = 0;
};

class NYPizzaStore : public PizzaStore {
protected:
    std::unique_ptr<Pizza> createPizza(const std::string& type) override {
        if (type != "cheese") throw std::invalid_argument("unknown pizza");
        return std::make_unique<NYStyleCheesePizza>();
    }
};

int main() {
    NYPizzaStore store;
    auto pizza = store.orderPizza("cheese");
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
from abc import ABC, abstractmethod


class Pizza(ABC):
    @abstractmethod
    def prepare(self) -> None:
        pass

    @abstractmethod
    def bake(self) -> None:
        pass

    @abstractmethod
    def cut(self) -> None:
        pass

    @abstractmethod
    def box(self) -> None:
        pass


class NYStyleCheesePizza(Pizza):
    def prepare(self) -> None:
        print("Preparing NY cheese pizza")

    def bake(self) -> None:
        print("Baking thin crust")

    def cut(self) -> None:
        print("Cutting into diagonal slices")

    def box(self) -> None:
        print("Boxing in NY PizzaStore box")


class PizzaStore(ABC):
    def order_pizza(self, kind: str) -> Pizza:
        pizza = self.create_pizza(kind)
        pizza.prepare()
        pizza.bake()
        pizza.cut()
        pizza.box()
        return pizza

    @abstractmethod
    def create_pizza(self, kind: str) -> Pizza:
        pass


class NYPizzaStore(PizzaStore):
    def create_pizza(self, kind: str) -> Pizza:
        if kind != "cheese":
            raise ValueError(f"Unknown pizza: {kind}")
        return NYStyleCheesePizza()


store = NYPizzaStore()
store.order_pizza("cheese")
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
interface Pizza {
  prepare(): void;
  bake(): void;
  cut(): void;
  box(): void;
}

class NYStyleCheesePizza implements Pizza {
  prepare(): void {
    console.log("Preparing NY cheese pizza");
  }

  bake(): void {
    console.log("Baking thin crust");
  }

  cut(): void {
    console.log("Cutting into diagonal slices");
  }

  box(): void {
    console.log("Boxing in NY PizzaStore box");
  }
}

abstract class PizzaStore {
  orderPizza(kind: string): Pizza {
    const pizza = this.createPizza(kind);
    pizza.prepare();
    pizza.bake();
    pizza.cut();
    pizza.box();
    return pizza;
  }

  protected abstract createPizza(kind: string): Pizza;
}

class NYPizzaStore extends PizzaStore {
  protected createPizza(kind: string): Pizza {
    if (kind !== "cheese") throw new Error(`Unknown pizza: ${kind}`);
    return new NYStyleCheesePizza();
  }
}

const store = new NYPizzaStore();
store.orderPizza("cheese");
```
  </div>
</div>

# Consequences
The primary benefit of this pattern is **decoupling**: the high-level "Creator" code is completely oblivious to which "Concrete Product" it is actually using. This allows the system to evolve independently; you can add a `LAPizzaStore` without touching a single line of code in the original `PizzaStore` base class. As GoF puts it, factory methods *eliminate the need to bind application-specific classes into your code*.

GoF also calls out two further consequences worth highlighting:

*   **Provides hooks for subclasses.** Creating an object inside a class with a factory method is always more flexible than creating an object directly with `new`. Even when the base creator provides a reasonable default, the factory method gives subclasses a hook to override the kind of object created.
*   **Connects parallel class hierarchies.** When a class delegates a responsibility to a separate hierarchy (e.g., `Figure` ↔ `Manipulator` in GoF's example), a factory method on one side localizes the knowledge of which class on the other side belongs with which.

However, there are trade-offs:
*   **Forced subclassing.** Clients may have to subclass `Creator` *just* to instantiate a particular `ConcreteProduct`. Subclassing is fine when the client was going to subclass anyway — otherwise it adds another point of evolution. (This is the motivating reason GoF discusses the *Using templates to avoid subclassing* and *Parameterized factory methods* variants in Implementation.)
*   **Boilerplate Code:** It requires creating many new classes (one for each product type and one for each creator type), which can increase the "static" complexity of the code.
*   **Program Comprehension:** While it reduces long-term maintenance costs, it can make the initial learning curve steeper for new developers who aren't familiar with the pattern.

# Design Decisions

## Abstract vs. Concrete Creator
* **Abstract Creator** (as shown above): Forces every subclass to implement the factory method. Maximum flexibility, but requires subclassing even for simple cases.
* **Concrete Creator with default:** The base creator provides a default product. Subclasses only override when they need a different product. Simpler, but may lead to confusion about when overriding is expected.

## Parameterized Factory Method
A single factory method can take a parameter (like a `String` or `enum`) that identifies the kind of object to create — all variants share the same `Product` interface. Our example uses this form (`createPizza("cheese")`). GoF presents this as a *variation* of Factory Method, not a replacement: subclasses can still **override** the parameterized method to add new identifiers (e.g., a `MyCreator::Create` that handles new IDs and falls through to `Creator::Create` for the rest). It does shift conditional logic into a switch on the type parameter, so naive non-overriding implementations — adding cases by editing the existing method — violate the [Open/Closed Principle](/SEBook/designprinciples/solid.html#openclosed-principle-ocp). The polymorphic-override usage does not.

## Using Templates to Avoid Subclassing (C++)
GoF also notes that in C++ you can use templates to avoid the subclass-just-to-pick-a-Product problem: a `template <class TheProduct> class StandardCreator : public Creator { Product* CreateProduct() { return new TheProduct; } };` lets the client supply the product class with no `Creator` subclass at all. Modern Java/C# generics support a similar pattern.

## Static Factory Method (Not GoF)
A common idiom—`Loan.newTermLoan()`—uses static methods on the product class itself to control creation. This is not the GoF Factory Method (which relies on subclass override), but is widely used in practice. It provides named constructors and can return cached instances or subtype variants.

## Language-specific Variants
GoF discusses language-specific implementation details:
* **C++:** factory methods are typically `virtual` (often pure virtual). Don't call them from the `Creator`'s constructor — the `ConcreteCreator`'s override won't be available yet. *Lazy initialization* via an accessor (`GetProduct()`) that calls `CreateProduct()` on first use is one workaround.
* **Smalltalk / dynamically-typed languages:** factory methods can return a *class* (not an instance), giving even later binding for the type of `ConcreteProduct`.
* **Naming conventions:** GoF cites MacApp's convention of declaring abstract factory methods as `Class* DoMakeClass()` to make their role obvious.

# Choosing the Right Creational Pattern

A common source of confusion is when to use Factory Method vs. the other creational patterns. The key discriminators are:

| Pattern | Use When... | Key Characteristic |
|---------|-------------|-------------------|
| **Factory Method** | Only one type of product; subclasses decide which concrete type | Simplest; uses inheritance (subclass overrides a method) |
| **[Abstract Factory](/SEBook/designpatterns/abstract_factory.html)** | A *family* of multiple related product types that must work together | Uses composition (client receives a factory object); highest extensibility for new families |
| **[Builder](/SEBook/designpatterns/builder.html)** | Product has many parts with sequential construction; construction process itself varies | Separates the construction algorithm from the object representation |

An important insight: **factory methods often lurk inside Abstract Factories**. Each creation method in an Abstract Factory (e.g., `createDough()`, `createSauce()`) is itself a factory method. The Abstract Factory defines the interface; the concrete factory subclasses implement each method—which is exactly the Factory Method pattern applied to multiple products.

# Related Patterns

GoF connects Factory Method to several other patterns:

*   **[Abstract Factory](/SEBook/designpatterns/abstract_factory.html)** is often *implemented* with factory methods. The motivating example in Abstract Factory illustrates Factory Method as well.
*   **Template Method** typically *calls* factory methods. In our `PizzaStore`, `orderPizza()` is a template method (the fixed `prepare → bake → cut → box` sequence) that delegates the one varying step to the `createPizza()` factory method.
*   **Prototype** doesn't require subclassing the `Creator` (you supply a prototypical instance to clone instead). However, it often requires an `Initialize` operation on the `Product` class — Factory Method doesn't.

## Flashcards

{% include flashcards.html id="design_pattern_factory" %}

## Quiz

{% include quiz.html id="design_pattern_factory" %}
