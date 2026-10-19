---
title: "UML Class Diagrams"
layout: sebook
uml_code_labs: true
---

> **Want to practice?** Write code that matches target diagrams in our interactive tutorials: [UML Class Diagrams in Python](/SEBook/tools/uml-class-diagram-python.html) and [UML Class Diagrams in Java](/SEBook/tools/java-tutorial.html).
{: id="7-interactive-tutorials"}

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

# Introduction

## 🎯 Learning Objectives
By the end of this chapter, you will be able to:
1. Translate real-world object relationships into UML Class Diagrams.
2. Differentiate between structural relationships (Association, Aggregation, Composition).
3. Read and interpret system architecture from UML class diagrams.


## Diagram -- The Blueprint of Software 

Imagine you are an architect designing a complex building. Before laying a single brick, you need blueprints. In software engineering, we use similar models. The **Unified Modeling Language (UML)** is the most common one. 
Among UML diagrams, **Class Diagrams** are the most common ones, because they are very close to the code. They describe the static structure of a system by showing the system's classes, their attributes, operations, and the relationships among objects.


## The Core Building Blocks

### Model Types and Source Types

A class diagram selects claims for a purpose. The labs start with **Implementation details**, showing the current code's types and members. Switch to **Design focus** to abstract those types and hide empty no-argument constructors and known no-result suffixes. Constructors with parameters or initialization behavior stay visible. Hidden members still exist in the code; the view is not a certificate that the design meets its requirements. Visibility, relationships, and multiplicities keep their meaning in both views. Design focus removes Python's leading naming markers and displays Python initializers and TypeScript constructors under the class name; Implementation details retains names such as `_name`, `__init__`, and `constructor`. Protocol operations stay visible (for example, `__str__` becomes `str`). If removing markers would merge distinct members, the source names remain.

We use UML's standard primitive vocabulary {% cite OMG2017UML %}:

| UML primitive | Meaning | Common source types |
|---|---|---|
| `Integer` | Whole numbers | Python `int`; Java `int`, `long`; C++ `int`, `long`; TypeScript `bigint` |
| `Boolean` | True or false | Python `bool`; Java `boolean`; C++ `bool`; TypeScript `boolean` |
| `String` | Text | Python `str`; Java `String`; C++ `std::string`; TypeScript `string` |
| `Real` | Real-number values | Python `float`; Java/C++ `float`, `double`; TypeScript `number` |
| `UnlimitedNatural` | Nonnegative integers plus an unlimited value `*` | No direct built-in equivalent; use a nonnegative integer together with an explicit unlimited case |

These are modeling correspondences, not identical runtime types. Machine integers have range limits; floating-point values approximate real numbers. TypeScript `number` does not establish an integer contract. An unsigned C++ integer is finite, so it is not `UnlimitedNatural`. Optional values remain optional, and unknown types remain unspecified. Collection labels use `Sequence<T>`, `Set<T>`, and `Map<K,V>`; a collection alone proves neither ownership nor a nonempty lower bound.

Java boxed numbers retain their nullable distinction, for example `Integer` becomes `Optional<Integer>` in Design focus. A common text label such as `String` does not prove non-nullness. See [TypeScript's primitive type distinctions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) and [Python's annotation contract](https://docs.python.org/3/library/typing.html): Python does not enforce annotations at runtime.

### 2.1 Classes
A **Class** <span class="uml-sym" data-diagram="class" data-sym="box" data-label="Customer"></span> describes a set of objects that share the same structure and behavior. In UML, a class is represented by a rectangle divided into three compartments:
1. **Top:** The Class Name.
2. **Middle:** Attributes (values each object stores).
3. **Bottom:** Operations (behavior that can be invoked).

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
  # id: Integer
  + login(): Boolean
  + resetPassword()
}
callout top of text "User" : Class: shared structure and behavior
callout left of text "-" : Private: visible only inside this class
callout left of text "#" : Protected: visible in this class and its subclasses
callout left of text "+" : Public: visible wherever the class is visible
callout right of text "username: String" : Attributes: values each object stores
callout right of text "login(): Boolean" : Operations: behavior that can be invoked
@enduml'></div>

Edit the code below to update the diagram. Before editing, compare **Implementation details** with **Design focus**: which changes only the notation, and which information would a caller still need? Then compare a second language. Each language has its own example and edits; switching languages does not translate your code.

In Python, `_name` is a non-public convention, `__name` triggers name mangling, and `__name__` names special protocols. The diagram's visibility markers describe that mapping; they do not give Python Java-style access enforcement. The code is analyzed locally without execution; edits are not saved.

{% include uml-code-lab.html example="visibility" %}

### 2.3 Interfaces
An **Interface** represents a contract. It tells us *what* a class must do, but not *how* it does it. It is denoted by the `<<interface>>` stereotype. Interfaces contain method signatures and usually do not declare attributes (the UML specification allows it {% cite OMG2017UML %}, but I recommend not to use it)

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
interface Payable {
  + processPayment(): Boolean
}
callout top of text "«interface»" : Interface: a contract of public operations
callout right of text "processPayment(): Boolean" : Operation: the contract name and return type
@enduml'></div>

> **Quick Check 1 (Retrieval Practice)**
> *Cover the screen above. What do the symbols `+`, `-`, and `#` stand for? Why does an interface lack an attributes compartment?*


## Connecting the Dots: Relationships

Software is never just one class working in isolation. Classes interact. We represent these interactions with different types of lines and arrows. 

### Generalization --- "Is-A" Relationships

Generalization connects a subclass to a superclass. Every object of the subclass is also an object of the superclass, and the subclass inherits the superclass's features. 
* **UML Symbol:** <span class="uml-sym" data-diagram="class" data-sym="--|>"></span> A solid line with a hollow, closed arrow pointing to the parent.

{% include uml-code-lab.html example="inheritance" %}

### Interface Realization
When a class realizes an interface, it fulfills that interface's contract: it provides the operations the interface declares.
* **UML Symbol:** <span class="uml-sym" data-diagram="class" data-sym="..|>"></span> A dashed line with a hollow, closed arrow pointing to the interface.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface Vehicle {
  + startEngine()
}
class Car {
  - make: String
  + startEngine()
}
class Sedan
class SUV
Car ..|> Vehicle
Sedan --|> Car
SUV --|> Car
callout top of text "«interface»" : Interface: a contract of public operations
callout right of shape polygon occurrence 1 : Realization: fulfills the interface contract
callout left of shape polygon occurrence 2 : Generalization: also a kind of the superclass
@enduml'></div>

### Dependency (Weakest Relationship)

A dependency indicates that one class *uses* another, but does not hold a permanent reference to it. For example, a class might use another class as a method parameter, local variable, or return type. Dependency is the weakest relationship in a class diagram.
* **UML Symbol:** <span class="uml-sym" data-diagram="class" data-sym="..>"></span> A **dashed line** with an open arrowhead.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Train {
  # addStop(stop: ButtonPressedEvent)
  + startTrain(velocity: Real)
}
class ButtonPressedEvent
Train ..> ButtonPressedEvent
callout bottom of edge 1 middle : Dependency: the client needs the supplier
@enduml'></div>

In this example, `Train` depends on `ButtonPressedEvent` because it uses it as a parameter type in `addStop()`. However, `Train` does not store a permanent reference to `ButtonPressedEvent`---the dependency exists only for the duration of the method call.

Here is another example where a class depends on an exception it throws:

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class ChecksumValidator {
  + execute(): Boolean
  + validate()
}
class InvalidChecksumException
ChecksumValidator ..> InvalidChecksumException
callout bottom of edge 1 middle : Dependency: the client needs the supplier
@enduml'></div>


### Association --- "Has-A" / "Knows-A" Relationships

A structural relationship that describes links between objects of the participating classes (e.g., a "Teacher" knows about a "Student"). The association is the description; each link is one connection between particular objects. Attributes can also be represented as association lines: a line is drawn between the owning class and the target attribute's class, providing a quick visual indication of which classes are related.
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
callout bottom of text "1..*" : Multiplicity 1..*: at least one
callout top of text "*" : Multiplicity *: zero or more
callout bottom of edge 1 middle : Association: a type of link between objects
@enduml'></div>

{% include uml-code-lab.html example="dependency" %}

#### Multiplicities

Along association lines, we use numbers to define *how many* objects are involved. Show multiplicity on **both** ends when the design defines both constraints. If code only establishes one end, leave the other unspecified rather than assuming `1`.

| Notation | Meaning |
|----------|---------|
| `1` | Exactly one |
| `0..1` | Zero or one (optional) |
| `*` or `0..*` | Zero to many |
| `1..*` | One to many (at least one required) |

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Author
class Book
Author "1" -- "1..*" Book : writes
callout top of text "1" : Multiplicity 1: exactly one
callout bottom of text "1..*" : Multiplicity 1..*: at least one
@enduml'></div>

#### Navigability

When neither end of an association is annotated with an arrowhead or X mark, navigability is formally **undefined** in UML 2.5 {% cite OMG2017UML %}. By convention, many authors and tools render this case as **bidirectional** (both classes know about each other), but you should not rely on the default — make navigability explicit when it matters. In practice, the relationship is often one-way: only one class holds a reference to the other. UML uses arrowheads and X marks to show this **navigability**.

* **Navigable end** <span class="uml-sym" data-diagram="class" data-sym="-->"></span> An **open arrowhead** pointing to the class that can be "reached". The left object has a reference to the right object.
* **Non-Navigable end** <span class="uml-sym" data-diagram="class" data-sym="--x"></span> An **X** on the end that cannot be navigated. This explicitly states that the class at the X end does *not* hold a reference to the other.

Here are the four navigability combinations, each with an example:

**One direction specified (one arrowhead):** Navigation toward the arrowhead is specified; an unmarked reverse direction remains unspecified.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Vote
class Politician
Vote --> Politician
callout bottom of edge 1 end : Navigability: reachable from the other end
@enduml'></div>

`Vote` can navigate to `Politician`. This notation alone does not say whether `Politician` can navigate back to individual `Vote` objects; an X at the reverse end would explicitly mark it non-navigable.

**Bidirectional (arrowheads on both ends):** Both classes hold a reference to each other.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Employee
class Boss
Employee <--> Boss
callout bottom of edge 1 middle : Two arrows: each end can reach the other
@enduml'></div>

`Employee` knows about their `Boss`, and `Boss` knows about their `Employee`. Note that a plain line with no arrowheads on either end has **unspecified** navigability per UML 2.5 {% cite OMG2017UML %} — not "bidirectional by default." If you mean both directions are navigable, draw arrowheads on both ends (as above) to make that explicit.

**Non-navigable on one end (X on one side):** One class is explicitly prevented from navigating.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Voter
class Vote
Voter x-- Vote
callout bottom of edge 1 start : X: this end is not navigable
@enduml'></div>

In the full UML notation, an X on the `Voter` end means that the *opposite* lifeline cannot navigate to it — i.e., `Vote` does *not* hold a reference back to `Voter`. (`Voter`'s navigability toward `Vote` is then determined by whatever is marked on the `Vote` end.) Note: the X mark is a formal UML 2 notation that many simplified tools do not render, and per UML 2.5, when one end carries a navigability arrow but the other end is unmarked, the unmarked end's navigability is formally **undefined**, not "non-navigable" by default {% cite OMG2017UML %}.

**Non-navigable on both ends (X on both sides):** Neither class holds a reference---the association is recorded only in the model, not in code.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Account
class ClearTextPassword
Account x--x ClearTextPassword
callout bottom of edge 1 start : Two X marks: neither end is navigable
@enduml'></div>

An X on both ends of `Account`<span class="uml-sym" data-diagram="class" data-sym="x--x"></span>`ClearTextPassword` means neither class should store a reference to the other. This is a deliberate design decision (e.g., for security: an `Account` should never hold a reference to a `ClearTextPassword`).

**When to use navigability:** Navigability is a design-level detail. In analysis/domain models, plain associations (no arrowheads) are preferred because you haven't decided which class holds the reference yet. Once you move into detailed design, add navigability to show which class stores the reference---this maps directly to code (a field/attribute in the class at the arrow tail).

#### Aggregation ("Owns-A")

A whole-part association that does not claim exclusive ownership. UML does not fix the part's lifecycle: in this example, if a University closes, the Professors still exist, but another model could choose a different rule. The hollow diamond marks the whole-part idea; it is not, by itself, a lifetime contract.
* **UML Symbol:** <span class="uml-sym" data-diagram="class" data-sym="o--"></span> A solid line with an **empty diamond** at the "whole" end.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class University
class Professor
University "1" o-- "*" Professor
callout bottom of edge 1 start : Aggregation: whole-part, not exclusive ownership
@enduml'></div>

{% include uml-code-lab.html example="collection_multiplicity" %}

#### Composition ("Is-Made-Up-Of")

A relationship with exclusive composite ownership: deleting the whole deletes its current parts. A part may belong to **at most one** composite at a time and may be detached before deletion, if the model allows it. UML does not prescribe where or in what order these objects are created. In this House/Room model, deleting a house deletes its rooms.
* **UML Symbol:** <span class="uml-sym" data-diagram="class" data-sym="*--"></span> A solid line with a **filled diamond** at the "whole" end.
* Per the UML spec, the multiplicity on the composite end must be `1` or `0..1` {% cite OMG2017UML %}.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class House
class Room
House "1" *-- "1..*" Room
callout bottom of edge 1 start : Composition: exclusive owner; parts die with it
@enduml'></div>

**Relating the model to code:** C++ value members provide concrete evidence of a part lifetime tied to its containing object. Pointers and references alone do not justify aggregation. Java and Python reference storage likewise does not establish whole-part ownership: creation location, injection, and nested class syntax are insufficient. Choose diamonds from explicit ownership and lifecycle contracts.

> **⚠ Honest caveat on aggregation.** Aggregation has *intentionally informal* semantics in the UML 2 specification {% cite OMG2017UML %}. Martin Fowler observes: *"Aggregation is strictly meaningless; as a result, I recommend that you ignore it in your own diagrams."* {% cite Fowler2003 %} When you aren't sure whether something is aggregation or plain association, use **association** — it is always safe. Reserve the hollow diamond for the cases where part-whole semantics clearly add communicative value.

> **Quick Check 2 (Self-Explanation)**
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
<tr><td><strong>Aggregation</strong></td><td><span class="uml-sym" data-diagram="class" data-sym="o--"></span> Hollow diamond</td><td>whole-part, not exclusive ownership</td><td>Library has Books</td></tr>
<tr><td><strong>Composition</strong></td><td><span class="uml-sym" data-diagram="class" data-sym="*--"></span> Filled diamond</td><td>"made up of" (parts die with whole)</td><td>House is made of Rooms</td></tr>
<tr><td><strong>Generalization</strong></td><td><span class="uml-sym" data-diagram="class" data-sym="--|>"></span> Hollow triangle</td><td>"is-a" (inheritance)</td><td>Car is-a Vehicle</td></tr>
<tr><td><strong>Realization</strong></td><td><span class="uml-sym" data-diagram="class" data-sym="..|>"></span> Dashed hollow triangle</td><td>"implements" (interface)</td><td>Car implements Drivable</td></tr>
</tbody>
</table>


## ⚠ The Five Most Common UML Class Diagram Mistakes

Empirical studies of student diagrams {% cite Chren2019 %} identify these recurring errors. Watch for them in your own work:

| # | Mistake | Fix |
|---|---|---|
| 1 | **Generalization arrow pointed the wrong way** — triangle at the child instead of the parent | The triangle *always* rests at the **parent**. Sanity-check with the "is-a" sentence: *"A [child] is a [parent]"*. |
| 2 | **Multiplicity on the wrong end** — e.g., `*` placed next to the "one" side | Multiplicity answers *"for one of the opposite class, how many of **this** class?"* Place it next to the class being quantified. |
| 3 | **Missing multiplicity on one end** | Following guideline G117, always show multiplicity on **both** ends of every relationship {% cite Ambler2005 %}. An unlabeled end is ambiguous, not "just 1." |
| 4 | **Confusing aggregation and composition** — using the filled diamond when the part is not exclusively owned | Composition means at most one owner, and parts are deleted with that owner unless detached first. A hollow diamond only marks a whole-part group; it does not fix the part's lifecycle. When that distinction is not doing work, use a plain association. |
| 5 | **Verbose `0..*` when `*` suffices** | Use the shorthand `*` for zero-or-more. The UML spec defines them as identical {% cite OMG2017UML %}; `*` is more concise. Reserve `0..*` only when contrasting explicitly with `1..*` nearby. |

> **Pedagogy tip:** Before turning in any class diagram, run this five-item checklist over every relationship. Catching these five mistakes catches the majority of grading-level errors.

## Advanced Class Notation

### Abstract Classes and Operations

An **abstract class** is a class that cannot be instantiated directly---it serves as a base for subclasses. In UML, an abstract class is indicated by *italicizing* the class name or adding `{abstract}`.

An **abstract operation** has no implementation in this class. A more specific concrete class must supply one. Abstract operations are shown by *italicizing* the operation name.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
abstract class Shape {
  - color: Integer
  + setColor(r: Integer, g: Integer, b: Integer)
  {abstract} + draw()
}
class Rectangle {
  - width: Integer
  - length: Integer
  + setWidth(width: Integer)
  + setHeight(height: Integer)
  + draw()
}
Rectangle --|> Shape
callout left of text "Shape" : Abstract class: cannot be instantiated directly
callout right of text "draw()" occurrence 1 : Abstract operation: a descendant must implement it
callout left of shape polygon occurrence 1 : Generalization: also a kind of the superclass
@enduml'></div>

In this example, `Shape` is abstract (it cannot be created directly) and declares an abstract `draw()` method. `Rectangle` inherits from `Shape` and provides a concrete implementation of `draw()`.

### Static Members

**Static** (class-level) attributes and operations belong to the class itself rather than to individual instances. In UML, static members are shown **underlined**.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class MathUtils {
  {static} +PI: Real
  {static} +abs(n: Integer): Integer
  +round(n: Real): Integer
}
callout right of text "PI: Real" : Static member: one value of the class, not each object
callout left of text "+abs(n: Integer): Integer" : Operation: name(parameters): return type
@enduml'></div>


## From Code to Diagram: Worked Examples

A key skill is translating between code and UML class diagrams. Let's work through several examples that progressively build this skill.

### Example 1: A Simple Class

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Simple class code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
public class BaseSynchronizer {
    public void synchronizationStarted() { }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
class BaseSynchronizer {
public:
    void synchronizationStarted() { }
};
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
class BaseSynchronizer:
    def synchronization_started(self) -> None:
        pass
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
class BaseSynchronizer {
  synchronizationStarted(): void { }
}
```
  </div>
</div>

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class BaseSynchronizer {
  + synchronizationStarted()
}
callout right of text "synchronizationStarted()" : Operation: name and parameters
@enduml'></div>

Each public method becomes a `+` operation in the bottom compartment. A result type follows a colon when shown. This design sketch omits the known no-result suffix; the source expresses it with `void` or Python's `-> None`.

### Example 2: Attributes and Associations

When a class holds a reference to another class, you can show it either as an attribute *or* as an association line (but be consistent throughout your diagram).

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Association code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
public class Student {
    Roster roster;

    public void storeRoster(Roster r) {
        roster = r;
    }
}

class Roster { }
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
class Roster { };

class Student {
public:
    void storeRoster(Roster& r) {
        roster = &r;
    }

private:
    Roster* roster = nullptr;
};
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
class Roster:
    pass


class Student:
    def __init__(self) -> None:
        self._roster: Roster | None = None

    def store_roster(self, roster: Roster) -> None:
        self._roster = roster
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
class Roster { }

class Student {
  private roster?: Roster;

  storeRoster(roster: Roster): void {
    this.roster = roster;
  }
}
```
  </div>
</div>

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Student {
  ~ roster: Roster
  + storeRoster(r: Roster)
}
class Roster
Student --> Roster
callout left of text "~" : Package visibility: visible in the enclosing package
callout bottom of edge 1 end : Navigability: Student can reach the Roster
@enduml'></div>

Notice: in the Java version, the `roster` field has package visibility (`~`) because no access modifier was specified (Java default is package-private). Other languages express visibility differently, but the relationship is the same: `Student` holds a reference to a `Roster`.

### Example 3: Dependency from Exception Handling

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Exception dependency code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
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

class InvalidChecksumException extends Exception { }
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <exception>

class InvalidChecksumException : public std::exception { };

class ChecksumValidator {
public:
    bool execute() {
        try {
            validate();
        } catch (const InvalidChecksumException&) {
            // handle error
        }
        return true;
    }

    void validate() { }
};
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
class InvalidChecksumException(Exception):
    pass


class ChecksumValidator:
    def execute(self) -> bool:
        try:
            self.validate()
        except InvalidChecksumException:
            # handle error
            pass
        return True

    def validate(self) -> None:
        pass
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
class InvalidChecksumException extends Error { }

class ChecksumValidator {
  execute(): boolean {
    try {
      this.validate();
    } catch (error) {
      if (!(error instanceof InvalidChecksumException)) throw error;
      // handle error
    }
    return true;
  }

  validate(): void { }
}
```
  </div>
</div>

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class ChecksumValidator {
  + execute(): Boolean
  + validate()
}
class InvalidChecksumException
ChecksumValidator ..> InvalidChecksumException
callout bottom of edge 1 middle : Dependency: the client needs the supplier
@enduml'></div>

The `ChecksumValidator` *depends on* `InvalidChecksumException` (it uses it in a throws clause and catch block) but does not store a permanent reference to it. This is a dependency, not an association.

### Example 4: Composition from Inner Classes

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Composition code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
public class MotherBoard {
    private class IDEBus { }

    private final IDEBus primaryIDE = new IDEBus();
    private final IDEBus secondaryIDE = new IDEBus();
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
class MotherBoard {
    class IDEBus { };

    IDEBus primaryIDE;
    IDEBus secondaryIDE;
};
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
class MotherBoard:
    class _IDEBus:
        pass

    def __init__(self) -> None:
        self._primary_ide: MotherBoard._IDEBus = MotherBoard._IDEBus()
        self._secondary_ide: MotherBoard._IDEBus = MotherBoard._IDEBus()
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
class IDEBus { }

class MotherBoard {
  private readonly primaryIDE = new IDEBus();
  private readonly secondaryIDE = new IDEBus();
}
```
  </div>
</div>

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class MotherBoard {
  - primaryIDE: IDEBus
  - secondaryIDE: IDEBus
}
class IDEBus
MotherBoard "1" *-- "1" IDEBus : primaryIDE
MotherBoard "1" *-- "1" IDEBus : secondaryIDE
callout bottom of text "primaryIDE" occurrence 1 : Role name: the part these objects play
callout top of shape polygon occurrence 1 : Composition: exclusive owner; parts die with it
@enduml'></div>

**Reference design:** each motherboard has one primary bus and one secondary bus, and this model assigns their lifetimes to the motherboard. The two roles stay separate in the live inference, but Java, Python, and TypeScript allocation patterns alone do not establish the diamonds or all multiplicity bounds. C++ value members provide stronger lifetime evidence. The reference design states the intended contract; it is not a language-independent prediction of analyzer output.

> **Quick Check (Generation):** Before looking at the answer below, try to draw the UML class diagram for this code:
> ```java
> import java.util.ArrayList;
> import java.util.List;
> class Employee { }
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
>   - division: Sequence&lt;Employee&gt;
>   - employees: Employee[]
> }
> class Employee
> Division --> "*" Employee : division
> Division --> "*" Employee : employees
> callout bottom of text "*" occurrence 1 : Multiplicity *: zero or more
> callout top of edge 1 middle : Association: stored references, ownership unspecified
> callout bottom of edge 2 end : Navigability: Division can reach Employees
> @enduml'></div>
>
> The two roles remain separate. Both stored collections use ordinary associations. Neither the list type nor creating its container establishes a whole-part ownership contract. The array relationship is an association: <code>new Employee[10]</code> creates ten initially null reference slots, not ten employees. The field's array type permits zero or more referenced employees (<code>*</code>); the initializer alone does not establish an invariant of exactly ten links. A domain rule and supporting code would be needed to require an exact number.
> </details>


## Putting It All Together: The E-Commerce System

*Pedagogical Note: We are now combining isolated concepts into a complex schema. This reflects how you will encounter UML in the real world.*

Let's read the architectural blueprint for a simplified E-Commerce system.

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
layout square
class User {
  + search(query: String): Sequence<?>
  + createPlaylist(name: String): Playlist
}
class FreeUser
class PremiumUser {
  + download(track: Track)
}
class Playlist {
  + addTrack(t: Track)
}
class Track {
  + title: String
  + duration: Integer
}
class Artist {
  + name: String
}
FreeUser --|> User
PremiumUser --|> User
User "1" *-- "*" Playlist : owns
Playlist "*" o-- "*" Track : contains
Track "*" -- "1..*" Artist : performedBy
callout right of text "performedBy" : Association: a type of link between objects
callout bottom of shape polygon occurrence 1 : Generalization: also a kind of the superclass
callout top of shape polygon occurrence 2 : Composition: exclusive owner; parts die with it
callout left of text "1..*" : Multiplicity 1..*: at least one
callout bottom of shape polygon occurrence 3 : Aggregation: whole-part, not exclusive ownership
callout right of text "duration: Integer" : Attributes: values each object stores
callout bottom of text "+addTrack(t: Track)" : Operations: behavior that can be invoked
@enduml'></div>

**What the UML notation captures:**

1. **Generalization (hollow triangle):** `FreeUser` and `PremiumUser` both extend `User`, inheriting `search()` and `createPlaylist()`. Only `PremiumUser` adds `download()` — a capability unlocked by upgrading. The hollow triangle always points *up* toward the parent class.
2. **Composition (filled diamond, User → Playlist):** A `User` *owns* their playlists. Deleting a user account deletes their playlists — the parts cannot outlive the whole. The filled diamond sits on the *owner's* side.
3. **Aggregation (hollow diamond, Playlist → Track):** A `Playlist` *contains* tracks, but tracks exist independently — the same track can appear in many playlists. Deleting a playlist does not remove the track from the catalog.
4. **Association with multiplicity (Track → Artist):** Each track is performed by `1..*` artists — at least one (solo) or more (collaboration). This multiplicity directly encodes a real business rule.

> **Analysis vs. design level:** This diagram has no visibility modifiers (`+`, `-`). That is intentional — at the analysis level we model *what things are and do*, not encapsulation decisions. Visibility is a design-level concern added in a later phase.


### Example 2: GitHub — Pull Request Design Model

**Scenario:** A design-level diagram (note the visibility modifiers) showing how GitHub's code review system could be modeled internally. Notice how an interface creates a formal contract between components.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface Mergeable {
  + canMerge(): Boolean
  + merge()
}
class Repository {
  - name: String
  - isPrivate: Boolean
  + openPR(title: String): PullRequest
}
class PullRequest {
  - title: String
  - status: String
  + addReview(r: Review)
  + canMerge(): Boolean
  + merge()
}
class Review {
  - verdict: String
  + approve()
  + requestChanges()
}
class CICheck {
  - passed: Boolean
  + getResult(): Boolean
}
PullRequest ..|> Mergeable
Repository "1" *-- "*" PullRequest
PullRequest "1" *-- "*" Review
PullRequest ..> CICheck
callout top of text "«interface»" : Interface: a contract of public operations
callout left of shape polygon occurrence 1 : Realization: fulfills the interface contract
callout right of shape polygon occurrence 2 : Composition: exclusive owner; parts die with it
callout right of edge 3 end : Dependency: the client needs the supplier
callout right of text "-verdict: String" : Attributes: values each object stores
callout right of text "getResult(): Boolean" : Operations: behavior that can be invoked
callout left of text "*" occurrence 2 : Multiplicity *: zero or more
@enduml'></div>

**What the UML notation captures:**

1. **Interface Realization (dashed hollow arrow):** `PullRequest` implements `Mergeable` — a contract committing the class to provide `canMerge()` and `merge()`. A merge pipeline can work with any `Mergeable` object without knowing the concrete type.
2. **Composition (Repository → PullRequest):** A PR cannot exist without its repository. Delete the repo, and all its PRs are deleted — the filled diamond on `Repository`'s side shows ownership.
3. **Composition (PullRequest → Review):** A review only exists in the context of one PR. `1 *-- *` reads: one PR can have zero or more reviews; each review belongs to exactly one PR.
4. **Dependency (dashed open arrow, PullRequest → CICheck):** `PullRequest` *uses* `CICheck` temporarily — perhaps receiving it as a method parameter. It does not hold a permanent field reference, so this is a dependency, not an association.


### Example 3: Uber Eats — Food Delivery Domain Model

**Scenario:** The domain model for a food delivery platform. This example is excellent for practicing multiplicity — every `0..1`, `1`, and `*` encodes a real business rule the engineering team must enforce.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout square
class Customer {
  - name: String
  - address: String
}
class Order {
  - placedAt: DateTime
  - status: String
  + calcTotal(): Real
}
class OrderItem {
  - quantity: Integer
  - unitPrice: Real
}
class MenuItem {
  - name: String
  - price: Real
}
class Restaurant {
  - name: String
  - rating: Real
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
callout bottom of text "+calcTotal(): Real" : Operations: behavior that can be invoked
callout right of text "-vehicleType: String" : Attributes: values each object stores
callout left of text "0..1" occurrence 1 : Multiplicity 0..1: zero or one
callout bottom of text "1..*" occurrence 2 : Multiplicity 1..*: at least one
callout top of shape polygon occurrence 1 : Composition: exclusive owner; parts die with it
callout top of edge 1 middle : Association: a type of link between objects
@enduml'></div>

**What the UML notation captures:**

1. **`Customer "1" -- "*" Order`:** One customer can have zero orders (a new account) or many. The navigability arrow shows `Customer` holds the reference — in code, a `Customer` would have an `orders` collection field.
2. **Composition (Order → OrderItem):** Order items only exist within an order. Cancelling the order destroys the items. The `1..*` on `OrderItem` enforces that every order must have at least one item.
3. **`OrderItem "*" -- "1" MenuItem`:** Each item references exactly one menu item. Many orders can reference the same menu item — deleting an order does **not** remove the menu item from the restaurant's catalog.
4. **`Driver "0..1" -- "0..1" Order`:** A driver handles at most one active delivery at a time; an order has at most one assigned driver. Before dispatch, both sides satisfy `0` — neither requires the other to exist yet. This captures a real business constraint in two characters.


### Example 4: Netflix — Content Catalogue Model

**Scenario:** Netflix serves two fundamentally different types of content — movies (watched once) and TV shows (composed of seasons and episodes). This diagram shows how inheritance and composition work together to model a content catalog.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
abstract class Content {
  # title: String
  # rating: String
  {abstract} + play()
}
class Movie {
  - duration: Integer
  + play()
}
abstract class TVShow
class Season {
  - seasonNumber: Integer
}
class Episode {
  - episodeNumber: Integer
  - duration: Integer
  + play()
}
class Genre {
  - name: String
}
Movie --|> Content
TVShow --|> Content
TVShow "1" *-- "1..*" Season : contains
Season "1" *-- "1..*" Episode : contains
Content "*" -- "1..*" Genre : classifiedBy
callout left of text "Content" : Abstract class: cannot be instantiated directly
callout right of text "play()" : Abstract operation: a descendant must implement it
callout left of shape polygon occurrence 1 : Generalization: also a kind of the superclass
callout left of shape polygon occurrence 2 : Composition: exclusive owner; parts die with it
callout right of text "1..*" : Multiplicity 1..*: at least one
callout right of text "classifiedBy" : Association: a type of link between objects
@enduml'></div>

**What the UML notation captures:**

1. **Abstract class (`abstract class Content`):** The italicised class name and `{abstract}` on `play()` signal that `Content` is never instantiated directly — you never watch a "content", only a `Movie` or an `Episode`. `Movie` overrides `play()` with its own implementation. `TVShow` is also abstract (it inherits `play()` without overriding it) — you don't play a show as a whole, you play one of its `Episode`s, which provides its own concrete `play()`.
2. **Generalization hierarchy:** Both `Movie` and `TVShow` extend `Content`, inheriting `title` and `rating`. A `Movie` adds `duration` directly; a `TVShow` delegates duration implicitly through its episodes.
3. **Nested composition (`TVShow → Season → Episode`):** A `TVShow` is composed of seasons; each season is composed of episodes. Delete a show and the seasons disappear; delete a season and the episodes disappear. The chain of filled diamonds models this cascade.
4. **Association with multiplicity (`Content → Genre`):** A movie or show belongs to `1..*` genres (at least one — e.g., Action). A genre classifies `*` content items. This is a plain association — deleting a genre does not delete the content.


### Example 5: Strategy Pattern — Pluggable Payment Processing

**Scenario:** A shopping cart needs to support multiple payment methods (credit card, PayPal, crypto) and let users switch between them at runtime. This is the [**Strategy design pattern**](/SEBook/designpatterns/strategy.html) — and a class diagram is the canonical way to document it.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout square
interface PaymentStrategy {
  + pay(amount: Real): Boolean
  + refund(amount: Real): Boolean
}
class CreditCardPayment {
  - cardNumber: String
  - cvv: String
  + pay(amount: Real): Boolean
  + refund(amount: Real): Boolean
}
class PayPalPayment {
  - email: String
  + pay(amount: Real): Boolean
  + refund(amount: Real): Boolean
}
class CryptoPayment {
  - walletAddress: String
  + pay(amount: Real): Boolean
  + refund(amount: Real): Boolean
}
class ShoppingCart {
  - items: Sequence<?>
  - strategy: PaymentStrategy
  + setPayment(s: PaymentStrategy)
  + checkout(): Boolean
}
CreditCardPayment ..|> PaymentStrategy
PayPalPayment ..|> PaymentStrategy
CryptoPayment ..|> PaymentStrategy
ShoppingCart --> PaymentStrategy : uses
callout right of text "«interface»" : Interface: a contract of public operations
callout left of shape polygon occurrence 1 : Realization: fulfills the interface contract
callout right of edge 1 end : Navigability: the cart can reach the strategy
callout left of text "-walletAddress: String" : Attributes: values each object stores
callout right of text "refund(amount: Real): Boolean" : Operations: behavior that can be invoked
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


## 6. Practice

Test your knowledge with these retrieval practice exercises. These diagrams are rendered dynamically to ensure you can recognize UML notation in any context.

{% include flashcards.html id="uml_class_diagram_examples" %}

{% include quiz.html id="uml_class_diagram_examples" %}

*Pedagogical Tip: If you find these challenging, it's a good sign! Effortful retrieval is exactly what builds durable mental models. Try coming back to these tomorrow to benefit from [spacing and interleaving](/blog/evidence-based-study-tips-for-college-students/).*
