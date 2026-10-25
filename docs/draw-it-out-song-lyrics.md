# Draw It Out While It’s Cheap to Change: rewritten lyrics

New lyrics for the UML song on `SEBook/uml.md`. **Status: take 7 recorded and
integrated; its verses say when to use each diagram and element, sized to one bar
per line** (see "Take 7" and "How take 7 came out"). Takes 2, 4, and 6 were
recorded earlier; take 2 was the integrated song until take 6 replaced it, and
take 6 until take 7. `_data/songs/draw_it_out.yml` holds the words as sung, with
their timing. Where the sheet splits a sentence across short lines to slow the
singing, the storyboard keeps the sentence, or a clause of a long one, as one
line. Take 7's differences from its sheet are listed under "How take 7 came
out", take 6's under "How take 6 came out". Take 2 differed from its sheet in
these places:

- verse 5's chant drops the shouted "Guard:" ("Event: when! If! Slash, action:
  do!"), as take 1 dropped "Ball:". The cards on screen still name all three
  parts;
- the quiz intro drops "Think, then shout it!", so the screen shows it instead;
- question 6 is sung "Where does the price *attribute* live", which hints at
  the answer's "attributes";
- question 7 is sung "Your payment provider" instead of "New payment provider";
  the scene still shows one provider replaced by another;
- the final chorus ends "Ask your question and draw it out";
- the take ends by singing the hook once more ("Draw it out while it's cheap to
  change"), which became the outro;
- a short backing ad-lib after "Does A reference B?" in verse 3 is not
  captioned, because its words are unclear.

What changed from the previous take:

- **Why model, from Lecture 7 and the chapter's "Why Model?" section.** The intro
  opens with the "just keep coding, we'll fix it later" misconception and the
  lecture's load-bearing wall: a peer-to-peer start that later needs a server.
  Verse 1 follows the lecture's four teammates who picture four different
  buildings, a clear drawing that aligns them, and a vague one that doesn't, which
  is why a shared notation helps. It adds abstraction (a model keeps the part your
  question is about), early problem detection (a flaw on paper is cheap to fix),
  and the lecture's shared design that the team and a coding agent build from and
  then test against.
- **Full diagram names.** Every mention says Class Diagram, Sequence Diagram, State
  Machine Diagram, or Component Diagram, and UML is spelled out once as the Unified
  Modeling Language.
- **A chorus that maps questions to diagrams.** The lead sings a design question
  and the gang vocals answer with the diagram's name, so the chorus is itself
  retrieval practice. It opens with "while it's cheap to change" and closes with
  "ask your question", the chapter's purpose-first guideline.
- **What each element is for.** Each verse pairs the notation with its purpose:
  private members are hidden, so they can change, and public ones are promises
  that callers rely on; the hollow triangle reads as "is a"; an interface is a
  contract that two stores fulfill; the lecture's three questions choose between
  association, aggregation, and composition; a synchronous call makes the caller
  wait, which is where bottlenecks show; fragments are control flow; the state
  decides what the same event does; and provided and required interfaces let a
  component swap what sits behind them.
- **Removed:** all of SOLID (the bridge, verse 6, and the Rectangle/Square
  breakdown), the duplication and naming lines of verse 7, and the ER data view.
- **The quiz is in the lyrics.** A sung pop quiz in the format of the other songs
  replaces the spoken multiple-choice quiz after the song: seven open-ended
  questions, each answered by the crowd after a pause. Three ask which diagram fits
  a scenario, and four ask students to read or apply notation. Questions 1–5 and 7
  use scenarios the verses don't; question 6 traces the verses' library book
  through a case they don't spell out.

## Pace audit of take 1

Measured from take 1's word timings, in syllables per second while singing (rests
over 0.35 s inside a line don't count). The chorus, which students follow easily,
runs at 3.0–3.5 syllables per second. The verses run faster, and in verses 2, 3,
5, and 6 each line starts as the previous one ends, so students get no time to
link a symbol to its meaning before the next symbol arrives.

| Section | Average pace | Fastest line | Rushed lines |
| --- | --- | --- | --- |
| Intro | 2.7 | 4.2 | 0 |
| Verse 1: why model | 4.3 | 5.2 | 0 |
| Chorus | 3.3 | 4.9 | 0 |
| Verse 2: classes | 4.5 | 6.9 | 3 |
| Verse 3: relationships | 5.0 | 6.1 | 4 |
| Verse 4: Sequence Diagram | 4.5 | 5.2 | 3 |
| Verse 5: State Machine Diagram | 5.3 | 6.6 | 7 |
| Verse 6: Component Diagram | 4.8 | 5.4 | 4 |
| Pop quiz | 2.6 | 5.0 | 0 |

A line counts as rushed when it is sung at 5 or more syllables per second,
introduces notation, and the next line follows within 0.2 s. The threshold is a
planning estimate from this take, with the chorus as the comfortable reference,
not a research constant. Verse 1's "Hand the model to your team…" (5.2) teaches
no notation, and quiz 5 (5.0) is followed by the player's pause, so neither counts.

| Verse | Rushed line in take 1 | Syllables per second |
| --- | --- | --- |
| 2 | plus means public: others call it, so its promise stays the same | 6.5 |
| 2 | Italic name means abstract: you can't make a plain Shape | 5.6 |
| 2 | a hollow triangle points to the parent: every Rectangle is a Shape | 6.9 |
| 3 | Does A reference B? Association: a line, arrow pointing at B | 6.1 |
| 3 | Does A own B as a part? Hollow diamond at the whole: aggregation… | 5.2 |
| 3 | A reading list and its entries: filled diamond. Each entry points to a book | 5.3 |
| 3 | delete the list, the entries go. The books stay on the shelf | 5.0 |
| 4 | Sequence Diagram: one example run, top to bottom in time | 5.1 |
| 4 | client colon Client: object, then its class, over a dashed lifeline | 5.2 |
| 4 | Solid line, filled head: synchronous, the caller waits till it's done | 5.2 |
| 5 | State Machine Diagram: one object and the states it moves through | 5.6 |
| 5 | Black dot: the start. Rounded boxes: Available, Borrowed, Overdue | 5.4 |
| 5 | Borrow, slash, set the due date: now it's Borrowed. A day passes | 6.1 |
| 5 | is the due date past? If yes, Overdue. If no, it holds fast | 5.0 |
| 5 | Return from Borrowed: Available. From Overdue: Available, plus a fee | 6.6 |
| 5 | Same event, different action: the state decides. That's the key | 5.1 |
| 5 | Reacts the same, whatever came before? Then skip the State Machine Diagram | 5.6 |
| 6 | (Ball:) a provided interface, I offer. Socket: a required one, I need | 5.4 |
| 6 | Ball in socket, they snap: the client needs it, the server provides | 5.4 |
| 6 | An interface is a contract: what you can ask, not how it works inside | 5.1 |
| 6 | Get book, add book: all the client sees. The database? Out of sight | 5.1 |

What take 2 changes:

- **Every rushed line is split** into phrases of 3–11 syllables, one symbol and
  its meaning per line. Take 1 sang one lyric line per musical phrase, so a line
  half as long should come out slower and leave a breath before the next symbol.
  That is the expectation; only a new take can confirm it.
- **Three dense lines below the threshold are split too**, so each relationship in
  verse 3 follows the same shape (question, notation and name, consequence), and
  verse 2's interface and realization lines match.
- **Unchanged:** the intro, verse 1 (except one comma), all choruses, and verse
  4's fragment lines (3.8 and 4.7 syllables per second).
- **"Ball" sits inside the phrase** ("The ball's a provided interface"). Take 1
  dropped a one-word shouted "Ball:" pickup, as the INVEST takes dropped shouted
  letters.
- **A new, more conceptual pop quiz** (see "Quiz audit"): seven questions about
  one new system, a pizza app, that ask what a model is for, which diagram answers
  a design question, and what an element means for the design. Every answer
  differs from the one before it; take 1 sang question 1's answer for question 2.
- **The style prompt** asks for sung, not rapped, verses at a speaking pace with a
  breath after each line, 92 instead of 96 BPM, and a steady groove in verse 4
  instead of double-time, and it excludes fast and double-time rap.
- **The spoken outro is gone**, to stay under 5,000 characters; take 1 replaced it
  with an echo anyway.

### How take 2 came out

Take 2 runs 4:52, not the 5½ minutes this plan expected: Suno ignored the 92 BPM
request and played it at about 100 BPM, faster than take 1's 96. Splitting the
lines still slowed most verses, but not verse 2.

| Section | Take 1 | Take 2 | Rushed lines, take 1 → take 2 |
| --- | --- | --- | --- |
| Verse 2: classes | 4.5 | 4.6 | 3 → 3 |
| Verse 3: relationships | 5.0 | 3.9 | 4 → 0 |
| Verse 4: Sequence Diagram | 4.5 | 4.6 | 3 → 2 |
| Verse 5: State Machine Diagram | 5.3 | 4.6 | 7 → 2 |
| Verse 6: Component Diagram | 4.8 | 4.2 | 4 → 2 |

(Average syllables per second over each verse; rushed means 5 or more per
second on a line that introduces notation.) Verse 2's visibility, abstract-class,
and generalization lines are still sung at 5.7–6.8 syllables per second: Suno
ran each pair of short lines together at the faster tempo. A Suno section replace
of verse 2's middle (about 1:14–1:25 in take 2) with a slower, sparser feel would
fix it; the storyboard would then need re-aligning from that point.

## Take 7: take 6's sheet reworded for the singer (recorded and integrated)

Take 7 keeps take 6's verses and changes how they are worded for singing:

- every verse's tag adds "slow", every chorus's "high-energy", and the colons
  that introduced a definition became dashes ("Class Diagram- the code view");
- the spoken intro is written as sung ("Your colleague says- Just keep coding,
  we'll fix it later!") and in full sentences ("In Week one- we implement
  peer-to-peer. In Week nine- we need a server.");
- verse 1 names UML after the flaw lines, as what to use instead ("Is there a
  flaw in shipped code? / To change the code you need everyone / Use U-M-L, the
  Unified Modeling Language"), and drops "one notation for all of them";
- verse 3 says what to use ("Then use association", "Then use aggregation",
  "Then use composition"), "a car owns wheels / a library owns books", and asks
  "But what if B cannot exist without Ay?";
- verse 4 names the fragments ("Use an Alt Fragment", "Use an Opt Fragment",
  "Use a Loop Fragment") instead of closing with "if-else, if, and for";
- verse 6 spells out the interfaces ("Provided- / an interface the component
  offers, / required- / an interface the component needs;") and ends "and the
  client code still works";
- the quiz opens "Pop quiz- a pizza app! Help Design It!", with an
  "[instrumental bar]" cue between each question and its answer.

The sources table under "Take 6" still applies: the reworded lines make the same
claims.

**For the video.** Verse 1 now resolves the vague drawing when UML is named: the
four teammates come back around the whiteboard, and every thought bubble shows
the same class box. Verse 4's code cards light up as each fragment is named.

### How take 7 came out

Take 7, "Draw It Out" (1), runs 5:35 at about 122 BPM. The "slow" tags did not
slow the verses: they average 3.3–4.4 syllables per second (take 6: 3.3–4.1),
and verse 6 is the quickest, since its interface lines gained words in the same
bars. The quick lines are "hide it with a minus" (about 7 syllables per second),
"Write an interface" (7.6), "required" (7.5), and "The interface- a contract"
(6.9); each sits next to a slower line, and the picture holds its label past the
line.

Every line of the sheet is sung, so take 6's dropped lines are back: verses 5 and
6 open on their diagram's name (the state machine now appears as its name is
sung), the quiz sings "Pop quiz", and **question 2's answer is sung**, so all
seven questions have an answer bar and a quiz pause. The take differs from its
sheet in these places, and the captions follow the recording:

- Suno ignored the "[instrumental bar]" cues: each answer follows its question
  with almost no gap, so the player's quiz pause gives the time to think;
- question 4 drops the "a" ("Cancel: refund or fee?");
- the outro sings the hook twice, about four seconds apart, so the storyboard
  has two outro lines;
- sung, "that's asynchronous" still sounds like "that's a synchronous"; the
  caption and the "open head: asynchronous" label say which.

Whisper heard "Opt" as "Alt", "orders kept: filled diamond?" as "or does Cat the
Phil dive in?", and "Where's the price" as "Breath brace". Short clip passes
confirmed the words, and those marks take the times of the words Whisper heard.

**The stereo image wanders.** The first half is centred, but from verse 5 on the
voices drift right, up to 25 dB in the quiz, and the quiz's questions and crowd
answers jump between the two sides (take 6 never went more than 9 dB off
centre). The channels stay in phase, so the soundtrack merges them into mono.
A plain average would make the parts panned to one side up to 3 dB quieter than
the centred band. Instead, each frequency band keeps the in-phase sum and is
raised to the power the two channels had together, so every part keeps the
loudness it had in stereo (within about 0.2 dB). Timing is unchanged. The
described soundtrack is built from the merged track.

### Lyric sheet, take 7

4,855 characters, under Suno's 5,000-character limit.

```text
[Intro: spoken]
Your colleague says- Just keep coding, we'll fix it later!
In Week one- we implement peer-to-peer.
In Week nine- we need a server.
That first choice is a load-bearing wall now.
This time, we draw it out first.

[Verse 1: half-time, slow]
Ask for a building- four teammates see a tower, a mall, a factory, a museum.
Draw it clearly and all four see one house.
Draw it vague and they're lost again.
A model leaves some details out on purpose-
it shows the part your question is about.
Is there a flaw on paper?
Rub it out and you're already done.
Is there a flaw in shipped code?
To change the code you need everyone
Use U-M-L, the Unified Modeling Language
Hand the model to your team, your coding agent too,
then test what comes back against the plan you drew.

[Chorus: call and response, high-energy]
Draw it out while it's cheap to change!
Which classes, how they relate?
CLASS DIAGRAM!
Who calls whom, in what order?
SEQUENCE DIAGRAM!
What state's it in, what event moves it on?
STATE MACHINE DIAGRAM!
What runs, how it plugs together?
COMPONENT DIAGRAM!
Ask your question, then draw it out!

[Verse 2: melodic, bouncy, slow]
Class Diagram- the code view,
to plan and discuss it
with your team, then document
where the pieces go.
Will it change? Make it private,
hide it with a minus;
plus is just for what
the others need from us.
Is a Rectangle a Shape?
Then inherit- is - ay.
An ih-TAL-ick name- abstract,
not built, just built upon.
Want to swap what's underneath?
Write an interface-
it says what, but never how,
so swap the class right now.

[Verse 3: beat switch, slow]
Lines between the classes?
Ask three questions, in order.
Does Ay reference B?
Then use association.
Does Ay own B as a part?
Then use aggregation,
a car owns wheels
a library owns books.
But what if B cannot exist without Ay?
Then use composition,
a house and its rooms-
delete the whole, they go.
Not sure it's a part?
Association's safe;
save the hollow diamond
for when the whole-part counts.

[Chorus: high-energy]
Draw it out while it's cheap to change!
Which classes, how they relate?
CLASS DIAGRAM!
Who calls whom, in what order?
SEQUENCE DIAGRAM!
What state's it in, what event moves it on?
STATE MACHINE DIAGRAM!
What runs, how it plugs together?
COMPONENT DIAGRAM!

[Verse 4: melodic, steady groove, slow]
Sequence Diagram- one run,
one scenario, in time,
to see who waits on whom
and where bottlenecks grow.
Need the answer to go on?
That's a synchronous call-
you wait right there until
the reply comes back.
No need to wait around?
Then send and carry on-
that's asynchronous,
the sender doesn't block.
Exactly one path?
Use an Alt Fragment
Zero or one time?
Use an Opt  Fragment
Again while it's true?
Use a Loop Fragment

[Verse 5: melodic, lighter, slow]
State Machine Diagram-
when an object's response
depends on its state,
draw its life, state by state.
One run? Sequence Diagram.
Its whole life, every path?
The State Machine Diagram
tells the object's story.
Can each state be reached?
Can each state be left?
Trigger, guard, and action-
when, and if, and do.
Same trigger, different end?
The state it's in decides.
Reacts the same each time?
Skip the State Machine Diagram.

[Verse 6: slow build-up]
Component Diagram-
zoom out from the code
to the parts you deploy,
and how they connect.
Can you deploy it alone?
Then it's a component.
Just a class inside?
Keep it in the Class Diagram.
Provided-
an interface the component offers,
required-
an interface the component needs;
when need meets offer,
the pieces snap in place.
The interface- a contract,
what to ask, not how it works-
swap what's behind it,
and the client code still works.

[Final Chorus: key change, high-energy]
Draw it out while it's cheap to change!
Which classes, how they relate?
CLASS DIAGRAM!
Who calls whom, in what order?
SEQUENCE DIAGRAM!
What state's it in, what event moves it on?
STATE MACHINE DIAGRAM!
What runs, how it plugs together?
COMPONENT DIAGRAM!
Ask your question, then draw it out!

[Pop Quiz: call and response]
Pop quiz- a pizza app! Help Design It!
Your diagram skips the database. Mistake?
[instrumental bar]
Not if your question doesn't need it!
Slow checkout- waiting on what?
Which diagram?
[1 instrumental bar]
Sequence Diagram! See who waits on whom!
Customer gone, orders kept- filled diamond?
[1 instrumental bar]
No! The orders outlive the customer!
Cancel- refund or a fee?
Which diagram shows why?
[1 instrumental bar]
State Machine Diagram! The state decides!
The receipt email is slow. Which arrowhead?
[1 instrumental bar]
Open head! Send it and carry on!
Where's the price, who can change it?
Which diagram?
[1 instrumental bar]
Class Diagram! Attributes, plus and minus!
New provider, same interface-
does the app change?
[1 instrumental bar]
No! It only knows the interface!

[Outro]
Draw it out while it's cheap to change!
```

## Take 6: when to use each diagram, from the course (recorded; integrated until take 7)

Take 6 keeps take 5's line budget (5–7 syllables a line, at most 14 per rhyming
pair) and turns the verses from describing notation to saying **when to use each
diagram and element**. The video shows the notation itself, so the lyrics only
name an element and give its reason. The sources rank in this order: Lecture 7
(L7) and the SEBook UML chapters first, then *Documenting Software
Architectures: Views and Beyond* (Clements et al., 2nd ed., 2011), which L7 cites
on slides 9 and 31. Lines that only the book supports were left out.

| Take 6 lyric | L7 | SEBook | Views and Beyond |
| --- | --- | --- | --- |
| V2 "Class Diagram: the code view, / to plan and discuss it / with your team, then document / where the pieces go." | Slide 31: the code view is "useful for code-level design discussions & documentation"; slide 10 | `uml_class_diagram`: "The Blueprint of Software", close to the code | Module views for construction and communication, pp. 59–60 |
| V2 "Will it change? Make it private, … / plus is just for what / the others need from us." | Slide 10 (visibility) | §2.2: visibility enforces encapsulation; the code lab asks which information a caller still needs | Interface documentation exposes only what users need, p. 265 |
| V2 "Is a Rectangle a Shape? / Then inherit: is-a." | Slide 10: "Inheritance (Is-a)" | Generalization; mistake 1: check the "is-a" sentence | Generalization is the is-a relation, p. 83 |
| V2 "An ih-TAL-ick name: abstract, / not built, just built upon." | Slide 10 (abstract class name) | Abstract classes: cannot be instantiated, a base for subclasses | Abstract module, p. 83 |
| V2 "Want to swap what's underneath? / Write an interface: / it says what, but never how" | Slides 28–29 | §2.3: an interface says what, not how; interface realization | Realization lets one implementation substitute for another, pp. 83–84 |
| V3 the three questions, with car and wheels, library and books, house and rooms | Slides 14–16 (the questions verbatim, the same examples) | Aggregation, composition, and the strength table | — |
| V3 "Not sure it's a part? / Association's safe; / save the hollow diamond / for when the whole-part counts." | — | "Honest caveat on aggregation": when unsure, use association | — |
| V4 "one run, / one scenario, in time, / to see who waits on whom / and where bottlenecks grow." | Slide 18 ("show examples of interactions"); slide 31 (bottlenecks) | Component chapter table: a specific scenario | Traces; behavior documentation finds bottlenecks, pp. 289, 294 |
| V4 "Need the answer to go on? / That's a synchronous call … / No need to wait around? … / that's asynchronous, / the sender doesn't block." | Slide 18: "Caller blocks until response received" vs. "Non-blocking communication" | Part 1, messages | Synchronous blocks the sender, asynchronous does not, p. 292 |
| V4 "Exactly one path? Alt. / Zero or one time? Opt. / Again while it's true? Loop: / if-else, if, and for." | Slides 21–24 | Part 2, combined fragments | Alt and loop frames, p. 298 |
| V5 "when an object's response / depends on its state, / draw its life, state by state." | Slide 25 | §1: a response depends on the current state; the lifecycle | State machines for elements with interesting states, p. 303 |
| V5 "One run? Sequence Diagram. / Its whole life, every path? / The State Machine Diagram" | — | Component chapter table: scenario vs. lifecycle | Traces vs. comprehensive models, p. 294 |
| V5 "Can each state be reached? / Can each state be left?" | — | Mistake 3: dangling states | Show every transition out of a state, p. 304 |
| V5 "Trigger, guard, and action: / when, and if, and do." | Slide 25 mnemonic | §2.2 (event, guard, effect) | Transition labels, p. 303 |
| V5 "Same trigger, different end? / The state it's in decides. / Reacts the same each time? / Skip the State Machine Diagram." | — | §1 and mistake 5 | — |
| V6 "zoom out from the code / to the parts you deploy, / and how they connect." | Slides 27, 30 | §1 "Zooming Out from Code"; the question table | Runtime units and their interactions, p. 136 |
| V6 "Can you deploy it alone? / Then it's a component. / Just a class inside? / Keep it in the Class Diagram." | Slide 27: "not to be confused with 'module'" | Rule of thumb; mistake 1 | — |
| V6 "Provided: what it offers, / required: what it needs; / when need meets offer, / the pieces snap in place." | Slides 28, 30 | §2.2 and §4: ball and socket "snap together" | Linking required to provided interfaces, p. 265 |
| V6 "The interface: a contract, / what to ask, not how it works: / swap what's behind it, / the client code works still." | Slide 28 | §4: loose coupling | Interfaces are contracts, p. 262 |

Left out of an earlier draft because only the book supports them: "how fast,
and will it hold?" for the Component Diagram (the book's C&C views carry
performance and availability, p. 136; L7 puts bottlenecks under the behavioral
view), "time-outs and all" (p. 304), and "looser, side by side" for asynchronous
messages (p. 292). "Several kinds, one common core?" became the course's is-a
test. The take 5 line "What it owns goes with it" is gone: by slide 14,
aggregation also owns its parts, which outlive the whole.

Unchanged from take 5: the intro, verse 1, the choruses (each chorus question is a
row of the SEBook's "Question You Are Answering" table), the quiz, and the outro.
Every quiz answer still follows from the verses.

**For the video.** Verse 3 no longer sings the reading-list example; the lecture's
examples (car and wheels, library and books, house and rooms) fit the new lines.
Each scene should show the notation the moment its element is named, since the
lyrics no longer describe it.

### How take 6 came out

Take 6, "Draw It Out First" (5), runs 5:21 at about 120 BPM; Suno ignored the
134 BPM in the style prompt again. The one-bar lines worked: the verses average
3.3–4.1 syllables per second, against 3.9–4.6 in take 2. Three verse 2 lines are
still quick: "hide it with a minus" (about 7 syllables per second), "plus is just
for what" (about 8.6), and "Write an interface" (about 7.8). Each sits next to a
slower line, and the picture holds its label past the line.

The take differs from its sheet in these places, and the captions follow the
recording:

- the spoken intro opens with an ad-lib, "Your colleague says:", so the intro
  now shows a colleague saying the line while the viewer's hero codes;
- verse 4 sings "Alt" but drops "Opt." and "Loop:"; the frames on screen still
  name all three;
- verses 5 and 6 drop their title lines, "State Machine Diagram:" and
  "Component Diagram:"; the section badges and sheet titles name them;
- the quiz drops "Pop quiz:" (the screen shows it) and the "refund" in question 4
  ("Cancel or a fee? Which diagram shows why?");
- **question 2's answer is never sung.** Suno goes straight from "Which
  diagram?" to question 3, so question 2 has no answer bar and no quiz pause,
  and the architect only thinks it over;
- sung, "that's asynchronous" sounds like "that's a synchronous"; the caption
  and the "open head: asynchronous" label say which.

To restore question 2's answer, use Suno's Song Editor on take 6: replace about
4:38–4:40 with the crowd singing "Sequence Diagram! See who waits on whom!", with
"Make Same Length as Section" off. Only the quiz from question 2 on then needs
re-aligning. (Take 7 sings that answer.) A later sheet can respell the
article-like "a" in "asynchronous" the way "Ay" fixed "A" in verse 3 ("that's
ay-synchronous").

### Lyric sheet, take 6

4,497 characters, under Suno's 5,000-character limit. Use the style prompt
in "Take 4's sound, to reproduce it".

```text
[Intro: spoken]
Just keep coding, we'll fix it later!
Week one: peer-to-peer. Week nine: we need a server.
That first choice is a load-bearing wall now.
This time, we draw it out first.

[Verse 1: half-time]
Ask for a building: four teammates see a tower, a mall, a factory, a museum.
Draw it clearly: all four see one house. Draw it vague: they're lost again.
So: U-M-L, the Unified Modeling Language, one notation for all of them.
A model leaves some details out on purpose:
it shows the part your question is about.
A flaw on paper? Rub it out, you're done.
A flaw in shipped code? Rework for everyone.
Hand the model to your team, your coding agent too,
then test what comes back against the plan you drew.

[Chorus: call and response]
Draw it out while it's cheap to change!
Which classes, how they relate?
CLASS DIAGRAM!
Who calls whom, in what order?
SEQUENCE DIAGRAM!
What state's it in, what event moves it on?
STATE MACHINE DIAGRAM!
What runs, how it plugs together?
COMPONENT DIAGRAM!
Ask your question, then draw it out!

[Verse 2: melodic, bouncy]
Class Diagram: the code view,
to plan and discuss it
with your team, then document
where the pieces go.
Will it change? Make it private,
hide it with a minus;
plus is just for what
the others need from us.
Is a Rectangle a Shape?
Then inherit: is-a.
An ih-TAL-ick name: abstract,
not built, just built upon.
Want to swap what's underneath?
Write an interface:
it says what, but never how,
so swap the class right now.

[Verse 3: beat switch]
Lines between the classes?
Ask three questions, in order.
Does Ay reference B?
Then: association.
Does Ay own B as a part?
Then: aggregation,
a car and its wheels,
a library and books.
Can B not exist without Ay?
Then: composition,
a house and its rooms:
delete the whole, they go.
Not sure it's a part?
Association's safe;
save the hollow diamond
for when the whole-part counts.

[Chorus]
Draw it out while it's cheap to change!
Which classes, how they relate?
CLASS DIAGRAM!
Who calls whom, in what order?
SEQUENCE DIAGRAM!
What state's it in, what event moves it on?
STATE MACHINE DIAGRAM!
What runs, how it plugs together?
COMPONENT DIAGRAM!

[Verse 4: melodic, steady groove]
Sequence Diagram: one run,
one scenario, in time,
to see who waits on whom
and where bottlenecks grow.
Need the answer to go on?
That's a synchronous call:
you wait right there until
the reply comes back.
No need to wait around?
Then send and carry on:
that's asynchronous,
the sender doesn't block.
Exactly one path? Alt.
Zero or one time? Opt.
Again while it's true? Loop:
if-else, if, and for.

[Verse 5: melodic, lighter]
State Machine Diagram:
when an object's response
depends on its state,
draw its life, state by state.
One run? Sequence Diagram.
Its whole life, every path?
The State Machine Diagram
tells the object's story.
Can each state be reached?
Can each state be left?
Trigger, guard, and action:
when, and if, and do.
Same trigger, different end?
The state it's in decides.
Reacts the same each time?
Skip the State Machine Diagram.

[Verse 6: build-up]
Component Diagram:
zoom out from the code
to the parts you deploy,
and how they connect.
Can you deploy it alone?
Then it's a component.
Just a class inside?
Keep it in the Class Diagram.
Provided: what it offers,
required: what it needs;
when need meets offer,
the pieces snap in place.
The interface: a contract,
what to ask, not how it works:
swap what's behind it,
the client code works still.

[Final Chorus: key change]
Draw it out while it's cheap to change!
Which classes, how they relate?
CLASS DIAGRAM!
Who calls whom, in what order?
SEQUENCE DIAGRAM!
What state's it in, what event moves it on?
STATE MACHINE DIAGRAM!
What runs, how it plugs together?
COMPONENT DIAGRAM!
Ask your question, then draw it out!

[Pop Quiz: call and response]
Pop quiz: a pizza app! Think, then shout it!
Your diagram skips the database. Mistake?
Not if your question doesn't need it!
Slow checkout: waiting on what?
Which diagram?
Sequence Diagram! See who waits on whom!
Customer gone, orders kept: filled diamond?
No! The orders outlive the customer!
Cancel: refund or a fee?
Which diagram shows why?
State Machine Diagram! The state decides!
The receipt email is slow. Which arrowhead?
Open head! Send it and carry on!
Where's the price, who can change it?
Which diagram?
Class Diagram!
Attributes, plus and minus!
New provider, same interface:
does the app change?
No! It only knows the interface!

[Outro]
Draw it out while it's cheap to change!
```

## Take 5: every line sized to one bar (not recorded)

### What the syllable counts explain in take 4

Take 4's verses settled into a fixed grid. Each sheet line gets about one bar
(median 4.1 beats, about 1.8 s at 134 BPM), and each rhyming pair of lines gets
about two bars between them. So a line's syllable count largely sets how fast it
is sung:

| Syllables in a verse line | Lines | Median pace | Lines sung at 4.6+ per second |
| --- | --- | --- | --- |
| 3–5 | 8 | 3.1 per second | 0 of 8 |
| 6 | 19 | 3.4 | 3 of 19 |
| 7 | 23 | 4.0 | 3 of 23 |
| 8 | 15 | 4.2 | 4 of 15 |
| 9 | 10 | 4.8 | 5 of 10 |
| 10 or more | 7 | 4.0 | 1 of 7 |

(Lines of 10 or more mostly sat next to a very short line and borrowed its bar.)
Every rushed line breaks this budget. "every Rectangle's a Shape" (8 syllables,
6.1 per second) shares two bars with the 9-syllable "hollow triangle to the
parent", 17 syllables for the pair. "client colon Client: the object" (9) and
"Available, Borrowed, Overdue." (9) each had to fit one bar. Pairs of up to about
14 syllables sang comfortably. The same budget explains two of the unclear
words. "parts you deploy and run on their own" (9) was squeezed into one bar
and heard as "walk to deploy". In the quiz, the 18-syllable "Press Cancel…" line
lost its last word ("why"), and the 14-syllable "New payment provider…" garbled
its opening.

Two problems have other causes. The "synchronous" / "asynchronous" swap came from
two near-identical words in parallel lines of one stanza, not from length. And
"Your colleague says" was Suno ad-libbing in the spoken intro.

### What take 5 changes

- **Every verse line has 5–7 syllables**, and every rhyming pair 14 or fewer. The
  exceptions are verse 6's interface lines (9 and 10 syllables), which pair with
  "what I offer" and "what I need" and sang cleanly, and the closing "skip the
  State Machine Diagram" (8), which needs the full name.
- **Long quiz questions are split** so "Which diagram?" gets its own line, and
  question 6's answer and question 7's question each take two lines.
- **Synchronous and asynchronous are kept apart**: four lines and a different
  sentence shape separate them, with the bottleneck pair in between.
- **Verse 5 is shorter (16 lines, about 100 syllables instead of 150) and about
  concepts rather than the library book.** It covers what the diagram is for,
  its notation, event / guard / action, that the current state decides what the
  same event does, and when to skip the diagram. The visuals can still show the
  library book.
- **A little more conceptual elsewhere**: verse 2 says what an abstract class and
  an interface are for ("no objects of its own", "says what, but never says
  how"); verse 3 states the ownership rule before its example ("What it owns goes
  with it, / what it points to stays"); verse 4 sums up the fragments as
  "if-else, if, and for"; verse 6 ends on substitution ("if the interface holds,
  / the client code works still").
- **Unchanged:** the intro, verse 1, the choruses, the outro, the respellings
  ("ih-TAL-ick", "Ay"), and the take 4 style prompt.

### Lyric sheet, take 5

4,555 characters, under Suno's 5,000-character limit. Use the style prompt in
"Take 4's sound, to reproduce it" below.

```text
[Intro: spoken]
Just keep coding, we'll fix it later!
Week one: peer-to-peer. Week nine: we need a server.
That first choice is a load-bearing wall now.
This time, we draw it out first.

[Verse 1: half-time]
Ask for a building: four teammates see a tower, a mall, a factory, a museum.
Draw it clearly: all four see one house. Draw it vague: they're lost again.
So: U-M-L, the Unified Modeling Language, one notation for all of them.
A model leaves some details out on purpose:
it shows the part your question is about.
A flaw on paper? Rub it out, you're done.
A flaw in shipped code? Rework for everyone.
Hand the model to your team, your coding agent too,
then test what comes back against the plan you drew.

[Chorus: call and response]
Draw it out while it's cheap to change!
Which classes, how they relate?
CLASS DIAGRAM!
Who calls whom, in what order?
SEQUENCE DIAGRAM!
What state's it in, what event moves it on?
STATE MACHINE DIAGRAM!
What runs, how it plugs together?
COMPONENT DIAGRAM!
Ask your question, then draw it out!

[Verse 2: melodic, bouncy]
Class Diagram: the code view,
one box for every class:
attributes, what it stores,
operations, what you ask.
Minus means private, hidden,
so it's free to change;
plus means public, used by all,
so its promise stays the same.
An ih-TAL-ick name: abstract,
no objects of its own;
hollow triangle: is-a,
a Rectangle is a Shape.
An interface says what,
but never says how;
dashed line, hollow triangle:
a class implements it now.

[Verse 3: beat switch]
Lines between the classes?
Ask three questions, in order.
Does Ay reference B?
Association: a line.
The arrow points at B.
Does Ay own B as a part?
Hollow diamond at the whole:
aggregation: car and wheels.
Does B die when Ay dies?
Filled diamond: composition.
Delete the whole,
its parts go too.
What it owns goes with it,
what it points to stays:
a list owns its entries,
the books stay on the shelf.

[Chorus]
Draw it out while it's cheap to change!
Which classes, how they relate?
CLASS DIAGRAM!
Who calls whom, in what order?
SEQUENCE DIAGRAM!
What state's it in, what event moves it on?
STATE MACHINE DIAGRAM!
What runs, how it plugs together?
COMPONENT DIAGRAM!

[Verse 4: melodic, steady groove]
Sequence Diagram: one run,
time flows from top to bottom.
client colon Client:
object first, then class,
above a dashed lifeline.
Filled head: the caller waits,
synchronous, until
the dashed reply comes back.
Who waits on whom, how long?
That's where bottlenecks grow.
Open head: asynchronous,
you send and carry on.
Alt: one or the other,
Opt: maybe, maybe not,
Loop: again and again:
if-else, if, and for.

[Verse 5: melodic, lighter]
State Machine Diagram:
the states an object takes;
a black dot marks the start,
each rounded box, a state.
Each arrow's a transition,
from one state to the next:
event, guard, and action,
when, and if, and do.
One event can lead
to different things to do:
the state it's in decides,
what it has been through.
Does it react the same,
no matter what came before?
Then save yourself the time:
skip the State Machine Diagram.

[Verse 6: build-up]
Component Diagram:
zoom out to the run-time view,
parts that run on their own:
client, server, database.
The ball's a provided interface:
what I offer.
The socket's a required interface:
what I need.
Ball in socket, they snap:
one needs, the other provides.
The interface: a contract,
what to ask, not how it works.
Hide the parts behind it,
swap them out at will;
if the interface holds,
the client code works still.

[Final Chorus: key change]
Draw it out while it's cheap to change!
Which classes, how they relate?
CLASS DIAGRAM!
Who calls whom, in what order?
SEQUENCE DIAGRAM!
What state's it in, what event moves it on?
STATE MACHINE DIAGRAM!
What runs, how it plugs together?
COMPONENT DIAGRAM!
Ask your question, then draw it out!

[Pop Quiz: call and response]
Pop quiz: a pizza app! Think, then shout it!
Your diagram skips the database. Mistake?
Not if your question doesn't need it!
Slow checkout: waiting on what?
Which diagram?
Sequence Diagram! See who waits on whom!
Customer gone, orders kept: filled diamond?
No! The orders outlive the customer!
Cancel: refund or a fee?
Which diagram shows why?
State Machine Diagram! The state decides!
The receipt email is slow. Which arrowhead?
Open head! Send it and carry on!
Where's the price, who can change it?
Which diagram?
Class Diagram!
Attributes, plus and minus!
New provider, same interface:
does the app change?
No! It only knows the interface!

[Outro]
Draw it out while it's cheap to change!
```

### Take 4's sound, to reproduce it

Take 4 ("Draw It Out First(3)") sounds right, so take 5 should match it. Suno
didn't follow every request in the take 4 prompt, so this section describes
what the recording actually does, measured from the audio. The mix balance comes
from separating the take into vocal, drum, bass, and other stems with Demucs;
pitch comes from two trackers (pYIN and YIN) run on the vocal stem.

| Feature | Take 4 |
| --- | --- |
| Tempo | About 134 BPM, steady. The prompt asked for about 96. |
| Key | B-flat major from start to end. The prompt's "key change for the final chorus" didn't happen. |
| Mix | Vocal-forward and drum-driven: vocals carry about 44% of the energy, drums 47%, bass and other instruments the rest. Bass and other instruments are faint from verse 3 on, so the arrangement is sparse. |
| Build | The drums' share grows through the song: 12% in the spoken intro, about 28% in verse 1 and the first chorus, about 40% in verses 2–5, 54% in verse 6, 49–63% in the final chorus, quiz, and outro. The overall level rises by about 10 dB from the intro to the final chorus. |
| Lead vocal | Low, relaxed register: about C3 to C5, centred on middle C (about 265 Hz), never above C5, so no belting. That range fits a low alto or a male voice; the prompt asked for a female lead, so confirm by ear and swap the word if needed. |
| Phrasing | One sheet line per bar; verses and choruses at 3.4–4.0 syllables per second. |
| Master | −14.3 LUFS integrated, loudness range 7.1 LU, true peak −2.5 dBFS. |

**Style of Music** (full, 937 characters):

```text
Upbeat pop rock, 134 BPM, 4/4, B-flat major throughout, feel-good and energetic with musical-theatre clarity. Punchy, driving drums carry the energy and build through the song: a light spoken intro, a steady groove in the verses, the fullest drums in the last verse, final chorus, and quiz. Sparse, uncluttered arrangement under a vocal-forward mix; the band stays out of the singer's way. Warm, friendly female lead in a low, relaxed register around middle C, conversational chest voice, crisp diction, never belting or straining. Every verse is sung as a melody, never rapped, chanted, or talked: one lyric line per bar, the second line of each rhyming pair ending on a held note. No shouting. Only the chorus has group vocals: a friendly group sings back each diagram name in full: Class Diagram, Sequence Diagram, State Machine Diagram, Component Diagram. Pop quiz: playful game-show call-and-response. Spoken intro, dry and deadpan.
```

**Style of Music** (short, 191 characters):

```text
upbeat pop rock, 134 BPM, B-flat major, punchy drums, sparse vocal-forward mix, warm low female vocal, clear diction, melodic verses, one line per bar, group sings chorus answers, no shouting
```

**Exclude Styles** (as for take 4):

```text
rap, hip hop, spoken word, talk-singing, patter, fast flow, double-time vocals, shouting, screaming, gang chant, funk, mumble, rushed vocals, heavy autotune, distorted vocals, lo-fi, EDM drop, ballad
```

**Reproducing it in Suno.** A prompt alone won't recreate a take exactly:
generation is random, and the voice is the hardest part to pin down. In order of
reliability:

1. **Make a Persona from take 4** (Suno's feature for reusing a song's voice and
   style, where your plan offers it) and generate take 5 with that Persona and
   the prompt above. This is the closest thing to the same singer and sound.
2. **Use the same model version and settings** as take 4 (Weirdness and Style
   Influence; earlier takes used about 30% and 70%).
3. **Pin what Suno chose.** The prompt now names 134 BPM and B-flat major, and
   drops the key change and the 96 BPM that take 4 ignored, so Suno has fewer
   reasons to wander.
4. **Generate several candidates** and keep the one closest to take 4. A quick
   check: tempo near 134, key B-flat major, and a lead that stays around middle C.

## Take 4: calm, melodic verses over an energetic band (recorded, not integrated)

Take 2 still rushes in verses 2, 4, and 5, and the alt / opt / loop lines are the
clearest case. Their syllable rate looked fine (4.7 per second), so the take 1
threshold missed them; what overloads students is how many new ideas arrive per
second. Measured from take 2's word timings:

| Passage in take 2 | New ideas | Time | Time per idea |
| --- | --- | --- | --- |
| Chorus: each question and its diagram | 1 per line | 2.9–4.6 s | 2.9–4.6 s |
| Verse 3: association, aggregation, composition | 3 | 15.8 s | 5.3 s |
| Verse 2: minus, plus, italic, hollow triangle | 4 | 10.5 s | 2.6 s |
| Verse 4: alt, opt, loop, each with its code twin | 3 | 5.9 s | 2.0 s |
| Verse 5: return from Borrowed, return from Overdue | 2 | 3.5 s | 1.8 s |

Students follow the chorus and verse 3 easily, so the target is about 4 s per new
piece of notation, a planning estimate drawn from this song rather than a research
constant.

### How take 3 came out

Take 3 (not downloaded or measured) tried the chorus's call-and-response in the
verses: a short lead line, then a gang shout of its meaning in ALL CAPS. By ear it
was no slower, and the many shouts felt unsettling, so take 4 drops them.

### Why take 4 should be slower

In take 2, the calm sections sit at about 2.1–2.35 syllables per beat (chorus,
verse 3, quiz), roughly a melody in eighth notes. The rushed verses average 2.85
and peak near 4 on their densest lines, which is a rap-like sixteenth-note flow.
What separates the two is the shape of the lyric, not the tempo: the calm sections
are short, regular, rhyming lines; the rushed verses read like prose, and Suno
raps prose. Splitting prose into shorter lines (take 2) and adding shouts (take 3)
didn't change that.

Take 4 rewrites verses 2, 4, and 5 as song lines: 4–10 syllables, one idea per
line, four-line stanzas with rhyming pairs, no shouts. Images replace terse labels
where they carry the meaning better: "Alt: one or the other, / that's if-else in
your code. / Opt: maybe, maybe not, / that's just an if alone. / Loop: again and
again, / till the guard says no." The state machine mnemonic becomes a sung line,
"event, guard, and action, / when, and if, and do." The verses keep every concept
and the full diagram names. A few details move to the visuals, which already show
them (the "for each book" example, the slash before the action). Verses 1, 3, and
6, the choruses, and the quiz are as in take 2, apart from the letter A in
verse 3.

The style prompt moves from funk-pop, whose syncopated phrasing invites busy
vocals, to pop rock with musical-theatre energy. It puts the energy in the band,
asks for every verse to be sung as a melody with a held note at the end of each
rhyming pair, says "no shouting", and keeps group vocals to the chorus. It does
not rely on a BPM number: take 2 ignored the 92 BPM request.

Expect the song to run longer than take 2's 4:52, perhaps 5½ minutes, because
the same content is sung more slowly. If that is too long, the easiest cuts are
verse 4's bottleneck pair and verse 5's "Reacts the same…" pair.

**Two pronunciation fixes, in the Suno sheet only.** The storyboard and captions
keep the normal spelling.

- **"italic"** opens a crammed line in take 2 and gets about a third of a
  second; Whisper hears "It alec". Take 4 starts a calm line with it, puts "An"
  in front so the stressed syllable lands on the beat, and spells it
  "ih-TAL-ick". If it still comes out wrong, try "it-TAL-ick".
- **The letter A** is sung like the article "a" ("uh"). Take 4 writes it "Ay",
  which the CMU pronouncing dictionary reads as the letter name ("aye" would
  become "eye"). B already sounds right.

**In Suno.** Paste the sheet and the style prompt, generate several candidates,
and keep one where verses 2, 4, and 5 sound as relaxed as the chorus. To patch
take 2 instead, replace Verse 2 (1:06–1:34), Verse 3 (1:34–2:03), Verse 4
(2:21–2:44), and Verse 5 (2:44–3:13) in the Song Editor with the take 4 verses.
A third-party guide describes a "Make Same Length as Section" toggle; turned off,
it lets the slower verses run longer. Check that it exists in your version.
Either way, the storyboard needs re-aligning from the first changed verse.

### How take 4 came out

Take 4 ("Draw It Out First(3)", 5:39) is slower where it needed to be. Measured
from Whisper word timings aligned to the sheet (syllables per second while
singing):

| Section | Take 2 | Take 4 |
| --- | --- | --- |
| Verse 2: classes | 4.8 | 4.0 |
| Verse 3: relationships | 3.9 | 4.0 |
| Verse 4: Sequence Diagram | 4.7 | 3.9 |
| Verse 5: State Machine Diagram | 4.8 | 3.8 |
| Verse 6: Component Diagram | 4.3 | 3.7 |
| Choruses | 3.5–3.9 | 3.4–3.9 |

The verses now sit in the chorus's range. Alt, opt, and loop get 3.3 s each
(2.0 s in take 2), verse 2's four symbols 3.6 s each (2.6 s), and the two
"Return" transitions 3.2 s each (1.8 s). Suno again ignored the tempo request
and played at about 134 BPM; with melodic lines the singing still slowed.

Checked with short, unprompted Whisper passes:

- **"italic"** is now heard as "italic".
- **The letter A** in verse 3 lasts 0.22–0.34 s, against 0.08 s for the article
  "a" in "a plain line", so it is most likely sung as the letter name. Confirm
  by ear.
- **Content error at about 2:39:** both passes hear "Solid line, filled head:
  *a*synchronous", the word that belongs to the open head two lines later. A
  filled head is synchronous, so this line needs a Song Editor replace (same
  length) before the take is used.
- **Unclear in the quiz:** question 7's "New payment provider" (about 5:20, heard
  as "Who painted, provided") and question 6's answer "plus and minus" (about
  5:18, heard as "plus and line it"). Listen to both.
- **Added by Suno:** the spoken intro opens "Your colleague says, just keep
  coding…". Captions would follow the recording.
- **Minor:** "that's the start" is heard as "that's the star", and "parts you
  deploy" as "walk to deploy".

### Lyric sheet, take 4

4,988 characters, under Suno's 5,000-character limit. Lines in ALL CAPS
appear only in the chorus, as before. The outro sings the hook once more, as
take 2 did on its own.

```text
[Intro: spoken]
Just keep coding, we'll fix it later!
Week one: peer-to-peer. Week nine: we need a server.
That first choice is a load-bearing wall now.
This time, we draw it out first.

[Verse 1: half-time]
Ask for a building: four teammates see a tower, a mall, a factory, a museum.
Draw it clearly: all four see one house. Draw it vague: they're lost again.
So: U-M-L, the Unified Modeling Language, one notation for all of them.
A model leaves some details out on purpose:
it shows the part your question is about.
A flaw on paper? Rub it out, you're done.
A flaw in shipped code? Rework for everyone.
Hand the model to your team, your coding agent too,
then test what comes back against the plan you drew.

[Chorus: call and response]
Draw it out while it's cheap to change!
Which classes, how they relate?
CLASS DIAGRAM!
Who calls whom, in what order?
SEQUENCE DIAGRAM!
What state's it in, what event moves it on?
STATE MACHINE DIAGRAM!
What runs, how it plugs together?
COMPONENT DIAGRAM!
Ask your question, then draw it out!

[Verse 2: melodic, bouncy]
A Class Diagram's the code view,
one box for every class:
attributes, what it stores,
operations, what you ask.
Minus means private, hidden,
so it's free to change;
plus means public, others call it,
so its promise stays the same.
An ih-TAL-ick name: abstract,
you can't make a plain Shape;
hollow triangle to the parent:
every Rectangle's a Shape.
BookStore's an interface:
what to do, but never how.
Dashed line, hollow triangle:
two stores implement it now.

[Verse 3: beat switch]
Lines between classes? Ask three questions, in order.
Does Ay reference B?
Association: a plain line,
the arrow points at B.
Does Ay own B as a part?
Hollow diamond at the whole:
aggregation, a car and its wheels.
Can B not exist without Ay?
Filled diamond: composition.
Delete the whole, its parts go too.
A reading list and its entries: filled diamond.
Each entry points to a book.
Delete the list, the entries go.
The books stay on the shelf.

[Chorus]
Draw it out while it's cheap to change!
Which classes, how they relate?
CLASS DIAGRAM!
Who calls whom, in what order?
SEQUENCE DIAGRAM!
What state's it in, what event moves it on?
STATE MACHINE DIAGRAM!
What runs, how it plugs together?
COMPONENT DIAGRAM!

[Verse 4: melodic, steady groove]
Sequence Diagram: one run,
read from top to bottom, in time.
client colon Client: the object,
then its class, on a dashed lifeline.
Solid line, filled head: synchronous,
you wait for the dashed reply;
open head: asynchronous,
you send and carry on.
Alt: one or the other,
that's if-else in your code.
Opt: maybe, maybe not,
that's just an if alone.
Loop: again and again,
till the guard says no.
Who waits on whom, and how long?
That's where bottlenecks grow.

[Verse 5: melodic, lighter]
State Machine Diagram:
one object through its states.
Black dot: that's the start;
rounded boxes are the states:
Available, Borrowed, Overdue.
Every arrow's a transition:
event, guard, and action,
when, and if, and do.
Borrow, slash, set the due date:
now it's Borrowed.
A day goes by: is it past due?
If yes, Overdue; if not, it stays.
Return it while it's Borrowed:
Available again.
Return it when it's Overdue:
Available, plus a fee.
Same event, different action:
the state decides.
Reacts the same, whatever came before?
Then skip the State Machine Diagram.

[Verse 6: build-up]
Component Diagram:
zoom out to the run-time view,
parts you deploy and run on their own,
not classes: client, server, database too.
The ball's a provided interface:
what I offer.
The socket's a required interface:
what I need.
Ball in socket, they snap:
the client needs it, the server provides.
An interface is a contract:
what you can ask, not how it works inside.
Get book, add book: all the client sees.
The database? Out of sight:
swap it behind the interface,
and the client code's still right.

[Final Chorus: key change]
Draw it out while it's cheap to change!
Which classes, how they relate?
CLASS DIAGRAM!
Who calls whom, in what order?
SEQUENCE DIAGRAM!
What state's it in, what event moves it on?
STATE MACHINE DIAGRAM!
What runs, how it plugs together?
COMPONENT DIAGRAM!
Ask your question, then draw it out!

[Pop Quiz: call and response]
Pop quiz: a pizza app! Think, then shout it!
Your diagram skips the database. Mistake?
Not if your question doesn't need it!
Checkout takes ten seconds. What's it waiting for? Which diagram?
Sequence Diagram! See who waits on whom!
Delete a customer, but keep their orders. Filled diamond?
No! The orders outlive the customer!
Press Cancel: sometimes a refund, sometimes a fee. Which diagram shows why?
State Machine Diagram! The state decides!
The receipt email is slow. Which arrowhead?
Open head! Send it and carry on!
Where does the price live, and who may change it? Which diagram?
Class Diagram! Attributes, plus and minus!
New payment provider, same interface: does the app change?
No! It only knows the interface!

[Outro]
Draw it out while it's cheap to change!
```

### Suno style prompt, take 4

**Style of Music** (full, 962 characters):

```text
Upbeat pop rock anthem, about 96 BPM, 4/4, major key, feel-good and energetic, like a high-energy musical-theatre number: driving drums, bright electric guitars, bass, piano, handclaps. The band carries the energy; the vocal stays smooth and unhurried. Warm, friendly female lead with clear diction. Every verse is sung as a melody, never rapped, chanted, or talked: each lyric line is one relaxed melodic phrase, and the second line of each rhyming pair ends on a held note. No shouting. The only group vocals are in the chorus, where a friendly group sings back each diagram name in full: Class Diagram, Sequence Diagram, State Machine Diagram, Component Diagram. Section variety: muted-guitar verse 1, bouncy verse 2, a beat switch in verse 3, a steady groove in verse 4, a lighter verse 5, a rising build in verse 6, a key change for the final chorus. Pop quiz: playful game-show call-and-response, the group sings each answer. Spoken intro, dry and deadpan.
```

**Style of Music** (short, 188 characters):

```text
upbeat pop rock, musical-theatre energy, bright guitars, handclaps, warm female vocal, clear diction, smooth melodic verses, held notes, group sings chorus answers, key change, no shouting
```

**Exclude Styles:**

```text
rap, hip hop, spoken word, talk-singing, patter, fast flow, double-time vocals, shouting, screaming, gang chant, funk, mumble, rushed vocals, heavy autotune, distorted vocals, lo-fi, EDM drop, ballad
```

## Lyric sheet, take 2 (recorded)

4,956 characters, under Suno's 5,000-character limit. Quotation marks are
left out because Suno doesn't sing them. Each chorus answer sits on its own line,
so the gang vocals get a phrase of their own.

```text
[Intro: spoken]
Just keep coding, we'll fix it later!
Week one: peer-to-peer. Week nine: we need a server.
That first choice is a load-bearing wall now.
This time, we draw it out first.

[Verse 1: half-time]
Ask for a building: four teammates see a tower, a mall, a factory, a museum.
Draw it clearly: all four see one house. Draw it vague: they're lost again.
So: U-M-L, the Unified Modeling Language, one notation for all of them.
A model leaves some details out on purpose:
it shows the part your question is about.
A flaw on paper? Rub it out, you're done.
A flaw in shipped code? Rework for everyone.
Hand the model to your team, your coding agent too,
then test what comes back against the plan you drew.

[Chorus: call and response]
Draw it out while it's cheap to change!
Which classes, how they relate?
CLASS DIAGRAM!
Who calls whom, in what order?
SEQUENCE DIAGRAM!
What state's it in, what event moves it on?
STATE MACHINE DIAGRAM!
What runs, how it plugs together?
COMPONENT DIAGRAM!
Ask your question, then draw it out!

[Verse 2: bouncy]
Class Diagram, the code view: one box for every class,
its name, the attributes it stores, the operations you can ask.
Minus means private: hidden,
so it's free to change.
Plus means public: others call it,
so its promise stays the same.
Italic name means abstract:
you can't make a plain Shape.
Hollow triangle points to the parent:
every Rectangle is a Shape.
BookStore's an interface:
operations only, a contract to fulfill.
Dashed line, hollow triangle: implements.
SQL store or memory store: either will.

[Verse 3: beat switch]
Lines between classes? Ask three questions, in order.
Does A reference B?
Association: a plain line,
the arrow points at B.
Does A own B as a part?
Hollow diamond at the whole:
aggregation, a car and its wheels.
Can B not exist without A?
Filled diamond: composition.
Delete the whole, its parts go too.
A reading list and its entries: filled diamond.
Each entry points to a book.
Delete the list, the entries go.
The books stay on the shelf.

[Chorus]
Draw it out while it's cheap to change!
Which classes, how they relate?
CLASS DIAGRAM!
Who calls whom, in what order?
SEQUENCE DIAGRAM!
What state's it in, what event moves it on?
STATE MACHINE DIAGRAM!
What runs, how it plugs together?
COMPONENT DIAGRAM!

[Verse 4: groove]
Sequence Diagram: one example run,
top to bottom, in time.
client colon Client:
the object, then its class,
over a dashed lifeline.
Solid line, filled head: synchronous.
The caller waits till it's done,
till the dashed reply comes back.
Open head: asynchronous.
It sends and carries on.
Alt is if-else: one branch runs. Opt is if: once or none.
Loop repeats while its guard is true: for each book, till we're done.
Who waits on whom? That's where bottlenecks hide.

[Verse 5: half-time]
State Machine Diagram:
one object and the states it moves through.
Black dot: the start.
Rounded boxes are states:
Available, Borrowed, Overdue.
Each arrow's a transition.
Event: when! Guard: if! Slash, action: do!
Borrow, slash, set the due date:
now it's Borrowed.
A day passes: is the due date past?
If yes, Overdue. If no, it holds fast.
Return from Borrowed: Available.
Return from Overdue:
Available, plus a fee.
Same event, different action:
the state decides. That's the key.
Reacts the same, whatever came before?
Then skip the State Machine Diagram.

[Verse 6: build-up]
Component Diagram:
zoom out to the run-time view,
parts you deploy and run on their own,
not classes: client, server, database too.
The ball's a provided interface:
what I offer.
The socket's a required interface:
what I need.
Ball in socket, they snap:
the client needs it, the server provides.
An interface is a contract:
what you can ask, not how it works inside.
Get book, add book: all the client sees.
The database? Out of sight:
swap it behind the interface,
and the client code's still right.

[Final Chorus: key change]
Draw it out while it's cheap to change!
Which classes, how they relate?
CLASS DIAGRAM!
Who calls whom, in what order?
SEQUENCE DIAGRAM!
What state's it in, what event moves it on?
STATE MACHINE DIAGRAM!
What runs, how it plugs together?
COMPONENT DIAGRAM!
Ask your question, then draw it out!

[Pop Quiz: call and response]
Pop quiz: a pizza app! Think, then shout it!
Your diagram skips the database. Mistake?
Not if your question doesn't need it!
Checkout takes ten seconds. What's it waiting for? Which diagram?
Sequence Diagram! See who waits on whom!
Delete a customer, but keep their orders. Filled diamond?
No! The orders outlive the customer!
Press Cancel: sometimes a refund, sometimes a fee. Which diagram shows why?
State Machine Diagram! The state decides!
The receipt email is slow. Which arrowhead?
Open head! Send it and carry on!
Where does the price live, and who may change it? Which diagram?
Class Diagram! Attributes, plus and minus!
New payment provider, same interface: does the app change?
No! It only knows the interface!
```

### Suno style prompt

**Style of Music** (full, 998 characters):

```text
Upbeat funk-pop anthem, 92 BPM, 4/4, major key, playful. Warm female lead vocal, crisp diction. The verses are sung, relaxed and unhurried, at a calm speaking pace: one short phrase per lyric line, then a breath before the next line. Never rushed or crammed; every technical word stays clear. Big melodic chorus hook, call-and-response: the lead sings each question, then gang vocals shout the answer on the downbeat, each diagram name sung in full: CLASS DIAGRAM, SEQUENCE DIAGRAM, STATE MACHINE DIAGRAM, COMPONENT DIAGRAM. Vary the feel, never the vocal speed: half-time verse 1 with muted guitar, bouncy slap-bass verse 2, a beat switch in verse 3, a steady groove in verse 4, a half-time verse 5 with the gang chant Event, when! Guard, if! Action, do!, a rising build in verse 6, a key change up for the final chorus. Pop quiz: game-show call-and-response, a drum fill after each question, then the crowd shouts the answer. Spoken intro, dry and deadpan. Brass stabs, handclaps, vocals upfront.
```

**Style of Music** (short, 199 characters):

```text
upbeat funk-pop, 92 BPM, female vocal, crisp diction, unhurried sung verses, breath after each line, call-and-response chorus, gang vocals shout diagram names, beat switch, key change, game-show quiz
```

**Exclude Styles:**

```text
fast rap, double-time flow, chopper rap, rushed vocals, mumble rap, slurred vocals, heavy autotune, distorted vocals, screaming, heavy reverb, lo-fi muffled vocals, EDM drop, trap hi-hat rolls, ballad
```

The genre and the female lead are starting points, chosen so this song sounds
different from the pop-punk INVEST song; swap them freely. Take 1 used low
Weirdness (about 30%) and high Style Influence (about 70%). Generate several takes
and keep one where every chorus sings all four diagram names in full and no verse
line sounds crammed; fix a dropped name or a rushed line with Suno's section
replace before alignment.

**If the verses still rush.** Shorter lines are the main lever, since Suno ignores
pause and break tags. If a take still crams two short lines into one phrase, try
85–88 BPM, or put a short backing echo of the key term in parentheses after the
line, for example "(composition)": Suno sings parenthesized lines as quiet backing
vocals, and the echo fills the gap with the term instead of new content.

**If the diagram names get dropped.** The chorus asks first and answers second, so
students retrieve the name before they hear it. On the INVEST takes, Suno dropped
shouted terms that followed another shout, and opening each line with the term
fixed it. If two takes in a row drop a name, flip each pair to put the name first
("CLASS DIAGRAM! Which classes, how they relate?").

**Quiz pauses.** Suno ignored per-question break tags and pause requests on the
INVEST takes and on take 1, so expect each answer to follow its question straight
away. The player's quiz pause stops right after each question (`pause_at`), as in
the other songs, and that gives students their thinking time.

### Pronunciation and performance notes

| Written | Sung as | Note |
| --- | --- | --- |
| U-M-L | "you-em-el" | Spelled out once, then expanded to Unified Modeling Language. |
| italic (take 4 sheet: ih-TAL-ick) | "ih-TAL-ik" | Stress on the second syllable. Take 2 squeezed it into a third of a second ("It alec"). |
| A (take 4 sheet: Ay) | "ay", the letter name | Written plainly, Suno sings it as the article "uh". |
| SQL store | "sequel store" or "S-Q-L store" | Either is fine. |
| client colon Client | "client colon client" | The lifeline label `client: Client`: the object's name, then its class. |
| slash | "slash" | The `/` before a transition's action, as in `borrow / set due date`. Captions can show the symbol. |
| if-else | "if else" | |
| Alt, Opt | "alt", "opt" | Fragment operators, one syllable each, not spelled out. |
| Event: when! Guard: if! Slash, action: do! | A gang chant on the beat | The lecture's mnemonic from the state machine slide. |
| CLASS DIAGRAM! (and the other three) | Shouted in full | Gang vocals, on the downbeat after each question. |
| API | "A-P-I" | |

## Quiz audit

Take 1's quiz mostly checked recognition. Questions 1–3 could be answered by
matching cue words to the song ("placed, baking…" to states, "asks… replies" to
the chorus's "who calls whom", "offers… needs" to verse 6's "I offer… I need").
Question 4 handed over the notation and copied the reading list's structure,
question 5 asked students to recall what one arrowhead means, and question 6
turned on whether "due today" counts as past due, a reading of `>` that a student
can miss while understanding guards perfectly. Only question 7 asked students to
reason from a concept.

The take 2 quiz keeps question 7 and replaces the rest. Every question is about a
pizza app, a system the verses never mention, so students transfer rather than
recall. Three questions ask which diagram answers a developer's question, worded
so that no chorus keyword gives it away; four ask what a model or an element
means for the design. The questions alternate between those two kinds and never
put two questions about the same diagram next to each other.

| # | Question | Answer | What it checks | The tempting wrong answer |
| --- | --- | --- | --- | --- |
| 1 | Your diagram skips the database. Mistake? | Not if your question doesn't need it | A model is an abstraction for one question (`uml.md`, "Models are rarely complete"; verse 1). | "Yes: a model must show everything." "Yes, if the question is about storage" is also right. |
| 2 | Checkout takes ten seconds. What's it waiting for? Which diagram? | Sequence Diagram: see who waits on whom | Choosing by the question: waiting comes from synchronous calls, and a Sequence Diagram puts them in order (verse 4's bottleneck line). | Component Diagram ("which part is slow?"), which shows the parts, not who waits for whom. |
| 3 | Delete a customer, but keep their orders. Filled diamond? | No: the orders outlive the customer | Composition means one owner whose parts are deleted with it (Class Diagram chapter, common mistake 4). Orders kept on file are not such parts. | "Yes: a customer has orders." Having is not owning. "Hollow diamond" is closer, but a customer is not a whole made of orders, so a plain association fits best. |
| 4 | Press Cancel: sometimes a refund, sometimes a fee. Which diagram shows why? | State Machine Diagram: the state decides | When to draw one: the same event gets a different response depending on what happened before. It is verse 5's "Reacts the same… skip it" turned around (State Machine Diagram chapter, common mistake 5). | Sequence Diagram, which shows one run's calls, not why the same button behaves differently. "A guard decides" is partly right; ask what the guard would check: whether baking has started, which is the order's state. |
| 5 | The receipt email is slow. Which arrowhead? | Open head: send it and carry on | From a design need to notation: checkout does not need the email's result, so it should not wait, which makes it an asynchronous message with an open arrowhead (Sequence Diagram chapter). | Filled head: making checkout wait on a slow email it never needed. |
| 6 | Where does the price live, and who may change it? Which diagram? | Class Diagram: attributes, plus and minus | What a Class Diagram is for: which class stores what (attributes) and who may touch it (visibility). | Component Diagram, which shows running parts and interfaces, not fields or visibility. |
| 7 | New payment provider, same interface: does the app change? | No: it only knows the interface | An interface is a contract, so what sits behind it can change (verse 6). It holds only because the interface stays the same. | "Yes: new provider, new code." Asking next what happens when the interface itself changes ("Yes: the contract changed") makes a good follow-up in class. |

If you would rather keep a guard question and the library book from verse 5, use
this in place of question 4: "A day passes, but the guard is false. Does the book
go Overdue?" / "No! A false guard means no transition!" (State Machine Diagram
chapter: a guard must be true for the transition to occur).

## How each section matches the sources

| Lyric | Source |
| --- | --- |
| Intro: "Just keep coding, we'll fix it later!… a load-bearing wall" | L7 slide 4: early decisions become load-bearing walls, and a peer-to-peer design is hard to turn into client-server. |
| V1: four teammates, four buildings; a clear versus a vague drawing; UML | L7 slides 5–7; `uml.md`, "Why Model?" (communication). |
| V1: "A model leaves some details out on purpose" | `uml.md`, "What Is a Model?" and "Models are rarely complete". |
| V1: "A flaw on paper? Rub it out" | `uml.md`, early problem detection. Kept qualitative, because the chapter calls the 10–100× figures debated. |
| V1: "Hand the model to your team and your coding agent… then test" | L7 slide 8: a shared design that people and an AI implementation work from, followed by testing and feedback. |
| Chorus | L7 slides 9 and 31 (views); the Component Diagram chapter's "Question You Are Answering" table; `uml.md`, "Purpose first". |
| V2: class box, visibility, abstract class, generalization, interface, realization | L7 slides 10 and 29; Class Diagram chapter §§2.1–2.3, abstract classes, generalization, interface realization. |
| V3: three questions; association, aggregation, composition | L7 slides 14–16; Class Diagram chapter: navigability, aggregation, composition. |
| V4: lifelines, synchronous calls, replies, asynchronous messages, alt / opt / loop, bottlenecks | L7 slides 18, 20–24, and 31; Sequence Diagram chapter, Parts 1, 2, and 4. |
| V5: states, transitions, event / guard / action, the library book, when not to use one | L7 slides 25–26; State Machine Diagram chapter §§2.1–2.2 and common mistake 5. |
| V6: components, provided and required interfaces, contracts, swapping the database | L7 slides 27, 28, and 30; Component Diagram chapter §§2.1–2.2 and §4, and its rule of thumb. |

Left out on purpose, to keep the load manageable: multiplicities, dependency
arrows, non-navigable ends, found messages, activation bars, entry and exit
actions, ports, and the rule that sequence messages must match class operations.
The chapters and their quizzes cover each of them.

Two spots in the L7 slides differ from the song and the chapters. Slides 25–26
write a transition as `[guard] trigger / action`, while UML and the State Machine
Diagram chapter write `event [guard] / effect`. Slides 13–15 label the
hollow-diamond line from Shape to Color "Association", while slide 16's three
questions make a hollow diamond aggregation. The song follows the chapters.

## Where the integrated song lives

- **Words and timing:** `_data/songs/draw_it_out.yml` holds the words, word marks,
  quiz `answer_at` and `pause_at`, and the beat map, aligned from Whisper word
  timestamps with short clip passes around each line.
- **Scenes:** `js/song-video/songs/draw_it_out.js` choreographs them. The UML
  notation is ArchUML output (`js/song-video/model-kit.js`), the pictures beside it
  come from `js/song-video/sketch-kit.js`, and the blueprint backdrop from
  `js/song-video/drafting-room.js`.
- **Captions and described audio:** `node scripts/song-video/render.js draw_it_out`
  regenerates them.
