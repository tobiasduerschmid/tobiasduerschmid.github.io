---
title: Design with Reuse
layout: sebook
---

# Design with Reuse

Software reuse means designing a solution so that useful parts can serve more than one context without being copied and re-edited by hand. Reuse is not just a matter of saving typing. Its real value is that shared behavior can be improved, tested, and documented in one place.

Good reuse starts with a stable responsibility. A module that hides a clear decision, exposes a small interface, and depends on few accidental details is much easier to reuse than code that only happens to work in one screen, one assignment, or one data shape.

## Why Reuse Matters

Reuse helps a team when it reduces repeated reasoning, not merely repeated code.

| Reuse goal | Design pressure |
|---|---|
| Avoid duplicated fixes | Put shared behavior behind one tested implementation. |
| Support multiple clients | Keep the public interface small and explicit. |
| Allow independent change | Hide implementation decisions that callers do not need. |
| Preserve readability | Reuse concepts, not tangled convenience shortcuts. |

Poor reuse has the opposite effect. A shared helper with too many parameters, hidden global state, or caller-specific branches becomes harder to change than two straightforward implementations. The goal is not to make everything generic. The goal is to recognize the parts of the design that are genuinely stable across contexts.

## Reuse and Other Design Principles

Design with reuse builds directly on the other design principles in this chapter:

* [Separation of Concerns](/SEBook/designprinciples/soc.html) helps identify which part of the system is reusable and which part is specific to the current UI, workflow, or environment.
* [Information Hiding](/SEBook/designprinciples/informationhiding.html) lets callers depend on what a component promises, not how it happens to work internally.
* [SOLID](/SEBook/designprinciples/solid.html) gives object-oriented techniques for extension, substitution, and dependency control when reuse spans multiple implementations.

## A Practical Test

Before extracting reusable code, ask three questions:

1. **What decision is this module hiding?** If the answer is vague, the abstraction is probably premature.
2. **Who will depend on this interface?** Reuse across real clients is more trustworthy than reuse imagined for a hypothetical future.
3. **What should be allowed to change later?** A reusable component should protect callers from likely internal change, not freeze the first implementation forever.

The best reusable designs are boring at the boundary: clear names, small inputs, predictable outputs, and no surprising dependencies.

## A Motivating Story: 11 Lines That Broke the Internet

On March 22, 2016, a JavaScript developer named Azer Koçulu had a dispute with npm — over a trademark conflict with the messaging-app company Kik — and decided to unpublish all of his packages. One of them — **`left-pad`** — was 11 lines of code that prepended characters to the front of a string for alignment. It had on the order of **a few dozen GitHub stars** and around **one million downloads per week** at the time, because it sat transitively underneath React, Babel, and most modern web build pipelines.

When the package vanished from the registry, build processes across the internet started failing with `npm ERR! 404 'left-pad' is not in the npm registry`. Facebook, Netflix, Spotify — anyone whose pipeline transitively pulled left-pad — was suddenly broken. Most developers had no idea they were even *using* it. Two hours later, npm took the unprecedented step of "un-unpublishing" the package to stop the bleeding.

Eleven lines. One unilateral decision. The entire JavaScript ecosystem brought to its knees.

This story is not just a curiosity — it is a window into **Design with Reuse**, the practice of building new software mostly by composing existing modules. Reuse is one of the most powerful levers in modern software engineering, and one of the most dangerous if applied without judgment.

## The Vision vs. The Reality of Reuse

The **vision** of reuse goes back to Malcolm Douglas McIlroy's famous 1968 NATO conference paper, *["Mass Produced Software Components"](https://www.cs.dartmouth.edu/~doug/components.txt)*. McIlroy imagined a future where software engineering would resemble hardware engineering: developers would shop in a catalog of pre-built, well-documented, highly compatible components and snap them together to build new systems.

The **reality**, more than fifty years later, is messier. David Garlan, Robert Allen, and John Ockerbloom captured it in their 1995 paper *"Architectural Mismatch: Why Reuse Is So Hard"* (and its [2009 retrospective](https://ieeexplore.ieee.org/document/5235971)): real-world modules are only *partially* compatible. They make countless undocumented assumptions about how they will be called, what threading model is in use, where state lives, who owns memory. To assemble them, developers spend enormous effort writing **glue code** to bridge the mismatches.

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout portrait
class Library1 <<library>>
class Library2 <<library>>
class GlueCode <<glue>>
class YourSystem <<application>>

YourSystem --> Library1 : uses (clean fit)
YourSystem --> GlueCode : uses
GlueCode --> Library2 : adapts to incompatible API

note bottom of GlueCode
  Real systems need adapter code
  to bridge undocumented assumptions
  between modules.
end note
@enduml'></div>

Reuse, then, is not free. It is an engineering decision with **costs, benefits, and risks** that have to be weighed deliberately — and the right weighing depends on whether the code came from inside your own team or from a third party.

## Two Kinds of Reuse: Internal vs. External

| Kind                | Where the code comes from                                  | Examples                                            |
|---------------------|------------------------------------------------------------|-----------------------------------------------------|
| **Internal Reuse**  | Same developer, team, or organization                      | Software product lines, shared internal libraries, component-based development |
| **External Reuse**  | A third party                                              | Commercial off-the-shelf software, open-source libraries, npm/PyPI/Maven packages, frameworks |

These two cases demand **different design strategies**. With internal reuse you usually have access to the source, the original author, and the original test suite. With external reuse you have to treat the module as a partially-known black box that can change, disappear, or turn malicious.

## Why Reuse At All? The Benefits

Done well, reuse delivers two big wins *(Barros-Justo et al., 2018)*:

1. **Higher productivity / faster time-to-market.** You don't re-implement what already exists. Implementation and testing time shrink.
2. **Higher software quality / fewer defects.** A widely-used module has been **tried and tested** by other users; many of its bugs have already been surfaced and fixed.

That second point is the deeper one. A library with 50,000 users is, statistically, *not* a piece of code you can match in correctness by writing your own version on a Tuesday afternoon. This is the strongest argument for the McIlroy vision — even imperfect reuse usually beats reinventing the wheel.

> **A flagship "reuse done right" example.** Python's `requests` library has been maintained since 2011, has a friendlier API than the standard library's `http.client`, and is downloaded over 500 million times per month. A team that adopts `requests` instead of rolling their own HTTP client typically saves weeks of work — and inherits years of bug fixes around redirects, timeouts, retries, chunked encoding, certificate verification, and proxy handling that almost no in-house implementation would get right on the first try. *Most* of the cautionary tales in this chapter exist *because* most reuse succeeds — the success stories simply aren't memorable.

## How to Design with External Reuse

### The Python Ecosystem: A Low-Entry-Barrier Reuse Culture

Most modern languages ship a culture of external reuse. In Python:

```python
import requests

response = requests.get("https://api.github.com")
response.status_code        # 200
response.json()             # {'current_user_url': 'https://api.github.com/user', ...}
```

One `pip install requests` and you have a battle-tested HTTP client. This is what the McIlroy vision looks like when it works. But every dependency you add is a long-term commitment — and that commitment has principles attached to it.

### Design Principle 1: Keep Versions of Your Dependencies Fixed

In April 2023, the Python library `urllib3` released version 2.0.0 with an API-breaking change: the `_make_request` method no longer accepted a `chunked` keyword argument. The `requests` library used `urllib3` internally; the `docker` library used `requests`. Suddenly, code that hadn't been touched in months started failing with:

```
docker.errors.DockerException: Error while fetching server API version:
request() got an unexpected keyword argument 'chunked'
```

The lesson: **a package update you did not ask for can still break you**, because your dependencies' dependencies may auto-resolve to a newer, incompatible version.

The defense is to **pin your dependencies**. Almost every package manager supports this through a lock file or virtual environment:

| Language | Tool & file                                |
|----------|--------------------------------------------|
| Python   | Pipenv → `Pipfile` and `Pipfile.lock`; `pip` → `requirements.txt`; Poetry → `pyproject.toml` |
| Node.js  | npm → `package-lock.json`; pnpm/yarn lockfiles |
| Java     | Maven → `pom.xml`; Gradle → `gradle.lockfile` |
| Rust     | Cargo → `Cargo.lock`                       |

A Python `Pipfile` example:

```toml
[packages]
urllib3 = "<2.0.0"
docker  = "==7.1.0"

[dev-packages]
pytest = "==5.4.2"
mypy   = "==0.910"

[requires]
python_version = "3.9"
```

Then `pipenv install` resolves *one* set of versions and `pipenv run <program>` runs against them. Anyone cloning the repo gets the exact same dependency tree.

### Design Principle 2: Update Dependencies to Receive Security Patches

Pinning is necessary but not sufficient — because dependencies are not a one-time investment.

**The Heartbleed bug** in OpenSSL (CVE-2014-0160) is the canonical cautionary tale. OpenSSL's `Heartbeat` extension shipped with a buffer over-read vulnerability that let an attacker leak up to 64 kB of process memory per request — potentially including private keys, passwords, and session tokens.

> **Pause and predict.** A *patched* version of OpenSSL was available on the same day the bug was disclosed. How long do you think it took the world to actually apply the patch? Take a guess before reading the table.

| Date           | What happened                                                       |
|----------------|---------------------------------------------------------------------|
| March 2012     | Vulnerable code ships in OpenSSL 1.0.1                              |
| April 1, 2014  | Bug independently discovered by Google's Neel Mehta                 |
| April 7, 2014  | Fixed version 1.0.1g released; **17 %** of secure web servers still vulnerable that day |
| May 20, 2014   | **1.5 %** of the most popular TLS-enabled websites still vulnerable |
| January 2017   | ~**180,000** internet-connected devices still vulnerable            |
| July 2019      | ~**91,000** devices still vulnerable, more than 5 years after the fix |

The takeaway is double-edged:

* **Reusable packages can introduce security vulnerabilities you did not write.** You inherit the bug.
* **But the same packages, when well-maintained, give you security fixes for free** — *if* you actually update.

So: **regularly check for security patches and bug fixes**, and be aware that an update might come bundled with API-breaking changes (see urllib3 above). The discipline is to update *intentionally*, on your own schedule, with a test suite that catches breakage early.

### Design Principle 3: Strive for Fewer Package Dependencies

Now back to `left-pad`. The package adds characters to the front of a string — 11 lines. Anyone could rewrite it from memory in two minutes. Yet by 2016, this trivial module sat under React, under Babel, under the build of essentially every major web application.

When the author unpublished it, all of those applications broke. The lesson is sharp:

* **Avoid reusing trivial code**, especially from unreliable sources. The maintenance, supply-chain, and reputational risks may exceed the cost of a five-minute reimplementation.
* **Carefully consider every new dependency.** It can break, stop being maintained, be abandoned, be unpublished, or — worse — be silently weaponized. The 2018 `eslint-scope` incident (a malicious version published to npm, [postmortem here](https://eslint.org/blog/2018/07/postmortem-for-malicious-package-publishes/)) showed that attackers actively target the npm supply chain.
* **Analyze your supply chain.** Tools like `npm audit`, `pip-audit`, `cargo audit`, GitHub Dependabot, and Snyk can flag known vulnerabilities and abandoned packages.

There is a tension between this principle and Principle 2 (use well-maintained dependencies to inherit fixes). The resolution is: *prefer the smallest number of well-maintained dependencies that genuinely save you implementation effort.*

### Design Principle 4: Prefer Well-Maintained, Popular Modules — But Fit Beats Popularity

Two more heuristics for choosing a candidate:

* **Maintenance signals.** Does the team commit often? Are issues triaged and fixed? Is there a security advisory feed? Does it support current platforms and language versions?
* **Popularity signals.** A package with many users is more likely to resolve issues quickly and to have good documentation. (npm's emergency "un-unpublishing" of left-pad happened *because* it was so popular.)

But popularity has a ceiling: **fit to your context is more important than popularity**. The most starred CSV parser on GitHub is useless if it cannot handle the 2 GB files your domain actually produces.

### The Cost-Benefit Scale for External Reuse

When considering whether to take on an external dependency, weigh:

| Effort to **adapt** the reusable module (cost)  | Effort **saved** by reusing it (benefit) |
|-------------------------------------------------|------------------------------------------|
| Integration effort (complexity, context fit)   | Implementation effort                    |
| Finding & evaluating the right module           | Testing effort                           |
| Updating effort over time                       | Free update propagation (incl. security patches) |
| Limits on future **changeability**              |                                          |

That last cost is sneaky: **relying heavily on reused code limits your changeability** once you need behavior the library does not offer. A small piece of glue is easy. A whole application built around a framework's worldview is hard to leave *(Xu et al., 2020)*.

## How to Design with Internal Reuse

Internal reuse looks easier on the surface — you wrote the code, you can read it, you can ask the author at the next standup. But the most expensive internal-reuse failure in software history says otherwise.

### The Ariane 5 Disaster

On June 4, 1996, the maiden flight of the European Space Agency's **Ariane 5** rocket lifted off — and self-destructed **37 seconds later**, taking roughly **$370 million** in payload with it.

> **Pause and predict.** The flight-control software had run flawlessly on the earlier Ariane 4 rocket for years. What's your hypothesis for why the *same software* destroyed Ariane 5? Take a guess before reading on.

The cause? Software reuse done badly.

The **Inertial Reference System (SRI)** had been reused directly from Ariane 4, where it had worked perfectly for years. It stored the rocket's horizontal velocity in a **16-bit integer**, a choice originally made for performance reasons under Ariane 4's flight profile.

But Ariane 5 was a bigger, faster rocket. Within seconds of launch, its horizontal velocity exceeded the maximum a 16-bit integer can hold. The conversion overflowed, the SRI faulted, the backup SRI (running the same code) faulted identically, and the rocket interpreted the resulting nonsense as a course deviation. It self-destructed.

The **[ESA Inquiry Board's Recommendation R5](https://www.esa.int/Newsroom/Press_Releases/Ariane_501_-_Presentation_of_Inquiry_Board_report)** captured the design lesson in one sentence:

> *"Review all flight software (including embedded software), and in particular: Identify all implicit assumptions made by the code and its justification documents on the values of quantities provided by the equipment. Check these assumptions against the restrictions on use of the equipment."*

### Design Principle 5: Identify Violated Assumptions

Software that worked in one context might not work in another. Internal reuse therefore demands that you:

1. **Read documentation and code to identify the assumptions** a reuse candidate makes — explicit and implicit.
2. **Check that the module was designed to operate reliably under the conditions you want.** Different load, different inputs, different timing, different precision.
3. **Don't *assume* the candidate is correct — *test* it** in your new context.

NASA's empirical approach is a striking illustration: integration and system-level testing of spacecraft software is extremely hard to reproduce on Earth, so NASA has long preferred to reuse **flight-heritage software** — code that has already flown successfully on a prior mission, whose assumptions have been validated by the harshest real-world testing available.

### The Cost-Benefit Scale for Internal Reuse

| Adaptation cost                                | Reuse benefit                            |
|------------------------------------------------|------------------------------------------|
| Identifying implicit assumptions               | Implementation effort                    |
| Effort to create / identify reusable modules   | Testing effort                           |
| Ongoing compatibility checks                   | Free update propagation                  |

## A Special Case: Libraries vs. Frameworks

A particularly important reuse decision is *what kind of thing* you are reusing. Libraries and frameworks look superficially similar — both bundle reusable code — but the **direction of control** differs:

<div class="uml-class-diagram-container" data-uml-type="class" data-uml-spec='@startuml
layout portrait
class YourCodeLib <<your code>> as "Your Code (with library)"
class Library <<library>>
class Framework <<framework>>
class YourCodeFw <<your code>> as "Your Code (with framework)"

YourCodeLib --> Library : calls
Framework --> YourCodeFw : calls (callbacks)

note right of YourCodeLib
  Library: your code is in charge.
  You call library functions when you want.
end note

note right of Framework
  Framework: the framework is in charge.
  You provide callbacks; it decides when to call them.
  "Inversion of Control" / Hollywood Principle.
end note
@enduml'></div>

* **Library** — your code makes **direct calls** to the library's API. You decide when. *Example:* Axios (HTTP requests) — `const response = await axios.get('/user?ID=12345');`
* **Framework** — the framework calls **your code**, through callbacks or lifecycle hooks. The framework decides when. *Example:* Express — `app.get('/', (req, res) => { res.send('Hello World!'); });`

This pattern is called the **Hollywood Principle**, or **Inversion of Control**: *"Don't call us, we'll call you."*

Why it matters for reuse: a framework **makes more decisions for you** and gives you **less flexibility**, but in exchange it **hides a lot of complexity** so you write less code. The trade-off: decisions to use a framework are **harder to reverse later**, because the framework shapes the structure of your whole application. Choosing Express, React, Spring, or Rails is closer to a marriage than a date.

## Making Design Decisions Well

The lecture closes with a broader point: reuse decisions are *one kind* of design decision, and the same general design-thinking habits apply.

### Habit 1: Think of Many Design Alternatives

In a classic study, researchers asked three teams to design the same system *(Petre, 2009)*:

* Team A produced **one** detailed design.
* Team B produced **three** options.
* Team C produced **five** options.

When experts ranked the designs, Team C's selected design was the best, Team B's was second, and Team A's was last. The point isn't "more options always wins." The point is that *generating alternatives broadens the search space*, and broad search produces better solutions than the first idea you had.

In follow-up work, *Tofan et al. (2013)* found that simply prompting designers to **consider other alternatives** caused less-experienced designers to produce noticeably better designs.

Practical rule: when you have a "good" design, **try to think of a better one** — and a *different* one. The purpose of idea generation is to *broaden up*; you narrow down later in evaluation.

### Habit 2: Delay Decisions That Need More Information

Not every design decision has to be made today. If a decision is likely to change or depends on information you don't yet have:

* Design the system so it does **not** assume a solution for that decision.
* **Keep a list** of delayed decisions and what you need to resolve them.

This keeps your design flexible at exactly the points where it most needs to be flexible.

### Habit 3: Solve Simpler Problems First (Divide and Conquer)

When faced with *"design an interplanetary messaging system for people on Earth and Mars to communicate"*, an expert does not draw a Mars-aware design on the first pass. They solve **messaging on Earth** first, then extend the result to deal with networking over interplanetary distances and different definitions of a day.

Caveat: be aware when the simpler problem is **so fundamentally different** that the solution does not generalize. Sometimes the easy version misleads you.

### Habit 4: Use a Rational Decision Process

*Tang, Aleti, Burge, and van Vliet (2008)* found that an explicit, four-step decision process produces measurably better designs — especially for early-career engineers:

1. **Identify your requirements.** What matters?
2. **Think of many design alternatives.**
3. **Evaluate** how well each alternative meets the requirements.
4. **Consider the trade-offs and make a decision.**

This sounds obvious, and it is. But the research shows that simply *writing it down* leads to better outcomes than relying on intuition alone.

### Habit 5: Document Decisions with a Design Doc

At Google, Amazon, Microsoft, Kubernetes, Shopify, and many other organizations, developers write a short **Design Doc** before implementing a non-trivial system. The goals (per [Malte Ubl's industry empathy post](https://www.industrialempathy.com/posts/design-docs-at-google/)):

* **Early identification of design issues**, when changes are still cheap.
* **Consensus** around a design within the organization.
* **Knowledge transfer** from senior engineers into the wider team.
* **Organizational memory** of why each decision was made.

A typical Design Doc has four parts:

| Section            | What it answers                                                                       |
|--------------------|----------------------------------------------------------------------------------------|
| **Context & Scope** | Background facts the reader needs to understand the document                          |
| **Goals & Non-Goals** | Requirements and quality attributes; what is explicitly *out of scope*               |
| **The Design**     | Models and design descriptions — context diagram, data model, API, pseudo-code, constraints |
| **Alternatives**   | Other designs considered, their trade-offs, and why this one was chosen                |

> *"As software engineers our job is not to produce code per se, but rather to solve problems. Unstructured text … may be the better tool for solving problems early in a project lifecycle."* — Malte Ubl

## Summary

* **Reuse** = building new software by composing existing modules. The vision is a McIlroy-style component catalog; the reality is glue code over partial mismatches.
* **Why reuse:** higher productivity and higher quality, because reused code has been tried and tested by others.
* **Two kinds, two strategies:** *internal* reuse (your team's code) vs. *external* reuse (third-party code).
* **External reuse principles:**
  1. **Pin versions** of your dependencies (lock files, Pipenv, etc.).
  2. **Update regularly** for security and bug fixes — but expect API-breaking changes.
  3. **Strive for fewer dependencies** — every one is a risk (left-pad, eslint-scope).
  4. Prefer **well-maintained, popular** modules — but **fit to your context** beats popularity.
* **Internal reuse principle:** *Identify violated assumptions.* Ariane 5 reused Ariane 4's flight software without re-checking a 16-bit integer assumption — and destroyed a $370M rocket in 37 seconds.
* **Libraries vs. Frameworks:** frameworks invert control (Hollywood Principle) and are harder to walk away from.
* **General design decisions:**
  * Generate many alternatives; broad search beats first-idea fixation.
  * Delay decisions that need more information.
  * Solve simpler problems first.
  * Use a rational, four-step decision process.
  * Document decisions in a Design Doc.

## Further Reading

* M. Douglas McIlroy. *"[Mass Produced Software Components](https://www.cs.dartmouth.edu/~doug/components.txt)"*. NATO Software Engineering Conference, 1968.
* David Garlan, Robert Allen, John Ockerbloom. *"[Architectural Mismatch: Why Reuse Is Still So Hard](https://ieeexplore.ieee.org/document/5235971)"*. IEEE Software, 2009 (retrospective on the 1995 original).
* José L. Barros-Justo et al. *"What software reuse benefits have been transferred to the industry? A systematic mapping study"*. Information and Software Technology, vol. 103, 2018.
* ESA. *"[Ariane 501 — Presentation of Inquiry Board Report](https://www.esa.int/Newsroom/Press_Releases/Ariane_501_-_Presentation_of_Inquiry_Board_report)"*. 1996.
* David Haney. *"[NPM & left-pad: Have We Forgotten How To Program?](https://www.davidhaney.io/npm-left-pad-have-we-forgotten-how-to-program/)"* 2016.
* ESLint blog. *"[Postmortem for Malicious Package Publishes](https://eslint.org/blog/2018/07/postmortem-for-malicious-package-publishes/)"*. 2018.
* Marian Petre. *"Insights from Expert Software Design Practice"*. ESEC/FSE 2009.
* Antony Tang et al. *"Design Reasoning Improves Software Design Quality"*. QoSA 2008.
* Dan Tofan, Matthias Galster, Paris Avgeriou. *"Difficulty of Architectural Decisions — A Survey with Professional Architects"*. ECSA 2013.
* Xu, An, Thung, et al. *"Why reinventing the wheels? An empirical study on library reuse and re-implementation"*. Empirical Software Engineering, 2020.
* Malte Ubl. *"[Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/)"*. Industrial Empathy blog.

## Practice

If these feel hard, that's the point — effortful retrieval is exactly what builds durable understanding. Come back tomorrow for the spacing benefit.

### Reflection Questions

1. You're starting a new web app and considering adding a 15-line CSV-parsing helper from a tiny GitHub repo with 8 stars. Walk through the design-with-reuse principles. Take the dependency, or write it yourself?
2. Your team uses an internal library that was written three years ago for batch jobs. You want to reuse it in a new low-latency streaming service. Which of the five design principles applies most directly, and what concrete checks would you perform?
3. Express (a framework) and Axios (a library) both let you "reuse" HTTP behavior. Why is the decision to adopt Express usually harder to reverse than the decision to adopt Axios?
4. Re-read the Ariane 5 story. The 16-bit integer worked perfectly on Ariane 4 for years. Is this a *testing* failure, a *documentation* failure, a *reuse* failure, or all three? Defend your answer.
5. **Design a dependency-management policy** for a new five-person startup that ships a Node.js web service. Write the policy as 5–7 short rules. Each rule must cite one of the five design principles from this chapter, and the policy as a whole must resolve the tension between Principle 2 (update often) and Principle 3 (fewer dependencies).

### Knowledge Quiz

{% include quiz.html id="design_with_reuse" %}

### Retrieval Flashcards

{% include flashcards.html id="design_with_reuse" %}

*Pedagogical tip: For each flashcard, try to formulate the answer **out loud** before flipping. The act of generating the answer (the "generation effect") leaves a much stronger memory trace than reading does.*
