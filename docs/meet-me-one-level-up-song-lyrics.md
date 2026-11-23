# Meet Me One Level Up: a song about coding with AI agents

Lyrics and Suno prompt for a CS 35L song on Lecture 14, *Agentic SWE /
Coding with GenAI*, and the SEBook chapter
[Generative AI](../SEBook/development_practices/genAI.md).
**Status: recorded and animated.** The Suno take "Meet Me One Level Up" (2)
plays in the live vector player `/assets/song-player/meet-me-one-level-up.html`
(storyboard `_data/songs/meet_me_one_level_up.yml`, choreography
`js/song-video/songs/meet_me_one_level_up.js`), in the CS 35L playlist. The
video draws the agent as a misplaced genius: a small robot in a UCLA-blue
hoodie with a graduation cap set a little askew and a NEW badge, who shows off
what it knows and looks lost at your project. The take sings "And one stayed"
for the sheet's "One stayed"; the captions follow the recording.

## What the song teaches

**Singer.** The AI coding agent itself, fresh out of training: a brilliant
genius out of place. It knows almost everything except your project, and it
doesn't know the context until it's told, so it confidently solves a slightly
different problem from the one you meant. It tells the student, warmly and
with a wink, how its training made it that way, and where the two of
them understand each other best: one level above the code. This is the
lecture's own picture of the agent, "a very knowledgeable intern who is not
good at applying their knowledge to the right context" (slides 31 and 38), and
its speech bubbles ("I ace all well-known tests", "I excel at verifiable
tasks", "My output looks convincing and pleasant").

**Audience.** CS 35L students, mostly sophomores. They use coding agents
daily, have met user stories, INVEST, TDD, and UML in this course, and are
working on a team web app.

**Function.** Review after Lecture 14. It reorganizes the lecture around one
idea: the agent writes more code than anyone can read, so the student and the
agent have to meet in shared, higher-level abstractions (requirements, design,
and tests) that the student owns and can judge.

**Goal.** Given a feature for a coding agent, students can:

- explain, from how the agent was trained and how it runs, why it can solve
  the wrong problem: it guesses what it hasn't seen, is strongest on familiar
  textbook tasks, learns to pass whatever a test checks rather than what the
  test is for, sounds sure where no test can check it, and forgets everything
  that was not written down;
- write the requirement so it leaves nothing to guess: the need rather than
  the mechanism, every number pinned down, and what must never happen;
- review the agent's design on a diagram chosen for the question, tracing past
  the happy path, and record the decision in the spec;
- pin each boundary with a test, review generated tests, and check that the
  code solves the general case.

**Transfer.** The three quiz questions apply what the verses teach to cases
the verses don't sing (a refund window, a password rule, a project rule). The after-class task is the lecture's exit ticket: write a prompt for
a current project task and name the practices it follows.

### Truth sheet

| Item | Verified statement | Source |
| --- | --- | --- |
| Core claim | The agent writes code faster than anyone can read it, so review cannot stay at the level of pure code; human and agent need a shared abstraction (requirements, design views, tests) where the human judges the design and owns the decisions. | Slides 67–70, 91, 92 |
| How it was trained | Pre-training: hide the next token, let the model guess, check the real file, adjust the weights; repeated billions of times, it imitates familiar patterns and may invent details. Post-training: supervised fine-tuning on tasks with expert answers (answers requests instead of continuing text); RL scores tries with tests and adjusts toward high scores, so wrong code can receive full marks; preference tuning favors what people rate higher on tasks no test can check, so answers sound convincing and pleasant. In the song's words: tasks a test could score (verifiable) versus tasks where no test can check (non-verifiable). | Slides 3–6 |
| How it runs | At inference the weights stay frozen; the prompt only adds context. The model asks for tools; the agent runs them in a loop, and each model call resends everything so far. A new session starts with an empty context; saved memories (and files such as skills) survive. | Slides 7, 9–14 |
| Requirements | A teammate asks; an agent guesses and moves on. It may take your words in the most literal way. Its code acts on real files. Regenerated code keeps only what was written down. Criteria: Specific, Testable, Complete, Need-first, Bounded. Fix the how only for a reason, such as a course rule. "Requirements are the part of the program you own." | Slides 47, 49–64 |
| Design | Review effort grows with the generated code, not the prompt; judge the design instead of the code. Choose views for the question, not to show every detail. Ask for a diagram first; hold it to the story; trace past the happy path; ask for an alternative and run the same trace; decide and record why in the spec. Sequence: order, timing, failures. Class: what depends on what. Component: trust boundaries. | Slides 66–74, 91 |
| Tests | Write a test first, or have the AI generate tests and review them as a specification; have it pass them without changing the test; refactor AI-written code; review the implementation for overfitting. Pin every boundary with a test, because untested rules can change at every regeneration. | Slides 35–36, 58–59 |
| Why humans stay in it | AI removes accidental complexity; essential complexity (requirements, design, quality assurance) remains. AI amplifies existing practice. Relying on AI for cognitive offloading minimizes learning; conceptual inquiry keeps it. You are fully responsible for all code, including bugs and security vulnerabilities. | Slides 15–18, 27–28, 38 |
| Boundaries | "Judge the design, not line by line" is about review at scale, not permission to skip verification: tests and the pre-chorus's "assume I misunderstood until you've checked I'm right" carry that. "The need, not the how" has an exception (a course rule, a system you must fit), tested in quiz 3. Passing tests is evidence, not proof (verse 2, "I learned to pass whatever's checked, / Not what the test is for"). | Slides 5, 35, 61–62 |
| Likely errors | "Thirty days is specific enough." "Testing eight characters is enough." "Never tell the agent how." "I'll just read the code it wrote." "It remembers what I told it yesterday." | Quiz 1–3, verses 3 and 5 |
| Music-free check | Exit ticket, slide 93: write a prompt for a real project task and explain which practices it follows. | Slide 93 |

## How the song is built, and why

| # | Decision | Learning reason |
| --- | --- | --- |
| 1 | **The chorus is the one idea: meet one level up.** It names the three shared abstractions (requirements, design, and tests), then four moves, one or two per abstraction, in the lecture's own words: the need, not the how; leave nothing to guess; ask for a diagram first; pin each boundary with a test (the slide says "every"; "each" saves two syllables). | The same words every time make it a retrieval cue (songcraft R01). Every move is something a student can do in their next prompt. |
| 2 | **The pre-chorus is the reason the chorus is needed,** sung before the first chorus: the agent writes faster than you read, looks convincing, and may have misunderstood you. | It keeps the chorus's "not line by line" from being heard as "don't check": checking is the condition, and the chorus says where to check ("Pin each boundary with a test"). |
| 3 | **Verses 1–3 are how the agent works, and why a brilliant genius without context can solve the wrong problem.** Each training phase gives it a skill and the matching blind spot. Pre-training: it has read more code than anyone, but never your project, so it guesses the missing part. Supervised fine-tuning: it aces textbook problems, "But is that what you ask?" Reinforcement learning, on tasks a test could score: it learned to pass whatever's checked, "Not what the test is for". Preference tuning, where no test can check: "People picked the smoothest talker, / So I sound sure to you". Inference: "write down what you mean". | Objective 1 of the lecture, taught as cause and effect so the advice in verses 4–7 follows from the mechanism rather than being a list of rules. |
| 4 | **Every example is told in full inside the song,** so it teaches without the slides: the setup, what went wrong, and the rule. Free shipping: a $10 coupon, nobody said whether "over fifty" counts before or after it, so each regeneration may guess differently. The photo rename: all photos had the same date, so they got the same name and only one survived; "Never overwrite a file" would have saved them. Compilers: they once wrote assembly that people still read; later people reviewed only the source; now the agent writes the code, so review moves up to the design. | A worked example only teaches if the learner can follow every step (worked examples for novices, A). A reference to a slide the listener may not remember is a cue without content. No code appears in the lyrics; the stories are told in plain words. |
| 5 | **The shipping story has a setup and a payoff.** Verse 4 shows the guess; verse 7 resolves it as a boundary test in plain words: "Fifty after coupons: free; Not forty-nine ninety-nine", which also defines a boundary ("the input on the line"). | A problem left open in one verse and solved in a later one is spaced retrieval of the same case, and it makes the chorus's "Pin each boundary with a test" concrete. |
| 6 | **The bridge defines its terms,** in parallel lines: accidental complexity comes from the tools (syntax, boilerplate) and the agent can help with it; essential complexity comes with the problem, so requirements, design, and tests stay with you. Then: doing the student's thinking would cost them the learning. | The chorus's three abstractions turn out to be exactly where the essential complexity lives, which is why the human stays in charge of them (slides 15–18, 28). |
| 7 | **The quiz asks only about what the song taught,** on new cases: a refund window (every number needs its base), a password rule (test both sides of the line), and a project rule (the exception to "the need, not the how"). Each answer gives its reason. | Retrieval with feedback (R06) that transfers a sung rule to a new case, instead of testing knowledge the song never gave. |
| 9 | **The jokes come from a brilliant mind missing the context, and each one carries a lecture point.** "I know almost everything. Except your project." (trained on everything public, nothing of yours). "A genius, new on site" (no context until told). "Textbook problems? Aced them all! / But is that what you ask?" (well-known tasks, not yours). "People picked the smoothest talker" (preference tuning rewards sounding convincing). "New session: who are you again?" (context is wiped). "But I guess and stride away" (gaps become guesses, confidently). "One stayed. Technically okay." (it did what you wrote, not what you meant). "Be honest: will you read each line? / Nope." (review can't stay at the code level). "I've got a few" when asked for a second design (ask for alternatives). "Pop quiz! No asking me" (do the thinking yourself). Outro: "I know how to write the code. / You know what we should build." (accidental versus essential). | Humor makes the misconception memorable when the joke is the misconception (songcraft step 5). The agent is never stupid, only uninformed, which is the lecture's point: give it the context. It laughs at itself, never at the student. The bridge stays sincere, so the contrast lands. |
| 8 | **Left out:** reasoning models, skills and progressive disclosure, the METR horizons and productivity studies, the social-media posts, the four architecture views by name, and the individual design reviews (UDP, server-side rendering, transactions, supply chain). | One song, one idea. The design-review cases deserve their own practice set, not a line each. |

### Structure

| Section | Lines | Job |
| --- | --- | --- |
| Intro (spoken) | 3 | The agent introduces itself: just out of training, knows almost everything except your project. |
| Verse 1 | 8 | Pre-training: guess the next token; has read more code than anyone, never your project, so it guesses. |
| Verse 2 | 12 | Post-training: textbook problems (are they yours?); tasks a test can score (passes the check, not its purpose); tasks no test can check (sounds sure). |
| Pre-chorus | 4 | Faster than you read, looks clean, assume I misunderstood. |
| Chorus | 8 | Meet one level up: requirements, design, tests, and four moves. |
| Verse 3 | 12 | Inference: frozen weights, context, tools, the loop, memory. |
| Verse 4 | 20 | Requirements: guesses and literal words; the free-shipping story (regeneration keeps only the rules you wrote down); the photo-rename story (say what must never be done). |
| Chorus | 8 | Unchanged. |
| Verse 5 | 8 | Why go up a level: too much code to read; compilers once wrote assembly people read, then review moved up to the source. |
| Verse 6 | 12 | Design on a shared diagram: views for the question, the user story, failure traces, a second design, record the choice in the spec. |
| Chorus | 8 | Unchanged. |
| Verse 7 | 16 | Tests: write or review them; a boundary is the input on the line (the shipping rule as a test); pass without editing them; general case; refactor; keep them. |
| Bridge | 12 | Accidental vs. essential complexity, defined; ask why instead of offloading. |
| Quiz | 3 questions | New cases for sung rules; the player pauses after each question. |
| Final chorus | 8 | Unchanged. |
| Outro (spoken) | 3 | I can write the code; you know what to build; meet me one level up. |

### Fit for CS 35L sophomores

The evidence grades are the pedagogical-advisor skill's editorial ratings for
each claim, not effect sizes for this song.

| Choice | Why it fits sophomores | Evidence |
| --- | --- | --- |
| Mechanism first, then the practice it justifies | They use agents already; a reason sticks better than a rule they can't derive. | Elaboration and self-explanation: B |
| One idea per quatrain, one example per idea, about 8 seconds each | The lecture had 90 slides; the song keeps only what serves the goal. | Segmenting and coherence: A/B |
| Each training phase paired with its blind spot (guesses, aces the textbook, passes the check, sounds sure) | Contrasts make the consequence visible. | Contrasting cases: A/B |
| Three open quiz questions on new cases, answered in writing at each pause; the exit ticket afterward without music | Retrieval and a no-melody check, so the melody is not the only cue. | Retrieval practice: A; spacing: A |
| The bridge's "ask me why, then try yourself" | It is the lecture's own finding about their learning, said by the tool they use. | Skill-formation study (slide 28): one controlled study, B for this population |
| A sweet, honest singer, never a scary one | Challenge without threat; the agent admits its limits instead of the student being shamed for theirs. | Motivation guidance, not an effect estimate |
| Captions, transcript, written answers | Nobody has to sing or hear the song to take part. | Accessibility requirement |

Songs have conditional evidence for recall of exact verbal material (R01–R03)
and none for skill at specifying or reviewing AI-generated code. The quiz and
the exit ticket carry the application. Rhyme can make a claim feel truer (R08),
which is why each rhymed claim was checked against the slides before rhyming.

### Where the persona stops

The agent sings "I", as the lecture's robot does. The lyrics keep its claims
to what the lecture says, and the video and class discussion should mark these
limits:

- **"I learned to pass whatever's checked"** is weight updates toward higher
  reward, not wanting anything. "Genius, new on site" is the lecture's
  knowledgeable-intern metaphor, not a claim that the model understands or
  wants. "I know almost everything" is a comic boast; the line's point is
  "Except your project".
- **"A teacher gave answers"** is a dataset of tasks paired with expert
  answers, not a tutor in the loop.
- **"I ask for tools"** is the model writing a tool call; the agent program
  runs it. The song uses one "I" for both, the way the slides' robot does.
- **"Saved memories and files survive"** does not mean the agent learned:
  the weights stay frozen at inference. A saved memory is text loaded into a
  later context.
- **"That's where your thoughts meet mine"** means a shared representation
  both can read and check, not mutual understanding in a human sense.

## Genre: warm indie pop with a bedroom-pop heart

**Choice:** polished indie pop played by a live band: bright jangly guitars,
punchy loose drums, warm bass, Wurlitzer and upright piano, a small horn
section, and soft strings that lift the chorus. The arrangement builds:
guitar and keys in the intro, sparse verses, a rising pre-chorus, a warm
sing-along chorus with horns, a half-time bridge with only piano and strings,
and a final chorus a whole step up. The reference space is the sincere,
melodic indie pop many students listen to (Rex Orange County, Dayglow,
Wallows); the prompt describes the sound, since Suno rejects artist names.

**The voice:** a youthful male tenor, brilliant and quietly confident with a wink: warm
and conversational in the low verses, a light vibrato, clear high notes
reached without strain, one long held note at the end. Natural and human,
no autotune.

**Why this genre, after two others.** Bright guitar pop with violins sounded
generic, and 1980s city pop was the next try. The goal is a sound that
students hear as their own and that doesn't come off as an educational
jingle.

1. **It is not cringe, because it doesn't try hard.** Educational songs sound
   embarrassing when the genre is big and performative: musical-theatre
   belting, shouted chants, EDM drops, a teacher rapping. Indie pop is
   understated and sincere, so dense lyrics sound like an honest confession,
   not a lesson set to music. The exclude list names the failure modes
   (musical theatre, children's music, jingle, cheesy).
2. **It fits the singer.** A brilliant newcomer admitting "assume I
   misunderstood" is indie pop's natural voice: sincere, self-aware, a
   little funny.
3. **It keeps the words clear.** It is melodic and unhurried; guitar and
   horns answer between the sung lines; nothing in the style pushes toward
   rapping or rushing.
4. **It sounds produced, not generic.** Naming the instruments (Wurlitzer,
   upright piano, horns, strings) and how the arrangement builds asks Suno
   for a crafted record rather than a stock pop preset.
5. **It is new in the playlist.** Nothing else is indie pop. It differs from
   *Not a One-Time Investment* (indie folk-rock with banjo and fiddle) and
   *Draw It Out* (driving pop rock with a female voice).

**Also considered:** alt-R&B with a funky guitar groove (current with
students, but laid-back phrasing blurs words); jazz-pop with strings in the
Laufey vein (lovely, but tends toward slow ballads); 1980s city pop (rich,
but reads as retro); hyperpop (popular, but pitch-shifted vocals ruin
intelligibility); synth-pop (too on the nose for an AI song, and dense synths
mask words).

## Lyric sheet (Suno-ready)

- **Format:** one line per bar, 4,978 characters (under Suno's 5,000).
  Verse and chorus lines are 6–8 syllables, with a few 5s and one 9; every
  rhyming pair is 12–15 syllables. Counts are in the
  [syllable table](#syllable-counts).
- **No code in the lyrics.** Examples are told as stories in plain words.
- **Rhyme:** every quatrain rhymes lines 2 and 4, because Suno sings rhymed,
  metrical lines as melody and raps lines that read like prose.
- **A dash after a term** ("IN-fer-ence- my weights stay frozen"), because Suno
  has dropped title-only lines and colon cues before. Captions use a colon.
- **Respellings** for words Suno mispronounces (Pree-training, IN-fer-ence,
  Ree-in-FORCE-ment, ree-JEN-er-ate, ree-READ, ree-FAC-tor, Ree-ACT), capitals
  on the stressed syllable. They are for Suno only; captions use the normal
  spelling (see [Pronunciation](#pronunciation-and-take-checks)).
- **Quiz pauses:** no tag between question and answer. Every earlier song's
  break or instrument tag there was ignored, so the player's `pause_at`
  supplies the thinking pause, and the characters went to the lyrics.

```text
[Intro: spoken, warm]
Hi! I just finished training.
I know almost everything. Except your project.
So let's see how we can do great things together.

[Verse 1]
Pree-training hid the next token
And asked me what was there;
I guessed, they checked the real file,
And tuned my weights with care.
I've read more code than anyone;
The patterns all by heart;
But your project I've never seen,
So I guess the missing part.

[Verse 2]
Post-training brought a teacher
With answers, task by task:
Textbook problems? Aced them all!
But is that what you ask?
In Ree-in-FORCE-ment Learning,
On tasks a test could score,
I learned to pass whatever's checked,
Not what the test is for.
Preference Tuning: where no test
Can check if it is true,
People picked the smoothest talker,
So I sound sure to you.

[Pre-Chorus: rising]
I write faster than you read,
A genius, new on site;
So assume I misunderstood
Until you've checked I'm right.

[Chorus: full band, horns]
Meet me one level up,
Judge the design, not line by line;
Requirements, design, and tests:
That's where your thoughts meet mine.
Tell me the need, not the how,
Leave me nothing to guess,
Ask for a diagram first,
Pin each boundary with a test.

[Verse 3: light, keys]
IN-fer-ence- my weights stay frozen,
Whatever you may say;
Your prompt adds only context
To what I see today.
I ask for tools: I read your files,
I run your tests, and then
Each call, I ree-READ everything
From the start again.
New session: who are you again?
My context is wiped clean;
Saved memories and files survive,
So write down what you mean.

[Verse 4: playful]
When you're vague, a teammate asks,
But I guess and stride away;
I'll do exactly what you wrote,
Not what you meant to say.
"Free shipping over fifty":
A coupon takes off ten;
Before or after the coupon?
You never told me when.
This week, I might guess "before";
Next week, the other way around:
Ree-jen-er-AY-shun keeps only
The rules that you wrote down.
"Rename my photos by their date":
All were from one day,
So each got the same new name,
One stayed. Technically okay.
I act on your real files, so say
What must never be done:
"Never overwrite a file"
Would have saved them, every one.

[Chorus]
Meet me one level up,
Judge the design, not line by line;
Requirements, design, and tests:
That's where your thoughts meet mine.
Tell me the need, not the how,
Leave me nothing to guess,
Ask for a diagram first,
Pin each boundary with a test.

[Verse 5: warm]
Your few sentences become
Ten thousand lines of code;
Be honest: will you read each line?
Nope. Far too big a load.
Compilers once wrote assembly,
And people read it, too;
Then they reviewed just the source;
Now design is what we review.

[Verse 6]
So let's share an abstraction,
A diagram we both read:
Not every detail, just the views
That answer what you need.
Hold it to the user story,
Then go past the happy path:
Trace a crash, a lost message,
And follow the aftermath.
Ask me for a second design,
I've got a few; trace those through;
Write in the spec which one, and why,
So my next draft keeps it, too.

[Chorus]
Meet me one level up,
Judge the design, not line by line;
Requirements, design, and tests:
That's where your thoughts meet mine.
Tell me the need, not the how,
Leave me nothing to guess,
Ask for a diagram first,
Pin each boundary with a test.

[Verse 7: upbeat]
Write a test before I code,
Or let me draft a few,
But check they say just what you need,
With every edge case too.
Pin each boundary with a test,
The input on the line:
"Fifty after coupons: free;
Not forty-nine ninety-nine."
Then I'll write code to make them pass
And leave your tests alone;
Check I solved the general case,
Not just the cases shown.
Then ree-FAC-tor what I wrote,
And keep your tests in place:
Each time I ree-JEN-er-ate,
They catch the rules I misplace.

[Bridge: half-time, piano, strings]
Accidental complexity
Comes from the tools we choose,
Like syntax and boilerplate:
That part, I'll help you lose.
Essential complexity
Comes with the problem, through and through:
Requirements, design, and tests
Still belong to you.
If I do all your thinking,
You'll barely learn a thing;
So ask me why, then try yourself,
And watch your skills take wing.

[Quiz: same singer asks and answers]
Pop quiz! No asking me:
"Refunds within thirty days":
What would I have to guess?
Thirty days from when?
The order or delivery?
"Passwords: eight or more":
Which inputs do you test?
Seven and eight characters:
Both sides of the line.
Your project requires Ree-ACT.
Should you tell me the how?
Yes, and say the reason:
A project rule fixes the how.

[Final Chorus: key change up]
Meet me one level up,
Judge the design, not line by line;
Requirements, design, and tests:
That's where your thoughts meet mine.
Tell me the need, not the how,
Leave me nothing to guess,
Ask for a diagram first,
Pin each boundary with a test.

[Outro: spoken, soft]
I know how to write the code.
You know what we should build.
So... meet me one level up?
[End]
```

### Suno style prompt

**Style of Music** (full, 968 characters):

```text
Warm, polished indie pop with a bedroom-pop heart, about 112 BPM, 4/4, major key, sincere and playful, never cheesy. Live band: bright jangly clean guitars, punchy loose drums, round warm bass, Wurlitzer and upright piano, a small horn section and soft strings that lift the chorus. The arrangement builds: guitar and keys in the intro, sparse verses, a pre-chorus that rises, a big warm sing-along chorus with horns, a half-time bridge with only piano and strings, the final chorus a whole step up. One singer: a youthful male tenor, brilliant and quietly confident with a wink, warm and conversational in the low verses, light vibrato, effortless clear high notes, one long held note at the end. Lead vocal upfront and close-miked, natural and human, light room reverb, no doubling, no harmonies, crisp English diction. Verses sung on a melody, one line per bar, a breath after each line, never rapped. Guitar and horns answer between sung lines, not over the words.
```

**Style of Music** (short, 193 characters, for a field limited to about 200):

```text
warm polished indie pop, bedroom pop, 112 BPM, jangly guitars, Wurlitzer, upright piano, small horns, soft strings, confident youthful male tenor, effortless highs, natural vocal, crisp diction
```

**Exclude Styles:**

```text
rap, autotune, vocoder, robotic voice, female vocal, duet, choir, harmonies, vocal doubling, heavy reverb, echo, whisper, lo-fi hiss, EDM, trap, dubstep, distorted guitar, shouting, gang vocals, ad-libs, mumbled, slurred, musical theatre, children's music, jingle, cheesy
```

Suno has ignored tempo requests before (Draw It Out asked for 134 BPM and
played about 120). Judge a take by syllables per second, not its BPM, and keep
one whose verses stay near 3–4 syllables per second. Generate again rather
than fixing it in the mix if the horns, piano, or strings play a melody over
the words; if the singer sounds auto-tuned, robotic, or mumbled; or if the
take turns into musical theatre or a children's-song jingle. Those are the
cringe failure modes for an educational song. The tempo of about 112 gives
each line a little over two seconds.

### Syllable counts

Sung syllables per line, counted with the CMU Pronouncing Dictionary
(see [Review record](#review-record) for how). Verse lines stay in 6–8 and
choruses in 6–8, with the variants noted in the format bullet above.

| Section | Syllables per line | Rhyming pairs |
| --- | --- | --- |
| Verse 1 | 8 6 7 6 8 6 8 7 | 14 13 14 15 |
| Verse 2 | 7 6 7 6 7 6 8 6 8 6 8 6 | 13 13 13 14 14 14 |
| Pre-Chorus | 7 6 8 6 | 13 14 |
| Chorus | 6 8 7 6 7 6 7 8 | 14 13 13 15 |
| Verse 3 | 8 6 7 6 8 6 8 5 8 6 8 6 | 14 13 14 13 14 14 |
| Verse 4 | 7 7 8 6 7 6 8 6 7 8 8 6 8 5 7 8 8 6 7 8 | 14 14 13 14 15 14 13 15 14 15 |
| Verse 5 | 7 6 8 6 8 6 7 8 | 13 14 14 15 |
| Verse 6 | 7 7 9 6 8 7 7 7 8 7 8 7 | 14 15 15 14 15 15 |
| Verse 7 | 7 6 8 7 8 6 7 7 8 6 8 6 7 6 7 7 | 13 15 14 14 14 14 13 14 |
| Bridge | 8 6 7 6 7 8 7 5 7 6 8 6 | 14 13 15 12 13 14 |
| Quiz | 6, then each question and its answer: 7 6 · 5 8 / 5 6 · 7 5 / 8 6 · 6 8 | (question · answer) |
| Final Chorus | 6 8 7 6 7 6 7 8 | 14 13 13 15 |

The one 9-syllable line ("Not every detail, just the views") shortens to 8
when "every" is sung as two syllables, and sits beside a 6-syllable line. The
repeated choruses are identical to the first one.

### Pronunciation and take checks

| Sheet | Sung as | Captions |
| --- | --- | --- |
| Pree-training, Post-training | "PREE-training", "POST-training" | Pre-training, Post-training |
| IN-fer-ence- | "IN-fer-ence", then the line | Inference: |
| Ree-in-FORCE-ment Learning | "ree-in-FORCE-ment LEARN-ing" | Reinforcement Learning |
| Preference Tuning | "PREF-rence TOO-ning" | unchanged |
| ree-JEN-er-ate | "ree-JEN-er-ate", not "re-generate" run together | regenerate |
| ree-READ | "ree-READ", not "red" | reread |
| ree-FAC-tor | "ree-FAC-tor" | refactor |
| Ree-ACT | "ree-ACT", the library | React |
| Ree-jen-er-AY-shun | "ree-jen-er-AY-shun" | Regeneration |

Check every take for these:

- **The chorus is identical all four times.** It is the retrieval cue; a
  changed word needs a section replace.
- **Negations survive:** "not line by line", "not the how", "Not what you meant
  to say", "never be done", "Not every detail", "Not just the cases shown",
  "Not forty-nine ninety-nine", "don't just continue text", "Never overwrite
  a file". A lost "not" reverses the advice.
- **No swapped pairs:** "Pre-training" and "Post-training"; "Accidental" and
  "Essential" in the bridge; "before" and "after" in the shipping story;
  "Seven and eight" in the quiz.
- **Every quiz answer is sung,** after its question.
- **The voice stays human:** no vocoder or robotic effect, even though the
  singer is an AI.
- **Balance:** measure the left-right balance per section, and merge to mono if
  it wanders.

## Quiz audit

| # | Question | What it checks | Taught in | Source |
| --- | --- | --- | --- | --- |
| 1 | "Refunds within thirty days": what would I have to guess? | Every number needs its base: thirty days from the order or from delivery? | Verse 4 (free shipping: before or after the coupon?) | Slide 50 |
| 2 | "Passwords: eight or more": which inputs do you test? | A boundary test: seven and eight characters, both sides of the line. | Verse 7 ("The input on the line"; fifty and forty-nine ninety-nine) | Slide 59 |
| 3 | Your project requires React: should you tell me the how? | The exception to "the need, not the how": a project rule (the lecture says "a course rule, or a system you must fit") fixes the how, with the reason stated. | Chorus ("Tell me the need, not the how") | Slides 61–62 |

Each question applies a rule the song sang to a case it didn't. Questions
about which diagram to choose were removed, because the song doesn't teach
that choice; *Draw It Out* does.

## How each section matches the sources

| Lyric | Slide | SEBook |
| --- | --- | --- |
| "Pre-training hid the next token … tuned my weights" | 3 | How LLMs Work |
| "I've read more code than anyone … your project I've never seen, so I guess the missing part" | 3 (robot bubble), 11 | How LLMs Work |
| "Post-training brought a teacher … Textbook problems? Aced them all! But is that what you ask?" | 4 (robot bubble: "I ace all well-known tests") | How LLMs Work |
| "On tasks a test could score, I learned to pass whatever's checked, not what the test is for" | 5 (verifiable tasks) | — |
| "Preference Tuning: where no test can check if it is true, people picked the smoothest talker, so I sound sure to you" | 6 (non-verifiable tasks; "My output looks convincing and pleasant") | — |
| "My weights stay frozen … Your prompt adds only context" | 7 | — |
| "I ask for tools … Each call, I reread everything" | 9–11 | What Coding Agents Add |
| "New session: who are you again? My context is wiped clean; saved memories and files survive" | 12–14 | — |
| Pre-chorus: "I write faster than you read, a genius, new on site … assume I misunderstood" (the slide says "subtly incorrect") | 31, 35, 38, 47, 69 | Best Practices: The Supervisor Mentality |
| Chorus: "Judge the design, not line by line" | 69 | — |
| Chorus: "Tell me the need, not the how" | 61–62 | — |
| Chorus: "Leave me nothing to guess" | 64 | — |
| Chorus: "Ask for a diagram first" | 91 | — |
| Chorus: "Pin each boundary with a test" | 59 | — |
| Verse 4: teammate asks, literal words; free shipping before or after the coupon, regeneration keeps only what you wrote down; photo rename, never overwrite a file | 47, 54–58 | — |
| Verse 5: few sentences, ten thousand lines; compilers once wrote assembly people read, then review moved to the source, now to the design | 66–69 | — |
| Verse 6: "let's share an abstraction", a diagram both read, views for the question, user story, past the happy path, second design, choice and reason in the spec | 70, 73, 91 | — |
| Verse 7: test first or generated tests; boundary = the input on the line, the shipping rule as a test; don't change the test; general case; refactor | 35–36, 38, 58–59 | Advanced Orchestration Techniques |
| Bridge: accidental complexity from the tools, essential from the problem; requirements, design, and tests stay with you | 15–18 | — |
| Bridge: "If I do all your thinking, you'll barely learn a thing" | 28 | Skill Formation |
| Outro: "I know how to write the code. You know what we should build." | 16–18, 38, 47 | Best Practices |

## Review record

- **Hook-alone test.** A student who keeps only the chorus believes: work with
  the agent at the level of requirements, design, and tests; judge the design
  rather than every line; state the need, leave nothing to guess, ask for a
  diagram first, pin boundaries with tests. Two risky readings, both covered:
  "never read code" (the pre-chorus before the first chorus says to assume it
  misunderstood until checked, and the tests line is in every chorus) and
  "never say how" (quiz 3).
- **Prose back-translation.** Each verse was read as prose against the
  truth sheet. Changes made for accuracy: "Only saved memories survive"
  became "Saved memories and files survive" (spec files and skills persist
  too); "Until a test turns green" became "Until you've checked I'm right"
  (one passing test does not prove correctness).
- **Self-contained examples.** Every example now carries its own setup,
  failure, and rule, so a listener who never saw the slides can follow it:
  the shipping story says what the coupon does and what regeneration keeps;
  the photo story says why one photo was left; the compiler lines say who
  wrote the assembly and who read it; the bridge defines accidental and
  essential complexity. Quiz items that relied on untaught knowledge (which
  diagram to pick) were replaced by one that applies verse 7's boundary rule.
- **Syllables.** Counted with the CMU Pronouncing Dictionary
  (`pronouncing` package), falling back to a vowel-group count for words not
  in it; the table above is that script's output.
- **Not yet checked:** any audio. Pronunciation, dropped negations, the
  voice, and the pace need a take and a listen.
