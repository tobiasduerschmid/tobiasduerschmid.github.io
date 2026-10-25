# It Works on My Machine: rewritten lyrics

New lyrics for the CS 35L comic opera *It Works on My Machine*, for a new Suno
take. **Status: not recorded yet.** The current take and its music video
(`_data/songs/it_works_on_my_machine.yml`) still use the first lyrics. The voice
tags, the section order, and the line count of every section are unchanged, so
each voice is cast the way the first take sang it, and the video's acts can be
re-cut for the new examples.

What changed from the current take:

- **One product runs through the opera: a concert-ticket app.** The
  coffee-ordering app is gone, and so is its one-coffee-versus-twenty example.
  The Teammate builds "one ticket, one name", locked to the buyer, without asking
  fans. The Product Manager sings the user story he never asked about: "As a
  fan, I want to pass my ticket on, so a friend can use my seat when I can't
  come along."
- **New examples, same concepts.** No act reuses a worked example from the
  lectures, the SEBook, or the other songs (the homework-submission story, the
  urllib3 release, PayPal, the INVEST song's stories). Each act teaches the
  course's idea on the ticket app instead, so students transfer it to a new case.
- **Each teammate now sings the rule, in the course's words.** "Pin your
  versions" (reuse chapter), "Test what it does, not how" (Lecture 9: test
  behavior, not implementation details), "Hide choices that change in one
  module" (Lecture 15, after Parnas), "Never force-push! Merge first!"
  (Lecture 4), and "Rotate those credentials" (the git chapter's word; the old
  sheet said "revoke").
- **Act II names the failure mode, not a historic incident:** a new major
  version ("version two") changed the package's API, so a clean build broke
  code nobody had touched.
- **Act III ties tests back to Act I.** The good test checks the story's
  outcome, in Given / When / Then style ("then my friend's ticket should show"),
  not the order of the helpers.
- **Act IV no longer teaches a misconception.** The old verse ("My tables are
  open… No wrappers! No layers!") framed information hiding as hiding data.
  Lecture 15 and the chapter name that as the most common misconception: it is
  about hiding *design decisions likely to change*. The decision is now how
  showtimes are handled: every page does its own time math, the Teammate
  switches the stored times to UTC, and every showtime moves.
- **The teammates get the last word together.** "Step away from the keyboard!"
  is now sung by all six, not spoken by the Security Engineer alone.
- **"Your graph is much cleaner" is replaced** by "Some sprint that you saved
  us!", an angry jab at the Teammate's promise from the intro.
- **"Fortnight" is gone.** The intro now promises "I'll save us a whole sprint",
  the course's Scrum word, which the Back-End Developer throws back at him.
- Kept: the intro, the refrain and its growing count (6, 26, 96), the lockfile
  verse, the force-push and secrets verses, and every punchline ("six lovely
  hues", "overnight mail", "there goes my whole night", "aged overnight", "my
  weekend is gone", "funding THEIRS instead").

## Lyric sheet (Suno-ready)

The first line of every stanza starts with its singer's short form, and the second stanza of
each teammate's section repeats the singer in a tag, because the first take
sometimes handed a second stanza to another voice. The short forms are defined
in each singer's first tag: TM = the Teammate (tenor), PM = Product Manager,
BE = Build Engineer, TE = Test Engineer, UI = UI Developer, BD = Back-End
Developer, SE = Security Engineer, ALL = the six teammates together. Captions
drop the prefixes.

Same meter as the first take: two stresses a line, about six syllables then
five, rhymes on the second and fourth lines; no rhyming pair is over 14
syllables. Under Suno's 5,000-character limit.

```text
[Intro: SOLO MALE TENOR = THE TEAMMATE (TM), warmly grand]
TM: No need to worry!
Just leave it to me!
I'll save us a whole sprint—
We'll ship it by three!

[Verse 1: TM — requirements]
TM: Requirements? Quite simple!
Tickets- buy and go!
No need to ask users—
I'm certain I know!

TM: One ticket! One name!
How sleek! How refined!
I'll save them a meeting—
They'll thank me in time!

[PRODUCT MANAGER (PM): SOLO FEMALE LIGHT SOPRANO]
PM: As a fan, I want
To pass my ticket on,
So a friend can use my seat
When I can't come along!

[PM continues solo]
PM: I promised a demo
Of what they could use.
You've built the wrong product—
In six lovely hues!

[TM, helpfully]
TM: Transfers? Quite simple!
I'll borrow the code!

[Verse 2: TM — reuse and lockfiles]
TM: Design with reuse!
Why build it anew?
A package for transfers
Will know what to do!

TM: No lockfile to fuss with!
Let new versions in!
New versions mean fixes—
A sensible win!

[BUILD ENGINEER (BE): SOLO FEMALE ALTO]
BE: Your laptop kept old ones;
My clean build got new.
Version two changed the A-P-I—
Your calls won't go through!

[BE continues solo]
BE: Next time, pin your versions!
Till then, the builds fail.
Shall I ship them your laptop
By overnight mail?

[Refrain: SOLO MALE TENOR, bright catchy melody]
TM: It works on my machine!
The finest code you've seen!
One tiny fix—
Or five or six—
And all the lights turn green!

[Verse 3: TM — brittle tests]
TM: I'll make this more solid!
I'll test every call!
The order of helpers—
I'll check it all!

TM: My implementation
Is captured just so!
If one small step changes,
The tests will say NO!

[TEST ENGINEER (TE): SOLO FEMALE MEZZO-SOPRANO]
TE: I merged two small helpers;
The transfer worked right.
Your brittle tests failed—
There goes my whole night!

[TE continues solo]
TE: Test what it does, not how-
Then my friend's ticket should show!
They're in love with your old code
And won't let it go!

[Verse 4: TM — information hiding]
TM: Information hiding?
What's there to conceal?
Each page reads the showtime
Its own way! Ideal!

TM: Let every page do the math!
It's simple! Direct!
I'll switch them to U-T-C—
What could that affect?

[UI DEVELOPER (UI): SOLO FEMALE COLORATURA SOPRANO]
UI: Now tickets, reminders,
And check-in need repair!
One detail has changed—
It's used EVERYWHERE!

[UI continues solo]
UI: Hide choices that change
In one module— right?
You moved every showtime—
I've aged overnight!

[Refrain: TM solo, same catchy melody]
TM: It works on my machine!
The finest code you've seen!
One tiny fix—
Or twenty-six—
And all the lights turn green!

[Verse 5: TM — Git force-push]
TM: I'll squash all my changes
To one tidy line!
Then force-push to shared main—
That history will shine!

TM: One clean line of progress!
Less clutter to see!
Review will be easy—
That's teamwork from me!

[BACK-END DEVELOPER (BD): SOLO FEMALE LOW MEZZO-SOPRANO]
BD: I pushed all our fixes!
They're gone from shared main!
You forced your OLD history—
We're broken again!

[BD continues solo]
BD: Never force-push! Merge first!
I'll restore them by dawn.
Some sprint that you saved us!
My weekend is gone!

[TM, eager to help]
TM: I'll take the deployment!
You get some sleep!

[Verse 6: TM — committed secrets]
TM: The keys live in dot-env,
Not hard-coded now!
A safer deployment—
Allow me to bow!

TM: I add the whole folder;
One push, and we're done!
At last, a smooth handoff
For everyone!

[SECURITY ENGINEER (SE): SOLO FEMALE DRAMATIC CONTRALTO]
SE: Dot-env's not in gitignore—
You committed the keys!
Our PUBLIC repo hands them
To strangers with ease!

[SE continues solo]
SE: Thieves are spinning up servers;
We're deep in the red!
You wanted a launch—
We're funding THEIRS instead!

[TM, quickly and nervously]
TM: I'll add it to gitignore!

[SE: SOLO FEMALE DRAMATIC CONTRALTO]
SE: That won't uncommit it!
Old copies remain!
Rotate those credentials—
They're spending again!

[Final Refrain: TM solo, soaring operatic high notes]
TM: It works on my machine!
The finest code you've seen!
One tiny fix—
Or ninety-six—
And all the lights turn green!

[TM sustains "green" triumphantly]
[Orchestra stops abruptly]

[Spoken: TM, genuinely puzzled]
TM: Strange.
It worked on my machine.

[Spoken: TM, confidence returning]
TM: I'll just make one small change.

[ALL six women sing together, firm and grand]
ALL: Step away from the keyboard!

[One magnificent orchestral chord]
[End]
```

### Suno style prompt

The first take was generated from the sheet's tags alone, with no style text on
record. If the new take drifts (a teammate's verse sung by the tenor, or a duet
in a solo), add this to **Style of Music**:

```text
Comic opera, operetta in the style of Gilbert and Sullivan, full orchestra, bright brass and strings, brisk 3/4 and 4/4 patter. Seven solo singers: a warm, grand male tenor as the Teammate, and six female soloists (light soprano, alto, mezzo-soprano, coloratura soprano, low mezzo-soprano, dramatic contralto), one per section as tagged; the six women sing together only in the final line. Crisp diction, every word clear, sung as a melody, not rapped. The women sing their own sections solo; the tenor sings the refrains solo. His spoken lines at the end are dry and deadpan.
```

**Exclude Styles:** `duet, choir, backing vocals, rap, autotune, pop, EDM`

### Pronunciation and performance notes

| Written | Sung as | Note |
| --- | --- | --- |
| A-P-I | "ay-pee-eye" | Spelled with hyphens so Suno sings the letters. Captions write "API". |
| U-T-C | "you-tee-see" | Same. Captions write "UTC". |
| dot-env | "dot-env" | Captions write ".env", as before. |
| gitignore | "git-ignore" | As before. |
| "Test what it does, not how-" | | Hold a breath before "Then", so the Gherkin "Then" lands on the downbeat. |

Check on the new take, as with earlier songs: every teammate's rule line is
sung in full ("Next time, pin your versions", "Test what it does, not how",
"Hide choices that change", "Never force-push! Merge first!", "Rotate those
credentials"), all six voices join on "Step away from the keyboard!" (Suno
may leave one singer alone; fix it with a section replace), and "transfer" is sung in Act III, not swapped with "transfers" or "tickets".

## How each act matches the course

Each act carries a course concept on a new example; the right column names the
course's own example, which the song deliberately does not repeat.

| Act and lines | Concept and source | The course's own example |
| --- | --- | --- |
| I. "No need to ask users"; "As a fan, I want to pass my ticket on, so a friend can use my seat when I can't come along"; "You've built the wrong product" | Requirements elicitation builds the right system; the As a / I want / so that format (L1; SEBook User Stories) | Homework resubmission before the deadline; BER airport |
| II. "No lockfile… Let new versions in"; "Your laptop kept old ones; my clean build got new"; "Version two changed the API"; "pin your versions" | Keep dependency versions fixed with a lockfile; update on purpose (L12; SEBook Reuse, Principles 1–2) | urllib3 2.0.0 breaking docker |
| III. "The order of helpers— I'll check it all"; "I merged two small helpers; the transfer worked right"; "Test what it does, not how: then my friend's ticket should show" | Test behavior, not implementation details; a test should pass any correct implementation; assertions come from acceptance criteria (L9; SEBook Good Tests) | Stack and discount examples |
| IV. "Each page reads the showtime its own way"; "I'll switch them to UTC"; "It's used EVERYWHERE"; "Hide choices that change in one module" | Hide design decisions likely to change; data formats are a common secret; not "make it private" (L15; SEBook Information Hiding) | PayPal in every service |
| V. "Force-push to shared main"; "They're gone"; "Never force-push! Merge first!" | Force push removes others' changes; always merge first (L4; SEBook Git) | Lecture diagram only |
| VI. "I add the whole folder"; ".env's not in gitignore"; "That won't uncommit it!"; "Rotate those credentials" | Secrets never enter history; `.gitignore` is not a security tool; rotate a leaked key (SEBook Git; L4 `.gitignore`, `git add -A`) | A teammate's committed `.env` (Git chapter self-check) |

Left out on purpose, to keep each act to one idea: left-pad and Heartbleed
(Lecture 12's other reuse lessons), test doubles by name, and Lecture 11's
attacks. The UTC switch stands for any change to how showtimes are stored;
the time math itself is not taught.
