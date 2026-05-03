---
name: keyboard-glossary-tracker
description: Project rule for keeping the user-facing glossary at /glossary/ and keyboard shortcut reference at /shortcuts/ in sync with browser-visible content and interactions. USE THIS SKILL EVERY SINGLE TIME you write, edit, review, or delete user-facing prose, labels, headings, captions, alt text, tutorial steps, quiz feedback, SEBook chapters, blog posts, HTML, Liquid includes, JavaScript, or embedded widget code that introduces, renames, redefines, removes, or relies on an abbreviation, acronym, initialism, short technical term, abbr include, abbr element, keyboard shortcut, hotkey, key chord, keydown or keyup handler, KeyboardEvent, event.key, event.code, keyCode, which, aria-keyshortcuts, accesskey, Monaco addCommand, CodeMirror keymap, terminal/editor key binding, modal Escape behavior, roving-tabindex arrow-key behavior, or any custom keyboard operation. Trigger on requests like "add a shortcut", "bind this to Ctrl+S", "make Esc close it", "support arrow keys", "add a new acronym", "use the abbreviation", "define this term", "add inline abbr", or any content change that creates a new shortened form users will see. Every new abbreviation MUST be added to `_data/glossary.yml`, and every new custom keyboard shortcut MUST be added to `shortcuts.html`; removed or changed terms and shortcuts must be removed or changed there too.
---

# Keyboard Shortcuts & Glossary Tracker

## Why this skill exists

This site has two public reference pages linked from the footer:

- **`/glossary/`** is generated from [`_data/glossary.yml`](../../../_data/glossary.yml) and is also the source used by [`_includes/abbr.html`](../../../_includes/abbr.html).
- **`/shortcuts/`** is authored in [`shortcuts.html`](../../../shortcuts.html) and promises to list every custom keyboard shortcut on the site.

Those pages are part of the accessibility surface, not optional documentation. If code or content introduces a new abbreviation without adding it to the glossary, users lose the inline expansion and the public reference becomes incomplete. If a widget introduces a shortcut without adding it to `/shortcuts/`, keyboard users cannot discover it, and accessibility reviewers cannot verify the interaction model. Treat both inventories like contracts under version control.

## Abbreviation changes that trigger this skill

Update `_data/glossary.yml` whenever your change introduces, renames, redefines, or removes a browser-visible shortened form.

| Surface | Patterns / signals |
| --- | --- |
| Inline glossary include | `{% include abbr.html term="REST" %}`, `{% include abbr.html term="REST" text="REST APIs" %}` |
| Raw abbreviation markup | `<abbr>`, `<abbr title="...">`, tooltip text that expands a term |
| New acronym / initialism | `API`, `JWT`, `CI`, `CD`, `TDD`, `UML`, `XP`, or any new all-caps term in prose |
| Mixed-case abbreviation | `OAuth`, `GoF`, `i18n`, `e2e`, or other shortened technical names |
| Expansion pattern | `Representational State Transfer (REST)`, `REST (Representational State Transfer)` |
| User-facing content | Markdown, YAML tutorial steps, quiz prompts or feedback, headings, labels, captions, alt text, table cells, diagram captions, blog posts |
| UI copy from JS | Text assigned through `textContent`, `innerHTML`, templates, toast/status messages, modal copy, editor/tool labels |

Pure code tokens, filenames, command flags, package names, or language keywords do not need glossary entries when they appear only inside code samples or logs. If the surrounding user-facing prose teaches the shortened form as a concept, add it.

## How to update the glossary

1. **Check for an existing entry.** Search `_data/glossary.yml` for the term and likely aliases before adding anything.
2. **Add or edit one canonical entry.** Entries use:
   ```yaml
   - term: REST
     definition: Representational State Transfer
     description: A short plain-text explanation shown on /glossary/.
     related: [HTTP, API]
   ```
3. **Keep `definition` short.** It is used in the inline `<abbr>` tooltip and may be read aloud by assistive tech.
4. **Keep `description` plain text.** No Markdown; the page renders it directly from YAML.
5. **Maintain `related` links.** Every related item must exactly match another `term:` in the file. If you rename or delete a term, update other entries that reference it.
6. **Prefer the include in prose.** Once the term exists, use `{% include abbr.html term="TERM" %}` for body text where an inline expansion helps. Use the `text=` parameter for plural or grammatical variants. Do not add inline `<abbr>` markup in headings; headings should remain plain, scannable text. The `/settings/` abbreviation underline preference may change body-text CSS only — it must never make headings render abbreviation markup.
7. **Remove stale entries only when the term is truly gone.** If the abbreviation still appears anywhere user-facing, keep the glossary entry.

## Keyboard shortcut changes that trigger this skill

Update `shortcuts.html` whenever your change adds, changes, scopes differently, documents, or removes a custom keyboard interaction.

| Surface | Patterns / signals |
| --- | --- |
| DOM keyboard handlers | `addEventListener('keydown'...)`, `addEventListener('keyup'...)`, `onkeydown`, `onkeyup`, `KeyboardEvent` |
| Key checks | `event.key`, `event.code`, `e.key`, `e.code`, `keyCode`, `which`, `ctrlKey`, `metaKey`, `altKey`, `shiftKey` |
| Accessibility attributes | `aria-keyshortcuts`, `accesskey` |
| Editor / terminal bindings | Monaco `addCommand`, CodeMirror keymaps, xterm key handlers, custom terminal shortcuts |
| Libraries | `Mousetrap`, `hotkeys-js`, `shortcut`, or any key binding helper |
| Common actions | `Ctrl+S`, `Cmd+S`, `Ctrl+P`, function keys, arrow-key roving focus, `Esc` close/cancel, `Enter` submit/send, `Space` move/toggle in custom widgets |
| Tests and docs | Playwright `page.keyboard.press(...)`, instructions that tell users to press a key, tables of shortcuts |

Native browser and HTML behavior does not need a row by itself. For example, `Tab` moving focus, `Enter` activating a real `<button>`, and `Space` toggling a native checkbox are standard. If you implement the behavior yourself for a custom widget, document it.

## How to update `shortcuts.html`

1. **Find the right section.** Existing sections include Tutorials & SEBook, Step-through debugger, Command labs, Refactoring engine, Tutor chat, UML & diagram viewers, Quizzes & Parsons problems, Popout windows & modals, and Tooltips.
2. **Add the row in the relevant table.** Use the existing pattern:
   ```html
   <tr>
     <td class="shortcuts-keys-cell"><kbd>Ctrl</kbd><span class="key-sep">+</span><kbd>S</kbd></td>
     <td>Save the current tutorial answer.</td>
   </tr>
   ```
3. **Add a section when needed.** If no existing section fits, add an `<h2 id="...">`, a table with a `<caption>`, and a matching link in the table of contents.
4. **Document scope honestly.** The row or nearby note must say where the shortcut works, especially when it only fires while a panel, editor, modal, or widget has focus.
5. **Keep macOS parity clear.** The intro already says macOS users can use `Cmd` where `Ctrl` appears. If a shortcut behaves differently, say so in the row.
6. **Update rows when behavior changes.** If you rename the action, move the shortcut to a different widget, change the key chord, or delete the handler, update or remove the row in the same change.
7. **Preserve the page's accessible table structure.** Keep `<caption>`, `<th scope="col">`, `<kbd>`, and descriptive action text.

## Accessibility guardrails for shortcuts

Keyboard shortcuts are also WCAG-sensitive interactions:

- **Single-character shortcuts** such as `s`, `?`, or `/` must be disabled, remappable, or active only when the relevant component has focus (WCAG 2.1.4).
- **Do not hijack browser or OS shortcuts globally.** Scope shortcuts to a focused widget when they overlap browser defaults, especially function keys and `Ctrl` / `Cmd` chords.
- **Always provide a visible control too.** A shortcut can accelerate an action, but it cannot be the only way to operate it.
- **Return focus predictably.** Shortcuts that close popouts, modals, sidebars, or overlays should return focus to the triggering control.
- **Use `aria-keyshortcuts` sparingly and accurately.** If you add it, keep it in sync with both the handler and the `/shortcuts/` row.

## Quick scan before you finish a change

Run targeted searches against your diff or the touched files before you call the work done:

```bash
rg -n "abbr\\.html|<abbr|\\b[A-Z][A-Z0-9]{1,}\\b|\\b[A-Za-z]+ \\([A-Z][A-Z0-9]{1,}\\)" --glob '!_site/**'
rg -n "addEventListener\\(['\\\"]key|onkey|KeyboardEvent|\\.key\\b|\\.code\\b|keyCode|which|ctrlKey|metaKey|altKey|shiftKey|aria-keyshortcuts|accesskey|addCommand|keymap|Mousetrap|hotkeys|page\\.keyboard\\.press" --glob '!_site/**'
```

The searches are noisy by design. Use judgment, but do not ignore a new user-facing abbreviation or shortcut just because it appeared in a large file.

## Quick checklist before you finish

- [ ] Did I introduce a new abbreviation, acronym, initialism, or short technical term in user-facing content? -> Added it to `_data/glossary.yml`.
- [ ] Did I use `{% include abbr.html term="..." %}`? -> Confirmed that exact `term:` exists.
- [ ] Did I rename, redefine, or remove a term? -> Updated the glossary entry and all `related:` references.
- [ ] Did I add or change a key handler, key chord, `aria-keyshortcuts`, editor command, modal `Esc` behavior, or custom arrow-key operation? -> Updated `shortcuts.html`.
- [ ] Did I remove a shortcut? -> Removed or rewrote the stale row in `shortcuts.html`.
- [ ] Did I add a new shortcut category? -> Added the section, table caption, and table-of-contents link.
- [ ] Did I add a single-character shortcut? -> Verified it satisfies WCAG 2.1.4.
- [ ] Does the shortcut row explain where the shortcut works and what it does in plain English?

If any answer is "no", go back and fix the inventory. The glossary and shortcut reference are user-facing commitments, not afterthoughts.
