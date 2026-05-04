---
title: Façade Design Pattern
layout: sebook
---

# Context
In modern software construction, we often build systems composed of multiple complex subsystems that must collaborate to perform a high-level task. A classic example used by Freeman & Robson in *Head First Design Patterns* is a **Home Theater System** consisting of various independent components: an amplifier, a tuner, a DVD player, a CD player, a projector, a motorized screen, theater lights, and a popcorn popper. The Gang of Four use a different running example — a **compiler subsystem** containing classes like `Scanner`, `Parser`, `ProgramNode`, `BytecodeStream`, and `ProgramNodeBuilder` — but the underlying problem is the same: each component is a powerful "module" on its own, but they must be coordinated precisely to provide a seamless user experience.

# Problem
When a client needs to interact with a set of complex subsystems, several issues arise:
1.  **High Complexity:** To perform a single logical action like "Watch a Movie," the client must execute a long sequence of manual steps. In the Head First example, watching a movie requires 13 separate calls across six classes: turn on the popcorn popper, start it popping, dim the lights, put the screen down, turn on the projector, set its input, put it in widescreen mode, turn on the amplifier, set it to DVD input, set surround sound, set the volume, turn on the DVD player, and finally play the movie.
2.  **Maintenance Nightmares:** If the movie finishes, the user has to perform all those steps again in reverse order to shut everything down. If a component is upgraded (e.g., replacing the DVD player with a Blu-ray device), every client that uses the system must learn a new, slightly different procedure.
3.  **Tight Coupling:** The client code becomes "intimate" with every single class in the subsystem. This violates the principle of [**Information Hiding**](/SEBook/designprinciples/informationhiding.html), as the client must understand the internal low-level details of how each device operates just to use the system.

# Solution
The **Façade Pattern** provides a unified interface to a set of interfaces in a subsystem. It defines a higher-level interface that makes the subsystem easier to use by wrapping complexity behind a single, simplified object.

In the Home Theater example, we create a `HomeTheaterFaçade`. Instead of the client calling twelve different methods on six different objects, the client calls one high-level method: `watchMovie()`. The Façade object then handles the "dirty work" of delegating those requests to the underlying subsystems. This creates a single point of use for the entire component, effectively hiding the complex "how" of the implementation from the outside world.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
class Client
class Façade {
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
Client --> Façade : uses >
Façade --> SubsystemA
Façade --> SubsystemB
Façade --> SubsystemC
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
class MovieNightClient
class HomeTheaterFaçade {
	+ watchMovie(movie: String): void
	+ endMovie(): void
	+ listenToCd(cdTitle: String): void
	+ endCd(): void
	+ listenToRadio(frequency: double): void
	+ endRadio(): void
}
class Amplifier
class Tuner
class DvdPlayer
class CdPlayer
class Projector
class TheaterLights
class Screen
class PopcornPopper
MovieNightClient --> HomeTheaterFaçade
HomeTheaterFaçade --> Amplifier
HomeTheaterFaçade --> Tuner
HomeTheaterFaçade --> DvdPlayer
HomeTheaterFaçade --> CdPlayer
HomeTheaterFaçade --> Projector
HomeTheaterFaçade --> TheaterLights
HomeTheaterFaçade --> Screen
HomeTheaterFaçade --> PopcornPopper
@enduml'></div>

## Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant client: MovieNightClient
participant facade: HomeTheaterFaçade
participant popper: PopcornPopper
participant lights: TheaterLights
participant screen: Screen
participant projector: Projector
participant amp: Amplifier
participant dvd: DvdPlayer
client -> facade: watchMovie("Raiders of the Lost Ark")
activate facade
facade -> popper: on()
activate popper
deactivate popper
facade -> popper: pop()
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
facade -> projector: wideScreenMode()
activate projector
deactivate projector
facade -> amp: on()
activate amp
deactivate amp
facade -> amp: setDvd(dvd)
activate amp
deactivate amp
facade -> amp: setSurroundSound()
activate amp
deactivate amp
facade -> amp: setVolume(5)
activate amp
deactivate amp
facade -> dvd: on()
activate dvd
deactivate dvd
facade -> dvd: play("Raiders of the Lost Ark")
activate dvd
deactivate dvd
deactivate facade
@enduml'></div>

# Code Example

This example gives clients one intention-revealing operation, `watchMovie()`, while the facade coordinates the subsystem calls in the required order.

> **Teaching example:** These snippets are intentionally small. They show one reasonable mapping of the pattern roles, not a drop-in architecture. In production, always tailor the pattern to the concrete context: lifecycle, ownership, error handling, concurrency, dependency injection, language idioms, and team conventions.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Façade code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
final class Amplifier {
    void on() { System.out.println("Amplifier on"); }
    void off() { System.out.println("Amplifier off"); }
    void setDvd(DvdPlayer dvd) { System.out.println("Amplifier setting DVD player"); }
    void setSurroundSound() { System.out.println("Amplifier surround sound on"); }
    void setVolume(int level) { System.out.println("Amplifier setting volume to " + level); }
}

final class Projector {
    void on() { System.out.println("Projector on"); }
    void off() { System.out.println("Projector off"); }
    void wideScreenMode() { System.out.println("Projector in widescreen mode"); }
}

final class TheaterLights {
    void on() { System.out.println("Lights on"); }
    void dim(int level) { System.out.println("Lights dimmed to " + level); }
}

final class Screen {
    void up() { System.out.println("Screen going up"); }
    void down() { System.out.println("Screen going down"); }
}

final class PopcornPopper {
    void on() { System.out.println("Popcorn Popper on"); }
    void off() { System.out.println("Popcorn Popper off"); }
    void pop() { System.out.println("Popcorn Popper popping popcorn!"); }
}

final class DvdPlayer {
    void on() { System.out.println("DVD Player on"); }
    void off() { System.out.println("DVD Player off"); }
    void play(String movie) { System.out.println("DVD Player playing \"" + movie + "\""); }
    void stop() { System.out.println("DVD Player stopped"); }
    void eject() { System.out.println("DVD Player eject"); }
}

final class HomeTheaterFaçade {
    private final Amplifier amp;
    private final DvdPlayer dvd;
    private final Projector projector;
    private final TheaterLights lights;
    private final Screen screen;
    private final PopcornPopper popper;

    HomeTheaterFaçade(Amplifier amp, DvdPlayer dvd, Projector projector,
                      TheaterLights lights, Screen screen, PopcornPopper popper) {
        this.amp = amp;
        this.dvd = dvd;
        this.projector = projector;
        this.lights = lights;
        this.screen = screen;
        this.popper = popper;
    }

    void watchMovie(String movie) {
        System.out.println("Get ready to watch a movie...");
        popper.on();
        popper.pop();
        lights.dim(10);
        screen.down();
        projector.on();
        projector.wideScreenMode();
        amp.on();
        amp.setDvd(dvd);
        amp.setSurroundSound();
        amp.setVolume(5);
        dvd.on();
        dvd.play(movie);
    }

    void endMovie() {
        System.out.println("Shutting movie theater down...");
        popper.off();
        lights.on();
        screen.up();
        projector.off();
        amp.off();
        dvd.stop();
        dvd.eject();
        dvd.off();
    }
}

public class Demo {
    public static void main(String[] args) {
        HomeTheaterFaçade homeTheater = new HomeTheaterFaçade(
            new Amplifier(), new DvdPlayer(), new Projector(),
            new TheaterLights(), new Screen(), new PopcornPopper());
        homeTheater.watchMovie("Raiders of the Lost Ark");
        homeTheater.endMovie();
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <iostream>
#include <string>

class DvdPlayer {
public:
    void on() const { std::cout << "DVD Player on\n"; }
    void off() const { std::cout << "DVD Player off\n"; }
    void play(const std::string& movie) const { std::cout << "DVD Player playing \"" << movie << "\"\n"; }
    void stop() const { std::cout << "DVD Player stopped\n"; }
    void eject() const { std::cout << "DVD Player eject\n"; }
};

class Amplifier {
public:
    void on() const { std::cout << "Amplifier on\n"; }
    void off() const { std::cout << "Amplifier off\n"; }
    void setDvd(const DvdPlayer&) const { std::cout << "Amplifier setting DVD player\n"; }
    void setSurroundSound() const { std::cout << "Amplifier surround sound on\n"; }
    void setVolume(int level) const { std::cout << "Amplifier setting volume to " << level << "\n"; }
};

class Projector {
public:
    void on() const { std::cout << "Projector on\n"; }
    void off() const { std::cout << "Projector off\n"; }
    void wideScreenMode() const { std::cout << "Projector in widescreen mode\n"; }
};

class TheaterLights {
public:
    void on() const { std::cout << "Lights on\n"; }
    void dim(int level) const { std::cout << "Lights dimmed to " << level << "\n"; }
};

class Screen {
public:
    void up() const { std::cout << "Screen going up\n"; }
    void down() const { std::cout << "Screen going down\n"; }
};

class PopcornPopper {
public:
    void on() const { std::cout << "Popcorn Popper on\n"; }
    void off() const { std::cout << "Popcorn Popper off\n"; }
    void pop() const { std::cout << "Popcorn Popper popping popcorn!\n"; }
};

class HomeTheaterFaçade {
public:
    HomeTheaterFaçade(Amplifier& amp, DvdPlayer& dvd, Projector& projector,
                      TheaterLights& lights, Screen& screen, PopcornPopper& popper)
        : amp_(amp), dvd_(dvd), projector_(projector),
          lights_(lights), screen_(screen), popper_(popper) {}

    void watchMovie(const std::string& movie) const {
        std::cout << "Get ready to watch a movie...\n";
        popper_.on();
        popper_.pop();
        lights_.dim(10);
        screen_.down();
        projector_.on();
        projector_.wideScreenMode();
        amp_.on();
        amp_.setDvd(dvd_);
        amp_.setSurroundSound();
        amp_.setVolume(5);
        dvd_.on();
        dvd_.play(movie);
    }

    void endMovie() const {
        std::cout << "Shutting movie theater down...\n";
        popper_.off();
        lights_.on();
        screen_.up();
        projector_.off();
        amp_.off();
        dvd_.stop();
        dvd_.eject();
        dvd_.off();
    }

private:
    Amplifier& amp_;
    DvdPlayer& dvd_;
    Projector& projector_;
    TheaterLights& lights_;
    Screen& screen_;
    PopcornPopper& popper_;
};

int main() {
    Amplifier amp;
    DvdPlayer dvd;
    Projector projector;
    TheaterLights lights;
    Screen screen;
    PopcornPopper popper;
    HomeTheaterFaçade homeTheater(amp, dvd, projector, lights, screen, popper);
    homeTheater.watchMovie("Raiders of the Lost Ark");
    homeTheater.endMovie();
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
class Amplifier:
    def on(self) -> None:
        print("Amplifier on")

    def off(self) -> None:
        print("Amplifier off")

    def set_dvd(self, dvd: "DvdPlayer") -> None:
        print("Amplifier setting DVD player")

    def set_surround_sound(self) -> None:
        print("Amplifier surround sound on")

    def set_volume(self, level: int) -> None:
        print(f"Amplifier setting volume to {level}")


class Projector:
    def on(self) -> None:
        print("Projector on")

    def off(self) -> None:
        print("Projector off")

    def wide_screen_mode(self) -> None:
        print("Projector in widescreen mode")


class TheaterLights:
    def on(self) -> None:
        print("Lights on")

    def dim(self, level: int) -> None:
        print(f"Lights dimmed to {level}")


class Screen:
    def up(self) -> None:
        print("Screen going up")

    def down(self) -> None:
        print("Screen going down")


class PopcornPopper:
    def on(self) -> None:
        print("Popcorn Popper on")

    def off(self) -> None:
        print("Popcorn Popper off")

    def pop(self) -> None:
        print("Popcorn Popper popping popcorn!")


class DvdPlayer:
    def on(self) -> None:
        print("DVD Player on")

    def off(self) -> None:
        print("DVD Player off")

    def play(self, movie: str) -> None:
        print(f'DVD Player playing "{movie}"')

    def stop(self) -> None:
        print("DVD Player stopped")

    def eject(self) -> None:
        print("DVD Player eject")


class HomeTheaterFaçade:
    def __init__(
        self,
        amp: Amplifier,
        dvd: DvdPlayer,
        projector: Projector,
        lights: TheaterLights,
        screen: Screen,
        popper: PopcornPopper,
    ) -> None:
        self.amp = amp
        self.dvd = dvd
        self.projector = projector
        self.lights = lights
        self.screen = screen
        self.popper = popper

    def watch_movie(self, movie: str) -> None:
        print("Get ready to watch a movie...")
        self.popper.on()
        self.popper.pop()
        self.lights.dim(10)
        self.screen.down()
        self.projector.on()
        self.projector.wide_screen_mode()
        self.amp.on()
        self.amp.set_dvd(self.dvd)
        self.amp.set_surround_sound()
        self.amp.set_volume(5)
        self.dvd.on()
        self.dvd.play(movie)

    def end_movie(self) -> None:
        print("Shutting movie theater down...")
        self.popper.off()
        self.lights.on()
        self.screen.up()
        self.projector.off()
        self.amp.off()
        self.dvd.stop()
        self.dvd.eject()
        self.dvd.off()


home_theater = HomeTheaterFaçade(
    Amplifier(), DvdPlayer(), Projector(),
    TheaterLights(), Screen(), PopcornPopper(),
)
home_theater.watch_movie("Raiders of the Lost Ark")
home_theater.end_movie()
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
class Amplifier {
  on(): void { console.log("Amplifier on"); }
  off(): void { console.log("Amplifier off"); }
  setDvd(dvd: DvdPlayer): void { console.log("Amplifier setting DVD player"); }
  setSurroundSound(): void { console.log("Amplifier surround sound on"); }
  setVolume(level: number): void { console.log(`Amplifier setting volume to ${level}`); }
}

class Projector {
  on(): void { console.log("Projector on"); }
  off(): void { console.log("Projector off"); }
  wideScreenMode(): void { console.log("Projector in widescreen mode"); }
}

class TheaterLights {
  on(): void { console.log("Lights on"); }
  dim(level: number): void { console.log(`Lights dimmed to ${level}`); }
}

class Screen {
  up(): void { console.log("Screen going up"); }
  down(): void { console.log("Screen going down"); }
}

class PopcornPopper {
  on(): void { console.log("Popcorn Popper on"); }
  off(): void { console.log("Popcorn Popper off"); }
  pop(): void { console.log("Popcorn Popper popping popcorn!"); }
}

class DvdPlayer {
  on(): void { console.log("DVD Player on"); }
  off(): void { console.log("DVD Player off"); }
  play(movie: string): void { console.log(`DVD Player playing "${movie}"`); }
  stop(): void { console.log("DVD Player stopped"); }
  eject(): void { console.log("DVD Player eject"); }
}

class HomeTheaterFaçade {
  constructor(
    private readonly amp: Amplifier,
    private readonly dvd: DvdPlayer,
    private readonly projector: Projector,
    private readonly lights: TheaterLights,
    private readonly screen: Screen,
    private readonly popper: PopcornPopper,
  ) {}

  watchMovie(movie: string): void {
    console.log("Get ready to watch a movie...");
    this.popper.on();
    this.popper.pop();
    this.lights.dim(10);
    this.screen.down();
    this.projector.on();
    this.projector.wideScreenMode();
    this.amp.on();
    this.amp.setDvd(this.dvd);
    this.amp.setSurroundSound();
    this.amp.setVolume(5);
    this.dvd.on();
    this.dvd.play(movie);
  }

  endMovie(): void {
    console.log("Shutting movie theater down...");
    this.popper.off();
    this.lights.on();
    this.screen.up();
    this.projector.off();
    this.amp.off();
    this.dvd.stop();
    this.dvd.eject();
    this.dvd.off();
  }
}

const homeTheater = new HomeTheaterFaçade(
  new Amplifier(),
  new DvdPlayer(),
  new Projector(),
  new TheaterLights(),
  new Screen(),
  new PopcornPopper(),
);
homeTheater.watchMovie("Raiders of the Lost Ark");
homeTheater.endMovie();
```
  </div>
</div>

# Consequences
Applying the Façade pattern leads to several architectural benefits and trade-offs:
*   **Simplified Interface:** The primary intent of a Façade is to simplify the interface for the client.
*   **Reduced Coupling:** It decouples the client from the subsystem. Because the client only interacts with the Façade, internal changes to the subsystem (like adding a new device) do not require changes to the client code.
*   **Improved Information Hiding:** It promotes modularity by ensuring that the low-level details of the subsystems are "secrets" kept within the component.
*   **Flexibility:** Clients that still need the power of the low-level interfaces can still access them directly; the Façade does not "trap" the subsystem, it just provides a more convenient way to use it for common tasks. This is a critical point: **a Façade is a convenience, not a prison**.

# Design Decisions

## Single vs. Multiple Façades
When a subsystem is large, a single Façade can become a "god class" that handles too many concerns. In such cases, create **multiple facades**, each responsible for a different aspect of the subsystem (e.g., `HomeTheaterPlaybackFaçade` and `HomeTheaterSetupFaçade`). This keeps each Façade cohesive and manageable.

## Façade Awareness
Subsystem classes should **not know** about the Façade. The Façade knows the subsystem internals and delegates to them, but the subsystem components remain fully independent. This one-directional knowledge ensures the subsystem can be used without the Façade and can be tested independently.

## Abstract Façade
When testability matters or when the subsystem may have platform-specific implementations, define the Façade as an **interface or abstract class**. The Gang of Four call this "reducing client-subsystem coupling further": clients communicate with the subsystem through the abstract Façade interface, so they don't know which concrete implementation of a subsystem is being used (GoF, p. 178). An alternative is to keep the Façade concrete but configure it with different subsystem objects.

## Public vs. Private Subsystem Classes
A subsystem is analogous to a class: both have public and private interfaces. The Façade is part of the **public interface** to the subsystem, but not the only part — other classes that clients legitimately need to access (e.g., `Scanner` and `Parser` in the GoF compiler example) are also public. Classes that only subsystem extenders need are **private**. Languages like C++ provide namespaces to expose only the public subsystem classes; in others, this distinction is enforced by convention (GoF, p. 178).

# The Principle of Least Knowledge (Law of Demeter)

*Head First Design Patterns* introduces the Façade pattern alongside a related design principle:

> **Principle of Least Knowledge** — talk only to your immediate friends.

This principle (also known as the **Law of Demeter**) guides us to reduce the interactions between objects to just a few close "friends." When designing a system, for any object, be careful of the number of classes it interacts with and how it comes to interact with those classes. Following this principle prevents designs where a large number of classes are coupled together so that changes in one part cascade to other parts.

The principle states that, from any method in an object, you should only invoke methods that belong to:

1. **The object itself**
2. **Objects passed in as a parameter to the method**
3. **Any object the method creates or instantiates**
4. **Any components of the object** (objects referenced by an instance variable — a "HAS-A" relationship)

A common violation is "train wreck" code that chains calls returned from other calls:

```java
// Violates Principle of Least Knowledge — calls method on object returned from another call
public float getTemp() {
    return station.getThermometer().getTemperature();
}

// Follows the principle — Station exposes a method that hides the thermometer
public float getTemp() {
    return station.getTemperature();
}
```

**How the Façade follows this principle.** Without a Façade, the client must talk to every component of the subsystem — the amplifier, projector, lights, screen, DVD player, popcorn popper, and so on. With the Façade, the client has only **one friend**: the `HomeTheaterFaçade`. The Façade itself talks to its components (which are HAS-A relationships, satisfying rule 4), so it is also adhering to the principle. This is one of the reasons Façade reduces coupling so effectively.

**Trade-off.** Applying the principle often requires writing more "wrapper" methods (e.g., `Station.getTemperature()` that just delegates to `thermometer.getTemperature()`). This can result in increased complexity and development time, as well as decreased runtime performance. Like all principles, it should be applied with judgment.

# Distinguishing Façade from Related Patterns

The Façade is often confused with Adapter and Mediator because all three involve intermediary objects. The distinctions are:

| Pattern | Intent | Knowledge Direction | Scope |
|---------|--------|---------------------|-------|
| **Façade** | *Simplify* a complex subsystem into a convenient interface | One-way: Façade knows the subsystem; subsystem classes have no knowledge of the Façade. | Many existing interfaces → one new simpler interface |
| **[Adapter](/SEBook/designpatterns/adapter.html)** | *Convert* an existing interface so it matches another expected interface | One-way: Client calls Adapter; Adapter calls Adaptee; Adaptee is unaware. | One existing interface → one expected interface (one-to-one) |
| **[Mediator](/SEBook/designpatterns/mediator.html)** | *Coordinate* interactions between peer objects | Two-way awareness: Colleagues know the Mediator and call it; the Mediator calls Colleagues back. | Many peer Colleagues coordinated through one centralized object |

A Façade simplifies access to a subsystem; an Adapter changes the *shape* of one interface to fit another; a Mediator coordinates among peers. If the intermediary hides a subsystem from outside clients (and the subsystem doesn't know about it), it is a Façade. If it converts one interface into another, it is an Adapter. If it manages communication among peers that all know about it, it is a Mediator.

**Façade vs. Abstract Factory.** The Gang of Four note that [Abstract Factory](/SEBook/designpatterns/abstract_factory.html) can be used *with* Façade to provide an interface for creating subsystem objects in a subsystem-independent way. Abstract Factory can also be used as an *alternative* to Façade to hide platform-specific classes (GoF, p. 182).

**Façade is often a Singleton.** Because usually only one Façade object is required for a subsystem, Façades are often implemented as [Singletons](/SEBook/designpatterns/singleton.html) (GoF, p. 183).

## Flashcards

{% include flashcards.html id="design_pattern_structural" %}

## Quiz

{% include quiz.html id="design_pattern_structural" %}
