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
 * dependency arrow; a documented exception (a layer bridge) is an amber
 * dashed arrow labeled «bridge», and a forbidden use a red one struck by a
 * cross; tiers are dashed boundaries over running components. Every line is
 * straight: an arrow that skips a layer runs down its own lane beside the
 * shorter layers it passes. A rule of the style is a numbered rule card that
 * arrives as the narrator names it; Rule 2 has two named parts, never up and
 * next lower layer. Only a rule's definition cards (where the rules are
 * defined, and the recap that restates them) carry its number; every later
 * card, chip, tag, and note names the rule or part it means. Every consequence is a quality card that says Promoted or Inhibited
 * in words, beside the rule it follows from; a benefit or a cost that is not
 * a quality is a note or a card of its own. Stamps never shake the stage,
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
    costs: { kind: 'Inhibits', name: 'Performance', iconName: 'timer' },
    leaks: { kind: 'Trade-off', name: 'When layers leak', iconName: 'warning' },
    in_practice: { kind: 'In practice', name: 'Real-world examples', iconName: 'globe' },
    summary: { kind: 'Recap', name: 'Down, never up', iconName: 'check' },
  };
  /**
   * Headings for cues whose subject is not their scene's: a prediction keeps
   * a neutral heading until its answer, and a cost that is not a quality is
   * named as a trade-off.
   */
  const HEADINGS = {
    console: { kind: 'Example', name: 'Back to the console request', iconName: 'gamepad' },
    bridge: { kind: 'Trade-off', name: 'Bridging a layer', iconName: 'link' },
    upfront: { kind: 'Trade-off', name: 'Up-front cost and payoff', iconName: 'timer' },
  };

  /**
   * The style's rules, as their cards name them. Rule 2 has two named parts:
   * never up, which no layering relaxes, and next lower layer, which relaxed
   * layering widens to any lower layer.
   */
  const RULE_ONE = { n: 1, name: 'Exactly one layer', text: 'Every module belongs to one layer.' };
  const RULE_THREE = { n: 3, name: 'At least two layers', text: 'Usually three or more.' };
  const NEVER_UP = { n: 2, name: 'Never up', aside: 'the golden rule', text: 'No layer uses a layer above.' };
  const NEXT_LOWER = { n: 2, name: 'Next lower layer', text: 'Your own layer or the one below.' };
  const NEXT_LOWER_RELAXED = { ...NEXT_LOWER, text: 'Your own layer or the one below. If relaxed, any lower layer.' };

  /** Pearl Dash's four layers, from the top down. */
  const PEARL_DASH = [
    { name: 'Game rules', items: ['Squirrel', 'Pearls', 'Score', 'Levels'] },
    { name: 'Engine', items: ['Physics', 'Collisions', 'Scene drawing'] },
    { name: 'Platform', items: ['Graphics', 'Sound', 'Input'] },
    { name: 'Drivers', items: ['Graphics chip', 'Keyboard', 'Sound card'] },
  ];
  /** The keys of the module views. */
  const KEY_LAYERS = [['package', 'layer'], ['module', 'module']];
  const KEY_EXAMPLE = [['package', 'layer, may use lower layers']];
  /** The width of a thin layer's blank tab (css/video-narration-uml-kit.css). */
  const BLANK_TAB_W = 44;

  /** The stage's line id for each cue ('scene/cue' to 'scene-n'), from the storyboard. */
  function lineIds() {
    const story = JSON.parse(document.getElementById('narration-storyboard').textContent);
    const ids = {};
    story.scenes.forEach((scene) => scene.cues.forEach((cue, i) => { ids[`${scene.id}/${cue.id}`] = `${scene.id}-${i + 1}`; }));
    return ids;
  }

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.layered_style = function choreograph({ song, kit, layers }) {
    const { fx } = window.Timeline;
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

    /**
     * One picture from the start of cue `from` to the end of cue `to`, headed
     * by its scene's topic, or by `headings` in turn (each after the first
     * from its `at`).
     */
    function picture(from, to = from, headings = [TOPICS[from.split('/')[0]]]) {
      const node = kit.scene(content, begin(from), end(to), { exit: 'fade' });
      headings.forEach((heading, i) => {
        const tag = wall.topicTag(node, { ...heading, at: i === 0 ? begin(from) + 0.15 : heading.at });
        if (headings[i + 1]) fx.fadeOut(tag, headings[i + 1].at - 0.3, 0.3);
      });
      return wall.body(node);
    }
    const sticker = (parent, text, options) => kit.sticker(parent, text, { rotate: -3, ...options });
    const stamp = (parent, text, options) => kit.stamp(parent, text, { shake: false, from: 1.8, ...options });
    /** A rule's own definition card, with its number; `full` adds its one-line statement. */
    const rule = (parent, spec, { full = false, ...options }) => arch.rule(parent, { n: spec.n, name: spec.name, text: full ? spec.text : undefined, ...options });
    /**
     * A card that refers back to a rule, or to one named part of Rule 2, by
     * its name alone: only a rule's definition card carries its number.
     */
    const ruleRef = (parent, spec, { full = false, ...options }) => arch.rule(parent, { name: spec.name, text: full ? spec.text : undefined, ...options });
    /** Rule 2 in its two named parts; card.parts[0] is never up, card.parts[1] next lower layer. */
    const ruleTwo = (parent, { relaxed = false, ...options }) => arch.rule(parent, { n: 2, parts: [NEVER_UP, relaxed ? NEXT_LOWER_RELAXED : NEXT_LOWER], ...options });

    /**
     * Pearl Dash's layers at the standard place on the right, in a module
     * view frame whose key sits at its bottom: bodies at 86, 176, 266, 356.
     */
    function pearlDash(parent, { x = 480, y = 54, w = 456, h = 50, gap = 8, at: when, floors = PEARL_DASH, step = 0.15, key = KEY_LAYERS, frameAt } = {}) {
      uml.frame(parent, { view: 'module', x: x - 32, y: y - 44, w: w + 46, h: 448, key, keyAt: 'bottom', at: frameAt ?? when - 0.1 });
      return ls.building(parent, { x, y, w, h, gap, at: when, step, floors });
    }
    /** The middle of the gap between layer i's body and layer i + 1's. */
    const gapMid = (house, i) => (house.bottom(i) + house.top(i + 1)) / 2;
    /**
     * An allowed-to-use dependency between neighboring layers, straight
     * through the gap between them at `x` (by default `lane` steps left of
     * the stack's right end).
     */
    function useArrow(parent, house, from, to, { x, lane = 0, kind = 'dependency', ...options }) {
      const across = x ?? house.x + house.w - 70 - lane * 90;
      const [upper, lower] = from < to ? [from, to] : [to, from];
      const ends = [house.bottom(upper), house.top(lower)];
      const points = from < to ? [[across, ends[0]], [across, ends[1]]] : [[across, ends[1]], [across, ends[0]]];
      return uml.connector(parent, { points, kind, ...options });
    }
    /**
     * A dependency that skips layers, straight down the lane at `x` beside
     * the shorter layers it passes, from the bottom of layer `from` to the
     * top of layer `to`, or to its tab where the lane meets a thin layer's tab.
     */
    function skipArrow(parent, house, from, to, { x, kind = 'dependency', ...options }) {
      const onTab = house.tab === uml.BLANK_TAB && x < house.left(to) + BLANK_TAB_W;
      const target = house.top(to) - (onTab ? house.tab : 0);
      return uml.connector(parent, { points: [[x, house.bottom(from)], [x, target]], kind, ...options });
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
    // strictness, and tiers
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
      const requests = [['jump()', 'jump'], ['push(squirrel, up)', 'push'], ['draw(sprite, x, y)', 'draw'], ['3 chip commands', 'commands']];
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
      // Lower layers and wider gaps than elsewhere, so an arrow between two layers has room to be struck out.
      const house = pearlDash(a, { h: 44, gap: 20, at: begin(uses) + 0.1, step: 0.05, key: [['package', 'layer'], ['dependency', 'may use'], ['forbidden', 'may not use']] });
      const downX = house.x + house.w - 36;
      [0, 1, 2].forEach((i) => useArrow(a, house, i, i + 1, { x: downX, at: at(uses, 'dashed') + i * 0.15 }));
      // The relation's type, named once where it first appears, beside its arrow, clear of the next layer's tab.
      uml.label(a, { x: downX - 10 - 186, y: gapMid(house, 1) - 13, text: 'allowed to use', at: at(uses, 'dashed') + 0.6 });
      wall.listCard(a, { x: 24, y: 60, w: 410, title: 'Allowed to use', text: 'Which layers may use which: each dashed arrow.', iconName: 'arrowDown', at: at(uses, 'allowed'), until: begin(rules) + 0.2 });
      wall.listCard(a, { x: 24, y: 236, w: 410, title: 'A uses B', text: 'A is correct only if B is present and correct.', iconName: 'link', at: at(uses, 'module'), until: begin(rules) + 0.2 });

      // The three rules arrive as the narrator names them and stay up through the prediction and its
      // answer; a note says what the books call them.
      const one = rule(a, RULE_ONE, { full: true, x: 24, y: 6, w: 410, at: at(rules, 'exactly') - 0.3 });
      const two = ruleTwo(a, { x: 24, y: 93, w: 410, at: at(rules, 'never') - 0.3 });
      rule(a, RULE_THREE, { full: true, x: 24, y: 284, w: 410, at: at(rules, 'least') - 0.3 });
      // The lesson's word for what architects call constraints, said once where the rules first appear.
      arch.tag(a, { x: 24, y: 380, text: 'These rules are the style’s constraints', tone: 'gold', at: at(rules, 'rules'), until: begin(why) });

      // Each reason lights the rule it explains, in the order of the cards.
      wall.lit(one, [[at(why, 'exactly'), at(why, 'never')]]);
      wall.lit(two.parts[0], [[at(why, 'never'), at(why, 'next')], [at(cost, 'violates'), end(cost)]]);
      wall.lit(two.parts[1], [[at(why, 'next'), end(why)]]);
      wall.listCard(a, {
        x: 24, y: 371, w: 410, title: 'Why these rules?', at: begin(why) + 0.2, until: end(why),
        items: [
          { text: 'A module on four levels fits no rule', at: at(why, 'apply') },
          { text: 'Lower layers serve any program', at: at(why, 'reuse') },
          { text: 'Changes hide behind the interface', at: at(why, 'hidden') },
        ],
      });

      // The proposed import: a red dependency up through the first gap, its type beside it.
      const upX = house.x + house.w - 250;
      kit.sticker(a, 'Collision!', { x: 24, y: 374, at: at(predict, 'touched'), until: end(predict), variant: 'gold', iconName: 'sparkle', rotate: 4 });
      useArrow(a, house, 1, 0, { x: upX, tone: 'red', at: at(predict, 'import') });
      uml.label(a, { x: upX + 24, y: gapMid(house, 0) - 13, text: 'use', tone: 'red', at: at(predict, 'import') + 0.2 });
      arch.tag(a, { x: 24, y: 428, text: 'Engine imports score.py?', tone: 'red', at: at(predict, 'import'), until: begin(cost) + 0.2 });
      wall.slot(a, { x: 24, y: 474, w: 300, h: 50, text: 'Allowed?', at: at(predict, 'predict'), until: begin(cost) + 0.2 });

      // The answer: never up forbids it, so the arrow is struck out; what it would have cost.
      arch.cross(a, { x: upX, y: gapMid(house, 0) + 6, size: 28, at: at(cost, 'violates') }).classList.add('ls-cross');
      sticker(a, 'A cycle', { x: 24, y: 374, at: at(cost, 'cycle'), variant: 'red', iconName: 'loop' });
      arch.tag(a, { x: 24, y: 430, text: 'Each depends on the other', tone: 'red', at: at(cost, 'cycle') + 0.2 });
      arch.tag(a, { x: 24, y: 480, text: 'Second game: can’t reuse it', tone: 'red', at: at(cost, 'reuse') });
    }

    function callbacks() {
      const callback = 'callbacks/callback';
      const notUses = 'callbacks/not_uses';
      const a = picture(callback, notUses);
      // A module view with the two layers that matter opened up: the game's handler class inside Game
      // rules; the engine's interface and the Engine class that calls it inside Engine. Platform and
      // Drivers stay closed below, one under the other, as vertical order is the relation.
      uml.frame(a, { view: 'module', x: 8, y: 6, w: 944, h: 470, key: [['package', 'layer'], ['interface', 'class'], ['realize', 'implements'], ['control', 'call'], ['association', 'association']], at: begin(callback) + 0.05 });
      const x = 420;
      const w = 516;
      ls.floor(a, { x, y: 78, w, h: 94, name: 'Game rules', at: begin(callback) + 0.1 });
      ls.floor(a, { x, y: 248, w, h: 116, name: 'Engine', at: begin(callback) + 0.15 });
      ls.floor(a, { x, y: 384, w, h: 30, name: 'Platform', tone: 'thin', at: begin(callback) + 0.2 });
      ls.floor(a, { x, y: 434, w, h: 30, name: 'Drivers', tone: 'thin', at: begin(callback) + 0.25 });
      const handler = { x: 590, y: 83, w: 330, bottom: 166 };
      const contract = { x: 436, y: 253, w: 260 };
      const engine = { x: 740, y: 268, w: 180 };
      const realizeX = 620;
      const callX = 890;
      uml.classBox(a, { x: engine.x, y: engine.y, w: engine.w, name: 'Engine', lines: ['step()'], at: begin(callback) + 0.3 });
      uml.classBox(a, { x: contract.x, y: contract.y, w: contract.w, name: 'CollisionListener', stereotype: 'interface', lines: ['on_collision(a, b)'], at: at(callback, 'interface') });
      // The engine holds the listeners registered with it.
      uml.connector(a, { from: [engine.x, 308], to: [contract.x + contract.w, 308], kind: 'association', at: at(callback, 'interface') + 0.3 });
      uml.classBox(a, { x: handler.x, y: handler.y, w: handler.w, name: 'PearlHandler', lines: ['on_collision(a, b)'], at: at(callback, 'implementation') });
      uml.connector(a, { from: [realizeX, handler.bottom], to: [realizeX, contract.y], kind: 'realize', at: at(callback, 'registers') });
      uml.callout(a, { x: 24, y: 104, w: 330, text: 'The game registers a handler', to: [handler.x, 122], at: at(callback, 'registers') + 0.2 });
      uml.callout(a, { x: 24, y: 290, w: 360, text: 'The engine defines the interface', to: [contract.x, 308], at: at(callback, 'defines') });
      arch.readout(a, {
        x: 24, y: 210, w: 300, label: 'Pearl Dash', iconName: 'gamepad', at: at(callback, 'touches'),
        values: [{ at: -1, text: 'Score 1,240' }, { at: at(callback, 'invokes'), text: 'Score 1,250', state: 'ok' }],
      });
      // At run time the engine's step() calls up into whatever was registered.
      uml.connector(a, { from: [callX, engine.y], to: [callX, handler.bottom], kind: 'flow', tone: 'cyan', at: at(callback, 'invokes') - 0.2 });
      arch.token(a, { kind: 'event', path: [[callX, engine.y - 8], [callX, handler.bottom + 10]], at: at(callback, 'invokes'), duration: 0.6, until: at(callback, 'invokes') + 1.2 });

      // Each relation named on its own arrow, in the gap between the two layers.
      const labelY = (handler.bottom + 6 + 248 - 32) / 2 - 13;
      uml.label(a, { x: callX - 10 - 186, y: labelY, text: '«call» at run time', stereotype: false, at: at(notUses, 'control') });
      uml.label(a, { x: realizeX - 10 - 300, y: labelY, text: 'implements: the dependency', stereotype: false, at: at(notUses, 'dependency') });
      sticker(a, 'Two different relations', { x: 24, y: 400, at: at(notUses, 'relations'), variant: 'green', iconName: 'check' });
    }

    function relaxed() {
      const strictness = 'relaxed/strictness';
      const a = picture(strictness);
      const names = PEARL_DASH.map(({ name }) => ({ name }));
      const stackAt = (x, floors, when) => ls.building(a, { x, y: 104, w: 340, h: 46, gap: 12, thin: true, at: when, step: 0.08, floors });
      uml.frame(a, { view: 'module', title: 'strict layering', x: 8, y: 6, w: 452, h: 438, key: [['package', 'layer'], ['dependency', 'may use'], ['bridge', 'bridge']], keyAt: 'bottom', at: at(strictness, 'strict') - 0.3 });
      uml.frame(a, { view: 'module', title: 'relaxed layering', x: 500, y: 6, w: 452, h: 438, key: [['package', 'layer'], ['dependency', 'may use']], keyAt: 'bottom', at: at(strictness, 'relaxed') - 0.3 });
      // Strict: a shorter Engine leaves the lane its documented bridge runs down.
      const strict = stackAt(96, [names[0], { ...names[1], w: 170 }, names[2], names[3]], at(strictness, 'strict'));
      // Relaxed: offset layers leave a straight lane for every skip to any lower layer.
      const relax = stackAt(560, [names[0], { ...names[1], w: 160 }, { ...names[2], x: 610, w: 210 }, names[3]], at(strictness, 'relaxed'));
      arch.tag(a, { x: 24, y: 52, text: 'Only the layer directly below', at: at(strictness, 'directly') });
      arch.tag(a, { x: 516, y: 52, text: 'Any lower layer', at: at(strictness, 'any') });
      [0, 1, 2].forEach((i) => {
        useArrow(a, strict, i, i + 1, { x: 200, at: at(strictness, 'directly') + i * 0.1 });
        useArrow(a, relax, i, i + 1, { x: 670, at: at(strictness, 'relaxed') + 0.3 + i * 0.1 });
      });
      skipArrow(a, relax, 0, 2, { x: 780, at: at(strictness, 'any') });
      skipArrow(a, relax, 1, 3, { x: 585, at: at(strictness, 'any') + 0.15 });
      skipArrow(a, relax, 0, 3, { x: 870, at: at(strictness, 'any') + 0.3 });
      // A strict design's documented exception: an amber bridge, its type beside it.
      skipArrow(a, strict, 0, 2, { x: 410, tone: 'amber', at: at(strictness, 'platform') });
      uml.label(a, { x: 286, y: strict.mid(1) - 13, text: 'bridge', tone: 'amber', at: at(strictness, 'platform') + 0.2 });
      wall.note(a, { x: 24, y: 452, w: 396, text: 'Layer bridging: a documented exception', tone: 'cyan', tilt: -1, at: at(strictness, 'documented') });

      // Layers in a module view beside tiers in an allocation view: each tier a dashed boundary
      // around the machine whose running components it groups.
      const tiers = 'relaxed/tiers';
      const b = picture(tiers);
      uml.frame(b, { view: 'module', x: 8, y: 6, w: 236, h: 470, key: [['package', 'layer']], keyAt: 'bottom', at: at(tiers, 'layers2') - 0.4 });
      arch.tag(b, { x: 22, y: 52, text: 'Layers group code', at: at(tiers, 'module') });
      const code = ls.building(b, { x: 34, y: 100, w: 180, h: 46, gap: 12, thin: true, at: at(tiers, 'layers2'), step: 0.08, floors: names });
      uml.frame(b, { view: 'allocation', title: 'where components run', x: 268, y: 6, w: 684, h: 470, key: [['node', 'node'], ['component', 'component'], ['boundary', 'tier'], ['link', 'network']], keyAt: 'bottom', at: at(tiers, 'tier') - 0.6 });
      arch.tag(b, { x: 284, y: 52, text: 'Tiers group running components, by machine', at: at(tiers, 'tier') });
      uml.boundary(b, { x: 370, y: 100, w: 226, h: 280, name: 'Presentation', stereotype: 'tier', at: at(tiers, 'console') - 0.2 });
      uml.node(b, { x: 384, y: 152, w: 196, h: 210, name: 'Console', stereotype: 'device', at: at(tiers, 'console') });
      uml.component(b, { x: 396, y: 214, w: 172, name: 'Pearl Dash', lines: ['all four layers'], variant: 'compact', at: at(tiers, 'console') + 0.2 });
      // The layers' code runs together on the console.
      const runY = (code.bottom(1) + code.top(2)) / 2;
      arch.wire(b, { from: [code.x + code.w + 10, runY], to: [384, runY], tone: 'gold', at: at(tiers, 'console') + 0.3 });
      uml.label(b, { x: 280, y: runY - 34, text: 'run on', stereotype: false, at: at(tiers, 'console') + 0.5 });
      uml.boundary(b, { x: 736, y: 100, w: 204, h: 280, name: 'Logic', stereotype: 'tier', at: at(tiers, 'machine') - 0.2 });
      uml.node(b, { x: 750, y: 152, w: 172, h: 210, name: 'Server', stereotype: 'device', at: at(tiers, 'machine') });
      uml.component(b, { x: 760, y: 214, w: 152, name: 'Leaderboard', variant: 'compact', at: at(tiers, 'machine') + 0.2 });
      // The communication path joins the nodes' outer faces; its name sits just above it, between the tiers.
      uml.connector(b, { from: [592, 330], to: [750, 330], kind: 'link', at: at(tiers, 'machine') + 0.3 });
      uml.label(b, { x: 603, y: 298, text: 'network', at: at(tiers, 'machine') + 0.4 });
      arch.tag(b, { x: 284, y: 394, text: 'Talk within a tier or to the next', at: at(tiers, 'adjacent') });

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
      uml.frame(c, { view: 'cnc', fullName: true, x: 416, y: 6, w: 536, h: 470, key: [['component', 'component'], ['boundary', 'tier'], ['call', 'call']], keyAt: 'bottom', at: begin(threeTiers) + 0.1 });
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
      // The prediction keeps a neutral heading; the quality it promotes is named with the answer.
      const a = picture(predict, portability, [HEADINGS.console, { ...TOPICS.port, at: begin(portability) + 0.15 }]);
      const consoleFloors = [
        ...PEARL_DASH.slice(0, 2).map((spec) => ({ ...spec, states: [{ at: at(portability, 'rules'), state: 'same' }] })),
        { ...PEARL_DASH[2], until: at(portability, 'writes') },
        { ...PEARL_DASH[3], until: at(portability, 'drivers') },
      ];
      const house = pearlDash(a, { at: begin(predict) + 0.1, step: 0.05, floors: consoleFloors });
      // The console's layers keep the modules' names; their operations are the interface, written beside them.
      ls.floor(a, { x: 480, y: house.top(2), w: 456, h: 50, name: 'Platform for the console', items: PEARL_DASH[2].items, at: at(portability, 'writes'), how: 'slide', states: [{ at: at(portability, 'writes'), state: 'new' }] });
      ls.floor(a, { x: 480, y: house.top(3), w: 456, h: 50, name: 'Console drivers', items: ['Graphics chip', 'Buttons', 'Speaker'], at: at(portability, 'drivers'), how: 'slide', states: [{ at: at(portability, 'drivers'), state: 'new' }] });
      // The change request itself, so the question has its facts on screen.
      wall.listCard(a, {
        x: 24, y: 24, w: 380, title: 'The publisher’s request', text: 'Pearl Dash on our handheld console, by spring', iconName: 'envelope',
        at: at(predict, 'request'), until: begin(portability) + 0.2,
        items: [{ text: 'Different graphics chip', at: at(predict, 'graphics') }, { text: 'Buttons, not a keyboard', at: at(predict, 'buttons') }, { text: 'Different sound system', at: at(predict, 'sound') }],
      });
      ls.gameScreen(a, { x: 24, y: 340, w: 360, device: 'console', at: at(predict, 'console') });
      [0, 1, 2, 3].forEach((i) => wall.slot(a, { x: 396, y: house.top(i), w: 44, h: 50, text: '?', at: at(predict, 'predict') + i * 0.1, until: begin(portability) + 0.2 }));
      ruleRef(a, NEXT_LOWER, { x: 24, y: 24, w: 410, at: begin(portability) + 0.3 });
      arch.quality(a, { x: 24, y: 82, w: 200, name: 'Portability', at: at(portability, 'portability') });
      // The stamp judges the two green layers, so it sits beside them, between their rows.
      stamp(a, 'Unchanged', { x: 206, y: 158, at: at(portability, 'unaffected'), color: 'green', rotate: -4, small: true });
      wall.note(a, { x: 24, y: 252, w: 386, text: 'Same interface: draw(), play(), buttons()', tone: 'cyan', tilt: -1, at: at(portability, 'interface') });

      const modify = 'port/modify_reuse';
      const b = picture(modify);
      uml.frame(b, { view: 'module', x: 8, y: 6, w: 944, h: 344, key: [['package', 'layer'], ['module', 'module'], ['dependency', 'may use']], at: begin(modify) + 0.05 });
      ls.floor(b, { x: 40, y: 82, w: 400, h: 50, name: 'Pearl Dash rules', items: ['Squirrel', 'Pearls'], at: begin(modify) + 0.1 });
      ls.floor(b, { x: 520, y: 82, w: 400, h: 50, name: 'Skateboard racer rules', items: ['Board', 'Laps'], at: at(modify, 'skateboard'), how: 'slide', states: [{ at: at(modify, 'skateboard'), state: 'new' }] });
      // The engine gets new insides behind the same interface (yellow, as a replaced part; pink means inhibited).
      ls.floor(b, { x: 40, y: 182, w: 880, h: 50, name: 'Engine', items: ['Faster physics', 'Collisions', 'Scene drawing'], at: begin(modify) + 0.2, states: [{ at: at(modify, 'replacing'), state: 'new' }] });
      ls.floor(b, { x: 40, y: 282, w: 880, h: 50, name: 'Platform', items: ['Graphics', 'Sound', 'Input'], at: begin(modify) + 0.3 });
      uml.connector(b, { from: [360, 132], to: [360, 182], kind: 'dependency', at: begin(modify) + 0.3 });
      uml.connector(b, { from: [840, 132], to: [840, 182], kind: 'dependency', at: at(modify, 'skateboard') + 0.3 });
      uml.connector(b, { from: [600, 232], to: [600, 282], kind: 'dependency', at: begin(modify) + 0.35 });
      ruleRef(b, NEXT_LOWER, { x: 24, y: 366, w: 260, at: begin(modify) + 0.3 });
      arch.quality(b, { x: 300, y: 366, w: 300, name: 'Modifiability', at: at(modify, 'modifiability') });
      ruleRef(b, NEVER_UP, { x: 24, y: 446, w: 260, at: at(modify, 'never') });
      arch.quality(b, { x: 300, y: 446, w: 300, name: 'Reusability', at: at(modify, 'reusability') });
      wall.note(b, { x: 640, y: 368, w: 276, text: 'The lower the layer, the more programs share it', tone: 'cyan', tilt: -1, at: at(modify, 'unchanged') });

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
      // Each team's card is level with the layer it works in.
      [['Gameplay', 'gamepad', 0, 'gameplay'], ['Engine team', 'gear', 1, 'engine'], ['Sound', 'chip', 2, 'sound']].forEach(([role, iconName, i, word]) => {
        arch.card(d, { x: 232, y: house4.top(i) - 7, w: 200, title: role, iconName, at: at(teamTest, word) });
      });
      // Exactly one layer lets each team own its layer: a benefit, not a quality attribute.
      ruleRef(d, RULE_ONE, { x: 24, y: 8, w: 410, at: at(teamTest, 'labor') - 0.3 });
      wall.note(d, { x: 24, y: 120, w: 176, text: 'Benefit: division of labor', tone: 'green', tilt: -1, at: at(teamTest, 'labor') });
      arch.readout(d, { x: 24, y: 340, w: 408, label: 'Game rules on a fake engine', iconName: 'check', at: at(teamTest, 'tested'), values: [{ at: -1, text: 'Test passed, no console', state: 'ok' }] });
      // The game rules see only the engine's interface, so a fake engine can stand in for it.
      ruleRef(d, NEXT_LOWER, { x: 24, y: 406, w: 410, at: at(teamTest, 'testability') - 0.3 });
      arch.quality(d, { x: 24, y: 464, w: 260, name: 'Testability', at: at(teamTest, 'testability') });
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
      ruleRef(a, NEXT_LOWER, { x: 24, y: 220, w: 380, at: begin(overhead) + 0.4 });
      arch.tag(a, { x: 24, y: 290, text: 'Every request crosses all four layers', tone: 'gold', at: at(overhead, 'crosses') });
      arch.tag(a, { x: 24, y: 336, text: 'Each layer translates and copies', tone: 'gold', at: at(overhead, 'translates') });
      arch.quality(a, { x: 24, y: 400, w: 330, name: 'Performance', effect: 'inhibited', at: at(overhead, 'drops') });

      // The bridge runs straight down a lane beside the shorter Engine and Platform, in a bridge's amber.
      const bridge = 'costs/bridge';
      const b = picture(bridge, bridge, [HEADINGS.bridge]);
      const bridgeFloors = [PEARL_DASH[0], { ...PEARL_DASH[1], w: 432 }, { ...PEARL_DASH[2], w: 432 }, PEARL_DASH[3]];
      const house2 = pearlDash(b, { at: begin(bridge) + 0.1, step: 0.05, floors: bridgeFloors, key: [['package', 'layer'], ['bridge', 'bridge']] });
      const laneX = house2.x + house2.w - 12;
      skipArrow(b, house2, 0, 3, { x: laneX, tone: 'amber', at: at(bridge, 'bypasses') });
      uml.label(b, { x: laneX - 10 - 112, y: gapMid(house2, 0) - 13, text: 'bridge', tone: 'amber', at: at(bridge, 'bypasses') + 0.2 });
      ruleRef(b, NEXT_LOWER, { x: 24, y: 24, w: 380, at: begin(bridge) + 0.2, crackAt: at(bridge, 'bends') }).classList.add('ls-rule--edge-crack');
      arch.tag(b, { x: 24, y: 96, text: 'Bridge: pearl drawing → laptop driver', tone: 'amber', at: at(bridge, 'bypasses') + 0.2 });
      ls.frameBar(b, {
        x: 24, y: 150, w: 400, at: begin(bridge) + 0.2,
        steps: [{ at: -1, ms: 21.3 }, { at: at(bridge, 'recovers'), ms: 15.1 }],
      });
      arch.card(b, { x: 24, y: 290, w: 400, title: 'On the console', sub: 'Bridge breaks: rewrite it', iconName: 'gamepad', at: at(bridge, 'console'), states: [{ at: at(bridge, 'rewritten'), state: 'changed', sub: 'Bridge breaks: rewrite it' }] });
      arch.quality(b, { x: 24, y: 384, w: 280, name: 'Performance', at: at(bridge, 'trades') + 0.2 });
      arch.quality(b, { x: 24, y: 456, w: 280, name: 'Portability', effect: 'inhibited', at: at(bridge, 'trades') });

      // The cost in design effort against the qualities it pays for; the payoff side sinks.
      const upfront = 'costs/upfront';
      const c = picture(upfront, upfront, [HEADINGS.upfront]);
      arch.tradeoff(c, {
        x: 480, y: 130, beam: 520, h: 220, at: begin(upfront) + 0.1,
        pans: [
          {
            // A cost, not an inhibited quality: the pan keeps the cost side's color but drops the quality arrow.
            w: 330, title: 'Up-front cost', effect: 'inhibited', iconName: 'timer', at: at(upfront, 'cost'),
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
        floors: [PEARL_DASH[0], PEARL_DASH[1], { name: 'Platform for the console', items: PEARL_DASH[2].items, states: [{ at: at(leak, 'slowly'), state: 'changed' }] }, { name: 'Console drivers', items: ['Graphics chip', 'Buttons', 'Speaker'] }],
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
      ls.building(b, { x: 24, y: 104, w: 320, h: 84, gap: 12, at: at(granularity, 'few'), step: 0.1, floors: [{ name: 'Game rules' }, { name: 'Engine and platform', tone: 'wide' }] });
      arch.tag(b, { x: 24, y: 52, text: 'Too few', tone: 'red', at: at(granularity, 'few') });
      // Six layers, as the narration counts them, where four would do.
      ls.building(b, {
        x: 368, y: 100, w: 240, h: 34, gap: 8, thin: true, at: at(granularity, 'many'), step: 0.06,
        floors: ['Rules', 'Logic', 'Engine', 'Scene', 'Platform', 'Drivers'].map((name) => ({ name })),
      });
      arch.tag(b, { x: 368, y: 52, text: 'Too many', tone: 'red', at: at(granularity, 'many') });
      ls.building(b, {
        x: 632, y: 104, w: 300, h: 48, gap: 6, at: at(granularity, 'choose'), step: 0.1,
        floors: [{ name: 'Game rules', items: ['Gameplay ideas'] }, { name: 'Engine', items: ['Engine tech'] }, { name: 'Platform', items: ['Device APIs'] }, { name: 'Drivers', items: ['Hardware'] }],
      });
      arch.tag(b, { x: 632, y: 52, text: 'Just right', tone: 'green', at: at(granularity, 'choose') });
      wall.note(b, { x: 24, y: 462, w: 380, text: 'Split where things change for different reasons, at different speeds', tone: 'cyan', tilt: -1, at: at(granularity, 'reasons') });
    }


    // ----------------------------------------------------------------
    // In practice: real layered systems from many domains
    // ----------------------------------------------------------------

    /**
     * A real system as a small module view: its «layer» packages from the top
     * down, each drawn without its contents, in a frame titled with the
     * system and its domain; adjacency means a layer may use lower layers, as
     * the key says. `lit` marks the layer the cue is about; the rule that
     * makes the style fit is written underneath. Returns the stack's geometry.
     */
    function example(parent, { x, title, layers: names, lit = -1, why, whyTone = 'green', w = 430, indent = 14, gap = 12, key = KEY_EXAMPLE, at }) {
      uml.frame(parent, { view: 'module', title, x, y: 6, w: 460, h: 472, key, keyAt: 'bottom', at });
      const house = ls.building(parent, {
        x: x + indent, y: 50, w, h: 34, gap, slim: true, at: at + 0.15, step: 0.12,
        floors: names.map((name, i) => ({ name, states: i === lit ? [{ at: at + 0.9, state: 'new' }] : [] })),
      });
      if (why) arch.tag(parent, { x: x + 16, y: 404, text: why, tone: whyTone, at: at + 0.9 });
      return house;
    }

    function inPractice() {
      const net = 'in_practice/network_phone';
      const a = picture(net);
      example(a, { x: 8, title: 'TCP/IP · networking', layers: ['Application: HTTP, DNS', 'Transport: TCP, UDP', 'Internet: IP', 'Link'], lit: 3, why: 'Apps reuse transports; links change below', at: at(net, 'message') - 0.4 });
      example(a, { x: 492, title: 'Android · phones', layers: ['Apps', 'Java API framework', 'Native libraries, runtime', 'Hardware abstraction layer', 'Linux kernel'], lit: 3, why: 'New chip: a new hardware module', at: at(net, 'android') });

      const browser = 'in_practice/browser_database';
      const b = picture(browser);
      // The rejected upward include runs straight up through the gap between content and chrome, struck
      // out; how content does reach up is written underneath, naming the layer it is about.
      const chrome = example(b, {
        x: 8, title: 'Chrome · browsers', layers: ['chrome: browser features', 'content: web platform', 'Blink and lower libraries'], gap: 56,
        key: [['package', 'layer'], ['forbidden', 'may not use']], why: 'A build check rejects upward includes', whyTone: 'red', at: at(browser, 'chromes') - 0.4,
      });
      const upX = chrome.x + chrome.w - 80;
      useArrow(b, chrome, 1, 0, { x: upX, tone: 'red', at: at(browser, 'upward') });
      arch.cross(b, { x: upX, y: gapMid(chrome, 0) + 8, size: 30, at: at(browser, 'rejects') }).classList.add('ls-cross');
      arch.tag(b, { x: 24, y: 354, text: 'content reports up only via its interfaces', at: at(browser, 'interfaces') });
      example(b, { x: 492, title: 'SQLite · databases', layers: ['Interface', 'SQL compiler', 'Virtual machine', 'B-tree', 'Pager', 'OS interface (VFS)'], lit: 5, why: 'Swap the bottom to port, or to test', at: at(browser, 'sqlite') });

      const car = 'in_practice/car_spacecraft';
      const c = picture(car);
      const autosar = example(c, { x: 8, title: 'AUTOSAR · cars', layers: ['Application components', 'Runtime environment', 'Services', 'ECU abstraction', 'Microcontroller abstraction'], lit: 4, why: 'Never bypass the microcontroller layer', whyTone: 'red', at: at(car, 'autosar') - 0.4 });
      uml.callout(c, { x: 130, y: 352, w: 310, text: 'Exception: complex drivers', to: [autosar.x + autosar.w - 30, autosar.bottom(4)], at: at(car, 'complex') });
      example(c, { x: 492, title: 'NASA · spacecraft', layers: ['Apps', 'core Flight Executive', 'OS and platform abstraction', 'Real-time OS and board'], lit: 2, why: 'Same apps on a desktop and in orbit', at: at(car, 'nasas') });

      const thread = 'in_practice/common_thread';
      const d = picture(thread);
      ruleRef(d, NEXT_LOWER, { full: true, x: 24, y: 20, w: 600, at: begin(thread) + 0.3 });
      wall.listCard(d, {
        x: 24, y: 140, w: 512, title: 'Change stays below the interface', iconName: 'stack', at: at(thread, 'interface'),
        items: [{ text: 'Internet: the link layer' }, { text: 'Android: the hardware abstraction layer' }, { text: 'SQLite: the OS interface' }, { text: 'NASA: the platform layer' }],
      });
      // Next lower layer as these systems keep it: never up, but skipping down, or documented exceptions.
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

      // The rule cards in the order the narrator names them, Rule 2 in its two named parts.
      const rules = 'summary/recap_rules';
      const b = picture(rules);
      rule(b, RULE_ONE, { full: true, x: 24, y: 14, w: 560, at: at(rules, 'exactly') - 0.4 });
      const two = ruleTwo(b, { relaxed: true, x: 24, y: 104, w: 560, at: at(rules, 'never') - 0.4 });
      wall.lit(two.parts[0], [[at(rules, 'never'), at(rules, 'next')]]);
      wall.lit(two.parts[1], [[at(rules, 'next'), at(rules, 'least')]]);
      rule(b, RULE_THREE, { full: true, x: 24, y: 320, w: 560, at: at(rules, 'least') - 0.4 });
      ls.socket(b, { x: 24, y: 410, w: 320, name: 'CollisionListener', text: 'on_collision(a, b)', at: at(rules, 'callbacks') });
      arch.tag(b, { x: 362, y: 444, text: 'News goes up by callback', at: at(rules, 'callbacks') + 0.3 });
      wall.note(b, { x: 620, y: 104, w: 300, text: 'Layers group code. Tiers group running components.', tone: 'cyan', tilt: -1, at: at(rules, 'tiers') });

      // Each quality arrives as the narration names it, with the part of the rules it follows from and
      // why; the up-front cost is a cost, not a quality, and stands apart from the pans.
      const tradeoff = 'summary/recap_tradeoff';
      const costs = 'summary/recap_costs';
      const c = picture(tradeoff, costs);
      // Each pan item is three lines (name, rule chips, why), so the balance hangs high; the cost, the
      // bridge, and the closing question stack under the shorter pan, clear of the post's foot.
      arch.tradeoff(c, {
        x: 480, y: 40, beam: 480, at: begin(tradeoff) + 0.1,
        pans: [
          {
            w: 440, title: 'Promoted', at: begin(tradeoff) + 0.2,
            items: [
              { name: 'Portability', rule: 'Next lower layer', why: 'A new platform changes only the bottom layers', at: at(tradeoff, 'portability') },
              { name: 'Modifiability', rule: 'Next lower layer', why: 'A change stays behind a layer’s interface', at: at(tradeoff, 'modifiability') },
              { name: 'Reusability', rule: 'Never up', why: 'Lower layers never depend on upper ones', at: at(tradeoff, 'reusability') },
            ],
          },
          {
            w: 440, title: 'Inhibited', effect: 'inhibited', at: begin(costs) + 0.1,
            items: [
              { name: 'Performance', rule: 'Next lower layer', why: 'Every request crosses every layer', at: at(costs, 'performance') },
            ],
          },
        ],
      });
      arch.card(c, { x: 500, y: 254, w: 440, title: 'Cost: up front', sub: 'Levels and interfaces come before features', iconName: 'timer', at: at(costs, 'front') });
      arch.tag(c, { x: 478, y: 384, text: 'A bridge: performance back, portability lost', tone: 'amber', at: at(costs, 'bridge') });
      sticker(c, 'Does that import point up?', { x: 500, y: 434, at: at(costs, 'import'), variant: 'gold', iconName: 'question' });
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
