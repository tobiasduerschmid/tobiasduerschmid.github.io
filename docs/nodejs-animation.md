# Node.js narrated introduction

The Node.js reference page embeds a roughly nine-minute introduction with
locally generated Kokoro speech and no music. Its typography, gold stickers,
outlined objects, and terminal graphics follow the song videos. The player now
uses distinct light and dark palettes that follow the site's theme. Artwork
uses responsive HTML and CSS so code remains readable at narrow widths.

## Teaching sequence

Runtime versus language; JavaScript declarations and function syntax; the same
file read with blocking and non-blocking APIs; callback values and error handling;
promises and await; a small HTTP server; modules and npm; an output prediction.

Every snippet begins with a concrete purpose. The narration then explains new
syntax, follows actual values, and traces output. A single `note.txt` containing
`Hello from disk.` carries through the blocking, callback, and promise examples.
The sequence pretrains syntax before tracing execution, holds the example constant
while contrasting I/O behavior, and ends with a retrieval prompt and a five-second
thinking pause. Both success and failure paths are worked examples, not just
labels. It explicitly distinguishes passing from calling a function,
concurrent I/O from parallel JavaScript, and suspending an async function from
blocking its thread. These choices follow the pedagogical-advisor skill's
multimedia, cognitive-load, and retrieval guidance.

## Sources and outputs

- `_data/explainers/nodejs.yml`: narration, purpose and prerequisite context for
  each snippet, visual descriptions, examples, voice, pronunciations, and pauses.
- `_data/explainers/nodejs_timing.json`: actual measured cue times and source hash.
- `assets/audio/nodejs-basics.mp3`: Kokoro `af_heart`, speed `0.95`, 24 kHz mono,
  48 kbps MP3. Only the compressed file is published, not the working WAVs.
- `assets/narration/nodejs-basics.txt`: plain, pronunciation-adjusted TTS input.
- `assets/narration/nodejs-basics.vtt`: captions with code names preserved.
- `_includes/nodejs-animation*.html`, `css/nodejs-animation.css`, and
  `js/nodejs-animation-art.js`: Node.js-specific structure and poses.
- `_includes/narrated-explainer*.html`, `css/narrated-explainer.css`, and
  `js/narrated-explainer.js`: shared player, code presentation, and transcript.

Native audio is the sole playback clock. Seeking derives the complete visual state
from that clock; it does not replay accumulated timers. Nothing autoplays. Native
controls provide keyboard operation, reduced motion disables travel, and the full
transcript includes the code and visual descriptions. Without JavaScript, native
audio and the transcript still work. Print exposes the transcript, not the player.
No player preferences are persisted and no custom keyboard shortcuts are added.

Each cue has a semantic `pose`, a short conceptual `step` and `note`, and optional
one-based `focus` lines. Poses do not depend on cue indexes, so inserting an
explanation cannot silently shift the graphics to the wrong concept. The shared
code include renders the same source shown in the transcript. `alternate_code`
supports the inline callback and the terminal-to-JavaScript package example.
Rouge highlights complete snippets at build time, preserving multiline syntax
before splitting into numbered lines. The transcript uses the same highlighter
without line numbers. Syntax colors stay separate from the gold execution marker,
follow the selected theme, and become monochrome in print.
Graphics distinguish file work, the JavaScript thread, and ready callbacks, and
use labels and shapes in addition to color. Motion represents progress or transfer,
not decoration. Reduced motion jumps directly to the complete teaching state.

## Regenerating Kokoro speech

The optional renderer uses [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx)
and its [v1.0 model and voice files](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1).
Generation is local; model files are not shipped to the browser. Install
`kokoro-onnx==0.6.1`, `soundfile>=0.13`, and `pyyaml` in an isolated Python
environment. SoundFile's bundled libsndfile encodes the compressed MP3, so no
separate system encoder is needed. Run:

```sh
python scripts/render-explainer-narration.py --topic nodejs \
  --model /path/to/kokoro-v1.0.onnx \
  --voices /path/to/voices-v1.0.bin
bundle exec jekyll build --incremental
```

The renderer caches individual cues under `/tmp/nodejs-kokoro-render`. Editing one
cue only synthesizes that cue again. It regenerates audio, captions, the plain
script, and the timing manifest together. Review changed speech before publishing.
The narration is synthetic, not a recording of a human speaker.

The required `--topic` argument selects `nodejs`, `react`, or `observer`; outputs
follow that storyboard's declared audio, caption, and script paths, with a sibling
`<topic>_timing.json` file.

Pronunciation substitutions affect only speech and the downloadable TTS script.
Captions, visual labels, and code retain the proper technical spellings.
`Javascript` prevents eSpeak from splitting the camel-case name into two stressed
words; `Node JS`, `NPM`, `UTF`, and `lib UV` keep letter groups together rather than
over-stressing each isolated initial. `Jason` supplies the usual pronunciation of
JSON in the spoken file name. Check phonemes as well as speech when adjusting
these entries: many phonetic-looking respellings produce identical phonemes.

## Verification

```sh
node --test scripts/tests/nodejs-narration.test.js
node --test scripts/tests/explainer-narration.test.js
node --test scripts/tests/code-highlight.test.js
A11Y_INTERACTIVE_CHECKS=1 npx playwright test tests/nodejs-animation.spec.js
WCAG_AUDIT_URL_FILTER='^/SEBook/tools/nodejs.html$' \
  npx playwright test tests/wcag22-complete-audit.spec.js \
  --grep 'page audit matrix'
```

The browser checks cover transport, forward and backward seeking, output order,
callback outcomes, every narrated pose, narrow-screen reflow, dark mode, reduced
motion, print, the no-JavaScript fallback, and scoped accessibility checkpoints.
Node tests execute the worked examples to verify their stated outputs as well as
checking audio, script, caption, and timing consistency. They do not replace listening to the audio or manual
assistive-technology review.
