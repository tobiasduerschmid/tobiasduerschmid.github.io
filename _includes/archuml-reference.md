# ArchUML Syntax Reference

A complete reference for the `@startuml` syntax supported by the ArchUML renderer (`uml-bundle.js`).

Each section shows the syntax as a code block followed by an HTML rendering div you can embed directly in any page that loads `uml-bundle.js`.


## Setup & Embedding

Include `uml-bundle.js` in your page. Any `<pre><code class="language-uml-*">` block is auto-rendered on load.

```html
<script src="path/to/uml-bundle.js"></script>

<pre><code class="language-uml-class">
@startuml
class Foo
@enduml
</code></pre>
```

Available class names:

| Class | Diagram type |
|---|---|
| `language-uml-class` | Class diagram |
| `language-uml-sequence` | Sequence diagram |
| `language-uml-state` | State machine |
| `language-uml-component` | Component diagram |
| `language-uml-deployment` | Deployment diagram |
| `language-uml-usecase` | Use case diagram |
| `language-uml-activity` | Activity diagram |

The `@startuml` / `@enduml` markers are optional but recommended for clarity.

---

## Global Directives

These directives work in any diagram type.

### Layout Direction

```
layout horizontal      ← left-to-right (alias: layout LR, layout left-to-right)
layout vertical        ← top-to-bottom (alias: layout TB, layout top-to-bottom)
layout landscape       ← alias for horizontal
layout portrait        ← alias for vertical
layout compact         ← minimise whitespace
layout square          ← prefer square aspect ratio
layout auto            ← auto-select (default)
layout none            ← disable layout engine
layout shadows on      ← enable drop shadows
layout shadows off     ← disable drop shadows
```

**Example — explicit landscape layout:**

```
@startuml
layout landscape
class A
class B
class C
A --> B
B --> C
@enduml
```

<pre><code class="language-uml-class">
@startuml
layout landscape
class A
class B
class C
A --> B
B --> C
@enduml
</code></pre>

---

## Class Diagrams

### Element Declarations

```
class ClassName
abstract class AbstractName
interface InterfaceName
enum EnumName
class Name <<StereotypeName>>
```

**Example:**

```
@startuml
class Vehicle
abstract class Transport
interface Driveable
enum FuelType {
  PETROL
  DIESEL
  ELECTRIC
}
class Car <<singleton>>
@enduml
```

<pre><code class="language-uml-class">
@startuml
class Vehicle
abstract class Transport
interface Driveable
enum FuelType {
  PETROL
  DIESEL
  ELECTRIC
}
class Car <<singleton>>
@enduml
</code></pre>

---

### Members — Visibility & Modifiers

Members are declared inside `{ }` blocks. Visibility prefixes:

```
+  public
-  private
#  protected
~  package
```

Modifiers enclosed in `{ }`:

```
{abstract}   italic rendering
{static}     underlined rendering
```

**Example:**

```
@startuml
abstract class Shape {
  - color: int
  + {abstract} area(): double
  + {static} defaultColor(): int
  # setColor(r: int, g: int, b: int)
}
@enduml
```

<pre><code class="language-uml-class">
@startuml
abstract class Shape {
  - color: int
  + {abstract} area(): double
  + {static} defaultColor(): int
  # setColor(r: int, g: int, b: int)
}
@enduml
</code></pre>

---

### Relationships

All relationship arrows and their meanings:

```
A --|> B         Generalization    (solid line, hollow triangle — A extends B)
A ..|> B         Realization       (dashed line, hollow triangle — A implements B)
A *-- B          Composition       (filled diamond on A side)
A o-- B          Aggregation       (hollow diamond on A side)
A --> B          Navigable assoc.  (open arrowhead toward B)
A <--> B         Bidirectional     (open arrowheads both ends)
A -- B           Association       (plain line, no arrowhead)
A --x B          Non-navigable     (X marker at B)
A x--x B         Non-nav both ends (X markers both ends)
A ..> B          Dependency        (dashed, open arrowhead)
```

Navigability variants for composition/aggregation:

```
A *--> B         Composition + navigable
A *<--> B        Composition + bidirectional
A *--x B         Composition + non-navigable target
A o--> B         Aggregation + navigable
A o<--> B        Aggregation + bidirectional
A o--x B         Aggregation + non-navigable target
```

**Example:**

```
@startuml
layout portrait
class Client
interface Service
abstract class BaseService
class ConcreteService
class Logger
class Request

Client --> Service : uses
ConcreteService ..|> Service
ConcreteService --|> BaseService
BaseService *-- Logger : owns
Client o-- Request : holds
ConcreteService ..> Request : depends on
@enduml
```

<pre><code class="language-uml-class">
@startuml
layout portrait
class Client
interface Service
abstract class BaseService
class ConcreteService
class Logger
class Request

Client --> Service : uses
ConcreteService ..|> Service
ConcreteService --|> BaseService
BaseService *-- Logger : owns
Client o-- Request : holds
ConcreteService ..> Request : depends on
@enduml
</code></pre>

---

### Multiplicities & Labels

```
A "multiplicity" -- "multiplicity" B : label
A "1" -- "0..*" B : label
A "1" *-- "1..*" B
```

**Example:**

```
@startuml
class University {
  + name: String
}
class Department {
  + name: String
}
class Professor {
  + name: String
}
class Student {
  + id: int
}
University "1" *-- "1..*" Department : contains
Department "1" -- "0..*" Professor : employs
Professor "1" -- "0..*" Student : advises
@enduml
```

<pre><code class="language-uml-class">
@startuml
class University {
  + name: String
}
class Department {
  + name: String
}
class Professor {
  + name: String
}
class Student {
  + id: int
}
University "1" *-- "1..*" Department : contains
Department "1" -- "0..*" Professor : employs
Professor "1" -- "0..*" Student : advises
@enduml
</code></pre>

---

### Enumerations

```
enum EnumName {
  VALUE_ONE
  VALUE_TWO
  VALUE_THREE
}
```

Semicolon-separated single-line form is also accepted:

```
enum Size { SMALL; MEDIUM; LARGE }
```

**Example:**

```
@startuml
enum Color {
  RED
  GREEN
  BLUE
}
enum Size { SMALL; MEDIUM; LARGE }
class Product {
  - name: String
  - color: Color
  - size: Size
}
Product --> Color
Product --> Size
@enduml
```

<pre><code class="language-uml-class">
@startuml
enum Color {
  RED
  GREEN
  BLUE
}
enum Size { SMALL; MEDIUM; LARGE }
class Product {
  - name: String
  - color: Color
  - size: Size
}
Product --> Color
Product --> Size
@enduml
</code></pre>

---

### Stereotypes

```
class Name <<StereotypeName>>
```

**Example:**

```
@startuml
class Singleton <<singleton>> {
  - {static} instance: Singleton
  - Singleton()
  + {static} getInstance(): Singleton
  + operation(): void
}
@enduml
```

<pre><code class="language-uml-class">
@startuml
class Singleton <<singleton>> {
  - {static} instance: Singleton
  - Singleton()
  + {static} getInstance(): Singleton
  + operation(): void
}
@enduml
</code></pre>

---

### Complete Class Diagram Example — Observer Pattern

```
@startuml
layout horizontal
interface Subject {
  + attach(observer: Observer): void
  + detach(observer: Observer): void
  + notifyObservers(): void
}
interface Observer {
  + update(): void
}
class ConcreteSubject {
  - subjectState: String
  + getState(): String
  + setState(value: String): void
}
class ConcreteObserver {
  - subject: ConcreteSubject
  - observerState: String
  + update(): void
}
ConcreteSubject ..|> Subject
ConcreteObserver ..|> Observer
Subject "1" -- "0..*" Observer : observers
ConcreteObserver --> ConcreteSubject : subject
note right of Subject.notifyObservers
  for each o in observers {
    o.update()
  }
end note
note bottom of ConcreteObserver.update
  observerState =
  subject.getState()
end note
@enduml
```

<pre><code class="language-uml-class">
@startuml
layout horizontal
interface Subject {
  + attach(observer: Observer): void
  + detach(observer: Observer): void
  + notifyObservers(): void
}
interface Observer {
  + update(): void
}
class ConcreteSubject {
  - subjectState: String
  + getState(): String
  + setState(value: String): void
}
class ConcreteObserver {
  - subject: ConcreteSubject
  - observerState: String
  + update(): void
}
ConcreteSubject ..|> Subject
ConcreteObserver ..|> Observer
Subject "1" -- "0..*" Observer : observers
ConcreteObserver --> ConcreteSubject : subject
note right of Subject.notifyObservers
  for each o in observers {
    o.update()
  }
end note
note bottom of ConcreteObserver.update
  observerState =
  subject.getState()
end note
@enduml
</code></pre>

---

## Sequence Diagrams

### Participants

```
participant id: Label        ← box with label
participant id as Label      ← alternate form
actor id: Label              ← stick figure (human actor)
```

Participants used in messages but never declared are created automatically.

**Example:**

```
@startuml
actor user: User
participant browser: WebBrowser
participant server: AppServer
participant db: Database

user -> browser: enter credentials
browser -> server: POST /login
server -> db: findUser(name)
db --> server: userRecord
server --> browser: 200 OK + token
browser --> user: show dashboard
@enduml
```

<pre><code class="language-uml-sequence">
@startuml
actor user: User
participant browser: WebBrowser
participant server: AppServer
participant db: Database

user -> browser: enter credentials
browser -> server: POST /login
server -> db: findUser(name)
db --> server: userRecord
server --> browser: 200 OK + token
browser --> user: show dashboard
@enduml
</code></pre>

---

### Message Arrow Types

```
A -> B    Synchronous call    (solid line, filled arrowhead)
A --> B   Response / return   (dashed line, open arrowhead)
A ->> B   Asynchronous        (solid line, open arrowhead)
A ->o B   Lost message        (arrow ends at filled circle)
o-> A     Found message       (starts from filled circle)
A -> A    Self-call           (loop-back arrow)
```

**Example:**

```
@startuml
participant client: Client
participant server: Server
participant pool: ThreadPool

client -> server: request()
server -> server: validate()
server ->> pool: submitTask()
pool --> server: taskQueued
server -->o : timeout
o-> client: networkEvent
server --> client: response
@enduml
```

<pre><code class="language-uml-sequence">
@startuml
participant client: Client
participant server: Server
participant pool: ThreadPool

client -> server: request()
server -> server: validate()
server ->> pool: submitTask()
pool --> server: taskQueued
server -->o : timeout
o-> client: networkEvent
server --> client: response
@enduml
</code></pre>

---

### Activation & Lifeline Control

```
activate ParticipantId      ← start activation bar
deactivate ParticipantId    ← end activation bar
create ParticipantId        ← show creation message
destroy ParticipantId       ← terminate lifeline with X
```

When `activate` / `deactivate` are omitted, activation bars are inferred automatically from message nesting.

**Example:**

```
@startuml
participant client: Client
participant server: Server
participant db: Database

client -> server: connect()
activate server
server -> db: open()
activate db
db --> server: connection
deactivate db
server --> client: sessionId
deactivate server
client -> server: disconnect()
destroy server
@enduml
```

<pre><code class="language-uml-sequence">
@startuml
participant client: Client
participant server: Server
participant db: Database

client -> server: connect()
activate server
server -> db: open()
activate db
db --> server: connection
deactivate db
server --> client: sessionId
deactivate server
client -> server: disconnect()
destroy server
@enduml
</code></pre>

---

### Combined Fragments

All combined fragment keywords:

```
alt [condition]        ← alternatives (like if/else if/else)
  ...
else [condition]
  ...
end

loop [condition]       ← iteration
  ...
end

opt [condition]        ← optional (zero or one execution)
  ...
end

par [label]            ← parallel (multiple else branches run in parallel)
  ...
else [label]
  ...
end

break [condition]      ← break out of surrounding loop
  ...
end

critical [label]       ← atomic region
  ...
end

ref [label]            ← interaction reference
  ...
end

neg [label]            ← forbidden / invalid trace
  ...
end
```

**Example — alt/loop/opt:**

```
@startuml
participant c: Client
participant s: Server
participant cache: Cache
participant db: Database

c -> s: fetchAll()
loop [for each record]
  s -> cache: lookup(id)
  alt [cache hit]
    cache --> s: cachedData
  else [cache miss]
    s -> db: query(id)
    db --> s: record
  end
end
opt [user has notifications enabled]
  s -> s: sendNotification()
end
s --> c: results
@enduml
```

<pre><code class="language-uml-sequence">
@startuml
participant c: Client
participant s: Server
participant cache: Cache
participant db: Database

c -> s: fetchAll()
loop [for each record]
  s -> cache: lookup(id)
  alt [cache hit]
    cache --> s: cachedData
  else [cache miss]
    s -> db: query(id)
    db --> s: record
  end
end
opt [user has notifications enabled]
  s -> s: sendNotification()
end
s --> c: results
@enduml
</code></pre>

**Example — par, break, critical:**

```
@startuml
participant ui: UI
participant svc: OrderService
participant inv: Inventory
participant pay: Payment

ui -> svc: placeOrder()
par [parallel processing]
  svc -> inv: reserveItems()
  inv --> svc: reserved
else [charge card]
  svc -> pay: chargeCard()
  pay --> svc: charged
end
critical [atomic commit]
  svc -> svc: commitOrder()
end
svc --> ui: orderComplete
@enduml
```

<pre><code class="language-uml-sequence">
@startuml
participant ui: UI
participant svc: OrderService
participant inv: Inventory
participant pay: Payment

ui -> svc: placeOrder()
par [parallel processing]
  svc -> inv: reserveItems()
  inv --> svc: reserved
else [charge card]
  svc -> pay: chargeCard()
  pay --> svc: charged
end
critical [atomic commit]
  svc -> svc: commitOrder()
end
svc --> ui: orderComplete
@enduml
</code></pre>

---

### Create & Destroy Lifecycle

```
create ParticipantId        ← participant appears at this point
server --> NewObj: <<create>>
destroy ParticipantId       ← X drawn on lifeline
```

**Example:**

```
@startuml
participant client: Client
participant server: Server

client -> server: request()
create Handler
server --> Handler: <<create>>
Handler --> server: result
server --> client: response
destroy Handler
@enduml
```

<pre><code class="language-uml-sequence">
@startuml
participant client: Client
participant server: Server

client -> server: request()
create Handler
server --> Handler: <<create>>
Handler --> server: result
server --> client: response
destroy Handler
@enduml
</code></pre>

---

## State Machine Diagrams

### State Declarations & Transitions

```
[*]                         ← initial pseudostate (as source) or final state (as target)
state StateName             ← simple state
state StateName { ... }     ← composite state with sub-states
state Name <<choice>>       ← choice pseudostate (diamond)

StateA --> StateB : event [guard] / action
StateA --> StateB : event
[*] --> InitialState : trigger
FinalState --> [*]
```

**Example:**

```
@startuml
[*] --> Created : Order Placed

Created --> Paid : payment_received
Paid --> Shipped : ship_order
Shipped --> Delivered : delivery_confirmed
Delivered --> [*]

Created --> Cancelled : cancel_order [within 24hrs]
Paid --> Refunded : refund_requested / processRefund()
Cancelled --> [*]
Refunded --> [*]
@enduml
```

<pre><code class="language-uml-state">
@startuml
[*] --> Created : Order Placed

Created --> Paid : payment_received
Paid --> Shipped : ship_order
Shipped --> Delivered : delivery_confirmed
Delivered --> [*]

Created --> Cancelled : cancel_order [within 24hrs]
Paid --> Refunded : refund_requested / processRefund()
Cancelled --> [*]
Refunded --> [*]
@enduml
</code></pre>

---

### State Internal Actions

Inside a `state { }` block:

```
entry / action_text       ← executes on state entry
exit / action_text        ← executes on state exit
do / activity_text        ← ongoing activity while in state
```

**Example:**

```
@startuml
[*] --> Idle

Idle --> AcceptingMoney : selectProduct
AcceptingMoney --> Dispensing : [sufficientFunds] / startDispense()
AcceptingMoney --> Idle : cancel / returnMoney()
Dispensing --> Idle : complete / resetMachine()

state AcceptingMoney {
  entry / displayPrice()
  do / countInsertedCoins()
}

state Dispensing {
  entry / activateMotor()
  exit / stopMotor()
}
@enduml
```

<pre><code class="language-uml-state">
@startuml
[*] --> Idle

Idle --> AcceptingMoney : selectProduct
AcceptingMoney --> Dispensing : [sufficientFunds] / startDispense()
AcceptingMoney --> Idle : cancel / returnMoney()
Dispensing --> Idle : complete / resetMachine()

state AcceptingMoney {
  entry / displayPrice()
  do / countInsertedCoins()
}

state Dispensing {
  entry / activateMotor()
  exit / stopMotor()
}
@enduml
</code></pre>

---

### Composite States

```
state ParentState {
  [*] --> SubState1
  SubState1 --> SubState2 : event
  SubState2 --> [*]
}
```

**Example:**

```
@startuml
[*] --> Active

state Active {
  [*] --> Running
  Running --> Paused : pause()
  Paused --> Running : resume()
}

Active --> Idle : deactivate()
Idle --> Active : activate()
Idle --> [*] : shutdown()
@enduml
```

<pre><code class="language-uml-state">
@startuml
[*] --> Active

state Active {
  [*] --> Running
  Running --> Paused : pause()
  Paused --> Running : resume()
}

Active --> Idle : deactivate()
Idle --> Active : activate()
Idle --> [*] : shutdown()
@enduml
</code></pre>

---

### Choice Pseudostate

```
state Name <<choice>>
StateA --> Name : validate()
Name --> StateB : [valid]
Name --> StateC : [invalid]
```

**Example:**

```
@startuml
[*] --> Validating : submit

state Check <<choice>>
Validating --> Check : validate()
Check --> Approved : [valid]
Check --> Rejected : [invalid]
Approved --> [*]
Rejected --> [*]
@enduml
```

<pre><code class="language-uml-state">
@startuml
[*] --> Validating : submit

state Check <<choice>>
Validating --> Check : validate()
Check --> Approved : [valid]
Check --> Rejected : [invalid]
Approved --> [*]
Rejected --> [*]
@enduml
</code></pre>

---

## Component Diagrams

Default layout is left-to-right. Supports `layout horizontal` / `layout vertical`.

### Basic Components & Connectors

```
component ComponentName
component ComponentName { ... }

A --> B : label          ← assembly/usage connector (solid arrow)
A ..> B : label          ← dependency (dashed arrow)
A -- B : label           ← plain link
```

**Example:**

```
@startuml
component WebUI
component AppServer
component Database

WebUI --> AppServer : HTTP Requests
AppServer --> Database : SQL Queries
AppServer ..> Logger : uses
@enduml
```

<pre><code class="language-uml-component">
@startuml
component WebUI
component AppServer
component Database

WebUI --> AppServer : HTTP Requests
AppServer --> Database : SQL Queries
AppServer ..> Logger : uses
@enduml
</code></pre>

---

### Ports

Ports are declared inside component `{ }` blocks:

```
portin "PortName" as alias       ← input port (square on left)
portout "PortName" as alias      ← output port (square on right)
```

Connect via port aliases:

```
sourcePort --> targetPort : label
sourcePort -down-> targetPort    ← directional hint (up/down/left/right)
```

**Example:**

```
@startuml
component Frontend {
  portout "httpOut" as f_out
}
component Backend {
  portin "httpIn" as b_in
  portout "dbOut" as b_db
  portout "eventOut" as b_ev
}
component Database {
  portin "dbIn" as db_in
}
component EventBus {
  portin "eventIn" as eb_in
}
f_out --> b_in : REST/JSON
b_db --> db_in : SQL
b_ev --> eb_in : publish
@enduml
```

<pre><code class="language-uml-component">
@startuml
component Frontend {
  portout "httpOut" as f_out
}
component Backend {
  portin "httpIn" as b_in
  portout "dbOut" as b_db
  portout "eventOut" as b_ev
}
component Database {
  portin "dbIn" as db_in
}
component EventBus {
  portin "eventIn" as eb_in
}
f_out --> b_in : REST/JSON
b_db --> db_in : SQL
b_ev --> eb_in : publish
@enduml
</code></pre>

---

### Provided & Required Interfaces (Ball-and-Socket)

```
provide "InterfaceName" as alias    ← lollipop (ball) on component
require "InterfaceName" as alias    ← socket on component

provideAlias --> requireAlias       ← joined assembly (ball fits socket)
provideAlias ..> requireAlias       ← disjoined (standalone symbols)
```

**Example:**

```
@startuml
component Order {
  provide "OrderItems" as o_items
  provide "CustomerInfo" as o_cust
}
component Warehouse {
  require "OrderItems" as w_items
}
component CRM {
  require "CustomerInfo" as crm_cust
}
o_items --> w_items
o_cust --> crm_cust
@enduml
```

<pre><code class="language-uml-component">
@startuml
component Order {
  provide "OrderItems" as o_items
  provide "CustomerInfo" as o_cust
}
component Warehouse {
  require "OrderItems" as w_items
}
component CRM {
  require "CustomerInfo" as crm_cust
}
o_items --> w_items
o_cust --> crm_cust
@enduml
</code></pre>

---

## Deployment Diagrams

### Nodes, Artifacts & Relationships

```
node "NodeName" as alias { ... }     ← execution environment / hardware box
component ComponentName              ← deployed component inside node
artifact "ArtifactName" as alias     ← deployable artifact

A --> B : label          ← dependency / communication path
A ..> B : label          ← dashed dependency
A -- B                   ← plain association
```

Node instance notation (name:Type — underlined per UML spec):

```
node instanceName:TypeName { ... }
```

**Example:**

```
@startuml
node WebServer {
  component Nginx
  component AppServer
}
node DatabaseServer {
  component PostgreSQL
}
node ClientDevice {
  component WebBrowser
}

ClientDevice --> WebServer : HTTPS
WebServer --> DatabaseServer : TCP/IP
@enduml
```

<pre><code class="language-uml-deployment">
@startuml
node WebServer {
  component Nginx
  component AppServer
}
node DatabaseServer {
  component PostgreSQL
}
node ClientDevice {
  component WebBrowser
}

ClientDevice --> WebServer : HTTPS
WebServer --> DatabaseServer : TCP/IP
@enduml
</code></pre>

---

### Deployment with Horizontal Layout

```
@startuml
layout horizontal
node LoadBalancer { component Nginx }
node AppNode1 {
  component UserService
  component OrderService
}
node AppNode2 {
  component PaymentService
  component NotificationService
}
node DataNode {
  component MongoDB
  component Redis
}

LoadBalancer --> AppNode1 : HTTP
LoadBalancer --> AppNode2 : HTTP
AppNode1 --> DataNode : TCP
AppNode2 --> DataNode : TCP
AppNode1 ..> AppNode2 : gRPC
@enduml
```

<pre><code class="language-uml-deployment">
@startuml
layout horizontal
node LoadBalancer { component Nginx }
node AppNode1 {
  component UserService
  component OrderService
}
node AppNode2 {
  component PaymentService
  component NotificationService
}
node DataNode {
  component MongoDB
  component Redis
}

LoadBalancer --> AppNode1 : HTTP
LoadBalancer --> AppNode2 : HTTP
AppNode1 --> DataNode : TCP
AppNode2 --> DataNode : TCP
AppNode1 ..> AppNode2 : gRPC
@enduml
</code></pre>

---

### Node Instance Notation

```
node instanceName:TypeName { ... }
instanceName:TypeName --> other:OtherType : link
```

**Example:**

```
@startuml
node server:BankServer {
  component Transactions
  component AccountMgmt
}
node client:ATMKiosk {
  component ATMSoftware
}

client:ATMKiosk --> server:BankServer : network
@enduml
```

<pre><code class="language-uml-deployment">
@startuml
node server:BankServer {
  component Transactions
  component AccountMgmt
}
node client:ATMKiosk {
  component ATMSoftware
}

client:ATMKiosk --> server:BankServer : network
@enduml
</code></pre>

---

## Use Case Diagrams

### Actors & Use Cases

```
actor ActorName
actor "Actor Label" as alias

usecase "Use Case Name" as UC_ID
usecase "Name"                        ← auto-generates ID from name
```

### System Boundary

```
rectangle "System Name" {
  UC1
  UC2
  alias
}
```

### Relationships

```
Actor -- UseCase                          ← association (no arrow)
Actor --> UseCase                         ← directed association
UseCase ..> UseCase : <<include>>         ← include (mandatory sub-flow)
UseCase ..> UseCase : <<extend>>          ← extend (optional extension)
Actor --|> Actor                          ← actor generalization
```

**Example:**

```
@startuml
actor User
actor Admin

usecase "Log In" as UC1
usecase "Register Account" as UC2
usecase "Reset Password" as UC3
usecase "Manage Users" as UC4
usecase "Confirm Email" as UC5

rectangle "Auth System" {
  UC1
  UC2
  UC3
  UC4
  UC5
}

User -- UC1
User -- UC2
User -- UC3
User -- UC5
Admin -- UC1
Admin -- UC4
UC3 ..> UC1 : <<extend>>
UC2 ..> UC5 : <<include>>
@enduml
```

<pre><code class="language-uml-usecase">
@startuml
actor User
actor Admin

usecase "Log In" as UC1
usecase "Register Account" as UC2
usecase "Reset Password" as UC3
usecase "Manage Users" as UC4
usecase "Confirm Email" as UC5

rectangle "Auth System" {
  UC1
  UC2
  UC3
  UC4
  UC5
}

User -- UC1
User -- UC2
User -- UC3
User -- UC5
Admin -- UC1
Admin -- UC4
UC3 ..> UC1 : <<extend>>
UC2 ..> UC5 : <<include>>
@enduml
</code></pre>

---

## Activity Diagrams

### Flow Nodes

```
(*)                             ← initial / final node (circle)
"Action Name"                   ← action (quoted string)
"Action Name" --> "Next Action"
(*) --> "First Action"
"Last Action" --> (*)
```

### Decision / Merge

```
if "condition label" then
  --> [yes] "ThenAction"
else
  --> [no] "ElseAction"
endif
```

### Fork / Join (Parallel)

```
fork
  --> "Branch A"
  --> "Branch B"
endfork
```

### Swimlanes

```
|LaneName|        ← assigns all subsequent nodes to this lane
```

**Example — order processing:**

```
@startuml
(*) --> "Receive Order"
"Receive Order" --> "Validate Payment"
if "Payment Valid?" then
  --> [yes] "Process Order"
else
  --> [no] "Reject Order"
endif
"Process Order" --> "Ship Order"
"Ship Order" --> (*)
"Reject Order" --> (*)
@enduml
```

<pre><code class="language-uml-activity">
@startuml
(*) --> "Receive Order"
"Receive Order" --> "Validate Payment"
if "Payment Valid?" then
  --> [yes] "Process Order"
else
  --> [no] "Reject Order"
endif
"Process Order" --> "Ship Order"
"Ship Order" --> (*)
"Reject Order" --> (*)
@enduml
</code></pre>

---

**Example — swimlanes:**

```
@startuml
|Customer|
(*) --> "Place Order"
|Warehouse|
"Place Order" --> "Pick Items"
"Pick Items" --> "Pack"
|Shipping|
"Pack" --> "Ship"
|Customer|
"Ship" --> "Receive"
"Receive" --> (*)
@enduml
```

<pre><code class="language-uml-activity">
@startuml
|Customer|
(*) --> "Place Order"
|Warehouse|
"Place Order" --> "Pick Items"
"Pick Items" --> "Pack"
|Shipping|
"Pack" --> "Ship"
|Customer|
"Ship" --> "Receive"
"Receive" --> (*)
@enduml
</code></pre>

---

## Notes & Annotations

Notes are supported in all diagram types.

### Single-Line Note

```
note left of Target : text
note right of Target : text
note top of Target : text
note bottom of Target : text
```

For class diagrams, notes can target specific members:

```
note right of ClassName.memberName : text
```

### Multi-Line Note

```
note right of Target
  Line one
  Line two
end note
```

### Sequence Diagram Notes

```
note left of ParticipantId : text
note right of ParticipantId : text
note over ParticipantId
  Multi-line text
end note
```

**Example — notes in class diagram:**

```
@startuml
class BankAccount {
  + owner: String
  + balance: Number
  + deposit(amount: Number)
  + withdraw(amount: Number)
}
note bottom of BankAccount: {owner->notEmpty() and balance >= 0}
note right of BankAccount.withdraw: Throws `InsufficientFundsException`
@enduml
```

<pre><code class="language-uml-class">
@startuml
class BankAccount {
  + owner: String
  + balance: Number
  + deposit(amount: Number)
  + withdraw(amount: Number)
}
note bottom of BankAccount: {owner->notEmpty() and balance >= 0}
note right of BankAccount.withdraw: Throws `InsufficientFundsException`
@enduml
</code></pre>

---

**Example — notes in sequence diagram:**

```
@startuml
participant c: Client
participant s: Server
participant db: Database

c -> s: authenticate()
note right of s: Validates JWT token
s -> db: findUser(token)
note left of db: Lookup by indexed token field
db --> s: userRecord
note over s
  At this point the server has
  verified the user identity.
end note
s --> c: authResult
@enduml
```

<pre><code class="language-uml-sequence">
@startuml
participant c: Client
participant s: Server
participant db: Database

c -> s: authenticate()
note right of s: Validates JWT token
s -> db: findUser(token)
note left of db: Lookup by indexed token field
db --> s: userRecord
note over s
  At this point the server has
  verified the user identity.
end note
s --> c: authResult
@enduml
</code></pre>

---

### Note Inline Formatting

Inside any note body:

| Syntax | Effect |
|---|---|
| `` `code` `` | Monospace / inline code |
| `$expr$` | Italic (math-style) |
| ` ```language ` … ` ``` ` | Syntax-highlighted code block |

**Supported syntax-highlight languages:** `python` (or `py`), `java`, `javascript` (or `js`), `cpp` (or `c`)

**Example — Python code in note:**

```
@startuml
class BankAccount {
  + balance: float
  + withdraw(amount: float)
}
note right of BankAccount
  ```python
  def withdraw(self, amount):
      if amount > self.balance:
          raise InsufficientFunds(self.balance)
      self.balance -= amount
  ```
end note
@enduml
```

<pre><code class="language-uml-class">
@startuml
class BankAccount {
  + balance: float
  + withdraw(amount: float)
}
note right of BankAccount
  ```python
  def withdraw(self, amount):
      if amount > self.balance:
          raise InsufficientFunds(self.balance)
      self.balance -= amount
  ```
end note
@enduml
</code></pre>

---

**Example — Java code in note:**

```
@startuml
class OrderService {
  + placeOrder(order: Order): boolean
}
note right of OrderService
  ```java
  public boolean placeOrder(Order order) {
      if (order == null)
          throw new IllegalArgumentException();
      return repository.save(order);
  }
  ```
end note
@enduml
```

<pre><code class="language-uml-class">
@startuml
class OrderService {
  + placeOrder(order: Order): boolean
}
note right of OrderService
  ```java
  public boolean placeOrder(Order order) {
      if (order == null)
          throw new IllegalArgumentException();
      return repository.save(order);
  }
  ```
end note
@enduml
</code></pre>

---

**Example — mixed inline formatting:**

```
@startuml
class Order {
  + id: int
  + status: String
  + total: double
}
class Customer {
  + name: String
}
Customer "1" -- "*" Order : places
note right of Order
  Status transitions via `updateStatus()`:
  CREATED -> PAID -> SHIPPED
  Total must satisfy $total >= 0$
end note
@enduml
```

<pre><code class="language-uml-class">
@startuml
class Order {
  + id: int
  + status: String
  + total: double
}
class Customer {
  + name: String
}
Customer "1" -- "*" Order : places
note right of Order
  Status transitions via `updateStatus()`:
  CREATED -> PAID -> SHIPPED
  Total must satisfy $total >= 0$
end note
@enduml
</code></pre>

---

## CSS Theming

Override any of the following CSS custom properties to theme diagrams globally:

```css
:root {
  --uml-stroke:          #4060a0;   /* line / border color */
  --uml-text:            #222;       /* primary text */
  --uml-fill:            #fdfcf8;   /* default element fill */
  --uml-header-fill:     #dbe8f8;   /* class header / title bar fill */
  --uml-line:            #444;       /* alternate line color */
  --uml-secondary-line:  #6c7c8d;   /* notes / secondary strokes */
  --uml-secondary-fill:  #eef4fa;   /* note background */
  --uml-label-fill:      rgba(255,255,255,0.94);   /* relationship label bg */
  --uml-label-stroke:    rgba(64,96,160,0.18);     /* relationship label border */
}
```

**Example — dark theme:**

```css
:root {
  --uml-stroke:         #7aa2f7;
  --uml-text:           #c0caf5;
  --uml-fill:           #1a1b26;
  --uml-header-fill:    #24283b;
  --uml-secondary-fill: #16161e;
  --uml-label-fill:     rgba(26,27,38,0.94);
}
```

---

## CLI / Node.js API

### Browser API

```javascript
// Render into a container element
window.UMLClassDiagram.render(containerEl, specText);
window.UMLSequenceDiagram.render(containerEl, specText);
window.UMLStateDiagram.render(containerEl, specText);
window.UMLComponentDiagram.render(containerEl, specText);
window.UMLDeploymentDiagram.render(containerEl, specText);
window.UMLUseCaseDiagram.render(containerEl, specText);
window.UMLActivityDiagram.render(containerEl, specText);

// Parse only (returns AST)
window.UMLClassDiagram.parse(specText);

// Render from pre-parsed data
window.UMLClassDiagram.renderFromData(containerEl, parsedData);
```

### Node.js CLI (`uml_render.js`)

Requires [Playwright](https://playwright.dev/). Reads spec from stdin, writes SVG to a file.

```bash
# Usage
echo "<spec>" | node uml_render.js <type> output.svg
cat diagram.uml | node uml_render.js class diagram.svg

# Types: class, sequence, state, component, deployment, usecase, activity
```

**Example:**

```bash
cat <<'EOF' | node uml_render.js class observer.svg
@startuml
interface Observer { + update(): void }
class ConcreteObserver { + update(): void }
ConcreteObserver ..|> Observer
@enduml
EOF
```

### Batch Rendering (`uml_to_svg.js`)

Renders multiple diagrams in one Playwright session with MD5-based caching (stored in `.uml_cache/`).

```bash
node uml_to_svg.js < input.json > output.json
```

Input JSON format:

```json
{
  "diagram1": { "type": "class",    "text": "@startuml\n...\n@enduml" },
  "diagram2": { "type": "sequence", "text": "@startuml\n...\n@enduml" }
}
```

Output JSON format:

```json
{
  "diagram1": "<svg>...</svg>",
  "diagram2": "<svg>...</svg>"
}
```

---

## Quick Reference Card

### Relationship Arrows (Class)

| Arrow | Meaning |
|---|---|
| `A --|> B` | Generalization (extends) |
| `A ..|> B` | Realization (implements) |
| `A *-- B` | Composition |
| `A o-- B` | Aggregation |
| `A --> B` | Navigable association |
| `A <--> B` | Bidirectional association |
| `A -- B` | Plain association |
| `A --x B` | Non-navigable association |
| `A ..> B` | Dependency |

### Message Arrows (Sequence)

| Arrow | Meaning |
|---|---|
| `A -> B` | Synchronous call |
| `A --> B` | Return / response |
| `A ->> B` | Asynchronous |
| `A ->o B` | Lost message |
| `o-> A` | Found message |

### Combined Fragments (Sequence)

`alt` · `loop` · `opt` · `par` · `break` · `critical` · `ref` · `neg`

### Layout Hints

`layout horizontal` · `layout vertical` · `layout landscape` · `layout portrait` · `layout compact` · `layout square` · `layout auto`

### Note Targets

`note left|right|top|bottom of <Element>`  
`note right of <Class>.<member>`  
`note left|right|over of <Participant>` *(sequence)*
