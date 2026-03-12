---
title: Requirements
layout: sebook
---

Requirements define the **problem space**. They capture *what* the system must do and what the user actually needs to achieve. We care about them for several key reasons:

* **Defining "Correctness":** A requirement establishes the exact criteria for whether an implementation is successful. Without clear requirements, developers have no objective way to know when a feature is "done" or if it actually works as intended.
* **Building the Right System:** You can write perfectly clean, highly optimized, bug-free code—but if it doesn't solve the user's actual problem, the software is useless. Requirements ensure the engineering team's efforts are aligned with user value.
* **Traceability and Testing:** Good requirements allow developers to write clear acceptance criteria. Every test written and every line of code coded can be traced back to a specific requirement, ensuring no effort is wasted on unrequested features.


# Requirements vs. Design
In software engineering, distinguishing between requirements and design is critical to building successful systems. 
Requirements express *what* the system should do and capture the user's needs. 
The goal of requirements, in general, is to capture the exact set of criteria that determine if an implementation is "correct".

A design, on the other hand, describes *how* the system implements these user needs. 
Design is about exploring the space of possible solutions to fulfill the requirements. 
A well-crafted **requirements specification should never artificially limit this space by prematurely making design decisions**. 
For example, a requirement for pathfinding might be: "The program should find the shortest path between A and B".
If you were to specify that "The program should implement Dijkstra's shortest path algorithm", you would over-constrain the system and dictate a design choice before development even begins.

## Examples

Here are some examples illustrating the difference between a **requirement** (what the system must do to satisfy the user's needs) and a **design decision** (how the engineers choose to implement a solution to fulfill that requirement):

* **Route Planning**
    * **Requirement:** The system must calculate and display the shortest route between a user's current location and their destination.
    * **Design Decision:** Implement Dijkstra's algorithm (or A* search) to calculate the path, representing the map as a weighted graph.

* **User Authentication**
    * **Requirement:** The system must ensure that only registered and verified users can access the financial dashboard.
    * **Design Decision:** Use OAuth 2.0 for third-party login and issue JSON Web Tokens (JWT) to manage user sessions.

* **Data Persistence**
    * **Requirement:** The application must save a user's shopping cart items so they are not lost if the user accidentally closes their browser.
    * **Design Decision:** Store the active shopping cart data temporarily in a Redis in-memory data store for fast retrieval, rather than saving it to the main relational database.

* **Sorting Information**
    * **Requirement:** The system must display the list of available university courses ordered alphabetically by their course name.
    * **Design Decision:** Use the built-in TimSort algorithm in Python to sort the array of course objects before sending the data to the frontend.

* **Cross-Platform Accessibility**
    * **Requirement:** The web interface must be fully readable and navigable on both large desktop monitors and small mobile phone screens.
    * **Design Decision:** Build the user interface using React.js and apply Tailwind CSS to create a responsive, mobile-first grid layout.

* **Search Functionality**
    * **Requirement:** Users must be able to search for specific books in the catalog using keywords, titles, or author names, even if they make minor typos.
    * **Design Decision:** Integrate Elasticsearch to index the book catalog and utilize its fuzzy matching capabilities to handle user typos.

* **System Communication**
    * **Requirement:** When a customer places an order, the inventory system must be notified to reduce the stock count of the purchased items.
    * **Design Decision:** Implement an event-driven architecture using an Apache Kafka message broker to publish an "OrderPlaced" event that the inventory service listens for.

* **Password Security**
    * **Requirement:** The system must securely store user passwords so that even if the database is compromised, the original passwords cannot be easily read.
    * **Design Decision:** Hash all passwords using the bcrypt algorithm with a work factor (salt) of 12 before saving them to the database.

* **Real-Time Collaboration**
    * **Requirement:** Multiple users must be able to view and edit the same code file simultaneously, seeing each other's changes in real-time without refreshing the page.
    * **Design Decision:** Establish a persistent two-way connection between the clients and the server using WebSockets, and use Operational Transformation (OT) to resolve edit conflicts.

* **Offline Capabilities**
    * **Requirement:** The mobile app must allow users to read previously opened news articles even when they lose internet connection (e.g., when entering a subway).
    * **Design Decision:** Cache the text and images of recently opened articles locally on the device using an SQLite database embedded in the mobile application.


## Why Does the Difference Matter?

Blurring the lines between requirements and design is a common mistake that leads to misunderstandings. The distinction matters for three main reasons:

**Avoiding Premature Constraints:**
When you put design decisions into your requirements, you artificially limit the space of possible solutions before development even begins. If a product manager writes a requirement that says, "The system must use an SQL database to store user profiles", they have made a design decision. A NoSQL database or an in-memory cache might have been vastly superior for this specific use case, but the engineers are now blocked from exploring those better options.

**Preserving Flexibility and Agility:**
Design decisions change frequently. A team might start by using one sorting algorithm or database architecture, realize it doesn't scale well, and swap it out for another. If the *requirement* was strictly about the "what" (e.g., "Data must be sorted alphabetically"), the requirement stays the same even when the design changes. If the design was baked into the requirement, you now have to rewrite your requirements and change your acceptance criteria just to fix a technical issue.

**Utilizing the Right Expertise:**
Requirements should usually be negotiated with the customer or product manager / product owner — the people who understand the business needs. Design decisions should be made by the software engineers and architects — the people who understand the technology. 
Mixing the two often results in non-technical stakeholders dictating technical implementations, which rarely ends well.

In short: Requirements keep you focused on delivering **value** to the user. Leaving design out of your requirements empowers your engineers to deliver that value in the most **efficient and technically sound** way possible.


# Requirements Specifications

## User Stories

## Quality Attribute Scenarios

## Formal Requirements Specifications


# Requirements Elicitation