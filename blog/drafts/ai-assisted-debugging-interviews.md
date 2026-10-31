---
layout: blog-post
title: "[Draft] The New Coding Interview: Debugging Code You Didn't Write, With an AI You Can't Blindly Trust"
date: 2026-10-31
category: "For Students"
permalink: /blog/ai-assisted-debugging-interviews/
# Unlisted draft: this page sits outside the blog collection, so it does not
# appear on /blog/, among featured posts, or in feed.xml. To publish it, move it
# to _blog/ with a date prefix, keep the permalink, and delete `sitemap: false`.
sitemap: false
---

**If companies now let candidates use AI in coding interviews, should you still grind LeetCode? Yes, but it is no longer enough. A growing number of employers hand candidates an unfamiliar codebase, a failing test or bug report, and an AI assistant, and then watch how they find and fix the problem. This post summarizes what we know about these interviews as of October 2026, what they measure, and how to prepare. A companion post turns the advice into [practice exercises, including the ones in the SEBook](/blog/practice-ai-assisted-debugging-interviews/).**

<div class="action-box" markdown="1">
## The Short Version

* **Keep practicing data structures and algorithms.** Many interview loops still include them, often alongside the new AI rounds.
* **Add practice on code you did not write.** Orient yourself, reproduce the failure, form hypotheses, test them, make the smallest fix, and explain it.
* **Treat every AI answer as a draft.** Use the assistant to navigate code and suggest hypotheses, then check what it says with tests and your own reading.
* **Use tests as evidence.** Reproduce the bug with a failing test and keep that test as a regression test.
* **Narrate and own your work.** Be ready to explain every line you submit, whoever typed it.
* **Ask about the rules for each round.** Which AI you may use, and what it is allowed to do, varies between companies and between rounds at the same company.
</div>

## What Is Changing, and What Is Not

Since mid-2025, several companies have publicly redesigned at least one technical interview round around work that looks like everyday software engineering: reading an existing codebase, debugging code someone else wrote, running tests, and using AI tools under explicit rules.

| Employer | What changed | Kind of evidence |
|---|---|---|
| Canva | Replaced its Computer Science Fundamentals screen with an AI-assisted coding interview for backend and frontend roles, after AI tools solved its old questions in seconds ([announcement](https://www.canva.dev/blog/engineering/yes-you-can-use-ai-in-our-interviews/), [interviewer guide](https://www.canva.dev/blog/engineering/ai-interview-success/)). | Company engineering blog |
| Meta | Was reported in July 2025 to be testing an AI-assisted coding interview for some candidates ([404 Media](https://www.404media.co/meta-is-going-to-let-job-candidates-use-ai-during-coding-tests/)). Interview-prep sites, drawing on conversations with candidates, describe a one-hour, multi-file project with stages such as fixing a bug, building the main feature, and handling larger inputs ([Hello Interview](https://www.hellointerview.com/blog/meta-ai-enabled-coding)). | Press report; details from prep sites |
| DoorDash | Replaced traditional coding rounds with a 60-minute AI-assisted working session in the candidate's own development environment, with every AI feature allowed, from chat to autonomous agents ([announcement](https://careersatdoordash.com/blog/doordash-is-rebuilding-its-engineering-interviews-around-ai/)). | Company careers blog |
| Coinbase | Added debugging and code review questions set in a realistic repository with AI available, and now looks for "AI fluency" at every interview stage, including an understanding of AI's limits for privacy and security ([retrospective](https://www.coinbase.com/en-nl/blog/interviewing-engineers-in-the-ai-era-lessons-from-a-year-of-rebuilding)). | Company blog |
| Shopify | Evaluates technical talent with three modes borrowed from the University of Waterloo: no AI allowed, AI optional, and AI mandatory. Shopify says it is still figuring this out ([internship site](https://internships.shopify.com/pages/zero-experience-infinite-leverage)). | Company internship site |
| Box | Screens interns and other early-career candidates with a TypeScript debugging exercise in a full repository with an AI assistant; candidates don't need to know TypeScript beforehand ([case study](https://coderpad.io/case-study/how-box-found-stronger-hiring-signals-with-coderpad-and-ai/)). | Recruiter quotes in a vendor case study |
| Amazon | Says its software engineering assessments now include an interactive AI assistant ([Amazon](https://www.aboutamazon.com/news/workplace/artificial-intelligence-resume-jobs-hiring-amazon)). Internship candidates describe a one-hour section fixing several bugs in a multi-file project, in a stack they choose (such as Spring Boot, Express, Django, or C++). The assistant helps them navigate but won't write the fix, and the section comes alongside a traditional algorithm problem ([example report](https://leetcode.com/discuss/post/8550664/amazon-sde-i-intern-interview-experience-0gxv/)). | Company post; details from candidates |
| Google | Began piloting a "code comprehension" interview in which candidates use Gemini to read, debug, and optimize existing code, first for junior to mid-level roles on select teams in the United States ([May 2026](https://www.businessinsider.com/google-job-interview-software-engineers-ai-assistant-coding-2026-5)). By October, the format had expanded but was still called a pilot ([October 2026](https://www.businessinsider.com/google-interview-process-ai-gemini-coding-comprehension-software-engineer-2026-10)). | Press reports on internal documents, confirmed by Google |

At the same time, the classic coding round has **not** disappeared. [Microsoft](https://careers.microsoft.com/v2/global/en/hiring-tips.html), [Anthropic](https://www.anthropic.com/candidate-ai-guidance), and [LinkedIn](https://careers.linkedin.com/Howwehire/ai-usage) tell candidates not to use AI during interviews unless the instructions explicitly allow it. [Datadog](https://careers.datadoghq.com/candidate-experience/interviewing-at-datadog-ai-guidelines/) runs AI-assisted coding interviews for some roles and keeps its other technical interviews AI-free unless stated otherwise. Even DoorDash's [general guidance](https://careersatdoordash.com/blog/doordash-stance-ai-interviewing/) still says not to use AI in live interviews unless the interviewer invites you to; its AI-assisted session is the explicit exception. Candidates who took Amazon's new assessment report that it came with a conventional algorithm problem, and some later faced algorithm questions in live interviews.

The numbers point the same way. In [CoderPad's 2026 survey](https://coderpad.io/survey-reports/coderpad-state-of-tech-hiring-2026/) of about 650 developers, recruiters, and hiring managers, 34% of recruiters and hiring leaders said AI is not allowed in their interviews, 29% allowed it with constraints, 20% decided case by case, and 17% allowed it broadly. In [Interview Query's analysis](https://www.interviewquery.com/p/ai-in-technical-interviews-2026-data) of about 60,000 technical interview reports, the share mentioning AI rose from 1.6% in early 2025 to 7.2% in the third quarter of 2026, but dedicated AI-assisted coding rounds still appeared in only about 1% of reports. In software engineers' firsthand reports from 2026, about half (52%) still involved algorithm questions. Neither source is a representative sample of all employers, and Interview Query's keyword-based counts are lower bounds. The direction is still clear: companies are adding AI rounds next to algorithm rounds rather than replacing them.

So the most accurate summary is: ==the set of skills that interviews test is growing, not being replaced.== You need enough independent programming and algorithm skill to reason without help and to notice when generated code is wrong. You also need the engineering skill to work in unfamiliar code with AI tools.

## What These Rounds Look Like

"AI interview" covers several different formats, and they reward different preparation:

| Format | What you do | What the AI can do |
|---|---|---|
| Traditional coding, no AI | Solve a self-contained problem from a blank editor. | Nothing; AI use is not allowed. |
| Coding with an assistant | Implement a solution while an AI chat is available; interviewers watch how you use it. | Answer questions and suggest code, but you type or paste every line. |
| Repository debugging | Find and fix bugs in an unfamiliar multi-file project, often until failing tests pass. | Often restricted: explains code and errors and helps you navigate, but won't write the fix. |
| Agentic engineering | Plan, implement, and test a fix or feature in a starter project. | A full coding agent that can edit files and run commands. |

The details vary, but the starting package usually includes a task description or `README`, an unfamiliar codebase, a way to run the code and its tests, and an AI assistant whose powers depend on the employer. The codebase is usually **bounded**, not a million-line monolith. DoorDash's first version was an order management system with three communicating services, and many candidates spent 15 to 20 minutes of the hour just exploring it, so the company moved to smaller, focused projects. What is often **not** guaranteed: architecture documentation, internet access, your choice of model, or an assistant that can edit files.

Tests deserve special attention. Repository tasks often score you by how many checks pass, and assessment platforms such as HackerRank support **hidden** tests that are added only when your submission is scored ([HackerRank documentation](https://support.hackerrank.com/articles/1626384486-hidden-test-cases-for-front-end%2C-back-end-and-full-stack-questions)). Passing the tests you can see is necessary but not sufficient.

Your conversation with the assistant can be part of the record, too. HackerRank, for example, shows the full AI chat to the people evaluating you ([candidate documentation](https://candidatesupport.hackerrank.com/articles/7634558376)), so your prompts are evidence of how you think. Some platforms go a step further: in October 2026, HackerRank released an AI interviewer that asks follow-up questions while candidates work in a repository with an AI assistant ([TechCrunch](https://techcrunch.com/2026/10/05/hackerranks-ai-interviewer-offers-a-glimpse-into-what-job-interviews-could-become/)).

Finally, the bug itself is often small; ==finding it is the hard part.== One Amazon internship candidate described a Django support-desk app with six tests, in which new tickets weren't being added and users couldn't reply to tickets ([report](https://leetcode.com/discuss/post/8523471/)). Bugs like these can come down to one or two lines. The real work is locating them among dozens of files, confirming what the correct behavior should be, and showing that the fix doesn't break anything else. (That candidate passed two of the six tests and was still invited to the next round. It is one anecdote, but a reminder that partial progress can count.)

## What Interviewers Look For

Across the companies that have described their criteria, six signals keep coming up:

1. **Orientation.** You quickly build a working mental model of unfamiliar code: where a request enters, where the business logic lives, where state is stored, and which tests cover it.
2. **Hypothesis-driven debugging.** You reproduce the problem, state what you think is wrong, and run checks that tell your hypotheses apart, instead of editing until something passes.
3. **Verification.** You test behavior, boundaries, and regressions, and you know that the visible tests are not the whole grading story.
4. **Directing and reviewing AI.** You give the assistant relevant context and well-scoped tasks, inspect what it produces, and reject suggestions that are wrong.
5. **Ownership.** You can explain and defend every line you submit, regardless of who or what typed it.
6. **Judgment about when not to use AI.** Shopify's "AI optional" mode asks exactly this: do you know when to reach for AI and when to push your own thinking further? Sometimes changing one line yourself is faster than writing a prompt about it.

When CoderPad asked hiring leaders what shows real skill when AI is allowed, the most common answers were **catching and fixing AI mistakes (66%)** and **explaining trade-offs and correctness (56%)**. Canva's interviewer guide describes both sides. Strong candidates plan before they prompt, stop to evaluate complex or unfamiliar suggestions, keep their code at pull-request quality, and can explain every decision. Weak patterns include racing through features by accepting AI output too quickly and going "hands-off" by delegating too much. Canva's original announcement adds that the strongest candidates debugged effectively when an AI-generated solution had problems.

## Why Your Fundamentals Matter More with AI, Not Less

These interviews probe a gap that research has documented again and again: AI makes it cheap to produce plausible code, but not to know whether that code is correct.

* **"Almost right" is the typical failure.** In Stack Overflow's 2025 developer survey, the most common frustration with AI tools was solutions that are "almost right, but not quite" (66% of respondents), and 45% said debugging AI-generated code takes more time ([survey results](https://survey.stackoverflow.co/2025/ai)).
* **Plausible code can pass weak tests.** When researchers added many more tests to a popular benchmark, the measured success rates of AI-generated solutions dropped by up to 19–29% {% cite Liu2023EvalPlus %}. One of their examples sorted a list and then converted it to a set, silently losing the order. It looked right and passed the original tests.
* **Assistance can make people overconfident.** In a controlled study, participants with an AI assistant wrote less secure code than those without one, and were *more* likely to believe their code was secure {% cite Perry2023Insecure %}.
* **Feeling faster is not the same as being faster.** In a randomized trial, experienced open-source developers took 19% longer on real tasks when they were allowed to use AI tools. Afterward, they still believed AI had sped them up by about 20% {% cite Metr2025 %}.
* **Leaning on AI while learning can skip the practice that builds debugging skill.** In a randomized study, 52 mostly junior developers learned an unfamiliar Python library with or without an AI assistant. The AI group scored 17 percentage points lower on a follow-up quiz taken without AI, and the largest gap was on debugging questions {% cite ShenTamkin2026 %}. In observational studies, some students who solved problems with AI tools left with an unwarranted sense of competence {% cite Prather2024WideningGap %}, and others got stuck pasting wrong code back into the chat and asking for yet another fix {% cite RaheMaalej2025 %}.

That is the gap an AI-assisted interview is designed to expose. If the assistant's suggestion is wrong, can you tell? And can you show *why*, with evidence?

## How to Prepare: Eight Habits

### 1. Follow a Debugging Process Instead of Guessing

Experienced developers debug roughly the way scientists work: observe the failure, form a hypothesis, predict what an experiment will show, run it, and refine {% cite Zeller2009WhyProgramsFail %}. Many students, by contrast, describe their process as guessing and adding print statements {% cite Whalley2021NoviceReflections %}. The process can be taught. In a small study with two high-school classes, students who were shown a systematic debugging process for about ten minutes fixed more bugs on the post-test than a class that only kept practicing (a median of 4 versus 2 out of 9 bugs), and they also felt more capable {% cite Michaeli2019SystematicDebugging %}. A university course built around systematic debugging reported similar gains, though without a comparison group {% cite Wilkin2025DebuggingCourse %}.

Keep a short debugging log during practice, and narrate the same structure in interviews:

* **Symptom:** What fails, and how do I reproduce it?
* **Expected:** What should happen instead, and where does that expectation come from?
* **Hypotheses:** Two or three candidate causes, most likely first.
* **Experiment:** A check that tells the hypotheses apart, and its result.
* **Root cause:** What actually went wrong, and why.
* **Fix and test:** The smallest change, and the test that now protects it.

**A rule of thumb:** if two AI-suggested fixes in a row fail, stop asking for fixes. Go back to the evidence: re-read the failing test, reproduce the problem, and test one hypothesis yourself. (This two-strike rule is my own heuristic, not a research finding; it targets the fix loops described above.)

### 2. Orient Yourself Before You Edit

In a classic study of developers working in an unfamiliar program, people spent about 35% of their time just navigating between pieces of code, and many searches failed because they followed misleading clues in names and comments. The earlier research summarized in the same paper found that methodical investigation, such as following dependencies with a plan and writing notes, works better than opportunistic poking around {% cite Ko2006Maintenance %}. Before you change anything, spend a few minutes building a map:

1. Read the task and the `README`. Restate the expected behavior in your own words.
2. Run the tests and the app. Note what fails.
3. Find the entry point for the failing behavior (a route, command, or test) and trace its path through the layers, for example from controller to service to storage.
4. Note where state is created, changed, and read.
5. Write the map down in three to five lines, and say it out loud.

When a piece of code is unclear, trace it by hand or in a debugger with a concrete input. Choose inputs that exercise the behavior you care about: in think-aloud studies, students who traced code with well-chosen inputs could explain code they had otherwise misread {% cite HassanZilles2023Tracing %}, and reading and tracing skills are widely seen as precursors to writing code {% cite Lister2004Tracing %}. You may also face a language you don't know well. Box says outright that its debugging exercise doesn't require prior TypeScript knowledge.

### 3. Make Tests Your Evidence

* **Run the tests first,** and read the failing assertions as part of the specification.
* **Reproduce the bug with a failing test before you fix it,** then keep that test as a regression test.
* **Remember the hidden tests.** Ask what *else* your change could break, and run the full test suite, not just the test you fixed.
* **Don't let the AI fix the test instead of the code.** In one study of test-driven development with AI, the assistant sometimes changed the tests rather than the production code to make them pass {% cite Mock2025GenAITDD %}. Check every diff for edited or weakened assertions.
* **Ask where the expected value comes from.** A test's expected value should come from the specification, not from what the code currently does or what the AI asserts.

Tests are also your best tool for judging AI-generated code. In a small user study with 15 programmers, those who checked generated tests against their intent were significantly more likely to judge AI-generated code correctly, and reported less mental effort {% cite Fakhoury2024TiCoder %}.

### 4. Use the AI as a Navigator and Hypothesis Generator

Interview assistants are often restricted. Amazon candidates describe an assistant that answers questions about files and syntax but refuses to write the fix. Prompts that ask for **understanding** work in every mode:

* "Which files and functions are involved when a user creates a ticket? Don't suggest changes yet."
* "Here are the failing test and the stack trace. List three possible causes, most likely first, and a check that would tell each one apart."
* "What does this function return when the ticket is closed? Point me to the lines."
* "What does this framework annotation do?"

When you have a full agent, plan first and delegate in small, checkable steps: "Propose a plan, but don't edit any files yet," then "Implement step 1 only, change only `ticket_service.py`, and run the tests." Avoid pasting the whole task with "fix everything." That gives up both control and the evidence an interviewer wants to see. In the randomized study above, participants who asked conceptual questions, or asked for explanations along with generated code, scored better on the later quiz than those who handed all the coding to the AI or used it mainly to debug. That pattern comes from small groups and shows an association, not a cause, but it matches what interviewers say they reward {% cite ShenTamkin2026 %}.

### 5. Review Every AI Change Like a Pull Request

Read the diff before you run it, and predict what it will do. Expert code reviewers first build an understanding of what a change does, and only then evaluate it {% cite Goncalves2025 %}. Look especially for the mistakes AI tends to make:

* It solves a slightly different problem than the one in the task.
* It misses edge cases: empty input, boundaries, duplicates, time zones, concurrent updates.
* It calls functions, fields, or library methods that don't exist.
* It changes more than necessary, or rewrites code you didn't ask it to touch.
* It edits tests, weakens assertions, or swallows errors to make something pass.
* It introduces security problems, such as missing input validation or exposed secrets {% cite Perry2023Insecure %}.
* It works on small inputs but fails at scale. Meta candidates describe follow-up stages with much larger inputs.

### 6. Think Out Loud, and Rehearse Being Watched

Interviewers can't grade reasoning they can't see, and some formats make narration explicit: DoorDash candidates share their screen and talk through their work. So narrate: *"The failing test says the new ticket is saved but missing from the list. I'll trace the create path and the list path before changing anything."* Being observed is a skill of its own. In one experiment with 48 students, those who solved a problem at a whiteboard in front of an interviewer performed about half as well as those who solved it in private {% cite Behroozi2020Stress %}. A follow-up study found more signs of stress and less informative explanations under live observation {% cite Behroozi2022Async %}. So rehearse with a friend watching, or record yourself. Also practice saying *"Let me read this for a moment,"* and then thinking quietly. Silence while you read is fine.

### 7. Own and Explain Every Line

Shopify's internship site puts it plainly: whoever submits a pull request owns the code in it, no matter which AI tools helped. Interviewers apply the same standard to your solution. Before you call a fix done, make sure you can answer three questions without looking at the AI chat: *Why does this fix work? What else could it break? What would change if the requirement changed?* Some university courses now use similar short "code interviews" to check that students understand the code they submitted {% cite Kannam2025CodeInterviews %}. They make good practice, too.

### 8. Learn the Rules of Each Round, and Rehearse the Environment

Ask your recruiter:

* Which AI tools may I use? Can the assistant edit files or run commands?
* Will I work in my own development environment or in a browser? Can I run the code and the tests?
* Which languages or frameworks can I choose? Will I have internet access?
* Is there a practice environment? According to interview-prep guides, Meta offers one to scheduled candidates.
* If you need an accommodation, such as extra time or assistive tools, ask early. DoorDash, for example, asks candidates to raise accommodation needs with their recruiter at the start.

Then rehearse in that setup, including with an unfamiliar framework. Candidates report losing real time to build and dependency problems, for example in a Spring Boot project. And never use AI in a round where it isn't allowed: some companies, DoorDash among them, say they may disqualify candidates who do.

## Claims to Be Skeptical Of

* **"LeetCode is dead."** Algorithm rounds remain common, often in the same loop as the new formats.
* **"Every company lets you use AI now."** The rules differ by company, role, and round.
* **"You will debug a giant production codebase."** Most repository tasks use a bounded multi-file project designed to fit into an hour.
* **"The AI writes the code and you supervise."** That describes only the agentic formats; restricted assistants refuse to write fixes.
* **"Prompt engineering is the new coding."** Employers emphasize understanding, testing, reviewing, and explaining. Prompting is one skill among them.
* **"The new formats are proven to predict job performance."** Companies such as Coinbase and Shopify say they are still learning what predicts success.

## How Strong Is This Evidence?

Employer blog posts describe what companies say they do, not how well it works. Candidate reports on Reddit and LeetCode are anecdotes, and their details vary from candidate to candidate. Most of the research studies above are small or short-term. Still, these sources all point the same way: ==interviews increasingly test whether you can understand, verify, and take responsibility for code you did not write, while using the tools engineers actually use.== That is also what the job increasingly looks like.

**Ready to practice?** The companion post, [Practice for AI-Assisted Debugging Interviews](/blog/practice-ai-assisted-debugging-interviews/), maps each habit to SEBook exercises and to new drills you can start this week.

**Research cutoff:** This post draws on sources published through October 31, 2026. Interview formats change quickly, so confirm the current process with your recruiter.
