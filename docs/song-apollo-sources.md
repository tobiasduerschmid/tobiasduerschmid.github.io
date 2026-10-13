# Information-hiding song: Apollo and car records

The scene at 79–87 seconds illustrates software scale, not a precise ratio of
complexity or engineer productivity. These sources support the labels and the
matching transcript and extended audio description.

- **Hamilton, role, and photograph (1969):** [NASA / MIT, Margaret Hamilton’s
  Apollo Code](https://science.nasa.gov/people/margaret-hamilton/). Hamilton led
  the MIT Instrumentation Laboratory’s Software Engineering Division. The
  photograph shows listings developed by her and the command/lunar module
  flight-software team she led. The portrait was developed with the built-in image-generation tool from
  this photograph, then converted to smooth vector paths with VTracer. The
  shipped SVG has no embedded bitmap or external resource dependencies. The credit names her as
  lead software engineer for Apollo onboard flight software, not sole author.
- **Apollo 11 (1969), approximately 80,000 lines of code:** calculated from
  the [transcribed command and lunar module sources](https://github.com/chrislgarry/Apollo-11/tree/911e5c0283c629c50cb97666f34065e8c07d71a5)
  at revision `911e5c0283c629c50cb97666f34065e8c07d71a5`. Count nonblank lines
  not beginning with `#` after stripping leading whitespace, in every `.agc`
  file directly in `Comanche055` and `Luminary099`. This gives 39,913 + 40,205 =
  **80,118** source lines, including assembler directives. The two directories
  contain 130,186 physical lines when comments and blanks are included. The
  graphic rounds to 80,000 and explicitly says comments are excluded. This
  count is not an estimate of the entire photographed stack or all Apollo
  software versions, and it is not the number of binary machine instructions.
- **Modern car (2021), approximately 100 million lines of code:** [Bosch’s
  January 11, 2021 CES remarks](https://www.bosch-presse.de/pressportal/de/en/sustainable-like-a-bosch-smart-climate-friendly-solutions-for-health-home-industry-and-mobility-223381.html)
  give 100 million lines for contemporary non-automated vehicles. This is a
  vehicle-wide industry estimate, not an audited count for a named model.
  Its original source does not specify the same comment/blank-line convention
  used above; the transcript and narration state that scopes differ.

To reproduce the Apollo count from that revision, from the archive root:

```python
from pathlib import Path
for module in ('Comanche055', 'Luminary099'):
    lines = (line for file in Path(module).glob('*.agc')
             for line in file.read_text().splitlines())
    print(module, sum(bool(line.strip()) and not line.lstrip().startswith('#')
                      for line in lines))
```

## Portrait production

The source reference is the user-supplied 1969 Hamilton photograph. The final
asset is `assets/song-art/margaret-hamilton-apollo.svg`; only that SVG ships.
The image-generation intermediate and tracing tools are not runtime dependencies.
The image-generation prompt requested: an abstract full-body editorial illustration with simplified warm ivory and charcoal planes matching the music video
of Hamilton and the bound listings on transparency, preserving her face, smile,
wire glasses, long wavy hair, patterned dress, stockings, buckled shoes, raised
hands, natural adult proportions, and the continuous stack; smooth restrained tonal
planes and crisp edges, without cartoon exaggeration, thick outlines, labels,
watermarks, a room background, or photographic noise.

VTracer settings: color, stacked, spline; speckle filter 6; color precision 6;
layer difference 16; corner threshold 90; length threshold 3; max iterations 10;
splice threshold 45; path precision 2. The SVG viewBox crops unused transparent
margins. Hand-authored smooth silhouette clipping removes tracing fringe and detached edge fragments around the figure and paper stack. Its title identifies the subject; in the player the visual is decorative
because the record, transcript, and audio description supply its meaning.

The legs and buckled flats are hand-authored smooth vector shapes, replacing
the traced lower-body artwork. Their silhouettes and shading use closed curves
so the edges remain clean at fullscreen magnification.

The bound listings were also rebuilt as hand-authored vector volumes with shared
page boundaries, curved edges, sparse page rules, and dark cover lips.
