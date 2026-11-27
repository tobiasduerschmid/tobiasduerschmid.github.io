# Pipes and Filters video narration

The narration in the overview of `SEBook/architectural_styles/pipes_and_filters.md`
teaches the pipes-and-filters architectural style through a student
newspaper's game-day photos, in the order motivation, rules, consequences. It
is a video narration (`docs/video-narration.md`). Script:
`_data/narrations/pipes_and_filters.yml`; visual package:
`_data/narration_visuals/pipes_and_filters.json`; checks:
`_data/explainers/pipes_and_filters_quizzes.yml`; notes:
`_data/explainers/pipes_and_filters_notes.yml`; study companion (question
reviews and retries, one diagram exercise, one comparison):
`_data/explainers/pipes_and_filters_study.yml`; artwork:
`js/video-narration/pipes-and-filters.js` and `pipes-and-filters-kit.js` on the
architecture kit (`js/video-narration/arch-kit.js`) and the wall kit, styled by
`css/video-narration-pipes-and-filters.css`, on the `drafting-room` blueprint.

## Teaching design

- **Running example.** Every game photo needs the same steps: denoise,
  brighten, crop, blur fans' faces, watermark, publish. The photo desk's script
  runs each step on all three thousand photos and saves a folder in between
  (batch sequential), so nothing is online until midnight, and every change is
  surgery on one file. A quick fix, one loop that takes each photo through
  every step, brings photos online early but still allows no reuse, no
  reordering, and no core per step, so the lesson does not credit the style
  with a gain that a loop swap alone delivers. The rules scenes rebuild the
  job as five filters joined by pipes; the consequence scenes reuse the
  denoise filter in a robot, insert and replace filters, and meet a live
  slider that would send published photos back upstream, re-encoding of the
  agreed format, a corrupted photo, a best-shot filter, and a caption filter
  that peeks at another filter's state.
- **The photo.** A night game from the sideline: three tiers of fans behind
  the wall, yard lines in perspective, and the receiver in the air with his
  gloves on the ball. Each filter's work is visible on it: sensor grain and
  darkness, then brightness, a crop to the catch, fans' faces pixelated, and
  the paper's logo. A token in a pipe draws only the photo's flat silhouette.
  Photos ride along beside a pipe, clear of its line, its arrowhead, and its
  ports, and never across a filter's name.
- **Notation.** Every diagram is a UML frame in ArchUML's notation
  (`js/video-narration/uml-kit.js`): its tab names its view, and its key
  explains its symbols. The line is a component-and-connector view: each
  filter a component with input and output ports, each pipe a «pipe»
  connector from port to port, sources and sinks as stereotyped components.
  The definition scene's key reads «filter» component and its filters carry
  the stereotype; later keys read filter, and only sources and sinks carry a
  stereotype. A narrow filter sets its name under its icon and its ports
  below the name, so no word comes within 8 pixels of a port. Every pipe is
  straight: the source stands above the first filter and the sink below the
  last. The nf-core frame is the lesson's branching graph, a tee and a join,
  so acyclic is not mistaken for linear. Throughput appears in an allocation
  view, one filter per processor core.
- **Order.** Motivation (game night; the batch script, named batch
  sequential; nothing until midnight; the one-loop quick fix and a table of
  what each design offers; change requests); rules (filters, pipes, source
  and sink as the system's boundary, a pipeline as a chain without branches;
  independence and parameters, with a label that the rules are the style's
  constraints; agnosticism; one agreed format; incremental processing;
  acyclic flow, tees and joins, and understandability as composition; order
  as a prediction, and the two roles); consequences (reusability,
  modifiability, extensibility, testability, performance as throughput;
  interactive usability, performance as latency from the agreed format,
  robustness in error handling; non-incremental filters, bent rules, when to
  choose the style); in practice (six real systems); recap (rules, then one
  balance that fills promoted and inhibited).
- **Predictions.** Two. When the second-quarter catch reaches the website
  with the pipeline, which students can work out from incremental processing;
  and whether the photo comes out the same with Crop after Watermark, which
  they can derive from what each filter does and which runs against the
  intuition that independent filters in any order give the same result.
  Each pauses four seconds and is answered by the next cue. The motivation
  states the batch script's delay (nothing online until midnight) instead of
  asking for it.
- **In practice.** Six systems from six domains, each in its own C&C view: the
  Unix shell's word-count pipeline, a graphics card's pipeline, an
  Elasticsearch analyzer, fraud detection on Apache Flink, a GNU Radio FM
  receiver, and an RNA-sequencing pipeline in Nextflow (nf-core/rnaseq,
  simplified). The nf-core frame draws the real data flow of the default
  route: the raw reads tee into FastQC and Trim Galore!, Trim Galore! feeds
  STAR and STAR feeds Salmon, and MultiQC joins the reports of all four; an
  earlier draft drew a pipe from FastQC to Trim Galore!, which does not
  exist. The closing cue names where each bends a rule: sort and MultiQC, the
  quality-control report, wait for all their input, and the output merger
  reads and writes shared buffers. Every claim was checked against the systems' own documentation;
  see the table below and each cue's `source`.
- **Checks.** Every section ends in a check on a new system (sensor logging, an
  album upload, a part between two filters that drops duplicates, a log
  cleaner, lecture captions, a podcast, a chat-log pipeline, live captions,
  log analysis, a graphics stage on a shared depth buffer); the summary quiz
  follows one campus radio station's podcast pipeline through motivation,
  rules, consequences, and applicability. Distractors are confusions the
  narration answers: anything between two filters is a pipe, a buffer makes a
  part a filter, a shared buffer stops incremental processing or one-way
  flow, order can't
  matter for independent filters, a slow step or slow saving is what delays a
  batch, a filter that waits for all its input breaks a rule other than
  incremental processing, and a restart scrambles the order or damages the
  recordings. Two reviewers who each saw only the script and the checks
  without their keys solved every check; the items they found ambiguous,
  guessable, or inaccurate were rewritten, among them a live volume slider in
  an audio chain, which such chains handle routinely. The filters check (a part
  that drops duplicates: pipe or filter?) and the in-practice check (a stage on
  a shared depth buffer) replaced a definition-recall item and a repeat of the
  limits check after the November 2026 review; they have not yet had a blind
  solve.
- **Speech.** No authors, books, or dates are spoken. The rules use the
  lecture's names (independence, agnosticism, acyclic flow) plus incremental
  processing from the dataflow definitions, and the rule cards carry the same
  names. Where the first rule card appears, a label says the rules are the
  style's constraints, the word the lecture and the books use.
  After a rule's definition, the speech and the quiz feedback refer to it by
  name ("independence", "incremental processing"), never by number alone;
  numbers stay on the screen's rule cards and in the definitions.
  A quality attribute on screen is named aloud by its term as its card or
  pan item arrives, in the lecture's vocabulary: Reusability, Modifiability,
  Extensibility, Testability, Understandability, Performance (throughput and
  latency), Interactive usability, and Robustness (error handling). The
  reason is given in that quality's own terms, not a metaphor. The summary's
  trade-off (`ArchKit.tradeoff`) lists each quality with the rules it follows
  from and why, in the narration's order; latency's row names the agreed
  format, not a rule.
- **Study companion.** Every check question has a review cue and a fresh
  retry; the exercise inserts Straighten and branches a thumbnail off the
  pipeline in a component diagram; the comparison sets the batch script at
  midnight beside the pipeline's seconds under "add a Straighten step". A
  video narration's comparison frames show each cue's step, notes, and
  picture description rather than the stage still, and the reading and print
  views do not list the study companion (only pattern readers include it).

## Sources

The narration states ideas without naming sources; this is where each comes
from, for maintainers. "CS 130 lecture 17" is `L17_SoftwareArchitecture.pptx`
(Dürschmid and Kim, UCLA CS 130); "lecture 15" and "lecture 16" are the 2027
decks `L15_SoftwareArchitecture.pdf` and `L16_SoftwareArchitecture_2.pptx`.
"CMU 17-655 L10" is Garlan's *Dataflow Architectures* (2019).

| Claim in the narration | Source |
|---|---|
| Problem: process data streams in a reusable, composable, flexible, and independently developable way; solution: a sequence of independent processing steps (filters) connected by channels (pipes) | CS 130 lecture 17, slide 15. |
| Batch sequential: each step runs to completion and its output file feeds the next; intermediate files clutter directories and rule out incremental and parallel computation | CMU 17-655 L10, Batch Sequential 2 and Pipe-and-Filter vs. Batch Sequential; Buschmann et al. 1996, Pipes and Filters, Consequences. |
| One loop per photo brings early results but keeps one file with shared settings: no step can be reused, reordered, or given its own core; the style offers all four | Reasoning from the batch-versus-pipeline contrast (CMU 17-655 L10) and the promoted qualities (CS 130 lecture 15, slides 20 and 21). The cue separates the two changes between the script and the pipeline, per item and independent steps, so the gain from per-item processing is not credited to the style alone. |
| Filter: reads and processes data from an input stream and writes the result to an output stream; each filter does only one thing | CS 130 lecture 16, slide 18; lecture 17, slide 16. |
| Pipe: buffers data from a stream and preserves its order; one-way, order-preserving, data-preserving; pipes connect output ports to input ports | CS 130 lecture 16, slide 18; CMU 17-655 L10, Pipe-and-Filter 2 and 4; Clements et al. 2010, Table 4.1. |
| A buffer means neighboring filters don't work in lockstep: the reader waits only on an empty buffer, the writer only on a full one | Buschmann et al. 1996, Pipes and Filters, Dynamics, scenario IV. An earlier draft said a fast filter doesn't have to wait for a slow one, which a bounded buffer holds only for short bursts. |
| Data source and data sink mark the system's boundary; a chain without branches is called a pipeline | Buschmann et al. 1996, Pipes and Filters, Structure; CMU 17-655 L10, Pipe-and-Filter 1; Clements et al. 2010, Table 4.1 (a specialization may restrict the filters to a linear sequence, sometimes called a pipeline). An earlier draft listed enrich, refine, and transform, which no later cue used. |
| Strict independence (no shared state or memory, interaction only through pipes); agnosticism (no knowledge of upstream or downstream neighbors); acyclic pathways from source to sink; the rules are the style's constraints | CS 130 lecture 16, slide 18; lecture 15, slide 19 (listed under Constraints). |
| Configuration parameters increase reusability; pass parameters to filters | CS 130 lecture 17, slide 17; Buschmann et al. 1996, Pipes and Filters, implementation step 4. |
| Connected filters agree on the type of data in the pipe; simple interfaces such as 2D pixel graphics | Clements et al. 2010, Table 4.1; CS 130 lecture 17, slide 16. |
| Filters read, transform, and write incrementally, delivering output before consuming all input, so filters can work at the same time | CMU 17-655 L10, Pipe-and-Filter 2 and 3; Buschmann et al. 1996, Pipes and Filters, Solution; Fairbanks 2010, section 14.8. Whether they do run at once depends on how they are deployed: CS 130 lecture 15, slide 21 (active filters as separate threads or processes); Buschmann et al. 1996, active and passive filters. The speech says "can all work at the same time" for this reason. |
| Streams may split at a tee and merge at a join; loops are excluded | Buschmann et al. 1996, Pipes and Filters, Variants (tee and join pipeline systems; feedback loops make the computation hard to explain); Clements et al. 2010, Table 4.1 (specializations restrict the graph to an acyclic one or a linear sequence); the SEBook chapter (directed acyclic graphs such as tee-and-join topologies). |
| Understandability: the overall computation is the functional composition of the filters' computations, because pipes buffer and filters don't know their neighbors, and only while the graph has no loops | Clements et al. 2010, Table 4.1 (simplifying reasoning about overall behavior) and section 4.2.1; Bass et al. 2013, section 13.2; Buschmann et al. 1996, Variants. The recap chips it Rules 1, 2, 4. |
| The order of filters matters: add one then double differs from double then add one | CMU 17-655 L10, Pipe-and-Filter 4a side note. |
| Filter developer and pipeline (network) developer roles | Fairbanks 2010, section 14.8, Notes. |
| Promoted: reusability (decoupled filters, universal interface), extensibility (insert a filter), modifiability (replace a filter), performance as throughput (filters as parallel threads or processes) | CS 130 lecture 15, slides 20 and 21; Clements et al. 2010, Table 4.1. |
| Filters can be tested in isolation with a known input | SEBook chapter, Quality Attribute Trade-offs (testability); Buschmann et al. 1996, Pipes and Filters, implementation step 3 notes that direct-call filters are harder to test in isolation. |
| "Up to five times as many photos" on five cores is an upper bound; the slowest filter sets the pace; transfer and context-switch costs often make parallel gains smaller | Buschmann et al. 1996, Pipes and Filters, Consequences (efficiency gain by parallel processing is often an illusion). A pipeline's rate is limited by its slowest stage, general pipelining knowledge. The narration says "up to" for this reason. |
| Inhibited: interactive usability (no feedback loops): a slider that updates every photo live, including those already published, would send them from the gallery back into Brighten | CS 130 lecture 15, slide 20 (Interactive Usability); Bass et al. 2013, Table 13.4 (cycles are important for user feedback); Garlan and Shaw 1994, section 3.1 (incremental display updates). A filter's parameter alone, such as Brighten's dial, is no loop; the loop comes from photos already published. |
| Inhibited: performance as latency, because the common format chosen so that any filter can follow any other forces every filter to parse and unparse the data | CS 130 lecture 15, slide 21 (a lowest-common-denominator format); Buschmann et al. 1996, Pipes and Filters, Consequences (data transformation overhead from a single data type for all filters); Garlan and Shaw 1994, section 3.1. An earlier draft traced the cost to independence; the lesson now chips it "One agreed format". |
| Tension: a continuous signal chain, such as an audio plug-in chain, routinely takes live parameter changes, which reach only the items still to come | The lecture's claim is about user interfaces that need incremental display updates. The slider example asks every photo, including those already published, to update live, so each drag must send photos from the gallery back into Brighten, a loop the one-way style excludes. Checks avoid live parameter changes in streaming audio, where the claim would not hold. |
| Tension: acyclic flow is the course's rule; classic definitions allow filters to form any graph and treat linear or acyclic pipelines as special cases | CS 130 lecture 16, slide 18; Clements et al. 2010, Table 4.1 (specializations may restrict the graph to an acyclic graph or a linear sequence, a pipeline); Buschmann et al. 1996, Variants (a tee-and-join graph may even contain feedback loops); Fairbanks 2010, section 14.8 (a network with several ports is more than a straight line; loops are rare and often prohibited); CMU 17-655 L10, Pipe-and-Filter 3 (are cycles permitted?). The narration teaches the course's rule, shows that tees and joins are allowed, and the notes say many definitions leave loops to special variants. |
| Tension: incremental processing is not among the lecture's three constraints, but the dataflow definitions make it the trait that separates the style from batch sequential | CS 130 lecture 15, slide 19 (three constraints); Fairbanks 2010, section 14.8; Buschmann et al. 1996, Pipes and Filters, Structure; Garlan and Shaw 1994, section 3.1; CMU 17-655 L10. The narration keeps it as Rule 3; the lecture slide could list it too. |
| Robustness: error handling is the pattern's weak spot; a failed filter can fail the whole pipeline | Buschmann et al. 1996, Pipes and Filters, Consequences ("Achilles' heel"); Bass et al. 2013, section 13.2. The lecture's quality list names Robustness; the cards say Robustness (error handling). |
| A filter that needs all its input (sort) breaks incremental computation | Fairbanks 2010, section 14.8, footnote; Buschmann et al. 1996, Pipes and Filters, Consequences. |
| Embodied styles that bend a constraint lose the properties derived from it; sharing state is expensive or inflexible | Fairbanks 2010, sections 14.2 and 14.8; Buschmann et al. 1996, Pipes and Filters, Consequences. |
| Typical uses: stream processing, signal processing, logs, text through Unix commands; not interactive systems | Clements et al. 2010, section 4.2.1; Bass et al. 2013, section 13.2. Early compilers were pipelines (CMU 17-655 L10), but compiler passes usually share a symbol table and syntax tree, so the narration does not list them as steps that need no shared state. |

### In practice

| Claim | Sources |
| --- | --- |
| Unix tools do one job and expect their output to feed an unknown next program; the word-count pipeline; sort reads all its input first | BSTJ 57(6), 1978, p. 1902; Bentley, Knuth, and McIlroy 1986, p. 480; Garlan and Shaw 1994, section 3.1; GNU Coreutils, `sort`. |
| A graphics pipeline: vertices shaded, primitives rasterized, pixels colored, stages running at once; the output merger reads and writes the shared render target and depth buffer | Direct3D 10 pipeline, rasterizer, and output-merger stage pages; Owens 2005, GPU Gems 2, chapter 29. |
| An analyzer chains character filters, a tokenizer, and token filters; by default full-text queries use the index analyzer; stemming must be configured | Elastic: anatomy of an analyzer, specify an analyzer, term-level queries, stemmer token filter. |
| Flink's fraud detector judges each transaction as it arrives, keyed by account | Apache Flink, fraud detection with the DataStream API (2.3); Learn Flink overview. |
| A GNU Radio flowgraph of blocks from source to sink; GNU Radio 3 refuses loops (GNU Radio 4 adds basic feedback) | Blossom 2004; GNU Radio `flowgraph.cc` and issue 7908; GNU Radio 4 README. |
| Nextflow processes share no writable state; nf-core modules have unit tests; MultiQC collects every step's reports | Nextflow training; nf-core/rnaseq; nf-core module testing; Nextflow `collect`; MultiQC docs. |
| nf-core/rnaseq's default route: FastQC and Trim Galore! each read the raw reads (FastQC writes reports and passes no reads on); trimmed reads go to STAR, then Salmon; MultiQC joins the reports of every step | nf-core/rnaseq `subworkflows/nf-core/fastq_fastqc_umitools_trimgalore/main.nf` (`FASTQC(reads)` and `TRIMGALORE(ch_trimmer_reads)` on the same reads), the MultiQC subworkflow (`ch_multiqc_files` collected before `MULTIQC`), and the pipeline's metro map. The frame is simplified: it omits UMI extraction, contaminant removal, and the other routes. |


References:

- Buschmann, F., Meunier, R., Rohnert, H., Sommerlad, P., and Stal, M. (1996). *Pattern-Oriented Software Architecture, Volume 1: A System of Patterns.* Wiley.
- Clements, P., et al. (2010). *Documenting Software Architectures: Views and Beyond*, 2nd ed. Addison-Wesley.
- Fairbanks, G. (2010). *Just Enough Software Architecture: A Risk-Driven Approach.* Marshall & Brainerd.
- Bass, L., Clements, P., and Kazman, R. (2013). *Software Architecture in Practice*, 3rd ed. Addison-Wesley.
- Garlan, D. (2019). *Architectures for Software Systems* (CMU 17-655/17-755), lecture 10.
- Dürschmid, T., and Kim, M. *CS 130 Software Engineering*, UCLA, software architecture lectures.
