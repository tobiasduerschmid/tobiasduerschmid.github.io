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
A good story **captures the essence**, not the details. 

**Violation Example:** "*As a student, I want the website to use HTTPS so that my data is safe*". This violates the principle because "HTTPS" is a specific design decision, meaning the user story has inappropriately left the space of requirements.

**How to Improve:** Focus on the underlying *need* rather than the technical execution. A better version would be: "*As a student, I want the website to keep data I send and receive confidential so that my privacy is ensured*".


The Bad Story: "As a user, I want my profile settings saved in a MongoDB database so that they load quickly the next time I log in."

The Design Decision: Specifying "MongoDB."

Why it's a problem: The user doesn't care where the data lives. The engineering team might realize that a relational SQL database or local browser caching is a much better fit for the rest of the application's architecture.

The Negotiable Fix: "As a user, I want the system to remember my profile settings so that I don't have to re-enter them every time I log in."


"If the development team solves this user's problem using a completely different technology or layout than I pictured in my head, is the user still happy?" If the answer is yes, your story is negotiable!

## Valuable


## Estimable


## Small


"*As a student, I want direct integration with Piazza, Gradescope, Google Drive, and Zoom so that I do not need to open them in separate pages. 
Given the student is logged in, when the student uses the Piazza, Gradescope, Google Drive, or Zoom integration, then the linked services do not require separate authentication, and data is transferred automatically from/to BruinLearn, and no privacy violations (as defined in the federal law “FERPA”) occur in the external apps.*"

The user story contains multiple, separate features (Piazza, Gradescope, Google Drive, and Zoom) that can be broken into separate user stories that are each valuable on their own.


"As a registered shopper, I want to add items to my cart, enter my shipping address, provide credit card details, and receive a confirmation email with a tracking number so that I can complete my purchase in one go."




## Testable


"As a site administrator, I want the dashboard to load 'fast' and feel 'snappy' when I log in so that I don't get frustrated with the interface."

# Applicability
User stories are ideal for iterative, customer-centric projects where requirements might change frequently. 

# Limitations
User stories can struggle to capture non-functional requirements like performance, security, or reliability, and they are generally considered insufficient for safety-critical systems like spacecraft or medical devices