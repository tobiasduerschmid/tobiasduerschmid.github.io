# Compiler lab review

Reviewed the SEBook chapter, four-step Go tutorial, reusable parser, worker boundary, shared view, tutorial integration, and print output. The review combined independent content, implementation, and UI reviews with executable checks. See [the component contracts](compiler-lab.md) for supported syntax and reuse instructions.

## Findings addressed

| Perspective | Problem | Result |
| --- | --- | --- |
| Learning focus | Tree representation and construction controls competed with grammar reasoning. | Students see one syntax-tree view. Internal tree configuration stays hidden; the replaced exercise now asks learners to allow a full expression inside parentheses. |
| Sequencing | Tokenization tasks displayed irrelevant grammar and tree detail. | Step 1 presents tokens directly. The remaining steps progress through precedence, parentheses, and assignment sequences, with one localized edit per step. |
| Reasoning | Examples and checks could reward a narrowly memorized solution. | Prediction prompts, contrasting operator order and grouping, independent correct solutions, and faulty-solution checks assess transferable behavior. Every criterion has a conditional three-stage hint ladder. |
| Language accuracy | A small language fragment could be mistaken for all of Go. | Scope is explicit: ASCII identifiers, decimal integers, selected arithmetic, and assignments. Supplied rules reserve all Go keywords. No claim of full Go validation or execution. |
| Assessment | Underscores within identifiers and trailing sequence separators were insufficiently checked. | The 17 authored criteria now exercise both boundaries. Model solutions pass; corresponding faulty implementations fail. |
| Tree correctness | Flat repetition does not itself prescribe binary associativity. | The chapter explains the Go grouping convention without exposing implementation machinery. Internal construction consistently applies it; independent tree expectations check precedence and associativity. |
| Usability | Large trees, detached connectors, competing controls, and stale output made comparison difficult. | Source, grammar, and a five-node tree fit together on desktop. Connectors stay attached through resize, scrolling, and zoom. Multiple trees have direct selection and previous/next controls. Edits flag old results until Run. |
| Readability | Dense boxes and technical file labels distracted from relationships. | Simplified record cards, prominent values, consistent labels, readable controls, and tokenizer tables are shared across live and print views. |
| Parser resources | Right-recursive repetition retained overlapping suffixes and used excessive memory on flat inputs. | Repetition uses a left-recursive helper, with an additional intermediate-storage budget. Limit failures explicitly report incomplete results instead of returning a misleading partial set. |
| Configuration robustness | Sparse or malformed configuration/check arrays could throw or silently weaken a check. | Validation reports configuration errors. Broken hidden settings offer reset recovery; valid settings survive table edits. |
| Accessibility | Tree outlines lacked equivalent relationship labels; a short Go link label and inherited footer styling triggered concerns. | Visual and textual trees share ordered child labels. The specification link is descriptive, and text footer links are underlined. Light, dark, narrow, keyboard, and print states were checked. |

The [Go specification](https://go.dev/ref/spec) was checked for identifier rules, keywords, integer literals, precedence, assignments, and semicolon behavior. The supplied lecture informed the ambiguity-to-precedence comparison. The tutorial intentionally does not introduce separate tree representations.

## Initial review verification

- Full Node suite: **838 passed, 0 failed**.
- Final browser run: **24 passed**, including 13 feature checks, 4 real-worker checks, 3 editor integration checks, and 4 accessibility audit/harness checks.
- Screen and print accessibility audits: **zero findings** for the chapter, tutorial, and dedicated tutorial print page. Screen checks include light/dark themes, keyboard focus, narrow reflow, and text spacing.
- Manual visual inspection: desktop light/dark, 320-pixel layout, settled theme transitions, readable tree cards, and print output. Tree geometry is also tested after scrolling, resizing, splitter movement, and zoom.
- Browser behavior covers all-tree cycling, malformed-input recovery, tokenizer edits, hidden configuration preservation, Stop/rerun, worker timeouts, source synchronization, stale results, autosave on/off, reset, and solution application.
- Content checks execute all solutions against 17 criteria, accept independently different correct implementations, reject targeted faulty implementations, and exercise conditional hint profiles.
- Jekyll build, JavaScript syntax checks, Ruby filter syntax, and `git diff --check` passed.

Browser checks used installed Google Chrome and an isolated Jekyll destination because bundled Playwright Chromium was unavailable. This was a Chromium run, not a cross-browser certification.

## Follow-up: draggable rules and replacement grammars

Editable tokenizer tables now have leading drag handles with insertion markers. The existing move buttons remain available for keyboard and touch operation. Reordering preserves edited regex, token names, skip flags, hidden settings, and tutorial autosave. A canceled/outside-table drop does not change order or insert drag text into an editor. The moved row receives focus and its new position is announced.

The chapter's error after replacing EBNF came from obsolete, hidden production-name dependencies. Both chapter configurations now opt into automatic tree construction and start at the current grammar's first production. Recognized arithmetic remains compact; other structures preserve all productions and tokens. Explicit construction policies remain supported by the reusable API and unchanged tutorial assessment. Arbitrary names such as `BinaryExpression` do not accidentally become operator nodes in the UI.

Follow-up verification: **117 compiler core/adapter/content tests and 28 browser checks passed**. The browser checks include swapping the two chapter grammars, replacing production/token names, drag priority, preservation of skipped rules, outside-table cancellation, keyboard alternatives, and reload/reset. The rebuilt chapter, tutorial, and print pages again have **zero automated screen/print accessibility findings**. Light, dark, and 320-pixel table layouts were visually inspected. These results retain the verification limits below.

## Remaining bounds

- Automated accessibility results and visual/keyboard inspection do not establish complete WCAG conformance. VoiceOver spoken output has not been manually verified.
- A separate repository-wide visited-link lint remains failing on 12 unrelated matches: ten generated audit/browser assets under `.superpowers`, an existing Haskell help-link rule, and an existing interpreter interaction-state selector. No compiler stylesheet appears in that failure. The repository-wide suite is therefore not reported as entirely green.
- The four-step, 10–15-minute estimate and learning benefits need a learner pilot; they are design judgments, not measured outcomes.
- All finite tree alternatives are returned within documented resource limits. Infinite derivations and exhausted budgets are explicit errors. Learner regex runs in a disposable worker with a deadline; consumers calling the synchronous core directly must provide their own isolation for untrusted patterns.
- Explicit semicolons and the restricted expression grammar serve this exercise. Automatic semicolon insertion, full Go syntax, semantic validity, and code execution are outside its scope.
