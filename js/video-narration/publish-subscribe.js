/*
 * Choreography for the Publish-Subscribe video narration (script:
 * _data/narrations/publish_subscribe.yml; artwork: publish-subscribe-kit.js
 * on the architecture kit and the wall kit). The narration reaches this stage
 * as a song: each scene is a section and each cue a line, and `at(cue, word)`
 * is the estimated time the narrator says that word (repeated words are
 * word2, word3, ...). Cues are named by their stable script ids
 * ('intro/lunch'), looked up in the storyboard, so reordering the script
 * never misplaces a picture.
 *
 * The teaching rule for the pictures: show the mechanism the cue names, on
 * Mochi, the campus delivery robot. Programs are paper cards; a topic is a
 * channel with its name on a tab; frames are tokens that travel; the four
 * rules are numbered rule cards; and every consequence is a quality card that
 * says Promoted or Inhibited in words. Stamps never shake the stage, and
 * nothing large changes brightness quickly (WCAG 2.3.1). Layout: the 960x540
 * picture body; nothing readable within 12px of an edge.
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
    summary: { kind: 'Recap', name: 'Announce, don’t call', iconName: 'check' },
  };

  const PROGRAMS = {
    camera: { title: 'Camera driver', iconName: 'camera' },
    detector: { title: 'Obstacle detector', iconName: 'eye' },
    planner: { title: 'Planner', iconName: 'pin' },
    motor: { title: 'Motor controller', iconName: 'gear' },
    logger: { title: 'Logger', iconName: 'file' },
    dashboard: { title: 'Operator dashboard', iconName: 'laptop' },
    counter: { title: 'Pedestrian counter', iconName: 'team' },
    battery: { title: 'Battery monitor', iconName: 'bolt' },
    sensor: { title: 'Battery sensor', iconName: 'chip' },
    recorder: { title: 'Research recorder', iconName: 'video' },
    laser: { title: 'Laser detector', iconName: 'target' },
    safety: { title: 'Safety monitor', iconName: 'shield' },
    broker: { title: 'Broker', iconName: 'router' },
  };

  /** The stage's line id for each cue ('scene/cue' to 'scene-n'), from the storyboard. */
  function lineIds() {
    const story = JSON.parse(document.getElementById('narration-storyboard').textContent);
    const ids = {};
    story.scenes.forEach((scene) => scene.cues.forEach((cue, i) => { ids[`${scene.id}/${cue.id}`] = `${scene.id}-${i + 1}`; }));
    return ids;
  }

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.publish_subscribe = function choreograph({ song, kit, layers }) {
    const { fx } = window.Timeline;
    const wall = window.WallKit;
    const arch = window.ArchKit;
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
    const program = (parent, key, options) => arch.card(parent, { ...PROGRAMS[key], ...options });

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
      wall.label(b, { x: 24, y: 16, text: 'Inside Mochi: six programs', at: begin(inside) + 0.1 });
      [
        ['camera', 'camera', '30 frames a second'], ['detector', 'obstacle', 'Finds people and scooters'],
        ['planner', 'planner', 'Picks the path'], ['motor', 'motor', 'Turns the wheels'],
        ['logger', 'logger', 'Records the trip'], ['dashboard', 'operator', 'Shows the camera’s view'],
      ].forEach(([key, word, sub], i) => program(b, key, {
        x: 24 + (i % 3) * 312, y: 78 + Math.floor(i / 3) * 176, w: 296, sub, at: at(inside, word),
      }));
      ps.robot(b, { path: [[480, 470]], at: begin(inside) + 0.2, size: 104 });

      const ticket = 'intro/ticket';
      const c = picture(ticket);
      wall.badge(c, { x: 70, y: 96, w: 150, role: 'You', iconName: 'user', at: at(ticket, 'joined') });
      wall.skill(c, { x: 34, y: 262, w: 220, text: 'New on the Mochi team', at: at(ticket, 'team') });
      wall.listCard(c, {
        x: 300, y: 26, w: 636, title: 'Ticket 1: Count pedestrians', iconName: 'list', at: at(ticket, 'first'),
        text: 'For campus planning: how crowded the main walkway gets, from the camera’s frames.',
      });
      wall.label(c, { x: 300, y: 262, text: 'Who has wanted the frames', at: at(ticket, 'fans') });
      [['logger', 'Logger', 'Last year', 'logger'], ['dashboard', 'Dashboard', 'This spring', 'dashboard'], ['counter', 'Pedestrian counter', 'Now', 'this']]
        .forEach(([key, title, sub, word], i) => program(c, key, {
          x: 300 + i * 214, y: 316, w: 202, title, sub, at: at(ticket, word),
          states: key === 'counter' ? [{ at: at(ticket, word), state: 'new', sub }] : [],
        }));
    }

    /** camera.py's loop, calling every listener by name; `withCounter` types the fourth call at that time. */
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
      const predict = 'direct_calls/predict_counter';
      const edit = 'direct_calls/edit_camera';
      const a = picture(calls, edit);
      const loop = cameraLoop(a, { x: 24, y: 24, at: begin(calls) + 0.1, counterAt: at(edit, 'add2') });
      // Rows sit 32px apart from y = 24 + 62; a call's arrow leaves its row's right end.
      const rowY = (row) => 24 + 62 + row * 32 + 16;
      [['detector', 'detector', 24, 'logger'], ['logger', 'logger', 124, 'dashboard'], ['dashboard', 'dashboard', 224, 'one']].forEach(([key, word, y, next], i) => {
        program(a, key, { x: 640, y, w: 296, at: at(calls, word) });
        arch.wire(a, { from: [572, rowY(i + 2)], to: [630, y + 32], at: at(calls, word) + 0.15 });
        wall.lit(loop.rows[i + 2], [[at(calls, word), at(calls, next)]]);
      });
      sticker(a, 'Each call waits for its return', { x: 300, y: 300, at: at(calls, 'waits'), until: end(calls), variant: 'white', iconName: 'hourglass' });

      program(a, 'counter', {
        x: 640, y: 352, w: 296, at: at(predict, 'counter'),
        states: [{ at: at(predict, 'counter'), state: 'idle', sub: 'Not connected yet' }, { at: at(edit, 'add2'), state: 'new', sub: 'Called from the loop' }],
      });
      wall.slot(a, { x: 40, y: 300, w: 480, h: 72, text: 'Which code changes?', at: at(predict, 'predict'), until: begin(edit) + 0.2 });

      arch.wire(a, { from: [572, rowY(5)], to: [630, 384], at: at(edit, 'add2') + 0.2 });
      stamp(a, 'Edit camera.py', { x: 60, y: 300, at: at(edit, 'loop'), color: 'red', rotate: -4 });
      sticker(a, 'Retest the camera', { x: 40, y: 388, at: at(edit, 'retest'), variant: 'red', iconName: 'resend' });
      sticker(a, 'Redeploy the camera', { x: 40, y: 452, at: at(edit, 'redeploy'), variant: 'red', iconName: 'bolt' });

      const freeze = 'direct_calls/freeze';
      const b = picture(freeze);
      const loop2 = cameraLoop(b, { x: 24, y: 24, at: begin(freeze) + 0.1 });
      wall.lit(loop2.rows[4], [[at(freeze, 'call'), end(freeze)]]);
      program(b, 'dashboard', {
        x: 640, y: 24, w: 296, at: begin(freeze) + 0.2,
        states: [{ at: at(freeze, 'hung'), state: 'down', sub: 'Server not responding' }],
      });
      program(b, 'detector', {
        x: 640, y: 150, w: 296, at: begin(freeze) + 0.3,
        states: [{ at: at(freeze, 'detector'), state: 'idle', sub: 'No new frames' }],
      });
      // Frames pile up at the line that never returns.
      [0, 1, 2, 3].forEach((i) => arch.token(b, { path: [[596 + (i % 2) * 6, 214 - i * 14]], at: at(freeze, 'returned') + i * 0.5, duration: 0 }));
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
    // Rules: the parts, then the four rules
    // ----------------------------------------------------------------

    function topicScene() {
      const pub = 'topic/publisher';
      const subs = 'topic/subscribers';
      const joins = 'topic/counter_joins';
      const a = picture(pub, joins);
      arch.code(a, {
        x: 24, y: 14, w: 580, title: 'camera.py', at: at(pub, 'publisher'),
        lines: [{ code: 'pub = node.advertise("/camera/image")' }, { code: 'pub.publish(frame)', at: at(pub, 'publishes') }],
      });
      program(a, 'camera', { x: 640, y: 14, w: 296, sub: 'Publisher', at: begin(pub) + 0.1 });
      arch.topic(a, { x: 24, y: 196, w: 912, name: '/camera/image', at: at(pub, 'topic') });
      arch.wire(a, { from: [788, 106], to: [788, 192], at: at(pub, 'publishes') });
      arch.stream(a, { path: [[788, 112], [788, 218], [870, 218]], at: at(pub, 'publishes') + 0.3, until: begin(subs), every: 1.1, duration: 1.0 });

      const columns = [24, 256, 488, 720];
      const subscribers = [['detector', at(subs, 'detector')], ['logger', at(subs, 'logger')], ['dashboard', at(subs, 'dashboard')], ['counter', at(joins, 'counter')]];
      subscribers.forEach(([key, when], i) => {
        const x = columns[i];
        program(a, key, { x, y: 262, w: 216, at: when, how: key === 'counter' ? 'slide' : 'pop', states: key === 'counter' ? [{ at: at(joins, 'three'), state: 'new', sub: 'Counted: 3' }, { at: at(joins, 'none'), state: 'new', sub: 'Counted: 7' }] : [] });
        arch.wire(a, { from: [x + 108, 240], to: [x + 108, 258], at: when + 0.2, head: false, tone: 'cyan' });
        arch.queue(a, { x, y: 390, slots: 6, size: 22, at: when + 0.3, fills: busyFills(when + 0.6, end(joins), { high: 2, seed: i + 1 }) });
        arch.stream(a, { path: [[788, 112], [788, 218], [x + 108, 218], [x + 108, 256]], at: when + 0.6, until: end(joins), every: 1.1, duration: 1.2 });
      });
      arch.tag(a, { x: 24, y: 428, text: 'Each subscriber: its own message queue', at: at(subs, 'queue') });
      arch.code(a, {
        x: 24, y: 470, w: 600, at: at(subs, 'callback'),
        lines: [{ code: 'node.subscribe("/camera/image", 10, on_frame)' }],
      });
      sticker(a, '0 lines changed', { x: 650, y: 474, at: at(joins, 'line'), variant: 'green', iconName: 'check' });

      chain('topic/both_roles');
    }

    /**
     * Mochi as a chain of topics (topic/both_roles): every arrow runs from a
     * program to a topic or from a topic to a program. Gold arrows publish;
     * cyan arrows deliver to subscribers.
     */
    function chain(cue) {
      const a = picture(cue);
      const when = (word) => at(cue, word);
      const t0 = begin(cue) + 0.1;
      program(a, 'camera', { x: 24, y: 34, w: 248, at: t0 });
      arch.topic(a, { x: 300, y: 48, w: 636, name: '/camera/image', at: t0 + 0.1 });
      arch.wire(a, { from: [276, 70], to: [296, 70], at: t0 + 0.3 });
      program(a, 'detector', { x: 300, y: 126, w: 270, at: when('detector') });
      arch.wire(a, { from: [434, 92], to: [434, 122], tone: 'cyan', at: when('subscribes') });
      [['logger', 'Logger', 594], ['dashboard', 'Dashboard', 768]].forEach(([key, title, x]) => {
        program(a, key, { x, y: 126, w: 168, title, at: t0 + 0.4 });
        arch.wire(a, { from: [x + 84, 92], to: [x + 84, 122], tone: 'cyan', at: t0 + 0.6 });
      });
      arch.topic(a, { x: 300, y: 262, w: 636, name: '/obstacles', tab: 'right', at: when('obstacles') });
      arch.wire(a, { from: [434, 194], to: [434, 258], at: when('publishes') });
      program(a, 'planner', { x: 300, y: 336, w: 220, at: when('planner') });
      arch.wire(a, { from: [410, 306], to: [410, 332], tone: 'cyan', at: when('subscribes2') });
      arch.topic(a, { x: 300, y: 470, w: 636, name: '/cmd_vel', tab: 'right', at: when('commands') });
      arch.wire(a, { from: [410, 404], to: [410, 466], at: when('publishes2') });
      program(a, 'motor', { x: 546, y: 336, w: 260, at: when('motor') });
      arch.wire(a, { from: [610, 470], to: [610, 408], tone: 'cyan', at: when('subscribes3') });
      wall.listCard(a, {
        x: 24, y: 190, w: 250, title: 'Arrows', iconName: 'merge', at: when('arrow'),
        items: [{ text: 'Program to topic', at: when('arrow') + 0.2 }, { text: 'Topic to program', at: when('topic2') }, { text: 'Never program to program', at: when('never') }],
      });
    }

    function ignorance() {
      const pubRule = 'ignorance/publisher_rule';
      const a = picture(pubRule);
      arch.rule(a, { x: 24, y: 18, w: 600, n: 1, name: 'Publisher ignorance', text: 'Don’t rely on who listens, or whether anyone does.', at: at(pubRule, 'one') });
      [['Five subscribers', 24, 5, 'five'], ['No subscribers', 496, 0, 'none']].forEach(([label, x, count, word]) => {
        wall.frame(a, { x, y: 186, w: 440, h: 276, label, at: at(pubRule, word) });
        program(a, 'camera', { x: x + 20, y: 204, w: 250, at: at(pubRule, word) + 0.1 });
        arch.topic(a, { x: x + 20, y: 318, w: 400, name: '/camera/image', tab: 'right', at: at(pubRule, word) + 0.2 });
        arch.wire(a, { from: [x + 145, 272], to: [x + 145, 314], at: at(pubRule, word) + 0.3 });
        for (let i = 0; i < count; i += 1) {
          const chip = wall.staged(a, 'ps-sub-chip is-staged', x + 30 + i * 78, 384);
          chip.append(window.SongKit.icon('user'));
          fx.pop(chip, at(pubRule, word) + 0.4 + i * 0.1, { from: 0.4 });
          arch.wire(a, { from: [x + 58 + i * 78, 362], to: [x + 58 + i * 78, 382], head: false, tone: 'cyan', at: at(pubRule, word) + 0.4 + i * 0.1 });
        }
        if (!count) arch.tag(a, { x: x + 30, y: 392, text: 'Nobody subscribed', at: at(pubRule, word) + 0.4 });
      });
      sticker(a, 'Same camera code in both', { x: 300, y: 478, at: at(pubRule, 'forgets'), variant: 'green', iconName: 'check' });

      const subRule = 'ignorance/subscriber_rule';
      const b = picture(subRule);
      arch.rule(b, { x: 24, y: 18, w: 600, n: 2, name: 'Subscriber ignorance', text: 'Subscribe to the event, not to its source.', at: at(subRule, 'two') });
      arch.topic(b, { x: 24, y: 300, w: 912, name: '/obstacles', at: at(subRule, 'obstacles') });
      program(b, 'detector', { x: 560, y: 170, w: 330, title: 'Camera detector', at: begin(subRule) + 0.2, until: at(subRule, 'swaps') + 0.3 });
      program(b, 'laser', { x: 560, y: 170, w: 330, at: at(subRule, 'laser'), how: 'slide', states: [{ at: at(subRule, 'laser'), state: 'new', sub: 'Same topic' }] });
      arch.wire(b, { from: [725, 240], to: [725, 296], at: begin(subRule) + 0.4 });
      program(b, 'planner', {
        x: 560, y: 380, w: 330, at: at(subRule, 'planner'),
        states: [{ at: at(subRule, 'notices'), state: 'same', sub: 'Nothing changed' }],
      });
      arch.wire(b, { from: [725, 344], to: [725, 376], tone: 'cyan', at: at(subRule, 'planner') + 0.2 });
      arch.tag(b, { x: 40, y: 380, text: 'Subscribes to: /obstacles', mono: false, at: at(subRule, 'subscribes') });

      const observer = 'ignorance/observer';
      const c = picture(observer);
      wall.frame(c, { x: 24, y: 40, w: 440, h: 470, label: 'Observer', at: at(observer, 'observer') });
      program(c, 'planner', { x: 44, y: 66, w: 400, title: 'Subject', sub: 'Keeps: observers A, B, C', iconName: 'list', at: at(observer, 'subject') });
      ['A', 'B', 'C'].forEach((letter, i) => {
        program(c, 'logger', { x: 44 + i * 136, y: 300, w: 128, title: letter, iconName: 'eye', at: at(observer, 'calls') + i * 0.12 });
        arch.wire(c, { from: [108 + i * 136, 168], to: [108 + i * 136, 296], at: at(observer, 'calls') + 0.1 + i * 0.12 });
      });
      arch.tag(c, { x: 44, y: 420, text: 'The subject calls each one', at: at(observer, 'each') });
      wall.frame(c, { x: 496, y: 40, w: 440, h: 470, label: 'Publish-subscribe', at: at(observer, 'here') });
      program(c, 'camera', { x: 516, y: 66, w: 240, title: 'Publisher', at: at(observer, 'neither') });
      program(c, 'detector', { x: 516, y: 404, w: 240, title: 'Subscriber', at: at(observer, 'neither') + 0.1 });
      const process = wall.listCard(c, {
        x: 516, y: 188, w: 400, title: 'Topic: separate process', iconName: 'router', at: at(observer, 'process'),
        items: [{ text: 'Keeps: subscribers A, B, C', at: at(observer, 'list2') }],
      });
      process.classList.add('ps-process');
      sticker(c, 'No reference either way', { x: 516, y: 136, at: at(observer, 'reference'), variant: 'white', iconName: 'cross' });
    }

    function oneWay() {
      const noReturn = 'one_way/no_return';
      const a = picture(noReturn);
      arch.rule(a, { x: 24, y: 18, w: 600, n: 3, name: 'One-way propagation', text: 'No return values: information flows only from publisher to subscriber.', at: at(noReturn, 'three') });
      program(a, 'camera', { x: 24, y: 196, w: 260, at: begin(noReturn) + 0.3 });
      wall.speech(a, { x: 310, y: 186, w: 330, text: 'Did anyone see an obstacle?', at: at(noReturn, 'ask') });
      arch.cross(a, { x: 724, y: 214, size: 60, at: at(noReturn, 'cant') + 0.6 });
      sticker(a, 'No reply channel', { x: 310, y: 268, at: at(noReturn, 'cant') + 0.8, variant: 'red', iconName: 'cross' });
      arch.topic(a, { x: 24, y: 446, w: 912, name: '/obstacles', at: at(noReturn, 'another') });
      program(a, 'detector', { x: 580, y: 316, w: 320, sub: 'Publishes what it found', at: at(noReturn, 'answer') });
      arch.wire(a, { from: [740, 404], to: [740, 442], at: at(noReturn, 'event') });
      arch.token(a, { kind: 'event', path: [[740, 380], [740, 468], [880, 468]], at: at(noReturn, 'event') + 0.3, duration: 1.4, until: end(noReturn) - 0.6 });

      const asyncCue = 'one_way/async';
      const predict = 'one_way/predict_hang';
      const hurts = 'one_way/hurts_itself';
      const b = picture(asyncCue, hurts);
      arch.rule(b, { x: 24, y: 14, w: 600, n: 4, name: 'Asynchronous', text: 'The publisher never waits: publish() returns at once.', at: at(asyncCue, 'four'), until: begin(predict) + 0.3 });
      program(b, 'camera', { x: 652, y: 14, w: 284, sub: '30 frames a second', at: begin(asyncCue) + 0.2 });
      arch.topic(b, { x: 24, y: 178, w: 912, name: '/camera/image', at: begin(asyncCue) + 0.3 });
      arch.wire(b, { from: [794, 106], to: [794, 174], at: begin(asyncCue) + 0.4 });
      const quiet = busyFills(at(asyncCue, 'drops'), end(hurts), { high: 1, seed: 2 });
      const slow = [
        ...busyFills(at(asyncCue, 'drops'), at(predict, 'hangs'), { low: 2, high: 4, every: 0.6, seed: 3 }),
        ...risingFills(at(predict, 'hangs'), 4, 10, 0.55),
      ];
      [['detector', 24, quiet, []], ['logger', 336, busyFills(at(asyncCue, 'drops'), end(hurts), { high: 2, seed: 5 }), []],
        ['dashboard', 648, slow, [{ at: at(predict, 'hangs'), state: 'down', sub: 'Not responding' }]]]
        .forEach(([key, x, fills, states], i) => {
          program(b, key, { x, y: 244, w: 296, at: begin(asyncCue) + 0.4 + i * 0.15, states });
          arch.wire(b, { from: [x + 148, 222], to: [x + 148, 240], head: false, tone: 'cyan', at: begin(asyncCue) + 0.6 });
          arch.queue(b, { x, y: 362, slots: 10, size: 20, fills, at: at(asyncCue, 'queue') });
          arch.stream(b, { path: [[794, 112], [794, 200], [x + 148, 200], [x + 148, 236]], at: at(asyncCue, 'drops'), until: end(hurts), every: 0.9, duration: 1.1 });
        });
      arch.tag(b, { x: 24, y: 400, text: 'Each queue holds 10 frames', at: at(asyncCue, 'queue'), until: begin(predict) + 0.3 });
      arch.tag(b, { x: 648, y: 400, text: 'Full: oldest frames dropped', tone: 'red', at: at(hurts, 'dropped') });
      arch.tag(b, { x: 652, y: 120, text: 'publish() returns at once', mono: false, at: at(asyncCue, 'returns'), until: begin(predict) + 0.3 });
      ps.walkway(b, {
        x: 24, y: 416, w: 420, at: at(predict, 'mochi'),
        stops: [{ at: -1, x: 30 }, { at: at(hurts, 'mochi'), x: 30 }, { at: at(hurts, 'dashboard'), x: 300, glide: true }],
      });
      wall.slot(b, { x: 476, y: 440, w: 300, h: 72, text: 'Freeze again?', at: at(predict, 'predict'), until: begin(hurts) + 0.2 });
      sticker(b, 'Slow subscriber hurts only itself', { x: 470, y: 466, at: at(hurts, 'slow'), variant: 'green', iconName: 'shield' });
    }

    // ----------------------------------------------------------------
    // Consequences: what the rules buy
    // ----------------------------------------------------------------

    function buys() {
      const ext = 'buys/extensibility';
      const a = picture(ext);
      arch.quality(a, { x: 24, y: 18, w: 330, name: 'Extensibility', at: at(ext, 'extensibility') });
      arch.rule(a, { x: 400, y: 18, w: 536, n: 1, name: 'Publisher ignorance', at: at(ext, 'ignorance') });
      arch.wire(a, { from: [358, 50], to: [394, 50], at: at(ext, 'ignorance') + 0.2, head: false });
      program(a, 'camera', { x: 330, y: 112, w: 254, at: begin(ext) + 0.2 });
      program(a, 'sensor', { x: 640, y: 112, w: 296, at: begin(ext) + 0.3 });
      arch.topic(a, { x: 24, y: 234, w: 560, name: '/camera/image', at: begin(ext) + 0.3 });
      arch.topic(a, { x: 640, y: 234, w: 296, name: '/battery', at: begin(ext) + 0.4 });
      arch.wire(a, { from: [457, 180], to: [457, 230], at: begin(ext) + 0.4 });
      arch.wire(a, { from: [900, 180], to: [900, 230], at: begin(ext) + 0.5 });
      [['counter', 24, 270, 'counter'], ['recorder', 310, 274, 'recorder'], ['battery', 640, 296, 'battery']].forEach(([key, x, w, word]) => {
        program(a, key, { x, y: 312, w, at: at(ext, word), how: 'drop', states: [{ at: at(ext, word), state: 'new', sub: 'Just subscribes' }] });
        arch.wire(a, { from: [x + w / 2, 278], to: [x + w / 2, 308], tone: 'cyan', at: at(ext, word) + 0.2 });
      });
      sticker(a, 'Publishers: 0 lines changed', { x: 300, y: 450, at: at(ext, 'nothing'), variant: 'green', iconName: 'check' });

      const late = 'buys/late_binding';
      const b = picture(late);
      arch.quality(b, { x: 24, y: 18, w: 330, name: 'Run-time flexibility', at: at(late, 'flexibility') });
      arch.readout(b, {
        x: 400, y: 18, w: 230, label: 'Afternoon', iconName: 'timer', at: begin(late) + 0.2,
        values: [{ at: -1, text: '1:00 p.m.' }, { at: at(late, 'opens'), text: '1:30 p.m.' }, { at: at(late, 'closes'), text: '2:15 p.m.' }, { at: at(late, 'research'), text: '3:00 p.m.' }, { at: at(late, 'experiments'), text: '4:40 p.m.' }],
      });
      arch.readout(b, { x: 676, y: 18, w: 260, label: 'Mochi', iconName: 'box', at: begin(late) + 0.3, values: [{ at: -1, text: 'Running', state: 'ok' }] });
      program(b, 'camera', { x: 24, y: 112, w: 270, at: begin(late) + 0.3 });
      arch.topic(b, { x: 24, y: 246, w: 912, name: '/camera/image', tab: 'right', at: begin(late) + 0.4 });
      arch.wire(b, { from: [159, 180], to: [159, 242], at: begin(late) + 0.5 });
      // The dashboard joins and leaves with the operator; the recorder joins for the experiment.
      [['dashboard', 330, at(late, 'opens'), at(late, 'closes')], ['recorder', 640, at(late, 'joins')]].forEach(([key, x, on, off]) => {
        program(b, key, {
          x, y: 340, w: 296, at: begin(late) + 0.5,
          states: [{ at: -1, state: 'idle', sub: 'Not subscribed' }, { at: on, state: 'busy', sub: 'Subscribed' }, ...(off ? [{ at: off, state: 'idle', sub: 'Unsubscribed' }] : [])],
        });
        arch.wire(b, { from: [x + 148, 294], to: [x + 148, 336], tone: 'cyan', at: on, until: off });
      });

      const swap = 'buys/swap';
      const c = picture(swap);
      wall.listCard(c, {
        x: 24, y: 24, w: 912, title: 'Each benefit comes from a rule', iconName: 'list', at: begin(swap) + 0.1,
        items: [
          { text: 'Add subscribers freely: from Rule 1, publisher ignorance', at: at(swap, 'third') },
          { text: 'Swap publishers freely: from Rule 2, subscriber ignorance', at: at(swap, 'swapped') },
          { text: 'A slow subscriber can’t stall others: from Rule 4, asynchronous', at: at(swap, 'waits') },
        ],
      });
      program(c, 'laser', { x: 24, y: 300, w: 300, sub: 'Swapped in, same events', at: at(swap, 'laser'), states: [{ at: at(swap, 'laser'), state: 'new', sub: 'Swapped in, same events' }] });
      program(c, 'dashboard', { x: 352, y: 300, w: 320, at: at(swap, 'crashed'), states: [{ at: at(swap, 'crashed'), state: 'crashed', sub: 'Crashed: no one stalls' }] });
      wall.banner(c, { x: 700, y: 300, w: 236, title: 'Rule of the style', text: 'The benefits come from the rules', at: at(swap, 'traces') });
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
        x: 24, y: 14, w: 600, title: 'detector.py · tidy names', at: begin(rename) + 0.1,
        lines: [
          { code: 'pub = node.advertise("/obstacle_list")', kind: 'removed' },
          { code: 'pub = node.advertise("/obstacles")', kind: 'added', at: at(rename, 'obstacles') },
        ],
      });
      arch.readout(a, { x: 660, y: 14, w: 276, label: 'Code review', iconName: 'check', at: at(rename, 'approved'), values: [{ at: -1, text: 'Approved', state: 'ok' }] });
      arch.readout(a, { x: 660, y: 86, w: 128, label: 'Build', at: at(rename, 'compiles'), values: [{ at: -1, text: 'Compiles', state: 'ok' }] });
      arch.readout(a, { x: 800, y: 86, w: 136, label: 'Launch', at: at(rename, 'starts'), values: [{ at: -1, text: 'Starts', state: 'ok' }] });
      program(a, 'detector', {
        x: 24, y: 182, w: 280, at: at(rename, 'detector'),
        states: [{ at: at(predict, 'spots'), state: 'busy', sub: 'Found: skateboard' }],
      });
      arch.topic(a, { x: 24, y: 310, w: 420, name: '/obstacles', tab: 'right', states: [{ at: at(rename, 'obstacles'), state: 'lit' }], at: at(rename, 'obstacles') });
      arch.wire(a, { from: [164, 252], to: [164, 306], at: at(rename, 'publishes') });
      arch.topic(a, { x: 496, y: 310, w: 440, name: '/obstacle_list', tab: 'right', states: [{ at: at(rename, 'still'), state: 'empty' }], at: at(rename, 'list') });
      program(a, 'planner', {
        x: 560, y: 170, w: 300, at: at(rename, 'planner'),
        states: [{ at: at(rename, 'still'), state: 'idle', sub: 'Subscribes: /obstacle_list' }, { at: at(silent, 'nothing'), state: 'idle', sub: 'Hears nothing: go straight' }],
      });
      arch.wire(a, { from: [600, 306], to: [600, 258], tone: 'cyan', at: at(rename, 'still') + 0.2 });
      arch.token(a, { kind: 'event', path: [[164, 236], [164, 332], [380, 332]], at: at(predict, 'spots') + 0.3, duration: 1.2 });
      ps.walkway(a, {
        x: 24, y: 416, w: 560, at: at(predict, 'delivery'),
        stops: [{ at: -1, x: 30 }, { at: at(silent, 'safety') - 1.6, x: 30 }, { at: at(silent, 'safety'), x: 300, glide: true }],
        props: [{ kind: 'skater', x: 400, at: at(predict, 'skateboarder') }],
      });
      wall.slot(a, { x: 616, y: 430, w: 150, h: 64, text: 'Planner?', at: at(predict, 'planner'), until: begin(silent) + 0.2 });
      wall.slot(a, { x: 786, y: 430, w: 150, h: 64, text: 'Errors?', at: at(predict, 'error'), until: begin(silent) + 0.2 });
      sticker(a, 'Nobody’s listening', { x: 120, y: 364, at: at(silent, 'nobody'), variant: 'red', iconName: 'warning' });
      arch.readout(a, { x: 616, y: 430, w: 150, label: 'Error log', at: at(silent, 'error'), values: [{ at: -1, text: '0 errors', state: 'warn' }] });
      arch.readout(a, { x: 786, y: 430, w: 150, label: 'Bumper', at: at(silent, 'safety'), values: [{ at: -1, text: 'Stop!', state: 'bad' }] });

      const robust = 'nobody_listens/robustness';
      const b = picture(robust);
      wall.listCard(b, {
        x: 24, y: 20, w: 560, title: 'What still couples them', iconName: 'link', at: at(robust, 'couples'),
        items: [{ text: 'Topic name: /obstacles', at: at(robust, 'name') }, { text: 'Event format: Obstacle(x, y, kind)', at: at(robust, 'format') }, { text: 'Event meaning: x and y in meters', at: at(robust, 'meaning') }],
      });
      arch.quality(b, { x: 626, y: 20, w: 310, name: 'Robustness', effect: 'inhibited', at: at(robust, 'publishing') });
      wall.frame(b, { x: 24, y: 240, w: 440, h: 270, label: 'Direct call', at: at(robust, 'direct') });
      program(b, 'camera', { x: 44, y: 266, w: 220, title: 'Sender', at: at(robust, 'direct') + 0.1 });
      arch.readout(b, { x: 44, y: 370, w: 400, label: 'Receiver missing', iconName: 'warning', at: at(robust, 'loudly'), values: [{ at: -1, text: 'Call failed: error', state: 'bad' }] });
      wall.frame(b, { x: 496, y: 240, w: 440, h: 270, label: 'Publish', at: at(robust, 'publishing') });
      program(b, 'camera', { x: 516, y: 266, w: 220, title: 'Publisher', at: at(robust, 'publishing') + 0.1 });
      arch.readout(b, { x: 516, y: 370, w: 400, label: 'No subscriber', iconName: 'question', at: at(robust, 'whether'), values: [{ at: -1, text: 'Delivered to 0, no error', state: 'warn' }] });
    }

    function whoTalks() {
      const scattered = 'who_talks/scattered';
      const a = picture(scattered);
      arch.search(a, {
        x: 24, y: 20, w: 470, query: '/camera/image', summary: '5 programs subscribe', at: at(scattered, 'search'), rowsAt: at(scattered, 'search') + 0.4,
        files: [{ file: 'detector.py' }, { file: 'logger.py' }, { file: 'dashboard.py' }, { file: 'counter.py' }, { file: 'recorder.py' }],
      });
      ps.bus(a, { x: 530, y: 80, w: 406, names: ['Camera', 'Detector', 'Planner', 'Logger', 'Counter', 'Motor'], at: at(scattered, 'diagram') });
      sticker(a, 'Who talks to whom?', { x: 560, y: 300, at: at(scattered, 'anyone'), variant: 'gold', iconName: 'question' });
      arch.quality(a, { x: 24, y: 420, w: 380, name: 'Understandability', effect: 'inhibited', at: at(scattered, 'understandability') });

      const order = 'who_talks/order';
      const b = picture(order);
      [['Run 1', 24, ['Logger', 'Planner', 'Dashboard'], 'order'], ['Run 2', 340, ['Planner', 'Dashboard', 'Logger'], 'fixed']].forEach(([title, x, names, word]) => {
        wall.listCard(b, { x, y: 20, w: 296, title, iconName: 'list', at: at(order, word), items: names.map((text, i) => ({ text: `${i + 1}. ${text}`, at: at(order, word) + 0.2 + i * 0.15 })) });
      });
      arch.readout(b, { x: 656, y: 20, w: 280, label: 'Monday', iconName: 'check', at: at(order, 'passes'), values: [{ at: -1, text: 'Test passed', state: 'ok' }] });
      arch.readout(b, { x: 656, y: 100, w: 280, label: 'Tuesday', iconName: 'warning', at: at(order, 'tomorrow'), values: [{ at: -1, text: 'Test failed', state: 'bad' }] });
      wall.listCard(b, {
        x: 24, y: 290, w: 912, title: 'Event trace', iconName: 'timer', at: at(order, 'trace'),
        items: [{ text: '12:51:04.100  frame 812 published', at: at(order, 'trace') + 0.2 }, { text: '12:51:04.130  Planner received frame 812', at: at(order, 'trace') + 0.4 }, { text: '12:51:04.180  Logger received frame 812', at: at(order, 'see') }],
      }).classList.add('ps-trace');

      const visible = 'who_talks/visible';
      const c = picture(visible);
      wall.listCard(c, {
        x: 24, y: 20, w: 912, title: 'Topic list: who publishes, who subscribes', iconName: 'list', at: at(visible, 'list'),
        items: [
          { text: '/camera/image: Camera driver → Detector, Logger, Dashboard, Counter', at: at(visible, 'publishes') },
          { text: '/obstacles: Detector → Planner', at: at(visible, 'subscribes') },
          { text: '/cmd_vel: Planner → Motor controller', at: at(visible, 'topic2') },
        ],
      });
      wall.checklist(c, {
        x: 24, y: 290, w: 520, title: 'Make the flow visible', at: at(visible, 'design'),
        items: [
          { text: 'Design names and formats early', at: at(visible, 'design'), checkAt: at(visible, 'early') },
          { text: 'Keep the topic list current', at: at(visible, 'keep'), checkAt: at(visible, 'topic2') },
          { text: 'Test programs together', at: at(visible, 'test'), checkAt: at(visible, 'together') },
        ],
      });
      arch.readout(c, { x: 600, y: 300, w: 336, label: 'Detector + Planner', iconName: 'check', at: at(visible, 'together'), values: [{ at: -1, text: 'Integration test passed', state: 'ok' }] });

      const latency = 'who_talks/latency';
      const d = picture(latency);
      program(d, 'camera', { x: 24, y: 40, w: 250, at: begin(latency) + 0.1 });
      program(d, 'detector', { x: 686, y: 40, w: 250, at: begin(latency) + 0.2 });
      arch.wire(d, { from: [282, 72], to: [678, 72], tone: 'line', at: at(latency, 'direct') });
      arch.tag(d, { x: 400, y: 24, text: 'Direct call', at: at(latency, 'direct') });
      program(d, 'broker', {
        x: 355, y: 200, w: 250, at: at(latency, 'detour'),
        states: [{ at: at(latency, 'down'), state: 'down', sub: 'Down' }],
      });
      arch.wire(d, { from: [149, 108], to: [350, 230], at: at(latency, 'detour') + 0.2 });
      arch.wire(d, { from: [610, 230], to: [811, 108], at: at(latency, 'detour') + 0.4 });
      arch.tag(d, { x: 640, y: 196, text: '+ latency', tone: 'red', at: at(latency, 'latency') });
      arch.quality(d, { x: 24, y: 400, w: 300, name: 'Latency', effect: 'inhibited', at: at(latency, 'latency') + 0.3 });
      sticker(d, 'Single point of failure', { x: 380, y: 330, at: at(latency, 'single'), variant: 'red', iconName: 'warning' });
      arch.tag(d, { x: 600, y: 410, text: 'Broker down: every topic stops', tone: 'red', at: at(latency, 'conversation') });
    }

    function when() {
      const brake = 'when/brake';
      const a = picture(brake);
      program(a, 'safety', { x: 24, y: 40, w: 300, sub: 'Brake now!', at: at(brake, 'safety') });
      arch.topic(a, { x: 380, y: 90, w: 300, name: '/brake', at: at(brake, 'published') });
      arch.wire(a, { from: [330, 100], to: [376, 110], dashed: true, at: at(brake, 'published') + 0.2 });
      arch.tag(a, { x: 712, y: 92, text: 'Did anyone hear it?', at: at(brake, 'heard') });
      arch.cross(a, { x: 530, y: 112, size: 56, at: at(brake, 'rolling') });
      program(a, 'motor', { x: 24, y: 300, w: 300, at: at(brake, 'direct'), states: [{ at: at(brake, 'loudly'), state: 'same', sub: 'Reply: stopped' }] });
      arch.code(a, { x: 380, y: 300, w: 556, at: at(brake, 'call'), lines: [{ code: 'motor.stop()  # waits for a reply' }] });
      arch.wire(a, { from: [174, 168], to: [174, 296], tone: 'green', at: at(brake, 'call') });
      sticker(a, 'Needs a guarantee: call directly', { x: 380, y: 400, at: at(brake, 'fails'), variant: 'green', iconName: 'check' });

      const thumb = 'when/rule_of_thumb';
      const b = picture(thumb);
      wall.listCard(b, {
        x: 24, y: 30, w: 440, title: 'Publish: facts', iconName: 'merge', at: at(thumb, 'publish'),
        items: [{ text: 'New camera frame', at: at(thumb, 'frame') }, { text: 'Battery level', at: at(thumb, 'battery') }, { text: 'Arrived at a building', at: at(thumb, 'arriving') }],
      });
      wall.listCard(b, {
        x: 496, y: 30, w: 440, title: 'Call: requests', iconName: 'phone', at: at(thumb, 'call'),
        items: [{ text: 'Stop the motors', at: at(thumb, 'stop') }, { text: 'Charge the card', at: at(thumb, 'charge') }],
      });
      wall.banner(b, { x: 160, y: 360, w: 640, title: 'Rule of thumb', text: 'Facts many may want: publish. Requests that need an answer: call.', at: at(thumb, 'both') });

      const frameworks = 'when/frameworks';
      const c = picture(frameworks);
      [['Robot middleware', 'DDS, used in ROS 2', 'gear', 'robot'], ['Tiny-device messaging', 'MQTT', 'wifi', 'tiny'], ['Event streaming', 'Apache Kafka', 'stack', 'streaming']].forEach(([title, text, iconName, word], i) => {
        wall.listCard(c, { x: 24 + i * 308, y: 30, w: 296, title, text, iconName, at: at(frameworks, word) });
      });
      arch.quality(c, { x: 24, y: 270, w: 440, name: 'Extensibility, run-time flexibility', at: at(frameworks, 'extensibility') });
      arch.quality(c, { x: 496, y: 270, w: 440, name: 'Robustness, understandability', effect: 'inhibited', at: at(frameworks, 'costs') });
      sticker(c, 'Pick a framework, pick its trade-off', { x: 220, y: 420, at: at(frameworks, 'choosing'), variant: 'gold', iconName: 'transfer' });
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
      wall.frame(a, { x: 566, y: 34, w: 370, h: 470, label: 'After: a topic', at: at(problem, 'publish') });
      arch.card(a, { x: 586, y: 60, w: 330, title: 'Camera driver', iconName: 'camera', at: at(problem, 'publish') + 0.1 });
      arch.topic(a, { x: 586, y: 200, w: 330, name: '/camera/image', tab: 'right', at: at(problem, 'topic') });
      arch.wire(a, { from: [610, 128], to: [610, 196], at: at(problem, 'publishers') });
      ['Detector', 'Logger', 'Dashboard', 'Counter'].forEach((title, i) => {
        arch.card(a, { x: 586 + (i % 2) * 170, y: 290 + Math.floor(i / 2) * 84, w: 160, title, at: at(problem, 'delivers') + i * 0.12 });
        arch.wire(a, { from: [666 + (i % 2) * 170, 248], to: [666 + (i % 2) * 170, 286], head: false, tone: 'cyan', at: at(problem, 'delivers') + i * 0.12 });
      });

      const rules = 'summary/recap_rules';
      const b = picture(rules);
      [[1, 'Publisher ignorance', 'publishers'], [2, 'Subscriber ignorance', 'subscribers'], [3, 'One-way propagation', 'information'], [4, 'Asynchronous', 'publishing']].forEach(([n, name, word], i) => {
        arch.rule(b, { x: 24 + (i % 2) * 468, y: 24 + Math.floor(i / 2) * 96, w: 444, n, name, at: at(rules, word) });
      });
      arch.quality(b, { x: 120, y: 300, w: 320, name: 'Extensibility', at: at(rules, 'add') });
      arch.quality(b, { x: 520, y: 300, w: 320, name: 'Run-time flexibility', at: at(rules, 'runs') });
      sticker(b, 'Add, swap, and plug in while it runs', { x: 230, y: 420, at: at(rules, 'together'), variant: 'green', iconName: 'sparkle' });

      const costs = 'summary/recap_costs';
      const c = picture(costs);
      wall.balance(c, {
        x: 480, y: 120, beam: 560, at: begin(costs) + 0.1,
        pans: [
          { w: 260, title: 'Promoted', iconName: 'arrowUp', items: [{ text: 'Extensibility' }, { text: 'Run-time flexibility' }], at: begin(costs) + 0.2 },
          { w: 260, title: 'Inhibited', iconName: 'arrowDown', items: [{ text: 'Robustness', at: at(costs, 'delivery') }, { text: 'Understandability', at: at(costs, 'spread') }, { text: 'Latency', at: at(costs, 'files') }], at: begin(costs) + 0.3 },
        ],
        tilts: [],
      });
      wall.banner(c, { x: 24, y: 458, w: 380, title: 'Choose per message', text: 'Facts: publish. Requests needing an answer: call.', at: at(costs, 'publish') });
      sticker(c, 'Who’s listening, and do you need to know?', { x: 380, y: 20, at: at(costs, 'listening'), variant: 'gold', iconName: 'question' });
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
    summary();
  };
})();
