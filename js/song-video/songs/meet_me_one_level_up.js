/*
 * Choreography for "Meet Me One Level Up", the coding-agent song
 * (storyboard: _data/songs/meet_me_one_level_up.yml; lyrics and learning
 * design: docs/meet-me-one-level-up-song-lyrics.md).
 *
 * The singer is the AI coding agent itself, a small robot in a UCLA-blue
 * hoodie (coding-agent.js), just out of training. It trains in an old
 * library (intro to the first chorus) and works in an office from verse 3,
 * the inference phase (agent-campus.js). The viewer's own SE Gym hero is
 * the "you" it sings to, at a laptop, in the scenes that speak to them.
 *
 * Teaching rule: every example is shown in full, so it teaches without the
 * slides. Verses 1–3 show how the agent was made and how it runs, under the
 * lecture's own phase strip (1 Pre-training, 2 Post-training, 3 Inference),
 * each mechanism with its consequence. Verses 4–7 show the advice:
 * requirements, why review moves up a level, design on a diagram, tests.
 * The chorus is the same picture every time (AgentKit.levels): a pile of
 * code below, and one level up Requirements, Design, and Tests, where the
 * student's thoughts and the agent's meet.
 *
 * Every visual hits a sung word: mark(lineId, word) is its time in the take.
 * Layout: 960 × 540 stage; the section badge sits top left, the agent on the
 * right (x ≈ 750–900), teaching pictures in x 40–720, and nothing essential
 * below y = 460, where the player draws captions.
 *
 * Cognitive load: the captions already carry the sung words, so a label adds
 * what the line does not say (a value, a result, a name for the picture) and
 * never repeats the line. Each label stays up long enough to read, and a
 * scene drops a picture once the song has moved past it.
 */
(function () {
  'use strict';

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.meet_me_one_level_up = function choreograph({ song, kit, layers, student }) {
    const { tween, fx, onFrame, EASE } = window.Timeline;
    const K = window.AgentKit;
    const { el, icon, highlightPython, writeCode } = kit;
    const { content, hud } = layers;
    const mark = (id, word) => song.mark(id, word);
    const line = (id) => song.line(id);
    const start = (id) => song.sectionStart(id);
    const end = (id) => song.sectionEnd(id);
    const campus = window.AgentCampus;
    const FLOOR = campus?.FLOOR ?? 452;
    const HOME = [826, FLOOR];
    const UP = [826, 266];
    // A verse that ends on its punch line keeps its picture through the next
    // verse's first words, so its last label stays up long enough to read;
    // the next verse's picture starts here instead.
    const HANDOFF = {
      'verse-2': start('verse-2') + 1.0, // its board arrives before "teacher"
      'verse-6': mark('v6-1', 'abstraction'), // its diagram arrives at "diagram"
    };

    // ----------------------------------------------------------------
    // The agent: one robot all song; scenes add its moves as they go.
    // ----------------------------------------------------------------

    const BOT = { route: [], moves: [], faces: [], holds: [] };
    const go = (t, [x, y]) => BOT.route.push([t, x, y]);
    const move = (t, name, options = {}) => BOT.moves.push([t, name, options]);
    const face = (t, expression, hold) => BOT.faces.push([t, expression, hold]);
    const hold = (t, side, prop) => BOT.holds.push([t, side, prop]);

    function badge(text, sectionId) {
      kit.badge(hud, text, start(sectionId), end(sectionId));
    }

    /**
     * The student at a laptop, the "you" of the song, from `from` to `to`;
     * with `rise` = { at, x, y }, they glide there with the agent, arriving at `at`.
     */
    function you(from, to, x = 8, y = 236, scale = 0.62, rise) {
      const move = rise && { at: rise.at - 0.8, duration: 0.8, x: rise.x, y: rise.y, scale: rise.scale ?? scale };
      student?.appear({ from, to, x, y, scale, move });
      return [x + 130 * scale, y + 110 * scale];
    }

    // ----------------------------------------------------------------
    // Intro: just finished training
    // ----------------------------------------------------------------

    function intro() {
      badge('Intro', 'intro');
      const leave = end('intro');
      const s = kit.scene(content, 0.2, leave, { exit: 'fade' });
      // While the riff plays: the title on a library card.
      const title = K.card(s, { x: 150, y: 120, w: 540, tone: 'paper', kicker: 'A song about coding with AI agents', title: 'Meet Me One Level Up', iconName: 'sparkle', at: 0.3, until: mark('intro-1', 'finished') - 0.15, how: 'rise', className: 'ak-title-card' });
      K.row(title.body, 'CS 35L · Software Construction', { className: 'ak-row--small' });
      // "Hi! I just finished training."
      // The phases are named in verse 1, where the phase strip explains them.
      const trained = K.card(s, { x: 170, y: 150, w: 500, tone: 'paper', title: 'Training complete', iconName: 'check', at: mark('intro-1', 'finished') - 0.15, until: mark('intro-2', 'almost') - 0.1 });
      const bar = el('div', 'ak-progress', trained.body);
      const fill = el('div', 'ak-progress-fill', bar);
      tween(fill, [{ width: '8%' }, { width: '100%' }], mark('intro-1', 'finished'), 0.7, EASE.out);
      // "I know almost everything. Except your project." The misplaced genius:
      // it knows the world's code and none of yours.
      const known = K.card(s, { x: 150, y: 96, w: 540, tone: 'paper', kicker: 'What I know', title: 'Almost everything', iconName: 'book', at: mark('intro-2', 'almost') - 0.1, until: mark('intro-3', 'great') - 0.2 });
      const topics = K.row(known.body, '', { className: 'ak-topics', at: mark('intro-2', 'everything') - 0.1 });
      for (const topic of ['Python', 'JavaScript', 'C++', 'SQL', 'Git']) el('span', 'ak-topic', topics, `${topic} ✓`);
      K.row(known.body, 'Your project ✗ never seen it', { className: 'ak-row--no ak-row--big', at: mark('intro-2', 'except') });
      // "So let's see how we can do great things together." No words on
      // screen: the agent turns to you, and the riff gives a breath.
      const together = mark('intro-3', 'see');
      const [youX, youY] = you(together - 0.4, leave - 0.1, 30, 200, 0.74);
      // The agent glides in, greets you, brags, and then finds your project.
      go(0.9, HOME);
      move(mark('intro-1', 'hi'), 'wave', { hold: 1.0 });
      face(mark('intro-1', 'hi'), 'happy', 1.4);
      move(mark('intro-1', 'finished'), 'cheer', { hold: 0.8 });
      move(mark('intro-2', 'know'), 'lecture', { hold: 1.1 });
      face(mark('intro-2', 'know'), 'smug', 1.2);
      move(mark('intro-2', 'except'), 'lost', { hold: 1.4 });
      face(mark('intro-2', 'except'), 'confused', 1.6);
      move(together, 'offer', { to: [youX + 60, youY], hold: 2.4 });
      face(mark('intro-3', 'great'), 'love', 1.8);
    }

    // ----------------------------------------------------------------
    // Verse 1: Pre-training
    // ----------------------------------------------------------------

    function verse1() {
      badge('Verse 1 · Pre-training', 'verse-1');
      const leave = end('verse-1');
      const swap = line('v1-4').start - 0.15;
      const s = kit.scene(content, start('verse-1'), swap, { exit: 'fade' });
      // The lecture's three phases, lit as the song reaches each one.
      K.phaseStrip(hud, { at: start('verse-1') + 0.1, until: end('pre-chorus'), lit: [[start('verse-1'), 0], [line('v2-1').start - 0.3, 1]] });
      // "Pre-training hid the next token and asked me what was there."
      const book = K.card(s, { x: 50, y: 72, w: 440, tone: 'paper', kicker: 'Pre-training · the training data', title: 'Hide the next token, then guess it', iconName: 'book', at: start('verse-1') + 0.1, how: 'drop' });
      const src = el('div', 'ak-code', book.body);
      writeCode(el('div', 'ak-code-line', src), highlightPython('def add(a, b):'));
      const l2 = el('div', 'ak-code-line', src);
      writeCode(l2, highlightPython('    return a + '));
      const gap = el('span', 'ak-gap', l2);
      const hid = mark('v1-1', 'hid'), asked = mark('v1-1', 'asked'), guessed = mark('v1-2', 'guessed'), checked = mark('v1-2', 'checked');
      K.states(gap, [[hid, 'covered'], [asked, 'covered'], [guessed, 'guess'], [checked + 0.3, 'answer']]);
      onFrame((t) => {
        const text = t < hid ? 'b' : t < asked ? 'next token' : t < guessed ? '?' : 'b';
        if (gap.textContent !== text) gap.textContent = text;
      });
      K.pill(s, 'guess: b (90%)', { x: 508, y: 130, tone: 'soft', iconName: 'sparkle', at: guessed, until: swap });
      K.pill(s, 'real file: b', { x: 508, y: 180, tone: 'green', iconName: 'check', at: checked + 0.3, until: swap });
      // "… and tuned my weights with care."
      const tuned = mark('v1-2', 'tuned');
      K.weights(s, { x: 60, y: 284, at: tuned - 0.5, nudges: [tuned + 0.1, mark('v1-2', 'care')] });
      K.pill(s, 'favor b next time', { x: 110, y: 426, tone: 'paper', at: tuned + 0.4 });
      // "I've read more code than anyone; the patterns all by heart." The
      // agent brags at its weights: the patterns live there, so no new words.
      // "But your project I've never seen, so I guess the missing part."
      const s2 = kit.scene(content, swap, HANDOFF['verse-2'], { exit: 'fade' });
      const proj = K.card(s2, { x: 50, y: 86, w: 600, tone: 'paper', kicker: 'Your project · code I never saw', title: 'send_invoice(…) has which arguments?', iconName: 'file', at: swap + 0.1 });
      const call = el('div', 'ak-code', proj.body);
      const cl = el('div', 'ak-code-line', call);
      writeCode(cl, highlightPython('send_invoice('));
      const args = el('span', 'ak-gap', cl);
      writeCode(cl, highlightPython(')'));
      const invent = mark('v1-4', 'guess');
      K.states(args, [[swap, 'covered'], [invent, 'invented']]);
      onFrame((t) => {
        const text = t < invent ? '???' : 'customer, total, "USD"';
        if (args.textContent !== text) args.textContent = text;
      });
      K.pill(s2, 'guessed, never checked', { x: 120, y: 262, tone: 'red', iconName: 'warning', at: invent + 0.1 });
      // The agent reads, guesses, and admits the invention.
      move(mark('v1-1', 'token'), 'read', { hold: 1.4 });
      hold(start('verse-1') + 0.2, 'left', 'book');
      hold(mark('v1-1', 'asked') + 0.6, 'left', null);
      move(asked, 'think', { hold: 1.2 });
      face(asked, 'thinking', 1.4);
      move(guessed, 'point', { to: [440, 196], hold: 0.9 });
      face(checked + 0.3, 'happy', 1.2);
      move(tuned, 'nod');
      move(mark('v1-3', 'read'), 'lecture', { hold: 1.4 });
      face(mark('v1-3', 'read'), 'smug', 1.8);
      move(mark('v1-3', 'patterns'), 'present', { to: [230, 330], hold: 1.2 });
      move(mark('v1-4', 'project'), 'lost', { hold: 1.4 });
      face(mark('v1-4', 'project'), 'confused', 1.8);
      move(invent, 'scratch', { hold: 1.4 });
      face(invent, 'sheepish', 1.8);
    }

    // ----------------------------------------------------------------
    // Verse 2: Post-training
    // ----------------------------------------------------------------

    function verse2() {
      badge('Verse 2 · Post-training', 'verse-2');
      const leave = end('verse-2');
      const toRL = line('v2-3').start - 0.15, toPref = line('v2-5').start - 0.15;
      // "Post-training brought a teacher with answers, task by task."
      const s = kit.scene(content, HANDOFF['verse-2'], toRL, { exit: 'fade' });
      const board = K.card(s, { x: 50, y: 74, w: 600, tone: 'board', kicker: 'Supervised fine-tuning', title: 'Tasks paired with expert answers', iconName: 'target', at: HANDOFF['verse-2'] + 0.1, how: 'drop' });
      K.row(board.body, 'Task: reverse a list  →  xs[::-1]', { className: 'ak-row--chalk', at: mark('v2-1', 'task') });
      K.row(board.body, 'Task: add up a list  →  sum(xs)', { className: 'ak-row--chalk', at: mark('v2-1', 'task_2') });
      // "Textbook problems? Aced them all! But is that what you ask?"
      K.pill(s, 'A+', { x: 420, y: 246, tone: 'green', iconName: 'sparkle', at: mark('v2-2', 'aced') - 0.1, rotate: -4 });
      const yours = K.bubble(s, 'Your task: coupons in checkout.py', { x: 90, y: 300, w: 460, tail: 'right', at: mark('v2-2', 'all') - 0.1 });
      yours.prepend(icon('question', 'ak-bubble-icon'));
      // "In Reinforcement Learning, on tasks a test could score,"
      const s2 = kit.scene(content, toRL, toPref, { exit: 'fade' });
      const rl = K.card(s2, { x: 50, y: 72, w: 600, tone: 'paper', kicker: 'Reinforcement learning', title: 'Reward = tests passed', iconName: 'chart', at: toRL + 0.1 });
      const tries = [['Try 1', 2, 'tasks'], ['Try 2', 4, 'test'], ['Try 3', 6, 'score']];
      const rows = tries.map(([name, score, word]) => {
        const r = K.row(rl.body, '', { className: 'ak-try', at: mark('v2-3', word) - 0.1 });
        el('span', 'ak-try-name', r, name);
        const meter = el('span', 'ak-try-meter', r);
        const fillNode = el('span', 'ak-try-fill', meter);
        fillNode.style.width = `${(score / 6) * 100}%`;
        el('span', 'ak-try-score', r, `${score} / 6 tests`);
        return r;
      });
      // "I learned to pass whatever's checked, not what the test is for."
      // The example shows it: code that passes every check and is still wrong.
      K.states(rows[2], [[mark('v2-4', 'pass'), 'best']]);
      const prime = K.card(s2, { x: 50, y: 330, w: 360, tone: 'code', at: mark('v2-4', 'whatevers') - 0.1 });
      K.code(prime.body, 'def is_prime(n):\n    return n % 2 == 1');
      K.pill(s2, 'passes 6 / 6 tests', { x: 430, y: 342, tone: 'green', iconName: 'check', at: mark('v2-4', 'checked') });
      K.pill(s2, 'is_prime(9) → True', { x: 430, y: 394, tone: 'red', iconName: 'cross', at: mark('v2-4', 'not') });
      // "Preference Tuning: where no test can check if it is true,
      //  people picked the smoothest talker, so I sound sure to you."
      const s3 = kit.scene(content, toPref, leave, { exit: 'fade' });
      K.pill(s3, 'Preference tuning: people pick', { x: 40, y: 70, tone: 'paper', iconName: 'user', at: toPref + 0.1 });
      const a = K.card(s3, { x: 40, y: 116, w: 330, tone: 'code', kicker: 'Answer A', title: '“Probably. Check empty lists.”', at: mark('v2-5', 'no') - 0.1 });
      K.code(a.body, 'def mean(xs):\n    if not xs: return 0\n    return sum(xs)/len(xs)', { className: 'ak-code--compact' });
      const b = K.card(s3, { x: 390, y: 116, w: 330, tone: 'code', kicker: 'Answer B', title: '“Definitely! Works for every input.”', at: mark('v2-5', 'check') - 0.1 });
      K.code(b.body, 'def mean(xs):\n    return sum(xs)/len(xs)', { className: 'ak-code--compact' });
      ['people', 'picked', 'smoothest'].forEach((word, i) => {
        const vote = K.pill(s3, '+1', { x: 392 + i * 76, y: 304, tone: 'gold', iconName: 'user', at: mark('v2-6', word) });
        vote.classList.add('ak-pill--vote');
      });
      K.pill(s3, 'Preferred', { x: 612, y: 304, tone: 'green', at: mark('v2-6', 'talker') });
      // The sure-sounding winner crashes on an empty list: sounding sure is not being right.
      K.pill(s3, 'mean([]) → ZeroDivisionError', { x: 360, y: 356, tone: 'red', iconName: 'search', at: mark('v2-6', 'so') - 0.1 });
      // The agent studies the board, aces it, meets your task, chases the score, and talks smooth.
      move(mark('v2-1', 'teacher'), 'read', { hold: 1.6 });
      hold(start('verse-2'), 'right', 'pen');
      move(mark('v2-1', 'task'), 'write', { to: [600, 200], hold: 0.9 });
      hold(mark('v2-2', 'textbook'), 'right', null);
      move(mark('v2-2', 'aced'), 'cheer', { hold: 0.8 });
      face(mark('v2-2', 'aced'), 'smug', 1.2);
      move(mark('v2-2', 'but'), 'lost', { hold: 1.2 });
      face(mark('v2-2', 'but'), 'confused', 1.6);
      move(mark('v2-3', 'score'), 'cheer', { hold: 0.7 });
      face(mark('v2-3', 'score'), 'joy', 1.2);
      move(mark('v2-4', 'whatevers'), 'point', { to: [330, 230], hold: 1.0 });
      face(mark('v2-4', 'not'), 'surprised', 1.4);
      move(mark('v2-6', 'picked'), 'point', { to: [600, 180], hold: 1.0 });
      move(mark('v2-6', 'sound'), 'lecture', { hold: 1.4 });
      face(mark('v2-6', 'talker'), 'smug', 2.4);
    }

    // ----------------------------------------------------------------
    // Pre-chorus: fast and convincing, so check
    // ----------------------------------------------------------------

    function preChorus() {
      badge('Pre-chorus', 'pre-chorus');
      const leave = end('pre-chorus');
      const s = kit.scene(content, start('pre-chorus'), leave, { exit: 'fade' });
      // "I write faster than you read, a genius, new on site."
      const write = mark('pre-1', 'write');
      const page = K.card(s, { x: 50, y: 70, w: 470, tone: 'code', title: 'checkout.py', iconName: 'code', at: start('pre-chorus') + 0.1 });
      const source = [
        'def checkout(cart, coupon):',
        '    items = sum(i.price for i in cart)',
        '    total = items - coupon.value',
        '    ship = shipping(total)',
        '    pay(total + ship)',
        '    send_receipt(cart.owner)',
        '    return total + ship',
      ].join('\n');
      K.code(page.body, source, { className: 'ak-code--compact', lineTimes: source.split('\n').map((_, i) => write + i * 0.18) });
      // The code pouring out faster than anyone reads is the picture; the
      // agent's genius pose and lost look carry "new on site".
      // "So assume I misunderstood until you've checked I'm right."
      const note = K.card(s, { x: 330, y: 318, w: 330, tone: 'note', title: 'Did I understand you?', iconName: 'question', at: mark('pre-2', 'assume') - 0.1, how: 'drop' });
      K.row(note.body, 'Assume I misunderstood.', { className: 'ak-row--small' });
      K.mark(s, true, { x: 674, y: 330, size: 44, at: mark('pre-2', 'right') });
      move(write, 'type', { hold: 2.4 });
      face(write, 'focused', 2.4);
      move(mark('pre-1', 'genius'), 'lecture', { hold: 0.9 });
      face(mark('pre-1', 'genius'), 'smug', 1.0);
      move(mark('pre-1', 'new'), 'lost', { hold: 1.0 });
      move(mark('pre-2', 'misunderstood'), 'scratch', { hold: 1.2 });
      face(mark('pre-2', 'assume'), 'sheepish', 2.0);
      move(mark('pre-2', 'checked'), 'nod');
    }

    // ----------------------------------------------------------------
    // The chorus: one level up (the same picture every time)
    // ----------------------------------------------------------------

    function chorus(prefix, sectionId, tone, { finale = false } = {}) {
      badge(finale ? 'Final chorus · One level up' : 'Chorus · One level up', sectionId);
      const from = start(sectionId), leave = end(sectionId);
      const m = (n, word) => mark(`${prefix}-${n}`, word);
      const cue = {
        up: m(1, 'level'), judge: m(2, 'judge'), req: m(3, 'requirements'), design: m(3, 'design'),
        tests: m(3, 'tests'), meet: m(3, 'thoughts') - 0.3, need: m(4, 'need'), guess: m(5, 'guess'),
        diagram: m(6, 'diagram'), pin: m(7, 'pin'),
      };
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      K.levels(s, { x: 190, y: 56, at: from + 0.1, cue, tone });
      // "Meet me one level up": you rise beside the upper level as the agent
      // does, and the two of you stand on either side of the shared cards.
      you(m(1, 'meet') - 0.3, leave - 0.1, 8, 236, 0.62, { at: cue.up, x: 26, y: 80 });
      if (finale) kit.confetti(s, { x: 450, y: 200, at: m(7, 'test'), count: 60, seed: 35 });
      // The agent rises to the upper floor, works there, and comes back down.
      go(cue.up, UP);
      go(leave - 0.15, HOME);
      move(m(1, 'meet'), 'beckon', { to: [120, 300], hold: 1.2 });
      face(m(1, 'meet'), 'joy', 1.8);
      move(cue.judge, 'shake');
      move(m(2, 'design'), 'point', { to: [440, 150], hold: 0.9 });
      move(cue.req, 'present', { to: [300, 160], hold: 2.2 });
      move(m(3, 'thoughts'), 'heart', { hold: 1.2 });
      face(m(3, 'thoughts'), 'love', 1.4);
      move(cue.need, 'point', { to: [290, 170], hold: 1.0 });
      move(cue.guess, 'nod');
      move(cue.diagram, 'present', { to: [450, 160], hold: 0.9 });
      move(cue.pin, 'tap', { to: [600, 140], hold: 0.8 });
      if (finale) {
        move(m(7, 'test') + 0.2, 'cheer', { hold: 1.6 });
        face(m(7, 'test'), 'joy', 2.4);
      }
    }

    // ----------------------------------------------------------------
    // Verse 3: Inference (the office)
    // ----------------------------------------------------------------

    function verse3() {
      badge('Verse 3 · Inference', 'verse-3');
      const from = start('verse-3'), leave = end('verse-3');
      const swap = line('v3-6').start - 0.15;
      K.phaseStrip(hud, { at: from + 0.3, until: leave, lit: [[from, 2]] });
      const s = kit.scene(content, from + 0.6, swap, { exit: 'fade' });
      // "Inference: my weights stay frozen, whatever you may say."
      const frozen = mark('v3-1', 'frozen');
      K.weights(s, { x: 56, y: 96, at: from + 0.8, frozenAt: frozen - 0.2 });
      K.bubble(s, 'Remember my style!', { x: 40, y: 238, w: 280, tail: 'up', at: mark('v3-1', 'whatever') - 0.1, until: mark('v3-2', 'context') + 0.2 });
      K.bubble(s, 'Learn this for next time!', { x: 50, y: 302, w: 300, tail: 'up', at: mark('v3-1', 'say') - 0.2, until: mark('v3-2', 'context') + 0.2 });
      K.pill(s, 'a prompt never changes the model', { x: 40, y: 380, tone: 'paper', iconName: 'lock', at: mark('v3-1', 'say') + 0.3, until: mark('v3-3', 'ask') });
      // "Your prompt adds only context to what I see today."
      const board = K.contextBoard(s, {
        x: 360, y: 74, w: 340, h: 300, at: mark('v3-2', 'prompt') - 0.2,
        items: [
          { text: 'Fix the failing test', at: mark('v3-2', 'context') },
          { text: 'read_file("cart.py")', at: mark('v3-3', 'read'), code: true },
          { text: 'cart.py: 120 lines', at: mark('v3-3', 'files') + 0.2 },
          { text: 'run_tests()', at: mark('v3-3', 'run'), code: true },
          { text: '1 test failed', at: mark('v3-3', 'tests') + 0.2, result: true },
        ],
        sweeps: [mark('v3-4', 'call'), mark('v3-4', 'everything'), mark('v3-4', 'start')],
        wipeAt: mark('v3-5', 'wiped') - 0.3,
      });
      K.pill(s, 'this session only', { x: 446, y: 392, tone: 'soft', iconName: 'calendar', at: mark('v3-2', 'today') - 0.2, until: mark('v3-4', 'and') });
      // "I ask for tools: I read your files, I run your tests." The tool
      // calls and their results land on the context board, one picture.
      // "And then each call, I reread everything from the start again."
      K.pill(s, 'each call: from item 1 again', { x: 392, y: 392, tone: 'gold', iconName: 'resend', at: mark('v3-4', 'call'), until: mark('v3-5', 'new') });
      // "But when a new session starts, my context is wiped clean."
      K.pill(s, 'next day: a new session', { x: 420, y: 392, tone: 'blue', iconName: 'calendar', at: mark('v3-5', 'new') });
      K.bubble(s, 'Who are you again?', { x: 500, y: 316, w: 220, tone: 'blue', tail: 'right', at: mark('v3-5', 'who') - 0.1, until: mark('v3-5', 'wiped') - 0.2 });
      // "Saved memories and files survive, so write down what you mean."
      const s2 = kit.scene(content, swap, leave, { exit: 'fade' });
      const memo = K.card(s2, { x: 250, y: 80, w: 320, tone: 'note', title: 'Saved memory', iconName: 'pencil', at: swap + 0.05, how: 'drop' });
      K.row(memo.body, 'When coding, use TDD.', {});
      const files = K.card(s2, { x: 250, y: 222, w: 320, tone: 'white', title: 'Files in your repo', iconName: 'folder', at: mark('v3-6', 'and') - 0.1 });
      K.row(files.body, 'spec.md   tests/   README.md', { className: 'ak-row--mono' });
      K.pill(s2, 'these survive the next session', { x: 270, y: 330, tone: 'green', iconName: 'check', at: mark('v3-6', 'files') - 0.3 });
      // "… so write down what you mean": the agent hands you its pen.
      const [youX, youY] = you(mark('v3-6', 'so') - 0.4, leave - 0.1, 14, 230, 0.62);
      // The agent freezes at "frozen", gestures off the bubbles, asks for tools.
      face(frozen, 'surprised', 1.0);
      move(mark('v3-1', 'whatever'), 'shake');
      move(mark('v3-2', 'context'), 'present', { to: [520, 150], hold: 1.2 });
      move(mark('v3-3', 'ask'), 'point', { to: [520, 220], hold: 0.8 });
      move(mark('v3-3', 'read'), 'read', { hold: 0.6 });
      move(mark('v3-3', 'run'), 'type', { hold: 0.9 });
      move(mark('v3-4', 'reread'), 'look', { dir: -1, hold: 2.2 });
      face(mark('v3-4', 'reread'), 'focused', 2.4);
      face(mark('v3-5', 'who'), 'confused', 1.4);
      face(mark('v3-5', 'wiped'), 'worried', 1.4);
      move(mark('v3-5', 'wiped'), 'shrug');
      move(mark('v3-6', 'memories'), 'present', { to: [410, 120], hold: 1.2 });
      hold(mark('v3-6', 'so') - 0.3, 'right', 'pen');
      move(mark('v3-6', 'write'), 'offer', { to: [youX + 70, youY], hold: 1.2 });
      face(mark('v3-6', 'write'), 'happy', 1.4);
      hold(leave - 0.2, 'right', null);
    }

    // ----------------------------------------------------------------
    // Verse 4: Requirements
    // ----------------------------------------------------------------

    function verse4() {
      badge('Verse 4 · Requirements', 'verse-4');
      const from = start('verse-4'), leave = end('verse-4');
      const toCart = line('v4-3').start - 0.15, toPhotos = line('v4-7').start - 0.15;
      // "When you're vague, a teammate asks, but I just guess away."
      const s = kit.scene(content, from, toCart, { exit: 'fade' });
      const note = K.card(s, { x: 50, y: 86, w: 330, tone: 'note', kicker: 'You wrote', title: 'Free shipping over $50', iconName: 'pencil', at: from + 0.1, how: 'drop' });
      // The teammate's question shows who asks; the agent strides off instead.
      const teammate = K.bubble(s, 'Before or after the coupon?', { x: 410, y: 86, w: 280, tail: 'left', at: mark('v4-1', 'asks') - 0.2 });
      teammate.prepend(icon('user', 'ak-bubble-icon'));
      // "I'll do exactly what you wrote, not what you meant to say."
      K.states(note.node, [[mark('v4-2', 'wrote'), 'lit']]);
      const meant = K.bubble(s, 'what you meant: only in your head', { x: 80, y: 312, w: 300, tail: 'up', think: true, at: mark('v4-2', 'what') - 0.2 });
      meant.classList.add('ak-bubble--faint');
      // "Free shipping over fifty: a coupon takes off ten."
      const s2 = kit.scene(content, toCart, toPhotos, { exit: 'fade' });
      const before = mark('v4-5', 'before'), other = mark('v4-5', 'other');
      K.receipt(s2, { x: 50, y: 80, w: 300, at: toCart + 0.1, couponAt: mark('v4-3', 'ten') - 0.2, shipping: [[before, 'FREE', 'free'], [other, '$5.99', 'paid']] });
      // "Before or after the coupon? You never told me when."
      K.card(s2, { x: 380, y: 80, w: 320, tone: 'white', kicker: 'Before the coupon', title: '$55 ≥ $50 → free', iconName: 'check', at: mark('v4-4', 'before') - 0.1, until: mark('v4-6', 'regeneration') });
      K.card(s2, { x: 380, y: 186, w: 320, tone: 'white', kicker: 'After the coupon', title: '$45 < $50 → $5.99', iconName: 'cross', at: mark('v4-4', 'after') - 0.1, until: mark('v4-6', 'regeneration') });
      // "This week, I might guess 'before'; next week, the other way around."
      K.pill(s2, 'Week 1: guessed “before”', { x: 60, y: 334, tone: 'soft', iconName: 'calendar', at: before - 0.1 });
      K.pill(s2, 'Week 3, regenerated: “after”', { x: 60, y: 384, tone: 'gold', iconName: 'resend', at: other - 0.1 });
      // "Regeneration keeps only the rules that you wrote down."
      const spec = K.card(s2, { x: 380, y: 96, w: 320, tone: 'white', title: 'spec.md', iconName: 'file', at: mark('v4-6', 'regeneration') + 0.1 });
      K.row(spec.body, '✓ Free shipping over $50', { className: 'ak-row--ok' });
      const lost = K.row(spec.body, '? before or after the coupon', { className: 'ak-row--ghost' });
      tween(lost, { opacity: 0 }, mark('v4-6', 'rules'), 0.9, EASE.inOut);
      // "Rename my photos by the date: all were from one day."
      const s3 = kit.scene(content, toPhotos, leave, { exit: 'fade' });
      K.pill(s3, 'You asked: “Rename my photos by their date”', { x: 50, y: 68, tone: 'paper', iconName: 'chat', at: toPhotos + 0.05 });
      const renames = [mark('v4-8', 'each'), mark('v4-8', 'same'), mark('v4-8', 'new'), mark('v4-8', 'name'), mark('v4-8', 'stayed') - 0.15];
      K.photoFolder(s3, { x: 50, y: 118, at: mark('v4-7', 'photos') - 0.1, dateAt: mark('v4-7', 'one'), renameAt: renames, restoreAt: mark('v4-10', 'saved') });
      K.pill(s3, 'all from one day: 2025-07-04', { x: 110, y: 414, tone: 'soft', iconName: 'calendar', at: mark('v4-7', 'one'), until: mark('v4-8', 'name') });
      K.pill(s3, 'same name: each one overwrote the last', { x: 60, y: 414, tone: 'red', iconName: 'copy', at: mark('v4-8', 'name') + 0.05, until: mark('v4-10', 'saved') - 0.05 });
      K.pill(s3, '1 of 212 stayed: “technically okay”', { x: 500, y: 118, tone: 'red', iconName: 'warning', at: mark('v4-8', 'one') - 0.3, until: mark('v4-9', 'real') - 0.2 });
      // "I act on your real files, so say what must never be done."
      K.pill(s3, 'real files: no undo', { x: 500, y: 118, tone: 'red', iconName: 'warning', at: mark('v4-9', 'real') - 0.1 });
      const rule = K.card(s3, { x: 510, y: 170, w: 210, tone: 'note', kicker: 'Must never happen', at: mark('v4-9', 'never') - 0.2 });
      K.row(rule.body, 'Never overwrite a file', { className: 'ak-rule', at: mark('v4-10', 'never') });
      // "'Never overwrite a file' would have saved them, every one."
      K.pill(s3, 'all 212 photos kept', { x: 140, y: 414, tone: 'green', iconName: 'check', at: mark('v4-10', 'saved') });
      // The agent guesses, then is sorry about the photos, then relieved.
      move(mark('v4-1', 'stride'), 'lecture', { hold: 0.9 });
      face(mark('v4-1', 'guess'), 'smug', 1.6);
      go(mark('v4-1', 'stride') + 0.2, [HOME[0] + 30, HOME[1]]);
      go(mark('v4-1', 'away') + 1.2, HOME);
      move(mark('v4-2', 'wrote'), 'point', { to: [250, 130], hold: 1.0 });
      move(mark('v4-3', 'coupon'), 'present', { to: [260, 170], hold: 1.0 });
      move(mark('v4-4', 'before'), 'point', { to: [600, 130], hold: 0.7 });
      move(mark('v4-4', 'after'), 'point', { to: [600, 236], hold: 0.7 });
      face(mark('v4-4', 'never'), 'worried', 1.4);
      move(mark('v4-5', 'other'), 'shrug');
      move(mark('v4-6', 'wrote'), 'tap', { to: [520, 172], hold: 0.8 });
      move(mark('v4-8', 'technically'), 'shrug');
      face(mark('v4-8', 'technically'), 'smug', 1.0);
      face(mark('v4-9', 'i'), 'worried', 1.6);
      move(mark('v4-9', 'i'), 'scratch', { hold: 1.0 });
      move(mark('v4-9', 'never'), 'point', { to: [620, 220], hold: 1.0 });
      move(mark('v4-10', 'saved'), 'heart', { hold: 1.2 });
      face(mark('v4-10', 'saved'), 'joy', 1.6);
    }

    // ----------------------------------------------------------------
    // Verse 5: why review moves one level up
    // ----------------------------------------------------------------

    function verse5() {
      badge('Verse 5 · One level up', 'verse-5');
      const from = start('verse-5'), leave = end('verse-5');
      const swap = line('v5-3').start - 0.15;
      // "Your few sentences become ten thousand lines of code."
      const s = kit.scene(content, from, swap, { exit: 'fade' });
      K.card(s, { x: 50, y: 110, w: 260, tone: 'note', kicker: 'Your prompt', title: 'Let students save a draft schedule.', iconName: 'chat', at: from + 0.1, how: 'drop' });
      const pile = K.card(s, { x: 360, y: 70, w: 330, h: 330, tone: 'code', title: 'Generated code', iconName: 'code', at: mark('v5-1', 'become') - 0.2 });
      const sheet = el('div', 'ak-pile', pile.body);
      for (let i = 0; i < 22; i++) {
        const bar = el('span', 'ak-pile-line is-staged', sheet);
        bar.style.width = `${30 + window.Timeline.hash01(i * 13 + 5) * 62}%`;
        bar.style.marginLeft = `${(i % 5) * 4}%`;
        fx.fadeIn(bar, mark('v5-1', 'become') + i * 0.07, 0.15);
      }
      const count = K.pill(s, '', { x: 380, y: 410, tone: 'gold', at: mark('v5-1', 'ten') - 0.1 });
      const thousand = mark('v5-1', 'thousand');
      onFrame((t) => {
        const n = Math.round(10000 * Math.min(1, Math.max(0, (t - (thousand - 0.6)) / 1.2)));
        const text = `${n.toLocaleString('en-US')} lines`;
        if (count.textContent !== text) count.textContent = text;
      });
      // "Be honest: will you read each line? Nope. Far too big a load." The
      // reader's crawl down the pile answers it; the agent shakes its head.
      const lens = K.pill(s, 'reading line 37 of 10,000…', { x: 380, y: 300, tone: 'white', iconName: 'search', at: mark('v5-2', 'read') - 0.1 });
      tween(lens, [{ translate: '0 0' }, { translate: '0 22px' }], mark('v5-2', 'read'), 3, EASE.linear);
      // "Compilers once wrote assembly, and people read it, too;
      //  then they reviewed just the source; now design is what we review."
      // The lens climbing the ladder is review moving one level up.
      const s2 = kit.scene(content, swap, HANDOFF['verse-6'], { exit: 'fade' });
      K.ladder(s2, {
        x: 80, y: 120, w: 520, at: swap + 0.05,
        levels: [
          { name: 'Assembly', sample: 'movl 4(%rdi), %ecx', code: true, iconName: 'chip' },
          { name: 'Source', sample: 'avg = (a + b + c + d) / 4', code: true, iconName: 'code' },
          { name: 'Design', sample: 'requirements · diagrams · tests', iconName: 'chart', at: mark('v5-4', 'design') - 0.2 },
        ],
        writers: [
          { from: 1, label: 'compiler writes', at: mark('v5-3', 'wrote') },
          { from: 2, label: 'agent writes', at: mark('v5-4', 'design') + 0.2 },
        ],
        lens: [[mark('v5-3', 'people'), 0], [mark('v5-4', 'reviewed'), 1], [mark('v5-4', 'design') + 0.1, 2]],
      });
      move(mark('v5-1', 'become'), 'present', { to: [520, 220], hold: 1.2 });
      face(mark('v5-1', 'thousand'), 'surprised', 1.2);
      move(mark('v5-2', 'honest'), 'tilt');
      face(mark('v5-2', 'honest'), 'smug', 1.2);
      move(mark('v5-2', 'nope'), 'shake');
      move(mark('v5-2', 'load'), 'shrug');
      face(mark('v5-2', 'load'), 'worried', 1.4);
      move(mark('v5-3', 'people'), 'point', { to: [600, 340], hold: 0.8 });
      move(mark('v5-4', 'source'), 'point', { to: [600, 250], hold: 0.7 });
      move(mark('v5-4', 'design'), 'beckon', { to: [600, 160], hold: 1.0 });
      face(mark('v5-4', 'design'), 'joy', 1.4);
    }

    // ----------------------------------------------------------------
    // Verse 6: design on a shared diagram
    // ----------------------------------------------------------------

    function verse6() {
      badge('Verse 6 · Design', 'verse-6');
      const from = start('verse-6'), leave = end('verse-6');
      const s = kit.scene(content, HANDOFF['verse-6'], leave, { exit: 'fade' });
      // "So let's share an abstraction, a diagram we both read."
      const lost = mark('v6-4', 'lost'), after = mark('v6-4', 'aftermath');
      const a = K.sequence(s, {
        x: 40, y: 96, w: 320, h: 300, title: 'Design A', at: mark('v6-1', 'diagram') - 0.3, until: mark('v6-6', 'write') - 0.3,
        parts: [':Checkout', ':Payments'],
        messages: [
          { from: 0, to: 1, label: 'charge($45)', at: mark('v6-1', 'diagram') },
          { from: 1, to: 0, label: 'ok', reply: true, at: mark('v6-1', 'both'), id: 'ok', lostAt: lost },
          { from: 0, to: 1, label: 'retry: charge($45)', at: after - 0.2, tone: 'bad' },
          { from: 1, to: 0, label: 'ok', reply: true, at: after + 0.2, tone: 'bad' },
        ],
      });
      // "Not every detail, just the views that answer what you need." Only
      // the chosen view says why; the others are just names to pass over.
      const viewsAt = mark('v6-2', 'views') - 0.3, viewsOut = mark('v6-3', 'hold');
      const q = K.card(s, { x: 380, y: 96, w: 320, tone: 'white', kicker: 'Your question', title: 'What if a step fails?', iconName: 'question', at: mark('v6-2', 'not'), until: viewsOut });
      const pick = [['Sequence view: order, failures', true], ['Class view', false], ['Component view', false]];
      pick.forEach(([text, chosen], i) => {
        const r = K.row(q.body, text, { className: chosen ? 'ak-view ak-view--pick' : 'ak-view', at: viewsAt + i * 0.2 });
        if (!chosen) tween(r, { opacity: 0.4 }, mark('v6-2', 'answer'), 0.4);
      });
      // "Hold it to the user story, then go past the happy path."
      const story = K.card(s, { x: 380, y: 96, w: 320, tone: 'note', kicker: 'User story', title: 'As a shopper, I want to be charged once per order.', iconName: 'user', at: viewsOut + 0.05, until: mark('v6-5', 'second') - 0.1 });
      const verdict = K.row(story.body, 'Happy path: charged once ✓', { className: 'ak-row--ok', at: mark('v6-3', 'story') + 0.2 });
      // "Trace a crash, a lost message, and follow the aftermath." The
      // story's own verdict turns to "charged twice", next to the requirement it breaks.
      const okArrow = a.arrow('ok');
      K.states(okArrow, [[lost, 'lost']]);
      K.pill(s, 'crash: reply lost', { x: 60, y: 410, tone: 'red', iconName: 'bolt', at: mark('v6-4', 'crash') - 0.1, until: mark('v6-6', 'write') - 0.3 });
      onFrame((t) => {
        const text = t < after + 0.4 ? 'Happy path: charged once ✓' : 'Lost reply: charged twice ✗';
        if (verdict.textContent !== text) verdict.textContent = text;
        verdict.classList.toggle('ak-row--no', t >= after + 0.4);
      });
      // "Ask me for a second design, and trace that design through."
      const second = mark('v6-5', 'second');
      K.sequence(s, {
        x: 380, y: 96, w: 320, h: 300, title: 'Design B', at: second - 0.1, how: 'right',
        parts: [':Checkout', ':Payments'],
        messages: [
          { from: 0, to: 1, label: 'charge, key 17', at: second + 0.2 },
          { from: 1, to: 0, label: 'ok', reply: true, lost: true, at: mark('v6-5', 'trace') },
          { from: 0, to: 1, label: 'retry, same key 17', at: mark('v6-5', 'those'), tone: 'good' },
          { from: 1, to: 0, label: 'already paid: ok', reply: true, at: mark('v6-5', 'through'), tone: 'good' },
        ],
      });
      K.pill(s, 'charged once', { x: 470, y: 410, tone: 'green', iconName: 'check', at: mark('v6-5', 'through') + 0.3 });
      // "Write in the spec which one, and why, so my next draft keeps it, too."
      const spec = K.card(s, { x: 40, y: 96, w: 320, tone: 'white', title: 'spec.md · decision', iconName: 'file', at: mark('v6-6', 'write') - 0.1, how: 'rise' });
      K.row(spec.body, 'Use Design B.', { className: 'ak-row--ok', at: mark('v6-6', 'which') });
      K.row(spec.body, 'Why: same key → charged once.', { className: 'ak-row--small', at: mark('v6-6', 'why') });
      // The agent reads the diagram with you, traces, and offers a second design.
      move(mark('v6-1', 'share'), 'present', { to: [200, 200], hold: 1.2 });
      face(mark('v6-1', 'both'), 'happy', 1.2);
      move(mark('v6-2', 'answer'), 'point', { to: [540, 156], hold: 1.0 });
      move(mark('v6-3', 'story'), 'point', { to: [540, 140], hold: 0.8 });
      move(mark('v6-4', 'trace'), 'think', { hold: 0.8 });
      move(lost, 'point', { to: [200, 240], hold: 0.8 });
      face(after, 'worried', 1.6);
      move(second, 'offer', { to: [540, 220], hold: 1.2 });
      face(second, 'curious', 1.0);
      move(mark('v6-5', 'got'), 'lecture', { hold: 0.9 });
      face(mark('v6-5', 'got'), 'smug', 1.2);
      face(mark('v6-5', 'through'), 'joy', 1.2);
      hold(mark('v6-6', 'write') - 0.4, 'right', 'pen');
      move(mark('v6-6', 'write'), 'write', { to: [500, 300], hold: 1.4 });
      hold(leave - 0.3, 'right', null);
      move(mark('v6-6', 'keeps'), 'nod');
    }

    // ----------------------------------------------------------------
    // Verse 7: tests
    // ----------------------------------------------------------------

    function verse7() {
      badge('Verse 7 · Tests', 'verse-7');
      // The finished picture stays through the instrumental before the bridge.
      const from = start('verse-7'), leave = start('bridge') - 0.2;
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      // "Write a test before I code, or let me draft a few."
      const pass = mark('v7-5', 'pass'), alone = mark('v7-5', 'alone'), caught = mark('v7-8', 'catch');
      const T = (name, given, expect, author, at, y, extra = []) => K.testCard(s, {
        x: 40, y, w: 318, name, given, expect, author, at,
        status: [[at, 'pending'], [pass, 'pass'], ...extra], lockAt: alone,
      });
      T('free_over_50', '$60.00', 'free', 'You', mark('v7-1', 'test'), 74);
      T('paid_under_50', '$30.00', '$5.99', 'Agent draft', mark('v7-1', 'draft'), 148);
      T('coupon_first', '$55 − $10', '$5.99', 'Agent draft', mark('v7-1', 'few'), 222, [[caught, 'fail']]);
      // "But check they say just what you need, with every edge case too."
      // The agent checks with its magnifier; the edge case arrives as a test.
      T('at_50', '$50.00', 'free', 'You', mark('v7-2', 'edge'), 296);
      // "Pin each boundary with a test, the input on the line:
      //  'Fifty after coupons: free; not forty-nine ninety-nine.'"
      // The number line leaves once the code arrives, so the code and the
      // tests are the only pictures while the song talks about them.
      K.numberLine(s, {
        x: 370, y: 70, w: 330, from: 45, to: 55, boundary: 50, ticks: [45, 50, 55], at: mark('v7-3', 'pin') - 0.2,
        until: mark('v7-5', 'pass') - 0.2, boundaryAt: mark('v7-3', 'line') - 0.1, caption: 'total after coupons',
        pins: [{ value: 50, tone: 'green', at: mark('v7-4', 'free') - 0.1 }, { value: 49.99, tone: 'red', side: 'left', at: mark('v7-4', 'ninetynine') - 0.2 }],
      });
      T('just_below', '$49.99', '$5.99', 'You', mark('v7-4', 'not'), 370);
      // "Then I'll write code to make them pass and leave your tests alone."
      const codeAt = mark('v7-5', 'code') - 0.1;
      const impl = K.card(s, { x: 370, y: 252, w: 330, h: 200, tone: 'code', title: 'shipping.py', iconName: 'code', at: codeAt });
      const v1 = K.code(impl.body, 'def shipping(total):\n    if total >= 50:\n        return 0\n    return 5.99');
      const refactorAt = mark('v7-7', 'refactor');
      tween(v1, { opacity: 0 }, refactorAt - 0.1, 0.25);
      const v2 = K.code(impl.body, 'FREE_AT = 50.00\ndef shipping(total):\n    if total >= FREE_AT:\n        return 0\n    return 5.99', { className: 'ak-code--swap' });
      K.reveal(v2, refactorAt + 0.15, 'fade');
      // "… and leave your tests alone": each test card shows a lock.
      // "Check I solved the general case, not just the cases shown."
      const general = mark('v7-6', 'general');
      K.pill(s, 'new input $72.10 → free', { x: 386, y: 208, tone: 'green', iconName: 'check', at: general, until: refactorAt });
      // "Then refactor what I wrote, and keep your tests in place:
      //  each time I regenerate, they catch the rules I misplace."
      const again = mark('v7-8', 'each') + 0.2;
      K.pill(s, 'refactored, tests still pass', { x: 386, y: 208, tone: 'green', iconName: 'sparkle', at: refactorAt + 0.2, until: again - 0.1 });
      K.pill(s, 'regenerated: before the coupon', { x: 370, y: 208, tone: 'gold', iconName: 'resend', at: again, until: caught - 0.1 });
      K.pill(s, 'caught: coupon_first fails', { x: 380, y: 208, tone: 'red', iconName: 'bolt', at: caught });
      // The agent drafts tests, writes code, and points at the catch.
      hold(mark('v7-1', 'draft') - 0.4, 'right', 'pen');
      move(mark('v7-1', 'draft'), 'write', { to: [300, 190], hold: 1.2 });
      hold(mark('v7-2', 'check') - 0.2, 'right', 'magnifier');
      move(mark('v7-2', 'check'), 'read', { hold: 1.4 });
      hold(mark('v7-3', 'pin') - 0.3, 'right', null);
      move(mark('v7-3', 'line'), 'point', { to: [540, 150], hold: 1.0 });
      move(mark('v7-5', 'write'), 'type', { hold: 1.2 });
      face(pass, 'joy', 1.2);
      move(alone, 'nod');
      move(general, 'think', { hold: 1.0 });
      move(refactorAt, 'type', { hold: 1.0 });
      face(caught, 'surprised', 1.0);
      move(caught + 0.2, 'point', { to: [200, 250], hold: 1.2 });
    }

    // ----------------------------------------------------------------
    // Bridge: what stays with you
    // ----------------------------------------------------------------

    function bridge() {
      badge('Bridge', 'bridge');
      const from = start('bridge'), leave = end('bridge');
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      // "Accidental complexity comes from the tools we choose,
      //  like syntax and boilerplate: that part, I'll help you lose."
      const lose = mark('b-2', 'lose');
      K.accidental(s, { x: 40, y: 78, at: from + 0.1, sweepAt: mark('b-2', 'help') - 0.2, until: mark('b-4', 'requirements') - 0.2 });
      // "Essential complexity comes with the problem, through and through."
      K.essential(s, {
        x: 380, y: 78, at: mark('b-3', 'essential') - 0.2, until: mark('b-5', 'if'),
        facets: [
          { text: 'what users need', iconName: 'list', at: mark('b-3', 'problem') },
          { text: 'how the parts fit', iconName: 'chart', at: mark('b-3', 'through') },
          { text: 'what must be checked', iconName: 'check', at: mark('b-3', 'through_2') },
        ],
      });
      // "Requirements, design, and tests still belong to you."
      const [youX, youY] = you(mark('b-4', 'requirements') - 0.4, leave - 0.1, 30, 220, 0.7);
      [['Requirements', 'list', 'requirements'], ['Design', 'chart', 'design'], ['Tests', 'check', 'tests']].forEach(([text, iconName, word], i) => {
        const [sx, sy] = [400 + i * 8, 330 + i * 44];
        const chip = K.pill(s, text, { x: sx, y: sy, tone: 'gold', iconName, at: mark('b-4', word) - 0.1, until: mark('b-5', 'if') + 0.2 });
        // They fly below the essential-complexity card, never across it.
        tween(chip, { translate: `${youX + 70 - sx}px ${youY + 13 + i * 42 - sy}px` }, mark('b-4', 'belong') + i * 0.12, 0.8, EASE.inOut);
      });
      K.pill(s, 'still yours', { x: youX + 70, y: youY - 30, tone: 'green', iconName: 'user', at: mark('b-4', 'you') - 0.1, until: mark('b-5', 'thinking') });
      // "If I do all your thinking, you'll barely learn a thing;
      //  so ask me why, then try yourself, and watch your skills take wing."
      // The seedling droops when the agent does the thinking and grows when
      // you try; your bubble keeps both steps of the advice on screen.
      K.seedling(s, { x: 420, y: 180, at: mark('b-5', 'if') - 0.1, droopAt: mark('b-5', 'learn') - 0.2, growAt: mark('b-6', 'try'), birdAt: mark('b-6', 'wing') - 0.3 });
      const asks = K.bubble(s, 'Why does this work?', { x: 60, y: 110, w: 250, tail: 'down', at: mark('b-6', 'so') - 0.1 });
      K.row(asks, 'Now let me try it myself!', { className: 'ak-row--ok', at: mark('b-6', 'try') - 0.1 });
      // The agent sweeps the accidental work away and hands the rest to you.
      move(mark('b-1', 'tools'), 'present', { to: [190, 200], hold: 1.0 });
      move(mark('b-2', 'help') - 0.1, 'wave', { hold: 1.0 });
      face(lose, 'happy', 1.2);
      move(mark('b-3', 'problem'), 'present', { to: [530, 200], hold: 1.4 });
      move(mark('b-4', 'belong'), 'offer', { to: [youX + 60, youY], hold: 2.0 });
      face(mark('b-4', 'belong'), 'love', 1.6);
      move(mark('b-5', 'learn'), 'shake');
      face(mark('b-5', 'thinking'), 'worried', 1.6);
      move(mark('b-6', 'why'), 'think', { hold: 1.0 });
      face(mark('b-6', 'try'), 'joy', 2.4);
      move(mark('b-6', 'wing'), 'cheer', { hold: 1.4 });
    }

    // ----------------------------------------------------------------
    // Pop quiz
    // ----------------------------------------------------------------

    function quiz() {
      badge('Pop quiz', 'quiz');
      const from = start('quiz'), leave = end('quiz');
      const { lines } = song.storyboard.sections.find((section) => section.id === 'quiz');
      const icons = ['calendar', 'key', 'code'];
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      lines.forEach((entry, i) => {
        const at = i === 0 ? mark('quiz-1', 'refunds') - 0.4 : entry.start - 0.1;
        const until = i + 1 < lines.length ? lines[i + 1].start - 0.15 : leave;
        K.quizCard(s, { entry, index: i + 1, count: lines.length, at, until, iconName: icons[i] });
        move(entry.pause_at - 0.4, 'think', { hold: Math.max(0.6, entry.answer_at - entry.pause_at) });
        face(entry.pause_at - 0.4, 'curious', 1.0);
        move(entry.answer_at + 0.1, 'present', { to: [360, 360], hold: 1.2 });
        face(entry.answer_at, 'happy', 1.4);
      });
      K.pill(s, 'Pop quiz!', { x: 250, y: 200, tone: 'gold', iconName: 'sparkle', at: from + 0.1, until: mark('quiz-1', 'refunds') - 0.3 });
      move(mark('quiz-1', 'pop'), 'hop');
      move(mark('quiz-1', 'no'), 'shake');
      face(mark('quiz-1', 'no'), 'wink', 0.9);
    }

    // ----------------------------------------------------------------
    // Outro: you own it; one level up
    // ----------------------------------------------------------------

    function outro() {
      badge('Outro', 'outro');
      const from = start('outro'), leave = song.duration;
      const s = kit.scene(content, from, leave, { exit: 'fade' });
      // "I know how to write the code."
      const page = K.card(s, { x: 250, y: 80, w: 400, tone: 'code', title: 'shipping.py', iconName: 'code', at: from + 0.1, until: mark('outro-3', 'so') });
      const src = 'FREE_AT = 50.00\ndef shipping(total):\n    if total >= FREE_AT:\n        return 0\n    return 5.99';
      K.code(page.body, src, { lineTimes: src.split('\n').map((_, i) => mark('outro-1', 'write') + i * 0.2) });
      // "You know what we should build." You arrive; the line needs no label.
      // "So… meet me one level up?" You both go up to the mezzanine.
      const up = campus?.office?.mezzanine;
      const meetUp = up ? [up.x + 40, up.y] : UP;
      you(mark('outro-2', 'you') - 0.4, leave - 0.2, 14, 220, 0.72, { at: mark('outro-3', 'level'), x: meetUp[0] + 88, y: meetUp[1] - 165, scale: 0.55 });
      // "So… meet me one level up?"
      const end1 = K.card(s, { x: 470, y: 96, w: 440, tone: 'white', kicker: 'Requirements · Design · Tests', title: 'Meet me one level up', iconName: 'arrowUp', at: mark('outro-3', 'level') + 0.1, how: 'rise', className: 'ak-title-card' });
      K.row(end1.body, 'CS 35L · Software Construction', { className: 'ak-row--small' });
      move(mark('outro-1', 'know'), 'lecture', { hold: 0.7 });
      face(mark('outro-1', 'know'), 'smug', 0.9);
      move(mark('outro-1', 'write'), 'type', { hold: 1.0 });
      move(mark('outro-2', 'build'), 'present', { to: [200, 330], hold: 1.2 });
      face(mark('outro-2', 'you'), 'happy', 1.4);
      // Up the stairs to the mezzanine's left end, you beside it, both clear of the closing card.
      go(mark('outro-3', 'level'), meetUp);
      move(mark('outro-3', 'meet'), 'beckon', { to: [200, 330], hold: 2.4 });
      face(mark('outro-3', 'meet'), 'love', 3.0);
      move(mark('outro-3', 'up') + 1.2, 'wave', { hold: 2.0 });
    }

    intro();
    verse1();
    verse2();
    preChorus();
    chorus('c1', 'chorus-1', 'paper');
    verse3();
    verse4();
    chorus('c2', 'chorus-2', 'white');
    verse5();
    verse6();
    chorus('c3', 'chorus-3', 'white');
    verse7();
    bridge();
    quiz();
    chorus('fc', 'final-chorus', 'white', { finale: true });
    outro();

    // The agent last, in front of the pictures it points at.
    window.CodingAgent?.agent(content, {
      x: HOME[0] + 40, y: FLOOR, scale: 0.82, at: 0.5, until: song.duration,
      route: BOT.route, moves: BOT.moves, faces: BOT.faces, holds: BOT.holds,
      words: window.CodingAgent.wordsOf(song.storyboard), facing: 1,
    });
  };
})();
