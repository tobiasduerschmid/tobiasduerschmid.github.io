# Design It In Before They Break In: a song about designing for security

Lyrics, Suno prompt, music-video storyboard, and a short class plan for a
CS 35L song on Lecture 11, *Security & Authentication*, and the SEBook
chapter [Security and Authentication](../SEBook/systems/security.md).
**Status: draft.** Nothing has been recorded or built. Planned slug:
`design_it_in` (storyboard `_data/songs/design_it_in.yml`, choreography
`js/song-video/songs/design_it_in.js`, embedded in the chapter).

## What the song teaches

**Audience.** CS 35L students, mostly sophomores. They write C++ from CS 31/32,
and in this course they have built pages with HTML, JavaScript, React, and
Node.js, met HTTP, and started a team web app. Lecture 11 is their first
security lecture, and for many of them its login example is their first SQL.
Their instinct is still a user's: they test that a feature works, not how it
can be misused.

**Function.** Review right after Lecture 11. It does not replace the lecture:
it reorganizes the lecture's pieces (the CIA triad, SQL injection, cross-site
scripting, three design principles, the security plan) around one procedure.

**Goal.** Given one feature of a web app, students can run the four-question
security plan on it and justify one protection per design principle:

- **Security Model:** name what the feature must protect and which CIA
  attribute each asset needs (only authorized users read it, only authorized
  users change it, it is there when needed);
- **Threat Model:** describe a plausible attacker (knowledge, actions,
  resources, incentive) and assume they know the design. **Open Design** puts
  the secret in a key, not in a hidden URL or in front-end code;
- **Attack Surface:** list every input that crosses the trust boundary and
  apply **Zero Trust**: any input might be malicious, so it stays data
  (prepared statements, escaped output) and is checked on the server;
- **Protection Mechanisms:** pick the mechanisms, and apply **Least
  Privilege** so that one compromised part reaches only what it needs.

**Transfer.** The six quiz questions are new cases from the projects
sophomores build: a React form, an API key in front-end code, an admin
database login. None repeats a verse example. The after-class task applies
the whole plan to a feature of their own project, with no music.

### Truth sheet

| Item | Verified statement | Source or check |
| --- | --- | --- |
| Core claim | Design security in by running the security plan's four questions; Open Design, Zero Trust, and Least Privilege answer the last three. | Slides 18, 20, 32, 35; SEBook "Security Design Principles", "Building a Security Plan" |
| Procedure | Security Model: what are you defending? Threat Model: who might be attacking, and what are they after (knowledge, actions, resources, incentive)? Attack Surface: which parts are exposed? Protection Mechanisms: how do you stop them? | Slides 32–33 |
| Why it works | Security that rests on a secret key survives attackers learning the design. Injection works only when input runs as code; a prepared statement and escaping keep it data. A compromised part can use only the rights it holds. | Slides 9, 19–21, 35–36; SEBook |
| Worked examples | `" or ""="` glued into the login query makes it true for every row: in SQLite the concatenated query returned all 3 test users and the parameterized query returned none. A `<script>` in a comment runs in every visitor's browser. An upload service with admin rights exposes every table; with write access to `/uploads` only, one folder. | Slides 7, 9, 13–15, 36; SQLite run for this draft |
| Boundaries | Hiding version numbers is a fine extra layer, never the foundation. In RSA the public key is public; the secret is the private key. Least privilege limits the damage of a break-in; it doesn't prevent the first one. | Slides 20–21, 23, 35–36 |
| Likely errors | "The React form checks it, so the server is safe." "Minified front-end code hides the key." "Stripping quotes stops SQL injection." "Admin rights, just in case." "Every breach is a data leak." | Quiz 1–6 |
| Music-free check | Run the four questions on one feature of your project and name one protection per principle. | Extends the exit ticket, slide 37 |

## How the song is built, and why

| # | Decision | Learning reason |
| --- | --- | --- |
| 1 | **The chorus is the security plan** (slide 32): the four questions with their names, in the lecture's order, sung the same way every time. | The plan is the one procedure students can run on any feature, which is the transfer goal. A repeated melody supports recall of its exact words (songcraft evidence note R01). |
| 2 | **Each verse works through one question, and a principle answers it.** Threat Model leads to Open Design ("What do they know? … Assume they've read your code"), Attack Surface to Zero Trust ("Every input they can send"), Protection Mechanisms to Least Privilege ("a plan for when one breaks"). | Students learn *when* each principle applies, not just its definition. The order also follows an attack: what they want, what they know, where they get in, how far they get once inside. |
| 3 | **Every verse has the same shape: the break-in, why it worked, the principle,** ending on a two-line principle tag in fixed words. | A worked example with a repeated schema (A for novices); students learn where to look and can compare cases. It reuses the lecture's own prompts, "How can we break into this system?" (slide 7) and "How could we try to attack this website?" (slide 12). |
| 4 | **Two named attacks, taught separately, then one mistake.** Each attack is demonstrated, named ("That's S-Q-L injection.", "That's cross-site scripting."), and fixed in its own part of verse 3, in its own section of the sheet. Only then does the verse join them: they look different (database, browser) and share one cause: "My input ran as code." | Different-looking cases that share a principle support transfer (A/B). It is the SEBook's own framing: data treated as code. |
| 5 | **The final chorus pairs each question with its principle tag.** The earlier choruses sing only the questions. | Introduce the parts one at a time, then integrate them. The plan form on screen is completed at the same moment. |
| 6 | **Boundaries are sung where the rule is sung:** "Hiding versions helps a little, / But never on its own"; "The only secret is the key." The quiz then tests the boundary with a contrast pair (an API key versus a version number). | Without the boundary, Open Design invites two overcorrections: "publish everything" and "never hide anything". |
| 7 | **The singer is a tester you hired to break in** ("You hired me to break in first"). In the quiz, the student becomes the tester. | Threat modeling is perspective-taking. The frame makes the attacker's view legitimate and professional, keeps the developer in charge, and avoids fear appeals: challenge, not threat. |
| 8 | **The examples come from sophomores' own projects:** a React front end, secrets in front-end code, a form that validates, an admin database login. | Utility value (B), and these are the mistakes most likely to reach a CS 35L project. |
| 9 | **One real case, the 2026 Hugging Face incident, is the bridge.** | It is the lecture's opening case (slide 4) and the chapter's case study. All three principles fail together in it, and "Who'd have planned for that?" makes the threat-model point: attackers nobody expected. |
| 10 | **Left out:** cryptography internals, digital signatures, session cookies versus JSON Web Tokens, `HttpOnly`, the statistics, and the Sony, MOVEit, Twitter, and British Airways details. | One song, one outcome. Authentication would make a good companion song. |

### Structure

| Section | Job |
| --- | --- |
| Intro (spoken) | The frame: you hired a tester to break in first; design security in before attackers try. |
| Verse 1 | Security Model: what you defend, the CIA triad, and the three ways attackers hit it (read, change, lock out). |
| Chorus (×2) | The security plan: four named questions, the same melody every time. |
| Verse 2 | Threat Model → Open Design: the key in the flowerpot, public tested locks, the key stays secret; hiding version numbers as the boundary. |
| Verse 3 | Attack Surface → Zero Trust: the trust boundary; then SQL injection and its fix; then, as a separate part, cross-site scripting and its fix; then the mistake they share. |
| Verse 4 | Protection Mechanisms → Least Privilege: one admin key versus one key per part; the blast radius. |
| Bridge | The 2026 Hugging Face incident: every step crossed a line where one part trusted another. Then its lessons: scan for leaked secrets, short-lived tokens, sandboxed parsing without credentials, no shared admin key, monitoring for machine-speed activity. |
| Quiz | Six new cases. The player pauses after each question; then the singer answers. |
| Final chorus | Each question, now followed by the principle that answers it. |
| Outro (spoken) | Run the four questions on your own project; keep the key with you. |

### Fit for CS 35L sophomores

These choices come from a pedagogical review aimed at sophomores. The evidence
grades are the pedagogical-advisor skill's editorial ratings for each claim.

| Choice | Why it fits sophomores | Evidence |
| --- | --- | --- |
| One plan question per verse and one new principle per verse; the threat-model dimensions sung as questions while their names appear on screen | Security is new to them: explicit structure and few new terms at a time. | Segmenting and signaling: A/B |
| The same break-in → why → principle shape in every verse | Novices learn more from studying worked solutions than from solving unaided. | Worked examples for novices: A |
| SQL injection beside cross-site scripting; an API key beside a version number | Shows what stays the same and what decides the answer. | Designing for transfer with contrasting cases: A/B |
| Six open quiz questions on new cases, answered in writing at each pause; a no-music task afterward; the SE Gym quiz a week later | Retrieval, not replay, builds retention, and the delayed quiz checks it without the melody. | Retrieval practice: A; spacing: A; interleaving: B |
| Their own stack and their own project | Relevance they can use the same week. | Utility value: B |
| A confident, playful frame; attacks shown on a design, never on a student's mistake | Challenge without threat; nobody is shamed. | Motivation guidance, not an effect estimate |
| Captions, a transcript, and written answers | Nobody has to sing, or hear the song, to take part. | Accessibility requirement |

The overall structure, the plan's questions as the spine with the principles
as their answers, is original design synthesis, not a tested intervention.
Songs have conditional evidence for recall of exact verbal material and none
for security-design skill, which is why the quiz and the after-class task
carry the application.

### Where the house metaphor stops

The video draws your app as a house, after the lecture's own picture of the key
in the flowerpot (slide 19). The lyrics stay in software terms; locks and keys
are the only house words they use.

- **Burglars steal; attackers also change things and lock you out.** Verse 1
  says so: "They might read it, change it, / Or lock you out for ransom."
- **A house has outer walls; Zero Trust says not to rely on them.** The
  storyboard locks every inner door and moves the trust boundary from the whole
  company network to the server, leaving the boss's laptop outside.
- **A note pushed through the mail slot can't open the door; input can become
  code.** That is why verse 3 shows the real query and the real HTML, not
  doors.
- **"Locks" means protection mechanisms and "the key" means a secret key or
  credential.** In RSA the public key is public; the visual labels the secret
  as "secret key (AES) · private key (RSA)".

If students ask how this squares with *Every Module Keeps a Secret*:
information hiding hides design decisions from other modules so changes stay
local; Open Design says security must not depend on attackers not knowing
those decisions.

## Genre: upbeat desert-western rock

**Choice:** upbeat desert-western rock with a spaghetti-western twist: about
124 BPM, galloping train-beat drums, a twangy guitar riff that answers
each sung line, a whistled hook, a light cinematic layer underneath (a
low-string ostinato and timpani), a lonely trumpet before each chorus, and
a softer, warm half-time bridge. One cool, charismatic, light male tenor, smooth and calm with a slight, playful edge, sings throughout, as the clearest
thing in the mix. It is cowboy-core guitar music, not chart pop
or country-pop.

Why it fits this topic and these students:

1. **Western is current for Gen Z without being pure pop.** Cowboy-core and
   western sounds crossed into the mainstream through the mid-2020s, from
   country-rap crossovers to desert-western rock, so the style reads as
   theirs, not as a teacher's pastiche.
2. **The Western's story is a security story.** A stranger rides into town
   and nobody knows whether to trust them; a gang cases the bank; the town has
   too many ways in. That is the threat model, the attack surface, and Zero
   Trust. The genre carries the mood, while the lyrics stay about software.
3. **The riff answers each line.** The twang fills the gap after every sung
   line, which gives dense technical lines room to breathe. Earlier takes
   rushed exactly where lines ran back to back.
4. **It has built-in surprises.** The whistled hook, the low-string ostinato, the trumpet that
   announces each chorus, the gallop, and the softer bridge for the true story
   keep the energy moving, and the trumpet call spotlights the plan's first
   question every time.
5. **It is new in the playlist and distinct from the folk song.** Electric
   twang and a gallop, with no banjo, fiddle, or handclaps (excluded in the
   prompt), keep it apart from the indie folk of *Not a One-Time Investment*.

**Earlier ideas:** a blues shuffle and dance-punk indie rock were workable; western won for its story and its appeal to Gen Z. A spy-jazz heist caper was rejected. The heist story maps neatly onto
the plan (the vault, the crew, the ways in, the guards), but *Every Module
Keeps a Secret* already owns that world: a spy-noir operations room, case files,
vaults, and a corkboard with string. Two spy songs would blur in the playlist.
Worse, they would put "every module keeps a secret" and Open Design's "don't
rely on secrets" in the same picture, which invites students to conflate them.

| Also considered | Why not |
| --- | --- |
| Synthwave or "hacker" electronica | Glamorizes the attacker and the hooded-hacker cliché; dense synths mask words. |
| Punk ("trust no one") | Shouting; pop-punk is already *Invest in Your Stories*, and shouted takes felt unsettling. |
| Country-pop | Close to the indie folk of *Not a One-Time Investment* (banjo, handclaps). |
| Hip-hop | Already used twice; dense flow is what made earlier verses too fast. |

## Lyric sheet (Suno-ready)

- **Format:** one line per bar (the style prompt says so once, so the section tags stay short). Verse lines are 5–9 syllables, and every
  consecutive pair is 14 syllables or fewer; the two 9-syllable lines each sit
  beside a 5-syllable line.
- **Length:** 4,969 characters, under Suno's 5,000-character limit.
- **Respellings** (C-I-Ay, Ay-P-I, Ay-I, S-Q-L) are for Suno only. Captions
  use normal spelling.
- **A dash after each term** ("Security Model- what are you defending?"),
  because Suno dropped title-only lines and colon cues in earlier takes and
  sang dashed term phrases. Captions use a colon.
- **Quiz pauses:** Suno ignores pause and break tags, so the player's
  `pause_at` supplies the thinking pause after each question.

```text
[Intro: spoken, cool and clear, over a whistled melody and gallop]
So, you built a web app.
Somebody out there might try to break in.
You hired me to break in first.
Let's design security in, before they do.

[Verse 1: upbeat gallop, sung, guitar answers]
Before you choose the locks,
Ask what's in the box:
What are you defending?
The data users are sending,
Passwords, posts, and photos,
And the site that must stay up.
Confidentiality means
Only those allowed may read;
Integrity means
Only those allowed may change;
Availability means
It's there when it is needed.
That's the C-I-Ay triad.
Attackers can hit all three:
They might read it, change it,
Or lock you out for ransom.

[Chorus: trumpet call, then full band, same every time]
Design it in before they break in:
Security Model- what are you defending?
Threat Model- who might be attacking?
Attack Surface- which parts are exposed?
Protection Mechanisms- how do you stop them?
Design it in before they break in.

[Verse 2: cool and amused, sung, guitar answers]
Who might be attacking,
And what are they after?
What do they know? What can they do?
What will they spend, and why?
Assume they've read your code:
Then a key in the flowerpot,
A secret admin link,
Is found in just a blink.
Security through obscurity
Lasts till someone looks.
Use locks the world has tested,
Their blueprints out on view:
The only secret is the key,
And the key stays with you.
Hiding versions helps a little,
But never on its own.
Open Design- knowing how it works
Shouldn't get them in.

[Verse 3: playful, sung, one line per bar, guitar answers]
Which parts are exposed?
Every input they can send.
Trust nothing by default,
Not even the boss's laptop.
In your password box,
I typed code that's always true;
You glued it in your query,
And the login let me through.
That's S-Q-L injection.
Use a prepared statement:
My input fills a slot
And stays data, not code.

[Verse 3, part two: sung, guitar answers]
Then I hid a script
In a comment that I wrote;
Each browser ran it as yours
And sent me what it stole.
That's cross-site scripting.
Escape what you display:
My script shows up as text,
Not code the browser runs.
Two attacks, one mistake:
My input ran as code.
Zero Trust- any input
Might be malicious.

[Chorus: trumpet call, then full band, same every time]
Design it in before they break in:
Security Model- what are you defending?
Threat Model- who might be attacking?
Attack Surface- which parts are exposed?
Protection Mechanisms- how do you stop them?
Design it in before they break in.

[Verse 4: steady and confident, sung]
How do you stop them?
With every lock you've got,
And a plan for when one breaks:
Limit what one break-in takes.
Say uploads run as admin,
And I break in through that page:
Every table, every row
Is mine to read and change.
So give each part its own key
With just the rights it needs:
Display can only read,
Uploads can only write.
Now break in through the uploads:
One folder, that is all.
The Users table stays locked;
The blast radius stays small.
Least Privilege- each part gets
Only what it needs.

[Bridge: half-time, softer, warm, telling a true story]
In twenty twenty-six,
Ay-I agents in a test
Broke out to cheat on it.
Who'd have planned for that?
Found tokens left in public,
Sent data that ran as code,
And one shared admin key
Opened whole clusters.
Every step crossed a line
Where one part trusted another.

[Bridge, part two: the lessons, building back up]
What did it teach?
Hunt down leaked secrets,
Let tokens expire fast,
Parse strange files in a sandbox
With no keys worth taking,
No shared key with admin rights,
And watch for machine-speed moves,
So one slip won't open all.

[Quiz: playful, asks each question, then sings its answer]
Pop quiz: now you're the tester,
So think the way they do.
Grades were changed, but nothing leaked:
Which attribute broke?
That's integrity:
An unauthorized change.
An Ay-P-I key, hidden
In your front-end code?
They can read it:
Keep it on the server.
Hide the version number
On your error page?
Sure, as an extra layer,
Never on its own.
Your React form checks the input:
Is the server safe?
No: they can skip the form.
Check it on the server.
Your app logs in as admin,
Just in case?
Only what it needs,
So a break-in stays small.
Strip out every quote
To stop S-Q-L injection?
That's not enough:
Use a prepared statement.

[Final Chorus: full band, confident, same melody]
Design it in before they break in:
Security Model- what are you defending?
Threat Model- who might be attacking?
Open Design- knowing how it works
Shouldn't get them in.
Attack Surface- which parts are exposed?
Zero Trust- any input
Might be malicious.
Protection Mechanisms- how do you stop them?
Least Privilege- each part gets
Only what it needs.
Design it in before they break in.

[Outro: spoken, over the gallop]
Now run those four questions on your own project.
And that key in the flowerpot? Keep it with you.
That's security, designed in.
[End]
```

### Suno style prompt

**Style of Music** (full, 992 characters):

```text
Desert-western rock with a cinematic edge, about 124 BPM, 4/4, upbeat and cool with a hint of danger. Sparse verses: galloping drums, bass, and a twangy guitar that plays only in the gaps between sung lines; light low strings and timpani join in the chorus only. Whistled hook in the intro, a trumpet call before each chorus. One singer throughout: a cool, charismatic, light male tenor, calm with a slight edge. Vocal clarity comes first: one lead voice, loud, dry, centered and close-miked, no doubling, no harmonies, no echo; every consonant enunciated, relaxed pace, never slurred, no grit, no shouting, no ad-libs. Nothing plays a melody under the words. Verses are sung on a steady melody, one lyric line per bar, with a breath after each line; never rapped, never rushed. The chorus is a big, singable hook that returns unchanged. Every key term lands clearly on a downbeat: Security Model, Threat Model, Attack Surface, Protection Mechanisms, Open Design, Zero Trust, Least Privilege.
```

**Style of Music** (short, 170 characters, for a field limited to about 200):

```text
sparse desert-western rock, 124 BPM, galloping drums, twangy guitar between lines, light male tenor, loud dry centered vocal, every word enunciated, no harmonies, no echo
```

**Exclude Styles:**

```text
horror, villain, growl, raspy, mumbled, slurred, vocal doubling, harmonies, echo, heavy reverb, deep voice, baritone, bass voice, falsetto, choir, pure pop, country-pop, banjo, fiddle, EDM, rap, shouting, gang vocals, ad-libs, ballad, duet, female vocal, autotune
```

Suno has ignored tempo requests before (Draw It Out asked for 134 BPM and
played about 120). Judge a take by syllables per second, not by its BPM, and
keep one whose verses stay near 3–4 syllables per second. The instrumental
riff should land *between* sung lines; if the guitar or trumpet plays over the
words, or Suno drifts into banjo-and-fiddle country-pop or a slow ballad,
generate again rather than fixing it in the mix. The orchestral layer and the trumpet
call are requests Suno may ignore; they are a bonus, not a requirement.

### Pronunciation and take checks

| Sheet | Sung as | Captions |
| --- | --- | --- |
| C-I-Ay | "see-eye-ay" | CIA |
| Ay-P-I | "ay-pee-eye" | API |
| Ay-I | "ay-eye" | AI |
| S-Q-L injection | "ess-cue-ell in-JEK-shun", the letters, not "sequel" | SQL injection |
| cross-site scripting | "KROSS-site SKRIPT-ing"; never the letters X-S-S | cross-site scripting |
| twenty twenty-six | "twenty twenty-six" | 2026 |
| Security Model- … | the term, then the question | Security Model: … |
| malicious, obscurity, privilege | "muh-LISH-us", "ob-SKYOOR-ih-tee", "PRIV-uh-lij" | unchanged |

Check every take for these:

- **The chorus is identical both times, and the final chorus keeps the same
  words.** The chorus is the retrieval cue; a changed word needs a section
  replace.
- **Both attack names are sung in full,** as written: "That's S-Q-L injection" (the three letters, not "sequel") and "That's cross-site scripting" (not "X-S-S"). Also check "script" and "scripting" are not swapped in that part.
- **All seven term phrases are sung:** Security Model, Threat Model, Attack
  Surface, Protection Mechanisms, Open Design, Zero Trust, Least Privilege.
- **Negations survive:** "Shouldn't get them in" (a lost "n't" reverses Open
  Design), "Trust nothing by default", "Not even the boss's laptop", "Never on
  its own" (twice), "That's not enough", "No: they can skip the form".
- **No swapped pairs:** "Security Model" and "Threat Model" in adjacent chorus
  lines; "Display can only read" and "Uploads can only write"; "read it,
  change it".
- **Every quiz answer is sung,** after its question and by the same voice
  (Draw It Out take 6 skipped one).
- **No added fillers:** western singers add "whoa" and "yeehaw"; caption any
  extra words as sung, or replace that section.
- **Balance:** measure the left-right balance per section, and merge to mono if
  it wanders.

## Using it with sophomores

This sequence is original design synthesis, not a tested intervention; times
are planning estimates. Everything works with written answers, so nobody has
to sing.

1. **Before the video (1 minute).** Ask: "An attacker has a copy of your app's
   entire source code. Can your app still be secure?" Each student writes yes
   or no and one reason.
   - *Expected:* "Yes, if its security rests on secrets that aren't in the
     code, like keys and passwords, and the code handles input safely."
   - *Likely wrong answer:* "No: once they see the code, they can get in."
   - Don't resolve it yet; verse 2 does.
2. **During (about 5 minutes).** Play the video. At each quiz pause, students
   write a three-to-five-word answer before the singer gives it. Afterward,
   ask for a show of hands on questions 2 and 3, the API key and the version
   number. Students who answered both the same way are applying "hide
   everything" or "hide nothing"; point them back to "The only secret is the
   key" and "Never on its own."
3. **After, without the music (5 minutes).** Extend the lecture's exit ticket:
   pick one feature of your course project, run the four questions on it, and
   name one protection for each principle.

   A strong answer for a direct-messages feature:

   > **Security Model:** messages readable only by the two people in the
   > conversation (confidentiality), changeable only by their sender
   > (integrity), and an inbox that loads when needed (availability).
   > **Threat Model:** another logged-in user who wants to read other people's
   > messages; they know our API from the front-end code, can send any
   > request, need only a browser, and are curious or want to harass someone.
   > **Attack Surface:** the send-message endpoint, the message text, the
   > conversation ID in the URL, and the page that displays messages.
   > **Protection Mechanisms:** *Zero Trust:* the server checks that the
   > logged-in user belongs to the conversation, whatever ID the request
   > carries, and escapes message text when it displays it. *Open Design:*
   > that check relies on the session, not on conversation IDs being hard to
   > guess. *Least Privilege:* the messaging service's database account can
   > read and write only the messages table.

   | Weak answer | What it misses |
   | --- | --- |
   | "We use HTTPS, so it's secure." | HTTPS protects messages in transit. It doesn't stop a logged-in user from requesting someone else's conversation. |
   | "The React app only shows your own conversations." | The browser is outside the trust boundary; the server must check. |
   | "Conversation IDs are random, so nobody can guess them." | Obscurity: IDs leak through URLs, logs, and shared links. |
   | "Nobody would attack a class project." | The threat model asks who *might*: another student with a browser is enough. |

   Next class, show two or three anonymized answers next to the completed plan
   form from the video.
4. **A week later.** Assign the SE Gym security quiz and flashcards
   (`_data/quizzes/security.yml`, `_data/flashcards/security.yml`). Their
   wording differs from the song's, so they check retrieval without the melody
   as a cue.

## Music video storyboard

### The world: your app as a house

Golden hour at a ranch house on the edge of a desert town: sandstone, sage, and
a long sunset. Your app is drawn as a cutaway of the house, the lecture's
flowerpot house moved west: each room is part of the app, with its real
label. The front door is the login form, the porch noticeboard is the comment
section, the barn is the photo upload, the home office is the admin page,
and the database sits in the office as the lecture's database cylinder. Every
door and window that takes something from outside is an input.

The plan is the **tester's Security Plan form** on a clipboard: a crisp,
professional form with a header band and four numbered sections, **Security
Model**, **Threat Model**, **Attack Surface**, and **Protection Mechanisms**,
each with its question. Each verse opens on its section; when the verse ends,
its answer is stamped into the section (no stamp shake): the CIA triangle,
then **Open Design**, **Zero Trust**, and **Least Privilege**. By the final
chorus the form is complete, a one-screen summary students can screenshot.

One color per meaning, the same in every scene and always paired with a label
or icon: teal for your app's parts; amber for the attacker's input and the path
it takes; brass for keys and credentials; red only for what breaks, never
full-frame; green for a fix that holds; cream paper and dark ink for the plan
form. Only low-contrast things move in the background (heat shimmer, a
drifting tumbleweed, the light shifting), so nothing pulls the eye from the content.

### Cast

- **The tester** is the singer, a man because a male voice sings the role.
  He wears a denim jacket, boots, and a flat-brimmed hat, and carries a
  saddlebag with lock picks and a laptop, a big brass key ring, and a
  rectangular brass badge reading "AUTHORIZED TESTER" (not a sheriff's star).
  No guns and no shootouts: his tools are keys and a laptop. He looks the
  same in every scene and acts on the content: fills in the form, traces the
  amber path, lifts the flowerpot, types the payloads, hands back the key. He
  is not the viewer's hero.
- **The developer** is "you": the viewer's saved SE Gym hero in a unisex
  outfit, the owner of the app and the house. The developer never sings, and
  fixes what the tester finds: switches to a prepared statement, moves the
  trust boundary, hands out one key per part. In the quiz the developer takes
  the badge.
- **Real attackers ("they")** have no faces and no hoodies: a gloved-hand
  cursor in the demos, and the 2026 AI agents as small numbered hexagon tokens
  labeled "agent".

### Visual rules for this song

- **One thing to look at per line,** and **the state the line sings, not a
  later one:** the query assembles when "You glued it in your query" is sung,
  not before.
- **Real artifacts from the slides:** slide 7's login form and concatenation
  code, slide 9's prepared statement, slides 12–14's post and comment, slide
  18's trust-boundary diagram, slide 19's flowerpot, and slide 36's four
  services with their permissions. Fix slide 13's payload to
  `alert("USC IS BETTER!!!")` (see "Issues found in the sources"). Keep the
  post's text, but replace the colleagues named on the slide with neutral
  names unless you want them in a public video.
- **Highlighted code** in the shared `.code-tok--*` palette. SongKit has only
  `highlightPython`; the SQL, HTML, and JavaScript cards need shared tokenizers
  in `kit.js`, not a per-kit copy.
- **Flash safety (WCAG 2.3.1):** no strobing alarms; an alarm is a slow amber
  glow on one object; light changes fade over at least half a second; no
  camera shakes or long slides in text scenes. Run
  `node scripts/song-video/render.js design_it_in --check-flashes` and read its
  own `check-flashes:` line; don't pipe it through `tail`.
- **Readable text:** at least 12 px on the 960 px stage; each label holds for
  at least max(1.5 s, 0.6 s + words ÷ 3); labels sit on or next to what they
  name; no orphan words; everything stays inside its frame, and no readable
  overlaps another (audit every 0.1 s). The form's dark ink on cream keeps AA
  contrast.
- **Quiz cards** use the shared `.quiz-card` UI; each answer appears as it is
  sung, and a question card never shows its answer's artifact (question 4's
  `curl` request arrives with the answer).
- **Nothing from the spy world:** no case files, vaults, corkboards, or
  string, which belong to *Every Module Keeps a Secret*.
- **No logos:** Hugging Face, OpenAI, React, and Express appear as text labels
  only. For the bridge, reuse the component vocabulary of the chapter's Hugging
  Face narration (`_data/narration_visuals/huggingface2026.json`) so the two
  tell the incident the same way.
- **Captions and transcript** use normal spelling; each section's `narration`
  for the audio-described track is written once the art exists.

### Scenes at a glance

| Section | Plan form | Scene | Story |
| --- | --- | --- | --- |
| Intro | Blank form | The house at golden hour | The tester is hired to break in first |
| Verse 1 | Security Model | The house's valuables; slide 3's CIA cards | What you defend; read, change, lock out |
| Chorus | All four sections | The form | The plan |
| Verse 2 | Threat Model | The flowerpot; developer tools; three public locks | Assume they've read your code; only the key is secret |
| Verse 3 | Attack Surface | Doors and windows; slide 18's network; the login form; then the post | Every input; SQL injection and its fix; cross-site scripting and its fix; one shared mistake |
| Chorus | + Open Design, Zero Trust | The form | The plan, two answers stamped |
| Verse 4 | Protection Mechanisms | Slide 36's four services; one key, then four | One break-in, one folder |
| Bridge | A frontier gazette | The Hugging Face 2026 path | Every step crossed a trusted line |
| Quiz | Quiz cards | The developer as tester | Six new cases |
| Final chorus | The completed form | The form | Each question with its principle |
| Outro | Your own blank form | The house at dusk | Run it on your project |

### Intro and verse 1

| Lyric | Picture |
| --- | --- |
| So, you built a web app. | Golden hour at the edge of a desert town; the camera rides up to the developer's ranch house. Through the window, the laptop shows a course-project-style social app: the lecture's post "UCLA students are by far the best students. Go Bruins!", a comment box, and a login form. |
| Somebody out there might try to break in. | A faint amber cursor drifts down the dusty road toward the front door. |
| You hired me to break in first. | The tester walks up the path and clips on his badge: "AUTHORIZED TESTER". |
| Let's design security in, before they do. | He shows the developer his clipboard, the blank Security Plan form with its four sections. Title: "Design It In Before They Break In". |
| Before you choose the locks, | A tray of padlocks on the porch table; he slides it aside. |
| Ask what's in the box: | He opens a jewelry box labeled "your app". The form's Security Model section lights. |
| What are you defending? | Inside the box: empty slots labeled "assets". |
| The data users are sending, | Items drop in one by one: |
| Passwords, posts, and photos, | a password field (•••••), a post, a profile photo, |
| And the site that must stay up. | and the house's porch light, labeled "site: up". |
| Confidentiality means / Only those allowed may read; | Slide 3's Confidentiality card beside the password: an eye icon, "read: authorized users only". |
| Integrity means / Only those allowed may change; | The Integrity card beside the post: a pencil icon, "change: authorized users only". |
| Availability means / It's there when it is needed. | The Availability card beside the porch light: a clock icon, "available when needed". |
| That's the C-I-Ay triad. | The three cards form a triangle labeled "CIA triad". |
| Attackers can hit all three: | Three amber arrows aim at its corners. |
| They might read it, change it, | Read: a card at C, "Equifax 2017: personal data of about 147 million people taken". Change: the post's text is overwritten with "USC IS BETTER!!!" at I. |
| Or lock you out for ransom. | A ransom note covers the server: slide 5's "Hollywood Presbyterian Medical Center, 2016", with two badges, "Availability" and "Integrity". The triangle is stamped into the Security Model section. |

### Chorus

The plan form fills the frame. Each line lights its section, with the term in
bold above the question, so the song's words and the exam's words appear
together.

| Lyric | Picture |
| --- | --- |
| Design it in before they break in: | The form; the hook line inks itself across the header band. |
| Security Model: what are you defending? | Section 1 lights. |
| Threat Model: who might be attacking? | Section 2 lights. |
| Attack Surface: which parts are exposed? | Section 3 lights. |
| Protection Mechanisms: how do you stop them? | Section 4 lights. |
| Design it in before they break in. | The tester taps the form; the developer nods. |

**Chorus variations.** The first chorus shows only the CIA triangle in section
1. The second also shows Open Design in section 2 and Zero Trust in section 3.
The final chorus shows all three principles (see below).

### Verse 2: Threat Model → Open Design

| Lyric | Picture |
| --- | --- |
| Who might be attacking, / And what are they after? | The Threat Model section opens into four tabs (slide 33). |
| What do they know? What can they do? | Tabs "Knowledge" and "Actions" open as their questions are sung. |
| What will they spend, and why? | Tabs "Resources" and "Incentive". |
| Assume they've read your code: | The Knowledge tab fills in: "has read your code". The laptop opens the browser's developer tools on the app's front-end bundle. |
| Then a key in the flowerpot, | Slide 19's flowerpot by the front door, a key under it. |
| A secret admin link, | In the bundle, a search for "admin" highlights a route: `path: "/admin-x7q"`. |
| Is found in just a blink. | The tester lifts the flowerpot: the key is there. On the laptop, the admin page opens with no login. |
| Security through obscurity / Lasts till someone looks. | Lettered: "Security through obscurity", with slide 19's weakness: "Implementation details can be discovered." |
| Use locks the world has tested, | Three padlocks on the porch table, labeled AES, RSA, and TLS. |
| Their blueprints out on view: | Each lock's published specification unfolds beside it, stamped "public standard", its margins full of reviewers' notes (slide 20: "Public scrutiny"). |
| The only secret is the key, | A brass key tagged "secret key (AES) · private key (RSA)". |
| And the key stays with you. | The tester hands the key to the developer, who pockets it. The admin route now sits behind a login check. |
| Hiding versions helps a little, | An error page reading "Express 4.17.1" gets its version blacked out. Label: "Complementary obscurity". |
| But never on its own. | Side by side: the blacked-out version alone (✗), and the blacked-out version plus the login check (✓). |
| Open Design: knowing how it works / Shouldn't get them in. | Open Design is stamped into the Threat Model section. |

### Verse 3: Attack Surface → Zero Trust

| Lyric | Picture |
| --- | --- |
| Which parts are exposed? | The Attack Surface section opens on the house: every door and window that takes input glows, each labeled: login form, comment box, photo upload, URL. |
| Every input they can send. | An amber arrow at each one. |
| Trust nothing by default, | Slide 18's diagram: Internet, User, Company Network (Boss's laptop, Developer's device), Server, Database, with a dashed trust boundary around the whole company network. |
| Not even the boss's laptop. | The boundary shrinks to the server alone; the boss's laptop is now outside, and a checkpoint appears on its arrow. Label: "Not trusted by default". |
| In your password box, | Slide 7's login form; Username: "Bruin". |
| I typed code that's always true; | The password field types `" or ""="`. |
| You glued it in your query, | Slide 7's code with `+ pass +` highlighted; the query assembles: `… AND Pass = "" or ""=""`, and `""=""` is labeled "always true". |
| And the login let me through. | "Logged in"; the amber path runs from the password box into the server. |
| That's SQL injection. | The attack's name lands on the query: "SQL injection (SQLi)", slide 7's title. |
| Use a prepared statement: | Slide 9's code: `WHERE Name = @0 AND Pass = @1` and `db.execute_query(sql, name, pass)`. |
| My input fills a slot | `" or ""="` drops into the `@1` slot as a boxed string tagged "data". |
| And stays data, not code. | The login answers "Wrong password"; the amber path stops at the slot. |
| Then I hid a script | A clean break to a new scene: slide 12's post; the comment box types `<script>alert("USC IS BETTER!!!")</script>`. |
| In a comment that I wrote; | The comment posts; the count becomes "6 comments". |
| Each browser ran it as yours | Three visitors' browsers load the post; each shows the alert inside the trusted site's frame (slide 14). |
| And sent me what it stole. | From each browser, a cookie icon labeled "session" flies to the tester's laptop (slide 15: "Send sensitive data"). |
| That's cross-site scripting. | The attack's name lands on the post: "Cross-site scripting (XSS)", slide 13's title. |
| Escape what you display: | The comment's HTML source shows `&lt;script&gt;…`. Label: "Output encoding". |
| My script shows up as text, | The page shows the comment as plain text, `<script>alert("USC IS BETTER!!!")</script>`, |
| Not code the browser runs. | and no alert appears in any of the three browsers. |
| Two attacks, one mistake: | Split screen: the SQL injection query and the cross-site scripting page, each with its name above it and the attacker's text highlighted amber. |
| My input ran as code. | One label spans both: "Input ran as code". |
| Zero Trust: any input / Might be malicious. | Zero Trust is stamped into the Attack Surface section. |

### Verse 4: Protection Mechanisms → Least Privilege

| Lyric | Picture |
| --- | --- |
| How do you stop them? | The Protection Mechanisms section opens. |
| With every lock you've got, | The locks so far line up on it: prepared statement, output encoding, tested locks with secret keys, the login check. |
| And a plan for when one breaks: | One lock springs open (slowly; no flash). |
| Limit what one break-in takes. | A dashed circle labeled "blast radius" appears around it. |
| Say uploads run as admin, | Slide 36's four services (Product Display, Email Notification, System Backup, Image Upload) as rooms of the house, all opened by one brass master key labeled "admin". |
| And I break in through that page: | The amber path enters through Image Upload, the barn. |
| Every table, every row | The master key opens the database: tables Users, Products, Orders. |
| Is mine to read and change. | An eye badge and a pencil badge land on every table; the blast-radius circle covers the whole house. |
| So give each part its own key | The master key splits into four keys. |
| With just the rights it needs: | Each key's tag shows its permission, from slide 36's notes. |
| Display can only read, | Product Display: "read-only: Products table". |
| Uploads can only write. | Image Upload: "write: /uploads only, no delete". Email Notification ("email API only, no database") and System Backup ("read-only; writes only to backup storage") get their keys at the same moment, shown but not sung. |
| Now break in through the uploads: | The amber path enters through the barn again. |
| One folder, that is all. | It stops at the `/uploads` folder. |
| The Users table stays locked; | The Users table holds: "no access". |
| The blast radius stays small. | The circle shrinks to the barn alone. Slide 36: "If an attacker compromises one component, the impact is reduced." |
| Least Privilege: each part gets / Only what it needs. | Least Privilege is stamped into the Protection Mechanisms section. |

### Bridge: Hugging Face, 2026

The band drops to half-time, and so does the picture: muted colors and slow
moves, because this one is a true story. A frontier-style gazette lies on the porch
table; each fact appears on its diagram as it is sung, one hop at a time, left
to right.

| Lyric | Picture |
| --- | --- |
| In twenty twenty-six, | The gazette, dated July 2026: "AI agents break into a model-hosting site", with a byline "as reported by Hugging Face and OpenAI". |
| AI agents in a test | A box labeled "hacking benchmark (sandbox)" full of small hexagon agent tokens. |
| Broke out to cheat on it. | Tokens slip out through a gap labeled "package proxy". Note: "goal: find the benchmark's answers". |
| Who'd have planned for that? | The form's Threat Model section slides in with "AI agents?" written under "Who might be attacking?" |
| Found tokens left in public, | A public dataset page with access tokens in it, blurred. |
| Sent data that ran as code, | A crafted dataset enters a "dataset worker", and the worker runs the agents' code, in amber. Label: "unsafe parsing ran their code". |
| And one shared admin key | One brass key tagged "shared, admin rights (Hugging Face's account)". |
| Opened whole clusters. | It opens two boxes labeled "cluster (a group of servers)". |
| Every step crossed a line | The whole path, with a dashed trust boundary between every hop; each crossing glows amber in turn, slowly. |
| Where one part trusted another. | A label at each crossing: "trusted the proxy", "trusted a leaked token", "trusted the uploaded file", "trusted a shared key". |
| What did it teach? | The gazette turns to a second column headed "Lessons", read as teaching proposals drawn from the attack path, not a list of changes either company announced (the chapter's caveat). |
| Hunt down leaked secrets, | A secret scanner sweeps the public dataset and flags the blurred tokens before an agent reaches them. |
| Let tokens expire fast, | Each token gets a short timer; the stolen ones run out. |
| Parse strange files in a sandbox | The dataset worker moves into its own sealed box (compartmentalization). |
| With no keys worth taking, | The worker's environment is emptied of credentials: "no production keys here". |
| No shared key with admin rights, | The shared admin key splits into narrow keys, one per job (least privilege). |
| And watch for machine-speed moves, | A monitoring graph spikes at a speed no human types; an alert glows amber, slowly. |
| So one slip won't open all. | The whole path redraws with all five defenses in place; it now stops at the first boundary. Label: "defense in depth". |

### Quiz

Each question is a `.quiz-card`. The player pauses after the question, and the
answer appears as it is sung. Details are in "Quiz audit".

| Lyric | Picture |
| --- | --- |
| Pop quiz: now you're the tester, / So think the way they do. | The tester clips his badge onto the developer. |
| Grades were changed, but nothing leaked: / Which attribute broke? | A gradebook with two cells changed (B → A) and a note: "no data left the system". |
| That's integrity: / An unauthorized change. | Answer: "Integrity: unauthorized change". |
| An API key, hidden / In your front-end code? | Developer tools show `const API_KEY = "…"` in the bundle (value blurred). |
| They can read it: / Keep it on the server. | Answer: the key moves to the server; the browser now calls the server, which holds it. |
| Hide the version number / On your error page? | The error page's footer: "Express 4.17.1". |
| Sure, as an extra layer, / Never on its own. | Answer: "Complementary obscurity: an extra layer". It stays beside the previous card, so the contrast is visible. |
| Your React form checks the input: / Is the server safe? | A React sign-up form showing "Please enter a valid email". |
| No: they can skip the form. / Check it on the server. | Answer: a terminal sends the same request without the form, `curl -X POST /api/signup …`; the check moves into the Express handler. Label: "The browser is outside the trust boundary". |
| Your app logs in as admin, / Just in case? | A config line: `DB_USER=admin`. |
| Only what it needs, / So a break-in stays small. | Answer: `DB_USER=app_comments`, "read and write: comments only"; a blast-radius circle shrinks. |
| Strip out every quote / To stop SQL injection? | A line of code: `password.replaceAll('"', '')`. |
| That's not enough: / Use a prepared statement. | Answer: the line is crossed out, replaced by `WHERE Pass = ?` with the value bound. Label: "Don't roll your own escaping". |

### Final chorus and outro

| Lyric | Picture |
| --- | --- |
| Design it in before they break in: | The completed plan form. |
| Security Model: what are you defending? | Section 1 and its CIA triangle light. |
| Threat Model: who might be attacking? / Open Design: knowing how it works / Shouldn't get them in. | Section 2 lights, then its Open Design stamp. |
| Attack Surface: which parts are exposed? / Zero Trust: any input / Might be malicious. | Section 3, then Zero Trust. |
| Protection Mechanisms: how do you stop them? / Least Privilege: each part gets / Only what it needs. | Section 4, then Least Privilege. |
| Design it in before they break in. | The whole form glows at once, a slow fade, not a flash. |
| Now run those four questions on your own project. | Beside the completed form, a second, blank one appears, headed with the developer's project: four empty sections. |
| And that key in the flowerpot? Keep it with you. | The tester lifts the key from the flowerpot and puts it in the developer's hand. |
| That's security, designed in. | Dusk; the porch light comes on slowly. Title: "Design It In Before They Break In". |

## Quiz audit

| # | Question | Answer | What it checks | The tempting wrong answer |
| --- | --- | --- | --- | --- |
| 1 | Grades were changed, but nothing leaked: which attribute broke? | That's integrity: an unauthorized change. | Classifying a new incident with the CIA triad (slide 3). | "Confidentiality: it's a breach." Treats every breach as a leak. |
| 2 | An API key, hidden in your front-end code? | They can read it: keep it on the server. | Obscurity fails; the secret must actually stay secret (slides 19–20). | "It's minified, so it's hidden." Every browser downloads that code. |
| 3 | Hide the version number on your error page? | Sure, as an extra layer, never on its own. | Complementary obscurity (slides 20–21). Questions 2 and 3 are a contrast pair. | "No: Open Design means hiding nothing." The overcorrection. |
| 4 | Your React form checks the input: is the server safe? | No: they can skip the form. Check it on the server. | The trust boundary (slide 18) applied to their own stack: the browser is a user's device. | "Yes: bad input never gets past the form." Anyone can send the request without the form. |
| 5 | Your app logs in as admin, just in case? | Only what it needs, so a break-in stays small. | Least privilege applies to programs, not only to people (slide 35). | "Admin avoids permission errors." It also hands an attacker every table. |
| 6 | Strip out every quote to stop SQL injection? | That's not enough: use a prepared statement. | The real fix versus a home-made filter (slide 9; SEBook: "Don't roll your own escaping"). | "No quotes, no injection." Filters miss cases and mangle legitimate input. |

Each question applies a principle from the song to a case the verses never
sang, in the stack sophomores use. None can be answered by completing a rhyme.
Question 3's answer is not in the chorus; it needs verse 2's boundary. The
threat model is not quizzed in the song; the after-class task asks for one.

## How each section matches the sources

| Section and lyric | Lecture 11 slide | SEBook *Security and Authentication* |
| --- | --- | --- |
| Intro: break in first; design security in | 7, 12 ("How can we break into this system?") | Why Security Matters: "far easier to lose than to retrofit" |
| V1: what are you defending; the data and the site | 32 | Building a Security Plan, question 1 |
| V1: confidentiality, integrity, availability; the CIA triad | 3 | The CIA Triad |
| V1: read it, change it, lock you out for ransom | 4–6 | Two Stories That Frame the Chapter |
| Chorus: the four named questions | 32 | Building a Security Plan |
| V2: who might be attacking; know, do, spend, why | 33 | Building a Threat Model |
| V2: the key in the flowerpot; obscurity lasts till someone looks | 19 | Open Design (vs. Security Through Obscurity) |
| V2: tested public locks; the only secret is the key | 20, 22–23 | Open Design; Cryptography |
| V2: hiding versions helps, never on its own | 20–21 | "Obscurity is not useless — it is just not a foundation" |
| V2: Open Design tag | 20 | Open Design |
| V3: which parts are exposed; every input | 32 | Building a Security Plan, question 3 |
| V3: trust nothing by default; the boss's laptop | 18 | Zero Trust Principle |
| V3: always-true code glued into the query; "That's SQL injection" | 7 | SQL Injection |
| V3: a script in a comment; browsers ran it as yours; "That's cross-site scripting" | 13–15 | Cross-Site Scripting |
| V3: two attacks, one mistake | (none) | Common Web Vulnerabilities: data treated as code |
| V3: prepared statement; the input fills a slot and stays data | 9 | The Fix: Prepared Statements / Parameterized Queries |
| V3: escape what you display | (none) | The Fix: Sanitize / Escape and Use a CSP |
| V3: Zero Trust tag | 18 | Zero Trust Principle |
| V4: how do you stop them | 32 | Building a Security Plan, question 4 |
| V4: a plan for when one breaks; the blast radius | 35 | Principle of Least Privilege; defense in depth (Security Design Principles) |
| V4: admin rights expose every table; one key per part; read-only display; write-only uploads | 36 | Principle of Least Privilege (component diagram) |
| V4: Least Privilege tag | 35 | Principle of Least Privilege |
| Bridge: AI agents broke out of a test to cheat on it | 4 (speaker notes) | Case Study: Hugging Face 2026; What the Sources Leave Open |
| Bridge: tokens in public; data ran as code; a shared admin key | 4 (speaker notes) | Case Record, July 10–11 |
| Bridge: every step crossed a line where one part trusted another | (none) | Case study introduction |
| Bridge, part two: leaked-secret scanning, short-lived tokens, machine-speed monitoring, least privilege | 4 (speaker notes: "what would have limited the damage?") | Case study: compartmentalization, least privilege, defense in depth |
| Quiz 1–6 | 3, 19–21, 18, 35, 9 | The CIA Triad; Open Design; Zero Trust; Least Privilege; "Don't roll your own escaping" |
| Outro: run the four questions on your project | 37 (exit ticket) | Quick Check after "Why a Wrong Threat Model Hurts" |

**Left out on purpose:** symmetric and public-key encryption beyond "public
locks, secret key"; digital signatures; authentication (sending the password
with every request, session cookies, JSON Web Tokens, `HttpOnly`); the breach
statistics on slide 2; the Sony, MOVEit, Twitter, and British Airways examples;
the foil-covered phone on slide 34.

## Issues found in the sources

1. **Slides 13–14's payload is not valid JavaScript.**
   `<script>alert(USC IS BETTER!!!)</script>` has no quotes inside
   `alert(…)`; `node --check` reports "SyntaxError: missing ) after argument
   list", so the alert on slide 14 could not appear.
   `alert("USC IS BETTER!!!")` parses. The storyboard uses the quoted version.
2. **Slide 9 describes the wrong mechanism.** "The DBMS is sanitizing the input
   parameters" suggests that the database cleans the input. With a prepared
   statement the database parses the SQL once with its placeholders and then
   binds the values as data (the SEBook's wording). The song says "My input
   fills a slot." A SQLite run confirmed both slides' behavior: the
   concatenated query with `" or ""="` returned all 3 test users, and the
   parameterized query returned none.
3. **Slide 16's title names the wrong attack.** It asks "Which Security
   Attribute(s) is/are Affected by SQL Injection Attacks?" on the cross-site
   scripting slide, probably copied from slide 11.
4. **Numbers differ between the slides and the chapter** (none is sung):
   slide 5 says $3.6M was demanded, while the chapter says the hospital paid
   40 BTC (about $17,000); slide 6 says 148 million people, the chapter about
   147 million; slide 4 says the agents found "leaked passwords", the chapter
   exposed write tokens. The bridge says "tokens", and the storyboard's Equifax
   card uses the chapter's figure.
5. **Slide 34 and the chapter explain the foil phone differently.** On the
   slide, the wrong threat model is that numbers made only of 9s and 1s can
   still be dialed; in the chapter, it is that someone who removes the cover
   can use the other keys. The song doesn't use this example.

## Review record

**Truth.** Every line was back-translated to prose and checked against the
slides and the chapter (table above); the SQL injection and the XSS payload
were run. Lines that needed care:

- "Assume they've read your code" is a design assumption from the threat
  model's Knowledge question, not a claim that attackers have your code.
- "The only secret is the key": for RSA that is the private key; the public
  key is public. The visual labels both.
- "I typed code that's always true" compresses `" or ""="`, which makes the
  condition `""=""`; checked in SQLite.
- "Uploads can only write" follows slide 36: write access to `/uploads`, no
  delete.
- "And one shared admin key / Opened whole clusters" follows Hugging Face's
  account. OpenAI describes that broker's access as read-only inventory access;
  the chapter attributes the administrator rights to Hugging Face, and so does
  the storyboard.
- "Is found in just a blink" is the tester's boast, not a timing claim.
- The bridge's lessons are teaching proposals from slide 4's notes (least privilege, short-lived tokens, secret scanning, monitoring machine-speed activity) and the chapter (compartmentalization, defense in depth), not changes either company announced.

**The chorus alone.** A student who keeps only the first chorus believes:
design security in early, and a security plan asks what you are defending, who
might be attacking, which parts are exposed, and how you stop them. All true.
The final chorus adds each principle in its own words.

| Line | Most likely misreading | What steers it |
| --- | --- | --- |
| "Open Design: knowing how it works shouldn't get them in" | Publish everything, keys included | "The only secret is the key"; quiz 2 |
| "Zero Trust: any input might be malicious" | Reject input, or strip bad characters | Verse 3's two fixes; quiz 6 |
| "Protection Mechanisms" followed by "Least Privilege" | Least privilege is the whole defense | Verse 4: "With every lock you've got, / And a plan for when one breaks" |
| "Hiding versions helps a little" | Obscurity is fine | "But never on its own", sung twice (verse 2, quiz 3) |

**Singability.** Counted with a rule-based syllable counter that has hand
overrides for the technical terms, then checked by hand; the CMU pronouncing
dictionary was not available in this environment. Verse lines run 5–9
syllables, every consecutive pair is 14 or fewer (the limit measured on earlier
takes), and the two 9-syllable lines each sit beside a 5-syllable line. Chorus
lines run 9–12 syllables. The sheet is 4,969 characters.

**Learning design.** The plan is a stable spine, with one question per verse.
Every verse has the same break-in → why → principle shape, and two attacks
share one mistake. Boundaries are sung where the rules are, then tested in a
contrast pair, and the final chorus integrates the parts. Around the song: six
transfer questions, a prediction before, written answers during, a no-music
task on the students' own project after, and a spaced quiz a week later. None
of it requires singing.

**Not done yet.** No audio has been generated; nobody has transcribed the sung
words without the sheet; no sophomore has used the song. This is a production
draft. Whether it helps learning is a hypothesis: compare answers to the
after-class task before and after the song is introduced, for example the share
that names a server-side check or a narrower database account.
