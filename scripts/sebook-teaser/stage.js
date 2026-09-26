/*
 * SE Book teaser — render stage runtime.
 *
 * Builds the teaser's scenes from the storyboard (_data/sebook_teaser.yml)
 * and exposes a deterministic clock for render.js:
 *
 *   window.teaser.ready    Promise that settles once fonts + scenes are built
 *   window.teaser.seek(t)  poses every element at time t (seconds)
 *   window.teaser.cues     [{ kind, at }] moments the soundtrack hits
 *                          (keystroke, submit, alert, collapse, underline,
 *                          cut, pass) — see audio/soundtrack.js
 *
 * All motion is Web Animations API tweens that are created paused and posed
 * by setting currentTime, plus a few per-frame updaters (typing, counters,
 * packets) that are pure functions of t. Any frame therefore renders the same
 * no matter the order frames are requested in — which is what lets render.js
 * screenshot frame-exact PNGs.
 *
 * Preview (serve the repo root, e.g. `python3 -m http.server`):
 *   stage.html?play&fit   real-time loop, scaled to the window
 *   stage.html?t=7.6&fit  a single still frame
 */
(function () {
  'use strict';

  const STORYBOARD_URL = '/_data/sebook_teaser.yml';
  const FONT_FACES = [
    '500 50px Inter', '600 50px Inter', '700 50px Inter', '800 50px Inter', '900 50px Inter',
    '500 30px "Fira Code"', '600 30px "Fira Code"',
  ];

  const EASE = {
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',      // expo-out: fast arrival, soft landing
    in: 'cubic-bezier(0.7, 0, 0.84, 0)',       // expo-in: quick, decisive exits
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    back: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // slight overshoot for "pop" arrivals
    linear: 'linear',
  };

  // ------------------------------------------------------------------
  // Timeline
  // ------------------------------------------------------------------

  const animations = [];
  const updaters = [];
  const cues = [];

  /** Marks a moment the soundtrack should hit (audio/soundtrack.js maps kinds to sounds). */
  function cue(kind, at) {
    cues.push({ kind, at: Number(at.toFixed(4)) });
  }

  /**
   * Schedules a paused Web Animation that runs from `at` for `duration`
   * seconds and then holds its end state. A single keyframe object animates
   * from whatever value lower-priority animations left behind, which is how
   * exits pick up exactly where entrances ended.
   */
  function tween(node, keyframes, at, duration, easing = EASE.out) {
    const animation = node.animate(keyframes, {
      delay: at * 1000,
      duration: duration * 1000,
      easing,
      fill: 'forwards',
    });
    animation.pause();
    animations.push(animation);
  }

  /** Registers a per-frame function of t for effects tweens can't express. */
  function onFrame(update) {
    updaters.push(update);
  }

  function seek(t) {
    for (const animation of animations) animation.currentTime = t * 1000;
    for (const update of updaters) update(t);
  }

  const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
  const progress = (t, at, duration) => clamp((t - at) / duration, 0, 1);
  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);

  const fx = {
    rise(node, at, { distance = 70, duration = 0.7 } = {}) {
      tween(node, [{ opacity: 0, translate: `0 ${distance}px` }, { opacity: 1, translate: '0 0' }], at, duration);
    },
    pop(node, at, { from = 0.4, duration = 0.5 } = {}) {
      tween(node, [{ opacity: 0, scale: from }, { opacity: 1, scale: 1 }], at, duration, EASE.back);
    },
    fadeIn(node, at, duration = 0.35) {
      tween(node, [{ opacity: 0 }, { opacity: 1 }], at, duration, EASE.inOut);
    },
    fadeOut(node, at, duration = 0.3) {
      tween(node, { opacity: 0 }, at, duration, EASE.in);
    },
    exitUp(node, at, { distance = 70, duration = 0.28 } = {}) {
      tween(node, { opacity: 0, translate: `0 -${distance}px` }, at, duration, EASE.in);
    },
    blurAway(node, at, { duration = 0.4, scale = 0.9 } = {}) {
      tween(node, { opacity: 0, scale, filter: 'blur(16px)' }, at, duration, EASE.in);
    },
    /** Strokes an SVG path on; the path needs the .is-drawn class. */
    draw(path, at, duration = 0.5, easing = EASE.inOut) {
      path.setAttribute('pathLength', '1');
      tween(path, [{ opacity: 1, strokeDashoffset: 1 }, { opacity: 1, strokeDashoffset: 0 }], at, duration, easing);
    },
  };

  // ------------------------------------------------------------------
  // DOM helpers
  // ------------------------------------------------------------------

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function svg(tag, attributes = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
    return node;
  }

  const ICON_PATHS = {
    spark: 'M12 1C12.6 7.4 16.6 11.4 23 12C16.6 12.6 12.6 16.6 12 23C11.4 16.6 7.4 12.6 1 12C7.4 11.4 11.4 7.4 12 1Z',
    send: 'M12 19V5M5.5 11.5L12 5l6.5 6.5',
    cross: 'M7 7l10 10M17 7L7 17',
    bang: 'M12 5v9M12 18.6v.1',
    down: 'M12 4v15M5.5 12.5L12 19l6.5-6.5',
    check: 'M5 12.5l4.6 4.6L19 7.5',
    lock: 'M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5M5 10.5h14V20H5z',
  };

  function icon(name, className) {
    const node = svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    if (className) node.setAttribute('class', className);
    node.append(svg('path', { d: ICON_PATHS[name] }));
    return node;
  }

  /** Box of `node` in stage pixels (the stage is unscaled while scenes build). */
  function stageRect(node, stage) {
    const box = node.getBoundingClientRect();
    const origin = stage.getBoundingClientRect();
    return { left: box.left - origin.left, top: box.top - origin.top, width: box.width, height: box.height };
  }

  // ------------------------------------------------------------------
  // Kinetic type
  // ------------------------------------------------------------------

  /** "From coder to *engineer*." → [{text:'From coder to ', accent:false}, …] */
  function accentSegments(text) {
    return String(text).split('*').map((part, index) => ({ text: part, accent: index % 2 === 1 }))
      .filter((segment) => segment.text !== '');
  }

  /**
   * Builds a line of text whose words (or characters) each sit in a clipping
   * mask so they can rise into view. Returns the line and its moving parts.
   */
  function kinetic(text, className, { split = 'words' } = {}) {
    const line = el('div', `kinetic ${className}`);
    const parts = [];
    for (const segment of accentSegments(text)) {
      const pieces = split === 'chars' ? Array.from(segment.text) : segment.text.split(/(\s+)/);
      for (const piece of pieces) {
        if (piece === '') continue;
        if (/^\s+$/.test(piece)) {
          line.append(document.createTextNode(piece));
          continue;
        }
        const mask = el('span', 'word-mask');
        const part = el('span', segment.accent ? 'word is-accent' : 'word', piece);
        mask.append(part);
        line.append(mask);
        parts.push(part);
      }
    }
    return { node: line, parts };
  }

  function revealParts(parts, at, stagger = 0.06, duration = 0.62) {
    parts.forEach((part, index) => {
      tween(part, [{ translate: '0 125%' }, { translate: '0 0' }], at + index * stagger, duration);
    });
  }

  /**
   * Shows `text` one character at a time and returns when typing finishes.
   * With `cueKind`, every character also becomes a sound cue.
   */
  function typewriter(node, text, at, charsPerSecond, cueKind = null) {
    onFrame((t) => {
      const count = clamp(Math.floor((t - at) * charsPerSecond), 0, text.length);
      node.textContent = text.slice(0, count);
    });
    if (cueKind) {
      for (let i = 1; i <= text.length; i++) cue(cueKind, at + i / charsPerSecond);
    }
    return at + text.length / charsPerSecond;
  }

  /** Text caret: solid while typing, then blinking once per second until `hideAt`. */
  function caretBlink(caret, typingEnd, hideAt = Infinity) {
    onFrame((t) => {
      const idle = t - typingEnd;
      const visible = t < hideAt && (idle < 0 || idle % 1 < 0.5);
      caret.style.opacity = visible ? '1' : '0';
    });
  }

  // ------------------------------------------------------------------
  // Shared pieces
  // ------------------------------------------------------------------

  /* The AI-generated app. Line 22 holds the TODO the tutorials scene greps for. */
  const GENERATED_CODE = [
    'from flask import Flask, request, jsonify',
    'from models import db, User, Order',
    '',
    'app = Flask(__name__)',
    '',
    '@app.route("/signup", methods=["POST"])',
    'def signup():',
    '    data = request.get_json()',
    '    user = User(email=data["email"])',
    '    db.session.add(user)',
    '    db.session.commit()',
    '    return jsonify(id=user.id), 201',
    '',
    '@app.route("/cart/<int:user_id>")',
    'def cart(user_id):',
    '    orders = Order.query.filter_by(user_id=user_id)',
    '    total = sum(o.price * o.qty for o in orders)',
    '    return jsonify(total=total)',
    '',
    '@app.route("/checkout", methods=["POST"])',
    'def checkout():',
    '    # TODO: payments??',
    '    charge(request.json["card"], total)',
    '    return "ok"',
  ];
  // The editor shows two 10-line views of the file: the head streams in, then
  // a crossfade jumps to the tail. Scrolling text instead would sweep glyph
  // stripes across the frame many times a second — the kind of fast
  // high-contrast pattern WCAG 2.3.1 flash testing flags.
  const CODE_HEAD = { from: 0, to: 10 };
  const CODE_TAIL = { from: 14, to: 24 };

  const PYTHON_TOKEN = /(?<com>#.*$)|(?<str>"[^"]*")|(?<dec>@[\w.]+)|(?<kw>\b(?:from|import|def|return|for|in)\b)|(?<num>\b\d+\b)|(?<fn>\b[A-Za-z_]\w*(?=\())/g;

  function highlightPython(source) {
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of source.matchAll(PYTHON_TOKEN)) {
      if (match.index > cursor) fragment.append(source.slice(cursor, match.index));
      const kind = Object.keys(match.groups).find((name) => match.groups[name] !== undefined);
      fragment.append(el('span', `tok-${kind}`, match[0]));
      cursor = match.index + match[0].length;
    }
    if (cursor < source.length) fragment.append(source.slice(cursor));
    return fragment;
  }

  function windowChrome(className, labelText) {
    const node = el('div', `window ${className}`);
    const bar = el('div', 'window-bar');
    for (let i = 0; i < 3; i++) bar.append(el('span', 'window-dot'));
    const body = el('div', 'window-body');
    node.append(bar, body);
    let label = null;
    if (labelText) {
      label = el('div', 'window-label', labelText);
      bar.append(label);
    }
    return { node, bar, body, label };
  }

  /** "+1,284 lines" → counts up to 1,284 between `at` and `at + duration`. */
  function countUp(node, text, at, duration) {
    const [, prefix, digits, suffix] = /^(\D*)([\d,]+)(.*)$/.exec(text);
    const target = Number(digits.replace(/,/g, ''));
    onFrame((t) => {
      const p = progress(t, at, duration);
      node.textContent = p >= 1 ? text : `${prefix}${Math.round(target * easeOutCubic(p)).toLocaleString('en-US')}${suffix}`;
    });
  }

  /** Positions a packet along a polyline at fraction p of its length. */
  function pointOnPolyline(points, p) {
    const lengths = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const length = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      lengths.push(length);
      total += length;
    }
    let remaining = clamp(p, 0, 1) * total;
    for (let i = 0; i < lengths.length; i++) {
      if (remaining <= lengths[i] || i === lengths.length - 1) {
        const f = lengths[i] === 0 ? 0 : remaining / lengths[i];
        return [
          points[i][0] + (points[i + 1][0] - points[i][0]) * f,
          points[i][1] + (points[i + 1][1] - points[i][1]) * f,
        ];
      }
      remaining -= lengths[i];
    }
    return points[points.length - 1];
  }

  // ------------------------------------------------------------------
  // Scene builders — one per storyboard scene id. Each receives its scene
  // (start/end/on_screen) and the shared context, and schedules its own
  // entrances and exits. Elements that carry across scenes (the editor, the
  // skill window) live on ctx and are handed over explicitly.
  // ------------------------------------------------------------------

  /** on_screen: [headline, typed prompt, line counter] */
  function buildPrompt(scene, ctx) {
    const [headlineText, promptText, counterText] = scene.on_screen;
    const t0 = scene.start;

    const headline = kinetic(headlineText, 'prompt-headline is-centered');
    ctx.layer.append(headline.node);
    revealParts(headline.parts, t0 + 0.02, 0.07);
    fx.exitUp(headline.node, scene.end - 0.1);

    const box = el('div', 'prompt-box is-staged');
    const typed = el('span', 'prompt-typed');
    const caret = el('span', 'prompt-caret');
    const text = el('div', 'prompt-text');
    text.append(typed, caret);
    const send = el('div', 'prompt-send');
    send.append(icon('send'));
    box.append(icon('spark', 'prompt-spark'), text, send);
    ctx.layer.append(box);
    fx.rise(box, t0 + 0.02, { distance: 40, duration: 0.5 });
    // 19 characters per second puts the send press on the second beat.
    const typingEnd = typewriter(typed, promptText, t0 + 0.2, 19, 'keystroke');
    caretBlink(caret, typingEnd, typingEnd + 0.2);
    tween(send, [{ scale: 1 }, { scale: 0.8 }, { scale: 1 }], typingEnd + 0.02, 0.3, EASE.inOut);
    cue('submit', typingEnd + 0.02);
    fx.exitUp(box, scene.end - 0.05);

    const editor = el('div', 'editor is-staged');
    const shake = el('div', 'editor-shake');
    const windowParts = windowChrome('editor-window', 'app.py');
    const codeView = ({ from, to }) => {
      const view = el('div', 'editor-view');
      const lines = GENERATED_CODE.slice(from, to).map((source, offset) => {
        const line = el('div', 'code-line');
        line.append(el('span', 'code-line-no', String(from + offset + 1)), highlightPython(source));
        view.append(line);
        return line;
      });
      windowParts.body.append(view);
      return { view, lines };
    };
    const head = codeView(CODE_HEAD);
    const tail = codeView(CODE_TAIL);
    tail.view.classList.add('is-staged');
    const alarm = el('div', 'editor-alarm layer is-staged');
    const counter = el('div', 'line-counter is-staged');
    shake.append(windowParts.node, alarm, counter);
    editor.append(shake);
    ctx.layer.append(editor);

    const streamStart = typingEnd + 0.3;
    fx.rise(editor, streamStart - 0.1, { distance: 90, duration: 0.6 });
    head.lines.forEach((line, index) => {
      line.classList.add('is-staged');
      fx.fadeIn(line, streamStart + index * 0.08, 0.12);
    });
    fx.pop(counter, streamStart + 0.1, { from: 0.6 });
    countUp(counter, counterText, streamStart + 0.1, 0.95);

    ctx.editor = { node: editor, shake, alarm, head: head.view, tail: tail.view };
  }

  /** on_screen: the three notifications, top to bottom. */
  function buildChaos(scene, ctx) {
    const t0 = scene.start;
    const { editor } = ctx;
    tween(editor.node, { translate: '0 -150px' }, t0, 0.55, EASE.inOut);
    fx.fadeOut(editor.head, t0 + 0.02, 0.3);
    fx.fadeIn(editor.tail, t0 + 0.02, 0.3);
    fx.fadeIn(editor.alarm, t0 + 0.35, 0.3);

    const icons = [['toast-icon--fail', 'cross'], ['toast-icon--conflict', 'bang'], ['toast-icon--down', 'down']];
    const stack = el('div', 'toast-stack');
    scene.on_screen.forEach((message, index) => {
      const toast = el('div', 'toast is-staged');
      const [iconClass, iconName] = icons[index % icons.length];
      const badge = el('div', `toast-icon ${iconClass}`);
      badge.append(icon(iconName));
      toast.append(badge, el('div', 'toast-text', message));
      stack.append(toast);
      // Each notification lands on a beat, starting on the scene's second beat.
      const lands = t0 + 0.5 + index * 0.5;
      tween(toast, [
        { opacity: 0, translate: '160px 0', rotate: '5deg' },
        { opacity: 1, translate: '0 0', rotate: '0deg' },
      ], lands - 0.12, 0.5, EASE.back);
      cue('alert', lands);
      // One damped nudge per impact — a jittery multi-reversal shake would
      // make every glyph edge flicker (WCAG 2.3.1).
      tween(editor.shake, [
        { translate: '0 0', easing: EASE.out },
        { translate: '-12px 0', offset: 0.3, easing: EASE.inOut },
        { translate: '0 0' },
      ], lands - 0.04, 0.4, EASE.linear);
    });
    ctx.layer.append(stack);

    const collapseAt = scene.end - 0.45;
    fx.blurAway(editor.node, collapseAt, { duration: 0.42 });
    fx.blurAway(stack, collapseAt - 0.02, { duration: 0.42 });
    cue('collapse', collapseAt);
  }

  /** on_screen: [setup line, punchline]; *accent* words get a drawn underline. */
  function buildReframe(scene, ctx) {
    const [setupText, punchText] = scene.on_screen;
    const t0 = scene.start;

    const setup = kinetic(setupText, 'reframe-a is-centered');
    const punch = kinetic(punchText, 'reframe-b is-centered');
    ctx.layer.append(setup.node, punch.node);
    revealParts(setup.parts, t0 + 0.1, 0.05);
    revealParts(punch.parts, t0 + 0.95, 0.07);

    // One underline per text row the accent words occupy.
    const rows = new Map();
    for (const part of punch.parts.filter((p) => p.classList.contains('is-accent'))) {
      const box = stageRect(part.parentElement, ctx.stage);
      const key = Math.round(box.top);
      const row = rows.get(key) || { left: Infinity, right: -Infinity, bottom: 0 };
      row.left = Math.min(row.left, box.left);
      row.right = Math.max(row.right, box.left + box.width);
      row.bottom = Math.max(row.bottom, box.top + box.height);
      rows.set(key, row);
    }
    const underlines = [];
    for (const row of rows.values()) {
      const width = row.right - row.left;
      const art = svg('svg', {
        class: 'reframe-underline',
        width: Math.round(width),
        height: 40,
        viewBox: `0 0 ${Math.round(width)} 40`,
      });
      art.style.left = `${row.left}px`;
      art.style.top = `${row.bottom - 16}px`;
      const stroke = svg('path', {
        class: 'is-drawn is-staged',
        d: `M 8 26 Q ${width * 0.45} 8 ${width - 8} 18`,
      });
      art.append(stroke);
      ctx.layer.append(art);
      fx.draw(stroke, t0 + 1.5, 0.45, EASE.out);
      underlines.push(art);
    }
    if (underlines.length) cue('underline', t0 + 1.5);

    const exitAt = scene.end - 0.26;
    fx.exitUp(setup.node, exitAt);
    fx.exitUp(punch.node, exitAt + 0.03);
    underlines.forEach((art) => fx.exitUp(art, exitAt + 0.03));
  }

  const SKILL_COPY_WIDTH = 770;

  /** The window the skill visuals play in; created by the first skill scene. */
  function skillWindow(ctx, at) {
    if (!ctx.skillWindow) {
      const chrome = windowChrome('skill-card is-staged');
      ctx.layer.append(chrome.node);
      fx.rise(chrome.node, at, { distance: 110, duration: 0.65 });
      ctx.skillWindow = chrome;
    }
    return ctx.skillWindow;
  }

  /**
   * Shared layout of the skill montage. on_screen: [title, subline]. The
   * window label and the visual swap per scene; the window itself persists.
   */
  function skillScene(scene, ctx, windowLabel, buildVisual) {
    const [titleText, subText] = scene.on_screen;
    const t0 = scene.start;
    const exitAt = scene.end - 0.24;
    cue('cut', t0);

    const copy = el('div', 'skill-copy');
    const title = kinetic(titleText, 'skill-title');
    const sub = el('p', 'skill-sub is-staged');
    sub.append(...listLine(subText));
    copy.append(title.node, sub);
    ctx.layer.append(copy);
    fitWords(title, SKILL_COPY_WIDTH);
    revealParts(title.parts, t0 + 0.02, 0.06, 0.55);
    fx.rise(sub, t0 + 0.12, { distance: 40, duration: 0.5 });
    fx.exitUp(title.node, exitAt);
    fx.exitUp(sub, exitAt + 0.02);

    const chrome = skillWindow(ctx, t0);
    const label = el('div', 'window-label is-staged', windowLabel);
    chrome.bar.append(label);
    fx.fadeIn(label, t0, 0.2);
    fx.fadeOut(label, scene.end - 0.12, 0.12);

    const visual = el('div', `skill-visual skill-visual--${scene.id} is-staged`);
    chrome.body.append(visual);
    fx.rise(visual, t0 + 0.02, { distance: 50, duration: 0.45 });
    buildVisual(visual, t0);
    fx.exitUp(visual, exitAt + 0.02, { distance: 50, duration: 0.22 });
  }

  /**
   * "user stories · Scrum · code review" → nodes that only wrap between list
   * items (each separator stays glued to the item before it).
   */
  function listLine(text) {
    const items = text.split(' · ');
    if (items.length === 1) return [text];
    return items.flatMap((item, index) => {
      const last = index === items.length - 1;
      const node = el('span', 'nowrap', last ? item : `${item} ·`);
      return last ? [node] : [node, ' '];
    });
  }

  /** Shrinks a kinetic line's font until its widest word fits `maxWidth`. */
  function fitWords(line, maxWidth) {
    const widest = Math.max(...line.parts.map((part) => part.parentElement.getBoundingClientRect().width));
    if (widest > maxWidth) {
      const size = parseFloat(getComputedStyle(line.node).fontSize);
      line.node.style.fontSize = `${Math.floor(size * maxWidth / widest)}px`;
    }
  }

  function buildGit(scene, ctx) {
    skillScene(scene, ctx, 'git log --graph', (visual, t0) => {
      const art = svg('svg', { class: 'git-graph', viewBox: '0 0 780 604' });
      // A fix branch dips below main and a feature branch arcs above it;
      // both merge back before the release tag lands on the last commit.
      const lines = [
        { kind: 'main', d: 'M 56 320 H 730', at: 0.04, duration: 0.5 },
        { kind: 'fix', d: 'M 110 320 C 110 400 140 446 190 446 C 240 446 270 400 270 320', at: 0.14, duration: 0.32 },
        { kind: 'feature', d: 'M 270 320 C 270 240 310 190 370 190 H 470 C 530 190 570 240 570 320', at: 0.44, duration: 0.46 },
      ];
      for (const line of lines) {
        const path = svg('path', { class: `git-line git-line--${line.kind} is-drawn is-staged`, d: line.d });
        art.append(path);
        fx.draw(path, t0 + line.at, line.duration, line.kind === 'main' ? EASE.out : EASE.inOut);
      }

      const merges = [
        { kind: 'fix', x: 270, at: 0.44 },
        { kind: 'feature', x: 570, at: 0.9 },
      ];
      for (const merge of merges) {
        const ring = svg('circle', { class: `git-ring git-ring--${merge.kind} is-staged`, cx: merge.x, cy: 320, r: 27 });
        art.append(ring);
        tween(ring, [{ opacity: 0.95, scale: 1 }, { opacity: 0, scale: 2.3 }], t0 + merge.at + 0.04, 0.5, EASE.out);
      }

      const commits = [
        { x: 110, y: 320, kind: 'main', at: 0.08 },
        { x: 190, y: 446, kind: 'fix', at: 0.3 },
        { x: 270, y: 320, kind: 'merge-fix', at: 0.44 },
        { x: 390, y: 190, kind: 'feature', at: 0.62 },
        { x: 470, y: 190, kind: 'feature', at: 0.72 },
        { x: 570, y: 320, kind: 'merge-feature', at: 0.9 },
        { x: 690, y: 320, kind: 'main', at: 1.0 },
      ];
      for (const commit of commits) {
        const dot = svg('circle', { class: `git-commit git-commit--${commit.kind} is-staged`, cx: commit.x, cy: commit.y, r: 26 });
        art.append(dot);
        fx.pop(dot, t0 + commit.at, { from: 0, duration: 0.42 });
      }

      const labels = [
        { kind: 'main', text: 'main', x: 600, y: 392, at: 0.2 },
        { kind: 'fix', text: 'fix', x: 238, y: 510, at: 0.34 },
        { kind: 'feature', text: 'feature', x: 358, y: 146, at: 0.58 },
      ];
      for (const label of labels) {
        const text = svg('text', { class: `git-label git-label--${label.kind} is-staged`, x: label.x, y: label.y });
        text.textContent = label.text;
        art.append(text);
        fx.fadeIn(text, t0 + label.at, 0.25);
      }

      const tag = svg('g', { class: 'git-tag is-staged' });
      tag.append(
        svg('rect', { class: 'git-tag-pill', x: 636, y: 226, width: 108, height: 46, rx: 23 }),
        svg('path', { class: 'git-tag-pill', d: 'M 678 270 L 690 286 L 702 270 Z' }),
      );
      const tagText = svg('text', { class: 'git-tag-text', x: 690, y: 259, 'text-anchor': 'middle' });
      tagText.textContent = 'v1.0';
      tag.append(tagText);
      art.append(tag);
      fx.pop(tag, t0 + 1.06, { from: 0.3, duration: 0.4 });
      visual.append(art);
    });
  }

  function buildTesting(scene, ctx) {
    skillScene(scene, ctx, 'pytest', (visual, t0) => {
      const tests = el('div', 'tests');
      tests.append(el('div', 'tests-cmd', '$ pytest -q'));
      const names = ['test_signup', 'test_cart_total', 'test_checkout', 'test_refund'];
      names.forEach((name, index) => {
        const row = el('div', 'test-row');
        const badge = el('div', 'test-badge');
        const fail = el('div', 'test-state test-state--fail');
        fail.append(icon('cross'));
        const pass = el('div', 'test-state test-state--pass is-staged');
        pass.append(icon('check'));
        badge.append(fail, pass);
        const word = el('div', 'test-word');
        const failWord = el('span', 'test-word--fail', 'FAIL');
        const passWord = el('span', 'test-word--pass is-staged', 'PASS');
        word.append(failWord, passWord);
        row.append(badge, el('div', 'test-name', name), word);
        tests.append(row);

        // Tests turn green on consecutive 16th notes (120 BPM).
        const flipAt = t0 + 0.25 + index * 0.125;
        tween(fail, { opacity: 0, scale: 0.4 }, flipAt, 0.16, EASE.in);
        fx.fadeOut(failWord, flipAt, 0.12);
        fx.pop(pass, flipAt + 0.06, { from: 0.3, duration: 0.4 });
        fx.fadeIn(passWord, flipAt + 0.06, 0.18);
        cue('pass', flipAt + 0.06);
      });

      const summary = el('div', 'tests-summary');
      const bar = el('div', 'tests-bar');
      const fill = el('div', 'tests-bar-fill');
      bar.append(fill);
      const result = el('div', 'tests-result is-staged', '4 passed');
      summary.append(bar, result);
      tests.append(summary);
      tween(fill, [{ scale: '0 1' }, { scale: '1 1' }], t0 + 0.3, 0.72, EASE.inOut);
      fx.pop(result, t0 + 0.96, { from: 0.5, duration: 0.4 });
      visual.append(tests);
    });
  }

  function buildDesign(scene, ctx) {
    skillScene(scene, ctx, 'observer.uml', (visual, t0) => {
      const edges = svg('svg', { class: 'uml-edges', viewBox: '0 0 780 604' });
      const association = svg('path', { class: 'uml-edge is-drawn is-staged', d: 'M 274 150 H 372' });
      const openHead = svg('path', { class: 'uml-head uml-head--open is-staged', d: 'M 356 136 L 378 150 L 356 164' });
      const realizeLeft = svg('path', { class: 'uml-edge uml-edge--realize is-staged', d: 'M 370 386 V 300 H 525' });
      const realizeRight = svg('path', { class: 'uml-edge uml-edge--realize is-staged', d: 'M 640 386 V 300 H 525 V 238' });
      const triangle = svg('path', { class: 'uml-head is-staged', d: 'M 525 216 L 507 240 L 543 240 Z' });
      edges.append(association, openHead, realizeLeft, realizeRight, triangle);
      fx.draw(association, t0 + 0.55, 0.3);
      fx.fadeIn(openHead, t0 + 0.8, 0.12);
      fx.fadeIn(realizeLeft, t0 + 0.6, 0.25);
      fx.fadeIn(realizeRight, t0 + 0.66, 0.25);
      fx.fadeIn(triangle, t0 + 0.78, 0.15);
      visual.append(edges);

      const classes = [
        { name: 'Subject', left: 24, top: 88, width: 250, height: 124, at: 0.1 },
        { name: 'Observer', stereotype: '«interface»', left: 380, top: 88, width: 290, height: 128, at: 0.2 },
        { name: 'EmailAlert', left: 245, top: 386, width: 250, height: 110, at: 0.34 },
        { name: 'PushAlert', left: 515, top: 386, width: 250, height: 110, at: 0.44 },
      ];
      for (const spec of classes) {
        const box = el('div', `uml-class${spec.stereotype ? ' uml-class--interface' : ''} is-staged`);
        Object.assign(box.style, {
          left: `${spec.left}px`, top: `${spec.top}px`, width: `${spec.width}px`, height: `${spec.height}px`,
        });
        if (spec.stereotype) box.append(el('div', 'uml-stereotype', spec.stereotype));
        box.append(el('div', 'uml-name', spec.name));
        visual.append(box);
        fx.pop(box, t0 + spec.at, { from: 0.5, duration: 0.45 });
      }

      // notify(): a signal travels Subject → Observer → both implementations.
      const routes = [
        { points: [[274, 150], [380, 150]], at: 0.84, duration: 0.18 },
        { points: [[525, 216], [525, 300], [370, 300], [370, 386]], at: 1.0, duration: 0.24 },
        { points: [[525, 216], [525, 300], [640, 300], [640, 386]], at: 1.0, duration: 0.24 },
      ];
      for (const route of routes) {
        const signal = svg('circle', { class: 'uml-signal', r: 11 });
        edges.append(signal);
        onFrame((t) => {
          const p = progress(t, t0 + route.at, route.duration);
          const [x, y] = pointOnPolyline(route.points, p);
          signal.setAttribute('cx', x.toFixed(1));
          signal.setAttribute('cy', y.toFixed(1));
          signal.style.opacity = p > 0 && p < 1 ? '1' : '0';
        });
      }
    });
  }

  function buildArchitecture(scene, ctx) {
    skillScene(scene, ctx, 'system-design.md', (visual, t0) => {
      const links = svg('svg', { class: 'arch-links', viewBox: '0 0 780 604' });
      visual.append(links);
      // Geometry of the diagram; every node is vertically centred on MID
      // (the service's replicas sit one LANE above and below it).
      const MID = 302;
      const LANE = 150;
      const spots = {
        client: { left: 28, width: 148, height: 104 },
        api: { left: 226, width: 128, height: 104 },
        service: { left: 410, width: 164, height: 104 },
        db: { left: 628, width: 124, height: 152 },
      };
      const right = (name) => spots[name].left + spots[name].width;
      const center = (name) => spots[name].left + spots[name].width / 2;
      const node = (label, name, kind) => {
        const spot = spots[name];
        const box = el('div', `arch-node${kind ? ` arch-node--${kind}` : ''} is-staged`, label);
        Object.assign(box.style, {
          left: `${spot.left}px`,
          top: `${MID - spot.height / 2}px`,
          width: `${spot.width}px`,
          height: `${spot.height}px`,
        });
        visual.append(box);
        return box;
      };
      const client = node('Client', 'client');
      const api = node('API', 'api');
      const replicas = [node('Service', 'service', 'service'), node('Service', 'service', 'service'), node('Service', 'service', 'service')];
      const db = node('DB', 'db', 'db');
      [client, api, replicas[1], db].forEach((box, index) => fx.pop(box, t0 + 0.06 + index * 0.07, { from: 0.5 }));

      const link = (d) => svg('path', { class: 'arch-link is-drawn is-staged', d });
      const curve = (x1, y1, x2, y2) => {
        const mx = (x1 + x2) / 2;
        return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
      };
      const straight = [
        link(`M ${right('client')} ${MID} H ${spots.api.left}`),
        link(`M ${right('api')} ${MID} H ${spots.service.left}`),
        link(`M ${right('service')} ${MID} H ${spots.db.left}`),
      ];
      const fans = [-LANE, LANE].flatMap((offset) => [
        link(curve(right('api'), MID, spots.service.left, MID + offset)),
        link(curve(right('service'), MID + offset, spots.db.left, MID)),
      ]);
      links.append(...straight, ...fans);
      straight.forEach((path, index) => fx.draw(path, t0 + 0.3 + index * 0.06, 0.22));

      // Scale out: the service clones itself one lane above and below.
      const scaleOutAt = t0 + 0.58;
      const [upper, , lower] = replicas;
      tween(upper, [{ opacity: 1, translate: '0 0' }, { opacity: 1, translate: `0 ${-LANE}px` }], scaleOutAt, 0.36, EASE.out);
      tween(lower, [{ opacity: 1, translate: '0 0' }, { opacity: 1, translate: `0 ${LANE}px` }], scaleOutAt, 0.36, EASE.out);
      fans.forEach((path) => fx.draw(path, scaleOutAt + 0.2, 0.2));
      const badge = el('div', 'arch-badge is-staged', '×3');
      badge.style.left = `${right('service') - 40}px`;
      badge.style.top = `${MID - LANE - 76}px`;
      visual.append(badge);
      fx.pop(badge, scaleOutAt + 0.2, { from: 0.3, duration: 0.4 });

      // Requests: packets hop client → api → a service → db, looping. Once
      // the service has scaled out, each trip picks a replica's lane.
      const lanes = [MID, MID - LANE, MID + LANE];
      const cycle = 0.55;
      for (let k = 0; k < 4; k++) {
        const packet = el('div', 'arch-packet');
        visual.append(packet);
        const start = t0 + 0.42 + k * 0.17;
        onFrame((t) => {
          const elapsed = t - start;
          const trip = Math.max(0, Math.floor(elapsed / cycle));
          const scaledOut = start + trip * cycle >= scaleOutAt + 0.25;
          const lane = scaledOut ? lanes[(k + trip) % lanes.length] : MID;
          const route = [
            [center('client'), MID], [right('api'), MID], [spots.service.left, lane],
            [right('service'), lane], [spots.db.left, MID], [center('db'), MID],
          ];
          const [x, y] = pointOnPolyline(route, elapsed < 0 ? 0 : (elapsed % cycle) / cycle);
          packet.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
          packet.style.opacity = elapsed > 0 ? '1' : '0';
        });
      }
    });
  }

  function buildTeamwork(scene, ctx) {
    skillScene(scene, ctx, 'sprint-board', (visual, t0) => {
      const columnX = [24, 277, 530];
      ['To Do', 'Doing', 'Done'].forEach((name, index) => {
        const column = el('div', 'board-col', name);
        column.style.left = `${columnX[index]}px`;
        visual.append(column);
      });
      const slot = (column, row) => `${columnX[column] + 14}px ${96 + row * 96}px`;
      // moves: [column, row, seconds after scene start]
      const cards = [
        { title: 'Login', tag: 'blue', moves: [[1, 0, 0.14], [2, 0, 0.46]] },
        { title: 'Search', tag: 'gold', moves: [[1, 0, 0.5], [2, 1, 0.82]] },
        { title: 'Checkout', tag: 'green', moves: [[1, 0, 0.86]] },
        { title: 'Profile', tag: 'blue', moves: [[0, 0, 0.9]] },
      ];
      cards.forEach((spec, index) => {
        const card = el('div', `board-card board-card--${spec.tag}`, spec.title);
        card.style.translate = slot(0, index);
        visual.append(card);
        for (const [column, row, at] of spec.moves) {
          tween(card, { translate: slot(column, row) }, t0 + at, 0.3, EASE.out);
          tween(card, [{ rotate: '0deg' }, { rotate: '4deg', offset: 0.4 }, { rotate: '0deg' }], t0 + at, 0.3, EASE.inOut);
        }
      });

      const pr = el('div', 'board-pr is-staged');
      const check = el('div', 'board-pr-check');
      check.append(icon('check'));
      pr.append(check, el('span', '', 'PR #42 · code review'), el('span', 'board-pr-state', 'Approved'));
      visual.append(pr);
      fx.pop(pr, t0 + 0.98, { from: 0.7, duration: 0.4 });
    });
  }

  /** on_screen: [headline, *accent* line, …feature chips] */
  function buildTutorials(scene, ctx) {
    const [lineOne, lineTwo, ...chipTexts] = scene.on_screen;
    const t0 = scene.start;
    const exitAt = scene.end - 0.26;
    cue('cut', t0);

    const copy = el('div', 'tutorials-copy');
    const first = kinetic(lineOne, 'tutorials-line');
    const second = kinetic(lineTwo, 'tutorials-line');
    const chips = el('div', 'chips');
    const chipNodes = chipTexts.map((text) => el('span', 'chip is-staged', text));
    chips.append(...chipNodes);
    copy.append(first.node, second.node, chips);
    ctx.layer.append(copy);
    revealParts(first.parts, t0 + 0.04, 0.07);
    revealParts(second.parts, t0 + 0.3, 0.07);
    chipNodes.forEach((chip, index) => fx.pop(chip, t0 + 0.62 + index * 0.14, { from: 0.6 }));
    fx.exitUp(copy, exitAt);

    // The skill window turns into a browser tab running a real terminal.
    const chrome = skillWindow(ctx, t0);
    const url = el('div', 'window-url is-staged');
    url.append(icon('lock'), document.createTextNode('tobiasduerschmid.github.io/SEBook'));
    chrome.bar.append(url);
    fx.fadeIn(url, t0, 0.25);

    const terminal = el('div', 'terminal is-staged');
    chrome.body.append(terminal);
    fx.fadeIn(terminal, t0 + 0.02, 0.25);
    // Find the AI's TODO, prove the fix, ship it.
    const promptLine = (at, command = '') => {
      const line = el('div', 'term-line is-staged');
      const typed = el('span');
      line.append(el('span', 'term-prompt', 'student@sebook'), ':', el('span', 'term-path', '~'), '$ ', typed);
      terminal.append(line);
      fx.fadeIn(line, at, 0.05);
      return { line, done: typewriter(typed, command, at + 0.05, 40) };
    };
    const outputLine = (parts, at) => {
      const line = el('div', 'term-line is-staged');
      line.append(...parts);
      terminal.append(line);
      fx.fadeIn(line, at, 0.08);
    };
    const grep = promptLine(t0 + 0.14, 'grep -n TODO app.py');
    outputLine(['22:    # ', el('span', 'term-hit', 'TODO'), ': payments??'], grep.done + 0.06);
    const test = promptLine(grep.done + 0.2, 'pytest -q');
    outputLine([el('span', 'term-prompt', '4 passed'), ' in 0.42s'], test.done + 0.08);
    const push = promptLine(test.done + 0.2, 'git push');
    outputLine(['   3f2a1c9..8b1e4d0  main -> main'], push.done + 0.08);
    const idle = promptLine(push.done + 0.16);
    const caret = el('span', 'term-caret');
    idle.line.append(caret);
    caretBlink(caret, push.done + 0.16);

    tween(chrome.node, { opacity: 0, scale: 0.92, filter: 'blur(12px)' }, exitAt, 0.36, EASE.in);
  }

  /** on_screen: [logo, tagline, web address] — the end card holds to the last frame. */
  function buildCta(scene, ctx) {
    const [logoText, taglineText, urlText] = scene.on_screen;
    const t0 = scene.start;

    fx.fadeOut(ctx.brand, t0 - 0.05, 0.3);
    tween(ctx.glows.blue, { translate: '520px 460px', scale: 0.85 }, t0, 1.4, EASE.inOut);
    tween(ctx.glows.gold, { translate: '-380px -310px', scale: 0.8 }, t0, 1.4, EASE.inOut);

    const logo = kinetic(logoText, 'cta-logo is-centered', { split: 'chars' });
    const bar = el('div', 'cta-bar is-staged');
    const tagline = kinetic(taglineText, 'cta-tagline is-centered');
    const url = el('div', 'kinetic cta-url is-centered is-staged', urlText);
    ctx.layer.append(logo.node, bar, tagline.node, url);
    revealParts(logo.parts, t0 + 0.12, 0.045, 0.7);
    tween(bar, [{ opacity: 1, scale: '0 1' }, { opacity: 1, scale: '1 1' }], t0 + 0.5, 0.55, EASE.out);
    revealParts(tagline.parts, t0 + 0.62, 0.07);
    fx.rise(url, t0 + 0.98, { distance: 30, duration: 0.5 });
  }

  const BUILDERS = {
    prompt: buildPrompt,
    chaos: buildChaos,
    reframe: buildReframe,
    git: buildGit,
    testing: buildTesting,
    design: buildDesign,
    architecture: buildArchitecture,
    teamwork: buildTeamwork,
    tutorials: buildTutorials,
    cta: buildCta,
  };

  // ------------------------------------------------------------------
  // Background + brand chrome (lives for the whole video)
  // ------------------------------------------------------------------

  function buildBackdrop(ctx, duration) {
    const blue = el('div', 'bg-glow bg-glow--blue');
    const gold = el('div', 'bg-glow bg-glow--gold');
    const grid = el('div', 'bg-grid');
    const vignette = el('div', 'layer bg-vignette');
    ctx.stage.append(blue, gold, grid, vignette);
    tween(blue, [{ translate: '0 0' }, { translate: '240px 150px' }], 0, 17.8, EASE.inOut);
    tween(gold, [{ translate: '0 0' }, { translate: '-200px -120px' }], 0, 17.8, EASE.inOut);
    tween(grid, [{ translate: '0 0' }, { translate: '-112px -56px' }], 0, duration, EASE.linear);
    ctx.glows = { blue, gold };

    const brand = el('div', 'brand is-staged');
    brand.append(el('div', 'brand-name', 'SE Book'), el('div', 'brand-bar'));
    ctx.stage.append(brand);
    fx.fadeIn(brand, 0.25, 0.4);
    ctx.brand = brand;
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------

  async function loadStoryboard() {
    const response = await fetch(STORYBOARD_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load ${STORYBOARD_URL}: HTTP ${response.status}`);
    return window.jsyaml.load(await response.text());
  }

  function fitToViewport(stage) {
    const scale = Math.min(window.innerWidth / stage.offsetWidth, window.innerHeight / stage.offsetHeight);
    stage.style.transform = `scale(${scale})`;
    document.body.classList.add('is-fit');
  }

  function playLoop(duration) {
    const startedAt = performance.now();
    const frame = (now) => {
      seek(((now - startedAt) / 1000) % duration);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  async function boot() {
    const storyboard = await loadStoryboard();
    await Promise.all(FONT_FACES.map((font) => document.fonts.load(font)));
    await document.fonts.ready;

    const stage = document.getElementById('stage');
    const ctx = { stage, layer: el('div', 'layer') };
    buildBackdrop(ctx, storyboard.duration);
    stage.append(ctx.layer);
    for (const scene of storyboard.scenes) {
      const build = BUILDERS[scene.id];
      if (!build) throw new Error(`stage.js has no builder for storyboard scene "${scene.id}".`);
      build(scene, ctx);
    }
    seek(0);

    const params = new URLSearchParams(window.location.search);
    if (params.has('fit')) fitToViewport(stage);
    if (params.has('play')) playLoop(storyboard.duration);
    else if (params.has('t')) seek(Number(params.get('t')));
  }

  window.teaser = { seek, cues, ready: boot() };
  window.teaser.ready.catch((error) => console.error(error));
})();
