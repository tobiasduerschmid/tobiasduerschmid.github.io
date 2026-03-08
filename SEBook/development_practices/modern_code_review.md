---
title: Modern Code Review
layout: sebook
---


# The Evolution and the "Defect-Finding" Fallacy

If you walk into any software company today and ask a developer, "Why do you review code?", most of them will give you a very simple, straightforward answer: "To find bugs early".

It is a logical assumption. Software engineers write code, humans make mistakes, and therefore we need other humans to inspect that code to catch those mistakes before they reach the user. But in the modern software engineering landscape, this assumption is actually a profound misconception. To understand why modern software teams review code, we must first trace the history of the practice and dismantle what we call the **"Defect-Finding" Fallacy**.

## The First Wave: The Era of Formal Inspections

Code review was not always the seamless, online, asynchronous process it is today. In 1976, IBM researcher Michael Fagan formalized a rigorous, highly structured process known as *Fagan inspections* or *Formal Inspections*.

During the 1970s and 1980s, testing software was incredibly expensive. To prevent bugs from making it to production, Fagan devised a methodology that operated much like a formal court proceeding. A typical formal inspection required printing out physical copies of the source code and gathering three to six developers in a conference room. Participants were assigned strict, defined roles:

* The **Moderator** managed the meeting and controlled the pace.
* The **Reader** narrated the code line-by-line, explaining the logic so the original author could hear their own code interpreted by a third party.
* The **Reviewers** meticulously checked the logic against predefined checklists.

This method was highly effective for its primary goal: early defect detection. Studies showed that these rigorous inspections could catch a massive percentage of software flaws. However, formal inspections had a fatal flaw: they were **excruciatingly slow**. One study noted that up to 20% of the entire development interval was wasted simply trying to schedule these inspection meetings. As the software industry shifted toward agile development, continuous integration, and globally distributed teams, gathering five engineers in a room to read paper printouts became impossible to scale.

## The Paradigm Shift: The Rise of Modern Code Review (MCR)

To adapt to the need for speed, the software industry abandoned the conference room and moved code review to the web. This marked the birth of *Modern Code Review (MCR)*.

Modern Code Review is fundamentally different from formal inspections. It is defined by three core characteristics: it is **informal**, it is **tool-based**, and it is **asynchronous**. Instead of scheduling a meeting, a developer today finishes a unit of work and submits a *pull request* (or patch) to a code review tool like GitHub, Gerrit, or Microsoft's CodeFlow. Reviewers are notified via email or a messaging app, and they examine the *diff* (the specific lines of code that were added or deleted) on their own time, leaving comments directly in the margins of the code.

## The "Defect-Finding" Fallacy vs. Empirical Reality

Because MCR evolved directly from formal inspections, management and developers carried over the exact same expectations: they believed they were still primarily hunting for bugs. Extensive surveys reveal that "finding defects" remains the number one cited motivation for conducting code reviews.

However, when software engineering researchers mined the databases of review tools across Microsoft, Google, and open-source projects, they uncovered a stark contradiction: **only 14% to 25% of code review comments actually point out functional defects**. Furthermore, the bugs that *are* found are rarely deep architectural flaws; they are overwhelmingly minor, low-level logic errors.

If 75% to 85% of the time spent reviewing code isn't fixing bugs, what exactly are software engineers doing? Research has identified that modern code review has evolved into a highly collaborative, **socio-technical** communication network focused on three non-functional categories:

**1. Maintainability and Code Improvement**
Roughly **75% of the issues fixed during MCR are related to evolvability, readability, and maintainability**. Reviewers spend the bulk of their time suggesting better coding practices, removing dead code, enforcing team style guidelines, and asking the author to improve documentation.

**2. Knowledge Transfer and Mentorship**
Code review operates as a bidirectional educational tool. Junior developers learn best practices by having their code critiqued, while reviewers actively learn about new features and unfamiliar areas of the system by reading someone else's code.

**3. Shared Code Ownership and Team Awareness**
By requiring at least one other person to read and approve a change, teams ensure there are "backup developers" who understand the architecture. It acts as a forcing function to dilute rigid, individual ownership and binds the team together through a shared sense of collective responsibility.

---

# Cognitive Dynamics: Comprehension, Load, and the 400-Line Rule

Achieving any of the goals of MCR requires a reviewer to accomplish one monumental task: actually understanding the code they are reading. The human brain has strict biological limits regarding how much abstract logic it can hold in its working memory. When software teams ignore these limits, the code review process breaks down entirely.

## The Brain on Code: Letovsky and the CRCM

In 1987, Stanley Letovsky proposed a foundational model suggesting that programmers act as "knowledge-based understanders," using an *assimilation process* to combine raw code with their existing knowledge base to construct a mental model.

Recent studies extended this specifically for MCR, creating the *Code Review Comprehension Model (CRCM)*. A reviewer must simultaneously hold a mental model of the *existing* software system, the *proposed* changes, and the *ideal* solution. Because this comparative comprehension is incredibly taxing, reviewers use **opportunistic strategies** instead of reading top-to-bottom:

1. **Linear Reading:** Used mostly for very small changes (under 175 lines). The reviewer reads from the first changed file to the last.
2. **Difficulty-Based Reading:** Reviewers prioritize. Some use an *easy-first* approach (skimming and approving documentation/renames to reduce cognitive load), while others use a *core-based* approach (searching for the core change and tracing data flow outward).
3. **Chunking:** For massive PRs, reviewers break the code down into logical "chunks," reviewing commit-by-commit or looking exclusively at automated tests first to understand intent.

## The Quantitative Limits of Human Attention

Empirical studies across open-source projects and industry giants like Microsoft and Cisco have identified rigid numerical limits to human code comprehension.

### The 400-Line Rule

A reviewer's effectiveness drops precipitously once a pull request exceeds 200 to 400 lines of code (LOC). When hit with a massive PR (a "code bomb"), reviewers are overwhelmed. In a study of over 212,000 PRs, researchers found that 66% to 75% of all defects are detected within PRs that are between 200 and 400 LOC. Beyond this threshold, defect discovery plummets.

### The 60-Minute Clock

Review sessions should never exceed **60 to 90 minutes**. After roughly an hour of staring at a diff, the reviewer experiences *cognitive fatigue* and defect discovery drops to near zero.

### The Speed Limit

Combining these limits dictates that developers should review code at a rate of **200 to 500 lines of code per hour**. Reviewing faster than this causes the reviewer to miss architectural details.

## Divergent Perspectives: Is LOC the Only Metric?

Some researchers argue that measuring *Lines of Code* is too blunt. A 400-line change consisting entirely of a well-documented class interface requires very little effort to review compared to a 50-line patch altering a complex parallel-processing algorithm. Additionally, a rigorous experiment by Baum et al. could not reliably conclude that the *order* in which code changes are presented to a reviewer influences review efficiency, challenging some cognitive load hypotheses.

## Engineering Around the Brain: Stacking

To build massive features without exceeding cognitive limits, high-performing teams utilize **Stacked Pull Requests**. Instead of submitting one monolithic feature, developers decompose the work into small, atomic, dependent units (e.g., *PR 1* for database tables, *PR 2* for API logic, *PR 3* for UI). This perfectly aligns with cognitive dynamics, keeping every PR under the 400-line limit and allowing reviewers to process them in optimal 30-to-60-minute sessions.

---

# The Socio-Technical Fabric: Accountability, Emotion, and Conflict

Because software is a virtual product, critiquing code is a direct evaluation of a developer's thought process, making it an inherently social and emotional event.

## The Accountability Shift: From "Me" to "We"

The simple existence of a code review policy alters behavior through the **"Ego Effect"**. Knowing peers will scrutinize their work acts as an intrinsic motivator, driven by personal standards, professional integrity, pride, and reputation maintenance.

During the review itself, accountability shifts from the *individual* to the *collective*. Once a reviewer approves a change, they become equally responsible for it, shifting the language from "my code" to "our system."

## The Emotional Rollercoaster: Coping with Critique

Receiving critical feedback triggers strong emotional responses. Developers must engage in *emotional self-regulation* using several coping strategies:

* **Reframing:** Reinterpreting the intent of the feedback and decoupling personal identity from the code ("This isn't an attack; it's just a mistake").
* **Dialogic Regulation:** Initiating direct, offline conversations to clarify intent and shift back to shared problem-solving.
* **Defensiveness:** Advocating for the original code to self-protect, which carries a high risk of escalating conflict.
* **Avoidance:** Deliberately choosing not to invite overly "picky" reviewers to limit exposure to stress.

## Conflict and the "Bikeshedding" Anti-Pattern

**Bikeshedding** (nitpicking) occurs when reviewers obsess over trivial, subjective details like formatting while overlooking serious flaws. High-performing teams actively suppress this by implementing automated *linters* and static analysis tools to enforce style guidelines automatically, preferring to be "reprimanded by a robot."

Tone is frequently lost in text-based communication; over 66% of non-technical emails in certain open-source projects contained uncivil features. To counteract this, modern teams explicitly train for communication, using questioning over dictating, and occasionally adopting an "Emoji Code" to convey friendly intent.

## Bias and the Limits of Anonymity

The socio-technical fabric is susceptible to human biases regarding race, gender, and seniority. For example, when women use gender-identifiable names and profile pictures on open-source platforms like GitHub, their pull request acceptance rates drop compared to peers with gender-neutral profiles.

To combat this, organizations have experimented with *Anonymous Author Code Review*. A large-scale field experiment at Google tested this by building a browser extension that hid the author's identity and avatar inside their internal tool. Across more than 5,000 code reviews, reviewers correctly guessed the author's identity in 77% of non-readability reviews. They used contextual clues—such as specific ownership boundaries, programming style, or prior offline conversations—to deduce who wrote the code. While anonymization did not slow down review speed and reduced the focus on power dynamics, "guessability" proved to be an unavoidable reality of highly collaborative engineering.

---

# Code Review at Google

Imagine a software company where more than 25,000 developers submit over 20,000 source code changes every workday into a single monolithic repository (or *monorepo*). To maintain order, Google enforces a mandatory, highly optimized code review process revolving around four key pillars: education, maintaining norms, gatekeeping, and accident prevention.

## The Twin Pillars: Ownership and Readability

Google enforces two highly unique concepts dictating *who* is allowed to approve code:

**1. Ownership (Gatekeeping)**
Every directory in Google's codebase has explicit "owners." While anyone can propose a change, it cannot be merged unless an official owner of that specific directory reviews and approves it.

**2. Readability (Maintaining Norms)**
Google has strict, mandatory coding styles for every language. "Readability" is an internal certification developers earn by consistently submitting high-quality code. If an author lacks Readability certification for a specific language, their code *must* be approved by a reviewer who has it.

## The Tool and the Workflow: Enter "Critique"

Google manages this volume using an internal centralized web tool called **Critique**. The lifecycle of a proposed change (a *Changelist* or *CL*) is highly structured:

1. **Creating and Previewing:** Critique automatically runs the code through *Tricorder*, which executes over 110 automated static analyzers to catch formatting errors and run tests before a human ever sees it.
2. **Mailing it Out:** The author selects reviewers, aided by a recommendation algorithm.
3. **Commenting:** Reviewers leave threaded comments, distinguishing between *unresolved comments* (mandatory fixes) and *resolved comments* (optional tips).
4. **Addressing Feedback:** The author makes fixes and uploads a new snapshot for easy comparison.
5. **LGTM:** Once all comments are addressed and Ownership/Readability requirements are met, the reviewer marks the change with **LGTM** (Looks Good To Me).

## The Statistics: Small, Fast, and Focused

Despite strict rules, Google's empirical data shows a remarkably fast process:

* **Size Matters:** Over 35% of all CLs modify only a single file, and 10% modify just a *single line of code*. The median size is merely 24 lines.
* **The Power of One:** More than 75% of code changes at Google have only one single reviewer.
* **Blink-and-You-Miss-It Speed:** The median wait time for initial feedback is under an hour, and the median time to get a change completely approved is under 4 hours. Over 80% of all changes require at most one iteration of back-and-forth before approval.
