/*
 * Choreography for the Layers video narration (script:
 * _data/narrations/layered_style.yml; artwork: layered-style-kit.js on the
 * architecture kit, the UML kit, and the wall kit). The narration reaches
 * this stage as a song: each scene is a section and each cue a line, and
 * `at(cue, word)` is the estimated time the narrator says that word
 * (repeated words are word2, word3, ...). Cues are named by their stable
 * script ids ('intro/jam'), looked up in the storyboard, so reordering the
 * script never misplaces a picture.
 *
 * The teaching rule for the pictures: show the mechanism the cue names, on
 * Pearl Dash, the team's rooftop game. A layered design is a module view in
 * a frame that names its view and carries a key: each layer a UML package
 * stereotyped «layer» with its modules inside, the game rules on top and the
 * device's drivers at the bottom; the allowed-to-use relation is a dashed
 * dependency arrow; tiers are nodes in an allocation view. A rule of the
 * style is a numbered rule card that arrives as its cue begins and stays up
 * while the scene applies it; every consequence is a quality card that says
 * Promoted or Inhibited in words, beside the rule it follows from. Stamps
 * never shake the stage, and nothing large changes brightness quickly
 * (WCAG 2.3.1). Layout: the 960x540 picture body; nothing readable within
 * 12px of an edge.
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
    in_practice: { kind: 'In practice', name: 'Real-world examples', iconName: 'globe' },
    summary: { kind: 'Recap', name: 'Down, never up', iconName: 'check' },
  };

  /** The three rules, as their cards name them. */
  const RULES = {
    1: { name: 'Exactly one layer', text: 'Every module belongs to exactly one layer.' },
    2: { name: 'Next lower layer', text: 'Use only your own layer or the next lower layer.' },
    3: { name: 'At least two layers', text: 'Usually three or more.' },
  };

  /** Pearl Dash's four layers, from the top down. */
  const PEARL_DASH = [
    { name: 'Game rules', items: ['Squirrel', 'Pearls', 'Score', 'Levels'] },
    { name: 'Engine', items: ['Physics', 'Collisions', 'Scene drawing'] },
    { name: 'Platform', items: ['Graphics', 'Sound', 'Input'] },
    { name: 'Drivers', items: ['Laptop GPU', 'Keyboard', 'Sound card'] },
  ];
  /** The keys of the module views. */
  const KEY_LAYERS = [['package', 'layer'], ['module', 'module']];
  const KEY_USES = [['package', 'layer'], ['dependency', 'allowed to use']];
  const KEY_EXAMPLE = [['package', 'layer, uses the one below']];

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
    const uml = window.UmlKit;
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
    /** Rule n's card; `full` adds its one-line statement. */
    const rule = (parent, n, { full = false, ...options }) => arch.rule(parent, { n, name: RULES[n].name, text: full ? RULES[n].text : undefined, ...options });

    /**
     * Pearl Dash's layers at the standard place on the right, in a module
     * view frame whose key sits at its bottom: bodies at 86, 176, 266, 356.
     */
    function pearlDash(parent, { x = 480, y = 54, w = 456, at: when, floors = PEARL_DASH, step = 0.15, key = KEY_LAYERS, frameAt } = {}) {
      uml.frame(parent, { view: 'module', x: x - 32, y: y - 44, w: w + 46, h: 448, key, keyAt: 'bottom', at: frameAt ?? when - 0.1 });
      return ls.building(parent, { x, y, w, h: 50, gap: 8, at: when, step, floors });
    }
    /**
     * An allowed-to-use dependency from layer `from` to layer `to`: between
     * neighbors it runs through the gap between them, `lane` steps left of
     * the stack's right end; a longer one, or one drawn `outside`, runs
     * outside the stack on `side`, `lane` steps out.
     */
    function useArrow(parent, house, from, to, { lane = 0, side = 'left', outside = false, kind = 'dependency', ...options }) {
      if (Math.abs(to - from) === 1 && !outside) {
        const x = house.x + house.w - 70 - lane * 90;
        const [upper, lower] = from < to ? [from, to] : [to, from];
        const ends = [house.bottom(upper), house.top(lower)];
        const points = from < to ? [[x, ends[0]], [x, ends[1]]] : [[x, ends[1]], [x, ends[0]]];
        return uml.connector(parent, { points, kind, ...options });
      }
      const edge = side === 'left' ? house.x : house.x + house.w;
      const out = side === 'left' ? edge - 16 - lane * 12 : edge + 16 + lane * 12;
      return uml.connector(parent, { points: [[edge, house.mid(from)], [out, house.mid(from)], [out, house.mid(to)], [edge, house.mid(to)]], kind, ...options });
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
        // Each laptop-only call is flagged as it is named, as an editor flags a problem.
        lines: [
          { code: 'def update(squirrel):' },
          { code: '    if keyboard.pressed("space"):', tag: 'Device', tone: 'red', iconName: 'laptop', smellAt: at(update, 'reads') },
          { code: '        squirrel.vy = -12', tag: 'Game rule', tone: 'cyan', iconName: 'gamepad' },
          { code: '        audio_driver.play("jump.wav")', tag: 'Device', tone: 'red', iconName: 'laptop', smellAt: at(update, 'plays') },
          { code: '    squirrel.y += squirrel.vy', tag: 'Physics', tone: 'green', iconName: 'gear' },
          { code: '    gl.draw_quad(squirrel.x, squirrel.y, SQUIRREL_PNG)', tag: 'Device', tone: 'red', iconName: 'laptop', smellAt: at(update, 'draws') },
        ],
      });
      [[1, 'reads', 'sets'], [2, 'sets', 'plays'], [3, 'plays', 'moves'], [4, 'moves', 'draws'], [5, 'draws', 'game']].forEach(([row, from, to]) => {
        wall.lit(code.rows[row], [[at(update, from), at(update, to)]]);
      });
      sticker(a, 'Game rules and device calls, line by line', { x: 40, y: 384, at: at(update, 'line'), variant: 'red', iconName: 'warning' });
      stamp(a, 'Tangled code', { x: 660, y: 372, at: at(update, 'line') + 0.4, color: 'red', rotate: -6, small: true });

      const ripple = 'tangle/ripple';
      const b = picture(ripple);
      ls.fileGrid(b, { x: 24, y: 30, at: begin(ripple) + 0.1, redAt: at(ripple, 'nearly') });
      wall.listCard(b, { x: 440, y: 30, w: 496, title: '40 files', text: 'player.py, pearls.py, levels.py, menu.py, and more', iconName: 'folder', at: at(ripple, 'forty') });
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
    // Rules: the stack as a module view, who may use whom, callbacks,
    // strictness, and tiers in an allocation view
    // ----------------------------------------------------------------

    function stack() {
      const levels = 'stack/levels';
      const abstraction = 'stack/abstraction';
      const a = picture(levels, abstraction);
      // Each level, then, as abstraction is explained, the only words it knows.
      [
        ['Jump', 'Game idea', 'gamepad', at(levels, 'jump2'), 'Game idea: squirrels, pearls, jumps', at(abstraction, 'abstraction')],
        ['Move a body by its speed', 'Physics', 'gear', at(levels, 'move'), 'Physics: bodies and speeds, no squirrels', at(abstraction, 'physics')],
        ['Draw this image here', 'Graphics', 'image', at(levels, 'draw'), 'Graphics: images and positions, no physics', at(abstraction, 'graphics')],
        ['Send bytes to the graphics chip', 'Device', 'chip', at(levels, 'send'), 'Device: bytes only', at(abstraction, 'device')],
      ].forEach(([title, sub, iconName, when, knows, knowsAt], i) => arch.card(a, {
        x: 250, y: 24 + i * 100, w: 520, title, sub, iconName, at: when,
        states: [{ at: when, state: '', sub }, { at: knowsAt, state: '', sub: knows }],
      }));
      arch.wire(a, { from: [180, 400], to: [180, 30], tone: 'cyan', at: at(levels, 'abstraction') });
      arch.tag(a, { x: 24, y: 200, text: 'More abstract', tone: 'cyan', at: at(levels, 'abstraction') + 0.2 });
      arch.tag(a, { x: 790, y: 200, text: 'Knows less below', at: at(abstraction, 'lower2') });
      wall.banner(a, { x: 250, y: 430, w: 520, title: 'Abstraction', text: 'Says what to do, and hides how', at: at(abstraction, 'abstraction') + 0.3 });

      const layersCue = 'stack/layers';
      const b = picture(layersCue);
      const house = pearlDash(b, { at: at(layersCue, 'layers'), step: 0.5, frameAt: at(layersCue, 'module') - 0.6 });
      uml.callout(b, { x: 96, y: 98, w: 250, text: 'Module: a package', to: [house.x + 12, house.mid(0) + 8], at: at(layersCue, 'modules') });
      uml.callout(b, { x: 96, y: 190, w: 300, text: 'Layer: a «layer» package', to: [house.x, house.top(1) - 16], at: at(layersCue, 'package') });
      wall.listCard(b, { x: 24, y: 300, w: 400, title: 'Layer', text: 'A cohesive set of modules at one level of abstraction, offering services to the layer above.', iconName: 'stack', at: at(layersCue, 'layer') });

      const translate = 'stack/translate';
      const c = picture(translate);
      const house2 = pearlDash(c, { at: begin(translate) + 0.1, step: 0.05 });
      // Each layer's request sits level with its layer, in one column, tied to the layer by a dotted
      // line and handed down to the next request by an arrow.
      const requests = [['jump()', 'jump'], ['push(squirrel, up)', 'push'], ['draw(sprite, x, y)', 'draw'], ['3 GPU commands', 'commands']];
      const chip = { x: 40, w: 300, half: 18 };
      requests.forEach(([text, word], i) => {
        arch.tag(c, { x: chip.x, y: house2.mid(i) - chip.half, w: chip.w, text, mono: true, tone: 'gold', at: at(translate, word) });
        uml.connector(c, { from: [chip.x + chip.w + 8, house2.mid(i)], to: [house2.x, house2.mid(i)], kind: 'note', at: at(translate, word) + 0.15 });
      });
      [0, 1, 2].forEach((i) => arch.wire(c, { from: [chip.x + 32, house2.mid(i) + chip.half + 4], to: [chip.x + 32, house2.mid(i + 1) - chip.half - 4], tone: 'gold', at: at(translate, requests[i + 1][1]) - 0.3 }));
      wall.banner(c, { x: 24, y: 420, w: 400, title: 'Each layer', text: 'A virtual machine for the layer above', at: at(translate, 'virtual') });
    }

    function allowed() {
      const uses = 'allowed/uses';
      const rules = 'allowed/rules';
      const why = 'allowed/why_rules';
      const predict = 'allowed/predict_upward';
      const cost = 'allowed/upward_cost';
      const a = picture(uses, cost);
      const house = pearlDash(a, { at: begin(uses) + 0.1, step: 0.05, key: [['package', 'layer'], ['dependency', 'may use'], ['banned', 'may not use']] });
      [0, 1, 2].forEach((i) => useArrow(a, house, i, i + 1, { at: at(uses, 'dashed') + i * 0.15 }));
      wall.listCard(a, { x: 24, y: 60, w: 410, title: 'Allowed to use', text: 'Which layers may use which: each dashed arrow.', iconName: 'arrowDown', at: at(uses, 'allowed'), until: begin(rules) + 0.2 });
      wall.listCard(a, { x: 24, y: 236, w: 410, title: 'A uses B', text: 'A is correct only if B is present and correct.', iconName: 'link', at: at(uses, 'module'), until: begin(rules) + 0.2 });

      // The three rules arrive as their cue begins and stay up through the prediction and its answer.
      const cards = [1, 2, 3].map((n, i) => rule(a, n, { full: true, x: 24, y: 8 + i * 112, w: 410, at: begin(rules) + 0.3 + i * 0.3 }));
      wall.lit(cards[1], [[begin(why), end(why)], [at(cost, 'violates'), end(cost)]]);
      wall.listCard(a, {
        x: 24, y: 348, w: 410, title: 'Why these rules?', iconName: 'question', at: begin(why) + 0.2, until: end(why),
        items: [{ text: 'A layer sees only the interface below', at: at(why, 'interface') }, { text: 'Changes inside stay hidden', at: at(why, 'hidden') }, { text: 'Lower layers serve any program', at: at(why, 'reuse') }],
      });

      kit.sticker(a, 'Collision!', { x: 24, y: 352, at: at(predict, 'touched'), until: end(predict), variant: 'gold', iconName: 'sparkle', rotate: 4 });
      useArrow(a, house, 1, 0, { lane: 2, tone: 'red', at: at(predict, 'import') });
      arch.tag(a, { x: 24, y: 406, text: '«use»: engine imports score.py?', mono: true, tone: 'red', at: at(predict, 'import') });
      wall.slot(a, { x: 24, y: 450, w: 300, h: 66, text: 'Allowed?', at: at(predict, 'predict'), until: begin(cost) + 0.2 });

      stamp(a, 'Never up', { x: 40, y: 452, at: at(cost, 'upward'), color: 'red', rotate: -5, small: true });
      sticker(a, 'A cycle', { x: 24, y: 350, at: at(cost, 'cycle'), variant: 'red', iconName: 'loop' });
      arch.tag(a, { x: 180, y: 356, text: 'Each depends on the other', tone: 'red', at: at(cost, 'cycle') + 0.2 });
      arch.tag(a, { x: 250, y: 488, text: 'Second game: can’t reuse it', tone: 'red', at: at(cost, 'reuse') });
    }

    function callbacks() {
      const callback = 'callbacks/callback';
      const notUses = 'callbacks/not_uses';
      const a = picture(callback, notUses);
      // A module view with the two layers that matter opened up: the game's handler class inside Game rules,
      // the engine's interface inside Engine. Platform and Drivers stay closed below them.
      uml.frame(a, { view: 'module', x: 8, y: 6, w: 944, h: 470, key: [['package', 'layer'], ['interface', 'class, interface'], ['realize', 'implements'], ['control', 'run-time call']], at: begin(callback) + 0.05 });
      // Each class sits inside its layer's body with room around it; its operation fits one line.
      const x = 420;
      const w = 516;
      const box = { x: 612, w: 300, handlerY: 96, handlerBottom: 186, listenerY: 266 };
      ls.floor(a, { x, y: 82, w, h: 130, name: 'Game rules', at: begin(callback) + 0.1 });
      ls.floor(a, { x, y: 252, w, h: 140, name: 'Engine', at: begin(callback) + 0.15 });
      ls.floor(a, { x, y: 428, w: 244, h: 40, name: 'Platform', tone: 'thin', at: begin(callback) + 0.2 });
      ls.floor(a, { x: x + 272, y: 428, w: 244, h: 40, name: 'Drivers', tone: 'thin', at: begin(callback) + 0.25 });
      uml.classBox(a, { x: box.x, y: box.handlerY, w: box.w, name: 'PearlHandler', lines: ['on_collision(a, b)'], at: at(callback, 'implementation') });
      uml.classBox(a, { x: box.x, y: box.listenerY, w: box.w, name: 'CollisionListener', stereotype: 'interface', lines: ['on_collision(a, b)'], at: at(callback, 'interface') });
      uml.connector(a, { from: [box.x + 260, box.handlerBottom], to: [box.x + 260, box.listenerY], kind: 'realize', at: at(callback, 'registers') });
      arch.tag(a, { x: 24, y: 70, text: 'The engine defines the interface', tone: 'cyan', at: at(callback, 'defines') });
      arch.tag(a, { x: 24, y: 120, text: 'The game registers a handler', at: at(callback, 'registers') });
      arch.readout(a, {
        x: 24, y: 180, w: 300, label: 'Pearl Dash', iconName: 'gamepad', at: at(callback, 'touches'),
        values: [{ at: -1, text: 'Score 1,240' }, { at: at(callback, 'invokes'), text: 'Score 1,250', state: 'ok' }],
      });
      // At run time the engine calls up into whatever was registered.
      uml.connector(a, { from: [box.x + 70, box.listenerY], to: [box.x + 70, box.handlerBottom], kind: 'flow', tone: 'cyan', at: at(callback, 'invokes') - 0.2 });
      arch.token(a, { kind: 'event', path: [[box.x + 70, box.listenerY - 8], [box.x + 70, box.handlerBottom + 10]], at: at(callback, 'invokes'), duration: 0.6, until: at(callback, 'invokes') + 1.2 });

      arch.tag(a, { x: 24, y: 260, text: 'Control: up, at run time', tone: 'cyan', at: at(notUses, 'control') });
      arch.tag(a, { x: 24, y: 310, text: 'Dependency: down, game → engine', tone: 'gold', at: at(notUses, 'dependency') });
      sticker(a, 'Two different relations', { x: 24, y: 400, at: at(notUses, 'relations'), variant: 'green', iconName: 'check' });
    }

    function relaxed() {
      const strictness = 'relaxed/strictness';
      const a = picture(strictness);
      const names = PEARL_DASH.map(({ name }) => ({ name }));
      const stackOf = (x, when) => ls.building(a, { x, y: 104, w: 210, h: 46, gap: 12, thin: true, at: when, step: 0.08, floors: names });
      uml.frame(a, { view: 'module', title: 'strict layering', x: 8, y: 6, w: 452, h: 438, key: [['package', 'layer'], ['dependency', 'may use']], keyAt: 'bottom', at: at(strictness, 'strict') - 0.3 });
      uml.frame(a, { view: 'module', title: 'relaxed layering', x: 500, y: 6, w: 452, h: 438, key: [['package', 'layer'], ['dependency', 'may use']], keyAt: 'bottom', at: at(strictness, 'relaxed') - 0.3 });
      const strict = stackOf(232, at(strictness, 'strict'));
      const relax = stackOf(600, at(strictness, 'relaxed'));
      arch.tag(a, { x: 24, y: 52, text: 'Only the layer directly below', at: at(strictness, 'directly') });
      arch.tag(a, { x: 516, y: 52, text: 'Any lower layer', at: at(strictness, 'any') });
      [0, 1, 2].forEach((i) => {
        useArrow(a, strict, i, i + 1, { at: at(strictness, 'directly') + i * 0.1 });
        useArrow(a, relax, i, i + 1, { at: at(strictness, 'relaxed') + 0.3 + i * 0.1 });
      });
      // Relaxed layering allows any lower layer, so its skips need no exception.
      useArrow(a, relax, 0, 2, { side: 'right', at: at(strictness, 'any') });
      useArrow(a, relax, 1, 3, { side: 'right', lane: 1, at: at(strictness, 'any') + 0.2 });
      // A strict design's documented exception: a bridge outside the strict stack's other side.
      useArrow(a, strict, 0, 2, { side: 'left', tone: 'red', at: at(strictness, 'platform') });
      arch.tag(a, { x: 24, y: strict.mid(1) - 18, text: 'Layer bridging', tone: 'red', at: at(strictness, 'bridging') });
      wall.note(a, { x: 470, y: 452, w: 330, text: 'Each bridge: a documented exception', tone: 'cyan', tilt: -1, at: at(strictness, 'documented') });

      const tiers = 'relaxed/tiers';
      const b = picture(tiers);
      uml.frame(b, { view: 'module', x: 8, y: 6, w: 436, h: 470, key: [['package', 'layer']], keyAt: 'bottom', at: at(tiers, 'layers2') - 0.4 });
      arch.tag(b, { x: 24, y: 52, text: 'Layers: code, grouped before it runs', at: at(tiers, 'module') });
      const code = ls.building(b, { x: 60, y: 100, w: 300, h: 46, gap: 12, thin: true, at: at(tiers, 'layers2'), step: 0.08, floors: names });
      uml.frame(b, { view: 'allocation', x: 476, y: 6, w: 476, h: 470, key: [['node', 'node'], ['component', 'component'], ['link', 'network']], keyAt: 'bottom', at: at(tiers, 'tier') - 0.6 });
      arch.tag(b, { x: 492, y: 52, text: 'Tiers: running components, by machine', at: at(tiers, 'tier') });
      uml.node(b, { x: 496, y: 120, w: 196, h: 200, name: 'Console', stereotype: 'device', at: at(tiers, 'console') });
      uml.component(b, { x: 508, y: 186, w: 172, h: 120, name: 'Pearl Dash', lines: ['all four layers'], at: at(tiers, 'console') + 0.2 });
      arch.wire(b, { from: [code.x + code.w + 14, code.mid(1)], to: [490, 220], tone: 'gold', at: at(tiers, 'console') + 0.3 });
      uml.node(b, { x: 740, y: 120, w: 196, h: 200, name: 'Server', stereotype: 'device', at: at(tiers, 'machine') });
      uml.component(b, { x: 752, y: 186, w: 172, h: 86, name: 'Leaderboard', at: at(tiers, 'machine') + 0.2 });
      uml.connector(b, { from: [692, 220], to: [740, 220], kind: 'link', at: at(tiers, 'machine') + 0.3 });
      uml.label(b, { x: 650, y: 336, text: 'network', at: at(tiers, 'machine') + 0.4 });
      arch.tag(b, { x: 492, y: 400, text: 'Talk within a tier or to the next', at: at(tiers, 'adjacent') });

      // A three-tier system as a C&C view with tier boundaries laid over it, presentation on top, each
      // tier calling only the one below; beside it, what a tier is and what tiers buy.
      const threeTiers = 'relaxed/three_tiers';
      const c = picture(threeTiers);
      wall.listCard(c, {
        x: 24, y: 20, w: 370, title: 'Tier', iconName: 'stack', at: begin(threeTiers) + 0.2,
        text: 'A group of running components, usually on its own machines',
        items: [{ text: 'Connectors only within a tier or to the next', at: at(threeTiers, 'calls') }],
      });
      wall.listCard(c, {
        x: 24, y: 252, w: 370, title: 'Each tier, on its own', iconName: 'check', at: at(threeTiers, 'secured'),
        items: [{ text: 'Secured' }, { text: 'Scaled', at: at(threeTiers, 'scaled') }, { text: 'Changed', at: at(threeTiers, 'changed') }],
      });
      uml.frame(c, { view: 'cnc', title: 'three-tier leaderboard', x: 416, y: 6, w: 536, h: 470, key: [['component', 'component'], ['boundary', 'tier'], ['call', 'call']], keyAt: 'bottom', at: begin(threeTiers) + 0.1 });
      const tier = { x: 434, w: 500, h: 104, pitch: 140, top: 48 };
      const part = { w: 220, h: 84, inset: 20, drop: 10 };
      const tierSpecs = [
        ['Presentation', 'on the console', 'Pearl Dash', 'presentation'],
        ['Logic', 'on a cloud server', 'Leaderboard service', 'logic'],
        ['Data', 'on a database server', 'Score database', 'data'],
      ];
      const placed = tierSpecs.map(([name, sub, component, word], i) => {
        const y = tier.top + i * tier.pitch;
        const x = tier.x + tier.w - part.inset - part.w;
        uml.boundary(c, { x: tier.x, y, w: tier.w, h: tier.h, name, stereotype: 'tier', sub, at: at(threeTiers, word) });
        uml.component(c, { x, y: y + part.drop, w: part.w, h: part.h, name: component, at: at(threeTiers, word) + 0.2 });
        return { top: y + part.drop, bottom: y + part.drop + part.h, cx: x + part.w / 2, tierBottom: y + tier.h };
      });
      // Each call runs down from one tier to the next, its type beside it in the gap between the tiers.
      [[0, 'calls'], [1, 'reads']].forEach(([i, word]) => {
        uml.connector(c, { from: [placed[i].cx, placed[i].bottom], to: [placed[i + 1].cx, placed[i + 1].top], kind: 'flow', ends: 'both', at: at(threeTiers, word) });
        uml.label(c, { x: placed[i].cx - 92, y: placed[i].tierBottom + 5, text: 'call', at: at(threeTiers, word) + 0.2 });
      });
    }

    // ----------------------------------------------------------------
    // Consequences, each beside the rule it follows from
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
      ls.floor(a, { x: 480, y: house.top(2), w: 456, h: 50, name: 'Platform for the console', items: ['draw()', 'play()', 'buttons()'], at: at(portability, 'writes'), how: 'slide', states: [{ at: at(portability, 'writes'), state: 'new' }] });
      ls.floor(a, { x: 480, y: house.top(3), w: 456, h: 50, name: 'Console drivers', items: ['Console GPU', 'Buttons', 'Speaker'], at: at(portability, 'drivers'), how: 'slide', states: [{ at: at(portability, 'drivers'), state: 'new' }] });
      ls.gameScreen(a, { x: 24, y: 24, w: 360, device: 'console', at: at(predict, 'console') });
      // The change request itself, so the question has its facts on screen.
      wall.listCard(a, {
        x: 24, y: 196, w: 360, title: 'The publisher’s request', text: 'Pearl Dash on our handheld console, by spring', iconName: 'envelope',
        at: at(predict, 'request'), until: begin(portability) + 0.2,
        items: [{ text: 'Different graphics chip', at: at(predict, 'graphics') }, { text: 'Buttons, not a keyboard', at: at(predict, 'buttons') }, { text: 'Different sound system', at: at(predict, 'sound') }],
      });
      [0, 1, 2, 3].forEach((i) => wall.slot(a, { x: 396, y: house.top(i), w: 44, h: 50, text: '?', at: at(predict, 'predict') + i * 0.1, until: begin(portability) + 0.2 }));
      rule(a, 2, { x: 24, y: 262, w: 380, at: begin(portability) + 0.3 });
      arch.quality(a, { x: 24, y: 326, w: 300, name: 'Portability', at: at(portability, 'portability') });
      arch.tag(a, { x: 24, y: 400, text: 'Same interface: draw(), play(), buttons()', at: at(portability, 'interface') });
      stamp(a, 'Unchanged', { x: 60, y: 446, at: at(portability, 'unaffected'), color: 'green', rotate: -4, small: true });

      const modify = 'port/modify_reuse';
      const b = picture(modify);
      uml.frame(b, { view: 'module', x: 8, y: 6, w: 944, h: 344, key: [['package', 'layer'], ['module', 'module'], ['dependency', 'may use']], at: begin(modify) + 0.05 });
      ls.floor(b, { x: 40, y: 82, w: 400, h: 50, name: 'Pearl Dash rules', items: ['Squirrel', 'Pearls'], at: begin(modify) + 0.1 });
      ls.floor(b, { x: 520, y: 82, w: 400, h: 50, name: 'Skateboard racer rules', items: ['Board', 'Laps'], at: at(modify, 'skateboard'), how: 'slide', states: [{ at: at(modify, 'skateboard'), state: 'new' }] });
      ls.floor(b, { x: 40, y: 182, w: 880, h: 50, name: 'Engine', items: ['Faster physics', 'Collisions', 'Scene drawing'], at: begin(modify) + 0.2, states: [{ at: at(modify, 'replacing'), state: 'changed' }] });
      ls.floor(b, { x: 40, y: 282, w: 880, h: 50, name: 'Platform', items: ['Graphics', 'Sound', 'Input'], at: begin(modify) + 0.3 });
      uml.connector(b, { from: [360, 132], to: [360, 182], kind: 'dependency', at: begin(modify) + 0.3 });
      uml.connector(b, { from: [840, 132], to: [840, 182], kind: 'dependency', at: at(modify, 'skateboard') + 0.3 });
      uml.connector(b, { from: [600, 232], to: [600, 282], kind: 'dependency', at: begin(modify) + 0.35 });
      rule(b, 2, { x: 24, y: 366, w: 260, at: begin(modify) + 0.3 });
      arch.quality(b, { x: 300, y: 366, w: 300, name: 'Modifiability', at: at(modify, 'modifiability') });
      arch.tag(b, { x: 24, y: 442, text: 'Never up', tone: 'red', at: at(modify, 'never') });
      arch.quality(b, { x: 300, y: 432, w: 300, name: 'Reusability', at: at(modify, 'reusability') });
      wall.note(b, { x: 660, y: 380, w: 276, text: 'The lower the layer, the more programs share it', tone: 'cyan', tilt: -1, at: at(modify, 'unchanged') });

      const everyday = 'port/everyday';
      const c = picture(everyday);
      const stackHouse = ls.building(c, {
        x: 420, y: 54, w: 516, h: 50, gap: 8, at: at(everyday, 'stack'), step: 0.2,
        floors: [
          { name: 'Application', items: ['Chat protocol', 'HTTP'] }, { name: 'Transport', items: ['TCP'] },
          { name: 'Internet', items: ['IP'] }, { name: 'Link', items: ['Wi-Fi'], until: at(everyday, 'cable') },
        ],
      });
      uml.frame(c, { view: 'module', title: 'network stack', x: 388, y: 10, w: 564, h: 448, key: KEY_LAYERS, keyAt: 'bottom', at: at(everyday, 'stack') - 0.2 });
      ['Cable', 'Cellular'].forEach((name, i) => {
        const word = ['cable', 'cellular'][i];
        ls.floor(c, { x: 420, y: stackHouse.top(3), w: 516, h: 50, name: 'Link', items: [name], at: at(everyday, word), until: i === 0 ? at(everyday, 'cellular') : undefined, how: 'slide', states: [{ at: at(everyday, word), state: 'new' }] });
      });
      arch.card(c, { x: 24, y: 60, w: 320, title: 'Chat app', sub: 'Same code on any link', iconName: 'chat', at: at(everyday, 'chat') });
      arch.token(c, { kind: 'event', path: [[404, 110], [404, stackHouse.mid(3)]], at: at(everyday, 'descends'), duration: 2.2 });
      arch.tag(c, { x: 24, y: 360, text: 'Only the bottom layer differs', tone: 'gold', at: at(everyday, 'differs') });
      arch.tag(c, { x: 24, y: 410, text: 'Layers use only the interface below', at: at(everyday, 'interface') });

      const teamTest = 'port/team_test';
      const d = picture(teamTest);
      const house4 = pearlDash(d, { at: begin(teamTest) + 0.1, step: 0.05 });
      // Each team's card is level with the layer it works in, from the layer's tab to the foot of its body.
      [['Gameplay', 'gamepad', 0, 'gameplay'], ['Engine team', 'gear', 1, 'engine'], ['Sound', 'chip', 2, 'sound']].forEach(([role, iconName, i, word]) => {
        arch.card(d, { x: 200, y: house4.top(i) - house4.tab, w: 232, h: house4.tab + house4.h, title: role, iconName, at: at(teamTest, word) });
      });
      arch.readout(d, { x: 24, y: 346, w: 408, label: 'Game rules on a fake engine', iconName: 'check', at: at(teamTest, 'tested'), values: [{ at: -1, text: 'Test passed, no console', state: 'ok' }] });
      // Side by side, one height, though only one name wraps.
      arch.quality(d, { x: 24, y: 432, w: 199, h: 88, name: 'Division of labor', at: at(teamTest, 'labor') });
      arch.quality(d, { x: 233, y: 432, w: 199, h: 88, name: 'Testability', at: at(teamTest, 'testability') });
    }

    // ----------------------------------------------------------------
    // Consequences: what the rules cost
    // ----------------------------------------------------------------

    function costs() {
      const overhead = 'costs/overhead';
      const a = picture(overhead);
      const house = pearlDash(a, { at: begin(overhead) + 0.1, step: 0.05 });
      ls.frameBar(a, {
        x: 24, y: 40, w: 400, at: at(overhead, 'sixteen'),
        steps: [{ at: -1, ms: 12.5 }, { at: at(overhead, 'crosses'), ms: 15.8 }, { at: at(overhead, 'storm'), ms: 21.3 }],
      });
      [0, 1, 2, 3, 4].forEach((i) => arch.token(a, { kind: 'event', path: [[house.x - 18, house.mid(0)], [house.x - 18, house.mid(3)]], at: at(overhead, 'crosses') + i * 0.6, duration: 1.6, until: at(overhead, 'crosses') + i * 0.6 + 1.6 }));
      rule(a, 2, { x: 24, y: 220, w: 380, at: begin(overhead) + 0.4 });
      arch.tag(a, { x: 24, y: 290, text: 'Every request crosses all four layers', tone: 'gold', at: at(overhead, 'crosses') });
      arch.tag(a, { x: 24, y: 336, text: 'Each layer translates and copies', tone: 'gold', at: at(overhead, 'translates') });
      arch.quality(a, { x: 24, y: 400, w: 330, name: 'Performance', effect: 'inhibited', at: at(overhead, 'drops') });

      const bridge = 'costs/bridge';
      const b = picture(bridge);
      const house2 = pearlDash(b, { at: begin(bridge) + 0.1, step: 0.05, key: [['package', 'layer'], ['banned', 'bridge']] });
      useArrow(b, house2, 0, 3, { side: 'left', tone: 'red', at: at(bridge, 'bypasses') });
      rule(b, 2, { x: 24, y: 24, w: 380, at: begin(bridge) + 0.2, crackAt: at(bridge, 'bends') });
      arch.tag(b, { x: 24, y: 96, text: 'Bridge: pearl drawing → laptop driver', tone: 'red', at: at(bridge, 'bypasses') + 0.2 });
      ls.frameBar(b, {
        x: 24, y: 150, w: 400, at: begin(bridge) + 0.2,
        steps: [{ at: -1, ms: 21.3 }, { at: at(bridge, 'recovers'), ms: 15.1 }],
      });
      arch.card(b, { x: 24, y: 290, w: 400, title: 'On the console', sub: 'Bridge breaks: rewrite it', iconName: 'gamepad', at: at(bridge, 'console'), states: [{ at: at(bridge, 'rewritten'), state: 'changed', sub: 'Bridge breaks: rewrite it' }] });
      arch.quality(b, { x: 24, y: 384, w: 280, name: 'Performance', at: at(bridge, 'trades') + 0.2 });
      arch.quality(b, { x: 24, y: 456, w: 280, name: 'Portability', effect: 'inhibited', at: at(bridge, 'trades') });

      const upfront = 'costs/upfront';
      const c = picture(upfront);
      // The cost in design effort against the qualities it pays for; the payoff side sinks.
      arch.tradeoff(c, {
        x: 480, y: 130, beam: 520, h: 220, at: begin(upfront) + 0.1,
        pans: [
          {
            w: 330, title: 'Up-front cost', effect: 'inhibited', at: at(upfront, 'cost'),
            items: [{ name: 'Choose the levels', at: at(upfront, 'levels') }, { name: 'Design each interface', at: at(upfront, 'interface') }, { name: 'Enforce the rules', at: at(upfront, 'enforce') }],
          },
          {
            w: 330, title: 'Payoff', effect: 'promoted', at: at(upfront, 'game'),
            items: [{ name: 'Portability', why: 'Two devices, one game', at: at(upfront, 'devices') }, { name: 'Modifiability', why: 'Years of changes', at: at(upfront, 'years') }],
          },
        ],
        tilts: [{ at: at(upfront, 'investment'), angle: 10 }],
      });
      wall.note(c, { x: 30, y: 20, w: 300, text: 'Weekend jam: one file is fine', tone: 'cyan', tilt: -2, at: at(upfront, 'weekend') });
    }

    function leaks() {
      const leak = 'leaks/leak';
      const a = picture(leak);
      pearlDash(a, {
        at: begin(leak) + 0.1, step: 0.05,
        floors: [PEARL_DASH[0], PEARL_DASH[1], { name: 'Platform for the console', items: ['draw()', 'play()', 'buttons()'], states: [{ at: at(leak, 'slowly'), state: 'changed' }] }, { name: 'Console drivers', items: ['Console GPU', 'Buttons', 'Speaker'] }],
      });
      ls.gameScreen(a, {
        x: 24, y: 24, w: 400, device: 'console', at: begin(leak) + 0.2,
        fps: [{ at: -1, text: '60 fps' }, { at: at(leak, 'stutters'), text: '38 fps', state: 'bad' }],
      });
      arch.readout(a, { x: 24, y: 290, w: 400, label: '500 small images', iconName: 'timer', at: at(leak, 'many'), values: [{ at: -1, text: 'Drawn more slowly', state: 'warn' }] });
      sticker(a, 'Same interface, slower', { x: 24, y: 384, at: at(leak, 'interface2'), variant: 'red', iconName: 'warning' });

      const granularity = 'leaks/granularity';
      const b = picture(granularity);
      uml.frame(b, { view: 'module', x: 8, y: 6, w: 944, h: 448, key: [['package', 'layer']], at: at(granularity, 'few') - 0.4 });
      ls.building(b, { x: 30, y: 104, w: 300, h: 84, gap: 12, at: at(granularity, 'few'), step: 0.1, floors: [{ name: 'Game rules' }, { name: 'Engine and platform', tone: 'wide' }] });
      arch.tag(b, { x: 30, y: 52, text: 'Too few', tone: 'red', at: at(granularity, 'few') });
      ls.building(b, {
        x: 360, y: 96, w: 240, h: 28, gap: 4, thin: true, at: at(granularity, 'many'), step: 0.06,
        floors: ['Rules', 'Logic', 'Engine', 'Scene', 'Render', 'Platform', 'Bridge', 'Drivers'].map((name) => ({ name })),
      });
      arch.tag(b, { x: 360, y: 52, text: 'Too many', tone: 'red', at: at(granularity, 'many') });
      ls.building(b, {
        x: 640, y: 104, w: 290, h: 48, gap: 6, at: at(granularity, 'choose'), step: 0.1,
        floors: [{ name: 'Game rules', items: ['Gameplay ideas'] }, { name: 'Engine', items: ['Engine tech'] }, { name: 'Platform', items: ['Device APIs'] }, { name: 'Drivers', items: ['Hardware'] }],
      });
      arch.tag(b, { x: 640, y: 52, text: 'Just right', tone: 'green', at: at(granularity, 'choose') });
      wall.note(b, { x: 300, y: 462, w: 380, text: 'Split where things change for different reasons, at different speeds', tone: 'cyan', tilt: -1, at: at(granularity, 'reasons') });
    }


    // ----------------------------------------------------------------
    // In practice: real layered systems from many domains
    // ----------------------------------------------------------------

    /**
     * A real system as a small module view: its layers from the top down,
     * each drawn without its contents, in a frame titled with the system and
     * its domain; adjacency means "may use the layer below", as the key says.
     * `lit` marks the layer the cue is about; the rule that makes the style
     * fit is written underneath. Returns the stack's geometry.
     */
    function example(parent, { x, title, layers: names, lit = -1, why, whyTone = 'green', w = 412, indent = 24, key = KEY_EXAMPLE, at }) {
      uml.frame(parent, { view: 'module', title, x, y: 6, w: 460, h: 472, key, keyAt: 'bottom', at });
      const house = ls.building(parent, {
        x: x + indent, y: 50, w, h: 34, gap: 12, thin: true, at: at + 0.15, step: 0.12,
        floors: names.map((name, i) => ({ name, states: i === lit ? [{ at: at + 0.9, state: 'new' }] : [] })),
      });
      if (why) arch.tag(parent, { x: x + 16, y: 404, text: why, tone: whyTone, at: at + 0.9 });
      return house;
    }

    function inPractice() {
      const net = 'in_practice/network_phone';
      const a = picture(net);
      example(a, { x: 8, title: 'TCP/IP · networking', layers: ['Application: HTTP, DNS', 'Transport: TCP, UDP', 'Internet: IP', 'Link'], lit: 3, why: 'Apps reuse transports; links change below', at: at(net, 'message') - 0.4 });
      example(a, { x: 492, title: 'Android · phones', layers: ['Apps', 'Java API framework', 'Native libraries, runtime', 'Hardware abstraction layer', 'Linux kernel'], lit: 3, why: 'New chip: a new HAL module', at: at(net, 'android') });

      const browser = 'in_practice/browser_database';
      const b = picture(browser);
      // The rejected upward include runs outside the stack on the right, struck through; the note
      // on how content still reaches up leads around the stack's left side.
      const chrome = example(b, {
        x: 8, title: 'Chrome · browsers', layers: ['chrome: browser features', 'content: web platform', 'Blink and lower libraries'],
        w: 316, indent: 44, key: [['package', 'layer'], ['banned', 'may not use']], why: 'A build check rejects upward includes', whyTone: 'red', at: at(browser, 'chromes') - 0.4,
      });
      useArrow(b, chrome, 1, 0, { outside: true, side: 'right', lane: 1, tone: 'red', at: at(browser, 'upward') });
      arch.cross(b, { x: chrome.x + chrome.w + 28, y: (chrome.mid(0) + chrome.mid(1)) / 2, size: 28, at: at(browser, 'rejects') });
      const noteY = chrome.bottom(2) + 30;
      uml.callout(b, {
        x: chrome.x - 8, y: noteY, w: 364, text: 'Up only via content’s interfaces', at: at(browser, 'interfaces'),
        via: [[chrome.x - 22, noteY + 18], [chrome.x - 22, chrome.mid(1)]], to: [chrome.x, chrome.mid(1)],
      });
      example(b, { x: 492, title: 'SQLite · databases', layers: ['Interface', 'SQL compiler', 'Virtual machine', 'B-tree', 'Pager', 'OS interface (VFS)'], lit: 5, why: 'Swap the bottom to port, or to test', at: at(browser, 'sqlite') });

      const car = 'in_practice/car_spacecraft';
      const c = picture(car);
      const autosar = example(c, { x: 8, title: 'AUTOSAR · cars', layers: ['Application components', 'Runtime environment', 'Services', 'ECU abstraction', 'Microcontroller abstraction'], lit: 4, why: 'Never bypass the microcontroller layer', whyTone: 'red', at: at(car, 'autosar') - 0.4 });
      uml.callout(c, { x: 130, y: 352, w: 310, text: 'Exception: complex drivers', to: [autosar.x + autosar.w - 30, autosar.bottom(4)], at: at(car, 'complex') });
      example(c, { x: 492, title: 'NASA · spacecraft', layers: ['Apps', 'core Flight Executive', 'OS and platform abstraction', 'Real-time OS and board'], lit: 2, why: 'Same apps on a desktop and in orbit', at: at(car, 'nasas') });

      const thread = 'in_practice/common_thread';
      const d = picture(thread);
      rule(d, 2, { full: true, x: 24, y: 20, w: 600, at: begin(thread) + 0.3 });
      wall.listCard(d, {
        x: 24, y: 140, w: 512, title: 'Change stays below the interface', iconName: 'stack', at: at(thread, 'interface'),
        items: [{ text: 'Internet: the link layer' }, { text: 'Android: the hardware abstraction layer' }, { text: 'SQLite: the OS interface' }, { text: 'NASA: the platform layer' }],
      });
      // Rule 2 as these systems keep it: never up, but skipping down, or documented exceptions.
      wall.listCard(d, {
        x: 560, y: 140, w: 376, title: 'Relaxed in practice', iconName: 'link', at: at(thread, 'relax'),
        items: [
          { text: 'Chromium, SQLite: skip down', at: at(thread, 'skip') },
          { text: 'AUTOSAR: complex drivers', at: at(thread, 'autosar') },
          { text: 'Android: native code', at: at(thread, 'android') },
          { text: 'NASA: apps call the OS layer', at: at(thread, 'nasa') },
        ],
      });
    }

    // ----------------------------------------------------------------
    // Summary
    // ----------------------------------------------------------------

    function summary() {
      const problem = 'summary/recap_problem';
      const a = picture(problem);
      ls.mudBall(a, { x: 30, y: 50, size: 320, at: begin(problem) + 0.1, drawAt: begin(problem) + 0.2 });
      arch.cross(a, { x: 190, y: 210, size: 90, at: at(problem, 'layering') });
      const house = pearlDash(a, { at: at(problem, 'layering'), step: 0.2 });
      arch.token(a, { kind: 'event', path: [[house.x - 18, house.mid(0)], [house.x - 18, house.mid(3)]], at: at(problem, 'virtual'), duration: 1.6 });
      arch.tag(a, { x: 30, y: 420, text: 'Ball of mud: rewrite to port', tone: 'red', at: at(problem, 'rewriting') });

      const rules = 'summary/recap_rules';
      const b = picture(rules);
      [[1, 'exactly'], [2, 'below'], [3, 'above']].forEach(([n, word], i) => {
        rule(b, n, { full: true, x: 24, y: 14 + i * 104, w: 560, at: at(rules, word) - 0.6 });
      });
      sticker(b, 'Never up', { x: 640, y: 40, at: at(rules, 'nothing'), variant: 'red', iconName: 'arrowUp' });
      ls.socket(b, { x: 24, y: 340, w: 400, name: 'CollisionListener', text: 'news goes up by callback', at: at(rules, 'callbacks') });
      wall.note(b, { x: 620, y: 320, w: 316, text: 'Layers: code, a module view. Tiers: running components.', tone: 'cyan', tilt: -1, at: at(rules, 'tiers') });

      // Each quality arrives as the narration names it, with the rule it follows from and why.
      const tradeoff = 'summary/recap_tradeoff';
      const costs = 'summary/recap_costs';
      const c = picture(tradeoff, costs);
      arch.tradeoff(c, {
        x: 480, y: 76, beam: 480, h: 330, at: begin(tradeoff) + 0.1,
        pans: [
          {
            w: 440, title: 'Promoted', at: begin(tradeoff) + 0.2,
            items: [
              { name: 'Portability', rule: 'Rule 2', why: 'A new platform changes only the bottom layers', at: at(tradeoff, 'portability') },
              { name: 'Modifiability', rule: 'Rule 2', why: 'A change stays behind a layer’s interface', at: at(tradeoff, 'modifiability') },
              { name: 'Reusability', rule: 'Rule 2', why: 'Lower layers never depend on upper ones', at: at(tradeoff, 'reusability') },
            ],
          },
          {
            w: 440, title: 'Inhibited', effect: 'inhibited', at: begin(costs) + 0.1,
            items: [
              { name: 'Performance', rule: 'Rule 2', why: 'Every request crosses every layer', at: at(costs, 'performance') },
              { name: 'Up-front cost', why: 'Levels and interfaces come before features', at: at(costs, 'front') },
            ],
          },
        ],
      });
      arch.tag(c, { x: 270, y: 14, text: 'A bridge: performance back, portability lost', tone: 'red', at: at(costs, 'bridge') });
      sticker(c, 'Is that import from the next lower layer?', { x: 300, y: 480, at: at(costs, 'import'), variant: 'gold', iconName: 'question' });
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
    inPractice();
    summary();
  };
})();
