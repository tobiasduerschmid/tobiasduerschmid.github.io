# Not a One-Time Investment: a song about design with reuse

Lyrics, Suno prompt, music-video storyboard, and a short class plan for a
CS 35L song on Lecture 12, *Design with Reuse*, and the SEBook chapter
[Design with Reuse](../SEBook/designprinciples/reuse.md). **Status: recorded
and built.** The Suno take "External Reuse" (4:50) sings this sheet word for
word, including all six quiz answers. Its storyboard is
`_data/songs/not_a_one_time_investment.yml`, the choreography
`js/song-video/songs/not_a_one_time_investment.js`, and the video plays live
in the chapter (`id="reuse-song"`) and on
`/assets/song-player/not-a-one-time-investment.html`. The storyboard below was
the plan; the YAML's `visual` lines describe what the video actually shows.
The built video replaced the planned desk with the lecture's own metaphor,
toy bricks: a brick construction site that builds itself during the intro
(after the lecture's title picture), packages as bricks whose studs are
their interface, dependency towers that tilt (urllib3) and fall (left-pad),
a framework as a baseplate, and principles and quiz answers as bricks that
snap on (`scripts/song-video/README.md`). It also replaced the planned accent
per case with one colour per meaning, the same in every case: blue for reused
packages and libraries (and the case tabs and page headings that file them),
gold for your own code and what is worth keeping (principles, the refrain's
questions), red for what breaks, green for what is fixed or right, grey for a
framework's structure, and tan for neutral filler. Only low-contrast things
move in the backdrop (drifting clouds, the light in lit windows, a dim
forklift on the ground), so nothing pulls the eye from the casebook.

## What changed from the dance-pop draft

The first draft ("Not a One-Time Thing") was a nu-disco love song to a
library. It was catchy, but its form did the teaching less well than it
could. This revision keeps every lecture example, the principles, the quiz's
six transfer cases, and the class plan, and changes the form.

| # | Problem in the pop draft | Change |
| --- | --- | --- |
| 1 | **The hook carried a feeling, not a rule.** "You're not a one-time thing, I've got to stay invested" is a love-song line. Remembered alone, it tells a student to care about a library, not what to do. | The refrain is now a decision checklist students can run on any package: *What will it save? What will it cost? What does it assume? What does it pull in? Pin it, but update for patches.* It ends on the lecture's own key takeaway, word for word: "External reuse is not a one-time investment" (slide 18). |
| 2 | **The verses told what happened, not why.** Verse 2 said urllib3 2.0.0 "changed the API on me" but never why an untouched project picked it up. Heartbleed had no mechanism. Left-pad never said how so many builds depended on it. | Every case now runs the same three steps: *what happened → why it happened → the principle*. urllib3: nothing was pinned, so a clean install got version two. Heartbleed: the server trusted a length it was sent. Left-pad: Babel and React pulled it in through packages they used. Ariane: it worked where it was built and failed where it was sent. The repeated shape is a schema students can reuse when they meet a new incident. |
| 3 | **Slang and relationship idioms carried content:** "left the chat", "a spat with npm", "You changed!", "Love at first install". They add load, especially for students whose first language isn't English, and two of them stood in for the facts. | All gone. Each line now says the fact plainly: "Its author unpublished it." |
| 4 | **The limit of "keep dependencies few" came only in the quiz.** Until then the song pushed only caution, which invites the overcorrection "dependencies are bad". | Verse 4 states the boundary where the rule is sung: "But code that's hard to get right, like crypto: don't write your own." The quiz then applies it. |
| 5 | **Shouted group answers and a game-show quiz** made the answers slogans: "PATCH ON PURPOSE!" could mean "edit the library yourself". | One singer throughout. Quiz answers carry their reason or their check ("Check if it assumes month first"), and "patch" is now "update for patches" / "update to the fix". |
| 6 | **The verses named the risks, but not the benefits' cause.** "Tried in working systems" was a slogan. | Verse 1 gives the reason reused code has fewer defects: it has run in working systems, so bugs were found and repaired. Verse 3 adds a benefit students rarely think of: one fix reaches everyone who updates. |
| 7 | **Dance-pop at 116 BPM with a key change** spent its energy on groove. The 13-line chorus, sung three times, took about a third of the song. | Indie folk story song: the folk tradition of telling what went wrong and the lesson in it, which is exactly what each case does. The refrain is 7 lines. Indie folk is current with Gen Z listeners without the dance-pop gloss. |

### Then: more upbeat and positive

| Change | Why it still teaches |
| --- | --- |
| Upbeat indie folk-rock at about 112 BPM, bright major key, stomps, handclaps, banjo, and a fiddle hook. | One singer and an uncluttered mix keep the words on top. At 112 BPM a one-bar line lasts about 2.1 s: about 4 syllables per second for the longest lines. |
| The intro opens on the good news: "you don't have to write it all yourself. Let's learn to reuse it well." | It frames the song as a skill to learn, not a list of dangers, and still sets up the cost-benefit question the refrain asks. |
| Verse 3 ends on reuse's upside: "That's reuse on your side: one fix, shared by all." It replaces "Five years on, some still leak". | The principle stays (update for patches, then test); the case now shows what updating gains, which is the reason to do it. |
| Section moods are hopeful (a lighter bridge, a playful quiz, a joyful final refrain), and the outro ends "That's reuse done right." | Every case already ends on what to do; the music now lands there too. |

Unchanged: every fact, the three-step case schema, the refrain's words, and
the six quiz cases.

Kept: the five lecture cases in the lecture's order of principles, benefits
first, blameless failures (the incidents are famous, not the listener's
fault), the six quiz cases with their contrast pair, and the left-pad →
`padStart` punch line from the Left-Pad Refactoring Lecture tutorial.

## What the song teaches

**Audience.** CS 35L students, mostly sophomores. They write C++ from CS 31/32
and are learning Python, Node.js, React, and Git here. Before Lecture 12 they
have met HTTP and TLS (networking), "don't roll your own crypto" (security),
pytest (the testing tutorials), and the left-pad code itself (the Left-Pad
Refactoring Lecture tutorial). They have little industry experience, so the
incidents stand in for experience they don't have yet.

**Function.** Review after Lecture 12. It does not replace the lecture.

**Goal.** Given a reuse candidate and a context, students can run the
refrain's checklist on it and justify a decision:

- weigh the effort it saves against the effort to adapt it;
- name the risk each lecture example shows, and *why* it happened: a breaking
  update reached through an unpinned dependency (urllib3), an inherited
  vulnerability (Heartbleed), a trivial transitive dependency that vanished
  (left-pad) or was hijacked (eslint-scope), a violated assumption (Ariane 5),
  and framework lock-in;
- pick the safeguard: pin versions; update on purpose for security patches,
  then test; keep dependencies few and write trivial code, but reuse vetted
  code for hard problems such as encryption; prefer maintained, popular
  modules, but fit first; identify violated assumptions (docs and code, built
  for what, test); version it or clone and own it.

**Transfer.** All six quiz questions are new cases built on what sophomores
already know. None repeats a verse example.

## Structure

Every part of the song has one teaching job.

| Section | Job |
| --- | --- |
| Intro | Open on the good news (you don't have to write it all yourself) and frame reuse as a skill to learn. |
| Verse 1 | The benefits, with their reason; then the catch: modules carry assumptions, and glue code fills the gaps. |
| Refrain (×3) | The decision checklist, in stable words. Same melody every time. |
| Verses 2–4, bridge | One case each, always in three steps: what happened → why → principle. |
| Verse 5 | One distinction, library or framework, decided by one test: who calls whom. |
| Quiz | Six new cases. The player pauses after each question; the answer follows. |
| Final refrain | Same checklist, now with every case behind it. |
| Outro | Apply it once more, to the package the intro started to install, and end on reuse done right. |

## Lyric sheet (Suno-ready)

- **Format:** one line per bar; verse lines 5–8 syllables; every verse rhyming
  pair 14 syllables or fewer (audited, see "Review record").
- **Length:** 3,975 characters, under Suno's 5,000-character limit.
- **Respellings** (U-R-L-lib-three, Open-S-S-L, A-P-I, N-P-M, Pie-test,
  pad-Start) are for Suno only. Captions use normal spelling.
- **Quiz pauses:** Suno ignores pause and break tags, so the player's
  `pause_at` supplies the thinking pause after each quiz question.

```text
[Intro: spoken, warm and upbeat, over strummed guitar and handclaps]
Good news: you don't have to
Write it all yourself.
Let's learn to reuse it well.

[Verse 1: what reuse saves]
Most code I need is out there,
Written once and shared.
It's run in working systems,
So bugs were found and repaired.
Less to write and less to test,
So the feature ships sooner.
But modules aren't neat building blocks:
Each one assumes its world,
And glue code joins the pieces
Where those worlds don't fit.

[Refrain: bright, singable melody, the same every time]
Before you reuse, ask:
What will it save? What will it cost?
What does it assume?
What does it pull in?
Pin it, but update for patches.
External reuse
Is not a one-time investment.

[Verse 2: pinning keeps your build steady]
My code had not changed a line,
Yet docker broke today.
Docker calls on Requests;
Requests calls U-R-L-lib-three.
No version had been pinned,
So a clean install got two;
Version two changed its A-P-I,
And Requests' calls broke too.
Pin dependency versions:
Nothing moves till you choose.

[Verse 3: updates spread the fix]
Open-S-S-L had a flaw;
For two years, no one saw.
A request claimed a length;
The server trusted it
And sent back its own memory:
Passwords, private keys.
I didn't write that bug,
But I shipped it, all the same.
The fix shipped within a week
To all who chose to update;
That's reuse on your side:
One fix, shared by all.
Pinned doesn't mean frozen:
Update to the fix, then test.

[Refrain: bright, singable melody, the same every time]
Before you reuse, ask:
What will it save? What will it cost?
What does it assume?
What does it pull in?
Pin it, but update for patches.
External reuse
Is not a one-time investment.

[Verse 4: choose your dependencies well]
Left-pad: eleven lines
That pad a string on the left.
Babel and React pulled it in
Through packages they used.
Its author unpublished it;
Thousands of builds failed.
Many never saw it:
A dependency, deep down.
When eslint-scope was hijacked,
Its new release stole tokens.
Write trivial code yourself;
Keep dependencies few:
Each one can break, be hijacked,
Or vanish out of view.
But code that's hard to get right,
Like crypto: don't write your own.
Choose maintained and popular,
But fit comes before fame.

[Bridge: half-time, lighter, still hopeful]
Code built for Ariane Four
Stored horizontal speed
In sixteen bits: enough,
Since that rocket flew slower.
Reused in Ariane Five,
Which flew faster: overflow!
Thirty-seven seconds in,
It veered, then self-destructed.
It worked where it was built,
And failed where it was sent:
Its assumption didn't hold.
Identify violated
Assumptions:
Read the docs and read the code,
Check what it was built for,
Then test it where it goes.
If two systems drift apart,
Version it, or clone and own:
Copy it, so each can change.

[Verse 5: library or framework]
Library or framework?
Ask who calls whom.
I call axios when I choose;
Express calls my code.
That's the Hollywood Principle:
Don't call us, we'll call you.
It decides more; I write less,
But it's harder to undo.

[Quiz: playful, the singer asks each question, then sings its answer]
Your turn! Try these cases.
A package just to check
If a number is even?
No. It's one line: write it.
Keep dependencies few,
So write your own encryption?
No: reuse the tested one.
Your pinned library
Gets a security fix?
Update on purpose, then test.
Your old date code now runs
For users in Europe?
Check if it assumes month first.
Two apps share a module,
And their needs drift apart?
Version it, or clone and own.
Pie-test runs the tests you wrote:
Library or framework?
Framework: it calls your code.

[Final Refrain: same melody, full band, joyful]
Before you reuse, ask:
What will it save? What will it cost?
What does it assume?
What does it pull in?
Pin it, but update for patches.
External reuse
Is not a one-time investment.

[Outro: spoken]
N-P-M install left-pad?
No need: pad-Start is built in.
That's reuse done right.
[End]
```

### Suno style prompt

**Style of Music** (full, 716 characters):

```text
Upbeat indie folk-rock story song, about 112 BPM, 4/4, bright major key. Strummed acoustic guitar, banjo, upright bass, kick-drum stomps and handclaps, piano, a cheerful fiddle hook in the refrain. One singer throughout: a warm, smiling female alto storyteller, energetic but conversational, crisp diction, every word clear, never belting. Verses are sung narration on a bouncy, steady melody, one lyric line per bar, never rapped or talked. The refrain is a bright, singable melody that returns unchanged each time. Half-time bridge, lighter but still hopeful. Playful quiz: the same singer asks each question, then sings its answer. Spoken intro and outro, warm and friendly. Uncluttered mix with the voice on top.
```

**Style of Music** (short, 178 characters, for a field limited to about 200):

```text
upbeat indie folk-rock, 112 BPM, bright major key, strummed guitar, banjo, stomps and handclaps, warm smiling female alto storyteller, crisp diction, one singer, singable refrain
```

**Exclude Styles:**

```text
dance-pop, disco, EDM, synth-pop, four-on-the-floor, rap, autotune, vocal chops, choir, gang vocals, duet, male vocal, sad, melancholic, slow ballad
```

Suno has ignored tempo requests before (Draw It Out asked for 134 BPM and came
out at about 120). Judge a take by syllables per second, not by its BPM.
Generate several candidates and keep one whose verses stay near 4 syllables
per second.

### Pronunciation and take checks

| Sheet | Sung as | Captions |
| --- | --- | --- |
| U-R-L-lib-three | "you-are-ell-lib three" | urllib3 |
| Open-S-S-L | "open ess-ess-ell" | OpenSSL |
| A-P-I | "ay-pee-eye" | API |
| N-P-M | "en-pee-em" | npm |
| Pie-test | "pie-test" | pytest |
| pad-Start | "pad start" | `padStart` |
| eslint-scope | "ee-ess-lint scope" | eslint-scope |
| Ariane | "ah-ree-AHN" or "air-ee-ANN"; either is fine | Ariane |

Check every take for these:

- **The refrain is identical all three times.** Suno sometimes improvises a
  word. The refrain's wording is the retrieval cue, so a changed word needs a
  section replace.
- **Every quiz answer is sung**, after its question, by the same voice (take 6
  of Draw It Out skipped one).
- **Negations survive:** "No. It's one line", "No: reuse the tested one",
  "don't write your own", "Don't call us". A dropped "no" or "don't" reverses
  the rule.
- **No swapped near-identical terms:** "Ariane Four" and "Ariane Five";
  "library" and "framework" in verse 5 and the quiz. Confirm each with an
  unprompted clip pass.
- **"Identify violated / Assumptions"** gets both bars; check that
  "assumptions" is not dropped.
- **Balance:** check the left-right balance per section (take 7 of Draw It Out
  drifted hard right) and merge to mono if it wanders.

## Using it with sophomores

This sequence is original design synthesis, not a tested intervention. Times
are planning estimates. Everything works with written answers, so nobody has
to sing.

1. **Before the video (1 minute).** Ask: "Your code hasn't changed since
   yesterday. Can your build still break today?" Each student writes yes or no
   and one reason.
   - *Expected:* "Yes: a dependency, or a dependency's dependency, released a
     new version and nothing was pinned."
   - *Likely wrong answer:* "No: same code, same result."
   - Don't resolve it yet; verse 2 does.
2. **During (about 5 minutes).** Play the video. At each quiz pause, students
   write a three-to-five-word answer before the singer gives it. Afterward,
   ask for a show of hands on the one-line package versus the encryption
   question. Students who answered both the same way are following a rule
   without weighing cost; point them back to the refrain's first question.
3. **After, without the music (4 minutes).** Use the lecture's existing exit
   ticket: axios versus `fetch` for the course project. The refrain is the
   scaffold: What will each save? What will each cost? What does each assume?
   What does each pull in? How will you keep it pinned and patched?

   A strong answer weighs both and decides for this project:

   > axios adds conveniences like interceptors, but `fetch` is built into
   > current Node.js and covers our simple requests, so one fewer dependency
   > wins.

   The opposite choice is just as good when it is argued from the project's
   needs.

   | Weak answer | What it misses |
   | --- | --- |
   | "axios is more popular" | Popularity is not fit. |
   | "Built-in is always better" | It ignores what the library saves. |
   | "Never use packages after left-pad" | Overcorrection. The encryption question answers it. |

   Next class, show two or three anonymized answers next to the refrain.
4. **A week later.** Assign the SE Gym "Design with Reuse" quiz. Its questions
   don't use the song's wording, so it checks retrieval without the melody as
   a cue.

## Music video storyboard

### The world: the casebook

A sunlit wooden desk by a window, morning to afternoon across the song. On it: the student's laptop, and an open
**casebook**, a field notebook with one spread per case. Each case spread has
the same three labeled panels, filled in as the verse sings them:

1. **What happened**: the real artifact (an error, a timeline, a gauge);
2. **Why**: the mechanism, drawn as a small diagram;
3. **Principle**: the lecture's name for it, hand-lettered.

The same layout on every spread is the point: it shows the verses' three-step
shape, so viewers learn where to look and can compare cases. The **checklist
card** clipped inside the notebook's cover is the refrain; each refrain line
lights its question.

Palette: warm paper, ink, and daylight, with one accent per case (blue for
urllib3, teal for Heartbleed, red for left-pad, orange for Ariane, green for
library/framework). Panels are solid paper with AA-contrast ink, never text on
a photo or gradient.

### Cast

- **The student** is the "I" of the song: the viewer's saved SE Gym hero in the
  shared seated student-at-laptop artwork (`student-avatar.js`), at the desk.
- **Packages** are small paper-craft boxes on the desk, each with a shipping
  label naming the package and, when the story needs it, its version (urllib3
  1.26 → 2.0.0, OpenSSL 1.0.1f → 1.0.1g). No faces: they are artifacts, not
  characters.

### Visual rules for this song

- **One thing to look at per line.** The sung words are already captions. The
  stage adds only the real artifact the line is about, or the lecture's name
  for the principle when it is sung. No sentence that paraphrases the lyric.
- **Show the state the line sings, not a later one.** The "Why" panel draws
  each step as it is sung (no version pinned → clean install → version two →
  broken call), never the whole chain at once.
- **Flash safety (WCAG 2.3.1).** No strobes, no full-frame brightness changes;
  the Ariane breakup is a slow orange bloom with no white frame; no camera
  shakes or long slides in text scenes. Run
  `node scripts/song-video/render.js not_a_one_time_investment --check-flashes`
  and read its own `check-flashes:` line. Don't pipe it through `tail`.
- **Readable text.** Stage text at least 12 px on the 960 px stage; every label
  holds for at least max(1.5 s, 0.6 s + words ÷ 3); labels sit on or next to
  what they name; `text-wrap: balance` and `white-space: nowrap` prevent orphan
  words.
- **Real code, highlighted.** Code comes from the slides and tutorials, in the
  shared `.code-tok--*` palette. SongKit has only `highlightPython`; the
  left-pad, axios, Express, and `padStart` cards need a shared JavaScript
  tokenizer in `kit.js`, not a per-kit copy.
- **Quiz cards** use the shared `.quiz-card` UI; each answer appears as it is
  sung.
- **No company logos.** Text labels only (React, Babel, npm, OpenSSL).
- **Captions and transcript** use normal spelling. Each section's `narration`
  for the audio-described track is written once the art exists.

### Scenes at a glance

| Section | Casebook spread | Accent | Story |
| --- | --- | --- | --- |
| Intro | Cover, then the first blank spread | Morning light | Good news, and the question |
| Verse 1 | "What reuse saves" | Gold | Benefits, then hidden assumptions and glue |
| Refrain | Checklist card | Ink | Five questions and the takeaway |
| Verse 2 | Case 1: urllib3 | Blue | Unpinned version |
| Verse 3 | Case 2: Heartbleed | Teal | Inherited bug, and the fix that reaches updaters |
| Verse 4 | Case 3: left-pad and eslint-scope | Red | Every dependency is a risk; the crypto boundary |
| Bridge | Case 4: Ariane 5 | Orange | Violated assumption; evolving separately |
| Verse 5 | Case 5: library or framework | Green | Who calls whom |
| Quiz | Blank spread, quiz cards | Ink | Six new cases |
| Final refrain | Checklist card, all case tabs visible | All accents | Recap |
| Outro | Laptop terminal | Afternoon light | `padStart`, reuse done right |

### Intro and verse 1

| Lyric | Picture |
| --- | --- |
| Good news: you don't have to | Morning light on the desk; the student's terminal shows `$ npm install left-pad`, cursor waiting. |
| Write it all yourself. | A shelf of open-source boxes slides in beside the laptop. |
| Let's learn to reuse it well. | The casebook opens to a balance scale on its first page: "Effort saved" and "Effort to adapt". The command stays unsent. |
| Most code I need is out there, | A shelf of labeled boxes from slide 8: requests, urllib3, numpy, pandas, docker. |
| Written once and shared. | An "open source" tag on each box. |
| It's run in working systems, | Thin lines connect requests to dozens of small app icons. |
| So bugs were found and repaired. | A bug list beside requests; each item gets "fixed". Label: "Tried and tested". |
| Less to write and less to test, | Two bars shrink: "Implementation effort", "Testing effort". |
| So the feature ships sooner. | Two cards from slide 3: "Higher productivity, faster time to market" and "Higher software quality, fewer defects". |
| But modules aren't neat building blocks: | Top-down: square tiles labeled "Library 1" and "Library 2" snap into a neat grid. Label: "The vision". |
| Each one assumes its world, | The grid resets with uneven tiles; two flip to show notes: "assumes one thread", "assumes lower velocity" (returns in the bridge). Label: "The reality". |
| And glue code joins the pieces | Tape strips stamped "glue code" bridge the gaps, one per beat (slide 5). |
| Where those worlds don't fit. | The finished patchwork; the balance scale returns. |

### Refrain

The checklist card fills the frame. Each line lights its question; the lecture's
name for it appears underneath, so students link the song's words to the
exam's words.

| Lyric | Picture |
| --- | --- |
| Before you reuse, ask: | The card: "Before you reuse". |
| What will it save? What will it cost? | Line 1 lights: the balance scale. Lecture name: "Cost-benefit analysis". |
| What does it assume? | Line 2: a tile under a magnifier. "Identify violated assumptions". |
| What does it pull in? | Line 3: a small dependency tree. "Strive for fewer package dependencies". |
| Pin it, but update for patches. | Line 4: a pinned version tag, then a patch on a padlock. "Keep versions fixed" and "Update to receive security patches". |
| External reuse / Is not a one-time investment. | The card's footer, the lecture's key takeaway (slide 18), in large ink. |

**Refrain variations.** The first refrain uses generic icons. The second shows
case tabs for urllib3 and Heartbleed beside line 4. The final refrain shows
all five case tabs, each beside the question it answers: Ariane by "assume",
left-pad by "pull in", urllib3 and Heartbleed by "pin" and "update".

### Verse 2 (case 1): urllib3

| Lyric | Picture |
| --- | --- |
| My code had not changed a line, | *What happened:* `$ git status` → "nothing to commit, working tree clean". |
| Yet docker broke today. | The red error from slide 9, with "unexpected keyword argument 'chunked'" highlighted. |
| Docker calls on Requests; | *Why:* box "docker (Python package)" → arrow "calls" → box "requests". |
| Requests calls urllib3. | The chain extends to "urllib3 1.26". |
| No version had been pinned, | Each box's version tag is drawn as an open range: "any version". |
| So a clean install got two; | `$ pip install` runs; the urllib3 tag flips to "2.0.0". |
| Version two changed its API, | The call `_make_request(…, chunked=chunked)`, with `chunked=chunked` outlined: "rejected by 2.0.0". Label: "API-breaking change". |
| And Requests' calls broke too. | The red cross travels back up the chain to docker. |
| Pin dependency versions: | *Principle:* the Pipfile line from slide 10, `urllib3 = "<2.0.0"`, gets a thumbtack; beside it a `package-lock.json` card: "commit it". Lettered: "Keep versions of your dependencies fixed". |
| Nothing moves till you choose. | The chain goes green. |

### Verse 3 (case 2): Heartbleed

| Lyric | Picture |
| --- | --- |
| OpenSSL had a flaw; | *What happened:* a padlock box "OpenSSL 1.0.1", labeled "Encrypted connections (TLS)"; a hairline crack. |
| For two years, no one saw. | A calendar: March 2012 → April 2014. |
| A request claimed a length; | *Why:* a request card: "Send back 'a' (length: 64 KB)". |
| The server trusted it | The server box reads only the length field, highlighted. |
| And sent back its own memory: | It returns "a" plus a long strip labeled "Server memory". Label: "Buffer over-read". |
| Passwords, private keys. | The strip's items: `password=…`, `-----BEGIN PRIVATE KEY-----` (redacted). Badge: "Heartbleed". |
| I didn't write that bug, | The student's own code card, green check: "your code". |
| But I shipped it, all the same. | An X-ray of the student's app shows the OpenSSL box inside, outlined. Label: "Reused code brings its vulnerabilities". |
| The fix shipped within a week | Timeline: "April 1, 2014: found" → "April 7: 1.0.1g". |
| To all who chose to update; | Many app icons switch to the 1.0.1g padlock at once. Label: "One fix reaches everyone who updates". |
| That's reuse on your side: | A counter of updated apps climbs. |
| One fix, shared by all. | Every updated app shows the same 1.0.1g padlock. Label: "Update to receive security patches". |
| Pinned doesn't mean frozen: | *Principle:* the thumbtack from case 1 is lifted on purpose; the tag moves 1.0.1f → 1.0.1g. |
| Update to the fix, then test. | A test runner: "all tests passed". Lettered: "Update to receive security patches". |

### Verse 4 (case 3): left-pad and eslint-scope

| Lyric | Picture |
| --- | --- |
| Left-pad: eleven lines | *What happened:* left-pad's 11 lines, numbered, as students ran them in the Left-Pad Refactoring Lecture tutorial. |
| That pad a string on the left. | *What it does:* `leftpad(7, 3)`, `leftpad(42, 3)`, and `leftpad(317, 3)`; padding bricks drop in on the left of 7 and 42 until all three numbers line up on the right. (Built; the plan was `leftpad(5, 3, '0')` → `'005'`.) |
| Babel and React pulled it in | *Why:* an `npm ls` tree: app → React / Babel → … → left-pad. |
| Through packages they used. | The path to left-pad lights, level by level. Label: "transitive dependency". |
| Its author unpublished it; | The left-pad leaf fades out. "March 22, 2016". |
| Thousands of builds failed. | Terminals around it print `npm ERR! 404 'left-pad' is not in the npm registry`. |
| Many never saw it: | The tree's top level, where developers look; left-pad is far below the fold. |
| A dependency, deep down. | Scroll down to the missing leaf. |
| When eslint-scope was hijacked, | A package card "eslint-scope" with a padlock broken: "maintainer account taken over (2018)". |
| Its new release stole tokens. | The malicious release reads a `.npmrc` card labeled "npm token" and sends it off. |
| Write trivial code yourself; | *Principle:* the isArray one-liner from slide 15, tagged "1 line". Lettered: "Avoid reusing trivial code". |
| Keep dependencies few: | Most tiny boxes leave the tree; a few stay. Lettered: "Strive for fewer package dependencies". |
| Each one can break, be hijacked, | Two tags on a box: "can break", "can be hijacked". |
| Or vanish out of view. | A third tag: "can disappear". |
| But code that's hard to get right, | *Boundary:* a hand-written `encrypt()` with a question mark. |
| Like crypto: don't write your own. | It is crossed out; a maintained crypto library box takes its place. Lettered: "Don't roll your own crypto". |
| Choose maintained and popular, | Two profile cards: A "commits weekly, many users, good docs", B "last commit 4 years ago". A gets a check. |
| But fit comes before fame. | The most popular box is too big for the project's slot; a smaller one fits. Lettered: "Fit matters more than popularity". |

### Bridge (case 4): Ariane 5

| Lyric | Picture |
| --- | --- |
| Code built for Ariane Four | *What happened:* Ariane 4 on the pad; its "Inertial Reference System" box. |
| Stored horizontal speed | A gauge: "Horizontal velocity → 16-bit signed integer". |
| In sixteen bits: enough, | The gauge's limit: 32,767. |
| Since that rocket flew slower. | Ariane 4's needle stays in the green. |
| Reused in Ariane Five, | The same box moves into Ariane 5 along an arrow: "internal reuse". |
| Which flew faster: overflow! | The needle passes 32,767; red stamp: "Overflow error". |
| Thirty-seven seconds in, | A mission clock: "37 s after main-engine ignition". |
| It veered, then self-destructed. | The rocket veers, then a slow orange bloom. Stat card: "$370 million". |
| It worked where it was built, | *Why:* split panel, "Ariane 4: fits ✓". |
| And failed where it was sent: | "Ariane 5: overflows ✗". |
| Its assumption didn't hold. | A note pinned to the box: "Assumes: horizontal velocity fits in 16 bits". |
| Identify violated / Assumptions: | *Principle:* lettered "Identify Violated Assumptions" (slide 25), with three empty checkboxes. |
| Read the docs and read the code, | Checkbox 1: "Check documentation and code". |
| Check what it was built for, | Checkbox 2: "Check it was designed for your conditions". |
| Then test it where it goes. | Checkbox 3: "Test it"; a ground bench runs Ariane 5's trajectory and fails before launch. |
| If two systems drift apart, | From slide 28: Ariane 4's and Ariane 5's version timelines diverge: "keeps 16 bits" and "needs 32 bits". |
| Version it, or clone and own: | The module splits: "IRS v1 (16-bit)" and "IRS v2 (32-bit)". Lettered: "Evolving separately". |
| Copy it, so each can change. | The clone gets its own owner tag. |

### Verse 5 (case 5): library or framework

| Lyric | Picture |
| --- | --- |
| Library or framework? | A two-column spread: "Library" and "Framework". |
| Ask who calls whom. | One arrow, unlabeled, between "your code" and each column. |
| I call axios when I choose; | Code card from slide 29: `const response = await axios.get('/user?ID=12345');` Arrow: your code → axios. |
| Express calls my code. | `app.get('/', (req, res) => { res.send('Hello World!') })`. Arrow reversed: Express → your handler. |
| That's the Hollywood Principle: | Lettered: "Hollywood Principle (Inversion of Control)". |
| Don't call us, we'll call you. | A `GET /` request arrives; Express calls the handler. |
| It decides more; I write less, | The framework's box grows; the student's code card shrinks: "less code". |
| But it's harder to undo. | The framework's frame becomes walls around the app. Lettered: "Harder to reverse". |

### Quiz

Each question is a `.quiz-card`; the player pauses after the question, and the
answer appears as it is sung. Details are in "Quiz audit".

| Lyric | Picture |
| --- | --- |
| Your turn! Try these cases. | A blank casebook spread: "Your cases". |
| A package just to check / If a number is even? | A package for one job, next to `n % 2 === 0`. |
| No. It's one line: write it. | Answer: "Trivial code: write it yourself." |
| Keep dependencies few, / So write your own encryption? | A homemade `encrypt()` next to a maintained crypto library. |
| No: reuse the tested one. | Answer: "Hard to get right: reuse vetted code." It stays beside the previous card, so the contrast is visible. |
| Your pinned library / Gets a security fix? | `library==3.4.1` with a thumbtack, and an advisory: "Security fix in 3.4.2". |
| Update on purpose, then test. | Answer: "Pinned isn't frozen." |
| Your old date code now runs / For users in Europe? | `03/04/2026`: "March 4" to the old code, "3 April" to the new users. |
| Check if it assumes month first. | Answer: "Identify violated assumptions." |
| Two apps share a module, / And their needs drift apart? | Two apps point to one module; a change green for one is red for the other. |
| Version it, or clone and own. | Answer: "The systems evolve separately." |
| pytest runs the tests you wrote: / Library or framework? | pytest discovering and calling `test_single_one_creates_dragon_flame_event()` from the TDD tutorial. |
| Framework: it calls your code. | Answer: "It calls you: Hollywood Principle." |

### Final refrain and outro

The final refrain shows the checklist card with every case tab (see "Refrain
variations").

| Lyric | Picture |
| --- | --- |
| npm install left-pad? | The intro's unsent command, `$ npm install left-pad`, cursor waiting. |
| No need: padStart is built in. | The student deletes it and types `String(str).padStart(length, paddingCharacter)`. Label: "Eleven lines → one built-in (ES2017)". |
| That's reuse done right. | The casebook closes on the checklist card; every case tab shows a green check. |

## Quiz audit

| # | Question | Answer | What it checks | The tempting wrong answer |
| --- | --- | --- | --- | --- |
| 1 | A package just to check if a number is even? | No. It's one line: write it. | Avoid reusing trivial code (slide 16), carried from left-pad and isArray to a new one-liner. | "Yes: don't reinvent the wheel." One line saves less than a dependency costs. |
| 2 | Keep dependencies few, so write your own encryption? | No: reuse the tested one. | Where the rule stops (verse 4's boundary; Lecture 11). Questions 1 and 2 are a contrast pair. | "Yes: fewer dependencies is the rule." The overcorrection left-pad invites. |
| 3 | Your pinned library gets a security fix? | Update on purpose, then test. | Pinning and updating together (slides 10, 12, 18). | "No: pinned means we never update", or "auto-update everything", which loses the pin. |
| 4 | Your old date code now runs for users in Europe? | Check if it assumes month first. | Violated assumptions in your *own* reused code (slides 24–25), like Ariane's internal reuse. | "It's my code and it worked, so it's fine." Past success in one context is the Ariane trap. |
| 5 | Two apps share a module, and their needs drift apart? | Version it, or clone and own. | Systems that evolve separately (slides 27–28). | "Make both apps take every change." One module can't satisfy diverging requirements. |
| 6 | pytest runs the tests you wrote: library or framework? | Framework: it calls your code. | Library or framework, decided by who calls whom (slides 29–30), in a tool from the TDD tutorial. | "A library, because I installed it with pip." Installing doesn't decide it; the direction of calls does. |

Each question uses a principle from the song on a case the song never sang.
None can be answered by completing a rhyme. Question 2's answer is not in the
refrain's wording; it needs verse 4's boundary.

## How each section matches the sources

| Section and lyric | Lecture 12 slide | SEBook *Design with Reuse*, or another course source |
| --- | --- | --- |
| Intro: you don't have to write it all yourself | 3, 8 | "Why Reuse At All?" |
| V1: most code already out there, shared | 8 | "Why Reuse At All?" |
| V1: run in working systems, bugs found and repaired; less to write and test; ships sooner | 3 | "Why Reuse At All? The Benefits" |
| V1: not neat building blocks; assumptions; glue code | 4–5 | "The Vision vs. The Reality of Reuse" |
| Refrain: save/cost; assume; pull in; pin; update for patches | 10, 12, 16, 19, 25 | Principles 1, 2, 3, 5; cost-benefit |
| Refrain: external reuse is not a one-time investment | 18 | Principle 2 |
| V2: unchanged code; docker → requests → urllib3; unpinned; 2.0.0 changed the API; pin | 9–10 | Principle 1 (lockfile table includes `package-lock.json`) |
| V3: OpenSSL flaw, two years; trusted length; leaked memory, passwords, keys | 11 | Principle 2, Heartbleed |
| V3: didn't write it, shipped it | 11 | "You inherit the bug" |
| V3: fix within a week to all who update; one fix, shared by all | 11 (table) | Heartbleed table; "Why Reuse At All?" (update propagation) |
| V3: pinned isn't frozen; update, then test | 12, 18 | Principle 2 ("update intentionally … with a test suite") |
| V4: eleven lines; Babel and React through packages; unpublished; builds failed | 13–14 | "11 Lines That Broke the Internet"; Left-Pad Refactoring Lecture tutorial |
| V4: eslint-scope hijacked, stole tokens | 15–16 | Principle 3 (supply chain) |
| V4: trivial code; fewer dependencies; break, hijacked, vanish | 15–16 | Principle 3 |
| V4: hard to get right, like crypto | 3 (benefit) | Security chapter: "don't roll your own crypto" |
| V4: maintained and popular, but fit first | 17 | Principle 4 |
| Bridge: Ariane 4 → 5, 16-bit horizontal velocity, overflow, 37 s | 23–24 | "The Ariane 5 Disaster" |
| Bridge: identify violated assumptions; docs and code; built for; test | 24–25 | Principle 5 |
| Bridge: drift apart → version it or clone and own | 27–28 | (not in the chapter) |
| V5: who calls whom; axios, Express; Hollywood Principle; less code, harder to undo | 29–30 | "Libraries vs. Frameworks" |
| Quiz 6: pytest calls your tests | 29–30 | The TDD tutorial |
| Outro: `padStart` is built in | 16 | Left-Pad Refactoring Lecture, step 3 |

**Left out on purpose:** the lecture's second half on making design decisions
(its own topic), the python-constraint and icalendar exercise, internal-reuse
cost details, and NASA's flight-proven rule.

**Off the stage, kept here only:** Heartbleed's long tail (slide 11: in July 2019, 91,000 devices were still vulnerable), a good discussion prompt for why updates matter; Ariane's overflowing value precisely (a
horizontal-bias value derived from horizontal velocity, converted from a 64-bit
float to a 16-bit signed integer; SEBook), and Heartbleed's CVE number.

## Issues found in the sources

1. **Slide 13's left-pad code doesn't parse.** `ch || ch = ' ';` reads as
   `(ch || ch) = ' '`; `node --check` reports "SyntaxError: Invalid left-hand
   side in assignment". `ch || (ch = ' ');` parses and runs
   (`leftpad("5", 3, "0")` → `"005"`). The Left-Pad Refactoring Lecture
   tutorial's version also parses. The storyboard uses the tutorial's version.
2. **Heartbleed's start date differs.** Slide 11 says "Introduced in February
   2012"; the chapter says OpenSSL 1.0.1 shipped in March 2012. The song says
   "two years" and avoids the month.
3. **Ariane's timing is compressed.** Slide 23 has "$370M in 37s". ESA's press
   release puts the loss of guidance at 37 seconds after main-engine ignition
   (30 seconds after lift-off) and the breakup about 40 seconds after the
   flight sequence began; the chapter says about 39 seconds. "It veered, then
   self-destructed" fits all three.
4. **The chapter has no "evolve together or separately" section.** Slides 27–28
   cover it; the song includes it.
5. **The left-pad tutorial's step-1 table has a leftover name.**
   `_data/tutorials/leftpad-nodejs-lecture.yml` line 70 writes
   `… ch = ' '`; the code it explains (line 58) assigns
   `paddingCharacter = ' '`.

## Review record

**Truth.** Every line was back-translated to prose and checked against the
slides, the chapter, the left-pad tutorial, the security chapter, and the TDD
tutorial (table above). Lines that needed care:

- "So bugs were found and repaired" claims what the slide claims (tried in
  working systems, fewer defects), not that reused code is bug-free; verse 3
  is the counterexample.
- "No version had been pinned, so a clean install got two" is the mechanism
  slide 10's fix (`urllib3 = "<2.0.0"`) implies.
- "A request claimed a length; the server trusted it" is the over-read slide
  11 shows.
- "Many never saw it" keeps the slide's "many", not "most".
- "Stored horizontal speed in sixteen bits" simplifies the 64-bit-to-16-bit
  conversion; the precise form is kept above, off the stage.

**The refrain alone.** A student who keeps only the refrain believes: before
reusing, weigh savings against costs, check its assumptions and what it pulls
in, pin it but take security updates, and keep maintaining it. All true.

| Line | Most likely misreading | What steers it |
| --- | --- | --- |
| "Pin it, but update for patches" | They sound contradictory | Verse 3: "Pinned doesn't mean frozen"; quiz 3 |
| "What does it pull in?" | Fewer dependencies is always better | Verse 4's crypto boundary; quiz 2 |
| "Not a one-time investment" | Reuse means using code more than once | The line before it: pin, then update |

**Singability.** Counted with the CMU pronouncing dictionary: verse lines 5–8
syllables; every verse rhyming pair 14 or fewer. "Identify violated
assumptions" (11 syllables) is split over two lines to ask for two bars.

**Learning design.** One schema (what happened → why → principle) across five
cases; a stable checklist refrain; the boundary stated in the verse and tested
in a contrast pair; six transfer questions; a prediction before, written
answers during, a no-music exit ticket after, and a spaced quiz a week later.
None of it requires singing.

**Not done yet.** No audio has been generated; nobody has transcribed the sung
words without the sheet; no sophomore has used the song. This is a production
draft. Whether it helps learning remains a hypothesis: compare exit-ticket
answers on axios versus `fetch` before and after the song is introduced.

## The take

- **Words:** Whisper (mlx whisper-large-v3-turbo), run without the sheet as a
  prompt, heard every line; it misheard only names ("Babble and react",
  "Esslenscope", "URL lib3") and the spoken outro's "left-pad". The take's own
  timed-lyrics track gave each line's start.
- **Quiz pauses:** each answer follows its question with no instrumental bar,
  so `pause_at` sits in the 0.1–0.8 s quiet before the answer's first vocal
  onset on the Demucs vocal stem.
- **Tempo:** about 114.6 BPM (asked for 112), tracked with librosa.
- **Mix:** the channels stay within 0.5 dB of each other, so the soundtrack
  stays stereo; −15.6 LUFS was lowered 0.4 dB to −16 LUFS (true peak −3 dBFS).
- **Still to check by ear:** "its own memory" (Whisper heard "old") and the
  spoken outro.
