---
title: Visitor Design Pattern
layout: sebook
---

# Context
Consider a compiler that represents programs as Abstract Syntax Trees (ASTs). The compiler needs to perform many distinct and unrelated operations across this tree, such as type-checking, code generation, and pretty-printing. 

# Problem
Distributing all these diverse operations directly across the node classes of the AST would heavily clutter the structure. 
*   **Pollution of Elements:** The core purpose of an AST node is to represent syntax, not to perform type-checking or code generation. Adding these behaviors pollutes the elements.
*   **Violation of Open/Closed Principle:** Every time a new operation is required (e.g., a new code optimization pass), you have to modify every single node class in the hierarchy.

# Solution
The **Visitor Pattern** represents an operation to be performed on the elements of an object structure. It lets you define a new operation without changing the classes of the elements on which it operates.

It achieves this through a technique called **double-dispatch**. The operation that gets executed depends on *two* types: the type of the Visitor and the type of the Element it visits.

The key participants are:
1.  **Visitor:** Declares a `visit` operation for each class of `ConcreteElement` in the object structure.
2.  **ConcreteVisitor:** Implements the operations declared by the `Visitor`, providing the algorithm and accumulating state as it traverses the structure.
3.  **Element:** Defines an `accept` operation that takes a visitor as an argument.
4.  **ConcreteElement:** Implements the `accept` operation by calling back to the specific `visit` method on the visitor that corresponds to its own class.
5.  **ObjectStructure:** A composite or collection that can enumerate its elements.

> [!WARNING]
> If the element classes (the object structure) change frequently, this pattern is a poor choice. Adding a new `ConcreteElement` requires adding a corresponding operation to the `Visitor` interface and updating every single `ConcreteVisitor`.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface Visitor {
    + VisitElementA(ElementA)
    + VisitElementB(ElementB)
}
class ConcreteVisitor1 {
    + VisitElementA(ElementA)
    + VisitElementB(ElementB)
}
class ConcreteVisitor2 {
    + VisitElementA(ElementA)
    + VisitElementB(ElementB)
}
interface Element {
    + Accept(Visitor)
}
class ElementA {
    + Accept(Visitor)
}
class ElementB {
    + Accept(Visitor)
}

ConcreteVisitor1 ..|> Visitor
ConcreteVisitor2 ..|> Visitor
ElementA ..|> Element
ElementB ..|> Element

Client --> Visitor
Client --> Element
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface NodeVisitor {
    + visit_assignment_node(AssignmentNode)
    + visit_variable_ref_node(VariableRefNode)
}
class TypeCheckingVisitor {
    + visit_assignment_node(AssignmentNode)
    + visit_variable_ref_node(VariableRefNode)
}
class CodeGeneratingVisitor {
    + visit_assignment_node(AssignmentNode)
    + visit_variable_ref_node(VariableRefNode)
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
*   **Gathers Related Operations:** Related behavior is localized in a single visitor class rather than spread across multiple node classes.
*   **Adding New Elements is Hard:** The element class hierarchy must be stable. Adding a new element type requires modifying the visitor interface and all concrete visitors.
*   **Modern Alternatives:** In modern languages with advanced pattern matching (like Rust, Kotlin, or Java 21+), the visitor pattern is often replaced by sealed classes and exhaustive switch expressions.
