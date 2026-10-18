# Pedagogical Advisor Skill Package

A hierarchical, evidence-calibrated skill for supporting teaching professors with course, lecture, assessment, exam, homework, rubric, feedback, syllabus, and GenAI-aware design.

## What is included

This is not a single prompt. It is a progressive-disclosure package:

- a compact `SKILL.md` entry point;
- a large conceptual knowledge base;
- explicit reasoning and production workflows;
- reusable templates and scoring rubrics;
- worked examples;
- a claim-level evidence matrix;
- source syntheses and bibliography;
- machine-readable schemas and routing;
- evaluation prompts and red-team cases;
- small utilities for validation, template instantiation, and alignment auditing.

The design separates **knowledge**, **procedure**, **tools**, **templates**, **quality assurance**, and **evidence** so the model can load only what a task requires.

## Typical uses

- “Help me redesign this 14-week introductory course.”
- “Critique this lecture for cognitive load and active learning.”
- “Build a valid exam blueprint and then draft questions.”
- “Turn this vague assignment into a transparent, authentic assessment.”
- “Create a homework sequence using retrieval, spacing, and interleaving.”
- “Facilitate a brainstorming session rather than immediately choosing one design.”
- “Complete the missing rubric and feedback plan in this course document.”
- “Redesign this assessment for a context in which students have access to GenAI.”
- “Explain why students are succeeding on homework but failing transfer questions.”
- “Audit the alignment among outcomes, activities, assessments, and grades.”

## Entry points

- Start with [`SKILL.md`](SKILL.md).
- Use [`knowledge/00_knowledge-map.md`](knowledge/00_knowledge-map.md) for conceptual navigation.
- Use [`procedures/00_operating-model.md`](procedures/00_operating-model.md) for interaction and reasoning.
- Use [`config/router.yaml`](config/router.yaml) for machine-readable routing.
- Use [`references/evidence-matrix.csv`](references/evidence-matrix.csv) for claim-level evidence.
- Use [`procedures/15_quality-gates.md`](procedures/15_quality-gates.md) before delivering a design.

## Three design layers

### 1. Strategic layer

Defines the purpose of the course or assessment:
- consequential capabilities;
- learner and institutional context;
- standards and constraints;
- assessment claims;
- priorities and tradeoffs.

### 2. Learning-engineering layer

Designs the sequence that may produce learning:
- prior-knowledge diagnosis;
- explanation and modeling;
- guided practice;
- active/constructive/interactive work;
- retrieval and spacing;
- feedback and revision;
- transfer and metacognition.

### 3. Delivery layer

Produces usable teaching materials:
- module maps;
- session plans;
- prompts;
- assignments;
- exams;
- rubrics;
- instructions;
- policies;
- evaluation instruments.

The skill should not jump to the delivery layer before the strategic and learning-engineering layers are coherent.

## Evidence stance

The package distinguishes strong, conditional, emerging, contested, and disconfirmed claims. It favors convergent field evidence and authoritative standards, while treating mechanism, implementation fidelity, context, and local evaluation as part of every recommendation.

It deliberately avoids:
- simple “what works” rankings;
- learning-styles matching;
- unguided discovery for novices;
- activity-first course design;
- engagement as a proxy for learning;
- indiscriminate feedback;
- random exam construction;
- busywork homework;
- AI-detector-centered integrity strategies.

## Utilities

Validate the package:

```bash
python scripts/validate_package.py
```

Create a design workspace from templates:

```bash
python scripts/instantiate_workspace.py course ./my-course-design
python scripts/instantiate_workspace.py lecture ./week-4-session
python scripts/instantiate_workspace.py assessment ./capstone-assessment
```

Audit a structured course-design JSON file:

```bash
python scripts/audit_alignment.py examples/course-spec.sample.json
```

The scripts use only the Python standard library.

## Version

See [`VERSION`](VERSION) and [`CHANGELOG.md`](CHANGELOG.md). The focused version 2 update was researched on 5 September 2026; see `references/research-coverage-2026.md` for its scope and access limits. The alignment utility performs structural checks, not validated measurement of pedagogical quality. Its deprecated score is null, and either CLI output mode returns a failure status on critical structural findings.

Version 2 adds material repair, teaching operations, assessment clinics, AI-era computing and software engineering, AI literacy, teaching rehearsal, and expanded evidence/behavioral checks. See `tools/teaching-task-catalog.md` for concrete supported requests.
