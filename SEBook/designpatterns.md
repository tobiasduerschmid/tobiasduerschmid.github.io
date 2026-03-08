---
title: Design Patterns
layout: sebook
---

# Object-oriented Design Patterns

Here are some examples of design patterns that we describe in more detail:
* [**State**](/SEBook/designpatterns/state.html): Encapsulates state-based behavior into distinct classes, allowing a context object to dynamically alter its behavior at runtime by delegating operations to its current state object.

* [**Observer**](/SEBook/designpatterns/observer.html): Establishes a one-to-many dependency between objects, ensuring that a group of dependent objects is automatically notified and updated whenever the internal state of their shared subject changes.

# Architectural Patterns

Here are some examples of architectural patterns that we describe in more detail:

* [**Model-View-Controller (MVC)**](/SEBook/designpatterns/mvc.html): The Model-View-Controller (MVC) architectural pattern decomposes an interactive application into three distinct components: a model that encapsulates the core application data and business logic, a view that renders this information to the user, and a controller that translates user inputs into corresponding state updates

# Anatomy of a Pattern
A true pattern is more than simply a good idea or a random solution; it requires a structured format to capture the problem, the context, the solution, and the consequences. While various authors use slightly different templates, the fundamental anatomy of a design pattern contains the following essential elements:

* **Pattern Name**: A good name is vital as it becomes a handle we can use to describe a design problem, its solution, and its consequences in a word or two. Naming a pattern increases our design vocabulary, allowing us to design and communicate at a higher level of abstraction.
* **Context**: This defines the recurring situation or environment in which the pattern applies and where the problem exists.
* **Problem**: This describes the specific design issue or goal you are trying to achieve, along with the constraints symptomatic of an inflexible design.
* **Forces**: This outlines the trade-offs and competing concerns that must be balanced by the solution.
* **Solution**: This describes the elements that make up the design, their relationships, responsibilities, and collaborations. It specifies the spatial configuration and behavioral dynamics of the participating classes and objects.
* **Consequences**: This explicitly lists the results, costs, and benefits of applying the pattern, including its impact on system flexibility, extensibility, portability,  performance, and other quality attributes.

# Context Tailoring and Design Decisions 
Every design pattern represents a broad design space containing many variations, and these variations must be rigorously tailored to the concrete context of your application. Engineers must strike a careful balance: over-engineering occurs when too many patterns are applied unnecessarily, while under-engineering leaves a solution too inflexible for future changes, making those subsequent modifications highly expensive.
Because each pattern variation can significantly alter the resulting consequences, applying the perfect pattern variant may be locally optimal. However, in large projects, a massive amount of pattern variation can lead to severe confusion due to overloaded meanings. Maintaining pattern consistency within a project establishes recognizable conventions, thereby increasing overall code understandability.
Making the right choice requires a rational decision-making process. Early in a software engineering career, one should deliberately execute three steps: identify the design options, evaluate those options, and rank them. Evaluation should be based on strict criteria such as changeability, extensibility, understandability, and performance. Engineers must ask critical questions: Which design decisions might change? How likely are those changes? How easy would the change be without applying the pattern?. Only by prioritizing options based on context-dependent weights of these criteria can a rational, robust architectural decision be made.

# Pattern Compounds and Pattern Languages 
In advanced software architecture, patterns rarely exist in total isolation. They frequently combine into *Pattern Compounds*, which are recurring sets of patterns with overlapping roles from which entirely new, emergent properties arise. Because pattern compounds act as abstract solutions to abstract problems, they are recognized as patterns themselves. An example of this is utilizing the [*Observer*](/SEBook/designpatterns/observer.html) design pattern within the context of a Model-View-Controller framework to manage complex user interface states, such as in an image effects application where user parameter changes must trigger dynamic re-rendering.
Scaling further, we rely on Pattern Languages. Unlike an individual pattern that solves a solitary problem, a pattern language provides a conceptual framework detailing how to combine different patterns and make trade-offs between similar ones. It dictates the "grammar" of how pattern problems, solutions, and consequences interact to construct a coherent whole. Pattern collections can be organized by problem (e.g., how to create complex objects using *Builder* or *Abstract Factory*), by desired properties, by level of abstraction, or by specific domains.