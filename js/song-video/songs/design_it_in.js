/*
 * Choreography for "Design It In Before They Break In", the security song
 * (storyboard: _data/songs/design_it_in.yml).
 *
 * Every visual hits a sung word: `mark(lineId, word)` is that word's time in
 * the recording. The teaching rule: show exactly what the line says, one
 * idea at a time, in a frontier-town language whose pictures carry the
 * concept (js/song-video/western-kit.js): the security plan is a board of
 * four nailed posters, one per question, and each principle is a stamp
 * pinned under the question it answers, so the board fills in as the song
 * teaches it, and each principle's verse ends on a picture of it at work
 * (principle-scenes.js); secrets are brass keys and protection mechanisms
 * padlocks; an attack is a crimson attack vector striking its way in, and
 * stolen data travels away on an amber trail. The lecture's own artifacts
 * (the login form, the post with comments, the network map, the four
 * services) stand beside the pictures, and the code is the lecture's own,
 * on slates.
 *
 * The viewer's own SE Gym hero plays the town sheriff (sheriff.js), the
 * "you" the tester sings to, in every scene with room for it. The singer,
 * the hired tester, is the masked outlaw (outlaw.js): it sneaks in during
 * the intro, takes the key from under the porch's flowerpot and unlocks
 * the admin door in verse 2, collects the stolen cookies in verse 3, and in
 * the closing bars falls for a honeypot with a line of little AI agents
 * behind it.
 *
 * Layout: 960×540 stage; the section badge sits top-left, the scene's plank
 * sign top-centre, and nothing essential goes below y = 460, where the
 * player draws captions.
 */
(function () {
  'use strict';

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.design_it_in = function choreograph({ song, kit, layers, student }) {
    const { tween, EASE } = window.Timeline;
    const W = window.WesternKit;
    const PS = window.PrincipleScenes;
    const { content, hud } = layers;
    const mark = (id, word) => song.mark(id, word);
    const line = (id) => song.line(id);
    const start = (id) => song.sectionStart(id);
    const end = (id) => song.sectionEnd(id);
    /** Just before line `id` starts: where one picture hands over to the next. */
    const before = (id) => line(id).start - 0.15;
    const HERO = student?.heroHead();
    // The sheriff mouths the song: its mouth opens on every sung word.
    const WORDS = window.Sheriff?.wordsOf(song.storyboard) ?? [];
    const SCALE = 0.86, FEET = 452;
    const OUTLAW_SCALE = 0.86;   // the sheriff's scale: one world, one size

    function badge(text, sectionId) {
      kit.badge(hud, text, start(sectionId), end(sectionId));
    }

    /**
     * The sheriff with its feet on the street at stage x (its centre), from
     * `from` to `until`; moves are [[time, name, options]] (sheriff.js).
     */
    function sheriff(parent, x, from, until, { moves = [], holds = [], entrance = 'right', scale = SCALE } = {}) {
      return window.Sheriff?.sheriff(parent, {
        x: x - 80 * scale, y: FEET - 300 * scale, scale, at: from, until, entrance, moves, holds, hero: HERO, words: WORDS,
      });
    }

    /**
     * The outlaw (outlaw.js), the hired tester who breaks in first, from
     * `from` to `until`; `route` = [[time, x, y, facing?]] with the feet at
     * stage (x, y) (outlaw.js sneaks between them), moves = [[time, name,
     * options]], holds = [[time, hand, prop]].
     */
    function outlaw(parent, from, until, { route, moves = [], holds = [], scale = OUTLAW_SCALE } = {}) {
      return window.Outlaw?.outlaw(parent, { at: from, until, route, moves, holds, scale });
    }

    /** [[index, from], …] as [[index, from, to]], each lit until the next lights (the last until `last`). */
    function continuous(keys, last) {
      return keys.map(([i, from], k) => [i, from, k + 1 < keys.length ? keys[k + 1][1] : last]);
    }

    /** The scene's plank sign: the plan question being answered. */
    function header(parent, text, sub, at, until, { y = 50 } = {}) {
      return W.plank(parent, text, { x: 250, y, w: 460, sub, at, until });
    }

    // ----------------------------------------------------------------
    // Intro: your app, someone who wants in, and a plan
    // ----------------------------------------------------------------

    function intro() {
      badge('Intro · Design Security in', 'intro');
      const leave = end('intro');
      const s = kit.scene(content, 0.2, leave, { exit: 'fade' });
      // While the whistle plays: the title poster.
      const appAt = mark('intro-1', 'app') - 0.2;
      W.poster(s, { x: 150, y: 96, w: 620, kicker: 'A song about designing for security', title: 'Design Security In\nBefore They Break In', lines: ['CS 35L · Security'], at: 1, until: appAt, className: 'wk-poster--title' });
      // "So, you built a web app."
      const planAt = mark('intro-4', 'lets') - 0.2;
      // "Let's design security in, before they do." The app becomes a house
      // (the porch of verse 2 and the outro); on "design" a blueprint of a
      // lock appears on its door, and on "before" the real padlock slams on,
      // just ahead of the outlaw's lockpick.
      const design = mark('intro-4', 'design'), lockAt = mark('intro-4', 'before') - 0.05;
      // The gag's beats after the lock lands, stretched to the room the take
      // leaves before verse 1 (k = 1 for 5 s; the exit gets what is left).
      const k = Math.min(1.6, Math.max(0.8, (leave - 0.4 - lockAt) / 5));
      const beat = (offset) => lockAt + offset * k;
      const house = W.porch(s, { x: 330, ground: FEET, w: 280, sign: 'YOUR APP', at: planAt });
      const [lockX, lockY] = house.point('lock');
      W.padlock(s, { x: lockX - 32, y: lockY - 44, size: 64, tone: 'brass', sketchAt: design + 0.1, at: lockAt, how: 'slam', jiggleAt: beat(2.3) });
      header(s, 'Design Security in', undefined, planAt, leave, { y: 58 });
      sheriff(content, 868, 2, leave - 0.3, {
        moves: [
          [5.6, 'tip', { hold: 1 }], [mark('intro-2', 'break') + 0.2, 'look', { dir: -1, hold: 1.4 }],
          [design, 'point', { to: [lockX, lockY], hold: 1.6 }], [lockAt + 0.1, 'nod'], [beat(3.5), 'tip', { hold: 0.8 * k }],
        ],
      });
      const { view } = W.browser(s, { x: 220, y: 92, w: 420, h: 268, at: appAt + 0.3, until: planAt });
      W.post(view);
      // "Somebody out there might try to break in." The outlaw tiptoes in from
      // the desert, peeks at the app, and an attack vector goes for its
      // comment box. "You hired me to break in first." The outlaw turns to
      // you: an authorized tester. Then the gag: it pulls out a lockpick and
      // tiptoes past the blueprint to the door, the padlock slams on in front
      // of its hand, and it freezes, gives you a look, picks at the lock (it
      // only rattles), shakes its hand, shrugs, and tiptoes off backwards as
      // the scene fades.
      const o = W.overlay(s);
      W.vector(o, 'M168 326 C196 326 222 334 250 338', { at: mark('intro-2', 'break'), until: planAt, duration: 0.5 });
      const STOP = Math.round(lockX - 64);
      const exitAt = beat(3.9);
      // All the way out if there is time, else a few steps before the fade.
      const exitX = leave - 0.2 - exitAt > 2 ? -110 : STOP - 200;
      outlaw(content, mark('intro-2', 'somebody') - 0.3, leave - 0.1, {
        route: [
          [mark('intro-2', 'somebody') - 0.3, -70, FEET, 1], [mark('intro-2', 'try') + 0.1, 112, FEET, 1],
          [design + 0.9, 112, FEET, 1], [lockAt - 0.3, STOP, FEET, 1], [exitAt, STOP, FEET, 1], [leave - 0.2, exitX, FEET, 1],
        ],
        moves: [
          [mark('intro-2', 'try'), 'peek', { dir: 1, hold: 0.7 }],
          [mark('intro-2', 'break'), 'reach', { to: [166, 326], shape: 'point', hold: 1.3 }],
          [mark('intro-3', 'hired') - 0.1, 'look', { dir: 'viewer', hold: 1.4 }],
          [mark('intro-3', 'first') + 0.5, 'look', { dir: 'viewer', hold: 0.8 }],
          [lockAt + 0.15, 'reach', { to: [lockX - 30, lockY + 14], shape: 'pinch', hold: 0.4 * k }],
          [beat(0.6), 'freeze', { hold: 0.7 * k }],
          [beat(1.4), 'look', { dir: 'viewer', hold: 0.7 * k }],
          [beat(2.3), 'reach', { to: [lockX - 12, lockY + 16], shape: 'pinch', hold: 0.4 * k }],
          [beat(2.9), 'shake', { hold: 0.4 * k }],
          [beat(3.5), 'shrug', { hold: 0.5 * k }],
        ],
        holds: [[design + 0.5, 'near', 'lockpick'], [beat(2.85), 'near', null]],
      });
    }

    // ----------------------------------------------------------------
    // Verse 1: the Security Model
    // ----------------------------------------------------------------

    function verse1() {
      badge('Verse 1 · Security Model', 'verse-1');
      const from = start('verse-1');
      const leave = end('verse-1');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      header(s, '1 · Security Model', undefined, from + 0.1, mark('v1-2', 'what') - 0.1);
      header(s, '1 · Security Model', 'What are you defending?', mark('v1-2', 'what'));
      // "Before you choose the locks, ask what's in the box."
      const locks = W.group(s, from + 0.2, mark('v1-1', 'ask'));
      [0, 1, 2].forEach((i) => W.padlock(locks, { x: 90 + i * 76, y: 140, size: 58, at: from + 0.3 + i * 0.1 }));
      tween(locks, [{ translate: '0 0' }, { translate: '-80px 0' }], mark('v1-1', 'locks'), 0.5, EASE.inOut);
      W.strongbox(s, { x: 390, y: 168, w: 170, at: mark('v1-1', 'ask') - 0.2, openAt: mark('v1-1', 'box'), until: before('v1-4') });
      sheriff(content, 850, from + 0.3, leave - 0.3, {
        moves: [[mark('v1-1', 'box'), 'point', { to: [470, 220], hold: 1.2 }], [mark('v1-7', 'triad'), 'nod'], [mark('v1-8', 'three') - 0.2, 'draw', { hold: 2.6 }]],
      });
      // The assets, one per word, and the attribute each needs.
      const triAt = mark('v1-7', 'thats') - 0.1;
      const assets = W.group(s, mark('v1-3', 'passwords') - 0.1, triAt);
      W.asset(assets, 'password', { x: 40, y: 312, w: 150, at: mark('v1-3', 'passwords') });
      W.asset(assets, 'post', { x: 222, y: 312, w: 150, at: mark('v1-3', 'posts') });
      W.asset(assets, 'photo', { x: 404, y: 312, w: 130, at: mark('v1-3', 'photos') });
      W.asset(assets, 'site', { x: 566, y: 302, w: 130, at: mark('v1-3', 'site') });
      W.ciaCard(assets, { x: 30, y: 150, w: 200, name: 'Confidentiality', rule: 'read: authorized users only', iconName: 'eye', at: mark('v1-4', 'confidentiality') });
      W.ciaCard(assets, { x: 262, y: 150, w: 200, name: 'Integrity', rule: 'change: authorized users only', iconName: 'pencil', at: mark('v1-5', 'integrity') });
      W.ciaCard(assets, { x: 494, y: 150, w: 200, name: 'Availability', rule: 'there when it’s needed', iconName: 'timer', at: mark('v1-6', 'availability') });
      // "That's the CIA triad." The three cards in a triangle.
      const tri = W.group(s, triAt, leave);
      // The triangle the three attributes stand on, drawn behind the cards.
      const edges = W.overlay(tri);
      W.triangle(edges, [[415, 168], [252, 338], [578, 338]], { at: mark('v1-7', 'cia') - 0.3, duration: 0.8 });
      W.ciaCard(tri, { x: 310, y: 130, w: 210, name: 'Confidentiality', rule: 'read: authorized users only', iconName: 'eye', at: triAt, how: 'fade' });
      W.ciaCard(tri, { x: 150, y: 300, w: 200, name: 'Integrity', rule: 'change: authorized users only', iconName: 'pencil', at: triAt, how: 'fade' });
      W.ciaCard(tri, { x: 480, y: 300, w: 200, name: 'Availability', rule: 'there when it’s needed', iconName: 'timer', at: triAt, how: 'fade' });
      W.label(tri, 'CIA triad', { x: 340, y: 248, w: 150, at: mark('v1-7', 'cia'), tone: 'gold', align: 'center', size: 24 });
      // "Attackers can hit all three: read it, change it, or lock you out for
      // ransom." The outlaw sneaks in and fires an attack vector at each corner.
      const three = mark('v1-8', 'three');
      outlaw(content, mark('v1-8', 'attackers') - 1.4, leave - 0.5, {
        route: [[mark('v1-8', 'attackers') - 1.4, -70, FEET, 1], [mark('v1-8', 'attackers') - 0.1, 56, FEET, 1]],
        moves: [[three - 0.35, 'reach', { to: [250, 262], shape: 'point', hold: 1.6 }], [mark('v1-8', 'ransom'), 'look', { dir: 'viewer', hold: 1 }]],
      });
      const o = W.overlay(tri);
      W.vector(o, 'M122 286 C170 240 240 196 306 180', { at: three - 0.3, duration: 0.5 });
      W.vector(o, 'M122 300 C132 314 140 328 150 340', { at: three - 0.1, duration: 0.35 });
      W.vector(o, 'M800 470 C790 410 740 372 686 366', { at: three, duration: 0.4 });
      W.tag(tri, 'Equifax 2017: data of 147 million people taken', { x: 560, y: 132, w: 200, at: mark('v1-8', 'read'), tone: 'red', icon: 'eye' });
      W.tag(tri, 'Post changed: “USC IS BETTER!!!”', { x: 150, y: 400, w: 220, at: mark('v1-8', 'change'), tone: 'red', icon: 'pencil' });
      W.tag(tri, 'Hospital 2016: files locked for ransom', { x: 404, y: 384, w: 214, at: mark('v1-8', 'lock'), tone: 'red', icon: 'lock' });
    }

    // ----------------------------------------------------------------
    // The chorus: the plan board, a poster per question
    // ----------------------------------------------------------------

    function chorus(sectionId, prefix, pins) {
      const from = start(sectionId);
      const leave = end(sectionId);
      badge('Chorus · The Security Plan', sectionId);
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const at = (n, word) => mark(`${prefix}-${n}`, word);
      // The poster being sung, and the principle pinned under it, stay lit
      // until the next one lights, so something is always highlighted.
      const lights = continuous([[0, at(2, 'security')], [1, at(3, 'threat')], [2, at(4, 'attack')], [3, at(5, 'protection')]], at(6, 'design'));
      const ruleLights = lights.filter(([i]) => pins[i] !== undefined);
      W.planBoard(s, { x: 20, y: 58, w: 700, at: from, lights, ruleLights, pins, glowAt: at(6, 'design') });
      const POSTER_X = [108, 280, 452, 624];
      sheriff(content, 902, from + 0.2, leave - 0.3, {
        entrance: 'rise',
        moves: [
          [at(2, 'security'), 'point', { to: [POSTER_X[0], 200], hold: 3 }],
          [at(3, 'threat'), 'point', { to: [POSTER_X[1], 200], hold: 2.4 }],
          [at(4, 'attack'), 'point', { to: [POSTER_X[2], 200], hold: 2.4 }],
          [at(5, 'protection'), 'point', { to: [POSTER_X[3], 200], hold: 2.6 }],
          [at(6, 'design') + 0.3, sectionId === 'chorus-2' ? 'tip' : 'nod', {}],
        ],
      });
    }

    // ----------------------------------------------------------------
    // Verse 2: the Threat Model → Open Design
    // ----------------------------------------------------------------

    function verse2() {
      badge('Verse 2 · Threat Model', 'verse-2');
      const from = start('verse-2');
      const leave = end('verse-2');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      // The plank gives way to the code slate, so the porch has the stage below.
      header(s, '2 · Threat Model', 'Who might be attacking?', from + 0.1, mark('v2-4', 'code') - 0.25);
      // The wanted poster: who, and what they know, can do, spend, and want.
      const potAt = mark('v2-5', 'flowerpot') - 0.3;
      const a = W.group(s, from + 0.1, before('v2-6'));
      W.wanted(a, {
        x: 40, y: 128, w: 280, at: from + 0.2,
        fields: [
          { name: 'Knowledge', at: mark('v2-2', 'know'), value: 'has read your code', valueAt: mark('v2-4', 'read') },
          { name: 'Actions', at: mark('v2-2', 'do_2') },
          { name: 'Resources', at: mark('v2-3', 'spend') },
          { name: 'Incentive', at: mark('v2-3', 'why') },
        ],
      });
      // "Assume they've read your code": developer tools on the bundle; a
      // search for "admin" finds the secret link.
      // The admin route wraps, as a formatter would, so it fits the slate.
      W.slate(a, {
        x: 370, y: 52, w: 330, lang: 'js', title: 'DevTools · your front-end bundle', at: mark('v2-4', 'code'), size: 14.5,
        lines: [
          "{ path: '/', element: <Home /> },",
          { text: "{ path: '/admin-x7q',", hl: [{ part: "path: '/admin-x7q'", at: mark('v2-5', 'admin') }] },
          '  element: <Admin /> },',
        ],
      });
      W.label(a, 'Search: admin', { x: 748, y: 84, w: 172, at: mark('v2-5', 'secret'), icon: 'search' });
      // The app's house: its door is the admin page, and the key to it hides
      // under the flowerpot on the barrel by the door.
      const found = mark('v2-5', 'found');
      const obscurity = mark('v2-6', 'obscurity');
      const house = W.porch(s, {
        x: 380, ground: FEET, w: 280, sign: 'ADMIN', at: potAt, until: before('v2-7'),
        tipAt: found - 0.3, takeAt: found + 0.4, untipAt: found + 1.1, openAt: obscurity,
      });
      const point = (name) => house.point(name);
      // The outlaw, the attacker in question, poses beside the wanted poster,
      // reads the app's code through a magnifying glass, tips the flowerpot up
      // by its rim with one hand and takes the key with the other, sets the
      // pot down, and unlocks the door with the key as it swings open.
      outlaw(content, from + 0.3, mark('v2-6', 'lasts'), {
        route: [
          [from + 0.3, -70, FEET, 1], [mark('v2-1', 'after'), 404, FEET, 1], [mark('v2-5', 'secret') - 0.4, 404, FEET, 1],
          [found - 0.9, 490, FEET, 1], [found + 1.6, 490, FEET, 1], [obscurity - 0.55, 500, FEET, -1], [obscurity + 0.25, 500, FEET, -1],
          [mark('v2-6', 'lasts'), point('doorway')[0], FEET, -1],
        ],
        moves: [
          [mark('v2-1', 'after') + 0.15, 'look', { dir: 'viewer', hold: 1.2 }], [mark('v2-4', 'read') - 0.3, 'reach', { to: [440, 302], shape: 'grip', hold: 1.8 }],
          // A reach heads back to rest after its hold, so each hold ends as
          // the next reach of that hand begins (0.4 s before it arrives).
          [found - 0.7, 'reach', { to: point('rim'), hand: 'far', shape: 'grip', hold: 0.34 }], [found + 0.05, 'reach', { to: point('rimTipped'), hand: 'far', shape: 'grip', hold: 1.0 }],
          [found + 0.35, 'reach', { to: point('key'), shape: 'pinch', hold: 0.3 }], [found + 1.5, 'reach', { to: point('rim'), hand: 'far', shape: 'grip', hold: 0.2 }],
          [obscurity - 0.45, 'reach', { to: point('knob'), shape: 'pinch', hold: 0.6 }], [mark('v2-6', 'security'), 'look', { dir: 'viewer', hold: 0.6 }],
        ],
        holds: [[mark('v2-4', 'assume'), 'near', 'magnifier'], [mark('v2-5', 'secret') - 0.5, 'near', null], [found + 0.4, 'near', 'key']],
      });
      W.label(a, 'Admin page: no login', { x: 670, y: 262, w: 126, at: mark('v2-5', 'link') + 0.2, tone: 'red' });
      // "Security through obscurity lasts till someone looks."
      const lockAt = before('v2-7');
      const b = W.group(s, before('v2-6'), lockAt);
      W.plank(b, 'Security through obscurity', { x: 220, y: 60, w: 520, at: mark('v2-6', 'security'), tone: 'red' });
      W.tag(b, 'lasts till someone looks', { x: 340, y: 130, w: 280, at: mark('v2-6', 'obscurity'), icon: 'eye' });
      // "Use locks the world has tested, their blueprints out on view."
      const c = W.group(s, lockAt, before('v2-9'));
      header(c, '2 · Threat Model', 'Who might be attacking?', lockAt, before('v2-9'));
      // Tested locks, hung on a display board like hardware in a store.
      W.lockBoard(c, { x: 40, y: 120, w: 496, h: 168, title: 'Tested locks', at: mark('v2-7', 'locks') - 0.2 });
      ['AES', 'RSA', 'TLS'].forEach((name, i) => {
        W.padlock(c, { x: 95 + i * 180, y: 178, size: 70, label: name, hung: true, at: mark('v2-7', 'locks') + i * 0.12 });
      });
      // "...and the key stays with you": the key flies into the sheriff's raised hand.
      const stays = mark('v2-8', 'stays');
      const handed = W.key(c, { x: 590, y: 170, w: 170, label: 'AES secret key · RSA private key', at: mark('v2-8', 'the') - 0.25, until: stays + 0.6 });
      tween(handed, [{ translate: '0px 0px', scale: '1' }, { translate: '237px 62px', scale: '0.3' }], stays - 0.1, 0.45, EASE.inOut);
      // "Hiding versions helps a little, but never on its own."
      const d = W.group(s, before('v2-9'), mark('v2-10', 'open'));
      header(d, '2 · Threat Model', 'Who might be attacking?', before('v2-9'), mark('v2-10', 'open'));
      const { view } = W.browser(d, { x: 80, y: 140, w: 360, h: 170, url: 'your-app.example/oops', at: before('v2-9') + 0.1 });
      W.label(view, '500 · Something went wrong', { x: 12, y: 16, w: 300, tone: 'red', at: before('v2-9') + 0.2, how: 'fade' });
      W.tag(view, 'Express 4.17.1', { x: 12, y: 80, w: 200, at: before('v2-9') + 0.2, how: 'fade', redactAt: mark('v2-9', 'hiding') });
      W.label(d, 'An extra layer, never alone', { x: 80, y: 330, w: 300, at: mark('v2-9', 'versions'), tone: 'gold' });
      // "Open Design: knowing how it works shouldn't get them in." The lock's
      // blueprint hangs in public and its glass body shows every pin; it
      // still opens only with the key, which stays with the sheriff.
      const openAt = mark('v2-10', 'open');
      W.stamp(s, 'Open Design', { after: 'Principle', x: 150, y: 72, w: 560, rule: 'Knowing how it works shouldn’t get them in.', at: openAt });
      PS.blueprint(s, { x: 40, y: 202, w: 280, at: openAt + 0.45 });
      PS.clearLock(s, { x: 456, y: 194, size: 150, at: openAt + 0.25, jiggleAt: mark('v2-10', 'shouldnt') });
      W.tag(s, 'Only the key is secret', { x: 476, y: 404, w: 210, at: mark('v2-10', 'shouldnt'), icon: 'key', tone: 'brass' });
      // The outlaw studies the see-through lock through a magnifying glass,
      // tries its shackle, and shrugs.
      outlaw(content, openAt, leave, {
        route: [[openAt, 300, FEET, 1], [openAt + 0.8, 392, FEET, 1]],
        holds: [[openAt, 'near', 'magnifier'], [mark('v2-10', 'shouldnt') - 0.15, 'near', null]],
        moves: [
          [mark('v2-10', 'knowing') - 0.1, 'reach', { to: [426, 320], shape: 'grip', hold: 1.1 }], [mark('v2-10', 'shouldnt') - 0.1, 'reach', { to: [512, 244], shape: 'grip', hold: 0.9 }],
          [mark('v2-10', 'in'), 'shrug', { hold: 1 }],
        ],
      });
      sheriff(content, 880, from + 0.3, leave - 0.3, {
        holds: [[mark('v2-8', 'stays') + 0.35, 'right', 'key']],
        moves: [
          [mark('v2-1', 'who'), 'point', { to: [210, 180], hold: 1.6 }],
          [mark('v2-5', 'blink') + 0.2, 'look', { dir: -1, hold: 1.2 }],
          [mark('v2-8', 'stays'), 'hold', { to: [912, 262], hold: 3.2 }],
          [mark('v2-10', 'open') + 0.2, 'nod'],
        ],
      });
    }

    // ----------------------------------------------------------------
    // Verse 3: the Attack Surface → SQL injection
    // ----------------------------------------------------------------

    function verse3() {
      badge('Verse 3 · Attack Surface', 'verse-3');
      const from = start('verse-3');
      const leave = end('verse-3');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      // "Which parts are exposed? Every input they can send."
      const mapAt = before('v3-2');
      const a = W.group(s, from + 0.1, mapAt);
      header(a, '3 · Attack Surface', 'Which parts are exposed?', from + 0.1);
      // Your app as a building: every way in is part of its attack surface,
      // and an attack vector comes at each one from outside.
      const parts = mark('v3-1', 'parts');
      const front = W.appFront(a, { x: 120, y: 128, w: 560, at: from + 0.2, labels: { door: parts, window: parts + 0.15, hatch: parts + 0.3, sign: parts + 0.45 } });
      const o = W.overlay(a);
      const every = mark('v3-1', 'every');
      // The outlaw fires the vectors at the doors and window; more come in
      // from the far side.
      outlaw(content, from + 0.3, mapAt + 0.4, {
        route: [[from + 0.3, -40, FEET, 1], [parts, 50, FEET, 1], [mapAt - 0.3, 50, FEET, 1], [mapAt + 0.4, -60, FEET, -1]],
        moves: [[every - 0.3, 'reach', { to: [200, 292], shape: 'point', hold: 1.3 }]],
      });
      const approach = { door: 'M118 304 C150 318 186 336', window: 'M118 294 C200 250 320 262', hatch: 'M970 336 C860 334 700 334', sign: 'M970 128 C820 124 640 150' };
      ['door', 'window', 'hatch', 'sign'].forEach((name, i) => {
        const [px, py] = front.point(name);
        W.vector(o, `${approach[name]} ${px.toFixed(0)} ${py.toFixed(0)}`, { at: every + i * 0.14, duration: 0.45 });
      });
      // "Trust nothing by default, not even the boss's laptop."
      const formAt = before('v3-3');
      const b = W.group(s, mapAt, formAt);
      header(b, '3 · Attack Surface', 'Which parts are exposed?', mapAt);
      W.network(b, { x: 40, y: 130, at: mapAt + 0.1, boundary: 'server', checkAt: mark('v3-2', 'laptop') + 0.2 });
      W.label(b, 'Trust boundary', { x: 404, y: 334, w: 170, tone: 'green', align: 'center', at: mark('v3-2', 'trust') });
      // "In your password box, I typed code that's always true; you glued it
      // in your query, and the login let me through."
      const fixAt = before('v3-6');
      const c = W.group(s, formAt, fixAt);
      W.loginForm(c, {
        x: 120, y: 100, w: 240, at: formAt + 0.05, pass: '" or ""="', passAt: mark('v3-3', 'typed'), cps: 14,
        result: 'Logged in as Bruin', resultAt: mark('v3-4', 'let'),
      });
      outlaw(content, formAt, fixAt + 0.3, {
        route: [[formAt, -70, FEET, 1], [mark('v3-3', 'password'), 50, FEET, 1], [fixAt - 0.5, 50, FEET, 1], [fixAt + 0.3, -90, FEET, -1]],
        moves: [[mark('v3-3', 'typed') - 0.2, 'reach', { to: [180, 226], shape: 'point', hold: 1.6 }], [mark('v3-4', 'through'), 'look', { dir: 'viewer', hold: 1 }]],
      });
      W.slate(c, {
        x: 410, y: 88, w: 360, lang: 'python', title: 'login.py', at: mark('v3-4', 'glued') - 0.2,
        lines: [
          "sql = ('SELECT * FROM Users '",
          "       'WHERE Name = \"' + name + '\" '",
          { text: "       'AND Pass = \"' + pass + '\"')", hl: [{ part: '+ pass +', at: mark('v3-4', 'glued') }] },
        ],
      });
      W.slate(c, {
        x: 410, y: 220, w: 360, lang: 'sql', title: 'The query it builds', at: mark('v3-4', 'query'),
        lines: ['SELECT * FROM Users', 'WHERE Name = "Bruin"', { text: 'AND Pass = "" or ""=""', hl: [{ part: 'or ""=""', at: mark('v3-4', 'query') + 0.3 }] }],
      });
      W.label(c, '""="" is always true', { x: 624, y: 366, w: 186, tone: 'amber', at: mark('v3-4', 'query') + 0.35 });
      W.stamp(c, 'SQLi', { x: 404, y: 362, w: 170, rule: 'SQL injection', at: mark('v3-5', 'thats') - 0.1, tone: 'red' });
      // "Use a prepared statement: my input fills a slot and stays data, not code."
      const d = W.group(s, fixAt, leave);
      W.slate(d, {
        x: 40, y: 100, w: 470, lang: 'python', title: 'Prepared statement', at: mark('v3-6', 'prepared') - 0.2,
        lines: [
          "sql = ('SELECT * FROM Users '",
          "       'WHERE Name = @0 '",
          { text: "       'AND Pass = @1')", hl: [{ part: '@1', at: mark('v3-6', 'slot'), tone: 'green' }] },
          'user = db.execute_query(sql, name, pass)',
        ],
      });
      W.tag(d, '" or ""="  →  just a value', { x: 100, y: 266, w: 300, at: mark('v3-6', 'fills'), tone: 'green', icon: 'tag' });
      W.loginForm(d, { x: 548, y: 100, w: 230, at: fixAt + 0.1, pass: '" or ""="', passAt: fixAt + 0.3, cps: 40, result: 'Wrong password', resultAt: mark('v3-6', 'data'), resultTone: 'green' });
      W.label(d, 'data, not code', { x: 160, y: 340, w: 240, tone: 'green', align: 'center', size: 26, at: mark('v3-6', 'stays') });
      sheriff(content, 904, mapAt, leave - 0.3, {
        moves: [[mark('v3-2', 'laptop'), 'point', { to: [330, 220], hold: 1.4 }], [mark('v3-5', 'sql') - 0.1, 'draw', { hold: 1.6 }], [mark('v3-6', 'data') + 0.2, 'nod']],
      });
    }

    // ----------------------------------------------------------------
    // Verse 3, part two: cross-site scripting, and the shared mistake
    // ----------------------------------------------------------------

    function verse3b() {
      badge('Verse 3 · Attack Surface', 'verse-3b');
      const from = start('verse-3b');
      const leave = end('verse-3b');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const escAt = before('v3b-4');
      const pairAt = before('v3b-5');
      // "Then I hid a script in a comment that I wrote."
      const a = W.group(s, from, pairAt);
      const payload = '<script>alert("USC IS BETTER!!!")</script>';
      const { view } = W.browser(a, { x: 24, y: 84, w: 430, h: 318, at: from + 0.1 });
      W.post(view, { typedText: payload, typedAt: mark('v3b-1', 'script') - 0.2, postAt: mark('v3b-1', 'wrote'), escapeAt: mark('v3b-4', 'text') });
      // "Each browser ran it as yours and sent me what it stole." The stolen
      // session cookies fly from each browser into the outlaw's cookie jar.
      const o = W.overlay(a);
      const JAR = [846, 318];
      [0, 1, 2].forEach((i) => {
        // Stacked tight, so the escaped HTML fits below them.
        const y = 78 + i * 87;
        const v = W.browser(a, { x: 478, y, w: 262, h: 84, url: 'your-app.example', at: mark('v3b-2', 'browser') + i * 0.12 }).view;
        W.alertBox(v, 'USC IS BETTER!!!', { ok: false, x: 36, y: 0, w: 180, at: mark('v3b-2', 'ran') + i * 0.12, until: escAt + 0.2 + i * 0.1 });
        W.tick(a, { x: 750, y: y + 24, at: mark('v3b-4', 'runs') + i * 0.1, kind: 'check', size: 28 });
        W.trail(o, `M742 ${y + 46} C790 ${y + 50} ${JAR[0] - 30} ${JAR[1] - 60} ${JAR[0]} ${JAR[1]}`, { at: mark('v3b-2', 'stole') + i * 0.12, duration: 0.7, until: escAt, tone: 'cookie' });
      });
      W.tag(a, 'session cookies, sent to the attacker', { x: 748, y: 92, w: 168, at: mark('v3b-2', 'sent'), until: escAt, tone: 'red', icon: 'key' });
      W.stamp(a, 'XSS', { x: 488, y: 354, w: 200, rule: 'Cross-site scripting', at: mark('v3b-3', 'thats'), until: escAt, tone: 'red' });
      // The outlaw points at the comment as the script goes in, catches the
      // cookies in a jar, and shrugs when the script shows up as plain text.
      const textAt = mark('v3b-4', 'text');
      outlaw(content, from, textAt + 1.4, {
        route: [[from, 990, FEET, -1], [from + 1, 884, FEET, -1], [textAt + 0.5, 884, FEET, -1], [textAt + 1.4, 1010, FEET, 1]],
        holds: [[mark('v3b-2', 'sent') - 0.2, 'near', 'cookieJar'], [mark('v3b-4', 'escape'), 'near', null]],
        moves: [
          [mark('v3b-1', 'script') - 0.2, 'reach', { to: [600, 300], shape: 'point', hold: 1.8 }], [mark('v3b-2', 'stole') + 0.4, 'peek', { dir: 1, hold: 1.2 }],
          [mark('v3b-3', 'scripting'), 'look', { dir: 'viewer', hold: 0.8 }], [textAt - 0.1, 'shrug', { hold: 0.8 }],
        ],
      });
      // "Escape what you display: my script shows up as text, not code."
      W.slate(a, {
        x: 478, y: 342, w: 316, lang: 'html', title: 'The page’s HTML, escaped', at: mark('v3b-4', 'escape'), size: 13,
        lines: [{ text: '&lt;script&gt;alert(…)&lt;/script&gt;', hl: [{ part: '&lt;script&gt;', at: mark('v3b-4', 'escape') + 0.3, tone: 'green' }] }],
      });
      W.label(a, 'Output encoding', { x: 478, y: 424, w: 200, tone: 'green', align: 'center', at: mark('v3b-4', 'escape') + 0.5 });
      // "Two attacks, one mistake: my input ran as code."
      const zeroAt = mark('v3b-6', 'zero');
      const b = W.group(s, pairAt, zeroAt);
      W.slate(b, { x: 30, y: 110, w: 300, lang: 'sql', title: 'SQL injection', at: pairAt, lines: [{ text: 'AND Pass = "" or ""=""', hl: [{ part: '" or ""="', at: mark('v3b-5', 'mistake') }] }] });
      W.slate(b, { x: 400, y: 110, w: 460, lang: 'html', title: 'Cross-site scripting', at: pairAt + 0.1, lines: [{ text: payload, hl: [{ part: payload, at: mark('v3b-5', 'mistake') + 0.1 }] }], size: 14 });
      W.plank(b, 'Input ran as code', { x: 260, y: 220, w: 440, at: mark('v3b-5', 'one'), tone: 'red' });
      // "Zero Trust: any input might be malicious." A checkpoint inspects every
      // input, even the boss's laptop; the comment hides a script and is stopped.
      const c = W.group(s, zeroAt, leave);
      W.stamp(c, 'Zero Trust', { after: 'Principle', x: 200, y: 68, w: 500, rule: 'Any input might be malicious.', at: zeroAt });
      PS.checkpoint(c, {
        x: 110, y: 184, w: 680, at: zeroAt + 0.3, sweepAt: mark('v3b-6', 'any'), sweep: 1.5, rejectAt: mark('v3b-6', 'malicious'),
        items: [
          { label: 'form input', kind: 'form' }, { label: 'photo upload', kind: 'upload' }, { label: 'URL', kind: 'url' },
          { label: 'boss’s laptop', kind: 'laptop' }, { label: 'comment', kind: 'comment', bad: true, hidden: '<script>' },
        ],
      });
      // The outlaw watches the hidden script get caught and shrugs.
      outlaw(content, mark('v3b-6', 'trust'), leave - 0.6, {
        route: [[mark('v3b-6', 'trust'), 1000, FEET, -1], [mark('v3b-6', 'any'), 880, FEET, -1]],
        moves: [[mark('v3b-6', 'malicious') + 0.2, 'shrug', { hold: 1 }]],
      });
    }

    // ----------------------------------------------------------------
    // Verse 4: Protection Mechanisms → Least Privilege
    // ----------------------------------------------------------------

    function verse4() {
      badge('Verse 4 · Protection Mechanisms', 'verse-4');
      const from = start('verse-4');
      const leave = end('verse-4');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const leastAt = mark('v4-9', 'least');
      // A little lower than the others: this verse's badge is the widest.
      header(s, '4 · Protection Mechanisms', 'How do you stop them?', from + 0.1, leastAt, { y: 58 });
      // "With every lock you've got, and a plan for when one breaks."
      const townAt = before('v4-3');
      const a = W.group(s, from + 0.1, townAt);
      const LOCKS = ['prepared statement', 'output encoding', 'tested locks, secret keys', 'login check'];
      W.lockBoard(a, { x: 30, y: 136, w: 646, h: 150, at: mark('v4-1', 'every') - 0.2 });
      LOCKS.forEach((name, i) => W.padlock(a, { x: 90 + i * 168, y: 168, size: 64, label: name, hung: true, at: mark('v4-1', 'every') + i * 0.15, openAt: i === 1 ? mark('v4-2', 'breaks') : undefined }));
      const o1 = W.overlay(a);
      W.ring(o1, { cx: 290, cy: 238, rx: 110, ry: 76, textAt: 'bottom', at: mark('v4-2', 'breaks') + 0.3 });
      // "Say uploads run as admin, and I break in through that page."
      const b = W.group(s, townAt, mark('v4-9', 'least'));
      const ringLayer = W.overlay(b);
      const town = W.services(b, {
        x: 12, y: 190, at: townAt + 0.05, masterAt: mark('v4-3', 'admin'), splitAt: mark('v4-5', 'own'), rightsAt: mark('v4-5', 'rights'),
        rightLights: [[0, mark('v4-6', 'read')], [3, mark('v4-6', 'write')]],
      });
      const barn = town.centres[3];
      const o2 = W.overlay(b);
      W.vector(o2, `M872 352 C790 376 ${barn[0] + 96} 372 ${barn[0] + 34} ${barn[1] + 4}`, { at: mark('v4-3', 'break'), until: before('v4-5'), duration: 0.8 });
      W.bank(b, { x: 612, y: 150, w: 214, at: mark('v4-4', 'every') - 0.2, openAt: mark('v4-4', 'every'), readAt: mark('v4-4', 'read'), changeAt: mark('v4-4', 'change'), lockedAt: mark('v4-8', 'locked') });
      // The blast radius shrinks to the barn as soon as the fix is in: once
      // every part has its own key with just its rights.
      W.ring(ringLayer, { cx: 420, cy: 296, rx: 400, ry: 128, textAt: 'bottom', at: mark('v4-4', 'mine'), sizes: [[mark('v4-5', 'needs') + 0.2, barn[0], barn[1] + 40, 92, 100]] });
      // "Now break in through the uploads: one folder, that is all."
      W.vector(o2, `M872 360 C790 386 ${barn[0] + 90} 384 ${barn[0] + 30} ${barn[1] + 14}`, { at: mark('v4-7', 'break'), duration: 0.8 });
      // The outlaw breaks in through the upload page, gloats over every
      // table, and on the second try gets one folder and shrugs.
      outlaw(content, townAt, leastAt, {
        route: [[townAt, 1010, FEET, -1], [mark('v4-3', 'admin'), 918, FEET, -1], [leastAt - 0.6, 918, FEET, -1], [leastAt, 1010, FEET, 1]],
        holds: [[mark('v4-4', 'every'), 'near', 'sack'], [mark('v4-5', 'own'), 'near', null]],
        moves: [
          [mark('v4-3', 'break') - 0.2, 'reach', { to: [850, 362], shape: 'point', hold: 1.2 }], [mark('v4-4', 'mine'), 'look', { dir: 'viewer', hold: 1.2 }],
          [mark('v4-7', 'break') - 0.2, 'reach', { to: [850, 368], shape: 'point', hold: 1.2 }], [mark('v4-7', 'all'), 'shrug', { hold: 1 }],
        ],
      });
      W.tag(b, '/uploads', { x: barn[0] - 60, y: barn[1] + 174, w: 130, at: mark('v4-7', 'folder'), icon: 'folder' });
      // "Least Privilege: each part gets only what it needs." One narrow key
      // per job on the rack; the master key that opened everything retired.
      W.stamp(s, 'Least Privilege', { before: 'Principle of', x: 140, y: 76, w: 640, rule: 'Each part gets only what it needs.', at: leastAt });
      PS.keyRack(s, {
        x: 100, y: 200, w: 740, at: leastAt + 0.3, master: 'admin key', retireAt: mark('v4-9', 'only'),
        keys: [
          { name: 'Display', right: 'read only', at: leastAt + 0.5 },
          { name: 'Email', right: 'send only', at: leastAt + 0.65 },
          { name: 'Backup', right: 'write backups', at: leastAt + 0.8 },
          { name: 'Upload', right: 'write /uploads', at: leastAt + 0.95 },
        ],
      });
    }

    // ----------------------------------------------------------------
    // The bridge: Hugging Face, 2026, and its lessons
    // ----------------------------------------------------------------

    function bridge() {
      badge('Bridge · A true story', 'bridge');
      const from = start('bridge');
      const leave = end('bridge-2');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const lessonsAt = before('br2-1');
      const { page } = W.gazette(s, {
        x: 50, y: 56, w: 824, at: mark('br-1', 'twenty'), until: lessonsAt, date: 'July 2026',
        headline: 'AI agents break out of a test and into a model-hosting site',
        byline: 'As reported by Hugging Face and OpenAI',
      });
      // The story's AI agents walk the attack path step by step along the
      // street: they stop under each hop as it appears on the page (the hops
      // stand 140 px apart from x = 132), freeze at "Who'd have planned for
      // that?", and leave only when the lessons begin. Each keeps its own
      // place in the line, so they never overlap.
      const HOP_TIMES = [mark('br-1', 'agents'), mark('br-1', 'broke'), mark('br-3', 'tokens'), mark('br-3', 'code'), mark('br-4', 'key'), mark('br-4', 'clusters')];
      // They walk a little in front of the street line, below the page's notes.
      const STREET = FEET + 6;
      const agentRoute = (dx) => [
        [mark('br-1', 'ai') - 0.8, -60 - dx, STREET, 1],
        ...HOP_TIMES.flatMap((t, i) => [[t - 0.5, (i ? 132 + 140 * (i - 1) : -60) + 60 - dx, STREET, 1], [t + 0.5, Math.min(132 + 140 * i + 60, 912) - dx, STREET, 1]]),
        [lessonsAt - 0.9, 912 - dx, STREET, 1], [lessonsAt + 0.6, 1100 - dx, STREET, 1],
      ];
      [0, 1, 2].forEach((i) => window.Outlaw?.bot(content, {
        at: mark('br-1', 'ai') - 0.8, until: lessonsAt + 0.6, scale: 1.15, delay: 0.1 * i,
        route: agentRoute(60 * i), freezes: [[mark('br-2', 'whod'), 1.2]],
      }));
      const HOPS = [
        { title: 'Sandbox', sub: 'hacking benchmark', iconName: 'box', at: mark('br-1', 'agents') },
        { title: 'Package proxy', sub: 'a gap out', iconName: 'link', at: mark('br-1', 'broke') },
        { title: 'Public dataset', sub: 'tokens left in public', iconName: 'key', at: mark('br-3', 'tokens') },
        { title: 'Dataset worker', sub: 'ran their code', iconName: 'gear', at: mark('br-3', 'code') },
        { title: 'Shared admin key', sub: 'Hugging Face’s account', iconName: 'key', at: mark('br-4', 'key') },
        { title: 'Clusters', sub: 'groups of servers', iconName: 'database', at: mark('br-4', 'clusters') },
      ];
      HOPS.forEach((h, i) => W.hop(page, { x: i * 140, y: 20, w: 110, ...h, tone: i > 1 ? 'amber' : undefined }));
      const LINES = ['trusted the proxy', 'trusted a leaked token', 'trusted the uploaded file', 'trusted a shared key', 'admin everywhere'];
      LINES.forEach((text, i) => {
        const t = W.tag(page, text, { x: i * 140 + 66, y: 120, w: 104, at: mark('br-5', 'step') + i * 0.35, tone: 'red' });
        t.classList.add('wk-tag--small');
      });
      W.tag(page, 'goal: a higher benchmark score', { x: 0, y: 114, w: 260, at: mark('br-1', 'sandbox'), until: mark('br-5', 'step') - 0.1 });
      W.tag(page, 'Who might be attacking? AI agents?', { x: 320, y: 114, w: 320, at: mark('br-2', 'whod'), until: mark('br-5', 'step') - 0.1, icon: 'question' });
      // The lessons, as town rules beside the gazette.
      W.notice(s, {
        x: 110, y: 60, w: 520, title: 'Lessons learned', at: mark('br2-1', 'what'),
        items: [
          ['Scan for leaked secrets', 'search', mark('br2-2', 'hunt')],
          ['Short-lived tokens', 'hourglass', mark('br2-2', 'expire')],
          ['Parse untrusted files in a sandbox, with no keys inside', 'box', mark('br2-3', 'sandbox')],
          ['No shared admin key: one narrow key per job', 'key', mark('br2-4', 'shared')],
          ['Watch for machine-speed activity', 'chart', mark('br2-4', 'watch')],
        ],
      });
      W.plank(s, 'Defense in depth', { x: 190, y: 384, w: 360, at: mark('br2-5', 'so') - 0.3, tone: 'green' });
      sheriff(content, 790, lessonsAt + 0.2, leave - 0.3, {
        moves: [[mark('br2-1', 'teach'), 'present', { to: [400, 200], hold: 2 }], [mark('br2-5', 'slip'), 'nod']],
      });
    }

    // ----------------------------------------------------------------
    // Quiz: six new cases
    // ----------------------------------------------------------------

    function quiz() {
      badge('Quiz · You’re the tester', 'quiz-intro');
      kit.badge(hud, 'Quiz · You’re the tester', start('quiz'), end('quiz'));
      const from = start('quiz-intro');
      const leave = end('quiz');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const first = before('quiz-1');
      kit.kinetic(s, [{ text: 'Pop quiz!', at: mark('quiz-0-1', 'pop'), color: 'gold' }], { y: 150, size: 80, until: first - 0.45, punch: false });
      W.tag(s, 'Now you’re the tester', { x: 330, y: 320, w: 240, at: mark('quiz-0-1', 'now'), until: first - 0.1, tone: 'brass', icon: 'shield' });
      // The outlaw waves you in: the tester's job is yours now.
      outlaw(content, from - 0.8, first - 0.2, {
        route: [[from - 0.8, -50, FEET, 1], [mark('quiz-0-1', 'now') - 0.15, 150, FEET, 1]],
        moves: [[mark('quiz-0-1', 'now') - 0.1, 'wave', { hold: 1.2 }], [mark('quiz-0-1', 'do') - 0.3, 'look', { dir: 'viewer', hold: 1 }]],
      });
      sheriff(content, 820, from + 0.1, first - 0.2, { moves: [[mark('quiz-0-1', 'now'), 'point', { to: [520, 330], hold: 1.6 }]] });

      const ART = {
        1: (g, q) => {
          W.slate(g, { x: 515, y: 120, w: 380, lang: 'plain', title: 'Gradebook', at: q.start + 0.2, lines: ['Alex    CS 35L   B → A', 'Sam     CS 35L   B → A', 'Kim     CS 35L   B'] });
          W.tag(g, 'no data left the system', { x: 540, y: 260, w: 300, at: q.start + 1.6, icon: 'shield' });
        },
        2: (g, q) => {
          W.slate(g, { x: 505, y: 120, w: 390, lang: 'js', title: 'DevTools · your front-end bundle', at: q.start + 0.2, size: 14, lines: ['const API_KEY = "a1f…";', 'fetch(url, { headers: { key: API_KEY } })'] });
        },
        3: (g, q) => {
          W.label(g, 'Error page footer', { x: 530, y: 110, w: 200, at: q.start + 0.2 });
          W.tag(g, 'Express 4.17.1', { x: 530, y: 166, w: 200, at: q.start + 0.2, redactAt: q.answer_at });
        },
        4: (g, q) => {
          const f = W.box(g, 'wk-form', { x: 530, y: 110, w: 330 });
          f.innerHTML = '<div class="wk-form-title">Sign up</div><div class="wk-form-label">Email</div><div class="wk-form-field">not-an-email</div><div class="wk-form-result wk-form-result--red">Please enter a valid email</div>';
          W.show(f, q.start + 0.2);
          W.slate(g, { x: 515, y: 330, w: 390, lang: 'plain', title: 'terminal', at: q.answer_at + 0.2, lines: ["curl -X POST /api/signup -d 'email=not-an-email'"], size: 13 });
        },
        5: (g, q) => {
          W.slate(g, { x: 520, y: 130, w: 340, lang: 'plain', title: '.env', at: q.start + 0.2, lines: [{ text: 'DB_USER=admin', hl: [{ part: 'admin', at: q.start + 1, until: q.answer_at, tone: 'red' }] }] });
          W.slate(g, { x: 520, y: 230, w: 340, lang: 'plain', title: '.env, fixed', at: q.answer_at + 0.3, lines: ['DB_USER=app_comments', '# read and write: comments only'] });
        },
        6: (g, q) => {
          W.slate(g, { x: 515, y: 120, w: 390, lang: 'js', title: 'A home-made filter', at: q.start + 0.2, lines: ['password = password.replaceAll(\'"\', \'\')'] });
          // Marks the home-made filter wrong, pinned on the slate's corner.
          W.tick(g, { x: 912, y: 104, at: q.answer_at, kind: 'cross' });
          W.slate(g, { x: 515, y: 230, w: 390, lang: 'sql', title: 'A prepared statement', at: q.answer_at + 0.2, lines: ['SELECT * FROM Users', 'WHERE Name = ? AND Pass = ?'] });
        },
      };
      // The sung answers are long; each poster stamps the short form, which
      // can be read before the next question arrives.
      const SHORT = {
        1: 'Integrity: an unauthorized change', 2: 'No: keep it server-side', 3: 'Extra layer, never alone',
        4: 'Yes: forms can be skipped', 5: 'No: only what it needs', 6: 'Use a prepared statement',
      };
      for (let n = 1; n <= 6; n += 1) {
        const q = line(`quiz-${n}`);
        const until = n < 6 ? before(`quiz-${n + 1}`) : leave;
        W.quiz(s, { x: 40, y: 100, w: 400, n, total: 6, question: q.text, answer: SHORT[n], at: q.start - 0.1, answerAt: q.answer_at, until });
        ART[n](W.group(s, q.start - 0.1, until), q);
      }
    }

    // ----------------------------------------------------------------
    // The final chorus: every question with its answer
    // ----------------------------------------------------------------

    function finalChorus() {
      const from = start('chorus-3');
      const leave = end('chorus-3');
      badge('Final chorus · The Security Plan', 'chorus-3');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      const at = (n, word) => mark(`c3-${n}`, word);
      W.planBoard(s, {
        x: 20, y: 58, w: 700, at: from, pins: { 0: from, 1: from, 2: from, 3: from },
        lights: continuous([[0, at(2, 'security')], [1, at(3, 'threat')], [2, at(5, 'attack')], [3, at(7, 'protection')]], at(9, 'so')),
        ruleLights: continuous([[0, at(2, 'security')], [1, at(4, 'open')], [2, at(6, 'zero')], [3, at(8, 'least')]], at(9, 'so')),
        glowAt: at(9, 'so'),
      });
      const X = [108, 280, 452, 624];
      sheriff(content, 902, from + 0.2, leave - 0.3, {
        entrance: 'rise',
        moves: [
          [at(2, 'security'), 'point', { to: [X[0], 200], hold: 3 }], [at(4, 'open'), 'point', { to: [X[1], 380], hold: 2.6 }],
          [at(6, 'zero'), 'point', { to: [X[2], 380], hold: 2.6 }], [at(8, 'least'), 'point', { to: [X[3], 380], hold: 2.6 }],
          [at(9, 'so') + 0.4, 'tip', { hold: 1.2 }],
        ],
      });
    }

    // ----------------------------------------------------------------
    // Outro: your project, and the key kept with you
    // ----------------------------------------------------------------

    /**
     * The closing gag's beats, ending with the song: the gang sneaks in,
     * freezes at the sheriff's glance, goes on to the porch, tips the pot up
     * (`lift`), finds the honeypot (`reveal`), grabs it, is caught, and
     * tiptoes off. It starts at `preferred` if the song's tail leaves room,
     * else early enough to finish, but never before `earliest`.
     */
    function gagBeats(earliest, preferred) {
      const end = song.duration - 0.3;
      const LENGTH = 8.1;   // sneaking in to the end of the exit
      const at = Math.max(earliest, Math.min(preferred, end - LENGTH));
      const glance = at + 1.3, freeze = 1.0, go = glance + freeze;
      const lift = go + 1.2, reveal = lift + 0.75, grab = reveal + 0.5, caught = grab + 0.4;
      return { at, glance, freeze, go, lift, reveal, grab, caught, leaveAt: caught + 1.3, end };
    }

    /**
     * The closing gag at `house`, the outro porch posed from the same
     * beats: the outlaw and three AI agents sneak up to the porch, freeze
     * while the sheriff glances over, tip the flowerpot, and find a
     * honeypot.
     */
    function honeypotGag(parent, house, { at, glance, freeze, go, lift, reveal, grab, caught, leaveAt, end }) {
      const point = (name) => house.point(name);
      // He stops left of the barrel, an arm's length from the pot.
      const STOP = Math.round(point('rim')[0] - 52);
      // The outlaw's feet: in from the left, a freeze, on to the porch, and
      // backwards out again with the jar on one hand.
      const route = (dx) => [[at, -60 - dx, FEET, 1], [glance, 170 - dx, FEET, 1], [go, 170 - dx, FEET, 1], [lift - 0.1, STOP - dx, FEET, 1], [leaveAt, STOP - dx, FEET, 1], [end, -60 - dx, FEET, 1]];
      // One hand tips the pot up by its rim, holds it, and sets it down; the
      // other reaches in for the jar and comes out stuck in it.
      outlaw(content, at, end, {
        route: route(0),
        moves: [
          [glance, 'freeze', { hold: freeze }], [lift, 'reach', { to: point('rim'), hand: 'far', shape: 'grip', hold: 0.34 }],
          [lift + 0.75, 'reach', { to: point('rimTipped'), hand: 'far', shape: 'grip', hold: caught - lift - 0.7 }],
          [caught + 0.5, 'reach', { to: point('rim'), hand: 'far', shape: 'grip', hold: 0.1 }],
          [grab, 'reach', { to: point('jar'), shape: 'grip', hold: 0.3 }], [caught, 'shake', { hold: 1.1 }], [leaveAt - 0.2, 'look', { dir: 'viewer', hold: 1 }],
        ],
        holds: [[caught, 'near', 'honeyJar']],
      });
      [60, 118, 176].forEach((dx, i) => window.Outlaw?.bot(content, {
        at: at + 0.2 * i, until: end, route: route(dx), scale: 1.1, freezes: [[glance, freeze], [caught, 1.2]],
      }));
      W.label(parent, 'Honeypot: a decoy that catches intruders', { x: 520, y: 236, w: 204, tone: 'gold', at: reveal + 0.1, until: end });
      W.tag(parent, 'Intruder logged: 1 attempt', { x: 520, y: 330, w: 204, at: caught + 0.2, until: end, tone: 'red', icon: 'receipt' });
    }

    function outro() {
      badge('Outro · Your turn', 'outro');
      const from = start('outro');
      const leave = song.duration;
      const s = kit.scene(content, from, leave - 0.2, { exit: 'fade' });
      const keyAt = before('outro-2');
      const titleAt = before('outro-3');
      W.planBoard(s, { x: 40, y: 70, w: 600, blank: true, small: true, heading: 'Your project', at: mark('outro-1', 'run'), until: keyAt });
      // The porch again, for the rest of the song. On "keep", the key slides
      // out from under the flowerpot and flies to the sheriff's hand; in the
      // closing gag a honeypot waits where it was.
      const keep = mark('outro-2', 'keep');
      // Once the key is safe with the sheriff, and ending with the song.
      const beats = gagBeats(keep + 1.4, mark('outro-3', 'in') + 0.3);
      const house = W.porch(s, {
        x: 200, ground: FEET, w: 280, sign: 'YOUR APP', at: keyAt, until: beats.end, honey: true,
        keyFly: { at: keep - 0.6, to: [905, 290] },
        tipAt: beats.lift + 0.4, untipAt: beats.caught + 0.1, honeyTakeAt: beats.caught,
      });
      W.poster(s, { x: 206, y: 30, w: 600, kicker: 'That’s security, designed in', title: 'Design Security In\nBefore They Break In', at: titleAt + 0.2, className: 'wk-poster--title' });
      // The honeypot. In the closing bars the outlaw tiptoes back for one more
      // try, a line of little AI agents copying every step, and they all
      // freeze mid-step whenever the sheriff glances over. Under the
      // flowerpot, where the key used to be, waits a honeypot: a decoy that
      // catches and logs intruders. The outlaw's hand sticks in the honey,
      // the attempt is logged, and the gang tiptoes off backwards.
      honeypotGag(s, house, beats);
      sheriff(content, 872, from + 0.2, leave - 0.4, {
        holds: [[keep + 0.3, 'right', 'key']],
        moves: [
          [mark('outro-1', 'project'), 'present', { to: [340, 220], hold: 1.4 }], [keep, 'hold', { side: 'right', to: [905, 290], hold: 2.2 }],
          [mark('outro-3', 'designed'), 'nod'], [beats.glance, 'look', { dir: -1, hold: beats.freeze }], [beats.caught + 0.5, 'tip', { hold: 1.4 }],
        ],
      });
    }

    intro();
    verse1();
    chorus('chorus-1', 'c1', { 0: start('chorus-1') + 0.3 });
    verse2();
    verse3();
    verse3b();
    chorus('chorus-2', 'c2', { 0: start('chorus-2') + 0.2, 1: start('chorus-2') + 0.4, 2: start('chorus-2') + 0.6 });
    verse4();
    bridge();
    quiz();
    finalChorus();
    outro();
  };
})();
