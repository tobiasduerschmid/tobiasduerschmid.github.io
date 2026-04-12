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
The **Abstract Factory Pattern** provides an interface for creating families of related or dependent objects without specifying their concrete classes. It essentially acts as a "factory of factories," or more accurately, a single factory that contains multiple **Factory Methods**. 

The design pattern involves these roles:
1.  **Abstract Factory Interface:** Defining an interface (e.g., `PizzaIngredientFactory`) with a creation method for each type of product in the family (e.g., `createDough()`, `createSauce()`).
2.  **Concrete Factories:** Implementing regional subclasses (e.g., `NYPizzaIngredientFactory`) that produce the specific variants of those products.
3.  **Client:** The client (e.g., the `Pizza` class) no longer knows about specific ingredients. Instead, it is passed an `IngredientFactory` and simply asks for its components, remaining completely oblivious to whether it is receiving New York or Chicago variants.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
interface AbstractFactory {
	+ createProductA(): AbstractProductA
	+ createProductB(): AbstractProductB
}
interface AbstractProductA
interface AbstractProductB
class ConcreteFactory
class ConcreteProductA
class ConcreteProductB
class Client
ConcreteFactory ..|> AbstractFactory
ConcreteProductA ..|> AbstractProductA
ConcreteProductB ..|> AbstractProductB
Client --> AbstractFactory : uses >
ConcreteFactory --> ConcreteProductA : creates
ConcreteFactory --> ConcreteProductB : creates
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
pizza -> factory: createDough()
activate factory
factory --> pizza: dough
deactivate factory
pizza -> factory: createSauce()
activate factory
factory --> pizza: sauce
deactivate factory
pizza -> factory: createCheese()
activate factory
factory --> pizza: cheese
deactivate factory
@enduml'></div>

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
