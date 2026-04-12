---
title: "UML Component Diagrams"
layout: sebook
---

<div class="uml-class-diagram-container" data-uml-type="component" data-uml-spec='@startuml
component WebApp {
  portout "api" as wa_out
}
component APIGateway {
  portin "http" as gw_in
  portout "auth" as gw_auth
  portout "data" as gw_data
}
component AuthService {
  portin "verify" as auth_in
}
component DataService {
  portin "query" as ds_in
  portout "db" as ds_out
}
component Database {
  portin "sql" as db_in
}
wa_out --> gw_in : HTTPS
gw_auth --> auth_in : gRPC
gw_data --> ds_in : gRPC
ds_out --> db_in : SQL
@enduml'></div>

# UML Component Diagrams

## Learning Objectives

By the end of this chapter, you will be able to:

1. **Identify** the core elements of a component diagram: components, interfaces, ports, and connectors.
2. **Differentiate** between provided interfaces (lollipop) and required interfaces (socket).
3. **Model** a system's high-level architecture using component diagrams with appropriate connectors.
4. **Evaluate** when to use component diagrams versus class diagrams or deployment diagrams.

---

## 1. Introduction: Zooming Out from Code

So far, we have worked at the level of individual classes (class diagrams) and object interactions (sequence diagrams). But real software systems are made up of larger building blocks---services, libraries, modules, and subsystems---that are assembled together. How do you show that your system has a web frontend that talks to an API gateway, which in turn connects to authentication and data services?

This is the role of **UML Component Diagrams**. They operate at a **higher level of abstraction** than class diagrams, showing the major deployable units of a system and how they connect through well-defined interfaces.

| Diagram Type | Level of Abstraction | Shows |
|-------------|---------------------|-------|
| **Class Diagram** | Low (code-level) | Classes, attributes, methods, inheritance |
| **Component Diagram** | High (architecture-level) | Deployable modules, provided/required interfaces, assembly |
| **Deployment Diagram** | Physical (infrastructure) | Hardware nodes, artifacts, network topology |

> **Concept Check (Prior Knowledge Activation):** Think about a web application you have used or built. What are the major "pieces" of the system? (e.g., frontend, backend, database, authentication service). These pieces are what component diagrams model.

---

## 2. Core Elements

### 2.1 Components

A **component** is a modular, deployable, and replaceable part of a system that encapsulates its contents and exposes its functionality through well-defined interfaces. Think of it as a "black box" that does something useful.

In UML, a component is drawn as a rectangle with a small component icon (two small rectangles) in the upper-right corner. In our notation:

<div class="uml-class-diagram-container" data-uml-type="component" data-uml-spec='@startuml
component Frontend
component Backend
component Database
@enduml'></div>

Examples of components in real systems:
- A web frontend (React app, Angular app)
- A REST API service
- An authentication microservice
- A database server
- A message queue (Kafka, RabbitMQ)
- A third-party payment gateway

### 2.2 Interfaces: Provided and Required

Components interact through **interfaces**. UML distinguishes two types:

**Provided Interface (Lollipop):** An interface that the component **implements and offers** to other components. Drawn as a small circle (ball) connected to the component by a line. "I provide this service."

**Required Interface (Socket):** An interface that the component **needs from** another component to function. Drawn as a half-circle (socket/arc) connected to the component. "I need this service."

<div class="uml-class-diagram-container" data-uml-type="component" data-uml-spec='@startuml
component OrderService {
  provide "IOrderAPI" as p1
  require "IPayment" as r1
  require "IInventory" as r2
}
@enduml'></div>

Reading this diagram: `OrderService` **provides** the `IOrderAPI` interface (other components can call it) and **requires** the `IPayment` and `IInventory` interfaces (it depends on payment and inventory services to function).

### 2.3 Ports

A **port** is a named interaction point on a component's boundary. Ports organize a component's interfaces into logical groups. They are drawn as small squares on the component's border.

- **`portin`** --- An incoming port (receives requests), placed on the left edge.
- **`portout`** --- An outgoing port (sends requests), placed on the right edge.

<div class="uml-class-diagram-container" data-uml-type="component" data-uml-spec='@startuml
component PaymentService {
  portin "processPayment" as ps_in
  portout "bankAPI" as ps_out
}
@enduml'></div>

Reading this diagram: `PaymentService` has an incoming port `processPayment` (where other components send payment requests) and an outgoing port `bankAPI` (where it communicates with the external bank).

### 2.4 Connectors

**Connectors** are the lines between components (or between ports) that show communication pathways:

- **Assembly Connector** (`-->`) --- A solid arrow linking one component to another (or a required interface to a provided interface). This is the most common connector.
- **Dependency** (`..>`) --- A dashed arrow indicating a weaker "uses" or "depends on" relationship.
- **Plain Link** (`--`) --- An undirected association between components.

> **Concept Check (Retrieval Practice):** Without looking back, name the two types of interfaces in component diagrams and their visual symbols. What is the difference between a provided and required interface?
>
> <details>
> <summary><i>Reveal Answer</i></summary>
> <b>Provided interface</b> (lollipop/ball): the component offers this service. <b>Required interface</b> (socket/half-circle): the component needs this service from another component.
> </details>

---

## 3. Building a Component Diagram Step by Step

Let's build a component diagram for an online bookstore, one piece at a time. This worked-example approach lets you see how each element is added.

### Step 1: Identify the Components

An online bookstore might have: a web application, a catalog service, an order service, a payment service, and a database.

<div class="uml-class-diagram-container" data-uml-type="component" data-uml-spec='@startuml
component WebApp
component CatalogService
component OrderService
component PaymentService
component Database
@enduml'></div>

### Step 2: Add Ports and Connect Components

Now we add the communication pathways. The web app sends HTTP requests to the catalog and order services. The order service calls the payment service. Both services query the database.

<div class="uml-class-diagram-container" data-uml-type="component" data-uml-spec='@startuml
component WebApp {
  portout "catalog" as wa_cat
  portout "orders" as wa_ord
}
component CatalogService {
  portin "http" as cs_in
  portout "db" as cs_db
}
component OrderService {
  portin "http" as os_in
  portout "pay" as os_pay
  portout "db" as os_db
}
component PaymentService {
  portin "charge" as ps_in
}
component Database {
  portin "sql1" as db_in1
  portin "sql2" as db_in2
}
wa_cat --> cs_in : REST
wa_ord --> os_in : REST
os_pay --> ps_in : gRPC
cs_db --> db_in1 : SQL
os_db --> db_in2 : SQL
@enduml'></div>

### Reading the Complete Diagram

1. **WebApp** has two outgoing ports: one for catalog requests and one for order requests.
2. **CatalogService** receives HTTP requests and queries the Database.
3. **OrderService** receives HTTP requests, calls PaymentService to charge the customer, and queries the Database.
4. **PaymentService** receives charge requests from OrderService.
5. **Database** receives SQL queries from both the CatalogService and OrderService.
6. The labels on connectors (`REST`, `gRPC`, `SQL`) indicate the communication protocol.

---

## 4. Provided and Required Interfaces (Ball-and-Socket)

The ball-and-socket notation makes dependencies between components explicit. When one component's **required interface** (socket) connects to another component's **provided interface** (ball), this forms an **assembly connector**---the two pieces "snap together" like a ball fitting into a socket.

<div class="uml-class-diagram-container" data-uml-type="component" data-uml-spec='@startuml
component ShoppingCart {
  require "IPayment" as r1
}
component PaymentGateway {
  provide "IPayment" as p1
}
r1 --> p1
@enduml'></div>

Reading this diagram: `ShoppingCart` requires the `IPayment` interface, and `PaymentGateway` provides it. The connector shows the dependency is satisfied---the shopping cart can use the payment gateway. If you wanted to swap in a different payment provider, you would only need to provide a component that satisfies the same `IPayment` interface.

This is the essence of **loose coupling**: components depend on interfaces, not on specific implementations.

---

## 5. Component Diagrams vs. Other Diagram Types

Students sometimes confuse when to use which diagram. Here is a comparison:

| Question You Are Answering | Use This Diagram |
|----------------------------|-----------------|
| What classes exist and how are they related? | **Class Diagram** |
| What are the major deployable parts and how do they connect? | **Component Diagram** |
| Where do components run (which servers/containers)? | **Deployment Diagram** |
| How do objects interact over time for a specific scenario? | **Sequence Diagram** |
| What states does an object go through during its lifecycle? | **State Machine Diagram** |

**Rule of thumb:** If you can deploy it, containerize it, or replace it independently, it belongs in a component diagram. If it is an internal implementation detail (a class, a method), it belongs in a class diagram.

---

## 6. Dependencies Between Components

Like class diagrams, component diagrams can show **dependency** relationships using dashed arrows. A dependency means one component *uses* another but does not have a strong structural coupling.

<div class="uml-class-diagram-container" data-uml-type="component" data-uml-spec='@startuml
component OrderService
component Logger
component MetricsCollector
OrderService ..> Logger : uses
OrderService ..> MetricsCollector : reports to
@enduml'></div>

Here, `OrderService` depends on `Logger` and `MetricsCollector` for cross-cutting concerns, but these are not core architectural connections---they are auxiliary dependencies.

---

## 7. Active Recall Challenge

Grab a blank piece of paper. Without looking at this chapter, try to draw a component diagram for the following system:

1. A **MobileApp** sends requests to an **APIServer**.
2. The **APIServer** connects to a **UserService** and a **NotificationService**.
3. The **UserService** queries a **UserDatabase**.
4. The **NotificationService** depends on an external **EmailProvider**.

After drawing, review your diagram:
- Did you use the component notation (rectangles with the component icon)?
- Did you show ports or interfaces where appropriate?
- Did you label your connectors with communication protocols?
- Did you use a dashed arrow for the dependency on the external EmailProvider?

---

## 8. Interactive Practice

Test your knowledge with these retrieval practice exercises.

### Knowledge Quiz
{% include quiz.html id="uml_component_diagram_examples" %}

### Retrieval Flashcards
{% include flashcards.html id="uml_component_diagram_examples" %}

*Pedagogical Tip: Try to answer each question from memory before revealing the answer. Effortful retrieval is exactly what builds durable mental models. Come back to these tomorrow to benefit from [spacing and interleaving](/blog/evidence-based-study-tips-for-college-students/).*
