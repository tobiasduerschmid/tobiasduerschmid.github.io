---
title: "UML Use Case Diagrams"
layout: sebook
---

# UML Use Case Diagrams

## Learning Objectives

By the end of this chapter, you will be able to:

1. **Identify** the core elements of a use case diagram: actors, use cases, system boundaries, and associations.
2. **Differentiate** between include, extend, and generalization relationships between use cases.
3. **Translate** a written description of system requirements into a use case diagram.
4. **Evaluate** when use case diagrams are appropriate versus other UML diagram types.

---

## 1. Introduction: Requirements from the User's Perspective

Before diving into the internal design of a system (class diagrams, sequence diagrams), we need to answer a fundamental question: **What should the system do?** Use case diagrams capture the requirements of a system **from the user's perspective**. They show the functionality a system must provide and which types of users interact with each piece of functionality.

A *use case* refers to a particular piece of functionality that the system must provide to a user---similar to a user story. Use cases are at a **higher level of abstraction** than other UML elements. While class diagrams model the code structure and sequence diagrams model object interactions, use case diagrams model the system's goals from the outside looking in.

> **Concept Check (Generation):** Before reading further, try to list 4-5 things a user might want to do with an online bookstore. What types of users might there be? Write your answers down, then compare them to the examples below.

---

## 2. Core Elements

### 2.1 Actors

An **actor** represents a role that a user takes when interacting with the system. Actors are drawn as stick figures with their role name below.

Key points about actors:
- An actor is a **role**, not a specific person. One person can play multiple roles (e.g., a university professor might be both an "Instructor" and a "Student" in a course system).
- A single user may be represented by **multiple actors** if they interact with different parts of the system in different capacities.
- Actors are always **external** to the system---they interact with it but are not part of it.

### 2.2 Use Cases

A **use case** represents a specific goal or piece of functionality the system provides. Use cases are drawn as **ovals (ellipses)** containing the use case name.

- Use case names should describe a goal using a **verb phrase** (e.g., "Place Order", not "Order" or "OrderSystem").
- There will be one or more use cases per kind of actor. It is common for any reasonable system to have many use cases.

### 2.3 System Boundary

The **system boundary** is a rectangle drawn around the use cases, representing the scope of the system. The system name appears at the top of the rectangle. Actors are placed **outside** the boundary, and use cases are placed **inside**.

### 2.4 Associations

An **association** is a line drawn from an actor to a use case, indicating that the actor participates in that use case.

### Putting the Basics Together

Here is a use case diagram for an automatic train system (an unmanned people-mover like those found in airports):

<div class="uml-class-diagram-container" data-uml-type="usecase" data-uml-spec='@startuml
actor Passenger
actor Technician
usecase "Ride" as UC1
usecase "Repair" as UC2
rectangle "Train System" {
  UC1
  UC2
}
Passenger -- UC1
Technician -- UC2
@enduml'></div>

Reading this diagram: A **Passenger** can **Ride** the train, and a **Technician** can **Repair** the train. Both are roles (actors) external to the system.

---

## 3. Use Case Descriptions

A use case diagram shows *what* functionality exists, but not *how* it works. To capture the details, each use case should have a written **use case description** that includes:

- **Name:** A concise verb phrase (e.g., "Normal Train Ride").
- **Actors:** Which actors participate (e.g., Passenger).
- **Entry Condition:** What must be true before this use case begins (e.g., Passenger is at station).
- **Exit Condition:** What is true when the use case ends (e.g., Passenger has left the station).
- **Event Flow:** A numbered list of steps describing the interaction.

**Example: Normal Train Ride**

| Field | Value |
|-------|-------|
| **Name** | Normal Train Ride |
| **Actors** | Passenger |
| **Entry Condition** | Passenger is at station |
| **Exit Condition** | Passenger has left the station |

**Event Flow:**
1. Passenger arrives and presses the request button.
2. Train arrives and stops at the platform.
3. Doors open.
4. Passenger steps into the train.
5. Doors close.
6. Passenger presses the request button for their final stop.
7. Doors open at the final stop.
8. Passenger exits the train.

> **Concept Check (Self-Explanation):** Look at the event flow above. What would a *non-functional* requirement for this system look like? (Hint: Think about timing, safety, or capacity.) Non-functional requirements are not captured in use case diagrams---they are typically captured as Quality Attribute Scenarios.

---

## 4. Relationships Between Use Cases

Use cases rarely exist in isolation. UML defines three types of relationships between use cases: **inclusion**, **extension**, and **generalization**. Each is drawn as a dashed or solid arrow between use cases.

**Notation Rule:** For include and extend arrows, the arrows are **dashed** and point in the **reading direction** of the verb. The relationship label is written in **double angle brackets** (guillemets) and uses the **base form** of the verb (e.g., `<<include>>`, not `<<includes>>`).

### 4.1 Inclusion (`<<include>>`)

A use case can **include** the behavior of another use case. This means the included behavior **always** occurs as part of the including use case. Think of it as mandatory sub-behavior that has been factored out because multiple use cases share it.

<div class="uml-class-diagram-container" data-uml-type="usecase" data-uml-spec='@startuml
actor Customer
usecase "Purchase Item" as UC1
usecase "Track Packages" as UC2
usecase "Login" as UC3
rectangle "E-Commerce" {
  UC1
  UC2
  UC3
}
Customer -- UC1
Customer -- UC2
UC1 ..> UC3 : <<include>>
UC2 ..> UC3 : <<include>>
@enduml'></div>

Reading this diagram: Whenever a customer **Purchases an Item**, they **always** Login. Whenever they **Track Packages**, they also **always** Login. The Login behavior is shared, so it is factored out into its own use case and included by both.

**Key insight:** The arrow points **from the including use case to the included use case** (from "Purchase Item" to "Login").

### 4.2 Extension (`<<extend>>`)

A use case extension encapsulates a **distinct flow of events** that is **not** part of the normal or basic flow but **may optionally** extend an existing use case. Think of it as an optional, exceptional, or conditional behavior.

<div class="uml-class-diagram-container" data-uml-type="usecase" data-uml-spec='@startuml
actor Customer
usecase "Purchase Item" as UC1
usecase "Log Debug Info" as UC2
rectangle "E-Commerce" {
  UC1
  UC2
}
Customer -- UC1
UC2 ..> UC1 : <<extend>>
@enduml'></div>

Reading this diagram: When a customer purchases an item, debug info **can** (optionally) be logged in some cases. The extension is not part of the normal flow.

**Key insight:** The arrow points **from the extending use case to the base use case** (from "Log Debug Info" to "Purchase Item"). This is the opposite direction from `<<include>>`.

### 4.3 Generalization

Just like class generalization, a **specialized use case** can replace or enhance the behavior of a generalized use case. Generalization uses a **solid line with a hollow triangle arrowhead** pointing to the generalized (parent) use case.

<div class="uml-class-diagram-container" data-uml-type="usecase" data-uml-spec='@startuml
usecase "Synchronize Data" as UC1
usecase "Synchronize Wirelessly" as UC2
usecase "Synchronize Serially" as UC3
rectangle "Sync System" {
  UC1
  UC2
  UC3
}
UC2 --|> UC1
UC3 --|> UC1
@enduml'></div>

Reading this diagram: "Synchronize Wirelessly" and "Synchronize Serially" are both specialized versions of "Synchronize Data." Either can be used wherever the general "Synchronize Data" use case is expected.

> **Concept Check (Retrieval Practice):** Without looking at the diagrams above, answer: Which direction does the `<<include>>` arrow point? Which direction does the `<<extend>>` arrow point? What arrowhead style does generalization use?
>
> <details>
> <summary><i>Reveal Answer</i></summary>
> <code>&lt;&lt;include&gt;&gt;</code> points from the <b>including</b> use case to the <b>included</b> use case. <code>&lt;&lt;extend&gt;&gt;</code> points from the <b>extending</b> use case to the <b>base</b> use case. Generalization uses a <b>solid line with a hollow triangle</b>.
> </details>

---

## 5. Include vs. Extend: A Comparison

Students often confuse `<<include>>` and `<<extend>>`. Here is a direct comparison:

| Feature | `<<include>>` | `<<extend>>` |
|---------|--------------|-------------|
| **When it happens** | **Always** --- the included behavior is mandatory | **Sometimes** --- the extending behavior is optional/conditional |
| **Arrow direction** | From including use case **to** included use case | From extending use case **to** base use case |
| **Analogy** | Like a function call that always executes | Like an optional plugin or hook |
| **Example** | "Purchase Item" always includes "Login" | "Purchase Item" may be extended by "Apply Coupon" |

---

## 6. Putting It All Together: Library System

Let's read a complete use case diagram that combines all the elements we have learned.

<div class="uml-class-diagram-container" data-uml-type="usecase" data-uml-spec='@startuml
actor Customer
usecase "Loan Book" as UC1
usecase "Borrow Book" as UC2
usecase "Check Identity" as UC3
rectangle "My Library" {
  UC1
  UC2
  UC3
}
Customer -- UC1
Customer -- UC2
UC1 ..> UC3 : <<include>>
UC2 ..> UC3 : <<include>>
@enduml'></div>

### System Walkthrough

1. **Actors:** There is one actor, **Customer**, who interacts with the library system.
2. **Use Cases:** The system provides three pieces of functionality: Loan Book, Borrow Book, and Check Identity.
3. **Associations:** The Customer can Loan a Book or Borrow a Book.
4. **Inclusion:** Both Loan Book and Borrow Book **always** include checking the customer's identity. This shared behavior is factored out rather than duplicated.

> **Think-Pair-Share:** In English, describe what this use case diagram says. What would happen if we added an `<<extend>>` relationship from a new use case "Charge Late Fee" to "Loan Book"?

---

## 7. Active Recall Challenge

Grab a blank piece of paper. Without looking at this chapter, try to draw the use case diagram for the following scenario:

1. A **Student** can **Enroll in Course** and **View Grades**.
2. A **Professor** can **Create Course** and **Submit Grades**.
3. Both Enroll in Course and Create Course always include **Authenticate** (login).
4. View Grades can optionally be extended by **Export Transcript**.

After drawing, review your diagram against the rules in sections 2-4. Check: Are your arrows pointing in the correct direction? Did you use dashed lines for include/extend?

---

## 8. Interactive Practice

Test your knowledge with these retrieval practice exercises.

### Knowledge Quiz
{% include quiz.html id="uml_use_case_diagram_examples" %}

### Retrieval Flashcards
{% include flashcards.html id="uml_use_case_diagram_examples" %}

*Pedagogical Tip: If you find these challenging, it's a good sign! Effortful retrieval is exactly what builds durable mental models. Try coming back to these tomorrow to benefit from [spacing and interleaving](/blog/evidence-based-study-tips-for-college-students/).*
