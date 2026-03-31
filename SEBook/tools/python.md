---
title: Python
layout: sebook
---

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

Python uses **indentation** to define scope, and **newlines** to terminate statements. This enforces highly readable code by design.

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
*Note: `range(5)` generates a sequence of numbers from 0 up to (but not including) 5.*

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


### Core Collections: Lists, Sets, and Dictionaries

Because Python does not enforce static typing, its built-in collections are highly flexible. You do not need to `#include` external libraries to use them; they are native to the language syntax. 

#### Lists (C++ Equivalent: `std::vector`)
A List is an ordered, mutable sequence of elements. Unlike a C++ `std::vector<T>`, a Python list can contain objects of entirely different types. Lists are defined using square brackets `[]`.

```python
# Heterogeneous list
my_list = [1, "two", 3.14, True]

my_list.append("new item") # Adds to the end (like push_back)
my_list.pop()              # Removes and returns the last item
print(len(my_list))        # len() gets the size of any collection
```

#### Sets (C++ Equivalent: `std::unordered_set`)
A Set is an unordered collection of unique elements. It is implemented using a hash table, making membership testing (`in`) exceptionally fast—$O(1)$ on average. Sets are defined using curly braces `{}`.

```python
unique_numbers = {1, 2, 2, 3, 4, 4}
print(unique_numbers) # Output: {1, 2, 3, 4} - duplicates are automatically removed

# Fast membership testing
if 3 in unique_numbers:
    print("3 is present!")
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


### Data Structures and "Pythonic" Iteration

In C++, you rely heavily on the Standard Template Library (STL) for data structures like `std::vector` and `std::unordered_map`. Because C++ is statically typed, a `std::vector<int>` can *only* hold integers.

Because Python is dynamically typed (variables are just tags), its built-in data structures are incredibly flexible. A single Python List can hold an integer, a string, and another list simultaneously. 

Additionally, while C++ traditionally relies on index-based `for` loops (though modern C++ has range-based loops), Python strongly encourages iterating *directly* over the elements of a collection. This is considered writing "Pythonic" code.

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

# Python's equivalent to std::unordered_map is a Dictionary
student_grades = {"Alice": 95, "Bob": 82}

for name, grade in student_grades.items():
    print(f"{name} scored {grade}")
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

### Robust Command-Line Arguments (`argparse`)
In C++, you typically handle command-line inputs by parsing `int argc` and `char* argv[]` directly in `main()`. While Python *does* have a direct equivalent (`sys.argv`), the course materials emphasize using the built-in `argparse` module. It automatically generates help/usage messages, enforces types, and parses flags, saving you from writing boilerplate C++ parsing code.

### Regular Expressions (`re` module)
Since Python is a scripting language, it is heavily utilized for text processing. The lecture transitions into using Python to read and parse text files (like User Stories) using the `re` module. While C++ has the `<regex>` library, Python's integration with RegEx and string manipulation is much more central to its everyday use case as a scripting tool.