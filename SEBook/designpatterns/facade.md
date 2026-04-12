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
*   **Façade vs. Adapter:** It is important to distinguish this from the **Adapter Pattern**. While an Adapter's intent is to *convert* one interface into another to match a client's expectations, a Façade's intent is solely to *simplify* a complex set of interfaces.
*   **Flexibility:** Clients that still need the power of the low-level interfaces can still access them directly; the Façade does not "trap" the subsystem, it just provides a more convenient way to use it for common tasks.
