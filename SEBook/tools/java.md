---
title: Java
layout: sebook
---

This is a **reference page** for Java, designed to be kept open alongside the [Java Tutorial](/SEBook/tools/java-tutorial). Use it to look up syntax, concepts, and comparisons while you work through the hands-on exercises.

> **New to Java?** Start with the [interactive tutorial](/SEBook/tools/java-tutorial) first — it teaches these concepts through practice with immediate feedback. This page is a reference, not a teaching resource.

# Basics

## Entry Point and Syntax

Java forces everything into a class. There are no free functions. The entry point is a static method called `main` — the JVM looks for it by name:

```java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, world!");
    }
}
```

Every word in the signature has a purpose:

| Keyword | Why |
|---------|-----|
| `public` | The JVM must be able to call it from outside the class |
| `static` | No instance of the class is created before `main` runs |
| `void` | Returns nothing; use `System.exit()` for exit codes |
| `String[] args` | Command-line arguments, like C++'s `argv` |

**Quick mapping from Python and C++:**

| Feature | Python | C++ | Java |
|---------|--------|-----|------|
| Entry point | `if __name__ == "__main__":` | `int main()` (free function) | `public static void main(String[] args)` (class method) |
| Typing | Dynamic (`x = 42`) | Static (`int x = 42;`) | Static (`int x = 42;`) |
| Memory | GC + reference counting | Manual (`new`/`delete`) or RAII | GC (generational) |
| Free functions | Yes | Yes | **No** — everything lives in a class |
| Multiple inheritance | Yes (MRO) | Yes | **No** — single class inheritance + interfaces |

```java
// Variables — declare type like C++
int count = 10;
double pi = 3.14159;
String name = "Alice";     // String is a class, not a primitive
boolean done = false;      // not 'bool' (C++) or True/False (Python)

// Printing
System.out.println("Count: " + count);

// Arrays — fixed size, .length is a field (no parentheses)
int[] scores = {90, 85, 92};
System.out.println(scores.length);  // 3 — NOT .length() or len()

// Enhanced for — like Python's "for x in list"
for (int s : scores) {
    System.out.println(s);
}
```

> **Size inconsistency:** Arrays use `.length` (field). Strings use `.length()` (method). Collections use `.size()` (method). This is a well-known Java wart.

## The Dual Type System: Primitives and Wrappers

Java has **8 primitive types** that live on the stack (like C++ value types), and corresponding **wrapper classes** that live on the heap:

| Primitive | Size | Default | Wrapper |
|-----------|------|---------|---------|
| `byte` | 8-bit | 0 | `Byte` |
| `short` | 16-bit | 0 | `Short` |
| `int` | 32-bit | 0 | `Integer` |
| `long` | 64-bit | 0L | `Long` |
| `float` | 32-bit | 0.0f | `Float` |
| `double` | 64-bit | 0.0 | `Double` |
| `char` | 16-bit | `'\u0000'` | `Character` |
| `boolean` | 1-bit | false | `Boolean` |

**Why wrappers exist:** Java generics only work with objects, not primitives. You cannot write `ArrayList<int>` — you must write `ArrayList<Integer>`.

**Autoboxing** is the automatic conversion between primitive and wrapper:

```java
ArrayList<Integer> numbers = new ArrayList<>();
numbers.add(42);              // autoboxing: int → Integer
int first = numbers.get(0);   // unboxing: Integer → int
```

### Autoboxing Traps

**Trap 1 — Null unboxing causes `NullPointerException`:**

```java
Integer count = null;
int n = count;    // NullPointerException! Can't unbox null.
```

**Trap 2 — Boxing in loops is slow:**

```java
// BAD — creates a new Integer object on every iteration
Integer sum = 0;
for (int i = 0; i < 1_000_000; i++) {
    sum += i;  // unbox sum, add i, box result — every iteration!
}

// GOOD — use primitive type for accumulation
int sum = 0;
for (int i = 0; i < 1_000_000; i++) {
    sum += i;  // pure arithmetic, no boxing
}
```

## The Identity Trap: == vs .equals()

> **⚠ False Friend:** In Python, `==` compares values. In Java, `==` on objects compares **identity** (are these the exact same object in memory?), **not** value equality.

```java
String c = new String("hello");
String d = new String("hello");
System.out.println(c == d);       // false — different objects in memory
System.out.println(c.equals(d));  // true  — same characters
```

**String literals** appear to work with `==` because Java interns them into a shared pool:

```java
String a = "hello";
String b = "hello";
System.out.println(a == b);  // true — but only because both point to the interned literal!
```

Do **not** rely on this. Always use `.equals()` for string comparison.

**The Integer cache trap:** Java caches `Integer` objects for values −128 to 127, making `==` accidentally work for small numbers:

```java
Integer x = 127;
Integer y = 127;
System.out.println(x == y);     // true (cached — same object)

Integer p = 128;
Integer q = 128;
System.out.println(p == q);     // false (not cached — different objects)
System.out.println(p.equals(q)); // true (always use .equals())
```

**The golden rule:**
- Use `==` for primitives (`int`, `double`, `boolean`, `char`)
- Use `.equals()` for everything else (objects, strings, wrapper types)

# Object-Oriented Programming

## Classes and Encapsulation

A Java class bundles private fields with public methods that control access. Unlike Python (where `self.balance` is always accessible) and C++ (where you control access at the class level), Java enforces encapsulation at compile time.

```java
public class BankAccount {
    private String owner;    // private — only accessible within this class
    private double balance;

    public BankAccount(String owner, double initialBalance) {
        this.owner = owner;          // 'this' disambiguates field from parameter
        this.balance = initialBalance;
    }

    public void deposit(double amount) {
        if (amount > 0) {            // validation — callers can't bypass this
            balance += amount;
        }
    }

    public boolean withdraw(double amount) {
        if (amount > 0 && balance >= amount) {
            balance -= amount;
            return true;
        }
        return false;               // returns false instead of allowing overdraft
    }

    public double getBalance() { return balance; }
    public String getOwner()   { return owner; }

    // Called automatically by System.out.println(account) — like Python's __str__
    public String toString() {
        return "BankAccount[owner=" + owner + ", balance=" + balance + "]";
    }
}
```

## Access Modifiers

Java has **four** access levels. The default (no keyword) is different from C++:

| Modifier | Class | Package | Subclass | World |
|----------|:-----:|:-------:|:--------:|:-----:|
| `private` | ✓ | ✗ | ✗ | ✗ |
| *(none)* = package-private | ✓ | ✓ | ✗ | ✗ |
| `protected` | ✓ | ✓ | ✓ | ✗ |
| `public` | ✓ | ✓ | ✓ | ✓ |

> **⚠ False Friend from C++:** In C++, the default access in a `class` is `private`. In Java, the default is **package-private** — accessible to any class in the same package. Always be explicit.

In UML class diagrams: `-` means private, `+` means public, `#` means protected, `~` means package-private.

## Information Hiding

Encapsulation (using `private` fields) is a mechanism. Information hiding is a design principle.

A module **hides its secrets** — design decisions that are likely to change. When a secret is properly hidden, changing that decision modifies exactly one class. When a secret leaks, a single change cascades across many classes.

| Secret to Hide | Example | Why |
|---|---|---|
| Data representation | `int[]` vs `ArrayList` vs database | Storage format may change |
| Algorithm | Bubble sort vs quicksort | Optimization may change |
| Business rules | Grading thresholds, capacity limits | Policy may change |
| Output format | CSV vs JSON vs text | Reporting needs may change |
| External dependency | Which API or library to call | Vendor may change |

### The Getter/Setter Fallacy

Fields can be `private` and yet still leak design decisions:

```java
// Fully encapsulated — but leaking the "ISBN is an int" decision
class Book {
    private int isbn;
    public int getIsbn() { return isbn; }
    public void setIsbn(int isbn) { this.isbn = isbn; }
}
```

When the spec changes to support international ISBNs with hyphens (`String`), every caller of `getIsbn()` breaks. The module is encapsulated but hides nothing.

**Better design** — expose behavior, not data:

```java
// Hides the representation; callers depend on behavior only
class GradeReport {
    private ArrayList<Integer> scores;  // hidden

    public String getLetterGrade(int score) { ... }  // hides the grading policy
    public double getAverage()             { ... }  // hides the data representation
    public String formatReport()           { ... }  // hides the output format
}
```

> **Test for information hiding:** For each design decision, ask: "If this changes, how many classes must I edit?" If the answer is more than one, the secret has leaked.

## Interfaces: Design by Contract

An interface defines **what** a class can do, without specifying **how**. Java's philosophy:

> **Program to an interface, not an implementation.**

```java
// Defining an interface — method signatures only
public interface Shape {
    double getArea();
    double getPerimeter();
    String describe();
}

// Implementing an interface — must provide ALL methods
public class Circle implements Shape {
    private double radius;

    public Circle(double radius) { this.radius = radius; }

    public double getArea()      { return Math.PI * radius * radius; }
    public double getPerimeter() { return 2 * Math.PI * radius; }
    public String describe()     { return "Circle(r=" + radius + ")"; }
}
```

Declare variables as the **interface type** so you can swap implementations without changing calling code:

```java
Shape s = new Circle(5.0);    // interface type on the left
Shape r = new Rectangle(3, 4);
// s and r can be used interchangeably anywhere Shape is expected
```

**Compared to C++ and Python:**

| | C++ | Python | Java |
|---|---|---|---|
| Mechanism | Pure virtual functions / abstract class | Duck typing (no enforcement) | `interface` keyword, compiler-enforced |
| Multiple inheritance | Yes (`virtual` base classes) | Yes (MRO) | A class can `implement` multiple interfaces |
| Default methods | No | No | Java 8+: `default` methods can have implementations |

## Inheritance and Polymorphism

Java supports single class inheritance with abstract classes for sharing both state and behavior:

```java
// Abstract class — cannot be instantiated, may have concrete fields and methods
public abstract class Vehicle {
    private String make;
    private int year;

    public Vehicle(String make, int year) {  // abstract classes have constructors
        this.make = make;
        this.year = year;
    }

    public String getMake() { return make; }
    public int getYear()    { return year; }

    // Subclasses MUST implement these
    public abstract String describe();
    public abstract String startEngine();
}

public class Car extends Vehicle {
    private int numDoors;

    public Car(String make, int year, int numDoors) {
        super(make, year);  // MUST call parent constructor first — like C++ initializer lists
        this.numDoors = numDoors;
    }

    @Override  // optional but recommended — compiler verifies you're actually overriding
    public String describe() {
        return getYear() + " " + getMake() + " Car (" + numDoors + " doors)";
    }

    @Override
    public String startEngine() { return "Vroom!"; }
}
```

**Polymorphism** — a parent reference can point to any subclass:

```java
Vehicle[] fleet = {
    new Car("Toyota", 2024, 4),
    new Motorcycle("Harley", 2023, true),
};

for (Vehicle v : fleet) {
    System.out.println(v.describe());  // calls Car.describe() or Motorcycle.describe()
    //                                    based on the actual runtime type — dynamic dispatch
}
```

**Key differences from C++:**
- Java methods are **virtual by default** — no `virtual` keyword needed
- `@Override` annotation is optional but the compiler validates it catches typos
- `super(args)` must be the **first statement** in a constructor (C++ uses initializer lists)

**When to use interface vs abstract class:**

| | Interface | Abstract Class |
|---|---|---|
| Methods | Abstract (+ `default` in Java 8+) | Abstract AND concrete |
| Fields | Only `static final` constants | Instance fields allowed |
| Constructor | No | Yes |
| Inheritance | `implements` (multiple OK) | `extends` (single only) |
| Use when… | Unrelated classes share **behavior** | Related classes share **state + behavior** |

# Generics

## Generics: Not C++ Templates

Java generics look like C++ templates but work completely differently:

| Feature | C++ Templates | Java Generics |
|---------|--------------|---------------|
| Mechanism | Code generation (monomorphization) | Type erasure (single shared implementation) |
| Runtime type info | Yes — `vector<int>` ≠ `vector<string>` | No — `List<String>` = `List<Integer>` at runtime |
| Primitive types | Yes — `vector<int>` works | **No** — must use `List<Integer>` |
| `new T()` | Yes | **No** — type is unknown at runtime |

```java
// A generic class — T is a type parameter
public class Box<T> {
    private T item;

    public Box(T item) { this.item = item; }
    public T getItem()  { return item; }
}

// The compiler ensures type safety — no casts needed
Box<String> nameBox = new Box<>("Alice");
String name = nameBox.getItem();  // compiler knows it's String

Box<Integer> numBox = new Box<>(42);
int num = numBox.getItem();       // unboxing Integer → int
```

**Generic methods** declare their own type parameters:

```java
// <X, Y> before the return type — method's own type parameters
public static <X, Y> Pair<Y, X> swap(Pair<X, Y> pair) {
    return new Pair<>(pair.getSecond(), pair.getFirst());
}
```

**Bounded type parameters** — restrict what types are allowed:

```java
// T must implement Comparable<T> — like C++20 concepts
public static <T extends Comparable<T>> T findMax(T a, T b) {
    return a.compareTo(b) >= 0 ? a : b;
}
```

## Type Erasure

When Java 5 added generics (2004), billions of lines of pre-generics code already existed. To maintain binary compatibility, generic types are **erased after compilation**:

```java
// What you write:
List<String> names = new ArrayList<>();
String first = names.get(0);

// What the compiler generates (roughly):
List names = new ArrayList();
String first = (String) names.get(0);  // cast inserted by compiler
```

**Consequences:**
- `ArrayList<int>` is **illegal** — use `ArrayList<Integer>` instead
- `new T()` is **illegal** — type is unknown at runtime
- `if (list instanceof List<String>)` is **illegal** — generic type is erased

# Collections Framework

## Choosing the Right Collection

Java Collections are organized by **interfaces**. Declare variables as the interface type:

```
Collection
├── List        → ArrayList (resizable array), LinkedList (doubly-linked)
└── Set         → HashSet (unordered, fast), TreeSet (sorted)

Map             → HashMap (unordered, fast), TreeMap (sorted by key)
```

| Need | Interface | Implementation | Python Equivalent |
|------|-----------|---------------|-------------------|
| Ordered sequence, index access | `List<T>` | `ArrayList<T>` | `list` |
| Unique elements, fast lookup | `Set<T>` | `HashSet<T>` | `set` |
| Key-value pairs | `Map<K,V>` | `HashMap<K,V>` | `dict` |
| Sorted unique elements | `Set<T>` | `TreeSet<T>` | `sorted(set(...))` |
| Sorted key-value pairs | `Map<K,V>` | `TreeMap<K,V>` | sorted `dict` |

**C++ mapping:** `vector` → `ArrayList`, `unordered_map` → `HashMap`, `map` → `TreeMap`, `unordered_set` → `HashSet`.

## Common Operations

```java
// List — like Python list or C++ vector
List<String> names = new ArrayList<>();
names.add("Alice");              // append
names.add(0, "Bob");             // insert at index
String first = names.get(0);    // index access
names.size();                   // NOT .length — that's arrays!

// Map — like Python dict or C++ unordered_map
Map<String, Integer> scores = new HashMap<>();
scores.put("Alice", 95);        // insert or update
scores.get("Alice");            // lookup — returns null if missing!
scores.containsKey("Alice");    // check existence — always do this before get()
scores.getOrDefault("Bob", 0);  // safe lookup with a default

// Set — like Python set or C++ unordered_set
Set<String> unique = new HashSet<>();
unique.add("Alice");
unique.add("Alice");            // silently ignored — already present
unique.contains("Alice");       // true
unique.size();                  // 1

// Iterating a Map
for (Map.Entry<String, Integer> entry : scores.entrySet()) {
    System.out.println(entry.getKey() + ": " + entry.getValue());
}
```

> **⚠ NullPointerException trap:** `HashMap.get(key)` returns `null` for missing keys. If you assign the result directly to a primitive (`int val = map.get("missing")`), auto-unboxing `null` throws `NullPointerException`. Always use `containsKey()` first, or `getOrDefault()`.

**Declare as the interface type** — this lets you swap implementations without changing callers:

```java
// ✓ Interface type — can swap to TreeMap later with no other changes
Map<String, Integer> scores = new HashMap<>();

// ✗ Concrete type — callers break if you switch to TreeMap
HashMap<String, Integer> scores = new HashMap<>();
```

# Exception Handling

## Checked vs Unchecked Exceptions

Java is unique in dividing exceptions into two categories:

| Category | Extends | Compiler enforcement | Use for |
|----------|---------|---------------------|---------|
| **Checked** | `Exception` (but not `RuntimeException`) | Must catch or declare `throws` | Recoverable external failures (file not found, network error) |
| **Unchecked** | `RuntimeException` | No enforcement | Programming errors (null pointer, bad index, bad argument) |
| **Error** | `Error` | No enforcement | JVM failures — never catch these |

```java
// Checked: compiler forces handling
public String readFile(String path) throws IOException {
    // ... might throw IOException
}

// Callers MUST handle it — the compiler won't let them ignore it
try {
    String content = readFile("data.txt");
} catch (IOException e) {
    System.err.println("File error: " + e.getMessage());
}

// Unchecked: no compiler enforcement (like Python/C++)
public int divide(int a, int b) {
    return a / b;  // might throw ArithmeticException — compiler doesn't require handling
}
```

**Compared to Python and C++:**

| | Python | C++ | Java |
|---|---|---|---|
| Philosophy | EAFP — catch freely | Exceptions are expensive; prefer error codes | Checked exceptions = compiler-enforced contract |
| Enforcement | None — errors discovered at runtime | `noexcept` exists but rarely enforced | Compiler rejects unhandled checked exceptions |

## Custom Exceptions

```java
// Checked custom exception — extends Exception
public class InsufficientFundsException extends Exception {
    private double deficit;

    public InsufficientFundsException(double deficit) {
        super("Insufficient funds: need " + deficit + " more");  // like Python's super().__init__
        this.deficit = deficit;
    }

    public double getDeficit() { return deficit; }
}

// Usage
public boolean withdraw(double amount) throws InsufficientFundsException {
    if (amount > balance) {
        throw new InsufficientFundsException(amount - balance);
    }
    balance -= amount;
    return true;
}
```

**Multiple catch blocks** — catch specific exceptions before general ones:

```java
try {
    String content = readFile("data.txt");
    int value = Integer.parseInt(content.trim());
} catch (FileNotFoundException e) {
    System.err.println("File missing: " + e.getMessage());
} catch (IOException e) {
    System.err.println("Read error: " + e.getMessage());
} catch (NumberFormatException e) {
    System.err.println("Not a number: " + e.getMessage());
} finally {
    // runs whether or not an exception was thrown — use for cleanup
    closeResources();
}
```

# Design Principles

## Top 10 Java Best Practices

#### 1. Always use `.equals()` for object comparison, never `==`

```java
// ✓ Always correct
if (name.equals("Alice")) { ... }
if (a.equals(b)) { ... }

// ✗ Compares identity — will fail with new String("Alice")
if (name == "Alice") { ... }
```

The same applies to all wrapper types (`Integer`, `Double`, etc.) and any object.

#### 2. Make fields `private`; validate in setters and constructors

```java
// ✓ Encapsulation with validation — callers can't bypass the contract
public void deposit(double amount) {
    if (amount > 0) {
        balance += amount;
    }
}

// ✗ Public fields let callers bypass all validation
public double balance;
```

#### 3. Use primitives for accumulation, wrappers only when required

```java
// ✓ Primitive — no boxing overhead
int sum = 0;
for (int score : scores) { sum += score; }

// ✗ Boxing every iteration — slower and allocates garbage
Integer sum = 0;
for (int score : scores) { sum += score; }  // boxes sum on every iteration
```

Use wrapper types only when required: generics (`List<Integer>`), nullable values, or calling methods (`.compareTo()`).

#### 4. Declare variables as interface types, not concrete classes

```java
// ✓ Interface type — easy to swap implementation
List<String> names = new ArrayList<>();
Map<String, Integer> scores = new HashMap<>();

// ✗ Concrete type — caller breaks if you switch to LinkedList or TreeMap
ArrayList<String> names = new ArrayList<>();
```

#### 5. Program to the interface, not the implementation

Design method parameters and return types as interfaces. This enables polymorphism and makes code easier to test:

```java
// ✓ Accepts any List — works with ArrayList, LinkedList, etc.
public double average(List<Integer> scores) { ... }

// ✗ Unnecessarily restricts callers to ArrayList
public double average(ArrayList<Integer> scores) { ... }
```

#### 6. Use `@Override` when overriding methods

`@Override` is optional, but it tells the compiler to verify that you're actually overriding a parent method. Without it, a typo in the method name silently creates a new method instead of overriding:

```java
@Override
public String toString() { ... }   // compiler error if toString is misspelled
```

#### 7. Handle checked exceptions at the right level

Don't catch exceptions before you can actually handle them. If a method can't recover from a failure, let it propagate:

```java
// ✓ Handle it where you can do something useful
try {
    loadConfig("config.txt");
} catch (IOException e) {
    loadDefaults();  // meaningful recovery
}

// ✗ Swallowing exceptions hides bugs — never do this
try {
    loadConfig("config.txt");
} catch (IOException e) {
    // empty — the problem disappears silently
}
```

#### 8. Use `getOrDefault()` instead of null checks on Maps

```java
// ✓ Safe and concise
int count = scores.getOrDefault("Alice", 0);

// ✗ Verbose null check
int count = 0;
if (scores.containsKey("Alice")) {
    count = scores.get("Alice");
}
```

#### 9. Hide design decisions behind stable interfaces (Parnas 1972)

Each class should hide a **secret** — a design decision likely to change. When something changes, exactly one class changes:

```java
// ✓ Secret (grading policy) is hidden — change thresholds by editing one method
public String getLetterGrade(int score) {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    ...
}

// ✗ Grading policy leaks into calling code — changes require editing many places
if (score >= 90) letter = "A";  // in main, not in GradeReport
```

#### 10. Choose the right collection for the job

| If you need… | Use |
|---|---|
| Ordered sequence with index access | `ArrayList<T>` |
| Fast membership testing | `HashSet<T>` |
| Key-to-value mapping with fast lookup | `HashMap<K,V>` |
| Sorted elements | `TreeSet<T>` or `TreeMap<K,V>` |
| Deduplication | `HashSet<T>` — add freely, duplicates are ignored |

{% include quiz.html id="java" %}
