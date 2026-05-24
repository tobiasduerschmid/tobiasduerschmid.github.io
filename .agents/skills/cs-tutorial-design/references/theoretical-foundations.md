# Theoretical Foundations: Deep Dive

This reference provides detailed research backing and implementation guidance for the
theoretical frameworks in the main SKILL.md. Read this when you need to explain *why*
a particular design choice is effective, when justifying pedagogical decisions to
stakeholders, or when designing at depth.

## Table of Contents
1. [Bloom's Revised Taxonomy — Full Verb Table](#blooms-revised-taxonomy)
2. [Desirable Difficulties — Research Details](#desirable-difficulties-research)
3. [Component Skills & Integration — Diagnosis & Strategy](#component-skills)
4. [Growth Mindset — Intervention Design](#growth-mindset-interventions)
5. [Cognitive Load Theory — Element Interactivity](#cognitive-load-details)
6. [Active Learning Meta-Analysis](#active-learning)

---

## Bloom's Revised Taxonomy

### The Two-Dimensional Framework

Anderson & Krathwohl (2001) revised Bloom's original taxonomy into a matrix crossing
six cognitive process levels with four knowledge types. This is a major advance over
the original, which conflated levels of knowing with forms of knowledge (Hattie, 2009).

**Cognitive Process × Knowledge Type Matrix:**

| Knowledge Type | Remember | Understand | Apply | Analyze | Evaluate | Create |
|---------------|----------|------------|-------|---------|----------|--------|
| **Factual** | list | summarize | classify | order | rank | combine |
| **Conceptual** | describe | interpret | experiment | explain | assess | plan |
| **Procedural** | tabulate | predict | calculate | differentiate | conclude | compose |
| **Metacognitive** | appropriate use | execute | select strategy | change strategy | reflect | invent |

*(Source: Anderson & Krathwohl, 2001, adapted in Woolfolk, 2019)*

### Action Verbs for Writing CS Learning Objectives

| Level | Verbs | CS Example Objectives |
|-------|-------|----------------------|
| **Remember** | define, list, name, recall, recognize, state, identify | "List the primitive data types in JavaScript" |
| **Understand** | explain, paraphrase, compare, contrast, classify, summarize | "Explain the difference between `let` and `const`" |
| **Apply** | implement, solve, use, execute, construct, demonstrate | "Implement a binary search on a sorted array" |
| **Analyze** | compare, debug, decompose, differentiate, examine, diagram | "Analyze why this recursive function causes a stack overflow" |
| **Evaluate** | critique, justify, recommend, assess, judge, select | "Evaluate whether SQL or NoSQL is more appropriate for this use case" |
| **Create** | design, build, compose, formulate, generate, integrate | "Design a caching strategy for this API endpoint" |

### Backward Design with Bloom's (Understanding by Design)

Wiggins & McTighe (2006) formalized "backward design":
1. **Identify desired results** — What should learners be able to do? (Use Bloom's to
   specify the cognitive level precisely.)
2. **Determine acceptable evidence** — What would demonstrate understanding?
   Design assessments *before* designing instruction.
3. **Plan learning experiences** — Design activities that build toward the assessment.

**For CS tutorials:** Write the final project/assessment first. Then ask: "What skills
and knowledge must learners have to succeed at this?" Decompose into component skills.
Design exercises that build each component. This prevents the common trap of teaching
a lot of content that doesn't connect to anything the learner actually does.

---

## Desirable Difficulties Research

### The Core Paradox

Conditions that make performance *appear* better during learning (fluency, ease,
speed) often produce *worse* long-term retention. Conversely, conditions that slow
down learning and increase errors during training often produce *superior* long-term
retention and transfer (Bjork & Bjork, 2011).

This is why learner satisfaction surveys are poor proxies for learning. Learners often
rate easy, fluent instruction highest—even when harder instruction produces better
outcomes. Tutorial designers must resist the temptation to optimize for "how easy
did this feel?" and instead optimize for "can the learner perform independently
after a delay?"

### Spacing: The Numbers

The distributed-practice effect is one of the most replicated findings in psychology.
Cepeda et al. (2006) reviewed 254 studies with over 14,000 participants. Key findings:

- Students recalled 47% of material after spaced study vs. 37% after massed study.
- The optimal lag between sessions is approximately 10–20% of the desired retention
  interval (Cepeda et al., 2008):
  - Retain for 1 week → space 12–24 hours apart
  - Retain for 1 month → space 2–4 days apart
  - Retain for 1 year → space 3–5 weeks apart
  - Retain for 5 years → space 6–12 months apart
- The effect is *larger* on delayed tests than immediate tests. Cramming may produce
  short-term gains that mask long-term losses.

**For multi-week CS courses:** Build a review schedule into the syllabus. Each week's
problem set should include ~30% review problems from prior weeks. This is more
effective than a single "review session" before the final exam.

### Retrieval Practice: The Numbers

Roediger & Karpicke (2006) compared study-study-study vs. study-test-test:
- After 5 minutes: study-study-study group performed slightly better
- After 1 week: study-test-test group recalled 50% more material

Dunlosky et al. (2013) rated practice testing as "high utility" — one of only two
techniques to receive this rating (the other being distributed practice).

**For tutorials:** Replace "re-read the docs" with "close the docs and try to
reconstruct what you learned." Every moment of passive review is a missed opportunity
for active retrieval.

### Interleaving: When and Why

Rohrer & Taylor (2007) found interleaved math practice produced 43% higher test scores
than blocked practice. The benefit comes from forcing learners to *discriminate*
between problem types and select the appropriate strategy—a skill that blocked
practice never develops because the strategy is always given implicitly by the block.

**When interleaving helps most:**
- When the problem types are superficially similar but require different strategies
- When the goal is to develop *selection* skill, not just *execution* skill
- When learners already have basic competence with each individual skill

**When interleaving may hurt:**
- When learners are complete beginners who haven't yet learned the individual skills
- When total cognitive load exceeds capacity (interleaving adds discrimination load)
- When the skills being interleaved are unrelated (no discrimination benefit)

### Generation: Pre-Testing and Productive Failure

The generation effect shows that attempting to produce an answer—even incorrectly—
leads to better subsequent learning of the correct answer than simply reading it
(Slamecka & Graf, 1978). This extends to "productive failure" (Kapur, 2008): students
who attempt complex problems before instruction learn more from subsequent instruction
than students who receive instruction first.

**Why it works:** The attempt activates relevant prior knowledge, highlights gaps in
understanding, and creates a "schema" with open slots that instruction can then fill.

**For tutorials:** The "try first, then teach" pattern. Before explaining how closures
work, give a challenge that requires them. Learners will struggle and fail—this is by
design. When you then explain closures, the explanation lands in prepared soil.

---

## Component Skills

### The Expert Blind Spot Problem

Experts operate in "unconscious competence" (Ambrose et al., 2010). They have
automated so many sub-skills that they literally cannot see them anymore. When experts
teach, they inadvertently skip steps they're not aware of performing. The result is
that tutorials seem to "jump" for novices.

**The four stages of competence:**
1. **Unconscious incompetence** — Don't know what you don't know (beginner)
2. **Conscious incompetence** — Aware of gaps (motivated learner)
3. **Conscious competence** — Can do it with effort (intermediate)
4. **Unconscious competence** — Automated (expert / potential teacher blind spot)

**Practical fix:** Have someone at Stage 2 or 3 review your tutorial. Teaching assistants
and junior developers are better reviewers than senior engineers for this purpose.

### Task Decomposition for CS Skills

Example decomposition for "Build a full-stack web application":

**Level 1 (Macro):**
- Frontend (HTML/CSS/JS)
- Backend (Server, routes, logic)
- Database (Schema, queries)
- Deployment
- Testing

**Level 2 (Component):**
- Frontend → Layout structure, Responsive design, Event handling, State management,
  API integration, Form validation, Routing
- Backend → Route definition, Request parsing, Business logic, Error handling,
  Authentication, Middleware
- Database → Schema design, CRUD queries, Migrations, Indexing

**Level 3 (Sub-component):**
- Event handling → addEventListener, Event object properties, Event delegation,
  Preventing default, Custom events

**Key insight from research (Lovett, 2001):** Identify the *specific* component that's
causing failure. Don't make learners repeat the entire complex task—give them targeted
practice on the weak component. 45 minutes of focused component practice can produce
gains equivalent to a full semester of unfocused practice.

### Integration Strategies

When learners can do each component but struggle to combine them:

1. **Temporarily constrain scope:** Like a piano teacher having students practice
   hands separately, then combining for just a few measures
2. **Increase fluency first:** If a component requires conscious effort, it consumes
   working memory needed for integration. Drill until the component is automatic.
3. **Use worked examples of integration:** Show how components fit together with
   explicit annotations at the integration points
4. **Explicitly include integration in assessment criteria:** "The API routes work
   correctly" is component-level. "The frontend correctly calls the API and handles
   loading, success, and error states" is integration-level.

---

## Growth Mindset Interventions

### The Research Base

Dweck & Molden (2017) summarize decades of research showing that mindsets form the
core of motivational "meaning systems." Fixed and growth mindsets are roughly equally
prevalent (~40% each, 20% undecided) and have minimal correlation with actual ability.

**The meaning system cascade:**
- **Fixed mindset →** Performance goals → Effort = low ability → Ability attributions
  for failure → Helpless strategies → Declining grades
- **Growth mindset →** Learning goals → Effort = path to mastery → Strategy
  attributions for failure → Mastery-oriented strategies → Improving grades

In the Blackwell et al. (2007) study, students with growth vs. fixed mindsets entered
junior high with equivalent math achievement, but their grades increasingly diverged
over the 2-year study period. Growth mindset students earned higher grades after only
one term, and the gap widened over time.

### Intervention Design for CS Contexts

**Scalable interventions that have shown measurable effects:**

1. **Teach the neuroscience of learning (30–45 min):** Explain neuroplasticity—that
   the brain physically changes with practice. Show that "talent" is largely the
   result of sustained deliberate practice. This has been shown to improve grades
   in multiple studies (Blackwell et al., 2007; Paunesku et al., 2015).

2. **Normalize difficulty with data:** "70% of professional developers report feeling
   like impostors. Here's a study showing that confusion is a *necessary* part of
   deep learning." Concrete data is more persuasive than platitudes.

3. **Reframe error messages:** In CS, error feedback is constant and can feel harsh.
   Explicitly reframe: "This isn't telling you that you failed—it's telling you
   exactly what to fix. It's the most helpful debugging partner you have."

4. **Use "yet" language:** "You can't do this *yet*" frames current inability as
   temporary. Build this into automated feedback in interactive tutorials.

5. **Share struggle stories:** Describe your own learning struggles authentically.
   "I spent three days on a bug that turned out to be a missing comma. That's normal."

**What NOT to do:**
- Don't praise intelligence: "You're so smart!" reinforces fixed mindset.
- Don't tell learners "it's easy!"—this makes them feel worse when they struggle.
- Don't conflate growth mindset with "just try harder"—strategy matters too.

---

## Cognitive Load Details

### Element Interactivity

Intrinsic cognitive load is determined not by the raw number of elements but by how
many elements *interact* and must be processed simultaneously (Sweller, 1994).

- **Low element interactivity:** Learning vocabulary (each word is independent).
  These items can be learned one at a time.
- **High element interactivity:** Understanding a recursive algorithm (base case,
  recursive call, call stack, return values all interact). All elements must be
  held in mind simultaneously.

**Implication for tutorials:** For high-interactivity material, use the part-whole
approach—first teach individual elements, then gradually combine them. For
low-interactivity material, go ahead and present multiple items at once.

### The Split-Attention Effect

When learners must mentally integrate information from multiple separated sources
(e.g., code on one screen and explanations on another), extraneous load increases.
Physically integrate related information: put comments inline with code, place
diagrams adjacent to the text they illustrate, use tooltips over code rather than
footnotes at the bottom.

### The Expertise Reversal Effect

Instructional techniques that help novices can *hurt* experts, and vice versa
(Kalyuga et al., 2003). Worked examples help beginners but become redundant for
advanced learners who need the challenge of independent problem-solving. Fading
is the bridge: start with full worked examples and progressively remove scaffolding
as expertise develops.

---

## Active Learning

### The Freeman et al. (2014) Meta-Analysis

The largest meta-analysis of undergraduate STEM education found:
- Active learning increased exam scores by 0.47 SD (equivalent to moving from
  the 50th to the 68th percentile)
- Active learning decreased failure rates by 55% (from 33.8% to 21.8%)
- Effects were consistent across STEM disciplines, class sizes, and course levels

**For CS tutorials:** Every minute of passive reading/watching is less effective than
a minute of active doing. Structure tutorials so learners are coding, predicting,
debugging, or explaining at least every 5–10 minutes. Freeman et al.'s findings
suggest that traditional "lecture first, practice later" is substantially inferior
to interleaved instruction where explanation and active practice alternate.
