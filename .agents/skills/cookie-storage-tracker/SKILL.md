---
name: cookie-storage-tracker
description: >-
  Project rule for keeping the user-facing storage inventory at /cookies/ and the user preferences page at /settings/ in sync with the code. USE THIS SKILL EVERY SINGLE TIME you write, edit, review, OR delete code that reads from, writes to, registers, opens, or removes anything that persists in the user's browser — `document.cookie`, any `localStorage.*` (`setItem` / `getItem` / `removeItem` / `clear` / bracket access / `localStorage[k]`), any `sessionStorage.*`, `indexedDB.*` / `IDBDatabase` / `idb` / `idb-keyval` / `Dexie`, the Cache API (`caches.open`, `caches.put`, `caches.match`, `caches.delete`), `navigator.storage.persist()`, `navigator.serviceWorker.register()`, `BroadcastChannel`, `showDirectoryPicker` / `showSaveFilePicker` / File System Access API, `webkitRequestFileSystem`, legacy `openDatabase` (WebSQL), or any helper like `setCookie()` / `getCookie()` / `deleteCookie()` / `Cookies.set` / `Cookies.get` / `_storageKey()` / `STORAGE_KEY` / `*_KEY` / `*Storage*Key`. Trigger when you introduce a new storage key, rename one, change what is stored under an existing key, delete a feature that owned a key (the row must be removed too), change cookie expiry / scope / `SameSite` / `Secure` / `HttpOnly` / domain attributes, add or change a dynamic-key prefix template (e.g. `tutorial-progress-{id}`, `myfeature-{path}`), add or change any user-facing setting or preference, add or remove a Service Worker, add or remove a BroadcastChannel name, swap one storage backend for another (e.g. cookie → localStorage), introduce a third-party library that itself stores anything (`localforage`, `js-cookie`, `idb-keyval`, `Dexie`, `pouchdb`, an analytics SDK, an A/B testing SDK), or write any code that ends up calling one of these APIs even transitively. Also trigger on requests like "save this preference", "remember this across reloads", "persist user state", "store the user's choice", "cache this in the browser", "add an autosave for X", "track per-question stats", "remember which tab is open", "save my place", "checkpoint", "remember between sessions", or any feature that implicitly needs persistence. The site has a unified user-facing inventory at `/cookies/` (source: `cookies.html`) with trash-icon delete actions per entry — every storage key the site touches MUST appear there, or the privacy notice becomes a lie. The site also has a user-facing preferences page at `/settings/` (source: `settings.html`) — every setting users can change MUST appear there. NEVER inline a separate cookie notice on a single page; the unified notice in `_includes/cookie-notice.html` is the single source of truth.
---

# Cookie & Storage Tracker

## Why this skill exists

This site exposes a complete, user-managed inventory of every cookie and `localStorage` key it writes, at **`/cookies/`** (source: [`cookies.html`](../../../cookies.html)). It also exposes a user-facing preferences page at **`/settings/`** (source: [`settings.html`](../../../settings.html)) that gathers every setting users can intentionally change.

The privacy/cookie notice that appears at the bottom of every page links to the storage inventory and tells users:

> "This site stores a few preferences and your progress locally in your browser
> (cookies and localStorage) so it works the way you left it. **Nothing is sent
> to or stored on any external server**, and this site does not sell, share, or
> disclose any user data to third parties."

That promise only holds if **every** persisted entry is documented and deletable. If you introduce, rename, or remove a key in code without updating `cookies.html`, the user is silently misled and cannot delete the new entry. If you introduce, rename, or remove a user-facing setting without updating `settings.html`, users lose the central place where preferences are discoverable and controllable. **This is non-negotiable for this project.** Treat `cookies.html` as a privacy contract and `settings.html` as the preferences contract under version control, not as afterthought documentation.

## Storage APIs you must watch for

These are the APIs and patterns that the skill scans for in your changes. Anything in this list triggers the workflow below.

| Surface | Patterns / signals |
|---|---|
| **Cookies** | `document.cookie = ...`, `document.cookie.match`, `document.cookie.split(';')`, `setCookie(`, `getCookie(`, `deleteCookie(`, `Cookies.set(`, `Cookies.get(`, `Cookies.remove(` (any `js-cookie` import) |
| **`localStorage`** | `localStorage.setItem`, `localStorage.getItem`, `localStorage.removeItem`, `localStorage.clear`, `localStorage[k]`, `localStorage.key(i)`, helpers like `_storageKey()`, `STORAGE_KEY`, `STATS_KEY`, `*_KEY` constants |
| **`sessionStorage`** | same family, `sessionStorage.*` |
| **IndexedDB** | `indexedDB.open`, `IDBDatabase`, `IDBObjectStore`, `idb` / `idb-keyval` / `Dexie` / `pouchdb` imports |
| **Cache API** | `caches.open`, `caches.match`, `caches.put`, `caches.delete`, `caches.keys` |
| **Service Worker** | `navigator.serviceWorker.register`, any new file under `*-serviceworker.js` or `sw.js` |
| **`BroadcastChannel`** | `new BroadcastChannel(...)` — even ephemeral, the *name* must be documented |
| **File System Access** | `showDirectoryPicker`, `showSaveFilePicker`, `FileSystemDirectoryHandle`, `webkitRequestFileSystem` |
| **Persistent storage / quota** | `navigator.storage.persist`, `navigator.storage.estimate`, `navigator.storage.getDirectory` (OPFS) |
| **Legacy** | `openDatabase` (WebSQL — never reintroduce; remove on sight) |
| **Indirect / third-party** | new dependency in `package.json` named `js-cookie`, `idb`, `idb-keyval`, `localforage`, `Dexie`, `pouchdb`, an analytics or A/B SDK, anything advertising "persists across sessions" |

A *transitive* call counts. If you add a feature whose helper sits two function calls away from `localStorage.setItem`, that key is your responsibility too.

## What change requires what update

You MUST update `cookies.html` whenever any of the following happens. Use the table to pick the precise edit.

| Change in code | Required update in `cookies.html` |
|---|---|
| New `document.cookie = "FOO=...` or `setCookie('FOO', ...)` | Add a `<tr data-storage="cookie" data-key="FOO">` row in the right category. |
| New `localStorage.setItem('BAR', ...)` (or any equivalent helper) | Add a `<tr data-storage="localStorage" data-key="BAR">` row. |
| New `sessionStorage.setItem(...)` that *persists across visits or affects user state* | Add an entry to the bullet list under "Where else does this site store data?" and rewrite the existing `sessionStorage` bullet so it no longer says "not used persistently". |
| New `indexedDB.open(...)` or any IDB-backed library | Same: add a section, rewrite the IndexedDB bullet to describe what is stored, and add a delete action equivalent to the trash-icon UX. |
| New `caches.open(...)` (Cache API) | Same — rewrite the Cache API bullet, list the cache name(s), and add a way to clear them. |
| New Service Worker registration | Update the Service Worker bullet: name the SW file, what it does, and whether it caches *anything*. |
| New `BroadcastChannel` | Update the BroadcastChannel bullet with the new channel name. |
| New File System Access call | Add a section (the page currently asserts these aren't used). |
| Renamed key | Rename the row's `data-key` and the displayed `<td class="storage-key">`. |
| Removed key (feature deleted) | **Delete the row.** Stale entries in the inventory are also a privacy violation. |
| New dynamic key pattern (e.g. `myfeature-{id}-...`) | Add it to `DYNAMIC_PREFIXES` in the page's `<script>` and to the prefix legend AND to the relevant "Delete all" button's `data-clear-prefixes` so bulk-delete still wipes everything. |
| Changed cookie expiry / `path` / `SameSite` / `Secure` / `HttpOnly` / domain | Update the row's purpose blurb if the change is user-visible (session vs persistent, scope expansion, etc.). |
| Swapped backends (e.g. cookie → localStorage) | Move the row to the right table AND update its `data-storage` attribute. |

If the changed key is a user-facing setting, update `settings.html` too. That includes checkboxes, selects, sliders, color pickers, feature flags, URL-parameter preferences that persist, per-page layout preferences, and anything described to the user as "remembered", "saved", "enabled", "disabled", or "preferred".

## How to update `cookies.html`

1. **Find the right category.** The page is grouped by feature, not by storage type alone. Pick the table that the new key belongs to (UI & reading preferences, SE Book bookmarks, SE Gym, Accessibility & audio, SE Gym performance statistics, Tutorial progress & debugger state, Standalone tutorials). If none fits, add a new `<h3>` + `<table>` + bulk-delete button — copy the structure of an existing block.
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
5. **Re-check the "Where else does this site store data?" bullets** at the bottom for `sessionStorage`, `IndexedDB`, Cache API, Service Worker, BroadcastChannel, File System Access, third-party CDNs, and cross-origin cookies. The bullets currently read "not used" / "ephemeral only" for several of them — if your change makes any of those statements wrong, rewrite the bullet *and* (where it makes sense) add a delete action.
6. **Internal-only counts.** A key that no UI surface lets the user toggle still appears in the inventory if it persists across sessions. Privacy is about what's *stored*, not what's *exposed*.

## How to update `settings.html`

1. **Decide whether the key is a setting.** A setting is any value the user can intentionally change to affect site behavior or presentation. Examples: dark mode, reduced motion override, read-aloud voice, tutorial autosave, SE Gym performance tracking, editor split size, debugger collapsed panels, and accent colors. Progress records, bookmark contents, saved code, and stats are stored data; they belong in `cookies.html`, and only need `settings.html` when there is a user-facing control that governs them.
2. **Add or update the setting entry.** Use native controls wherever possible: checkbox for on/off, select for finite choices, range for numeric values, color input for color, and a button only for explicit actions such as reset. Every control needs a visible `<label>` and must update the same key documented in `cookies.html`.
3. **Name the storage key next to the setting.** Each entry on `/settings/` must expose the relevant cookie or `localStorage` key/prefix in visible text, so users can connect the preference to `/cookies/`.
4. **Represent per-page settings honestly.** Dynamic tutorial preferences such as editor split sizes or debugger panel collapse state may be changed inside the tutorial instead of centrally. They still need a row in `settings.html` that names the prefix and tells users where to change or delete them.
5. **Keep dark/light and WCAG requirements.** `settings.html` is browser-visible UI. Read the WCAG and light/dark skills before changing it, and prefer existing page patterns over decorative cards.

## When the unified notice itself needs updating

The text of the bottom-of-page notice lives in **one place**: [`_includes/cookie-notice.html`](../../../_includes/cookie-notice.html). The four layouts that show it (`default`, `blog`, `sebook`, `tutorial`) all `{% include %}` it. Edit the include — **never hand-edit the layouts** to change the notice text, **never duplicate the notice on individual pages** (the SE Gym page formerly had two; the inline copy was removed and replaced with `{% comment %}...{% endcomment %}` to make the rationale visible to future authors). The include uses `{% unless page.url contains '/cookies' %}` to suppress itself on the inventory page.

If you add a new layout, include `{% include cookie-notice.html %}` near the footer or you'll have a layout that lies by omission.

## Quick checklist before you finish a change

- [ ] Did I touch any storage API or helper from the table above? → ran the workflow.
- [ ] Did I add/rename/remove a key? → updated `cookies.html` (row added / renamed / **deleted**).
- [ ] Did I add/rename/remove a user-facing setting? → updated `settings.html` with a visible label, control or explanatory row, and storage key/prefix.
- [ ] Did I touch a *dynamic* key pattern? → updated `DYNAMIC_PREFIXES`, the legend text, AND the `data-clear-prefixes` on the bulk-delete button.
- [ ] Did I introduce `sessionStorage` (persistent), `IndexedDB`, Cache API, Service Worker that caches, File System Access, or `BroadcastChannel` with a new name? → rewrote the corresponding bullet in "Where else does this site store data?"
- [ ] Did I add a third-party library that itself stores anything? → documented every key it touches.
- [ ] Did I change a cookie's expiry / scope / `SameSite` / `Secure`? → updated the purpose blurb if the change is user-visible.
- [ ] Did I want to add a per-feature notice? → don't. Edit `_includes/cookie-notice.html` instead, and let it apply everywhere.
- [ ] Does the new row's purpose explain it in plain English a non-developer can verify against their own data?

If you skipped any of these, go back and do them — the cookies page is a privacy contract, not an afterthought.

## Reference: known storage as of last skill update

This is a snapshot to help you spot duplicates and pick the right category — **`cookies.html` is the source of truth**, not this list.

**Cookies (14):**
- `dark-mode`, `show-highlights`, `highlights` (alias on blog index), `read-aloud`, `uml-accent-color`
- `se-bookmarks`, `se-bookmarks-active`
- `se-gym`, `se-gym-active`, `se-gym-timed-practice`, `se-gym-timer-mode`, `se-gym-timer-total-minutes`, `se-gym-timer-seconds-per-question`, `analyze-performance`

**localStorage — static (9):**
- `prefersReducedMotion`
- `abbr-underlines`
- `cap_volume`, `cap_speed`
- `tts-voice-name`
- `se-gym-stats`
- `tutorial-autosave`
- `regex-tutorial-progress`, `regex-tutorial-advanced-progress`

**localStorage — dynamic prefixes (7)** (one entry per tutorial id / page path):
- `tutorial-progress-<id>` — saved code & current step
- `tutorial-editor-split-<id>` — split-pane preference
- `tutorial-popout-state-<path>` — detached editor crash-recovery snapshot
- `tutorial-debug-bps-<id>` — debugger breakpoints
- `tutorial-debug-watchpoint-remove-choice-<id>` — watchpoint removal preference
- `tutorial-debug-section-<id>-<name>` — debugger panel collapse
- `tutorial-debug-subsection-<id>-<name>` — debugger sub-panel collapse

**Adjacent surfaces (currently documented as ephemeral / unused):**
- `sessionStorage` — one-time migration of `prefersReducedMotion`, plus the generated Python workspace's short-lived `archuml-generated-python-payload` reload bridge; neither persists across visits
- IndexedDB, Cache API, File System Access, WebSQL — **not used**
- Service Worker — `coi-serviceworker.js` is registered for COOP/COEP header injection on isolated tutorial workspaces and for the v86 VM asset cache; it stores no per-user data
- `BroadcastChannel` — channel names `ttsync-<path>`, `uml-sync-<path>`, and `v86-inbrowser-<n>` (v86 VM networking); messages are in-memory only
- Cross-origin cookies — third-party iframes (e.g. YouTube embeds) are out of scope

**User-facing settings currently represented in `/settings/`:**
- Dark mode: `dark-mode`
- Text highlights: `show-highlights` plus legacy alias `highlights`
- Reduced motion override: `prefersReducedMotion`
- Glossary abbreviation underlines: `abbr-underlines`
- Read-aloud controls and voice: `read-aloud`, `tts-voice-name`
- Audio defaults: `cap_volume`, `cap_speed`
- Tutorial autosave: `tutorial-autosave`
- UML accent color: `uml-accent-color`
- SEBook bookmarks enabled: `se-bookmarks-active`
- SE Gym enabled, timed practice, and performance tracking: `se-gym-active`, `se-gym-timed-practice`, `se-gym-timer-mode`, `se-gym-timer-total-minutes`, `se-gym-timer-seconds-per-question`, `analyze-performance`, `se-gym-stats`
- Per-tutorial state and progress: `tutorial-progress-<id>`, `tutorial-editor-split-<id>`, `tutorial-popout-state-<path>`, `tutorial-debug-bps-<id>`, `tutorial-debug-watchpoint-remove-choice-<id>`, `tutorial-debug-section-<id>-<name>`, `tutorial-debug-subsection-<id>-<name>`, `regex-tutorial-progress`, `regex-tutorial-advanced-progress`

If your change makes any line in this section wrong, edit `cookies.html` first, then update this snapshot.
