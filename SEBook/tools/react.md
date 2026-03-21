---
title: React
layout: sebook
---

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

### Summary & Next Steps
1. **Components:** UI is broken down into reusable JavaScript functions.
2. **JSX:** We write HTML inside JS to describe the UI layout.
3. **State:** We use `useState` to give components memory. Updating state causes the screen to redraw automatically.
4. **Integration:** React runs in the user's browser, acting as the client that makes HTTP requests to your Node.js/Express server.

**To practice:** Try setting up a simple React environment using a tool like Vite (`npm create vite@latest`), and try writing a `Counter` component yourself. Change the math, add a "Reset" button, and get a feel for how changing State updates the screen!