---
title: Python
layout: sebook
---

Welcome to Python! Since you already know C++, you have a strong foundation in programming logic, control flow, and object-oriented design. However, moving from a compiled, statically typed systems language to an interpreted, dynamically typed scripting language requires a shift in how you think about memory and execution. 

To help you make this transition, we will anchor Python's concepts directly against the C++ concepts you already know, adjusting your mental model along the way.

### 1. The Execution Model: Scripts vs. Binaries

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

### 2. The Mental Model of Memory: Dynamic Typing

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

### 3. Syntax and Scoping: Whitespace Matters

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

### 4. Passing Arguments: "Pass-by-Object-Reference"

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


Here is the continuation of your introduction to Python, building on the mental models we established in the first part.


### 5. Memory Management: RAII vs. Garbage Collection

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


### 6. Data Structures and "Pythonic" Iteration

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



### 7. Object-Oriented Programming: Explicit `self` and "Duck Typing"

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
