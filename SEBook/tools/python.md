---
title: Python
layout: sebook
---


> **Want to practice?** Try the [Official Python Tutorial](https://docs.python.org/3/tutorial/) — Run it directly on your own machine.


Welcome to Python! Since you already know C++, you have a strong foundation in programming logic, control flow, and object-oriented design. However, moving from a compiled, statically typed systems language to an interpreted, dynamically typed scripting language requires a shift in how you think about memory and execution. 

To help you make this transition, we will anchor Python's concepts directly against the C++ concepts you already know, adjusting your mental model along the way.

### The Execution Model: Scripts vs. Binaries

In C++, your workflow is **Write $\rightarrow$ Compile $\rightarrow$ Link $\rightarrow$ Execute**. The compiler translates your source code directly into machine-specific instructions. 

Python is a **scripting language**. You do not explicitly compile and link a binary. Instead, your workflow is simply **Write $\rightarrow$ Execute**. 

Under the hood, when you run `python script.py`, the Python interpreter reads your code, translates it into an intermediate "bytecode," and immediately runs that bytecode on the Python Virtual Machine (PVM). 


**What this means for you:**
* **No `main()` boilerplate:** Python executes from top to bottom. You don't *need* a `main()` function to make a script run, though it is often used for organization.
* **Rapid Prototyping:** Because there is no compilation step, you can write and test code iteratively and quickly.
* **Runtime Errors:** In C++, the compiler catches syntax and type errors before the program ever runs. In Python, errors are caught *at runtime* when the interpreter actually reaches the problematic line.

**C++:**
```cpp
#include <iostream>
int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}
```

**Python:**
```python
print("Hello, World!")
```

### The Mental Model of Memory: Dynamic Typing

This is the largest paradigm shift you will make.

In C++ (Statically Typed), a variable is a **box in memory**. When you declare `int x = 5;`, the compiler reserves 4 bytes of memory, labels that specific memory address `x`, and restricts it to only hold integers.

In Python (Dynamically Typed), a variable is a **name tag** attached to an object. The *object* has a type, but the *variable name* does not.

You can inspect the type of any object at runtime using the built-in `type()` function:

```python
x = 42
print(type(x))        # <class 'int'>

x = "hello"
print(type(x))        # <class 'str'>

x = 3.14
print(type(x))        # <class 'float'>
```

This is useful for debugging, but note that checking types explicitly is often un-Pythonic — prefer Duck Typing (see below) for production code.



**Let's look at an example:**

```python
x = 5         # Python creates an integer object '5'. It attaches the name tag 'x' to it.
print(x)      

x = "Hello"   # Python creates a string object '"Hello"'. It moves the 'x' tag to the string.
print(x)      # The integer '5' is now nameless and will be garbage collected.
```

Because variables are just name tags (references) pointing to objects, you don't declare types. The Python interpreter figures out the type of the object at runtime. 

### Syntax and Scoping: Whitespace Matters

In C++, scope is defined by curly braces `{}` and statements are terminated by semicolons `;`. 

Python uses **indentation** to define scope, and **newlines** to terminate statements. This enforces highly readable code by design. The PEP 8 standard mandates **4 spaces** per level — never mix tabs and spaces, as this causes an `IndentationError` at runtime that can be hard to diagnose (tabs and spaces look identical in many editors).

**C++:**
```cpp
for (int i = 0; i < 5; i++) {
    if (i % 2 == 0) {
        std::cout << i << " is even\n";
    }
}
```

**Python:**
```python
for i in range(5):
    if i % 2 == 0:
        print(f"{i} is even") # Notice the 'f' string, Python's modern way to format strings
```
The `range()` function generates a sequence of integers and has three forms:
* `range(stop)` — from 0 up to (but not including) `stop`: `range(5)` → 0, 1, 2, 3, 4
* `range(start, stop)` — from `start` up to (not including) `stop`: `range(2, 6)` → 2, 3, 4, 5
* `range(start, stop, step)` — with a custom stride: `range(0, 10, 2)` → 0, 2, 4, 6, 8; `range(5, 0, -1)` → 5, 4, 3, 2, 1

### ⚠️ Scoping: The LEGB Rule (A "False Friend" from C++)

In C++, a variable declared inside a `for` or `if` block is scoped to that block. In Python, **variables created inside a loop or `if` block are visible in the enclosing function scope** — there are no block-level scopes. This is one of the most common "false friend" traps for C++ programmers.

```python
for i in range(5):
    last = i

print(last)  # 4 — 'last' and 'i' are STILL accessible here!
# In C++, this would be a compile error: 'last' was declared inside the for block
```

Python resolves variable names using the **LEGB rule** — it searches scopes in this order:

1. **L**ocal — inside the current function
2. **E**nclosing — inside enclosing functions (for nested functions/closures)
3. **G**lobal — module-level
4. **B**uilt-in — Python's built-in names (`print`, `len`, etc.)

```python
x = "global"

def outer():
    x = "enclosing"

    def inner():
        x = "local"
        print(x)    # "local" — L wins

    inner()
    print(x)        # "enclosing" — E level

outer()
print(x)            # "global" — G level
```

**Key difference from C++:** If you want to *modify* a variable from an enclosing scope, you must use the `nonlocal` (for enclosing functions) or `global` keyword. Without it, Python creates a new local variable instead of modifying the outer one.

### Defining Functions with `def`

Python functions are defined with the `def` keyword. Unlike C++, there is no return type declaration — the function just returns whatever the `return` statement provides, or `None` implicitly if there is no `return`.

```python
# Basic function — no type declarations needed
def greet(name):
    return f"Hello, {name}!"

print(greet("Alice"))   # Hello, Alice!
```

**Default Parameters**: Parameters can have default values, making them optional at the call site:

```python
def greet(name, greeting="Hello"):
    return f"{greeting}, {name}!"

print(greet("Alice"))            # Hello, Alice!
print(greet("Bob", "Hi"))        # Hi, Bob!
```

**Implicit `None` Return**: A function with no `return` statement (or a bare `return`) returns `None`, Python's equivalent of `void`:

```python
def log_message(msg):
    print(msg)
    # No return — implicitly returns None

result = log_message("test")
print(result)   # None
```

**Docstrings**: The Python convention for documenting functions is a triple-quoted string immediately after the `def` line. Tools and IDEs display this as help text:

```python
def calculate_area(width, height):
    """Return the area of a rectangle given its width and height."""
    return width * height
```

**Type Hints** *(optional)*: Python 3.5+ supports optional type annotations. They are not enforced at runtime but improve readability and enable static analysis tools:

```python
def add(x: int, y: int) -> int:
    return x + y
```

### Passing Arguments: "Pass-by-Object-Reference"

In C++, you explicitly choose whether to pass variables by value (`int x`), by reference (`int& x`), or by pointer (`int* x`). 

How does Python handle this? Because *everything* in Python is an object, and variables are just "name tags" pointing to those objects, Python uses a model often called **"Pass-by-Object-Reference"**. 

When you pass a variable to a function, you are passing the *name tag*. 
* If the object the tag points to is **Mutable** (like a List or a Dictionary), changes made inside the function *will* affect the original object.
* If the object the tag points to is **Immutable** (like an Integer, String, or Tuple), any attempt to change it inside the function simply creates a *new* object and moves the local name tag to it, leaving the original object unharmed.

```python
# Modifying a Mutable object (similar to passing by reference/pointer in C++)
def modify_list(my_list):
    my_list.append(4) # Modifies the actual object in memory

nums = [1, 2, 3]
modify_list(nums)
print(nums) # Output: [1, 2, 3, 4]

# Modifying an Immutable object (behaves similarly to pass by value)
def attempt_to_modify_int(my_int):
    my_int += 10 # Creates a NEW integer object, moves the local 'my_int' tag to it

val = 5
attempt_to_modify_int(val)
print(val) # Output: 5. The original object is unchanged.
```


### String Formatting: The Magic of f-strings

In C++, building a complex string with variables traditionally requires chaining `<<` operators with `std::cout`, using `sprintf`, or utilizing the modern `std::format`. This can get verbose quickly.

Python revolutionized string formatting in version 3.6 with the introduction of **f-strings** (formatted string literals). By simply prefixing a string with the letter `f` (or `F`), you can embed variables and even evaluate expressions directly inside curly braces `{}`.

**C++:**
```cpp
std::string name = "Alice";
int age = 30;
std::cout << name << " is " << age << " years old and will be " 
          << (age + 1) << " next year.\n";
```

**Python:**
```python
name = "Alice"
age = 30

# The f-string automatically converts variables to strings and evaluates the math
print(f"{name} is {age} years old and will be {age + 1} next year.")
```
*Pedagogical Note:* Under the hood, Python calls the `__str__()` method of the objects placed inside the curly braces to get their string representation.


### String Quotes: `"..."` and `'...'` Are Interchangeable

In C++, single quotes and double quotes mean completely different things: `'A'` is a `char`, while `"Alice"` is a `const char*` (or `std::string`). Mixing them up is a compile error.

In Python, **there is no `char` type** — single quotes and double quotes both create `str` objects and are fully interchangeable:

```python
name = "Alice"    # str
name = 'Alice'    # also str — identical result
```

This is especially handy when your string itself contains quotes, because you can pick whichever style avoids escaping:

```python
msg = "It's easy"          # double quotes avoid escaping the apostrophe
html = '<div class="box">' # single quotes avoid escaping the double quotes
```

In C++ you would need to escape: `"It\'s easy"` or `"<div class=\"box\">"`. Python lets you sidestep the backslashes entirely by choosing the other quote style.

> **Convention:** PEP 8 accepts either style but recommends picking one and being consistent throughout a project. Both are equally common in the wild.

### Common String Methods

Python strings come with a rich set of built-in methods (no `#include` required). Unlike C++ where `std::string` methods are relatively few, Python strings behave more like a full text-processing library:

```python
text = "  Hello, World!  "

# Case conversion
print(text.upper())        # "  HELLO, WORLD!  "
print(text.lower())        # "  hello, world!  "

# Whitespace removal
print(text.strip())        # "Hello, World!"  (both ends)
print(text.lstrip())       # "Hello, World!  " (left end only)
print(text.rstrip())       # "  Hello, World!" (right end only)

# Splitting — returns a list of substrings
csv_line = "Alice,90,B+"
fields = csv_line.split(",")      # ['Alice', '90', 'B+']

log = "error: disk full\nwarning: low memory\n"
lines = log.splitlines()          # ['error: disk full', 'warning: low memory']

# Splitting on whitespace (default) collapses multiple spaces:
words = "  hello   world  ".split()   # ['hello', 'world']

# Checking content
print("hello".startswith("he"))   # True
print("hello".endswith("lo"))     # True
print("ell" in "hello")           # True

# Replacement
print("foo bar foo".replace("foo", "baz"))  # "baz bar baz"
```

`strip()` is especially important when reading files — lines from a file end with `\n`, so stripping removes the trailing newline before processing.

### Core Collections: Lists, Sets, and Dictionaries

Because Python does not enforce static typing, its built-in collections are highly flexible. You do not need to `#include` external libraries to use them; they are native to the language syntax. 

#### Lists (C++ Equivalent: `std::vector`)
A List is an ordered, mutable sequence of elements. Unlike a C++ `std::vector<T>`, a Python list can contain objects of entirely different types. Lists are defined using square brackets `[]`.

```python
# Heterogeneous list
my_list = [1, "two", 3.14, True]

my_list.append("new item") # Adds to the end (like push_back)
my_list.pop()              # Removes and returns the last item

# Other common operations
my_list.remove("two")      # Removes the first occurrence of "two" (like std::remove + erase)
my_list.clear()            # Empties the entire list (like std::vector::clear)

print(len(my_list))        # len() gets the size of any collection (Output: 0)
```

#### Sets (C++ Equivalent: `std::unordered_set`)
A Set is an unordered collection of unique elements. It is implemented using a hash table, making membership testing (`in`) exceptionally fast—$O(1)$ on average. Sets are defined using curly braces `{}`, or by passing any iterable to the `set()` constructor.

```python
unique_numbers = {1, 2, 2, 3, 4, 4}
print(unique_numbers) # Output: {1, 2, 3, 4} - duplicates are automatically removed

# Fast membership testing
if 3 in unique_numbers:
    print("3 is present!")

# Deduplication idiom — convert a list to a set and back:
words = ["apple", "banana", "apple", "cherry", "banana"]
unique_words = list(set(words))  # removes duplicates (order not preserved)

# Count unique items:
ip_list = ["10.0.0.1", "10.0.0.2", "10.0.0.1"]
print(len(set(ip_list)))  # 2 — number of distinct IP addresses
```

#### Dictionaries (C++ Equivalent: `std::unordered_map`)
A Dictionary (or "dict") is a mutable collection of key-value pairs. Like Sets, they are backed by hash tables for incredibly fast $O(1)$ lookups. Dicts are defined using curly braces `{}` with a colon `:` separating keys and values.

```python
player_scores = {"Alice": 50, "Bob": 75}

# Accessing and modifying values
player_scores["Alice"] += 10 
player_scores["Charlie"] = 90 # Adding a new key-value pair

print(f"Bob's score is {player_scores['Bob']}")
```

#### "Pythonic" Iteration

While C++ traditionally relies on index-based `for` loops (though modern C++ has range-based loops), Python strongly encourages iterating *directly* over the elements of a collection. This is considered writing "Pythonic" code.

**C++ (Index-based iteration):**
```cpp
std::vector<std::string> fruits = {"apple", "banana", "cherry"};
for (size_t i = 0; i < fruits.size(); i++) {
    std::cout << fruits[i] << std::endl;
}
```

**Python (Pythonic Iteration):**
```python
fruits = ["apple", "banana", "cherry"]

# Do not do: for i in range(len(fruits)): ...
# Instead, iterate directly over the object:
for fruit in fruits:
    print(fruit)

# Iterating over dictionary key-value pairs:
student_grades = {"Alice": 95, "Bob": 82}

for name, grade in student_grades.items():
    print(f"{name} scored {grade}")
```

### Memory Management: RAII vs. Garbage Collection

In C++, you are the absolute master of memory. You allocate it (`new`), you free it (`delete`), or you utilize RAII (Resource Acquisition Is Initialization) and smart pointers to tie memory management to variable scope. If you make a mistake, you get a memory leak or a segmentation fault.

In Python, memory management is entirely abstracted away. You do not allocate or free memory. Instead, Python primarily uses **Reference Counting** backed by a **Garbage Collector**. 

Every object in Python keeps a running tally of how many "name tags" (variables or references) are pointing to it. When a variable goes out of scope, or is reassigned to a different object, the reference count of the original object decreases by one. When that count hits zero, Python immediately reclaims the memory. 



**C++ (Manual / RAII):**
```cpp
void createArray() {
    // Dynamically allocated, must be managed
    int* arr = new int[100]; 
    // ... do something ...
    delete[] arr; // Forget this and you leak memory!
}
```

**Python (Automatic):**
```python
def create_list():
    # Creates a list object in memory and attaches the 'arr' tag
    arr = [0] * 100 
    # ... do something ...
    
    # When the function ends, 'arr' goes out of scope. 
    # The list object's reference count drops to 0, and memory is freed automatically.
```


### Object-Oriented Programming: Explicit `self` and "Duck Typing"

If you are used to C++ classes, Python's approach to OOP will feel radically open and simplified. 

1. **No Header Files:** Everything is declared and defined in one place.
2. **Explicit `self`:** In C++, instance methods have an implicit `this` pointer. In Python, the instance reference is passed *explicitly* as the first parameter to every instance method. By convention, it is always named `self`.
3. **No True Privacy:** C++ enforces `public`, `private`, and `protected` access specifiers at compile time. Python operates on the philosophy of "we are all consenting adults here." There are no true private variables. Instead, developers use a *convention*: prefixing a variable with a single underscore (e.g., `_internal_state`) signals to other developers, "This is meant for internal use, please don't touch it," but the language will not stop them from accessing it.
4. **Duck Typing:** In C++, if a function expects a `Bird` object, you must pass an object that inherits from `Bird`. Python relies on "Duck Typing"—*If it walks like a duck and quacks like a duck, it must be a duck.* Python doesn't care about the object's actual class hierarchy; it only cares if the object implements the methods being called on it.



**C++:**
```cpp
class Rectangle {
private:
    int width, height; // Enforced privacy
public:
    Rectangle(int w, int h) : width(w), height(h) {} // Constructor
    
    int getArea() {
        return width * height; // 'this->' is implicit
    }
};
```

**Python:**
```python
class Rectangle:
    # __init__ is Python's constructor. 
    # Notice 'self' must be explicitly declared in the parameters.
    def __init__(self, width, height):
        self._width = width   # The underscore is a convention meaning "private"
        self._height = height # but it is not strictly enforced by the interpreter.

    def get_area(self):
        # You must explicitly use 'self' to access instance variables
        return self._width * self._height

# Instantiating the object (Note: no 'new' keyword in Python)
my_rect = Rectangle(10, 5)
print(my_rect.get_area())
```



### Dunder Methods: `__str__` vs. `operator<<`
In the OOP section, we covered the `__init__` constructor method. Python uses several of these "dunder" (double underscore) methods to implement core language behavior.

In C++, if you want to print an object using `std::cout`, you have to overload the `<<` operator. In Python, you simply implement the `__str__(self)` method. This method returns a "user-friendly" string representation of the object, which is automatically called whenever you use `print()` or an f-string.

**Python:**
```python
class Book:
    def __init__(self, title, author, year):
        self.title = title
        self.author = author
        self.year = year
        
    def __str__(self):
        # This is what print() will call
        return f'"{self.title}" by {self.author} ({self.year})'

my_book = Book("Pride and Prejudice", "Jane Austen", 1813)
print(my_book) # Output: "Pride and Prejudice" by Jane Austen (1813)
```


### Substring Operations and Slicing

In C++, if you want a substring, you call `my_string.substr(start_index, length)`. Python takes a much more elegant and generalized approach called **Slicing**. 

Slicing works not just on strings, but on *any* ordered sequence (like Lists and Tuples). The syntax uses square brackets with colons: `sequence[start:stop:step]`.

* `start`: The index where the slice begins (inclusive).
* `stop`: The index where the slice ends (**exclusive**).
* `step`: The stride between elements (optional, defaults to 1).

**Negative Indexing:** This is a crucial Python paradigm. While index `0` is the first element, index `-1` is the *last* element, `-2` is the second-to-last, and so on.

```python
text = "Software Engineering"

# Basic slicing
print(text[0:8])    # Output: 'Software' (Indices 0 through 7)

# Omitting start or stop
print(text[:8])     # Output: 'Software' (Defaults to the very beginning)
print(text[9:])     # Output: 'Engineering' (Defaults to the very end)

# Negative indexing
print(text[-11:])   # Output: 'Engineering' (Starts 11 characters from the end)
print(text[-1])     # Output: 'g' (The last character)

# Using the step parameter
print(text[0:8:2])  # Output: 'Sfwr' (Every 2nd character of 'Software')

# The ultimate Pythonic trick: Reversing a sequence
print(text[::-1])   # Output: 'gnireenignE erawtfoS' (Steps backwards by 1)
```

Because variables in Python are references to objects, it is important to note that slicing a list or a string creates a **shallow copy**—a brand new object in memory containing the sliced elements.



### Tuple Unpacking and Variable Swapping
The lecture introduces the concept of **Syntactic Sugar**—language features that don't add new functional capabilities but make programming significantly easier and more readable. 

A prime example is unpacking. In C++, swapping two variables requires a temporary third variable (or utilizing `std::swap`). Python handles this natively with multiple assignment.

**C++:**
```cpp
int temp = a;
a = b;
b = temp;
```

**Python:**
```python
a, b = b, a # Syntactic sugar that swaps the values instantly
```

### Exception Handling: `try` / `except`
While we discussed that Python catches errors at runtime, the Week 2 materials highlight how to handle these errors gracefully using `try` and `except` blocks (Python's equivalent to C++'s `try` and `catch`).

In C++, exceptions are often reserved for critical failures, but in Python, using exceptions for control flow (like catching a `ValueError` when a user inputs a string instead of an integer) is standard practice.

```python
try:
    guess = int(input("> "))
except ValueError:
    print("Invalid input, please enter a number.")
```

#### EAFP vs. LBYL: A Python Philosophy Shift

In C++, the standard approach is **LBYL** — "Look Before You Leap": check preconditions before performing an operation (e.g., check if a key exists before accessing it). Python encourages the opposite: **EAFP** — "Easier to Ask Forgiveness than Permission": just try the operation and handle the exception if it fails.

```python
# C++ instinct (LBYL — Look Before You Leap):
if "key" in my_dict:
    value = my_dict["key"]
else:
    value = "default"

# Pythonic (EAFP — Easier to Ask Forgiveness than Permission):
try:
    value = my_dict["key"]
except KeyError:
    value = "default"

# Even more Pythonic — dict.get() with a default:
value = my_dict.get("key", "default")
```

EAFP is idiomatic Python because exceptions are cheap in Python (unlike C++, where they are expensive). Using `try/except` for expected cases like missing dictionary keys or file-not-found is standard practice, not an anti-pattern.

#### Common Built-in Exception Types

Knowing the standard exception types makes it easier to write targeted `except` clauses and understand error messages:

| Exception | When it occurs |
|---|---|
| `SyntaxError` | Code that cannot be parsed — caught before execution |
| `IndentationError` | Inconsistent indentation (e.g., mixed tabs and spaces) |
| `TypeError` | Operation on incompatible types (e.g., `"5" + 3`) |
| `ValueError` | Right type but inappropriate value (e.g., `int("hello")`) |
| `IndexError` | Sequence index out of range (e.g., `my_list[99]` on a short list) |
| `KeyError` | Dictionary key does not exist (e.g., `d["missing"]`) |
| `FileNotFoundError` | `open()` called on a path that does not exist |
| `ZeroDivisionError` | Division or modulo by zero |
| `AttributeError` | Accessing a non-existent attribute on an object |

### Robust Command-Line Arguments (`argparse`)
In C++, you typically handle command-line inputs by parsing `int argc` and `char* argv[]` directly in `main()`. While Python *does* have a direct equivalent (`sys.argv`), the course materials emphasize using the built-in `argparse` module. It automatically generates help/usage messages, enforces types, and parses flags, saving you from writing boilerplate C++ parsing code.

### Division Operators: `/` vs `//`

A common negative-transfer trap from C++: in C++, `7 / 2` gives `3` (integer division when both operands are ints). In Python 3, `/` **always** returns a float:

```python
7 / 2     # 3.5  (float division — different from C++!)
7 // 2    # 3    (integer/floor division — like C++'s /)
7 % 2     # 1    (modulo — same as C++)
```

Use `//` when you explicitly want integer division. Use `/` when you want precise results.

### The `**` Exponentiation Operator

Python uses `**` for exponentiation. In C++ you would use `pow()` or `std::pow()`. Be careful: `^` is **bitwise XOR** in Python, not exponentiation:

```python
2 ** 8    # 256  ✓  (exponentiation)
9 ** 0.5  # 3.0  ✓  (square root)
2 ^ 8     # 10   ✗  (bitwise XOR — NOT exponentiation!)
```

### Dynamic ≠ Weak: Python's Strong Typing

Python is **dynamically** typed (you don't declare types) but also **strongly** typed (it won't silently convert between incompatible types). This is different from JavaScript, which is dynamically typed AND weakly typed:

```python
x = "5" + 3    # TypeError: can only concatenate str to str
```

Unlike JavaScript (which would give `"53"`), Python refuses to guess. You must be explicit: `int("5") + 3` → `8` or `"5" + str(3)` → `"53"`.


### `enumerate()` — Index and Value Together

In C++ you use index-based loops to get both the position and the value. Python's `enumerate()` provides this more elegantly:

```python
fruits = ["apple", "banana", "cherry"]

# Instead of: for i in range(len(fruits)): ...
for i, fruit in enumerate(fruits):
    print(f"{i}: {fruit}")
```

### List Comprehensions

List comprehensions are a compact, idiomatic way to build lists in Python — a pattern you will see everywhere in Python code:

```python
# C++ equivalent:
# std::vector<int> squares;
# for (int i = 1; i <= 5; i++) squares.push_back(i * i);

# Python: one line
squares = [x**2 for x in range(1, 6)]          # [1, 4, 9, 16, 25]

# With a filter condition:
evens = [x for x in range(10) if x % 2 == 0]   # [0, 2, 4, 6, 8]
```

The general form is `[expression for variable in iterable if condition]`. Use comprehensions when the transformation is simple — they are more readable and slightly faster than equivalent `for` loops.

#### Generator Expressions: Lazy Comprehensions

Replacing the square brackets `[...]` with parentheses `(...)` creates a **generator expression** — it produces values one at a time (lazy evaluation) instead of building the entire list in memory:

```python
# List comprehension — builds a full list in memory:
squares = [x**2 for x in range(1_000_000)]      # ~8 MB in memory

# Generator expression — produces values on demand:
squares = (x**2 for x in range(1_000_000))       # near-zero memory
```

Use generators when you only need to iterate once and don't need to store the full collection — for example, passing directly to `sum()`, `max()`, or a `for` loop.


### Reading Files with `open()` and `with`

In C++ you `fopen`, check for `NULL`, process, and `fclose`. Python's `with` statement handles the close automatically — even if an exception occurs:

```python
# C++: FILE *f = fopen("data.txt", "r"); ... fclose(f);

# Python — the 'with' block closes the file automatically:
with open("data.txt") as f:
    for line in f:
        print(line.strip())   # .strip() removes the trailing newline
```

There are several ways to read a file's content depending on your needs:

```python
with open("data.txt") as f:
    content = f.read()              # Entire file as one string
    lines = content.splitlines()    # Split into a list of lines (no trailing \n)

with open("data.txt") as f:
    lines = f.readlines()           # List of lines, each ending with \n

with open("data.txt") as f:
    for line in f:                  # Memory-efficient: one line at a time
        process(line.strip())
```

Prefer iterating line-by-line for large files — `f.read()` loads the entire file into memory at once, which can be problematic for gigabyte-scale logs.

The `with` statement is Python's **context manager** idiom — just like RAII in C++, the file is guaranteed to be closed when the block exits. This also works with database connections, locks, and other resources.

### Command-Line Arguments with `sys.argv` and `sys.stderr`

C++'s `argc`/`argv` maps directly to Python's `sys.argv`:

```python
import sys

# sys.argv[0] is the script name (like argv[0] in C++)
# sys.argv[1], [2], ... are the arguments

if len(sys.argv) < 2:
    print("Error: no filename given", file=sys.stderr)  # stderr, like std::cerr
    sys.exit(1)                                          # exit code 1, like exit(1)

filename = sys.argv[1]
```

`print()` writes to stdout by default. Use `file=sys.stderr` to send error messages to stderr, keeping output and diagnostics separate — the same reason C++ separates `std::cout` from `std::cerr`.


### Regular Expressions (`re` module)
Since Python is a scripting language, it is heavily utilized for text processing. Python's built-in `re` module provides the same power as `grep` and `sed` inside a script:

```python
import re

text = "Error 404: page not found. Error 500: server crash."

# re.search() — find the FIRST match (like grep -q)
m = re.search(r'Error \d+', text)
if m:
    print(m.group())     # "Error 404"

# re.findall() — find ALL matches (like grep -o)
codes = re.findall(r'\d+', text)   # ['404', '500']

# re.sub() — replace matches (like sed 's/old/new/g')
clean = re.sub(r'Error \d+', 'ERR', text)
# "ERR: page not found. ERR: server crash."
```

Always use raw strings (`r'...'`) for regex patterns — they prevent Python from interpreting backslashes before the `re` module sees them.

### Top 10 Python Best Practices

These are the most important conventions and idioms that experienced Python programmers follow. Internalizing them will make your code more readable, less error-prone, and immediately recognizable as "Pythonic."

#### 1. Use f-Strings for String Formatting

F-strings (Python 3.6+) are the preferred way to embed values in strings. They are faster, more readable, and more concise than older approaches.

```python
name = "Alice"
score = 95.678

# ✓ Pythonic: f-string
print(f"{name} scored {score:.1f}")

# ✗ Avoid: concatenation (verbose, error-prone with types)
print(name + " scored " + str(round(score, 1)))

# ✗ Avoid: %-formatting (old Python 2 style)
print("%s scored %.1f" % (name, score))
```

#### 2. Use `with` for Resource Management

The `with` statement guarantees cleanup (closing files, releasing locks) even if an exception occurs — just like RAII in C++.

```python
# ✓ Pythonic: guaranteed close
with open("data.txt") as f:
    content = f.read()

# ✗ Avoid: manual close (leaks on exception)
f = open("data.txt")
content = f.read()
f.close()
```

#### 3. Iterate Directly Over Collections

Python's `for` loop iterates over *items*, not indices. Never use `range(len(...))` when you only need the elements.

```python
fruits = ["apple", "banana", "cherry"]

# ✓ Pythonic: iterate directly
for fruit in fruits:
    print(fruit)

# ✗ Avoid: C-style index loop
for i in range(len(fruits)):
    print(fruits[i])
```

#### 4. Use `enumerate()` When You Need the Index

When you need both the index and the value, `enumerate()` is the Pythonic solution.

```python
# ✓ Pythonic: enumerate
for i, fruit in enumerate(fruits):
    print(f"{i}: {fruit}")

# ✗ Avoid: manual counter
i = 0
for fruit in fruits:
    print(f"{i}: {fruit}")
    i += 1
```

#### 5. Follow PEP 8 Naming Conventions

Consistent naming makes Python code instantly readable across any project.

| Entity | Convention | Example |
|---|---|---|
| Variables, functions | `snake_case` | `total_count`, `get_area()` |
| Classes | `PascalCase` | `HttpResponse`, `Rectangle` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `DEFAULT_PORT` |
| "Private" attributes | Leading underscore | `_internal_state` |

#### 6. Use List Comprehensions for Simple Transformations

List comprehensions are more concise and slightly faster than equivalent `for` + `append` loops. Use them when the logic is simple and fits on one line.

```python
# ✓ Pythonic: list comprehension
squares = [x**2 for x in range(10)]
evens = [x for x in numbers if x % 2 == 0]

# ✗ Avoid for simple cases: explicit loop
squares = []
for x in range(10):
    squares.append(x**2)
```

**When to stop:** If the comprehension needs nested loops or complex logic, use a regular `for` loop instead — readability always wins.

#### 7. Catch Specific Exceptions

Never use bare `except:` or `except Exception:`. Catching too broadly hides real bugs and makes debugging much harder.

```python
# ✓ Pythonic: specific exception
try:
    value = int(user_input)
except ValueError:
    print("Please enter a valid integer")

# ✗ Avoid: bare except (catches everything, including KeyboardInterrupt)
try:
    value = int(user_input)
except:
    print("Something went wrong")
```

#### 8. Use `None` as a Sentinel for Mutable Default Arguments

Mutable default arguments (lists, dicts) are shared across all calls — one of Python's most common pitfalls.

```python
# ✓ Correct: None sentinel
def add_item(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items

# ✗ Bug: mutable default is shared across calls
def add_item(item, items=[]):
    items.append(item)    # Second call sees items from the first call!
    return items
```

#### 9. Use Truthiness for Empty Collection Checks

Empty collections (`[]`, `{}`, `""`, `set()`) are falsy in Python. Use this directly instead of checking length.

```python
my_list = []

# ✓ Pythonic: truthiness
if not my_list:
    print("list is empty")

if my_list:
    print("list has items")

# ✗ Avoid: explicit length check
if len(my_list) == 0:
    print("list is empty")
```

**Exception:** Use explicit `is not None` checks when `0`, `""`, or `False` are valid values that should not be treated as "empty."

#### 10. Use `is` for `None` Comparisons

`None` is a singleton object in Python. Always compare with `is` / `is not`, never `==`.

```python
result = some_function()

# ✓ Pythonic: identity check
if result is None:
    print("no result")

if result is not None:
    process(result)

# ✗ Avoid: equality check (can be overridden by __eq__)
if result == None:
    print("no result")
```

This matters because a class can override `__eq__` to return `True` when compared with `None`, which would break the equality check. The `is` operator checks *identity* (same object in memory), which cannot be overridden.


### Test Your Knowledge

{% include flashcards.html id="python_syntax_explain" %}

{% include flashcards.html id="python_syntax_generate" %}

{% include quiz.html id="python" %}