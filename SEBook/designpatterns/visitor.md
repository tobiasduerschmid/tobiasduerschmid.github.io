---
title: Visitor Design Pattern
layout: sebook
---

# Context
Consider a compiler that represents programs as Abstract Syntax Trees (ASTs). The compiler needs to perform many distinct and unrelated operations across this tree, such as type-checking, code generation, and pretty-printing. 

# Problem
Distributing all these diverse operations directly across the node classes of the AST would heavily clutter the structure. 
*   **Pollution of Elements:** The core purpose of an AST node is to represent syntax, not to perform type-checking or code generation. Adding these behaviors pollutes the elements.
*   **Violation of [Open/Closed Principle](/SEBook/designprinciples/solid.html#openclosed-principle-ocp):** Every time a new operation is required (e.g., a new code optimization pass), you have to modify every single node class in the hierarchy.

# Solution
The **Visitor Pattern** represents an operation to be performed on the elements of an object structure. It lets you define a new operation without changing the classes of the elements on which it operates.

It achieves this through a technique called **double-dispatch**. The operation that gets executed depends on *two* types: the type of the Visitor and the type of the Element it visits.

The key participants are:
1.  **Visitor:** Declares a `visit` operation for each class of `ConcreteElement` in the object structure.
2.  **ConcreteVisitor:** Implements the operations declared by the `Visitor`, providing the algorithm and accumulating state as it traverses the structure.
3.  **Element:** Defines an `accept` operation that takes a visitor as an argument.
4.  **ConcreteElement:** Implements the `accept` operation by calling back to the specific `visit` method on the visitor that corresponds to its own class.
5.  **ObjectStructure:** Can enumerate its elements; it may be a [composite](/SEBook/designpatterns/composite.html) or a collection such as a list or a set.

> [!WARNING]
> If the element classes (the object structure) change frequently, this pattern is a poor choice. Adding a new `ConcreteElement` requires adding a corresponding operation to the `Visitor` interface and updating every single `ConcreteVisitor`.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface Visitor {
    + visitConcreteElementA(ConcreteElementA)
    + visitConcreteElementB(ConcreteElementB)
}
class ConcreteVisitor1 {
    + visitConcreteElementA(ConcreteElementA)
    + visitConcreteElementB(ConcreteElementB)
}
class ConcreteVisitor2 {
    + visitConcreteElementA(ConcreteElementA)
    + visitConcreteElementB(ConcreteElementB)
}
interface Element {
    + accept(Visitor)
}
class ConcreteElementA {
    + accept(Visitor)
}
class ConcreteElementB {
    + accept(Visitor)
}
class ObjectStructure

ConcreteVisitor1 ..|> Visitor
ConcreteVisitor2 ..|> Visitor
ConcreteElementA ..|> Element
ConcreteElementB ..|> Element

ObjectStructure o--> Element
Client --> Visitor
Client --> ObjectStructure
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface NodeVisitor {
    + visitAssignment(AssignmentNode)
    + visitVariableRef(VariableRefNode)
}
class TypeCheckingVisitor {
    + visitAssignment(AssignmentNode)
    + visitVariableRef(VariableRefNode)
}
class CodeGeneratingVisitor {
    + visitAssignment(AssignmentNode)
    + visitVariableRef(VariableRefNode)
}

interface Node {
    + accept(NodeVisitor)
}
class AssignmentNode {
    + accept(NodeVisitor)
}
class VariableRefNode {
    + accept(NodeVisitor)
}

TypeCheckingVisitor ..|> NodeVisitor
CodeGeneratingVisitor ..|> NodeVisitor
AssignmentNode ..|> Node
VariableRefNode ..|> Node
@enduml'></div>

## Code Example

This example adds type-checking behavior to a stable AST node hierarchy. Each node accepts a visitor and calls the overload or method that matches its concrete type.

> **Teaching example:** These snippets are intentionally small. They show one reasonable mapping of the pattern roles, not a drop-in architecture. In production, always tailor the pattern to the concrete context: lifecycle, ownership, error handling, concurrency, dependency injection, language idioms, and team conventions.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Visitor code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
import java.util.List;

interface Node {
    void accept(NodeVisitor visitor);
}

final class AssignmentNode implements Node {
    public void accept(NodeVisitor visitor) {
        visitor.visitAssignment(this);
    }
}

final class VariableRefNode implements Node {
    public void accept(NodeVisitor visitor) {
        visitor.visitVariableRef(this);
    }
}

interface NodeVisitor {
    void visitAssignment(AssignmentNode node);
    void visitVariableRef(VariableRefNode node);
}

final class TypeCheckingVisitor implements NodeVisitor {
    public void visitAssignment(AssignmentNode node) {
        System.out.println("Type-check assignment");
    }

    public void visitVariableRef(VariableRefNode node) {
        System.out.println("Type-check variable reference");
    }
}

public class Demo {
    public static void main(String[] args) {
        List<Node> ast = List.of(new AssignmentNode(), new VariableRefNode());
        NodeVisitor typeChecker = new TypeCheckingVisitor();
        ast.forEach(node -> node.accept(typeChecker));
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <iostream>
#include <memory>
#include <vector>

class AssignmentNode;
class VariableRefNode;

struct NodeVisitor {
    virtual ~NodeVisitor() = default;
    virtual void visit(AssignmentNode& node) = 0;
    virtual void visit(VariableRefNode& node) = 0;
};

struct Node {
    virtual ~Node() = default;
    virtual void accept(NodeVisitor& visitor) = 0;
};

class AssignmentNode : public Node {
public:
    void accept(NodeVisitor& visitor) override {
        visitor.visit(*this);
    }
};

class VariableRefNode : public Node {
public:
    void accept(NodeVisitor& visitor) override {
        visitor.visit(*this);
    }
};

class TypeCheckingVisitor : public NodeVisitor {
public:
    void visit(AssignmentNode&) override {
        std::cout << "Type-check assignment\n";
    }

    void visit(VariableRefNode&) override {
        std::cout << "Type-check variable reference\n";
    }
};

int main() {
    std::vector<std::unique_ptr<Node>> ast;
    ast.push_back(std::make_unique<AssignmentNode>());
    ast.push_back(std::make_unique<VariableRefNode>());

    TypeCheckingVisitor typeChecker;
    for (const auto& node : ast) {
        node->accept(typeChecker);
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
from __future__ import annotations

from abc import ABC, abstractmethod


class Node(ABC):
    @abstractmethod
    def accept(self, visitor: NodeVisitor) -> None:
        pass


class NodeVisitor(ABC):
    @abstractmethod
    def visit_assignment(self, node: AssignmentNode) -> None:
        pass

    @abstractmethod
    def visit_variable_ref(self, node: VariableRefNode) -> None:
        pass


class AssignmentNode(Node):
    def accept(self, visitor: NodeVisitor) -> None:
        visitor.visit_assignment(self)


class VariableRefNode(Node):
    def accept(self, visitor: NodeVisitor) -> None:
        visitor.visit_variable_ref(self)


class TypeCheckingVisitor(NodeVisitor):
    def visit_assignment(self, node: AssignmentNode) -> None:
        print("Type-check assignment")

    def visit_variable_ref(self, node: VariableRefNode) -> None:
        print("Type-check variable reference")


ast: list[Node] = [AssignmentNode(), VariableRefNode()]
type_checker = TypeCheckingVisitor()
for node in ast:
    node.accept(type_checker)
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
interface AstNode {
  accept(visitor: NodeVisitor): void;
}

interface NodeVisitor {
  visitAssignment(node: AssignmentNode): void;
  visitVariableRef(node: VariableRefNode): void;
}

class AssignmentNode implements AstNode {
  accept(visitor: NodeVisitor): void {
    visitor.visitAssignment(this);
  }
}

class VariableRefNode implements AstNode {
  accept(visitor: NodeVisitor): void {
    visitor.visitVariableRef(this);
  }
}

class TypeCheckingVisitor implements NodeVisitor {
  visitAssignment(node: AssignmentNode): void {
    console.log("Type-check assignment");
  }

  visitVariableRef(node: VariableRefNode): void {
    console.log("Type-check variable reference");
  }
}

const ast: AstNode[] = [new AssignmentNode(), new VariableRefNode()];
const typeChecker = new TypeCheckingVisitor();
ast.forEach((node) => node.accept(typeChecker));
```
  </div>
</div>

# Consequences
*   **Adding Operations is Easy:** You can add a new operation over an object structure simply by adding a new visitor class.
*   **Gathers Related Operations:** Related behavior is localized in a single visitor class rather than spread across multiple node classes; behavior unrelated to a given operation is not entangled with it.
*   **Adding New Elements is Hard:** The element class hierarchy must be stable. Adding a new element type requires modifying the visitor interface and all concrete visitors. This trade-off — easy to add operations, hard to add types — is the dual of the trade-off in plain object-oriented inheritance, and is known as the **Expression Problem** (Wadler, 1998).
*   **Visiting Across Class Hierarchies:** Unlike a virtual method on `Element`, a visitor can be applied to objects whose classes do not share a common base, as long as they all implement `accept`.
*   **Accumulating State:** Visitors can accumulate state as they traverse the structure (e.g., a symbol table during type checking), avoiding both global variables and extra parameters threaded through every operation.
*   **Breaks Encapsulation:** To do their work, visitors typically need access to the internal state of the elements they visit. This often forces `ConcreteElement` classes to expose state through public accessors that would otherwise be private.
*   **Cyclic Dependency:** The `Visitor` interface depends on every `ConcreteElement` (via the `visit*` overloads), and every `Element` depends on `Visitor` (via `accept`). The **Acyclic Visitor** variant (Martin, 1998) breaks this cycle by giving each element its own narrow visitor interface and using a runtime cast inside `accept`.
*   **Modern Alternatives:** In languages with sealed types and exhaustive pattern matching — such as Scala (`sealed trait` + `match`), Rust (`enum` + `match`), or Java 21+ (sealed interfaces + `switch` pattern matching) — much of the Visitor pattern's machinery is unnecessary. A `switch` over a sealed type achieves the same separation of operations from data and is checked for exhaustiveness by the compiler. (GoF themselves note that languages supporting double or multiple dispatch, such as CLOS, lessen the need for the Visitor pattern.)

# Related Patterns
*   **[Composite](/SEBook/designpatterns/composite.html):** Visitors can be used to apply an operation over an object structure defined by the Composite pattern.
*   **Interpreter:** Visitor may be applied to do the interpretation. Each grammar rule is a `ConcreteElement`, and an interpretation pass is a `ConcreteVisitor`.
*   **Iterator:** Iterators can also walk an object structure and call operations on each element, but they require all elements to share a common parent class. Visitor lifts this restriction and lets the operation differ by element type. The two patterns are often combined: an iterator drives the traversal and calls `accept` on each element.
