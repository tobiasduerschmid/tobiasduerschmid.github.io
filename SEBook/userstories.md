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


"*As a student, I want direct integration with Piazza, Gradescope, Google Drive, and Zoom so that I do not need to open them in separate pages. 
Given the student is logged in, when the student uses the Piazza, Gradescope, Google Drive, or Zoom integration, then the linked services do not require separate authentication, and data is transferred automatically from/to BruinLearn, and no privacy violations (as defined in the federal law “FERPA”) occur in the external apps.*"

The user story contains multiple, separate features (Piazza, Gradescope, Google Drive, and Zoom) that can be broken into separate user stories that are each valuable on their own.


"As a registered shopper, I want to add items to my cart, enter my shipping address, provide credit card details, and receive a confirmation email with a tracking number so that I can complete my purchase in one go."




## Testable


"As a site administrator, I want the dashboard to load 'fast' and feel 'snappy' when I log in so that I don't get frustrated with the interface."

## FAQ on INVEST

### How are Estimable and Testable different?


### How are Estimable and Small different?

### Should bug reports be user stories?
    
Mike Cohn explicitly advocates for this unified approach, stating that the best method is to consider each bug report its own story {% cite cohn2004user %}. If a bug is large and requires significant effort, it should be estimated, prioritized, and treated exactly like any other typical user story {% cite cohn2004user %}. However, treating every minor bug as an independent story can cause administrative bloat. For bugs that are small and quick to fix, Cohn suggests that teams combine them into one or more unified stories {% cite cohn2004user %}. On a physical task board, this is achieved by stapling several small bug cards together under a single "cover story card", allowing the collection to be estimated and scheduled as a single unit of work {% cite cohn2004user %}.

From the [Extreme Programming (XP)](/SEBook/process/xp) perspective, translating a bug report into a narrative user story addresses only the process layer; the technical reality is that a bug is a missing test. Kent Beck argues that problem reports must come with *test cases* demonstrating the problem in code {% cite beck2004XPExplained %}. 
When a developer encounters or is assigned a problem, their immediate action must be to write an automated unit or functional test that isolates the issue {% cite beck2004XPExplained %}. In this paradigm, a bug report is fundamentally an *executable specification*. Writing the story card is merely a placeholder; the true confirmation of the defect's existence—and its subsequent resolution—is proven by a test that fails, and then passes {% cite beck2004XPExplained %}. 



# Applicability
User stories are ideal for iterative, customer-centric projects where requirements might change frequently. 

# Limitations
User stories can struggle to capture non-functional requirements like performance, security, or reliability, and they are generally considered insufficient for safety-critical systems like spacecraft or medical devices