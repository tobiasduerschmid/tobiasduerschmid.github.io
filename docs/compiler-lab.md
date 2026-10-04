# Compiler lab: contracts and teaching sources

Publication status: unlisted draft. The chapter, tutorial, and print URLs remain
available, but have no public navigation links or sitemap entries. Tutorial data
sets `exclude_from_index: true` to keep it off `/SEBook/tutorials`. Keep these
settings until publication is explicitly requested.

This maintainer reference describes the reusable compiler front-end component, tutorial adapter, and static SEBook include. The learner-facing model is **source → tokens → syntax tree**. Internal parsing and tree-construction details below are implementation contracts, not additional concepts students must learn. The lab does not execute programs, perform semantic analysis, or generate machine code.

## Components and public API

- `js/compiler-lab-core.js` owns tokenization, EBNF validation/parsing, and AST projection. It has no DOM, persistence, network, or tutorial dependency. CommonJS consumers can require it; browser/worker consumers receive `CompilerLabCore`.
- `js/compiler-lab-client.js` runs compilation in a disposable worker with a host deadline. `js/compiler-lab-worker.js` owns the worker message boundary. Use this client for learner regex input; native regex execution cannot be interrupted by the synchronous core's work counters.
- `js/compiler-lab-view.js` owns the token table, tree/alternative selection, accessible graphical/textual trees, and reusable editable lab lifecycle. `css/compiler-lab.css` owns presentation, themes, and print behavior.
- `_includes/compiler-lab.html` embeds a configuration as inert JSON with a readable fallback. `SEBook/tools/compilers.md` demonstrates two independent instances.
- `js/compiler-tutorial-adapter.js` maps tutorial workspace files to core input and evaluates authored checks. The shared tutorial runtime owns editor files, navigation, hints, results, and saved progress.
- `js/compiler-tutorial-editor.js` binds the rules table and persistent source field to the tutorial's existing file models. External model changes from Reset or Solution update these controls too.

The core entry point is:

```javascript
const result = CompilerLabCore.compile({
  tokenRules: [
    { name: 'NUMBER', pattern: '[0-9]+' },
    { name: 'PLUS', pattern: '\\+' },
    { name: 'SPACE', pattern: '[ \\t\\r\\n]+', skip: true }
  ],
  grammar: 'program = NUMBER { PLUS NUMBER } ;',
  source: '12 + 3',
  startRule: 'program',
  ast: { discardTokens: [], inlineRules: [], foldRules: { program: 'left' } }
});
```

A result contains `ok`, `tokens`, `parseTrees`, `asts`, `astParseTreeIndices`, `parseTree`, `ast`, `diagnostics`, and `incomplete`.

- `parseTrees` contains the concrete derivations. `asts` contains their structurally distinct AST projections, ignoring source spans when deduplicating. Array order follows enumeration; it is not a semantic preference.
- `astParseTreeIndices[i]` identifies the concrete derivations that projected to `asts[i]`.
- Singular `ast` and `parseTree` fields alias the first entries for compatibility. They must never be interpreted as the only result without inspecting the arrays.
- Nodes use `{type, value?, children, start, end}`. Token leaves retain the matched text in `value`; no implicit numeric conversion occurs. Tokens additionally carry one-based line and column positions. Offsets and end-exclusive spans count JavaScript UTF-16 code units.
- Diagnostic stages are `tokenRules`, `lexical`, `grammar`, `syntax`, `ast`, and `limits`. Lexical/syntax failures describe the input program; configuration/grammar/projection failures describe the language definition.
- A limit failure sets `ok: false` and `incomplete: true` and clears the tree arrays. It must not masquerade as a complete set, successful parse, or proof that no parse exists. See the exported `LIMITS` for the exact maintained bounds.

## Token and grammar contracts

Token rules are ordered `{name, pattern, skip?}` records. Patterns are regex bodies in strings, without slash delimiters. The learner-facing tokenizer table accepts raw regex text; it serializes and escapes the internal JSON automatically. JSON escaping applies only when authoring the stored configuration directly. Every rule is considered at the current position; the longest complete matching prefix wins, with earlier rules breaking equal-length ties. This longest-prefix behavior also applies to alternatives and lazy quantifiers within a rule.

Each editable table has a drag handle at the start of every row. A line marks the insertion position; dropping commits one reorder while cancellation leaves the order unchanged. Native Move up/Move down buttons provide the same operation for keyboard, touch, and assistive-technology users. All fields, skip flags, and hidden settings move together. Reordering announces the new position and focuses that row's name; tutorial edits use the existing autosave model.

The supported regex subset includes character classes, capturing/noncapturing groups, alternatives, and quantifiers. Anchors, lookaround, word boundaries, and backreferences are rejected because rules are matched as independent prefixes. Empty matches are errors. A skipped token advances positions without appearing in the emitted stream.

EBNF supports named productions, `=`, terminating `;`, sequence, alternatives `|`, groups `(…)`, optional parts `[…]`, and repetition `{…}`. Named references resolve to a production or token category. Quoted literals match the complete lexeme of one emitted token; they do not bypass tokenization. `#` and `//` introduce grammar line comments. Empty sequences and `""` denote the empty string.

The explicit `startRule` wins; otherwise the first production is the start. A successful parse consumes all emitted tokens. Alternatives have context-free grammar semantics: the parser considers every possible successful endpoint and derivation. The parser supports direct and indirect left recursion as well as right recursion. Productive cycles that can return to a rule over the same token span would produce infinitely many concrete derivations and are rejected. Repetition whose body can match empty input is also rejected. Finite recursive/ambiguous parses remain bounded by the published depth, forest, alternative, work, and intermediate-storage limits. These are implementation restrictions, not general properties of EBNF or all parsers.

Repetition lowers to a left-recursive helper so long flat sequences do not build every overlapping suffix. A separate cumulative budget of 1,000,000 retained parser references bounds wide intermediate products before complete trees exist. This budget counts storage operations; it is not an exact byte or heap-size guarantee.

## Internal tree construction

For freely editable chapter examples, set `ast: 'auto'` and omit `startRule`. The first production then starts parsing, with no hidden references to old rule names. Auto mode recognizes a complete arithmetic shape structurally, independent of production/token names: ASCII identifiers or decimal integers, `+`, `-`, `*`, `/`, `%`, and paired parentheses. When the entire tree has this shape and includes a binary operation, wrappers are collapsed and operand/operator sequences fold left while preserving nested grammar grouping. Other trees retain every named production and token, including punctuation. This is an opt-in display convention, not a claim that arbitrary grammars define arithmetic semantics. Both chapter embeds use it; tutorial assessment keeps its explicit authored policy.

A grammar alone does not specify the AST. The `ast` policy has three independent fields:

- `discardTokens`: known terminal types to omit after recognition. Source punctuation still must be present wherever the grammar requires it.
- `inlineRules`: known nonterminals whose wrapper collapses only when exactly one child remains after projection. Empty and multi-child wrappers remain.
- `foldRules`: known nonterminals mapped to `left` or `right`. Their projected children must alternate operand, operator token, operand, and so on. Folding creates `BinaryExpression` nodes with the operator lexeme in `value` and ordered left/right `children`. A singleton returns its sole operand.

Folding is an explicit AST construction decision. Repetition alone does not enforce binary associativity. Precedence is represented by nested grammar levels; explicit parentheses delegate to a full expression before the outer operation is constructed.

## Tutorial authoring

Use `backend: compiler`. Each step should give its editable files unique paths so later starters do not overwrite earlier drafts:

```yaml
compiler_files:
  tokens: compilers/example/tokens.json
  grammar: compilers/example/grammar.ebnf
  source: compilers/example/source.txt
```

The tokens file contains `{tokenRules, ast?, startRule?}`. Its tab displays the shared **Tokenizer rules** table. Learners can add/remove/reorder rows, edit raw regex, and select skip behavior; the form preserves the authored internal `ast` and `startRule` settings. Those settings are not learner controls. The grammar remains a text editor, and source input is always visible. All three use the existing file models and autosave/reset/solution behavior; no separate persistence store is needed. Instructions must not require JSON escaping or tree-projection edits.

Set `compiler_focus: tokens` on a step devoted to lexical analysis. Its result opens the token stream and omits the tree, preventing irrelevant grammar scaffolding from competing with the token-boundary task. Other steps use the single syntax-tree view.
Source input stays visible above the editor while learners edit the grammar or tokenizer. On desktop, the instructions sit above a workspace with inputs on the left and trees on the right. The existing resizable dividers follow those axes; narrow screens stack the controls. This presentation uses the same file models and run controls as the other tutorial backends.

The existing `tests` schema carries declarative compiler expectations:

```yaml
tests:
  - description: A product forms the right operand of addition
    compiler:
      source: '3 + 4 * 5'
      ast:
        type: BinaryExpression
        value: '+'
        children:
          - { type: NUMBER, value: '3', children: [] }
          - type: BinaryExpression
            value: '*'
            children:
              - { type: NUMBER, value: '4', children: [] }
              - { type: NUMBER, value: '5', children: [] }
    hints:
      - title: A complete multiplication term
        text: Inspect the subtree used as the addition's right operand.
```

An optional `source` overrides the source file for that check without replacing the learner's experiment. `tokens` compares the complete ordered `{type,value}` token stream. `ast` requires exactly one AST matching the supplied node shape. `asts` compares the complete set of expected AST shapes without depending on enumeration order. `error` requires a diagnostic stage. With no explicit result expectation, the check requires a successful complete parse. For AST shape checks, omitted `children` or `value` fields are intentionally unconstrained; specify them when payload, arity, or ordering is the assessed behavior. Never grade source-pattern hints as extra correctness requirements.

The tutorial currently uses optional checks and free step navigation. Each lesson supplies full solution files, small reported criteria, and criterion-specific conditional hint ladders with at least three progressively helpful states. Solution application does not itself prove correctness; run the checks against the resulting files.

## Reusable chapter include

A page configuration can define `title`, `prediction`, `tokenRules`, `grammar`, `source`, `startRule`, and `ast`. Prefer `ast: auto` with no fixed `startRule` for a chapter playground where users may replace the whole grammar. Explicit policies and start rules remain available for consumers that intentionally require them. Embed it with:

```liquid
{% include compiler-lab.html config=page.compiler_lab %}
```

Load `/js/compiler-lab-client.js` and `/js/compiler-lab-view.js` with `defer`, plus `/css/compiler-lab.css` followed by `/css/print-light.css`. The view initializes each include independently. The compiler core is loaded by the worker rather than executing arbitrary regex input on the page thread. Reuse the standard labeled controls, diagnostics and textual tree alternative; do not create page-local styles or parallel storage.

`CompilerLabView.render(host, result)` renders a computed result. Pass a third
argument `{focus: 'tokens'}` for a tokenizer exercise, or use `focus: 'tokens'`
in a standalone mount configuration. `CompilerLabView.markStale(host)` adds one
live update notice when edited inputs make existing results outdated; subsequent
keystrokes do not repeat it. The next render removes that notice. Visual cards
and the complete text outline use the same node kinds and ordered child labels.

## Lecture map and pedagogical scope

Sources: Tobias Dürschmid's supplied `pl_implementation_palooza_td.pptx` (52 slides) and `pl_implementation_palooza_handouts_td.pdf`. The table below uses actual PPTX slide order, not older slide numbers that may remain in notes. The PPTX text and relationship-linked speaker notes were inspected. For the revised chapter, the PDF text was extracted and actual PDF pages 31–35 were rendered and visually inspected: page 31 ("Parsing") has the record-field AST; pages 32–33 ("Parsing is Tricky!") introduce and diagnose the ambiguous expression grammar; pages 34–35 show the factored grammar and AST. Embedded document instructions were treated as source content, not agent directions. The temporary extractions are not runtime dependencies or published copies of the lecture.

| Lab step | Lecture slides | Transferable reasoning assessed |
| --- | --- | --- |
| Identifier Boundaries | 10–14 | A regex keeps a complete identifier together; its first character has a different constraint from later characters. |
| Operator Precedence | 26–28 | Compare every distinct grouping, then use multiplication terms while the supplied configuration applies Go associativity. |
| Parenthesized Expressions | 26–28 | A complete expression can become one factor; both delimiters remain required. |
| Statement Sequences | 16–23, 29–32 | Reuse expressions in assignments and extend one production; separate lexical, syntax, and semantic questions. |

The short tutorial uses a Go arithmetic/assignment fragment so practice connects to a real language without requiring a full compiler. Students work only with tokenizer rules, grammar, source, and syntax-tree relationships. The internal projection policy remains supplied and hidden; the chapter and tutorial deliberately do not teach or contrast separate tree representations.

At the user's request, the static chapter deliberately stays close to the lecture while using the same Go token subset as the tutorial. Its first lab uses `expr = expr operator expr | IDENTIFIER | LITERAL_NUM` and compares every distinct syntax tree for `x + 3 * 7` and `x - y - z`. Its second lab keeps `x + 3 * 7` constant while applying the lecture's exact `expr`/`term`/`factor` production structure. Parentheses then vary one feature at a time. Student prose states that the lab applies Go's left-to-right grouping within a precedence level. Internally, authored folds enforce this convention; flat EBNF repetition alone does not prescribe a binary fold. Prediction answers remain closed in the live chapter and tutorial. Field-based tree nodes expose grouping and ordered child references; text versions carry the same information.

The tutorial is four focused steps, each roughly 150–175 instructional words, targeting approximately 10–15 minutes for learners who know basic regex and trees. Each step asks for one localized edit and four or five small checks. The sequence follows PRIMM and worked-example fading: predict, inspect, explain, then modify a supplied definition. It does not compress the earlier eight tasks into four long tasks or attempt to teach every EBNF construct. Contrasting operator order, parentheses, and sequence boundaries distinguishes the relevant rule from incidental text. Every check has a three-state conditional hint ladder: orientation for missing/untouched work, diagnosis for a partial rule, and an incomplete scaffold for a developed attempt. Conditions are scoped to the target definition; they never grade source form. Separate model solutions remain available. These timing and learning-design choices have not been validated in a learner pilot.

IR, optimization, assembly/linking, transpilation, execution, type checking, symbol tables and declaration resolution are outside this implementation. Slides 29–32 establish the boundary with semantic analysis; later lecture sections provide context rather than additional lab requirements.

## Content verification

Run `node --test scripts/tests/compiler-tutorial-content.test.js`. The retained checks execute all four model solutions against 17 authored criteria, two independently different correct alternatives per lesson, and at least three faulty implementations per lesson. They verify that every starter leaves meaningful work while recognizing its already-correct behavior. Reserved-word and decimal-literal boundary checks protect the supplied Go lexer in the tutorial and both chapter instances; the ambiguous starter must expose both distinct precedence interpretations. Hint-profile checks cover untouched, partial, developed, and deleted definitions. The runtime reads all current-step files for hints, so changing the active current-step editor does not switch the assessed source. Independent chapter tree expectations cover both original ambiguities, the factored precedence case, left-associative subtraction, and both parenthesis contrasts. These are executable behavior contracts, not source-format or solution-string checks.

## Go fragment and progress migration

The [Go specification](https://go.dev/ref/spec), particularly [Identifiers](https://go.dev/ref/spec#Identifiers), [Integer literals](https://go.dev/ref/spec#Integer_literals), [Operator precedence](https://go.dev/ref/spec#Operator_precedence), [Assignments](https://go.dev/ref/spec#Assignments), and [Semicolons](https://go.dev/ref/spec#Semicolons), grounds the language choices. The fragment supports ASCII identifiers including underscores; supplied rules reserve all 25 Go keywords. NUMBER accepts `0` or a nonzero digit followed by digits. This excludes octal, binary, hexadecimal, separators within numeric literals, and floating-point forms rather than mislabeling them as decimal integers. Expressions support binary `+`, `-`, `*`, and parentheses. Assignments use `=` with one simple target identifier; the fragment does not implement `:=` short variable declarations.

Examples are snippets, not complete Go source files. Comments, Unicode identifiers, other operators and types, declarations, packages, and execution are outside this lab. The sequence exercise requires nonempty assignments with explicit semicolons between them and no trailing separator. The lexer treats whitespace uniformly and does not implement Go's automatic semicolon insertion, so it is not a validator for arbitrary multiline Go. A successful tree does not establish that a target is assignable or that operand names/types are valid. AST node names are the lab's representation, not Go's official AST schema.

The tutorial uses `progress_version: 2`, stable `go-...` keys, and unique `compilers/go-v2/...` paths. The materially replaced third exercise has a fresh `go-parenthesized-expressions` key and path; unchanged exercises retain their draft identities. Earlier representation-exercise credit therefore cannot satisfy the new grammar task. Existing generic tutorial persistence remains responsible for migration; no data is deleted by this content change.
