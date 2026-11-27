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
`css/video-narration-publish-subscribe.css`, on the `drafting-room` blueprint.

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
  call connectors with a port on both components, and the Observer
  comparison is a C&C view of objects and calls.
- **Order.** Motivation (lunch by robot; direct calls and their two pains);
  rules (topic, publishers, subscribers, queues; publisher and subscriber
  ignorance, with the difference from Observer; one-way propagation and
  asynchronous delivery); consequences (extensibility, run-time flexibility,
  replaceable parts; robustness and the silent renamed topic; what still
  couples programs; understandability, ordering, latency, a central broker;
  when to call directly instead); in practice (six real systems); recap.
- **Predictions.** What happens to Mochi when the dashboard hangs after the
  redesign, which students can derive from rule four; and what the planner
  does, and what reports an error, after the rename, where most expect an
  error. Each pauses four seconds and is answered by the next cue. The
  motivation states that a new counter means editing the camera, instead of
  asking.
- **In practice.** Six systems from six domains, each in its own C&C view:
  Android's airplane-mode broadcast, Slack's channel servers and gateways,
  Roblox's cross-server messages, Kafka at LinkedIn, MQTT in a smart home, and
  IEC 61850 trip messages between substation relays. The closing cue ties
  consumers that come and go to rules one and two, and three ways of living
  without a delivery receipt to rules one and three. Every claim was checked
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
  raises an error, and one receiver today makes a fact a request. Two reviewers
  who each saw only the script and the checks without their keys solved every
  check; the items they found ambiguous, guessable, or inaccurate were
  rewritten. What still couples the programs is each topic's name and the
  format and meaning of its events, following the shared event vocabulary in
  the sources below.
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
| Observer's subject holds its observers; implementing Observer with publisher-subscriber middleware decouples the subject completely and can run on other nodes; the Event Channel variant | Buschmann, Henney, and Schmidt 2007 (POSA5), p. 68; Buschmann et al. 1996, pp. 341–342. |
| A full subscriber queue drops its oldest messages | ROS 1 subscriber queue semantics (the queue size in `nh.subscribe`, CS 130 lecture 17, slide 18). |
| Promoted: extensibility (adding publishers and subscribers), run-time flexibility (dynamic subscribe and unsubscribe, late binding); modifiability because elements work independently | CS 130 lecture 17, slide 22; lecture 15, slide 26; CMU 17-655 L11, Quality Attribute Considerations 3. |
| The constraints are what give the style its power | CS 130 lecture 16, slide 19 notes. |
| The renamed-topic bug: a correct topic implementation, an inconsistent rename, two months in a popular open-source self-driving framework | CS 130 lecture 17, slides 19 and 20 and their notes (Autoware.AI). |
| Inhibited: robustness (direct communication detects a missing listener), understandability (who communicates with whom) | CS 130 lecture 17, slide 22. |
| Publishers and subscribers share the event vocabulary; changing event types or semantics affects many elements; design event structure early | Fairbanks 2010, section 14.11; CMU 17-655 L11, Event Binding and Structure, and Quality Attribute Considerations 3. |
| Notification order is non-deterministic; tracing events is hard; tests may not guarantee behavior | CMU 17-655 L11, Event-Oriented Systems: Overview, and Quality Attribute Considerations 2. |
| A diagram of components on one bus hides who talks to whom | Fairbanks 2010, section 14.11, Notes. |
| Indirection adds latency; a failed connector is a single point of failure; delivery is not guaranteed; unsuitable for hard deadlines | Bass et al. 2013, section 13.2. |
| Publish-subscribe is often combined with call-return | Clements et al. 2010, section 4.4.1, Relation to Other Styles. |
| Frameworks: DDS in ROS 2, MQTT for constrained IoT devices, Apache Kafka for high-throughput event streaming | CS 130 lecture 17, slide 24. |
| Tension: asynchronous delivery is the course's fourth rule, but some in-process event buses deliver synchronously, and a broker under load can block or throttle a publisher | CS 130 lecture 17, slide 23. The narration teaches the course's rule, and the hang it prevents depends on Mochi's queues, which drop the oldest frames when full (stated in the narration). |

The rule of thumb "publish facts, call for requests that need an answer or a
guarantee" is this lesson's own summary of the robustness and request-reply
points above; no source states it in those words.

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
