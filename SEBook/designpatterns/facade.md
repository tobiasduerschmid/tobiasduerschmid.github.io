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
3.  **Tight Coupling:** The client code becomes "intimate" with every single class in the subsystem. This violates the principle of [**Information Hiding**](/SEBook/designprinciples/informationhiding.html), as the client must understand the internal low-level details of how each device operates just to use the system.

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
activate popper
deactivate popper
facade -> lights: dim(10)
activate lights
deactivate lights
facade -> screen: down()
activate screen
deactivate screen
facade -> projector: on()
activate projector
deactivate projector
facade -> amp: on()
activate amp
deactivate amp
facade -> player: play("Raiders")
activate player
deactivate player
deactivate facade
@enduml'></div>

# Code Example

This example gives clients one intention-revealing operation, `watchMovie()`, while the facade coordinates the subsystem calls in the required order.

> **Teaching example:** These snippets are intentionally small. They show one reasonable mapping of the pattern roles, not a drop-in architecture. In production, always tailor the pattern to the concrete context: lifecycle, ownership, error handling, concurrency, dependency injection, language idioms, and team conventions.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Facade code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
final class Amplifier {
    void on() { System.out.println("Amplifier on"); }
    void setStreamingPlayer(StreamingPlayer player) { }
}

final class Projector {
    void on() { System.out.println("Projector on"); }
    void wideScreenMode() { System.out.println("Projector in widescreen mode"); }
}

final class TheaterLights {
    void dim(int level) { System.out.println("Lights dimmed to " + level); }
}

final class StreamingPlayer {
    void on() { System.out.println("Player on"); }
    void play(String title) { System.out.println("Playing " + title); }
}

final class HomeTheaterFacade {
    private final Amplifier amp;
    private final Projector projector;
    private final TheaterLights lights;
    private final StreamingPlayer player;

    HomeTheaterFacade(Amplifier amp, Projector projector,
                      TheaterLights lights, StreamingPlayer player) {
        this.amp = amp;
        this.projector = projector;
        this.lights = lights;
        this.player = player;
    }

    void watchMovie(String title) {
        lights.dim(10);
        projector.on();
        projector.wideScreenMode();
        amp.on();
        amp.setStreamingPlayer(player);
        player.on();
        player.play(title);
    }
}

public class Demo {
    public static void main(String[] args) {
        HomeTheaterFacade theater = new HomeTheaterFacade(
            new Amplifier(), new Projector(), new TheaterLights(), new StreamingPlayer());
        theater.watchMovie("Raiders");
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <iostream>
#include <string>

class StreamingPlayer {
public:
    void on() const { std::cout << "Player on\n"; }
    void play(const std::string& title) const { std::cout << "Playing " << title << "\n"; }
};

class Amplifier {
public:
    void on() const { std::cout << "Amplifier on\n"; }
    void setStreamingPlayer(const StreamingPlayer&) const {}
};

class Projector {
public:
    void on() const { std::cout << "Projector on\n"; }
    void wideScreenMode() const { std::cout << "Projector in widescreen mode\n"; }
};

class TheaterLights {
public:
    void dim(int level) const { std::cout << "Lights dimmed to " << level << "\n"; }
};

class HomeTheaterFacade {
public:
    HomeTheaterFacade(Amplifier& amp, Projector& projector,
                      TheaterLights& lights, StreamingPlayer& player)
        : amp_(amp), projector_(projector), lights_(lights), player_(player) {}

    void watchMovie(const std::string& title) const {
        lights_.dim(10);
        projector_.on();
        projector_.wideScreenMode();
        amp_.on();
        amp_.setStreamingPlayer(player_);
        player_.on();
        player_.play(title);
    }

private:
    Amplifier& amp_;
    Projector& projector_;
    TheaterLights& lights_;
    StreamingPlayer& player_;
};

int main() {
    Amplifier amp;
    Projector projector;
    TheaterLights lights;
    StreamingPlayer player;
    HomeTheaterFacade theater(amp, projector, lights, player);
    theater.watchMovie("Raiders");
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
class Amplifier:
    def on(self) -> None:
        print("Amplifier on")

    def set_streaming_player(self, player: "StreamingPlayer") -> None:
        pass


class Projector:
    def on(self) -> None:
        print("Projector on")

    def wide_screen_mode(self) -> None:
        print("Projector in widescreen mode")


class TheaterLights:
    def dim(self, level: int) -> None:
        print(f"Lights dimmed to {level}")


class StreamingPlayer:
    def on(self) -> None:
        print("Player on")

    def play(self, title: str) -> None:
        print(f"Playing {title}")


class HomeTheaterFacade:
    def __init__(
        self,
        amp: Amplifier,
        projector: Projector,
        lights: TheaterLights,
        player: StreamingPlayer,
    ) -> None:
        self.amp = amp
        self.projector = projector
        self.lights = lights
        self.player = player

    def watch_movie(self, title: str) -> None:
        self.lights.dim(10)
        self.projector.on()
        self.projector.wide_screen_mode()
        self.amp.on()
        self.amp.set_streaming_player(self.player)
        self.player.on()
        self.player.play(title)


theater = HomeTheaterFacade(Amplifier(), Projector(), TheaterLights(), StreamingPlayer())
theater.watch_movie("Raiders")
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
class Amplifier {
  on(): void { console.log("Amplifier on"); }
  setStreamingPlayer(player: StreamingPlayer): void {}
}

class Projector {
  on(): void { console.log("Projector on"); }
  wideScreenMode(): void { console.log("Projector in widescreen mode"); }
}

class TheaterLights {
  dim(level: number): void { console.log(`Lights dimmed to ${level}`); }
}

class StreamingPlayer {
  on(): void { console.log("Player on"); }
  play(title: string): void { console.log(`Playing ${title}`); }
}

class HomeTheaterFacade {
  constructor(
    private readonly amp: Amplifier,
    private readonly projector: Projector,
    private readonly lights: TheaterLights,
    private readonly player: StreamingPlayer,
  ) {}

  watchMovie(title: string): void {
    this.lights.dim(10);
    this.projector.on();
    this.projector.wideScreenMode();
    this.amp.on();
    this.amp.setStreamingPlayer(this.player);
    this.player.on();
    this.player.play(title);
  }
}

const theater = new HomeTheaterFacade(
  new Amplifier(),
  new Projector(),
  new TheaterLights(),
  new StreamingPlayer(),
);
theater.watchMovie("Raiders");
```
  </div>
</div>

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

## Flashcards

{% include flashcards.html id="design_pattern_structural" %}

## Quiz

{% include quiz.html id="design_pattern_structural" %}
