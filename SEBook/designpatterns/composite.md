---
title: Composite Design Pattern
layout: sebook
---

# Problem

Software often needs to treat individual objects and nested groups of objects uniformly. File systems contain files and directories, drawing tools contain primitive shapes and grouped drawings, and menu systems contain both single menu items and complete submenus. If a client has to distinguish between every leaf and every container, the code quickly fills with special cases and repeated tree traversal logic.

A classic motivating example is a graphics editor: it works with primitives like `Line`, `Rectangle`, and `Text`, but it also supports `Picture` objects that group these primitives (and other pictures) into composite drawings. Clients want to call `draw()` on either a primitive or a picture without checking which kind of object they are holding.

# Context

The Composite pattern applies when the domain is naturally recursive: a whole is built from parts, and some parts can themselves contain further parts. In such systems, clients want one common abstraction for both single objects and containers so they can issue operations like `print()`, `render()`, or `totalPrice()` without checking whether the receiver is a leaf or a branch.

# Intent

Compose objects into tree structures to represent part-whole hierarchies. Composite lets clients treat individual objects and compositions of objects uniformly.

# Solution

The **Composite Pattern** introduces a common `Component` abstraction shared by both atomic elements (`Leaf`) and containers (`Composite`). The composite stores child components and forwards operations recursively to them. Clients program only against the `Component` interface, which keeps the traversal logic inside the structure rather than scattering it across the application.

## Participants

* **Component** (e.g., `Graphic`, `MenuComponent`): declares the interface for objects in the composition; implements default behavior for the interface common to all classes; may declare an interface for accessing and managing children in the transparent variant; optionally defines an interface for accessing a component's parent.
* **Leaf** (e.g., `Rectangle`, `Line`, `Text`, `MenuItem`): represents leaf objects in the composition. A leaf has no children and defines behavior for primitive objects.
* **Composite** (e.g., `Picture`, `Menu`): defines behavior for components having children; stores child components; implements child-related operations, declared either on `Component` or only on the composite type.
* **Client**: manipulates objects in the composition through the `Component` interface.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
abstract class Component {
	+ operation()
	+ add(child: Component)
	+ remove(child: Component)
	+ getChild(i: Integer): Component
}
class Leaf {
	+ operation()
}
class Composite {
	- children: Sequence<Component>
	+ operation()
	+ add(child: Component)
	+ remove(child: Component)
	+ getChild(i: Integer): Component
}
class Client
Leaf --|> Component
Composite --|> Component
Composite "0..1" *--> "*" Component
Client --> Component : treats uniformly >
callout top of text "Component" : Component: one interface for single objects and groups
callout bottom of text "Leaf" : Leaf: an individual object without children
callout bottom of text "Composite" : Composite: holds children and forwards operation() to each
callout top of text "treats uniformly" : Client: does not care whether it holds a leaf or a tree
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
abstract class MenuComponent {
	+ print()
	+ add(component: MenuComponent)
}
class Menu {
	- children: Sequence<MenuComponent>
	+ print()
	+ add(component: MenuComponent)
}
class MenuItem {
	+ print()
}
class Demo {
	+ main()
}
Menu --|> MenuComponent
MenuItem --|> MenuComponent
Menu "0..1" *-- "*" MenuComponent
Demo --> MenuComponent : prints
callout top of text "MenuComponent" : Component: menus and items share print()
callout bottom of text "Menu" : Composite: a menu contains submenus and items
callout bottom of text "MenuItem" : Leaf: a single dish
@enduml'></div>

## Sequence Diagram

This trace isolates the nested dessert-menu branch. In the code below, the root also prints the `Pancakes` item before visiting this branch.

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant demo: Demo
participant allMenus: Menu
participant dessertMenu: Menu
participant item: MenuItem
demo -> allMenus: print()
activate allMenus
allMenus -> dessertMenu: print()
activate dessertMenu
dessertMenu -> item: print()
activate item
deactivate item
deactivate dessertMenu
deactivate allMenus
callout right of text "print()" occurrence 1 : The client makes one call on the root menu
callout right of text "print()" occurrence 2 : Recursion: a menu forwards print() to each child
callout right of text "print()" occurrence 3 : A leaf prints itself, so the recursion stops
@enduml'></div>

# Design Decisions

## Transparent vs. Safe Composite

This is the fundamental design trade-off of the Composite pattern:

* **Transparent composite:** The full child-management interface (`add()`, `remove()`, `getChild()`) is declared on `Component`, so clients can treat leaves and composites identically through a single interface. This maximizes uniformity but means leaves inherit methods that make no sense for them (e.g., `add()` on a `MenuItem`). The contract must specify how leaves handle unsupported calls. The example throws an exception; silently ignoring an attempted insertion would conceal a likely bug. Child queries can legitimately return an empty result for leaves.

* **Safe composite:** Only `Composite` exposes `add()` and `remove()`, preventing these operations on leaves at compile time in a statically typed language. Clients that manage children need a composite reference; they can obtain one during construction rather than necessarily downcasting. Clients that only call shared operations such as `print()` still treat leaves and composites uniformly.

Neither approach is universally better—the choice depends on whether **uniformity** (transparent) or **type safety** (safe) is more important in your context.

## Child Ownership

Choose ownership separately from the recursive interface. The filled diamonds above model exclusive ownership: a component belongs to at most one parent, and deleting an owning composite deletes its still-owned parts. A root has no parent, hence `0..1` at the parent end. If children are shared, use an ordinary association or shared aggregation instead; an open diamond alone does not specify a lifetime policy. The C++ example expresses exclusive ownership with `unique_ptr`. The other snippets assume clients build an acyclic tree without sharing children; they do not enforce that invariant.

## Parent References

Adding a parent reference to `Component` enables upward traversal (e.g., "which menu does this item belong to?") but complicates `add()` and `remove()` operations, which must now maintain bidirectional consistency. The usual place to define the parent reference is in the `Component` class so leaves and composites can inherit it. The invariant to maintain is that all children of a composite have that composite as their parent — the simplest way to enforce this is to set the parent only inside the composite's `add()` and `remove()`.

## Sharing Components

Sharing components is useful for reducing storage requirements, but a component with a single parent reference cannot be shared across multiple composites. One option is to let children store multiple parents; another is to drop parent references altogether and externalize the relevant state, which is the approach taken by the Flyweight pattern.

## Child Storage and Ordering

Several smaller decisions arise once you commit to a Composite design:

* **Where to store the children:** Putting the child collection in the `Component` base class is convenient but pays a per-leaf storage cost for a list that leaves never use. It is only worthwhile when there are relatively few leaves in the structure.
* **Child ordering:** Many domains require an ordering on children (front-to-back rendering, the order of statements in a parse tree, the order of items on a menu). Design `add()`, `remove()`, and traversal carefully when order matters; an explicit Iterator often pays for itself here.
* **Caching:** A composite that is traversed or searched frequently can cache aggregated information about its children (e.g., a bounding box of all child shapes). Any change to a child must invalidate the caches of its ancestors, which is easiest to coordinate when components hold parent references.
* **Choice of data structure:** There is no single right collection — linked lists, arrays, hash tables, even per-child fields are all reasonable depending on access patterns and child count.

# Consequences

* **Defines class hierarchies of primitive and composite objects.** Primitive objects can be composed into more complex objects, which in turn can be composed recursively. Wherever client code uses the common `Component` contract, it can accept either a leaf or a composite. This does not make a composite a subtype of a particular concrete leaf.
* **Makes the client simple.** Clients can treat composite structures and individual objects uniformly and need not write tag-and-case-statement-style logic over the classes that define the composition.
* **Makes it easier to add new kinds of components.** New `Composite` or `Leaf` subclasses work automatically with existing structures and existing client code.
* **Can make your design overly general.** It becomes harder to restrict which components a composite may contain. The unrestricted `add(Component)` interface accepts every component subtype. Domain-specific child restrictions need additional validation or a more restrictive type design.

# Composite in Pattern Compounds

The Composite pattern frequently appears as a building block in larger pattern compounds, because many patterns need to operate on tree structures:

* **Composite + Builder:** The [Builder](/SEBook/designpatterns/builder.html) pattern can construct complex Composite structures step by step. The Builder returns an assembled composite structure and handles node creation and assembly. Kerievsky's *Encapsulate Composite with Builder* uses this step when client code exposes too much construction and validation detail (Kerievsky's 2001 draft, pp. 35–38).
* **Composite + Visitor:** When many distinct operations need to be performed on a Composite structure without modifying its classes, the [Visitor](/SEBook/designpatterns/visitor.html) pattern provides a clean separation of concerns. This is especially useful when new operations are added frequently but new leaf types are rare.
* **Composite + Iterator:** An Iterator can traverse the Composite tree in different orders (depth-first, breadth-first) without exposing the tree's internal structure to the client.
* **Composite + Command:** A [Composite Command](/SEBook/designpatterns/command.html) groups multiple command objects into a tree, allowing hierarchical undo/redo operations and macro commands that execute sub-commands in sequence.

These compounds are so common that recognizing the Composite pattern is often the first step toward identifying a larger architectural pattern at work.

# Code Example

This example uses a transparent composite: both `Menu` and `MenuItem` share `print()` and `add()`, but a leaf rejects `add()`. It implements only the child-management operation needed by the example; `remove()` and `getChild()` in the role diagram are optional extensions, not requirements to add unused methods. Kerievsky makes this same scope decision in *Replace Implicit Tree with Composite* (Kerievsky's 2001 draft, pp. 31–34).

> **Teaching example:** These snippets are intentionally small. They show one reasonable mapping of the pattern roles, not a drop-in architecture. In production, always tailor the pattern to the concrete context: lifecycle, ownership, error handling, concurrency, dependency injection, language idioms, and team conventions.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Composite code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
import java.util.ArrayList;
import java.util.List;

abstract class MenuComponent {
    void add(MenuComponent component) {
        throw new UnsupportedOperationException("leaf cannot contain children");
    }

    abstract void print();
}

final class MenuItem extends MenuComponent {
    private final String name;

    MenuItem(String name) {
        this.name = name;
    }

    void print() {
        System.out.println(name);
    }
}

final class Menu extends MenuComponent {
    private final String name;
    private final List<MenuComponent> children = new ArrayList<>();

    Menu(String name) {
        this.name = name;
    }

    void add(MenuComponent component) {
        children.add(component);
    }

    void print() {
        System.out.println("\n" + name);
        children.forEach(MenuComponent::print);
    }
}

public class Demo {
    public static void main(String[] args) {
        Menu allMenus = new Menu("All Menus");
        Menu dessert = new Menu("Dessert Menu");
        dessert.add(new MenuItem("Apple pie"));
        allMenus.add(new MenuItem("Pancakes"));
        allMenus.add(dessert);
        allMenus.print();
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
#include <utility>
#include <vector>

class MenuComponent {
public:
    virtual ~MenuComponent() = default;
    virtual void add(std::unique_ptr<MenuComponent>) {
        throw std::logic_error("leaf cannot contain children");
    }
    virtual void print() const = 0;
};

class MenuItem : public MenuComponent {
public:
    explicit MenuItem(std::string name) : name_(std::move(name)) {}

    void print() const override {
        std::cout << name_ << "\n";
    }

private:
    std::string name_;
};

class Menu : public MenuComponent {
public:
    explicit Menu(std::string name) : name_(std::move(name)) {}

    void add(std::unique_ptr<MenuComponent> component) override {
        children_.push_back(std::move(component));
    }

    void print() const override {
        std::cout << "\n" << name_ << "\n";
        for (const auto& child : children_) {
            child->print();
        }
    }

private:
    std::string name_;
    std::vector<std::unique_ptr<MenuComponent>> children_;
};

int main() {
    auto allMenus = std::make_unique<Menu>("All Menus");
    auto dessert = std::make_unique<Menu>("Dessert Menu");
    dessert->add(std::make_unique<MenuItem>("Apple pie"));
    allMenus->add(std::make_unique<MenuItem>("Pancakes"));
    allMenus->add(std::move(dessert));
    allMenus->print();
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
from abc import ABC, abstractmethod


class MenuComponent(ABC):
    def add(self, component: "MenuComponent") -> None:
        raise NotImplementedError("leaf cannot contain children")

    @abstractmethod
    def print(self) -> None:
        pass


class MenuItem(MenuComponent):
    def __init__(self, name: str) -> None:
        self.name = name

    def print(self) -> None:
        print(self.name)


class Menu(MenuComponent):
    def __init__(self, name: str) -> None:
        self.name = name
        self.children: list[MenuComponent] = []

    def add(self, component: MenuComponent) -> None:
        self.children.append(component)

    def print(self) -> None:
        print(f"\n{self.name}")
        for child in self.children:
            child.print()


all_menus = Menu("All Menus")
dessert = Menu("Dessert Menu")
dessert.add(MenuItem("Apple pie"))
all_menus.add(MenuItem("Pancakes"))
all_menus.add(dessert)
all_menus.print()
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
abstract class MenuComponent {
  add(component: MenuComponent): void {
    throw new Error("leaf cannot contain children");
  }

  abstract print(): void;
}

class MenuItem extends MenuComponent {
  constructor(private readonly name: string) {
    super();
  }

  print(): void {
    console.log(this.name);
  }
}

class Menu extends MenuComponent {
  private readonly children: MenuComponent[] = [];

  constructor(private readonly name: string) {
    super();
  }

  add(component: MenuComponent): void {
    this.children.push(component);
  }

  print(): void {
    console.log(`\n${this.name}`);
    this.children.forEach((child) => child.print());
  }
}

const allMenus = new Menu("All Menus");
const dessert = new Menu("Dessert Menu");
dessert.add(new MenuItem("Apple pie"));
allMenus.add(new MenuItem("Pancakes"));
allMenus.add(dessert);
allMenus.print();
```
  </div>
</div>

## Flashcards

This shared review covers Adapter, Composite, and Facade. Use it after studying all three chapters.

{% include flashcards.html id="design_pattern_structural" %}

## Quiz

{% include quiz.html id="design_pattern_structural" %}
