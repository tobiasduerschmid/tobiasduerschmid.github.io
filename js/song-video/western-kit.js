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

  let porchCount = 0;

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
  /**
   * A wooden display board (the plan board's planks and frame) for a row of
   * hung padlocks, with an optional title plate; the locks go on top.
   */
  function lockBoard(parent, { x, y, w, h, at, until, title, how = 'rise' }) {
    const node = box(parent, 'wk-board wk-lock-board', { x, y, w, h });
    if (title) el('div', 'wk-board-title', node, title);
    return show(node, at, until, how);
  }

  /** The padlock's parts in its 64×76 frame; returns the shackle. */
  function lockArt(art) {
    svg('path', { class: 'wk-shackle-ink', d: 'M18 34 V22 A14 14 0 0 1 46 22 V34' }, art);
    const shackle = svg('path', { class: 'wk-shackle', d: 'M18 34 V22 A14 14 0 0 1 46 22 V34' }, art);
    svg('rect', { class: 'wk-lock-body', x: 8, y: 32, width: 48, height: 40, rx: 7 }, art);
    svg('path', { class: 'wk-lock-shade', d: 'M56 40 V65 C56 69 53 72 49 72 H15 C11.5 72 9 70 8.4 67 C24 68 44 66 56 40 Z' }, art);
    svg('path', { class: 'wk-lock-shine', d: 'M14 38 H30' }, art);
    for (const [cx, cy] of [[14, 38], [50, 38], [14, 66], [50, 66]]) svg('circle', { class: 'wk-lock-rivet', cx, cy, r: 1.8 }, art);
    svg('path', { class: 'wk-keyhole', d: 'M32 46 A5 5 0 1 1 31.9 46 Z M29.6 52 L34.4 52 L35.6 63 L28.4 63 Z' }, art);
    return shackle;
  }

  /**
   * A padlock (`size` wide), iron or brass, with an optional `label` under
   * it. Its shackle springs open at `openAt`; at `jiggleAt` it rattles and
   * stays shut. With `sketchAt`, a blueprint outline of it shows first,
   * from `sketchAt`, until the real lock arrives at `at`.
   */
  function padlock(parent, { x, y, size = 64, label: name, at, until, openAt, jiggleAt, sketchAt, tone = 'iron', how = 'pop', hung = false }) {
    const frame = (cls) => {
      const n = box(parent, cls, { x, y, w: size });
      return [n, svg('svg', { viewBox: '0 0 64 76', width: size, height: size * 76 / 64, 'aria-hidden': 'true' }, n)];
    };
    if (sketchAt !== undefined) {
      const [plan, planArt] = frame('wk-padlock wk-padlock--sketch');
      lockArt(planArt);
      show(plan, sketchAt, at + 0.05, 'fade');
    }
    const [node, art] = frame(`wk-padlock wk-padlock--${tone}`);
    // Hung on a board: a nail through the top of the shackle.
    if (hung) el('span', 'wk-padlock-nail', node);
    const shackle = lockArt(art);
    if (openAt !== undefined) tween(shackle, [{ translate: '0 0', rotate: '0deg' }, { translate: '0 -8px', rotate: '-24deg' }], openAt, 0.35, EASE.back);
    if (jiggleAt !== undefined) {
      tween(art, [{ rotate: '0deg' }, { rotate: '-9deg' }, { rotate: '7deg' }, { rotate: '-5deg' }, { rotate: '3deg' }, { rotate: '0deg' }], jiggleAt, 0.7, EASE.inOut);
    }
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
    // The open lid, standing up behind the contents once it has tipped back
    // on its hinge along the back of the chest's top: its dark inside shows.
    const open = svg('g', { class: 'wk-box-lid-open' }, art);
    svg('path', { class: 'wk-box-inside', d: 'M16 62 V34 Q16 10 42 10 H158 Q184 10 184 34 V62 Z' }, open);
    svg('path', { class: 'wk-box-inside-rim', d: 'M25 62 V36 Q25 19 45 19 H155 Q175 19 175 36 V62' }, open);
    svg('path', { class: 'wk-box-band', d: 'M54 13 V62 M146 13 V62' }, open);
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
    // The chest, drawn like the porch: planks, a shade at the bottom, iron
    // bands with rivets, brass corners, and its lock.
    svg('rect', { class: 'wk-box-body', x: 14, y: 62, width: 172, height: 82, rx: 6 }, art);
    svg('path', { class: 'wk-box-grain', d: 'M16 74 H184 M16 104 H184 M16 114 H184 M16 136 H184' }, art);
    svg('path', { class: 'wk-box-shade', d: 'M15 122 H185 V138 Q185 143 180 143 H20 Q15 143 15 138 Z' }, art);
    svg('path', { class: 'wk-box-band', d: 'M14 84 H186 M14 124 H186 M54 62 V144 M146 62 V144' }, art);
    for (const [cx, cy] of [[54, 84], [146, 84], [54, 124], [146, 124]]) svg('circle', { class: 'wk-box-rivet', cx, cy, r: 2.3 }, art);
    svg('path', { class: 'wk-box-corner', d: 'M15 76 V68 Q15 63 20 63 H30 M185 76 V68 Q185 63 180 63 H170 M15 130 V138 Q15 143 20 143 H30 M185 130 V138 Q185 143 180 143 H170' }, art);
    svg('rect', { class: 'wk-box-lock', x: 88, y: 76, width: 24, height: 26, rx: 4 }, art);
    svg('path', { class: 'wk-box-keyhole', d: 'M100 84 A3 3 0 1 1 99.9 84 Z M98.6 88 H101.4 L102 95 H98 Z' }, art);
    // The closed lid.
    const lid = svg('g', { class: 'wk-box-lid' }, art);
    svg('path', { class: 'wk-box-body', d: 'M14 62 V40 Q14 20 40 20 H160 Q186 20 186 40 V62 Z' }, lid);
    svg('path', { class: 'wk-box-grain', d: 'M17 33 H183 M15 48 H185' }, lid);
    svg('path', { class: 'wk-box-band', d: 'M54 21 V62 M146 21 V62 M14 59 H186' }, lid);
    if (openAt !== undefined) {
      // The lid tips back on its hinge: seen from the front it folds down
      // to the hinge line, and its inside rises up behind the contents.
      tween(lid, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], openAt, 0.22, EASE.inOut);
      tween(open, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], openAt + 0.18, 0.32, EASE.out);
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

  // The porch in its own 240×230 frame, the street along its bottom edge:
  // where a hand takes the pot's rim, the corner the pot tips on (by TIP
  // degrees), the key and the honeypot under the pot, the door's knob, and
  // the middle of the doorway on the boardwalk.
  const PORCH = { rim: [140, 110], pivot: [179, 150], key: [165, 147], jar: [163, 134], knob: [82, 140], lock: [63, 124], doorway: [63, 204] };
  const PORCH_TIP = 32;
  const turnAbout = ([x, y], [cx, cy], degrees) => {
    const a = degrees * Math.PI / 180, dx = x - cx, dy = y - cy;
    return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
  };

  /**
   * The porch of the lecture's story (slide 19), drawn as a frontier house
   * front: a shingled porch roof on two posts, clapboard walls lit from the
   * upper left, a panelled door in its frame (an optional `sign` over it),
   * a lantern, a window, and the boardwalk on the street; a flowerpot stands
   * on a barrel by the door with a key under it, or (`honey`) a honeypot,
   * or both: once the key has flown (`keyFly`), the honeypot waits in its
   * place. `w` wide, its bottom on the street at stage y `ground`.
   *
   * Motion: the pot tips up on its corner at `tipAt` and back at `untipAt`
   * (a hand at its rim does it, see point('rim') and point('rimTipped'));
   * the key is taken at `takeAt`, or slides out and flies to stage point
   * `keyFly.to` at `keyFly.at`; a honeypot shows once the pot tips and is
   * taken at `honeyTakeAt`; the door swings open at `openAt`. Returns
   * { node, point(name) } with the porch's points (PORCH, plus rimTipped)
   * in stage coordinates.
   */
  function porch(parent, { x, ground, w = 260, at, until, sign, honey = false, tipAt, untipAt, takeAt, keyFly, honeyTakeAt, openAt }) {
    const k = w / 240;
    const y = ground - 230 * k;
    const node = box(parent, 'wk-porch', { x, y, w });
    const art = svg('svg', { viewBox: '0 0 240 230', width: w, height: 230 * k, 'aria-hidden': 'true' }, node);
    const defs = svg('defs', {}, art);
    const id = `wk-porch-${++porchCount}`;
    const wallGrad = svg('linearGradient', { id: `${id}-wall`, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    svg('stop', { offset: 0, class: 'wk-pr-wall-0' }, wallGrad);
    svg('stop', { offset: 1, class: 'wk-pr-wall-1' }, wallGrad);
    svg('ellipse', { class: 'wk-pr-ground-shadow', cx: 120, cy: 228, rx: 128, ry: 5 }, art);
    // The wall: clapboards in the shade of the porch roof.
    svg('rect', { class: 'wk-pr-wall', x: 14, y: 28, width: 212, height: 178, fill: `url(#${id}-wall)` }, art);
    for (let by = 43; by < 204; by += 15) {
      svg('path', { class: 'wk-pr-board-shadow', d: `M14 ${by} H226` }, art);
      svg('path', { class: 'wk-pr-board-light', d: `M14 ${by + 1.6} H226` }, art);
    }
    svg('rect', { class: 'wk-pr-shade', x: 14, y: 28, width: 212, height: 18 }, art);
    // The window, lit from inside, with its sill.
    svg('rect', { class: 'wk-pr-window-frame', x: 128, y: 52, width: 72, height: 50, rx: 2 }, art);
    svg('rect', { class: 'wk-pr-glass', x: 133, y: 57, width: 62, height: 40 }, art);
    svg('path', { class: 'wk-pr-mullion', d: 'M164 57 V97 M133 77 H195' }, art);
    svg('rect', { class: 'wk-pr-sill', x: 124, y: 101, width: 80, height: 5, rx: 1 }, art);
    // The door in its frame; it swings open on its left hinges.
    svg('rect', { class: 'wk-pr-frame', x: 27, y: 55, width: 72, height: 151 }, art);
    svg('rect', { class: 'wk-pr-dark', x: 34, y: 62, width: 58, height: 144 }, art);
    const door = svg('g', { class: 'wk-pr-swing' }, art);
    svg('rect', { class: 'wk-pr-door', x: 34, y: 62, width: 58, height: 144 }, door);
    for (const [px, py, ph] of [[40, 70, 56], [66, 70, 56], [40, 134, 62], [66, 134, 62]]) {
      svg('rect', { class: 'wk-pr-panel', x: px, y: py, width: 20, height: ph, rx: 1.5 }, door);
      svg('path', { class: 'wk-pr-panel-light', d: `M${px + 20} ${py + 2} V${py + ph} H${px + 2}` }, door);
    }
    svg('rect', { class: 'wk-pr-plate', x: 79, y: 134, width: 6, height: 13, rx: 1.6 }, door);
    svg('circle', { class: 'wk-pr-knob', cx: PORCH.knob[0], cy: PORCH.knob[1], r: 3.4 }, door);
    svg('circle', { class: 'wk-pr-knob-shine', cx: PORCH.knob[0] - 1, cy: PORCH.knob[1] - 1, r: 1 }, door);
    if (openAt !== undefined) tween(door, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0.2)' }], openAt, 0.5, EASE.inOut);
    if (sign) {
      svg('rect', { class: 'wk-pr-sign', x: 22, y: 33, width: 82, height: 19, rx: 2 }, art);
      const t = svg('text', { class: 'wk-pr-sign-text', x: 63, y: 47, 'text-anchor': 'middle' }, art);
      t.textContent = sign;
    }
    // The lantern by the door.
    svg('path', { class: 'wk-pr-chain', d: 'M112 28 V38' }, art);
    svg('path', { class: 'wk-pr-lantern', d: 'M106 40 H118 L117 44 V56 L119 58 H105 L107 56 V44 Z' }, art);
    svg('rect', { class: 'wk-pr-lantern-glass', x: 108.5, y: 44, width: 7, height: 11, rx: 1 }, art);
    // The posts, their brackets, and the porch roof.
    for (const px of [2, 226]) {
      svg('rect', { class: 'wk-pr-post', x: px, y: 26, width: 12, height: 180 }, art);
      svg('path', { class: 'wk-pr-post-light', d: `M${px + 2.5} 30 V202` }, art);
    }
    svg('path', { class: 'wk-pr-post', d: 'M14 30 H28 L14 44 Z M226 30 H212 L226 44 Z' }, art);
    svg('path', { class: 'wk-pr-roof', d: 'M-12 21 L-4 0 H244 L252 21 Z' }, art);
    svg('path', { class: 'wk-pr-shingle', d: 'M-8 7 H248 M-10 14 H250 ' + Array.from({ length: 22 }, (_, i) => `M${-2 + i * 12} 0 V7 M${4 + i * 12} 7 V14 M${-2 + i * 12} 14 V21`).join(' ') }, art);
    svg('rect', { class: 'wk-pr-beam', x: -12, y: 20, width: 264, height: 9 }, art);
    // The barrel by the door, the pot on it, and what the pot hides.
    svg('path', { class: 'wk-pr-barrel', d: 'M138 152 C133.5 170 133.5 186 138 204 H188 C192.5 186 192.5 170 188 152 Z' }, art);
    svg('path', { class: 'wk-pr-stave', d: 'M150 152 C148 170 148 186 150 204 M163 152 V204 M176 152 C178 170 178 186 176 204' }, art);
    svg('path', { class: 'wk-pr-hoop', d: 'M135.6 162 H190.4 M135.6 194 H190.4' }, art);
    svg('ellipse', { class: 'wk-pr-barrel-top', cx: 163, cy: 152, rx: 25, ry: 3 }, art);
    const jar = honey ? svg('g', { class: 'wk-honeypot' }, art) : null;
    if (jar) {
      // The glass jar of honey that ends up on the outlaw's hand (outlaw.js
      // PROPS.honeyJar), labelled HONEY POT.
      svg('path', { class: 'wk-honey-glass', d: 'M147 111 C140 115 139 142 143 148 C148 152.4 178 152.4 183 148 C187 142 186 115 179 111 Z' }, jar);
      svg('path', { class: 'wk-honey', d: 'M142.4 120 C141.4 133 141.8 143 145 147 C150 150.4 176 150.4 181 147 C184.2 143 184.6 133 183.6 120 Z' }, jar);
      svg('rect', { class: 'wk-honey-rim', x: 145, y: 105.6, width: 36, height: 6, rx: 2 }, jar);
      svg('path', { class: 'wk-honey-drip', d: 'M149 111.6 C148.6 116 148.8 119 149.6 121 A1.6 1.6 0 1 0 151.8 120.2 C151.2 118 151.3 115 152 111.6 Z M174 111.6 C173.6 117 173.9 121 174.8 123.4 A1.7 1.7 0 1 0 177 122.4 C176.4 119 176.4 115 177 111.6 Z' }, jar);
      svg('rect', { class: 'wk-honey-label', x: 144, y: 121.4, width: 38, height: 24.4, rx: 2 }, jar);
      [['HONEY', 132.4], ['POT', 142.8]].forEach(([word, ty]) => {
        svg('text', { class: 'wk-honey-text', x: 163, y: ty, 'text-anchor': 'middle' }, jar).textContent = word;
      });
      svg('path', { class: 'wk-honey-shine', d: 'M143.6 118 C142.6 128 143 138 145.2 144' }, jar);
    }
    const key = !honey || keyFly ? svg('g', { class: 'wk-porch-key' }, art) : null;
    if (key) {
      svg('circle', { class: 'wk-pr-key', cx: 154, cy: 147, r: 3.6 }, key);
      svg('circle', { class: 'wk-pr-key-hole', cx: 154, cy: 147, r: 1.2 }, key);
      svg('path', { class: 'wk-pr-key', d: 'M157.4 145.8 H176 V148.2 H174 V150.4 H171.6 V148.2 H169.6 V150 H167.4 V148.2 H157.4 Z' }, key);
    }
    const pot = svg('g', { class: 'wk-pot' }, art);
    pot.style.transformBox = 'view-box';
    pot.style.transformOrigin = `${PORCH.pivot[0]}px ${PORCH.pivot[1]}px`;
    svg('path', { class: 'wk-pot-leaf', d: 'M163 110 C150 96 145 84 147 70 C158 78 164 92 163 110 Z M163 110 C172 92 184 84 196 84 C192 98 178 106 163 110 Z M163 110 C160 90 164 72 172 60 C178 76 172 96 163 110 Z M163 110 C154 102 140 100 132 102 C140 110 152 112 163 110 Z' }, pot);
    svg('path', { class: 'wk-pot-vein', d: 'M163 108 C156 96 151 86 149 74 M164 108 C172 96 182 90 192 87 M163 106 C164 90 167 76 171 64 M162 109 C154 106 145 104 136 103' }, pot);
    svg('path', { class: 'wk-pot-clay', d: 'M141 116 H185 L179 150 H147 Z' }, pot);
    svg('path', { class: 'wk-pot-shine', d: 'M146 120 L150 146' }, pot);
    svg('rect', { class: 'wk-pot-rim', x: 138, y: 108, width: 50, height: 9, rx: 2.5 }, pot);
    svg('path', { class: 'wk-pot-soil', d: 'M141 109.6 H185' }, pot);
    if (tipAt !== undefined) tween(pot, [{ transform: 'rotate(0deg)' }, { transform: `rotate(${PORCH_TIP}deg)` }], tipAt, 0.35, EASE.inOut);
    if (untipAt !== undefined) tween(pot, [{ transform: `rotate(${PORCH_TIP}deg)` }, { transform: 'rotate(0deg)' }], untipAt, 0.35, EASE.inOut);
    // The boardwalk on the street.
    svg('rect', { class: 'wk-pr-deck', x: -8, y: 204, width: 256, height: 9 }, art);
    svg('path', { class: 'wk-pr-seam', d: Array.from({ length: 14 }, (_, i) => `M${4 + i * 18} 204 V213`).join(' ') }, art);
    svg('rect', { class: 'wk-pr-fascia', x: -8, y: 213, width: 256, height: 15 }, art);
    const stage = ([px, py]) => [x + px * k, y + py * k];
    const points = { ...PORCH, rimTipped: turnAbout(PORCH.rim, PORCH.pivot, PORCH_TIP) };
    if (key && takeAt !== undefined) tween(key, [{ opacity: 1 }, { opacity: 0 }], takeAt, 0.12, EASE.inOut);
    if (key && keyFly) {
      // The key slides out from under the pot and flies to keyFly.to.
      const [kx, ky] = stage(PORCH.key);
      const dx = (keyFly.to[0] - kx) / k, dy = (keyFly.to[1] - ky) / k;
      key.style.transformBox = 'view-box';
      key.style.transformOrigin = `${PORCH.key[0]}px ${PORCH.key[1]}px`;
      tween(key, [{ transform: 'translate(0px, 0px)' }, { transform: 'translate(18px, 0px)', offset: 0.3 }, { transform: `translate(${dx}px, ${dy}px) scale(0.6)` }], keyFly.at, 0.9, EASE.inOut);
      tween(key, [{ opacity: 1 }, { opacity: 0 }], keyFly.at + 0.88, 0.1, EASE.inOut);
    }
    // A honeypot shows once the pot has tipped off it.
    if (jar && tipAt !== undefined) tween(jar, [{ opacity: 0 }, { opacity: 1 }], tipAt + 0.08, 0.15, EASE.inOut);
    if (jar && honeyTakeAt !== undefined) tween(jar, [{ opacity: 1 }, { opacity: 0 }], honeyTakeAt, 0.12, EASE.inOut);
    show(node, at, until, 'rise');
    return { node, point: (name) => stage(points[name]) };
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
    // Drawn like the porch (porch() and its .wk-pr-* styles): clapboards lit
    // from the upper left, dark outlines, a shingled roof on posts.
    const id = `wk-porch-${++porchCount}`;
    const grad = svg('linearGradient', { id: `${id}-wall`, x1: 0, y1: 0, x2: 1, y2: 1 }, svg('defs', {}, art));
    svg('stop', { offset: 0, class: 'wk-pr-wall-0' }, grad);
    svg('stop', { offset: 1, class: 'wk-pr-wall-1' }, grad);
    svg('ellipse', { class: 'wk-pr-ground-shadow', cx: 280, cy: 276, rx: 278, ry: 5 }, art);
    svg('path', { class: 'wk-pr-wall', fill: `url(#${id}-wall)`, d: 'M40 82 H520 V272 H40 Z' }, art);
    for (let by = 98; by < 270; by += 16) {
      svg('path', { class: 'wk-pr-board-shadow', d: `M40 ${by} H520` }, art);
      svg('path', { class: 'wk-pr-board-light', d: `M40 ${by + 1.6} H520` }, art);
    }
    // The false front, its cornice, and the app's address on its sign.
    svg('path', { class: 'wk-af-front', d: 'M20 82 V18 C120 6 440 6 540 18 V82 Z' }, art);
    svg('path', { class: 'wk-pr-board-shadow', d: 'M21 46 H539 M21 66 H539' }, art);
    svg('path', { class: 'wk-af-cornice', d: 'M12 22 C120 6 440 6 548 22 V14 C440 -2 120 -2 12 14 Z' }, art);
    svg('rect', { class: 'wk-af-sign', x: 146, y: 24, width: 268, height: 42, rx: 4 }, art);
    const sign = svg('text', { class: 'wk-af-sign-text', x: 280, y: 52, 'text-anchor': 'middle' }, art);
    sign.textContent = url;
    // The porch roof on four posts, its shade on the wall.
    svg('rect', { class: 'wk-pr-shade', x: 40, y: 134, width: 480, height: 14 }, art);
    svg('path', { class: 'wk-pr-roof', d: 'M22 118 H538 L530 136 H30 Z' }, art);
    svg('path', { class: 'wk-pr-shingle', d: 'M26 127 H534 ' + Array.from({ length: 43 }, (_, i) => `M${30 + i * 12} 118 V127 M${36 + i * 12} 127 V136`).join(' ') }, art);
    for (const px of [44, 216, 344, 516]) {
      svg('rect', { class: 'wk-pr-post', x: px - 4.5, y: 136, width: 9, height: 136 }, art);
      svg('path', { class: 'wk-pr-post-light', d: `M${px - 2} 140 V268` }, art);
    }
    // The swinging doors in their frame, a login card nailed to them.
    svg('rect', { class: 'wk-pr-frame', x: 90, y: 154, width: 80, height: 118 }, art);
    svg('rect', { class: 'wk-pr-dark', x: 96, y: 160, width: 68, height: 112 }, art);
    svg('path', { class: 'wk-pr-door', d: 'M98 176 H129 V246 H98 Z M131 176 H162 V246 H131 Z' }, art);
    svg('path', { class: 'wk-pr-panel-light', d: 'M127 179 V243 H101 M160 179 V243 H134' }, art);
    svg('rect', { class: 'wk-af-card', x: 106, y: 186, width: 48, height: 34, rx: 3 }, art);
    svg('path', { class: 'wk-af-card-line', d: 'M112 196 H148 M112 204 H148 M118 212 H142' }, art);
    // The window, lit, with a speech-bubble sign hanging inside.
    svg('rect', { class: 'wk-pr-window-frame', x: 228, y: 146, width: 108, height: 84, rx: 2 }, art);
    svg('rect', { class: 'wk-pr-glass', x: 234, y: 152, width: 96, height: 72 }, art);
    svg('path', { class: 'wk-pr-mullion', d: 'M282 152 V224 M234 188 H330' }, art);
    svg('rect', { class: 'wk-pr-sill', x: 222, y: 229, width: 120, height: 7, rx: 1.5 }, art);
    svg('path', { class: 'wk-af-bubble', d: 'M260 166 H304 C308 166 310 168 310 172 V184 C310 188 308 190 304 190 H276 L268 197 V190 H260 C256 190 254 188 254 184 V172 C254 168 256 166 260 166 Z' }, art);
    // The loading hatch in its frame, a framed picture going in.
    svg('rect', { class: 'wk-pr-frame', x: 386, y: 160, width: 108, height: 94, rx: 3 }, art);
    svg('rect', { class: 'wk-af-hatch', x: 392, y: 166, width: 96, height: 82, rx: 2 }, art);
    svg('path', { class: 'wk-af-hatch-boards', d: 'M392 186 H488 M392 206 H488 M392 226 H488' }, art);
    svg('rect', { class: 'wk-af-picture', x: 414, y: 180, width: 52, height: 40, rx: 2 }, art);
    svg('path', { class: 'wk-af-picture-art', d: 'M418 214 L432 198 L444 210 L452 202 L462 214 Z' }, art);
    svg('circle', { class: 'wk-af-sun', cx: 454, cy: 190, r: 4 }, art);
    // The boardwalk.
    svg('rect', { class: 'wk-pr-deck', x: 8, y: 266, width: 544, height: 9 }, art);
    svg('path', { class: 'wk-pr-seam', d: Array.from({ length: 30 }, (_, i) => `M${20 + i * 18} 266 V275`).join(' ') }, art);
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
  function planBoard(parent, { x = 20, y = 54, w = 760, at, until, title = 'Design Security in before they break in', blank = false, lights = [], pins = {}, ruleLights = [], glowAt, how = 'rise', small = false, heading }) {
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
      // Where a principle will be pinned: a dashed outline, gone once it is.
      if (!small) {
        const spot = el('div', 'wk-board-spot', slot, '?');
        if (pins[i] !== undefined) tween(spot, [{ opacity: 1 }, { opacity: 0 }], pins[i], 0.2, EASE.inOut);
      }
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
  /**
   * The lecture's network map. `boundary` 'server' draws the trust boundary
   * around the server alone, where Zero Trust puts it; 'company' draws it
   * around the company network, which `shrinkAt` can shrink to the server.
   */
  function network(parent, { x, y, at, until, shrinkAt, checkAt, boundary = 'company' }) {
    const node = box(parent, 'wk-network', { x, y, w: 600, h: 300 });
    const art = svg('svg', { viewBox: '0 0 600 300', width: 600, height: 300, 'aria-hidden': 'true' }, node);
    const links = 'M110 150 H250 M330 90 L410 140 M330 210 L410 160 M110 150 L60 80 M470 150 H530';
    svg('path', { class: 'wk-net-link', d: links }, art);
    const SERVER_FENCE = { x: 384, y: 104, width: 112, height: 92 };
    const fence = svg('rect', { class: 'wk-fence', ...(boundary === 'server' ? SERVER_FENCE : { x: 220, y: 30, width: 280, height: 240 }), rx: 18 }, art);
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
    if (boundary === 'company') {
      const companyLabel = el('div', 'wk-fence-label', node, 'Company network');
      companyLabel.style.left = '236px';
      companyLabel.style.top = '34px';
      if (shrinkAt !== undefined) fx.fadeOut(companyLabel, shrinkAt, 0.3);
    }
    if (checkAt !== undefined) {
      const check = el('div', 'wk-checkpoint is-staged', node, 'Not trusted by default');
      check.style.left = '348px';
      check.style.top = '40px';
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

  // The parts of a service building, in its own 120×90 frame (the street
  // at y 88), drawn like the porch: dark outlines, light from the upper
  // left, clapboards, and lit windows.
  const bldPart = {
    boards(g, x0, x1, y0, y1, step = 7) {
      for (let by = y0; by < y1; by += step) {
        svg('path', { class: 'wk-bld-board', d: `M${x0} ${by} H${x1}` }, g);
        svg('path', { class: 'wk-bld-board-light', d: `M${x0} ${by + 1.2} H${x1}` }, g);
      }
    },
    window(g, x, y, w, h, { cross = true } = {}) {
      svg('rect', { class: 'wk-bld-frame', x: x - 2, y: y - 2, width: w + 4, height: h + 4, rx: 1 }, g);
      svg('rect', { class: 'wk-bld-glass', x, y, width: w, height: h }, g);
      if (cross) svg('path', { class: 'wk-bld-mullion', d: `M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}` }, g);
      svg('rect', { class: 'wk-bld-sill', x: x - 3, y: y + h + 1.5, width: w + 6, height: 2.6, rx: 0.6 }, g);
    },
    door(g, x, y, w, h) {
      svg('rect', { class: 'wk-bld-frame', x: x - 2, y: y - 2, width: w + 4, height: h + 2 }, g);
      svg('rect', { class: 'wk-bld-door', x, y, width: w, height: h }, g);
      svg('path', { class: 'wk-bld-panel', d: `M${x + 3} ${y + 3} h${w - 6} v${h * 0.36} h${-(w - 6)} Z M${x + 3} ${y + h * 0.5} h${w - 6} v${h * 0.42} h${-(w - 6)} Z` }, g);
      svg('circle', { class: 'wk-bld-knob', cx: x + w - 3.4, cy: y + h * 0.48, r: 1.3 }, g);
    },
    boardwalk(g) {
      svg('rect', { class: 'wk-bld-deck', x: 3, y: 84, width: 114, height: 4.4, rx: 0.6 }, g);
      svg('path', { class: 'wk-bld-seam', d: Array.from({ length: 9 }, (_, i) => `M${12 + i * 12} 84 V88.4`).join(' ') }, g);
    },
  };

  /**
   * The service's emblem, the main part of its facade: a dark board with a
   * brass rim and the service's icon from the kit's icon set (kit.js), as
   * large as the board allows.
   */
  function emblem(g, name, { x, y, w, h }) {
    svg('rect', { class: 'wk-bld-emblem', x, y, width: w, height: h, rx: 3 }, g);
    svg('rect', { class: 'wk-bld-emblem-shine', x: x + 2, y: y + 2, width: w - 4, height: h - 4, rx: 2 }, g);
    const size = Math.min(w, h) - 4;
    const art = icon(name, 'wk-bld-emblem-icon');
    for (const [k, v] of Object.entries({ x: x + (w - size) / 2, y: y + (h - size) / 2, width: size, height: size })) art.setAttribute(k, v);
    g.append(art);
  }

  // Each service's building, its emblem the largest thing on its facade:
  // a cart for Product Display, an envelope for Email Notification, a
  // database for System Backup, and a picture for Image Upload. The door,
  // windows, and props below say what kind of building it is.
  const BUILDINGS = {
    /** Product Display: a general store, its goods behind an awning. */
    store(g, wall) {
      svg('path', { class: 'wk-bld-wall', fill: wall, d: 'M10 86 V12 H15 V6 H105 V12 H110 V86 Z' }, g);
      bldPart.boards(g, 10, 110, 50, 84);
      svg('path', { class: 'wk-bld-cap', d: 'M12 6 H108 V2.6 H12 Z' }, g);
      emblem(g, 'cart', { x: 32, y: 10, w: 56, h: 36 });
      svg('path', { class: 'wk-bld-awning', d: 'M12 49 H108 L104 56 H16 Z' }, g);
      svg('path', { class: 'wk-bld-stripe', d: Array.from({ length: 8 }, (_, i) => `M${18 + i * 12} 49 h6 l-0.6 7 h-6 Z`).join(' ') }, g);
      svg('path', { class: 'wk-bld-scallop', d: 'M16 56 ' + Array.from({ length: 11 }, () => 'a4 2.6 0 0 0 8 0').join(' ') }, g);
      bldPart.window(g, 17, 62, 24, 14, { cross: false });
      bldPart.window(g, 79, 62, 24, 14, { cross: false });
      svg('path', { class: 'wk-bld-goods', d: 'M20 76 V70 H25 V76 Z M27 76 V67 C27 65.8 32 65.8 32 67 V76 Z M34 76 V71 H38 V76 Z M82 76 V68 H88 V76 Z M90 76 V70 C90 68.8 94 68.8 94 70 V76 Z M96 76 V67 H100 V76 Z' }, g);
      bldPart.door(g, 51, 61, 18, 25);
      bldPart.boardwalk(g);
    },
    /** Email Notification: the post office, a mailbox by its door. */
    post(g, wall) {
      svg('path', { class: 'wk-bld-wall', fill: wall, d: 'M10 86 V16 H13 C26 2 94 2 107 16 H110 V86 Z' }, g);
      bldPart.boards(g, 10, 110, 50, 84);
      svg('path', { class: 'wk-bld-cap', d: 'M8 16 H112 V13.4 C96 -2 24 -2 8 13.4 Z' }, g);
      emblem(g, 'envelope', { x: 33, y: 12, w: 54, h: 36 });
      bldPart.window(g, 17, 56, 16, 14);
      bldPart.window(g, 87, 56, 16, 14);
      bldPart.door(g, 51, 57, 18, 29);
      // The mailbox on its post.
      svg('rect', { class: 'wk-bld-post', x: 93.6, y: 79, width: 2.8, height: 6 }, g);
      svg('path', { class: 'wk-bld-mailbox', d: 'M88 79 V75 C88 72 102 72 102 75 V79 Z' }, g);
      svg('path', { class: 'wk-bld-slot', d: 'M91.6 75.6 H98.4' }, g);
      bldPart.boardwalk(g);
    },
    /** System Backup: a storehouse, its stored drums and crates outside. */
    warehouse(g, wall) {
      svg('path', { class: 'wk-bld-wall', fill: wall, d: 'M10 86 V30 L60 6 L110 30 V86 Z' }, g);
      bldPart.boards(g, 10, 110, 36, 84);
      svg('path', { class: 'wk-bld-roof-edge', d: 'M6 32 L60 4 L114 32' }, g);
      emblem(g, 'database', { x: 38, y: 17, w: 44, h: 36 });
      // The sliding doors, braced.
      svg('rect', { class: 'wk-bld-rail', x: 32, y: 56, width: 56, height: 2.6 }, g);
      svg('rect', { class: 'wk-bld-frame', x: 34, y: 58.6, width: 52, height: 27.4 }, g);
      svg('path', { class: 'wk-bld-slider', d: 'M37 61 H59 V86 H37 Z M61 61 H83 V86 H61 Z' }, g);
      svg('path', { class: 'wk-bld-brace', d: 'M37 61 L59 86 M83 61 L61 86' }, g);
      // Backups stacked outside: a drum and two crates.
      svg('path', { class: 'wk-bld-drum', d: 'M14 86 V72 C14 70 26 70 26 72 V86 Z' }, g);
      svg('path', { class: 'wk-bld-hoop', d: 'M14 76 C14 77.6 26 77.6 26 76 M14 81.4 C14 83 26 83 26 81.4' }, g);
      svg('path', { class: 'wk-bld-crate', d: 'M90 86 V74 H106 V86 Z M93 74 V64 H104 V74 Z' }, g);
      svg('path', { class: 'wk-bld-crate-line', d: 'M90 74 L106 86 M106 74 L90 86 M93 64 L104 74 M104 64 L93 74' }, g);
      bldPart.boardwalk(g);
    },
    /** Image Upload: a barn, a picture on its loft. */
    barn(g, wall) {
      svg('path', { class: 'wk-bld-wall', fill: wall, d: 'M10 86 V46 L20 28 L60 13 L100 28 L110 46 V86 Z' }, g);
      svg('path', { class: 'wk-bld-board', d: Array.from({ length: 12 }, (_, i) => `M${15 + i * 8} 48 V84`).join(' ') }, g);
      svg('path', { class: 'wk-bld-roof', d: 'M5 47 L17 26 L60 9 L103 26 L115 47 L111 47 L100 30 L60 14.6 L20 30 L9 47 Z' }, g);
      svg('path', { class: 'wk-bld-trim', d: 'M10.5 47 V86 M109.5 47 V86' }, g);
      emblem(g, 'image', { x: 37, y: 22, w: 46, h: 34 });
      // The big doors with their white X.
      svg('rect', { class: 'wk-bld-barn-door', x: 40, y: 60, width: 40, height: 26 }, g);
      svg('path', { class: 'wk-bld-trim', d: 'M40 60 H80 V86 H40 Z M60 60 V86 M40 60 L60 86 M60 60 L40 86 M80 60 L60 86 M60 60 L80 86' }, g);
      bldPart.boardwalk(g);
    },
  };

  /**
   * A short picket fence centred on x, standing on y: two posts, three
   * pointed pickets, and two rails. It grows up out of the ground at `at`.
   */
  function fence(parent, x, y, at) {
    const g = svg('g', { class: 'wk-lot-fence' }, parent);
    svg('ellipse', { class: 'wk-bld-shadow', cx: x, cy: y, rx: 22, ry: 2 }, g);
    const rails = `M${x - 19} ${y - 26} H${x + 19} M${x - 19} ${y - 10} H${x + 19}`;
    svg('path', { class: 'wk-lot-fence-rail', d: rails }, g);
    svg('path', { class: 'wk-lot-fence-rail-wood', d: rails }, g);
    for (const px of [x - 9, x, x + 9]) {
      svg('path', { class: 'wk-lot-fence-picket', d: `M${px - 3} ${y} V${y - 30} L${px} ${y - 35} L${px + 3} ${y - 30} V${y} Z` }, g);
    }
    for (const px of [x - 19, x + 19]) {
      svg('rect', { class: 'wk-lot-fence-post', x: px - 2.6, y: y - 38, width: 5.2, height: 38, rx: 1 }, g);
    }
    tween(g, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1.08)', offset: 0.7 }, { transform: 'scaleY(1)' }], at, 0.45, EASE.out);
    return g;
  }

  let buildingCount = 0;

  /** A service's building (`kind`, one of BUILDINGS), 120×90. */
  function buildingArt(parent, kind) {
    const art = svg('svg', { class: `wk-bld wk-bld--${kind}`, viewBox: '0 0 120 90', width: 120, height: 90, 'aria-hidden': 'true' }, parent);
    const id = `wk-bld-${++buildingCount}`;
    const grad = svg('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 1 }, svg('defs', {}, art));
    svg('stop', { offset: 0, class: 'wk-bld-lit' }, grad);
    svg('stop', { offset: 1, class: 'wk-bld-shaded' }, grad);
    svg('ellipse', { class: 'wk-bld-shadow', cx: 60, cy: 88, rx: 58, ry: 2.4 }, art);
    BUILDINGS[kind](art, `url(#${id})`);
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
    // The cables joining neighbouring buildings, behind them: thick and
    // bold while one key opens everything, thin once each part has its own
    // key with just the rights it needs.
    const links = svg('svg', { class: 'wk-service-links', viewBox: '0 0 600 210', width: 600, height: 210, 'aria-hidden': 'true' }, node);
    for (let i = 0; i < SERVICES.length - 1; i += 1) {
      const x0 = i * 150 + 112, x1 = (i + 1) * 150 + 28, cy = 62;
      const d = `M${x0} ${cy} C${x0 + 24} ${cy + 15} ${x1 - 24} ${cy + 15} ${x1} ${cy}`;
      // Thick in the CSS; each layer thins from there to its width here.
      for (const [cls, thin] of [['wk-link-sheath', 4], ['wk-link-core', 1.8], ['wk-link-shine', 0.01]]) {
        const cable = svg('path', { class: cls, d }, links);
        if (splitAt !== undefined) tween(cable, [{ strokeWidth: `${thin}px` }], splitAt + 0.35, 0.7, EASE.inOut);
      }
      // With the split a picket fence rises in the gap, the thin wire
      // running through it: each part kept to its own lot.
      if (splitAt !== undefined) fence(links, i * 150 + 145, 88, splitAt + 0.45 + i * 0.12);
    }
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
    alertBox, avatar, padlock, lockBoard, key, strongbox, asset, ciaCard, porch, appFront, trail, vector, triangle, ring, tick, planBoard, wanted,
    network, services, bank, gazette, hop, notice, quiz, PLAN, PRINCIPLES,
  };
})();
