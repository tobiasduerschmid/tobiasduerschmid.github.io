---
title: Builder Design Pattern
layout: sebook
---

# Context
In software engineering, we often need to construct complex objects step-by-step. Imagine building a vacation planner for a theme park. Park guests can choose a hotel, various types of admission tickets, make restaurant reservations, and book special events. The exact components of each vacation plan will vary wildly depending on the guest's needs (e.g., local resident vs. out-of-state visitor). 

# Problem
When an object requires multi-step construction or has many optional parameters, putting all the initialization logic into a single constructor or factory method becomes unwieldy. 
*   **Telescoping Constructors:** You might end up with a massive constructor with dozens of parameters, most of which are null or default values for any given instance.
*   **Coupled Construction:** The algorithm for creating the complex object becomes tightly coupled to the parts that make up the object and how they are assembled.
*   **Incomplete Objects:** If construction steps are exposed directly to the client, there's a risk of the client using a partially constructed, invalid object.

# Solution
The **Builder Pattern** separates the construction of a complex object from its representation so that the same construction process can create different representations. It encapsulates the way a complex object is built and allows it to be constructed incrementally.

The pattern involves four main participants:
1.  **Builder:** Specifies an abstract interface for creating the various parts of a `Product` object.
2.  **ConcreteBuilder:** Constructs and assembles the parts by implementing the `Builder` interface. It defines and tracks the internal representation it creates and provides a method for retrieving the finished product.
3.  **Director:** Constructs the object using the abstract `Builder` interface. It dictates the exact step-by-step construction sequence.
4.  **Product:** Represents the complex object under construction.

## UML Role Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface Builder {
    + BuildPartA()
    + BuildPartB()
}
class ConcreteBuilder {
    + BuildPartA()
    + BuildPartB()
    + GetResult(): Product
}
class Director {
    - builder: Builder
    + Construct()
}
class Product

Director o-> Builder : directs
ConcreteBuilder ..|> Builder
ConcreteBuilder --> Product : creates
@enduml'></div>

## UML Example Diagram

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
interface AbstractBuilder {
    + build_day(date: str)
    + add_hotel(date: str, hotel_name: str)
    + add_tickets(event_name: str)
    + get_vacation_planner(): VacationPlanner
}
class PatternslandBuilder {
    - planner: VacationPlanner
    + build_day(date: str)
    + add_hotel(date: str, hotel_name: str)
    + add_tickets(event_name: str)
    + get_vacation_planner(): VacationPlanner
}
class Director {
    - builder: AbstractBuilder
    + construct_planner()
}
class VacationPlanner {
    - itinerary: List
    + add_item(item)
    + show_plan()
}

Director o-> AbstractBuilder
PatternslandBuilder ..|> AbstractBuilder
PatternslandBuilder --> VacationPlanner : creates
@enduml'></div>

## Python Example

```python
# 4. Product: The complex object being built
class VacationPlanner:
    def __init__(self):
        self.itinerary = []
        
    def add_item(self, item):
        self.itinerary.append(item)
        
    def show_plan(self):
        print("Vacation Plan:")
        for item in self.itinerary:
            print(f" - {item}")

# 1. Builder: Abstract interface for creating parts
class AbstractBuilder:
    def build_day(self, date: str): pass
    def add_hotel(self, date: str, hotel_name: str): pass
    def add_tickets(self, event_name: str): pass
    def get_vacation_planner(self) -> VacationPlanner: pass

# 2. ConcreteBuilder: Implements the builder interface
class PatternslandBuilder(AbstractBuilder):
    def __init__(self):
        self._planner = VacationPlanner()
        
    def build_day(self, date: str):
        self._planner.add_item(f"Day started on {date}")
        
    def add_hotel(self, date: str, hotel_name: str):
        self._planner.add_item(f"Hotel '{hotel_name}' booked for {date}")
        
    def add_tickets(self, event_name: str):
        self._planner.add_item(f"Tickets purchased for '{event_name}'")
        
    def get_vacation_planner(self) -> VacationPlanner:
        return self._planner

# 3. Director: Constructs the object using the Builder interface
class Director:
    def __init__(self, builder: AbstractBuilder):
        self._builder = builder
        
    def construct_planner(self):
        # The Director dictates the exact step-by-step construction sequence
        self._builder.build_day("August 10")
        self._builder.add_hotel("August 10", "Grand Facadian")
        self._builder.add_tickets("Patterns on Ice")

# --- Client Code ---
if __name__ == "__main__":
    # The client configures the Director with a specific builder
    builder = PatternslandBuilder()
    director = Director(builder)

    # The director executes the steps
    director.construct_planner()

    # The client retrieves the complex product from the builder
    my_vacation = builder.get_vacation_planner()
    my_vacation.show_plan()
```

# Consequences
*   **Finer Control Over Construction:** Unlike other creational patterns that build products in one shot, Builder lets you construct products step-by-step.
*   **Varying Internal Representation:** You can change the internal representation of the product simply by providing a different `ConcreteBuilder`.
*   **Immutability:** It is easier to enforce immutability post-construction because the object is only returned to the client once it is fully built.
