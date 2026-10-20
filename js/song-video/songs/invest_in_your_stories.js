/*
 * Choreography for "Invest in Your Stories", the user stories and INVEST
 * song (storyboard: _data/songs/invest_in_your_stories.yml).
 *
 * Every visual hits a sung word: `mark(lineId, word)` is that word's time in
 * the recording. The teaching rule for the visuals: show exactly what the
 * line says, one idea per scene, so each picture can be read in the seconds
 * the line lasts. A user story is always an index card (As a / I want /
 * so that, plus acceptance criteria), and INVEST is always the same scanner
 * of six lamps (see js/song-video/story-kit.js). In the verses a tiny
 * scanner in the top-right corner shows which letter is being taught; in
 * the chorus the full scanner lights each letter as it is sung, and in the
 * quiz the broken letter lights red. Each line's `visual` text in the
 * storyboard describes this file.
 *
 * Layout: 960×540 stage; the section badge sits top-left, the tiny verse
 * scanner top-right (x ≥ 630, y ≤ 62), and nothing essential goes below
 * y = 460, where the player draws captions.
 */
(function () {
  'use strict';

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
      const cardAt = line('intro-4').start;
      const a = kit.scene(content, 0, cardAt - 0.1, { exit: 'fade' });
      student?.appear({ from: 0.9, to: cardAt - 0.2, x: 30, y: 150, scale: 0.9 });
      kit.kinetic(a, [
        { text: 'Demo', at: mark('intro-1', 'demo'), color: 'gold' },
        { text: 'day', at: mark('intro-1', 'day') },
      ], { y: 46, size: 60, until: line('intro-3').start - 0.1 });
      us.testBar(a, { x: 330, y: 150, w: 420, at: mark('intro-2', 'your'), fillUntil: mark('intro-2', 'green') });
      kit.sticker(a, 'Works perfectly', { x: 610, y: 108, at: mark('intro-2', 'perfectly'), variant: 'green', iconName: 'check', rotate: 4 });
      us.speech(a, { x: 320, y: 270, w: 560, text: 'Cool… but that’s not what I needed.', at: mark('intro-3', 'cool') });
      kit.stamp(a, 'Wrong thing', { x: 560, y: 368, at: mark('intro-3', 'needed'), color: 'red', rotate: -7 });

      // Before any code: what should we build?
      const b = kit.scene(content, cardAt - 0.1, end('intro'));
      us.card(b, {
        x: 300, y: 150, w: 360, at: mark('intro-4', 'write'), tilt: -2,
        role: '…', want: '…', why: '…',
      });
      note(b, 'What should we build?', { x: 332, y: 84, at: mark('intro-4', 'what') });
      kit.sticker(b, 'not a single line yet', { x: 640, y: 330, at: mark('intro-4', 'single'), variant: 'white', iconName: 'pencil', rotate: 5 });
    }

    // ----------------------------------------------------------------
    // Verse 1: why user stories, and what goes on the card
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

      // A user story: short, clear, in their own words.
      const roleLine = line('verse-1-5').start;
      const b = kit.scene(content, cardLine - 0.1, roleLine - 0.1);
      const story = us.card(b, {
        x: 300, y: 140, w: 360, at: mark('verse-1-3', 'user'), tilt: -2,
        role: '…', want: '…', why: '…',
      });
      kit.sticker(b, 'short & clear', { x: 640, y: 110, at: mark('verse-1-3', 'short'), variant: 'gold', iconName: 'sparkle', rotate: 5 });
      ['REST API', 'DB schema', 'microservice'].forEach((word, i) => {
        const chip = us.miniCard(story.node, { x: 30 + i * 112, y: 150, text: word, tone: 'ghost', at: mark('verse-1-4', 'need') + i * 0.12, tilt: (i - 1) * 6 });
        chip.style.fontSize = '13px';
        kit.fall(chip, mark('verse-1-4', 'jargon') + i * 0.1, { spin: 140 + i * 40, drift: (i - 1) * 40 });
      });
      note(b, 'in their own words', { x: 360, y: 340, at: mark('verse-1-4', 'words'), variant: 'green' });

      // Not "a user": which one?
      const boardLine = line('verse-1-7').start;
      const c = kit.scene(content, roleLine - 0.1, boardLine - 0.1);
      us.nameTag(c, { x: 380, y: 96, name: 'a user', at: mark('verse-1-5', 'user'), crossed: mark('verse-1-5', 'exactly') });
      us.nameTag(c, { x: 200, y: 250, name: 'student', at: mark('verse-1-6', 'student'), tilt: -5 });
      us.nameTag(c, { x: 560, y: 250, name: 'TA', at: mark('verse-1-6', 'ta'), tilt: 4 });
      note(c, 'Which one?', { x: 410, y: 410, at: mark('verse-1-6', 'which') });

      // A board of stories: add, change, drop, reorder.
      const criteriaLine = line('verse-1-9').start;
      const d = kit.scene(content, boardLine - 0.1, criteriaLine - 0.1);
      const cards = [
        us.miniCard(d, { x: 80, y: 190, text: '#12 Resubmit homework', at: boardLine, iconName: 'file' }),
        us.miniCard(d, { x: 340, y: 190, text: '#13 See my grade', at: boardLine + 0.1, iconName: 'chart' }),
        us.miniCard(d, { x: 580, y: 190, text: '#14 Dark mode', at: boardLine + 0.2, iconName: 'eye' }),
      ];
      const added = us.miniCard(d, { x: 340, y: 300, text: '#15 Deadline reminder', at: mark('verse-1-7', 'add'), iconName: 'calendar', tone: 'gold' });
      // Rests on the new card's top edge, clear of its icon.
      kit.sticker(d, 'add', { x: 296, y: 268, at: mark('verse-1-7', 'add'), until: mark('verse-1-8', 'order') - 0.2, variant: 'green', iconName: 'filePlus', rotate: -6 });
      fx.bump(cards[1], mark('verse-1-7', 'change'), 0.15);
      kit.sticker(d, 'changed', { x: 470, y: 160, at: mark('verse-1-7', 'change'), variant: 'cyan', iconName: 'pencil', rotate: 5 });
      kit.fall(cards[2], mark('verse-1-7', 'drop'), { spin: 90, drift: 30 });
      kit.sticker(d, 'dropped', { x: 640, y: 150, at: mark('verse-1-7', 'drop'), until: mark('verse-1-8', 'order'), variant: 'red', iconName: 'trash', rotate: -4 });
      // Any order: #15 jumps ahead of #12.
      fx.moveTo(added, mark('verse-1-8', 'order') - 0.2, -260, -110, 0.5);
      fx.moveTo(cards[0], mark('verse-1-8', 'order') - 0.2, 300, 110, 0.5);
      [[110, 120], [370, 120], [380, 270]].forEach(([x, y], i) => kit.sticker(d, 'value', {
        x, y, at: mark('verse-1-8', 'value') + i * 0.15, variant: 'gold', iconName: 'sparkle', rotate: i % 2 ? 5 : -5,
      }));

      // Acceptance criteria say when it's done; commits point back to the card.
      const e = kit.scene(content, criteriaLine - 0.1, end('verse-1'));
      const done = us.card(e, {
        x: 70, y: 100, w: 400, at: criteriaLine, tilt: -1, title: 'Story #12', size: 'small',
        role: 'student', want: 'to resubmit homework', why: 'I can fix a mistake',
        criteria: ['Update button shows before the deadline', 'New file replaces the old one'],
        criteriaAt: mark('verse-1-9', 'criteria'),
      });
      done.check(0, mark('verse-1-9', 'when'));
      done.check(1, mark('verse-1-9', 'done'));
      note(e, 'done = criteria pass', { x: 540, y: 150, at: mark('verse-1-9', 'done'), variant: 'green' });
      us.commit(e, {
        x: 470, y: 370, hash: 'a1f3c9', message: 'Add resubmit button', ref: '#12',
        at: mark('verse-1-10', 'commit'), refAt: mark('verse-1-10', 'story'),
      });
      kit.sticker(e, 'traceable', { x: 790, y: 320, at: mark('verse-1-10', 'from'), variant: 'cyan', iconName: 'link', rotate: 5 });
    }

    // ----------------------------------------------------------------
    // Pre-chorus: fill in the card, then check it with INVEST
    // ----------------------------------------------------------------

    function preChorus() {
      badge('As a · I want · so that', 'pre-chorus');
      const s = kit.scene(content, song.sectionStart('pre-chorus'), end('pre-chorus'));
      us.card(s, {
        x: 220, y: 60, w: 560, at: line('pre-chorus-1').start, size: 'big', tilt: -1,
        role: 'student', want: 'to resubmit before it’s due', why: 'I can fix a mistake or two',
        fill: {
          role: mark('pre-chorus-1', 'student'),
          want: mark('pre-chorus-2', 'resubmit'),
          why: mark('pre-chorus-3', 'i'),
        },
      });
      [['pre-chorus-1', 'who', 'who?', 104], ['pre-chorus-2', 'what', 'what?', 140], ['pre-chorus-3', 'why', 'why?', 176]].forEach(([id, word, text, y]) => {
        note(s, text, { x: 80, y, at: mark(id, word), until: end('pre-chorus') - 0.3 });
      });
      const scan = us.scanner(s, { x: 105, y: 300, at: mark('pre-chorus-4', 'good') });
      us.LETTERS.forEach((_, i) => scan.light(i, mark('pre-chorus-4', 'invest') + i * 0.06, 'on'));
      us.LETTERS.forEach((_, i) => scan.light(i, mark('pre-chorus-4', 'invest') + 0.6, 'off'));
    }

    // ----------------------------------------------------------------
    // Chorus: the scanner lights one letter per line
    // ----------------------------------------------------------------

    function chorus(id, title) {
      badge(title, id);
      const s = kit.scene(content, song.sectionStart(id), end(id));
      const scan = us.scanner(s, { x: 194, y: 50, compact: true, at: song.sectionStart(id) + 0.1 });
      const LETTER_WORD = ['i', 'n', 'v', 'e', 's', 't'];
      for (let i = 0; i < 6; i++) {
        const lineId = `${id}-${i + 1}`;
        const at = mark(lineId, LETTER_WORD[i]);
        const next = line(`${id}-${i + 2}`).start;
        scan.light(i, at, 'on');
        scan.light(i, next - 0.05, 'pass');
        const panel = us.letterPanel(s, { index: i, y: 200, at, until: next - 0.18 });
        camera.punch(at + 0.04, 0.025);
        chorusDetail(s, i, lineId, next);
        void panel;
      }
      // I! N! V! E! S! T! — every lamp flashes as its letter is sung.
      const spell = `${id}-7`;
      const letters = kit.kinetic(s, LETTER_WORD.map((word, i) => ({
        text: us.LETTERS[i].letter, at: mark(spell, word), color: i % 2 ? 'cyan' : 'gold',
      })), { y: 200, size: 104, until: line(`${id}-8`).start - 0.2 });
      letters.style.letterSpacing = '0.12em';
      LETTER_WORD.forEach((word, i) => fx.bump(scan.lamps[i], mark(spell, word), 0.3));
      const tag = `${id}-8`;
      kit.kinetic(s, [
        { text: 'Invest', at: mark(tag, 'invest'), color: 'gold' },
        { text: 'in your stories', at: mark(tag, 'stories') },
      ], { y: 196, size: 56 });
      kit.sticker(s, '+ interest', { x: 590, y: 300, at: mark(tag, 'interest'), variant: 'green', iconName: 'percent', rotate: -5 });
    }

    /** A small picture under each chorus letter that shows its meaning. */
    function chorusDetail(s, i, lineId, next) {
      const until = next - 0.2;
      const y = 370;
      if (i === 0) {
        const a = us.miniCard(s, { x: 330, y, text: 'Story A', at: mark(lineId, 'order'), until });
        const b = us.miniCard(s, { x: 530, y, text: 'Story B', at: mark(lineId, 'order') + 0.1, until });
        fx.moveTo(a, mark(lineId, 'later'), 200, 0, 0.45);
        fx.moveTo(b, mark(lineId, 'later'), -200, 0, 0.45);
      } else if (i === 1) {
        kit.sticker(s, 'what', { x: 340, y, at: mark(lineId, 'what'), until, variant: 'green', iconName: 'check', rotate: -3 });
        kit.sticker(s, 'how', { x: 540, y, at: mark(lineId, 'how'), until, variant: 'red', iconName: 'cross', rotate: 3 });
      } else if (i === 2) {
        kit.sticker(s, 'a user wins', { x: 400, y, at: mark(lineId, 'user'), until, variant: 'gold', iconName: 'user', rotate: -3 });
      } else if (i === 3) {
        kit.sticker(s, 'effort: 5 pts', { x: 400, y, at: mark(lineId, 'effort'), until, variant: 'cyan', iconName: 'timer', rotate: 3 });
      } else if (i === 4) {
        kit.sticker(s, 'thin slice, still valuable', { x: 340, y, at: mark(lineId, 'slice'), until, variant: 'pink', iconName: 'scissors', rotate: -3 });
      } else {
        ['given', 'when', 'then'].forEach((word, k) => kit.sticker(s, word[0].toUpperCase() + word.slice(1), {
          x: 290 + k * 140, y, at: mark(lineId, word), until, variant: ['cyan', 'gold', 'green'][k], iconName: 'check', rotate: (k - 1) * 3,
        }));
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

      // Independent: no waiting in line; any order works.
      const start = song.sectionStart('verse-2');
      const cakeLine = line('verse-2-3').start;
      const a = kit.scene(content, start, cakeLine - 0.1);
      const queue = ['Search by title', 'Search by author', 'Search by subject'].map((text, i) =>
        us.miniCard(a, { x: 110 + i * 260, y: 210, text, at: mark('verse-2-1', 'independent') + i * 0.15, iconName: 'search' }));
      note(a, 'no waiting in line', { x: 350, y: 120, at: mark('verse-2-1', 'waiting') });
      fx.moveTo(queue[2], mark('verse-2-2', 'first') - 0.1, -520, 0, 0.5);
      fx.moveTo(queue[0], mark('verse-2-2', 'last') - 0.1, 520, 0, 0.5);
      kit.sticker(a, 'any order', { x: 400, y: 320, at: mark('verse-2-2', 'fine'), variant: 'green', iconName: 'check', rotate: -4 });

      // Split by layers: stuck. Slice the cake: every layer.
      const linkLine = line('verse-2-6').start;
      const b = kit.scene(content, cakeLine - 0.1, linkLine - 0.1);
      const cake = us.cake(b, { x: 330, y: 200, w: 300, at: cakeLine, layers: ['form (UI)', 'logic', 'database'] });
      cake.split(mark('verse-2-3', 'layers'));
      kit.sticker(b, 'story 1: the form', { x: 650, y: 116, at: mark('verse-2-3', 'form'), until: mark('verse-2-5', 'cut'), variant: 'white', rotate: 4 });
      kit.sticker(b, 'story 2: the database', { x: 650, y: 290, at: mark('verse-2-3', 'database'), until: mark('verse-2-5', 'cut'), variant: 'white', rotate: -4 });
      kit.stamp(b, 'Stuck', { x: 90, y: 200, at: mark('verse-2-4', 'stuck'), color: 'red', rotate: -8 });
      note(b, 'neither works alone', { x: 60, y: 300, at: mark('verse-2-4', 'alone'), until: mark('verse-2-5', 'cut'), variant: 'red' });
      cake.slice(mark('verse-2-5', 'cake'), { dx: 190 });
      note(b, 'one slice = every layer', { x: 590, y: 400, at: mark('verse-2-5', 'layer'), variant: 'gold' });

      // A link you can't avoid: write it down.
      const c = kit.scene(content, linkLine - 0.1, line('verse-2-7').start - 0.1);
      us.miniCard(c, { x: 260, y: 200, text: '#5 Share a playlist', at: linkLine, iconName: 'link' });
      us.miniCard(c, { x: 560, y: 210, text: 'depends on #4', at: mark('verse-2-6', 'down'), tone: 'gold', tilt: 6, iconName: 'pencil' });
      kit.sticker(c, 'no surprise later', { x: 380, y: 320, at: mark('verse-2-6', 'surprise'), variant: 'green', iconName: 'check', rotate: -3 });

      // Negotiable: a promise to talk, not a contract.
      const nStart = line('verse-2-7').start;
      const httpsLine = line('verse-2-9').start;
      const d = kit.scene(content, nStart - 0.1, httpsLine - 0.1);
      us.speech(d, { x: 110, y: 120, text: 'Here’s what I need…', at: mark('verse-2-7', 'promise') });
      us.speech(d, { x: 470, y: 210, text: 'Let’s work out how.', from: 'team', tail: 'right', at: mark('verse-2-7', 'talk') });
      kit.sticker(d, 'not a contract', { x: 170, y: 350, at: mark('verse-2-8', 'contract'), variant: 'red', iconName: 'cross', rotate: -4 });
      kit.sticker(d, 'not a locked blueprint', { x: 480, y: 350, at: mark('verse-2-8', 'blueprint'), variant: 'red', iconName: 'lock', rotate: 4 });

      // "I want the site on HTTPS" is a how; the need is privacy.
      const vStart = line('verse-2-13').start;
      const e = kit.scene(content, httpsLine - 0.1, vStart - 0.1);
      const request = us.card(e, { x: 200, y: 100, w: 470, at: httpsLine, tilt: -1, title: 'User story', quote: 'I want the site on HTTPS' });
      const howStamp = request.stamp('HOW?', { at: mark('verse-2-10', 'how'), rotate: -12, dx: 175 });
      fx.fadeOut(howStamp, mark('verse-2-11', 'keep') - 0.2, 0.2);
      note(e, 'the team picks the how', { x: 460, y: 270, at: mark('verse-2-10', 'team'), until: mark('verse-2-11', 'keep'), variant: 'cyan' });
      request.rewrite('quote', '“Keep my data private”', mark('verse-2-11', 'keep'));
      note(e, 'the need', { x: 700, y: 120, at: mark('verse-2-11', 'need'), variant: 'green' });
      us.miniCard(e, { x: 560, y: 320, text: 'Constraints: must-have tech', at: mark('verse-2-12', 'must'), tone: 'ghost', iconName: 'lock', tilt: 3 });
      kit.sticker(e, 'separately', { x: 600, y: 400, at: mark('verse-2-12', 'separately'), variant: 'white', rotate: -4 });

      // Valuable: useful on its own, for users or customers.
      const enrollLine = line('verse-2-15').start;
      const f = kit.scene(content, vStart - 0.1, enrollLine - 0.1);
      kit.sticker(f, 'useful on its own', { x: 340, y: 110, at: mark('verse-2-13', 'useful'), variant: 'gold', iconName: 'sparkle', rotate: -3 });
      us.miniCard(f, { x: 220, y: 210, text: 'users', at: mark('verse-2-14', 'users'), iconName: 'user', tone: 'gold' });
      us.miniCard(f, { x: 420, y: 210, text: 'customers', at: mark('verse-2-14', 'customers'), iconName: 'cart', tone: 'gold' });
      const devs = us.miniCard(f, { x: 640, y: 210, text: 'devs only', at: mark('verse-2-14', 'devs'), iconName: 'gear', tone: 'ghost' });
      // Beside the chip, not on it, so "devs only" stays readable.
      kit.stamp(f, '✗', { x: 796, y: 196, at: mark('verse-2-14', 'alone'), color: 'red', rotate: 0 });
      tween(devs, { opacity: 0.4 }, mark('verse-2-14', 'alone') + 0.1, 0.3);

      // Criteria that stop at "a button shows" miss the value.
      const g = kit.scene(content, enrollLine - 0.1, end('verse-2'));
      const enroll = us.card(g, {
        x: 60, y: 90, w: 430, at: enrollLine, title: 'User story', size: 'small', tilt: -1,
        role: 'student', want: 'to take CS 35L', why: 'I can get my degree',
        criteria: ['An Enroll button shows'], criteriaAt: mark('verse-2-15', 'check'),
      });
      const phone = us.phone(g, { x: 620, y: 72, at: mark('verse-2-15', 'enroll'), title: 'CS 35L' });
      us.appButton(phone.screen, { text: 'Enroll', at: mark('verse-2-15', 'enroll'), pressAt: mark('verse-2-16', 'clicking'), iconName: 'pointer' });
      const nothing = kit.el('div', 'us-phone-empty is-staged', phone.screen, '…nothing happens');
      fx.fadeIn(nothing, mark('verse-2-16', 'nothing'), 0.25);
      fx.fadeOut(nothing, mark('verse-2-18', 'click'), 0.2);
      note(g, 'Where’d the value go?', { x: 140, y: 330, at: mark('verse-2-16', 'whered'), until: mark('verse-2-17', 'criteria'), variant: 'red' });
      enroll.rewriteCriterion(0, 'Click Enroll → I’m enrolled', mark('verse-2-17', 'criteria'));
      note(g, 'reach the real goal', { x: 140, y: 330, at: mark('verse-2-17', 'goal'), variant: 'green' });
      const press = us.appButton(phone.screen, { text: 'Enroll', pressAt: mark('verse-2-18', 'enroll'), iconName: 'pointer' });
      press.classList.add('us-button--overlay');
      us.notification(phone.screen, { title: 'Enrolled ✓', text: 'CS 35L · seat confirmed', at: mark('verse-2-18', 'youre'), iconName: 'check' });
      enroll.check(0, mark('verse-2-18', 'in'));
      enroll.stamp('VALUABLE', { at: mark('verse-2-18', 'storys'), color: 'green', rotate: -10, dy: 20 });
    }

    // ----------------------------------------------------------------
    // Verse 3: Estimable, Small, Testable
    // ----------------------------------------------------------------

    function verse3() {
      badge('Verse 3 · Estimable · Small · Testable', 'verse-3');
      verseScanner('verse-3', [
        { index: 3, from: mark('verse-3-1', 'estimable'), to: line('verse-3-7').start },
        { index: 4, from: mark('verse-3-7', 'fits'), to: line('verse-3-13').start },
        { index: 5, from: mark('verse-3-13', 'how'), to: end('verse-3') - 0.3 },
      ]);
      const start = song.sectionStart('verse-3');

      // Estimable: the dial settles when the scope is clear.
      const sStart = line('verse-3-7').start;
      const a = kit.scene(content, start, sStart - 0.1);
      const fogAt = mark('verse-3-3', 'read') + 0.2;
      us.dial(a, {
        x: 600, y: 90, at: mark('verse-3-1', 'e'),
        phases: [
          { at: mark('verse-3-1', 'e'), fog: true },
          { at: mark('verse-3-1', 'size'), fog: false, value: 3 },
          { at: fogAt, fog: true },
          { at: mark('verse-3-6', 'spike'), fog: false, value: 5 },
        ],
      });
      us.card(a, {
        x: 70, y: 100, w: 420, at: mark('verse-3-1', 'e'), until: line('verse-3-3').start - 0.1, size: 'small', title: 'Story #12',
        role: 'student', want: 'to resubmit homework', why: 'I can fix a mistake',
      });
      kit.sticker(a, 'scope: clear', { x: 640, y: 340, at: mark('verse-3-2', 'clear'), until: line('verse-3-3').start, variant: 'green', iconName: 'check', rotate: 4 });
      us.card(a, {
        x: 70, y: 100, w: 440, at: line('verse-3-3').start, tilt: -1, title: 'User story',
        quote: 'Read handwriting with high accuracy',
      });
      note(a, 'How high?', { x: 90, y: 270, at: mark('verse-3-4', 'high'), until: mark('verse-3-5', 'ask'), variant: 'red' });
      note(a, 'Which characters?', { x: 250, y: 300, at: mark('verse-3-4', 'characters'), until: mark('verse-3-5', 'ask'), variant: 'red' });
      kit.sticker(a, 'mystery', { x: 300, y: 360, at: mark('verse-3-4', 'mystery'), until: mark('verse-3-5', 'ask'), variant: 'white', iconName: 'question', rotate: -5 });
      us.speech(a, { x: 70, y: 280, w: 470, text: 'Which characters? How accurate?', from: 'team', at: mark('verse-3-5', 'customer') });
      kit.sticker(a, 'time-boxed spike: 2 days', { x: 580, y: 390, at: mark('verse-3-6', 'spike'), variant: 'cyan', iconName: 'timer', rotate: -4 });

      // Small: fits a sprint; one more split would break the other five.
      const coatLine = line('verse-3-9').start;
      const b = kit.scene(content, sStart - 0.1, coatLine - 0.1);
      us.sprintBox(b, { x: 270, y: 110, w: 420, h: 170, at: sStart, label: 'One sprint' });
      const story = us.miniCard(b, { x: 330, y: 175, text: '#12 Resubmit before the deadline', at: mark('verse-3-7', 'fits'), iconName: 'file' });
      tween(story, [{ translate: '0 -90px' }, { translate: '0 0' }], mark('verse-3-7', 'fits'), 0.45, EASE.out);
      const snip = kit.place(kit.el('div', 'us-scissors is-staged', b), 470, 300);
      snip.append(kit.icon('scissors'));
      tween(snip, [{ opacity: 0, translate: '0 60px' }, { opacity: 1, translate: '0 0' }], mark('verse-3-8', 'split'), 0.4, EASE.out);
      tween(snip, { opacity: 0.35 }, mark('verse-3-8', 'break'), 0.3);
      note(b, 'each half would break I · N · V · E · T', { x: 220, y: 380, at: mark('verse-3-8', 'five'), variant: 'red' });
      kit.sticker(b, 'small enough', { x: 700, y: 120, at: mark('verse-3-8', 'thats'), variant: 'green', iconName: 'check', rotate: 5 });

      // Four stories in a trench coat; crumbs that merge.
      const crumbLine = line('verse-3-11').start;
      const c = kit.scene(content, coatLine - 0.1, crumbLine + 0.15);
      us.trenchCoat(c, {
        x: 380, y: 96, at: mark('verse-3-9', 'want'), splitAt: mark('verse-3-10', 'give') - 0.25,
        labels: ['Piazza', 'Gradescope', 'Drive', 'Zoom'], icons: ['chat', 'check', 'folder', 'video'],
      });
      kit.sticker(c, 'one story?', { x: 620, y: 110, at: mark('verse-3-9', 'zoom'), until: mark('verse-3-10', 'give'), variant: 'white', iconName: 'question', rotate: 5 });
      kit.sticker(c, '4 stories', { x: 400, y: 70, at: mark('verse-3-10', 'room'), variant: 'green', iconName: 'check', rotate: -4 });

      const tStart = line('verse-3-13').start;
      const d = kit.scene(content, crumbLine + 0.15, tStart - 0.1);
      us.crumbs(d, {
        x: 300, y: 200, at: mark('verse-3-11', 'crumbs'), mergeAt: mark('verse-3-12', 'merge'),
        texts: ['edit date', 'edit title', 'edit place', 'edit hours', 'edit role'], merged: 'Edit a service entry',
      });
      note(d, 'too tiny to track', { x: 340, y: 110, at: mark('verse-3-12', 'tiny'), until: mark('verse-3-12', 'merge'), variant: 'red' });
      kit.sticker(d, 'merged', { x: 600, y: 340, at: mark('verse-3-12', 'mates'), variant: 'green', iconName: 'merge', rotate: 4 });

      // Testable: criteria first, numbers not vibes, then Given / When / Then.
      const vibeLine = line('verse-3-15').start;
      const e = kit.scene(content, tStart - 0.1, vibeLine - 0.1);
      const done = kit.place(kit.el('div', 'us-question is-staged', e), 420, 90);
      kit.el('b', null, done, '?');
      kit.el('span', null, done, 'done?');
      fx.pop(done, mark('verse-3-13', 'how'));
      fx.bump(done, mark('verse-3-13', 'done'), 0.2);
      us.card(e, {
        x: 110, y: 230, w: 420, at: mark('verse-3-14', 'criteria'), title: 'Acceptance criteria', size: 'small',
        role: 'student', want: 'to resubmit homework', why: 'I can fix a mistake',
        criteria: ['Update button shows before the deadline'],
      });
      const editor = kit.place(kit.el('div', 'us-commit is-staged', e), 600, 300);
      kit.el('span', 'us-commit-hash', editor, 'code:');
      kit.el('span', 'us-commit-msg', editor, 'not started yet');
      fx.rise(editor, mark('verse-3-14', 'begun'));
      kit.sticker(e, 'criteria → then code', { x: 600, y: 230, at: mark('verse-3-14', 'before'), variant: 'gold', rotate: 4 });

      const gwtLine = line('verse-3-17').start;
      const f = kit.scene(content, vibeLine - 0.1, gwtLine - 0.1);
      [['fast?', 'fast', 140], ['pretty?', 'pretty', 380], ['easy?', 'easy', 620]].forEach(([text, word, x]) =>
        kit.sticker(f, text, { x, y: 130, at: mark('verse-3-15', word), variant: 'white', iconName: 'cloud', rotate: (x % 3) - 1 }));
      kit.stamp(f, 'Can’t test a vibe', { x: 270, y: 210, at: mark('verse-3-15', 'vibe'), color: 'red', rotate: -6 });
      kit.sticker(f, '≤ 2 seconds', { x: 220, y: 340, at: mark('verse-3-16', 'number'), variant: 'green', iconName: 'timer', rotate: -3 });
      kit.sticker(f, 'shows the new file', { x: 470, y: 340, at: mark('verse-3-16', 'state'), variant: 'green', iconName: 'file', rotate: 3 });

      const g = kit.scene(content, gwtLine - 0.1, end('verse-3'));
      us.gwt(g, {
        x: 40, y: 130, w: 880, at: gwtLine, passAt: mark('verse-3-20', 'pass'),
        steps: [
          { key: 'Given', text: 'it’s before the deadline', at: mark('verse-3-17', 'given') },
          { key: 'When', text: 'I upload a new file', at: mark('verse-3-18', 'when') },
          { key: 'Then', text: 'my submission shows the new one', at: mark('verse-3-19', 'then') },
        ],
      });
      kit.kinetic(g, [
        { text: 'now we know', at: mark('verse-3-20', 'now') },
        { text: 'it’s done', at: mark('verse-3-20', 'done'), color: 'green' },
      ], { y: 360, size: 44 });
    }

    // ----------------------------------------------------------------
    // Pop quiz: which letter breaks — or does it pass?
    // ----------------------------------------------------------------

    function quiz() {
      badge('Pop quiz', 'quiz-intro');
      const from = song.sectionStart('quiz-intro');
      const to = end('quiz');
      const s = kit.scene(content, from, to);
      const scan = us.scanner(s, { x: 148, y: 330, compact: true, none: true, at: from + 0.2 });
      kit.kinetic(s, [
        { text: 'Pop quiz!', at: mark('quiz-intro-1', 'pop'), color: 'gold' },
      ], { y: 90, size: 72, until: line('quiz-1').start - 0.25 });
      note(s, 'Which letter breaks — or does it pass?', { x: 270, y: 210, at: mark('quiz-intro-1', 'which'), until: line('quiz-1').start - 0.2, variant: 'white' });

      const { lines } = song.storyboard.sections.find((section) => section.id === 'quiz');
      const ANSWERS = [
        { lamp: 1, reason: 'QR code = a how' },
        { lamp: 2, reason: 'no user value' },
        { lamp: 4, reason: 'split into 4 stories' },
        { lamp: 0, reason: 'waits for: create playlists' },
        { lamp: 5, reason: 'how many seconds?' },
        { lamp: 3, reason: 'ask the customer' },
        { lamp: 6, reason: 'ship it' },
      ];
      lines.forEach((entry, i) => {
        const next = i + 1 < lines.length ? lines[i + 1].start - 0.15 : to;
        const answer = ANSWERS[i];
        const quote = entry.text.replace(/^“|”$/g, '').replace(/” — /, ' — ');
        const reader = entry.id === 'quiz-7';
        us.card(s, {
          x: 170, y: 70, w: 620, at: entry.start, until: next - 0.1, tilt: i % 2 ? 1 : -1, title: `Quiz ${i + 1} / ${lines.length}`,
          ...(reader
            ? { role: 'reader', want: 'to search books by author', why: 'I find more by writers I love', fill: { role: mark('quiz-7', 'reader'), want: mark('quiz-7', 'search'), why: mark('quiz-7', 'so') } }
            : { quote }),
        });
        const state = answer.lamp === 6 ? 'pass' : 'fail';
        scan.light(answer.lamp, entry.answer_at, state);
        scan.light(answer.lamp, next, 'off');
        if (reader) {
          for (let k = 0; k < 6; k++) {
            scan.light(k, entry.answer_at + 0.05 * k, 'pass');
            scan.light(k, next, 'off');
          }
        }
        if (!reader) kit.sticker(s, answer.reason, {
          x: 560, y: 250, at: entry.answer_at + 0.15, until: next - 0.1,
          variant: state === 'pass' ? 'green' : 'red', iconName: state === 'pass' ? 'check' : 'cross', rotate: -4,
        });
      });
      const last = lines[lines.length - 1];
      kit.stamp(s, 'Ship it', { x: 560, y: 236, at: last.answer_at + 0.3, until: to - 0.3, color: 'green', rotate: -8 });
    }

    // After the quiz: INVEST depends on context.
    function quizClose() {
      badge('A lens, not a checklist', 'quiz-close');
      const from = song.sectionStart('quiz-close');
      const lensLine = line('quiz-close-2').start;
      const a = kit.scene(content, from, lensLine - 0.1);
      us.card(a, { x: 80, y: 110, w: 420, at: from + 0.1, size: 'small', title: 'Quiz 4', quote: 'I want to add songs to a playlist' });
      us.miniCard(a, { x: 580, y: 140, text: 'Create playlists · done', at: mark('quiz-close-1', 'build'), tone: 'gold', iconName: 'check' });
      const scan = us.scanner(a, { x: 337, y: 330, tiny: true, at: from + 0.1 });
      scan.light(0, from + 0.1, 'fail');
      scan.light(0, mark('quiz-close-1', 'independent'), 'pass');
      kit.sticker(a, 'now independent', { x: 600, y: 230, at: mark('quiz-close-1', 'independent'), variant: 'green', iconName: 'check', rotate: 4 });

      const b = kit.scene(content, lensLine - 0.1, end('quiz-close'));
      kit.kinetic(b, [
        { text: 'a lens,', at: mark('quiz-close-2', 'lens'), color: 'gold', iconName: 'search' },
        { text: 'not a checklist', at: mark('quiz-close-2', 'checklist') },
      ], { y: 170, size: 56 });
      note(b, 'the context makes it true', { x: 340, y: 300, at: mark('quiz-close-2', 'context'), variant: 'cyan' });
    }

    // ----------------------------------------------------------------
    // Outro: other specs for system-wide qualities; the right thing
    // ----------------------------------------------------------------

    function outro() {
      badge('Outro', 'outro');
      const from = song.sectionStart('outro');
      const lastLine = line('outro-2').start;
      const a = kit.scene(content, from, lastLine - 0.1);
      us.card(a, { x: 120, y: 130, w: 330, at: from + 0.1, size: 'small', title: 'User story', role: 'user', want: '…', why: '…' });
      const folder = kit.place(kit.el('div', 'us-folder is-staged', a), 690, 150);
      folder.append(kit.icon('folder'));
      kit.el('span', null, folder, 'other specs');
      fx.pop(folder, mark('outro-1', 'uptime'));
      [['uptime', 'uptime', 'timer'], ['scale', 'scale', 'chart'], ['safety', 'safety rules', 'shield']].forEach(([word, text, iconName], i) => {
        const chip = us.miniCard(a, { x: 470, y: 120 + i * 70, text, at: mark('outro-1', word), tone: 'ghost', iconName });
        // Filed away on "need": each chip shrinks into the folder in turn and is
        // gone before the scene ends, instead of piling up over it.
        const file = mark('outro-1', 'need') + i * 0.12;
        fx.moveTo(chip, file, 250, 60 - i * 70, 0.45);
        tween(chip, { scale: 0.3 }, file, 0.45, EASE.in);
        fx.fadeOut(chip, file + 0.35, 0.15);
      });
      note(a, 'need other kinds of specs', { x: 520, y: 380, at: mark('outro-1', 'other'), variant: 'violet' });

      const b = kit.scene(content, lastLine - 0.1, song.duration);
      student?.appear({ from: lastLine + 0.2, to: song.duration, x: 60, y: 150, scale: 0.86 });
      const story = us.card(b, {
        x: 420, y: 110, w: 420, at: mark('outro-2', 'features'), size: 'small', title: 'User story',
        role: 'student', want: 'to resubmit before it’s due', why: 'I can fix a mistake or two',
      });
      // An approval stamp on the card's lower-right corner, so the finished
      // story stays readable to the end.
      story.stamp('INVEST', { at: mark('outro-2', 'invest'), color: 'gold', rotate: -8, dx: 130, dy: 104 });
      kit.kinetic(b, [
        { text: 'the right', at: mark('outro-2', 'right') },
        { text: 'thing', at: mark('outro-2', 'thing'), color: 'gold' },
      ], { y: 340, size: 52 });
    }

    intro();
    verse1();
    preChorus();
    chorus('chorus-1', 'Chorus · INVEST');
    verse2();
    chorus('chorus-2', 'Chorus · INVEST');
    verse3();
    chorus('final-chorus', 'Final chorus');
    quiz();
    quizClose();
    outro();
  };
})();
