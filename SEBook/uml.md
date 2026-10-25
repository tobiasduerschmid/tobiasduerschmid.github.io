---
title: "UML Unified Modeling Language"
layout: sebook
---

<link rel="stylesheet" href="/css/song-video.css">
<link rel="stylesheet" href="/css/print-light.css">

**Start with the song.** *Draw It Out While It’s Cheap to Change* is a five-minute music video about why teams model before they code, and how to read the four diagrams in this chapter and the next ones. It starts with an early design choice that becomes a load-bearing wall, and four teammates who picture four different buildings until one clear drawing aligns them. Then it reads each diagram part by part: the Class Diagram's compartments, visibility, abstract classes, generalization, interfaces, association, aggregation, and composition; the Sequence Diagram's lifelines, synchronous and asynchronous messages, and the `alt`, `opt`, and `loop` fragments; the State Machine Diagram's states, events, guards, and actions; and the Component Diagram's provided and required interfaces. The chorus asks which diagram answers which question. It ends with a seven-question pop quiz, sung as call and response: think of your answer before the crowd shouts it, or turn on the player's quiz pauses to stop before each answer. Captions are on by default.

Before you press play, predict: a `ReadingList` *owns* its entries (composition), and each entry *references* a `Book`. You delete the list. Which objects disappear?

{% include song-video.html song=site.data.songs.draw_it_out id="uml-song" %}

# Unified Modeling Language (UML)

## Why Model?

Before writing a single line of code, software engineers need to communicate their ideas clearly. Consider a team of four developers asked to build "a building management system". Without a shared model, each person imagines something different---one pictures a skyscraper, another a shopping mall, a third a house. A **model** gives the team a shared blueprint to align on, just like an architectural drawing does for a construction crew.

Modeling serves two critical purposes in software engineering:

**1. Communication.** Models provide a common, simple, graphical representation that allows developers, architects, and stakeholders to discuss the workings of the software. When everyone reads the same diagram, the team converges on the same understanding.

**2. Early Problem Detection.** Fixing bugs found during design costs a fraction of fixing bugs found during testing or maintenance. Studies have suggested that the cost to fix a defect grows substantially from the requirements phase to the maintenance phase — common estimates range from 10× to 100× depending on the project and phase {% cite Boehm1981 McConnell2004 %}. The empirical strength of the 100× claim is debated {% cite Bossavit2017 %}, but the qualitative principle — earlier defects are cheaper to fix — is widely accepted. Modeling and analysis shifts the discovery of problems earlier in the lifecycle, where they are cheaper to fix.

## What Is a Model?

A model describes a system at a **high level of abstraction**. Models are abstractions of a real-world artifact (software or otherwise) produced through an *abstraction function* that preserves the essential properties while discarding irrelevant detail. Models can be:

- **Descriptive:** Documenting an existing system (e.g., reverse-engineering a legacy codebase).
- **Prescriptive:** Specifying a system that is yet to be built (e.g., designing a new feature).

## A Brief History of UML

In the 1980s, the rise of Object-Oriented Programming spawned dozens of competing modeling notations. By the mid-1990s, more than 50 OO modeling methods had been proposed. The three leading notation designers — Grady Booch (*Booch method*), Jim Rumbaugh (*OMT — Object Modeling Technique*), and Ivar Jacobson (*OOSE — Object-Oriented Software Engineering*) — converged at Rational Software and combined their approaches. This convergence, standardized by the Object Management Group (OMG) in 1997, produced **UML 1.x** (UML 1.1 was the first OMG-adopted version). UML 2.0 was adopted by the OMG in 2003 and finalized in 2005 {% cite Rumbaugh2004 %}. The current version, **UML 2.5.1** (2017), is maintained by the OMG {% cite OMG2017UML %}.

UML is a large language — the current UML 2.5.1 specification spans nearly 800 pages — but in practice only a small fraction of its notation is widely used. Martin Fowler advocates learning the "mythical 20 percent of UML that helps you do 80 percent of your work", and recommends *sketching-level* UML over exhaustive coverage of every symbol {% cite Fowler2003 %}. This textbook follows that philosophy.

### Modeling Guidelines

- **Purpose first.** Before drawing, decide *why* the diagram exists: requirements gathering, analysis, design, or documentation. Each level shows different detail (guidelines G87–G88) {% cite Ambler2005 %}.
- **Nearly everything in UML is optional** — you choose how much detail to show.
- **Models are rarely complete.** They capture only the aspects relevant to the question at hand (Ambler's "Depict Models Simply" practice) {% cite Ambler2005 %}.
- **UML is open to interpretation** and designed to be extended via profiles and stereotypes.
- **7±2 rule:** Keep a single diagram to roughly 9 elements or fewer. If a diagram grows past that, split it — the cognitive load of reading it exceeds working memory.

## UML Diagram Types

UML diagrams fall into two broad categories:

### Static Modeling (Structure)

Static diagrams capture the fixed, code-level relationships in the system:

- **[Class Diagrams](/SEBook/uml_class_diagram.html)** --- Show classes, their attributes, operations, and relationships.
- Package Diagrams --- Group related classes into packages.
- **[Component Diagrams](/SEBook/uml_component_diagram.html)** --- Show high-level components and their interfaces.
- Deployment Diagrams --- Show the physical deployment of software onto hardware.

### Behavioral Modeling (Dynamic)

Behavioral diagrams capture the dynamic execution of a system:

- **[Use Case Diagrams](/SEBook/uml_use_case_diagram.html)** --- Capture requirements from the user's perspective.
- **[Sequence Diagrams](/SEBook/uml_sequence_diagram.html)** --- Show time-based message exchange between objects.
- **[State Machine Diagrams](/SEBook/uml_state_diagram.html)** --- Model an object's lifecycle through state transitions.
- Activity Diagrams --- Model workflows and concurrent processes.
- Communication Diagrams --- Show the same information as sequence diagrams, organized by object links rather than time.

In this textbook, we focus in depth on the five most widely used diagram types: **Use Case Diagrams**, **Class Diagrams**, **Sequence Diagrams**, **State Machine Diagrams**, and **Component Diagrams**.

---

## Quick Preview

Here is a taste of each diagram type. Each is covered in detail in its own chapter.

### Class Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface Billable {
  + processPayment(): Boolean
}
class Customer {
  - id: Integer
  - name: String
  + placeOrder()
}
class VIP
class Guest
class Order {
  - date: Date
  - status: String
  + calcTotal(): Real
}
class LineItem {
  - quantity: Integer
}
class Product {
  - price: Real
  - name: String
}
VIP --|> Customer
Guest --|> Customer
Order ..|> Billable
Customer "1" -- "*" Order
Order *-- "1..*" LineItem
LineItem "*" -- "1" Product
callout top of text "«interface»" : Interface: a contract of public operations
callout right of text "Customer" : Class: shared structure and behavior
callout right of text "-price: Real" : Attributes: values each object stores
callout left of text "+calcTotal(): Real" : Operations: behavior that can be invoked
callout left of shape polygon occurrence 2 : Realization: fulfills the interface contract
callout right of shape polygon occurrence 1 : Generalization: also a kind of the superclass
callout right of edge 3 middle : Association: a type of link between objects
callout left of text "*" : Multiplicity *: zero or more
callout top of text "1" : Multiplicity 1: exactly one
callout left of shape polygon occurrence 3 : Composition: exclusive owner; parts die with it
callout right of text "1..*" : Multiplicity 1..*: at least one
@enduml'></div>

### Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
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
callout top of text "client: Client" : Lifeline header: name, then type
callout right of edge 1 end : Synchronous call: the sender waits for completion
callout left of text "bookData" : Reply: returns control and any results
callout right of text "ALT" : Alt: at most one guarded branch runs
callout left of text "[book found]" : Guard: must be true to choose this branch
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
callout left of edge 1 start : Initial pseudostate: execution starts here and moves on
callout right of text "Created" : State: waiting, doing work, or meeting a condition
callout right of text "payment_received" : Trigger: an event that may fire this transition
callout left of text "customer_cancels / payment_timeout" : Transition label: event, then the effect after /
callout right of edge 7 end : Final state: this region has completed
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
callout left of text "Customer" : Actor: an outside role, played by a user or system
callout right of text "Place Order" : Use case: valued behavior the system performs
callout top of text "Online Store" : System boundary: the subject of these use cases
callout bottom of edge 1 middle : Association: this actor participates in the use case
@enduml'></div>
