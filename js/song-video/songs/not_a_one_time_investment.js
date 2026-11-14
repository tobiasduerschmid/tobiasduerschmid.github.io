/*
 * Choreography for "Not a One-Time Investment", the design-with-reuse song
 * (storyboard: _data/songs/not_a_one_time_investment.yml).
 *
 * Every visual hits a sung word: `mark(lineId, word)` is that word's time in
 * the recording. The teaching rule: show exactly what the line says, one
 * thing to look at at a time.
 *
 * The song plays on a construction site of toy bricks
 * (js/song-video/brick-site.js), which builds itself during the intro, and
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
 * Each lecture case gets one casebook spread with the same three parts,
 * filled in as the verse sings them: the left page shows what happened, the
 * right page why it happened (in bricks), and the principle brick across the
 * bottom names the principle in the lecture's words. The quiz asks six new
 * cases on numbered cards, each answer brick snapping on as it is sung,
 * after the player's quiz pause. Each line's `visual` text in the storyboard
 * describes this file.
 *
 * Layout: 960×540 stage; the section badge sits top-left, the spread's case
 * tab top-right, and nothing essential goes below y = 460, where the player
 * draws captions.
 */
(function () {
  'use strict';

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.not_a_one_time_investment = function choreograph({ song, kit, layers, student }) {
    const { fx, tween, EASE, onFrame } = window.Timeline;
    const R = window.ReuseKit;
    // The viewer's own hero as the site foreman (opera-cast.js's `foreman`):
    // hi-vis vest, gold hard hat, the saved SE Gym face where it loads.
    const FOREMAN = { role: 'foreman', hero: student?.heroHead() };
    /** The foreman on a casebook page that is empty for a while (feet on its bottom edge). */
    const foremanOnPage = (x, from, until, moves, holds = []) => window.OperaCast?.figure(content, {
      ...FOREMAN, stage: [[from, until]], places: [[from, x, 388, 0.72, 0]], moves, holds,
    });
    const { content, hud } = layers;
    const mark = (id, word) => song.mark(id, word);
    const line = (id) => song.line(id);
    const start = (id) => song.sectionStart(id);
    const end = (id) => song.sectionEnd(id);
    /** Just before line `id` starts: where one picture hands over to the next. */
    const before = (id) => line(id).start - 0.15;

    function badge(text, sectionId) {
      kit.badge(hud, text, start(sectionId), end(sectionId));
    }

    /** The casebook's cover: a tile on its plate, with its title. */
    function cover(parent, { x, y, w, h, at, until, title = 'Casebook: Design with Reuse' }) {
      const node = R.show(kit.place(kit.el('div', 'rk-cover is-staged', parent), x, y), at, until, 'rise');
      node.style.width = `${w}px`;
      if (h !== undefined) node.style.height = `${h}px`;
      kit.el('div', 'rk-cover-title', node, title);
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
      // The foreman walks onto the site with a clipboard while it builds
      // itself, points at the shelf on "yourself", gives a thumbs-up on
      // "well", and looks up as the crane lifts the module.
      window.OperaCast?.figure(content, {
        ...FOREMAN,
        stage: [[1.2, leave - 0.3, { enter: 'left', exit: 'left' }]],
        places: [[1.2, 150, 470, 0.84, 0]],
        holds: [[0, 'left', 'clipboard']],
        moves: [
          [mark('intro-1', 'yourself') - 0.2, 'point', { to: [470, 300], hold: 1.6 }],
          [mark('intro-2', 'well'), 'thumbs', { hold: 1.2 }],
          [mark('intro-2', 'well') + 1.8, 'point', { to: [812, 130], hold: 2 }],
        ],
      });
      const s = kit.scene(content, 0.2, leave, { exit: 'fade' });
      // While the intro speaks, the backdrop builds itself from bricks
      // (brick-site.js), so the pictures keep to the middle of the stage.
      // "Good news: you don't have to write it all yourself." The command
      // waits, unsent, while a shelf of ready-made package bricks slides in.
      const firstLook = mark('intro-2', 'lets') - 0.15;
      const look = R.group(s, 0.4, firstLook);
      R.term(look, {
        x: 316, y: 104, w: 330, at: 0.6, title: 'terminal',
        lines: [{ text: 'npm install left-pad', at: 1.0, kind: 'cmd', wait: true }],
      });
      R.label(look, 'Open source, ready to reuse', { x: 300, y: 212, w: 360, at: mark('intro-1', 'write'), tone: 'light', align: 'center' });
      R.shelf(look, { x: 300, y: 262, w: 360, names: ['requests', 'numpy', 'React', 'Express'], at: mark('intro-1', 'yourself') - 0.2, every: 0.15, tone: 'desk' });
      // "Let's learn to reuse it well." The casebook opens on a balance:
      // three bricks of effort saved outweigh one brick of effort to adapt.
      const book = cover(s, { x: 260, y: 100, w: 440, h: 300, at: firstLook + 0.1 });
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
      R.spread(s, { at: from, tab: 'What reuse saves', left: 'What it saves', right: 'The catch' });

      // "Most code I need is out there, written once and shared."
      const shelfEnd = mark('v1-3', 'run');
      const a = R.group(s, from, shelfEnd);
      R.shelf(a, { x: 70, y: 150, w: 380, names: ['requests', 'urllib3', 'numpy', 'pandas', 'docker'], at: mark('v1-1', 'most'), every: 0.18 });
      R.note(a, 'Written once, shared', { x: 126, y: 318, w: 270, at: mark('v1-2', 'written'), tone: 'tag', icon: 'globe' });

      // "It's run in working systems, so bugs were found and repaired."
      const testedEnd = mark('v1-5', 'and');
      const b = R.group(s, shelfEnd, testedEnd);
      R.users(b, { cx: 172, cy: 236, r: 96, w: 148, name: 'requests', at: shelfEnd, every: 0.07 });
      R.label(b, 'Used in working systems', { x: 64, y: 350, w: 230, at: mark('v1-3', 'working'), tone: 'muted', align: 'center', size: 18 });
      ['Bug 1', 'Bug 2', 'Bug 3'].forEach((text, i) => {
        R.note(b, text, { x: 294, y: 150 + i * 62, w: 72, at: mark('v1-4', 'bugs') + i * 0.1, small: true });
        R.inkStamp(b, 'fixed', { x: 372, y: 152 + i * 62, at: mark('v1-4', 'found') + i * 0.15, tone: 'green', rotate: -6 });
      });
      R.label(b, 'Tried and tested', { x: 294, y: 350, w: 164, at: mark('v1-4', 'found'), tone: 'green', align: 'center' });

      // "Less to write and less to test, so the feature ships sooner."
      const c = R.group(s, testedEnd, leave);
      R.bars(c, {
        x: 72, y: 128, w: 370, at: testedEnd, shrinkAt: mark('v1-5', 'test'),
        items: [{ label: 'Code to write', to: 0.3 }, { label: 'Code to test', to: 0.3 }],
      });
      R.note(c, 'Higher productivity, faster time to market', { x: 72, y: 232, w: 370, at: mark('v1-6', 'feature'), icon: 'forward' });
      R.note(c, 'Higher software quality, fewer defects', { x: 72, y: 300, w: 370, at: mark('v1-6', 'ships'), icon: 'shield' });

      // "But modules aren't neat building blocks: each one assumes its world,
      // and glue code joins the pieces where those worlds don't fit."
      const realityAt = mark('v1-8', 'each');
      const glueAt = mark('v1-9', 'glue');
      const fitAt = mark('v1-10', 'where');
      R.label(s, 'The vision: compatible blocks', { x: 512, y: 108, w: 380, at: mark('v1-7', 'but'), until: realityAt, align: 'center' });
      R.label(s, 'The reality: they don’t fit', { x: 512, y: 108, w: 380, at: realityAt, until: glueAt, align: 'center', tone: 'red' });
      R.label(s, 'Glue code fills the gaps', { x: 512, y: 108, w: 380, at: glueAt, until: fitAt, align: 'center' });
      R.label(s, 'Where the assumptions don’t fit', { x: 512, y: 108, w: 380, at: fitAt, align: 'center', tone: 'red' });
      // Until the vision arrives, the foreman stands on the empty right
      // page: points at the shelf on "out there", gives a thumbs-up on
      // "repaired", and points at the shrinking bars on "write".
      foremanOnPage(700, start('verse-1') + 0.4, mark('v1-7', 'but') - 0.2, [
        [mark('v1-1', 'out'), 'point', { to: [250, 200], hold: 1.4 }],
        [mark('v1-4', 'repaired'), 'thumbs', { hold: 1.2, side: 'left' }],
        [mark('v1-5', 'write'), 'point', { to: [330, 170], hold: 1.6 }],
      ], [[0, 'right', 'clipboard']]);
      R.vision(s, {
        x: 552, y: 136, at: mark('v1-7', 'neat'), realityAt,
        glueAt: [glueAt, mark('v1-9', 'joins'), mark('v1-9', 'pieces')], outlineAt: fitAt,
        notes: [
          { text: 'assumes one thread', x: -24, y: 214, w: 170, at: mark('v1-8', 'assumes') },
          { text: 'assumes low speeds', x: 160, y: 214, w: 170, at: mark('v1-8', 'world') },
        ],
      });
    }

    // ----------------------------------------------------------------
    // The refrain: the checklist, a brick for every question
    // ----------------------------------------------------------------

    function refrain(sectionId, prefix, { tabs = {}, confetti = false } = {}) {
      const from = start(sectionId);
      const leave = end(sectionId);
      badge(sectionId === 'refrain-3' ? 'Final refrain · Before you reuse' : 'Refrain · Before you reuse', sectionId);
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const at = (n, word) => mark(`${prefix}-${n}`, word);
      R.checklist(s, {
        x: 90, y: 78, w: 780, at: from, title: 'Before you reuse, ask:',
        tabsAt: from + 0.4,
        items: [
          { q: 'What will it save? What will it cost?', name: 'Cost-benefit analysis', icon: 'wallet', at: at(2, 'what'), tabs: tabs.cost },
          { q: 'What does it assume?', name: 'Identify violated assumptions', icon: 'search', at: at(3, 'what'), tabs: tabs.assume },
          { q: 'What does it pull in?', name: 'Strive for fewer dependencies', icon: 'box', at: at(4, 'what'), tabs: tabs.pull },
          { q: 'Pin it, but update for patches.', name: 'Keep versions fixed · Update for security patches', icon: 'pin', at: at(5, 'pin'), tabs: tabs.pin },
        ],
        footer: 'External reuse is not a one-time investment.',
        footerAt: at(6, 'external'),
      });
      if (confetti) kit.confetti(s, { x: 480, y: 40, at: at(6, 'investment'), count: 40, seed: 7 });
    }

    // ----------------------------------------------------------------
    // Verse 2, case 1: urllib3, a brick nobody chose
    // ----------------------------------------------------------------

    function verse2() {
      badge('Verse 2 · Pin your versions', 'verse-2');
      const from = start('verse-2');
      const leave = end('verse-2');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const book = R.spread(s, { at: from, tab: 'Case 1 · urllib3', left: 'What happened', right: 'Why' });

      // What happened: "My code had not changed a line, yet docker broke today."
      const pinAt = mark('v2-9', 'pin');
      const okAt = mark('v2-10', 'nothing');
      const a = R.group(s, from, pinAt - 0.1);
      R.term(a, {
        x: 63, y: 112, w: 390, at: mark('v2-1', 'my'), title: 'terminal',
        lines: [
          { text: 'git status', at: mark('v2-1', 'my') + 0.1, kind: 'cmd' },
          { text: 'nothing to commit, working tree clean', at: mark('v2-1', 'changed'), kind: 'ok' },
        ],
      });
      const errorUntil = mark('v2-7', 'version') - 0.1;
      R.code(a, {
        x: 63, y: 214, w: 390, lang: 'plain', title: 'docker', at: mark('v2-2', 'yet'), until: errorUntil, how: 'pop',
        lines: [
          'docker.errors.DockerException:',
          'Error while fetching server API',
          'version: request() got an',
          { text: "unexpected keyword argument 'chunked'", hl: { part: "unexpected keyword argument 'chunked'", at: mark('v2-2', 'broke') } },
        ],
      }).classList.add('rk-code--error');
      // "Version two changed its API": the call inside requests that 2.0.0 rejects.
      R.code(a, {
        x: 63, y: 214, w: 390, lang: 'python', title: 'inside requests: its call to urllib3', at: errorUntil + 0.1,
        lines: [
          'response = self._make_request(',
          '    conn, method, url,',
          { text: '    chunked=chunked,', hl: { part: 'chunked=chunked', at: mark('v2-7', 'changed') } },
          ')',
        ],
      });
      R.label(a, '2.0.0 changed its API', { x: 70, y: 362, w: 376, at: mark('v2-7', 'api'), tone: 'red', align: 'center' });

      // Why: a tower of package bricks. docker sits on requests, which sits
      // on urllib3: each depends on the brick below it.
      const twoAt = mark('v2-6', 'two');
      R.plate(s, { x: 580, y: 372, w: 240, at: mark('v2-3', 'docker') - 0.2 });
      const upper = R.layer(s);
      const top = R.layer(upper);
      const oldU = R.pkg(s, {
        x: 590, y: 312, w: 220, h: 60, name: 'urllib3', version: '1.26', tone: 'blue', under: true, how: 'drop', at: mark('v2-4', 'urllib3') - 0.1,
        tags: [
          { at: mark('v2-5', 'pinned'), text: '1.26 · not pinned', kind: 'any' },
          { at: okAt, text: '<2.0.0 · pinned', kind: 'pinned' },
        ],
      });
      const requests = R.pkg(upper, { x: 590, y: 252, w: 220, h: 60, name: 'requests', tone: 'blue', under: true, how: 'drop', at: mark('v2-3', 'requests') });
      const docker = R.pkg(top, { x: 590, y: 192, w: 220, h: 60, name: 'docker', tone: 'blue', how: 'drop', at: mark('v2-3', 'docker') });
      R.label(s, 'calls ↓', { x: 828, y: 234, w: 74, at: mark('v2-3', 'calls'), tone: 'muted', size: 17 });
      R.label(s, 'calls ↓', { x: 828, y: 294, w: 74, at: mark('v2-4', 'calls'), tone: 'muted', size: 17 });
      R.label(s, 'nothing pinned', { x: 504, y: 326, w: 84, at: mark('v2-5', 'pinned'), until: mark('v2-6', 'two'), tone: 'red', size: 17 });
      kit.sticker(s, 'Clean install', { x: 626, y: 138, at: mark('v2-6', 'clean'), until: mark('v2-7', 'version'), iconName: 'resend', rotate: -4 });
      // "So a clean install got two": the old brick slides out, version 2.0.0
      // slides in with different studs, and the bricks above no longer seat.
      shift(oldU.node, twoAt, { opacity: 1, translate: '0 0' }, { opacity: 0, translate: '30px 0' }, 0.35);
      const newU = R.pkg(s, { x: 590, y: 312, w: 220, h: 60, name: 'urllib3', version: '2.0.0', tone: 'red', odd: true, how: 'none', at: twoAt, tags: [{ at: 0, text: '2.0.0', kind: 'new' }] });
      shift(newU.node, twoAt + 0.15, { opacity: 0, translate: '30px 0' }, { opacity: 1, translate: '0 0' }, 0.4);
      shift(upper, twoAt + 0.4, { translate: '0 0' }, { translate: '0 -12px' }, 0.3, EASE.back);
      // "Version two changed its API": the new studs.
      R.label(s, 'new studs: a changed API', { x: 500, y: 250, w: 84, at: mark('v2-7', 'changed'), until: okAt, tone: 'red', size: 16 });
      R.arrow(s, { x1: 572, y1: 300, x2: 600, y2: 305, at: mark('v2-7', 'changed'), until: okAt, tone: 'red' });
      // "And requests' calls broke too": the break travels up the tower,
      // each brick sliding off the one below.
      shift(upper, mark('v2-8', 'requests'), { translate: '0 -12px' }, { translate: '-10px -12px' }, 0.35, EASE.back);
      shift(top, mark('v2-8', 'broke'), { translate: '0 0' }, { translate: '-12px 0' }, 0.35, EASE.back);
      requests.cross(mark('v2-8', 'requests'), okAt);
      docker.cross(mark('v2-8', 'broke'), okAt);

      // The principle: "Pin dependency versions: nothing moves till you
      // choose." The old brick comes back, pinned, and the tower seats again.
      book.ribbon('Keep versions of your dependencies fixed', { at: pinAt });
      shift(newU.node, okAt, { opacity: 1, translate: '0 0' }, { opacity: 0, translate: '30px 0' }, 0.3);
      shift(oldU.node, okAt + 0.2, { opacity: 0, translate: '30px 0' }, { opacity: 1, translate: '0 0' }, 0.4);
      shift(upper, okAt + 0.5, { translate: '-10px -12px' }, { translate: '0 0' }, 0.4, EASE.back);
      shift(top, okAt + 0.5, { translate: '-12px 0' }, { translate: '0 0' }, 0.4, EASE.back);
      [docker, requests, oldU].forEach((p, i) => p.check(mark('v2-10', 'choose') + i * 0.12));
      const b = R.group(s, pinAt, leave);
      R.code(b, {
        x: 90, y: 126, w: 336, lang: 'plain', title: 'Pipfile (Python)', at: pinAt,
        lines: ['[packages]', { text: 'urllib3 = "<2.0.0"', hl: { part: 'urllib3 = "<2.0.0"', at: mark('v2-9', 'versions'), tone: 'green' } }, 'docker = "==7.1.0"'],
      });
      R.inkStamp(b, 'pinned', { x: 318, y: 252, at: mark('v2-9', 'versions') + 0.2, tone: 'green' });
      R.note(b, 'A lockfile is your parts list: every build gets the same bricks', { x: 90, y: 298, w: 336, at: mark('v2-9', 'versions') + 0.3, icon: 'list', small: true });
      R.note(b, 'Node.js: commit package-lock.json', { x: 90, y: 354, w: 336, at: okAt + 0.6, icon: 'pin', small: true });
    }

    // ----------------------------------------------------------------
    // Verse 3, case 2: Heartbleed, and the fix that reaches everyone
    // ----------------------------------------------------------------

    function verse3() {
      badge('Verse 3 · Update for patches', 'verse-3');
      const from = start('verse-3');
      const leave = end('verse-3');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const book = R.spread(s, { at: from, tab: 'Case 2 · Heartbleed', left: 'What happened', right: 'Why' });

      // What happened: "OpenSSL had a flaw; for two years, no one saw."
      const mineAt = before('v3-7');
      const a = R.group(s, from, mineAt);
      R.padlock(a, { x: 200, y: 112, size: 96, at: mark('v3-1', 'openssl'), crackAt: mark('v3-1', 'flaw'), label: 'OpenSSL 1.0.1 (TLS)' });
      R.timeline(a, {
        x: 96, y: 290, w: 320, at: mark('v3-2', 'for'), fillAt: mark('v3-2', 'two'), fillTo: mark('v3-2', 'saw'), fillTone: 'red',
        points: [
          { pos: 0, text: '2012: bug ships', at: mark('v3-2', 'for'), align: 'left' },
          { pos: 1, text: 'April 2014: found', at: mark('v3-2', 'saw'), align: 'right' },
        ],
      });
      R.label(a, '2 years unseen', { x: 96, y: 368, w: 320, at: mark('v3-2', 'saw'), tone: 'red', align: 'center' });

      // Why: "A request claimed a length; the server trusted it and sent back
      // its own memory: passwords, private keys."
      const fixAt = before('v3-9');
      const b = R.group(s, mark('v3-3', 'a') - 0.1, fixAt);
      // While the right page is still empty, the foreman points at the
      // cracked padlock on "flaw" and shrugs on "no one saw".
      foremanOnPage(700, from + 0.4, mark('v3-3', 'a') - 0.3, [
        [mark('v3-1', 'flaw'), 'point', { to: [248, 170], hold: 1.4 }],
        [mark('v3-2', 'saw'), 'shrug', { hold: 1 }],
      ]);
      R.code(b, {
        x: 514, y: 108, w: 236, lang: 'plain', title: 'heartbeat request', at: mark('v3-3', 'request'),
        lines: ['send back: "a"', { text: 'length: 64 KB', hl: { part: '64 KB', at: mark('v3-3', 'length') } }],
      });
      R.label(b, 'trusted, never checked', { x: 760, y: 136, w: 142, at: mark('v3-4', 'trusted'), tone: 'red', size: 17 });
      R.note(b, 'OpenSSL server', { x: 514, y: 212, w: 200, at: mark('v3-4', 'server'), icon: 'database' });
      R.note(b, 'Heartbleed: buffer over-read', { x: 724, y: 212, w: 176, at: mark('v3-6', 'keys'), tone: 'bad', small: true });
      R.code(b, {
        x: 514, y: 268, w: 386, lang: 'plain', title: 'reply: "a" + server memory', at: mark('v3-5', 'sent'),
        lines: [
          '"a" session=7f3a9c… user=ana',
          { text: 'password=••••••••', hl: { part: 'password=••••••••', at: mark('v3-6', 'passwords') } },
          { text: '-----BEGIN PRIVATE KEY-----', hl: { part: '-----BEGIN PRIVATE KEY-----', at: mark('v3-6', 'private') } },
        ],
      });

      // "I didn't write that bug, but I shipped it, all the same." Your app
      // is a build: your code brick sits on the OpenSSL brick. The X-ray
      // shows the crack inside.
      const pinAt = mark('v3-13', 'pinned');
      const shipped = mark('v3-8', 'shipped');
      const c = R.group(s, mineAt, pinAt - 0.1);
      const xray = R.show(kit.place(kit.el('div', 'rk-xray is-staged', c), 70, 108), shipped, undefined, 'fade');
      xray.style.width = '376px';
      xray.style.height = '154px';
      kit.el('div', 'rk-xray-label', xray, 'your app, X-rayed');
      R.plate(c, { x: 230, y: 240, w: 206, at: mark('v3-7', 'i') - 0.1 });
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
          { pos: 1, text: '7 April: 1.0.1g', at: mark('v3-9', 'week'), align: 'right' },
        ],
      });
      // Right page: "That's reuse on your side: one fix, shared by all."
      const d = R.group(s, fixAt, leave);
      R.label(d, 'Apps that update to 1.0.1g', { x: 512, y: 108, w: 380, at: mark('v3-10', 'to'), tone: 'muted', align: 'center', size: 18 });
      R.appGrid(d, { x: 590, y: 152, at: mark('v3-9', 'fix'), greenAt: mark('v3-10', 'all'), every: 0.13 });
      R.label(d, 'One fix, many apps', { x: 512, y: 312, w: 380, at: mark('v3-11', 'thats'), tone: 'green', align: 'center', size: 22 });
      R.tick(d, { x: 840, y: 150, at: mark('v3-12', 'all'), size: 56 });

      // The principle: "Pinned doesn't mean frozen: update to the fix, then test."
      book.ribbon('Pinned doesn’t mean frozen', { at: pinAt, until: mark('v3-14', 'update') });
      book.ribbon('Update to receive security patches', { at: mark('v3-14', 'update') });
      const e = R.group(s, pinAt, leave);
      R.pkg(e, {
        x: 120, y: 140, w: 280, name: 'openssl', version: '1.0.1f · pinned', tone: 'blue', at: pinAt,
        tags: [
          { at: mark('v3-13', 'mean'), text: '1.0.1g', kind: 'new' },
          { at: mark('v3-13', 'frozen'), text: '1.0.1g · pinned', kind: 'pinned' },
        ],
      });
      R.term(e, {
        x: 90, y: 240, w: 340, at: mark('v3-14', 'update'), title: 'terminal',
        lines: [
          { text: 'npm test', at: mark('v3-14', 'fix'), kind: 'cmd' },
          { text: '✓ all tests passed', at: mark('v3-14', 'test'), kind: 'ok' },
        ],
      });
    }

    // ----------------------------------------------------------------
    // Verse 4, case 3: left-pad, eslint-scope, and choosing well
    // ----------------------------------------------------------------

    function verse4() {
      badge('Verse 4 · Choose dependencies well', 'verse-4');
      const from = start('verse-4');
      const leave = end('verse-4');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const book = R.spread(s, { at: from, tab: 'Case 3 · left-pad', left: 'What happened', right: 'Why' });

      // What happened: "Left-pad: eleven lines that pad a string on the left."
      const failAt = before('v4-6');
      const a = R.group(s, from, failAt);
      R.code(a, {
        x: 66, y: 106, w: 384, lang: 'js', numbers: true, size: 15, title: 'left-pad, as published on npm', at: mark('v4-1', 'leftpad'),
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

      // What it does: "... that pad a string on the left." The right page
      // shows what left-pad is for: three numbers padded to width 3 line up
      // on the right. Padding bricks drop in on the left of 7 and 42 and
      // push their digits over, until all three share a right edge.
      const built = mark('v4-3', 'pulled') - 0.25;
      R.textAt(book.heads.right, 'What it does', [{ at: built - 0.2, text: 'Why' }]);
      R.padColumn(s, {
        x: 515, y: 150, values: ['7', '42', '317'], width: 3, caption: 'aligned on the right',
        at: mark('v4-1', 'lines'), padAt: mark('v4-2', 'pad'), every: 0.15, alignAt: mark('v4-2', 'string'), until: built - 0.2,
      });

      // Why: "Babel and React pulled it in through packages they used." Your
      // app is a build: it stands on react and babel-core, and babel-core
      // stands on more packages, which stand on one tiny brick, left-pad.
      const trickAt = before('v4-11');
      const b = R.group(s, built - 0.2, trickAt);
      R.plate(b, { x: 514, y: 354, w: 380, at: built - 0.2 });
      const right = R.layer(b);
      const app = R.layer(b);
      right.style.transformOrigin = '712px 298px';
      app.style.transformOrigin = '700px 186px';
      const leftpad = R.pkg(b, { x: 748, y: 298, w: 100, h: 56, name: 'left-pad', tone: 'blue', small: true, under: true, how: 'drop', at: built });
      R.pkg(b, { x: 528, y: 242, w: 172, h: 112, name: '… more packages', tone: 'blue', small: true, under: true, stack: true, how: 'drop', at: built + 0.1 });
      const more = R.pkg(right, { x: 712, y: 242, w: 172, h: 56, name: '… more packages', tone: 'blue', small: true, under: true, stack: true, how: 'drop', at: built + 0.15 });
      const react = R.pkg(b, { x: 528, y: 186, w: 172, h: 56, name: 'react', tone: 'blue', under: true, how: 'drop', at: built + 0.3 });
      const babel = R.pkg(right, { x: 712, y: 186, w: 172, h: 56, name: 'babel-core', tone: 'blue', under: true, how: 'drop', at: built + 0.35 });
      const yourApp = R.pkg(app, { x: 520, y: 130, w: 372, h: 56, name: 'your-app', tone: 'gold', how: 'drop', at: built + 0.5 });
      // "Through packages they used": the path down to left-pad lights.
      const through = mark('v4-4', 'through');
      [babel, more, leftpad].forEach((p, i) => R.classAt(p.node, 'is-path', through + i * 0.35));
      // "...they used": the tiny brick squashes and strains under all of it.
      // "Its author unpublished it": it goes poof. The build hangs in the
      // air for a cartoon beat, shivering, then the right column drops and
      // tips to the right with a bounce, and your-app, balanced on react's
      // corner like a seesaw, teeters before it settles askew.
      const gone = mark('v4-5', 'unpublished');
      const strainAt = mark('v4-4', 'used');
      R.strain(b, { x: 748, y: 298, w: 100, h: 56, at: strainAt, until: gone + 0.05 });
      tween(leftpad.node, [{ scale: '1 1' }, { scale: '1.06 0.92' }], strainAt, 0.3, EASE.out);
      tween(leftpad.node, [
        { scale: '1.06 0.92', rotate: '0deg', opacity: 1 },
        { scale: '1.2 1.2', rotate: '-6deg', opacity: 1, offset: 0.35 },
        { scale: '0.1 0.1', rotate: '35deg', opacity: 0 },
      ], gone, 0.4, EASE.in);
      R.dust(b, { x: 798, y: 328, at: gone + 0.15, duration: 0.9 });
      const hole = ghost(b, { x: 748, y: 298, w: 100, h: 56, at: gone + 0.45 });
      const hangAt = gone + 0.45;
      const dropAt = gone + 1.05;
      const FALL = 0.26;
      onFrame((t) => {
        let dx = 0;
        let dy = 0;
        let turn = 0;
        if (t >= hangAt && t < dropAt) dx = 1.6 * Math.sin((t - hangAt) * 2 * Math.PI * 9);
        if (t >= dropAt) {
          const fall = Math.min(1, (t - dropAt) / FALL) ** 2;
          const after = Math.max(0, t - dropAt - FALL);
          const rebound = after > 0 ? Math.exp(-after / 0.18) * Math.sin(after * 2 * Math.PI * 2.4) : 0;
          dy = 6 * fall - 4 * rebound;
          turn = 4 * fall - 1.5 * rebound;
        }
        right.style.translate = `${dx.toFixed(2)}px ${dy.toFixed(2)}px`;
        right.style.rotate = `${turn.toFixed(2)}deg`;
        let tip = 0;
        if (t >= dropAt + 0.1) {
          const u = t - dropAt - 0.1;
          tip = 2 * (1 - Math.exp(-u / 0.1)) + 1.5 * Math.exp(-u / 0.7) * Math.sin(u * 2 * Math.PI * 1.25);
        }
        app.style.rotate = `${tip.toFixed(2)}deg`;
      });
      yourApp.cross(mark('v4-6', 'failed'));
      // "Many never saw it: a dependency, deep down."
      [react, babel].forEach((p) => R.classAt(p.node, 'is-listed', mark('v4-7', 'many'), mark('v4-8', 'deep')));
      R.classAt(hole, 'is-ringed', mark('v4-8', 'dependency'));
      const say = (text, at, until, tone = 'red') => R.label(b, text, { x: 510, y: 366, w: 384, at, until, tone, align: 'center', size: 19 });
      say('transitive dependency', mark('v4-4', 'packages'), mark('v4-5', 'its'));
      say('unpublished, March 2016', gone, mark('v4-7', 'many'));
      say('what you listed: react, babel-core', mark('v4-7', 'never'), mark('v4-8', 'down'), 'ink');
      say('3 levels down', mark('v4-8', 'down'), trickAt);

      // "Thousands of builds failed."
      const hijackAt = before('v4-9');
      const c = R.group(s, failAt, hijackAt);
      ['thousands', 'builds', 'failed'].forEach((word, i) => R.term(c, {
        x: 70, y: 106 + i * 102, w: 380, at: mark('v4-6', word), title: `build ${i + 1}`, how: 'pop',
        lines: [{ text: "npm ERR! 404 'left-pad' is not in the npm registry", at: mark('v4-6', word), kind: 'err' }],
      }));

      // "When eslint-scope was hijacked, its new release stole tokens."
      const cryptoAt = before('v4-15');
      const d = R.group(s, hijackAt, cryptoAt);
      R.pkg(d, { x: 90, y: 116, w: 280, name: 'eslint-scope', version: '3.7.2', tone: 'blue', at: mark('v4-9', 'eslintscope'), tags: [{ at: mark('v4-9', 'hijacked'), text: '3.7.2 · malicious', kind: 'bad' }] });
      R.note(d, 'maintainer account taken over (July 2018)', { x: 90, y: 200, w: 340, at: mark('v4-9', 'hijacked'), tone: 'bad', icon: 'key' });
      const npmrc = R.code(d, { x: 90, y: 270, w: 300, lang: 'plain', title: '.npmrc', at: mark('v4-10', 'release'), lines: ['_authToken=npm_••••••••'] });
      tween(npmrc, [{ translate: '0 0' }, { translate: '46px 0' }], mark('v4-10', 'stole'), 0.6, EASE.inOut);
      R.label(d, 'stole npm tokens', { x: 90, y: 352, w: 340, at: mark('v4-10', 'stole'), tone: 'red', align: 'center' });

      // The principles: "Write trivial code yourself; keep dependencies few:
      // each one can break, be hijacked, or vanish out of view."
      book.ribbon('Avoid reusing trivial code', { at: mark('v4-11', 'write'), until: mark('v4-12', 'keep') });
      book.ribbon('Strive for fewer package dependencies', { at: mark('v4-12', 'keep'), until: mark('v4-16', 'dont') });
      const fameAt = before('v4-17');
      const e = R.group(s, trickAt, fameAt);
      R.code(e, {
        x: 512, y: 108, w: 386, lang: 'js', size: 15, title: 'isarray: the whole package, 1 line', at: mark('v4-11', 'trivial'),
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
      R.note(e, 'can break', { x: 512, y: 336, w: 104, at: mark('v4-13', 'break'), tone: 'bad', small: true });
      R.note(e, 'can be hijacked', { x: 624, y: 336, w: 150, at: mark('v4-13', 'hijacked'), tone: 'bad', small: true });
      R.note(e, 'can disappear', { x: 782, y: 336, w: 122, at: mark('v4-14', 'vanish'), tone: 'bad', small: true });

      // The boundary: "But code that's hard to get right, like crypto: don't write your own."
      const f = R.group(s, cryptoAt, leave);
      const homemade = R.code(f, {
        x: 90, y: 120, w: 330, lang: 'js', title: 'hand-written crypto', at: mark('v4-15', 'code'),
        lines: ['function myEncrypt (text) {', '  // my own cipher… secure?', '}'],
      });
      R.label(f, 'hard to get right', { x: 90, y: 246, w: 330, at: mark('v4-15', 'hard'), tone: 'muted', align: 'center' });
      R.tick(f, { x: 384, y: 104, at: mark('v4-16', 'dont'), kind: 'cross', size: 44 });
      R.classAt(homemade, 'is-struck', mark('v4-16', 'dont'));
      R.pkg(f, { x: 96, y: 296, w: 320, name: 'vetted crypto library', tone: 'blue', how: 'drop', at: mark('v4-16', 'write') }).check(mark('v4-16', 'own'));
      book.ribbon('Don’t roll your own crypto', { at: mark('v4-16', 'dont'), until: mark('v4-18', 'fit') });

      // "Choose maintained and popular, but fit comes before fame." The
      // project is a wall with a gap: the popular brick is too big for it,
      // a smaller one fits.
      const g = R.group(s, fameAt, leave);
      R.note(g, 'A · updated weekly · many users · good docs', { x: 512, y: 108, w: 386, at: mark('v4-17', 'maintained'), tone: 'good', icon: 'check' });
      R.note(g, 'B · last commit 4 years ago', { x: 512, y: 170, w: 386, at: mark('v4-17', 'popular') - 0.3, icon: 'hourglass' });
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
      book.ribbon('Fit matters more than popularity', { at: mark('v4-18', 'fit') });
    }

    // ----------------------------------------------------------------
    // Bridge, case 4: Ariane 5 and a violated assumption
    // ----------------------------------------------------------------

    function bridge() {
      badge('Bridge · Check what it assumes', 'bridge');
      const from = start('bridge');
      const leave = end('bridge');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const book = R.spread(s, { at: from, tab: 'Case 4 · Ariane 5', left: 'What happened', right: 'Why' });

      // What happened: the same gold module flies on two rockets: Ariane 4,
      // then Ariane 5, each with a cut-away window onto its equipment bay.
      const verdictAt = before('br-9');
      const a = R.group(s, from, verdictAt);
      const sky = kit.place(kit.el('div', 'rk-clip', a), 56, 98);
      sky.style.width = '404px';
      sky.style.height = '292px';
      R.rocket(sky, { x: 40, y: 6, name: 'Ariane 4', kind: 'ariane4', at: mark('br-1', 'code'), module: mark('br-1', 'ariane'), launchAt: mark('br-4', 'since'), until: mark('br-5', 'five') + 0.4 });
      const irsUntil = mark('br-4', 'since') - 0.9;
      R.label(sky, 'Inertial Reference System: the gold module', { x: 160, y: 80, w: 220, at: mark('br-1', 'built'), until: irsUntil, size: 18 });
      R.arrow(sky, { x1: 156, y1: 112, x2: 114, y2: 102, bend: -6, at: mark('br-1', 'built') + 0.2, until: irsUntil });
      const reusedAt = mark('br-5', 'reused');
      R.arrow(a, { x1: 160, y1: 240, x2: 296, y2: 240, at: reusedAt, until: mark('br-6', 'which'), label: 'reused', labelAt: [196, 206] });
      R.rocket(sky, {
        x: 244, y: 6, name: 'Ariane 5', kind: 'ariane5', at: reusedAt, module: mark('br-5', 'five'),
        launchAt: mark('br-6', 'which'), veerAt: mark('br-8', 'veered'), bloomAt: mark('br-8', 'selfdestructed'),
      });

      // Why: the 16-bit gauge.
      const rule = mark('br-12', 'identify');
      const b = R.group(s, mark('br-2', 'stored') - 0.1, rule - 0.1);
      const flyA = mark('br-4', 'since');
      const flyB = mark('br-6', 'which');
      R.gauge(b, {
        x: 572, y: 104, at: mark('br-2', 'stored'), title: 'Horizontal velocity → 16-bit integer', limitAt: mark('br-3', 'sixteen'),
        values: [[0, 0], [flyA, 0], [flyA + 1.6, 21000], [mark('br-5', 'reused'), 21000], [mark('br-5', 'five'), 0], [flyB, 0], [mark('br-6', 'overflow'), 39000]],
      });
      R.label(b, 'fits ✓', { x: 590, y: 336, w: 220, at: mark('br-4', 'slower'), until: mark('br-5', 'five'), tone: 'green', align: 'center', size: 22 });
      R.inkStamp(b, 'Overflow', { x: 606, y: 336, at: mark('br-6', 'overflow'), until: mark('br-8', 'veered'), tone: 'red', rotate: -4 }).classList.add('rk-stamp--big');
      R.label(b, 'T + 37 s', { x: 590, y: 396, w: 220, at: mark('br-7', 'thirtyseven'), tone: 'red', align: 'center', size: 28 });

      // "It worked where it was built, and failed where it was sent: its
      // assumption didn't hold."
      const driftAt = before('br-16');
      const c = R.group(s, verdictAt, driftAt);
      R.note(c, 'Ariane 4: fits ✓', { x: 90, y: 120, w: 340, at: mark('br-9', 'worked'), tone: 'good', icon: 'check' });
      R.note(c, 'Ariane 5: overflows ✗', { x: 90, y: 186, w: 340, at: mark('br-10', 'failed'), tone: 'bad', icon: 'cross' });
      R.note(c, 'Assumes: horizontal velocity fits in 16 bits', { x: 90, y: 260, w: 340, at: mark('br-11', 'assumption'), tone: 'tag', icon: 'pin' });
      R.note(c, 'Cost of the failure: $370 million', { x: 90, y: 340, w: 340, at: verdictAt, tone: 'bad', icon: 'cash' });

      // The principle: identify violated assumptions, in three steps.
      book.ribbon('Identify violated assumptions', { at: rule, until: mark('br-17', 'version') });
      const d = R.group(s, rule, leave);
      R.checkboxes(d, {
        x: 524, y: 118, w: 370, at: rule,
        items: [
          { text: 'Check the documentation and the code', at: mark('br-13', 'docs') },
          { text: 'Check it was designed for your conditions', at: mark('br-14', 'built') },
          { text: 'Test it', at: mark('br-15', 'test') },
        ],
      });
      R.term(d, {
        x: 524, y: 270, w: 370, at: mark('br-15', 'then'), title: 'ground test bench',
        lines: [
          { text: 'simulate ariane5_flight', at: mark('br-15', 'then') + 0.1, kind: 'cmd' },
          { text: '✗ overflow at T+37 s: caught before launch', at: mark('br-15', 'goes'), kind: 'err' },
        ],
      });

      // "If two systems drift apart, version it, or clone and own: copy it,
      // so each can change." One module brick becomes two, one per team.
      const e = R.group(s, driftAt, leave);
      R.pkg(e, { x: 66, y: 196, w: 120, name: 'IRS', tone: 'gold', at: mark('br-16', 'two') });
      R.arrow(e, { x1: 190, y1: 210, x2: 248, y2: 140, at: mark('br-16', 'drift'), bend: -8 });
      R.arrow(e, { x1: 190, y1: 236, x2: 248, y2: 262, at: mark('br-16', 'drift'), bend: 8 });
      R.note(e, 'Ariane 4: 16 bits', { x: 252, y: 112, w: 196, at: mark('br-16', 'two'), until: mark('br-17', 'or'), small: true });
      R.note(e, 'Ariane 5: 32 bits', { x: 252, y: 236, w: 196, at: mark('br-16', 'two') + 0.15, until: mark('br-17', 'or'), small: true });
      R.pkg(e, { x: 252, y: 108, w: 196, name: 'IRS v1', version: '16-bit', tone: 'gold', how: 'drop', at: mark('br-17', 'or') });
      R.pkg(e, { x: 252, y: 230, w: 196, name: 'IRS v2', version: '32-bit', tone: 'gold', how: 'drop', at: mark('br-17', 'clone') });
      R.note(e, 'Ariane 4 team', { x: 270, y: 182, w: 160, at: mark('br-18', 'copy'), small: true, icon: 'team' });
      R.note(e, 'Ariane 5 team', { x: 270, y: 304, w: 160, at: mark('br-18', 'it'), small: true, icon: 'team' });
      book.ribbon('Evolve separately: version it, or clone and own', { at: mark('br-17', 'version') });
    }

    // ----------------------------------------------------------------
    // Verse 5, case 5: library or framework, who calls whom
    // ----------------------------------------------------------------

    function verse5() {
      badge('Verse 5 · Who calls whom?', 'verse-5');
      const from = start('verse-5');
      const leave = end('verse-5');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const book = R.spread(s, { at: from, tab: 'Case 5 · Library or framework', left: 'Library', right: 'Framework' });
      const ask = mark('v5-2', 'ask');
      const youCall = mark('v5-3', 'call');
      const itCalls = mark('v5-4', 'calls');

      // Library: "I call axios when I choose." A loose brick you pick up and
      // place where you want it.
      R.pkg(s, { x: 76, y: 120, w: 160, name: 'your code', tone: 'gold', at: from + 0.3 });
      R.pkg(s, { x: 300, y: 120, w: 140, name: 'axios', tone: 'blue', at: from + 0.4 });
      R.arrow(s, { x1: 240, y1: 147, x2: 296, y2: 147, at: ask, until: youCall, dashed: true, tone: 'muted', label: '?', labelAt: [260, 104] });
      R.arrow(s, { x1: 240, y1: 147, x2: 296, y2: 147, at: youCall, label: 'you call it', labelAt: [212, 186] });
      R.code(s, { x: 70, y: 226, w: 380, lang: 'js', at: mark('v5-3', 'axios'), lines: ['const response = await axios', "  .get('/user?ID=12345');"] });

      // Framework: "Express calls my code." A baseplate with a socket that
      // decides where your brick goes.
      R.plate(s, { x: 512, y: 168, w: 392, h: 34, label: 'Express (the framework)', tone: 'grey', at: from + 0.3 });
      const socket = ghost(s, { x: 660, y: 112, w: 150, h: 56, at: ask, until: itCalls });
      socket.classList.add('rk-ghost--socket');
      R.label(s, '?', { x: 660, y: 124, w: 150, at: ask, until: itCalls, align: 'center', tone: 'muted', size: 24 });
      const handler = R.pkg(s, { x: 660, y: 112, w: 150, h: 56, name: 'your handler', tone: 'gold', how: 'drop', at: itCalls - 0.1 });
      R.arrow(s, { x1: 600, y1: 166, x2: 652, y2: 140, at: itCalls, until: mark('v5-6', 'dont'), bend: -10, label: 'it calls you', labelAt: [516, 118] });
      R.code(s, { x: 514, y: 226, w: 386, lang: 'js', at: mark('v5-4', 'express'), lines: ["app.get('/', (req, res) => {", "  res.send('Hello World!')", '})'] });

      // "That's the Hollywood Principle: don't call us, we'll call you."
      book.ribbon('Hollywood Principle', { at: mark('v5-5', 'hollywood'), sub: '(inversion of control)' });
      const request = R.note(s, 'GET /', { x: 518, y: 122, w: 104, at: mark('v5-6', 'dont'), until: mark('v5-7', 'decides'), small: true, icon: 'globe' });
      tween(request, [{ translate: '0 0' }, { translate: '38px 0' }], mark('v5-6', 'call'), 0.4, EASE.inOut);
      handler.ring(mark('v5-6', 'you'), mark('v5-7', 'more'), 'green');

      // "It decides more; I write less, but it's harder to undo." The
      // framework's own bricks go up around yours.
      R.pkg(s, { x: 528, y: 112, w: 124, h: 56, name: 'routing', tone: 'grey', small: true, how: 'drop', at: mark('v5-7', 'decides') });
      R.pkg(s, { x: 818, y: 112, w: 80, h: 56, name: 'server', tone: 'grey', small: true, how: 'drop', at: mark('v5-7', 'more') });
      R.label(s, 'It decides more. You write less.', { x: 514, y: 330, w: 386, at: mark('v5-7', 'decides'), align: 'center' });
      const locked = ghost(s, { x: 518, y: 98, w: 386, h: 112, at: mark('v5-8', 'but') });
      locked.classList.add('rk-ghost--frame');
      R.label(s, 'Harder to reverse', { x: 514, y: 362, w: 386, at: mark('v5-8', 'but'), align: 'center', tone: 'red' });
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
      R.spread(s, { at: from, tab: 'Your cases' });
      R.label(s, 'Your turn!', { x: 56, y: 108, w: 404, at: mark('quiz-0', 'your'), until: before('quiz-1'), align: 'center', size: 40, weight: 900 });
      R.label(s, 'Try these cases.', { x: 500, y: 214, w: 404, at: mark('quiz-0', 'turn'), until: before('quiz-1'), align: 'center', size: 28, tone: 'muted' });
      // The foreman hands over: a thumbs-up, then a point at the cases.
      foremanOnPage(258, mark('quiz-0', 'your') - 0.2, before('quiz-1') - 0.1, [
        [mark('quiz-0', 'your') + 0.1, 'thumbs', { hold: 0.6 }],
        [mark('quiz-0', 'try'), 'point', { to: [700, 230], hold: 1 }],
      ]);

      const ART = {
        1: (g, q) => {
          R.term(g, { x: 512, y: 120, w: 380, at: q.start + 0.2, title: 'terminal', lines: [{ text: 'npm install is-even', at: q.start + 0.3, kind: 'cmd', wait: true }] });
          R.code(g, { x: 512, y: 236, w: 380, lang: 'js', at: mark('quiz-1', 'number'), lines: ['const isEven = (n) => n % 2 === 0;'] });
          R.tick(g, { x: 852, y: 112, at: q.answer_at, kind: 'cross', size: 36 });
          R.tick(g, { x: 852, y: 226, at: mark('quiz-1', 'write'), size: 36 });
        },
        2: (g, q) => {
          R.code(g, { x: 512, y: 120, w: 380, lang: 'js', title: 'hand-written crypto', at: q.start + 0.3, lines: ['function myEncrypt (text) {', '  // my own cipher', '}'] });
          R.pkg(g, { x: 560, y: 278, w: 300, name: 'vetted crypto library', tone: 'blue', at: mark('quiz-2', 'encryption') }).check(mark('quiz-2', 'tested'));
          R.tick(g, { x: 852, y: 112, at: q.answer_at, kind: 'cross', size: 36 });
        },
        3: (g, q) => {
          R.pkg(g, {
            x: 560, y: 124, w: 280, name: 'library', version: '==3.4.1 · pinned', tone: 'blue', at: q.start + 0.2,
            tags: [{ at: q.answer_at, text: '3.4.2', kind: 'new' }, { at: mark('quiz-3', 'then'), text: '==3.4.2 · pinned', kind: 'pinned' }],
          });
          R.note(g, 'Security fix in 3.4.2', { x: 560, y: 220, w: 280, at: mark('quiz-3', 'security'), tone: 'good', icon: 'shield' });
          R.term(g, { x: 560, y: 284, w: 280, at: mark('quiz-3', 'then'), title: 'terminal', lines: [{ text: '✓ all tests passed', at: mark('quiz-3', 'test'), kind: 'ok' }] });
        },
        4: (g, q) => {
          R.label(g, '03/04/2026', { x: 512, y: 112, w: 380, at: q.start + 0.2, align: 'center', size: 40, weight: 900 }).classList.add('rk-label--mono');
          R.note(g, 'Old code reads: March 4', { x: 560, y: 186, w: 280, at: mark('quiz-4', 'code'), icon: 'calendar' });
          R.note(g, 'Users in Europe mean: 3 April', { x: 560, y: 248, w: 280, at: mark('quiz-4', 'europe'), icon: 'user' });
          R.label(g, 'assumes month first', { x: 512, y: 318, w: 380, at: mark('quiz-4', 'check'), tone: 'red', align: 'center' });
        },
        5: (g, q) => {
          // Two app bricks stand on one shared module brick.
          const splitAt = mark('quiz-5', 'clone');
          const shared = R.pkg(g, { x: 560, y: 290, w: 300, h: 48, name: 'shared module', tone: 'blue', under: true, how: 'drop', at: mark('quiz-5', 'module') });
          R.pkg(g, { x: 566, y: 236, w: 140, h: 48, name: 'App A', tone: 'gold', how: 'drop', at: q.start + 0.2 });
          const leaning = R.layer(g);
          const appB = R.pkg(leaning, { x: 714, y: 236, w: 140, h: 48, name: 'App B', tone: 'gold', how: 'drop', at: q.start + 0.3 });
          shift(leaning, mark('quiz-5', 'drift'), { translate: '0 0' }, { translate: '12px -14px' }, 0.45, EASE.back);
          appB.cross(mark('quiz-5', 'apart'), splitAt + 0.4);
          R.label(g, 'fine for A, breaks B', { x: 512, y: 362, w: 380, at: mark('quiz-5', 'needs'), until: mark('quiz-5', 'clone'), tone: 'red', align: 'center', size: 18 });
          // "Version it, or clone and own": B gets its own copy of the module.
          tween(shared.node, [{ width: '300px' }, { width: '146px' }], splitAt, 0.4, EASE.inOut);
          const copy = R.pkg(g, { x: 714, y: 290, w: 146, h: 48, name: 'module v2', tone: 'blue', small: true, under: true, how: 'none', at: splitAt });
          shift(copy.node, splitAt + 0.15, { opacity: 0, translate: '20px 0' }, { opacity: 1, translate: '0 0' }, 0.4);
          shift(leaning, splitAt + 0.5, { translate: '12px -14px' }, { translate: '0 0' }, 0.4, EASE.back);
          appB.check(splitAt + 0.9);
        },
        6: (g, q) => {
          R.pkg(g, { x: 512, y: 112, w: 150, name: 'pytest', tone: 'grey', at: q.start + 0.2 });
          R.arrow(g, { x1: 588, y1: 168, x2: 588, y2: 226, at: mark('quiz-6', 'runs'), label: 'calls', labelAt: [604, 182] });
          R.code(g, { x: 512, y: 234, w: 386, lang: 'python', title: 'test_fizzbuzz.py (the TDD tutorial)', at: mark('quiz-6', 'tests'), lines: ['def test_multiple_of_three_is_fizz():', "    assert fizzbuzz(3) == 'Fizz'"] });
          R.label(g, 'it calls your code', { x: 680, y: 128, w: 220, at: mark('quiz-6', 'framework_2'), tone: 'green', align: 'center' });
        },
      };
      const QUESTIONS = [
        [1, 'pencil'], [2, 'shield'], [3, 'pin'], [4, 'search'], [5, 'copy'], [6, 'resend'],
      ];
      QUESTIONS.forEach(([n, icon]) => {
        const q = line(`quiz-${n}`);
        const until = n < 6 ? before(`quiz-${n + 1}`) : leave;
        R.quiz(s, { x: 60, y: 110, w: 396, n, total: 6, question: q.text, answer: q.answer, icon, at: q.start - 0.1, answerAt: q.answer_at, until });
        ART[n](R.group(s, q.start - 0.1, until), q);
      });
    }

    // ----------------------------------------------------------------
    // Outro: back at the laptop, and the build is done
    // ----------------------------------------------------------------

    function outro() {
      badge('Outro · Reuse done right', 'outro');
      const from = start('outro');
      const leave = song.duration;
      const s = kit.scene(content, from, leave - 0.2, { exit: 'fade' });
      const done = mark('outro-3', 'thats');
      student?.appear({ from: from + 0.1, to: done - 0.3, x: 60, y: 150, scale: 0.95 });
      // "That's reuse done right": the foreman carries a gold brick in and
      // gives the finished build a thumbs-up.
      window.OperaCast?.figure(content, {
        ...FOREMAN,
        stage: [[done - 0.1, leave - 0.2, { enter: 'left' }]],
        places: [[done - 0.1, 200, 470, 1, 0]],
        holds: [[0, 'right', 'brick']],
        moves: [
          [done + 0.4, 'point', { to: [560, 330], hold: 0.9 }],
          [mark('outro-3', 'right'), 'thumbs', { hold: 1.4, side: 'left' }],
        ],
      });
      const builtIn = mark('outro-2', 'need');
      R.term(s, {
        x: 380, y: 96, w: 520, at: from + 0.1, title: 'terminal',
        lines: [
          { text: 'npm install left-pad', at: from + 0.2, until: builtIn, kind: 'cmd', wait: true },
          { text: 'String(str).padStart(length, paddingCharacter)', at: builtIn + 0.1, kind: 'cmd', wait: true },
        ],
      });
      R.label(s, 'Eleven lines → one built-in', { x: 380, y: 168, w: 520, at: mark('outro-2', 'built'), tone: 'light', align: 'center', size: 22 });
      // "That's reuse done right." The five cases snap together into one
      // build: lessons to keep, so gold.
      const book = cover(s, { x: 430, y: 210, w: 420, h: 240, at: done - 0.1 });
      R.plate(book, { x: 20, y: 206, w: 200, at: done });
      ['framework', 'Ariane 5', 'left-pad', 'Heartbleed', 'urllib3'].forEach((name, i) => {
        R.pkg(book, { x: 30, y: 178 - i * 28, w: 180, h: 28, name, tone: 'gold', small: true, under: i < 4, how: 'drop', at: done + 0.2 + i * 0.18 });
      });
      const words = R.label(book, 'Reuse done right', { x: 232, y: 150, w: 170, at: mark('outro-3', 'right'), tone: 'green', size: 28, weight: 900 });
      words.classList.add('rk-cover-done');
    }

    intro();
    verse1();
    refrain('refrain-1', 'refrain1');
    verse2();
    verse3();
    refrain('refrain-2', 'refrain2', { tabs: { pin: ['urllib3', 'Heartbleed'] } });
    verse4();
    bridge();
    verse5();
    quiz();
    refrain('refrain-3', 'refrain3', { tabs: { assume: ['Ariane 5'], pull: ['left-pad'], pin: ['urllib3', 'Heartbleed'] }, confetti: true });
    outro();
  };
})();
