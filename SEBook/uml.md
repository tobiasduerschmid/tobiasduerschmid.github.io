---
title: UML
layout: sebook
---
More Notes (WIP):
* [Sequence Diagrams](/SEBook/uml_sequence_diagram.html)
* [State Machine Diagrams](/SEBook/uml_state_diagram.html)
* [Class Diagrams](/SEBook/uml_class_diagram.html)

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

## 1. Classes, Interfaces, and Modifiers

This snippet demonstrates how to define an interface, a class, and use visibility modifiers (`+`, `-`, `#`, `~`).

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface Drivable {
  + startEngine(): void
  + stopEngine(): void
}
class Car {
  - make: String
  - model: String
  # year: int
  ~ packageLevelAttribute: String
  + startEngine(): void
  + getMake(): String
}
@enduml'></div>

---

## 2. Relationships

PlantUML uses different arrow styles to represent the various relationships. The direction of the arrow generally goes from the "child" or "part" to the "parent" or "whole."

### Generalization (Inheritance)
Use `--|>` <span class="uml-sym" data-diagram="class" data-sym="--|>"></span> to draw a solid line with an empty, closed arrowhead.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class Vehicle {
  + move(): void
}
class Car
class Motorcycle
Car --|> Vehicle
Motorcycle --|> Vehicle
@enduml'></div>

### Interface Realization (Implementation)
Use `..|>` <span class="uml-sym" data-diagram="class" data-sym="..|>"></span> to draw a dashed line with an empty, closed arrowhead.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface Drivable
class Car
Car ..|> Drivable
@enduml'></div>

### Association and Multiplicities
Use `--` <span class="uml-sym" data-diagram="class" data-sym="--"></span> for a standard solid line. You can add quotes around numbers at either end to define the multiplicities, and a colon followed by text to label the association.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class Teacher
class Course
class Student
Teacher "1" -- "0..*" Course : teaches
Course "1..*" -- "0..*" Student : enrolled in
@enduml'></div>

### Aggregation
Use `o--` <span class="uml-sym" data-diagram="class" data-sym="o--"></span> to draw a solid line with an empty diamond pointing to the "whole" class.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class Department
class Professor
Department o-- Professor
@enduml'></div>

### Composition
Use `*--` <span class="uml-sym" data-diagram="class" data-sym="*--"></span> to draw a solid line with a filled (black) diamond pointing to the "whole" class.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class House
class Room
House *-- "1..*" Room : contains
@enduml'></div>

---

## 3. Putting It All Together: A Mini E-commerce Example

Here is a consolidated diagram showing how these concepts interact in a simple system design.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface PaymentMethod {
  + pay(amount: double): boolean
}
class CreditCard {
  - cardNumber: String
  - expirationDate: String
  + pay(amount: double): boolean
}
class Customer {
  - name: String
  - email: String
  + placeOrder(): void
}
class Order {
  - orderId: int
  - totalAmount: double
}
class OrderItem {
  - productId: int
  - quantity: int
}
CreditCard ..|> PaymentMethod : realizes
Customer "1" -- "0..*" Order : places
Order *-- "1..*" OrderItem : is composed of
Customer "1" -- "0..*" PaymentMethod : uses
@enduml'></div>

---

Would you like me to show you how to add more advanced PlantUML features, like notes, coloring, or packages to organize your classes?




# Class Diagrams 

Class diagrams represent classes and their interactions.

## Classes

Classes are displayed as rectangles with one to three different sections that are each separated by a horizontal line.

The top section is always the name of the class. If the class is abstract, the name is in italics. 

The middle section indicates attributes of the class (i.e., member variables). 

The bottom section should include all methods that are implemented in this class (i.e., for which the implementation of the class contains a method definition). 

Inheritance is visualized using an arrow with an empty triangle pointing to the super class. 

Attributes and methods can be marked as *public* (`+`), *private* (`-`), or *protected* (`#`), to indicate the visibility. 
**Hint:** Avoid public attributes, as this leads to bad design. (Public means every class has access, private means only this class has access, protected means this class and its sub classes have access) 

When a class uses an association, the name and visibility of the attribute can be written either next to the association or in the attribute section, or both (but only if it is done consistently). Writing it on the Association is more common since it increases the readability of the diagram.

Please include types for arguments and a meaningful parameter name. Include return types in case the method returns something (e.g., `+ calculateTax(income: int): int`) 

## Interfaces

Interfaces are classes that do not have any method definitions and no attributes. Interfaces only contain method declarations. Interfaces are visualized using the `<<interface>>` stereotype

To realize an interface, use the arrow with an empty triangle pointing to the interface and a dashed line.

# Sequence Diagrams 

Sequence diagrams display the interaction between concrete objects (or component instances). 

They show one **particular example of interactions** (potentially with optional, alternative, or looped behavior when necessary). Sequence diagrams are not intended to show ALL possible behaviors since this would become very complex and then hard to understand.

Objects / component instances are displayed in rectangles with the label following this pattern: `objectName: ClassName`. If the name of the object is irrelevant, then you can just write `: Classname`. 

When showing interactions between objects then all arrows in the sequence diagram represent method calls being made between the two objects. So an arrow from the client object with the name handleInput to the state objects means that somewhere in the code of the class of which client is an instance of, there is a method call to the handleInput method on the object state. Important: These are interactions between particular objects, not just generally between classes. It's always one concrete instance of this class. 

The names shown on the arrows have to be consistent with the method names shown in the class diagram, including the number or arguments, order of arguments, and types of arguments. Whenever an arrow with method x and arguments of type Y and Z are received by an object o, then either the class of which o is an instance of or one of its super classes needs to have an implementation of `x(Y,Z)`.     

It is a modeling choice to decide whether you want to include concrete values (e.g., `calculateTax(1400)`) or meaningful variable names (e.g., `calculateTax(income)`). If you reference a real variable that has been used before, please make sure to ensure it is the same one and it has the right type. 

# State Machine Diagrams 

State machines model the transitions between different states. States are modeled either as oval, rectangles with rounded corners, or circles. 

Transitions follow the pattern `[condition] trigger / action`. 

State machines always need an initial state but don't always need a final state. 