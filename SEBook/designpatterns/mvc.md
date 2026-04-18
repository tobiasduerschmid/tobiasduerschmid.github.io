---
title: Model-View-Controller (MVC)
layout: sebook

---

The Model-View-Controller (MVC) architectural pattern decomposes an interactive application into three distinct components: a model that encapsulates the core application data and business logic, a view that renders this information to the user, and a controller that translates user inputs into corresponding state updates.

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
* Second, the relationship between the View and the Controller utilizes the Strategy pattern. The controller encapsulates the strategy for handling user input, allowing the view to delegate all input response behavior. This allows software engineers to easily swap controllers at runtime if different behavior is required (e.g., swapping a standard controller for a read-only controller).
* Third, the view often employs the *[Composite](/SEBook/designpatterns/composite.html)* pattern to manage complex, nested user interface elements, such as windows containing panels, which in turn contain buttons.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
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

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
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

<div class="uml-class-diagram-container" data-uml-type="sequence" data-uml-spec='@startuml
participant user: User
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
model --> view: tasks
view -> view: showTasks(tasks)
deactivate view
deactivate model
deactivate controller
@enduml'></div>


# Consequences

Applying the MVC pattern yields profound architectural advantages, but it also introduces notable liabilities that an engineer must carefully mitigate.

## Benefits

* **Multiple Synchronized Views**: Because of the Observer-based change propagation, you can attach multiple varying views to the same model. When the model changes, all views remain perfectly synchronized and updated.
* **Pluggable User Interfaces**: The conceptual separation allows developers to easily exchange view and controller objects, even at runtime.
* **Reusability and Portability**: Because the model knows nothing about the views or controllers, the core domain logic can be reused across entirely different systems. Furthermore, porting the system to a new platform only requires rewriting the platform-dependent view and controller code, leaving the model untouched.

## Liabilities

* **Increased Complexity**: The strict division of responsibilities requires designing and maintaining three distinct kinds of components and their interactions. For relatively simple user interfaces, the MVC pattern can be heavy-handed and over-engineered. As Bass, Clements, and Kazman note: *"The complexity may not be worth it for simple user interfaces."*
* **Potential for Excessive Updates**: Because changes to the model are blindly published to all subscribing views, minor data manipulations can trigger an excessive cascade of notifications, potentially causing severe performance bottlenecks. This is the same "notification storm" problem that plagues the Observer pattern—MVC inherits it directly.
* **Inefficiency of Data Access**: To preserve loose coupling, views must frequently query the model through its public interface to retrieve display data. If not carefully designed with data caching, this frequent polling can be highly inefficient.
* **Tight Coupling Between View and Controller**: While the model is isolated, the view and its corresponding controller are often intimately connected. A view rarely exists without its specific controller, which hinders their individual reuse.

# MVC as a Pattern Compound

MVC is one of the most important examples of a **pattern compound**—a combination of patterns where the whole is greater than the sum of its parts. Understanding MVC at the compound level reveals why it works:

1. **Observer** (Model ↔ View): The model broadcasts change notifications; views subscribe and update themselves. This enables multiple synchronized views of the same data without the model knowing anything about the views.
2. **Strategy** (View ↔ Controller): The view delegates input handling to a controller object. Because the controller is a Strategy, it can be swapped at runtime—for example, replacing a standard editing controller with a read-only controller.
3. **Composite** (View internals): The view itself is often a tree of nested UI components (windows containing panels containing buttons). The Composite pattern allows operations like `render()` to propagate through this tree uniformly.

The **emergent property** of this compound is a clean three-way separation where each component can be developed, tested, and replaced independently. No individual pattern achieves this alone—it is the *combination* of Observer (data synchronization), Strategy (input flexibility), and Composite (UI structure) that makes MVC powerful.

# MVC in Modern Frameworks

While the original MVC concept remains foundational, modern frameworks have evolved several variants:
* **MVVM (Model-View-ViewModel)**: Used in WPF, SwiftUI, and Vue.js. The ViewModel acts as an adapter between Model and View, exposing data through bindings rather than explicit Observer subscriptions.
* **MVP (Model-View-Presenter)**: Used in Android (traditional). The Presenter replaces the Controller and takes on more responsibility for updating the View directly.
* **Reactive/Component-Based**: Modern frameworks replace the explicit Observer mechanism with framework-managed reactivity. React uses hooks and virtual DOM diffing; Angular 16+ and SolidJS use Signals; Vue.js uses reactive proxies. In all cases, the framework handles notification propagation internally, so developers rarely implement Observer explicitly.

Despite these variations, the core principle remains: **separate what the system knows (Model) from how it looks (View) from how the user interacts with it (Controller/ViewModel/Presenter)**.

# Sample Code 
This sample code shows how MVC could be implemented in Python:

```python
# ==========================================
# 0. OBSERVER PATTERN BASE CLASSES
# ==========================================
class Subject:
    """The 'Observable' - broadcasts changes."""
    def __init__(self):
        self._observers = []

    def attach(self, observer):
        if observer not in self._observers:
            self._observers.append(observer)

    def detach(self, observer):
        self._observers.remove(observer)

    def notify(self):
        """Alerts all observers that a change happened."""
        for observer in self._observers:
            observer.update(self)

class Observer:
    """The 'Watcher' - reacts to changes."""
    def update(self, subject):
        pass


# ==========================================
# 1. THE MODEL (The Subject)
# ==========================================
class TaskModel(Subject):
    def __init__(self):
        super().__init__() # Initialize the Subject part
        self.tasks = []

    def add_task(self, task):
        self.tasks.append(task)
        self.notify() 

    def get_tasks(self):
        return self.tasks


# ==========================================
# 2. THE VIEW (The Observer)
# ==========================================
class TaskView(Observer):
    def update(self, subject):
        # When notified, the view pulls the latest data directly from the model
        tasks = subject.get_tasks()
        self.show_tasks(tasks)

    def show_tasks(self, tasks):
        print("\n--- Live Auto-Updated List ---")
        for index, task in enumerate(tasks, start=1):
            print(f"{index}. {task}")
        print("------------------------------\n")


# ==========================================
# 3. THE CONTROLLER (The Middleman)
# ==========================================
class TaskController:
    def __init__(self, model):
        self.model = model

    def add_new_task(self, task):
        print(f"Controller: Adding task '{task}'...")
        # The controller only updates the model. It trusts the model to handle the rest.
        self.model.add_task(task)


# ==========================================
# HOW IT ALL WORKS TOGETHER
# ==========================================
if __name__ == "__main__":
    # 1. Initialize Model and View
    my_model = TaskModel()
    my_view = TaskView()
    
    # 2. Wire them up (The View subscribes to the Model)
    my_model.attach(my_view)

    # 3. Initialize Controller (Notice it only needs the Model now)
    app_controller = TaskController(my_model)

    # 4. Simulate user input. 
    # Watch how adding a task automatically triggers the View to print!
    app_controller.add_new_task("Learn the Observer pattern")
    app_controller.add_new_task("Combine Observer with MVC")
```

# Flashcards

{% include flashcards.html id="design_pattern_mvc" %}

# Quiz

{% include quiz.html id="design_pattern_mvc" %}