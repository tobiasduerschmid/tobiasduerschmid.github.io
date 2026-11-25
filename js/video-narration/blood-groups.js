/*
 * Choreography for the Module Blood Groups video narration (script:
 * _data/narrations/blood_groups.yml; artwork: blood-groups-kit.js on the
 * shared wall kit). The narration reaches this stage as a song: each scene is
 * a section and each cue a line, and `at(cue, word)` is the estimated time
 * the narrator says that word (repeated words are word2, word3, ...). Cues
 * are named by their stable script ids ('intro/late'), looked up in the
 * storyboard, so reordering the script never misplaces a picture.
 *
 * The teaching rule for the pictures: show the mechanism the cue names, with
 * Glide's scooter app as the example, and write every group as its letter as
 * well as its color. The tangled end_ride() is the through-line: the group
 * scenes pull its lines apart, the design scenes rebuild it separated, and
 * the change scenes replay the same three changes against both. Stamps never
 * shake the stage, and nothing large changes brightness quickly (WCAG 2.3.1).
 * Layout: the 960x540 picture body; nothing readable within 12px of an edge.
 */
(function () {
  'use strict';

  const TOPICS = {
    intro: { kind: 'Example', name: 'Glide, the scooter app', iconName: 'pin' },
    tangle: { kind: 'Problem', name: 'The tangle', iconName: 'warning' },
    two_questions: { kind: 'Groups', name: 'Two questions', iconName: 'question' },
    group_a: { kind: 'Group', name: 'A · the application', iconName: 'list' },
    group_t: { kind: 'Group', name: 'T · the technology', iconName: 'plug' },
    group_zero: { kind: 'Group', name: '0 · neither', iconName: 'hash' },
    group_at: { kind: 'Group', name: 'AT · both at once', iconName: 'merge' },
    mixing: { kind: 'Mixing', name: 'The blood-group rules', iconName: 'merge' },
    leaks: { kind: 'Mixing', name: 'Leaky interfaces', iconName: 'warning' },
    separate: { kind: 'Design', name: 'Rule 1 · minimize AT', iconName: 'scissors' },
    invert: { kind: 'Design', name: 'Rule 2 · technology plugs in', iconName: 'plug' },
    frameworks: { kind: 'Design', name: 'Frameworks at arm’s length', iconName: 'gear' },
    change_test: { kind: 'Change', name: 'Replay the changes', iconName: 'loop' },
    balance: { kind: 'Change', name: 'Know when to stop', iconName: 'target' },
    summary: { kind: 'Recap', name: 'Two questions, four groups', iconName: 'check' },
  };

  /** The stage's line id for each cue ('scene/cue' to 'scene-n'), from the storyboard. */
  function lineIds() {
    const story = JSON.parse(document.getElementById('narration-storyboard').textContent);
    const ids = {};
    story.scenes.forEach((scene) => scene.cues.forEach((cue, i) => { ids[`${scene.id}/${cue.id}`] = `${scene.id}-${i + 1}`; }));
    return ids;
  }

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.blood_groups = function choreograph({ song, kit, layers }) {
    const { fx } = window.Timeline;
    const wall = window.WallKit;
    const bk = window.BloodKit;
    const { content } = layers;
    const ids = lineIds();
    const line = (cue) => {
      if (!ids[cue]) throw new Error(`Unknown cue ${cue}`);
      return ids[cue];
    };
    const begin = (cue) => song.line(line(cue)).start;
    const end = (cue) => song.line(line(cue)).end;
    const at = (cue, word) => song.mark(line(cue), word);

    /** One picture from the start of cue `from` to the end of cue `to`, headed by its scene's topic. */
    function picture(from, to = from) {
      const node = kit.scene(content, begin(from), end(to), { exit: 'fade' });
      wall.topicTag(node, { ...TOPICS[from.split('/')[0]], at: begin(from) + 0.15 });
      return wall.body(node);
    }
    const sticker = (parent, text, options) => kit.sticker(parent, text, { rotate: -3, ...options });
    const stamp = (parent, text, options) => kit.stamp(parent, text, { shake: false, from: 1.8, ...options });
    const centered = (node) => { node.classList.add('bg-center'); return node; };

    /** end_ride() as written: one card whose chips braid rule and technology work. */
    function tangleCard(parent, { x, y, w = 300, at: when, until, group, changes }) {
      return bk.moduleCard(parent, {
        x, y, w, title: 'end_ride()', group, changes, at: when, until,
        chips: [
          { text: 'Map lookup', tone: 't' }, { text: 'Parking rule', tone: 'a' }, { text: 'Price', tone: 'a' },
          { text: 'Payment call', tone: 't' }, { text: 'Bluetooth lock', tone: 't' },
        ],
      }).node;
    }

    /** A compact copy of a module that flies from (x, y) by (dx, dy) to where it is reused. */
    function reusedCopy(parent, { x, y, dx, dy, w, title, group, at: when, until }) {
      const copy = bk.moduleCard(parent, { x, y, w, title, group, at: when, until, how: 'pop' }).node;
      fx.moveTo(copy, when + 0.45, dx, dy, 0.9);
      return copy;
    }

    // ----------------------------------------------------------------
    // Intro: the ride, the app's three kinds of work, the price hike
    // ----------------------------------------------------------------

    function intro() {
      const late = 'intro/late';
      const a = picture(late);
      const mapX = 24;
      const mapY = 76;
      sticker(a, '9:56 · lecture at 10:00', { x: 30, y: 12, at: at(late, 'nine'), variant: 'gold', iconName: 'timer' });
      bk.campusMap(a, { x: mapX, y: mapY, at: begin(late) + 0.1 });
      bk.scooter(a, { mapX, mapY, path: bk.CAMPUS.ride, at: at(late, 'zip'), duration: at(late, 'stop') - at(late, 'zip') });
      bk.phone(a, { x: 650, y: 70, at: at(late, 'phone'), tapAt: at(late, 'tap'), toastAt: at(late, 'no') });

      const jobs = 'intro/jobs';
      const b = picture(jobs);
      const tray = (x, title, iconName, tone, word, items) => wall.listCard(b, {
        x, y: 30, w: 290, h: 420, title, iconName, at: at(jobs, word),
        items: items.map(([text, cue]) => ({ text, at: at(jobs, cue) })),
      }).classList.add(`bg-tray--${tone}`);
      tray(24, 'Rules', 'list', 'a', 'rules', [['Where you may park', 'park'], ['What a ride costs', 'costs'], ['Student discount', 'discount']]);
      tray(335, 'Technology', 'plug', 't', 'technology', [['Map service', 'map'], ['Payment service', 'payment'], ['Bluetooth lock', 'bluetooth']]);
      tray(646, 'Plain math', 'hash', 'zero', 'math', [['Is a point inside a zone?', 'checking']]);
      bk.zoneCheck(b, { x: 680, y: 250, at: at(jobs, 'checking'), dotAt: at(jobs, 'point') });

      const hike = 'intro/price_hike';
      const c = picture(hike);
      wall.badge(c, { x: 64, y: 110, w: 150, role: 'You', iconName: 'user', at: at(hike, 'joined') });
      wall.skill(c, { x: 44, y: 260, w: 190, text: 'New on the Glide team', at: at(hike, 'team') });
      bk.invoice(c, {
        x: 290, y: 30, w: 400, title: 'Map service · monthly bill', at: at(hike, 'news'),
        rows: [
          { label: 'Last month', value: '$400' },
          { label: 'Next month', value: '$4,000', at: at(hike, 'tenfold'), isNew: true },
        ],
      });
      stamp(c, 'Price hike', { x: 330, y: 196, at: at(hike, 'tenfold') + 0.4, color: 'red', rotate: -6 });
      sticker(c, 'Switch providers', { x: 640, y: 206, at: at(hike, 'switch'), variant: 'gold', iconName: 'transfer' });
      bk.snippetCard(c, { x: 290, y: 320, w: 560, title: 'end_ride.py', lines: ['def end_ride(ride):', '    ...'], at: at(hike, 'open') });
    }

    // ----------------------------------------------------------------
    // The tangle: braided lines, the ripple, every change hits it
    // ----------------------------------------------------------------

    function tangle() {
      const braided = 'tangle/braided';
      const predict = 'tangle/predict_switch';
      const a = picture(braided, predict);
      const code = bk.codeCard(a, {
        x: 40, y: 16, w: 880, title: 'end_ride.py', at: begin(braided) + 0.1,
        tagsAt: at(predict, 'tag'), braidAt: at(predict, 'braided'),
        lines: [
          { code: 'def end_ride(ride):' },
          { code: '    spot = mapsdk.locate(ride.scooter.tracker)', tag: 'tech' },
          { code: '    if not mapsdk.inside(spot, PARKING_ZONES):', tag: 'both' },
          { code: '        return mapsdk.toast("No parking here")', tag: 'tech' },
          { code: '    minutes = ride.minutes()', tag: 'rule' },
          { code: '    price = 1.00 + 0.30 * minutes', tag: 'rule' },
          { code: '    if ride.rider.is_student:', tag: 'rule' },
          { code: '        price = price * 0.8', tag: 'rule' },
          { code: '    payapi.charge(ride.rider.card, round(price * 100))', tag: 'tech' },
          { code: '    bluetooth.write(ride.scooter.lock, LOCK)', tag: 'tech' },
        ],
      });
      const parts = [[[1], 'asks', 'checks'], [[2, 3], 'checks', 'prices'], [[4, 5, 6, 7], 'prices', 'charges'], [[8], 'charges', 'locks'], [[9], 'locks', null]];
      parts.forEach(([rows, from, to]) => rows.forEach((row) => wall.lit(code.rows[row], [[at(braided, from), to ? at(braided, to) : end(braided)]])));
      wall.slot(a, { x: 260, y: 440, w: 440, h: 70, text: 'Which lines change?', at: at(predict, 'predict') });

      const ripple = 'tangle/ripple';
      const b = picture(ripple);
      const mini = bk.snippetCard(b, {
        x: 24, y: 30, w: 460, title: 'end_ride.py', at: begin(ripple) + 0.1,
        lines: ['spot = mapsdk.locate(scooter)', 'if not mapsdk.inside(spot, ZONES):', '    return mapsdk.toast(...)'],
      });
      mini.rows.forEach((row, i) => wall.lit(row, [[i === 1 ? at(ripple, 'rule') : at(ripple, 'more'), end(ripple)]]));
      sticker(b, 'The rule changes too', { x: 40, y: 220, at: at(ripple, 'rule2'), variant: 'red', iconName: 'warning' });
      bk.searchPanel(b, {
        x: 500, y: 30, w: 440, query: 'mapsdk', summary: '47 results in 12 files', at: at(ripple, 'search'),
        rowsAt: at(ripple, 'forty'), markAt: at(ripple, 'provider'),
        files: [
          { file: 'start_ride.py', hits: 6 }, { file: 'end_ride.py', hits: 3 }, { file: 'zones_screen.py', hits: 9 },
          { file: 'trip_history.py', hits: 5 }, { file: 'receipts.py', hits: 2 },
        ],
      });
      stamp(b, 'Weeks of work', { x: 120, y: 380, at: at(ripple, 'ripples'), color: 'red', rotate: -6 });

      const pains = 'tangle/three_pains';
      const c = picture(pains);
      tangleCard(c, { x: 330, y: 150, at: begin(pains) + 0.1 });
      bk.changeCard(c, { x: 24, y: 30, w: 270, kind: 'tech', text: 'New map provider', at: at(pains, 'map') });
      wall.arrow(c, { from: [298, 100], to: [326, 170], at: at(pains, 'map') + 0.3 });
      bk.changeCard(c, { x: 24, y: 360, w: 280, kind: 'rule', text: 'Finals week: 10 free minutes', at: at(pains, 'finals') });
      wall.arrow(c, { from: [308, 400], to: [330, 336], at: at(pains, 'finals') + 0.3 });
      sticker(c, 'Can’t test without the SDK', { x: 24, y: 470, at: at(pains, 'test'), variant: 'red', iconName: 'warning' });
      bk.changeCard(c, { x: 676, y: 150, w: 260, kind: 'reuse', text: 'Bike-share wants the pricing rules', at: at(pains, 'bike') });
      wall.arrow(c, { from: [672, 210], to: [636, 210], at: at(pains, 'bike') + 0.3 });
      sticker(c, 'Welded to locks and payments', { x: 500, y: 420, at: at(pains, 'welded'), variant: 'red', iconName: 'link' });

      const preview = 'tangle/preview';
      const d = picture(preview);
      wall.banner(d, { x: 240, y: 16, w: 480, title: 'The habit', text: 'Ask what the code knows', at: at(preview, 'habit') });
      [['A', 'a2'], ['T', 't'], ['AT', 'at'], ['0', 'zero']].forEach(([group, word], i) => {
        bk.drop(d, { x: 160 + i * 175, y: 140, group, size: 100, at: at(preview, word) });
      });
      [['Groups', 'question', 'meet'], ['Mixing', 'merge', 'mix'], ['Design', 'scissors', 'design'], ['Change', 'loop', 'test']]
        .forEach(([name, iconName, word], i) => bk.placeTile(d, { x: 40 + i * 225, y: 380, w: 200, name, iconName, at: at(preview, word) }));
    }

    // ----------------------------------------------------------------
    // Groups: the two questions, then A, T, 0, and AT
    // ----------------------------------------------------------------

    function twoQuestions() {
      const questions = 'two_questions/questions';
      const a = picture(questions);
      bk.moduleCard(a, {
        x: 24, y: 30, w: 440, title: 'Knows the domain?', at: at(questions, 'application'),
        chips: [['ride', 'ride'], ['rider', 'rider'], ['parking zone', 'parking'], ['price', 'price']].map(([text, word]) => ({ text, tone: 'a', at: at(questions, word) })),
      });
      bk.moduleCard(a, {
        x: 496, y: 30, w: 440, title: 'Knows a technology?', at: at(questions, 'technology'),
        chips: [['map SDK', 'sdk'], ['payment API', 'api2'], ['Bluetooth', 'bluetooth'], ['database', 'database']].map(([text, word]) => ({ text, tone: 't', at: at(questions, word) })),
      });
      wall.note(a, { x: 190, y: 290, w: 556, text: 'Knows means depends on. If it changed, this code would change.', tone: 'cyan', tilt: -1, at: at(questions, 'knowing') });

      const grid = 'two_questions/grid';
      const b = picture(grid);
      const cols = [340, 640];
      const rows = [110, 310];
      centered(wall.label(b, { x: 340, y: 12, w: 560, text: 'Knows a technology?', at: begin(grid) + 0.1 }));
      ['No', 'Yes'].forEach((word, i) => centered(wall.label(b, { x: cols[i], y: 60, w: 260, text: word, muted: true, at: begin(grid) + 0.2 })));
      wall.label(b, { x: 24, y: 110, w: 280, text: 'Knows the domain?', at: begin(grid) + 0.1 });
      ['No', 'Yes'].forEach((word, i) => wall.label(b, { x: 24, y: rows[i] + 70, w: 280, text: word, muted: true, at: begin(grid) + 0.2 }));
      [
        { group: '0', name: 'Group 0', line: 'Knows neither', col: 0, row: 0, word: 'zero' },
        { group: 'T', name: 'Group T', line: 'Technology only', col: 1, row: 0, word: 't' },
        { group: 'A', name: 'Group A', line: 'Domain only', col: 0, row: 1, word: 'a' },
        { group: 'AT', name: 'Group AT', line: 'Both at once', col: 1, row: 1, word: 'at2' },
      ].forEach(({ group, name, line: text, col, row, word }) => bk.groupCell(b, {
        x: cols[col], y: rows[row], w: 280, h: 180, group, name, line: text, at: at(grid, word),
      }));
      sticker(b, 'Exactly one group', { x: 24, y: 440, at: at(grid, 'exactly'), variant: 'gold', iconName: 'check' });
    }

    function groupA() {
      const rules = 'group_a/rules';
      const paid = 'group_a/paid_for';
      const reuse = 'group_a/a_reuse';
      const a = picture(rules, reuse);
      tangleCard(a, { x: 24, y: 40, at: begin(rules) + 0.1, until: end(rules) });
      bk.moduleCard(a, {
        x: 360, y: 24, w: 576, title: 'Ride rules', group: 'A', at: at(rules, 'pull'), how: 'slide',
        snippet: { at: at(rules, 'dollar'), lines: ['def price(ride):', '    cost = 1.00 + 0.30 * ride.minutes', '    if ride.rider.is_student:', '        cost = cost * 0.8', '    return cost'] },
        lines: [{ text: 'A ride may end only inside a parking zone.', at: at(rules, 'parking') }],
      });
      sticker(a, 'No SDK, no API', { x: 40, y: 300, at: at(rules, 'sdk'), until: end(rules), variant: 'green', iconName: 'check' });

      sticker(a, 'What the business is paid for', { x: 360, y: 346, at: at(paid, 'paid'), until: end(paid), variant: 'gold', iconName: 'cash' });
      bk.changeCard(a, { x: 24, y: 60, w: 270, kind: 'rule', text: 'New discount', at: at(paid, 'discount') - 0.6, until: end(paid) });
      wall.arrow(a, { from: [298, 110], to: [356, 110], at: at(paid, 'discount'), until: end(paid) });
      sticker(a, 'Changes here', { x: 40, y: 170, at: at(paid, 'discount') + 0.4, until: end(paid), variant: 'green', iconName: 'check' });
      bk.changeCard(a, { x: 24, y: 250, w: 270, kind: 'tech', text: 'New map service', at: at(paid, 'stays') - 0.6, until: end(paid) });
      sticker(a, 'Not affected', { x: 40, y: 360, at: at(paid, 'put'), until: end(paid), variant: 'white', iconName: 'shield' });

      bk.placeTile(a, { x: 24, y: 40, w: 300, name: 'Campus bike-share', iconName: 'transfer', at: at(reuse, 'bike') });
      reusedCopy(a, { x: 360, y: 24, dx: -320, dy: 100, w: 260, title: 'Ride rules', group: 'A', at: at(reuse, 'reuse') });
      bk.reuseChart(a, { x: 24, y: 350, w: 912, at: at(reuse, 'anywhere'), rows: [{ group: 'A', at: at(reuse, 'anywhere') + 0.2 }] });
    }

    function groupT() {
      const drivers = 'group_t/drivers';
      const reuse = 'group_t/t_reuse';
      const a = picture(drivers, reuse);
      tangleCard(a, { x: 24, y: 40, at: begin(drivers) + 0.1, until: end(drivers) });
      [
        ['Payment client', 'charge(card, cents)', 'Payment API', 'payment'],
        ['Lock driver', 'lock(device), unlock(device)', 'Bluetooth', 'lock'],
        ['Map client', 'locate(device)', 'Map SDK', 'map'],
      ].forEach(([title, code, tech, word], i) => bk.moduleCard(a, {
        x: 380, y: 14 + i * 168, w: 556, title, group: 'T', at: at(drivers, word), how: 'slide',
        snippet: { lines: [code] }, chips: [{ text: tech, tone: 't' }], until: i ? end(drivers) : undefined,
      }));
      sticker(a, 'Never heard of a ride', { x: 18, y: 300, at: at(drivers, 'heard'), until: end(drivers), variant: 'gold', iconName: 'chat' });

      sticker(a, 'Every app needs T', { x: 30, y: 40, at: at(reuse, 'air'), variant: 'gold', iconName: 'plug' });
      bk.placeTile(a, { x: 24, y: 120, w: 300, name: 'Campus food truck', iconName: 'truck', at: at(reuse, 'food') });
      reusedCopy(a, { x: 380, y: 14, dx: -340, dy: 180, w: 300, title: 'Payment client', group: 'T', at: at(reuse, 'reuse') });
      bk.reuseChart(a, { x: 24, y: 350, w: 912, at: at(reuse, 'reusable'), rows: [{ group: 'T', at: at(reuse, 'reusable') + 0.2 }] });
    }

    function groupZero() {
      const geometry = 'group_zero/geometry';
      const donor = 'group_zero/donor';
      const a = picture(geometry, donor);
      tangleCard(a, { x: 24, y: 40, at: begin(geometry) + 0.1, until: end(geometry) });
      bk.moduleCard(a, {
        x: 360, y: 14, w: 576, title: 'Geometry', group: '0', at: at(geometry, 'pulled'), how: 'slide',
        snippet: { lines: ['def inside(point, polygon):', '    ...  # coordinates only'] },
      });
      bk.zoneCheck(a, { x: 380, y: 200, at: at(geometry, 'point'), dotAt: at(geometry, 'polygon'), until: end(geometry) });
      [['Sorted list', 'sorted'], ['Dictionary', 'dictionary'], ['State machine', 'state']].forEach(([text, word], i) => {
        bk.chip(a, { x: 660, y: 210 + i * 50, text, at: at(geometry, word), until: end(geometry) });
      });

      sticker(a, 'Universal donor', { x: 30, y: 40, at: at(donor, 'universal'), variant: 'green', iconName: 'sparkle' });
      [['Delivery zones', 'truck', 'delivery'], ['Campus tour', 'pin', 'tour'], ['Game', 'gamepad', 'game']].forEach(([name, iconName, word], i) => {
        bk.placeTile(a, { x: 360 + i * 196, y: 196, w: 184, name, iconName, at: at(donor, word) });
      });
      sticker(a, 'Useless alone', { x: 30, y: 110, at: at(donor, 'useful'), variant: 'red', iconName: 'warning' });
      bk.moduleCard(a, { x: 24, y: 180, w: 280, title: 'Ride rules', group: 'A', at: at(donor, 'parking'), how: 'pop' });
      wall.arrow(a, { from: [308, 214], to: [356, 120], at: at(donor, 'asks') });
      bk.reuseChart(a, { x: 24, y: 330, w: 912, at: at(donor, 'reuse'), rows: [{ group: '0', at: at(donor, 'reuse') + 0.2 }] });
    }

    function groupAT() {
      const both = 'group_at/both';
      const a = picture(both);
      tangleCard(a, { x: 330, y: 70, at: begin(both) + 0.1, group: 'AT' });
      sticker(a, 'Easy to write', { x: 250, y: 330, at: at(both, 'easy'), variant: 'green', iconName: 'pencil' });
      sticker(a, 'Done by lunch', { x: 520, y: 330, at: at(both, 'lunch'), variant: 'gold', iconName: 'timer' });

      const chart = 'group_at/at_chart';
      const b = picture(chart);
      bk.reuseChart(b, {
        x: 24, y: 20, w: 912, at: begin(chart) + 0.1,
        rows: [
          { group: '0', at: begin(chart) + 0.3 },
          { group: 'A', at: at(chart, 'a') },
          { group: 'T', at: at(chart, 't') },
          { group: 'AT', at: at(chart, 'at') },
        ],
      });
      stamp(b, 'Welded in place', { x: 520, y: 420, at: at(chart, 'welded'), color: 'red', rotate: -5 });

      const cost = 'group_at/at_cost';
      const c = picture(cost);
      tangleCard(c, { x: 24, y: 140, at: begin(cost) + 0.1, group: 'AT' });
      bk.changeCard(c, { x: 24, y: 14, w: 300, kind: 'rule', text: 'New discount', at: at(cost, 'business') });
      bk.changeCard(c, { x: 24, y: 420, w: 300, kind: 'tech', text: 'New map provider', at: at(cost, 'technology') });
      wall.arrow(c, { from: [174, 92], to: [174, 134], at: at(cost, 'business') + 0.3 });
      wall.arrow(c, { from: [174, 414], to: [174, 352], at: at(cost, 'technology') + 0.3 });
      bk.tradeoff(c, { x: 400, y: 60, w: 520, at: at(cost, 'rule'), swingAt: at(cost, 'larger') });
      sticker(c, 'Shrink AT', { x: 420, y: 330, at: at(cost, 'shrink'), variant: 'red', iconName: 'scissors' });
    }

    // ----------------------------------------------------------------
    // Mixing: the blood-group rules, and leaks through interfaces
    // ----------------------------------------------------------------

    function mixing() {
      const rules = 'mixing/rules';
      const predict = 'mixing/predict_mix';
      const aPlusT = 'mixing/a_plus_t';
      const absorb = 'mixing/absorb';
      const a = picture(rules, absorb);
      const tPours = at(aPlusT, 'plus');
      bk.flask(a, { x: 60, y: 110, at: at(rules, 'put'), contents: [{ group: 'A' }, { at: tPours + 0.9, group: 'AT' }] });
      bk.pour(a, { x: 112, y: 6, group: 'A', at: at(rules, 'put'), fall: 120 });
      bk.pour(a, { x: 112, y: 6, group: '0', at: at(rules, 'zero'), fall: 120 });
      bk.equation(a, { x: 330, y: 20, terms: ['A', '+', 'A', '=', 'A'], at: at(rules, 'a3') });
      bk.equation(a, { x: 640, y: 20, terms: ['T', '+', 'T', '=', 'T'], at: at(rules, 't3') });
      bk.equation(a, { x: 330, y: 100, terms: ['A', '+', '0', '=', 'A'], at: at(rules, 'zero') });
      bk.equation(a, { x: 640, y: 100, terms: ['T', '+', '0', '=', 'T'], at: at(rules, 'letter2') });
      sticker(a, 'Zero adds no letter', { x: 330, y: 186, at: at(rules, 'adds'), until: end(rules), variant: 'white', iconName: 'sparkle' });

      const card = bk.moduleCard(a, {
        x: 330, y: 186, w: 606, title: 'Ride rules', group: 'A', at: begin(predict) + 0.1, until: end(aPlusT),
        changes: [{ at: at(predict, 'predict'), group: '?' }, { at: tPours + 0.9, group: 'AT' }],
        snippet: {
          lines: ['def price(ride):', '    cost = 1.00 + 0.30 * ride.minutes', '    payapi.charge(ride.rider.card, cost)', '    return cost'],
          lineAt: [undefined, undefined, at(predict, 'charge')],
        },
      });
      wall.lit(card.snippet.children[2], [[at(predict, 'charge') + 0.3, end(aPlusT)]]);
      bk.pour(a, { x: 112, y: 6, group: 'T', at: tPours, fall: 120 });
      bk.equation(a, { x: 330, y: 456, terms: ['A', '+', 'T', '=', 'AT'], at: at(aPlusT, 'gives') });
      wall.note(a, { x: 640, y: 448, w: 270, text: 'Blood: inherit A and B, get AB', tone: 'pink', tilt: 1, at: at(aPlusT, 'inheriting') });
      sticker(a, 'Can’t move alone', { x: 30, y: 400, at: at(aPlusT, 'move'), until: end(aPlusT), variant: 'red', iconName: 'cross' });

      ['A', '0', 'T'].forEach((group, i) => bk.pour(a, { x: 112, y: 6, group, at: at(absorb, ['rules', 'zero', 'stays'][i]), fall: 120 }));
      bk.equation(a, { x: 330, y: 240, terms: ['AT', '+', 'anything', '=', 'AT'], at: at(absorb, 'stays') });
      sticker(a, 'Can’t dilute', { x: 330, y: 340, at: at(absorb, 'dilute'), variant: 'red', iconName: 'cross' });
      sticker(a, 'Separate instead', { x: 600, y: 340, at: at(absorb, 'separate'), variant: 'green', iconName: 'scissors' });
    }

    function leaks() {
      const leak = 'leaks/leak';
      const plug = 'leaks/plug';
      const signs = 'leaks/signs';
      const a = picture(leak, signs);
      const swap = at(plug, 'let');
      bk.moduleCard(a, { x: 24, y: 30, w: 440, title: 'Map client', group: 'T', at: begin(leak) + 0.1, until: swap, snippet: { lines: ['locate(device) -> SdkLocation'] } });
      bk.moduleCard(a, { x: 24, y: 30, w: 440, title: 'Map client', group: 'T', at: swap, how: 'pop', snippet: { lines: ['locate(device) -> Point'] } });
      bk.moduleCard(a, {
        x: 520, y: 30, w: 416, title: 'Ride rules', group: 'A', at: at(leak, 'rule'),
        changes: [{ at: at(leak, 'turn'), group: 'AT' }, { at: at(plug, 'stays'), group: 'A' }],
        snippet: { lines: ['spot = maps.locate(scooter)', 'can_end(spot)'] },
      });
      wall.arrow(a, { from: [516, 92], to: [468, 92], at: at(leak, 'rule') + 0.4 });
      bk.drip(a, { from: [468, 132], to: [516, 132], at: at(leak, 'leaks'), until: swap });
      sticker(a, 'Leak: SdkLocation', { x: 220, y: 200, at: at(leak, 'leaks'), until: swap, variant: 'red', iconName: 'warning' });

      bk.equation(a, { x: 24, y: 180, terms: ['Point', '=', 'latitude, longitude', '0'], at: at(plug, 'latitude'), until: end(plug) });
      bk.snippetCard(a, { x: 24, y: 300, w: 470, title: 'map_adapter.py', lines: ['except MapSdkError:', '    raise ScooterNotFound()'], at: at(plug, 'errors'), until: end(plug) });
      sticker(a, 'Translate errors too', { x: 530, y: 330, at: at(plug, 'translate'), until: end(plug), variant: 'green', iconName: 'transfer' });

      wall.listCard(a, {
        x: 24, y: 236, w: 420, title: 'Leak signs', iconName: 'warning', at: at(signs, 'signs'),
        items: [['SDK objects', 'sdk'], ['SQL strings', 'sql'], ['HTTP status codes', 'http'], ['Provider error types', 'error']].map(([text, word]) => ({ text, at: at(signs, word) })),
      });
      bk.moduleCard(a, {
        x: 480, y: 250, w: 456, title: 'Ride history', group: 'A', at: at(signs, 'method'),
        changes: [{ at: at(signs, 'becomes'), group: 'AT' }],
        snippet: { lines: ['rides.find("SELECT * FROM ...")'] },
      });
      stamp(a, 'Leak', { x: 760, y: 420, at: at(signs, 'classic'), color: 'red', rotate: -6 });
    }

    // ----------------------------------------------------------------
    // Design: separate, invert, keep frameworks at arm's length
    // ----------------------------------------------------------------

    function separate() {
      const ruleOne = 'separate/rule_one';
      const concern = 'separate/one_concern';
      const a = picture(ruleOne, concern);
      wall.banner(a, { x: 200, y: 8, w: 560, title: 'Design rule 1', text: 'Minimize AT modules, maximize 0 modules', at: at(ruleOne, 'minimize') });
      tangleCard(a, { x: 330, y: 150, group: 'AT', at: begin(ruleOne) + 0.1, until: at(ruleOne, 'separate') + 0.6 });
      bk.moduleCard(a, { x: 24, y: 120, w: 290, title: 'Ride rules', group: 'A', at: at(ruleOne, 'rules'), how: 'pop' });
      bk.moduleCard(a, { x: 24, y: 236, w: 290, title: 'Geometry', group: '0', at: at(ruleOne, 'general'), how: 'pop' });
      const tech = [['Map client', 'Map SDK'], ['Payment client', 'Payment API'], ['Lock driver', 'Bluetooth']];
      tech.forEach(([title, chip], i) => bk.moduleCard(a, {
        x: 646, y: 110 + i * 142, w: 290, title, group: 'T', at: at(ruleOne, 'technology2') + i * 0.15, how: 'pop',
        chips: [{ text: chip, tone: 't', at: at(concern, 'technology') + i * 0.2 }],
      }));
      sticker(a, 'Keep tech and rules apart', { x: 24, y: 470, at: at(ruleOne, 'separate'), variant: 'gold', iconName: 'scissors' });

      bk.moduleCard(a, { x: 24, y: 352, w: 290, title: 'Rider accounts', group: 'A', at: at(concern, 'accounts'), how: 'pop' });
      wall.note(a, { x: 344, y: 220, w: 260, text: 'Single responsibility, sharpened: one reason to change, of one kind', tone: 'cyan', tilt: -1, at: at(concern, 'single') });
    }

    function invert() {
      const flip = 'invert/flip';
      const sockets = 'invert/sockets';
      const dongles = 'invert/dongles';
      const rhesus = 'invert/rhesus';
      const a = picture(flip, rhesus);
      const rows = [14, 150, 286];
      const mids = rows.map((row) => row + 36);
      bk.moduleCard(a, {
        x: 20, y: 14, w: 250, h: 344, title: 'Ride rules', group: 'A', at: begin(flip) + 0.1,
        lines: [{ text: 'price(ride)' }, { text: 'can_end(ride)' }],
      });
      [['Payment', 'client'], ['Map', 'client'], ['Lock', 'driver']].forEach(([first, second], i) => bk.moduleCard(a, {
        x: 790, y: rows[i], w: 150, title: `${first} ${second}`, group: 'T', mark: 'pill', at: begin(flip) + 0.25 + i * 0.12,
      }));
      mids.forEach((y, i) => {
        wall.arrow(a, { from: [274, y], to: [786, y], at: at(flip, 'call') + i * 0.12, until: at(flip, 'invert') });
        bk.crossOut(a, { x: 530, y, at: at(flip, 'quirks') + i * 0.12, until: at(flip, 'invert') });
        wall.arrow(a, { from: [786, y], to: [274, y], dashed: true, at: at(flip, 'invert') + 0.2 + i * 0.12, until: begin(sockets) + 0.3 });
      });
      sticker(a, 'No arrows from big A to T', { x: 300, y: 420, at: at(flip, 'avoid'), until: begin(sockets) + 0.3, variant: 'red', iconName: 'cross' });

      [['Payments', 'charge(rider, amount)', 'charge'], ['Locator', 'position(scooter)', 'find'], ['Locks', 'lock(scooter)', 'lock']].forEach(([name, text, word], i) => {
        bk.wire(a, { from: [270, mids[i]], to: [290, mids[i]], at: at(sockets, word) });
        bk.socket(a, { x: 290, y: rows[i], w: 334, name, text, at: at(sockets, word) });
      });
      sticker(a, 'Owned by A: what, not how', { x: 300, y: 420, at: at(sockets, 'owns'), until: end(sockets), variant: 'cyan', iconName: 'plug' });

      [['Payment', 'payment'], ['Map', 'adapter'], ['Lock', 'adapter']].forEach(([first, word], i) => {
        bk.adapter(a, { x: 650, y: rows[i] + 2, w: 120, title: `${first} adapter`, at: at(dongles, word) + i * 0.2, rAt: at(rhesus, 'r') + i * 0.15 });
      });
      bk.snippetCard(a, { x: 330, y: 402, w: 380, title: 'Payment adapter', lines: ['charge(rider, 2.80)', '  -> payapi.charge(card, 280)'], at: at(dongles, 'turns'), until: end(dongles) });
      sticker(a, 'Thin', { x: 24, y: 384, at: at(dongles, 'thin'), until: end(dongles), variant: 'green', iconName: 'check' });
      sticker(a, 'Easy to replace', { x: 24, y: 446, at: at(dongles, 'replace'), until: end(dongles), variant: 'green', iconName: 'transfer' });

      wall.note(a, { x: 360, y: 406, w: 396, text: 'Translates, never decides: rider → card, dollars → cents, zone → map overlay', tone: 'cyan', tilt: -1, at: at(rhesus, 'translates') });
      bk.drop(a, { x: 24, y: 398, group: 'R', size: 70, at: at(rhesus, 'r') });
      wall.label(a, { x: 106, y: 422, w: 220, text: 'R: representation', at: at(rhesus, 'representation') });
    }

    function frameworks() {
      const married = 'frameworks/married';
      const divorce = 'frameworks/divorce';
      const a = picture(married, divorce);
      bk.moduleCard(a, { x: 24, y: 14, w: 300, title: 'db.Model', group: 'T', at: at(married, 'web'), chips: [{ text: 'Web framework', tone: 't' }] });
      bk.moduleCard(a, {
        x: 24, y: 236, w: 300, title: 'Ride(db.Model)', group: 'A', at: at(married, 'glides'),
        changes: [{ at: at(married, 'married'), group: 'AT' }],
        lines: [{ text: 'price(), can_end()' }],
      });
      bk.inherits(a, { from: [174, 232], to: [174, 123], at: at(married, 'extends') });
      sticker(a, 'Married to the framework', { x: 196, y: 152, at: at(married, 'married'), until: end(married), variant: 'red', iconName: 'link' });

      bk.moduleCard(a, { x: 560, y: 20, w: 376, title: 'db.Model', group: 'T', at: at(divorce, 'adapter'), how: 'pop' });
      bk.moduleCard(a, { x: 560, y: 190, w: 376, title: 'RideRecord(db.Model)', group: 'AT', at: at(divorce, 'riderecord'), how: 'pop', lines: [{ text: 'to_ride(), from_ride()' }] });
      bk.moduleCard(a, { x: 560, y: 390, w: 376, title: 'Ride', group: 'A', at: at(divorce, 'plain'), how: 'pop', lines: [{ text: 'price(), can_end()' }] });
      bk.inherits(a, { from: [748, 186], to: [748, 110], at: at(divorce, 'extends') });
      wall.arrow(a, { from: [748, 318], to: [748, 386], at: at(divorce, 'copies') });
      sticker(a, 'Large, complex: add an adapter', { x: 24, y: 364, at: at(divorce, 'large'), variant: 'green', iconName: 'transfer' });
      sticker(a, 'Tiny app: inheriting can be fine', { x: 24, y: 442, at: at(divorce, 'tiny'), variant: 'white', iconName: 'check' });
    }

    // ----------------------------------------------------------------
    // Change: replay the changes, then know when to stop
    // ----------------------------------------------------------------

    function changeTest() {
      const replay = 'change_test/replay';
      const predict = 'change_test/predict_replay';
      const results = 'change_test/results';
      const a = picture(replay, results);
      const rows = [14, 140, 266];
      bk.moduleCard(a, { x: 330, y: 120, w: 230, title: 'Ride rules', group: 'A', at: begin(replay) + 0.1 });
      const swap = at(results, 'only');
      [['Map', 'client'], ['Payment', 'client'], ['Lock', 'driver']].forEach(([first, second], i) => {
        bk.adapter(a, { x: 600, y: rows[i] + 4, w: 120, title: `${first} adapter`, at: begin(replay) + 0.2 + i * 0.1, until: i ? undefined : swap });
        bk.moduleCard(a, { x: 760, y: rows[i], w: 176, title: `${first} ${second}`, group: 'T', mark: 'pill', at: begin(replay) + 0.3 + i * 0.1, until: i ? undefined : swap });
        wall.arrow(a, { from: [590, rows[i] + 34], to: [566, 136 + i * 26], at: begin(replay) + 0.5 + i * 0.1 });
      });
      bk.changeCard(a, { x: 24, y: rows[0], w: 270, kind: 'tech', text: 'New map provider', at: at(replay, 'map') });
      bk.changeCard(a, { x: 24, y: rows[1], w: 270, kind: 'rule', text: 'Finals week: 10 free minutes', at: at(replay, 'finals') });
      bk.changeCard(a, { x: 24, y: rows[2], w: 270, kind: 'reuse', text: 'Bike-share wants the pricing rules', at: at(replay, 'bike') });

      wall.slot(a, { x: 330, y: 250, w: 220, h: 70, text: 'Change or stay?', at: at(predict, 'predict'), until: begin(results) + 0.2 }).classList.add('bg-slot-small');

      bk.adapter(a, { x: 600, y: rows[0] + 4, w: 120, title: 'New map adapter', at: swap + 0.3, how: 'slide' });
      bk.moduleCard(a, { x: 760, y: rows[0], w: 176, title: 'New map client', group: 'T', mark: 'pill', at: swap + 0.4, how: 'slide' });
      sticker(a, 'Changed: 2 small modules', { x: 560, y: 424, at: at(results, 'adapter'), variant: 'gold', iconName: 'check' });
      wall.checklist(a, {
        x: 306, y: 222, w: 218, title: 'Finals-week test', at: at(results, 'finals'),
        items: [{ text: 'Passes', checkAt: at(results, 'test') }, { text: 'No SDK needed', checkAt: at(results, 'sdk') }],
      });
      reusedCopy(a, { x: 330, y: 120, dx: -306, dy: 290, w: 220, title: 'Ride rules', group: 'A', at: at(results, 'reuses') });
      bk.adapter(a, { x: 268, y: 402, w: 120, title: 'Dock adapter', at: at(results, 'docks') });

      const xChanges = 'change_test/x_changes';
      const b = picture(xChanges);
      [['tech', 'Technology change', 'T', 'T modules', 'technology'], ['rule', 'Rule change', 'A', 'A modules', 'rule'], ['format', 'How data is stored or shown', 'R', 'Thin translators (R)', 'stored']]
        .forEach(([kind, text, group, target, word], i) => {
          const y = 30 + i * 136;
          bk.changeCard(b, { x: 40, y, w: 330, kind, text, at: at(xChanges, word) });
          wall.arrow(b, { from: [384, y + 46], to: [520, y + 46], at: at(xChanges, word) + 0.3 });
          bk.moduleCard(b, { x: 534, y: y + 4, w: 380, title: target, group, at: at(xChanges, word) + 0.5, how: 'pop' });
        });
      wall.banner(b, { x: 200, y: 440, w: 560, title: 'The goal', text: 'Each change lands in one small place', at: at(xChanges, 'lands') });
    }

    function balance() {
      const overkill = 'balance/overkill';
      const a = picture(overkill);
      bk.wrappers(a, { x: 40, y: 30, layers: ['IString', 'StringAdapter', 'StringFactory'], core: 'str', at: at(overkill, 'hiding') });
      stamp(a, 'Overkill', { x: 90, y: 330, at: at(overkill, 'nothing'), color: 'red', rotate: -6 });
      bk.moduleCard(a, { x: 560, y: 40, w: 376, title: 'Map client', group: 'T', at: at(overkill, 'wrap'), how: 'pop' });
      bk.adapter(a, { x: 560, y: 160, w: 376, title: 'Map adapter', at: at(overkill, 'varies') });
      sticker(a, 'Worth it: might be swapped', { x: 560, y: 270, at: at(overkill, 'swap'), variant: 'green', iconName: 'check' });

      const curve = 'balance/curve';
      const b = picture(curve);
      bk.effortCurve(b, {
        x: 200, y: 30, w: 560, h: 360, at: begin(curve) + 0.1,
        stops: [{ at: at(curve, 'tangle'), point: 0 }, { at: at(curve, 'layers'), point: 2 }, { at: at(curve, 'top'), point: 1 }],
      });
      sticker(b, 'Weekend script: a little AT is fine', { x: 200, y: 450, at: at(curve, 'weekend'), variant: 'white', iconName: 'pencil' });

      const cost = 'balance/cost';
      const c = picture(cost);
      wall.listCard(c, { x: 24, y: 30, w: 300, title: 'One extra call', text: 'Next to nothing at runtime', iconName: 'timer', at: at(cost, 'call') });
      wall.balance(c, {
        x: 650, y: 170, beam: 400, at: at(cost, 'price'),
        pans: [
          { w: 200, title: 'Design time', text: 'Paid once', iconName: 'pencil', at: at(cost, 'design') },
          { w: 200, title: 'Payoff', text: 'Every change', iconName: 'check', at: at(cost, 'payoff') },
        ],
        tilts: [{ at: at(cost, 'arrives'), angle: 12 }],
      });
      sticker(c, 'Technology will change', { x: 30, y: 400, at: at(cost, 'technology'), variant: 'gold', iconName: 'loop' });
    }

    // ----------------------------------------------------------------
    // Summary
    // ----------------------------------------------------------------

    function summary() {
      const groups = 'summary/recap_groups';
      const a = picture(groups);
      [['0', 'Group 0', 'Neither', 0, 0, 'zero'], ['T', 'Group T', 'Technology', 1, 0, 't'], ['A', 'Group A', 'Domain', 0, 1, 'a2'], ['AT', 'Group AT', 'Both', 1, 1, 'at']]
        .forEach(([group, name, line, col, row, word]) => bk.groupCell(a, { x: 24 + col * 218, y: 30 + row * 186, w: 206, h: 174, group, name, line, stacked: true, at: at(groups, word) }));
      bk.groupList(a, {
        x: 480, y: 40, w: 456, title: 'Where it can go', iconName: 'pin', at: at(groups, 'goes'),
        rows: [
          { group: '0', text: 'Everywhere', at: at(groups, 'everywhere') },
          { group: 'A', text: 'Wherever its rules apply', at: at(groups, 'a3') },
          { group: 'T', text: 'Wherever its technology runs', at: at(groups, 't2') },
          { group: 'AT', text: 'Almost nowhere', at: at(groups, 'nowhere') },
        ],
      });

      const rules = 'summary/recap_rules';
      const b = picture(rules);
      bk.equation(b, { x: 24, y: 30, terms: ['A', '+', '0', '=', 'A'], at: at(rules, 'zero') });
      bk.equation(b, { x: 24, y: 120, terms: ['A', '+', 'T', '=', 'AT'], at: at(rules, 'plus') });
      bk.equation(b, { x: 24, y: 210, terms: ['AT', '+', 'anything', '=', 'AT'], at: at(rules, 'dilutes') });
      wall.listCard(b, {
        x: 440, y: 30, w: 496, title: 'Design rules', iconName: 'scissors', at: at(rules, 'minimize'),
        items: [
          ['Minimize AT, maximize 0', 'minimize'], ['The rules own their interfaces', 'own'],
          ['Thin adapters translate, never decide', 'adapters'], ['Frameworks at arm’s length', 'frameworks'],
        ].map(([text, word]) => ({ text, at: at(rules, word) })),
      });

      const test = 'summary/recap_test';
      const c = picture(test);
      [['tech', 'Technology change', 'T', 'technology'], ['rule', 'Rule change', 'A', 'rule'], ['reuse', 'Reuse request', 'A', 'reuse']].forEach(([kind, text, group, word], i) => {
        const y = 30 + i * 120;
        bk.changeCard(c, { x: 60, y, w: 320, kind, text, at: at(test, word) });
        wall.arrow(c, { from: [394, y + 40], to: [500, y + 40], at: at(test, word) + 0.3 });
        bk.pill(c, { x: 514, y: y + 20, group, at: at(test, word) + 0.5 });
        sticker(c, 'One place', { x: 600, y: y + 16, at: at(test, 'lands') + i * 0.2, variant: 'green', iconName: 'check' });
      });
      sticker(c, 'Ask the two questions before line one', { x: 160, y: 430, at: at(test, 'questions'), variant: 'gold', iconName: 'question' });
    }

    intro();
    tangle();
    twoQuestions();
    groupA();
    groupT();
    groupZero();
    groupAT();
    mixing();
    leaks();
    separate();
    invert();
    frameworks();
    changeTest();
    balance();
    summary();
  };
})();
