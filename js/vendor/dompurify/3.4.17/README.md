# DOMPurify 3.4.17

`purify.min.js` is the unmodified browser distribution from the npm package
`dompurify@3.4.17` (upstream: https://github.com/cure53/DOMPurify).
The upstream dual Apache-2.0/MPL-2.0 licenses are included in `LICENSE` and
`LICENSE-MPL`.

Narration notes load this local copy to sanitize pasted and stored rich text.
When updating, copy the release's `dist/purify.min.js` and both license files, update the
versioned script path in `_layouts/narration-notes.html`, and run
`tests/narration-rich-notes.spec.js`, including its malicious-input cases.
