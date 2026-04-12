---
title: Façade Design Pattern
layout: sebook
---

# Context
In modern software construction, we often build systems composed of multiple complex subsystems that must collaborate to perform a high-level task. A classic example is a **Home Theater System**. This system consists of various independent components: an amplifier, a DVD player, a projector, a motorized screen, theater lights, and even a popcorn popper. While each of these components is a powerful "module" on its own, they must be coordinated precisely to provide a seamless user experience.

# Problem
When a client needs to interact with a set of complex subsystems, several issues arise:
1.  **High Complexity:** To perform a single logical action like "Watch a Movie," the client might have to execute a long sequence of manual steps—turning on the popper, dimming lights, lowering the screen, configuring the projector input, and finally starting the DVD player.
2.  **Maintenance Nightmares:** If the movie finishes, the user has to perform all those steps again in reverse order. If a component is upgraded (e.g., replacing a DVD player with a streaming device), every client that uses the system must learn a new, slightly different procedure.
3.  **Tight Coupling:** The client code becomes "intimate" with every single class in the subsystem. This violates the principle of **Information Hiding**, as the client must understand the internal low-level details of how each device operates just to use the system.

# Solution
The **Façade Pattern** provides a unified interface to a set of interfaces in a subsystem. It defines a higher-level interface that makes the subsystem easier to use by wrapping complexity behind a single, simplified object.

In the Home Theater example, we create a `HomeTheaterFacade`. Instead of the client calling twelve different methods on six different objects, the client calls one high-level method: `watchMovie()`. The Façade object then handles the "dirty work" of delegating those requests to the underlying subsystems. This creates a single point of use for the entire component, effectively hiding the complex "how" of the implementation from the outside world.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
class Client
class Facade {
	+ operation(): void
}
class SubsystemA {
	+ stepA(): void
}
class SubsystemB {
	+ stepB(): void
}
class SubsystemC {
	+ stepC(): void
}
Client --> Facade : uses >
Facade --> SubsystemA
Facade --> SubsystemB
Facade --> SubsystemC
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
class MovieNightClient
class HomeTheaterFacade {
	+ watchMovie(title: String): void
	+ endMovie(): void
}
class Amplifier
class Projector
class StreamingPlayer
class TheaterLights
class Screen
class PopcornPopper
MovieNightClient --> HomeTheaterFacade
HomeTheaterFacade --> Amplifier
HomeTheaterFacade --> Projector
HomeTheaterFacade --> StreamingPlayer
HomeTheaterFacade --> TheaterLights
HomeTheaterFacade --> Screen
HomeTheaterFacade --> PopcornPopper
@enduml'></div>

## Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant client: MovieNightClient
participant facade: HomeTheaterFacade
participant lights: TheaterLights
participant screen: Screen
participant projector: Projector
participant amp: Amplifier
participant player: StreamingPlayer
participant popper: PopcornPopper
client -> facade: watchMovie("Raiders")
activate facade
facade -> popper: on()
facade -> lights: dim(10)
facade -> screen: down()
facade -> projector: on()
facade -> amp: on()
facade -> player: play("Raiders")
deactivate facade
@enduml'></div>

# Consequences
Applying the Façade pattern leads to several architectural benefits and trade-offs:
*   **Simplified Interface:** The primary intent of a Façade is to simplify the interface for the client.
*   **Reduced Coupling:** It decouples the client from the subsystem. Because the client only interacts with the Façade, internal changes to the subsystem (like adding a new device) do not require changes to the client code.
*   **Improved Information Hiding:** It promotes modularity by ensuring that the low-level details of the subsystems are "secrets" kept within the component.
*   **Flexibility:** Clients that still need the power of the low-level interfaces can still access them directly; the Façade does not "trap" the subsystem, it just provides a more convenient way to use it for common tasks. This is a critical point: **a Facade is a convenience, not a prison**.

# Design Decisions

## Single vs. Multiple Facades
When a subsystem is large, a single Facade can become a "god class" that handles too many concerns. In such cases, create **multiple facades**, each responsible for a different aspect of the subsystem (e.g., `HomeTheaterPlaybackFacade` and `HomeTheaterSetupFacade`). This keeps each Facade cohesive and manageable.

## Facade Awareness
Subsystem classes should **not know** about the Facade. The Facade knows the subsystem internals and delegates to them, but the subsystem components remain fully independent. This one-directional knowledge ensures the subsystem can be used without the Facade and can be tested independently.

## Abstract Facade
When testability matters or when the subsystem may have platform-specific implementations, define the Facade as an **interface or abstract class**. This allows test doubles to substitute for the real Facade, and enables different Facade implementations for different platforms.

# Distinguishing Facade from Related Patterns

The Facade is often confused with Adapter and Mediator because all three involve intermediary objects. The distinctions are:

| Pattern | Intent | Communication Direction |
|---------|--------|------------------------|
| **Façade** | *Simplify* a complex subsystem into a convenient interface | One-directional: Facade calls subsystem; subsystem is unaware |
| **[Adapter](/SEBook/designpatterns/adapter.html)** | *Convert* an incompatible interface into a compatible one | One-directional: Adapter translates between client and adaptee |
| **[Mediator](/SEBook/designpatterns/mediator.html)** | *Coordinate* interactions between peer objects | Bidirectional: colleagues communicate through the mediator, and the mediator communicates back |

A Facade simplifies; an Adapter translates; a Mediator coordinates. If the intermediary simply delegates without adding coordination logic, it is a Facade. If it translates between incompatible interfaces, it is an Adapter. If it manages bidirectional communication and control flow between peers, it is a Mediator.

# Flashcards

{% include flashcards.html id="design_pattern_structural" %}

# Quiz

{% include quiz.html id="design_pattern_structural" %}
