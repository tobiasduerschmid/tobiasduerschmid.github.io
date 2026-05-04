---
title: Test Doubles
layout: sebook
---

A **test double** is any object that stands in for a real dependency during a test. Two pieces of vocabulary from Meszaros that we use throughout this chapter:

* **SUT** — *System Under Test*. The unit (function, class, or small group of collaborators) you actually want to verify.
* **DOC** — *Depended-On Component*. A component the SUT calls into; replacing it with a test double is what lets the SUT be tested in isolation.

Gerard Meszaros's canonical taxonomy in *xUnit Test Patterns* (2007) {% cite meszaros2007xunit %} identifies five kinds of test double — *Dummy*, *Fake*, *Stub*, *Spy*, and *Mock*. The three this chapter focuses on (Stub, Spy, Mock) are the ones with the most subtle distinctions; *Dummies* (objects passed but never used — e.g. a parameter required by a signature you don't care about) and *Fakes* (working implementations with shortcuts unsuitable for production — e.g. an in-memory database) are simpler and worth knowing exist. The three core kinds differ along two axes: *which direction of data flow they control* (indirect input vs. indirect output) and *when verification happens* (after the fact vs. during execution).

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
class TestDouble <<abstract>> {
  replaces a real dependency
}
class TestStub {
  controls indirect inputs
  (feeds values INTO the SUT)
}
class TestSpy {
  records indirect outputs;
  verify AFTER execution
}
class MockObject {
  expects indirect outputs;
  verify DURING execution
}
TestStub --|> TestDouble
TestSpy --|> TestDouble
MockObject --|> TestDouble
@enduml'></div>

Keep this map in mind as you read: each section below deepens one of the three branches.

# Test Stub

A Test Stub is an object that replaces a real component to allow a test to control the indirect inputs of the SUT. 
Indirect inputs are the values returned to the SUT by another component whose services the SUT uses, such as return values, updated parameters, or exceptions.
By replacing the real DOC with a Test Stub, the test establishes a control point that forces the SUT down specific execution paths it might not otherwise take, thus helping engineers test unreachable code or unique edge cases. 
During the test setup phase, the Test Stub is configured to respond to calls from the SUT with highly specific values.

While Test Stubs perfectly address the injection of inputs, they inherently ignore the indirect outputs of the SUT. To observe outputs, we must shift to a different class of Test Doubles.

# Test Spy

When the behavior of the SUT includes actions that cannot be observed through its public interface—such as sending a message on a network channel or writing a record to a database—we refer to these actions as indirect outputs. To verify these indirect outputs, we use a Test Spy.
A Test Spy is a more capable version of a Test Stub that serves as an observation point by quietly recording all method calls made to it by the SUT during execution. Like a Test Stub, a Test Spy may need to provide values back to the SUT to allow execution to continue, but its defining characteristic is its ability to capture the SUT's indirect outputs and save them for later verification by the test.
The use of a Test Spy facilitates a technique called "Procedural Behavior Verification". The testing lifecycle using a spy looks like this:

1. The test installs the Test Spy in place of the DOC.

2. The SUT is exercised.

3. The test retrieves the recorded information from the Test Spy (often via a Retrieval Interface).

4. The test uses standard assertion methods to compare the actual values passed to the spy against the expected values.

A software engineer should utilize a Test Spy when they want the assertions to remain clearly visible within the test method itself, or when they cannot predict the values of all attributes of the SUT's interactions ahead of time. Because a Test Spy does not fail the test at the first deviation from expected behavior, it allows tests to gather more execution data and include highly detailed diagnostic information in assertion failure messages.


# Mock Object
A Mock Object, like a Test Spy, acts as an observation point to verify the indirect outputs of the SUT. However, a Mock Object operates using a fundamentally different paradigm known as "Expected Behavior Specification".
Instead of waiting until after the SUT executes to verify the outputs procedurally, a Mock Object is configured before the SUT is exercised with the exact method calls and arguments it should expect to receive. The Mock Object essentially acts as an active verification engine during the execution phase. As the SUT executes and calls the Mock Object, the mock dynamically compares the actual arguments received against its programmed expectations. If an unexpected call occurs, or if the arguments do not match, the Mock Object fails the test immediately.