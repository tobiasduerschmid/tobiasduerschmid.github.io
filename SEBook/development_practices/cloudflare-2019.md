---
title: "Cloudflare 2019: A Debugging Investigation"
layout: sebook
static_uml: true
---

<link rel="stylesheet" href="{{ '/css/narrated-explainer.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/css/narrated-case-study.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/css/print-light.css' | relative_url }}">

# Investigation

Several unrelated websites suddenly return an error page. Their shared infrastructure is Cloudflare. You join the investigation with a symptom, competing explanations, and a need to restore service. **Which observation should you collect next, and what would it actually establish?**

This chapter follows Cloudflare's **2 July 2019 outage**. You will choose investigative actions, predict diagram states, explain a performance failure, and challenge a proposed repair. Familiarity with conditions, repeated work, and software tests is sufficient. Networking, regular-expression syntax, and experience responding to outages are not prerequisites.

## The system you are investigating

**Cloudflare** provides infrastructure that handles traffic for many websites. When a visitor opens a page, the browser sends a **request** asking a server for a resource. For a website using Cloudflare's proxy, that request reaches Cloudflare before it may reach the website's own server, called the **origin**. The response returns through the service to the visitor. A fault in shared infrastructure can therefore affect otherwise unrelated websites.

A **web application firewall (WAF)** examines requests for patterns associated with attacks. A **rule** specifies what to inspect and how to respond. Evaluating the rule and acting on its result are separate operations. A **regular expression**, or **regex**, describes a text pattern; a **matcher** is the program that decides whether supplied text fits it. You can reason about the matcher's work without reading the pattern's syntax.

A **CPU**, the central processing unit, performs computation. A service has finite processing capacity. If one operation occupies that capacity for too long, other requests can wait or fail even while the computer keeps executing instructions. **502 Bad Gateway** is a response indicating that a gateway could not obtain a usable upstream response. It is a symptom, not an identification of the defective component.

The diagrams distinguish the **request path**, where a visitor's request is processed, from the **deployment path**, where a changed rule reaches the machines processing future requests. Boxes represent responsibilities; they are not recovered source-code classes. Cloudflare's earlier architecture account describes rules compiled into Lua programs and evaluated during request processing {% cite GrahamCumming2013CloudflareLua %}.

## How to take part

Listen to the narration or use **Next step** to investigate silently. Before each reveal, choose an action and give yourself a reason: “If my explanation is right, I expect to observe …”. Use the feedback to revise that reason. The reading version supplies the same evidence and questions, with expandable answers.

**Published history** labels reported events. **Teaching reconstruction** labels an explanatory diagram or simplified trace. **Proposed experiment** labels a new test or contract. The choices are learning activities, not a transcript of the responders' deliberations; history does not branch according to your answer. Read the sections after the player when you are ready for the explanation and full chronology.

{% include narrated-case-study.html topic="cloudflare2019" %}

# Case Record

## The reported sequence

Cloudflare reported worldwide 502 responses, attributed the outage to a new rule, and rejected the attack explanation {% cite GrahamCumming2019CloudflareInitial %}. The rule ran in simulate mode: it evaluated real traffic without intentionally blocking matching requests {% cite GrahamCumming2019CloudflareDetails %}.

The following milestones use **Coordinated Universal Time (UTC) on 2 July 2019**, so events from different locations share one clock. They come from the detailed postmortem {% cite GrahamCumming2019CloudflareDetails %}.

| Time | Reported event |
|---|---|
| 13:31 | Approved change merged. |
| 13:37 | Build and tests passed. |
| 13:42 | Rule rollout began. |
| 13:45 | First synthetic-test alert. |
| 14:00 | CPU observations, strace, and logs implicated the WAF. |
| 14:02 | Global WAF termination proposed. |
| 14:07 | WAF terminated globally. |
| 14:09 | Traffic and CPU recovered. |
| 14:52 | WAF re-enabled after isolated causal and rollback checks. |

The existing tests covered matching and nonmatching requests, but not runaway CPU consumption. A CPU safeguard had been removed. Global rule distribution enlarged the impact; recovery-system access was obstructed. Restoration checks used a subset of traffic in one city, excluding paying customers. Other protections continued during WAF termination {% cite GrahamCumming2019CloudflareDetails %}.

## What the system diagrams explain

The sequence diagram connects computation to service: matching work occupies request-processing capacity, which can prevent a usable response. This differs from a rule deliberately rejecting a request. The component view separates that dependency from rule distribution. A configuration change can alter computation even when the service executable is unchanged.

A state diagram answers a different question: what condition permits the next transition? The proposed experiment distinguishes a completed match, a completed nonmatch, and a search requiring more work than its budget permits. Completing the final check exactly at the limit is allowed. These are teaching experiment states, not Cloudflare's historical state machine.

# Diagnosis

## How repeated choices consume time

**Backtracking** tries an alternative interpretation after a matching attempt fails. Suppose two adjacent repetitions can both consume the same characters. The matcher can give more characters to one repetition and fewer to the other, then retry what comes next. If a required later character is absent, many allocations can be explored before a nonmatch is returned.

The result can be logically correct while the amount of work is unacceptable. This is not necessarily an infinite loop, a corrupted value, or a mistaken Boolean answer. For a service, correct behavior also requires acceptable resource use and progress. State that requirement before calling an execution faulty; high CPU use alone is not proof of a defect.

Davis's analysis of the complete published expression identifies overlapping repetitions and input-dependent growth. Under the analyzed backtracking model, its worst case is quartic for full matches and quintic for partial matches; other inputs yield weaker quadratic behavior. The exact input requests responsible for the outage are not established by that analysis. **Superlinear** means the work can grow faster than input length; it is the useful introductory description here {% cite Davis2020RegexDissertation %}.

The adventure's small allocation trace exposes a mechanism. Its tokens, order, and work units are a teaching model, not captured production instructions. Reducing an example can preserve the relevant failure while changing its complete language or asymptotic complexity. Explain what the model preserves before generalizing from it.

## From symptom to diagnosis

A CPU observation can identify where to investigate. A recent change gives a candidate cause. Neither alone explains why the behavior violates a requirement. A useful diagnosis connects **cause and incorrectness**: identify how the candidate produces excessive work, and which service obligation that work defeats.

The adventure uses [The Debugging Book's terminology](https://www.debuggingbook.org/html/Intro_Debugging.html). The parent [Debugging chapter](/SEBook/development_practices/debugging.html#fault-error-failure) uses another common convention:

| What is wrong? | Parent chapter | This case and The Debugging Book |
|---|---|---|
| Implementation or configuration | Fault | Defect / bug |
| Execution state relative to its requirement | Error | Fault / infection |
| Externally observed behavior | Failure | Failure / malfunction |

A **symptom** is an investigator's observation; a **trigger** exercises the problematic behavior. A **mistake** is a human action or decision introducing a problem. Finding an inadequate assumption does not establish a particular programmer's thoughts.

System boundaries matter. A gateway can correctly generate an error response while the complete service fails its availability requirement. Likewise, a matcher can follow its algorithm faithfully while its use in the service is defective. Avoid naming a first faulty state without specifying the boundary and resource contract.

# Repairs

## Containment, restoration, and prevention

**Containment** limits current damage. **Restoration** returns a required function. A **repair** changes the condition responsible for failure. Preventive measures reduce recurrence or its impact. These can require different actions and different evidence.

The postmortem marked CPU-protection restoration and inspection of 3,868 rules complete. Performance profiling, engine migration, and staged deployment appeared among further actions; their publication-time status must remain distinct from subsequent completion {% cite GrahamCumming2019CloudflareDetails %}.

A 2020 engineering report confirms that Cloudflare migrated in July 2019 from PCRE (Perl Compatible Regular Expressions) to an engine inspired by RE2. RE2 is a matching engine designed to avoid the backtracking cost problem for its supported patterns. High-percentile execution-time outliers decreased; edge CPU consumption did not measurably change. Its separate 40% optimization is not the measured benefit of that migration alone {% cite DeMoura2020WAF %}.

## What would convince you a repair works?

Use two independent **oracles**, meaning criteria for deciding whether a result meets the requirement. A functional oracle checks intended matching behavior. A resource oracle checks the allowed work or time. A fast matcher that misses attacks is not an adequate repair; neither is a correct answer delivered after the service has become unusable.

Test the original failure, nearby inputs, ordinary successful use, and the target runtime. State engine version, matching operation, relevant options, and input assumptions. A small bounded experiment supports a narrow claim; it cannot establish the correctness of an entire protection system.

For a timeout, specify what happens when the limit is reached. For an engine migration, check supported patterns and matching behavior as well as cost. For a staged deployment, specify what observation stops promotion and how recovery remains accessible. Each proposed measure needs an obligation it enforces, not just a reassuring name.

# Your Debugging Method

The four stages organize this investigation; they are an instructional synthesis, not a verbatim four-item quotation from Zeller. Evidence can send you back to an earlier stage.

| Stage | Work to do | Evidence to leave behind |
|---|---|---|
| Investigate and reproduce | Separate observations from explanations; define the failure and control its conditions. | A repeatable trial with functional and resource oracles. |
| Locate | Narrow from service symptoms to component, operation, and candidate change. | Measurements and comparisons that discriminate among hypotheses. |
| Explain | Connect mechanism to violated requirement. | A causal account with a prediction that could refute it. |
| Repair and verify | Enforce the obligation while preserving useful behavior. | Regression checks, valid-use checks, and explicit limits. |

[Debugging Performance Issues](https://www.debuggingbook.org/html/PerformanceDebugger.html) develops measurement-based localization. [Reducing Failure-Inducing Inputs](https://www.debuggingbook.org/html/DeltaDebugger.html) develops smaller experiments. [Isolating Failure-Inducing Changes](https://www.debuggingbook.org/html/ChangeDebugger.html) connects repeatable tests to change isolation. These are methods to apply retrospectively, not claims about tools the historical team used.

After the adventure, write an investigation note for a different service that becomes slow after a configuration update. Give two plausible explanations, one discriminating observation, a proposed bounded reproducer, and a functional and resource test for a repair. Then identify what your evidence still cannot establish. Compare with the [Therac-25 investigation](/SEBook/development_practices/therac-25.html): which reasoning steps transfer despite the different failure mechanisms?

For practice with source code and debugger controls, continue to the [Python Debugging Tutorial](/SEBook/tools/python-debugging.html). Use the [Git chapter](/SEBook/tools/git.html) when your next question is which change introduced a reproducible failure.

# Evidence

Cloudflare's postmortem is the principal first-party incident account. The earlier architecture article supplies context, not an exact 2019 implementation specification. The later engineering report supports a particular remediation claim. Davis's dissertation supplies a separate analysis of the published pattern, especially §3.3, printed pages 49–50.

Broader research examines superlinear patterns, prevention, and repairs across Python and JavaScript ecosystems. Its pattern heuristics are investigative leads, not sufficient diagnoses; it predates this incident and does not evaluate this lesson {% cite DavisCoghlanServantLee2018ReDoS %}.

The public sources inspected do not supply all triggering requests, complete production configuration, every incident command, or a proof that every promised corrective action was completed. Diagrams, choices, and proposed experiments therefore remain labeled. Distinguish a reported historical result, a reproducible classroom model, and an untested repair proposal when defending your own conclusions.

After authoring, this prose and all twelve scenes' narration, diagram text, questions, and feedback were checked against the cited incident accounts and technical sources. The miniature model's candidate counts and first failing length were independently enumerated. This checks the teaching reconstruction; it does not reproduce the production outage.
