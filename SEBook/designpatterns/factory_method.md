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
    return pizza;
}
```

This approach presents several critical challenges:
1.  **Violation of Single Responsibility Principle:** This single method is now responsible for both *deciding which pizza to create* and *managing the baking process*.
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
layout landscape
interface Product {
    + use(): void
}
abstract class Creator {
    + operation(): void
    + createProduct(): Product
}
class ConcreteCreator
class ConcreteProduct {
    + use(): void
}
ConcreteCreator --|> Creator
ConcreteProduct ..|> Product
Creator --> Product : creates and uses >
ConcreteCreator --> ConcreteProduct : instantiates
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
abstract class PizzaStore {
    + orderPizza(type: String): Pizza
    + createPizza(type: String): Pizza
}
abstract class Pizza {
    + prepare(): void
    + bake(): void
    + cut(): void
    + box(): void
}
class NYPizzaStore
class NYStyleCheesePizza
NYPizzaStore --|> PizzaStore
NYStyleCheesePizza --|> Pizza
PizzaStore --> Pizza : prepares >
NYPizzaStore --> NYStyleCheesePizza : creates
@enduml'></div>

## Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant customer: Customer
participant store: NYPizzaStore
participant pizza: NYStyleCheesePizza
customer -> store: orderPizza("cheese")
activate store
store -> store: createPizza("cheese")
store -> pizza: prepare()
activate pizza
pizza --> store
store -> pizza: bake()
store -> pizza: cut()
store -> pizza: box()
store --> customer: pizza
deactivate pizza
deactivate store
@enduml'></div>

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
Instead of having separate subclasses for each product, a single factory method takes a parameter (like a string or enum) to decide which product to create. This reduces the class count but violates the Open/Closed Principle—adding a new product requires modifying the factory method's conditional logic.

## Static Factory Method (Not GoF)
A common idiom—`Loan.newTermLoan()`—uses static methods on the product class itself to control creation. This is not the GoF Factory Method (which relies on subclass override), but is widely used in practice. It provides named constructors and can return cached instances or subtype variants.

# Choosing the Right Creational Pattern

A common source of confusion is when to use Factory Method vs. the other creational patterns. The key discriminators are:

| Pattern | Use When... | Key Characteristic |
|---------|-------------|-------------------|
| **Factory Method** | Only one type of product; subclasses decide which concrete type | Simplest; uses inheritance (subclass overrides a method) |
| **[Abstract Factory](/SEBook/designpatterns/abstract_factory.html)** | A *family* of multiple related product types that must work together | Uses composition (client receives a factory object); highest extensibility for new families |
| **Builder** | Product has many parts with sequential construction; construction process itself varies | Separates the construction algorithm from the object representation |

An important insight: **factory methods often lurk inside Abstract Factories**. Each creation method in an Abstract Factory (e.g., `createDough()`, `createSauce()`) is itself a factory method. The Abstract Factory defines the interface; the concrete factory subclasses implement each method—which is exactly the Factory Method pattern applied to multiple products.

# Flashcards

{% include flashcards.html id="design_pattern_factory" %}

# Quiz

{% include quiz.html id="design_pattern_factory" %}
