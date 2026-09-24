---
layout: blog-post
title: "[Draft] How Should I Use AI as a College Student? — A Science-Backed Guide for CS Students"
date: 2026-03-11
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

State-of-the-art research on real-world tasks shows that ==for hard problems AI, AI is an amplifier of technical skills, not an equalizer== {% cite hitzig2026agentic DORA2025 Paradis2025 Ma2026 Prather2024WideningGap %}.
Recent research by Google shows that developers with *stronger coding foundations* and *deeper system design experience* achieve a *larger* productivity boost from AI tools {% cite Paradis2025%}.
In professional settings, AI magnifies the existing strengths of high-performing individuals and teams, while simultaneously amplifying the dysfunctions of struggling ones {% cite DORA2025%}.
Studies conducted in educational settings show similar results: Experienced developers can use their deep knowledge of fundamentals (algorithms, data structures, and syntax) to anticipate edge cases, rapidly scan and comprehend AI outputs, spot subtle issues, and identify hallucinations to supercharge their workflows {% cite Prather2024WideningGap Ma2026%}.
Furthermore, Anthropic's analysis of Claude Code usage shows the more domain expertise a person has, the more often the coding session is successful {% cite hitzig2026agentic%}.
Methodologically, experts engage with GenAI *proactively* to *plan*, *steer*, and *verify*, whereas novices tend to apply it *reactively* merely to bypass immediate roadblocks {% cite Ma2026 Prather2024WideningGap Dohmke2025 ShenTamkin2026 Huang2025 %}.
Ultimately, **AI enables skilled developers to compound their knowledge and productivity while novices who are not developing these skills fall further and further behind** {% cite LodgeLoble2026%}.

This means that ==**as a college student, your main goal should be to maximize your skills**== so that, when you then add AI on top, you amplify a larger base of skills and keep compounding.
Unfortunately, AI as a technology often incentivizes behavior that reduces skill formation, if used inappropriately {% cite Yan2024promises BastaniEtAl2025 %}. 
To use an analogy: **Using AI to do the heavy lifting in your coursework is like sending a robot to the gym instead of working out yourself**. 


<div class="ai-workout-figure">
  <img class="ai-workout-image" src="{{ '/img/genAI_gym_bw.jpg' | prepend: site.baseurl }}" onmousedown="this.src='{{ '/img/genAI_gym.jpg' | prepend: site.baseurl }}'" onmouseup="this.src='{{ '/img/genAI_gym_bw.jpg' | prepend: site.baseurl }}'" onmouseout="this.src='{{ '/img/genAI_gym_bw.jpg' | prepend: site.baseurl }}'" alt="Student standing relaxed in a gym while watching a robot lift heavy weights. Other students are working out actively in the gym. University buildings in the background.">
  <div class="ai-workout-caption">
    <strong>"Wow, I just discovered this AI that makes my workout so much easier and faster!"</strong>
  </div>
</div>


Recent research found that **students who used AI for homework performed 17% worse in subsequent tests** {% cite BastaniEtAl2025 %} --- that's the difference between an A and a C+.

A Brown University case from spring 2026 shows the same gap in a real-world teaching setting. Economics professor Roberto Serrano made the midterm of his advanced mathematical economics course (ECON 1170) a take-home exam. The class averaged 96 out of 100, with 40 students reaching perfect scores, while the course's midterm average had historically been 65--80. When Serrano and his graders gave the questions to ChatGPT, it produced the same convoluted proof by contradiction that many students had submitted for a question with a short, direct solution. He then made the final exam in-person. Of the 27 students who dropped the course or skipped the final, 22 had scored a perfect 100 on the midterm. The students who took the in-person final averaged about 49 {% cite BrownDailyHerald2026Serrano InsideHigherEd2026Serrano %}.

An independent statistical analysis of the released scores looked at the 59 students who took both exams: their average fell from 95.7 to 48.8, and a student's take-home midterm score said almost nothing about their in-person final score (correlation ≈ 0.06). Normally, students who do well on one exam of a course also tend to do well on the next. Scores alone cannot prove which students used AI, and the authors examine alternative explanations such as test anxiety and a harder final {% cite TopazBahl2026ExamScores %}.

**Why this matters for you:** a high score earned with AI measures the AI, not you. The grade looked excellent right up to the moment the students had to rely on their own skills, and in exams, interviews, and on the job you eventually have to.

Just like a physical workout is only effective if it is strenuous enough to challenge your muscles, learning is usually most effective when it challenges your mind via "desirable difficulties" {% cite bjork2011making bjork2020desirable brown2014MakeItStick%}. Learn more about desirable difficulties and their importance for learning in my previous blog post "[Evidence-Based Study Tips for College Students](/blog/evidence-based-study-tips-for-college-students/)".



On the other hand, if used correctly, **AI has the potential to rapidly accelerate the learning journey** of students who use AI to remove undesirable difficulties while increasing desirable difficulties {% cite gkintonl2025 Dong2026 %}.


This article is intended to be a guide for students who are trying to elevate their learning journey to be well prepared for a world in which AI is potentially increasingly replacing cognitive work and the bar we need to reach might be rising more and more with every release of more capable models.


## The Double-Edged Sword of Cognitive Offloading: Beneficial vs. Detrimental Use

**Cognitive offloading** means using tools to reduce mental effort, whether that's a calculator, a calendar reminder, or AI debugging a script {% cite RiskoGilbert2016 %}.

Whether it helps or harms learning depends on *what* you offload. Cognitive Load Theory (CLT) explains why our limited working memory matters: *intrinsic load* comes from the material's complexity relative to your knowledge; *extraneous load* comes from distractions or unnecessary work; and *germane load* describes effort spent building understanding, such as explaining why an algorithm works. Practice builds mental models in long-term memory, letting you recognize familiar patterns without working through every detail from scratch {% cite sweller2011cognitive KalyugaPlass2025 %}.

### The Bad: Detrimental Offloading (Outsourcing)
Detrimental offloading means outsourcing the thinking you need to practice {% cite LodgeLoble2026 %}. Asking AI to solve the traveling salesperson problem for you, for example, defeats an assignment meant to teach algorithmic optimization.

Two risks follow:

*   **Skipping practice:** When AI generates the logic, you miss opportunities to build reusable mental models through practice {% cite deBruinEtAl2023 Duplice2025 %}. In a randomized experiment involving nearly 1,000 high-school students, unrestricted AI assistance improved math practice scores but reduced subsequent unaided exam scores by 17% compared with no AI. A tutor with learning safeguards largely avoided this harm {% cite BastaniEtAl2025 %}. In a separate experiment with 52 developers learning a new Python library, AI users scored lower on a subsequent knowledge quiz, particularly on debugging questions {% cite ShenTamkin2026 %}.

*   **Metacognitive laziness:** AI's convenience can encourage you to hand over planning, monitoring your understanding, and evaluating your work. A polished answer can therefore conceal gaps in what you can explain or reproduce independently. You still need to judge whether the answer makes sense and meets the assignment's goal {% cite FanEtAl2025 yan2025distinguishing %}.


### The Good: Beneficial Offloading
**Beneficial offloading** delegates extraneous work to AI, preserving mental capacity for learning {% cite LodgeLoble2026 gkintonl2025 %}. A syntax check can help when your goal is algorithm design; it can replace needed practice when syntax itself is the learning goal.

In a 12-week quasi-experimental study with 240 university students, AI-supported writing instruction combined brainstorming assistance with student critique, revision, and reflection. Students used AI to generate starting points, then examined ideas, strengthened arguments, and reviewed their reasoning. They improved more in critical thinking and essay quality than students receiving traditional instruction {% cite HongEtAl2025 %}. A separate survey linked offloading and shared reflection with stronger self-reported academic outcomes {% cite IqbalEtAl2025 %}.

## Strategies for Deep Learning

While offloading boilerplate is useful, the real value of AI lies in its ability to act as a sophisticated cognitive scaffold. However, how you interact with that scaffold determines whether your skills grow or wither.

### The "Attempt First" Pattern

**The Research Grounding:**
Classic experiments found better memory for words participants generated from cues than for words they read {% cite Slamecka1978 %}. This supports generating relevant answers, but does not establish that every programming task should begin with prolonged unaided struggle. Classroom generation findings also vary with the task and design {% cite Duplice2025 %}.

There is also no established waiting time before seeking AI help. In a working paper with 334 university students, requiring ten minutes of reading before access to a textbook-grounded AI tutor did not show an advantage over allowing access throughout a 25-minute study period. The assessment was immediate, and delaying access also reduced the time available to use AI. This does not identify an optimal waiting time or test every attempt-first strategy {% cite Fischer2025AITutoring %}.

**How and Why it Works:**
Try a relevant step: predict the output, sketch an approach, or identify what you do not understand. Then seek feedback; the useful work matters more than how many minutes you spend stuck. If you lack the prerequisite knowledge, start with an explanation or worked example and then attempt a related task {% cite bjork2011making bjork2020desirable %}. To check for an illusion of understanding, close the explanation and try again independently.

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

### The Pedagogical Prompt Framework

**The Research Grounding:**
Xiao et al. draw on the **Knowledge-Learning-Instruction (KLI) framework** to match the knowledge being learned with suitable instructional activities {% cite xiao2024 %}. Their pedagogical prompting framework helps learners specify the support they want from AI.

**How and Why it Works:**
The framework has six components: the **AI's Role** (e.g., Socratic Tutor), the **Learner's Level** (e.g., Intro CS), the **Problem Context**, a **Challenge Articulation**, **Guardrails**, and the **Tutoring Protocol**—how you want the AI to teach, such as through worked examples, repeated practice, or self-explanation {% cite xiao2024 %}. These are design suggestions, not a demonstration that every prompt needs all six components. In their study of 22 undergraduate students, scores on the authors' prompting rubric improved across all six components after instruction. There was no control group, and the study did not test gains in programming skill; those outcomes still require further study {% cite xiao2024 %}.

A larger 2026 preprint tested four prompting lessons in an introductory programming course. Among 431 students with complete data out of 979 randomized, practice writing prompts with feedback produced the strongest later prompting-rubric scores. The groups did not differ significantly on the final computer science exam. Better prompting does not by itself demonstrate that students learned more programming, and the large proportion of incomplete records limits this result {% cite Xiao2026PromptingInstruction %}.

Use this prompt skeleton:

> "Act as a [role] for a [learner level] student. I am working on [problem context]. My specific difficulty is [challenge]. Tutoring protocol: use [Socratic questions / faded worked examples / self-explanation / retrieval practice / Parsons problem]. Give one question or hint at a time and wait for my reply. If I need a worked example, explain a similar problem and then leave a step or new problem for me to attempt. Ask me to explain a key decision and help me check it."

Before you trust an AI response, also evaluate the *interaction design*. Name the goal, choose suitable help—questions, hints, or worked examples—and preserve something for you to explain, apply, or check. Include a verification step and later independent practice {% cite xiao2024 FanEtAl2025 pardos2024 %}.

Prompt design can change conversations without producing a detectable learning advantage. In a six-week introductory programming study, adding planning, monitoring, reflection, or deeper-engagement instructions to an already constrained AI tutor did not produce statistically detectable improvements in the preregistered outcomes, including conceptual quiz performance. Exploratory analyses found differences in interactions. The voluntary quiz sample was small; this is a reason to check outcomes, not proof that these supports never help {% cite Barth2026SteeringTutors %}.

**Example Prompt (C++):**
> "Act as an Intro-level C++ tutor. I am a beginner student struggling with pointer arithmetic. Specifically, I don't understand why adding 1 to a pointer to an array element advances by the size of that element. Assume `sizeof(int)` is 4 bytes in this example. Guardrail: Do not provide the direct mathematical formula. Instead, provide a step-by-step worked example using an array of 5 integers and ask me to predict the address of the third element."

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

A 2026 preprint with 220 algorithms students found no detectable exam advantage or disadvantage from homework that included evaluating AI-generated solutions instead of solving the corresponding problems. Both groups still completed substantial conventional problem-solving, and the evaluation and construction tasks used different homework rubrics. This does not establish that critique and solution construction are interchangeable. When algorithm design is your goal, I recommend practicing complete solutions alongside critique {% cite Dickey2026SolvingEvaluating %}.

<div class="action-box" markdown="1">
#### Actionable Tips:
* **Explain and check:** If AI supplies code, predict its behavior, explain the key decisions, and test edge cases. Investigate disagreements between its explanation and your mental model; either can be wrong. Then try a related task without the generated solution.
* **Make a relevant attempt:** Write down an approach, prediction, or specific question before seeking help when you have enough background to start. There is no research-backed minimum number of minutes. If you are missing prerequisites, get an explanation or example and then practice {% cite bjork2011making bjork2020desirable %}.
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


**Disclaimer**: Since AI evolvs quickly, evidence about the impact of AI on learning lags behind by one or two model generations and is also often limited in size or generalizability. This post is my own personal perspective, informed by the best research I couuld find published through September 2026. Futher evidence may change and future models may behave differently.


{% include quiz.html id="ai_quiz" %}

# Notes


One recurring finding matters more than any single prompt trick: **performance is not the same thing as learning**. AI can improve the artifact you submit without improving what you can later do independently {% cite yan2025distinguishing %}. Bastani et al. found that access to a GPT-4 assistant raised high-school students' math practice scores, but students with the relatively unrestricted assistant scored lower than controls on subsequent unaided exams. A tutor designed with learning safeguards largely avoided that harm {% cite BastaniEtAl2025 %}. In a university essay-writing task, Fan et al. found greater improvement in revisions with ChatGPT, without a detectable advantage over comparison conditions on topic-knowledge tests about AI in education and healthcare. Those tests did not measure independent writing skill. Their analysis suggested differences in self-regulated learning processes; it did not establish that those processes caused the outcome {% cite FanEtAl2025 %}. These findings warrant care, but neither study establishes permanent skill loss.

When reading an “AI improves learning” headline, ask what students did with AI, what the comparison group did, and whether students were assessed without that help. A methodological review by Weidlich and colleagues explains why these details matter: a tutoring package may change several instructional activities together, so its results need not isolate the effect of the chatbot alone {% cite Weidlich2025EffectCause %}.


On the other hand, ==if used correctly, AI has the potential to rapidly accelerate the learning journey of students who use AI== to remove undesirable difficulties while increasing desirable difficulties {% cite gkintonl2025 Dong2026 pardos2024  kestin2025%}.
In a Harvard physics randomized trial, a carefully designed AI tutor produced more than double the median learning gains of an in-class active-learning lesson, in less time {% cite kestin2025 %}. 
Likewise, ChatGPT-generated math hints produced statistically significant learning gains comparable to human tutor-authored hints in a PLOS ONE study, but 32% of the raw generated hints failed quality checks before a self-consistency procedure reduced the error rate {% cite pardos2024 %}. So the safe takeaway is: use AI as a structured tutor and verifier, not as an unexamined answer machine.

This article is intended to be a guide for students who are trying to elevate their learning journey to be well prepared for a world in which AI is potentially increasingly replacing cognitive work and the bar we need to reach might be rising more and more with every release of more capable models.


There is also encouraging evidence for carefully designed AI support. In a Harvard physics randomized trial, a custom AI tutor produced more than double the learning gain calculated from median test scores compared with an in-class active-learning lesson. Students spent a median of 49 minutes with the tutor, compared with an estimated 60 minutes of learning during a 75-minute class. This was an immediate assessment of a particular instructional design, not a test of long-term retention or of generic chatbot use {% cite kestin2025 %}.

In an online experiment with adults, Pardos and Bhandari found significant gains on an immediate, repeated three-question math test with both human-authored help and quality-screened ChatGPT help, with no statistically significant difference between the two. That is not proof that the methods are equivalent in every setting. The AI “hints” were worked solutions, and 32% of the initial generated solutions failed quality checks; a subsequent self-consistency procedure reduced errors {% cite pardos2024 %}. The practical takeaway is to choose support that fits your learning goal and verify its content. A complete worked example can be useful, especially when you lack the knowledge to get started.

Ordinary chatbot access can also support learning in some settings. In a 2026 working paper, 211 undergraduates studied unfamiliar topics with or without AI access; 204 returned about a week later. The AI-access group scored about five percentage points higher on the later knowledge test without AI. This is a positive result over one week at one college, not evidence that every use or prompt helps. Observed differences between students' usage styles were not randomized and cannot establish which style caused better learning {% cite ContractorReyes2026LearningImpact %}.

This article is intended to be a guide for students who are trying to elevate their learning journey to be well prepared for a world in which AI is potentially increasingly replacing cognitive work and the bar we need to reach might be rising more and more with every release of more capable models.


## Cognitive Offloading: Beneficial vs. Detrimental Use

To truly master how you integrate AI into your computer science education, we need to dive into the learning science theory of *cognitive offloading*. 

**The Research:**
Cognitive offloading means using actions or external aids to reduce a task's mental demands {% cite RiskoGilbert2016 %}. Examples include using a calculator, setting a calendar reminder, or—applying the idea to AI—asking a chatbot to help debug a script. These can make a task easier to complete.

Whether offloading helps your education depends on **the learning goal, your prior knowledge, what you delegate, and what you do with the freed capacity** {% cite RiskoGilbert2016 %}. Cognitive Load Theory distinguishes *intrinsic load*—the interacting elements you need to understand, relative to what you already know—from *extraneous load*: demands created by the way a task is presented or carried out that do not help achieve the learning goal. “Germane” processing refers to resources devoted to learning; the cited books do not treat it as a third independent load to add to the other two {% cite sweller2011cognitive KalyugaPlass2025 %}.

For example, generating boilerplate may remove irrelevant work in an algorithms exercise, but writing that same code may be the learning goal in an introductory web course. Tedious work is not necessarily extraneous, and challenging work is not necessarily educational.

With that distinction in mind, it is useful to separate two ways of using AI:

### The Bad: Detrimental Offloading (Outsourcing)
Offloading can be detrimental when it replaces the practice needed to develop the knowledge or skill you are trying to learn {% cite LodgeLoble2026 %}. In computer science, this might mean accepting an AI solution to the traveling salesperson problem without reasoning about its algorithm when algorithm design is the assignment's purpose.

Two risks deserve attention:

* **Missing opportunities to build understanding:** Bastani et al.'s experiment with nearly a thousand students found worse performance on subsequent unaided math exams after relatively unrestricted AI practice. The study measured short-term outcomes, not long-term retention. The guarded tutor largely mitigated the observed harm but did not establish lasting learning gains {% cite BastaniEtAl2025 %}. A smaller randomized study of developers learning a new Python library also found lower immediate assessment scores in the AI-assisted group. Its analysis of usage styles was exploratory, so it cannot establish that a particular style eliminates the risk {% cite ShenTamkin2026 %}.
* **Handing over self-monitoring:** Fan et al. use “metacognitive laziness” to interpret patterns in which learners delegate planning, monitoring, or evaluation to AI. This is a proposed account of the observed behavior, not a diagnosis of students' character or a proven causal mechanism. Keep opportunities to judge your own work and check what you understand {% cite FanEtAl2025 yan2025distinguishing %}.

### The Good: Beneficial Offloading
Offloading can help when it reduces demands that are incidental to the learning goal **and you use the freed resources for relevant learning** {% cite RiskoGilbert2016 LodgeLoble2026 %}.

In a 12-week quasi-experimental study of 240 English majors, Hong et al. combined AI-assisted brainstorming and outlining with critique, peer revision, and reflective journals. Students in that program showed greater critical-thinking gains and higher essay-quality scores than the comparison group. The comparison group followed a similar teaching cycle without AI. Because assignment was not random and the intervention was a structured AI-writing program, the study cannot isolate offloading itself as the cause {% cite HongEtAl2025 %}. Brainstorming and grammar are also learning goals in some courses, so they should not automatically be delegated.

Iqbal et al. reported associations among AI use, shared metacognition, cognitive offloading, and an outcome they called “academic achievement.” That outcome was self-reported competence related to sustainable and inclusive education, not observed grades or an independent skill test. Their survey cannot establish that offloading caused learning gains {% cite IqbalEtAl2025 %}.

## Strategies for Deep Learning

AI can provide examples, questions, and feedback that support practice. The strategies below adapt learning principles to chatbot use; most of these exact prompts have not been tested in controlled learning studies. Judge them by what you can explain and do afterward, including without AI.


This is the crucial distinction: the problem is not "AI"; the problem is **unstructured answer-seeking**. In a Harvard physics randomized trial, a carefully designed AI tutor produced more than double the median learning gains of an in-class active-learning lesson, in less time, but the system was not just a generic chatbot: it used instructor-crafted prompts, sequential scaffolding, cognitive-load control, accurate worked solutions, and self-pacing {% cite kestin2025 %}. Likewise, ChatGPT-generated math hints produced statistically significant learning gains comparable to human tutor-authored hints in a PLOS ONE study, but 32% of the raw generated hints failed quality checks before a self-consistency procedure reduced the error rate {% cite pardos2024 %}. So the safe takeaway is: use AI as a structured tutor and verifier, not as an unexamined answer machine.
