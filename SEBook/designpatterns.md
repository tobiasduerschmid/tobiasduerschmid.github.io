---
title: Design Patterns
layout: sebook
---

# Overview

In software engineering, a design pattern is a ==common, acceptable solution to a recurring design problem that arises within a specific context==. The concept did not originate in computer science, but rather in architecture. Christopher Alexander, an architect who pioneered the idea, defined a pattern beautifully: **"Each pattern describes a problem which occurs over and over again in our environment, and then describes the core of the solution to that problem, in such a way that you can use this solution a million times over, without ever doing it the same way twice"**.

In software development, design patterns refer to medium-level abstractions that describe structural and behavioral aspects of software. They sit between low-level language **idioms** (like how to efficiently concatenate strings in Java) and large-scale **architectural patterns** (like Model-View-Controller or client-server patterns). Structurally, they deal with classes, objects, and the assignment of responsibilities; behaviorally, they govern method calls, message sequences, and execution semantics. 

## Anatomy of a Pattern
A true pattern is more than simply a good idea or a random solution; it requires a structured format to capture the problem, the context, the solution, and the consequences. While various authors use slightly different templates, the fundamental anatomy of a design pattern contains the following essential elements:

* **Pattern Name**: A good name is vital as it becomes a handle we can use to describe a design problem, its solution, and its consequences in a word or two. Naming a pattern increases our design vocabulary, allowing us to design and communicate at a higher level of abstraction.
* **Context**: This defines the recurring situation or environment in which the pattern applies and where the problem exists.
* **Problem**: This describes the specific design issue or goal you are trying to achieve, along with the constraints symptomatic of an inflexible design.
* **Forces**: This outlines the trade-offs and competing concerns that must be balanced by the solution.
* **Solution**: This describes the elements that make up the design, their relationships, responsibilities, and collaborations. It specifies the spatial configuration and behavioral dynamics of the participating classes and objects.
* **Consequences**: This explicitly lists the results, costs, and benefits of applying the pattern, including its impact on system flexibility, extensibility, portability,  performance, and other quality attributes.

## GoF Design Patterns

The GoF (Gang of Four) design patterns are organized into three categories based on the *type of design problem* they address:

**Creational Patterns** address the problem of *object creation*—how to instantiate objects in a flexible, decoupled way:
* [**Factory Method**](/SEBook/designpatterns/factory_method.html): Defines an interface for creating an object but lets subclasses decide which class to instantiate, deferring creation to subclasses.
* [**Abstract Factory**](/SEBook/designpatterns/abstract_factory.html): Provides an interface for creating families of related objects without specifying their concrete classes.
* [**Singleton**](/SEBook/designpatterns/singleton.html): Ensures a class has only one instance while providing a controlled global point of access to it.

**Structural Patterns** address the problem of *class and object composition*—how to assemble objects and classes into larger structures:
* [**Adapter**](/SEBook/designpatterns/adapter.html): Converts the interface of a class into another interface clients expect, letting classes work together that otherwise couldn't due to incompatible interfaces.
* [**Composite**](/SEBook/designpatterns/composite.html): Composes objects into tree structures to represent part-whole hierarchies, letting clients treat individual objects and compositions uniformly.
* [**Façade**](/SEBook/designpatterns/facade.html): Provides a unified interface to a set of interfaces in a subsystem, making the subsystem easier to use.

**Behavioral Patterns** address the problem of *object interaction and responsibility*—how objects communicate and distribute work:
* [**Observer**](/SEBook/designpatterns/observer.html): Establishes a one-to-many dependency between objects, ensuring that dependent objects are automatically notified and updated whenever the subject's state changes.
* [**State**](/SEBook/designpatterns/state.html): Encapsulates state-based behavior into distinct classes, allowing a context object to dynamically alter its behavior at runtime by delegating operations to its current state object.
* [**Mediator**](/SEBook/designpatterns/mediator.html): Encapsulates how a set of objects interact by introducing a mediator object that centralizes complex communication logic.

These categories help practitioners narrow down which pattern might apply: if the problem is about *creating* objects flexibly, look at creational patterns; if it is about *structuring* relationships between classes, look at structural patterns; if it is about *coordinating behavior* between objects, look at behavioral patterns.

## Architectural Patterns

Architectural patterns operate at a higher level of abstraction than GoF design patterns. While GoF patterns deal with classes, objects, and method calls, architectural patterns constrain the gross structure of an entire system. As Taylor and Medvidovic put it: **architectural styles are strategic while patterns are tactical design tools**—a style constrains the overall architectural decisions, while a pattern provides a concrete, parameterized solution fragment.

Here are some examples of architectural patterns that we describe in more detail:

* [**Model-View-Controller (MVC)**](/SEBook/designpatterns/mvc.html): The Model-View-Controller (MVC) architectural pattern decomposes an interactive application into three distinct components: a model that encapsulates the core application data and business logic, a view that renders this information to the user, and a controller that translates user inputs into corresponding state updates.

## The Benefits of a Shared Toolbox
Just as a mechanic must know their toolbox, a software engineer must know design patterns intimately—understanding their advantages, disadvantages, and knowing precisely when (and when not) to use them.

*   **A Common Language for Communication:** The primary challenge in multi-person software development is communication. Patterns solve this by providing a robust, shared vocabulary. If an engineer suggests using the "Observer" or "Strategy" pattern, the team instantly understands the problem, the proposed architecture, and the resulting interactions without needing a lengthy explanation.
*   **Capturing Design Intent:** When you encounter a design pattern in existing code, it communicates not only *what* the software does, but *why* it was designed that way. 
*   **Reusable Experience:** Patterns are abstractions of design experience gathered by seasoned practitioners. By studying them, developers can rely on tried-and-tested methods to build flexible and maintainable systems instead of reinventing the wheel.

## Challenges and Pitfalls of Design Patterns
Despite their power, design patterns are not silver bullets. Misusing them introduces severe challenges:

*   **The "Hammer and Nail" Syndrome:** Novice developers who just learned patterns often try to apply them to every problem they see. **Software quality is not measured by the number of patterns used.** Often, keeping the code simple and avoiding a pattern entirely is the best solution. As Beck advocates: *"Start stupid and evolve."* Or as Booch puts it: *"Complex systems that work evolved from simple systems that worked."*
*   **Over-engineering vs. Under-engineering:** Under-engineering makes software too rigid for future changes. However, over-applying patterns leads to over-engineering—creating premature abstractions that make the codebase unnecessarily complex, unreadable, and a waste of development time. Developers must constantly balance **simplicity** (fewer classes and patterns) against **changeability** (greater flexibility but more abstraction).
*   **Implicit Dependencies:** Patterns intentionally replace static, compile-time dependencies with dynamic, runtime interactions. This flexibility comes at a cost: it becomes harder to trace the execution flow and state of the system just by reading the code.
*   **Misinterpretation as Recipes:** A pattern is an abstract idea, not a snippet of code from Stack Overflow. Integrating a pattern into a system is a human-intensive, manual activity that requires tailoring the solution to fit a concrete context. As Bass, Clements, and Kazman note: *"Applying a pattern is not an all-or-nothing proposition. Pattern definitions given in catalogs are strict, but in practice architects may choose to violate them in small ways when there is a good design tradeoff to be had."*

## Common Student Misconceptions

Research on teaching design patterns reveals specific, recurring pitfalls that learners should be aware of:

*   **Learning Structure but Not Intent:** A study by Cai et al. found that **as many as 74% of student submissions** did not faithfully implement a modular design even though their software functioned correctly. Students learned the gross structure of patterns easily, yet they made lower-level mistakes that violated the pattern's underlying intent—introducing extra dependencies that defeated the very modularity the pattern was meant to achieve. The lesson: *correct behavior is not the same as correct design*. A program can produce the right output while still being poorly structured for future change.
*   **Ignoring Evolution Scenarios:** The true value of a design pattern is only realized as software evolves, but student assignments, once completed, seldom evolve. Without experiencing the pain of modifying tightly coupled code, it is hard to appreciate why a pattern matters. To internalize the value of patterns, try to imagine concrete future changes (e.g., "What if we need a new type of observer?" or "What if we need to swap the database?") and evaluate whether the design would gracefully accommodate them.
*   **Confusing Patterns with Antipatterns:** Just as patterns represent proven solutions, **antipatterns** represent common *poor* design choices—such as Spaghetti Code, God Class, or Lava Flow—that lead to maintainability and security issues. Recognizing antipatterns requires going beyond individual instructions into reasoning about how methods and classes are architected. Students should be exposed to both: patterns teach *what good structure looks like*, while antipatterns teach *what to avoid*.
*   **The "Before and After" Exercise:** A powerful technique for internalizing patterns, reported by Astrachan et al. from the first UP (Using Patterns) conference, involves taking a working solution that does *not* use a pattern and then refactoring it to introduce the appropriate pattern. By comparing the "before" and "after" versions—particularly when extending both with a new requirement—the concrete advantages of the pattern become viscerally clear. As the adage goes: *"Good design comes from experience, and experience comes from bad design."*

# Context Tailoring 
It is important to remember that the standard description of a pattern presents an abstract solution to an abstract problem. Integrating a pattern into a software system is a highly human-intensive, manual activity; patterns cannot simply be misinterpreted as step-by-step recipes or copied as raw code. Instead, developers must engage in **context tailoring**—the process of taking an abstract pattern and instantiating it into a concrete solution that perfectly fits the concrete problem and the concrete context of their application.

Because applying a pattern outside of its intended problem space can result in bad design (such as the notorious over-use of the Singleton pattern), tailoring ensures that the pattern acts as an effective tool rather than an arbitrary constraint. 

## The Tailoring Process: The Measuring Tape and the Scissors

Context tailoring can be understood through the metaphor of making a custom garment, which requires two primary steps: using a "measuring tape" to observe the context, and using "scissors" to make the necessary adjustments.

### 1. Observation of Context
Before altering a design pattern, you must thoroughly observe and measure the environment in which it will operate. This involves analyzing three main areas:
*   **Project-Specific Needs:** What kind of evolution is expected? What features are planned for the future, and what frameworks is the system currently relying on?
*   **Desired System Properties:** What are the overarching goals of the software? Must the architecture prioritize run-time performance, strict security, or long-term maintainability?
*   **The Periphery:** What is the complexity of the surrounding environment? Which specific classes, objects, and methods will directly interact with the pattern's participants?

### 2. Making Adjustments
Once the context is mapped, developers must "cut" the pattern to fit. This requires considering the broad design space of the pattern and exploring its various alternatives and variation points. After evaluating the context-specific consequences of these potential variations, the developer implements the most suitable version. Crucially, **the design decisions and the rationale behind those adjustments must be thoroughly documented**. Without documentation, future developers will struggle to understand why a pattern deviates from its textbook structure.

## Dimensions of Variation

Every design pattern describes a broad design space containing many distinct variations. When tailoring a pattern, developers typically modify it along four primary dimensions:

### Structural Variations
These variations alter the roles and responsibility assignments defined in the abstract pattern, directly impacting how the system can evolve. For example, the Factory Method pattern can be structurally varied by removing the abstract product class entirely. Instead, a single concrete product is implemented and configured with different parameters. This variation trades the extensibility of a massive subclass hierarchy for immediate simplicity. 

### Behavioral Variations
Behavioral variations modify the interactions and communication flows between objects. These changes heavily impact object responsibilities, system evolution, and run-time quality attributes like performance. A classic example is the Observer pattern, which can be tailored into a "Push model" (where the subject pushes all updated data directly to the observer) or a "Pull model" (where the subject simply notifies the observer, and the observer must pull the specific data it needs). 

### Internal Variations
These variations involve refining the internal workings of the pattern's participants without necessarily changing their external structural interfaces. A developer might tailor a pattern internally by choosing a specific list data structure to hold observers, adding thread-safety mechanisms, or implementing a specialized sorting algorithm to maximize performance for expected data sets.

### Language-Dependent Variations
Modern programming languages offer specific constructs that can drastically simplify pattern implementations. For instance, dynamically typed languages can often omit explicit interfaces, and aspect-oriented languages can replace standard polymorphism with aspects and point-cuts. However, there is a dangerous trap here: **using language features to make a pattern entirely reusable as code (e.g., using `include Singleton` in Ruby) eliminates the potential for context tailoring**. Design patterns are fundamentally about *design* reuse, not exact code reuse.

## The Global vs. Local Optimum Trade-off

While context tailoring is essential, it introduces a significant challenge in large-scale software projects. Perfectly tailoring a pattern to every individual sub-problem creates a "local optimum". However, **a large amount of pattern variation scattered throughout a single project can lead to severe confusion due to overloaded meaning**. 

If developers use the textbook Observer pattern in one module, but highly customized, structurally varied Observers in another, incoming developers might falsely assume identical behavior simply because the classes share the "Observer" naming convention. To mitigate this, large teams must rely on **project conventions** to establish pattern consistency. Teams must explicitly decide whether to embrace diverse, highly tailored implementations (and name them distinctly) or to enforce strict guidelines on which specific pattern variants are permitted within the codebase.


# Pattern Compounds
In software design, applying individual design patterns is akin to utilizing distinct compositional techniques in photography—such as symmetry, color contrast, leading lines, and a focal object. Simply having these patterns present does not guarantee a masterpiece; their deliberate arrangement is crucial. When leading lines intentionally point toward a focal object, a more pleasing image emerges. In software architecture, this synergistic combination is known as a pattern compound.

**A pattern compound is a reoccurring set of patterns with overlapping roles from which additional properties emerge**. Notably, pattern compounds are patterns in their own right, complete with an abstract problem, an abstract context, and an abstract solution. While pattern languages provide a meta-level conceptual framework or grammar for how patterns relate to one another, pattern compounds are concrete structural and behavioral unifications.

## The Anatomy of Pattern Compounds
The core characteristic of a pattern compound is that the participating domain classes take on multiple superimposed roles simultaneously. By explicitly connecting patterns, developers can leverage one pattern to solve a problem created by another, leading to a new set of emergent properties and consequences. 

## Solving Structural Complexity: The Composite Builder
The Composite pattern is excellent for creating unified tree structures, but initializing and assembling this abstract object structure is notoriously difficult. The Builder pattern, conversely, is designed to construct complex object structures. By combining them, the Composite's `Component` acts as the Builder's `AbstractProduct`, while the `Leaf` and `Composite` act as `ConcreteProducts`. 

This compound yields the emergent properties of **looser coupling between the client and the composite structure** and the ability to create different representations of the encapsulated composite. However, as a trade-off, dealing with a recursive data structure within a Builder introduces even more complexity than using either pattern individually.

## Managing Operations: The Composite Visitor and Composite Command
Pattern compounds frequently emerge when scaling behavioral patterns to handle structural complexity:
*   **Composite Visitor:** If a system requires many custom operations to be defined on a Composite structure without modifying the classes themselves (and no new leaves are expected), a Visitor can be superimposed. This yields the emergent property of **strict separation of concerns**, keeping core structural elements distinct from use-case-specific operations.
*   **Composite Command:** When a system involves hierarchical actions that require a simple execution API, a Composite Command groups multiple command objects into a unified tree. This allows individual command pieces to be shared and reused, though developers must manage the consequence of execution order ambiguity.

## Communicating Design Intent and Context Tailoring
Pattern compounds also naturally arise when tailoring patterns to specific contexts or when communicating highly specific design intents.
*   **Null State / Null Strategy:** If an object enters a "do nothing" state, combining the State pattern with the Null Object pattern perfectly communicates the design intent of empty behavior. (Note that there is no Null Decorator, as a decorator must fully implement the interface of the decorated object).
*   **Singleton State:** If State objects are entirely stateless—meaning they carry behavior but no data, and do not require a reference back to their Context—they can be implemented as Singletons. This tailoring decision saves memory and eases object creation, though it permanently couples the design by removing the ability to reference the Context in the future.

## The Advantages of Compounding Patterns
The primary advantage of pattern compounds is that they **make software design more coherent**. Instead of finding highly optimized but fragmented patchwork solutions for every individual localized problem, compounds provide overarching design ideas and unifying themes. They raise the composition of patterns to a higher semantic abstraction, enabling developers to systematically foresee how the consequences of one pattern map directly to the context of another.

## Challenges and Pitfalls
Despite their power, pattern compounds introduce distinct architectural and cognitive challenges:
*   **Mixed Concerns:** Because pattern compounds superimpose overlapping roles, a single class might juggle three distinct concerns: its core domain functionality, its responsibility in the first pattern, and its responsibility in the second. This can severely overload a class and muddle its primary responsibility.
*   **Obscured Foundations:** Tightly compounding patterns can make it much harder for incoming developers to visually identify the individual, foundational patterns at play.
*   **Naming Limitations:** Accurately naming a class to reflect its domain purpose alongside multiple pattern roles (e.g., a "PlayerObserver") quickly becomes unmanageable, forcing teams to rely heavily on external documentation to explain the architecture.
*   **The Over-Engineering Trap:** As with any design abstraction, possessing the "hammer" of a pattern compound does not make every problem a nail. Developers must constantly evaluate whether the resulting architectural complexity is truly justified by the context.

# Design Patterns and Refactoring

Design patterns and refactoring are deeply connected. As Tokuda and Batory demonstrated, refactorings are behavior-preserving program transformations that can automate the evolution of a design *toward* a pattern. The principle is straightforward: **designs should evolve on an if-needed basis**. Rather than speculating upfront about which patterns might be needed, start with the simplest working solution and refactor toward a pattern when code smells indicate the need.

Common code smells that suggest specific patterns:

| Code Smell | Suggested Pattern | Why |
|------------|-------------------|-----|
| Large `if/else` or `switch` on object state | [State](/SEBook/designpatterns/state.html) | Replace conditional logic with polymorphic state objects |
| Duplicated conditional logic choosing algorithms | Strategy | Extract varying algorithms into interchangeable objects |
| Complex object creation with many conditionals | [Factory Method](/SEBook/designpatterns/factory_method.html) or [Abstract Factory](/SEBook/designpatterns/abstract_factory.html) | Separate creation logic from usage logic |
| Client tightly coupled to incompatible third-party API | [Adapter](/SEBook/designpatterns/adapter.html) | Translate the foreign interface behind a wrapper |
| Client must orchestrate many subsystem calls | [Façade](/SEBook/designpatterns/facade.html) | Hide coordination behind a simplified interface |
| Many-to-many dependencies between objects | [Mediator](/SEBook/designpatterns/mediator.html) | Centralize interaction logic |
| Hardcoded notification to specific dependents | [Observer](/SEBook/designpatterns/observer.html) | Decouple subject from its dependents |

The **Rule of Three** provides a useful heuristic: do not apply a pattern until you have seen the need at least three times. This prevents speculative abstraction—creating flexibility for variation points that may never actually vary.

# Advanced Concepts 
## Patterns Within Patterns: Core Principles
When analyzing various design patterns, you will begin to notice recurring micro-architectures. Design patterns are often built upon fundamental software engineering principles:

*   **Delegation over Inheritance:** Subclassing can lead to rigid designs and code duplication (e.g., trying to create an inheritance tree for cars that can be electric, gas, hybrid, and also either drive or fly). Patterns like Strategy, State, and Bridge solve this by extracting varying behaviors into separate classes and delegating responsibilities to them.
*   **Polymorphism over Conditions:** Patterns frequently replace complex `if/else` or `switch` statements with polymorphic objects. For instance, instead of conditional logic checking the state of an algorithm, the Strategy pattern uses interchangeable objects to represent different execution paths.
*   **Additional Layers of Indirection:** To reduce strong coupling between interacting components, patterns like the Mediator or Facade introduce an intermediate object to handle communication. While this centralizes logic and improves changeability, it can create long traces of method calls that are harder to debug.


## Domain-Specific and Application-Specific Patterns
The Gang of Four patterns are generic to object-oriented programming, but patterns exist at all levels. 
*   **Domain-Specific Patterns:** Certain industries (like Game Development, Android Apps, or Security) have their own highly tailored patterns. Because these patterns make assumptions about a specific domain, they generally carry fewer negative consequences within their niche, but they require the team to actually possess domain expertise.
*   **Application-Specific Patterns:** Every distinct software project will eventually develop its own localized patterns—agreed-upon conventions and structures unique to that team. Identifying and documenting these implicit patterns is one of the most critical steps when a new developer joins an existing codebase, as it massively improves program comprehension.

# Flashcards

{% include flashcards.html id="design_patterns" %}

{% include flashcards.html id="design_patterns_gof" %}

# Quiz

{% include quiz.html id="design_patterns" %}

# Conclusion
Design patterns are the foundational building blocks of robust software architecture. However, they are a substitute for neither domain expertise nor critical thought. The mark of an expert engineer is not knowing how to implement every pattern, but possessing the wisdom to evaluate trade-offs, carefully observe the context, and know exactly when the simplest code is actually the smartest design.