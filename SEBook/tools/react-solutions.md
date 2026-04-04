---
title: "React Essentials — Sample Solutions"
layout: sebook
---

{% raw %}

# React Essentials: From Imperative to Declarative UI — Sample Solutions

These are reference solutions for each exercise in the interactive tutorial.
Each solution explains **why** it is correct, connecting the code back to the
concepts taught in that step.

---

## Step 1: Hello, React! — Declarative vs. Imperative — `App.jsx`

```jsx
function App() {
  const name = "Alex";           // Changed from "World" to any non-"World" name

  return (
    <div className="p-8 font-sans">
      <h1 className="text-blue-600 text-3xl font-bold">
        Hello, {name}!
      </h1>
      <p className="mt-2 text-gray-600">Welcome to React.</p>
    </div>
  );
}

// Mount — you don't need to change this
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

**Why this is correct:**

- **Test 1 — heading no longer says "World":** The test reads the `<h1>` from the live DOM and checks `h1.textContent.trim() !== 'Hello, World!'`. Any name other than `"World"` passes.
- **Test 2 — color class changed:** The test checks that the `<h1>` no longer has the `text-red-500` class. Any other Tailwind color class (e.g., `text-blue-600`, `text-green-600`, `text-purple-500`) passes.
- **Declarative model:** You changed the `name` variable and the `className` — not DOM nodes. React re-renders the component, builds a new Virtual DOM tree, diffs it against the old one, and patches only what changed in the real DOM.

---

## Step 2: Components & JSX — Fixer-Upper — `App.jsx`

```jsx
// A reusable Badge component — all four JSX bugs fixed
function Badge({ label, color }) {
  return (
    <span className="inline-block px-3 py-1 rounded-full font-semibold text-gray-800" style={{ background: color }}>
      {label}
    </span>
  );
}

function App() {
  return (
    // BUG 1 FIXED: Wrapped in a Fragment <> to provide single root element
    <>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">My Badges</h1>
      <div className="flex gap-3 mt-4">
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

- **Bug 1 — `style` must be a JS object, not a string:** The original `style="background: color;"` is an HTML attribute string. In JSX, `style` takes a JavaScript object: `style={{ background: color }}`. Because `color` is a **dynamic prop**, it stays as an inline style. The test checks that at least 2 spans have a background color applied via `element.style.background`.
- **Bug 2 — `class` → `className`:** The original `<h1 class="...">` uses an HTML attribute name. `class` is a reserved keyword in JavaScript, so JSX uses `className`.
- **Bug 3 — multiple root elements need a wrapper:** The original `App` returned two siblings (`<h1>` and `<div>`) without a wrapper. Wrap siblings in a `<>...</>` Fragment.
- **Third Badge added:** The test checks `spans.length >= 3`.

---

## Step 3: Props — Parameterizing Components — `App.jsx`

```jsx
function ProductCard({ name, price, description, onSale }) {
  return (
    <div className="border border-gray-300 rounded-lg p-5 max-w-xs shadow-sm">
      {/* 1. Product name as <h3> */}
      <h3 className="text-lg font-bold">{name}</h3>

      {/* 2. Price formatted to 2 decimal places */}
      <p className="text-gray-700">${price.toFixed(2)}</p>

      {/* 3. Description in a <p> */}
      <p className="text-sm text-gray-500">{description}</p>

      {/* 4. "Sale!" badge shown only when onSale is true */}
      {onSale && (
        <span className="inline-block bg-red-500 text-white px-2 py-0.5 rounded text-xs mt-2">
          Sale!
        </span>
      )}
    </div>
  );
}

function App() {
  return (
    <div className="p-8 flex gap-6 flex-wrap">
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
- **`price.toFixed(2)`:** Formats to exactly 2 decimal places. The test looks for `'129.99'` or `'$129.99'` in the body text.
- **`{onSale && <span>Sale!</span>}`:** The `&&` short-circuit pattern: if `onSale` is `true`, React renders the `<span>`; if `false`, it renders nothing.
- **Props are read-only:** Props flow one-way — parent to child.

---

## Step 4: useState — Making Components Remember — `App.jsx`

```jsx
function Counter() {
  // Fix: use useState instead of a regular let variable
  const [count, setCount] = React.useState(0);

  return (
    <div className="p-8 text-center">
      <h2 className="text-5xl mb-6">{count}</h2>
      <div className="flex gap-3 justify-center">

        {/* +1 button */}
        <button className="px-6 py-2 text-lg rounded-lg bg-blue-600 text-white cursor-pointer"
                onClick={() => setCount(count + 1)}>
          +1
        </button>

        {/* −1 button — don't go below 0 */}
        <button className="px-6 py-2 text-lg rounded-lg bg-gray-500 text-white cursor-pointer"
                onClick={() => setCount(prev => Math.max(0, prev - 1))}>
          −1
        </button>

        {/* Reset button */}
        <button className="px-6 py-2 text-lg rounded-lg bg-red-600 text-white cursor-pointer"
                onClick={() => setCount(0)}>
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
- **Why `let count = 0` fails:** Every time React re-renders the component, it calls the function fresh. A `let count = 0` is reset to `0` on every call.
- **`+1` button:** `onClick={() => setCount(count + 1)}` passes the new value to the setter.
- **`−1` button:** `setCount(prev => Math.max(0, prev - 1))` uses the functional update form and prevents negative values.
- **`Reset` button:** `setCount(0)` resets state to the initial value.

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
    <div className="p-8 max-w-lg">
      <h2 className="text-xl font-bold mb-4">React Learning Checklist</h2>

      <ul className="list-none p-0">
        {/* .map() with task.id as key */}
        {tasks.map(task => (
          <li key={task.id}>
            {task.done ? '✓' : '✗'} {task.text}
          </li>
        ))}
      </ul>

      <p className="text-gray-400 text-sm mt-3">
        {tasks.filter(t => t.done).length} / {tasks.length} complete
      </p>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<TaskList />);
```

**Why this is correct:**

- **`.map()` over `tasks`:** The test checks `src.textContent.includes('.map(')`. Each call transforms the array of objects into an array of JSX elements.
- **`key={task.id}`:** Using `task.id` (a stable, unique identifier from the data) — not the array index.
- **Ternary for done/undone:** `{task.done ? '✓' : '✗'}` conditionally renders the check or cross.

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

  return (
    <div className="p-8 max-w-lg">
      <h2 className="text-xl font-bold mb-4">React Learning Checklist</h2>

      {/* Filter buttons */}
      <div className="flex gap-2 mb-4">
        <button className={`px-4 py-1 rounded-md border cursor-pointer ${filter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                onClick={() => setFilter('all')}>All</button>
        <button className={`px-4 py-1 rounded-md border cursor-pointer ${filter === 'active' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                onClick={() => setFilter('active')}>Active</button>
        <button className={`px-4 py-1 rounded-md border cursor-pointer ${filter === 'done' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                onClick={() => setFilter('done')}>Done</button>
      </div>

      <ul className="list-none p-0">
        {visibleTasks.map(task => (
          <li key={task.id} className="py-2 border-b border-gray-200">
            {task.done ? '✓' : '✗'} {task.text}
          </li>
        ))}
      </ul>

      <p className="text-gray-400 text-sm mt-3">
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
- **`useState('all')`:** Stores the current filter as a string — the minimal state.
- **Derived `visibleTasks`:** Computed from `initialTasks` (the source of truth) and the `filter` state every render. The test checks `src.textContent.includes('.filter(')`.
- **Active filter highlighting:** The template literal toggles Tailwind classes (`bg-blue-600 text-white` for active, `bg-white text-gray-700` for inactive). This is a common React pattern: conditional **className** instead of conditional inline style objects.
- **`&&` pitfall avoided:** The filter logic uses an explicit `if`/`return` chain rather than `{count && <Badge />}`.

---

## Step 7: Composition — Thinking in React

### `Avatar.jsx`

```jsx
function Avatar({ avatarUrl, username }) {
  return (
    <div className="flex flex-col items-center mb-4">
      <img
        src={avatarUrl}
        alt={username}
        className="w-20 h-20 rounded-full object-cover mb-2"
      />
      <span className="font-semibold text-gray-700">@{username}</span>
    </div>
  );
}
```

### `StatBadge.jsx`

```jsx
function StatBadge({ label, value }) {
  return (
    <div className="text-center px-4 py-2">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
```

### `App.jsx`

```jsx
function ProfileCard({ user }) {
  return (
    <div className="border border-gray-200 rounded-xl p-6 max-w-xs bg-white shadow-md">
      <Avatar avatarUrl={user.avatarUrl} username={user.username} />
      <h3 className="text-center mb-4">{user.name}</h3>
      <div className="flex justify-around border-t border-gray-200 pt-4">
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
    <div className="p-8 flex gap-6 flex-wrap bg-gray-50 min-h-screen">
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

- **Two `<img>` elements:** One `Avatar` per user, each rendering an `<img>`.
- **`rounded-full`:** The Tailwind class applies `border-radius: 50%`, making the image circular. The test uses `getComputedStyle` to check `borderRadius`.
- **Usernames and stats displayed:** The test checks the body text for both usernames and stat values.
- **Both `Avatar` and `StatBadge` used:** The test reads all script tags and checks for both component names.
- **Composition over inheritance:** `ProfileCard` is built by composing `Avatar` + `StatBadge`, not by inheriting from either.

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
    <div className="border border-gray-300 rounded-lg p-4 max-w-[220px]">
      <h3 className="font-bold mb-1">{product.name}</h3>
      <p className="text-gray-400 text-sm">{product.category}</p>
      <p className="font-bold mb-2">${product.price.toFixed(2)}</p>
      {product.onSale && (
        <span className="inline-block bg-red-500 text-white px-2 py-0.5 rounded text-xs mb-2">Sale!</span>
      )}
      <br />
      <button className="mt-2 px-3 py-1 rounded-md bg-blue-600 text-white cursor-pointer text-sm"
              onClick={() => onAdd(product)}>
        Add to Cart
      </button>
    </div>
  );
}

// Component 2: Cart summary
function CartSummary({ cart }) {
  const total = cart.reduce((sum, item) => sum + item.price, 0).toFixed(2);
  return (
    <div className="p-4 border border-gray-300 rounded-lg mb-6">
      <strong>Cart: {cart.length} item(s) — Total: ${total}</strong>
    </div>
  );
}

// Component 3: Category filter bar
function FilterBar({ filter, onFilter }) {
  const categories = ['All', 'Electronics', 'Accessories'];
  return (
    <div className="flex gap-2 mb-4">
      {categories.map(cat => (
        <button
          key={cat}
          onClick={() => onFilter(cat)}
          className={`px-3 py-1 rounded-md border cursor-pointer ${filter === cat ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
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
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Mini Store</h1>
      <CartSummary cart={cart} />
      <FilterBar filter={filter} onFilter={setFilter} />
      <div className="flex flex-wrap gap-4">
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
- **Category filter buttons:** The test checks for an `'all'` button and either `'electronics'` or `'accessor'`.
- **`useState`:** Two pieces of state: `cart` (array) and `filter` (string). `setCart([...cart, product])` creates a new array �� never mutates the existing one.
- **At least 3 components:** `ProductCard`, `CartSummary`, `FilterBar`, and `App` give 4 components.
- **Thinking in React applied:** State lives in `App` (the lowest common ancestor). `FilterBar` receives `filter` and `onFilter` as props — inverse data flow.

{% endraw %}
