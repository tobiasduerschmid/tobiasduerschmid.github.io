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

**Many of my students come to me with this wonderful question: =="*How can I leverage AI as a tool to supercharge my education without accidentally outsourcing my own intelligence?*"==
In my opinion, this will fundamentally impact how much the current generation of college students will take out of their educational experience.
So I decided to write my advice down in a succinct, evidence-based post for everyone.**

But first a **disclaimer**: AI is evolving at rapid speed, and we still lack replicated, long-term, larger-scale data on its impact. What follows is my personal perspective, backed by the best available, still early, research I could find. Please take it as a guide, not gospel.

One recurring finding matters more than any single prompt trick: **performance is not the same thing as learning**. Several studies now show that AI can improve the artifact you submit while leaving your unaided skill unchanged or weaker. Bastani et al. found that unrestricted GPT-4 access raised students' practice-problem scores, but those same students scored lower when the tool was removed; the guarded tutor avoided most of that harm by giving hints rather than answers {% cite BastaniEtAl2025 %}. Fan et al. found a similar pattern in university writing: ChatGPT improved essay revisions, but did not produce significant gains in knowledge or transfer, and the authors traced the difference to weaker self-regulated learning processes {% cite FanEtAl2025 %}. A preliminary, not-yet-peer-reviewed essay-writing study by Kosmyna et al. reports lower ownership, weaker quotation recall, and lower neural connectivity among repeated ChatGPT users; because it is a small preprint in one task domain, I treat it as a caution signal rather than settled evidence {% cite Kosmyna2025 %}.

## Motivation: Maximize your Learning Because AI is a Skill Amplifier
It's 7:00 PM on a Friday. 
Your friends want to go watch a movie. 
But you're sitting here debugging your C++ program that is throwing a cryptic segmentation fault. 
You have stared at the same `while` loop for twenty minutes, and the temptation to paste the entire file into an LLM with the prompt "`fix this`" is overwhelming. 
This is what the real professionals would do, so why shouldn't you?
Because you would rob your brain of the exact friction it needs to become a skilled software engineer.


State-of-the-art research on real-world tasks shows that **==AI is an amplifier of technical skills, not an equalizer==** {% cite DORA2025 Paradis2025 Ma2026 Prather2024WideningGap%}.
Recent research by Google shows that developers with *stronger coding foundations* and *deeper system design experience* achieve a *significantly larger* productivity boost from AI tools {% cite Paradis2025%}.
In professional settings, AI magnifies the existing strengths of high-performing individuals and teams, while simultaneously amplifying the dysfunctions of struggling ones {% cite DORA2025%}.
Studies conducted in educational settings show similar results: Experienced developers can use their deep knowledge of fundamentals (algorithms, data structures, and syntax) to anticipate edge cases, rapidly scan and comprehend AI outputs, spot subtle issues, and identify hallucinations to supercharge their workflows {% cite Prather2024WideningGap Ma2026%}.
Methodologically, experts engage with GenAI *proactively* to *plan*, *steer*, and *verify*, whereas novices tend to apply it *reactively* merely to bypass immediate roadblocks {% cite Ma2026 Prather2024WideningGap Dohmke2025 ShenTamkin2026 Huang2025 %}.
Ultimately, **AI enables skilled developers to compound their knowledge and productivity while novices who are not developing these skills fall further and further behind** {% cite LodgeLoble2026%}.

This means that ==**as a college student, your main goal should be to maximize your skills**== so that, when you then add AI on top, you amplify a larger base of skills and keep compounding.
Unfortunately, AI as a technology often incentivizes behavior that reduces skill formation, if used inappropriately {% cite Yan2024promises BastaniEtAl2025 %}. 
To use an analogy: **Using AI to do the heavy lifting in your coursework is like sending a robot to the gym instead of working out yourself**. 

<div style="text-align: center; position: relative; margin: 20px auto; max-width: 750px;">
  <img src="{{ '/img/genAI_gym_bw.jpg' | prepend: site.baseurl }}" onmousedown="this.src='{{ '/img/genAI_gym.jpg' | prepend: site.baseurl }}'" onmouseup="this.src='{{ '/img/genAI_gym_bw.jpg' | prepend: site.baseurl }}'" onmouseout="this.src='{{ '/img/genAI_gym_bw.jpg' | prepend: site.baseurl }}'" alt="Student standing relaxed in a gym while watching a robot lift heavy weights. Other students are working out actively in the gym. University buildings in the background." style="width: 100%; height: auto; border-radius: 12px; display: block;">
  <div style="position: absolute; top: 0; left: 0; right: 0; background: #111; color: white; padding: 4px; border-top-left-radius: 12px; border-top-right-radius: 12px; font-weight: 500; font-size: 1.1em; line-height: 1.2;">
    <strong>"Wow, I just discovered this AI that makes my workout so much easier and faster!"</strong>
  </div>
</div>

Just like a physical workout is only effective if it is strenuous enough to challenge your muscles, learning is only effective if it challenges your mind via "desirable difficulties" {% cite bjork2011making bjork2020desirable brown2014MakeItStick%}. Learn more about desirable difficulties and their importance for learning in my previous blog post "[Evidence-Based Study Tips for College Students](/blog/evidence-based-study-tips-for-college-students/)".

On the other hand, if used correctly, AI has the potential to rapidly accelerate the learning journey of students who use AI to remove undesirable difficulties while increasing desirable difficulties {% cite gkintonl2025 Dong2026 %}.

This is the crucial distinction: the problem is not "AI"; the problem is **unstructured answer-seeking**. In a Harvard physics randomized trial, a carefully designed AI tutor produced more than double the median learning gains of an in-class active-learning lesson, in less time, but the system was not just a generic chatbot: it used instructor-crafted prompts, sequential scaffolding, cognitive-load control, accurate worked solutions, and self-pacing {% cite kestin2025 %}. Likewise, ChatGPT-generated math hints produced statistically significant learning gains comparable to human tutor-authored hints in a PLOS ONE study, but 32% of the raw generated hints failed quality checks before a self-consistency procedure reduced the error rate {% cite pardos2024 %}. So the safe takeaway is: use AI as a structured tutor and verifier, not as an unexamined answer machine.

This article is intended to be a guide for students who are trying to elevate their learning journey to be well prepared for a world in which AI is potentially increasingly replacing cognitive work and the bar we need to reach might be rising more and more with every release of more capable models.


## The Double-Edged Sword of Cognitive Offloading: Beneficial vs. Detrimental Use

To truly master how you integrate AI into your computer science education, we need to dive into the learning science theory of *cognitive offloading*. 

**The Research:**
Cognitive offloading is using external tools to reduce your cognitive demand {% cite RiskoGilbert2016%}. Examples of cognitive offloading include using a calculator to avoid having to do math in your head, setting a calendar reminder to avoid having to remember or constantly think about the deadline, or asking ChatGPT to debug a script. They enable you to get a task done with less cognitive work on your end, which of course sounds very enticing!

However, whether this offloading helps or harms your education depends entirely on *what* you are offloading. Educational psychologists analyze this through the lens of Cognitive Load Theory (CLT), which divides our mental effort into three categories: *intrinsic load* (the inherent, necessary difficulty of the core concepts you are trying to learn), *extraneous load* (unnecessary distractions or tedious tasks that don't contribute to the core learning goal), and *germane load* (the mental effort that is directly contributing to learning and understanding) {% cite sweller2011cognitive KalyugaPlass2025  %}. 

Based on this framework, research categorizes AI cognitive offloading into two distinct paths:

### The Bad: Detrimental Offloading (Outsourcing)
Detrimental offloading occurs when you use AI to bypass the *intrinsic* and *germane* cognitive effort required to build long-term knowledge schemas in your brain {% cite LodgeLoble2026%}. 
In computer science, this looks like asking an AI to "write a Python script to solve the traveling salesperson problem" when the entire point of the assignment is for you to learn algorithmic optimization. 

When you outsource the intrinsic and/or germane load, you suffer several severe consequences:
*   **Bypassing Schema Construction:** By letting the AI generate the logic, you skip the "desirable difficulties" necessary to move knowledge from your limited working memory into your long-term procedural memory {% cite deBruinEtAl2023 Duplice2025 %}. 
A massive randomized experiment of nearly a thousand students using AI to solve math problems found that while their immediate performance was significantly higher, their long-term, durable learning suffered significantly once the AI was removed because they never built the internal neural pathways to solve the problems themselves {% cite BastaniEtAl2025 %}.
A smaller study conducted by Anthropic researchers shows similar results for coding tasks as well {% cite ShenTamkin2026 %}.
However, both studies find that these negative learning effects can be fully mitigated by using different usage styles for AI (more on this later).

*   **Metacognitive Laziness:** The frictionless convenience of GenAI powerfully incentivizes "metacognitive laziness"—a state where learners willingly abdicate their self-regulatory responsibilities, such as planning an approach, monitoring their own comprehension, and critically evaluating their work, simply handing those executive functions over to the machine {% cite FanEtAl2025 yan2025distinguishing%}.


### The Good: Beneficial Offloading
Conversely, AI can be a massive catalyst for learning if used for *beneficial offloading*. This occurs when you deliberately delegate *extraneous* cognitive load to the AI, purposefully freeing up your limited working memory to focus entirely on the intrinsic, high-value work of learning {% cite LodgeLoble2026 gkintonl2025  %}. 

In a recent 12-week quasi-experimental study, researchers explicitly taught university students a "cognitive offload instruction" model. They instructed students to delegate lower-order tasks (like brainstorming basic ideas or checking grammar/syntax) to generative AI, thereby compelling the students to focus their mental energy on higher-order analysis, structural evaluation, and logical coherence. The students who practiced this targeted, beneficial offloading demonstrated significantly greater gains in critical thinking and produced higher-quality work than the control group {% cite HongEtAl2025%}. Similarly, studies show that when AI is used to offload lower-order tasks while students engage in shared metacognitive reflection, academic achievement is significantly enhanced {% cite IqbalEtAl2025%}. 


## Mastering the Interaction: Strategies for Deep Learning

While offloading boilerplate is useful, the real value of AI lies in its ability to act as a sophisticated cognitive scaffold. However, how you interact with that scaffold determines whether your skills grow or wither.

### The "Attempt First" Pattern (Brain-to-LLM)

**The Research Grounding:**
The strongest evidence for attempting first comes from classic learning science: information we generate ourselves is remembered better than information we passively consume {% cite Slamecka1978 %}. Newer AI-specific evidence points in the same direction, but should be read carefully. Kosmyna et al.'s preprint reports that participants who wrote unaided before later using ChatGPT showed stronger recall than participants who began with ChatGPT, but the study is small, task-specific, and not yet peer-reviewed {% cite Kosmyna2025 %}. The practical rule is still sound: make an honest attempt before you ask AI for help.

**How and Why it Works:**
By forcing yourself into a "struggle protocol" for at least 15–20 minutes, you prime your brain's retrieval pathways. Even if you fail, the mental effort creates "hooks" for the AI's later explanation to latch onto. Without this initial struggle, you risk the **"illusion of competence"**—believing you understand a concept simply because you've seen a clear AI-generated solution {% cite kazemitabaar2025%}.

**Example Prompt (C++):**
> "I am trying to implement a Graph Breadth-First Search (BFS) in C++. I spent 20 minutes manually tracing my logic and writing this partial attempt: [paste code]. It is currently resulting in an infinite loop. Without rewriting the code for me, can you point out the conceptual flaw in how I am marking nodes as 'visited' in my queue?"

### Socratic Interaction: AI as a Tutor, Not an Oracle

**The Research Grounding:**
Assigning the LLM the role of an "intelligent tutor" produces significantly larger gains in academic achievement and critical thinking than using it as a passive "learning tool" {% cite Huang2025 Kazemitabaar2025 %}. This strategy relies on the **Testing Effect (Retrieval Practice)**: the act of retrieving information from memory strengthens learning more than re-reading or seeing an answer {% cite bjork2020desirable %}.

**How and Why it Works:**
Instead of dispensing answers, a Socratic tutor enforces **"beneficial friction"**. It forces you into a "think–articulate–reflect" loop, requiring you to explain your reasoning before receiving feedback {% cite kazemitabaar2025%}. This transforms a transactional exchange into a cognitively demanding learning process.

Add one more guardrail: ask for **one hint at a time** and verify it. Pardos and Bhandari show that AI-generated hints can support learning, but also that unverified hints can be wrong often enough to matter {% cite pardos2024 %}. Your prompt should therefore make the model expose uncertainty and should keep you responsible for checking the result against the textbook, tests, or lecture notes.

**Example Prompt (Python):**
> "You are a Socratic Python tutor. I am having trouble understanding how list comprehensions work when using multiple 'if' conditions. Do not give me the syntax or a solved example for now. Instead, ask me 2–3 probing questions to help me break down the logic of how filters are applied in sequence, and wait for my response to each."

### The "Teach-Back" Method (AI as a Teachable Novice)

**The Research Grounding:**
This strategy is rooted in the **Protégé Effect**—the phenomenon where students learn better by teaching others than by studying for themselves {% cite tomisu2025 %}. In this "Cognitive Mirror" framework, the AI acts as a "teachable novice" with a pedagogically useful deficit, forcing the learner to engage in the effortful act of explanation {% cite tomisu2025 %}.

**How and Why it Works:**
Explaining a concept to a "confused" AI forces you to fill gaps in your own understanding, define jargon precisely, and monitor your comprehension {% cite tomisu2025 %}. Generating these explanations is a "Constructive" activity in the ICAP framework, leading to superior learning outcomes {% cite ChiWylie2014ICAP %}.

**Example Prompt (Python):**
> "Pretend you are a first-year CS student who doesn't understand how object-oriented inheritance works in Python. I am going to explain it to you. Ask me 'why' and 'how' questions whenever my explanation is unclear, uses jargon without defining it, or skips a step. Point out any logical gaps and don't accept hand-waving—if I say 'it inherits methods', ask me to explain what that means precisely."


## Strategic Prompting Frameworks

Mastering the *form* of your prompt is just as important as the *content*. Two research-backed frameworks help ensure you are engineering for learning, not just output.

### The Pedagogical Prompt Framework

**The Research Grounding:**
The **Knowledge-Learning-Instruction (KLI) framework** suggests that different types of knowledge require specific instructional methods {% cite xiao2024 %}. Instead of a simple query, pedagogical prompting uses a structured approach to elicit learning-oriented responses.

**How and Why it Works:**
A well-specified pedagogical prompt includes five learning-context components: the **AI's Role** (e.g., Socratic Tutor), the **Learner's Level** (e.g., Intro CS), the **Problem Context**, a **Challenge Articulation**, and strict **Guardrails** {% cite xiao2024 %}. Xiao et al. add a sixth component that students often miss: the **Tutoring Protocol**. That means you tell the AI *how to teach*: worked example, hint ladder, self-explanation, retrieval quiz, Parsons problem, debate partner, rubric feedback, and so on. In their undergraduate CS study, a short intervention helped novices improve across all six prompt components from pre-test to post-test, though the authors correctly note that longer-term programming-learning effects still need larger classroom studies {% cite xiao2024 %}.

Use this prompt skeleton:

> "Act as a [role] for a [learner level] student. I am working on [problem context]. My specific difficulty is [challenge]. Guardrails: do not give the final answer; ask one question or give one hint at a time; wait for my reply. Tutoring protocol: use [Socratic questions / faded worked examples / self-explanation / retrieval practice / Parsons problem]. After I answer, ask me to explain why my step works."

Before you trust an AI response, also evaluate the *interaction design*, not just the answer. A learning-oriented prompt should name the goal, preserve a student task, stage help in hints or questions, require you to explain or retrieve something, and include a verification step. If the AI immediately removes the need to think, explain, compare, revise, or check, the prompt is probably optimized for performance rather than learning {% cite xiao2024 FanEtAl2025 pardos2024 %}.

**Example Prompt (C++):**
> "Act as an Intro-level C++ tutor. I am a beginner student struggling with pointer arithmetic. Specifically, I don't understand how adding 1 to an integer pointer changes its address by 4 bytes. Guardrail: Do not provide the direct mathematical formula. Instead, provide a step-by-step worked example using an array of 5 integers and ask me to predict the address of the third element."

### Requirement-Oriented Prompt Engineering (ROPE)

**The Research Grounding:**
ROPE shifts your effort away from low-level syntax recall and toward **Computational Thinking** and **Requirement Specification** {% cite denny2024prompt %}. This is akin to the core "requirement elicitation" step in professional software engineering.

**How and Why it Works:**
In "Prompt Problems", your task is to analyze a complex problem and formulate a precise natural language prompt that guides the AI to generate the correct code {% cite denny2024prompt%}. This forces you to engage in high-level abstraction and logical decomposition—the hardest and most valuable parts of programming—while the AI handles the syntax.

**Example Prompt (Python):**
> (Student task) "Write a Python function `process_data` that takes a pandas DataFrame. Requirement 1: Drop all rows where the 'Status' column is NaN. Requirement 2: Group the data by 'Department' and calculate the mean of the 'Salary' column. Requirement 3: Return the resulting Series sorted in descending order. Requirement 4: Do not use any loop structures."

<br>


“Learning results from what the student does and thinks and only from what the student does and thinks. The teacher can advance learning only by influencing what the student does to learn” 


<div class="action-box" markdown="1">
#### Use AI for:
*   **Personalized Feedback:** {% cite Vorobyeva2025PersonalizedLearningThroughAI%}
*   **Adaptive Scaffolding:**
*   **Simulating Worked Examples:** 
*   Generative AI should be utilized as a **"bicycle for the mind"**—a tool that amplifies your cognitive reach but still requires your active control, steering, and judgment
</div>

### High-Friction Study Patterns

To move from "passive consumer" to "active builder", you need study patterns that introduce **desirable difficulties**—friction that feels hard in the moment but results in better long-term retention.

### The Alternative Approaches Pattern

**The Research Grounding:**
Comparing, contrasting, and critiquing diverse solutions is a higher-order cognitive task that develops relational understanding {% cite Garcia2025 %}. Seeking multiple perspectives prevents "mental fixation" on a single, potentially sub-optimal solution.

**How and Why it Works:**
Prompting the AI to generate multiple algorithms for the same problem forces you into an evaluative role. You learn to analyze trade-offs in time complexity, space complexity, and code readability {% cite Garcia2025 %}.

**Example Prompt (C++):**
> "Show me three different methods for reversing a string in-place in C++ (e.g., using a standard library algorithm, a two-pointer approach, and recursion). Do not just give me the code—provide a detailed comparison of their Big-O complexities and explain when each would be the 'best' choice in a production environment."

### Retrieval Practice, Spacing, and Self-Explanation

**The Research Grounding:**
The most reliable study techniques are still the old ones: retrieval practice and spacing {% cite RoedigerKarpicke2006 Cepeda2006 %}. AI is useful here because it can generate endless short-answer questions, vary them, track what you miss, and bring them back later. But the key is that *you* must retrieve the answer before seeing it. Self-explanation is another strong companion technique: a meta-analysis of 64 reports found that prompting learners to explain causal or conceptual relationships produced a moderate learning benefit (overall weighted mean *g* = .55) {% cite BisraEtAl2018SelfExplanation %}.

**How and Why it Works:**
Ask AI to quiz you, not reassure you. A good quiz prompt uses short-answer or trace-through questions, hides the answer until you attempt, asks for your confidence, and retests missed items in different wording after a delay. For code, combine retrieval with self-explanation by predicting output, tracing variable values, and explaining why each line is necessary.

**Example Prompt (Python):**
> "Quiz me on recursion with 8 short-answer questions. Ask one question at a time and wait for my answer. After each answer, make me rate my confidence from 0 to 100, then give strict feedback. At the end, list the items I missed and ask two new questions that test the same ideas in different wording."

### Faded Worked Examples

**The Research Grounding:**
Worked examples are powerful for novices because they reduce unnecessary search while preserving attention on structure. A 2023 mathematics meta-analysis found a medium effect for worked examples (*g* = .48), and the broader cognitive-load literature warns that support should fade as expertise grows {% cite BarbieriEtAl2023WorkedExamples Kalyuga2003 %}.

**How and Why it Works:**
Do not ask AI for ten complete examples. Ask for one complete example, then a near example with the last step missing, then one with several steps missing, then a fresh problem you solve unaided. This keeps the scaffold temporary. If the examples stay complete forever, you are practicing recognition, not production.

**Example Prompt (Java):**
> "Show me one worked example of tracing a recursive method, explaining each stack frame. Then give me a similar trace with the final two frames blank for me to fill in. Then give me a third problem with only the method and input, and ask me to produce the full trace before you show any answer."

### Rubric-First Feedback Loop

**The Research Grounding:**
AI feedback is most useful when it helps you judge your own work against explicit criteria instead of silently improving the artifact for you. Fan et al.'s writing study is a warning: ChatGPT improved essay scores without producing significant knowledge gain or transfer {% cite FanEtAl2025 %}. The better pattern is to pair external feedback with self-assessment. Panadero, Jonsson, and Botella's meta-analysis found that self-assessment interventions had positive effects on self-regulated learning measures and an especially large effect on self-efficacy (*d* = 0.73) {% cite PanaderoJonssonBotella2017SelfAssessment %}.

**How and Why it Works:**
Start by scoring your own draft, solution, or design against the rubric. Then ask AI to identify where your self-assessment is calibrated or off, and to suggest the smallest revision that would improve one criterion. This keeps the executive work of evaluation with you and uses AI as a mirror, not a ghostwriter.

**Example Prompt (Writing):**
> "Here is the rubric and my draft. Do not rewrite any prose. First ask me to self-assess my draft on each rubric criterion. After I answer, identify one place where my self-assessment is too generous or too harsh, cite the sentence or paragraph that shows it, and suggest one revision goal. End by asking me what I will change."

**Example Prompt (Programming):**
> "Here is my solution and the grading rubric. Do not fix the code. Ask me to rate it first on correctness, edge cases, readability, and tests. Then challenge one rating with evidence from the code and give me one targeted next step."

### Parsons Problems & Explain in Plain English (EiPE)

**The Research Grounding:**
Grounded in **Cognitive Load Theory**, Parsons Problems (scrambled code blocks) and EiPE (writing natural language descriptions of code) target "relational" understanding {% cite denny2024prompt Smith2024ExplainPurpose %}. These techniques reduce the extraneous load of syntax while maximizing the "germane" load of logical structure {% cite Ericson2017 %}.

**How and Why it Works:**
Parsons Problems remove the burden of environment setup and syntax errors, letting you focus entirely on control flow and program logic {% cite Ericson2017 %}. Similarly, the "Explain in Plain English" rule proves whether you *understand* the code or are just recognizing patterns.

**Example Prompt (Python):**
> "Create a Python Parsons problem for implementing a Binary Search. Write a correct solution (about 10 lines). Present the lines to me in SCRAMBLED order, numbered randomly. Include 2 'distractor' lines that look plausible but are logically incorrect. Do NOT show me the correct solution.”

### The “Generation-Then-Comprehension” Protocol

If you *do* use AI to generate a snippet of code because you are completely stuck, you must never blindly copy-paste it. 
Research shows that developers who simply delegate code generation to AI completely bypass the skill formation process {% cite ShenTamkin2026%}. However, high-performing students naturally adopt a **"Generation-Then-Comprehension"** or **"Hybrid Code-Explanation"** workflow {% cite ShenTamkin2026%}. In this pattern, learners generate a piece of code and immediately follow up by prompting the AI for conceptual explanations of the underlying logic, ensuring they check and verify their own understanding rather than merely delegating the work.

<div class="action-box" markdown="1">
#### **Actionable Tips:**
*   **Explain After AI:** Adopt a strict personal rule. If AI writes five lines of code, you must immediately read it, trace the variables manually, and then explain it back to the AI line-by-line. Correct the AI if its explanation differs from your mental model.
*   **The 15-Minute Rule:** Mandate a "struggle protocol"—attempt the problem independently for at least 15 minutes, write down what you tried, and *then* ask AI for a hint, not a solution {% cite bjork2011making bjork2020desirable %}.
</div>


### Fading the Scaffold: The Goal is Independence

The final and most important principle is **Fading Scaffolding**. Following the **Expertise Reversal Effect**, heavy AI assistance is incredibly helpful early on, but it must be systematically withdrawn as your competence grows {% cite Kalyuga2003 KalyugaPlass2025 %}. 

As you master a concept, stop asking the AI for boilerplate; start asking it only for high-level architectural critiques. If you find yourself unable to solve a problem without an LLM that you could solve easily two months ago, you have over-indexed on offloading. The ultimate mark of successful AI use is that you eventually need the AI *less* for that specific skill, not more.

## A Quick Rubric for Any AI Interaction

Before you use an AI output in your coursework, ask:

* **Accuracy:** Can I verify the factual claims, code behavior, math steps, or citations?
* **Alignment:** Does the response support the learning objective, or did it solve a different problem?
* **Scaffolding:** Did it make me retrieve, explain, compare, debug, revise, or self-assess?
* **Transfer:** Can I now solve a similar problem without the AI?
* **Integrity:** Does this use fit the course policy, and can I honestly explain what was mine?

If the answer to the scaffolding or transfer question is "no", the interaction may have helped your submission more than your learning. The highest-value AI prompts make the model **wait, question, diagnose, compare, quiz, critique, or reformat**. The lowest-value prompts make it simply solve.

---

**Summary:** AI is a skill amplifier. Use it to increase the "desirable difficulty" of your studies, not to remove the effort. Master the interaction patterns that force you to think, articulate, and reflect. Your goal isn't just to finish the assignment; it's to build a brain that can eventually build the AI itself.

{% include quiz.html id="ai_quiz" %}
