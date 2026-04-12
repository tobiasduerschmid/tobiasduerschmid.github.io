---
title: UML
layout: sebook
---

# Unified Modeling Language (UML)

## Why Model?

Before writing a single line of code, software engineers need to communicate their ideas clearly. Consider a team of four developers asked to build "a building management system." Without a shared model, each person imagines something different---one pictures a skyscraper, another a shopping mall, a third a house. A **model** gives the team a shared blueprint to align on, just like an architectural drawing does for a construction crew.

Modeling serves two critical purposes in software engineering:

**1. Communication.** Models provide a common, simple, graphical representation that allows developers, architects, and stakeholders to discuss the workings of the software. When everyone reads the same diagram, the team converges on the same understanding.

**2. Early Problem Detection.** Bugs found during design cost a fraction of bugs found during testing or maintenance. Studies have shown that the cost to fix a defect grows roughly 100x from the requirements phase to the maintenance phase. Modeling and analysis shifts the discovery of problems earlier in the lifecycle, where they are cheaper to fix.

## What Is a Model?

A model describes a system at a **high level of abstraction**. Models are abstractions of a real-world artifact (software or otherwise) produced through an *abstraction function* that preserves the essential properties while discarding irrelevant detail. Models can be:

- **Descriptive:** Documenting an existing system (e.g., reverse-engineering a legacy codebase).
- **Prescriptive:** Specifying a system that is yet to be built (e.g., designing a new feature).

## A Brief History of UML

In the 1980s, the rise of Object-Oriented Programming spawned dozens of competing modeling notations. By the early 1990s, there were over 50 OO modeling languages. In the 1990s, the three leading notation designers---Grady Booch (BOOCH), Jim Rumbaugh (OML: Object Modeling Language), and Ivar Jacobson (OOSE: Object Oriented Software Engineering)---decided to combine their approaches. Their natural convergence, combined with an industry push to standardize, produced the **Unified Modeling Language (UML)**, now maintained by the Object Management Group (OMG).

UML is an enormous language (796 pages of specification), with many loosely related diagram types under one roof. But it provides a **common, simple, graphical** representation of software design and implementation, and it remains the most commonly used modeling language in practice.

### Modeling Guidelines

- Nearly everything in UML is optional---you choose how much detail to show.
- Models are rarely complete. They capture the aspects relevant to the question you are trying to answer.
- UML is "open to interpretation" and designed to be extended.

## UML Diagram Types

UML diagrams fall into two broad categories:

### Static Modeling (Structure)

Static diagrams capture the fixed, code-level relationships in the system:

- **[Class Diagrams](/SEBook/uml_class_diagram.html)** (widely used) --- Show classes, their attributes, operations, and relationships.
- Package Diagrams --- Group related classes into packages.
- **[Component Diagrams](/SEBook/uml_component_diagram.html)** (widely used) --- Show high-level components and their interfaces.
- Deployment Diagrams --- Show the physical deployment of software onto hardware.

### Behavioral Modeling (Dynamic)

Behavioral diagrams capture the dynamic execution of a system:

- **[Use Case Diagrams](/SEBook/uml_use_case_diagram.html)** (widely used) --- Capture requirements from the user's perspective.
- **[Sequence Diagrams](/SEBook/uml_sequence_diagram.html)** (widely used) --- Show time-based message exchange between objects.
- **[State Machine Diagrams](/SEBook/uml_state_diagram.html)** (widely used) --- Model an object's lifecycle through state transitions.
- Activity Diagrams (widely used) --- Model workflows and concurrent processes.
- Communication Diagrams --- Show the same information as sequence diagrams, organized by object links rather than time.

In this textbook, we focus in depth on the five most widely used diagram types: **Use Case Diagrams**, **Class Diagrams**, **Sequence Diagrams**, **State Machine Diagrams**, and **Component Diagrams**.

---

## Quick Preview

Here is a taste of each diagram type. Each is covered in detail in its own chapter.

### Class Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface Billable {
  + processPayment(): bool
}
class Customer {
  - id: int
  - name: String
  + placeOrder(): void
}
class VIP
class Guest
class Order {
  - date: Date
  - status: String
  + calcTotal(): float
}
class LineItem {
  - quantity: int
}
class Product {
  - price: float
  - name: String
}
VIP --|> Customer
Guest --|> Customer
Order ..|> Billable
Customer "1" -- "0..*" Order
Order *-- "1..*" LineItem
LineItem "0..*" -- "1" Product
@enduml'></div>

### Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant client: Client
participant server: LibraryServer
participant db: Database
client -> server: GET /book/42
activate server
server -> db: queryBook(42)
db --> server: bookData
alt [book found]
  server --> client: 200 OK, book
else [not found]
  server --> client: 404 Not Found
end
deactivate server
@enduml'></div>

### State Machine Diagram

<div class="uml-class-diagram-container" data-uml-type="state" data-uml-spec='@startuml
[*] --> Created : Order Placed by Customer
Created --> Paid : payment_received
Paid --> Shipped : item_dispatched
Shipped --> Delivered : delivery_confirmed
Created --> Cancelled : customer_cancels / payment_timeout
Paid --> Refunded : return_initiated
Delivered --> [*]
Cancelled --> [*]
Refunded --> [*]
@enduml'></div>

### Use Case Diagram

<div class="uml-class-diagram-container" data-uml-type="usecase" data-uml-spec='@startuml
actor Customer
actor Admin
usecase "Place Order" as UC1
usecase "Cancel Order" as UC2
usecase "Manage Order" as UC3
usecase "Update Products" as UC4
rectangle "Online Store" {
  UC1
  UC2
  UC3
  UC4
}
Customer -- UC1
Customer -- UC2
Admin -- UC3
Admin -- UC4
@enduml'></div>
