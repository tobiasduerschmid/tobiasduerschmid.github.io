---
title: Singleton Design Pattern
layout: sebook
---

# Context
In software engineering, certain classes represent concepts that should only exist once during the entire execution of a program. Common examples include thread pools, caches, dialog boxes, logging objects, and device drivers. In these scenarios, having more than one instance is not just unnecessary but often harmful to the system’s integrity. In a UML class diagram, this requirement is explicitly modeled by specifying a multiplicity of "1" in the upper right corner of the class box, indicating the class is intended to be a singleton.

# Problem
The primary problem arises when instantiating more than one of these unique objects leads to incorrect program behavior, resource overuse, or inconsistent results. For instance, accidentally creating two distinct "Earth" objects in a planetary simulation would break the logic of the system. 

While developers might be tempted to use global variables to manage these unique objects, this approach introduces several critical flaws:
*   **High Coupling:** Global variables allow any part of the system to access and potentially mess around with the object, creating a web of dependencies that makes the code hard to maintain.
*   **Lack of Control:** Global variables do not prevent a developer from accidentally calling the constructor multiple times to create a second, distinct instance.
*   **Instantiation Issues:** You may want the flexibility to choose between "eager instantiation" (creating the object at program start) or "lazy instantiation" (creating it only when first requested), which simple global variables do not inherently support.

# Solution
The **Singleton Pattern** solves these issues by ensuring a class has only one instance while providing a controlled, global point of access to it. The solution consists of three main implementation aspects:
1.  **A Private Constructor:** By declaring the constructor `private`, the pattern prevents external classes from ever using the `new` keyword to create an instance.
2.  **A Static Field:** The class maintains a private static variable (often named `uniqueInstance`) to hold its own single instance.
3.  **A Static Access Method:** A public static method, typically named `getInstance()`, serves as the sole gateway to the object.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class Singleton {
	- uniqueInstance: Singleton {static}
	- Singleton()
	+ getInstance(): Singleton {static}
	+ operation(): void
}
class ClientA
class ClientB
ClientA --> Singleton : getInstance()
ClientB --> Singleton : getInstance()
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout horizontal
layout landscape
class ChocolateBoiler {
	- empty: bool
	- boiled: bool
	- uniqueInstance: ChocolateBoiler {static}
	- ChocolateBoiler()
	+ getInstance(): ChocolateBoiler {static}
	+ fill(): void
	+ boil(): void
	+ drain(): void
}
class CandyMaker
class CleaningCycle
CandyMaker --> ChocolateBoiler : uses
CleaningCycle --> ChocolateBoiler : uses
@enduml'></div>

## Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant maker: CandyMaker
participant cleaner: CleaningCycle
participant boiler: ChocolateBoiler
maker -> boiler: getInstance()
activate boiler
boiler --> maker: instance
deactivate boiler
cleaner -> boiler: getInstance()
activate boiler
boiler --> cleaner: same instance
deactivate boiler
maker -> boiler: fill()
cleaner -> boiler: drain()
@enduml'></div>

## Refining the Solution: Thread Safety and Performance
The "Classic Singleton" implementation uses **lazy instantiation**, checking if the instance is `null` before creating it. However, this is not thread-safe; if two threads call `getInstance()` simultaneously, they might both find the instance to be `null` and create two separate objects. 

There are several ways to handle this in Java:
*   **Synchronized Method:** Adding the `synchronized` keyword to `getInstance()` makes the operation atomic but introduces significant performance overhead, as every call to get the instance is forced to wait in a queue, even after the object has already been created.
*   **Eager Instantiation:** Creating the instance immediately when the class is loaded avoids thread issues entirely but wastes memory if the object is never actually used during execution.
*   **Double-Checked Locking:** This advanced approach uses the `volatile` keyword on the instance field to ensure it is handled correctly across threads. It checks for a `null` instance twice—once before entering a synchronized block and once after—minimizing the performance hit of synchronization to only the very first time the object is created.

# Consequences
Applying the Singleton Pattern results in several important architectural outcomes:
*   **Controlled Access:** The pattern provides a single point of access that can be easily managed and updated.
*   **Resource Efficiency:** It prevents the system from being cluttered with redundant, resource-intensive objects.
*   **The Risk of "Singleitis":** A major drawback is the tendency for developers to overuse the pattern. Using a Singleton just for easy global access can lead to a hard-to-maintain design with high coupling, where it becomes unclear which classes depend on the Singleton and why.
*   **Complexity in Testing:** Singletons can be difficult to mock during unit testing because they maintain state throughout the lifespan of the application.
