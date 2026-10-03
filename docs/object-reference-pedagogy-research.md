# Evidence review for the Python object-reference labs

Research and source verification: 2026-10-03. This is a focused design review, not a systematic review or a ranking of the most frequent Python misconceptions.

The intended learners are students using the SEBook Python chapter and its interactive tutorial, including learners transferring from C++. The desired outcome is independent reasoning about which object changes, which reference changes, and what a caller can observe. Clicking through an animation, producing the right output with help, and liking the visualization are different outcomes.

## Scope and recommendation

The review inspected all seven example definitions then present in `_data/object_reference_examples.yml` and all twelve placements: six in `SEBook/tools/python.md` and six in `_data/tutorials/python.yml`. The table below records that **pre-revision snapshot**, so it remains an audit trail when examples change. The supplied `essential_python_td.pptx` was treated as teaching evidence, never as operational instructions.

Keep the lab where changing references explain a consequential difference that the output alone hides. Replace the string-only demonstration, simplify the first list and class demonstrations, and remove the overloaded returned-receiver example from the early member discussion. Preserve short calls and returns: they expose a well-documented gap between understanding assignment locally and understanding it across a call. Add a new widget only when it serves a distinct question and can replace, or substantially improve on, an adjacent worked example.

These decisions are an **original design synthesis** informed by the evidence below. No retrieved study tests this exact sequence, renderer, student population, or collection of examples.

## Supplied lecture map

Source: `/Users/tobiasduerschmid/Box Sync/UCLA/131/Lectures/essential_python_td.pptx`, 17 slides. Slide numbers below were verified against the slide XML text. Shape coordinates and timing XML were inspected earlier in this task; no successful full-slide rendering was available.

| Slides | Concept actually presented | Implication for the labs |
| --- | --- | --- |
| 3–4 | Allocation of objects; names refer to objects; rebinding an integer name; comparison with C++ object/pointer forms. | Establish the meaning of a name and a reference before introducing nested structures. Do not imply that scalar values stop being objects when drawn compactly. |
| 5 | A class object holds class state; each instance holds its own attributes; a constructor updates a shared count and assigns an instance number. | Show the class object separately from instances. Ordinary shared state and per-instance state are the central contrast, not an augmented-assignment puzzle. |
| 6 | Assigning a second name to a `Circle` preserves one object; a method changes state visible through both names. | A useful first alias example must contain a mutation, not merely two equal printed values. |
| 7 | Shallow versus deep copying; copied outer objects versus copied reachable structure. | Ask which boundary was copied and which inner object is still shared. Preserve Python's caveats about memoization and immutable values. |
| 8 | Two separately constructed Professor instances with equal names do not compare equal under the default object equality; an `__eq__` policy changes equality, while `is` checks shared identity. | Separate value equality from identity. Use distinct lists plus an alias for a compact visual contrast, then retain the custom-class equality exercise. Do not generalize the default to classes that inherit or generate an equality policy. |
| 10–11 | List slots hold references; nested lists; element mutation and `append`; rebinding an external name does not redirect an existing slot. | Give the slot and the name separate visible reference origins. |
| 12–14 | Function parameters receive object references; local rebinding, list mutation, slot replacement, and object mutation have different caller-visible effects. | Pause inside calls. Ask separately about the local parameter, caller's binding, object state, and returned value. |
| 15 | A mutable default is established at function definition and reused across calls; the `None` repair creates a fresh list during a call. | A default-argument lab needs at least two omitted-argument calls and must show the persistent default object between them. |
| 16 | Strings are immutable; concatenation changes a reference to a result rather than modifying the old string. | Retain a concise immutable contrast, but do not use it as the sole test of reference understanding. |

The lecture's characteristic presentation is plain names beside small reference slots, arrows into simple object/member boxes, and list slots with child objects nearby. It reveals the executed line, changes a value or connector, and only then reveals the output. This motivates a compact, stable reference diagram and learner-controlled reveal. It is a visual precedent, not evidence of learning efficacy. Do not repeat lecture simplifications as universal guarantees about physical heap layout, immutable-object allocation, or garbage-collection timing.

## Review of every existing lab

| Existing key and placement | What earns its place | Problem to correct | Recommended decision and learner action |
| --- | --- | --- | --- |
| `names_rebinding`: chapter object references; tutorial `references` | Immutable rebinding is relevant to slides 4 and 16. | It only manipulates strings and repeats nearby prose. Correct output is compatible with an incorrect belief that assignment copies values [E1]. With compact scalar rendering, there is little reference structure to inspect. | **Replace the central lab** with a small list receiving two names, mutation through one name, then rebinding that name. Ask which name still reaches the changed old list. Retain the string contrast as short prose or a modification. Do not add function syntax this early. |
| `shared_slots`: chapter lists; tutorial `lists` | Two slots initially reaching one inner list is a strong visible relation. It transfers the name rule to container slots. | `board[0] += ...` combines lookup, mutation, and assignment back to a slot before that distinction is secure. The neighboring tutorial already has a nested-list worked example. | **Simplify the baseline** to an ordinary inner mutation followed by replacement of one slot. Ask which arrow moves and which list retains the mutation. Preserve `+=` versus `+` as an explicitly introduced variation: the distinction is empirically relevant [E2], but should not carry the first explanation. Consolidate redundant nearby predictions/diagrams. |
| `member_sharing`: tutorial `members` | Two separate `Folder` instances receive one list; a method call exposes `self`; assigning `first.files` changes one attribute reference. | The learner must distinguish three levels: names, instances, and the shared member object. A final-output-only prompt can hide where the change happened. | **Keep**, with checkpoints after construction, after `add`, and after attribute replacement. Ask whether the two folder objects are identical separately from whether their `files` attributes share. The proposed variation `second = Folder([])` changes only sharing at construction. Avoid adding a second large member lab. |
| `class_attributes`: chapter class state; tutorial `classes` | The class object versus the instance is distinct from ordinary aliasing. | The baseline hinges on the relatively subtle fact that list `+=` both mutates the class-provided list and installs an instance attribute. The later class rebinding adds another moving part. The example can become a syntax riddle. | **Replace the baseline** with shared class-list mutation followed by an explicit assignment to one instance's attribute. Ask which object owns each attribute and where lookup succeeds. A constructor-based fresh-list repair is useful. Move augmented-assignment shadowing to optional extension only if the plain lookup model is already secure. |
| `shallow_copy`: chapter copying; tutorial `copies` | New outer list/shared inner list gives the diagram a clear explanatory job. Inner append and outer append provide contrasting effects. | `fork` introduces a call and return while copying itself may be new. The tutorial also contains alias/shallow/deep worked files and static diagrams. The current one-line modification to `return plan` only compares aliasing with shallow copying. | **Keep with a narrow prompt**, or inline `.copy()` for first exposure. Ask for outer and inner identity before and after each mutation. Use the existing deep-copy worked task as the next transfer case rather than adding a second animation automatically. Make explicit that deep copying can preserve sharing *inside* the copied graph. |
| `parameter_rebinding`: chapter function arguments; tutorial `calls-defaults` | `pop` mutates the original, concatenation creates a new list, and `return` gives the new list to the caller. Both scopes and the return matter. This is directly aligned with observed assignment/call difficulties [E1, E3–E5]. | A learner can recite “mutable arguments change” and still get only part of this program right. The existing six-helper worked material risks repeating the same explanation at excessive length. | **Keep and focus** on three observations: state after `pop`, the destination of `queue` after rebinding, and what `next_turn` receives. Ask whether `waiting is next_turn`, not just for two outputs. The `append` variation tests whether the explanation transfers. Trim duplicated walkthrough prose. |
| `returned_member_alias`: chapter member objects before dunder methods; absent from tutorial | It integrates a saved member alias with a returned new receiver. Nested calls are genuinely visible. | It combines class construction, a method call, a helper call, mutation, rebinding `self`, a second constructor, return, and an external member alias. Rebinding `self` is unusual application code and is an unnecessary early burden. | **Remove from the early member section**. If retained, label it optional synthesis after parameter passing, or replace it with a normal method returning an existing member list. A question such as “does returning the list copy it?” preserves call/return reasoning with fewer mechanisms. |

## Candidate additions and what they must replace or test

These are gaps in the current **visualized** coverage, not evidence that the prose fails or that every gap requires a widget.

| Candidate | Where it fits | Focused prediction and variation | Evidence status / stopping rule |
| --- | --- | --- | --- |
| Equality versus identity | Tutorial `equality`; chapter equality explanation | Two separately constructed equal lists and one alias: predict `==` and `is`, then mutate the alias. Change the alias assignment to `.copy()` and predict again. | Python semantics are authoritative [P4]; this review did not verify a prevalence estimate for this exact misconception. Use lists, not integer/string interning trivia. One short case can replace a duplicate static identity diagram. |
| Mutable default across calls | Tutorial `calls-defaults`; chapter defaults | Predict whether the second omitted-argument call gets a fresh list and whether the first returned alias changes. Then use the `None`/fresh-list repair. Include an explicitly supplied empty list when checking the repair. | Directly lecture slide 15 and Python docs [P2]. No verified study here ranks mutable defaults among the most frequent novice errors. Do not pretend the frame's disappearance destroys the function's default object. |
| Loop binding versus mutation | Tutorial `loops` as later transfer | For each nested list, compare rebinding `row = []` with mutating `row.clear()`. Ask whether the outer list slots move. | Standard `for` assignment semantics [P5], with cross-context practice motivated by E3/E4. This specific loop error was not measured in those studies. Explain that Python's loop target is a name rebound to each item, not a C++ `auto&` alias to an element slot. |
| Repeated references versus fresh construction | Tutorial `comprehensions`; chapter corresponding collection construction | Contrast `[[]] * 2` with `[[] for _ in range(2)]`, then mutate one inner list. Follow with `[row for _ in range(2)]` to test the false rule “comprehensions always copy.” | Python FAQ explicitly explains repeated references [P1]. Reference-copying difficulty is documented [E1, E2, E4], but extrapolation to prevalence of this exact syntax is ours. Keep only two rows and one mutation; avoid random data or large grids. |

Prefer one decisive prediction per baseline, one explanation of the changed relationship, and one small modification. Ask learners to make a prediction before stepping, then locate the first state that contradicts it. On a later task, ask for an unaided explanation of a new example. Do not treat a wrong output alone as proof of a stable misconception [E5], and do not grant additional tutorial completion credit merely for playing the animation.

## Primary evidence cards

All links were inspected or retrieval was attempted on 2026-10-03. “Full text” below means the relevant methods, findings, and limitations were inspected in an author, publisher, or university-hosted text, not that every cited work within it was checked. Counts describe the specific sample or instrument, not all Python learners.

### E1 — Python reference mental models

Kristin Marie Rørnes, Ragnhild Kobro Runde, and Siri Moe Jensen (2019), **Students' mental models of references in Python**, NIK 2019. [Publisher proceedings PDF, printed pp. 61–72](https://www.ntnu.no/ojs/index.php/nikt/article/download/6344/5674/24230).

**Access:** full article in proceedings, PDF pp. 64–75. **Design:** nine semi-structured interviews; two introductory-course surveys with 76 and 70 responses; five per group excluded for failing a basic-assignment control, leaving 136. **Finding:** 38/136 response patterns consistently matched the valid nonfunction reference model; 19/136 matched the valid call model. Sections 3–4 and Tables 1–3 distinguish copying values, copying references, and conflating parameter/caller bindings. Crucially, an incorrect copying model can predict the correct string-rebinding output (printed pp. 65–66).

**Limits:** one institution, voluntary lab-session participation, different course instruction/questionnaires, only one course interviewed; not all wrong patterns matched the models. No controlled intervention effect. **Implication:** pair prediction with explanation; contrast mutation and rebinding, then revisit inside calls. Strong direct relevance to example selection, not a universal prevalence estimate.

### E2 — Python list operations and overloaded syntax

Fionnuala Johnson, Stephen McQuistin, and John O'Donnell (2020), **Analysis of Student Misconceptions Using Python as an Introductory Programming Language**, Computing Education Practice 2020. DOI [10.1145/3372356.3372360](https://doi.org/10.1145/3372356.3372360). [Accepted manuscript](https://eprints.gla.ac.uk/203059/1/203059.pdf).

**Access:** full manuscript, especially §§3.2–4. **Design:** 42 survey responses, largely first-year Python students at one UK university; output/state predictions and confidence, following earlier exploratory work. Correct counts were 17 for `a = a + b`, four for `a.append(b)`, and 17 for `a += b`; one respondent answered all three correctly. The append task also changed the inserted list later, exposing nested sharing.

**Limits:** small voluntary sample; operation and aliasing difficulties are intertwined; authors' causal interpretation of overloading is not experimentally established. Their recommendation to add a lower-level language was not tested here. **Implication:** teach `append`, concatenation, and augmented assignment as explicit contrasts. Do not assume integer `+=` experience supplies list semantics or present the three forms as interchangeable shorthand.

### E3 — Assignment and call difficulties persist beyond CS1

Kathi Fisler, Shriram Krishnamurthi, and Preston Tunnell Wilson (2017), **Assessing and Teaching Scope, Mutation, and Aliasing in Upper-Level Undergraduates**, SIGCSE. DOI [10.1145/3017680.3017777](https://doi.org/10.1145/3017680.3017777). [Author full text](https://cs.brown.edu/people/sk/Publications/Papers/Published/fkt-teach-scope-mut/paper.pdf).

**Access:** full text, §§4–7, Tables 1–2. **Design:** pre/post quiz in a third-/fourth-year programming-languages course, analytic N=66; Java and Scheme questions, repeated in a different order. Scheme averages rose from 66% to 88%; Java from 65% to 69%, without a significant Java gain. Over one third answered the parameter-reassignment/caller-visibility item incorrectly both times.

**Limits:** no randomized treatment comparison; the instrument was not yet a validated concept inventory; language and topic were unevenly represented. Several activities occurred together, and the authors did not measure which caused improvement. **Implication:** explicitly check transfer between contexts and languages. Prior programming experience and a successful mutation example do not establish understanding of parameter rebinding.

### E4 — Later-course performance is not automatic mastery

Filip Strömbäck, Pontus Haglund, Aseel Berglund, and Erik Berglund (2023), **The Progression of Students' Ability to Work With Scope, Parameter Passing and Aliasing**, ACE, pp. 39–48. DOI [10.1145/3576123.3576128](https://doi.org/10.1145/3576123.3576128). [University repository full text](https://www.diva-portal.org/smash/get/diva2%3A1731978/FULLTEXT01.pdf).

**Access:** full text, §§3–5, Figures 1/3, Tables 3–5. **Design:** one-time, cross-sectional free-response tracing survey at one university across degree/year cohorts using Python or C++. The paper reports no significant overall difference across sampled years. Recurring incorrect answers treated assignments as copying object contents or parameter assignments as changing callers.

**Sample caution:** abstract/methods say 397 students, whereas Table 3 lists 395 answers with 21 incomplete; Table 4 year counts differ again. Do not label 397 a reconciled analytic sample. **Limits:** cross-sectional, not longitudinal growth; curricular/language/cohort differences and no significant difference do not demonstrate equivalence or inability to learn. **Implication:** later loop, member, and comprehension tasks can check transfer of the same rule rather than assume it.

### E5 — Correct outputs can conceal incorrect reasoning

Kuang-Chen Lu and Shriram Krishnamurthi (2024), **Identifying and Correcting Programming Language Behavior Misconceptions**, PACMPL 8, OOPSLA1, Article 106. DOI [10.1145/3649823](https://doi.org/10.1145/3649823). [Author full text](https://lukuangchen.github.io/Downloads/OOPSLA-2024_SMoL.pdf).

**Access:** targeted full text, §§4–9, especially §§5.1–5.2, 6.2, 7.1, and 8. **Design:** four-year instrument/tutor development, principally a voluntary upper-level course enrolling about 70–75 yearly; further deployments included a 12-student course and public users. These are different populations, not one pooled trial. Student explanations and modeled incorrect interpreters exposed copying/aliasing and parameter errors, including multiple reasons for the same answer.

**Limits:** SMoL, not Python; the tutor's effectiveness analysis was explicitly formative. Some error trends declined, others increased; several topics had only one usable question. No randomized comparison or delayed-transfer result establishes efficacy of our widgets. **Implication:** specify the learning goal, remove irrelevant language tricks, and ask for a reference explanation. Use a nearby variant to distinguish plausible rules instead of labeling every wrong answer a misconception.

### E6 — Structured prediction, investigation, and modification

Sue Sentance, Jane Waite, and Maria Kallia (2019), **Teaching computer programming with PRIMM: a sociocultural perspective**, Computer Science Education 29(2–3), 136–176. DOI [10.1080/08993408.2019.1608781](https://doi.org/10.1080/08993408.2019.1608781). [Full text hosted by the PRIMM project](https://primmportal.com/wp-content/uploads/2020/10/teaching-computer-programming-with-primm-a-sociocultural-perspective.pdf).

**Access:** methods, quantitative results, and limitations, §§5–8. **Design:** nonrandomized school comparison, ages 11–14; 493 PRIMM participants and 180 controls in the reported class table; teaching over 8–12 weeks with teacher preparation/materials. PRIMM participants had higher post-test scores; outcomes covered several programming tasks.

**Limits:** bundled classroom/dialogue intervention, school/teacher selection and implementation differences, younger population, and heterogeneous control teaching. The paper's interpretation of `r = .13` as “13% of variance” should not be repeated. It does not isolate prediction, animation, or one-line edits as causal ingredients. **Implication:** the predict–run–investigate–modify sequence is a reasonable scaffold. An editable animation without learner explanation is not equivalent to the studied PRIMM intervention.

### E7 — Recent evidence about choosing to use visual support

Naaz Sibia and colleagues (2026), **Code as Anchor, Memory and Metaphor as Support: Learner Experiences with Multi-View Visualizations**, ICER 2026, pp. 229–243. DOI [10.1145/3765964.3811662](https://doi.org/10.1145/3765964.3811662). [Author manuscript, arXiv v1](https://arxiv.org/html/2606.19570v1); publication confirmed in the [ICER research program](https://icer2026.acm.org/track/icer-2026-papers).

**Access:** full HTML manuscript, especially §§3–5. **Design:** within-subject sessions with 19 undergraduates who had completed CS1/CS2, two campuses of one university; think-aloud tasks, interviews, and approximate webcam gaze measurements comparing a research probe with Python Tutor. Students often anchored reasoning in code and consulted other representations selectively; responses to visual density and metaphors differed.

**Limits:** the authors explicitly did not analyze accuracy or completion as outcomes. This supports hypotheses about engagement and agency, not claims of improved learning. Manuscript details were not checked against publisher final text. **Implication:** keep code and controls available, give the diagram a precise checking purpose, and allow the learner to decide when to reveal/advance it. Avoid decorative complexity or compulsory autoplay.

### E8 — A useful null-result caution, abstract access only

Veronica Chiarelli, Nadia Markova, and Kasia Muldner (2023), **Evaluating the Utility of Notional Machine Representations to Help Novices Learn to Code Trace**, ICER, pp. 314–328. DOI [10.1145/3568813.3600119](https://doi.org/10.1145/3568813.3600119). A university-hosted [2024 author conference abstract, p. 37](https://carleton.ca/cognitivescience/wp-content/uploads/2024CUSpringConference_AbstractBooklet.pdf) was available in indexed text; direct retrieval returned 404.

**Access:** author abstract and conference metadata only; full methods not inspected. **Reported result:** two tutoring-system studies, N=44 and N=50, compared representations and fading. Pre/post gains occurred, but representation condition did not significantly affect learning; the abstract reports Bayesian support for the null.

**Limit:** no independent appraisal of allocation, measures, or uncertainty is possible from this access. **Implication:** do not promise learning gains merely because the diagram is more concrete or polished. This is a cautionary lead, not proof that all representations are equivalent.

## Authoritative language sources and evidence gaps

These establish behavior, not how frequently students misunderstand it. Python documentation was opened during this review; the behaviors below also apply to the Python version used by the lab, but examples still require actual interpreter/trace verification.

- **P1:** [Python programming FAQ: aliasing and multidimensional lists](https://docs.python.org/3/faq/programming.html#how-do-i-create-a-multidimensional-list). Repetition copies references; a fresh list expression in each iteration makes distinct lists. The same FAQ distinguishes aliasing, mutation, concatenation, and augmented assignment.
- **P2:** [Default argument values](https://docs.python.org/3/tutorial/controlflow.html#default-argument-values). Defaults are evaluated at definition; mutable defaults can retain changes. A `None` sentinel permits allocating a fresh list per omitted-argument call.
- **P3:** [Class and instance variables](https://docs.python.org/3/tutorial/classes.html#class-and-instance-variables) and [shallow/deep copy](https://docs.python.org/3/library/copy.html). Shared class state and per-instance state differ. A shallow copy retains references to components; deep copying uses memoization, so it need not destroy internal sharing or duplicate immutable leaves.
- **P4:** [Identity comparisons](https://docs.python.org/3/reference/expressions.html#is-not) and the same page's literal-identity caveat. `is` tests identity; equality follows the objects' comparison behavior. Avoid basing exercises on reuse of immutable literal objects.
- **P5:** [The `for` statement](https://docs.python.org/3/reference/compound_stmts.html#the-for-statement). Each iteration assigns the next item to the target using normal assignment rules; rebinding that target is not assigning into the container's slot.

No directly appraised study in this search quantified novice prevalence for **mutable defaults, Python class-attribute shadowing, identity versus equality, shallow versus deep copy, or repeated-list construction as specific syntax**. Broader evidence documents reference/copying/call difficulties. The exact traps are supported by language semantics and the lecture; choosing to visualize them is our curricular judgment.

Other useful leads were screened but not treated as full-text evidence: Ragonis and Ben-Ari's 2005 OOP study ([institutional abstract](https://weizmann.esploro.exlibrisgroup.com/esploro/outputs/journalArticle/A-long-term-investigation-of-the-comprehension/993263161803596); publisher PDF 403); Miller and Settle's 2016 Python `self` study ([author publication record](https://facsrv.cdm.depaul.edu/~cmiller/research/); SciSpace abstract retrieved but publisher full text 403); Kohn's 2017 variable-evaluation paper (indexed author PDF, current download 404); Kohn and Komm's 2023 scope study (discovery abstract only). These do not supply invented samples, effect sizes, or class-attribute prevalence estimates.

## Search provenance and limits

Both user-requested services were used successfully. SciSpace supplied semantic discovery results, including abstracts; Sider Scholar searched OpenAlex and returned bibliographic/PDF leads. They are discovery services, not independent replications of the same study. Search dates are separate from publication dates; indexing dates were not used as publication years.

| Service | Actual query | Useful results / limitation |
| --- | --- | --- |
| SciSpace | What empirical studies have found novice students' misconceptions about variable assignment, object references, aliasing, mutable objects, and function parameter passing in Python or Java programming? | E1/E3, Kohn, and scope-study leads. |
| SciSpace | What controlled studies show whether predicting and explaining program visualizations helps students learn object references, mutation, aliasing, copying, and notional machines? | E8, Sorva's dissertation and visualization tools; several results were tool reports or perception studies, not controlled learning evidence. |
| SciSpace | What empirical studies directly document Python students confusing identity with equality, shallow with deep copies, shared class attributes with instance attributes, mutable default arguments, or list repetition with fresh list construction? | E2 and Miller/Settle; many irrelevant software-performance or textbook results. No direct prevalence evidence established for the whole requested list. |
| Sider Scholar | `Python references aliasing misconceptions` | E4; OpenAlex record W4317435351; result set `5e8ba30b-f6f5-4c7f-98dd-2612f3beaa36`. |
| Sider Scholar | `object-oriented mental models assignment` | Ragonis-adjacent and mental-model leads, considerable irrelevant retrieval; result set `1d7c534c-b886-4ba0-a19a-6e57a4d032b5`. |
| Sider Scholar | `Python mutable default misconceptions` | Rørnes thesis and unrelated API/idiom results; result set `684a2ae3-66e2-428c-a377-551efa77f419`. |

Primary-source follow-up used exact-title web searches for E1–E8 and the screened leads, publisher/author/university URLs, and official Python documentation. Broader searches included `SIGCSE 2024 2025 notional machine assignment references students misconception`, `SIGCSE 2025 Notional Machine students`, and `SIGCSE 2024 reference aliasing`. Recent SIGCSE coverage surfaced the 2024 [concept-map selection poster](https://sigcse2024.sigcse.org/details/sigcse-ts-2024-posters/60/Using-Concept-Maps-for-Notional-Machine-Selection-in-CS1) and the 2025 [physical Java inheritance experience report](https://experts.illinois.edu/en/publications/experience-report-physical-models-of-java-inheritance/). They are relevant design context, not controlled evidence for these Python labs; no 2024/2025 efficacy finding was inferred from a program entry. E5 provides inspected 2024 work from OOPSLA; E7 supplies inspected 2026 ICER work.

Some web PDF opens timed out. Public repository downloads succeeded for E1, E2, E4, E5, E6, and E7 and were text-extracted locally for verification. E1's relocated URL downloads the complete proceedings; only its printed pp. 61–72 were used. No third-party full text is committed with this note. ACM publisher requests often returned 403; author/institutional versions were used where available. E8 remains abstract-only. No exhaustive database screening, systematic-review flow count, or retraction-database search is claimed.

## Local learning check

For each retained lab, inspect whether learners can (1) predict before revealing output, (2) identify the specific name/slot/attribute changed, and (3) explain a small variation without replaying the baseline. Later, use one unfamiliar loop or member example without the diagram to check transfer. Collect explanations as well as outputs; distinguish an arithmetic or syntax slip from a reference rule used repeatedly. Keep a lab when it clarifies a distinct relation; shorten or remove it if it duplicates an adjacent explanation without improving the learner's account. This evaluation proposal is local design synthesis, not a validated assessment instrument.

## Post-revision check

The final source definitions and `docs/object-reference-teaching-review.md` were inspected after the implementation changed to eight labs, each used on both surfaces. The revisions address the main issues above; no blocking pedagogical problem remains in the authored examples. This check is a content review, separate from interpreter and browser validation.

| Final example | Assessment against the evidence and teaching goal |
| --- | --- |
| `shared_slots` | Clear append/slot-replacement baseline; the variation rebinds the external name while leaving both slots intact. It makes competing reference rules observable without requiring overloaded-operator semantics. |
| `member_sharing` | Preserves useful constructor and method calls. The prompt explicitly asks what `self` reaches and separates distinct outer instances from their shared member. |
| `class_attributes` | Plain append followed by explicit attribute assignment isolates lookup and shadowing. The variation changes the owner of the assignment rather than adding another mechanism. |
| `shallow_copy` | Now directly contrasts shallow and deep copies while preserving repeated internal references. This is the most demanding remaining example: pause at the requested count of three outer/two inner lists before introducing the two mutations. Its placement after prior sharing lessons and before a separate member-copy task is appropriate. |
| `identity_equality` | Distinct list constructions avoid implementation-dependent interning. The final mutation demonstrates why the identity distinction matters rather than making Boolean prediction the entire task. |
| `parameter_rebinding` | Append, plain local assignment, and return make each operation's effect explicit. Removing the queue algorithm reduces unrelated work while preserving the caller/local distinction. |
| `mutable_default` | The first returned reference is checked again after a second call, so a snapshot misconception becomes visible. The missing function/default-storage edge is explicitly disclosed: the diagram demonstrates sharing across calls, while prose explains its persistence. This remains a representation limit, not proof of object disappearance between calls. |
| `loop_rebinding` | The baseline and mutation variation leave the final loop name displaying an empty list but produce different outer contents. That is a useful reason to inspect stored references instead of relying on one final value. |

Removing the early scalar lab without replacing it immediately is reasonable: the retained immutable worked explanation avoids introducing list operations before the tutorial teaches them. The three-way comprehension prediction provides later construction-versus-reuse transfer without another widget. Keeping `+=` versus `+` as a later chapter variation preserves the relevant E2 contrast. Further expansion should await learner explanations or an uncovered learning objective, rather than add more animations by default.
