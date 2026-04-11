---
title: UML
layout: sebook
---

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

# Introduction

*Pedagogical Note: This chapter is designed using principles of **Active Engagement** (frequent retrieval practice). We will build concepts incrementally. Please complete the "Concept Checks" without looking back at the text—this introduces a "[desirable difficulty](/blog/evidence-based-study-tips-for-college-students/)" that strengthens long-term memory.*

## 🎯 Learning Objectives
By the end of this chapter, you will be able to:
1. Translate real-world object relationships into UML Class Diagrams.
2. Differentiate between structural relationships (Association, Aggregation, Composition).
3. Read and interpret system architecture from UML class diagrams.


## Diagram -- The Blueprint of Software 

Imagine you are an architect designing a complex building. Before laying a single brick, you need blueprints. In software engineering, we use similar models. The **Unified Modeling Language (UML)** is the most common one. 
Among UML diagrams, **Class Diagrams** are the most common ones, because they are very close to the code. They describe the static structure of a system by showing the system's classes, their attributes, operations (methods), and the relationships among objects.


## The Core Building Blocks

### 2.1 Classes
A **Class** is a template for creating objects. In UML, a class is represented by a rectangle divided into three compartments:
1. **Top:** The Class Name.
2. **Middle:** Attributes (variables/state).
3. **Bottom:** Operations (methods/behavior).

### 2.2 Modifiers (Visibility)
To enforce *encapsulation*, UML uses symbols to define who can access attributes and operations:
* `+` **Public**: Accessible from anywhere.
* `-` **Private**: Accessible only within the class.
* `#` **Protected**: Accessible within the class and its subclasses.
* `~` **Package/Default**: Accessible by any class in the same package.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class User {
  - username: String
  - email: String
  # id: int
  + login(): boolean
  + resetPassword(): void
}
@enduml'></div>

### 2.3 Interfaces
An **Interface** represents a contract. It tells us *what* a class must do, but not *how* it does it. It is denoted by the `<<interface>>` stereotype. Interfaces typically only have method signatures, no attributes.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface Payable {
  + processPayment(): bool
}
@enduml'></div>

> 🧠 **Concept Check 1 (Retrieval Practice)**
> *Cover the screen above. What do the symbols `+`, `-`, and `#` stand for? Why does an interface lack an attributes compartment?*


## Connecting the Dots: Relationships

Software is never just one class working in isolation. Classes interact. We represent these interactions with different types of lines and arrows. 

*(Pedagogical Note: We are segmenting relationships into two categories to manage cognitive load: "Is-A" relationships and "Has-A" relationships).*

### Category 1: "Is-A" Relationships (Inheritance)

**1. Generalization (Inheritance)**
Generalization connects a subclass to a superclass. It means the subclass inherits attributes and behaviors from the parent. 
* **UML Symbol:** <span class="uml-sym" data-diagram="class" data-sym="--|>"></span> A solid line with a hollow, closed arrow pointing to the parent.

**2. Interface Realization**
When a class agrees to implement the methods defined in an interface, it "realizes" the interface.
* **UML Symbol:** <span class="uml-sym" data-diagram="class" data-sym="..|>"></span> A dashed line with a hollow, closed arrow pointing to the interface.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface Vehicle {
  + startEngine(): void
}
class Car {
  - make: String
  + startEngine(): void
}
class Sedan
class SUV
Car ..|> Vehicle
Sedan --|> Car
SUV --|> Car
@enduml'></div>

### Category 2: "Has-A" / "Knows-A" Relationships

**1. Association**
A basic structural relationship indicating that objects of one class are connected to objects of another (e.g., a "Teacher" knows about a "Student"). 
* **UML Symbol:** <span class="uml-sym" data-diagram="class" data-sym="--"></span> A simple solid line.

**2. Multiplicities**
Along association lines, we use numbers to define *how many* objects are involved.
* `1` : Exactly one
* `0..1` : Zero or one
* `*` or `0..*` : Zero to many
* `1..*` : One to many

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class Author
class Book
Author "1" -- "1..*" Book : writes
@enduml'></div>

**3. Aggregation (Weak "Has-A")**
A specialized association where one class belongs to a collection, but the parts can exist independently of the whole. If a University closes down, the Professors still exist.
* **UML Symbol:** <span class="uml-sym" data-diagram="class" data-sym="o--"></span> A solid line with an **empty diamond** at the "whole" end.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class University
class Professor
University "1" o-- "0..*" Professor
@enduml'></div>

**4. Composition (Strong "Has-A")**
A strict relationship where the parts *cannot* exist without the whole. If you destroy a House, the Rooms inside it are also destroyed.
* **UML Symbol:** <span class="uml-sym" data-diagram="class" data-sym="*--"></span> A solid line with a **filled diamond** at the "whole" end.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class House
class Room
House "1" *-- "1..*" Room
@enduml'></div>

> 🧠 **Concept Check 2 (Self-Explanation)**
> *In your own words, explain the difference between the empty diamond (Aggregation) and the filled diamond (Composition). Give a real-world example of each that is not mentioned in this text.*

---

## 4. Putting It All Together: The E-Commerce System

*Pedagogical Note: We are now combining isolated concepts into a complex schema. This reflects how you will encounter UML in the real world.*

Let's read the architectural blueprint for a simplified E-Commerce system.

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

### System Walkthrough:
1. **Generalization:** `VIP` and `Guest` are specific types of `Customer`.
2. **Association (Multiplicity):** `1` Customer can have `0..*` (zero to many) Orders.
3. **Interface Realization:** `Order` implements the `Billable` interface.
4. **Composition:** An `Order` strongly contains `1..*` (one or more) `LineItem`s. If the order is deleted, the line items are deleted.
5. **Association:** Each `LineItem` points to exactly `1` `Product`.

---

## 5. Chapter Review & Spaced Practice

To lock this information into your long-term memory, do not skip this section! 

**Active Recall Challenge:**
Grab a blank piece of paper. Without looking at this chapter, try to draw the UML Class Diagram for the following scenario:
1. A **School** is composed of one or many **Department**s (If the school is destroyed, departments are destroyed).
2. A **Department** aggregates many **Teacher**s (Teachers can exist without the department).
3. **Teacher** is a subclass of an **Employee** class.
4. The **Employee** class has a private attribute `salary` and a public method `getDetails()`.

*Review your drawing against the rules in sections 2 and 3. How did you do? Identifying your own gaps in knowledge is the most powerful step in the learning process!*


