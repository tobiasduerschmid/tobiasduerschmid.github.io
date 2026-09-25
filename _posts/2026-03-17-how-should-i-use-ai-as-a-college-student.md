---
layout: blog-post
title: "[Draft] How Should I Use AI as a College Student? — A Science-Backed Guide for CS Students"
date: 2026-09-24
category: "For Students"
featured: true
image: "/img/genai.jpg"
permalink: /blog/how-should-i-use-ai-as-a-college-student/
image_alt_text: "Student working on a computer with a robot sitting next to him. They both look at a digital screen. University buildings in the background. Soft evening light"
---

**Many of my students come to me with this wonderful question: ==*"How can I leverage AI as a tool to supercharge my education without accidentally outsourcing my own intelligence?"*==
In my opinion, this will fundamentally impact how much the current generation of college students will take out of their educational experience, because AI capabilities are growing at a very fast pace. 
In Math, within just four years, AI has grown from barely passing grade school math tests to [solving the hardest math problems](https://openai.com/index/navier-stokes-solution/) that the world's leading experts were unsuccessfully trying to solve for decades. 
My baseline expectation is that this progress [will continue across STEM](https://openai.com/index/an-alien-mind/ "'Based on internal results, I have a strong expectation that this speed of progress could be sustained into recursive self-improvement' - Jakub Pachocki, Chief Scientist at OpenAI"), raising the bar on entry-level positions every year. 
To help students prepaire for this scenario, I decided to write my advice down in a succinct, evidence-based post for everyone.**

## Motivation: Build the Skills to Use AI Well
It’s 7:00 PM on a Friday. Your friends want to watch a movie, but you’re stuck resolving a Git merge conflict in your group project. You and a teammate changed the same section of a file. Keeping your version would lose their changes; keeping theirs would lose yours. You’ve spent an hour figuring out how to combine them, and the temptation to paste the conflict into AI and just prompting it “fix this” is overwhelming.
A professional might just ask AI for a fix. So why should you not just take this tempting short cut? 
Because skipping the learning phase means you're not growing your skills --- the main goal of education!

Several studies point to a useful lesson for your degree: ==strong technical skills can help you get more out of AI== {% cite hitzig2026agentic DORA2025 Paradis2025 Ma2026 Prather2024WideningGap %}.
In Google's study of professional developers, those with *stronger coding foundations* and *more system design experience* gained more speed from AI tools {% cite Paradis2025%}.
The DORA report describes a similar pattern in teams: AI can strengthen good working habits, but it can also make existing problems worse {% cite DORA2025%}.
Studies in programming education help explain why fundamentals matter. Learners with stronger foundations could follow generated code, spot mistakes, and recognize cases the AI had missed. Those are the same skills you practice when you trace an algorithm, choose a data structure, or debug an assignment {% cite Prather2024WideningGap Ma2026%}.
Anthropic also found that people with more knowledge of the task's subject were more likely to succeed in their Claude Code sessions {% cite hitzig2026agentic%}.
A recurring difference was how people used the tool: more experienced users planned, guided, and checked its work, while beginners more often turned to it simply to get past an obstacle {% cite Ma2026 Prather2024WideningGap Dohmke2025 ShenTamkin2026 %}.
The concern is that students who keep building these skills will get more value from AI, while those who skip that practice risk falling behind {% cite LodgeLoble2026%}.

This means that ==**as a college student, your main goal should be to maximize your skills**== so that, when you then add AI on top, you amplify a larger base of skills and keep compounding.
Unfortunately, AI as a technology often incentivizes behavior that reduces skill formation, if used inappropriately {% cite Yan2024promises BastaniEtAl2025 %}. 
To use an analogy: **Using AI to do the heavy lifting in your coursework is like sending a robot to the gym instead of working out yourself**. 


<div class="ai-workout-figure">
  <img class="ai-workout-image" src="{{ '/img/genAI_gym_bw.jpg' | prepend: site.baseurl }}" onmousedown="this.src='{{ '/img/genAI_gym.jpg' | prepend: site.baseurl }}'" onmouseup="this.src='{{ '/img/genAI_gym_bw.jpg' | prepend: site.baseurl }}'" onmouseout="this.src='{{ '/img/genAI_gym_bw.jpg' | prepend: site.baseurl }}'" alt="Student standing relaxed in a gym while watching a robot lift heavy weights. Other students are working out actively in the gym. University buildings in the background.">
  <div class="ai-workout-caption">
    <strong>"Wow, I just discovered this AI that makes my workout so much easier and faster!"</strong>
  </div>
</div>


A study of high-school math students shows how this can go wrong: unrestricted AI help improved practice scores, but **students later scored 17% lower on an exam without AI than students who had practiced without it** {% cite BastaniEtAl2025 %}. Finishing a problem successfully with AI can leave you unprepared to solve one on your own.
Reporting on a Brown University economics course describes a similar warning sign. The take-home exam average was 96 out of 100, far above the course's usual midterm averages, and the professor suspected AI use because many answers resembled ChatGPT's {% cite BrownDailyHerald2026Serrano InsideHigherEd2026Serrano %}. When the final moved in person, many students with perfect take-home scores dropped the course or missed the exam; many who took it scored much lower. This was a reported classroom case, so it cannot establish that AI caused the difference {% cite BrownDailyHerald2026Serrano InsideHigherEd2026Serrano %}.

**This matters for you, because a high score earned with AI can hide gaps in your own understanding.**
The grade looked excellent right up to the moment the students had to rely on their own skills, and in exams, interviews, and on the job you eventually have to.

Learning research calls some useful challenges "desirable difficulties": recalling an idea without your notes, for example, can help you remember it later even though it feels harder than rereading. The useful part is the mental practice, rather than frustration for its own sake {% cite bjork2011making bjork2020desirable brown2014MakeItStick%}. Learn more about desirable difficulties and their importance for learning in my previous blog post "[Evidence-Based Study Tips for College Students](/blog/evidence-based-study-tips-for-college-students/)".


Research also points to ways AI can support learning {% cite gkintonl2025 Dong2026 %}. For your coursework, a useful aim is to let AI clear up confusing instructions or explain an unfamiliar term while you keep practicing the reasoning the assignment is meant to teach.


The remainder of this article is an actionable guide for students who are trying to elevate their learning journey to be well prepared for a world in which AI is potentially increasingly replacing cognitive work and the bar we need to reach might be rising more and more with every release of more capable models.

## Cognitive Offloading: Beneficial vs. Detrimental Use

**Cognitive offloading** means using tools to reduce mental effort, whether that's a calculator, a calendar reminder, or AI debugging a script {% cite RiskoGilbert2016 %}.

Whether it helps or harms learning depends on *what* you offload. Cognitive Load Theory (CLT) starts with a familiar experience: you can only keep so many unfamiliar things in mind at once. When you first learn recursion, tracking calls, variables, and return values can use up that capacity. Confusing instructions add effort without helping you understand recursion. Practice gradually makes familiar patterns easier to recognize, freeing your attention for harder problems {% cite sweller2011cognitive KalyugaPlass2025 %}.

### The Bad: Detrimental Offloading (Outsourcing)
Detrimental offloading means outsourcing the thinking you need to practice {% cite LodgeLoble2026 %}. Asking AI to solve the traveling salesperson problem for you, for example, defeats an assignment meant to teach algorithmic optimization.

Two risks follow:

*   **Skipping practice:** If AI works out the logic for you, you miss practice recognizing and solving that kind of problem {% cite deBruinEtAl2023 Duplice2025 %}. In the math experiment above, which involved nearly 1,000 students, an AI tutor designed to support learning largely avoided the harm seen with unrestricted AI help {% cite BastaniEtAl2025 %}. In another study, 52 developers learned a new Python library. Those with AI help scored lower on the following quiz, especially on debugging questions {% cite ShenTamkin2026 %}. For a programming assignment, getting code to run is only one check; you also need to understand how to fix it when it breaks.

*   **Metacognitive laziness:** This means letting AI take over the job of checking your own thinking: deciding how to start, noticing what you do not understand, and judging whether your answer makes sense. Research warns that better work produced with AI does not necessarily mean you have learned more {% cite FanEtAl2025 yan2025distinguishing %}. Before submitting an answer, check whether you can explain the reasoning without reopening the chat.


### The Good: Beneficial Offloading
**Beneficial offloading** lets AI handle work that is getting in the way of your learning goal, leaving you more attention for the skill you need to practice {% cite LodgeLoble2026 gkintonl2025 %}. A syntax check can help when your goal is algorithm design; it can replace needed practice when syntax itself is the learning goal.

In a 12-week study with 240 university students, one group used AI to brainstorm, then did the work of questioning ideas, strengthening arguments, and revising their essays. They improved more in critical thinking and writing quality than students taught in the usual way. Because this was not a fully randomized experiment, the difference cannot confidently be credited to AI alone {% cite HongEtAl2025 %}. A separate survey also linked offloading and reflecting together with better academic results reported by students, but a survey cannot show which caused which {% cite IqbalEtAl2025 %}. For your next essay, consider asking AI for possible angles, then choose and defend an argument yourself.

## Strategies for Learning Deeply

AI can give you hints, explanations, and feedback as you learn. The important question is what that help leaves you able to do yourself.

### The "Attempt First" Pattern

**The Research Grounding:**
Classic experiments found better memory for words participants generated from cues than for words they read {% cite Slamecka1978 %}. This supports generating relevant answers, but does not establish that every programming task should begin with prolonged unaided struggle. Classroom generation findings also vary with the task and design {% cite Duplice2025 %}.

**How and Why it Works:**
Try a relevant step: predict the output, sketch an approach, or identify what you do not understand. Then seek feedback. If you lack the prerequisite knowledge, start with an explanation or worked example and then attempt a related task {% cite bjork2011making bjork2020desirable %}. To check for an illusion of understanding, close the explanation and try again independently.

**Example Prompt (C++):**
> "I am implementing a Graph Breadth-First Search (BFS) in C++. Here is my partial attempt and a trace of what I expected: [paste code and trace]. It enters an infinite loop. Without rewriting the code, ask me a question that helps me check when I mark nodes as visited."

### Break the Problem into Steps

**The Research Grounding:**
The DBox study tested an interface that combined learner-written solution steps, AI feedback, hints, and progressive code reveal. After using it, 24 university learners solved an immediate, similar algorithm problem more accurately without tools than after using their usual resources, which could include AI. This was a test of the whole interface, with no delayed or far-transfer assessment {% cite Ma2025DBox %}. A separate observational Python-course study associated planning-hint use with greater assignment success; students chose their own hints, so the association does not establish a causal learning benefit {% cite Phung2025PlanMore %}.

**How and Why it Works:**
Write a plan, identify a step you cannot justify, and ask for feedback on that step. Then implement and test the solution yourself. If you lack the background to form a plan, study a worked example first. This routine adapts the research; the exact prompt below was not tested.

**Example Prompt (Programming):**
> "Here is my plan and the step I am uncertain about: [plan]. Ask me one question that tests whether that step follows. Help me identify a missing case before suggesting a change. Leave the implementation for me to write and test."

### Socratic Interaction: AI as a Tutor, Not an Oracle

**The Research Grounding:**
Guided questions can make room for retrieval, prediction, and explanation. Kazemitabaar et al. tested designs such as “Lead-and-Reveal,” which asks learners to explain a next step before seeing generated code. Their studies did not detect a statistically significant learning-outcome advantage for these designs, so assigning a “tutor” persona alone should not be presented as a proven improvement {% cite Kazemitabaar2025 %}.

There is also encouraging classroom evidence. Across two introductory programming terms, Tran et al. rotated lab sections through different AI designs. A tutor that asked one question at a time and redirected students toward their own reasoning improved immediate proctored quiz gains compared with no AI. The overall later exam-based retention comparison was not statistically significant. This supports further use and testing of guided interaction, without establishing a general long-term advantage for slower tutoring {% cite Tran2026PacingMastery %}.

When a question makes you recall previously studied material, it can support **retrieval practice**. Questions that ask you to infer a new step instead engage reasoning or self-explanation; not every Socratic exchange is a memory test {% cite RoedigerKarpicke2006 BisraEtAl2018SelfExplanation %}.

**How and Why it Works:**
Ask the tutor to wait while you think and explain. Request a hint when you can make progress with one, or a worked example when you need more guidance. “One hint at a time” is a practical suggestion, not a protocol directly validated by the Pardos and Bhandari experiment. Their results do show why checking generated help matters {% cite pardos2024 %}. Check explanations against lecture notes, a textbook, or appropriate code tests; asking the model to express uncertainty does not guarantee that it will recognize an error.

**Example Prompt (Python):**
> "You are a Python tutor. I understand a single list-comprehension filter but am confused by multiple 'if' conditions. Ask me one question about which elements pass each filter, and wait for my answer. If I cannot explain the next step, show a small worked example and then give me a similar question."

### The "Teach-Back" Method (AI as a Teachable Novice)

**The Research Grounding:**
Preparing to teach and explaining ideas can encourage useful learning activity. Tomisu et al.'s “Cognitive Mirror” proposes that AI play a teachable novice to prompt explanation and self-monitoring. It is a conceptual framework with an illustrative classroom activity, not a controlled demonstration that teaching an AI improves learning {% cite tomisu2025 %}.

TeachYou provides an empirical example: 40 algorithm novices taught an AI tutee, and a version with why/how follow-ups and teaching feedback elicited a higher proportion of knowledge-building messages during the problem-solving phase than a simpler version. That measure counted both learner and AI messages; it was not a test of retained knowledge {% cite Jin2024TeachAI %}.

A direct experiment with 96 adults compared explaining an economics concept to an AI novice, peer, challenger, or minimally responsive agent. The roles changed dialogue, perceived competence, and self-reported critical thinking, but immediate posttest scores did not differ significantly after accounting for prior knowledge. All conditions involved explaining, so this does not test explanation against no explanation {% cite Xu2026WhoYouExplainTo %}.

Some explanation-focused tutors have shown delayed benefits. In a university psychology course, ChatTutor users scored higher than a teaching-as-usual group four weeks later, but did not significantly outperform generic ChatGPT. A separate school study found a delayed advantage over ChatGPT but not over restudying. Class-level assignment in the university study and attrition in both studies limit the conclusions. The comparison activity matters {% cite Makransky2025SenseMaking %}.

**How and Why it Works:**
Explain a concept in your own words, then answer “why” and “how” questions. In the ICAP framework, an explanation is *constructive* when you generate inferences beyond the supplied material; merely repeating an answer is not enough. The framework predicts benefits from this deeper engagement, but does not guarantee that any chatbot conversation produces it {% cite ChiWylie2014ICAP %}.

Use the AI's questions to inspect your explanation. Its apparent confusion or agreement is not a reliable verdict on your understanding; verify disputed claims with a trusted source or instructor.

**Example Prompt (Python):**
> "Pretend you are a first-year CS student who is learning inheritance in Python. I will explain it to you. Ask one 'why' or 'how' question when I use undefined jargon or skip a step. Distinguish questions about clarity from claims that my explanation is incorrect, and give me a concrete example to check."

## Prompting Patterns

The following research-informed approaches can help you specify a useful learning interaction. They offer design ideas, not guarantees that a well-formatted prompt produces durable learning.

Prompt design can change conversations without producing a detectable learning advantage. In a six-week introductory programming study, adding planning, monitoring, reflection, or deeper-engagement instructions to an already constrained AI tutor did not produce statistically detectable improvements in the preregistered outcomes, including conceptual quiz performance. Exploratory analyses found differences in interactions. The voluntary quiz sample was small; this is a reason to check outcomes, not proof that these supports never help {% cite Barth2026SteeringTutors %}.

### Prompt Problems: Practicing Requirement Specification

**The Research Grounding:**
Denny et al. introduce **“Prompt Problems”**: learners inspect example inputs and outputs, formulate a natural-language specification, and test whether AI-generated code meets it. The paper reports classroom use and student perceptions, not a controlled demonstration of improved computational thinking {% cite denny2024prompt %}.

**How and Why it Works:**
This activity gives you practice describing behavior precisely and checking cases. It complements writing and debugging code when those are also learning goals. Copying a complete specification into a chatbot skips the specification work.

**Example Activity (Python):**
> "Given a table of employees and a target summary table, first write your own specification: which rows count, how groups are combined, what happens with missing values, and how results are ordered. Create example and boundary cases. Then ask AI to implement your specification, test its output, and revise any ambiguous requirements."

<div class="action-box" markdown="1">
#### Use AI for:
* **Personalized feedback:** Ask for comments on a specific attempt and learning goal, then check the comments. Reviews describe this potential alongside accuracy and implementation limitations {% cite Vorobyeva2025PersonalizedLearningThroughAI %}.
* **Adaptive scaffolding:** Request the amount of guidance you need to take the next step, and reduce it as you become more capable.
* **Worked examples and practice:** Study an explanation, complete missing steps, and then solve a related problem independently.
</div>

### Study Patterns That Preserve Useful Practice

Choose activities that practice the skill you want to retain. Productive challenge can help, but making a task harder is not an end in itself.

### The Alternative Approaches Pattern

**The Research Grounding:**
Garcia's rapid review describes using ChatGPT to generate alternative programming solutions and discuss them. It also identifies limitations in the evidence and the need to evaluate generated content. Treat the comparison exercise below as an application of that idea, not a proven recipe for preventing mental fixation {% cite Garcia2025 %}.

**How and Why it Works:**
Ask for alternatives, then make **your own** prediction about correctness, runtime, memory use, and readability before reading a comparison. Having AI supply both the solutions and the evaluation can remove the reasoning you intended to practice.

**Example Prompt (C++):**
> "Show three ways to reverse a mutable string in C++: a standard library algorithm, two pointers, and recursion. Let me compare their time and auxiliary-space costs, including the recursion call stack, before you give feedback. Ask me to justify which I would choose for a stated constraint."

### Read, Make Your Own Notes, Then Clarify

**The Research Grounding:**
In a randomized study across seven English schools, researchers analyzed results from 344 students aged 14–15 tested three days after reading with AI, taking notes, or combining both. Taking notes produced better comprehension and memory scores than AI alone. Combining notes with AI improved comprehension and scores on questions about explicitly stated facts, but did not show a free-recall advantage. The study used two brief passages and had no reading-only group. It supports preserving note-making, with caution when applying school-age findings to college study {% cite Kreijkes2026NotesReading %}.

**How and Why it Works:**
Read a section and record its main idea, one example, and one uncertainty in your own words. Ask AI about the specific uncertainty, check its response against the source, and revise your notes yourself. Later, close the tools and reconstruct the explanation. This sequence is a practical adaptation: the experiment allowed notes and AI together; it did not test a fixed notes-first order.

**Example Prompt:**
> "Here is the passage and my own explanation. Identify one possible gap or misunderstanding and ask me a question about it before suggesting a correction. Point to the relevant passage so I can check your feedback."

### Faded Worked Examples

**The Research Grounding:**
Worked examples are powerful for novices because they reduce unnecessary search while preserving attention on structure. A 2023 mathematics meta-analysis found a medium effect for worked examples (*g* = .48), and the broader cognitive-load literature warns that support should fade as expertise grows {% cite BarbieriEtAl2023WorkedExamples Kalyuga2003 %}.

**How and Why it Works:**
One possible sequence is a complete example, a similar example with the last step missing, one with several steps missing, and a fresh problem to solve unaided. Adjust the pace to your understanding. Complete examples can themselves build understanding; the point of fading is to add independent practice when you are ready. The mathematics meta-analysis supports worked examples overall, but had too few fading studies to estimate that technique separately.

**Example Prompt (Java):**
> "Show me one worked example of tracing a recursive method, explaining each stack frame. Then give me a similar trace with the final two frames blank for me to fill in. Then give me a third problem with only the method and input, and ask me to produce the full trace before you show any answer."

### Rubric-First Feedback Loop

**The Research Grounding:**
AI feedback can support self-assessment when you compare it with your own judgment. Fan et al.'s writing study found stronger essay revisions without a detectable advantage on the topic-knowledge tests over the comparison conditions {% cite FanEtAl2025 %}. Panadero, Jonsson, and Botella's meta-analyses found improved self-efficacy and mixed evidence for effects on self-regulation: two of the three self-regulation estimates were statistically inconclusive. The reported effect of *d* = 0.73 was on **self-efficacy**—belief in one's capability—not academic achievement or accuracy of self-assessment {% cite PanaderoJonssonBotella2017SelfAssessment %}. The AI-and-rubric routine below is a practical adaptation, not the intervention whose effect that number measures.

Confidence also needs checking. In Fernandes et al.'s second reasoning study, AI-assisted adults answered more questions correctly, yet both AI and no-AI groups overestimated their scores by about four answers out of twenty. Better assisted performance did not ensure accurate self-assessment. This measured performance during assistance, not retained learning {% cite Fernandes2026PerformanceMetacognition %}.

**How and Why it Works:**
Start by scoring your own draft, solution, or design against the rubric. Then ask AI to challenge one rating with evidence and suggest a revision goal. Check whether that challenge is justified; AI is not an authoritative judge of your calibration. This keeps the executive work of evaluation with you and uses AI as a mirror, not a ghostwriter.

**Example Prompt (Writing):**
> "Here is the rubric and my draft. Do not rewrite any prose. First ask me to self-assess my draft on each criterion. Then check one rating against a specific sentence or paragraph. If the evidence justifies a different rating, explain why; otherwise, explain what supports my rating. Suggest a revision goal if needed and ask what I will change."

**Example Prompt (Programming):**
> "Here is my solution and the grading rubric. Do not fix the code. Ask me to rate it first on correctness, edge cases, readability, and tests. Check one rating against the code and test evidence. Explain whether that evidence supports or challenges my rating, and suggest one targeted next step if needed."

### The “Generation-Then-Comprehension” Protocol

If you *do* use AI to generate a snippet of code because you are completely stuck, you must never blindly copy-paste it. 
In Shen and Tamkin's study of 52 developers learning an unfamiliar Python library, the AI-assisted group scored lower on an immediate assessment. The researchers also described usage patterns: a few participants who requested explanations or conceptual help scored better than those who delegated more of the implementation. “Generation-Then-Comprehension” and “Hybrid Code-Explanation” described small groups identified after observing their behavior. Because participants were not randomly assigned to those styles, the findings suggest practices worth testing without proving that explanations eliminate learning costs {% cite ShenTamkin2026 %}.

<div class="action-box" markdown="1">
#### Actionable Tips:
* **Explain and check:** If AI supplies code, predict its behavior, explain the key decisions, and test edge cases. Investigate disagreements between its explanation and your mental model; either can be wrong. Then try a related task without the generated solution.
* **Make a relevant attempt:** Write down an approach, prediction, or specific question before seeking help when you have enough background to start. If you are missing prerequisites, get an explanation or example and then practice {% cite bjork2011making bjork2020desirable %}.
</div>

### Fading the Scaffold: The Goal is Independence

As your knowledge grows, adjust the support. The **expertise reversal effect** describes how instructional guidance that helps novices can become redundant or hinder more knowledgeable learners. It supports adapting and fading appropriate guidance, not assuming that heavy AI assistance is inherently good for beginners {% cite Kalyuga2003 KalyugaPlass2025 %}.

Periodically solve a related problem without AI, and revisit it after a delay. If a formerly manageable task has become difficult, that is a reason to check retention and restore practice; it is not, by itself, proof that AI caused the difficulty. For a skill you aim to perform independently, successful support should help you become less dependent on that support.

### A Quick Rubric for Any AI Interaction

Before you use an AI output in your coursework, ask:

* **Accuracy:** Can I verify the factual claims, code behavior, math steps, or citations?
* **Alignment:** Does the response support the learning objective, or did it solve a different problem?
* **Scaffolding:** Did it make me retrieve, explain, compare, debug, revise, or self-assess?
* **Transfer:** Can I now solve a similar problem without the AI?
* **Integrity:** Does this use fit the course policy, and can I honestly explain what was mine?

If you cannot yet explain or apply the idea, plan more instruction or practice before treating it as learned. A helpful interaction might involve questions, feedback, or a complete worked solution: its value depends on your current knowledge and what you do with it afterward. Check again after a delay, since immediate success is not the same as lasting retention.

---

**Summary:** Use AI to support the practice your learning goal requires. Keep responsibility for reasoning and verification, seek enough guidance to make progress, and test what you can do independently after a delay. The goal is both to finish the assignment and to retain skills you can use beyond it.


**Disclaimer**: Since AI evolvs quickly, evidence about the impact of AI on learning lags behind by one or two model generations and is also often limited in size or generalizability. This post is my own personal perspective, informed by the best research I could find published through September 2026. Futher evidence may change and future models may behave differently.


## Self-Check Quiz 
{% include quiz.html id="ai_quiz" %}
