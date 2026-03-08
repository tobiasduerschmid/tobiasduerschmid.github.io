---
title: Factory Method Patern
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

# Consequences
The primary benefit of this pattern is **decoupling**: the high-level "Creator" code is completely oblivious to which "Concrete Product" it is actually using. This allows the system to evolve independently; you can add a `LAPizzaStore` without touching a single line of code in the original `PizzaStore` base class.

However, there are trade-offs:
*   **Boilerplate Code:** It requires creating many new classes (one for each product type and one for each creator type), which can increase the "static" complexity of the code.
*   **Program Comprehension:** While it reduces long-term maintenance costs, it can make the initial learning curve steeper for new developers who aren't familiar with the pattern.
