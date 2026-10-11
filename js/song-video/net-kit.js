/*
 * Networking illustrations for song videos in the night-sky theme (first
 * used by "Unbox the Stack", songs/unbox_the_stack.js): panels, the
 * browser window, the castle that plays the server, the 1969 IMP, a game
 * map, packet segments, retransmission timers, header diagrams, floating
 * router islands joined by light beams, the nested-box packet that gets
 * wrapped and unboxed layer by layer, the four-layer stack, sequence-diagram
 * lanes, and the TCP/UDP gates. Every builder schedules its own motion on
 * the Timeline, like kit.js; net-kit.css gives them the studio theme's type,
 * boxes, and lines (stage.css), so this video matches the Git song's.
 * The student is the viewer's own SE Gym hero at a laptop
 * (student-avatar.js), placed by the choreography with student.appear().
 *
 * Coordinates are CSS pixels on the 960×540 stage; times are song seconds.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, onDispose, EASE, clamp, progress, easeInOutCubic, hash01 } = window.Timeline;
  const { el, svg, place, icon } = window.SongKit;

  /** The TCP/IP layers, top to bottom; `key` is the CSS color token suffix. */
  const LAYERS = {
    application: { name: 'Application', iconName: 'chat', key: 'app' },
    transport: { name: 'Transport', iconName: 'transfer', key: 'trn' },
    internet: { name: 'Internet', iconName: 'globe', key: 'net' },
    link: { name: 'Link', iconName: 'link', key: 'lnk' },
  };
  const LAYER_ORDER = ['application', 'transport', 'internet', 'link'];

  let uid = 0;
  const nextId = (prefix) => `${prefix}-${++uid}`;

  /** Inline SVG from markup; `{id}` in the markup becomes a unique suffix for its gradients. */
  function art(parent, markup, { viewBox, width, height, className = '' }) {
    const id = nextId('art');
    const node = svg('svg', { viewBox, width, height, class: `nk-art ${className}`.trim(), 'aria-hidden': 'true' }, parent);
    node.innerHTML = markup.replace(/\{id\}/g, id);
    return node;
  }

  /**
   * The drawing library: each drawing in art/*.js goes into the page once,
   * as an SVG <symbol>, and every copy on stage is a <use> of it, so the art
   * stays live vector graphics without repeating its markup per copy.
   * Disposing the scene removes the library.
   */
  const library = { node: null, symbols: new Map() };

  function symbolFor(drawing) {
    const known = library.symbols.get(drawing.key);
    if (known) return known;
    if (!library.node) {
      library.node = svg('svg', { class: 'nk-library', width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false' }, document.body);
      onDispose(() => {
        library.node.remove();
        library.node = null;
        library.symbols.clear();
      });
    }
    const id = nextId(`nk-${drawing.key}`);
    const symbol = svg('symbol', { id, viewBox: `0 0 ${drawing.box.width} ${drawing.box.height}` }, library.node);
    symbol.innerHTML = drawing.build().replace(/\{id\}/g, id);
    library.symbols.set(drawing.key, id);
    return id;
  }

  /**
   * A positioned box showing a drawing ({ key, box, build, overlay }) at
   * `scale`, with its live overlay SVG (`overlay`: markup per copy, for the
   * lights the choreography animates) on top.
   */
  function figure(parent, { x, y, className, drawing, scale }) {
    const { box } = drawing;
    const width = box.width * scale;
    const height = box.height * scale;
    const viewBox = `0 0 ${box.width} ${box.height}`;
    const node = place(el('div', `nk-figure ${className} is-staged`, parent), x, y);
    node.style.width = `${width}px`;
    node.style.height = `${height}px`;
    const picture = svg('svg', { class: 'nk-figure-art', viewBox, width, height, 'aria-hidden': 'true' }, node);
    svg('use', { href: `#${symbolFor(drawing)}` }, picture);
    const live = drawing.overlay ? art(node, drawing.overlay, { viewBox, width, height, className: 'nk-figure-live' }) : null;
    return { node, live, width, height };
  }

  /** The drawings in art/*.js, as figure() takes them. */
  const DRAWINGS = {
    client: () => ({ key: 'client', box: window.NetArt.CLIENT, build: window.NetArt.client, overlay: window.NetArt.clientOverlay() }),
    castle: () => ({ key: 'castle', box: window.NetArt.CASTLE, build: window.NetArt.castle, overlay: window.NetArt.castleOverlay() }),
    island: (kind) => ({ key: `island-${kind}`, box: window.NetArt.ISLAND, build: () => window.NetArt.island(kind), overlay: window.NetArt.islandOverlay(kind) }),
    imp: () => ({ key: 'imp', box: window.NetArt.IMP, build: window.NetArt.imp, overlay: window.NetArt.impOverlay() }),
    map: () => ({ key: 'map', box: window.NetArt.MAP, build: window.NetArt.map }),
  };

  /**
   * An onFrame update that runs only while its figure can be seen: from
   * `active[0]` to `active[1]` song seconds (always, without `active`), so
   * the many copies of the castle's lights on stage cost nothing while
   * their scenes are hidden.
   */
  function whileActive(active, update) {
    onFrame(active ? (t) => { if (t >= active[0] && t <= active[1]) update(t); } : update);
  }

  /** Text that types out character by character at the given times. */
  function typeAt(node, text, times) {
    onFrame((t) => {
      let count = 0;
      while (count < times.length && times[count] <= t) count++;
      const shown = text.slice(0, count);
      if (node.textContent !== shown) node.textContent = shown;
    });
  }

  /** Evenly spaced character times from `from` to `to`. */
  const spread = (text, from, to) => Array.from(text, (_, i) => from + ((to - from) * i) / Math.max(1, text.length - 1));

  // ------------------------------------------------------------------
  // Frames and the browser
  // ------------------------------------------------------------------

  /** A dark panel, optionally with an uppercase title row (like the Git song's stations). */
  function frame(parent, { x, y, w, h, className = '', title, iconName }) {
    const node = place(el('div', `nk-frame is-staged ${className}`.trim(), parent), x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    const glass = el('div', 'nk-glass', node);
    if (title) {
      const head = el('div', 'nk-frame-title', glass);
      if (iconName) head.append(icon(iconName));
      head.append(document.createTextNode(title));
    }
    return { node, glass };
  }

  /**
   * The browser window: frame, title bar with an address pill, and a page
   * that loads. type(text, times) types the address; enter(at) submits it;
   * load(at) fills the page.
   */
  function browser(parent, { x, y, w, h, url = '', pageTitle = 'Welcome' }) {
    const { node, glass } = frame(parent, { x, y, w, h, className: 'nk-browser' });
    const bar = el('div', 'nk-browser-bar', glass);
    for (let i = 0; i < 3; i++) el('span', 'nk-browser-dot', bar);
    const pill = el('div', 'nk-browser-url', bar);
    pill.append(icon('globe'));
    const address = el('span', 'nk-browser-address', pill, url);
    const caret = el('span', 'nk-browser-caret', pill);
    const page = el('div', 'nk-browser-page', glass);
    const loading = el('div', 'nk-browser-loading', page);
    const header = el('div', 'nk-page-header is-staged', page);
    el('span', 'nk-page-header-mark', header);
    el('span', 'nk-page-header-text', header, pageTitle);
    const hero = el('div', 'nk-page-hero is-staged', page);
    const rows = Array.from({ length: 3 }, (_, i) => {
      const row = el('div', 'nk-page-row is-staged', page);
      row.style.width = `${[78, 64, 70][i]}%`;
      return row;
    });
    let typingUntil = -Infinity;
    onFrame((t) => {
      caret.style.opacity = t < typingUntil && Math.floor(t * 2.6) % 2 === 0 ? '1' : '0';
    });
    return {
      node, glass, page, address,
      type(text, times) {
        typeAt(address, text, times);
        typingUntil = times[times.length - 1] + 0.9;
        return this;
      },
      enter(at) {
        tween(pill, [{ boxShadow: '0 0 0 0 rgba(255, 201, 77, 0)' }, { boxShadow: '0 0 0 3px rgba(255, 201, 77, 0.9)', offset: 0.3 }, { boxShadow: '0 0 0 0 rgba(255, 201, 77, 0)' }], at, 0.6, EASE.out);
        fx.bump(node, at, 0.03);
        return this;
      },
      load(at, duration = 0.5) {
        tween(loading, [{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1, offset: 0.85 }, { transform: 'scaleX(1)', opacity: 0 }], at, duration, EASE.inOut);
        fx.fadeIn(header, at + duration * 0.4, 0.2);
        fx.rise(hero, at + duration * 0.55, { distance: 10, duration: 0.3 });
        rows.forEach((row, i) => fx.rise(row, at + duration * 0.7 + i * 0.06, { distance: 8, duration: 0.25 }));
        return this;
      },
    };
  }

  /**
   * The client: the ornate browser window (art/client.js) with live content
   * on its screen: an address that types out and a page that loads.
   */
  function client(parent, { x, y, scale = 1, url = '', pageTitle = 'ucla.edu' }) {
    const { CLIENT } = window.NetArt;
    const { node, live } = figure(parent, { x, y, className: 'nk-client', drawing: DRAWINGS.client(), scale });
    const box = (rect, className) => {
      const div = el('div', className, node);
      Object.assign(div.style, { left: `${rect.x * scale}px`, top: `${rect.y * scale}px`, width: `${rect.w * scale}px`, height: `${rect.h * scale}px` });
      return div;
    };
    const bar = box(CLIENT.address, 'nk-client-address');
    bar.style.fontSize = `${13 * scale}px`;
    bar.style.lineHeight = `${CLIENT.address.h * scale}px`;
    bar.append(icon('globe'));
    const address = el('span', 'nk-client-url', bar, url);
    const caret = el('span', 'nk-client-caret', bar);
    // The page is laid out at the art's own size, then scaled with the window.
    const page = box(CLIENT.page, 'nk-client-page is-staged');
    Object.assign(page.style, { width: `${CLIENT.page.w}px`, height: `${CLIENT.page.h}px`, transform: `scale(${scale})` });
    const header = el('div', 'nk-page-header', page);
    el('span', 'nk-page-header-mark', header);
    el('span', 'nk-page-header-text', header, pageTitle);
    el('div', 'nk-page-hero', page);
    for (const width of [78, 64, 70]) el('div', 'nk-page-row', page).style.width = `${width}%`;
    const streak = live.querySelector('.nk-client-streak');
    let typingUntil = -Infinity;
    onFrame((t) => {
      caret.style.opacity = t < typingUntil && Math.floor(t * 2.6) % 2 === 0 ? '1' : '0';
      streak.setAttribute('transform', `translate(${(((t * 0.35) % 1) * 160 - 80).toFixed(1)} ${(Math.sin(t * 0.8) * 40).toFixed(1)})`);
    });
    return {
      node, address,
      /** The window's right edge at mid-height, where lines leave, in stage coordinates. */
      port: [x + (CLIENT.width - 10) * scale, y + (CLIENT.height / 2) * scale],
      type(text, times) {
        typeAt(address, text, times);
        typingUntil = times[times.length - 1] + 0.9;
        return this;
      },
      enter(at) {
        tween(bar, [{ boxShadow: '0 0 0 0 rgba(255, 209, 0, 0)' }, { boxShadow: '0 0 0 3px rgba(255, 209, 0, 0.95)', offset: 0.3 }, { boxShadow: '0 0 0 0 rgba(255, 209, 0, 0)' }], at, 0.6, EASE.out);
        fx.bump(node, at, 0.025);
        return this;
      },
      load(at, duration = 0.45) {
        tween(page, [{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], at, duration, EASE.out);
        return this;
      },
    };
  }

  // ------------------------------------------------------------------
  // The server castle and router islands
  // ------------------------------------------------------------------

  /** Each classed light in an overlay flickers (or twinkles and drifts) on its own cycle. */
  function animateLights(live, active) {
    const blooms = [...live.querySelectorAll('.nk-window-bloom')].map((node, i) => ({ node, rate: 1.3 + i * 0.37, phase: i * 1.1 }));
    const sparks = [...live.querySelectorAll('.nk-spark')].map((node) => {
      const seed = Number(node.dataset.seed);
      return { node, period: 1.7 + (seed % 5) * 0.53, phase: seed * 1.37 };
    });
    const gate = live.querySelector('.nk-castle-gate');
    whileActive(active, (t) => {
      for (const { node, rate, phase } of blooms) node.setAttribute('opacity', (0.72 + 0.28 * Math.sin(t * rate + phase)).toFixed(3));
      for (const { node, period, phase } of sparks) {
        const wave = 0.5 + 0.5 * Math.sin((t / period) * Math.PI * 2 + phase);
        node.setAttribute('opacity', (0.25 + 0.75 * wave).toFixed(3));
        node.setAttribute('transform', `translate(0 ${(((t / (period * 3) + phase) % 1) * -12).toFixed(2)})`);
      }
      if (gate) gate.setAttribute('opacity', (0.82 + 0.1 * Math.sin(t * 1.9) + 0.08 * Math.sin(t * 4.7 + 1.3)).toFixed(3));
    });
  }

  /**
   * The server as a castle on a floating rock (art/castle.js), after the
   * reference art. `gate` is the doorway's center in stage coordinates;
   * windowCenter(i) is the middle of window i (CASTLE.windows); closeGate(at)
   * shuts the doors (the end of a connection). `active` ([from, to]) limits
   * the flickering lights to when the castle can be seen.
   */
  function castle(parent, { x, y, scale = 1, active }) {
    const { CASTLE } = window.NetArt;
    const { node, live } = figure(parent, { x, y, className: 'nk-castle', drawing: DRAWINGS.castle(), scale });
    animateLights(live, active);
    return {
      node,
      gate: [x + CASTLE.gate[0] * scale, y + CASTLE.gate[1] * scale],
      windowCenter(i) {
        const [wx, wy, ww, wh] = CASTLE.windows[i];
        return [x + (wx + ww / 2) * scale, y + (wy + wh / 2) * scale];
      },
      closeGate(at) {
        tween(live.querySelector('.nk-castle-doors'), [{ opacity: 0 }, { opacity: 1 }], at, 0.35, EASE.inOut);
        tween(live.querySelector('.nk-castle-gate'), { opacity: 0 }, at, 0.4, EASE.inOut);
        return this;
      },
    };
  }

  /**
   * A floating router island (art/island.js): kind "router" (a crystal over
   * a carved pedestal) or "wifi" (your home Wi-Fi router, with radio arcs).
   * ping(at) flashes its beacon when a packet passes through.
   */
  function beacon(parent, { x, y, kind = 'router', label, scale = 1, active }) {
    const { ISLAND } = window.NetArt;
    const { node, live, width } = figure(parent, { x, y, className: `nk-beacon nk-beacon--${kind}`, drawing: DRAWINGS.island(kind), scale });
    const flash = el('div', `nk-beacon-flash nk-beacon-flash--${kind}`, node);
    Object.assign(flash.style, { left: `${(ISLAND.anchor[0] - 40) * scale}px`, top: `${(ISLAND.anchor[1] - 40) * scale}px`, width: `${80 * scale}px`, height: `${80 * scale}px` });
    if (label) {
      const labelNode = el('div', 'nk-beacon-label', node, label);
      labelNode.style.top = `${(ISLAND.height - 2) * scale}px`;
      labelNode.style.width = `${width + 40}px`;
    }
    const ring = live ? live.querySelector('.nk-beacon-ring') : null;
    const pings = [];
    whileActive(active, (t) => {
      let boost = 0;
      for (const at of pings) {
        const age = t - at;
        if (age >= 0 && age < 0.8) boost = Math.max(boost, 1 - age / 0.8);
      }
      flash.style.opacity = boost.toFixed(3);
      if (ring) ring.setAttribute('transform', `rotate(${(Math.sin(t * 0.9 + x) * 8).toFixed(2)} 80 44)`);
    });
    return {
      node,
      /** The beacon's top, where lines attach, in stage coordinates. */
      anchor: [x + ISLAND.anchor[0] * scale, y + ISLAND.anchor[1] * scale],
      ping(at) {
        pings.push(at);
        return this;
      },
    };
  }

  /**
   * The IMP (art/imp.js), the ARPANET's first node: its panel lamps flicker
   * with traffic from wake(at); crash(at) puts them out. `port` is where its
   * network line leaves the cabinet, in stage coordinates.
   */
  function imp(parent, { x, y, scale = 1, active }) {
    const { IMP } = window.NetArt;
    const { node, live } = figure(parent, { x, y, className: 'nk-imp', drawing: DRAWINGS.imp(), scale });
    const lamps = [...live.querySelectorAll('.nk-imp-lamp')].map((lamp) => ({ lamp, seed: Number(lamp.dataset.seed) }));
    let awake = Infinity;
    let down = Infinity;
    whileActive(active, (t) => {
      // Register lamps change four times a second: activity, not flashing.
      const step = Math.floor(t * 4);
      for (const { lamp, seed } of lamps) {
        const on = t >= awake && t < down && hash01(seed * 131 + step * 17) < 0.5;
        lamp.setAttribute('opacity', on ? '1' : '0');
      }
    });
    return {
      node,
      port: [x + IMP.port[0] * scale, y + IMP.port[1] * scale],
      wake(at) {
        awake = at;
        return this;
      },
      crash(at) {
        down = at;
        fx.bump(node, at, 0.03);
        return this;
      },
    };
  }

  /**
   * The game map (art/map.js). cell(column, row) is the middle of a grid
   * cell, both counted from 1, in stage coordinates.
   */
  function gameMap(parent, { x, y, scale = 1 }) {
    const { node } = figure(parent, { x, y, className: 'nk-map', drawing: DRAWINGS.map(), scale });
    return {
      node,
      cell(column, row) {
        const [cx, cy] = window.NetArt.cellCenter(column, row);
        return [x + cx * scale, y + cy * scale];
      },
    };
  }

  // ------------------------------------------------------------------
  // Beams of light and things that travel along them
  // ------------------------------------------------------------------

  /** A 4 px line through `points` (a smooth curve), drawn on at `at` like the Git song's arrows. */
  function beam(parent, points, { color = 'trn', at, duration = 0.6, until, bow = -40 }) {
    const node = svg('svg', { class: `nk-beam nk-beam--${color}`, viewBox: '0 0 960 540' }, parent);
    let d = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i - 1];
      const [x2, y2] = points[i];
      d += ` Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 + bow} ${x2} ${y2}`;
    }
    const core = svg('path', { class: 'nk-beam-core', d }, node);
    if (at !== undefined) {
      core.style.strokeDasharray = '1';
      core.style.strokeDashoffset = '1';
      fx.draw(core, at, duration);
    }
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return {
      node, path: core,
      /** Point at fraction p of the way along (0 = start, 1 = end). */
      pointAt(p) {
        const length = core.getTotalLength();
        const point = core.getPointAtLength(clamp(p, 0, 1) * length);
        return [point.x, point.y];
      },
    };
  }

  /**
   * Moves `node` (absolutely positioned, centered with negative margins)
   * along a beam between fractions `from` and `to`, over `duration` seconds
   * starting at `at`. Several trips can be queued on one node.
   */
  function travel(node, trips) {
    onFrame((t) => {
      const trip = [...trips].reverse().find((candidate) => t >= candidate.at) || trips[0];
      const p = easeInOutCubic(progress(t, trip.at, trip.duration));
      const [x, y] = trip.beam.pointAt(trip.from + (trip.to - trip.from) * p);
      node.style.left = `${x.toFixed(1)}px`;
      node.style.top = `${y.toFixed(1)}px`;
    });
  }

  /** A small glowing orb (a packet in flight). */
  function orb(parent, { color = 'trn', size = 16 } = {}) {
    const node = el('div', `nk-orb nk-orb--${color} is-staged`, parent);
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`;
    return node;
  }

  // ------------------------------------------------------------------
  // The packet: an HTTP message boxed by TCP, IP, and a link-layer frame
  // ------------------------------------------------------------------

  const PARCEL = { width: 236, height: 64, pad: 12, tab: 26, bottom: 9 };
  const WRAPPERS = ['transport', 'internet', 'link'];

  /**
   * Nested boxes, one per layer, each with a header tab. `http` is
   * { lines: [...] } for the innermost box; `tabs` maps each layer to its
   * header text. Wrappers start hidden: wrap(layer, at) closes a box around
   * the inside, unwrap(layer, at) lifts it off; setTab(layer, text, at)
   * relabels a header (a new link frame at every hop).
   */
  function parcel(parent, { x, y, scale = 1, http, tabs }) {
    const { width, height, pad, tab, bottom } = PARCEL;
    const outer = WRAPPERS.length;
    const node = place(el('div', 'nk-parcel', parent), x, y);
    node.style.width = `${width + 2 * pad * outer}px`;
    node.style.height = `${height + (tab + bottom) * outer}px`;
    node.style.scale = String(scale);
    const boxes = {};
    const tabTexts = {};
    // Outermost first, so inner boxes paint on top.
    [...WRAPPERS].reverse().forEach((layer) => {
      const k = WRAPPERS.indexOf(layer) + 1;
      const box = el('div', `nk-box nk-box--${LAYERS[layer].key} is-staged`, node);
      box.style.left = `${pad * (outer - k)}px`;
      box.style.top = `${tab * (outer - k)}px`;
      box.style.width = `${width + 2 * pad * k}px`;
      box.style.height = `${height + (tab + bottom) * k}px`;
      const head = el('div', 'nk-box-tab', box);
      el('span', 'nk-box-layer', head, layer === 'link' ? 'Link' : layer === 'internet' ? 'IP' : 'TCP');
      tabTexts[layer] = el('span', 'nk-box-detail', head, tabs[layer] || '');
      boxes[layer] = box;
    });
    const core = el('div', 'nk-box nk-box--app nk-box--core is-staged', node);
    core.style.left = `${pad * outer}px`;
    core.style.top = `${tab * outer}px`;
    core.style.width = `${width}px`;
    core.style.height = `${height}px`;
    const coreHead = el('div', 'nk-box-tab', core);
    el('span', 'nk-box-layer', coreHead, 'HTTP');
    tabTexts.application = el('span', 'nk-box-detail', coreHead, http.title || '');
    const body = el('div', 'nk-box-body', core);
    for (const line of http.lines) el('div', 'nk-box-line', body, line);
    boxes.application = core;
    const relabels = {};
    onFrame((t) => {
      for (const [layer, changes] of Object.entries(relabels)) {
        let text = tabs[layer] || '';
        for (const change of changes) if (change.at <= t) text = change.text;
        if (tabTexts[layer].textContent !== text) tabTexts[layer].textContent = text;
      }
    });
    return {
      node, boxes,
      show(layer, at) {
        fx.fadeIn(boxes[layer], at, 0.25);
        return this;
      },
      wrap(layer, at) {
        tween(boxes[layer], [{ opacity: 0, scale: 1.16 }, { opacity: 1, scale: 1 }], at, 0.42, EASE.out);
        return this;
      },
      unwrap(layer, at) {
        tween(boxes[layer], { opacity: 0, translate: '0 -22px', scale: 1.05 }, at, 0.38, EASE.in);
        return this;
      },
      setTab(layer, text, at) {
        (relabels[layer] = relabels[layer] || []).push({ at, text });
        relabels[layer].sort((a, b) => a.at - b.at);
        fx.bump(boxes[layer].firstChild, at, 0.08);
        return this;
      },
      /** Brightens every header tab, or the insides, between `at` and `until`. */
      highlight(part, at, until) {
        const targets = part === 'tabs' ? [...node.querySelectorAll('.nk-box-tab')] : [body];
        for (const target of targets) {
          tween(target, [{ boxShadow: '0 0 0 0 rgba(255, 255, 255, 0)' }, { boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.95), 0 0 16px rgba(255, 255, 255, 0.55)' }], at, 0.25);
          tween(target, { boxShadow: '0 0 0 0 rgba(255, 255, 255, 0)' }, until, 0.3, EASE.in);
        }
        return this;
      },
    };
  }

  // ------------------------------------------------------------------
  // Segments, timers, and header diagrams
  // ------------------------------------------------------------------

  /**
   * One transport-layer packet in flight, centered on (x, y): a header row
   * (the protocol, and for TCP its sequence number) over a payload line.
   * `protocol` is "tcp", "udp", or "ack" (an acknowledgment, which has no
   * payload). moveTo(at, [x, y]) glides it; lose(at) strikes it out where
   * it is; crack(at) marks a failed checksum; toss(at) drops it.
   */
  function segment(parent, { x, y, protocol = 'tcp', seq, body, at, iconName }) {
    const node = place(el('div', `nk-seg nk-seg--${protocol} is-staged`, parent), x, y);
    const head = el('div', 'nk-seg-head', node);
    el('span', 'nk-seg-proto', head, protocol === 'ack' ? 'ACK' : protocol.toUpperCase());
    if (seq !== undefined) el('span', 'nk-seg-seq', head, seq);
    if (iconName) head.append(icon(iconName));
    if (body !== undefined) el('div', 'nk-seg-body', node, body);
    if (at !== undefined) fx.pop(node, at, { from: 0.5 });
    return {
      node,
      moveTo(when, [tx, ty], duration = 0.5, easing = EASE.inOut) {
        tween(node, { translate: `${tx - x}px ${ty - y}px` }, when, duration, easing);
        return this;
      },
      lose(when) {
        const cross = el('div', 'nk-seg-lost is-staged', node);
        cross.append(icon('cross'));
        fx.pop(cross, when, { from: 1.8 });
        tween(node, { opacity: 0, scale: 0.7 }, when + 0.35, 0.35, EASE.in);
        return this;
      },
      crack(when) {
        const scar = svg('svg', { class: 'nk-seg-crack is-staged', viewBox: '0 0 100 40', preserveAspectRatio: 'none' }, node);
        svg('path', { d: 'M8 4L30 18L22 22L52 30L46 34L78 38' }, scar);
        fx.fadeIn(scar, when, 0.12);
        tween(node, { borderColor: '#ff6b7d' }, when, 0.15);
        return this;
      },
      toss(when) {
        tween(node, [
          { translate: '0 0', rotate: '0deg', opacity: 1 },
          { translate: '18px 120px', rotate: '38deg', opacity: 0 },
        ], when, 0.7, EASE.in);
        return this;
      },
    };
  }

  /**
   * A retransmission timer at (x, y): a ring that drains from `from` until
   * `to`, turning red as it runs out; it disappears `hold` seconds after
   * `to` (or at `stop`, when the ACK arrives in time).
   */
  function timerRing(parent, { x, y, from, to, stop, hold = 0.9, label }) {
    const node = place(el('div', 'nk-timer is-staged', parent), x, y);
    const ring = svg('svg', { class: 'nk-timer-ring', viewBox: '0 0 44 44' }, node);
    svg('circle', { class: 'nk-timer-track', cx: 22, cy: 22, r: 18 }, ring);
    const arc = svg('circle', { class: 'nk-timer-arc', cx: 22, cy: 22, r: 18, pathLength: 1, transform: 'rotate(-90 22 22)' }, ring);
    node.append(icon('timer'));
    if (label) el('span', 'nk-timer-label', node, label);
    const end = stop !== undefined ? stop : to + hold;
    fx.pop(node, from, { from: 0.6 });
    fx.popOut(node, end);
    onFrame((t) => {
      if (t < from || t > end + 0.3) return;
      const left = 1 - progress(Math.min(t, stop !== undefined ? stop : t), from, to - from);
      arc.style.strokeDashoffset = (1 - left).toFixed(3);
      node.classList.toggle('is-late', left < 0.25);
    });
    return node;
  }

  /** Header fields, one row per 32 bits, as RFC 793 (TCP) and RFC 768 (UDP) draw them. */
  const HEADERS = {
    tcp: [['source port', 'destination port'], ['sequence number'], ['acknowledgment number'], ['flags', 'window'], ['checksum', 'urgent pointer']],
    udp: [['source port', 'destination port'], ['length', 'checksum']],
  };

  /** A header diagram (HEADERS[kind]) with its title, `width` wide, at (x, y). */
  function headerDiagram(parent, { x, y, kind, width = 230, title: heading }) {
    const node = place(el('div', `nk-hdr nk-hdr--${kind} is-staged`, parent), x, y);
    node.style.width = `${width}px`;
    el('div', 'nk-hdr-title', node, heading || `${kind.toUpperCase()} header`);
    for (const row of HEADERS[kind]) {
      const line = el('div', 'nk-hdr-row', node);
      for (const field of row) el('div', 'nk-hdr-cell', line, field);
    }
    return node;
  }

  // ------------------------------------------------------------------
  // The stack
  // ------------------------------------------------------------------

  /**
   * A column of layer slabs, top to bottom (`layers` defaults to all four;
   * a router has just Internet and Link). light(layer, at, until) glows a
   * slab; slabs[layer] is its node; center(layer) its middle point.
   */
  function stack(parent, { x, y, w, slabHeight = 52, gap = 10, layers = LAYER_ORDER, title, iconName, showNames = true }) {
    const node = place(el('div', 'nk-stack is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const slabs = {};
    const glows = {};
    const top = title ? 34 : 0;
    // Rows are absolute, so a router's two slabs line up with the hosts'
    // Internet and Link rows; the title sits just above the first slab.
    const row = (layer) => LAYER_ORDER.indexOf(layer);
    if (title) {
      const head = el('div', 'nk-stack-title', node);
      head.style.top = `${row(layers[0]) * (slabHeight + gap)}px`;
      if (iconName) head.append(icon(iconName));
      head.append(document.createTextNode(title));
    }
    layers.forEach((layer) => {
      const info = LAYERS[layer];
      const slab = el('div', `nk-slab nk-slab--${info.key}`, node);
      slab.style.top = `${top + row(layer) * (slabHeight + gap)}px`;
      slab.style.height = `${slabHeight}px`;
      glows[layer] = el('div', 'nk-slab-glow is-staged', slab);
      slab.append(icon(info.iconName));
      if (showNames) el('span', 'nk-slab-name', slab, info.name);
      slabs[layer] = slab;
    });
    node.style.height = `${top + LAYER_ORDER.length * (slabHeight + gap) - gap}px`;
    return {
      node, slabs, x, y, w,
      center(layer) {
        return [x + w / 2, y + top + row(layer) * (slabHeight + gap) + slabHeight / 2];
      },
      edge(layer, side) {
        const [cx, cy] = this.center(layer);
        return [side === 'right' ? x + w : side === 'left' ? x : cx, cy];
      },
      light(layer, at, until) {
        tween(glows[layer], [{ opacity: 0 }, { opacity: 1 }], at, 0.22, EASE.out);
        fx.bump(slabs[layer], at, 0.05);
        if (until !== undefined) tween(glows[layer], { opacity: 0 }, until, 0.3, EASE.in);
        return this;
      },
    };
  }

  // ------------------------------------------------------------------
  // Sequence-diagram lanes (client ↔ server)
  // ------------------------------------------------------------------

  /** Two dashed lifelines from (leftX, top) and (rightX, top) down to `bottom`, growing in at `at`. */
  function lanes(parent, { leftX, rightX, top, bottom, at }) {
    const lines = [leftX, rightX].map((x) => {
      const line = place(el('div', 'nk-lane', parent), x, top);
      line.style.height = `${bottom - top}px`;
      tween(line, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], at, 0.5, EASE.out);
      return line;
    });
    return { lines, leftX, rightX };
  }

  /**
   * One message between the lanes: an arrow from `fromX` to `toX`, sloping
   * from y0 to y1, drawn over `duration` from `at`, with a `label` pill on
   * it. `lost: true` stops the arrow halfway and fades it out.
   */
  function message(parent, { fromX, toX, y0, y1, at, duration = 0.42, label, color = 'trn', lost = false, labelOffset = -16 }) {
    const node = svg('svg', { class: `nk-msg nk-msg--${color}${lost ? ' nk-msg--lost' : ''}`, viewBox: '0 0 960 540' }, parent);
    const endX = lost ? fromX + (toX - fromX) * 0.55 : toX;
    const endY = lost ? y0 + (y1 - y0) * 0.55 : y1;
    const line = svg('path', { class: 'nk-msg-line', d: `M ${fromX} ${y0} L ${endX} ${endY}` }, node);
    fx.draw(line, at, duration * (lost ? 0.55 : 1));
    const angle = (Math.atan2(y1 - y0, toX - fromX) * 180) / Math.PI;
    if (!lost) {
      const head = svg('path', { class: 'nk-msg-head is-staged', d: 'M 0 0 L -12 -6 L -12 6 Z', transform: `translate(${toX} ${y1}) rotate(${angle.toFixed(1)})` }, node);
      fx.fadeIn(head, at + duration - 0.06, 0.06);
    } else {
      const cross = svg('path', { class: 'nk-msg-cross is-staged', d: `M ${endX - 7} ${endY - 7} L ${endX + 7} ${endY + 7} M ${endX + 7} ${endY - 7} L ${endX - 7} ${endY + 7}` }, node);
      fx.pop(cross, at + duration * 0.55, { from: 0.3 });
    }
    let pill = null;
    if (label) {
      pill = el('div', `nk-msg-label nk-msg-label--${color} is-staged`, parent, label);
      const mx = (fromX + (lost ? endX : toX)) / 2;
      const my = (y0 + (lost ? endY : y1)) / 2 + labelOffset;
      pill.style.left = `${mx}px`;
      pill.style.top = `${my}px`;
      fx.pop(pill, at + 0.08, { from: 0.6, rotate: 0 });
    }
    return { node, pill };
  }

  /** A chat bubble (the texting metaphor), anchored at its tail. */
  function bubble(parent, { x, y, text, side = 'left', at, until, tone = 'you' }) {
    const node = place(el('div', `nk-bubble nk-bubble--${side} nk-bubble--${tone} is-staged`, parent, text), x, y);
    fx.pop(node, at, { from: 0.5, rotate: 0 });
    if (until !== undefined) fx.popOut(node, until);
    return node;
  }

  // ------------------------------------------------------------------
  // Gates, cards, labels
  // ------------------------------------------------------------------

  /** A glowing arched gate with a title and a rule underneath (the TCP/UDP gates). */
  function gate(parent, { x, y, color, title, rule, iconName }) {
    const node = place(el('div', `nk-gate nk-gate--${color} is-staged`, parent), x, y);
    art(node, `
      <defs>
        <radialGradient id="portal-{id}" cx="0.5" cy="0.62" r="0.62">
          <stop offset="0" stop-color="currentColor" stop-opacity="0.75"/>
          <stop offset="0.55" stop-color="currentColor" stop-opacity="0.22"/>
          <stop offset="1" stop-color="currentColor" stop-opacity="0.04"/>
        </radialGradient>
      </defs>
      <path d="M20 250V110a90 90 0 0 1 180 0v140z" fill="#151b2e" stroke="#4a5576" stroke-width="10"/>
      <path class="nk-gate-portal" d="M34 250V112a76 76 0 0 1 152 0v138z" fill="url(#portal-{id})"/>
      <path d="M34 250V112a76 76 0 0 1 152 0v138" fill="none" stroke="currentColor" stroke-width="2.5" stroke-opacity="0.9"/>
      <g class="nk-gate-runes" fill="none" stroke="currentColor" stroke-opacity="0.5" stroke-width="1.5" stroke-dasharray="3 7">
        <path d="M48 250V114a62 62 0 0 1 124 0v136"/>
      </g>
      <path d="M8 250h204v14H8z" fill="#3a4360"/>
    `, { viewBox: '0 0 220 268', width: 220, height: 268 });
    const sign = el('div', 'nk-gate-sign', node);
    sign.append(icon(iconName));
    sign.append(document.createTextNode(title));
    const ruleNode = el('div', 'nk-gate-rule is-staged', node, rule);
    const runes = node.querySelector('.nk-gate-runes');
    onFrame((t) => {
      runes.setAttribute('stroke-dashoffset', (-t * 14).toFixed(2));
    });
    return {
      node, rule: ruleNode,
      /** Where items fly to: the middle of the portal, in stage coordinates. */
      mouth: [x + 110, y + 170],
      light(at) {
        tween(node.querySelector('.nk-gate-portal'), [{ opacity: 0.55 }, { opacity: 1 }], at, 0.3, EASE.out);
        fx.bump(node, at, 0.04);
        return this;
      },
    };
  }

  /** A small labelled card (an app or use case) that can fly into something. */
  function card(parent, { x, y, text, iconName, color = 'white' }) {
    const node = place(el('div', `nk-card nk-card--${color} is-staged`, parent), x, y);
    if (iconName) node.append(icon(iconName));
    node.append(document.createTextNode(text));
    return {
      node,
      flyTo(at, [tx, ty], duration = 0.55) {
        const dx = tx - x;
        const dy = ty - y;
        tween(node, { translate: `${dx}px ${dy}px`, scale: 0.35, opacity: 0 }, at, duration, EASE.in);
        return this;
      },
    };
  }

  /** A label in a layer's color, e.g. a header field or a step name. */
  function tag(parent, { x, y, text, color = 'trn', at, until, mono = false }) {
    const node = place(el('div', `nk-tag nk-tag--${color}${mono ? ' nk-tag--mono' : ''} is-staged`, parent, text), x, y);
    if (at !== undefined) fx.pop(node, at, { from: 0.6 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /** One line of large title type, in the kinetic style (stage.css .kinetic). */
  function title(parent, { y, text, size = 46, color = 'gold', at, until }) {
    const node = el('div', `nk-title nk-title--${color} is-staged`, parent, text);
    node.style.top = `${y}px`;
    node.style.fontSize = `${size}px`;
    if (at !== undefined) fx.slam(node, at, { from: 1.6, duration: 0.45 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  window.NetKit = {
    LAYERS, LAYER_ORDER, art, typeAt, spread,
    frame, browser, client, castle, beacon, imp, gameMap, beam, travel, orb, parcel,
    segment, timerRing, headerDiagram, stack, lanes, message, bubble, gate, card, tag, title,
  };
})();
