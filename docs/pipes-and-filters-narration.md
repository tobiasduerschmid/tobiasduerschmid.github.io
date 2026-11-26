# Pipes and Filters video narration

The narration in the overview of `SEBook/architectural_styles/pipes_and_filters.md`
teaches the pipes-and-filters architectural style through a student
newspaper's game-day photos, in the order motivation, rules, consequences. It
is a video narration (`docs/video-narration.md`). Script:
`_data/narrations/pipes_and_filters.yml`; visual package:
`_data/narration_visuals/pipes_and_filters.json`; checks:
`_data/explainers/pipes_and_filters_quizzes.yml`; notes:
`_data/explainers/pipes_and_filters_notes.yml`; artwork:
`js/video-narration/pipes-and-filters.js` and `pipes-and-filters-kit.js` on the
architecture kit (`js/video-narration/arch-kit.js`) and the wall kit, styled by
`css/video-narration-pipes-and-filters.css`, on the `drafting-room` blueprint.

## Teaching design

- **Running example.** Every game photo needs the same steps: denoise,
  brighten, crop, blur fans' faces, watermark, publish. The photo desk's script
  runs each step on all three thousand photos and saves a folder in between,
  so nothing is online until midnight, and every change is surgery on one
  file. The rules scenes rebuild it as five filters joined by pipes; the
  consequence scenes reuse the denoise filter in a robot, insert and replace
  filters, and meet a live slider, re-encoding, a corrupted photo, a best-shot
  filter, and a caption filter that peeks at another filter's state.
- **The photo.** Each filter's work is visible on the photo: noise speckles and
  darkness, then brightness, a crop to the catch, fans' faces as blocks, and the
  paper's logo. Photos slide through pipes and never across a filter's name.
- **Order.** Motivation (game night; the batch script; nothing until midnight;
  change requests); rules (filters, pipes, source and sink, enrich, refine,
  transform; independence and parameters; agnosticism; a common format;
  incremental processing; acyclic flow and composition; order and the two
  roles); consequences (reuse, easy change and testing, throughput;
  interactivity, latency and re-encoding, error handling; non-incremental
  filters, bent rules, when to choose the style); recap.
- **Predictions.** When the first photo goes online with the batch script; when
  the second-quarter catch reaches the website with the pipeline. Each pauses
  four seconds and is answered by the next cue.
- **Checks.** Every section ends in a check on a new system (sensor logging, an
  album upload, a log cleaner, lecture captions, a podcast, a chat-log
  pipeline, live captions, log analysis); the summary quiz follows one campus
  radio station's podcast pipeline through motivation, rules, consequences, and
  applicability. Distractors are confusions the narration answers: a pipe
  holds everything until its writer finishes or routes items, order can't
  matter for independent filters, a slow step or slow saving is what delays a
  batch, a filter that waits for all its input breaks a rule other than
  incremental processing, and a restart scrambles the order or damages the
  recordings. Two reviewers who each saw only the script and the checks
  without their keys solved every check; the items they found ambiguous,
  guessable, or inaccurate were rewritten, among them a live volume slider in
  an audio chain, which such chains handle routinely.
- **Speech.** No authors, books, or dates are spoken. The rules use the
  lecture's names (independence, agnosticism, acyclic) plus incremental
  processing from the dataflow definitions.

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
| Filter: reads and processes data from an input stream and writes the result to an output stream; each filter does only one thing | CS 130 lecture 16, slide 18; lecture 17, slide 16. |
| Pipe: buffers data from a stream and preserves its order; one-way, order-preserving, data-preserving; pipes connect output ports to input ports | CS 130 lecture 16, slide 18; CMU 17-655 L10, Pipe-and-Filter 2 and 4; Clements et al. 2010, Table 4.1. |
| A buffer means neighboring filters don't work in lockstep: the reader waits only on an empty buffer, the writer only on a full one | Buschmann et al. 1996, Pipes and Filters, Dynamics, scenario IV. An earlier draft said a fast filter doesn't have to wait for a slow one, which a bounded buffer holds only for short bursts. |
| Data source and data sink; filters enrich, refine, or transform | Buschmann et al. 1996, Pipes and Filters, Structure; CMU 17-655 L10, Pipe-and-Filter 1. |
| Strict independence (no shared state or memory, interaction only through pipes); agnosticism (no knowledge of upstream or downstream neighbors); acyclic pathways from source to sink | CS 130 lecture 16, slide 18; lecture 15, slide 19. |
| Configuration parameters increase reusability; pass parameters to filters | CS 130 lecture 17, slide 17; Buschmann et al. 1996, Pipes and Filters, implementation step 4. |
| Connected filters agree on the type of data in the pipe; simple interfaces such as 2D pixel graphics | Clements et al. 2010, Table 4.1; CS 130 lecture 17, slide 16. |
| Filters read, transform, and write incrementally, delivering output before consuming all input, for low latency and parallel processing | CMU 17-655 L10, Pipe-and-Filter 2 and 3; Buschmann et al. 1996, Pipes and Filters, Solution; Fairbanks 2010, section 14.8. |
| The overall computation is the functional composition of the filters' computations | Clements et al. 2010, section 4.2.1; Bass et al. 2013, section 13.2. |
| The order of filters matters: add one then double differs from double then add one | CMU 17-655 L10, Pipe-and-Filter 4a side note. |
| Filter developer and pipeline (network) developer roles | Fairbanks 2010, section 14.8, Notes. |
| Promoted: reusability (decoupled filters, universal interface), extensibility (insert a filter), modifiability (replace a filter), throughput (filters as parallel threads or processes) | CS 130 lecture 15, slides 20 and 21; Clements et al. 2010, Table 4.1. |
| Filters can be tested in isolation with a known input | SEBook chapter, Quality Attribute Trade-offs (testability); Buschmann et al. 1996, Pipes and Filters, implementation step 3 notes that direct-call filters are harder to test in isolation. |
| "Up to five times as many photos" on five cores is an upper bound; the slowest filter sets the pace; transfer and context-switch costs often make parallel gains smaller | Buschmann et al. 1996, Pipes and Filters, Consequences (efficiency gain by parallel processing is often an illusion). A pipeline's rate is limited by its slowest stage, general pipelining knowledge. The narration says "up to" for this reason. |
| Inhibited: interactive usability (no feedback loops); latency from a lowest-common-denominator format that every filter parses and unparses | CS 130 lecture 15, slides 20 and 21; Bass et al. 2013, Table 13.4. Repeated lossy encoding degrading a JPEG is general image-format knowledge. |
| Tension: a continuous signal chain, such as an audio plug-in chain, routinely takes live parameter changes, which reach only the items still to come | The lecture's claim is about user interfaces that need incremental display updates. The slider example asks every photo, including those already processed, to update live, so each drag must send photos back through the rest of the line, a loop the one-way style excludes, and wait for them at the far end. Checks avoid live parameter changes in streaming audio, where the claim would not hold. |
| Tension: acyclic flow is the course's rule; classic definitions allow filters to form any graph and treat linear or acyclic pipelines as special cases | CS 130 lecture 16, slide 18; Clements et al. 2010, Table 4.1 (specializations may restrict the graph to an acyclic graph or a linear sequence, a pipeline); CMU 17-655 L10, Pipe-and-Filter 3 (are cycles permitted?). The narration teaches the course's rule. |
| Error handling is the pattern's weak spot; a failed filter can fail the whole pipeline | Buschmann et al. 1996, Pipes and Filters, Consequences ("Achilles' heel"); Bass et al. 2013, section 13.2. |
| A filter that needs all its input (sort) breaks incremental computation | Fairbanks 2010, section 14.8, footnote; Buschmann et al. 1996, Pipes and Filters, Consequences. |
| Embodied styles that bend a constraint lose the properties derived from it; sharing state is expensive or inflexible | Fairbanks 2010, sections 14.2 and 14.8; Buschmann et al. 1996, Pipes and Filters, Consequences. |
| Typical uses: stream processing, signal processing, logs, text through Unix commands; not interactive systems | Clements et al. 2010, section 4.2.1; Bass et al. 2013, section 13.2. Early compilers were pipelines (CMU 17-655 L10), but compiler passes usually share a symbol table and syntax tree, so the narration does not list them as steps that need no shared state. |

References:

- Buschmann, F., Meunier, R., Rohnert, H., Sommerlad, P., and Stal, M. (1996). *Pattern-Oriented Software Architecture, Volume 1: A System of Patterns.* Wiley.
- Clements, P., et al. (2010). *Documenting Software Architectures: Views and Beyond*, 2nd ed. Addison-Wesley.
- Fairbanks, G. (2010). *Just Enough Software Architecture: A Risk-Driven Approach.* Marshall & Brainerd.
- Bass, L., Clements, P., and Kazman, R. (2013). *Software Architecture in Practice*, 3rd ed. Addison-Wesley.
- Garlan, D. (2019). *Architectures for Software Systems* (CMU 17-655/17-755), lecture 10.
- Dürschmid, T., and Kim, M. *CS 130 Software Engineering*, UCLA, software architecture lectures.
