---
layout: blog-post
title: "[Draft] How Should I Use AI as a College Student? — A Science-Backed Guide for CS Students"
date: 2026-03-11
category: "For Students"
featured: true
image: "/img/genai.jpg"
image_alt_text: "Student working on a computer with a robot sitting next to him. They both look at a digital screen. University buildings in the background. Soft evening light"
---

**Many of my students come to me with this wonderful question: "*How can I leverage AI as a tool to supercharge my education without accidentally outsourcing my own intelligence?*"
In my opinion, this will fundamentally impact how much the current generation of college students will take out of their educational experience.
So I decided to write my advice down in a succinct, evidence-based post for everyone.**


But first a **disclaimer**: AI is evolving at rapid speed, and we still lack replicated, long-term, larger-scale data on its impact. What follows is my personal perspective, backed by the best available, still early research I could find. Please take it as a guide, not gospel.

## Motivation: Maximize your Learning
It's 7:00 PM on a Friday. 
Your friends want to go watch a movie. 
But you're sitting here debugging your C++ program that is throwing a cryptic segmentation fault. 
You have stared at the same while loop for twenty minutes, and the temptation to paste the entire file into an LLM with the prompt "fix this" is overwhelming. 
This is what the real professionals would do, so why shouldn't you?
Because you would rob your brain of the exact friction it needs to become a skilled software engineer.


State-of-the-art research on real-world tasks shows that **AI is an amplifier of technical skills, not an equalizer** {% cite DORA2025 Paradis2025 Ma2026 Prather2024WideningGap %}.
When paired with AI, the productivity boost for developers with more skills and experience is actually larger {% cite Paradis2025 Prather2024WideningGap %}. 
This research tells a clear story: AI benefits those with *more experience* and *stronger foundational skills* much more. 
AI enables skilled developers to compound their knowledge and productivity by critically evaluating and learning from AI outputs, while novices who have not successfully developed these skills fall further and further behind.

This means that **as a college student, your main goal should be to  maximize your skills** so that, when you then add AI on top, you amplify a larger base of skills and keep compounding.
Unfortunately, AI as a technology often incentivizes behavior that reduces skill formation, if used inappropriately. 
To use an analogy: **Using AI to do the heavy lifting in your coursework is like sending a robot to the gym instead of working out yourself**. 

<div style="text-align: center; position: relative; margin: 20px auto; max-width: 750px;">
  <img src="{{ '/img/genAI_gym_bw.jpg' | prepend: site.baseurl }}" onmousedown="this.src='{{ '/img/genAI_gym.jpg' | prepend: site.baseurl }}'" onmouseup="this.src='{{ '/img/genAI_gym_bw.jpg' | prepend: site.baseurl }}'" onmouseout="this.src='{{ '/img/genAI_gym_bw.jpg' | prepend: site.baseurl }}'" alt="Student standing relaxed in a gym while watching a robot lift heavy weights. Other students are working out actively in the gym. University buildings in the background." style="width: 100%; height: auto; border-radius: 12px; display: block;">
  <div style="position: absolute; top: 0; left: 0; right: 0; background: rgba(0, 0, 0, 0.7); color: white; padding: 4px; border-top-left-radius: 12px; border-top-right-radius: 12px; font-weight: 500; font-size: 1.1em; line-height: 1.2;">
    <strong>"Wow, I just discovered this AI that makes my workout so much easier and faster!"</strong>
  </div>
</div>

Just like a physical workout is only effective if it is strenuous enough to challenge your muscles, learning is only effective if it challenges your mind via "[desirable difficulties](https://www.youtube.com/watch?v=gtmMMR7SJKw)" {% cite bjork2011making bjork2020desirable brown2014MakeItStick %}.

On the other hand, if used correctly, AI has the potential to rapidly accelerate the learning journey of students who use AI to remove undesirable difficulties while increasing desirable difficulties.

This blog post is intended to be a guide for students who are trying to elevate their learning journey to be well prepared for a world in which AI is potentially increasingly replacing cognitive work and the bar we need to reach might be rising more and more with every release of more capable models.


## The Double-Edged Sword of Cognitive Offloading: Beneficial vs. Detrimental Use

To truly master how you integrate AI into your computer science education, we need to dive into the learning science theory of *cognitive offloading*. 

**The Research:**
Cognitive offloading is using external tools to reduce your cognitive demand {% cite RiskoGilbert2016 %}. Examples of cognitive offloading include using a calculator to avoid having to do math in your head, setting a calendar reminder to avoid having to remember or constly think about the deadline. or asking ChatGPT to debug a script. They enable you get a task done with less cognitive work on your end, which of course sounds very enticing!

However, whether this offloading helps or harms your education depends entirely on *what* you are offloading. Educational psychologists analyze this through the lens of Cognitive Load Theory (CLT), which divides our mental effort into two categories: *intrinsic load* (the inherent, necessary difficulty of the core concepts you are trying to learn) and *extraneous load* (unnecessary distractions or tedious tasks that don't contribute to the core learning goal) {% cite sweller2011cognitive KalyugaPlass2025 %}. 

Based on this framework, research categorizes AI cognitive offloading into two distinct paths:

#### The Bad: Detrimental Offloading (Outsourcing)
Detrimental offloading occurs when you use AI to bypass the *intrinsic* cognitive effort required to build long-term knowledge schemas in your brain {% cite LodgeLoble2026 %}. In computer science, this looks like asking an AI to "write a Python script to solve the traveling salesperson problem" when the entire point of the assignment is for you to learn algorithmic optimization. 

When you outsource the intrinsic load, you suffer several severe consequences:
*   **Bypassing Schema Construction:** By letting the AI generate the logic, you skip the "desirable difficulties" necessary to move knowledge from your limited working memory into your long-term procedural memory {% cite deBruinEtAl2023 Duplice2025 %}. 
A massive randomized experiment of students using AI to solve math problems found that while their immediate performance was excellent, their long-term, durable learning suffered significantly once the AI was removed because they never built the internal neural pathways to solve the problems themselves {% cite BastaniEtAl2025 %}.
A smaller study conducted by Anthropic researchers shows similar results for coding tasks as well {% cite ShenTamkin2026 %}.

*   **Metacognitive Laziness:** The frictionless convenience of GenAI powerfully incentivizes "metacognitive laziness"—a state where learners willingly abdicate their self-regulatory responsibilities, such as planning an approach, monitoring their own comprehension, and critically evaluating their work, simply handing those executive functions over to the machine {% cite FanEtAl2025 %}.


#### The Good: Beneficial Offloading
Conversely, AI can be a massive catalyst for learning if used for *beneficial offloading*. This occurs when you deliberately delegate *extraneous* cognitive load to the AI, purposefully freeing up your limited working memory to focus entirely on the intrinsic, high-value work of learning {% cite LodgeLoble2026 %}. 

In a recent 12-week quasi-experimental study, researchers explicitly taught university students a "cognitive offload instruction" model. They instructed students to delegate lower-order tasks (like brainstorming basic ideas or checking grammar/syntax) to generative AI, thereby compelling the students to focus their mental energy on higher-order analysis, structural evaluation, and logical coherence. The students who practiced this targeted, beneficial offloading demonstrated significantly greater gains in critical thinking and produced higher-quality work than the control group {% cite HongEtAl2025 %}. Similarly, studies show that when AI is used to offload lower-order tasks while students engage in shared metacognitive reflection, academic achievement is significantly enhanced {% cite IqbalEtAl2025 %}. 

<div class="action-box" markdown="1">
#### **Actionable Tips:**
*   **Conduct a Cognitive Cost-Benefit Analysis Before Prompting:** Before you ask an AI for help, explicitly define the learning objective of your current task. Ask yourself: "Is this the core algorithmic logic I am supposed to be mastering, or is this just tedious setup?" 
*   **Offload the Boilerplate, Guard the Architecture:** If permitted by your instructor, be aggressive about offloading extraneous load (i.e., tedious task you could easily but that just consume your time). For example, use AI to generate dummy data for your databases, write simple HTML/CSS boilerplate, auto-complete the algorithm you've already implemented in the past, or format your inline comments. But viciously guard your system architecture. You must be the one choose the data structures, define the edge cases, and map out the modules, interfaces, and database schemas. 
</div>


“Learning results from what the student does and thinks and only from what the student does and thinks. The teacher can advance learning only by influencing what the student does to learn” 


<div class="action-box" markdown="1">
#### Use AI for:
*   **Personalized Feedback:**
*   **Adaptive Scaffolding:**
*   **Simulating Worked Examples:** 
*   Generative AI should be utilized as a **"bicycle for the mind"**—a tool that amplifies your cognitive reach but still requires your active control, steering, and judgment
</div>

