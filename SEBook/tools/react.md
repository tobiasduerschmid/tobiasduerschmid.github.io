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
You are looking at **JSX** (JavaScript XML). It is a special syntax extension for React. Under the hood, a compiler (like Babel) turns those HTML-like tags into regular JavaScript objects. 

Notice the `{username}` syntax? Just like f-strings in Python (`f"Hello {username}"`), JSX allows you to seamlessly inject JavaScript variables directly into your UI using curly braces `{}`.

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