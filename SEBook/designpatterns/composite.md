---
title: Composite Design Pattern
layout: sebook
---

# Problem 

Software often needs to treat individual objects and nested groups of objects uniformly. File systems contain files and directories, drawing tools contain primitive shapes and grouped drawings, and menu systems contain both single menu items and complete submenus. If a client has to distinguish between every leaf and every container, the code quickly fills with special cases and repeated tree traversal logic.

# Context

The Composite pattern applies when the domain is naturally recursive: a whole is built from parts, and some parts can themselves contain further parts. In such systems, clients want one common abstraction for both single objects and containers so they can issue operations like `print()`, `render()`, or `totalPrice()` without checking whether the receiver is a leaf or a branch.

# Solution

The **Composite Pattern** introduces a common `Component` abstraction shared by both atomic elements (`Leaf`) and containers (`Composite`). The composite stores child components and forwards operations recursively to them. Clients program only against the `Component` interface, which keeps the traversal logic inside the structure rather than scattering it across the application.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
abstract class Component {
	+ operation(): void
	+ add(child: Component): void
	+ remove(child: Component): void
}
class Leaf {
	+ operation(): void
}
class Composite {
	- children: List<Component>
	+ operation(): void
	+ add(child: Component): void
	+ remove(child: Component): void
}
class Client
Leaf --|> Component
Composite --|> Component
Composite "1" *--> "0..*" Component
Client --> Component : treats uniformly >
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
abstract class MenuComponent {
	+ print(): void
	+ add(component: MenuComponent): void
}
class Menu {
	- children: List<MenuComponent>
	+ print(): void
	+ add(component: MenuComponent): void
}
class MenuItem {
	+ print(): void
}
class Waitress {
	+ printMenu(): void
}
Menu --|> MenuComponent
MenuItem --|> MenuComponent
Menu "1" *-- "0..*" MenuComponent
Waitress --> MenuComponent : traverses
@enduml'></div>

## Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant waitress: Waitress
participant allMenus: Menu
participant dessertMenu: Menu
participant item: MenuItem
waitress -> allMenus: print()
activate allMenus
allMenus -> dessertMenu: print()
activate dessertMenu
dessertMenu -> item: print()
deactivate dessertMenu
deactivate allMenus
@enduml'></div>

# Design Decisions

## Transparent vs. Safe Composite

This is the fundamental design trade-off of the Composite pattern:

* **Transparent composite:** The full child-management interface (`add()`, `remove()`, `getChild()`) is declared on `Component`, so clients can treat leaves and composites identically through a single interface. This maximizes uniformity but means leaves inherit methods that make no sense for them (e.g., `add()` on a `MenuItem`). Leaves must either throw an exception or silently ignore these calls.

* **Safe composite:** Only `Composite` exposes `add()` and `remove()`, preventing nonsensical operations on leaves at compile time. But clients must now distinguish between leaves and composites when managing children, reducing the pattern's primary benefit of uniform treatment.

Neither approach is universally better—the choice depends on whether **uniformity** (transparent) or **type safety** (safe) is more important in your context.

## Child Ownership

If child objects cannot exist independently of their parent, use composition semantics and let the composite own the child lifetime. If children may be shared across multiple structures, model a weaker association instead. In UML, this distinction maps to filled-diamond composition vs. open-diamond aggregation.

## Parent References

Adding a parent reference to `Component` enables upward traversal (e.g., "which menu does this item belong to?") but complicates `add()` and `remove()` operations, which must now maintain bidirectional consistency.

# Composite in Pattern Compounds

The Composite pattern frequently appears as a building block in larger pattern compounds, because many patterns need to operate on tree structures:

* **Composite + Builder:** The Builder pattern can construct complex Composite structures step by step. The Composite's `Component` acts as the Builder's product, and the Builder handles the complexity of assembling the recursive tree.
* **Composite + Visitor:** When many distinct operations need to be performed on a Composite structure without modifying its classes, the Visitor pattern provides a clean separation of concerns. This is especially useful when new operations are added frequently but new leaf types are rare.
* **Composite + Iterator:** An Iterator can traverse the Composite tree in different orders (depth-first, breadth-first) without exposing the tree's internal structure to the client.
* **Composite + Command:** A Composite Command groups multiple command objects into a tree, allowing hierarchical undo/redo operations and macro commands that execute sub-commands in sequence.

These compounds are so common that recognizing the Composite pattern is often the first step toward identifying a larger architectural pattern at work.

# Flashcards

{% include flashcards.html id="design_pattern_structural" %}

# Quiz

{% include quiz.html id="design_pattern_structural" %}

# Sample Code