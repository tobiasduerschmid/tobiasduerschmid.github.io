/*
 * Choreography for "Inspect and Adapt", the Scrum musical
 * (storyboard: _data/songs/inspect_and_adapt.yml).
 *
 * Every visual hits a sung word: `mark(lineId, word)` is that word's time in
 * the recording. The teaching rule: show exactly what the line says, one idea
 * at a time. Act one introduces the accountabilities in the metaphors of the
 * CS 130 Scrum lecture (scrum-scenes.js): each role's slide shows its scene
 * beside a list of what it is accountable for (✓) and what it is not. The
 * Scrum Master is the team coach on a basketball court: the Developers pick
 * their own plays and huddle, the game clock runs a timebox down, and the
 * coach clears a wall from a player's path. The Product Owner is the value
 * navigator on a sea chart: the compass reads Value, the user stories are
 * waypoints on a course ordered by value, and an idea off the chart is not
 * sailed to. The Developers are the builders, stacking the Increment. The
 * chorus raises empiricism on its three pillars. Act two runs one Sprint: the
 * Sprint strip lights each event as it is sung, the Scrum board's cards move
 * as the lyrics move them, and the coach's and the navigator's emblems return
 * when they act. The quiz asks seven questions about a new team.
 *
 * The cast are the singers of opera-cast.js. The New Developer, the main
 * character, is the viewer's own hero in a blue hoodie; the others are each
 * the gender of the voice that sings the part, with a face drawn at random
 * once per viewing: the Scrum Master, the team coach, a man in a teal track jacket
 * with a whistle and a clipboard; the Product Owner, the value navigator, a
 * woman in a navy sea coat with brass buttons, a compass pin, and a
 * spyglass; and three Developers who cover design, code, and test, two men
 * (a painter's apron, a green coder's hoodie) and a woman (a lab coat). In
 * act one each singer stands at the side of the display; from the question
 * on, the whole cast stands in a line in front of its lower part and each
 * singer steps forward, so the display's pictures keep to its upper part,
 * above their heads.
 *
 * Layout: 960×540 stage; the screen is TeamRoom.SCREEN, the section badge
 * sits top-left, and nothing essential goes below y = 460, where the player
 * draws captions.
 */
(function () {
  'use strict';

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.inspect_and_adapt = function choreograph({ song, kit, layers, student }) {
    const C = window.OperaCast;
    const P = window.PatternKit;
    const K = window.ScrumKit;
    const Sc = window.ScrumScenes;
    const { SCREEN: S, FLOOR, toDisplay } = window.TeamRoom;
    const { content, hud } = layers;
    // The slides: laid out on the logical screen S, shown larger on the
    // office's display, behind the cast (team-room.js).
    const screen = window.TeamRoom.slides(layers);
    const line = (id) => song.line(id);
    const mark = (id, word) => song.mark(id, word);
    const start = (id) => song.sectionStart(id);
    const end = (id) => song.sectionEnd(id);
    const DURATION = song.storyboard.duration;

    // ----------------------------------------------------------------
    // The cast
    // ----------------------------------------------------------------

    // The wings, clear of the display on either side.
    const LEFT = 62;
    const RIGHT = 898;
    const SCALE = 0.72;
    // Where the cast stands in act one: downstage of the wall, so the slides
    // keep the display's height above their heads.
    const STAND = FLOOR + 40;
    // From the chorus on, everyone stands in a line downstage, in front of the
    // display's lower edge, its feet at LINE_FLOOR; a singer steps forward,
    // toward the viewer (STEP lower and a little larger), while singing. Both
    // keep every head below the slides' lowest text, the act-two bar.
    const LINE = { sm: 95, newdev: 250, ui: 405, coder: 560, test: 715, po: 870 };
    const LINE_FLOOR = FLOOR + 50;
    const STEP = 8;
    const IN_LINE = 0.55;
    const FORWARD = 0.58;
    // The Developers' row under the screen in their own verse (at STAND).
    const ROW = { ui: 400, coder: 480, test: 560, newdev: 320 };
    const ROW_SCALE = 0.6;
    // Pictures stay above the singers' heads while the cast is downstage.
    const TOP = S.y + 4;
    // Act two: the board under the Sprint strip, and pictures that cover its
    // Increment column (empty until the stories meet the Definition of Done).
    const BOARD_Y = TOP + 72;
    const BOARD_H = 138;
    const OVER_INCREMENT = { x: S.x + 393, y: BOARD_Y, w: 183 };
    const VOICE = {
      newdev: 'New Developer', sm: 'Scrum Master', po: 'Product Owner',
      ui: 'Developers', coder: 'Developers', test: 'Developers',
    };
    const COSTUME = { newdev: 'hero', sm: 'coach', po: 'navigator', ui: 'ui', coder: 'coder', test: 'test' };
    // Each character's gender is that of the voice that sings it (take 5,
    // measured on the vocal stem): a woman sings the Product Owner, and the
    // mixed choir of Developers is drawn as two men and a woman. The New
    // Developer, the song's main character, is the viewer's own hero. Where
    // the SE Gym renderer loads, every other singer wears a random human
    // hero's head, restyled within the gender, one face all song; elsewhere
    // (and on export stages) each wears the drawn face for its gender.
    const GENDER = { newdev: 'man', sm: 'man', po: 'woman', ui: 'man', coder: 'man', test: 'woman' };
    const DEVS = ['ui', 'coder', 'test'];
    const EVERYONE = Object.keys(VOICE);

    const plan = Object.fromEntries(EVERYONE.map((who) => [who, { stage: [], places: [], moves: [], holds: [] }]));
    const enter = (who, from, to, enterFrom, exitTo) => plan[who].stage.push([from, to, { enter: enterFrom, exit: exitTo }]);
    const place = (who, t, x, scale = SCALE, duration = 0.8, y = STAND) => plan[who].places.push([t, x, y, scale, duration]);
    const move = (who, t, name, options = {}) => plan[who].moves.push([t, name, options]);
    const hold = (who, t, side, prop) => plan[who].holds.push([t, side, prop]);
    /** A point on the screen, as a fraction of it, where the display shows it. */
    const screenAt = (fx, fy) => toDisplay([S.x + fx * S.w, S.y + fy * S.h]);

    /** Singers in the line step forward from `from` and back at `to`. */
    function forward(whos, from, to) {
      for (const who of whos) {
        place(who, from, LINE[who], FORWARD, 0.4, LINE_FLOOR + STEP);
        place(who, to, LINE[who], IN_LINE, 0.4, LINE_FLOOR);
      }
    }

    /**
     * A cast member's look: a random human hero, restyled within the gender.
     * Women get the generator's hair and lashes that go without facial hair,
     * and no beard; men get short, textured, or no hair, leaving out the
     * styles the generator keeps for faces without facial hair (pixies,
     * puffs, bobs) and Bantu knots, with no lashes and no earrings or head
     * wraps.
     */
    const castLook = (gender) => (avatar) => {
      const pick = (values) => values[Math.floor(Math.random() * values.length)];
      const state = avatar.randomAvatar(null, 'human');
      const { appearance, outfit } = state;
      const { hairFamilies, facialHairCompatibility } = avatar.RANDOM_TRAIT_POLICY;
      const { hairStylesWithoutFacialHair, eyelashStylesWithoutFacialHair } = facialHairCompatibility;
      if (gender === 'woman') {
        appearance.hairStyle = pick(hairStylesWithoutFacialHair.filter((style) => avatar.ENUMS.hairStyle.includes(style)));
        appearance.eyelashStyle = pick(eyelashStylesWithoutFacialHair.filter((style) => avatar.ENUMS.eyelashStyle.includes(style)));
        appearance.facialHair = 'none';
      } else {
        const { short, textured, bald } = hairFamilies;
        const masculine = (style) => !hairStylesWithoutFacialHair.includes(style) && style !== 'bantu-knots';
        appearance.hairStyle = pick([...short, ...textured, ...bald].filter(masculine));
        appearance.eyelashStyle = 'none';
        outfit.accessories = (outfit.accessories || []).filter((item) => !['hoop-earrings', 'headwrap', 'draped-scarf'].includes(item));
        outfit.accessory = outfit.accessories[0] || 'none';
      }
      return avatar.normalizeAvatar(state);
    };

    const badge = (text, from, to) => kit.badge(hud, text, from, to);
    const signs = [];
    const sign = (text, at) => signs.push([at, text]);

    // ----------------------------------------------------------------
    // Intro: a new team, and who's the boss?
    // ----------------------------------------------------------------

    function intro() {
      badge('Intro · A new team', 0.4, start('scrum-master'));
      sign('Inspect and Adapt', 0.6);
      enter('newdev', 1, DURATION, 'left', 'left');
      place('newdev', 0, LEFT);

      // "Somebody lost a wallet, left it in the hall. Our app, Found It, finds it."
      const lost = kit.scene(screen, mark('intro-1', 'somebody') - 0.2, mark('intro-3', 'six') - 0.2, { exit: 'fade' });
      K.wallet(lost, { x: S.x + 60, y: S.y + 110, at: mark('intro-1', 'wallet'), tag: 'Lost in the hall' });
      const app = P.phone(lost, { x: S.x + 380, y: S.y + 10, h: 280, title: 'Found It', at: mark('intro-2', 'app') });
      P.row(app.body, 'Wallet · Hall B', { at: mark('intro-2', 'finds'), icon: 'pin' });
      P.row(app.body, 'Your wallet was found', { at: mark('intro-2', 'bring'), icon: 'bolt', tone: 'title' });
      move('newdev', mark('intro-2', 'app'), 'present', { to: screenAt(0.4, 0.4), hold: 1.6 });

      // "I just joined the team: six of us, one product too." The Scrum
      // Team, each member wearing their role's emblem.
      // Beside the New Developer's face: the wing is too narrow for the plate
      // above the head, and the team panel ends just above it.
      P.nameplate(content, 'New on the team', { x: 174, y: 312, at: mark('intro-3', 'joined'), until: start('scrum-master'), tone: 'small' });
      K.team(screen, {
        x: S.x + 14, y: S.y + 40, w: 360, title: 'One Scrum Team · one product', at: mark('intro-3', 'six'), until: mark('sm-1', 'im') - 0.1,
        members: [
          { role: 'coach', icon: 'whistle' }, { role: 'navigator', icon: 'compass' },
          { role: 'builders', icon: 'hardhat', you: true }, { role: 'builders', icon: 'hardhat' },
          { role: 'builders', icon: 'hardhat' }, { role: 'builders', icon: 'hardhat' },
        ],
        caption: 'Scrum\u00a0Master · Product\u00a0Owner · 4\u00a0Developers',
      });
      move('newdev', mark('intro-3', 'i') - 0.1, 'chest', { hold: 1.2, pats: 2 });

      // "So who's the boss around here? Who tells me what to do?"
      K.orgChart(screen, { x: S.x + 386, y: S.y + 70, at: mark('intro-4', 'boss'), until: mark('sm-1', 'im') - 0.1, crossAt: mark('sm-1', 'no') });
      move('newdev', mark('intro-4', 'boss') - 0.1, 'shrug', { hold: 1.4 });
    }

    // ----------------------------------------------------------------
    // Act one: the accountabilities, each in the lecture's metaphor
    // ----------------------------------------------------------------

    // A role's slide: the header band, the metaphor's scene on the left,
    // and the list of accountabilities on the right.
    const SLIDE = { x: S.x + 6, y: S.y + 6, w: S.w - 12, h: S.h - 12 };
    const SIDE = 268;
    /** A point in a full slide's scene panel, as a stage point to point at. */
    const sceneAt = (x, y) => toDisplay([SLIDE.x + x, SLIDE.y + 46 + y]);

    function scrumMaster() {
      const from = start('scrum-master');
      const to = start('product-owner');
      const m = (n, word) => mark(`sm-${n}`, word);
      badge('The Scrum Master', from, to);
      sign('Scrum Master', from);
      enter('sm', from - 0.4, to + 0.2, 'right', 'right');
      place('sm', 0, RIGHT);
      // The coach's clipboard in the far hand; the near hand gestures.
      hold('sm', from - 0.4, 'right', 'clipboard');
      hold('sm', to, 'right', null);

      const s = Sc.slide(screen, { ...SLIDE, role: 'coach', title: 'Scrum Master', metaphor: 'the team coach', at: m(1, 'im'), until: to, sideW: SIDE });
      const list = Sc.accountabilities(s.side);
      list.not('boss', m(1, 'im') + 0.3);
      list.ok('coaches the team', m(1, 'coach'));
      list.not('task assigner', m(2, 'assign'));
      list.ok('coaches self-management', m(3, 'self'));
      list.ok('teaches Scrum', m(3, 'learn'));
      list.ok('timeboxes events', m(4, 'timeboxed'));
      list.not('project manager', m(5, 'manager'));
      list.ok('servant-leader', m(5, 'servant'));
      list.ok('removes impediments', m(6, 'impediment'));

      // "I'm the Scrum Master, the coach": the Developers play on the
      // court; the coach stays on the sideline.
      const court = Sc.court(s.scene, {
        w: s.sceneW, h: s.sceneH, at: m(1, 'scrum'), until: to,
        players: [[0.34, 0.3, 'newdev'], [0.44, 0.69, 'ui'], [0.66, 0.31, 'coder'], [0.75, 0.7, 'test']]
          .map(([fx, fy, tone], i) => ({ tone, start: [fx, fy], at: m(1, 'coach') + i * 0.12 })),
      });
      const mid = court.C.x + court.C.w / 2;
      court.label('Developers: on the court', { x: mid, y: court.C.y + 4, at: m(1, 'coach'), until: m(2, 'team') - 0.1, tone: 'blue' });
      court.label('Scrum Master: on the sideline', { x: 74, y: court.benchY + 2, at: m(1, 'coach') + 0.3, until: m(3, 'learn') - 0.1, tone: 'teal', align: 'left' });
      move('sm', m(1, 'no'), 'wag', { hold: 1, times: 2, side: 'left' });
      move('sm', m(1, 'coach') - 0.1, 'chest', { hold: 0.9, pats: 1 });

      // "I won't assign your tasks; the team picks its approach."
      const plays = [[0.15, 0.39], [0.26, 0.84], [0.84, 0.22], [0.9, 0.72]];
      ['team', 'picks', 'its', 'approach'].forEach((word, i) => court.play(i, m(2, word), plays[i], m(3, 'self')));
      court.label('The team picks its own plays', { x: mid, y: court.C.y + 4, at: m(2, 'team'), until: m(3, 'self') + 0.3 });
      move('sm', m(2, 'wont'), 'stop', { hold: 1.4, side: 'left' });

      // "I coach you to self-manage and help you all learn Scrum."
      const huddle = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy]) => [mid + dx * 17, court.cy + 8 + dy * 17]);
      court.tokens.forEach((player, i) => player.move(m(3, 'self') - 0.1, huddle[i], 0.8));
      court.label('Self-management: the team decides', { x: mid, y: court.C.y + 4, at: m(3, 'self') + 0.4, until: m(4, 'i') - 0.1 });
      court.label('The Scrum Guide', { x: 74, y: court.benchY + 2, at: m(3, 'learn'), until: m(4, 'timeboxed'), tone: 'gold', align: 'left', icon: 'book' });
      move('sm', m(3, 'coach'), 'reassure', { hold: 1.4, side: 'left' });

      // "I keep each event timeboxed: a fixed time, then it's done." The
      // game clock runs one event's timebox down to zero.
      court.clock({ x: mid, y: court.C.y + 6, at: m(4, 'i'), until: m(5, 'no'), runFrom: m(4, 'keep'), runTo: m(4, 'done'), event: 'Daily Scrum', minutes: 15 });
      court.label('Timebox: a fixed maximum time', { x: mid, y: court.C.y + court.C.h - 26, at: m(4, 'timeboxed'), until: m(5, 'no'), tone: 'gold' });
      move('sm', m(4, 'timeboxed'), 'point', { to: sceneAt(mid, court.C.y + 30), hold: 1.4 });

      // "No project manager: a servant-leader, serving you."
      Sc.leadership(s.scene, { w: s.sceneW, h: s.sceneH, at: m(5, 'no'), until: m(6, 'i') - 0.05, crossAt: m(5, 'manager'), serveAt: m(5, 'servant') });
      move('sm', m(5, 'serving'), 'present', { to: [LEFT, 300], hold: 1.2 });

      // "I chase each impediment, a wall you can't break through." A wall
      // stops a Developer's run; the coach comes off the sideline and
      // clears it, and the run goes on.
      const runner = court.tokens[0];
      const wallX = court.pt([0.72, 0])[0];
      runner.move(m(6, 'chase'), [wallX - 26, court.cy], 0.7);
      court.wall({ x: wallX, y: court.cy - 34, h: 68, at: m(6, 'impediment'), liftAt: m(6, 'through') });
      court.label('Impediment: e.g. a missing license', { x: mid, y: court.C.y + 4, at: m(6, 'impediment'), until: m(6, 'through') + 0.4, tone: 'red' });
      court.coach.move(m(6, 'wall'), [wallX + 8, court.cy + 52], 0.7);
      runner.move(m(6, 'through') + 0.2, court.pt([0.9, 0.5]), 0.6);
      move('sm', m(6, 'through') - 0.1, 'throwUp', { hold: 0.8 });
    }

    function productOwner() {
      const from = start('product-owner');
      const to = start('developers');
      const m = (n, word) => mark(`po-${n}`, word);
      badge('The Product Owner', from, to);
      sign('Product Owner', from);
      enter('po', from - 0.1, to + 0.2, 'right', 'right');
      place('po', 0, RIGHT);
      // The navigator's spyglass in the far hand; the near hand gestures.
      hold('po', from, 'right', 'spyglass');
      hold('po', to, 'right', null);

      // Faded out before the Developers glide in, 0.4 s before their verse.
      const slideEnd = to - 0.75;
      const s = Sc.slide(screen, { ...SLIDE, role: 'navigator', title: 'Product Owner', metaphor: 'the value navigator', at: m(1, 'product'), until: slideEnd, sideW: SIDE });
      const list = Sc.accountabilities(s.side);
      list.ok('one person, maximizes value', m(1, 'one'));
      list.ok('talks with users directly', m(2, 'directly'));
      list.ok('writes user stories', m(3, 'stories'));
      list.ok('orders the Product Backlog', m(3, 'order'));
      list.ok('the single source of work', m(4, 'nobody'));
      list.ok('answers questions', m(5, 'answer'));
      list.ok('checks acceptance criteria', m(6, 'acceptance'));

      // "I'm the Product Owner: one person, value's my call." The chart
      // unrolls; its compass reads Value and swings to the product vision.
      const c = Sc.chart(s.scene, { w: s.sceneW, h: s.sceneH, at: m(1, 'owner'), until: slideEnd });
      const H = s.sceneH;
      const vision = [s.sceneW - 30, 30];
      const port = [84, H - 26];
      const W = s.sceneW;
      const stops = [[W * 0.375, H - 82], [W * 0.61, H - 124], [W * 0.77, H - 164]];
      c.ship(port, m(1, 'owner') + 0.4, [{ to: stops[0], at: m(6, 'storys'), duration: 0.9 }]);
      c.island(vision[0], vision[1], 15, { at: m(1, 'values') - 0.2, seed: 4, flag: true });
      // The chart's words, faded while cards cover part of the chart, so no
      // label peeks out from under one.
      const chartWords = [c.label('Product vision', { x: vision[0] - 20, y: vision[1] - 10, at: m(1, 'values'), tone: 'gold', align: 'right' })];
      chartWords.push(c.roseWord('Value', m(1, 'values')));
      c.needle(m(1, 'values'), -8);
      move('po', m(1, 'one') - 0.1, 'finger', { hold: 1, side: 'left' });
      move('po', m(1, 'values'), 'chest', { hold: 0.9, pats: 1 });

      // "I talk with users directly, not secondhand at all."
      c.user(30, H * 0.6, m(2, 'users'));
      c.user(54, H * 0.68, m(2, 'users') + 0.15);
      // One line each, so the second bubble clears the first.
      K.speech(c.node, 'We lose things!', { x: 8, y: H * 0.6 - 74, w: 150, at: m(2, 'users'), until: m(3, 'stories') - 0.1 });
      K.speech(c.node, 'Tell us fast!', { x: 30, y: H * 0.6 - 40, w: 124, at: m(2, 'directly'), until: m(3, 'stories') - 0.1 });
      c.link([62, H * 0.68 + 8], [port[0] - 14, port[1] - 6], m(2, 'directly'), m(3, 'stories'));
      c.label('talks directly', { x: 134, y: H * 0.6, at: m(2, 'directly') + 0.2, until: m(3, 'stories') - 0.1, tone: 'blue' });
      move('po', m(2, 'talk'), 'listen', { hold: 1.4, side: 'left' });

      // "Needs become user stories; I order them, value on top." Each
      // story is a waypoint; the course runs through them in order of value.
      ['Post an item', 'Ping the owner', 'Search by place'].forEach((story, i) => {
        const [x, y] = stops[i];
        c.island(x, y, 13, { at: m(3, 'stories') + i * 0.18, seed: i + 1, flag: true });
        chartWords.push(c.label(story, { x, y: y + 15, at: m(3, 'stories') + i * 0.18 + 0.1 }));
        chartWords.push(c.number(i + 1, x - 22, y + 1, m(3, 'order') + i * 0.15));
      });
      const course = [port, ...stops, vision];
      for (let i = 0; i + 1 < course.length; i++) c.leg(course[i], course[i + 1], m(3, 'value') + i * 0.25, { duration: 0.3 });
      c.label('Product Backlog: ordered by value', { x: 14, y: H - 27, at: m(3, 'top'), until: m(4, 'builds') - 0.1, tone: 'navy', align: 'left' });
      move('po', m(3, 'order'), 'present', { to: sceneAt(190, 120), hold: 1.4 });

      // "Not on the Product Backlog? Nobody builds it. Stop."
      const idea = [70, 50];
      c.island(idea[0], idea[1], 13, { at: m(4, 'not'), until: m(5, 'i') - 0.1, seed: 9, fog: true });
      c.label('Cool idea!', { x: idea[0], y: idea[1] + 18, at: m(4, 'not') + 0.1, until: m(5, 'i') - 0.1, tone: 'gold' });
      c.leg(stops[1], idea, m(4, 'nobody'), { duration: 0.4, until: m(5, 'i') - 0.1, tone: 'idea' });
      c.cross((stops[1][0] + idea[0]) / 2, (stops[1][1] + idea[1]) / 2, m(4, 'builds'), m(5, 'i') - 0.1);
      c.label('Not on the Product Backlog: not built', { x: 14, y: H - 27, at: m(4, 'builds'), until: m(5, 'questions') + 0.5, tone: 'red', align: 'left' });
      move('po', m(4, 'stop') - 0.1, 'stop', { hold: 1.2, side: 'left' });

      // "I answer all your questions."
      for (const word of chartWords) window.Timeline.fx.fadeOut(word, m(5, 'answer') - 0.3, 0.3);
      const qa = P.card(c.node, { x: 12, y: 12, w: 176, at: m(5, 'answer'), until: m(6, 'check') - 0.35 });
      P.row(qa.body, 'Developer: exact spot or just the building?', { at: m(5, 'answer') });
      P.row(qa.body, 'Product Owner: the exact spot!', { at: m(5, 'questions'), tone: 'title' });
      move('po', m(5, 'questions'), 'thumbs', { hold: 1, side: 'left' });

      // "And when a story's done, I check acceptance criteria one by one."
      // The ship reaches the first waypoint; its criteria are ticked.
      K.checklist(c.node, {
        x: 12, y: 12, w: 228, title: 'Acceptance criteria · Post an item', at: m(6, 'check'),
        items: [
          { text: 'description entered', mark: 'check', at: m(6, 'one') },
          { text: 'pinned on the map', mark: 'check', at: m(6, 'by') },
          { text: 'posted in under a\u00a0minute', mark: 'check', at: m(6, 'one_2') },
        ],
      });
      move('po', m(6, 'check'), 'point', { to: sceneAt(130, 60), hold: 2.4 });
    }

    function developers() {
      const from = start('developers');
      const to = start('who-keeps-track');
      const m = (n, word) => mark(`dev-${n}`, word);
      badge('The Developers', from, to);
      sign('Developers', from);
      for (const who of DEVS) {
        enter(who, from - 0.4, DURATION, 'right', 'right');
        place(who, 0, ROW[who], ROW_SCALE);
      }
      place('newdev', m(1, 'developers'), ROW.newdev, ROW_SCALE, 1);

      // The slide stays above the Developers standing under the screen.
      const s = Sc.slide(screen, { x: S.x + 6, y: S.y + 6, w: S.w - 12, h: 222, role: 'builders', title: 'Developers', metaphor: 'the builders', at: m(1, 'developers'), until: to + 0.1, sideW: 0, header: 36 });
      const site = Sc.site(s.scene, { w: s.sceneW, h: s.sceneH, at: m(1, 'developers'), until: to + 0.1 });

      // "We are the Developers: we design, we code, we test." Together
      // they build the Increment, block by block.
      site.label('Developers build the Increment', { x: 8, y: 6, at: m(1, 'developers') + 0.2, until: m(4, 'definition') - 0.1, tone: 'gold', align: 'left' });
      site.block('design', 'pencil', m(1, 'design'), 'design');
      site.block('code', 'code', m(1, 'code'), 'code');
      site.block('test', 'search', m(1, 'test'), 'test');
      hold('ui', m(1, 'design') - 0.2, 'right', 'palette');
      move('ui', m(1, 'design'), 'present', { to: screenAt(0.3, 0.45), hold: 0.8 });
      move('coder', m(1, 'code'), 'present', { to: screenAt(0.5, 0.45), hold: 0.8 });
      hold('test', m(1, 'test') - 0.2, 'right', 'magnifier');
      move('test', m(1, 'test'), 'point', { to: screenAt(0.7, 0.45), hold: 0.8 });

      // "Cross-functional, all skills here; we self-manage all the rest."
      site.toolbox({ x: 222, y: 46, at: m(2, 'cross'), until: m(4, 'definition') - 0.1 });
      site.label('cross-functional: every skill', { x: 299, y: 120, at: m(2, 'functional'), until: m(3, 'we'), tone: 'cream' });
      const board = site.board({ x: 398, y: 6, w: 172, title: 'We pick our tasks', tasks: ['map view', 'post form', 'ping service'], at: m(2, 'self') - 0.3 });
      board.assign(0, 'coder', m(2, 'manage'));
      board.assign(1, 'ui', m(2, 'all_2'));
      board.assign(2, 'test', m(2, 'rest'));

      // "We plan our Sprint's own work; each day, we adapt the plan."
      board.retitle('Our Sprint plan', m(3, 'plan'));
      board.swap(1, 2, m(3, 'adapt'));
      site.label('re-planned every day', { x: 392, y: 100, at: m(3, 'adapt'), until: to + 0.1, tone: 'gold', align: 'right' });
      for (const who of DEVS) move(who, m(3, 'plan'), 'thumbs', { hold: 1 });
      hold('ui', m(3, 'we') - 0.3, 'right', null);
      hold('test', m(3, 'we') - 0.3, 'right', null);

      // "Definition of Done: we hold to it, hand in hand."
      site.seal('Definition of Done', m(4, 'done'));
      site.label('the whole team holds to it', { x: 212, y: 58, at: m(4, 'hold'), until: to + 0.1, tone: 'cream', align: 'left' });
      for (const who of [...DEVS, 'newdev']) move(who, m(4, 'hand'), 'operatic', { hold: 1.2 });
    }

    // The three accountabilities side by side: after the question, and at the end.
    const ROLE_CARDS = [
      { role: 'coach', title: 'Scrum Master', metaphor: 'the team coach', items: ['coaches the team', 'timeboxes events', 'removes impediments'] },
      { role: 'navigator', title: 'Product Owner', metaphor: 'the value navigator', items: ['maximizes value', 'talks with users', 'orders the Product Backlog'] },
      { role: 'builders', title: 'Developers', metaphor: 'the builders', items: ['build the Increment', 'plan and adapt daily', 'meet the Definition of Done'] },
    ];

    function question() {
      const from = start('who-keeps-track');
      const to = start('chorus-1');
      badge('The question', from, to);
      sign('Who’s the boss?', from);
      Sc.roleCards(screen, { x: S.x + 8, y: TOP + 4, w: S.w - 16, at: mark('question-1', 'if'), until: mark('chorus-1-1', 'predict') - 0.15, cards: ROLE_CARDS });
      move('newdev', mark('question-1', 'boss'), 'shrug', { hold: 1.6 });
      // Beside the New Developer's head: the cards fill the display down to it.
      P.nameplate(content, '?', { x: ROW.newdev - 52, y: 310, at: mark('question-1', 'boss'), until: to });
    }

    // ----------------------------------------------------------------
    // The chorus: empiricism
    // ----------------------------------------------------------------

    function lineUp(at) {
      place('sm', at - 3, LINE.sm, IN_LINE, 0.01, LINE_FLOOR);
      enter('sm', at, DURATION, 'left', 'left');
      place('po', at - 3, LINE.po, IN_LINE, 0.01, LINE_FLOOR);
      enter('po', at, DURATION, 'right', 'right');
      for (const who of [...DEVS, 'newdev']) place(who, at, LINE[who], IN_LINE, 0.9, LINE_FLOOR);
    }

    function chorus(id) {
      const c = (n) => `${id}-${n}`;
      const from = start(id);
      const to = end(id);
      badge(id === 'chorus-1' ? 'Chorus' : 'Final chorus', from, to);
      sign('Empiricism', from);

      // "We can't predict it all; we learn from what we see."
      const predict = kit.scene(screen, from, mark(c(2), 'empiricism'), { exit: 'fade' });
      const plan1 = P.card(predict, { x: S.x + 40, y: TOP + 40, w: 230, at: mark(c(1), 'predict') });
      P.strike(P.row(plan1.body, 'Predict it all up front', { at: mark(c(1), 'predict'), tone: 'title' }), mark(c(1), 'all'));
      const see = P.card(predict, { x: S.x + 310, y: TOP + 40, w: 230, at: mark(c(1), 'we_2'), tone: 'gold' });
      P.row(see.body, 'Learn from what we see', { at: mark(c(1), 'we_2'), tone: 'title', icon: 'eye' });

      // "That's empiricism! Transparency … Inspection … Adaptation …"
      // Empiricism stands on its three pillars, each lit as it is sung.
      Sc.temple(screen, {
        x: S.x + 10, y: TOP + 2, w: S.w - 20, at: mark(c(2), 'empiricism'),
        times: [mark(c(3), 'transparency'), mark(c(4), 'inspection'), mark(c(5), 'adaptation')],
        ribbonAt: mark(c(6), 'sprint'), until: to,
      });
      for (const who of EVERYONE) {
        move(who, mark(c(2), 'empiricism'), 'operatic', { hold: 0.8 });
        move(who, mark(c(6), 'adapt') - 0.1, 'throwUp', { hold: 0.9 });
      }
    }

    // ----------------------------------------------------------------
    // Act two: one Sprint on the strip and the board
    // ----------------------------------------------------------------

    function sprint() {
      const from = start('the-sprint');
      const to = end('sprint-retrospective');
      const strip = K.strip(screen, { x: S.x + 6, y: TOP + 6, w: S.w - 12, h: 60, at: mark('sprint-1', 'sprint'), until: to });
      const board = K.board(screen, { x: S.x + 6, y: BOARD_Y, w: S.w - 12, h: BOARD_H, at: mark('sprint-1', 'sprint') + 0.3, until: to, barY: BOARD_Y + BOARD_H + 6 });
      const bar = (text, at, until, icon) => board.bar(text, at, until, icon);

      // The Product Backlog, ordered: the most valuable on top.
      board.card('post', 'Post an item', { column: 0, slot: 0, at: mark('sprint-1', 'sprint') + 0.5 });
      board.card('ping', 'Ping the owner', { column: 0, slot: 1, at: mark('sprint-1', 'sprint') + 0.65 });
      board.card('search', 'Search by place', { column: 0, slot: 2, at: mark('sprint-1', 'sprint') + 0.8, until: mark('review-2', 'photos') });

      theSprint(strip);
      planning(strip, board, bar);
      daily(strip, board, bar);
      done(strip, board, bar);
      review(strip, board, bar);
      retrospective(strip, bar);
    }

    function theSprint(strip) {
      const from = start('the-sprint');
      const to = start('sprint-planning');
      badge('Act 2 · The Sprint', from, to);
      sign('The Sprint', from);
      forward(['sm'], from, to);
      strip.frame(mark('sprint-1', 'fixed'), mark('sprint-1', 'more') + 0.8);
      strip.label('fixed timebox · ≤ 1 month', mark('sprint-1', 'fixed'));
      move('sm', mark('sprint-1', 'timebox'), 'point', { to: screenAt(0.3, 0.06), hold: 1.4 });
      // "It holds the other events, and the next is at the door."
      ['planning', 'daily', 'review', 'retro'].forEach((id, i) => {
        const at = mark('sprint-2', 'other') + i * 0.35;
        strip.light(id, at, at + 0.6);
      });
      strip.loop(mark('sprint-2', 'next'), to + 0.4);
      move('sm', mark('sprint-2', 'next'), 'present', { to: screenAt(0.9, 0.06), hold: 1 });
    }

    function planning(strip, board, bar) {
      const p = (n) => `planning-${n}`;
      const from = start('sprint-planning');
      const to = start('daily-scrum');
      badge('Sprint Planning', from, to);
      sign('Sprint Planning', from);
      strip.light('planning', mark(p(1), 'sprint'), to);

      // "First, the why: the Sprint Goal we all share. Post a found wallet:
      // its owner gets a ping right there."
      forward(['po'], from, mark(p(3), 'the') - 0.2);
      // The goal replaces the question in its slot: the old card has faded
      // before the new one pops in, so their words never overlap.
      board.card('why', 'Why: the Sprint Goal', { column: 1, slot: 0, tone: 'goal', at: mark(p(1), 'why'), until: mark(p(2), 'post') - 0.3 });
      board.card('goal', 'Goal: owner pinged', { column: 1, slot: 0, tone: 'goal', at: mark(p(2), 'post') });
      move('po', mark(p(1), 'goal'), 'present', { to: screenAt(0.5, 0.36), hold: 1.6 });
      move('newdev', mark(p(1), 'share'), 'thumbs', { hold: 1 });

      // "The what: we pick what fits. The how: we break it down."
      forward(DEVS, mark(p(3), 'the') - 0.1, to + 0.2);
      board.move('post', { column: 1, slot: 1, at: mark(p(3), 'pick') });
      board.move('ping', { column: 1, slot: 2, at: mark(p(3), 'fits') });
      bar('What: the stories that fit', mark(p(3), 'the'), mark(p(4), 'how') - 0.3);
      board.tasks('post', mark(p(4), 'break'));
      board.tasks('ping', mark(p(4), 'down'));
      bar('What: the stories that fit · How: tasks of a day or less', mark(p(4), 'how'), mark(p(5), 'sprint') - 0.35);
      for (const who of DEVS) move(who, mark(p(3), 'pick'), 'point', { to: screenAt(0.5, 0.45), hold: 1 });

      // "Why, what, and how together: our Sprint Backlog, written down."
      board.column(1, mark(p(5), 'sprint'), mark(p(5), 'down') + 1);
      bar('Sprint Planning: inspects the Product Backlog → adapts: a Sprint Backlog', mark(p(5), 'sprint'), mark('daily-1', 'time'));
    }

    function daily(strip, board, bar) {
      const d = (n) => `daily-${n}`;
      const from = start('daily-scrum');
      const to = start('laptop');
      badge('The Daily Scrum', from, to);
      sign('Daily Scrum', from);
      strip.light('daily', mark(d(1), 'daily'), to);
      forward(DEVS, from, line(d(5)).end);

      // "Daily Scrum: fifteen minutes, standing, same time, same place."
      const clock = P.card(screen, { ...OVER_INCREMENT, at: mark(d(1), 'fifteen'), until: mark(d(3), 'is') - 0.1, tone: 'gold' });
      P.row(clock.body, '15 min', { at: mark(d(1), 'fifteen'), icon: 'timer', tone: 'title' });
      P.row(clock.body, 'same time · same place', { at: mark(d(1), 'same') });

      // "Inspect: on track to the Sprint Goal? Adapt: re-plan, keep pace."
      board.progress('goal', mark(d(2), 'inspect'), mark(d(2), 'goal'), 0.5);
      board.move('post', { column: 1, slot: 2, at: mark(d(2), 'adapt') });
      board.move('ping', { column: 1, slot: 1, at: mark(d(2), 'adapt') });
      bar('Daily Scrum: inspects progress → adapts today’s plan', mark(d(2), 'adapt'), mark(d(4), 'no'));
      for (const who of DEVS) move(who, mark(d(2), 'inspect'), 'temple', { hold: 0.8, taps: 1 });

      // "Is it a status report? No: it's us, for us!"
      const report = P.card(screen, { ...OVER_INCREMENT, title: 'To: Manager', at: mark(d(3), 'status'), until: mark(d(5), 'day') - 0.1 });
      P.strike(P.row(report.body, 'Status report', { at: mark(d(3), 'status'), tone: 'title' }), mark(d(4), 'no'));
      bar('Developers talking to Developers', mark(d(4), 'us'), mark(d(5), 'stuck'));
      move('ui', mark(d(3), 'status'), 'shrug', { hold: 1 });
      for (const who of DEVS) move(who, mark(d(4), 'no'), 'wag', { hold: 0.8, times: 2 });

      // "Day four: we're stuck: the lost-and-found won't share its log."
      const calendar = P.card(screen, { ...OVER_INCREMENT, at: mark(d(5), 'day'), until: mark(d(7), 'flows') + 1, tone: 'gold' });
      P.row(calendar.body, 'Day 4', { at: mark(d(5), 'day'), tone: 'title' });
      K.wall(screen, {
        x: S.x + 197, y: BOARD_Y + 4, w: 182, rows: 3, at: mark(d(5), 'stuck'), liftAt: mark(d(7), 'friday'),
        label: 'Impediment: no access to the lost-and-found log',
      });
      for (const who of DEVS) move(who, mark(d(5), 'stuck'), 'despair', { hold: 1 });

      // "An impediment: I'm on it! Keep building, off I go. The office signs
      // the form; by Friday, the data flows."
      forward(['sm'], mark(d(6), 'an') - 0.2, line(d(7)).end + 0.2);
      hold('sm', mark(d(6), 'impediment'), 'right', 'clipboard');
      move('sm', mark(d(6), 'on'), 'chest', { hold: 0.8, pats: 1 });
      move('sm', mark(d(6), 'off'), 'salute', { hold: 0.8 });
      kit.stamp(screen, 'Signed', { x: OVER_INCREMENT.x + 30, y: BOARD_Y + 56, at: mark(d(7), 'signs'), until: mark(d(8), 'one'), color: 'green', small: true, from: 1.8, shake: false });
      hold('sm', mark(d(7), 'flows') + 0.4, 'right', null);
      bar('The coach cleared the impediment', mark(d(7), 'flows'), mark(d(8), 'cut'), 'whistle');
      move('sm', mark(d(7), 'flows'), 'thumbs', { hold: 1 });

      // "One story's twice as big? We'll cut it down to size. Trim the scope,
      // not the goal: the Sprint Goal never slides."
      forward(['po'], mark(d(8), 'one') - 0.2, line(d(9)).end + 0.2);
      board.swell('post', mark(d(8), 'twice'), mark(d(8), 'cut'));
      board.fade('post', mark(d(9), 'trim'));
      board.card('basic', 'Post: basic form', { column: 1, slot: 2, at: mark(d(9), 'trim') + 0.1 });
      board.card('picker', 'Post: map picker', { column: 1, slot: 2, at: mark(d(9), 'trim') + 0.1, tone: 'note' });
      board.move('picker', { column: 0, slot: 0, at: mark(d(9), 'scope') });
      board.lock('goal', mark(d(9), 'goal'));
      bar('Same destination, shorter route: trim the scope, keep the Sprint Goal', mark(d(9), 'sprint'), mark('done-2', 'definition') - 0.1, 'compass');
      move('po', mark(d(9), 'trim'), 'shove', { to: screenAt(0.3, 0.4), hold: 0.6 });
      move('po', mark(d(9), 'never'), 'wag', { hold: 0.9, times: 2 });
    }

    function done(strip, board, bar) {
      const n = (k) => `done-${k}`;
      badge('Done?', start('laptop'), start('sprint-review'));
      sign('Done?', start('laptop'));
      // "It works on my laptop: so it's done, right?"
      forward(['newdev'], start('laptop'), line('laptop-1').end + 0.2);
      const laptop = P.card(screen, { ...OVER_INCREMENT, at: mark('laptop-1', 'laptop'), until: mark(n(2), 'definition') - 0.1, tone: 'gold' });
      P.row(laptop.body, 'works on my laptop', { at: mark('laptop-1', 'laptop'), icon: 'laptop', tone: 'title' });
      move('newdev', mark('laptop-1', 'laptop') - 0.1, 'present', { to: screenAt(0.8, 0.5), hold: 1.2 });
      move('newdev', mark('laptop-1', 'right'), 'shrug', { hold: 0.9 });

      // The Definition of Done covers the strip while the stories meet it.
      const from = start('definition-of-done');
      forward(DEVS, from, end('definition-of-done'));
      const items = (marks) => ['code reviewed', 'tests pass', 'tried on a phone'].map((text, i) => ({ text, ...marks[i] }));
      K.checklist(screen, {
        x: S.x + 6, y: TOP, w: S.w - 12, title: 'Definition of Done · Ping the owner', tone: 'rule', inline: true,
        at: mark(n(2), 'definition'), until: mark(n(4), 'miss') - 0.35,
        items: items([
          { mark: 'check', at: mark(n(3), 'meet') }, { mark: 'check', at: mark(n(3), 'all') }, { mark: 'check', at: mark(n(3), 'usable') },
        ]),
      });
      // "Meet it all? It's usable: the Increment has grown!"
      board.fade('ping', mark(n(3), 'increment'));
      board.stack('Ping the owner', mark(n(3), 'increment'));
      bar('Increment: usable, adds to all earlier work', mark(n(3), 'usable'), mark(n(4), 'isnt') - 0.3);
      for (const who of DEVS) move(who, mark(n(3), 'grown'), 'throwUp', { hold: 0.8 });

      // "Miss one? It isn't done: back to the Product Backlog."
      K.checklist(screen, {
        x: S.x + 6, y: TOP, w: S.w - 12, title: 'Definition of Done · Post: basic form', tone: 'rule', inline: true,
        at: mark(n(4), 'miss'), until: end('definition-of-done'),
        items: items([
          { mark: 'check', at: mark(n(4), 'miss') + 0.1 }, { mark: 'check', at: mark(n(4), 'miss') + 0.25 }, { mark: 'cross', at: mark(n(4), 'one') },
        ]),
      });
      board.move('basic', { column: 0, slot: 1, at: mark(n(4), 'back') });
      bar('Not done: not in the Increment', mark(n(4), 'isnt'), start('sprint-review') + 1.2);
      move('newdev', mark(n(4), 'isnt'), 'facepalm', { hold: 1 });
    }

    function review(strip, board, bar) {
      const r = (k) => `review-${k}`;
      const from = start('sprint-review');
      const to = start('sprint-retrospective');
      badge('Sprint Review', from, to);
      sign('Sprint Review', from);
      strip.light('review', mark(r(1), 'sprint'), to);
      forward(['po'], from, to);

      // "Inspect the product: a live demo, not slides."
      const demo = kit.scene(screen, mark(r(1), 'inspect'), mark(r(2), 'ask') + 0.1, { exit: 'fade' });
      const slides = P.card(demo, { x: S.x + 214, y: BOARD_Y + 40, w: 150, at: mark(r(1), 'live') });
      P.strike(P.row(slides.body, 'Slides', { at: mark(r(1), 'live'), icon: 'pages', tone: 'title' }), mark(r(1), 'not'));
      const live = P.card(demo, { ...OVER_INCREMENT, at: mark(r(1), 'demo'), tone: 'gold' });
      P.row(live.body, 'Live demo', { at: mark(r(1), 'demo'), icon: 'phone', tone: 'title' });
      P.row(live.body, 'with stakeholders', { at: mark(r(1), 'demo') + 0.2 });
      move('po', mark(r(1), 'demo'), 'present', { to: screenAt(0.85, 0.4), hold: 1.4 });

      // "Users ask for photos: to the Product Backlog it flies."
      K.speech(screen, 'Add photos of found items?', { x: S.x + 214, y: BOARD_Y + 30, w: 200, at: mark(r(2), 'ask') + 0.1, until: mark(r(2), 'flies') + 0.6, tail: 'right' });
      board.move('picker', { column: 0, slot: 1, at: mark(r(2), 'photos') });
      board.move('basic', { column: 0, slot: 2, at: mark(r(2), 'photos') });
      board.card('photos', 'Photos of found items', { column: 0, slot: 0, at: mark(r(2), 'backlog'), tone: 'note' });
      bar('Sprint Review: inspects the Increment → adapts the Product Backlog', mark(r(2), 'product'), mark('retro-1', 'how'), 'compass');
      move('po', mark(r(2), 'backlog'), 'point', { to: screenAt(0.12, 0.45), hold: 1.2 });
    }

    function retrospective(strip, bar) {
      const r = (k) => `retro-${k}`;
      const from = start('sprint-retrospective');
      const to = start('chorus-2');
      badge('Sprint Retrospective', from, to);
      sign('Retrospective', from);
      strip.light('retro', mark(r(1), 'sprint'), mark(r(4), 'round'));

      // "The process: how did we work this time?"
      const how = P.card(screen, { x: S.x + 160, y: BOARD_Y + 30, w: 270, at: mark(r(1), 'process'), until: mark(r(2), 'we') - 0.1, tone: 'gold' });
      P.row(how.body, 'How did we work?', { at: mark(r(1), 'how'), tone: 'title', icon: 'question' });
      for (const who of EVERYONE) move(who, mark(r(1), 'how'), 'temple', { hold: 0.9, taps: 1 });

      // "We merged it all on the last night: next Sprint, we merge as we go!"
      K.timeline(screen, {
        x: S.x + 6, y: BOARD_Y, w: S.w - 12, h: BOARD_H, at: mark(r(2), 'we'), redrawAt: mark(r(2), 'next'), until: mark(r(3), 'sprint') - 0.1,
        label: 'This Sprint: every merge on the last night', afterLabel: 'Next Sprint: merge a little every day',
        before: [0, 1, 2, 3].map((stack) => ({ day: 9, stack, conflict: stack % 2 === 1 })),
        after: Array.from({ length: 10 }, (_, day) => ({ day, stack: 0 })),
      });
      bar('Sprint Retrospective: inspects how we work → adapts the process', mark(r(2), 'merge'), mark(r(4), 'then'));
      for (const who of EVERYONE) move(who, mark(r(2), 'night'), 'facepalm', { hold: 0.8 });

      // "Sprint Review: what we build. Sprint Retrospective: how."
      const signsScene = kit.scene(screen, mark(r(3), 'sprint') - 0.1, mark(r(4), 'then') + 1.2, { exit: 'fade' });
      K.cover(signsScene, { x: S.x + 6, y: BOARD_Y, w: S.w - 12, h: BOARD_H, at: mark(r(3), 'sprint') - 0.1 });
      const what = P.card(signsScene, { x: S.x + 20, y: BOARD_Y + 20, w: 260, at: mark(r(3), 'sprint'), tone: 'cream' });
      // Each wraps after its colon, never round a lone word.
      P.row(what.body, 'Sprint Review: WHAT\u00a0we\u00a0build', { at: mark(r(3), 'what'), tone: 'title' });
      const howSign = P.card(signsScene, { x: S.x + 308, y: BOARD_Y + 20, w: 260, at: mark(r(3), 'sprint_2'), tone: 'gold' });
      P.row(howSign.body, 'Sprint Retrospective: HOW\u00a0we\u00a0build', { at: mark(r(3), 'sprint_2'), tone: 'title' });

      // "Then round we go: Sprint Planning, the next Sprint starts right now!"
      strip.loop(mark(r(4), 'round'), mark(r(4), 'now') + 0.6);
      strip.light('planning', mark(r(4), 'planning'), to);
      strip.rename('Sprint 2', mark(r(4), 'next'));
      for (const who of EVERYONE) move(who, mark(r(4), 'now'), 'operatic', { hold: 1 });
    }

    // ----------------------------------------------------------------
    // Pop quiz: a new team, a bus-tracker app
    // ----------------------------------------------------------------

    const QUIZ = [
      { id: 'quiz-1', who: DEVS, icon: 'hardhat', reason: 'Developers re-plan their day', icons: ['user', 'receipt'] },
      { id: 'quiz-2', who: ['po'], icon: 'compass', reason: 'Product Owner orders it', icons: ['envelope', 'laptop'] },
      { id: 'quiz-3', who: ['sm'], icon: 'timer', reason: 'Unfinished work returns', icons: ['timer'] },
      { id: 'quiz-4', who: ['po'], icon: 'eye', reason: 'The Product Backlog adapts', icons: ['user', 'pin'] },
      { id: 'quiz-5', who: ['sm'], icon: 'whistle', reason: 'Blockers are impediments', icons: ['receipt', 'lock'] },
      { id: 'quiz-6', who: DEVS, icon: 'hardhat', reason: 'Not in the Increment', icons: ['check', 'cross'] },
      { id: 'quiz-7', who: EVERYONE, icon: 'resend', reason: 'It adapts the process', icons: ['resend', 'warning'] },
    ];

    function quiz() {
      const from = start('quiz-intro');
      badge('Pop quiz', from, end('quiz'));
      sign('Pop quiz', from);
      const intro = P.card(screen, { x: S.x + 150, y: TOP + 40, w: 290, at: mark('quiz-intro-1', 'pop'), until: line('quiz-1').start - 0.4, tone: 'gold' });
      P.row(intro.body, 'Pop quiz!', { at: mark('quiz-intro-1', 'pop'), tone: 'title' });
      P.row(intro.body, 'A bus-tracker team', { at: mark('quiz-intro-1', 'new'), icon: 'pin' });
      forward(['newdev'], from, end('quiz'));

      QUIZ.forEach((q, i) => {
        const l = line(q.id);
        const next = QUIZ[i + 1] ? line(QUIZ[i + 1].id).start : end('quiz') + 0.3;
        const card = K.quiz(screen, {
          x: S.x + 10, y: TOP + 4, w: S.w - 20, n: i + 1, total: QUIZ.length, team: 'A bus-tracker team', question: l.text,
          // Gone before the next card pops in at the same place.
          answer: l.answer, reason: q.reason, icon: q.icon, at: l.start + 0.1, answerAt: l.answer_at, until: next - 0.25,
        });
        for (const name of q.icons) card.art.append(kit.icon(name));
        for (const who of q.who) {
          if (who !== 'newdev') forward([who], l.answer_at - 0.1, next - 0.3);
          move(who, l.answer_at, 'thumbs', { hold: 1 });
        }
      });
    }

    // ----------------------------------------------------------------
    // Outro and finale
    // ----------------------------------------------------------------

    function outro() {
      const from = start('outro');
      badge('Outro', from, start('finale'));
      sign('Inspect and Adapt', from);
      Sc.roleCards(screen, { x: S.x + 8, y: TOP + 4, w: S.w - 16, at: mark('outro-1', 'first'), until: start('finale'), cards: ROLE_CARDS, every: 0.15 });
      // "…just a team that learns": the newcomer is now one of the Developers.
      P.nameplate(content, 'New on the team', { x: LINE.newdev, y: 312, at: from, until: mark('outro-1', 'sight') });
      P.nameplate(content, 'Developer', { x: LINE.newdev, y: 312, at: mark('outro-1', 'just'), until: mark('finale-1', 'inspect') - 0.3 });
      move('newdev', mark('outro-1', 'just') - 0.1, 'chest', { hold: 1, pats: 2 });

      const finale = start('finale');
      const temple = Sc.temple(screen, {
        x: S.x + 10, y: TOP + 2, w: S.w - 20, at: finale, ribbonAt: mark('finale-1', 'inspect'),
        times: [finale + 0.2, finale + 0.35, finale + 0.5], until: DURATION,
      });
      temple.glowAll(mark('finale-1', 'inspect'), DURATION);
      for (const who of EVERYONE) move(who, mark('finale-1', 'adapt'), 'bow', { hold: 1.2 });
    }

    intro();
    scrumMaster();
    productOwner();
    developers();
    question();
    lineUp(start('chorus-1') - 0.6);
    chorus('chorus-1');
    sprint();
    chorus('chorus-2');
    quiz();
    outro();

    // The team sign over the display: each name until the next one goes up.
    signs.sort((x, y) => x[0] - y[0]).forEach(([at, text], i) => window.TeamRoom.sign(content, text, { at, until: signs[i + 1]?.[0] }));

    // ----------------------------------------------------------------
    // Build the cast: every figure sings its own words and the team's.
    // ----------------------------------------------------------------

    /**
     * The [start, end] word intervals a figure's mouth follows: the lines its
     * voice sings, the whole team's lines, and every sung quiz answer.
     */
    function wordsFor(voice) {
      const words = [];
      for (const section of song.storyboard.sections) {
        for (const l of section.lines) {
          const sung = l.voice || section.voice;
          const times = Object.values(l.marks || {}).sort((a, b) => a - b);
          times.forEach((at, i) => {
            const answer = l.answer_at !== undefined && at >= l.answer_at;
            const mine = answer || sung === voice || sung === 'Whole Scrum Team';
            if (mine) words.push([at, i + 1 < times.length ? times[i + 1] : l.end]);
          });
        }
      }
      return words.sort((a, b) => a[0] - b[0]);
    }

    const byTime = (a, b) => a[0] - b[0];
    EVERYONE.forEach((who, seed) => {
      const p = plan[who];
      C.figure(content, {
        role: COSTUME[who], gender: GENDER[who],
        hero: who === 'newdev' ? student?.heroHead() : student?.castHead(castLook(GENDER[who])),
        stage: p.stage.sort(byTime), places: p.places.sort(byTime),
        moves: p.moves.sort(byTime), holds: p.holds.sort(byTime), words: wordsFor(VOICE[who]), seed,
      });
    });

    return { layers: [screen] };
  };
})();
