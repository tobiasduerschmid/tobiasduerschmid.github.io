---
name: cookie-storage-tracker
description: Project rule for keeping the user-facing storage inventory at /cookies/ in sync with the code. USE THIS SKILL EVERY SINGLE TIME you write, edit, or review code that reads from or writes to any browser storage in this Jekyll site — `document.cookie`, `localStorage.setItem` / `getItem` / `removeItem`, `sessionStorage.*`, `indexedDB.*`, the Cache API, or any helper like `setCookie()` / `getCookie()` / `_storageKey()`. Trigger when you introduce a new storage key, rename one, change what is stored under an existing key, delete a feature that owned a key, change cookie expiry/scope/SameSite/Secure attributes, add a new tutorial id pattern, or write any code that ends up calling one of these APIs even transitively. Also trigger on requests like "save this preference", "remember this across reloads", "persist user state", "store the user's choice", "cache this in the browser", "add an autosave for X", "track per-question stats", "remember which tab is open", or any feature that implicitly needs persistence. The site has a unified user-facing inventory at `/cookies/` (source: `cookies.html`) with trash-icon delete actions per entry — every storage key the site touches MUST appear there, or the privacy notice becomes a lie.
---

# Cookie & Storage Tracker

## The rule

This site exposes a complete, user-managed inventory of every cookie and `localStorage` key it writes, at **`/cookies/`** (source: [`cookies.html`](../../../cookies.html)). The privacy/cookie notice that appears at the bottom of every page links there and tells users:

> "This site stores a few preferences and your progress locally in your browser
> (cookies and localStorage) so it works the way you left it. Nothing is sent
> to or stored on any external server."

That promise only holds if **every** storage key is documented. If you introduce, rename, or remove a key in code without updating `cookies.html`, the user is silently misled and cannot delete the new entry. **This is non-negotiable for this project.**

## When this skill fires

You MUST update `cookies.html` whenever any of the following happens:

| Change in code | Required update in `cookies.html` |
|---|---|
| New `document.cookie = "FOO=...` or `setCookie('FOO', ...)` | Add a `<tr data-storage="cookie" data-key="FOO">` row in the right category. |
| New `localStorage.setItem('BAR', ...)` | Add a `<tr data-storage="localStorage" data-key="BAR">` row. |
| New `sessionStorage.setItem(...)` or `indexedDB.open(...)` | Add a new section explaining it (the page currently states "no sessionStorage / no IndexedDB" — update that paragraph). |
| Renamed key | Rename the row's `data-key` and the displayed `<td class="storage-key">`. |
| Removed key (feature deleted) | Delete the row. |
| New dynamic key pattern (e.g. `myfeature-{id}-...`) | Add it to the dynamic-prefix list near the top of `<script>` and to the `<p>` legend that lists prefixes. |
| Changed cookie expiry / scope / `SameSite` / `Secure` flag | Update the row's purpose blurb if the change is user-visible (e.g. session vs persistent). |

## How to update `cookies.html`

1. **Find the right category.** The page is grouped by feature, not by storage type alone. Pick the table that the new key belongs to (UI, bookmarks, SE Gym, Accessibility & audio, Tutorial state, Standalone tutorials). If none fits, add a new `<h3>` + `<table>` + bulk-delete button — copy the structure of an existing block.
2. **Add the row.** Use the exact format:
   ```html
   <tr data-storage="cookie|localStorage" data-key="THE_EXACT_KEY">
     <td class="storage-key">THE_EXACT_KEY</td>
     <td>One sentence on what it stores and when, plain English.</td>
     <td class="status-cell"></td>
     <td class="action-cell"></td>
   </tr>
   ```
   The trash button and "set / not set" badge are populated automatically by the page's JS — do not add them by hand.
3. **Dynamic keys (per-tutorial, per-path, etc.).** Do NOT add a row per id. Instead:
   - Add a new entry to `DYNAMIC_PREFIXES` in the page's `<script>` block:
     ```js
     { prefix: 'myfeature-',  label: 'Short description shown in the dynamic table' },
     ```
   - Add the new prefix and a brief description to the `<p style="font-size:0.85em..."` legend just below the dynamic table.
   - Add the prefix to the `data-clear-prefixes` attribute of the relevant "Delete all" button so bulk-delete still wipes everything.
4. **Be honest about scope.** If the value is conditional (e.g. only written when a toggle is on), say so in the purpose cell — users should know why a value might or might not be set.
5. **Re-check the "Where else does this site store data?" paragraph** at the bottom. It currently asserts no `sessionStorage` and no `IndexedDB`. If you added either, rewrite it.

## When the unified notice itself needs updating

The text of the bottom-of-page notice lives in **one place**: [`_includes/cookie-notice.html`](../../../_includes/cookie-notice.html). The four layouts that show it (`default`, `blog`, `sebook`, `tutorial`) all `{% include %}` it. Edit the include — never hand-edit the layouts. **Never inline a separate cookie notice on a single page** — every page must have exactly one notice, and it must come from the include. (The SE Gym page formerly had two; the inline copy was removed and replaced with `{% comment %}...{% endcomment %}` to make the rationale visible to future authors.)

## Quick checklist before you finish a change

- [ ] Did I add/rename/remove a storage key? → updated `cookies.html`.
- [ ] Did I introduce `sessionStorage` or `IndexedDB` for the first time? → added a new section AND rewrote the bottom paragraph.
- [ ] Is the new key dynamic? → added to `DYNAMIC_PREFIXES`, the legend, and the bulk-delete `data-clear-prefixes`.
- [ ] Did I want to add a per-feature notice? → don't. Edit `_includes/cookie-notice.html` instead, and let it apply everywhere.
- [ ] Does the new row's purpose explain it in plain English a non-developer can verify against their own data?

If you skipped any of these, go back and do them — the cookies page is a privacy contract, not an afterthought.

## Reference: known storage keys (as of last update)

This is a snapshot to help you spot duplicates and pick the right category — `cookies.html` is the source of truth.

**Cookies**
- `dark-mode`, `show-highlights`, `highlights` (alias on blog index), `read-aloud`, `uml-accent-color`
- `se-bookmarks`, `se-bookmarks-active`
- `se-gym`, `se-gym-active`, `analyze-performance`

**localStorage**
- `prefersReducedMotion`
- `cap_volume`, `cap_speed`
- `tts-voice-name`
- `se-gym-stats`
- `tutorial-autosave`
- `regex-tutorial-progress`, `regex-tutorial-advanced-progress`

**localStorage — dynamic prefixes** (one entry per tutorial id / page path)
- `tutorial-progress-<id>` — saved code & current step
- `tutorial-editor-split-<id>` — split-pane preference
- `tutorial-popout-state-<path>` — detached editor crash-recovery snapshot
- `tutorial-debug-bps-<id>` — debugger breakpoints
- `tutorial-debug-watchpoint-remove-choice-<id>` — watchpoint removal preference
- `tutorial-debug-section-<id>-<name>` — debugger panel collapse
- `tutorial-debug-subsection-<id>-<name>` — debugger sub-panel collapse

**Not used:** `sessionStorage` (only briefly during a one-time migration), `IndexedDB`. If you change this, update `cookies.html`.
