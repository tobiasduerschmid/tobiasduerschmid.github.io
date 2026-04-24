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
Composite "1" *--> "*" Component
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
Menu "1" *-- "*" MenuComponent
Waitress --> MenuComponent : traverses
@enduml'></div>

## Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
actor waitress: Waitress
participant allMenus: Menu
participant dessertMenu: Menu
participant item: MenuItem
waitress -> allMenus: print()
activate allMenus
allMenus -> dessertMenu: print()
activate dessertMenu
dessertMenu -> item: print()
activate item
deactivate item
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

# Code Example

This example uses a transparent composite: both `Menu` and `MenuItem` share the same `print()` operation, while only composite menus do real work in `add()`.

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
        throw new UnsupportedOperationException();
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
    virtual void add(std::unique_ptr<MenuComponent> component) {
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

# Flashcards

{% include flashcards.html id="design_pattern_structural" %}

# Quiz

{% include quiz.html id="design_pattern_structural" %}
