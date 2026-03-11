---
layout: blog-post
title: "[Draft] How Should I Use AI as a College Student?"
date: 2026-03-11
category: "For Students"
featured: true
image: "/img/genai.jpg"
image_p: "/img/genai_.jpg"
---


Many of my students come to me with this wonderful question: *How can I leverage AI as a tool to supercharge my education without accidentally outsourcing my own intelligence?*
So I decided to write my advice down in a succinct post for everyone.



But first a **disclaimer**: AI is evolving at rapid speed, and we still lack replicated, long-term, larger-scale data on its impact. What follows is my personal perspective, backed by the best available, still early research I could find. Please take it as a guide, not gospel.

## Motivation: Maximize your Learning
Some of you might be wondering: *Why bother grinding through the tedious process of learning basic computer science skills when AI can already do all my homework assignments in minutes?*

However, state-of-the-art research on real-world tasks shows that **AI is an amplifier of technical skills, not an equalizer** (<abbr title="DORA Team. (2025). State of AI-assisted Software Development 2025. Google Cloud / DORA">DORA 2025</abbr>, <abbr title="Paradis, E., Grey, K., Madison, Q., Nam, D., Macvean, A., Meimand, V., Zhang, N., Ferrari-Church, B., & Chandra, S. (2025). How much does AI impact development speed? An enterprise-based randomized controlled trial. International Conference on Software Engineering: Software Engineering in Practice (ICSE-SEIP '25)">Paradis et al. 2025</abbr>, <abbr title="Ma, Q., Koedinger, K., & Wu, T. (2026). Not Everyone Wins with LLMs: Behavioral Patterns and Pedagogical Implications for AI Literacy in Programmatic Data Science. CHI Conference on Human Factors in Computing Systems (CHI '26)">Ma et al. 2026</abbr>). 
When paired with AI, the productivity boost for people with more skills and experience is actually larger (<abbr title="DORA Team. (2025). State of AI-assisted Software Development 2025. Google Cloud / DORA">DORA 2025</abbr>, <abbr title="Paradis, E., Grey, K., Madison, Q., Nam, D., Macvean, A., Meimand, V., Zhang, N., Ferrari-Church, B., & Chandra, S. (2025). How much does AI impact development speed? An enterprise-based randomized controlled trial. International Conference on Software Engineering: Software Engineering in Practice (ICSE-SEIP '25)">Paradis et al. 2025</abbr>, <abbr title="Ma, Q., Koedinger, K., & Wu, T. (2026). Not Everyone Wins with LLMs: Behavioral Patterns and Pedagogical Implications for AI Literacy in Programmatic Data Science. CHI Conference on Human Factors in Computing Systems (CHI '26)">Ma et al. 2026</abbr>). 
This research tells a clear story: AI benefits those with more experience and stronger foundational skills much more than those who use AI as a replacement for skill aquisition.

This means that **as a college student, your main goal should be to  maximize your skills** so that, when you then add AI on top, you amplify a larger base of skills, and you also increase the amplification factor.
Unfortunately, AI as a technology often incentivizes behavior that reduces skill formation, if used inappropriately. 
On the other hand, if used correctly, it has the potential to rapidly accelerate the learning journey of students who use AI to cognitively challenge themselves more, not less.

This blog post is intended to be a guide for students who are trying to elevate their learning journey to be well prepared for a world in which AI is potentially increasingly replacing cognitive work and the bar we need to reach might be rising more and more with every release of more capable models.


## The Double-Edged Sword of Cognitive Offloading: Beneficial vs. Detrimental Use

To truly master how you integrate AI into your computer science education, we need to dive into the psychological engine room of your brain: *cognitive offloading*. 

**The Research:**
Cognitive offloading is using external tools to reduce your cognitive demand (Risko & Gilbert 2016). Examples of cognitive offloading include using a calculator to avoid having to do math in your head; setting a calendar reminder to avoid having to remember or constly think about the deadline; or asking ChatGPT to debug a script, because they enable you get a task done with less cognitive work on your end. 

However, whether this offloading helps or harms your education depends entirely on *what* you are offloading. Educational psychologists analyze this through the lens of Cognitive Load Theory, which divides our mental effort into two categories: *intrinsic load* (the inherent, necessary difficulty of the core concepts you are trying to learn) and *extraneous load* (unnecessary distractions or tedious tasks that don't contribute to the core learning goal) (Kalyuga & Plass 2025). 

Based on this framework, research categorizes AI cognitive offloading into two distinct paths:

#### The Bad: Detrimental Offloading (Outsourcing)
Detrimental offloading occurs when you use AI to bypass the *intrinsic* cognitive effort required to build long-term knowledge schemas in your brain (Lodge & Loble 2026). In computer science, this looks like asking an AI to "write a Python script to solve the traveling salesperson problem" when the entire point of the assignment is for you to learn algorithmic optimization. 

When you outsource the intrinsic load, you suffer several severe consequences:
*   **Bypassing Schema Construction:** By letting the AI generate the logic, you skip the "desirable difficulties" necessary to move knowledge from your limited working memory into your long-term procedural memory (de Bruin et al. 2023; Duplice 2025). 
A massive randomized experiment of students using AI to solve math problems found that while their immediate performance was excellent, their long-term, durable learning suffered significantly once the AI was removed because they never built the internal neural pathways to solve the problems themselves (Bastani et al. 2025).
Similar research conducted by Anthropic researchers shows similar results for coding tasks as well (Shen & Tamkin 2026).

*   **Metacognitive Laziness:** The frictionless convenience of GenAI powerfully incentivizes "metacognitive laziness"—a state where learners willingly abdicate their self-regulatory responsibilities, such as planning an approach, monitoring their own comprehension, and critically evaluating their work, simply handing those executive functions over to the machine (Fan et al. 2024).


#### The Good: Beneficial Offloading
Conversely, AI can be a massive catalyst for learning if used for *beneficial offloading*. This occurs when you deliberately delegate *extraneous* cognitive load to the AI, purposefully freeing up your limited working memory to focus entirely on the intrinsic, high-value work of learning (Lodge & Loble 2026). 

In a recent 12-week quasi-experimental study, researchers explicitly taught university students a "cognitive offload instruction" model. They instructed students to delegate lower-order tasks (like brainstorming basic ideas or checking grammar/syntax) to generative AI, thereby compelling the students to focus their mental energy on higher-order analysis, structural evaluation, and logical coherence. The students who practiced this targeted, beneficial offloading demonstrated significantly greater gains in critical thinking and produced higher-quality work than the control group (Hong, Vate-U-Lan, & Viriyavejakul 2025). Similarly, studies show that when AI is used to offload lower-order tasks while students engage in shared metacognitive reflection, academic achievement is significantly enhanced (Iqbal et al. 2025). 

<div class="action-box" markdown="1">
#### **Actionable Tips:**
*   **Conduct a Cognitive Cost-Benefit Analysis Before Prompting:** Before you ask an AI for help, explicitly define the learning objective of your current task. Ask yourself: "Is this the core algorithmic logic I am supposed to be mastering, or is this just tedious setup?" 
*   **Offload the Boilerplate, Guard the Architecture:** If permitted by your instructor, be aggressive about offloading extraneous load (i.e., tedious task you could easily but that just consume your time). For example, use AI to generate dummy data for your databases, write simple HTML/CSS boilerplate, auto-complete the algorithm you've already implemented in the past, or format your inline comments. But viciously guard your system architecture. You must be the one choose the data structures, define the edge cases, and map out the modules, interfaces, and database schemas. 
</div>


### References
*   **DORA 2025**  - [DORA Team. (2025). State of AI-assisted Software Development 2025. Google Cloud / DORA](https://dora.dev/research/2025/dora-report/)

*   **Ma et al. 2026** - [Ma, Q., Koedinger, K., & Wu, T. (2026). Not Everyone Wins with LLMs: Behavioral Patterns and Pedagogical Implications for AI Literacy in Programmatic Data Science. *CHI Conference on Human Factors in Computing Systems (CHI '26)*](https://arxiv.org/abs/2509.21890)

*   **Paradis et al. 2025** - [Paradis, E., Grey, K., Madison, Q., Nam, D., Macvean, A., Meimand, V., Zhang, N., Ferrari-Church, B., & Chandra, S. (2025). How much does AI impact development speed? An enterprise-based randomized controlled trial. *International Conference on Software Engineering: Software Engineering in Practice (ICSE-SEIP '25)*](https://arxiv.org/abs/2410.12944)


*   **Shen & Tamkin 2026** - [Shen, J. H., & Tamkin, A. (2026). How AI Impacts Skill Formation.](https://arxiv.org/abs/2601.20245)

