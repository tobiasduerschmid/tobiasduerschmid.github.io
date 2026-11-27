# Layers video narration

The narration at the top of `SEBook/architectural_styles/layers.md` teaches the
layered architectural style through Pearl Dash, a student team's rooftop
platformer that has to move to a handheld console, in the order motivation,
rules, consequences. It is a video narration (`docs/video-narration.md`).
Script: `_data/narrations/layered_style.yml`; visual package:
`_data/narration_visuals/layered_style.json`; checks:
`_data/explainers/layered_style_quizzes.yml`; notes:
`_data/explainers/layered_style_notes.yml`; closer look:
`_data/explainers/layered_style_code.yml`; study companion:
`_data/explainers/layered_style_study.yml` (`docs/narration-study.md`); artwork:
`js/video-narration/layered-style.js` and `layered-style-kit.js` on the
architecture kit (`js/video-narration/arch-kit.js`) and the wall kit, styled by
`css/video-narration-layered-style.css`, on the `drafting-room` blueprint.

## Teaching design

- **Running example.** Pearl Dash's jump function reads the laptop's keyboard,
  sets the jump speed, plays a sound through the laptop's audio driver, moves
  the squirrel, and draws it with the laptop's graphics library. The same
  device calls run through 38 of its 40 files, so porting the game to the
  console means a rewrite. The rules scenes group that code into four layers (game rules,
  engine, platform, drivers) and test them on an upward import; the
  consequence scenes replay the console port, a second game, a frame-rate
  problem, and a slower console graphics layer.
- **Notation.** Every diagram is a UML frame in ArchUML's notation
  (`js/video-narration/uml-kit.js`): its tab names its view, and its key
  explains its symbols. Layers live in a module view, each a «layer» package
  holding its modules, stacked so that vertical order is the allowed-to-use
  relation. Allowed-to-use relations are dashed dependency arrows, labeled
  «allowed to use» where they first appear (Views and Beyond, Figure 2.24).
  Three kinds of use keep three looks in every key: may use (dashed, in the
  sheet's ink), a bridge (amber dashed, labeled «bridge»; amber holds 3:1 on
  the sheet in both modes and stays apart from the red and the blue accents),
  and may not use (red dashed, struck by a red cross). Every line is
  straight: an arrow that skips a layer runs down its own lane beside the
  shorter layers it passes, never around the stack. The callback picture
  opens the Game rules and Engine packages: PearlHandler realizes the
  engine's CollisionListener, and the Engine class, which holds its
  listeners, calls the handler at run time; each arrow carries its relation
  in words («call» at run time; implements: the dependency). Tiers appear
  twice: in an allocation view, where dashed «tier» boundaries group the
  nodes and the running components on them, and in a three-tier
  component-and-connector view whose dashed tier boundaries are laid over the
  components, as Views and Beyond draws them (section 4.6.2), with «call»
  connectors only between adjacent tiers. The first C&C frame spells out its
  view's name.
- **Rules.** The lecture's three constraints (exactly one layer; only the same
  layer or the layer directly below; at least two layers) stay three rules,
  and the second is shown and spoken as two named parts: never up, which no
  layering relaxes (the chapter's golden rule), and next lower layer, which
  relaxed layering widens to any lower layer. A tag where the cards first
  appear says that these rules are the style's constraints. Rule numbers
  appear only on the rules' own definition cards (where the rules are defined,
  and the recap that restates them) and in the spoken definition; every other
  reference, on a card, balance chip, tag, note, quiz item, or study retry,
  uses the rule's name as on its card: Exactly one layer, Never up, Next lower
  layer, At least two layers.
- **Order.** Motivation (the game jam, the console request, the team; the
  tangled jump; the big ball of mud); rules (levels of abstraction and what
  each level knows, layers, each layer a machine for the one above;
  allowed-to-use and the three rules, with never up and next lower layer as
  the two parts of the second, and what each rule is for; callbacks; strict and relaxed
  layering, layers versus tiers, a three-tier system);
  consequences (portability, modifiability, reuse, the network stack,
  testability, and the division of labor as a benefit; performance and
  bridging, then the up-front cost as a cost rather than a quality; behavior that
  leaks through an unchanged interface, and how many layers); in practice (six
  real systems); recap.
- **Predictions.** Whether the engine may import the game's score module (never
  up), and which layers change for the console once the game is layered (next
  lower layer). Students can derive both from the rules; each pauses four
  seconds and is answered by the next cue, and the heading strip stays
  neutral until the answer names the quality. The tangle states its
  consequence (a port touches nearly every file) instead of asking, because
  students cannot reason about it yet.
- **In practice.** Six systems from six domains, each in its own module view:
  the Internet protocol suite, Android, Chrome, SQLite, AUTOSAR, and NASA's
  core Flight System. Each shows what layering buys there (a new link, a new
  chip, a port, a simulated failing disk, the same flight apps on a desktop),
  and the closing cue observes that most relax next lower layer: Chromium and SQLite
  let a layer skip down, while AUTOSAR, Android, and NASA document their
  exceptions. Every claim was checked against the systems' own documentation;
  see the table below and each cue's `source`.
- **Checks.** Every section ends in a check on a new system (a fitness app, a
  ride-sharing app, a banking app, a weather app, a video app, a smart
  thermostat, a video-call app, a music app); the summary quiz follows one
  music streaming app through motivation, rules, consequences, and a bridge.
  The introduction's check asks which project raises the console's question,
  not for a term; the rules' check asks what an upward import loses, and the
  strictness check asks what a documented bridge costs. Distractors are
  confusions the narration answers: the code the others connect through
  belongs on top, the engine that plays a song should choose it, a callback is
  an upward use, a downward bridge costs nothing, and slow behavior behind an
  unchanged interface means layering failed. The study companion offers a
  fresh retry for every question, an exercise that repairs the upward import
  with a listener interface, and a comparison of the full stack with a bridge
  under the console port. Phone and
  car examples name operating-system APIs, not drivers, because those systems
  keep drivers away from apps. Two reviewers who each saw only the script and
  the checks without their keys solved every check; the items they found
  ambiguous, guessable, or inaccurate were rewritten, among them a stack
  question whose user-interface option matched the common screens-on-top
  convention and a port to a new phone model, which its operating system
  would hide.
- **Speech.** No authors, books, or dates are spoken. The rules use the
  lecture's wording; "allowed to use" and "uses" follow the module-view
  definitions.
  After a rule's definition, the speech refers to it by name ("never up",
  "the next-lower-layer rule", the term of Bass et al. 2013, section 13.2),
  never by number alone; numbers stay on the rules' definition cards. "UML" is
  expanded once, where layers are first drawn as packages.
  A quality attribute on screen is named aloud by its term as its card or
  pan item arrives ("Portability: a new platform changes only the bottom
  layers"), and the reason is given in that quality's own terms, not a
  metaphor. The summary's trade-off (`ArchKit.tradeoff`) lists each quality
  with the rule it follows from and why, in the narration's order.

## Sources

The narration states ideas without naming sources; this is where each comes
from, for maintainers. "CS 130 lecture 17" is `L17_SoftwareArchitecture.pptx`
(Dürschmid and Kim, UCLA CS 130); "lecture 15" and "lecture 16" are the 2027
decks `L15_SoftwareArchitecture.pdf` and `L16_SoftwareArchitecture_2.pptx`.
"CMU 17-655 L12" is Garlan's *Call-Return Styles and Patterns* (2019).

| Claim in the narration | Source |
|---|---|
| A system that mixes low- and high-level issues; late changes should not ripple; parts should be exchangeable; a platform may change; teams need clear work boundaries | Buschmann et al. 1996, Layers, Problem (forces). |
| A big ball of mud has no evident structure and is the style most often achieved | Fairbanks 2010, section 14.7. |
| A layer is a module that cohesively groups functionality at one level of abstraction and offers services to the layer above | CS 130 lecture 16, slide 23; Clements et al. 2010, section 2.4; Bass et al. 2013, Table 13.1. |
| Each layer translates one request into several requests to the layer below; each layer is a virtual machine for the layers above | Buschmann et al. 1996, Layers, Dynamics, Scenario I; Fairbanks 2010, section 14.6; Clements et al. 2010, section 2.4.3. |
| The relation is allowed-to-use; A uses B if A's correctness depends on a correct B being present | Clements et al. 2010, sections 2.4.1 and 2.4.2; CS 130 lecture 17, slide 13. |
| Every piece of software belongs to exactly one layer; a layer may use only its own layer or the layer directly below; at least two layers, usually three or more; allowed-to-use must not be circular (never up) | CS 130 lecture 15, slide 24; lecture 17, slide 13; lecture 16, slide 23; Clements et al. 2010, Table 2.4; Bass et al. 2013, Table 13.1. The books list exactly one layer, at least two layers, and no circular use as the constraints, and leave next lower or any lower to a usage rule the design chooses; the lecture folds never up and next lower layer into one bullet. The narration keeps the lecture's three rules and shows the second as its two named parts. |
| Exactly one layer lets the usage rules govern every module (the tangled jump function sat on all four levels) | Clements et al. 2010, section 2.4.2; the reason is the lesson's own application of the rule to its tangle. |
| Upward usage destroys the properties layering brings; a system with upward uses is not layered | Clements et al. 2010, section 2.4.1. |
| Lower layers report upward through callbacks the lower layer defines; this is upward invocation, not upward use | Clements et al. 2010, Perspectives: Calling Higher Layers; Fairbanks 2010, section 14.6, Notes; Buschmann et al. 1996, Layers, implementation step 9. |
| Strict layering allows only the next lower layer; relaxed layering allows any lower layer; where only the next lower layer is allowed, a skip is layer bridging, an exception the documentation must show; bridging trades modifiability for performance | Buschmann et al. 1996, Layers, Variants (Relaxed Layered System); Clements et al. 2010, section 2.4.1 ("the layer diagram or an accompanying document will have to show these exceptions"); Bass et al. 2013, section 13.2; CS 130 lecture 15, slide 25. An earlier draft called every relaxed skip a documented exception, which mixed the two schemes. |
| Layers are not tiers: layers group code, tiers group running components | CMU 17-655 L12, Layers versus Tiers; Clements et al. 2010, section 2.4.5, pp. 96-97. The narration says the four layers "run together on one console", not "inside one program", because the drivers run in the operating system. A tier is a group of running components, usually by the machine they run on, not itself a process (section 4.6.2); the takeaway, notes, and checks say so. |
| A tier groups running components, usually by the machine they run on; connectors join only components in the same or an adjacent tier; a component belongs to exactly one tier | Clements et al. 2010, section 4.6.2, pp. 183-184 (tiers as logical groupings of runtime components, drawn as boundaries over a C&C diagram); Bass et al. 2013, section 13.2, Multi-tier pattern, pp. 235-237 (a C&C or allocation pattern, usually defined by computing environment). |
| A three-tier system (presentation, logic, data); each tier can be secured, scaled, and changed on its own, at an up-front cost | Bass et al. 2013, section 13.2, pp. 235-237 (security, performance, availability, modifiability; cost and complexity; Figure 13.15). The leaderboard is the lesson's own example. |
| Each level offers an abstraction that hides how; lower levels know less about the game and serve more programs | Clements et al. 2010, section 2.4; Bass et al. 2013, section 13.2, Layered pattern (a layering must provide the lower-level abstractions higher levels need). |
| Promoted: portability (platform dependencies in the bottommost layers), modifiability, reusability | CS 130 lecture 15, slide 25; Clements et al. 2010, section 2.4.3; Buschmann et al. 1996, Layers, Consequences. |
| TCP/IP is layered (application, transport, internet, link); TCP is reused by many applications; replacing one layer's implementation | CS 130 lecture 17, slide 14; Buschmann et al. 1996, Layers, Example. |
| Layers can define work assignments; layers can be tested independently | Clements et al. 2010, section 2.4.3; Buschmann et al. 1996, Layers, Consequences. Division of labor is shown as a benefit of exactly one layer, not as a quality attribute; testability follows from next lower layer. |
| Inhibited: performance, because requests traverse several layers with handoffs and transformations; up-front cost and complexity | CS 130 lecture 15, slide 25; Buschmann et al. 1996, Layers, Consequences (lower efficiency); Bass et al. 2013, Table 13.1. The sources disagree on how general the performance cost is: Clements et al. (section 2.4.3, p. 91) call runtime overhead a common misconception except for naive implementations, since compile, link, and load tools can remove much of it, while the lecture, Bass et al., and Buschmann et al. state the penalty. The narration follows the lecture in Pearl Dash's own naive design, and the notes add that build tools can remove some of the cost. The up-front cost is shown as a cost, apart from the inhibited qualities. |
| An interface embodies all assumptions, so a changed performance assumption leaks upward; cascades of changing behavior | Clements et al. 2010, section 2.4.3; Buschmann et al. 1996, Layers, Consequences. |
| Too few or too many layers; layers that evolve on different time scales or change at different rates | Buschmann et al. 1996, Layers, Consequences (granularity); Clements et al. 2010, section 2.4.1; Buschmann, Henney, and Schmidt 2007, Layers thumbnail. |

### In practice

| Claim | Sources |
| --- | --- |
| The Internet's four layers; the standards note deliberate leaks between them | RFC 1122, sections 1.1.3, 1.3.1, and 3.2.1.8; RFC 817, section 5. |
| Android's stack; a new chip needs a HAL module and driver; native code reaches some platform libraries directly | Android platform architecture; Android HAL and legacy HAL pages; Android NDK guide. |
| Chromium forbids upward includes (DEPS rules, checked on every upload); content calls up only through interfaces its embedder implements; lower modules may be included directly | Chromium `content/README.md`; `buildtools/checkdeps/README.md`. |
| SQLite's layers; the VFS as the bottom layer, replaced for ports and for fault-injection tests; in every smartphone | SQLite architecture, VFS (sections 2 and 3.5), testing (section 3.2), and deployment pages. |
| AUTOSAR's allowed-to-use matrix; no bypassing the microcontroller abstraction; complex drivers as the exception for timing-critical devices; skipping one layer should be avoided | AUTOSAR R22-11, Layered Software Architecture, slides 27, 40, 88, and 89 (PDF pp. 17, 78, 79). |
| The core Flight System's layers; one platform layer of two APIs (OSAL, PSP); the same apps on a Linux desktop and in flight; apps may call the OS API directly | McComas, Wilmot, and Cudmore 2016 (Figure 2, Table 2); Cudmore 2021, slide 3; cFE Application Developer's Guide, section 5. |

References:

- Buschmann, F., Meunier, R., Rohnert, H., Sommerlad, P., and Stal, M. (1996). *Pattern-Oriented Software Architecture, Volume 1: A System of Patterns.* Wiley.
- Buschmann, F., Henney, K., and Schmidt, D. C. (2007). *Pattern-Oriented Software Architecture, Volume 5: On Patterns and Pattern Languages.* Wiley.
- Clements, P., et al. (2010). *Documenting Software Architectures: Views and Beyond*, 2nd ed. Addison-Wesley.
- Fairbanks, G. (2010). *Just Enough Software Architecture: A Risk-Driven Approach.* Marshall & Brainerd.
- Bass, L., Clements, P., and Kazman, R. (2013). *Software Architecture in Practice*, 3rd ed. Addison-Wesley.
- Garlan, D. (2019). *Architectures for Software Systems* (CMU 17-655/17-755), lecture 12.
- Dürschmid, T., and Kim, M. *CS 130 Software Engineering*, UCLA, software architecture lectures.
