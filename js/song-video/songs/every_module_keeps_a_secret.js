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

      // "Y2K. No, not the aesthetic. The bug."
      const a = kit.scene(content, 0, line('intro-2').start - 0.1);
      ih.spotlight(a, { x: 480, y: 200, w: 620, h: 420, at: 3.4 });
      kit.kinetic(a, [{ text: 'Y2K', at: mark('intro-1', 'y2k'), color: 'gold' }], { y: 112, size: 140 });
      kit.sticker(a, 'Not the aesthetic', { x: 150, y: 292, at: mark('intro-1', 'not'), until: mark('intro-1', 'bug') - 0.05, variant: 'pink', iconName: 'sparkle', rotate: -6 });
      kit.stamp(a, 'The bug', { x: 380, y: 296, at: mark('intro-1', 'bug'), rotate: -6, shake: false });
      ih.bug(a, { x: 640, y: 286, at: mark('intro-1', 'bug') - 0.6, size: 86, rotate: -70, from: [900, 330] });

      // Memory was expensive, so the year lost its first two digits.
      const b = kit.scene(content, line('intro-2').start - 0.1, line('intro-6').start - 0.1);
      ih.note(b, '1960s', { x: 96, y: 70, at: mark('intro-2', 'sixties'), tone: 'gold', rotate: -4 });
      ih.mainframe(b, { x: 40, y: 100, at: line('intro-2').start });
      kit.sticker(b, 'Memory: $$$', { x: 76, y: 312, at: mark('intro-2', 'expensive'), variant: 'red', iconName: 'receipt', rotate: -4 });
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
          { at: mark('intro-7', '1900'), month: 'JAN', day: 1, year: 1900, tone: 'bad' },
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
      kit.stamp(d, '−85 years old', { x: 120, y: 330, at: mark('intro-9', 'years'), rotate: -5, shake: false });
      ih.bubble(d, {
        x: 600, y: 96, w: 300, who: '1970s programmer', whoIcon: 'user', thought: true,
        text: 'This code will be replaced long before 2000.', at: mark('intro-10', 'thought'),
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
        x: 110, y: 90, w: 740, query: 'YY', at: line('intro-14').start, typedAt: mark('intro-14', 'hunting'),
        hitsAt: mark('intro-15', 'every'), step: 0.18,
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
        x: 60, y: 146, w: 520, tab: 'Case file · Information hiding',
        title: 'Every module keeps a secret', sub: 'A secret is a design decision that might change.',
        at: mark('intro-19', 'every'),
      });
      kit.stamp(h, 'Top secret', { x: 330, y: 330, at: mark('intro-19', 'secret') + 0.15, rotate: -10, shake: false });
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
      ih.apolloPortrait(a, { x: 24, y: 94, at: mark('verse-1-1', 'printed') });
      const apollo = kit.el('div', 'ih-code-record ih-code-record--apollo is-staged', a);
      kit.el('div', 'ih-code-record-year', apollo, 'Apollo 11 · 1969');
      kit.el('div', 'ih-code-record-count', apollo, '≈80,000');
      kit.el('div', 'ih-code-record-unit', apollo, 'lines of code');
      kit.el('div', 'ih-code-record-scope', apollo, 'Command + lunar modules; comments excluded');
      const credit = kit.el('div', 'ih-hamilton-credit is-staged', apollo);
      kit.el('strong', '', credit, 'Margaret Hamilton');
      kit.el('span', '', credit, 'Lead software engineer');
      kit.el('span', '', credit, 'Apollo onboard flight software · MIT');
      fx.fadeIn(apollo, mark('verse-1-1', 'code'), 0.3);
      fx.fadeIn(credit, mark('verse-1-2', 'margaret'), 0.3);
      ih.car(a, { x: 570, y: 132, at: mark('verse-1-3', 'car'), until: line('verse-1-4').start - 0.25, w: 290 });
      const car = kit.el('div', 'ih-code-record ih-code-record--car is-staged', a);
      kit.el('div', 'ih-code-record-year', car, 'Modern car · 2021');
      const carCount = ih.counter(car, { x: 0, y: 0, label: 'lines of code', from: 0, to: 100000000, at: mark('verse-1-3', 'a_2') - 0.1, duration: 0.65, format: (n) => `≈${n.toLocaleString('en-US')}` });
      carCount.classList.add('ih-code-record-counter');
      kit.el('div', 'ih-code-record-scope', car, 'Bosch estimate · vehicle-wide software');
      fx.fadeIn(car, mark('verse-1-3', 'car'), 0.3);

      // Keep both code records visible while the car gives way to one person's
      // limited working memory; this is still the same comparison scene.
      ih.overflowingHead(a, { x: 645, y: 43, at: line('verse-1-4').start, overflowAt: mark('verse-1-5', 'holds') });
      kit.sticker(a, '×1000 smarter? No.', { x: 600, y: 72, at: mark('verse-1-4', 'thousand'), until: line('verse-1-5').start, variant: 'white', iconName: 'cross', rotate: -3 });
      kit.sticker(a, 'Too much for one head', { x: 590, y: 245, at: mark('verse-1-5', 'whole'), variant: 'pink', iconName: 'warning', rotate: 0 });

      // The corkboard: 4 modules → 6 strings, 8 modules → 28; then mud.
      const c = kit.scene(content, line('verse-1-6').start - 0.1, line('verse-1-10').start - 0.1);
      ih.stringWeb(c, { x: 24, y: 76, w: 350, h: 340, names: ['Cart', 'Order', 'Pay', 'Ship'], title: 'Case: 4 modules', at: mark('verse-1-6', 'four'), drawFor: 0.9, until: mark('verse-1-8', 'let') });
      const board = ih.stringWeb(c, { x: 392, y: 64, w: 548, h: 384, names: ['Cart', 'Order', 'Pay', 'Ship', 'Auth', 'Mail', 'Tax', 'Stock'], title: 'Case: 8 modules', at: mark('verse-1-7', 'eight'), drawFor: 1.8 });
      fx.moveTo(board.node, mark('verse-1-8', 'let'), -200, 0, 0.6);
      board.mud(mark('verse-1-9', 'youve') - 0.2);
      ih.note(c, 'everything depends on everything', { x: 230, y: 30, at: mark('verse-1-8', 'depend'), until: mark('verse-1-9', 'big'), tone: 'red', rotate: -2 });
      kit.stamp(c, 'Big Ball of Mud', { x: 250, y: 396, at: mark('verse-1-9', 'big'), color: 'gold', rotate: -4, shake: false });

      // One change touches dozens of files; squash one bug, two crawl in.
      const d = kit.scene(content, line('verse-1-10').start - 0.1, song.sectionEnd('verse-1'));
      ih.mud(d, { x: 332, y: 304, size: 170, at: line('verse-1-10').start - 0.1 });
      ih.note(d, 'Big Ball of Mud', { x: 352, y: 470, at: line('verse-1-10').start - 0.1, tone: 'gold', rotate: -2 });
      const files = ['cart.js', 'order.js', 'refund.js', 'wallet.js', 'auth.js', 'mail.js', 'tax.js', 'report.js', 'admin.js', 'search.js', 'ship.js', 'stock.js'];
      const grid = ih.grid(d, { x: 40, y: 92, cols: 3, cellW: 176, cellH: 40, gap: 12, names: files, at: line('verse-1-10').start - 0.05, step: 0.03 });
      grid.light(mark('verse-1-10', 'change'), [4], { tone: 'change', stamp: 'Changed' });
      grid.light(mark('verse-1-10', 'touch'), [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11], { step: 0.07, stamp: 'Hit' });
      ih.counter(d, { x: 50, y: 316, label: 'files touched', from: 1, to: 12, at: mark('verse-1-10', 'touch'), duration: 0.9 });
      ih.bug(d, { x: 700, y: 170, at: mark('verse-1-11', 'fix') - 0.5, squashAt: mark('verse-1-11', 'bug') + 0.1, size: 96, rotate: 200, from: [720, 30] });
      ih.stampTool(d, { x: 748, y: 251, pressDepth: 63, at: mark('verse-1-11', 'bug') + 0.1, label: 'FIXED' });
      ih.bug(d, { x: 610, y: 300, at: mark('verse-1-11', 'two'), size: 80, rotate: 60, from: [480, 340] });
      ih.bug(d, { x: 790, y: 290, at: mark('verse-1-11', 'more'), size: 80, rotate: -60, from: [960, 340] });
      kit.sticker(d, '+2 bugs', { x: 790, y: 150, at: mark('verse-1-11', 'appear'), variant: 'red', iconName: 'warning', rotate: 5 });
    }

    // ----------------------------------------------------------------
    // Pre-chorus 1: not by the steps, by the decisions (Parnas, 1972)
    // ----------------------------------------------------------------

    function preChorus1() {
      badge('Pre-chorus · How to split a system', 'pre-chorus-1');
      const s = kit.scene(content, song.sectionStart('pre-chorus-1'), song.sectionEnd('pre-chorus-1'));
      const paperAt = mark('pre-chorus-1-3', '1972');
      ih.heading(s, ['How do you split a system into ', 'modules', '?'], { x: 120, y: 76, at: line('pre-chorus-1-1').start, until: paperAt - 0.1 });
      ih.steps(s, { x: 110, y: 168, labels: [{ text: '1 · Read input', iconName: 'file' }, { text: '2 · Process', iconName: 'gear' }, { text: '3 · Print', iconName: 'receipt' }], at: mark('pre-chorus-1-2', 'steps'), step: 0.35, until: paperAt - 0.1 });
      kit.stamp(s, 'Not by steps', { x: 300, y: 262, at: mark('pre-chorus-1-2', 'then'), rotate: -5, shake: false, until: paperAt - 0.1 });
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
      { name: 'Dates', secret: 'year format', iconName: 'timer' },
      { name: 'PaymentGateway', secret: 'provider', iconName: 'receipt' },
      { name: 'UserRepository', secret: 'database', iconName: 'stack' },
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
        x: 64, y: 52, w: 832, at: line(ln(1)).start - 0.3, origin: 'CACM · 1972',
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
        const box = ih.module(q, { x: 64 + i * 284, y: 352, w: 258, h: 64, name: item.name, iconName: item.iconName, at: each + i * 0.18 });
        box.secret(item.secret, { at: mark(ln(5), 'hide') + i * 0.12, dy: 46 });
      });
      for (const wallX of [334, 618]) ih.laser(q, { x: wallX, y1: 340, y2: 430, at: mark(ln(5), 'from') + 0.05 });

      // One module as a vault: the nameplate stays, the secret changes.
      const ex = EXAMPLES[n];
      const t = kit.scene(content, tagStart - 0.2, song.sectionEnd(id), { exit: 'fade' });
      kit.kinetic(t, [
        { text: 'Every module', at: mark(ln(6), 'every') },
        { text: 'keeps a secret', at: mark(ln(6), 'secret'), color: 'gold' },
      ], { y: 50, size: 38 });
      const box = ih.vault(t, {
        x: 40, y: 110, w: 470, name: ex.name, what: ex.what,
        hows: [{ at: 0, text: ex.hows[0] }, { at: mark(ln(8), 'how'), text: ex.hows[1] }],
        at: mark(ln(6), 'module'), whatAt: mark(ln(7), 'what'), howAt: mark(ln(7), 'how'),
      });
      // The callers send their requests to the nameplate only: they don't change.
      const youChange = mark(ln(9), 'change');
      ex.callers.forEach((name, i) => {
        const caller = ih.module(t, { x: 668, y: 118 + i * 98, w: 252, h: 60, name, iconName: 'user', at: mark(ln(6), 'secret') + i * 0.12 });
        ih.courier(t, { from: [664, 150 + i * 98], to: [516, 196], tone: 'gold', at: mark(ln(6), 'secret') + 0.3 + i * 0.12, period: 1.6 });
        caller.verdict('unchanged', { at: youChange + 0.3 + i * 0.15, dx: 134, dy: -12 });
      });
      box.light(mark(ln(9), 'module'));
      ih.counter(t, { x: 60, y: 384, label: 'module changed', from: 0, to: 1, at: mark(ln(9), 'module'), duration: 0.3 });
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
      const services = [
        { name: 'OrderService', sub: 'checkout', at: mark('verse-2-1', 'checkout') },
        { name: 'RefundService', sub: 'refunds', at: mark('verse-2-1', 'refunds') },
        { name: 'WalletService', sub: 'wallet', at: mark('verse-2-1', 'wallet') },
      ].map((spec, i) => ({ ...spec, box: ih.module(s, { x: 40, y: 96 + i * 116, w: 256, h: 80, name: spec.name, sub: spec.sub, iconName: 'gear', at: spec.at }) }));
      const tangle = kit.scene(s, mark('verse-2-2', 'all') - 0.1, hideAt + 0.3, { exit: 'fade' });
      ih.module(tangle, { x: 424, y: 196, w: 210, h: 104, name: 'PayPal', sub: 'payment SDK', kind: 'external', iconName: 'globe', at: mark('verse-2-2', 'paypal') });
      services.forEach((service, i) => {
        ih.courier(tangle, { from: [300, 136 + i * 116], to: [420, 248], tone: 'pink', at: mark('verse-2-2', 'call') + i * 0.12, period: 1.3 });
        service.box.secret('PayPal decision', { at: mark('verse-2-3', 'know') + i * 0.15, until: hideAt, dx: 22, dy: 62 });
      });
      ih.bubble(tangle, { x: 430, y: 72, w: 270, who: 'The chief', whoIcon: 'chat', text: '“We’re switching to Stripe!”', at: mark('verse-2-4', 'boss') + 0.3, until: line('verse-2-5').start - 0.1 });

      // Intercepting every mention of PayPal: it's everywhere.
      ih.search(tangle, {
        x: 326, y: 86, w: 614, query: 'PayPal', at: line('verse-2-5').start, typedAt: mark('verse-2-5', 'search'),
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
        x: 396, y: 108, w: 280, h: 132, name: 'PaymentGateway', kind: 'interface', iconName: 'shield',
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
      const agentTo = line('verse-2-9').start - 0.1;
      ih.spotlight(s, { x: 800, y: 210, w: 320, h: 420, at: agentFrom, until: agentTo });
      ih.agent(s, { x: 742, y: 60, scale: 0.66, name: 'Payment Gateway', role: 'Agent', tie: 'gold', at: agentFrom, until: agentTo });
      kit.sticker(s, 'Secret: which provider', { x: 690, y: 340, at: mark('verse-2-8', 'gateway_2'), until: agentTo, variant: 'red', iconName: 'lock', rotate: -3 });

      // Only PayPalGateway knows PayPal exists; Stripe plugs in beside it.
      const paypal = ih.module(s, { x: 396, y: 318, w: 260, h: 74, name: 'PayPalGateway', iconName: 'box', at: mark('verse-2-9', 'paypal') });
      ih.courier(s, { from: [526, 312], to: [526, 246], tone: 'gold', at: mark('verse-2-9', 'gateway'), period: 1.4 });
      ih.note(s, 'implements', { x: 538, y: 262, at: mark('verse-2-9', 'gateway') + 0.1, tone: 'gold', rotate: 0 });
      paypal.secret('PayPal decision', { at: mark('verse-2-9', 'knows'), dy: 56 });
      paypal.light(mark('verse-2-9', 'knows'), mark('verse-2-10', 'plug'));
      ih.module(s, { x: 724, y: 228, w: 200, h: 80, name: 'PayPal', kind: 'external', iconName: 'globe', at: mark('verse-2-9', 'exists') - 0.2, until: mark('verse-2-10', 'stripe') });
      ih.courier(s, { from: [660, 346], to: [722, 288], tone: 'cyan', at: mark('verse-2-9', 'exists'), until: mark('verse-2-10', 'stripe'), period: 1.2 });
      const stripe = ih.module(s, { x: 688, y: 318, w: 250, h: 74, name: 'StripeGateway', iconName: 'box', at: mark('verse-2-10', 'write') });
      ih.courier(s, { from: [700, 314], to: [646, 242], tone: 'gold', at: mark('verse-2-10', 'plug'), period: 1.4 });
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
      badge('Verse 3 · The iceberg', 'verse-3');
      const start = song.sectionStart('verse-3');
      const end = song.sectionEnd('verse-3');
      const outletAt = line('verse-3-10').start - 0.1;

      const a = kit.scene(content, start, outletAt);
      const berg = ih.iceberg(a, { x: 30, y: 84, at: line('verse-3-1').start, gearsFrom: mark('verse-3-3', 'under') });
      ih.submarine(a, { x: 34, y: 352, at: mark('verse-3-3', 'under') - 0.3, pingFrom: mark('verse-3-3', 'water') });
      ih.waterline(a, { y: 204, x1: 440, x2: 940, at: mark('verse-3-6', 'below') });
      const tip = ih.bergLabel(a, { x: 290, y: 82, title: 'Interface', sub: 'what it does: a stable contract', tone: 'tip', at: mark('verse-3-1', 'interface') });
      fx.bump(tip, mark('verse-3-2', 'contract'), 0.08);
      ih.bergLabel(a, { x: 268, y: 384, title: 'Implementation', sub: 'how it keeps its promise', tone: 'deep', at: mark('verse-3-3', 'implementation') });
      berg.swap(mark('verse-3-5', 'freely'));
      kit.sticker(a, 'Change it freely', { x: 150, y: 430, at: mark('verse-3-5', 'freely'), until: mark('verse-3-6', 'what'), variant: 'cyan', iconName: 'gear', rotate: -3 });
      ih.heading(a, ['What goes ', 'below', '?'], { x: 520, y: 126, at: mark('verse-3-6', 'below'), size: 28 });
      ih.note(a, 'classified: choices that could change', { x: 520, y: 172, at: mark('verse-3-6', 'choices'), tone: 'cyan', rotate: -2 });
      const toggles = [
        ih.toggle(a, { x: 520, y: 236, a: 'array', b: 'hash table', at: mark('verse-3-7', 'array'), flips: [mark('verse-3-7', 'hash')] }),
        ih.toggle(a, { x: 520, y: 296, a: 'cache', b: 'no cache', at: mark('verse-3-7', 'cache'), flips: [mark('verse-3-7', 'no')] }),
        ih.toggle(a, { x: 520, y: 356, a: 'MongoDB', b: 'Supabase', at: mark('verse-3-8', 'mongo'), flips: [mark('verse-3-8', 'supabase'), mark('verse-3-9', 'change')] }),
      ];
      const sink = mark('verse-3-8', 'hide');
      toggles.forEach((node, i) => fx.moveTo(node, sink + i * 0.08, 0, 14, 0.4));
      kit.sticker(a, 'Changed later', { x: 784, y: 368, at: mark('verse-3-9', 'mind'), variant: 'gold', iconName: 'loop', rotate: 5 });

      // The outlet is the interface; the power plant is the secret.
      const b = kit.scene(content, outletAt, end);
      ih.outlet(b, {
        x: 168, y: 88, scale: 1.25, at: outletAt + 0.1,
        plants: [{ at: 0, kind: 'solar' }, { at: mark('verse-3-11', 'wind') - 0.1, kind: 'wind' }],
      });
      ih.bergLabel(b, { x: 560, y: 52, title: 'Interface', sub: 'the outlet', tone: 'tip', at: mark('verse-3-12', 'interface') });
      ih.show(ih.envelope(b, { text: 'the power plant', x: 262, y: 52 }), mark('verse-3-12', 'plants'), undefined, { rotate: -3, from: 1.6 });
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
          { parts: ['  ', { text: 'private', cls: 'keyword', mark: 'gold', at: mark('bridge-1', 'private'), until: line('bridge-2').start }, ' ', { text: 'PayPalClient', cls: 'type', mark: 'red', at: sig + 0.25 }, ' paypal;'] },
          { parts: ['  ', { text: 'private', cls: 'keyword', mark: 'gold', at: mark('bridge-1', 'private') + 0.1, until: line('bridge-2').start }, ' ', { text: 'PayPalAuthToken', cls: 'type', mark: 'red', at: sig + 0.4 }, ' token;'] },
          { parts: ['  ', { text: 'public', cls: 'keyword' }, ' ', { text: 'PayPalCharge', cls: 'type', mark: 'red', at: mark('bridge-2', 'charge') }, ' checkout(Order o,'] },
          { parts: ['                        ', { text: 'PayPalAccount', cls: 'type', mark: 'red', at: sig }, ' acc) {'] },
          { parts: [{ text: '    … }', cls: 'comment' }] },
          { parts: ['}'] },
        ],
      });
      kit.sticker(a, 'All private ✓', { x: 720, y: 70, at: mark('bridge-1', 'private'), until: line('bridge-2').start, variant: 'green', iconName: 'lock', rotate: 4 });
      ih.note(a, 'returns a PayPal type', { x: 700, y: 70, at: mark('bridge-2', 'returns'), tone: 'red', rotate: 2 });
      ih.slip(a, { x: 470, y: 228, text: 'PayPalCharge', at: mark('bridge-3', 'secrets'), dx: 190, dy: 150, rotate: -10 });
      ih.slip(a, { x: 640, y: 262, text: 'PayPalAccount', at: sig + 0.15, dx: 110, dy: 140, rotate: 9 });
      kit.stamp(a, 'Leaked!', { x: 300, y: 392, at: mark('bridge-3', 'plain'), rotate: -6, shake: false });

      // Not hiding data: hiding decisions.
      const b = kit.scene(content, mark('bridge-4', 'hiding') - 0.2, line('bridge-6').start - 0.1);
      kit.kinetic(b, [{ text: 'Hiding data', at: mark('bridge-4', 'hiding'), color: 'pink' }], { y: 112, size: 56, punch: false });
      kit.stamp(b, 'Not it', { x: 400, y: 182, at: mark('bridge-4', 'data'), rotate: -8, shake: false });
      kit.kinetic(b, [
        { text: 'Hiding', at: mark('bridge-5', 'hiding') },
        { text: 'decisions', at: mark('bridge-5', 'decisions'), color: 'gold' },
      ], { y: 262, size: 72 });
      ih.show(ih.envelope(b, { text: 'design decision', x: 380, y: 366 }), mark('bridge-5', 'decisions_2'), undefined, { rotate: -4, from: 1.6 });

      // Don't hide what callers need: statelessness is a contract clause.
      const c = kit.scene(content, line('bridge-6').start - 0.1, end);
      ih.heading(c, ['Don’t hide what callers ', 'need to know'], { x: 150, y: 52, at: line('bridge-6').start });
      ih.agent(c, { x: 60, y: 110, scale: 0.7, name: 'Client', role: 'Caller', tie: 'cyan', at: mark('bridge-6', 'callers') });
      ih.agent(c, { x: 790, y: 110, scale: 0.7, name: 'Server', role: 'Module', tie: 'red', at: mark('bridge-6', 'callers') + 0.15, flip: true });
      ih.show(ih.envelope(c, { text: 'SQL or NoSQL', x: 660, y: 372 }), mark('bridge-6', 'know') + 0.2, undefined, { rotate: 3, from: 1.6 });
      ih.paper(c, {
        x: 300, y: 130, w: 360, kicker: 'Visible contract', title: 'Client ⇄ Server', at: mark('bridge-6', 'know'), rotate: 1,
        lines: [
          { text: 'request → response', at: mark('bridge-6', 'know') + 0.3 },
          { text: 'Clause: stateless or stateful?', at: mark('bridge-7', 'stateless') },
        ],
      });
      kit.stamp(c, 'In the contract', { x: 330, y: 282, at: mark('bridge-7', 'contract'), color: 'green', rotate: -5, shake: false });
    }

    // ----------------------------------------------------------------
    // Change test: the debriefing
    // ----------------------------------------------------------------

    function changeTest() {
      badge('Debrief · The change test', 'change-test');
      const s = kit.scene(content, song.sectionStart('change-test'), song.sectionEnd('change-test'));
      ih.list(s, {
        x: 50, y: 96, w: 380, title: 'Debrief: change test', at: line('change-test-1').start,
        items: [
          { text: 'List the likely changes', iconName: 'list', at: mark('change-test-2', 'list') },
          { text: 'Pick one', iconName: 'pin', at: mark('change-test-3', 'pick') },
          { text: 'Count the modules it touches', iconName: 'search', at: mark('change-test-3', 'count') },
        ],
      });
      const changes = ['New payment provider', 'New database', 'Four-digit years'];
      const picked = mark('change-test-3', 'pick');
      changes.forEach((text, i) => {
        const node = kit.sticker(s, text, { x: 480 + (i % 2) * 230, y: 86 + Math.floor(i / 2) * 48, at: mark('change-test-2', 'changes') + i * 0.2, variant: i === 0 ? 'gold' : 'white', iconName: 'sparkle', rotate: i % 2 ? 3 : -3 });
        if (i === 0) fx.bump(node, picked, 0.2);
        else tween(node, { opacity: 0.4 }, picked, 0.3, EASE.inOut);
      });
      const names = ['Order', 'Refund', 'Wallet', 'Report', 'Gateway', 'Admin'];
      ih.note(s, 'Hidden well', { x: 480, y: 194, at: mark('change-test-3', 'modules'), tone: 'green', rotate: -2 });
      const good = ih.grid(s, { x: 480, y: 232, cols: 3, cellW: 140, cellH: 36, gap: 12, names, at: mark('change-test-3', 'modules'), step: 0.04 });
      good.light(mark('change-test-4', 'one'), [4], { tone: 'change', stamp: 'Only' });
      kit.sticker(s, 'Just one: you’re good', { x: 70, y: 330, at: mark('change-test-4', 'good'), variant: 'green', iconName: 'check', rotate: -3 });
      ih.note(s, 'Leaky', { x: 480, y: 326, at: mark('change-test-3', 'change'), tone: 'red', rotate: -2 });
      const bad = ih.grid(s, { x: 480, y: 364, cols: 3, cellW: 140, cellH: 36, gap: 12, names, at: mark('change-test-3', 'change'), step: 0.04 });
      bad.light(mark('change-test-4', 'dozens'), [0, 1, 2, 3, 4, 5], { step: 0.06, stamp: 'Hit' });
      kit.stamp(s, 'Redesign', { x: 110, y: 390, at: mark('change-test-4', 'redesign'), rotate: -5, shake: false });
    }

    // ----------------------------------------------------------------
    // Quiz: an interrogation; each answer is redacted until it is said
    // ----------------------------------------------------------------

    function quiz() {
      badge('Pop quiz, agent', 'quiz');
      const { lines } = song.storyboard.sections.find((section) => section.id === 'quiz');
      const QUIZ_ICONS = ['copy', 'eye', 'check', 'lock', 'box', 'link', 'gear'];
      ih.lamp(content, { x: 480, y: -6, w: 720, h: 470, at: song.sectionStart('quiz'), until: song.sectionEnd('quiz') });
      lines.forEach((entry, i) => {
        const from = entry.start - 0.15;
        const to = i + 1 < lines.length ? lines[i + 1].start - 0.15 : song.sectionEnd('quiz');
        const s = kit.scene(content, from, to, { enter: 'whip' });
        const cardNode = kit.el('div', 'quiz-card', s);
        kit.el('div', 'quiz-count', cardNode, `Quiz ${i + 1} / ${lines.length}`);
        kit.el('div', 'ih-quiz-label', cardNode, 'Interrogation');
        kit.el('div', 'quiz-question', cardNode, entry.text.replace(/^Pop quiz, agent! /, ''));
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
      const one = ih.module(b, { x: 570, y: 186, w: 300, h: 86, name: 'Dates', iconName: 'timer', at: mark('outro-2', 'decision') });
      ['Payroll', 'Billing', 'Interest', 'Reports'].forEach((name, i) => {
        const caller = ih.module(b, { x: 80, y: 100 + i * 80, w: 230, h: 58, name, iconName: 'user', at: mark('outro-2', 'one') + i * 0.1 });
        ih.courier(b, { from: [314, 130 + i * 80], to: [566, 228], tone: 'gold', at: mark('outro-2', 'decision') + 0.2 + i * 0.1, period: 1.5 });
        caller.verdict('unchanged', { at: mark('outro-2', 'module_2') + i * 0.12, dx: 124, dy: -12 });
      });
      one.secret('year format', { at: mark('outro-2', 'hidden'), dy: 64 });
      one.light(mark('outro-2', 'change'));
      ih.counter(b, { x: 590, y: 316, label: 'module changed', from: 0, to: 1, at: mark('outro-2', 'module_2'), duration: 0.3 });

      const c = kit.scene(content, line('outro-3').start - 0.1, end - 0.3, { exit: 'fade' });
      kit.kinetic(c, [
        { text: 'Designing', at: mark('outro-3', 'designing') },
        { text: 'for change', at: mark('outro-3', 'change'), color: 'gold' },
      ], { y: 64, size: 48 });
      ih.spotlight(c, { x: 480, y: 280, w: 520, h: 380, at: line('outro-3').start });
      student?.appear({ from: line('outro-3').start + 0.4, to: end - 0.5, x: 350, y: 140, scale: 0.86 });
      kit.sticker(c, 'Shh…', { x: 236, y: 200, at: mark('outro-4', 'shh'), variant: 'pink', iconName: 'lock', rotate: -6 });
      kit.sticker(c, 'Every module keeps a secret', { x: 590, y: 214, at: mark('outro-4', 'every'), variant: 'gold', iconName: 'box', rotate: 4 });
      kit.stamp(c, 'Case closed', { x: 620, y: 300, at: mark('outro-4', 'secret') + 0.3, color: 'green', rotate: -8, shake: false });
      const credit = kit.el('div', 'end-credit is-staged', c, 'SE Book · Information Hiding');
      credit.style.top = '420px';
      fx.fadeIn(credit, mark('outro-4', 'secret') + 0.6, 0.4);
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
