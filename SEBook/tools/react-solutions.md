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

## Step 1: Hello, React! — Declarative vs. Imperative

### `styles.css`

```css
.greeting {
  color: #2774AE;          /* Changed from tomato */
}
```

### `App.jsx`

```jsx
function App() {
  const name = "CS35L";           // Changed from "World" to any non-"World" name

  return (
    <div className="p-4">
      <h1 className="greeting display-6 fw-bold">
        Hello, {name}!
      </h1>
      <p className="mt-2 text-secondary">Welcome to React.</p>
    </div>
  );
}

// Mount — you don't need to change this
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

**Why this is correct:**

- **Test 1 — heading no longer says "World":** The test reads the `<h1>` from the live DOM and checks `h1.textContent.trim() !== 'Hello, World!'`. Any name other than `"World"` passes.
- **Test 2 — color changed in CSS:** The test uses `getComputedStyle(h1).color` and checks it is not `rgb(255, 99, 71)` (tomato). Changing the color in `styles.css` to `#2774AE`, `blue`, or any other valid CSS color passes.
- **Declarative model:** You changed the `name` variable and the CSS color — not DOM nodes. React re-renders the component, builds a new Virtual DOM tree, diffs it against the old one, and patches only what changed in the real DOM.

---

## Step 2: Components & JSX — Fixer-Upper — `App.jsx`

```jsx
// A reusable Badge component — all three JSX bugs fixed
function Badge({ label, color }) {
  return (
    <span className="badge rounded-pill fw-semibold" style={{ background: color }}>
      {label}
    </span>
  );
}

function App() {
  return (
    // BUG 1 FIXED: Wrapped in a Fragment <> to provide single root element
    <>
      <h1 className="h3 mb-3">My Badges</h1>
      <div className="d-flex gap-2 mt-3">
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
- **Bug 3 — multiple root elements need a wrapper:** The original `App` returned two siblings without a wrapper. Wrap siblings in a `<>...</>` Fragment.
- **Third Badge added:** The test checks `spans.length >= 3`.

---

## Step 3: Props — Parameterizing Components — `App.jsx`

```jsx
const { Card, Badge } = ReactBootstrap;

function ProductCard({ name, price, description, onSale }) {
  return (
    <Card className="product-card">
      <Card.Body>
        <h3>{name}</h3>
        <p className="text-muted">${price.toFixed(2)}</p>
        <p>{description}</p>
        {onSale && <Badge bg="danger">Sale!</Badge>}
      </Card.Body>
    </Card>
  );
}

function App() {
  return (
    <div className="p-4 d-flex gap-4 flex-wrap">
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

- **`{name}` in `<h3>`:** Props are accessed by destructuring. The test checks that at least one `<h3>` contains `"Keyboard"`.
- **`price.toFixed(2)`:** Formats to exactly 2 decimal places.
- **`{onSale && <Badge bg="danger">Sale!</Badge>}`:** The `&&` short-circuit pattern. `Badge` is a react-bootstrap component that renders a styled span.
- **Props are read-only:** Props flow one-way — parent to child.

---

## Step 4: useState — Making Components Remember — `App.jsx`

```jsx
const { Button } = ReactBootstrap;

function Counter() {
  const [count, setCount] = React.useState(0);

  return (
    <div className="p-4 text-center">
      <h2 className="display-1 mb-4">{count}</h2>
      <div className="d-flex gap-2 justify-content-center">
        <Button variant="primary" size="lg" onClick={() => setCount(count + 1)}>+1</Button>
        <Button variant="secondary" size="lg" onClick={() => setCount(prev => Math.max(0, prev - 1))}>−1</Button>
        <Button variant="danger" size="lg" onClick={() => setCount(0)}>Reset</Button>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Counter />);
```

**Why this is correct:**

- **`React.useState(0)`:** Returns `[currentValue, setterFunction]`. The test checks `src.textContent.includes('useState')`.
- **`Button` components:** react-bootstrap's `<Button variant="primary">` renders a styled `<button>`. The `variant` prop controls the color.
- **`−1` button:** `setCount(prev => Math.max(0, prev - 1))` uses the functional update form and prevents negative values.
- **`Reset` button:** `setCount(0)` resets state to the initial value.

---

## Step 5: Lists & Keys — Rendering Collections — `App.jsx`

```jsx
const { ListGroup } = ReactBootstrap;

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
    <div className="p-4 checklist-container">
      <h2 className="h4 mb-3">React Learning Checklist</h2>

      <ListGroup>
        {tasks.map(task => (
          <ListGroup.Item key={task.id}>
            {task.done ? '✓' : '✗'} {task.text}
          </ListGroup.Item>
        ))}
      </ListGroup>

      <p className="text-muted small mt-3">
        {tasks.filter(t => t.done).length} / {tasks.length} complete
      </p>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<TaskList />);
```

**Why this is correct:**

- **`.map()` over `tasks`:** The test checks `src.textContent.includes('.map(')`.
- **`key={task.id}`:** Using `task.id` (a stable, unique identifier) — not the array index.
- **`ListGroup.Item`:** react-bootstrap's list group renders styled `<li>` elements automatically.
- **Ternary for done/undone:** `{task.done ? '✓' : '✗'}` conditionally renders the check or cross.

---

## Step 6: Conditional Rendering & Filtering — `App.jsx`

```jsx
const { Button, ButtonGroup, ListGroup } = ReactBootstrap;

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

  const visibleTasks = initialTasks.filter(task => {
    if (filter === 'active') return !task.done;
    if (filter === 'done')   return task.done;
    return true;
  });

  return (
    <div className="p-4 checklist-container">
      <h2 className="h4 mb-3">React Learning Checklist</h2>

      <ButtonGroup className="mb-3">
        <Button variant={filter === 'all' ? 'primary' : 'outline-secondary'} onClick={() => setFilter('all')}>All</Button>
        <Button variant={filter === 'active' ? 'primary' : 'outline-secondary'} onClick={() => setFilter('active')}>Active</Button>
        <Button variant={filter === 'done' ? 'primary' : 'outline-secondary'} onClick={() => setFilter('done')}>Done</Button>
      </ButtonGroup>

      <ListGroup>
        {visibleTasks.map(task => (
          <ListGroup.Item key={task.id}>
            {task.done ? '✓' : '✗'} {task.text}
          </ListGroup.Item>
        ))}
      </ListGroup>

      <p className="text-muted small mt-3">
        {initialTasks.filter(t => t.done).length} / {initialTasks.length} complete
      </p>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<TaskList />);
```

**Why this is correct:**

- **Three filter buttons:** `<Button variant={filter === 'all' ? 'primary' : 'outline-secondary'}>` toggles the button style based on the active filter. react-bootstrap's `variant` prop handles the color change.
- **`useState('all')`:** Stores the current filter as a string — the minimal state.
- **Derived `visibleTasks`:** Computed from `initialTasks` and the `filter` state every render. The test checks `src.textContent.includes('.filter(')`.

---

## Step 7: Composition — Thinking in React

### `Avatar.jsx`

```jsx
function Avatar({ avatarUrl, username }) {
  return (
    <div className="d-flex flex-column align-items-center mb-3">
      <img
        src={avatarUrl}
        alt={username}
        className="rounded-circle mb-2"
        width="80" height="80"
      />
      <span className="fw-semibold text-secondary">@{username}</span>
    </div>
  );
}
```

### `StatBadge.jsx`

```jsx
function StatBadge({ label, value }) {
  return (
    <div className="text-center px-3 py-2">
      <div className="fs-5 fw-bold">{value}</div>
      <div className="small text-muted">{label}</div>
    </div>
  );
}
```

### `App.jsx`

```jsx
const { Card } = ReactBootstrap;

function ProfileCard({ user }) {
  return (
    <Card className="shadow-sm profile-card">
      <Card.Body>
        <Avatar avatarUrl={user.avatarUrl} username={user.username} />
        <h3 className="text-center mb-3">{user.name}</h3>
        <div className="d-flex justify-content-around border-top pt-3">
          <StatBadge label="Repos"     value={user.repos}      />
          <StatBadge label="Followers" value={user.followers}  />
          <StatBadge label="Following" value={user.following}  />
        </div>
      </Card.Body>
    </Card>
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
    <div className="p-4 d-flex gap-4 flex-wrap bg-light min-vh-100">
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
- **`rounded-circle`:** Bootstrap class for `border-radius: 50%`. The test uses `getComputedStyle` to check `borderRadius`.
- **`Card` from react-bootstrap:** Used as the profile container. Students build `Avatar` and `StatBadge` as custom components and compose them inside.
- **Composition over inheritance:** `ProfileCard` is built by composing `Avatar` + `StatBadge`, not by inheriting from either.

---

## Step 8: Integration Project: Build a Mini Store — `App.jsx`

```jsx
const { Card, Button, Badge, ButtonGroup } = ReactBootstrap;

const products = [
  { id: 1, name: 'Wireless Mouse',       price: 29.99,  category: 'Electronics',  onSale: false },
  { id: 2, name: 'Mechanical Keyboard',   price: 89.99,  category: 'Electronics',  onSale: true  },
  { id: 3, name: 'USB-C Hub',             price: 45.99,  category: 'Electronics',  onSale: false },
  { id: 4, name: 'Laptop Stand',          price: 34.99,  category: 'Accessories',  onSale: true  },
  { id: 5, name: 'Desk Mat',              price: 19.99,  category: 'Accessories',  onSale: false },
  { id: 6, name: 'Cable Management Kit',  price: 14.99,  category: 'Accessories',  onSale: false },
];

function ProductCard({ product, onAdd }) {
  return (
    <Card className="product-card">
      <Card.Body>
        <h3 className="h6 fw-bold">{product.name}</h3>
        <p className="text-muted small mb-1">{product.category}</p>
        <p className="fw-bold mb-2">${product.price.toFixed(2)}</p>
        {product.onSale && <Badge bg="danger" className="mb-2">Sale!</Badge>}
        <br />
        <Button variant="primary" size="sm" onClick={() => onAdd(product)}>Add to Cart</Button>
      </Card.Body>
    </Card>
  );
}

function CartSummary({ cart }) {
  const total = cart.reduce((sum, item) => sum + item.price, 0).toFixed(2);
  return (
    <Card className="mb-4">
      <Card.Body>
        <strong>Cart: {cart.length} item(s) — Total: ${total}</strong>
      </Card.Body>
    </Card>
  );
}

function FilterBar({ filter, onFilter }) {
  const categories = ['All', 'Electronics', 'Accessories'];
  return (
    <ButtonGroup className="mb-3">
      {categories.map(cat => (
        <Button
          key={cat}
          variant={filter === cat ? 'primary' : 'outline-secondary'}
          onClick={() => onFilter(cat)}
        >
          {cat}
        </Button>
      ))}
    </ButtonGroup>
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
    <div className="p-4">
      <h1 className="h2 mb-4">Mini Store</h1>
      <CartSummary cart={cart} />
      <FilterBar filter={filter} onFilter={setFilter} />
      <div className="d-flex flex-wrap gap-3">
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
- **`.map()` with `key` props:** The test checks `src.textContent.includes('.map(')` and the presence of `key=`.
- **react-bootstrap components:** `Card`, `Button`, `Badge`, `ButtonGroup` provide consistent styling. Students build their own `ProductCard`, `CartSummary`, and `FilterBar` components using these building blocks.
- **`useState`:** Two pieces of state: `cart` (array) and `filter` (string).
- **At least 3 components:** `ProductCard`, `CartSummary`, `FilterBar`, and `App` give 4 components.
- **Thinking in React applied:** State lives in `App`. `FilterBar` receives `filter` and `onFilter` as props — inverse data flow.

{% endraw %}
