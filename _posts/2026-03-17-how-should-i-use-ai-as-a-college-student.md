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

Whether it helps or harms learning depends on *what* you offload. Cognitive Load Theory (CLT) starts with a familiar experience: your working memory can only hold so many unfamiliar things at once. **Intrinsic load** comes from the ideas you need to understand together, relative to what you already know. When you first learn recursion, tracking calls, variables, and return values can use up that capacity. **Extraneous load** is avoidable effort added by how the material is presented, such as confusing instructions or searching for an explanation. Practice builds reusable mental patterns in long-term memory, so familiar details take less effort to work with. The aim is to reduce avoidable effort and leave room for the thinking that builds those patterns {% cite sweller2011cognitive KalyugaPlass2025 %}.

### The Bad: Detrimental Offloading (Outsourcing)
Detrimental offloading means outsourcing the thinking you need to practice {% cite LodgeLoble2026 %}. Asking AI to solve the traveling salesperson problem for you, for example, defeats an assignment meant to teach algorithmic optimization.

Two risks follow:

*   **Skipping practice:** If AI works out the logic for you, you miss practice recognizing and solving that kind of problem {% cite deBruinEtAl2023 Duplice2025 %}. In the math experiment above, which involved nearly 1,000 students, an AI tutor designed to support learning largely avoided the harm seen with unrestricted AI help {% cite BastaniEtAl2025 %}. In another study, 52 developers learned a new Python library. Those with AI help scored lower on the following quiz, especially on debugging questions {% cite ShenTamkin2026 %}. For a programming assignment, getting code to run is only one check; you also need to understand how to fix it when it breaks.

*   **Metacognitive laziness:** This means letting AI take over the job of checking your own thinking: deciding how to start, noticing what you do not understand, and judging whether your answer makes sense. Research warns that better work produced with AI does not necessarily mean you have learned more {% cite FanEtAl2025 yan2025distinguishing %}. Before submitting an answer, check whether you can explain the reasoning without reopening the chat.


### The Good: Beneficial Offloading
**Beneficial offloading** lets AI handle work that is getting in the way of your learning goal, leaving you more attention for the skill you need to practice {% cite LodgeLoble2026 gkintonl2025 %}. A coding agent can help when your goal is algorithm design and you prompt in pseudo-code; it would replace needed practice when syntax itself is the learning goal.

Some research from other disciplines confirms this.
For example, in a 12-week study with 240 university students, one group used AI to brainstorm, then did the work of questioning ideas, strengthening arguments, and revising their essays. They improved more in critical thinking and writing quality than students taught in the usual way {% cite HongEtAl2025 %}.
A separate survey also linked offloading and reflecting together with better academic results reported by students {% cite IqbalEtAl2025 %}.

## Strategies for Learning Deeply

AI can give you hints, explanations, and feedback as you learn. The important question is what that help leaves you able to do yourself.

### The "Attempt First" Pattern

**The Research Grounding:**
In classic memory experiments, people remembered words better when they worked them out from clues than when they simply read them {% cite Slamecka1978 %}. This gives you a reason to try producing an answer before reading one. The benefit varies across classroom tasks, though; it does not mean you need to stay stuck on a programming problem without help {% cite Duplice2025 %}.

**How and Why it Works:**
Try a relevant step: predict the output, sketch an approach, or identify what you do not understand. Then seek feedback. If you lack the prerequisite knowledge, start with an explanation or worked example and then attempt a related task {% cite bjork2011making bjork2020desirable %}. CLT helps explain this limit: searching for every next move can overwhelm working memory when the method is unfamiliar. A worked example can free attention for understanding the method {% cite sweller2011cognitive %}. To check for an illusion of understanding, close the explanation and try again independently.

**Example Prompt (C++):**
> "I am implementing a Graph Breadth-First Search (BFS) in C++. Here is my partial attempt and a trace of what I expected: [paste code and trace]. It enters an infinite loop. Without rewriting the code, ask me a question that helps me check when I mark nodes as visited."

### Break the Problem into Steps

**The Research Grounding:**
In the DBox study, 24 university learners wrote solution steps, received AI feedback and hints, and revealed code gradually. They then solved a similar algorithm problem more accurately without tools than after using their usual study resources, which could include AI. The study tested the whole tool: it could not isolate which feature helped, and did not check whether the benefit lasted or helped with very different problems {% cite Ma2025DBox %}. In a separate Python course, students who chose planning hints did better on assignments. Because they chose the hints themselves, the study cannot show that the hints caused the difference {% cite Phung2025PlanMore %}.

**How and Why it Works:**
Write a plan, identify a step you cannot justify, and ask for feedback on that step. This applies CLT's idea of managing intrinsic load: learn manageable parts before reasoning about how they interact. You still need to put the parts together and explain the complete solution {% cite sweller2011cognitive %}. Then implement and test it yourself. If you lack the background to form a plan, study a worked example first. This routine adapts the research; the exact prompt below was not tested.

**Example Prompt (Programming):**
> "Here is my plan and the step I am uncertain about: [plan]. Ask me one question that tests whether that step follows. Help me identify a missing case before suggesting a change. Leave the implementation for me to write and test."

### Socratic Interaction: AI as a Tutor, Not an Oracle

**The Research Grounding:**
Asking AI to tutor you can create opportunities to think before seeing an answer, but the wording alone is no guarantee. Kazemitabaar and colleagues tested approaches such as “Lead-and-Reveal,” where learners explain the next step before seeing generated code. They did not find clear evidence that these approaches improved learning compared with the alternatives they tested {% cite Kazemitabaar2025 %}.

Another study offers some encouragement. Across two terms of introductory programming, lab sections tried different AI tools. Students using a tutor that asked one question at a time and guided them back to their own reasoning improved more on supervised quizzes taken soon afterward than students without AI. The later exams did not show a clear overall advantage {% cite Tran2026PacingMastery %}. Try using questions to practice explaining a solution, then check again a few days later whether you can solve a similar problem yourself.

Different questions give you different kinds of practice. Recalling what you studied without looking at your notes is **retrieval practice**. Explaining why a loop terminates asks you to reason through the code. Both can be useful, but a conversation only gives you that practice if you do the remembering or explaining yourself {% cite RoedigerKarpicke2006 BisraEtAl2018SelfExplanation %}.

**How and Why it Works:**
Ask the tutor to wait while you think and explain. Request a hint when you can make progress with one, or a worked example when you need more guidance. Applying CLT here means adjusting the challenge to your working-memory capacity: if a question requires juggling several unfamiliar ideas, ask for a simpler example first {% cite sweller2011cognitive %}. “One hint at a time” is a suggestion you can try; the Pardos and Bhandari study did not test that exact routine. Their research on AI-generated math help also highlights why you need to check the help you receive {% cite pardos2024 %}. Use lecture notes, a textbook, or code tests to check explanations. Asking AI to admit uncertainty does not ensure it will catch its own mistakes.

**Example Prompt (Python):**
> "You are a Python tutor. I understand a single list-comprehension filter but am confused by multiple 'if' conditions. Ask me one question about which elements pass each filter, and wait for my answer. If I cannot explain the next step, show a small worked example and then give me a similar question."

### The "Teach-Back" Method (AI as a Teachable Novice)

**The Research Grounding:**
Imagine explaining inheritance to a classmate who keeps asking “why?” Tomisu and colleagues' “Cognitive Mirror” suggests using AI in that role: its questions can prompt you to explain ideas and notice gaps. The paper proposes a teaching approach and illustrates it with a classroom activity; it does not establish that teaching AI improves learning {% cite tomisu2025 %}.

The TeachYou study tried this with 40 people new to algorithms. When the AI asked “why” and “how” questions and gave feedback on their teaching, more of the conversation focused on developing understanding than with a simpler version. However, the researchers counted both human and AI messages, and they did not test how much the learners remembered later {% cite Jin2024TeachAI %}.

A study of 96 adults found no clear learning advantage from giving AI a particular role. Having AI act as a beginner, peer, or challenger changed the conversation and participants' impressions, but did not clearly change their test scores once prior knowledge was taken into account. Everyone explained an economics concept, so the study could not tell whether explaining was better than another way of studying {% cite Xu2026WhoYouExplainTo %}.

Some benefits have lasted beyond the study session. In a university psychology course, ChatTutor users scored higher four weeks later than students taught as usual, but did not clearly outperform ordinary ChatGPT users. In a separate school study, ChatTutor did better than ChatGPT on a later test but did not clearly beat studying the material again. Whole classes received the same treatment in the university study, and both studies lost participants, making the results harder to interpret {% cite Makransky2025SenseMaking %}. Whether a tutor helps depends partly on what you would otherwise do with that study time.

**How and Why it Works:**
Explain a concept in your own words, then answer “why” and “how” questions. The ICAP framework describes learning activities that go beyond repeating supplied information: for example, explaining why a base case stops recursion or working out what happens if it is missing. It predicts benefits from making those connections, but a chatbot conversation does not automatically make you do that thinking {% cite ChiWylie2014ICAP %}. This also fits CLT's focus on building reusable mental patterns: explaining how the steps connect can help you organize knowledge for future problems. Keep the explanation small enough to reason through; useful effort still needs to fit within working memory {% cite sweller2011cognitive %}.

Use the AI's questions to inspect your explanation. Its apparent confusion or agreement is not a reliable verdict on your understanding; verify disputed claims with a trusted source or instructor.

**Example Prompt (Python):**
> "Pretend you are a first-year CS student who is learning inheritance in Python. I will explain it to you. Ask one 'why' or 'how' question when I use undefined jargon or skip a step. Distinguish questions about clarity from claims that my explanation is incorrect, and give me a concrete example to check."

## Prompting Patterns

The following research-informed approaches can help you specify a useful learning interaction. They offer design ideas, not guarantees that a well-formatted prompt produces durable learning.

In a six-week introductory programming study, researchers gave an AI tutor extra instructions to get students planning, checking their understanding, and reflecting. These changed some conversations, but did not clearly improve the main measures of success, including a quiz on programming concepts. The tutor already had rules to guide its help, and few students chose to take the quiz, so the results leave room for uncertainty {% cite Barth2026SteeringTutors %}. Judge your own prompts by what you can explain or solve afterward, as well as by how helpful the chat feels.

### Prompt Problems: Practicing Requirement Specification

**The Research Grounding:**
Denny and colleagues propose **“Prompt Problems”** as a programming exercise: look at example inputs and outputs, describe in your own words what the program should do, and test whether AI-generated code follows your description. This gives you a concrete way to practice turning examples into precise requirements. The paper describes classroom use and students' reactions; it does not establish that the exercise improves programming or problem-solving skills {% cite denny2024prompt %}.

**How and Why it Works:**
This activity gives you practice describing behavior precisely and checking cases. It complements writing and debugging code when those are also learning goals. Copying a complete specification into a chatbot skips the specification work.

**Example Activity (Python):**
> "Given a table of employees and a target summary table, first write your own specification: which rows count, how groups are combined, what happens with missing values, and how results are ordered. Create example and boundary cases. Then ask AI to implement your specification, test its output, and revise any ambiguous requirements."

<div class="action-box" markdown="1">
#### Use AI for:
* **Personalized feedback:** Ask for comments on a specific attempt and learning goal, then check the comments. Research reviews describe the promise of tailored help, while warning that AI feedback can be inaccurate and needs careful use {% cite Vorobyeva2025PersonalizedLearningThroughAI %}.
* **Adaptive scaffolding:** Request the amount of guidance you need to take the next step, and reduce it as you become more capable.
* **Worked examples and practice:** Study an explanation, complete missing steps, and then solve a related problem independently.
</div>

### Study Patterns That Preserve Useful Practice

Choose activities that practice the skill you want to retain. Productive challenge can help, but making a task harder is not an end in itself.

### The Alternative Approaches Pattern

**The Research Grounding:**
Garcia's review of programming education research describes using ChatGPT to generate several solutions and discuss their differences—for example, comparing a loop with recursion. The review stresses that generated code needs checking and that the evidence is still limited {% cite Garcia2025 %}. The exercise below applies that idea, without promising that it will make you a more flexible problem solver.

**How and Why it Works:**
Ask for alternatives, then make **your own** prediction about correctness, runtime, memory use, and readability before reading a comparison. CLT suggests keeping this comparison manageable: if three unfamiliar approaches overload you, begin with two short solutions and compare one feature at a time {% cite sweller2011cognitive %}. Having AI supply both the solutions and the evaluation can remove the reasoning you intended to practice.

**Example Prompt (C++):**
> "Show three ways to reverse a mutable string in C++: a standard library algorithm, two pointers, and recursion. Let me compare their time and auxiliary-space costs, including the recursion call stack, before you give feedback. Ask me to justify which I would choose for a stated constraint."

### Read, Make Your Own Notes, Then Clarify

**The Research Grounding:**
In a study of 344 students aged 14–15, students assigned to take notes understood and remembered more three days later than those assigned to use AI alone. Combining notes with AI also beat AI alone on comprehension and questions about stated facts, but did not clearly help students recall more without prompts. The study used two short passages and had no group that only read {% cite Kreijkes2026NotesReading %}. Although these younger students' results may not carry over directly to college, they give you a reason to keep making your own notes when studying with AI.

**How and Why it Works:**
Read a section and record its main idea, one example, and one uncertainty in your own words. Ask AI about the specific uncertainty, check its response against the source, and revise your notes yourself. Later, close the tools and reconstruct the explanation. This sequence is a practical adaptation: the experiment allowed notes and AI together; it did not test a fixed notes-first order.

**Example Prompt:**
> "Here is the passage and my own explanation. Identify one possible gap or misunderstanding and ask me a question about it before suggesting a correction. Point to the relevant passage so I can check your feedback."

### Faded Worked Examples

**The Research Grounding:**
When a topic is new, a solved example lets you follow the reasoning instead of guessing where to start. CLT's **worked-example effect** explains why this can help beginners: reducing unnecessary search leaves more working-memory capacity for understanding how the solution works {% cite sweller2011cognitive %}. A 2023 review combining results from mathematics studies found that worked examples improved performance by a moderate amount. Related research shows that guidance which helps a beginner can become unnecessary as they gain experience {% cite BarbieriEtAl2023WorkedExamples Kalyuga2003 %}.

**How and Why it Works:**
Start with a complete example, then try a similar one with the last step missing. Once you can complete and explain that step, try filling in more steps until you can solve a fresh problem yourself. Adjust the pace to your understanding. The mathematics review supports learning from worked examples overall; it included too few studies of gradually removing steps to tell how much that specific technique helped.

**Example Prompt (Java):**
> "Show me one worked example of tracing a recursive method, explaining each stack frame. Then give me a similar trace with the final two frames blank for me to fill in. Then give me a third problem with only the method and input, and ask me to produce the full trace before you show any answer."

### Rubric-First Feedback Loop

**The Research Grounding:**
In Fan and colleagues' writing study, students made stronger essay revisions with AI, but did not show a clear advantage on tests of their knowledge of the topic {% cite FanEtAl2025 %}. Reviews by Panadero and colleagues found that assessing your own work can strengthen your belief in your ability, with less clear evidence that it helps you manage your learning. That confidence gain does not establish better grades or more accurate judgments of your work {% cite PanaderoJonssonBotella2017SelfAssessment %}. The routine below lets you compare your own judgment with AI feedback; these studies did not test this exact routine.

Feeling confident is a reason to check, too. In one of Fernandes and colleagues' reasoning experiments, adults with AI answered more questions correctly. Yet both groups—with and without AI—thought they had answered about four more questions correctly out of twenty than they actually had. The study measured performance while using AI, rather than what people remembered later {% cite Fernandes2026PerformanceMetacognition %}. When preparing for an exam, compare your predicted score with your actual score on practice questions.

**How and Why it Works:**
Start by scoring your own draft, solution, or design against the rubric. Then ask AI to check one rating against evidence and suggest a revision goal. Decide whether its feedback is justified by looking at the relevant passage, code, or test result. You remain responsible for judging the work and making the revision.

**Example Prompt (Writing):**
> "Here is the rubric and my draft. Do not rewrite any prose. First ask me to self-assess my draft on each criterion. Then check one rating against a specific sentence or paragraph. If the evidence justifies a different rating, explain why; otherwise, explain what supports my rating. Suggest a revision goal if needed and ask what I will change."

**Example Prompt (Programming):**
> "Here is my solution and the grading rubric. Do not fix the code. Ask me to rate it first on correctness, edge cases, readability, and tests. Check one rating against the code and test evidence. Explain whether that evidence supports or challenges my rating, and suggest one targeted next step if needed."

### The “Generation-Then-Comprehension” Protocol

If you *do* use AI to generate a snippet of code because you are completely stuck, you must never blindly copy-paste it. 
Anthropic researchers Shen and Tamkin studied 52 developers learning an unfamiliar Python library. Those with AI help scored lower on the test immediately afterward. Within that group, some who sought explanations or help understanding concepts scored better than those who handed over more coding. The researchers called two observed patterns “Generation-Then-Comprehension” and “Hybrid Code-Explanation.” These were small groups whose habits the researchers observed, rather than assigned, so asking for explanations is not a proven way to prevent learning loss {% cite ShenTamkin2026 %}. If you use generated code, understanding and checking it is still your work to do.

<div class="action-box" markdown="1">
#### Actionable Tips:
* **Explain and check:** If AI supplies code, predict its behavior, explain the key decisions, and test edge cases. Ask for explanations beside the relevant lines. This applies CLT's **split-attention effect**: keeping related information together reduces the extraneous load of mentally matching a separate explanation to the code {% cite sweller2011cognitive %}. Investigate disagreements between its explanation and your mental model; either can be wrong. Then try a related task without the generated solution.
* **Make a relevant attempt:** Write down an approach, prediction, or specific question before seeking help when you have enough background to start. If you are missing prerequisites, get an explanation or example and then practice {% cite bjork2011making bjork2020desirable %}.
</div>

### Fading the Scaffold: The Goal is Independence

As your knowledge grows, adjust the support. CLT calls this the **expertise reversal effect**: detailed guidance that helps when you are new can become unnecessary or get in the way once you know what you are doing. As familiar patterns take less working-memory capacity, explanations you no longer need can add extraneous load {% cite Kalyuga2003 KalyugaPlass2025 %}. A complete recursion trace may help on your first attempt; later, try tracing the calls yourself and ask for feedback only where you are unsure. This research concerns instructional guidance in general, so it does not mean beginners should hand over whole assignments to AI.

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
