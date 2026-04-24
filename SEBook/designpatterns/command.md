---
title: Command Design Pattern
layout: sebook
---

# Problem

Some objects need to ask for work to happen, but they should not know the exact object that performs the work, which method will be called, or whether the request will be executed now, queued for later, logged, repeated, or undone {% cite Gamma1995 %}.

This often starts innocently:

```java
if (actionName.equals("light:on")) {
    light.on();
} else if (actionName.equals("light:off")) {
    light.off();
} else if (actionName.equals("stereo:on")) {
    stereo.on();
    stereo.setInput("CD");
}
```

The code works, but the caller has become a dispatcher, a receiver selector, and an action implementation all at once. As the request list grows, the dispatcher becomes harder to extend, test, queue, log, and undo.

# Context

Use Command when requests must become first-class objects. The pattern is a strong fit when a system needs to parameterize objects with requests, queue or log requests, support undo, or replace a dispatcher whose request-handling branches are becoming too rigid {% cite Gamma1995 Kerievsky2004 %}.

* Buttons, menu items, keyboard shortcuts, or remote-control slots should be configured with actions at runtime.
* Requests need to be queued, scheduled, retried, logged, or sent to another process.
* The system needs undo and redo, and each operation knows how to reverse itself or restore prior state.
* Several smaller operations should be bundled into a macro command.
* A conditional dispatcher is growing because every new action adds another branch.

Do not apply it automatically. If a method contains two stable branches and no need for undo, logging, queuing, or runtime configuration, a direct method call or small conditional is easier to read.

# Research Synthesis

The Gang of Four version supplies the core role model: a `Command` object encapsulates a request, an `Invoker` stores and triggers commands, and a `Receiver` does the real work. The important consequence is decoupling: the object that asks for work no longer needs to know which receiver method performs it {% cite Gamma1995 %}.

Head First Design Patterns makes the pattern concrete with a home-automation remote control. The remote knows only "press slot 0"; command objects know whether that means `light.on()`, `light.off()`, a ceiling fan speed change, a no-op placeholder, an undo operation, or a "party mode" macro {% cite FreemanRobson2020 %}.

Refactoring to Patterns gives the best adoption rule: refactor toward Command when conditional dispatch has either outgrown its class or needs runtime flexibility. The practical path is to extract each branch into an execution method, extract those methods into command classes, give them a common signature, then replace the dispatcher with a command map {% cite Kerievsky2004 %}.

# Solution

Create a small object for each request. The invoker stores commands and calls the same method on all of them, usually `execute()`. A concrete command binds a receiver to one operation, plus any arguments or previous state needed to perform the request safely {% cite Gamma1995 %}.

## UML Role Diagram

The diagram should show one idea: the invoker depends only on the `Command` interface; concrete commands decide which receiver work is done.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
class Client
class Invoker {
    - command: Command
    - lastCommand: Command
    + setCommand(command: Command): void
    + invoke(): void
    + undo(): void
}
interface Command {
    + execute(): void
    + undo(): void
}
class ConcreteCommand {
    - receiver: Receiver
    - previousValue: int
    + execute(): void
    + undo(): void
}
class MacroCommand {
    - commands: Command[]
    + execute(): void
    + undo(): void
}
class Receiver {
    + action(): void
    + restore(value: int): void
}
Client ..> ConcreteCommand : creates
Client ..> Receiver : configures
Invoker o--> Command : stores
ConcreteCommand ..|> Command
MacroCommand ..|> Command
ConcreteCommand --> Receiver : calls
MacroCommand o--> Command : children
note bottom of Invoker
The invoker does not know
which receiver method runs.
end note
@enduml'></div>

# Example: Remote Control

The remote-control example is useful because it demonstrates the pattern's full range without inventing infrastructure. A slot can hold a light command today, a stereo command tomorrow, or a macro command later. The remote does not change {% cite FreemanRobson2020 %}.

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
class RemoteControl {
    - onCommand: Command
    - offCommand: Command
    - undoCommand: Command
    + setCommands(on: Command, off: Command): void
    + pressOn(): void
    + pressOff(): void
    + pressUndo(): void
}
interface Command {
    + execute(): void
    + undo(): void
}
class LightOnCommand {
    - light: Light
    + execute(): void
    + undo(): void
}
class LightOffCommand {
    - light: Light
    + execute(): void
    + undo(): void
}
class NoCommand {
    + execute(): void
    + undo(): void
}
class Light {
    + on(): void
    + off(): void
}
RemoteControl o--> Command : slot and history
LightOnCommand ..|> Command
LightOffCommand ..|> Command
NoCommand ..|> Command
LightOnCommand --> Light : on off
LightOffCommand --> Light : off on
note bottom of NoCommand
Null Object: every slot has
safe behavior before setup.
end note
@enduml'></div>

## Sequence Diagram

The sequence diagram captures the runtime point that class diagrams cannot: `undo` is just another message to the last command object, not special knowledge inside the remote.

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
actor user: User
participant remote: RemoteControl
participant command: LightOnCommand
participant light: Light
user -> remote: pressOn
activate remote
remote -> command: execute
activate command
command -> light: on
activate light
deactivate light
deactivate command
remote -> remote: remember command
activate remote
deactivate remote
deactivate remote
user -> remote: pressUndo
activate remote
remote -> command: undo
activate command
command -> light: off
activate light
deactivate light
deactivate command
deactivate remote
@enduml'></div>

# Refactoring Path

Kerievsky's refactoring is especially useful because it prevents pattern-first design. Start with working code, then refactor only when the dispatcher has real pressure on it {% cite Kerievsky2004 %}.

1. Extract the body of each branch into a well-named execution method.
2. Extract each execution method into a concrete command class.
3. Look across those classes and choose the smallest common execution signature.
4. Introduce a `Command` interface or abstract class.
5. Put concrete commands in a map keyed by command name, button slot, route name, or message type.
6. Replace the conditional dispatcher with lookup plus `execute()`.

This is not just "remove a switch statement." It changes the design from "the dispatcher knows every action" to "the dispatcher hosts independently configurable actions."

# Code Example

The same remote-control design appears below in Java, C++, Python, and JavaScript. The class names stay intentionally parallel so you can compare the shape of the pattern rather than the syntax of each language.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Command pattern code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="js" aria-selected="false">JavaScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
interface Command {
    void execute();
    void undo();
}

final class Light {
    void on() {
        System.out.println("Light is on");
    }

    void off() {
        System.out.println("Light is off");
    }
}

final class NoCommand implements Command {
    public void execute() { }
    public void undo() { }
}

final class LightOnCommand implements Command {
    private final Light light;

    LightOnCommand(Light light) {
        this.light = light;
    }

    public void execute() {
        light.on();
    }

    public void undo() {
        light.off();
    }
}

final class LightOffCommand implements Command {
    private final Light light;

    LightOffCommand(Light light) {
        this.light = light;
    }

    public void execute() {
        light.off();
    }

    public void undo() {
        light.on();
    }
}

final class RemoteControl {
    private Command onCommand = new NoCommand();
    private Command offCommand = new NoCommand();
    private Command undoCommand = new NoCommand();

    void setCommands(Command onCommand, Command offCommand) {
        this.onCommand = onCommand;
        this.offCommand = offCommand;
    }

    void pressOn() {
        onCommand.execute();
        undoCommand = onCommand;
    }

    void pressOff() {
        offCommand.execute();
        undoCommand = offCommand;
    }

    void pressUndo() {
        undoCommand.undo();
    }
}

public class Demo {
    public static void main(String[] args) {
        Light light = new Light();
        RemoteControl remote = new RemoteControl();

        remote.setCommands(
            new LightOnCommand(light),
            new LightOffCommand(light)
        );

        remote.pressOn();    // Light is on
        remote.pressUndo();  // Light is off
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <iostream>
#include <memory>

class Command {
public:
    virtual ~Command() = default;
    virtual void execute() = 0;
    virtual void undo() = 0;
};

class Light {
public:
    void on() {
        std::cout << "Light is on\n";
    }

    void off() {
        std::cout << "Light is off\n";
    }
};

class NoCommand : public Command {
public:
    void execute() override { }
    void undo() override { }
};

class LightOnCommand : public Command {
public:
    explicit LightOnCommand(std::shared_ptr<Light> light)
        : light_(std::move(light)) { }

    void execute() override {
        light_->on();
    }

    void undo() override {
        light_->off();
    }

private:
    std::shared_ptr<Light> light_;
};

class LightOffCommand : public Command {
public:
    explicit LightOffCommand(std::shared_ptr<Light> light)
        : light_(std::move(light)) { }

    void execute() override {
        light_->off();
    }

    void undo() override {
        light_->on();
    }

private:
    std::shared_ptr<Light> light_;
};

class RemoteControl {
public:
    RemoteControl()
        : onCommand_(std::make_shared<NoCommand>()),
          offCommand_(std::make_shared<NoCommand>()),
          undoCommand_(std::make_shared<NoCommand>()) { }

    void setCommands(std::shared_ptr<Command> onCommand,
                     std::shared_ptr<Command> offCommand) {
        onCommand_ = std::move(onCommand);
        offCommand_ = std::move(offCommand);
    }

    void pressOn() {
        onCommand_->execute();
        undoCommand_ = onCommand_;
    }

    void pressOff() {
        offCommand_->execute();
        undoCommand_ = offCommand_;
    }

    void pressUndo() {
        undoCommand_->undo();
    }

private:
    std::shared_ptr<Command> onCommand_;
    std::shared_ptr<Command> offCommand_;
    std::shared_ptr<Command> undoCommand_;
};

int main() {
    auto light = std::make_shared<Light>();
    RemoteControl remote;

    remote.setCommands(
        std::make_shared<LightOnCommand>(light),
        std::make_shared<LightOffCommand>(light)
    );

    remote.pressOn();    // Light is on
    remote.pressUndo();  // Light is off
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
from abc import ABC, abstractmethod


class Command(ABC):
    @abstractmethod
    def execute(self) -> None:
        pass

    @abstractmethod
    def undo(self) -> None:
        pass


class Light:
    def on(self) -> None:
        print("Light is on")

    def off(self) -> None:
        print("Light is off")


class NoCommand(Command):
    def execute(self) -> None:
        pass

    def undo(self) -> None:
        pass


class LightOnCommand(Command):
    def __init__(self, light: Light) -> None:
        self.light = light

    def execute(self) -> None:
        self.light.on()

    def undo(self) -> None:
        self.light.off()


class LightOffCommand(Command):
    def __init__(self, light: Light) -> None:
        self.light = light

    def execute(self) -> None:
        self.light.off()

    def undo(self) -> None:
        self.light.on()


class RemoteControl:
    def __init__(self) -> None:
        self.on_command = NoCommand()
        self.off_command = NoCommand()
        self.undo_command = NoCommand()

    def set_commands(self, on_command: Command, off_command: Command) -> None:
        self.on_command = on_command
        self.off_command = off_command

    def press_on(self) -> None:
        self.on_command.execute()
        self.undo_command = self.on_command

    def press_off(self) -> None:
        self.off_command.execute()
        self.undo_command = self.off_command

    def press_undo(self) -> None:
        self.undo_command.undo()


light = Light()
remote = RemoteControl()
remote.set_commands(LightOnCommand(light), LightOffCommand(light))

remote.press_on()    # Light is on
remote.press_undo()  # Light is off
```
  </div>

  <div class="inline-language-panel" data-language-panel="js" role="tabpanel" markdown="1">
```javascript
class Command {
  execute() {
    throw new Error("execute() must be implemented");
  }

  undo() {
    throw new Error("undo() must be implemented");
  }
}

class Light {
  on() {
    console.log("Light is on");
  }

  off() {
    console.log("Light is off");
  }
}

class NoCommand extends Command {
  execute() {}
  undo() {}
}

class LightOnCommand extends Command {
  constructor(light) {
    super();
    this.light = light;
  }

  execute() {
    this.light.on();
  }

  undo() {
    this.light.off();
  }
}

class LightOffCommand extends Command {
  constructor(light) {
    super();
    this.light = light;
  }

  execute() {
    this.light.off();
  }

  undo() {
    this.light.on();
  }
}

class RemoteControl {
  constructor() {
    this.onCommand = new NoCommand();
    this.offCommand = new NoCommand();
    this.undoCommand = new NoCommand();
  }

  setCommands(onCommand, offCommand) {
    this.onCommand = onCommand;
    this.offCommand = offCommand;
  }

  pressOn() {
    this.onCommand.execute();
    this.undoCommand = this.onCommand;
  }

  pressOff() {
    this.offCommand.execute();
    this.undoCommand = this.offCommand;
  }

  pressUndo() {
    this.undoCommand.undo();
  }
}

const light = new Light();
const remote = new RemoteControl();
remote.setCommands(new LightOnCommand(light), new LightOffCommand(light));

remote.pressOn();    // Light is on
remote.pressUndo();  // Light is off
```
  </div>
</div>

In languages with first-class functions, a command can sometimes be just a function or closure. That is fine for simple "execute only" callbacks. Use an explicit command object when the request needs identity, metadata, validation, authorization, undo state, serialization, composition, or test seams.

# Design Decisions

## Execute Only vs. Execute and Undo

The smallest command interface has only `execute()`. Add `undo()` only when the product actually needs undo or redo. Undo is not automatic: each command must either store enough old state to restore the receiver or know the inverse operation. Commands that cannot be undone should say so explicitly rather than pretending.

## Constructor Arguments vs. Execute Arguments

Some commands receive all data in the constructor:

```java
new PasteCommand(editor, clipboardText)
```

Others receive a request object at execution time:

```java
command.execute(requestContext)
```

Constructor arguments make commands self-contained, which helps queuing and logging. Execute arguments keep reusable command objects small, which helps dispatch tables and web handlers. Pick one common signature per command family.

## Receiver-Centric vs. Smart Commands

A simple command just forwards one call to a receiver. A smarter command may validate permissions, store previous receiver state, coordinate several receiver calls, or emit domain events. Keep that logic inside the command only when it belongs to the request itself. If commands start becoming mini services with unrelated responsibilities, the pattern is hiding a design problem.

## Null Command

A `NoCommand` object is the Null Object version of Command. It lets an invoker safely call `execute()` without repeated null checks. This is useful for default remote-control slots, disabled menu actions, optional hooks, or empty macro steps.

## Macro Command

A macro command stores a list of commands and implements the same interface. `execute()` runs each child command in order. `undo()` usually runs the same child commands in reverse order, because the last executed command is normally the first one that must be reversed.

## Queued and Logged Commands

For queues, retries, and transaction logs, the command must carry stable data rather than live object references. A command like "email user 42 with template welcome" can be serialized. A command holding a raw in-memory `User` object usually cannot. This is the point where Command overlaps with messages, jobs, and event-driven architecture.

# Consequences

The main benefit is decoupling. Invokers can be configured with new commands without changing their code, and receivers can evolve without forcing every button, menu item, queue worker, or dispatcher to know their full API.

The costs are real:

* More classes or functions exist in the design.
* The actual receiver method is one indirection away, so tracing execution takes more navigation.
* Undo requires careful state management; a command that only knows "do" does not magically know "undo."
* Overuse turns straightforward method calls into an abstraction maze.

The pattern earns its complexity when requests need a lifecycle: configure, execute, remember, undo, replay, queue, log, retry, compose, or inspect.

# Good Examples

| Example | Why Command fits |
|---|---|
| GUI buttons, toolbar actions, and menu items | The same button/menu framework can invoke any action object. Java Swing's `Action` is used by buttons, menus, toolbars, and action maps {% cite OracleSwingAction %}. |
| Undoable editor operations | Each edit can store enough state to undo or redo itself. Java Swing's `UndoableEdit` and `UndoManager` are a direct production example of this idea {% cite OracleUndoableEdit %}. |
| Job queues | A job object packages work so it can be delayed, retried, distributed, or logged. |
| Game input replay | Player input commands can be recorded, replayed, reversed, or sent over a network. |
| Transaction scripts and workflow steps | A workflow engine can execute a sequence of command objects without embedding each concrete operation in the engine. |
| CLI subcommands | Each subcommand can parse its own options and implement a common `run()` method. |

# Related Patterns

| Pattern | Similarity | Difference |
|---|---|---|
| Strategy | Both wrap behavior behind a common interface. | Strategy selects an algorithm; Command represents a request that may have lifecycle state such as undo, queuing, or logging. |
| [Observer](/SEBook/designpatterns/observer.html) | Both decouple senders from receivers. | Observer broadcasts a change to many listeners; Command packages one request for one invoker to execute. |
| [Mediator](/SEBook/designpatterns/mediator.html) | Both can reduce direct coupling between objects. | Mediator centralizes coordination rules; Command decentralizes actions into request objects. |
| Composite | Macro commands compose commands into a tree or list. | Composite is the structural mechanism; Command is the behavioral intent. |
| Memento | Both can support undo. | Command often stores the operation; Memento stores a snapshot of state. They are commonly combined. |

# Check Yourself

{% include flashcards.html id="design_pattern_command" %}

{% include quiz.html id="design_pattern_command" %}

# Further Reading

* Erich Gamma, Richard Helm, Ralph Johnson, and John Vlissides, [Design Patterns: Elements of Reusable Object-Oriented Software](https://www.pearson.com/en-us/subject-catalog/p/Gamma-Design-Patterns-Elements-of-Reusable-Object-Oriented-Software/P200000009480?view=educator).
* Joshua Kerievsky, [Replace Conditional Dispatcher with Command](https://flylib.com/books/en/1.476.1.76/1/) in Refactoring to Patterns.
* Eric Freeman and Elisabeth Robson, [Head First Design Patterns, 2nd Edition](https://www.oreilly.com/library/view/head-first-design/9781492077992/preface02.html), Chapter 6.
* Oracle Java documentation: [Swing Action usage](https://docs.oracle.com/javase/8/docs/api/javax/swing/class-use/Action.html) and [UndoableEdit](https://docs.oracle.com/en/java/javase/11/docs/api/java.desktop/javax/swing/undo/UndoableEdit.html).
