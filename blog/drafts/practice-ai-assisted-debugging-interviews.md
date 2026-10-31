---
layout: blog-post
title: "[Draft] Practice for AI-Assisted Debugging Interviews: Drills, SEBook Exercises, and a Four-Week Plan"
date: 2026-10-31
category: "For Students"
permalink: /blog/practice-ai-assisted-debugging-interviews/
# Unlisted draft: this page sits outside the blog collection, so it does not
# appear on /blog/, among featured posts, or in feed.xml. To publish it, move it
# to _blog/ with a date prefix, keep the permalink, and delete `sitemap: false`.
sitemap: false
---

**In [the companion post](/blog/ai-assisted-debugging-interviews/), I described a new kind of software engineering interview: you get an unfamiliar codebase, a failing test or bug report, and an AI assistant, and you are evaluated on how you find, fix, and explain the problem. This post is about practice. It describes one core drill, maps each interview skill to exercises you can already do in the SEBook, and adds new drills that fill the gaps. It ends with a four-week plan and a rubric for scoring yourself.**

## How to Practice So It Transfers

* **Practice the parts you will be graded on.** Orienting yourself, reproducing a failure, forming hypotheses, verifying, and explaining are separate skills. Practice each one on purpose instead of just solving more problems.
* **Use code you didn't write.** Your own code hides its bugs from you because you remember what you meant. Interview code is unfamiliar by design.
* **Rotate how much AI you allow.** Practice the same skills with no AI, with a restricted assistant, and with a full coding agent. You often won't know in advance which one an interview uses, and Shopify, for example, describes evaluating candidates with no AI, optional AI, and mandatory AI.
* **Get feedback after every attempt.** Use tests, a friend acting as interviewer, or a comparison with the real fix.
* **Spread practice out and mix bug types.** Short sessions over several weeks, with different kinds of bugs mixed together, tend to produce more durable learning than cramming one kind of problem {% cite dunlosky2013 %}.
* **Finish without help.** Getting unstuck with help is not the same as learning. In a study with 480 students, automated feedback helped students fix compiler errors faster than human tutoring did during labs, but the advantage disappeared on exams, where no feedback was available {% cite Ahmed2020AdaptiveFeedback %}. After any AI-assisted fix, explain the root cause yourself, then solve a similar bug alone.

## The Core Drill: A 60-Minute Repository Debugging Session

Most practice below builds toward this drill, which mirrors the repository debugging rounds. Use a multi-file project you didn't write, with a failing test or a bug report: a classmate's project, a real bug from an open-source project, or a bug a friend planted for you (see the new drills below).

| Time | Step | What you produce |
|---|---|---|
| 0–10 min | **Orient:** read the task, run the tests, and trace the failing path | A three- to five-line map of the relevant code |
| 10–15 min | **Reproduce:** make the failure happen on demand | A failing test or an exact command |
| 15–25 min | **Hypothesize:** list likely causes and how to tell them apart | Two or three ranked hypotheses, each with a check |
| 25–45 min | **Localize and fix:** run the checks, then make the smallest change | A minimal diff |
| 45–55 min | **Verify:** run the full suite, add a regression test, and review the diff | Passing tests and a reviewed diff |
| 55–60 min | **Explain:** state the root cause and the fix out loud | A three-sentence explanation, given without looking at the AI chat |

Record each session in the debugging log from the companion post (symptom, expected behavior, hypotheses, experiment, root cause, fix and test). Afterward, score yourself with the rubric at the end of this post.

## Practice in Three AI Modes

**No AI.** This is the baseline. It shows you what you can do alone, and many interview rounds still require it.

**A restricted assistant.** Some repository assessments use an assistant that explains code and errors but won't write the fix. You can simulate one by starting a chat with instructions like these:

> "You are a restricted coding-interview assistant. You may explain code, error messages, language features, and framework behavior, and you may help me find where something happens in the repository. Do not write or rewrite code, do not propose a specific fix, and do not tell me the root cause. If I ask for a fix, ask me which hypothesis I want to test instead."

**A full coding agent.** Tools such as Claude Code, Cursor, Codex, or GitHub Copilot's agent mode can edit files and run commands. Practice keeping control:

1. Ask for a plan before any edits, and correct the plan.
2. Delegate one step at a time, and name the files it may change.
3. Have it run the tests after each step.
4. Read every diff before you accept it, and reject suggestions that are wrong.
5. At the end, explain the root cause without the chat open.

These drills are for practice on code that isn't graded. For coursework, follow your course's AI policy.

## Exercises by Skill

Each skill below lists exercises that already exist in the SEBook, followed by new drills that are described in detail in the next section. Tutorials open at the first step (or where you left off), and some unlock later steps only after you pass earlier ones, so the step names below tell you what to aim for.

### Orient Yourself in Unfamiliar Code

* **[Code Comprehension Part 1](/SEBook/development_practices/code-comprehension-tutorial)** trains a reading routine in timed sprints: form a hypothesis about what code does, hunt for clues ("beacons") that confirm or refute it, and verify. Its last step, "Reading Boss: Library Lending Audit," drops you into a ten-file project, tests included, to explain why a lending rule isn't enforced.
* **[Code Comprehension Part 2](/SEBook/development_practices/code-comprehension-advanced-tutorial)** reads tests as specifications ("Tests as Specification Beacons"), follows requests across files, and maps a requirement to the code that implements it ("Architecture-Code Alignment Review"). Its "Cross-Domain Reading Boss: Order Inventory Incident" is the closest SEBook match for the first ten minutes of a repository interview: an eleven-file project, a runnable test, and a budget of three files to read closely.
* **The [Code Comprehension chapter](/SEBook/development_practices/code_comprehension.html)** explains the strategies behind both tutorials.
* **New drill:** Orientation Sprint.

### Debug with Hypotheses

* **[Debugging Python: From Symptom to Fix](/SEBook/tools/python-debugging)** is the closest SEBook match for the debugging round. Its cases ("Maze Pathfinder," "Ledger Reconciliation," and "Course Waitlist") each start from a failing test. You narrow down the problem with a time-travel debugger, targeted logging, and recorded program history, then protect the fix with a regression test. "Debugging Triage" asks you to judge two suggested fixes, and "Independent Case — Article Tags" gives you an unlabeled fault and asks for an evidence log.
* **The [Debugging chapter](/SEBook/development_practices/debugging.html)** covers a four-step debugging process and the Git tools that support it, with a quiz.
* **Two narrated case studies, [Therac-25](/SEBook/development_practices/therac-25.html) and [Cloudflare 2019](/SEBook/development_practices/cloudflare-2019.html),** practice the reasoning side with decision checkpoints: Does this clue explain the whole failure? Does a smaller example still preserve it? Why is fixing one rule not the whole response?
* **New drills:** Bug Swap and Real-Bug Replay.

### Use Tests as Evidence

* **[Testing Foundations](/SEBook/testing/testing-foundations-tutorial)** practices choosing partitions and boundaries, and judging whether a test can fail at all ("Oracle Strength: Strong, Weak, and the Liar Test"). In "Putting It All Together," your tests run against a reference implementation and deliberately broken versions you can't see, much like hidden grading tests.
* **The [TDD Tutorial](/SEBook/testing/tdd-tutorial)** has you write tests that fail for the right reason, and "Cycle 7 — The Next Test → A Hidden Bug" shows why coverage is not correctness.
* **The [Test Doubles Tutorial](/SEBook/testing/test-doubles-tutorial)** opens with "The Test That Lied," a test that passes today and fails tomorrow.
* **The [Playwright Tutorial](/SEBook/tools/playwright-tutorial)** includes "Strong Assertions: The Liar Test in the Browser" and "The Brittleness Gauntlet," where you decide whether a failing test reveals a real regression or a false alarm.
* **The [User Stories chapter](/SEBook/userstories.html)** practices spotting requirements and acceptance criteria that can't be tested, which helps when an interview task arrives as a vague `README`.
* **New drill:** Failing Test First.

### Review Code You Didn't Write, Including AI's

* **[Code Smells & Refactoring](/SEBook/tools/code-smells-refactoring-tutorial):** in "Boolean Anti-Patterns — and the trap that costs you everything," a colleague's tidy-looking simplification silently drops a case, and you expose it with a test. "The Refactoring Memo" asks you to diagnose unfamiliar code, including risks and your confidence, before you change it.
* **The [Modern Code Review chapter](/SEBook/development_practices/modern_code_review.html)** covers how reviewers understand a change, including a section on AI-generated code; its quiz includes an AI agent's 2,000-line pull request that passes all its tests.
* **The [Generative AI in Software Engineering chapter](/SEBook/development_practices/genAI.html)** describes a "supervisor mentality" and what to delegate. Its quiz includes scenarios such as a hallucinated import and an AI that hard-codes expected outputs to make tests pass.
* **New drills:** AI Patch Review and Teach-the-Bot Debugging. The SEBook doesn't yet have an exercise in which you review a complete AI-generated patch, so these drills fill that gap.

### Investigate History and Tools

* **[Advanced Git](/SEBook/tools/git-advanced-tutorial)** covers "git blame: Who Last Changed This Line (and Why)?" and "git bisect: Binary Search for the Commit That Broke Things," and ends with "Capstone: On-Call Debugging Under Pressure," which combines them.
* **[Version Control with Git](/SEBook/tools/git-tutorial)** practices reading history with log, show, and diffs in "Inspecting History."
* **[Shell Scripting](/SEBook/tools/shell-tutorial)** covers pipes and exit codes and ends with "Build a Log Monitor," useful when the evidence is buried in logs.
* **New drill:** Environment Recovery Drill.

### Explain Your Reasoning

* Some SEBook exercises already end in a written explanation: the evidence log and commit message in Debugging Python's "Independent Case — Article Tags," and the memo in Code Smells & Refactoring's "The Refactoring Memo." Say yours out loud, as if to an interviewer.
* **New drills:** Explain-and-Change Mock Interview and Recorded Think-Aloud.

To keep the underlying concepts fresh between drills, use spaced retrieval in the SE Gym: the [debugging, code review, and generative AI quizzes](/se-gym/?quiz=debugging,dev_practice_modern_code_review,dev_practice_genai) and the [code comprehension flashcards](/se-gym/?flashcards=dev_practice_code_comprehension).

## New Drills

### Orientation Sprint (15 minutes)

Pick a small open-source project, ideally in a language you know less well. Set a 10-minute timer and answer five questions in writing:

1. How do I run the project and its tests?
2. Where does a request or command enter the code?
3. For one feature, which files does its path go through?
4. Where is its state stored?
5. Which tests cover that path?

Then spend five minutes checking your answers with a debugger breakpoint or a log statement. **Why it helps:** developers working in unfamiliar code lose a lot of time to navigation and to searches based on misleading clues, and the research summarized in the same study suggests that methodical investigation works better than opportunistic browsing {% cite Ko2006Maintenance %}.

### Bug Swap (with a partner, 60 minutes)

Each partner plants two or three realistic bugs in a small multi-file project they know well: an off-by-one boundary, a missing state update, a wrong condition, an unhandled empty input. Keep a private answer key, plus a test or bug report for each bug. Swap projects and hunt for 45 minutes while thinking out loud. The person who planted the bugs plays the interviewer and answers only questions about intended behavior. In the debrief, discuss which hypotheses were right and which evidence decided it. **Why it helps:** planting bugs makes you think about how they arise, and hunting them under observation rehearses the interview itself. In a classroom report, students created bugs to stump their instructor and then watched the instructor debug them; several noticed that the expert ran the code early and often and followed a systematic process {% cite Kerslake2024StumpTheTeacher %}.

### Real-Bug Replay (60–90 minutes)

Datasets of real, reproducible bugs from open-source projects let you practice on genuine defects: [BugsInPy](https://github.com/soarsmu/BugsInPy) for Python and [Defects4J](https://github.com/rjust/defects4j) for Java. Check out a buggy version, run the test that exposes the bug, and localize the fault without looking at the developer's fix. Then compare your patch with the real one. Expect some setup friction, which is realistic practice too. Some of these bugs are much harder than interview bugs, so start with small projects.

### Failing Test First (20 minutes per bug)

Given a specification and a buggy function, write a test that fails *because of the bug* before you touch the code. You can generate material by asking an AI for a short specification and a subtly buggy implementation, without revealing the bug. Check the specification yourself, because generated exercises can contain mistakes. **Why it helps:** it trains reading a specification and designing a test that tells correct from buggy behavior, the core of reproducing a bug. In a large class, students performed about as well on AI-generated debugging exercises of this kind as on exercises written by the instructor {% cite Padurean2025BugSpotter %}.

### AI Patch Review (30 minutes)

In a project you know, ask an agent to implement a small feature or fix. Before you run anything, review the diff against the checklist from the companion post: Does it solve the stated problem? Does it handle edge cases? Does it call anything that doesn't exist? Does it change more than needed? Did it touch the tests? Does it handle input safely? Will it scale? Write down your predictions, then run the tests and write one new test that targets the riskiest part of the change. **Variant:** ask a separate AI chat to introduce one subtle bug into a working function without telling you where, then find it. **Why it helps:** expert reviewers first build an understanding of what a change does, and only then evaluate it {% cite Goncalves2025 %}, and in a course study, students were able to anticipate likely defects well enough to write useful review checklists of their own {% cite Chong2021ReviewChecklists %}.

### Teach-the-Bot Debugging (20 minutes)

Ask an AI to play a beginner whose function has a bug. You coach the "student": ask what they expected, propose hypotheses, and choose test inputs that tell the hypotheses apart. Run the code yourself rather than trusting the AI's reports of what it outputs.

> "Act as a beginner programmer who wrote the function below and believes it works. It contains a bug. Do not tell me where it is. Answer my questions about what you intended, the way a beginner would. When I propose a cause, ask me which test input would confirm it."

**Why it helps:** explaining forces you to make your hypotheses explicit. In a pre/post evaluation of a system built on this idea, novices who coached an AI-simulated student through debugging improved their debugging test scores by 12% {% cite ma2024hypocompass %}.

### Explain-and-Change Mock Interview (30 minutes)

After any drill, have a friend ask follow-up questions: *Walk me through the root cause. Why is your fix correct? What else could it break? What if the requirement changed to X? How would this behave with a million records?* Then switch roles. **Why it helps:** these are the questions interviewers ask to check ownership, and being watched while you think is a skill of its own. Performance drops markedly under observation for many people {% cite Behroozi2020Stress %}.

### Recorded Think-Aloud (during any drill)

Record your screen and voice. Watch the first ten minutes back and count two things: edits you made without stating a hypothesis, and long stretches of silence in which you didn't say what you were reading. Pick one habit to change in the next session.

### Environment Recovery Drill (20 minutes)

Clone a small project in a framework you haven't used before, such as Spring Boot, Django, or Express. Give yourself 15 minutes to install its dependencies, run its tests, and start it, and write down every command. When something fails, practice deciding quickly whether the error matters for your task. Candidates report losing interview time to exactly this kind of setup problem.

## A Four-Week Plan

The plan assumes roughly four hours per week alongside your classes; skip what you have already mastered. It spaces the skills out, mixes bug types, and moves from no AI to full agents.

### Week 1: Read Before You Write

* **In the SEBook:** Code Comprehension Part 1, then the reading boss in Part 2.
* **New drills:** two Orientation Sprints and one core drill without AI.

### Week 2: Debug Like a Scientist

* **In the SEBook:** the three cases in Debugging Python, and Testing Foundations.
* **New drills:** two Failing Test First exercises, a Bug Swap, and one core drill with a restricted assistant.

### Week 3: Work with the AI, Not for It

* **In the SEBook:** the Boolean trap in Code Smells & Refactoring, and git bisect in Advanced Git.
* **New drills:** two AI Patch Reviews, Teach-the-Bot Debugging, and one core drill with a full agent.

### Week 4: Interview Conditions

* **In the SEBook:** the independent case in Debugging Python, done without AI.
* **New drills:** two timed mock interviews with an observer (one with a restricted assistant, one with a full agent), Explain-and-Change follow-ups, an Environment Recovery Drill, and a Real-Bug Replay.

Keep a debugging log for every bug, in every week. In Week 4, also redo one kind of bug from Week 1 from memory.

Throughout, keep solving two or three algorithm problems per week. Attempt each one without AI first, since many loops still include an AI-free coding round.

## Score Yourself

After each core drill, rate yourself on these six signals. The rubric is my synthesis of the criteria that companies such as Canva, DoorDash, and Coinbase have published; it is not a validated scoring instrument.

| Signal | Needs practice | Interview-ready |
|---|---|---|
| Orientation | Starts editing before knowing where the behavior lives | Describes the relevant path, state, and tests in a few sentences before editing |
| Debugging | Changes code to see what happens | States a hypothesis and a check before each change |
| Verification | Runs tests only at the end and trusts the visible ones | Reproduces with a failing test, adds a regression test, and runs the full suite |
| Working with AI | Pastes in the whole task and accepts the output unread | Gives context and scoped tasks, reads every diff, and rejects wrong suggestions |
| Narration | Works silently or narrates keystrokes | Narrates the plan, the evidence, and each decision |
| Ownership | Can't explain the code the AI wrote | Explains each line and trade-off, and handles "what if" questions |

## What the Research Says About These Drills

* **Debugging process.** A small controlled study found that teaching a systematic debugging process improved debugging performance {% cite Michaeli2019SystematicDebugging %}, a university course built around it reported similar gains {% cite Wilkin2025DebuggingCourse %}, and interviews show that many students lack such a process {% cite Whalley2021NoviceReflections %}.
* **Reading and tracing.** Reading and tracing skills relate to the ability to write code {% cite Lister2004Tracing %}, and tracing with well-chosen inputs helps students explain unfamiliar code {% cite HassanZilles2023Tracing %}.
* **Help versus learning.** Getting a fix from a tool is not the same as being able to find it yourself. The advantage of automated feedback disappeared on exams {% cite Ahmed2020AdaptiveFeedback %}, and developers who learned a library with an AI assistant scored lower on debugging questions afterward {% cite ShenTamkin2026 %}. That is why every drill ends without the AI.
* **Spacing and mixing.** Spreading out practice and testing yourself are among the most robust findings in learning science {% cite dunlosky2013 %}, though they haven't been tested on interview preparation specifically.
* **What we don't know yet.** No study I know of has tested which practice best prepares students for AI-assisted interviews, and employers themselves are still checking whether these formats predict job performance. Treat this plan as a reasoned starting point and adjust it to what you learn from your own drills and interviews.

**Research cutoff:** This post draws on sources published through October 31, 2026.
