---
title: User Stories
layout: sebook
---

User stories are the ==most commonly used format to specify requirements in a light-weight, informal way== (particulalry in Agile projects).
Each user story is a high-level description of a software feature written from the perspective of the end-user.

User stories act as placeholders for a conversation between the technical team and the "business" side to ensure both parties understand the why and what of a feature.

# Format

User stories follow this format:

---
**==As a==** [user role], 

**==I want==** [to perform an action] 

**==so that==** [I can achieve a goal]

---

For example:

> (*Smart Grocery Application*):  **As a** home cook, **I want to** swap out ingredients in a recipe **so that** I can accommodate my dietary restrictions and utilize what I already have in my kitchen.

> (*Travel Itinerary Planner*):  **As a** frequent traveler, **I want to** discover unique, locally hosted activities **so that** I can experience the authentic culture of my destination rather than just the standard tourist traps.

This structure makes the team to identify not just the "what", but also the "who" and — most importantly — the "why".

The main requirement of the user story is captured in the *I want* part.
The *so that* part clarifies the goal the user wants to achieve. It does **not** add additional requirements or constraints to the described requirements.

**Be specific about the actor.** Avoid generic labels like "user" in the *As a* clause. Instead, name the specific role that benefits from the feature (e.g., "job seeker", "hiring manager", "store owner"). A precise actor clarifies *who* needs the feature and *why*, helps the team understand the context, and prevents stories from becoming vague catch-alls. If you find yourself writing "**As a** user," ask: *which* user?

# Acceptance Criteria

While the story itself is informal, we make it actionable using *Acceptance Criteria*. They define the boundaries of the feature and act as a checklist to determine if a story is "done".
Acceptance criteria define the scope of a user story.

They follow this format:

---
**==Given==** [pre-condition / initial state]

**==When==** [action]

**==Then==** [post-condition / outcome]

---

For example:

> (*Smart Grocery Application*):  **As a** home cook, **I want to** swap out ingredients in a recipe **so that** I can accommodate my dietary restrictions and utilize what I already have in my kitchen.
> * **Given** the user is viewing a recipe's ingredient list, **when** they tap on a specific ingredient, **then** a modal should appear suggesting a list of viable alternatives.
> * **Given** the user selects a substitute from the alternatives list, **when** they confirm the swap, **then** the recipe's required quantities and nutritional estimates should recalculate and update on the screen.
> * **Given** the user has modified a recipe with substitutions, **when** they tap the "Save to My Cookbook" button, **then** the customized version of the recipe should be stored in their personal profile without altering the original public recipe.

These acceptance criteria add clarity to the user story by defining the specific conditions under which the feature should work as expected. They also help to identify potential edge cases and constraints that need to be considered during development. The acceptance criteria define the scope of conditions that check whether an implementation is "correct" and meets the user's needs. So naturally, ==acceptance criteria must be specific enough to be testable but should not be overly prescriptive about the implementation details, not to constraint the developers more than really needed to describe the true user need==.

Here is another example:

> (*Travel Itinerary Planner*):  **As a** frequent traveler, **I want to** discover unique, locally hosted activities **so that** I can experience the authentic culture of my destination rather than just the standard tourist traps.
> * **Given** the user has set their upcoming trip destination to a city, **when** they navigate to the "Local Experiences" tab, **then** they should see a dynamically populated list of activities hosted by verified local residents.
> * **Given** the user is browsing the experiences list, **when** they apply the "Under $50" budget filter, **then** the list should refresh to display only the activities that fall within that price range.
> * **Given** the user selects a specific local experience, **when** they tap "Check Availability", **then** a calendar widget should expand displaying open booking slots for their specific travel dates.

# INVEST

To evaluate if a user story is well-written, we apply the INVEST criteria:

* **Independent**: Stories should not depend on each other so they can be implemented and released in any order.
* **Negotiable**: They capture the essence of a need without dictating specific design decisions (like which database to use).
* **Valuable**: The feature must deliver actual benefit to the user, not just the developer.
* **Estimable**: The scope must be clear enough for developers to predict the effort required.
* **Small**: A story should be a manageable chunk of work that isn't easily split into smaller, still-valuable pieces.
* **Testable**: It must be verifiable through its acceptance criteria.


We will now look at these criteria in more detail below.
## Independent

*An **independent** story does not overlap with or depend on other stories—it can be scheduled and implemented in any order.*

**What it is and Why it Matters**
The "Independent" criterion states that user stories should not overlap in concept and should be schedulable and implementable in any order {% cite Wake2003INVESTinGoodStories %}. An independent story can be understood, tracked, implemented, and tested on its own, without requiring other stories to be completed first.

This criterion matters for several fundamental reasons:
* **Flexible Prioritization:** Independent stories allow the business to prioritize the backlog based strictly on value, rather than being constrained by technical dependencies {% cite Wake2003INVESTinGoodStories %}. Without independence, a high-priority story might be blocked by a low-priority one.
* **Accurate Estimation:** When stories overlap or depend on each other, their estimates become entangled. For example, if paying by Visa and paying by MasterCard are separate stories, the first one implemented bears the infrastructure cost, making the second one much cheaper {% cite cohn2004user %}. This skews estimates.
* **Reduced Confusion:** By avoiding overlap, independent stories reduce places where descriptions contradict each other and make it easier to verify that all needed functionality has been described {% cite Wake2003INVESTinGoodStories %}.

**How to Evaluate It**
To determine if a user story is independent, ask:
1. **Does this story overlap with another story?** If two stories share underlying capabilities (e.g., both involve "sending a message"), they have overlap dependency—the most painful form {% cite Wake2003INVESTinGoodStories %}.
2. **Must this story be implemented before or after another?** If so, there is an order dependency. While less harmful than overlap (the business often naturally schedules these correctly), it still constrains planning {% cite Wake2003INVESTinGoodStories %}.
3. **Was this story split along technical boundaries?** If one story covers the UI layer and another covers the database layer for the same feature, they are interdependent and neither delivers value alone {% cite cohn2004user %}.

**How to Improve It**
If stories violate the Independent criterion, you can improve them using these techniques:
* **Combine Interdependent Stories:** If two stories are too entangled to estimate separately, merge them into a single story. For example, instead of separate stories for Visa, MasterCard, and American Express payments, combine them: "A company can pay for a job posting with a credit card" {% cite cohn2004user %}.
* **Partition Along Different Dimensions:** If combining makes the story too large, re-split along a different dimension. For overlapping email stories like "Team member sends and receives messages" and "Team member sends and replies to messages", repartition by action: "Team member sends message", "Team member receives message", "Team member replies to message" {% cite Wake2003INVESTinGoodStories %}.
* **Slice Vertically:** When stories have been split along technical layers (UI vs. database), re-slice them as vertical "slices of cake" that cut through all layers. Instead of "Job Seeker fills out a resume form" and "Resume data is written to the database", write "Job Seeker can submit a resume with basic information" {% cite cohn2004user %}.

### Examples of Stories Violating ONLY the Independent Criterion

**Example 1: Overlap Dependency**
> Story A: *"**As a** team member, **I want to** send and receive messages **so that** I can communicate with my colleagues."*
> * **Given** I am on the messaging page, **When** I compose a message and click "Send", **Then** the message appears in the recipient's inbox.
> * **Given** a colleague has sent me a message, **When** I open my inbox, **Then** I can read the message.
>
> Story B: *"**As a** team member, **I want to** reply to messages **so that** I can indicate which message I am responding to."*
> * **Given** I have received a message, **When** I click the "Reply" button and submit my response, **Then** the reply is sent to the original sender.
> * **Given** the reply has been received, **When** the original sender views the message, **Then** it is displayed has a reply to the original message.

* **Negotiable:** Yes. Neither story dictates a specific UI or technology.
* **Valuable:** Yes. Communication features are clearly valuable to users.
* **Estimable:** Difficult. The overlapping "send" capability makes it unclear how to estimate each story independently.
* **Small:** Yes. Each story is as small as it can be without losing value. Sending without receiving would be incomplete and thus not valuable, so we cannot split story A into seperate stories.
* **Testable:** Yes. Clear acceptance criteria can be written for sending, receiving, and replying.
* **Why it violates Independent:** Both stories include "sending a message." If Story A is implemented first, parts of Story B are already done. If Story B is implemented first, parts of Story A are already done. This creates confusion about what is covered and makes estimation unreliable.
* **How to fix it:** Repartition into three non-overlapping stories: "**As a** team member, **I want to** send a message", "**As a** team member, **I want to** receive messages", and "**As a** team member, **I want to** reply to a message."

**Example 2: Technical (Horizontal) Splitting**
> Story A: *"**As a** job seeker, **I want to** fill out a resume form **so that** I can enter my information."*
> * **Given** I am on the resume page, **When** I fill in my name, address, and education, **Then** the form displays my entered information.
>
> Story B: *"**As a** job seeker, **I want** my resume data to be saved **so that** it is available when I return."*
> * **Given** I have filled out the resume form, **When** I click "Save", **Then** my resume data is available when I log back in.

* **Negotiable:** No. Both stories dictate internal technical steps rather than user-facing capabilities.
* **Valuable:** No. Neither story delivers value on its own—a form that does not save is useless, and saving data without a form to collect it is equally useless.
* **Estimable:** Yes. Developers can estimate each technical task.
* **Small:** Yes. Each is a small piece of work.
* **Testable:** Yes. Each can be verified in isolation.
* **Why it violates Independent:** Story B is meaningless without Story A, and Story A is useless without Story B. They are completely interdependent because the feature was split along technical boundaries (UI layer vs. persistence layer) instead of user-facing functionality {% cite cohn2004user %}.
* **How to fix it:** Combine into a single vertical slice: "**As a** job seeker, **I want to** submit a resume with basic information (name, address, education) **so that** employers can find me." This cuts through all layers and delivers value independently {% cite cohn2004user %}.

## Negotiable

*A **negotiable** story captures the essence of a user's need without locking in specific design or technology decisions—the details are worked out collaboratively.*

**What it is and Why it Matters**
The "Negotiable" criterion states that a user story is not an explicit contract for features; rather, it captures the essence of a user’s need, leaving the details to be co-created by the customer and the development team during development {% cite Wake2003INVESTinGoodStories %}. A good story **captures the essence**, not the details (see also ["Requirements Vs. Design"](/SEBook/requirements#requirements-vs--design)).

This criterion matters for several fundamental reasons:
* **Enabling Collaboration:** Because stories are intentionally incomplete, the team is forced to have conversations to fill in the details. Ron Jeffries describes this through the three C’s: *Card* (the story text), *Conversation* (the discussion), and *Confirmation* (the acceptance tests) {% cite cohn2004user %}. The card is merely a token promising a future conversation {% cite Wake2003INVESTinGoodStories %}.
* **Evolutionary Design:** High-level stories define capabilities without over-constraining the implementation approach {% cite Wake2003INVESTinGoodStories %}. This leaves room to evolve the solution from a basic form to an advanced form as the team learns more about the system’s needs.
* **Avoiding False Precision:** Including too many details early creates a dangerous illusion of precision {% cite cohn2004user %}. It misleads readers into believing the requirement is finalized, which discourages necessary conversations and adaptation.

**How to Evaluate It**
To determine if a user story is negotiable, ask:
1. **Does this story dictate a specific technology or design decision?** Words like "MongoDB", "HTTPS", "REST API", or "dropdown menu" in a story are red flags that it has left the space of requirements and entered the space of design.
2. **Could the development team solve this problem using a completely different technology or layout, and would the user still be happy?** If the answer is yes, the story is negotiable. If the answer is no, the story is over-constrained.
3. **Does the story include UI details?** Embedding user interface specifics (e.g., "a print dialog with a printer list") introduces premature assumptions before the team fully understands the business goals {% cite cohn2004user %}.

**How to Improve It**
If a story violates the Negotiable criterion, you can improve it using these techniques:
* **Focus on the "Why":** Use "So that" clauses to clarify the underlying goal, which allows the team to negotiate the "How".
* **Specify What, Not How:** Replace technology-specific language with the user need it serves. Instead of "use HTTPS", write "keep data I send and receive confidential."
* **Define Acceptance Criteria, Not Steps:** Define the outcomes that must be true, rather than the specific UI clicks or database queries required.
* **Keep the UI Out as Long as Possible:** Avoid embedding interface details into stories early in the project {% cite cohn2004user %}. Focus on what the user needs to accomplish, not the specific controls they will use.

### Examples of Stories Violating ONLY the Negotiable Criterion

**Example 1: The Technology-Specific Story**
> *"**As a** subscriber, **I want** my profile settings saved in a MongoDB database **so that** they load quickly the next time I log in."*
> * **Given** I am logged in and I change my profile settings, **When** I log out and log back in, **Then** my profile settings are still applied.

* **Independent:** Yes. Saving profile settings does not depend on other stories.
* **Valuable:** Yes. Remembering user settings is clearly valuable.
* **Estimable:** Yes. A developer can estimate the effort to implement settings persistence.
* **Small:** Yes. This is a focused piece of work.
* **Testable:** Yes. You can verify that settings persist across sessions.
* **Why it violates Negotiable:** Specifying "MongoDB" is a design decision. The user does not care where the data lives. The engineering team might realize that a relational SQL database or local browser caching is a much better fit for the application’s architecture.
* **How to fix it:** *"**As a** subscriber, **I want** the system to remember my profile settings **so that** I don’t have to re-enter them every time I log in."*

**Example 2: The UI-Specific Story**
> *"**As a** student, **I want** the website to use HTTPS **so that** my data is safe."*
> * **Given** I am submitting personal data on the website, **When** the data is transmitted to the server, **Then** the connection uses HTTPS encryption.

* **Independent:** Yes. Security does not depend on other stories.
* **Valuable:** Yes. Data safety is clearly valuable to the user.
* **Estimable:** Yes. Enabling HTTPS is a well-understood task.
* **Small:** Yes. This is a single, focused change.
* **Testable:** Yes. You can verify that traffic is encrypted.
* **Why it violates Negotiable:** "HTTPS" is a specific design decision. The user’s actual need is data confidentiality, which could be achieved in multiple ways depending on the system’s architecture.
* **How to fix it:** *"**As a** student, **I want** the website to keep data I send and receive confidential **so that** my privacy is ensured."*


## Valuable

*A **valuable** story delivers tangible benefit to the customer, purchaser, or user—not just to the development team.*

**What it is and Why it Matters**
The "Valuable" criterion states that every user story must deliver tangible value to the customer, purchaser, or user—not just to the development team {% cite Wake2003INVESTinGoodStories %}. A good story focuses on the external impact of the software in the real world: if we frame stories so their impact is clear, product owners and users can understand what the stories bring and make good prioritization choices {% cite Wake2003INVESTinGoodStories %}.

This criterion matters for several fundamental reasons:
* **Informed Prioritization:** The product owner prioritizes the backlog by weighing each story's value against its cost. If a story's business value is opaque—because it is written in technical jargon—the customer cannot make intelligent scheduling decisions {% cite cohn2004user %}.
* **Avoiding Waste:** Stories that serve only the development team (e.g., refactoring for its own sake, adopting a trendy technology) consume iteration capacity without moving the product closer to its users' goals. The IRACIS framework provides a useful lens for value: does the story **I**ncrease **R**evenue, **A**void **C**osts, or **I**mprove **S**ervice? {% cite Wake2003INVESTinGoodStories %}
* **User vs. Purchaser Value:** It is tempting to say every story must be valued by end-users, but that is not always correct. In enterprise environments, the *purchaser* may value stories that end-users do not care about (e.g., "All configuration is read from a central location" matters to the IT department managing 5,000 machines, not to daily users) {% cite cohn2004user %}.

**How to Evaluate It**
To determine if a user story is valuable, ask:
1. **Would the customer or user care if this story were dropped?** If only developers would notice, the story likely lacks user-facing value.
2. **Can the customer prioritize this story against others?** If the story is written in "techno-speak" (e.g., "All connections go through a connection pool"), the customer cannot weigh its importance {% cite cohn2004user %}.
3. **Does this story describe an external effect or an internal implementation detail?** Valuable stories describe what happens on the edge of the system—the effects of the software in the world—not how the system is built internally {% cite Wake2003INVESTinGoodStories %}.

**How to Improve It**
If stories violate the Valuable criterion, you can improve them using these techniques:
* **Rewrite for External Impact:** Translate the technical requirement into a statement of benefit for the user. Instead of "All connections to the database are through a connection pool", write "Up to fifty users should be able to use the application with a five-user database license" {% cite cohn2004user %}.
* **Let the Customer Write:** The most effective way to ensure a story is valuable is to have the customer write it in the language of the business, rather than in technical jargon {% cite cohn2004user %}.
* **Focus on the "So That":** A well-written "so that" clause forces the author to articulate the real-world benefit. If you cannot complete "so that [some user benefit]" without referencing technology, the story is likely not valuable.
* **Complete the Acceptance Criteria:** A story may *appear* valuable but have incomplete acceptance criteria that leave out essential functionality, effectively making the delivered feature useless.

### Examples of Stories Violating ONLY the Valuable Criterion

**Example 1: The Developer-Centric Story**
> *"**As a** developer, **I want to** rewrite the core authentication API in Rust **so that** I can use a more modern programming language."*
> * **Given** the authentication API currently runs on Node.js, **When** a developer deploys the new Rust-based API, **Then** all existing authentication endpoints return identical responses.

* **Independent:** Yes. Rewriting the auth API does not depend on other stories.
* **Negotiable:** Yes. The story is phrased as a goal (rewrite auth), leaving room to discuss scope and approach.
* **Estimable:** Yes. A developer experienced with Rust can estimate the effort of a rewrite.
* **Small:** Yes. Rewriting a single API component can fit within a sprint.
* **Testable:** Yes. You can verify the new API passes all existing authentication tests.
* **Why it violates Valuable:** The story is written entirely from the developer's perspective. The user does not care which programming language the API uses. The "so that" clause ("use a more modern programming language") describes a developer preference, not a user benefit {% cite cohn2004user %}.
* **How to fix it:** If there is a legitimate user-facing reason (e.g., performance), rewrite the story around that benefit: *"**As a** registered member, **I want to** log in without noticeable delay **so that** I can start using the application immediately."*

**Example 2: The Incomplete Story**
> *"**As a** smart home owner, **I want to** schedule my porch lights to turn on automatically at a specific time **so that** I don't have to walk up to a dark house in the evening."*
> **Given** I am logged into the smart home mobile app, **When** I set the porch light schedule to turn on at 6:00 PM, **Then** the porch lights will illuminate at exactly 6:00 PM every day.

* **Independent:** Yes. Scheduling lights does not depend on other stories.
* **Negotiable:** Yes. The specific UI and scheduling mechanism are open to discussion.
* **Estimable:** Yes. Implementing a time-based trigger is well-understood work.
* **Small:** Yes. A single scheduling feature fits within a sprint.
* **Testable:** Yes. The acceptance criteria define a clear pass/fail condition.
* **Why it violates Valuable:** On first glance, this story looks valuable. But the acceptance criteria are missing the ability to *turn off* the lights. If lights stay on forever, they waste energy and the feature becomes a nuisance rather than a benefit. The story as written delivers incomplete value because its acceptance criteria do not capture the full scope needed to make the feature genuinely useful.
* **How to fix it:** Add the missing acceptance criterion: *"Given I am logged into the smart home mobile app, When I set the porch light schedule to turn off at 6:00 AM and the lights are illuminated, Then the porch lights will turn off at 6:00 AM."* Now the story delivers complete value.

## Estimable

*An **estimable** story has a scope clear enough for the development team to make a reasonable judgment about the effort required.*

**What it is and Why it Matters**
The "Estimable" criterion states that the development team must be able to make a reasonable judgment about a story's size, cost, or time to deliver {% cite Wake2003INVESTinGoodStories %}. While precision is not the goal, the estimate must be useful enough for the product owner to prioritize the story against other work {% cite cohn2004user %}.

This criterion matters for several fundamental reasons:
* **Enabling Prioritization:** The product owner ranks stories by comparing value to cost. If a story cannot be estimated, the cost side of this equation is unknown, making informed prioritization impossible {% cite cohn2004user %}.
* **Supporting Planning:** Stories that cannot be estimated cannot be reliably scheduled into an iteration. Without sizing information, the team risks committing to more (or less) work than they can deliver.
* **Surfacing Unknowns Early:** An unestimable story is a signal that something important is not understood—either the domain, the technology, or the scope. Recognizing this early prevents costly surprises later.

**How to Evaluate It**
Developers generally cannot estimate a story for one of three reasons {% cite cohn2004user %}:
1. **Lack of Domain Knowledge:** The developers do not understand the business context. For example, a story saying "New users are given a diabetic screening" could mean a simple web questionnaire or an at-home physical testing kit—without clarification, no estimate is possible {% cite cohn2004user %}.
2. **Lack of Technical Knowledge:** The team understands the requirement but has never worked with the required technology. For example, a team asked to expose a gRPC API when no one has experience with Protocol Buffers or gRPC cannot estimate the work {% cite cohn2004user %}.
3. **The Story is Too Big:** An epic like "A job seeker can find a job" encompasses so many sub-tasks and unknowns that it cannot be meaningfully sized as a single unit {% cite cohn2004user %}.

**How to Improve It**
The approach to fixing an unestimable story depends on which barrier is blocking estimation:
* **Conversation (for Domain Knowledge Gaps):** Have the developers discuss the story directly with the customer. A brief conversation often reveals that the requirement is simpler (or more complex) than assumed, making estimation possible {% cite cohn2004user %}.
* **Spike (for Technical Knowledge Gaps):** Split the story into two: an investigative *spike*—a brief, time-boxed experiment to learn about the unknown technology—and the actual implementation story. The spike itself is always given a defined maximum time (e.g., "Spend exactly two days investigating credit card processing"), which makes it estimable. Once the spike is complete, the team has enough knowledge to estimate the real story {% cite cohn2004user %}.
* **Disaggregate (for Stories That Are Too Big):** Break the epic into smaller, constituent stories. Each smaller piece isolates a specific slice of functionality, reducing the cognitive load and making estimation tractable {% cite cohn2004user %}.

### Examples of Stories Violating ONLY the Estimable Criterion

**Example 1: The Unknown Domain**
> *"**As a** patient, **I want to** receive a personalized wellness screening **so that** I can understand my health risks."*
> * **Given** I am a new patient registering on the platform, **When** I complete the wellness screening, **Then** I receive a personalized health risk summary based on my answers.

* **Independent:** Yes. The screening feature does not depend on other stories.
* **Negotiable:** Yes. The specific questions and screening logic are open to discussion.
* **Valuable:** Yes. Personalized health screening is clearly valuable to patients.
* **Small:** Yes. A single screening workflow can fit within a sprint—once the scope is clarified.
* **Testable:** Yes. Acceptance criteria can define specific screening outcomes for specific patient profiles.
* **Why it violates Estimable:** The developers do not know what "personalized wellness screening" means in this context. It could be a simple 5-question web form or a complex algorithm that integrates with lab data. Without domain knowledge, the team cannot estimate the effort {% cite cohn2004user %}.
* **How to fix it:** Have the developers sit down with the customer (e.g., a qualified nurse or medical expert) to clarify the scope. Once the team learns it is a simple web questionnaire, they can estimate it confidently.

**Example 2: The Unknown Technology**
> *"**As an** enterprise customer, **I want to** access the system's data through a gRPC API **so that** I can integrate it with my existing microservices infrastructure."*
> * **Given** an enterprise client sends a gRPC request for user data, **When** the system processes the request, **Then** the system returns the requested data in the correct Protobuf-defined format.

* **Independent:** Yes. Adding an integration interface does not depend on other stories.
* **Negotiable:** Partially. The customer has specified gRPC, but the service contract and data schema are open to discussion.
* **Valuable:** Yes. Enterprise integration is clearly valuable to the purchasing organization.
* **Small:** Yes. A single service endpoint can fit within a sprint—once the team understands the technology.
* **Testable:** Yes. You can verify the interface returns the correct data in the correct format.
* **Why it violates Estimable:** No one on the development team has ever built a gRPC service or worked with Protocol Buffers. They understand *what* the customer wants but have no experience with the technology required to deliver it, making any estimate unreliable {% cite cohn2004user %}.
* **How to fix it:** Split into two stories: (1) a time-boxed spike—"Investigate gRPC integration: spend at most two days building a proof-of-concept service"—and (2) the actual implementation story. After the spike, the team has enough knowledge to estimate the real work {% cite cohn2004user %}.


## Small

*A **small** story is a manageable chunk of work that can be completed within a single iteration—not so large it becomes an epic, not so small it loses meaningful context. A user story should be as small as it can be while still delivering value.* 

**What it is and Why it Matters**
The "Small" criterion states that a user story should be appropriately sized **so that** it can be comfortably completed by the development team within a single iteration {% cite cohn2004user %}. Stories typically represent at most a few person-weeks of work; some teams restrict them to a few person-days {% cite Wake2003INVESTinGoodStories %}. If a story is too large, it is called an *epic* and must be broken down. If a story is too small, it should be combined with related stories.

This criterion matters for several fundamental reasons:
* **Predictability:** Large stories are notoriously difficult to estimate accurately. The smaller the story, the higher the confidence the team has in their estimate of the effort required {% cite cohn2004user %}.
* **Risk Reduction:** If a massive story spans an entire sprint (or spills over into multiple sprints), the team risks delivering zero value if they hit a roadblock. Smaller stories ensure a steady, continuous flow of delivered value.
* **Faster Feedback:** Smaller stories reach a "Done" state faster, meaning they can be tested, reviewed by the product owner, and put in front of users much sooner to gather valuable feedback.

**How to Evaluate It**
To determine if a user story is appropriately sized, ask:
1. **Can it be completed in one sprint?** If the answer is no, or "maybe, if everything goes perfectly," the story is too big. It is an epic and must be split {% cite cohn2004user %}.
2. **Is it a compound story?** Words like *and*, *or*, and *but* in the story description (e.g., "**I want to** register *and* manage my profile *and* upload photos") often indicate that multiple stories are hiding inside one. A compound story is an epic that aggregates multiple easily identifiable shorter stories {% cite cohn2004user %}.
3. **Is it a complex story?** If the story is large because of inherent *uncertainty* (new technology, novel algorithm), it is a complex story and should be split into a spike and an implementation story {% cite cohn2004user %}.
4. **Is it too small?** If the administrative overhead of writing and estimating the story takes longer than implementing it, the story is too small and should be combined with related stories {% cite cohn2004user %}.

**How to Improve It**
The approach to fixing a story that violates the Small criterion depends on whether it is too big or too small:

*Stories that are too big:*
* **Split by Workflow Steps (CRUD):** Instead of "**As a** job seeker, **I want to** manage my resume," split along operations: create, edit, delete, and manage multiple resumes {% cite cohn2004user %}.
* **Split by Data Boundaries:** Instead of splitting by operation, split by the data involved: "add/edit education", "add/edit job history", "add/edit salary" {% cite cohn2004user %}.
* **Slice the Cake (Vertical Slicing):** Never split along technical boundaries (one story for UI, one for database). Instead, split into thin end-to-end "vertical slices" where each story touches every architectural layer and delivers complete, albeit narrow, functionality {% cite cohn2004user %}.
* **Split by Happy/Sad Paths:** Build the "happy path" (successful transaction) as one story, and handle the error states (declined cards, expired sessions) in subsequent stories.

*Stories that are too small:*
* **Combine Related Stories:** Merge tiny, related items (e.g., a batch of small UI tweaks or minor bug fixes) into a single story representing a half-day to several days of work {% cite cohn2004user %}.

### Examples of Stories Violating ONLY the Small Criterion

**Example 1: The Epic (Too Big)**
> *"**As a** traveler, **I want to** plan a vacation **so that** I can book all the arrangements I need in one place."*
> * **Given** I have selected travel dates and a destination, **When** I search for vacation packages, **Then** I see available flights, hotels, and rental cars with pricing.
> * **Given** I have selected a flight, hotel, and rental car, **When** I click "Book", **Then** all reservations are confirmed and I receive a booking confirmation email.

* **Independent:** Yes. Planning a vacation does not overlap with other stories.
* **Negotiable:** Yes. The specific features and UI are open to discussion.
* **Valuable:** Yes. End-to-end vacation planning is clearly valuable to travelers.
* **Estimable:** No. The scope is so vast that developers cannot reliably predict the effort. (Violations of Small often cause violations of Estimable, since epics contain hidden complexity.)
* **Testable:** Yes. Acceptance criteria can be written for individual planning features.
* **Why it violates Small:** "Planning a vacation" involves searching for flights, comparing hotels, booking rental cars, managing an itinerary, handling payments, and much more. This is an epic containing many stories. It cannot be completed in a single sprint {% cite cohn2004user %}.
* **How to fix it:** Disaggregate into smaller vertical slices: "**As a** traveler, **I want to** search for flights by date and destination **so that** I can find available options", "**As a** traveler, **I want to** compare hotel prices for my destination **so that** I can choose one within my budget", etc.

**Example 2: The Micro-Story (Too Small)**
> *"**As a** job seeker, **I want to** edit the date for each community service entry on my resume **so that** I can correct mistakes."*
> * **Given** I am viewing a community service entry on my resume, **When** I change the date field and click "Save", **Then** the updated date is displayed on my resume.

* **Independent:** Yes. Editing a single date field does not depend on other stories.
* **Negotiable:** Yes. The exact editing interaction is open to discussion.
* **Valuable:** Yes. Correcting resume data is valuable to the user.
* **Estimable:** Yes. Editing a single field is trivially estimable.
* **Testable:** Yes. Clear pass/fail criteria can be written.
* **Why it violates Small:** This story is *too small*. The administrative overhead of writing, estimating, and tracking this story card takes longer than actually implementing the change. Having dozens of stories at this granularity buries the team in disconnected details—what Wake calls a "bag of leaves" {% cite Wake2003INVESTinGoodStories %}.
* **How to fix it:** Combine with related micro-stories into a single meaningful story: "**As a** job seeker, **I want to** edit all fields of my community service entries **so that** I can keep my resume accurate." {% cite cohn2004user %}


## Testable

*A **testable** story has clear, objective, and measurable acceptance criteria that allow the team to verify definitively when the work is done.*

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

### Examples of Stories Violating ONLY the Testable Criterion

Below are two user stories that are not testable but still satisfy (most) other INVEST criteria.

**Example 1: The Subjective UI Requirement**
> *"**As a** marketing manager, **I want** the new campaign landing page to feature a **gorgeous and modern** design, **so that** it appeals to our younger demographic."*
> * **Given** the landing page is deployed, **When** a visitor from the 18-24 demographic views it, **Then** the design looks **gorgeous and modern**.

* **Independent:** Yes. It doesn't inherently rely on other features being built first.
* **Negotiable:** Yes. The exact layout and tech used to build it are open to discussion.
* **Valuable:** Yes. A landing page to attract a younger demographic provides clear business value.
* **Estimable:** Yes. Generally, a frontend developer can estimate the effort to build a standard landing page.
* **Small:** Yes. Building a single landing page easily fits within a single sprint.
* **Why it violates Testable:** "Gorgeous," "modern," and "appeals to" are completely subjective. What one developer thinks is modern, the marketing manager might think is ugly. 
* **How to fix it:** Tie it to a specific, measurable design system or user-testing metric. *(e.g., "Acceptance Criteria: The design strictly adheres to the new V2 Brand Guidelines and passes a 5-second usability test with a 4/5 rating from a focus group of 18-24 year olds.")*

**Example 2: The Vague Performance Requirement**
> *"**As a** data analyst, **I want** the monthly sales report to generate **instantly**, **so that** my workflow isn't interrupted by loading screens."*
> * **Given** the database contains 5 years of sales data, **When** the analyst requests the monthly sales report, **Then** the report generates **instantly**.

* **Independent:** Yes. Optimizing or building this report can be done independently.
* **Negotiable:** Yes. The team can negotiate *how* to achieve the speed (e.g., caching, database indexing, background processing).
* **Valuable:** Yes. Saving the analyst's time is a clear operational benefit.
* **Small:** Yes. It is a focused optimization on a single report.
* **Why it violates Testable:** "Instantly" is physically impossible in computing, and it is a highly subjective standard. Does instantly mean 0.1 seconds, or 1.5 seconds? Without a benchmark, a test script cannot verify if the feature passes or fails.
* **Estimable:** No. Without a clear definition of "instantly", the team cannot estimate the effort required to build the feature. Violations of testable are often also not estimable. In the example above, the Subjective UI was still estiable, because independent of the specific definition of "modern", the implementation effort would not change signifiantly, just the specific UI that would be chosen would change.
* **How to fix it:** Replace the subjective word with a quantifiable service level indicator. *(e.g., "Acceptance Criteria: Given the database contains 5 years of sales data, when the analyst requests the monthly sales report, then the data renders on screen in under 2.5 seconds at the 95th percentile.")*


**Example 3: The Subjective Audio Requirement**
> *"**As a** podcast listener, **I want** the app's default intro chime to play at a **pleasant volume**, **so that** it doesn't startle me when I open the app."*
> * **Given** I open the app for the first time, **When** the intro chime plays, **Then** the volume is at a **pleasant** level.

* **Independent:** Yes. Adjusting the audio volume doesn't rely on other features.
* **Negotiable:** Yes. The exact decibel level or method of adjustment is open to discussion.
* **Valuable:** Yes. Improving user comfort directly enhances the user experience.
* **Estimable:** Yes. Changing a default audio volume variable or asset is a trivial, highly predictable task (e.g., a 1-point story). The developers know exactly *how* much effort is involved.
* **Small:** Yes. It will take a few minutes to implement.
* **Why it violates Testable:** "Pleasant volume" is entirely subjective. A volume that is pleasant in a quiet library will be inaudible on a noisy subway. Because there is no objective baseline, QA cannot definitively pass or fail the test. 
* **How to fix it:** *"Acceptance Criteria: The default intro chime must be normalized to -16 LUFS (Loudness Units relative to Full Scale)."*

## How INVEST supports agile processes like Scrum

The INVEST principles matter because they act as a compass for creating high-quality, actionable user stories that align with Agile goals and principles of processes like [Scrum](/SEBook/process/scrum.html). 
By ensuring stories are **Independent** and **Small**, teams gain the scheduling flexibility needed to implement and release features in any order within short iterations. 
If user stories are not independent, it becomes hard to always select the highest value user stories. 
If they are not small, it becomes hard to select a Sprint Backlog that fit the team's velocity.  
**Negotiable** stories promote essential dialogue between developers and stakeholders, while **Valuable** ones ensure that every effort translates into a meaningful benefit for the user. Finally, stories that are **Estimable** and **Testable** provide the clarity required for accurate sprint planning and objective verification of the finished product. In 
[Scrum](/SEBook/process/scrum.html) and [XP](/SEBook/process/xp.html), user stories are estimated during the Planning activity. 

## FAQ on INVEST

### How are Estimable and Testable different?

**Estimable** refers to the ability of developers to predict the size, cost, or time required to deliver a story. This attribute relies on the story being understood well enough and having a clear enough scope to put useful bounds on those guesses.

**Testable** means that a story can be verified through objective acceptance criteria. A story is considered testable if there is a definitive "Yes" or "No" answer to whether its objectives have been achieved.

In practice, these two are closely linked: if a story is not testable because it uses vague terms like "fast" or "high accuracy," it becomes nearly impossible to estimate the actual effort needed to satisfy it.
But that is not always the case.

Here are examples of user stories that isolate those specific violations of the INVEST criteria:

 **Violates Testable but not Estimable**
**User Story:** *"**As a** site administrator, **I want** the dashboard to feel **snappy** when I log in **so that** I don't get frustrated with the interface."*

*   **Why it violates Testable:** Terms like "snappy" or "fast" are subjective. Without a specific metric (e.g., "loads in under 2 seconds"), there is no objective "Yes" or "No" answer to determine if the story is done. 
*   **Why it is still Estimable:** A developer might still estimate this as a "small" task if they assume it just requires basic front-end optimization, even though they can't formally verify the "snappy" feel.

 **Violates Estimable but not Testable**
**User Story:** *"**As a** safety officer, **I want** the system to **automatically identify every pedestrian** in this complex, low-light video feed."*

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


# User Stories in Practice

While user stories are widely adopted for building shared understanding {% cite patton2014mapping %} and fostering a pleasant workplace among developers {% cite lucassen2016improving %}, empirical research highlights several significant challenges in their practical application.

## Common Quality Issues
- **The NFR Blindspot**: Practitioners systematically omit non-functional requirements (NFRs)—such as usability, security, and performance—because these constraints often do not fit neatly into the standard functional template {% cite lauesen2022quality %}. Mike Cohn notes that forcing NFRs into the "As a... I want..." format often results in untestable statements like "The software must be easy to use" {% cite cohn2004user %}.
- **Rationale Hazard**: While specified rationale ("so that...") is essential for requirements quality {% cite lucassen2016improving %}, practitioners often fill this field in unjustifiably to satisfy templates. This forced inclusion of "filler" goals can directly lead to unverifiable requirements that obscure true business objectives {% cite lauesen2022quality %}.
- **Ambiguity**: Ambiguity manifests across lexical, syntactic, semantic, and pragmatic levels {% cite amna2022ambiguity %}. When analyzed collectively, vague stories often lead to severe cross-story defects, including logical conflicts and missing dependencies {% cite amna2022ambiguity %}.

## Process Anti-Patterns
- **The "Template Zombie"**: This occurs when a team allows its work to be driven by templates rather than the thought process necessary to deliver a product {% cite patton2014mapping %}. Practitioners become "Template Zombies" when they mechanically force technical tasks or backend services into the story format, often ignoring the necessary collaborative conversation {% cite patton2014mapping %}.
- **The Client-Vendor Anti-Pattern**: Jeff Patton identifies a toxic dynamic where one party (often a business stakeholder) takes a "client" role to dictate requirements, while the other (often a developer or analyst) takes a "vendor" role to merely take orders and provide estimates. This creates a "requirements contract" that kills the collaborative problem-solving at the heart of agile development {% cite patton2014mapping %}.
- **Story Smells**: Common "smells" include *Goldplating* (adding unplanned features), *UI Detail Too Soon* (constraining design before understanding goals), and *Thinking Too Far Ahead* (exhaustive detailing long before implementation) {% cite cohn2004user %}.

## Automation and LLMs
Recent advancements in Large Language Models (LLMs) have introduced new capabilities for requirement engineering:
- **Syntactic Maturity**: LLMs like GPT-4o excel at generating well-formed, atomic, and grammatically complete user stories, often outperforming novice analysts in following strict templates {% cite sharma2025llm %}.
- **The Convergence Gap**: While LLMs achieve high coverage of standard requirements, they exhibit a "convergence vs. creativity" trade-off. They tend to converge on predictable patterns and may miss novel or domain-specific nuances that human analysts provide {% cite quattrocchi2025llm %}. 
- **The Power of Prompting**: The quality of automated generation is highly sensitive to prompt design. Using a "Meta-Few-Shot" approach—combining structural rules with explicit positive and negative examples—can push LLM success rates significantly higher, even surpassing manual human generation in semantic accuracy {% cite santos2025chatgpt %}.

## Story Mapping and INVEST
The narrative flow of **User Story Mapping** captures the sequential and hierarchical relationships between stories {% cite patton2014mapping %}. From a theoretical perspective, this creates a notable tension with the **INVEST** criteria: while Story Mapping emphasizes the journey's context and narrative flow, it can challenge the **Independence** criterion by highlighting the deep relationships between individual stories in a user journey. However, this mapping generally helps achieve the other INVEST criteria—particularly **Valuable** and **Small**—by providing a clear framework for slicing features into manageable releases.

# Quiz


{% include flashcards.html id="user_stories" %}

{% include quiz.html id="user_stories" %}
