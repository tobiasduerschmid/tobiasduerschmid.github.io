/*
 * Choreography for "Invest in Your Stories", the user stories and INVEST
 * song (storyboard: _data/songs/invest_in_your_stories.yml).
 *
 * Every visual hits a sung word: `mark(lineId, word)` is that word's time in
 * the recording. The teaching rule for the visuals: show exactly what the
 * line says, one idea per scene. A user story is always a ruled index card
 * (As a / I want / so that) with its acceptance criteria as Given / When /
 * Then lines, and those criteria always fit the verdict the song gives the
 * story: a Testable failure carries its vague word into the criteria, a
 * Valuable failure stays testable but helps only devs, a story that passes
 * has concrete criteria. The line being sung about is highlighted; the rest
 * of the card can be read on pause. INVEST is always the same scanner of
 * six lamps (see js/song-video/story-kit.js). In the verses a tiny scanner
 * in the top-right corner shows which letter is being taught; in the chorus
 * the full scanner lights each letter as it is sung, and in the quiz the
 * broken letter lights red. Each line's `visual` text in the storyboard
 * describes this file.
 *
 * Layout: 960×540 stage; the section badge sits top-left, the tiny verse
 * scanner top-right (x ≥ 630, y ≤ 62), and nothing essential goes below
 * y = 460, where the player draws captions.
 *
 * Flash safety (WCAG 2.3.1): the cards are dense dark text on light paper,
 * and text that shakes or slides far across the frame flips many pixels
 * between ink and paper, which the flash screen counts as flashing. So
 * stamps here never shake the stage (`shake: false`), and a card that must
 * change places fades out, moves while invisible, and fades back in. Check
 * with `node scripts/song-video/render.js invest_in_your_stories --check-flashes`.
 */
(function () {
  'use strict';

  /** The running example: the pre-chorus story, sized in verse 3 and tested there. */
  const LAUNDRY = {
    role: 'student in the dorms',
    want: 'a ping when my wash is done',
    why: 'my wet clothes don’t get dumped by someone',
    gwt: ['Given my wash is running', 'When the cycle ends', 'Then my phone pings within a minute'],
  };

  /**
   * The pop quiz, in sung order. Each story breaks exactly the lamp it
   * names (6 = none), and its criteria fit that verdict; `aside` is the
   * spoken context after the quote, shown on a note at `asideWord`.
   */
  const QUIZ = [
    {
      lamp: 1, reason: 'algorithm = a how',
      story: {
        role: 'student', want: 'my route to class found with Dijkstra’s algorithm',
        gwt: ['Given I’m at the library', 'When I ask for a route to my class', 'Then I get the shortest walking route', 'And it is computed with Dijkstra’s algorithm'],
      },
    },
    {
      lamp: 2, reason: 'only devs benefit',
      story: {
        role: 'developer', want: '90% test coverage on the cart code',
        gwt: ['Given the cart code', 'When the test suite runs', 'Then coverage is at least 90%'],
      },
    },
    {
      lamp: 4, reason: '3 stories: split it',
      story: {
        role: 'renter', want: 'to view my lease, report a repair, and message my landlord',
        gwt: ['Given I’m logged in', 'When I open the renter app', 'Then I can view my lease', 'And I can report a repair', 'And I can message my landlord'],
      },
    },
    {
      lamp: 0, reason: 'waits for: book a ride', aside: 'nobody can book a ride yet', asideWord: 'nobody',
      story: {
        role: 'rider', want: 'to rate my driver',
        gwt: ['Given I finished a ride', 'When I give my driver 5 stars', 'Then the rating shows on their profile'],
      },
    },
    {
      lamp: 5, reason: '“aesthetic”: pass or fail?',
      story: {
        role: 'club president', want: 'our sign-up page to look aesthetic', why: 'more people join',
        gwt: ['Given the sign-up page is live', 'When a student opens it', 'Then it looks aesthetic'],
      },
    },
    {
      lamp: 3, reason: 'ask the coach', aside: 'only the coach knows the formula', asideWord: 'only',
      story: {
        role: 'coach', want: 'each player’s readiness score',
        gwt: ['Given a player’s stats are in', 'When I open their profile', 'Then I see their readiness score'],
      },
    },
    {
      lamp: 6,
      story: {
        role: 'student', want: 'to mute my group chat for an hour', why: 'I can study in peace',
        gwt: ['Given my group chat is active', 'When I mute it for an hour', 'Then I get no notifications from it for that hour'],
      },
    },
  ];
  const NONE_LAMP = 6;

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.invest_in_your_stories = function choreograph({ song, kit, layers, student }) {
    const { fx, tween, EASE, camera } = window.Timeline;
    const us = window.StoryKit;
    const { content, hud } = layers;
    const line = (id) => song.line(id);
    const mark = (id, word) => song.mark(id, word);
    const end = (id) => song.sectionEnd(id);

    function badge(text, sectionId) {
      kit.badge(hud, text, song.sectionStart(sectionId), song.sectionEnd(sectionId));
    }

    function note(parent, text, { x, y, at, until, variant = 'gold' }) {
      const node = kit.place(kit.el('div', `us-note us-note--${variant} is-staged`, parent, text), x, y);
      fx.pop(node, at, { from: 0.6 });
      if (until !== undefined) fx.popOut(node, until);
      return node;
    }

    /** The tiny scanner of a verse: each letter lights while it is taught. */
    function verseScanner(sectionId, letters) {
      const scan = us.scanner(hud, { x: 630, y: 8, tiny: true, at: song.sectionStart(sectionId) + 0.1, until: end(sectionId) });
      for (const { index, from, to } of letters) {
        scan.light(index, from, 'on');
        scan.light(index, to, 'pass');
      }
      return scan;
    }

    // ----------------------------------------------------------------
    // Intro: every test is green, and it's still the wrong thing
    // ----------------------------------------------------------------

    function intro() {
      const cardAt = line('intro-5').start;
      const a = kit.scene(content, 0, cardAt - 0.1, { exit: 'fade' });
      student?.appear({ from: 0.9, to: cardAt - 0.2, x: 30, y: 150, scale: 0.9 });
      kit.kinetic(a, [
        { text: 'Demo', at: mark('intro-1', 'demo'), color: 'gold' },
        { text: 'day', at: mark('intro-1', 'day') },
      ], { y: 46, size: 60, until: line('intro-3').start - 0.1 });
      us.testBar(a, { x: 330, y: 150, w: 420, at: mark('intro-2', 'your'), fillUntil: mark('intro-2', 'green') });
      kit.sticker(a, 'Works perfectly', { x: 610, y: 108, at: mark('intro-2', 'perfectly'), until: line('intro-4').start, variant: 'green', iconName: 'check', rotate: 4 });
      us.speech(a, { x: 320, y: 270, w: 560, text: 'Cool… but that’s not what I needed.', at: mark('intro-3', 'cool') });
      kit.stamp(a, 'Wrong thing', { x: 560, y: 368, at: mark('intro-3', 'needed'), until: mark('intro-4', 'not'), color: 'red', rotate: -7, shake: false });
      // Tests show we built it right; only the user can say it's the right thing.
      kit.sticker(a, 'built it right', { x: 610, y: 104, at: mark('intro-4', 'right'), variant: 'green', iconName: 'check', rotate: 3 });
      kit.sticker(a, 'not the right thing', { x: 540, y: 376, at: mark('intro-4', 'thing'), variant: 'red', iconName: 'cross', rotate: -4 });

      // Before any code: what should we build?
      const b = kit.scene(content, cardAt - 0.1, end('intro'));
      us.card(b, {
        x: 290, y: 108, w: 380, at: mark('intro-5', 'write'), tilt: -2,
        role: '…', want: '…', why: '…', gwt: ['Given …', 'When …', 'Then …'],
      });
      note(b, 'What should we build?', { x: 348, y: 48, at: mark('intro-5', 'what') });
      kit.sticker(b, 'not a single line yet', { x: 640, y: 350, at: mark('intro-5', 'single'), variant: 'white', iconName: 'pencil', rotate: 5 });
    }

    // ----------------------------------------------------------------
    // Verse 1: why user stories, and how one need becomes precise
    // ----------------------------------------------------------------

    function verse1() {
      badge('Verse 1 · Why user stories', 'verse-1');
      const start = song.sectionStart('verse-1');

      // Who, what, why — before how.
      const cardLine = line('verse-1-3').start;
      const a = kit.scene(content, start, cardLine - 0.1);
      const how = kit.place(kit.el('div', 'us-question is-staged', a), 400, 110);
      kit.el('b', null, how, 'How?');
      kit.el('span', null, how, 'build it');
      fx.pop(how, mark('verse-1-1', 'how'));
      fx.moveTo(how, mark('verse-1-1', 'who') - 0.1, 350, 0, 0.5);
      // Parked for later: dimmed but opaque, so the wall behind never shows through it.
      tween(how, { scale: 0.75, filter: 'saturate(0.25) brightness(0.6)' }, mark('verse-1-1', 'who'), 0.4);
      kit.sticker(a, 'later', { x: 800, y: 250, at: mark('verse-1-1', 'what'), variant: 'white', rotate: 6 });
      [['who', 'Who?', 'the user'], ['what', 'What?', 'they need'], ['why', 'Why?', 'their goal']].forEach(([word, big, small], i) => {
        const tile = kit.place(kit.el('div', 'us-question is-staged', a), 110 + i * 190, 110);
        kit.el('b', null, tile, big);
        kit.el('span', null, tile, small);
        fx.pop(tile, mark('verse-1-1', word), { from: 0.5 });
      });
      kit.kinetic(a, [
        { text: 'through your', at: mark('verse-1-2', 'through') },
        { text: 'users’ eyes', at: mark('verse-1-2', 'eyes') - 0.3, color: 'gold', iconName: 'eye' },
      ], { y: 300, size: 46 });

      // One card for the rest of the verse: a rider's need, made precise line by line.
      const b = kit.scene(content, cardLine - 0.1, end('verse-1'));
      const story = us.card(b, {
        x: 40, y: 74, w: 560, at: mark('verse-1-3', 'card'), tilt: -1,
        role: 'user', want: 'to see my car on a map', why: 'I can see my car',
        gwt: ['Given I booked a ride', 'When my driver is on the way', 'Then I see the car and minutes away'],
        gwtAt: [mark('verse-1-9', 'acceptance'), mark('verse-1-9', 'criteria'), mark('verse-1-9', 'spell')],
      });
      [['REST API', 300, 'plain'], ['GPS polling', 440, 'words']].forEach(([word, x, dropWord], i) => {
        const chip = us.miniCard(b, { x, y: 130, text: word, tone: 'ghost', at: mark('verse-1-3', 'need') + i * 0.12, tilt: i ? 6 : -6 });
        kit.fall(chip, mark('verse-1-3', dropWord), { spin: 150 + i * 40, drift: i ? 40 : -30 });
      });
      const roleLine = line('verse-1-5').start;
      note(b, 'in their own plain words', { x: 632, y: 112, at: mark('verse-1-3', 'words'), until: roleLine, variant: 'green' });
      kit.sticker(b, 'a ticket to talk', { x: 640, y: 186, at: mark('verse-1-4', 'ticket'), until: roleLine, variant: 'cyan', iconName: 'chat', rotate: -4 });
      us.speech(b, { x: 612, y: 256, w: 290, text: 'Why do you need it?', from: 'team', at: mark('verse-1-4', 'why'), until: roleLine });

      // "A user" is too blurry: the rider and the driver see different things.
      story.strike('role', mark('verse-1-5', 'blurry'));
      note(b, 'Which user?', { x: 660, y: 140, at: mark('verse-1-5', 'exactly'), until: line('verse-1-6').start + 0.3, variant: 'red' });
      const viewsGone = line('verse-1-7').start;
      us.nameTag(b, { x: 640, y: 80, name: 'rider', at: mark('verse-1-6', 'rider'), until: viewsGone, tilt: -4 });
      kit.sticker(b, 'sees: my car, 3 min away', { x: 628, y: 196, at: mark('verse-1-6', 'and'), until: viewsGone, variant: 'white', iconName: 'eye', rotate: -3 });
      us.nameTag(b, { x: 690, y: 250, name: 'driver', at: mark('verse-1-6', 'driver'), until: viewsGone, tilt: 4 });
      kit.sticker(b, 'sees: pickup at 5th & Main', { x: 628, y: 366, at: mark('verse-1-6', 'view'), until: viewsGone, variant: 'white', iconName: 'eye', rotate: 3 });
      story.rewrite('role', 'rider', mark('verse-1-6', 'rider'));

      // "I want" is the need; "so that" is the real why, not the feature again.
      const criteriaLine = line('verse-1-9').start;
      story.highlight('want', mark('verse-1-7', 'need'), { until: criteriaLine });
      note(b, 'the need', { x: 650, y: 112, at: mark('verse-1-7', 'need'), until: criteriaLine });
      story.highlight('why', mark('verse-1-7', 'why'), { tone: 'cyan', until: criteriaLine });
      note(b, 'the real why', { x: 650, y: 172, at: mark('verse-1-7', 'why'), until: criteriaLine, variant: 'cyan' });
      story.disguise('why', mark('verse-1-8', 'same'));
      kit.sticker(b, 'same feature, new disguise', { x: 630, y: 244, at: mark('verse-1-8', 'disguise'), until: criteriaLine, variant: 'red', iconName: 'cross', rotate: -3 });
      story.rewrite('why', 'I’m outside when it pulls up', criteriaLine - 0.15);

      // Acceptance criteria say when it's done, without choosing the code.
      story.check(2, mark('verse-1-9', 'done'));
      note(b, 'done = criteria pass', { x: 650, y: 150, at: mark('verse-1-9', 'done'), variant: 'green' });
      kit.sticker(b, 'clear enough to test', { x: 640, y: 230, at: mark('verse-1-10', 'test'), variant: 'green', iconName: 'check', rotate: -3 });
      kit.sticker(b, 'not the code you run', { x: 640, y: 300, at: mark('verse-1-10', 'code'), variant: 'red', iconName: 'cross', rotate: 3 });
    }

    // ----------------------------------------------------------------
    // Pre-chorus: fill in the card, then check it with INVEST
    // ----------------------------------------------------------------

    function preChorus() {
      badge('As a · I want · so that', 'pre-chorus');
      const s = kit.scene(content, song.sectionStart('pre-chorus'), end('pre-chorus'));
      const criteriaAt = mark('pre-chorus-4', 'is');
      us.card(s, {
        x: 140, y: 56, w: 680, at: line('pre-chorus-1').start, tilt: -1, ...LAUNDRY,
        fill: {
          role: mark('pre-chorus-1', 'student'),
          want: mark('pre-chorus-2', 'ping'),
          why: mark('pre-chorus-3', 'my'),
        },
        gwtAt: [criteriaAt, criteriaAt + 0.15, criteriaAt + 0.3],
      });
      // Each slot's question lands as its slot starts (the take doesn't sing them).
      [['pre-chorus-1', 'as', 'who?', 84], ['pre-chorus-2', 'want', 'what?', 116], ['pre-chorus-3', 'that', 'why?', 148]].forEach(([id, word, text, y]) => {
        note(s, text, { x: 44, y, at: mark(id, word), until: end('pre-chorus') - 0.3 });
      });
      const scan = us.scanner(s, { x: 105, y: 346, at: mark('pre-chorus-4', 'check') });
      us.LETTERS.forEach((_, i) => scan.light(i, mark('pre-chorus-4', 'invest') + i * 0.06, 'on'));
      us.LETTERS.forEach((_, i) => scan.light(i, mark('pre-chorus-4', 'invest') + 0.6, 'off'));
    }

    // ----------------------------------------------------------------
    // Chorus: the scanner lights one letter per line
    // ----------------------------------------------------------------

    /** I! N! V! E! S! T! lights every lamp, then "Invest in your stories". */
    function rollCall(s, scan, spellId, tagId) {
      const LETTER_WORD = ['i', 'n', 'v', 'e', 's', 't'];
      const letters = kit.kinetic(s, LETTER_WORD.map((word, i) => ({
        text: us.LETTERS[i].letter, at: mark(spellId, word), color: i % 2 ? 'cyan' : 'gold',
      })), { y: 200, size: 104, until: line(tagId).start - 0.2 });
      letters.classList.add('us-spell');
      LETTER_WORD.forEach((word, i) => {
        scan.light(i, mark(spellId, word), 'pass');
        fx.bump(scan.lamps[i], mark(spellId, word), 0.3);
      });
      kit.kinetic(s, [
        { text: 'Invest', at: mark(tagId, 'invest'), color: 'gold' },
        { text: 'in your stories', at: mark(tagId, 'stories') },
      ], { y: 196, size: 56 });
      kit.sticker(s, '+ interest', { x: 590, y: 300, at: mark(tagId, 'interest'), variant: 'green', iconName: 'percent', rotate: -5 });
    }

    function chorus(id, title) {
      badge(title, id);
      const s = kit.scene(content, song.sectionStart(id), end(id));
      const scan = us.scanner(s, { x: 194, y: 50, compact: true, at: song.sectionStart(id) + 0.1 });
      for (let i = 0; i < 6; i++) {
        const lineId = `${id}-${i + 1}`;
        // The take drops some shouted letters, so each letter lands with its line.
        const at = line(lineId).start;
        const next = line(`${id}-${i + 2}`).start;
        scan.light(i, at, 'on');
        scan.light(i, next - 0.05, 'pass');
        us.letterPanel(s, { index: i, y: 200, at, until: next - 0.18 });
        camera.punch(at + 0.04, 0.025);
        chorusDetail(s, i, lineId, next);
      }
      rollCall(s, scan, `${id}-7`, `${id}-8`);
    }

    /** The middle chorus sings only the letters and the hook. */
    function shortChorus(id, title) {
      badge(title, id);
      const s = kit.scene(content, song.sectionStart(id), end(id));
      const scan = us.scanner(s, { x: 194, y: 50, compact: true, at: song.sectionStart(id) + 0.1 });
      rollCall(s, scan, `${id}-1`, `${id}-2`);
    }

    /** Stickers under each chorus letter that spell out its definition. */
    function chorusDetail(s, i, lineId, next) {
      const until = next - 0.2;
      const y = 370;
      const at = (word) => mark(lineId, word);
      if (i === 0) {
        const a = us.miniCard(s, { x: 330, y, text: 'Story A', at: at('overlap'), until });
        const b = us.miniCard(s, { x: 530, y, text: 'Story B', at: at('waiting'), until });
        fx.moveTo(a, at('order'), 200, 0, 0.45);
        fx.moveTo(b, at('order'), -200, 0, 0.45);
      } else if (i === 1) {
        kit.sticker(s, 'the need', { x: 280, y, at: at('need'), until, variant: 'green', iconName: 'check', rotate: -3 });
        kit.sticker(s, 'the design: talk it over', { x: 450, y, at: at('design'), until, variant: 'cyan', iconName: 'chat', rotate: 3 });
      } else if (i === 2) {
        kit.sticker(s, 'not just devs', { x: 250, y, at: at('devs'), until, variant: 'red', iconName: 'cross', rotate: -3 });
        kit.sticker(s, 'users', { x: 470, y, at: at('users'), until, variant: 'gold', iconName: 'user', rotate: 2 });
        kit.sticker(s, 'customers', { x: 600, y, at: at('customers'), until, variant: 'gold', iconName: 'cart', rotate: -2 });
      } else if (i === 3) {
        kit.sticker(s, 'scope: clear', { x: 320, y, at: at('clear'), until, variant: 'green', iconName: 'check', rotate: -3 });
        kit.sticker(s, 'effort: 5 pts', { x: 520, y, at: at('size'), until, variant: 'cyan', iconName: 'timer', rotate: 3 });
      } else if (i === 4) {
        kit.sticker(s, 'fits 1 sprint', { x: 270, y, at: at('sprint'), until, variant: 'cyan', iconName: 'calendar', rotate: -3 });
        kit.sticker(s, 'smallest slice, still valuable', { x: 450, y, at: at('slice'), until, variant: 'pink', iconName: 'scissors', rotate: 3 });
      } else {
        kit.sticker(s, 'pass', { x: 300, y, at: at('pass'), until, variant: 'green', iconName: 'check', rotate: -3 });
        kit.sticker(s, 'fail', { x: 420, y, at: at('fail'), until, variant: 'red', iconName: 'cross', rotate: 3 });
        kit.sticker(s, 'no “-ish”', { x: 540, y, at: at('ish'), until, variant: 'white', iconName: 'cross', rotate: -2 });
      }
    }

    // ----------------------------------------------------------------
    // Verse 2: Independent, Negotiable, Valuable
    // ----------------------------------------------------------------

    function verse2() {
      badge('Verse 2 · Independent · Negotiable · Valuable', 'verse-2');
      verseScanner('verse-2', [
        { index: 0, from: mark('verse-2-1', 'independent'), to: line('verse-2-7').start },
        { index: 1, from: mark('verse-2-7', 'negotiable'), to: line('verse-2-13').start },
        { index: 2, from: mark('verse-2-13', 'valuable'), to: end('verse-2') - 0.3 },
      ]);
      const start = song.sectionStart('verse-2');

      // Independent: either search can ship first — but both promise artist search.
      const cakeLine = line('verse-2-3').start;
      const a = kit.scene(content, start, cakeLine - 0.1);
      const shared = ['Given the app has SZA songs', 'When I search “SZA”', 'Then only SZA songs show'];
      const artist = us.card(a, {
        x: 30, y: 74, w: 440, size: 'small', title: 'Story A', at: mark('verse-2-1', 'independent'), tilt: -1,
        role: 'listener', want: 'to search songs by artist', why: 'I find songs by acts I love', gwt: shared,
      });
      const album = us.card(a, {
        x: 490, y: 74, w: 440, size: 'small', title: 'Story B', at: mark('verse-2-1', 'story'), tilt: 1,
        role: 'listener', want: 'to search by artist or album', why: 'I find an album I heard about',
        gwt: [...shared, 'When I search an album', 'Then its tracks show'],
      });
      // Either order works: the cards trade places with a quick fade, moving
      // while invisible (see "Flash safety" above).
      const swapAt = mark('verse-2-1', 'first') - 0.1;
      [[artist.node, 460], [album.node, -460]].forEach(([node, dx]) => {
        fx.fadeOut(node, swapAt, 0.15);
        fx.moveTo(node, swapAt + 0.16, dx, 0, 0.01);
        fx.fadeIn(node, swapAt + 0.18, 0.2);
      });
      kit.sticker(a, 'either order works', { x: 360, y: 372, at: mark('verse-2-1', 'first') + 0.4, until: mark('verse-2-2', 'same'), variant: 'green', iconName: 'loop', rotate: -3 });
      shared.forEach((_, i) => {
        artist.highlight(i, mark('verse-2-2', 'same') + i * 0.08, { tone: 'red' });
        album.highlight(i, mark('verse-2-2', 'same') + i * 0.08, { tone: 'red' });
      });
      kit.stamp(a, 'Overlap', { x: 120, y: 366, at: mark('verse-2-2', 'overlaps'), color: 'red', rotate: -6, small: true, shake: false });
      note(a, 'worse than waiting', { x: 300, y: 378, at: mark('verse-2-2', 'worse'), variant: 'red' });

      // Split by layers, neither works alone; slice the cake instead.
      const linkLine = line('verse-2-6').start;
      const b = kit.scene(content, cakeLine - 0.1, linkLine - 0.1);
      const cake = us.cake(b, { x: 40, y: 200, w: 250, at: cakeLine, layers: ['screen', 'logic', 'data'] });
      cake.split(mark('verse-2-3', 'layers'));
      const cutAt = mark('verse-2-5', 'cake');
      us.card(b, {
        x: 320, y: 78, w: 300, size: 'small', title: 'Story 1', at: mark('verse-2-3', 'screen'), until: cutAt, tilt: -1,
        role: 'new player', want: 'a sign-up screen',
        gwt: ['Given I’m on sign-up', 'When I type my details', 'Then I see them typed'],
      });
      us.card(b, {
        x: 636, y: 98, w: 300, size: 'small', title: 'Story 2', at: mark('verse-2-3', 'data'), until: cutAt, tilt: 1,
        role: 'new player', want: 'my sign-up saved',
        gwt: ['Given the form is filled', 'When I press Save', 'Then the data is stored'],
      });
      // Under each card, so both stay readable.
      kit.stamp(b, 'Stuck', { x: 410, y: 290, at: mark('verse-2-4', 'alone'), until: cutAt, color: 'red', rotate: -8, small: true, shake: false });
      kit.stamp(b, 'Stuck', { x: 726, y: 310, at: mark('verse-2-4', 'wait'), until: cutAt, color: 'red', rotate: 6, small: true, shake: false });
      note(b, 'neither works alone', { x: 470, y: 376, at: mark('verse-2-4', 'alone'), until: cutAt, variant: 'red' });
      cake.slice(cutAt, { dx: 60 });
      note(b, 'one slice = every layer', { x: 60, y: 396, at: mark('verse-2-5', 'layer') });

      // The slice is story #4, and story #5's Given depends on it: write it down.
      const nStart = line('verse-2-7').start;
      const c = kit.scene(content, mark('verse-2-5', 'one') - 0.1, nStart - 0.1);
      const signUp = us.card(c, {
        x: 450, y: 80, w: 480, size: 'small', title: 'Story #4: one slice, every layer', at: mark('verse-2-5', 'one'), tilt: -1,
        role: 'new player', want: 'to sign up', why: 'my profile is there next time',
        gwt: ['Given I’m on the sign-up page', 'When I fill in the form and press Save', 'Then my profile is there when I log back in'],
      });
      fx.moveTo(signUp.node, linkLine - 0.2, -440, 0, 0.5);
      const invite = us.card(c, {
        x: 500, y: 96, w: 440, size: 'small', title: 'Story #5', at: linkLine + 0.2, tilt: 1,
        role: 'player', want: 'to invite a friend', why: 'we can play together',
        gwt: ['Given I’m signed up', 'When I send an invite link', 'Then my friend joins my lobby'],
      });
      invite.highlight(0, mark('verse-2-6', 'link'));
      us.miniCard(c, { x: 736, y: 330, text: 'depends on #4', at: mark('verse-2-6', 'down'), tone: 'gold', tilt: 5, iconName: 'pencil' });
      kit.sticker(c, 'no surprise later', { x: 480, y: 376, at: mark('verse-2-6', 'surprise'), variant: 'green', iconName: 'check', rotate: -3 });

      // Negotiable: a promise to talk, not a contract.
      const fireLine = line('verse-2-9').start;
      const d = kit.scene(content, nStart - 0.1, fireLine - 0.1);
      us.speech(d, { x: 110, y: 120, text: 'Here’s what I need…', at: mark('verse-2-7', 'promise') });
      us.speech(d, { x: 470, y: 210, text: 'Let’s work out how.', from: 'team', tail: 'right', at: mark('verse-2-7', 'talk') });
      kit.sticker(d, 'not a contract', { x: 170, y: 350, at: mark('verse-2-8', 'contract'), variant: 'red', iconName: 'cross', rotate: -4 });
      kit.sticker(d, 'not a locked blueprint', { x: 480, y: 350, at: mark('verse-2-8', 'blueprint'), variant: 'red', iconName: 'lock', rotate: 4 });

      // "Saved in Firebase" is a how; the need is in the "so that".
      const vStart = line('verse-2-13').start;
      const e = kit.scene(content, fireLine - 0.1, vStart - 0.1);
      const scores = us.card(e, {
        x: 40, y: 80, w: 580, at: fireLine, tilt: -1,
        role: 'gamer', want: 'my high scores saved in Firebase', why: 'they’re still there next time I play',
        gwt: ['Given I set a high score', 'When I reopen the game', 'Then my score is still on the board'],
      });
      const fixAt = mark('verse-2-10', 'play');
      scores.highlight('want', mark('verse-2-9', 'firebase'), { tone: 'red', until: fixAt });
      const how = scores.stamp('HOW?', { at: mark('verse-2-10', 'how'), rotate: -12, dx: 160, dy: -24 });
      fx.fadeOut(how, fixAt - 0.1, 0.2);
      scores.highlight('why', mark('verse-2-10', 'need'), { tone: 'green' });
      note(e, 'the need', { x: 650, y: 150, at: mark('verse-2-10', 'need'), variant: 'green' });
      scores.rewrite('want', 'my high scores kept', fixAt);
      const toolsGone = line('verse-2-12').start;
      [['Firebase', 'database'], ['SQL', 'database'], ['local save', 'file']].forEach(([tool, iconName], i) => us.miniCard(e, {
        x: 660 + (i % 2) * 120, y: 212 + i * 50, text: tool, tone: 'ghost', iconName, at: mark('verse-2-11', 'tools') + i * 0.12, until: toolsGone, tilt: (i - 1) * 4,
      }));
      note(e, 'the team picks the how', { x: 640, y: 380, at: mark('verse-2-11', 'team'), until: toolsGone, variant: 'cyan' });
      us.miniCard(e, { x: 650, y: 230, text: 'Constraints: must-use tools', tone: 'ghost', iconName: 'lock', at: mark('verse-2-12', 'mustuse'), tilt: 3 });
      kit.sticker(e, 'written down separately', { x: 660, y: 300, at: mark('verse-2-12', 'elsewhere'), variant: 'white', iconName: 'pencil', rotate: -4 });

      // Valuable: if only devs would notice it's gone, find the users' gain.
      const trackLine = line('verse-2-15').start;
      const f = kit.scene(content, vStart - 0.1, trackLine - 0.1);
      const cleanup = us.card(f, {
        x: 40, y: 92, w: 520, size: 'small', at: vStart, tilt: -1,
        role: 'developer', want: 'to clean up the cart code', why: 'it’s easier for me to change',
        gwt: ['Given the cart code is cleaned up', 'When I run the tests', 'Then they all still pass'],
      });
      const snip = kit.place(kit.el('div', 'us-scissors is-staged', f), 590, 104);
      snip.append(kit.icon('scissors'));
      tween(snip, [{ opacity: 0, translate: '0 40px' }, { opacity: 1, translate: '0 0' }], mark('verse-2-13', 'cut'), 0.4, EASE.out);
      note(f, 'Who’d complain?', { x: 672, y: 116, at: mark('verse-2-13', 'complain'), variant: 'white' });
      cleanup.highlight('role', mark('verse-2-14', 'devs'), { tone: 'red' });
      kit.sticker(f, 'only devs would notice', { x: 600, y: 210, at: mark('verse-2-14', 'devs'), variant: 'red', iconName: 'cross', rotate: -3 });
      kit.sticker(f, 'find the users’ gain', { x: 620, y: 290, at: mark('verse-2-14', 'find'), variant: 'gold', iconName: 'user', rotate: 3 });

      // Criteria that stop at "the page loads" miss the value.
      const g = kit.scene(content, trackLine - 0.1, end('verse-2'));
      const order = us.card(g, {
        x: 40, y: 86, w: 540, size: 'small', at: trackLine, tilt: -1,
        role: 'hungry student', want: 'to track my order', why: 'I know when to head downstairs',
        gwt: ['Given I placed an order', 'When I open it', 'Then the order page loads'],
      });
      const goalAt = mark('verse-2-17', 'goal');
      order.highlight(2, mark('verse-2-15', 'check'), { tone: 'red', until: goalAt });
      const phone = us.phone(g, { x: 680, y: 66, at: mark('verse-2-15', 'order'), title: 'Order #482' });
      kit.el('div', 'us-phone-empty', phone.screen, 'Order placed.');
      note(g, 'When’s my food here?', { x: 120, y: 350, at: mark('verse-2-16', 'whens'), until: mark('verse-2-17', 'criteria'), variant: 'red' });
      note(g, 'criteria = the scope', { x: 120, y: 350, at: mark('verse-2-17', 'scope'), until: mark('verse-2-18', 'now'), variant: 'cyan' });
      order.rewrite(2, 'I see the minutes till it arrives', goalAt);
      order.highlight(2, goalAt + 0.2, { tone: 'green' });
      order.check(2, mark('verse-2-18', 'whole'));
      us.deliveryMap(phone.screen, { at: mark('verse-2-18', 'then'), rideFrom: mark('verse-2-18', 'then'), rideTo: end('verse-2') });
      us.notification(phone.screen, { title: 'Arriving in 12 min', text: 'Your courier is on the way', at: mark('verse-2-18', 'minutes'), iconName: 'truck' });
      kit.stamp(g, 'Valuable', { x: 190, y: 334, at: mark('verse-2-18', 'storys'), color: 'green', rotate: -8, shake: false });
    }

    // ----------------------------------------------------------------
    // Verse 3: Estimable, Small, Testable
    // ----------------------------------------------------------------

    function verse3() {
      badge('Verse 3 · Estimable · Small · Testable', 'verse-3');
      verseScanner('verse-3', [
        { index: 3, from: mark('verse-3-1', 'estimable'), to: line('verse-3-7').start },
        { index: 4, from: line('verse-3-7').start, to: line('verse-3-13').start },
        { index: 5, from: mark('verse-3-13', 'testable'), to: end('verse-3') - 0.3 },
      ]);
      const start = song.sectionStart('verse-3');
      const curveLine = line('verse-3-3').start;
      const spikeLine = line('verse-3-5').start;
      const sStart = line('verse-3-7').start;

      // Estimable: the dial settles once domain, tech, and scope are clear.
      const a = kit.scene(content, start, sStart - 0.1);
      us.dial(a, {
        x: 630, y: 80, at: mark('verse-3-1', 'e'),
        phases: [
          { at: mark('verse-3-1', 'e'), fog: true },
          { at: mark('verse-3-1', 'size'), fog: false, value: 3 },
          { at: mark('verse-3-3', 'curve'), fog: true },
          { at: mark('verse-3-4', 'tell'), fog: false, value: 2 },
          { at: mark('verse-3-5', 'tech'), fog: true },
          { at: mark('verse-3-6', 'learn'), fog: false, value: 5 },
        ],
      });
      us.card(a, { x: 40, y: 92, w: 560, size: 'small', at: mark('verse-3-1', 'e'), until: curveLine - 0.1, tilt: -1, ...LAUNDRY });
      note(a, 'rough but fair', { x: 690, y: 336, at: mark('verse-3-1', 'fair'), until: line('verse-3-2').start, variant: 'cyan' });
      ['domain', 'tech', 'scope'].forEach((word, i) => kit.sticker(a, word, {
        x: 634 + i * 102, y: 336, at: mark('verse-3-2', word), until: curveLine - 0.1, variant: 'green', iconName: 'check', rotate: (i - 1) * 3,
      }));

      // Which curve? Ask the professor, and the estimate settles.
      const curve = us.card(a, {
        x: 40, y: 92, w: 560, size: 'small', at: curveLine, until: spikeLine - 0.1, tilt: -1,
        role: 'professor', want: 'to curve the exam grades', why: 'one hard exam doesn’t sink the class',
        gwt: ['Given the exam is graded', 'When I apply the curve', 'Then each grade is curved'],
      });
      const tellAt = mark('verse-3-4', 'tell');
      curve.highlight(2, mark('verse-3-3', 'which'), { tone: 'red', until: tellAt });
      const askAt = mark('verse-3-4', 'ask');
      note(a, 'add points?', { x: 640, y: 336, at: mark('verse-3-3', 'points'), until: askAt, variant: 'red' });
      note(a, 'bell curve?', { x: 790, y: 336, at: mark('verse-3-3', 'bell'), until: askAt, variant: 'red' });
      us.speech(a, { x: 40, y: 340, text: 'Which curve?', from: 'team', at: askAt, until: spikeLine - 0.2 });
      us.speech(a, { x: 300, y: 340, text: 'Add 5 points to everyone.', at: mark('verse-3-4', 'prof'), until: spikeLine - 0.2 });
      curve.rewrite(2, 'every score rises 5 points (max 100)', tellAt);

      // New tech: a time-boxed spike, then the real story can be sized.
      us.card(a, {
        x: 40, y: 92, w: 560, size: 'small', at: spikeLine, tilt: -1,
        role: 'singer', want: 'the app to show the note I’m singing', why: 'I can practice staying in tune',
        gwt: ['Given I sing an A', 'When the app listens', 'Then it shows “A” within a second'],
      });
      const learnAt = mark('verse-3-6', 'learn');
      note(a, 'never built pitch detection', { x: 620, y: 336, at: mark('verse-3-5', 'nobodys'), until: learnAt, variant: 'red' });
      kit.sticker(a, 'spike: 2 days max', { x: 90, y: 360, at: mark('verse-3-5', 'spike'), variant: 'cyan', iconName: 'timer', rotate: -4 });
      kit.sticker(a, 'now sized: 5 pts', { x: 670, y: 340, at: mark('verse-3-6', 'right'), variant: 'green', iconName: 'check', rotate: 3 });

      // Small: one sprint, the smallest slice that still gives users a win.
      const coatLine = line('verse-3-9').start;
      const b = kit.scene(content, sStart - 0.1, coatLine - 0.1);
      us.sprintBox(b, { x: 220, y: 92, w: 520, h: 262, at: sStart, label: 'One sprint' });
      const post = us.card(b, {
        x: 260, y: 114, w: 440, size: 'small', at: mark('verse-3-7', 'fits'), tilt: -1,
        role: 'creator', want: 'to post a photo', why: 'my fans see it',
        gwt: ['Given I’m logged in', 'When I post a photo', 'Then my fans see it in their feed'],
      });
      tween(post.node, [{ translate: '0 -90px' }, { translate: '0 0' }], mark('verse-3-7', 'fits'), 0.45, EASE.out);
      kit.sticker(b, 'smallest slice, still valuable', { x: 300, y: 380, at: mark('verse-3-8', 'win'), variant: 'green', iconName: 'sparkle', rotate: -3 });

      // Three stories in a trench coat: the coat drops on "three stories",
      // and the scissors cut at the "and"s.
      const criteriaAt = mark('verse-3-13', 'criteria');
      const c = kit.scene(content, coatLine - 0.1, criteriaAt - 0.1);
      const dropAt = mark('verse-3-10', 'three') - 0.1;
      const storiesAt = dropAt + 0.8;
      const crumbsAt = mark('verse-3-11', 'crumbs');
      us.trenchCoat(c, {
        x: 370, y: 96, at: mark('verse-3-9', 'post'), splitAt: dropAt, until: storiesAt + 0.1,
        labels: ['post pics', 'edit my bio', 'DM my fans'], icons: ['image', 'pencil', 'chat'],
        row: { x: 100, y: 130, gap: 155 },
      });
      kit.sticker(c, 'one story?', { x: 620, y: 110, at: mark('verse-3-9', 'fans'), until: dropAt, variant: 'white', iconName: 'question', rotate: 5 });
      [
        { want: 'to post pics', gwt: ['Given I’m logged in', 'When I post a pic', 'Then fans see it'] },
        { want: 'to edit my bio', gwt: ['Given I’m logged in', 'When I save a new bio', 'Then fans see it'] },
        { want: 'to DM my fans', gwt: ['Given a fan follows me', 'When I send a DM', 'Then they get it'] },
      ].forEach(({ want, gwt }, i) => us.card(c, {
        x: 30 + i * 305, y: 96, w: 290, size: 'small', title: `Story ${i + 1}`, at: storiesAt + i * 0.1, until: crumbsAt, tilt: i - 1,
        role: 'creator', want, gwt,
      }));
      kit.sticker(c, 'split at the “and”s', { x: 300, y: 336, at: mark('verse-3-10', 'split'), until: crumbsAt, variant: 'pink', iconName: 'scissors', rotate: -4 });
      kit.sticker(c, '3 stories', { x: 560, y: 340, at: mark('verse-3-10', 'ands'), until: crumbsAt, variant: 'green', iconName: 'check', rotate: 3 });

      // But not crumbs: one line of the bio is a card that costs more than its code.
      const mergeAt = mark('verse-3-12', 'combine');
      us.card(c, {
        x: 40, y: 96, w: 480, size: 'small', at: mark('verse-3-11', 'edit'), until: mergeAt + 0.1, tilt: -2,
        role: 'creator', want: 'to edit just my bio’s first line',
        gwt: ['Given I’m on my profile', 'When I change line 1 of my bio', 'Then line 1 updates'],
      });
      ['edit bio line 2', 'edit bio line 3', 'edit bio line 4'].forEach((text, i) => {
        const x = 580 + (i % 2) * 150;
        const y = 104 + i * 58;
        const bit = us.miniCard(c, { x, y, text, at: crumbsAt + 0.2 + i * 0.1, tilt: (i - 1) * 5 });
        fx.moveTo(bit, mergeAt, 300 - x, 180 - y, 0.45);
        fx.fadeOut(bit, mergeAt + 0.3, 0.15);
      });
      kit.sticker(c, 'writing the card: 10 min', { x: 560, y: 300, at: mark('verse-3-12', 'card'), until: mergeAt, variant: 'white', iconName: 'pencil', rotate: -3 });
      kit.sticker(c, 'coding it: 2 min', { x: 590, y: 352, at: mark('verse-3-12', 'code'), until: mergeAt, variant: 'white', iconName: 'timer', rotate: 3 });
      us.card(c, {
        x: 250, y: 104, w: 480, size: 'small', title: 'Combined', at: mergeAt + 0.25, tilt: 1,
        role: 'creator', want: 'to edit my bio', why: 'my profile stays up to date',
        gwt: ['Given I’m on my profile', 'When I edit my bio and save', 'Then my new bio shows'],
      });

      // Testable: the criteria decide "done", written before the code.
      const vibeLine = line('verse-3-15').start;
      const e = kit.scene(content, criteriaAt - 0.1, vibeLine - 0.1);
      const done = kit.place(kit.el('div', 'us-question is-staged', e), 720, 76);
      kit.el('b', null, done, '?');
      kit.el('span', null, done, 'done?');
      fx.pop(done, criteriaAt);
      fx.bump(done, mark('verse-3-13', 'done'), 0.2);
      us.card(e, {
        x: 40, y: 76, w: 620, at: criteriaAt, tilt: -1, ...LAUNDRY,
        gwtAt: [criteriaAt + 0.15, mark('verse-3-13', 'decide'), mark('verse-3-13', 'when')],
      });
      kit.sticker(e, 'pass', { x: 700, y: 236, at: mark('verse-3-14', 'pass'), variant: 'green', iconName: 'check', rotate: -4 });
      kit.sticker(e, 'fail', { x: 812, y: 236, at: mark('verse-3-14', 'fail'), variant: 'red', iconName: 'cross', rotate: 4 });
      kit.sticker(e, 'criteria → then code', { x: 690, y: 300, at: mark('verse-3-14', 'before'), variant: 'gold', rotate: 3 });
      const editor = kit.place(kit.el('div', 'us-code is-staged', e), 690, 370);
      kit.el('span', 'us-code-label', editor, 'code:');
      kit.el('span', null, editor, 'not started');
      fx.rise(editor, mark('verse-3-14', 'begun'));

      // Vague words can't be tested; a number and a state can.
      const gwtLine = line('verse-3-17').start;
      const f = kit.scene(content, vibeLine - 0.1, gwtLine - 0.1);
      const vague = us.card(f, {
        x: 40, y: 92, w: 540, size: 'small', at: vibeLine, tilt: -1, ...LAUNDRY,
        gwt: ['Given my wash is running', 'When the cycle ends', 'Then the ping feels fast'],
      });
      const numberAt = mark('verse-3-16', 'number');
      vague.highlight(2, mark('verse-3-15', 'fast'), { tone: 'red', until: numberAt });
      [['fast?', 'fast'], ['smooth?', 'smooth'], ['easy?', 'easy']].forEach(([text, word], i) =>
        kit.sticker(f, text, { x: 610 + i * 110, y: 110, at: mark('verse-3-15', word), until: numberAt, variant: 'white', iconName: 'cloud', rotate: (i - 1) * 4 }));
      kit.stamp(f, 'Can’t test a vibe', { x: 600, y: 190, at: mark('verse-3-15', 'vibe'), until: numberAt, color: 'red', rotate: -6, small: true, shake: false });
      vague.rewrite(2, 'my phone pings within a minute', numberAt);
      kit.sticker(f, 'a number: ≤ 1 min', { x: 630, y: 260, at: numberAt, variant: 'green', iconName: 'timer', rotate: -3 });
      kit.sticker(f, 'a state: “Washer 3 done”', { x: 630, y: 330, at: mark('verse-3-16', 'state'), variant: 'green', iconName: 'check', rotate: 3 });

      const g = kit.scene(content, gwtLine - 0.1, end('verse-3'));
      us.gwt(g, {
        x: 40, y: 130, w: 880, at: gwtLine, passAt: mark('verse-3-20', 'pass'),
        steps: [
          { key: 'Given', text: 'my wash is running', at: mark('verse-3-17', 'given') },
          { key: 'When', text: 'the cycle ends', at: mark('verse-3-18', 'when') },
          { key: 'Then', text: 'my phone pings within a minute', at: mark('verse-3-19', 'then') },
        ],
      });
      kit.sticker(g, 'Washer 3 is done', { x: 520, y: 290, at: mark('verse-3-19', 'pings'), variant: 'white', iconName: 'bolt', rotate: -3 });
      kit.kinetic(g, [
        { text: 'now we know', at: mark('verse-3-20', 'now') },
        { text: 'it’s done', at: mark('verse-3-20', 'done'), color: 'green' },
      ], { y: 364, size: 44 });
    }

    // ----------------------------------------------------------------
    // Pop quiz: which letter breaks — or does it pass?
    // ----------------------------------------------------------------

    function quiz() {
      badge('Pop quiz', 'quiz-intro');
      const from = song.sectionStart('quiz-intro');
      const to = end('quiz');
      const s = kit.scene(content, from, to);
      const scan = us.scanner(s, { x: 148, y: 356, compact: true, none: true, at: from + 0.2 });
      const firstQuestion = line('quiz-1').start;
      kit.kinetic(s, [
        { text: 'Pop quiz!', at: mark('quiz-intro-1', 'pop'), color: 'gold' },
      ], { y: 90, size: 72, until: firstQuestion - 0.25 });
      note(s, 'criteria = what each card says', { x: 318, y: 196, at: mark('quiz-intro-1', 'criteria'), until: firstQuestion - 0.2, variant: 'cyan' });
      note(s, 'Which letter breaks — or does it pass?', { x: 270, y: 256, at: mark('quiz-intro-2', 'which'), until: firstQuestion - 0.2, variant: 'white' });

      const { lines } = song.storyboard.sections.find((section) => section.id === 'quiz');
      lines.forEach((entry, i) => {
        const next = i + 1 < lines.length ? lines[i + 1].start - 0.15 : to;
        const { lamp, reason, aside, asideWord, story } = QUIZ[i];
        us.card(s, {
          x: 130, y: 56, w: 700, size: 'small', at: entry.start, until: next - 0.1, tilt: i % 2 ? 1 : -1,
          title: `Quiz ${i + 1} / ${lines.length}`, ...story,
        });
        if (aside) note(s, aside, { x: 560, y: 30, at: mark(entry.id, asideWord), until: next - 0.1 });
        if (lamp === NONE_LAMP) {
          scan.light(lamp, entry.answer_at, 'pass');
          for (let k = 0; k < NONE_LAMP; k++) scan.light(k, entry.answer_at + 0.05 * k, 'pass');
          // Between the card and the scanner, clear of the card's criteria.
          kit.stamp(s, 'Good to go', { x: 560, y: 284, at: entry.answer_at, until: to - 0.3, color: 'green', rotate: -8, shake: false });
        } else {
          scan.light(lamp, entry.answer_at, 'fail');
          kit.sticker(s, reason, { x: 560, y: 292, at: entry.answer_at + 0.15, until: next - 0.1, variant: 'red', iconName: 'cross', rotate: -4 });
        }
        for (let k = 0; k <= NONE_LAMP; k++) scan.light(k, next, 'off');
      });
    }

    // After the quiz: INVEST depends on context.
    function quizClose() {
      badge('A lens, not a checklist', 'quiz-close');
      const from = song.sectionStart('quiz-close');
      const lensLine = line('quiz-close-2').start;
      const a = kit.scene(content, from, lensLine - 0.1);
      us.card(a, { x: 30, y: 84, w: 440, size: 'small', at: from + 0.1, tilt: -1, title: 'Quiz 4', ...QUIZ[3].story });
      const booking = us.card(a, {
        x: 490, y: 84, w: 440, size: 'small', at: mark('quiz-close-1', 'build'), tilt: 1, title: 'Book a ride',
        role: 'rider', want: 'to book a ride',
        gwt: ['Given I’m logged in', 'When I request a ride', 'Then a driver accepts it'],
      });
      // Beside the short "As a" and "I want" lines, clear of the criteria.
      booking.stamp('DONE', { at: mark('quiz-close-1', 'first'), color: 'green', rotate: -8, dx: 110, dy: -44 });
      const scan = us.scanner(a, { x: 337, y: 340, tiny: true, at: from + 0.1 });
      scan.light(0, from + 0.1, 'fail');
      scan.light(0, mark('quiz-close-1', 'independent'), 'pass');
      kit.sticker(a, 'now independent', { x: 650, y: 334, at: mark('quiz-close-1', 'independent'), variant: 'green', iconName: 'check', rotate: 4 });

      const b = kit.scene(content, lensLine - 0.1, end('quiz-close'));
      kit.kinetic(b, [
        { text: 'a lens,', at: mark('quiz-close-2', 'lens'), color: 'gold', iconName: 'search' },
        { text: 'not a checklist', at: mark('quiz-close-2', 'checklist') },
      ], { y: 170, size: 56 });
      note(b, 'the context changes what’s true', { x: 300, y: 300, at: mark('quiz-close-2', 'context'), variant: 'cyan' });
    }

    // ----------------------------------------------------------------
    // Outro: other specs for system-wide qualities; the right thing
    // ----------------------------------------------------------------

    function outro() {
      badge('Outro', 'outro');
      const from = song.sectionStart('outro');
      const lastLine = line('outro-2').start;
      const a = kit.scene(content, from, lastLine - 0.1);
      us.card(a, { x: 40, y: 96, w: 430, size: 'small', at: from + 0.1, ...LAUNDRY });
      const folder = kit.place(kit.el('div', 'us-folder is-staged', a), 730, 150);
      folder.append(kit.icon('folder'));
      kit.el('span', null, folder, 'other specs');
      fx.pop(folder, mark('outro-1', 'uptime'));
      [['uptime', 'uptime', 'timer'], ['scale', 'scale', 'chart'], ['safety', 'safety rules', 'shield']].forEach(([word, text, iconName], i) => {
        const chip = us.miniCard(a, { x: 500, y: 120 + i * 70, text, at: mark('outro-1', word), tone: 'ghost', iconName });
        // Filed away on "need": each chip shrinks into the folder in turn and is
        // gone before the scene ends, instead of piling up over it.
        const file = mark('outro-1', 'need') + i * 0.12;
        fx.moveTo(chip, file, 250, 60 - i * 70, 0.45);
        tween(chip, { scale: 0.3 }, file, 0.45, EASE.in);
        fx.fadeOut(chip, file + 0.35, 0.15);
      });
      note(a, 'need other kinds of specs', { x: 540, y: 380, at: mark('outro-1', 'other'), variant: 'violet' });

      const b = kit.scene(content, lastLine - 0.1, song.duration);
      student?.appear({ from: lastLine + 0.2, to: song.duration, x: 60, y: 150, scale: 0.86 });
      const story = us.card(b, { x: 440, y: 92, w: 480, size: 'small', at: mark('outro-2', 'features'), ...LAUNDRY });
      // An approval stamp beside the short "As a" line, hanging past the card's
      // right edge, so the finished story stays readable to the end.
      story.stamp('INVEST', { at: mark('outro-2', 'invest'), color: 'gold', rotate: -8, dx: 205, dy: -60 });
      kit.kinetic(b, [
        { text: 'the right', at: mark('outro-2', 'right') },
        { text: 'thing', at: mark('outro-2', 'thing'), color: 'gold' },
      ], { y: 370, size: 52 });
    }

    intro();
    verse1();
    preChorus();
    chorus('chorus-1', 'Chorus · INVEST');
    verse2();
    shortChorus('chorus-2', 'Chorus · INVEST');
    verse3();
    chorus('final-chorus', 'Final chorus');
    quiz();
    quizClose();
    outro();
  };
})();
