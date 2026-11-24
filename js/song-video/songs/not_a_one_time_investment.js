/*
 * Choreography for "Not a One-Time Investment", the design-with-reuse song
 * (storyboard: _data/songs/not_a_one_time_investment.yml).
 *
 * Every visual hits a sung word: `mark(lineId, word)` is that word's time in
 * the recording. The teaching rule: show exactly what the line says, one
 * thing to look at at a time.
 *
 * The song plays on a construction site of toy bricks
 * (js/song-video/brick-site.js), which builds upward across the choruses, and
 * it keeps the lecture's own metaphor for reuse ("composing existing
 * building blocks") all the way through, in the pieces of
 * js/song-video/reuse-kit.js:
 *
 *   - a package is a brick with studs on top, and a brick stacked on
 *     another depends on it;
 *   - a brick's studs are its interface: a new major version with
 *     different studs no longer fits the bricks above it;
 *   - a lockfile is the parts list that gets every build the same bricks;
 *   - a tiny brick deep in a build can hold the whole build up (left-pad);
 *   - mismatched bricks need glue (the lecture's reality of reuse);
 *   - fit matters more than fame: the right brick fills the gap in the wall;
 *   - a framework is a baseplate that decides where your brick goes;
 *   - the refrain's questions each add a brick to a tower, and every
 *     principle is a brick that snaps onto the spread.
 *
 * Each lecture case presents what happened and why in sequence, in the clear
 * space between the towers. Its principle brick sits below the current picture.
 * The quiz presents six question plaques; each gives way to its illustration
 * and answer brick when the answer is sung,
 * after the player's quiz pause. Each line's `visual` text in the storyboard
 * describes this file.
 *
 * Layout: 960×540 stage; section badges sit at the top left.
 * Main annotations stay above y = 460; rocket names sit just
 * below their ground-level platforms, clear of the caption line.
 */
(function () {
  'use strict';

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.not_a_one_time_investment = function choreograph({ song, kit, layers, student }) {
    const { fx, tween, EASE, onFrame, clamp, easeOutCubic, easeInOutCubic, hash01 } = window.Timeline;
    const R = window.ReuseKit;
    const { content: stageContent, hud } = layers;
    // Full-size illustrations take turns in the clear sky between the towers.
    const content = kit.el('div', 'rk-teaching-scenes', stageContent);
    // The crane's working hook: on stage from the moment the jib is built
    // to the end, behind the teaching pictures, resting between jobs.
    const HOOK_REST = [640, 70];
    const hook = R.siteHook(stageContent, { before: content, from: 7.6, rest: HOOK_REST });
    const mark = (id, word) => song.mark(id, word);
    const line = (id) => song.line(id);
    const start = (id) => song.sectionStart(id);
    const end = (id) => song.sectionEnd(id);
    /** Just before line `id` starts: where one picture hands over to the next. */
    const before = (id) => line(id).start - 0.15;

    /** Keep the original illustration coordinates, but center its whole
     * composition. Multiple windows revisit a causal diagram on its lyrics. */
    function focusPanel(parent, side, windows) {
      const node = R.layer(parent);
      node.classList.add('is-staged', `rk-focus-panel--${side}`);
      node.dataset.testid = 'reuse-focus-panel';
      windows.forEach(([at, until]) => {
        fx.fadeIn(node, at, 0.18);
        fx.fadeOut(node, until - 0.18, 0.18);
      });
      return node;
    }

    /** One continuous performer, climbing the right tower as it is built. */
    function mainHero() {
      const cast = window.OperaCast;
      const words = cast.wordsFor(song.storyboard);
      // The singer rests during the quiz's listening pause, including when
      // the player freezes the picture there while waiting for the reader.
      for (const section of song.storyboard.sections) {
        for (const lyric of section.lines) {
          if (lyric.pause_at === undefined) continue;
          const question = words.findLast(([from, to]) => from < lyric.pause_at && to >= lyric.pause_at);
          if (question) question[1] = lyric.pause_at - 0.04;
        }
      }
      const done = mark('outro-3', 'thats');
      const hero = cast.figure(stageContent, {
        role: 'foreman', hero: student?.heroHead(),
        stage: [[-0.3, song.duration + 0.3]],
        places: kit.themes['brick-site'].foremanPlace(song),
        words, singInReducedMotion: false,
        // The foreman is the "I" of the song: the one who reuses, pays for
        // it, and learns. He carries the tool each principle needs in the
        // hand he points with (the picture's left, towards the scenes): a
        // clipboard for the checklists and the quiz, a stamp to pin, a
        // wrench to update, a magnifier to check assumptions, and at the
        // end a gold brick.
        holds: [
          [0, 'left', 'clipboard'], [start('verse-1'), 'left', null],
          [start('refrain-1') - 0.4, 'left', 'clipboard'], [end('refrain-1'), 'left', null],
          [mark('v2-9', 'pin') - 0.5, 'left', 'stamp'], [end('verse-2'), 'left', null],
          [mark('v3-13', 'pinned') - 0.4, 'left', 'wrench'], [end('verse-3'), 'left', null],
          [start('refrain-2') + 0.1, 'left', 'clipboard'], [end('refrain-2'), 'left', null],
          [mark('br-13', 'read') - 0.6, 'left', 'magnifier'], [mark('br-15', 'goes') + 1.4, 'left', null],
          [start('quiz-intro'), 'left', 'clipboard'], [end('refrain-3'), 'left', null],
          [done, 'right', 'brick'],
        ],
        moves: [
          // Intro: eager to reuse.
          [mark('intro-1', 'yourself') - 0.2, 'point', { to: [470, 300], hold: 1.6 }],
          [mark('intro-2', 'well'), 'thumbs', { hold: 1.2, side: 'right' }],
          [mark('intro-2', 'well') + 1.8, 'point', { to: [812, 130], hold: 2 }],
          // Verse 1: what reuse saves him.
          [mark('v1-1', 'out'), 'point', { to: [286, 200], hold: 1.4 }],
          [mark('v1-4', 'repaired'), 'thumbs', { hold: 1.2, side: 'left' }],
          [mark('v1-5', 'write'), 'point', { to: [366, 170], hold: 1.6 }],
          // Verse 2: "My code had not changed a line" (a pat on his chest),
          // "yet docker broke" (a shrug); he watches the crane swap the
          // brick, facepalms as the calls break, then stamps "pinned" on
          // the Pipfile himself.
          [mark('v2-1', 'my'), 'chest', { hold: 0.7, side: 'right' }],
          [mark('v2-2', 'broke'), 'shrug', { hold: 0.8 }],
          [mark('v2-6', 'clean'), 'point', { to: [524, 160], hold: 1.2 }],
          [mark('v2-8', 'broke'), 'facepalm', { hold: 1.1 }],
          [mark('v2-9', 'versions') - 0.15, 'point', { to: [640, 268], hold: 0.8 }],
          [mark('v2-10', 'choose'), 'thumbs', { hold: 1, side: 'right' }],
          // Verse 3: he points at the crack, shrugs, despairs at the leak;
          // "I didn't write that bug" (hand on chest), "but I shipped it"
          // (facepalm); then he updates the pinned brick with his wrench
          // and approves the passing tests.
          [mark('v3-1', 'flaw'), 'point', { to: [284, 170], hold: 1.4 }],
          [mark('v3-2', 'saw'), 'shrug', { hold: 1 }],
          [mark('v3-6', 'passwords'), 'despair', { hold: 1 }],
          [mark('v3-7', 'didnt'), 'chest', { hold: 0.7, side: 'right' }],
          [mark('v3-8', 'shipped'), 'facepalm', { hold: 1 }],
          [mark('v3-12', 'all'), 'thumbs', { hold: 0.8, side: 'right' }],
          [mark('v3-13', 'mean'), 'point', { to: [528, 172], hold: 1.2 }],
          [mark('v3-14', 'test'), 'thumbs', { hold: 0.9, side: 'right' }],
          // Verse 4: he points at the forklift stealing left-pad, despairs
          // at the crash, facepalms at the failed builds; "write trivial code
          // yourself" (hand on chest); a stop palm for hand-rolled crypto;
          // and he points out the brick that fits.
          [mark('v4-5', 'its'), 'point', { to: [680, 360], hold: 1 }],
          [mark('v4-5', 'unpublished') + 1.05, 'despair', { hold: 1.2 }],
          [mark('v4-6', 'failed'), 'facepalm', { hold: 1.2 }],
          [mark('v4-11', 'yourself') - 0.2, 'chest', { hold: 0.7, side: 'right' }],
          [mark('v4-16', 'dont'), 'stop', { hold: 0.9 }],
          [mark('v4-18', 'fit'), 'point', { to: [568, 305], hold: 1 }],
          // Bridge: hands up at the self-destruct, a shrug; then with his
          // magnifier he checks the docs and code, what it was built for,
          // and the test, one line at a time.
          [mark('br-8', 'selfdestructed'), 'surrender', { hold: 0.9 }],
          [mark('br-9', 'worked'), 'shrug', { hold: 0.9 }],
          [mark('br-13', 'docs') - 0.1, 'point', { to: [533, 134], hold: 0.5 }],
          [mark('br-14', 'check') - 0.1, 'point', { to: [533, 182], hold: 0.5 }],
          [mark('br-15', 'test') - 0.1, 'point', { to: [533, 230], hold: 0.9 }],
          // Verse 5: "I call axios" (hand on chest, then a point at axios);
          // "Don't call us, we'll call you" (a stop palm, then the handler).
          [mark('v5-3', 'i'), 'chest', { hold: 0.4, side: 'right' }],
          [mark('v5-3', 'axios') - 0.1, 'point', { to: [638, 144], hold: 0.8 }],
          [mark('v5-6', 'dont'), 'stop', { hold: 0.5 }],
          [mark('v5-6', 'call_2'), 'point', { to: [560, 240], hold: 1 }],
          // Quiz: he hands the cases over, then checks off each answer.
          [mark('quiz-0', 'your') + 0.1, 'thumbs', { hold: 0.6, side: 'right' }],
          ...[1, 2, 3, 4, 5, 6].map((n) => [line(`quiz-${n}`).answer_at + 0.1, 'point', { to: [530, 418], hold: 0.8 }]),
          // Refrains: he reads each question off the checklist as it lights,
          // and approves the takeaway.
          ...['refrain1', 'refrain2', 'refrain3'].flatMap((prefix) => [
            [mark(`${prefix}-2`, 'what'), 'point', { to: [470, 190], hold: 0.9 }],
            [mark(`${prefix}-3`, 'what'), 'point', { to: [470, 190], hold: 0.9 }],
            [mark(`${prefix}-4`, 'what'), 'point', { to: [470, 190], hold: 0.9 }],
            [mark(`${prefix}-5`, 'pin'), 'point', { to: [470, 190], hold: 0.9 }],
          ]),
          [mark('refrain1-6', 'external'), 'thumbs', { hold: 1.4, side: 'right' }],
          [mark('refrain2-6', 'external'), 'thumbs', { hold: 1.4, side: 'right' }],
          [mark('refrain3-6', 'investment'), 'hop', { height: 12 }],
          // Outro: "npm install left-pad? No need": the lesson learned, a
          // finger wag at his old habit and a point at the built-in; then
          // the gold brick, the thumbs-up, a salute, and a hop.
          [mark('outro-2', 'no'), 'wag', { hold: 0.8, side: 'right' }],
          [mark('outro-2', 'padstart'), 'point', { to: [530, 145], hold: 1 }],
          [done + 0.4, 'point', { to: [560, 330], hold: 0.9 }],
          [mark('outro-3', 'right'), 'thumbs', { hold: 1.4, side: 'left' }],
          [song.duration - 6.2, 'salute', { hold: 1.6 }],
          [song.duration - 3.4, 'hop', { height: 14 }],
        ],
      });
      hero.node.classList.add('rk-main-hero');
    }

    function badge(text, sectionId, { at = start(sectionId), until = end(sectionId) } = {}) {
      return kit.badge(hud, text, at, until);
    }

    /** An open showcase: a small title plaque above a floating illustration. */
    function showcase(parent, { x, y, w, h, at, until, title = 'Casebook: Design with Reuse' }) {
      const node = R.show(kit.place(kit.el('div', 'rk-showcase is-staged', parent), x, y), at, until, 'rise');
      node.style.width = `${w}px`;
      if (h !== undefined) node.style.height = `${h}px`;
      kit.el('div', 'rk-showcase-title', node, title);
      return node;
    }

    /** Moves (and turns) a layer of bricks between two poses, from `at`. */
    function shift(node, at, from, to, duration = 0.5, easing = EASE.inOut) {
      tween(node, [from, to], at, duration, easing);
    }

    /** A dashed outline where a brick used to be. */
    function ghost(parent, { x, y, w, h, at, until }) {
      const node = R.show(kit.place(kit.el('div', 'rk-ghost is-staged', parent), x, y), at, until, 'fade');
      node.style.width = `${w}px`;
      node.style.height = `${h}px`;
      return node;
    }

    // ----------------------------------------------------------------
    // Intro: good news, while the site builds itself
    // ----------------------------------------------------------------

    function intro() {
      badge('Intro · Good news', 'intro');
      const leave = end('intro');
      const s = kit.scene(stageContent, 0.2, leave, { exit: 'fade' });
      // While the intro speaks, the backdrop builds itself from bricks
      // (brick-site.js), so the pictures keep to the middle of the stage.
      // "Good news: you don't have to write it all yourself." The command
      // waits, unsent, while a shelf of ready-made package bricks slides in.
      const firstLook = mark('intro-2', 'lets') - 0.15;
      const look = R.group(s, 0.4, firstLook);
      R.term(look, {
        x: 366, y: 104, w: 330, at: 0.6, title: 'terminal',
        lines: [{ text: 'npm install left-pad', at: 1.0, kind: 'cmd', wait: true }],
      });
      R.label(look, 'Ready to reuse', { x: 350, y: 212, w: 360, at: mark('intro-1', 'write'), tone: 'light', align: 'center' });
      R.shelf(look, { x: 350, y: 262, w: 360, names: ['requests', 'numpy', 'React', 'Express'], at: mark('intro-1', 'yourself') - 0.2, every: 0.15, tone: 'desk' });
      // "Let's learn to reuse it well." A title plaque introduces a balance:
      // three bricks of effort saved outweigh one brick of effort to adapt.
      const book = showcase(s, { x: 310, y: 100, w: 440, h: 300, at: firstLook + 0.1 });
      R.scale(book, { x: 50, y: 66, at: mark('intro-2', 'reuse'), left: 'Effort saved', right: 'Effort to adapt', weights: [3, 1], tilt: -1, tiltAt: mark('intro-2', 'well') });
    }

    // ----------------------------------------------------------------
    // Verse 1: what reuse saves, and the catch
    // ----------------------------------------------------------------

    function verse1() {
      badge('Verse 1 · What reuse saves', 'verse-1');
      const from = start('verse-1');
      const leave = end('verse-1');
      const s = kit.scene(content, from, leave, { exit: 'fade' });

      // "Most code I need is out there, written once and shared."
      const shelfEnd = mark('v1-3', 'run');
      const a = focusPanel(s, 'left', [[from, shelfEnd]]);
      R.shelf(a, { x: 70, y: 150, w: 380, names: ['requests', 'urllib3', 'numpy', 'pandas', 'docker'], at: mark('v1-1', 'most'), every: 0.18 });
      R.note(a, 'Written once, shared', { x: 126, y: 318, w: 270, at: mark('v1-2', 'written'), tone: 'tag', icon: 'globe' });

      // "It's run in working systems, so bugs were found and repaired."
      const testedEnd = mark('v1-5', 'and');
      const b = focusPanel(s, 'left', [[shelfEnd, testedEnd]]);
      R.users(b, { cx: 172, cy: 236, r: 96, w: 148, name: 'requests', at: shelfEnd, every: 0.07 });
      ['Bug 1', 'Bug 2', 'Bug 3'].forEach((text, i) => {
        R.note(b, text, { x: 294, y: 150 + i * 62, w: 72, at: mark('v1-4', 'bugs') + i * 0.1, small: true });
        R.inkStamp(b, 'fixed', { x: 372, y: 152 + i * 62, at: mark('v1-4', 'found') + i * 0.15, tone: 'green', rotate: -6 });
      });
      R.note(b, 'Fewer defects', { x: 147, y: 330, w: 220, at: shelfEnd + 0.2, icon: 'shield' }).dataset.testid = 'reuse-benefit-quality';

      // "Less to write and less to test, so the feature ships sooner."
      const catchAt = before('v1-7');
      const c = focusPanel(s, 'left', [[testedEnd, catchAt]]);
      R.bars(c, {
        x: 72, y: 128, w: 370, at: testedEnd, shrinkAt: mark('v1-5', 'test'),
        items: [{ label: 'Code to write', to: 0.3 }, { label: 'Code to test', to: 0.3 }],
      });
      R.note(c, 'Ship sooner', { x: 147, y: 270, w: 220, at: testedEnd + 0.2, icon: 'forward' }).dataset.testid = 'reuse-benefit-productivity';

      // "But modules aren't neat building blocks: each one assumes its world,
      // and glue code joins the pieces where those worlds don't fit."
      const catchPanel = focusPanel(s, 'right', [[catchAt, leave]]);
      const realityAt = mark('v1-8', 'each');
      const glueAt = mark('v1-9', 'glue');
      const fitAt = mark('v1-10', 'where');
      R.label(catchPanel, 'Perfect fit?', { x: 512, y: 108, w: 380, at: mark('v1-7', 'but'), until: realityAt, align: 'center' });
      R.label(catchPanel, 'Different assumptions', { x: 512, y: 108, w: 380, at: realityAt, until: glueAt, align: 'center', tone: 'red' });
      R.label(catchPanel, 'Glue code fills the gaps', { x: 512, y: 108, w: 380, at: glueAt, until: fitAt, align: 'center' });
      R.label(catchPanel, 'Check the assumptions', { x: 512, y: 108, w: 380, at: fitAt, align: 'center', tone: 'red' });
      R.vision(catchPanel, {
        x: 552, y: 136, at: mark('v1-7', 'modules'), realityAt,
        glueAt: [glueAt, mark('v1-9', 'joins'), mark('v1-9', 'pieces')], outlineAt: fitAt,
        notes: [
          { text: 'assumes one thread', x: 20, y: 214, w: 120, at: mark('v1-8', 'assumes') },
          { text: 'assumes low speeds', x: 160, y: 214, w: 120, at: mark('v1-8', 'world') },
        ],
      });
    }

    // ----------------------------------------------------------------
    // The refrain: the checklist, a brick for every question
    // ----------------------------------------------------------------

    function refrain(sectionId, prefix, { tabs = {}, confetti = false, startAt } = {}) {
      const from = startAt ?? start(sectionId);
      const leave = end(sectionId);
      badge(sectionId === 'refrain-3' ? 'Final refrain · Before you reuse' : 'Refrain · Before you reuse', sectionId, { at: from });
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const at = (n, word) => mark(`${prefix}-${n}`, word);
      const list = R.checklist(s, {
        x: 310, y: 78, w: 440, at: from,
        tabsAt: from + 0.4,
        items: [
          { q: 'Savings? Costs?', icon: 'wallet', at: at(2, 'what'), tabs: tabs.cost },
          { q: 'What does it assume?', icon: 'search', at: at(3, 'what'), showAt: at(3, 'what') - 0.4, tabs: tabs.assume },
          { q: 'What does it pull in?', icon: 'box', at: at(4, 'what'), tabs: tabs.pull },
          { q: 'Pin versions. Update for patches.', icon: 'pin', at: at(5, 'pin'), tabs: tabs.pin },
        ],
        footer: 'External reuse is not a one-time investment.',
        footerAt: at(6, 'external'),
      });
      if (confetti) kit.confetti(s, { x: 530, y: 40, at: at(6, 'investment'), count: 40, seed: 7 });
      // The crane lowers each question's brick onto the tower, then its
      // hook goes back to rest.
      list.lowered.forEach(({ lowerFrom, lands, pose }) => {
        hook.go(lowerFrom - 0.75, () => pose(lowerFrom)?.x, () => pose(lowerFrom)?.y, 0.7);
        hook.carry(lowerFrom, lands, pose);
        hook.go(lands + 0.1, () => pose(lands)?.x, 60, 0.5);
      });
      const last = list.lowered.at(-1);
      hook.go(last.lands + 0.7, HOOK_REST[0], HOOK_REST[1], 1);
    }

    // ----------------------------------------------------------------
    // Verse 2, case 1: urllib3, a brick nobody chose
    // ----------------------------------------------------------------

    function verse2() {
      badge('Verse 2 · Pin your versions', 'verse-2');
      const from = start('verse-2');
      const leave = end('verse-2');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const book = R.spread(s);

      // What happened: "My code had not changed a line, yet docker broke today."
      const pinAt = mark('v2-9', 'pin');
      const okAt = mark('v2-10', 'nothing');
      const whyAt = before('v2-3');
      const a = focusPanel(s, 'left', [[from, whyAt]]);
      R.term(a, {
        x: 63, y: 112, w: 390, at: mark('v2-1', 'my'), title: 'terminal',
        lines: [
          { text: 'git status', at: mark('v2-1', 'my') + 0.1, kind: 'cmd' },
          { text: 'nothing to commit, working tree clean', at: mark('v2-1', 'changed'), kind: 'ok' },
        ],
      });
      R.code(a, {
        x: 63, y: 214, w: 390, lang: 'plain', title: 'docker', at: mark('v2-2', 'yet'), how: 'pop',
        lines: [
          'docker.errors.DockerException:',
          'Error while fetching server API',
          'version: request() got an',
          { text: "unexpected keyword argument 'chunked'", hl: { part: "unexpected keyword argument 'chunked'", at: mark('v2-2', 'broke') } },
        ],
      }).classList.add('rk-code--error');
      // Why: a tower of package bricks. docker sits on requests, which sits
      // on urllib3: each depends on the brick below it. Keep this picture
      // visible as the changed studs break compatibility up the tower.
      const twoAt = mark('v2-6', 'two');
      const tower = focusPanel(s, 'right', [[whyAt, pinAt], [okAt, leave]]);
      R.plate(tower, { x: 580, y: 372, w: 240, at: mark('v2-3', 'docker') - 0.2, scaffold: true });
      // The crane does the clean install: its hook takes docker and requests
      // up off urllib3, holds them while the bricks swap underneath, and
      // lowers them onto studs that no longer fit.
      const hoisted = R.layer(tower);
      const upper = R.layer(hoisted);
      const top = R.layer(upper);
      const GRAB = 183;
      hook.go(63.0, 524, 60, 0.8).go(63.9, 524, GRAB, 0.8).go(64.8, 524, GRAB - 80, 0.6)
        .go(66.5, 524, GRAB, 0.35).go(67.0, 524, 60, 0.7).go(67.8, HOOK_REST[0], HOOK_REST[1], 1);
      const hookY = (t) => hook.at(t).y;
      onFrame((t) => {
        const lifted = t > 64.8 && t < 66.9 ? hookY(t) - GRAB : 0;
        hoisted.style.translate = `0 ${lifted.toFixed(1)}px`;
      });
      const oldU = R.pkg(tower, {
        x: 590, y: 312, w: 220, h: 60, name: 'urllib3', version: '1.26', tone: 'blue', under: true, how: 'drop', at: mark('v2-4', 'urllib3') - 0.1,
        tags: [
          { at: mark('v2-5', 'pinned'), text: '1.26 · not pinned', kind: 'any' },
          { at: okAt, text: '<2.0.0 · pinned', kind: 'pinned' },
        ],
      });
      const requests = R.pkg(upper, { x: 590, y: 252, w: 220, h: 60, name: 'requests', tone: 'blue', under: true, how: 'drop', at: mark('v2-3', 'requests') });
      const docker = R.pkg(top, { x: 590, y: 192, w: 220, h: 60, name: 'docker', tone: 'blue', how: 'drop', at: mark('v2-3', 'docker') });
      R.label(tower, 'calls ↓', { x: 828, y: 234, w: 74, at: mark('v2-3', 'calls'), tone: 'muted', size: 17 });
      R.label(tower, 'calls ↓', { x: 828, y: 294, w: 74, at: mark('v2-4', 'calls'), tone: 'muted', size: 17 });
      kit.sticker(tower, 'Clean install', { x: 640, y: 396, at: mark('v2-6', 'clean'), until: mark('v2-7', 'version'), iconName: 'resend', rotate: -4 });
      // "So a clean install got two": the old brick slides out, version 2.0.0
      // slides in with different studs, and the bricks above no longer seat.
      shift(oldU.node, twoAt, { opacity: 1, translate: '0 0' }, { opacity: 0, translate: '30px 0' }, 0.35);
      const newU = R.pkg(tower, { x: 590, y: 312, w: 220, h: 60, name: 'urllib3', version: '2.0.0', tone: 'red', odd: true, how: 'none', at: twoAt, tags: [{ at: 0, text: '2.0.0', kind: 'new' }] });
      shift(newU.node, twoAt + 0.15, { opacity: 0, translate: '30px 0' }, { opacity: 1, translate: '0 0' }, 0.4);
      shift(upper, twoAt + 0.4, { translate: '0 0' }, { translate: '0 -12px' }, 0.3, EASE.back);
      // "Version two changed its API": the new studs.
      R.label(tower, 'Changed API', { x: 468, y: 304, w: 116, align: 'right', at: mark('v2-7', 'changed'), until: okAt, tone: 'red', size: 18 });
      R.arrow(tower, { x1: 586, y1: 318, x2: 604, y2: 307, at: mark('v2-7', 'changed'), until: okAt, tone: 'red' });
      // "And requests' calls broke too": the break travels up the tower,
      // each brick sliding off the one below.
      shift(upper, mark('v2-8', 'requests'), { translate: '0 -12px' }, { translate: '-10px -12px' }, 0.35, EASE.back);
      shift(top, mark('v2-8', 'broke'), { translate: '0 0' }, { translate: '-12px 0' }, 0.35, EASE.back);
      requests.cross(mark('v2-8', 'requests'), okAt);
      docker.cross(mark('v2-8', 'broke'), okAt);

      // The principle: "Pin dependency versions: nothing moves till you
      // choose." The old brick comes back, pinned, and the tower seats again.
      book.ribbon('Pin dependency versions', { at: pinAt });
      shift(newU.node, okAt, { opacity: 1, translate: '0 0' }, { opacity: 0, translate: '30px 0' }, 0.3);
      shift(oldU.node, okAt + 0.2, { opacity: 0, translate: '30px 0' }, { opacity: 1, translate: '0 0' }, 0.4);
      shift(upper, okAt + 0.5, { translate: '-10px -12px' }, { translate: '0 0' }, 0.4, EASE.back);
      shift(top, okAt + 0.5, { translate: '-12px 0' }, { translate: '0 0' }, 0.4, EASE.back);
      [docker, requests, oldU].forEach((p, i) => p.check(mark('v2-10', 'choose') + i * 0.12));
      const b = focusPanel(s, 'left', [[pinAt, okAt]]);
      R.code(b, {
        x: 90, y: 126, w: 336, lang: 'plain', title: 'Pipfile (Python)', at: pinAt,
        lines: ['[packages]', { text: 'urllib3 = "<2.0.0"', hl: { part: 'urllib3 = "<2.0.0"', at: mark('v2-9', 'versions'), tone: 'green' } }, 'docker = "==7.1.0"'],
      });
      R.inkStamp(b, 'pinned', { x: 318, y: 252, at: mark('v2-9', 'versions') + 0.2, tone: 'green' });
      R.note(b, 'Lockfile: repeatable versions', { x: 90, y: 298, w: 336, at: pinAt, icon: 'list', small: true });
    }

    // ----------------------------------------------------------------
    // Verse 3, case 2: Heartbleed, and the fix that reaches everyone
    // ----------------------------------------------------------------

    // Keep the successful patch test readable into the refrain's lead-in.
    const patchHandoff = mark('refrain2-1', 'ask') - 0.25;
    function verse3() {
      badge('Verse 3 · Update for patches', 'verse-3', { until: patchHandoff });
      const from = start('verse-3');
      const leave = patchHandoff;
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const book = R.spread(s);

      // What happened: "OpenSSL had a flaw; for two years, no one saw."
      const mineAt = before('v3-7');
      const requestAt = mark('v3-3', 'a') - 0.1;
      const a = focusPanel(s, 'left', [[from, requestAt]]);
      R.padlock(a, { x: 200, y: 112, size: 96, at: mark('v3-1', 'openssl'), crackAt: mark('v3-1', 'flaw'), label: 'OpenSSL 1.0.1 (TLS)' });
      R.timeline(a, {
        x: 96, y: 290, w: 320, at: from + 0.3, fillAt: mark('v3-2', 'two'), fillTo: mark('v3-2', 'saw'), fillTone: 'red',
        points: [
          { pos: 0, text: '2012: bug ships', at: from, align: 'left' },
          { pos: 1, text: '2014: found', at: from, align: 'right' },
        ],
      });
      R.label(a, '2 years unseen', { x: 96, y: 368, w: 320, at: mark('v3-2', 'for') - 0.5, tone: 'red', align: 'center' });

      // Why: "A request claimed a length; the server trusted it and sent back
      // its own memory: passwords, private keys."
      const b = focusPanel(s, 'right', [[requestAt, mineAt]]);
      R.code(b, {
        x: 514, y: 108, w: 236, lang: 'plain', title: 'heartbeat request', at: mark('v3-3', 'request'),
        lines: ['send back: "a"', { text: 'length: 64 KB', hl: { part: '64 KB', at: mark('v3-3', 'length') } }],
      });
      R.label(b, 'trusted, never checked', { x: 760, y: 136, w: 142, at: mark('v3-4', 'trusted'), tone: 'red', size: 17 });
      R.note(b, 'OpenSSL server', { x: 514, y: 212, w: 200, at: mark('v3-4', 'server'), icon: 'database' });
      R.note(b, 'Heartbleed: buffer over-read', { x: 724, y: 212, w: 176, at: mark('v3-5', 'sent'), tone: 'bad', small: true });
      // The reply keeps printing, line after line of the server's memory,
      // far past the one letter asked for: it scrolls like a receipt, and
      // the password and the private key are lit as they are sung.
      const sent = mark('v3-5', 'sent');
      const reply = R.code(b, {
        x: 514, y: 268, w: 386, lang: 'plain', title: 'reply: "a" + server memory', at: sent,
        lines: [
          '"a"',
          'session=7f3a9c… user=ana',
          'cookie=SID_91f0e2…',
          'GET /inbox HTTP/1.1',
          { text: 'password=••••••••', hl: { part: 'password=••••••••', at: mark('v3-6', 'passwords') } },
          'email=ana@…',
          { text: '-----BEGIN PRIVATE KEY-----', hl: { part: '-----BEGIN PRIVATE KEY-----', at: mark('v3-6', 'private') } },
          'MIIEvQIBADANBgkqhkiG9w0BAQEFAA…',
          '… 64 KB of server memory …',
        ],
      });
      const body = reply.querySelector('.rk-code-body');
      const roll = kit.el('div', 'rk-code-roll', body);
      const printed = [...body.children].filter((line) => line !== roll);
      printed.forEach((line) => roll.appendChild(line));
      const SHOWN = 5;
      const EVERY = 0.4;
      onFrame((t) => {
        const lineH = printed[0].offsetHeight || 23;
        body.style.height = `${(SHOWN * lineH).toFixed(1)}px`;
        const count = clamp(Math.floor((t - sent) / EVERY) + 1, 1, printed.length);
        const into = clamp((t - sent - (count - 1) * EVERY) / 0.18, 0, 1);
        const scroll = Math.max(0, count - 1 - (SHOWN - 1) - (1 - easeOutCubic(into)));
        // Lines that have scrolled out of the window fade away above it.
        printed.forEach((line, i) => {
          const above = clamp(scroll - i, 0, 1);
          const shown = i < count - 1 ? 1 : i === count - 1 ? into : 0;
          line.style.opacity = (shown * (1 - above)).toFixed(2);
        });
        roll.style.translate = `0 ${(-scroll * lineH).toFixed(1)}px`;
      });

      // "I didn't write that bug, but I shipped it, all the same." Your app
      // is a build: your code brick sits on the OpenSSL brick. The X-ray
      // shows the crack inside.
      const pinAt = mark('v3-13', 'pinned');
      const shipped = mark('v3-8', 'shipped');
      const shareAt = mark('v3-10', 'update');
      const c = focusPanel(s, 'left', [[mineAt, shareAt]]);
      const xray = R.show(kit.place(kit.el('div', 'rk-xray is-staged', c), 70, 108), shipped, undefined, 'fade');
      xray.style.width = '376px';
      xray.style.height = '154px';
      kit.el('div', 'rk-xray-label', xray, 'your app, X-rayed');
      R.plate(c, { x: 230, y: 240, w: 206, at: mark('v3-7', 'i') - 0.1, scaffold: true });
      const openssl = R.pkg(c, { x: 240, y: 186, w: 186, h: 54, name: 'OpenSSL 1.0.1', tone: 'blue', under: true, how: 'drop', at: mark('v3-7', 'i') });
      const yours = R.pkg(c, { x: 240, y: 132, w: 186, h: 54, name: 'your code', tone: 'gold', how: 'drop', at: mark('v3-7', 'i') + 0.15 });
      yours.check(mark('v3-7', 'bug'));
      R.crack(c, { x: 240, y: 186, w: 186, h: 54, at: shipped + 0.1 });
      openssl.ring(shipped + 0.25, undefined, 'red');
      R.label(c, 'Reused code brings its bugs', { x: 70, y: 268, w: 376, at: mark('v3-8', 'same'), tone: 'red', align: 'center' });
      // "The fix shipped within a week to all who chose to update."
      R.timeline(c, {
        x: 110, y: 306, w: 300, at: mark('v3-9', 'the'), fillAt: mark('v3-9', 'fix'), fillTo: mark('v3-9', 'week'), fillTone: 'green',
        points: [
          { pos: 0, text: '1 April 2014: found', at: mark('v3-9', 'the'), align: 'left' },
          { pos: 1, text: '7 April: 1.0.1g', at: mark('v3-9', 'fix'), align: 'right' },
        ],
      });
      // Next picture: "That's reuse on your side: one fix, shared by all."
      const d = focusPanel(s, 'right', [[shareAt, pinAt]]);
      R.label(d, 'Apps that update to 1.0.1g', { x: 512, y: 108, w: 380, at: shareAt, tone: 'muted', align: 'center', size: 18 });
      R.appGrid(d, { x: 590, y: 152, at: shareAt, greenAt: mark('v3-10', 'update'), every: 0.1 });
      R.label(d, 'One fix, many apps', { x: 512, y: 312, w: 380, at: mark('v3-11', 'thats'), tone: 'green', align: 'center', size: 22 });
      R.tick(d, { x: 840, y: 150, at: mark('v3-12', 'all'), size: 56 });

      // The principle: "Pinned doesn't mean frozen: update to the fix, then test."
      book.ribbon('Pinned doesn’t mean frozen', { at: pinAt, until: mark('v3-14', 'update') });
      book.ribbon('Update, then test', { at: mark('v3-14', 'update') });
      const e = focusPanel(s, 'left', [[pinAt, leave]]);
      R.pkg(e, {
        x: 120, y: 140, w: 280, name: 'openssl', version: '1.0.1f · pinned', tone: 'blue', at: pinAt,
        tags: [
          { at: mark('v3-13', 'frozen'), text: '1.0.1g · pinned', kind: 'pinned' },
        ],
      });
      R.term(e, {
        x: 90, y: 240, w: 340, at: mark('v3-14', 'update'), title: 'terminal',
        lines: [
          { text: 'npm test', at: mark('v3-14', 'fix'), kind: 'cmd' },
          { text: '✓ all tests passed', at: mark('v3-14', 'test'), kind: 'ok' },
        ],
      }).dataset.testid = 'reuse-patch-result';
    }

    // ----------------------------------------------------------------
    // Verse 4, case 3: left-pad, eslint-scope, and choosing well
    // ----------------------------------------------------------------

    function verse4() {
      badge('Verse 4 · Choose dependencies well', 'verse-4');
      const from = start('verse-4');
      const leave = end('verse-4');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const book = R.spread(s);

      // What happened: "Left-pad: eleven lines that pad a string on the left."
      const failAt = mark('v4-6', 'thousands');
      const padAt = before('v4-2');
      const a = focusPanel(s, 'left', [[from, padAt]]);
      R.code(a, {
        x: 66, y: 106, w: 384, lang: 'js', numbers: true, size: 16, title: 'left-pad', at: mark('v4-1', 'leftpad'),
        lines: [
          'module.exports = leftpad;',
          'function leftpad (str, len, ch) {',
          '  str = String(str);',
          '  var i = -1;',
          "  if (!ch && ch !== 0) ch = ' ';",
          '  len = len - str.length;',
          '  while (++i < len) {',
          '    str = ch + str;',
          '  }',
          '  return str;',
          '}',
        ],
      });

      // What it does: "... that pad a string on the left." The next picture
      // shows what left-pad is for: three numbers padded to width 3 line up
      // on the right. Padding bricks drop in on the left of 7 and 42 and
      // push their digits over, until all three share a right edge.
      const built = mark('v4-3', 'pulled') - 0.25;
      const padding = focusPanel(s, 'right', [[padAt, built - 0.2]]);
      R.padColumn(padding, {
        x: 515, y: 150, values: ['7', '42', '317'], width: 3, caption: 'Right-aligned',
        at: mark('v4-1', 'lines'), padAt: mark('v4-2', 'pad'), every: 0.15, alignAt: mark('v4-2', 'string'), until: built - 0.2,
      });

      // Why: "Babel and React pulled it in through packages they used." Your
      // app is a build: it stands on react and babel-core, and babel-core
      // stands on more packages, which stand on one tiny brick, left-pad.
      const trickAt = before('v4-11');
      const hijackAt = before('v4-9');
      const traceAt = mark('v4-7', 'never');
      const b = focusPanel(s, 'right', [[built - 0.2, hijackAt]]);
      b.dataset.testid = 'reuse-dependency-build';
      const baseY = 390;
      const supportHeight = 56;
      const supportY = baseY - supportHeight;
      R.plate(b, { x: 514, y: baseY, w: 380, at: built - 0.2, scaffold: true }).dataset.testid = 'reuse-dependency-platform';
      const right = R.layer(b);
      const app = R.layer(b);
      right.style.transformOrigin = `884px ${supportY}px`;
      app.style.transformOrigin = '700px 150px';
      const carried = R.layer(b);
      const leftpad = R.pkg(carried, { x: 748, y: supportY, w: 100, h: supportHeight, name: 'left-pad', tone: 'blue', small: true, under: true, how: 'drop', at: built });
      R.pkg(b, { x: 528, y: 206, w: 172, h: baseY - 206, name: '… more packages', tone: 'blue', small: true, under: true, stack: true, how: 'drop', at: built + 0.1 });
      const more = R.pkg(right, { x: 712, y: 206, w: 172, h: supportY - 206, name: '… more packages', tone: 'blue', small: true, under: true, stack: true, how: 'drop', at: built + 0.15 });
      more.node.dataset.testid = 'reuse-fallen-dependencies';
      const react = R.pkg(b, { x: 528, y: 150, w: 172, h: 56, name: 'react', tone: 'blue', under: true, how: 'drop', at: built + 0.3 });
      const tumble = R.layer(right);
      tumble.style.transformOrigin = '884px 206px';
      const babel = R.pkg(tumble, { x: 712, y: 150, w: 172, h: 56, name: 'babel-core', tone: 'blue', under: true, how: 'drop', at: built + 0.35 });
      const yourApp = R.pkg(app, { x: 520, y: 94, w: 372, h: 56, name: 'your-app', tone: 'gold', how: 'drop', at: built + 0.5 });
      // "Through packages they used": the path down to left-pad lights.
      const through = mark('v4-4', 'through');
      [babel, more, leftpad].forEach((p, i) => R.classAt(p.node, 'is-path', through + i * 0.35));
      // "...they used": the tiny brick squashes under all of it, and the
      // whole build starts to tremble, harder and harder. "Its author
      // unpublished it": a forklift races in, yanks left-pad out, and
      // speeds off with it. The build hangs in the air for a cartoon beat,
      // shivering; then the right column crashes down with a jolt, brick
      // chips and dust flying, babel-core tumbles askew on top, and
      // your-app seesaws on react's corner before it settles, crooked.
      const gone = mark('v4-5', 'unpublished');
      const strainAt = mark('v4-4', 'used');
      R.strain(b, { x: 748, y: supportY, w: 100, h: supportHeight, at: strainAt, until: gone + 0.05 });
      tween(leftpad.node, [{ scale: '1 1' }, { scale: '1.06 0.9' }], strainAt, 0.3, EASE.out);
      const hangAt = gone + 0.5;
      const dropAt = gone + 0.85;
      const FALL = 0.2;
      const landAt = dropAt + FALL;
      ghost(b, { x: 748, y: supportY, w: 100, h: supportHeight, at: hangAt, until: dropAt });
      // The forklift, facing left, its forks at the platform.
      const lift = kit.svg('svg', { class: 'rk-forklift', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, b);
      const truck = kit.svg('g', {}, lift);
      const lines = kit.svg('path', { class: 'rk-forklift-speed', d: 'M54 -34 H86 M60 -22 H98 M54 -10 H82' }, truck);
      kit.svg('rect', { class: 'rk-forklift-fork', x: -30, y: -6, width: 32, height: 4, rx: 1 }, truck);
      kit.svg('rect', { class: 'rk-forklift-mast', x: -2, y: -54, width: 6, height: 50 }, truck);
      kit.svg('rect', { class: 'rk-forklift-weight', x: 40, y: -26, width: 12, height: 18, rx: 2 }, truck);
      kit.svg('rect', { class: 'rk-forklift-body', x: 4, y: -24, width: 40, height: 16, rx: 3 }, truck);
      kit.svg('path', { class: 'rk-forklift-cage', d: 'M10 -24 V-46 H34 V-24 M10 -46 L34 -46' }, truck);
      kit.svg('rect', { class: 'rk-forklift-seat', x: 22, y: -34, width: 10, height: 10, rx: 2 }, truck);
      const wheels = [12, 36].map((wx) => {
        kit.svg('circle', { class: 'rk-forklift-tyre', cx: wx, cy: -7, r: 7 }, truck);
        return kit.svg('path', { class: 'rk-forklift-spoke', d: `M${wx - 4} -7 H${wx + 4} M${wx} -11 V-3` }, truck);
      });
      const arriveFrom = gone - 0.65;
      const arriveAt = gone - 0.1;
      const leaveAt = gone + 0.6;
      const DOCK = 850;
      const truckX = (t) => {
        if (t < arriveAt) return 1180 - (1180 - DOCK) * easeOutCubic(clamp((t - arriveFrom) / (arriveAt - arriveFrom), 0, 1));
        if (t < gone) return DOCK;
        return DOCK + 380 * clamp((t - gone) / (leaveAt - gone), 0, 1) ** 2;
      };
      // A cartoon "!" over your-app while the build hangs in the air.
      const alarm = kit.svg('g', { class: 'rk-alarm' }, lift);
      kit.svg('circle', { cx: 0, cy: 0, r: 17 }, alarm);
      kit.svg('path', { class: 'rk-alarm-mark', d: 'M-3 -11 H3 L2 3 H-2 Z M0 6.5 a3 3 0 1 1 0 0.1 Z' }, alarm);
      // Brick chips that fly from the crash, each on its own arc.
      const chips = kit.svg('g', { class: 'rk-chips' }, lift);
      const chipParts = Array.from({ length: 9 }, (_, i) => ({
        node: kit.svg('rect', { class: `rk-chip rk-chip--${i % 3 ? 'blue' : 'tan'}`, x: -4, y: -3, width: 8 + 4 * hash01(i * 7 + 1), height: 6, rx: 1 }, chips),
        vx: (hash01(i * 11 + 3) - 0.35) * 260, vy: -160 - 140 * hash01(i * 5 + 2), spin: (hash01(i * 13 + 4) - 0.5) * 900,
      }));
      R.dust(b, { x: DOCK + 14, y: baseY - 6, at: gone, duration: 0.7, size: 0.8 });
      R.dust(b, { x: 798, y: baseY - 8, at: landAt, duration: 1, size: 1.2 });
      R.dust(b, { x: 870, y: 150, at: landAt + 0.25, duration: 0.8, size: 0.7 });
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      onFrame((t) => {
        // With motion reduced, show the supported/broken states directly.
        const time = reducedMotion.matches && t >= gone ? dropAt + 4 : t;
        const still = reducedMotion.matches;
        // The forklift's run, and left-pad riding off on its forks.
        const tx = truckX(time);
        const truckOn = !still && time >= arriveFrom && time < leaveAt;
        const alarmOn = !still && time >= gone + 0.25 && time < landAt + 0.2;
        lift.style.display = truckOn || alarmOn || (time >= landAt && time < landAt + 1) ? '' : 'none';
        alarm.style.display = alarmOn ? '' : 'none';
        const pop = clamp((time - gone - 0.25) / 0.18, 0, 1);
        alarm.setAttribute('transform', `translate(912 ${(128 - 6 * Math.sin(Math.PI * pop)).toFixed(1)}) scale(${(0.4 + 0.6 * easeOutCubic(pop)).toFixed(3)})`);
        // The camera pushes in slowly on the straining brick, then eases
        // back out after the crash.
        const push = still ? 0 : easeInOutCubic(clamp((time - strainAt) / (gone - strainAt), 0, 1)) * (1 - easeInOutCubic(clamp((time - landAt) / 0.6, 0, 1)));
        b.style.transformOrigin = '798px 300px';
        b.style.scale = (1 + 0.035 * push).toFixed(4);
        truck.style.display = truckOn ? '' : 'none';
        truck.setAttribute('transform', `translate(${tx.toFixed(1)} ${baseY}) scale(1.4)`);
        lines.style.opacity = time < arriveAt || time > gone + 0.05 ? '1' : '0';
        lines.setAttribute('transform', time < arriveAt ? '' : 'translate(-150 0) scale(-1 1) translate(-140 0)');
        const roll = ((tx - DOCK) / 7) * 57.3;
        wheels.forEach((spoke, i) => spoke.setAttribute('transform', `rotate(${roll.toFixed(1)} ${[12, 36][i]} -7)`));
        const away = time >= gone ? tx - DOCK : 0;
        const lifted = time >= gone ? -8 * clamp((time - gone) / 0.12, 0, 1) : 0;
        carried.style.translate = `${away.toFixed(1)}px ${lifted.toFixed(1)}px`;
        carried.style.rotate = time >= gone ? `${(-4 * Math.sin(Math.min(1, (time - gone) / 0.5) * Math.PI)).toFixed(2)}deg` : '0deg';
        carried.style.transformOrigin = '798px 390px';
        carried.style.opacity = time >= leaveAt ? '0' : '1';
        // The whole build trembles as the strain grows, and jolts on landing.
        let shake = 0;
        if (!still && time >= strainAt && time < gone) shake = 1.4 * ((time - strainAt) / (gone - strainAt)) * Math.sin(time * 2 * Math.PI * 9);
        if (!still && time >= landAt && time < landAt + 0.35) shake = 2.2 * Math.exp(-(time - landAt) / 0.1) * Math.sin((time - landAt) * 2 * Math.PI * 14);
        b.style.translate = `${shake.toFixed(2)}px 0`;
        // The unsupported column: hangs, shivers, crashes, bounces, rests.
        let dx = 0;
        let dy = 0;
        let turn = 0;
        if (time >= hangAt && time < dropAt) dx = 1.2 * Math.sin((time - hangAt) * 2 * Math.PI * 7);
        if (time >= dropAt) {
          const fall = Math.min(1, (time - dropAt) / FALL) ** 2;
          const after = Math.max(0, time - landAt);
          const rebound = after > 0 ? Math.exp(-after / 0.12) * Math.sin(after * 2 * Math.PI * 2.6) : 0;
          dy = supportHeight * fall - 8 * rebound;
          turn = 4 * fall - 2 * rebound;
        }
        right.style.translate = `${dx.toFixed(2)}px ${dy.toFixed(2)}px`;
        right.style.rotate = `${turn.toFixed(2)}deg`;
        // babel-core slides and tips on top of the fallen column.
        const slip = time >= landAt ? easeOutCubic(clamp((time - landAt) / 0.4, 0, 1)) : 0;
        tumble.style.translate = `${(10 * slip).toFixed(2)}px ${(4 * slip).toFixed(2)}px`;
        tumble.style.rotate = `${(7 * slip).toFixed(2)}deg`;
        // your-app seesaws on react's corner, then settles crooked.
        let tip = 0;
        if (time >= landAt) {
          const u = time - landAt;
          tip = 9 * (1 - Math.exp(-u / 0.08)) + 5 * Math.exp(-u / 0.3) * Math.sin(u * 2 * Math.PI * 1.6);
        }
        app.style.rotate = `${tip.toFixed(2)}deg`;
        // The chips fly on their arcs and fade.
        const c = time - landAt;
        chips.style.display = !still && c >= 0 && c < 1 ? '' : 'none';
        if (!still && c >= 0 && c < 1) {
          chipParts.forEach(({ node, vx, vy, spin }) => {
            const px = 798 + vx * c;
            const py = baseY - 10 + vy * c + 520 * c * c;
            node.setAttribute('transform', `translate(${px.toFixed(1)} ${Math.min(py, baseY - 2).toFixed(1)}) rotate(${(spin * c).toFixed(1)})`);
            node.style.opacity = String(clamp(1 - (c - 0.55) / 0.45, 0, 1));
          });
        }
      });
      yourApp.cross(mark('v4-6', 'failed'));
      // "Many never saw it: a dependency, deep down."
      [react, babel].forEach((p) => R.classAt(p.node, 'is-listed', mark('v4-7', 'many'), mark('v4-8', 'deep')));
      more.ring(mark('v4-8', 'dependency'), undefined, 'red');
      const say = (text, at, until, tone = 'red') => R.label(b, text, { x: 510, y: 418, w: 384, at, until, tone, align: 'center', size: 19 });
      say('transitive dependency', mark('v4-4', 'packages'), mark('v4-5', 'its'));
      say('Unpublished', gone, failAt);
      say('Direct dependencies', mark('v4-7', 'many'), mark('v4-8', 'dependency'), 'ink');
      say('3 levels down', mark('v4-8', 'dependency'), hijackAt);

      // "Thousands of builds failed": compact readouts below the still-visible build.
      const c = R.group(s, failAt, traceAt);
      ['thousands', 'builds', 'failed'].forEach((word, i) => {
        const error = R.term(c, {
          x: 310 + i * 150, y: 410, w: 140, at: mark('v4-6', word), title: `build ${i + 1}`, how: 'pop',
          lines: [{ text: 'npm ERR! 404', at: mark('v4-6', word), kind: 'err' }],
        });
        error.classList.add('rk-build-error');
        error.dataset.testid = 'reuse-build-error';
      });

      // "When eslint-scope was hijacked, its new release stole tokens."
      const cryptoAt = before('v4-15');
      const d = focusPanel(s, 'left', [[hijackAt, trickAt]]);
      R.pkg(d, { x: 90, y: 116, w: 280, name: 'eslint-scope', version: '3.7.2', tone: 'blue', at: mark('v4-9', 'eslintscope'), tags: [{ at: mark('v4-9', 'hijacked'), text: '3.7.2 · malicious', kind: 'bad' }] });
      R.note(d, 'Maintainer account hijacked', { x: 90, y: 200, w: 340, at: hijackAt, tone: 'bad', icon: 'key' });
      const npmrc = R.code(d, { x: 90, y: 270, w: 300, lang: 'plain', title: '.npmrc', at: mark('v4-10', 'release'), lines: ['_authToken=npm_••••••••'] });
      tween(npmrc, [{ translate: '0 0' }, { translate: '46px 0' }], mark('v4-10', 'stole'), 0.6, EASE.inOut);

      // The principles: "Write trivial code yourself; keep dependencies few:
      // each one can break, be hijacked, or vanish out of view."
      book.ribbon('Write trivial code yourself', { at: trickAt, until: mark('v4-12', 'keep') });
      book.ribbon('Keep dependencies few', { at: mark('v4-12', 'keep'), until: cryptoAt });
      const fameAt = before('v4-17');
      const e = focusPanel(s, 'right', [[trickAt, cryptoAt]]);
      R.code(e, {
        x: 512, y: 108, w: 386, lang: 'js', size: 16, title: 'isarray: the whole package, 1 line', at: mark('v4-11', 'trivial'),
        lines: ["toString.call(arr) == '[object Array]'"],
      });
      const many = R.shelf(e, {
        x: 512, y: 200, w: 386, at: mark('v4-12', 'keep'), every: 0.06,
        names: ['express', 'left-pad', 'is-odd', 'react', 'is-even', 'isarray', 'axios', 'is-number'],
      });
      const trivial = [1, 2, 4, 5, 7];
      Array.from(many.querySelectorAll('.rk-shelf-item')).forEach((item, i) => {
        if (trivial.includes(i)) fx.fadeOut(item, mark('v4-12', 'few') + i * 0.05, 0.35);
      });
      R.note(e, 'Breaks', { x: 512, y: 336, w: 104, at: mark('v4-13', 'break'), tone: 'bad', small: true });
      R.note(e, 'Hijacked', { x: 624, y: 336, w: 150, at: mark('v4-13', 'hijacked'), tone: 'bad', small: true });
      R.note(e, 'Vanishes', { x: 782, y: 336, w: 122, at: before('v4-14'), tone: 'bad', small: true });

      // The boundary: "But code that's hard to get right, like crypto: don't write your own."
      const f = focusPanel(s, 'left', [[cryptoAt, fameAt]]);
      const homemade = R.code(f, {
        x: 90, y: 120, w: 330, lang: 'js', title: 'hand-written crypto', at: mark('v4-15', 'code'),
        lines: ['function myEncrypt (text) {', '  // my own cipher… secure?', '}'],
      });
      R.label(f, 'hard to get right', { x: 90, y: 246, w: 330, at: mark('v4-15', 'hard'), tone: 'muted', align: 'center' });
      R.tick(f, { x: 384, y: 104, at: mark('v4-16', 'dont'), kind: 'cross', size: 44 });
      R.classAt(homemade, 'is-struck', mark('v4-16', 'dont'));
      R.pkg(f, { x: 96, y: 296, w: 320, name: 'vetted crypto library', tone: 'blue', how: 'drop', at: cryptoAt + 0.2 }).check(mark('v4-16', 'own'));
      book.ribbon('Use vetted crypto', { at: cryptoAt, until: fameAt });
      book.ribbon('Choose maintained dependencies', { at: fameAt, until: mark('v4-18', 'but') });

      // "Choose maintained and popular, but fit comes before fame." The
      // project is a wall with a gap: the popular brick is too big for it,
      // a smaller one fits.
      const g = focusPanel(s, 'right', [[fameAt, leave]]);
      R.note(g, 'A · maintained, documented', { x: 512, y: 108, w: 386, at: fameAt, tone: 'good', icon: 'check' });
      R.note(g, 'B · inactive 4 years', { x: 512, y: 170, w: 386, at: fameAt + 0.2, icon: 'hourglass' });
      const shown = mark('v4-17', 'popular');
      const wall = R.wallGap(g, { x: 588, y: 290, cols: 6, rows: 3, gapCol: 2, gapCols: 2, brickW: 52, brickH: 30, at: shown });
      R.label(g, 'your project', { x: 504, y: 314, w: 80, at: shown, tone: 'muted', size: 17 });
      const popular = R.pkg(g, { x: 512, y: 232, w: 180, h: 30, name: 'popular-lib', tone: 'blue', small: true, at: shown });
      // "But fit": the popular brick is wider than the gap and cannot seat.
      const over = `${wall.gap.x - 512 - 38}px 24px`;
      shift(popular.node, mark('v4-18', 'but'), { translate: '0 0' }, { translate: over }, 0.3, EASE.back);
      popular.cross(mark('v4-18', 'fit'));
      shift(popular.node, mark('v4-18', 'comes'), { translate: over }, { translate: '0 0' }, 0.3, EASE.inOut);
      // "Comes before fame": a brick the size of the gap fills it.
      // Once popular-lib has backed off, fit-lib moves across above the
      // wall, then drops straight into the gap, whose outline has gone.
      const comes = mark('v4-18', 'comes');
      const fits = R.pkg(g, { x: 800, y: 232, w: wall.gap.w, h: 30, name: 'fit-lib', tone: 'blue', small: true, at: comes + 0.3 });
      const dx = wall.gap.x - 800;
      tween(fits.node, [
        { translate: '0 0' },
        { translate: `${dx}px 0`, offset: 0.55 },
        { translate: `${dx}px ${wall.gap.y - 232}px` },
      ], comes + 0.4, 0.5, EASE.inOut);
      fx.fadeOut(wall.slot, comes + 0.4, 0.2);
      fits.check(Math.max(mark('v4-18', 'fame'), comes + 0.95));
      book.ribbon('Fit before fame', { at: mark('v4-18', 'but') });
    }

    // ----------------------------------------------------------------
    // Bridge, case 4: Ariane 5 and a violated assumption
    // ----------------------------------------------------------------

    function bridge() {
      badge('Bridge · Check what it assumes', 'bridge');
      const from = start('bridge');
      const leave = end('bridge');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const book = R.spread(s);
      const firstLaunch = mark('br-4', 'since');
      const firstExit = mark('br-7', 'in');

      // What happened: the same gold module flies on two rockets: Ariane 4,
      // then Ariane 5, each with a cut-away window onto its equipment bay.
      // Let the breakup resolve into smoke before the comparison takes over.
      const verdictAt = mark('br-9', 'built') - 0.2;
      const a = focusPanel(s, 'left', [[from, verdictAt]]);
      const sky = kit.place(kit.el('div', 'rk-clip rk-launch-scene', a), 56, 0);
      const groundY = 466;
      R.rocket(sky, {
        x: 40, groundY, name: 'Ariane 4', kind: 'ariane4', at: mark('br-1', 'code'), module: mark('br-1', 'ariane'),
        launchAt: firstLaunch, flightTo: { y: -160, at: firstExit },
      });
      const irsUntil = mark('br-4', 'since') - 0.9;
      R.label(sky, 'Inertial Reference System', { x: 160, y: 290, w: 220, at: mark('br-1', 'built'), until: irsUntil, size: 18 });
      R.arrow(sky, { x1: 156, y1: 322, x2: 114, y2: 312, bend: -6, at: mark('br-1', 'built') + 0.2, until: irsUntil });
      const reusedAt = mark('br-5', 'reused');
      R.arrow(a, { x1: 160, y1: 352, x2: 296, y2: 352, at: reusedAt, until: mark('br-6', 'which'), label: 'reused', labelAt: [196, 318] });
      R.rocket(sky, {
        x: 244, groundY, name: 'Ariane 5', kind: 'ariane5', at: reusedAt, module: mark('br-5', 'five'),
        // The faster ascent reaches the clouds on "overflow". Hold that
        // failure moment for "37 seconds", then show the veer and breakup.
        launchAt: mark('br-6', 'which'), flightTo: { y: 200, at: mark('br-6', 'overflow') },
        veerAt: mark('br-8', 'veered'), bloomAt: mark('br-8', 'selfdestructed'),
      });

      // Keep the launch visible while compact labels explain the assumption.
      const rule = mark('br-12', 'identify');
      R.label(a, 'Speed stored in 16 bits', { x: 216, y: 210, w: 220, at: mark('br-2', 'stored'), until: mark('br-4', 'since'), size: 20, align: 'center' });
      R.label(a, 'Limit: 32,767', { x: 216, y: 250, w: 220, at: mark('br-2', 'stored'), until: mark('br-4', 'since'), size: 20, align: 'center' });
      R.label(a, 'Fits ✓', { x: 70, y: 364, w: 376, at: firstLaunch, until: before('br-5'), tone: 'green', align: 'center', size: 22 });
      R.inkStamp(a, 'Overflow', { x: 94, y: 264, at: mark('br-6', 'overflow'), until: mark('br-8', 'veered'), tone: 'red', rotate: -4 });
      R.label(a, 'T + 37 s', { x: 148, y: 364, w: 220, at: mark('br-7', 'thirtyseven'), tone: 'red', align: 'center', size: 28 });

      // "It worked where it was built, and failed where it was sent: its
      // assumption didn't hold."
      const driftAt = mark('br-16', 'systems');
      const c = focusPanel(s, 'left', [[verdictAt, rule]]);
      R.note(c, 'Ariane 4: fits', { x: 90, y: 120, w: 340, at: verdictAt, tone: 'good', icon: 'check' });
      R.note(c, 'Ariane 5: overflows', { x: 90, y: 186, w: 340, at: mark('br-10', 'failed'), tone: 'bad', icon: 'cross' });
      R.note(c, 'Assumes velocity fits 16 bits', { x: 90, y: 260, w: 340, at: verdictAt, tone: 'tag', icon: 'pin' });

      // The principle: identify violated assumptions, in three steps.
      book.ribbon('Identify violated assumptions', { at: rule, until: mark('br-17', 'version') });
      const d = focusPanel(s, 'right', [[rule, driftAt]]);
      R.checkboxes(d, {
        x: 524, y: 118, w: 370, at: rule,
        items: [
          { text: 'Read docs and code', at: mark('br-13', 'docs') },
          { text: 'Match your conditions', at: mark('br-14', 'built') },
          { text: 'Test it', at: mark('br-15', 'test') },
        ],
      });
      R.term(d, {
        x: 524, y: 270, w: 370, at: mark('br-15', 'then'), title: 'ground test bench',
        lines: [
          { text: 'simulate ariane5_flight', at: mark('br-15', 'then') + 0.1, kind: 'cmd' },
          { text: '✗ overflow at T+37 s: caught before launch', at: mark('br-15', 'where'), kind: 'err' },
        ],
      });

      // "If two systems drift apart, version it, or clone and own: copy it,
      // so each can change." One module brick becomes two, one per team.
      const e = focusPanel(s, 'left', [[driftAt, leave]]);
      R.pkg(e, { x: 66, y: 196, w: 120, name: 'IRS', tone: 'gold', at: mark('br-16', 'two') });
      R.arrow(e, { x1: 190, y1: 210, x2: 248, y2: 140, at: mark('br-16', 'drift'), bend: -8 });
      R.arrow(e, { x1: 190, y1: 236, x2: 248, y2: 262, at: mark('br-16', 'drift'), bend: 8 });
      R.note(e, 'Ariane 4: 16 bits', { x: 252, y: 112, w: 196, at: mark('br-16', 'two'), until: mark('br-17', 'or'), small: true });
      R.note(e, 'Ariane 5: 32 bits', { x: 252, y: 236, w: 196, at: mark('br-16', 'two') + 0.15, until: mark('br-17', 'or'), small: true });
      R.pkg(e, { x: 252, y: 108, w: 196, name: 'IRS v1', version: '16-bit', tone: 'gold', how: 'drop', at: mark('br-17', 'or') });
      R.pkg(e, { x: 252, y: 230, w: 196, name: 'IRS v2', version: '32-bit', tone: 'gold', how: 'drop', at: mark('br-17', 'clone') });
      R.note(e, 'Ariane 4 team', { x: 270, y: 182, w: 160, at: mark('br-17', 'or'), small: true, icon: 'team' });
      R.note(e, 'Ariane 5 team', { x: 270, y: 304, w: 160, at: mark('br-17', 'clone'), small: true, icon: 'team' });
      book.ribbon('Version it, or clone and own', { at: mark('br-17', 'version') });
    }

    // ----------------------------------------------------------------
    // Verse 5, case 5: library or framework, who calls whom
    // ----------------------------------------------------------------

    function verse5() {
      badge('Verse 5 · Who calls whom?', 'verse-5');
      const from = start('verse-5');
      const leave = end('verse-5');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const book = R.spread(s);
      const ask = mark('v5-2', 'ask');
      const youCall = mark('v5-3', 'call');
      const itCalls = mark('v5-4', 'calls');

      const frameworkAt = before('v5-4');
      const library = focusPanel(s, 'left', [[from, frameworkAt]]);
      // Library: "I call axios when I choose." A loose brick you pick up and
      // place where you want it.
      R.pkg(library, { x: 76, y: 120, w: 160, name: 'your code', tone: 'gold', at: from + 0.3 });
      R.pkg(library, { x: 300, y: 120, w: 140, name: 'axios', tone: 'blue', at: from + 0.4 });
      R.arrow(library, { x1: 240, y1: 147, x2: 296, y2: 147, at: ask, until: youCall, dashed: true, tone: 'muted', label: '?', labelAt: [260, 104] });
      R.arrow(library, { x1: 240, y1: 147, x2: 296, y2: 147, at: youCall, label: 'you call it', labelAt: [212, 186] });
      R.code(library, { x: 70, y: 226, w: 380, lang: 'js', at: mark('v5-3', 'axios'), lines: ['const response = await axios', "  .get('/user?ID=12345');"] });

      const framework = focusPanel(s, 'right', [[frameworkAt, leave]]);
      // Framework: "Express calls my code." A baseplate with a socket that
      // decides where your brick goes.
      R.plate(framework, { x: 512, y: 168, w: 392, h: 34, label: 'Express (the framework)', tone: 'grey', at: from + 0.3, scaffold: true });
      const socket = ghost(framework, { x: 660, y: 112, w: 150, h: 56, at: ask, until: itCalls });
      socket.classList.add('rk-ghost--socket');
      R.label(framework, '?', { x: 660, y: 124, w: 150, at: ask, until: itCalls, align: 'center', tone: 'muted', size: 24 });
      const handler = R.pkg(framework, { x: 660, y: 112, w: 150, h: 56, name: 'your handler', tone: 'gold', how: 'drop', at: itCalls - 0.1 });
      R.arrow(framework, { x1: 600, y1: 166, x2: 652, y2: 140, at: itCalls, until: mark('v5-6', 'dont'), bend: -10, label: 'it calls you', labelAt: [516, 118] });
      R.code(framework, { x: 514, y: 226, w: 386, lang: 'js', at: mark('v5-4', 'express'), lines: ["app.get('/', (req, res) => {", "  res.send('Hello World!')", '})'] });

      // "That's the Hollywood Principle: don't call us, we'll call you."
      book.ribbon('Hollywood Principle', { at: mark('v5-5', 'hollywood'), sub: '(inversion of control)' });
      const request = R.note(framework, 'GET /', { x: 518, y: 122, w: 104, at: mark('v5-6', 'dont'), until: mark('v5-7', 'decides'), small: true, icon: 'globe' });
      tween(request, [{ translate: '0 0' }, { translate: '38px 0' }], mark('v5-6', 'call'), 0.4, EASE.inOut);
      handler.ring(mark('v5-6', 'you'), mark('v5-7', 'more'), 'green');

      // "It decides more; I write less, but it's harder to undo." The
      // framework's own bricks go up around yours.
      R.pkg(framework, { x: 528, y: 112, w: 124, h: 56, name: 'routing', tone: 'grey', small: true, how: 'drop', at: mark('v5-7', 'decides') });
      R.pkg(framework, { x: 818, y: 112, w: 80, h: 56, name: 'server', tone: 'grey', small: true, how: 'drop', at: mark('v5-7', 'more') });
      R.label(framework, 'Less code · harder to replace', { x: 514, y: 330, w: 386, at: mark('v5-7', 'decides'), align: 'center' });
      const locked = ghost(framework, { x: 518, y: 98, w: 386, h: 112, at: mark('v5-8', 'but') });
      locked.classList.add('rk-ghost--frame');
    }

    // ----------------------------------------------------------------
    // Quiz: six new cases
    // ----------------------------------------------------------------

    function quiz() {
      badge('Quiz · Your cases', 'quiz-intro');
      kit.badge(hud, 'Quiz · Your cases', start('quiz'), end('quiz'));
      const from = start('quiz-intro');
      const leave = end('quiz');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      R.label(s, 'Your turn!', { x: 310, y: 148, w: 440, at: mark('quiz-0', 'your'), until: before('quiz-1'), align: 'center', size: 40, weight: 900 });
      R.label(s, 'Try these cases.', { x: 310, y: 240, w: 440, at: mark('quiz-0', 'turn'), until: before('quiz-1'), align: 'center', size: 28, tone: 'muted' });

      const ART = {
        1: (g, q) => {
          R.term(g, { x: 512, y: 120, w: 380, at: q.start + 0.2, title: 'terminal', lines: [{ text: 'npm install is-even', at: q.start + 0.3, kind: 'cmd', wait: true }] });
          R.code(g, { x: 512, y: 236, w: 380, lang: 'js', at: mark('quiz-1', 'one'), lines: ['const isEven = (n) => n % 2 === 0;'] });
          R.tick(g, { x: 852, y: 112, at: q.answer_at, kind: 'cross', size: 36 });
          R.tick(g, { x: 852, y: 226, at: mark('quiz-1', 'write'), size: 36 });
        },
        2: (g, q) => {
          R.code(g, { x: 512, y: 120, w: 380, lang: 'js', title: 'hand-written crypto', at: q.start + 0.3, lines: ['function myEncrypt (text) {', '  // my own cipher', '}'] });
          R.pkg(g, { x: 560, y: 278, w: 300, name: 'vetted crypto library', tone: 'blue', at: mark('quiz-2', 'reuse') }).check(mark('quiz-2', 'tested'));
          R.tick(g, { x: 852, y: 112, at: q.answer_at, kind: 'cross', size: 36 });
        },
        3: (g, q) => {
          R.pkg(g, {
            x: 560, y: 214, w: 280, name: 'library', version: '==3.4.1 · pinned', tone: 'blue', at: q.start + 0.2,
            tags: [{ at: q.answer_at + 0.45, text: '==3.4.2 · pinned', kind: 'pinned' }],
          });
          R.note(g, 'Security fix: 3.4.2', { x: 560, y: 300, w: 280, at: q.start + 0.4, until: q.answer_at + 0.25, icon: 'shield' });
          R.term(g, { x: 560, y: 284, w: 280, at: mark('quiz-3', 'then'), title: 'terminal', lines: [{ text: '✓ all tests passed', at: mark('quiz-3', 'test'), kind: 'ok' }] });
        },
        4: (g, q) => {
          R.label(g, '03/04/2026', { x: 512, y: 200, w: 380, at: q.start + 0.2, align: 'center', size: 40, weight: 900 }).classList.add('rk-label--mono');
          R.note(g, 'Old code: March 4', { x: 560, y: 260, w: 280, at: q.start + 0.6, icon: 'calendar' });
          R.note(g, 'Europe: 3 April', { x: 560, y: 310, w: 280, at: q.start + 1.3, icon: 'user' });
        },
        5: (g, q) => {
          // Two app bricks stand on one shared module brick.
          const splitAt = q.answer_at + 0.05;
          const shared = R.pkg(g, { x: 560, y: 290, w: 300, h: 48, name: 'shared module', names: [{ at: splitAt + 0.15, text: 'module v1' }], tone: 'blue', small: true, under: true, how: 'drop', at: mark('quiz-5', 'module') });
          R.pkg(g, { x: 566, y: 236, w: 140, h: 48, name: 'App A', tone: 'gold', how: 'drop', at: q.start + 0.2 });
          const leaning = R.layer(g);
          const appB = R.pkg(leaning, { x: 714, y: 236, w: 140, h: 48, name: 'App B', tone: 'gold', how: 'drop', at: q.start + 0.3 });
          shift(leaning, mark('quiz-5', 'drift'), { translate: '0 0' }, { translate: '12px -14px' }, 0.45, EASE.back);
          appB.cross(mark('quiz-5', 'apart'), splitAt + 0.4);
          // "Version it, or clone and own": B gets its own copy of the module.
          tween(shared.node, [{ width: '300px' }, { width: '146px' }], splitAt, 0.4, EASE.inOut);
          const copy = R.pkg(g, { x: 714, y: 290, w: 146, h: 48, name: 'module v2', tone: 'blue', small: true, under: true, how: 'none', at: splitAt });
          shift(copy.node, splitAt + 0.15, { opacity: 0, translate: '20px 0' }, { opacity: 1, translate: '0 0' }, 0.4);
          shift(leaning, splitAt + 0.5, { translate: '12px -14px' }, { translate: '0 0' }, 0.4, EASE.back);
          appB.check(splitAt + 0.9);
        },
        6: (g, q) => {
          R.pkg(g, { x: 512, y: 112, w: 150, name: 'pytest', tone: 'grey', at: q.start + 0.2 });
          R.arrow(g, { x1: 588, y1: 168, x2: 588, y2: 226, at: mark('quiz-6', 'calls'), label: 'calls', labelAt: [604, 182] });
          R.code(g, { x: 512, y: 234, w: 386, lang: 'python', title: 'test_fizzbuzz.py (the TDD tutorial)', at: q.answer_at + 0.15, lines: ['def test_multiple_of_three_is_fizz():', "    assert fizzbuzz(3) == 'Fizz'"] });
        },
      };
      const QUESTIONS = [
        { n: 1, icon: 'pencil', answer: 'Write the one-liner.' },
        { n: 2, icon: 'shield', answer: 'Use vetted crypto.' },
        { n: 3, icon: 'pin', answer: 'Update, then test.', preview: true },
        { n: 4, icon: 'search', answer: 'Check month-first assumption.', preview: true },
        { n: 5, icon: 'copy', answer: 'Version, or clone and own.', preview: true },
        { n: 6, icon: 'resend', answer: 'Framework: it calls you.' },
      ];
      QUESTIONS.forEach(({ n, icon, answer, preview }) => {
        const q = line(`quiz-${n}`);
        const until = n < 6 ? line(`quiz-${n + 1}`).start : leave;
        // Preview the problem, not its solution: these diagrams need more
        // inspection time than the brief sung answer can provide. State
        // changes and answer bricks still wait for answer_at, including on seek.
        R.quiz(s, { x: 310, y: 86, w: 440, n, total: 6, question: q.text, answer, icon, at: q.start, answerAt: q.answer_at, until });
        const art = focusPanel(s, 'right', [[preview ? q.start : q.answer_at, until]]);
        art.classList.add('rk-quiz-art');
        art.dataset.testid = `reuse-quiz-art-${n}`;
        ART[n](art, q);
      });
    }

    // ----------------------------------------------------------------
    // Outro: back at the laptop, and the build is done
    // ----------------------------------------------------------------

    function outro() {
      // Hold the final message through the instrumental tail and exact end.
      const leave = song.duration + 0.5;
      badge('Outro · Reuse done right', 'outro', { until: leave });
      const from = start('outro');
      const s = kit.scene(stageContent, from, leave, { exit: 'fade' });
      const done = mark('outro-3', 'thats');
      const builtIn = mark('outro-2', 'need');
      R.term(s, {
        x: 310, y: 96, w: 440, at: from + 0.1, until: builtIn, title: 'terminal',
        lines: [
          { text: 'npm install left-pad', at: from + 0.2, until: builtIn, kind: 'cmd', wait: true },
        ],
      });
      R.code(s, { x: 310, y: 96, w: 440, at: builtIn + 0.1, lang: 'js', title: 'JavaScript · built-in', lines: ['String(str).padStart(length,', '  paddingCharacter)'] });
      R.label(s, 'Eleven lines → one built-in', { x: 310, y: 204, w: 440, at: mark('outro-2', 'built'), tone: 'light', align: 'center', size: 22 });
      // "That's reuse done right." The five cases snap together into one
      // build: lessons to keep, so gold.
      const book = showcase(s, { x: 310, y: 232, w: 440, h: 240, at: done - 0.1 });
      R.plate(book, { x: 20, y: 216, w: 200, at: done });
      ['framework', 'Ariane 5', 'left-pad', 'Heartbleed', 'urllib3'].forEach((name, i) => {
        R.pkg(book, { x: 30, y: 188 - i * 28, w: 180, h: 28, name, tone: 'gold', small: true, under: i < 4, how: 'drop', at: done + 0.2 + i * 0.18 });
      });
      const words = R.label(book, 'Reuse done right', { x: 232, y: 150, w: 170, at: mark('outro-3', 'right'), tone: 'green', size: 28, weight: 900 });
      words.classList.add('rk-showcase-done');
      // The finale: confetti over the finished casebook as the flag goes up.
      kit.confetti(s, { x: 530, y: 30, at: song.duration - 6.5, count: 36, seed: 21 });
    }

    intro();
    verse1();
    refrain('refrain-1', 'refrain1');
    verse2();
    verse3();
    refrain('refrain-2', 'refrain2', { tabs: { pin: ['urllib3', 'Heartbleed'] }, startAt: patchHandoff });
    verse4();
    bridge();
    verse5();
    quiz();
    refrain('refrain-3', 'refrain3', { tabs: { assume: ['Ariane 5'], pull: ['left-pad'], pin: ['urllib3', 'Heartbleed'] }, confetti: true });
    outro();
    mainHero();
    return { layers: [content] };
  };
})();
