/*
 * Choreography for "Let the Object Decide", the object-oriented programming
 * song (storyboard: _data/songs/let_the_object_decide.yml).
 *
 * Every visual hits a sung word: `mark(lineId, word)` is that word's time in
 * the recording. The teaching rule for the visuals: show exactly what the
 * line says, one idea per scene, in one consistent language (see
 * js/song-video/oop-kit.js): the town is the world (js/song-video/object-city.js),
 * an object card is its code, an envelope is a message, and the rule card
 * collects the five rules as the song teaches them. Each line's `visual`
 * text in the storyboard describes this file.
 *
 * Layout: 960×540 stage; the section badge sits top-left, and nothing
 * essential goes below y = 460, where the player draws captions.
 */
(function () {
  'use strict';

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.let_the_object_decide = function choreograph({ song, kit, layers, student }) {
    const { fx, tween, EASE, camera, onFrame } = window.Timeline;
    const ok = window.OopKit;
    const city = window.ObjectCity;
    const { content, hud } = layers;
    const line = (id) => song.line(id);
    const mark = (id, word) => song.mark(id, word);
    const end = (id) => song.sectionEnd(id);
    const start = (id) => song.sectionStart(id);

    function badge(text, sectionId) {
      kit.badge(hud, text, start(sectionId), end(sectionId));
    }

    // Keep diagrams still until the next idea; lateral exits compete with reading.
    function scene(parent, from, to, options = {}) {
      return kit.scene(parent, from, to, { exit: 'fade', ...options });
    }

    /** A scene that ends just before the line that replaces it. */
    function sceneUntil(from, nextLineId, options) {
      return scene(content, from, line(nextLineId).start - 0.12, options);
    }

    // Shared poses in a standard town (w = 440, h = 250): east lane, bus stop, bike lane.
    function lanes(town) {
      const g = town.geo;
      return { e: g.laneE, w: g.laneW, bike: g.bikeY, stop: g.stopX, n: g.laneN, s: g.laneS, x: g.roadX };
    }

    /** Stage point of a vehicle at time t (for envelopes and tags). */
    function at(town, vehicle, t, dy = 0) {
      const p = vehicle.position(t);
      return town.toStage(p.x, p.y + dy);
    }

    // ----------------------------------------------------------------
    // Intro: a city stored as a table and one giant if-chain
    // ----------------------------------------------------------------

    function intro() {
      const tokenAt = mark('intro-2', 'table');
      const chainEnd = line('intro-11').start - 0.1;
      student?.appear({ from: 0.6, to: line('intro-2').start - 0.2, x: 30, y: 170, scale: 0.9 });

      // One town for the first ten lines: real vehicles, then grey tokens.
      const town = city.town(content, { x: 492, y: 72, w: 440, h: 250, at: mark('intro-1', 'coding'), until: chainEnd, title: 'City Builder' });
      const L = lanes(town);
      town.vehicle('car', { x: 40, y: L.e, until: tokenAt }).drive(4.2, 6.4, [[150, L.e]]);
      town.vehicle('bus', { x: 420, y: L.w, a: 180, until: tokenAt }).drive(4.4, 6.4, [[300, L.w, 180]]);
      town.vehicle('bike', { x: 20, y: L.bike, until: tokenAt }).drive(4.6, 6.4, [[110, L.bike]]);
      town.vehicle('token', { x: 150, y: L.e, label: 'CAR', at: tokenAt })
        .drive(mark('intro-4', 'drive'), mark('intro-4', 'lane') + 0.8, [[410, L.e]]);
      // The bus drives to its stop, then rolls backward when its speed becomes −10.
      town.vehicle('token', { x: 250, y: L.e, label: 'BUS', at: tokenAt })
        .drive(mark('intro-5', 'stop'), mark('intro-5', 'stop_2') + 0.3, [[L.stop, L.e]])
        .drive(mark('intro-8', 'minus'), mark('intro-8', 'ten') + 0.5, [[L.stop - 90, L.e, 0]]);
      town.vehicle('token', { x: 110, y: L.bike, label: 'BIKE', at: tokenAt })
        .drive(mark('intro-6', 'take'), mark('intro-6', 'lane') + 0.6, [[330, L.bike]]);

      // Version one: a table and one loop with a type switch.
      const b = scene(content, line('intro-2').start - 0.05, chainEnd);
      const data = ok.table(b, {
        x: 36, y: 62, w: 340, cols: ['x', 'y', 'speed', 'type'],
        rows: [['150', '151', '30', 'CAR'], ['250', '151', '20', 'BUS'], ['110', '102', '10', 'BIKE']],
        at: tokenAt,
      });
      data.highlightColumn(3, mark('intro-2', 'type'), mark('intro-3', 'every'));
      // The same chain again for drawing and braking, stacked behind the loop.
      const branchLines = ['  if (type[i] == CAR) …', '  else if (type[i] == BUS) …', '  else if (type[i] == BIKE) …'];
      ok.code(b, { x: 80, y: 190, w: 396, title: 'brake()', lines: ['for (int i = 0; i < n; i++) {', ...branchLines], at: mark('intro-7', 'braking') });
      ok.code(b, { x: 58, y: 211, w: 418, title: 'draw()', lines: ['for (int i = 0; i < n; i++) {', ...branchLines], at: mark('intro-7', 'drawing') });
      const loop = ok.code(b, {
        x: 36, y: 232, w: 440, title: 'update()', at: mark('intro-3', 'every'),
        lines: [
          'for (int i = 0; i < n; i++) {',
          { text: '  if (type[i] == CAR) driveLane(i);', at: mark('intro-4', 'car') },
          { text: '  else if (type[i] == BUS) stopAtStop(i);', at: mark('intro-5', 'bus') },
          { text: '  else if (type[i] == BIKE) useBikeLane(i);', at: mark('intro-6', 'bike') },
          '}',
        ],
      });
      loop.mark(1, mark('intro-4', 'car'), line('intro-5').start);
      loop.mark(2, mark('intro-5', 'bus'), line('intro-6').start);
      loop.mark(3, mark('intro-6', 'bike'), line('intro-7').start);
      for (const row of [1, 2, 3]) loop.mark(row, mark('intro-7', 'same'), line('intro-8').start, 'focus');
      ok.label(b, 'same if-chain ×3', { x: 330, y: 186, at: mark('intro-7', 'same_2'), until: line('intro-8').start, tone: 'gold', rotate: 3 });

      // Any line can write any speed: the bus goes −10.
      const writers = ['speed[0] += 5;', 'speed[1] = -10;', 'speed[2] = 0;'];
      writers.forEach((text, i) => {
        const chip = ok.label(b, text, { x: 394, y: 62 + i * 40, at: mark('intro-8', 'line') + i * 0.12, until: line('intro-9').start + 0.6, tone: 'mono' });
        chip.classList.add('oop-label--mono');
        kit.flow(b, { from: [392, 78 + i * 40], to: [258, 102 + i * 31], bend: -14, color: i === 1 ? 'pink' : 'gold', at: mark('intro-8', 'write') + i * 0.1, until: line('intro-9').start + 0.6 });
      });
      data.set(1, 2, mark('intro-8', 'minus'), '-10', 'bad');
      kit.stamp(b, '−10?!', { x: 640, y: 300, at: mark('intro-8', 'ten'), until: line('intro-9').start + 0.4, small: true, rotate: -6 });

      ok.ticket(b, { x: 656, y: 230, from: 'Mayor’s office', title: 'Feature request: ambulances', at: mark('intro-9', 'mayor') });
      ok.search(b, { x: 498, y: 392, query: 'type[i] ==', count: 37, at: mark('intro-10', 'search'), countFrom: mark('intro-10', 'type'), countTo: mark('intro-10', 'seven') });

      // That's not a city: the skyline is one giant if-chain.
      const c = scene(content, line('intro-11').start - 0.1, line('intro-12').start - 0.12);
      const towers = kit.el('div', 'oop-towers', c);
      const heights = [5, 8, 4, 10, 6, 9];
      heights.forEach((rows, i) => {
        const tower = kit.el('div', 'oop-tower is-staged', towers);
        for (let r = 0; r < rows; r++) kit.el('div', 'oop-tower-line', tower, r % 3 === 0 ? 'if (type ==' : 'else if (…)');
        tween(tower, [{ opacity: 0, translate: '0 60px' }, { opacity: 1, translate: '0 0' }], mark('intro-11', 'thats_2') + i * 0.05, 0.45, EASE.out);
      });
      kit.stamp(c, 'switch statement', { x: 300, y: 70, at: mark('intro-11', 'switch'), rotate: -4 });

      // Two Norwegians: every thing in the world becomes a thing in the code.
      const d = scene(content, line('intro-12').start - 0.1, end('intro'));
      ok.nameCard(d, { x: 280, y: 74, name: 'Ole-Johan Dahl & Kristen Nygaard', detail: 'Norway · 1960s', at: mark('intro-12', 'sixties'), until: line('intro-13').start - 0.1 });
      const world = city.town(d, { x: 260, y: 96, w: 440, h: 240, at: mark('intro-13', 'make'), until: mark('intro-14', 'let') - 0.1, title: 'City Builder' });
      const WL = lanes(world);
      const wCar = world.vehicle('car', { x: 60, y: WL.e }).drive(34.5, 37, [[150, WL.e]]);
      const wBus = world.vehicle('bus', { x: 320, y: WL.e }).drive(34.5, 37, [[WL.stop, WL.e]]);
      const wBike = world.vehicle('bike', { x: 260, y: WL.bike }).drive(34.5, 37, [[400, WL.bike]]);
      ok.magnifier(d, { x: 250, y: 160, at: mark('intro-13', 'every'), until: mark('intro-13', 'code') + 0.4, hat: false, path: [[0, 0], [380, 10]] });
      [[wCar, 'car : Car', 'world'], [wBus, 'bus : Bus', 'a'], [wBike, 'bike : Bike', 'thing_2']].forEach(([v, title, word], i) => {
        const [sx, sy] = at(world, v, mark('intro-13', word));
        ok.label(d, title, { x: sx - 40, y: sy - 56 - (i === 2 ? 10 : 0), at: mark('intro-13', word), until: mark('intro-14', 'let') - 0.1, tone: 'cyan' });
      });
      kit.kinetic(d, [
        { text: 'Let the', at: mark('intro-14', 'let') },
        { text: 'object', at: mark('intro-14', 'object'), color: 'gold' },
        { text: 'decide', at: mark('intro-14', 'decide'), color: 'cyan' },
      ], { y: 220, size: 66 });
    }

    // ----------------------------------------------------------------
    // Verse 1: a record becomes an object; a class makes many objects
    // ----------------------------------------------------------------

    function verse1() {
      badge('Verse 1 · From record to object', 'verse-1');
      // A record: fields only, NPC energy.
      const a = sceneUntil(start('verse-1'), 'verse-1-5');
      ok.nameCard(a, { x: 340, y: 60, name: 'Tony Hoare', detail: 'record · 1966', at: mark('verse-1-1', 'hoares'), until: line('verse-1-3').start });
      const record = ok.objectCard(a, {
        x: 340, y: 150, w: 280, kind: 'record', title: 'record Car',
        fields: [['x', '40'], ['y', '151'], ['speed', '30']], at: mark('verse-1-1', 'record'),
      });
      ['x', 'y', 'speed'].forEach((name) => record.focus(name, mark('verse-1-2', name), line('verse-1-3').start));
      onFrame((t) => {
        const from = line('verse-1-3').start;
        record.node.style.rotate = t > from && t < line('verse-1-5').start ? `${(1.6 * Math.sin((t - from) * 2.2)).toFixed(2)}deg` : '';
      });
      const npc = ok.label(a, 'NPC', { x: 452, y: 106, at: mark('verse-1-3', 'npc'), tone: 'violet' });
      fx.bump(npc, mark('verse-1-3', 'npc_2'), 0.3);
      ok.bubble(a, '…', { x: 640, y: 120, at: mark('verse-1-3', 'moves'), tail: 'left' });
      ok.code(a, {
        x: 640, y: 300, w: 280, title: 'game.cpp', at: mark('verse-1-4', 'other'),
        lines: ['void updateCar(Car& c) {', '  int s = c.speed;', '}'],
      });
      kit.flow(a, { from: [652, 330], to: [520, 262], bend: -30, color: 'cyan', at: mark('verse-1-4', 'read') - 0.1 });

      // Simula: the record gets work to do.
      const b = sceneUntil(line('verse-1-5').start - 0.12, 'verse-1-9');
      const simula = kit.place(kit.el('div', 'oop-name is-staged', b), 330, 60);
      kit.el('div', 'oop-name-main', simula, 'Simula 67');
      const detail = kit.el('div', 'oop-name-detail oop-acronym', simula);
      for (const [text, lit] of [['SIMU', true], ['lation ', false], ['LA', true], ['nguage', false]]) {
        const part = kit.el('span', lit ? 'oop-acronym-part' : null, detail, text);
        if (lit) ok.during(part, 'is-lit', mark('verse-1-5', 'simulation'));
      }
      ok.enter(simula, mark('verse-1-5', 'simula'));
      const object = ok.objectCard(b, {
        x: 70, y: 150, w: 280, kind: 'object', title: 'car : Car',
        fields: [['x', '40'], ['y', '151'], ['speed', '30']], methods: ['steer()', 'brake()'],
        at: mark('verse-1-5', 'then'), methodsAt: mark('verse-1-6', 'work'),
      });
      ok.label(b, 'data + behavior', { x: 120, y: 410, at: mark('verse-1-6', 'do'), tone: 'gold' });
      ['x', 'y', 'speed'].forEach((name) => object.focus(name, mark('verse-1-7', 'knows'), line('verse-1-8').start));
      const road = city.town(b, { x: 420, y: 150, w: 500, h: 200, at: mark('verse-1-7', 'now'), title: 'Simulation' });
      const R = lanes(road);
      const car = road.vehicle('car', { x: 70, y: R.e })
        .drive(mark('verse-1-8', 'steer'), mark('verse-1-8', 'and_2'), [[150, R.e], [230, R.w]])
        .drive(mark('verse-1-8', 'brake'), mark('verse-1-8', 'too') + 0.3, [[300, R.w]], { ease: 'out' });
      car.brake(mark('verse-1-8', 'brake'), line('verse-1-9').start);
      const [px, py] = at(road, car, mark('verse-1-7', 'place'));
      ok.label(b, 'x, y', { x: px - 20, y: py - 62, at: mark('verse-1-7', 'place'), until: mark('verse-1-8', 'steer'), tone: 'cyan' });
      ok.label(b, 'speed 30', { x: px + 34, y: py - 62, at: mark('verse-1-7', 'speed'), until: mark('verse-1-8', 'steer'), tone: 'cyan' });
      object.light('steer()', mark('verse-1-8', 'steer'), mark('verse-1-8', 'and_2'));
      object.light('brake()', mark('verse-1-8', 'brake'), line('verse-1-9').start);
      object.setValue('x', mark('verse-1-8', 'and_2'), '230').setValue('y', mark('verse-1-8', 'and_2'), '125');
      object.setValue('speed', mark('verse-1-8', 'too'), '0');

      // A class is a blueprint; `new` stamps out objects with their own state.
      const c = scene(content, line('verse-1-9').start - 0.12, end('verse-1'));
      ok.objectCard(c, {
        x: 40, y: 92, w: 250, kind: 'blueprint', title: 'class Car',
        fields: [['color'], ['x'], ['y'], ['speed']], methods: ['steer()', 'brake()'], at: mark('verse-1-9', 'class'),
      });
      ok.label(c, 'blueprint', { x: 96, y: 66, at: mark('verse-1-9', 'blueprint'), tone: 'cyan' });
      const lot = city.town(c, { x: 320, y: 66, w: 610, h: 150, at: mark('verse-1-10', 'new'), title: 'City Builder' });
      const P = lanes(lot);
      const specs = [
        { word: 'car', color: 'red', cls: '', speed: '20', x: 70 },
        { word: 'car_2', color: 'blue', cls: 'oc-car--blue', speed: '30', x: 300 },
        { word: 'car_3', color: 'gold', cls: 'oc-car--gold', speed: '0', x: 520 },
      ];
      const cards = specs.map((spec, i) => {
        const appear = mark('verse-1-10', spec.word);
        const v = lot.vehicle('car', { x: spec.x, y: P.e, at: appear, cls: spec.cls });
        if (i === 1) v.drive(mark('verse-1-12', 'eighty'), end('verse-1'), [[640, P.e]], { ease: 'in' });
        const [sx] = lot.toStage(spec.x, 0);
        kit.stamp(c, 'new', { x: sx - 30, y: 140, at: appear - 0.08, until: appear + 0.45, small: true, shake: false, rotate: -8 });
        return ok.objectCard(c, {
          x: 330 + i * 200, y: 262, w: 186, compact: true, title: `car${i + 1} : Car`,
          fields: [['color', spec.color], ['speed', spec.speed]], methods: ['steer()', 'brake()'], at: appear + 0.1,
        });
      });
      for (const card of cards) {
        tween(card.methodBox, [{ backgroundColor: 'rgba(255, 209, 0, 0)' }, { backgroundColor: 'rgba(255, 209, 0, 0.35)' }], mark('verse-1-11', 'methods'), 0.25, EASE.out);
        card.focus('color', mark('verse-1-11', 'different'), line('verse-1-12').start);
        card.focus('speed', mark('verse-1-11', 'different'), line('verse-1-12').start);
      }
      ok.label(c, 'same methods', { x: 600, y: 226, at: mark('verse-1-11', 'methods'), until: line('verse-1-12').start, tone: 'gold' });
      ok.label(c, 'different values', { x: 770, y: 226, at: mark('verse-1-11', 'values'), until: line('verse-1-12').start, tone: 'cyan' });
      ok.label(c, 'mine', { x: 360, y: 226, at: mark('verse-1-12', 'mine'), tone: 'violet' });
      cards[0].focus('color', mark('verse-1-12', 'red'), end('verse-1'), 'good');
      ok.label(c, 'yours', { x: 560, y: 226, at: mark('verse-1-12', 'yours'), tone: 'violet' });
      cards[1].setValue('speed', mark('verse-1-12', 'eighty'), '80', 'focus');
    }

    // ----------------------------------------------------------------
    // Pre-chorus: cells, computers, messages
    // ----------------------------------------------------------------

    function preChorus() {
      badge('Pre-chorus · Messages', 'pre-chorus');
      const s = scene(content, start('pre-chorus'), end('pre-chorus'));
      ok.nameCard(s, { x: 340, y: 62, name: 'Alan Kay', detail: 'Smalltalk · 1970s', at: mark('pre-chorus-1', 'kay') });
      const spots = [[170, 200], [420, 240], [670, 200]];
      const machines = spots.map(([x, y], i) => ok.cellComputer(s, { x, y, at: mark('pre-chorus-2', 'cells') - 0.3 + i * 0.12, morphAt: mark('pre-chorus-3', 'computers') + i * 0.08 }));
      machines.forEach(({ nucleusLabel }) => tween(nucleusLabel, { opacity: 0 }, mark('pre-chorus-3', 'computers'), 0.25, EASE.in));
      const cables = kit.svg('svg', { class: 'oop-cables is-staged', viewBox: '0 0 960 540' }, s);
      const wires = [[[290, 260], [420, 290]], [[540, 290], [670, 260]]].map(([[x1, y1], [x2, y2]]) => kit.svg('path', { class: 'oop-cable', d: `M ${x1} ${y1} L ${x2} ${y2}` }, cables));
      fx.fadeIn(cables, mark('pre-chorus-3', 'network') - 0.05, 0.1);
      wires.forEach((wire, i) => fx.draw(wire, mark('pre-chorus-3', 'network') + i * 0.1, 0.35));
      ok.envelope(s, { from: [230, 250], to: [480, 290], bend: -40, at: mark('pre-chorus-4', 'talk'), dur: 0.6, trail: false });
      ok.envelope(s, { from: [480, 290], to: [730, 250], bend: -40, at: mark('pre-chorus-4', 'messages'), dur: 0.6, trail: false, tone: 'cyan' });
      ok.reach(s, { from: [960, 120], to: [520, 250], at: mark('pre-chorus-5', 'reach') - 0.25, blockAt: mark('pre-chorus-5', 'in'), until: mark('pre-chorus-5', 'send'), stopShort: 30 });
      const plane = kit.place(kit.el('div', 'oop-plane is-staged', s), 440, 280);
      plane.append(ok.glyph('plane'));
      tween(plane, [{ opacity: 0, scale: 0.6, translate: '0 0' }, { opacity: 1, scale: 1, translate: '0 -20px', offset: 0.25 }, { opacity: 0, scale: 4.2, translate: '0 -60px' }], mark('pre-chorus-5', 'send'), 0.6, EASE.in);
    }

    // ----------------------------------------------------------------
    // The chorus: world → objects, state inside, messages, the object decides
    // ----------------------------------------------------------------

    /**
     * One chorus. ids = the section's line ids in order (7 or 8 lines);
     * `cast` = the vehicles in town; `promise` adds the seal line (final).
     */
    function chorus(sectionId, ids, { cast = ['car', 'bus', 'bike'], promise = false, rulesShown = 0, titleUntil } = {}) {
      badge(promise ? 'Final chorus' : 'Chorus', sectionId);
      const from = start(sectionId);
      const until = titleUntil ?? end(sectionId);
      const [l1, l2, l3, l4, l5, l6, ...rest] = ids;
      const s = scene(content, from, until);
      const town = city.town(s, { x: 24, y: 64, w: 440, h: 250, at: from + 0.05, title: 'The world' });
      const L = lanes(town);
      const startX = { car: 40, hybrid: 0, bus: 250, bike: 30, ambulance: 120 };
      const lanesFor = { car: L.e, hybrid: L.w, bus: L.e, bike: L.bike, ambulance: L.w };
      const angle = { hybrid: 180, ambulance: 180 };
      const fleet = Object.fromEntries(cast.map((kind) => [kind, town.vehicle(kind, { x: kind === 'hybrid' ? 300 : kind === 'ambulance' ? 410 : startX[kind], y: lanesFor[kind], a: angle[kind] || 0 })]));
      // Line 1: every vehicle has its own object card.
      const a = scene(s, from, line(l2).start - 0.12, { exit: 'fade' });
      ok.label(a, 'the world', { x: 190, y: 36, at: mark(l1, 'world'), tone: 'cyan' });
      ok.label(a, 'the code', { x: 640, y: 36, at: line(l1).start + 0.3, tone: 'gold' });
      // Two cards on top, one below between them, so none overlaps.
      const miniSpots = [[500, 66], [730, 66], [615, 232]];
      cast.slice(0, 3).forEach((kind, i) => {
        const [mx, my] = miniSpots[i];
        ok.objectCard(a, {
          x: mx, y: my, w: 210, compact: true, title: `${kind} : ${className(kind)}`,
          fields: [['speed', String(20 + i * 10)]], methods: ['move()'], at: line(l1).start + 0.15 + i * 0.15,
        });
        const [vx, vy] = at(town, fleet[kind], mark(l1, 'in'));
        kit.flow(a, { from: [vx + 18, vy - 8], to: [mx - 4, my + 40], bend: -30 - i * 10, color: 'cyan', at: mark(l1, 'objects') + i * 0.08 });
      });

      // Lines 2–4: one card, state locked inside; a message, not a reaching hand.
      const b = scene(s, line(l2).start - 0.12, line(l5).start - 0.12, { exit: 'fade' });
      const card = ok.objectCard(b, {
        x: 560, y: 72, w: 300, title: 'car : Car', fields: [['x', '120'], ['speed', '30']],
        methods: ['move()', 'brake()', 'steer()'], at: line(l2).start, unlocked: true, lockAt: mark(l2, 'locked'),
      });
      tween(card.methodBox, [{ backgroundColor: 'rgba(255, 209, 0, 0)' }, { backgroundColor: 'rgba(255, 209, 0, 0.3)' }, { backgroundColor: 'rgba(255, 209, 0, 0)' }], mark(l2, 'code'), 0.8, EASE.inOut);
      ok.label(b, 'locked', { x: 800, y: 40, at: mark(l2, 'locked'), tone: 'gold', rotate: 4 });
      ok.reach(b, { from: [960, 330], to: [760, 160], at: mark(l3, 'dont') - 0.15, blockAt: mark(l3, 'in'), until: line(l5).start - 0.3, stopShort: 6 });
      const [cx, cy] = at(town, fleet.car, mark(l3, 'send'));
      ok.envelope(b, { from: [cx, cy], to: [620, 222], label: 'brake()', at: mark(l3, 'send'), dur: 0.7, bend: -70 });
      card.light('brake()', mark(l3, 'message') + 0.3, line(l5).start);
      fleet.car.drive(mark(l4, 'object'), mark(l4, 'decide') + 0.4, [[130, L.e]], { ease: 'out' });
      fleet.car.brake(mark(l4, 'object'), line(l5).start);

      // Line 5: one move() message, different moves.
      const c = scene(s, line(l5).start - 0.12, line(rest[0]).start - 0.12, { exit: 'fade' });
      ok.code(c, { x: 520, y: 72, w: 410, title: 'loop', at: line(l5).start, lines: ['for (Vehicle* v : vehicles)', '  v->move();'] });
      const sendAt = mark(l5, 'message');
      const moveAt = mark(l5, 'different');
      cast.forEach((kind, i) => {
        const v = fleet[kind];
        const [vx, vy] = at(town, v, sendAt + 0.6);
        ok.envelope(c, { from: [560, 130], to: [vx, vy - 10], label: 'move()', at: sendAt + i * 0.08, dur: 0.55, bend: -40, stay: 1.25, tone: i % 2 ? 'cyan' : 'gold' });
        moveOf(kind, v, L, moveAt, line(l6).start);
        methodTag(c, kind, i, mark(l5, 'moves') + i * 0.06);
      });
      const ask = ok.bubble(c, 'What type are you?', { x: 560, y: 316, at: mark(l6, 'dont'), tail: 'left' });
      tween(ask, { opacity: 0, translate: '220px -20px', rotate: '12deg' }, mark(l6, 'you') + 0.25, 0.35, EASE.in);

      // Promise line (final chorus): every card gets its seal.
      let titleLine = rest[0];
      if (promise) {
        const [lp, lt] = rest;
        titleLine = lt;
        const p = scene(s, line(lp).start - 0.12, line(lt).start - 0.12, { exit: 'fade' });
        cast.forEach((kind, i) => {
          const sealCard = ok.objectCard(p, { x: 24 + i * 184, y: 346, w: 170, compact: true, title: objectTitle(kind), methods: ['move()'], at: line(lp).start + i * 0.06 });
          sealCard.seal(mark(lp, 'keep') + i * 0.08);
        });
      }
      // The title line: the words stamp in, and the rule card lists the rules so far.
      const t = scene(s, line(titleLine).start - 0.12, until, { exit: 'fade' });
      kit.kinetic(t, [
        { text: 'Let the', at: mark(titleLine, 'let') },
        { text: 'object', at: mark(titleLine, 'object'), color: 'gold' },
        { text: 'decide', at: mark(titleLine, 'decide'), color: 'cyan' },
      ], { y: 372, size: 50 });
      const rules = ok.ruleCard(t, { x: 708, y: 150, at: line(titleLine).start, shown: rulesShown });
      if (rulesShown < 3) [0, 1, 2].forEach((i) => rules.add(i, mark(titleLine, 'let') + i * 0.18));
      if (promise) {
        rules.add(3, line(titleLine).start + 0.15);
        rules.glow(3, line(titleLine).start + 0.15, until);
      } else {
        rules.glow(2, mark(titleLine, 'decide'), until);
      }
    }

    function className(kind) {
      return { car: 'Car', hybrid: 'HybridCar', bus: 'Bus', bike: 'Bike', ambulance: 'Ambulance' }[kind];
    }

    /** An object card title, `name : Class`, short enough for a compact card. */
    function objectTitle(kind) {
      return `${{ car: 'car', hybrid: 'hy', bus: 'bus', bike: 'bike', ambulance: 'amb' }[kind]} : ${className(kind)}`;
    }

    /** `Kind::move` tags in a two-column list under the loop card, one per vehicle. */
    function methodTag(parent, kind, i, atTime, until) {
      const tag = ok.label(parent, `${className(kind)}::move`, { x: 540 + (i % 2) * 196, y: 182 + Math.floor(i / 2) * 40, at: atTime, until, tone: 'mono' });
      tag.classList.add('oop-label--mono');
      return tag;
    }

    /**
     * Each kind's own move(): the car turns north at the crossing, the bus
     * pulls into its stop, the bike rides its lane, the hybrid and the
     * ambulance drive west. Paths never cross, so no vehicle hides another.
     */
    function moveOf(kind, v, L, from, to) {
      const p = v.position(from);
      if (kind === 'car') return v.drive(from, to, [[L.n, L.e], [L.n, 14]]);
      if (kind === 'bus') return v.drive(from, to, [[L.stop, L.e]]);
      if (kind === 'bike') return v.drive(from, to, [[Math.min(420, p.x + 170), L.bike]]);
      if (kind === 'hybrid') return v.drive(from, to, [[Math.max(220, p.x - 90), L.w, 180]]);
      return v.drive(from, to, [[Math.max(320, p.x - 90), L.w, 180]]).flag('is-siren', from, to + 1);
    }

    // ----------------------------------------------------------------
    // Post-chorus: just send it — every vehicle answers the beat its own way
    // ----------------------------------------------------------------

    function postChorus(sectionId, { cast = ['car', 'bus', 'bike'], message = 'move()' } = {}) {
      badge('Post-chorus · Just send it', sectionId);
      const from = start(sectionId);
      const until = end(sectionId);
      const id = (n) => `${sectionId}-${n}`;
      const s = scene(content, from, until);
      student?.appear({ from, to: until, x: 0, y: 236, scale: 0.72 });
      const town = city.town(s, { x: 250, y: 56, w: 660, h: 300, at: from + 0.05, title: 'City Builder' });
      const L = lanes(town);
      const spots = {
        car: [120, L.e, 0], hybrid: [520, L.w, 180], bus: [L.stop + 30, L.e, 0], bike: [300, L.bike, 0], ambulance: [380, L.w, 180],
      };
      if (message === 'brake()') { spots.car = [140, L.e, 0]; spots.hybrid = [60, L.e, 0]; }
      const fleet = cast.map((kind) => {
        const [x, y, a] = spots[kind];
        return { kind, v: town.vehicle(kind, { x, y, a }) };
      });
      const laptop = [150, 400];
      const volley = (atTime) => fleet.forEach(({ v }, i) => {
        const [vx, vy] = at(town, v, atTime + 0.5);
        ok.envelope(s, { from: laptop, to: [vx, vy - 10], label: i === 0 ? message : undefined, at: atTime + i * 0.05, dur: 0.45, bend: -80, stay: 1.1, tone: i % 2 ? 'cyan' : 'gold' });
      });
      volley(mark(id(1), 'send'));
      volley(mark(id(3), 'send'));
      const danceFrom = mark(id(2), 'same');
      const danceTo = line(id(4)).start;
      fleet.forEach(({ kind, v }, i) => {
        if (message === 'brake()') {
          v.brake(danceFrom, until);
          if (kind === 'hybrid') v.flag('is-battery-full', mark(id(2), 'moves'), until);
          const [vx, vy] = at(town, v, danceFrom);
          ok.label(s, kind === 'hybrid' ? 'HybridCar::brake · battery' : 'Car::brake · pads', { x: vx - 70, y: vy + (i ? 30 : -62), at: mark(id(2), 'different') + i * 0.12, until: danceTo + 0.4, tone: kind === 'hybrid' ? 'cyan' : 'gold' });
        } else {
          v.dance(danceFrom, until);
          const [vx, vy] = at(town, v, danceFrom);
          ok.label(s, `${className(kind)}::move`, { x: vx - 50, y: vy - 56, at: mark(id(2), 'different') + i * 0.06, until: danceTo + 0.4, tone: 'mono' }).classList.add('oop-label--mono');
        }
      });
      kit.kinetic(s, [
        { text: 'Let the', at: mark(id(4), 'let') },
        { text: 'object', at: mark(id(4), 'object'), color: 'gold' },
        { text: 'decide', at: mark(id(4), 'decide'), color: 'cyan' },
      ], { y: 380, size: 48 });
    }

    // ----------------------------------------------------------------
    // Verse 2: reaching in vs. sending brake()
    // ----------------------------------------------------------------

    function verse2() {
      badge('Verse 2 · Don’t reach in', 'verse-2');
      const from = start('verse-2');
      const sceneEnd = line('verse-2-10').start - 0.12;
      const s = scene(content, from, sceneEnd);
      const town = city.town(s, { x: 24, y: 64, w: 440, h: 250, at: from + 0.05, title: 'City Builder' });
      const L = lanes(town);
      town.signal('red', mark('verse-2-1', 'red'));
      const car = town.vehicle('car', { x: 20, y: L.e });
      const hybrid = town.vehicle('hybrid', { x: -40, y: L.e });
      const zero = mark('verse-2-3', 'zero');
      // The old way: driving, then a jolt to zero.
      car.drive(from, zero, [[110, L.e]]);
      hybrid.drive(from, zero, [[50, L.e]]);
      // The new way: the same approach again, slowing on brake().
      const replay = mark('verse-2-5', 'new');
      car.set(replay, 20, L.e).drive(replay + 0.05, mark('verse-2-6', 'squeezes'), [[90, L.e]])
        .drive(mark('verse-2-6', 'squeezes'), mark('verse-2-6', 'pads') + 0.5, [[130, L.e]], { ease: 'out' });
      hybrid.set(replay, -40, L.e).drive(replay + 0.05, mark('verse-2-7', 'recharges'), [[50, L.e]])
        .drive(mark('verse-2-7', 'recharges'), mark('verse-2-7', 'battery') + 0.4, [[80, L.e]], { ease: 'out' });
      car.brake(mark('verse-2-6', 'squeezes'), sceneEnd);
      hybrid.brake(mark('verse-2-7', 'recharges'), sceneEnd);
      hybrid.flag('is-battery-full', mark('verse-2-7', 'battery'), sceneEnd);
      // Skid marks behind the jolted cars.
      const skid = kit.svg('g', { class: 'oop-skid' }, town.overlay);
      kit.svg('path', { d: `M60 ${L.e - 6} H100 M60 ${L.e + 6} H100 M5 ${L.e - 6} H40 M5 ${L.e + 6} H40` }, skid);
      skid.style.opacity = '0';
      tween(skid, [{ opacity: 0 }, { opacity: 1 }], zero, 0.15, EASE.out);
      tween(skid, { opacity: 0 }, replay, 0.2, EASE.in);

      const carCard = ok.objectCard(s, { x: 520, y: 64, w: 200, compact: true, title: 'car : Car', fields: [['speed', '40']], methods: ['brake()'], at: from + 0.3 });
      const hybridCard = ok.objectCard(s, { x: 740, y: 64, w: 200, compact: true, title: 'hy : HybridCar', fields: [['speed', '40'], ['battery', '20%']], methods: ['brake()'], at: from + 0.45 });
      const code = ok.code(s, {
        x: 520, y: 300, w: 420, title: 'trafficLight.cpp', at: mark('verse-2-1', 'old'), until: line('verse-2-8').start - 0.1,
        lines: [{ text: 'car->speed = 0;   // old way', swap: [{ at: mark('verse-2-5', 'message'), text: 'car->brake();     // new way' }] }],
      });
      code.mark(0, mark('verse-2-1', 'old'), mark('verse-2-5', 'new'), 'del');
      code.mark(0, mark('verse-2-5', 'message'), line('verse-2-8').start, 'add');
      // The light reaches into every car's state.
      const [lx, ly] = town.toStage(town.geo.light.x, town.geo.light.y + 10);
      ok.reach(s, { from: [lx, ly], to: [560, 128], at: mark('verse-2-2', 'reaches'), until: mark('verse-2-5', 'new'), tone: 'gold' });
      ok.reach(s, { from: [lx, ly], to: [780, 128], at: mark('verse-2-2', 'every'), until: mark('verse-2-5', 'new'), tone: 'gold' });
      carCard.setValue('speed', zero, '0', 'bad', replay);
      hybridCard.setValue('speed', zero, '0', 'bad', replay);
      kit.stamp(s, 'Screech!', { x: 110, y: 334, at: mark('verse-2-3', 'screech'), until: mark('verse-2-5', 'new'), small: true, rotate: -5 });
      ok.label(s, 'no brake lights', { x: 330, y: 344, at: mark('verse-2-4', 'brake'), until: mark('verse-2-5', 'new'), tone: 'fail', mark: 'fail' });
      ok.chatNotice(s, 'Physics has left the chat', { x: 540, y: 238, at: mark('verse-2-4', 'chat') - 0.15, until: mark('verse-2-5', 'message') });
      // The new way: speeds recover, and the light sends brake().
      carCard.setValue('speed', replay, '40').setValue('speed', mark('verse-2-6', 'pads') + 0.4, '0', 'good');
      hybridCard.setValue('speed', replay, '40').setValue('speed', mark('verse-2-7', 'battery') + 0.3, '0', 'good');
      hybridCard.setValue('battery', mark('verse-2-7', 'battery'), '60%', 'good');
      [[car, mark('verse-2-5', 'brake')], [hybrid, mark('verse-2-5', 'brake_2')]].forEach(([v, sendAt], i) => {
        const [vx, vy] = at(town, v, sendAt + 0.6);
        ok.envelope(s, { from: [lx, ly], to: [vx, vy - 8], label: 'brake()', at: sendAt, dur: 0.55, bend: -40, tone: i ? 'cyan' : 'gold' });
      });
      carCard.light('brake()', mark('verse-2-6', 'squeezes'), mark('verse-2-9', 'stays'));
      hybridCard.light('brake()', mark('verse-2-7', 'recharges'), mark('verse-2-9', 'stays'));
      carCard.panel('Car::brake', { at: mark('verse-2-6', 'squeezes'), until: mark('verse-2-9', 'stays'), iconName: 'pads', side: 'below' });
      hybridCard.panel('HybridCar::brake', { at: mark('verse-2-7', 'recharges'), until: mark('verse-2-9', 'stays'), iconName: 'battery', side: 'below' });
      // What the light sees: two identical Vehicles.
      const sees = kit.place(kit.el('div', 'oop-sees is-staged', s), 540, 306);
      kit.el('div', 'oop-sees-title', sees, 'What the light sees');
      const row = kit.el('div', 'oop-sees-row', sees);
      for (let i = 0; i < 2; i++) {
        const item = kit.el('div', 'oop-sees-item', row);
        const art = kit.svg('svg', { viewBox: '-24 -14 48 28', width: 70, height: 40, 'aria-hidden': 'true' }, item);
        kit.svg('rect', { class: 'oop-silhouette', x: -21, y: -10, width: 42, height: 20, rx: 6 }, art);
        kit.el('code', null, item, 'Vehicle');
      }
      ok.enter(sees, mark('verse-2-8', 'light'));
      ok.label(s, 'inside the car', { x: 600, y: 22, at: mark('verse-2-9', 'how'), tone: 'cyan' });

      // Getters and setters for every field: a struct in a trench coat.
      const b = scene(content, sceneEnd, end('verse-2'));
      const exposed = ok.objectCard(b, {
        x: 70, y: 84, w: 340, title: 'car : Car', fields: [['x', '120'], ['y', '151'], ['speed', '40']],
        methods: ['getX()', 'setX()', 'getY()', 'setY()', 'getSpeed()', 'setSpeed()'], at: line('verse-2-10').start,
      });
      exposed.unlock(mark('verse-2-10', 'field'));
      ['getX()', 'setX()', 'getY()', 'setY()', 'getSpeed()', 'setSpeed()'].forEach((name, i) => {
        exposed.light(name, mark('verse-2-10', i % 2 ? 'setters' : 'getters') + Math.floor(i / 2) * 0.1, end('verse-2'));
      });
      const wires = kit.svg('svg', { class: 'oop-wires is-staged', viewBox: '0 0 960 540' }, b);
      [[150, 300, 140, 186], [240, 300, 150, 186], [140, 330, 150, 208], [230, 330, 160, 208], [320, 300, 180, 230], [330, 330, 190, 230]].forEach(([x1, y1, x2, y2], i) => {
        const wire = kit.svg('path', { class: 'oop-wire', d: `M ${x1} ${y1} Q ${(x1 + x2) / 2 + 60} ${(y1 + y2) / 2} ${x2} ${y2}` }, wires);
        fx.draw(wire, mark('verse-2-10', 'every') + i * 0.06, 0.3);
      });
      fx.fadeIn(wires, mark('verse-2-10', 'every') - 0.05, 0.1);
      ok.trenchCoat(b, { x: 560, y: 70, at: mark('verse-2-11', 'thats'), dropAt: mark('verse-2-11', 'trench') });
      kit.stamp(b, 'Busted!', { x: 600, y: 340, at: mark('verse-2-11', 'trench'), small: true, rotate: 6 });
    }

    // ----------------------------------------------------------------
    // Verse 3: one message, many moves; a new class, no edits to the loop
    // ----------------------------------------------------------------

    function verse3() {
      badge('Verse 3 · One message, many moves', 'verse-3');
      const from = start('verse-3');
      const until = end('verse-3');
      const s = scene(content, from, until);
      const town = city.town(s, { x: 24, y: 64, w: 470, h: 270, at: from + 0.05, title: 'City Builder' });
      const L = lanes(town);
      const car = town.vehicle('car', { x: 40, y: L.e });
      town.vehicle('hybrid', { x: 400, y: L.w, a: 180 });
      const bus = town.vehicle('bus', { x: 250, y: L.e });
      const bike = town.vehicle('bike', { x: 30, y: L.bike });
      const loop = ok.code(s, { x: 528, y: 66, w: 410, title: 'city.cpp', at: mark('verse-3-1', 'frame'), lines: ['for (Vehicle* v : vehicles)', '  v->move();'] });
      loop.mark(1, mark('verse-3-1', 'move'), line('verse-3-3').start);
      const calls = [[car, 'car', 'vroom', 'Vroom!'], [bus, 'bus', 'next', 'Next stop!'], [bike, 'bike', 'ring', 'Ring ring!']];
      calls.forEach(([v, word, reply, text], i) => {
        const sendAt = mark('verse-3-2', word);
        const replyAt = mark('verse-3-2', reply);
        const [vx, vy] = at(town, v, sendAt + 0.4);
        ok.envelope(s, { from: [560, 124], to: [vx, vy - 10], label: 'move()', at: sendAt - 0.2, dur: 0.45, bend: -50, stay: 1.1, tone: i % 2 ? 'cyan' : 'gold' });
        moveOf(word, v, L, replyAt, replyAt + 1.6);
        town.bubble(text, { follow: v, at: replyAt, until: replyAt + 1.3 });
      });
      ['Car::move', 'Bus::move', 'Bike::move'].forEach((text, i) => {
        ok.label(s, text, { x: 540 + i * 132, y: 178, at: mark('verse-3-3', 'three') + i * 0.12, until: line('verse-3-5').start, tone: 'mono', rotate: (i - 1) * 4 }).classList.add('oop-label--mono');
      });
      ok.label(s, 'one message', { x: 660, y: 214, at: mark('verse-3-3', 'one'), until: line('verse-3-5').start, tone: 'gold' });
      const ghost = ok.code(s, {
        x: 528, y: 250, w: 410, title: 'the old if-chain', at: mark('verse-3-4', 'loop'), until: line('verse-3-5').start,
        lines: ['if (type[i] == CAR) …', 'else if (type[i] == BUS) …', 'else if (type[i] == BIKE) …'],
      });
      ghost.node.classList.add('oop-code--ghost');
      [0, 1, 2].forEach((i) => ghost.mark(i, mark('verse-3-4', 'asks') + i * 0.1, Infinity, 'struck'));
      ok.ticket(s, { x: 680, y: 250, from: 'Mayor’s office', title: 'Feature request: ambulances', at: mark('verse-3-5', 'mayor'), until: line('verse-3-6').start });
      const ambulance = town.vehicle('ambulance', { x: -40, y: L.e, at: mark('verse-3-5', 'ambulances') })
        .drive(mark('verse-3-5', 'ambulances'), mark('verse-3-6', 'move'), [[150, L.e]]);
      ambulance.flag('is-siren', mark('verse-3-5', 'wee'), until);
      // It turns south at the crossing, clear of the bus at its stop.
      ambulance.drive(mark('verse-3-9', 'drives'), until, [[L.s, L.e], [L.s, town.geo.h - 14]]);
      ok.code(s, {
        x: 528, y: 250, w: 410, title: 'ambulance.cpp', at: mark('verse-3-6', 'class'),
        lines: ['class Ambulance : public Vehicle {', '  void move() override;', '};'],
      });
      ok.label(s, 'city.cpp · 0 lines changed', { x: 560, y: 174, at: mark('verse-3-7', 'changed'), tone: 'pass', mark: 'pass' });
      ok.label(s, 'ambulance.cpp · new file', { x: 560, y: 212, at: mark('verse-3-7', 'one'), tone: 'cyan' });
      ok.label(s, '+1 line where ambulances are created', { x: 528, y: 380, at: mark('verse-3-7', 'one') + 0.3, tone: 'plain' });
      loop.mark(0, mark('verse-3-8', 'vehicle'), until);
      const tram = town.vehicle('ghost', { x: 520, y: L.w, a: 180, label: 'tram ?', at: mark('verse-3-9', 'kinds') });
      tram.drive(mark('verse-3-9', 'kinds'), until, [[320, L.w, 180]]);
      const scooter = town.vehicle('ghost', { x: -40, y: L.bike, label: 'scooter ?', at: mark('verse-3-9', 'havent') });
      scooter.drive(mark('verse-3-9', 'havent'), until, [[140, L.bike]]);
    }

    // ----------------------------------------------------------------
    // Breakdown: pop the hood — virtual, vptr, vtable; static dispatch
    // ----------------------------------------------------------------

    function breakdown() {
      badge('Breakdown · Under the hood', 'breakdown');
      const from = start('breakdown');
      const until = end('breakdown');
      const s = scene(content, from, until);
      kit.place(kit.el('div', 'oop-xray', s), 0, 0);
      const big = city.sprite(s, 'ambulance', { x: 50, y: 80, scale: 5.2, at: mark('breakdown-1', 'okay') });
      big.flag('is-siren', from, until);
      const hood = big.hood;
      tween(hood, [{ rotate: '0deg' }, { rotate: '-55deg' }], mark('breakdown-1', 'hood'), 0.35, EASE.back);
      tween(hood, { rotate: '0deg' }, mark('breakdown-7', 'runs'), 0.35, EASE.in);
      const decl = ok.code(s, {
        x: 380, y: 66, w: 320, title: 'vehicle.h', at: mark('breakdown-2', 'c'),
        lines: ['class Vehicle {', '  virtual void move();', '  void plate();', '};'],
      });
      decl.mark(1, mark('breakdown-2', 'virtual'), until);
      const callCard = ok.code(s, { x: 728, y: 66, w: 210, title: 'call', at: mark('breakdown-2', 'mark'), lines: ['v->move();', 'v->plate();'] });
      const obj = ok.objectCard(s, {
        x: 60, y: 268, w: 260, title: 'amb : Ambulance', fields: [['vptr', '→'], ['speed', '30']], at: mark('breakdown-3', 'each'),
      });
      obj.focus('vptr', mark('breakdown-3', 'pointer'), until);
      ok.label(s, 'hidden pointer', { x: 200, y: 246, at: mark('breakdown-3', 'hides'), until: mark('breakdown-6', 'not'), tone: 'violet' });
      const table = ok.vtable(s, {
        x: 380, y: 262, title: 'Ambulance’s vtable', at: mark('breakdown-4', 'method'),
        rows: [['move', 'Ambulance::move'], ['brake', 'Vehicle::brake', 'inherited']],
      });
      kit.flow(s, { from: [300, 325], to: [376, 300], bend: -16, color: 'cyan', at: mark('breakdown-4', 'v') });
      callCard.mark(0, mark('breakdown-5', 'call'), mark('breakdown-6', 'not'));
      kit.flow(s, { from: [760, 128], to: [700, 300], bend: -40, color: 'cyan', at: mark('breakdown-5', 'call'), until: mark('breakdown-6', 'not') });
      table.light(0, mark('breakdown-5', 'slot'), until);
      ok.label(s, 'run time', { x: 520, y: 360, at: mark('breakdown-5', 'run'), tone: 'cyan' });
      big.bump(mark('breakdown-5', 'slot'));
      callCard.mark(1, mark('breakdown-6', 'not'), until);
      kit.flow(s, { from: [820, 160], to: [820, 206], bend: 0, color: 'pink', at: mark('breakdown-6', 'compiler') - 0.2 });
      ok.label(s, 'Vehicle::plate', { x: 750, y: 212, at: mark('breakdown-6', 'compiler'), tone: 'mono' }).classList.add('oop-label--mono');
      ok.label(s, 'static dispatch', { x: 752, y: 252, at: mark('breakdown-6', 'picks'), tone: 'violet' });
      ok.label(s, 'compile time', { x: 762, y: 292, at: mark('breakdown-7', 'before'), tone: 'gold' });
    }

    // ----------------------------------------------------------------
    // Mid chorus: the second half, with the ambulance in town
    // ----------------------------------------------------------------

    function midChorus() {
      badge('Chorus', 'chorus-2');
      const from = start('chorus-2');
      const until = end('chorus-2');
      const s = scene(content, from, until);
      const town = city.town(s, { x: 24, y: 64, w: 440, h: 250, at: from + 0.05, title: 'The world' });
      const L = lanes(town);
      const fleet = {
        car: town.vehicle('car', { x: 40, y: L.e }),
        bus: town.vehicle('bus', { x: 250, y: L.e }),
        bike: town.vehicle('bike', { x: 30, y: L.bike }),
        ambulance: town.vehicle('ambulance', { x: 410, y: L.w, a: 180 }),
      };
      ok.code(s, { x: 520, y: 72, w: 410, title: 'loop', at: from + 0.2, lines: ['for (Vehicle* v : vehicles)', '  v->move();'] });
      Object.entries(fleet).forEach(([kind, v], i) => {
        const [vx, vy] = at(town, v, mark('chorus-2-1', 'message') + 0.6);
        ok.envelope(s, { from: [560, 130], to: [vx, vy - 10], label: 'move()', at: mark('chorus-2-1', 'message') + i * 0.08, dur: 0.55, bend: -40, stay: 1.25, tone: i % 2 ? 'cyan' : 'gold' });
        moveOf(kind, v, L, mark('chorus-2-1', 'different'), line('chorus-2-2').start + 0.6);
        methodTag(s, kind, i, mark('chorus-2-1', 'moves') + i * 0.06, line('chorus-2-3').start);
      });
      const ask = ok.bubble(s, 'What type are you?', { x: 560, y: 286, at: mark('chorus-2-2', 'what'), tail: 'left' });
      tween(ask, { opacity: 0, translate: '220px -20px', rotate: '12deg' }, mark('chorus-2-2', 'nah'), 0.35, EASE.in);
      kit.kinetic(s, [
        { text: 'Let the', at: mark('chorus-2-3', 'let') },
        { text: 'object', at: mark('chorus-2-3', 'object'), color: 'gold' },
        { text: 'decide', at: mark('chorus-2-3', 'decide'), color: 'cyan' },
      ], { y: 372, size: 50 });
      const rules = ok.ruleCard(s, { x: 708, y: 150, at: line('chorus-2-3').start, shown: 3 });
      rules.glow(2, mark('chorus-2-3', 'decide'), until);
    }

    // ----------------------------------------------------------------
    // Bridge: Square extends Rectangle — and breaks its promise
    // ----------------------------------------------------------------

    function bridge() {
      kit.badge(hud, 'Bridge · Plot twist', start('bridge'), mark('verse-4-1', 'objects'));
      const from = start('bridge');
      // Plot twist; careful how you copy the world.
      const a = sceneUntil(from, 'bridge-3');
      const tile = kit.place(kit.el('div', 'oop-square-tile is-staged', a), 410, 150);
      kit.el('span', null, tile, 'Square');
      fx.slam(tile, mark('bridge-1', 'plot'), { from: 1.6 });
      kit.place(kit.el('div', 'oop-freeze is-staged', a), 0, 0);
      tween(a.lastChild, [{ opacity: 0 }, { opacity: 1 }], mark('bridge-1', 'twist'), 0.08, EASE.out);
      tween(a.lastChild, { opacity: 0 }, mark('bridge-1', 'twist_2') + 0.3, 0.3, EASE.in);
      camera.shake(mark('bridge-1', 'twist'), 5);
      ok.label(a, 'the world', { x: 150, y: 330, at: mark('bridge-2', 'careful'), tone: 'cyan' });
      ok.label(a, 'the code', { x: 680, y: 330, at: mark('bridge-2', 'careful'), tone: 'gold' });
      kit.flow(a, { from: [280, 344], to: [668, 344], bend: -30, color: 'gold', at: mark('bridge-2', 'copy') });
      kit.sticker(a, '⚠ careful', { x: 410, y: 280, at: mark('bridge-2', 'careful'), variant: 'gold', rotate: -4 });

      // Math says is-a; the class diagram copies it; a test checks it.
      const b = sceneUntil(line('bridge-3').start - 0.12, 'bridge-5');
      const page = kit.place(kit.el('div', 'oop-notebook is-staged', b), 60, 80);
      kit.el('div', 'oop-notebook-title', page, 'Math notebook');
      const outer = kit.el('div', 'oop-venn-outer', page);
      kit.el('span', 'oop-venn-label', outer, 'rectangles');
      const inner = kit.el('div', 'oop-venn-inner is-staged', outer);
      kit.el('span', 'oop-venn-label', inner, 'squares');
      ok.enter(page, mark('bridge-3', 'math'));
      fx.pop(inner, mark('bridge-3', 'squares'));
      ok.objectCard(b, { x: 520, y: 70, w: 210, kind: 'class', compact: true, title: 'Rectangle', methods: ['setWidth()', 'height()'], at: mark('bridge-4', 'square') });
      ok.objectCard(b, { x: 760, y: 70, w: 150, kind: 'class', compact: true, title: 'Square', at: mark('bridge-4', 'extends') });
      kit.flow(b, { from: [756, 96], to: [736, 96], bend: 0, color: 'gold', at: mark('bridge-4', 'extends') + 0.1 });
      ok.label(b, 'extends', { x: 712, y: 130, at: mark('bridge-4', 'extends') + 0.1, tone: 'gold' });
      ok.code(b, {
        x: 470, y: 250, w: 450, title: 'test.cpp', at: mark('bridge-4', 'square'),
        lines: ['r->setWidth(100);', 'assert(r->height() == 20);'],
      });

      // Run the test twice: a Rectangle passes, a Square fails.
      const c = sceneUntil(line('bridge-5').start - 0.12, 'bridge-9');
      const bench = ok.bench(c, { x: 80, y: 84, w: 50, h: 20, at: mark('bridge-5', 'rectangle'), labelText: 'Rectangle' });
      bench.resize(mark('bridge-5', 'width'), 100, 20);
      bench.verdict(mark('bridge-6', 'twenty'), true, 'assert passes', line('bridge-7').start);
      const square = mark('bridge-7', 'set');
      bench.resize(square, 20, 20, { label: 'Square', square: true, jump: true });
      bench.resize(mark('bridge-7', 'width_2'), 100, 100, { label: 'Square', square: true });
      bench.verdict(mark('bridge-8', 'jumps'), false, 'assert fails');
      const test = ok.code(c, {
        x: 470, y: 120, w: 450, title: 'test.cpp', at: line('bridge-5').start,
        lines: [
          { text: 'Rectangle* r = new Rectangle(50, 20);', swap: [{ at: square, text: 'Rectangle* r = new Square(20);' }] },
          'r->setWidth(100);',
          'assert(r->height() == 20);',
        ],
      });
      test.mark(1, mark('bridge-5', 'width'), line('bridge-6').start);
      test.mark(2, mark('bridge-6', 'twenty'), square, 'add');
      test.mark(0, square, mark('bridge-7', 'width'));
      test.mark(1, mark('bridge-7', 'width_2'), mark('bridge-8', 'height'));
      test.mark(2, mark('bridge-8', 'jumps'), Infinity, 'del');

      // Same messages, but not the same meaning: Liskov.
      const handoff = line('bridge-11').start + 1.2;
      const d = scene(content, line('bridge-9').start - 0.12, handoff);
      const promise = kit.place(kit.el('div', 'oop-promise is-staged', d), 90, 110);
      for (const side of ['left', 'right']) {
        const half = kit.el('div', `oop-promise-half oop-promise-half--${side}`, promise);
        kit.el('div', 'oop-promise-title', half, 'Rectangle promises');
        kit.el('div', 'oop-promise-text', half, 'setWidth: height stays the same');
        tween(half, { translate: side === 'left' ? '-26px 18px' : '26px 30px', rotate: side === 'left' ? '-9deg' : '11deg' }, mark('bridge-10', 'meaning'), 0.55, EASE.out);
      }
      ok.enter(promise, mark('bridge-9', 'subclass'));
      ok.label(d, 'Square', { x: 190, y: 300, at: mark('bridge-9', 'keep'), tone: 'gold' });
      ok.label(d, 'same messages', { x: 560, y: 120, at: mark('bridge-10', 'messages'), tone: 'pass', mark: 'pass' });
      ok.label(d, 'same meaning', { x: 560, y: 170, at: mark('bridge-10', 'meaning'), tone: 'fail', mark: 'fail' });
      ok.nameCard(d, { x: 540, y: 240, name: 'Barbara Liskov', detail: 'substitution principle', at: line('bridge-10').start });

      // Is-a isn't enough: don't inherit; share an interface, or delegate.
      // The delegation picture holds into verse 4's first line.
      const e = scene(content, handoff, mark('verse-4-1', 'objects'));
      ok.label(e, 'is-a in math', { x: 90, y: 74, at: mark('bridge-11', 'world'), tone: 'pass', mark: 'pass' });
      ok.label(e, 'substitutable in code?', { x: 520, y: 74, at: mark('bridge-11', 'enough'), tone: 'fail', mark: 'fail' });
      ok.objectCard(e, { x: 70, y: 130, w: 140, kind: 'class', compact: true, title: 'Rectangle', at: mark('bridge-12', 'cant') });
      ok.objectCard(e, { x: 250, y: 130, w: 120, kind: 'class', compact: true, title: 'Square', at: mark('bridge-12', 'cant') });
      kit.flow(e, { from: [248, 150], to: [214, 150], bend: 0, color: 'gold', at: mark('bridge-12', 'cant') + 0.1 });
      const strike = kit.place(kit.el('div', 'oop-strike is-staged', e), 200, 126);
      strike.append(ok.glyph('cross'));
      fx.slam(strike, mark('bridge-12', 'inherit'), { from: 2 });
      ok.label(e, 'don’t inherit', { x: 150, y: 196, at: mark('bridge-12', 'inherit'), tone: 'fail' });
      ok.objectCard(e, { x: 560, y: 120, w: 220, kind: 'class', compact: true, title: '«interface» Shape', methods: ['area()'], at: mark('bridge-13', 'interface') });
      ok.objectCard(e, { x: 470, y: 250, w: 150, kind: 'class', compact: true, title: 'Rectangle', at: mark('bridge-13', 'shape') });
      ok.objectCard(e, { x: 720, y: 250, w: 130, kind: 'class', compact: true, title: 'Square', at: mark('bridge-13', 'shape') });
      const dashes = kit.svg('svg', { class: 'oop-realize is-staged', viewBox: '0 0 960 540' }, e);
      for (const [x1, x2] of [[545, 630], [785, 700]]) kit.svg('path', { class: 'oop-realize-line', d: `M ${x1} 248 L ${x2} 200` }, dashes);
      fx.fadeIn(dashes, mark('bridge-13', 'shape'), 0.2);
      // Delegation: a Set holds a Collection and passes add(x) on to it.
      const set = kit.place(kit.el('div', 'oop-holder is-staged', e), 150, 286);
      kit.el('div', 'oop-holder-title', set, 'Set');
      const innerBox = kit.el('div', 'oop-holder-inner is-staged', set);
      kit.el('code', null, innerBox, 'Collection items;');
      ok.enter(set, mark('bridge-14', 'hold'));
      fx.pop(innerBox, mark('bridge-14', 'inside'));
      ok.envelope(e, { from: [40, 300], to: [390, 302], label: 'add(x)', at: mark('bridge-14', 'and') - 0.3, dur: 0.6, bend: -20, stay: 1.25 });
      kit.flow(e, { from: [390, 302], to: [290, 352], bend: -18, color: 'cyan', at: mark('bridge-14', 'delegate') });
      ok.label(e, 'delegate', { x: 470, y: 330, at: mark('bridge-14', 'delegate'), tone: 'cyan' });
      const rules = ok.ruleCard(e, { x: 708, y: 296, at: mark('bridge-13', 'share'), shown: 3 });
      rules.add(3, mark('bridge-14', 'delegate'));
      rules.glow(3, mark('bridge-14', 'delegate'), mark('verse-4-1', 'objects'));
    }

    // ----------------------------------------------------------------
    // Verse 4: what objects changed, and the price
    // ----------------------------------------------------------------

    function verse4() {
      kit.badge(hud, 'Verse 4 · What it changed', mark('verse-4-1', 'objects'), end('verse-4'));
      const from = start('verse-4');
      // Districts of objects; teams behind interface gates.
      const a = sceneUntil(mark('verse-4-1', 'objects'), 'verse-4-3');
      const map = kit.place(kit.el('div', 'oop-map is-staged', a), 40, 60);
      const districts = [];
      for (let i = 0; i < 6; i++) {
        const district = kit.el('div', 'oop-district', map);
        for (let k = 0; k < 6; k++) kit.el('span', 'oop-district-card', district);
        districts.push(district);
      }
      ok.enter(map, mark('verse-4-1', 'split') - 0.1);
      city.town(districts[0], { x: 6, y: 6, w: 250, h: 110, frame: false, at: mark('verse-4-1', 'split') });
      ok.label(a, 'our town', { x: 236, y: 68, at: mark('verse-4-1', 'split'), tone: 'cyan' });
      [1, 3, 5].forEach((d, i) => {
        const team = kit.el('div', 'oop-team is-staged', districts[d]);
        for (let k = 0; k < 3; k++) kit.el('span', 'oop-team-member', team);
        kit.el('span', 'oop-team-name', team, `Team ${String.fromCharCode(65 + i)}`);
        fx.pop(team, mark('verse-4-2', 'teams') + i * 0.12);
        const gate = kit.el('div', 'oop-gate is-staged', districts[d]);
        kit.el('span', null, gate, 'interface');
        fx.pop(gate, mark('verse-4-2', 'teams') + 0.3 + i * 0.1);
      });

      // Reuse: one List in many apps.
      const b = sceneUntil(line('verse-4-3').start - 0.12, 'verse-4-4');
      ok.objectCard(b, { x: 360, y: 64, w: 240, kind: 'class', compact: true, title: 'List', methods: ['add()', 'get()', 'size()'], at: mark('verse-4-3', 'list') });
      [['Shop', 'app'], ['Playlist', 'after'], ['To-do', 'app_2']].forEach(([name, word], i) => {
        const app = kit.place(kit.el('div', 'oop-app is-staged', b), 70 + i * 290, 236);
        kit.el('div', 'oop-app-title', app, name);
        const chip = kit.el('div', 'oop-app-chip', app);
        chip.append(ok.glyph('check'));
        kit.el('code', null, chip, 'List');
        ok.enter(app, mark('verse-4-3', 'list') + i * 0.18);
        kit.flow(b, { from: [480, 190], to: [150 + i * 290, 234], bend: -20, color: 'gold', at: mark('verse-4-3', 'list') + i * 0.18 - 0.1 });
      });

      // The price: state everywhere; who changed that speed?
      const c = sceneUntil(line('verse-4-4').start - 0.12, 'verse-4-7');
      kit.stamp(c, 'A price', { x: 360, y: 70, at: mark('verse-4-4', 'price'), until: line('verse-4-5').start, color: 'gold', rotate: -6 });
      const swarm = kit.place(kit.el('div', 'oop-swarm', c), 0, 0);
      const spots = [];
      for (let i = 0; i < 42; i++) {
        const x = 40 + Math.round(window.Timeline.hash01(i * 17 + 3) * 860);
        const y = 60 + Math.round(window.Timeline.hash01(i * 29 + 7) * 360);
        spots.push([x + 16, y + 10]);
        const mini = kit.place(kit.el('span', 'oop-mini is-staged', swarm), x, y);
        fx.pop(mini, mark('verse-4-5', 'state') + i * 0.025, { from: 0.4 });
      }
      const tangle = kit.svg('svg', { class: 'oop-tangle is-staged', viewBox: '0 0 960 540' }, c);
      for (let i = 0; i < 18; i++) {
        const [x1, y1] = spots[i];
        const [x2, y2] = spots[(i * 7 + 5) % spots.length];
        const path = kit.svg('path', { class: 'oop-tangle-line', d: `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 - 60} ${x2} ${y2}` }, tangle);
        fx.draw(path, mark('verse-4-6', 'who') + i * 0.04, 0.4);
      }
      fx.fadeIn(tangle, mark('verse-4-6', 'who') - 0.05, 0.1);
      ok.label(c, 'who set speed = −10?', { x: 560, y: 90, at: mark('verse-4-6', 'changed'), tone: 'fail', mark: 'fail' });
      ok.magnifier(c, { x: 200, y: 200, at: mark('verse-4-6', 'detective') - 0.2, path: [[0, 0], [260, -60], [420, 80], [120, 120]] });

      // New kinds are cheap; new operations touch every class.
      const objectsAt = line('verse-4-9').start + 0.6;
      const d = scene(content, line('verse-4-7').start - 0.12, objectsAt);
      ok.matrix(d, {
        x: 170, y: 90, rows: ['Car', 'Bus', 'Bike'], cols: ['move', 'brake', 'draw'], at: line('verse-4-7').start,
        addRow: { name: 'Ambulance', at: mark('verse-4-7', 'add') }, addCol: { name: 'export', at: mark('verse-4-8', 'touch') },
      });
      ok.label(d, '1 class to write', { x: 660, y: 238, at: mark('verse-4-7', 'class'), tone: 'pass', mark: 'pass' });
      ok.label(d, '4 classes to touch', { x: 540, y: 340, at: mark('verse-4-8', 'every'), tone: 'fail', mark: 'fail' });

      // Use objects where they fit; a plain function is fine.
      // The last picture holds through the quiz's spoken "Stop time".
      const e = scene(content, objectsAt, mark('quiz-1', 'red') - 0.1);
      const town = city.town(e, { x: 40, y: 80, w: 400, h: 220, at: objectsAt, title: 'Objects' });
      const L = lanes(town);
      town.vehicle('car', { x: 60, y: L.e });
      town.vehicle('bus', { x: 260, y: L.e });
      town.vehicle('bike', { x: 120, y: L.bike });
      ok.label(e, 'things with state that act → objects', { x: 60, y: 340, at: mark('verse-4-9', 'use'), tone: 'pass', mark: 'pass' });
      ok.code(e, { x: 470, y: 100, w: 450, title: 'stats.cpp', at: mark('verse-4-10', 'plain'), lines: ['double average(const vector<double>& xs);'] });
      ok.label(e, 'plain math → a plain function', { x: 520, y: 190, at: mark('verse-4-10', 'plain_2'), tone: 'pass', mark: 'pass' });
      const rules = ok.ruleCard(e, { x: 708, y: 262, at: line('verse-4-9').start + 0.3, shown: 4 });
      rules.add(4, mark('verse-4-10', 'plain_2'));
      rules.glow(4, mark('verse-4-10', 'plain_2'), mark('quiz-1', 'red'));
    }

    // ----------------------------------------------------------------
    // Red flag or green flag?
    // ----------------------------------------------------------------

    const FLAGS = [
      { question: 'Your game checks: if zombie, if creeper, if skeleton…', kind: 'red', reason: 'Send one message!', code: ['for (Enemy* e : enemies)', '  e->takeAction();'] },
      { question: 'Stack holds a list inside and only shows push and pop.', kind: 'green', reason: 'That’s delegation!', stack: true },
      { question: 'Shapes use radians. Square uses degrees.', kind: 'red', reason: 'Broken promise!', note: 'same message, different meaning' },
      { question: 'C++, not virtual: the object picks, right?', kind: 'red', reason: 'The compiler picks!', note: 'Vehicle::plate · compile time' },
      { question: 'Celsius to Fahrenheit? One plain function.', kind: 'green', reason: 'A function’s fine!', code: ['double toF(double c) {', '  return c * 9 / 5 + 32;', '}'] },
    ];

    function quiz() {
      badge('Red flag or green flag?', 'quiz');
      const { lines } = song.storyboard.sections.find((section) => section.id === 'quiz');
      lines.forEach((entry, i) => {
        const spec = FLAGS[i];
        const from = i ? entry.start - 0.15 : mark('quiz-1', 'red') - 0.1;
        const to = i + 1 < lines.length ? lines[i + 1].start - 0.15 : end('quiz');
        const s = scene(content, from, to, { enter: 'whip' });
        const card = kit.place(kit.el('div', 'oop-quiz', s), 80, 58);
        kit.el('div', 'oop-quiz-count', card, `Flag ${i + 1} / ${lines.length}`);
        const qAt = i === 0 ? mark('quiz-1', 'your') : entry.start;
        if (i === 0) {
          const title = kit.el('div', 'oop-quiz-title is-staged', card, 'Red flag or green flag?');
          fx.pop(title, mark('quiz-1', 'red'));
        }
        const question = kit.el('div', 'oop-quiz-question is-staged', card, spec.question);
        fx.rise(question, qAt, { distance: 10, duration: 0.35 });
        ok.flagPair(s, { x: 160, y: 270, from: qAt + 0.3, to: entry.answer_at });
        ok.flag(s, { x: 150, y: 262, kind: spec.kind, at: entry.answer_at });
        const reason = kit.place(kit.el('div', `oop-quiz-reason oop-quiz-reason--${spec.kind} is-staged`, s), 300, 268);
        kit.el('span', null, reason, spec.reason);
        fx.pop(reason, entry.answer_at + 0.1);
        camera.punch(entry.answer_at + 0.05, 0.03);
        const extraAt = entry.answer_at;
        if (spec.code) ok.code(s, { x: 300, y: 326, w: 470, at: extraAt, lines: spec.code });
        if (spec.note) ok.label(s, spec.note, { x: 300, y: 336, at: extraAt, tone: spec.kind === 'red' ? 'fail' : 'pass' });
        if (spec.stack) ok.objectCard(s, { x: 600, y: 300, w: 260, kind: 'class', compact: true, title: 'Stack', fields: [['items', 'List']], methods: ['push()', 'pop()', 'top()'], at: extraAt });
      });
    }

    // ----------------------------------------------------------------
    // Ad-lib: two flag answers again
    // ----------------------------------------------------------------

    function adLib() {
      badge('Ad-lib', 'ad-lib');
      const s = scene(content, start('ad-lib'), end('ad-lib'));
      [0, 1, 2, 3].forEach((i) => ok.envelope(s, { from: [80, 420], to: [300 + i * 160, 100 + (i % 2) * 40], label: i ? undefined : 'send it', at: mark('ad-lib-1', 'send_2') + i * 0.12, dur: 0.45, bend: -60, stay: 0.3, tone: i % 2 ? 'cyan' : 'gold' }));
      ok.code(s, { x: 120, y: 160, w: 300, title: 'flashback', at: mark('ad-lib-1', 'the'), lines: ['v->plate();   // not virtual'] });
      ok.label(s, 'Vehicle::plate · compile time', { x: 440, y: 176, at: mark('ad-lib-1', 'compiler'), tone: 'gold' });
      ok.code(s, { x: 120, y: 260, w: 470, title: 'convert.cpp', at: mark('ad-lib-2', 'celsius'), lines: ['double toF(double c) {', '  return c * 9 / 5 + 32;', '}'] });
      ok.flag(s, { x: 640, y: 250, kind: 'green', at: mark('ad-lib-3', 'green') });
    }

    // ----------------------------------------------------------------
    // Final chorus 2: the curtain call
    // ----------------------------------------------------------------

    function curtainCall() {
      const id = 'final-chorus-2';
      const l = (n) => `${id}-${n}`;
      badge('Final chorus · Curtain call', id);
      const from = start(id);
      const until = end(id);
      const s = scene(content, from, until);
      const cast = ['car', 'hybrid', 'bus', 'bike', 'ambulance'];
      const strip = city.town(s, { x: 20, y: 54, w: 920, h: 120, at: from + 0.05, title: 'Curtain call' });
      const L = lanes(strip);
      cast.forEach((kind, i) => {
        const x = 100 + i * 180;
        const v = strip.vehicle(kind, { x, y: L.e, at: mark(l(1), 'simulate') + i * 0.12 });
        v.dance(mark(l(5), 'different'), line(l(6)).start + 0.4);
        if (kind === 'ambulance') v.flag('is-siren', from, until);
        const card = ok.objectCard(s, {
          x: 20 + i * 186, y: 198, w: 178, compact: true, title: objectTitle(kind),
          fields: [['speed', String(20 + i * 5)]], methods: ['move()'], at: mark(l(1), 'world') + i * 0.12,
          unlocked: true, lockAt: mark(l(2), 'locked') + i * 0.1,
        });
        ok.envelope(s, { from: [480, 190], to: [80 + i * 186, 296], label: i === 0 ? 'move()' : undefined, at: mark(l(3), 'send') + i * 0.06, dur: 0.5, bend: -30, stay: 1.1, tone: i % 2 ? 'cyan' : 'gold' });
        card.light('move()', mark(l(4), 'object') + i * 0.08, line(l(5)).start + 0.5);
        card.seal(mark(l(7), 'promise') + i * 0.08);
      });
      const ask = ok.bubble(s, 'What type are you?', { x: 380, y: 136, at: mark(l(6), 'what'), tail: 'down' });
      tween(ask, { opacity: 0, translate: '220px -20px', rotate: '12deg' }, mark(l(6), 'nah'), 0.35, EASE.in);
      const rules = ok.ruleCard(s, { x: 20, y: 366, at: from + 0.3, row: true });
      [['state', 0, l(2), 'locked'], ['message', 1, l(3), 'message'], ['decide', 2, l(4), 'decide'], ['promise', 3, l(7), 'promise'], ['fits', 4, l(8), 'let']].forEach(([, i, lineId, word]) => {
        rules.add(i, mark(lineId, word));
        rules.glow(i, mark(lineId, word), line(lineId).end);
      });
      kit.kinetic(s, [
        { text: 'Let the', at: mark(l(8), 'let') },
        { text: 'object', at: mark(l(8), 'object'), color: 'gold' },
        { text: 'decide', at: mark(l(8), 'decide'), color: 'cyan' },
      ], { y: 412, size: 38 });
    }

    // ----------------------------------------------------------------
    // Outro: the ambulance rolls out; touch some real grass
    // ----------------------------------------------------------------

    function outro() {
      const from = start('outro');
      const finish = song.duration;
      const a = sceneUntil(from, 'outro-3');
      const town = city.town(a, { x: 180, y: 50, w: 600, h: 280, at: from + 0.05, title: 'City Builder' });
      const L = lanes(town);
      const car = town.vehicle('car', { x: 260, y: L.e });
      const bus = town.vehicle('bus', { x: L.stop + 30, y: L.e });
      town.vehicle('bike', { x: 140, y: L.bike });
      const hybrid = town.vehicle('hybrid', { x: 470, y: L.w, a: 180 });
      // The others pull aside toward the curb; the ambulance passes.
      car.drive(mark('outro-1', 'ambulance'), mark('outro-1', 'rolls'), [[280, L.e + 16, 0]]);
      hybrid.drive(mark('outro-1', 'ambulance'), mark('outro-1', 'rolls'), [[490, L.w - 16, 180]]);
      bus.drive(mark('outro-1', 'ambulance'), mark('outro-1', 'rolls'), [[L.stop + 30, L.e + 14, 0]]);
      const ambulance = town.vehicle('ambulance', { x: -40, y: town.geo.roadY }).drive(mark('outro-1', 'ambulance'), line('outro-3').start, [[660, town.geo.roadY]]);
      ambulance.flag('is-siren', from, finish);
      ok.code(a, { x: 520, y: 352, w: 400, title: 'city.cpp', at: mark('outro-2', 'loop'), lines: ['for (Vehicle* v : vehicles)', '  v->move();'] });
      ok.label(a, '0 lines changed', { x: 360, y: 372, at: mark('outro-2', 'loop'), tone: 'pass', mark: 'pass' });

      // The town becomes objects joined by messages, then folds back.
      const b = scene(content, line('outro-3').start - 0.12, line('outro-5').start - 0.12);
      const nodes = [[120, 90], [420, 70], [720, 100], [250, 260], [560, 250], [820, 300]];
      const kinds = ['car', 'bus', 'bike', 'hybrid', 'ambulance', 'car'];
      nodes.forEach(([x, y], i) => {
        const card = ok.objectCard(b, { x, y, w: 150, compact: true, title: objectTitle(kinds[i]), methods: ['move()'], at: mark('outro-3', 'object') + i * 0.1 });
        tween(card.node, { scale: 0.2, opacity: 0, translate: `${480 - x - 75}px ${200 - y}px` }, mark('outro-4', 'world') + i * 0.05, 0.6, EASE.in);
      });
      [[0, 1], [1, 2], [0, 3], [3, 4], [4, 5], [1, 4]].forEach(([p, q], i) => {
        kit.flow(b, { from: [nodes[p][0] + 75, nodes[p][1] + 40], to: [nodes[q][0] + 75, nodes[q][1] + 10], bend: -30, color: i % 2 ? 'cyan' : 'gold', at: mark('outro-3', 'programming') + i * 0.08, until: mark('outro-4', 'world') });
      });
      const back = city.town(b, { x: 180, y: 50, w: 600, h: 280, at: mark('outro-4', 'one'), title: 'City Builder' });
      const BL = lanes(back);
      back.vehicle('car', { x: 260, y: BL.e });
      back.vehicle('bus', { x: BL.stop + 30, y: BL.e });
      back.vehicle('bike', { x: 140, y: BL.bike });

      // Touch some real grass.
      const c = scene(content, line('outro-5').start - 0.12, finish);
      student?.appear({ from: line('outro-5').start, to: finish, x: 40, y: 170, scale: 0.9 });
      const windowNode = kit.place(kit.el('div', 'oop-window is-staged', c), 520, 80);
      kit.el('div', 'oop-window-sky', windowNode);
      kit.el('div', 'oop-window-sun', windowNode);
      kit.el('div', 'oop-window-hill oop-window-hill--back', windowNode);
      kit.el('div', 'oop-window-hill', windowNode);
      kit.el('div', 'oop-window-frame', windowNode);
      ok.enter(windowNode, mark('outro-5', 'touch'));
      ok.label(c, 'real grass', { x: 640, y: 330, at: mark('outro-5', 'grass'), tone: 'pass' });
      kit.kinetic(c, [
        { text: 'Let the', at: mark('outro-6', 'let') },
        { text: 'object', at: mark('outro-6', 'object'), color: 'gold' },
        { text: 'decide', at: mark('outro-6', 'decide'), color: 'cyan' },
      ], { y: 380, size: 56 });
    }

    intro();
    verse1();
    preChorus();
    chorus('chorus-1', ['chorus-1-1', 'chorus-1-2', 'chorus-1-3', 'chorus-1-4', 'chorus-1-5', 'chorus-1-6', 'chorus-1-7']);
    postChorus('post-chorus-1');
    verse2();
    postChorus('post-chorus-2', { cast: ['car', 'hybrid'], message: 'brake()' });
    verse3();
    breakdown();
    midChorus();
    bridge();
    verse4();
    quiz();
    chorus('final-chorus-1', ['final-chorus-1-1', 'final-chorus-1-2', 'final-chorus-1-3', 'final-chorus-1-4', 'final-chorus-1-5', 'final-chorus-1-6', 'final-chorus-1-7', 'final-chorus-1-8'], {
      cast: ['car', 'hybrid', 'bus', 'bike', 'ambulance'], promise: true, rulesShown: 3, titleUntil: start('ad-lib') + 0.8,
    });
    adLib();
    curtainCall();
    postChorus('post-chorus-3', { cast: ['car', 'hybrid', 'bus', 'bike', 'ambulance'] });
    outro();
  };
})();
