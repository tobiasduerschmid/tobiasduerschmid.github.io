/*
 * Choreography for the Test-Driven Development video narration (script:
 * _data/narrations/tdd.yml; code in four languages: _data/explainers/
 * tdd_code.yml; objects: tdd-kit.js; illustrations: tdd-art.js; both on
 * the architecture kit and the wall kit, on the test-bench backdrop). The
 * narration reaches this stage as a song: each scene is a section and each
 * cue a line, and `at(cue, word)` is the estimated time the narrator says
 * that word (repeated words are word2, word3, ...). Cues are named by their
 * stable script ids ('intro/dinner'), so reordering the script never
 * misplaces a picture.
 *
 * The teaching rule for the pictures: show the mechanism the cue names, on
 * one feature, splitting a dinner bill in a group-chat app. Each rule has
 * one metaphor, drawn as a framed picture and reused wherever the rule acts:
 * a target painted around the arrow (test first), a smoke alarm and its
 * test button (watch it fail), checkpoints in a game (smallest step), and
 * two hats (refactor on green). Through the example the workbench keeps its
 * places: the editor column (test card above code card) on the left, the
 * test list and one illustrated note in the side column, and the runner's
 * terminal along the bottom. Every code card and runner line is drawn in all
 * four languages; the stage shows the viewer's (data-code-language), so the
 * speech and every word outside the code stay language-neutral. A state is
 * never color alone: red carries a cross and the word Red, green a check and
 * the word Green. Layout: the 960x540 picture body; nothing readable within
 * 12px of an edge.
 */
(function () {
  'use strict';

  const TOPICS = {
    story: { kind: 'Story', name: 'Split the bill', iconName: 'chat' },
    tdd: { kind: 'TDD', name: 'Test first', iconName: 'loop' },
    cycle: { kind: 'TDD', name: 'Red, green, refactor', iconName: 'loop' },
    runner: { kind: 'Runner', name: 'Red and green', iconName: 'terminal' },
    list: { kind: 'Test list', name: 'One case per line', iconName: 'list' },
    red: { kind: 'Red', name: 'Write a failing test', iconName: 'cross' },
    green: { kind: 'Green', name: 'Make it pass', iconName: 'check' },
    refactor: { kind: 'Refactor', name: 'Clean up on green', iconName: 'broom' },
    done: { kind: 'TDD', name: 'Three cycles done', iconName: 'loop' },
    rule1: { kind: 'Rule', name: 'Test first', iconName: 'target' },
    rule2: { kind: 'Rule', name: 'Watch it fail', iconName: 'alarm' },
    rule3: { kind: 'Rule', name: 'Smallest step', iconName: 'flag' },
    laws: { kind: 'Rule', name: 'The three laws', iconName: 'flag' },
    rule4: { kind: 'Rule', name: 'Refactor on green', iconName: 'hardhat' },
    gets: { kind: 'Consequence', name: 'What you get', iconName: 'balance' },
    costs: { kind: 'Consequence', name: 'What it costs', iconName: 'balance' },
    limits: { kind: 'Consequence', name: 'Limits', iconName: 'balance' },
    evidence: { kind: 'Evidence', name: 'What studies show', iconName: 'search' },
    recapCycle: { kind: 'TDD', name: 'The cycle', iconName: 'loop' },
    recapRules: { kind: 'Rule', name: 'Four rules', iconName: 'book' },
    recapConsequences: { kind: 'Consequence', name: 'Gains and costs', iconName: 'balance' },
  };

  /** The four rules, as their plaques name them. */
  const RULES = {
    1: { name: 'Test first', text: 'Write the test for a behavior before any code for it.' },
    2: { name: 'Watch it fail', text: 'See each new test fail, for the reason you expect.' },
    3: { name: 'Smallest step', text: 'Only enough code to pass the failing test.' },
    4: { name: 'Refactor on green', text: 'Change structure only while every test passes.' },
  };

  /** The test list's lines, top to bottom. */
  const LIST = ['One person pays it all', 'Even split', 'Leftover cents', 'Zero people'];

  /** The stage's line id for each cue ('scene/cue' to 'scene-n'), from the storyboard. */
  function lineIds() {
    const story = JSON.parse(document.getElementById('narration-storyboard').textContent);
    const ids = {};
    story.scenes.forEach((scene) => scene.cues.forEach((cue, i) => { ids[`${scene.id}/${cue.id}`] = `${scene.id}-${i + 1}`; }));
    return ids;
  }

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.tdd = function choreograph({ song, kit, layers }) {
    const { fx, tween, EASE } = window.Timeline;
    const wall = window.WallKit;
    const tk = window.TddKit;
    const SIDE = tk.WORKBENCH.side;
    const { content } = layers;
    const ids = lineIds();
    const line = (cue) => {
      if (!ids[cue]) throw new Error(`Unknown cue ${cue}`);
      return ids[cue];
    };
    const begin = (cue) => song.line(line(cue)).start;
    const end = (cue) => song.line(line(cue)).end;
    const at = (cue, word) => song.mark(line(cue), word);

    /**
     * One picture from the start of cue `from` to the end of cue `to`. Its
     * heading strip names `tags` = [[topic, cue], ...] in turn, each from
     * the start of its cue: the strip turns Red, then Green, with the cycle.
     */
    function picture(from, to, tags) {
      // The first picture is in place before playback, so the opening frame shows the story.
      const opening = (time) => (time === 0 ? -0.6 : time);
      const node = kit.scene(content, opening(begin(from)), end(to), { exit: 'fade' });
      tags.forEach(([topic, cue], i) => {
        const tag = wall.topicTag(node, { ...TOPICS[topic], at: opening(begin(cue)) + 0.15 });
        if (tags[i + 1]) fx.fadeOut(tag, begin(tags[i + 1][1]) - 0.1, 0.2);
      });
      return wall.body(node);
    }
    const sticker = (parent, text, options) => kit.sticker(parent, text, { rotate: -3, ...options });
    const stamp = (parent, text, options) => kit.stamp(parent, text, { shake: false, from: 1.6, ...options });
    /** Rule n's plaque at the top of the side column. */
    const plaque = (parent, n, options) => tk.rulePlaque(parent, { x: SIDE.x, y: 12, w: SIDE.w, n, name: RULES[n].name, text: RULES[n].text, ...options });
    /** Rule n as one slim banner across the top, so its metaphor can fill the picture below (from y 80). */
    const banner = (parent, n, options) => tk.rulePlaque(parent, { x: 12, y: 12, w: 936, n, name: RULES[n].name, text: RULES[n].text, banner: true, ...options });
    /**
     * Refactoring above the safety net of tests: the student on the tightrope
     * rearranging code, labeled Refactoring; the circus net under the rope,
     * labeled Safety net of tests; and the lesson's three passing tests hung
     * along the net's front edge, turning red at `redAt` when the net catches
     * a slip. Laid out on the art's 520 x 260 picture, scaled to `w`.
     */
    function safetyNet(parent, { x, y, w, at, until, poses = [], labelsAt = at, testsAt = labelsAt, redAt, greenAgainAt, tests = true, walkerLabel = 'Refactoring' }) {
      const art = tk.art(parent, 'safetyNet', { x, y, w, options: { walker: true }, at, until, poses, className: 'td-art--backdrop' });
      const s = w / 520;
      tk.chips(parent, { x: x + 262 * s - 84, y: y + 118 * s, until, items: [{ text: walkerLabel, tone: 'blue', iconName: 'broom', at: labelsAt }] });
      tk.chips(parent, { x: x + 260 * s - 128, y: y + 174 * s, until, items: [{ text: 'Safety net of tests', tone: 'green', iconName: 'shield', at: labelsAt + 0.3 }] });
      if (tests) {
        const names = ['One person', 'Even split', 'Extra cent'];
        const row = { x: x + 260 * s - 222, y: y + 226 * s, tight: true };
        tk.chips(parent, { ...row, until: redAt ?? until, items: names.map((text, i) => ({ text, tone: 'green', iconName: 'check', at: testsAt + i * 0.12 })) });
        if (redAt !== undefined) tk.chips(parent, { ...row, until: greenAgainAt ?? until, items: names.map((text, i) => ({ text, tone: 'red', iconName: 'cross', at: redAt + i * 0.08 })) });
        if (greenAgainAt !== undefined) tk.chips(parent, { ...row, until, items: names.map((text, i) => ({ text, tone: 'green', iconName: 'check', at: greenAgainAt + i * 0.08 })) });
      }
      return art;
    }
    /** The test list in the side column with lines `done` checked and line `now` marked. */
    const list = (parent, { done = 0, now, states = [], at: when, how = 'fade', lines = LIST.map((text) => ({ text })), ...options }) => tk.testList(parent, {
      lines,
      states: [
        ...Array.from({ length: done }, (_, i) => ({ at: -1, line: i, state: 'done' })),
        ...(now !== undefined ? [{ at: -1, line: now, state: 'now' }] : []),
        ...states,
      ],
      at: when,
      how,
      ...options,
    });
    /** The language-neutral line split(8000, 3) returns, for the result rows. */
    const returns = (shares) => `split(8000, 3) → [${shares.join(', ')}]`;
    /** Parts named `${prefix}1` to `${prefix}n`, revealed one by one from `from`, `step` seconds apart. */
    const oneByOne = (prefix, n, from, step) => Array.from({ length: n }, (_, i) => ({ part: `${prefix}${i + 1}`, at: from + i * step }));

    // ----------------------------------------------------------------
    // Motivation: Friday's bill, and the cycle
    // ----------------------------------------------------------------

    function intro() {
      const dinner = 'intro/dinner';
      const missing = 'intro/missing';
      const a = picture(dinner, missing, [['story', dinner]]);
      tk.art(a, 'table', { x: 12, y: 40, w: 520, at: -0.6, className: 'td-art--backdrop' });
      tk.receipt(a, { x: 338, y: 192, w: 200, compact: true, rotate: -4, at: -0.6, totalAt: at(dinner, 'eighty'), circleAt: at(missing, 'two') });
      tk.phone(a, {
        x: 586, y: 10, w: 330, at: -0.6, messageAt: at(dinner, 'group'), pulseAt: at(dinner, 'split'),
        billAt: at(missing, 'twenty'), rowsAt: at(missing, 'twenty'), sumAt: at(missing, 'seventy'),
      });
      sticker(a, 'Built last night', { x: 640, y: 446, at: at(dinner, 'last'), variant: 'gold', iconName: 'sparkle' });
      // Two cents roll off the edge of the table.
      const coins = tk.art(a, 'rollingCoins', { x: 430, y: 372, w: 130, at: at(missing, 'gone') });
      tween(coins.node, [{ translate: '-90px -40px' }, { translate: '0 0' }], at(missing, 'gone'), 0.9, EASE.out);
      sticker(a, '2 cents missing', { x: 120, y: 384, at: at(missing, 'gone'), variant: 'red', iconName: 'warning' });

      const after = 'intro/after';
      const target = 'intro/target';
      const b = picture(after, target, [['story', after]]);
      const column = tk.editor(b, { y: 16 });
      tk.card(column, { kind: 'code', card: 'general', label: 'Code: written first', at: at(after, 'tests') });
      tk.flow(column, { text: 'then the test, from the code’s output', at: at(after, 'after') });
      tk.card(column, { kind: 'tests', card: 'test_even', label: 'Test: written after', at: at(after, 'green') });
      tk.chips(column, { items: [{ text: 'Passed', tone: 'green', iconName: 'check', at: at(after, 'green') }] });
      // Once the code has made its point, it makes way for the picture of it.
      tk.leave(column, begin(target));
      // The test after the code: the arrow lands in a plain wall, and the target is painted around it.
      const wallPicture = tk.art(b, 'archery', {
        x: SIDE.x, y: 24, w: SIDE.w, options: { mode: 'painted' }, at: at(after, 'tried'),
        reveal: [{ part: 'ta-archery-brush', at: at(target, 'painting') }, ...oneByOne('ta-archery-ring-', 5, at(target, 'painting'), 0.22)],
      });
      // From 276 px in the side column (center 810, 120.5) to 560 px (center 292, 220).
      tween(wallPicture.node, [{ translate: '0 0', scale: 1 }, { translate: '-518px 99.5px', scale: 560 / 276 }], begin(target), 0.8, EASE.inOut);
      wall.label(b, { x: 12, y: 426, w: 560, text: 'A test written after the code: a target painted around the arrow', at: at(target, 'drawn') });
      wall.note(b, { x: SIDE.x + 12, y: 300, w: 240, text: 'The expected value came from the code.', at: at(after, 'saved') });
      sticker(b, 'Flip the order', { x: SIDE.x + 24, y: 430, at: at(target, 'flip'), variant: 'gold', iconName: 'loop' });
    }

    function cycle() {
      const tdd = 'cycle/tdd';
      const a = picture(tdd, tdd, [['tdd', tdd]]);
      wall.listCard(a, { x: 130, y: 16, w: 700, title: 'Test-driven development (TDD)', text: 'Write a small automated test before the code it tests.', iconName: 'loop', at: begin(tdd) + 0.3 });
      // Friday's order, code then test, swaps at "flips".
      const testToken = tk.token(a, { x: 260, y: 214, w: 190, text: 'Test', tone: 'tests', at: begin(tdd) + 0.4 });
      const codeToken = tk.token(a, { x: 20, y: 214, w: 190, text: 'Code', tone: 'code', at: begin(tdd) + 0.4 });
      fx.moveTo(testToken, at(tdd, 'flips'), -240, 0, 0.6);
      fx.moveTo(codeToken, at(tdd, 'flips'), 240, 0, 0.6);
      wall.arrow(a, { from: [216, 238], to: [254, 238], at: at(tdd, 'flips') + 0.6 });
      wall.label(a, { x: 20, y: 160, w: 430, text: 'First the test, then the code', at: at(tdd, 'flips') + 0.6 });
      wall.label(a, { x: 12, y: 292, w: 210, text: 'Says what the code should do', at: at(tdd, 'says') });
      wall.label(a, { x: 252, y: 292, w: 210, text: 'Has to hit the test', at: at(tdd, 'need') });
      // The target is drawn first, from what you need; the code's arrow has to hit it.
      tk.art(a, 'archery', {
        x: 484, y: 140, w: 460, options: { mode: 'first' }, at: at(tdd, 'draw'),
        poses: [{ at: at(tdd, 'code3'), pose: 'is-flying' }, { at: at(tdd, 'hit'), pose: 'is-hit' }],
      });

      const loop = 'cycle/loop';
      const runner = 'cycle/runner';
      const b = picture(loop, runner, [['cycle', loop], ['runner', runner]]);
      tk.cycle(b, {
        x: 480, y: 262, r: 150, at: begin(loop) + 0.2, until: at(runner, 'runner'),
        stations: {
          red: { at: at(loop, 'red'), text: 'Write one small test, watch it fail' },
          green: { at: at(loop, 'green'), text: 'Just enough code to pass' },
          refactor: { at: at(loop, 'refactor'), text: 'Clean up, tests still pass' },
        },
        next: { text: 'next test', at: at(loop, 'then') },
        center: { text: 'One turn: minutes', at: at(loop, 'minutes') },
      });
      tk.art(b, 'stopwatch', { x: 452, y: 170, w: 56, at: at(loop, 'minutes'), until: at(runner, 'runner'), how: 'pop' });
      tk.cycleStrip(b, { x: 190, y: 14, at: at(runner, 'runner') });
      tk.runnerCards(b, { x: 12, y: 96, at: [at(runner, 'pytest'), at(runner, 'junit'), at(runner, 'googletest'), at(runner, 'jest')] });
      wall.label(b, { x: 300, y: 360, w: 360, text: 'Same cycle in every language', at: at(runner, 'same') });
    }

    // ----------------------------------------------------------------
    // Example: the test list, then three red-green-refactor cycles
    // ----------------------------------------------------------------

    function testList() {
      const spec = 'list/spec';
      const a = picture(spec, spec, [['list', spec]]);
      // split as a machine: cents and people go in, a list of shares comes out.
      tk.art(a, 'splitMachine', { x: 24, y: 96, w: 560, at: begin(spec) + 0.3, className: 'td-art--backdrop', poses: [{ at: at(spec, 'bill'), pose: 'is-pouring' }] });
      tk.token(a, { x: 238, y: 171, w: 132, text: 'split', tone: 'code', at: at(spec, 'split') });
      tk.chips(a, { x: 24, y: 40, items: [
        { text: 'Bill in cents: 8000', iconName: 'cash', at: at(spec, 'bill') },
        { text: 'People: 3', iconName: 'team', at: at(spec, 'people') },
      ] });
      wall.label(a, { x: 360, y: 372, w: 290, text: 'A list of shares, one per person', at: at(spec, 'returns') });
      tk.phone(a, { x: 650, y: 30, w: 270, small: true, at: begin(spec) + 0.5, centsAt: at(spec, 'cents2') });
      tk.spot(a, { x: 24, y: 430, w: 440, art: 'coin', artW: 48, text: 'Whole cents: every amount is exact.', at: at(spec, 'exact') });

      const cards = 'list/cards';
      const one = 'list/one';
      const b = picture(cards, one, [['list', cards]]);
      const card = tk.testList(b, {
        lines: [
          { text: LIST[0], at: at(cards, 'one') },
          { text: LIST[1], at: at(cards, 'even') },
          { text: LIST[2], at: at(cards, 'leftover') },
          { text: LIST[3], at: at(cards, 'zero') },
        ],
        at: at(cards, 'list'),
        states: [{ at: at(one, 'easiest'), line: 0, state: 'now' }],
      });
      // The card is written large in the middle of the desk, and settles in the side column as the next cue begins.
      tween(card.node, [{ translate: '-390px 110px', scale: 1.3 }, { translate: '-390px 110px', scale: 1.3 }], begin(cards), 0.01);
      tween(card.node, [{ translate: '-390px 110px', scale: 1.3 }, { translate: '0px 0px', scale: 1 }], begin(one), 0.7);
      wall.note(b, { x: 40, y: 400, w: 220, text: 'Plain words, no code yet', at: at(cards, 'plain'), until: begin(one) + 0.2 });

      // All tests first: a wall of red lamps, and drafts that get thrown away.
      tk.art(b, 'statusBoard', { x: 24, y: 40, w: 280, at: at(one, 'pile'), poses: [{ at: at(one, 'wall'), pose: 'is-red' }] });
      stamp(b, 'Not all tests first', { x: 330, y: 56, at: at(one, 'wall'), rotate: -4, small: true });
      tk.art(b, 'crumpled', { x: 340, y: 150, w: 64, at: at(one, 'rewrite'), how: 'pop' });
      tk.art(b, 'crumpled', { x: 420, y: 170, w: 56, at: at(one, 'rewrite') + 0.2, how: 'pop' });
      wall.label(b, { x: 24, y: 250, w: 560, text: 'A wall of red, and rewrites when the design shifts', muted: true, at: at(one, 'rewrite') });
      tk.token(b, { x: 300, y: 360, w: 300, text: 'test one person', tone: 'tests', at: at(one, 'one') });
      wall.arrow(b, { from: [660, 120], to: [612, 372], at: at(one, 'one') });
      wall.label(b, { x: 300, y: 420, w: 300, text: 'One test at a time', at: at(one, 'one') + 0.3 });
      tk.chips(b, { x: SIDE.x + 8, y: 220, items: [{ text: 'Start here', tone: 'blue', iconName: 'arrowUp', at: at(one, 'easiest') }] });
    }

    function starter() {
      const first = 'starter/first_test';
      const red = 'starter/red';
      const fake = 'starter/fake';
      const why = 'starter/why_fake';
      const a = picture(first, why, [['red', first], ['green', fake]]);
      list(a, { at: begin(first) + 0.2, states: [
        { at: at(first, 'starter'), line: 0, state: 'now' },
        { at: at(why, 'cross'), line: 0, state: 'done' },
        { at: at(why, 'cross') + 0.4, line: 1, state: 'now' },
      ] });
      const column = tk.editor(a);
      tk.card(column, { kind: 'tests', card: 'test_one_person', at: at(first, 'starter'), typeAt: at(first, 'starter') });
      tk.chips(column, { items: [
        { text: 'Name: split', at: at(first, 'name') },
        { text: 'Inputs: 3000, 1', at: at(first, 'inputs') },
        { text: 'Result: [3000]', at: at(first, 'result') },
      ] });
      tk.placeholder(column, { text: 'No code yet', h: 110, at: at(first, 'starter') + 0.6, until: at(fake, 'return'), question: 'Least code to pass?', questionAt: at(red, 'predict') });
      tk.card(column, { kind: 'code', card: 'fake_it', at: at(fake, 'return'), typeAt: at(fake, 'return'), marks: [{ find: '3000', state: 'lit', at: at(fake, 'fake') }] });
      tk.terminal(a, [
        { at: begin(first) + 0.3, tone: 'idle', status: 'no tests run yet' },
        { at: at(red, 'red'), tone: 'red', step: 's1_red', detail: true },
        { at: at(fake, 'green'), tone: 'green', step: 's1_green' },
      ]);
      const note = { x: SIDE.x, w: SIDE.w };
      tk.spot(a, { ...note, y: 222, art: 'trafficLight', artW: 30, poses: [{ at: -1, pose: 'is-red' }], text: 'Not building counts as red.', at: at(red, 'build'), until: at(fake, 'return') });
      tk.spot(a, { ...note, y: 222, art: 'facade', artW: 92, text: 'Fake It: a constant', sub: 'A front with nothing behind it', at: at(fake, 'fake'), until: at(why, 'wired') });
      tk.spot(a, { ...note, y: 222, art: 'plug', artW: 92, text: 'Green proves the wiring', sub: 'Test, runner, function', at: at(why, 'wired') });
      wall.note(a, { x: SIDE.x + 12, y: 356, w: 240, text: 'Nothing untested is promised.', at: at(why, 'promises') });
    }

    function triangulate() {
      const second = 'triangulate/second_test';
      const red2 = 'triangulate/red2';
      const general = 'triangulate/generalize';
      const a = picture(second, general, [['red', second], ['green', general]]);
      list(a, { done: 1, now: 1, at: begin(second) + 0.2, states: [
        { at: at(general, 'specific'), line: 1, state: 'done' },
        { at: at(general, 'specific') + 0.4, line: 2, state: 'now' },
      ] });
      const column = tk.editor(a);
      tk.card(column, { kind: 'tests', card: 'test_even', at: at(second, 'even'), typeAt: at(second, 'even') });
      tk.card(column, {
        kind: 'code', card: 'general', base: 'fake_it', at: begin(second) + 0.2,
        marks: [{ find: '3000', state: 'lit', at: at(second, 'constant'), until: at(general, 'constant') }],
        strikeAt: at(general, 'constant'), swapAt: at(general, 'divide'),
      });
      tk.terminal(a, [
        { at: begin(second) + 0.2, tone: 'green', step: 's1_green' },
        { at: at(second, 'predict'), tone: 'idle', status: '?', tests: [{ test: 'one', state: 'wait' }, { test: 'even', state: 'wait' }] },
        { at: at(red2, 'failed'), tone: 'red', step: 's2_red', detail: true, tests: [{ test: 'one', state: 'pass' }, { test: 'even', state: 'fail' }] },
        { at: at(general, 'green'), tone: 'green', step: 's2_green', tests: [{ test: 'one', state: 'pass' }, { test: 'even', state: 'pass' }] },
      ]);
      const note = { x: SIDE.x, w: SIDE.w, y: 222 };
      tk.spot(a, { ...note, art: 'magnifier', artW: 64, text: 'The gap to close', sub: 'Expected against got', at: at(red2, 'difference'), until: at(general, 'triangulate') });
      tk.spot(a, { ...note, art: 'triangulate', artW: 96, text: 'Triangulate', sub: 'Two examples pin down one general rule', at: at(general, 'triangulate') });
    }

    function leftover() {
      const bill = 'leftover/bill';
      const predict = 'leftover/predict';
      const red3 = 'leftover/red3';
      const obvious = 'leftover/obvious';
      const a = picture(bill, obvious, [['red', bill], ['green', obvious]]);
      list(a, { done: 2, now: 2, at: begin(bill) + 0.2, states: [{ at: at(obvious, 'green') + 0.2, line: 2, state: 'done' }] });
      // The side column holds the bill, then the decision, then what split returns.
      tk.receipt(a, { x: SIDE.x + 16, y: 230, w: 240, compact: true, rotate: -2, at: at(bill, 'fridays'), until: at(bill, 'who') });
      tk.spot(a, { x: SIDE.x, y: 222, w: SIDE.w, art: 'coinStack', artW: 40, options: { n: 6 }, tone: 'gold', text: 'Who pays the extra cents?', at: at(bill, 'who'), until: at(predict, 'predict') - 0.3 });
      wall.note(a, { x: SIDE.x + 12, y: 330, w: 240, text: 'Decision: the first people pay 1 cent more.', at: at(bill, 'decide'), until: at(predict, 'predict') - 0.3 });
      const column = tk.editor(a);
      tk.card(column, {
        kind: 'tests', card: 'test_extra_cent', at: at(bill, 'eight'),
        blank: { text: '2667, 2667, 2666', fillAt: at(predict, 'twenty') },
        label: { text: 'Sums to 8000', at: at(predict, 'expects') },
        collapseAt: at(obvious, 'obvious'), summary: '3 tests',
      });
      tk.card(column, {
        kind: 'code', card: 'fill_patch', base: 'general', at: begin(bill) + 0.2,
        strikeAt: at(obvious, 'fill'), swapAt: at(obvious, 'add'),
      });
      tk.result(a, {
        x: SIDE.x, y: 226, w: SIDE.w, stacked: true, label: 'split(8000, 3) returns', at: at(predict, 'predict'),
        states: [
          { at: at(predict, 'predict'), text: '[?, ?, ?]', sum: 'Sum ?' },
          { at: at(red3, 'twenty'), text: '[2666, 2666, 2666]', sum: 'Sum 7998', tone: 'red' },
          { at: at(obvious, 'green'), text: '[2667, 2667, 2666]', sum: 'Sum 8000', tone: 'green' },
        ],
      });
      tk.terminal(a, [
        { at: begin(bill) + 0.2, tone: 'green', step: 's2_green' },
        { at: at(red3, 'failed'), tone: 'red', step: 's3_red', detail: true },
        { at: at(obvious, 'green'), tone: 'green', step: 's3_green' },
      ]);
      sticker(a, 'Friday’s bug, caught', { x: SIDE.x + 14, y: 336, at: at(red3, 'bug'), until: at(obvious, 'obvious'), variant: 'red', iconName: 'bug' });
      tk.spot(a, {
        x: SIDE.x, y: 340, w: SIDE.w, art: 'keyLock', artW: 80, text: 'Obvious Implementation', sub: 'You know what to type',
        poses: [{ at: at(obvious, 'add'), pose: 'is-turned' }], at: at(obvious, 'obvious') + 0.3,
      });
    }

    function refactor() {
      const smell = 'refactor/smell';
      const tidy = 'refactor/tidy';
      const a = picture(smell, tidy, [['refactor', smell]]);
      list(a, { done: 3, at: begin(smell) + 0.2 });
      const column = tk.editor(a);
      tk.card(column, { kind: 'tests', card: 'test_extra_cent', at: begin(smell) + 0.2, collapseAt: begin(smell) + 0.2, summary: '3 tests' });
      tk.card(column, {
        kind: 'code', card: 'refactored', base: 'fill_patch', at: begin(smell) + 0.2,
        marks: [
          { find: { python: 'shares = [', java: 'Arrays.fill', cpp: 'shares(people', typescript: '.fill(' }, state: 'lit', at: at(smell, 'fills'), until: at(tidy, 'share') },
          { find: 'for (', state: 'lit', at: at(smell, 'patches'), until: at(tidy, 'share') },
          { find: { python: 'for i in range(cents' }, state: 'lit', at: at(smell, 'patches'), until: at(tidy, 'share') },
        ],
        strikeAt: at(tidy, 'share'), swapAt: at(tidy, 'build'),
      });
      const smellChips = tk.chips(column, { items: [
        { text: 'Fill every share', at: at(smell, 'fills') },
        { text: 'Then patch some', at: at(smell, 'patches') },
      ] });
      tk.leave(smellChips, begin(tidy));
      tk.chips(column, { items: [
        { text: 'share and extra: named', tone: 'blue', iconName: 'broom', at: at(tidy, 'extra') },
        { text: 'Tests unchanged', tone: 'green', iconName: 'check', at: at(tidy, 'run') },
      ] });
      tk.spot(a, { x: SIDE.x, y: 222, w: SIDE.w, art: 'bandage', artW: 70, tone: 'gold', text: 'Reads like a repair', at: at(smell, 'repair'), until: end(smell) - 0.3 });
      tk.spot(a, { x: SIDE.x, y: 322, w: SIDE.w, art: 'broom', artW: 80, tone: 'blue', text: 'Refactor', sub: 'Change the structure, not the behavior', at: at(smell, 'refactor'), until: at(tidy, 'safety') });
      // The refactoring was a walk above the safety net of tests.
      safetyNet(a, { x: SIDE.x, y: 222, w: SIDE.w, at: at(tidy, 'safety'), tests: false });
      tk.terminal(a, [
        { at: begin(smell) + 0.2, tone: 'green', step: 's3_green' },
        { at: at(tidy, 'run'), tone: 'idle', status: 'running the tests…' },
        { at: at(tidy, 'green'), tone: 'green', step: 's3_green' },
      ]);

      const done = 'refactor/done';
      const b = picture(done, done, [['done', done]]);
      tk.cycle(b, {
        x: 290, y: 230, r: 100, at: begin(done) + 0.2,
        stations: { red: { at: begin(done) + 0.2 }, green: { at: begin(done) + 0.2 }, refactor: { at: begin(done) + 0.2 } },
        checks: { red: at(done, 'red'), green: at(done, 'green'), refactor: at(done, 'refactor') },
      });
      list(b, { x: 600, y: 30, w: 320, done: 3, at: begin(done) + 0.3, states: [{ at: at(done, 'yours'), line: 3, state: 'yours' }] });
      tk.chips(b, { x: 608, y: 250, items: [0, 1, 2].map((i) => ({ text: 'test', tone: 'green', iconName: 'check', at: at(done, 'test') + i * 0.15 })) });
      wall.label(b, { x: 600, y: 300, w: 320, text: '3 tests keep checking', at: at(done, 'test') + 0.5 });
      tk.terminal(b, [{ at: begin(done) + 0.2, tone: 'green', step: 's3_green' }]);
    }

    // ----------------------------------------------------------------
    // Rules: test first, watch it fail, smallest step, refactor on green
    // ----------------------------------------------------------------

    function rulesRed() {
      // Rule one: the two targets, large, side by side.
      const first = 'rules_red/test_first';
      const a = picture(first, first, [['rule1', first]]);
      banner(a, 1, { at: at(first, 'test') });
      // Test after: the rings are painted around wherever the arrow landed.
      tk.art(a, 'archery', {
        x: 12, y: 84, w: 460, options: { mode: 'painted' }, at: at(first, 'last'),
        reveal: [{ part: 'ta-archery-brush', at: at(first, 'painting') }, ...oneByOne('ta-archery-ring-', 5, at(first, 'painting'), 0.2)],
      });
      wall.label(a, { x: 12, y: 414, w: 460, text: 'Test after: target painted around the arrow', at: at(first, 'painting') });
      tk.chips(a, { x: 12, y: 480, items: [{ text: 'Expected: the code’s answer', tone: 'red', iconName: 'copy', at: at(first, 'saved') }] });
      // Test first: the target comes first, from the requirement, and the code has to hit it.
      tk.art(a, 'archery', {
        x: 488, y: 84, w: 460, options: { mode: 'first' }, at: at(first, 'draws'),
        poses: [{ at: at(first, 'code3'), pose: 'is-flying' }, { at: at(first, 'hit'), pose: 'is-hit' }],
      });
      wall.label(a, { x: 488, y: 414, w: 460, text: 'Test first: target from the requirement', at: at(first, 'requirement') });
      tk.chips(a, { x: 488, y: 480, items: [{ text: 'Expected: the requirement', tone: 'green', iconName: 'target', at: at(first, 'requirement') }] });

      // Two more payoffs, and the cost, each with its picture.
      const why = 'rules_red/test_first_why';
      const a2 = picture(why, why, [['rule1', why]]);
      banner(a2, 1, { at: begin(why) + 0.2 });
      tk.spot(a2, { x: 12, y: 96, w: 296, stack: true, art: 'calendar', artW: 150, text: 'A test written first already exists', sub: 'Tests planned for later get dropped', at: at(why, 'later') });
      tk.spot(a2, { x: 332, y: 96, w: 296, stack: true, art: 'plug', artW: 220, text: 'The call is designed first', sub: 'From the caller’s side', at: at(why, 'designs') });
      tk.spot(a2, { x: 652, y: 96, w: 296, stack: true, art: 'crumpled', artW: 130, tone: 'gold', text: 'Cost: know what it should do', sub: 'Unsure? Explore with throwaway code first', at: at(why, 'cost') });

      // Rule two: a teammate's test, green on the old code, and an alarm that cannot sound.
      const watch = 'rules_red/watch';
      const liar = 'rules_red/liar';
      const b = picture(watch, liar, [['rule2', watch]]);
      // The closer look's offer sits over the top right of the picture, so the plaque starts lower.
      tk.rulePlaque(b, { x: SIDE.x, y: 44, w: SIDE.w, n: 2, name: RULES[2].name, at: at(watch, 'watch') });
      const column = tk.editor(b);
      tk.card(column, {
        kind: 'tests', card: 'test_weak', label: 'A teammate’s test', at: at(watch, 'teammate'),
        marks: [{ find: { python: 'len(', java: '.size()', cpp: '.size()', typescript: 'toHaveLength' }, state: 'lit', at: at(liar, 'counts') }],
      });
      tk.card(column, { kind: 'code', card: 'general', at: at(watch, 'rewind'), collapseAt: at(watch, 'rewind'), summary: 'Old code, before the fix' });
      tk.result(column, { at: at(liar, 'loses'), states: [{ at: at(liar, 'loses'), text: returns([2666, 2666, 2666]), sum: 'Sum 7998', tone: 'red' }] });
      // Once the test's flaw is named, the code makes way for the alarm.
      tk.leave(column, at(liar, 'smoke'));
      tk.terminal(b, [
        { at: begin(watch) + 0.2, tone: 'idle', status: 'old code, before the fix' },
        { at: at(watch, 'green'), tone: 'green', step: 's3_green', warn: 'Green, bug still there', warnAt: at(liar, 'anyway') },
      ]);
      wall.slot(b, { x: 300, y: 312, w: 250, h: 64, text: 'Good news?', at: at(watch, 'predict'), until: begin(liar) });
      // The alarm stays quiet with the bug's smoke rising; then it grows to fill the picture: no battery.
      const alarm = tk.art(b, 'alarm', {
        x: SIDE.x, y: 136, w: SIDE.w, at: at(watch, 'green'),
        poses: [
          { at: at(watch, 'green'), pose: 'is-silent' },
          { at: at(liar, 'loses'), pose: 'is-silent has-smoke' },
          { at: at(liar, 'battery'), pose: 'is-dead has-smoke' },
        ],
      });
      // From 276 px in the side column (center 810, 237) to 480 px (center 252, 200).
      tween(alarm.node, [{ translate: '0 0', scale: 1 }, { translate: '-558px -37px', scale: 480 / 276 }], at(liar, 'smoke'), 0.8, EASE.inOut);
      tk.chips(b, { x: 12, y: 384, items: [
        { text: 'Counts 3 shares, ignores the amounts', tone: 'red', iconName: 'warning', at: at(liar, 'smoke') + 0.4 },
        { text: 'Cannot fail', tone: 'red', iconName: 'cross', at: at(liar, 'quiet') },
      ] });
      tk.result(b, {
        x: SIDE.x, y: 136, w: SIDE.w, stacked: true, label: 'split(8000, 3) returns', at: at(liar, 'smoke') + 0.5,
        states: [{ at: at(liar, 'smoke') + 0.5, text: '[2666, 2666, 2666]', sum: 'Sum 7998', tone: 'red' }],
      });
      wall.note(b, { x: SIDE.x + 12, y: 262, w: 240, text: 'Watching it fail tests the test.', at: at(liar, 'watching') });

      // Red before the fix, green after it: the alarm sounds when its test button is pressed.
      const watchWhy = 'rules_red/watch_why';
      const c = picture(watchWhy, watchWhy, [['rule2', watchWhy]]);
      plaque(c, 2, { at: begin(watchWhy) + 0.2 });
      tk.art(c, 'alarm', {
        x: 12, y: 24, w: 316, at: at(watchWhy, 'red'),
        poses: [{ at: at(watchWhy, 'red'), pose: 'is-sounding has-smoke' }, { at: at(watchWhy, 'press'), pose: 'is-sounding has-smoke is-pressed' }],
      });
      tk.chips(c, { x: 12, y: 262, items: [{ text: 'Old code: Red', tone: 'red', iconName: 'cross', at: at(watchWhy, 'red') }] });
      tk.art(c, 'alarm', { x: 342, y: 24, w: 316, at: at(watchWhy, 'green'), poses: [{ at: at(watchWhy, 'green'), pose: 'is-silent' }] });
      tk.chips(c, { x: 342, y: 262, items: [{ text: 'After the fix: Green', tone: 'green', iconName: 'check', at: at(watchWhy, 'green') }] });
      wall.label(c, { x: 12, y: 316, w: 646, text: 'Red, then green: the test detects the behavior you added', at: at(watchWhy, 'detects') });
      tk.spot(c, {
        x: 12, y: 386, w: 646, art: 'magnifier', artW: 60, tone: 'gold', text: 'A brand-new test passes at once? Stop.',
        sub: 'The behavior already exists, or the test checks too little.', at: at(watchWhy, 'brand'),
      });
      wall.note(c, { x: SIDE.x + 12, y: 190, w: 240, text: 'Press the test button: you hear it can go off.', at: at(watchWhy, 'press') });

      const msg = 'rules_red/message';
      const d = picture(msg, msg, [['rule2', msg]]);
      plaque(d, 2, { at: begin(msg) + 0.2 });
      tk.message(d, { x: 12, y: 20, w: 646, step: 's3_red', verdict: { text: 'Right reason', tone: 'good', at: at(msg, 'right') }, at: at(msg, 'expected') });
      tk.message(d, { x: 12, y: 230, w: 646, step: 'typo', verdict: { text: 'Wrong reason', tone: 'bad', at: at(msg, 'typo') }, after: { text: 'Fix the test first.', at: at(msg, 'fix2') }, at: at(msg, 'typo') });
      tk.art(d, 'magnifier', { x: SIDE.x + 78, y: 200, w: 120, at: at(msg, 'read'), how: 'pop' });
    }

    function rulesGreen() {
      const smallest = 'rules_green/smallest';
      const a = picture(smallest, smallest, [['rule3', smallest]]);
      plaque(a, 3, { at: at(smallest, 'smallest') });
      const board = list(a, { y: 170, done: 3, at: begin(smallest) + 0.3 });
      fx.bump(board.node, at(smallest, 'test2'), 0.05);
      const column = tk.editor(a);
      tk.card(column, { kind: 'code', card: 'tip', at: begin(smallest) + 0.2, marks: [{ find: 'tip', anyCase: true, state: 'added' }, { find: 'tip', anyCase: true, state: 'lit', at: at(smallest, 'tip') }] });
      tk.chips(column, { items: [
        { text: 'No test asks for this', tone: 'red', iconName: 'warning', at: at(smallest, 'asks') },
        { text: 'A wrong tip would stay green', tone: 'red', iconName: 'bug', at: at(smallest, 'wrong') },
      ] });
      tk.terminal(a, [{ at: begin(smallest) + 0.2, tone: 'green', step: 's3_green', warn: 'Green, tip math unchecked', warnAt: at(smallest, 'green') }]);

      // Every green is a checkpoint; a surprising red sends you back only to the last one.
      const debugging = 'rules_green/debugging';
      const b = picture(debugging, debugging, [['rule3', debugging]]);
      banner(b, 3, { at: begin(debugging) + 0.2 });
      tk.art(b, 'checkpoints', {
        x: 12, y: 80, w: 936, at: begin(debugging) + 0.2,
        reveal: [
          ...oneByOne('ta-cp-flag-', 6, at(debugging, 'checkpoint') - 0.6, 0.18),
          { part: 'ta-cp-fall', at: at(debugging, 'surprises') },
          { part: 'ta-cp-respawn', at: at(debugging, 'undo') },
        ],
        moves: [
          // Flag 6 is the drawn spot; each earlier flag stands 58 left and 12 lower.
          ...Array.from({ length: 5 }, (_, i) => ({
            part: 'ta-cp-player', at: at(debugging, 'checkpoint') - 0.6 + i * 0.18, duration: 0.18, easing: EASE.out,
            from: [-58 * (5 - i), 12 * (5 - i)], to: [-58 * (4 - i), 12 * (4 - i)],
          })),
          { part: 'ta-cp-player', at: at(debugging, 'surprises'), duration: 0.5, easing: EASE.in, from: [0, 0], to: [70, 44] },
          { part: 'ta-cp-player', at: at(debugging, 'undo'), duration: 0.6, from: [70, 44], to: [0, 0] },
        ],
      });
      tk.chips(b, { x: 30, y: 96, items: [{ text: 'Each green: a checkpoint', tone: 'green', iconName: 'flag', at: at(debugging, 'checkpoint') }] });
      tk.chips(b, { x: 700, y: 96, items: [{ text: 'Undo: back on green', tone: 'blue', iconName: 'rewind', at: at(debugging, 'undo') }] });
      tk.runTimeline(b, {
        x: 24, y: 424, at: at(debugging, 'red'),
        chips: [
          { tone: 'green', text: 'Green', at: at(debugging, 'red') },
          { tone: 'green', text: 'Green', at: at(debugging, 'red') + 0.2 },
          { tone: 'red', text: 'Red', at: at(debugging, 'surprises') },
        ],
        bracket: { text: 'The cause is in here: a few lines', at: at(debugging, 'few') },
      });
      wall.label(b, { x: 560, y: 432, w: 380, text: 'No hunting through an afternoon of changes', muted: true, at: at(debugging, 'hunting') });

      // Step size is a gear you choose; then what small steps cost.
      const size = 'rules_green/step_size';
      const cost = 'rules_green/step_cost';
      const c = picture(size, cost, [['rule3', size]]);
      banner(c, 3, { at: begin(size) + 0.2 });
      tk.art(c, 'gearShifter', {
        x: 12, y: 80, w: 290, at: begin(size) + 0.2,
        poses: [{ at: at(size, 'fake'), pose: 'is-gear-1' }, { at: at(size, 'obvious'), pose: 'is-gear-3' }, { at: at(size, 'down'), pose: 'is-gear-1' }],
      });
      tk.chips(c, { x: 318, y: 100, items: [{ text: '1  Fake It: unsure', at: at(size, 'fake') }] });
      tk.chips(c, { x: 318, y: 160, items: [{ text: '2  Triangulate: a second example', at: at(size, 'fake') + 0.4 }] });
      tk.chips(c, { x: 318, y: 220, items: [{ text: '3  Obvious Implementation: sure', at: at(size, 'obvious') }] });
      tk.chips(c, { x: 318, y: 280, items: [{ text: 'After a surprise: shift down', tone: 'blue', iconName: 'arrowDown', at: at(size, 'surprising') }] });
      tk.spot(c, { x: 12, y: 384, w: 316, art: 'snail', artW: 90, tone: 'gold', text: 'Tiny steps can feel slow', at: at(cost, 'snails') });
      tk.spot(c, { x: 342, y: 384, w: 316, art: 'broom', artW: 90, tone: 'blue', text: 'Design thinking happens when you refactor', at: at(cost, 'refactor') });
      list(c, {
        y: 84, done: 3, at: begin(size) + 0.3,
        lines: [...LIST.map((text) => ({ text })), { text: 'Tip parameter', at: at(cost, 'tip') }],
      });

      // The three laws are training wheels: practice with them, then take them off.
      const strict = 'rules_green/strict';
      const d = picture(strict, strict, [['laws', strict]]);
      wall.listCard(d, {
        x: 12, y: 16, w: 560, title: 'The three laws of TDD, the strictest form', iconName: 'book', at: at(strict, 'strictest'),
        items: [
          { text: '1  No production code unless a test fails', at: at(strict, 'tiny') },
          { text: '2  Only enough of a test to fail; not compiling counts', at: at(strict, 'fail') },
          { text: '3  Only enough code to pass that test', at: at(strict, 'pass') },
        ],
      });
      tk.art(d, 'bike', {
        x: 588, y: 24, w: 360, at: at(strict, 'training'),
        poses: [{ at: at(strict, 'training'), pose: 'is-training' }, { at: at(strict, 'widen'), pose: 'is-free' }],
      });
      wall.label(d, { x: 588, y: 272, w: 360, text: 'Training wheels: practice tiny steps, then widen them', at: at(strict, 'training') });
      tk.stepScale(d, {
        x: 70, y: 372, w: 820, at: at(strict, 'strictest') + 0.3,
        marks: [
          { pos: 0.04, text: 'Three laws', sub: 'a line or two', at: at(strict, 'three') },
          { pos: 0.32, text: 'Fake It', sub: 'unsure', at: at(strict, 'strictest') + 0.3 },
          { pos: 0.58, text: 'Triangulate', sub: 'a second example', at: at(strict, 'strictest') + 0.3 },
          { pos: 0.84, text: 'Obvious Implementation', sub: 'sure', at: at(strict, 'strictest') + 0.3 },
        ],
      });

      // Rule four: refactoring is a walk above the safety net of tests, which catches a slip.
      const onGreen = 'rules_green/on_green';
      const slip = 'rules_green/slip';
      const e = picture(onGreen, slip, [['rule4', onGreen]]);
      banner(e, 4, { at: at(onGreen, 'green') });
      safetyNet(e, {
        x: 12, y: 80, w: 590, at: at(onGreen, 'refactoring'), labelsAt: at(onGreen, 'tightrope'), testsAt: at(onGreen, 'passing'),
        redAt: at(slip, 'red'), greenAgainAt: at(slip, 'back'),
        poses: [{ at: at(slip, 'slip'), pose: 'is-wobble' }, { at: at(slip, 'catches'), pose: 'is-wobble is-caught' }, { at: at(slip, 'back'), pose: '' }],
      });
      tk.token(e, { x: 622, y: 96, w: 326, text: 'Typed <= where < belongs', tone: 'code', at: at(slip, 'less') });
      tk.chips(e, { x: 622, y: 160, items: [{ text: 'All three tests: red', tone: 'red', iconName: 'cross', at: at(slip, 'red') }] });
      tk.chips(e, { x: 622, y: 210, items: [{ text: 'One edit, one cause', tone: 'red', iconName: 'arrowUp', at: at(slip, 'one') }] });
      tk.chips(e, { x: 622, y: 260, items: [{ text: 'Undo it: back on the rope', tone: 'blue', iconName: 'rewind', at: at(slip, 'undo') }] });
      tk.terminal(e, [
        { at: begin(onGreen) + 0.2, tone: 'green', step: 's3_green' },
        { at: at(slip, 'red'), tone: 'red', step: 'slip', detail: true },
        { at: at(slip, 'back'), tone: 'green', step: 's3_green' },
      ]);

      // One hat at a time: the hard hat adds behavior, the cap restructures.
      const hats = 'rules_green/two_hats';
      const f = picture(hats, hats, [['rule4', hats]]);
      banner(f, 4, { at: begin(hats) + 0.2 });
      tk.art(f, 'hats', {
        x: 12, y: 80, w: 520, at: at(hats, 'wear'),
        poses: [{ at: at(hats, 'hard'), pose: 'is-build' }, { at: at(hats, 'cleaning'), pose: 'is-tidy' }],
      });
      tk.chips(f, { x: 12, y: 398, items: [
        { text: 'Add behavior', tone: 'green', iconName: 'hardhat', at: at(hats, 'add') },
        { text: 'Restructure', tone: 'blue', iconName: 'broom', at: at(hats, 'restructure') },
        { text: 'Never both at once', tone: 'red', iconName: 'cross', at: at(hats, 'both') },
      ] });
      tk.chips(f, { x: 552, y: 90, items: [
        { text: 'Green', tone: 'green', iconName: 'check', at: begin(hats) + 0.3 },
        { text: 'Cleanup', tone: 'blue', iconName: 'broom', at: at(hats, 'cleanup') },
      ] });
      tk.chips(f, { x: 552, y: 136, items: [{ text: 'Green: behavior kept', tone: 'green', iconName: 'check', at: at(hats, 'survived') }] });
      tk.spot(f, { x: 552, y: 196, w: 396, art: 'dice', artW: 110, tone: 'red', text: 'On red, cleanup is a gamble', sub: 'Which one broke it: structure or behavior?', at: at(hats, 'gamble') });

      // Skipped cleanup piles up into a shaky tower; the safety net of tests makes cleanup safe.
      const cleanup = 'rules_green/cleanup';
      const g = picture(cleanup, cleanup, [['rule4', cleanup]]);
      banner(g, 4, { at: begin(cleanup) + 0.2 });
      tk.art(g, 'tower', {
        x: 12, y: 80, w: 236, at: begin(cleanup) + 0.2,
        reveal: oneByOne('ta-tower-block-', 6, at(cleanup, 'quick'), 0.3),
        poses: [{ at: at(cleanup, 'shaky'), pose: 'is-teeter' }],
      });
      wall.label(g, { x: 12, y: 396, w: 236, text: 'Skipped cleanup: patches pile up', at: at(cleanup, 'tower') });
      safetyNet(g, { x: 268, y: 80, w: 680, at: at(cleanup, 'safety'), labelsAt: at(cleanup, 'net') });
      wall.label(g, { x: 268, y: 432, w: 680, text: 'A safety net of tests makes cleanup safe enough to do', at: at(cleanup, 'safe') });

      // The limit: tests are a flashlight, and a bug can sit in the dark.
      const limit = 'rules_green/limit';
      const h = picture(limit, limit, [['rule4', limit]]);
      banner(h, 4, { at: begin(limit) + 0.2 });
      tk.art(h, 'flashlight', { x: 12, y: 80, w: 600, at: at(limit, 'flashlight'), reveal: [{ part: 'ta-flashlight-bug', at: at(limit, 'bug') }] });
      wall.label(h, { x: 632, y: 96, w: 316, text: 'Limit: green proves only what the tests check', at: at(limit, 'proves') });
      tk.chips(h, { x: 632, y: 220, items: [{ text: 'Lit: the code the tests cover', tone: 'green', iconName: 'check', at: at(limit, 'light') }] });
      tk.chips(h, { x: 632, y: 270, items: [{ text: 'A bug in the dark stays hidden', tone: 'red', iconName: 'bug', at: at(limit, 'dark') }] });
      tk.chips(h, { x: 632, y: 320, items: [{ text: 'Only as safe as its tests', tone: 'blue', iconName: 'shield', at: at(limit, 'safe') }] });
    }

    // ----------------------------------------------------------------
    // Consequences: what TDD gives, what it costs, what the evidence says
    // ----------------------------------------------------------------

    function benefits() {
      const more = 'benefits/more_tests';
      const net = 'benefits/safety_net';
      const docs = 'benefits/docs';
      const small = 'benefits/small_units';
      const a = picture(more, small, [['gets', more]]);
      tk.pan(a, {
        x: 12, y: 12, w: 360, title: 'What you get', effect: 'promoted', at: at(more, 'consequences'),
        items: [
          { name: 'More tests', why: 'Every behavior arrives with its test', at: at(more, 'more') },
          { name: 'Regression safety net', why: 'Old tests rerun after every change', at: at(net, 'regression') },
          { name: 'Executable documentation', why: 'Shows how to call the code', at: at(docs, 'executable') },
          { name: 'Small, testable units', why: 'Callable on its own', at: at(small, 'small') },
        ],
      });
      // More tests: two piles of test cards on one shelf.
      tk.testStack(a, { x: 440, y: 96, count: 5, label: 'Test first', at: at(more, 'every'), until: begin(net) });
      tk.testStack(a, { x: 690, y: 96, count: 2, room: 5, label: 'Test after', at: at(more, 'every'), until: begin(net) });
      tk.chips(a, { x: 520, y: 450, until: begin(net), items: [{ text: 'Most consistent finding', iconName: 'search', at: at(more, 'consistent') }] });
      // The regression safety net: refactoring next month's change is a walk on a
      // tightrope above the safety net of tests, which tells within seconds.
      safetyNet(a, {
        x: 388, y: 24, w: 560, at: at(net, 'net'), until: begin(docs), labelsAt: at(net, 'net') + 0.2, testsAt: at(net, 'passing'),
        poses: [{ at: at(net, 'change2'), pose: 'is-wobble' }, { at: at(net, 'later') + 0.4, pose: '' }],
      });
      tk.chips(a, { x: 388, y: 318, until: begin(docs), items: [
        { text: 'Next month’s change', tone: 'blue', iconName: 'code', at: at(net, 'change') },
        { text: '3 passed, seconds later', tone: 'green', iconName: 'check', at: at(net, 'seconds') },
      ] });
      wall.label(a, { x: 388, y: 362, w: 560, text: 'That net makes refactoring safe', at: at(net, 'refactoring'), until: begin(docs) });
      // Documentation that runs, and documentation that goes stale.
      tk.art(a, 'manual', { x: 396, y: 30, w: 270, at: at(docs, 'executable'), until: begin(small) });
      wall.label(a, { x: 396, y: 246, w: 270, text: 'Runs, and fails when it stops being true', at: at(docs, 'fails'), until: begin(small) });
      tk.art(a, 'staleNote', { x: 700, y: 40, w: 230, at: at(docs, 'stale'), until: begin(small) });
      wall.label(a, { x: 690, y: 246, w: 250, text: 'Stale tests document the past', at: at(docs, 'stale'), until: begin(small) });
      // Small units you can lift out, against one tangle.
      tk.art(a, 'bricks', { x: 396, y: 30, w: 280, at: at(small, 'bricks') });
      wall.label(a, { x: 396, y: 240, w: 280, text: 'Small units, each callable on its own', at: at(small, 'bricks') });
      tk.art(a, 'tangle', { x: 706, y: 40, w: 230, at: at(small, 'tangle') });
      wall.label(a, { x: 696, y: 240, w: 250, text: 'Not one big tangle', at: at(small, 'tangle') });
      wall.listCard(a, { x: 396, y: 312, w: 540, title: 'Better overall design?', text: 'Debated', iconName: 'question', at: at(small, 'debated') });
    }

    function costs() {
      const time = 'costs/time';
      const discipline = 'costs/discipline';
      const a = picture(time, discipline, [['costs', time]]);
      wall.listCard(a, {
        x: 12, y: 12, w: 440, title: 'What you get', iconName: 'arrowUp', at: begin(time) + 0.2,
        items: [{ text: 'More tests' }, { text: 'Regression safety net' }, { text: 'Executable documentation' }, { text: 'Small, testable units' }],
      });
      tk.pan(a, {
        x: 12, y: 238, w: 440, title: 'What it costs', effect: 'inhibited', at: at(time, 'time'),
        items: [
          { name: 'Time up front', why: '15 to 35% more time, managers’ estimate', at: at(time, 'time') },
          { name: 'A learning curve', why: 'Hard to follow at first', at: at(discipline, 'learning') },
          { name: 'Tests to maintain', why: 'Tests are code', at: at(discipline, 'maintain') },
        ],
      });
      tk.bars(a, {
        x: 484, y: 30, w: 450, title: 'Four industrial case studies', at: at(time, 'four'), until: begin(discipline),
        bars: [
          { label: 'Pre-release defect density', range: [0.4, 0.9], text: '40 to 90% lower', tone: 'green', iconName: 'bug', at: at(time, 'forty') },
          { label: 'Development time', range: [0.15, 0.35], text: '15 to 35% higher', tone: 'red', iconName: 'timer', at: at(time, 'fifteen') },
        ],
        tag: '4 teams, not a general law', tagAt: at(time, 'forty'),
      });
      tk.art(a, 'hourglass', { x: 656, y: 300, w: 104, at: at(time, 'time'), until: begin(discipline), poses: [{ at: at(time, 'fifteen'), pose: 'is-run' }] });
      wall.label(a, { x: 598, y: 464, w: 220, text: 'Time up front', at: at(time, 'time'), until: begin(discipline) });
      // A learning curve, then tests to maintain.
      tk.art(a, 'mountain', { x: 488, y: 16, w: 310, at: at(discipline, 'learning') });
      wall.label(a, { x: 810, y: 70, w: 130, text: 'A learning curve', at: at(discipline, 'learning') });
      tk.token(a, { x: 490, y: 230, w: 440, text: 'Checks what split returns', tone: 'tests', mark: { tone: 'good', at: at(discipline, 'tests2') }, at: at(discipline, 'tests2') });
      wall.label(a, { x: 490, y: 286, w: 440, text: 'Survives refactoring', muted: true, at: at(discipline, 'tests2') + 0.3 });
      tk.token(a, { x: 490, y: 350, w: 440, text: 'Checks how split works inside', tone: 'tests', mark: { tone: 'bad', at: at(discipline, 'breaks') }, at: at(discipline, 'inside') });
      wall.label(a, { x: 490, y: 406, w: 440, text: 'Breaks on refactoring', muted: true, at: at(discipline, 'breaks') });

      const limits = 'costs/limits';
      const b = picture(limits, limits, [['limits', limits]]);
      wall.listCard(b, {
        x: 40, y: 16, w: 880, title: 'TDD needs a check that is…', iconName: 'check', at: at(limits, 'limits'), columns: 2,
        items: [
          { text: 'Automated', iconName: 'check', at: at(limits, 'automated') },
          { text: 'Fast', iconName: 'check', at: at(limits, 'fast') },
          { text: 'Same verdict every run', iconName: 'check', at: at(limits, 'same') },
        ],
      });
      wall.label(b, { x: 40, y: 184, w: 300, text: 'A poor fit:', at: at(limits, 'images') });
      tk.art(b, 'photo', { x: 60, y: 222, w: 200, at: at(limits, 'images') });
      wall.label(b, { x: 30, y: 446, w: 260, text: 'No exact right answer: recognizing images', at: at(limits, 'images') });
      tk.art(b, 'gauge', { x: 316, y: 248, w: 240, at: at(limits, 'response') });
      wall.label(b, { x: 296, y: 446, w: 280, text: 'Qualities: response time, security', at: at(limits, 'response') });
      tk.art(b, 'moonshot', { x: 608, y: 222, w: 330, at: at(limits, 'towers') });
      wall.label(b, { x: 608, y: 446, w: 330, text: 'Big designs: not one small test at a time', at: at(limits, 'designs') });
    }

    function evidence() {
      const versus = 'evidence/versus_after';
      const a = picture(versus, versus, [['evidence', versus]]);
      wall.listCard(a, { x: 40, y: 16, w: 880, title: 'What do experiments compare?', iconName: 'search', at: begin(versus) + 0.3 });
      // Two weighings: TDD against testing right after each piece (even), and against testing late (TDD ahead).
      // Each scale weighs TDD (left pan) against another way of testing (right pan); a pan's label rests on its rim.
      const panLabel = (x, y, text, when) => tk.chips(a, { x, y, items: [{ text, at: when }] });
      wall.label(a, { x: 24, y: 112, w: 440, text: 'TDD against a test right after each small piece', at: at(versus, 'scale') });
      tk.art(a, 'scale', { x: 24, y: 176, w: 440, at: at(versus, 'scale'), poses: [{ at: at(versus, 'scale'), pose: 'is-level' }] });
      panLabel(84, 276, 'TDD', at(versus, 'scale') + 0.3);
      panLabel(300, 276, 'Test right after', at(versus, 'scale') + 0.3);
      tk.chips(a, { x: 24, y: 380, items: [{ text: 'Mostly level: no clear difference', tone: 'blue', iconName: 'balance', at: at(versus, 'level') }] });
      wall.label(a, { x: 496, y: 112, w: 440, text: 'TDD against testing late, or barely at all', at: at(versus, 'tips') });
      tk.art(a, 'scale', { x: 496, y: 176, w: 440, at: at(versus, 'tips'), poses: [{ at: at(versus, 'tips'), pose: 'is-level' }, { at: at(versus, 'toward'), pose: 'is-left' }] });
      panLabel(557, 291, 'TDD', at(versus, 'toward') + 0.3);
      panLabel(778, 261, 'Testing late', at(versus, 'toward') + 0.3);
      tk.chips(a, { x: 496, y: 380, items: [{ text: 'Tips toward TDD', tone: 'green', iconName: 'arrowUp', at: at(versus, 'late') }] });
      sticker(a, 'Depends on the comparison', { x: 300, y: 450, at: end(versus) - 1.6, variant: 'gold', iconName: 'search' });

      const steady = 'evidence/steady';
      const b = picture(steady, steady, [['evidence', steady]]);
      // A metronome keeps the beat while the two rhythms appear.
      const swing = Array.from({ length: 12 }, (_, i) => ({ part: 'ta-metronome-arm', at: at(steady, 'beat') + i * 0.55, duration: 0.55, rotate: i % 2 ? [18, -18] : [-18, 18] }));
      tk.art(b, 'metronome', { x: 20, y: 24, w: 150, at: at(steady, 'beat'), moves: swing });
      tk.rhythm(b, { x: 170, y: 20, w: 760, title: 'Short, steady cycles', turns: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], at: at(steady, 'rhythm'), note: 'Went with quality and productivity', noteAt: at(steady, 'quality') });
      tk.rhythm(b, { x: 170, y: 170, w: 760, title: 'Long, uneven cycles', turns: [4, 1.5, 6, 2.5], at: at(steady, 'cycles') });
      wall.listCard(b, { x: 40, y: 300, w: 520, title: 'Test first or test after?', text: 'No important difference in this study', iconName: 'question', at: at(steady, 'whether') });
      wall.note(b, { x: 620, y: 310, w: 300, text: 'Test first: the test gets written, and has failed once.', at: at(steady, 'guarantees') });

      const practice = 'evidence/practice';
      const c = picture(practice, practice, [['evidence', practice]]);
      wall.listCard(c, { x: 20, y: 16, w: 420, title: 'Strict TDD is rare', text: 'Of 2,443 developers observed in their editors, 1.7% followed it strictly.', iconName: 'search', at: at(practice, 'rare') - 0.3 });
      tk.figures(c, { x: 20, y: 222, lit: [27, 64], litAt: at(practice, 'rare') + 0.4, at: at(practice, 'rare') });
      wall.label(c, { x: 20, y: 382, w: 420, text: 'About 2 in 100', at: at(practice, 'rare') + 0.4 });
      wall.checklist(c, {
        x: 480, y: 16, w: 440, title: 'Keep what the evidence supports', at: at(practice, 'keep'),
        items: [
          { text: 'A test for every behavior', at: at(practice, 'test'), checkAt: at(practice, 'test') + 0.2 },
          { text: 'Small steps', at: at(practice, 'small'), checkAt: at(practice, 'small') + 0.2 },
          { text: 'Run the tests constantly', at: at(practice, 'constant'), checkAt: at(practice, 'constant') + 0.2 },
          { text: 'Clean up on green', at: at(practice, 'cleanup'), checkAt: at(practice, 'cleanup') + 0.2 },
        ],
      });
    }

    // ----------------------------------------------------------------
    // Summary
    // ----------------------------------------------------------------

    function summary() {
      const cycleCue = 'summary/recap_cycle';
      const a = picture(cycleCue, cycleCue, [['recapCycle', cycleCue]]);
      tk.phone(a, { x: 24, y: 30, w: 230, small: true, at: at(cycleCue, 'bug') - 0.2 });
      sticker(a, '2 cents missing', { x: 28, y: 222, at: at(cycleCue, 'bug'), variant: 'red', iconName: 'warning' });
      tk.art(a, 'archery', { x: 24, y: 296, w: 220, options: { mode: 'painted' }, at: at(cycleCue, 'confirmed') });
      wall.label(a, { x: 24, y: 452, w: 220, text: 'Test after', at: at(cycleCue, 'confirmed') });
      tk.cycle(a, {
        x: 500, y: 250, r: 104, at: at(cycleCue, 'cycle'),
        stations: { red: { at: at(cycleCue, 'red') }, green: { at: at(cycleCue, 'green') }, refactor: { at: at(cycleCue, 'refactor') } },
      });
      list(a, { y: 60, done: 3, at: at(cycleCue, 'list') });
      tk.chips(a, { x: 760, y: 300, items: [{ text: 'One at a time', tone: 'blue', iconName: 'arrowDown', at: at(cycleCue, 'one') }] });

      const rules = 'summary/recap_rules';
      const b = picture(rules, rules, [['recapRules', rules]]);
      const recaps = [
        { word: 'test', n: 1, art: 'archery', options: { mode: 'first' }, pose: 'is-hit', reason: 'The target comes from the requirement', mark: 'requirement' },
        { word: 'watch', n: 2, art: 'alarm', pose: 'is-sounding is-pressed', reason: 'Proof the test can catch the bug', mark: 'bug' },
        { word: 'smallest', n: 3, art: 'checkpoints', reason: 'A checkpoint after every step', mark: 'cause' },
        { word: 'refactor', n: 4, art: 'safetyNet', options: { walker: true }, reason: 'Cleanup checked by the safety net of tests', mark: 'tests' },
      ];
      recaps.forEach(({ word, n, art, options, pose, reason, mark }, i) => {
        const x = 12 + i * 236;
        tk.rulePlaque(b, { x, y: 20, w: 222, n, name: RULES[n].name, at: at(rules, word) });
        const picture4 = tk.art(b, art, { x, y: 110, w: 222, options, at: at(rules, word) + 0.2, poses: pose ? [{ at: -1, pose }] : [] });
        picture4.node.classList.add('td-art--recap');
        tk.token(b, { x, y: 300, w: 222, text: reason, tone: 'code', mark: { tone: 'good', at: at(rules, mark) }, at: at(rules, word) + 0.3 });
      });
      wall.label(b, { x: 12, y: 440, w: 930, text: 'Each rule, and the reason it exists', at: at(rules, 'reason') });

      const cons = 'summary/recap_consequences';
      const c = picture(cons, cons, [['recapConsequences', cons]]);
      // The gains and the costs stand beside the two pans of one balance.
      tk.art(c, 'scale', { x: 268, y: 110, w: 424, at: begin(cons) + 0.2, poses: [{ at: -1, pose: 'is-level' }] });
      tk.pan(c, {
        x: 12, y: 40, w: 250, title: 'What you get', effect: 'promoted', at: at(cons, 'gives'),
        items: [{ name: 'More tests' }, { name: 'Regression safety net' }, { name: 'Executable documentation' }, { name: 'Small, testable units' }].map((item) => ({ ...item, at: at(cons, 'gives') })),
      });
      tk.pan(c, {
        x: 698, y: 40, w: 250, title: 'What it costs', effect: 'inhibited', at: at(cons, 'costs'),
        items: [{ name: 'Time up front' }, { name: 'A learning curve' }, { name: 'Tests to maintain' }].map((item) => ({ ...item, at: at(cons, 'costs') })),
      });
      tk.chips(c, { x: 268, y: 330, items: [
        { text: 'Needs fast, exact checks', tone: 'blue', at: at(cons, 'needs') },
        { text: 'Benefits follow short, steady cycles', tone: 'green', at: at(cons, 'follow') },
      ] });
      tk.chips(c, { x: 268, y: 380, items: [{ text: 'Your turn: Zero people', tone: 'blue', iconName: 'list', at: at(cons, 'turn') }] });
    }

    intro();
    cycle();
    testList();
    starter();
    triangulate();
    leftover();
    refactor();
    rulesRed();
    rulesGreen();
    benefits();
    costs();
    evidence();
    summary();
  };
})();
