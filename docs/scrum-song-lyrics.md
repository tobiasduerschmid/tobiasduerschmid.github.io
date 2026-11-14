# Inspect and Adapt: a Scrum musical

A Broadway-style musical for `SEBook/process/scrum.md`. Each Scrum accountability
is a character with its own voice and introduces itself by singing its
responsibilities; then the cast runs one Sprint together, and the New Developer
quizzes them on a new team. **Status: take 5 is the soundtrack
(`assets/audio/inspect-and-adapt.m4a`), with the Scrum Master's voice changed
after generation (see "Take 5: one male voice, fixed after generation"), and
the live vector video is embedded in `SEBook/process/scrum.md` after the Scrum
Events section and plays at `/assets/song-player/inspect-and-adapt.html`.**
This file holds the learning design, the Suno lyric sheets and style prompts,
the voice-casting history, and the source check.
`_data/songs/inspect_and_adapt.yml` is the source of truth for the sung words,
their timing, and what the video shows.

## Learning design

**Function.** The song consolidates material students have already read or
watched (the chapter and its Scrum narration). It is not a first lesson.

**Outcome.** Given a new situation on a Scrum Team, the student names the
accountability, event, or artifact that handles it and says *why*: what that
part inspects or adapts, or what it is responsible for. The song's quiz (a
bus-tracker team) and the music-free check below (a clinic-booking team) both
use teams the verses never mention, so they test transfer rather than recall of
the song's example.

**Core claim (the hook).** "We can't predict it all; we learn from what we see.
That's empiricism." Then "Sprint after Sprint, inspect and adapt!"
*Hook-alone test:* a student who remembers only the refrain believes that Scrum
replaces up-front prediction with regular inspection and adaptation, and that
Transparency, Inspection, and Adaptation are its three pillars. That matches the
chapter, and nothing dangerous follows from the hook alone.

**Running example.** *Found It*, a campus lost-and-found app. It gives every
Scrum element a concrete moment and repeats nothing from the narration (Hall
Hopper), its summary quiz (a study-room booking app), the INVEST song, or *It
Works on My Machine*: the Sprint Goal (post a found wallet, and its owner gets a
ping), an impediment (the lost-and-found office won't share its log), feedback at
the Sprint Review (users want photos), and a process fix at the Sprint
Retrospective (merge as we go instead of all on the last night).

**Why a musical with roles.** Each accountability is a separate voice that sings
its own responsibilities, so *who is accountable for what* is carried by the
cast's voices as well as by the words. In the quiz the whole cast answers, and
every answer names the role, event, or artifact in words, so it doesn't depend on
recognizing a voice. This is original design synthesis, not a tested
intervention. The New Developer, Noah, stands in for the student, sung by a
light tenor: he says what a newcomer would ("Who's the boss?", "It works on my laptop,
so it's done, right?"), and the cast corrects him in the next section.

### The wrong ideas each scene corrects

| Wrong idea | Where the song corrects it |
| --- | --- |
| The Scrum Master is the boss or a project manager. | The Scrum Master's introduction: "No boss here", "I won't assign your tasks", "No project manager, a servant-leader, serving you". |
| Anyone can hand the team work. | Product Owner: "Not on the Product Backlog? Nobody builds it." Quiz 2 (the dean's email). |
| "Developers" means only programmers. | "We design, we code, we test"; three Developers with three different skills on stage. |
| The Daily Scrum is a status report. | "Is it a status report? No: it's us, for us!" Quiz 1. |
| Working on my laptop means done. | The Definition of Done scene; quiz 6. |
| A Sprint can stretch to fit the work. | "A fixed timebox, one month or less"; quiz 3. |
| When work grows, change the Sprint Goal. | "Trim the scope, not the goal: the Sprint Goal stays whole." |
| The Sprint Review and the Sprint Retrospective are the same meeting. | "Sprint Review: what we build. Sprint Retrospective: how." Quizzes 4 and 7, kept apart. |
| No boss means nobody keeps the team on track. | The chorus answers the New Developer's question with empiricism and the three pillars. |

**Left out on purpose**, to keep the load to roles, events, artifacts, and
pillars: the five Scrum values, SAFe, the Product Goal and the commitment of
each artifact (only the Sprint Goal and the Definition of Done appear), planning
poker, the Product Owner traps beyond "talk with users directly", the tension
between Scrum Master and Product Owner, and the Daily Scrum's three questions,
which the 2020 Scrum Guide no longer prescribes.

### Using it in class

- **Before:** students write one sentence answering "Who is the boss of a Scrum
  Team?" Keep it for later.
- **During:** the player pauses after each quiz question. Students say the role
  or event *and a reason* before the answer plays.
- **After, without playback:** the music-free check below, answered in plain
  sentences. Then students reread their first sentence and correct it.
- **Later:** a week on, the chapter's quiz (`_data/quizzes/scrum.yml`) gives
  new scenarios with feedback. This timing is a planning suggestion, not a
  tested schedule.

**Music-free check: a clinic-booking app team.** Answer each in one sentence,
with a reason.

1. The clinic's IT department hasn't approved the team's test server for two
   weeks. Who acts, and what is the problem called?
2. A nurse at the Sprint Review says the booking screen is confusing. What does
   the team change as a result?
3. A Developer says, "I'll skip the Daily Scrum. My manager reads the board
   anyway." What is lost?
4. The team keeps finding that nobody tested on a tablet. Which event changes
   that, and how might it change the Definition of Done?
5. Halfway through the Sprint, one story turns out three times bigger. What can
   change, and what can't?

*Answer key.* (1) The Scrum Master, who removes impediments the team can't clear
alone; it's an impediment. (2) The Product Backlog: the Product Owner adds or
reorders items; the Sprint Review inspects the Increment and adapts the Product
Backlog. (3) The Daily Scrum is the Developers inspecting progress toward the
Sprint Goal and adapting their plan for the day; reading a board is not that.
(4) The Sprint Retrospective, which inspects the process; the team might add
"tested on a tablet" to the Definition of Done. (5) The scope can be
renegotiated with the Product Owner; the Sprint Goal stays fixed.

**Evidence and limits.** Songs can help verbal recall under some conditions,
but that research does not show that a song improves judgment about Scrum.
That is why the outcome is checked without music. This draft has passed a
source check and a review of the text only; it has not been recorded or tried
with students.

## How Suno is made to sing each role

### Take 1: one voice throughout

The first take (not downloaded)
sang **every role in the same voice**. Compared with
what users report about Suno's handling of several singers, the first
sheet had five likely causes:

1. **"duet" was in Exclude Styles.** Community guides report that "duet" in the
   style field, together with "male and female vocals", is what makes Suno use
   two lead voices. Excluding it pushed the model toward one.
2. **The singers had labels, not names.** Tags like
   `[SCRUM MASTER (SM): SOLO MALE BASS-BARITONE]` gave the model no singer to
   track; guides report that named singers (`[Sam]`, `[Paula]`) hold better.
3. **Voices traded line by line**, with "SM:" and "PO:" prefixes inside
   sections, in the Daily Scrum scene and in the quiz. Guides report that
   alternating within a section breaks the voices apart into one.
4. **Five solo voices, two of them male**, told apart only by range (tenor
   versus bass-baritone). Suno doesn't reliably honor range alone.
5. **No cast declaration** at the top of the lyrics.

The *It Works on My Machine* sheet that the first version copied had worked once,
but that is one take of an operetta; it was not evidence that the recipe
transfers.

### Take 2: one named singer per section

| Name in the tags | Role | Voice | Why it should stay distinct |
| --- | --- | --- | --- |
| Sam | Scrum Master | deep, warm male baritone | the only male singer |
| Paula | Product Owner | powerful female mezzo-soprano, Broadway belt | the only female singer |
| Developers | Developers | mixed choir in unison | a group, not a solo |
| All | Whole Scrum Team | the whole cast | the chorus, the retrospective, and quiz answers |
| Noah | New Developer | speaks, never sings | a speaking voice, not a third singer |

The names are mnemonic (Sam for the Scrum Master, Paula for the Product Owner) and
live only in the tags. They are not sung, and captions show the role instead.

1. **The singers are anchored in three places:** the style field names them with
   their genders ("a duet between Sam (male) and Paula (female), with a choir"),
   a header tag declares the cast, and every section has a singer tag. This is
   the "three-location" method from a community guide, extended from two
   singers to a cast. It hasn't been tested on a cast before.
2. **One singer per section**, 4–8 lines each. The line-by-line trades are gone:
   the Developers ask and answer "Is it a status report?" themselves, the Product
   Owner sings the oversized story, and the retrospective belongs to the whole
   team (which is also more accurate: the Scrum Team holds it).
3. **Only two solo singers, of different genders.** The New Developer became a
   speaking part, so a third solo voice can't merge with the other two.
4. **"duet", "male and female vocals", and "choir" are now in the style
   field**, and none of them is excluded.
5. **The quiz is call and response with the whole cast answering**, the format
   the earlier songs recorded reliably. Each answer names the role or event.
6. **Each soloist still names their role in their first sung line**, so the role
   is in the words too.

### If a section still comes out in the wrong voice

Suno doesn't guarantee voice assignment; guides describe drift as expected. In
order of effort:

1. **Generate several takes** from the same sheet and keep the one with the
   fewest wrong sections.
2. **Replace Section** in Suno's editor on only the wrong section. Paste that
   section's lines with its singer tag, and put only that singer in the style
   for the replacement, e.g. "solo deep male baritone, Broadway pop-rock, same
   tempo and key".
3. **Saved Voices** (called Personas before v5.5): make one from a section that
   came out right, and apply it only when replacing that singer's sections.
   **Never apply one Voice to the whole song**: it gives every role that singer.
4. **Build it in parts.** Generate each singer's sections as separate songs with
   the same style, tempo, and key, download them, and I'll stitch them in order
   with `ffmpeg` (crossfades at section boundaries, tempo and key checked first).
   This always gives the right voices, at the cost of more generation and a
   less seamless band.

### Take 2: still one voice for the sung roles

Take 2 ("Inspect and Adapt.m4a", 4:30) was generated from the sheet below, but
the voices still don't follow the tags. Measured on the Demucs vocal stem, with
each section's time range taken from the timed lyrics Suno embeds in the
download (a subtitle track that keeps the singer tags):

| Tag | Sections | Median pitch per section | Voice similarity to the other sung roles |
| --- | --- | --- | --- |
| Sam (Scrum Master) | Verses 1, 2, 6, 10 | 208, 261, 148, 276 Hz | 0.95 to Paula, 0.95 to the Developers |
| Paula (Product Owner) | Verses 3, 4, 7, 11, 13 | 260, 292, 256, 173, 238 Hz | 0.98 to the Developers |
| Developers | Verses 5, 8, 9, 12 | 262, 265, 146, 290 Hz | — |
| All | Chorus, Verse 14, final chorus | 294, 295, 297 Hz | 0.85–0.93 |
| Noah, spoken | Intro, pre-chorus, bridge, outro | 87–143 Hz, little sustained pitch | 0.74–0.84 |

Sam, Paula, and the Developers sing in the same register, around middle C, and
their speaker embeddings (resemblyzer, cosine similarity of section averages)
are 0.95–0.98 alike. Sam is not an octave below Paula; two of his verses are
higher than hers. Only the spoken part and the full-cast choruses come out
different. A speech-trained speaker encoder is a rough tool on singing over
Demucs bleed, so the numbers support what was heard rather than replace it.

**Conclusion:** within one generation, tags, singer names, and the style field
did not assign voices. The parts that work (the choruses, Verse 14, the quiz, Noah's
other lines, the outro) can stay. The solo sections need to be replaced one at a
time, and so does the intro, which now opens differently.

### Quicker, less likely to work: Replace Section on take 2

In Suno's Song Editor, select each section's time range, choose **Replace**,
paste only that section's lines (no tags needed), and set the replacement style
to the one singer below. Do Sam's sections first, since a male baritone differs
most from the current voice, then listen before doing the rest. Verses 3 and 13
need replacing anyway, because "students" became "users" in them. If the
editor keeps the song's original style for a replacement and gives you the same
voice again, switch to building in parts (above).

| Time in take 2 | Section | Sung by | Lines (from the sheet below) |
| --- | --- | --- | --- |
| 0:00–0:13 | Intro | Noah, now a tenor | "Somebody lost a wallet" … "Who tells me what to do?" (new opening) |
| 0:13–0:29 | Verse 1 | Sam | "No boss here, my friend" … "a fixed time, then it's done." |
| 0:29–0:37 | Verse 2 | Sam | "No project manager" … "a wall you can't break through." |
| 0:37–0:53 | Verse 3 | Paula | "I'm the Product Owner" … "Nobody builds it. Stop." (now "users") |
| 0:53–1:02 | Verse 4 | Paula | "I answer all your questions" … "one by one." |
| 1:02–1:19 | Verse 5 | Developers | "We are the Developers" … "we hold to it, hand in hand." |
| 1:40–1:47 | Verse 6 | Sam | "The Sprint- a fixed timebox" … "the next is at the door." |
| 1:47–1:55 | Verse 7 | Paula | "Sprint Planning- first, the why" … "a ping right there." |
| 1:55–2:11 | Verse 8 | Developers | "The what- we pick what fits" … "Adapt: re-plan, keep pace." |
| 2:11–2:19 | Verse 9 | Developers | "Is it a status report?" … "won't share its log." |
| 2:19–2:27 | Verse 10 | Sam | "An impediment- I'm on it!" … "the data flows." |
| 2:27–2:35 | Verse 11 | Paula | "One story's twice as big?" … "never slides." |
| 2:38–2:49 | Verse 12 | Developers | "Definition of Done" … "back to the Product Backlog." |
| 2:49–2:57 | Verse 13 | Paula | "Sprint Review- inspect the product" … "it flies." (now "users") |

**Replacement style for Sam's sections:**

```text
Solo deep, warm male baritone, Broadway pop-rock musical, about 120 BPM, same key and band as the rest of the song, sung melody, crisp diction. One male singer only: no female voice, no choir.
```

**Replacement style for Paula's sections:**

```text
Solo powerful female mezzo-soprano with a Broadway belt, Broadway pop-rock musical, about 120 BPM, same key and band as the rest of the song, sung melody, crisp diction. One female singer only: no male voice, no choir.
```

**Replacement style for the Developers' sections:**

```text
Small mixed choir of male and female voices singing in unison, Broadway pop-rock musical, about 120 BPM, same key and band as the rest of the song, crisp diction. Group vocals only: no solo singer.
```

Once the voices are right, Saved Voices help keep them consistent: make a Voice
from a replaced section that sounds right and apply it to that singer's
remaining replacements, never to the whole song.

**Words to check by ear in take 2** (Whisper, unprompted, heard these
differently; Whisper is often wrong on sung words): "Found It" as "founded" in
the intro; an extra "That's him!" before "Empiricism!" in the first chorus;
"At the demo, riders" as "At the Devo, writers" (quiz 4); a garbled quiz 6
question ("Done needs tests. Code's reviewed, but no tests ran"); and "inspect
and adapt" as "inspect and attack" in the outro.

### Building it in parts (recommended)

Two whole-song generations sang every role in one voice. Replace Section
regenerates a section in the context of the audio around it, so it may well
bring back the same voice too (an inference, not tested). The dependable route is
to never ask one generation for more than one singer:

1. **Generate one song per singer** from the four sheets below. Each style prompt
   describes only that voice and excludes the others. Download each as **M4A**,
   which carries Suno's timed lyrics.
2. **I cut each section out** using those timed lyrics, separate its vocal
   with Demucs, and match it to take 2: tempo (take 2 runs at about 123 BPM) and
   key (B-flat major) are measured and corrected only if a part drifted, and
   each sung line is stretched slightly to fit the bar it fills in take 2.
3. **I lay the new vocals over take 2's own band** (its separated instrumental),
   so the music stays one continuous recording. Take 2's choruses, Verse 14,
   quiz, and Noah's later lines keep their original vocals.
4. **You listen**, and any seam that sounds wrong gets a plain crossfade
   between whole sections instead.

Risks I can't rule out until I have the parts: separation bleed, stretching
artifacts on long held notes, and a part whose phrasing doesn't fit take 2's bars.

**Sam, the Scrum Master** (song title "Sam parts"):

```text
[Verse 1]
No boss here, my friend-
I'm the Scrum Master, the coach.
I won't assign your tasks;
the team picks its approach.
I coach you to self-manage
and help you all learn Scrum.
I keep each event timeboxed-
a fixed time, then it's done.

[Verse 2]
No project manager-
a servant-leader, serving you.
I chase each impediment,
a wall you can't break through.

[Verse 3]
The Sprint- a fixed timebox,
one month or less, no more.
It holds the other events,
and the next is at the door.

[Verse 4]
An impediment- I'm on it!
Keep building, off I go.
The office signs the form;
by Friday, the data flows.
```

Style:

```text
Upbeat Broadway pop-rock musical, 123 BPM, 4/4, B-flat major. Vocal-forward, drum-driven, sparse: punchy steady drums and light piano, very little bass. One solo singer only: an extremely deep male bass, the lowest male voice, slow, calm, and warm. Sung as a melody, never rapped, one lyric line per bar, crisp diction.
```

Exclude: `female vocals, high notes, choir, backing vocals, duet, falsetto, rap, autotune`

**Paula, the Product Owner** (song title "Paula parts"):

```text
[Verse 1]
I'm the Product Owner-
one person, value's my call.
I talk with users directly,
not secondhand at all.
Needs become user stories;
I order them, value on top.
Not on the Product Backlog?
Nobody builds it. Stop.

[Verse 2]
I answer all your questions,
and when a story's done,
I check acceptance criteria
one by one.

[Verse 3]
Sprint Planning- first, the why:
the Sprint Goal we all share.
Post a found wallet-
its owner gets a ping right there.

[Verse 4]
One story's twice as big?
We'll cut it down to size.
Trim the scope, not the goal-
the Sprint Goal never slides.

[Verse 5]
Sprint Review- inspect the product:
a live demo, not slides.
Users ask for photos-
to the Product Backlog it flies.
```

Style:

```text
Upbeat Broadway pop-rock musical, 123 BPM, 4/4, B-flat major. Vocal-forward, drum-driven, sparse: punchy steady drums and light piano, very little bass. One solo singer only: a high, bright, powerful female soprano belt, confident. Sung as a melody, never rapped, one lyric line per bar, crisp diction.
```

Exclude: `male vocals, low notes, choir, backing vocals, duet, rap, autotune`

**The Developers** (song title "Developers parts"):

```text
[Verse 1]
We are the Developers-
we design, we code, we test.
Cross-functional, all skills here;
we self-manage all the rest.
We plan our Sprint's own work;
each day, we adapt the plan.
Definition of Done-
we hold to it, hand in hand.

[Verse 2]
The what- we pick what fits.
The how- we break it down.
Why, what, and how together-
our Sprint Backlog, written down.
Daily Scrum- fifteen minutes,
standing, same time, same place.
Inspect: on track to the Sprint Goal?
Adapt: re-plan, keep pace.

[Verse 3]
Is it a status report?
No- it's us, for us!
Day four- we're stuck:
the lost-and-found won't share its log.

[Verse 4]
Definition of Done-
reviewed, tests pass, tried on a phone.
Meet it all? It's usable:
the Increment has grown!
Miss one? It isn't done-
back to the Product Backlog.
```

Style:

```text
Upbeat Broadway pop-rock musical, 123 BPM, 4/4, B-flat major. Vocal-forward, drum-driven, sparse: punchy steady drums and light piano, very little bass. A mixed ensemble of men and women sings every line together in unison, like a Broadway chorus line. No solo singer. Sung as a melody, never rapped, one lyric line per bar, crisp diction.
```

Exclude: `solo vocal, rap, autotune, shouting`

**Noah, the New Developer** (song title "Noah parts"):

```text
[Intro]
Somebody lost a wallet,
left it in the hall.
Our app, Found It, finds it-
we bring it back, that's all.
I just joined the team-
six of us, one product too.
So who's the boss around here?
Who tells me what to do?

[Verse 1]
If nobody's the boss,
who keeps us all on track?

[Verse 2]
It works on my laptop-
so it's done, right?

[Verse 3]
First Sprint done- no boss in sight,
just a team that learns.
```

Style:

```text
Upbeat Broadway pop-rock musical, 123 BPM, 4/4, B-flat major. Vocal-forward, drum-driven, sparse: punchy steady drums and light piano, very little bass. One solo singer only: a light, bright, young male tenor, eager and a little nervous. Sung as a melody, crisp diction.
```

Exclude: `female vocals, deep bass voice, choir, backing vocals, duet, rap, autotune`

If one of these still comes out in the wrong voice, regenerate only that one.
Since each song has a single singer, a wrong result is easy to hear and cheap
to redo.

### Take 4 sheet: take 2's sound, a tenor New Developer, a deeper Scrum Master

Feedback on take 2: keep its music, make the New Developer a tenor and the
Scrum Master deeper. Take 2's sound, measured (four-stem Demucs split, librosa,
ffmpeg loudness):

| Feature | Take 2 |
| --- | --- |
| Tempo and key | about 123 BPM; B-flat major, clearest in the first half |
| Mix | vocal-forward and drum-driven: vocals 49% of the energy, drums 39%, bass 6%, everything else 6%, so a sparse band |
| Build | drums grow from about 20% of each section's energy in the intro and Verse 1 to 42–55% in Verse 14, the final chorus, the quiz, and the outro; the level rises about 8 dB from intro to outro |
| Breaks | the band drops out under the spoken bridge and outro lines |
| Lead vocal | centred on middle C (5th–95th percentile A♯2–F♯4) |
| Master | −16.1 LUFS integrated, loudness range 6.5 LU |

The instrument names in the prompt ("light piano") come from the take 2 prompt;
the separation shows a faint melodic layer but can't name the instrument.

**Changes from take 3:**
- The New Developer sings, as a light young tenor. His lines are rewritten from
  spoken prose into short rhymed lines ("Somebody lost a wallet, / left it in the
  hall") because long sung lines get crammed. Quiz questions stay spoken, by the
  same tenor.
- The Scrum Master is an "extremely deep bass, the lowest male voice". In take 2
  his sections sat around middle C.
- The per-role accompaniment from take 3 (horns, upright bass, claps) is gone, so
  every section keeps take 2's sound; the voices differ by range and character.
- Two male voices are back (tenor and bass). If Suno merges them, the pitch check
  shows it: the bass sections should sit far below the tenor's.

4,972 characters.

**Style of Music** (973 characters):

```text
Upbeat Broadway pop-rock musical, 123 BPM, 4/4, B-flat major throughout. Vocal-forward, drum-driven, sparse: punchy steady drums and light piano, very little bass, the band stays out of the singers' way. The drums build through the song, light in the intro and first verses, fuller from the middle, fullest in the final chorus and quiz; the band drops out for the tenor's short questions. Four clearly different voices, never blended; each section uses only the voice in its tag. Male Vocal, light young tenor: bright, high, eager. Male Vocal, extremely deep bass: the lowest male voice, slow, calm, warm. Female Vocal, high soprano belt: bright, powerful, confident. Group Vocals: men and women in unison. Full Choir: the whole cast. Male and female vocals, duet, choir. Sung as a melody, never rapped, one lyric line per bar, crisp diction. Only the chorus shouts. Pop quiz: game-show call and response, the tenor speaks each question and the full choir sings the answer.
```

**Exclude Styles:** `rap, hip hop, patter, double-time vocals, autotune, operatic vibrato, screaming, mumble, lo-fi, EDM drop`

```text
[Intro: Male Vocal, light young tenor, B-flat]
Somebody lost a wallet,
left it in the hall.
Our app, Found It, finds it-
we bring it back, that's all.
I just joined the team-
six of us, one product too.
So who's the boss around here?
Who tells me what to do?

[Verse 1: Male Vocal, extremely deep bass, B-flat]
No boss here, my friend-
I'm the Scrum Master, the coach.
I won't assign your tasks;
the team picks its approach.
I coach you to self-manage
and help you all learn Scrum.
I keep each event timeboxed-
a fixed time, then it's done.

[Verse 2: Male Vocal, extremely deep bass, B-flat]
No project manager-
a servant-leader, serving you.
I chase each impediment,
a wall you can't break through.

[Verse 3: Female Vocal, high soprano belt, B-flat]
I'm the Product Owner-
one person, value's my call.
I talk with users directly,
not secondhand at all.
Needs become user stories;
I order them, value on top.
Not on the Product Backlog?
Nobody builds it. Stop.

[Verse 4: Female Vocal, high soprano belt, B-flat]
I answer all your questions,
and when a story's done,
I check acceptance criteria
one by one.

[Verse 5: Group Vocals, mixed unison, B-flat]
We are the Developers-
we design, we code, we test.
Cross-functional, all skills here;
we self-manage all the rest.
We plan our Sprint's own work;
each day, we adapt the plan.
Definition of Done-
we hold to it, hand in hand.

[Pre-Chorus: Male Vocal, light young tenor, B-flat]
If nobody's the boss,
who keeps us all on track?

[Chorus: Full Choir, whole cast, B-flat]
We can't predict it all-
we learn from what we see.
That's EMPIRICISM!
TRANSPARENCY- the work is on the wall!
INSPECTION- check it often, catch it small!
ADAPTATION- off course? Change it, don't stall!
Sprint after Sprint-
inspect and adapt!

[Verse 6: Male Vocal, extremely deep bass, B-flat]
The Sprint- a fixed timebox,
one month or less, no more.
It holds the other events,
and the next is at the door.

[Verse 7: Female Vocal, high soprano belt, B-flat]
Sprint Planning- first, the why:
the Sprint Goal we all share.
Post a found wallet-
its owner gets a ping right there.

[Verse 8: Group Vocals, mixed unison, B-flat]
The what- we pick what fits.
The how- we break it down.
Why, what, and how together-
our Sprint Backlog, written down.
Daily Scrum- fifteen minutes,
standing, same time, same place.
Inspect: on track to the Sprint Goal?
Adapt: re-plan, keep pace.

[Verse 9: Group Vocals, mixed unison, B-flat]
Is it a status report?
No- it's us, for us!
Day four- we're stuck:
the lost-and-found won't share its log.

[Verse 10: Male Vocal, extremely deep bass, B-flat]
An impediment- I'm on it!
Keep building, off I go.
The office signs the form;
by Friday, the data flows.

[Verse 11: Female Vocal, high soprano belt, B-flat]
One story's twice as big?
We'll cut it down to size.
Trim the scope, not the goal-
the Sprint Goal never slides.

[Bridge: Male Vocal, light young tenor, B-flat]
It works on my laptop-
so it's done, right?

[Verse 12: Group Vocals, mixed unison, B-flat]
Definition of Done-
reviewed, tests pass, tried on a phone.
Meet it all? It's usable:
the Increment has grown!
Miss one? It isn't done-
back to the Product Backlog.

[Verse 13: Female Vocal, high soprano belt, B-flat]
Sprint Review- inspect the product:
a live demo, not slides.
Users ask for photos-
to the Product Backlog it flies.

[Verse 14: Full Choir, whole cast, B-flat]
Sprint Retrospective- the process:
how did we work this time?
We merged it all on the last night-
next Sprint, we merge as we go!
Sprint Review- what we build.
Sprint Retrospective- how.
Then round we go- Sprint Planning,
the next Sprint starts right now!

[Final Chorus: Full Choir, whole cast, B-flat]
We can't predict it all-
we learn from what we see.
That's EMPIRICISM!
TRANSPARENCY- the work is on the wall!
INSPECTION- check it often, catch it small!
ADAPTATION- off course? Change it, don't stall!
Sprint after Sprint-
inspect and adapt!

[Pop Quiz: tenor speaks each question, Full Choir answers, B-flat]
Pop quiz! A new team, a bus-tracker app!
A manager wants the Daily Scrum as a status report. Okay?
No- it's the Developers' plan for the day!
A dean emails a Developer: add dark mode now! Start coding?
Not yet- it goes on the Product Backlog!
Last day, three stories left. Stretch the Sprint a week?
No- the timebox stays fixed!
At the demo, riders say the map's too hard to read. Which event? What changes?
Sprint Review- the Product Backlog changes!
Their server license is stuck in Purchasing. Who chases it?
The Scrum Master- it's an impediment!
Done needs tests. Code's reviewed, but no tests ran. Does it count?
Not done- back to the Product Backlog!
Testing gets skipped, Sprint after Sprint. Which event fixes the habit?
Sprint Retrospective- change how we work!

[Outro: Male Vocal, light young tenor, B-flat]
First Sprint done- no boss in sight,
just a team that learns.
[Full Choir, whole cast, B-flat]
We can't predict it all-
so we inspect and adapt!
```

**What to check on the take:** the bass sections should sit roughly 80–200 Hz,
the tenor's 200–450 Hz, and the soprano's 350–700 Hz (planning ranges, not
thresholds), and the bass should come out clearly below the tenor.

### Take 4: the woman switches, the men don't

Take 4 ("Inspect and Adapt(1).mp3", 4:51) was generated from the take 4 sheet.
Sections were located by aligning Whisper's word timings to the sheet (681 of
705 words matched), then measured on the Demucs vocal stem:

| Role | Tag | Median pitch per section | Voice similarity |
| --- | --- | --- | --- |
| Product Owner | Female Vocal, high soprano belt | 313–469 Hz (D♯4–A♯4) | 0.69 to the Scrum Master: **a distinct female voice** |
| Scrum Master | Male Vocal, extremely deep bass | 233–266 Hz (A♯3–C4) | 0.88 to the New Developer, 0.93 to the Developers |
| New Developer | Male Vocal, light young tenor | 159–234 Hz | lower than the Scrum Master in the intro and outro |
| Developers | Group Vocals, mixed unison | 265–311 Hz | 0.93 to the Scrum Master; Verse 8 came out in the female voice |
| Bridge (one tenor line, spoken-sounding) | Male Vocal, light young tenor | 113 Hz | the most distinct male part (0.68 to the Scrum Master) |

Suno now switches reliably between a man and a woman, but it sings every male
part with one male voice in its comfortable range: "extremely deep bass" was
ignored, and "Group Vocals" didn't produce a group. Speech is the one male sound
that comes out deep and distinct (113 Hz here, 87–143 Hz in take 2).

### Take 5 sheet: a spoken, deep Scrum Master

Changes from take 4, each aimed at a measured failure:

- **Scrum Master: `Spoken Word, deep male voice`.** He talks calmly in rhythm
  over the beat, like a coach, instead of singing. Speech is the only way the
  takes so far have produced a deep male voice that differs from the singing
  one. His lines are already short and rhymed, so they work spoken.
- **New Developer: `Male Vocal, high boy-band tenor`**, sung high in head voice,
  so he isn't left as the only male singer in a middle register.
- **Developers: `Choir, mixed voices`**, the same keyword family as the
  choruses, which came out as a group.
- **Product Owner: unchanged.** `Female Vocal, high soprano belt` worked.

If you'd rather keep take 4, only the Scrum Master's four sections need fixing.
Use Replace Section on them with the style "Spoken word, a deep, calm older male
voice talking in rhythm over the beat, never singing": 0:22–0:38 (Verse 1),
0:38–0:46 (Verse 2), 1:51–1:58 (Verse 6), and 2:31–2:39 (Verse 10).

4,924 characters.

**Style of Music** (895 characters):

```text
Upbeat Broadway pop-rock musical, 123 BPM, 4/4, B-flat major. Vocal-forward, drum-driven, sparse: punchy drums, light piano, little bass; the drums build from light verses to a full final chorus and quiz. Four clearly different voices, never blended, each only in its tagged sections. Male Vocal, high boy-band tenor: a young man singing high, light, and bright, in head voice. Spoken Word, deep male voice: a much older man who talks calmly in rhythm over the beat, very deep and warm, like a coach; he never sings and never raps. Female Vocal, high soprano belt: a woman, powerful and confident. Choir: a group of men and women singing together. Full Choir: the whole cast. Male and female vocals, duet, choir. Sung as a melody, one lyric line per bar, crisp diction. Only the chorus shouts. Pop quiz: game-show call and response; the tenor asks each question, the full choir sings the answer.
```

**Exclude Styles:** `rap, hip hop, patter, double-time vocals, autotune, operatic vibrato, screaming, mumble, lo-fi, EDM drop`

```text
[Intro: Male Vocal, high boy-band tenor, B-flat]
Somebody lost a wallet,
left it in the hall.
Our app, Found It, finds it-
we bring it back, that's all.
I just joined the team-
six of us, one product too.
So who's the boss around here?
Who tells me what to do?

[Verse 1: Spoken Word, deep male voice, B-flat]
No boss here, my friend-
I'm the Scrum Master, the coach.
I won't assign your tasks;
the team picks its approach.
I coach you to self-manage
and help you all learn Scrum.
I keep each event timeboxed-
a fixed time, then it's done.

[Verse 2: Spoken Word, deep male voice, B-flat]
No project manager-
a servant-leader, serving you.
I chase each impediment,
a wall you can't break through.

[Verse 3: Female Vocal, high soprano belt, B-flat]
I'm the Product Owner-
one person, value's my call.
I talk with users directly,
not secondhand at all.
Needs become user stories;
I order them, value on top.
Not on the Product Backlog?
Nobody builds it. Stop.

[Verse 4: Female Vocal, high soprano belt, B-flat]
I answer all your questions,
and when a story's done,
I check acceptance criteria
one by one.

[Verse 5: Choir, mixed voices, B-flat]
We are the Developers-
we design, we code, we test.
Cross-functional, all skills here;
we self-manage all the rest.
We plan our Sprint's own work;
each day, we adapt the plan.
Definition of Done-
we hold to it, hand in hand.

[Pre-Chorus: Male Vocal, high boy-band tenor, B-flat]
If nobody's the boss,
who keeps us all on track?

[Chorus: Full Choir, whole cast, B-flat]
We can't predict it all-
we learn from what we see.
That's EMPIRICISM!
TRANSPARENCY- the work is on the wall!
INSPECTION- check it often, catch it small!
ADAPTATION- off course? Change it, don't stall!
Sprint after Sprint-
inspect and adapt!

[Verse 6: Spoken Word, deep male voice, B-flat]
The Sprint- a fixed timebox,
one month or less, no more.
It holds the other events,
and the next is at the door.

[Verse 7: Female Vocal, high soprano belt, B-flat]
Sprint Planning- first, the why:
the Sprint Goal we all share.
Post a found wallet-
its owner gets a ping right there.

[Verse 8: Choir, mixed voices, B-flat]
The what- we pick what fits.
The how- we break it down.
Why, what, and how together-
our Sprint Backlog, written down.
Daily Scrum- fifteen minutes,
standing, same time, same place.
Inspect: on track to the Sprint Goal?
Adapt: re-plan, keep pace.

[Verse 9: Choir, mixed voices, B-flat]
Is it a status report?
No- it's us, for us!
Day four- we're stuck:
the lost-and-found won't share its log.

[Verse 10: Spoken Word, deep male voice, B-flat]
An impediment- I'm on it!
Keep building, off I go.
The office signs the form;
by Friday, the data flows.

[Verse 11: Female Vocal, high soprano belt, B-flat]
One story's twice as big?
We'll cut it down to size.
Trim the scope, not the goal-
the Sprint Goal never slides.

[Bridge: Male Vocal, high boy-band tenor, B-flat]
It works on my laptop-
so it's done, right?

[Verse 12: Choir, mixed voices, B-flat]
Definition of Done-
reviewed, tests pass, tried on a phone.
Meet it all? It's usable:
the Increment has grown!
Miss one? It isn't done-
back to the Product Backlog.

[Verse 13: Female Vocal, high soprano belt, B-flat]
Sprint Review- inspect the product:
a live demo, not slides.
Users ask for photos-
to the Product Backlog it flies.

[Verse 14: Full Choir, whole cast, B-flat]
Sprint Retrospective- the process:
how did we work this time?
We merged it all on the last night-
next Sprint, we merge as we go!
Sprint Review- what we build.
Sprint Retrospective- how.
Then round we go- Sprint Planning,
the next Sprint starts right now!

[Final Chorus: Full Choir, whole cast, B-flat]
We can't predict it all-
we learn from what we see.
That's EMPIRICISM!
TRANSPARENCY- the work is on the wall!
INSPECTION- check it often, catch it small!
ADAPTATION- off course? Change it, don't stall!
Sprint after Sprint-
inspect and adapt!

[Pop Quiz: tenor asks, Full Choir answers, B-flat]
Pop quiz! A new team, a bus-tracker app!
A manager wants the Daily Scrum as a status report. Okay?
No- it's the Developers' plan for the day!
A dean emails a Developer: add dark mode now! Start coding?
Not yet- it goes on the Product Backlog!
Last day, three stories left. Stretch the Sprint a week?
No- the timebox stays fixed!
At the demo, riders say the map's too hard to read. Which event? What changes?
Sprint Review- the Product Backlog changes!
Their server license is stuck in Purchasing. Who chases it?
The Scrum Master- it's an impediment!
Done needs tests. Code's reviewed, but no tests ran. Does it count?
Not done- back to the Product Backlog!
Testing gets skipped, Sprint after Sprint. Which event fixes the habit?
Sprint Retrospective- change how we work!

[Outro: Male Vocal, high boy-band tenor, B-flat]
First Sprint done- no boss in sight,
just a team that learns.
[Full Choir, whole cast, B-flat]
We can't predict it all-
so we inspect and adapt!
```

**What to check on the take:** the Scrum Master's sections should have little
sustained pitch and sit around 80–150 Hz, the tenor's sung sections around
250–450 Hz, and the Developers' sections should no longer match the tenor's voice.

### Take 5: one male voice, fixed after generation

Measured on the vocal stem (Demucs, pYIN pitch, Resemblyzer speaker
embeddings): the Developers came out as a group and the Product Owner stayed
a distinct woman, but the Scrum Master was sung, not spoken, by the New
Developer's voice (speaker similarity 0.96, where 1.0 is the same voice and
the man/woman pair measures 0.72). Five takes have now shown that one Suno
generation will not sing two different men, whatever the tags say.

So the fix is applied to the recording instead. The shipped version is a
gentle tone colour: the Scrum Master's four sections (Verses 1, 2, 6, and 10)
of the Demucs vocal stem get a zero-phase EQ, +3 dB below 250 Hz and −3 dB
above 3 kHz (slightly warmer and darker), added to the mix only as the
difference it makes, with a 0.3 s crossfade centred on each cut. Nothing else
in the recording changes, and the coloured voice stays sample-aligned with the
original, so its crossfades can't comb or break. The two voices now measure
0.95 alike (0.96 untouched): the same singer, slightly warmer.

Two earlier versions re-synthesised the voice with Praat's Change Gender
(formants ×0.82, then ×0.92, pitch unchanged). Both were heard as "way too
strong" and reverb-like, and the second still broke at 2:19, where the
Developers' "…its log" runs straight into "An impediment" with no pause: the
resynthesis smears the stem's reverb, the voice Demucs leaves in the
instrumental doubles it, and its crossfade there ran into the Developers'
sung note.


## Lyric sheet (Suno-ready)

4,409 characters, under Suno's 5,000-character limit. Verse lines are 5–7
syllables, and no rhyming pair goes over 14; chorus lines run to 10, which the
earlier choruses sang cleanly. Noah's lines are short and rhymed, since he now
sings; the quiz questions stay full spoken sentences. A dash follows a term ("The Sprint- a
fixed timebox"), the punctuation Suno sang best on the last take. Captions get
proper punctuation when the take is aligned.

```text
[Musical: Noah male tenor, Sam male bass, Paula female soprano, the Developers mixed choir]

[Intro]
[Noah]
Somebody lost a wallet,
left it in the hall.
Our app, Found It, finds it-
we bring it back, that's all.
I just joined the team-
six of us, one product too.
So who's the boss around here?
Who tells me what to do?

[Verse 1]
[Sam]
No boss here, my friend-
I'm the Scrum Master, the coach.
I won't assign your tasks;
the team picks its approach.
I coach you to self-manage
and help you all learn Scrum.
I keep each event timeboxed-
a fixed time, then it's done.

[Verse 2]
[Sam]
No project manager-
a servant-leader, serving you.
I chase each impediment,
a wall you can't break through.

[Verse 3]
[Paula]
I'm the Product Owner-
one person, value's my call.
I talk with users directly,
not secondhand at all.
Needs become user stories;
I order them, value on top.
Not on the Product Backlog?
Nobody builds it. Stop.

[Verse 4]
[Paula]
I answer all your questions,
and when a story's done,
I check acceptance criteria
one by one.

[Verse 5]
[Developers]
We are the Developers-
we design, we code, we test.
Cross-functional, all skills here;
we self-manage all the rest.
We plan our Sprint's own work;
each day, we adapt the plan.
Definition of Done-
we hold to it, hand in hand.

[Pre-Chorus]
[Noah]
If nobody's the boss,
who keeps us all on track?

[Chorus]
[All]
We can't predict it all-
we learn from what we see.
That's EMPIRICISM!
TRANSPARENCY- the work is on the wall!
INSPECTION- check it often, catch it small!
ADAPTATION- off course? Change it, don't stall!
Sprint after Sprint-
inspect and adapt!

[Verse 6]
[Sam]
The Sprint- a fixed timebox,
one month or less, no more.
It holds the other events,
and the next is at the door.

[Verse 7]
[Paula]
Sprint Planning- first, the why:
the Sprint Goal we all share.
Post a found wallet-
its owner gets a ping right there.

[Verse 8]
[Developers]
The what- we pick what fits.
The how- we break it down.
Why, what, and how together-
our Sprint Backlog, written down.
Daily Scrum- fifteen minutes,
standing, same time, same place.
Inspect: on track to the Sprint Goal?
Adapt: re-plan, keep pace.

[Verse 9]
[Developers]
Is it a status report?
No- it's us, for us!
Day four- we're stuck:
the lost-and-found won't share its log.

[Verse 10]
[Sam]
An impediment- I'm on it!
Keep building, off I go.
The office signs the form;
by Friday, the data flows.

[Verse 11]
[Paula]
One story's twice as big?
We'll cut it down to size.
Trim the scope, not the goal-
the Sprint Goal never slides.

[Bridge]
[Noah]
It works on my laptop-
so it's done, right?

[Verse 12]
[Developers]
Definition of Done-
reviewed, tests pass, tried on a phone.
Meet it all? It's usable:
the Increment has grown!
Miss one? It isn't done-
back to the Product Backlog.

[Verse 13]
[Paula]
Sprint Review- inspect the product:
a live demo, not slides.
Users ask for photos-
to the Product Backlog it flies.

[Verse 14]
[All]
Sprint Retrospective- the process:
how did we work this time?
We merged it all on the last night-
next Sprint, we merge as we go!
Sprint Review- what we build.
Sprint Retrospective- how.
Then round we go- Sprint Planning,
the next Sprint starts right now!

[Final Chorus]
[All]
We can't predict it all-
we learn from what we see.
That's EMPIRICISM!
TRANSPARENCY- the work is on the wall!
INSPECTION- check it often, catch it small!
ADAPTATION- off course? Change it, don't stall!
Sprint after Sprint-
inspect and adapt!

[Pop Quiz: call and response, Noah speaks each question, All answer]
Pop quiz! A new team, a bus-tracker app!
A manager wants the Daily Scrum as a status report. Okay?
No- it's the Developers' plan for the day!
A dean emails a Developer: add dark mode now! Start coding?
Not yet- it goes on the Product Backlog!
Last day, three stories left. Stretch the Sprint a week?
No- the timebox stays fixed!
At the demo, riders say the map's too hard to read. Which event? What changes?
Sprint Review- the Product Backlog changes!
Their server license is stuck in Purchasing. Who chases it?
The Scrum Master- it's an impediment!
Done needs tests. Code's reviewed, but no tests ran. Does it count?
Not done- back to the Product Backlog!
Testing gets skipped, Sprint after Sprint. Which event fixes the habit?
Sprint Retrospective- change how we work!

[Outro]
[Noah]
First Sprint done- no boss in sight,
just a team that learns.
[All]
We can't predict it all-
so we inspect and adapt!
```

### Suno style prompt

**Style of Music** (full, 715 characters):

```text
Modern Broadway pop-rock musical, about 120 BPM, bright major key, piano and punchy drums, sparse band under the voices. This is a duet between Sam (male) and Paula (female), with a choir and a spoken narrator. Sam: an extremely deep male bass, the lowest male voice. Paula: a powerful female mezzo-soprano with a Broadway belt. The Developers: a mixed choir singing in unison. All: the whole cast together. Noah: a light, bright, young male tenor. Each section is sung only by the singer named in the tag above it. Male and female vocals, duet, choir. Sung as a melody, never rapped, one lyric line per bar, crisp diction. Only the chorus shouts. Pop quiz: game-show call and response, Noah asks and the whole cast answers.
```

**Style of Music** (short, for a field limited to about 200 characters):

```text
Broadway pop-rock musical, duet between Sam (male baritone) and Paula (female mezzo belt), mixed choir, spoken narrator Noah, male and female vocals, sung melody, crisp diction
```

**Exclude Styles:**

```text
rap, hip hop, patter, double-time vocals, autotune, operatic vibrato, screaming, mumble, lo-fi, EDM drop
```

Take 1 excluded `duet` and "spoken word"; both are now allowed, because "duet"
is what asks Suno for a second lead voice and Noah's part is spoken. Starting settings, as on earlier
takes: Weirdness about 30%, Style Influence about 70%. Suno has ignored tempo
requests before, so treat "about 120 BPM" as a hint.

### Pronunciation and performance notes

| Written | Sung as | Note |
| --- | --- | --- |
| EMPIRICISM | "em-PEER-ih-siz-um" | If a take garbles it, respell it in the Suno sheet only: "em-PEER-ih-sizm". |
| Retrospective | "ret-roh-SPEK-tiv" | Sung twice in the contrast line and once in the quiz. |
| Found It | two words, "FOUND it" | The app's name. Captions write *Found It*. |
| Sam, Paula, Noah | not sung | Singer names appear only in tags. If a take sings one, rename that singer in the tags and the style field. |
| Sprint Review / Sprint Retrospective | | Near-identical terms: Suno has swapped such pairs before. They are only sung side by side in the contrast line, where the difference is the point. |
| Product Backlog / Sprint Backlog | | Same risk. The Sprint Backlog is sung only in Sprint Planning, sections away from the Product Owner's lines. |
| "Is it a status report?" / "No- it's us, for us!" | | The Developers ask and answer this themselves, so it stays in one voice. |

## Storyboard

The storyboard is `_data/songs/inspect_and_adapt.yml`, timed against take 5
(Whisper word timestamps aligned to the sheet: 686 of 705 words matched), and
the choreography is `js/song-video/songs/inspect_and_adapt.js` with
`js/song-video/scrum-scenes.js` and `js/song-video/scrum-kit.js`. It plays in the
Found It team's office (`js/song-video/team-room.js`). Act one draws
each accountability in the CS 130 lecture's metaphor, with the costume to
match: the Scrum Master is the team coach (a track jacket, a whistle, a
clipboard) beside a basketball court where the Developers pick their own
plays; the Product Owner is the value navigator (a sea coat, a compass pin, a
spyglass) over a chart whose waypoints are the user stories, ordered by
value; the Developers are the builders stacking the Increment. Each role's
slide lists what it is accountable for and what it is not. Every character is
the gender of the voice that sings it on take 5: the New Developer and the
Scrum Master are men, the Product Owner is a woman, and the Developers, sung
by a mixed choir, are two men and a woman. The chorus raises
empiricism on its three pillars. Act two runs one Sprint on a strip of the
four events above a Scrum board whose story cards move as the lyrics move
them; the coach's and the navigator's emblems return when they act. The Sprint
loop is drawn as that strip rather than as the chapter's state diagram, which
only fits above the cast at an unreadable size.

## Quiz audit

Every question uses the bus-tracker team, which the verses never mention, and
each answer gives a reason. The whole cast sings every answer, and each answer
names the role, event, or artifact in words; no two neighbouring answers end on
the same phrase.

| # | Situation | Answer and reason | Concept | Spotlighted on stage |
| --- | --- | --- | --- | --- |
| 1 | A manager wants the Daily Scrum as a status report | No: it's for the Developers, to adapt their plan | Daily Scrum's purpose | Developers |
| 2 | A dean emails a Developer a feature | Not yet: it goes on the Product Backlog first | Single source of work; Product Owner | Product Owner |
| 3 | Last day, work left; stretch the Sprint? | No: the timebox is fixed | The Sprint | Scrum Master |
| 4 | Riders find the map hard to read at the demo | Sprint Review; the Product Backlog changes | Sprint Review inspects the product | Sprint Review on the loop |
| 5 | A license stuck in Purchasing | Scrum Master; it's an impediment | Scrum Master | Scrum Master (after the team, not next to quiz 3's answer phrase) |
| 6 | Reviewed but untested, and Done needs tests | Not done; back to the Product Backlog | Definition of Done, Increment | Developers |
| 7 | Testing skipped every Sprint | Sprint Retrospective; change how we work | Sprint Retrospective inspects the process | Sprint Retrospective on the loop |

Quizzes 4 and 7 are the Sprint Review and Sprint Retrospective pair; they are
three questions apart, so a student can't answer the second by contrast with the
first. No question's wording contains its answer's keyword: quiz 7 says "the
habit", not "the process" or "how we work".

## How each line matches the sources

The chapter is `SEBook/process/scrum.md`. Lecture locators are taken from the
sources table in `docs/scrum-narration.md` (CS 130 lecture 16); the slides
themselves were not opened for this draft.

| Lyric | Claim | Source |
| --- | --- | --- |
| "No boss here", "I won't assign your tasks", "the team picks its approach" | No hierarchy; the team is self-managing; the Scrum Master doesn't assign work | Chapter, Scrum Roles; flashcard 7; lecture 16, slides 10–12 and 17–19 |
| "I coach you to self-manage and help you all learn Scrum" | Scrum Master coaches self-management and helps everyone understand Scrum | Narration (lecture 16, slides 17–19; Scrum Guide 2020) |
| "I keep each event timeboxed, a fixed time, then it's done" | Scrum Master ensures events are kept within their timebox, a fixed maximum duration | Narration; lecture 16, slides 17–19 |
| "No project manager, a servant-leader, serving you"; "I chase each impediment" | Servant-leader, not a project manager; removes impediments | Chapter, Scrum Roles |
| "One person, value's my call" | The Product Owner is one person, accountable for maximizing value | Chapter; narration (lecture 16, slide 14) |
| "I talk with users directly, not secondhand" | Talk with customers directly (fix for the "telephone" trap) | Narration (lecture 16, slides 15–16) |
| "Needs become user stories; I order them, value on top" | Product Owner writes stories and orders the Product Backlog | Chapter, Scrum Roles and Artifacts |
| "Not on the Product Backlog? Nobody builds it" | The Product Backlog is the single source of work | Narration (lecture 16, slide 22) |
| "I answer all your questions … I check acceptance criteria" | Product Owner answers questions; checks acceptance criteria | Narration (lecture 16, slide 14) |
| "We design, we code, we test"; "Cross-functional … self-manage" | Developers are everyone who builds; cross-functional; self-managing | Chapter, Scrum Roles; narration |
| "We plan our Sprint's own work; each day, we adapt the plan"; "Definition of Done, we hold to it" | Developers create the Sprint Backlog, adapt daily, and hold to the Definition of Done | Narration (lecture 16, slide 13) |
| Chorus: "can't predict it all … learn from what we see"; the three pillars; "the work is on the wall" | Empiricism; Transparency, Inspection, Adaptation | Chapter, Scrum Theory (the "work is on the wall" wording is the chapter's) |
| "A fixed timebox, one month or less … holds the other events … the next is at the door" | The Sprint | Chapter, Scrum Events |
| "First, the why: the Sprint Goal"; "the what … the how … our Sprint Backlog" | Sprint Planning's three topics form the Sprint Backlog | Chapter; narration (lecture 16, slides 23 and 26) |
| "Daily Scrum, fifteen minutes, standing, same time, same place"; "Inspect: on track to the Sprint Goal? Adapt: re-plan"; "it's us, for us" | Daily Scrum inspects progress toward the Sprint Goal and adapts the plan; not a status report | Chapter; narration (lecture 16, slide 27) |
| "Trim the scope, not the goal" | Scope renegotiated with the Product Owner; Sprint Goal fixed | Narration (lecture 16, slide 23) |
| "Definition of Done … Meet it all? It's usable: the Increment has grown … Miss one? … back to the Product Backlog" | Definition of Done; the Increment is usable and additive; unfinished work returns | Chapter, Artifacts; flashcard 11; narration (lecture 16, slide 24) |
| "Sprint Review, inspect the product: a live demo, not slides … to the Product Backlog" | Review inspects the Increment with stakeholders and adapts the Product Backlog | Chapter, Scrum Events; narration (lecture 16, slide 28) |
| "Sprint Retrospective, the process"; "merge as we go" | Retrospective inspects how the team works | Chapter; narration (lecture 16, slide 29) |
| "Sprint Review: what we build. Sprint Retrospective: how." | The review changes what the team builds next; the retrospective, how it works | Narration's own wording |

"Merge as we go" is this song's example of a process improvement, not a claim
from the sources. "Standing" follows the course's "stand-up"; the 2020 Scrum
Guide does not require it.

## Checks on each take

Download the take (or send me the share link), and I'll run these:

1. **Every section in its tagged voice.** Split the take into stems with Demucs
   and track pitch on the vocal stem (pYIN), section by section. Sam's sections
   should sit clearly below Paula's, roughly an octave, and the Developers' and
   All sections should show several voices at once rather than one clean pitch
   line. These are planning expectations, not thresholds. Timbre needs a
   listener: I can't hear it. List each wrong section for a Replace Section fix.
2. **Noah speaks.** His lines should have no sustained pitch.
3. **No singer name sung aloud** ("Sam", "Paula", "Noah"), and every role name
   sung in full. Use unprompted Whisper passes on 2–15 s clips: long prompts
   make Whisper hallucinate on music.
4. **No swapped pairs**: Sprint Review and Sprint Retrospective, Product Backlog
   and Sprint Backlog.
5. **All seven quiz answers sung.** An earlier take skipped a whole answer.
6. **Pace**: verse lines near 3–4 syllables per second.
7. **Stereo balance** per section, as on *Draw It Out* take 7. With several
   voices, Suno may pan them apart, which is fine if it stays put; it shouldn't
   wander within a section.
