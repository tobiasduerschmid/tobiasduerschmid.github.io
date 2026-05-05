---
title: Abstract Factory Pattern
layout: sebook
---

# Context
In complex software systems, we often encounter situations where we must manage multiple categories of related objects that need to work together consistently. Imagine a software framework for a pizza franchise that has expanded into different regions, such as New York and Chicago. Each region has its own specific set of ingredients: New York uses thin crust dough and Marinara sauce, while Chicago uses thick crust dough and plum tomato sauce. The high-level process of preparing a pizza remains stable across all locations, but the specific "family" of ingredients used depends entirely on the geographical context.

# Problem
The primary challenge arises when a system needs to be independent of how its products are created, but those products belong to families that must be used together. Without a formal creational pattern, developers might encounter the following issues:
*   **Inconsistent Product Groupings:** There is a risk that a "rogue" franchise might accidentally mix New York thin crust with Chicago plum-tomato sauce, leading to a product that doesn't meet quality standards.
*   **Parallel Inheritance Hierarchies:** You often end up with multiple hierarchies (e.g., a `Dough` hierarchy, a `Sauce` hierarchy, and a `Cheese` hierarchy) that all need to be instantiated based on the same single decision point, such as the region.
*   **Tight Coupling:** If the `Pizza` class directly instantiates concrete ingredient classes, it becomes "intimate" with every regional variation, making it incredibly difficult to add a new region like Los Angeles without modifying existing code.

# Solution
The **Abstract Factory Pattern** provides an interface for creating families of related or dependent objects without specifying their concrete classes. *Note: Some sources call this a "factory of factories", but that shorthand is misleading: an Abstract Factory does not literally produce other factory objects—it produces product objects via factory objects.* A much better mental model is to think of it as a **"Product Family Factory"** or an **"Ingredients Factory"**. Structurally, a single Abstract Factory interface contains a collection of operations that fit the [**Factory Method**](/SEBook/designpatterns/factory_method.html) shape—one for each product in the family.

The design pattern involves these roles:
1.  **Abstract Factory Interface:** Defining an interface (e.g., `PizzaIngredientFactory`) with a creation method for each type of product in the family (e.g., `createDough()`, `createSauce()`).
2.  **Concrete Factories:** Implementing regional subclasses (e.g., `NYPizzaIngredientFactory`) that produce the specific variants of those products.
3.  **Client:** The client (e.g., the `Pizza` class) no longer knows about specific ingredients. Instead, it is passed an `IngredientFactory` and simply asks for its components, remaining completely oblivious to whether it is receiving New York or Chicago variants.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-caption="UML class diagram showing the Abstract Factory pattern roles — a Client depends on an AbstractFactory and abstract Products; ConcreteFactory1 and ConcreteFactory2 each produce their own coherent family of ProductA/ProductB variants." data-uml-spec='@startuml
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

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-caption="UML class diagram of a concrete Abstract Factory example — a CheesePizza requests Dough, Sauce, and Cheese from a PizzaIngredientFactory; NYPizzaIngredientFactory produces ThinCrustDough, MarinaraSauce, and ReggianoCheese as one family." data-uml-spec='@startuml
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

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-caption="UML sequence diagram showing how prepare() calls createDough, createSauce, and createCheese on the same NYPizzaIngredientFactory, guaranteeing the three returned ingredients form a consistent NY-style family." data-uml-spec='@startuml
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
Applying the Abstract Factory pattern results in several significant architectural trade-offs. The original GoF catalog identifies four:

*   **It isolates concrete classes.** The factory encapsulates the responsibility *and* the process of creating product objects, so clients manipulate instances only through their abstract interfaces. Concrete product class names are isolated inside the concrete factory and never appear in client code.
*   **It makes exchanging product families easy.** Because the concrete factory class appears only once in an application (where it's instantiated), swapping the entire product family is a one-line change—switch the factory, and the whole family changes at once. In the GoF widget-toolkit example, you switch from Motif to Presentation Manager simply by swapping `MotifWidgetFactory` for `PMWidgetFactory`. In the pizza example, you switch a franchise's region by passing a different `PizzaIngredientFactory`.
*   **It promotes consistency among products.** When products in a family are designed to work together, the pattern enforces that an application uses objects from only one family at a time, preventing incompatible combinations (e.g., NY thin-crust dough with Chicago plum-tomato sauce).
*   **Supporting new kinds of products is difficult.** While adding new *families* is easy (write a new concrete factory + product implementations), adding new *types* of products is hard. Adding "Pepperoni" to the ingredient family requires changing the `PizzaIngredientFactory` interface *and* modifying every concrete factory subclass to implement the new method. This is a fundamental asymmetry: the pattern makes one axis of change easy (new families) at the cost of making the other axis hard (new product types).

# Implementation Notes

The original GoF catalog highlights three useful techniques for implementing Abstract Factory:

*   **Factories as Singletons.** An application typically needs only one instance of a `ConcreteFactory` per product family, so the concrete factory is often implemented as a [Singleton](/SEBook/designpatterns/singleton.html). One `NYPizzaIngredientFactory` and one `ChicagoPizzaIngredientFactory` is usually all you need.
*   **Creating products with Factory Methods.** `AbstractFactory` only declares an *interface* for creating products; it's up to `ConcreteFactory` subclasses to actually create them. The most common implementation is to define a [Factory Method](/SEBook/designpatterns/factory_method.html) for each product, and have each concrete factory override those methods. (This is exactly the shape of the example above: each `createX()` slot is itself a Factory Method.) An alternative—useful when many product families exist—is to use the **Prototype** pattern: the concrete factory stores a prototypical instance of each product and creates new ones by cloning.
*   **Defining extensible factories.** Because `AbstractFactory` typically defines a separate operation per product kind, adding a new kind of product means changing the interface and every subclass. A more flexible (but less type-safe) variation collapses all the per-product operations into a single parameterized `make(kind)` operation, where the parameter identifies the kind of product to create. This trades compile-time type checking for the ability to add new product kinds without touching the interface.

# Known Uses

The pattern shows up across very different domains:

*   **GUI widget toolkits.** GoF's motivating example: a `WidgetFactory` interface with concrete `MotifWidgetFactory` and `PMWidgetFactory` (Presentation Manager) subclasses, each producing a coordinated family of windows, scroll bars, and buttons for one look-and-feel.
*   **InterViews `Kit` classes.** InterViews uses the `Kit` suffix to mark Abstract Factory classes—`WidgetKit` and `DialogKit` produce look-and-feel-specific UI objects, and `LayoutKit` produces composition objects appropriate to a desired layout (e.g., portrait vs. landscape).
*   **ET++ window-system portability.** ET++ uses Abstract Factory to achieve portability across window systems (X Windows, SunView). A `WindowSystem` abstract base class declares operations like `MakeWindow`, `MakeFont`, and `MakeColor`; each concrete subclass implements them for one specific window system.
*   **Cross-region product franchises.** Head First's Pizza Store example—the basis for the running example on this page—uses a `PizzaIngredientFactory` to ship region-appropriate dough, sauce, cheese, veggies, pepperoni, and clams to each franchise.

# Related Patterns

*   **[Factory Method](/SEBook/designpatterns/factory_method.html).** `AbstractFactory` operations are most commonly implemented *with* Factory Methods—each `createX()` slot is itself a Factory Method that a concrete factory subclass overrides.
*   **Prototype.** An alternative implementation of Abstract Factory: instead of subclassing for each product family, the concrete factory holds a prototypical instance of each product and creates new ones by cloning.
*   **[Singleton](/SEBook/designpatterns/singleton.html).** A concrete factory is often a Singleton, since one instance per product family typically suffices.

# Comparing the Creational Patterns

Understanding when each creational pattern applies requires examining *which sub-problem of object creation* each one solves:

| Comparison point | **[Factory Method](/SEBook/designpatterns/factory_method.html)** | **Abstract Factory** | **[Builder](/SEBook/designpatterns/builder.html)** |
|---|---|---|---|
| **Focus** | One product type | Family of related product types | Complex product with many parts |
| **Mechanism** | Inheritance (subclass overrides) | Composition (client receives factory object) | Step-by-step construction algorithm |
| **Adding new variants** | Add new Creator subclass | Add new Concrete Factory + products | Add new Builder subclass |
| **Adding new product types** | N/A (only one product) | Difficult (change interface + all factories) | Add new build step |
| **Complexity** | Low | High (most variation points) | Medium |
| **Key benefit** | Simplicity | Enforces family consistency | Communicates product structure |

A common framing captures the relationship: Factory Method relies on **inheritance**—you extend a creator and override the factory method. Abstract Factory relies on **object composition**—you pass a factory object to the client, and the factory creates the products. (In practice, the two patterns are often layered: each `createX()` slot inside an Abstract Factory is itself a Factory Method.)

## Flashcards

{% include flashcards.html id="design_pattern_factory" %}

## Quiz

{% include quiz.html id="design_pattern_factory" %}
