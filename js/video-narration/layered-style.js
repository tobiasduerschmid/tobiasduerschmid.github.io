/*
 * Choreography for the Layers video narration (script:
 * _data/narrations/layered_style.yml; artwork: layered-style-kit.js on the
 * architecture kit and the wall kit). The narration reaches this stage as a
 * song: each scene is a section and each cue a line, and `at(cue, word)` is
 * the estimated time the narrator says that word (repeated words are word2,
 * word3, ...). Cues are named by their stable script ids ('intro/jam'),
 * looked up in the storyboard, so reordering the script never misplaces a
 * picture.
 *
 * The teaching rule for the pictures: show the mechanism the cue names, on
 * Pearl Dash, the team's rooftop game. A layered design is a building in
 * section: each layer a floor, the game rules on top and the device's
 * drivers at the ground; allowed-to-use arrows point down; a rule of the
 * style is a numbered rule card; and every consequence is a quality card
 * that says Promoted or Inhibited in words. Stamps never shake the stage,
 * and nothing large changes brightness quickly (WCAG 2.3.1). Layout: the
 * 960x540 picture body; nothing readable within 12px of an edge.
 */
(function () {
  'use strict';

  const TOPICS = {
    intro: { kind: 'Example', name: 'Pearl Dash, the game', iconName: 'gamepad' },
    tangle: { kind: 'Problem', name: 'Every level in one function', iconName: 'warning' },
    stack: { kind: 'Style', name: 'A stack of layers', iconName: 'stack' },
    allowed: { kind: 'Rule', name: 'Who may use whom', iconName: 'arrowDown' },
    callbacks: { kind: 'Rule', name: 'News travels up', iconName: 'arrowUp' },
    relaxed: { kind: 'Rule', name: 'Strict, relaxed, not tiers', iconName: 'list' },
    port: { kind: 'Promotes', name: 'Portability, modifiability, reuse', iconName: 'sparkle' },
    costs: { kind: 'Inhibits', name: 'Performance and up-front cost', iconName: 'timer' },
    leaks: { kind: 'Trade-off', name: 'When layers leak', iconName: 'warning' },
    summary: { kind: 'Recap', name: 'Down, never up', iconName: 'check' },
  };

  /** Pearl Dash's four layers, from the top down. */
  const PEARL_DASH = [
    { name: 'Game rules', items: ['Squirrel', 'Pearls', 'Score', 'Levels'] },
    { name: 'Engine', items: ['Physics', 'Collisions', 'Scene drawing'] },
    { name: 'Platform', items: ['Graphics', 'Sound', 'Input'] },
    { name: 'Drivers', items: ['Laptop GPU', 'Keyboard', 'Sound card'] },
  ];

  /** The stage's line id for each cue ('scene/cue' to 'scene-n'), from the storyboard. */
  function lineIds() {
    const story = JSON.parse(document.getElementById('narration-storyboard').textContent);
    const ids = {};
    story.scenes.forEach((scene) => scene.cues.forEach((cue, i) => { ids[`${scene.id}/${cue.id}`] = `${scene.id}-${i + 1}`; }));
    return ids;
  }

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.layered_style = function choreograph({ song, kit, layers }) {
    const wall = window.WallKit;
    const arch = window.ArchKit;
    const ls = window.LayersKit;
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

    /** Pearl Dash's building at the standard place on the right: floors 70, 154, 238, 322. */
    function pearlDash(parent, { x = 480, y = 70, w = 456, at: when, floors = PEARL_DASH, step = 0.15 } = {}) {
      return ls.building(parent, { x, y, w, at: when, step, floors });
    }
    /** An allowed-to-use arrow outside the building's wall, from floor `from` to floor `to` (`lane` 0 or 1). */
    function useArrow(parent, house, from, to, { lane = 0, side = 'left', ...options }) {
      const offset = 24 + lane * 22;
      const x = side === 'left' ? house.x - offset : house.x + house.w + offset;
      const down = to > from;
      return arch.wire(parent, { from: [x, house.mid(from) + (down ? 4 : -4)], to: [x, house.mid(to) + (down ? -4 : 4)], ...options });
    }

    // ----------------------------------------------------------------
    // Motivation: the game jam win, and the tangle
    // ----------------------------------------------------------------

    function intro() {
      const jam = 'intro/jam';
      const a = picture(jam);
      sticker(a, '3:00 a.m. · game jam', { x: 30, y: 14, at: at(jam, 'three'), variant: 'gold', iconName: 'timer' });
      ls.gameScreen(a, {
        x: 24, y: 76, w: 520, device: 'laptop', at: at(jam, 'pearl'),
        score: [{ at: -1, text: 'Score 980' }, { at: at(jam, 'grabs'), text: 'Score 1,240' }],
      });
      wall.listCard(a, { x: 600, y: 90, w: 336, title: 'Pearl Dash', text: 'Sprint across rooftops, double-jump gaps, grab boba pearls.', iconName: 'gamepad', at: at(jam, 'fun') });
      wall.listCard(a, { x: 600, y: 300, w: 336, title: 'Best Game', text: 'Campus game jam', iconName: 'sparkle', at: at(jam, 'wins') });
      sticker(a, 'Submitted: 4 minutes to spare', { x: 300, y: 470, at: at(jam, 'submit'), variant: 'white', iconName: 'check' });

      const consoleCue = 'intro/console';
      const b = picture(consoleCue);
      wall.listCard(b, { x: 24, y: 24, w: 470, title: 'Email: a game publisher', text: 'Pearl Dash on our handheld console? By spring.', iconName: 'envelope', at: at(consoleCue, 'email') });
      ls.gameScreen(b, { x: 540, y: 40, w: 396, device: 'console', at: at(consoleCue, 'handheld') });
      [['Different graphics chip', 'graphics'], ['Buttons, not a keyboard', 'buttons'], ['Different sound system', 'sound']].forEach(([text, word], i) => {
        arch.tag(b, { x: 540, y: 300 + i * 46, text, tone: 'gold', at: at(consoleCue, word) });
      });
      wall.listCard(b, { x: 24, y: 300, w: 470, title: 'Next question', text: 'A second game on the same tech, by summer?', iconName: 'question', at: at(consoleCue, 'question') });

      const team = 'intro/team';
      const c = picture(team);
      const roles = [['Artist', 'pencil', 'artist'], ['Gameplay', 'gamepad', 'gameplay'], ['Sound', 'chip', 'someone'], ['You', 'user', 'you2']];
      roles.forEach(([role, iconName, word], i) => wall.badge(c, { x: 60 + i * 228, y: 60, w: 150, role, iconName, variant: i === 3 ? 'po' : 'dev', at: at(team, word) }));
      arch.card(c, { x: 330, y: 330, w: 300, title: 'game.py', sub: 'Everything, one file', iconName: 'file', mono: true, at: at(team, 'same'), states: [{ at: at(team, 'breaks'), state: 'changed', sub: 'Everything, one file' }] });
      roles.forEach(([, , word], i) => arch.wire(c, { from: [135 + i * 228, 214], to: [400 + i * 54, 326], at: at(team, word) + 0.2 }));
      sticker(c, 'Broke the jump', { x: 40, y: 400, at: at(team, 'breaks'), variant: 'red', iconName: 'warning' });
      sticker(c, 'Broke the sound', { x: 680, y: 400, at: at(team, 'elses'), variant: 'red', iconName: 'warning' });
    }

    function tangle() {
      const update = 'tangle/update';
      const a = picture(update);
      const code = arch.code(a, {
        x: 40, y: 40, w: 880, title: 'game.py', at: begin(update) + 0.1, gutter: true, tagsAt: at(update, 'rules'),
        lines: [
          { code: 'def update(squirrel):' },
          { code: '    if keyboard.pressed("space"):', tag: 'Device', tone: 'gold' },
          { code: '        squirrel.vy = -12', tag: 'Game rule', tone: 'cyan' },
          { code: '        audio_driver.play("jump.wav")', tag: 'Device', tone: 'gold' },
          { code: '    squirrel.y += squirrel.vy', tag: 'Physics', tone: 'green' },
          { code: '    gl.draw_quad(squirrel.x, squirrel.y, SQUIRREL_PNG)', tag: 'Device', tone: 'gold' },
        ],
      });
      [[1, 'reads', 'sets'], [2, 'sets', 'plays'], [3, 'plays', 'moves'], [4, 'moves', 'draws'], [5, 'draws', 'game']].forEach(([row, from, to]) => {
        wall.lit(code.rows[row], [[at(update, from), at(update, to)]]);
      });
      sticker(a, 'Game rules and device calls, line by line', { x: 220, y: 380, at: at(update, 'line'), variant: 'gold', iconName: 'link' });

      const predict = 'tangle/predict_port';
      const ripple = 'tangle/ripple';
      const b = picture(predict, ripple);
      ls.fileGrid(b, { x: 24, y: 30, at: begin(predict) + 0.1, redAt: at(ripple, 'sprinkled') });
      wall.listCard(b, { x: 440, y: 30, w: 496, title: '40 files', text: 'player.py, pearls.py, levels.py, menu.py, and more', iconName: 'folder', at: at(predict, 'forty') });
      wall.slot(b, { x: 440, y: 180, w: 496, h: 90, text: 'Which files change?', at: at(predict, 'predict'), until: begin(ripple) + 0.2 });
      arch.search(b, {
        x: 440, y: 180, w: 496, query: 'gl.', summary: '312 calls in 38 files', at: at(ripple, 'search'), rowsAt: at(ripple, 'finds'),
        files: [{ file: 'player.py', hits: '41 calls' }, { file: 'pearls.py', hits: '29 calls' }, { file: 'menu.py', hits: '17 calls' }],
      });
      stamp(b, 'Rewrite the game', { x: 40, y: 330, at: at(ripple, 'rewriting'), color: 'red', rotate: -5, small: true });
      arch.card(b, { x: 40, y: 430, w: 380, title: 'Second game', sub: 'Starts from zero', iconName: 'gamepad', at: at(ripple, 'second'), states: [{ at: at(ripple, 'zero'), state: 'changed', sub: 'Starts from zero' }] });

      const mud = 'tangle/mud';
      const c = picture(mud);
      ls.mudBall(c, { x: 40, y: 40, size: 380, at: begin(mud) + 0.1, drawAt: at(mud, 'everything') });
      wall.listCard(c, { x: 470, y: 50, w: 466, title: 'Big ball of mud', text: 'Everything uses everything. Nobody can say what depends on what.', iconName: 'warning', tone: 'trap', at: at(mud, 'ball') });
      wall.banner(c, { x: 470, y: 330, w: 466, title: 'The fix', text: 'One strict rule about who may use whom', at: at(mud, 'fix') });
    }

    // ----------------------------------------------------------------
    // Rules: the stack, who may use whom, callbacks, strictness, tiers
    // ----------------------------------------------------------------

    function stack() {
      const levels = 'stack/levels';
      const a = picture(levels);
      [['Jump', 'Game idea', 'jump2'], ['Move a body by its speed', 'Physics', 'move'], ['Draw this image here', 'Graphics', 'draw'], ['Send bytes to the graphics chip', 'Device', 'send']]
        .forEach(([title, sub, word], i) => arch.card(a, { x: 250, y: 30 + i * 112, w: 520, title, sub, iconName: ['gamepad', 'gear', 'image', 'chip'][i], at: at(levels, word) }));
      arch.wire(a, { from: [180, 470], to: [180, 40], tone: 'cyan', at: at(levels, 'level') });
      arch.tag(a, { x: 24, y: 236, text: 'More abstract', tone: 'cyan', at: at(levels, 'level') + 0.2 });
      arch.tag(a, { x: 790, y: 236, text: 'Simpler below', at: at(levels, 'simpler') });

      const layersCue = 'stack/layers';
      const b = picture(layersCue);
      pearlDash(b, { at: at(layersCue, 'pearl'), step: 0.5 });
      wall.listCard(b, { x: 24, y: 60, w: 410, title: 'Layer', text: 'A group of modules at one level of abstraction, offering services to the layer above.', iconName: 'stack', at: at(layersCue, 'layer') });

      const translate = 'stack/translate';
      const c = picture(translate);
      const house = pearlDash(c, { at: begin(translate) + 0.1, step: 0.05 });
      const requests = [['jump()', 'jump'], ['push(squirrel, up)', 'push'], ['draw(sprite, x, y)', 'draw'], ['3 GPU commands', 'commands']];
      requests.forEach(([text, word], i) => arch.tag(c, { x: 24 + i * 34, y: house.mid(i) - 18, text, mono: i < 3, tone: 'gold', at: at(translate, word) }));
      [0, 1, 2].forEach((i) => {
        useArrow(c, house, i, i + 1, { at: at(translate, requests[i + 1][1]) - 0.3 });
      });
      arch.token(c, { kind: 'event', path: [[house.x - 50, house.mid(0)], [house.x - 50, house.mid(3)]], at: at(translate, 'jump'), duration: at(translate, 'commands') - at(translate, 'jump') });
      wall.banner(c, { x: 24, y: 440, w: 400, title: 'Each layer', text: 'A machine the layer above can program', at: at(translate, 'machine') });
    }

    function allowed() {
      const uses = 'allowed/uses';
      const a = picture(uses);
      const house = pearlDash(a, { at: begin(uses) + 0.1, step: 0.05 });
      [0, 1, 2].forEach((i) => useArrow(a, house, i, i + 1, { at: at(uses, 'allowed') + i * 0.15 }));
      arch.tag(a, { x: 260, y: 170, text: 'allowed to use', tone: 'gold', at: at(uses, 'allowed') + 0.4 });
      wall.listCard(a, { x: 24, y: 300, w: 410, title: 'A uses B', text: 'A is correct only if B is present and correct.', iconName: 'link', at: at(uses, 'module') });

      const rules = 'allowed/rules';
      const predict = 'allowed/predict_upward';
      const cost = 'allowed/upward_cost';
      const b = picture(rules, cost);
      const house2 = pearlDash(b, { at: begin(rules) + 0.1, step: 0.05 });
      [[1, 'Exactly one layer', 'Every module belongs to exactly one layer.', 'one'], [2, 'One floor down', 'Use only your own layer or the one directly below.', 'two'], [3, 'At least two layers', 'Usually three or more.', 'three']]
        .forEach(([n, name, text, word], i) => arch.rule(b, { x: 24, y: 24 + i * 118, w: 410, n, name, text, at: at(rules, word), until: begin(predict) + 0.3 }));
      [0, 1, 2].forEach((i) => useArrow(b, house2, i, i + 1, { at: at(rules, 'below') + i * 0.12 }));
      sticker(b, 'Never up', { x: 60, y: 384, at: at(rules, 'above'), until: begin(predict) + 0.3, variant: 'red', iconName: 'arrowUp' });

      kit.sticker(b, 'Collision!', { x: 24, y: 40, at: at(predict, 'touched'), variant: 'gold', iconName: 'sparkle', rotate: 4 });
      useArrow(b, house2, 1, 0, { lane: 1, tone: 'red', dashed: true, at: at(predict, 'import'), until: begin(cost) + 0.3 });
      arch.tag(b, { x: 24, y: 130, text: 'engine imports score.py?', mono: true, tone: 'red', at: at(predict, 'import'), until: end(cost) });
      wall.slot(b, { x: 24, y: 220, w: 300, h: 80, text: 'Allowed?', at: at(predict, 'predict'), until: begin(cost) + 0.2 });

      useArrow(b, house2, 1, 0, { lane: 1, tone: 'red', at: at(cost, 'breaks') });
      stamp(b, 'Never up', { x: 40, y: 220, at: at(cost, 'never'), color: 'red', rotate: -5 });
      arch.card(b, { x: 24, y: 430, w: 400, title: 'Second game', sub: 'Blocked: engine needs score.py', iconName: 'gamepad', at: at(cost, 'second'), states: [{ at: at(cost, 'reuse'), state: 'changed', sub: 'Blocked: engine needs score.py' }] });
      sticker(b, 'A cycle', { x: 24, y: 330, at: at(cost, 'cycle'), variant: 'red', iconName: 'loop' });
      arch.tag(b, { x: 170, y: 334, text: 'Each depends on the other', tone: 'red', at: at(cost, 'cycle') + 0.2 });
    }

    function callbacks() {
      const callback = 'callbacks/callback';
      const notUses = 'callbacks/not_uses';
      const a = picture(callback, notUses);
      const house = pearlDash(a, { at: begin(callback) + 0.1, step: 0.05 });
      ls.socket(a, { x: 24, y: 168, w: 400, name: 'CollisionListener', text: 'on_collision(a, b)', at: at(callback, 'listener') });
      arch.tag(a, { x: 24, y: 128, text: 'Defined by the engine', tone: 'cyan', at: at(callback, 'defines') });
      arch.card(a, { x: 24, y: 40, w: 340, title: 'add_point_if_pearl', mono: true, iconName: 'pencil', at: at(callback, 'hands'), until: begin(notUses) + 0.3 });
      arch.wire(a, { from: [184, 108], to: [184, 164], tone: 'gold', at: at(callback, 'startup'), until: begin(notUses) + 0.3 });
      arch.readout(a, {
        x: 24, y: 300, w: 300, label: 'Pearl Dash', iconName: 'gamepad', at: at(callback, 'touches'),
        values: [{ at: -1, text: 'Score 1,240' }, { at: at(callback, 'calls'), text: 'Score 1,250', state: 'ok' }],
      });
      arch.token(a, { kind: 'event', path: [[house.x - 46, house.mid(1)], [house.x - 46, house.mid(0)]], at: at(callback, 'calls'), duration: 0.8, until: begin(notUses) });

      useArrow(a, house, 1, 0, { lane: 1, tone: 'cyan', dashed: true, at: at(notUses, 'travels') });
      arch.tag(a, { x: 24, y: 40, text: 'Calls at run time: on_collision', tone: 'cyan', at: at(notUses, 'travels') + 0.2 });
      useArrow(a, house, 0, 1, { tone: 'gold', at: at(notUses, 'dependency') });
      arch.tag(a, { x: 24, y: 400, text: 'Depends on: CollisionListener', tone: 'gold', at: at(notUses, 'dependency') + 0.2 });
      sticker(a, 'Control goes up, dependency stays down', { x: 24, y: 458, at: at(notUses, 'way'), variant: 'green', iconName: 'check' });
    }

    function relaxed() {
      const strictness = 'relaxed/strictness';
      const a = picture(strictness);
      const names = PEARL_DASH.map(({ name }) => ({ name }));
      const strict = ls.building(a, { x: 70, y: 80, w: 270, h: 64, gap: 14, at: at(strictness, 'strict'), step: 0.08, floors: names });
      const relax = ls.building(a, { x: 660, y: 80, w: 270, h: 64, gap: 14, at: at(strictness, 'relaxed'), step: 0.08, floors: names });
      arch.tag(a, { x: 24, y: 14, text: 'Strict: only the layer directly below', at: at(strictness, 'strict2') });
      arch.tag(a, { x: 540, y: 14, text: 'Relaxed: any lower layer', at: at(strictness, 'relaxed') });
      [0, 1, 2].forEach((i) => {
        useArrow(a, strict, i, i + 1, { at: at(strictness, 'directly') + i * 0.1 });
        useArrow(a, relax, i, i + 1, { at: at(strictness, 'relaxed') + 0.3 + i * 0.1 });
      });
      // Relaxed layering allows any lower layer, so its skips need no exception.
      useArrow(a, relax, 0, 2, { lane: 1, at: at(strictness, 'any') });
      useArrow(a, relax, 1, 3, { lane: 2, at: at(strictness, 'any') + 0.2 });
      // A strict design's documented exception: the bridge runs outside the strict building's other wall.
      useArrow(a, strict, 0, 2, { side: 'right', tone: 'red', at: at(strictness, 'platform') });
      arch.tag(a, { x: strict.x + strict.w + 36, y: strict.mid(1) - 18, text: 'Layer bridging', tone: 'red', at: at(strictness, 'bridging') });
      wall.note(a, { x: 40, y: 424, w: 330, text: 'Each bridge: a documented exception', tone: 'cyan', tilt: -1, at: at(strictness, 'documented') });

      const tiers = 'relaxed/tiers';
      const b = picture(tiers);
      ls.building(b, { x: 40, y: 80, w: 300, h: 56, gap: 10, at: at(tiers, 'layers2'), step: 0.08, floors: names });
      arch.tag(b, { x: 40, y: 14, text: 'Layers: how the code is organized', at: at(tiers, 'organize') });
      arch.wire(b, { from: [190, 360], to: [190, 410], at: at(tiers, 'runs') });
      arch.tag(b, { x: 210, y: 370, text: 'When it runs', at: at(tiers, 'runs') });
      arch.card(b, { x: 40, y: 420, w: 300, title: 'One console', sub: 'All four layers run here', iconName: 'gamepad', at: at(tiers, 'together') });
      arch.tag(b, { x: 440, y: 14, text: 'Tiers: separate running processes', at: at(tiers, 'tiers2') });
      arch.card(b, { x: 440, y: 120, w: 220, title: 'Pearl Dash', sub: 'On the console', iconName: 'gamepad', at: at(tiers, 'game2') });
      arch.card(b, { x: 716, y: 120, w: 220, title: 'Leaderboard', sub: 'On a server', iconName: 'router', at: at(tiers, 'leaderboard') });
      arch.wire(b, { from: [664, 160], to: [710, 160], tone: 'cyan', at: at(tiers, 'server') });
      arch.tag(b, { x: 600, y: 230, text: 'Network', tone: 'cyan', at: at(tiers, 'server') });
    }

    // ----------------------------------------------------------------
    // Consequences: what the rules buy
    // ----------------------------------------------------------------

    function port() {
      const predict = 'port/predict_console';
      const portability = 'port/portability';
      const a = picture(predict, portability);
      const consoleFloors = [
        ...PEARL_DASH.slice(0, 2).map((spec) => ({ ...spec, states: [{ at: at(portability, 'rules'), state: 'same' }] })),
        { ...PEARL_DASH[2], until: at(portability, 'writes') },
        { ...PEARL_DASH[3], until: at(portability, 'drivers') },
      ];
      const house = pearlDash(a, { at: begin(predict) + 0.1, step: 0.05, floors: consoleFloors });
      ls.floor(a, { x: 480, y: house.top(2), w: 456, name: 'Platform for the console', items: ['draw()', 'play()', 'buttons()'], at: at(portability, 'writes'), how: 'slide', states: [{ at: at(portability, 'writes'), state: 'new' }] });
      ls.floor(a, { x: 480, y: house.top(3), w: 456, name: 'Console drivers', items: ['Console GPU', 'Buttons', 'Speaker'], at: at(portability, 'drivers'), how: 'slide', states: [{ at: at(portability, 'drivers'), state: 'new' }] });
      ls.gameScreen(a, { x: 24, y: 40, w: 380, device: 'console', at: at(predict, 'console') });
      [0, 1, 2, 3].forEach((i) => wall.slot(a, { x: 412, y: house.top(i) + 14, w: 52, h: 44, text: '?', at: at(predict, 'predict') + i * 0.1, until: begin(portability) + 0.2 }));
      arch.quality(a, { x: 24, y: 300, w: 300, name: 'Portability', at: at(portability, 'portability') });
      arch.tag(a, { x: 24, y: 380, text: 'Same interface: draw(), play(), buttons()', mono: false, at: at(portability, 'interface') });
      stamp(a, 'Unchanged', { x: 60, y: 434, at: at(portability, 'change'), color: 'green', rotate: -4, small: true });

      const modify = 'port/modify_reuse';
      const b = picture(modify);
      ls.floor(b, { x: 24, y: 70, w: 440, name: 'Pearl Dash rules', items: ['Squirrel', 'Pearls'], at: begin(modify) + 0.1 });
      ls.floor(b, { x: 496, y: 70, w: 440, name: 'Skateboard racer rules', items: ['Board', 'Laps'], at: at(modify, 'skateboard'), how: 'slide', states: [{ at: at(modify, 'skateboard'), state: 'new' }] });
      ls.floor(b, { x: 24, y: 160, w: 912, name: 'Engine', items: ['Faster physics', 'Collisions', 'Scene drawing'], at: begin(modify) + 0.2, states: [{ at: at(modify, 'swap'), state: 'changed' }] });
      ls.floor(b, { x: 24, y: 244, w: 912, name: 'Platform', items: ['Graphics', 'Sound', 'Input'], at: begin(modify) + 0.3 });
      arch.quality(b, { x: 24, y: 350, w: 330, name: 'Modifiability', at: at(modify, 'modifiability') });
      arch.quality(b, { x: 380, y: 350, w: 300, name: 'Reusability', at: at(modify, 'reuse') });
      wall.note(b, { x: 700, y: 350, w: 236, text: 'The lower the layer, the more programs share it', tone: 'cyan', tilt: -1, at: at(modify, 'lower') });

      const everyday = 'port/everyday';
      const c = picture(everyday);
      const stackHouse = ls.building(c, {
        x: 400, y: 70, w: 536, h: 64, gap: 12, at: at(everyday, 'stack'), step: 0.2,
        floors: [
          { name: 'Application', items: ['Chat protocol', 'HTTP'] }, { name: 'Transport', items: ['TCP'] },
          { name: 'Internet', items: ['IP'] }, { name: 'Link', items: ['Wi-Fi'], until: at(everyday, 'cable') },
        ],
      });
      ['Cable', 'Cellular'].forEach((name, i) => {
        const word = ['cable', 'cellular'][i];
        ls.floor(c, { x: 400, y: stackHouse.top(3), w: 536, h: 64, name: 'Link', items: [name], at: at(everyday, word), until: i === 0 ? at(everyday, 'cellular') : undefined, how: 'slide', states: [{ at: at(everyday, word), state: 'new' }] });
      });
      arch.card(c, { x: 24, y: 70, w: 320, title: 'Chat app', sub: 'Same code on any link', iconName: 'chat', at: at(everyday, 'chat') });
      arch.token(c, { kind: 'event', path: [[380, 100], [380, stackHouse.mid(3)]], at: at(everyday, 'travels'), duration: 2.2 });
      arch.tag(c, { x: 24, y: 360, text: 'Only the bottom layer differs', tone: 'gold', at: at(everyday, 'differs') });

      const teamTest = 'port/team_test';
      const d = picture(teamTest);
      const house4 = pearlDash(d, { at: begin(teamTest) + 0.1, step: 0.05 });
      [['Gameplay', 'gamepad', 0, 'gameplay'], ['You', 'user', 1, 'engine'], ['Sound', 'chip', 2, 'sound']].forEach(([role, iconName, i, word]) => {
        arch.card(d, { x: 260, y: house4.top(i) + 4, w: 190, title: role, iconName, at: at(teamTest, word) });
      });
      arch.readout(d, { x: 24, y: 360, w: 426, label: 'Game rules on a fake engine', iconName: 'check', at: at(teamTest, 'test'), values: [{ at: -1, text: 'Test passed, no console', state: 'ok' }] });
      arch.quality(d, { x: 24, y: 440, w: 220, name: 'Team split', at: at(teamTest, 'split') });
      arch.quality(d, { x: 254, y: 440, w: 200, name: 'Testability', at: at(teamTest, 'fake') });
    }

    // ----------------------------------------------------------------
    // Consequences: what the rules cost
    // ----------------------------------------------------------------

    function costs() {
      const overhead = 'costs/overhead';
      const a = picture(overhead);
      const house = pearlDash(a, { at: begin(overhead) + 0.1, step: 0.05 });
      ls.frameBar(a, {
        x: 24, y: 60, w: 410, at: at(overhead, 'sixteen'),
        steps: [{ at: -1, ms: 12.5 }, { at: at(overhead, 'crosses'), ms: 15.8 }, { at: at(overhead, 'storm'), ms: 21.3 }],
      });
      [0, 1, 2, 3, 4].forEach((i) => arch.token(a, { kind: 'event', path: [[house.x - 24, house.mid(0)], [house.x - 24, house.mid(3)]], at: at(overhead, 'crosses') + i * 0.6, duration: 1.6, until: at(overhead, 'crosses') + i * 0.6 + 1.6 }));
      arch.tag(a, { x: 24, y: 240, text: 'Each layer translates and copies', tone: 'gold', at: at(overhead, 'translates') });
      arch.quality(a, { x: 24, y: 400, w: 330, name: 'Performance', effect: 'inhibited', at: at(overhead, 'drops') });

      const bridge = 'costs/bridge';
      const b = picture(bridge);
      const house2 = pearlDash(b, { at: begin(bridge) + 0.1, step: 0.05 });
      useArrow(b, house2, 0, 3, { tone: 'red', at: at(bridge, 'skip') });
      arch.tag(b, { x: 24, y: 206, text: 'Bridge: pearl drawing → laptop driver', tone: 'red', at: at(bridge, 'skip') + 0.2 });
      ls.frameBar(b, {
        x: 24, y: 60, w: 410, at: begin(bridge) + 0.2,
        steps: [{ at: -1, ms: 21.3 }, { at: at(bridge, 'back'), ms: 15.1 }],
      });
      arch.card(b, { x: 24, y: 266, w: 410, title: 'On the console', sub: 'Bridge breaks: rewrite it', iconName: 'gamepad', at: at(bridge, 'console'), states: [{ at: at(bridge, 'rewritten'), state: 'changed', sub: 'Bridge breaks: rewrite it' }] });
      arch.quality(b, { x: 24, y: 380, w: 200, name: 'Speed', at: at(bridge, 'traded') + 0.2 });
      arch.quality(b, { x: 240, y: 380, w: 200, name: 'Portability', effect: 'inhibited', at: at(bridge, 'traded') });

      const upfront = 'costs/upfront';
      const c = picture(upfront);
      wall.balance(c, {
        x: 480, y: 130, beam: 520, at: begin(upfront) + 0.1,
        pans: [
          { w: 300, title: 'Up-front design', iconName: 'pencil', items: [{ text: 'Choose the levels', at: at(upfront, 'levels') }, { text: 'Design interfaces', at: at(upfront, 'interface') }, { text: 'Keep the rules', at: at(upfront, 'keep') }], at: at(upfront, 'design') },
          { w: 300, title: 'Payoff', iconName: 'check', items: [{ text: 'Two devices', at: at(upfront, 'devices') }, { text: 'A second game', at: at(upfront, 'devices') + 0.2 }, { text: 'Years of changes', at: at(upfront, 'years') }], at: at(upfront, 'game') },
        ],
        tilts: [{ at: at(upfront, 'floors'), angle: 10 }],
      });
      wall.note(c, { x: 30, y: 20, w: 300, text: 'Weekend jam: one file is fine', tone: 'cyan', tilt: -2, at: at(upfront, 'weekend') });
    }

    function leaks() {
      const leak = 'leaks/leak';
      const a = picture(leak);
      ls.building(a, {
        x: 480, y: 70, w: 456, at: begin(leak) + 0.1, step: 0.05,
        floors: [PEARL_DASH[0], PEARL_DASH[1], { name: 'Platform for the console', items: ['draw()', 'play()', 'buttons()'], states: [{ at: at(leak, 'slowly'), state: 'changed' }] }, { name: 'Console drivers', items: ['Console GPU', 'Buttons', 'Speaker'] }],
      });
      ls.gameScreen(a, {
        x: 24, y: 40, w: 420, device: 'console', at: begin(leak) + 0.2,
        fps: [{ at: -1, text: '60 fps' }, { at: at(leak, 'stutters'), text: '38 fps', state: 'bad' }],
      });
      arch.readout(a, { x: 24, y: 300, w: 420, label: '500 small images', iconName: 'timer', at: at(leak, 'many'), values: [{ at: -1, text: 'Drawn more slowly', state: 'warn' }] });
      sticker(a, 'Same interface, different timing', { x: 24, y: 400, at: at(leak, 'interface2'), variant: 'red', iconName: 'warning' });

      const granularity = 'leaks/granularity';
      const b = picture(granularity);
      ls.building(b, { x: 40, y: 100, w: 260, h: 84, gap: 12, at: at(granularity, 'few'), step: 0.1, floors: [{ name: 'Game rules' }, { name: 'Engine and platform', tone: 'wide' }] });
      arch.tag(b, { x: 40, y: 20, text: 'Too few', tone: 'red', at: at(granularity, 'few') });
      ls.building(b, {
        x: 360, y: 100, w: 240, h: 34, gap: 6, at: at(granularity, 'many2'), step: 0.06,
        floors: ['Rules', 'Logic', 'Engine', 'Scene', 'Render', 'Platform', 'Bridge', 'Drivers'].map((name) => ({ name, tone: 'thin' })),
      });
      arch.tag(b, { x: 360, y: 20, text: 'Too many', tone: 'red', at: at(granularity, 'many2') });
      ls.building(b, {
        x: 690, y: 100, w: 246, h: 64, gap: 10, at: at(granularity, 'pick'), step: 0.1,
        floors: [{ name: 'Game rules', items: ['Gameplay ideas'] }, { name: 'Engine', items: ['Engine tech'] }, { name: 'Platform', items: ['Device APIs'] }, { name: 'Drivers', items: ['Hardware'] }],
      });
      arch.tag(b, { x: 690, y: 20, text: 'Just right', tone: 'green', at: at(granularity, 'pick') });
      wall.note(b, { x: 300, y: 430, w: 380, text: 'Split where things change for different reasons, at different speeds', tone: 'cyan', tilt: -1, at: at(granularity, 'reasons') });
    }

    // ----------------------------------------------------------------
    // Summary
    // ----------------------------------------------------------------

    function summary() {
      const problem = 'summary/recap_problem';
      const a = picture(problem);
      ls.mudBall(a, { x: 40, y: 60, size: 320, at: begin(problem) + 0.1, drawAt: begin(problem) + 0.2 });
      arch.cross(a, { x: 200, y: 220, size: 90, at: at(problem, 'layers') });
      const house = pearlDash(a, { at: at(problem, 'layers'), step: 0.2 });
      arch.token(a, { kind: 'event', path: [[house.x - 24, house.mid(0)], [house.x - 24, house.mid(3)]], at: at(problem, 'machine'), duration: 1.6 });
      arch.tag(a, { x: 40, y: 420, text: 'Ball of mud: rewrite to port', tone: 'red', at: at(problem, 'rewriting') });

      const rules = 'summary/recap_rules';
      const b = picture(rules);
      [[1, 'Exactly one layer', 'exactly'], [2, 'One floor down, or any lower if relaxed', 'below'], [3, 'At least two layers', 'rules']].forEach(([n, name, word], i) => {
        arch.rule(b, { x: 24, y: 24 + i * 96, w: 560, n, name, at: at(rules, word) });
      });
      sticker(b, 'Never up', { x: 640, y: 40, at: at(rules, 'nothing'), variant: 'red', iconName: 'arrowUp' });
      ls.socket(b, { x: 24, y: 330, w: 560, name: 'CollisionListener', text: 'news goes up by callback', at: at(rules, 'callbacks') });
      wall.note(b, { x: 640, y: 320, w: 296, text: 'Layers organize code; tiers are running processes', tone: 'cyan', tilt: -1, at: at(rules, 'tiers') });

      const tradeoff = 'summary/recap_tradeoff';
      const c = picture(tradeoff);
      wall.balance(c, {
        x: 480, y: 120, beam: 560, at: begin(tradeoff) + 0.1,
        pans: [
          { w: 260, title: 'Promoted', iconName: 'arrowUp', items: [{ text: 'Portability', at: at(tradeoff, 'bottom') }, { text: 'Modifiability', at: at(tradeoff, 'insides') }, { text: 'Reusability', at: at(tradeoff, 'reuse') }], at: begin(tradeoff) + 0.2 },
          { w: 260, title: 'Inhibited', iconName: 'arrowDown', items: [{ text: 'Performance', at: at(tradeoff, 'frame') }, { text: 'Up-front cost', at: at(tradeoff, 'front') }], at: at(tradeoff, 'cost') },
        ],
        tilts: [],
      });
      sticker(c, 'Is that import one floor down?', { x: 300, y: 450, at: at(tradeoff, 'import'), variant: 'gold', iconName: 'question' });
    }

    intro();
    tangle();
    stack();
    allowed();
    callbacks();
    relaxed();
    port();
    costs();
    leaks();
    summary();
  };
})();
