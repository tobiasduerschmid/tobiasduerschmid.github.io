---
title: React
layout: sebook
---

This is a **reference page** for React, designed to be kept open alongside the [React Tutorial](/SEBook/tools/react-tutorial). Use it to look up syntax, concepts, and comparisons while you work through the hands-on exercises.

> **New to React?** Start with the [interactive tutorial](/SEBook/tools/react-tutorial) first — it teaches these concepts through practice with immediate feedback. This page is a reference, not a teaching resource.

Welcome to the world of Frontend Development! Since you already have experience with Node.js, you actually have a massive head start

You already know how to build the "brain" of an application—the server that crunches data, talks to a database, and serves APIs. But right now, your Express server only speaks in raw data (like JSON). UI (User Interface) development is about building the "face" of your application. It’s how your users will interact with the data your Node.js server provides.

To help you learn React, we are going to bridge what you already know (functions, state, and servers) to how React thinks about the screen.


### The Core Paradigm Shift: Declarative vs. Imperative

In C++ or Python, you are used to writing **imperative** code. You write step-by-step instructions:
* *Find the button in the window.*
* *Listen for a click.*
* *When clicked, find the text box.*
* *Change the text to "Clicked!"*

React uses a **declarative** approach. Instead of writing steps to change the screen, you declare what the screen *should look like* at any given moment, based on your data. 



Think of it like an Express route. In Express, you take a `Request`, process it, and return a `Response`. In React, you take **Data**, process it, and return **UI**.

$$UI = f(Data)$$

When the data changes, React automatically re-runs your function and efficiently updates the screen for you. You never manually touch the screen; you only update the data.


### The Building Blocks: Components

In Python or C++, you don't write your entire program in one massive `main()` function. You break it down into smaller, reusable functions or classes. 

React does the exact same thing for user interfaces using **Components**. A component is just a JavaScript function that returns a piece of the UI.


Let's look at your very first React component. Don't worry if the syntax looks a little strange at first:

```jsx
// A simple React Component
function UserProfile() {
  const username = "CPlusPlusFan99";
  const role = "Admin";

  return (
    <div className="profile-card">
      <h1>{username}</h1>
      <p>System Role: {role}</p>
    </div>
  );
}
```

#### What is that HTML doing inside JavaScript?!
You are looking at **JSX** (JavaScript XML). It is a special syntax extension for React. Under the hood, a compiler (like Babel) transforms those HTML-like tags into plain JavaScript function calls:

```jsx
// JSX (what you write):
<h1 className="title">Hello</h1>

// What Babel compiles it to:
React.createElement('h1', { className: 'title' }, 'Hello')
```

`React.createElement` returns a lightweight JavaScript object — the **Virtual DOM** node. React then compares these object trees to determine the minimal set of real DOM changes needed.

Notice the `{username}` syntax? Just like f-strings in Python (`f"Hello {username}"`), JSX allows you to seamlessly inject JavaScript variables directly into your UI using curly braces `{}`.

### Passing Data: Props

A component with hardcoded values is like a function with no parameters — limited and not reusable. **Props** (short for properties) let you pass data *into* a component, exactly like function arguments in C++ or Python.

```jsx
// Defining a component that accepts props:
function ProductCard({ name, price }) {
  return (
    <div>
      <h3>{name}</h3>
      <p>${price.toFixed(2)}</p>
    </div>
  );
}

// Using it — each instance gets different data:
<ProductCard name="Laptop" price={999.99} />
<ProductCard name="Mouse"  price={29.99}  />
```

**Key rules for props:**
* **Props flow one way** — from parent component down to child, never upward. This predictable, top-down data flow makes it easy to reason about where data comes from.
* **Props are read-only** inside the component. Mutating a prop would corrupt the parent's data and break React's data flow model. If a component needs to change a value, it should use local state (`useState`) instead.
* **Any JavaScript value** can be a prop: string, number, boolean, object, array, function, or even another component.

A common challenge as your app grows is **prop drilling** — passing a prop through several intermediate layers of components that don't use it themselves, just to reach a deeply nested component that does. Solutions include the React Context API or dedicated state management libraries.

### Adding Memory: State

A UI isn't very useful if it can't change. In a C++ class, you use member variables to keep track of an object's current status. In React, we use **State**.

State is simply a component's memory. When a component's state changes, React says, *"Ah! The data changed. I need to re-run this function to see what the new UI should look like."*

Let's build a component that tracks how many times a user clicked a "Like" button—something you might eventually connect to an Express backend.

```jsx
import { useState } from 'react';

function LikeButton() {
  // 1. Define state: [currentValue, setterFunction] = useState(initialValue)
  const [likes, setLikes] = useState(0);

  // 2. Define an event handler
  function handleLike() {
    setLikes(likes + 1); // Tell React the data changed!
  }

  // 3. Return the UI
  return (
    <div className="like-container">
      <p>This post has {likes} likes.</p>
      <button onClick={handleLike}>
        👍 Like this post
      </button>
    </div>
  );
}
```

#### Breaking down `useState`:
`useState` is a special React function (called a "Hook"). It returns an array with two things:
1. `likes`: The current value (like a standard variable).
2. `setLikes`: A setter function. **Crucial rule:** You cannot just do `likes++` like you would in C++. You *must* use the setter function (`setLikes`). Calling the setter is what alerts React to re-render the UI with the new data.



### Putting it Together: Connecting Frontend to Backend

How does this connect to what you already know? 

Right now, your Express server might have a route like this:
```javascript
// Express Backend
app.get('/api/users/1', (req, res) => {
  res.json({ name: "Alice", status: "Online" });
});
```

In React, you would write a component that fetches that data and displays it. We use another hook called `useEffect` to run code when the component first appears on the screen:

```jsx
import { useState, useEffect } from 'react';

function Dashboard() {
  const [userData, setUserData] = useState(null);

  // This runs once when the component is first displayed
  useEffect(() => {
    // Fetch data from your Express server!
    fetch('http://localhost:3000/api/users/1')
      .then(response => response.json())
      .then(data => setUserData(data)); 
  }, []);

  // If the data hasn't arrived from the server yet, show a loading message
  if (userData === null) {
    return <p>Loading data from Express...</p>;
  }

  // Once the data arrives, render the actual UI
  return (
    <div>
      <h1>Welcome back, {userData.name}!</h1>
      <p>Status: {userData.status}</p>
    </div>
  );
}
```

### Props: Passing Data Into Components

Components without data are static. **Props** let you pass data into a component, exactly like function arguments:

```jsx
// C++:    void printCard(string name, double price) { ... }
// Python: def render_card(name, price): ...

// React — defining the component:
function ProductCard({ name, price }) {
  return (
    <div>
      <h3>{name}</h3>
      <p>${price.toFixed(2)}</p>
    </div>
  );
}

// React — using the component (like calling a function with named args):
<ProductCard name="Laptop" price={999.99} />
```

Key props rules:
- **One-way flow** — props flow from parent to child, never the reverse
- **Read-only** — props are immutable inside the component (like `const` parameters)
- **Any JS value** — strings, numbers, booleans, objects, arrays, functions can all be props

String props can use quotes (`title="Hello"`); all other types need braces (`price={99.99}`, `active={true}`).


### JSX Rules — Where HTML Instincts Break

JSX looks like HTML but is actually JavaScript. These rules catch most beginners:

| Rule | Wrong (HTML instinct) | Correct (JSX) |
|---|---|---|
| CSS class | `class="..."` | `className="..."` (`class` is a JS keyword) |
| Self-closing tags | `<img src={u}>` | `<img src={u} />` |
| Inline style | `style="color:red"` | `style={% raw %}{{color: 'red'}}{% endraw %}` (JS object, not CSS string) |
| Multiple root elements | `return <h1/><p/>` | `return <><h1/><p/></>` (fragment wrapper) |
| Component names | `<card />` | `<Card />` (must be capitalized) |
| Event handlers | `onclick` | `onClick` (camelCase) |



### Lists, Keys, and Conditional Rendering

In C++ you render lists with `for` loops. In React, you use `.map()` to transform data arrays into JSX:

```jsx
const tasks = [{id: 1, text: 'Learn React', done: true}, ...];

// .map() transforms data → JSX; key identifies each item for React's diffing
const taskList = tasks.map(task =>
  <li key={task.id}>{task.done ? '✓' : '✗'} {task.text}</li>
);
return <ul>{taskList}</ul>;
```

**Keys** tell React which items are stable across re-renders. Without stable keys, React compares by position — causing bugs when items are reordered or deleted. Never use array index as a key for dynamic lists; use a stable ID from your data.

**Conditional rendering** uses plain JavaScript inside JSX:

```jsx
// Short-circuit: only renders when condition is true
{unreadCount > 0 && <Badge count={unreadCount} />}

// Ternary: choose between two alternatives
{isLoggedIn ? <Dashboard /> : <LoginForm />}
```

> **Watch out**: `{count && <Badge />}` renders the number `0` when `count` is `0`, because `0` is a valid React node. Use `{count > 0 && <Badge />}` instead.


### Composition Over Inheritance

In C++ and Java, you reuse code via inheritance (`class Dog : Animal`). React uses **composition** — building complex UIs by combining small, generic components:

```jsx
// Generic container — accepts anything as children
function Card({ children, className }) {
  return <div className={'card ' + (className || '')}>{children}</div>;
}

// Specific use — compose with the children prop
function ProfileCard({ user }) {
  return (
    <Card className="profile">
      <Avatar src={user.avatar} />
      <h3>{user.name}</h3>
    </Card>
  );
}
```

The `children` prop lets any content be nested inside a component, making it a composable container — analogous to C++ templates or Python's `*args`.


### Thinking in React

React's official methodology for building a new UI:

1. **Break the UI into a component hierarchy** — each component does one job (single-responsibility)
2. **Build a static version first** — props only, no state
3. **Identify the minimal state** — don't duplicate data that can be derived
4. **Determine where state lives** — the lowest common ancestor that needs it
5. **Add inverse data flow** — children call callback functions passed as props

### Lifting State Up

When two sibling components need the same data, move the state to their **lowest common ancestor** and pass it down as props:

```jsx
function Parent() {
  const [text, setText] = useState('');
  return (
    <>
      <SearchBar value={text} onChange={setText} />
      <ResultsList filter={text} />
    </>
  );
}
```

`SearchBar` calls `onChange(e.target.value)` to notify the parent. The parent updates state, which triggers a re-render of both components. This is "inverse data flow" — data flows down via props, notifications flow up via callbacks.


### Top 10 React Best Practices

These are the most important habits to build early. Every one of them prevents real bugs that trip up beginners — and professionals.

**1. Use `useState` for component memory — never bare variables.**
A `let` variable inside a component resets to its initial value on every render. Only `useState` persists data and triggers re-renders when it changes.

**2. Keep state minimal — derive what you can.**
If a value can be computed from existing state or props, compute it during render instead of storing a second copy. Two copies can drift out of sync.
```jsx
// Good — filter is the only state; visibleTasks is derived
const [filter, setFilter] = useState('all');
const visibleTasks = tasks.filter(t => filter === 'all' || t.status === filter);
```

**3. Never mutate state — always create new arrays and objects.**
React detects changes by *reference*. `array.push()` returns the same reference, so React skips the re-render. Spread into a new array instead.
```jsx
// Bad — mutates in place, React sees no change
items.push(newItem);
setItems(items);

// Good — new array, React re-renders
setItems([...items, newItem]);
```

**4. Use stable, unique keys for lists — never the array index.**
Keys tell React which element is which across re-renders. If items are reordered or deleted, index-based keys cause state to attach to the wrong element (e.g., checked checkboxes shifting). Use a unique ID from your data.

**5. Destructure props in the function signature.**
It makes the component's API visible at a glance and avoids repetitive `props.` prefixes throughout the body.
```jsx
// Good
function ProductCard({ name, price, onSale }) { ... }

// Avoid
function ProductCard(props) { return <h3>{props.name}</h3>; }
```

**6. Lift state to the lowest common ancestor.**
When two sibling components need the same data, move the state up to their nearest shared parent and pass it down as props. The child notifies the parent through a callback prop — never by reaching into siblings directly.

**7. One component, one job.**
If a component handles product display *and* cart management *and* filtering, it is doing too much. Split it into focused pieces (`ProductCard`, `CartSummary`, `FilterBar`). Small components are easier to read, test, and reuse.

**8. Name event handlers `handle*`, callback props `on*`.**
Inside a component, the function that handles a click is `handleClick`. When you pass it to a child as a prop, call the prop `onClick`. This convention makes it immediately clear which end owns the logic and which end fires the event.
```jsx
function App() {
  const handleDelete = (id) => { /* ... */ };
  return <TodoItem onDelete={handleDelete} />;
}
```

**9. Guard `&&` rendering against falsy numbers.**
{% raw %}`{count && <Badge />}`{% endraw %} renders the literal `0` when `count` is `0`, because `0` is a valid React node. Use an explicit boolean: {% raw %}`{count > 0 && <Badge />}`{% endraw %}.

**10. Never call hooks inside conditions or loops.**
React tracks hooks by their *call order*. If a `useState` call is skipped on one render because it is inside an `if`, every hook after it shifts position — causing crashes or silent data corruption. Always call hooks at the top level of your component.


### Glossary

| Term | Definition |
|------|-----------|
| **Component** | A JavaScript function that returns JSX. The building block of React UIs. |
| **JSX** | A syntax extension that lets you write HTML-like markup inside JavaScript. Babel compiles it to `React.createElement()` calls. |
| **Props** | Read-only data passed from a parent component to a child, like function arguments. |
| **State** | Data managed inside a component via `useState`. Changing state triggers a re-render. |
| **Hook** | A special function (prefixed with `use`) that lets components use React features. Must be called at the top level. |
| **Re-render** | When React re-calls your component function because state or props changed, producing a new JSX tree. |
| **Virtual DOM** | A lightweight JavaScript object tree that React builds from your JSX. React diffs the old and new trees and patches only the changed real DOM nodes. |
| **Reconciliation** | The algorithm React uses to compare the old and new Virtual DOM trees and determine the minimal set of DOM updates. |
| **Key** | A special prop on list items that helps React identify which items changed, were added, or were removed during reconciliation. |
| **Fragment** | A wrapper (`<>...</>`) that groups multiple JSX elements without adding an extra DOM node. |
| **Derived state** | A value computed from existing state or props during render, rather than stored in its own `useState`. |
| **Lifting state up** | Moving state to the lowest common ancestor of the components that need it, then passing it down as props. |


### Summary
1. **Components:** UI is broken down into reusable JavaScript functions.
2. **JSX:** We write HTML-like syntax inside JS to describe UI, compiled to `React.createElement` calls.
3. **Props:** Data flows one-way from parent to child. Props are read-only.
4. **State:** We use `useState` to give components memory. Updating state triggers re-renders.
5. **Lists & Keys:** Use `.map()` with stable `key` props for dynamic lists.
6. **Conditional Rendering:** Use `&&` and ternary operators inside JSX.
7. **Composition:** Build complex UIs by combining small components via the `children` prop.
8. **Integration:** React runs in the user's browser, acting as the client that makes HTTP requests to your Node.js/Express server.

### Ready to Practice?
Head to the [React Tutorial](/SEBook/tools/react-tutorial) for hands-on exercises with immediate feedback — no setup required.

### Test Your Knowledge

{% include flashcards.html id="react_syntax_explain" %}

{% include flashcards.html id="react_syntax_generate" %}

{% include quiz.html id="react" %}