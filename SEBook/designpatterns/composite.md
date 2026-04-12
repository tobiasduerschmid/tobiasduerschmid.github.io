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
Composite "1" *-- "0..*" Component
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

In a **transparent** composite, the full child-management interface is declared on `Component`, so clients can treat leaves and composites the same way. In a **safe** composite, only `Composite` exposes `add()` and `remove()`, which prevents nonsensical operations on leaves but slightly reduces uniformity.

## Child Ownership

If child objects cannot exist independently of their parent, use composition semantics and let the composite own the child lifetime. If children may be shared across multiple structures, model a weaker association instead.

# Sample Code