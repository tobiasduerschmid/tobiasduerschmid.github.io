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

In our `PizzaStore` example, we make the `createPizza()` method **abstract** within the base `PizzaStore` class. This abstract method is the "Factory Method". We then create concrete subclasses like `NYPizzaStore` and `ChicagoPizzaStore`, each implementing `createPizza()` to return their specific regional variants.

The structure involves four key roles:
*   **Product:** The common interface for the objects being created (e.g., `Pizza`).
*   **Concrete Product:** The specific implementation (e.g., `NYStyleCheesePizza`).
*   **Creator:** The abstract class that contains the high-level business logic (the "Template Method") and declares the Factory Method.
*   **Concrete Creator:** The subclass that implements the Factory Method to produce the actual product.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
abstract class Creator {
    + {abstract} factoryMethod(): Product
    + operation(): void
}
interface Product {
}
class Creator1 {
    + factoryMethod(): Product
}
class Product1 {
}
Creator1 --|> Creator
Product1 ..|> Product
Creator --> Product : product
Creator1 ..> Product1 : <<create>>
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
abstract class Pizza {
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
The primary benefit of this pattern is **decoupling**: the high-level "Creator" code is completely oblivious to which "Concrete Product" it is actually using. This allows the system to evolve independently; you can add a `LAPizzaStore` without touching a single line of code in the original `PizzaStore` base class.

However, there are trade-offs:
*   **Boilerplate Code:** It requires creating many new classes (one for each product type and one for each creator type), which can increase the "static" complexity of the code.
*   **Program Comprehension:** While it reduces long-term maintenance costs, it can make the initial learning curve steeper for new developers who aren't familiar with the pattern.

# Design Decisions

## Abstract vs. Concrete Creator
* **Abstract Creator** (as shown above): Forces every subclass to implement the factory method. Maximum flexibility, but requires subclassing even for simple cases.
* **Concrete Creator with default:** The base creator provides a default product. Subclasses only override when they need a different product. Simpler, but may lead to confusion about when overriding is expected.

## Parameterized Factory Method
Instead of having separate subclasses for each product, a single factory method takes a parameter (like a string or enum) to decide which product to create. This reduces the class count but violates the [Open/Closed Principle](/SEBook/designprinciples/solid.html#openclosed-principle-ocp)—adding a new product requires modifying the factory method's conditional logic.

## Static Factory Method (Not GoF)
A common idiom—`Loan.newTermLoan()`—uses static methods on the product class itself to control creation. This is not the GoF Factory Method (which relies on subclass override), but is widely used in practice. It provides named constructors and can return cached instances or subtype variants.

# Choosing the Right Creational Pattern

A common source of confusion is when to use Factory Method vs. the other creational patterns. The key discriminators are:

| Pattern | Use When... | Key Characteristic |
|---------|-------------|-------------------|
| **Factory Method** | Only one type of product; subclasses decide which concrete type | Simplest; uses inheritance (subclass overrides a method) |
| **[Abstract Factory](/SEBook/designpatterns/abstract_factory.html)** | A *family* of multiple related product types that must work together | Uses composition (client receives a factory object); highest extensibility for new families |
| **[Builder](/SEBook/designpatterns/builder.html)** | Product has many parts with sequential construction; construction process itself varies | Separates the construction algorithm from the object representation |

An important insight: **factory methods often lurk inside Abstract Factories**. Each creation method in an Abstract Factory (e.g., `createDough()`, `createSauce()`) is itself a factory method. The Abstract Factory defines the interface; the concrete factory subclasses implement each method—which is exactly the Factory Method pattern applied to multiple products.

## Flashcards

{% include flashcards.html id="design_pattern_factory" %}

## Quiz

{% include quiz.html id="design_pattern_factory" %}
