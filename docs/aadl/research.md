# AADL research and source review

**Research date:** 1 November 2026. **Purpose:** design an undergraduate SEBook chapter and a browser-first tutorial supporting textual AADL, automatic visualization, and model analysis. This is a targeted primary-source investigation, not a systematic literature review or a standards-conformance audit.

## Supplied source and how it changes the design

The user's `AADL.pdf` is a **95-page excerpt** of Peter H. Feiler and David P. Gluch, *Model-Based Engineering with AADL: An Introduction to the SAE Architecture Analysis & Design Language*. The book was published on 25 September 2012 and carries copyright 2013; these are not two editions. The supplied file includes front matter, Chapter 3, and an index. Chapters listed in the table of contents are not all present. [SEI bibliographic record](https://www.sei.cmu.edu/library/model-based-engineering-with-aadl-an-introduction-to-the-sae-architecture-analysis-design-language/)

The supplied file was text-extracted; relevant diagrams and listings were also visually inspected. Printed page numbers below differ from PDF viewer positions:

| Material | Printed pages | PDF pages | Design consequence |
| --- | --- | --- | --- |
| Preface | xv–xvi | 16–17 | Explain architecture-centered analysis and the distinction between model and implementation. |
| Component types/interfaces and top-level composition | 32–37 | 23–28 | Start with concrete boundaries and connections before introducing the complete category catalog. |
| Internal threads | 38–40 | 29–31 | Separate software containment from execution allocation. |
| Platform and bindings | 40–45 | 31–36 | Add hardware only when asking a deployment/timing question. |
| Scheduling example | 45–47 | 36–38 | Reproduce the transparent arithmetic as reasoning, while checking current tool support separately. |
| Source-code associations | 47–51 | 38–42 | An AADL implementation is still a model; source-code association is a separate concern. |
| Modes | 51–55 | 42–46 | Revisit one architecture in different configurations after a single-mode example. |
| Abstract flows | 55–58 | 46–49 | Teach source/path/sink and distinguish an allocation budget from runtime latency. |
| Abstract refinement and reusable patterns | 58–75 | 49–66 | Explain as extension material; avoid overloading the first tutorial with prototypes and refinement. |

The chapter's campus-rover model is original. It uses the book's transferable sensor→control→actuator pattern, which the book itself relates to land vehicles on p. 32. The tutorial's guided powerboat tasks and final obstacle-to-stop rover task are different practice surfaces; see the lesson-specific contracts rather than assuming their timing numbers describe one model.

### Apparent inconsistencies in the excerpt

**Flow reference, printed p. 57 / PDF p. 48, Listing 3-15.** The source flow exits `set_speed`, and the controller flow enters `set_speed`. The listing's end-to-end declaration names `EC5`, which connects `control_on`; nearby prose names `EC4`, which connects `disengage`. The declared `set_speed` connection is `DC3`. This discrepancy was confirmed visually, not inferred solely from extracted text. Treat it as an apparent internal listing/prose error; this review did not locate a publisher-issued erratum.

**Processor identifiers, printed p. 43 / PDF p. 34.** The explanatory text and adjacent diagrams use different processor identifiers from the relevant declarations. Use complete, independently checked source files in the new teaching material, rather than assembling fragments by copying names from captions.

**Historical tool claims.** The preface describes the 2009 revision and 2012 corrections. Scheduling screenshots and the particular plugin workflow are historical evidence, not proof of current browser capability. The 14% demand example uses upper execution times 2 ms and 5 ms with a common 50 ms period. The original rover file uses 2 ms and 3 ms with 20 ms periods, hence 25%. The abstract book flow totals 33 ms against 35 ms; the new separate budget file totals 18–22 ms against 25 ms. Do not mix these models or equate any of those totals with physical stopping time.

## Verified baseline and technical sources

The current core-standard record found is **SAE AS5506D**, revised 22 April 2022. Its official metadata was inspected; the complete paid normative text was **not** available. OSATE's corresponding property resources identify the language as AADL v2.3. AADL language version, SAE revision, and OSATE release are distinct identifiers. [SAE record](https://saemobilus.sae.org/standards/as5506d-architecture-analysis-design-language-aadl)

Primary sources inspected directly or through their official repository material:

| Source and locator | Evidence used | Access/interpretation boundary |
| --- | --- | --- |
| [OSATE 2.20.0 release notes](https://osate.org/user/osate-releases.html), 25 September 2026 | Stable baseline, Java 21 dependency, connection/flow instantiation changes | A release note is not a test of the browser port. |
| [OSATE capabilities](https://osate.org/user/about-osate.html) | Text/graphical environment and desktop analysis ecosystem | Desktop menu availability does not imply a headless command. |
| [AADL grammar at 2.20.0](https://github.com/osate/osate2/blob/2.20.0-RELEASE/core/org.osate.xtext.aadl2/src/org/osate/xtext/aadl2/Aadl2.xtext) | Categories, declarations, features, flow syntax | Grammar inspection alone does not validate a whole model. |
| [Timing properties](https://github.com/osate/osate2/blob/2.20.0-RELEASE/core/org.osate.aadl2.contrib/resources/properties/Predeclared_Property_Sets/Timing_Properties.aadl) | Period, execution ranges, deadline applicability/defaults | Values still need measurement, estimate, or budget provenance. |
| [Deployment properties](https://github.com/osate/osate2/blob/2.20.0-RELEASE/core/org.osate.aadl2.contrib/resources/properties/Predeclared_Property_Sets/Deployment_Properties.aadl) | Allowed/actual binding, references, scheduler properties | The selected analysis determines which constraints it uses. |
| [Communication properties](https://github.com/osate/osate2/blob/2.20.0-RELEASE/core/org.osate.aadl2.contrib/resources/properties/Predeclared_Property_Sets/Communication_Properties.aadl) | Latency, queues, sampling/communication semantics | Source documents an OSATE deviation: `Required_Connection` defaults false rather than the stated standard default true. Validation is not normative certification. |
| [Project units/enumerations](https://github.com/osate/osate2/blob/2.20.0-RELEASE/core/org.osate.aadl2.contrib/resources/properties/Predeclared_Property_Sets/AADL_Project.aadl) and [modeling properties](https://github.com/osate/osate2/blob/2.20.0-RELEASE/core/org.osate.aadl2.contrib/resources/properties/Predeclared_Property_Sets/Modeling_Properties.aadl) | Units and conversion, supported protocols, classifier matching policy | Teach identical compatible port classifiers first, without declaring every other legal conversion invalid. |
| [Official headless tooling overview](https://osate.org/tooling/about-tooling.html) | Parser/annex support, instantiation, selected analyses | Does not supply a browser architecture editor. |
| [CLI 0.3.0 release](https://github.com/osate/aadl-tooling/releases/tag/osate-cli-v0.3.0), 29 September 2026 | Downloadable native reference implementation | Actual artifact provenance differs from the README's OSATE baseline; see below. |
| [CLI manual at release tag](https://github.com/osate/aadl-tooling/blob/osate-cli-v0.3.0/osate-cli/OSATE-CLI.md) | Command behavior and output/error contracts | Exit zero may coexist with diagnostics or model failure. |
| [Instantiation command](https://github.com/osate/aadl-tooling/blob/osate-cli-v0.3.0/aadl-language-server/org.osate.aadl.ls/src/org/osate/aadl/ls/commands/InstantiateCommand.java) and [latency command](https://github.com/osate/aadl-tooling/blob/osate-cli-v0.3.0/aadl-language-server/org.osate.aadl.ls/src/org/osate/aadl/ls/commands/AnalyzeLatencyCommand.java) | Concrete engine APIs that the bridge can reuse | Java entry points are evidenced; browser compatibility is not. |
| [Analysis result](https://github.com/osate/aadl-tooling/blob/osate-cli-v0.3.0/aadl-language-server/org.osate.aadl.ls/src/org/osate/aadl/ls/commands/AnalysisCommandResult.java) and [result adapter](https://github.com/osate/aadl-tooling/blob/osate-cli-v0.3.0/aadl-language-server/org.osate.aadl.ls/src/org/osate/aadl/ls/commands/CommandUtil.java) | Structured reports, diagnostics, severity mapping | Severity does not establish completeness; host must own canceled/stale outcomes. |
| [CheerpJ changelog](https://cheerpj.com/docs/changelog), 30 October 2026 | CheerpJ 5 adds Java 21 | Very new runtime; no OSATE integration was demonstrated by these docs. |

The grammar/property inspection used the OSATE `2.20.0-RELEASE` source, resolved to commit `fa165cb32faece107a1bd35ced0d74f6976bc4b5`. The separately downloaded CLI 0.3.0 reports language server **0.3.0 (895e0b9)** and **OSATE 2.21.0-SNAPSHOT (b8308b7)**. Native validation in this package uses that exact shipped artifact, not an assumed 2.20.0 binary. A browser implementation must pin and verify its own whole dependency closure.

Two source-quality cautions matter. The old [osate/examples repository](https://github.com/osate/examples) explicitly says it is unmaintained; prefer versioned examples in `osate2`. Some tooling skill reference pages describe string-valued returns while tagged source exposes a structured result record; use the exact tested API/source, not a stale prose sketch.

## Broader analyses and follow-up reading

| Primary source | Contribution to this design | What was not established |
| --- | --- | --- |
| [Feiler and Hansson, Flow Latency Analysis with AADL](https://www.sei.cmu.edu/library/flow-latency-analysis-with-the-architecture-analysis-and-design-language-aadl/), 2007, CMU/SEI-2007-TN-010 | Distinguish computation, sampling/queuing, and transfer contributions | Abstract/indexed sections inspected, not a complete current-tool conformance check. |
| [Hudak and Feiler, Developing AADL Models for Control Systems](https://www.sei.cmu.edu/library/developing-aadl-models-for-control-systems-a-practitioners-guide/), 2007, CMU/SEI-2007-TR-014 | Further reading on iterative control-system modeling | Bibliographic record/abstract inspected; full report not reviewed. |
| [Architecture Fault Modeling and Analysis with EMV2](https://www.sei.cmu.edu/library/architecture-fault-modeling-and-analysis-with-the-error-model-annex-version-2/), 2016, CMU/SEI-2016-TR-009 | Fault/error propagation and recovery as a separate modeling layer | Abstract inspected; no fault analysis of the rover performed. |
| [AGREE definition](https://loonwerks.com/tools/agree.html) and [CLI](https://github.com/loonwerks/AGREE/blob/master/com.rockwellcollins.atc.agree.cli/README.md) | Compositional assume/guarantee reasoning, real headless interface | No browser run. Its CLI can use Java SMTInterpol; native Z3 is not universally required. |
| [Resolute definition](https://loonwerks.com/tools/resolute.html) and [repository](https://github.com/loonwerks/Resolute) | Architecture assurance cases based on claims/evidence | No browser run; external/file/shell functions need an explicit allowed capability set. |
| [Awas](https://awas.sireum.org/doc/01-getting-started/index.html) | Existing Scala.js exploration of exported instance models | Does not establish in-browser AADL parsing; [v3-awas is archived](https://github.com/sireum/v3-awas). |
| [HAMR](https://hamr.sireum.org/) | Model-to-code infrastructure and supported implementation-assurance workflows | No general browser compiler route verified. |
| [Ocarina](https://ocarina.readthedocs.io/) | Native AADL processing, generation, constraints, and analysis gateways | No official ready browser/Wasm port verified. Generating C is not porting the processor to Wasm. |
| [SEI's September 2026 tooling case study](https://sei.cmu.edu/blog/ai-augmented-aadl-in-visual-studio-code/) | Concrete latency, bus-load, and mode-reachability workflow with explicit assumptions | An illustrative tool demonstration, not evidence of learning gains or validation of this rover. |

The tool comparison informed the browser bridge recommendation; it is not an exhaustive survey. No inspected primary source established a ready-made browser-only editable-AADL→OSATE-instance→analysis package. That is a research limitation, not proof that such integration is impossible.

## Pedagogical synthesis and unresolved decisions

The requested pedagogical-advisor, SEBook authoring, tutorial-authoring, and CS tutorial-design skills informed the deliverables. The design uses a worked example, focused repair/completion tasks, progressively reduced scaffolding, delayed retrieval, and an independent transfer claim. This sequence is an **original design synthesis**. Its proposed 90-minute duration, helpfulness, and learning outcomes have not been tested with learners.

Publication must resolve the browser feasibility gate, generated diagram notation and accessibility, full lesson fixtures, glossary/bibliography entries, actual cold/warm runtime costs, and integration of any additional analyses. The [verification record](verification.md) distinguishes completed native checks from that future work. The [backend design](backend-design.md) specifies how to proceed without treating a mock diagram or a source-pattern check as language analysis.
