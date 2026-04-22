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

## Python Example

```python
from abc import ABC, abstractmethod

# --- 1. Element Hierarchy ---
class Node(ABC):
    @abstractmethod
    def accept(self, visitor):
        pass

class AssignmentNode(Node):
    def accept(self, visitor):
        # Double-dispatch: The element passes its specific type to the visitor
        visitor.visit_assignment_node(self)

class VariableRefNode(Node):
    def accept(self, visitor):
        # Double-dispatch
        visitor.visit_variable_ref_node(self)


# --- 2. Visitor Hierarchy ---
class NodeVisitor(ABC):
    @abstractmethod
    def visit_assignment_node(self, node: AssignmentNode):
        pass

    @abstractmethod
    def visit_variable_ref_node(self, node: VariableRefNode):
        pass

# A ConcreteVisitor that adds new behavior (Type Checking)
class TypeCheckingVisitor(NodeVisitor):
    def visit_assignment_node(self, node: AssignmentNode):
        print("Performing type-check on AssignmentNode")

    def visit_variable_ref_node(self, node: VariableRefNode):
        print("Performing type-check on VariableRefNode")

# Another ConcreteVisitor adding different behavior (Code Generation)
class CodeGeneratingVisitor(NodeVisitor):
    def visit_assignment_node(self, node: AssignmentNode):
        print("Generating machine code for AssignmentNode")

    def visit_variable_ref_node(self, node: VariableRefNode):
        print("Generating machine code for VariableRefNode")


# --- 3. Object Structure / Client ---
if __name__ == "__main__":
    # Stable Object Structure
    abstract_syntax_tree = [AssignmentNode(), VariableRefNode(), AssignmentNode()]

    # We can define and apply new operations without touching the Node classes
    type_checker = TypeCheckingVisitor()
    code_generator = CodeGeneratingVisitor()

    print("--- Running Type Checker ---")
    for node in abstract_syntax_tree:
        node.accept(type_checker)

    print("\n--- Running Code Generator ---")
    for node in abstract_syntax_tree:
        node.accept(code_generator)
```

# Consequences
*   **Adding Operations is Easy:** You can add a new operation over an object structure simply by adding a new visitor class.
*   **Gathers Related Operations:** Related behavior is localized in a single visitor class rather than spread across multiple node classes.
*   **Adding New Elements is Hard:** The element class hierarchy must be stable. Adding a new element type requires modifying the visitor interface and all concrete visitors.
*   **Modern Alternatives:** In modern languages with advanced pattern matching (like Rust, Kotlin, or Java 21+), the visitor pattern is often replaced by sealed classes and exhaustive switch expressions.
