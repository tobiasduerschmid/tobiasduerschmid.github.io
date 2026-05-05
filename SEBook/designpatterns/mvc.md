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

To maintain consistency without introducing tight coupling, MVC relies heavily on a change-propagation mechanism. The components interact through an orchestration of lower-level design patterns, making MVC a true "compound pattern".

* First, the relationship between the Model and the View utilizes the *[Observer](/SEBook/designpatterns/observer.html)* pattern. The model acts as the subject, and the views (and sometimes controllers) register as *Observers*. When the model undergoes a state change, it broadcasts a notification, prompting the views to query the model for updated data and redraw themselves.
* Second, the relationship between the View and the Controller utilizes the [Strategy](/SEBook/designpatterns/strategy.html) pattern. The controller encapsulates the strategy for handling user input, allowing the view to delegate all input response behavior. This allows software engineers to easily swap controllers at runtime if different behavior is required (e.g., swapping a standard controller for a read-only controller).
* Third, the view often employs the *[Composite](/SEBook/designpatterns/composite.html)* pattern to manage complex, nested user interface elements, such as windows containing panels, which in turn contain buttons.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-caption="UML class diagram showing the MVC roles — a Model notifies many Observer views; a View reads from the Model and delegates user input to a Controller; the Controller updates the Model." data-uml-spec='@startuml
layout landscape
class Model
interface Observer {
    + update(model: Model): void
}
class View {
    + update(model: Model): void
    + render(): void
}
class Controller {
    + handleInput(): void
}
Model "1" -- "*" Observer : notifies >
View ..|> Observer
View --> Model : reads
View --> Controller : delegates input
Controller --> Model : updates
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-caption="UML class diagram of a concrete MVC example — a TaskController updates a TaskModel; the TaskView observes the Model and renders the task list; the View forwards user commands to the Controller." data-uml-spec='@startuml
layout landscape
class TaskModel {
    + addTask(task: String): void
    + getTasks(): List<String>
}
interface Observer {
    + update(model: TaskModel): void
}
class TaskView {
    + update(model: TaskModel): void
    + showTasks(tasks: List<String>): void
}
class TaskController {
    + addNewTask(task: String): void
}
TaskModel "1" -- "*" Observer : notifies >
TaskView ..|> Observer
TaskView --> TaskModel : reads tasks
TaskController --> TaskModel : changes state
TaskView --> TaskController : delegates commands
@enduml'></div>

## Sequence Diagram

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-caption="UML sequence diagram showing how a user command flows from the TaskController to the TaskModel, which then notifies the TaskView via Observer-style update() so the view re-reads tasks and re-renders." data-uml-spec='@startuml
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
@enduml'></div>


# Consequences

Applying the MVC pattern yields profound architectural advantages, but it also introduces notable liabilities that an engineer must carefully mitigate.

## Benefits

* **Multiple Views of the Same Model**: MVC strictly separates the model from the user-interface components. Multiple views can therefore be implemented and used with a single model, and at run-time multiple views can be open simultaneously and opened or closed dynamically.
* **Synchronized Views**: Because of the Observer-based change-propagation mechanism, all attached observers are notified of changes to the application's data at the correct time, keeping all dependent views and controllers synchronized.
* **Pluggable Views and Controllers**: The conceptual separation allows developers to easily exchange view and controller objects, even at runtime.
* **Exchangeability of "Look and Feel"**: Because the model is independent of all user-interface code, a port of an MVC application to a new platform does not affect the functional core of the application; you only need suitable implementations of view and controller components for each platform.
* **Framework Potential**: It is possible to base an application framework on this pattern, as the various Smalltalk development environments have proven.

## Liabilities

* **Increased Complexity**: The strict division of responsibilities requires designing and maintaining three distinct kinds of components and their interactions. For relatively simple user interfaces, the MVC pattern can be heavy-handed and over-engineered. The GoF {% cite Gamma1995 %} argue that using separate model, view, and controller components for menus and simple text elements increases complexity without gaining much flexibility.
* **Potential for Excessive Updates**: Because changes to the model are blindly published to all subscribing views, minor data manipulations can trigger an excessive cascade of notifications, potentially causing severe performance bottlenecks. For example, a view with an iconized window may not need an update until the window is restored. This is the same "notification storm" problem that plagues the Observer pattern—MVC inherits it directly.
* **Inefficiency of Data Access in View**: To preserve loose coupling, views must frequently query the model through its public interface to retrieve display data. Depending on the model's interface, a view may need to make multiple calls to obtain all its display data. If not carefully designed with data caching, this frequent polling can be highly inefficient.
* **Intimate Connection Between View and Controller**: While the model is isolated, the view and its corresponding controller are often closely-related but separate components. A view rarely exists without its specific controller, which hinders their individual reuse—the exception being read-only views that share a controller that ignores all input.
* **Close Coupling of Views and Controllers to the Model**: Both view and controller components make direct calls to the model. This implies that changes to the model's interface are likely to break the code of both view and controller. This problem is magnified if the system uses a multitude of views and controllers. Applying the [Command Processor](/SEBook/designpatterns/command.html) pattern (or another means of indirection) can address this.
* **Inevitability of Change to View and Controller When Porting**: All dependencies on the user-interface platform are encapsulated within view and controller. However, both components also contain code that is independent of a specific platform. A port of an MVC system thus requires the separation of platform-dependent code before rewriting.
* **Difficulty of Using MVC with Modern UI Tools**: If portability is not an issue, using high-level toolkits or user interface builders can rule out the use of MVC. Many high-level tools or toolkits define their own flow of control and handle some events internally (such as displaying a pop-up menu or scrolling a window), and a high-level platform may already interpret events and offer callbacks for each kind of user activity—so most controller functionality is therefore already provided by the toolkit, and a separate component is not needed.

# MVC as a Pattern Compound

MVC is one of the most important examples of a **pattern compound**—a combination of patterns where the whole is greater than the sum of its parts. Understanding MVC at the compound level reveals why it works:

1. [**Observer**](/SEBook/designpatterns/observer.html) (Model ↔ View): The model broadcasts change notifications; views subscribe and update themselves. This enables multiple synchronized views of the same data without the model knowing anything about the views.
2. [**Strategy**](/SEBook/designpatterns/strategy.html) (View ↔ Controller): The view delegates input handling to a controller object. Because the controller is a Strategy, it can be swapped at runtime—for example, replacing a standard editing controller with a read-only controller.
3. [**Composite**](/SEBook/designpatterns/composite.html) (View internals): The view itself is often a tree of nested UI components (windows containing panels containing buttons). The Composite pattern allows operations like `render()` to propagate through this tree uniformly.

The **emergent property** of this compound is a clean three-way separation where each component can be developed, tested, and replaced independently. No individual pattern achieves this alone—it is the *combination* of Observer (data synchronization), Strategy (input flexibility), and Composite (UI structure) that makes MVC powerful.

# Variants and Known Uses

POSA1 {% cite Buschmann1996 %} documents one classical variant, **Document-View**, which relaxes the separation of view and controller. In several GUI platforms (notably the X Window System) window display and event handling are closely interwoven, so the responsibilities of view and controller are combined into a single component while the document corresponds to the model. This sacrifices exchangeability of controllers but matches the underlying platform more naturally. The Document-View variant is the architecture used by Microsoft Foundation Class Library (MFC) and the ET++ application framework. The original known use, of course, is the Smalltalk-80 user-interface framework where MVC was first formulated.

# MVC in Modern Frameworks

It is important to distinguish Reenskaug's **classic Smalltalk MVC** — in which the View *observes* the Model directly via the Observer pattern — from the **server-side "web MVC"** popularised by Ruby on Rails, Spring MVC, and ASP.NET MVC. In the request-response cycle of a web framework, the View does not subscribe to model change events; instead the Controller receives an HTTP request, updates the Model, selects a View, and hands it the data to render. This server-side adaptation was originally called **"Model 2"** in the Java Servlet/JSP world. Some authors (notably Martin Fowler) argue this arrangement is closer to **Model-View-Adapter** than to classic MVC. Django takes the same idea further and renames the components **MVT (Model-View-Template)** — what Django calls a *View* plays the controller role, and the *Template* plays the view role.

Modern client-side frameworks have evolved further variants:
* **MVP (Model-View-Presenter)**: Popularised in late-1990s/2000s GUI toolkits and the early Android UI stack. The Presenter mediates between Model and View; in Fowler's *Passive View* variant the View is a dumb shell exposing setters and forwarding events, and the Presenter contains all UI logic, which makes the Presenter highly testable.
* **MVVM (Model-View-ViewModel)**: Devised by Microsoft architects Ken Cooper and Ted Peters and announced publicly by John Gossman in a 2005 blog post about WPF; now used in SwiftUI, Android Jetpack, Knockout.js, and Vue.js. The ViewModel exposes view-shaped data and commands through *data binding*, so the View updates automatically without an explicit Observer subscription written by the developer. Microsoft describes MVVM as a specialisation of Martin Fowler's earlier *Presentation Model*.
* **Reactive/Component-Based**: Modern frameworks replace the explicit Observer mechanism with framework-managed reactivity. React reconciles a virtual DOM whenever component state (e.g. `useState`) changes; Angular (Signals stable from v17) and SolidJS use signals for fine-grained reactivity; Vue 3 uses reactive proxies. In all cases, the framework handles change propagation internally, so developers rarely implement Observer explicitly.

Despite these variations, the core principle remains: **separate what the system knows (Model) from how it looks (View) from how the user interacts with it (Controller/Presenter/ViewModel)**.

# Code Example

This example keeps task state in the model, rendering in the view, and user-intent translation in the controller. The model uses Observer-style notifications to refresh the view.

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
