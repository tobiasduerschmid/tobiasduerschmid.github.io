/*
 * The wall kit: the materials every animated video narration draws with
 * (styles: css/video-narration-wall-kit.css). A topic's own kit adds its
 * objects on top (js/video-narration/scrum-kit.js,
 * js/video-narration/blood-groups-kit.js). The visual language:
 *
 *   the work is paper on the wall, the same paper in both modes: cards with
 *     an optional rank, notes, speech bubbles, checklists, and role badges on
 *     lanyards, plus pills for skills and states;
 *   a summary is a dark card with an icon, a title, and a list (listCard),
 *     and a trap and its fix are the same card printed on pink and green;
 *   structure is drawn, not written: frames and columns hold things, a
 *     bracket names a span, an arrow is a flow, a dashed slot is an open
 *     question, a loop keeps turning, a balance weighs two lists, and pillars
 *     hold up a temple;
 *   every picture has a heading strip (topicTag) above its artwork layer
 *     (body, scaled to 91%), and an overlay for effects that belong on top.
 *
 * Class names keep the sk- (stage kit) prefix the Scrum lesson introduced.
 * Every builder schedules its own motion on the Timeline, so a choreography
 * reads as "what appears when", and every pose is a pure function of
 * narration time. Coordinates are CSS pixels on the 960x540 stage.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, progress, easeInOutCubic } = window.Timeline;
  const kit = window.SongKit;
  const { el, place, icon } = kit;

  function staged(parent, className, x, y, text) {
    return place(el('div', `${className} is-staged`, parent, text), x, y);
  }

  function appear(node, at, until, { from = 0.6, rotate = 0 } = {}) {
    fx.pop(node, at, { from, rotate });
    if (until !== undefined) fx.popOut(node, until);
    return node;
  }

  /** Outlines `node` in gold (.is-lit) during each [from, to) interval; to may be left open. */
  function lit(node, intervals) {
    onFrame((t) => node.classList.toggle('is-lit', intervals.some(([from, to = Infinity]) => t >= from && t < to)));
  }

  /** A role badge: an icon, the role, and a lanyard. `variant`: dev, po, or sm; `w` widens it for a long role. */
  function badge(parent, { x, y, w, role, iconName, variant = 'dev', at, until }) {
    const node = staged(parent, `sk-badge sk-badge--${variant}`, x, y);
    if (w) node.style.width = `${w}px`;
    el('span', 'sk-badge-icon', node).append(icon(iconName));
    el('span', 'sk-badge-role', node, role);
    fx.rise(node, at, { distance: -60, duration: 0.45 });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /** A pill: a skill, or with `tone` (po, sm, done) a role or state; `w` wraps it at that width. */
  function skill(parent, { x, y, text, tone, w, at, until }) {
    const node = staged(parent, `sk-skill${tone ? ` sk-skill--${tone}` : ''}`, x, y, text);
    if (w) {
      node.style.width = `${w}px`;
      node.classList.add('is-wrapped');
    }
    return appear(node, at, until, { from: 0.4, rotate: -3 });
  }

  function frame(parent, { x, y, w, h, label, at, until }) {
    const node = staged(parent, 'sk-frame', x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    el('span', 'sk-frame-label', node, label);
    fx.fadeIn(node, at, 0.4);
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /**
   * A paper card on a board, with an optional rank that may arrive later
   * (`rankAt`), as when the Product Owner orders new stories. `tone`: new,
   * blocked, or fuzzy (an item too big and vague to build yet).
   */
  function card(parent, { x, y, w = 260, text, rank, rankAt, tone, at, until }) {
    const node = staged(parent, `sk-card${tone ? ` sk-card--${tone}` : ''}`, x, y);
    node.style.width = `${w}px`;
    if (rank !== undefined) {
      const number = el('span', 'sk-card-rank', node, String(rank));
      if (rankAt !== undefined) {
        number.classList.add('is-staged');
        fx.pop(number, rankAt, { from: 0.3 });
      }
    }
    el('span', null, node, text);
    return appear(node, at, until, { from: 0.7 });
  }

  function note(parent, { x, y, w, text, tone, tilt = -2, at, until }) {
    const node = staged(parent, `sk-note${tone ? ` sk-note--${tone}` : ''}`, x, y, text);
    if (w) node.style.width = `${w}px`;
    node.style.rotate = `${tilt}deg`;
    return appear(node, at, until, { from: 0.5, rotate: tilt });
  }

  function column(parent, { x, y, w, h, title, at, until }) {
    const node = staged(parent, 'sk-column', x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    el('div', 'sk-column-head', node, title);
    fx.rise(node, at, { distance: 24, duration: 0.4 });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /**
   * A goal on a gold banner. With `typeAt`, the text types itself in from an
   * empty banner; with `lockAt`, a padlock locks it in place.
   */
  function banner(parent, { x, y, w, title, text, at, until, typeAt, lockAt }) {
    const node = staged(parent, 'sk-banner', x, y);
    node.style.width = `${w}px`;
    el('b', null, node, title);
    const words = el('span', null, node, typeAt === undefined ? text : '');
    if (typeAt !== undefined) kit.typewriter(words, text, typeAt, 34);
    if (lockAt !== undefined) {
      const lock = icon('lock');
      lock.classList.add('is-staged');
      node.append(lock);
      fx.pop(lock, lockAt, { from: 0.3 });
    }
    fx.rise(node, at, { distance: 16, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /** A speech bubble; `small` fits a short line into a narrow space. */
  function speech(parent, { x, y, w, who, text, at, until, small = false }) {
    const node = staged(parent, `sk-speech${small ? ' sk-speech--small' : ''}`, x, y);
    if (w) node.style.width = `${w}px`;
    if (who) el('b', null, node, who);
    node.append(document.createTextNode(text));
    return appear(node, at, until, { from: 0.5 });
  }

  /**
   * Labels around a circle, and a marker that keeps travelling around it,
   * one turn every `period` seconds.
   */
  function loop(parent, { x, y, r, labels, at, until, period = 6 }) {
    const ring = staged(parent, 'sk-loop', x - r, y - r);
    ring.style.width = `${2 * r}px`;
    ring.style.height = `${2 * r}px`;
    fx.fadeIn(ring, at, 0.4);
    const dot = staged(parent, 'sk-loop-dot', x, y - r);
    fx.fadeIn(dot, at + 0.3, 0.2);
    onFrame((t) => {
      const angle = ((Math.max(0, t - at) / period) % 1) * Math.PI * 2 - Math.PI / 2;
      dot.style.left = `${(x + r * Math.cos(angle)).toFixed(1)}px`;
      dot.style.top = `${(y + r * Math.sin(angle)).toFixed(1)}px`;
    });
    const nodes = labels.map((text, i) => {
      const angle = (i / labels.length) * Math.PI * 2 - Math.PI / 2;
      const node = staged(parent, 'sk-loop-label', x + r * Math.cos(angle), y + r * Math.sin(angle), text);
      return appear(node, at + 0.2 + i * 0.2, until, { from: 0.4 });
    });
    if (until !== undefined) [ring, dot].forEach((node) => fx.fadeOut(node, until));
    return nodes;
  }

  function label(parent, { x, y, w, text, at, until, muted = false }) {
    const node = staged(parent, `sk-label${muted ? ' sk-label--muted' : ''}`, x, y, text);
    if (w) node.style.width = `${w}px`;
    fx.rise(node, at, { distance: 10, duration: 0.3 });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /**
   * A checklist card. items = [{ text, at, checkAt }]: each line appears at
   * `at` (typed in when `type` is set) and is checked at `checkAt`.
   */
  function checklist(parent, { x, y, w, title, items, at, until }) {
    const node = staged(parent, 'sk-checklist', x, y);
    if (w) node.style.width = `${w}px`;
    el('p', 'sk-checklist-title', node, title);
    items.forEach(({ text, at: lineAt = at, checkAt, type }) => {
      const line = el('div', 'sk-check is-staged', node);
      const box = el('span', 'sk-check-box', line);
      const words = el('span', null, line, type ? '' : text);
      if (type) kit.typewriter(words, text, lineAt, 30);
      fx.rise(line, lineAt, { distance: 8, duration: 0.25 });
      if (checkAt !== undefined) {
        const tick = icon('check');
        tick.classList.add('is-staged');
        box.append(tick);
        fx.pop(tick, checkAt, { from: 0.3 });
      }
    });
    fx.rise(node, at, { distance: 20, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /** A bracket over a span, named on its top edge; `under` opens it upward beneath the span. */
  function bracket(parent, { x, y, w, text, at, next = false, under = false }) {
    const node = staged(parent, `sk-bracket${next ? ' sk-bracket--next' : ''}${under ? ' sk-bracket--under' : ''}`, x, y);
    node.style.width = `${w}px`;
    el('span', null, node, text);
    tween(node, [{ opacity: 0, scale: '0.2 1' }, { opacity: 1, scale: '1 1' }], at, 0.45, EASE.out);
    return node;
  }

  function dot(parent, { x, y, at }) {
    return appear(staged(parent, 'sk-dot', x, y), at, undefined, { from: 0.2 });
  }

  function flag(parent, { x, y, text, tone, at }) {
    return appear(staged(parent, `sk-flag${tone ? ` sk-flag--${tone}` : ''}`, x, y, text), at, undefined, { rotate: -4 });
  }

  /**
   * A dark card: an icon, a title, an optional line, and items that rise in
   * one at a time ({ text, at, iconName }), in two columns when `columns` is
   * 2. `tone` prints it on paper: 'trap' (pink) or 'fix' (green). `lit`
   * outlines it in gold during each [from, to) interval.
   */
  function listCard(parent, { x, y, w, h, title, text, iconName, items = [], columns = 1, tone, at, until, lit: intervals }) {
    const node = staged(parent, `sk-list${tone ? ` sk-list--${tone}` : ''}`, x, y);
    node.style.width = `${w}px`;
    if (h) node.style.height = `${h}px`;
    const head = el('div', 'sk-list-head', node);
    if (iconName) el('span', 'sk-list-icon', head).append(icon(iconName));
    el('p', 'sk-list-title', head, title);
    if (text) el('p', 'sk-list-text', node, text);
    if (items.length) {
      const list = el('ul', `sk-list-items${columns === 2 ? ' sk-list-items--two' : ''}`, node);
      items.forEach(({ text: line, at: lineAt = at, iconName: lineIcon }) => {
        const item = el('li', 'sk-list-item is-staged', list);
        if (lineIcon) item.append(icon(lineIcon));
        el('span', null, item, line);
        fx.rise(item, lineAt, { distance: 10, duration: 0.3 });
      });
    }
    fx.rise(node, at, { distance: 24, duration: 0.4 });
    if (intervals) lit(node, intervals);
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /** A temple's roof and base, `w` wide; pillar() stands its pillars between them. */
  function temple(parent, { x, y, w, roof, base, baseY, at }) {
    const top = staged(parent, 'sk-roof', x, y);
    top.style.width = `${w}px`;
    el('span', null, top, roof);
    fx.rise(top, at, { distance: -24 });
    const bottom = staged(parent, 'sk-base', x, baseY, base);
    bottom.style.width = `${w}px`;
    fx.rise(bottom, at + 0.15, { distance: 24 });
    return { top, bottom };
  }

  /** A pillar that rises into place: its name on the capital, a short line on the shaft. */
  function pillar(parent, { x, y, w, h, title, text, at, lit: intervals }) {
    const node = staged(parent, 'sk-pillar', x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    el('p', 'sk-pillar-cap', node, title);
    el('p', 'sk-pillar-text', node, text);
    tween(node, [{ opacity: 0, translate: '0 60px' }, { opacity: 1, translate: '0 0' }], at, 0.55, EASE.back);
    if (intervals) lit(node, intervals);
    return node;
  }

  /**
   * A balance: a beam on a post, centered on (x, y), with a listCard() pan
   * hanging level from each end. The beam tilts to each { at, angle } in
   * turn (degrees; a negative angle lowers the left pan). Returns the pans.
   */
  function balance(parent, { x, y, beam, at, pans, tilts }) {
    const post = staged(parent, 'sk-balance-post', x - 10, y);
    const bar = staged(parent, 'sk-balance-beam', x - beam / 2, y - 8);
    bar.style.width = `${beam}px`;
    fx.fadeIn(post, at, 0.35);
    fx.fadeIn(bar, at + 0.1, 0.35);
    const hung = pans.map((options) => {
      const pan = listCard(parent, { ...options, x: 0, y: 0 });
      pan.classList.add('sk-balance-pan');
      return pan;
    });
    onFrame((t) => {
      let angle = 0;
      for (const tilt of tilts) {
        if (t < tilt.at) break;
        angle += (tilt.angle - angle) * easeInOutCubic(progress(t, tilt.at, 0.8));
      }
      bar.style.rotate = `${angle.toFixed(2)}deg`;
      const radians = (angle * Math.PI) / 180;
      hung.forEach((pan, i) => {
        const side = i === 0 ? -1 : 1;
        pan.style.left = `${(x + side * (beam / 2) * Math.cos(radians) - pans[i].w / 2).toFixed(1)}px`;
        pan.style.top = `${(y + side * (beam / 2) * Math.sin(radians) + 40).toFixed(1)}px`;
      });
    });
    return hung;
  }

  const ARROW_HEAD = 16;

  /** An arrow that grows from `from` until its tip reaches `to` ([x, y] stage points). */
  function arrow(parent, { from: [x1, y1], to: [x2, y2], dashed = false, at, until }) {
    const node = staged(parent, `sk-arrow${dashed ? ' sk-arrow--dashed' : ''}`, x1, y1);
    node.style.width = `${Math.max(0, Math.hypot(x2 - x1, y2 - y1) - ARROW_HEAD)}px`;
    node.style.rotate = `${((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI).toFixed(1)}deg`;
    tween(node, [{ opacity: 0, scale: '0 1' }, { opacity: 1, scale: '1 1' }], at, 0.45, EASE.out);
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /** A dashed, empty place for an answer still to come. */
  function slot(parent, { x, y, w, h, text = '?', at, until }) {
    const node = staged(parent, 'sk-slot', x, y, text);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    return appear(node, at, until, { from: 0.7 });
  }

  /** How far a story has come: a label over a bar that fills to `value` (0 to 1). */
  function progressBar(parent, { x, y, w, value, text, at, until }) {
    const node = staged(parent, 'sk-progress', x, y);
    node.style.width = `${w}px`;
    el('span', 'sk-progress-label', node, text);
    const fill = el('span', 'sk-progress-fill', el('span', 'sk-progress-bar', node));
    fx.rise(node, at, { distance: 10, duration: 0.3 });
    tween(fill, [{ width: '0%' }, { width: `${Math.round(value * 100)}%` }], at + 0.2, 0.9);
    if (until !== undefined) fx.fadeOut(node, until);
    return node;
  }

  /**
   * The picture's heading, in the strip above its body: what the
   * cue is about (`kind`: Role, Artifact, Event, Theory, or Scrum), its
   * name, and the icon that stands for it throughout the video.
   */
  function topicTag(parent, { kind, name, iconName, at }) {
    const node = el('div', `sk-topic sk-topic--${kind.toLowerCase()} is-staged`, parent);
    el('span', 'sk-topic-icon', node).append(icon(iconName));
    const words = el('span', 'sk-topic-words', node);
    el('small', null, words, kind);
    el('b', null, words, name);
    fx.slideIn(node, at, { dx: 40, duration: 0.4 });
    return node;
  }

  /** The picture's artwork layer, scaled beneath the heading strip; draw every piece in it. */
  function body(parent) {
    return el('div', 'sk-body', parent);
  }

  /** An empty layer over everything drawn in `parent` so far, for effects that belong on top. */
  function overlay(parent) {
    return el('div', 'sk-overlay', parent);
  }

  window.WallKit = {
    staged, appear, lit, badge, skill, frame, card, note, column, banner,
    speech, loop, label, checklist, bracket, dot, flag, listCard, temple,
    pillar, balance, arrow, slot, progressBar, topicTag, body, overlay,
  };
})();
