---
title: Modern Code Review
layout: sebook
---

# The Evolution of Code Review

To understand why modern software teams review code, we must first trace the history of the practice.

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


# The "Defect-Finding" Fallacy

If you walk into any software company today and ask a developer, "Why do you review code?", most of them will give you a very simple, straightforward answer: "To find bugs early".

It is a logical assumption. Software engineers write code, humans make mistakes, and therefore we need other humans to inspect that code to catch those mistakes before they reach the user. But in the modern software engineering landscape, this assumption is actually a profound misconception. To understand what teams are actually doing, we must dismantle what we call the **"Defect-Finding" Fallacy**.

## Expectations vs. Empirical Reality

Because MCR evolved directly from formal inspections, management and developers carried over the exact same expectations: they believed they were still primarily hunting for bugs. Extensive surveys reveal that "finding defects" remains the number one cited motivation for conducting code reviews.

However, when software engineering researchers mined the databases of review tools across Microsoft, Google, and open-source projects, they uncovered a stark contradiction: **only 14% to 25% of code review comments actually point out functional defects**. Furthermore, the bugs that *are* found are rarely deep architectural flaws; they are overwhelmingly minor, low-level logic errors.

If 75% to 85% of the time spent reviewing code isn't fixing bugs, what exactly are software engineers doing? Research has identified that modern code review has evolved into a highly collaborative, **socio-technical** communication network focused on three non-functional categories:

**1. Maintainability and Code Improvement**
Roughly **75% of the issues fixed during MCR are related to evolvability, readability, and maintainability**. Reviewers spend the bulk of their time suggesting better coding practices, removing dead code, enforcing team style guidelines, and asking the author to improve documentation.

**2. Knowledge Transfer and Mentorship**
Code review operates as a bidirectional educational tool. Junior developers learn best practices by having their code critiqued, while reviewers actively learn about new features and unfamiliar areas of the system by reading someone else's code.

**3. Shared Code Ownership and Team Awareness**
By requiring at least one other person to read and approve a change, teams ensure there are "backup developers" who understand the architecture. It acts as a forcing function to dilute rigid, individual ownership and binds the team together through a shared sense of collective responsibility.


# Cognitive Factors

Achieving any of the goals of MCR requires a reviewer to accomplish one monumental task: actually understanding the code they are reading. The human brain has strict biological limits regarding how much abstract logic it can hold in its working memory. When software teams ignore these limits, the code review process breaks down entirely.

## The Brain on Code: Letovsky and the CRCM

In 1987, Stanley Letovsky proposed a foundational model suggesting that programmers act as "knowledge-based understanders," using an *assimilation process* to combine raw code with their existing knowledge base to construct a mental model {% cite Letovsky1987 %}.

Recent studies extended this specifically for MCR, creating the *Code Review Comprehension Model (CRCM)* {% cite Goncalves2025 %}. A reviewer must simultaneously hold a mental model of the *existing* software system, the *proposed* changes, and the *ideal* solution. Because this comparative comprehension is incredibly taxing, reviewers use **opportunistic strategies** instead of reading top-to-bottom {% cite Goncalves2025 %}:

1. **Linear Reading:** Used mostly for very small changes (under 175 lines). The reviewer reads from the first changed file to the last.
2. **Difficulty-Based Reading:** Reviewers prioritize. Some use an *easy-first* approach (skimming and approving documentation/renames to reduce cognitive load), while others use a *core-based* approach (searching for the core change and tracing data flow outward).
3. **Chunking:** For massive PRs, reviewers break the code down into logical "chunks," reviewing commit-by-commit or looking exclusively at automated tests first to understand intent.

## The Quantitative Limits of Human Attention

Empirical studies across open-source projects and industry giants like Microsoft and Cisco have identified rigid numerical limits to human code comprehension {% cite Cohen2006 Bacchelli2013 Sadowski2018 %}.

### The 400-Line Rule

A reviewer's effectiveness drops precipitously once a pull request exceeds 200 to 400 lines of code (LOC) {% cite Cohen2006 Shah2026 %}. When hit with a massive PR (a "code bomb"), reviewers are overwhelmed. In a study of 212,687 PRs across 82 open-source projects, researchers found that 66% to 75% of all defects are detected within PRs that are between 200 and 400 LOC {% cite Mariotto2025 %}. Beyond this threshold, defect discovery plummets.

### The 60-Minute Clock

Review sessions should never exceed **60 to 90 minutes** {% cite Cohen2006 Blakely1991 %}. After roughly an hour of staring at a diff, the reviewer experiences *cognitive fatigue* and defect discovery drops to near zero {% cite Dunsmore2000 %}.

### The Speed Limit

Combining these limits dictates that developers should review code at a rate of **200 to 500 lines of code per hour** {% cite Cohen2006 %}. Reviewing faster than this causes the reviewer to miss architectural details {% cite Kemerer2009 %}.

## Divergent Perspectives: Is LOC the Only Metric?

Some researchers argue that measuring *Lines of Code* is too blunt. A 400-line change consisting entirely of a well-documented class interface requires very little effort to review compared to a 50-line patch altering a complex parallel-processing algorithm {% cite Cohen2006 %}. Additionally, a rigorous experiment by Baum et al. could not reliably conclude that the *order* in which code changes are presented to a reviewer influences review efficiency, challenging some cognitive load hypotheses.

## Engineering Around the Brain: Stacking

To build massive features without exceeding cognitive limits, high-performing teams utilize **Stacked Pull Requests**. Instead of submitting one monolithic feature, developers decompose the work into small, atomic, dependent units (e.g., *PR 1* for database tables, *PR 2* for API logic, *PR 3* for UI). This perfectly aligns with cognitive dynamics, keeping every PR under the 400-line limit and allowing reviewers to process them in optimal 30-to-60-minute sessions.


# Socio-Technical Factors

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


# The AI Paradigm Shift

For decades, the peer code review process served as the primary quality gate in software engineering. Built on the assumption that writing code is a slow, scarce, human endeavor, a reviewer could reasonably maintain cognitive focus over a colleague’s daily output. However, the advent of Large Language Models (LLMs) and autonomous AI coding agents has violently disrupted this assumption. We are entering an era where code is abundant, cheap, and generated at a velocity designed to outpace human reading limits. 

This chapter explores the third wave of code review evolution: the integration of generative AI. We will examine how AI transitions from a simple tool to an autonomous agent, the surprising empirical realities regarding its impact on productivity, the acute security risks it introduces, and why human accountability remains irreplaceable.

## From Static Analysis to Agentic Coding

The earliest forms of Automated Code Review (ACR) relied on rule-based static analysis tools (e.g., PMD, SonarQube). While effective at catching simple formatting errors, these tools were rigid, lacked contextual understanding, and generated high volumes of false positives. 

The introduction of LLMs has catalyzed a profound paradigm shift. Modern AI review tools evaluate code semantically rather than just syntactically. The literature categorizes this new era of AI assistance into two distinct workflows:
1.  **Vibe Coding:** An intuitive, prompt-based, conversational workflow where a human developer remains strictly in the loop, guiding the AI step-by-step through ideation and experimentation.
2.  **Agentic Coding:** A highly autonomous paradigm where AI agents (e.g., Claude Code, SWE-agent, GitHub Copilot) plan, execute, test, and iterate on complex tasks with minimal human intervention, automatically packaging their work into Pull Requests (PRs). 

Empirical evidence shows agentic tools are highly capable. In an industrial deployment at Atlassian, the *RovoDev Code Reviewer* analyzed over 1,900 repositories, automatically generating comments that led directly to code resolutions 38.7% of the time, while reducing the overall PR cycle time by 30.8% and decreasing human reviewer workload by 35.6%. Similarly, an analysis of 567 PRs generated autonomously by Claude Code across open-source projects revealed that 83.8% of these *Agentic-PRs* were ultimately accepted and merged by human maintainers, with nearly 55% merged as-is without any further modifications.

## Divergent Perspectives: The Productivity Paradox 

A dominant narrative in the software industry is that AI drastically accelerates development. However, rigorous empirical studies present a sharply **Divergent Perspective**, revealing a "productivity paradox" when dealing with complex, real-world systems. 

While AI excels at generating boilerplate and tests, reviewing and integrating AI code is proving to be a massive cognitive bottleneck. 
*   **The 19% Slowdown:** A 2025 randomized controlled trial (RCT) by METR evaluated experienced open-source developers working on real issues in their own repositories. Developers *forecasted* that using early-2025 frontier AI models (like Claude 3.7 Sonnet) would speed them up by 24%. The empirical reality? Developers using AI tools actually took **19% longer** to complete their tasks. 
*   **The Tech Debt Trap:** A separate 2025 study evaluating the adoption of the Cursor LLM agent found that while it caused a transient, short-term increase in development velocity, it simultaneously caused a significant, persistent increase in code complexity and static analysis warnings. Over time, this degradation in code quality acted as a major factor causing a long-term velocity slowdown.

Because agents frequently generate "over-mocked" tests or fail to grasp complex, project-specific invariants, human reviewers must expend significant mental effort debugging AI logic. Reviewing shifts from understanding a human peer's rationale to auditing a machine's probabilistic output. 

## The "Rubber Stamp" Risk and AI Hallucinations

As AI generates massive blocks of code, human reviewers are hit with unprecedented cognitive fatigue. This leads to the **Rubber Stamp Effect**: reviewers see a massive PR that passes automated linting and unit testing, assume it is valid, and grant an "LGTM" (Looks Good To Me) approval without actually reading the syntax. 

Rubber stamping AI code alters a project's risk profile because AI mistakes do not look like human mistakes. While human errors are often obvious logic gaps or syntax faults, LLMs hallucinate code that looks highly plausible and authoritative but is functionally incorrect or deeply insecure. 

## Security Vulnerabilities in AI-Generated Code
Extensive literature reviews confirm that LLMs frequently introduce critical security vulnerabilities.
*   **"Stupid Bugs" and Memory Leaks:** LLMs are prone to generating naive single-line mistakes. They frequently mishandle memory, leading to null pointer dereferences (CWE-476), buffer overflows, and use-after-free vulnerabilities.
*   **Data Poisoning:** Because LLMs are trained on unverified public repositories (e.g., GitHub), they can internalize insecure patterns. Threat actors can execute *data poisoning attacks* by injecting malicious code snippets into training data, causing the LLM to autonomously suggest insecure encryption protocols or backdoored logic to developers.
*   **Self-Repair Blind Spots:** While advanced LLMs can sometimes fix up to 60% of insecure code written by *other* models, they exhibit "self-repair blind spots" and perform poorly when asked to detect and fix vulnerabilities in their own generated code.

## The Social Disruption: Emotion and Accountability

The integration of AI disrupts the *socio-technical fabric* of code review. Code review is not just a technical gate; it is a space for mentorship, shared accountability, and social validation. 

**The Loss of Reciprocity:** Accountability is a social contract. One cannot hold an LLM socially or morally accountable. When an LLM reviews code, the shared team accountability transitions strictly back to the individual developer. As one developer noted, *"You cannot blame or hold the LLM accountable"*. 

**Emotional Neutrality vs. Meaningfulness:** AI drastically reduces the emotional taxation of code reviews. LLM feedback is consistently polite, objective, and neutral, which eliminates the defensive responses or "bikeshedding" conflict that occurs between humans. However, this emotional sterilization comes at a cost. Developers derive psychological meaningfulness, "joy," and professional validation from having respected peers validate their code. Replacing peers with a "faceless chat box" strips the software engineering role of its relational warmth and identity-affirming properties. 

## The Future: From Syntax-Checking to Outcome-Verification

To safely harness AI without succumbing to the Rubber Stamp effect, the software engineering paradigm must evolve. 

1.  **The Human-in-the-Loop Imperative:** The consensus across modern literature is that AI should be implemented as an *AI-primed* co-reviewer rather than a replacement. AI should handle the first-pass triage—formatting, basic bug detection, and linting—while human engineers retain authority over architectural context, business logic, and security validation.
2.  **The Shift to Preview Environments:** Because reading thousands of lines of AI-generated syntax is biologically impossible for a human reviewer to do accurately, the artifact of review must change. We are shifting from a *syntax-first* culture to an *outcome-first* culture. Reviewing AI-authored code requires spinning up ephemeral, isolated "backend preview environments" where reviewers can actively execute and validate the behavior of the code, rather than passively reading text files. As the industry moves forward, the new standard becomes: *"If you cannot preview it, you cannot ship it"*.
