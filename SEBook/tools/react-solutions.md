---
title: "React Essentials — Sample Solutions"
layout: sebook
---

# React Essentials: From Imperative to Declarative UI — Sample Solutions

These are reference solutions for each exercise in the interactive tutorial.
Each solution explains **why** it is correct, connecting the code back to the
concepts taught in that step.

---

## Step 1: Hello, React! — Declarative vs. Imperative — `App.jsx`

```jsx
function App() {
  const name = "Alex";           // Changed from "World" to any non-"World" name
  const color = 'steelblue';     // Changed from 'tomato'

  return (
    <div style={{fontFamily: 'sans-serif', padding: '32px'}}>
      <h1 style={{color: color}}>
        Hello, {name}!
      </h1>
      <p>Welcome to React.</p>
    </div>
  );
}

// Mount — you don't need to change this
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

**Why this is correct:**

- **Test 1 — heading no longer says "World":** The test reads the `<h1>` from the live DOM and checks `h1.textContent.trim() !== 'Hello, World!'`. Any name other than `"World"` passes. The name is just a JavaScript variable — React re-renders the component and updates the DOM automatically when the component re-evaluates.
- **Test 2 — color is not "tomato":** The test reads `h1.style.color` from the DOM and checks it is not `'tomato'`. Any valid CSS color other than `'tomato'` (e.g., `'steelblue'`, `'#0078d4'`, `'blue'`) passes.
- **Declarative model:** You changed the `name` and `color` *variables* — not DOM nodes. React re-renders the component, builds a new Virtual DOM tree, diffs it against the old one, and patches only what changed in the real DOM. You described *what* the UI should look like; React handled *how* to get there.

---

## Step 2: Components & JSX — Fixer-Upper — `App.jsx`

```jsx
// A reusable Badge component — all four JSX bugs fixed
function Badge({ label, color }) {
  return (
    <span style={{background: color, color: '#222', padding: '6px 14px', borderRadius: '20px', fontWeight: 600}}>
      {label}
    </span>
  );
}

function App() {
  return (
    // BUG 1 FIXED: Wrapped in a Fragment <> to provide single root element
    <>
      <h1 className="app-title">My Badges</h1>
      <div style={{display: 'flex', gap: 12, marginTop: 16}}>
        <Badge label="React" color="#61dafb" />
        <Badge label="JavaScript" color="#f7df1e" />
        {/* Third badge added */}
        <Badge label="Node.js" color="#6cc24a" />
      </div>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

**Why this is correct:**

- **Bug 1 — `style` must be a JS object, not a string:** The original `style="background: color; ..."` is an HTML attribute string. In JSX, `style` takes a JavaScript object with camelCase property names: `style={{background: color, color: '#222', padding: '6px 14px', borderRadius: '20px', fontWeight: 600}}`. The test checks that at least 2 spans have a background color applied via `element.style.background`.
- **Bug 2 — `class` → `className`:** The original `<h1 class="app-title">` uses an HTML attribute name. `class` is a reserved keyword in JavaScript, so JSX uses `className`. The test checks the `<h1>` has the `app-title` class applied correctly.
- **Bug 3 — multiple root elements need a wrapper:** The original `App` returned two siblings (`<h1>` and `<div>`) without a wrapper. JSX compiles to `React.createElement(...)` which returns a single object — you cannot return two values at once. Wrap siblings in a `<>...</>` Fragment (zero-overhead, adds no extra DOM node).
- **Third Badge added:** The test checks `spans.length >= 3`. A `<Badge>` component renders one `<span>`, so three `<Badge>` components produce three spans.

---

## Step 3: Props — Parameterizing Components — `App.jsx`

```jsx
function ProductCard({ name, price, description, onSale }) {
  return (
    <div style={{
      border: '1px solid #ddd', borderRadius: 8,
      padding: 20, maxWidth: 280,
      fontFamily: 'sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    }}>
      {/* 1. Product name as <h3> */}
      <h3>{name}</h3>

      {/* 2. Price formatted to 2 decimal places */}
      <p>${price.toFixed(2)}</p>

      {/* 3. Description in a <p> */}
      <p>{description}</p>

      {/* 4. "Sale!" badge shown only when onSale is true */}
      {onSale && (
        <span style={{
          background: 'red', color: 'white',
          padding: '2px 8px', borderRadius: 4, fontSize: 12
        }}>
          Sale!
        </span>
      )}
    </div>
  );
}

function App() {
  return (
    <div style={{padding: 32, display: 'flex', gap: 24, flexWrap: 'wrap'}}>
      <ProductCard
        name="Mechanical Keyboard"
        price={129.99}
        description="Tactile switches, RGB backlit, compact 75% layout."
        onSale={true}
      />
      <ProductCard
        name="USB-C Hub"
        price={49.99}
        description="7-in-1 hub: 4K HDMI, 3× USB-A, SD card, 100W PD."
        onSale={false}
      />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

**Why this is correct:**

- **`{name}` in `<h3>`:** Props are accessed by destructuring in the function signature. The test queries all `<h3>` elements and checks that at least one contains `"Keyboard"`.
- **`price.toFixed(2)`:** `Number.prototype.toFixed(2)` formats to exactly 2 decimal places: `129.99` → `"129.99"`, `49.99` → `"49.99"`. The test looks for `'129.99'` or `'$129.99'` in the body text.
- **`{onSale && <span>Sale!</span>}`:** The `&&` short-circuit pattern: if `onSale` is `true`, React renders the `<span>`; if `false`, it renders nothing (because `false` is not rendered by React). The test checks the body text includes `"sale"` (case-insensitive).
- **Props are read-only:** Props flow one-way — parent to child. The `App` component passes fixed values; `ProductCard` can only read them. Mutating `name = "new"` inside the component would be incorrect and break React's data flow.

---

## Step 4: useState — Making Components Remember — `App.jsx`

```jsx
function Counter() {
  // Fix: use useState instead of a regular let variable
  const [count, setCount] = React.useState(0);

  return (
    <div style={{fontFamily: 'sans-serif', padding: 32, textAlign: 'center'}}>
      <h2 style={{fontSize: 48, margin: '0 0 24px'}}>{count}</h2>
      <div style={{display: 'flex', gap: 12, justifyContent: 'center'}}>

        {/* +1 button */}
        <button onClick={() => setCount(count + 1)}
          style={{padding: '10px 24px', fontSize: 18, borderRadius: 8,
                  border: 'none', background: '#0078d4', color: '#fff', cursor: 'pointer'}}>
          +1
        </button>

        {/* −1 button — don't go below 0 */}
        <button onClick={() => setCount(prev => Math.max(0, prev - 1))}
          style={{padding: '10px 24px', fontSize: 18, borderRadius: 8,
                  border: 'none', background: '#555', color: '#fff', cursor: 'pointer'}}>
          −1
        </button>

        {/* Reset button */}
        <button onClick={() => setCount(0)}
          style={{padding: '10px 24px', fontSize: 18, borderRadius: 8,
                  border: 'none', background: '#d83b01', color: '#fff', cursor: 'pointer'}}>
          Reset
        </button>

      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Counter />);
```

**Why this is correct:**

- **`React.useState(0)`:** Returns `[currentValue, setterFunction]`. Calling `setCount(newValue)` triggers a re-render with the new value. The test checks `src.textContent.includes('useState')`.
- **Why `let count = 0` fails:** Every time React re-renders the component, it calls the function fresh. A `let count = 0` is reset to `0` on every call — clicking the button logs the increment but React never sees a state change, so the display never updates.
- **`+1` button:** `onClick={() => setCount(count + 1)}` passes the new value to the setter.
- **`−1` button:** `setCount(prev => Math.max(0, prev - 1))` uses the functional update form (receives the latest state as `prev`) and `Math.max(0, ...)` prevents negative values.
- **`Reset` button:** `setCount(0)` resets state to the initial value. The test checks for a button with "reset" in its text (case-insensitive).
- **Three buttons total:** The test checks `buttons.length >= 3` for the decrement button.

---

## Step 5: Lists & Keys — Rendering Collections — `App.jsx`

```jsx
const tasks = [
  { id: 1, text: 'Set up React development environment', done: true },
  { id: 2, text: 'Learn about components and JSX',       done: true },
  { id: 3, text: 'Understand props and data flow',       done: true },
  { id: 4, text: 'Master useState for interactivity',    done: false },
  { id: 5, text: 'Render lists with .map() and keys',    done: false },
  { id: 6, text: 'Build a real React app',               done: false },
];

function TaskList() {
  return (
    <div style={{fontFamily: 'sans-serif', padding: 32, maxWidth: 520}}>
      <h2 style={{marginBottom: 16}}>React Learning Checklist</h2>

      <ul style={{listStyle: 'none', padding: 0}}>
        {/* .map() with task.id as key */}
        {tasks.map(task => (
          <li key={task.id}>
            {task.done ? '✓' : '✗'} {task.text}
          </li>
        ))}
      </ul>

      <p style={{color: '#888', fontSize: 13, marginTop: 12}}>
        {tasks.filter(t => t.done).length} / {tasks.length} complete
      </p>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<TaskList />);
```

**Why this is correct:**

- **`.map()` over `tasks`:** The test checks `src.textContent.includes('.map(')`. Each call to `tasks.map(task => <li ...>)` transforms the array of objects into an array of JSX elements that React renders.
- **`key={task.id}`:** Using `task.id` (a stable, unique identifier from the data) as the key — not the array index. If items were reordered or deleted, index-based keys would cause React to mismap component state to the wrong elements. The test checks for 6 `<li>` elements.
- **Ternary for done/undone:** `{task.done ? '✓' : '✗'}` conditionally renders the check or cross. The test checks the body text for `✓`, `✗`, or similar done-status indicators.

---

## Step 6: Conditional Rendering & Filtering — `App.jsx`

```jsx
const initialTasks = [
  { id: 1, text: 'Set up React development environment', done: true },
  { id: 2, text: 'Learn about components and JSX',       done: true },
  { id: 3, text: 'Understand props and data flow',       done: true },
  { id: 4, text: 'Master useState for interactivity',    done: false },
  { id: 5, text: 'Render lists with .map() and keys',    done: false },
  { id: 6, text: 'Build a real React app',               done: false },
];

function TaskList() {
  const [filter, setFilter] = React.useState('all');

  // Derive visible tasks from minimal state — do NOT store filtered array in state
  const visibleTasks = initialTasks.filter(task => {
    if (filter === 'active') return !task.done;
    if (filter === 'done')   return task.done;
    return true; // 'all'
  });

  const btnStyle = (name) => ({
    padding: '6px 16px', borderRadius: 6, border: '1px solid #ccc', cursor: 'pointer',
    background: filter === name ? '#0078d4' : '#fff',
    color:      filter === name ? '#fff'    : '#333',
  });

  return (
    <div style={{fontFamily: 'sans-serif', padding: 32, maxWidth: 520}}>
      <h2 style={{marginBottom: 16}}>React Learning Checklist</h2>

      {/* Filter buttons */}
      <div style={{display: 'flex', gap: 8, marginBottom: 16}}>
        <button style={btnStyle('all')}    onClick={() => setFilter('all')}>All</button>
        <button style={btnStyle('active')} onClick={() => setFilter('active')}>Active</button>
        <button style={btnStyle('done')}   onClick={() => setFilter('done')}>Done</button>
      </div>

      <ul style={{listStyle: 'none', padding: 0}}>
        {visibleTasks.map(task => (
          <li key={task.id} style={{padding: '8px 0', borderBottom: '1px solid #eee'}}>
            {task.done ? '✓' : '✗'} {task.text}
          </li>
        ))}
      </ul>

      <p style={{color: '#888', fontSize: 13, marginTop: 12}}>
        {initialTasks.filter(t => t.done).length} / {initialTasks.length} complete
      </p>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<TaskList />);
```

**Why this is correct:**

- **Three filter buttons — "All", "Active", "Done":** The test scans all button text content and checks for labels including `'all'`, `'active'` or `'pending'`, and `'done'` or `'complet'`.
- **`useState('all')`:** Stores the current filter as a string — the minimal state. Clicking a button calls `setFilter(name)`, triggering a re-render.
- **Derived `visibleTasks`:** Computed from `initialTasks` (the source of truth) and the `filter` state every render. The test checks `src.textContent.includes('.filter(')`. Storing a filtered copy in state would create a sync risk — the two copies could diverge.
- **Active filter highlighting:** The `btnStyle` helper returns a different background color when the filter matches the button's name (`filter === name`). This is conditional rendering inline.
- **`&&` pitfall avoided:** The filter logic uses an explicit `if`/`return` chain rather than `{count && <Badge />}`. If `count` were `0`, that pattern would render the literal number `0`.

---

## Step 7: Composition — Thinking in React

### `Avatar.jsx`

```jsx
function Avatar({ avatarUrl, username }) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16}}>
      <img
        src={avatarUrl}
        alt={username}
        style={{
          width: 80, height: 80,
          borderRadius: '50%',   // circular image
          objectFit: 'cover',
          marginBottom: 8
        }}
      />
      <span style={{fontWeight: 600, color: '#333'}}>@{username}</span>
    </div>
  );
}
```

### `StatBadge.jsx`

```jsx
function StatBadge({ label, value }) {
  return (
    <div style={{textAlign: 'center', padding: '8px 16px'}}>
      <div style={{fontSize: 20, fontWeight: 700}}>{value}</div>
      <div style={{fontSize: 12, color: '#666'}}>{label}</div>
    </div>
  );
}
```

### `App.jsx`

```jsx
function ProfileCard({ user }) {
  return (
    <div style={{
      border: '1px solid #e1e4e8', borderRadius: 12,
      padding: 24, maxWidth: 300,
      fontFamily: 'sans-serif', background: '#fff',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
    }}>
      <Avatar avatarUrl={user.avatarUrl} username={user.username} />
      <h3 style={{textAlign: 'center', margin: '0 0 16px'}}>{user.name}</h3>
      <div style={{display: 'flex', justifyContent: 'space-around', borderTop: '1px solid #eee', paddingTop: 16}}>
        <StatBadge label="Repos"     value={user.repos}      />
        <StatBadge label="Followers" value={user.followers}  />
        <StatBadge label="Following" value={user.following}  />
      </div>
    </div>
  );
}

function App() {
  const users = [
    {
      name: 'Ada Lovelace',
      username: 'ada-lovelace',
      avatarUrl: 'https://i.pravatar.cc/80?img=47',
      repos: 12, followers: 2048, following: 64
    },
    {
      name: 'Alan Turing',
      username: 'alan-turing',
      avatarUrl: 'https://i.pravatar.cc/80?img=60',
      repos: 7, followers: 9999, following: 3
    },
  ];

  return (
    <div style={{padding: 32, display: 'flex', gap: 24, flexWrap: 'wrap', background: '#f6f8fa', minHeight: '100vh'}}>
      {users.map(user => (
        <ProfileCard key={user.username} user={user} />
      ))}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

**Why this is correct:**

- **Two `<img>` elements:** The test checks `frame.contentDocument.querySelectorAll('img').length >= 2` — one `Avatar` per user, each rendering an `<img>`.
- **`borderRadius: '50%'`:** Makes the image circular. The test uses `getComputedStyle` to check that at least one `<img>` has a non-zero `borderRadius`.
- **Usernames displayed:** The test checks that the body text includes `'ada-lovelace'` or `'Ada Lovelace'` and `'alan-turing'` or `'Alan Turing'`.
- **Stats displayed:** The test checks that the body text includes `'12'` (Ada's repos) and `'2048'` (Ada's followers).
- **Both `Avatar` and `StatBadge` used:** The test reads all `text/babel` script tags and checks the combined source for both component names.
- **Composition over inheritance:** `ProfileCard` is built by composing `Avatar` + `StatBadge`, not by inheriting from either. This mirrors the React methodology: small, single-responsibility components composed into larger ones.

---

## Step 8: Integration Project: Build a Mini Store — `App.jsx`

```jsx
const products = [
  { id: 1, name: 'Wireless Mouse',       price: 29.99,  category: 'Electronics',  onSale: false },
  { id: 2, name: 'Mechanical Keyboard',   price: 89.99,  category: 'Electronics',  onSale: true  },
  { id: 3, name: 'USB-C Hub',             price: 45.99,  category: 'Electronics',  onSale: false },
  { id: 4, name: 'Laptop Stand',          price: 34.99,  category: 'Accessories',  onSale: true  },
  { id: 5, name: 'Desk Mat',              price: 19.99,  category: 'Accessories',  onSale: false },
  { id: 6, name: 'Cable Management Kit',  price: 14.99,  category: 'Accessories',  onSale: false },
];

// Component 1: Individual product card
function ProductCard({ product, onAdd }) {
  return (
    <div style={{
      border: '1px solid #ddd', borderRadius: 8, padding: 16,
      maxWidth: 220, fontFamily: 'sans-serif'
    }}>
      <h3 style={{margin: '0 0 8px'}}>{product.name}</h3>
      <p style={{margin: '0 0 4px', color: '#888', fontSize: 13}}>{product.category}</p>
      <p style={{margin: '0 0 8px', fontWeight: 700}}>${product.price.toFixed(2)}</p>
      {product.onSale && (
        <span style={{
          background: 'red', color: 'white',
          padding: '2px 8px', borderRadius: 4, fontSize: 12, marginBottom: 8, display: 'inline-block'
        }}>Sale!</span>
      )}
      <br />
      <button
        onClick={() => onAdd(product)}
        style={{marginTop: 8, padding: '6px 14px', cursor: 'pointer', borderRadius: 6, border: 'none', background: '#0078d4', color: '#fff'}}
      >
        Add to Cart
      </button>
    </div>
  );
}

// Component 2: Cart summary
function CartSummary({ cart }) {
  const total = cart.reduce((sum, item) => sum + item.price, 0).toFixed(2);
  return (
    <div style={{padding: 16, border: '1px solid #ccc', borderRadius: 8, marginBottom: 24, fontFamily: 'sans-serif'}}>
      <strong>Cart: {cart.length} item(s) — Total: ${total}</strong>
    </div>
  );
}

// Component 3: Category filter bar
function FilterBar({ filter, onFilter }) {
  const categories = ['All', 'Electronics', 'Accessories'];
  return (
    <div style={{display: 'flex', gap: 8, marginBottom: 16}}>
      {categories.map(cat => (
        <button
          key={cat}
          onClick={() => onFilter(cat)}
          style={{
            padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
            border: '1px solid #ccc',
            background: filter === cat ? '#0078d4' : '#fff',
            color: filter === cat ? '#fff' : '#333',
          }}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

function App() {
  const [cart, setCart] = React.useState([]);
  const [filter, setFilter] = React.useState('All');

  const addToCart = (product) => {
    setCart([...cart, product]);
  };

  const visibleProducts = products.filter(p =>
    filter === 'All' || p.category === filter
  );

  return (
    <div style={{fontFamily: 'sans-serif', padding: 32}}>
      <h1>Mini Store</h1>
      <CartSummary cart={cart} />
      <FilterBar filter={filter} onFilter={setFilter} />
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 16}}>
        {visibleProducts.map(product => (
          <ProductCard key={product.id} product={product} onAdd={addToCart} />
        ))}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

**Why this is correct:**

- **All 6 products displayed:** The test checks that both `'Wireless Mouse'` and `'Cable Management Kit'` appear in the body text.
- **`.map()` with `key` props:** The test checks `src.textContent.includes('.map(')` and the presence of `key=` in the source.
- **Prices displayed:** The test checks for `'29.99'` or `'$29.99'` in the body text.
- **"Add to Cart" buttons:** The test checks that at least one button text includes `'add'` or `'cart'` (case-insensitive).
- **Category filter buttons:** The test checks for an `'all'` button and either `'electronics'` or `'accessor'` (case-insensitive).
- **`useState`:** Two pieces of state: `cart` (array of added products) and `filter` (current category string). `setCart([...cart, product])` creates a new array — never mutates the existing one.
- **At least 3 components:** The test uses `source.match(/function\s+[A-Z]\w*\s*\(/)` to count capitalized component function declarations. `ProductCard`, `CartSummary`, `FilterBar`, and `App` give 4 components.
- **Thinking in React applied:** State lives in `App` (the lowest common ancestor of all components that need it). `FilterBar` receives `filter` and `onFilter` as props and calls `onFilter` when clicked — inverse data flow. `ProductCard` receives `onAdd` as a prop callback.
