# Draw It Out While It’s Cheap to Change: rewritten lyrics

New lyrics for the UML song on `SEBook/uml.md`. **Status: take 2 recorded and
integrated.** The take 2 sheet below is what Suno sang for the song on the
chapter page; `_data/songs/draw_it_out.yml` holds the words as sung, with their
timing. Where the sheet splits a sentence across short lines to slow the
singing, the storyboard keeps the sentence as one line, so each caption is a
whole sentence. Take 2 differs from its sheet in these places, and the captions
follow the recording:

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
