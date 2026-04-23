---
title: Data Management
layout: sebook
---

<script src="/js/ArchUML/uml-bundle.js"></script>

# Background and Motivation

## A Motivating Story: The Bank that Lost \\$100

Imagine you are writing a small banking service. A customer wants to transfer \\$100 from Account A (balance \\$2000) to Account B (balance \\$1000). Your code reads the two balances from a file, subtracts 100 from A, adds 100 to B, and writes both back. Shipped.

One afternoon the server loses power *between* the two writes. When it reboots, Account A has been debited but Account B was never credited. \\$100 has simply vanished. On a different day, two customer-service agents hit "transfer" at the same moment for the same account — one read an old balance while the other was still writing — and an overdraft goes undetected. A week later, the disk containing all account balances fails. There is no backup. Several million dollars of customer data is gone.

None of these are *coding* bugs. The code compiled, the tests passed, each transfer "worked" on a good day. What the system is missing is **data management** — the discipline of storing data so that it survives crashes, tolerates concurrent access, scales beyond one machine, and can still be queried efficiently when the dataset is far larger than memory.

The software layer that solves this problem in a general, reusable way is called a **Database Management System (DBMS)**. This chapter is about what a DBMS gives you, how it structures and queries data, what guarantees it can and cannot make, and the fundamental trade-offs you will face when choosing between systems.

## Why We Need a DBMS

When your application stores data by itself, four classes of problem appear over and over:

* **Partial writes.** A process can crash, a power cable can be pulled, or an OS can panic in the middle of writing a record. Without careful design, the on-disk state is left in a half-updated, inconsistent shape — as in the \\$100 story above.
* **Concurrent access.** Two users editing the same record simultaneously can overwrite each other's changes, produce phantom reads, or create accounting inconsistencies that pass every unit test in isolation.
* **Hardware loss.** Disks fail. A single-disk system with no redundancy loses everything when one sector goes bad.
* **Scale.** A naïve file scan is fine for 1,000 rows. At 1,000,000 rows it is seconds. At 1,000,000,000 rows it is minutes. Applications need **indexes** and **query optimization** to keep read latency tolerable as data grows.

A DBMS is a separate piece of software that sits between your application and the disk and handles all four of these problems once, so you don't re-solve them in every app:

<pre><code class="diagram-freeform">@startuml
layout vertical
box "Your Application" as App
box "DBMS\n(handles crashes, concurrency,\nredundancy, indexing, queries)" as DBMS
box "Disk\n(persistent storage)" as Disk
App --> DBMS : request / query
DBMS --> Disk : managed read / write
@enduml</code></pre>

| Problem the app has on its own | What the DBMS provides |
|---|---|
| Partial writes on crash | Transactions with atomicity and durability (see ACID, later) |
| Concurrent edits corrupting data | Isolation between concurrent transactions |
| Disk failure losing everything | Replication and on-disk redundancy |
| Slow reads as data grows | Indexes |
| Hand-written read/write loops | Declarative queries + query optimization |

Once you have a DBMS, the application code stops worrying about *how* the data is laid out on disk and talks to the DBMS through a query language. The most widely used query language by far is SQL.

## SQL in One Paragraph

**SQL (Structured Query Language)** is the query language that most DBMSs understand. SQL is **declarative**: you describe *what* data you want — "give me the names of all students enrolled in 35L" — and the DBMS decides *how* to find it (which indexes to use, which order to join tables in, how to parallelize). This separation is one of the most consequential ideas in data management: it lets the DBMS optimize your query without you rewriting it.

SQL is an **industry standard** (ISO/IEC 9075), and most relational systems support the core of it. In practice, however, **SQL dialects differ** — PostgreSQL, MySQL, SQL Server, and Oracle each add their own extensions (stored-procedure languages, window-function syntax, JSON operators) that are not portable. "SQL-compatible" is closer to "mostly compatible for the standard subset" than to "drop-in replaceable." Knowing the core of the language lets you read and write queries against almost any relational DBMS; rewriting a large application to switch DBMSs still usually takes real effort.

> **Note on scope.** The rest of this chapter uses small SQL snippets to make operations concrete. You do **not** need to memorize SQL syntax for this course — what matters is the *thinking* behind each query (which operations, in which order). An optional, deeper SQL walkthrough is available in [Remy Wang's CS 143 SQL notes](https://remy.wang/cs143/notes/sql/sql.html).

---

**Check yourself (retrieval practice).** Before reading on, close your eyes for thirty seconds and name the four problems a DBMS solves that a naïve application does not. Then name one thing SQL's *declarativeness* buys you. Spaced retrieval — trying to remember without looking — is what builds durable memory; re-reading is what feels like it does.

---

# The Relational Model: Modeling Data as Tables

## Entities and Relationships: ER Diagrams

Before writing any SQL, data is usually modeled with an **Entity-Relationship (ER) diagram** — a picture of the things in the world the system must represent, and the relationships between them. The canonical notation (due to Peter Chen, 1976) uses rectangles for **entities** (the things — `Student`, `Course`), ovals for **attributes** (what you know about them — `name`, `UID`, `Course ID`), and diamonds for **relationships** between entities (`is enrolled`).

For a course-registration system, a minimal ER diagram might look like this:

<pre><code class="diagram-er">@startuml
title Course Registration

entity Student {
  # UID
  name
}

entity Course {
  # "Course ID"
  # Quarter
  Instructor
}

relationship "is enrolled"

Student "N" -- "is enrolled"
Course  "M" -- "is enrolled"
@enduml</code></pre>

The **N** and **M** annotate the **multiplicity** of the relationship: one student can be enrolled in many (N) courses, and one course can contain many (M) students. This is a **many-to-many** relationship — the single most important case to recognize, because it is the reason the next concept (the join table) exists.

An ER diagram is a *design artifact*, not a database. The next step is to translate it into the tables the DBMS will actually store.

## Relations, Tables, Rows, Columns

A **Relational Database Management System (RDBMS)** — think MySQL, PostgreSQL, SQLite, Oracle, or Microsoft SQL Server — stores data as **tables** (formally called **relations**). Each table has:

* A fixed set of **columns** (also called **attributes**), each with a name and a data type (`INTEGER`, `VARCHAR(100)`, `DATE`, …).
* Any number of **rows** (also called **tuples** or **records**), one per stored entity.

Translating the ER diagram above into tables yields three of them: one for each entity, plus one for the many-to-many relationship.

**Table `Student`**

| name | <u>uid</u> |
|---|---|
| Jon Doe | 12345 |
| Jane Doe | 23456 |

**Table `Course`**

| <u>id</u> | <u>quarter</u> | instructor |
|---|---|---|
| 35L | Fall 2025 | Tobias Dürschmid |
| 143 | Fall 2025 | Remy Wang |
| 32  | Fall 2025 | David Smallberg |

**Table `IsEnrolled`**

| <u>uid</u> | <u>quarter</u> | <u>course_id</u> |
|---|---|---|
| 12345 | Fall 2025 | 35L |
| 12345 | Fall 2025 | 143 |

Underlined columns indicate the **primary key** of each table, discussed next. Note that `IsEnrolled` has no data of its own beyond references — it exists purely to represent the many-to-many `is enrolled` relationship. This pattern (one table per entity + one join table per many-to-many relationship) is how every many-to-many relationship is represented in a relational database.

## Primary Keys: the "Address" of a Row

A **primary key** is the column (or combination of columns) whose value uniquely identifies a row in a table. No two rows may have the same primary-key value, and the value may not be `NULL`.

* In `Student`, the primary key is `uid` — every student has a unique UID.
* In `Course`, the primary key is *not* just `id` — a course with the same `id` can run in different quarters. The primary key is the **composite** `(id, quarter)` — only the *pair* is unique.
* In `IsEnrolled`, the primary key is the composite `(uid, quarter, course_id)` — a student can enroll in different courses and can even re-take a course in a different quarter, but cannot be enrolled twice in the exact same (course, quarter).

The primary key is what the rest of the database uses to **refer to** a row — the row's "name" inside the database. When we say "foreign key", we will mean "a column that stores some other table's primary-key value."

```sql
CREATE TABLE Student (
    uid  INTEGER NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE Course (
    id          VARCHAR(50)  NOT NULL,
    quarter     VARCHAR(20)  NOT NULL,
    instructor  VARCHAR(100),
    PRIMARY KEY (id, quarter)       -- composite primary key
);
```

> **Common confusion.** "Primary key = a single ID column" is only true sometimes. Any set of columns whose combination uniquely identifies a row is a legal primary key. When an entity is naturally identified by more than one column (as with `(course_id, quarter)`), a composite primary key is the clean solution — don't invent a synthetic `course_quarter_id` just to fit the one-column shape.

## Foreign Keys: Keeping References Consistent

A **foreign key** is a column (or set of columns) in one table whose values are required to match a primary key in another table. Foreign keys are how tables are *linked*: they express "this row refers to *that* row over there."

In `IsEnrolled`, `uid` is a foreign key into `Student(uid)` — every row in `IsEnrolled` must refer to an existing student. Likewise, `(course_id, quarter)` is a foreign key into `Course(id, quarter)`.

```sql
CREATE TABLE IsEnrolled (
    uid         INTEGER      NOT NULL,
    course_id   VARCHAR(50)  NOT NULL,
    quarter     VARCHAR(20)  NOT NULL,
    PRIMARY KEY (uid, course_id, quarter),
    FOREIGN KEY (uid)                REFERENCES Student(uid),
    FOREIGN KEY (course_id, quarter) REFERENCES Course(id, quarter)
);
```

The DBMS enforces the foreign-key constraint: you cannot insert an `IsEnrolled` row whose `uid` does not already exist in `Student`, and you cannot delete a `Student` row while any `IsEnrolled` row still references it (without an explicit cascade rule). This is the mechanism that prevents **dangling references** — the database version of "pointer to nowhere."

### Primary key vs. foreign key — a near-identical pair

Students frequently confuse these. The cleanest way to see the difference is to look at them side-by-side on the *same* column:

| Role | What it means | Example from `IsEnrolled` |
|---|---|---|
| **Primary key** | Uniquely identifies *this* table's rows. No two rows share it. | `(uid, course_id, quarter)` — no student is enrolled twice in the same course+quarter |
| **Foreign key** | Must match the primary key of *another* table. Ensures the reference is valid. | `uid` must equal some `Student.uid` |

The *same column* (`uid`) plays *both* roles in `IsEnrolled`: it is part of the primary key (it helps identify this row) *and* it is a foreign key (it refers to a row of `Student`). Roles describe the column's job, not its name.

---

**Check yourself.** Without scrolling up, draw the three tables and mark which columns form the primary key and which are foreign keys. Explain in one sentence *why* `Course`'s primary key has to be composite.

---

# Querying Data: The Four Core Operations

A DBMS supports a large variety of queries. Remarkably, the overwhelming majority of practical queries can be built from just four underlying **relational algebra** operations. Each has a Greek-letter symbol that the database literature uses as shorthand; each has a direct SQL equivalent. Learn the four operations and you can read and write queries fluently.

Our running example will be three natural-language questions, each slightly harder than the previous:

1. "Give me the names of all students who have taken 35L."
2. "Count all students who have taken a course with Remy Wang."
3. "For each instructor, count all students who have taken a course with them."

## Join ($R \bowtie S$) — combining tables

A **join** combines rows from two tables where specified columns agree. Formally, $R \bowtie S$ pairs each row of $R$ with each row of $S$ that matches on the join condition, and concatenates the columns.

Joining `Student` with `IsEnrolled` on `uid` (each student's rows paired with each of their enrollments), and then with `Course` on `(course_id, quarter) = (id, quarter)`, yields a single wide table containing, for each enrollment, the student's name, the course, the quarter, and the instructor:

$$\text{Student} \bowtie \text{IsEnrolled} \bowtie \text{Course}$$

| name | <u>uid</u> | <u>quarter</u> | <u>course_id</u> | instructor |
|---|---|---|---|---|
| Jon Doe | 12345 | Fall 2025 | 35L | Tobias Dürschmid |
| Jon Doe | 12345 | Fall 2025 | 143 | Remy Wang |

> **Join flavors.** `INNER JOIN` (the default) drops rows with no match; `LEFT OUTER JOIN` keeps every row from the left table, filling in `NULL` where there is no match; `RIGHT OUTER JOIN` does the same for the right; `FULL OUTER JOIN` keeps unmatched rows from both sides. Which flavor to pick depends on whether "no match" means "exclude" (inner) or "include with missing fields" (outer).

## Selection ($\sigma$) — filtering rows

**Selection** picks the rows that satisfy a Boolean predicate and drops the rest. The notation $\sigma_{\text{predicate}}(R)$ reads as "select from $R$ the rows where *predicate* holds." In SQL this is the `WHERE` clause.

Applied to the joined table above with the predicate *course\_id = '35L'*:

$$\sigma_{\text{course}\_\text{id}=\text{35L}}(\text{Student} \bowtie \text{IsEnrolled} \bowtie \text{Course})$$

| name | <u>uid</u> | <u>quarter</u> | <u>course_id</u> | instructor |
|---|---|---|---|---|
| Jon Doe | 12345 | Fall 2025 | 35L | Tobias Dürschmid |

## Projection ($\Pi$) — keeping only some columns

**Projection** drops all columns except the ones named. The notation $\Pi_{\text{name}}(R)$ reads as "project $R$ onto the `name` column." In SQL this is the `SELECT` list.

Applied to the filtered table:

$$\Pi_{\text{name}}(\sigma_{\text{course}\_\text{id}=\text{35L}}(\text{Student} \bowtie \text{IsEnrolled} \bowtie \text{Course}))$$

| name |
|---|
| Jon Doe |

## Group-By ($\gamma$) — aggregating over groups

**Group-by** partitions the rows of a table into groups that share the same value(s) on the grouping columns, and computes an **aggregate** (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, …) for each group. The notation $$\gamma_{\text{group}\_\text{cols},\ \text{agg}}(R)$$ reads as "group $R$ by *group\_cols* and compute *agg* per group." In SQL this is `GROUP BY` with an aggregate function in the `SELECT` list.

Grouping the joined $\text{IsEnrolled} \bowtie \text{Course}$ table by `instructor` and counting distinct students per group:

$$\gamma_{\text{instructor},\ \text{COUNT}(\text{DISTINCT uid})}(\text{IsEnrolled} \bowtie \text{Course})$$

| instructor | students |
|---|---|
| Tobias Dürschmid | 1 |
| Remy Wang | 2 |
| David Smallberg | 0 |

---

## Worked Example 1 — fully worked: "Names of students who have taken 35L"

**Objective of learning:** see how the four operations *compose* into a complete query.

**Decomposition.** Ask, in order: *which tables hold the needed information?* (`Student` for the name, `IsEnrolled` for the course link.) *What is the join condition?* (match on `uid`.) *What rows do we want?* (those with `course_id = '35L'`.) *What do we want in the output?* (just the name.)

**Plan:**

1. **Join** $\text{Student} \bowtie \text{IsEnrolled}$ on `uid` — one row per (student, enrollment) pair.
2. **Select** the rows where `course_id = '35L'` — keep only 35L enrollments.
3. **Project** onto `name` — drop every column but the student's name.

Relational-algebra form:

$$\Pi_{\text{name}}(\sigma_{\text{course}\_\text{id}=\text{35L}}(\text{Student} \bowtie \text{IsEnrolled}))$$

In SQL:

```sql
SELECT S.name                                    -- Projection: "Give me the names"
FROM   Student AS S
       JOIN IsEnrolled AS E ON S.uid = E.uid     -- Join: link students to enrollments
WHERE  E.course_id = '35L';                      -- Selection: "who have taken 35L"
```

Notice how each SQL clause corresponds to one operation: `SELECT` is projection, `FROM ... JOIN` is join, `WHERE` is selection.

---

## Worked Example 2 — partially worked: "Count all students who have taken a course with Remy Wang"

**Objective of learning:** notice that adding an aggregate (`COUNT DISTINCT`) is a *fifth* step on top of the same three-operation skeleton.

**Your turn (before reading on).** Given the tables, which two tables must be joined? Which rows should be filtered out? Which columns should appear in the final result?

**Decomposition.** We need to count *distinct students* (not enrollments — a student who took two of Remy's courses still counts once) whose enrollment links them to a course whose instructor is Remy Wang.

1. **Join** $\text{IsEnrolled} \bowtie \text{Course}$ on `(course_id, quarter) = (id, quarter)`.
2. **Select** rows where `instructor = 'Remy Wang'`.
3. **Project** onto `uid` (distinct).
4. **Aggregate** with `COUNT(DISTINCT uid)`.

In SQL:

```sql
SELECT COUNT(DISTINCT E.uid) AS student_count
FROM   IsEnrolled AS E
       JOIN Course AS C
         ON E.course_id = C.id
        AND E.quarter   = C.quarter
WHERE  C.instructor = 'Remy Wang';
```

Why `DISTINCT`? If a student took two different courses with Remy Wang, they appear on two rows of the joined table. `COUNT(E.uid)` would double-count them; `COUNT(DISTINCT E.uid)` counts each student once.

---

## Worked Example 3 — reader-generates: "For each instructor, count all students who have taken a course with them"

**Your turn.** Before reading the solution, write the SQL yourself. Hints only:

* Which operation turns "for each X, do Y" into SQL? (Think about the fourth operation we introduced.)
* Which column do you group by?
* Which aggregate do you apply, and on what?

...

**Solution.**

```sql
SELECT   C.instructor,
         COUNT(DISTINCT E.uid) AS students
FROM     IsEnrolled AS E
         JOIN Course AS C
           ON E.course_id = C.id
          AND E.quarter   = C.quarter
GROUP BY C.instructor;        -- Group-By: one output row per instructor
```

In relational-algebra form: $$\gamma_{\text{instructor},\ \text{COUNT}(\text{DISTINCT uid})}(\text{IsEnrolled} \bowtie \text{Course})$$

The `GROUP BY` clause is doing the heavy lifting: it partitions the joined rows into one group per instructor; the `SELECT` list then runs the aggregate (`COUNT(DISTINCT uid)`) once per group, yielding one output row per instructor.

---

**Check yourself.** For each of these three queries, re-derive the relational-algebra expression from scratch without peeking. Then: *which* of the four operations would you remove from the language if you had to pick one, and what queries would no longer be expressible?

---

# Transactions and the ACID Properties

The bank-transfer story at the start of this chapter motivates a concept called a **transaction**: a sequence of operations that the DBMS should treat as a single, logical unit of work — even though internally it touches multiple rows, multiple tables, or multiple disk writes.

## A Transaction: Money Moving Between Accounts

Suppose we have a single table:

**Table `Accounts`**

| <u>id</u> | balance |
|---|---|
| A | 2000 |
| B | 1000 |

Moving \\$100 from A to B requires *two* updates. Wrapping them in a transaction tells the DBMS they must succeed or fail together:

```sql
BEGIN TRANSACTION;
    UPDATE Accounts
       SET balance = balance - 100
     WHERE id = 'A';
    UPDATE Accounts
       SET balance = balance + 100
     WHERE id = 'B';
COMMIT;
```

Between `BEGIN TRANSACTION` and `COMMIT`, the DBMS tracks every change but does not make it permanently visible to other transactions. At `COMMIT`, all changes become visible and durable together; at `ROLLBACK` (explicit, or implicit on failure), none do. That's the first guarantee — **Atomicity** — and it is one of four properties summarized by the acronym **ACID**.

## ACID: the four transaction guarantees

A DBMS transaction is expected to provide four properties.

### A — Atomicity

> *A transaction is an **all-or-nothing** unit of work. Either every operation inside it takes effect, or none does.*

**Why it matters.** In the bank-transfer story, the server crashed between the debit of A and the credit of B. With atomicity, that crash rolls the whole transaction back on restart — A is still \\$2000, B is still \\$1000, and the money has not evaporated. Without atomicity, consistency of the overall system is at the mercy of unpredictable failure timing.

**Bank-transfer case.** The database never ends in a state where A's balance has been changed but B's has not.

### C — Consistency (ACID-Consistency)

> *A transaction moves the database **from one valid state to another**. Declared constraints (primary keys, foreign keys, `NOT NULL`, `CHECK` predicates, triggers) are enforced; if any would be violated, the whole transaction is rejected.*

**Why it matters.** If you declare `CHECK (balance >= 0)` on the `Accounts` table, the DBMS will refuse to commit a transfer that would leave either account negative. You don't have to check that invariant in every application path — the DBMS enforces it on every transaction, everywhere.

**Bank-transfer case.** If account A only held \\$50, the transfer would violate `balance >= 0` on A and the entire transaction would be rolled back. Under no conditions is a constraint-violating state allowed to commit.

> **⚠️ Critical misconception — "Consistency" means two different things.** The "C" in ACID and the "C" in CAP (later in this chapter) are **not the same idea**, despite sharing a word. ACID-Consistency = *declared-constraints are respected*. CAP-Consistency = *every read reflects the most recent write* (linearizability). You can have one without the other. Read this callout twice.

### I — Isolation

> *Concurrent transactions do not see each other's intermediate state. The effect of running transactions at the same time is (ideally) the same as if they had been run one after another, in some serial order.*

**Why it matters.** Without isolation, a separate transaction reading the total bank balance halfway through our transfer could observe A = \\$1900 and B = \\$1000 — a total of \\$2900, reflecting a state in which \\$100 has vanished. With isolation, that reader sees the balances *either* before the transfer (A = \\$2000, B = \\$1000) *or* after (A = \\$1900, B = \\$1100), never the half-completed in-between.

**Bank-transfer case.** The "total bank balance" is always \\$3000, whether the reader looks before, during, or after the transfer. The internal two-step machinery is invisible from outside.

> **Caveat.** Real systems support several **isolation levels** (`READ UNCOMMITTED`, `READ COMMITTED`, `REPEATABLE READ`, `SERIALIZABLE`) that trade strictness for performance. Only `SERIALIZABLE` gives the "equivalent to some serial order" guarantee in full; lower levels permit specific kinds of concurrent interference in exchange for throughput. Which level is right depends on what anomalies your application can tolerate.

### D — Durability

> *Once a transaction has **committed**, its changes survive any subsequent crash — power loss, OS kernel panic, DBMS process kill. On restart, the data is there.*

**Why it matters.** Durability is what lets the application return "money transferred ✓" to the user without lying. Without it, the DBMS might acknowledge a commit and then lose the write when the machine loses power seconds later.

**Bank-transfer case.** The server loses power one millisecond after `COMMIT` returns. On reboot, the DBMS replays its **write-ahead log** and restores the committed transfer. Both balance changes are permanent.

### ACID, summarized in one table

| Letter | Property | One-sentence intuition | Protects against |
|---|---|---|---|
| **A** | Atomicity | All the operations in a transaction succeed, or none do. | Partial writes after a crash. |
| **C** | Consistency | Declared constraints are never violated by a committed transaction. | Invalid data (negative balances, dangling foreign keys). |
| **I** | Isolation | Concurrent transactions don't see each other's half-done state. | Anomalies from two users editing the same data at once. |
| **D** | Durability | Committed changes survive crashes. | Losing an acknowledged write to a power outage. |

---

**Check yourself.** For each of these failures, name the ACID letter whose *violation* would produce it:

1. You transfer \\$100; the server crashes mid-transfer; on restart, A has been debited but B has not been credited.
2. The DBMS lets a transfer commit that drives A's balance to \\$-500, even though `CHECK (balance >= 0)` is declared.
3. While your transfer is executing, a separate report reads A and B and observes a total bank balance that is \\$100 short.
4. Your transfer returns "success". A power outage hits one second later. On reboot, neither balance has changed.

(Answers: Atomicity, Consistency, Isolation, Durability.)

---

# Distributed Databases and the CAP Theorem

So far we have assumed a single DBMS on a single machine. In practice, large-scale systems spread data across many machines, either to hold more than fits on one disk, to serve more requests than one machine can handle, or to survive entire machine failures. These systems are called **distributed databases**, and they run into a fundamental trade-off that doesn't exist on a single node.

## Three properties, one theorem

A distributed data system can be evaluated on three properties:

* **Consistency (C)** — every read returns the most recent committed write, or an error. (This is **linearizability**, not the ACID-C of constraint enforcement. Same word, different concept.)
* **Availability (A)** — every request receives a non-error response, though not necessarily the most recent data.
* **Partition Tolerance (P)** — the system continues to operate even when the network between its nodes drops messages or delays them arbitrarily (a **network partition**).

The **CAP theorem** (Brewer, 2000; proved by Gilbert and Lynch, 2002) states that when a network partition occurs, a distributed system must **sacrifice either Consistency or Availability** — you cannot keep both. Partition tolerance is not really optional in practice (networks do fail), so the practical choice in a real deployment is between **CP** (give up Availability during partitions) and **AP** (give up Consistency during partitions).

<pre><code class="diagram-venn">@startuml
title Where Real Databases Fall in the CAP Space

set Consistency
set Availability
set "Partition Tolerance"

Consistency & Availability                          : Single-node RDBMS
Consistency & "Partition Tolerance"                 : HBase, ZooKeeper, MongoDB
Availability & "Partition Tolerance"                : Cassandra, DynamoDB, Riak, CouchDB
Consistency & Availability & "Partition Tolerance"  : empty during partition
@enduml</code></pre>

> **Common caveat.** The popular "pick two out of three" phrasing is a useful slogan but oversimplifies the theorem. The precise claim is: *when a partition happens*, you must give up C or A. When the network is healthy, you can have both. Every distributed database makes a **policy choice** about what to do when a partition occurs — and that choice is what the CP vs. AP label names.

## CP vs. AP: a concrete contrast

* **CP systems** refuse to serve requests on the side of a partition that cannot reach the majority of replicas, to avoid returning stale data. Users on the minority side see errors until the partition heals. Examples: traditional RDBMS replication, MongoDB configured for majority-write concern, HBase, ZooKeeper.
* **AP systems** keep serving requests on both sides of the partition, which can return stale data or produce temporary conflicts that are reconciled after the partition heals. This is often paired with **eventual consistency** — the guarantee that if no further writes happen, all replicas will *eventually* converge to the same state. Examples: Amazon DynamoDB (default), Apache Cassandra, CouchDB, Riak.

There is a third label, **CA**, sometimes attached to single-node RDBMSs. That label is **controversial**: if you interpret "P" as "the system can survive network partitions", then a single-node system doesn't really have a P choice to make — partitions don't apply to one node. A distributed system that claims to be "CA" is almost always really a CP system that has declared its unavailability acceptable under partition.

## Which Property Maps to Which Requirement?

The real pedagogical value of CAP is not the Venn diagram — it's giving you vocabulary to *pick* the right database for an application. A few concrete mappings:

| Application requirement | Which CAP property is primary? |
|---|---|
| "We handle money; we must never double-spend, even if it means going offline during a network issue." | **Consistency** → CP |
| "We show product inventory; a 10-second-stale read is fine; a 500 error loses us sales." | **Availability** → AP |
| "We serve globally; an intercontinental link outage must not bring the system down." | **Partition tolerance** (mandatory, not optional) → pair with C or A |
| "We write ATM withdrawals; ATMs must keep working during a WAN outage to the bank." | **Availability** → AP, with later reconciliation |

The ATM case is worth pausing on. ATMs are often presented in slides as the "all three properties" motivating example, because ATMs seem to show you the correct balance, always let you withdraw, and work anywhere. In reality, ATMs are **AP with eventual consistency**: during a WAN outage to the bank, many ATMs continue to allow withdrawals up to a cached daily limit, and the resulting transactions are reconciled (sometimes producing temporary overdrafts) once connectivity returns. ATMs are the motivating *counterexample* — they show you why CAP is a real trade-off, not a system that defies it.

---

# Relational vs. NoSQL Systems

"**NoSQL**" is a family of non-relational databases that emerged (roughly 2008–2012) in response to two limits of traditional RDBMSs: strict schemas don't fit rapidly-changing or semi-structured data, and ACID transactions become expensive in distributed settings.

> **Name misconception.** "NoSQL" was later redefined as **"Not Only SQL"** — many NoSQL systems have their own rich query languages, and some support SQL-like syntax. The name is about dropping the *relational* assumption, not about banning SQL.

NoSQL is not one system but four broad families, each optimized for a different data shape:

| Family | Data shape | Example systems | Typical fit |
|---|---|---|---|
| **Document** | JSON-like nested records | MongoDB, CouchDB | Content with optional/variable fields |
| **Key-value** | `key → value` with no schema on the value | Redis, Amazon DynamoDB, Riak | Caching, session stores, lookup tables |
| **Wide-column** | Rows with families of sparse columns | Apache Cassandra, HBase, ScyllaDB | Time-series, very-wide denormalized data |
| **Graph** | Nodes and typed edges | Neo4j, Amazon Neptune, JanusGraph | Social networks, fraud detection, knowledge graphs |

## Trade-offs vs. RDBMS

|  | Relational (RDBMS) | NoSQL (typical) |
|---|---|---|
| **Schema** | Strict and enforced | Flexible, often schema-on-read |
| **Transactions** | Full ACID across multiple rows/tables | Often limited to single-record; many systems relax isolation |
| **Consistency** | Typically strong | Often **eventual** consistency by default |
| **Joins** | First-class (relational algebra) | Limited or absent; denormalize instead |
| **Horizontal scaling** | Possible but harder | Often the design priority |
| **Sweet spot** | Well-structured data where transactions matter (finance, bookings, inventory of record) | Large, loosely-structured data where availability and scale matter more than strict consistency (feeds, catalogs, logs) |

The right question is almost never "RDBMS or NoSQL?" in the abstract; it is *"given these specific requirements — transactionality, data shape, scale, query patterns, team familiarity — which system is the best fit?"*. Many production systems use **both**, picking a relational store for the transactional core and a NoSQL store for a high-volume side path like search indexing, caching, or user-generated content.

---

# Summary

* A **DBMS** sits between your application and the disk and handles four problems that every non-trivial application faces: partial writes, concurrent access, disk loss, and slow queries on growing data.
* **SQL** is a declarative query language: you describe the data you want, the DBMS decides how to retrieve it. It is an industry standard — but dialects differ, so "swapping DBMSs" is rarely trivial.
* Data is modeled conceptually with **ER diagrams** (entities, attributes, relationships, multiplicities), then realized physically as **tables** in an RDBMS. **Many-to-many** relationships require a dedicated join table.
* A **primary key** uniquely identifies rows within a table; it may be a single column or a composite of several. A **foreign key** is a column whose values must match some other table's primary key, keeping cross-table references consistent.
* Most practical queries compose four relational operations: **Join ($\bowtie$)** to combine tables, **Selection ($\sigma$)** to filter rows, **Projection ($\Pi$)** to drop columns, and **Group-By ($\gamma$)** to aggregate over groups. Each maps directly to a SQL clause.
* A **transaction** is a sequence of operations treated as a single unit. Transactions provide **ACID** guarantees:
    * **Atomicity** — all or nothing.
    * **Consistency** — declared constraints always hold.
    * **Isolation** — concurrent transactions don't see each other's intermediate state.
    * **Durability** — committed changes survive crashes.
* **ACID-Consistency** (constraint preservation) is **not the same** as **CAP-Consistency** (every read returns the latest write). Same word, different concepts.
* In distributed systems, the **CAP theorem** says: when a network partition occurs, a system must give up **Consistency** or **Availability**. Partition tolerance is not optional in practice, so real systems are effectively **CP** (refuse requests to stay correct) or **AP** (keep serving, accept staleness).
* **NoSQL** is a family of non-relational systems (document, key-value, wide-column, graph), often trading strict ACID and joins for flexible schemas, easier horizontal scale, and weaker (often eventual) consistency. The choice between RDBMS and NoSQL is requirements-driven, not ideological.

---

# Further Reading and Practice

## Further Reading

* **Edgar F. Codd.** *A Relational Model of Data for Large Shared Data Banks.* Communications of the ACM, 13(6), 377–387, 1970. — *The foundational paper introducing the relational model.*
* **Peter Chen.** *The Entity-Relationship Model — Toward a Unified View of Data.* ACM Transactions on Database Systems, 1(1), 9–36, 1976. — *The original ER-diagram paper.*
* **Jim Gray and Andreas Reuter.** *Transaction Processing: Concepts and Techniques.* Morgan Kaufmann, 1992. — *The classic reference on transactions and ACID internals.*
* **Seth Gilbert and Nancy Lynch.** *Brewer's Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services.* ACM SIGACT News, 33(2), 51–59, 2002. — *The formal proof of the CAP theorem.*
* **Eric Brewer.** *CAP Twelve Years Later: How the "Rules" Have Changed.* IEEE Computer, 45(2), 23–29, 2012. — *Brewer's own reflection on how CAP should be interpreted in practice.*
* **Martin Kleppmann.** *Designing Data-Intensive Applications.* O'Reilly, 2017. — *The contemporary reference for storage, replication, consistency, and distributed systems.*
* **Remy Wang.** *CS 143 SQL notes.* <https://remy.wang/cs143/notes/sql/sql.html> — *Optional deeper walkthrough of SQL syntax.*

## Reflection Questions

1. The bank-transfer story at the start of this chapter describes three different failures. For each one, name which ACID property a DBMS uses to prevent it, and explain in one sentence *why* that property rules it out.
2. Pick a real application you use daily (e.g., a chat app, an online game, a shopping site). Would you rather its backend be CP or AP during a network partition? Defend your answer in terms of what the user would experience when the partition hits.
3. A teammate says "our database is strongly consistent because we use SQL." What is wrong with that claim? Separate **ACID-Consistency** from **CAP-Consistency** in your answer.
4. Write an ER diagram for a small system you know well (a library, a social network, a music player). Translate it to tables. Identify the primary key of each table and at least one foreign key. Where did a many-to-many relationship force a join table?
5. Given the query *"For each quarter, list how many distinct instructors taught at least one course that at least 5 students were enrolled in"*, sketch the sequence of relational operations you would compose. Do not write SQL — just the algebra, in order.

## Knowledge Quiz

{% include quiz.html id="data_management" %}

## Retrieval Flashcards

{% include flashcards.html id="data_management" %}

*Pedagogical tip: Try to **explain** each concept aloud — to a teammate, a rubber duck, or your imaginary future self — before peeking at the answer. Effortful retrieval builds durable mental models; re-reading merely feels productive.*
