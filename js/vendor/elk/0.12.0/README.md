# ELK.js 0.12.0

Unmodified `lib/elk-api.js`, `lib/elk-worker.min.js`, and `LICENSE.md` from
https://registry.npmjs.org/elkjs/-/elkjs-0.12.0.tgz.

Upstream source: https://github.com/kieler/elkjs
License: Eclipse Public License 2.0 (included).

The object-reference renderer loads the API and runs layout in the local worker.
`elk-api.mjs` wraps the unmodified API body with lexical CommonJS bindings and
an ESM default export. This prevents Monaco's AMD loader from capturing its
anonymous module. To regenerate, prepend `const module = { exports: {} };` and
`const exports = module.exports;` to `elk-api.js`, then append
`export default module.exports;` (the header explains the adapter).

No third-party CDN or browser persistence is introduced. The existing synchronous
channel router is the fallback for a failed load or layout.
