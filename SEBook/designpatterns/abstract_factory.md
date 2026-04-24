---
title: Abstract Factory Pattern
layout: sebook
---

# Context
In complex software systems, we often encounter situations where we must manage multiple categories of related objects that need to work together consistently. Imagine a software framework for a pizza franchise that has expanded into different regions, such as New York and Chicago. Each region has its own specific set of ingredients: New York uses thin crust dough and Marinara sauce, while Chicago uses thick crust dough and plum tomato sauce. The high-level process of preparing a pizza remains stable across all locations, but the specific "family" of ingredients used depends entirely on the geographical context.

# Problem
The primary challenge arises when a system needs to be independent of how its products are created, but those products belong to families that must be used together. Without a formal creational pattern, developers might encounter the following issues:
*   **Inconsistent Product Groupings:** There is a risk that a "rogue" franchise might accidentally mix New York thin crust with Chicago deep-dish sauce, leading to a product that doesn't meet quality standards.
*   **Parallel Inheritance Hierarchies:** You often end up with multiple hierarchies (e.g., a `Dough` hierarchy, a `Sauce` hierarchy, and a `Cheese` hierarchy) that all need to be instantiated based on the same single decision point, such as the region.
*   **Tight Coupling:** If the `Pizza` class directly instantiates concrete ingredient classes, it becomes "intimate" with every regional variation, making it incredibly difficult to add a new region like Los Angeles without modifying existing code.

# Solution
The **Abstract Factory Pattern** provides an interface for creating families of related or dependent objects without specifying their concrete classes. *Note: It is a common misconception to refer to this as a "factory of factories." A system where factories produce other factories introduces unnecessary complexity and defeats the purpose of the pattern.* A much better mental model is to think of it as a **"Product Family Factory"** or an **"Ingredients Factory."** Structurally, a single Abstract Factory interface simply contains a collection of multiple **Factory Methods**—one for each product in the family. 

The design pattern involves these roles:
1.  **Abstract Factory Interface:** Defining an interface (e.g., `PizzaIngredientFactory`) with a creation method for each type of product in the family (e.g., `createDough()`, `createSauce()`).
2.  **Concrete Factories:** Implementing regional subclasses (e.g., `NYPizzaIngredientFactory`) that produce the specific variants of those products.
3.  **Client:** The client (e.g., the `Pizza` class) no longer knows about specific ingredients. Instead, it is passed an `IngredientFactory` and simply asks for its components, remaining completely oblivious to whether it is receiving New York or Chicago variants.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface AbstractFactory {
    + CreateProductA(): AbstractProductA
    + CreateProductB(): AbstractProductB
}
interface AbstractProductA {
}
interface AbstractProductB {
}
class ConcreteFactory1 {
    + CreateProductA(): AbstractProductA
    + CreateProductB(): AbstractProductB
}
class ConcreteFactory2 {
    + CreateProductA(): AbstractProductA
    + CreateProductB(): AbstractProductB
}
class ProductA1 {
}
class ProductA2 {
}
class ProductB1 {
}
class ProductB2 {
}
class Client {
}
Client ..> AbstractFactory
Client ..> AbstractProductA
Client ..> AbstractProductB
ConcreteFactory1 ..|> AbstractFactory
ConcreteFactory2 ..|> AbstractFactory
ProductA1 ..|> AbstractProductA
ProductA2 ..|> AbstractProductA
ProductB1 ..|> AbstractProductB
ProductB2 ..|> AbstractProductB
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
interface PizzaIngredientFactory {
	+ createDough(): Dough
	+ createSauce(): Sauce
	+ createCheese(): Cheese
}
interface Dough
interface Sauce
interface Cheese
class NYPizzaIngredientFactory
class ThinCrustDough
class MarinaraSauce
class ReggianoCheese
class CheesePizza {
	- ingredientFactory: PizzaIngredientFactory
	+ prepare(): void
}
NYPizzaIngredientFactory ..|> PizzaIngredientFactory
ThinCrustDough ..|> Dough
MarinaraSauce ..|> Sauce
ReggianoCheese ..|> Cheese
CheesePizza --> PizzaIngredientFactory : requests family
NYPizzaIngredientFactory --> ThinCrustDough : creates
NYPizzaIngredientFactory --> MarinaraSauce : creates
NYPizzaIngredientFactory --> ReggianoCheese : creates
@enduml'></div>

## Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant pizza: CheesePizza
participant factory: NYPizzaIngredientFactory
participant dough: ThinCrustDough
participant sauce: MarinaraSauce
participant cheese: ReggianoCheese
o-> pizza: prepare()
activate pizza
pizza -> factory: createDough()
activate factory
create dough
factory --> dough: <<create>>
factory --> pizza: Dough
deactivate factory
pizza -> factory: createSauce()
activate factory
create sauce
factory --> sauce: <<create>>
factory --> pizza: Sauce
deactivate factory
pizza -> factory: createCheese()
activate factory
create cheese
factory --> cheese: <<create>>
factory --> pizza: Cheese
deactivate factory
deactivate pizza
@enduml'></div>

# Code Example

This example keeps the client (`CheesePizza`) independent of concrete ingredient classes. Switching from New York to Chicago means passing a different factory object, not rewriting the pizza.

> **Teaching example:** These snippets are intentionally small. They show one reasonable mapping of the pattern roles, not a drop-in architecture. In production, always tailor the pattern to the concrete context: lifecycle, ownership, error handling, concurrency, dependency injection, language idioms, and team conventions.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Abstract Factory code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
interface Dough { String name(); }
interface Sauce { String name(); }
interface Cheese { String name(); }

final class ThinCrustDough implements Dough {
    public String name() { return "thin crust dough"; }
}

final class MarinaraSauce implements Sauce {
    public String name() { return "marinara sauce"; }
}

final class ReggianoCheese implements Cheese {
    public String name() { return "reggiano cheese"; }
}

interface PizzaIngredientFactory {
    Dough createDough();
    Sauce createSauce();
    Cheese createCheese();
}

final class NYPizzaIngredientFactory implements PizzaIngredientFactory {
    public Dough createDough() { return new ThinCrustDough(); }
    public Sauce createSauce() { return new MarinaraSauce(); }
    public Cheese createCheese() { return new ReggianoCheese(); }
}

final class CheesePizza {
    private final PizzaIngredientFactory factory;

    CheesePizza(PizzaIngredientFactory factory) {
        this.factory = factory;
    }

    void prepare() {
        Dough dough = factory.createDough();
        Sauce sauce = factory.createSauce();
        Cheese cheese = factory.createCheese();
        System.out.println("Preparing pizza with "
            + dough.name() + ", " + sauce.name() + ", " + cheese.name());
    }
}

public class Demo {
    public static void main(String[] args) {
        CheesePizza pizza = new CheesePizza(new NYPizzaIngredientFactory());
        pizza.prepare();
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <iostream>
#include <memory>
#include <string>

struct Dough { virtual ~Dough() = default; virtual std::string name() const = 0; };
struct Sauce { virtual ~Sauce() = default; virtual std::string name() const = 0; };
struct Cheese { virtual ~Cheese() = default; virtual std::string name() const = 0; };

struct ThinCrustDough : Dough {
    std::string name() const override { return "thin crust dough"; }
};

struct MarinaraSauce : Sauce {
    std::string name() const override { return "marinara sauce"; }
};

struct ReggianoCheese : Cheese {
    std::string name() const override { return "reggiano cheese"; }
};

struct PizzaIngredientFactory {
    virtual ~PizzaIngredientFactory() = default;
    virtual std::unique_ptr<Dough> createDough() const = 0;
    virtual std::unique_ptr<Sauce> createSauce() const = 0;
    virtual std::unique_ptr<Cheese> createCheese() const = 0;
};

struct NYPizzaIngredientFactory : PizzaIngredientFactory {
    std::unique_ptr<Dough> createDough() const override {
        return std::make_unique<ThinCrustDough>();
    }
    std::unique_ptr<Sauce> createSauce() const override {
        return std::make_unique<MarinaraSauce>();
    }
    std::unique_ptr<Cheese> createCheese() const override {
        return std::make_unique<ReggianoCheese>();
    }
};

class CheesePizza {
public:
    explicit CheesePizza(const PizzaIngredientFactory& factory)
        : factory_(factory) {}

    void prepare() const {
        auto dough = factory_.createDough();
        auto sauce = factory_.createSauce();
        auto cheese = factory_.createCheese();
        std::cout << "Preparing pizza with " << dough->name()
                  << ", " << sauce->name() << ", " << cheese->name() << "\n";
    }

private:
    const PizzaIngredientFactory& factory_;
};

int main() {
    NYPizzaIngredientFactory factory;
    CheesePizza pizza(factory);
    pizza.prepare();
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
from abc import ABC, abstractmethod


class Dough(ABC):
    @abstractmethod
    def name(self) -> str:
        pass


class Sauce(ABC):
    @abstractmethod
    def name(self) -> str:
        pass


class Cheese(ABC):
    @abstractmethod
    def name(self) -> str:
        pass


class ThinCrustDough(Dough):
    def name(self) -> str:
        return "thin crust dough"


class MarinaraSauce(Sauce):
    def name(self) -> str:
        return "marinara sauce"


class ReggianoCheese(Cheese):
    def name(self) -> str:
        return "reggiano cheese"


class PizzaIngredientFactory(ABC):
    @abstractmethod
    def create_dough(self) -> Dough:
        pass

    @abstractmethod
    def create_sauce(self) -> Sauce:
        pass

    @abstractmethod
    def create_cheese(self) -> Cheese:
        pass


class NYPizzaIngredientFactory(PizzaIngredientFactory):
    def create_dough(self) -> Dough:
        return ThinCrustDough()

    def create_sauce(self) -> Sauce:
        return MarinaraSauce()

    def create_cheese(self) -> Cheese:
        return ReggianoCheese()


class CheesePizza:
    def __init__(self, factory: PizzaIngredientFactory) -> None:
        self.factory = factory

    def prepare(self) -> None:
        dough = self.factory.create_dough()
        sauce = self.factory.create_sauce()
        cheese = self.factory.create_cheese()
        print(f"Preparing pizza with {dough.name()}, {sauce.name()}, {cheese.name()}")


pizza = CheesePizza(NYPizzaIngredientFactory())
pizza.prepare()
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
interface Dough { name(): string; }
interface Sauce { name(): string; }
interface Cheese { name(): string; }

class ThinCrustDough implements Dough {
  name(): string { return "thin crust dough"; }
}

class MarinaraSauce implements Sauce {
  name(): string { return "marinara sauce"; }
}

class ReggianoCheese implements Cheese {
  name(): string { return "reggiano cheese"; }
}

interface PizzaIngredientFactory {
  createDough(): Dough;
  createSauce(): Sauce;
  createCheese(): Cheese;
}

class NYPizzaIngredientFactory implements PizzaIngredientFactory {
  createDough(): Dough { return new ThinCrustDough(); }
  createSauce(): Sauce { return new MarinaraSauce(); }
  createCheese(): Cheese { return new ReggianoCheese(); }
}

class CheesePizza {
  constructor(private readonly factory: PizzaIngredientFactory) {}

  prepare(): void {
    const dough = this.factory.createDough();
    const sauce = this.factory.createSauce();
    const cheese = this.factory.createCheese();
    console.log(`Preparing pizza with ${dough.name()}, ${sauce.name()}, ${cheese.name()}`);
  }
}

const pizza = new CheesePizza(new NYPizzaIngredientFactory());
pizza.prepare();
```
  </div>
</div>

# Consequences
Applying the Abstract Factory pattern results in several significant architectural trade-offs:
*   **Isolation of Concrete Classes:** It decouples the client code from the actual factory and product implementations, promoting high information hiding.
*   **Promoting Consistency:** It ensures that products from the same family are always used together, preventing incompatible combinations.
*   **Ease of Adding New Families:** Adding a new look-and-feel or a new region is a "pure addition"—you simply create a new concrete factory and new product implementations without touching existing code.
*   **The "Rigid Interface" Drawback:** While adding new *families* is easy, adding new *types* of products to the family is difficult. If you want to add "Pepperoni" to your ingredient family, you must change the Abstract Factory interface and modify every single concrete factory subclass to implement the new method. This is a fundamental asymmetry: the pattern makes one axis of change easy (new families) at the cost of making the other axis hard (new product types).

# Comparing the Creational Patterns

Understanding when each creational pattern applies requires examining *which sub-problem of object creation* each one solves:

| | **Factory Method** | **Abstract Factory** | **Builder** |
|---|---|---|---|
| **Focus** | One product type | Family of related product types | Complex product with many parts |
| **Mechanism** | Inheritance (subclass overrides) | Composition (client receives factory object) | Step-by-step construction algorithm |
| **Adding new variants** | Add new Creator subclass | Add new Concrete Factory + products | Add new Builder subclass |
| **Adding new product types** | N/A (only one product) | Difficult (change interface + all factories) | Add new build step |
| **Complexity** | Low | High (most variation points) | Medium |
| **Key benefit** | Simplicity | Enforces family consistency | Communicates product structure |

A telling interview question from Head First Design Patterns captures the relationship: *"Factory Method uses classes to create; Abstract Factory uses objects. That's totally different!"* Factory Method relies on **inheritance**—you extend a creator and override the factory method. Abstract Factory relies on **object composition**—you pass a factory object to the client, and the factory creates the products.

# Flashcards

{% include flashcards.html id="design_pattern_factory" %}

# Quiz

{% include quiz.html id="design_pattern_factory" %}
