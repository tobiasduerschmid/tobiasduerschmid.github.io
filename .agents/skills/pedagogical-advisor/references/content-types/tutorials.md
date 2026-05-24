# Tutorials (Programming, Hands-On, Skill-Based)

This file covers content where the learner is actively *doing* the thing while
being taught — programming tutorials, lab protocols, software walkthroughs,
craft or procedural skill tutorials, problem-solving walkthroughs. The artifact
alternates between explanation/demonstration and learner action.

Tutorials live or die on a specific pattern: the learner must be able to *act
successfully* at each step, with enough support that they don't get stuck, but
with enough real doing that they actually build the skill. Get this wrong in
either direction and the tutorial fails: too much scaffolding produces illusion
of competence, too little produces abandonment.

## What makes a tutorial work

1. **Clear objectives and a credible promise.** The tutorial is upfront about
   what the learner will be able to do at the end. The promise is achievable
   in the stated time.
2. **Honest prerequisites.** It states what the learner needs to know coming in,
   so novices aren't silently dropped when step 3 assumes something from step
   minus-one.
3. **Worked examples as the backbone.** Early in the tutorial, the learner sees
   complete worked-out examples with the *reasoning* visible — not just "type
   this, then this, then this" but "we're doing this because…". This is the
   worked-example effect at its core.
4. **A faded progression.** The support is gradually removed. Fully worked
   example → partially worked (fill in the gap) → independent practice. If every
   step is fully worked, the learner never builds independent skill. If nothing
   is worked, they flounder.
5. **Practice on the right things.** The hands-on tasks actually exercise the
   skill being taught, not tangential skills (fighting with the build system,
   debugging syntax errors unrelated to the concept, etc.).
6. **Desirable difficulties in the right places.** The tutorial is not
   trivially easy — there are moments where the learner has to retrieve, infer,
   or figure out something. But these difficulties are *productive*, targeting
   the skill, not arbitrary obstacles from poor tutorial design.
7. **Feedback at every step.** The learner can verify they're on track — expected
   outputs, state checks, "if you see X, good; if you see Y, here's what might
   be wrong." Feedback is embedded, not deferred to the end.
8. **Manages cognitive load across the session.** New terminology, new tools,
   and new concepts aren't all introduced in the same step. The tutorial
   respects working memory.
9. **Builds schema that transfers.** The learner ends not only having done the
   thing but with a mental model that generalizes. The "why" is made explicit,
   not left implicit in the sequence of actions.

## The most common problems

- **Cargo-cult walkthrough.** A long sequence of "type this, then this" with
  no explanation of why, producing learners who can follow along but can't
  adapt. This looks like a tutorial but is actually a demonstration.
- **Hidden prerequisites.** Step 7 quietly assumes something that was never
  taught. The learner is stuck and doesn't know why.
- **Incidental-difficulty explosions.** The tutorial is ostensibly about
  neural networks but spends the first 40% on environment setup, pip errors,
  and CUDA installation. Cognitive resources meant for the content get burned
  on plumbing.
- **No faded scaffolding.** Every single exercise is fully worked or fully
  independent — no in-between. Learners are never given a task where they have
  to do most of the work themselves with small hints.
- **Paradigm transition failures.** When the tutorial jumps from one way of
  thinking to another (imperative to functional, from statement-level
  programming to reasoning about types, from procedure-following to
  system-thinking), the jump is implicit and learners don't make it.
- **Check-for-understanding drought.** The learner works through 15 steps
  without any cue about whether their mental model is accurate. By the time
  they realize it isn't, they've built on the misunderstanding.
- **Success without understanding.** The "final output" appears correct, so
  the learner (and author) assume the learning happened. Transfer tests fail
  immediately.
- **Non-worked "hello world" tutorials that are actually advanced.** The
  author's mental model says "this is the simplest version" but the simplest
  version uses 3 libraries, 2 build tools, and 4 conventions that a novice
  would need to learn first.
- **"Magic"-heavy code.** Code or steps where a lot happens under the hood
  without acknowledgment. The learner copies it and "it works," but the
  opacity means no mental model forms.

## Diagnostic checklist

**Promise and prerequisites**
- Does the intro clearly state what the learner will be able to do, with
  reasonable time estimate?
- Are prerequisites honestly stated? (If the tutorial assumes prior knowledge,
  it should say so and ideally link to it.)
- Is the audience appropriate for the prereqs stated? ("Beginner-friendly"
  tutorials that quietly assume a lot are among the worst offenders.)
  → `design/learning-objectives.md`

**Worked examples and scaffolding**
- Are there explicit worked examples with visible reasoning — the *why* of
  each step, not only the *what*?
- Does the support fade across the tutorial? Is there a place where the learner
  is asked to do something on their own, with only partial help?
- If the learner asks "how would I do X alone after this tutorial?" — is that
  skill actually built, or only followed along with?
  → `cognition/cognitive-load-theory.md` (worked example effect, faded
  scaffolding), `practices/effective-techniques.md` (self-explanation)

**Cognitive load management**
- How many novel elements are introduced per step? (More than 3–4 interacting
  novel elements in one step is usually too many for a novice.)
- Does the tutorial separate *incidental* complexity (setup, environment,
  tooling) from *essential* complexity (the thing being taught)?
- Is there a structure that keeps intrinsic load from spiking — e.g., concept
  introduced in simplest form first, then elaborated?
  → `cognition/cognitive-load-theory.md`

**Check-for-understanding**
- At each step, can the learner verify their state matches expected?
  (expected outputs, screenshots, state descriptions)
- Are there embedded prompts to self-explain ("before you run it, predict
  what will happen"), which are highly effective for building mental models?
- Are there diagnostic hints for common errors — not "if you're stuck, restart"
  but "if you see this specific error, here's what's probably wrong"?
  → `practices/feedback.md`, `practices/effective-techniques.md`

**Engagement and generation**
- Using ICAP: is the learner ever *constructive* (generating something new in
  their own words / their own code) or only *active* (following instructions)?
  Constructive engagement is where real learning happens.
- Are there moments where the learner is asked to predict, modify, extend, or
  debug — rather than only copy?
- If it's a programming tutorial: is there any code the learner writes from
  a blank slate, with guidance, before independent practice?
  → `practices/icap-engagement.md`

**Paradigm transitions** (relevant for programming and technical tutorials)
- When the tutorial introduces a new way of thinking (not just a new syntax),
  is the transition made explicit?
- Are there contrast examples ("here's how you *used to* think about this;
  here's how we're going to think about it now")?
- Does the tutorial acknowledge where the learner's prior model will lead them
  astray?
  → `practices/variation-theory.md`, `principles/how-learning-works.md`
  (prior knowledge as obstacle)

**Consolidation and transfer**
- At the end, is there a recap that makes the mental model explicit — not
  just "you did it" but "here's what you now understand that you didn't at the
  start"?
- Are there transfer exercises — tasks similar but not identical to the
  tutorial content, that force the learner to generalize?
- Is the reader pointed toward a next step — spaced revisit, related tutorial,
  project they could do with the new skill?
  → `principles/four-pillars.md` (consolidation), `practices/effective-techniques.md`

**Accessibility**
- If code-based, is the code readable with screen readers (proper formatting,
  avoiding ASCII art that doesn't narrate)?
- Are error messages and debugging hints handled in a way that supports
  learners with dyslexia, ESL, or similar?
- Are examples drawn from a variety of contexts, not only narrow ones that
  presume cultural background?
  → `design/universal-design.md`

## Which theory files to read

For most tutorial tasks, load:

1. **`cognition/cognitive-load-theory.md`** — the worked-example effect, the
   expertise reversal effect, faded scaffolding, element interactivity.
   This is the dominant theory for tutorials.
2. **`practices/effective-techniques.md`** — self-explanation, retrieval
   practice, spaced practice, interleaved practice. Tutorials that integrate
   these are dramatically more effective.
3. **`practices/icap-engagement.md`** — pushing learners from active (following)
   to constructive (generating) is the single highest-leverage shift.
4. **`practices/variation-theory.md`** — example design, contrasting cases.

Background:
- `principles/how-learning-works.md` — especially the sections on prior
  knowledge and scaffolding.
- `principles/four-pillars.md`.

Situational pulls:
- Programming tutorial specifically: also consult the `cs-tutorial-design`
  skill (available as `anthropic-skills:cs-tutorial-design`) for CS-specific
  pedagogy — PRIMM, desirable difficulties, worked-example fading in code.
- Tutorials in *this* project (`_data/tutorials/*.yml`): also consult the
  project skill `tutorial-authoring` for the YAML schema, runtime
  constraints (popouts, autosave, time-travel debugger), and the in-browser
  test/hint/quiz machinery. Pedagogical recommendations that can't be
  expressed in that schema are non-actionable here.
- For longer tutorial arcs / courses: add `design/backward-design.md` and
  `design/learning-objectives.md`.
- For tutorials with assessments or capstone projects: add
  `assessment/assessment-principles.md`.
- For live or instructor-facilitated tutorials (workshops, labs, sections):
  add `practical/discussion-and-questions.md` for facilitation moves and
  `practical/group-work.md` if learners work in teams.

## Output format

For critique, use the standard Strengths → Critical → Important →
Refinements → Tradeoffs → Next Steps format. Quote specific sections / steps.

For design, structure as:

```
## Tutorial title
## Learning objectives (what the learner will be able to do)
## Prerequisites (stated honestly)
## Time estimate
## Overall arc (phases — e.g., setup → worked example → guided practice → independent)
## Step-by-step outline, with for each step:
   - What's happening
   - Why (the reasoning the learner needs to hear)
   - Expected state / output at the end of the step
   - Engagement mode (following, predicting, generating)
   - Common failure modes and hints
## Scaffolding fade: where does support get removed? what's the independent
   practice task?
## Consolidation: what's the final synthesis / mental-model payoff?
## Followup: what spaced revisit, what's the next tutorial or project?
```

## When the tutorial is also a reference

Some tutorials double as reference material people look things up in later.
This is a hard tension. Tutorials optimize for learning; references optimize
for retrieval and completeness. Trying to be both usually means being bad at
both.

Flag this if it's happening. The usual recommendation: make the tutorial a
*learning path*, and link to a separate *reference* for lookups. The tutorial's
job is to build the mental model; the reference's job is to be
comprehensive and scannable.
