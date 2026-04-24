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

Director --> Builder : builder
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

Director --> AbstractBuilder : builder
PatternslandBuilder ..|> AbstractBuilder
PatternslandBuilder --> VacationPlanner : creates
@enduml'></div>

## Code Example

This example builds a vacation plan through a fixed construction sequence. The director controls the steps; the concrete builder controls the representation of the finished plan.

<div class="inline-language-switcher" data-language-switcher data-default-language="java">
  <div class="inline-language-tabs" role="tablist" aria-label="Builder code language">
    <button type="button" role="tab" data-language-option="java" aria-selected="true">Java</button>
    <button type="button" role="tab" data-language-option="cpp" aria-selected="false">C++</button>
    <button type="button" role="tab" data-language-option="python" aria-selected="false">Python</button>
    <button type="button" role="tab" data-language-option="js" aria-selected="false">JavaScript</button>
  </div>

  <div class="inline-language-panel is-active" data-language-panel="java" role="tabpanel" markdown="1">
```java
import java.util.ArrayList;
import java.util.List;

final class VacationPlanner {
    private final List<String> itinerary = new ArrayList<>();

    void addItem(String item) {
        itinerary.add(item);
    }

    void showPlan() {
        itinerary.forEach(System.out::println);
    }
}

interface VacationBuilder {
    void buildDay(String date);
    void addHotel(String date, String hotelName);
    void addTickets(String eventName);
    VacationPlanner getVacationPlanner();
}

final class PatternslandBuilder implements VacationBuilder {
    private final VacationPlanner planner = new VacationPlanner();

    public void buildDay(String date) {
        planner.addItem("Day started on " + date);
    }

    public void addHotel(String date, String hotelName) {
        planner.addItem("Hotel '" + hotelName + "' booked for " + date);
    }

    public void addTickets(String eventName) {
        planner.addItem("Tickets purchased for '" + eventName + "'");
    }

    public VacationPlanner getVacationPlanner() {
        return planner;
    }
}

final class Director {
    private final VacationBuilder builder;

    Director(VacationBuilder builder) {
        this.builder = builder;
    }

    void constructPlanner() {
        builder.buildDay("August 10");
        builder.addHotel("August 10", "Grand Facadian");
        builder.addTickets("Patterns on Ice");
    }
}

public class Demo {
    public static void main(String[] args) {
        PatternslandBuilder builder = new PatternslandBuilder();
        new Director(builder).constructPlanner();
        builder.getVacationPlanner().showPlan();
    }
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="cpp" role="tabpanel" markdown="1">
```cpp
#include <iostream>
#include <string>
#include <vector>

class VacationPlanner {
public:
    void addItem(const std::string& item) {
        itinerary_.push_back(item);
    }

    void showPlan() const {
        for (const auto& item : itinerary_) {
            std::cout << item << "\n";
        }
    }

private:
    std::vector<std::string> itinerary_;
};

class VacationBuilder {
public:
    virtual ~VacationBuilder() = default;
    virtual void buildDay(const std::string& date) = 0;
    virtual void addHotel(const std::string& date, const std::string& hotelName) = 0;
    virtual void addTickets(const std::string& eventName) = 0;
    virtual VacationPlanner& getVacationPlanner() = 0;
};

class PatternslandBuilder : public VacationBuilder {
public:
    void buildDay(const std::string& date) override {
        planner_.addItem("Day started on " + date);
    }

    void addHotel(const std::string& date, const std::string& hotelName) override {
        planner_.addItem("Hotel '" + hotelName + "' booked for " + date);
    }

    void addTickets(const std::string& eventName) override {
        planner_.addItem("Tickets purchased for '" + eventName + "'");
    }

    VacationPlanner& getVacationPlanner() override {
        return planner_;
    }

private:
    VacationPlanner planner_;
};

class Director {
public:
    explicit Director(VacationBuilder& builder) : builder_(builder) {}

    void constructPlanner() {
        builder_.buildDay("August 10");
        builder_.addHotel("August 10", "Grand Facadian");
        builder_.addTickets("Patterns on Ice");
    }

private:
    VacationBuilder& builder_;
};

int main() {
    PatternslandBuilder builder;
    Director director(builder);
    director.constructPlanner();
    builder.getVacationPlanner().showPlan();
}
```
  </div>

  <div class="inline-language-panel" data-language-panel="python" role="tabpanel" markdown="1">
```python
from abc import ABC, abstractmethod


class VacationPlanner:
    def __init__(self) -> None:
        self.itinerary: list[str] = []

    def add_item(self, item: str) -> None:
        self.itinerary.append(item)

    def show_plan(self) -> None:
        for item in self.itinerary:
            print(item)


class VacationBuilder(ABC):
    @abstractmethod
    def build_day(self, date: str) -> None:
        pass

    @abstractmethod
    def add_hotel(self, date: str, hotel_name: str) -> None:
        pass

    @abstractmethod
    def add_tickets(self, event_name: str) -> None:
        pass

    @abstractmethod
    def get_vacation_planner(self) -> VacationPlanner:
        pass


class PatternslandBuilder(VacationBuilder):
    def __init__(self) -> None:
        self._planner = VacationPlanner()

    def build_day(self, date: str) -> None:
        self._planner.add_item(f"Day started on {date}")

    def add_hotel(self, date: str, hotel_name: str) -> None:
        self._planner.add_item(f"Hotel '{hotel_name}' booked for {date}")

    def add_tickets(self, event_name: str) -> None:
        self._planner.add_item(f"Tickets purchased for '{event_name}'")

    def get_vacation_planner(self) -> VacationPlanner:
        return self._planner


class Director:
    def __init__(self, builder: VacationBuilder) -> None:
        self._builder = builder

    def construct_planner(self) -> None:
        self._builder.build_day("August 10")
        self._builder.add_hotel("August 10", "Grand Facadian")
        self._builder.add_tickets("Patterns on Ice")


builder = PatternslandBuilder()
Director(builder).construct_planner()
builder.get_vacation_planner().show_plan()
```
  </div>

  <div class="inline-language-panel" data-language-panel="js" role="tabpanel" markdown="1">
```javascript
class VacationPlanner {
  constructor() {
    this.itinerary = [];
  }

  addItem(item) {
    this.itinerary.push(item);
  }

  showPlan() {
    this.itinerary.forEach((item) => console.log(item));
  }
}

class PatternslandBuilder {
  constructor() {
    this.planner = new VacationPlanner();
  }

  buildDay(date) {
    this.planner.addItem(`Day started on ${date}`);
  }

  addHotel(date, hotelName) {
    this.planner.addItem(`Hotel '${hotelName}' booked for ${date}`);
  }

  addTickets(eventName) {
    this.planner.addItem(`Tickets purchased for '${eventName}'`);
  }

  getVacationPlanner() {
    return this.planner;
  }
}

class Director {
  constructor(builder) {
    this.builder = builder;
  }

  constructPlanner() {
    this.builder.buildDay("August 10");
    this.builder.addHotel("August 10", "Grand Facadian");
    this.builder.addTickets("Patterns on Ice");
  }
}

const builder = new PatternslandBuilder();
new Director(builder).constructPlanner();
builder.getVacationPlanner().showPlan();
```
  </div>
</div>

# Consequences
*   **Finer Control Over Construction:** Unlike other creational patterns that build products in one shot, Builder lets you construct products step-by-step.
*   **Varying Internal Representation:** You can change the internal representation of the product simply by providing a different `ConcreteBuilder`.
*   **Immutability:** It is easier to enforce immutability post-construction because the object is only returned to the client once it is fully built.
