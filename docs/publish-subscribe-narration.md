# Publish-Subscribe video narration

The narration at the top of `SEBook/architectural_styles/pubsub.md` teaches the
publish-subscribe architectural style through Mochi, a campus delivery robot,
in the order motivation, rules, consequences. It is a video narration
(`docs/video-narration.md`). Script: `_data/narrations/publish_subscribe.yml`;
visual package: `_data/narration_visuals/publish_subscribe.json`; checks:
`_data/explainers/publish_subscribe_quizzes.yml`; notes:
`_data/explainers/publish_subscribe_notes.yml`; artwork:
`js/video-narration/publish-subscribe.js` and `publish-subscribe-kit.js` on the
architecture kit (`js/video-narration/arch-kit.js`, shared with the Layers and
Pipes and Filters lessons) and the wall kit, styled by
`css/video-narration-publish-subscribe.css`, on the `drafting-room` blueprint;
closer look: `_data/explainers/publish_subscribe_code.yml`; study companion:
`_data/explainers/publish_subscribe_study.yml` (`docs/narration-study.md`).

## Teaching design

- **Running example.** Mochi's camera driver feeds six programs. Its loop
  calls each receiver by name, so a new pedestrian counter means editing the
  camera, and a hung dashboard freezes the robot. The redesign publishes
  frames to a topic; the rules scenes use the same programs; the consequence
  scenes replay a topic rename, an emergency stop, and a crowded topic list.
- **Notation.** Every diagram is a UML frame in ArchUML's notation
  (`js/video-narration/uml-kit.js`): its tab names its view, and its key
  explains its symbols. In the C&C views each program is a component with
  ports. A topic is a connector, never a component: `arch.topic` draws it as
  a rounded channel labeled «topic» and its name, and the key's pill glyph
  matches it. Attachments run between a component's port and the channel:
  `toTopic` for a publisher, `fromTopic` for a subscriber, so the port is
  always on the component's end and never on the topic. Direct calls are
  call connectors from ports on the Camera driver component, which holds
  its loop, to ports on the receivers. Each subscriber's message queue sits
  on its attachment, between the channel and the subscriber's port, as the
  lecture draws it. A picture that is not a C&C view sits on paper, not in a
  C&C frame: the timeline of who wanted the frames is a card, and the
  Observer pattern is an object diagram with underlined instance names.
  The first frame spells out "C&C: component-and-connector" under its tab.
  Edges are straight: the planner, the driving-commands topic, and the motor
  controller sit on one line, and the latency picture puts both routes, the
  direct call and the topic, each on one line. The broker in that picture is
  the topic's realization ("Realized by one broker process"), so the topic
  stays a channel. Clements et al. (Table 4.5) allow the event distributor to
  be read as a connector or as a component; the lesson always draws a
  connector.
- **Order.** Motivation (lunch by robot; direct calls and their two pains);
  rules (topic, publishers, subscribers, queues; publisher and subscriber
  ignorance, with the difference from Observer; one-way propagation and
  asynchronous delivery); consequences (extensibility, run-time
  flexibility, modifiability, and availability; robustness and the silent
  renamed topic; what still couples programs; understandability,
  testability, performance, and a central broker; when to call directly
  instead); in practice (six real systems); recap.
- **Predictions.** What happens to Mochi when the dashboard hangs after the
  redesign, which students can derive from asynchronous publishing; and what
  the planner does, and what reports an error, after the rename, where most
  expect an error. Each pauses four seconds and is answered by the next cue.
  While a prediction is open, the heading strip names the rules or the
  scene ("One-way propagation and asynchronous publishing", "The bug that
  compiles"), never the outcome; "Inhibits · Robustness" arrives with the cue that names it. The
  motivation states that a new counter means editing the camera, instead of
  asking.
- **Rules and constraints.** Where the rule cards first appear, a label says
  "These rules are the style's constraints", the word the lectures, the
  chapters, and the books use. A rule's number appears only on its
  definition card, in its definition cue's speech and step, and in its
  definition note. Everywhere else, the rule is named exactly as on its card,
  with no number: rule cards that reappear later, heading strips and scene
  titles ("Publisher and subscriber ignorance"), the trade-off chips, labels
  ("From one-way propagation and asynchronous publishing"), notes, quiz
  feedback, and the study companion.
- **Trade-off.** One quality list everywhere (cards, balance, heading strips,
  summary, takeaways, notes, chapter). Promoted: Extensibility and Run-time
  flexibility (publisher ignorance), Modifiability: replace a publisher
  (subscriber ignorance), Availability: fault isolation (one-way propagation
  and asynchronous publishing). Inhibited: Robustness (publisher ignorance
  and one-way propagation), Understandability (publisher ignorance and
  subscriber ignorance), Testability (asynchronous publishing), Performance:
  latency (the topic in between, no rule). In the recap's balance, each
  quality's rules are chips under its name, so each item has three lines:
  name, rule chips, and why; the lesson's CSS tightens the item spacing, and
  the beam sits high, so both full pans fit the stage at full text size. Each cue names each
  quality by the term on screen as it arrives and reasons in that quality's
  own terms; trade-off cues use no metaphor ("passes through an
  intermediary", "returns an error"). The single central broker is an
  availability risk of one realization, named in the latency cue, not an
  inhibited quality of the style.
- **In practice.** Six systems from six domains, each in its own C&C view:
  Android's airplane-mode broadcast, Slack's channel servers and gateways,
  Roblox's cross-server messages, Kafka at LinkedIn, MQTT in a smart home, and
  IEC 61850 trip messages between substation relays. The closing cue ties
  subscribers that come and go to publisher and subscriber ignorance, and
  three ways of living without a delivery receipt to publisher ignorance and
  one-way propagation. Every claim was checked
  against the systems' own documentation; see the table below and each cue's
  `source`.
- **Checks.** Every section ends in a check on a new system (a shuttle tracker,
  a parking app, a smart dorm, a doorbell, a campus events app, a food-ordering
  backend), and the summary quiz follows one new system, a campus parking
  garage, through motivation, rules, consequences, and applicability. Each
  distractor is a confusion the narration answers before the check: a slow
  receiver is skipped, a topic must list its subscribers, publishing returns a
  reply, a publisher can count on someone listening, subscriptions need a
  redeploy, subscribers don't depend on an event's format, a renamed topic
  raises an error, one receiver today makes a fact a request, and calls that
  no longer wait no longer name their receivers. Two reviewers
  who each saw only the script and the checks without their keys solved every
  check of the first version; the items they found ambiguous, guessable, or
  inaccurate were rewritten. A later summary question separates not waiting
  (asynchronous calls) from not knowing who listens (publisher ignorance). What still couples the programs is each topic's name and the
  format and meaning of its events, following the shared event vocabulary in
  the sources below.
- **Study companion.** Every check question has a fresh retry on a new campus
  system that points back to its teaching cue; the exercise adds a battery
  monitor as a subscriber in a sequence diagram (ArchUML's component diagrams
  cannot draw a topic as a connector without ports, so the exercise shows the
  topic as a lifeline of the infrastructure); and the comparison sets the
  direct calls against the topic under "add a seventh program". In a video
  narration, a comparison frame shows each cue's step, note, and picture
  description, since there is no reader diagram to copy.
- **Chapter.** The chapter below the video lists the four constraints by the
  lesson's names, compares the style with the Observer pattern by paradigm
  independence, uses the same quality list, and draws its topology figure in
  the lesson's notation: components with ports and a topic channel without
  ports. No ArchUML diagram type draws such a connector, so the figure is an
  inline SVG in ArchUML's palette, styled by the `.cnc-figure` rules in
  `css/sebook-content-pages.css`; like every article SVG it inverts in dark
  mode, and below 760px it keeps its size and scrolls sideways.
- **Speech.** No authors, books, or dates are spoken. The four rules are named
  with the lecture's words. Topic names appear on screen in code type and are
  spoken in words ("the camera image topic").
  After a rule's definition, the speech refers to it by name ("publisher
  ignorance", "asynchronous publishing"), never by number alone; numbers stay
  on the screen's rule cards.
  A quality attribute on screen is named aloud by its term as its card or
  pan item arrives ("Robustness: nobody confirms delivery"), and the reason is given in that quality's own terms, not a
  metaphor. The summary's trade-off (`ArchKit.tradeoff`) lists each quality
  with the rule it follows from and why, in the narration's order.

## Sources

The narration states ideas without naming sources; this is where each comes
from, for maintainers. "CS 130 lecture 17" is `L17_SoftwareArchitecture.pptx`
(Dürschmid and Kim, UCLA CS 130); "lecture 15" and "lecture 16" are the 2027
decks `L15_SoftwareArchitecture.pdf` and `L16_SoftwareArchitecture_2.pptx`.
"CMU 17-655" lectures are Garlan's *Architectures for Software Systems* decks
(2019): L10 Dataflow, L11 Message-Passing and Event-Oriented Styles, L12
Call-Return Styles.

| Claim in the narration | Source |
|---|---|
| Many components depend on one producer's changes; their number and identities aren't known in advance and change over time; direct calling dependencies are inflexible | Buschmann et al. 1996, Publisher-Subscriber, p. 339. |
| A blocking call waits until the callee completes; callers know the identity of the elements they call | CMU 17-655 L12, Call-Return Basics and Call-Return Elements. |
| Elements: publisher, topic (a runtime infrastructure that forwards events), subscriber; publishes-to and subscribes-to; one message queue per subscriber; `advertise`, `publish`, `subscribe(topic, 10, callback)` | CS 130 lecture 17, slide 18; lecture 15, slides 26 and 27. |
| The infrastructure delivers each published event to all subscribers of that event; any component may both publish and subscribe | Clements et al. 2010, section 4.4.1 and Table 4.5; Bass et al. 2013, section 13.2. |
| The four constraints: publisher ignorance, subscriber ignorance (subscribe to the event, not the source), one-way propagation (no return values), asynchronous (the sender does not block) | CS 130 lecture 17, slide 23; lecture 15, slide 27. |
| The producer's correctness cannot depend on recipients; publishers fire and forget and must work equally well with no subscribers; subscribers are unaffected when a compatible publisher replaces another | Bass et al. 2013, section 13.2; Fairbanks 2010, section 14.11. |
| Observer is a design pattern for objects; an architectural style is independent of the programming paradigm | CS 130 lecture 16, slide 39 notes (exit ticket). |
| Publisher-Subscriber is also known as Observer, and its publisher keeps the registry; the Event Channel variant places a channel between publishers and subscribers; list-based publish-subscribe, in which each publisher keeps its list, is one form of the pattern | Buschmann et al. 1996, pp. 339–342; Bass et al. 2013, section 13.2. The narration contrasts Observer with the topic-based form shown, not with every form. |
| Observer implemented with publisher-subscriber middleware decouples the subject completely and can run on other nodes | Buschmann, Henney, and Schmidt 2007 (POSA5), p. 68. |
| A full subscriber queue drops its oldest messages | ROS 1 subscriber queue semantics (the queue size in `nh.subscribe`, CS 130 lecture 17, slide 18). |
| Promoted: extensibility (adding publishers and subscribers), run-time flexibility (dynamic subscribe and unsubscribe, late binding); modifiability because elements work independently | CS 130 lecture 17, slide 22; lecture 15, slide 26; CMU 17-655 L11, Quality Attribute Considerations 3. |
| Modifiability names replacing a part without affecting the rest (as the lecture says for layers and filters); availability is the ability to mask or repair faults, which isolating a failing subscriber does; testability is the ease of demonstrating faults through testing; performance is measured in latency, throughput, and jitter | CS 130 lecture 15, slides 20 and 25; CS 130 lecture 17, slides 6 and 8. |
| The constraints are what give the style its power | CS 130 lecture 16, slide 19 notes. |
| The renamed-topic bug: a correct topic implementation, an inconsistent rename, two months in a popular open-source self-driving framework | CS 130 lecture 17, slides 19 and 20 and their notes (Autoware.AI). |
| Inhibited: robustness (direct communication detects a missing listener), understandability (who communicates with whom) | CS 130 lecture 17, slide 22. |
| Publishers and subscribers share the event vocabulary; changing event types or semantics affects many elements; design event structure early | Fairbanks 2010, section 14.11; CMU 17-655 L11, Event Binding and Structure, and Quality Attribute Considerations 3. |
| Notification order is non-deterministic; tracing events is hard; tests may not guarantee behavior (the lesson names this cost testability) | CMU 17-655 L11, Event-Oriented Systems: Overview, and Quality Attribute Considerations 2. |
| A diagram of components on one bus hides who talks to whom | Fairbanks 2010, section 14.11, Notes. |
| Indirection adds latency, a cost to runtime performance; a failed connector is a single point of failure; delivery is not guaranteed; unsuitable for hard deadlines | Bass et al. 2013, section 13.2. The lesson names the cost "Performance: latency" and traces it to the topic in between, not to a rule. |
| The event distributor may be viewed as a connector or as a component; in UML, a rich connector may be drawn as a component whose ports are its roles | Clements et al. 2010, Table 4.5 and Figures 3.11 to 3.13. The video and the chapter's figure draw a connector. |
| Publish-subscribe is often combined with call-return | Clements et al. 2010, section 4.4.1, Relation to Other Styles. |
| Frameworks: DDS (Data Distribution Service) in ROS 2 (Robot Operating System 2), MQTT (Message Queuing Telemetry Transport) for constrained IoT devices, Apache Kafka for high-throughput event streaming | CS 130 lecture 17, slide 24; lecture 15, slide 32 (the expansions; the OASIS committee uses the same name for MQTT). |
| Tension: asynchronous delivery (asynchronous publishing) is one of the course's rules, but Clements et al. treat blocking as a property to document (some systems block an announcer until every subscriber is notified), CMU L11 lists synchronous delivery as a less common sub-pattern, and a broker under load can block or throttle a publisher | CS 130 lecture 17, slide 23; Clements et al. 2010, Table 4.5 and pp. 175–176; CMU 17-655 L11, slide 29. The narration keeps the course's rule and states its scope: the cue says "in this style", a note beside the Rule 4 card says that some event systems notify synchronously and then a slow subscriber does stall the publisher, and the notes and the chapter say the same. The hang it prevents depends on Mochi's queues, which drop the oldest frames when full (stated in the narration). |
| Tension: Observer against publish-subscribe | The course's own answer is paradigm independence (L16 slide 39 notes), while POSA1 presents Publisher-Subscriber as Observer and SAIP lists list-based publish-subscribe. The narration leads with paradigm independence and says "in the topic-based form shown here" when it says that the topic keeps the list. |

The rule of thumb "publish facts, call for requests that need an answer or a
guarantee" is this lesson's own summary of the robustness and request-reply
points above; no source states it in those words.

The closer look's code is an in-process sketch: each subscriber has a bounded
inbox that drops its oldest message when full (Python's `deque(maxlen=10)`,
Java's `LinkedBlockingDeque`, and the same rule in C++ and TypeScript), and
the infrastructure drains each inbox on that subscriber's own thread (in
TypeScript, its own async task), so the code has the property the next scene
claims: a stuck callback stalls only its own inbox. The sketches compile and
type-check (Python with mypy in strict mode, Java, C++20, TypeScript in strict
mode).

### In practice

| Claim | Sources |
| --- | --- |
| Android broadcasts resemble publish-subscribe; the system routes the airplane-mode broadcast to registered apps, and the sending code names none | Android broadcasts overview and implicit-broadcast exceptions; `ConnectivityService.setAirplaneMode`. |
| A Slack channel server sends each message to every gateway subscribed to the channel | Slack Engineering, Real-time Messaging, 2023. |
| Roblox servers publish to topics; delivery typically within one to two seconds, best effort and not guaranteed | Roblox MessagingService reference; cross-server messaging guide. |
| LinkedIn's activity events on Kafka topics; new consumers need no producer change; consumers rewind to re-read about a week of data | Kreps, Narkhede, and Rao 2011; Goodhope et al. 2012; Kreps 2013, The Log. |
| MQTT servers deliver each message to every matching subscription; a sensor publishes readings to a topic | OASIS MQTT 5.0, section 3.3.4; Home Assistant MQTT sensor; Zigbee2MQTT topics. |
| GOOSE is publisher/subscriber; trips must arrive within 3 ms; no acknowledgement, so messages repeat, then slow to a heartbeat | IEC 61850-7-2 preview; Dolezilek et al. 2017; Loenders, Beerten, and Van Hertem 2018; Bhamare, ABB. |


References:

- Buschmann, F., Meunier, R., Rohnert, H., Sommerlad, P., and Stal, M. (1996). *Pattern-Oriented Software Architecture, Volume 1: A System of Patterns.* Wiley.
- Buschmann, F., Henney, K., and Schmidt, D. C. (2007). *Pattern-Oriented Software Architecture, Volume 5: On Patterns and Pattern Languages.* Wiley.
- Clements, P., et al. (2010). *Documenting Software Architectures: Views and Beyond*, 2nd ed. Addison-Wesley.
- Fairbanks, G. (2010). *Just Enough Software Architecture: A Risk-Driven Approach.* Marshall & Brainerd.
- Bass, L., Clements, P., and Kazman, R. (2013). *Software Architecture in Practice*, 3rd ed. Addison-Wesley.
- Garlan, D. (2019). *Architectures for Software Systems* (CMU 17-655/17-755), lectures 10 to 12.
- Dürschmid, T., and Kim, M. *CS 130 Software Engineering*, UCLA, software architecture lectures.
