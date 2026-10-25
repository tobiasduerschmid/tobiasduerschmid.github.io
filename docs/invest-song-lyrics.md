# Invest in Your Stories: rewritten lyrics

New lyrics for the user stories and INVEST song on `SEBook/userstories.md`.
**Status: recorded and integrated.** The Suno take of the sheet below (generated
with the refined style prompt) is the song on the chapter page. From now on
`_data/songs/invest_in_your_stories.yml` is the source of truth for the sung words.
Its header lists where the recording differs from this sheet: for example, the
pre-chorus drops the "who? / what? / why?" interjections, and the first roll call
is "I! N! I! N! V! E! S! T!". All six chorus keywords are sung this time.

What changed from the current take:

- The verses explain **why user stories exist**: one need on a card, a ticket to
  talk, a specific role, a real "so that", and acceptance criteria that are
  testable without choosing the implementation.
- Each chorus line opens with its keyword as a shout ("INDEPENDENT!") and then
  states the chapter's definition, not a slogan: no overlap or order dependency;
  the need, not the design; benefit beyond the devs; scope clear enough to size;
  one sprint and the smallest valuable slice; criteria with a clear pass or fail.
  The letters live in the roll call ("I! N! V! E! S! T!"). Two takes mangled the
  letter-then-term pickups ("S! Small" was never sung), so the term now comes first.
- Section tags carry musical directions (half-time verse 1, beat switch in verse 2,
  double-time verse 3, a stripped breakdown for Given / When / Then, a key change
  for the final chorus) so the song varies from section to section.
- New examples cover different everyday situations (rideshare, games, food
  delivery, grading, social media, laundry), and none repeats a worked example from
  the chapter. One story runs through the song: the laundry story in the
  pre-chorus comes back as the Given / When / Then example.
- The pop quiz has been rebuilt so that each story breaks **only** the letter
  called, and one story passes all six. See the audit below.

## Lyric sheet (Suno-ready)

Under Suno's 5,000-character limit. Quotation marks are left out because Suno
doesn't sing them; captions get proper punctuation when the take is aligned.

```text
[Intro: spoken]
It's demo day.
Your app works perfectly. Every test is green.
And the user says: Cool… but that's not what I needed.
Green tests prove we built it right — not that we built the right thing.
So before we write a single line, let's find out what to build.

[Verse 1: half-time, sing-rap]
Before you ask how, ask who, what, and why,
and look at the app through your users' eyes.
One need on a card, in their own plain words —
a ticket to talk, so the why gets heard.
As a user? Too blurry — name exactly who:
the rider and the driver don't want the same view.
I want is the need; so that is the real why —
not the same feature in a fresh disguise.
ACCEPTANCE CRITERIA spell out when it's done:
clear enough to test, but they don't choose the code you run.

[Pre-Chorus: build-up]
As a — who? — student in the dorms,
I want — what? — a ping when my wash is done,
so that — why? — my wet clothes don't get dumped by someone.
Is it a good story? Check it with INVEST!

[Chorus: drop, gang vocals]
INDEPENDENT! No overlap, no waiting — any order!
NEGOTIABLE! The need, not the design — talk it over!
VALUABLE! Not just devs — users or customers gain!
ESTIMABLE! Scope's clear, so we can size what it takes!
SMALL! Fits one sprint — the smallest valuable slice there is!
TESTABLE! Criteria say pass or fail — no -ish!
I! N! V! E! S! T!
Invest in your stories — they pay you back with interest!

[Verse 2: beat switch]
I for INDEPENDENT: no story has to come first,
and no two cards promise the same thing — overlap's worse.
Split by layers? Build the screen, then save the data?
Neither works alone; they just wait on each other.
Slice it like a cake: one slice through every layer.
Still a link? Write it down, so it's no surprise later.
N for NEGOTIABLE: a promise to talk,
not a contract, not a blueprint on lock.
I want my high scores saved in Firebase?
That's a how! The need: they're still there next time I play.
Name the need; the team picks the tools to get there.
A must-use tool? That's a constraint — note it elsewhere.
V for VALUABLE: if we cut it, who'd complain?
If only devs would notice, find the users' gain.
Track my order — but the only check is the page loads?
So when's my food here? Still nobody knows.
Criteria set the scope — so they must reach the goal:
Then I see the minutes till it's here. Now the story's whole.

[Chorus: chant]
I! N! V! E! S! T!
Invest in your stories — they pay you back with interest!

[Verse 3: double-time]
E for ESTIMABLE: we can size it, rough but fair —
domain, tech, and scope: no fog in there.
Curve the grades? Which curve — add points, or a bell?
We can't size it yet — go ask; the prof can tell.
New tech nobody's used? Run a spike, time-boxed tight —
two days to learn, then we size the real story right.
S for SMALL: it fits in a single sprint,
the smallest slice that still gives users a win.
I want to post pics, and edit my bio, and DM my fans?
Three stories in a trench coat — split 'em at the ands!
But don't cut crumbs: edit just my bio's first line?
If the card takes longer than the code — combine!
T for TESTABLE: the criteria decide when it's done —
objective pass or fail, before the code's begun.
Fast? Smooth? Easy? Tests can't check a vibe —
name a number, a state you can verify.

[Breakdown: drums out]
GIVEN — my wash is running,
WHEN — the cycle ends,
THEN — my phone pings within a minute.
Pass or fail — now we know it's done!

[Final Chorus: key change up]
INDEPENDENT! No overlap, no waiting — any order!
NEGOTIABLE! The need, not the design — talk it over!
VALUABLE! Not just devs — users or customers gain!
ESTIMABLE! Scope's clear, so we can size what it takes!
SMALL! Fits one sprint — the smallest valuable slice there is!
TESTABLE! Criteria say pass or fail — no -ish!
I! N! V! E! S! T!
Invest in your stories — they pay you back with interest!

[Spoken]
Pop quiz! The criteria say just what each card says.
Which letter breaks — or does it pass?

[Call and Response]
As a student, I want my route to class found with Dijkstra's algorithm.
N! That's a how!
As a developer, I want ninety percent test coverage on the cart code.
V! Only devs win!
As a renter, I want to view my lease, report a repair, and message my landlord.
S! Three stories — split 'em!
As a rider, I want to rate my driver — but nobody can book a ride yet.
I! It's waiting on booking!
As a club president, I want our sign-up page to look aesthetic, so more people join.
T! Define aesthetic!
As a coach, I want each player's readiness score — only the coach knows the formula.
E! Go ask the coach!
As a student, I want to mute my group chat for an hour, so I can study in peace.
None! Good to go!

[Bridge: half-time]
Build ride booking first — now rate my driver's independent too:
INVEST's a lens, not a checklist; the context changes what's true.

[Outro: spoken]
One last thing: uptime, scale, safety rules? Those need other kinds of specs.
But for features users feel: INVEST, so your team builds the right thing.
```

### Suno style prompt

Refined for more weight on the core concepts, more energy, and more variation
between sections, on top of the alt-pop / pop-punk direction used for the
current take.

**Style of Music** (full, 975 characters):

```text
High-energy alt-pop / pop-punk anthem, 104 BPM, 4/4, major key, with big contrast between sections. Young male lead vocal, warm and a little cocky, crisp diction and unhurried phrasing so every word stays clear. The core concepts lead: each chorus line opens with its keyword shouted on the downbeat (INDEPENDENT, NEGOTIABLE, VALUABLE, ESTIMABLE, SMALL, TESTABLE), sung in full and never dropped, chanted, or stuttered, then its definition on a catchy melody, with gang vocals doubling the keyword. Variation: half-time verses with palm-muted guitars, a rising pre-chorus build, an explosive chorus drop with crunchy guitars, 808 bass and claps, a beat switch in verse 2, double-time drums in verse 3, a stripped breakdown on Given, When, Then, and a key change up for the final chorus. The pop quiz is game-show call-and-response with a short pause before each crowd-shouted answer. Spoken intro, quiz intro, and outro, dry and deadpan. Glittery synth hooks, vocals upfront.
```

**Style of Music** (short, 172 characters):

```text
high-energy pop-punk anthem, 104 BPM, male vocal, crisp diction, keywords shouted on downbeats, gang vocals, half-time verses, big drops, beat switch, breakdown, key change
```

**Exclude Styles:**

```text
mumble rap, slurred vocals, heavy autotune, distorted vocals, screaming, heavy reverb, lo-fi muffled vocals, EDM, trap hi-hat rolls, ballad
```

Starting points to adjust, not tested settings: low Weirdness (about 30%) and high
Style Influence (about 70%). Generate several takes and keep one where all six
keywords are sung in full at the start of their chorus lines; fix a dropped word
with Suno's section replace before alignment.

**Quiz gaps.** Suno ignored per-question break tags on the last take, so the sheet
no longer has them; the style prompt asks for a short pause instead. Either way,
the player's quiz pause stops right after each question (`pause_at`).

### Pronunciation and performance notes

| Written | Sung as | Note |
| --- | --- | --- |
| INVEST | "in-VEST" | Spelled out only in the letter roll call ("I! N! V! E! S! T!"). |
| SMALL! | "SMALL!" | A one-word shout on the downbeat; two takes in a row never sang it after "S!". |
| TESTABLE! | "TEST-uh-bul!" | The keyword now opens the line, like the other five. |
| Dijkstra's | "DIKE-struh's" | If Suno mispronounces it, write it phonetically as "Dyke-stra's" in the Suno prompt only. |
| DM | "dee-em" | |
| "-ish" | "ish" | Deliver it as a shrug, so the joke about vague words comes through. |
| Estimable | "ES-tuh-muh-bul" | Stress on the first syllable, not "es-TIM-able". |

The section order is kept because it suits the teaching: why stories exist, then
the format, the definitions, a worked example per letter, retrieval, and a
limit. It is not kept to save artwork; the scenes were redrawn for the new
examples. Suno ignored the break tags in the quiz, so each question runs straight
into its answer, and the player's quiz pause stops right after the question.

## Pop quiz audit: one broken letter per story

The intro line sets the rule that each card's acceptance criteria say just what
the card says. Without that rule, a listener could fairly answer "not Testable" for
every card, because the chapter judges INVEST mainly on acceptance criteria (FAQ,
"Is INVEST evaluated primarily on the main body…").

✓ = satisfied, ✗ = violated.

| # | Story | I | N | V | E | S | T | Why only that letter breaks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Student: route to class found with Dijkstra's algorithm | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | It requires a particular algorithm, which the chapter's Negotiable check 3 names as prescribing an implementation. The need is the shortest route. Shortest paths are routine to estimate and objective to test. |
| 2 | Developer: 90% test coverage on the cart code | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | Only developers benefit. It names a target, not a technique, so Negotiable holds. Coverage is measurable, and one module is scoped, so S, E, and T hold. This follows the chapter's quick check on structured logging. |
| 3 | Renter: view lease, report a repair, and message landlord | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | Three stories, each valuable alone, are joined by "and" (Small check 1 and 2). Each part is familiar CRUD or messaging work, so the whole stays estimable. Payments were left out on purpose because they would raise a spike question (E). |
| 4 | Rider: rate my driver, but booking isn't built yet | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | An order dependency: rating needs a completed ride. The bridge then shows the context changing, because once booking exists the same story is independent. |
| 5 | Club president: sign-up page that looks "aesthetic" | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | "Aesthetic" is a subjective word. Building one page takes about the same effort under any reasonable reading of the word, which is the chapter's landing-page argument for keeping it estimable. |
| 6 | Coach: each player's readiness score; only the coach knows the formula | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | The team lacks domain knowledge (Estimable barrier 1, fixed by a conversation). The formula exists and is objective, so the story is still testable. This is the same split as the chapter's wellness screening. |
| 7 | Student: mute my group chat for an hour, to study in peace | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | The chat and its notifications already exist, so no other story is needed. It names no technology. "No notifications for that hour" is objective, and a timed mute is small, familiar work. It replaced "As a broke student… so I can still afford to eat", which made a joke of money and food insecurity. |

### Leaks in the current take's quiz

| Current story | Answer given | What also breaks, or is arguable |
| --- | --- | --- |
| "I want a QR code on every table for the menu." | N | There is no role or goal, so Valuable can't be judged, and it assumes a digital menu exists (I). |
| "As a dev, I want to refactor the login code." | V | There is no goal or criterion, so "refactor" has no pass/fail (T). |
| "I want the whole checkout: cart, payment, shipping, returns." | S | The chapter says epics usually make estimates unreliable, and payments raise a spike question (E). |
| "I want the app to feel snappy." | T | The chapter's own FAQ says it is fair to judge this story not estimable either (E). |
| Playlist, wellness screening, search by author | I, E, none | Clean. They are reused from the chapter, though, so they don't test transfer to new stories. |

## How each section matches the chapter

| Lyric | Chapter claim it carries |
| --- | --- |
| Intro: "Green tests prove we built it right — not that we built the right thing." | User stories exist so the team builds the right software. Testable section: they prevent "that's not what I meant". |
| V1: "One need on a card… a ticket to talk, so the 'why' gets heard." | A lightweight, informal requirement and a placeholder for a conversation about the why and the what. |
| V1: "'As a user'? Too blurry — name exactly who" | "Be specific about the actor." The rider and the driver show why: different roles need different things. |
| V1: "'I want' is the need; 'so that' is the real why — not the same feature in a fresh disguise." | The main requirement sits in *I want*. Common mistake: a circular *so that*. |
| V1: "Acceptance criteria spell out when it's done: clear enough to test, but they don't choose the code you run." | Criteria define scope and "done", "specific enough to be testable but … not overly prescriptive". |
| Chorus I / V2 I: "no overlap, no waiting — any order"; "no story has to come first, and no two cards promise the same thing — overlap's worse" | "Does not overlap with or depend on other stories — it can be scheduled and implemented in any order." Overlap is more harmful than an order dependency. |
| V2 I: layers, cake slice, "Write it down" | Horizontal split, then vertical slice. When independence isn't possible, make dependencies explicit. |
| Chorus N / V2 N: "the need, not the design — talk it over"; "a promise to talk, not a contract… That's a how!… note it elsewhere" | "Captures the essence of a user's need without locking in specific design or technology decisions — the details are worked out collaboratively." Not a contract. Document real technical constraints separately. |
| Chorus V / V2 V: "not just devs — users or customers gain"; "if we cut it, who'd complain?… find the users' gain… Criteria set the scope" | "Tangible benefit to the customer, purchaser, or user — not just to the development team." Would they care if it were dropped? Criteria must capture the essential functionality, and they decide INVEST over the card text. |
| Chorus E / V3 E: "scope's clear, so we can size what it takes"; "rough but fair — domain, tech, and scope: no fog"; grade curve, "go ask"; "spike, time-boxed tight" | "Scope clear enough for the development team to make a reasonable judgment about the effort." Precision isn't the goal. The three barriers are domain knowledge (fixed by a conversation), technical knowledge (fixed by a time-boxed spike), and size (fixed by splitting). |
| Chorus S / V3 S: "one sprint — the smallest valuable slice there is"; trench coat, "split 'em at the 'and's", crumbs, "combine!" | "Completed within a single iteration… as small as it can be while still delivering value." Compound stories split at *and*. Too small means combine, because tracking costs more than building. |
| Chorus T / V3 T: "criteria say pass or fail — no '-ish'"; "the criteria decide when it's done — objective pass or fail"; vague words; Given / When / Then | "Clear, objective, and measurable acceptance criteria that allow the team to verify definitively when the work is done." No weasel words, quantify, use Given / When / Then. |
| Bridge: "a lens, not a checklist; the context changes what's true" | INVEST is context-dependent. The same story is independent once its dependency is built. |
| Outro: "uptime, scale, safety rules? Those need other kinds of specs." | Limitations: non-functional and safety-critical requirements. |

Left out on purpose, to keep the song's load manageable: the purchaser-versus-user
nuance, IRACIS, and the Scrum planning tie-in. The chapter covers each of them.

## Where the integrated song lives

- **Words and timing:** `_data/songs/invest_in_your_stories.yml` holds the words,
  word marks, quiz `answer_at` and `pause_at`, and the beat map, aligned from Whisper
  word timestamps.
- **Scenes:** `js/song-video/songs/invest_in_your_stories.js` draws them. Every
  story card shows Given / When / Then criteria that fit the verdict the song gives
  it, and the `QUIZ` table there lists each quiz card's criteria.
- **Cards:** `js/song-video/story-kit.js` and `css/song-video-story-kit.css` draw
  ruled cards whose rules sit on the text baselines at every card size.
- **Captions and described audio:** `node scripts/song-video/render.js
  invest_in_your_stories` regenerates them.
