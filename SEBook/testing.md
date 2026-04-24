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

# Deeper Reading

Running a test is easy; *designing* a good one is where most of the skill lives. The following pages go deeper:

* **[Test Design](/SEBook/testing/test-design.html)** — equivalence partitioning, boundary value analysis, and oracle strength. How to pick a small set of inputs that catches a large number of real bugs.
* **[Test Quality](/SEBook/testing/test-quality.html)** — behavior vs. implementation, the Arrange-Act-Assert pattern, coverage vs. adequacy, and the most common test smells.
* **[Test-Driven Development](/SEBook/testing/tdd.html)** — writing the test before the code as a design discipline, not just a verification step.
* **[Test Doubles](/SEBook/testing/testdoubles.html)** — stubs, spies, and mocks for controlling and observing dependencies.

For hands-on practice, the [Testing Foundations tutorial](/SEBook/tools/testing-foundations-tutorial) covers test design and quality interactively, and the [TDD tutorial](/SEBook/tools/tdd-tutorial) builds on it.

# Testability