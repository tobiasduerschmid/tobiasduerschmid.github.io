---
title: "UML Class Diagrams"
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
Customer "1" -- "*" Order
Order *-- "1..*" LineItem
LineItem "*" -- "1" Product
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
A **Class** <span class="uml-sym" data-diagram="class" data-sym="box" data-label="Customer"></span> is a template for creating objects. In UML, a class is represented by a rectangle divided into three compartments:
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
layout horizontal
layout landscape
class User {
  - username: String
  - email: String
  # id: int
  + login(): boolean
  + resetPassword(): void
}
@enduml'></div>

### 2.3 Interfaces
An **Interface** represents a contract. It tells us *what* a class must do, but not *how* it does it. It is denoted by the `<<interface>>` stereotype. Interfaces contain method signatures and usually do not declare attributes (the UML specification allows it, but I recommend not to use it)

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
interface Payable {
  + processPayment(): bool
}
@enduml'></div>

> 🧠 **Concept Check 1 (Retrieval Practice)**
> *Cover the screen above. What do the symbols `+`, `-`, and `#` stand for? Why does an interface lack an attributes compartment?*


## Connecting the Dots: Relationships

Software is never just one class working in isolation. Classes interact. We represent these interactions with different types of lines and arrows. 

### Generalization --- "Is-A" Relationships

Generalization connects a subclass to a superclass. It means the subclass inherits attributes and behaviors from the parent. 
* **UML Symbol:** <span class="uml-sym" data-diagram="class" data-sym="--|>"></span> A solid line with a hollow, closed arrow pointing to the parent.

### Interface Realization
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

### Dependency (Weakest Relationship)

A dependency indicates that one class *uses* another, but does not hold a permanent reference to it. For example, a class might use another class as a method parameter, local variable, or return type. Dependency is the weakest relationship in a class diagram.
* **UML Symbol:** <span class="uml-sym" data-diagram="class" data-sym="..>"></span> A **dashed line** with an open arrowhead.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Train {
  # addStop(stop: ButtonPressedEvent): void
  + startTrain(velocity: double): void
}
class ButtonPressedEvent
Train ..> ButtonPressedEvent
@enduml'></div>

In this example, `Train` depends on `ButtonPressedEvent` because it uses it as a parameter type in `addStop()`. However, `Train` does not store a permanent reference to `ButtonPressedEvent`---the dependency exists only for the duration of the method call.

Here is another example where a class depends on an exception it throws:

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class ChecksumValidator {
  + execute(): bool
  + validate(): void
}
class InvalidChecksumException
ChecksumValidator ..> InvalidChecksumException
@enduml'></div>


### Association --- "Has-A" / "Knows-A" Relationships

A basic structural relationship indicating that objects of one class are connected to objects of another (e.g., a "Teacher" knows about a "Student"). Attributes can also be represented as association lines: a line is drawn between the owning class and the target attribute's class, providing a quick visual indication of which classes are related.
* **UML Symbol:** <span class="uml-sym" data-diagram="class" data-sym="--"></span> A simple solid line.
* You can also **name** associations and make them **directional** using an arrowhead to indicate navigability (which class holds a reference to the other).

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Student {
  - name: String
}
class Course {
  - title: String
}
Student "*" -- "1..*" Course : enrolled in
@enduml'></div>

#### Multiplicities

Along association lines, we use numbers to define *how many* objects are involved. Always show multiplicity on **both** ends of an association.

| Notation | Meaning |
|----------|---------|
| `1` | Exactly one |
| `0..1` | Zero or one (optional) |
| `*` or `*` | Zero to many |
| `1..*` | One to many (at least one required) |

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Author
class Book
Author "1" -- "1..*" Book : writes
@enduml'></div>

#### Navigability

By default, an association is **bidirectional**---both classes know about each other. In practice, the relationship is often one-way: only one class holds a reference to the other. UML uses arrowheads and X marks to show this **navigability**.

* **Navigable end** <span class="uml-sym" data-diagram="class" data-sym="-->"></span> An **open arrowhead** pointing to the class that can be "reached." The left object has a reference to the right object.
* **Non-Navigable end** <span class="uml-sym" data-diagram="class" data-sym="--x"></span> An **X** on the end that cannot be navigated. This explicitly states that the class at the X end does *not* hold a reference to the other.

Here are the four navigability combinations, each with an example:

**Unidirectional (one arrowhead):** Only one class holds a reference.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Vote
class Politician
Vote --> Politician
@enduml'></div>

`Vote` holds a reference to `Politician`, but `Politician` does not know about individual `Vote` objects.

**Bidirectional (arrowheads on both ends):** Both classes hold a reference to each other.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Employee
class Boss
Employee <--> Boss
@enduml'></div>

`Employee` knows about their `Boss`, and `Boss` knows about their `Employee`. A plain line with no arrowheads is also acceptable for bidirectional associations.

**Non-navigable on one end (X on one side):** One class is explicitly prevented from navigating.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Voter
class Vote
Voter x-- Vote
@enduml'></div>

In the full UML notation, an X on the `Voter` end would mean: `Vote` knows about `Voter`, but `Voter` does *not* hold a reference to `Vote`. (Note: the X mark is a formal UML notation not commonly rendered in simplified tools---when you see a unidirectional arrow, the absence of an arrowhead on the other end implies non-navigability.)

**Non-navigable on both ends (X on both sides):** Neither class holds a reference---the association is recorded only in the model, not in code.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Account
class ClearTextPassword
Account x--x ClearTextPassword
@enduml'></div>

An X on both ends of `Account`<span class="uml-sym" data-diagram="class" data-sym="x--x"></span>`ClearTextPassword` means neither class should store a reference to the other. This is a deliberate design decision (e.g., for security: an `Account` should never hold a reference to a `ClearTextPassword`).

**When to use navigability:** Navigability is a design-level detail. In analysis/domain models, plain associations (no arrowheads) are preferred because you haven't decided which class holds the reference yet. Once you move into detailed design, add navigability to show which class stores the reference---this maps directly to code (a field/attribute in the class at the arrow tail).

#### Aggregation ("Owns-A")

A specialized association where one class belongs to a collection, but the parts can exist independently of the whole. If a University closes down, the Professors still exist. Think of aggregation as a long-term, whole-part association.
* **UML Symbol:** <span class="uml-sym" data-diagram="class" data-sym="o--"></span> A solid line with an **empty diamond** at the "whole" end.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class University
class Professor
University "1" o-- "*" Professor
@enduml'></div>

#### Composition ("Is-Made-Up-Of")

A strict relationship where the parts *cannot* exist without the whole. If you destroy a House, the Rooms inside it are also destroyed. A part may belong to **only one** composite at a time (exclusive ownership), and the composite has sole responsibility for the lifetime of its parts.
* **UML Symbol:** <span class="uml-sym" data-diagram="class" data-sym="*--"></span> A solid line with a **filled diamond** at the "whole" end.
* Per the UML spec, the multiplicity on the composite end must be `1` or `0..1`.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class House
class Room
House "1" *-- "1..*" Room
@enduml'></div>

**A helpful way to think about the difference:** In C++, aggregation is usually expressed through pointers/references (the part can exist separately), while composition is expressed by containing instances by value (the part's lifetime is tied to the whole). In Java and Python, every object reference is effectively a pointer — the distinction between aggregation and composition is communicated through *design intent* (who created the part? who destroys it?) rather than through language syntax. Inner classes in Java are *one* indicator of composition but are not required.

> **⚠ Honest caveat on aggregation.** Aggregation has *intentionally informal* semantics in the UML 2 specification. Martin Fowler (*UML Distilled*) observes: *"Aggregation is strictly meaningless; I recommend that you ignore it in your own diagrams."* When you aren't sure whether something is aggregation or plain association, use **association** — it is always safe. Reserve the hollow diamond for the cases where part-whole semantics clearly add communicative value.

> 🧠 **Concept Check 2 (Self-Explanation)**
> *In your own words, explain the difference between the empty diamond (Aggregation) and the filled diamond (Composition). Give a real-world example of each that is not mentioned in this text.*

### Relationship Strength Summary

From weakest to strongest, the class relationships are:

<table>
<thead>
<tr><th>Relationship</th><th>Symbol</th><th>Meaning</th><th>Example</th></tr>
</thead>
<tbody>
<tr><td><strong>Dependency</strong></td><td><span class="uml-sym" data-diagram="class" data-sym="..>"></span> Dashed arrow</td><td>"uses" temporarily</td><td>Method parameter, thrown exception</td></tr>
<tr><td><strong>Association</strong></td><td><span class="uml-sym" data-diagram="class" data-sym="--"></span> Solid line</td><td>"knows about" structurally</td><td>Employee knows about Boss</td></tr>
<tr><td><strong>Aggregation</strong></td><td><span class="uml-sym" data-diagram="class" data-sym="o--"></span> Hollow diamond</td><td>"has-a" (parts can exist alone)</td><td>Library has Books</td></tr>
<tr><td><strong>Composition</strong></td><td><span class="uml-sym" data-diagram="class" data-sym="*--"></span> Filled diamond</td><td>"made up of" (parts die with whole)</td><td>House is made of Rooms</td></tr>
<tr><td><strong>Generalization</strong></td><td><span class="uml-sym" data-diagram="class" data-sym="--|>"></span> Hollow triangle</td><td>"is-a" (inheritance)</td><td>Car is-a Vehicle</td></tr>
<tr><td><strong>Realization</strong></td><td><span class="uml-sym" data-diagram="class" data-sym="..|>"></span> Dashed hollow triangle</td><td>"implements" (interface)</td><td>Car implements Drivable</td></tr>
</tbody>
</table>


## ⚠ The Five Most Common UML Class Diagram Mistakes

Empirical studies of student diagrams (Chren et al., 2019) identify these recurring errors. Watch for them in your own work:

| # | Mistake | Fix |
|---|---|---|
| 1 | **Generalization arrow pointed the wrong way** — triangle at the child instead of the parent | The triangle *always* rests at the **parent**. Sanity-check with the "is-a" sentence: *"A [child] is a [parent]"*. |
| 2 | **Multiplicity on the wrong end** — e.g., `*` placed next to the "one" side | Multiplicity answers *"for one of the opposite class, how many of **this** class?"* Place it next to the class being quantified. |
| 3 | **Missing multiplicity on one end** | Per Ambler (G117), always show multiplicity on **both** ends of every relationship. An unlabeled end is ambiguous, not "just 1." |
| 4 | **Confusing aggregation and composition** — using the filled diamond when parts are actually shared | Composition = exclusive ownership *and* lifecycle dependency. If the part can exist without the whole, use aggregation (or plain association). |
| 5 | **Verbose `0..*` when `*` suffices** | Use the shorthand `*` for zero-or-more; reserve the explicit lower bound only when it adds clarity (e.g., `1..*`). |

> **Pedagogy tip:** Before turning in any class diagram, run this five-item checklist over every relationship. Catching these five mistakes catches the majority of grading-level errors.

## Advanced Class Notation

### Abstract Classes and Operations

An **abstract class** is a class that cannot be instantiated directly---it serves as a base for subclasses. In UML, an abstract class is indicated by *italicizing* the class name or adding `{abstract}`.

An **abstract operation** is a method with no implementation, intended to be supplied by descendant classes. Abstract operations are shown by *italicizing* the operation name.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
abstract class Shape {
  - color: int
  + setColor(r: int, g: int, b: int): void
  {abstract} + draw(): void
}
class Rectangle {
  - width: int
  - length: int
  + setWidth(width: int): void
  + setHeight(height: int): void
  + draw(): void
}
Rectangle --|> Shape
@enduml'></div>

In this example, `Shape` is abstract (it cannot be created directly) and declares an abstract `draw()` method. `Rectangle` inherits from `Shape` and provides a concrete implementation of `draw()`.

### Static Members

**Static** (class-level) attributes and operations belong to the class itself rather than to individual instances. In UML, static members are shown **underlined**.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class MathUtils {
  {static} +PI: double
  {static} +abs(n: int): int
  +round(n: double): int
}
@enduml'></div>


## From Code to Diagram: Worked Examples

A key skill is translating between code and UML class diagrams. Let's work through several examples that progressively build this skill.

### Example 1: A Simple Class

```java
public class BaseSynchronizer {
    public void synchronizationStarted() { }
}
```

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class BaseSynchronizer {
  + synchronizationStarted(): void
}
@enduml'></div>

Each public method becomes a `+` operation in the bottom compartment. The return type follows a colon after the method signature.

### Example 2: Attributes and Associations

When a class holds a reference to another class, you can show it either as an attribute *or* as an association line (but be consistent throughout your diagram).

```java
public class Student {
    Roster roster;
    public void storeRoster(Roster r) {
        roster = r;
    }
}
```

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Student {
  ~ roster: Roster
  + storeRoster(r: Roster): void
}
class Roster
Student --> Roster
@enduml'></div>

Notice: the `roster` field has package visibility (`~`) because no access modifier was specified in the Java code (Java default is package-private).

### Example 3: Dependency from Exception Handling

```java
public class ChecksumValidator {
    public boolean execute() {
        try {
            this.validate();
        } catch (InvalidChecksumException e) {
            // handle error
        }
        return true;
    }
    public void validate() throws InvalidChecksumException { }
}
```

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class ChecksumValidator {
  + execute(): bool
  + validate(): void
}
class InvalidChecksumException
ChecksumValidator ..> InvalidChecksumException
@enduml'></div>

The `ChecksumValidator` *depends on* `InvalidChecksumException` (it uses it in a throws clause and catch block) but does not store a permanent reference to it. This is a dependency, not an association.

### Example 4: Composition from Inner Classes

```java
public class MotherBoard {
    private class IDEBus { }
    IDEBus primaryIDE;
    IDEBus secondaryIDE;
}
```

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class MotherBoard {
  - primaryIDE: IDEBus
  - secondaryIDE: IDEBus
}
class IDEBus
MotherBoard *-- "2" IDEBus
@enduml'></div>

The inner class pattern in Java typically indicates composition---the `IDEBus` instances cannot exist without the `MotherBoard`.

> **Concept Check (Generation):** Before looking at the answer below, try to draw the UML class diagram for this code:
> ```java
> import java.util.ArrayList;
> import java.util.List;
> public class Division {
>     private List<Employee> division = new ArrayList<>();
>     private Employee[] employees = new Employee[10];
> }
> ```
>
> <details>
> <summary><i>Reveal Answer</i></summary>
>
> <div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
> layout horizontal
> layout landscape
> class Division {
>   - division: List~Employee~
>   - employees: Employee[]
> }
> class Employee
> Division o-- "*" Employee
> Division -- "10" Employee
> @enduml'></div>
>
> The <code>List&lt;Employee&gt;</code> field suggests aggregation (the collection can grow dynamically, employees can exist independently). The array with a fixed size of 10 is a direct association with a specific multiplicity.
> </details>


## Putting It All Together: The E-Commerce System

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
Customer "1" -- "*" Order
Order *-- "1..*" LineItem
LineItem "*" -- "1" Product
@enduml'></div>

### System Walkthrough:
1. **Generalization:** `VIP` and `Guest` are specific types of `Customer`.
2. **Association (Multiplicity):** `1` Customer can have `*` (zero to many) Orders.
3. **Interface Realization:** `Order` implements the `Billable` interface.
4. **Composition:** An `Order` strongly contains `1..*` (one or more) `LineItem`s. If the order is deleted, the line items are deleted.
5. **Association:** Each `LineItem` points to exactly `1` `Product`.


## Real-World Examples

The following examples apply everything from this chapter to systems you interact with every day. Try reading each diagram yourself before the walkthrough — this is retrieval practice in action.


### Example 1: Spotify — Music Streaming Domain Model

**Scenario:** An analysis-level domain model for a music streaming service. The goal is to capture *what things are* and *how they relate* — not implementation details like database schemas or network calls.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class User {
  + search(query: String): list
  + createPlaylist(name: String): Playlist
}
class FreeUser
class PremiumUser {
  + download(track: Track): void
}
class Playlist {
  + addTrack(t: Track): void
}
class Track {
  + title: String
  + duration: int
}
class Artist {
  + name: String
}
FreeUser --|> User
PremiumUser --|> User
User "1" *-- "*" Playlist : owns
Playlist "*" o-- "*" Track : contains
Track "*" -- "1..*" Artist : performedBy
@enduml'></div>

**What the UML notation captures:**

1. **Generalization (hollow triangle):** `FreeUser` and `PremiumUser` both extend `User`, inheriting `search()` and `createPlaylist()`. Only `PremiumUser` adds `download()` — a capability unlocked by upgrading. The hollow triangle always points *up* toward the parent class.
2. **Composition (filled diamond, User → Playlist):** A `User` *owns* their playlists. Deleting a user account deletes their playlists — the parts cannot outlive the whole. The filled diamond sits on the *owner's* side.
3. **Aggregation (hollow diamond, Playlist → Track):** A `Playlist` *contains* tracks, but tracks exist independently — the same track can appear in many playlists. Deleting a playlist does not remove the track from the catalogue.
4. **Association with multiplicity (Track → Artist):** Each track is performed by `1..*` artists — at least one (solo) or more (collaboration). This multiplicity directly encodes a real business rule.

> **Analysis vs. design level:** This diagram has no visibility modifiers (`+`, `-`). That is intentional — at the analysis level we model *what things are and do*, not encapsulation decisions. Visibility is a design-level concern added in a later phase.


### Example 2: GitHub — Pull Request Design Model

**Scenario:** A design-level diagram (note the visibility modifiers) showing how GitHub's code review system could be modelled internally. Notice how an interface creates a formal contract between components.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface Mergeable {
  + canMerge(): bool
  + merge(): void
}
class Repository {
  - name: String
  - isPrivate: bool
  + openPR(title: String): PullRequest
}
class PullRequest {
  - title: String
  - status: String
  + addReview(r: Review): void
  + canMerge(): bool
  + merge(): void
}
class Review {
  - verdict: String
  + approve(): void
  + requestChanges(): void
}
class CICheck {
  - passed: bool
  + getResult(): bool
}
PullRequest ..|> Mergeable
Repository "1" *-- "*" PullRequest
PullRequest "1" *-- "*" Review
PullRequest ..> CICheck
@enduml'></div>

**What the UML notation captures:**

1. **Interface Realization (dashed hollow arrow):** `PullRequest` implements `Mergeable` — a contract committing the class to provide `canMerge()` and `merge()`. A merge pipeline can work with any `Mergeable` object without knowing the concrete type.
2. **Composition (Repository → PullRequest):** A PR cannot exist without its repository. Delete the repo, and all its PRs are deleted — the filled diamond on `Repository`'s side shows ownership.
3. **Composition (PullRequest → Review):** A review only exists in the context of one PR. `1 *-- *` reads: one PR can have zero or more reviews; each review belongs to exactly one PR.
4. **Dependency (dashed open arrow, PullRequest → CICheck):** `PullRequest` *uses* `CICheck` temporarily — perhaps receiving it as a method parameter. It does not hold a permanent field reference, so this is a dependency, not an association.


### Example 3: Uber Eats — Food Delivery Domain Model

**Scenario:** The domain model for a food delivery platform. This example is excellent for practicing multiplicity — every `0..1`, `1`, and `*` encodes a real business rule the engineering team must enforce.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class Customer {
  - name: String
  - address: String
}
class Order {
  - placedAt: DateTime
  - status: String
  + calcTotal(): float
}
class OrderItem {
  - quantity: int
  - unitPrice: float
}
class MenuItem {
  - name: String
  - price: float
}
class Restaurant {
  - name: String
  - rating: float
}
class Driver {
  - name: String
  - vehicleType: String
}
Customer "1" -- "*" Order : places
Order *-- "1..*" OrderItem : contains
OrderItem "*" -- "1" MenuItem : references
Restaurant "1" -- "1..*" MenuItem : offers
Driver "0..1" -- "0..1" Order : delivers
@enduml'></div>

**What the UML notation captures:**

1. **`Customer "1" -- "*" Order`:** One customer can have zero orders (a new account) or many. The navigability arrow shows `Customer` holds the reference — in code, a `Customer` would have an `orders` collection field.
2. **Composition (Order → OrderItem):** Order items only exist within an order. Cancelling the order destroys the items. The `1..*` on `OrderItem` enforces that every order must have at least one item.
3. **`OrderItem "*" -- "1" MenuItem`:** Each item references exactly one menu item. Many orders can reference the same menu item — deleting an order does **not** remove the menu item from the restaurant's catalogue.
4. **`Driver "0..1" -- "0..1" Order`:** A driver handles at most one active delivery at a time; an order has at most one assigned driver. Before dispatch, both sides satisfy `0` — neither requires the other to exist yet. This captures a real business constraint in two characters.


### Example 4: Netflix — Content Catalogue Model

**Scenario:** Netflix serves two fundamentally different types of content — movies (watched once) and TV shows (composed of seasons and episodes). This diagram shows how inheritance and composition work together to model a content catalogue.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
abstract class Content {
  # title: String
  # rating: String
  {abstract} + play(): void
}
class Movie {
  - duration: int
  + play(): void
}
class TVShow {
  + play(): void
}
class Season {
  - seasonNumber: int
}
class Episode {
  - episodeNumber: int
  - duration: int
  + play(): void
}
class Genre {
  - name: String
}
Movie --|> Content
TVShow --|> Content
TVShow "1" *-- "1..*" Season : contains
Season "1" *-- "1..*" Episode : contains
Content "*" -- "1..*" Genre : classifiedBy
@enduml'></div>

**What the UML notation captures:**

1. **Abstract class (`abstract class Content`):** The italicised class name and `{abstract}` on `play()` signal that `Content` is never instantiated directly — you never watch a "content", only a `Movie` or `TVShow`. Both subclasses override `play()` with their own implementation.
2. **Generalization hierarchy:** Both `Movie` and `TVShow` extend `Content`, inheriting `title` and `rating`. A `Movie` adds `duration` directly; a `TVShow` delegates duration implicitly through its episodes.
3. **Nested composition (`TVShow → Season → Episode`):** A `TVShow` is composed of seasons; each season is composed of episodes. Delete a show and the seasons disappear; delete a season and the episodes disappear. The chain of filled diamonds models this cascade.
4. **Association with multiplicity (`Content → Genre`):** A movie or show belongs to `1..*` genres (at least one — e.g., Action). A genre classifies `*` content items. This is a plain association — deleting a genre does not delete the content.


### Example 5: Strategy Pattern — Pluggable Payment Processing

**Scenario:** A shopping cart needs to support multiple payment methods (credit card, PayPal, crypto) and let users switch between them at runtime. This is the **Strategy design pattern** — and a class diagram is the canonical way to document it.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface PaymentStrategy {
  + pay(amount: float): bool
  + refund(amount: float): bool
}
class CreditCardPayment {
  - cardNumber: String
  - cvv: String
  + pay(amount: float): bool
  + refund(amount: float): bool
}
class PayPalPayment {
  - email: String
  + pay(amount: float): bool
  + refund(amount: float): bool
}
class CryptoPayment {
  - walletAddress: String
  + pay(amount: float): bool
  + refund(amount: float): bool
}
class ShoppingCart {
  - items: list
  - strategy: PaymentStrategy
  + setPayment(s: PaymentStrategy): void
  + checkout(): bool
}
CreditCardPayment ..|> PaymentStrategy
PayPalPayment ..|> PaymentStrategy
CryptoPayment ..|> PaymentStrategy
ShoppingCart --> PaymentStrategy : uses
@enduml'></div>

**What the UML notation captures:**

1. **Interface as contract:** `PaymentStrategy` defines the contract — `pay()` and `refund()`. Every concrete implementation must provide both. The interface appears at the top of the hierarchy, with implementors below.
2. **Three realizations (..|>):** `CreditCardPayment`, `PayPalPayment`, and `CryptoPayment` all implement `PaymentStrategy`. The dashed hollow arrow points *toward* the interface each class promises to fulfill.
3. **Association `ShoppingCart --> PaymentStrategy`:** The cart holds a *reference* to `PaymentStrategy` — not to any specific implementation. This navigability arrow (open head, not filled diamond) means `ShoppingCart` has a field of type `PaymentStrategy`. Crucially, it is typed to the *interface*, not a concrete class.
4. **The power of this design:** Because `ShoppingCart` depends on `PaymentStrategy` (the interface), you can call `cart.setPayment(new CryptoPayment())` at runtime and the cart works without any changes to its own code. The class diagram makes this extensibility *visible* — and it shows exactly where the seam between context and strategy is.

> **Connection to practice:** This is the same pattern behind Java's `Comparator`, Python's `sort(key=...)`, and every payment SDK you will ever integrate in your career. Class diagrams let you see the shape of the pattern independent of any language.


## 5. Chapter Review & Spaced Practice

To lock this information into your long-term memory, do not skip this section! 

**Active Recall Challenge:**
Grab a blank piece of paper. Without looking at this chapter, try to draw the UML Class Diagram for the following scenario:
1. A **School** is composed of one or many **Department**s (If the school is destroyed, departments are destroyed).
2. A **Department** aggregates many **Teacher**s (Teachers can exist without the department).
3. **Teacher** is a subclass of an **Employee** class.
4. The **Employee** class has a private attribute `salary` and a public method `getDetails()`.

*Review your drawing against the rules in sections 2 and 3. How did you do? Identifying your own gaps in knowledge is the most powerful step in the learning process!*


## 6. Interactive Practice

Test your knowledge with these retrieval practice exercises. These diagrams are rendered dynamically to ensure you can recognize UML notation in any context.

### Knowledge Quiz
{% include quiz.html id="uml_class_diagram_examples" %}

### Retrieval Flashcards
{% include flashcards.html id="uml_class_diagram_examples" %}

*Pedagogical Tip: If you find these challenging, it's a good sign! Effortful retrieval is exactly what builds durable mental models. Try coming back to these tomorrow to benefit from [spacing and interleaving](/blog/evidence-based-study-tips-for-college-students/).*
