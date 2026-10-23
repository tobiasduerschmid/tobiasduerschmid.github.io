/*
 * Choreography for "Red, Green, Refactor", the test-driven development song
 * (storyboard: _data/songs/red_green_refactor.yml).
 *
 * Gestures and highlights follow sung words: `mark(lineId, word)` is that
 * word's time in the recording. Supporting text arrives early enough to
 * read. Each scene develops one idea in a ballroom where Test leads and Code
 * follows (js/song-video/tdd-dancers.js). Test's lamp head is the test
 * result: red with a ✗ while a test fails, green with a ✓ once it passes.
 * Code's gown is its code: jagged while messy, neatly indented once it is
 * refactored. In every chorus the dancers step from the red floor tile to
 * the green one to the violet refactor tile while the left half shows that
 * phase in the chapter's MyStack example (a failing test, just enough code,
 * the same behavior with cleaner code). The verses teach with the real
 * notation (tdd-kit.js) and with pictures (tdd-props.js). Each line's
 * `visual` text in the storyboard describes this file.
 *
 * One couple dances the whole song: scenes place it (couple.place) and it
 * walks or waltzes to its next spot on the beat, so there is never a cut
 * between two couples. Most verses keep it on the dance floor at the right
 * (SPOT.side) and keep their teaching boxes left of x ≈ 640 or above
 * y ≈ 165 there, so neither covers the other.
 *
 * Layout: 960×540 stage; the section badge sits top-left, and nothing
 * essential goes below y = 460, where the player draws captions.
 */
(function () {
  'use strict';

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.red_green_refactor = function choreograph({ song, kit, layers, student }) {
    const { fx, tween, EASE } = window.Timeline;
    const tdd = window.TddKit;
    const props = window.TddProps;
    const dancers = window.TddDancers;
    const { content, hud } = layers;
    const line = (id) => song.line(id);
    const mark = (id, word) => song.mark(id, word);
    const start = (id) => song.sectionStart(id);
    const end = (id) => song.sectionEnd(id);

    function badge(text, sectionId) {
      kit.badge(hud, text, start(sectionId), end(sectionId));
    }

    /** Height of a titled code card with `rows` lines (26px rows; see tdd-kit.css). */
    const cardHeight = (rows) => 48 + rows * 26;

    // The couple: one troupe from the title to the last bow.
    const couple = dancers.troupe(content, { x: 480, y: 452, scale: 1.0, at: 0.6, until: song.duration });
    if (student && student.savedAppearance) {
      let disposed = false;
      window.Timeline.onDispose(() => { disposed = true; });
      student.savedAppearance.then((appearance) => {
        if (!disposed && appearance && appearance.kind === 'human') couple.codeAppearance(appearance);
      });
    }
    /** Where the couple dances beside the teaching boxes (footprint centre, feet, scale). */
    const SPOT = {
      side: { x: 818, y: 456, scale: 1.12 },
    };

    // ----------------------------------------------------------------
    // Intro: Code asks for the dance; Test offers to lead
    // ----------------------------------------------------------------

    function intro() {
      const title = kit.scene(content, 0, line('intro-1').start - 0.3, { exit: 'fade' });
      kit.kinetic(title, [
        { text: 'Red,', at: 1.0, color: 'red' },
        { text: 'Green,', at: 2.1, color: 'green' },
        { text: 'Refactor', at: 3.2, color: 'violet' },
      ], { y: 70, size: 64, punch: false });
      tdd.heading(title, ['a song about ', { text: 'test-driven development', tone: 'gold' }], { y: 150, at: 4.4, size: 26 });
      const credit = kit.el('div', 'end-credit is-staged', title, 'SE Book · Test-Driven Development');
      credit.style.top = '196px';
      fx.fadeIn(credit, 5.4, 0.5);

      const duo = couple;
      // A poised opening: no idle bob/sway while the title and greetings land.
      for (const kind of ['test', 'code']) {
        duo.pose(kind, 0, { idleMotion: 0 }, { dur: 0.01 });
        duo.pose(kind, mark('intro-4', 'guide'), { idleMotion: 1 });
      }
      duo.step('test', 0, -150, 0.01).step('code', 0, 150, 0.01);
      // After the still title card, each sways and steps in place to the beat
      // until they meet.
      duo.waltz(line('intro-2').start - 1.4, mark('intro-2', 'lead') - 0.4, { travel: 5, roam: 0 });
      duo.waltz(mark('intro-3', 'first') + 0.3, mark('intro-4', 'one') - 0.2, { travel: 5, roam: 0 });
      // After the title they come forward to meet the song.
      duo.place(line('intro-1').start - 0.4, { x: 480 + 20 * 1.12, y: 456, scale: 1.12 }, 1.6);
      duo.pose('test', 5.6, 'wave', { dur: 0.5 }).pose('test', 7.0, 'stand');
      duo.pose('code', 6.2, 'wave', { dur: 0.5 }).pose('code', 7.6, 'stand');

      // "Shall we take a chance?" — "Let me lead this dance."
      const s = kit.scene(content, line('intro-1').start - 0.3, end('intro'), { exit: 'fade' });
      tdd.bubble(s, { x: 616, y: 104, w: 300, who: 'Code', text: '“Shall we take a chance?”', at: line('intro-1').start, until: line('intro-2').start - 0.2, side: 'left', tone: 'code' });
      duo.pose('code', mark('intro-1', 'take'), 'offerL');
      tdd.bubble(s, { x: 50, y: 104, w: 300, who: 'Test', text: '“Let me lead this dance.”', at: line('intro-2').start, until: line('intro-3').start + 0.2, side: 'right', tone: 'test' });
      duo.pose('test', mark('intro-2', 'lead'), 'bow', { lean: 16, dur: 0.5 });
      duo.pose('test', mark('intro-2', 'dance') + 0.2, 'offerR', { lean: 0, dur: 0.5 });
      duo.pose('code', mark('intro-2', 'dance'), 'stand');

      // "First say what the code should do": a test, before any code.
      const spec = tdd.code(s, {
        x: 250, y: 50, w: 460, title: 'tests/test_stack.py', at: mark('intro-3', 'first'), until: line('intro-4').end + 0.2,
        lines: [
          { text: 'def test_new_stack_is_empty():', at: mark('intro-3', 'first') + 0.1 },
          { text: '    stack = MyStack()', at: mark('intro-3', 'what') },
          { text: '    assert stack.is_empty()', at: mark('intro-3', 'should') },
        ],
      });
      spec.mark(2, mark('intro-3', 'do'), line('intro-4').start, 'focus');
      duo.pose('test', mark('intro-3', 'first'), { armR: { sh: -150, el: -10 }, armL: { sh: 14, el: -6 } });

      // "One small step; I'll guide you through": they meet, take the
      // promenade hold, and waltz across to their place beside the lesson.
      duo.pose('test', line('intro-4').start, 'stand', { dur: 0.6 });
      duo.step('test', mark('intro-4', 'one'), 0, 1.2).step('code', mark('intro-4', 'one'), 0, 1.2);
      duo.hold(mark('intro-4', 'step'), { pose: 'frame' });
      // They keep waltzing through the rules of verse 1; gestures ride on top.
      // The dance itself obeys the lyrics: it comes to rest on "rest" and
      // stops on "stop", holding still until the line ends.
      duo.waltz(mark('intro-4', 'guide'), mark('verse-1-2', 'rest'), { travel: 10, roam: 8 });
      duo.waltz(line('verse-1-3').start - 0.3, mark('verse-1-5', 'stop'), { travel: 10, roam: 8 });
      duo.waltz(line('verse-1-6').start, mark('verse-1-8', 'red'), { travel: 10, roam: 8 });
      duo.place(line('intro-4').end + 0.3, SPOT.side, 2.4);
    }

    // ----------------------------------------------------------------
    // Verse 1: the three rules, and why the steps stay small
    // ----------------------------------------------------------------

    function verse1() {
      badge('Verse 1 · The rules of the dance', 'verse-1');
      const duo = couple;

      // Rule 1: no production code before a failing test.
      const a = kit.scene(content, start('verse-1'), line('verse-1-3').start - 0.1);
      tdd.heading(a, [{ text: 'Rule 1', tone: 'gold' }], { x: 52, y: 62, center: false, at: mark('verse-1-1', 'first'), size: 30 });
      tdd.code(a, {
        x: 50, y: 108, w: 440, title: 'tests/test_stack.py', tone: 'red', at: mark('verse-1-1', 'first'),
        lines: [
          { text: 'def test_push():', at: mark('verse-1-1', 'first') + 0.1 },
          { text: '    stack = MyStack()', at: mark('verse-1-1', 'a') },
          { text: '    stack.push(3)', at: mark('verse-1-1', 'failing') },
          { text: '    assert not stack.is_empty()', at: mark('verse-1-1', 'unit') },
        ],
      });
      tdd.pytest(a, {
        x: 50, y: 108 + cardHeight(4) + 10, w: 440, at: mark('verse-1-1', 'test') - 0.1,
        runs: [{ at: mark('verse-1-1', 'test'), dots: 'F', errors: ["E  AttributeError: no attribute 'push'"], summary: '1 failed' }],
      });
      duo.lamp(mark('verse-1-1', 'test') + 0.5, 'red');
      tdd.code(a, {
        x: 520, y: 52, w: 300, title: 'my_stack.py', tone: 'dim', at: mark('verse-1-2', 'till'),
        lines: ['class MyStack:', '    pass'],
      });
      tdd.note(a, 'production code waits', { x: 250, y: 64, at: line('verse-1-2').start, tone: 'gold', iconName: 'hourglass' });
      // "Production code must rest": Code steps out of the hold, hands on hips.
      duo.pose('code', mark('verse-1-2', 'must'), 'hips', { face: 'smile', hold: 0, embrace: 0 });
      duo.pose('code', line('verse-1-3').start, 'frame', { hold: 1, embrace: 1, face: 'happy' });

      // The test says what we need, from the caller's side of the interface.
      const b = kit.scene(content, line('verse-1-3').start - 0.1, line('verse-1-5').start - 0.1);
      const ask = tdd.code(b, {
        x: 50, y: 108, w: 420, title: 'tests/test_stack.py · the caller', at: line('verse-1-3').start,
        lines: ['def test_push():', '    stack = MyStack()', '    stack.push(3)', '    assert not stack.is_empty()'],
      });
      ask.mark(2, mark('verse-1-3', 'what'), line('verse-1-5').start);
      ask.mark(3, mark('verse-1-3', 'need'), line('verse-1-5').start);
      const face = tdd.panel(b, { x: 470, y: 40, w: 260, title: 'MyStack · seen from outside', iconName: 'eye', at: line('verse-1-3').start + 0.5 });
      for (const [text, at] of [['push(item)', line('verse-1-3').start + 0.7], ['is_empty() → bool', line('verse-1-3').start + 0.9]]) {
        const chip = kit.el('div', 'tdd-method is-staged', face.body, text);
        fx.pop(chip, at, { from: 0.6 });
      }
      kit.flow(b, { from: [474, 170], to: [496, 120], bend: -16, color: 'gold', at: mark('verse-1-4', 'callers') });
      duo.pose('test', mark('verse-1-4', 'callers'), 'pointL');

      // Rule 2: write only enough test to fail, then stop.
      const c = kit.scene(content, line('verse-1-5').start - 0.1, line('verse-1-7').start - 0.1);
      tdd.heading(c, [{ text: 'Rule 2', tone: 'gold' }], { x: 52, y: 62, center: false, at: mark('verse-1-5', 'write'), size: 30 });
      tdd.code(c, {
        x: 50, y: 108, w: 440, title: 'tests/test_stack.py', at: mark('verse-1-5', 'write'),
        lines: [
          { text: 'def test_pop():', at: mark('verse-1-5', 'write') + 0.1 },
          { text: '    stack = MyStack()', at: mark('verse-1-5', 'test') },
          { text: '    stack.push(3)', at: mark('verse-1-5', 'code') },
          { text: '    element = stack.pop()', at: mark('verse-1-5', 'till') },
        ],
      });
      tdd.pytest(c, {
        x: 50, y: 108 + cardHeight(4) + 10, w: 400, at: mark('verse-1-5', 'fails') - 0.15,
        runs: [{ at: mark('verse-1-5', 'fails'), dots: '..F', errors: ["E  AttributeError: no attribute 'pop'"], summary: '1 failed, 2 passed' }],
      });
      duo.lamp(mark('verse-1-5', 'fails'), 'red');
      tdd.stopSign(c, { x: 530, y: 64, at: mark('verse-1-5', 'stop'), until: mark('verse-1-6', 'batch') - 0.1, size: 92 });
      duo.pose('test', mark('verse-1-5', 'stop'), 'stopL', { dur: 0.25 });
      const batch = kit.el('div', 'tdd-batch is-staged', c);
      kit.place(batch, 480, 40);
      for (const name of ['test_peek', 'test_size', 'test_sort']) kit.el('div', 'tdd-batch-card', batch, name);
      fx.pop(batch, mark('verse-1-6', 'no') - 0.1, { from: 0.7 });
      kit.stamp(c, 'No batch', { x: 510, y: 96, at: mark('verse-1-6', 'batch'), until: line('verse-1-7').start - 0.1, rotate: -8, shake: false });
      duo.pose('test', mark('verse-1-6', 'no'), 'frame');

      // Small steps: each one gets feedback; when red comes back, only the
      // last small step needs checking.
      const d = kit.scene(content, line('verse-1-7').start - 0.1, end('verse-1'));
      tdd.note(d, 'small steps', { x: 40, y: 186, at: mark('verse-1-7', 'small'), tone: 'green' });
      tdd.steps(d, { x: 200, y: 170, w: 400, count: 7, at: mark('verse-1-7', 'steps'), step: 0.3, failAt: mark('verse-1-8', 'red') });
      tdd.note(d, 'trace 1 small step', { x: 400, y: 88, at: line('verse-1-8').start, tone: 'green', iconName: 'search' });
      duo.lamp(line('verse-1-7').start, 'green').hold(line('verse-1-7').start, { pose: 'flourish' });
      duo.hold(mark('verse-1-7', 'small'), { pose: 'frame', dur: 0.6 });
      duo.lamp(mark('verse-1-8', 'red'), 'red');
    }

    // ----------------------------------------------------------------
    // Verse 2: run the new test first, and read why it is red
    // ----------------------------------------------------------------

    function verse2() {
      badge('Verse 2 · Testing the test', 'verse-2');
      const partB = line('verse-2-5').start - 0.2;
      const duo = couple;
      duo.hold(start('verse-2') + 0.2, { pose: 'frame', dur: 0.6 });
      duo.lamp(mark('verse-2-1', 'run'), 'red');
      duo.waltz(start('verse-2') + 0.4, partB - 0.3, { travel: 6, roam: 12 });

      // Two red runs; the same colour can mean different things.
      const a = kit.scene(content, start('verse-2'), line('verse-2-5').start - 0.2);
      tdd.heading(a, [{ text: 'Why', tone: 'gold' }, ' is it red?'], { x: 42, y: 62, center: false, at: mark('verse-2-1', 'run'), size: 28 });
      tdd.code(a, {
        x: 30, y: 104, w: 290, title: 'test A', at: mark('verse-2-3', 'missing') - 0.1,
        lines: [{ text: 'from my_stack import MyStack', at: mark('verse-2-3', 'missing') }],
      }).mark(0, mark('verse-2-3', 'class'), line('verse-2-5').start, 'good');
      tdd.code(a, {
        x: 334, y: 104, w: 290, title: 'test B', at: line('verse-2-3').start,
        lines: [{ text: 'stack = MyStak()', at: line('verse-2-3').start + 0.1 }],
      }).mark(0, mark('verse-2-4', 'typo'), line('verse-2-5').start, 'bad');
      tdd.pytest(a, {
        x: 30, y: 184, w: 290, at: mark('verse-2-1', 'run'),
        runs: [{ at: mark('verse-2-1', 'first'), dots: 'E', errorsAt: mark('verse-2-3', 'class'), summaryAt: mark('verse-2-1', 'first') + 0.4, errors: ["E  ImportError: no 'MyStack'"], summary: '1 error' }],
      });
      tdd.pytest(a, {
        x: 334, y: 184, w: 290, at: mark('verse-2-1', 'first'),
        runs: [{ at: mark('verse-2-1', 'first') + 0.2, dots: 'E', errorsAt: line('verse-2-3').start + 0.5, summaryAt: mark('verse-2-1', 'first') + 0.6, errors: ["E  NameError: 'MyStak'"], summary: '1 error' }],
      });
      tdd.note(a, 'same red, different reasons', { x: 180, y: 372, at: mark('verse-2-2', 'same'), until: mark('verse-2-3', 'red'), tone: 'red', iconName: 'warning' });
      tdd.note(a, 'expected: MyStack doesn’t exist yet', { x: 30, y: 340, at: mark('verse-2-3', 'red'), tone: 'green', iconName: 'check' });
      tdd.note(a, 'typo: wrong reason', { x: 360, y: 392, at: line('verse-2-3').start + 0.6, tone: 'red', iconName: 'cross' });

      // See red before trusting green: the red run proves the test can see
      // the missing step. A test that was never red may check nothing.
      const b = kit.scene(content, line('verse-2-5').start - 0.2, end('verse-2'), { exit: 'fade' });
      duo.place(line('verse-2-5').start - 0.5, { x: 786, y: 444, scale: 0.92 }, 0.8);
      tdd.runs(b, {
        x: 54, y: 108, w: 500, label: 'Red first, then green', at: mark('verse-2-5', 'see'),
        ticks: [
          { x: 0.12, at: mark('verse-2-5', 'red'), status: 'fail', label: 'no code yet' },
          { x: 0.62, at: mark('verse-2-5', 'green'), status: 'pass', label: 'code written' },
        ],
      });
      tdd.runs(b, {
        x: 54, y: 276, w: 500, label: 'Green from the start', at: mark('verse-2-5', 'trust'),
        ticks: [{ x: 0.62, at: mark('verse-2-5', 'green'), status: 'pass', label: 'never red' }],
      });
      kit.stamp(b, 'Trusted', { x: 430, y: 202, at: mark('verse-2-6', 'know'), color: 'green', rotate: -3, shake: false, small: true });
      tdd.note(b, 'can it fail at all?', { x: 288, y: 386, at: mark('verse-2-6', 'seen'), tone: 'gold', iconName: 'question' });
      duo.lamp(mark('verse-2-5', 'red'), 'red').lamp(mark('verse-2-5', 'green'), 'green');
      duo.waltz(mark('verse-2-5', 'green'), end('verse-2') - 0.2, { travel: 10, roam: 14 });
      duo.twirl(line('verse-2-6').end + 0.4, { dur: 1.4 });
    }

    // ----------------------------------------------------------------
    // Chorus: the cycle, and the dancers step Red → Green → Refactor
    // ----------------------------------------------------------------

    // Each chorus: a failing test, just enough code, then one refactoring.
    // `code` lists the green code; lines marked `refactor` change in the
    // refactor step (a struck line stays readable above its replacement).
    const CHORUS = {
      1: {
        test: ['def test_new_stack_is_empty():', '    stack = MyStack()', '    assert stack.is_empty()'],
        run: { dots: 'F', summary: '1 failed' },
        need: 'needed: is_empty()',
        code: ['class MyStack:', { text: '    """A last-in, first-out stack."""', refactor: 'add' }, '    def is_empty(self):', '        return True'],
        pass: { dots: '.', summary: '1 passed' },
      },
      2: {
        test: ['def test_push(stack):', '    stack.push(3)', '    assert not stack.is_empty()'],
        run: { dots: '.F', summary: '1 failed, 1 passed' },
        need: 'needed: push()',
        code: [
          'def push(self, element):', '    self.elements.append(element)', 'def is_empty(self):',
          { text: '    return self.elements == []', refactor: 'strike' }, { text: '    return not self.elements', refactor: 'add' },
        ],
        pass: { dots: '..', summary: '2 passed' },
      },
      3: {
        test: ['def test_peek(stack):', '    stack.push(1); stack.push(2)', '    assert stack.peek() == 2'],
        run: { dots: '....F', summary: '1 failed, 4 passed' },
        need: 'needed: peek(), the parked idea',
        // This test is the longest to read, so its code lands on "code".
        codeOn: 'code',
        code: ['def peek(self):', { text: '    return self.elements[-1]', refactor: 'strike' }, { text: '    return self._items[-1]', refactor: 'add' }],
        pass: { dots: '.....', summary: '5 passed' },
        note: 'a private rename: tests still pass',
      },
    };

    function chorus(n, { final = false } = {}) {
      const id = `chorus-${n}`;
      const ln = (k) => `${id}-${k}`;
      const ex = CHORUS[n];
      badge(final ? 'Final chorus · The cycle' : 'Chorus · The cycle', id);
      const s0 = start(id);
      const sEnd = end(id);
      // A new cycle starts confidently, without carrying a prior worried face.
      couple.face('code', s0, 'happy');

      // The dance floor: three tiles, and the couple stepping between them.
      // Each tile is wide enough for the whole couple, and every step lands
      // the couple's footprint on the tile's centre.
      const xs = { red: 650, green: 745, refactor: 840 };
      const tiles = props.floorTiles(content, { y: 446, xs, rx: 70, at: s0, until: sEnd });
      const duo = couple;
      duo.place(s0 - 0.7, { x: xs.red, y: 446, scale: 1.06 }, 0.9);
      duo.hold(s0, { pose: 'frame' });
      // Each move between tiles is a glide of about a beat; the long way
      // back (refactor → red) takes longer, so it never reads as a slide.
      const go = (phase, at, dur = 0.7) => duo.place(at - 0.35, { x: xs[phase] }, dur);

      // Line 1: the cycle lights word by word. Line 2: Test takes the lead.
      const cycle = tdd.cycle(content, { x: 24, y: 128, at: s0, until: sEnd });
      // On "let the tests lead" the cycle shrinks to the top-right corner as a
      // phase map, making room for the test that leads: it arrives a line
      // before it fails, so it can be read before the run.
      const testAt = mark(ln(2), 'let') + 0.25;
      tween(cycle.node, { scale: '0.65', translate: '586px -122px' }, mark(ln(2), 'let') - 0.15, 0.5, EASE.inOut);
      cycle.light('red', mark(ln(1), 'red'), mark(ln(1), 'green'));
      cycle.light('green', mark(ln(1), 'green'), mark(ln(1), 'refactor'));
      cycle.light('refactor', mark(ln(1), 'refactor'), line(ln(2)).start + 0.2);
      tiles.light('red', mark(ln(1), 'red'), mark(ln(1), 'green'));
      tiles.light('green', mark(ln(1), 'green'), mark(ln(1), 'refactor'));
      tiles.light('refactor', mark(ln(1), 'refactor'), line(ln(2)).start + 0.2);
      // "Red, green, refactor": one continuous glide across the three tiles,
      // passing the green tile as "green" is sung.
      duo.place(mark(ln(1), 'green') - 0.45, { x: xs.refactor }, mark(ln(1), 'refactor') - mark(ln(1), 'green') + 0.75);
      duo.lamp(mark(ln(1), 'red'), 'red').lamp(mark(ln(1), 'green'), 'green');
      go('red', mark(ln(2), 'let'), 1.0);
      duo.hold(mark(ln(2), 'tests'), { pose: 'frame', dur: 0.6 });
      duo.waltz(mark(ln(2), 'tests'), sEnd - 0.3, { travel: 6, roam: 0 });
      cycle.light('red', mark(ln(2), 'lead'), line(ln(3)).start);

      // Red: the complete test arrives first, then fails for the change
      // we need, and stays up until the code lands on "Write" (or "code").
      // The code card that replaces it stays up through green and refactor,
      // and one terminal runs the tests after every step, so each box stays
      // long enough to read.
      const codeAt = ex.codeOn === 'code' ? mark(ln(5), 'code') - 0.3 : line(ln(5)).start - 0.15;
      const refactorAt = line(ln(7)).start - 0.15;
      // Reveal the changed line during the refactoring phrase, then hold it.
      const changeAt = line(ln(7)).start + 0.6;
      const red = kit.scene(content, testAt - 0.2, codeAt - 0.1);
      tdd.code(red, { x: 40, y: 92, w: 420, title: 'tests/test_stack.py', tone: 'red', at: testAt, lines: ex.test });
      const fails = mark(ln(3), 'fails');
      tdd.pytest(content, {
        x: 40, y: 92 + cardHeight(Math.max(ex.test.length, ex.code.length)) + 10, w: 420, at: fails - 0.2, until: sEnd,
        runs: [
          { at: fails - 0.25, dots: ex.run.dots, summary: ex.run.summary },
          { at: mark(ln(6), 'get') - 0.6, dots: ex.pass.dots, summary: ex.pass.summary },
          { at: changeAt + 0.1, summaryAt: changeAt + 0.5, dots: ex.pass.dots, summary: ex.pass.summary },
        ],
      });
      tdd.note(content, ex.need, { x: 40, y: 56, at: mark(ln(4), 'for'), until: refactorAt, tone: 'gold', iconName: 'pin' });
      duo.lamp(mark(ln(3), 'fails'), 'red');
      cycle.light('red', mark(ln(3), 'first'), line(ln(5)).start);
      tiles.light('red', mark(ln(3), 'first'), line(ln(5)).start);

      // Green: just enough code, and every test passes.
      const card = tdd.code(content, {
        x: 40, y: 92, w: 420, title: 'my_stack.py', tone: 'green', at: codeAt, until: sEnd,
        lines: ex.code.map((spec) => {
          if (typeof spec === 'string') return spec;
          return spec.refactor === 'add' ? { text: spec.text, at: changeAt, tone: 'add' } : { text: spec.text, strikeAt: changeAt };
        }),
      });
      go('green', mark(ln(5), 'write'));
      duo.tidy(mark(ln(5), 'write'), 0, 1.0);
      duo.lamp(mark(ln(6), 'green'), 'green');
      cycle.light('green', mark(ln(5), 'write'), line(ln(7)).start);
      tiles.light('green', mark(ln(5), 'write'), line(ln(7)).start);

      // Refactor: the same code card changes its structure; the tests still pass.
      tdd.during(card.node, 'tdd-code--violet', refactorAt);
      const ref = kit.scene(content, refactorAt, sEnd);
      if (ex.note) tdd.note(ref, ex.note, { x: 40, y: 56, at: changeAt, tone: 'violet', iconName: 'sparkle' });
      go('refactor', mark(ln(7), 'same'));
      // The refactoring showcase: Test presents Code, and the code lines on
      // her gown snap into clean indentation by "cleaner"; same dancer,
      // same steps, cleaner code.
      const cleaner = mark(ln(8), 'cleaner');
      duo.showcase(Math.max(mark(ln(7), 'outward'), cleaner - 2.2), { until: cleaner + 0.3 });
      cycle.light('refactor', mark(ln(7), 'same'), sEnd);
      tiles.light('refactor', mark(ln(7), 'same'), sEnd);
      if (final) {
        // The finale: they step toward centre stage and Test dips Code.
        duo.place(mark(ln(8), 'cleaner') - 0.2, { x: xs.green }, 0.8);
        duo.dip(mark(ln(8), 'routine'), { dur: 0.6 }).rise(sEnd - 0.6);
        // Behind everything on the content layer: the bursts bloom in the
        // open stage and never cover the code, the cycle, or the dancers.
        window.SongFireworks.celebrate(content, { at: mark(ln(8), 'routine') + 0.1, seed: 41 });
      } else {
        duo.twirl(mark(ln(8), 'routine') - 0.2, { dur: 1.1 });
      }
    }

    // ----------------------------------------------------------------
    // Verse 3: green means just enough code — and all the old tests pass
    // ----------------------------------------------------------------

    function verse3() {
      badge('Verse 3 · Green: just enough', 'verse-3');
      const duo = couple;
      duo.place(start('verse-3') - 0.3, SPOT.side, 1.4);
      duo.hold(start('verse-3'), { pose: 'frame' }).lamp(start('verse-3'), 'green');
      duo.waltz(start('verse-3') + 0.3, end('verse-3') - 0.2, { travel: 10, roam: 14 });

      // Just enough code; extras get parked; untested extras hide bugs.
      const a = kit.scene(content, start('verse-3'), line('verse-3-5').start - 0.1);
      tdd.heading(a, [{ text: 'Rule 3', tone: 'gold' }], { x: 42, y: 62, center: false, at: mark('verse-3-1', 'write'), size: 30 });
      const enough = tdd.code(a, { x: 40, y: 104, w: 310, title: 'my_stack.py', tone: 'green', at: mark('verse-3-1', 'write'), lines: ['def is_empty(self):', '    return True'] });
      enough.mark(1, mark('verse-3-1', 'pass'), line('verse-3-3').start, 'good');
      props.parking(a, {
        x: 362, y: 104, w: 250, at: mark('verse-3-2', 'no'),
        cars: [
          { text: 'peek()', at: mark('verse-3-2', 'extra') },
          { text: 'size()', at: mark('verse-3-2', 'features') },
          { text: 'sort()', at: mark('verse-3-2', 'park') },
          { text: 'undo()', at: mark('verse-3-2', 'rest') },
        ],
      });
      const extra = tdd.code(a, {
        x: 40, y: 248, w: 310, title: 'untested extra', tone: 'red', at: mark('verse-3-2', 'park'),
        lines: [{ text: 'def peek(self):', strikeAt: mark('verse-3-4', 'add') }, { text: '    return self.elements[0]', strikeAt: mark('verse-3-4', 'add') }],
      });
      extra.mark(1, mark('verse-3-3', 'mistakes'), mark('verse-3-4', 'add'), 'bad');
      tdd.bug(a, { x: 300, y: 300, size: 44, at: mark('verse-3-3', 'hide'), rotate: -30, until: mark('verse-3-4', 'add') + 0.6 });
      tdd.note(a, '0 tests', { x: 230, y: 226, at: mark('verse-3-3', 'untested') + 0.2, until: mark('verse-3-4', 'add'), tone: 'red', iconName: 'warning' });

      // Run all the tests: the old ones are promises; new ideas go on a list.
      const b = kit.scene(content, line('verse-3-5').start - 0.1, end('verse-3'));
      tdd.suite(b, {
        x: 40, y: 104, w: 470, title: 'pytest · 3 passed', at: mark('verse-3-5', 'run'),
        tests: [
          { name: 'test_new_stack_is_empty', note: 'old', states: [{ at: mark('verse-3-5', 'all'), status: 'pass' }] },
          { name: 'test_push', note: 'old', states: [{ at: mark('verse-3-5', 'the'), status: 'pass' }] },
          { name: 'test_pop', note: 'new', states: [{ at: mark('verse-3-5', 'new'), status: 'pass' }] },
        ],
      });
      tdd.todo(b, {
        x: 40, y: 262, w: 380, at: mark('verse-3-7', 'write') - 0.1,
        items: [
          { text: 'pop() on an empty stack?', at: line('verse-3-7').start - 0.9 },
          { text: 'push many, pop in order', at: line('verse-3-7').start - 0.9 },
          { text: 'peek()', at: line('verse-3-7').start - 0.9 },
        ],
      });
    }

    // ----------------------------------------------------------------
    // Verse 4: refactor — change how, keep what
    // ----------------------------------------------------------------

    function verse4() {
      badge('Verse 4 · Refactor', 'verse-4');
      const s0 = start('verse-4');
      const duo = couple;
      duo.place(s0 - 0.3, SPOT.side, 1.2);
      duo.hold(s0, { pose: 'frame' }).lamp(s0, 'green').tidy(s0 + 0.2, 0, 0.8);
      const cycle = tdd.cycle(content, { x: 610, y: 6, scale: 0.65, compact: true, at: s0, until: line('verse-4-3').start - 0.1 });
      cycle.light('green', s0, mark('verse-4-2', 'refactor'));
      cycle.light('refactor', mark('verse-4-2', 'refactor'), line('verse-4-3').start);

      // Green is not the final bow: the dancers start to bow, then refactor.
      const a = kit.scene(content, s0, line('verse-4-3').start - 0.1);
      duo.hold(mark('verse-4-1', 'final') - 0.3, { release: true, pose: 'stand', dur: 0.3 });
      duo.bow(mark('verse-4-1', 'final'));
      kit.stamp(a, 'Not done yet', { x: 120, y: 120, at: mark('verse-4-1', 'not'), rotate: -6, shake: false, until: mark('verse-4-2', 'clean') - 0.1 });
      duo.rise(mark('verse-4-2', 'refactor'));
      // "Clean the structure now": the refactoring showcase. Test presents
      // Code and her gown's code lines snap into clean indentation.
      duo.showcase(mark('verse-4-2', 'clean'), { until: mark('verse-4-3', 'written') });

      // Keep the definition beside the original worked refactoring examples.
      const definition = tdd.panel(content, { x: 40, y: 318, w: 470, title: 'Refactoring', iconName: 'sparkle', tone: 'violet', at: mark('verse-4-2', 'refactor'), until: end('verse-4') - 0.6 });
      kit.el('p', 'tdd-definition', definition.body, 'Make the design more elegant, cleaner, and potentially faster while not changing the functionality of the program.');

      // Change how it's written, not its aim: the old pop stays readable
      // (struck through) beside the one-line version that replaces it.
      const written = mark('verse-4-4', 'stays');
      tdd.code(content, {
        x: 40, y: 92, w: 470, title: 'my_stack.py', tone: 'violet', at: line('verse-4-2').start, until: line('verse-4-5').start - 0.2,
        lines: [
          'def pop(self):',
          { text: '    element = self.elements[-1]', strikeAt: written },
          { text: '    self.elements = self.elements[0:-1]', strikeAt: written },
          { text: '    return element', strikeAt: written },
          { text: '    return self.elements.pop()', at: written, tone: 'add' },
        ],
      });
      const b = kit.scene(content, line('verse-4-3').start - 0.1, line('verse-4-5').start - 0.2);
      tdd.blackBox(b, {
        x: 560, y: 46, w: 360, at: mark('verse-4-4', 'outward'), tidyAt: written,
        calls: [{ input: 'push(1), push(2)', output: 'ok' }, { input: 'pop()', output: '2' }, { input: 'pop()', output: '1' }],
      });
      tdd.note(b, 'same outputs', { x: 480, y: 222, at: mark('verse-4-4', 'same'), tone: 'green', iconName: 'check' });
      duo.twirl(line('verse-4-4').end + 0.5, { dur: 1.6, turns: 2 });

      // Remove duplication in the tests too: a fixture makes a fresh stack.
      const c = kit.scene(content, line('verse-4-5').start - 0.2, line('verse-4-7').start - 0.15);
      const dup = tdd.code(c, {
        x: 40, y: 104, w: 300, title: 'tests · before', at: line('verse-4-5').start,
        lines: ['def test_push():', '    stack = MyStack()', 'def test_pop():', '    stack = MyStack()'],
      });
      for (const row of [1, 3]) dup.mark(row, mark('verse-4-5', 'duplication'), line('verse-4-7').start, 'bad');
      tdd.code(c, {
        x: 356, y: 104, w: 270, title: 'tests · after', tone: 'green', at: line('verse-4-5').start + 0.4,
        lines: ['@pytest.fixture', 'def stack():', '    return MyStack()'],
      }).mark(1, mark('verse-4-6', 'code'), line('verse-4-7').start, 'good');
      tdd.note(c, 'Fresh stack per test', { x: 356, y: 240, at: line('verse-4-5').start + 0.6, tone: 'green', iconName: 'sparkle' });

      // Each little change is followed by a run of all the tests.
      const d = kit.scene(content, line('verse-4-7').start - 0.15, end('verse-4'), { exit: 'fade' });
      tdd.runs(d, {
        x: 50, y: 126, w: 540, label: 'Refactoring, one step at a time', at: mark('verse-4-7', 'run'),
        ticks: [
          { x: 0.1, at: mark('verse-4-7', 'tests'), status: 'pass', label: 'rename' },
          { x: 0.37, at: mark('verse-4-7', 'each'), status: 'pass', label: 'fixture' },
          { x: 0.64, at: mark('verse-4-7', 'routine'), status: 'pass', label: 'shorter pop' },
          { x: 0.9, at: mark('verse-4-8', 'change'), status: 'pass', label: 'docstring' },
        ],
      });
      tdd.ciBadge(d, { x: 160, y: 250, at: mark('verse-4-8', 'leave'), states: [{ at: 0, status: 'pass' }] });
      duo.waltz(s0 + 0.3, mark('verse-4-1', 'final') - 0.4, { travel: 8, roam: 10 });
      duo.waltz(mark('verse-4-3', 'written') + 0.4, end('verse-4') - 0.2, { travel: 10, roam: 14 });
    }

    // ----------------------------------------------------------------
    // Verse 5: arrange, act, assert — and the weak test that let a bug by
    // ----------------------------------------------------------------

    function verse5() {
      badge('Verse 5 · Arrange, act, assert', 'verse-5');
      const s0 = start('verse-5');

      const weakAt = line('verse-5-4').end + 0.5;
      const duo = couple;
      duo.place(s0 - 0.3, SPOT.side, 1.4);
      duo.hold(s0, { pose: 'frame' }).lamp(s0, 'idle');
      duo.waltz(s0 + 0.3, mark('verse-5-8', 'give') - 0.3, { travel: 8, roam: 14 });
      duo.lamp(mark('verse-5-3', 'three'), 'green');
      const a = kit.scene(content, s0, weakAt - 0.2);
      const aaa = tdd.code(a, {
        x: 40, y: 72, w: 450, title: 'tests/test_stack.py', at: mark('verse-5-1', 'arrange'),
        lines: [
          { text: 'def test_pop():', at: mark('verse-5-1', 'arrange') },
          { text: '    # Arrange', at: mark('verse-5-1', 'arrange') + 0.1 },
          { text: '    stack = MyStack()', at: mark('verse-5-1', 'fresh') },
          { text: '    stack.push(3)', at: mark('verse-5-1', 'push') },
          { text: '    # Act', at: mark('verse-5-2', 'act') },
          { text: '    element = stack.pop()', at: mark('verse-5-2', 'pop') },
          { text: '    # Assert', at: mark('verse-5-3', 'three') - 0.2 },
          { text: '    assert element == 3', at: mark('verse-5-3', 'three') },
          { text: '    assert stack.is_empty()', at: mark('verse-5-4', 'assert') },
        ],
      });
      aaa.mark(7, mark('verse-5-3', 'back'), line('verse-5-5').start, 'good');
      aaa.mark(8, mark('verse-5-4', 'empty'), line('verse-5-5').start, 'good');
      const column = tdd.stack(a, { x: 516, y: 130, slots: 3, at: mark('verse-5-1', 'fresh'), caption: 'a fresh stack' });
      column.push(mark('verse-5-1', 'three'), 3);
      column.pop(mark('verse-5-2', 'pop'), { to: [16, -150] });
      tdd.note(a, 'element == 3', { x: 480, y: 330, at: mark('verse-5-3', 'back'), tone: 'green', iconName: 'check' });
      tdd.note(a, 'is_empty() → True', { x: 440, y: 380, at: line('verse-5-4').start, tone: 'green', iconName: 'check' });

      // The bug: pop returns 3 but never removes it. A weak test passes.
      const b = kit.scene(content, weakAt - 0.2, line('verse-5-7').start - 0.1);
      tdd.code(b, {
        x: 40, y: 72, w: 450, title: 'my_stack.py', tone: 'red', at: weakAt,
        lines: ['def pop(self):', '    return self.elements[-1]'],
      }).mark(1, mark('verse-5-5', 'inside'), line('verse-5-7').start, 'bad');
      const buggy = tdd.stack(b, { x: 516, y: 120, slots: 3, at: mark('verse-5-5', 'if') });
      buggy.push(mark('verse-5-5', 'if') + 0.05, 3);
      buggy.pop(mark('verse-5-5', 'comes'), { to: [16, -140], ghost: true });
      tdd.note(b, 'still inside!', { x: 500, y: 300, at: mark('verse-5-5', 'inside'), tone: 'red', iconName: 'warning' });
      duo.face('code', mark('verse-5-5', 'inside'), 'worried');
      duo.lamp(weakAt + 0.4, 'green').face('test', weakAt + 0.6, 'happy');
      tdd.code(b, {
        x: 40, y: 194, w: 450, title: 'tests/test_stack.py', at: weakAt + 0.2,
        lines: ['assert stack.pop() == 3'],
      });
      tdd.suite(b, { x: 40, y: 280, w: 300, at: weakAt + 0.4, tests: [{ name: 'test_pop', states: [{ at: weakAt + 0.4, status: 'pass', word: 'PASSED?' }] }] });
      kit.stamp(b, 'Weak test', { x: 330, y: 352, at: line('verse-5-5').start, rotate: -7, shake: false });
      const slider = tdd.bug(b, { x: 60, y: 360, size: 46, at: mark('verse-5-6', 'error') - 0.1, rotate: 100, until: mark('verse-5-6', 'slide') + 0.7 });
      tween(slider, { translate: '180px 30px' }, mark('verse-5-6', 'slide'), 0.7, EASE.in);

      // Test behavior, not private moves: then the code is free to change.
      const c = kit.scene(content, line('verse-5-7').start - 0.1, end('verse-5'));
      tdd.code(c, {
        x: 40, y: 108, w: 470, title: 'Private field rename', at: mark('verse-5-7', 'test'),
        lines: [
          { text: 'self.elements = []', strikeAt: mark('verse-5-7', 'private') },
          { text: 'self._items = []', at: mark('verse-5-7', 'private'), tone: 'add' },
        ],
      });
      tdd.suite(c, {
        x: 40, y: 230, w: 580, at: mark('verse-5-7', 'test'),
        tests: [
          { name: 'assert stack.is_empty()', at: line('verse-5-7').start, states: [{ at: line('verse-5-7').start, status: 'pass' }] },
          { name: 'assert stack.elements == []', note: 'private detail', at: line('verse-5-7').start, states: [{ at: line('verse-5-7').start, status: 'pass' }, { at: mark('verse-5-7', 'private') + 0.1, status: 'fail', word: 'BROKE' }] },
        ],
      });
      // The private-detail test breaks; tests of behavior give the code the
      // freedom to improve: a refactoring showcase, then a turn.
      duo.lamp(mark('verse-5-7', 'private') + 0.1, 'red').face('code', line('verse-5-7').start, 'happy');
      duo.tidy(line('verse-5-7').start, 0, 0.8);
      duo.lamp(mark('verse-5-8', 'give'), 'green');
      duo.showcase(mark('verse-5-8', 'give'), { until: mark('verse-5-8', 'improve') - 0.1 });
      duo.twirl(mark('verse-5-8', 'improve'), { dur: 1.0 });
    }

    // ----------------------------------------------------------------
    // Verse 6: which cases to test — sizes, bounds, bad inputs, promises
    // ----------------------------------------------------------------

    function verse6() {
      badge('Verse 6 · Choosing test cases', 'verse-6');
      const duo = couple;
      duo.place(start('verse-6') - 0.3, SPOT.side, 1.4);
      duo.hold(start('verse-6'), { pose: 'frame' });
      duo.waltz(start('verse-6') + 0.3, end('verse-6') - 0.3, { travel: 8, roam: 14 });
      duo.lamp(mark('verse-6-4', 'bugs'), 'red').lamp(line('verse-6-5').start, 'idle').lamp(mark('verse-6-8', 'whole'), 'green');

      // Empty, one, several: different cases take the floor.
      const a = kit.scene(content, start('verse-6'), line('verse-6-3').start - 0.1);
      const cases = [
        { x: 90, label: 'empty', items: [], at: mark('verse-6-1', 'empty'), test: 'test_pop_empty' },
        { x: 290, label: 'one', items: [7], at: mark('verse-6-1', 'one'), test: 'test_pop_one' },
        { x: 490, label: 'several', items: [1, 2, 3], at: mark('verse-6-1', 'several'), test: 'test_pop_many' },
      ];
      for (const spec of cases) {
        const col = tdd.stack(a, { x: spec.x, y: 118, slots: 3, at: spec.at, label: spec.label });
        spec.items.forEach((value, i) => col.push(spec.at + 0.1 + i * 0.12, value));
        tdd.note(a, spec.test, { x: spec.x - 50, y: 312, at: spec.at + 0.3, tone: 'cyan', iconName: 'check' });
        tween(col.node, [{ translate: '0 0' }, { translate: '0 -10px' }, { translate: '0 0' }], mark('verse-6-2', 'floor') + cases.indexOf(spec) * 0.15, 0.5, EASE.out);
      }

      // Bounds and either side: where off-by-one bugs hide.
      const b = kit.scene(content, line('verse-6-3').start - 0.1, line('verse-6-5').start - 0.1);
      const lineArt = tdd.numberLine(b, {
        x: 40, y: 260, w: 580, from: 0, to: 11, valid: [1, 10], label: 'valid: 1–10 cups of tea', at: mark('verse-6-3', 'test'),
        pins: [
          { value: 1, at: mark('verse-6-3', 'bounds'), verdict: 'accept' },
          { value: 10, at: mark('verse-6-3', 'bounds') + 0.1, verdict: 'accept' },
          { value: 0, at: mark('verse-6-3', 'either'), verdict: 'reject' },
          { value: 2, at: mark('verse-6-3', 'either') + 0.08, verdict: 'accept' },
          { value: 9, at: mark('verse-6-3', 'side'), verdict: 'accept' },
          { value: 11, at: mark('verse-6-3', 'side') + 0.08, verdict: 'reject' },
        ],
      });
      tdd.code(b, {
        x: 60, y: 100, w: 440, title: 'tea.py', tone: 'red', at: line('verse-6-3').start,
        lines: ['if 1 <= cups < 10:   # rejects 10!'],
      }).mark(0, mark('verse-6-4', 'one'), line('verse-6-5').start, 'bad');
      tdd.bug(b, { x: 40 + lineArt.xOf(10) - 22, y: 352, size: 44, at: mark('verse-6-4', 'bugs'), rotate: -10 });

      // Bad inputs as well as good, and the response each one should get.
      const c = kit.scene(content, line('verse-6-5').start - 0.1, end('verse-6'));
      const orders = [
        { text: '“−1 cups of tea”', reply: 'Invalid input', tone: 'red', at: line('verse-6-5').start },
        { text: '“qwertyuiop cups”', reply: 'Invalid input', tone: 'red', at: line('verse-6-5').start + 0.15 },
        { text: '“2 cups of tea”', reply: '☕ ☕ served', tone: 'green', at: line('verse-6-5').start + 0.3 },
      ];
      orders.forEach((order, i) => {
        tdd.bubble(c, { x: 40, y: 72 + i * 84, w: 250, text: order.text, at: order.at, tone: 'code', size: 17 });
        tdd.note(c, order.reply, { x: 320, y: 84 + i * 84, at: order.at + 0.3, tone: order.tone === 'red' ? 'gold' : 'green', iconName: 'check' });
      });

      // "It didn't crash" is not a check: assert the whole promise.
      const d = kit.scene(content, line('verse-6-7').start - 0.3, end('verse-6'), { exit: 'fade' });
      tdd.code(d, { x: 40, y: 330, w: 210, title: 'checks nothing', tone: 'red', at: line('verse-6-7').start - 0.3, lines: ['order_tea(2)'] });
      tdd.code(d, {
        x: 266, y: 330, w: 370, title: 'checks the result', tone: 'green', at: line('verse-6-7').start - 0.3,
        lines: ['assert order_tea(2).total == 8.00'],
      }).mark(0, mark('verse-6-8', 'whole'), end('verse-6'), 'good');
    }

    // ----------------------------------------------------------------
    // Verse 7: automated, fast, often, isolated, repeatable — not flaky
    // ----------------------------------------------------------------

    function verse7() {
      badge('Verse 7 · Fast, isolated, repeatable', 'verse-7');
      const duo = couple;
      duo.place(start('verse-7') - 0.3, SPOT.side, 1.4);
      duo.hold(start('verse-7'), { pose: 'frame' }).lamp(start('verse-7'), 'green');
      duo.waltz(start('verse-7') + 0.3, end('verse-7') - 0.2, { travel: 10, roam: 14 });

      const a = kit.scene(content, start('verse-7'), line('verse-7-3').start - 0.1);
      tdd.ciBadge(a, { x: 120, y: 120, at: mark('verse-7-1', 'automate'), states: [{ at: 0, status: 'pass' }] });
      tdd.stopwatch(a, { x: 380, y: 100, at: mark('verse-7-1', 'quick'), seconds: '0.03 s', spinFrom: mark('verse-7-1', 'quick') });
      tdd.runs(a, {
        x: 50, y: 230, w: 560, label: 'Run them often', at: start('verse-7') + 0.2,
        ticks: [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.92].map((x, i) => ({ x, at: start('verse-7') + 0.3 + i * 0.12, status: 'pass' })),
      });
      tdd.runs(a, {
        x: 50, y: 330, w: 560, label: 'Only when done', at: start('verse-7') + 0.3,
        ticks: [{ x: 0.92, at: mark('verse-7-1', 'quick'), status: 'fail', label: 'Late feedback' }],
      });

      // A fresh, clean start for every test, in any order.
      const b = kit.scene(content, line('verse-7-3').start - 0.1, line('verse-7-5').start - 0.1);
      tdd.note(b, 'Fresh stack for each test', { x: 60, y: 120, at: line('verse-7-3').start, tone: 'green', iconName: 'sparkle' });
      const order = [['test_push', 'test_pop'], ['test_pop', 'test_push']];
      order.forEach((names, k) => {
        const shown = line('verse-7-3').start + k * 0.15;
        tdd.suite(b, {
          x: 40 + k * 300, y: 190, w: 280, title: k ? 'shuffled order' : 'in order', at: shown,
          tests: names.map((name) => ({ name, states: [{ at: shown + 0.3, status: 'pass' }] })),
        });
      });

      // Same code, inputs, and setup: the same result every run.
      const c = kit.scene(content, line('verse-7-5').start - 0.1, line('verse-7-7').start - 0.1);
      tdd.note(c, 'same code · same inputs · same setup', { x: 60, y: 130, at: mark('verse-7-5', 'same'), tone: 'cyan', size: 20 });
      ['Run 1', 'Run 2', 'Run 3'].forEach((text, i) => {
        const shown = line('verse-7-5').start + i * 0.15;
        tdd.suite(c, { x: 40 + i * 198, y: 230, w: 186, title: text, at: shown, tests: [{ name: 'test_pop', states: [{ at: shown + 0.2, status: 'pass' }] }] });
      });

      // Flaky tests flip without a change, and real warnings drown.
      const d = kit.scene(content, line('verse-7-7').start - 0.1, end('verse-7'), { exit: 'fade' });
      const flipStates = [];
      for (let t = mark('verse-7-7', 'flaky'); t < end('verse-7'); t += 1) flipStates.push({ at: t, status: flipStates.length % 2 ? 'pass' : 'fail' });
      tdd.suite(d, { x: 60, y: 76, w: 380, title: 'no code changed', at: mark('verse-7-7', 'when'), tests: [{ name: 'test_checkout', note: 'flaky', states: flipStates }] });
      props.noise(d, { x: 40, y: 176, w: 580, h: 270, at: line('verse-7-7').start + 0.3, riseAt: mark('verse-7-8', 'drown'), sinkAt: mark('verse-7-8', 'warnings') });
      // Test's lamp flickers with the flaky test; Code can't trust it.
      flipStates.forEach(({ at, status }) => duo.lamp(at, status === 'pass' ? 'green' : 'red'));
      duo.hold(line('verse-7-7').start, { pose: 'stand', dur: 0.6 });
      duo.face('code', mark('verse-7-7', 'flaky'), 'worried');
    }

    // ----------------------------------------------------------------
    // Verse 8: a bug slips through — reproduce it, fix it, keep the test
    // ----------------------------------------------------------------

    function verse8() {
      badge('Verse 8 · Regression tests', 'verse-8');
      const duo = couple;
      duo.place(start('verse-8') - 0.3, SPOT.side, 1.4);
      duo.hold(start('verse-8'), { pose: 'frame' }).face('code', mark('verse-8-1', 'bug'), 'worried');
      duo.lamp(mark('verse-8-2', 'fail'), 'red').lamp(mark('verse-8-4', 'rest'), 'green').face('code', mark('verse-8-4', 'rest'), 'joy');
      duo.waltz(start('verse-8') + 0.3, line('verse-8-6').start - 0.3, { travel: 8, roam: 14 });

      // Reproduce, fix, rerun: the failing test, the fix, and one terminal
      // with both runs stay up together, so each can be read in turn.
      const rerunEnd = line('verse-8-5').end;
      const a = kit.scene(content, start('verse-8'), rerunEnd);
      // One fence of tests for the whole story: the gap closes when the new test is kept.
      const fence = props.fence(content, { x: 24, y: 96, names: ['test_push', 'test_pop', '', 'test_peek'], gap: 2, closeAt: mark('verse-8-3', 'keep'), closeName: 'test_empty_pop', at: start('verse-8'), until: rerunEnd });
      fence.slipThrough(mark('verse-8-1', 'bug'));
      tdd.code(a, {
        x: 248, y: 92, w: 392, title: 'the test: what you saw', tone: 'red', at: mark('verse-8-1', 'test'),
        lines: ['with pytest.raises(EmptyStackError):', '    MyStack().pop()'],
      });
      tdd.code(a, {
        x: 248, y: 92 + cardHeight(2) + 8, w: 392, title: 'the fix', tone: 'green', at: mark('verse-8-3', 'then') - 0.2,
        lines: ['def pop(self):', { text: '    if self.is_empty():', at: mark('verse-8-3', 'then') + 0.2, tone: 'add' }, { text: '        raise EmptyStackError()', at: mark('verse-8-3', 'fix'), tone: 'add' }],
      });
      tdd.pytest(a, {
        x: 248, y: 92 + cardHeight(2) + 8 + cardHeight(3) + 8, w: 392, at: mark('verse-8-2', 'watch'),
        runs: [
          { at: mark('verse-8-2', 'watch'), dots: '....F', summary: '1 failed, 4 passed' },
          { at: mark('verse-8-4', 'run') - 0.3, dots: '.....', summary: '5 passed' },
        ],
      });

      // Regression tests repeat the score and guard what worked before.
      const c = kit.scene(content, rerunEnd - 0.2, end('verse-8'), { exit: 'fade' });
      props.staff(c, { x: 30, y: 104, w: 600, at: rerunEnd, loopFrom: mark('verse-8-5', 'repeat'), bars: ['test_push', 'test_pop', 'test_peek', 'test_empty_pop'] });
      // "They guard what worked before": Test stands guard in front of Code
      // and stops a bug that creeps in from the left.
      duo.hold(mark('verse-8-6', 'they'), { pose: 'frame' }).lamp(mark('verse-8-6', 'they'), 'green');
      duo.pose('test', mark('verse-8-6', 'guard'), 'stopL', { dur: 0.25 });
      const intruder = tdd.bug(c, { x: 560, y: 400, size: 44, at: mark('verse-8-6', 'what'), rotate: 90, from: [-40, 400], until: mark('verse-8-6', 'before') + 0.4 });
      tween(intruder, { translate: '-150px 0' }, mark('verse-8-6', 'before'), 0.4, EASE.out);
    }

    // ----------------------------------------------------------------
    // Bridge: the test pyramid, and what tests cannot do
    // ----------------------------------------------------------------

    function bridge() {
      badge('Bridge · The test pyramid', 'bridge');
      const s0 = start('bridge');
      // While the pyramid is laid, the couple waltzes small in the far
      // corner; it comes forward for the solos, then lights the bugs.
      const duo = couple;
      duo.place(s0 - 0.3, { x: 866, y: 456, scale: 0.72 }, 1.8);
      duo.hold(s0, { pose: 'frame' }).lamp(s0, 'idle');
      duo.waltz(s0 + 0.4, mark('bridge-6', 'fine') - 0.9, { travel: 8, roam: 10 });
      const pyramidUntil = line('bridge-7').start - 0.1;
      const pyr = tdd.pyramid(content, {
        x: 12, y: 96, at: s0, until: pyramidUntil,
        tiers: [
          { label: 'Unit', scope: 'one small part', kind: 'unit', courses: 3, brick: 23, at: mark('bridge-1', 'unit') },
          { label: 'Integration', scope: 'parts together', kind: 'link', courses: 2, brick: 40, lay: 0.05, at: mark('bridge-3', 'integration') },
          { label: 'End-to-end', scope: 'whole user flow', kind: 'window', courses: 1, at: mark('bridge-5', 'end') },
        ],
      });
      pyr.light(0, mark('bridge-1', 'unit'), line('bridge-3').start);
      pyr.light(1, mark('bridge-3', 'integration'), line('bridge-5').start);
      pyr.light(2, mark('bridge-5', 'end'), pyramidUntil);
      // A gold connector ties each sung tier to its example on the right.
      kit.flow(content, { from: pyr.anchor(0), to: [474, 190], bend: -40, color: 'gold', at: mark('bridge-1', 'check'), until: line('bridge-3').start - 0.2 });
      kit.flow(content, { from: pyr.anchor(1), to: [456, 236], bend: -14, color: 'gold', at: mark('bridge-3', 'parts'), until: line('bridge-5').start - 0.2 });
      kit.flow(content, { from: pyr.anchor(2), to: [464, 160], bend: -20, color: 'gold', at: mark('bridge-5', 'whole'), until: mark('bridge-6', 'fine') - 0.1 });

      // Unit: one small part — the stack.
      const a = kit.scene(content, s0, line('bridge-3').start - 0.2);
      tdd.code(a, { x: 480, y: 96, w: 420, title: 'a unit test', at: mark('bridge-1', 'check'), lines: ['def test_push(stack):', '    stack.push(3)', '    assert not stack.is_empty()'] });
      const unit = tdd.stack(a, { x: 650, y: 276, slots: 3, at: mark('bridge-2', 'stacks'), label: 'MyStack' });
      unit.push(mark('bridge-2', 'useful'), 3);

      // Integration: two parts that each pass their unit tests turn alone,
      // connect, and jam when the integration test turns them together.
      const b = kit.scene(content, line('bridge-3').start - 0.2, line('bridge-5').start - 0.2);
      props.gears(b, {
        x: 380, y: 72, at: line('bridge-3').start, names: ['Editor', 'UndoHistory'],
        aloneAt: [mark('bridge-3', 'integration') + 0.2, mark('bridge-3', 'parts')],
        connectAt: mark('bridge-3', 'connect') - 0.2, turnAt: mark('bridge-4', 'work'), jamAt: mark('bridge-4', 'expect'),
      });

      // End to end: the whole user flow, through the real interface.
      const c = kit.scene(content, line('bridge-5').start - 0.2, line('bridge-7').start - 0.1);
      props.browser(c, {
        x: 470, y: 76, w: 450, at: mark('bridge-5', 'end'),
        steps: [
          { text: 'type “hi”', iconName: 'pencil', at: mark('bridge-5', 'whole') },
          { text: 'click Undo', iconName: 'pointer', at: mark('bridge-5', 'user') },
          { text: 'text is gone', iconName: 'eye', at: mark('bridge-5', 'flow') },
        ],
      });
      // "Each part works fine solo, but solo steps aren't the whole show":
      // they come forward, part for a solo each, then join for the show.
      const show = duo;
      show.place(mark('bridge-6', 'fine') - 1.2, { x: 700, y: 456, scale: 0.9 }, 1.2);
      show.hold(mark('bridge-6', 'fine') - 0.3, { release: true, pose: 'stand', dur: 0.4 });
      show.step('test', mark('bridge-6', 'fine') - 0.2, -46, 0.6).step('code', mark('bridge-6', 'fine') - 0.2, 46, 0.6);
      show.pose('test', mark('bridge-6', 'fine'), 'solo').pose('code', mark('bridge-6', 'solo'), 'spotlight', { armL: { sh: 40, el: 30 } });
      tdd.note(c, 'solo ✓', { x: 440, y: 412, at: mark('bridge-6', 'solo'), until: mark('bridge-6', 'whole'), tone: 'green' });
      tdd.note(c, 'solo ✓', { x: 836, y: 412, at: mark('bridge-6', 'steps'), until: mark('bridge-6', 'whole'), tone: 'green' });
      show.step('test', mark('bridge-6', 'whole'), 0, 0.6).step('code', mark('bridge-6', 'whole'), 0, 0.6);
      show.hold(mark('bridge-6', 'show'), { pose: 'flourish' }).twirl(mark('bridge-6', 'show') + 0.3, { dur: 1.2 });

      // Tests reveal the bugs they shine on; they cannot prove there are none.
      const d = kit.scene(content, line('bridge-7').start - 0.1, line('bridge-9').start - 0.2, { exit: 'fade' });
      // Test's lamp lights the bugs it shines on; beyond the beam, more wait.
      // The couple stands at the side again and the beam shines left.
      const seeker = duo;
      seeker.place(line('bridge-7').start - 0.6, { x: 812, y: 456, scale: 1.0 }, 1.0);
      seeker.hold(line('bridge-7').start - 0.3, { pose: 'frame' });
      seeker.lamp(line('bridge-7').start, 'idle').pose('test', mark('bridge-7', 'reveal'), 'pointL');
      seeker.face('code', mark('bridge-8', 'cannot'), 'worried');
      // A gentle sway in place keeps the beam on Test's lamp.
      seeker.waltz(line('bridge-7').start + 0.4, line('bridge-9').start - 0.8, { travel: 0, roam: 0, calm: 0.35 });
      const lampX = 812 - 20 - 33;
      props.beam(d, {
        x: lampX - 506, y: 242, w: 506, h: 196, mirror: true, at: mark('bridge-7', 'tests'), darkAt: mark('bridge-8', 'cannot'),
        bugsIn: [[470, 360, mark('bridge-7', 'bugs')], [340, 398, mark('bridge-7', 'bugs') + 0.3], [250, 320, mark('bridge-7', 'see')]],
      });
      const dijkstra = tdd.panel(d, { x: 40, y: 60, w: 400, title: 'Edsger W. Dijkstra', iconName: 'chat', at: line('bridge-7').start + 0.3 });
      const quote = kit.el('div', 'tdd-quote is-staged', dijkstra.body, 'Program testing can be used to show the presence of bugs, but never to show their absence!');
      fx.fadeIn(quote, line('bridge-7').start + 0.5, 0.4);

      // Learn the rules, then judge: not every task is Test's to lead.
      const e = kit.scene(content, line('bridge-9').start - 0.2, end('bridge'), { exit: 'fade' });
      duo.place(line('bridge-9').start - 0.6, { x: 540, y: 456, scale: 0.8 }, 1.2);
      duo.waltz(line('bridge-9').start, end('bridge') - 0.4, { travel: 8, roam: 10 });
      const rules = tdd.panel(e, { x: 50, y: 108, w: 420, title: 'The three rules', iconName: 'list', at: line('bridge-9').start });
      ['1 · a failing test first', '2 · only enough test to fail', '3 · only enough code to pass'].forEach((text, i) => {
        const row = kit.el('div', 'tdd-rule is-staged', rules.body, text);
        fx.fadeIn(row, line('bridge-9').start + i * 0.15, 0.2);
      });
      tdd.note(e, 'not a dogma', { x: 260, y: 262, at: mark('bridge-9', 'judge'), tone: 'gold', iconName: 'warning' });
      props.moonshot(e, { x: 640, y: 92, at: mark('bridge-10', 'not'), towerAt: mark('bridge-10', 'not'), rocketAt: mark('bridge-10', 'theirs') });
      const tasks = [
        { text: 'stack logic', who: 'Test leads', tone: 'green', at: line('bridge-9').start + 0.5 },
        { text: 'image recognition', who: 'measure accuracy', tone: 'cyan', at: line('bridge-9').start + 0.7 },
      ];
      tdd.note(e, 'Taller towers cannot reach the moon', { x: 636, y: 420, at: line('bridge-10').start, tone: 'white', iconName: 'warning', size: 15 });
      tasks.forEach((task, i) => tdd.note(e, `${task.text}: ${task.who}`, { x: 60, y: 312 + i * 34, at: task.at, tone: task.tone, iconName: i ? 'pin' : 'check', size: 15 }));
    }

    // ----------------------------------------------------------------
    // Outro: tests as living examples; Test takes Code's hand
    // ----------------------------------------------------------------

    function outro() {
      const s0 = start('outro');
      const a = kit.scene(content, s0, line('outro-3').start - 0.15);
      tdd.code(a, {
        x: 40, y: 80, w: 470, title: 'tests/test_stack.py · read me tomorrow', tone: 'green', at: mark('outro-1', 'tests'),
        lines: [
          { text: 'def test_new_stack_is_empty():', at: mark('outro-1', 'show') },
          { text: 'def test_push_makes_it_non_empty():', at: mark('outro-1', 'tomorrow') },
          { text: 'def test_pop_returns_the_last_push():', at: mark('outro-1', 'what') },
          { text: 'def test_pop_on_empty_raises():', at: mark('outro-1', 'meant') },
        ],
      });
      student?.appear({ from: mark('outro-1', 'tomorrow') - 0.2, to: line('outro-3').start - 0.3, x: 610, y: 90, scale: 0.86 });
      // The couple waltzes beside the living documentation, out of the hero's way.
      couple.place(s0 - 0.4, { x: 524, y: 456, scale: 0.86 }, 1.4);
      couple.hold(s0, { pose: 'frame' }).waltz(s0 + 0.3, line('outro-3').start - 0.6, { travel: 8, roam: 0 });
      tdd.note(a, 'living documentation', { x: 60, y: 250, at: mark('outro-2', 'living'), tone: 'green', iconName: 'check' });
      const thought = kit.el('div', 'tdd-bubble tdd-bubble--green tdd-bubble--thought is-staged', a, 'Ah, that makes sense!');
      fx.fadeIn(thought, mark('outro-2', 'living'), 0.35);
      fx.fadeOut(thought, line('outro-3').start - 0.6, 0.3);

      const b = kit.scene(content, line('outro-3').start - 0.15, song.duration, { exit: 'fade' });
      kit.kinetic(b, [
        { text: 'Test-driven', at: mark('outro-3', 'test'), color: 'gold' },
        { text: 'development', at: mark('outro-3', 'development') },
      ], { y: 60, size: 46, until: line('outro-6').start - 0.2 });
      const xs = { red: 320, green: 480, refactor: 640 };
      const tiles = props.floorTiles(b, { y: 446, xs, rx: 78, at: mark('outro-3', 'test') });
      // Centre stage: they part, then Test takes Code's hand again.
      const duo = couple;
      duo.place(line('outro-3').start - 0.5, { x: 480 + 20 * 1.12, y: 446, scale: 1.12 }, 1.2);
      duo.hold(mark('outro-3', 'test') - 0.2, { release: true, pose: 'stand', dur: 0.5 });
      duo.step('test', mark('outro-3', 'test'), -60, 0.8).step('code', mark('outro-3', 'test'), 60, 0.8);
      duo.waltz(mark('outro-3', 'test') + 0.6, mark('outro-4', 'takes') - 0.2, { travel: 0, roam: 0, calm: 0.4 });
      duo.step('test', mark('outro-4', 'takes'), 0, 0.6).step('code', mark('outro-4', 'takes'), 0, 0.6);
      duo.hold(mark('outro-4', 'hand'), { pose: 'frame' });
      // "One, two, three": they move to the red tile, then glide across all
      // three tiles in one continuous move, passing each as it is counted.
      duo.place(mark('outro-4', 'hand') + 0.2, { x: xs.red }, 1.0);
      duo.place(mark('outro-5', 'one') + 0.1, { x: xs.refactor }, mark('outro-5', 'three') - mark('outro-5', 'one') + 0.1);
      const counts = [['one', 'red', '1'], ['two', 'green', '2'], ['three', 'refactor', '3']];
      counts.forEach(([word, phase, digit], i) => {
        const at = mark('outro-5', word);
        tiles.light(phase, at, line('outro-6').start + 0.4);
        const num = kit.place(kit.el('div', `tdd-count tdd-count--${phase} is-staged`, b, digit), xs[phase] - 22, 112);
        fx.slam(num, at, { from: 2 });
        fx.fadeOut(num, line('outro-6').start + 0.2, 0.3);
        if (i === 0) duo.lamp(at, 'red');
        if (i === 1) duo.lamp(at, 'green');
      });
      duo.tidy(mark('outro-5', 'two'), 0, 0.5).showcase(mark('outro-5', 'three'), { until: line('outro-6').start - 0.1 });
      duo.place(line('outro-6').start, { x: 480 }, 1.0);
      tdd.todo(b, {
        x: 40, y: 64, w: 300, title: 'Test list', at: mark('outro-6', 'the'), until: line('outro-7').start - 0.2,
        items: [
          { text: 'pop() on an empty stack', at: line('outro-6').start - 1, doneAt: mark('outro-6', 'the') },
          { text: 'push many, pop in order', at: line('outro-6').start - 1, focusAt: mark('outro-6', 'next'), focusUntil: line('outro-7').start },
          { text: 'peek()', at: line('outro-6').start - 1, doneAt: mark('outro-6', 'small') },
        ],
      });
      duo.hold(line('outro-6').start, { pose: 'frame', dur: 0.6 });
      duo.waltz(mark('outro-6', 'next'), mark('outro-7', 'let') - 0.2, { travel: 10, roam: 14 });
      kit.kinetic(b, [
        { text: 'Let the tests', at: mark('outro-7', 'let') },
        { text: 'lead', at: mark('outro-7', 'lead'), color: 'gold' },
      ], { y: 70, size: 56 });
      duo.place(line('outro-7').start - 0.4, { scale: 1.04 }, 0.8);
      duo.lamp(mark('outro-7', 'lead'), 'green').dip(mark('outro-7', 'lead'), { dur: 0.7 });
      duo.rise(mark('outro-7', 'lead') + 2.2, 0.6).hold(mark('outro-7', 'lead') + 2.9, { release: true, pose: 'stand' }).bow(mark('outro-7', 'lead') + 3.2);
      // After the narrated bow, a final supported dip holds through the credit.
      duo.finale(mark('outro-7', 'lead') + 5.1);
      const credit = kit.el('div', 'end-credit is-staged', b, 'SE Book · Test-Driven Development');
      credit.style.top = '138px';
      fx.fadeIn(credit, mark('outro-7', 'lead') + 1.4, 0.6);
    }

    intro();
    verse1();
    verse2();
    chorus(1);
    verse3();
    verse4();
    chorus(2);
    verse5();
    verse6();
    verse7();
    verse8();
    bridge();
    chorus(3, { final: true });
    outro();
  };
})();
