/*
 * The western kit for "Design It In Before They Break In", the security song: a frontier-town
 * visual language whose pictures carry the concepts, drawn in front of the
 * "frontier" theme (frontier.js). The real notation always stands beside
 * its picture:
 *
 *   the security plan is a board of four nailed posters, one per question,
 *   and each principle is a stamp pinned under the question it answers;
 *   text lives on plank signs (wood), posters and tags (parchment), and
 *   slates (code, in the shared syntax colours), never on the sky;
 *   protection mechanisms are padlocks and secrets are brass keys; a lock's
 *   blueprint is its published design;
 *   an attack is a crimson attack vector (`vector`) striking a way in, the
 *   app is a building whose ways in are its attack surface (`appFront`),
 *   stolen data leaves on an amber trail (`trail`), and a dashed ring shows
 *   a blast radius; the attacker itself is the outlaw of outlaw.js;
 *   the threat model is a wanted poster with four fields;
 *   the lecture's own artifacts (the login form, the post with comments,
 *   the network map, the four services) appear as cards and buildings;
 *   the 2026 Hugging Face case is a frontier gazette.
 *
 * Every builder schedules its own motion on the Timeline and is posed only
 * from song time. Coordinates are CSS pixels on the 960×540 stage; styles:
 * css/song-video-western-kit.css (`.wk-*`).
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, clamp, progress } = window.Timeline;
  const { el, svg, place, icon, writeCode, typewriter } = window.SongKit;
  const HIGHLIGHT = {
    js: window.SongKit.highlightJavaScript,
    python: window.SongKit.highlightPython,
    sql: window.SongKit.highlightSql,
    html: window.SongKit.highlightHtml,
    plain: (text) => [[text, null]],
  };

  // ------------------------------------------------------------------
  // Basics
  // ------------------------------------------------------------------

  /** Shows `node` at `at` (pop, rise, slam, fade, or drop); it has faded out by `until`. */
  function show(node, at, until, how = 'pop') {
    if (how === 'rise') fx.rise(node, at, { distance: 18, duration: 0.4 });
    else if (how === 'slam') fx.slam(node, at, { from: 1.8, duration: 0.3 });
    else if (how === 'fade') fx.fadeIn(node, at, 0.3);
    else if (how === 'drop') tween(node, [{ opacity: 0, translate: '0 -40px' }, { opacity: 1, translate: '0 0' }], at, 0.42, EASE.back);
    else fx.pop(node, at, { from: 0.6, duration: 0.36 });
    // Gone by `until`, so whatever arrives then never overlaps it.
    if (until !== undefined) fx.fadeOut(node, until - 0.27, 0.25);
    return node;
  }

  /** A positioned box: a div with `className`, placed at (x, y), sized w × h. */
  function box(parent, className, { x, y, w, h }) {
    const node = place(el('div', `${className} is-staged`, parent), x, y);
    if (w !== undefined) node.style.width = `${w}px`;
    if (h !== undefined) node.style.height = `${h}px`;
    return node;
  }

  /** Adds `className` to `node` from song time `from` until `to`. */
  function during(node, className, from, to = Infinity) {
    onFrame((t) => node.classList.toggle(className, t >= from && t < to));
    return node;
  }

  /** Adds `className` to `node` whenever song time is inside one of `spans` ([[from, to], …]). */
  function duringAny(node, className, spans) {
    onFrame((t) => node.classList.toggle(className, spans.some(([from, to = Infinity]) => t >= from && t < to)));
    return node;
  }

  /** A group that enters at `at` and has left by `until`, as one. */
  function group(parent, at, until) {
    const node = el('div', 'wk-group is-staged', parent);
    fx.fadeIn(node, at, 0.25);
    if (until !== undefined) fx.fadeOut(node, until - 0.27, 0.25);
    return node;
  }

  /** A stage-sized SVG overlay in `parent`, for trails, rings, and links. */
  function overlay(parent) {
    return svg('svg', { class: 'wk-overlay', viewBox: '0 0 960 540', width: 960, height: 540, 'aria-hidden': 'true' }, parent);
  }

  // ------------------------------------------------------------------
  // Text surfaces: plank signs, labels, tags, posters
  // ------------------------------------------------------------------

  /** A wooden plank sign with cream lettering (and an optional smaller second line). */
  function plank(parent, text, { x, y, w, at, until, sub, size, align = 'center', how = 'drop', tone }) {
    const node = box(parent, `wk-plank${tone ? ` wk-plank--${tone}` : ''}`, { x, y, w });
    node.style.textAlign = align;
    const title = el('div', 'wk-plank-title', node, text);
    if (size) title.style.fontSize = `${size}px`;
    if (sub) el('div', 'wk-plank-sub', node, sub);
    for (const side of ['left', 'right']) el('span', `wk-nail wk-nail--${side}`, node);
    return show(node, at, until, how);
  }

  /** A short label on a dark chip, so it reads over any scenery. tone: light, gold, green, red, amber. */
  function label(parent, text, { x, y, w, at, until, tone = 'light', size, align = 'left', how = 'rise', icon: iconName }) {
    const node = box(parent, `wk-label wk-label--${tone}`, { x, y, w });
    node.style.textAlign = align;
    if (iconName) node.append(icon(iconName, 'wk-label-icon'));
    node.append(document.createTextNode(text));
    if (size) node.style.fontSize = `${size}px`;
    return show(node, at, until, how);
  }

  /** A parchment tag tied on with a string. */
  function tag(parent, text, { x, y, w, at, until, icon: iconName, tone = 'paper', how = 'pop', rotate = 0, redactAt }) {
    const node = box(parent, `wk-tag wk-tag--${tone}`, { x, y, w });
    if (rotate) node.style.rotate = `${rotate}deg`;
    if (iconName) node.append(icon(iconName, 'wk-tag-icon'));
    const words = el('span', 'wk-tag-text', node, text);
    // Blacked out from `redactAt`: the text stays in place under a bar.
    if (redactAt !== undefined) during(words, 'is-redacted', redactAt);
    return show(node, at, until, how);
  }

  /**
   * A parchment poster nailed at its top: an optional kicker, a title, and
   * body lines. Returns { node, body } so callers can add to it.
   */
  function poster(parent, { x, y, w, h, kicker, title, lines = [], at, until, rotate = 0, how = 'drop', className = '' }) {
    const node = box(parent, `wk-poster ${className}`, { x, y, w, h });
    if (rotate) node.style.rotate = `${rotate}deg`;
    el('span', 'wk-poster-nail', node);
    if (kicker) el('div', 'wk-poster-kicker', node, kicker);
    if (title) el('div', 'wk-poster-title', node, title);
    const body = el('div', 'wk-poster-body', node);
    for (const ln of lines) el('div', 'wk-poster-line', body, ln);
    show(node, at, until, how);
    return { node, body };
  }

  /**
   * A principle stamp: a stamped name with its rule beneath, on a parchment
   * slip. `tone` green (a principle), red (an attack's name), gold.
   */
  function stamp(parent, name, { x, y, w = 380, rule, at, until, tone = 'green', rotate = -3, before, after }) {
    const node = box(parent, `wk-stamp wk-stamp--${tone}`, { x, y, w });
    const title = el('div', 'wk-stamp-name', node);
    if (before) el('span', 'wk-stamp-word', title, `${before} `);
    title.append(document.createTextNode(name));
    if (after) el('span', 'wk-stamp-word', title, ` ${after}`);
    if (rule) el('div', 'wk-stamp-rule', node, rule);
    node.style.rotate = `${rotate}deg`;
    fx.slam(node, at, { from: 1.6, rotate });
    if (until !== undefined) fx.fadeOut(node, until - 0.27, 0.25);
    return node;
  }

  // ------------------------------------------------------------------
  // Code slates, browsers, forms, alerts
  // ------------------------------------------------------------------

  /**
   * A slate of code in a wooden frame. lines: text, or { text, hl: [{ part,
   * at, until, tone }] } to mark a part of the line from `at` (tone amber,
   * green, red), or { text, at } for a line that appears later.
   */
  function slate(parent, { x, y, w, title, lang = 'js', lines, at, until, how = 'rise', size }) {
    const node = box(parent, 'wk-slate', { x, y, w });
    if (title) el('div', 'wk-slate-title', node, title);
    const code = el('div', 'wk-slate-code', node);
    if (size) code.style.fontSize = `${size}px`;
    for (const line of lines) {
      const spec = typeof line === 'string' ? { text: line } : line;
      const row = el('div', 'wk-code-line', code);
      const marks = spec.hl ?? [];
      let rest = spec.text;
      for (const mark of marks) {
        const i = rest.indexOf(mark.part);
        if (i < 0) continue;
        writeCode(row, HIGHLIGHT[lang](rest.slice(0, i)));
        const span = el('span', `wk-mark wk-mark--${mark.tone ?? 'amber'}`, row);
        writeCode(span, HIGHLIGHT[lang](mark.part));
        during(span, 'is-on', mark.at, mark.until);
        rest = rest.slice(i + mark.part.length);
      }
      writeCode(row, HIGHLIGHT[lang](rest));
      if (spec.at !== undefined) {
        row.classList.add('is-staged');
        fx.fadeIn(row, spec.at, 0.25);
      }
    }
    return show(node, at, until, how);
  }

  /** A browser window: a title bar with an address; returns { node, view }. */
  function browser(parent, { x, y, w, h, url = 'your-app.example', at, until, how = 'rise' }) {
    const node = box(parent, 'wk-browser', { x, y, w, h });
    const bar = el('div', 'wk-browser-bar', node);
    for (const dot of ['r', 'y', 'g']) el('span', `wk-dot wk-dot--${dot}`, bar);
    const address = el('span', 'wk-address', bar);
    address.append(icon('lock', 'wk-address-lock'));
    address.append(document.createTextNode(url));
    const view = el('div', 'wk-browser-view', node);
    show(node, at, until, how);
    return { node, view };
  }

  /** Text typed into `node` from `at` at `cps` characters a second. */
  function typed(node, text, at, cps = 22) {
    typewriter(node, text, at, cps);
    return node;
  }

  /**
   * The lecture's login form (slide 7): a username, a password typed in
   * clear when the song needs to show it, a button, and an optional result.
   */
  function loginForm(parent, { x, y, w = 300, at, until, user = 'Bruin', userAt, pass, passAt, cps = 18, masked = false, result, resultAt, resultTone = 'red', how = 'rise' }) {
    const node = box(parent, 'wk-form', { x, y, w });
    el('div', 'wk-form-title', node, 'Log in');
    const field = (name) => {
      el('div', 'wk-form-label', node, name);
      return el('div', 'wk-form-field', node);
    };
    const u = field('Username');
    if (userAt !== undefined) typed(u, user, userAt, cps);
    else u.textContent = user;
    const p = field('Password');
    p.classList.add('wk-form-field--pass');
    if (pass !== undefined) typed(p, masked ? '•'.repeat(pass.length) : pass, passAt, cps);
    el('div', 'wk-form-button', node, 'Log in');
    if (result) {
      const r = el('div', `wk-form-result wk-form-result--${resultTone} is-staged`, node, result);
      fx.pop(r, resultAt, { from: 0.7 });
    }
    return show(node, at, until, how);
  }

  /**
   * The post's timestamp: now, by the viewer's own clock, as a social-media
   * post shows it ("Nov 13 at 10:42 PM"). It is read once, when the player
   * builds the scene.
   */
  function postedAt(now = new Date()) {
    const day = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${day} at ${time}`;
  }

  /** A small round profile picture: a head-and-shoulders silhouette on a coloured disc. */
  function avatar(parent, tone = 'blue') {
    const node = el('span', `wk-avatar wk-avatar--${tone}`, parent);
    const art = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, node);
    svg('circle', { class: 'wk-avatar-head', cx: 12, cy: 9.4, r: 4.4 }, art);
    svg('path', { class: 'wk-avatar-head', d: 'M3.6 22 C4.6 16.6 8 14.6 12 14.6 C16 14.6 19.4 16.6 20.4 22 Z' }, art);
    return node;
  }

  // The post's little pictures: the reaction badges and the action icons.
  const POST_ICONS = {
    like: 'M7 10 V19 H4 V10 Z M9 10 L12.6 4 C13.6 3.4 15 4 14.6 5.6 L13.8 9 H18.6 C19.8 9 20.6 10.2 20.2 11.4 L18.4 17.6 C18.1 18.5 17.3 19 16.4 19 H9 Z',
    love: 'M12 19.6 C7 16 4 13 4 9.6 C4 7.2 5.8 5.6 7.9 5.6 C9.6 5.6 11 6.6 12 8 C13 6.6 14.4 5.6 16.1 5.6 C18.2 5.6 20 7.2 20 9.6 C20 13 17 16 12 19.6 Z',
    comment: 'M4 6.6 C4 5.2 5.2 4 6.6 4 H17.4 C18.8 4 20 5.2 20 6.6 V13.6 C20 15 18.8 16.2 17.4 16.2 H10 L6 19.6 V16.2 C4.8 16 4 15 4 13.6 Z',
    share: 'M14 4.6 L20.4 10.4 L14 16.2 V12.8 C9.6 12.6 6.6 14.2 4 18 C4.6 12.4 7.8 8.6 14 8 Z',
  };
  function postIcon(parent, name, className) {
    const art = svg('svg', { class: className, viewBox: '0 0 24 24', 'aria-hidden': 'true' }, parent);
    svg('path', { d: POST_ICONS[name] }, art);
    return art;
  }

  /** A comment: the commenter's picture and a bubble with the name in bold over the text. */
  function comment(list, name, text, { tone = 'green', className = '' } = {}) {
    const row = el('div', `wk-comment-row${className ? ` ${className}` : ''}`, list);
    avatar(row, tone);
    const bubble = el('div', 'wk-comment', row);
    el('span', 'wk-comment-name', bubble, name);
    const body = el('span', 'wk-comment-text', bubble, text);
    return { row, body };
  }

  /**
   * The lecture's post (slides 12–14) inside a browser view, drawn as the
   * slides draw it: the author and date, the post, who liked it and how many
   * comments it has, Like · Comment · Share, the comments (names in bold),
   * and "Write a comment …". The comment box types `typedText` from
   * `typedAt` and posts it at `postAt` as `commenter`'s comment (the comment
   * count goes up by one); a posted script shows nothing until `escapeAt`,
   * when the page escapes it and the comment shows the script as text.
   */
  function post(view, { comments = [['Carey Nachenberg', 'Facts']], typedText, typedAt, postAt, commenter = 'Attacker', escapeAt, count = 5 } = {}) {
    const card = el('div', 'wk-post', view);
    const head = el('div', 'wk-post-head', card);
    avatar(head, 'blue');
    const who = el('div', 'wk-post-who', head);
    el('div', 'wk-post-author', who, 'Tobias Dürschmid');
    el('div', 'wk-post-date', who, postedAt());
    const text = el('div', 'wk-post-text', card);
    el('span', 'wk-post-line', text, 'UCLA students are by far the best students.');
    el('span', 'wk-post-line', text, 'Go Bruins!');
    const stats = el('div', 'wk-post-stats', card);
    const likes = el('span', 'wk-post-likes', stats);
    postIcon(likes, 'like', 'wk-reaction wk-reaction--like');
    postIcon(likes, 'love', 'wk-reaction wk-reaction--love');
    el('span', 'wk-post-likers', likes, 'David Smallberg, Sandra Batista, and 999 others');
    const counts = el('span', 'wk-post-count', stats);
    const before = el('span', '', counts, `${count} comments`);
    if (typedText) {
      const after = el('span', '', counts, `${count + 1} comments`);
      during(before, 'is-hidden', postAt);
      after.classList.add('is-hidden');
      during(after, 'is-shown', postAt);
    }
    const actions = el('div', 'wk-post-actions', card);
    for (const [name, iconName] of [['Like', 'like'], ['Comment', 'comment'], ['Share', 'share']]) {
      const action = el('span', 'wk-post-action', actions);
      postIcon(action, iconName, 'wk-post-action-icon');
      action.append(document.createTextNode(name));
    }
    const list = el('div', 'wk-post-comments', card);
    comments.forEach(([name, text], i) => comment(list, name, text, { tone: ['green', 'amber'][i % 2] }));
    if (typedText) {
      // A posted script shows nothing; once escaped, the same comment shows
      // the script as plain text.
      const posted = comment(list, commenter, typedText, { tone: 'red', className: 'wk-comment-row--new wk-comment-row--escaped is-staged' });
      fx.fadeIn(posted.row, postAt, 0.2);
      posted.body.classList.add('is-hidden');
      if (escapeAt !== undefined) during(posted.body, 'is-shown', escapeAt);
    }
    const write = el('div', 'wk-write', card);
    avatar(write, 'red');
    const input = el('div', 'wk-comment-box', write);
    const hint = el('span', 'wk-comment-hint', input, 'Write a comment …');
    if (typedText) {
      const text = el('span', 'wk-comment-typed', input);
      typed(text, typedText, typedAt, 26);
      during(hint, 'is-hidden', typedAt, postAt);
      during(text, 'is-hidden', postAt);
    }
    return card;
  }

  /** A JavaScript alert inside a page, as the lecture's slide draws it: "Alert", the message, and OK. */
  function alertBox(parent, text, { x, y, w = 200, at, until, ok = true }) {
    const node = box(parent, 'wk-alert', { x, y, w });
    el('div', 'wk-alert-title', node, 'Alert');
    el('div', 'wk-alert-text', node, text);
    if (ok) el('div', 'wk-alert-ok', node, 'OK');
    return show(node, at, until, 'pop');
  }

  // ------------------------------------------------------------------
  // Pictures: padlocks, keys, the strongbox, assets, the flowerpot
  // ------------------------------------------------------------------

  /** A padlock with its label; `openAt` springs the shackle open. tone: iron, brass. */
  function padlock(parent, { x, y, size = 64, label: name, at, until, openAt, tone = 'iron', how = 'pop' }) {
    const node = box(parent, `wk-padlock wk-padlock--${tone}`, { x, y, w: size });
    const art = svg('svg', { viewBox: '0 0 64 76', width: size, height: size * 76 / 64, 'aria-hidden': 'true' }, node);
    const shackle = svg('path', { class: 'wk-shackle', d: 'M18 34 V22 A14 14 0 0 1 46 22 V34' }, art);
    svg('rect', { class: 'wk-lock-body', x: 8, y: 32, width: 48, height: 40, rx: 7 }, art);
    svg('path', { class: 'wk-lock-shine', d: 'M14 38 H30' }, art);
    svg('path', { class: 'wk-keyhole', d: 'M32 46 A5 5 0 1 1 31.9 46 Z M29.6 52 L34.4 52 L35.6 63 L28.4 63 Z' }, art);
    if (openAt !== undefined) tween(shackle, [{ translate: '0 0', rotate: '0deg' }, { translate: '0 -8px', rotate: '-24deg' }], openAt, 0.35, EASE.back);
    if (name) el('div', 'wk-padlock-label', node, name);
    return show(node, at, until, how);
  }

  /** A brass key with a parchment tag. */
  function key(parent, { x, y, w = 120, label: name, at, until, how = 'pop', tone = 'brass' }) {
    const node = box(parent, `wk-key wk-key--${tone}`, { x, y, w });
    const art = svg('svg', { viewBox: '0 0 120 40', width: 120, height: 40, 'aria-hidden': 'true' }, node);
    svg('circle', { class: 'wk-key-bow', cx: 18, cy: 20, r: 14 }, art);
    svg('circle', { class: 'wk-key-hole', cx: 18, cy: 20, r: 5 }, art);
    svg('path', { class: 'wk-key-bow', d: 'M31 16 H104 V24 H96 V32 H88 V24 H80 V30 H72 V24 H31 Z' }, art);
    svg('path', { class: 'wk-key-shine', d: 'M10 12 Q14 8 20 8 M34 18 H100' }, art);
    if (name) el('div', 'wk-key-tag', node, name);
    return show(node, at, until, how);
  }

  /** The strongbox the assets come out of; its lid opens at `openAt`. */
  function strongbox(parent, { x, y, w = 200, at, until, openAt }) {
    const node = box(parent, 'wk-strongbox', { x, y, w });
    const art = svg('svg', { viewBox: '0 0 200 150', width: w, height: w * 0.75, 'aria-hidden': 'true' }, node);
    // What the system keeps, rising out of the chest as it opens: the users'
    // records in a database, a personal ID card, a password, and the key to
    // it all. They sit behind the chest's front, which hides their bottoms.
    const loot = svg('g', { class: 'wk-box-loot' }, art);
    const db = svg('g', { transform: 'translate(46 30)' }, loot);
    svg('path', { class: 'wk-loot-db', d: 'M0 8 V44 A20 6 0 0 0 40 44 V8 Z' }, db);
    svg('path', { class: 'wk-loot-disk', d: 'M0 20 A20 6 0 0 0 40 20 M0 32 A20 6 0 0 0 40 32' }, db);
    svg('ellipse', { class: 'wk-loot-db-top', cx: 20, cy: 8, rx: 20, ry: 6 }, db);
    const card = svg('g', { transform: 'translate(92 26) rotate(-8)' }, loot);
    svg('rect', { class: 'wk-loot-card', x: 0, y: 0, width: 42, height: 30, rx: 3 }, card);
    svg('circle', { class: 'wk-loot-face', cx: 11, cy: 12, r: 5 }, card);
    svg('path', { class: 'wk-loot-face', d: 'M4 26 C5 20 17 20 18 26 Z' }, card);
    svg('path', { class: 'wk-loot-line', d: 'M23 10 H37 M23 16 H37 M23 22 H33' }, card);
    const pass = svg('g', { transform: 'translate(132 40) rotate(6)' }, loot);
    svg('rect', { class: 'wk-loot-pass', x: 0, y: 0, width: 40, height: 14, rx: 3 }, pass);
    for (let k = 0; k < 4; k += 1) svg('circle', { class: 'wk-loot-dot', cx: 8 + k * 8, cy: 7, r: 2 }, pass);
    const key = svg('g', { transform: 'translate(150 22) rotate(70)' }, loot);
    svg('circle', { class: 'wk-loot-key', cx: 0, cy: 0, r: 6 }, key);
    svg('circle', { class: 'wk-loot-key-hole', cx: 0, cy: 0, r: 2 }, key);
    svg('path', { class: 'wk-loot-key', d: 'M5 -1.5 H26 V5 H23 V1.5 H19 V4 H16 V1.5 H5 Z' }, key);
    // The chest: its front, bands, and lock, then the lid that tips back open.
    svg('rect', { class: 'wk-box-body', x: 14, y: 62, width: 172, height: 82, rx: 6 }, art);
    svg('path', { class: 'wk-box-band', d: 'M14 84 H186 M14 124 H186 M54 62 V144 M146 62 V144' }, art);
    svg('rect', { class: 'wk-box-lock', x: 88, y: 76, width: 24, height: 26, rx: 4 }, art);
    svg('path', { class: 'wk-box-keyhole', d: 'M100 84 A3 3 0 1 1 99.9 84 Z M98.6 88 H101.4 L102 95 H98 Z' }, art);
    const lid = svg('g', { class: 'wk-box-lid' }, art);
    svg('path', { class: 'wk-box-body', d: 'M14 62 V40 Q14 20 40 20 H160 Q186 20 186 40 V62 Z' }, lid);
    svg('path', { class: 'wk-box-band', d: 'M54 24 V62 M146 24 V62' }, lid);
    if (openAt !== undefined) {
      // The lid tips back on its hinge (seen from the front, it shortens
      // upwards to its lit inside), and the contents rise into view.
      tween(lid, [{ transform: 'none' }, { transform: 'translateY(-40px) scaleY(0.32)' }], openAt, 0.45, EASE.inOut);
      tween(loot, [{ transform: 'translateY(34px)' }, { transform: 'translateY(0px)' }], openAt + 0.15, 0.55, EASE.back);
    } else loot.setAttribute('transform', 'translate(0 34)');
    return show(node, at, until, 'rise');
  }

  /** An asset the security model defends: 'password', 'post', 'photo', or 'site' (a lantern, lit). */
  function asset(parent, kind, { x, y, w = 150, at, until, text }) {
    const node = box(parent, `wk-asset wk-asset--${kind}`, { x, y, w });
    if (kind === 'password') { el('div', 'wk-asset-name', node, 'Password'); el('div', 'wk-asset-field', node, '••••••••'); }
    if (kind === 'post') { el('div', 'wk-asset-name', node, 'Post'); el('div', 'wk-asset-text', node, text ?? 'Go Bruins!'); }
    if (kind === 'photo') {
      el('div', 'wk-asset-name', node, 'Photo');
      const art = svg('svg', { viewBox: '0 0 60 40', width: 60, height: 40, 'aria-hidden': 'true' }, node);
      svg('rect', { class: 'wk-photo-sky', x: 0, y: 0, width: 60, height: 40, rx: 3 }, art);
      svg('path', { class: 'wk-photo-hill', d: 'M0 40 L18 20 L30 32 L42 16 L60 40 Z' }, art);
      svg('circle', { class: 'wk-photo-sun', cx: 46, cy: 10, r: 5 }, art);
    }
    if (kind === 'site') {
      const art = svg('svg', { viewBox: '0 0 40 56', width: 34, height: 48, 'aria-hidden': 'true' }, node);
      svg('path', { class: 'wk-lantern-frame', d: 'M14 6 H26 M20 2 V6 M10 12 H30 L28 48 H12 Z M8 48 H32 V52 H8 Z' }, art);
      svg('ellipse', { class: 'wk-lantern-flame', cx: 20, cy: 32, rx: 5, ry: 9 }, art);
      el('div', 'wk-asset-name', node, text ?? 'Site: up');
    }
    return show(node, at, until, 'pop');
  }

  /**
   * One CIA attribute's card: its name, an icon, and its rule
   * (Confidentiality: eye, Integrity: pencil, Availability: timer).
   */
  function ciaCard(parent, { x, y, w = 196, name, rule, iconName, at, until, how = 'pop' }) {
    const node = box(parent, 'wk-cia', { x, y, w });
    const head = el('div', 'wk-cia-head', node);
    head.append(icon(iconName, 'wk-cia-icon'));
    head.append(document.createTextNode(name));
    el('div', 'wk-cia-rule', node, rule);
    return show(node, at, until, how);
  }

  /** The porch from the lecture (slide 19): a door, a flowerpot, and the key under it. */
  function flowerpot(parent, { x, y, w = 260, at, until, liftAt, takeAt, openAt, honey = false, honeyTakeAt, dropAt, tipAt, untipAt }) {
    const node = box(parent, 'wk-porch', { x, y, w });
    const art = svg('svg', { viewBox: '0 0 260 170', width: w, height: w * 170 / 260, 'aria-hidden': 'true' }, node);
    svg('rect', { class: 'wk-porch-wall', x: 0, y: 0, width: 260, height: 140 }, art);
    svg('path', { class: 'wk-porch-boards', d: 'M0 28 H260 M0 56 H260 M0 84 H260 M0 112 H260' }, art);
    svg('rect', { class: 'wk-porch-doorway', x: 24, y: 18, width: 70, height: 122 }, art);
    // The door swings open on its left hinges at `openAt`, showing the dark inside.
    const door = svg('g', { class: 'wk-porch-swing' }, art);
    svg('rect', { class: 'wk-porch-door', x: 24, y: 18, width: 70, height: 122, rx: 3 }, door);
    svg('circle', { class: 'wk-porch-knob', cx: 84, cy: 84, r: 4 }, door);
    if (openAt !== undefined) tween(door, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0.22)' }], openAt, 0.5, EASE.inOut);
    svg('rect', { class: 'wk-porch-floor', x: 0, y: 140, width: 260, height: 30 }, art);
    // Under the pot: the key, or (`honey`) a honeypot, a decoy that catches
    // whoever reaches for the key.
    const keyG = svg('g', { class: honey ? 'wk-honeypot' : 'wk-porch-key' }, art);
    if (honey) {
      svg('path', { class: 'wk-honey-jar', d: 'M164 116 H216 C221 116 224 119 224 124 V150 C224 156 220 160 214 160 H166 C160 160 156 156 156 150 V124 C156 119 159 116 164 116 Z' }, keyG);
      svg('rect', { class: 'wk-honey-lid', x: 160, y: 108, width: 60, height: 10, rx: 3 }, keyG);
      svg('path', { class: 'wk-honey-drip', d: 'M166 119 C166 127 170 127 170 120 M206 119 C206 131 211 131 211 120' }, keyG);
      svg('rect', { class: 'wk-honey-label', x: 158, y: 129, width: 64, height: 19, rx: 2.5 }, keyG);
      const label = svg('text', { class: 'wk-honey-text', x: 190, y: 143, 'text-anchor': 'middle' }, keyG);
      label.textContent = 'HONEYPOT';
    } else {
      svg('circle', { cx: 176, cy: 150, r: 6 }, keyG);
      svg('path', { d: 'M182 148 H206 V152 H202 V156 H198 V152 H182 Z' }, keyG);
    }
    const pot = svg('g', { class: 'wk-pot' }, art);
    svg('path', { class: 'wk-pot-clay', d: 'M156 108 H224 L216 154 H164 Z' }, pot);
    svg('rect', { class: 'wk-pot-rim', x: 152, y: 100, width: 76, height: 12, rx: 3 }, pot);
    svg('path', { class: 'wk-pot-leaf', d: 'M190 100 C176 80 170 66 174 52 C186 62 192 78 190 100 Z M190 100 C200 78 214 68 226 66 C222 82 206 94 190 100 Z M190 100 C188 80 192 60 200 44 C206 62 200 84 190 100 Z' }, pot);
    if (liftAt !== undefined) tween(pot, [{ transform: 'none' }, { transform: 'translate(-30px, -40px) rotate(-12deg)' }], liftAt, 0.5, EASE.back);
    // Tipped up by a hand at its left rim, on its bottom right corner, and set back down.
    if (tipAt !== undefined || untipAt !== undefined) {
      pot.style.transformBox = 'view-box';
      pot.style.transformOrigin = '224px 154px';
    }
    if (tipAt !== undefined) tween(pot, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(32deg)' }], tipAt, 0.35, EASE.inOut);
    if (untipAt !== undefined) tween(pot, [{ transform: 'rotate(32deg)' }, { transform: 'rotate(0deg)' }], untipAt, 0.35, EASE.inOut);
    if (dropAt !== undefined) tween(pot, [{ transform: 'translate(-30px, -40px) rotate(-12deg)' }, { transform: 'none' }], dropAt, 0.35, EASE.inOut);
    if (takeAt !== undefined) tween(keyG, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate(0px, -40px)' }], takeAt, 0.5, EASE.inOut);
    // The honeypot is hidden under the pot until it is lifted.
    const revealAt = tipAt ?? liftAt;
    if (honey && revealAt !== undefined) tween(keyG, [{ opacity: 0 }, { opacity: 1 }], revealAt + 0.08, 0.15, EASE.inOut);
    if (honeyTakeAt !== undefined) tween(keyG, [{ opacity: 1 }, { opacity: 0 }], honeyTakeAt, 0.12, EASE.inOut);
    return show(node, at, until, 'rise');
  }

  // ------------------------------------------------------------------
  // The attack surface: the app as a building with its ways in
  // ------------------------------------------------------------------

  // The building's ways in, in its own 560×280 frame: where each opening's
  // label sits (percent of the front) and where an attack strikes it.
  const ENTRIES = {
    sign: { label: 'URL', icon: 'link', at: [408, 44], chip: [15, 9] },
    door: { label: 'Login form', icon: 'door', at: [130, 214], chip: [23, 97] },
    window: { label: 'Comment box', icon: 'chat', at: [282, 186], chip: [50, 97] },
    hatch: { label: 'Photo upload', icon: 'image', at: [440, 206], chip: [78, 97] },
  };

  /**
   * The app as a frontier building (`w` wide): a false front whose sign is
   * the app's address, a porch, swinging doors with the login card on them,
   * a window with a speech-bubble sign for comments, and a loading hatch
   * for photo uploads. Each way in is labelled from its time in `labels`
   * ({ sign, door, window, hatch }); `point(name)` gives the stage point an
   * attack vector strikes.
   */
  function appFront(parent, { x, y, w = 560, at, until, labels = {}, url = 'your-app.example' }) {
    const k = w / 560;
    const node = box(parent, 'wk-app-front', { x, y, w });
    const art = svg('svg', { viewBox: '0 0 560 280', width: w, height: 280 * k, 'aria-hidden': 'true' }, node);
    svg('path', { class: 'wk-af-wall', d: 'M40 82 H520 V272 H40 Z' }, art);
    svg('path', { class: 'wk-af-siding', d: Array.from({ length: 9 }, (_, i) => `M40 ${100 + i * 20} H520`).join(' ') }, art);
    svg('path', { class: 'wk-af-front', d: 'M20 82 V18 C120 6 440 6 540 18 V82 Z' }, art);
    svg('rect', { class: 'wk-af-sign', x: 150, y: 24, width: 260, height: 40, rx: 6 }, art);
    const sign = svg('text', { class: 'wk-af-sign-text', x: 280, y: 51, 'text-anchor': 'middle' }, art);
    sign.textContent = url;
    svg('path', { class: 'wk-af-porch', d: 'M24 120 H536 L528 134 H32 Z' }, art);
    for (const px of [44, 216, 344, 516]) svg('rect', { class: 'wk-af-post', x: px - 4, y: 134, width: 8, height: 138 }, art);
    // The swinging doors, a login card nailed to them.
    svg('rect', { class: 'wk-af-dark', x: 96, y: 160, width: 68, height: 112 }, art);
    svg('path', { class: 'wk-af-door', d: 'M98 176 H129 V246 H98 Z M131 176 H162 V246 H131 Z' }, art);
    svg('rect', { class: 'wk-af-card', x: 106, y: 186, width: 48, height: 34, rx: 3 }, art);
    svg('path', { class: 'wk-af-card-line', d: 'M112 196 H148 M112 204 H148 M118 212 H142' }, art);
    // The window, with a speech-bubble sign hanging inside.
    svg('rect', { class: 'wk-af-window', x: 234, y: 152, width: 96, height: 72, rx: 3 }, art);
    svg('path', { class: 'wk-af-mullion', d: 'M282 152 V224 M234 188 H330' }, art);
    svg('path', { class: 'wk-af-bubble', d: 'M260 166 H304 C308 166 310 168 310 172 V184 C310 188 308 190 304 190 H276 L268 197 V190 H260 C256 190 254 188 254 184 V172 C254 168 256 166 260 166 Z' }, art);
    // The loading hatch, a framed picture going in.
    svg('rect', { class: 'wk-af-hatch', x: 392, y: 166, width: 96, height: 82, rx: 4 }, art);
    svg('path', { class: 'wk-af-hatch-boards', d: 'M392 186 H488 M392 206 H488 M392 226 H488' }, art);
    svg('rect', { class: 'wk-af-picture', x: 414, y: 180, width: 52, height: 40, rx: 2 }, art);
    svg('path', { class: 'wk-af-picture-art', d: 'M418 214 L432 198 L444 210 L452 202 L462 214 Z' }, art);
    svg('circle', { class: 'wk-af-sun', cx: 454, cy: 190, r: 4 }, art);
    for (const [name, entry] of Object.entries(ENTRIES)) {
      if (labels[name] === undefined) continue;
      const chip = el('div', 'wk-af-chip is-staged', node);
      chip.append(icon(entry.icon, 'wk-af-chip-icon'));
      chip.append(document.createTextNode(entry.label));
      chip.style.left = `${entry.chip[0]}%`;
      chip.style.top = `${entry.chip[1]}%`;
      fx.pop(chip, labels[name], { from: 0.6 });
    }
    show(node, at, until, 'rise');
    return { node, point: (name) => [x + ENTRIES[name].at[0] * k, y + ENTRIES[name].at[1] * k] };
  }

  // ------------------------------------------------------------------
  // Trails, rings, cursors
  // ------------------------------------------------------------------

  /**
   * A path that draws itself on from `at`, its head travelling at the tip
   * (dashed: a trail of footsteps). tone 'cookie' carries a stolen session
   * cookie along it: data leaving, where an attack vector (`vector`) is
   * an attack coming in.
   */
  function trail(art, d, { at, until, duration = 0.8, tone = 'amber', dashed = true, arrow = true }) {
    const g = svg('g', { class: `wk-trail wk-trail--${tone} is-staged` }, art);
    const path = svg('path', { class: 'wk-trail-line', d, pathLength: 1 }, g);
    if (dashed) svg('path', { class: 'wk-trail-dash', d }, g);
    fx.fadeIn(g, at, 0.15);
    fx.draw(path, at, duration);
    if (arrow) {
      const head = svg('g', {}, g);
      if (tone === 'cookie') {
        svg('circle', { class: 'wk-trail-head', r: 7.5 }, head);
        for (const [cx, cy] of [[-2.6, -2.2], [2.4, -0.6], [-0.6, 3]]) svg('circle', { class: 'wk-cookie-chip', cx, cy, r: 1.3 }, head);
      } else svg('circle', { class: 'wk-trail-head', r: 4.5 }, head);
      onFrame((t) => {
        const u = clamp((t - at) / duration, 0, 1);
        const p = path.getPointAtLength ? path.getPointAtLength(u * path.getTotalLength()) : { x: 0, y: 0 };
        head.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
      });
    }
    if (until !== undefined) fx.fadeOut(g, until - 0.27, 0.25);
    return g;
  }

  /** A gold triangle through three points that draws itself on from `at` (the CIA triad's edges). */
  function triangle(art, points, { at, until, duration = 0.8 }) {
    const d = `M${points.map(([x, y]) => `${x} ${y}`).join(' L')} Z`;
    const g = svg('g', { class: 'wk-triangle is-staged' }, art);
    const casing = svg('path', { class: 'wk-triangle-casing', d, pathLength: 1 }, g);
    const line = svg('path', { class: 'wk-triangle-line', d, pathLength: 1 }, g);
    fx.fadeIn(g, at, 0.1);
    fx.draw(casing, at, duration);
    fx.draw(line, at, duration);
    if (until !== undefined) fx.fadeOut(g, until - 0.27, 0.25);
    return g;
  }

  /**
   * An attack vector: first a reticle marks the target (from `at` −
   * `aim`), then a crimson arrow draws itself on along `d` from the
   * attacker to it from `at`, over `duration`; once it has struck,
   * chevrons march along it towards the target.
   */
  function vector(art, d, { at, until, duration = 0.7, impact = true, aim = 0.45 }) {
    const g = svg('g', { class: 'wk-vector is-staged' }, art);
    const casing = svg('path', { class: 'wk-vector-casing', d, pathLength: 1 }, g);
    const line = svg('path', { class: 'wk-vector-line', d, pathLength: 1 }, g);
    const flow = svg('path', { class: 'wk-vector-flow', d }, g);
    const head = svg('path', { class: 'wk-vector-head', d: 'M2 0 L-15 -8.6 L-10.6 0 L-15 8.6 Z' }, g);
    const reticle = impact ? svg('g', { class: 'wk-vector-reticle is-staged' }, g) : null;
    if (reticle) {
      svg('circle', { r: 9.5 }, reticle);
      svg('circle', { r: 3.2 }, reticle);
      svg('path', { d: 'M0 -15 V-11 M0 11 V15 M-15 0 H-11 M11 0 H15' }, reticle);
    }
    fx.fadeIn(g, at - (impact ? aim : 0), 0.12);
    fx.draw(casing, at, duration);
    fx.draw(line, at, duration);
    let length = 0;
    onFrame((t) => {
      length ||= line.getTotalLength ? line.getTotalLength() : 0;
      if (!length) return;
      const u = clamp((t - at) / duration, 0, 1);
      const tip = line.getPointAtLength(u * length);
      const back = line.getPointAtLength(Math.max(0, u * length - 3));
      const angle = Math.atan2(tip.y - back.y, tip.x - back.x) * 180 / Math.PI;
      head.setAttribute('transform', `translate(${tip.x.toFixed(1)} ${tip.y.toFixed(1)}) rotate(${angle.toFixed(1)})`);
      head.setAttribute('opacity', u > 0 ? '1' : '0');
      // The chevrons march towards the target, slowly, once it has struck.
      flow.setAttribute('opacity', clamp((t - at - duration) / 0.3, 0, 1).toFixed(2));
      flow.setAttribute('stroke-dashoffset', (-(t - at) * 22).toFixed(1));
      if (reticle) {
        const end = line.getPointAtLength(length);
        reticle.setAttribute('transform', `translate(${end.x.toFixed(1)} ${end.y.toFixed(1)})`);
      }
    });
    if (reticle) fx.pop(reticle, at - aim, { from: 0.4 });
    if (until !== undefined) fx.fadeOut(g, until - 0.27, 0.25);
    return g;
  }

  /**
   * A dashed blast-radius ring with its label, growing in at `at`; it can
   * change size at later times: sizes = [[time, cx, cy, rx, ry]].
   */
  function ring(art, { cx, cy, rx, ry, at, until, text = 'blast radius', textAt = 'top', sizes = [] }) {
    const g = svg('g', { class: 'wk-ring is-staged' }, art);
    const e = svg('ellipse', { class: 'wk-ring-line', cx, cy, rx, ry }, g);
    const labelY = (y0, ry0) => (textAt === 'bottom' ? y0 + ry0 + 22 : y0 - ry0 - 8);
    const t0 = svg('text', { class: 'wk-ring-text', x: cx, y: labelY(cy, ry), 'text-anchor': 'middle' }, g);
    t0.textContent = text;
    fx.fadeIn(g, at, 0.35);
    const keys = [[at, cx, cy, rx, ry], ...sizes];
    onFrame((t) => {
      let cur = keys[0];
      for (let i = 1; i < keys.length; i += 1) {
        const [when] = keys[i];
        if (t < when) break;
        const prev = cur, u = EASE.inOut ? clamp((t - when) / 0.6, 0, 1) : 1;
        const s = u * u * (3 - 2 * u);
        cur = [when, ...keys[i].slice(1).map((v, k) => prev[k + 1] + (v - prev[k + 1]) * s)];
      }
      const [, x0, y0, rx0, ry0] = cur;
      e.setAttribute('cx', x0.toFixed(1)); e.setAttribute('cy', y0.toFixed(1));
      e.setAttribute('rx', rx0.toFixed(1)); e.setAttribute('ry', ry0.toFixed(1));
      t0.setAttribute('x', x0.toFixed(1)); t0.setAttribute('y', labelY(y0, ry0).toFixed(1));
    });
    if (until !== undefined) fx.fadeOut(g, until, 0.25);
    return g;
  }

  /** A check or a cross mark popping in at `at`. */
  function tick(parent, { x, y, at, until, kind = 'check', size = 34 }) {
    const node = box(parent, `wk-tick wk-tick--${kind}`, { x, y, w: size, h: size });
    node.append(icon(kind, 'wk-tick-icon'));
    return show(node, at, until, 'pop');
  }

  // ------------------------------------------------------------------
  // The plan board
  // ------------------------------------------------------------------

  const PLAN = [
    { term: 'Security Model', q: 'What are you defending?' },
    { term: 'Threat Model', q: 'Who might be attacking?' },
    { term: 'Attack Surface', q: 'Which parts are exposed?' },
    { term: 'Protection Mechanisms', q: 'How do you stop them?' },
  ];
  // Each principle under its full name, as the lecture names it.
  const PRINCIPLES = [
    null,
    { name: 'Open Design', after: 'Principle', rule: 'Knowing how it works shouldn’t get them in.' },
    { name: 'Zero Trust', after: 'Principle', rule: 'Any input might be malicious.' },
    { name: 'Least Privilege', before: 'Principle of', rule: 'Each part gets only what it needs.' },
  ];
  // Each question's picture on its poster: what is defended, who attacks,
  // where they can get in, and what stops them.
  const PICTOGRAMS = ['chest', 'wanted', 'entry', 'padlock'];

  /**
   * The Security Plan board: a wooden frame with a plank title and four
   * posters, each the plan's question with its term. `blank` leaves the
   * posters' faces empty. `lights` = [[index, from, to]] lights a poster;
   * `pins` = { index: at } pins its answer under it (the CIA triangle under
   * poster 0, the principle stamps under the others); `ruleLights` = [[index,
   * from, to]] lights a pinned principle; `glowAt` lights them all.
   */
  function planBoard(parent, { x = 20, y = 54, w = 760, at, until, title = 'Design it in before they break in', blank = false, lights = [], pins = {}, ruleLights = [], glowAt, how = 'rise', small = false, heading }) {
    const node = box(parent, `wk-board${small ? ' wk-board--small' : ''}`, { x, y, w });
    el('div', 'wk-board-title', node, heading ?? title);
    const row = el('div', 'wk-board-row', node);
    PLAN.forEach((p, i) => {
      const col = el('div', 'wk-board-col', row);
      const card = el('div', `wk-board-poster${blank ? ' wk-board-poster--blank' : ''}`, col);
      el('span', 'wk-poster-nail', card);
      el('div', 'wk-board-n', card, String(i + 1));
      if (!blank) pictogram(card, PICTOGRAMS[i]);
      if (!blank) {
        el('div', 'wk-board-term', card, p.term);
        el('div', 'wk-board-q', card, p.q);
      }
      // One rule per node: its lit spans, and the closing glow.
      const glow = glowAt === undefined ? [] : [[glowAt]];
      duringAny(card, 'is-lit', [...lights.filter(([index]) => index === i).map(([, from, to]) => [from, to]), ...glow]);
      const slot = el('div', 'wk-board-slot', col);
      if (pins[i] !== undefined) {
        const pin = i === 0 ? ciaMini(slot) : principleMini(slot, PRINCIPLES[i]);
        pin.classList.add('is-staged');
        fx.slam(pin, pins[i], { from: 1.5, rotate: i === 0 ? 0 : -3 });
        duringAny(pin, 'is-lit', [...ruleLights.filter(([index]) => index === i).map(([, from, to]) => [from, to]), ...glow]);
      }
    });
    return show(node, at, until, how);
  }

  function ciaMini(parent) {
    const node = el('div', 'wk-cia-mini', parent);
    const art = svg('svg', { viewBox: '0 0 120 80', width: 120, height: 80, 'aria-hidden': 'true' }, node);
    svg('path', { class: 'wk-cia-tri', d: 'M60 8 L112 74 H8 Z' }, art);
    [['C', 60, 30], ['I', 30, 66], ['A', 90, 66]].forEach(([letter, cx, cy]) => {
      const tx = svg('text', { class: 'wk-cia-letter', x: cx, y: cy, 'text-anchor': 'middle' }, art);
      tx.textContent = letter;
    });
    el('div', 'wk-cia-mini-label', node, 'CIA triad');
    return node;
  }

  function principleMini(parent, { name, before, after, rule }) {
    const node = el('div', 'wk-principle-mini', parent);
    const title = el('div', 'wk-principle-name', node);
    if (before) el('span', 'wk-principle-word', title, before);
    el('span', 'wk-principle-term', title, name);
    if (after) el('span', 'wk-principle-word', title, after);
    el('div', 'wk-principle-rule', node, rule);
    return node;
  }

  /**
   * A plan poster's small picture, in its top-right corner: a treasure
   * chest (what you defend), a wanted poster (who attacks), a building
   * with an attack vector aimed at its door (where they get in), and a
   * padlock (what stops them).
   */
  function pictogram(parent, kind) {
    const art = svg('svg', { class: `wk-pictogram wk-pictogram--${kind}`, viewBox: '0 0 44 36', 'aria-hidden': 'true' }, parent);
    const add = (tag, cls, attrs) => svg(tag, { class: cls, ...attrs }, art);
    if (kind === 'chest') {
      add('path', 'wk-pg-gold', { d: 'M10 15 C12 9 18 8 22 11 C26 8 32 9 34 15 Z' });
      add('path', 'wk-pg-wood', { d: 'M7 16 H37 V31 H7 Z' });
      add('path', 'wk-pg-wood', { d: 'M7 16 C7 9 13 6 22 6 C31 6 37 9 37 16 Z', transform: 'rotate(-14 7 16)' });
      add('path', 'wk-pg-band', { d: 'M13 16 V31 M31 16 V31 M7 22 H37' });
      add('rect', 'wk-pg-plate', { x: 19, y: 19, width: 6, height: 7, rx: 1 });
    } else if (kind === 'wanted') {
      add('rect', 'wk-pg-paper', { x: 9, y: 2, width: 26, height: 32, rx: 1.5 });
      add('path', 'wk-pg-ink', { d: 'M13 7 H31' });
      add('circle', 'wk-pg-ink-fill', { cx: 22, cy: 17, r: 4.4 });
      add('path', 'wk-pg-ink-fill', { d: 'M14 12.6 H30 L27.6 10.6 C26 7.6 18 7.6 16.4 10.6 Z M13.6 30 C14.4 24.6 18 22.6 22 22.6 C26 22.6 29.6 24.6 30.4 30 Z' });
    } else if (kind === 'entry') {
      add('path', 'wk-pg-wood', { d: 'M14 10 H40 V33 H14 Z' });
      add('path', 'wk-pg-front', { d: 'M12 10 V5 H42 V10 Z' });
      add('rect', 'wk-pg-door', { x: 23, y: 20, width: 8, height: 13 });
      add('rect', 'wk-pg-window', { x: 16, y: 14, width: 5, height: 5 });
      add('rect', 'wk-pg-window', { x: 33, y: 14, width: 5, height: 5 });
      add('path', 'wk-pg-vector', { d: 'M1 27 H18' });
      add('path', 'wk-pg-vector-head', { d: 'M22 27 L15.6 23.4 L17 27 L15.6 30.6 Z' });
    } else {
      add('path', 'wk-pg-shackle', { d: 'M15 17 V11 A7 7 0 0 1 29 11 V17' });
      add('rect', 'wk-pg-brass', { x: 10, y: 16, width: 24, height: 18, rx: 3.4 });
      add('path', 'wk-pg-keyhole', { d: 'M22 21.6 A2.6 2.6 0 1 1 21.9 21.6 Z M20.8 24.6 H23.2 L23.8 30 H20.2 Z' });
    }
    return art;
  }

  // ------------------------------------------------------------------
  // The threat model: a wanted poster
  // ------------------------------------------------------------------

  /**
   * A wanted poster for the attacker: a silhouette, "Wanted for", and the
   * threat model's four fields, each appearing at its time with "?" until
   * its value (if any) is written in.
   */
  function wanted(parent, { x, y, w = 300, at, until, wantedFor = 'your users’ data', who = 'Unknown', fields = [] }) {
    const { node, body } = poster(parent, { x, y, w, title: 'Wanted', at, until, className: 'wk-wanted' });
    const face = el('div', 'wk-wanted-face', body);
    const art = svg('svg', { viewBox: '0 0 80 80', width: 80, height: 80, 'aria-hidden': 'true' }, face);
    svg('path', { class: 'wk-silhouette', d: 'M40 12 C30 12 25 20 25 30 C25 40 31 47 40 47 C49 47 55 40 55 30 C55 20 50 12 40 12 Z M14 80 C16 62 26 54 40 54 C54 54 64 62 66 80 Z' }, art);
    svg('path', { class: 'wk-silhouette', d: 'M18 22 H62 L58 16 C54 6 26 6 22 16 Z' }, art);
    el('div', 'wk-wanted-who', face, who);
    el('div', 'wk-wanted-for', body, `Wanted for: ${wantedFor}`);
    const list = el('div', 'wk-wanted-fields', body);
    for (const f of fields) {
      const row = el('div', 'wk-wanted-field is-staged', list);
      el('span', 'wk-wanted-name', row, `${f.name}:`);
      const value = el('span', 'wk-wanted-value', row, '?');
      fx.fadeIn(row, f.at, 0.25);
      if (f.value) {
        onFrame((t) => { value.textContent = t >= f.valueAt ? f.value : '?'; });
        during(row, 'is-filled', f.valueAt);
      }
    }
    return node;
  }

  // ------------------------------------------------------------------
  // The trust boundary: the lecture's network map (slide 18)
  // ------------------------------------------------------------------

  /**
   * Internet, a user, the company network (the boss's laptop and the
   * developer's device), the server, and its database. The trust boundary
   * (a dashed fence) surrounds the company network until `shrinkAt`, then
   * only the server; from `checkAt` a checkpoint guards the laptop's line.
   */
  function network(parent, { x, y, at, until, shrinkAt, checkAt }) {
    const node = box(parent, 'wk-network', { x, y, w: 600, h: 300 });
    const art = svg('svg', { viewBox: '0 0 600 300', width: 600, height: 300, 'aria-hidden': 'true' }, node);
    const links = 'M110 150 H250 M330 90 L410 140 M330 210 L410 160 M110 150 L60 80 M470 150 H530';
    svg('path', { class: 'wk-net-link', d: links }, art);
    const fence = svg('rect', { class: 'wk-fence', x: 220, y: 30, width: 280, height: 240, rx: 18 }, art);
    if (shrinkAt !== undefined) {
      tween(fence, [{ x: '220px', y: '30px', width: '280px', height: '240px' }, { x: '384px', y: '104px', width: '112px', height: '92px' }], shrinkAt, 0.8, EASE.inOut);
    }
    const nodes = [
      ['Internet', 'globe', 60, 150], ['User', 'user', 60, 60], ['Boss’s laptop', 'laptop', 290, 80],
      ['Developer’s device', 'laptop', 290, 220], ['Server', 'chip', 440, 150], ['Database', 'database', 545, 150],
    ];
    for (const [name, iconName, cx, cy] of nodes) {
      const n = el('div', 'wk-net-node', node);
      n.style.left = `${cx - 50}px`;
      n.style.top = `${cy - 26}px`;
      n.append(icon(iconName, 'wk-net-icon'));
      el('div', 'wk-net-name', n, name);
    }
    const companyLabel = el('div', 'wk-fence-label', node, 'Company network');
    companyLabel.style.left = '236px';
    companyLabel.style.top = '34px';
    if (shrinkAt !== undefined) fx.fadeOut(companyLabel, shrinkAt, 0.3);
    if (checkAt !== undefined) {
      const check = el('div', 'wk-checkpoint is-staged', node, 'Not trusted by default');
      check.style.left = '310px';
      check.style.top = '118px';
      fx.pop(check, checkAt, { from: 0.6 });
    }
    return show(node, at, until, 'rise');
  }

  // ------------------------------------------------------------------
  // The town of services (slide 36) and the bank (the database)
  // ------------------------------------------------------------------

  const SERVICES = [
    { name: 'Product Display', kind: 'store', right: 'read-only: Products table' },
    { name: 'Email Notification', kind: 'post', right: 'email API only, no database' },
    { name: 'System Backup', kind: 'warehouse', right: 'read-only; writes only to backup storage' },
    { name: 'Image Upload', kind: 'barn', right: 'write: /uploads only, no delete' },
  ];

  /** A small false-front building for a service. */
  function buildingArt(parent, kind) {
    const art = svg('svg', { viewBox: '0 0 120 90', width: 120, height: 90, 'aria-hidden': 'true' }, parent);
    if (kind === 'barn') {
      svg('path', { class: 'wk-bld-wall wk-bld-wall--barn', d: 'M10 88 V40 L60 10 L110 40 V88 Z' }, art);
      svg('path', { class: 'wk-bld-trim', d: 'M42 88 V54 H78 V88 M42 54 L78 88 M78 54 L42 88' }, art);
    } else {
      svg('path', { class: `wk-bld-wall wk-bld-wall--${kind}`, d: 'M14 88 V30 H8 V14 H112 V30 H106 V88 Z' }, art);
      svg('rect', { class: 'wk-bld-door', x: 50, y: 58, width: 20, height: 30 }, art);
      svg('rect', { class: 'wk-bld-window', x: 22, y: 42, width: 20, height: 16 }, art);
      svg('rect', { class: 'wk-bld-window', x: 78, y: 42, width: 20, height: 16 }, art);
    }
    return art;
  }

  /**
   * The four services as buildings in a row. `masterAt` hangs one admin key
   * on all of them; `splitAt` gives each its own key; `rightsAt` shows each
   * key's permission; `rightLights` = [[index, from]] lights a permission.
   * Returns the node and each building's centre (stage coordinates).
   */
  function services(parent, { x, y, at, until, masterAt, splitAt, rightsAt, rightLights = [] }) {
    const node = box(parent, 'wk-services', { x, y, w: 600 });
    const centres = [];
    SERVICES.forEach((s, i) => {
      const b = el('div', 'wk-service', node);
      b.style.left = `${i * 150}px`;
      buildingArt(b, s.kind);
      el('div', 'wk-service-name', b, s.name);
      centres.push([x + i * 150 + 70, y + 46]);
      if (splitAt !== undefined) {
        const k = el('div', 'wk-service-key is-staged', b);
        k.append(icon('key', 'wk-service-key-icon'));
        fx.pop(k, splitAt + i * 0.12, { from: 0.4 });
      }
      if (rightsAt !== undefined) {
        const r = el('div', 'wk-service-right is-staged', b, s.right);
        fx.fadeIn(r, rightsAt + i * 0.12, 0.25);
        for (const [index, from] of rightLights) if (index === i) during(r, 'is-lit', from);
      }
    });
    if (masterAt !== undefined) {
      const master = el('div', 'wk-master is-staged', node);
      master.append(icon('key', 'wk-master-icon'));
      el('span', 'wk-master-text', master, 'admin key: opens everything');
      fx.pop(master, masterAt, { from: 0.5 });
      if (splitAt !== undefined) fx.fadeOut(master, splitAt - 0.1, 0.25);
    }
    show(node, at, until, 'rise');
    return { node, centres };
  }

  /** The bank, the database: its tables in a vault, each opening, read, or changed. */
  function bank(parent, { x, y, w = 260, at, until, tables = ['Users', 'Products', 'Orders'], openAt, readAt, changeAt, lockedAt, lockedTable = 'Users' }) {
    const node = box(parent, 'wk-bank', { x, y, w });
    el('div', 'wk-bank-title', node, 'Database');
    const list = el('div', 'wk-bank-tables', node);
    for (const name of tables) {
      const row = el('div', 'wk-table', list);
      row.append(icon('database', 'wk-table-icon'));
      el('span', 'wk-table-name', row, name);
      if (openAt !== undefined) during(row, 'is-open', openAt, lockedAt !== undefined && name === lockedTable ? lockedAt : Infinity);
      if (readAt !== undefined) {
        const e = el('span', 'wk-table-badge is-staged', row);
        e.append(icon('eye'));
        fx.pop(e, readAt, { from: 0.4 });
      }
      if (changeAt !== undefined) {
        const c = el('span', 'wk-table-badge wk-table-badge--change is-staged', row);
        c.append(icon('pencil'));
        fx.pop(c, changeAt, { from: 0.4 });
      }
      if (lockedAt !== undefined && name === lockedTable) {
        during(row, 'is-locked', lockedAt, Infinity);
        const l = el('span', 'wk-table-lock is-staged', row);
        l.append(icon('lock'));
        el('span', '', l, 'no access');
        fx.pop(l, lockedAt, { from: 0.5 });
      }
    }
    return show(node, at, until, 'rise');
  }

  // ------------------------------------------------------------------
  // The gazette and the lessons notice
  // ------------------------------------------------------------------

  /** The Frontier Gazette's front page: masthead, date, headline, and byline. */
  function gazette(parent, { x, y, w = 880, at, until, headline, byline, date }) {
    const node = box(parent, 'wk-gazette', { x, y, w });
    el('div', 'wk-gazette-mast', node, 'The Frontier Gazette');
    el('div', 'wk-gazette-date', node, date);
    el('div', 'wk-gazette-head', node, headline);
    if (byline) el('div', 'wk-gazette-by', node, byline);
    const page = el('div', 'wk-gazette-page', node);
    show(node, at, until, 'rise');
    return { node, page };
  }

  /** One hop on the gazette's attack path: a labelled box. */
  function hop(parent, { x, y, w = 136, title, sub, iconName, at, until, tone }) {
    const node = box(parent, `wk-hop${tone ? ` wk-hop--${tone}` : ''}`, { x, y, w });
    const head = el('div', 'wk-hop-head', node);
    if (iconName) head.append(icon(iconName, 'wk-hop-icon'));
    head.append(document.createTextNode(title));
    if (sub) el('div', 'wk-hop-sub', node, sub);
    return show(node, at, until, 'pop');
  }

  /** A notice of rules: a title and items that appear one by one ([text, icon, at]). */
  function notice(parent, { x, y, w, title, items, at, until }) {
    const { node, body } = poster(parent, { x, y, w, title, at, until, className: 'wk-notice' });
    for (const [text, iconName, when] of items) {
      const row = el('div', 'wk-notice-item is-staged', body);
      row.append(icon(iconName, 'wk-notice-icon'));
      el('span', '', row, text);
      fx.rise(row, when, { distance: 10, duration: 0.3 });
    }
    return node;
  }

  // ------------------------------------------------------------------
  // The quiz poster
  // ------------------------------------------------------------------

  /** A numbered quiz poster: the question, then the answer stamped on at `answerAt`. */
  function quiz(parent, { x, y, w = 400, n, total, question, answer, at, answerAt, until }) {
    const { node, body } = poster(parent, { x, y, w, kicker: `Pop quiz · ${n} of ${total}`, at, until, className: 'wk-quiz' });
    el('div', 'wk-quiz-q', body, question);
    const a = el('div', 'wk-quiz-a is-staged', body, answer);
    fx.slam(a, answerAt, { from: 1.4, rotate: -2 });
    return node;
  }

  window.WesternKit = {
    show, box, during, group, overlay, plank, label, tag, poster, stamp, slate, browser, typed, loginForm, post,
    alertBox, avatar, padlock, key, strongbox, asset, ciaCard, flowerpot, appFront, trail, vector, triangle, ring, tick, planBoard, wanted,
    network, services, bank, gazette, hop, notice, quiz, PLAN, PRINCIPLES,
  };
})();
