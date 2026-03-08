---
title: Abstract Factory Patern
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

# Consequences
Applying the Abstract Factory pattern results in several significant architectural trade-offs:
*   **Isolation of Concrete Classes:** It decouples the client code from the actual factory and product implementations, promoting high information hiding.
*   **Promoting Consistency:** It ensures that products from the same family are always used together, preventing incompatible combinations.
*   **Ease of Adding New Families:** Adding a new look-and-feel or a new region is a "pure addition"—you simply create a new concrete factory and new product implementations without touching existing code.
*   **The "Rigid Interface" Drawback:** While adding new *families* is easy, adding new *types* of products to the family is difficult. If you want to add "Pepperoni" to your ingredient family, you must change the Abstract Factory interface and modify every single concrete factory subclass to implement the new method.
