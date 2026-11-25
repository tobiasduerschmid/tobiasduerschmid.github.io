# Module Blood Groups video narration

The narration at the top of `SEBook/designprinciples/blood-groups.md` teaches
software categories ("module blood groups": A, T, AT, and 0, plus R) by taking
apart one function of Glide, a campus scooter-rental app, and replaying the
changes that hurt it against a separated design. It is a video narration
(`docs/video-narration.md`). Script: `_data/narrations/blood_groups.yml`;
visual package: `_data/narration_visuals/blood_groups.json`; checks:
`_data/explainers/blood_groups_quizzes.yml`; notes:
`_data/explainers/blood_groups_notes.yml`; artwork:
`js/video-narration/blood-groups.js` and `blood-groups-kit.js` on the shared
wall kit, styled by `css/video-narration-blood-groups.css`, on the
`drafting-room` blueprint theme (a whiteprint by day).

## Teaching design

- **Running example.** Glide's `end_ride()` braids parking and pricing rules
  with map, payment, and Bluetooth calls. The group scenes pull its lines
  apart (rules become A, technology calls T, the zone math 0, the original
  stays AT); the design scenes rebuild it separated; the change scenes replay
  the same three changes (a new map provider, a finals-week rule, a
  bike-share reuse request) against both designs.
- **Order.** Motivation (the ride, the price hike, the tangle, three pains);
  the two questions; the four groups with a reuse profile each; the mixing
  rules; leaky interfaces; design rule 1 (minimize AT, maximize 0); design
  rule 2 (invert dependencies; thin adapters; R); frameworks; the change test;
  when not to separate; recap.
- **Predictions.** Which lines change when the map provider changes; which
  group the price function has after one payment call; which modules change
  in the separated design. Each pauses four seconds and is answered by the
  next cue.
- **Checks.** Twelve section checks and a four-question summary about a new
  system (a campus laundry app). Each applies a taught idea to a new
  situation; distractors come from confusions the narration addresses (a
  module that sounds technical is T; the group follows a module's main job;
  where code runs decides what it knows; wrapping everything is good design).
- **Speech.** No authors, books, or dates are spoken. Letters are written in
  contexts that force the letter reading ("group A", "an A module"); `AT` and
  `AB` are spelled out for the voice by pronunciation entries.

## Sources

The narration states ideas without naming sources (as the narrated lessons
do); this is where each comes from, for maintainers. "Lecture" is CMU 17-723
lecture 14, *Design For Reuse* (Dürschmid).

| Claim in the narration | Source |
|---|---|
| The programmer's nightmare: technical API return codes mixed with application problems in a few lines of code | Siedersleben and Denert 2000, section 1.2; Quasar Teil 1 (2003), p. 3. |
| Every system deals with the application (it is built for it) and with technical APIs (it cannot run in thin air); every piece of software belongs to exactly one category | Siedersleben and Denert 2000, section 1.2; Siedersleben et al. 1999 ("Segregating the Layers"), section 1.2.4; Quasar Teil 1, p. 3 ("every interface and every component belongs to exactly one category"). |
| "Knowing" means depending: "determined by" reads as "knows about", "depends on", or "is influenced by"; one technical API is enough | Siedersleben et al. 1999, section 1.2.4; architecture workshop 2000, slide 6. |
| Two questions, four groups (0, A, T, AT), named like blood groups | Siedersleben and Denert 2000, section 1.2; Siedersleben 2004, section 1.3.3 (colloquially called blood groups); lecture slide 22. |
| A is the code the business is paid for; A is reusable wherever the same application logic is needed, on any technology | Architecture workshop 2000, slide 6; Siedersleben and Denert 2000, section 1.2. |
| T is unavoidable and reusable wherever the same technology is used | Architecture workshop 2000, slide 6; Siedersleben et al. 1999, section 1.2.4. |
| 0 implements an abstract concept (containers, a dictionary, a state model); ideally reusable, useless on its own | Siedersleben and Denert 2000, section 1.2; Siedersleben et al. 1999, section 1.2.4; lecture slide 22. |
| AT is easy to write at a small scale, hard to maintain, resists change, almost never reusable; design quality falls as the share of AT code grows | Siedersleben et al. 1999, section 1.2.4 ("inversely proportional to the share of AT-code"); Siedersleben and Denert 2000, section 1.2; lecture slides 23 and 24. |
| The reuse chart: technology assumptions limit reuse to that technology, domain assumptions to that domain | Lecture slide 24. The four places of the chart are the narration's own illustration. |
| Mixing: 0 adds to any group without changing it; A + A = A, T + T = T, A + T = AT; the analogy to inherited blood types | Siedersleben and Denert 2000, section 1.2; architecture workshop 2000, slide 6. "AT absorbs everything" follows from the definition (code that knows both keeps knowing both); no source states it in those words. |
| Leaky interfaces: a query method that accepts SQL turns the application kernel into AT; translate technical errors into business errors | Siedersleben et al. 1999, section 2.5; Quasar Teil 2 (2003), p. 52. A 0 interface carries only neutral types: Quasar Teil 1, p. 6. |
| Design rule 1: minimize AT modules, maximize 0 modules; separate technological from application concerns; one technical API per T component, one topic per A component; single responsibility, sharpened | Lecture slide 24; Siedersleben and Denert 2000, sections 1.2 and 3; Quasar Teil 1, p. 3. |
| Design rule 2: avoid dependencies from large, complex A modules to T modules; invert the dependency; the A side states what, not how | Lecture slides 26 and 27; Quasar Teil 2, p. 41 (a technology-neutral interface says *that*, not *how*); Quasar Teil 1, p. 7 (the importer owns its support interface). Quasar itself plugs technology in behind standard neutral (0) interfaces; the lecture frames the same separation as dependency inversion. |
| The adapter is AT; R ("representation") is the mild, acceptable AT that only transforms between business objects and external representations, can be generated, and is the "positive Rhesus factor" | Lecture slide 28; Siedersleben and Denert 2000, section 1.2; architecture workshop 2000, slide 6; Quasar Teil 1, p. 3. |
| Domain classes that inherit from framework classes are married to the framework; put an adapter in front of large, complex domain classes | Lecture slide 28. |
| Replay changes and count what each touches; X changes touch only X software (X = R, T, A) | Siedersleben and Denert 2000, sections 1.1 and 3; architecture workshop 2000, slide 7; Quasar Teil 2, p. 13 (changing the persistence product re-implements only the adapters). |
| Modules that do not depend on the web, database, or UI are easier to test | Lecture slide 39; Quasar Teil 2, p. 17. |
| Do not hide the string class behind an interface; separation costs next to nothing at run time; over-engineering curve | Siedersleben 2004, sections 1.2 and 1.4; Quasar Teil 1, pp. 7 and 18; lecture slides 40 to 42. |

References:

- Siedersleben, J., and Denert, E. (2000). Wie baut man Informationssysteme? Überlegungen zur Standardarchitektur. *Informatik-Spektrum* 23(4), 247–257. doi:10.1007/s002870000110.
- Siedersleben, J., Albers, G., Fuchs, P., and Weigend, J. (1999). Segregating the Layers of Business Information Systems: An Interface-Based Approach. In *Software Architecture* (WICSA1), IFIP AICT, Springer, 389–403. doi:10.1007/978-0-387-35563-4_22.
- Siedersleben, J. (2004). *Moderne Softwarearchitektur: Umsichtig planen, robust bauen mit Quasar.* dpunkt.verlag.
- Siedersleben, J. (2000). Gedanken zur Architektur von Informationssystemen (14 slides). sd&m architecture workshop, Munich.
- Hess, A., Humm, B., Scheidle, S., and Siedersleben, J. (2003). *Quasar: Die sd&m Standardarchitektur, Teil 1*, 2nd ed. sd&m Research; and Siedersleben, J. (ed.) (2003). *Teil 2*, 2nd ed.
- Dürschmid, T. *Design For Reuse*, CMU 17-723 Designing Large-scale Software Systems, lecture 14.
