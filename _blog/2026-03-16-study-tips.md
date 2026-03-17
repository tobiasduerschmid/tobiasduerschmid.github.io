---
layout: blog-post
title: "[DRAFT] Evidence-Based Study Tips for College Students"
date: 2026-03-16
category: "For Students"
permalink: /blog/evidence-based-study-tips-for-college-students/
image: "/img/learning.jpg"
image_alt_text: "Students working on a laptop and whiteboard"
audio: "/files/study_tips.mp3"
---

**A Quick Guide to Studying Effectively in College: How to Hack Your Brain for Better Learning**

If you are like many college students, your primary study strategies probably consist of rereading your textbooks or lecture slides, highlighting key passages, and cramming the day before an exam. You might feel highly productive during these long study sessions, but the science of learning tells a different story: ==rereading text and massed practice (cramming) are by far the *least productive* study strategies==.
These common methods merely boost short-term memory and create an "illusion of knowing" {% cite BjorkBjork1992 benjamin1998mismeasure %}.
When you read a text multiple times, the material becomes familiar, and you mistake this perceptual fluency for true mastery of the subject.
==To build deep, durable knowledge, you need to embrace "desirable difficulties"—short-term impediments that make learning feel harder and slower, but ultimately trigger cognitive processes that optimize long-term retention and the transfer of skills== {% cite Bjork1994a bjork2011making %}.

This post is intended to teach you actionable, research-backed study tips on how to learn effectively, with specific examples for computer science students to enable everyone to get the most out of their college experience!
Interestingly, despite actually **measurably learning *more* effectively**, learners who study based on these techniques **often subjectively believe they have learned *less* effectively**, because short-term performance is often perceived to be worse due to the additional struggle of desirable difficulties {% cite Kornell2008learning Simon2001metacognition %}.
This illustrates that **the *perception* of learning is not always aligned with the *actual* learning**. Actual learning is what predicts your *future* performance.
What you observe is your *past* performance.
**The study tips in this post are empirically validated to be effective and should help you pick learning strategies that *actually work* rather than just *feel like they work**.


Fun fact: a significant portion of the research presented in this post was actually done at UCLA by the [Bjork Learning and Forgetting Lab](https://bjorklab.psych.ucla.edu/research/)!


## Desirable Difficulties: Embrace the Struggle
It is a common misconception that if you are learning effectively, the process should feel smooth, fast, and easy.
In reality, the exact opposite is true!
When learning is completely effortless, it is almost always superficial and easily forgotten.
To build truly durable knowledge, you have to lean into "**desirable difficulties**"—intentional roadblocks that force your brain to work harder to process, connect, and retrieve information {% cite Bjork1994a bjork2011making %}.
For example, instead of looking something up in your notes or textbook, you should always try to recall it yourself or actively construct an answer to a question yourself, even if you are not sure it is correct.
The mental sweat you experience when you can't quite remember the time complexity of an algorithm, or the frustration of grappling with a complex concept, isn't a sign that you aren't smart enough.
Rather, that struggle is the biological mechanism of your brain building stronger, more permanent neural pathways.
Simply put: ==effective learning *is* effortful== {% cite brown2014MakeItStick %}.
However, note that not all difficulties are desirable.
For example, studying while you are sleep-deprived, hungry, sick, or highly anxious; reading the material in an unfamiliar language; or studying a topic without pre-required fundamentals are undesirable difficulties and they should be reduced.
Only difficulties that **present challenges to the learner but are not of such difficulty that the learner cannot eventually meet or overcome them** are desirable. A rule of thumb is that what makes your brain do more active work while still reaching an answer is helpful.

* **Actionable Advice:** ==When your study routine starts to feel too easy or comfortable, try to add in some challenges that make it harder for yourself==.
If you are breezing through your flashcards, shuffle them to remove predictable patterns, or force yourself to explain the core concepts out loud to an empty room without looking at your notes. Change the place where you study instead of returning to the same spot.
When you feel that cognitive friction, remind yourself that the **struggle is a necessary part of the growth process**.
* **Computer Science Examples:** When working on a coding assignment, it is incredibly tempting to rely on AI auto-complete tools (like GitHub Copilot, Cursor, or Codex) or to copy-paste boilerplate code directly from a tutorial or online resource.
While this is efficient for workplace production, it bypasses the cognitive effort required for actual learning.
To create a desirable difficulty, turn off your AI assistants and force yourself to type out the syntax and build the logic step-by-step from scratch.
The mental challenge you feel when you have to manually track down a missing bracket or debug a loop is exactly the kind of effortful struggle that ensures you will be able to catch bugs more quickly tomorrow. **Embrace challenges as welcome learning opportunities!**


## Retrieval Practice: Ditch the Highlighter and Quiz Yourself
One of the most powerful learning tools at your disposal is **"active retrieval"**.
As a computer scientist, you might think that recalling memory does not have any side effects. While this might be true for most digital digital storage media (unless they use caching or log requests), it is not true for human memory.
In fact, ==the act of retrieving information from human memory makes that information much easier to access in the future== {% cite RoedigerKarpicke2006 %}. The more often you try to recall information, the easier it becomes to retrieve it in the future.
A single, simple quiz after reading a text produces better learning and remembering than reading the text multiple times.
Passively re-consuming the material does *not* have a similar effect as active retrieval {% cite brown2014MakeItStick %}. You have to recall the answers yourself, without looking at the material.
Additionally, while simultaneously reinforcing this memory to move it towards more durable storage, retrieval practice also tells you exactly what you know and what you don't.


*   **Actionable Advice:** ==Instead of rereading your notes, lecture slides, or books, put them away and try to write out everything you can remember from the lecture==. Create flashcards to quiz yourself on important concepts. Treat practice tests as real tests, forcing yourself to generate the answers without notes rather than just looking at them and nodding. Write a summary of each lecture at the end purely relying on your own memory. Right before the next lecture, recall what you've learned in the previous lecture, again purely from your own memory. Use your own memory as often as possible while relying as little as possible on external resources.
*   **Computer Science Examples:** When you are starting to write a complex loop or pointer arithmetic, try to recall the syntax from memory instead of looking it up. When you are learning version control with Git, instead of looking up the documentation of each command before you use it, try to recall it from memory. When you are writing a sort function, try to remember all sorting algorithms you have learned and how they are different. **At every possible opportunity, try to use your own memory before consulting other resources.**


## Spaced Practice: Space Out Your Study Sessions
Cramming all your studying into one massive session might help you pass the mid-term the next day, but that knowledge will melt away for the final.
*Massed practice* feels very productive in the moment, but it actively harms long-term retention.
==To build durable memory, you must space out your practice== {% cite Cepeda2006 %}.
Studying a little bit every week is much more effective than studying for the cumulative duration of these individual study sessions within one single day. Spacing allows time for your memories to consolidate—a process where memory traces are stabilized, given meaning, and connected to prior knowledge {% cite brown2014MakeItStick %}.
A study session is more effective after you start to forget a little bit of the material {% cite brown2014MakeItStick %}. Repeating this process of incrementally studying the same material over increasing intervals of time is one of the most effective ways to build durable memory, because it feels more effortful and signals to your brain that the information is important and needs to be retained long-term {% cite brown2014MakeItStick %}.


*   **Actionable Advice:** ==Set aside time every week to practice on both the current week's material and topics covered earlier in the quarter/semester==. Let a little forgetting set in between study sessions. When you feel a bit rusty, the mental effort required to "reload" the information from long-term memory triggers reconsolidation, which deepens the learning. If you identify missing gaps that you can't answer by consulting your notes, you can then discuss these in office hours. Your professor or TA will be happy to help you, especially if you are asking questions in a week other than the crowded office hours right before the exam. To help you keep track of your planned spacing sessions, add them to your calendar. To make them for fun and engaging, study together with other students. **Study groups** are a great way to keep motivated, to express your thoughts verbally, and to learn from each other's unique experience and perspectives.
*   **Computer Science Examples:** If your class has a project that is due at the end of the term, do not follow the temptation to do most of the work in the last few weeks. Continuously apply the techniques taught in the course every week and make incremental progress. If your course covered more theoretical concepts, periodically revisit older concepts. For example, if you learned about Big-O notation in week one, test yourself on it again in week four, even if it is not on the homework. **The effort to retrieve older concepts ensures they stay accessible.**


## Interleaving:  Mix Up Your Problem Types
Most textbooks and many courses use "blocked practice": They first covers one topic entirely, then the second topic, then the third. The problem with blocked practice is that it never teaches you *when* to apply a specific solution. In contrast, ==interleaving mixes the practice of different but related topics or skills==. This helps you develop a broader understanding of the relationships between conditions and improve your ability to discriminate between problem types {% cite Kornell2008learning RohrerTaylor2007 %}.
This often makes students feel less confident in their knowledge, because they start working on the next topic before they feel they fully grasped the first one. But it is actually more effective for effective learning, because it naturally builds in spaced retrieval practice and it also makes you pay more attention to the connections, similarities, and differences between topics, which is more important for real-world application of the taught skills {% cite brown2014MakeItStick %}.


*   **Actionable Advice:** ==Once you understand a new problem type, scatter it throughout your practice sequence so that you are alternating between different problems that call for different solutions==. For related problems or related topics, mix them up as much as possible. Interleave study sessions between different courses. When quizzing yourself with flash cards or other quizzes, mix different course topics in your deck of rather than ordering them by topic. 
*   **Computer Science Examples:** If you are studying sorting algorithms, do not do ten practice problems on Merge Sort, followed by ten on Quick Sort, and ten on Bubble Sort. Shuffle the problems randomly. By mixing them up, you force your brain to analyze the dataset and the constraints of the problem to determine *which* algorithm is the most efficient choice before you write the code. For personal projects or programming study sessions, vary the programming languages you are using. Study topics from different courses together rather than separately. For example, when you are taking operating systems and programming languages together, consider how the choice of programming language impacts the design of operating systems. **By mixing up your problem types, you force your brain to contextualize and connect knowledge and achieve deeper learning.**


## Generation: Struggle First, Check the Solution Later
The act of trying to answer a question or solve a problem *before* being shown how to do it is known as generation. Even if you make errors in your attempt, wrestling with the problem makes your mind far more receptive to the correct solution when it is finally provided {% cite Jacoby1978 %}. Unsuccessful attempts at a solution encourage deep processing of the answer and create fertile ground for its encoding.


*   **Actionable Advice:** ==Try to solve homework problems before you go to the lecture where the solution will be taught==. View errors not as failures, but as vital diagnostic information that helps you adjust your strategies.
*   **Computer Science Examples:** If your assignment is to traverse a binary search tree, try to write the script entirely on your own before you search for the standard solution on Stack Overflow or in your textbook. When your code throws an exception you've never seen before, try to understand what it means and how to fix it before looking for a quickfix. When you finally review the correct implementation, the logic will click into place and stick with you much longer. **Challenge yourself to create new knowledge before trying to find of the answer somewhere else.**


## Component Skills: Manage Your Cognitive Load
Human cognitive architecture is characterized by a very limited short-term or working memory. When a task is highly complex, trying to learn all aspects of it simultaneously can overwhelm your working memory and impede learning {% cite Sweller1988 %}. This can result in undesirable difficulties. However, if you break a complex task down and practice component skills in isolation, you can develop mastery of these individual skills before combining them into a coherent whole {% cite Ambrose2010howLearningWorks %}.

*   **Actionable Advice:** ==Decompose daunting, too complex tasks into smaller, manageable sub-goals==. For a very difficult course, start to study individual skills earlier so that in the week before the exam you can focus on combining component skills rather than learning all of them for the first time, which might overwhelm you. Note that managing load is complementary to the advice on *interleaving*. Interleaving is useful if and only if the entire work fits into your cognitive load capacity. If you reach a point of exhaustion, you should split up the learning into individual component skills before combining them. Until then, practicing related concepts using interleaving is ideal. The difficulty resulting from interleaving is only desirable if you can overcome it successfully. Once it overloads your working memory, the difficulty becomes undesirable. Also note that based on previous experience with some course topics, some students might have learned some component skills already and therefore might be able to combine them into a coherent whole more easily than others. For some courses you will will be able to combine the different topics earlier than others while for other courses you will need to study the topics separately for longer than others. Everyone goes through this struggle at different points in time and for different topics. This is a very common part of the college experience.


*   **Computer Science Examples:** Suppose you are tasked with building a full-stack web application (CS35L students should pay attention to this section). If you try to learn frontend design (HTML/CSS/JS), backend logic (Python/Node.js), and database querying (SQL) all at the exact same time without prior experience with any of these, your cognitive load will be too high to learn them together. Instead, isolate the component skills. Build the static front end first. Then, separately, practice writing database queries on simple examples. Once you have a fluent, automated grasp of these individual pieces, you will have the cognitive capacity to successfully integrate them into a dynamic application. **To ensure you have enough time to study each individually, make sure you start early right after each concept was taught in the lectures rather than waiting until you really *need* it. When a skill is getting too complex for you to handle, you have to break it down into smaller, manageable sub-goals to be studied individually.**


## Growth Mindset: The Foundation for Desirable Difficulties


Adopting all of the strategies listed above is nearly impossible if you operate with a "fixed mindset"—the belief that your intelligence and abilities are static traits you are simply born with. If you have a fixed mindset, struggling with a new concept feels like terrifying proof that you just aren't smart enough. However, decades of psychological research demonstrate that a "growth mindset" is far more accurate: ==your brain is highly plastic, and intellectual abilities are absolutely developed through effort, strategic practice, and perseverance== {% cite Dweck2006 %}. To effectively use desirable difficulties, you have to let go of the need for learning to feel "easy" and instead recognize that mental friction is the physical sensation of your brain growing stronger.


*   **Actionable Advice:** ==Pay attention to your internal monologue and add the word "yet"==. Change "I don't understand this" to "I don't understand this yet". When you hit a roadblock, do not view it as a limit of your natural ability. View it as a cue that you need to adjust your study strategies, increase your effort, or seek out office hours. If you've done well in a class, don't assume you're a "natural" at the subject. Instead, recognize that your success is the result of effective strategies and consistent effort, which you can replicate in more challenging courses. And if you struggle too much, don't be afraid to ask for help and visit office hours or email your instructor(s). All of them are always willing to help, *especially* if you let them know how hard you've tried already.
*   **Computer Science Examples:** There is a pervasive and toxic myth in software engineering that some people are just naturally born with a "coding gene". This is entirely false. When your C program segfaults for the fiftieth time, or you are trying to untangle a messy `git rebase`, it is easy to feel like an imposter. A fixed mindset tells you to give up because you aren't cut out for computer science. A growth mindset reminds you that every single expert developer started exactly where you are. Bugs and compiler errors are not indictments of your intelligence. They are simply the mechanism by which you build mastery. ==You are entirely capable of conquering these complex systems, provided you embrace the resilient, effortful struggle required to learn them and you are not afraid to ask for help when you need it.==


## Quiz & Conclusion 

{% include quiz.html id="effective_learning" %}

{% include flashcards.html id="study_tips" %}

==After getting foundational knowledge, now it's time for you to apply these tips in the course you are taking (especially the more challenging courses)! Try to slowly integrate these learning practices into your study sessions and let them guide your approach to learning!==

If you would like to know more about the science behind this post, I recommend reading the book "Make It Stick: The Science of Successful Learning" {% cite brown2014MakeItStick %}. It is one of my favorite books on learning because it helps both the learner and the teacher. Also, check out the [research summary of UCLA's Bjork Learning and Forgetting Lab](https://bjorklab.psych.ucla.edu/research/), [Robert Bjork's talk at Harvard](https://www.youtube.com/watch?v=MPL68uxiNaU), and the other references linked below.
