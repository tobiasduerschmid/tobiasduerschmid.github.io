# Scrum video narration

The narration at the top of `SEBook/process/scrum.md` teaches Scrum's theory,
roles, artifacts, and events by following one sprint of a student team. It is
the first video narration (`docs/video-narration.md`). Storyboard:
`_data/explainers/scrum.yml`; checks: `scrum_quizzes.yml`; artwork:
`js/video-narration/scrum.js` and `scrum-kit.js` with
`css/video-narration-scrum.css`.

## Sources

The narration states ideas without naming sources (as the narrated lessons
do); this is where each comes from, for maintainers.

| Claim in the narration | Source |
|---|---|
| Scrum is the most popular way agile teams work | CS 130 lecture 16, slide 3, citing the State of Agile 2024 report (63% of agile teams use Scrum). |
| Plan everything up front versus a loop of plan, build, show, improve | Lecture 16, title slide (waterfall versus agile development). |
| Empiricism; problems too complex for analysis alone | Lecture 16, slide 5; Scrum Guide 2020, "Scrum Theory". |
| Transparency, inspection, adaptation and how they depend on each other | Lecture 16, slides 6 to 9; Scrum Guide 2020. "Inspection without transparency is misleading" and "inspection without adaptation is pointless" paraphrase the guide. |
| Cross-functional and self-managing (self-organizing in the lecture); no sub-teams or hierarchies; three accountabilities | Lecture 16, slides 10 to 12; Scrum Guide 2020, "Scrum Team". The guide's 2020 term is self-managing; the lecture says self-organized. |
| The Developers' four accountabilities | Lecture 16, slide 13; Scrum Guide 2020, "Developers". |
| The Product Owner: maximizes value, one person, talks with customers, writes and orders stories, checks acceptance criteria, answers questions | Lecture 16, slide 14; Scrum Guide 2020, "Product Owner". |
| Three traps for Product Owners and their fixes | Lecture 16, slides 15 and 16 (Hajdarevic, The Role of Product Owners: an empirical investigation). |
| The Scrum Master: coach, effective and timeboxed events, removes impediments, shields the team; not a product or project manager | Lecture 16, slides 17 to 19 (Noll, Razzak, Bass, and Beecham, A Study of the Scrum Master's Role, PROFES 2017); Scrum Guide 2020, "Scrum Master". |
| The tension between internal and external quality | Lecture 16, slide 20. |
| Product Backlog: emergent, ordered, single source of work, user stories with acceptance criteria, refinement, Product Goal | Lecture 16, slide 22; Scrum Guide 2020, "Product Backlog". |
| Sprint Backlog: why, what, how; by and for the Developers; scope renegotiated, Sprint Goal fixed | Lecture 16, slide 23; Scrum Guide 2020, "Sprint Backlog". |
| Increment: stepping stone, additive, verified, usable; Definition of Done; unfinished work returns to the Product Backlog | Lecture 16, slide 24; Scrum Guide 2020, "Increment" and "Definition of Done". |
| Sprint: fixed timebox, usually two to three weeks, at most a month, back to back, contains the other events, no changes that endanger the Sprint Goal | Lecture 16, slide 4 (two to three weeks); Scrum Guide 2020, "The Sprint" (one month or less). |
| Sprint Planning's three topics, planning poker, tasks of a day or less | Lecture 16, slide 26; Scrum Guide 2020, "Sprint Planning". |
| Daily Scrum: fifteen minutes, standing, same time and place, the three questions many teams use, not a status report | Lecture 16, slide 27; Scrum Guide 2020, "Daily Scrum" (same time and place; the 2020 guide no longer prescribes the three questions, so the narration says "many teams"). |
| Sprint Review: inspect the outcome with stakeholders, working session with live demos, Product Owner assesses value, Product Backlog adjusted | Lecture 16, slide 28; Scrum Guide 2020, "Sprint Review". |
| Sprint Retrospective: individuals, interactions, processes, tools, and the Definition of Done; most helpful changes | Lecture 16, slide 29; Scrum Guide 2020, "Sprint Retrospective". |
| User stories focus on features, so qualities slip through; put quality checks in the Definition of Done | Lecture 16, slides 41 and 42 (Rahman, Cysneiros, and Berry, SAC 2024). |

The lecture's scaling section (SAFe, Scrum of Scrums, Conway's law) and its
research on team effectiveness are not narrated; the chapter text covers
scaling.

## The example

Hall Hopper, a student team's app that shows tonight's dining-hall menus and a
crowd meter for each hall, was chosen with the instructor over a co-op mobile
game and a study-group finder. Its sprint gives every Scrum element a concrete
moment: the Product Owner talks with students and dining staff, a data
agreement with the legal office is the impediment, the Sprint Review turns
student feedback into backlog items, and a screen-reader user's feedback leads
the retrospective to change the Definition of Done. The intro shows the
finished app, whose crowd levels are words as well as bars; the sprint's first
version shows a colored dot only, which is the gap the review uncovers and the
new backlog item fixes. The hall names are invented.

The summary quiz uses a new team (a study-room booking app), so the checks test
Scrum rather than recall of the example.

Every section with a quiz ends with `pause_after: 2.5` on its last cue,
including the summary. The audio finishes all words, then holds the final
picture in silence. The shared player opens the check 0.3 seconds before the
section boundary, leaving about 2.2 seconds to inspect the picture at normal
speed (1.1 seconds at 2x) without starting the next section's speech. Keep the
audio, captions, and timing manifest together when regenerating this pause.

## The pictures

Every cue is a scene on the animated stage, in one visual language: paper
cards and notes on a team-room wall, list cards, role badges, stickers, and a
few objects for ideas, such as empiricism's pillars holding up a temple, a
balance weighing internal against external quality, and a board whose
columns and arrows trace a backlog item. The recap reuses those objects. The
wall follows the site's light or dark mode.
