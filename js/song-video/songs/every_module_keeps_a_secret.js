/*
 * Choreography for "Every Module Keeps a Secret", the information hiding
 * song (storyboard: _data/songs/every_module_keeps_a_secret.yml).
 *
 * Every visual hits a sung word: `mark(lineId, word)` is that word's time in
 * the recording. The teaching rule for the visuals: show exactly what the
 * line says, one idea per scene, in a spy-thriller language whose pictures
 * carry the concept (see js/song-video/ih-kit.js): a module is a case file
 * and the design decision it hides is a sealed TOP SECRET envelope, so a
 * decision copied into many modules is the same envelope in every file;
 * dependencies are red string on a corkboard; calls are couriers carrying
 * envelopes; "from the others" is a laser wall. The chorus always shows
 * Parnas's own sentence as a decrypted transmission, then one module as a
 * vault: its nameplate (the what) stays while its secret (the how) changes.
 * Each line's `visual` text in the storyboard describes this file.
 *
 * Layout: 960×540 stage; the section badge sits top-left, and nothing
 * essential goes below y = 460, where the player draws captions.
 */
(function () {
  'use strict';

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.every_module_keeps_a_secret = function choreograph({ song, kit, layers, student }) {
    const { fx, tween, EASE, camera } = window.Timeline;
    const ih = window.InfoHidingKit;
    const { content, hud } = layers;
    const line = (id) => song.line(id);
    const mark = (id, word) => song.mark(id, word);

    function badge(text, sectionId) {
      kit.badge(hud, text, song.sectionStart(sectionId), song.sectionEnd(sectionId));
    }

    // ----------------------------------------------------------------
    // Intro: Operation Y2K, a decision copied into every program
    // ----------------------------------------------------------------

    function intro() {
      badge('Case file · The Y2K bug', 'intro');

      // "Y2K. Maybe the most famous bug."
      const a = kit.scene(content, 0, line('intro-2').start - 0.1);
      ih.spotlight(a, { x: 480, y: 200, w: 620, h: 420, at: 3.4 });
      kit.kinetic(a, [{ text: 'Y2K', at: mark('intro-1', 'y2k'), color: 'gold' }], { y: 112, size: 140 });
      // One label under the title; it slams from a small scale so it never sweeps over "Y2K".
      kit.stamp(a, 'The most famous bug', { x: 196, y: 292, at: mark('intro-1', 'most') - 0.2, rotate: -4, shake: false, from: 1.3 });
      ih.bug(a, { x: 772, y: 278, at: mark('intro-1', 'bug') - 0.6, size: 86, rotate: -70, from: [940, 330] });

      // Memory was expensive, so the year lost its first two digits.
      const b = kit.scene(content, line('intro-2').start - 0.1, line('intro-6').start - 0.1);
      ih.mainframeMemory(b, { x: 40, y: 118, at: line('intro-2').start });
      const memory = kit.el('div', 'ih-memory-heading is-staged', b, '1960s mainframe');
      fx.fadeIn(memory, mark('intro-2', 'sixties'), 0.3);
      const full = ih.digits(b, {
        x: 310, y: 118, label: 'The year', cells: 4, size: 64, at: mark('intro-3', 'programmers'),
        values: [{ at: 0, text: '1985' }],
        strikes: [{ at: mark('intro-3', 'saved'), cells: [0, 1] }],
      });
      ih.courier(b, { from: [560, 196], to: [652, 196], bend: -30, tone: 'gold', at: mark('intro-4', 'stored'), period: 1.4 });
      ih.digits(b, {
        x: 666, y: 118, label: 'What gets stored', cells: 2, size: 64, at: mark('intro-4', 'stored'),
        values: [{ at: 0, text: '85', tone: 'lit' }],
      });
      kit.sticker(b, '2 digits saved', { x: 640, y: 272, at: mark('intro-4', 'digits'), variant: 'green', iconName: 'check', rotate: 4 });
      // Memory was expensive: money flies into the core memory. On "two
      // digits" a little of it drops back out: memory saved is money saved.
      ih.cashIntoMemory(b, {
        into: { x: 79, y: 283, w: 162, h: 32 }, count: 36,
        at: mark('intro-2', 'memory'), refundAt: mark('intro-4', 'two') + 1, until: line('intro-6').start,
      });
      fx.bump(full, mark('intro-5', '1985'), 0.12);

      // 99 rolls over to 00, which the computer reads as 1900.
      const c = kit.scene(content, line('intro-6').start - 0.1, line('intro-8').start - 0.1);
      const year = ih.digits(c, {
        x: 100, y: 110, label: 'Stored year', cells: 2, size: 110, at: line('intro-6').start,
        values: [
          { at: 0, text: '99', tone: 'lit' },
          { at: mark('intro-6', 'double'), text: '00', tone: 'bad' },
        ],
      });
      kit.sticker(c, 'Year 2000', { x: 120, y: 320, at: mark('intro-6', '2000'), variant: 'gold', iconName: 'timer', rotate: -4 });
      ih.code(c, {
        x: 440, y: 118, w: 430, title: 'mainframe terminal', variant: 'crt', at: mark('intro-7', 'computer'),
        lines: [
          { parts: ['YEAR = 19 + ', { text: '"00"', mark: 'red', at: mark('intro-7', 'reads') }] },
          { at: mark('intro-7', 'as'), parts: ['     = ', { text: '1900', mark: 'red', at: mark('intro-7', '1900') }] },
        ],
      });
      kit.stamp(c, '1900?!', { x: 470, y: 290, at: mark('intro-7', '1900'), rotate: -7, shake: false });
      ih.calendar(c, {
        x: 720, y: 252, at: mark('intro-6', 'year'),
        pages: [
          { at: 0, month: 'DEC', day: 31, year: 1999 },
          { at: mark('intro-7', 'reads'), month: 'JAN', day: 1, year: 1900, tone: 'bad' },
        ],
      });
      fx.bump(year, mark('intro-7', '1900'), 0.08);

      // Age = 00 − 85 = −85; nobody expected the code to live that long.
      const d = kit.scene(content, line('intro-8').start - 0.1, line('intro-12').start - 0.1);
      ih.code(d, {
        x: 70, y: 96, w: 480, title: 'AGE.CBL', variant: 'crt', at: mark('intro-8', 'born'),
        lines: [
          { parts: ['BORN = ', { text: '85', mark: 'gold', at: mark('intro-8', '85') }] },
          { at: mark('intro-8', 'zero') - 0.1, parts: ['NOW  = ', { text: '00', mark: 'red', at: mark('intro-8', 'zero') }] },
          { at: mark('intro-8', 'minus'), parts: ['AGE  = NOW - BORN'] },
          { at: mark('intro-9', 'negative'), parts: ['     = ', { text: '-85', mark: 'red', at: mark('intro-9', 'negative') }] },
        ],
      });
      kit.stamp(d, '−85 years old?', { x: 120, y: 330, at: mark('intro-9', 'years'), rotate: -5, shake: false });
      // Born in '85, then from "zero minus" he rewinds: teen, kid, baby,
      // newborn, egg cell, gone.
      const rewind = mark('intro-8', 'zero');
      // Five steps and the puff fit between "zero minus" and "nobody", when
      // the 1970s programmer's thought bubble takes this corner.
      const nobody = mark('intro-10', 'nobody');
      const step = (nobody - 0.55 - rewind) / 5;
      ih.agingPerson(d, {
        x: 690, y: 92, tag: 'Born ’85', at: mark('intro-8', 'born'), until: nobody - 0.05,
        stages: { teen: rewind, kid: rewind + step, baby: rewind + 2 * step, newborn: rewind + 3 * step, egg: rewind + 4 * step, gone: rewind + 5 * step },
      });
      ih.bubble(d, {
        x: 600, y: 96, w: 300, who: '1970s programmer', whoIcon: 'user', thought: true,
        text: 'This code will be replaced long before 2000.', at: nobody,
      });
      kit.stamp(d, 'Still running', { x: 600, y: 300, at: mark('intro-11', 'did'), color: 'gold', rotate: -6, shake: false });

      // The two-digit year wasn't hidden in one module: every file has it.
      const e = kit.scene(content, line('intro-12').start - 0.1, line('intro-16').start - 0.1);
      const names = ['Payroll', 'Billing', 'Interest', 'Bookings', 'Reports', 'Pensions', 'Insurance', 'Loans', 'Taxes', 'Shipping', 'Inventory', 'Grades'];
      const grid = ih.grid(e, {
        x: 56, y: 96, cols: 4, cellW: 200, cellH: 46, gap: 14, names, at: line('intro-12').start, step: 0.04,
        until: line('intro-14').start, tag: 'YY', tagAt: mark('intro-12', 'year'), tagStep: 0.05,
      });
      ih.note(e, 'Not hidden in one module', { x: 330, y: 290, at: mark('intro-12', 'hidden'), until: mark('intro-13', 'copied'), tone: 'red', rotate: -3 });
      grid.light(mark('intro-13', 'copied'), names.map((_, i) => i), { step: 0.08, until: line('intro-14').start });
      kit.sticker(e, 'Copied into every calculation', { x: 250, y: 296, at: mark('intro-13', 'every'), until: line('intro-14').start, variant: 'red', iconName: 'copy', rotate: 3 });
      ih.search(e, {
        x: 110, y: 90, w: 740, query: 'YY', at: line('intro-14').start, typedAt: line('intro-14').start + 0.1,
        hitsAt: mark('intro-14', 'hunting'), step: 0.3,
        hits: [
          { file: 'payroll.cbl', before: 'MOVE ', match: 'YY', after: ' TO PAY-YEAR' },
          { file: 'interest.cbl', before: 'COMPUTE AGE = NOW-', match: 'YY', after: ' - BORN-YY' },
          { file: 'billing.cbl', before: 'IF DUE-', match: 'YY', after: ' < NOW-YY' },
          { file: 'reports.cbl', before: 'SORT BY ', match: 'YY', after: '' },
          { file: 'bookings.cbl', before: 'MOVE "19" TO CENTURY-', match: 'YY', after: '' },
        ],
      });

      // Midnight came, almost nothing broke, and the fix cost billions.
      const f = kit.scene(content, line('intro-16').start - 0.1, line('intro-18').start - 0.1);
      ih.spotlight(f, { x: 480, y: 160, w: 560, h: 320, at: line('intro-16').start });
      ih.clock(f, { x: 290, y: 96, w: 380, at: line('intro-16').start, turnAt: mark('intro-16', 'came') });
      kit.sticker(f, 'Almost nothing broke', { x: 150, y: 290, at: mark('intro-16', 'nothing'), variant: 'green', iconName: 'check', rotate: -4 });
      kit.sticker(f, 'Fixed in time', { x: 580, y: 300, at: mark('intro-17', 'fixed'), variant: 'gold', iconName: 'timer', rotate: 4 });
      window.SongFireworks.celebrate(f, { at: mark('intro-16', 'came') + 0.05, seed: 7 });
      const g = kit.scene(content, line('intro-18').start - 0.1, line('intro-19').start - 0.1);
      // "Billions": red money bursts out from behind the expense sheet and
      // flies away; it keeps flying briefly over the start of the next scene.
      const burst = kit.scene(content, mark('intro-18', 'billions') - 0.1, line('intro-19').start + 0.9, { exit: 'fade' });
      content.insertBefore(burst, g);  // behind the expense sheet
      ih.cashBurst(burst, { x: 480, y: 200, count: 240, at: mark('intro-18', 'billions'), until: line('intro-19').start, tone: 'red' });
      ih.paper(g, {
        x: 290, y: 78, w: 380, kicker: 'Classified expenses', title: 'Operation Y2K', at: line('intro-18').start,
        lines: [
          { text: '1. Find every two-digit year', at: mark('intro-18', 'bill') + 0.25 },
          { text: '2. Fix it, test it, ship it', at: mark('intro-18', 'bill') + 0.6 },
          { text: 'Total: billions of dollars', total: true, at: mark('intro-18', 'billions') },
        ],
      });
      kit.stamp(g, 'Paid', { x: 560, y: 260, at: mark('intro-18', 'billions') + 0.3, color: 'red', rotate: -12, shake: false });

      // Lesson one, then the case file title through the instrumental.
      const h = kit.scene(content, line('intro-19').start - 0.1, line('verse-1-1').start - 0.1, { exit: 'fade' });
      kit.kinetic(h, [{ text: 'Lesson one', at: mark('intro-19', 'lesson'), color: 'gold' }], { y: 52, size: 34, punch: false });
      ih.spotlight(h, { x: 320, y: 250, w: 640, h: 420, at: mark('intro-19', 'every') - 0.2 });
      ih.dossier(h, {
        x: 60, y: 112, w: 520, tab: 'Case file · Information hiding',
        title: 'Every module should keep a secret', sub: 'A secret is a design decision that might change.',
        at: mark('intro-19', 'every'),
      });
      kit.stamp(h, 'Top secret', { x: 340, y: 326, at: mark('intro-19', 'secret') + 0.15, rotate: -10, shake: false });
      const titleEnd = line('verse-1-1').start - 0.4;
      student?.appear({ from: mark('intro-19', 'secret') + 0.6, to: titleEnd, x: 640, y: 120, scale: 0.92 });
      const credit = kit.el('div', 'end-credit is-staged', h, 'SE Book · Information Hiding');
      credit.style.top = '420px';
      fx.fadeIn(credit, mark('intro-19', 'secret') + 1.2, 0.5);
    }

    // ----------------------------------------------------------------
    // Verse 1: why complexity hurts
    // ----------------------------------------------------------------

    function verse1() {
      badge('Verse 1 · Why it matters', 'verse-1');
      const start = song.sectionStart('verse-1');

      // Dated examples; source-count scope is documented in docs/song-apollo-sources.md.
      const a = kit.scene(content, start, line('verse-1-6').start - 0.1);
      ih.spotlight(a, { x: 170, y: 265, w: 340, h: 400, at: start });
      ih.apolloPortrait(a, { x: 24, y: 94, at: line('verse-1-1').start });
      const apollo = kit.el('div', 'ih-code-record ih-code-record--apollo is-staged', a);
      kit.el('div', 'ih-code-record-year', apollo, 'Apollo 11 · 1969');
      // She counts the volumes from the floor to her hand; the lines count with her.
      const countAt = mark('verse-1-1', 'printed');
      const countFor = mark('verse-1-2', 'hamilton') - countAt;
      const apolloCount = ih.counter(apollo, { x: 0, y: 0, label: 'lines of code', from: 0, to: 80000, at: countAt, duration: countFor, format: (n) => `≈${n.toLocaleString('en-US')}` });
      apolloCount.classList.add('ih-code-record-counter');
      kit.el('div', 'ih-code-record-scope', apollo, 'Command + lunar modules; comments excluded');
      const credit = kit.el('div', 'ih-hamilton-credit is-staged', apollo);
      kit.el('strong', '', credit, 'Margaret Hamilton');
      kit.el('span', '', credit, 'Lead software engineer');
      kit.el('span', '', credit, 'Apollo onboard flight software · MIT');
      fx.fadeIn(apollo, mark('verse-1-1', 'code'), 0.3);
      fx.fadeIn(credit, mark('verse-1-2', 'margaret'), 0.3);
      ih.apolloCount(a, { x: 24, y: 94, at: countAt, duration: countFor });
      ih.car(a, { x: 570, y: 132, at: mark('verse-1-3', 'car'), until: line('verse-1-4').start - 0.25, w: 290 });
      const car = kit.el('div', 'ih-code-record ih-code-record--car is-staged', a);
      kit.el('div', 'ih-code-record-year', car, 'Modern car · 2021');
      const carCount = ih.counter(car, { x: 0, y: 0, label: 'lines of code', from: 0, to: 100000000, at: mark('verse-1-3', 'a_2') - 0.1, duration: 0.65, format: (n) => `≈${n.toLocaleString('en-US')}` });
      carCount.classList.add('ih-code-record-counter');
      fx.fadeIn(car, mark('verse-1-3', 'car'), 0.3);

      // Keep both code records visible while the car gives way to one person's
      // limited working memory; this is still the same comparison scene.
      ih.overflowingHead(a, { x: 700, y: 26, size: 272, at: line('verse-1-4').start, overflowAt: mark('verse-1-5', 'no') });
      kit.sticker(a, '×1000 smarter? No.', { x: 482, y: 150, at: mark('verse-1-4', 'thousand'), until: line('verse-1-5').start, variant: 'white', iconName: 'cross', rotate: -3 });
      kit.sticker(a, 'Too much for one head', { x: 470, y: 150, at: mark('verse-1-5', 'no'), variant: 'pink', iconName: 'warning', rotate: -3 });

      // The corkboard: 4 modules → 6 strings, 8 modules → 28; then mud.
      const handoff = line('verse-1-10').start - 0.35;
      const c = kit.scene(content, line('verse-1-6').start - 0.1, handoff + 0.3, { exit: 'fade' });
      ih.stringWeb(c, { x: 24, y: 76, w: 350, h: 340, names: ['Cart', 'Order', 'Pay', 'Ship'], title: 'Case: 4 modules', at: mark('verse-1-6', 'four'), drawFor: 0.9, until: mark('verse-1-8', 'let') });
      const board = ih.stringWeb(c, { x: 392, y: 64, w: 548, h: 384, names: ['Cart', 'Order', 'Pay', 'Ship', 'Auth', 'Mail', 'Tax', 'Stock'], title: 'Case: 8 modules', at: mark('verse-1-7', 'eight'), drawFor: 1.8 });
      fx.moveTo(board.node, mark('verse-1-8', 'let'), -200, 0, 0.6);
      board.mud(mark('verse-1-9', 'youve') - 0.2, { strainFrom: mark('verse-1-8', 'depend') });
      camera.shake(board.impact, 4);
      ih.note(c, 'everything depends on everything', { x: 300, y: 26, at: mark('verse-1-8', 'depend'), until: mark('verse-1-9', 'big'), tone: 'red', rotate: -2 });

      // One change touches dozens of files; squash one bug, two crawl in.
      // The same ball carries over: it takes the board's place exactly as the
      // board fades, then shrinks to the corner while the files appear.
      const m = kit.scene(content, handoff - 0.3, song.sectionEnd('verse-1'));
      const [bx, by] = board.ballCenter;
      board.handOff(handoff + 0.01);
      ih.mud(m, { x: 300, y: 290, size: 150, at: handoff, from: [192 + 10 + bx, 64 + 10 + by], delay: 0.05, move: 0.55 });
      // One label rides with the ball: stamped on the board, then it glides
      // down and shrinks with the ball to sit under it beside the files.
      const label = kit.scene(content, mark('verse-1-9', 'big') - 0.05, song.sectionEnd('verse-1'));
      const mudStamp = kit.stamp(label, 'Big Ball of Mud', { x: 250, y: 396, at: mark('verse-1-9', 'big'), color: 'gold', rotate: -4, shake: false });
      mudStamp.style.transformOrigin = '50% 50%';
      tween(mudStamp, [{ translate: '0 0', scale: 1 }, { translate: '-38px 24px', scale: 0.55 }], handoff + 0.05, 0.55, EASE.inOut);
      const d = kit.scene(content, line('verse-1-10').start - 0.1, song.sectionEnd('verse-1'));
      const files = ['cart.js', 'order.js', 'refund.js', 'wallet.js', 'auth.js', 'mail.js', 'tax.js', 'report.js', 'admin.js', 'search.js', 'ship.js', 'stock.js'];
      // The files arrive once the carried ball has cleared their rows.
      const grid = ih.grid(d, { x: 40, y: 92, cols: 3, cellW: 176, cellH: 40, gap: 12, names: files, at: handoff + 0.5, step: 0.03 });
      grid.light(mark('verse-1-10', 'one'), [4], { tone: 'change', stamp: 'Changed' });
      grid.light(mark('verse-1-10', 'touch'), [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11], { step: 0.07, stamp: 'Hit' });
      ih.counter(d, { x: 50, y: 316, label: 'files touched', from: 1, to: 12, at: mark('verse-1-10', 'touch'), duration: 0.9 });
      ih.bug(d, { x: 700, y: 170, at: mark('verse-1-11', 'fix') - 0.5, squashAt: mark('verse-1-11', 'bug') + 0.1, size: 96, rotate: 200, from: [720, 30] });
      ih.stampTool(d, { x: 748, y: 251, pressDepth: 63, at: mark('verse-1-11', 'bug') + 0.1, label: 'FIXED' });
      ih.bug(d, { x: 640, y: 290, at: mark('verse-1-11', 'two'), size: 80, rotate: 10, from: [660, 470] });
      ih.bug(d, { x: 790, y: 290, at: mark('verse-1-11', 'more'), size: 80, rotate: -60, from: [960, 340] });
    }

    // ----------------------------------------------------------------
    // Pre-chorus 1: not by the steps, by the decisions (Parnas, 1972)
    // ----------------------------------------------------------------

    function preChorus1() {
      badge('Pre-chorus · How to split a system', 'pre-chorus-1');
      const s = kit.scene(content, song.sectionStart('pre-chorus-1'), song.sectionEnd('pre-chorus-1'));
      const paperAt = mark('pre-chorus-1-3', '1972');
      const lead = 0.3; // visuals land just ahead of the word that names them
      const noAt = mark('pre-chorus-1-2', 'first') - 0.2; // the verdict lands a beat early
      ih.heading(s, ['How do you split a system into ', 'modules', '?'], { x: 120, y: 76, at: line('pre-chorus-1-1').start, until: paperAt - 0.1 });
      ih.systemSplit(s, {
        x: 200, y: 168, w: 560, h: 160, parts: ['Module A', 'Module B', 'Module C'],
        at: line('pre-chorus-1-1').start, cutAt: mark('pre-chorus-1-1', 'split') - 0.55, apartAt: mark('pre-chorus-1-1', 'split'),
        pipeline: {
          at: line('pre-chorus-1-2').start - lead,
          verdictAt: noAt,
          noAt: noAt + 0.1,
          labels: [{ text: '1 · Read input', iconName: 'file' }, { text: '2 · Process', iconName: 'gear' }, { text: '3 · Print', iconName: 'receipt' }],
        },
        until: paperAt - 0.1,
      });
      kit.stamp(s, 'Not by steps', { x: 330, y: 392, at: noAt, rotate: -5, shake: false, until: paperAt - 0.1 });
      ih.spotlight(s, { x: 480, y: 220, w: 760, h: 400, at: paperAt - 0.2 });
      ih.paper(s, {
        x: 180, y: 116, w: 600, kicker: 'Communications of the ACM · December 1972',
        title: 'On the Criteria To Be Used in Decomposing Systems into Modules',
        meta: 'David L. Parnas · Carnegie-Mellon University', cite: 'Vol. 15, No. 12 · pp. 1053–1058', clip: true, at: paperAt,
      });
    }

    // ----------------------------------------------------------------
    // Chorus: the decrypted sentence, then one module as a vault
    // ----------------------------------------------------------------

    const SECRETS = [
      { name: 'Dates', secret: 'year format' },
      { name: 'PaymentGateway', secret: 'provider' },
      { name: 'UserRepository', secret: 'database' },
    ];

    const EXAMPLES = {
      1: { name: 'Dates', what: 'year(date) → 1985', hows: ['stores "85"', 'stores "1985"'], callers: ['Payroll', 'Billing', 'Reports'] },
      2: { name: 'PaymentGateway', what: 'charge(order, payment)', hows: ['PayPal', 'Stripe'], callers: ['OrderService', 'RefundService', 'WalletService'] },
      3: { name: 'UserRepository', what: 'findByEmail(email)', hows: ['MongoDB', 'Supabase'], callers: ['Login', 'Profile', 'Admin'] },
    };

    function chorus(n, { title = 'Chorus', final = false } = {}) {
      const id = `chorus-${n}`;
      const ln = (k) => `${id}-${k}`;
      badge(`${title} · The principle`, id);
      const start = song.sectionStart(id);
      const tagStart = line(ln(6)).start;

      // Parnas's sentence decrypts line by line; its key phrases are marked.
      const q = kit.scene(content, start, mark(ln(6), 'every') + 0.25, { exit: 'fade' });
      ih.transmission(q, {
        x: 64, y: 60, w: 832, at: line(ln(1)).start - 0.3, origin: 'CACM · 1972',
        header: 'On the Criteria To Be Used in Decomposing Systems into Modules',
        source: '— David L. Parnas, 1972', sourceAt: line(ln(5)).start, stampAt: mark(ln(5), 'from'),
        lines: [
          { at: line(ln(1)).start, parts: ['We propose that one begins'] },
          { at: line(ln(2)).start, parts: ['with a list of ', { text: 'difficult design decisions', tone: 'gold', at: mark(ln(2), 'difficult') }] },
          { at: line(ln(3)).start, parts: ['or ', { text: 'design decisions which are likely to change', tone: 'cyan', at: mark(ln(3), 'likely') }, '.'] },
          { at: line(ln(4)).start, parts: ['Each module is then designed'] },
          { at: line(ln(5)).start, parts: ['to ', { text: 'hide such a decision', tone: 'pink', at: mark(ln(5), 'hide') }, ' from the others.'] },
        ],
      });
      // Each module hides one decision; laser walls keep it from the others.
      const each = line(ln(4)).start;
      SECRETS.forEach((item, i) => {
        const box = ih.module(q, { x: 64 + i * 284, y: 352, w: 258, h: 64, name: item.name, at: each + i * 0.18 });
        box.secret(item.secret, { at: mark(ln(5), 'hide') + i * 0.12, dy: 46 });
      });
      for (const wallX of [334, 618]) ih.laser(q, { x: wallX, y1: 340, y2: 430, at: mark(ln(5), 'from') + 0.05 });

      // One module as a vault: the nameplate stays, the secret changes.
      const ex = EXAMPLES[n];
      const t = kit.scene(content, tagStart - 0.2, song.sectionEnd(id), { exit: 'fade' });
      // The first two choruses sing "should keep", the final one "keeps".
      const should = line(ln(6)).text.includes('should');
      kit.kinetic(t, [
        { text: 'Every module', at: mark(ln(6), 'every') },
        { text: should ? 'should keep a secret' : 'keeps a secret', at: mark(ln(6), should ? 'should' : 'keeps'), color: 'gold' },
      ], { y: 56, size: 38 });
      const box = ih.vault(t, {
        x: 40, y: 110, w: 470, name: ex.name, what: ex.what,
        hows: [{ at: 0, text: ex.hows[0] }, { at: mark(ln(8), 'how'), text: ex.hows[1] }],
        at: mark(ln(6), 'module'), whatAt: mark(ln(7), 'what'), howAt: mark(ln(7), 'how'),
      });
      // The callers send their requests to the nameplate only: they don't change.
      const youChange = mark(ln(9), 'change');
      ex.callers.forEach((name, i) => {
        const caller = ih.module(t, { x: 668, y: 118 + i * 98, w: 252, h: 60, name, at: mark(ln(6), 'secret') + i * 0.12 });
        ih.courier(t, { from: [664, 150 + i * 98], to: [516, 196], tone: 'gold', at: mark(ln(6), 'secret') + 0.3 + i * 0.12, period: 1.6 });
        caller.verdict('unchanged', { at: youChange + 0.3 + i * 0.15, dx: 134, dy: -12 });
      });
      box.light(mark(ln(9), 'module'));
      ih.counter(t, { x: 60, y: 384, label: 'module changed', from: 1, to: 1, at: mark(ln(9), 'module'), duration: 0.3 });
      const only = mark(ln(9), 'only');
      kit.stamp(t, 'Only one!', { x: 300, y: 386, at: only, color: 'green', rotate: -6, shake: false });
      camera.punch(only + 0.05, 0.035);
      if (final) window.SongFireworks.celebrate(t, { at: only + 0.1, seed: 33 });
    }

    // ----------------------------------------------------------------
    // Verse 2: the PayPal tangle, and Agent Payment Gateway
    // ----------------------------------------------------------------

    function verse2() {
      badge('Verse 2 · The PayPal tangle', 'verse-2');
      const start = song.sectionStart('verse-2');
      const end = song.sectionEnd('verse-2');
      const s = kit.scene(content, start, end);
      const hideAt = mark('verse-2-6', 'hide');

      // The store's three services, all calling PayPal, all knowing it.
      student?.appear({ from: start + 0.2, to: line('verse-2-5').start - 0.2, x: 700, y: 176, scale: 0.74 });
      ih.heading(s, ['Your team’s ', 'store'], { x: 330, y: 40, at: line('verse-2-1').start, until: mark('verse-2-2', 'all') });
      const services = [
        { name: 'OrderService', sub: 'checkout', at: mark('verse-2-1', 'checkout') },
        { name: 'RefundService', sub: 'refunds', at: mark('verse-2-1', 'refunds') },
        { name: 'WalletService', sub: 'wallet', at: mark('verse-2-1', 'wallet') },
      ].map((spec, i) => ({ ...spec, box: ih.module(s, { x: 40, y: 96 + i * 116, w: 256, h: 80, name: spec.name, sub: spec.sub, at: spec.at }) }));
      const tangle = kit.scene(s, mark('verse-2-2', 'all') - 0.1, hideAt + 0.3, { exit: 'fade' });
      const consoleAt = line('verse-2-5').start;
      ih.module(tangle, { x: 424, y: 196, w: 210, h: 104, name: 'PayPal', sub: 'payment SDK', kind: 'external', at: mark('verse-2-2', 'paypal'), until: consoleAt });
      services.forEach((service, i) => {
        ih.courier(tangle, { from: [300, 136 + i * 116], to: [420, 248], tone: 'pink', at: mark('verse-2-2', 'call') + i * 0.12, until: consoleAt + 0.25, period: 1.3 });
        service.box.secret('PayPal decision', { at: mark('verse-2-3', 'know') + i * 0.15, until: hideAt, dx: 8, dy: 58 });
      });
      ih.bubble(tangle, { x: 430, y: 36, who: 'The boss', whoIcon: 'chat', text: '“We’re switching\nto Stripe!”', at: mark('verse-2-4', 'boss') + 0.3, until: line('verse-2-5').start - 0.1 });

      // Intercepting every mention of PayPal: it's everywhere. The panel
      // starts right of the secret strips so none of them is cut off.
      ih.search(tangle, {
        x: 340, y: 86, w: 600, query: 'PayPal', at: line('verse-2-5').start, typedAt: mark('verse-2-5', 'search'),
        hitsAt: mark('verse-2-5', 'paypal'), step: 0.1, count: 'Everywhere', countAt: mark('verse-2-5', 'everywhere'),
        until: hideAt,
        hits: [
          { file: 'OrderService.java', before: '', match: 'paypal', after: '.authenticate(…);' },
          { file: 'OrderService.java', before: '', match: 'PayPal', after: 'Charge c = …' },
          { file: 'RefundService.java', before: '', match: 'PayPal', after: '.refund(token, …);' },
          { file: 'WalletService.java', before: '', match: 'PayPal', after: '.createPaymentMethod(…);' },
          { file: 'RetryPolicy.java', before: 'if (e instanceof ', match: 'PayPal', after: 'Exception)' },
          { file: 'Logger.java', before: 'log("', match: 'PayPal', after: ' error: " + code);' },
        ],
      });

      // Hide it behind one interface: a public badge with two operations.
      ih.module(s, {
        x: 396, y: 108, w: 280, h: 132, name: 'PaymentGateway', kind: 'interface',
        at: mark('verse-2-6', 'interface'),
        lines: [
          { text: 'charge(order, payment)', at: mark('verse-2-7', 'charge') },
          { text: 'refund(order, payment)', at: mark('verse-2-7', 'refund') },
        ],
      });
      services.forEach((service, i) => {
        ih.courier(s, { from: [300, 136 + i * 116], to: [392, 150 + i * 30], tone: 'gold', at: mark('verse-2-6', 'gateway') + i * 0.1, period: 1.5 });
      });
      kit.sticker(s, 'No PayPal in sight', { x: 420, y: 60, at: mark('verse-2-7', 'sight'), until: mark('verse-2-9', 'only'), variant: 'green', iconName: 'eye', rotate: -3 });

      // "The name's Gateway. Payment Gateway."
      const agentFrom = mark('verse-2-8', 'names') - 0.1;
      // He stays until the PayPal contact card needs his corner.
      const agentTo = mark('verse-2-9', 'exists') - 0.5;
      ih.spotlight(s, { x: 800, y: 210, w: 320, h: 420, at: agentFrom, until: agentTo });
      ih.agent(s, { x: 742, y: 100, scale: 0.66, name: 'Payment Gateway', role: 'Agent', look: 'tuxedo', at: agentFrom, until: agentTo });
      ih.bubble(s, { x: 700, y: 12, text: 'Gateway,\nPayment Gateway.', tailX: 95, at: mark('verse-2-8', 'names') - 0.1, until: agentTo });
      kit.sticker(s, 'Secret: which provider', { x: 690, y: 376, at: mark('verse-2-8', 'gateway_2'), until: agentTo, variant: 'red', iconName: 'lock', rotate: -3 });

      // Only PayPalGateway knows PayPal exists; Stripe plugs in beside it.
      const paypal = ih.module(s, { x: 396, y: 318, w: 260, h: 74, name: 'PayPalGateway', at: mark('verse-2-9', 'paypal') });
      ih.implementsLink(s, { from: [526, 316], to: [526, 246], at: mark('verse-2-9', 'gateway') });
      ih.note(s, 'implements', { x: 538, y: 262, at: mark('verse-2-9', 'gateway') + 0.1, tone: 'gold', rotate: 0 });
      paypal.secret('PayPal decision', { at: mark('verse-2-9', 'knows'), dx: 6, dy: 56 });
      paypal.light(mark('verse-2-9', 'knows'), mark('verse-2-10', 'plug'));
      ih.module(s, { x: 724, y: 228, w: 200, h: 80, name: 'PayPal', kind: 'external', at: mark('verse-2-9', 'exists') - 0.2, until: mark('verse-2-10', 'stripe') });
      ih.courier(s, { from: [660, 346], to: [722, 288], tone: 'cyan', at: mark('verse-2-9', 'exists'), until: mark('verse-2-10', 'stripe'), period: 1.2 });
      const stripe = ih.module(s, { x: 688, y: 318, w: 250, h: 74, name: 'StripeGateway', at: mark('verse-2-10', 'write') });
      ih.implementsLink(s, { from: [702, 316], to: [646, 244], at: mark('verse-2-10', 'plug') });
      stripe.light(mark('verse-2-10', 'plug'), end - 0.4, 'green');
      paypal.dim(mark('verse-2-10', 'plug'));
      kit.sticker(s, 'Plugged in: 1 line of wiring', { x: 640, y: 414, at: mark('verse-2-10', 'in'), variant: 'gold', iconName: 'plug', rotate: -3 });

      // The services don't change at all.
      services.forEach((service, i) => service.box.verdict('unchanged', { at: mark('verse-2-11', 'dont') + i * 0.18, dx: 150, dy: -14 }));
      kit.sticker(s, 'Services changed: 0', { x: 40, y: 430, at: mark('verse-2-11', 'all'), variant: 'green', iconName: 'check', rotate: -2 });
    }

    // ----------------------------------------------------------------
    // Pre-chorus 2: the payoff Parnas promised
    // ----------------------------------------------------------------

    function preChorus2() {
      badge('Pre-chorus · The payoff', 'pre-chorus-2');
      const s = kit.scene(content, song.sectionStart('pre-chorus-2'), song.sectionEnd('pre-chorus-2'));
      ih.heading(s, ['The payoff Parnas ', 'promised', ' (1972)'], { x: 70, y: 66, at: line('pre-chorus-2-1').start });
      const panels = [
        { title: 'Flexibility', items: ['Change one module', 'Leave the rest alone'], icons: ['gear', 'check'], at: mark('pre-chorus-2-2', 'change'), at2: mark('pre-chorus-2-2', 'leave') },
        { title: 'Comprehensibility', items: ['Study one module', 'at a time'], icons: ['search', 'book'], at: mark('pre-chorus-2-3', 'study'), at2: mark('pre-chorus-2-3', 'time') },
        { title: 'Parallel work', items: ['Teams side by side', 'Little need to talk'], icons: ['team', 'chat'], at: mark('pre-chorus-2-4', 'split'), at2: mark('pre-chorus-2-5', 'little') },
      ];
      panels.forEach((panel, i) => {
        const x = 64 + i * 290;
        ih.list(s, {
          x, y: 136, w: 262, title: panel.title, at: panel.at,
          items: panel.items.map((text, k) => ({ text, iconName: panel.icons[k], at: k ? panel.at2 : panel.at + 0.2 })),
        });
        const cells = ih.grid(s, { x: x + 6, y: 300, cols: 2, cellW: 122, cellH: 40, gap: 14, names: ['A', 'B', 'C', 'D'], at: panel.at + 0.3, step: 0.05 });
        if (i === 0) cells.light(panel.at + 0.4, [0], { tone: 'change', stamp: 'New' }).light(panel.at2, [1, 2, 3], { tone: 'good', step: 0.08 });
        if (i === 1) {
          cells.light(panel.at + 0.4, [0], { tone: 'good' });
          [1, 2, 3].forEach((k) => tween(cells.cells[k], { opacity: 0.3 }, panel.at2, 0.3, EASE.inOut));
        }
        if (i === 2) cells.light(panel.at + 0.4, [0, 3], { tone: 'good', step: 0.2 });
      });
    }

    // ----------------------------------------------------------------
    // Verse 3: the iceberg, design choices below the water, the outlet
    // ----------------------------------------------------------------

    function verse3() {
      const start = song.sectionStart('verse-3');
      const end = song.sectionEnd('verse-3');
      const outletAt = line('verse-3-10').start - 0.1;
      kit.badge(hud, 'Verse 3 · The iceberg', start, outletAt);
      kit.badge(hud, 'Verse 3 · Same outlet, new source', outletAt, end);

      const a = kit.scene(content, start, outletAt);
      a.classList.add('ih-iceberg-scene');
      const berg = ih.iceberg(a, { x: 48, y: 84, at: start, gearsFrom: mark('verse-3-3', 'under') });
      berg.swap(mark('verse-3-5', 'freely'));
      ih.waterline(a, { y: 204, x1: 470, x2: 916, at: start });

      // Case-file tags anchor the two halves of the analogy throughout the swap:
      // the tip is public, what lies below the water is sealed.
      fx.rise(ih.publicTag(a, { text: 'Interface', x: 508, y: 104 }), mark('verse-3-1', 'interface'), { distance: 10, duration: 0.3 });
      const promise = kit.el('div', 'ih-verdict ih-verdict--ok ih-ice-promise is-staged', a);
      promise.append(kit.icon('check'));
      promise.append(document.createTextNode('Stays the same'));
      ih.show(promise, mark('verse-3-2', 'stable'), undefined, { rotate: -2, from: 1.4 });
      const deep = ih.envelope(a, { text: 'Implementation', x: 508, y: 232 });
      deep.classList.add('ih-envelope--label');
      ih.show(deep, mark('verse-3-3', 'implementation'), undefined, { rotate: -2, from: 1.6 });
      const leaders = kit.svg('svg', { class: 'ih-ice-leaders', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, a);
      for (const [d, cx, cy, at] of [
        ['M295 137 H504', 295, 137, mark('verse-3-1', 'interface')],
        ['M359 312 H470 V252 H504', 359, 312, mark('verse-3-3', 'implementation')],
      ]) {
        const leader = kit.svg('g', { class: 'is-staged' }, leaders);
        kit.svg('path', { d }, leader);
        kit.svg('circle', { cx, cy, r: 4 }, leader);
        fx.fadeIn(leader, at, 0.3);
      }
      const choices = [
        { a: 'array', b: 'hash table', at: mark('verse-3-7', 'array'), flips: [mark('verse-3-7', 'hash')] },
        { a: 'cache', b: 'no cache', at: mark('verse-3-7', 'cache'), flips: [mark('verse-3-7', 'no')] },
        { a: 'MongoDB', b: 'Supabase', at: mark('verse-3-8', 'mongo'), flips: [mark('verse-3-8', 'supabase'), mark('verse-3-9', 'change')] },
      ];
      choices.forEach((choice, i) => ih.toggle(a, { x: 508, y: 294 + i * 54, ...choice }));

      // The outlet is the interface; the power plant is the secret.
      const b = kit.scene(content, outletAt, end);
      ih.outlet(b, {
        x: 40, y: 98, at: outletAt + 0.1, blindAt: mark('verse-3-10', 'cant'),
        plants: [{ at: 0, kind: 'solar' }, { at: mark('verse-3-11', 'wind') - 0.1, kind: 'wind' }],
      });
      // "The outlet's the interface. The plant's the secret."
      fx.rise(ih.publicTag(b, { text: 'Interface', x: 500, y: 172 }), mark('verse-3-12', 'interface') - 0.2, { distance: 10, duration: 0.3 });
      const plant = ih.envelope(b, { text: 'Power plant', x: 100, y: 108 });
      plant.classList.add('ih-envelope--label');
      ih.show(plant, mark('verse-3-12', 'secret') - 0.2, undefined, { rotate: -3, from: 1.6 });
    }

    // ----------------------------------------------------------------
    // Bridge: private is not enough; hide decisions, not data
    // ----------------------------------------------------------------

    function bridge() {
      badge('Bridge · Private isn’t enough', 'bridge');
      const start = song.sectionStart('bridge');
      const end = song.sectionEnd('bridge');
      const a = kit.scene(content, start, mark('bridge-4', 'hiding') - 0.2);
      student?.appear({ from: start + 0.2, to: mark('bridge-4', 'hiding') - 0.4, x: 24, y: 166, scale: 0.72 });
      ih.bubble(a, { x: 28, y: 64, w: 250, thought: true, text: 'Every field is private. So it’s hidden… right?', at: mark('bridge-1', 'made') });
      const sig = mark('bridge-3', 'signature');
      ih.code(a, {
        x: 300, y: 104, w: 640, title: 'OrderService.java', variant: 'classified', at: line('bridge-1').start + 0.2,
        lines: [
          { parts: [{ text: 'class', cls: 'keyword' }, ' OrderService {'] },
          { parts: ['  ', { text: 'private', cls: 'keyword', mark: 'gold', at: mark('bridge-1', 'private'), until: line('bridge-2').start }, ' ', { text: 'PayPalClient', cls: 'type' }, ' paypal;'] },
          { parts: ['  ', { text: 'private', cls: 'keyword', mark: 'gold', at: mark('bridge-1', 'private') + 0.1, until: line('bridge-2').start }, ' ', { text: 'PayPalAuthToken', cls: 'type' }, ' token;'] },
          { parts: ['  ', { text: 'public', cls: 'keyword' }, ' ', { text: 'PayPalCharge', cls: 'type', mark: 'red', at: mark('bridge-2', 'charge') }, ' checkout(Order o,'] },
          { parts: ['                        ', { text: 'PayPalAccount', cls: 'type', mark: 'red', at: sig }, ' acc) {'] },
          { parts: [{ text: '    … }', cls: 'comment' }] },
          { parts: ['}'] },
        ],
      });
      kit.sticker(a, 'All private ✓', { x: 720, y: 62, at: mark('bridge-1', 'private'), until: line('bridge-2').start, variant: 'green', iconName: 'lock', rotate: 4 });
      ih.note(a, 'returns a PayPal type', { x: 700, y: 62, at: mark('bridge-2', 'returns'), tone: 'red', rotate: 2 });
      ih.slip(a, { x: 470, y: 228, text: 'PayPalCharge', at: mark('bridge-3', 'secrets'), dx: 70, dy: 156, rotate: -7 });
      ih.slip(a, { x: 640, y: 262, text: 'PayPalAccount', at: sig + 0.15, dx: 90, dy: 144, rotate: 6 });
      kit.stamp(a, 'Leaked!', { x: 300, y: 392, at: mark('bridge-3', 'plain'), rotate: -6, shake: false });

      // Private fields alone do not hide a decision exposed by the public API.
      const b = kit.scene(content, mark('bridge-4', 'hiding') - 0.2, line('bridge-6').start - 0.1);
      kit.kinetic(b, [{ text: 'Private fields', at: mark('bridge-4', 'hiding'), color: 'pink' }], { y: 84, size: 56, punch: false });
      kit.stamp(b, 'Not enough', { x: 330, y: 170, at: mark('bridge-4', 'data'), rotate: -5, shake: false });
      kit.kinetic(b, [
        { text: 'Hiding', at: mark('bridge-5', 'hiding') },
        { text: 'decisions', at: mark('bridge-5', 'decisions'), color: 'gold' },
      ], { y: 266, size: 72 });
      ih.show(ih.envelope(b, { text: 'design decision', x: 380, y: 376 }), mark('bridge-5', 'decisions_2'), undefined, { rotate: -4, from: 1.6 });

      // The visible protocol is distinct from the server's hidden database choice.
      const c = kit.scene(content, line('bridge-6').start - 0.1, end);
      ih.contractExchange(c, {
        at: line('bridge-6').start,
        actorsAt: mark('bridge-6', 'callers'),
        contractAt: mark('bridge-6', 'know'),
        protocolAt: mark('bridge-7', 'stateless'),
        confirmedAt: mark('bridge-7', 'contract'),
      });
    }

    // ----------------------------------------------------------------
    // Change test: the debriefing
    // ----------------------------------------------------------------

    function changeTest() {
      badge('Change Impact Analysis', 'change-test');
      const graphAt = mark('change-test-3', 'count');
      const briefing = kit.scene(content, song.sectionStart('change-test'), graphAt, { exit: 'fade' });
      ih.list(briefing, {
        x: 50, y: 96, w: 380, title: 'Change Impact Analysis', at: line('change-test-1').start,
        items: [
          { text: 'List the likely changes', iconName: 'list', at: mark('change-test-2', 'list') },
          { text: 'Pick one', iconName: 'pin', at: mark('change-test-3', 'pick') },
          { text: 'Count the modules it touches', iconName: 'search', at: mark('change-test-3', 'pick') + 0.3 },
        ],
      });
      const changes = ['New payment provider', 'New database', 'Four-digit years'];
      const picked = mark('change-test-3', 'pick');
      changes.forEach((text, i) => {
        const node = kit.sticker(briefing, text, { x: 480, y: 100 + i * 72, at: mark('change-test-2', 'changes') + i * 0.2, variant: i === 0 ? 'gold' : 'white', iconName: 'sparkle', rotate: 0 });
        if (i !== 0) tween(node, { opacity: 0.4 }, picked, 0.3, EASE.inOut);
      });
      const graphs = kit.scene(content, graphAt, song.sectionEnd('change-test'), { exit: 'fade' });
      ih.heading(graphs, ['Change: ', 'new payment provider'], { x: 44, y: 52, at: graphAt, size: 26 });
      const legend = ih.note(graphs, 'Arrows mean “depends on”', { x: 650, y: 57, at: graphAt, tone: 'white', rotate: 0 });
      legend.classList.add('ih-impact-legend');
      ih.changeImpactGraph(graphs, { x: 30, y: 96, mode: 'hidden', at: graphAt + 0.1, changeAt: mark('change-test-4', 'one') });
      ih.changeImpactGraph(graphs, { x: 490, y: 96, mode: 'leaky', at: graphAt + 0.1, changeAt: mark('change-test-4', 'dozens') });
    }

    // ----------------------------------------------------------------
    // Quiz: an interrogation; each answer is redacted until it is said
    // ----------------------------------------------------------------

    function quiz() {
      badge('Pop quiz, agent', 'quiz');
      const { lines } = song.storyboard.sections.find((section) => section.id === 'quiz');
      const QUIZ_ICONS = ['copy', 'lock', 'receipt', 'eye', 'warning', 'gear'];
      ih.lamp(content, { x: 480, y: -6, w: 720, h: 470, at: song.sectionStart('quiz'), until: song.sectionEnd('quiz') });
      lines.forEach((entry, i) => {
        const from = entry.start - 0.15;
        const to = i + 1 < lines.length ? lines[i + 1].start - 0.15 : song.sectionEnd('quiz');
        const s = kit.scene(content, from, to, { enter: 'whip' });
        const cardNode = kit.el('div', 'quiz-card', s);
        kit.el('div', 'quiz-count', cardNode, `Quiz ${i + 1} / ${lines.length}`);
        kit.el('div', 'ih-quiz-label', cardNode, 'Interrogation');
        kit.el('div', 'quiz-question', cardNode, entry.text.replace(/^Pop quiz! /, ''));
        const answer = kit.el('div', 'quiz-answer ih-quiz-answer', cardNode);
        answer.append(kit.icon(QUIZ_ICONS[i]));
        kit.el('span', 'quiz-answer-code', answer, entry.answer);
        const tape = kit.el('div', 'ih-redaction', answer);
        tape.append(kit.icon('lock'));
        tape.append(document.createTextNode('Classified'));
        tween(tape, [{ translate: '0 0', opacity: 1 }, { translate: '105% 0', opacity: 0 }], entry.answer_at, 0.35, EASE.in);
        fx.bump(answer, entry.answer_at + 0.1, 0.06);
        camera.punch(entry.answer_at + 0.05, 0.03);
      });
    }

    // ----------------------------------------------------------------
    // Outro: two digits everywhere vs. one decision in one module
    // ----------------------------------------------------------------

    function outro() {
      const start = song.sectionStart('outro');
      const end = song.duration;
      const a = kit.scene(content, start, line('outro-2').start - 0.1);
      const names = ['Payroll', 'Billing', 'Interest', 'Reports', 'Loans', 'Taxes', 'Grades', 'Shipping'];
      const grid = ih.grid(a, { x: 76, y: 110, cols: 4, cellW: 190, cellH: 46, gap: 14, names, at: start + 0.1, step: 0.03, tag: 'YY', tagAt: start + 0.3, tagStep: 0.03 });
      grid.light(mark('outro-1', 'copied'), names.map((_, i) => i), { step: 0.06 });
      kit.stamp(a, 'Cost: billions', { x: 330, y: 270, at: mark('outro-1', 'billions'), rotate: -5, shake: false });

      // The same programs, now asking one Dates module that hides the format.
      const b = kit.scene(content, line('outro-2').start - 0.1, line('outro-3').start - 0.1);
      const one = ih.module(b, { x: 570, y: 186, w: 300, h: 86, name: 'Dates', at: mark('outro-2', 'decision') });
      ['Payroll', 'Billing', 'Interest', 'Reports'].forEach((name, i) => {
        const caller = ih.module(b, { x: 80, y: 100 + i * 80, w: 230, h: 58, name, at: mark('outro-2', 'one') + i * 0.1 });
        ih.courier(b, { from: [314, 130 + i * 80], to: [566, 228], tone: 'gold', at: mark('outro-2', 'decision') + 0.2 + i * 0.1, period: 1.5 });
        caller.verdict('unchanged', { at: mark('outro-2', 'module_2') + i * 0.12, dx: 124, dy: -12 });
      });
      one.secret('year format', { at: mark('outro-2', 'hidden'), dy: 64 });
      one.light(mark('outro-2', 'change'));
      ih.counter(b, { x: 590, y: 316, label: 'module changed', from: 1, to: 1, at: mark('outro-2', 'module_2'), duration: 0.3 });

      // The finale: the case summary is stamped closed, Agent Payment
      // Gateway keeps the last secret, and an iris closes on the hero.
      // The take's last line was cut, so this plays over the silent tail.
      const c = kit.scene(content, line('outro-3').start - 0.1, end);
      kit.kinetic(c, [
        { text: 'Designing', at: mark('outro-3', 'designing') },
        { text: 'for change', at: mark('outro-3', 'change'), color: 'gold' },
      ], { y: 56, size: 48 });
      ih.spotlight(c, { x: 451, y: 270, w: 480, h: 360, at: line('outro-3').start });
      student?.appear({ from: line('outro-3').start + 0.4, to: end, x: 360, y: 150, scale: 0.7 });
      const summaryAt = mark('outro-3', 'designing');
      ih.paper(c, {
        x: 30, y: 136, w: 320, kicker: 'Case summary', title: 'Information hiding', clip: true, rotate: -2,
        at: summaryAt,
        lines: [
          { text: '1. Hide what may change', at: summaryAt + 0.35 },
          { text: '2. Show what, not how', at: summaryAt + 0.7 },
          { text: '3. 1 change → 1 module', at: mark('outro-3', 'change') + 0.3 },
        ],
      });
      const done = mark('outro-3', 'change');
      ih.spotlight(c, { x: 800, y: 250, w: 300, h: 400, at: done - 0.1 });
      ih.agent(c, { x: 720, y: 108, scale: 0.72, name: 'Payment Gateway', role: 'Agent', look: 'tuxedo', flip: true, at: done });
      ih.show(ih.envelope(c, { text: 'every module keeps a secret', x: 552, y: 384 }), done + 0.5, undefined, { rotate: -1, from: 1.6 });
      kit.stamp(c, 'Case closed', { x: 44, y: 312, at: done + 0.9, color: 'green', rotate: -8, shake: false });
      const credit = kit.el('div', 'end-credit is-staged', c, 'SE Book · Information Hiding');
      credit.style.top = '428px';
      fx.fadeIn(credit, done + 1.3, 0.4);
      ih.iris(c, { cx: 451, cy: 255, from: end - 1.9, to: end - 0.1 });
    }

    // ----------------------------------------------------------------

    intro();
    verse1();
    preChorus1();
    chorus(1);
    verse2();
    preChorus2();
    chorus(2);
    verse3();
    bridge();
    changeTest();
    quiz();
    chorus(3, { title: 'Final chorus', final: true });
    outro();
  };
})();
