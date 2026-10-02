---
layout: sebook
title: Haskell
---

<!-- Authoring sources: CS131 intro_to_functional_programming_and_haskell_v10_handouts.pdf,
physical pages 5–149; docs/haskell-course-source-map.md; the three haskell tutorial YAML
files; docs/research/haskell-functional-pedagogy-2026-10-02/report.md. The research
informs prediction, explanation, contrast, and retrieval activities; it does not
establish measured learning gains for this chapter. Lecture transcripts are checked
against language semantics, particularly application grouping and persistent costs. -->

# Start: Learning Path {#your-learning-path}

Suppose a pricing function sometimes gives a different answer because another part of the program changed a global discount. Or an editor's undo history changes when the current document changes. Or a data pipeline produces the wrong records because two individually reasonable operations were put in the wrong order. These are problems about dependencies, state, and composition. Haskell makes those decisions explicit enough to study directly.

In this chapter, **pure functions** compute results from their arguments, **types** describe how values can fit together, and **immutable data** lets an old version remain available after an update. **Lazy evaluation** lets a consumer request only part of a computation. Each choice brings obligations: we still need correct business rules, complete cases, terminating searches, and a reasoned account of resource use. Learning Haskell gives you ways to analyze those obligations in other languages too.

Bring experience with functions, conditionals, lists, and basic recursion in Python or C++; no prior Haskell is required. After studying the examples and doing the practice, you should be able to:

- Derive a function's type from how it uses its arguments, and distinguish a type error from a wrong requirement.
- Build a recursive solution by identifying the data cases and explaining what the recursive result means.
- Choose and justify a sequence of transformations, filters, or accumulator updates.
- Explain which part of a lazy computation a requested result needs, and when that demand may never be satisfied.
- Model alternatives and recursive structures, then explain what an immutable update rebuilds and can reuse.

Use the chapter for explanations and the tutorials for implementation practice. Take the three parts in order, preferably across separate study sessions; the times are estimates, not deadlines.

1. **[Expressions, Types, and Recursion](/SEBook/tools/haskell-tutorial)** — 10 steps, about 90–110 minutes. Function application, type and boundary errors, tuples, lists, patterns, and recursion. [Part 1 print view](/SEBook/tools/haskell-tutorial/print).
2. **[Functions and Laziness](/SEBook/tools/haskell-functions-tutorial)** — 8 steps, about 80–100 minutes. Pipelines, closures, currying, higher-order types, accumulators, and finite observations of infinite lists. [Part 2 print view](/SEBook/tools/haskell-functions-tutorial/print).
3. **[Data and Persistent Programs](/SEBook/tools/haskell-data-tutorial)** — 9 steps, about 100–115 minutes. Variants, records, constraints, recursive data, persistent updates, and a pure event simulator. [Part 3 print view](/SEBook/tools/haskell-data-tutorial/print).

The [flashcards](#flashcards) and [quiz](#quiz) at the end provide additional retrieval and reasoning practice.

# Expressions

## Definitions describe values

```haskell
deliveryCost :: Int -> Int -> Int
deliveryCost base items = base + 3 * items

smallOrder :: Int
smallOrder = deliveryCost 5 2
```

Read `::` as “has type”. `deliveryCost` takes two `Int` arguments and produces an `Int`; `smallOrder` names the result `11`. The `=` introduces a definition. It does not update a storage location each time execution reaches that line.

The function has no hidden discount setting or changing counter. Given the same arguments, its result is the same. That makes a failing calculation reproducible: a test can supply `5` and `2` without recreating a sequence of global-state changes. Purity does not establish that the pricing rule is correct; a consistently wrong formula is still pure.

Haskell programs can perform input and output. This chapter concentrates on the pure calculations that can be tested independently of those actions. The tutorials provide the display harness.

## Application: identify the function and its argument

Function application uses spaces and binds more tightly than arithmetic operators:

```haskell
double :: Int -> Int
double x = 2 * x

-- Expressions and their results:
-- double 3 + 1     = 7
-- double (3 + 1)   = 8
-- deliveryCost 5 2 = (deliveryCost 5) 2
```

Application groups to the **left**: `f x y` means `(f x) y`. Parentheses change grouping; they are not a general requirement around an argument list. `deliveryCost (5, 2)` supplies one tuple and therefore does not match this function's interface.

Grouping describes the expression's structure, **not an instruction to evaluate arguments from left to right**. In `double (3 + 1)`, the argument to `double` is the expression `3 + 1`. How much of an argument must be evaluated depends on how the function uses it; we will revisit that under demand.

Operators can be used as ordinary functions: `(+) 3 4` gives `7`. Backticks allow a two-argument named function to appear between its arguments: ``17 `div` 5`` gives `3`. This is a change of notation, not a different division operation.

## Conditions choose a result

```haskell
shipping :: Int -> Int
shipping subtotal = if subtotal >= 50 then 0 else 5

ticketPrice :: Int -> Int
ticketPrice age
  | age < 0   = 0
  | age < 18  = 8
  | otherwise = 12
```

An `if` is an expression: it needs both branches, and the branches must have the same type. Returning `0` on one path and `"free"` on another mixes a number and text. Decide whether the function should compute a price or describe one before changing the annotation.

Guards try conditions in order; the first successful guard supplies the result. `otherwise` is `True`, so it belongs last. Here, returning `0` for a negative age is an explicit policy choice, not an error caught by `Int`.

**Predict and explain:** a programmer swaps the first two guards in `ticketPrice`. What happens for age `-1`? Why does the compiler accept both versions?

<details markdown="1">
<summary>Check your reasoning about guards</summary>

The original returns `0`. With `age < 18` first, `-1` returns `8`, because that guard already succeeds. Both versions return an `Int` on every branch. Type checking does not know which policy the author intended; a negative-age example tests a different obligation.

</details>

## Local names expose the reasoning

```haskell
invoice :: Int -> Int -> Int
invoice unitPrice quantity = subtotal + fee
  where
    subtotal = unitPrice * quantity
    fee = if subtotal >= 50 then 0 else 5

invoiceWithLet :: Int -> Int -> Int
invoiceWithLet unitPrice quantity =
  let subtotal = unitPrice * quantity
      fee = if subtotal >= 50 then 0 else 5
  in subtotal + fee
```

`where` attaches local bindings to a definition; `let ... in ...` is itself an expression. Both versions give names to intermediate ideas without exposing them as global definitions. The local expressions can refer to the enclosing parameters. Indentation groups the bindings, so align `subtotal` and `fee`.

# Types

## Representations constrain operations

Common types include bounded machine integers (`Int`), arbitrary-precision integers (`Integer`), floating-point numbers (`Float` and `Double`), Boolean values (`Bool`), and characters (`Char`). A `String` is a list of characters, written `[Char]`. Thus `'7'`, `"7"`, and `7` are different kinds of value. Arbitrary precision avoids a fixed integer bound, but large calculations still consume time and memory; floating-point calculations can round.

A tuple combines a fixed number of fields, which may have different types:

```haskell
submission :: (String, Int)
submission = ("parser.hs", 12)

-- fst submission = "parser.hs"
-- snd submission = 12
```

`fst` and `snd` select the components of a **pair**, not an arbitrary-size tuple. A list can have varying length but requires one element type. `[("a.hs", 12), ("b.hs", 9)]` is a list of `(String, Int)` pairs; `["a.hs", 12]` is not such a list.

The compiler can infer types from definitions. Explicit signatures still communicate the intended interface and make disagreements easier to locate. Consider:

```haskell
label :: Int -> String
label n = show n
```

Removing `show` would leave a body that returns the input number. Changing the signature to `Int -> Int` would make that version type-check, but it would also change the interface. If the caller needs display text, the conversion belongs in the implementation.

## Polymorphism preserves relationships

```haskell
swap :: (a, b) -> (b, a)
swap (x, y) = (y, x)

duplicate :: a -> (a, a)
duplicate x = (x, x)
```

Lowercase type variables stand for types. Within one use of `duplicate`, both output fields have the same type as the input. Separate uses can choose different types: `duplicate True` and `duplicate 'q'` are both valid. In `swap`, `a` and `b` may be different types, but they are also allowed to be the same.

This lets a library promise a useful relationship without knowing the application's payload. The signature alone is not a proof of termination or correctness: an implementation can still fail to produce a result.

## Constraints state which operations are needed

```haskell
same :: Eq a => a -> a -> Bool
same x y = x == y

larger :: Ord a => a -> a -> a
larger x y = if x >= y then x else y
```

Read `Eq a =>` as “for types `a` that support equality”. `Ord` supports ordering and includes equality. Other familiar constraints include `Num` for numeric operations, `Fractional` for `/`, and `Show` for conversion to display text. A type class describes supported operations; it is not an object-oriented class containing instances with mutable fields.

Constraints should follow the operations the function needs. Adding `Num` to `larger` would unnecessarily exclude strings. Ordering strings compares their characters lexicographically: `"9" > "10"` is `True`. An ordering operation is available, but that does not make it the right interpretation for numeric text.

**Apply the distinction:** should a score-ranking function accept `String` values merely because `Ord String` exists? State a representation choice and one failure it prevents.

<details markdown="1">
<summary>Compare a representation decision</summary>

If scores are quantities, represent validated scores as numbers before ranking them. This avoids treating `"9"` as greater than `"10"`. Keep text if the requirement really is lexicographic ordering, such as sorting identifiers. The decision comes from the meaning of the data, not just the availability of an operator.

</details>

# Lists

## Track the element type and the list shape

```haskell
-- 1 : [2,3]       = [1,2,3]
-- [1,2] ++ [3]    = [1,2,3]
-- [1,2] : [[3]]   = [[1,2],[3]]
-- "ab" ++ "cd"   = "abcd"
```

`(:)` adds **one element** to the front of a list. `(++)` joins **two lists** with the same element type. In the third example, the elements are themselves lists. Predict the type as well as the printed value; that exposes a nesting error before it reaches a later function.

Ranges such as `[2..5]` include the endpoint when it is reached; `[2,4..10]` uses the first two values to establish the step. `length` counts a finite list, `take n` keeps a prefix, and `drop n` skips one. `head` and `tail` require a nonempty list. Pattern matching often makes that boundary clearer than calling a partial operation and hoping its precondition holds.

## Build recursion from the data cases

A list is either empty, `[]`, or a head and a tail, `x:xs`. Mirror those cases in the definition:

```haskell
totalSquares :: [Int] -> Int
totalSquares [] = 0
totalSquares (x:xs) = x * x + totalSquares xs
```

For a finite list, `xs` is smaller than `x:xs`. Assume the recursive call gives the sum of squares of the remaining elements. The current case contributes `x * x` and combines it with that result. The base result `0` contributes nothing to a sum; it is chosen for that meaning, not because all recursion should return zero.

For `[2,3]`, the expression expands to `2*2 + (3*3 + 0)`, which gives `13`. This is a reasoning trace, not a claim about an eager execution schedule. More useful than memorizing the trace is being able to explain what `totalSquares xs` represents.

Equations are tried in order. A variable pattern matches any value; `_` matches without giving the value a name. Put specific cases before a catch-all case. For example, a definition starting with `size xs = 0` would prevent later list cases from being reached.

List patterns also distinguish exact lengths from prefixes. `[x]` matches exactly one element; `[x,y]` matches exactly two; `(x:y:rest)` matches at least two and binds the remaining list to `rest`. A function that consumes pairs at a time therefore needs to account for `[]`, a leftover singleton, and the two-or-more case. Using `[x,y]` for the last case would miss longer lists.

**Complete and justify:** for a function that checks whether every number is positive, what should the empty-list case return? Explain how your answer affects a one-element list whose element is positive.

<details markdown="1">
<summary>Check the base-case reasoning</summary>

It should return `True`: an empty list has no violating element. With a recursive step `x > 0 && allPositive xs`, a positive last element combines with `True` and stays `True`. An empty-case `False` would make every finite list fail, even if all its elements were positive. A base case is part of the specification.

</details>

## Comprehensions separate generation and selection

```haskell
nearbyPairs :: [(Int, Int)]
nearbyPairs = [(x,y) | x <- [1..3], y <- [x..3], x /= y]

-- Result: [(1,2),(1,3),(2,3)]
```

Read this as: choose `x`; for each `x`, choose `y` from its dependent range; keep candidates where `x /= y`; produce `(x,y)`. The leftmost generator supplies the outer grouping of results. The expression before `|` determines the output element type.

Use a comprehension when the candidate sources and conditions make the relationship easy to read. Use structural recursion when the next step depends on the remaining structure or accumulated state. For instance, “keep every affordable item” differs from “stop at the first item that would exceed a running budget”. A filter over independent items cannot express that second rule by itself.

# Functions

## Pass behavior as a value

```haskell
map    :: (a -> b) -> [a] -> [b]
filter :: (a -> Bool) -> [a] -> [a]
```

These are library signatures, not definitions to add to your program. `map` transforms each element and may change its type. `filter` selects elements using a predicate and preserves their type. A **higher-order function** accepts or returns a function; both `map` and `filter` accept one as an argument.

```haskell
addFee :: Int -> Int
addFee price = price + 3

affordable :: Int -> Bool
affordable price = price <= 10

finalPrices :: [Int]
finalPrices = filter affordable (map addFee [6,9])

-- map addFee [6,9] = [9,12]
-- finalPrices = [9]
```

The order encodes a requirement. `map addFee (filter affordable [6,9])` gives `[9,12]`: it selects using the original price. Both pipelines type-check. Choose the first if the final charged price must be at most `10`; choose the second if eligibility is based on the original price. An intermediate value and a boundary example explain more than the claim that one order “looks cleaner”.

## Lambdas and lexical scope

An anonymous function, or **lambda**, gives behavior a value without a top-level name:

```haskell
-- map (\price -> price + 3) [6,9] = [9,12]

makeAdder :: Int -> (Int -> Int)
makeAdder amount = \x -> x + amount

addFive :: Int -> Int
addFive = makeAdder 5

shadowExample :: Int
shadowExample = let amount = 100 in addFive 2
-- Result: 7
```

`makeAdder` is higher-order because it returns a function. `addFive` is a function value that retains access to the `amount` bound when it was created. This combination of behavior and its lexical environment is a **closure**. The unrelated local `amount` at the call site does not change it. This matters when configuring callbacks: the place where a function is defined determines which binding it refers to.

Name a helper when the name explains a reusable idea. A short lambda can make a local transformation readable; a large anonymous body can hide that idea.

## Currying makes partial application useful

```haskell
add :: Int -> Int -> Int
add x y = x + y

addTuple :: (Int, Int) -> Int
addTuple (x,y) = x + y

-- add 5       :: Int -> Int
-- add 5 2     :: Int
-- addTuple (5,2) :: Int
```

Function arrows group to the **right**: `Int -> Int -> Int` means `Int -> (Int -> Int)`. `add` is equivalent to `\x -> (\y -> x + y)`. Representing a multi-argument operation as successive one-argument functions is **currying**. Supplying only some arguments, as in `add 5`, is **partial application**: the result awaits the remaining argument. The tuple version instead accepts one pair.

Argument order becomes an interface decision. A function taking configuration first lets callers reuse a configured function, such as `deliveryCost 5`, across many quantities. A tuple interface may suit data already stored as pairs, but `addTuple 5` does not partially configure it.

To derive a higher-order type, follow the flow of values:

```haskell
through :: (a -> b) -> (b -> c) -> a -> c
through f g x = g (f x)
```

Start with `x :: a`. Because `f` accepts `x`, write `f :: a -> b`. Because `g` accepts the result of `f`, write `g :: b -> c`. The whole result is `c`. The shared `b` is the connection between the stages; forcing `a`, `b`, and `c` to be the same type would restrict a useful interface.

**Transfer:** use `through` to count a string and turn that count into display text. Which functions fill the two positions? What intermediate type connects them?

<details markdown="1">
<summary>Check the type connection</summary>

`through length show "haskell"` gives `"7"`. For this use, `a` is `String`, `b` is `Int` (the result of `length`), and `c` is `String`. The second function receives a count, not the original string. Grouping `show (length "haskell")` establishes that dependency without imposing eager evaluation of every argument in general.

</details>

# Demand

## Give the accumulator a meaning

```haskell
totalFrom :: Int -> [Int] -> Int
totalFrom acc [] = acc
totalFrom acc (x:xs) = totalFrom (acc + x) xs
```

The accumulator represents the initial amount plus the elements already processed. The remaining list represents work still to do. At the empty case, no work remains, so return the accumulator. `totalFrom 10 [2,3]` therefore gives `15`. An accumulator need not be numeric: it might hold a count and a total in a pair, or a record of a simulated system.

`foldl` packages this pattern for a list:

```haskell
-- Library signature:
-- foldl :: (b -> a -> b) -> b -> [a] -> b

-- foldl (+) 10 [2,3] = 15
-- foldl (-) 10 [2,3] = (10 - 2) - 3 = 5
```

The combining function receives the accumulator first and the next element second, then returns the next accumulator. The seed and final result have type `b`; elements have type `a`. They need not be the same type.

The subtraction example distinguishes a left fold from `10 - (2 - 3)`, which is `11`. The grouping defines the result; it does not promise eager accumulator evaluation or constant memory. Use a fold when one uniform update captures the traversal clearly. Keep explicit recursion when the stopping rule or data shape is clearer that way.

## Demand determines how much work is needed

```haskell
positive :: [Integer]
positive = [1..]

negative :: Integer -> Bool
negative n = n < 0
```

`positive` describes an unbounded sequence. A program need not construct the entire sequence before a consumer can use its prefix. Conversely, asking to display the entire list cannot finish.

| Expression | Complete result | Search needed |
| --- | --- | --- |
| `take 2 (filter even positive)` | `[2,4]` | Inspect candidates through `4` to obtain two matches. |
| `filter even (take 2 positive)` | `[2]` | Inspect only candidates `1` and `2`. |
| `take 1 (filter negative positive)` | No complete result | Keep searching: no candidate matches. |
| `take 0 (filter negative positive)` | `[]` | No candidate search is needed. |

A bound on **matching outputs** differs from a bound on **input positions**. For a search tool, “show the first ten matches” and “search the first ten records” have different behavior and different stopping conditions. Even a request for one match may never finish. These examples use predicates that terminate for each candidate; a predicate that itself fails to terminate introduces another reason the search can get stuck.

Laziness also applies beyond lists. A function `ignore x = 42` can return `42` without evaluating `x`. An `if` needs its condition to choose a branch, then demands only the selected branch's result. Demand comes from operations that need values, not only from printing.

**Evaluate a claim:** a teammate says, “Adding `take 10` guarantees our infinite candidate search will terminate”. Give a counterexample, then state an additional condition under which a finite prefix can be produced.

<details markdown="1">
<summary>Check the termination argument</summary>

`take 10 (filter negative positive)` never produces even its first element. To obtain ten matches, the producer must reach ten matching candidates after finitely many productive steps, and each required predicate test must terminate. If the requirement is instead a fixed search budget, bound the input positions before filtering and accept that fewer than ten results may be found.

</details>

# Data

## Alternatives make cases visible

```haskell
data Priority = Routine | Urgent
  deriving (Eq, Show)

data Delivery = Collect | Ship String
  deriving (Eq, Show)

deliveryLabel :: Delivery -> String
deliveryLabel Collect = "Collect at desk"
deliveryLabel (Ship address) = "Ship to " ++ address
```

`Priority` is a type with two constructor values. `Delivery` has alternatives with different shapes: `Collect` has no payload; `Ship` carries a `String`. `Ship :: String -> Delivery` is a constructor function, while `Ship "West Hall" :: Delivery` is a constructed value. Type and constructor names start with uppercase letters.

A type built from alternatives and their fields in this way is an **algebraic data type**. The declaration makes its possible shapes explicit.

This representation rules out a meaningless combination such as “collect at desk, with a required shipping address”. It does not ensure that the string inside `Ship` is a valid address. Types can remove some invalid states while leaving other conditions to validation.

Pattern matching both distinguishes alternatives and gives names to their contents. `deliveryLabel` handles both constructors. If the model gains another alternative, revisit the functions that interpret it; a missing case can fail when demanded at runtime. `deriving` supplies standard instances such as equality and display. A displayed representation is not domain validation.

## Records name fields; updates return new values

```haskell
data Account = Account
  { owner :: String
  , credits :: Int
  } deriving (Show)

addCredits :: Int -> Account -> Account
addCredits amount (Account name balance) =
  Account name (balance + amount)
```

The field declarations provide selectors such as `owner :: Account -> String` and `credits :: Account -> Int`. The pattern binds the old fields; the final expression constructs the result. For `old = Account "Ada" 20` and `new = addCredits 5 old`, `credits old` remains `20` and `credits new` is `25`.

Names make a record easier to interpret than a large tuple. They do not prevent `addCredits (-30) old` from producing a negative balance. If the domain forbids that, specify and implement a rejection policy. Immutability and validity are separate properties.

## Recursive types describe recursive problems

```haskell
data Expr
  = Number Int
  | Plus Expr Expr
  | Times Expr Expr
  deriving (Show)

evaluate :: Expr -> Int
evaluate (Number n) = n
evaluate (Plus left right) = evaluate left + evaluate right
evaluate (Times left right) = evaluate left * evaluate right

exampleExpr :: Expr
exampleExpr = Times (Plus (Number 2) (Number 3)) (Number 4)
-- evaluate exampleExpr = 20
```

`Plus` and `Times` hold child expressions. The interpreter follows that shape: one base case and one recursive equation for each compound constructor. This is the same reasoning used for list recursion, applied to a branching structure. Compilers, formula editors, and configuration languages need this distinction between a representation and a computation over it.

**Extend the model:** if you add `Negate Expr`, what equation must `evaluate` gain? Which existing example would fail to reveal a missing new case?

<details markdown="1">
<summary>Check the extension</summary>

Add `evaluate (Negate expression) = negate (evaluate expression)`. The existing `exampleExpr` contains no `Negate`, so its result remains `20` even if the new equation is missing. Include a new-constructor example, including a nested one, to test the extended interpreter. Existing passing examples do not establish coverage of a new data alternative.

</details>

Recursive children can also come in a list rather than a fixed pair:

```haskell
data Folder = Folder String [Folder]
  deriving (Show)

folderCount :: Folder -> Int
folderCount (Folder _ children) = 1 + sum (map folderCount children)
```

`map folderCount children` produces one count per child folder. `sum` adds those counts, and `1` includes the current folder. A leaf has an empty child list, so its count is `1 + sum []`, or `1`. The base case is carried by the empty list; this model does not need a separate leaf constructor.

# Updates: Persistent Programs {#persistence}

## Rebuild a changed path, retain the old version

A persistent structure keeps previous versions usable after an update. Consider a trail of named stops:

```haskell
data Trail = End | Stop String Trail
  deriving (Show)

removeStop :: Int -> Trail -> Trail
removeStop _ End = End
removeStop n trail | n < 0 = trail
removeStop 0 (Stop _ rest) = rest
removeStop n (Stop name rest) =
  Stop name (removeStop (n - 1) rest)

original :: Trail
original = Stop "A" (Stop "B" (Stop "C" End))

updated :: Trail
updated = removeStop 1 original
```

The contract uses a zero-based position; negative and out-of-range positions leave the sequence of stops unchanged. Removing position `1` keeps A, removes B, and returns the suffix beginning at C. The retained prefix must point to the new tail, so the definition reconstructs that prefix instead of changing the old one.

For this particular update, name the unchanged suffix to expose the relationship between the two shapes:

| Binding | Constructor expression |
| --- | --- |
| `suffix` | `Stop "C" End` |
| Original shape | `Stop "A" (Stop "B" suffix)` |
| Updated shape | `Stop "A" suffix` |

The original trail still contains A, then B, then C, then `End`. The updated trail starts with a reconstructed A whose tail can reuse the C-and-`End` suffix. No link in the original trail is changed.

This is a model of constructors in the direct source definition: one retained `Stop` before the removed position is rebuilt. It is not a measurement of heap allocations or proof of physical object identity after compiler optimization. The old and new trails may share the unchanged suffix safely because neither can mutate it.

## State the assumptions behind a cost claim

In the direct source algorithm, when the result is demanded through a valid removal position `k`, the function visits that prefix and reconstructs its `k` retained stops. An update near the end of a long chain therefore does more work than one near the front when that part of the result is needed. Observing only an earlier prefix can defer the remaining work. Rebuilding list links does not require copying the contents of every payload value.

A tree update can similarly reconstruct only the path to the change, while reusing unaffected branches. Its path cost depends on **tree height**. A balanced binary search tree has logarithmic height; a badly skewed tree can have linear height. Immutability alone does not balance a tree.

When removing the minimum from a nonempty binary search tree, reaching a node with no left child identifies the minimum. Return that node's **right subtree**, not an empty tree: the right subtree may contain values that must survive. While returning from recursion, reconstruct the ancestors with their updated left children. This is both a correctness argument and an account of which path changes.

Persistence is useful for undo histories, snapshots, and comparing versions. Keeping old roots alive can also keep data reachable and consume memory. The useful design question is which versions the application needs to retain, not whether immutable data is universally cheaper.

## Make state transitions explicit

A simulation can represent a transition as a function taking an event and a state and returning a new state. The caller decides which result becomes the next state and which previous versions to keep. Given the same initial state and event sequence, a pure transition function lets you reproduce the same calculation, which is useful for investigating a failed scenario.

External observations such as a clock reading must be supplied explicitly if the transition needs them. Purity does not make the surrounding input/output system deterministic, and immutable values alone do not make every concurrent program free of races. The [persistent-data tutorial](/SEBook/tools/haskell-data-tutorial) develops the state model and tests the transition rules.

**Design reflection:** an editor wants undo and a current document view. Explain why retaining immutable versions helps. Then identify a cost that grows if it retains every version forever, and a policy that could bound that cost.

<details markdown="1">
<summary>Compare the trade-off</summary>

An update can produce a new document without altering the version needed for undo. Unchanged structure can be reused across versions. However, retained roots keep their reachable data alive; sharing does not make an unlimited history free. A bounded undo window or selected checkpoints can limit retained history, at the cost of losing some older undo steps. The right policy depends on the editor's requirements.

</details>

# Practice {#a-useful-study-loop}

Before running an example, commit to a prediction and a reason. Compare the result with that prediction, explain the gap, then change one thing. When a check passes, invent an input that would reject a tempting wrong approach. For example, an empty list tests a recursive base case; a price crossing the fee boundary distinguishes pipeline orders; a minimum node with a right child tests preservation of tree contents.

Use the [first tutorial](/SEBook/tools/haskell-tutorial) to practice expressions and recursive cases, the [second](/SEBook/tools/haskell-functions-tutorial) for higher-order interfaces and demand, and the [third](/SEBook/tools/haskell-data-tutorial) for data models and persistent transitions. The knowledge checks ask you to apply the concepts and explain design consequences. The decks below add practice with types, list shape, recursion, currying, pipelines, folds, and recursive data; use the tutorial checks as well for records, laziness, and persistence.

Return the next day and recreate a small function from memory. A week later, solve a related problem with different data before consulting your notes. Away from the editor, derive a function's type, explain a recursive result, and choose a counterexample to a proposed implementation. Then attempt a full course problem combining those skills. Passing individual checks gives evidence about those cases; it does not by itself establish readiness for a timed, multi-part exam.

## The Browser Workspace {#the-browser-workspace}

The tutorials use the site's locally pinned MicroHs Haskell runtime. **Run** reloads the current workspace and executes the supplied `main` display action; **Test My Work** checks the functions directly. Each new step has its own starter, and **Reset Step** restores that starter. Hints become more specific as you open them; instructor solutions are available for comparison after an attempt.

The runtime supports the course features used here. It is a compact implementation rather than the complete Glasgow Haskell Compiler toolchain, and diagnostic wording may differ from the lecture's interpreter. Interactive terminal input, external packages, and compiler-specific extensions are outside these exercises. The output harness is supplied; monad theory is outside this course path.

The [Haskell report on expressions](https://www.haskell.org/onlinereport/haskell2010/haskellch3.html), [declarations and bindings](https://www.haskell.org/onlinereport/haskell2010/haskellch4.html), and [standard library definitions](https://www.haskell.org/onlinereport/haskell2010/haskellch9.html) provide language references after practice.

## Flashcards

Retrieve an answer before revealing it, then explain one example where the distinction matters. You can also [open the functional-programming flashcards in SE Gym](/se-gym/?flashcards=cs131_functional).

{% include flashcards.html id="cs131_functional" heading_level=3 %}

## Quiz

Commit to a reason before checking an answer. When feedback exposes a gap, construct a new example that distinguishes your original reasoning from the corrected model. You can also [open the functional-programming quiz in SE Gym](/se-gym/?quiz=cs131_functional).

{% include quiz.html id="cs131_functional" heading_level=3 %}
