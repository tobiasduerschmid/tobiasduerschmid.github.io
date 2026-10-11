/*
 * Choreography for "Unbox the Stack" (storyboard:
 * _data/songs/unbox_the_stack.yml), in the night-sky theme.
 *
 * Every visual hits a sung word: `mark(lineId, word)` is that word's time in
 * the recording. The teaching rule for the visuals: show exactly what the
 * line says, with the real mechanism behind it (the packet getting one box
 * per layer, the actual handshake messages and sequence numbers, a receive
 * buffer that sorts by number, retransmission timers, header layouts as the
 * RFCs draw them) and plausible values that stay consistent all song (the
 * laptop at 192.168.1.42, the server at 3.33.167.235). Flourishes (stickers,
 * stamps, titles, sparks) land on sung words. Each line's `visual` text in
 * the storyboard describes what this file draws for it.
 *
 * The cast, kept the same all song so it reads as one world: the student
 * (the viewer's own SE Gym hero at a laptop, student-avatar.js), the browser
 * window, the castle (the server), floating router islands joined by beams
 * of light, the nested-box packet, and the four-layer stack, coded by color
 * (Application gold, Transport cyan, Internet violet, Link green; TCP cyan
 * and UDP pink when they're compared). Client on the left, server on the
 * right, time flowing down in sequence diagrams and left to right on tracks.
 *
 * Layout: 960×540 stage; the section badge sits top-left; nothing essential
 * goes below y = 450, where the player draws captions.
 */
(function () {
  'use strict';

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.unbox_the_stack = function choreograph({ song, kit, layers, student }) {
    const net = window.NetKit;
    const { fx, tween, EASE, camera, onFrame, progress, easeInOutCubic } = window.Timeline;
    const { content, hud } = layers;
    const line = (id) => song.line(id);
    const mark = (id, word) => song.mark(id, word);

    function badge(text, sectionId) {
      kit.badge(hud, text, song.sectionStart(sectionId), song.sectionEnd(sectionId));
    }

    /** The student: the viewer's own SE Gym hero at a laptop (student-avatar.js), or just the laptop. */
    function cameo(from, to, { x, y, scale }) {
      if (student) student.appear({ from, to, x, y, scale });
    }

    /** A tag centered on (x, y), optionally with an icon in front. */
    function label(parent, text, { x, y, color = 'white', mono = false, at, until, iconName }) {
      const node = net.tag(parent, { x, y, text, color, mono, at, until });
      node.classList.add('nk-centered');
      if (iconName) node.prepend(kit.icon(iconName));
      return node;
    }

    /** Moves `node`, placed at `origin`, until that point sits on `target`. */
    function glide(node, origin, target, at, duration = 0.5, easing = EASE.inOut) {
      tween(node, { translate: `${target[0] - origin[0]}px ${target[1] - origin[1]}px` }, at, duration, easing);
    }

    /** The GET request in its HTTP box, the innermost box of every packet. */
    const GET = { title: 'request', lines: ['GET / HTTP/1.1', 'Host: ucla.edu'] };
    const LAPTOP_IP = '192.168.1.42';
    const SERVER_IP = '3.33.167.235';
    const HEADERS = {
      transport: 'port 52814 → port 80',
      internet: `${LAPTOP_IP} → ${SERVER_IP}`,
      link: 'Wi-Fi → home router',
    };

    // ----------------------------------------------------------------
    // Intro: one request, billions of machines, four layers
    // ----------------------------------------------------------------

    function intro() {
      const findAt = mark('intro-2', 'find');
      const four = mark('intro-3', 'four');
      const unbox = mark('intro-4', 'unbox');

      // You type ucla.edu, hit enter, and the page comes back.
      const a = kit.scene(content, 0, four - 0.35, { exit: 'fade' });
      const crowd = kit.el('div', 'machine-field', a); // behind the window
      const win = net.client(a, { x: 34, y: 70, scale: 1, url: '', pageTitle: 'ucla.edu' });
      fx.rise(win.node, 0.35, { distance: 26, duration: 0.6 });
      cameo(0.3, findAt - 0.1, { x: 36, y: 238, scale: 0.66 });
      kit.sticker(a, 'You', { x: 196, y: 246, at: 1.0, until: findAt - 0.2, variant: 'cyan', iconName: 'user', rotate: -4 });
      const typeAt = mark('intro-1', 'type');
      const ucla = mark('intro-1', 'ucla');
      const edu = mark('intro-1', 'edu');
      win.type('ucla.edu', [...net.spread('ucla', ucla, edu - 0.3), ...net.spread('.edu', edu, edu + 0.95)]);
      fx.bump(win.node, typeAt, 0.02);

      const server = net.castle(a, { x: 600, y: 38, scale: 0.62, active: [0, four] });
      fx.fadeIn(server.node, 0.5, 0.8);
      const enter = mark('intro-1', 'enter');
      win.enter(enter);
      const route = net.beam(a, [win.port, server.gate], { color: 'app', at: enter + 0.05, duration: 0.45, bow: -80 });
      const ball = net.orb(a, { color: 'app', size: 18 });
      fx.fadeIn(ball, enter + 0.05, 0.1);
      net.travel(ball, [
        { beam: route, from: 0, to: 1, at: enter + 0.05, duration: 0.9 },
        { beam: route, from: 1, to: 0, at: enter + 1.0, duration: 0.9 },
      ]);
      fx.fadeOut(ball, enter + 1.9, 0.15);
      const half = mark('intro-2', 'half');
      const timer = net.tag(a, { x: 470, y: 128, text: '½ second', color: 'app', at: half });
      timer.prepend(kit.icon('timer'));
      const page = mark('intro-2', 'page');
      win.load(page - 0.35, 0.45);
      camera.punch(page, 0.02);

      // How'd it find the right machine? A sky full of machines.
      const nodes = [];
      for (let i = 0; i < 46; i++) {
        const dot = kit.el('div', 'machine-dot is-staged', crowd);
        const x = 40 + window.Timeline.hash01(i * 37 + 3) * 880;
        const y = 40 + window.Timeline.hash01(i * 91 + 7) * 380;
        dot.style.left = `${x.toFixed(1)}px`;
        dot.style.top = `${y.toFixed(1)}px`;
        fx.pop(dot, findAt - 0.2 + (i % 12) * 0.035, { from: 0.2 });
        nodes.push([x, y]);
      }
      const right = mark('intro-2', 'right');
      const ring = kit.el('div', 'machine-ring is-staged', a);
      ring.style.left = `${server.gate[0].toFixed(1)}px`;
      ring.style.top = `${(server.gate[1] - 60).toFixed(1)}px`;
      ring.style.width = ring.style.height = '230px';
      ring.style.margin = '-115px 0 0 -115px';
      fx.pop(ring, right, { from: 1.8 });
      kit.sticker(a, 'Which one?', { x: 700, y: 400, at: mark('intro-2', 'machine'), variant: 'gold', iconName: 'question', rotate: -3 });
      tween(win.node, { opacity: 0.35 }, findAt - 0.2, 0.4, EASE.inOut);

      // Four layers, each solving one problem.
      const b = kit.scene(content, four - 0.3, unbox - 0.15, { exit: 'fade' });
      const layersStack = net.stack(b, { x: 300, y: 104, w: 360, slabHeight: 58, gap: 13 });
      fx.rise(layersStack.node, four - 0.25, { distance: 30, duration: 0.5 });
      const jobs = [
        ['application', 'what the apps say', 'app'],
        ['transport', 'which app gets it', 'trn'],
        ['internet', 'which machine', 'net'],
        ['link', 'the next hop', 'lnk'],
      ];
      const each = mark('intro-3', 'each');
      const problem = mark('intro-3', 'problem');
      jobs.forEach(([layer, job, color], i) => {
        const at = each + i * ((problem + 0.2 - each) / 3);
        layersStack.light(layer, mark('intro-3', 'layers') + i * 0.1, mark('intro-3', 'others') - 0.2);
        const [, cy] = layersStack.center(layer);
        net.tag(b, { x: 680, y: cy - 14, text: job, color, at });
      });
      const others = mark('intro-3', 'others');
      kit.sticker(b, 'One job each', { x: 120, y: 228, at: others, variant: 'green', iconName: 'check', rotate: -4 });

      // Let's unbox it.
      const c = kit.scene(content, unbox - 0.2, song.sectionEnd('intro') + 0.1, { exit: 'fade' });
      const box = kit.el('div', 'title-box is-staged', c);
      box.append(kit.icon('box'));
      fx.pop(box, unbox - 0.15, { from: 0.3 });
      kit.kinetic(c, [
        { text: 'Unbox', at: unbox, color: 'gold' },
        { text: 'the stack', at: unbox + 0.22 },
      ], { y: 262, size: 66 });
      const sub = kit.el('div', 'subtitle is-staged', c, 'How a request finds its server');
      sub.style.top = '352px';
      fx.fadeIn(sub, unbox + 0.45, 0.4);
      camera.punch(unbox, 0.035);
    }

    // ----------------------------------------------------------------
    // Verse 1: wrap it on the way down, hop to the server
    // ----------------------------------------------------------------

    /** Where the packet sits while it is packed (stage coordinates of its top-left). */
    const PACK = { x: 318, y: 186, scale: 1.12 };

    function verse1() {
      badge('Verse 1 · Wrap it on the way down', 'verse-1');
      const start = song.sectionStart('verse-1');
      const end = song.sectionEnd('verse-1');
      const hopAt = mark('verse-1-9', 'hop');
      const inspect = line('verse-1-11').start;

      // ---- Packing: the GET goes down the stack, one box per layer ----
      const s = kit.scene(content, start, hopAt + 0.1, { exit: 'fade' });
      const column = net.stack(s, { x: 30, y: 118, w: 200, slabHeight: 58, gap: 14 });
      fx.rise(column.node, start + 0.05, { distance: 24 });
      const win = net.browser(s, { x: 706, y: 74, w: 226, h: 138, url: 'ucla.edu', pageTitle: 'ucla.edu' });
      fx.slideIn(win.node, start + 0.1, { dx: 40 });
      win.load(start, 0.01);
      win.enter(mark('verse-1-1', 'enter'));

      const box = net.parcel(s, { x: PACK.x, y: PACK.y, scale: PACK.scale, http: GET, tabs: HEADERS });
      const get = mark('verse-1-1', 'get');
      // The HTTP box flies out of the browser.
      tween(box.boxes.application, [
        { opacity: 0, translate: '330px -120px', scale: 0.5 },
        { opacity: 1, translate: '0 0', scale: 1 },
      ], get - 0.1, 0.55, EASE.inOut);
      const transportAt = mark('verse-1-5', 'down');
      const internetAt = mark('verse-1-7', 'down');
      const linkAt = mark('verse-1-9', 'down');
      column.light('application', get - 0.1, transportAt);
      kit.sticker(s, 'HTTP request', { x: 380, y: 360, at: mark('verse-1-2', 'http'), until: mark('verse-1-3', 'routers'), variant: 'gold', iconName: 'chat', rotate: -3 });
      net.bubble(s, { x: 612, y: 222, text: '“Send me the page.”', side: 'right', tone: 'you', at: mark('verse-1-2', 'send'), until: mark('verse-1-3', 'routers') });

      // Routers can't use names: DNS looks the name up.
      const routers = mark('verse-1-3', 'routers');
      const names = mark('verse-1-3', 'names');
      const dnsAt = mark('verse-1-3', 'dns');
      const ask = net.tag(s, { x: 360, y: 92, text: 'ucla.edu ?', color: 'net', mono: true, at: routers });
      ask.prepend(kit.icon('router'));
      const nope = kit.el('div', 'route-nope is-staged', s);
      nope.append(kit.icon('cross'));
      kit.place(nope, 498, 88);
      fx.pop(nope, names, { from: 1.6 });
      kit.sticker(s, 'Routers need numbers', { x: 560, y: 96, at: names + 0.15, until: dnsAt + 0.2, variant: 'red', rotate: 4 });
      fx.fadeOut(ask, dnsAt - 0.1, 0.2);
      fx.fadeOut(nope, dnsAt - 0.1, 0.2);
      const dns = net.frame(s, { x: 312, y: 62, w: 330, h: 104, title: 'DNS · the contacts app', iconName: 'search' });
      fx.rise(dns.node, dnsAt, { distance: 14, duration: 0.35 });
      const contact = kit.el('div', 'dns-contact', dns.glass);
      const nameField = kit.el('span', 'dns-name is-staged', contact, 'ucla.edu');
      const arrow = kit.el('span', 'dns-arrow is-staged', contact, '→');
      const numberField = kit.el('span', 'dns-number is-staged', contact, SERVER_IP);
      fx.slideIn(nameField, mark('verse-1-4', 'name'), { dx: -16, duration: 0.3 });
      fx.fadeIn(arrow, mark('verse-1-4', 'ip') - 0.1, 0.2);
      fx.slideIn(numberField, mark('verse-1-4', 'out'), { dx: 16, duration: 0.3 });
      kit.sticker(s, 'name in, IP out', { x: 650, y: 238, at: mark('verse-1-4', 'contacts'), until: transportAt, variant: 'violet', iconName: 'search', rotate: 3 });

      // Transport: a TCP box with ports, so the right app gets it.
      column.light('transport', transportAt, internetAt);
      box.wrap('transport', mark('verse-1-5', 'tcp'));
      kit.sticker(s, 'header', { x: 652, y: 222, at: mark('verse-1-5', 'header'), until: mark('verse-1-6', 'right'), variant: 'cyan', iconName: 'tag', rotate: -4 });
      fx.bump(box.boxes.transport.firstChild, mark('verse-1-6', 'port'), 0.08);
      fx.bump(box.boxes.transport.firstChild, mark('verse-1-6', 'port_2'), 0.08);
      kit.sticker(s, 'Ports pick the app', { x: 690, y: 262, at: mark('verse-1-6', 'right'), until: internetAt, variant: 'cyan', iconName: 'door', rotate: 3 });

      // Internet: an IP box, from my address to the server's.
      column.light('internet', internetAt, linkAt);
      const ipAt = mark('verse-1-7', 'ip');
      box.wrap('internet', ipAt);
      const hop = kit.el('div', 'dns-fly is-staged', s, SERVER_IP);
      kit.place(hop, 486, 112);
      tween(hop, [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '-80px 96px', scale: 0.8 }], ipAt - 0.05, 0.55, EASE.inOut);
      fx.exit(dns.node, ipAt + 0.4, { dx: 0, dy: -20 });
      kit.sticker(s, 'machine → machine', { x: 650, y: 246, at: mark('verse-1-8', 'machine'), until: linkAt, variant: 'violet', iconName: 'globe', rotate: -3 });
      kit.sticker(s, 'worldwide', { x: 700, y: 290, at: mark('verse-1-8', 'worldwide'), until: linkAt, variant: 'white', iconName: 'globe', rotate: 4 });

      // Link: a Wi-Fi frame, just to the home router.
      column.light('link', linkAt, hopAt + 0.1);
      box.wrap('link', mark('verse-1-9', 'wi'));
      kit.sticker(s, 'one hop', { x: 690, y: 262, at: mark('verse-1-9', 'frame'), until: hopAt + 0.1, variant: 'green', iconName: 'wifi', rotate: 3 });

      // ---- The trip: hop by hop, a new frame at every router ----
      const tripEnd = inspect + 0.05;
      const t = kit.scene(content, hopAt - 0.1, tripEnd, { exit: 'fade' });
      const tripWin = net.client(t, { x: 16, y: 120, scale: 0.56, url: 'ucla.edu', pageTitle: 'ucla.edu' });
      fx.fadeIn(tripWin.node, hopAt - 0.1, 0.25);
      tripWin.load(hopAt - 0.1, 0.01);
      const home = net.beacon(t, { x: 262, y: 250, kind: 'wifi', label: 'Home router', scale: 0.8 });
      const mid = net.beacon(t, { x: 488, y: 150, kind: 'router', label: 'Router', scale: 0.8 });
      const server = net.castle(t, { x: 690, y: 46, scale: 0.6, active: [hopAt - 0.1, tripEnd] });
      for (const [node, delay] of [[home.node, 0.05], [mid.node, 0.15], [server.node, 0.25]]) fx.rise(node, hopAt - 0.1 + delay, { distance: 18, duration: 0.4 });
      const leg1 = net.beam(t, [tripWin.port, home.anchor], { color: 'lnk', at: hopAt - 0.05, duration: 0.35, bow: -30 });
      const leg2 = net.beam(t, [home.anchor, mid.anchor], { color: 'lnk', at: mark('verse-1-10', 'swaps'), duration: 0.35, bow: -40 });
      const leg3 = net.beam(t, [mid.anchor, server.gate], { color: 'lnk', at: mark('verse-1-10', 'sends'), duration: 0.35, bow: -40 });
      const rider = kit.el('div', 'parcel-rider', t);
      const mini = net.parcel(rider, { x: -154, y: -84.5, scale: 0.36, http: GET, tabs: HEADERS });
      for (const layer of ['application', 'transport', 'internet', 'link']) mini.show(layer, hopAt - 0.1);
      const swap1 = mark('verse-1-10', 'swaps');
      const swap2 = mark('verse-1-10', 'sends');
      net.travel(rider, [
        { beam: leg1, from: 0, to: 1, at: hopAt, duration: 0.7 },
        { beam: leg2, from: 0, to: 1, at: swap1 + 0.35, duration: 0.7 },
        { beam: leg3, from: 0, to: 1, at: swap2 + 0.35, duration: 0.7 },
      ]);
      // Each router: off with the old frame, on with a new one.
      home.ping(swap1 - 0.15);
      mid.ping(swap2 - 0.15);
      for (const [at, text] of [[swap1, 'Ethernet → router'], [swap2, 'Ethernet → server']]) {
        mini.unwrap('link', at - 0.15);
        mini.wrap('link', at + 0.12);
        mini.setTab('link', text, at + 0.12);
      }
      const frameTags = [
        [home, swap1, 'new frame: → router'],
        [mid, swap2, 'new frame: → server'],
      ];
      for (const [beaconNode, at, text] of frameTags) {
        net.tag(t, { x: beaconNode.anchor[0] - 70, y: beaconNode.anchor[1] - 92, text, color: 'lnk', at, until: at + 1.4 });
      }
      kit.sticker(t, 'Frame swapped every hop', { x: 300, y: 416, at: mark('verse-1-10', 'frame'), until: tripEnd - 0.2, variant: 'green', iconName: 'resend', rotate: -2 });
      fx.bump(server.node, mark('verse-1-10', 'further') + 0.3, 0.04);

      // ---- What's in the box: headers are labels, the payload is the stuff ----
      const i = kit.scene(content, inspect - 0.1, end + 0.15, { exit: 'fade' });
      const big = net.parcel(i, { x: 300, y: 128, scale: 1.18, http: GET, tabs: HEADERS });
      for (const layer of ['application', 'transport', 'internet', 'link']) big.show(layer, inspect - 0.1);
      const headerAt = mark('verse-1-11', 'header');
      const payload = mark('verse-1-11', 'payload');
      big.highlight('tabs', headerAt, payload - 0.1);
      kit.sticker(i, 'Headers: labels', { x: 52, y: 150, at: mark('verse-1-11', 'label'), until: payload, variant: 'cyan', iconName: 'tag', rotate: -4 });
      big.highlight('body', payload, mark('verse-1-12', 'routers'));
      kit.sticker(i, 'Payload: the stuff', { x: 52, y: 292, at: payload, until: mark('verse-1-12', 'routers'), variant: 'gold', iconName: 'box', rotate: 3 });

      // Routers only read the outer labels (Link and IP).
      const routersAt = mark('verse-1-12', 'routers');
      const scan = kit.el('div', 'router-scan is-staged', i);
      kit.place(scan, 272, 112);
      fx.fadeIn(scan, mark('verse-1-12', 'outer') - 0.1, 0.25);
      const reader = net.tag(i, { x: 708, y: 140, text: 'Router reads: Link + IP', color: 'net', at: routersAt });
      reader.prepend(kit.icon('router'));
      for (const layer of ['transport', 'application']) tween(big.boxes[layer], { opacity: 0.45 }, mark('verse-1-12', 'labels'), 0.3, EASE.inOut);

      // Too big? Split it up.
      const bigAt = mark('verse-1-12', 'big');
      const split = mark('verse-1-12', 'split');
      fx.fadeOut(scan, bigAt - 0.1, 0.2);
      tween(big.node, { opacity: 0, scale: 0.9 }, bigAt - 0.1, 0.25, EASE.in);
      fx.fadeOut(reader, bigAt - 0.1, 0.2);
      const page = kit.el('div', 'big-payload is-staged', i, 'page.html · too big for one packet');
      fx.pop(page, bigAt, { from: 0.7 });
      tween(page, { opacity: 0, scaleX: 1.2 }, split, 0.2, EASE.in);
      ['1 / 3', '2 / 3', '3 / 3'].forEach((text, n) => {
        const piece = kit.el('div', 'split-piece is-staged', i, text);
        kit.place(piece, 248 + n * 170, 230);
        tween(piece, [{ opacity: 0, translate: `${(1 - n) * 120}px 0`, scale: 0.6 }, { opacity: 1, translate: '0 0', scale: 1 }], split + 0.05 + n * 0.06, 0.35, EASE.back);
      });
    }

    // ----------------------------------------------------------------
    // Chorus: the stack — your laptop, a router, the server
    // ----------------------------------------------------------------

    const CHORUS = { stackY: 150, slab: 50, gap: 12, w: 190, laptop: 40, router: 385, server: 730 };
    const CHORUS_LINES = [
      { layer: 'link', name: 'Link Layer', purpose: 'one hop on the local network', protocols: ['Ethernet', 'Wi-Fi'], color: 'green', key: 'lnk' },
      { layer: 'internet', name: 'Internet Layer', purpose: 'machine to machine, across networks', protocols: ['IP'], color: 'violet', key: 'net' },
      { layer: 'transport', name: 'Transport Layer', purpose: 'app to app, reliable or fast', protocols: ['TCP', 'UDP'], color: 'cyan', key: 'trn' },
      { layer: 'application', name: 'Application Layer', purpose: 'the language the apps speak', protocols: ['HTTP'], color: 'gold', key: 'app' },
    ];

    function chorus(n, { title = 'Chorus', final = false } = {}) {
      const id = `chorus-${n}`;
      const ln = (i) => `${id}-${i}`;
      const from = song.sectionStart(id);
      const to = song.sectionEnd(id);
      badge(title, id);
      const s = kit.scene(content, from, to + 0.15, { exit: 'fade' });
      const { stackY, slab, gap, w } = CHORUS;
      const opts = { y: stackY, w, slabHeight: slab, gap };
      const laptop = net.stack(s, { ...opts, x: CHORUS.laptop, title: 'Your laptop', iconName: 'user' });
      const router = net.stack(s, { ...opts, x: CHORUS.router, layers: ['internet', 'link'], title: 'Router', iconName: 'router' });
      const server = net.stack(s, { ...opts, x: CHORUS.server, title: 'Server', iconName: 'castle' });
      [laptop, router, server].forEach((column, i) => fx.rise(column.node, from + 0.05 + i * 0.08, { distance: 26 }));

      const beams = kit.svg('svg', { class: 'chorus-beams', viewBox: '0 0 960 540' }, s);
      const arc = (a, b, color, at, bow = -26) => {
        const path = kit.svg('path', { class: `chorus-beam chorus-beam--${color}`, d: `M ${a[0]} ${a[1]} Q ${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 + bow} ${b[0]} ${b[1]}` }, beams);
        path.style.strokeDasharray = '1';
        path.style.strokeDashoffset = '1';
        fx.draw(path, at, 0.45);
        return path;
      };

      CHORUS_LINES.forEach((entry, i) => {
        const lineId = ln(i + 1);
        const at = line(lineId).start;
        const next = i + 1 < CHORUS_LINES.length ? line(ln(i + 2)).start : line(ln(5)).start;
        caption(s, entry, { at, until: next - 0.12, protocolsAt: protocolTimes(lineId, entry) });
        const columns = entry.layer === 'internet' || entry.layer === 'link' ? [laptop, router, server] : [laptop, server];
        for (const column of columns) column.light(entry.layer, at, line(ln(5)).start);
        // A beam between the layers that talk to each other, with its scope.
        const scopeUntil = next - 0.12;
        if (entry.layer === 'link') {
          const hopAt = mark(lineId, 'hop');
          arc(laptop.edge('link', 'right'), router.edge('link', 'left'), 'lnk', hopAt);
          arc(router.edge('link', 'right'), server.edge('link', 'left'), 'lnk', hopAt + 0.3);
          scopeTag(s, 'one hop', [307, 352], 'lnk', hopAt + 0.2, scopeUntil);
          scopeTag(s, 'one hop', [652, 352], 'lnk', hopAt + 0.5, scopeUntil);
        } else if (entry.layer === 'internet') {
          const machine = mark(lineId, 'machine');
          arc(laptop.edge('internet', 'right'), server.edge('internet', 'left'), 'net', machine, -60);
          scopeTag(s, 'machine → machine', [480, 252], 'net', mark(lineId, 'machine_2'), scopeUntil);
        } else if (entry.layer === 'transport') {
          const app = mark(lineId, 'app');
          arc(laptop.edge('transport', 'right'), server.edge('transport', 'left'), 'trn', app, -36);
          scopeTag(s, 'app ↔ app', [480, 226], 'trn', mark(lineId, 'app_2'), scopeUntil);
        } else {
          const language = mark(lineId, 'language');
          arc(laptop.edge('application', 'right'), server.edge('application', 'left'), 'app', language, -36);
          scopeTag(s, 'GET / HTTP/1.1', [480, 164], 'app', mark(lineId, 'speak'), scopeUntil, true);
        }
      });

      // Wrap it on the way down, unbox it on the way up.
      const wrapAt = mark(ln(5), 'wrap');
      const upAt = mark(ln(5), 'up');
      const wrapCaption = kit.el('div', 'chorus-caption is-staged', s);
      kit.el('div', 'chorus-caption-name', wrapCaption, 'Wrap ↓  ·  Unbox ↑');
      fx.rise(wrapCaption, wrapAt - 0.05, { distance: 12, duration: 0.3 });
      fx.fadeOut(wrapCaption, line(ln(6)).start - 0.1, 0.2);
      encapsulationRide(s, { laptop, router, server, from: wrapAt, downUntil: mark(ln(5), 'down') + 0.25, upFrom: mark(ln(5), 'unbox'), upUntil: upAt + 0.3 });

      // Each layer only uses the one below.
      const each = mark(ln(6), 'each');
      const usesAt = mark(ln(6), 'uses');
      for (const column of [laptop, server]) {
        ['application', 'transport', 'internet'].forEach((layer, i) => {
          const [cx, cy] = column.center(layer);
          const tick = kit.el('div', 'uses-arrow is-staged', s);
          tick.append(kit.icon('arrowDown'));
          kit.place(tick, cx - 11, cy + slab / 2 - 5);
          fx.pop(tick, usesAt + i * 0.12, { from: 0.4 });
        });
      }
      const rule = kit.el('div', 'chorus-caption is-staged', s);
      kit.el('div', 'chorus-caption-name', rule, 'Each layer uses only the one below');
      fx.rise(rule, each, { distance: 12, duration: 0.3 });
      const stackAt = mark(ln(6), 'stack');
      fx.fadeOut(rule, stackAt - 0.15, 0.15);
      kit.kinetic(s, [{ text: 'That’s the stack!', at: stackAt, color: 'gold' }], { y: 56, size: 50 });
      camera.punch(stackAt, 0.03);
      for (const layer of ['application', 'transport', 'internet', 'link']) {
        laptop.light(layer, stackAt, to);
        server.light(layer, stackAt, to);
      }
      if (final) {
        kit.confetti(s, { x: 300, y: 260, at: stackAt + 0.1, seed: 5 });
        kit.confetti(s, { x: 660, y: 260, at: stackAt + 0.25, seed: 9 });
      }
    }

    function protocolTimes(lineId, entry) {
      const keys = { link: ['ethernet', 'wi'], internet: ['ip'], transport: ['tcp', 'udp'], application: ['http'] }[entry.layer];
      return keys.map((key) => mark(lineId, key));
    }

    /** The chorus line on screen: layer name, its purpose, and its protocols. */
    function caption(parent, entry, { at, until, protocolsAt }) {
      const node = kit.el('div', `chorus-caption chorus-caption--${entry.key} is-staged`, parent);
      kit.el('div', 'chorus-caption-name', node, entry.name);
      const row = kit.el('div', 'chorus-caption-row', node);
      kit.el('span', 'chorus-caption-purpose', row, entry.purpose);
      entry.protocols.forEach((protocol, i) => {
        const chip = kit.el('span', `chorus-chip chorus-chip--${entry.key} is-staged`, row, protocol);
        fx.pop(chip, protocolsAt[i], { from: 0.5 });
      });
      fx.rise(node, at, { distance: 12, duration: 0.3 });
      fx.fadeOut(node, until, 0.15);
      return node;
    }

    /** A centered label on a chorus beam, e.g. "one hop" or "app ↔ app". */
    function scopeTag(parent, text, [x, y], color, at, until, mono = false) {
      const node = net.tag(parent, { x, y, text, color, at, until, mono });
      node.classList.add('scope-tag');
      return node;
    }

    /**
     * The packet riding the stacks: down your laptop's stack gaining a box per
     * layer, across through the router, up the server's stack losing them.
     */
    function encapsulationRide(parent, { laptop, router, server, from, downUntil, upFrom, upUntil }) {
      const ride = kit.el('div', 'ride is-staged', parent);
      const rings = ['app', 'trn', 'net', 'lnk'].map((key, i) => {
        const ring = kit.el('div', `ride-ring ride-ring--${key}`, ride);
        const size = 18 + i * 12;
        ring.style.width = `${size}px`;
        ring.style.height = `${size}px`;
        ring.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`;
        return ring;
      });
      const down = ['application', 'transport', 'internet', 'link'].map((layer) => laptop.edge(layer, 'right'));
      const across = [router.center('link'), router.center('internet'), router.center('link')];
      const up = ['link', 'internet', 'transport', 'application'].map((layer) => server.edge(layer, 'left'));
      const pathPoints = [...down, ...across, ...up];
      const downEnd = down.length - 1;
      const upStart = down.length + across.length;
      const total = pathPoints.length - 1;
      fx.fadeIn(ride, from, 0.15);
      fx.fadeOut(ride, upUntil, 0.2);
      onFrame((t) => {
        let position;
        if (t < downUntil) position = downEnd * easeInOutCubic(progress(t, from, downUntil - from));
        else if (t < upFrom) position = downEnd + (upStart - downEnd) * easeInOutCubic(progress(t, downUntil, upFrom - downUntil));
        else position = upStart + (total - upStart) * easeInOutCubic(progress(t, upFrom, upUntil - 0.25 - upFrom));
        const index = Math.min(total - 1, Math.floor(position));
        const f = position - index;
        const [x0, y0] = pathPoints[index];
        const [x1, y1] = pathPoints[Math.min(total, index + 1)];
        ride.style.left = `${(x0 + (x1 - x0) * f).toFixed(1)}px`;
        ride.style.top = `${(y0 + (y1 - y0) * f).toFixed(1)}px`;
        // Going down, a box per layer passed; in the router, Link is swapped
        // (Internet is read); going up, a box comes off at each layer.
        let boxes;
        if (position <= downEnd) boxes = 1 + Math.floor(position + 0.05);
        else if (position < upStart) boxes = 4;
        else boxes = 4 - Math.floor(position - upStart + 0.05);
        rings.forEach((ring, i) => { ring.style.opacity = i < boxes ? '1' : '0'; });
      });
    }

    // ----------------------------------------------------------------
    // Shared staging for the transport verses
    // ----------------------------------------------------------------

    /** Where the student sits in the transport scenes, left of the laptop's lane. */
    const SEAT = { x: 16, y: 182, scale: 0.7 };
    /** Sequence-diagram lanes: the laptop's (left) and the server's (right). */
    const LANES = { left: 252, right: 700, top: 132, bottom: 424 };
    /** The delivery stage: segments leave from LAUNCH and ride the track to the receive buffer. */
    const LAUNCH = 300;
    const TRACK = { from: 214, to: 548, data: 236, ack: 336 };
    const BUFFER = { x: 552, y: 108, w: 204 };

    /** A message between the lanes; `dir` "right" goes from the laptop to the server. */
    function say(parent, dir, y, at, text, options = {}) {
      const [fromX, toX] = dir === 'right' ? [LANES.left, LANES.right] : [LANES.right, LANES.left];
      return net.message(parent, { fromX, toX, y0: y, y1: y + 30, at, label: text, ...options });
    }

    /** A sequence-diagram scene: the student's lane on the left, the server's on the right. */
    function laneScene(from, to, { server = 'Server', serverIcon = 'castle', castle = true } = {}) {
      const s = kit.scene(content, from, to, { exit: 'fade' });
      net.lanes(s, { leftX: LANES.left, rightX: LANES.right, top: LANES.top, bottom: LANES.bottom, at: from + 0.05 });
      label(s, 'Your laptop', { x: LANES.left, y: 110, iconName: 'laptop', at: from + 0.1 });
      label(s, server, { x: LANES.right, y: 110, iconName: serverIcon, at: from + 0.15 });
      const fortress = castle ? net.castle(s, { x: 732, y: 118, scale: 0.4, active: [from, to] }) : null;
      if (fortress) fx.fadeIn(fortress.node, from + 0.1, 0.4);
      return { s, fortress };
    }

    /**
     * The delivery stage: the student (left) sends along a data track into
     * the server's receive buffer (a panel of `slots`, with a bin at the
     * bottom for tossed packets); the server castle sits behind it.
     */
    function deliveryStage(from, to, { protocol, title, slots: count, labels = [] }) {
      const s = kit.scene(content, from, to, { exit: 'fade' });
      const color = protocol === 'udp' ? 'udp' : 'trn';
      const fortress = net.castle(s, { x: 772, y: 146, scale: 0.34, active: [from, to] });
      fx.fadeIn(fortress.node, from + 0.1, 0.4);
      const panel = net.frame(s, { x: BUFFER.x, y: BUFFER.y, w: BUFFER.w, h: 104 + count * 46, title, iconName: 'box', className: `buffer-panel buffer-panel--${protocol}` });
      fx.rise(panel.node, from + 0.05, { distance: 14 });
      const slots = [];
      const holes = [];
      for (let i = 0; i < count; i++) {
        const cy = BUFFER.y + 62 + i * 46;
        const hole = kit.place(kit.el('div', 'buffer-slot is-staged', s), BUFFER.x + 12, cy - 20);
        fx.fadeIn(hole, from + 0.2, 0.2);
        holes.push(hole);
        slots.push([BUFFER.x + BUFFER.w / 2, cy]);
      }
      const bin = kit.place(kit.el('div', 'buffer-bin is-staged', s), BUFFER.x + BUFFER.w / 2 - 15, BUFFER.y + 62 + count * 46 - 6);
      bin.append(kit.icon('trash'));
      net.beam(s, [[TRACK.from, TRACK.data], [TRACK.to, TRACK.data]], { color, at: from + 0.15, duration: 0.4, bow: 0 });
      const stage = {
        s, slots, fortress, bin,
        /** Writes `text` on slot i from `at` (and removes it at `until`). */
        slotLabel(i, text, at, until) {
          const tag = kit.el('span', 'buffer-slot-label is-staged', holes[i], text);
          fx.fadeIn(tag, at, 0.2);
          if (until !== undefined) fx.fadeOut(tag, until, 0.2);
          return tag;
        },
        /** A packet that appears at the launch point (row `row`: 0 top, 1 track, 2 bottom). */
        packet(options, row = 1) {
          return net.segment(s, { x: LAUNCH, y: TRACK.data + (row - 1) * 54, protocol, ...options });
        },
        /** Sends a packet along the track into slot i from `at`; returns when it lands. */
        send(packet, { at, slot, travel = 0.45 }) {
          packet.moveTo(at, [TRACK.to - 20, TRACK.data], travel, EASE.inOut);
          packet.moveTo(at + travel, slots[slot], 0.22, EASE.out);
          return at + travel + 0.22;
        },
      };
      labels.forEach((text, i) => stage.slotLabel(i, text, from + 0.25));
      return stage;
    }

    // ----------------------------------------------------------------
    // Verse 2: TCP plays it safe
    // ----------------------------------------------------------------

    function verse2() {
      badge('Verse 2 · TCP plays it safe', 'verse-2');
      const start = song.sectionStart('verse-2');
      const end = song.sectionEnd('verse-2');
      const shake = line('verse-2-3').start;
      const bytes = line('verse-2-6').start;
      const done = line('verse-2-10').start;
      const cost = line('verse-2-11').start;
      twoVibes(start, shake);
      cameo(shake + 0.1, cost - 0.3, SEAT);
      tcpHandshake(shake - 0.15, bytes - 0.05);
      tcpDelivery(bytes - 0.1, done + 0.15);
      tcpGoodbye(done - 0.05, cost + 0.05);
      tcpPrice(cost - 0.1, end + 0.15);
    }

    /** A protocol's emblem: icon and name, its motto, and the Node.js call that picks it. */
    function vibe(parent, { x, y, name, rule, code, iconName, color, at, ruleAt }) {
      const node = kit.place(kit.el('div', `vibe vibe--${color} is-staged`, parent), x, y);
      const head = kit.el('div', 'vibe-name', node);
      head.append(kit.icon(iconName), document.createTextNode(name));
      const motto = kit.el('div', 'vibe-rule is-staged', node, rule);
      const call = kit.el('div', 'vibe-code is-staged', node, code);
      fx.slam(node, at, { from: 1.7 });
      fx.pop(motto, ruleAt, { from: 0.6, rotate: -3 });
      fx.rise(call, ruleAt + 0.25, { distance: 8, duration: 0.3 });
      return node;
    }

    /** "Transport's got two vibes. Your app picks the path: TCP plays it safe. UDP plays it fast." */
    function twoVibes(from, to) {
      const s = kit.scene(content, from, to, { exit: 'fade' });
      kit.kinetic(s, [
        { text: 'Transport', at: mark('verse-2-1', 'transport'), color: 'cyan' },
        { text: 'has two vibes', at: mark('verse-2-1', 'two') },
      ], { y: 54, size: 44 });
      label(s, 'Your app', { x: 480, y: 150, iconName: 'laptop', at: mark('verse-2-1', 'app') });
      const safeRoad = net.beam(s, [[480, 168], [258, 258]], { at: mark('verse-2-1', 'picks'), duration: 0.45, bow: -8 });
      const fastRoad = net.beam(s, [[480, 168], [702, 258]], { color: 'udp', at: mark('verse-2-1', 'path'), duration: 0.45, bow: -8 });
      const tcpAt = mark('verse-2-2', 'tcp');
      const udpAt = mark('verse-2-2', 'udp');
      vibe(s, { x: 258, y: 334, name: 'TCP', rule: 'plays it safe', code: 'net.connect()', iconName: 'shield', color: 'tcp', at: tcpAt, ruleAt: mark('verse-2-2', 'safe') });
      vibe(s, { x: 702, y: 334, name: 'UDP', rule: 'plays it fast', code: "dgram.createSocket('udp4')", iconName: 'bolt', color: 'udp', at: udpAt, ruleAt: mark('verse-2-2', 'fast') });
      // One packet takes the safe road under escort; three dart down the fast one.
      const escorted = net.orb(s, { size: 16 });
      escorted.classList.add('vibe-escort');
      fx.fadeIn(escorted, tcpAt, 0.2);
      net.travel(escorted, [{ beam: safeRoad, from: 0, to: 0.9, at: tcpAt, duration: 2.4 }]);
      [0, 0.2, 0.4].forEach((delay) => {
        const dart = net.orb(s, { color: 'udp', size: 12 });
        fx.fadeIn(dart, udpAt + delay, 0.06);
        net.travel(dart, [{ beam: fastRoad, from: 0, to: 0.9, at: udpAt + delay, duration: 0.4 }]);
        fx.fadeOut(dart, udpAt + delay + 0.4, 0.12);
      });
    }

    /**
     * "TCP shakes hands first, three steps in a row: SYN, SYN-ACK, ACK. Let's
     * go. SYN means sync: both sides share where their count begins."
     */
    function tcpHandshake(from, to) {
      const { s, fortress } = laneScene(from, to);
      kit.sticker(s, 'Handshake first', { x: 384, y: 54, at: mark('verse-2-3', 'shakes'), until: mark('verse-2-5', 'sync') - 0.1, variant: 'cyan', iconName: 'shield', rotate: -3 });
      const steps = [
        { dir: 'right', y: 172, word: 'syn', name: 'SYN', text: '“you up?”', numbers: 'seq 100', numbersAt: mark('verse-2-5', 'both') },
        { dir: 'left', y: 254, word: 'syn_2', name: 'SYN-ACK', text: '“yeah, you?”', numbers: 'seq 300 · ack 101', numbersAt: mark('verse-2-5', 'share') },
        { dir: 'right', y: 336, word: 'ack_2', name: 'ACK', text: '“bet.”', numbers: 'ack 301', numbersAt: mark('verse-2-5', 'count') },
      ];
      steps.forEach((step, i) => {
        const at = mark('verse-2-4', step.word);
        const fromLeft = step.dir === 'right';
        say(s, step.dir, step.y, at, step.name, { duration: 0.36 });
        net.bubble(s, { x: fromLeft ? LANES.left + 12 : LANES.right - 12, y: step.y - 42, text: step.text, side: fromLeft ? 'left' : 'right', tone: fromLeft ? 'you' : 'server', at: at + 0.04 });
        // "Three steps": a numbered marker on each sender's lane.
        const count = label(s, String(i + 1), { x: fromLeft ? LANES.left - 22 : LANES.right + 22, y: step.y, color: 'trn', at: mark('verse-2-3', 'three') + i * 0.12 });
        count.classList.add('step-number');
        // Line 5: the starting counts each side shares (and confirms).
        label(s, step.numbers, { x: 476, y: step.y + 34, color: 'trn', mono: true, at: step.numbersAt });
      });
      const go = mark('verse-2-4', 'go');
      kit.sticker(s, 'Connected!', { x: 418, y: 404, at: go, variant: 'green', iconName: 'check', rotate: -3 });
      fx.bump(fortress.node, go, 0.04);
      kit.sticker(s, 'SYN = synchronize', { x: 384, y: 54, at: mark('verse-2-5', 'sync'), variant: 'cyan', iconName: 'transfer', rotate: 3 });
    }

    /**
     * "Every byte is numbered and sorted at the end. What lands gets ACKed …
     * No ACK in time? Resend that piece. Broken checksum? Tossed, no ACK, so
     * it's sent once more." Bytes 101 on, after the handshake's seq 100.
     */
    function tcpDelivery(from, to) {
      const stage = deliveryStage(from, to, { protocol: 'tcp', title: 'Receive buffer', slots: 3 });
      const { s, slots, fortress, bin } = stage;
      net.beam(s, [[TRACK.to, TRACK.ack], [TRACK.from, TRACK.ack]], { color: 'lnk', at: from + 0.25, duration: 0.4, bow: 0 });

      // Every byte is numbered; the buffer keeps a place for each number.
      const sorted = mark('verse-2-6', 'sorted');
      const handOver = mark('verse-2-6', 'end');
      ['seq 101', 'seq 201', 'seq 301'].forEach((text, i) => stage.slotLabel(i, text, mark('verse-2-6', 'numbered'), handOver));
      const leave = mark('verse-2-6', 'numbered');
      const pieces = [
        { seq: 'seq 101', body: 'bytes 101–200', row: 0, slot: 0, leave: leave + 0.12, travel: 0.55 },
        { seq: 'seq 201', body: 'bytes 201–300', row: 1, slot: 1, leave: leave + 0.06, travel: 0.45 },
        { seq: 'seq 301', body: 'bytes 301–400', row: 2, slot: 2, leave, travel: 0.32 },
      ].map((piece, i) => {
        const packet = stage.packet({ seq: piece.seq, body: piece.body, at: mark('verse-2-6', 'every') + i * 0.08 }, piece.row);
        fx.bump(packet.node.firstChild, mark('verse-2-6', 'byte') + i * 0.06, 0.12);
        stage.send(packet, { at: piece.leave, slot: piece.slot, travel: piece.travel });
        return packet;
      });
      kit.sticker(s, 'Sorted by number', { x: 560, y: 392, at: sorted, until: handOver + 0.8, variant: 'cyan', iconName: 'stack', rotate: -3 });
      // Then the app gets them, in order.
      pieces.forEach((packet, i) => {
        packet.moveTo(handOver + i * 0.12, fortress.gate, 0.38, EASE.in);
        tween(packet.node, { opacity: 0, scale: 0.4 }, handOver + i * 0.12 + 0.2, 0.2, EASE.in);
      });
      label(s, 'to the app, in order', { x: 830, y: 398, color: 'trn', iconName: 'check', at: handOver + 0.2, until: mark('verse-2-8', 'no') - 0.2 });

      // What lands gets ACKed: "got everything up to byte 400, send 401 next."
      const acked = mark('verse-2-7', 'acked');
      const receipt = net.segment(s, { x: TRACK.to - 30, y: TRACK.ack, protocol: 'ack', seq: 'ack 401', at: acked - 0.2 });
      receipt.moveTo(acked, [LAUNCH - 20, TRACK.ack], 0.55);
      fx.fadeOut(receipt.node, mark('verse-2-8', 'no') - 0.25, 0.2);
      label(s, 'got it all up to 400', { x: 386, y: TRACK.ack + 34, color: 'lnk', at: mark('verse-2-7', 'got'), until: mark('verse-2-8', 'no') - 0.25 });
      const read = label(s, 'Read ✓✓', { x: 252, y: TRACK.ack - 30, color: 'lnk', at: mark('verse-2-7', 'read'), until: mark('verse-2-8', 'no') - 0.25 });
      fx.bump(read, mark('verse-2-7', 'receipt'), 0.15);

      // No ACK in time: left on read, so that piece goes again.
      const no = mark('verse-2-8', 'no');
      const left = mark('verse-2-8', 'left');
      stage.slotLabel(0, 'seq 401', no - 0.2, mark('verse-2-8', 'piece') + 0.1);
      const lost = stage.packet({ seq: 'seq 401', body: 'bytes 401–500', at: no - 0.25 });
      lost.moveTo(no, [430, TRACK.data], 0.4, EASE.out);
      lost.lose(no + 0.42);
      net.timerRing(s, { x: 236, y: 150, from: no + 0.05, to: left, label: 'waiting for ACK' });
      kit.sticker(s, 'Left on read', { x: 272, y: 88, at: left, until: mark('verse-2-8', 'piece'), variant: 'red', iconName: 'eye', rotate: -4 });
      const resend = mark('verse-2-8', 'resend');
      const again = stage.packet({ seq: 'seq 401', body: 'bytes 401–500', iconName: 'resend', at: resend - 0.2 });
      const landed = stage.send(again, { at: resend, slot: 0, travel: 0.32 });
      fx.bump(again.node, mark('verse-2-8', 'piece'), 0.1);
      const ack501 = net.segment(s, { x: TRACK.to - 30, y: TRACK.ack, protocol: 'ack', seq: 'ack 501', at: landed });
      ack501.moveTo(landed + 0.05, [LAUNCH - 20, TRACK.ack], 0.45);
      fx.fadeOut(ack501.node, landed + 0.7, 0.2);

      // Broken checksum: tossed, so no ACK, so it's sent once more.
      const broken = mark('verse-2-9', 'broken');
      const checksum = mark('verse-2-9', 'checksum');
      const tossed = mark('verse-2-9', 'tossed');
      stage.slotLabel(1, 'seq 501', broken - 0.2);
      const bad = stage.packet({ seq: 'seq 501', body: 'bytes 501–600', at: broken - 0.2 });
      stage.send(bad, { at: broken, slot: 1, travel: Math.max(0.2, checksum - broken - 0.24) });
      bad.crack(checksum);
      label(s, 'checksum ✗', { x: BUFFER.x - 62, y: slots[1][1], color: 'red', mono: true, at: checksum + 0.04, until: tossed + 0.3 });
      fx.pop(bin, tossed - 0.15, { from: 0.5 });
      bad.toss(tossed);
      net.timerRing(s, { x: 236, y: 150, from: broken + 0.05, to: mark('verse-2-9', 'ack'), label: 'no ACK' });
      const sent = mark('verse-2-9', 'sent');
      const fixed = stage.packet({ seq: 'seq 501', body: 'bytes 501–600', iconName: 'resend', at: sent - 0.2 });
      stage.send(fixed, { at: sent, slot: 1, travel: 0.3 });
      fx.bump(fixed.node, mark('verse-2-9', 'more') + 0.2, 0.1);
    }

    /** "Done? FIN, FIN-ACK, ACK: free the memory, close the door." */
    function tcpGoodbye(from, to) {
      const { s, fortress } = laneScene(from, to);
      kit.sticker(s, 'Done? Say bye', { x: 384, y: 54, at: mark('verse-2-10', 'done'), variant: 'cyan', iconName: 'shield', rotate: -3 });
      say(s, 'right', 176, mark('verse-2-10', 'fin'), 'FIN', { duration: 0.3 });
      say(s, 'left', 242, mark('verse-2-10', 'fin_2'), 'FIN-ACK', { duration: 0.3 });
      say(s, 'right', 308, mark('verse-2-10', 'ack_2'), 'ACK', { duration: 0.3 });
      // Each side's connection memory (counts, buffers) is freed.
      const free = mark('verse-2-10', 'free');
      [LANES.left + 84, LANES.right - 84].forEach((x) => {
        const memory = label(s, 'connection memory', { x, y: 376, color: 'white', iconName: 'chip', at: from + 0.3 });
        tween(memory, { opacity: 0, scale: 0.6 }, free, 0.3, EASE.in);
        label(s, 'freed', { x, y: 376, color: 'lnk', iconName: 'check', at: free + 0.32 });
      });
      fortress.closeGate(mark('verse-2-10', 'close'));
      label(s, 'door closed', { x: 828, y: 404, color: 'white', iconName: 'door', at: mark('verse-2-10', 'door') });
    }

    /**
     * "But safe has a price. Here's what you pay: a round trip of hellos
     * before your data's on its way, extra ACKs along the way, and one lost
     * piece holds up the line. The rest has to wait."
     */
    function tcpPrice(from, to) {
      const s = kit.scene(content, from, to, { exit: 'fade' });
      kit.kinetic(s, [
        { text: 'Safe', at: mark('verse-2-11', 'safe'), color: 'cyan', iconName: 'shield' },
        { text: 'has a price', at: mark('verse-2-11', 'price') },
      ], { y: 48, size: 44 });
      // The bill, item by item, each next to a picture of what it costs.
      const bill = kit.place(kit.el('div', 'receipt is-staged', s), 40, 118);
      kit.el('div', 'receipt-title', bill, 'Receipt · TCP');
      fx.rise(bill, mark('verse-2-11', 'pay'), { distance: 24 });
      [
        { at: mark('verse-2-12', 'round'), what: '1 round trip of hellos', why: 'before any data moves' },
        { at: mark('verse-2-13', 'extra'), what: 'Extra ACKs', why: 'more packets on the wire' },
        { at: mark('verse-2-14', 'lost'), what: 'One lost piece', why: 'blocks the pieces behind it' },
      ].forEach(({ at, what, why }) => {
        const row = kit.el('div', 'receipt-row is-staged', bill);
        kit.el('div', 'receipt-what', row, what);
        kit.el('div', 'receipt-why', row, why);
        fx.slideIn(row, at, { dx: -14, duration: 0.3 });
      });
      const total = kit.el('div', 'receipt-total is-staged', bill);
      total.append(kit.icon('hourglass'), document.createTextNode('Total: time'));
      fx.pop(total, mark('verse-2-14', 'wait'), { from: 0.6, rotate: -2 });

      // Time runs left to right in each picture.
      const axis = kit.place(kit.el('div', 'price-axis is-staged', s), 420, 412);
      kit.el('span', 'price-axis-label', axis, 'time →');
      fx.fadeIn(axis, mark('verse-2-12', 'round') - 0.2, 0.3);

      // 1. A round trip of hellos before the data leaves.
      const rowA = 190;
      label(s, 'SYN →', { x: 470, y: rowA, color: 'trn', mono: true, at: mark('verse-2-12', 'round') });
      label(s, '← SYN-ACK', { x: 572, y: rowA, color: 'trn', mono: true, at: mark('verse-2-12', 'trip') });
      const brace = kit.place(kit.el('div', 'price-brace is-staged', s), 432, rowA + 18);
      kit.el('span', 'price-brace-label', brace, '1 round trip, no data yet');
      fx.fadeIn(brace, mark('verse-2-12', 'hellos'), 0.25);
      const dataGo = label(s, 'ACK + data →', { x: 762, y: rowA, color: 'app', mono: true, at: mark('verse-2-12', 'data') });
      fx.bump(dataGo, mark('verse-2-12', 'way'), 0.12);

      // 2. Extra ACKs: one back for what arrives.
      const rowB = 270;
      const extra = mark('verse-2-13', 'extra');
      for (let k = 0; k < 6; k++) {
        const isAck = k % 2 === 1;
        label(s, isAck ? '← ACK' : 'data →', { x: 466 + k * 76, y: rowB, color: isAck ? 'lnk' : 'trn', mono: true, at: extra + k * 0.28 });
      }

      // 3. One lost piece holds up the line: the app waits for it.
      const rowC = 350;
      const lostAt = mark('verse-2-14', 'lost');
      const holds = mark('verse-2-14', 'holds');
      const gap = label(s, '1 ?', { x: 462, y: rowC, color: 'red', mono: true, at: lostAt });
      gap.classList.add('is-missing');
      const waiting = [2, 3, 4].map((n, i) => {
        const piece = label(s, String(n), { x: 528 + i * 58, y: rowC, color: 'trn', mono: true, at: mark('verse-2-14', 'piece') + i * 0.08 });
        piece.classList.add('is-square');
        const sand = kit.place(kit.el('div', 'price-wait is-staged', s), 528 + i * 58 - 9, rowC - 40);
        sand.append(kit.icon('hourglass'));
        fx.pop(sand, holds + i * 0.08, { from: 0.4 });
        return piece;
      });
      const app = label(s, 'App: waiting…', { x: 812, y: rowC, color: 'white', iconName: 'hourglass', at: holds + 0.15 });
      label(s, 'head-of-line blocking', { x: 624, y: rowC + 36, color: 'red', at: mark('verse-2-14', 'line') });
      waiting.forEach((piece, i) => fx.bump(piece, mark('verse-2-14', 'rest') + i * 0.06, 0.15));
      fx.bump(app, mark('verse-2-14', 'wait'), 0.1);
    }

    // ----------------------------------------------------------------
    // Verse 3: UDP plays it fast
    // ----------------------------------------------------------------

    function verse3() {
      badge('Verse 3 · UDP plays it fast', 'verse-3');
      const start = song.sectionStart('verse-3');
      const end = song.sectionEnd('verse-3');
      const plan = line('verse-3-5').start;
      const call = line('verse-3-7').start;
      const dns = line('verse-3-9').start;
      cameo(start + 0.25, plan - 0.3, SEAT);
      udpDelivery(start, plan + 0.05);
      udpGame(plan - 0.1, call + 0.05);
      udpCall(call - 0.05, dns + 0.05);
      cameo(dns + 0.1, end - 0.15, SEAT);
      udpLookup(dns - 0.05, end + 0.15);
    }

    /**
     * "UDP skips the hello. The first packet's data. Tiny header, no
     * connection, nothing to remember later. No numbers, so no order. No
     * ACKs, so no resend. Broken checksum? Tossed. Lost? Gone." The same
     * stage as TCP's delivery, so the differences stand out.
     */
    function udpDelivery(from, to) {
      const stage = deliveryStage(from, to, { protocol: 'udp', title: 'Server inbox', slots: 4 });
      const { s, slots, bin } = stage;

      // No hello: the handshake TCP needs is crossed out.
      const skips = mark('verse-3-1', 'skips');
      const hello = mark('verse-3-1', 'hello');
      const first = mark('verse-3-1', 'first');
      const ghost = kit.place(kit.el('div', 'ghost-shake is-staged', s), 262, 148);
      for (const step of ['SYN', 'SYN-ACK', 'ACK']) kit.el('span', 'ghost-step', ghost, step);
      const strike = kit.el('div', 'ghost-strike is-staged', ghost);
      fx.fadeIn(ghost, skips - 0.1, 0.2);
      tween(strike, [{ opacity: 1, transform: 'scaleX(0)' }, { opacity: 1, transform: 'scaleX(1)' }], hello, 0.25, EASE.out);
      fx.fadeOut(ghost, first - 0.15, 0.25);
      kit.sticker(s, 'No hello', { x: 384, y: 54, at: hello, until: mark('verse-3-2', 'tiny') - 0.1, variant: 'pink', iconName: 'cross', rotate: -4 });
      // The very first packet is data.
      const opener = stage.packet({ body: 'data!', at: first - 0.25 });
      const opened = stage.send(opener, { at: first, slot: 0, travel: 0.5 });
      kit.sticker(s, '1st packet = data', { x: 286, y: 290, at: opened, until: mark('verse-3-2', 'tiny') - 0.1, variant: 'pink', iconName: 'bolt', rotate: 3 });

      // Tiny header: UDP's two rows against TCP's five.
      const tiny = mark('verse-3-2', 'tiny');
      const clear2 = mark('verse-3-3', 'numbers') - 0.3;
      const tcpHeader = net.headerDiagram(s, { x: 226, y: 112, kind: 'tcp', width: 300 });
      const udpHeader = net.headerDiagram(s, { x: 226, y: 290, kind: 'udp', width: 300 });
      fx.rise(tcpHeader, tiny - 0.05, { distance: 12, duration: 0.3 });
      fx.rise(udpHeader, mark('verse-3-2', 'header'), { distance: 12, duration: 0.3 });
      kit.sticker(s, 'tiny!', { x: 468, y: 386, at: mark('verse-3-2', 'header') + 0.15, until: clear2, variant: 'pink', rotate: 8 });
      for (const node of [tcpHeader, udpHeader]) fx.fadeOut(node, clear2, 0.25);
      label(s, 'no connection', { x: 376, y: 404, color: 'udp', iconName: 'link', at: mark('verse-3-2', 'connection'), until: clear2 });
      const forget = label(s, 'remembers nothing', { x: 830, y: 404, color: 'white', iconName: 'chip', at: mark('verse-3-2', 'nothing'), until: clear2 });
      fx.bump(forget, mark('verse-3-2', 'remember'), 0.12);
      fx.fadeOut(opener.node, clear2, 0.25);

      // No numbers, so no order: "see you soon" arrives as "soon you see".
      const numbers = mark('verse-3-3', 'numbers');
      const order = mark('verse-3-3', 'order');
      const clear3 = mark('verse-3-4', 'broken') - 0.15;
      [
        { body: 'see', row: 0, slot: 2, leave: numbers + 0.1, travel: 0.6 },
        { body: 'you', row: 1, slot: 1, leave: numbers + 0.05, travel: 0.48 },
        { body: 'soon', row: 2, slot: 0, leave: numbers, travel: 0.36 },
      ].forEach((word, i) => {
        const packet = stage.packet({ body: word.body, at: numbers - 0.2 + i * 0.05 }, word.row);
        stage.send(packet, { at: word.leave, slot: word.slot, travel: word.travel });
        fx.fadeOut(packet.node, clear3, 0.2);
      });
      kit.sticker(s, 'no numbers', { x: 270, y: 92, at: numbers + 0.1, until: clear3, variant: 'pink', iconName: 'cross', rotate: -4 });
      kit.sticker(s, 'no order', { x: 560, y: 412, at: order, until: clear3, variant: 'pink', iconName: 'cross', rotate: 3 });
      net.bubble(s, { x: 930, y: 104, text: '“soon you see?”', side: 'right', tone: 'server', at: order + 0.1, until: clear3 });
      // No ACKs, so no resend: there is no way back.
      const ghostAck = net.beam(s, [[TRACK.to, TRACK.ack], [TRACK.from, TRACK.ack]], { color: 'dim', at: mark('verse-3-3', 'acks') - 0.1, duration: 0.3, bow: 0, until: clear3 });
      ghostAck.node.classList.add('is-ghost');
      label(s, 'no ACKs', { x: 382, y: TRACK.ack, color: 'red', iconName: 'cross', at: mark('verse-3-3', 'acks'), until: clear3 });
      label(s, 'no resend', { x: 382, y: TRACK.ack + 44, color: 'red', iconName: 'resend', at: mark('verse-3-3', 'resend'), until: clear3 });

      // Broken checksum? Tossed. Lost? Gone.
      const broken = mark('verse-3-4', 'broken');
      const tossed = mark('verse-3-4', 'tossed');
      const bad = stage.packet({ body: 'brb', at: broken - 0.1 });
      const badLanded = stage.send(bad, { at: broken, slot: 3, travel: Math.max(0.2, tossed - broken - 0.45) });
      bad.crack(badLanded);
      fx.pop(bin, tossed - 0.15, { from: 0.5 });
      bad.toss(tossed);
      label(s, 'checksum ✗', { x: BUFFER.x - 62, y: slots[3][1], color: 'red', mono: true, at: badLanded, until: tossed + 0.3 });
      const lostAt = mark('verse-3-4', 'lost');
      const gone = stage.packet({ body: 'gg', at: lostAt - 0.25 }, 0);
      gone.moveTo(lostAt - 0.05, [430, TRACK.data], 0.32, EASE.out);
      gone.lose(lostAt + 0.25);
      kit.stamp(s, 'Gone', { x: 300, y: 300, at: mark('verse-3-4', 'gone'), color: 'red', rotate: -8 });
      kit.sticker(s, 'No retry. The end.', { x: 270, y: 92, at: mark('verse-3-4', 'end'), variant: 'white', iconName: 'cross', rotate: -3 });
    }

    /**
     * "So if losing one would hurt, your app needs a plan: send 'I'm at x, y,'
     * not 'I moved.' The next one shows where you stand." Two maps, the same
     * three updates, the same lost middle one.
     */
    function udpGame(from, to) {
      const s = kit.scene(content, from, to, { exit: 'fade' });
      kit.sticker(s, 'Lose one?', { x: 384, y: 54, at: mark('verse-3-5', 'losing'), until: mark('verse-3-5', 'plan') - 0.1, variant: 'pink', iconName: 'warning', rotate: -3 });
      kit.sticker(s, 'Plan for it: send where you are', { x: 300, y: 54, at: mark('verse-3-5', 'plan'), variant: 'gold', iconName: 'pin', rotate: 2 });
      const send = mark('verse-3-6', 'send');
      const xAt = mark('verse-3-6', 'x');
      const moved = mark('verse-3-6', 'moved');
      const next = mark('verse-3-6', 'next');
      const shows = mark('verse-3-6', 'shows');
      const stand = mark('verse-3-6', 'stand');
      const boards = [
        {
          x: 214, title: 'send “I’m at (x, y)”', good: true, titleAt: send,
          updates: [
            { text: 'at (2, 2)', at: send, cell: [2, 2] },
            { text: 'at (3, 2)', at: xAt, lost: true },
            { text: 'at (4, 2)', at: next, cell: [4, 2], lands: shows },
          ],
        },
        {
          x: 588, title: 'send “I moved →”', good: false, titleAt: moved,
          updates: [
            { text: 'moved →', at: send + 0.25, cell: [2, 2] },
            { text: 'moved →', at: xAt + 0.25, lost: true },
            { text: 'moved →', at: next + 0.05, cell: [3, 2], lands: shows + 0.05 },
          ],
        },
      ];
      const scale = 1.06;
      boards.forEach((board, b) => {
        const map = net.gameMap(s, { x: board.x, y: 128, scale });
        fx.rise(map.node, from + 0.05 + b * 0.1, { distance: 16 });
        const title = label(s, board.title, { x: board.x + 159, y: 108, color: board.good ? 'lnk' : 'red', mono: true, at: board.titleAt });
        title.classList.add('game-title');
        const start = map.cell(1, 2);
        const token = kit.place(kit.el('div', 'game-token', s), start[0], start[1]);
        token.append(kit.icon('user'));
        fx.pop(token, from + 0.25, { from: 0.4 });
        let position = start;
        board.updates.forEach((update, k) => {
          // The update as it arrives, logged under the map.
          const slot = [board.x + 56 + k * 104, 372];
          const entry = label(s, update.text, { x: slot[0], y: slot[1], color: update.lost ? 'red' : 'udp', mono: true, at: update.at });
          if (update.lost) {
            entry.classList.add('is-lost');
            const cross = kit.place(kit.el('div', 'game-lost is-staged', s), slot[0] + 30, slot[1] - 30);
            cross.append(kit.icon('cross'));
            fx.pop(cross, update.at + 0.15, { from: 1.6 });
            return;
          }
          const target = map.cell(...update.cell);
          glide(token, start, target, (update.lands || update.at) + 0.05, 0.35, EASE.out);
          position = target;
        });
        // Where the player really is: the next update fixes the absolute
        // map; the relative one stays off by one, for good.
        if (board.good) {
          label(s, 'back in sync', { x: position[0], y: position[1] - 34, color: 'lnk', iconName: 'check', at: stand });
        } else {
          const truth = map.cell(4, 2);
          const ghost = kit.place(kit.el('div', 'game-token game-token--ghost is-staged', s), truth[0], truth[1]);
          ghost.append(kit.icon('user'));
          fx.pop(ghost, stand - 0.15, { from: 0.5 });
          label(s, 'off by one, forever', { x: truth[0] - 24, y: truth[1] + 40, color: 'red', iconName: 'warning', at: stand });
        }
      });
    }

    /**
     * "Why use it? On a live call, late is as bad as lost: resend a voice
     * packet, and it lands after the word is gone." The voice plays at a
     * steady playhead; the resent word arrives after it has gone by.
     */
    function udpCall(from, to) {
      const s = kit.scene(content, from, to, { exit: 'fade' });
      const call = net.frame(s, { x: 150, y: 92, w: 660, h: 104, className: 'call-card' });
      fx.rise(call.node, mark('verse-3-7', 'why') - 0.05, { distance: 14 });
      const person = (name, className) => {
        const node = kit.el('div', `call-person ${className}`, call.glass);
        node.append(kit.icon('user'));
        kit.el('span', 'call-name', node, name);
      };
      person('You', 'call-person--you');
      const wave = kit.el('div', 'call-wave', call.glass);
      const bars = Array.from({ length: 34 }, () => kit.el('span', 'call-bar', wave));
      person('Friend', 'call-person--friend');
      const clock = kit.el('div', 'call-clock', call.glass);
      clock.prepend(kit.icon('phone'));
      const clockText = kit.el('span', 'call-clock-time', clock, 'LIVE 0:42');

      // The friend's voice, word by word, played as the playhead reaches it.
      const TRACK_Y = 262;
      const words = ['can', 'you', 'hear', 'me', 'now?'];
      const slotX = (i) => 236 + i * 118;
      const lostWord = 2;
      const lostAt = mark('verse-3-7', 'lost');
      const speed = 130;
      const t0 = lostAt - (slotX(lostWord) - 168) / speed;
      const rail = kit.place(kit.el('div', 'voice-rail is-staged', s), 160, TRACK_Y);
      fx.fadeIn(rail, mark('verse-3-7', 'live') - 0.2, 0.3);
      const head = kit.place(kit.el('div', 'voice-head is-staged', s), 168, TRACK_Y - 46);
      kit.el('span', 'voice-head-label', head, 'now playing');
      fx.fadeIn(head, t0 - 0.2, 0.2);
      onFrame((t) => {
        if (t < from || t > to) return;
        const x = Math.min(800, 168 + Math.max(0, t - t0) * speed);
        head.style.left = `${x.toFixed(1)}px`;
        // The waveform follows the voice; it drops out while the lost word plays.
        const silent = t > lostAt - 0.25 && t < lostAt + 0.45;
        bars.forEach((bar, i) => {
          const level = silent ? 0.08 : 0.25 + 0.75 * Math.abs(Math.sin(t * 9.1 + i * 0.7) * Math.sin(t * 3.7 + i * 0.31));
          bar.style.height = `${(6 + level * 52).toFixed(1)}px`;
        });
        clockText.textContent = `LIVE 0:${String(42 + Math.floor(Math.max(0, t - from))).padStart(2, '0')}`;
      });
      words.forEach((word, i) => {
        const playAt = t0 + (slotX(i) - 168) / speed;
        if (i === lostWord) {
          const hole = kit.place(kit.el('div', 'voice-chip voice-chip--gap is-staged', s, '…'), slotX(i), TRACK_Y);
          fx.fadeIn(hole, playAt - 0.6, 0.2);
          label(s, 'lost', { x: slotX(i), y: TRACK_Y + 40, color: 'red', iconName: 'cross', at: lostAt });
          return;
        }
        const chip = kit.place(kit.el('div', 'voice-chip is-staged', s, word), slotX(i), TRACK_Y);
        fx.pop(chip, playAt - 0.6, { from: 0.6 });
        tween(chip, { backgroundColor: 'rgba(255, 95, 176, 0.32)' }, playAt, 0.15, EASE.out);
        fx.bump(chip, playAt, 0.12);
      });
      kit.kinetic(s, [
        { text: 'Late', at: mark('verse-3-7', 'late'), color: 'pink' },
        { text: '= lost', at: lostAt },
      ], { y: 368, size: 46, until: mark('verse-3-8', 'resend') + 0.9 });

      // The resend arrives after its word has gone by.
      const resend = mark('verse-3-8', 'resend');
      const lands = mark('verse-3-8', 'lands');
      const late = kit.place(kit.el('div', 'voice-chip voice-chip--resent is-staged', s), 900, TRACK_Y - 64);
      late.append(kit.icon('resend'), document.createTextNode('hear'));
      fx.pop(late, resend, { from: 0.5 });
      glide(late, [900, TRACK_Y - 64], [slotX(lostWord), TRACK_Y], resend + 0.2, lands - resend - 0.2, EASE.inOut);
      tween(late, { opacity: 0.5, borderColor: '#6b7385', color: '#9aa3b5' }, mark('verse-3-8', 'after'), 0.3, EASE.out);
      kit.stamp(s, 'Too late', { x: 540, y: 318, at: mark('verse-3-8', 'after'), color: 'red', rotate: -7 });
      label(s, 'that word already played', { x: slotX(lostWord), y: TRACK_Y - 46, color: 'white', at: mark('verse-3-8', 'gone') });
    }

    /**
     * "DNS? One tiny question, one tiny reply. A handshake would double the
     * wait. Lost? The app tries one more time."
     */
    function udpLookup(from, to) {
      const { s } = laneScene(from, to, { server: 'DNS server', serverIcon: 'search', castle: false });
      kit.sticker(s, 'DNS rides UDP', { x: 384, y: 54, at: mark('verse-3-9', 'dns'), until: mark('verse-3-10', 'tries') - 0.1, variant: 'pink', iconName: 'bolt', rotate: -3 });
      // The contacts app from verse 1, now on the far side of the lane.
      const book = net.frame(s, { x: 722, y: 146, w: 226, h: 88, title: 'DNS · contacts', iconName: 'search' });
      fx.rise(book.node, from + 0.1, { distance: 12 });
      const contact = kit.el('div', 'dns-contact dns-contact--compact', book.glass);
      kit.el('span', 'dns-name', contact, 'ucla.edu');
      kit.el('span', 'dns-arrow', contact, '→');
      kit.el('span', 'dns-number', contact, SERVER_IP);
      say(s, 'right', 168, mark('verse-3-9', 'question'), 'ucla.edu ?', { color: 'udp', duration: 0.36 });
      say(s, 'left', 222, mark('verse-3-9', 'reply'), SERVER_IP, { color: 'udp', duration: 0.36 });

      // What a handshake would cost: a whole extra round trip.
      const handshake = mark('verse-3-10', 'handshake');
      const cost = net.frame(s, { x: 722, y: 262, w: 226, h: 126, title: 'Time to an answer', iconName: 'hourglass' });
      fx.rise(cost.node, handshake - 0.1, { distance: 12 });
      [['UDP', 'udp', 'ask → answer'], ['TCP', 'tcp', 'hello, then ask']].forEach(([name, kind, note]) => {
        const row = kit.el('div', 'wait-row', cost.glass);
        kit.el('span', `wait-name wait-name--${kind}`, row, name);
        kit.el('span', `wait-bar wait-bar--${kind}`, row);
        kit.el('span', 'wait-note', row, note);
      });
      kit.sticker(s, '2× the wait', { x: 760, y: 396, at: mark('verse-3-10', 'double'), variant: 'cyan', iconName: 'hourglass', rotate: -3 });

      // Lost? The app's own timer runs out and it asks again.
      const lost = mark('verse-3-10', 'lost');
      const tries = mark('verse-3-10', 'tries');
      say(s, 'right', 276, lost - 0.2, 'ucla.edu ?', { color: 'udp', lost: true, duration: 0.4 });
      net.timerRing(s, { x: LANES.left - 34, y: 300, from: lost - 0.1, to: tries, label: 'no reply' });
      kit.sticker(s, 'The app tries again', { x: 384, y: 54, at: tries, variant: 'pink', iconName: 'resend', rotate: 3 });
      say(s, 'right', 326, tries, 'ucla.edu ? (again)', { color: 'udp', duration: 0.36 });
      say(s, 'left', 378, mark('verse-3-10', 'time'), SERVER_IP, { color: 'udp', duration: 0.36 });
    }

    // ----------------------------------------------------------------
    // Hook: which one?
    // ----------------------------------------------------------------

    /**
     * The two gates and their rules; every need and every use case in the
     * hook flies into the gate the line names, and leaves its icon in that
     * gate's tally.
     */
    function hook() {
      badge('Which one?', 'hook');
      const from = song.sectionStart('hook');
      const to = song.sectionEnd('hook');
      const s = kit.scene(content, from, to + 0.15, { exit: 'fade' });
      const gates = {
        tcp: net.gate(s, { x: 96, y: 88, color: 'tcp', title: 'TCP', rule: 'Every byte, in order', iconName: 'shield' }),
        udp: net.gate(s, { x: 644, y: 88, color: 'udp', title: 'UDP', rule: 'Fresh beats complete', iconName: 'bolt' }),
      };
      fx.rise(gates.tcp.node, from + 0.05, { distance: 24 });
      fx.rise(gates.udp.node, from + 0.15, { distance: 24 });
      fx.pop(gates.tcp.rule, mark('hook-1', 'tcp') + 0.2, { from: 0.7 });
      fx.pop(gates.udp.rule, mark('hook-2', 'udp') + 0.2, { from: 0.7 });
      const tallies = {
        tcp: kit.place(kit.el('div', 'gate-tally gate-tally--tcp', s), 206, 406),
        udp: kit.place(kit.el('div', 'gate-tally gate-tally--udp', s), 754, 406),
      };

      /** Items pop in the middle column, then fly into `side`'s gate at `fly`. */
      function sort(items, side, fly, { cards = true, top = 150 } = {}) {
        const gate = gates[side];
        items.forEach(([text, at, iconName], k) => {
          const y = top + k * 50;
          let node;
          if (cards) {
            node = net.card(s, { x: 480, y, text, iconName }).node;
            node.classList.add('nk-centered');
            fx.pop(node, at, { from: 0.5, rotate: -2 });
          } else {
            node = label(s, text, { x: 480, y, color: side === 'tcp' ? 'trn' : 'udp', iconName, at });
          }
          const when = fly + k * 0.07;
          tween(node, { translate: `${gate.mouth[0] - 480}px ${gate.mouth[1] - y}px`, scale: 0.3, opacity: 0 }, when, 0.5, EASE.in);
          if (cards && iconName) {
            const tallyItem = kit.el('span', 'gate-tally-item is-staged', tallies[side]);
            tallyItem.append(kit.icon(iconName));
            fx.pop(tallyItem, when + 0.45, { from: 0.4 });
          }
        });
        gate.light(fly + 0.45);
      }

      sort([['every byte', mark('hook-1', 'every'), 'check'], ['in order', mark('hook-1', 'order'), 'stack'], ['even if you wait', mark('hook-1', 'wait'), 'hourglass']], 'tcp', mark('hook-1', 'tcp'), { cards: false });
      sort([['old news = useless', mark('hook-2', 'useless'), 'trash'], ['keep it live', mark('hook-2', 'live'), 'bolt']], 'udp', mark('hook-2', 'udp'), { cards: false });
      sort([['DMs', mark('hook-3', 'dms'), 'chat'], ['Logins', mark('hook-3', 'logins'), 'key'], ['Files', mark('hook-3', 'files'), 'file'], ['Web pages', mark('hook-3', 'web'), 'globe']], 'tcp', mark('hook-3', 'tcp'));
      sort([['Calls', mark('hook-4', 'calls'), 'phone'], ['Game moves', mark('hook-4', 'game'), 'gamepad'], ['Quick lookups', mark('hook-4', 'quick'), 'search']], 'udp', mark('hook-4', 'udp'));
      // Same kind of media, different need: can it wait?
      kit.sticker(s, 'Can it wait?', { x: 418, y: 108, at: mark('hook-5', 'video') - 0.3, variant: 'gold', iconName: 'hourglass', rotate: -3 });
      sort([['Buffered video', mark('hook-5', 'video'), 'video']], 'tcp', mark('hook-5', 'tcp'), { top: 200 });
      label(s, 'can wait for a resend', { x: 480, y: 240, color: 'trn', at: mark('hook-5', 'wait'), until: mark('hook-5', 'tcp') });
      sort([['Live call', mark('hook-6', 'live'), 'phone']], 'udp', mark('hook-6', 'udp'), { top: 300 });
      label(s, 'can’t wait', { x: 480, y: 340, color: 'udp', at: mark('hook-6', 'wait'), until: mark('hook-6', 'udp') });
    }

    // ----------------------------------------------------------------
    // Verse 4: addresses and ports
    // ----------------------------------------------------------------

    function verse4() {
      badge('Verse 4 · Addresses & ports', 'verse-4');
      const start = song.sectionStart('verse-4');
      const end = song.sectionEnd('verse-4');
      const home = line('verse-4-5').start;
      const ports = line('verse-4-7').start;
      const best = line('verse-4-9').start;
      ipAnatomy(start, home - 0.05);
      localhost(home - 0.1, ports - 0.05);
      portsScene(ports - 0.1, best - 0.05);
      bestEffort(best - 0.1, end + 0.15);
    }

    /**
     * "Every machine gets an IP address, network part, then host part: city,
     * then street. IPv4: four numbers, zero to 255. Four billion addresses?
     * Not enough. So IPv6 arrived." The laptop's address from verse 1.
     */
    function ipAnatomy(from, to) {
      const s = kit.scene(content, from, to, { exit: 'fade' });
      const ipv4 = mark('verse-4-3', 'ipv4');
      label(s, 'Your laptop’s IP address', { x: 480, y: 94, iconName: 'laptop', at: mark('verse-4-1', 'machine'), until: ipv4 - 0.1 });
      label(s, 'IPv4: four numbers, 0 to 255 each', { x: 480, y: 94, color: 'net', at: ipv4 });

      const address = kit.el('div', 'ip-big is-staged', s);
      const network = kit.el('span', 'ip-part ip-part--net', address);
      const octets = [];
      ['192', '168', '1'].forEach((value, i) => {
        if (i) kit.el('span', 'ip-dot', network, '.');
        octets.push(kit.el('span', 'ip-octet', network, value));
      });
      kit.el('span', 'ip-dot', address, '.');
      const host = kit.el('span', 'ip-part ip-part--host', address);
      octets.push(kit.el('span', 'ip-octet', host, '42'));
      kit.el('span', 'ip-prefix', address, '/24');
      fx.slam(address, mark('verse-4-1', 'ip'), { from: 1.4 });

      // Network part, then host part: a city, then a street.
      const clearParts = ipv4 - 0.15;
      [[network, 'network part', 'city: your home network', 'globe', 'network', 'city'], [host, 'host part', 'street: this laptop', 'house', 'host', 'street']]
        .forEach(([part, name, hint, iconName, nameWord, hintWord]) => {
          const at = mark('verse-4-2', nameWord);
          tween(part, { color: part === network ? '#a78bfa' : '#ffd100' }, at, 0.2, EASE.out);
          const brace = kit.el('div', 'ip-brace is-staged', part);
          kit.el('span', 'ip-brace-name', brace, name);
          const tip = kit.el('span', 'ip-brace-hint is-staged', brace);
          tip.append(kit.icon(iconName), document.createTextNode(hint));
          fx.fadeIn(brace, at, 0.25);
          fx.pop(tip, mark('verse-4-2', hintWord), { from: 0.6 });
          fx.fadeOut(brace, clearParts, 0.2);
        });
      kit.sticker(s, 'No guessing', { x: 704, y: 300, at: mark('verse-4-2', 'guessing'), until: clearParts, variant: 'green', iconName: 'check', rotate: -4 });

      // Four numbers, each 0 to 255.
      octets.forEach((octet, i) => {
        fx.bump(octet, mark('verse-4-3', 'four') + i * 0.08, 0.12);
        const range = kit.el('span', 'ip-range is-staged', octet, '0–255');
        fx.pop(range, mark('verse-4-3', 'zero') + i * 0.1, { from: 0.6 });
        fx.fadeOut(range, mark('verse-4-4', 'enough') - 0.1, 0.2);
      });

      // About four billion of them: not enough.
      const counter = kit.el('div', 'ip-counter is-staged', s);
      const countFrom = mark('verse-4-4', 'four');
      const countTo = mark('verse-4-4', 'billion') + 0.45;
      fx.fadeIn(counter, countFrom - 0.05, 0.15);
      onFrame((t) => {
        if (t < from || t > to) return;
        const total = Math.round(4294967296 * easeInOutCubic(progress(t, countFrom, countTo - countFrom)));
        counter.textContent = `${total.toLocaleString('en-US')} addresses`;
      });
      kit.stamp(s, 'Not enough!', { x: 650, y: 330, at: mark('verse-4-4', 'enough'), color: 'red', rotate: -6 });
      label(s, '8 billion people, many devices each', { x: 480, y: 346, color: 'white', iconName: 'user', at: mark('verse-4-4', 'enough') + 0.12 });
      label(s, 'IPv6 · 2001:db8::42', { x: 360, y: 396, color: 'net', mono: true, at: mark('verse-4-4', 'ipv6') });
      kit.sticker(s, 'way more room', { x: 474, y: 384, at: mark('verse-4-4', 'arrived'), variant: 'violet', iconName: 'sparkle', rotate: 4 });
    }

    /** "127.0.0.1? There's no place like home: localhost, your own machine." */
    function localhost(from, to) {
      const s = kit.scene(content, from, to, { exit: 'fade' });
      kit.kinetic(s, [
        { text: '127.0.0.1', at: mark('verse-4-5', '127'), color: 'gold' },
        { text: '?', at: mark('verse-4-5', '1') },
      ], { y: 46, size: 56 });
      cameo(from + 0.25, to - 0.25, { x: 352, y: 172, scale: 0.8 });
      const pill = kit.place(kit.el('div', 'address-pill is-staged', s), 456, 146);
      pill.append(kit.icon('globe'), document.createTextNode('localhost:3000'));
      fx.pop(pill, mark('verse-4-5', '1') + 0.25, { from: 0.6 });

      // The loopback: out of the laptop and straight back in, never onto the network.
      const at = mark('verse-4-6', 'localhost');
      const loop = kit.svg('svg', { class: 'loopback', viewBox: '0 0 960 540' }, s);
      const d = 'M548 388C760 388 760 118 456 118C152 118 152 388 364 388';
      const loopPath = kit.svg('path', { class: 'loopback-path', d }, loop);
      fx.draw(loopPath, at - 0.1, 0.5);
      const arrow = kit.svg('path', { class: 'loopback-head is-staged', d: 'M366 388l-14-7v14z' }, loop);
      fx.fadeIn(arrow, at + 0.35, 0.1);
      const round = {
        pointAt(p) {
          const point = loopPath.getPointAtLength(p * loopPath.getTotalLength());
          return [point.x, point.y];
        },
      };
      const rider = net.orb(s, { color: 'net', size: 16 });
      fx.fadeIn(rider, at + 0.4, 0.15);
      const laps = [];
      for (let lap = at + 0.4; lap < to; lap += 1.3) laps.push({ beam: round, from: 0, to: 1, at: lap, duration: 1.2 });
      net.travel(rider, laps);
      kit.sticker(s, 'No place like home', { x: 720, y: 160, at: mark('verse-4-6', 'place'), variant: 'gold', iconName: 'house', rotate: -3 });
      net.tag(s, { x: 720, y: 222, text: 'localhost = 127.0.0.1', color: 'net', mono: true, at });
      kit.sticker(s, 'your own machine', { x: 720, y: 276, at: mark('verse-4-6', 'own'), variant: 'white', iconName: 'laptop', rotate: 3 });
      net.tag(s, { x: 720, y: 330, text: 'never leaves it', color: 'white', at: mark('verse-4-6', 'machine') + 0.1 });
    }

    /**
     * "IP finds the machine, but one machine runs lots of apps, so the port
     * picks the app: 3000, 443, like that." The castle is the machine; each
     * lit window is an app, and its port is the room number.
     */
    function portsScene(from, to) {
      const s = kit.scene(content, from, to, { exit: 'fade' });
      const fortress = net.castle(s, { x: 330, y: 30, scale: 0.62, active: [from, to] });
      fx.fadeIn(fortress.node, from + 0.05, 0.4);
      const road = net.beam(s, [[24, 296], fortress.gate], { color: 'net', at: from + 0.1, duration: 0.5, bow: -36 });

      // The apps behind the castle's windows, each at a port.
      const apps = [
        { window: 0, port: ':443', name: 'HTTPS website', iconName: 'lock', side: 'right', at: 0 },
        { window: 3, port: ':3000', name: 'your Node.js app', iconName: 'laptop', side: 'right', at: 0.1 },
        { window: 5, port: ':22', name: 'SSH', iconName: 'key', side: 'left', at: 0.2 },
        { window: 6, port: ':5432', name: 'database', iconName: 'stack', side: 'left', at: 0.3 },
      ];
      const leaders = kit.svg('svg', { class: 'port-leaders', viewBox: '0 0 960 540' }, s);
      const lots = mark('verse-4-7', 'lots');
      const labels = apps.map((app, i) => {
        const [wx, wy] = fortress.windowCenter(app.window);
        const lx = app.side === 'right' ? 664 : 300;
        const ly = [84, 150, 172, 236][i];
        const leader = kit.svg('path', { class: 'port-leader', d: `M${wx.toFixed(1)} ${wy.toFixed(1)}L${lx} ${ly + 16}` }, leaders);
        leader.style.strokeDasharray = '1';
        leader.style.strokeDashoffset = '1';
        fx.draw(leader, lots + app.at, 0.3);
        const ring = kit.svg('circle', { class: 'port-window-ring is-staged', cx: wx.toFixed(1), cy: wy.toFixed(1), r: 13 }, leaders);
        fx.pop(ring, lots + app.at, { from: 0.4 });
        const tagNode = kit.place(kit.el('div', `port-label port-label--${app.side} is-staged`, s), lx, ly);
        tagNode.append(kit.icon(app.iconName));
        kit.el('span', 'port-number', tagNode, app.port);
        tagNode.append(document.createTextNode(app.name));
        fx.pop(tagNode, mark('verse-4-7', 'apps') + app.at, { from: 0.6 });
        return tagNode;
      });
      kit.sticker(s, 'one machine, lots of apps', { x: 650, y: 300, at: mark('verse-4-7', 'machine_2'), variant: 'white', iconName: 'castle', rotate: -3 });

      // Packets: IP brings each to the machine; its port picks the window.
      const packets = [
        { port: 'port 3000', target: 0, arrive: mark('verse-4-8', '3000'), board: mark('verse-4-7', 'ip'), climb: mark('verse-4-8', 'picks') },
        { port: 'port 443', target: 1, arrive: mark('verse-4-8', '443'), board: mark('verse-4-8', 'port') - 0.2, climb: mark('verse-4-8', '3000') - 0.15 },
      ];
      packets.forEach((packet, i) => {
        const chip = kit.el('div', 'packet-chip is-staged', s);
        kit.el('span', 'packet-chip-ip', chip, `IP ${SERVER_IP}`);
        const portPart = kit.el('span', 'packet-chip-port', chip, packet.port);
        fx.fadeIn(chip, packet.board - 0.1, 0.15);
        const app = apps[packet.target];
        const inside = net.beam(s, [fortress.gate, fortress.windowCenter(app.window)], { color: 'trn', at: packet.climb, duration: 0.35, bow: -24 });
        inside.node.classList.add('is-thin');
        net.travel(chip, [
          { beam: road, from: 0, to: 1, at: packet.board, duration: 0.75 },
          { beam: inside, from: 0, to: 1, at: packet.climb, duration: packet.arrive - packet.climb },
        ]);
        fx.bump(portPart, mark('verse-4-8', 'port') + i * 0.15, 0.15);
        fx.bump(labels[packet.target], packet.arrive, 0.12);
        tween(labels[packet.target], { borderColor: '#4ade80', boxShadow: '0 0 0 3px rgba(74, 222, 128, 0.45)' }, packet.arrive, 0.2, EASE.out);
        fx.fadeOut(chip, packet.arrive + 0.15, 0.2);
      });
      label(s, 'IP: right machine ✓', { x: 160, y: 352, color: 'net', at: mark('verse-4-7', 'machine') });
      kit.sticker(s, 'IP → machine · port → app', { x: 316, y: 404, at: mark('verse-4-8', '443') + 0.35, variant: 'gold', iconName: 'pin', rotate: -2 });
    }

    /**
     * "IP does its best, but packets still get dropped, and IP won't resend.
     * That's TCP's job. Full stop." A full router queue drops a packet; TCP
     * on the laptop notices and sends it again.
     */
    function bestEffort(from, to) {
      const s = kit.scene(content, from, to, { exit: 'fade' });
      cameo(from + 0.2, to - 0.25, { x: 12, y: 204, scale: 0.62 });
      const home = net.beacon(s, { x: 204, y: 230, kind: 'wifi', label: 'Home router', scale: 0.72, active: [from, to] });
      const router = net.beacon(s, { x: 428, y: 148, kind: 'router', label: 'Router', scale: 0.72, active: [from, to] });
      const fortress = net.castle(s, { x: 694, y: 78, scale: 0.47, active: [from, to] });
      [home.node, router.node, fortress.node].forEach((node, i) => fx.rise(node, from + 0.05 + i * 0.08, { distance: 16 }));
      const route = net.beam(s, [[176, 336], home.anchor, router.anchor, fortress.gate], { color: 'net', at: from + 0.15, duration: 0.6, bow: -30 });
      const atRouter = fractionNear(route, router.anchor);

      const packet = (n, color = 'net') => {
        const node = net.orb(s, { color, size: 24 });
        node.classList.add('orb-number');
        node.textContent = String(n);
        return node;
      };
      const best = mark('verse-4-9', 'best');
      const dropped = mark('verse-4-9', 'dropped');
      kit.sticker(s, 'IP: best effort', { x: 108, y: 84, at: best, variant: 'violet', iconName: 'globe', rotate: -3 });
      // 1 and 3 get through; 2 arrives at a full queue and is dropped.
      const first = packet(1);
      fx.fadeIn(first, from + 0.4, 0.15);
      net.travel(first, [{ beam: route, from: 0, to: 1, at: from + 0.4, duration: 1.9 }]);
      fx.fadeOut(first, from + 2.3, 0.2);
      const second = packet(2);
      fx.fadeIn(second, from + 0.8, 0.15);
      net.travel(second, [{ beam: route, from: 0, to: atRouter, at: from + 0.8, duration: mark('verse-4-9', 'packets') - from - 0.8 }]);
      const queue = kit.place(kit.el('div', 'router-queue is-staged', s), router.anchor[0] - 46, router.anchor[1] - 74);
      kit.el('span', 'router-queue-label', queue, 'queue full');
      for (let k = 0; k < 3; k++) kit.el('span', 'router-queue-slot', queue);
      fx.pop(queue, mark('verse-4-9', 'packets') - 0.2, { from: 0.6 });
      tween(second, [{ translate: '0 0', rotate: '0deg', opacity: 1 }, { translate: '26px 190px', rotate: '200deg', opacity: 0 }], dropped - 0.1, 0.75, 'cubic-bezier(0.45, 0, 0.9, 0.5)');
      label(s, 'dropped', { x: router.anchor[0], y: router.anchor[1] + 120, color: 'red', iconName: 'cross', at: dropped + 0.1 });
      const third = packet(3);
      fx.fadeIn(third, from + 1.2, 0.15);
      net.travel(third, [{ beam: route, from: 0, to: 1, at: from + 1.2, duration: 2.1 }]);
      fx.fadeOut(third, from + 3.3, 0.2);
      label(s, 'IP won’t resend', { x: router.anchor[0], y: router.anchor[1] + 156, color: 'red', iconName: 'cross', at: mark('verse-4-10', 'resend') });

      // TCP's job: no ACK for 2, so 2 goes again and gets there.
      const tcpAt = mark('verse-4-10', 'tcp');
      net.timerRing(s, { x: 186, y: 168, from: dropped, to: tcpAt, label: 'no ACK for 2' });
      const retry = packet(2, 'tcp');
      fx.fadeIn(retry, tcpAt, 0.15);
      net.travel(retry, [{ beam: route, from: 0, to: 1, at: tcpAt + 0.05, duration: 1.0 }]);
      label(s, 'TCP resends 2', { x: 120, y: 132, color: 'trn', iconName: 'shield', at: tcpAt });
      kit.sticker(s, 'That’s TCP’s job', { x: 300, y: 392, at: mark('verse-4-10', 'job'), variant: 'cyan', iconName: 'shield', rotate: -3 });
      kit.stamp(s, 'Full stop.', { x: 560, y: 376, at: mark('verse-4-10', 'stop'), color: 'gold', rotate: -6 });
    }

    /** The fraction along `beam` closest to `point` (sampled). */
    function fractionNear(beam, [px, py]) {
      let best = 0;
      let bestDistance = Infinity;
      for (let i = 0; i <= 200; i++) {
        const [x, y] = beam.pointAt(i / 200);
        const distance = (x - px) ** 2 + (y - py) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i / 200;
        }
      }
      return best;
    }

    // ----------------------------------------------------------------
    // Bridge: HTTP has no memory; HTTPS locks it in TLS
    // ----------------------------------------------------------------

    function bridge() {
      badge('Bridge · HTTP & HTTPS', 'bridge');
      const start = song.sectionStart('bridge');
      const end = song.sectionEnd('bridge');
      const https = line('bridge-4').start;
      stateless(start, https - 0.05);
      httpsScene(https - 0.1, end + 0.15);
    }

    /** An HTTP message as the stack draws it: a gold box with its request line and headers. */
    function httpBox(parent, { x, y, w = 286, detail, lines }) {
      const height = 30 + lines.length * 17 + 9;
      const node = kit.place(kit.el('div', 'nk-box nk-box--app http-box is-staged', parent), x, y);
      node.style.width = `${w}px`;
      node.style.height = `${height}px`;
      const tab = kit.el('div', 'nk-box-tab', node);
      kit.el('span', 'nk-box-layer', tab, 'HTTP');
      kit.el('span', 'nk-box-detail', tab, detail);
      const body = kit.el('div', 'nk-box-body', node);
      const rows = lines.map((text) => kit.el('div', 'nk-box-line', body, text));
      return { node, rows, height, center: [x + w / 2, y + height / 2] };
    }

    /** Flies a box (by its center) into `target`, shrinking away, over `duration`. */
    function deliver(box, target, at, duration = 0.5) {
      tween(box.node, { translate: `${target[0] - box.center[0]}px ${target[1] - box.center[1]}px`, scale: 0.25, opacity: 0 }, at, duration, EASE.in);
    }

    /**
     * "Up top, HTTP has no chat history. Every request is fresh. The server
     * won't remember me, so each request brings all it needs, and any server
     * copy can reply."
     */
    function stateless(from, to) {
      const s = kit.scene(content, from, to, { exit: 'fade' });
      cameo(from + 0.25, to - 0.25, { x: 16, y: 200, scale: 0.66 });
      label(s, 'Application layer · HTTP', { x: 480, y: 92, color: 'app', iconName: 'chat', at: mark('bridge-1', 'top') });
      const any = mark('bridge-3', 'any');
      const fortress = net.castle(s, { x: 742, y: 112, scale: 0.4, active: [from, any] });
      fx.fadeIn(fortress.node, from + 0.1, 0.4);
      fx.fadeOut(fortress.node, any, 0.3);
      const reply = (text, fromPoint, at, until) => {
        const chip = label(s, text, { x: fromPoint[0], y: fromPoint[1], color: 'app', mono: true, at });
        glide(chip, fromPoint, [330, 206], at + 0.05, 0.45, EASE.inOut);
        fx.fadeOut(chip, until, 0.2);
      };

      // Request 1 carries its token; the server answers, then forgets it.
      const http = mark('bridge-1', 'http');
      const history = mark('bridge-1', 'history');
      const first = httpBox(s, { x: 210, y: 136, detail: 'request', lines: ['GET /profile HTTP/1.1', 'Authorization: Bearer eyJhb…'] });
      fx.pop(first.node, http - 0.25, { from: 0.6 });
      deliver(first, fortress.gate, http + 0.25);
      reply('200 OK · Hi, Joe!', fortress.gate, http + 0.8, mark('bridge-2', 'every') - 0.1);
      const memory = net.frame(s, { x: 736, y: 380, w: 204, h: 54, className: 'memory-note' });
      fx.rise(memory.node, http + 0.6, { distance: 8 });
      kit.el('span', 'memory-note-title', memory.glass, 'server remembers:');
      const remembered = kit.el('span', 'memory-note-text', memory.glass, 'Joe’s request');
      fx.fadeOut(remembered, history, 0.3);
      const blank = kit.el('span', 'memory-note-text memory-note-text--empty is-staged', memory.glass, 'nothing');
      fx.fadeIn(blank, history + 0.25, 0.25);
      kit.sticker(s, 'No chat history', { x: 250, y: 44, at: mark('bridge-1', 'chat'), until: mark('bridge-2', 'fresh') - 0.1, variant: 'gold', iconName: 'chat', rotate: -3 });

      // Request 2 forgets its token: a fresh start, and a stranger.
      const fresh = mark('bridge-2', 'fresh');
      const second = httpBox(s, { x: 210, y: 136, detail: 'request', lines: ['GET /cart HTTP/1.1'] });
      fx.pop(second.node, mark('bridge-2', 'every'), { from: 0.6 });
      deliver(second, fortress.gate, fresh);
      kit.sticker(s, 'Every request starts fresh', { x: 250, y: 44, at: fresh, until: mark('bridge-3', 'each') - 0.1, variant: 'white', iconName: 'sparkle', rotate: 2 });
      net.bubble(s, { x: 940, y: 74, text: '“Who are you?” · 401', side: 'right', tone: 'server', at: mark('bridge-2', 'remember'), until: mark('bridge-3', 'each') });

      // Request 3 brings everything the server needs.
      const each = mark('bridge-3', 'each');
      const third = httpBox(s, { x: 210, y: 136, detail: 'request', lines: ['GET /cart HTTP/1.1', 'Authorization: Bearer eyJhb…', 'Accept: text/html'] });
      fx.pop(third.node, each, { from: 0.6 });
      third.rows[1].classList.add('is-staged');
      third.rows[2].classList.add('is-staged');
      fx.slideIn(third.rows[1], mark('bridge-3', 'brings'), { dx: -10, duration: 0.25 });
      fx.slideIn(third.rows[2], mark('bridge-3', 'needs'), { dx: -10, duration: 0.25 });
      kit.sticker(s, 'Brings all it needs', { x: 224, y: 268, at: mark('bridge-3', 'needs'), until: mark('bridge-3', 'reply') + 0.3, variant: 'gold', iconName: 'box', rotate: -3 });
      // Any copy of the server can answer it.
      const copies = [586, 702, 818].map((x, i) => {
        const copy = net.castle(s, { x, y: 136, scale: 0.24, active: [any, to] });
        fx.rise(copy.node, any + i * 0.08, { distance: 12 });
        label(s, `copy ${i + 1}`, { x: x + 58, y: 306, color: 'white', at: any + 0.1 + i * 0.08 });
        return copy;
      });
      const copyAt = mark('bridge-3', 'copy');
      deliver(third, copies[1].gate, copyAt - 0.05, 0.45);
      fx.bump(copies[1].node, copyAt + 0.4, 0.05);
      reply('200 OK', copies[1].gate, mark('bridge-3', 'reply'), to);
      kit.sticker(s, 'Any copy can reply', { x: 600, y: 344, at: copyAt + 0.1, variant: 'gold', iconName: 'castle', rotate: 3 });
    }

    /** "HTTPS: HTTP locked inside TLS. Nobody on the Wi-Fi reads your passwords." */
    function httpsScene(from, to) {
      const s = kit.scene(content, from, to, { exit: 'fade' });
      kit.kinetic(s, [{ text: 'HTTPS', at: mark('bridge-4', 'https'), color: 'gold', iconName: 'lock' }], { y: 46, size: 52 });
      // TLS wraps the whole HTTP message, like one more box in the stack.
      const locked = mark('bridge-4', 'locked');
      const tls = kit.place(kit.el('div', 'nk-box nk-box--tls is-staged', s), 330, 138);
      const tab = kit.el('div', 'nk-box-tab', tls);
      const chip = kit.el('span', 'nk-box-layer', tab);
      chip.append(kit.icon('lock'), document.createTextNode('TLS'));
      kit.el('span', 'nk-box-detail', tab, 'encrypted');
      const message = httpBox(s, { x: 346, y: 170, w: 268, detail: 'login', lines: ['POST /login HTTP/1.1', 'user=joe.bruin', 'password=go-bruins-25'] });
      tls.style.width = '300px';
      tls.style.height = `${message.height + 48}px`;
      fx.pop(message.node, mark('bridge-4', 'http'), { from: 0.6 });
      tween(tls, [{ opacity: 0, scale: 1.2 }, { opacity: 1, scale: 1 }], locked, 0.42, EASE.out);
      fx.bump(tls, mark('bridge-4', 'inside'), 0.04);
      // Seen from the network, the inside is ciphertext.
      const tlsAt = mark('bridge-4', 'tls');
      ['9f3a 1e0c 77d2 b4e1 08c5', 'c3d1 5a9e 0f72 e84b', '61fd 2b0a 9ce3 47a8 d1'].forEach((cipher, i) => {
        kit.scramble(message.rows[i], { at: tlsAt, settle: tlsAt + 0.5, text: cipher, seed: 31 + i, before: message.rows[i].textContent });
      });
      // Where TLS sits: between HTTP and TCP.
      const inside = mark('bridge-4', 'inside');
      const layersAt = [['HTTP', 'app', 0], ['TCP', 'trn', 1], ['IP', 'net', 2]];
      layersAt.forEach(([text, color, row]) => {
        const node = label(s, text, { x: 790, y: 160 + row * 42, color, mono: true, at: from + 0.2 + row * 0.06 });
        if (row > 0) glide(node, [790, 160 + row * 42], [790, 160 + (row + 1) * 42], inside - 0.1, 0.3, EASE.inOut);
      });
      label(s, 'TLS', { x: 790, y: 202, color: 'white', mono: true, iconName: 'lock', at: inside + 0.15 });

      // The café Wi-Fi: someone listening sees only noise.
      const cafe = net.beacon(s, { x: 34, y: 232, kind: 'wifi', label: 'Café Wi-Fi', scale: 0.8, active: [from, to] });
      fx.rise(cafe.node, mark('bridge-5', 'nobody') - 0.2, { distance: 12 });
      label(s, 'someone listening', { x: 98, y: 206, color: 'red', iconName: 'eye', at: mark('bridge-5', 'nobody') });
      const reads = mark('bridge-5', 'reads');
      const look = kit.svg('svg', { class: 'sightline', viewBox: '0 0 960 540' }, s);
      const ray = kit.svg('path', { class: 'sightline-path', d: 'M150 228L330 214' }, look);
      ray.style.strokeDasharray = '1';
      ray.style.strokeDashoffset = '1';
      fx.draw(ray, reads - 0.2, 0.3);
      net.tag(s, { x: 30, y: 400, text: 'sees: 9f3a 1e0c 77d2…', color: 'red', mono: true, at: reads });
      kit.sticker(s, 'Password: safe', { x: 400, y: 330, at: mark('bridge-5', 'passwords'), variant: 'green', iconName: 'lock', rotate: -3 });
    }

    // ----------------------------------------------------------------
    // Pop quiz: each question with the picture it was taught with
    // ----------------------------------------------------------------

    function quiz() {
      badge('Pop quiz', 'quiz');
      const { lines } = song.storyboard.sections.find((section) => section.id === 'quiz');
      const pictures = [quizHeaders, quizPorts, quizCall, quizTcpLoss, quizUdpLoss, quizHttps];
      const icons = ['tag', 'door', 'bolt', 'resend', 'trash', 'lock'];
      lines.forEach((entry, i) => {
        const from = entry.start - 0.15;
        const to = i + 1 < lines.length ? lines[i + 1].start - 0.15 : song.sectionEnd('quiz');
        const s = kit.scene(content, from, to, { enter: 'whip' });
        const card = kit.el('div', 'quiz-card quiz-card--visual', s);
        kit.el('div', 'quiz-count', card, `Quiz ${i + 1} / ${lines.length}`);
        kit.el('div', 'quiz-question', card, entry.text);
        const panel = kit.el('div', 'quiz-visual', card);
        pictures[i](panel, entry);
        // Think before the answer: a bar fills from the end of the question.
        const asked = Math.max(...Object.values(entry.marks || {}));
        const think = kit.el('div', 'quiz-think', card);
        const fill = kit.el('div', 'quiz-think-fill', think);
        kit.el('span', 'quiz-think-label', think, 'think…');
        tween(fill, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], asked, Math.max(0.2, entry.answer_at - asked), EASE.linear);
        fx.fadeOut(think, entry.answer_at, 0.15);
        const answer = kit.el('div', 'quiz-answer is-staged', card);
        answer.append(kit.icon(icons[i]));
        answer.append(document.createTextNode(entry.answer));
        fx.slam(answer, entry.answer_at, { from: 1.6 });
        camera.punch(entry.answer_at + 0.05, 0.03);
      });
    }

    /** Q1: three boxes, each with an unknown label; the answer names them. */
    function quizHeaders(panel, entry) {
      let inside = kit.el('div', 'quiz-nest', panel);
      [['lnk', 'Link'], ['net', 'IP'], ['trn', 'TCP']].forEach(([key, name]) => {
        const box = kit.el('div', `quiz-nest-box quiz-nest-box--${key}`, inside);
        inside = box;
        const tab = kit.el('div', 'quiz-nest-tab', box);
        kit.el('span', 'quiz-nest-layer', tab, name);
        kit.el('span', 'quiz-nest-mystery', tab, '???');
        const known = kit.el('span', 'quiz-nest-known is-staged', tab, 'header');
        fx.pop(known, entry.answer_at + 0.1, { from: 0.5 });
        tween(tab.querySelector('.quiz-nest-mystery'), { opacity: 0 }, entry.answer_at, 0.1);
      });
      kit.el('div', 'quiz-nest-data', inside, 'data');
    }

    /** Q2: the castle with a lit window and an unknown room number. */
    function quizPorts(panel, entry) {
      const fortress = net.castle(panel, { x: 8, y: 2, scale: 0.28, active: [entry.start - 0.2, entry.end + 1] });
      fortress.node.classList.remove('is-staged');
      const [wx, wy] = fortress.windowCenter(3);
      const mystery = kit.place(kit.el('div', 'quiz-port', panel, ':????'), wx + 20, wy - 14);
      tween(mystery, { opacity: 0 }, entry.answer_at, 0.1);
      const known = kit.place(kit.el('div', 'quiz-port is-known is-staged', panel, ':3000'), wx + 20, wy - 14);
      fx.pop(known, entry.answer_at + 0.05, { from: 0.5 });
    }

    /** Q3: the two emblems; the answer lights UDP. */
    function quizCall(panel, entry) {
      const call = kit.el('div', 'quiz-callout', panel);
      call.append(kit.icon('phone'), document.createTextNode('live voice'));
      [['tcp', 'TCP', 'shield'], ['udp', 'UDP', 'bolt']].forEach(([kind, name, iconName]) => {
        const emblem = kit.el('div', `quiz-emblem quiz-emblem--${kind}`, panel);
        emblem.append(kit.icon(iconName), document.createTextNode(name));
        if (kind === 'udp') {
          tween(emblem, { scale: 1.18, boxShadow: '0 0 0 4px rgba(255, 95, 176, 0.6), 0 0 30px rgba(255, 95, 176, 0.6)' }, entry.answer_at, 0.25, EASE.back);
        } else {
          tween(emblem, { opacity: 0.35 }, entry.answer_at, 0.25);
        }
      });
    }

    /** Q4: piece 1 lost, 2 and 3 waiting; the answer resends 1. */
    function quizTcpLoss(panel, entry) {
      const row = kit.el('div', 'quiz-queue', panel);
      const missing = kit.el('span', 'quiz-piece is-missing', row, '1');
      kit.el('span', 'quiz-piece', row, '2');
      kit.el('span', 'quiz-piece', row, '3');
      tween(missing, { borderStyle: 'solid', color: '#0b0f1a', backgroundColor: '#38d3f5' }, entry.answer_at + 0.2, 0.2);
      const again = kit.el('div', 'quiz-note is-staged', panel);
      again.append(kit.icon('resend'), document.createTextNode('1 again; 2, 3 wait'));
      fx.pop(again, entry.answer_at + 0.1, { from: 0.6 });
    }

    /** Q5: a UDP packet lost; the answer drops it for good. */
    function quizUdpLoss(panel, entry) {
      const packet = kit.el('div', 'quiz-datagram', panel, 'UDP · data');
      tween(packet, [{ translate: '0 0', rotate: '0deg', opacity: 1 }, { translate: '0 90px', rotate: '24deg', opacity: 0 }], entry.answer_at, 0.6, EASE.in);
      const bin = kit.el('div', 'quiz-bin is-staged', panel);
      bin.append(kit.icon('trash'));
      fx.pop(bin, entry.answer_at - 0.1, { from: 0.5 });
      const note = kit.el('div', 'quiz-note quiz-note--udp is-staged', panel);
      note.append(kit.icon('cross'), document.createTextNode('no resend'));
      fx.pop(note, entry.answer_at + 0.3, { from: 0.6 });
    }

    /** Q6: an HTTP box; the answer locks it inside TLS. */
    function quizHttps(panel, entry) {
      const lock = kit.el('div', 'quiz-tls is-staged', panel);
      const tab = kit.el('span', 'quiz-tls-tab', lock);
      tab.append(kit.icon('lock'), document.createTextNode('TLS'));
      kit.el('div', 'quiz-http', panel, 'HTTP');
      tween(lock, [{ opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1 }], entry.answer_at, 0.35, EASE.out);
    }

    // ----------------------------------------------------------------
    // Outro: where it started
    // ----------------------------------------------------------------

    function outro() {
      badge('Outro · Where it started', 'outro');
      const start = song.sectionStart('outro');
      const vint = line('outro-3').start;
      const go = line('outro-4').start;
      firstMessage(start, vint + 0.05);
      inventors(vint - 0.1, go + 0.05);
      finale(go - 0.1, song.duration + 0.5);
    }

    /** A teletype above a node: its name, and the paper it prints on. */
    function teletype(parent, { x, y, name }) {
      const node = kit.place(kit.el('div', 'teletype is-staged', parent), x, y);
      kit.el('div', 'teletype-name', node, name);
      const paper = kit.el('div', 'teletype-paper', node);
      const text = kit.el('span', 'teletype-text', paper, '');
      return { node, text };
    }

    /**
     * "1969, Boelter Hall: Kleinrock's lab, the first node on the net. The
     * first message said 'LO,' then it crashed." UCLA's IMP typed LOGIN to
     * SRI's; SRI's system crashed after L and O.
     */
    function firstMessage(from, to) {
      const s = kit.scene(content, from, to, { exit: 'fade' });
      kit.kinetic(s, [{ text: '1969', at: mark('outro-1', '1969'), color: 'gold' }], { y: 44, size: 62 });
      const hall = kit.el('div', 'subtitle is-staged', s, 'Boelter Hall 3420 · UCLA');
      hall.style.top = '116px';
      fx.fadeIn(hall, mark('outro-1', 'boelter'), 0.3);
      label(s, 'Leonard Kleinrock’s lab', { x: 480, y: 166, color: 'app', iconName: 'user', at: mark('outro-1', 'kleinrock') });

      const node = mark('outro-1', 'node');
      const net1969 = mark('outro-1', 'net');
      const ucla = net.imp(s, { x: 96, y: 196, scale: 0.74, active: [from, to] }).wake(node);
      fx.rise(ucla.node, mark('outro-1', 'first') - 0.1, { distance: 20 });
      const sri = net.imp(s, { x: 654, y: 196, scale: 0.74, active: [from, to] }).wake(net1969 + 0.2);
      fx.rise(sri.node, net1969 - 0.1, { distance: 20 });
      const local = teletype(s, { x: 84, y: 144, name: 'Node 1 · UCLA' });
      const remote = teletype(s, { x: 642, y: 144, name: 'Node 2 · SRI' });
      fx.pop(local.node, node, { from: 0.6 });
      fx.pop(remote.node, net1969 + 0.15, { from: 0.6 });
      const sriSide = [654 + 30 * 0.74, ucla.port[1]];
      const line1969 = net.beam(s, [ucla.port, sriSide], { color: 'app', at: net1969, duration: 0.5, bow: -40 });
      label(s, 'leased line · 50 kbit/s', { x: 446, y: 290, color: 'white', mono: true, at: net1969 + 0.4 });

      // L, then O, then the crash before G.
      const message = mark('outro-2', 'message');
      const lo = mark('outro-2', 'lo');
      const crashed = mark('outro-2', 'crashed');
      const letters = [
        { letter: 'L', typed: message + 0.05, arrive: message + 0.5 },
        { letter: 'O', typed: lo - 0.45, arrive: lo },
      ];
      net.typeAt(local.text, 'LOG', [letters[0].typed, letters[1].typed, crashed - 0.45]);
      net.typeAt(remote.text, 'LO', [letters[0].arrive, letters[1].arrive]);
      for (const { letter, typed, arrive } of letters) {
        const orb = net.orb(s, { color: 'app', size: 26 });
        orb.classList.add('orb-number');
        orb.textContent = letter;
        fx.fadeIn(orb, typed, 0.1);
        net.travel(orb, [{ beam: line1969, from: 0, to: 1, at: typed, duration: arrive - typed }]);
        fx.fadeOut(orb, arrive, 0.15);
      }
      const g = net.orb(s, { color: 'app', size: 26 });
      g.classList.add('orb-number');
      g.textContent = 'G';
      fx.fadeIn(g, crashed - 0.45, 0.1);
      net.travel(g, [{ beam: line1969, from: 0, to: 0.55, at: crashed - 0.45, duration: 0.45 }]);
      tween(g, { opacity: 0, scale: 0.4 }, crashed, 0.2, EASE.in);
      sri.crash(crashed);
      tween(line1969.node, { opacity: 0.25 }, crashed, 0.3, EASE.out);
      kit.stamp(s, 'Crash!', { x: 560, y: 372, at: crashed, color: 'red', rotate: 8 });
      kit.sticker(s, 'Oct 29, 1969 · 10:30 pm', { x: 330, y: 214, at: mark('outro-2', 'forget'), variant: 'gold', iconName: 'timer', rotate: -2 });
    }

    /**
     * "Vint Cerf, a grad student there, later co-designed TCP/IP with Bob
     * Kahn." Name cards (no portraits), the paper, and the two layers the
     * song has been about.
     */
    function inventors(from, to) {
      const s = kit.scene(content, from, to, { exit: 'fade' });
      const person = (x, name, nameAt, role, roleAt) => {
        const card = kit.place(kit.el('div', 'person is-staged', s), x, 118);
        kit.el('div', 'person-name', card, name);
        const roleNode = kit.el('div', 'person-role is-staged', card, role);
        fx.rise(card, nameAt, { distance: 14 });
        fx.fadeIn(roleNode, roleAt, 0.25);
        return card;
      };
      person(96, 'Vint Cerf', mark('outro-3', 'vint'), 'grad student in Kleinrock’s lab', mark('outro-3', 'grad'));
      person(536, 'Bob Kahn', mark('outro-3', 'bob'), 'co-designer of TCP/IP', mark('outro-3', 'kahn'));
      const tcp = mark('outro-3', 'tcp');
      kit.kinetic(s, [
        { text: 'TCP', at: tcp, color: 'cyan' },
        { text: '/', at: tcp + 0.12 },
        { text: 'IP', at: tcp + 0.24, color: 'violet' },
      ], { y: 236, size: 66 });
      const paper = kit.place(kit.el('div', 'paper-card is-staged', s), 480, 344);
      kit.el('span', 'paper-card-year', paper, '1974');
      kit.el('span', 'paper-card-title', paper, '“A Protocol for Packet Network Intercommunication”');
      fx.rise(paper, mark('outro-3', 'designed'), { distance: 12 });
      label(s, 'Transport', { x: 410, y: 318, color: 'trn', at: tcp + 0.4 });
      label(s, 'Internet', { x: 552, y: 318, color: 'net', at: tcp + 0.5 });
    }

    /** "Go Bruins! Now you know the stack." Then the stack keeps wrapping and unboxing to the end. */
    function finale(from, to) {
      const s = kit.scene(content, from, to, { exit: 'fade' });
      kit.kinetic(s, [
        { text: 'Go', at: mark('outro-4', 'go'), color: 'cyan' },
        { text: 'Bruins!', at: mark('outro-4', 'bruins'), color: 'gold' },
      ], { y: 44, size: 64 });
      cameo(from + 0.25, song.duration - 0.2, { x: 96, y: 150, scale: 0.9 });
      const tower = net.stack(s, { x: 556, y: 132, w: 316, slabHeight: 52, gap: 12 });
      fx.rise(tower.node, from + 0.1, { distance: 24 });
      const know = mark('outro-4', 'know');
      net.LAYER_ORDER.forEach((layer, i) => tower.light(layer, know + i * 0.1, to));
      const stackAt = mark('outro-4', 'stack');
      kit.confetti(s, { x: 300, y: 260, at: stackAt + 0.1, seed: 7 });
      kit.confetti(s, { x: 700, y: 260, at: stackAt + 0.3, seed: 11 });
      stackRide(s, tower, stackAt + 1.2, song.duration - 0.6);
      const credit = kit.el('div', 'end-credit is-staged', s, 'SE Book · Networking');
      credit.style.top = '414px';
      fx.fadeIn(credit, stackAt + 1.6, 0.6);
    }

    /** A packet riding a stack's right edge: down (a box per layer), up (unboxed), repeating. */
    function stackRide(parent, tower, from, to) {
      const ride = kit.el('div', 'ride is-staged', parent);
      const rings = ['app', 'trn', 'net', 'lnk'].map((key, i) => {
        const ring = kit.el('div', `ride-ring ride-ring--${key}`, ride);
        const size = 18 + i * 12;
        ring.style.width = `${size}px`;
        ring.style.height = `${size}px`;
        ring.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`;
        return ring;
      });
      const stops = net.LAYER_ORDER.map((layer) => tower.edge(layer, 'right')).map(([x, y]) => [x + 34, y]);
      fx.fadeIn(ride, from, 0.3);
      const PERIOD = 3.6;
      onFrame((t) => {
        if (t < from || t > to) return;
        const phase = ((t - from) % PERIOD) / PERIOD;
        const going = phase < 0.5 ? easeInOutCubic(phase * 2) : 1 - easeInOutCubic((phase - 0.5) * 2);
        const position = going * (stops.length - 1);
        const index = Math.min(stops.length - 2, Math.floor(position));
        const f = position - index;
        const [x0, y0] = stops[index];
        const [x1, y1] = stops[index + 1];
        ride.style.left = `${(x0 + (x1 - x0) * f).toFixed(1)}px`;
        ride.style.top = `${(y0 + (y1 - y0) * f).toFixed(1)}px`;
        const boxes = 1 + Math.floor(position + 0.05);
        rings.forEach((ring, i) => { ring.style.opacity = i < boxes ? '1' : '0'; });
      });
    }

    intro();
    verse1();
    chorus(1);
    verse2();
    verse3();
    hook();
    chorus(2);
    verse4();
    bridge();
    quiz();
    chorus(3, { title: 'Final chorus', final: true });
    outro();
  };
})();
