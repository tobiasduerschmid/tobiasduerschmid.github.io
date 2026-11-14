# Let the Object Decide: revised lyrics

Lyric repairs for the object-oriented programming song on `SEBook/oop-song.md`.
**Status: recorded and integrated.** Take 2 ("Let the Object Decide" (2))
sings the sheet below and is the song on the chapter page;
`_data/songs/let_the_object_decide.yml` holds the words as sung, with their
timing.

### How take 2 came out

- Every revised line was sung as written, including "even minus ten",
  "thirty-seven to change", "them apart", and "Now a Square" (Whisper heard
  the numbers as digits, "runtime" as one word, and "plain" as "plane").
- It is a full new take, not a section replace: about 92 BPM like take 1, but
  5:06 long instead of 5:45, so every line was re-aligned (781 of 819 words
  heard by Whisper; the rest, mostly quiet backing echoes, interpolated).
- It sings one final chorus. Take 1 repeated the final chorus with an ad-lib
  on its own; those two sections and their scenes are gone, and the curtain
  call is now the final chorus.
- Every quiz answer was sung. An unprompted clip pass confirmed the last one,
  whose "fine" is held for several seconds. In question 4 the answer follows
  "right?" with almost no gap, so each question now has a `pause_at` in the
  quiet before its answer.
- The stereo balance stays within 2 dB, so the soundtrack keeps both channels.

## What changed, and why

Six lines asked the listener to see the screen before they made sense. A student
who only hears the song (on a walk, with the screen off, or in the
audio-described cut) heard a bare number or a pronoun without a referent. Each
repair moves the meaning into the sung words and keeps the line's length, so
each one fits the slot its line had in take 1.

| Line (take 1) | Sung in take 1 | Revised | Why |
| --- | --- | --- | --- |
| `intro-8`, 21.1–23.8 s | "And any line can write any speed. (Minus ten?!)" | "Any code can set any speed— / even minus ten!" | "Any line" can be heard as "any lane" in a song full of lanes, and the bare "minus ten" never says what is −10. The revision states the problem with a table: nothing stops any code from setting an impossible speed. Verse 4's "who changed that speed?" calls back to it. |
| `intro-10`, 26.6–29.2 s | "Search for every type check… (Thirty-seven!)" | "Search the type checks: / thirty-seven to change!" | The bare number never said what 37 counts. Now it is 37 places to edit for one new kind of vehicle. |
| `verse-1-12`, 66.8–71.5 s | "Mine is red. Yours is doing eighty." | "Your car speeds up to eighty; / my car's still at twenty." | "Mine" and "yours" had no referent, and two different fields (color, speed) hid the point. Now one field changes in one object and not in the other, so the line teaches that each object keeps its own state. That corrects a common novice mistake: thinking that changing one object changes every object of its class. The cards on screen already show car 1 at speed 20 and car 2 going to 80. |
| `verse-2-8`, 126.0–128.1 s | "The light can't tell, and doesn't need to:" | "The light can't tell them apart:" | "Can't tell" had no object. "Them" is the gas car and the hybrid from the two lines before. "Apart" and "car" end on the same vowel, so the line rhymes with the next one, "how to brake stays in the car." The idea that the light doesn't need to know now comes from that next line. |
| `breakdown-5`, 172.0–174.2 s | "At run time, the call looks up the slot." | "At run time, the call looks in that table." | "The slot" was never introduced. "That table" points back to "its class's method table" in the line before, and matches the chapter's wording: "the call looks up the object's vtable at run time." |
| `bridge-7`, 197.5–199.6 s | "Set the width, set the width to a hundred;" | "Now a Square: set the width to a hundred;" | The take dropped the sheet's one-word pickup "Square:", so a listener can't tell that the second test runs on a Square, and "the height jumps too" sounds like a contradiction instead of a broken promise. "Now a Square" is a phrase, which Suno drops less often than a single word. It also mirrors "Rectangle: set the width…" and has the same 10 syllables. |

Everything else is unchanged. The hook ("Let the object decide"), the chorus,
and the quiz were already clear without the picture.

### Ear and truth checks

- **Prose back-translation.** Each revised line still says something true:
  global data lets any code write an invalid value; adding a type to a type
  switch means editing every switch; objects of one class have separate
  state; the caller sees only the interface; a virtual call is resolved
  through the vtable at run time; a Square that changes its height when its
  width is set breaks Rectangle's promise.
- **Referents.** Each pronoun or demonstrative in a revised line points back to
  something sung in the line before it ("them" → the gas car and the hybrid;
  "that table" → the method table).
- **Pace.** The revised lines have 13, 10, 13, 7, 10, and 10 syllables, against
  12, 10, 9, 9, 9, and 10 sung in the same slots now. In those slots that is
  2.8–4.9 syllables per second, the range that stayed easy to follow in the
  UML song's takes.
- **Sources.** The claims match `SEBook/oop-song.md`, sections "The Five Rules"
  (state and code inside; send a message; the object decides through the
  vtable at run time; keep the promise) and "Try It Without the Music"
  (question 2's new class versus new operation). The CS35L lecture slides were
  not checked for these six lines.
- **Not verified by ear.** These are text checks. A new take still needs the
  usual check that every word was sung: unprompted Whisper clip passes on each
  replaced spot, especially "minus ten", "thirty-seven", "them apart", and
  "Now a Square".

## Recording it

Take 2 was recorded as a full new take. For later fixes:

**Recommended: replace only the lines in question in the current take.** In Suno's song
editor, use Replace Section on each line's time range from the table above, with
the revised words and **Make Same Length as Section on**. Every other word, the
timing of the rest of the song, and the sound all stay as they are. Only the six
lines' word marks then need re-aligning before the choreography is updated.

**Alternative: a full new take** from the sheet below. That changes every
line's timing, so the whole storyboard has to be re-aligned. A new take may not
repeat the final chorus with an ad-lib the way take 1 did. If it
doesn't, the curtain-call and ad-lib scenes need re-timing or removing.

### Lyric sheet (4,874 characters)

```text
[Intro: spoken]
You're coding a city-builder game.
A table: x, y, speed, type.
Every frame, one big loop:
if it's a car, drive the lane;
if it's a bus, stop at the stop;
if it's a bike, take the bike lane.
Drawing? Same if-chain. Braking? Same again.
Any code can set any speed—
even minus ten!
And the mayor drops a feature request: ambulances.
Search the type checks:
thirty-seven to change!
That's not a city. That's a switch statement.
In the sixties, two Norwegians had a better idea:
make every thing in the world a thing in the code,
and let the object decide.

[Verse 1]
Sixty-six: Tony Hoare's record.
A car was just fields: x, y, speed.
No moves of its own. NPC energy. (NPC!)
Waiting for other code to read.
Then Dahl and Nygaard, in Simula. (Simulation!)
Gave each record work to do.
Now a car knows its place and speed,
and it can steer and brake, too.
Write the class once: the blueprint.
"New" builds a car, and a car, and a car:
same methods, different values.
Your car speeds up to eighty;
my car's still at twenty.

[Pre-Chorus]
Alan Kay, designing Smalltalk,
pictured objects as living cells,
or computers on a network
that only talk in messages.
So you don't reach in. You just... send it!

[Chorus]
Simulate the world in objects,
state and code locked up inside.
Don't reach in: send a message,
and let the object decide.
Same message, different moves!
Don't ask, "What type are you?"
Let the object decide!

[Post-Chorus]
Just send it! (Send it!)
Same message, different moves!
Just send it! (Send it!)
Let the object decide!

[Verse 2]
Red light! The old way:
the light reaches into every car
and sets its speed to zero. (Screech!)
No brake lights. Physics left the chat.
The new way: one message. "Brake!" (Brake!)
A gas car squeezes its brake pads;
a hybrid recharges its battery.
The light can't tell them apart:
how to brake stays in the car.
Getters and setters on every field?
That's a struct in a trench coat. (Busted!)

[Post-Chorus]
Just send it! (Send it!)
Same message, different moves!
Just send it! (Send it!)
Let the object decide!

[Verse 3]
Back to the city. Every frame: "Move!" (Move!)
Car? (Vroom!) Bus? (Next stop!) Bike? (Ring ring!)
One message, three different moves,
and the loop never asks what you are.
Then the mayor wants ambulances: (Wee-oo!)
one new class that knows how to move.
The loop? Not a single line changed. (Not one!)
Code that talks to a Vehicle
drives kinds you haven't written yet.

[Breakdown]
Okay, but how? Pop the hood! (Pop the hood!)
In C plus plus, mark the method virtual:
each object hides a pointer
to its class's method table, the vee-table.
At run time, the call looks in that table.
Not virtual? The compiler picks,
before the program runs.

[Chorus]
Same message, different moves!
Don't ask, "What type are you?" (Nah!)
Let the object decide!

[Bridge]
Plot twist! (Plot twist!)
Careful how you copy the world.
In math, a square's a rectangle,
so Square extends Rectangle. Easy, right?
Rectangle: set the width to a hundred;
the height stays twenty. (Still twenty!)
Now a Square: set the width to a hundred;
the height jumps too! (Wait, what?!)
A subclass must keep its parent's promises:
same messages, same meaning. (That's Liskov!)
Is-a in the world isn't enough.
Can't keep the promise? Don't inherit.
Share an interface. (Shape!)
Just want its code? Hold one inside, and delegate.

[Verse 4]
Big systems split into objects;
teams build each piece behind its interface.
Write a List once, reuse it app after app.
But there's a price! (A price!)
State spreads across a thousand objects:
who changed that speed? Good luck, detective.
New kind of thing? Add one class. (Easy!)
New kind of action? Touch every class. (Ouch!)
Things with state that act? Use objects.
Plain math? A plain function's fine.

[Quiz: lead asks, crowd shouts]
Stop time. Red flag or green flag?
Your game checks: if zombie, if creeper, if skeleton...
RED FLAG! Send one message!
Stack holds a list inside and only shows push and pop.
GREEN FLAG! That's delegation!
Shapes use radians. Square uses degrees.
RED FLAG! Broken promise!
C plus plus, not virtual: the object picks, right?
RED FLAG! The compiler picks!
Celsius to Fahrenheit? One plain function.
GREEN FLAG! A function's fine!

[Final Chorus]
Simulate the world in objects,
state and code locked up inside.
Don't reach in: send a message,
and let the object decide.
Same message, different moves!
Don't ask, "What type are you?" (Nah!)
Decide how, but keep the promise! (Keep the promise!)
Let the object decide!

[Post-Chorus]
Just send it! (Send it!)
Same message, different moves!
Just send it! (Send it!)
Let the object decide!

[Outro: spoken]
The ambulance rolls out.
One new class. The loop didn't change a line.
That's object-oriented programming:
simulate the world, one object at a time.
Now go touch, like, some real grass.
Let the object decide.
```

### Suno style prompt

The style of take 1 isn't on record, so this prompt describes the
recording as measured: tempo from its beat track, key from chroma, the mix
from Demucs stems, and the voice from pitch tracking on the vocal stem. If the
take's original **Style of Music** text is still on its Suno page, reuse that
instead, and for the recommended Replace Section route keep the song's own
style.

| Feature | Current take |
| --- | --- |
| Tempo | About 92 BPM (92.3 fitted to the percussion). |
| Key | G major in the intro; the rest reads as E minor, its relative minor (weak chroma fit, so treat as approximate). |
| Mix | Drum- and bass-driven and sparse: vocals carry about 29% of the energy, drums 37%, bass 30%, everything else 4%. |
| Lead vocal | One male voice, median about G3 (197 Hz), mostly G2–G4; the spoken intro and outro sit lower, around B2 and G2. |

**Style of Music** (full, 884 characters):

```text
Upbeat, playful pop with a hip-hop groove, 92 BPM, 4/4, G major, verses leaning on E minor. Drum- and bass-driven, sparse arrangement: punchy drums and a round bass carry the song, with only light keys or guitar, so the vocal sits clearly on top. One male lead, warm and confident, centred around G3, crisp diction. Verses are rhythmic but melodic and unhurried, one lyric line per bar, never fast or double-time. Spoken intro and outro over a light beat, deadpan and conversational. Big, catchy chorus with gang vocals on "Let the object decide!" and "Just send it!"; lines in parentheses are short backing-vocal echoes. The quiz is a playful call and response: the lead asks, a crowd shouts the red-flag or green-flag answer. Sing every technical word clearly and in full: object, message, virtual, vee-table, Liskov, interface, delegate, Rectangle, Square, minus ten, thirty-seven.
```

**Style of Music** (short, 191 characters):

```text
playful pop with a hip-hop groove, 92 BPM, G major, punchy drums and bass, sparse mix, warm male lead, crisp diction, unhurried verses, gang-vocal chorus, spoken intro, call-and-response quiz
```

**Exclude Styles:**

```text
fast rap, double-time vocals, mumble rap, trap hi-hat rolls, slurred vocals, heavy autotune, distorted vocals, screaming, heavy reverb, lo-fi muffled vocals, female vocals, duet, key change, EDM drop
```

Generate several candidates and keep the one closest to take 1: tempo
near 92 BPM, a male lead around G3, and every revised line sung in full.

### Pronunciation and performance notes

| Written | Sung as | Note |
| --- | --- | --- |
| vee-table | "V table" | The respelling is in the Suno sheet only; the storyboard keeps "v-table". |
| C plus plus | "C plus plus" | Already written out, so Suno doesn't sing "C" or "see plus". |
| minus ten | "minus ten" | Check it was sung, not dropped: it is the line's whole point. |
| Now a Square: | "Now a Square" | A two-word phrase rather than a one-word pickup, which Suno tends to drop. |
| (…) | quiet backing vocals | Suno sings lines in parentheses as quiet backing vocals. |
| RED FLAG! / GREEN FLAG! | crowd shout | The quiz answers. Suno ignores pause tags, so the player's `pause_at` makes the thinking pause. |

## Integrating a new recording

Once the replaced spots (or a new take) are aligned:

1. Update each revised line's `text` and `marks` in
   `_data/songs/let_the_object_decide.yml`. If a full take sings the long intro
   lines as two sheet lines, merge them back into one storyboard line, as the
   UML song's integration did.
2. Re-point the choreography's word marks in
   `js/song-video/songs/let_the_object_decide.js`, which use words that change:
   - `intro-8`: `line` and `write` (the three code chips and their arrows), plus `minus` and `ten` (the bus token reverses and the −10 stamp lands).
   - `intro-10`: `search`, `type`, and `seven` (the search box counts up to 37).
   - `verse-1-12`: `mine`, `red`, `yours`, and `eighty` (labels and card values). Swap the "mine" and "yours" cues to "your car", "eighty", "my car", and "twenty". The values already match.
   - `verse-2-8`: `light`, when the "What the light sees" panel appears.
   - `breakdown-5`: `call`, `slot`, and `run`. Light the vtable's move slot on "table" instead of "slot".
   - `bridge-7`: `set` and `width_2`, where the bench swaps in the Square.
3. Re-render the captions and the described cut with
   `node scripts/song-video/render.js let_the_object_decide`, and update the
   `visual` text of any line whose picture changed.
