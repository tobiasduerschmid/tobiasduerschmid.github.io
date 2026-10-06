---
layout: sebook
title: Haskell
---

<script src="/js/unix-command-lab.js" defer></script>
<script src="/js/program-output-lab.js" defer></script>
<script type="module" src="/js/haskell/chapter-evaluator.js"></script>
<link rel="stylesheet" href="/css/unix-command-lab.css">
<link rel="stylesheet" href="/css/program-output-lab.css">
<link rel="stylesheet" href="/css/haskell-evaluator.css">
<link rel="stylesheet" href="/css/print-light.css">

<!-- Authoring sources: CS131 intro_to_functional_programming_and_haskell_handouts_td
(the lecture's concepts; every example here deliberately differs from the lecture's),
the three haskell tutorial YAML files, and
docs/research/haskell-functional-pedagogy-2026-10-02/report.md. Each section is one
guided experiment: a small editable example, predictions to commit to before
evaluating, an explanation to check against, and a change to try. The research informs
these prediction, contrast, and retrieval activities; it does not establish measured
learning gains for this chapter. tests/haskell-chapter-evaluator.spec.js evaluates
every starting expression; check new "Predict, then evaluate" items in the browser. -->

# Start: Learning Path {#your-learning-path}

Haskell is a purely functional programming language. A program is a set of definitions, names never change their values, and the compiler checks how values fit together before anything runs. This chapter teaches Haskell through small experiments that run in your browser. Each one shows a few lines of code next to an evaluator: predict what an expression produces, evaluate it, check the explanation, and then change the code to test your own idea.

Bring experience with functions, conditionals, arrays or lists, and basic recursion in C++ or Python; no prior Haskell is required. By the end, you should be able to:

- Explain what makes a function pure, and why purity lets Haskell evaluate an expression only when its value is needed.
- Predict how Haskell groups function application, operators, conditionals, guards, and local definitions.
- Write recursive list functions with guards and patterns, and build lists with ranges and comprehensions.
- Read and infer types, including tuples, type variables, and type-class constraints.
- Use `map`, `filter`, and `foldl`, and create functions with lambdas, closures, partial application, and currying.
- Define algebraic data types, and explain what an update to an immutable list or tree rebuilds and what it shares.

## How to Run an Experiment

1. **Predict.** Read the code and decide what the expression in the box will produce.
2. **Evaluate.** Press **Evaluate** or Enter. The first evaluation loads the compiler, which takes a few seconds.
3. **Explore.** Work through the **Predict, then evaluate** list. Commit to each prediction before you evaluate it. Put `:type` in front of an expression to see its type instead of its value.
4. **Explain.** Open the explanation under the list. When a result surprised you, state the rule you relied on and the rule Haskell follows.
5. **Change.** Edit the code to try your own idea. **Reset code** restores the example.

Expect some wrong predictions. Haskell differs from C++ and Python in deliberate ways, and a surprising result points to the rule worth revisiting.

The evaluators work like {% include abbr.html term="GHCi" %}, the interpreter that comes with the Glasgow Haskell Compiler. GHCi is a {% include abbr.html term="REPL" %}: it reads an expression, evaluates it, prints the result, and waits for the next one. In GHCi you `:load` a source file, `:r` reloads it after an edit, and a definition typed at the prompt can span several lines between `:{` and `:}`. Here, every evaluation uses the code currently shown above the prompt. Standard functions such as `length` and `map` come from the **Prelude**, the module that every Haskell program imports automatically.

For longer guided practice, take the three tutorials in order, preferably in separate sessions:

1. **[Expressions, Types, and Recursion](/SEBook/tools/haskell-tutorial)**: 10 steps, about 90–110 minutes ([Part 1 print view](/SEBook/tools/haskell-tutorial/print)).
2. **[Functions and Laziness](/SEBook/tools/haskell-functions-tutorial)**: 9 steps, about 95–115 minutes ([Part 2 print view](/SEBook/tools/haskell-functions-tutorial/print)).
3. **[Data and Persistent Programs](/SEBook/tools/haskell-data-tutorial)**: 9 steps, about 100–115 minutes ([Part 3 print view](/SEBook/tools/haskell-data-tutorial/print)).

The [puzzles](#puzzles), [flashcards](#flashcards), and [quiz](#quiz) at the end mix all topics for retrieval practice.

# Pure Functions

Functional programming builds programs by applying and combining functions, and Haskell is one of the few *purely* functional languages. The idea is old. In the 1930s, Alonzo Church's lambda calculus described computation as function application, and in 1937 Alan Turing showed that it computes exactly what his Turing machines compute. John McCarthy's Lisp (1958) was the first functional programming language and introduced garbage collection. Haskell was designed by a committee formed in 1987 and is named after the logician Haskell Curry. Its ideas now appear in almost every mainstream language.

## Same input, same output

This C++ function hands out ticket numbers:

```cpp
int served = 0;

int nextTicket(int base) {
    return base + served++;
}
```

`nextTicket(100) == nextTicket(100)` is `false`, because the second call sees the counter that the first call changed. A change to state outside a function is a **side effect**. Here is a Haskell version:

```haskell
ticket :: Int -> Int -> Int
ticket base served = base + served
```

{% include haskell-evaluator.html expression='ticket 100 3' %}

**Predict, then evaluate:**

1. `ticket 100 3 == ticket 100 3`
2. `ticket 100 4`

<details markdown="1">
<summary>Explain the ticket results</summary>

Both calls to `ticket 100 3` produce `103`, so the comparison is `True`. A **pure function** computes its result only from its arguments and changes nothing outside itself, so the same arguments always give the same result. The Haskell `ticket` cannot keep a hidden counter: the number already served is passed in, such as `4` in the second call.

Pure functions are also called *referentially transparent*: you can replace a call with its value without changing the program. That makes them easier to test and debug, lets a compiler cache results or run independent calls in parallel, and supports proofs about a program's behavior.

</details>

## Names are bound once

```haskell
rate :: Int
rate = 5

total :: Int -> Int
total items = items * rate
```

{% include haskell-evaluator.html expression='total 4' %}

**Predict, then evaluate:**

1. `let rate = 6 in total 4`
2. `let rate = 6 in rate * 4`

**Change the code:** add the line `rate = 6` at the end of the code and evaluate `total 4` again. Read the message, then press **Reset code**.

<details markdown="1">
<summary>Explain the binding results</summary>

In Haskell, `=` defines a name; it does not assign to a variable. A second top-level definition of `rate` contradicts the first, so the compiler rejects the code instead of updating `rate`. `let rate = 6 in …` creates a *new* local name that only the expression after `in` can see. `total` was defined with the top-level `rate`, so the first expression is still `20`, while the second uses the local name and gives `24`. Values in Haskell are **immutable**: once defined, they never change.

</details>

## Evaluation follows need

```haskell
shippingNote :: Int -> String
shippingNote grams = if grams <= 0 then problem else estimate
  where
    estimate = "arrives in " ++ show days ++ " days"
    days = 2 + grams `div` 1000
    problem = error "weight must be positive"
```

{% include haskell-evaluator.html expression='shippingNote 2500' %}

**Predict, then evaluate:**

1. `shippingNote 900`
2. `shippingNote 0`

<details markdown="1">
<summary>Explain the shipping results</summary>

`estimate` uses `days` before the line that defines it, and `problem` would stop with an error, yet `shippingNote 2500` gives `"arrives in 4 days"`. The lines after `where` are equations, not steps: their order does not matter, and Haskell evaluates a name only when a result needs its value. `problem` is needed only when the weight is zero or less.

In C++, statements run from top to bottom, so `days` must be computed before it is used, and a statement that throws runs even when its result would never be used. Because pure expressions have no side effects, evaluating them later, in another order, or not at all cannot change the result. Haskell uses that freedom to evaluate expressions in the order their values are needed.

</details>

## Two styles of programming

| Imperative style (C++) | Functional style (Haskell) |
| --- | --- |
| Variables change as statements run. | Names are bound once; values never change. |
| The order of statements matters. | Expressions are evaluated when their values are needed. |
| Loops repeat statements. | Recursion and list functions transform values. |
| Threads must coordinate access to shared variables. | Shared values cannot change, so threads cannot race on them. |

# Expressions

Everything in Haskell is an expression that has a value. These experiments define functions and show how Haskell decides which function receives which argument.

## Define and call a function

Read `::` as "has type". The last type in a signature is the result; the types before it are the parameters, in order.

```haskell
fahrenheit :: Double -> Double
fahrenheit celsius = celsius * 9 / 5 + 32

fits :: Int -> Int -> Bool
fits capacity people = people <= capacity
```

{% include haskell-evaluator.html expression='fahrenheit 25' %}

**Predict, then evaluate:**

1. `fits 50 64`
2. `fahrenheit (-40)`
3. `fahrenheit -40`
4. `:type fits`

<details markdown="1">
<summary>Explain the function-call results</summary>

`fahrenheit 25` is `77.0`. In C++ the same function would be `double fahrenheit(double celsius) { return celsius * 9 / 5 + 32; }`. A Haskell call writes the arguments after the function name, separated by spaces, without commas or parentheses: `fits 50 64` means a capacity of 50 and 64 people, so it is `False`.

A negative argument needs parentheses. `fahrenheit -40` means `fahrenheit - 40`, an attempt to subtract 40 from a function, so it is a type error; `fahrenheit (-40)` is `-40.0`. `:type` (or `:t`) shows a type without evaluating anything: `Int -> Int -> Bool`. A complete program also defines `main :: IO ()`, as the [puzzles](#puzzles) do, but in this chapter you call functions directly.

</details>

## Let the compiler infer types

This definition has no signature:

```haskell
needsCoat temp raining = temp < (10 :: Int) || raining
```

{% include haskell-evaluator.html expression=':type needsCoat' %}

**Predict, then evaluate:**

1. `needsCoat 4 False`
2. `needsCoat 4.5 False`
3. `(2 :: Int) + (0.5 :: Double)`

**Change the code:** replace `(10 :: Int)` with `10`. Ask for `:type needsCoat` again, then evaluate `needsCoat 4.5 False`.

<details markdown="1">
<summary>Explain the inferred types</summary>

The compiler reports `Int -> Bool -> Bool`. **Type inference** deduces types from how values are used: `temp` is compared with an `Int`, `raining` is combined with `||`, and `||` produces a `Bool`. Inference does not make Haskell dynamically typed: every expression still has one fixed type, checked before anything runs. Because `temp` must be an `Int`, `4.5` is rejected. Haskell also never converts numbers automatically, so an `Int` and a `Double` cannot be added.

After the change, `temp` only needs to be a number that can be compared, so the inferred type gains the constraints `Num` and `Ord` (see [Types](#types)), and `4.5` is accepted. The evaluator prints that type with a `forall a .` prefix, which only introduces the type variable `a`. Signatures are rarely required, but they document the intended interface, and a disagreement between a signature and a body helps locate a mistake.

</details>

## Application groups first

```haskell
square :: Int -> Int
square n = n * n

inc :: Int -> Int
inc n = n + 1
```

{% include haskell-evaluator.html expression='square (inc 3)' %}

**Predict, then evaluate:**

1. `square 3 + 1`
2. `square (3 + 1)`
3. `inc (square 3) * 2`
4. `square inc 3`

<details markdown="1">
<summary>Explain the grouping results</summary>

Applying a function binds more tightly than any operator, so `square 3 + 1` means `(square 3) + 1`, which is `10`, while `square (3 + 1)` is `16`. Likewise, `inc (square 3) * 2` is `(inc 9) * 2`, or `20`. Application also groups to the left: `square inc 3` means `(square inc) 3`, which gives `square` a function instead of an `Int`, so the compiler rejects it.

</details>

Parentheses turn an expression into a single argument:

| Math or C++ | Haskell |
| --- | --- |
| `f(x)` | `f x` |
| `f(x, y)` | `f x y` |
| `f(g(x))` | `f (g x)` |
| `f(x, g(y))` | `f x (g y)` |
| `f(x) * g(y)` | `f x * g y` |

**Your turn:** write `square(inc(2) + inc(3))` in Haskell with as few parentheses as possible, and evaluate it.

<details markdown="1">
<summary>Check your parentheses</summary>

`square (inc 2 + inc 3)` gives `49`. The two `inc` calls bind before `+`, so only the argument of `square` needs parentheses.

</details>

## Operators are functions too

```haskell
isFactor :: Int -> Int -> Bool
isFactor d n = n `mod` d == 0
```

{% include haskell-evaluator.html expression='(-) 10 4' %}

**Predict, then evaluate:**

1. `(*) 3 7 + 1`
2. ``17 `div` 5``
3. `isFactor 3 12`
4. ``3 `isFactor` 12``

<details markdown="1">
<summary>Explain the operator results</summary>

Parentheses turn an operator into an ordinary function written before its arguments: `(-) 10 4` is `10 - 4`, or `6`. A function call still binds first, so `(*) 3 7 + 1` is `22`. Backticks do the reverse and turn a two-argument function into an operator: ``17 `div` 5`` is integer division, `3`, and ``3 `isFactor` 12`` is the same call as `isFactor 3 12`, which is `True`. Choose whichever spelling reads better.

</details>

## if always has an else

```haskell
lateFee :: Int -> Int
lateFee days = if days > 7 then 10 else 2 * days
```

{% include haskell-evaluator.html expression='lateFee 3' %}

**Predict, then evaluate:**

1. `lateFee 9`
2. `1 + lateFee 2`
3. `(if lateFee 5 > 8 then "high" else "low") ++ "!"`

**Change the code:** delete `else 2 * days` and evaluate `lateFee 3`. Then press **Reset code**.

<details markdown="1">
<summary>Explain the if results</summary>

In Haskell, `if` is an expression that produces a value, like C++'s conditional operator `days > 7 ? 10 : 2 * days`, not a statement that might do nothing. Every expression must have a value, so the `else` branch is required, and both branches must have the same type. That is why an `if` can appear inside arithmetic or string concatenation: `lateFee 5` is `10`, so the last expression is `"high!"`.

</details>

## Guards test conditions in order

```haskell
windAdvice :: Int -> String
windAdvice kph
  | kph >= 90 = "stay inside"
  | kph >= 40 = "secure loose items"
  | otherwise = "enjoy the breeze"
```

{% include haskell-evaluator.html expression='windAdvice 45' %}

**Predict, then evaluate:**

1. `windAdvice 95`
2. `windAdvice 12`

**Change the code:** swap the first two guard lines and evaluate `windAdvice 95` again.

<details markdown="1">
<summary>Explain the guard results</summary>

Each guard has the form `| condition = result`. Guards are tried from top to bottom, and the first condition that holds chooses the result, like an `if`/`else if` chain. `otherwise` is simply `True`, so it belongs last. The line `windAdvice kph` has no `=` of its own; each guard has one.

After the swap, 95 already satisfies `kph >= 40`, so the result is `"secure loose items"`, and the 90 guard can never be reached. The compiler accepts both orders because it cannot know which policy you intended.

</details>

## Recursion replaces loops

```haskell
triangle :: Int -> Int
triangle n
  | n == 0    = 0
  | otherwise = n + triangle (n - 1)
```

{% include haskell-evaluator.html expression='triangle 4' %}

**Predict, then evaluate:**

1. `triangle 0`
2. `triangle 100`

<details markdown="1">
<summary>Explain the recursion</summary>

Haskell has no loops. A recursive function solves a smaller version of the same problem and uses its result:

- **Base case:** `triangle 0` is `0`; nothing is left to add.
- **Smaller problem:** assume `triangle (n - 1)` already gives the sum from 1 to n − 1.
- **Combine:** add `n` to that sum.

Expanded by hand, `triangle 3` is `3 + (2 + (1 + 0))`, which is `6`. Likewise, `triangle 100` is `5050`.

</details>

**Change the code:** `triangle (-1)` would never reach `0`. Before evaluating it, change the first guard so that negative inputs also return `0`, then check `triangle (-1)`.

<details markdown="1">
<summary>Check the negative-input fix</summary>

Write the first guard as `| n <= 0 = 0`. A base case defines part of the specification; it is not only a way to stop.

</details>

## Name intermediate values with let and where

```haskell
commuteMinutes :: Int -> Int -> Int
commuteMinutes km kmPerHour =
  let driving = km * 60 `div` kmPerHour
      parking = 5
  in driving + parking

batteryLabel :: Int -> Int -> String
batteryLabel remaining capacity
  | percent < 10 = "critical"
  | percent < 30 = "low"
  | otherwise    = "ok"
  where
    percent = remaining * 100 `div` capacity
```

{% include haskell-evaluator.html expression='commuteMinutes 30 60' %}

**Predict, then evaluate:**

1. `batteryLabel 20 100`
2. `batteryLabel 7 80`
3. `let half = 50 in half * 2 + 1`

<details markdown="1">
<summary>Explain the let and where results</summary>

Both forms name intermediate values. `let … in …` is itself an expression, and its names are visible only after `in`. `where` attaches names to a whole definition, so every guard of `batteryLabel` can use `percent`. When the names serve a single expression, either form works; when several guards share them, use `where`. Indentation groups the bindings, so keep them aligned.

`commuteMinutes 30 60` is `35`. A battery with 20 of 100 units left is at 20 percent, `"low"`; 7 of 80 is 8 percent, `"critical"`.

</details>

## Helper functions inside where

```haskell
isSquare :: Int -> Bool
isSquare n = check 0
  where
    check k
      | k * k == n = True
      | k * k > n  = False
      | otherwise  = check (k + 1)
```

{% include haskell-evaluator.html expression='isSquare 49' %}

**Predict, then evaluate:**

1. `isSquare 50`
2. `isSquare 0`
3. `check 7`

<details markdown="1">
<summary>Explain the helper results</summary>

`where` can also define a helper function. `check` tries 0, 1, 2, and so on until `k * k` reaches or passes `n`, so 49 gives `True` and 50 gives `False`. The helper uses `n` from `isSquare` without receiving it as a parameter: a nested function can see the parameters of the definition it belongs to. It does not exist outside `isSquare`, so the evaluator rejects `check 7` as an undefined name.

</details>

# Lists

Lists are the most important data structure in functional programming. Tuples group a fixed number of values; lists hold any number of values of one type.

## Tuples hold a fixed group of values

```haskell
reading :: (String, Double)
reading = ("Lima", 19.5)

forecast :: (String, Int, Bool)
forecast = ("Oslo", 4, True)

lowHigh :: [Int] -> (Int, Int)
lowHigh temps = (minimum temps, maximum temps)
```

{% include haskell-evaluator.html expression='fst reading' %}

**Predict, then evaluate:**

1. `snd reading`
2. `lowHigh [7, 2, 9]`
3. `:type forecast`
4. `fst forecast`

<details markdown="1">
<summary>Explain the tuple results</summary>

A tuple groups a fixed number of values that may have different types, and its type lists each component's type; the evaluator writes `String` as `[Char]`, which is the same type. Tuples suit small, temporary groupings, such as the two results of `lowHigh`: `(2,9)`. `fst` and `snd` select the components of a **pair** only, so `fst forecast` is a type error; a triple is taken apart with a pattern (see [Patterns](#patterns)).

</details>

## Lists hold one type of element

```haskell
temps :: [Int]
temps = [18, 21, 17, 25]

weeks :: [[Int]]
weeks = [[18, 21], [], [25, 26, 24]]

stock :: [(String, Int)]
stock = [("pens", 12), ("tape", 3)]
```

{% include haskell-evaluator.html expression='length weeks' %}

**Predict, then evaluate:**

1. `head weeks`
2. `snd (head stock)`
3. `["Oslo", 4]`

<details markdown="1">
<summary>Explain the list types</summary>

Every element of a list has the **same** type: `[Int]` is a list of integers, `[[Int]]` a list of integer lists, and `[(String, Int)]` a list of pairs. `length weeks` counts its three elements, including the empty list, not the five numbers inside them. Likewise, `head weeks` is the inner list `[18,21]`. `["Oslo", 4]` mixes a string and a number, so it is rejected.

</details>

## Explore list functions

```haskell
temps :: [Int]
temps = [18, 21, 17, 25]

cities :: [String]
cities = ["Oslo", "Lima", "Pune"]
```

{% include haskell-evaluator.html expression='take 2 temps' %}

**Predict, then evaluate:**

1. `drop 2 temps`
2. `tail temps`
3. `null temps`
4. ``"Lima" `elem` cities``
5. `sum temps`
6. `zip cities temps`
7. `temps`

<details markdown="1">
<summary>Explain the list-function results</summary>

`take n` keeps the first n elements and `drop n` skips them; `head` and `tail` split off the first element and the rest; `null` tests for an empty list; `elem` tests membership and is often written between backticks; `sum` adds the elements (and `or` checks whether any `Bool` is `True`). `zip` pairs elements up and stops at the end of the shorter list, so `25` is left out.

None of these functions changes `temps`: evaluating it last still shows `[18,21,17,25]`. Each one returns a new value.

</details>

## Ranges and infinite lists

```haskell
weekdays :: [Int]
weekdays = [1 .. 5]

evens :: [Int]
evens = [0, 2 ..]
```

{% include haskell-evaluator.html expression='take 4 evens' %}

**Predict, then evaluate:**

1. `weekdays`
2. `[10, 8 .. 1]`
3. `['a' .. 'e']`
4. `take 7 (cycle ["mon", "wed", "fri"])`
5. `fst (1, length evens)`

<details markdown="1">
<summary>Explain the range results</summary>

`[1 .. 5]` lists every value from 1 to 5, inclusive. Two starting values set the step: `[10, 8 .. 1]` counts down by 2 and stops before passing 1, giving `[10,8,6,4,2]`. Ranges also work for characters, and a list of characters is displayed as a string, `"abcde"`.

Without an end, `[0, 2 ..]` is infinite, and `cycle` repeats a list forever. Haskell computes list elements only when they are demanded, so `take 4 evens` produces just four. `fst` never needs the second component of its pair, so the endless `length evens` is never computed and the result is `1`. Asking for `length evens` itself never finishes, because an infinite list has no last cell; if you try it, press **Stop evaluation**.

</details>

## Build lists with : and ++

```haskell
queue :: [String]
queue = ["Bo", "Cy"]
```

{% include haskell-evaluator.html expression='"Al" : queue' %}

**Predict, then evaluate:**

1. `queue ++ ["Di"]`
2. `"Al" : "Bo" : []`
3. `queue ++ "Di"`
4. `queue`

<details markdown="1">
<summary>Explain the cons and append results</summary>

`:`, called "cons", puts **one element** on the front of a list, and `"Al" : "Bo" : []` builds `["Al","Bo"]` from the empty list. `++` joins **two lists** of the same type, so adding one element at the end needs a one-element list, `queue ++ ["Di"]`. `queue ++ "Di"` fails because `"Di"` is a string, which is a list of characters, not a list of strings. `queue` itself never changes.

</details>

## Strings are lists of characters

```haskell
motto :: String
motto = "Keep it pure"
```

{% include haskell-evaluator.html expression='head motto' %}

**Predict, then evaluate:**

1. `tail motto`
2. `length motto`
3. `reverse motto`
4. `['o', 'k'] == "ok"`

<details markdown="1">
<summary>Explain the string results</summary>

`String` is another name for `[Char]`, a list of characters, so every list function works on strings. `head motto` is the character `'K'`, written with single quotes; `tail motto` is the string `"eep it pure"`; `length` counts all 12 characters, including spaces; and `reverse` gives `"erup ti peeK"`. `"ok"` is convenient notation for `['o','k']`, so the comparison is `True`.

</details>

## Recursion over a list

```haskell
countShort :: [String] -> Int
countShort ws
  | null ws               = 0
  | length (head ws) <= 3 = 1 + countShort (tail ws)
  | otherwise             = countShort (tail ws)

exclaimAll :: [String] -> [String]
exclaimAll ws
  | null ws   = []
  | otherwise = (head ws ++ "!") : exclaimAll (tail ws)
```

{% include haskell-evaluator.html expression='countShort ["fig", "kiwi", "yam"]' %}

**Predict, then evaluate:**

1. `exclaimAll ["hi", "yo"]`
2. `countShort []`

<details markdown="1">
<summary>Explain the list recursion</summary>

A recursive list function follows the shape of the list:

- **Empty list:** give the answer for no elements: `0` short words, or `[]` for an empty result.
- **Nonempty list:** handle `head ws`, and trust the recursive call to handle `tail ws`, which is one element shorter.
- **Combine:** `countShort` adds 1 only for a short word; `exclaimAll` puts the changed word in front of the changed rest with `:`.

`exclaimAll ["hi", "yo"]` unfolds to `"hi!" : ("yo!" : [])`, which is `["hi!","yo!"]`. The [Patterns](#patterns) section writes the same functions more directly.

</details>

## Comprehensions build lists

```haskell
oddSquares :: [Int]
oddSquares = [n * n | n <- [1 .. 9], odd n]

diceSevens :: [(Int, Int)]
diceSevens = [(a, b) | a <- [1 .. 6], b <- [a .. 6], a + b == 7]

consonants :: String -> String
consonants word = [c | c <- word, not (c `elem` "aeiou")]
```

{% include haskell-evaluator.html expression='oddSquares' %}

**Predict, then evaluate:**

1. `[(x, y) | x <- "ab", y <- [1, 2]]`
2. `diceSevens`
3. `consonants "functional"`
4. ``take 3 [n | n <- [100 ..], n `mod` 7 == 0]``

<details markdown="1">
<summary>Explain the comprehension results</summary>

Read `[n * n | n <- [1 .. 9], odd n]` as "the list of `n * n` for each `n` from 1 to 9 where `n` is odd". `n <- [1 .. 9]` is a **generator**, and `odd n` is a **guard**; when there are several guards, all must hold. The expression before `|` builds each output element.

Two generators behave like nested loops, with the later one varying fastest: `[('a',1),('a',2),('b',1),('b',2)]`. A later generator may use an earlier variable: `b <- [a .. 6]` avoids listing both `(1,6)` and `(6,1)`. A string is a list, so `consonants "functional"` keeps `"fnctnl"`. The last example searches an infinite range, and `take 3` stops it after finding `105`, `112`, and `119`. Python borrowed this notation: `[n * n for n in range(1, 10) if n % 2 == 1]`.

</details>

## Comprehensions inside an algorithm

A comprehension and recursion together express an algorithm compactly. Each step keeps the first remaining number and removes its multiples from the rest, in the spirit of the Sieve of Eratosthenes:

```haskell
sieve :: [Int] -> [Int]
sieve ns
  | null ns   = []
  | otherwise = p : sieve [n | n <- tail ns, n `mod` p /= 0]
  where
    p = head ns
```

{% include haskell-evaluator.html expression='sieve [2 .. 30]' %}

**Predict, then evaluate:** `take 5 (sieve [2 ..])`

<details markdown="1">
<summary>Explain the sieve</summary>

Every number that survives to the front of the list has no smaller prime factor, so it is prime. Because elements are produced only on demand, the same four lines work on the infinite list `[2 ..]`: `take 5` stops after `[2,3,5,7,11]`.

</details>

# Patterns

Pattern matching lets an equation say which shape of argument it handles. It adds no new power, but it replaces many `if`, `null`, `head`, and `tail` calls with definitions that mirror the data. Python and Rust have adopted it with their `match` statements.

## Match specific values

```haskell
statusText :: Int -> String
statusText 200  = "OK"
statusText 404  = "Not Found"
statusText code = "Status " ++ show code

onAxis :: (Int, Int) -> Bool
onAxis (0, _) = True
onAxis (_, 0) = True
onAxis _      = False
```

{% include haskell-evaluator.html expression='statusText 404' %}

**Predict, then evaluate:**

1. `statusText 500`
2. `onAxis (0, 7)`
3. `onAxis (3, 4)`

**Change the code:** move the equation `statusText code = …` above the other two `statusText` equations, then evaluate `statusText 404`.

<details markdown="1">
<summary>Explain the value patterns</summary>

A function may have several equations. Haskell tries them from top to bottom and uses the first one whose patterns match. A literal such as `404` matches only that value; a name such as `code` matches anything and names it; `_` matches anything without naming it. `show` converts a value to its text form. Patterns also take tuples apart, so `onAxis` needs neither `fst` nor `snd`.

After the change, the catch-all equation comes first and matches every number, so the result is `"Status 404"`. The specific equations below it can never be used.

</details>

## Take a list apart with (x:xs)

```haskell
splitFirst :: [a] -> (a, [a])
splitFirst (x:xs) = (x, xs)

firstTwo :: [a] -> (a, a)
firstTwo (x:y:_) = (x, y)
```

{% include haskell-evaluator.html expression='splitFirst [10, 20, 30]' %}

**Predict, then evaluate:**

1. `splitFirst "Haskell"`
2. `splitFirst [[1, 2]]`
3. `firstTwo "pure"`
4. `splitFirst ""`

<details markdown="1">
<summary>Explain the list patterns</summary>

The pattern `(x:xs)` is the cons operator in reverse: it matches any nonempty list and binds its first element to `x` and the rest to `xs` (read "x and the xs"). For `"Haskell"`, that is `'H'` and `"askell"`. For `[[1, 2]]`, the first element is the whole inner list and the rest is empty, `([1,2],[])`. `(x:y:_)` needs at least two elements. An empty list matches neither pattern, so `splitFirst ""` fails when it runs; a complete function also needs an equation for `[]`. The `a` in the types is a type variable, explained under [Types](#types).

</details>

| Pattern | Matches | Bindings for an example |
| --- | --- | --- |
| `[]` | only the empty list | none |
| `[x]` | exactly one element | `[7]`: `x` is `7` |
| `[x, y]` | exactly two elements | `[7, 8]`: `x` is `7`, `y` is `8` |
| `(x:xs)` | one or more elements | `[7, 8, 9]`: `x` is `7`, `xs` is `[8,9]` |
| `(x:y:rest)` | two or more elements | `[7, 8]`: `x` is `7`, `y` is `8`, `rest` is `[]` |
| `(7:xs)` | one or more, starting with 7 | `[7, 1]`: `xs` is `[1]` |

## Match the shape of a list

```haskell
podium :: [String] -> String
podium []              = "no finishers"
podium [winner]        = winner ++ " finished alone"
podium [first, second] = first ++ " beat " ++ second
podium (first:_)       = first ++ " won a crowded race"
```

{% include haskell-evaluator.html expression='podium ["Ana", "Ben"]' %}

**Predict, then evaluate:**

1. `podium []`
2. `podium ["Cy"]`
3. `podium ["Dee", "Eli", "Fay"]`

<details markdown="1">
<summary>Explain the shape patterns</summary>

`[winner]` matches exactly one element, and `[first, second]` exactly two, while `(first:_)` matches any nonempty list. Because the equations are tried in order, the last one handles only lists of three or more. Covering the empty list, one, two, and more than two elements makes `podium` complete.

</details>

## Recursion with patterns

```haskell
countShort :: [String] -> Int
countShort [] = 0
countShort (w:ws)
  | length w <= 3 = 1 + countShort ws
  | otherwise     = countShort ws

pairUp :: [a] -> [(a, a)]
pairUp (x:y:rest) = (x, y) : pairUp rest
pairUp _          = []
```

{% include haskell-evaluator.html expression='countShort ["fig", "kiwi", "yam"]' %}

**Predict, then evaluate:**

1. `pairUp [1 .. 5]`
2. `pairUp "abcd"`

<details markdown="1">
<summary>Explain the recursive patterns</summary>

This `countShort` behaves exactly like the [guard version](#recursion-over-a-list), but its empty and nonempty cases are separate equations, and `w` and `ws` replace `head ws` and `tail ws`. Patterns and guards combine: the pattern selects the case, and the guards decide within it. `pairUp` consumes two elements per step; `_` catches both the empty list and a single leftover element, so `pairUp [1 .. 5]` is `[(1,2),(3,4)]`.

</details>

## Your turn: write a recursive function

`stutter` should repeat every element: `stutter "ab"` is `"aabb"`, and `stutter [1, 2, 3]` is `[1,1,2,2,3,3]`. Evaluate it first to see what the unfinished definition reports. Then replace `undefined` and evaluate it again.

```haskell
stutter :: [a] -> [a]
stutter [] = []
stutter (x:xs) = undefined
```

{% include haskell-evaluator.html expression='stutter "ab"' %}

<details markdown="1">
<summary>Show one solution</summary>

`stutter (x:xs) = x : x : stutter xs`. Each step emits the first element twice and trusts the recursive call for the rest; the empty case ends the result. Check `stutter []` and `stutter [True]` as well.

</details>

# Types

Types describe how values fit together. These experiments show how one definition can work for many types, and how a constraint limits which types it accepts.

## Type variables make functions generic

```haskell
firstOr :: t -> [t] -> t
firstOr fallback []    = fallback
firstOr _        (x:_) = x

tagAll :: tag -> [item] -> [(item, tag)]
tagAll t items = [(i, t) | i <- items]
```

{% include haskell-evaluator.html expression='firstOr 0 [7, 8]' %}

**Predict, then evaluate:**

1. `firstOr "none" []`
2. `firstOr 'z' "abc"`
3. `firstOr 0 "abc"`
4. `tagAll True "ab"`

<details markdown="1">
<summary>Explain the type-variable results</summary>

A lowercase name in a type, such as `t`, is a **type variable**, Haskell's version of a generic type parameter. `firstOr` works for numbers, strings, and characters, but within one call every `t` stands for the same type: the fallback must match the list's elements, so `firstOr 0 "abc"` is rejected. Different type variables, such as `tag` and `item`, may stand for different types, though they do not have to. Short names such as `a` and `t` are conventional; any lowercase name works.

</details>

**Your turn:** add `pairWith x ys = [(x, y) | y <- ys]` to the code without a signature. Predict its type, then check it with `:type pairWith`.

<details markdown="1">
<summary>Check the type of pairWith</summary>

`pairWith :: a -> [b] -> [(a, b)]`; the letters may differ. Nothing connects the type of `x` with the elements of `ys`, so they get separate type variables. The evaluator prints `forall a b .` in front, which only introduces the type variables.

</details>

## Type classes limit a type variable

```haskell
clamp :: Ord a => a -> a -> a -> a
clamp low high x = max low (min high x)

average x y = (x + y) / 2
```

{% include haskell-evaluator.html expression='clamp 0 10 15' %}

**Predict, then evaluate:**

1. `clamp 'a' 'm' 'z'`
2. `clamp "b" "d" "apple"`
3. `:type average`
4. `average 3 4`
5. `average (3 :: Int) 4`

<details markdown="1">
<summary>Explain the type-class results</summary>

`Ord a =>` reads "for any type `a` whose values can be ordered". `clamp` uses `min` and `max`, so it works for numbers, characters, and strings, which compare alphabetically. `Ord` is a **type class**: a named group of types that support certain operations. Other common classes are `Eq` for `==`, `Num` for `+` and `*`, `Fractional` for `/`, and `Show` for conversion to text.

For `average`, the compiler infers the constraint `Fractional a` because the body divides with `/`; the evaluator also lists `Num a`, which every `Fractional` type already satisfies. `Int` is not `Fractional`, so `average (3 :: Int) 4` is rejected. Despite its name, a type class is closer to an interface than to a C++ class; it holds no data.

</details>

# Functions

Haskell functions are **first-class** values: like numbers or strings, they can be passed as arguments, stored in lists, and returned as results. A **higher-order function** takes a function as an argument or returns one.

## Pass a function as an argument

```haskell
twice :: (Int -> Int) -> Int -> Int
twice f x = f (f x)

addTen :: Int -> Int
addTen n = n + 10

steps :: [Int -> Int]
steps = [addTen, negate, twice addTen]
```

{% include haskell-evaluator.html expression='twice addTen 1' %}

**Predict, then evaluate:**

1. `twice negate 5`
2. `twice (twice addTen) 0`
3. `[step 1 | step <- steps]`
4. `:type twice`

<details markdown="1">
<summary>Explain the function-argument results</summary>

In `(Int -> Int) -> Int -> Int`, the parentheses mark the first parameter as a function from `Int` to `Int`. `twice f x` applies `f` and then applies it again to the result, so `twice addTen 1` is `addTen (addTen 1)`, or `21`. `twice addTen` is itself a function, so it can be passed to `twice` again, giving `40`, or stored in a list; applying each function in `steps` to 1 gives `[11,-1,21]`. Mainstream languages use the same idea for sort comparators, event handlers, and threads.

</details>

## Return a function

```haskell
gradeScale :: Bool -> (Int -> String)
gradeScale passFail = if passFail then passOrFail else letter
  where
    passOrFail score = if score >= 60 then "P" else "NP"
    letter score
      | score >= 90 = "A"
      | score >= 80 = "B"
      | otherwise   = "C or below"
```

{% include haskell-evaluator.html expression='gradeScale True 75' %}

**Predict, then evaluate:**

1. `gradeScale False 85`
2. `:type gradeScale True`
3. `let grade = gradeScale False in grade 95`

<details markdown="1">
<summary>Explain the returned functions</summary>

`gradeScale` returns one of two helper functions, chosen by its argument, and its result type, `(Int -> String)`, says so. `gradeScale True 75` first returns `passOrFail`, which is then applied to `75`, giving `"P"`. A returned function can be named and used later like any other value.

</details>

## map transforms every element

```haskell
addShipping :: Int -> Int
addShipping price = price + 4

mapEach :: (a -> b) -> [a] -> [b]
mapEach _ []     = []
mapEach f (x:xs) = f x : mapEach f xs
```

{% include haskell-evaluator.html expression='map addShipping [10, 25]' %}

**Predict, then evaluate:**

1. `map length ["kiwi", "fig"]`
2. `map even [1, 2, 3]`
3. `mapEach addShipping [10, 25]`
4. `:type map`

<details markdown="1">
<summary>Explain the map results</summary>

`map f xs` applies `f` to each element and collects the results in a new list of the same length. Its type, `(a -> b) -> [a] -> [b]`, allows the elements to change type, as when `map even` turns numbers into `Bool` values. `mapEach` shows that there is no magic: an empty list maps to an empty list, and a nonempty list transforms its head and recursively maps its tail.

</details>

## filter keeps matching elements

```haskell
isShort :: String -> Bool
isShort word = length word <= 3

keepIf :: (a -> Bool) -> [a] -> [a]
keepIf _ [] = []
keepIf p (x:xs)
  | p x       = x : keepIf p xs
  | otherwise = keepIf p xs
```

{% include haskell-evaluator.html expression='filter isShort ["fig", "kiwi", "yam"]' %}

**Predict, then evaluate:**

1. `filter even [1 .. 10]`
2. `keepIf isShort ["fig", "kiwi", "yam"]`
3. `map isShort ["fig", "kiwi", "yam"]`

<details markdown="1">
<summary>Explain the filter results</summary>

`filter p xs` keeps the elements for which the **predicate** `p` returns `True`. Its type, `(a -> Bool) -> [a] -> [a]`, says that the kept elements keep their type. `map isShort` instead returns the three `Bool` answers, `[True,False,True]`, not the words. `keepIf` is the recursive definition: keep `x` when `p x` holds, then filter the rest.

</details>

## foldl combines a list into one value

```haskell
foldLeft :: (b -> a -> b) -> b -> [a] -> b
foldLeft _ acc []     = acc
foldLeft f acc (x:xs) = foldLeft f (f acc x) xs

longer :: Int -> String -> Int
longer best word = max best (length word)
```

{% include haskell-evaluator.html expression='foldl longer 0 ["fig", "banana", "kiwi"]' %}

**Predict, then evaluate:**

1. `foldl (+) 0 [5, 3, 6]`
2. `foldLeft longer 0 ["fig", "banana", "kiwi"]`
3. `foldl (-) 10 [1, 2]`
4. `foldr (-) 10 [1, 2]`

<details markdown="1">
<summary>Explain the fold results</summary>

A **fold**, also called a reducer, collapses a list into one value. `foldl f seed xs` starts an **accumulator** at `seed` and updates it with each element from left to right, like this loop:

```text
acc = seed
for each x in xs:
    acc = f(acc, x)
return acc
```

For the words, the accumulator goes from `0` to `3`, `6`, and `6`: the length of the longest word. The combining function receives the accumulator first and the element second, and the accumulator may have a different type from the elements. `foldl (-) 10 [1, 2]` groups as `(10 - 1) - 2`, giving `7`; `foldr` groups from the right with the seed at the far end, `1 - (2 - 10)`, giving `9`.

</details>

**Your turn:** use `foldl` to multiply the numbers in `[2, 3, 4]`. Which seed must you choose?

<details markdown="1">
<summary>Check the product seed</summary>

`foldl (*) 1 [2, 3, 4]` is `24`. The seed must be `1`, which leaves a product unchanged; a seed of `0` would make every product `0`.

</details>

## Combine map, filter, and fold

```haskell
prices :: [Int]
prices = [12, 5, 30, 8]

addShipping :: Int -> Int
addShipping price = price + 4

over10 :: Int -> Bool
over10 price = price > 10

shippedTotal :: Int
shippedTotal = foldl (+) 0 (map addShipping (filter over10 prices))
```

{% include haskell-evaluator.html expression='shippedTotal' %}

**Predict, then evaluate:**

1. `filter over10 prices`
2. `map addShipping (filter over10 prices)`
3. `filter over10 (map addShipping prices)`

<details markdown="1">
<summary>Explain the pipeline results</summary>

Read a pipeline from the inside out and name each intermediate list: `filter` keeps `[12,30]`, `map` turns them into `[16,34]`, and the fold adds them to `50`. Swapping the stages changes the requirement: adding shipping first turns `8` into `12`, which then passes the filter. Both orders type-check, so only the specification can say which one is right.

The same filter-map-reduce pattern appears in JavaScript (`prices.filter(p => p > 10).map(p => p + 4).reduce((a, b) => a + b, 0)`), Python, and Java streams. Because each call of the mapping function depends only on its own element, systems such as Google's MapReduce can split an enormous dataset across thousands of machines, map the pieces in parallel, and then reduce the results.

</details>

## Lambdas are functions without names

```haskell
scores :: [Int]
scores = [72, 95, 88, 61]

joinWith :: String -> String -> String -> String
joinWith = \sep a b -> a ++ sep ++ b
```

{% include haskell-evaluator.html expression='map (\s -> s + 5) scores' %}

**Predict, then evaluate:**

1. `filter (\s -> s >= 90) scores`
2. `(\a b -> a * 10 + b) 4 2`
3. `joinWith "-" "pure" "lazy"`
4. `foldl (\n s -> if s >= 80 then n + 1 else n) 0 scores`

<details markdown="1">
<summary>Explain the lambda results</summary>

A **lambda**, written `\parameters -> body`, is a function defined where it is used; the backslash stands in for the Greek letter λ. Use one for a small, one-off function, such as the predicate for `filter`, instead of naming a helper. A lambda can take several parameters, so `(\a b -> a * 10 + b) 4 2` is `42`; it can be stored under a name, like `joinWith`; and it can be a fold's combining function, which counts the two scores of at least 80.

</details>

## Closures remember their variables

```haskell
between :: Int -> Int -> (Int -> Bool)
between low high = \x -> low <= x && x <= high

inTeens :: Int -> Bool
inTeens = between 13 19

isDie :: Int -> Bool
isDie = between 1 6

shadowCheck :: Bool
shadowCheck = let low = 100 in inTeens 15

scaleFrom :: Int -> Int -> (Int -> Int)
scaleFrom base factor = \base -> base * factor
```

{% include haskell-evaluator.html expression='inTeens 15' %}

**Predict, then evaluate:**

1. `map inTeens [12, 13, 19, 20]`
2. `isDie 7`
3. `shadowCheck`
4. `scaleFrom 2 10 3`

<details markdown="1">
<summary>Explain the closure results</summary>

In the lambda `\x -> low <= x && x <= high`, `x` is a **bound variable**, the lambda's own parameter, while `low` and `high` are **free variables** that come from outside the lambda. Each call to `between` creates a **closure**: the lambda together with the values its free variables had when it was created. `inTeens` captured 13 and 19, and `isDie` is a separate closure that captured 1 and 6.

In `shadowCheck`, the unrelated local `low = 100` has no effect, and the result is `True`. A closure uses the bindings visible where it was *defined*, not those visible where it is called. A closure also captures only its free variables: in `scaleFrom`, the lambda's own parameter `base` hides the outer `base`, so only `factor` is captured, and `scaleFrom 2 10 3` is `3 * 10`, or `30`.

</details>

## Partial application specializes a function

```haskell
applyDiscount :: Int -> Int -> Int
applyDiscount percent price = price - price * percent `div` 100

studentPrice :: Int -> Int
studentPrice = applyDiscount 20

total :: [Int] -> Int
total = foldl (+) 0
```

{% include haskell-evaluator.html expression='studentPrice 50' %}

**Predict, then evaluate:**

1. `map studentPrice [50, 15]`
2. `:type applyDiscount 20`
3. `map (applyDiscount 50) [10, 30]`
4. `total (map studentPrice [50, 15])`
5. `map (* 2) [1, 2, 3]`
6. `(10 -) 3`

<details markdown="1">
<summary>Explain the partial-application results</summary>

Calling a function with fewer arguments than its parameters is **partial application**. `applyDiscount 20` fixes the percentage and returns a new function, of type `Int -> Int`, that still waits for a price; `studentPrice 50` is `40`. Partial application builds specialized tools from general ones, such as `total` from `foldl`, or `map (applyDiscount 50)`, which halves every price.

An operator inside parentheses with only one operand is partially applied too; this is called a **section**. `(* 2)` doubles its argument, and `(10 -)` computes `10 - x`, so `(10 -) 3` is `7`. `(- 10)` is just the number −10; use `subtract 10` for the function that takes 10 away.

</details>

## Currying: one argument at a time

```haskell
rentalCost :: Int -> Int -> Int -> Int
rentalCost base perDay days = base + perDay * days

rentalCurried :: Int -> (Int -> (Int -> Int))
rentalCurried = \base -> (\perDay -> (\days -> base + perDay * days))
```

{% include haskell-evaluator.html expression='rentalCost 20 15 3' %}

**Predict, then evaluate:**

1. `((rentalCost 20) 15) 3`
2. `rentalCurried 20 15 3`
3. `:type rentalCost 20`
4. `:type rentalCost 20 15`

<details markdown="1">
<summary>Explain the currying results</summary>

**Currying** represents a function of several arguments as a chain of one-argument functions, each returning the next. Haskell curries every function automatically, so `rentalCost` and the hand-written `rentalCurried` are the same function, and both give `65`. That is why arrows in a type group to the **right**, `Int -> (Int -> (Int -> Int))`, while application groups to the **left**, `((rentalCost 20) 15) 3`. Each call fills in one parameter and returns a closure waiting for the rest: `rentalCost 20` has type `Int -> Int -> Int`, and `rentalCost 20 15` has type `Int -> Int`. That is what makes partial application possible.

To curry a definition by hand, write one lambda per parameter, nest each lambda inside the previous one, and put the original body in the innermost lambda.

</details>

**Check yourself:**

1. Write `\y -> (\x -> y * 10 + x)` as an ordinary definition with two parameters, `f y x = …`.
2. Add all the parentheses implied by the type `Int -> Int -> Bool`.
3. Why can't `rentalTuple :: (Int, Int, Int) -> Int` be partially applied to just a base price?

<details markdown="1">
<summary>Check your currying answers</summary>

1. `f y x = y * 10 + x`.
2. `Int -> (Int -> Bool)`: a function that takes an `Int` and returns a function from `Int` to `Bool`.
3. Its single parameter is one triple, so there is no "first argument" to supply alone. Curried parameters are what make partial application possible.

</details>

# Data

An **algebraic data type** defines a new type by listing every form its values can take. Pattern matching then handles each form. One declaration can play the roles that C++ splits among `enum`, `struct`, and `union`. The name comes from how types combine: a value is *one of* several constructors (a sum) and holds *all of* that constructor's fields (a product). The idea was introduced in Hope, a 1970s functional language from the University of Edinburgh.

## Define a type with data

```haskell
data Seat = Window | Middle | Aisle
  deriving (Show, Eq)

data Ticket = Ticket { row :: Int, seat :: Seat }
  deriving Show

boardingGroup :: Ticket -> Int
boardingGroup (Ticket 1 _)      = 1
boardingGroup (Ticket _ Window) = 2
boardingGroup (Ticket r _)      = if r <= 10 then 3 else 4
```

{% include haskell-evaluator.html expression='boardingGroup (Ticket 12 Window)' %}

**Predict, then evaluate:**

1. `boardingGroup (Ticket 1 Window)`
2. `boardingGroup (Ticket 12 Aisle)`
3. `Ticket { row = 3, seat = Aisle }`
4. `seat (Ticket 3 Aisle)`

**Change the code:** delete the `deriving Show` line under `Ticket` and evaluate `Ticket 3 Aisle`. Then press **Reset code**.

<details markdown="1">
<summary>Explain the ticket-type results</summary>

`Seat` lists three **constructors**, like a C++ `enum`. `Ticket` has one constructor with two named fields, like a `struct`: `Ticket { row = 3, seat = Aisle }` and `Ticket 3 Aisle` build the same value, and each field name is also a function that reads its field. Type and constructor names start with an uppercase letter.

Patterns can contain constructors and literal field values. `(Ticket 1 _)` matches any seat in row 1, so a row-1 window seat gets group 1, even though the second equation would also match. `deriving Show` asks the compiler to generate the code that displays a value; without it, a `Ticket` cannot be shown. `deriving Eq` similarly provides `==` for `Seat`.

</details>

## Each variant can carry different fields

```haskell
data Item
  = Book { title :: String, pages :: Int }
  | Film { title :: String, minutes :: Int }
  | Magazine
  deriving Show

loanDays :: Item -> Int
loanDays (Book _ p) = if p > 500 then 28 else 21
loanDays (Film _ _) = 7
loanDays Magazine   = 3
```

{% include haskell-evaluator.html expression='loanDays (Book "Dune" 600)' %}

**Predict, then evaluate:**

1. `map loanDays [Film "Up" 96, Magazine]`
2. `title (Film "Up" 96)`
3. `:type Book`

**Change the code:** add a variant `| Game String` to `Item`, just before `deriving Show`, and evaluate `loanDays (Game "Go")`. Then press **Reset code**.

<details markdown="1">
<summary>Explain the variant results</summary>

An `Item` is exactly one of three **variants**, each with its own fields; `Magazine` has none. Every constructor is a function that builds an `Item`, so `:type Book` shows `[Char] -> Int -> Item`, that is, `String -> Int -> Item`. `loanDays` has one equation, or branch, per variant, and each pattern unpacks the fields that branch needs, using `_` for the rest.

After you add `Game`, the code still compiles, but `loanDays` has no branch for it, so the call fails when it runs. When a type gains a variant, revisit every function that takes it apart.

</details>

<details markdown="1">
<summary>Compare algebraic data types with classes</summary>

A C++ class hierarchy could model the same items with `Book` and `Film` subclasses. With an algebraic data type, adding an operation such as `lateFee` is one new function, but adding a variant means revisiting every function that matches on `Item`. With classes, a new subclass is self-contained, but a new operation means adding a method to every class. Choose the design that makes your most likely changes cheap.

</details>

## Build your own list type

```haskell
data Playlist = End | Song String Playlist
  deriving Show

mix :: Playlist
mix = Song "Intro" (Song "Groove" End)

countSongs :: Playlist -> Int
countSongs End           = 0
countSongs (Song _ rest) = 1 + countSongs rest

playNext :: String -> Playlist -> Playlist
playNext name list = Song name list

playLast :: String -> Playlist -> Playlist
playLast name End              = Song name End
playLast name (Song song rest) = Song song (playLast name rest)
```

{% include haskell-evaluator.html expression='countSongs mix' %}

**Predict, then evaluate:**

1. `playNext "Warmup" mix`
2. `playLast "Outro" mix`
3. `mix`

<details markdown="1">
<summary>Explain the playlist results</summary>

A type may refer to itself. A `Playlist` is either `End`, like a null pointer, or a `Song` that holds a name and the rest of the playlist, like a linked-list node. Recursive functions follow the same two cases.

Neither update changes `mix`. `playNext` builds one new `Song` and reuses the entire existing playlist as its rest. `playLast` must rebuild **every** song on the way to the end, because the final `End` has to be replaced and no existing node can change. Built-in lists behave the same way: `x : xs` is cheap, while `xs ++ [x]` rebuilds every cell of `xs`.

</details>

## Update a tree, keep the old one {#persistence}

```haskell
data Tree = Leaf | Node Tree Int Tree
  deriving Show

insert :: Int -> Tree -> Tree
insert x Leaf = Node Leaf x Leaf
insert x (Node left v right)
  | x < v     = Node (insert x left) v right
  | x > v     = Node left v (insert x right)
  | otherwise = Node left v right

small :: Tree
small = Node (Node Leaf 2 Leaf) 4 (Node Leaf 8 Leaf)
```

{% include haskell-evaluator.html expression='insert 5 small' %}

**Predict, then evaluate:**

1. `small`
2. `insert 1 small`

<details markdown="1">
<summary>Explain the tree results</summary>

In this binary search tree, smaller values go to the left and larger ones to the right. Inserting 5 creates a new leaf, rebuilds the two nodes on the path from the root to it (4 and 8), and reuses the untouched subtree `Node Leaf 2 Leaf`: the branch passes `left` along unchanged. `small` is still intact, and the old and new trees can safely share that subtree because neither can modify it.

In a balanced tree with n nodes, that path has about log₂ n nodes, so an insertion creates only about log₂ n new nodes; a tree of a million nodes needs about 20. Old nodes that nothing refers to anymore are reclaimed automatically by **garbage collection**, which does not change the Big-O cost of the operation.

</details>

**Check yourself:** which nodes does `insert 1 small` rebuild, and which subtree does it reuse?

<details markdown="1">
<summary>Check the rebuilt nodes</summary>

It rebuilds the nodes for 4 and 2, creates a new node for 1, and reuses the subtree containing 8.

</details>

## Immutable data: benefits and costs

- **Thread safety.** Values never change, so threads can share them without locks or data races.
- **Easier debugging.** No distant code can change a value unexpectedly, so the place that created a value explains it.
- **Safe caching and history.** A result computed from immutable inputs never becomes stale, and old versions remain available for undo or comparison.
- **Costs.** Some updates rebuild part of a structure, such as appending to the end of a list, and old versions use memory as long as something refers to them.

Many mainstream languages now offer immutable collections, such as Google's Guava library for Java and Immutable.js for JavaScript. Most of them, including Java, JavaScript, C#, and Go, also rely on garbage collection to reclaim versions that are no longer used.

**Design reflection:** an editor wants undo and a current document view. Explain why retaining immutable versions helps. Then identify a cost that grows if it keeps every version forever, and a policy that would bound that cost.

<details markdown="1">
<summary>Compare the undo trade-off</summary>

An update can produce a new document without altering the version needed for undo, and unchanged structure can be shared between versions. However, every retained version keeps its data reachable, so sharing does not make an unlimited history free. A bounded undo window or periodic checkpoints limit memory use, at the cost of losing some older undo steps. The right policy depends on the editor's requirements.

</details>

# Puzzles

Each puzzle is a complete program that prints one line, and each one tests a single rule from this chapter. The order mixes topics, so part of each puzzle is recognizing which rule applies. Write your prediction in the box before you press **Run**. When the output surprises you, name the rule you were relying on before you read the explanation under the output. The cards show {% include abbr.html term="GHC" %}'s `runghc` command; the browser's MicroHs runtime prints the same results.

## Puzzle 1: A Function and an Operator

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Apply.hs",
  "code": "inc :: Int -> Int\ninc n = n + 1\n\nmain :: IO ()\nmain = print (inc 2 * 10)",
  "description": "`inc` adds one to its argument. The program combines it with a multiplication.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "30"
  },
  "notice": "Function application binds more tightly than any operator, so `inc 2 * 10` means `(inc 2) * 10`. Write `inc (2 * 10)` to pass the product as the argument, which gives 21."
}
</script>
</div>

## Puzzle 2: Reversing a Word

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Word.hs",
  "code": "main :: IO ()\nmain = putStrLn (reverse \"stressed\")",
  "description": "`reverse` is a list function. `putStrLn` prints a string's characters without quotation marks.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "desserts"
  },
  "notice": "A `String` is a list of `Char`, so every list function, including `reverse`, works on text."
}
</script>
</div>

## Puzzle 3: Guards in Order

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Size.hs",
  "code": "size :: Int -> String\nsize n\n  | n > 0     = \"small\"\n  | n > 100   = \"large\"\n  | otherwise = \"empty\"\n\nmain :: IO ()\nmain = putStrLn (size 500)",
  "description": "`size` labels a number with guards.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "small"
  },
  "notice": "Guards are tried from top to bottom, and the first condition that holds chooses the result. Every positive number satisfies `n > 0`, so the `\"large\"` guard can never be reached. List the most specific condition first."
}
</script>
</div>

## Puzzle 4: Counting Nested Lists

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Nested.hs",
  "code": "main :: IO ()\nmain = print (length [[1, 2, 3], [], [4]])",
  "description": "The outer list contains three lists of numbers.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "3"
  },
  "notice": "`length` counts the elements of the outer list. Each element is a whole inner list, including the empty one; the numbers inside are not counted."
}
</script>
</div>

## Puzzle 5: Cons Onto a String

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Cons.hs",
  "code": "main :: IO ()\nmain = putStrLn ('s' : \"kip\")",
  "description": "`:` puts one element on the front of a list.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "skip"
  },
  "notice": "A `String` is a list of `Char`, so `:` can put the character `'s'` on the front of `\"kip\"`. A character is written in single quotes and a string in double quotes."
}
</script>
</div>

## Puzzle 6: A Conditional Inside Arithmetic

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Choose.hs",
  "code": "main :: IO ()\nmain = print (10 + (if 3 > 5 then 1 else 2))",
  "description": "An `if` appears as one operand of `+`.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "12"
  },
  "notice": "In Haskell, `if` is an expression with a value, like C++'s `?:` operator. That is why it needs an `else` branch, and why it can appear inside arithmetic."
}
</script>
</div>

## Puzzle 7: A Range With a Step

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Range.hs",
  "code": "main :: IO ()\nmain = print [10, 7 .. 0]",
  "description": "The first two values of the range set its step.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "[10,7,4,1]"
  },
  "accept": ["[10,7,4,1]", "[10, 7, 4, 1]"],
  "notice": "The step is 7 − 10, which is −3. The range continues while the values do not pass the bound 0, so it stops at 1; the next value, −2, would pass 0. `show` prints a list without spaces."
}
</script>
</div>

## Puzzle 8: Pairs Within a Pair

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Nest.hs",
  "code": "main :: IO ()\nmain = print (snd (fst ((1, 2), 3)))",
  "description": "The first component of the outer pair is itself a pair.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "2"
  },
  "notice": "Work from the inside out: `fst ((1, 2), 3)` is the inner pair `(1, 2)`, and `snd` of that pair is 2. `fst` and `snd` work only on pairs, but a pair's components may themselves be pairs."
}
</script>
</div>

## Puzzle 9: Definitions in Any Order

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Order.hs",
  "code": "main :: IO ()\nmain = print total\n  where\n    total = price * quantity\n    price = 3\n    quantity = 5",
  "description": "`total` uses two names that are defined on later lines.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "15"
  },
  "notice": "Bindings are equations, not statements that run in sequence, so their order does not matter. In C++, using a variable before its declaration would not compile."
}
</script>
</div>

## Puzzle 10: Prefix Subtraction

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Prefix.hs",
  "code": "main :: IO ()\nmain = print ((-) 3 10)",
  "description": "Parentheses turn the operator `-` into an ordinary function.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "-7"
  },
  "notice": "The first argument of `(-)` is the left operand, so `(-) 3 10` means `3 - 10`."
}
</script>
</div>

## Puzzle 11: A Helper Sees the Parameter

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Greeting.hs",
  "code": "greeting :: String -> String\ngreeting name = wrap \"Hi\"\n  where\n    wrap word = word ++ \", \" ++ name\n\nmain :: IO ()\nmain = putStrLn (greeting \"Ada\")",
  "description": "`wrap` is defined inside `greeting` and receives only one argument.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "Hi, Ada"
  },
  "notice": "A helper defined in `where` can use the parameters of the function it belongs to, so `wrap` reads `name` without receiving it. The helper is not visible outside `greeting`."
}
</script>
</div>

## Puzzle 12: What the Rest Holds

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Rest.hs",
  "code": "afterTwo :: [Int] -> [Int]\nafterTwo (_:_:others) = others\n\nmain :: IO ()\nmain = print (afterTwo [1, 2])",
  "description": "The pattern names everything after the first two elements.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "[]"
  },
  "notice": "`(_:_:others)` matches any list with at least two elements. For exactly two, nothing remains, so `others` is the empty list."
}
</script>
</div>

## Puzzle 13: Counting Down

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "CountDown.hs",
  "code": "countDown :: Int -> [Int]\ncountDown 0 = []\ncountDown n = n : countDown (n - 1)\n\nmain :: IO ()\nmain = print (countDown 3)",
  "description": "Each call puts one number on the front of the rest of the result.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "[3,2,1]"
  },
  "accept": ["[3,2,1]", "[3, 2, 1]"],
  "notice": "The calls unfold to `3 : (2 : (1 : []))`. The base case contributes the empty list that ends the result, so `0` itself is not included."
}
</script>
</div>

## Puzzle 14: A Value Nobody Needs

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Demand.hs",
  "code": "main :: IO ()\nmain = print (fst (7, error \"never needed\"))",
  "description": "`error` stops the program with a message when it is evaluated.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "7"
  },
  "notice": "Haskell evaluates an expression only when a result needs its value. `fst` never looks at the second component, so the `error` is never evaluated. C++ would evaluate both values before building the pair."
}
</script>
</div>

## Puzzle 15: A Lazy Search

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Search.hs",
  "code": "main :: IO ()\nmain = print (head [n | n <- [1 ..], n * n > 50])",
  "description": "The comprehension draws from an infinite list.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "8"
  },
  "notice": "`head` needs only the first element that passes the guard. Haskell produces elements on demand, so it tests 1 through 8 and stops: `7 * 7` is 49, but `8 * 8` is 64."
}
</script>
</div>

## Puzzle 16: Two Generators

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Pairs.hs",
  "code": "main :: IO ()\nmain = print [x + y | x <- [10, 20], y <- [1, 2]]",
  "description": "A list comprehension draws from two generators.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "[11,12,21,22]"
  },
  "accept": ["[11,12,21,22]", "[11, 12, 21, 22]"],
  "notice": "Generators behave like nested loops in the order they are written: `x` is the outer loop, and `y`, the later generator, varies fastest."
}
</script>
</div>

## Puzzle 17: Strings Compare Alphabetically

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Larger.hs",
  "code": "main :: IO ()\nmain = putStrLn (max \"apple\" \"pear\")",
  "description": "`max` works for any type whose values can be ordered.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "pear"
  },
  "notice": "Strings belong to the `Ord` type class and compare alphabetically, character by character. `'p'` comes after `'a'`, so `\"pear\"` is the larger string, even though it is shorter."
}
</script>
</div>

## Puzzle 18: Map Versus Filter

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Odd.hs",
  "code": "main :: IO ()\nmain = print (map odd [1, 2, 3])",
  "description": "`odd` is a predicate: it returns a `Bool` for each number.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "[True,False,True]"
  },
  "accept": ["[True,False,True]", "[True, False, True]"],
  "notice": "`map` keeps one result per element, so it collects the predicate's answers. `filter odd [1, 2, 3]` would instead keep the matching numbers, `[1,3]`."
}
</script>
</div>

## Puzzle 19: Fixing the First Argument

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Powers.hs",
  "code": "power :: Int -> Int -> Int\npower base exponent = base ^ exponent\n\nmain :: IO ()\nmain = print (map (power 2) [1, 2, 3])",
  "description": "`power 2` supplies only one of the two arguments.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "[2,4,8]"
  },
  "accept": ["[2,4,8]", "[2, 4, 8]"],
  "notice": "Partial application fills parameters from the left, so `power 2` fixes the base, and each list element becomes an exponent. Squaring each element would need `\\b -> power b 2`."
}
</script>
</div>

## Puzzle 20: Two Arguments of Three

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Volume.hs",
  "code": "volume :: Int -> Int -> Int -> Int\nvolume l w h = l * w * h\n\nmain :: IO ()\nmain = do\n  let base = volume 2 3\n  print (base 4)",
  "description": "`base` supplies only two of the three arguments.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "24"
  },
  "notice": "Every function is curried, so `volume 2 3` is a function that still waits for the height. Applying it to 4 completes the call: `2 * 3 * 4`."
}
</script>
</div>

## Puzzle 21: A Closure and a Later Binding

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Times.hs",
  "code": "main :: IO ()\nmain = do\n  let k = 2\n      times x = x * k\n  let k = 50\n  print (times 3)",
  "description": "`times` is defined while `k` is 2. A later `let` binds `k` again.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "6"
  },
  "notice": "The second `let` creates a new `k` that hides the old one from later lines; it does not change the first binding. `times` keeps referring to the `k` that was in scope where it was defined."
}
</script>
</div>

## Puzzle 22: Functions in a List

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Steps.hs",
  "code": "main :: IO ()\nmain = print [f 10 | f <- [(+ 1), (* 2)]]",
  "description": "The list holds two functions, written as operator sections.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "[11,20]"
  },
  "accept": ["[11,20]", "[11, 20]"],
  "notice": "Functions are values, so a list can hold them and a comprehension can draw them out. `(+ 1)` adds one and `(* 2)` doubles, so applying each to 10 gives 11 and 20."
}
</script>
</div>

## Puzzle 23: Parameters in Order

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Swap.hs",
  "code": "main :: IO ()\nmain = putStrLn ((\\x y -> y ++ x) \"ab\" \"cd\")",
  "description": "A lambda with two parameters is applied to two strings.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "cdab"
  },
  "notice": "Arguments fill a lambda's parameters in order, so `x` is `\"ab\"` and `y` is `\"cd\"`. The body then puts `y` first."
}
</script>
</div>

## Puzzle 24: Folding From the Left

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "FoldLeft.hs",
  "code": "main :: IO ()\nmain = print (foldl (-) 10 [1, 2, 3])",
  "description": "`foldl` combines the starting value 10 with each element, using subtraction.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "4"
  },
  "notice": "`foldl` starts with the seed and groups from the left: `((10 - 1) - 2) - 3`."
}
</script>
</div>

## Puzzle 25: Folding From the Right

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "FoldRight.hs",
  "code": "main :: IO ()\nmain = print (foldr (-) 10 [1, 2, 3])",
  "description": "The same list, seed, and operator as the previous puzzle, but with `foldr`.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "-8"
  },
  "notice": "`foldr` groups from the right and puts the seed at the far end: `1 - (2 - (3 - 10))`. With `+` the two folds would agree; subtraction exposes the different grouping."
}
</script>
</div>

## Puzzle 26: Constructors as Values

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Light.hs",
  "code": "data Light = Red | Yellow | Green\n  deriving Show\n\nnext :: Light -> Light\nnext Red    = Green\nnext Green  = Yellow\nnext Yellow = Red\n\nmain :: IO ()\nmain = print (next (next Red))",
  "description": "`next` moves a traffic light to its following state.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "Yellow"
  },
  "notice": "The inner call runs first: `next Red` is `Green`, and `next Green` is `Yellow`. Pattern matching chooses the equation for each constructor, and `deriving Show` lets `print` display the result."
}
</script>
</div>

## Puzzle 27: Unpacking a Variant

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Fee.hs",
  "code": "data Order = Pickup | Delivery Int\n\nfee :: Order -> Int\nfee Pickup        = 0\nfee (Delivery km) = 2 * km\n\nmain :: IO ()\nmain = print (fee (Delivery 7) + fee Pickup)",
  "description": "`fee` has one equation for each constructor of `Order`.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "14"
  },
  "notice": "The pattern `(Delivery km)` matches a delivery and binds its field to `km`, so `fee (Delivery 7)` is 14. `Pickup` has no fields and costs 0."
}
</script>
</div>

## Puzzle 28: A Field Is a Function

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Song.hs",
  "code": "data Song = Song { title :: String, plays :: Int }\n\nmain :: IO ()\nmain = print (plays (Song \"Run\" 31))",
  "description": "`Song` is declared with named fields.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "31"
  },
  "notice": "Each field name in a record declaration is also a function that reads that field, so `plays` takes a `Song` and returns its play count. `Song \"Run\" 31` fills the fields in their declared order."
}
</script>
</div>

## Puzzle 29: Walking a Recursive Type

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Route.hs",
  "code": "data Route = Arrive | Leg Int Route\n\ndistance :: Route -> Int\ndistance Arrive        = 0\ndistance (Leg km rest) = km + distance rest\n\nmain :: IO ()\nmain = print (distance (Leg 4 (Leg 5 Arrive)))",
  "description": "A `Route` is either finished or one leg followed by the rest of the route.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "9"
  },
  "notice": "The recursion follows the type: each `Leg` adds its distance to the distance of the rest, and `Arrive` contributes 0, giving `4 + (5 + 0)`."
}
</script>
</div>

## Puzzle 30: An Old List After ++

<div data-program-output-lab>
<script type="application/json">
{
  "language": "haskell",
  "file": "Append.hs",
  "code": "main :: IO ()\nmain = do\n  let xs = [1, 2]\n      ys = xs ++ [3]\n  print (length ys + length xs)",
  "description": "`ys` is built by appending to `xs`.",
  "predict": true,
  "predictPrompt": "Write the line this program prints.",
  "output": {
    "stdout": "5"
  },
  "notice": "`++` builds a new list and leaves `xs` unchanged, so the lengths are 3 and 2. If appending changed `xs` in place, as `push_back` does in C++, the answer would be 6."
}
</script>
</div>

# Practice {#a-useful-study-loop}

## Recall the Big Ideas

Before rereading anything, explain each rule in your own words and name an experiment from this chapter that shows it:

1. Every function takes an argument and returns a value.
2. A function returns the same result whenever it receives the same arguments, and it has no side effects.
3. Names are bound once, and values never change.
4. Functions are values: they can be passed, returned, and stored.
5. Data is a set of constructors, taken apart with patterns.

<details markdown="1">
<summary>Compare your examples</summary>

1. `fahrenheit 25` returns `77.0`; even `rentalCost` takes one argument at a time ([Currying](#currying-one-argument-at-a-time)).
2. `ticket 100 3` is always `103`, because the number served is passed in instead of kept in a counter ([Same input, same output](#same-input-same-output)).
3. A second `rate = 6` is rejected, and `let` only creates a new local name ([Names are bound once](#names-are-bound-once)).
4. `twice`, `gradeScale`, and `between` take, return, and capture functions ([Functions](#functions)).
5. `Item`, `Playlist`, and `Tree` list their constructors, and their functions have one equation per constructor ([Data](#data)).

</details>

## Spaced Practice

Return the next day and rewrite one function from memory, such as `countShort` or `insert`, then check it in its evaluator. A week later, redo the puzzles before rereading, and work through a tutorial step you have not done yet. Away from the editor, derive the type of a function, trace a recursive call by hand, or find an input that distinguishes two plausible implementations. Correct answers on these short checks are evidence about those cases; a full course problem combines several of them.

## The Browser Workspace {#the-browser-workspace}

The evaluators and the tutorials use the site's locally pinned MicroHs runtime, a compact Haskell implementation rather than the complete Glasgow Haskell Compiler, so diagnostic wording may differ from lecture. An evaluator accepts an expression or `:type`; edit definitions in the code box above it. In the tutorials, **Run** executes the supplied `main`, **Test My Work** checks your functions, and **Reset Step** restores the starter code. Interactive terminal input, external packages, and compiler-specific extensions are outside these exercises.

The [Haskell report on expressions](https://www.haskell.org/onlinereport/haskell2010/haskellch3.html), [declarations and bindings](https://www.haskell.org/onlinereport/haskell2010/haskellch4.html), and [standard library definitions](https://www.haskell.org/onlinereport/haskell2010/haskellch9.html) are language references for after practice.

## Flashcards

Retrieve an answer before revealing it, then explain one example where the distinction matters. You can also [open the functional-programming flashcards in SE Gym](/se-gym/?flashcards=cs131_functional).

{% include flashcards.html id="cs131_functional" heading_level=3 %}

## Quiz

Commit to a reason before checking an answer. When feedback exposes a gap, construct a new example that distinguishes your original reasoning from the corrected one. You can also [open the functional-programming quiz in SE Gym](/se-gym/?quiz=cs131_functional).

{% include quiz.html id="cs131_functional" heading_level=3 %}
