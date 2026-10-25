/*
 * Choreography for "It Works on My Machine", a comic opera about one
 * teammate who keeps "helping" (storyboard: _data/songs/
 * it_works_on_my_machine.yml).
 *
 * Every visual hits a sung word: `mark(lineId, word)` is that word's time
 * in the recording. The teaching rule: show exactly what the line says. In
 * each act the Teammate, the tenor (js/song-video/opera-cast.js), sings his
 * "help" and acts it out with the props it needs (js/song-video/
 * machine-kit.js); then a teammate in the viewer's SE Gym face storms on
 * from the wings and sings what it broke, while he freezes with a sheepish
 * grin and sweats. Three refrains hoist his laptop while the shared build
 * stays red behind him; the finale lines all six teammates up behind him.
 * The stage is an opera house dressed as the team's office
 * (js/song-video/opera-house.js): its curtain, clock, window, status
 * board, and footlights follow the story. Each line's `visual` in the
 * storyboard describes this file.
 *
 * Layout: 960×540 stage inside the proscenium (x 46–914); the cast stands
 * on the floor at y 452; the act badge sits top left; nothing essential
 * goes below y = 460, where the player draws captions.
 */
(function () {
  'use strict';

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.it_works_on_my_machine = function choreograph({ song, kit, layers, student }) {
    const { fx, tween, onFrame, EASE } = window.Timeline;
    const C = window.OperaCast;
    const M = window.MachineKit;
    const house = window.OperaHouse.of(layers.stage);
    const { content, hud } = layers;
    const line = (id) => song.line(id);
    const mark = (id, word) => song.mark(id, word);
    const start = (id) => song.sectionStart(id);
    const end = (id) => song.sectionEnd(id);
    // The worried teammate at the laptop in the overture is the viewer's own
    // hero (student.appear). The six teammates who answer him are women, one
    // random face each, kept for the whole song: a random hero restyled with
    // the generator's own hair and lash styles that it never pairs with
    // facial hair, and no facial hair.
    const womansLook = (avatar) => {
      const pick = (values) => values[Math.floor(Math.random() * values.length)];
      const { hairStylesWithoutFacialHair, eyelashStylesWithoutFacialHair } = avatar.RANDOM_TRAIT_POLICY.facialHairCompatibility;
      const state = avatar.randomAvatar(null, 'human');
      state.appearance.hairStyle = pick(hairStylesWithoutFacialHair.filter((style) => avatar.ENUMS.hairStyle.includes(style)));
      state.appearance.eyelashStyle = pick(eyelashStylesWithoutFacialHair.filter((style) => avatar.ENUMS.eyelashStyle.includes(style)));
      state.appearance.facialHair = 'none';
      return avatar.normalizeAvatar(state);
    };

    // The cast: where each stands when, its moves and props, and the words
    // it sings. Sections add to these; the figures are drawn after the
    // scenery behind them and before the props in front.
    const FLOOR = 452;
    const HOME = { tenor: [236, FLOOR, 0.95], mate: [736, FLOOR, 0.95] };
    // The voice of the closing line, sung by every teammate but the tenor.
    const ENSEMBLE = 'All six teammates';
    const VOICES = {
      tenor: 'Teammate', pm: 'Product Manager', build: 'Build Engineer', test: 'Test Engineer',
      ui: 'UI Developer', backend: 'Back-End Developer', security: 'Security Engineer',
      // The viewer's hero, who joins the six for the closing line.
      hero: null,
    };
    const plan = Object.fromEntries(Object.keys(VOICES).map((role) => [role, { stage: [], places: [], moves: [], holds: [], beds: [] }]));
    const move = (role, at, name, options) => plan[role].moves.push([at, name, options]);
    const placeAt = (role, at, x, y = FLOOR, scale = 0.95, duration = 0.8) => plan[role].places.push([at, x, y, scale, duration]);
    const behind = [];
    const lights = [];
    const ahead = [];
    /** A follow spot on `role` from `from` to `to`. */
    const spotlight = (role, from, to) => lights.push(() => M.spot(content, () => figures[role], { from, to }));
    const figures = {};
    // The ticket app's phone, which stays on into the Product Manager's scene,
    // and its screens.
    let handset = null;
    const TICKET_SCREENS = {
      ticket: ['Jazz Night', 'Fri 8:00 PM', 'Row F, seat 12'],
      locked: ['Seat F12', 'Name: Alex', 'Locked to you'],
      nope: ['Transfer?', '✗ Not allowed', 'One name only'],
      transfer: ['Transfer', 'Seat F12', 'To: Sam', 'Sent ✓'],
    };

    function badge(text, from, to) {
      kit.badge(hud, text, from, to);
    }

    // ----------------------------------------------------------------
    // The house: the curtain rises for the overture and falls on the
    // final chord; the clock, sky, board, and footlights follow the story.
    // ----------------------------------------------------------------

    house.curtain(0, 0, 0.01);
    house.curtain(0.3, 1, 2.2);
    house.sky(0, 'day', 0.01);
    house.clock(0, 9, 0.01);
    house.board(0, ['green', 'green', 'green', 'green', 'green', 'green']);

    // ----------------------------------------------------------------
    // Intro: "No need to worry! Just leave it to me!"
    // ----------------------------------------------------------------

    function intro() {
      badge('Overture', 0.6, start('verse-1'));
      plan.tenor.stage.push([0.7, undefined, { enter: 'left' }]);
      placeAt('tenor', 0, ...HOME.tenor);
      // A worried teammate (the viewer's hero) at a laptop, stage right.
      // The intro's scenes clear before verse 1 begins.
      const cleared = start('verse-1') - 0.3;
      student?.appear({ from: 0.8, to: cleared - 0.2, x: 664, y: 140, scale: 0.86 });
      behind.push(() => {
        const office = kit.scene(content, 0.8, cleared, { exit: 'fade' });
        M.desk(office, { x: 668, top: 386, w: 216 });
      });
      // "No need to worry": a palm raised to the worried teammate.
      move('tenor', mark('intro-1', 'need'), 'reassure', { hold: 1.3 });
      // "Just leave it to me!": a hand patted on his chest.
      move('tenor', mark('intro-1', 'leave'), 'chest', { hold: 1.4, pats: 2 });
      // "I'll save us a whole sprint": the sprint calendar sheds its fourteen days.
      behind.push(() => {
        const wall = kit.scene(content, 8.2, cleared, { exit: 'fade' });
        M.calendar(wall, { x: 318, y: 92, at: 8.3, days: 14, tearAt: mark('intro-2', 'save'), tearUntil: mark('intro-2', 'sprint') + 0.9 });
      });
      move('tenor', mark('intro-2', 'save') - 0.1, 'point', { to: [376, 160], hold: 1.6 });
      // "We'll ship it by three!": the clock spins to three, a toy ship is
      // flown in from the rafters under its pennant, and he salutes it.
      house.clock(mark('intro-2', 'ship'), 15, 0.9);
      ahead.push(() => {
        const dock = kit.scene(content, mark('intro-2', 'well'), cleared, { exit: 'fade' });
        M.toyShip(dock, { x: 460, y: 318, at: mark('intro-2', 'well'), rollAt: mark('intro-2', 'well'), leaveAt: cleared - 1.6, label: 'v1.0 by 3:00', from: 'above' });
      });
      move('tenor', mark('intro-2', 'three'), 'salute', { hold: 1 });
      move('tenor', mark('intro-2', 'three') + 1.1, 'operatic', { hold: 1 });
      spotlight('tenor', 1, line('pm-1').start - 0.9);
    }

    // ----------------------------------------------------------------
    // Act I, verse 1: requirements, "quite simple"
    // ----------------------------------------------------------------

    function verse1() {
      const v = (n) => `verse-1-${n}`;
      badge('Act I · Requirements', start('verse-1'), end('pm'));
      // "Requirements? Quite simple!": a scroll of them unrolls and he
      // snaps it shut with one raised finger.
      ahead.push(() => {
        const a = kit.scene(content, line(v(1)).start - 0.2, mark(v(1), 'tickets') + 0.4, { exit: 'fade' });
        M.scroll(a, { x: 500, y: 52, at: mark(v(1), 'requirements'), rollAt: mark(v(1), 'simple') + 0.1, title: 'Requirements' });
      });
      move('tenor', mark(v(1), 'simple') - 0.1, 'finger', { hold: 0.7 });
      // "Tickets: buy and go!": the ticket app on a giant phone, a concert
      // ticket on its screen. "One ticket! One name! How sleek! How
      // refined!": one BUY button, then the ticket locked to one name.
      behind.push(() => {
        const app = kit.scene(content, mark(v(1), 'tickets') - 0.3, mark('pm-4', 'six') - 0.05, { exit: 'fade' });
        handset = M.phone(app, {
          x: 405, y: 166, at: mark(v(1), 'tickets') - 0.3, label: 'SeatSwap', buttonText: 'BUY', lists: TICKET_SCREENS,
          screens: [[mark(v(1), 'tickets'), 'ticket'], [mark(v(3), 'ticket'), 'button'], [mark(v(3), 'name'), 'locked'], [mark('pm-2', 'cant'), 'nope']],
          shineAt: [mark(v(3), 'sleek'), mark(v(3), 'refined')],
        });
        M.sparkle(app, { x: 480, y: 250, at: mark(v(3), 'sleek'), spread: 70 });
      });
      move('tenor', mark(v(1), 'tickets') - 0.1, 'present', { to: [470, 260], hold: 0.9 });
      // "No need to ask users": hands go up in the stalls; he shushes them.
      ahead.push(() => {
        // The stalls are in front of the footlights, in the HUD's layer.
        const stalls = kit.scene(hud, line(v(2)).start - 0.3, mark(v(2), 'certain'), { exit: 'fade' });
        M.audience(stalls, { at: line(v(2)).start - 0.3, askAt: mark(v(2), 'need'), downAt: mark(v(2), 'users') + 0.5 });
      });
      move('tenor', mark(v(2), 'ask') - 0.1, 'shh', { hold: 0.8 });
      // "I'm certain I know!": a knowing tap at his temple.
      move('tenor', mark(v(2), 'certain'), 'temple', { hold: 0.6 });
      move('tenor', mark(v(3), 'ticket') - 0.1, 'point', { to: [478, 262], hold: 1 });
      // "How refined!": a chef's kiss.
      move('tenor', mark(v(3), 'refined'), 'kiss', { hold: 0.3 });
      // "I'll save them a meeting": the meeting with the users is torn up.
      ahead.push(() => {
        const memo = kit.scene(content, mark(v(4), 'save') - 0.2, mark(v(4), 'theyll') + 0.6, { exit: 'fade' });
        M.tornCard(memo, {
          x: 440, y: 60, w: 230, at: mark(v(4), 'save') - 0.1, tearAt: mark(v(4), 'meeting') + 0.1,
          title: 'Meeting with users', lines: ['Monday 10:00', 'What do they need?'],
        });
      });
      move('tenor', mark(v(4), 'meeting'), 'arms', { right: { reach: [124, 60], shape: 'pinch', dir: -70 }, left: { reach: [120, 66], shape: 'pinch', dir: -110 }, hold: 0.5 });
      // "They'll thank me in time!": he bows to the APPLAUSE sign; the
      // house is silent but for a cricket.
      ahead.push(() => {
        const bowing = kit.scene(content, mark(v(4), 'theyll'), line('pm-1').start - 0.4, { exit: 'fade' });
        M.applause(bowing, { x: 360, y: 64, at: mark(v(4), 'thank'), dimAt: line('pm-1').start - 1.2 });
        M.cricket(bowing, { x: 610, y: 420, at: mark(v(4), 'time'), chirps: [mark(v(4), 'time') + 0.3, mark(v(4), 'time') + 1.1, mark(v(4), 'time') + 1.9] });
      });
      move('tenor', mark(v(4), 'me'), 'bow', { hold: 0.9 });
      // No applause: in the stalls, fans think it is not what they need,
      // until the Product Manager has come on to say what they want.
      ahead.push(() => {
        const grumbles = kit.scene(content, mark(v(4), 'thank'), line('pm-1').start + 1.2, { exit: 'fade' });
        M.thoughts(grumbles, {
          at: mark(v(4), 'thank') + 0.1, every: 0.35,
          bubbles: [
            { x: 340, y: 392, text: 'Not what I need…' },
            { x: 630, y: 372, text: 'Can I give my ticket to a friend?' },
            { x: 826, y: 392, text: 'Nobody asked us!' },
          ],
        });
      });
    }

    // ----------------------------------------------------------------
    // Act I, the Product Manager: twenty coffees for ten o'clock
    // ----------------------------------------------------------------

    function pm() {
      const v = (n) => `pm-${n}`;
      const enter = line(v(1)).start - 2.4;
      plan.pm.stage.push([enter, line('verse-2-2').start, { enter: 'right', exit: 'right' }]);
      placeAt('pm', 0, ...HOME.mate);
      plan.pm.holds.push([enter, 'left', 'clipboard']);
      // The Teammate freezes with a sheepish grin while the PM sings.
      move('tenor', enter + 0.6, 'mood', { hold: line(v(4)).end - enter - 1.2, sweat: 1, smile: 0.5, brow: 0.7, look: 0.8 });
      move('pm', enter + 1.3, 'hips', { hold: 0.9 });
      // The phone steps back to the left, out of the user story's way.
      behind.push(() => {
        handset.style.transformOrigin = '50% 0';
        tween(handset, { scale: '0.84', translate: '-90px 0' }, line(v(1)).start - 0.5, 0.5, EASE.inOut);
      });
      // "As a fan, I want to pass my ticket on, so a friend can use my
      // seat when I can't come along!": the user story he never asked
      // for, written out part by part on a card; the phone says no.
      ahead.push(() => {
        const story = kit.scene(content, line(v(1)).start - 0.2, mark(v(3), 'promised') - 0.1, { exit: 'fade' });
        const card = M.card(story, {
          x: 470, y: 56, w: 218, title: 'User story', iconName: 'user', tone: 'gold', at: line(v(1)).start,
          lines: ['As a fan,', 'I want to pass', 'my ticket on,', 'so a friend', 'can use my seat', 'when I can\'t', 'come along.'],
        });
        const shows = [mark(v(1), 'as'), mark(v(1), 'want'), mark(v(1), 'ticket'), mark(v(2), 'so'), mark(v(2), 'use'), mark(v(2), 'when'), mark(v(2), 'come')];
        onFrame((t) => card.rows.forEach((row, i) => row.classList.toggle('mk-card-line--pending', t < shows[i])));
      });
      move('pm', mark(v(1), 'fan') - 0.1, 'chest', { side: 'right', hold: 0.6, pats: 1 });
      move('pm', mark(v(1), 'pass') - 0.1, 'present', { to: [560, 130], hold: 1.2 });
      move('pm', mark(v(2), 'cant') - 0.2, 'point', { to: [390, 250], hold: 1 });
      move('pm', mark(v(2), 'along'), 'shrug', { hold: 0.9 });
      // "I promised a demo of what they could use."
      ahead.push(() => {
        const promise = kit.scene(content, mark(v(3), 'promised') - 0.2, mark(v(4), 'built'), { exit: 'fade' });
        M.card(promise, {
          x: 440, y: 58, w: 214, title: 'Demo today', iconName: 'video', tone: 'gold', at: mark(v(3), 'demo'),
          lines: ['Send a ticket', 'to a friend'],
        });
      });
      move('pm', mark(v(3), 'promised'), 'chest', { side: 'right', hold: 0.8, pats: 1 });
      move('pm', mark(v(3), 'demo'), 'present', { to: [560, 104], hold: 1.2 });
      // "You've built the wrong product — in six lovely hues!": the phone
      // fans out in six colours; he presents them proudly; the PM facepalms.
      move('pm', mark(v(4), 'wrong') - 0.1, 'point', { to: [400, 250], hold: 0.8 });
      ahead.push(() => {
        const fan = kit.scene(content, mark(v(4), 'six') - 0.1, line('verse-2-1').start + 1.2, { exit: 'fade' });
        ['red', 'orange', 'gold', 'green', 'blue', 'violet'].forEach((hue, i) => {
          M.phone(fan, { x: 300 + i * 64, y: 176 + Math.abs(i - 2.5) * 10, scale: 0.42, hue, label: 'SeatSwap', buttonText: 'BUY', lists: {}, at: mark(v(4), 'six') + i * 0.07, screens: [[0, 'button']] });
        });
      });
      move('tenor', mark(v(4), 'six') + 0.2, 'present', { to: [470, 250], hold: 1.2 });
      move('pm', mark(v(4), 'hues'), 'facepalm', { hold: 1.4 });
      spotlight('pm', line(v(1)).start - 0.6, line('verse-2-1').start);
    }

    // ----------------------------------------------------------------
    // Act II, verse 2: reuse and lockfiles, "let new versions in"
    // ----------------------------------------------------------------

    function verse2() {
      const v = (n) => `verse-2-${n}`;
      badge('Act II · Reuse', start('verse-2'), end('build'));
      // "Transfers? Quite simple! I'll borrow the code!": one raised
      // finger; a shelf of packages slides in from the wings.
      move('tenor', mark(v(1), 'simple') - 0.1, 'finger', { hold: 0.7 });
      behind.push(() => {
        const store = kit.scene(content, mark(v(1), 'borrow') - 0.2, line(v(5)).end, { exit: 'fade' });
        M.shelf(store, {
          x: 300, y: 188, at: mark(v(1), 'borrow') - 0.2,
          rows: [
            [{ name: 'auth', version: '1.2.0' }, { name: 'charts', version: '4.0.1' }, { name: 'transfers', version: '1.4.2' }],
            [{ name: 'emoji', version: '9.0.0' }, { name: 'dates', version: '2.1.3' }, { name: 'payments', version: '7.7.0' }],
          ],
        });
      });
      // "Design with reuse! Why build it anew?"
      move('tenor', mark(v(2), 'reuse') - 0.2, 'present', { to: [450, 250], hold: 1.2 });
      ahead.push(() => {
        const notes = kit.scene(content, mark(v(2), 'reuse'), mark(v(3), 'do'), { exit: 'fade' });
        kit.sticker(notes, 'Reuse!', { x: 330, y: 132, at: mark(v(2), 'reuse'), variant: 'gold', iconName: 'loop', rotate: -5 });
        M.card(notes, { x: 470, y: 92, w: 190, title: 'Build it anew', iconName: 'gear', tone: 'red', at: mark(v(2), 'build'), lines: ['No, thanks!'], rotate: 3 });
      });
      move('tenor', mark(v(2), 'anew'), 'wag', { hold: 0.6 });
      // "A package for transfers will know what to do!": the transfers
      // package flies off the shelf into the ticket app, which can now send
      // a ticket to a friend.
      behind.push(() => {
        const app = kit.scene(content, mark(v(3), 'a') - 0.2, mark(v(4), 'let') - 0.1, { exit: 'fade' });
        M.phone(app, { x: 676, y: 166, at: mark(v(3), 'a') - 0.2, label: 'SeatSwap', buttonText: 'BUY', lists: TICKET_SCREENS, screens: [[mark(v(3), 'a') - 0.2, 'locked'], [mark(v(3), 'do') - 0.2, 'transfer']], shineAt: [mark(v(3), 'do')] });
      });
      ahead.push(() => {
        const flight = kit.scene(content, mark(v(3), 'package') - 0.1, mark(v(3), 'do') + 0.2, { exit: 'fade' });
        M.packageBox(flight, {
          x: 486, y: 214, at: mark(v(3), 'package') - 0.1, name: 'transfers', version: '1.4.2',
          path: [[mark(v(3), 'transfers'), 712, 300, 0.7]],
        });
      });
      move('tenor', mark(v(3), 'package'), 'point', { to: [520, 240], hold: 1.6 });
      // "No lockfile to fuss with!": he tosses the lockfile off stage.
      ahead.push(() => {
        const toss = kit.scene(content, mark(v(4), 'lockfile') - 0.2, mark(v(4), 'fuss') + 1.2, { exit: 'fade' });
        M.lockfile(toss, { x: 360, y: 50, size: 0.8, at: mark(v(4), 'lockfile') - 0.1, tossAt: mark(v(4), 'fuss') });
      });
      move('tenor', mark(v(4), 'fuss') - 0.25, 'arms', { right: { reach: [150, 60], shape: 'open', dir: -40 }, hold: 0.5 });
      // "Let new versions in!": new versions of the package march in.
      // "New versions mean fixes": each gets a "fixes!" sticker. They stay
      // as long as the shelf of packages does.
      ahead.push(() => {
        const parade = kit.scene(content, mark(v(4), 'new') - 0.2, line(v(5)).end, { exit: 'fade' });
        M.marchers(parade, {
          y: 376, at: mark(v(4), 'new'), name: 'transfers', fixesAt: mark(v(5), 'fixes'),
          versions: [{ version: '1.5.0', x: 400 }, { version: '2.0.0', x: 506 }, { version: '2.1.0', x: 612 }],
        });
      });
      move('tenor', mark(v(4), 'let') - 0.1, 'present', { to: [560, 380], hold: 1.2 });
      // "A sensible win!": a trophy held high on the long note.
      plan.tenor.holds.push([mark(v(5), 'a') - 0.2, 'right', 'trophy'], [line(v(5)).end - 1, 'right', null]);
      move('tenor', mark(v(5), 'a') - 0.1, 'arms', {
        right: { reach: [126, 46], shape: 'grip', dir: -90 }, left: { arm: C.outstretched(-30), shape: 'open', dir: -20 }, hold: 3.4,
      });
      move('tenor', mark(v(5), 'win'), 'mood', { hold: 3, happy: 1, brow: 0.8, blush: 0.6 });
      ahead.push(() => {
        const glory = kit.scene(content, mark(v(5), 'win'), mark(v(5), 'win') + 1.2);
        M.sparkle(glory, { x: 318, y: 150, at: mark(v(5), 'win'), count: 7, spread: 50 });
      });
      spotlight('tenor', line(v(1)).start - 0.4, line('build-1').start - 0.3);
    }

    // ----------------------------------------------------------------
    // Act II, the Build Engineer: "your calls won't go through"
    // ----------------------------------------------------------------

    function build() {
      const v = (n) => `build-${n}`;
      const enter = line(v(1)).start - 3;
      plan.build.stage.push([enter, line('refrain-1-1').start - 0.4, { enter: 'right', exit: 'right' }]);
      placeAt('build', 0, ...HOME.mate);
      plan.build.holds.push([enter, 'left', 'wrench']);
      move('tenor', enter + 1.5, 'mood', { hold: line(v(4)).end - enter - 1.8, sweat: 1, smile: 0.5, brow: 0.7, look: 0.8 });
      move('build', enter + 1.2, 'hips', { hold: 1 });
      // "Your laptop kept old ones; my clean build got new."
      behind.push(() => {
        const works = kit.scene(content, line(v(1)).start - 0.3, line(v(2)).start - 0.1, { exit: 'fade' });
        M.laptop(works, { x: 300, y: 214, at: line(v(1)).start - 0.3, screens: [[mark(v(1), 'old'), 'cached']], cached: { name: 'transfers', version: '1.4.2' } });
        M.buildMachine(works, { x: 470, y: 196, at: mark(v(1), 'clean') - 0.2, label: 'Clean build' });
        M.packageBox(works, { x: 640, y: 312, at: mark(v(1), 'got') - 0.3, name: 'transfers', version: '2.1.0', tone: 'new', path: [[mark(v(1), 'got'), 560, 312, 0.6]] });
      });
      ahead.push(() => {
        const notes = kit.scene(content, mark(v(1), 'old'), line(v(2)).start - 0.1, { exit: 'fade' });
        kit.sticker(notes, 'Kept the old one', { x: 282, y: 330, at: mark(v(1), 'old'), variant: 'white', iconName: 'laptop', rotate: -3 });
        kit.sticker(notes, 'Fetched the new one', { x: 462, y: 150, at: mark(v(1), 'new'), variant: 'gold', iconName: 'box', rotate: 3 });
      });
      move('build', mark(v(1), 'laptop') - 0.1, 'point', { to: [366, 260], hold: 1 });
      move('build', mark(v(1), 'clean') - 0.1, 'present', { to: [600, 360], hold: 1.2 });
      // "Version two changed the API — your calls won't go through!": the
      // 2.x socket takes a new call; his old call's plug no longer fits.
      behind.push(() => {
        const socket = kit.scene(content, line(v(2)).start - 0.1, line(v(3)).start, { exit: 'fade' });
        M.plug(socket, {
          x: 300, y: 172, at: line(v(2)).start, socketLabel: 'v2: transfer(to)', plugLabel: 'v1: send()',
          pushAt: mark(v(2), 'calls'), failAt: mark(v(2), 'go'),
        });
      });
      move('build', mark(v(2), 'version'), 'point', { to: [580, 230], hold: 1.2 });
      move('build', mark(v(2), 'wont') - 0.1, 'shrug', { hold: 0.6 });
      // "Next time, pin your versions! Till then, the builds fail.": a
      // lockfile pins the old version; the build board goes red.
      ahead.push(() => {
        const pinned = kit.scene(content, line(v(3)).start - 0.2, line(v(4)).start, { exit: 'fade' });
        const card = M.card(pinned, {
          x: 330, y: 222, w: 260, title: 'package-lock.json', iconName: 'pin', tone: 'paper', at: mark(v(3), 'pin'),
          lines: ['"transfers": "1.4.2"'],
        });
        card.rows.forEach((row) => row.classList.add('mk-card-line--mono'));
      });
      house.board(mark(v(3), 'builds'), ['red', 'red', 'red', 'red', 'red', 'red'], 0.14);
      ahead.push(() => {
        const fail = kit.scene(content, mark(v(3), 'fail') - 0.1, line(v(4)).start + 0.6, { exit: 'fade' });
        kit.sticker(fail, 'All builds failed', { x: 470, y: 160, at: mark(v(3), 'fail'), variant: 'red', iconName: 'cross', rotate: 2 });
      });
      move('build', mark(v(3), 'pin') - 0.2, 'point', { to: [560, 250], hold: 0.8 });
      move('build', mark(v(3), 'builds') - 0.2, 'point', { to: [780, 116], hold: 1 });
      // "Shall I ship them your laptop by overnight mail?": his laptop
      // goes into a box marked OVERNIGHT; a FRAGILE label slaps on; he
      // clutches his head.
      behind.push(() => {
        const mail = kit.scene(content, line(v(4)).start - 0.2, line('refrain-1-1').start - 0.2, { exit: 'fade' });
        M.shippingBox(mail, { x: 470, y: 316, at: line(v(4)).start - 0.1, labelAt: mark(v(4), 'mail') });
      });
      ahead.push(() => {
        const drop = kit.scene(content, mark(v(4), 'ship') - 0.2, mark(v(4), 'laptop') + 0.6, { exit: 'fade' });
        M.laptop(drop, { x: 486, y: 150, scale: 0.8, at: mark(v(4), 'ship') - 0.2, screens: [[0, 'cached']], cached: { name: 'transfers', version: '1.4.2' }, path: [[mark(v(4), 'laptop'), 486, 300, 0.6, 0.4]] });
      });
      move('build', mark(v(4), 'shall') - 0.1, 'present', { to: [550, 340], hold: 1.6 });
      move('tenor', mark(v(4), 'laptop'), 'despair', { hold: 1.6 });
      spotlight('build', line(v(1)).start - 0.6, line(v(4)).end + 0.2);
    }

    // ----------------------------------------------------------------
    // The refrains: "It works on my machine!"
    // ----------------------------------------------------------------

    // His desk, stage left, and the laptop on it; he raises the laptop
    // high on one palm, a golden light on it, while the build board behind
    // him stays red; a tally on the desk's front counts the "tiny" fixes;
    // on "green" the laptop's lamps and the footlights turn green. The desk,
    // laptop, and tally are scenery: whoever stands in front hides them.
    const DESK = { x: 96, top: 334, w: 196 };
    const LAPTOP_ON_DESK = [134, 250];
    // On his raised palm, beside his head: its bottom centre on his hand,
    // where the pose below puts it.
    const PALM = { reach: [158, 42], shape: 'flat', dir: -6 };
    const LAPTOP_HIGH = [411, 125];
    const LAPTOP_MIDDLE = [LAPTOP_HIGH[0] + 53, LAPTOP_HIGH[1] + 40];
    function refrain(n, fixes) {
      const r = (k) => `refrain-${n}-${k}`;
      const from = line(r(1)).start - 1.4;
      const to = line(r(4)).end + 0.6;
      if (n < 3) badge('Refrain', from, to);
      placeAt('tenor', from, 380, FLOOR, 0.95, 0.9);
      behind.push(() => {
        const office = kit.scene(content, from, n === 3 ? undefined : to, { exit: 'fade' });
        M.desk(office, { x: DESK.x, top: DESK.top, w: DESK.w });
        M.laptop(office, {
          x: LAPTOP_ON_DESK[0], y: LAPTOP_ON_DESK[1], scale: 0.8, at: from + 0.2,
          screens: [[from, 'green'], [mark(r(2), 'the') - 0.2, 'code'], [mark(r(4), 'and') - 0.1, 'lamps'], ...(n === 3 ? [[mark('outro-1', 'strange') - 0.2, 'error']] : [])],
          lampsAt: mark(r(4), 'all'), lampsEvery: n === 3 ? 0.3 : 0.18,
          path: [[mark(r(1), 'works') - 0.25, LAPTOP_HIGH[0], LAPTOP_HIGH[1], 0.8, 0.45], [mark(r(2), 'the') - 0.4, LAPTOP_ON_DESK[0], LAPTOP_ON_DESK[1], 0.8, 0.45]],
        });
        M.tally(office, { x: DESK.x + 18, y: DESK.top + 14, at: mark(r(3), 'one') - 0.2, until: n === 3 ? undefined : to, title: 'Tiny fixes', values: [[mark(r(3), 'tiny'), 1], ...fixes.map(([word, count]) => [mark(r(3), word), count])] });
      });
      ahead.push(() => {
        const glory = kit.scene(content, mark(r(1), 'machine') - 0.3, mark(r(1), 'machine') + 1.4);
        M.sparkle(glory, { x: LAPTOP_MIDDLE[0], y: LAPTOP_MIDDLE[1], at: mark(r(1), 'machine'), count: 6, spread: 56 });
      });
      // A golden light on the raised laptop.
      lights.push(() => M.spot(content, () => ({ where: () => ({ x: LAPTOP_MIDDLE[0], y: LAPTOP_MIDDLE[1] + 70, scale: 0.6 }) }), { from: mark(r(1), 'works') - 0.2, to: mark(r(2), 'the') }));
      // "It works on my machine!": the laptop held high on his palm, the
      // other arm flung wide, until he puts it back on the desk.
      move('tenor', mark(r(1), 'it') - 0.3, 'point', { to: [180, 300], hold: 0.3 });
      const raised = mark(r(1), 'works') - 0.15;
      move('tenor', raised, 'arms', {
        right: PALM, left: { arm: C.outstretched(-24), shape: 'open', dir: -14 }, hold: mark(r(2), 'the') - 0.4 - raised,
      });
      move('tenor', mark(r(1), 'works'), 'mood', { hold: 2.2, happy: 1, brow: 0.8, smile: 1 });
      // "The finest code you've seen!": back on the desk, in a gilded frame; a chef's kiss.
      move('tenor', mark(r(2), 'finest') - 0.1, 'present', { to: [190, 290], hold: 1 });
      move('tenor', mark(r(2), 'seen') - 0.1, 'kiss', { hold: 0.3 });
      // "One tiny fix — or five or six —"
      move('tenor', mark(r(3), 'tiny') - 0.1, 'finger', { hold: 0.7 });
      move('tenor', mark(r(3), fixes[0][0]) - 0.1, 'shrug', { hold: 0.9 });
      // "And all the lights turn green!"
      house.footlights(mark(r(4), 'turn'), 'green', 0.6);
      if (n < 3) house.footlights(to + 0.2, 'warm', 0.8);
      move('tenor', mark(r(4), 'green') - 0.2, 'operatic', { high: 1, hold: n === 3 ? line(r(4)).end - mark(r(4), 'green') : 1.4 });
      move('tenor', mark(r(4), 'green'), 'mood', { hold: n === 3 ? line(r(4)).end - mark(r(4), 'green') : 1.4, happy: 1, brow: 1, blush: 1 });
      spotlight('tenor', from, to);
    }

    // ----------------------------------------------------------------
    // Act III, verse 3: brittle tests, "the tests will say NO!"
    // ----------------------------------------------------------------

    // The ticket transfer's code; its last line is blank but for the Test
    // Engineer's refactor, when it shows that the transfer still works,
    // until the old tests come to cling there.
    const TRANSFER = [
      'def transfer(seat, friend):',
      '    check_owner(seat)',
      '    seat.owner = friend',
      '    notify(friend)',
      '    log(seat)',
      '',
    ];
    // Where each line of the code card is on stage (its middle), for tags.
    const CODE_X = 330;
    const CODE_Y = 70;
    const lineY = (i) => CODE_Y + 43 + i * 21.7;
    // The code card and the tests that cling to it, pulled together in the tug of war.
    const tugged = [];

    function verse3() {
      const v = (n) => `verse-3-${n}`;
      badge('Act III · Testing', start('verse-3'), end('test'));
      placeAt('tenor', start('verse-3'), 186, FLOOR, 0.95, 1);
      const until = line('test-4').end;
      // "I'll make this more solid! I'll test every call!": a tag on every call.
      behind.push(() => {
        const lab = kit.scene(content, mark(v(1), 'make') - 0.2, until, { exit: 'fade' });
        const code = M.code(lab, {
          x: CODE_X, y: CODE_Y, w: 330, title: 'transfer.py', lines: TRANSFER, at: mark(v(1), 'make') - 0.2,
          changes: [
            [mark(v(4), 'step'), 3, null, 'mark-red'], [mark(v(4), 'step') + 0.8, 3, null, ''],
            [mark('test-1', 'merged'), 3, '    record(seat, friend)', 'new'], [mark('test-1', 'merged'), 4, null, 'gone'],
            [mark('test-1', 'transfer') - 0.1, 5, '# Sam now holds seat F12 ✓', 'new'],
            [line('test-4').start - 0.2, 5, '', ''],
          ],
        });
        tugged.push(code.node);
        // Staggered, so the stack of tags does not overlap.
        M.tags(lab, [1, 2, 3, 4].map((i) => [mark(v(1), 'test') + (i - 1) * 0.16, CODE_X + 262 + (i % 2) * 40, lineY(i) - 12, 'test', 'gold']), line(v(2)).end);
        M.tags(lab, [1, 2, 3, 4].map((i) => [mark(v(2), 'helpers') + (i - 1) * 0.12, CODE_X - 34, lineY(i) - 12, String(i), 'green']), line(v(4)).end);
      });
      move('tenor', mark(v(1), 'solid') - 0.2, 'thumbs', { hold: 0.6 });
      move('tenor', mark(v(1), 'every'), 'point', { to: [560, 170], hold: 0.8 });
      // "The order of helpers — I'll check it all!": a test pins the calls'
      // order. On "Test what it does, not how" it is rewritten to check
      // the outcome: the friend has the seat.
      behind.push(() => {
        const spec = kit.scene(content, mark(v(2), 'check') - 0.2, until, { exit: 'fade' });
        const fixed = mark('test-3', 'then');
        M.code(spec, {
          x: CODE_X, y: 298, w: 330, title: 'test_transfer.py', at: mark(v(2), 'check') - 0.2,
          lines: ['def test_transfer(spy):', '    transfer(seat, sam)', '    assert spy.calls == [', '        "check_owner",', '        "notify", "log"]'],
          changes: [
            ...[0, 1, 2, 3, 4].map((i) => [mark('test-2', 'failed'), i, null, 'mark-red']),
            [fixed, 0, 'def test_transfer():', ''], [fixed, 1, null, ''], [fixed, 2, '    assert sam.has(seat)', 'new'], [fixed, 3, '', ''], [fixed, 4, '', ''],
          ],
        });
      });
      move('tenor', mark(v(2), 'check') - 0.1, 'point', { to: [520, 360], hold: 0.8 });
      // "My implementation is captured just so!": a plaster cast closes round the code.
      ahead.push(() => {
        const cast = kit.scene(content, mark(v(3), 'implementation') - 0.1, line('test-1').start + 0.2, { exit: 'fade' });
        M.mold(cast, { x: CODE_X, y: CODE_Y, w: 330, h: 172, at: mark(v(3), 'implementation'), sealAt: mark(v(3), 'captured') });
      });
      move('tenor', mark(v(3), 'captured') - 0.1, 'chest', { hold: 0.8, pats: 1 });
      // "If one small step changes, the tests will say NO!"
      move('tenor', mark(v(4), 'step') - 0.1, 'point', { to: [470, 135], hold: 0.8 });
      ahead.push(() => {
        const no = kit.scene(content, mark(v(4), 'no') - 0.1, line('test-1').start + 1.4, { exit: 'fade' });
        kit.stamp(no, 'NO!', { x: 520, y: 330, at: mark(v(4), 'no'), rotate: -10, shake: false, from: 1.6 });
      });
      move('tenor', mark(v(4), 'no'), 'stop', { hold: 0.8 });
      spotlight('tenor', line(v(1)).start - 0.4, line('test-1').start - 0.2);
    }

    // ----------------------------------------------------------------
    // Act III, the Test Engineer: "there goes my whole night"
    // ----------------------------------------------------------------

    function test() {
      const v = (n) => `test-${n}`;
      const enter = line(v(1)).start - 1.6;
      plan.test.stage.push([enter, line('verse-4-1').start - 0.3, { enter: 'right', exit: 'right' }]);
      placeAt('test', 0, 830, FLOOR, 0.95);
      plan.test.holds.push([enter, 'left', 'magnifier']);
      move('tenor', enter + 1.4, 'mood', { hold: line(v(4)).end - enter - 1.6, sweat: 1, smile: 0.5, brow: 0.7, look: 0.8 });
      // "I merged two small helpers; the transfer worked right.": notify
      // and log become one helper, and the code's last line says the
      // transfer still works.
      move('test', mark(v(1), 'merged') - 0.2, 'point', { to: [560, 160], hold: 1.2 });
      move('test', mark(v(1), 'worked') - 0.1, 'thumbs', { hold: 0.7 });
      // "Your brittle tests failed — there goes my whole night!": the test
      // cracks and turns red; night falls; the clock runs to two.
      ahead.push(() => {
        const broken = kit.scene(content, mark(v(2), 'brittle') - 0.1, mark(v(3), 'then'), { exit: 'fade' });
        M.crack(broken, { x: CODE_X + 30, y: 300, w: 260, h: 118, at: mark(v(2), 'brittle') });
        kit.sticker(broken, 'Failed', { x: CODE_X + 236, y: 300, at: mark(v(2), 'failed'), variant: 'red', iconName: 'cross', rotate: 6 });
      });
      house.sky(mark(v(2), 'goes'), 'night', 1);
      house.clock(mark(v(2), 'whole'), 26, 1);
      move('test', mark(v(2), 'failed') - 0.1, 'despair', { hold: 0.7 });
      move('test', mark(v(2), 'night') - 0.2, 'yawn', { hold: 0.9 });
      // "Test what it does, not how: then my friend's ticket should show!":
      // the rule on a sticker; the test now checks that Sam has the seat,
      // and it passes.
      ahead.push(() => {
        const rule = kit.scene(content, mark(v(3), 'test') - 0.1, line(v(4)).start, { exit: 'fade' });
        kit.sticker(rule, 'Test the behavior', { x: 430, y: 256, at: mark(v(3), 'test'), variant: 'gold', iconName: 'check', rotate: -4 });
        kit.sticker(rule, 'Passes', { x: CODE_X + 236, y: 300, at: mark(v(3), 'show'), variant: 'green', iconName: 'check', rotate: 6 });
      });
      move('test', mark(v(3), 'test') - 0.1, 'point', { to: [500, 380], hold: 1 });
      move('test', mark(v(3), 'show') - 0.1, 'thumbs', { hold: 0.7 });
      // "They're in love with your old code and won't let it go!": his old
      // tests cling along the code's last lines with hearts; the Test
      // Engineer tugs at the code, and they hang on and shriek.
      ahead.push(() => {
        const clingy = kit.scene(content, line(v(4)).start - 0.1, line(v(4)).end, { exit: 'fade' });
        tugged.push(...M.testBuddies(clingy, {
          buddies: [0, 1, 2, 3].map((i) => ({ x: CODE_X + i * 90, y: 222 })),
          at: line(v(4)).start, screamAt: mark(v(4), 'go'), loveAt: mark(v(4), 'love'),
        }));
        // The tug of war: towards the Test Engineer, then the tests haul it back.
        for (const node of tugged) {
          tween(node, [{ translate: '0 0' }, { translate: '34px 0' }, { translate: '10px 0' }, { translate: '30px 0' }, { translate: '0 0' }], mark(v(4), 'wont'), 1.4, EASE.inOut);
        }
      });
      move('test', mark(v(4), 'wont') - 0.2, 'arms', { right: { to: [CODE_X + 336, 150], shape: 'grip', dir: 180 }, left: { to: [CODE_X + 332, 176], shape: 'grip', dir: 180 }, hold: 1.4 });
      move('test', mark(v(4), 'wont') - 0.2, 'mood', { lean: -5, frown: 0.8, hold: 1.4 });
      spotlight('test', line(v(1)).start - 0.3, line(v(4)).end + 0.2);
    }

    // ----------------------------------------------------------------
    // Act IV, verse 4: information hiding, "each page reads the showtime"
    // ----------------------------------------------------------------

    // How showtimes are stored is a design decision likely to change. Here
    // every page reads the raw time and does its own math, so the switch to
    // UTC reaches all of them.
    const SHOWTIMES_BEFORE = ['Fri 8:00 PM', 'Sat 2:00 PM', 'Sat 9:30 PM'];
    const SHOWTIMES_AFTER = ['Sat 03:00Z', 'Sat 21:00Z', 'Sun 04:30Z'];
    function verse4() {
      const v = (n) => `verse-4-${n}`;
      badge('Act IV · Information hiding', start('verse-4'), end('ui'));
      placeAt('tenor', start('verse-4') - 0.2, 170, FLOOR, 0.95, 1);
      // Cleared before he walks over for the refrain, which follows at once.
      const until = line('refrain-2-1').start - 1.5;
      // "Information hiding? What's there to conceal?": the Shows module, a
      // building; he flings its doors open.
      behind.push(() => {
        const street = kit.scene(content, line(v(1)).start - 0.2, until, { exit: 'fade' });
        M.moduleHouse(street, { x: 270, y: 150, at: line(v(1)).start - 0.2, name: 'SHOWS', openAt: mark(v(1), 'conceal') - 0.1 });
      });
      move('tenor', mark(v(1), 'hiding') - 0.1, 'shrug', { hold: 0.7 });
      move('tenor', mark(v(1), 'conceal') - 0.15, 'shove', { to: [400, 260], hold: 0.6 });
      // "Each page reads the showtime its own way! Ideal!": its table of
      // shows, and three pages that reach straight into the times.
      ahead.push(() => {
        const inside = kit.scene(content, mark(v(1), 'conceal') - 0.1, until, { exit: 'fade' });
        M.dataTable(inside, {
          x: 292, y: 222, at: mark(v(1), 'conceal'), title: 'shows', columns: ['id', 'show', 'time'],
          rows: [['1', 'Jazz Night', SHOWTIMES_BEFORE[0]], ['2', 'Choir', SHOWTIMES_BEFORE[1]], ['3', 'Comedy', SHOWTIMES_BEFORE[2]]],
          dateColumn: 2, newDates: SHOWTIMES_AFTER, dateAt: mark(v(4), 'utc'), glowAt: mark('ui-2', 'detail'),
        });
        const pages = [
          { name: 'Tickets', iconName: 'tag', x: 572, y: 60, broke: mark('ui-1', 'tickets'), patch: mark('ui-3', 'choices'), tx: 548, ty: 268 },
          { name: 'Reminders', iconName: 'calendar', x: 572, y: 197, broke: mark('ui-1', 'reminders'), patch: mark('ui-3', 'change'), tx: 548, ty: 292 },
          { name: 'Check-in', iconName: 'check', x: 572, y: 334, broke: mark('ui-1', 'checkin'), patch: mark('ui-3', 'module'), tx: 548, ty: 316 },
        ];
        pages.forEach((c, i) => M.client(inside, {
          x: c.x, y: c.y, at: mark(v(2), 'each') + i * 0.12, name: c.name, iconName: c.iconName, tx: c.tx, ty: c.ty,
          reachAt: mark(v(2), 'showtime') + i * 0.1, brokeAt: c.broke, patchAt: c.patch, until,
        }));
        // "Let every page do the math!": each page's own time math.
        M.tags(inside, ['+ 7 h?', 'split(":")', 'PM → 24 h'].map((text, i) => [mark(v(3), 'math') + i * 0.14, 702, 162 + i * 137, text, 'gold']), line(v(4)).end);
      });
      move('tenor', mark(v(2), 'page') - 0.2, 'present', { to: [600, 250], hold: 1.2 });
      move('tenor', mark(v(2), 'ideal') - 0.1, 'kiss', { hold: 0.3 });
      move('tenor', mark(v(3), 'math') - 0.2, 'point', { to: [560, 250], hold: 0.8 });
      move('tenor', mark(v(3), 'direct') - 0.2, 'thumbs', { hold: 0.6 });
      // "I'll switch them to UTC — what could that affect?": the times
      // change to UTC.
      move('tenor', mark(v(4), 'switch') - 0.2, 'point', { to: [470, 290], hold: 0.8 });
      move('tenor', mark(v(4), 'could') - 0.1, 'shrug', { hold: 1 });
      spotlight('tenor', line(v(1)).start - 0.4, line('ui-1').start - 0.2);
    }

    // ----------------------------------------------------------------
    // Act IV, the UI Developer: "I've aged overnight!"
    // ----------------------------------------------------------------

    function ui() {
      const v = (n) => `ui-${n}`;
      const enter = line(v(1)).start - 1.5;
      // After "I've aged overnight!" the silver-haired UI Developer lingers
      // on the cane into the refrain, so the aging can sink in.
      const leave = mark('refrain-2-1', 'my') + 1.2;
      plan.ui.stage.push([enter, leave, { enter: 'right', exit: 'right' }]);
      placeAt('ui', 0, 800, FLOOR, 0.95);
      plan.ui.holds.push([enter, 'left', 'palette']);
      move('tenor', enter + 1.4, 'mood', { hold: line(v(4)).end - enter - 1.6, sweat: 1, smile: 0.5, brow: 0.7, look: 0.8 });
      // "Now tickets, reminders, and check-in need repair!": each cracks.
      move('ui', mark(v(1), 'tickets') - 0.1, 'point', { to: [632, 110], hold: 0.6 });
      move('ui', mark(v(1), 'reminders') - 0.1, 'point', { to: [632, 246], hold: 0.5 });
      move('ui', mark(v(1), 'checkin') - 0.1, 'point', { to: [632, 384], hold: 0.6 });
      // "One detail has changed — it's used EVERYWHERE!": the times glow
      // red, and dashed lines run to everything that used them: chips in
      // the space above and below the Shows module.
      ahead.push(() => {
        const spread = kit.scene(content, mark(v(2), 'used') - 0.2, mark(v(3), 'hide') - 0.1, { exit: 'fade' });
        M.ripple(spread, {
          x: 470, y: 290, at: mark(v(2), 'used'), every: 0.07,
          targets: [
            [350, 72, 'Receipts', 'receipt'], [476, 72, 'Emails', 'envelope'], [350, 118, 'Exports', 'file'],
            [292, 372, 'Calendar', 'calendar'], [292, 420, 'Countdown', 'timer'], [476, 118, 'Reports', 'chart'],
            [432, 420, 'Scanner', 'camera'], [418, 372, 'Search', 'search'],
          ],
        });
      });
      move('ui', mark(v(2), 'detail') - 0.2, 'point', { to: [482, 290], hold: 0.8 });
      move('ui', mark(v(2), 'everywhere') - 0.15, 'throwUp', { hold: 0.8 });
      // "Hide choices that change in one module — right?": the fix, one
      // module that alone knows how times are stored; the pages get patched.
      ahead.push(() => {
        const fix = kit.scene(content, mark(v(3), 'hide') - 0.2, line('refrain-2-1').start - 1.5, { exit: 'fade' });
        const card = M.card(fix, {
          x: 300, y: 366, w: 230, title: 'Showtime module', iconName: 'lock', tone: 'gold', at: mark(v(3), 'hide'),
          lines: ['showtime(show)', 'hides the time format'], rotate: -1,
        });
        card.rows[0].classList.add('mk-card-line--mono');
      });
      move('ui', mark(v(3), 'hide') - 0.2, 'present', { to: [420, 380], hold: 1.2 });
      move('ui', mark(v(3), 'right'), 'finger', { hold: 0.7 });
      // "You moved every showtime — I've aged overnight!": night and
      // morning race past; the UI Developer's hair goes silver and a cane
      // appears.
      move('ui', mark(v(4), 'moved') - 0.1, 'point', { to: [170, 240], hold: 1 });
      house.sky(mark(v(4), 'ive'), 'night', 0.4);
      house.sky(mark(v(4), 'aged') + 0.3, 'day', 0.5);
      house.clock(mark(v(4), 'ive'), 26 + 24, 1.2);
      plan.ui.holds.push([mark(v(4), 'aged'), 'right', 'cane']);
      move('ui', mark(v(4), 'aged'), 'mood', { age: 1, hold: leave - mark(v(4), 'aged') + 2, crouch: 0.6, nod: 0.5, lean: 3, smile: -0.4 });
      move('ui', mark(v(4), 'overnight'), 'arms', { right: { reach: [118, 196], shape: 'grip', dir: 90 }, hold: leave - mark(v(4), 'overnight') + 0.4 });
      spotlight('ui', line(v(1)).start - 0.3, leave);
    }

    // ----------------------------------------------------------------
    // Act V, verse 5: "then force-push to shared main"
    // ----------------------------------------------------------------

    function verse5() {
      const v = (n) => `verse-5-${n}`;
      badge('Act V · Shared history', start('verse-5'), end('backend'));
      placeAt('tenor', start('verse-5') - 0.2, 190, FLOOR, 0.95, 1);
      const until = line('backend-4').end;
      behind.push(() => {
        const repo = kit.scene(content, line(v(1)).start - 0.2, until, { exit: 'fade' });
        M.gitGraph(repo, {
          x: 306, y: 110, scale: 1.1, at: line(v(1)).start - 0.2, mates: [{ label: 'fix' }, { label: 'fix' }, { label: 'fix' }, { label: 'fix' }],
          mine: ['wip', 'oops', 'fix', 'typo', 'wip2', 'eh'],
          squashAt: mark(v(1), 'squash'), pushAt: mark(v(2), 'forcepush'), shineAt: mark(v(2), 'shine'),
          sweepAt: mark(v(3), 'clutter'), ghostAt: mark('backend-1', 'fixes'), oldAt: mark('backend-2', 'old'), restoreAt: mark('backend-3', 'restore'),
        });
      });
      // "I'll squash all my changes to one tidy line!"
      move('tenor', mark(v(1), 'squash') - 0.2, 'arms', {
        right: { reach: [148, 128], shape: 'open', dir: 180 }, left: { reach: [148, 128], shape: 'open', dir: 180 }, hold: 0.8,
      });
      // "Then force-push to shared main — that history will shine!"
      move('tenor', mark(v(2), 'forcepush') - 0.2, 'shove', { to: [520, 200], hold: 0.9 });
      ahead.push(() => {
        const push = kit.scene(content, mark(v(2), 'forcepush'), mark(v(2), 'shine') + 0.3, { exit: 'fade' });
        // On main where theirs were, as they fall away.
        kit.stamp(push, 'Force push', { x: 470, y: 140, at: mark(v(2), 'forcepush') + 0.3, rotate: -6, shake: false, from: 1.5, small: true });
        M.sparkle(push, { x: 420, y: 176, at: mark(v(2), 'shine'), count: 6, spread: 44 });
      });
      move('tenor', mark(v(2), 'shine') - 0.1, 'kiss', { hold: 0.3 });
      // "One clean line of progress! Less clutter to see!": he sweeps the
      // fallen commits off with a broom.
      plan.tenor.holds.push([mark(v(3), 'less') - 0.6, 'right', 'broom'], [mark(v(4), 'review') - 0.2, 'right', null]);
      move('tenor', mark(v(3), 'less') - 0.5, 'arms', { right: { reach: [138, 190], shape: 'grip', dir: 60 }, left: { reach: [100, 170], shape: 'grip', dir: 60 }, hold: 0.4 });
      move('tenor', mark(v(3), 'clutter'), 'arms', { right: { reach: [66, 200], shape: 'grip', dir: 140 }, left: { reach: [56, 176], shape: 'grip', dir: 140 }, hold: 0.6 });
      // "Review will be easy — that's teamwork from me!"
      ahead.push(() => {
        const review = kit.scene(content, mark(v(4), 'review') - 0.1, line('backend-1').start + 0.4, { exit: 'fade' });
        M.card(review, { x: 430, y: 300, w: 200, title: 'Code review', iconName: 'eye', tone: 'blue', at: mark(v(4), 'review'), lines: ['1 commit to read'] });
        kit.sticker(review, 'Easy!', { x: 644, y: 314, at: mark(v(4), 'easy'), variant: 'green', iconName: 'check', rotate: 8 });
      });
      move('tenor', mark(v(4), 'teamwork') - 0.2, 'thumbs', { hold: 0.6 });
      move('tenor', mark(v(4), 'me') - 0.1, 'chest', { hold: 0.5, pats: 2 });
      spotlight('tenor', line(v(1)).start - 0.4, line('backend-1').start - 0.2);
    }

    // ----------------------------------------------------------------
    // Act V, the Back-End Developer: "my weekend is gone"
    // ----------------------------------------------------------------

    function backend() {
      const v = (n) => `backend-${n}`;
      const enter = line(v(1)).start - 1.6;
      // They stay, asleep in bed, until the Teammate's next boast (see
      // verse6()); the bed glides off with them.
      plan.backend.stage.push([enter, mark('verse-6-3', 'deployment') + 0.5, { enter: 'right', exit: 'right' }]);
      placeAt('backend', 0, 800, FLOOR, 0.95);
      plan.backend.holds.push([enter, 'left', 'mug']);
      move('tenor', enter + 1.4, 'mood', { hold: line(v(4)).end - enter - 1.6, sweat: 1, smile: 0.5, brow: 0.7, look: 0.8 });
      // "I pushed all our fixes! They're gone from shared main!"
      move('backend', mark(v(1), 'fixes') - 0.1, 'point', { to: [400, 164], hold: 1 });
      move('backend', mark(v(1), 'gone') - 0.1, 'despair', { hold: 0.9 });
      // "You forced your OLD history — we're broken again!"
      move('backend', mark(v(2), 'forced') - 0.1, 'point', { to: [200, 230], hold: 0.9 });
      house.board(mark(v(2), 'broken'), ['red', 'red', 'red', 'red', 'red', 'red'], 0.08);
      ahead.push(() => {
        const smash = kit.scene(content, mark(v(2), 'broken') - 0.1, mark(v(3), 'never') - 0.2, { exit: 'fade' });
        kit.stamp(smash, 'Broken', { x: 430, y: 330, at: mark(v(2), 'broken'), rotate: -6, shake: false, from: 1.5 });
      });
      // "Never force-push! Merge first! I'll restore them by dawn.": the
      // rule on a card; their commits fly back onto main after his; the
      // sun comes up.
      ahead.push(() => {
        const rule = kit.scene(content, mark(v(3), 'never') - 0.2, mark(v(3), 'dawn') + 0.6, { exit: 'fade' });
        const card = M.card(rule, { x: 540, y: 320, w: 210, title: 'Never force-push', iconName: 'warning', tone: 'red', at: mark(v(3), 'never'), lines: ['Merge first.'] });
        onFrame((t) => card.rows[0].classList.toggle('mk-card-line--pending', t < mark(v(3), 'merge')));
      });
      move('backend', mark(v(3), 'never') - 0.2, 'stop', { hold: 0.8 });
      move('backend', mark(v(3), 'merge') - 0.1, 'finger', { hold: 0.6 });
      move('backend', mark(v(3), 'restore') - 0.1, 'arms', { right: { reach: [150, 60], shape: 'open', dir: -60 }, hold: 0.9 });
      house.sky(mark(v(3), 'by'), 'dawn', 1.2);
      house.clock(mark(v(3), 'restore'), 30, 1);
      house.board(mark(v(3), 'dawn'), ['green', 'green', 'green', 'green', 'green', 'green'], 0.1);
      // "Some sprint that you saved us! My weekend is gone!": Saturday and
      // Sunday drift up and vanish.
      ahead.push(() => {
        const weekend = kit.scene(content, mark(v(4), 'weekend') - 0.2, line(v(4)).end, { exit: 'fade' });
        ['Sat', 'Sun'].forEach((day, i) => {
          const page = M.card(weekend, { x: 560 + i * 92, y: 300, w: 82, title: day, iconName: 'calendar', tone: 'gold', at: mark(v(4), 'weekend') + i * 0.12, lines: ['free'] });
          tween(page.node, { translate: `${i ? 18 : -18}px -40px`, rotate: `${i ? 14 : -14}deg`, scale: '0.6', opacity: 0 }, mark(v(4), 'gone') - 0.1 + i * 0.1, 0.8, EASE.in);
        });
      });
      move('backend', mark(v(4), 'some') - 0.1, 'point', { to: [200, 230], hold: 1.2 });
      move('backend', mark(v(4), 'gone') - 0.1, 'slump', { hold: 2.4 });
      spotlight('backend', line(v(1)).start - 0.3, line(v(4)).end + 0.2);
    }

    // ----------------------------------------------------------------
    // Act VI, verse 6: secrets, "I add the whole folder"
    // ----------------------------------------------------------------

    function verse6() {
      const v = (n) => `verse-6-${n}`;
      badge('Act VI · Secrets', start('verse-6'), end('security'));
      placeAt('tenor', start('verse-6') - 0.2, 200, FLOOR, 0.95, 1);
      // Late that night: the day races by to a quarter to midnight, and the
      // window goes dark, so "You get some sleep!" is bedtime.
      house.sky(start('verse-6') - 0.6, 'dusk', 0.6);
      house.sky(start('verse-6'), 'night', 0.8);
      house.clock(start('verse-6') - 0.6, 23.75, 1.4);
      // "I'll take the deployment! You get some sleep!": a bed for the
      // Back-End Developer, who yawns, lies down in it, and pulls a sleep
      // mask over their eyes.
      move('tenor', mark(v(1), 'take') - 0.1, 'chest', { hold: 0.6, pats: 1 });
      move('tenor', mark(v(1), 'get') - 0.1, 'present', { to: [780, 240], hold: 1 });
      // Clear of the curtain: the bed reaches well to the left of them.
      placeAt('backend', mark(v(1), 'take'), 760, FLOOR, 0.95, 0.9);
      plan.backend.holds.push([mark(v(1), 'some'), 'left', null]);
      move('backend', mark(v(1), 'sleep') - 0.3, 'yawn', { hold: 0.5 });
      plan.backend.beds.push([mark(v(1), 'sleep') + 0.6, undefined]);
      // Asleep under the quilt, smiling, head nodding.
      move('backend', mark(v(1), 'sleep') + 1, 'mood', { nod: 0.7, happy: 1, smile: 0.6, hold: 6 });
      // "The keys live in dot-env, not hard-coded now!"
      ahead.push(() => {
        const keys = kit.scene(content, mark(v(2), 'keys') - 0.2, line(v(3)).end, { exit: 'fade' });
        M.card(keys, { x: 330, y: 92, w: 300, title: '.env', iconName: 'key', tone: 'dark', at: mark(v(2), 'dotenv') - 0.1, lines: ['API_KEY=sk-live-4f2a…'] });
        M.code(keys, {
          x: 330, y: 196, w: 380, title: 'app.py', at: mark(v(2), 'not') - 0.3,
          lines: ['import os', 'api_key = "sk-live-4f2a…"', 'api_key = os.environ["API_KEY"]'],
          changes: [[mark(v(2), 'hardcoded'), 1, null, 'gone'], [mark(v(2), 'hardcoded'), 2, null, 'new']],
        });
        kit.sticker(keys, 'Safer!', { x: 460, y: 322, at: mark(v(3), 'safer'), variant: 'green', iconName: 'shield', rotate: -4 });
      });
      move('tenor', mark(v(2), 'keys') - 0.1, 'point', { to: [420, 120], hold: 1 });
      // "A safer deployment — allow me to bow!"
      move('tenor', mark(v(3), 'bow') - 0.3, 'bow', { hold: 1 });
      // "I add the whole folder; one push, and we're done!": git add . puts
      // .env in the commit too; git push sends it to the public repo.
      ahead.push(() => {
        const commit = kit.scene(content, mark(v(4), 'i') - 0.2, mark(v(4), 'push') + 0.9, { exit: 'fade' });
        M.folderToCommit(commit, {
          x: 300, y: 330, at: mark(v(4), 'i') - 0.1, addAt: mark(v(4), 'add'), pushAt: mark(v(4), 'push'), toX: 450, toY: 90,
          files: [{ name: 'app.py' }, { name: 'README.md' }, { name: '.env', key: true }],
        });
        // The commands, clear of the files' flight and the box's.
        const add = kit.el('div', 'mk-code-chip is-staged', commit, 'git add .');
        kit.place(add, 330, 200);
        fx.pop(add, mark(v(4), 'add'), { rotate: -2 });
        const push = kit.el('div', 'mk-code-chip is-staged', commit, 'git push');
        kit.place(push, 652, 330);
        fx.pop(push, mark(v(4), 'push') - 0.2, { rotate: 2 });
      });
      behind.push(() => {
        const cloud = kit.scene(content, mark(v(4), 'one') - 0.2, line('security-2').end, { exit: 'fade' });
        M.repoCloud(cloud, { x: 340, y: 54, at: mark(v(4), 'one') - 0.1, keysAt: mark(v(4), 'done') });
      });
      move('tenor', mark(v(4), 'add') - 0.1, 'point', { to: [340, 330], hold: 0.8 });
      move('tenor', mark(v(4), 'done') - 0.1, 'thumbs', { hold: 0.6 });
      // "At last, a smooth handoff for everyone!": keys rain on the stalls,
      // where hands reach up for them.
      ahead.push(() => {
        const rain = kit.scene(hud, mark(v(5), 'handoff') - 0.2, line(v(5)).end, { exit: 'fade' });
        M.keyRain(rain, { x: 450, y: 140, at: mark(v(5), 'handoff') });
        M.audience(rain, { at: mark(v(5), 'handoff') - 0.2, askAt: mark(v(5), 'for'), downAt: line(v(5)).end - 0.6, signs: false });
      });
      move('tenor', mark(v(5), 'everyone') - 0.2, 'operatic', { hold: 2.6 });
      spotlight('tenor', line(v(1)).start - 0.4, line('security-1').start - 0.2);
    }

    // ----------------------------------------------------------------
    // Act VI, the Security Engineer: "rotate those credentials"
    // ----------------------------------------------------------------

    // The two cards of the secrets act, below the public repo's cloud and
    // clear of both singers: the .gitignore file (without, then with, .env)
    // and the commit that holds the keys. Each is on stage only while it is
    // sung about, so the burglars, the servers, and the rocket have room.
    const IGNORE_CARD = { x: 300, y: 196, w: 230 };
    const COMMIT_CARD = { x: 548, y: 196, w: 200 };
    function gitignoreCard(scene, at, addedAt) {
      const card = M.card(scene, {
        ...IGNORE_CARD, title: '.gitignore', iconName: 'file', tone: 'paper', at,
        lines: ['node_modules/', '*.log', '(no .env)'],
      });
      card.rows.forEach((row) => row.classList.add('mk-card-line--mono'));
      onFrame((t) => {
        const added = addedAt !== undefined && t >= addedAt;
        const text = added ? '.env' : '(no .env)';
        if (card.rows[2].textContent !== text) card.rows[2].textContent = text;
        card.rows[2].classList.toggle('mk-card-line--missing', !added);
        card.rows[2].classList.toggle('mk-card-line--added', added);
      });
    }
    function commitCard(scene, at) {
      M.card(scene, { ...COMMIT_CARD, title: 'Commit 4f2a', iconName: 'key', tone: 'red', at, lines: ['app.py', 'README.md', '.env: the keys!'], rotate: 3 });
    }

    function security() {
      const v = (n) => `security-${n}`;
      const enter = line(v(1)).start - 1.8;
      // On stage from here to the end: the finale's line-up keeps them.
      plan.security.stage.push([enter, undefined, { enter: 'right' }]);
      // Midnight strikes as the thieves spin up their servers.
      house.clock(mark(v(3), 'thieves'), 24.1, 1.6);
      placeAt('security', 0, 790, FLOOR, 0.95);
      move('tenor', enter + 1.6, 'mood', { hold: line(v(4)).end - enter - 1.6, sweat: 1, smile: 0.4, brow: 0.8, look: 0.8 });
      // "Dot-env's not in gitignore — you committed the keys!"
      ahead.push(() => {
        const files = kit.scene(content, line(v(1)).start - 0.2, mark(v(2), 'strangers') - 0.3, { exit: 'fade' });
        gitignoreCard(files, line(v(1)).start - 0.1);
        commitCard(files, mark(v(1), 'committed'));
      });
      move('security', mark(v(1), 'gitignore') - 0.2, 'point', { to: [420, 250], hold: 1 });
      move('security', mark(v(1), 'keys') - 0.2, 'point', { to: [650, 256], hold: 0.9 });
      // "Our PUBLIC repo hands them to strangers with ease!": burglars pop
      // up and grab the keys.
      ahead.push(() => {
        const grab = kit.scene(content, mark(v(2), 'strangers') - 0.3, line(v(2)).end + 0.4, { exit: 'fade' });
        M.burglar(grab, { x: 300, y: 128, at: mark(v(2), 'strangers') - 0.2, grabAt: mark(v(2), 'with') });
        M.burglar(grab, { x: 520, y: 132, at: mark(v(2), 'strangers'), grabAt: mark(v(2), 'ease'), flip: true });
      });
      move('security', mark(v(2), 'public') - 0.2, 'point', { to: [460, 100], hold: 1.2 });
      // "Thieves are spinning up servers; we're deep in the red!": the
      // bill hangs above the servers until the finale's refrain.
      behind.push(() => {
        const farm = kit.scene(content, mark(v(3), 'thieves') - 0.2, line(v(4)).end, { exit: 'fade' });
        [0, 1, 2].forEach((i) => M.serverRack(farm, { x: 300 + i * 92, y: 222, at: mark(v(3), 'thieves') + i * 0.1, spinAt: mark(v(3), 'spinning') + i * 0.1 }));
      });
      ahead.push(() => {
        const money = kit.scene(content, mark(v(3), 'were') - 0.2, line('refrain-3-1').start - 0.6, { exit: 'fade' });
        M.bill(money, { x: 380, y: 64, at: mark(v(3), 'were') - 0.1, counts: [[mark(v(3), 'deep'), 48200, 1.2], [mark(v(9), 'spending'), 61900, 1.4]] });
      });
      move('security', mark(v(3), 'spinning') - 0.1, 'present', { to: [430, 290], hold: 1 });
      move('security', mark(v(3), 'red') - 0.2, 'facepalm', { hold: 0.9 });
      house.board(mark(v(3), 'servers'), ['red', 'red', 'red', 'red', 'red', 'red'], 0.1);
      // "You wanted a launch — we're funding THEIRS instead!": their
      // rocket, beside the servers, lifts off past the bill.
      ahead.push(() => {
        const launch = kit.scene(content, mark(v(4), 'wanted') - 0.2, mark(v(4), 'instead') + 0.6, { exit: 'fade' });
        M.rocket(launch, { x: 592, y: 214, at: mark(v(4), 'wanted') - 0.1, label: 'THEIRS', launchAt: mark(v(4), 'launch') + 0.2 });
      });
      move('security', mark(v(4), 'theirs') - 0.2, 'throwUp', { hold: 0.8 });
      // "I'll add it to gitignore!" (the Teammate, nervously): the
      // .gitignore card is back, and .env goes into it.
      move('tenor', mark(v(5), 'ill') - 0.2, 'mood', { hold: 1.6, sweat: 1, wide: 1, brow: 1, smile: 0.3 });
      move('tenor', mark(v(5), 'add') - 0.2, 'point', { to: [420, 250], hold: 1 });
      ahead.push(() => {
        const again = kit.scene(content, line(v(5)).start - 0.3, line(v(6)).end, { exit: 'fade' });
        gitignoreCard(again, line(v(5)).start - 0.2, mark(v(5), 'gitignore'));
        // "That won't uncommit it!": the commit, keys and all, is still there.
        commitCard(again, mark(v(6), 'wont') - 0.1);
      });
      // "That won't uncommit it!" (the Security Engineer) — "Old copies
      // remain!" (the Teammate, groaning): copies of the repo, each with the keys.
      move('security', mark(v(6), 'wont') - 0.1, 'wag', { hold: 0.8 });
      // The copies and the stamps clear the stage before the finale's line-up comes on.
      const cleared = line('refrain-3-1').start - 1.65;
      ahead.push(() => {
        const copies = kit.scene(content, mark(v(7), 'copies') - 0.2, cleared, { exit: 'fade' });
        M.forks(copies, { x: 320, y: 330, at: mark(v(7), 'copies'), count: 5 });
      });
      move('tenor', mark(v(7), 'old') - 0.2, 'mood', { hold: 0.9, sweat: 1, wide: 1, frown: 1, brow: 1 });
      move('tenor', mark(v(7), 'copies') - 0.1, 'point', { to: [320, 330], hold: 0.7 });
      // "Rotate those credentials—" (the Security Engineer): the old keys are
      // stamped ROTATED.
      plan.security.holds.push([mark(v(8), 'rotate') - 0.8, 'right', 'stamp'], [line(v(8)).end, 'right', null]);
      move('security', mark(v(8), 'rotate') - 0.5, 'arms', { right: { reach: [124, 40], shape: 'grip', dir: -90 }, hold: 0.25 });
      move('security', mark(v(8), 'rotate'), 'arms', { right: { reach: [130, 150], shape: 'grip', dir: 90 }, hold: 0.5 });
      ahead.push(() => {
        const revoke = kit.scene(content, mark(v(8), 'rotate'), cleared, { exit: 'fade' });
        kit.stamp(revoke, 'Rotated', { x: 330, y: 300, at: mark(v(8), 'rotate'), rotate: -8, shake: false, from: 1.5, small: true });
        kit.stamp(revoke, 'Rotated', { x: 520, y: 360, at: mark(v(8), 'credentials'), rotate: 6, shake: false, from: 1.5, small: true });
      });
      // "They're spending again!" (the Teammate, aghast): the bill climbs.
      move('tenor', mark(v(9), 'spending') - 0.2, 'point', { to: [480, 110], hold: 0.3 });
      move('tenor', mark(v(9), 'again') - 0.15, 'despair', { hold: 0.5 });
      spotlight('security', line(v(1)).start - 0.3, line(v(4)).end + 0.2);
      spotlight('tenor', line(v(5)).start - 0.3, line(v(5)).end);
      spotlight('security', line(v(6)).start - 0.2, line(v(6)).end);
      spotlight('tenor', line(v(7)).start - 0.1, line(v(7)).end);
      spotlight('security', line(v(8)).start - 0.1, line(v(8)).end);
      spotlight('tenor', line(v(9)).start - 0.1, line(v(9)).end);
    }

    // ----------------------------------------------------------------
    // The finale: the whole team lines up behind him
    // ----------------------------------------------------------------

    // In the spoken outro the Security Engineer slips off the right wing and
    // comes back from the left, between him and his desk.
    const OUTRO_RETURN = line('outro-3').start - 0.35;

    // The chorus line, shoulder to shoulder behind him, right of his desk.
    const LINEUP = [['pm', 482, 'left'], ['build', 556, 'left'], ['test', 630, 'right'], ['ui', 704, 'right'], ['backend', 778, 'right'], ['security', 852, 'right']];
    function finale() {
      const at = line('refrain-3-1').start - 1.6;
      badge('Finale', at, undefined);
      LINEUP.forEach(([role, x, wing], i) => {
        if (role !== 'security') plan[role].stage.push([at + i * 0.08, undefined, { enter: wing }]);
        placeAt(role, at - 0.1, x, 430, 0.7, role === 'security' ? 1.2 : 0.01);
        move(role, at + 1.4, 'hips', { hold: 6 });
        move(role, mark('refrain-3-3', 'ninetysix') + i * 0.05, 'facepalm', { hold: 1.4 });
        move(role, mark('refrain-3-4', 'green') + i * 0.06, 'despair', { hold: 1.8 });
      });
      plan.ui.holds.push([at, 'right', null]);
      move('ui', at, 'mood', { age: 1, hold: 30 });
      ahead.push(() => {
        const party = kit.scene(content, mark('refrain-3-4', 'green'), mark('refrain-3-4', 'green') + 6.5);
        kit.confetti(party, { x: 470, y: 160, at: mark('refrain-3-4', 'green') + 0.2, count: 72 });
      });
      house.footlights(line('refrain-3-4').end + 0.05, 'out', 0.15);
    }

    // ----------------------------------------------------------------
    // Outro (spoken): "Strange. It worked on my machine."
    // ----------------------------------------------------------------

    function outro() {
      const v = (n) => `outro-${n}`;
      // "Strange.": the music stops; he looks at his laptop, puzzled; it
      // shows a fatal error.
      move('tenor', mark(v(1), 'strange') - 0.1, 'mood', { hold: 3, look: -1, brow: 1, frown: 0.4, smile: -0.2 });
      move('tenor', mark(v(1), 'worked') - 0.1, 'point', { to: [190, 290], hold: 1 });
      // "I'll just make one small change.": he reaches for the keyboard.
      placeAt('tenor', line(v(2)).start - 0.6, 312, FLOOR, 0.95, 0.6);
      move('tenor', mark(v(2), 'just') - 0.1, 'arms', {
        right: { to: [214, 316], shape: 'point', dir: 150 }, left: { to: [196, 322], shape: 'point', dir: 150 }, hold: 1.4,
      });
      move('tenor', mark(v(2), 'just'), 'mood', { hold: 1.4, lean: -5, smile: 0.9, brow: 0.6 });
      // "Step away from the keyboard!", sung by all six teammates: the
      // viewer's hero, the worried teammate at the laptop in the overture,
      // glides in from the left between him and the desk, palm out, and
      // sings along; the line-up holds out six more palms; he has jumped
      // back, hands up.
      placeAt('hero', 0, 300, FLOOR, 0.95);
      plan.hero.stage.push([OUTRO_RETURN, undefined, { enter: 'left' }]);
      move('hero', mark(v(3), 'away') - 0.2, 'stop', { hold: 3 });
      placeAt('tenor', mark(v(3), 'step') - 0.1, 412, FLOOR, 0.95, 0.7);
      move('tenor', mark(v(3), 'step'), 'surrender', { hold: 4.4 });
      LINEUP.forEach(([role], i) => move(role, mark(v(3), 'away') - 0.2 + i * 0.06, 'stop', { hold: 3.2 }));
      spotlight('hero', OUTRO_RETURN + 0.1, line(v(3)).end + 1);
      // The final chord: the curtain falls as the last note ends, and the
      // moral is posted on it once it has closed.
      // The ending is sung twice; the curtain falls on the second.
      const curtain = mark(v(3), 'keyboard_2') + 0.8;
      house.curtain(curtain, 0, 1.6);
      ahead.push(() => {
        const moral = kit.scene(hud, curtain + 1.5, undefined);
        M.moral(moral, {
          x: 230, y: 110, w: 500, at: curtain + 1.7, title: 'The moral of the opera',
          lines: ['Ask your users what they need.', 'Pin your dependency versions.', 'Test behavior, not implementation.', 'Hide decisions likely to change.', 'Never force-push a shared branch.', 'Keep secrets out of Git.'],
        });
      });
    }

    intro();
    verse1();
    pm();
    verse2();
    build();
    refrain(1, [['five', 5], ['six', 6]]);
    verse3();
    test();
    verse4();
    ui();
    refrain(2, [['twentysix', 26]]);
    verse5();
    backend();
    verse6();
    security();
    finale();
    refrain(3, [['ninetysix', 96]]);
    outro();

    // ----------------------------------------------------------------
    // Build: the scenery behind, the cast and its spotlights, the props in front.
    // ----------------------------------------------------------------

    // A singer's words, and for the teammates the line all six sing together.
    // The tenor keeps his drawn face; the hero wears the viewer's own.
    const headFor = (role) => {
      if (role === 'tenor') return undefined;
      if (role === 'hero') return student?.heroHead();
      return student?.castHead(womansLook);
    };
    const wordsOf = (role, voice) => [...C.wordsFor(song.storyboard, voice), ...(role === 'tenor' ? [] : C.wordsFor(song.storyboard, ENSEMBLE))];
    for (const draw of behind) draw();
    for (const draw of lights) draw();
    for (const [role, voice] of Object.entries(VOICES)) {
      const p = plan[role];
      if (!p.stage.length) continue;
      if (!p.places.length) placeAt(role, 0, ...(role === 'tenor' ? HOME.tenor : HOME.mate));
      figures[role] = C.figure(content, {
        role, hero: headFor(role), stage: p.stage, places: p.places,
        moves: p.moves, holds: p.holds, beds: p.beds, words: wordsOf(role, voice), seed: Object.keys(VOICES).indexOf(role),
      });
    }
    for (const draw of ahead) draw();
  };
})();
