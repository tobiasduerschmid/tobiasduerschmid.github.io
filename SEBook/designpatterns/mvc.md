---
title: Model-View-Controller (MVC)
layout: sebook

---

The Model-View-Controller (MVC) architectural pattern decomposes an interactive application into three distinct components: a model that encapsulates the core application data and business logic, a view that renders this information to the user, and a controller that translates user inputs into corresponding state updates.

MVC was first formulated by Trygve Reenskaug in 1978–79 while he was visiting the Learning Research Group at Xerox PARC, and it took its enduring shape in the Smalltalk-80 class library. His initial sketch was actually called *Thing-Model-View-Editor*; the name *Model-View-Controller* appeared in his note of December 10, 1979. POSA Vol. 1 {% cite Buschmann1996 %} later codified MVC as one of the canonical architectural patterns.

# Problem 

User interface software is typically the most frequently modified portion of an interactive application. As systems evolve, menus are reorganized, graphical presentations change, and customers often demand to look at the same underlying data from multiple perspectives—such as simultaneously viewing a spreadsheet, a bar graph, and a pie chart. All of these representations must immediately and consistently reflect the current state of the data.
A core architectural challenge thus arises: **How can multiple, simultaneous user interface functionality be kept completely separate from application functionality while remaining highly responsive to user inputs and underlying data changes?** Furthermore, porting an application to another platform with a radically different "look and feel" standard (or simply upgrading windowing systems) should absolutely not require modifications to the core computational logic of the application.

# Context

The MVC pattern is applicable when developing software that features a graphical user interface, specifically interactive systems where the application data must be viewed in multiple, flexible ways at the same time. It is used when an application's domain logic is stable, but its presentation and user interaction requirements are subject to frequent changes or platform-specific implementations.

# Solution

To resolve these forces, the MVC pattern divides an interactive application into three distinct logical areas: processing, output, and input.

* **The Model**: The model encapsulates the application's state, core data, and domain-specific functionality. It represents the underlying application domain and remains completely independent of any specific output representations or input behaviors. The model provides methods for other components to access its data, but it is entirely blind to the visual interfaces that depict it.
* **The View**: The view component defines and manages how data is presented to the user. A view obtains the necessary data directly from the model and renders it on the screen. A single model can have multiple distinct views associated with it.
* **The Controller**: The controller manages user interaction. It receives inputs from the user—such as mouse movements, button clicks, or keyboard strokes—and translates these events into specific service requests sent to the model or instructions for the view.

The following description is **classic Smalltalk MVC**. Its change propagation and input handling can be understood through lower-level design patterns {% cite Gamma1995 %}. Frameworks also use the name MVC for adaptations; the same dependencies are not mandatory in every adaptation.

* First, the relationship between the Model and the View utilizes the *[Observer](/SEBook/designpatterns/observer.html)* pattern. The model acts as the subject, and the views (and sometimes controllers) register as *Observers*. When the model undergoes a state change, it broadcasts a notification, prompting the views to query the model for updated data and redraw themselves.
* Second, the relationship between the View and the Controller utilizes the [Strategy](/SEBook/designpatterns/strategy.html) pattern. The controller encapsulates the strategy for handling user input, allowing the view to delegate all input response behavior. This allows software engineers to easily swap controllers at runtime if different behavior is required (e.g., swapping a standard controller for a read-only controller).
* Third, the view often employs the *[Composite](/SEBook/designpatterns/composite.html)* pattern to manage complex, nested user interface elements, such as windows containing panels, which in turn contain buttons.

## CRC Cards

These Class, Responsibility, Collaborator (CRC) cards summarize the classic MVC roles in Buschmann et al. {% cite Buschmann1996 %}, pp. 127–128. Responsibilities describe what each role does; collaborators name the roles it works with. The two lists are independent, so entries on the same row are not paired. Here the model collaborates with views and interested controllers through the notification interface, without knowing how they draw or handle input.

<pre><code class="diagram-crc">
@startuml
caption: MVC separates domain behavior, presentation, and input handling while coordinating updates through notifications.
layout auto
card Model {
  responsibility: Maintain domain state and behavior
  responsibility: Register dependent views and controllers
  responsibility: Notify dependents when state changes
  collaborator: View (notification interface)
  collaborator: Controller (when subscribed)
}
card View {
  responsibility: Read model data for presentation
  responsibility: Refresh the display on notification
  responsibility: Create and initialize its controller
  collaborator: Model
  collaborator: Controller
}
card Controller {
  responsibility: Interpret user input events
  responsibility: Request model operations or view changes
  responsibility: React to model changes when subscribed
  collaborator: Model
  collaborator: View
}
@enduml
</code></pre>

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
class Model
interface Observer {
    + update(model: Model)
}
class View {
    + update(model: Model)
    + render()
}
class Controller {
    + handleInput()
}
Model "1" -- "*" Observer : notifies >
View ..|> Observer
View --> Model : reads
View --> Controller : delegates input
Controller --> Model : updates
callout top of text "Model" : Model: domain state that notifies observers when it changes
callout bottom of text "View" : View: shows model data and refreshes on update()
callout bottom of text "Controller" : Controller: turns user input into model changes
callout right of text "delegates input" : Strategy: the view hands input handling to a swappable controller
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout landscape
class TaskModel {
    + addTask(task: String)
    + getTasks(): Sequence<String>
}
interface TaskObserver {
    + update(model: TaskModel)
}
class TaskView {
    + update(model: TaskModel)
    + showTasks(tasks: Sequence<String>)
}
class TaskController {
    + addNewTask(task: String)
}
TaskModel "1" -- "*" TaskObserver : notifies >
TaskView ..|> TaskObserver
TaskView ..> TaskModel : queries on update
TaskController --> TaskModel : changes state
callout top of text "TaskModel" : Model: owns the task list
callout bottom of text "TaskView" : View: an observer that redraws the tasks
callout bottom of text "TaskController" : Controller: handles requests to add tasks
@enduml'></div>

## Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
actor user: User
participant controller: TaskController
participant model: TaskModel
participant view: TaskView
user -> controller: addNewTask("Learn Observer")
activate controller
controller -> model: addTask("Learn Observer")
activate model
model -> view: update(model)
activate view
view -> model: getTasks()
activate model
model --> view: tasks
deactivate model
view -> view: showTasks(tasks)
deactivate view
deactivate model
deactivate controller
callout right of text "addNewTask(\"Learn Observer\")" : Input goes to the controller
callout right of text "addTask(\"Learn Observer\")" : The controller changes the model, not the screen
callout bottom of text "update(model)" : Observer: the model notifies its views after a change
callout left of text "getTasks()" : Pull: the view asks the model for the data it shows
callout right of text "showTasks(tasks)" : The view redraws itself, the controller never touches the display
@enduml'></div>


# Consequences

Applying the MVC pattern yields profound architectural advantages, but it also introduces notable liabilities that an engineer must carefully mitigate.

## Benefits

* **Multiple Views of the Same Model**: MVC strictly separates the model from the user-interface components. Multiple views can therefore be implemented and used with a single model, and at run-time multiple views can be open simultaneously and opened or closed dynamically.
* **Synchronized Views**: Observer-based change propagation lets views refresh after model changes. The implementation must notify after a consistent change and choose how to batch updates; the pattern alone does not guarantee correct timing or simultaneous refresh.
* **Pluggable Views and Controllers**: The conceptual separation allows developers to easily exchange view and controller objects, even at runtime.
* **Exchangeability of "Look and Feel"**: Because the model is independent of all user-interface code, a port of an MVC application to a new platform does not affect the functional core of the application; you only need suitable implementations of view and controller components for each platform.
* **Framework Potential**: It is possible to base an application framework on this pattern, as the various Smalltalk development environments have proven.

## Liabilities

* **Increased Complexity**: The strict division of responsibilities requires designing and maintaining three distinct kinds of components and their interactions. For relatively simple user interfaces, the MVC pattern can be heavy-handed and over-engineered. The GoF {% cite Gamma1995 %} argue that using separate model, view, and controller components for menus and simple text elements increases complexity without gaining much flexibility.
* **Potential for Excessive Updates**: Because changes to the model are blindly published to all subscribing views, minor data manipulations can trigger an excessive cascade of notifications, potentially causing severe performance bottlenecks. For example, a view with an iconized window may not need an update until the window is restored. This is the same "notification storm" problem that plagues the Observer pattern—MVC inherits it directly.
* **Inefficiency of Data Access in View**: A view may need several model queries to refresh its display. Querying after a notification is **pull**, not periodic polling. Coarser queries, snapshots, or carefully invalidated caches can reduce expensive repeated reads.
* **Intimate Connection Between View and Controller**: In classic MVC, a view and its controller may depend closely on each other, limiting their individual reuse. A passive display can use a controller that ignores input; a read-only view may still need input handling for scrolling or selection.
* **Close Coupling of Views and Controllers to the Model**: Both view and controller components make direct calls to the model. This implies that changes to the model's interface are likely to break the code of both view and controller. This problem is magnified if the system uses a multitude of views and controllers. Applying the [Command Processor](/SEBook/designpatterns/command.html) pattern (or another means of indirection) can address this.
* **Inevitability of Change to View and Controller When Porting**: All dependencies on the user-interface platform are encapsulated within view and controller. However, both components also contain code that is independent of a specific platform. A port of an MVC system thus requires the separation of platform-dependent code before rewriting.
* **Overlap with UI Toolkit Responsibilities**: Toolkits often handle low-level input and widget behavior already. A second controller layer that merely repeats this work may add little value. Keep domain decisions separate from presentation, but adapt the division of view and controller responsibilities to the toolkit.

# MVC as a Pattern Compound

MVC is one of the most important examples of a **pattern compound**—a combination of patterns where the whole is greater than the sum of its parts. Understanding MVC at the compound level reveals why it works:

1. [**Observer**](/SEBook/designpatterns/observer.html) (Model ↔ View): The model broadcasts change notifications; views subscribe and update themselves. This enables multiple synchronized views of the same data without the model knowing anything about the views.
2. [**Strategy**](/SEBook/designpatterns/strategy.html) (View ↔ Controller): The view delegates input handling to a controller object. Because the controller is a Strategy, it can be swapped at runtime—for example, replacing a standard editing controller with a read-only controller.
3. [**Composite**](/SEBook/designpatterns/composite.html) (View internals): The view itself is often a tree of nested UI components (windows containing panels containing buttons). The Composite pattern allows operations like `render()` to propagate through this tree uniformly.

These patterns support different aspects of classic MVC: Observer propagates changes, Strategy varies input handling, and Composite structures nested views. They do not make every component independent: views and controllers still depend on the model's public contract, and may depend closely on each other. A small MVC application can separate domain and presentation without needing a Composite view tree.

# Variants and Known Uses

POSA1 {% cite Buschmann1996 %} documents one classical variant, **Document-View**, which relaxes the separation of view and controller. In several GUI platforms (notably the X Window System) window display and event handling are closely interwoven, so the responsibilities of view and controller are combined into a single component while the document corresponds to the model. This sacrifices exchangeability of controllers but matches the underlying platform more naturally. The Document-View variant is the architecture used by Microsoft Foundation Class Library (MFC) and the ET++ application framework. The original known use, of course, is the Smalltalk-80 user-interface framework where MVC was first formulated.

# MVC in Modern Frameworks

Distinguish **classic Smalltalk MVC**, whose views observe model changes, from **server-side web MVC**. In a typical request-response flow, the controller receives a request, invokes model operations, and selects a view to render; the rendered page does not automatically subscribe to later server-side model changes. The Java Servlet/JSP tradition calls a controller-servlet plus view-template arrangement **Model 2**. These names describe related designs, not identical notification mechanisms.

Django uses **MTV (Model-Template-View)** terminology. Its view function selects data and normally delegates presentation to a template; its documentation identifies the framework's request-routing machinery as a controller role. This is more precise than equating each Django component one-to-one with a classic MVC component ([Django FAQ](https://docs.djangoproject.com/en/5.2/faq/general/#django-appears-to-be-a-mvc-framework-but-you-call-the-controller-the-view-and-the-view-the-template-how-come-you-don-t-use-the-standard-names)).

Modern client-side frameworks have evolved further variants:
* **MVP (Model-View-Presenter)**: Popularised in late-1990s/2000s GUI toolkits and the early Android UI stack. The Presenter mediates between Model and View; in Fowler's *Passive View* variant the View is a dumb shell exposing setters and forwarding events, and the Presenter contains all UI logic, which makes the Presenter highly testable.
* **MVVM (Model-View-ViewModel)**: The ViewModel exposes presentation state and commands for the View. Binding or observation connects them; automatic updates depend on that connection being configured. Unlike a Passive View presenter, the ViewModel need not issue calls to a particular View's setters.
* **Reactive/Component-Based**: React, for example, provides state updates that request rendering. This supplies a change-propagation mechanism, not a complete application architecture: developers still choose where domain logic, presentation state, and event handling belong ([React: Render and Commit](https://react.dev/learn/render-and-commit)).

Despite these variations, the core principle remains: **separate what the system knows (Model) from how it looks (View) from how the user interacts with it (Controller/Presenter/ViewModel)**.

# Code Example

This console example keeps task state in the model, rendering in the view, and user-intent translation in the controller. The model uses Observer-style notifications to refresh the view. `main` simulates user input by calling the controller directly; there is no GUI input adapter, swappable controller strategy, or Composite view tree. The example diagram shows this smaller collaboration. Subscriptions last for the whole demo; a longer-lived UI needs removal when a view closes, and C++ subscribers must remain alive while registered. The Java version uses Java 10 or later for `List.copyOf`.

> **Teaching example:** These snippets are intentionally small. They show one reasonable mapping of the pattern roles, not a drop-in architecture. In production, always tailor the pattern to the concrete context: lifecycle, ownership, error handling, concurrency, dependency injection, language idioms, and team conventions.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="MVC code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="ts" aria-selected="false">TypeScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
import java.util.ArrayList;
import java.util.List;

interface TaskObserver {
    void update(TaskModel model);
}

final class TaskModel {
    private final List<TaskObserver> observers = new ArrayList<>();
    private final List<String> tasks = new ArrayList<>();

    void attach(TaskObserver observer) {
        observers.add(observer);
    }

    void addTask(String task) {
        tasks.add(task);
        observers.forEach(observer -> observer.update(this));
    }

    List<String> getTasks() {
        return List.copyOf(tasks);
    }
}

final class TaskView implements TaskObserver {
    public void update(TaskModel model) {
        showTasks(model.getTasks());
    }

    void showTasks(List<String> tasks) {
        tasks.forEach(task -> System.out.println("- " + task));
    }
}

final class TaskController {
    private final TaskModel model;

    TaskController(TaskModel model) {
        this.model = model;
    }

    void addNewTask(String task) {
        model.addTask(task);
    }
}

public class Demo {
    public static void main(String[] args) {
        TaskModel model = new TaskModel();
        TaskView view = new TaskView();
        model.attach(view);
        new TaskController(model).addNewTask("Combine Observer with MVC");
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <iostream>
#include <string>
#include <utility>
#include <vector>

class TaskModel;

struct TaskObserver {
    virtual ~TaskObserver() = default;
    virtual void update(const TaskModel& model) = 0;
};

class TaskModel {
public:
    void attach(TaskObserver& observer) {
        observers_.push_back(&observer);
    }

    void addTask(std::string task) {
        tasks_.push_back(std::move(task));
        for (auto* observer : observers_) {
            observer->update(*this);
        }
    }

    const std::vector<std::string>& tasks() const {
        return tasks_;
    }

private:
    std::vector<TaskObserver*> observers_;
    std::vector<std::string> tasks_;
};

class TaskView : public TaskObserver {
public:
    void update(const TaskModel& model) override {
        for (const auto& task : model.tasks()) {
            std::cout << "- " << task << "\n";
        }
    }
};

class TaskController {
public:
    explicit TaskController(TaskModel& model) : model_(model) {}

    void addNewTask(std::string task) {
        model_.addTask(std::move(task));
    }

private:
    TaskModel& model_;
};

int main() {
    TaskModel model;
    TaskView view;
    model.attach(view);
    TaskController(model).addNewTask("Combine Observer with MVC");
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
from abc import ABC, abstractmethod


class TaskObserver(ABC):
    @abstractmethod
    def update(self, model: "TaskModel") -> None:
        pass


class TaskModel:
    def __init__(self) -> None:
        self._observers: list[TaskObserver] = []
        self._tasks: list[str] = []

    def attach(self, observer: TaskObserver) -> None:
        self._observers.append(observer)

    def add_task(self, task: str) -> None:
        self._tasks.append(task)
        for observer in self._observers:
            observer.update(self)

    def get_tasks(self) -> list[str]:
        return list(self._tasks)


class TaskView(TaskObserver):
    def update(self, model: TaskModel) -> None:
        self.show_tasks(model.get_tasks())

    def show_tasks(self, tasks: list[str]) -> None:
        for task in tasks:
            print(f"- {task}")


class TaskController:
    def __init__(self, model: TaskModel) -> None:
        self.model = model

    def add_new_task(self, task: str) -> None:
        self.model.add_task(task)


model = TaskModel()
view = TaskView()
model.attach(view)
TaskController(model).add_new_task("Combine Observer with MVC")
```
  </div>

  <div class="inline-language-panel" data-language-panel="ts" role="tabpanel" markdown="1">
```typescript
interface TaskObserver {
  update(model: TaskModel): void;
}

class TaskModel {
  private readonly observers: TaskObserver[] = [];
  private readonly tasks: string[] = [];

  attach(observer: TaskObserver): void {
    this.observers.push(observer);
  }

  addTask(task: string): void {
    this.tasks.push(task);
    this.observers.forEach((observer) => observer.update(this));
  }

  getTasks(): readonly string[] {
    return [...this.tasks];
  }
}

class TaskView implements TaskObserver {
  update(model: TaskModel): void {
    this.showTasks(model.getTasks());
  }

  showTasks(tasks: readonly string[]): void {
    tasks.forEach((task) => console.log(`- ${task}`));
  }
}

class TaskController {
  constructor(private readonly model: TaskModel) {}

  addNewTask(task: string): void {
    this.model.addTask(task);
  }
}

const model = new TaskModel();
const view = new TaskView();
model.attach(view);
new TaskController(model).addNewTask("Combine Observer with MVC");
```
  </div>
</div>

## Practice

{% include flashcards.html id="design_pattern_mvc" %}

{% include quiz.html id="design_pattern_mvc" %}
