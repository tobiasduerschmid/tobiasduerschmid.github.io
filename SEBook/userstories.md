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


## Negotiable

This user story violates negotiable: "As a student, I want the website to use HTTPS so that my data is safe." 
HTTPS is a design decision, not a requirement. So this user story leaves the space of requirements, which it should nopt. 
A better version would focus on the need for encrypted data: "As a student, I want the website to keep data I send and receive confidential so that my privacy is ensured." 

## Valuable


## Estimable


## Small


## Testable

# Applicability
User stories are ideal for iterative, customer-centric projects where requirements might change frequently. 

# Limitations
User stories can struggle to capture non-functional requirements like performance, security, or reliability, and they are generally considered insufficient for safety-critical systems like spacecraft or medical devices