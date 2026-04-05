---
title: "Node.js Essentials — Sample Solutions"
layout: sebook
---

# Node.js Essentials: JavaScript for the Backend — Sample Solutions

These are reference solutions for each exercise in the interactive tutorial.
Each solution explains **why** it is correct, connecting the code back to the
concepts taught in that step.

---

## Step 1: Hello, Node.js! — `hello.js`

```javascript
// Your first Node.js script!
// Task: Add a console.log() statement below to print "Hello from Node.js!"
console.log("Hello from Node.js!");
```

**Why this is correct:**

- **`console.log()`:** The Node.js equivalent of Python's `print()` and C++'s `printf()`. It writes to stdout with a trailing newline.
- The test checks two things: (1) the source contains `console.log`, and (2) the output includes `"Hello from Node.js"`. Both are satisfied by this one line.
- Node.js scripts run top-to-bottom like Python scripts — no `main()` function, no compilation step. V8 JIT-compiles the JavaScript at runtime.

---

## Step 2: Variables, Types & The `===` Trap — `types.js`

```javascript
// FIXER-UPPER: Three bugs fixed.

// BUG 1 FIXED: == changed to === (no type coercion)
let userInput = "42";
let expectedScore = 42;
if (userInput === expectedScore) {
    console.log("[BUG] String '42' should NOT equal number 42 here!");
} else {
    console.log("Score check: types are different, correctly rejected.");
}

// BUG 2 FIXED: == changed to ===
let isAdmin = false;
if (isAdmin === 0) {
    console.log("[BUG] false should NOT equal the number 0 here!");
} else {
    console.log("Admin check: false and 0 are different types, correctly rejected.");
}

// BUG 3 FIXED: let changed to const (value never changes)
const MAX_STUDENTS = 200;

// TASK DONE: Replaced + concatenation with a template literal
const studentName = "Alex";
const studentGrade = 95;
const message = `Student ${studentName} scored ${studentGrade} out of ${MAX_STUDENTS}`;
console.log(message);
```

**Why this is correct:**

- **`===` instead of `==`:** JavaScript's `==` performs implicit type coercion — `"42" == 42` is `true` and `false == 0` is `true`. These are the dangerous surprises shown in the tutorial. `===` checks both value AND type, matching the behavior you expect from C++ and Python. After both fixes, neither `[BUG]` message appears in output.
- **`const MAX_STUDENTS`:** The value `200` never changes, so `const` is the correct declaration — it prevents accidental reassignment and signals intent to readers. The test checks `source.includes('const MAX_STUDENTS')`.
- **Bonus improvement:** The solution also changes `studentName`, `studentGrade`, and `message` from `let` to `const` — none are reassigned, so `const` is the better choice. This is not required by the task (only `MAX_STUDENTS` is listed as a bug), but it follows best practice #1: "default to `const`, use `let` only when reassigning."
- **Template literal:** Backtick strings with `${expression}` syntax replace the `+` concatenation. The test checks `source.includes('${')`. Template literals are the direct JavaScript equivalent of Python's f-strings.
- **Test: no `[BUG]` in output:** The test `assert(!output.includes('[BUG]'), ...)` verifies both `===` fixes worked — neither branch with `[BUG]` in its message should execute.

---

## Step 3: Arrow Functions & Callbacks — `functions.js`

```javascript
// Arrow Functions & Callbacks — complete the two TODOs

const students = [
    { name: "Alice", grade: 95 },
    { name: "Bob",   grade: 42 },
    { name: "Carol", grade: 78 },
    { name: "Dave",  grade: 55 },
    { name: "Eve",   grade: 88 },
];

// TODO 1 DONE: Arrow function assigned to a const
const getLetterGrade = (score) => {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
};

// TODO 2 DONE: .filter() keeps only passing students (grade >= 60)
const passingStudents = students.filter(student => student.grade >= 60);

console.log("=== Passing Students ===");
passingStudents.forEach(s => console.log(`${s.name}: ${s.grade} (${getLetterGrade(s.grade)})`));
```

**Why this is correct:**

- **Arrow function:** `const getLetterGrade = (score) => { ... }` converts the `function` declaration to an arrow function assigned to a `const`. The test checks that the source no longer contains `function getLetterGrade` and does contain `=>`.
- **`.filter()`:** Receives an arrow function that returns `true` for students with `grade >= 60`. Bob (42) and Dave (55) fail the test and are excluded. The test checks both `source.includes('.filter(')` and `!output.includes('Bob')`.
- **First-class functions:** `.filter()` receives an arrow function as an argument — this is the core concept. Functions are values that can be passed to other functions, just like numbers or strings.

---

## Step 4: Array Transformation & Destructuring — `transform.js`

```javascript
// Array Transformation — complete the three TODOs

const students = [
    { name: "Alice", grade: 95 },
    { name: "Bob",   grade: 42 },
    { name: "Carol", grade: 78 },
    { name: "Dave",  grade: 55 },
    { name: "Eve",   grade: 88 },
];

const getLetterGrade = (score) => {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
};

// TODO 1 DONE: .map() with destructuring formats each student
const report = students.map(({ name, grade }) =>
    `${name.padEnd(7)}| ${grade} (${getLetterGrade(grade)})`
);

// TODO 2 DONE: .reduce() computes class average
const classAverage = students.reduce((acc, s) => acc + s.grade, 0) / students.length;

// TODO 3 DONE: Print report and formatted average
console.log("=== Student Report ===");
report.forEach(line => console.log(line));
console.log(`Class average: ${classAverage.toFixed(1)}`);
```

**Why this is correct:**

- **`.map()` with destructuring:** `({ name, grade })` in the arrow function parameter extracts the two properties from each student object — the destructuring shorthand covered in this step. `.padEnd(7)` left-aligns names to 7 characters for columnar output.
- **`getLetterGrade()` call:** The arrow function from Step 3 is provided and called inside the template literal. This reinforces that functions are values — here used as a helper inside `.map()`.
- **`.reduce()`:** `students.reduce((acc, s) => acc + s.grade, 0)` sums all grades. The `0` initial value is critical — without it, `.reduce()` throws on empty arrays. Dividing by `students.length` gives the average: (95+42+78+55+88)/5 = 71.6.
- **`.toFixed(1)`:** Formats the number `71.6` to one decimal place. The test checks `output.includes('71.6')` and `source.includes('.toFixed(')`.

---

## Step 5: The Blocked Chef — The Event Loop — `event_loop.js`

```javascript
// The Blocked Chef Demo

// Schedule a callback — should run "right away" with 0ms delay, right?
setTimeout(() => {
    console.log("[3] setTimeout fired — the chef is finally free!");
}, 0);

// Synchronous code: this runs first, blocking everything else
console.log("[1] Starting synchronous work...");

// Simulates a slow synchronous operation
let total = 0;
for (let i = 0; i < 5000000; i++) {
    total += i;
}
console.log(`[2] Synchronous work done. total = ${total}`);

// Second setTimeout added at the end
setTimeout(() => {
    console.log("Event loop is free again!");
}, 0);
```

**Why this is correct:**

- **Two `setTimeout` calls:** The test checks `(source.match(/setTimeout/g)||[]).length >= 2` — there must be at least two `setTimeout` calls in the file.
- **`"Event loop is free again!"`:** The test checks `output.includes('free again')`. Any second `setTimeout` with this message satisfies it.
- **Output order:** The test verifies `output.indexOf('[1]') < output.indexOf('[3]')` — synchronous log `[1]` must appear before the callback `[3]`. This demonstrates the core event loop principle: all synchronous code runs to completion before any callback fires, even with `0` ms delay.
- **The Event Loop model:** `setTimeout(fn, 0)` means "minimum 0ms delay" — the callback goes into the Task Queue. The Event Loop only dequeues it when the Call Stack is completely empty (after both `console.log` calls and the loop finish). The second `setTimeout` queues after the first and fires after `[3]`.

---

## Step 6: From Callbacks to `async`/`await` — `async.js`

```javascript
// Simulated async data source (provided — do not modify)
function fetchStudents() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                { name: "Alice",  grade: 95 },
                { name: "Bob",    grade: 42 },
                { name: "Carol",  grade: 78 },
                { name: "Dave",   grade: 55 },
                { name: "Eve",    grade: 88 },
            ]);
        }, 100);
    });
}

// Simulated FAILING data source — swap fetchStudents() for fetchFailing()
// to test your error handling!
function fetchFailing() {
    return new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error("Database connection lost")), 100);
    });
}

// Generation 3: async/await — replaces the callback-style code
async function displayStudents() {
    try {
        const students = await fetchStudents();
        console.log("=== Student Roster ===");
        students.forEach(s => console.log(`  ${s.name}: ${s.grade}`));
    } catch (err) {
        console.error(err);
    }
}

displayStudents();
```

**Why this is correct:**

- **`async` keyword:** The function is declared with `async`, satisfying `source.includes('async')`. An async function always returns a Promise.
- **`await fetchStudents()`:** Suspends `displayStudents` — but NOT the entire Node.js process — until the Promise resolves. This is non-blocking: the Event Loop can handle other work while waiting. The test checks `source.includes('await')`.
- **`try`/`catch`:** Wraps the `await` to handle rejections. If `fetchStudents()` rejects, the `catch` block handles it. This is analogous to `try`/`except` in Python or `try`/`catch` in C++. The test checks for both keywords.
- **`displayStudents()` is called at the bottom:** The test checks `output.includes('Alice')` — the function must actually be invoked to produce output.
- **The callback-style code is replaced:** The original `readStudents((err, students) => {...})` pattern (Generation 1) is removed. The `async`/`await` version (Generation 3) reads like synchronous code while remaining non-blocking.

---

## Step 7: Capstone: Build a Student Grade Dashboard — `dashboard.js`

```javascript
// === Simulated API (do not modify) ===
function fetchRoster() {
    return new Promise(resolve => {
        setTimeout(() => resolve([
            { name: "Alice", id: 1 },
            { name: "Bob",   id: 2 },
            { name: "Clara", id: 3 }
        ]), 50);
    });
}

function fetchGrades() {
    return new Promise(resolve => {
        setTimeout(() => resolve([
            { studentId: 1, course: "Math",    grade: 92 },
            { studentId: 1, course: "English", grade: 88 },
            { studentId: 1, course: "Science", grade: 83 },
            { studentId: 2, course: "Math",    grade: 45 },
            { studentId: 2, course: "English", grade: 61 },
            { studentId: 2, course: "Science", grade: 57 },
            { studentId: 3, course: "Math",    grade: 95 },
            { studentId: 3, course: "English", grade: 89 },
            { studentId: 3, course: "Science", grade: 89 }
        ]), 50);
    });
}

// === Dashboard implementation ===
async function buildDashboard() {
    try {
        // Fetch both data sources concurrently (not sequentially)
        const [roster, grades] = await Promise.all([fetchRoster(), fetchGrades()]);

        console.log("=== Grade Dashboard ===");

        let passingCount = 0;

        roster.forEach(student => {
            // Find all grades for this student
            const studentGrades = grades
                .filter(g => g.studentId === student.id)
                .map(g => g.grade);

            // Compute average
            const sum = studentGrades.reduce((acc, g) => acc + g, 0);
            const avg = sum / studentGrades.length;

            // Determine pass/fail
            const status = avg >= 60 ? "PASS" : "FAIL";
            if (status === "PASS") passingCount++;

            console.log(`${student.name.padEnd(6)} | Avg: ${avg.toFixed(1)} | ${status}`);
        });

        console.log(`Passing: ${passingCount}/${roster.length} students`);
    } catch (err) {
        console.error("Error:", err);
    }
}

buildDashboard();
```

**Why this is correct:**

- **`Promise.all([fetchRoster(), fetchGrades()])`:** Both Promises start concurrently (both 50ms timers fire at the same time). Total wait is ~50ms, not ~100ms. The test checks `source.includes('Promise.all')`. Array destructuring `const [roster, grades] = await Promise.all(...)` assigns both results in one line.
- **`grades.filter(g => g.studentId === student.id)`:** Uses `===` (strict equality) to match student IDs. The test specifically checks the `===` best practice.
- **`.reduce((acc, g) => acc + g, 0)`:** Sums the grades array. The `0` initial value is critical — without it, `.reduce()` throws on empty arrays.
- **`avg.toFixed(1)`:** Formats the average to exactly one decimal place. Alice: (92+88+83)/3 = 87.666... → `87.7`. Bob: (45+61+57)/3 = 54.333... → `54.3`. Clara: (95+89+89)/3 = 91.0 → `91.0`.
- **`student.name.padEnd(6)`:** Left-pads the name to 6 characters for aligned output.
- **`try`/`catch`:** Required by the tests (`source.includes('try') && source.includes('catch')`).
- **Expected output** (verified by tests):
  ```
  === Grade Dashboard ===
  Alice  | Avg: 87.7 | PASS
  Bob    | Avg: 54.3 | FAIL
  Clara  | Avg: 91.0 | PASS
  Passing: 2/3 students
  ```
