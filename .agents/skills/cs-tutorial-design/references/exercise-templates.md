# Exercise Templates and Patterns

This reference provides reusable exercise templates for common tutorial scenarios.
Read this when you need concrete exercise structures to implement the pedagogical
principles from the main skill.

## Table of Contents
1. [PRIMM Exercises](#primm-exercises)
2. [Faded Worked Examples](#faded-worked-examples)
3. [Parsons Problems](#parsons-problems)
4. [Bug Hunt Exercises](#bug-hunt-exercises)
5. [Transfer Challenges](#transfer-challenges)
6. [Interleaved Problem Sets](#interleaved-problem-sets)
7. [Self-Explanation Prompts](#self-explanation-prompts)

---

## PRIMM Exercises

### Template Structure

```markdown
## Exercise: [Topic]

### Predict
Look at this code. WITHOUT running it, predict:
1. What will be printed?
2. In what order will things happen?

[code block]

Write your prediction: ___

### Run
Now run the code. Compare the actual output to your prediction.
- Did it match? If not, what surprised you?

### Investigate
Try these modifications:
1. Change [X] to [Y]. What changes?
2. Remove line [N]. What breaks?
3. Add [Z] at line [M]. What happens?

### Modify
Extend this code to also [new requirement].

### Make
Starting from scratch, write code that [related but different task].
```

### Example: Async/Await PRIMM

```markdown
## Exercise: Promise Resolution Order

### Predict
```javascript
console.log("Start");

setTimeout(() => console.log("Timeout"), 0);

Promise.resolve().then(() => console.log("Promise"));

console.log("End");
```

Predict the console output order: ___

### Run
Run the code. Was your prediction correct?
- If "Timeout" printed after "Promise," why?

### Investigate
1. Change `setTimeout` delay to 1000. Does the order change?
2. Add a second `.then()` after the first. Where does it print?
3. Wrap everything in an `async` function. Does anything change?

### Modify
Add a second `setTimeout` with delay 0 and a second `Promise.resolve()`.
Predict and verify the output order.

### Make
Write code that demonstrates the difference between microtasks and macrotasks
using a different example scenario.
```

---

## Faded Worked Examples

### Template Structure

```markdown
## Worked Example Sequence: [Algorithm/Pattern]

### Level 1: Fully Worked
Here's a complete implementation with sub-goal labels:

[complete code with # Sub-goal comments]

Study this example. Note how each sub-goal maps to a section of code.

### Level 2: Partially Faded
The same problem, but with [component] removed:

[code with strategic blanks]
# TODO: [description of missing component]

Complete the missing section.

### Level 3: More Fading
Now multiple components are removed:

[code with more blanks]
# TODO: [first missing component]
# TODO: [second missing component]

### Level 4: Independent
Solve this related problem from scratch:
[new problem specification]
```

### Example: Binary Search Fading

```markdown
## Worked Example Sequence: Binary Search

### Level 1: Fully Worked
```python
def binary_search(arr, target):
    # Sub-goal: Initialize search boundaries
    left = 0
    right = len(arr) - 1
    
    # Sub-goal: Continue while search space exists
    while left <= right:
        # Sub-goal: Calculate midpoint (avoiding overflow)
        mid = left + (right - left) // 2
        
        # Sub-goal: Check if target found
        if arr[mid] == target:
            return mid
        
        # Sub-goal: Narrow search space
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    
    # Sub-goal: Target not found
    return -1
```

### Level 2: Partially Faded
```python
def binary_search(arr, target):
    # Sub-goal: Initialize search boundaries
    left = 0
    right = len(arr) - 1
    
    # Sub-goal: Continue while search space exists
    while left <= right:
        # Sub-goal: Calculate midpoint (avoiding overflow)
        mid = left + (right - left) // 2
        
        # Sub-goal: Check if target found
        if arr[mid] == target:
            return mid
        
        # Sub-goal: Narrow search space
        # TODO: Update left or right based on comparison
        # Hint: If arr[mid] < target, where must target be?
        _______________
    
    # Sub-goal: Target not found
    return -1
```

### Level 3: More Fading
```python
def binary_search(arr, target):
    # Sub-goal: Initialize search boundaries
    left = 0
    right = len(arr) - 1
    
    # TODO: Implement the while loop
    # - Calculate midpoint
    # - Check if found
    # - Narrow search space
    _______________
    
    return -1
```

### Level 4: Independent
Implement a function that finds the **first occurrence** of a target
in a sorted array that may contain duplicates.
```

---

## Parsons Problems

### Template Structure

Provide scrambled lines; learner arranges in correct order.

```markdown
## Parsons Problem: [Topic]

Arrange these lines to create a working [function/program]:

[Scrambled lines with letters/numbers]

Optional: Some lines are distractors (not needed).
```

### Example: Parsons Problem - Linked List Reversal

```markdown
## Parsons Problem: Reverse a Linked List

Arrange these lines to reverse a singly linked list in-place.
One line is a DISTRACTOR and should not be used.

```
A) prev = None
B) current = head
C) return prev
D) while current:
E)     next_node = current.next
F)     current.next = prev
G)     prev = current
H)     current = next_node
I)     next_node = prev  # DISTRACTOR
```

Correct order: ___

Which line is the distractor? ___
```

### Faded Parsons Problem

```markdown
## Faded Parsons Problem: Merge Sorted Lists

Arrange these lines AND fill in the blanks:

```
A) while l1 and l2:
B) if l1.val __ l2.val:  # Fill: comparison operator
C)     current.next = __  # Fill: which node?
D)     l1 = l1.next
E) else:
F)     current.next = l2
G)     l2 = __.next  # Fill: which variable?
```

Correct order: ___
Fill in blank B: ___
Fill in blank C: ___
Fill in blank G: ___
```

---

## Bug Hunt Exercises

### Template Structure

```markdown
## Bug Hunt: [Topic]

This code has [N] bug(s). Find and fix them.

[buggy code]

Symptoms: [what goes wrong]

For each bug:
1. Identify the line number
2. Explain WHY it's wrong
3. Provide the fix
```

### Example: Bug Hunt - Closure in Loop

```markdown
## Bug Hunt: Event Handlers

This code attaches click handlers to 5 buttons. When any button is clicked,
it should log its index. But something's wrong.

```javascript
for (var i = 0; i < 5; i++) {
    buttons[i].addEventListener('click', function() {
        console.log('Button ' + i + ' clicked');
    });
}
```

**Observed behavior:** Every button logs "Button 5 clicked"

**Questions:**
1. Why does every button log 5?
2. What's the underlying JavaScript concept at play?
3. Provide TWO different ways to fix this bug.

Fix 1 (using let): ___
Fix 2 (using IIFE or closure): ___
```

### Example: Bug Hunt - Off-By-One

```markdown
## Bug Hunt: Array Processing

This function should return the sum of all elements, but it has a bug.

```python
def sum_array(arr):
    total = 0
    for i in range(1, len(arr)):
        total += arr[i]
    return total
```

**Test case:** `sum_array([1, 2, 3, 4])` returns 9 (expected: 10)

1. What's the bug? ___
2. Why is this category of bug so common? ___
3. Fix the code: ___
```

---

## Transfer Challenges

### Template Structure

```markdown
## Transfer Challenge: [Concept]

You've learned [concept] in [original context]. Now apply it to [new context].

### Original Context (Review)
[Brief example of concept in familiar domain]

### New Context
[Problem in unfamiliar domain requiring same underlying concept]

Key question: What's the same? What's different?
```

### Example: Transfer Challenge - Recursion

```markdown
## Transfer Challenge: Recursion in a New Domain

### Original Context (Review)
You've used recursion for tree traversal:
```python
def tree_sum(node):
    if node is None:
        return 0
    return node.val + tree_sum(node.left) + tree_sum(node.right)
```

### New Context: File System Traversal
A directory structure is also a tree! Write a function that:
- Takes a directory path
- Returns the total size of all files (recursively including subdirectories)

Hints:
- Use `os.listdir()` to get contents
- Use `os.path.isdir()` to check if item is a directory
- Use `os.path.getsize()` to get file size

What's the base case? ___
What's the recursive case? ___

Implement: ___
```

---

## Interleaved Problem Sets

### Template Structure

```markdown
## Mixed Problem Set: [Topic Area]

These problems require DIFFERENT approaches. For each:
1. Identify which technique/pattern applies
2. Justify your choice
3. Implement the solution

### Problem 1
[Description - could be sorting, searching, DP, etc.]
Technique: ___ Because: ___

### Problem 2
[Description - different technique]
Technique: ___ Because: ___

### Problem 3
[Description - yet another technique, or could be similar to P1]
Technique: ___ Because: ___

### Problem 4
[Description - requires identifying it's actually like P1 or P2]
Technique: ___ Because: ___
```

### Example: Interleaved Data Structures

```markdown
## Mixed Problem Set: Choosing the Right Data Structure

For each scenario, identify the optimal data structure and explain why.

### Problem 1: Browser History
Implement back/forward navigation for a browser.
Operations needed: go back, go forward, visit new page.

Data structure: ___ 
Why: ___

### Problem 2: Task Scheduler
Implement a task scheduler where tasks run in priority order.
Operations: add task with priority, run highest priority task.

Data structure: ___
Why: ___

### Problem 3: LRU Cache
Implement a cache that evicts the least recently used item when full.
Operations: get (also marks as used), put (may trigger eviction).

Data structure(s): ___
Why: ___

### Problem 4: Undo/Redo
Implement undo/redo for a text editor.
Operations: apply edit, undo last edit, redo last undo.

Data structure: ___
Why is this similar to Problem 1, and how does it differ? ___
```

---

## Self-Explanation Prompts

### Template Structure

Insert these prompts at strategic points in code examples.

```markdown
## Code with Self-Explanation Checkpoints

```[language]
[line of code]
// EXPLAIN: Why this line? What would break without it?

[next section]
// EXPLAIN: What assumption is being made here?

[critical line]
// EXPLAIN: This is the core insight. Describe it in plain English.
```
```

### Example: Self-Explanation - Merge Sort

```python
def merge_sort(arr):
    # EXPLAIN: Why do we need this base case? What happens without it?
    if len(arr) <= 1:
        return arr
    
    # EXPLAIN: Why divide in half? Why not thirds?
    mid = len(arr) // 2
    
    # EXPLAIN: These are recursive calls. Trace what happens with [3, 1, 4, 2]
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    
    # EXPLAIN: At this point, what do we KNOW about left and right?
    return merge(left, right)

def merge(left, right):
    result = []
    i = j = 0
    
    # EXPLAIN: Why compare with indices rather than popping from lists?
    while i < len(left) and j < len(right):
        # EXPLAIN: Why <= instead of <? What changes if we use <?
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    
    # EXPLAIN: Why might there be elements remaining? Give an example.
    result.extend(left[i:])
    result.extend(right[j:])
    
    return result
```

---

## Combining Templates

For maximum effectiveness, combine multiple templates:

### Full Exercise Flow

1. **PRIMM** for initial concept introduction
2. **Faded Worked Example** for skill building
3. **Bug Hunt** to surface misconceptions
4. **Transfer Challenge** for generalization
5. **Interleaved Problem Set** for discrimination learning
6. **Self-Explanation** throughout for metacognition

### Example Combined Unit: Hash Tables

1. **PRIMM:** Predict what happens with dictionary operations
2. **Faded Example:** Implement a simple hash function, progressively faded
3. **Bug Hunt:** Find collision-handling bugs
4. **Transfer:** Apply hash table concepts to implement a spell checker
5. **Interleaved:** When would you use hash table vs. tree map vs. array?
6. **Self-Explanation:** Annotate a complete hash table implementation
