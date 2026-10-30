---
title: "Therac-25: A Debugging Investigation"
layout: sebook
static_uml: true
---

# Investigation

A patient reports an unexpected effect. A console displays a low dose. Routine checks do not reproduce the event. **What would you investigate next—and what result would change your explanation?**

This case follows the Therac-25 radiation-therapy accidents through the work of reproducing a failure, locating its mechanism, explaining its cause, and challenging a repair. Start with three guided scenes: meet the people and machine, compare its two treatment modes, and walk through a normal setup. Then inspect the evidence and choose investigative actions. Basic variables and conditions are helpful; the narration introduces the system, diagram notation, and timing concepts before using them. No programming language or radiotherapy knowledge is assumed.

The investigation is self-paced. Listen to the narration or use **Next step** to inspect the diagrams silently. At each decision, predict before revealing the explanation, then use the feedback to reconsider your reasoning. **Evidence and sources** opens the historical details behind a scene. The reference sections below retain the complete chronology and technical names; you do not need to read ahead to understand the narration. The reading version contains the same evidence and questions; answers are expandable. History does not branch according to your choices.

The labels matter: **published history** identifies reported events; **teaching reconstruction** identifies a diagram of the published causal explanation; **proposed design** identifies a new contract used to reason about a repair. None of the diagrams is a recovered accident log or a complete medical-device design. The main historical account documents both what investigators established and what remained uncertain {% cite LevesonTurner1993Therac %}.

{% include narration.html topic="therac25" %}

# Case Record

## A machine with several states to keep consistent

Therac-25, manufactured by Atomic Energy of Canada Limited, was a medical linear accelerator used in cancer treatment. Electron treatment and X-ray production needed different beam settings and arrangements in the beam path. X-rays were produced when electrons struck a target; the X-ray mode used substantially higher electron-beam intensity. Without the required target, that intensity could become an inappropriate electron exposure. **Requested mode, applied settings, physical position, and permission to operate are distinct facts.** [Jonathan Jacky's technical account](https://staff.washington.edu/jon/pubs/safety-critical.html) explains this physical context.

The metal **target** was an X-ray-producing machine component, not the tumor. The **turntable** was inside the treatment head, not the patient's table. Its field-light position used visible light to help align the treatment field; it was not a treatment configuration. The **SET** action requested return toward the treatment position, rather than turning the beam on. These distinctions matter in the Yakima investigation: a status value permitting progression could not make an unsuitable physical position safe.

The controller used assembly-language software, shared state, tasks, and interrupts on one computer. Interleaving does not require several processors. One task can make a decision from an input, pause, and resume after another task has changed that input. The diagrams separate responsibilities so that those different observations become visible; their boxes are not evidence of an object-oriented architecture.

## Six accidents are not six instances of one proven defect

The principal investigation describes six accidents involving serious injuries and deaths. It does **not** establish six deaths or one common software mechanism for all six {% cite LevesonTurner1993Therac %}.

| Incident | Date or period | What this chapter can establish |
|---|---|---|
| Marietta, Georgia | 3 June 1985 | Reported overdose injury; precise software path unresolved in the available account. |
| Hamilton, Ontario | 26 July 1985 | Reported overdose; do not treat the later Yakima explanation as a proven reconstruction of this incident. |
| First Yakima, Washington | December 1985; treatment course ended 6 January 1986 | Separate from the January 1987 accident; precise software path unresolved. |
| First Tyler, Texas | 21 March 1986 | Initial observations and unsuccessful reproduction attempts preceded the later mechanism analysis. |
| Second Tyler, Texas | 11 April 1986 | Reconstructing rapid input correction helped establish a reproducible failure. |
| Second Yakima, Washington | 17 January 1987 | A separate check-control defect was identified. |

Physicist Fritz Hager and the therapists at Tyler contributed essential evidence. A 2024 article reports Hager's recollection that another therapist could reproduce the event when his initial attempt did not, emphasizing entry speed. It also discusses independent measurements and their limits. These are attributed later recollections, not a contemporaneous execution recording {% cite SilvisCividjian2024Therac %}.

The practical lesson is collaboration across evidence sources. An operator can reconstruct interactions, a physicist can investigate physical behavior, and a software investigator can connect values to decisions. None of those perspectives alone supplies the whole diagnosis.

# Diagnosis

## Tyler: why the correction did not repair the setup

The Tyler diagrams reconstruct dependencies in the published analysis. The shared mode/energy record was read by consumers at different times. `Datent` selected output parameters; `Hand` selected positioning behavior. The shared encoding did not itself contain a complete parameter table or a measured physical position.

The explanation involves **two coordination weaknesses**. During magnet setup, `Ptime` could clear the magnet-setting flag too early, disabling later checks for edits while setup continued. Separately, the completion logic did not reliably establish that the operator was *currently* finished editing. A previous visit to the command line was insufficient evidence of current completion. The result could be progression with settings and positioning derived from different requests {% cite LevesonTurner1993Therac %}.

These dependencies explain why the final display alone was an inadequate reproducer. They do not show that every rapid edit fails or that every slower edit is safe. The roughly eight-second setup interval is contextual timing, not a universal failure threshold.

An intermediate mismatch need not be a failure if operation remains inhibited. Choose the invariant before locating the first faulty state. At the flag level, clearing a flag while its protected activity continues can be the first infection shown. At the authorization level, the decisive violation is accepting a configuration without establishing the required agreement.

## Yakima: why absence of a warning did not establish success

In the January 1987 explanation, repeated setup passes incremented a one-byte value, `Class3`. Its nonzero value enabled a position check. At wraparound, zero could suppress that check. Under the vulnerable surrounding conditions, progression could then use malfunction status that did not record the required position problem.

Several conditions matter together: the physical positioning state, the guarded check, a SET action during the zero interval, and the other blocking malfunction bits remaining clear. The exact instruction ordering and physical-control versus console origin of the SET action were not recovered. Skipping a check does not clear an already-set fault bit. **Wraparound alone is not an overdose, a patient count, or a probability of harm.**

The arithmetic followed the rules of the representation. The implementation defect was using accumulation to maintain a check-required meaning. The generalizable debugging question is: **Does “no blocking status” mean the check passed, or merely that no current failure was recorded?**

## Cause, failure, and harm

The adventure uses [The Debugging Book's terminology](https://www.debuggingbook.org/html/Intro_Debugging.html). The parent [Debugging chapter](/SEBook/development_practices/debugging.html#fault-error-failure) uses another common convention. Translate explicitly:

| What is wrong? | Parent chapter | This case and The Debugging Book |
|---|---|---|
| Implementation | Fault | Defect / bug |
| Runtime state | Error | Fault / infection |
| Externally observed behavior | Failure | Failure / malfunction |
| Injury or loss | Not separately defined | Harm / consequence |

A **mistake** is a human action or decision that introduces an error. Inferring an inadequate implementation assumption does not reveal the programmer's thoughts. An allowed operator correction can trigger the defect without being the defect.

A **symptom** is evidence available to the investigator. A warning message can be a symptom without identifying the original incorrect state. Likewise, a device need not crash to fail: incorrect physical output is externally incorrect behavior. If an independent protective function prevents that output, the controller and the complete machine may have different outcomes relative to their respective requirements.

To defend a diagnosis, give two sentences: one establishes **causality**—how the sequence produces the state and behavior—and one establishes **incorrectness**—which requirement is violated. Then predict a nearby changed execution that could challenge the explanation. This applies Zeller's method retrospectively; the historical investigators did not use this later online book.

# Repairs

## The reported local changes

The reported Tyler corrections moved flag clearing to the end of magnet setup and added a shared keyboard-controlled editing-status flag to prevent premature progression. The reported Yakima correction assigned a fixed nonzero value instead of incrementing. These are different local repairs to different obligations {% cite LevesonTurner1993Therac %}.

The adventure's state machine is a **new teaching specification**. It requires authorization to refer to a current, consistent configuration and invalidates permission after an edit. It does not claim that the manufacturer used request revisions, that a diagram establishes atomicity, or that a software condition proves physical position. Unspecified events still need handling; in particular, an obsolete completion must not destroy a newer valid setup or cancel its preparation.

## What would count as evidence for a repair?

Use the original failure history and the original requirement. Then test ordinary successful operation, edits after readiness, delayed completion, and completion arriving out of order. A repair that inhibits everything avoids one bad outcome but fails the intended functionality. A repair that merely lengthens a delay can change one demonstration without enforcing the invariant.

For the bounded-flag exercise, distinguish **eliminating the representation error** from making it rarer. Increasing the counter width postpones a future zero. Assigning a nonzero value preserves the narrow check-required contract.

## Containment and system assurance

The April 1986 editing restriction was an interim containment action. Corrective-action review continued through further plans, restrictions, and the January 1987 event; it was not an instantaneous transition from “buggy” to “safe”. The wider response addressed protective hardware, interface and recovery behavior, documentation, analysis, and installed-system testing. Reported protective measures included independent turntable monitoring and single-pulse shutdown {% cite LevesonTurner1993Therac %}.

The question therefore expands from “Does this replay pass?” to “What prevents unsafe output if a controller decision is still wrong?” Separate boxes in a component diagram do not prove independence; the implementation, information sources, and enforcement paths must support the claim. A later government review independently records Therac-25 among serious recalls and identifies two software defects, but does not recover their instruction schedules {% cite GAO1989MedicalRecalls %}.

# Your Debugging Method

The four stages organize the work; evidence may send you back to an earlier stage. They are this chapter's instructional structure, not a verbatim four-item quotation from the book.

| Stage | Work to perform | Evidence to leave behind |
|---|---|---|
| Investigate and reproduce | Distinguish reports from explanations; control initial conditions and relevant event history. | A reproducer and an oracle that define this failure. |
| Locate | Follow data and control dependencies from the incorrect decision. | The values, reads, writes, and guards that could explain it. |
| Explain | Establish causality and the violated requirement. | A diagnosis with predictions that could be challenged. |
| Repair and verify | Enforce the obligation; retain intended operation; state remaining limits. | Original-history and valid-use tests, plus the scope of the claim. |

After the final printer scenario, write a short investigation note without copying an answer: name the symptom, two plausible explanations, the boundary observation that separates them, and one negative and one positive test. A location is a lead. A causal explanation plus a requirement is a diagnosis. A passing test is evidence with a scope.

For practice with actual source code and debugger controls after this diagram-only investigation, continue to the [Python Debugging Tutorial](/SEBook/tools/python-debugging.html). For isolating a change once a repeatable oracle exists, see [Git](/SEBook/tools/git.html).

# Evidence

The technical reconstruction relies principally on Leveson and Turner (1993). Their article combines incident information, correspondence, and reconstructed control flow; the authors explicitly describe limitations. Its university-hosted HTML sections and PDF mirrors are the same investigation, not independent corroboration.

The Hager interview adds firsthand retrospective testimony. Its discussion questions some familiar screen reconstructions; this chapter consequently uses abstract evidence and configuration diagrams rather than presenting a supposedly exact console. The government report supports the recall context, not the details of a particular trace. Exact patient doses and unverified statements about the earlier incidents are not needed to solve these debugging problems.

The authored chapter, diagrams, descriptions, narration text, and answer keys were checked against these sources after creation. Historical explanations, reconstruction assumptions, and original exercises remain labeled where students encounter them. Suggested guards and tests teach reasoning; they are not instructions for building or operating a medical controller.

Key reading locations are [the Tyler incident and software analysis](https://web.mit.edu/6.033/2004/wwwdocs/papers/Therac_2.html), [local corrections and the Yakima mechanism](https://web.mit.edu/6.033/2004/wwwdocs/papers/Therac_3.html), [the broader corrective-action process](https://web.mit.edu/6.033/2004/wwwdocs/papers/Therac_4.html), and [The Debugging Book's introduction](https://www.debuggingbook.org/html/Intro_Debugging.html).
