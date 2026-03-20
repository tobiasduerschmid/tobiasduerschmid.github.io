---
title: User Stories
layout: sebook
---

User stories are the most commonly used format to specify requirements in a light-weight, informal way (particulalry in Agile projects).
Each user story is a high-level description of a software feature written from the perspective of the end-user.

Unlike formal specifications, user stories are meant to be "negotiable"—they act as placeholders for a conversation between the technical team and the "business" side to ensure both parties understand the why behind a feature

# Format

User stories follow this format:

---
**As a** [user role], 

**I want** [to perform an action] 

**so that** [I can achieve a goal]

---

This structure makes the team to identify not just the "what", but also the "who" and — most importantly — the "why".

The main requirement of the user story is captured in the *I want* part. 
The *so that* part clarifies the goal the user wants to achieve. It does **not** add additional requirements or constraints to the described requirements. 

# Acceptance Criteria

While the story itself is informal, we make it actionable using *Acceptance Criteria*. They define the boundaries of the feature and act as a checklist to determine if a story is "done".
Acceptance criteria define the scope of a user story.

They follow this format:

---
**Given** [pre-condition / initial state]

**When** [action]

**Then** [post-condition / outcome]

---


# INVEST

To evaluate if a user story is well-written, we apply the INVEST criteria:

* **Independent**: Stories should not depend on each other so they can be implemented and released in any order.
* **Negotiable**: They capture the essence of a need without dictating specific design decisions (like which database to use).
* **Valuable**: The feature must deliver actual benefit to the user, not just the developer.
* **Estimable**: The scope must be clear enough for developers to predict the effort required.
* **Small**: A story should be a manageable chunk of work that isn't easily split into smaller, still-valuable pieces.
* **Testable**: It must be verifiable through its acceptance criteria.


We will not look at these criteria in more detail below.
## Independent

Independent is a property 

## Negotiable

A user story should only capture the essence of a user's need, leaving room for design decisions rather than dictating a specific technical implementation (see ["Requirements Vs. Design"](/SEBook/requirements#requirements-vs--design)).
A good story **captures the essence**, not the details {% cite Wake2003INVESTinGoodStories %}. 

**Violation Example:** "*As a student, I want the website to use HTTPS so that my data is safe*". This violates the principle because "HTTPS" is a specific design decision, meaning the user story has inappropriately left the space of requirements.

**How to Improve:** Focus on the underlying *need* rather than the technical execution. A better version would be: "*As a student, I want the website to keep data I send and receive confidential so that my privacy is ensured*".


The Bad Story: "As a user, I want my profile settings saved in a MongoDB database so that they load quickly the next time I log in."

The Design Decision: Specifying "MongoDB."

Why it's a problem: The user doesn't care where the data lives. The engineering team might realize that a relational SQL database or local browser caching is a much better fit for the rest of the application's architecture.

The Negotiable Fix: "As a user, I want the system to remember my profile settings so that I don't have to re-enter them every time I log in."


"If the development team solves this user's problem using a completely different technology or layout than I pictured in my head, is the user still happy?" If the answer is yes, your story is negotiable!

### How to Design Negotiable User Stories

Designing for negotiability requires a balance between providing enough context to be Estimatable while remaining open enough to be Negotiable.

* **Focus on the "Why":** Use "So that" clauses to clarify the underlying goal, which allows the team to negotiate the "How".

* **Use Open-Ended Questions:** When talking to potential users, ask context-free questions like "Tell me about how you’d like to search" rather than "Should we use a dropdown for search?".

* **Define Acceptance Criteria, Not Steps:** Use Confirmation to define the outcomes that must be true, rather than the specific UI clicks or database queries required.

* **Iterative Refinement:** Treat the story as a "slice" of functionality that can be reshaped as the team's understanding of the system evolves.


## Valuable

The Valuable criterion ensures that every "chunk of functionality" your team produces translates into meaningful impact for your stakeholders {% cite Wake2003INVESTinGoodStories %}.

Here are some examples of user stories that are not valuable:

### Developer-centric stories
The Bad Story: 
> **"As a developer, 
I want to rewrite the core authentication API in Rust 
so that I can use a more modern programming language."** 

This issue: This user story discusses a *developer need*, not a *user need*. So it is not *valuable*. 

Similar examples include:
> **"As a frontend engineer, 
I want to update all the third-party dependencies in the package.json file 
so that there are no deprecation warnings showing up in my local development console."** 

> **"As a system architect, 
I want to split the monolithic backend repository into three separate microservices
so that the codebase is structurally decoupled."** 

> **"As a database administrator, 
I want to normalize the user profile tables to the Third Normal Form (3NF) 
so that the database schema strictly follows academic normalization rules."** 

### Incomplete stories
The Bad Story: 
> **As a** smart home owner,
> **I want to** schedule my porch lights to turn on automatically at a specific time,
> **so that** I don't have to walk up to a dark house in the evening.
> **Given** I am logged into the smart home mobile app,
> **When** I set the porch light schedule to turn on at 6:00 PM,
> **Then** the porch lights will illuminate at exactly 6:00 PM every day.

On first glance, this user story looks valuable, but if you look closer at the acceptance criteria, you can see that they are missing a feature to turn off the lights. If lights are turned on forever, this costs unnecessary energy. To fix this, we have to *add an acceptance criterion* that specifies when the lights should turn off. 
For example:
> **Given** I am logged into the smart home mobile app,
> **When** I set the porch light schedule to turn off at 6:00 AM and the lights are illuminated,
> **Then** the porch lights will turn off at 6:00 AM.

Now this user story is valuable, and we can hand it to our development team.

## Estimable

Estimable stories are those for which a judgment can be made regarding their size, cost, or time to deliver. To achieve this, stories must be understood well enough and remain stable enough to put useful bounds on our guesses.
We also need to avoid ambiguity in the user story.  A user story that is too vague or too complex will be difficult to estimate.
For example: 


## Small

### The "Small" Criterion in Agile User Stories

**What it is and Why it Matters**
The "Small" criterion states that a user story should be appropriately sized so that it can be comfortably completed by the development team within a single iteration or sprint (typically 1 to 4 weeks). If a story is too large, it is often referred to as an "Epic" and must be broken down.

This criterion matters for several fundamental reasons:
* **Predictability and Estimation:** Large tasks are notoriously difficult to estimate accurately. The smaller the story, the higher the confidence the team has in their estimation of the effort required.
* **Risk Reduction:** If a massive user story spans an entire sprint (or spills over into multiple sprints), the team risks delivering zero value if they hit a roadblock. Smaller stories ensure a steady, continuous flow of delivered value.
* **Faster Feedback Loops:** Smaller stories get to a "Done" state faster, meaning they can be tested, reviewed by the product owner, and put in front of users much sooner to gather valuable feedback.

**How to Evaluate It**
To determine if a user story is small enough, ask:
1. **Can it be completed in one sprint?** If the answer is no, or "maybe, if everything goes perfectly," the story is too big.
2. **Does it contain complex compound conjunctions?** Words like *and*, *or*, and *but* in the story description (e.g., "I want to register *and* manage my profile *and* upload photos") often indicate that multiple stories are hiding inside one.
3. **Are there too many Acceptance Criteria?** If a story has a massive checklist of complex acceptance criteria spanning multiple different workflows, it is likely an Epic.

**How to Improve It**
If a story violates the Small criterion, the team must collaborate to split it into smaller, independently valuable pieces. Common ways to split stories include:
* **Splitting by Workflow Steps:** Instead of "As a user, I want to manage my online cart," split it into adding items, removing items, and applying promo codes.
* **Splitting by Happy/Sad Paths:** Build the "happy path" (successful transaction) as one story, and handle the error states (declined cards, expired sessions) in subsequent stories.
* **Splitting by Platform/Interface:** Do the web interface first, then the mobile interface.


## Testable


**What it is and Why it Matters**
The "Testable" criterion dictates that a user story must have clear, objective, and measurable conditions that allow the team to verify when the work is officially complete. If a story is not testable, it can never truly be considered "Done." 

This criterion matters for several crucial reasons:
* **Shared Understanding:** It forces the product owner and the development team to align on the exact expectations. It removes ambiguity and prevents the dreaded "that's not what I meant" conversation at the end of a sprint.
* **Proving Value:** A user story represents a slice of business value. If you cannot test the story, you cannot prove that it successfully delivers that value to the user.
* **Enabling Quality Assurance:** Testable stories allow QA engineers (and developers practicing Test-Driven Development) to write their test cases—whether manual or automated—before a single line of production code is written.

**How to Evaluate It**
To determine if a user story is testable, ask yourself the following questions:
1. **Can I write a definitive pass/fail test for this?** If the answer relies on someone's opinion or mood, it is not testable.
2. **Does the story contain "weasel words"?** Look out for subjective adjectives and adverbs like *fast, easy, intuitive, beautiful, modern, user-friendly, robust,* or *seamless*. These words are red flags that the story lacks objective boundaries.
3. **Are the Acceptance Criteria clear?** Does the story have defined boundaries that outline specific scenarios and edge cases?

**How to Improve It**
If you find a story that violates the Testable criterion, you can improve it by replacing subjective language with quantifiable metrics and concrete scenarios:
* **Quantify Adjectives:** Replace subjective terms with hard numbers. Change "loads fast" to "loads in under 2 seconds." Change "supports a lot of users" to "supports 10,000 concurrent users."
* **Use the Given/When/Then Format:** Borrow from Behavior-Driven Development (BDD) to write clear acceptance criteria. Establish the starting state (*Given*), the action taken (*When*), and the expected, observable outcome (*Then*).
* **Define "Intuitive" or "Easy":** If the goal is a "user-friendly" interface, make it testable by tying it to a metric, such as: "A new user can complete the checkout process in fewer than 3 clicks without relying on a help menu."

---

### Examples of Stories Violating ONLY the Testable Criterion

Below are two user stories that are not testable but still satisfy (most) other INVEST criteria.

**Example 1: The Subjective UI Requirement**
> *"As a marketing manager, I want the new campaign landing page to feature a **gorgeous and modern** design, so that it appeals to our younger demographic."*

* **Independent:** Yes. It doesn't inherently rely on other features being built first.
* **Negotiable:** Yes. The exact layout and tech used to build it are open to discussion.
* **Valuable:** Yes. A landing page to attract a younger demographic provides clear business value.
* **Estimable:** Yes. Generally, a frontend developer can estimate the effort to build a standard landing page.
* **Small:** Yes. Building a single landing page easily fits within a single sprint.
* **Why it violates Testable:** "Gorgeous," "modern," and "appeals to" are completely subjective. What one developer thinks is modern, the marketing manager might think is ugly. 
* **How to fix it:** Tie it to a specific, measurable design system or user-testing metric. *(e.g., "Acceptance Criteria: The design strictly adheres to the new V2 Brand Guidelines and passes a 5-second usability test with a 4/5 rating from a focus group of 18-24 year olds.")*

**Example 2: The Vague Performance Requirement**
> *"As a data analyst, I want the monthly sales report to generate **instantly**, so that my workflow isn't interrupted by loading screens."*

* **Independent:** Yes. Optimizing or building this report can be done independently.
* **Negotiable:** Yes. The team can negotiate *how* to achieve the speed (e.g., caching, database indexing, background processing).
* **Valuable:** Yes. Saving the analyst's time is a clear operational benefit.
* **Small:** Yes. It is a focused optimization on a single report.
* **Why it violates Testable:** "Instantly" is physically impossible in computing, and it is a highly subjective standard. Does instantly mean 0.1 seconds, or 1.5 seconds? Without a benchmark, a test script cannot verify if the feature passes or fails.
* **Estimable:** No. Without a clear definition of "instantly", the team cannot estimate the effort required to build the feature. Violations of testable are often also not estimable. In the example above, the Subjective UI was still estiable, because independent of the specific definition of "modern", the implementation effort would not change signifiantly, just the specific UI that would be chosen would change.
* **How to fix it:** Replace the subjective word with a quantifiable service level indicator. *(e.g., "Acceptance Criteria: Given the database contains 5 years of sales data, when the user requests the monthly sales report, then the data renders on screen in under 2.5 seconds at the 95th percentile.")*


**Example 3: The Subjective Audio Requirement**
> *"As a podcast listener, I want the app's default intro chime to play at a **pleasant volume**, so that it doesn't startle me when I open the app."*

* **Independent:** Yes. Adjusting the audio volume doesn't rely on other features.
* **Negotiable:** Yes. The exact decibel level or method of adjustment is open to discussion.
* **Valuable:** Yes. Improving user comfort directly enhances the user experience.
* **Estimable:** Yes. Changing a default audio volume variable or asset is a trivial, highly predictable task (e.g., a 1-point story). The developers know exactly *how* much effort is involved.
* **Small:** Yes. It will take a few minutes to implement.
* **Why it violates Testable:** "Pleasant volume" is entirely subjective. A volume that is pleasant in a quiet library will be inaudible on a noisy subway. Because there is no objective baseline, QA cannot definitively pass or fail the test. 
* **How to fix it:** *"Acceptance Criteria: The default intro chime must be normalized to -16 LUFS (Loudness Units relative to Full Scale)."*


## FAQ on INVEST

### How are Estimable and Testable different?

**Estimable** refers to the ability of developers to predict the size, cost, or time required to deliver a story. This attribute relies on the story being understood well enough and having a clear enough scope to put useful bounds on those guesses.

**Testable** means that a story can be verified through objective acceptance criteria. A story is considered testable if there is a definitive "Yes" or "No" answer to whether its objectives have been achieved.

In practice, these two are closely linked: if a story is not testable because it uses vague terms like "fast" or "high accuracy," it becomes nearly impossible to estimate the actual effort needed to satisfy it.
But that is not always the case.

Here are examples of user stories that isolate those specific violations of the INVEST criteria:

 **Violates Testable but not Estimable**
**User Story:** *"As a site administrator, I want the dashboard to feel **snappy** when I log in so that I don't get frustrated with the interface."*

*   **Why it violates Testable:** Terms like "snappy" or "fast" are subjective. Without a specific metric (e.g., "loads in under 2 seconds"), there is no objective "Yes" or "No" answer to determine if the story is done. 
*   **Why it is still Estimable:** A developer might still estimate this as a "small" task if they assume it just requires basic front-end optimization, even though they can't formally verify the "snappy" feel.

 **Violates Estimable but not Testable**
**User Story:** *"As a safety officer, I want the system to **automatically identify every pedestrian** in this complex, low-light video feed."*

*   **Why it violates Estimable:** This is a "research project". Because the technical implementation is unknown or highly innovative, developers cannot put useful bounds on the time or cost required to solve it.
*   **Why it is still Testable:** It is perfectly testable; you could poll 1,000 humans to verify if the software's identifications match reality. The outcome is clear, but the effort to reach it is not.
*   **What about Small?** This user story is not small. It is a very large feature that takes a long time to implement.


### How are Estimable and Small different?

While they are related, **Estimable** and **Small** focus on different dimensions of a user story's readiness for development.

### **Estimable: Predictability of Effort**
Estimable refers to the developers' ability to provide a reasonable judgment regarding the size, cost, or time required to deliver a story.
*   **Requirements**: For a story to be estimable, it must be understood well enough and be stable enough that developers can put "useful bounds" on their guesses. 
*   **Barriers**: A story may fail this criterion if developers lack domain knowledge, technical knowledge (requiring a "technical spike" to learn), or if the story is so large (an epic) that its complexity is hidden.
*   **Goal**: It ensures the Product Owner can prioritize stories by weighing their value against their cost.

### **Small: Manageability of Scope**
Small refers to the physical magnitude of the work. A story should be a manageable chunk that can be completed within a single iteration or sprint.
*   **Ideal Size**: Most teams prefer stories that represent between half a day and two weeks of work. 
*   **Splitting**: If a story is too big, it should be split into smaller, still-valuable "vertical slices" of functionality. However, a story shouldn't be so small (like a "bag of leaves") that it loses its meaningful context or value to the user.
*   **Goal**: Smaller stories provide more scheduling flexibility and help maintain momentum through continuous delivery.

### **Key Differences**
1.  **Nature of the Constraint**: **Small** is a constraint on **volume**, while **Estimable** is a constraint on **clarity**.
2.  **Accuracy vs. Size**: While smaller stories tend to get more accurate estimates, a story can be small but still unestimatable. For example, a "Research Project" or investigative spike might involve a very small amount of work (reading one document), but because the outcome is unknown, it remains impossible to estimate the time required to actually solve the problem.
3.  **Predictability vs. Flow**: Estimability is necessary for **planning** (knowing what fits in a release), while Smallness is necessary for **flow** (ensuring work moves through the system without bottlenecks).



### Should bug reports be user stories?
    
Mike Cohn explicitly advocates for this unified approach, stating that the best method is to consider each bug report its own story {% cite cohn2004user %}. If a bug is large and requires significant effort, it should be estimated, prioritized, and treated exactly like any other typical user story {% cite cohn2004user %}. However, treating every minor bug as an independent story can cause administrative bloat. For bugs that are small and quick to fix, Cohn suggests that teams combine them into one or more unified stories {% cite cohn2004user %}. On a physical task board, this is achieved by stapling several small bug cards together under a single "cover story card", allowing the collection to be estimated and scheduled as a single unit of work {% cite cohn2004user %}.

From the [Extreme Programming (XP)](/SEBook/process/xp) perspective, translating a bug report into a narrative user story addresses only the process layer; the technical reality is that a bug is a missing test. Kent Beck argues that problem reports must come with *test cases* demonstrating the problem in code {% cite beck2004XPExplained %}. 
When a developer encounters or is assigned a problem, their immediate action must be to write an automated unit or functional test that isolates the issue {% cite beck2004XPExplained %}. In this paradigm, a bug report is fundamentally an *executable specification*. Writing the story card is merely a placeholder; the true confirmation of the defect's existence—and its subsequent resolution—is proven by a test that fails, and then passes {% cite beck2004XPExplained %}. 


# Applicability
User stories are ideal for iterative, customer-centric projects where requirements might change frequently. 

# Limitations
User stories can struggle to capture non-functional requirements like performance, security, or reliability, and they are generally considered insufficient for safety-critical systems like spacecraft or medical devices

# Quiz


{% include flashcards.html id="user_stories" %}

{% include quiz.html id="user_stories" %}
