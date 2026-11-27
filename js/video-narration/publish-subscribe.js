/*
 * Choreography for the Publish-Subscribe video narration (script:
 * _data/narrations/publish_subscribe.yml; artwork: publish-subscribe-kit.js
 * on the architecture kit, the UML kit, and the wall kit). The narration
 * reaches this stage as a song: each scene is a section and each cue a line,
 * and `at(cue, word)` is the estimated time the narrator says that word
 * (repeated words are word2, word3, ...). Cues are named by their stable
 * script ids ('intro/lunch'), looked up in the storyboard, so reordering the
 * script never misplaces a picture.
 *
 * The teaching rule for the pictures: show the mechanism the cue names, on
 * Mochi, the campus delivery robot. The architecture is a UML C&C view in a
 * frame that names its view and carries a key: each program a component; a
 * topic a connector, drawn as a channel frames travel through under its
 * «topic» name; every attachment a line from a component's port to the
 * channel (toTopic) or from the channel to a component's port (fromTopic).
 * Frames are tokens that travel. A rule of the style is a numbered rule card
 * that arrives as its cue begins, before the narrator names it, and stays up
 * while the scene applies it; every consequence is a quality card that says
 * Promoted or Inhibited in words, beside the rule it follows from. Stamps
 * never shake the stage, and nothing large changes brightness quickly
 * (WCAG 2.3.1). Layout: the 960x540 picture body; nothing readable within
 * 12px of an edge.
 */
(function () {
  'use strict';

  const TOPICS = {
    intro: { kind: 'Example', name: 'Mochi, the delivery robot', iconName: 'box' },
    direct_calls: { kind: 'Problem', name: 'Direct calls', iconName: 'warning' },
    topic: { kind: 'Style', name: 'Publishers, topics, subscribers', iconName: 'merge' },
    ignorance: { kind: 'Rule', name: '1 and 2 · Neither side knows the other', iconName: 'eye' },
    one_way: { kind: 'Rule', name: '3 and 4 · One way, no waiting', iconName: 'forward' },
    buys: { kind: 'Promotes', name: 'Extensibility and flexibility', iconName: 'sparkle' },
    nobody_listens: { kind: 'Inhibits', name: 'Robustness', iconName: 'warning' },
    who_talks: { kind: 'Inhibits', name: 'Understandability and latency', iconName: 'search' },
    when: { kind: 'Trade-off', name: 'Publish or call?', iconName: 'transfer' },
    in_practice: { kind: 'In practice', name: 'Real-world examples', iconName: 'globe' },
    summary: { kind: 'Recap', name: 'Announce, don’t call', iconName: 'check' },
  };

  /** The four rules, as their cards name them. */
  const RULES = {
    1: { name: 'Publisher ignorance', text: 'Don’t rely on who listens, or whether anyone does.' },
    2: { name: 'Subscriber ignorance', text: 'Subscribe to the event, not to its source.' },
    3: { name: 'One-way propagation', text: 'No return values: information flows only to subscribers.' },
    4: { name: 'Asynchronous', text: 'The publisher never waits: publish() returns at once.' },
  };

  const PROGRAMS = {
    camera: 'Camera driver',
    detector: 'Obstacle detector',
    planner: 'Planner',
    motor: 'Motor controller',
    logger: 'Logger',
    dashboard: 'Operator dashboard',
    counter: 'Pedestrian counter',
    battery: 'Battery monitor',
    sensor: 'Battery sensor',
    recorder: 'Research recorder',
    laser: 'Laser detector',
    safety: 'Safety monitor',
    broker: 'Broker',
  };
  /** The key of a C&C view of topics. */
  const KEY = [['component', 'component'], ['topic', '«topic» connector'], ['flow', 'publish, deliver']];
  const KEY_SHORT = [['component', 'component'], ['topic', 'topic'], ['flow', 'event']];

  /** The stage's line id for each cue ('scene/cue' to 'scene-n'), from the storyboard. */
  function lineIds() {
    const story = JSON.parse(document.getElementById('narration-storyboard').textContent);
    const ids = {};
    story.scenes.forEach((scene) => scene.cues.forEach((cue, i) => { ids[`${scene.id}/${cue.id}`] = `${scene.id}-${i + 1}`; }));
    return ids;
  }

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.publish_subscribe = function choreograph({ song, kit, layers }) {
    const wall = window.WallKit;
    const arch = window.ArchKit;
    const uml = window.UmlKit;
    const ps = window.PubSubKit;
    const { content } = layers;
    const ids = lineIds();
    const line = (cue) => {
      if (!ids[cue]) throw new Error(`Unknown cue ${cue}`);
      return ids[cue];
    };
    const begin = (cue) => song.line(line(cue)).start;
    const end = (cue) => song.line(line(cue)).end;
    const at = (cue, word) => song.mark(line(cue), word);

    /** One picture from the start of cue `from` to the end of cue `to`, headed by its scene's topic. */
    function picture(from, to = from) {
      const node = kit.scene(content, begin(from), end(to), { exit: 'fade' });
      wall.topicTag(node, { ...TOPICS[from.split('/')[0]], at: begin(from) + 0.15 });
      return wall.body(node);
    }
    const sticker = (parent, text, options) => kit.sticker(parent, text, { rotate: -3, ...options });
    const stamp = (parent, text, options) => kit.stamp(parent, text, { shake: false, from: 1.8, ...options });
    /** Rule n's card; `full` adds its one-line statement. */
    const rule = (parent, n, { full = false, ...options }) => arch.rule(parent, { n, name: RULES[n].name, text: full ? RULES[n].text : undefined, ...options });
    /** A C&C frame with the topics' key. */
    const frame = (parent, options) => uml.frame(parent, { view: 'cnc', key: KEY_SHORT, ...options });

    /**
     * A program as a UML component, tall enough for its name (one or two
     * lines) and for the words of its state (`sub` or states' sub).
     */
    function program(parent, key, { x, y, w = 280, h, title, sub, states = [], ...options }) {
      const name = title || PROGRAMS[key];
      const lines = name.length * 12.6 > w - 72 ? 2 : 1;
      const words = sub || states.some((state) => state.sub);
      const height = h ?? 34 + 25 * lines + (words ? 34 : 0);
      const node = uml.component(parent, { x, y, w, h: height, name, sub, states, ...options });
      Object.assign(node, { top: y, bottom: y + height, left: x, right: x + w, cx: x + w / 2, cy: y + height / 2 });
      return node;
    }
    // A topic is a connector, so it has no ports; a component has one wherever an attachment meets it.
    /** A publisher's attachment: from its port (`from`) to a point on the topic (`to`). */
    const toTopic = (parent, from, to, options) => uml.connector(parent, { from, to, kind: 'flow', ends: 'from', ...options });
    /** A subscriber's attachment: from a point on the topic (`from`) to the subscriber's port (`to`). */
    const fromTopic = (parent, from, to, options) => uml.connector(parent, { from, to, kind: 'flow', ends: 'to', ...options });

    /** Queue fills that flicker between low counts while frames flow, for a lively but calm queue. */
    function busyFills(from, to, { low = 0, high = 2, every = 0.45, seed = 1 } = {}) {
      const fills = [];
      let i = 0;
      for (let t = from; t < to; t += every, i += 1) fills.push({ at: t, count: low + ((i * 7 + seed * 3) % (high - low + 1)) });
      return fills;
    }
    /** Fills that climb one slot every `every` seconds from `from`, up to `max`. */
    function risingFills(from, start, max, every = 0.7) {
      return Array.from({ length: max - start + 1 }, (_, i) => ({ at: from + i * every, count: start + i }));
    }

    // ----------------------------------------------------------------
    // Motivation: lunch by robot, and the camera that calls everyone
    // ----------------------------------------------------------------

    function intro() {
      const lunch = 'intro/lunch';
      const a = picture(lunch);
      const mapX = 24;
      const mapY = 74;
      sticker(a, '12:50 · lab until 2:00', { x: 30, y: 16, at: at(lunch, 'twelve'), variant: 'gold', iconName: 'timer' });
      ps.campusMap(a, { x: mapX, y: mapY, at: begin(lunch) + 0.1 });
      ps.rideCampus(a, { mapX, mapY, at: at(lunch, 'robot'), drive: at(lunch, 'rolls'), duration: at(lunch, 'parks') - at(lunch, 'rolls') });
      ps.phone(a, {
        x: 656, y: 60, at: at(lunch, 'order'),
        ride: { at: at(lunch, 'rolls'), duration: at(lunch, 'parks') - at(lunch, 'rolls') },
        screens: [
          { at: at(lunch, 'sandwich'), title: 'Order placed', text: 'Sandwich', iconName: 'cart' },
          { at: at(lunch, 'parks'), title: 'Mochi is here', text: 'At your door', iconName: 'pin' },
        ],
      });

      const inside = 'intro/inside';
      const b = picture(inside);
      frame(b, { x: 8, y: 6, w: 944, h: 360, title: 'inside Mochi', key: [['component', 'program, a component']], at: begin(inside) + 0.1 });
      [
        ['camera', 'camera', '30 frames a second'], ['detector', 'obstacle', 'Finds people and scooters'],
        ['planner', 'planner', 'Picks the path'], ['motor', 'motor', 'Turns the wheels'],
        ['logger', 'logger', 'Records the trip'], ['dashboard', 'operator', 'Shows the camera’s view'],
      ].forEach(([key, word, sub], i) => program(b, key, {
        x: 32 + (i % 3) * 304, y: 62 + Math.floor(i / 3) * 150, w: 288, h: 118, sub, at: at(inside, word),
      }));
      ps.robot(b, { path: [[480, 450]], at: begin(inside) + 0.2, size: 104 });

      const ticket = 'intro/ticket';
      const c = picture(ticket);
      wall.badge(c, { x: 70, y: 96, w: 150, role: 'You', iconName: 'user', at: at(ticket, 'joined') });
      wall.skill(c, { x: 34, y: 262, w: 220, text: 'New on the Mochi team', at: at(ticket, 'team') });
      wall.listCard(c, {
        x: 300, y: 26, w: 636, title: 'Ticket 1: Count pedestrians', iconName: 'list', at: at(ticket, 'first'),
        text: 'For campus planning: how crowded the main walkway gets, from the camera’s frames.',
      });
      frame(c, { title: 'who has wanted the frames', x: 288, y: 236, w: 664, h: 226, key: [['component', 'program']], keyAt: 'bottom', at: at(ticket, 'fans') - 0.3 });
      [['logger', 'Logger', 'Last year', 'logger'], ['dashboard', 'Dashboard', 'This spring', 'dashboard'], ['counter', 'Pedestrian counter', 'Now', 'this']]
        .forEach(([key, title, sub, word], i) => program(c, key, {
          x: 304 + i * 212, y: 284, w: 200, h: 118, title, sub, at: at(ticket, word),
          states: key === 'counter' ? [{ at: at(ticket, word), state: 'new', sub }] : [],
        }));
    }

    /** camera.py's loop, calling every listener by name; `counterAt` types the fourth call at that time. */
    function cameraLoop(parent, { x, y, w = 540, at: when, counterAt }) {
      return arch.code(parent, {
        x, y, w, title: 'camera.py', at: when,
        lines: [
          { code: 'while True:' },
          { code: '    frame = sensor.read()' },
          { code: '    detector.find_obstacles(frame)' },
          { code: '    logger.save(frame)' },
          { code: '    dashboard.show(frame)' },
          { code: '    counter.count(frame)', at: counterAt ?? 1e6 },
        ],
      });
    }

    function directCalls() {
      const calls = 'direct_calls/calls';
      const edit = 'direct_calls/edit_camera';
      const a = picture(calls, edit);
      frame(a, { x: 8, y: 6, w: 944, h: 476, title: 'direct calls', key: [['component', 'program'], ['call', 'call, waits for the return']], at: begin(calls) + 0.05 });
      const loop = cameraLoop(a, { x: 24, y: 52, at: begin(calls) + 0.1, counterAt: at(edit, 'add') });
      // Rows sit 32px apart from y = 52 + 62; a call's arrow leaves its row's right end.
      const rowY = (row) => 52 + 62 + row * 32 + 16;
      [['detector', 'detector', 56, 'logger'], ['logger', 'logger', 150, 'dashboard'], ['dashboard', 'dashboard', 244, 'one']].forEach(([key, word, y, next], i) => {
        const node = program(a, key, { x: 640, y, w: 296, at: at(calls, word) });
        uml.connector(a, { from: [572, rowY(i + 2)], to: [640, node.cy], kind: 'flow', ends: 'to', at: at(calls, word) + 0.15 });
        wall.lit(loop.rows[i + 2], [[at(calls, word), at(calls, next)]]);
      });
      sticker(a, 'Each call waits for its return', { x: 40, y: 420, at: at(calls, 'waits'), until: end(calls), variant: 'white', iconName: 'hourglass' });

      const counter = program(a, 'counter', {
        x: 640, y: 372, w: 296, at: at(edit, 'counter'),
        states: [{ at: at(edit, 'counter'), state: 'idle', sub: 'Not connected yet' }, { at: at(edit, 'add'), state: 'new', sub: 'Called from the loop' }],
      });
      uml.connector(a, { from: [572, rowY(5)], to: [640, counter.cy], kind: 'flow', ends: 'to', at: at(edit, 'add') + 0.2 });
      stamp(a, 'Edit camera.py', { x: 60, y: 326, at: at(edit, 'loop'), color: 'red', rotate: -4 });
      sticker(a, 'Retest the camera', { x: 40, y: 404, at: at(edit, 'retest'), variant: 'red', iconName: 'resend' });
      sticker(a, 'Redeploy the camera', { x: 40, y: 460, at: at(edit, 'redeploy'), variant: 'red', iconName: 'bolt' });

      const freeze = 'direct_calls/freeze';
      const b = picture(freeze);
      frame(b, { x: 8, y: 6, w: 944, h: 306, title: 'direct calls', key: [['component', 'program'], ['call', 'call']], at: begin(freeze) + 0.05 });
      const loop2 = cameraLoop(b, { x: 24, y: 52, at: begin(freeze) + 0.1 });
      wall.lit(loop2.rows[4], [[at(freeze, 'call'), end(freeze)]]);
      const dash = program(b, 'dashboard', {
        x: 640, y: 52, w: 296, at: begin(freeze) + 0.2,
        states: [{ at: at(freeze, 'hung'), state: 'down', sub: 'Server not responding' }],
      });
      uml.connector(b, { from: [572, 52 + 62 + 4 * 32 + 16], to: [640, dash.cy], kind: 'flow', ends: 'to', at: begin(freeze) + 0.3 });
      program(b, 'detector', {
        x: 640, y: 176, w: 296, at: begin(freeze) + 0.3,
        states: [{ at: at(freeze, 'detector'), state: 'idle', sub: 'No new frames' }],
      });
      // Frames pile up at the line that never returns.
      [0, 1, 2, 3].forEach((i) => arch.token(b, { path: [[596 + (i % 2) * 6, 280 - i * 14]], at: at(freeze, 'returned') + i * 0.5, duration: 0 }));
      ps.walkway(b, {
        x: 24, y: 330, w: 560, at: at(freeze, 'mochi'),
        stops: [{ at: -1, x: 40 }, { at: at(freeze, 'mochi'), x: 40 }, { at: at(freeze, 'froze'), x: 190, glide: true }],
        props: [{ kind: 'tour', x: 320, at: at(freeze, 'tour') }],
      });
      stamp(b, 'Frozen', { x: 640, y: 362, at: at(freeze, 'froze') + 0.4, color: 'red', rotate: -6 });
      sticker(b, 'One slow listener stalls all', { x: 24, y: 458, at: at(freeze, 'slow'), variant: 'red', iconName: 'warning' });

      const need = 'direct_calls/need';
      const c = picture(need);
      wall.checklist(c, {
        x: 40, y: 30, w: 540, title: 'What the camera needs', at: begin(need) + 0.1,
        items: [
          { text: 'Announce each frame once', at: at(need, 'announce'), checkAt: at(need, 'once') },
          { text: 'Don’t know who listens', at: at(need, 'without'), checkAt: at(need, 'wants') },
          { text: 'Never wait for anyone', at: at(need, 'never'), checkAt: at(need, 'anyone') },
        ],
      });
      wall.banner(c, { x: 640, y: 50, w: 296, title: 'The style', text: 'Publish-subscribe', at: at(need, 'publish') });
      [['Parts and rules', 'list', 'parts'], ['What they buy', 'sparkle', 'buy'], ['What they cost', 'warning', 'cost']].forEach(([title, iconName, word], i) => {
        arch.card(c, { x: 40 + i * 300, y: 330, w: 282, title, iconName, at: at(need, word) });
      });
    }

    // ----------------------------------------------------------------
    // Rules: the parts in a C&C view, then the four rules
    // ----------------------------------------------------------------

    function topicScene() {
      const pub = 'topic/publisher';
      const subs = 'topic/subscribers';
      const joins = 'topic/counter_joins';
      const a = picture(pub, joins);
      frame(a, { x: 8, y: 6, w: 944, h: 456, key: KEY, at: begin(pub) + 0.2 });
      const camera = program(a, 'camera', { x: 640, y: 46, w: 296, at: begin(pub) + 0.1 });
      uml.callout(a, { x: 420, y: 58, w: 170, text: 'Publisher', to: [640, camera.cy], at: at(pub, 'publisher') });
      const lane = arch.topic(a, { x: 24, y: 176, w: 912, name: '/camera/image', at: at(pub, 'topic') });
      uml.callout(a, { x: 24, y: 58, w: 330, text: 'Topic: the connector', to: [480, lane.top], at: at(pub, 'connector') });
      toTopic(a, [788, camera.bottom], [788, lane.top], { at: at(pub, 'announces') });
      arch.stream(a, { path: [[788, camera.bottom + 4], [788, lane.center], [870, lane.center]], at: at(pub, 'announces') + 0.3, until: begin(subs), every: 1.1, duration: 1.0 });

      const columns = [24, 256, 488, 720];
      const subscribers = [['detector', at(subs, 'detector')], ['logger', at(subs, 'logger')], ['dashboard', at(subs, 'dashboard')], ['counter', at(joins, 'counter')]];
      subscribers.forEach(([key, when], i) => {
        const x = columns[i];
        const isCounter = key === 'counter';
        const node = program(a, key, { x, y: 266, w: 216, title: key === 'dashboard' ? 'Dashboard' : undefined, at: when, how: isCounter ? 'slide' : 'pop', states: isCounter ? [{ at: at(joins, 'counter') + 0.2, state: 'new', sub: 'Counted: 3' }, { at: at(joins, 'none'), state: 'new', sub: 'Counted: 7' }] : [] });
        fromTopic(a, [x + 108, lane.bottom], [x + 108, node.top], { at: when + 0.2 });
        arch.queue(a, { x, y: 390, slots: 6, size: 22, at: when + 0.3, fills: busyFills(when + 0.6, end(joins), { high: 2, seed: i + 1 }) });
        arch.stream(a, { path: [[788, camera.bottom + 4], [788, lane.center], [x + 108, lane.center], [x + 108, node.top - 4]], at: when + 0.6, until: end(joins), every: 1.1, duration: 1.2 });
      });
      // Level with the queues, in the column the counter takes later; it leaves before the counter arrives.
      uml.callout(a, { x: 704, y: 386, w: 200, text: 'Its own queue', to: [654, 403], at: at(subs, 'queue'), until: begin(joins) + 0.2 });
      arch.code(a, { x: 24, y: 474, w: 600, at: at(subs, 'callback'), lines: [{ code: 'node.subscribe("/camera/image", 10, on_frame)' }] });
      sticker(a, '0 lines changed', { x: 650, y: 476, at: at(joins, 'modified'), variant: 'green', iconName: 'check' });

      chain('topic/both_roles');
    }

    /**
     * Mochi as a chain of topics (topic/both_roles): every attachment runs
     * from a component's port to a topic or from a topic to a component's port.
     */
    function chain(cue) {
      const a = picture(cue);
      const when = (word) => at(cue, word);
      const t0 = begin(cue) + 0.1;
      frame(a, { x: 8, y: 6, w: 944, h: 528, key: KEY, at: t0 - 0.05 });
      const image = arch.topic(a, { x: 300, y: 84, w: 636, name: '/camera/image', at: t0 + 0.1 });
      const camera = program(a, 'camera', { x: 24, y: image.center - 30, w: 236, at: t0 });
      toTopic(a, [camera.right, image.center], [300, image.center], { at: t0 + 0.3 });
      const detector = program(a, 'detector', { x: 300, y: 180, w: 236, at: when('detector') });
      fromTopic(a, [418, image.bottom], [418, detector.top], { at: when('subscribes') });
      [['logger', 'Logger', 550, 170], ['dashboard', 'Dashboard', 734, 202]].forEach(([key, title, x, w]) => {
        const node = program(a, key, { x, y: 180, w, title, at: t0 + 0.4 });
        fromTopic(a, [x + w / 2, image.bottom], [x + w / 2, node.top], { at: t0 + 0.6 });
      });
      const obstacles = arch.topic(a, { x: 300, y: 342, w: 636, name: '/obstacles', tab: 'right', at: when('obstacles') });
      toTopic(a, [380, detector.bottom], [380, obstacles.top], { at: when('publishes') });
      const planner = program(a, 'planner', { x: 300, y: 436, w: 200, at: when('planner') });
      fromTopic(a, [400, obstacles.bottom], [400, planner.top], { at: when('subscribes2') });
      const cmd = arch.topic(a, { x: 560, y: planner.cy - 22, w: 376, name: '/cmd_vel', tab: 'right', at: when('commands') });
      toTopic(a, [planner.right, cmd.center], [560, cmd.center], { at: when('publishes2') });
      const motor = program(a, 'motor', { x: 24, y: 436, w: 236, at: when('motor') });
      fromTopic(a, [600, cmd.bottom], [142, motor.bottom], { points: [[600, cmd.bottom], [600, 520], [142, 520], [142, motor.bottom]], at: when('subscribes3') });
      uml.callout(a, { x: 24, y: 186, w: 236, text: 'Topic to component', to: [418, image.bottom + 22], at: when('attachment') });
      uml.callout(a, { x: 24, y: 300, w: 252, text: 'No direct calls', tone: 'red', to: [300, detector.cy], at: when('directly') });
    }

    function ignorance() {
      const pubRule = 'ignorance/publisher_rule';
      const subRule = 'ignorance/subscriber_rule';
      const a = picture(pubRule, subRule);
      // Both rules stay up through the scene; each arrives as its cue begins.
      rule(a, 1, { full: true, x: 24, y: 8, w: 444, at: begin(pubRule) + 0.4 });
      rule(a, 2, { full: true, x: 492, y: 8, w: 444, at: begin(subRule) + 0.2 });

      frame(a, { x: 8, y: 108, w: 944, h: 392, key: KEY_SHORT, at: begin(pubRule) + 0.3, until: end(pubRule) });
      [['Five subscribers', 24, 5, 'five'], ['No subscribers', 496, 0, 'none']].forEach(([label, x, count, word]) => {
        arch.tag(a, { x, y: 172, text: label, at: at(pubRule, word), until: end(pubRule) });
        const camera = program(a, 'camera', { x: x + 220, y: 160, w: 220, at: at(pubRule, word) + 0.1, until: end(pubRule) });
        const lane = arch.topic(a, { x, y: 296, w: 440, name: '/camera/image', at: at(pubRule, word) + 0.2, until: end(pubRule) });
        toTopic(a, [x + 400, camera.bottom], [x + 400, lane.top], { at: at(pubRule, word) + 0.3, until: end(pubRule) });
        for (let i = 0; i < count; i += 1) {
          const bx = x + 8 + i * 86;
          uml.component(a, { x: bx, y: 388, w: 76, h: 50, name: '', at: at(pubRule, word) + 0.4 + i * 0.1, until: end(pubRule) });
          fromTopic(a, [bx + 38, lane.bottom], [bx + 38, 388], { at: at(pubRule, word) + 0.4 + i * 0.1, until: end(pubRule) });
        }
        if (!count) arch.tag(a, { x: x + 30, y: 396, text: 'Nobody subscribed', at: at(pubRule, word) + 0.4, until: end(pubRule) });
      });
      sticker(a, 'Same camera code in both', { x: 300, y: 450, at: at(pubRule, 'consequently'), until: end(pubRule), variant: 'green', iconName: 'check' });

      frame(a, { x: 8, y: 108, w: 944, h: 398, key: KEY_SHORT, at: begin(subRule) + 0.1 });
      const lane = arch.topic(a, { x: 24, y: 338, w: 912, name: '/obstacles', at: begin(subRule) + 0.2 });
      program(a, 'detector', { x: 560, y: 152, w: 330, h: 93, title: 'Camera detector', at: begin(subRule) + 0.2, until: at(subRule, 'substitutes') + 0.3 });
      const laser = program(a, 'laser', { x: 560, y: 152, w: 330, h: 93, at: at(subRule, 'laser'), how: 'slide', states: [{ at: at(subRule, 'laser'), state: 'new', sub: 'Same topic' }] });
      toTopic(a, [725, laser.bottom], [725, lane.top], { at: begin(subRule) + 0.4 });
      const planner = program(a, 'planner', {
        x: 560, y: 404, w: 330, at: at(subRule, 'planner'),
        states: [{ at: at(subRule, 'unaffected'), state: 'same', sub: 'Nothing changed' }],
      });
      fromTopic(a, [600, lane.bottom], [600, planner.top], { at: at(subRule, 'planner') + 0.2 });
      arch.tag(a, { x: 40, y: 430, text: 'Subscribes to: /obstacles', at: at(subRule, 'subscribes') });
      arch.tag(a, { x: 40, y: 190, text: 'Publishers stay replaceable', tone: 'green', at: at(subRule, 'replaceable') });

      const observer = 'ignorance/observer';
      const c = picture(observer);
      uml.frame(c, { view: 'cnc', title: 'Observer pattern', x: 8, y: 6, w: 460, h: 440, key: [['interface', 'object'], ['call', 'call']], keyAt: 'bottom', at: at(observer, 'observer') });
      uml.classBox(c, { x: 32, y: 56, w: 412, name: 'subject: Subject', lines: ['observers = [a, b, c]', 'notify()'], at: at(observer, 'subject') });
      ['a', 'b', 'c'].forEach((letter, i) => {
        uml.classBox(c, { x: 32 + i * 140, y: 290, w: 128, name: `${letter}: Observer`, mono: false, at: at(observer, 'calls') + i * 0.12 });
        uml.connector(c, { from: [96 + i * 140, 182], to: [96 + i * 140, 290], kind: 'flow', at: at(observer, 'calls') + 0.1 + i * 0.12 });
      });
      arch.tag(c, { x: 32, y: 366, text: 'The subject calls each one', at: at(observer, 'each') });
      frame(c, { title: 'publish-subscribe', x: 492, y: 6, w: 460, h: 440, key: KEY_SHORT, keyAt: 'bottom', at: at(observer, 'subscribe') });
      const pubNode = program(c, 'camera', { x: 512, y: 56, w: 240, title: 'Publisher', at: at(observer, 'neither') });
      const lane2 = arch.topic(c, { x: 512, y: 200, w: 420, name: 'events', tab: 'right', at: at(observer, 'topic') });
      const subNode = program(c, 'detector', { x: 512, y: 300, w: 240, title: 'Subscriber', at: at(observer, 'neither') + 0.1 });
      toTopic(c, [632, pubNode.bottom], [632, lane2.top], { at: at(observer, 'neither') + 0.2 });
      fromTopic(c, [632, lane2.bottom], [632, subNode.top], { at: at(observer, 'neither') + 0.3 });
      uml.callout(c, { x: 776, y: 300, w: 156, text: 'Keeps the list', to: [854, lane2.bottom], at: at(observer, 'maintains') });
      sticker(c, 'No reference either way', { x: 300, y: 458, at: at(observer, 'reference'), variant: 'white', iconName: 'cross' });
    }

    function oneWay() {
      const noReturn = 'one_way/no_return';
      const a = picture(noReturn);
      rule(a, 3, { full: true, x: 24, y: 8, w: 600, at: begin(noReturn) + 0.3 });
      frame(a, { x: 8, y: 112, w: 944, h: 420, key: KEY_SHORT, at: begin(noReturn) + 0.25 });
      program(a, 'camera', { x: 24, y: 196, w: 260, at: begin(noReturn) + 0.3 });
      wall.speech(a, { x: 310, y: 186, w: 330, text: 'Did anyone see an obstacle?', at: at(noReturn, 'ask') });
      arch.cross(a, { x: 724, y: 214, size: 60, at: at(noReturn, 'cannot') + 0.6 });
      sticker(a, 'No reply channel', { x: 310, y: 268, at: at(noReturn, 'cannot') + 0.8, variant: 'red', iconName: 'cross' });
      const lane = arch.topic(a, { x: 24, y: 450, w: 912, name: '/obstacles', at: at(noReturn, 'another') });
      const detector = program(a, 'detector', { x: 580, y: 290, w: 320, sub: 'Publishes what it found', at: at(noReturn, 'answer') });
      toTopic(a, [740, detector.bottom], [740, lane.top], { at: at(noReturn, 'event') });
      arch.token(a, { kind: 'event', path: [[740, detector.bottom + 4], [740, lane.center], [880, lane.center]], at: at(noReturn, 'event') + 0.3, duration: 1.4, until: end(noReturn) - 0.6 });

      const asyncCue = 'one_way/async';
      const predict = 'one_way/predict_hang';
      const hurts = 'one_way/hurts_itself';
      const b = picture(asyncCue, hurts);
      // Rule 4 stays up through the prediction and its answer.
      rule(b, 4, { full: true, x: 24, y: 8, w: 600, at: begin(asyncCue) + 0.3 });
      frame(b, { x: 8, y: 106, w: 944, h: 288, key: KEY_SHORT, at: begin(asyncCue) + 0.2 });
      const camera = program(b, 'camera', { x: 24, y: 158, w: 230, sub: '30 frames a second', at: begin(asyncCue) + 0.2 });
      const lane2 = arch.topic(b, { x: 290, y: 178, w: 646, name: '/camera/image', tab: 'right', at: begin(asyncCue) + 0.3 });
      toTopic(b, [camera.right, lane2.center], [290, lane2.center], { at: begin(asyncCue) + 0.4 });
      const quiet = busyFills(at(asyncCue, 'copy'), end(hurts), { high: 1, seed: 2 });
      const slow = [
        ...busyFills(at(asyncCue, 'copy'), at(predict, 'hangs'), { low: 2, high: 4, every: 0.6, seed: 3 }),
        ...risingFills(at(predict, 'hangs'), 4, 10, 0.55),
      ];
      [['detector', 300, quiet, [], 'Detector'], ['logger', 510, busyFills(at(asyncCue, 'copy'), end(hurts), { high: 2, seed: 5 }), [], 'Logger'],
        ['dashboard', 720, slow, [{ at: at(predict, 'hangs'), state: 'down', sub: 'Not responding' }], 'Dashboard']]
        .forEach(([key, x, fills, states, title], i) => {
          const node = program(b, key, { x, y: 266, w: 196, h: 92, title, at: begin(asyncCue) + 0.4 + i * 0.15, states });
          fromTopic(b, [x + 98, lane2.bottom], [x + 98, node.top], { at: begin(asyncCue) + 0.6 });
          arch.queue(b, { x: x - 4, y: 364, slots: 10, size: 14, fills, at: at(asyncCue, 'queue') });
          arch.stream(b, { path: [[290, lane2.center], [x + 98, lane2.center], [x + 98, node.top - 4]], at: at(asyncCue, 'copy'), until: end(hurts), every: 0.9, duration: 1.1 });
        });
      uml.callout(b, { x: 24, y: 300, w: 240, text: 'publish() returns', to: [272, lane2.center + 4], at: at(asyncCue, 'returns'), until: begin(predict) + 0.3 });
      arch.tag(b, { x: 716, y: 404, text: 'Full: oldest dropped', tone: 'red', at: at(hurts, 'dropped') });
      ps.walkway(b, {
        x: 24, y: 408, w: 420, at: at(predict, 'mochi'),
        stops: [{ at: -1, x: 30 }, { at: at(hurts, 'mochi'), x: 30 }, { at: at(hurts, 'dashboard'), x: 300, glide: true }],
      });
      wall.slot(b, { x: 470, y: 446, w: 290, h: 72, text: 'Freeze again?', at: at(predict, 'predict'), until: begin(hurts) + 0.2 });
      sticker(b, 'Slow subscriber hurts only itself', { x: 460, y: 470, at: at(hurts, 'harms'), variant: 'green', iconName: 'shield' });
    }

    // ----------------------------------------------------------------
    // Consequences, each beside the rule it follows from
    // ----------------------------------------------------------------

    function buys() {
      const ext = 'buys/extensibility';
      const a = picture(ext);
      arch.quality(a, { x: 24, y: 8, w: 330, name: 'Extensibility', at: at(ext, 'extensibility') });
      rule(a, 1, { x: 400, y: 8, w: 536, at: begin(ext) + 0.4 });
      arch.wire(a, { from: [358, 40], to: [394, 40], at: at(ext, 'ignorance') + 0.2, head: false });
      frame(a, { x: 8, y: 92, w: 944, h: 384, key: KEY_SHORT, at: begin(ext) + 0.15 });
      const camera = program(a, 'camera', { x: 330, y: 140, w: 254, at: begin(ext) + 0.2 });
      const sensor = program(a, 'sensor', { x: 640, y: 140, w: 296, at: begin(ext) + 0.3 });
      const image = arch.topic(a, { x: 24, y: 274, w: 560, name: '/camera/image', at: begin(ext) + 0.3 });
      const battery = arch.topic(a, { x: 640, y: 274, w: 296, name: '/battery', at: begin(ext) + 0.4 });
      toTopic(a, [457, camera.bottom], [457, image.top], { at: begin(ext) + 0.4 });
      toTopic(a, [880, sensor.bottom], [880, battery.top], { at: begin(ext) + 0.5 });
      [['counter', 24, 300, 'counter', image], ['recorder', 337, 290, 'recorder', image], ['battery', 640, 296, 'battery', battery]].forEach(([key, x, w, word, lane]) => {
        const node = program(a, key, { x, y: 370, w, at: at(ext, word), how: 'drop', states: [{ at: at(ext, word), state: 'new', sub: 'Just subscribes' }] });
        fromTopic(a, [x + w / 2, lane.bottom], [x + w / 2, node.top], { at: at(ext, word) + 0.2 });
      });
      sticker(a, 'Publishers: 0 lines changed', { x: 300, y: 482, at: at(ext, 'publisher'), variant: 'green', iconName: 'check' });

      const late = 'buys/late_binding';
      const b = picture(late);
      arch.quality(b, { x: 24, y: 8, w: 330, name: 'Run-time flexibility', at: at(late, 'flexibility') });
      arch.readout(b, {
        x: 370, y: 8, w: 210, label: 'Afternoon', iconName: 'timer', at: begin(late) + 0.2,
        values: [{ at: -1, text: '1:00 p.m.' }, { at: at(late, 'opens'), text: '1:30 p.m.' }, { at: at(late, 'closes'), text: '2:15 p.m.' }, { at: at(late, 'recorder'), text: '3:00 p.m.' }, { at: at(late, 'experiments'), text: '4:40 p.m.' }],
      });
      rule(b, 1, { x: 596, y: 8, w: 340, at: begin(late) + 0.4 });
      frame(b, { x: 8, y: 92, w: 944, h: 384, key: KEY_SHORT, at: begin(late) + 0.15 });
      const camera2 = program(b, 'camera', { x: 24, y: 140, w: 270, at: begin(late) + 0.3 });
      const lane = arch.topic(b, { x: 24, y: 262, w: 912, name: '/camera/image', tab: 'right', at: begin(late) + 0.4 });
      toTopic(b, [159, camera2.bottom], [159, lane.top], { at: begin(late) + 0.5 });
      // The dashboard joins and leaves with the operator; the recorder joins for the experiment.
      [['dashboard', 330, at(late, 'opens'), at(late, 'closes')], ['recorder', 640, at(late, 'recorder')]].forEach(([key, x, on, off]) => {
        const node = program(b, key, {
          x, y: 362, w: 296, at: begin(late) + 0.5,
          states: [{ at: -1, state: 'idle', sub: 'Not subscribed' }, { at: on, state: 'busy', sub: 'Subscribed' }, ...(off ? [{ at: off, state: 'idle', sub: 'Unsubscribed' }] : [])],
        });
        fromTopic(b, [x + 148, lane.bottom], [x + 148, node.top], { at: on, until: off });
      });

      const swap = 'buys/swap';
      const c = picture(swap);
      wall.listCard(c, {
        x: 24, y: 8, w: 912, title: 'Each benefit follows from a rule', iconName: 'list', at: begin(swap) + 0.1,
        items: [
          { text: 'Add subscribers freely: Rule 1, publisher ignorance', at: at(swap, 'third') },
          { text: 'Replace publishers freely: Rule 2, subscriber ignorance', at: at(swap, 'replaced') },
          { text: 'A slow subscriber can’t stall others: Rule 4, asynchronous', at: at(swap, 'waits') },
        ],
      });
      frame(c, { x: 8, y: 236, w: 680, h: 244, key: [['component', 'component']], at: at(swap, 'laser') - 0.4 });
      program(c, 'laser', { x: 24, y: 300, w: 300, h: 92, sub: 'Swapped in, same events', at: at(swap, 'laser'), states: [{ at: at(swap, 'laser'), state: 'new', sub: 'Swapped in, same events' }] });
      program(c, 'dashboard', { x: 352, y: 300, w: 320, h: 92, at: at(swap, 'crashed'), states: [{ at: at(swap, 'crashed'), state: 'crashed', sub: 'Crashed: no one stalls' }] });
      wall.banner(c, { x: 704, y: 300, w: 232, title: 'Rule of the style', text: 'The benefits come from the rules', at: at(swap, 'follows') });
    }

    // ----------------------------------------------------------------
    // Consequences: what the rules cost
    // ----------------------------------------------------------------

    function nobodyListens() {
      const rename = 'nobody_listens/rename';
      const predict = 'nobody_listens/predict_rename';
      const silent = 'nobody_listens/silent';
      const a = picture(rename, silent);
      arch.code(a, {
        x: 24, y: 8, w: 600, title: 'detector.py · tidy names', at: begin(rename) + 0.1,
        lines: [
          { code: 'pub = node.advertise("/obstacle_list")', kind: 'removed' },
          { code: 'pub = node.advertise("/obstacles")', kind: 'added', at: at(rename, 'obstacles') },
        ],
      });
      arch.readout(a, { x: 660, y: 8, w: 276, label: 'Code review', iconName: 'check', at: at(rename, 'approved'), values: [{ at: -1, text: 'Approved', state: 'ok' }] });
      arch.readout(a, { x: 660, y: 78, w: 128, label: 'Build', at: at(rename, 'compiles'), values: [{ at: -1, text: 'Compiles', state: 'ok' }] });
      arch.readout(a, { x: 800, y: 78, w: 136, label: 'Launch', at: at(rename, 'starts'), values: [{ at: -1, text: 'Starts', state: 'ok' }] });
      frame(a, { x: 8, y: 132, w: 944, h: 270, key: KEY_SHORT, at: begin(rename) + 0.2 });
      const detector = program(a, 'detector', {
        x: 24, y: 172, w: 340, h: 92, at: at(rename, 'detector'),
        states: [{ at: at(predict, 'spots'), state: 'busy', sub: 'Found: skateboard' }],
      });
      const obstacles = arch.topic(a, { x: 24, y: 340, w: 420, name: '/obstacles', tab: 'right', states: [{ at: at(rename, 'obstacles'), state: 'lit' }], at: at(rename, 'obstacles') });
      toTopic(a, [164, detector.bottom], [164, obstacles.top], { at: at(rename, 'publishes') });
      const list = arch.topic(a, { x: 496, y: 340, w: 440, name: '/obstacle_list', tab: 'right', states: [{ at: at(rename, 'still'), state: 'empty' }], at: at(rename, 'list') });
      const planner = program(a, 'planner', {
        x: 576, y: 172, w: 360, h: 92, at: at(rename, 'planner'),
        states: [{ at: at(rename, 'still'), state: 'idle', sub: 'Subscribes: /obstacle_list' }, { at: at(silent, 'nothing'), state: 'idle', sub: 'Hears nothing: goes straight' }],
      });
      fromTopic(a, [620, list.top], [620, planner.bottom], { at: at(rename, 'still') + 0.2 });
      arch.token(a, { kind: 'event', path: [[164, detector.bottom + 4], [164, obstacles.center], [380, obstacles.center]], at: at(predict, 'spots') + 0.3, duration: 1.2 });
      ps.walkway(a, {
        x: 24, y: 412, w: 560, at: at(predict, 'delivery'),
        stops: [{ at: -1, x: 30 }, { at: at(silent, 'safety') - 1.6, x: 30 }, { at: at(silent, 'safety'), x: 300, glide: true }],
        props: [{ kind: 'skater', x: 400, at: at(predict, 'skateboarder') }],
      });
      wall.slot(a, { x: 600, y: 430, w: 168, h: 64, text: 'Planner?', at: at(predict, 'planner'), until: begin(silent) + 0.2 });
      wall.slot(a, { x: 780, y: 430, w: 156, h: 64, text: 'Errors?', at: at(predict, 'error'), until: begin(silent) + 0.2 });
      sticker(a, 'Nobody’s listening', { x: 512, y: 354, at: at(silent, 'nobody'), variant: 'red', iconName: 'warning' });
      arch.readout(a, { x: 600, y: 430, w: 168, label: 'Error log', at: at(silent, 'error'), values: [{ at: -1, text: '0 errors', state: 'warn' }] });
      arch.readout(a, { x: 780, y: 430, w: 156, label: 'Bumper', at: at(silent, 'safety'), values: [{ at: -1, text: 'Stop!', state: 'bad' }] });

      const robust = 'nobody_listens/robustness';
      const b = picture(robust);
      wall.listCard(b, {
        x: 24, y: 8, w: 560, title: 'What still couples them', iconName: 'link', at: at(robust, 'couples'),
        items: [{ text: 'Topic name: /obstacles', at: at(robust, 'name') }, { text: 'Event format: Obstacle(x, y, kind)', at: at(robust, 'format') }, { text: 'Event meaning: x and y in meters', at: at(robust, 'meaning') }],
      });
      arch.quality(b, { x: 626, y: 8, w: 310, name: 'Robustness', effect: 'inhibited', at: at(robust, 'robustness') });
      arch.tag(b, { x: 626, y: 84, text: 'From Rules 1 and 3', tone: 'red', at: at(robust, 'ignorance') - 0.3 });
      frame(b, { title: 'direct call', x: 8, y: 230, w: 460, h: 290, key: [['component', 'component'], ['call', 'call']], keyAt: 'bottom', at: at(robust, 'direct') });
      const sender = program(b, 'camera', { x: 28, y: 280, w: 200, title: 'Sender', at: at(robust, 'direct') + 0.1 });
      uml.component(b, { x: 268, y: 280, w: 180, h: 59, name: 'Receiver', states: [{ at: at(robust, 'missing'), state: 'down' }], at: at(robust, 'direct') + 0.2 });
      uml.connector(b, { from: [sender.right, sender.cy], to: [268, sender.cy], kind: 'flow', ends: 'both', at: at(robust, 'direct') + 0.3 });
      arch.readout(b, { x: 28, y: 372, w: 420, label: 'Receiver missing', iconName: 'warning', at: at(robust, 'loudly'), values: [{ at: -1, text: 'Call failed: error', state: 'bad' }] });
      frame(b, { title: 'publish', x: 492, y: 230, w: 460, h: 290, key: [['component', 'component'], ['topic', 'topic']], keyAt: 'bottom', at: at(robust, 'publisher') });
      const publisher = program(b, 'camera', { x: 512, y: 280, w: 200, title: 'Publisher', at: at(robust, 'publisher') + 0.1 });
      const empty = arch.topic(b, { x: 736, y: 290, w: 196, name: 'events', at: at(robust, 'publisher') + 0.2, states: [{ at: at(robust, 'publisher') + 0.2, state: 'empty' }] });
      toTopic(b, [publisher.right, empty.center], [736, empty.center], { at: at(robust, 'publisher') + 0.3 });
      arch.readout(b, { x: 512, y: 372, w: 420, label: 'No subscriber', iconName: 'question', at: at(robust, 'received'), values: [{ at: -1, text: 'Delivered to 0, no error', state: 'warn' }] });
    }

    function whoTalks() {
      const scattered = 'who_talks/scattered';
      const a = picture(scattered);
      arch.search(a, {
        x: 24, y: 20, w: 470, query: '/camera/image', summary: '5 programs subscribe', at: at(scattered, 'search'), rowsAt: at(scattered, 'search') + 0.4,
        files: [{ file: 'detector.py' }, { file: 'logger.py' }, { file: 'dashboard.py' }, { file: 'counter.py' }, { file: 'recorder.py' }],
      });
      frame(a, { x: 516, y: 6, w: 436, h: 378, key: [['component', 'component'], ['topic', 'topic']], keyAt: 'bottom', at: at(scattered, 'diagram') - 0.2 });
      ps.bus(a, { x: 532, y: 56, w: 404, names: ['Camera', 'Detector', 'Planner', 'Logger', 'Counter', 'Motor'], at: at(scattered, 'diagram') });
      sticker(a, 'Who talks to whom?', { x: 560, y: 400, at: at(scattered, 'communicate'), variant: 'gold', iconName: 'question' });
      rule(a, 1, { x: 24, y: 350, w: 470, at: at(scattered, 'ignorance') - 0.3 });
      arch.quality(a, { x: 24, y: 420, w: 380, name: 'Understandability', effect: 'inhibited', at: at(scattered, 'understandability') });

      const order = 'who_talks/order';
      const b = picture(order);
      rule(b, 4, { x: 24, y: 8, w: 300, at: begin(order) + 0.2 });
      [['Run 1', 24, ['Logger', 'Planner', 'Dashboard'], 'notification'], ['Run 2', 340, ['Planner', 'Dashboard', 'Logger'], 'fixed']].forEach(([title, x, names, word]) => {
        wall.listCard(b, { x, y: 72, w: 296, title, iconName: 'list', at: at(order, word), items: names.map((text, i) => ({ text: `${i + 1}. ${text}`, at: at(order, word) + 0.2 + i * 0.15 })) });
      });
      arch.readout(b, { x: 656, y: 72, w: 280, label: 'Today', iconName: 'check', at: at(order, 'passes'), values: [{ at: -1, text: 'Test passed', state: 'ok' }] });
      arch.readout(b, { x: 656, y: 152, w: 280, label: 'Tomorrow', iconName: 'warning', at: at(order, 'tomorrow'), values: [{ at: -1, text: 'Test failed', state: 'bad' }] });
      wall.listCard(b, {
        x: 24, y: 312, w: 912, title: 'Event trace', iconName: 'timer', at: at(order, 'trace'),
        items: [{ text: '12:51:04.100  frame 812 published', at: at(order, 'trace') + 0.2 }, { text: '12:51:04.130  Planner received frame 812', at: at(order, 'trace') + 0.4 }, { text: '12:51:04.180  Logger received frame 812', at: at(order, 'observe') }],
      }).classList.add('ps-trace');

      const visible = 'who_talks/visible';
      const c = picture(visible);
      wall.listCard(c, {
        x: 24, y: 20, w: 912, title: 'Topic list: who publishes, who subscribes', iconName: 'list', at: at(visible, 'list'),
        items: [
          { text: '/camera/image: Camera driver → Detector, Logger, Dashboard, Counter', at: at(visible, 'publishers') },
          { text: '/obstacles: Detector → Planner', at: at(visible, 'subscribers') },
          { text: '/cmd_vel: Planner → Motor controller', at: at(visible, 'topic') },
        ],
      });
      wall.checklist(c, {
        x: 24, y: 290, w: 520, title: 'Make the flow visible', at: at(visible, 'design'),
        items: [
          { text: 'Design names and formats early', at: at(visible, 'design'), checkAt: at(visible, 'early') },
          { text: 'Keep the topic list current', at: at(visible, 'maintain'), checkAt: at(visible, 'topic') },
          { text: 'Test programs together', at: at(visible, 'test'), checkAt: at(visible, 'together') },
        ],
      });
      arch.readout(c, { x: 600, y: 300, w: 336, label: 'Detector + Planner', iconName: 'check', at: at(visible, 'together'), values: [{ at: -1, text: 'Integration test passed', state: 'ok' }] });

      const latency = 'who_talks/latency';
      const d = picture(latency);
      frame(d, { x: 8, y: 6, w: 944, h: 380, key: [['component', 'component'], ['flow', 'connector']], at: begin(latency) + 0.05 });
      const camera = program(d, 'camera', { x: 24, y: 64, w: 250, at: begin(latency) + 0.1 });
      const detector = program(d, 'detector', { x: 686, y: 64, w: 250, at: begin(latency) + 0.2 });
      uml.connector(d, { from: [camera.right, camera.cy], to: [686, detector.cy], kind: 'flow', ends: 'both', at: at(latency, 'direct') });
      uml.label(d, { x: 400, y: 56, text: 'call', at: at(latency, 'direct') });
      const broker = program(d, 'broker', {
        x: 355, y: 220, w: 250, at: at(latency, 'detour'), title: 'Broker',
        states: [{ at: at(latency, 'fails'), state: 'down', sub: 'Down' }],
      });
      uml.connector(d, { points: [[149, camera.bottom], [149, broker.cy], [355, broker.cy]], kind: 'flow', ends: 'both', at: at(latency, 'detour') + 0.2 });
      uml.connector(d, { points: [[605, broker.cy], [811, broker.cy], [811, detector.bottom]], kind: 'flow', ends: 'both', at: at(latency, 'detour') + 0.4 });
      arch.tag(d, { x: 640, y: 290, text: '+ latency', tone: 'red', at: at(latency, 'delay') });
      arch.quality(d, { x: 24, y: 400, w: 300, name: 'Latency', effect: 'inhibited', at: at(latency, 'latency') + 0.3 });
      sticker(d, 'Single point of failure', { x: 380, y: 400, at: at(latency, 'single'), variant: 'red', iconName: 'warning' });
      arch.tag(d, { x: 600, y: 470, text: 'Broker down: every topic stops', tone: 'red', at: at(latency, 'conversation') });
    }

    function when() {
      const brake = 'when/brake';
      const a = picture(brake);
      frame(a, { x: 8, y: 6, w: 944, h: 380, key: [['component', 'component'], ['topic', 'topic'], ['call', 'call']], at: begin(brake) + 0.05 });
      const safety = program(a, 'safety', { x: 24, y: 64, w: 300, sub: 'Brake now!', at: at(brake, 'safety') });
      const lane = arch.topic(a, { x: 380, y: 96, w: 300, name: '/brake', at: at(brake, 'published') });
      uml.connector(a, { from: [safety.right, lane.center], to: [380, lane.center], kind: 'flow', tone: 'red', dashed: true, ends: 'from', at: at(brake, 'published') + 0.2 });
      arch.tag(a, { x: 712, y: 106, text: 'Did anyone hear it?', at: at(brake, 'received') });
      arch.cross(a, { x: 530, y: 118, size: 44, at: at(brake, 'moving') });
      const motor = program(a, 'motor', { x: 24, y: 270, w: 300, at: at(brake, 'direct'), states: [{ at: at(brake, 'loudly'), state: 'same', sub: 'Reply: stopped' }] });
      arch.code(a, { x: 380, y: 270, w: 556, at: at(brake, 'call'), lines: [{ code: 'motor.stop()  # waits for a reply' }] });
      uml.connector(a, { from: [174, safety.bottom], to: [174, motor.top], kind: 'flow', tone: 'green', ends: 'both', at: at(brake, 'call') });
      uml.label(a, { x: 190, y: 200, text: 'call', tone: 'green', at: at(brake, 'call') + 0.2 });
      sticker(a, 'Needs a guarantee: call directly', { x: 380, y: 410, at: at(brake, 'unavailable'), variant: 'green', iconName: 'check' });

      const thumb = 'when/rule_of_thumb';
      const b = picture(thumb);
      wall.listCard(b, {
        x: 24, y: 30, w: 440, title: 'Publish: facts', iconName: 'merge', at: at(thumb, 'publish'),
        items: [{ text: 'New camera frame', at: at(thumb, 'frame') }, { text: 'Battery level', at: at(thumb, 'battery') }, { text: 'Arrived at a building', at: at(thumb, 'arrival') }],
      });
      wall.listCard(b, {
        x: 496, y: 30, w: 440, title: 'Call: requests', iconName: 'phone', at: at(thumb, 'call'),
        items: [{ text: 'Stop the motors', at: at(thumb, 'stopping') }, { text: 'Charge the card', at: at(thumb, 'charging') }],
      });
      wall.banner(b, { x: 160, y: 360, w: 640, title: 'Rule of thumb', text: 'Facts many may want: publish. Requests that need an answer: call.', at: at(thumb, 'both') });

      const frameworks = 'when/frameworks';
      const c = picture(frameworks);
      [['Robot middleware', 'DDS, used in ROS 2', 'gear', 'robot'], ['Tiny-device messaging', 'MQTT', 'wifi', 'messaging'], ['Event streaming', 'Apache Kafka', 'stack', 'streaming']].forEach(([title, text, iconName, word], i) => {
        wall.listCard(c, { x: 24 + i * 308, y: 30, w: 296, title, text, iconName, at: at(frameworks, word) });
      });
      arch.quality(c, { x: 24, y: 270, w: 440, name: 'Extensibility, run-time flexibility', at: at(frameworks, 'extensibility') });
      arch.quality(c, { x: 496, y: 270, w: 440, name: 'Robustness, understandability', effect: 'inhibited', at: at(frameworks, 'robustness') });
      sticker(c, 'Pick a framework, pick its trade-off', { x: 220, y: 420, at: at(frameworks, 'selecting'), variant: 'gold', iconName: 'transfer' });
    }


    // ----------------------------------------------------------------
    // In practice: real publish-subscribe systems from many domains
    // ----------------------------------------------------------------

    /**
     * A real system as a small C&C view: one publisher over a topic, three
     * subscribers below it, in a frame titled with the system and its
     * domain; the rule that makes the style fit is written underneath.
     */
    function example(parent, { x, title, publisher, topic, subscribers, why, whyTone = 'green', at }) {
      frame(parent, { title, x, y: 6, w: 460, h: 472, keyAt: 'bottom', at });
      const pub = program(parent, null, { x: x + 100, y: 50, w: 260, title: publisher, at: at + 0.1 });
      const lane = arch.topic(parent, { x: x + 16, y: 210, w: 428, name: topic, tab: 'inside', at: at + 0.2 });
      toTopic(parent, [x + 230, pub.bottom], [x + 230, lane.top], { at: at + 0.3 });
      subscribers.forEach((name, i) => {
        const sx = x + 16 + i * 148;
        uml.component(parent, { x: sx, y: 304, w: 132, h: 84, name, variant: 'compact', at: at + 0.4 + i * 0.12 });
        fromTopic(parent, [sx + 66, lane.bottom], [sx + 66, 304], { at: at + 0.5 + i * 0.12 });
      });
      arch.tag(parent, { x: x + 16, y: 402, text: why, tone: whyTone, at: at + 1 });
    }

    function inPractice() {
      const phone = 'in_practice/phone_chat';
      const a = picture(phone);
      example(a, { x: 8, title: 'Android · phones', publisher: 'Connectivity service', topic: 'AIRPLANE_MODE', subscribers: ['Messaging app', 'Music app', 'Navigation app'], why: 'Rule 1: no idea who listens', at: at(phone, 'android') - 0.4 });
      example(a, { x: 492, title: 'Slack · team chat', publisher: 'Slack web app', topic: '#cs130', subscribers: ['Gateway, US', 'Gateway, Europe', 'Gateway, Asia'], why: 'Channel server fans out to gateways', at: at(phone, 'slack') });

      const games = 'in_practice/games_feeds';
      const b = picture(games);
      example(b, { x: 8, title: 'Roblox · games', publisher: 'Game server 1', topic: 'Announcements', subscribers: ['Game server 2', 'Game server 3', 'Game server 4'], why: 'Best effort: no guarantee', whyTone: 'red', at: at(games, 'roblox') - 0.4 });
      example(b, { x: 492, title: 'Kafka at LinkedIn', publisher: 'Front-end services', topic: 'page views', subscribers: ['Live services', 'Hadoop, warehouse', 'A new team'], why: 'New teams, no producer change', at: at(games, 'linkedin') });

      const home = 'in_practice/home_grid';
      const c = picture(home);
      example(c, { x: 8, title: 'MQTT · smart homes', publisher: 'Temperature sensor', topic: 'living_room/temperature', subscribers: ['Dashboard', 'Heating automation', 'Data logger'], why: 'One subscription per new tool', at: at(home, 'smart') - 0.4 });
      example(c, { x: 492, title: 'IEC 61850 · power grid', publisher: 'Protection relay', topic: 'trip (multicast)', subscribers: ['Relay A', 'Relay B', 'Relay C'], why: 'No ack: repeat, then heartbeat', whyTone: 'red', at: at(home, 'power') });

      const thread = 'in_practice/common_thread';
      const d = picture(thread);
      rule(d, 1, { x: 24, y: 20, w: 444, at: begin(thread) + 0.3 });
      rule(d, 2, { x: 24, y: 76, w: 444, at: begin(thread) + 0.5 });
      wall.listCard(d, {
        x: 24, y: 150, w: 444, title: 'Consumers come and go', iconName: 'merge', at: at(thread, 'consumers'),
        items: [{ text: 'Android apps' }, { text: 'Slack gateways' }, { text: 'LinkedIn teams' }, { text: 'Smart-home tools' }],
      });
      rule(d, 1, { x: 492, y: 20, w: 444, at: at(thread, 'pays') - 0.4 });
      rule(d, 3, { x: 492, y: 76, w: 444, at: at(thread, 'pays') - 0.2 });
      wall.listCard(d, {
        x: 492, y: 150, w: 444, title: 'No receipt: three answers', iconName: 'question', tone: 'trap', at: at(thread, 'received'),
        items: [{ text: 'Roblox: accept the loss', at: at(thread, 'roblox') }, { text: 'LinkedIn: a replayable log', at: at(thread, 'linkedin') }, { text: 'Substations: repeat it', at: at(thread, 'substations') }],
      });
    }

    // ----------------------------------------------------------------
    // Summary
    // ----------------------------------------------------------------

    function summary() {
      const problem = 'summary/recap_problem';
      const a = picture(problem);
      wall.frame(a, { x: 24, y: 34, w: 520, h: 470, label: 'Before: direct calls', at: begin(problem) + 0.1 });
      cameraLoop(a, { x: 34, y: 60, w: 500, at: begin(problem) + 0.2 });
      arch.tag(a, { x: 44, y: 360, text: 'Each new listener: edit the camera', tone: 'red', at: at(problem, 'editing') });
      arch.tag(a, { x: 44, y: 410, text: 'One slow listener: the robot froze', tone: 'red', at: at(problem, 'froze') });
      frame(a, { title: 'after', x: 566, y: 10, w: 386, h: 500, key: [['component', 'component'], ['topic', 'topic']], keyAt: 'bottom', at: at(problem, 'publish') });
      const camera = program(a, 'camera', { x: 586, y: 56, w: 346, at: at(problem, 'publish') + 0.1 });
      const lane = arch.topic(a, { x: 586, y: 186, w: 346, name: '/camera/image', tab: 'right', at: at(problem, 'topic') });
      toTopic(a, [620, camera.bottom], [620, lane.top], { at: at(problem, 'publishers') });
      // Every subscriber attaches to the topic: the second row's attachments run down through the gap
      // between the first row's boxes, so no line crosses a box.
      [['Detector', 596, 286, 130, 661], ['Logger', 802, 286, 120, 862], ['Dashboard', 606, 382, 150, 746], ['Counter', 772, 382, 140, 782]]
        .forEach(([title, x, y, w, attachX], i) => {
          const when = at(problem, 'delivers') + i * 0.12;
          uml.component(a, { x, y, w, h: 64, name: title, variant: 'compact', at: when });
          fromTopic(a, [attachX, lane.bottom], [attachX, y], { at: when });
        });

      // Each rule over the consequence it yields.
      const rules = 'summary/recap_rules';
      const b = picture(rules);
      [[1, 'publishers'], [2, 'subscribers'], [3, 'information'], [4, 'publishing']].forEach(([n, word], i) => {
        rule(b, n, { x: 24 + i * 232, y: 24, w: 216, at: at(rules, word) - 0.5 });
      });
      wall.bracket(b, { x: 24, y: 128, w: 448, text: 'Rules 1 and 2', at: at(rules, 'ignorance') });
      wall.bracket(b, { x: 488, y: 128, w: 448, text: 'Rules 3 and 4', at: at(rules, 'asynchronous') });
      // Each quality under the bracket of the rules it follows from, wide enough for its name.
      [['Extensibility', 98, 190, 'extensibility'], ['Replaceability', 98, 262, 'replaceability'], ['Fault isolation', 562, 190, 'isolation']].forEach(([name, x, y, word]) => {
        arch.quality(b, { x, y, w: 300, name, at: at(rules, word) });
      });
      sticker(b, 'Add, swap, and plug in while it runs', { x: 230, y: 400, at: at(rules, 'runs'), variant: 'green', iconName: 'sparkle' });

      // The qualities the last cue promoted stand on the left; each cost arrives as the narration names it.
      const costs = 'summary/recap_costs';
      const c = picture(costs);
      arch.tradeoff(c, {
        x: 480, y: 80, beam: 480, h: 330, at: begin(costs) + 0.1,
        pans: [
          {
            w: 440, title: 'Promoted', at: begin(costs) + 0.2,
            items: [
              { name: 'Extensibility', rule: 'Rule 1', why: 'Add a subscriber, change no publisher' },
              { name: 'Replaceability', rule: 'Rule 2', why: 'Swap in a publisher of the same events' },
              { name: 'Fault isolation', rule: 'Rules 3, 4', why: 'A slow subscriber stalls no one else' },
            ],
          },
          {
            w: 440, title: 'Inhibited', effect: 'inhibited', at: begin(costs) + 0.3,
            items: [
              { name: 'Robustness', rule: 'Rules 1, 3', why: 'Nobody confirms delivery', at: at(costs, 'robustness') },
              { name: 'Understandability', rule: 'Rules 1, 2', why: 'Finding receivers means searching every component', at: at(costs, 'understandability') },
              { name: 'Latency', why: 'Every event passes through the infrastructure', at: at(costs, 'latency') },
            ],
          },
        ],
      });

      // The rule of thumb that follows: publish facts, call for requests.
      const choice = 'summary/recap_choice';
      const d = picture(choice);
      wall.banner(d, { x: 24, y: 24, w: 912, title: 'Choose per message', text: 'Publish facts. Call when you need an answer or a guarantee.', at: at(choice, 'choose') });
      wall.listCard(d, {
        x: 24, y: 150, w: 440, title: 'Publish: facts', iconName: 'merge', at: at(choice, 'publish'),
        items: [{ text: 'New camera frame' }, { text: 'Battery level' }, { text: 'Arrived at a building' }],
      });
      wall.listCard(d, {
        x: 496, y: 150, w: 440, title: 'Call: requests', iconName: 'phone', at: at(choice, 'call'),
        items: [{ text: 'Stop the motors' }, { text: 'Charge the card' }],
      });
      sticker(d, 'Who’s listening, and do you need to know?', { x: 200, y: 430, at: at(choice, 'listening'), variant: 'gold', iconName: 'question' });
    }

    intro();
    directCalls();
    topicScene();
    ignorance();
    oneWay();
    buys();
    nobodyListens();
    whoTalks();
    when();
    inPractice();
    summary();
  };
})();
