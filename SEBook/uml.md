---
title: "UML Unified Modeling Language"
layout: sebook
---

# Unified Modeling Language (UML)

## Why Model?

Before writing a single line of code, software engineers need to communicate their ideas clearly. Consider a team of four developers asked to build "a building management system". Without a shared model, each person imagines something different---one pictures a skyscraper, another a shopping mall, a third a house. A **model** gives the team a shared blueprint to align on, just like an architectural drawing does for a construction crew.

Modeling serves two critical purposes in software engineering:

**1. Communication.** Models provide a common, simple, graphical representation that allows developers, architects, and stakeholders to discuss the workings of the software. When everyone reads the same diagram, the team converges on the same understanding.

**2. Early Problem Detection.** Fixing bugs found during design costs a fraction of fixing bugs found during testing or maintenance. Studies have suggested that the cost to fix a defect grows substantially from the requirements phase to the maintenance phase — common estimates range from 10× to 100× depending on the project and phase (Boehm, *Software Engineering Economics*, 1981; McConnell, *Code Complete*, 2nd ed., 2004). The empirical strength of the 100× claim is debated (see Bossavit, *The Leprechauns of Software Engineering*, 2015), but the qualitative principle — earlier defects are cheaper to fix — is widely accepted. Modeling and analysis shifts the discovery of problems earlier in the lifecycle, where they are cheaper to fix.

## What Is a Model?

A model describes a system at a **high level of abstraction**. Models are abstractions of a real-world artifact (software or otherwise) produced through an *abstraction function* that preserves the essential properties while discarding irrelevant detail. Models can be:

- **Descriptive:** Documenting an existing system (e.g., reverse-engineering a legacy codebase).
- **Prescriptive:** Specifying a system that is yet to be built (e.g., designing a new feature).

## A Brief History of UML

In the 1980s, the rise of Object-Oriented Programming spawned dozens of competing modeling notations. By the mid-1990s, more than 50 OO modeling methods had been proposed. The three leading notation designers — Grady Booch (*Booch method*), Jim Rumbaugh (*OMT — Object Modeling Technique*), and Ivar Jacobson (*OOSE — Object-Oriented Software Engineering*) — converged at Rational Software and combined their approaches. This convergence, standardized by the Object Management Group (OMG) in 1997, produced **UML 1.x** (UML 1.1 was the first OMG-adopted version). UML 2.0 was adopted by the OMG in 2003 and finalized in 2005 (see Rumbaugh, Jacobson & Booch, *The Unified Modeling Language Reference Manual*, 2nd ed., 2004). The current version, **UML 2.5.1** (2017), is maintained by the OMG.

UML is a large language — the current UML 2.5.1 specification spans nearly 800 pages — but in practice only a small fraction of its notation is widely used. Martin Fowler (*UML Distilled*) advocates learning the "mythical 20 percent of UML that helps you do 80 percent of your work", and recommends *sketching-level* UML over exhaustive coverage of every symbol. This textbook follows that philosophy.

### Modeling Guidelines

- **Purpose first.** Before drawing, decide *why* the diagram exists: requirements gathering, analysis, design, or documentation. Each level shows different detail (Ambler, *The Elements of UML 2.0 Style*, G87–G88).
- **Nearly everything in UML is optional** — you choose how much detail to show.
- **Models are rarely complete.** They capture only the aspects relevant to the question at hand (Fowler's "Depict Models Simply" principle).
- **UML is open to interpretation** and designed to be extended via profiles and stereotypes.
- **7±2 rule:** Keep a single diagram to roughly 9 elements or fewer. If a diagram grows past that, split it — the cognitive load of reading it exceeds working memory.

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

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-caption="UML class diagram showing an online-store domain — Customer (with VIP and Guest subtypes) places Orders that realize a Billable interface and aggregate LineItems referencing Products." data-uml-spec='@startuml
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
Customer "1" -- "*" Order
Order *-- "1..*" LineItem
LineItem "*" -- "1" Product
@enduml'></div>

### Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-caption="UML sequence diagram showing a GET /book/42 request flowing from Client to LibraryServer to Database, with an alt fragment branching on whether the book was found." data-uml-spec='@startuml
participant client: Client
participant server: LibraryServer
participant db: Database
client -> server: GET /book/42
activate server
server -> db: queryBook(42)
activate db
db --> server: bookData
deactivate db
alt [book found]
  server --> client: 200 OK, book
else [not found]
  server --> client: 404 Not Found
end
deactivate server
@enduml'></div>

### State Machine Diagram

<div class="uml-class-diagram-container" data-uml-type="state" data-uml-caption="UML state machine diagram of an Order's lifecycle — Created → Paid → Shipped → Delivered, with side transitions to Cancelled and Refunded." data-uml-spec='@startuml
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

<div class="uml-class-diagram-container" data-uml-type="usecase" data-uml-caption="UML use case diagram of an Online Store — Customer can Place Order or Cancel Order; Admin can Manage Order and Update Products." data-uml-spec='@startuml
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
