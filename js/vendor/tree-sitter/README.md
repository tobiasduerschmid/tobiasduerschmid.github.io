# tree-sitter (Java and C++ parsing)

Unmodified files from the npm registry:

- `web-tree-sitter-0.25.10/` — `tree-sitter.js`, `tree-sitter.wasm`, and `LICENSE`
  from <https://registry.npmjs.org/web-tree-sitter/-/web-tree-sitter-0.25.10.tgz>
  (source: <https://github.com/tree-sitter/tree-sitter>, MIT).
- `tree-sitter-java-0.23.5/` — `tree-sitter-java.wasm` and `LICENSE` from
  <https://registry.npmjs.org/tree-sitter-java/-/tree-sitter-java-0.23.5.tgz>
  (source: <https://github.com/tree-sitter/tree-sitter-java>, MIT).
- `tree-sitter-cpp-0.23.4/` — `tree-sitter-cpp.wasm` and `LICENSE` from
  <https://registry.npmjs.org/tree-sitter-cpp/-/tree-sitter-cpp-0.23.4.tgz>
  (source: <https://github.com/tree-sitter/tree-sitter-cpp>, MIT).

`js/source-check.js` imports the ES module runtime on demand and loads
only the grammar for the language a learner edits. Parsing reads source; it
never executes it. `SHA256SUMS` records the upstream bytes. Preserve them and
the licenses when updating; the runtime and grammars must share an ABI.
