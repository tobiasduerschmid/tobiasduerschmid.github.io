---
title: Software Testing
layout: sebook
---
In our quest to construct high-quality software, testing stands as the most popular and essential quality assurance activity. While other techniques like static analysis, model checking, and code reviews are valuable, testing is often the primary pillar of industry-standard quality assurance.

# Test Classifications

## Regression Testing
As software evolves, we must ensure that new features don't inadvertently break existing functionality. This is the purpose of regression testing—the repetition of previously executed test cases. In a modern agile environment, these are often automated within a Continuous Integration (CI) pipeline, running every time code is changed

## Black-Box and White-Box
When we design tests, we usually adopt one of two mindsets. 
**Black-box testing** treats the system as a "black box" where the internal workings are invisible; tests are derived strictly from the requirements or specification to ensure they don't overfit the implementation. In contrast, **white-box testing** requires the tester to be aware of the inner workings of the code, deriving tests directly from the implementation to ensure high code coverage.

## The Testing Pyramid: Levels of Execution
A robust testing strategy requires a mix of tests at different levels of abstraction.

These levels include:

* **Unit Testing**: The execution of a complete class, routine, or small program in isolation.
* **Component Testing**: The execution of a class, package, or larger program element, often still in isolation.
* **Integration Testing**: The combined execution of multiple classes or packages to ensure they work correctly in collaboration.
* **System Testing**: The execution of the software in its final configuration, including all hardware and external software integrations.

# Interactive Tutorials

Two browser-based tutorials let you practice these ideas on live code:

* **[Testing Foundations](/SEBook/tools/testing-foundations-tutorial)** — assertions, equivalence partitions, boundary values, oracle strength, and testing behavior rather than implementation.
* **[TDD](/SEBook/tools/tdd-tutorial)** — Red-Green-Refactor with pytest, katas, and AI-assisted TDD. Builds on Testing Foundations.

# Test Quality and Test Design

Before choosing a tool or chasing a coverage number, ask whether the tests are good evidence. The new pages in this chapter separate two questions:

* **[Test Quality](/SEBook/testing/testquality.html)** explains how to evaluate a whole suite: oracle strength, fault-revealing power, coverage limits, mutation testing, flakiness, and maintainability.
* **[Writing Good Tests](/SEBook/testing/goodtests.html)** gives a practical recipe for individual tests: behavior-focused names, small fixtures, strong assertions, systematic input selection, deterministic execution, and TDD as a rhythm of small verified steps.

# Testability
