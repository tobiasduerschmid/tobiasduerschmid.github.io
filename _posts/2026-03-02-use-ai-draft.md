---
layout: blog-post
title: "[Notes] How Should I use AI as a College Student? A Science-Backed Guide for CS Students"
date: 2026-03-01
category: "Testing"
permalink: /blog/use_ai_draft/
---

## Research & Tips

Here is the synthesized meta-analysis and guide for students on how to use AI effectively for learning, categorized by cognitive processes, tool-level practices, and human factors.

### 1. Cognitive & Learning Processes

**Guard Against Cognitive Offloading and "Metacognitive Laziness"**
While AI tools like ChatGPT are highly efficient at reducing the immediate cognitive load required to find information, relying on them to do the thinking for you leads to *cognitive offloading*—a phenomenon where learners delegate cognitive tasks to external aids, severely reducing deep, reflective thinking {% cite Gerlich2025 %}. When students bypass the struggle of synthesizing information from memory, they risk falling into "metacognitive laziness", hindering long-term knowledge transfer and retention {% cite Kosmyna2025 %}. 
*   **Tip:** Use AI to *assist* the learning process, not to bypass it. If utilizing AI to generate summaries or brainstorm, you must actively integrate the new knowledge. For example, rewrite the AI's core concepts in your own words without looking at the screen to ensure internal knowledge retention.

**Beware of the "Illusion of Understanding"**
AI assistants are prone to promoting an "illusion of explanatory depth", leading students to believe they possess a greater understanding of a task than they actually do {% cite MacnamaraEtAl2024 %}. Because AI provides highly synthesized, singular, and confident responses, it masks the complexity of a topic. 
*   **Tip:** Test your independent knowledge. Periodically step away from the AI and attempt to solve complex problems or articulate theories on your own. As noted by researchers, students must focus on developing cognitive skills "independent of AI" to prevent skill decay {% cite MacnamaraEtAl2024 %}.

**Engage in "Deep Learning" rather than Shallow Task Completion**
The *ISAR model* (Inversion, Substitution, Augmentation, Redefinition) highlights a significant risk called the "inversion effect", where AI intended to support deep learning actually reduces cognitive processing because students merely use it to quickly finish tasks {% cite BauerEtAl2025 %}. 
*   **Tip:** Shift your goal from *task completion* to *knowledge construction*. Rather than asking an AI to write an essay or solve a math problem, ask it to act as a Socratic tutor. Prompt the AI to "ask me guiding questions to help me arrive at the solution myself".

### 2. Technological & Tool-Level Practices

**Employ the "Search as Learning" (SAL) Framework and Verify Everything**
Traditional search engines require users to evaluate diverse viewpoints, which builds critical thinking. LLMs, conversely, synthesize answers, which can discourage lateral thinking {% cite Kosmyna2025 %}. Furthermore, AI models frequently suffer from "hallucinations" or confidently present inaccurate, biased information {% cite FanEtAl2025 %}.
*   **Tip:** Practice critical evaluation by treating AI outputs as a starting point, not a final truth. Actively cross-reference AI-generated facts, dates, and claims with authoritative external sources like academic journals or textbooks {% cite LeeEtAl2025 %}. 

**Avoid the "Error-Prompting Cycle" in Programming and Technical Tasks**
In computer science and STEM education, students often fall into a vicious cycle where they submit incorrect code to an AI, receive a fix, and implement it without understanding the underlying logic {% cite RaheMaalej2025 %}. This heavy reliance results in passive consumption rather than active problem-solving.
*   **Tip:** When using AI for coding or technical troubleshooting, do not ask for the full corrected solution. Instead, ask the AI to explain the *concept* behind the error. Furthermore, practice writing in-code comments to self-explain the AI-generated code, forcing critical engagement with the operational mechanisms of the solution {% cite Garcia2025 %}. 

**Leverage AI for Comparative Analysis and Immediate Feedback**
AI is incredibly effective when used to augment learning through immediate, personalized feedback {% cite VieriuPetrea2025 %}. 
*   **Tip:** Generate multiple different solutions to a single problem using AI and compare them. Analyzing the differences in efficiency, approach, and style between different AI solutions (or between human-authored and AI-authored work) trains higher-order evaluation and synthesis skills {% cite Garcia2025 %}.

### 3. Human Factors, Ethics, and Well-being

**Prevent "AI Addiction" and Protect Academic Integrity**
Frequent, unmonitored use of generative AI correlates positively with AI addiction and an increased tolerance for academic dishonesty {% cite AbbasEtAl2025 %}. Students with lower academic self-efficacy are particularly vulnerable to relying entirely on AI to manage academic stress, which stunts their creative and cognitive development {% cite Kosmyna2025 %}.
*   **Tip:** Set strict boundaries on your AI usage. Use AI for brainstorming, outlining, and conceptual clarification, but ensure that the core intellectual contribution and final phrasing remain your own. 

**Manage Technostress and Maintain Human Collaboration**
Excessive reliance on AI for academic and recreational communication can reduce face-to-face social interactions, which negatively impacts emotional intelligence and interpersonal skills {% cite KlimovaPikhart2025 %}. Engaging with an empathy-lacking technology can also increase feelings of isolation.
*   **Tip:** Balance your AI-assisted study sessions with human collaboration. Form study groups, engage in peer reviews, and discuss concepts with instructors to build the communication and collaborative skills that AI cannot replicate. 

---

### Divergent Perspectives in the Literature
A fascinating contradiction exists within the literature regarding AI's impact on **cognitive load**. 
*   *Perspective A (The Efficiency Advocate):* Some researchers argue that by taking over lower-level tasks (like syntax correction or searching for baseline facts), AI reduces extraneous cognitive load, freeing up mental resources for higher-order, germane problem-solving and creativity {% cite Gerlich2025 AlanaziEtAl2025 %}. 
*   *Perspective B (The Cognitive Atrophy Warning):* Conversely, other scholars argue that this exact reduction in cognitive friction is detrimental. Because the AI makes learning feel "effortless," it bypasses the productive struggle necessary for schema formation in the brain, leading to lower-quality reasoning, superficial fluency, and the erosion of independent problem-solving skills {% cite Kosmyna2025 MacnamaraEtAl2024 %}. 

**Synthesis for the Student:** To reconcile these views, students must deliberately inject "[desirable difficulties](https://www.youtube.com/watch?v=gtmMMR7SJKw)" back into their learning process. If AI makes gathering information frictionless, the student must manually apply the friction during the synthesis and application phases to ensure true learning takes place.


## NotebookLM 

I often use NotebookLM and provide one with all course content to my students to assisted learning.

---





## Part 2

I want to address the elephant in the room: Generative AI. Tools like ChatGPT, GitHub Copilot, and Claude are fundamentally changing how we write software. In the industry, they are powerful accelerators. But in an educational setting, they are a double-edged sword. 

Used correctly, AI is an incredible *cognitive exoskeleton* that can personalize your learning and help you tackle highly complex projects. Used poorly, it becomes a crutch that bypasses the exact cognitive processes you need to become a competent software engineer. 

To help you navigate this, I have synthesized the latest empirical research and learning science on how AI impacts skill formation. Based on these findings, here is Part 1 of my actionable guidelines on how you *should* be using AI to maximize your learning.


### 1. The Science of Learning: Escaping the "Performance Paradox"

**The Research:** 
Learning science is built on the concept of *desirable difficulties* {% cite bjork2011making %}. To move knowledge from your short-term working memory into long-term procedural memory—what neuroscientists call building "neural manifolds"—your brain requires cognitive struggle and prediction errors {% cite OakleyEtAl2025 %}. 

However, studies across high school and university programming courses consistently identify a *performance paradox*: when students use AI to generate solutions, their immediate task performance improves, but their long-term learning and skill retention significantly decline when tested independently without the AI {% cite BastaniEtAl2025 YanEtAl2025 %}. Because AI provides highly fluent, articulate code instantaneously, it creates a dangerous *illusion of competence* {% cite Aiersilan2025 %}. Students mistake the AI's ability to generate code for their own ability to understand it. 

**Actionable Tips:**

*   **Demand Socratic Scaffolding, Not Solutions:** 
    Do not ask AI to "solve this problem" or "write this function." This robs you of the *generation effect* needed for deep learning {% cite Duplice2025 %}. Instead, force the AI to act as your *Socratic Tutor* {% cite SunilThakkar2024 %}. 
    *   *How to do it:* Engineer your prompt to establish boundaries. Say, *"Act as my senior computer science tutor. I am trying to implement a recursive merge sort in Java, but I am getting a StackOverflowError. Do NOT write the corrected code for me. Instead, ask me a guiding question about my base case to help me figure out the flaw myself."* This keeps you in the driver's seat and preserves the productive struggle required for skill acquisition.
*   **The "Generation-Then-Comprehension" Protocol:** 
    If you *do* use AI to generate a snippet of code because you are completely stuck, you must never blindly copy-paste it. Research shows that students who simply delegate code generation to AI suffer severe skill decay {% cite ShenTamkin2026 %}.
    *   *How to do it:* Adopt a strict personal rule. If AI writes five lines of code, you must immediately read it, trace the variables manually on a piece of paper or whiteboard, and then explain it back to the AI line-by-line. Prompt the AI: *"I want to make sure I understand the list comprehension you just generated. I believe the first part filters out the null values, and the second part applies the lambda function. Is my understanding correct?"* If you cannot fully explain the underlying architecture of what you just copied, you must delete it.

### 2. Managing Cognitive Load: Strategic Offloading

**The Research:**
*Cognitive Load Theory* dictates that human working memory is severely limited {% cite sweller2011cognitive %}. AI acts as a mechanism for *cognitive offloading*—delegating mental tasks to a machine. Educational research categorizes this into two types: *detrimental offloading* (outsourcing the core algorithmic reasoning and schema construction) and *beneficial offloading* (outsourcing distracting, lower-order tasks) {% cite LodgeLoble2026 %}. When students are explicitly taught to offload lower-order tasks while retaining the high-level analysis for themselves, their critical thinking skills actually improve {% cite HongEtAl2025 %}.

**Actionable Tips:**

*   **Offload the Extraneous (Syntax & Boilerplate):** 
    Use AI to handle the *extraneous* cognitive load of programming so you can save your mental energy for the hard stuff.
    *   *How to do it:* Use AI as a rapid documentation retrieval tool or syntax translator. Ask it to write boilerplate setup code, format your comments, generate dummy data for testing, or write complex Regular Expressions (Regex). You can also use it to decipher cryptic compiler errors. Prompt it: *"Translate this C++ Segmentation Fault into plain English and tell me which line is causing the memory leak."*
*   **Guard the Intrinsic (Architecture & Algorithmic Logic):** 
    Never offload the *intrinsic* cognitive load. Designing the system architecture, selecting the right data structures (e.g., choosing a Hash Map over a Linked List for O(1) lookups), and mapping out the algorithmic logic is the "heavy lifting" of computer science.
    *   *How to do it:* Before you even open your IDE or ChatGPT, map out your program's logic on paper using pseudocode or flowcharts. Once you have built the mental schema for *how* the program should work, then you can use AI to help you remember *what* the specific syntax is to make it happen.

### 3. Fighting "Metacognitive Laziness" in Debugging

**The Research:**
Because AI provides instant answers, it frequently triggers *metacognitive laziness*—a state where learners stop planning, monitoring, and evaluating their own work {% cite FanEtAl2025 %}. In programming, this manifests as a highly destructive pattern known as *Iterative AI Debugging* {% cite RaheMaalej2025 %}. In this pattern, a student encounters a bug, blindly pastes the error into the AI, copies the suggested fix, runs it, and if it fails, pastes the new error back into the bot. This creates a mindless, accelerating loop that completely bypasses hypothesis generation—the core skill of debugging—leaving students with an accumulation of "cognitive debt" {% cite ShenTamkin2026 Kosmyna2025 %}.

**Actionable Tips:**

*   **The Hypothesis-First Rule (Think-Articulate-Reflect):** 
    Stop treating the AI as an oracle that fixes your mess. You must form your own hypothesis *before* engaging the AI {% cite Ma2026 %}.
    *   *How to do it:* When your code breaks, take a breath. Look at the traceback. Formulate a guess as to why it broke. Then, write a prompt that tests your hypothesis: *"I am getting a KeyError in Pandas. I hypothesize it is because the dataframe drops the 'price' column during my inner merge step. Can you confirm if my hypothesis is correct, and explain why the merge is dropping it?"* This forces you to remain cognitively engaged.
*   **Avoid the "You Tell Me" Habit:** 
    Never just paste a block of broken code and type "fix it." This trains your brain to give up at the first sign of friction. 
    *   *How to do it:* Treat the AI like a rubber duck that talks back. Use it to help you isolate the problem space, not to solve it. Prompt: *"My React component is re-rendering infinitely. I know it has to do with the useEffect dependency array. Can you explain the rules of dependency arrays so I can find my mistake?"*


### 4. Shifting Skills: From Code Generation to "Task Stewardship"

**The Research:**
As AI tools become deeply embedded in modern software development, the day-to-day cognitive effort of an engineer is shifting. Research on knowledge workers reveals that the effort spent on generating raw material (typing out syntax) is decreasing, while the cognitive effort required for *information verification, response integration, and task stewardship* is drastically increasing {% cite LeeEtAl2025 %}. 

Furthermore, while AI agents can achieve high functional correctness, a significant portion of their solutions contain latent defects, logic errors, or security vulnerabilities {% cite ZhaoEtAl2025Safe %}. Relying on AI without deep review creates what industry leaders call "trust debt"—a growing pile of code that functions superficially but is not truly understood by the team maintaining it {% cite Osmani2025 %}.

**Actionable Tips:**

*   **Shift from "Writer" to "Adversarial Reviewer":** 
    You must stop viewing AI as an infallible oracle and start treating it like a highly enthusiastic but frequently misguided junior developer. Your primary job is no longer just writing code; it is *stewardship*. You are responsible and accountable for every line of code the AI generates.
    *   *How to do it:* Never accept a pull request (or homework submission) from your AI without an adversarial review. Actively look for edge cases the AI missed. Ask yourself, "If this code were malicious, how would it break my system?"
*   **Apply the FLUF(F) Test for Critical Evaluation:**
    To systematically evaluate AI outputs, use the FLUF(F) framework, which is designed to catch common AI infractions {% cite Parker2025 %}. Whenever AI gives you a block of code, evaluate it against these domains:
    *   **F - Format:** Is the code structured cleanly? Does it follow your project's specific conventions and architectural layout?
    *   **L - Language:** Is the syntax actually correct for the specific version of the framework you are using? 
    *   **U - Usability:** Did the AI hallucinate libraries, APIs, or methods that do not exist? (This is incredibly common).
    *   **F - Fanfare (Audience/Constraints):** Does the code meet the specific constraints of your assignment, or did it generate a bloated, over-engineered enterprise solution for a simple script?
    *   **F - Function (Expertise):** Put on your "expert lens." Does the underlying algorithmic logic actually solve the problem securely and efficiently?

### 5. The "Vibe Coding" Debate vs. The Foundational Grind

**The Research:**
There is a massive debate happening right now in the software engineering community around a concept known as *Vibe Coding*. Coined by AI researcher Andrej Karpathy, Vibe Coding is a paradigm where developers relinquish direct syntactic control, write high-level natural language prompts, and let AI agents (like Cursor or Claude) handle the implementation {% cite Aiersilan2025 %}. Proponents argue that rote syntax memorization is becoming obsolete, and students should instead focus entirely on high-level system architecture and prompt engineering {% cite Eric2025 %}.

However, educational researchers warn heavily against jumping straight into Vibe Coding as a novice. Studies show that when beginners use AI to bypass the foundational struggle of coding, they suffer from a severe *illusion of competence* {% cite kruger1999unskilled %}. They mistake the AI's functional output for their own mastery, leading to a complete inability to extend, modify, or fix the code unaided. Researchers measure this via the *Explainability Gap*: the mathematical disconnect between the complexity of the AI-generated code and the student's actual conceptual understanding of it {% cite Aiersilan2025 %}. 

**Actionable Tips:**

*   **Mind Your "Explainability Gap":**
    You must ensure your conceptual understanding grows at the same pace as your codebase. 
    *   *How to do it:* If your AI generates a highly complex `reduce` function or a nested asynchronous loop, and you cannot articulate the control flow on a whiteboard, your Explainability Gap is too high. You are engaging in "black-box" usage. Force the AI to break the code down until your mental model perfectly matches the code's complexity.
*   **Practice "Graduated Integration" (Earn Your AI Privileges):**
    Do not use Vibe Coding to learn fundamental concepts. 
    *   *How to do it:* In your early courses (Data Structures, basic Algorithms), limit your AI use strictly to conceptual explanations and syntax reminders. You must build your internal "biological schemas" by manually wrestling with pointers, loops, and memory management {% cite OakleyEtAl2025 %}. Only once you have achieved a strong baseline of retention (e.g., in your upper-level systems or software engineering courses) should you transition to full AI-assisted engineering to accelerate your output {% cite Aiersilan2025 %}.

### Conclusion

Generative AI is not a shortcut to competence; it is a force multiplier. If you multiply a solid foundation of computer science knowledge, you get exceptional software engineering. If you multiply a lack of foundational knowledge and metacognitive laziness, you get fragile, buggy systems that you do not understand and cannot fix. 

Use these tools to accelerate your exploration, handle the boring boilerplate, and act as your personal Socratic tutor. But remember: the ultimate goal of your college education is not to produce code. It is to produce a highly capable, analytical mind. Protect that process.

## New
Cognitive Pedagogy in the AI Era: High-Impact Learning Techniques for Computer Science Students

1. Introduction: The Evolving Cognitive Landscape of Computing Education

The integration of Generative AI (GenAI) into undergraduate Computer Science (CS) education represents a strategic pivot point that necessitates a fundamental reevaluation of technical expertise development. Historically, programming education focused on "material production"—the manual construction of algorithms and syntax. However, the ubiquity of Large Language Models (LLMs) requires a shift toward "task stewardship" to preserve the critical thinking faculties of the learner (Lee et al. 2025). This stewardship is defined by three distinct sub-tasks: information verification, response integration, and the active oversight of the generative process.

This shift addresses a profound pedagogical tension between AI-driven efficiency and "cognitive offloading." As established in the "ironies of automation," mechanizing routine tasks creates a risk of cognitive atrophy (Bainbridge 1983). If a student offloads routine syntax and logic to an AI, they fail to develop the "cognitive musculature" required for "exception-handling"—the ability to troubleshoot complex architectural failures that GenAI cannot currently resolve. To mitigate this risk, educators and students must adopt evidence-based techniques rooted in Cognitive Load Theory and Bloom’s Taxonomy to ensure that AI serves as a catalyst for, rather than a replacement of, rigorous mental effort.

2. Technique 1: Self-Explanation and the "Rubber Duck" Facilitator

Active learning is the primary vehicle for fostering "Germane Cognitive Load"—the beneficial mental effort required for robust schema development (Dee 2026). True comprehension occurs when information is successfully transitioned from working memory into long-term memory through active processing.

The Research

John Sweller’s Cognitive Load Theory categorizes mental effort into Intrinsic (task difficulty), Extraneous (poor design), and Germane (learning-focused) loads. Promoting germane load is essential for building the mental schemas that constitute expertise. In software engineering, the "rubber ducking" method involves explaining code line-by-line to identify logic errors. In the GenAI era, the model should be reframed as a "rubber duck that talks back," facilitating self-explanation rather than merely providing answers (Drosos et al. 2024).

The Recommendations

When approaching a new library or debugging a function, students must adhere to a strict pedagogical sequence:

* Phase 1: Zero-AI Production. You are explicitly forbidden from using AI to generate the initial code. You must first attempt to articulate the logic and structure independently.
* Phase 2: Probing Interaction. Use GenAI exclusively as a "probing agent" to test your own understanding (Richards Maldonado et al. 2023).

AI Prompt:

"I am working on this Python function [insert code]. Instead of fixing it or providing a solution, act as a probing agent. Ask me a series of targeted questions that force me to explain the logic of each line until I can identify the bug or the implementation requirement myself."

Rationale

This strategy reframes GenAI from a solution-provider into a scaffolding tool. By demanding self-explanation, the prompt preserves independent problem-solving skills and ensures the student remains the primary agent of cognition (Lee et al. 2025).

3. Technique 2: Scaffolding via "Segmented Information" for Software Architecture

Managing "Intrinsic Cognitive Load" is critical when students face the high inherent difficulty of complex systems architecture (Dee 2026).

The Research

The cognitive strategy of "Segmenting Information" involves decomposing complex topics into smaller, digestible parts to prevent cognitive overload. By building understanding incrementally, students avoid the "mechanized convergence" that occurs when they become overwhelmed and resort to uncritical copy-pasting of AI-generated monolithic architectures.

The Recommendations

When facing a Software Construction lab, such as building a systems-level application in C, use GenAI to generate a structural "roadmap" rather than the final code.

AI Prompt:

"Decompose the architectural requirements for a multi-threaded web server in C into 5 sequential learning modules. For each module, provide a checklist of low-level concepts and system calls I must master before moving to the next. Do not provide the implementation code."

Rationale

This manages intrinsic load by providing necessary "scaffolding" without bypassing the learning process. It compels the student to focus on mastering individual components of the architecture before attempting synthesis (Dee 2026).

4. Technique 3: Analytical Reasoning through "Stewardship" and Oversight

The modern CS student must transition from "task execution" to "task stewardship," shifting mental effort toward verification and integration (Lee et al. 2025).

The Research

A critical "confidence effect" influences the enaction of critical thinking. Research indicates that high confidence in a GenAI tool often functions as a barrier to critical thought, inducing "automation bias" where users favor fast, heuristic-based solutions over practical, slower analysis (Lee et al. 2025; Zhai et al. 2024). Conversely, high self-confidence in one’s own technical skills is the primary driver for the enaction of critical thinking. Students must be warned against their own cognitive shortcuts that favor AI "certainty" over their own technical instincts.

The Recommendations

Adopt a "co-audit" workflow for debugging complex codebases (Gordon et al. 2023). Once a solution is generated, apply the "Evaluation" phase of Bloom’s Taxonomy, which should represent 70% of the total time spent on the task.

AI Prompt:

"Critique the following C++ code for memory leaks, race conditions, and violations of the DRY (Don't Repeat Yourself) principle. Present the critique as a numbered list of potential risks and logical inconsistencies for me to manually verify against the documentation."

Rationale

Demanding an evaluation rather than a fix forces the student into the role of a steward. This demands the highest level of cognitive effort—Evaluation—preventing the "mechanized convergence" of generic, low-effort work (Sarkar 2023; Zhai et al. 2024).

5. Technique 4: Information Verification and Triangulation (The Anti-Hallucination Guard)

The prevalence of "AI hallucinations" makes critical and analytical thinking an absolute strategic necessity to counter inaccurate outputs and algorithmic biases (Zhai et al. 2024).

The Research

Over-reliance on unverified AI leads to profound errors in decision-making and research. A systematic review of 178 AI-generated references revealed that 69 lacked a valid Digital Object Identifier (DOI), and 28 were entirely non-existent (Zhai et al. 2024 via Athaluri et al. 2023). Furthermore, students often fall prey to heuristics, favoring "fast and optimal" solutions even when they are aware of potential ethical or factual issues.

The Recommendations

When researching technical reports or security protocols, you must cross-reference every AI claim against authoritative databases such as IEEE Xplore or ScienceDirect.

AI Prompt:

"List the primary security vulnerabilities of the [Specific Protocol]. For every claim, provide a possible search query I can use in IEEE Xplore to find the original peer-reviewed documentation. Acknowledge that you may hallucinate these references and provide the search queries for my manual verification."

Rationale

This methodology mandates "information verification" rather than uncritical acceptance (Lee et al. 2025). It grounds the AI’s generative capabilities in empirical evidence and counters the tendency toward efficient but flawed cognitive shortcuts.

6. Technique 5: Critical Integration and Response Synthesis

The final stage of the cognitive process is "Synthesis"—the ability to combine disparate elements into a coherent, context-specific whole (Bloom et al. 1956).

The Research

While GenAI simplifies content creation, students must invest significant effort in "Critical Integration" and "Response Integration." This involves aligning output with specific scientific styles or implementation constraints. Failing to do so results in "mechanized convergence," where all students produce identical, low-value work (Sarkar 2023; Lee et al. 2025).

The Recommendations

When drafting a Software Requirements Specification (SRS), use the "Multi-Draft Synthesis" technique to evaluate differentiators and add human value.

AI Prompt:

"Generate three distinct explanations of how a hash table handles collisions, comparing Chaining, Open Addressing (Linear Probing), and Cuckoo Hashing. Identify which of these three most accurately aligns with the memory constraints and cache-locality requirements I have provided in [insert file]. Justify your selection."

Rationale

This prompt demands "Analysis" and "Synthesis" level effort. By forcing a comparison between multiple high-fidelity options, the student avoids the trap of accepting a generic "stochastic" response and instead exerts personal judgment (Sarkar 2023).

7. Conclusion: The Path Toward Responsible Human-AI Augmentation

In the AI era, Computer Science students must view the model as a "coach" that challenges their logic, rather than an "autopilot" that steers them toward cognitive atrophy (Sarkar et al. 2024). The goal of professional education remains the development of independent thinking and advanced problem-solving skills. By adopting the role of "steward" rather than "user," students can successfully navigate the transition from material production to critical integration. Ultimately, maintaining your "cognitive musculature" through rigorous verification and integration is the only safeguard against the deterioration of professional faculties in an automated world (Bainbridge 1983; Lee et al. 2025).

8. Bibliography

Bainbridge, Lisanne. "Ironies of Automation." In Analysis, Design and Evaluation of Man–Machine Systems, 129–135. Elsevier, 1983.

Bloom, Benjamin S., Max D. Engelhart, Edward J. Furst, Walquer H. Hill, and David R. Krathwohl. Taxonomy of Educational Objectives: The Classification of Educational Goals: Handbook I: Cognitive Domain. New York: D. McKay, 1956.

Dee, Ellen. "Understanding Cognitive Load Theory in Instructional Design." Learnt.ai, 2026. https://learnt.ai/blog/understanding-cognitive-load-theory/.

Drosos, Ian, Advait Sarkar, Xiaotong Xu, Carina Negreanu, Sean Rintel, and Lev Tankelevitch. "'It’s like a rubber duck that talks back': Understanding Generative AI-Assisted Data Analysis Workflows through a Participatory Prompting Study." In Proceedings of the 3rd Annual Meeting of the Symposium on Human-Computer Interaction for Work, 1–21. ACM, 2024.

Gao, Catherine A., Frederick M. Howard, Alexander T. Pearson, and James S. Chen. "Comparing Abstracts Written by ChatGPT and Humans: An AI Detection and Reviewer Study." ArXiv, 2022.

Gordon, Andrew D., Carina Negreanu, José Cambronero, Rasika Chakravarthy, Ian Drosos, Hao Fang, Bhaskar Mitra, Hannah Richardson, Advait Sarkar, Stephanie Simmons, Jack Williams, and Ben Zorn. "Co-audit: Tools to Help Humans Double-check AI-generated Content." ArXiv, 2023.

Gsenger, Robin, and Tomaž Strle. "Automation Bias and Anthropomorphism in AI-Assisted Decision Making." Philosophies 6, no. 1 (2021).

Lee, Hao-Ping (Hank), Advait Sarkar, Lev Tankelevitch, Ian Drosos, Sean Rintel, Richard Banks, and Nicholas Wilson. "The Impact of Generative AI on Critical Thinking: Self-Reported Reductions in Cognitive Effort and Confidence Effects From a Survey of Knowledge Workers." In Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems (CHI ’25). ACM, 2025.

Mbalaka, C. "Ethical Issues of AI Dialogue Systems: A Review." Smart Learning Environments, 2023.

Richards Maldonado, Liam, Azza Abouzied, and Nancy W. Gleason. "ReaderQuizzer: Augmenting Research Papers with Just-In-Time Learning Questions to Facilitate Deeper Understanding." In Companion Publication of the 2023 Conference on Computer Supported Cooperative Work and Social Computing, 391–394. ACM, 2023.

Sarkar, Advait. "Exploring Perspectives on the Impact of Artificial Intelligence on the Creativity of Knowledge Work: Beyond Mechanised Plagiarism and Stochastic Parrots." In Proceedings of the 2nd Annual Meeting of the Symposium on Human-Computer Interaction for Work, 1–17. ACM, 2023.

Sarkar, Advait. "AI Should Challenge, Not Obey." Communications of the ACM 67, no. 10 (2024): 18–21.

Sarkar, Advait, Xiaotong (Tone) Xu, Neil Toronto, Ian Drosos, and Christian Poelitz. "When Copilot Becomes Autopilot: Generative AI’s Critical Risk to Knowledge Work and a Critical Solution." In Proceedings of the Annual Conference of the European Spreadsheet Risks Interest Group (EuSpRIG 2024), 2024.

Zhai, Chunpeng, Santoso Wibowo, and Lily D. Li. "The Effects of Over-reliance on AI Dialogue Systems on Students' Cognitive Abilities: A Systematic Review." Smart Learning Environments 11, no. 28 (2024).
