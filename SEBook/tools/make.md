---
title: Makefiles & GNU Make
layout: sebook
---

<script src="/js/make-graph.js"></script>
<script src="/js/make-command-lab.js"></script>
<link rel="stylesheet" href="/css/make-graph.css">
<link rel="stylesheet" href="/css/make-command-lab.css">

## Motivation

Imagine you are building a small C program. It just has one file, `main.c`. To compile it, you simply open your terminal and type:

`gcc main.c -o myapp`

Easy enough, right? 

> **Want to practice?** Try the [Interactive Makefile Tutorial](/SEBook/tools/makefile-tutorial.html) — 10 hands-on exercises that build from basic rules to automatic variables and pattern rules, with real-time feedback.

Now, imagine your project grows. You add `utils.c`, `math.c`, and `network.c`. Your command grows too:

`gcc main.c utils.c math.c network.c -o myapp`

Still manageable. But what happens when you join a real-world software team? An operating system kernel or a large application might have **thousands** of source files. Typing them all out is impossible. 


## First Attempt: The Shell Script
To solve this, you might write a simple shell script (`build.sh`) that just compiles everything in the directory:
`gcc *.c -o myapp`

This works, but it introduces a massive new problem: **Time.**
Compiling a massive codebase from scratch can take minutes or even hours. If you fix a single typo in `math.c`, your shell script will blindly recompile all 9,999 other files that *didn't* change. That is incredibly inefficient and will destroy your productivity as a developer.


## The "Aha!" Moment: Incremental Builds
What you actually need is a smart tool that asks two questions before doing any work:
1. What exactly depends on what? (e.g., "The executable depends on the object files, and the object files depend on the C files and Header files").
2. Has the source file been modified *more recently* than the compiled file?

If `math.c` was saved at 10:05 AM, but `math.o` (its compiled object file) was created at 9:00 AM, the tool knows `math.c` has changed and *must* be recompiled. If `utils.c` hasn't been touched since yesterday, the tool completely skips recompiling it and just reuses the existing `utils.o`. 


This is exactly why **`make`** was created by Stuart Feldman at Bell Labs in 1976 {% cite Feldman1979Make %}, and why it remains a staple of software engineering today. Modern development primarily relies on **GNU Make**, a powerful and widely-extended implementation that reads a configuration file called a **Makefile**. 

So GNU **`make`** is the project's *engine* that reads recipes from **Makefiles** to build complex products.

### How It Works
Inside a Makefile, you define three main components:
* **Targets:** What you want to build or the task you want to run.
* **Prerequisites:** The files that must exist (or be updated) before the target can be built.
* **Commands:** The exact terminal steps required to execute the target.

When you type `make` in your terminal, the tool analyzes the dependency graph and checks file modification timestamps. It then executes the bare minimum number of commands required to bring your program up to date.

### The Dual Purpose
Makefiles are incredibly powerful—but their design can be confusing at first glance because they serve two distinct purposes:
1. **Building Artifacts:** Their primary, traditional use is for compiling languages (like C and C++), where they manage the complex process of turning source code into executable files.
2. **Running Tasks:** In modern development, they are frequently used with interpreted languages (like Python) as a convenient shortcut for common project tasks (e.g., `make install`, `make test`, `make lint`, `make deploy`). 

### Why We Need Makefiles
Ultimately, Makefiles are heavily relied upon because they:
1. **Save massive amounts of time** by enabling incremental builds (only recompiling the specific files that have changed).
2. **Automate complex processes** so developers don't have to memorize long or tedious terminal commands.
3. **Standardize workflows** across teams by providing predictable, universal commands (like `make test` to run all tests or `make clean` to delete generated files).
4. **Document dependencies**, making it perfectly clear how all the individual pieces of a software system fit together.


## The Cake Analogy

Think of Makefiles as a recipe book for baking a complex, multi-layered cake. 
Let's make a spectacular three-tier chocolate cake with raspberry filling and buttercream frosting. 
A **Makefile** is your ultimate, highly-efficient kitchen manager and master recipe combined.

Here is how the concepts map together:
## Concepts 
### 1. The Targets (What you are making)
In a Makefile, a **target** is the file you want to generate. 
* **The Final Target (The Executable):** This is the fully assembled, frosted, and decorated cake ready for the display window.
* **Intermediate Targets (e.g., Object Files in C):** These are the individual components that must be made before the final cake can be assembled. In this case, your intermediate targets are the *baked chocolate layers*, the *raspberry filling*, and the *buttercream frosting*. 
If we know how to bake each individual component and we know how to combine each of them together, we can bake the cake. 
Makefiles allow you to define the targets and the dependencies in a structured, isolated way that describes each component individually.

### 2. The Dependencies (What you need to make it)
Every target in a Makefile has **dependencies**—the things required to build it. 
* **Raw Source Code (Source Files):** These are your raw ingredients: flour, sugar, cocoa powder, eggs, butter, and fresh raspberries. 
* **Chain of Dependencies:** The *Final Cake* depends on the *chocolate layers*, *filling*, and *frosting*. The *chocolate layers* depend on *flour, sugar, eggs, and cocoa powder*. 

## Worked example of the Cake Recipe

Let's build the Makefile for our cake recipe. 

### Iteration 1: The Basic Rule (The Blueprint)

**The Need:** We need to tell our kitchen manager (`make`) what our final goal is, what it requires, and how to put it together.

**The Syntax:** The most fundamental building block of a Makefile is a **Rule**. A rule has three parts:
1.  **Target:** What you want to build (followed by a colon `:`).
2.  **Dependencies:** What must exist *before* you can build it (separated by spaces).
3.  **Command:** The actual terminal command to build it. **CRITICAL:** This line *must* start with a literal `Tab` character, not spaces.

```makefile
# Step 1: The Basic Rule
cake: chocolate_layers raspberry_filling buttercream
	echo "Stacking chocolate_layers, raspberry_filling, and buttercream to make the cake."
	touch cake
```

Note: *If you run this now (i.e., ask the kitchen manager to bake the cake), `make cake` will complain: "No rule to make target 'chocolate_layers'". It knows it needs them, but it doesn't know how to bake them.*

### Iteration 2: The Dependency Chain

**The Need:** We need to teach `make` how to create the missing intermediate ingredients so it can satisfy the requirements of the final `cake`.

**The Syntax:** We simply add more rules. The order of rules in the Makefile does not matter for execution — `make` reads all the rules, builds a dependency graph from them, and then traverses that graph from the goal target down to the leaves, building each prerequisite before the target that needs it. The first non-special rule in the file is used as the *default goal* if no target is given on the command line.

```makefile
# Step 2: Adding the Chain
cake: chocolate_layers raspberry_filling buttercream
	echo "Stacking layers, filling, and frosting to make the cake."
	touch cake

chocolate_layers: flour.txt sugar.txt eggs.txt cocoa.txt
	echo "Mixing ingredients and baking at 350 degrees."
	touch chocolate_layers

raspberry_filling: raspberries.txt sugar.txt
	echo "Simmering raspberries and sugar."
	touch raspberry_filling

buttercream: butter.txt powdered_sugar.txt
	echo "Whipping butter and sugar."
	touch buttercream
```
*Now the kitchen works! But notice we hardcoded "350 degrees". If we get a new convection oven that bakes at 325 degrees, we have to manually find and change that number in every single baking rule.*


### Iteration 3: Variables (Macros)

**The Need:** We want to define our kitchen settings in **one place at the top** of the file so they are easy to change later.

**The Syntax:** You define a variable with `NAME = value` and you use it by wrapping it in a dollar sign and parentheses: `$(NAME)`. 

```makefile
# Step 3: Variables
OVEN_TEMP = 350
MIXER_SPEED = high

cake: chocolate_layers raspberry_filling buttercream
	echo "Stacking layers to make the cake."
	touch cake

chocolate_layers: flour.txt sugar.txt eggs.txt cocoa.txt
	echo "Baking at $(OVEN_TEMP) degrees."
	touch chocolate_layers

buttercream: butter.txt powdered_sugar.txt
	echo "Whipping at $(MIXER_SPEED) speed."
	touch buttercream
```
*(I've omitted the filling rule here just to keep the example short, but you get the idea).*

---

### Iteration 4: Automatic Variables (The Shortcuts)

**The Need:** Look at the `chocolate_layers` rule. We list all the ingredients in the dependencies, but in a real C++ program, you also have to list all those exact same files again in the compiler command. Typing things twice causes typos.

**The Syntax:** Makefiles have built-in "Automatic Variables" that act as shortcuts:
* `$@` automatically means **"The name of the current target"**.
* `$^` automatically means **"The names of ALL the dependencies"**.

```makefile
# Step 4: Automatic Variables
OVEN_TEMP = 350

cake: chocolate_layers raspberry_filling buttercream
	echo "Making $@" 
	touch $@

chocolate_layers: flour.txt sugar.txt eggs.txt cocoa.txt
	echo "Taking $^ and baking them at $(OVEN_TEMP) to make $@"
	touch $@
```
*Now, the command `echo "Taking $^ ..."` will automatically print out: "Taking flour.txt sugar.txt eggs.txt cocoa.txt...". If you add a new ingredient to the dependency list later, the command updates automatically!*

---

### Iteration 5: Phony Targets (`.PHONY`)

**The Need:** Sometimes we make a terrible mistake and just want to throw everything in the trash and start completely over. We want a command to wipe the kitchen clean. 

**The Syntax:** We create a rule called `clean` that deletes files. However, what if you accidentally create a real text file named "clean" in your folder? `make` will look at the file, see it has no dependencies, and say "The file 'clean' is already up to date. I don't need to do anything." 

To fix this, we use `.PHONY`. This tells `make`: *"Hey, this isn't a real file. It's just a command name. Always run it when I ask."*

```makefile
# Step 5: The Final, Complete Scaffolding
OVEN_TEMP = 350

cake: chocolate_layers raspberry_filling buttercream
	echo "Making $@" 
	touch $@

chocolate_layers: flour.txt sugar.txt eggs.txt cocoa.txt
	echo "Taking $^ and baking them at $(OVEN_TEMP) to make $@"
	touch $@

# ... (other recipes) ...

.PHONY: clean
clean:
	echo "Throwing everything in the trash!"
	rm -f cake chocolate_layers raspberry_filling buttercream
```

By typing `make clean` in your terminal, the kitchen is reset. By typing `make cake` (or just `make`, as it defaults to the first rule), your fully automated bakery springs to life.

Now we get this complete Makefile:

```makefile
# ---------------------------------------------------------
# Complete Makefile for a Three-Tier Chocolate Raspberry Cake
# ---------------------------------------------------------

# Variables (Kitchen settings)
OVEN_TEMP = 350
MIXER_SPEED = medium-high

# 1. The Final Target: The Cake
# Depends on the baked layers, filling, and frosting
cake: chocolate_layers raspberry_filling buttercream
	@echo "🎂 Assembling the final cake!"
	@echo "-> Stacking layers, spreading filling, and covering with frosting."
	@touch cake
	@echo "✨ Cake is ready for the display window! ✨"

# 2. Intermediate Target: Chocolate Layers
# Depends on raw ingredients (our source files)
chocolate_layers: flour.txt sugar.txt eggs.txt cocoa.txt
	@echo "🥣 Mixing flour, sugar, eggs, and cocoa..."
	@echo "🔥 Baking in the oven at $(OVEN_TEMP) for 30 minutes."
	@touch chocolate_layers
	@echo "✅ Chocolate layers are baked."

# 3. Intermediate Target: Raspberry Filling
raspberry_filling: raspberries.txt sugar.txt lemon_juice.txt
	@echo "🍓 Simmering raspberries, sugar, and lemon juice."
	@touch raspberry_filling
	@echo "✅ Raspberry filling is thick and ready."

# 4. Intermediate Target: Buttercream Frosting
buttercream: butter.txt powdered_sugar.txt vanilla.txt
	@echo "🧁 Whipping butter and sugar at $(MIXER_SPEED) speed."
	@touch buttercream
	@echo "✅ Buttercream frosting is fluffy."

# 5. Pattern Rule: "Shopping" for Raw Ingredients
# In a real codebase, these would already exist as your code files.
# Here, if an ingredient (.txt file) is missing, Make creates it.
%.txt:
	@echo "🛒 Buying ingredient: $@"
	@touch $@

# 6. Phony Target: Clean the kitchen
# Removes all generated files so you can bake from scratch
.PHONY: clean
clean:
	@echo "🧽 Cleaning up the kitchen..."
	@rm -f cake chocolate_layers raspberry_filling buttercream *.txt
	@echo "🧹 Kitchen is spotless!"

```

### 3. The Rules (The Recipe/Commands)
A *rule* in a Makefile pairs a target with its prerequisites and a *recipe*: the sequence of shell commands `make` runs to turn those prerequisites into the target. The recipe doesn't have to call a compiler — it's just shell commands, so `make` can drive any tool (linter, packager, doc generator, deployer).
* **Compiling:** The rule to turn flour, sugar, and eggs into a chocolate layer is: *"Mix ingredients in bowl A, pour into a 9-inch pan, and bake at 350°F for 30 minutes."*
* **Linking:** The rule to turn the individual layers, filling, and frosting into the Final Cake is: *"Stack layer, spread filling, stack layer, cover entirely with frosting."*

This can be visualized as a dependency graph:

![Dependency graph: the final cake depends on chocolate layers, raspberry filling, and buttercream; chocolate layers depend on flour, sugar, and eggs; raspberry filling depends on raspberries and sugar; buttercream depends on butter and powdered sugar.](/img/cake_dependency_graph.svg)

### The Real Magic: Incremental Baking (Why we use Makefiles)

The true power of a Makefile isn't just knowing *how* to bake the cake; it's knowing **what doesn't need to be baked again**. `Make` looks at the "timestamps" of your files to save time.

Imagine you are halfway through assembling your cake. You have your baked chocolate layers sitting on the counter, your buttercream whipped, and your raspberry filling ready. Suddenly, you realize someone mislabeled the sugar. It's actually salt! Oh no! You need to remake everything that included sugar and everything that included these intermediate targets.

* **Without a Makefile:** You would throw away *everything*. You would re-bake the chocolate layers, re-whip the buttercream, and remake the raspberry filling from scratch. This takes hours (like recompiling a massive codebase from scratch).
* **With a Makefile:** The kitchen manager (`make`) looks at the counter. It sees that the *buttercream* is already finished and its raw ingredients haven't changed. However, it sees your new packet of sugar (a source file was updated). The manager says: **"Only remake the raspberry filling and the chocolate layers, and then reassemble the final cake. Leave the buttercream as is."**


If you look closely at the arrows of the dependency graph above and focus on the arrows leaving `[sugar.txt]`, you can immediately see the brilliance of `make`:

1.  **The Split Path:** The arrow from `sugar.txt` forks into two different directions: one goes to the `Chocolate_Layers` and the other goes to the `Raspberry_Filling`. 
2.  **The Safe Zone:** Notice there is absolutely no arrow connecting `sugar.txt` to the `Buttercream` (which uses powdered sugar instead). 
3.  **The Chain Reaction:** When `make` detects that `sugar.txt` has changed (because you fixed the salty sugar), it travels along those two specific arrows. It forces the Chocolate Layers and Raspberry filling to be remade. Those updates then trigger the double-lined arrows `══▶`, forcing the Final Cake to be reassembled.

Because no arrow carried the "sugar update" to the Buttercream, the Buttercream is completely ignored during the rebuild!

## See it in action: how `make` decides what to rebuild

The cake metaphor is helpful — but software engineers reason about *files*, *timestamps*, and *the dependency graph*. The five interactive demos below let you watch `make` make its decisions on a small C project. Each demo uses the same simple graph: `app` is built from `main.o` and `util.o`, which in turn come from `main.c` and `util.c`. Some demos add a shared header. Click the command to apply it; click again to undo. Multi-step demos have **Back** and **Auto-play** controls; you can also use ← → arrow keys when the demo has focus.

A reading guide for each diagram (these conventions are the same ones the [interactive Makefile tutorial](/SEBook/tools/makefile-tutorial.html) uses):

* **Solid green stripe + ✓ glyph** — the file is up to date.
* **Diagonal-hatched red stripe + ● glyph (pulsing)** — the target is *stale*; `make` would rebuild it.
* **Dashed border + ⌖ glyph** — the target is *phony* (not a file). `make` always runs it.
* **Italic, no border** — the file is a *source*. `make` never rebuilds these; you (or your editor) do.
* **Dashed edge** — an *order-only* prerequisite. The arrow says "must exist before me", not "rebuild me when newer."

### Demo 1 — What `make` checks

<div data-make-graph-spec aria-label="Sample dependency graph for a small C project — app depends on main.o and util.o, which depend on main.c and util.c respectively, all sharing shared.h.">
<script type="application/json">
{
  "topology": "app: main.o util.o\nmain.o: main.c shared.h\nutil.o: util.c shared.h",
  "state": { "mtime": { "main.c": 1, "shared.h": 1, "util.c": 1, "main.o": 2, "util.o": 2, "app": 3 } },
  "caption": "A small C project. `app` is the final executable; `main.o`/`util.o` are intermediate object files; `main.c`/`util.c`/`shared.h` are sources. Every target's mtime is greater than its prerequisites' — so all targets are up to date."
}
</script>
</div>

When you run `make`, it walks this graph from the top. For each target, it asks one simple question: *is any of my prerequisites newer than me?* If yes, rebuild this target. If no, skip it. Phony targets bypass the comparison entirely (they're always considered "needs running"). That's the entire algorithm.

### Demo 2 — Touching a source file → cascade of staleness

<div data-make-command-lab-multi aria-label="Multi-step demo: editing main.c marks main.o and app stale; running make rebuilds only main.o and app, leaving util.o alone.">
<script type="application/json">
{
  "title": "Touch main.c, then run make",
  "description": "You edit `main.c`. Watch the cascade of staleness, then how `make` rebuilds *only* what changed. The two-step rhythm is the entire developer feedback loop: **edit → make**, every time.",
  "topology": "app: main.o util.o\nmain.o: main.c shared.h\nutil.o: util.c shared.h",
  "makefile": "app: main.o util.o\n\tgcc -o app main.o util.o\n\nmain.o: main.c shared.h\n\tgcc -c main.c -o main.o\n\nutil.o: util.c shared.h\n\tgcc -c util.c -o util.o\n",
  "initialState": {
    "mtime": { "main.c": 1, "shared.h": 1, "util.c": 1, "main.o": 2, "util.o": 2, "app": 3 }
  },
  "steps": [
    {
      "command": "touch main.c",
      "description": "You saved `main.c` (or your editor did). Its mtime jumps to *newer* than `main.o`. **Notice:** `main.o` is now stale, and that staleness cascades up — `app` depends on `main.o`, so `app` is stale too. `util.c`, `util.o` are untouched.",
      "state": { "mtime": { "main.c": 4 } }
    },
    {
      "command": "make",
      "description": "`make` walks the graph. It rebuilds `main.o` (its `.c` is newer), then re-links `app`. **`util.o` is left alone** — its prerequisites didn't change, so the work is skipped. *This is the whole reason `make` exists.*",
      "state": { "mtime": { "main.o": 5, "app": 6 } },
      "output": "gcc -c main.c -o main.o\ngcc -o app main.o util.o"
    }
  ]
}
</script>
</div>

A common student misconception: *"if anything changes, `make` recompiles everything."* That's not how it works — only nodes downstream of the change in the dependency graph are rebuilt. The graph is the contract that lets `make` skip work safely.

### Demo 3 — Phony targets always run

<div data-make-command-lab aria-label="Demo: make clean is a phony target; it ignores timestamps and always runs its recipe, deleting build artifacts and leaving the source files untouched.">
<script type="application/json">
{
  "command": "make clean",
  "description": "`clean` is **phony** (dashed border, crosshair glyph). `make` doesn't compare timestamps for phony targets — it always runs the recipe. Here the recipe is `rm -f *.o app`. After it runs, `app`, `main.o`, `util.o` no longer exist on disk; they show as stale (red hatched stripe) because there's no file to compare against. Sources `main.c`/`util.c` are never touched.",
  "topology": "app: main.o util.o\nmain.o: main.c\nutil.o: util.c\n.PHONY: clean\nclean:",
  "makefile": "app: main.o util.o\n\tgcc -o app main.o util.o\n\nmain.o: main.c\n\tgcc -c main.c -o main.o\n\nutil.o: util.c\n\tgcc -c util.c -o util.o\n\n.PHONY: clean\nclean:\n\trm -f *.o app\n",
  "before": { "mtime": { "main.c": 1, "util.c": 1, "main.o": 2, "util.o": 2, "app": 3 } },
  "after":  { "mtime": { "main.c": 1, "util.c": 1 } },
  "undoCommand": "(restore from backup)"
}
</script>
</div>

The contrast that makes this concept stick: a non-phony target with no prerequisites would be considered "up to date as long as the file exists." The `.PHONY` declaration is what flips the switch. Common phony targets include `clean`, `install`, `test`, `run`, `dist`, `docs`. They're verbs (actions) rather than nouns (files).

### Demo 4 — Order-only prerequisites

<div data-make-command-lab aria-label="Demo: an order-only prerequisite (build directory) updates its mtime but does not mark app as stale, because order-only edges don't propagate staleness.">
<script type="application/json">
{
  "command": "echo something > build/log",
  "description": "An *order-only* prerequisite (after the `|` in the Makefile rule) tells `make`: \"this must **exist** before I run, but don't trigger a rebuild just because it has a newer mtime.\" The classic use is a build directory whose mtime updates every time a file is written into it — without order-only, every `.o` would be rebuilt every time. **Notice:** the `app → build` edge is **dashed**. After we touch `build`, its mtime is the newest in the graph — but `app` stays *up to date*. With a normal edge, `app` would be marked stale.",
  "topology": "app: main.o util.o | build\nmain.o: main.c\nutil.o: util.c\nbuild:",
  "makefile": "app: main.o util.o | build\n\tgcc -o app main.o util.o\n\nmain.o: main.c\n\tgcc -c main.c -o main.o\n\nutil.o: util.c\n\tgcc -c util.c -o util.o\n\nbuild:\n\tmkdir -p build\n",
  "before": { "mtime": { "main.c": 1, "util.c": 1, "main.o": 2, "util.o": 2, "app": 3, "build": 1 } },
  "after":  { "mtime": { "main.c": 1, "util.c": 1, "main.o": 2, "util.o": 2, "app": 3, "build": 5 } }
}
</script>
</div>

Order-only is the answer to one of the most painful "why does my build keep redoing everything?" mysteries. It separates the two distinct ideas that students often conflate: *"X must come before Y"* vs. *"X being newer means Y is out of date."* The first is *ordering*, the second is *staleness propagation* — and Makefiles let you choose.

### Demo 5 — Putting it together: edit → build → clean → rebuild

<div data-make-command-lab-multi aria-label="Multi-step demo: a full development cycle — edit a header, build, clean, build from scratch — showing how each command interacts with the dependency graph.">
<script type="application/json">
{
  "title": "A full edit / build / clean / rebuild cycle",
  "description": "The full developer rhythm. We start fresh, edit a *header* (which has a wider blast radius than a single .c), rebuild, clean, and rebuild from scratch. Each step shows which files are touched and which are skipped.",
  "topology": "app: main.o util.o\nmain.o: main.c shared.h\nutil.o: util.c shared.h\n.PHONY: clean\nclean:",
  "makefile": "app: main.o util.o\n\tgcc -o app main.o util.o\n\nmain.o: main.c shared.h\n\tgcc -c main.c -o main.o\n\nutil.o: util.c shared.h\n\tgcc -c util.c -o util.o\n\n.PHONY: clean\nclean:\n\trm -f *.o app\n",
  "initialState": {
    "mtime": { "main.c": 1, "shared.h": 1, "util.c": 1, "main.o": 2, "util.o": 2, "app": 3 }
  },
  "steps": [
    {
      "command": "touch shared.h",
      "description": "You edited `shared.h`. **Both** `main.o` and `util.o` depend on it, so the staleness cascade is wider than Demo 2 — both objects flip stale, and `app` flips with them.",
      "state": { "mtime": { "shared.h": 4 } }
    },
    {
      "command": "make",
      "description": "Two compiles + one link. Notice every target downstream of `shared.h` rebuilt — that's why minimizing what `shared.h` exposes (forward declarations, narrow includes) is a real perf win on large codebases.",
      "state": { "mtime": { "main.o": 5, "util.o": 5, "app": 6 } },
      "output": "gcc -c main.c -o main.o\ngcc -c util.c -o util.o\ngcc -o app main.o util.o"
    },
    {
      "command": "make clean",
      "description": "`clean` is phony — runs unconditionally. The recipe deletes the build artifacts. They lose their mtimes (red hatched stripe).",
      "state": { "mtime": { "main.o": null, "util.o": null, "app": null } },
      "output": "rm -f *.o app"
    },
    {
      "command": "make",
      "description": "Cold rebuild. Every non-source target is missing → stale → rebuilt. This is what your CI pipeline does on every job.",
      "state": { "mtime": { "main.o": 7, "util.o": 7, "app": 8 } },
      "output": "gcc -c main.c -o main.o\ngcc -c util.c -o util.o\ngcc -o app main.o util.o"
    }
  ]
}
</script>
</div>

If you can predict, before clicking, what each step will change in the graph — you have a working mental model of `make`. (Editor headers cascade widely, phony targets always run, missing targets are stale.) That mental model is the single biggest payoff of learning Make: it transfers directly to every other build tool you'll meet later (Bazel, Gradle, Ninja, esbuild's incremental mode), because they all reduce to "what's stale, in topological order."

### A Recipe as a Makefile



If your cake recipe were written as a Makefile, it would look exactly like this:

> **Final_Cake:** Chocolate_Layers Raspberry_Filling Buttercream
> *Stack components and frost the outside.*
>
> **Chocolate_Layers:** Flour Sugar Eggs Cocoa
> *Mix ingredients and bake at 350°F for 30 minutes.*
>
> **Raspberry_Filling:** Raspberries Sugar Lemon_Juice
> *Simmer on the stove until thick.*
>
> **Buttercream:** Butter Powdered_Sugar Vanilla
> *Whip in a stand mixer until fluffy.*

Whenever you type `make` in your terminal, the system reads this recipe from the top down, checks what is already sitting in your "kitchen", and only does the work absolutely necessary to give you a fresh cake.


## Makefile Syntax

### How Do Makefiles Work?

A Makefile is built around a simple logical structure consisting of **Rules**. A rule generally looks like this:

```makefile
target: prerequisites
	command
```
* **Target**: The file you want to generate (like an executable or an object file), or the name of an action to carry out (like `clean`).
* **Prerequisites (Dependencies)**: The files that are required to build the target. 
* **Commands (Recipe)**: The shell commands that `make` executes to build the target. *(Note: Commands MUST be indented with a Tab character, not spaces!)*

When you run `make`, it looks at the target. If any of the prerequisites have a newer modification timestamp than the target, `make` executes the commands to update the target. The dependency relationships you declare matter immensely; for example, if you remove the object files (`$(OBJS)`) prerequisite from your main executable rule (e.g., `$(TARGET): $(OBJS)`), `make` will no longer trigger a re-link when the object files change, because the dependency relationship has been removed.

### Syntax Basics

To write flexible and scalable Makefiles, you will use a few specific syntactic features:

* **Variables (Macros)**: Variables act as placeholders for command-line options, making the build rules cleaner and easier to modify. For example, you can define a variable for your compiler (`CC = clang`) and your compiler flags (`CFLAGS = -Wall -g`). When you want to use the variable, you wrap it in parentheses and a dollar sign: `$(CC)`.
* **String Substitution**: You can easily transform lists of files. For example, to generate a list of `.o` object files from a list of `.c` source files, you can use the syntax: `OBJS = $(SRCS:.c=.o)`.
* **Automatic Variables**: `make` provides special variables to make rules more concise.
    * `$@` represents the target name.
    * `$<` represents the first prerequisite.
    * `$^` represents all prerequisites.
* **Pattern Rules**: Pattern rules serve as templates for creating many rules with the identical structure. For instance, `%.o : %.c` defines a generic rule for creating a `.o` (object) file from a corresponding `.c` (source) file.

### A Worked Example
Let's tie all of these concepts together into a stereotypical, robust Makefile for a C program.

```makefile
# Variables
SRCS = mysrc1.c mysrc2.c
TARGET = myprog
OBJS = $(SRCS:.c=.o)
CC = clang
CFLAGS = -Wall

# Main Target Rule
$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $(TARGET) $(OBJS)

# Pattern Rule for Object Files
%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

# Clean Target
clean:
	rm -f $(OBJS) $(TARGET)
```

**Breaking it down:**
* **Line 2-6:** We define our variables. If we later want to use the `gcc` compiler instead, or add an optimization flag like `-O3`, we only need to change the `CC` or `CFLAGS` variables at the top of the file. 
* **Line 9-10:** This rule says: "To build `myprog`, I need `mysrc1.o` and `mysrc2.o`. To build it, run `clang -Wall -o myprog mysrc1.o mysrc2.o`."
* **Line 13-14:** This pattern rule explains *how* to turn a `.c` file into a `.o` file. It tells Make: "To compile any object file, use the compiler to compile the first prerequisite (`$<`, which is the `.c` file) and output it to the target name (`$@`, which is the `.o` file)".
* **Line 17-18:** The `clean` target is a convention used to remove all generated object files and the target executable, leaving only the original source files. You can execute it by running `make clean`.

## Practice

{% include flashcards.html id="makefile_syntax" %}

{% include flashcards.html id="makefile_examples" %}

{% include flashcards.html id="makefile_examples_2" %}

{% include quiz.html id="makefile" %}
