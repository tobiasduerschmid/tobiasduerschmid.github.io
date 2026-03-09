---
title: Code Comprehension
layout: sebook
---

This chapter explores program comprehension—the cognitive processes developers use to understand existing software. Because developers spend up to 70% of their time reading and comprehending code rather than writing it (Wyrich et al. 2023), optimizing for understandability is paramount. This chapter bridges cognitive psychology, neuro-software engineering, structural metrics, and architectural design to provide a holistic guide to writing brain-friendly software.

# Cognitive Effects

Reading code is recognized as the most time-consuming activity in software maintenance, taking up approximately 58% to 70% of a developer's time (Xia et al. 2017, Wyrich et al. 2023). Code comprehension is an "accidental property" (controlled by the engineer) rather than an "essential property" (dictated by the problem space) (Alawad 2019, Brooks 1987). To understand how to optimize this process, we must look at how the human brain processes software.

**Working Memory and Cognitive Load**
An average human can hold roughly four "chunks" of information in their working memory at a time (Gobet & Clarkson 2004). Exceeding this threshold results in developer confusion, bugs, and mental fatigue (Wondrasek 2025). Cognitive Load Theory (CLT) categorizes this mental effort into three buckets (Sweller 1988, Wondrasek 2025):

* **Intrinsic Load:** The unavoidable mental effort required to solve the core domain problem or algorithm (Wondrasek 2025).
* **Extraneous Load:** The "productivity killer." This is unnecessary mental overhead caused by poorly presented information, inconsistent naming, or convoluted toolchains (Wondrasek 2025).
* **Germane Load:** The productive mental effort invested in building lasting mental models, such as understanding the architecture through pair programming (Wondrasek 2025).

**Neuro Software Engineering (NeuroSE)**
Moving beyond subjective surveys, modern research utilizes physiological metrics (EEG, fMRI, eye-tracking) to objectively measure mental effort (Hao et al. 2023, Peitek et al. 2021).  For example, fMRI studies reveal that complex data-flow dependencies heavily activate *Broca's area (BA 44/45)* in the brain—the same region used to process complex, nested grammatical sentences in natural language (Peitek et al. 2021).

## Mental Models: Bottom-Up vs. Top-Down

Program comprehension—the mental process of understanding an existing software system—is a highly complex cognitive task that consumes a majority of a software engineer's time (Xia et al. 2017, Wyrich et al. 2023). To navigate this complexity, human cognition relies on mental models capable of supporting mental simulation (Letovsky 1987, Pennington 1987). The application of these models depends largely on a developer’s expertise, the structure of the code, and the presence of contextual clues (Wiedenbeck 1986). 

### The Bottom-Up Approach (Inductive Sense-Making)
In the bottom-up model, comprehension begins at the lowest, most granular level of abstraction (Fekete & Porkoláb 2020). 

*   **Mechanics of Bottom-Up:** A developer reads the code statement-by-statement, analyzing the control flow to group localized lines into higher-level abstractions known as *chunks* (Shneiderman 1980, Ali & Khan 2019). By progressively combining these chunks, the developer slowly builds a systematic view of the program's overall control flow (Ali & Khan 2019, Fekete & Porkoláb 2020). 
*   **Cognitive Limitations:** This approach is highly cognitively demanding. The human mind relies on working memory to store these elements, and working memory is strictly limited in capacity (Darcy et al. 2005). Because reading line-by-line requires a developer to hold many variables, call sequences, and logic branches in their head simultaneously, this approach can quickly lead to cognitive overload if the code is deeply nested or highly coupled (Darcy et al. 2005).
*   **When it is used:** Developers are often forced into bottom-up comprehension when they lack domain knowledge, when the code is entirely new to them, or when contextual clues are explicitly stripped away (Wyrich et al. 2023, Ali & Khan 2019). It is the primary method used during isolated maintenance tasks where localized changes are required (Pennington 1987).

### The Top-Down Approach (Deductive Hypothesis Verification)
The top-down approach flips the cognitive process. Instead of building understanding from the syntax up, the programmer leverages their existing *knowledge base* (prior programming experience and domain knowledge) to infer what the code does (Brooks 1983, Fekete & Porkoláb 2020).

*   **Mechanics of Top-Down:** The developer formulates a mental hypothesis about the system's purpose (Brooks 1983, Fekete & Porkoláb 2020). They then actively scan the codebase looking for *beacons*—familiar, recognizable points in the code that act as evidence (Wiedenbeck 1986, Ali & Khan 2019). Beacons can be anything from specific function names and naming conventions to recognizable architectural patterns (Ali & Khan 2019, Fekete & Porkoláb 2020). Based on the presence or absence of these beacons, the developer either verifies or rejects their initial hypothesis (Ali & Khan 2019).
*   **Cognitive Efficiency:** Because it utilizes pre-existing schemas stored in long-term memory, the top-down approach bypasses the strict limits of working memory (Rumelhart 1980, Darcy et al. 2005). It is a vastly more efficient way to navigate a codebase, provided the developer has the requisite expertise and the code contains reliable, recognizable beacons (Wiedenbeck 1986, Fekete & Porkoláb 2020).

### The Integrated Meta-Model (Fluid Navigation)
In reality, modern software engineering rarely relies on a single approach. Successful developers employ an *Integrated Meta-Model* that fluidly combines both top-down and bottom-up strategies (von Mayrhauser & Vans 1995, Fekete & Porkoláb 2020). 

First formalized by Von Mayrhauser and Vans (von Mayrhauser & Vans 1995), the integrated model consists of four interrelated components (Ali & Khan 2019, Fekete & Porkoláb 2020):
1.  **The Situational Model:** A high-level, abstract representation of the system's functions (von Mayrhauser & Vans 1995).
2.  **The Program Model:** The low-level, control-flow abstraction built by chunking code (von Mayrhauser & Vans 1995).
3.  **The Top-Down Domain Model:** The developer's understanding of the business or problem domain (von Mayrhauser & Vans 1995).
4.  **The Knowledge Base:** The programmer's personal repository of experience (Ali & Khan 2019).

Developers navigate between these models using specific strategies, such as *browsing support* (scrolling up and down to link beacons to code chunks) and *search strategies* (iterative code searches based on their knowledge base) (von Mayrhauser & Vans 1995). 

### Divergent Perspectives: How Developers Apply Mental Models

While the theories of bottom-up and top-down comprehension are well established, empirical studies reveal divergent behaviors in how different programmers apply them:

*   **Systematic vs. Opportunistic Tracing:** When attempting to build a control-flow abstraction (a bottom-up task), developers display divergent strategies. Some developers use a *systematic approach*, reading the code line-by-line to build a complete mental representation before making a change (Arisholm 2001). Others use an *opportunistic approach* (or "as-needed" strategy), studying code only when necessary, guided by clues and hypotheses to minimize the amount of code they must actually read (Koenemann & Robertson 1991, Arisholm 2001). Studies show that systematic programmers struggle significantly more when dealing with deeply nested, highly modular architectures, as the constant jumping between files exhausts their working memory (Arisholm 2001).
*   **Novice vs. Expert Schemas:** The size and quality of a "chunk" varies wildly depending on a developer's expertise. Experts do not necessarily possess *more* schemas than novices; they possess *larger*, more interrelated schemas created through a highly automated chunking process (Kolfschoten et al. 2011). While novices structure their mental models based on surface-level similarities, experts categorize their knowledge based on solution models (Kolfschoten et al. 2011). Consequently, expert mental representations demonstrate a superior extent, depth, and level of detail, allowing them to rapidly map top-down hypotheses to bottom-up implementations (Björklund 2013).

# Metrics and Perception

Historically, the industry relied on structural metrics like McCabe's *Cyclomatic Complexity (CC)* and Halstead's volume metrics (McCabe 1976, Halstead 1977). Modern tools (e.g., SonarSource) have shifted toward *Cognitive Complexity*, which penalizes deep nesting over simple linear branches to better quantify human effort (Campbell 2017). However, empirical and neuroscientific studies reveal divergent perspectives on metric accuracy (Peitek et al. 2021, Hao et al. 2023):

* **The Failure of Cyclomatic Complexity:** CC treats all branching equally (Hao et al. 2023). It ignores the reality that repeated code constructs (like a `switch` statement) are much easier for humans to process than deeply nested `while` loops (Ajami et al. 2017, Jbara & Feitelson 2017).
* **The "Saturation Effect":** Empirical EEG studies show that modern Cognitive Complexity metrics critically flaw by scaling linearly and infinitely (Hao et al. 2023). In reality, human perception features a "saturation effect" (Couceiro et al. 2019, Hao et al. 2023). Once code reaches a certain level of complexity, the brain simply recognizes it as "too complex," and additional logic does not proportionally increase perceived effort (Couceiro et al. 2019, Hao et al. 2023).
* **Textual Size as a Visual Heuristic:** fMRI data suggests that raw code size (Lines of Code and vocabulary size) acts as a preattentive indicator (Peitek et al. 2021). Developers anticipate high cognitive load simply by looking at the size of the block, driving their attention and working memory load before they even read the logic (Peitek et al. 2021, Hao et al. 2023).


# Architecture-Code Gap

One of the most persistent challenges in software engineering is the misalignment of perspectives between different roles in the software lifecycle, creating a cognitive obstacle during architecture realization (Rost & Naab 2016).

* **The Developer's View (Bottom-Up):** Developers operate at the implementation level, working primarily with extensional elements such as classes, packages, interfaces, and specific lines of code (Rost & Naab 2016, Kapto et al. 2016).
* **The Architect's View (Top-Down):** Architects reason about the system using intensional elements, such as components, layers, design decisions, and architectural constraints (Rost & Naab 2016, Kapto et al. 2016).

Without proper documentation, developers implementing change requests often introduce technical debt by opting for straightforward code-level changes rather than preserving top-down design integrity, leading to architectural erosion (Candela et al. 2016).

**Architecture Recovery**
When dealing with eroded legacy systems, engineers use *Software Architecture Recovery* to build a top-down understanding from bottom-up data (Belle et al. 2015).  Reverse engineering tools (like Bunch or ACDC) transform source code into directed graphs, applying clustering algorithms to maximize intra-module cohesion and minimize inter-module coupling (Belle et al. 2015, Shahbazian et al. 2018). By treating recovery as a constraint-satisfaction problem (e.g., a quadratic assignment problem), these clusters can be mapped into hierarchical layers (Belle et al. 2015).

**Automated vs. Human-in-the-Loop**
While fully automated "Big Bang" remodularization tools exist, they often require thousands of unviable code changes (Candela et al. 2016). A highly recommended alternative is using *interactive genetic algorithms (IGAs)* or supervised search-based techniques (Candela et al. 2016). These utilize automated tools for basic metrics but keep the human developer "in the loop" to apply top-down domain knowledge (Candela et al. 2016).


# Structural Trade-Offs

High cohesion (grouping related logic) and low coupling (minimizing dependencies) are widely considered the gold standard for understandable modules (Candela et al. 2016). However, empirical studies reveal critical trade-offs when pushing these concepts to their limits.

**The Danger of Excessive Abstraction**
While modularity isolates complexity, excessive abstraction can severely damage understandability (Arisholm 2001). A controlled experiment comparing a highly modular "Responsibility-Driven" (RD) design against a monolithic "Mainframe" design found that the RD system required 20-50% *more* change effort (Arisholm 2001). The highly modular system forced developers to constantly jump between many shallow modules to trace deeply nested interactions, exhausting their working memory (Arisholm 2001). The monolithic system allowed for a localized, linear reading experience (Arisholm 2001). Therefore, decreasing coupling and increasing cohesion may actually increase complexity if taken to an extreme (Candela et al. 2016).

**The Design Pattern Paradox**
Design patterns serve a dual, somewhat paradoxical role in comprehension:

* **As a High-Level Language:** Patterns provide a "theory of the design" (Gamma et al. 1995). Stating that a component uses a "Command Processor" pattern immediately conveys top-down intent and behavioral dynamics to peers without requiring a bottom-up explanation.
* **As a Source of Cognitive Load:** Despite assumptions that patterns improve understandability, empirical studies reveal they often *do not* (Khomh & Guéhéneuc 2018). Patterns introduce extra layers of abstraction and implicit coupling (e.g., the Observer pattern), which can increase cognitive load and make code harder for maintainers to learn and debug (Mohammed et al. 2016).

# Actionable Practices for Top-Down Comprehension

As developers transition from junior roles to senior engineering positions, their approach to code review and design must undergo a fundamental cognitive shift. Novice reviewers naturally default to a *bottom-up* approach: reading linearly line-by-line, attempting to reconstruct the program's overall purpose by mentally compiling raw syntax (Gonçalves et al. 2025). While this works for small patches, it rapidly leads to cognitive overload in complex systems (Gonçalves et al. 2025).

To review and write code efficiently at scale, developers must master *top-down comprehension*—establishing a high-level mental model of the system's architecture before diving into specific implementation details (Gonçalves et al. 2025). Based on empirical models like Letovsky's and the Code Review Comprehension Model (CRCM), here are actionable strategies to elevate your approach (Letovsky 1987, Gonçalves et al. 2025).

### 1. Master the "Orientation Phase" & Hypothesis-Driven Review

Top-down reviewers do not start by looking at code diffs; they begin by building context and mental models (Gonçalves et al. 2025).

* **Establish the "Why" and "What":** Spend time exclusively seeking the rationale of the change. Read the PR description, issue tracker, and design documents. In Letovsky’s model, this builds the *Specification Layer* of your mental model (Letovsky 1987, Gonçalves et al. 2025). If the author hasn't provided this context, stop and ask for it.
* **Speculate About the Design:** Once you understand the goal, pause. Develop a hypothesis about how *you* would have solved the problem. Construct a mental representation of the expected ideal implementation (Gonçalves et al. 2025).
* **Compare and Contrast:** When you finally look at the source code, you are no longer trying to figure out what it does from scratch. You are comparing the author's implementation against your ideal mental model, looking for discrepancies (Gonçalves et al. 2025).


### 2. Abandon Linear Reading for Strategic Navigation

Reading files sequentially as presented by a review tool strips away structural context (Baum et al. 2017). Use opportunistic strategies to navigate complexity (Gonçalves et al. 2025).

* **Execute a "First Scan":** Eye-tracking studies reveal expert reviewers perform a rapid first scan, touching roughly 80% of the lines to map out the structure, locate function headers, and identify likely "trouble spots" before scrutinizing for bugs (Uwano et al. 2006, Gonçalves et al. 2025).
* **Shift from Chunking Lines to Finding Beacons:** Instead of building understanding by chunking individual lines of code together, actively scan the codebase for *beacons* (familiar function names, domain conventions) to verify the hypothesis you built during the orientation phase (Brooks 1983, Wiedenbeck 1986).
* **Utilize Difficulty-Based Reading:** Search the PR for the "core" architectural modification. Understand that core first, then follow the data flow outward to peripheral files. Alternatively, use an *easy-first* approach to quickly approve simple boilerplate files, clearing them from your working memory before tackling complex logic (Gonçalves et al. 2025).
* **Segment Massive PRs:** If a PR is a massive composite change, manually break it down into logical clusters (e.g., database changes, backend logic, frontend UI) and review them as isolated functional units (Gonçalves et al. 2025).
* **Leverage Dependency Tools:** Actively reconstruct structural context using IDE features or static analysis tools to trace caller/callee trees and view object dependencies (Fekete & Porkoláb 2020). Ask top-down reachability questions like, "Does this change break any code elsewhere?"

### 3. Code-Level Practices for Cognitive Relief

To facilitate top-down thinking for yourself and your team, you must design boundaries that hide bottom-up complexity.

* **Design Deep Modules:** Avoid "Shallow Modules" whose interfaces simply mirror their implementations. Instead, favor "Deep Modules"—encapsulating a massive amount of complex, bottom-up logic behind a very simple, concise, and highly abstracted public interface.
* **Optimize Identifier Naming:** Using full English-word identifiers leads to significantly better comprehension than single letters (Lawrie et al. 2007). Keep the number of domain-information-carrying identifiers to around five to optimize for working memory limits (Gobet & Clarkson 2004).
* **Comment for "Why", Not "What":** Code should explain *what* it does; comments should act as a cognitive guide explaining *why* an approach was taken and what alternatives were ruled out (Cline 2018).
* **Make the Architecture Visible:** Embed architectural intent directly into the source code through explicit naming conventions, package structures, and directory hierarchies (e.g., grouping classes into `presentation` or `data_access` packages) (Ali & Khan 2019, Fekete & Porkoláb 2020).
* **Program to Interfaces:** Rely on abstract interfaces at the root of a class hierarchy rather than concrete implementations. This Dependency Inversion approach allows developers to think about high-level *roles* rather than bottom-up *executions* (Martin 2000).
* **Adopt Hybrid Documentation:** Establish a *Documentation Roadmap* providing a bird's-eye view of subsystems for top-down navigation (Aguiar & David 2011). Generate task-specific documentation that explicitly maps high-level components to specific source code elements (Rost & Naab 2016).
* **Practice Architecture-Guided Refactoring:** Adopt the "boy scout rule" by integrating top-down improvements into daily feature work to organically evolve modularity and prevent architectural drift, rather than waiting for technical debt sprints (Jeffries 2014, Martini & Bosh 2015).



***

### References

* **Aguiar & David 2011:** Aguiar, A., & David, G. (2011). *Patterns for Effectively Documenting Frameworks*. Transactions on Pattern Languages of Programming II. LNCS 6510.
* **Ajami et al. 2017:** Ajami, S., Woodbridge, Y., Feitelson, D. (2017). *Syntax, predicates, idioms what really affects code complexity?* Proceedings of the IEEE International Conference on Program Comprehension (ICPC).
* **Ali & Khan 2019**: Ali, A., Khan, A. S. (2019). *Mapping of Concepts in Program Comprehension*. IJCSNS International Journal of Computer Science and Network Security, 19(5), 265-272.
* **Arisholm 2001:** Arisholm, E. (2001). *Empirical Assessment of Object-Oriented Software Maintainability*.
* **Baum et al. 2017:** Baum, T., Schneider, K., & Bacchelli, A. (2017). *On the optimal order of reading source code changes for review*. IEEE International Conference on Software Maintenance and Evolution (ICSME).
* **Belle et al. 2015**: Belle, A. B., El Boussaidi, G., Desrosiers, C., Kpodjedo, S., & Mili, H. (2015). *The Layered Architecture Recovery as a Quadratic Assignment Problem*. In European Conference on Software Architecture (ECSA).
* **Björklund 2013:** Björklund, T. A. (2013). *Initial mental representations of design problems: Differences between experts and novices*. Design Studies, 34, 135-160.
* **Brooks 1983**: Brooks, R. (1983). *Towards a theory of the comprehension of computer programs*. International Journal of Man-Machine Studies, 18(6), 543-554.
* **Campbell 2017:** Campbell, G. (2017). *Cognitive complexity–a new way of measuring understandability*. Technical Report. Geneva: SonarSource.
* **Candela et al. 2016**: Candela, I., Bavota, G., Russo, B., & Oliveto, R. (2016). *Using cohesion and coupling for software remodularization: Is it enough?* ACM Transactions on Software Engineering and Methodology (TOSEM), 25(3), 1-28.
* **Cline 2018:** Cline, B. (2018). *5 TIPS TO WRITE MORE MAINTAINABLE CODE*. (Cited in Identification of Technical Debt in Code using Software Metrics).
* **Couceiro et al. 2019:** Couceiro, R., et al. (2019). *Biofeedback augmented software engineering: Monitoring of programmers’ mental effort*. Proceedings of the IEEE/ACM 41st International Conference on Software Engineering: New Ideas and Emerging Results (ICSE-NIER).
* **Darcy et al. 2005**: Darcy, D. P., Slaughter, S. A., & Tomayko, J. E. (2005). *The Structural Complexity of Software: Testing the Interaction of Coupling and Cohesion*.
* **Fekete & Porkoláb 2020**: Fekete, A., Porkoláb, Z. (2020). *A comprehensive review on software comprehension models*. Annales Mathematicae et Informaticae, 51, 103–111.
* **Gamma et al. 1995**: Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1995). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley.
* **Gobet & Clarkson 2004:** Gobet, F., Clarkson, G. (2004). *Chunks in expert memory: evidence for the magical number four ... or is it two?* Memory.
* **Gonçalves et al. 2025**: Gonçalves, P. W., Rani, P., Storey, M.-A., Spinellis, D., & Bacchelli, A. (2025). *Code Review Comprehension: Reviewing Strategies Seen Through Code Comprehension Theories*. IEEE/ACM International Conference on Program Comprehension.
* **Halstead 1977:** Halstead, M. H. (1977). *Elements of software science*. Elsevier.
* **Hao et al. 2023:** Hao, G., et al. (2023). *On the accuracy of code complexity metrics: A neuroscience-based guideline for improvement*. Frontiers in Neuroscience, 16.
* **Jbara & Feitelson 2017:** Jbara, A., Feitelson, D. (2017). *How programmers read regular code: A controlled experiment using eye tracking*. Empirical Software Engineering, 22, 1440–1477.
* **Jeffries 2014:** Jeffries, R. (2014). *Refactoring code incrementally to avoid large costs*. (Cited in Identification of Technical Debt in Code using Software Metrics).
* **Kapto et al. 2016**: Kapto, C., El Boussaidi, G., Kpodjedo, S., & Tibermacine, C. (2016). *Inferring Architectural Evolution from Source Code Analysis: A Tool-Supported Approach for the Detection of Architectural Tactics*. In European Conference on Software Architecture (ECSA).
* **Khomh & Guéhéneuc 2018**: Khomh, F., Guéhéneuc, Y. G. (2018). *Design patterns impact on software quality: Where are the theories?* IEEE 25th International Conference on Software Analysis, Evolution and Reengineering.
* **Koenemann & Robertson 1991:** Koenemann, J., Robertson, S. P. (1991). *Expert problem solving strategies for program comprehension*. Proceedings of the SIGCHI Conference on Human Factors in Computing Systems.
* **Kolfschoten et al. 2011:** Kolfschoten, G. L., Briggs, R. O., & Lukosch, S. (2011). *Transactions on Pattern Languages of Programming 2*. Lecture Notes in Computer Science.
* **Lawrie et al. 2007:** Lawrie, D., Morrell, C., Feild, H., & Binkley, D. (2007). *Effective identifier names for comprehension and memory*. Innovations in Systems and Software Engineering, 3(4).
* **Letovsky 1987**: Letovsky, S. (1987). *Cognitive processes in program comprehension*. Journal of Systems and Software, 7(4), 325-339.
* **Martin 2000:** Martin, R. C. (2000). *Design Principles and Design Patterns*. Object Mentor.
* **Martini & Bosh 2015:** Martini, A., Bosch, J. (2015). *The danger of architectural technical debt: Contagious debt and vicious circles*. 12th Working IEEE/IFIP Conference on Software Architecture (WICSA).
* **McCabe 1976:** McCabe, T. J. (1976). *A complexity measure*. IEEE Transactions on Software Engineering, 4, 308–320.
* **Mohammed et al. 2016**: Mohammed, M. A., Elish, M., & Qusef, A. (2016). *Modularity Analysis of Design Patterns: An Empirical Study*. International Journal of Computer Science and Network Security, 16(7).
* **Peitek et al. 2021**: Peitek, N., et al. (2021). *Program Comprehension and Code Complexity Metrics: An fMRI Study*. IEEE/ACM 43rd International Conference on Software Engineering (ICSE).
* **Pennington 1987**: Pennington, N. (1987). *Stimulus structures and mental representations in expert comprehension of computer programs*. Cognitive Psychology, 19(3), 295-341.
* **Rost & Naab 2016**: Rost, D., Naab, M. (2016). *Task-Specific Architecture Documentation for Developers: Why Separation of Concerns in Architecture Documentation is Counterproductive for Developers*. In European Conference on Software Architecture (ECSA).
* **Rumelhart 1980**: Rumelhart, D. E. (1980). *Schemata: The building blocks of cognition*. Theoretical issues in reading comprehension, 33-58.
* **Shahbazian et al. 2018**: Shahbazian, A., Lee, Y. K., Le, D., Brun, Y., & Medvidovic, N. (2018). *Recovering Architectural Design Decisions*.
* **Shneiderman 1980**: Shneiderman, B. (1980). *Software Psychology: Human Factors in Computer and Information Systems*. Winthrop Publishers.
* **Storey 2006**: Storey, M.-A. (2006). *Theories, tools and research methods in program comprehension: past, present and future*. Software Quality Journal.
* **Sweller 1988**: Sweller, J. (1988). *Cognitive load during problem solving: Effects on learning*. Cognitive Science.
* **Uwano et al. 2006:** Uwano, H., Nakamura, M., Monden, A., & Matsumoto, K. (2006). *Analyzing individual performance of source code review using reviewers’ eye movement*. Symposium on Eye Tracking Research & Applications.
* **von Mayrhauser & Vans 1995**: von Mayrhauser, A., & Vans, A. M. (1995). *Program comprehension during software maintenance and evolution*. Computer.
* **Wiedenbeck 1986:** Wiedenbeck, S. (1986). *Beacons in computer program comprehension*. International Journal of Man-Machine Studies, 25(6).
* **Wondrasek 2025**: Wondrasek, J. A. (2025). *Understanding Cognitive Load in Software Engineering Teams and Systems*. SoftwareSeni.
* **Wyrich et al. 2023**: Wyrich, M., Bogner, J., & Wagner, S. (2023). *40 Years of Designing Code Comprehension Experiments: A Systematic Mapping Study*. ACM Computing Surveys.
* **Xia et al. 2017**: Xia, X., Bao, L., Lo, D., & Li, S. (2017). *Measuring Program Comprehension: A Large-Scale Field Study with Professionals*. IEEE Transactions on Software Engineering.