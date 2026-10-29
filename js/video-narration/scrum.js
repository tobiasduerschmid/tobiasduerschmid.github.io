/*
 * Choreography for the Scrum video narration (storyboard:
 * _data/explainers/scrum.yml). The narration reaches this stage as a song:
 * each scene is a section, each cue a line `<scene>-<n>`, and `mark(line,
 * word)` is the estimated time the narrator says that word (repeated words
 * are word2, word3, ...). Every cue is drawn here, in one visual language;
 * each cue's `visual` text in the storyboard describes its picture.
 *
 * The teaching rule for the pictures: show the mechanism the cue names, with
 * Hall Hopper's team as the example, and write every state as a word (Quiet,
 * Blocked, Done) as well as a color. A summary is a picture too: the same
 * cards, notes, and badges as the story, arranged to compare. Stamps never
 * shake the stage, and nothing large changes brightness quickly (WCAG 2.3.1).
 * Layout: the 960x540 stage; the player draws captions outside the picture.
 * Paper pieces (card, note, speech, checklist) are as wide as `w` plus their
 * padding; dark cards (listCard) are exactly `w` wide.
 */
(function () {
  'use strict';

  const HALLS = [
    { name: 'North Hall', level: 'packed' },
    { name: 'East Commons', level: 'busy' },
    { name: 'Hilltop Cafe', level: 'quiet' },
  ];
  const BACKLOG = ['See how crowded each hall is', "Tonight's menus", 'Hall photos', 'Favorite halls', 'Dark mode'];
  const SPRINT_GOAL = 'Students can check how crowded a hall is before walking over';
  const SPRINT_ITEMS = BACKLOG.slice(0, 3);
  const TASKS = ['Read swipe counts', 'Draw the meter', 'Write meter tests', 'Hall list screen'];
  // Ana is the Product Owner and Ben the Scrum Master; the other five are the Developers.
  const TEAM = ['Ana', 'Ben', 'Chloe', 'Diego', 'Eli', 'Farah', 'Gus'];
  const DONE = ['Code reviewed', 'Automated tests pass', 'Tested on a real phone'];
  // Each picture's heading: the role, artifact, or event its scene teaches,
  // with the icon that stands for it in every picture (the Developers build
  // with a pencil, the Product Owner navigates value with a compass, the
  // Scrum Master shields the team). A cue range may name a narrower topic.
  const TOPICS = {
    intro: { kind: 'Scrum', name: 'At a glance', iconName: 'sparkle' },
    theory: { kind: 'Theory', name: 'Empiricism', iconName: 'eye' },
    team: { kind: 'Role', name: 'The Scrum Team', iconName: 'team', from: { 3: { kind: 'Role', name: 'Developers', iconName: 'pencil' } } },
    product_owner: { kind: 'Role', name: 'Product Owner', iconName: 'globe' },
    scrum_master: { kind: 'Role', name: 'Scrum Master', iconName: 'shield' },
    product_backlog: { kind: 'Artifact', name: 'Product Backlog', iconName: 'sortAsc' },
    sprint_backlog: { kind: 'Artifact', name: 'Sprint Backlog', iconName: 'list' },
    increment: { kind: 'Artifact', name: 'Increment', iconName: 'box' },
    sprint: { kind: 'Event', name: 'Sprint', iconName: 'calendar' },
    sprint_planning: { kind: 'Event', name: 'Sprint Planning', iconName: 'forward' },
    daily_scrum: { kind: 'Event', name: 'Daily Scrum', iconName: 'timer' },
    sprint_review: { kind: 'Event', name: 'Sprint Review', iconName: 'eye' },
    sprint_retrospective: { kind: 'Event', name: 'Sprint Retrospective', iconName: 'loop' },
    inspect_adapt: { kind: 'Theory', name: 'Inspect and adapt', iconName: 'loop' },
    summary: { kind: 'Scrum', name: 'Recap', iconName: 'check' },
  };
  function topicOf(cueId) {
    const [, scene, number] = cueId.match(/^(.*)-(\d+)$/);
    const topic = TOPICS[scene];
    const narrower = Object.entries(topic.from || {}).filter(([first]) => Number(number) >= Number(first)).pop();
    return narrower ? narrower[1] : topic;
  }

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.scrum = function choreograph({ song, kit, layers }) {
    const { fx, tween, EASE } = window.Timeline;
    const sk = window.ScrumKit;
    const us = window.StoryKit;
    const { content } = layers;
    const begin = (id) => song.line(id).start;
    const end = (id) => song.line(id).end;
    const at = (id, word) => song.mark(id, word);
    /** One picture from the start of cue `from` to the end of cue `to`, headed by its topic. */
    function picture(from, to = from) {
      const node = kit.scene(content, begin(from), end(to), { exit: 'fade' });
      sk.topicTag(node, { ...topicOf(from), at: begin(from) + 0.15 });
      return sk.body(node);
    }
    const sticker = (parent, text, options) => kit.sticker(parent, text, { rotate: -3, ...options });
    const stamp = (parent, text, options) => kit.stamp(parent, text, { shake: false, from: 1.8, ...options });

    // A board column of ranked backlog cards; returns the cards.
    function backlogCards(parent, { x, y, from, count = BACKLOG.length, step = 72 }) {
      return BACKLOG.slice(0, count).map((text, i) => sk.card(parent, { x, y: y + i * step, text, rank: i + 1, at: from + i * 0.18 }));
    }

    // A large heading in the top-left corner of a picture.
    function heading(parent, text, { x = 40, y = 20, at: when }) {
      sk.label(parent, { x, y, text, at: when }).classList.add('sk-text-xl');
    }

    // The Sprint Backlog's three parts as rows: why (the Sprint Goal), what
    // (the selected items), and how (the plan of tasks).
    function sprintBacklogParts(parent, times) {
      sk.frame(parent, { x: 240, y: 60, w: 690, h: 460, label: 'Sprint Backlog', at: times.frame });
      const part = (y, question, answer, when) => sk.listCard(parent, { x: 30, y, w: 190, title: question, text: answer, iconName: 'question', at: when });
      part(84, 'Why?', 'Sprint Goal', times.why);
      sk.banner(parent, { x: 265, y: 96, w: 620, title: 'Sprint Goal', text: SPRINT_GOAL, at: times.goal });
      part(232, 'What?', 'Selected items', times.what);
      SPRINT_ITEMS.forEach((text, i) => sk.card(parent, { x: 262 + i * 220, y: 240, w: 190, text, at: times.items + i * 0.2 }));
      part(380, 'How?', 'Plan of tasks', times.how);
      TASKS.forEach((text, i) => sk.note(parent, { x: 262 + i * 166, y: 396, w: 136, text, tone: 'cyan', tilt: i % 2 ? 1.5 : -1.5, at: times.tasks + i * 0.15 }));
    }

    // ----------------------------------------------------------------
    // Intro: the dinner line, waterfall versus a loop, Scrum at a glance
    // ----------------------------------------------------------------

    function intro() {
      const a = picture('intro-1');
      sk.clock(a, { x: 40, y: 30, text: '6:58 PM', at: begin('intro-1') + 0.2 });
      sk.door(a, { x: 50, y: 250, sign: 'Dining Hall', at: begin('intro-1') + 0.3 });
      sk.queue(a, { x: 220, y: 380, count: 9, gap: 46, at: begin('intro-1') + 0.6 });
      sk.speech(a, { x: 300, y: 240, text: "I'm starving!", at: at('intro-1', 'starving') });
      sticker(a, 'Again.', { x: 470, y: 130, at: at('intro-1', 'again'), variant: 'red', iconName: 'warning' });
      sk.phone(a, { x: 660, y: 40, halls: HALLS, at: at('intro-1', 'hopper'), rowsAt: at('intro-1', 'menus') });
      sticker(a, 'Two weeks', { x: 450, y: 30, at: at('intro-1', 'weeks'), variant: 'gold', iconName: 'calendar' });

      const b = picture('intro-2');
      sk.staircase(b, { x: 40, y: 60, steps: ['Requirements', 'Design', 'Build', 'Test'], at: begin('intro-2') + 0.2, dx: 60, dy: 64 });
      sk.wave(b, { x: 20, y: 370, text: 'Change', at: at('intro-2', 'else') });
      sticker(b, 'Too late to change course', { x: 30, y: 320, at: at('intro-2', 'late'), variant: 'red', iconName: 'cross' });
      sk.loop(b, { x: 720, y: 260, r: 150, labels: ['Plan', 'Build', 'Show', 'Improve'], at: at('intro-2', 'scrum'), period: 5 });
      sticker(b, 'Every few weeks', { x: 600, y: 470, at: at('intro-2', 'deliver'), variant: 'cyan', iconName: 'loop' });

      // Scrum at a glance: three roles, three artifacts, and five events.
      const three = 'intro-3';
      const c = picture(three);
      heading(c, 'Deliberately small', { at: at(three, 'deliberately') });
      sticker(c, 'Most popular', { x: 520, y: 30, at: at(three, 'popular'), variant: 'cyan', iconName: 'sparkle' });
      [
        { name: '3 roles', line: 'Who is accountable for what', iconName: 'team', word: 'roles', listAt: 'accountable', items: ['Developers', 'Product Owner', 'Scrum Master'] },
        { name: '3 artifacts', line: 'The work everyone can see', iconName: 'list', word: 'artifacts', listAt: 'see', items: ['Product Backlog', 'Sprint Backlog', 'Increment'] },
        { name: '5 events', line: 'The rhythm of learning', iconName: 'calendar', word: 'events', listAt: 'rhythm', items: ['Sprint', 'Sprint Planning', 'Daily Scrum', 'Sprint Review', 'Sprint Retrospective'] },
      ].forEach((part, i) => sk.listCard(c, {
        x: 30 + i * 305, y: 104, w: 290, h: 300, title: part.name, text: part.line, iconName: part.iconName, at: at(three, part.word),
        items: part.items.map((text, j) => ({ text, at: at(three, part.listAt) + j * 0.2 })),
      }));
      sticker(c, 'The team decides the rest', { x: 40, y: 448, at: at(three, 'decides'), variant: 'green', iconName: 'team' });
      sticker(c, 'Next: one sprint', { x: 620, y: 448, at: at(three, 'follow'), variant: 'gold', iconName: 'forward' });
    }

    // ----------------------------------------------------------------
    // Theory: predict versus observe, then empiricism's three pillars
    // ----------------------------------------------------------------

    function theory() {
      const a = picture('theory-1');
      sk.label(a, { x: 40, y: 50, w: 340, text: 'Predict everything up front?', at: at('theory-1', 'predict') });
      sk.ball(a, { x: 110, y: 170, at: begin('theory-1') + 0.3 });
      stamp(a, 'Too complex', { x: 50, y: 300, at: at('theory-1', 'harder'), color: 'red', rotate: -8 });
      sk.speech(a, { x: 430, y: 40, w: 380, who: 'Big question', text: 'Will students trust a crowd meter?', at: at('theory-1', 'trust') });
      const word = sk.label(a, { x: 430, y: 175, w: 500, text: 'Empiricism: learn by observing', at: at('theory-1', 'empiricism') });
      word.classList.add('sk-text-xl');
      sk.loop(a, { x: 680, y: 390, r: 95, labels: ['Try it', 'Watch', 'Adjust'], at: at('theory-1', 'observation'), period: 4 });

      // The pillars rise one cue at a time; the right side shows each in action.
      const [two, three, four] = ['theory-2', 'theory-3', 'theory-4'];
      const b = picture(two, four);
      sk.temple(b, { x: 30, y: 36, w: 560, roof: 'Scrum', base: 'Empiricism: decide from what you observe', baseY: 446, at: begin(two) + 0.1 });
      const rise = [at(two, 'transparency'), at(three, 'inspection'), at(four, 'adaptation')];
      const everyEvent = at(four, 'event');
      const pillars = [['Transparency', 'Work visible to all'], ['Inspection', 'Check often'], ['Adaptation', 'Adjust quickly']]
        .map(([name, line], i) => sk.pillar(b, {
          x: 54 + i * 180, y: 160, w: 152, h: 286, title: name, text: line, at: rise[i],
          lit: [[rise[i], rise[i + 1]], [everyEvent]],
        }));

      // Transparency: the work is on the wall, for those who do it and receive it.
      sk.column(b, { x: 620, y: 30, w: 310, h: 236, title: 'On the wall', at: at(two, 'visible') - 0.2, until: end(three) });
      ['Crowd meter', "Tonight's menus", 'Hall photos'].forEach((text, i) => {
        sk.card(b, { x: 635, y: 90 + i * 58, w: 270, text, at: at(two, 'visible') + i * 0.15, until: end(three) });
      });
      sk.badge(b, { x: 630, y: 318, w: 130, role: 'Developers', iconName: 'pencil', at: at(two, 'doing'), until: end(two) });
      sk.badge(b, { x: 800, y: 318, role: 'Students', iconName: 'user', at: at(two, 'receiving'), until: end(two) });
      sticker(b, 'Visible to all', { x: 660, y: 470, at: at(two, 'wall'), until: end(two), variant: 'cyan', iconName: 'eye' });

      // Inspection: a frequent check catches a bug while it is small.
      const lens = sticker(b, 'Inspect', { x: 790, y: 84, at: at(three, 'checks'), until: end(three), variant: 'gold', iconName: 'search' });
      fx.moveTo(lens, at(three, 'often'), 0, 112, 1.2);
      sk.note(b, { x: 640, y: 290, w: 270, text: 'Bug: the meter shows the wrong hall', tone: 'red', at: at(three, 'problems'), until: end(three) });
      sticker(b, 'Caught early', { x: 660, y: 362, at: at(three, 'small'), until: end(three), variant: 'green', iconName: 'check' });
      sticker(b, 'Makes inspection possible', { x: 40, y: 380, at: at(three, 'transparency'), until: end(three), variant: 'cyan', iconName: 'link' });
      sk.slot(b, { x: 630, y: 414, w: 300, h: 64, text: 'Hidden work', at: at(three, 'inspecting'), until: end(three) });
      stamp(b, 'Misleading', { x: 700, y: 486, at: at(three, 'misleading'), until: end(three), color: 'red', rotate: -6, small: true });

      // Adaptation: drift off course, then adjust; inspecting alone is pointless.
      sk.label(b, { x: 630, y: 40, text: 'Course', at: at(four, 'pillar'), muted: true });
      sk.arrow(b, { from: [630, 140], to: [930, 140], dashed: true, at: at(four, 'pillar') });
      const walker = sk.dot(b, { x: 634, y: 130, at: at(four, 'pillar') + 0.3 });
      fx.moveTo(walker, at(four, 'drifts'), 120, -64, 0.9);
      fx.moveTo(walker, at(four, 'adjusts'), 250, 0, 0.9);
      sticker(b, 'Off course', { x: 770, y: 30, at: at(four, 'drifts') + 0.4, until: at(four, 'adjusts'), variant: 'red', iconName: 'warning' });
      sticker(b, 'Adjusted', { x: 770, y: 30, at: at(four, 'adjusts') + 0.6, variant: 'green', iconName: 'check' });
      sk.note(b, { x: 640, y: 200, w: 270, text: 'Inspect without adapting', tone: 'pink', at: at(four, 'inspecting') });
      stamp(b, 'Pointless', { x: 700, y: 272, at: at(four, 'pointless'), color: 'red', rotate: -8, small: true });
      sk.note(b, { x: 640, y: 340, w: 270, text: 'Every event: inspect and adapt', tone: 'cyan', tilt: 1.5, at: everyEvent });
      pillars.forEach((node, i) => fx.bump(node, everyEvent + i * 0.15, 0.05));
    }

    // ----------------------------------------------------------------
    // Roles: the team, the character-select screen, and each role
    // ----------------------------------------------------------------

    function team() {
      const one = 'team-1';
      const two = 'team-2';
      const a = picture(one, two);
      sk.frame(a, { x: 40, y: 80, w: 880, h: 420, label: 'One Scrum Team', at: begin(one) + 0.1 });
      const xs = TEAM.map((name, i) => {
        const x = 64 + i * 122;
        sk.badge(a, { x, y: 140, role: name, iconName: 'user', at: at(one, 'seven') + i * 0.12 });
        return x;
      });
      const tagsLeave = begin(two) + 0.2;
      const tag = (index, text, word, row) => sk.skill(a, { x: xs[index] - 6, y: row ? 296 : 254, text, at: at(one, word), until: tagsLeave });
      tag(2, 'Design', 'design', 0);
      tag(3, 'App screens', 'screens', 1);
      tag(4, 'App screens', 'screens', 0);
      tag(5, 'Server', 'server', 1);
      tag(6, 'Testing', 'testing', 0);
      sticker(a, 'No handoffs', { x: 380, y: 430, at: at(one, 'wall'), until: end(one), variant: 'green', iconName: 'check' });

      // Self-managing: the team answers who, when, and how; then three accountabilities.
      const roles = at(two, 'roles');
      sticker(a, 'Self-managing', { x: 600, y: 34, at: at(two, 'managing'), variant: 'gold', iconName: 'team' });
      [['Who does what?', 'who', 90, 190], ['When?', 'when', 330, 110], ['How?', 'how', 490, 110]].forEach(([text, word, x, w]) => {
        sk.note(a, { x, y: 300, w, text, tone: 'cyan', at: at(two, word), until: roles });
      });
      sticker(a, 'The team decides', { x: 330, y: 392, at: at(two, 'decides'), until: roles, variant: 'green', iconName: 'check' });
      sticker(a, '3 accountabilities', { x: 330, y: 340, at: at(two, 'accountabilities'), variant: 'gold', iconName: 'list' });
      sk.bracket(a, { x: xs[2] - 6, y: 256, w: xs[6] + 128 - xs[2], text: 'Developers', at: at(two, 'developers'), under: true });
      sk.skill(a, { x: xs[0] - 4, y: 266, w: 104, text: 'Product Owner', tone: 'po', at: at(two, 'owner') });
      sk.skill(a, { x: xs[1] - 4, y: 266, w: 104, text: 'Scrum Master', tone: 'sm', at: at(two, 'master') });
      sticker(a, 'No ranks', { x: 300, y: 420, at: at(two, 'ranks'), variant: 'violet', iconName: 'cross' });
      sticker(a, 'No sub-teams', { x: 500, y: 420, at: at(two, 'teams'), variant: 'violet', iconName: 'cross' });

      // Player one: the Developers, and what they own.
      const three = 'team-3';
      const four = 'team-4';
      const b = picture(three, four);
      const select = sk.characterSelect(b, { chosen: 0, at: begin(three) + 0.1, litAt: at(three, 'developers') });
      const own = begin(four) + 0.2;
      [select.title, select.cards[1], select.cards[2]].forEach((node) => fx.fadeOut(node, own));
      [['Designer', 'designer'], ['Tester', 'tester'], ['3 Programmers', 'programmers']].forEach(([text, word], i) => {
        sk.skill(b, { x: 30 + i * 120, y: 498, text, at: at(three, word), until: own });
      });
      sticker(b, 'Not only coders', { x: 660, y: 494, at: at(three, 'code'), until: own, variant: 'gold', iconName: 'team' });

      // The lit card is 314px wide and raised, so the Developers' things start at x 370.
      sk.column(b, { x: 370, y: 40, w: 270, h: 250, title: 'Sprint Backlog', at: at(four, 'plan') - 0.2 });
      TASKS.slice(0, 3).forEach((text, i) => sk.note(b, { x: 385, y: 100 + i * 60, w: 234, text, tone: 'cyan', tilt: 0, at: at(four, 'backlog') + i * 0.15 }));
      sticker(b, 'The plan', { x: 390, y: 304, at: at(four, 'plan'), variant: 'cyan', iconName: 'list' });
      sk.checklist(b, {
        x: 664, y: 40, w: 250, title: 'Definition of Done', at: at(four, 'definition'),
        items: DONE.map((text, i) => ({ text, checkAt: at(four, 'checklist') + i * 0.3 })),
      });
      sticker(b, 'Quality', { x: 680, y: 290, at: at(four, 'quality'), variant: 'green', iconName: 'check' });
      sk.note(b, { x: 676, y: 344, w: 240, text: 'Hold each other accountable', tone: 'green', tilt: 1, at: at(four, 'accountable') });
      sk.loop(b, { x: 500, y: 440, r: 56, labels: ['Inspect', 'Adapt'], at: at(four, 'day'), period: 3 });
      sk.goalFlag(b, { x: 640, y: 428, text: 'Sprint Goal', at: at(four, 'goal') });
      sticker(b, 'Every day', { x: 700, y: 484, at: at(four, 'day'), variant: 'gold', iconName: 'calendar' });
    }

    function productOwner() {
      const one = 'product_owner-1';
      const two = 'product_owner-2';
      const a = picture(one, two);
      heading(a, 'Player two', { y: 24, at: begin(one) + 0.1 });
      sk.roleCard(a, { x: 40, y: 110, role: 1, at: begin(one) + 0.2, litAt: at(one, 'navigator') });
      sticker(a, 'One person', { x: 360, y: 40, at: at(one, 'person'), until: end(one), variant: 'cyan', iconName: 'user' });
      const needsBecomeStories = at(two, 'turn');
      sk.speech(a, { x: 370, y: 150, w: 400, who: 'Student', text: 'Which hall is quiet right now?', at: at(one, 'students'), until: needsBecomeStories });
      sk.speech(a, { x: 440, y: 310, w: 440, who: 'Dining-hall manager', text: 'We can share live swipe counts.', at: at(one, 'staff'), until: needsBecomeStories });

      // Needs become stories, ordered most valuable first, beside the raised card.
      sk.column(a, { x: 370, y: 20, w: 300, h: 336, title: 'Product Backlog', at: at(two, 'stories') - 0.3 });
      const arrived = ['Favorite halls', BACKLOG[0], BACKLOG[2], BACKLOG[1]];
      BACKLOG.slice(0, 4).forEach((text, rank) => {
        const from = arrived.indexOf(text);
        const story = sk.card(a, { x: 385, y: 80 + from * 66, w: 258, text, rank: rank + 1, rankAt: at(two, 'first'), at: at(two, 'stories') + from * 0.15 });
        if (from !== rank) fx.moveTo(story, at(two, 'order'), 0, (rank - from) * 66, 0.7);
      });
      sticker(a, 'Most valuable first', { x: 380, y: 380, at: at(two, 'valuable'), until: at(two, 'acceptance'), variant: 'gold', iconName: 'arrowUp' });
      // Questions answered, and finished work checked against its criteria.
      sk.speech(a, { x: 692, y: 30, w: 220, who: 'Developer', text: 'When is a hall Packed?', at: at(two, 'questions') });
      sk.speech(a, { x: 692, y: 168, w: 220, who: 'Product Owner', text: 'When the line is out the door.', at: at(two, 'questions') + 1.2 });
      sk.checklist(a, {
        x: 370, y: 372, w: 524, title: 'Acceptance criteria', at: at(two, 'acceptance'),
        items: [
          { text: 'Given I open the app', checkAt: at(two, 'decide') },
          { text: 'Then every hall shows Quiet, Busy, or Packed', checkAt: at(two, 'asked') - 0.4 },
        ],
      });
      sticker(a, 'What was asked', { x: 36, y: 480, at: at(two, 'asked'), variant: 'green', iconName: 'check' });

      // Three classic traps, each with its fix.
      const three = 'product_owner-3';
      const b = picture(three);
      heading(b, 'Three classic traps', { y: 8, at: at(three, 'traps') });
      [
        { name: 'Long chains', line: 'Needs pass through many people', word: 'needs', fix: 'Talk with customers directly', fixWord: 'talk' },
        { name: 'A dictated vision', line: 'Managers decide what to build', word: 'managers', fix: 'Give the Product Owner real authority', fixWord: 'give' },
        { name: 'Little domain knowledge', line: 'Unsure about users or technology', word: 'little', fix: 'Someone who knows users and development', fixWord: 'choose' },
      ].forEach((trap, i) => {
        const x = 30 + i * 310;
        sk.listCard(b, { x, y: 64, w: 290, tone: 'trap', iconName: 'warning', title: trap.name, text: trap.line, at: at(three, trap.word) });
        sk.listCard(b, { x, y: 380, w: 290, tone: 'fix', iconName: 'check', title: 'Fix', text: trap.fix, at: at(three, trap.fixWord) });
      });
      // A game of telephone garbles the need on its way.
      sk.queue(b, { x: 54, y: 284, count: 4, gap: 64, at: at(three, 'chain') });
      sk.speech(b, { x: 30, y: 218, w: 120, small: true, text: 'Quiet hall?', at: at(three, 'people') });
      sk.speech(b, { x: 180, y: 218, w: 116, small: true, text: 'Quiz hall?', at: at(three, 'telephone') });
      sk.badge(b, { x: 346, y: 252, role: 'Manager', iconName: 'user', at: at(three, 'managers') + 0.2 });
      sk.note(b, { x: 478, y: 240, w: 136, text: 'Build a leaderboard!', tone: 'pink', tilt: 3, at: at(three, 'dictate') });
      sk.badge(b, { x: 656, y: 252, role: 'Product Owner', iconName: 'globe', variant: 'po', at: at(three, 'little') + 0.2 });
      sk.note(b, { x: 788, y: 240, w: 120, text: "What's a swipe count?", tone: 'cyan', tilt: 3, at: at(three, 'knowledge') });
    }

    function scrumMaster() {
      // Player three: the coach, and the timebox every event keeps.
      const one = 'scrum_master-1';
      const a = picture(one);
      heading(a, 'Player three', { y: 24, at: begin(one) + 0.1 });
      sk.roleCard(a, { x: 40, y: 110, role: 2, at: begin(one) + 0.2, litAt: at(one, 'coach') });
      sticker(a, 'Explains Scrum', { x: 360, y: 30, at: at(one, 'understand'), variant: 'cyan', iconName: 'book' });
      sk.speech(a, { x: 360, y: 84, w: 320, who: 'Scrum Master', text: 'How do you want to split this?', at: at(one, 'coach2') });
      ['Chloe', 'Diego', 'Eli'].forEach((name, i) => sk.badge(a, { x: 420 + i * 150, y: 232, role: name, iconName: 'user', at: at(one, 'managing') + i * 0.12 }));
      sk.listCard(a, {
        x: 360, y: 352, w: 560, title: 'Every event', iconName: 'calendar', at: at(one, 'event'),
        items: [
          { text: 'Effective', at: at(one, 'effective'), iconName: 'check' },
          { text: 'Productive', at: at(one, 'productive'), iconName: 'check' },
          { text: 'Kept within its time limit', at: at(one, 'limit'), iconName: 'timer' },
        ],
      });
      sticker(a, 'Timebox', { x: 740, y: 476, at: at(one, 'timebox'), variant: 'gold', iconName: 'timer', rotate: -6 });

      const id = 'scrum_master-2';
      const b = picture(id);
      sk.card(b, { x: 40, y: 70, w: 340, text: 'Connect live swipe data', tone: 'blocked', at: begin(id) + 0.2 });
      stamp(b, 'Blocked', { x: 110, y: 135, at: at(id, 'impediments'), until: at(id, 'keep'), color: 'red', rotate: -9 });
      sk.note(b, { x: 420, y: 60, w: 250, text: 'Waiting for a data agreement', tone: 'pink', at: at(id, 'agreement') });
      sk.badge(b, { x: 60, y: 330, role: 'Scrum Master', iconName: 'shield', variant: 'sm', at: begin(id) + 0.4 });
      sk.office(b, { x: 720, y: 300, sign: 'Legal office', at: at(id, 'legal') });
      const agreement = sk.doc(b, { x: 200, y: 380, text: 'Data agreement', at: at(id, 'chases') });
      fx.moveTo(agreement, at(id, 'chases') + 0.3, 560, -20, 1.0);
      fx.moveTo(agreement, at(id, 'signature') + 0.2, 0, 0, 0.9);
      stamp(b, 'Signed', { x: 330, y: 330, at: at(id, 'signature') + 1.1, color: 'green', rotate: 6 });
      sticker(b, 'Unblocked', { x: 80, y: 140, at: at(id, 'keep') + 0.2, variant: 'green', iconName: 'check' });

      // Two mix-ups, busted: a Scrum Master serves the team instead of managing it.
      const three = 'scrum_master-3';
      const c = picture(three);
      heading(c, 'Two mix-ups', { at: at(three, 'common') });
      sk.card(c, { x: 40, y: 110, w: 290, text: 'A product manager?', at: at(three, 'product') });
      stamp(c, 'Nope', { x: 340, y: 100, at: at(three, 'deciding'), color: 'red', rotate: -10 });
      sticker(c, "Product Owner's job", { x: 60, y: 196, at: at(three, 'owners'), variant: 'cyan', iconName: 'globe' });
      sk.card(c, { x: 40, y: 290, w: 290, text: 'A project manager or boss?', at: at(three, 'project') });
      stamp(c, 'Nope', { x: 340, y: 280, at: at(three, 'boss'), color: 'red', rotate: 8 });
      ['Chloe', 'Diego', 'Eli'].forEach((name, i) => sk.badge(c, { x: 530 + i * 135, y: 110, role: name, iconName: 'user', at: at(three, 'shields') - 0.6 + i * 0.1 }));
      sk.badge(c, { x: 665, y: 300, role: 'Scrum Master', iconName: 'shield', variant: 'sm', at: at(three, 'shields') - 0.3 });
      sticker(c, 'Shields', { x: 520, y: 432, at: at(three, 'shields'), variant: 'green', iconName: 'shield' });
      sticker(c, 'Supports', { x: 720, y: 432, at: at(three, 'supports'), variant: 'cyan', iconName: 'team' });
      sticker(c, 'No commands', { x: 580, y: 486, at: at(three, 'command'), variant: 'red', iconName: 'cross' });

      // A healthy tension, weighed on a balance until the team levels it.
      const four = 'scrum_master-4';
      const d = picture(four);
      heading(d, 'A healthy tension', { y: 16, at: at(four, 'tension') });
      sk.balance(d, {
        x: 480, y: 140, beam: 580, at: at(four, 'roles'),
        pans: [
          {
            w: 330, title: 'Scrum Master', text: 'Internal quality', iconName: 'shield', at: at(four, 'scrum'),
            items: [
              { text: 'Maintainable code', at: at(four, 'maintainable') },
              { text: "The Developers' needs", at: at(four, 'needs') },
              { text: 'A better process', at: at(four, 'process') },
            ],
          },
          {
            w: 330, title: 'Product Owner', text: 'External quality', iconName: 'globe', at: at(four, 'product'),
            items: [
              { text: 'Features customers want', at: at(four, 'features') },
              { text: 'On schedule', at: at(four, 'schedule') },
            ],
          },
        ],
        tilts: [{ at: at(four, 'maintainable'), angle: -6 }, { at: at(four, 'features'), angle: 6 }, { at: at(four, 'balance'), angle: 0 }],
      });
      sticker(d, 'Great teams balance both', { x: 500, y: 24, at: at(four, 'balance'), variant: 'gold', iconName: 'check' });
    }

    // ----------------------------------------------------------------
    // Artifacts: the board, the Sprint Backlog, the Increment
    // ----------------------------------------------------------------

    function productBacklog() {
      const a = picture('product_backlog-1', 'product_backlog-2');
      const start = begin('product_backlog-1');
      sk.column(a, { x: 30, y: 30, w: 290, h: 490, title: 'Product Backlog', at: start + 0.1 });
      sk.column(a, { x: 335, y: 30, w: 290, h: 490, title: 'Sprint Backlog', at: start + 0.25 });
      sk.column(a, { x: 640, y: 30, w: 290, h: 490, title: 'Increment', at: start + 0.4 });
      // The top story zooms in over the board, so the board's cards step back.
      backlogCards(a, { x: 45, y: 95, from: at('product_backlog-1', 'ordered') }).forEach((card) => fx.fadeOut(card, at('product_backlog-2', 'top') - 0.3));
      const firstEnd = end('product_backlog-1');
      sticker(a, 'Single source of work', { x: 350, y: 120, at: at('product_backlog-1', 'single'), until: firstEnd, variant: 'gold', iconName: 'list' });
      const request = sk.note(a, { x: 670, y: 110, w: 230, text: 'Dean: add a hall leaderboard!', tone: 'pink', at: at('product_backlog-1', 'dean'), until: firstEnd });
      sk.badge(a, { x: 470, y: 330, role: 'Product Owner', iconName: 'globe', variant: 'po', at: at('product_backlog-1', 'dean') + 0.3, until: firstEnd });
      fx.moveTo(request, at('product_backlog-1', 'nicely'), -70, 220, 0.7);
      sticker(a, 'Only through the backlog', { x: 500, y: 470, at: at('product_backlog-1', 'nicely') + 0.6, until: firstEnd, variant: 'cyan', iconName: 'list' });

      us.card(a, {
        x: 160, y: 60, w: 640, size: 'big', title: 'Top story', at: at('product_backlog-2', 'top'),
        role: 'hungry student', want: 'to see how crowded each dining hall is', why: 'I can skip the long lines',
        fill: { role: at('product_backlog-2', 'hungry'), want: at('product_backlog-2', 'see'), why: at('product_backlog-2', 'skip') },
        gwt: ['Given I open the app', 'Then every hall shows Quiet, Busy, or Packed'],
        gwtAt: [at('product_backlog-2', 'owner'), at('product_backlog-2', 'owner') + 0.5],
      });

      // Emergent: refinement splits a fuzzy item and sizes the list, aimed at the Product Goal.
      const three = 'product_backlog-3';
      const b = picture(three);
      const start3 = begin(three);
      sk.column(b, { x: 30, y: 30, w: 330, h: 490, title: 'Product Backlog', at: start3 + 0.1 });
      BACKLOG.slice(0, 3).forEach((text, i) => sk.card(b, { x: 45, y: 95 + i * 74, w: 270, text, rank: i + 1, at: start3 + 0.3 + i * 0.15 }));
      const fuzzy = sk.card(b, { x: 45, y: 317, w: 270, text: 'Make dining better', tone: 'fuzzy', at: start3 + 0.8, until: at(three, 'smaller') });
      fx.bump(fuzzy, at(three, 'splits'));
      sk.card(b, { x: 45, y: 317, w: 270, text: BACKLOG[3], rank: 4, tone: 'new', at: at(three, 'smaller') + 0.1 });
      sk.card(b, { x: 45, y: 391, w: 270, text: 'Hall opening hours', rank: 5, tone: 'new', at: at(three, 'clearer') });
      [5, 3, 8, 2, 3].forEach((size, i) => sk.skill(b, { x: 382, y: 106 + i * 74, text: String(size), at: at(three, 'size') + i * 0.12 }));
      sticker(b, 'Emergent', { x: 460, y: 36, at: at(three, 'emergent'), variant: 'cyan', iconName: 'loop' });
      sk.label(b, { x: 460, y: 94, w: 470, text: 'It keeps changing as the team learns.', at: at(three, 'changing'), muted: true });
      sticker(b, 'Refinement', { x: 460, y: 150, at: at(three, 'refinement'), variant: 'gold', iconName: 'scissors' });
      sticker(b, 'Order and size', { x: 460, y: 206, at: at(three, 'details'), variant: 'violet', iconName: 'sortAsc' });
      sk.banner(b, { x: 460, y: 290, w: 440, title: 'Product Goal', text: 'Every student picks a dining hall in under a minute', at: at(three, 'goal'), typeAt: at(three, 'hoppers') });
      sticker(b, 'Long-term target', { x: 480, y: 420, at: at(three, 'target'), variant: 'pink', iconName: 'pin' });
    }

    function sprintBacklog() {
      // Why, what, and how: the Sprint Backlog's three parts.
      const one = 'sprint_backlog-1';
      const z = picture(one);
      sprintBacklogParts(z, {
        frame: begin(one) + 0.1, why: at(one, 'why'), goal: at(one, 'goal'), what: at(one, 'what'),
        items: at(one, 'chosen'), how: at(one, 'how'), tasks: at(one, 'tasks'),
      });
      sticker(z, "The Developers' plan", { x: 560, y: 12, at: at(one, 'developers'), variant: 'gold', iconName: 'pencil' });

      const a = picture('sprint_backlog-2', 'sprint_backlog-3');
      const two = 'sprint_backlog-2';
      const three = 'sprint_backlog-3';
      sk.banner(a, { x: 40, y: 20, w: 880, title: 'Sprint Goal', text: SPRINT_GOAL, at: begin(two) + 0.1, lockAt: at(three, 'locked') });
      ['To do', 'Doing', 'Done'].forEach((name, i) => sk.column(a, { x: 40 + i * 300, y: 120, w: 280, h: 280, title: name, at: at(two, 'plan') + i * 0.15 }));
      const cards = {};
      const place = (key, text, lane, row) => {
        cards[key] = sk.card(a, { x: 50 + lane * 300, y: 180 + row * 70, w: 260, text, at: at(two, 'plan') + 0.4 + row * 0.15 });
      };
      place('meter', 'Draw the crowd meter', 0, 0);
      place('photos', 'Hall photos', 0, 1);
      place('tests', 'Write meter tests', 0, 2);
      place('counts', 'Read swipe counts', 1, 0);
      place('list', 'Hall list screen', 2, 0);
      fx.moveTo(cards.counts, at(two, 'updated'), 300, 70, 0.6);
      fx.moveTo(cards.meter, at(two, 'updated') + 0.5, 300, 0, 0.6);
      sticker(a, 'Anyone can see where the sprint stands', { x: 120, y: 420, at: at(two, 'glance'), until: end(two), variant: 'cyan', iconName: 'eye' });

      fx.bump(cards.photos, at(three, 'bigger'), 0.3);
      sticker(a, 'Way bigger than expected', { x: 40, y: 420, at: at(three, 'bigger') + 0.2, until: at(three, 'later'), variant: 'pink', iconName: 'warning' });
      sk.badge(a, { x: 800, y: 405, role: 'Product Owner', iconName: 'globe', variant: 'po', at: at(three, 'renegotiate') });
      sk.speech(a, { x: 400, y: 420, w: 360, text: 'Save hall photos for later?', at: at(three, 'renegotiate') + 0.4 });
      tween(cards.photos, [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '-320px 0' }], at(three, 'later'), 0.7, EASE.in);
      sticker(a, 'No side quests', { x: 40, y: 470, at: at(three, 'quests'), variant: 'gold', iconName: 'shield' });
    }

    function increment() {
      const one = 'increment-1';
      const a = picture(one);
      sk.phone(a, { x: 40, y: 40, halls: HALLS, at: begin(one) + 0.1, colorOnly: true });
      sk.goalFlag(a, { x: 760, y: 150, text: 'Product Goal', at: at(one, 'goal') });
      ['Increment 1', 'Increment 2', 'Increment 3'].forEach((text, i) => sk.increment(a, { x: 330 + i * 150, y: 420 - i * 70, text, at: at(one, 'adds') + i * 0.3 }));
      sticker(a, 'Works together', { x: 640, y: 470, at: at(one, 'verified'), variant: 'green', iconName: 'check' });
      sk.halfScreen(a, { x: 340, y: 50, text: 'Half-built', at: at(one, 'mockup') });
      stamp(a, 'Not usable', { x: 300, y: 214, small: true, at: at(one, 'count'), color: 'red', rotate: -10 });

      const two = 'increment-2';
      const b = picture(two);
      sk.checklist(b, {
        x: 40, y: 60, w: 430, title: 'Definition of Done', at: at(two, 'definition'),
        items: [
          { text: DONE[0], checkAt: at(two, 'reviewed') },
          { text: DONE[1], checkAt: at(two, 'pass') },
          { text: DONE[2], checkAt: at(two, 'phone') },
        ],
      });
      sk.column(b, { x: 520, y: 250, w: 400, h: 260, title: 'Increment', at: at(two, 'definition') + 0.3 });
      const story = sk.card(b, { x: 540, y: 90, w: 340, text: BACKLOG[0], at: begin(two) + 0.2 });
      fx.moveTo(story, at(two, 'moment'), 0, 230, 0.6);
      stamp(b, 'Done', { x: 640, y: 120, at: at(two, 'meets'), color: 'green', rotate: -6 });
      // The kit draws confetti behind a picture's content; this burst belongs on top of the column.
      kit.confetti(sk.overlay(b), { x: 720, y: 330, at: at(two, 'born'), count: 60, seed: 7 });

      // Prediction: a story ninety percent done on the sprint's last day. The
      // board asks both questions and answers them only in the next cue.
      const three = 'increment-3';
      const four = 'increment-4';
      const c = picture(three, four);
      const start = begin(three);
      ['Product Backlog', 'Sprint Backlog', 'Increment'].forEach((name, i) => sk.column(c, { x: 30 + i * 305, y: 30, w: 290, h: 490, title: name, at: start + 0.1 + i * 0.15 }));
      ['Hall photos', 'Favorite halls', 'Dark mode'].forEach((text, i) => sk.card(c, { x: 45, y: 95 + i * 66, w: 254, text, rank: i + 1, at: start + 0.4 + i * 0.12 }));
      sk.card(c, { x: 655, y: 95, w: 254, text: BACKLOG[0], at: start + 0.6 });
      sk.skill(c, { x: 790, y: 168, text: 'Done', tone: 'done', at: start + 0.8 });
      const returns = at(four, 'returns');
      sticker(c, 'Last day', { x: 360, y: 474, at: at(three, 'last'), until: returns, variant: 'gold', iconName: 'calendar' });
      const unfinished = sk.card(c, { x: 350, y: 95, w: 254, text: BACKLOG[1], rank: 4, rankAt: at(four, 'again'), at: at(three, 'story') });
      sk.progressBar(c, { x: 352, y: 168, w: 270, value: 0.9, text: '90% finished', at: at(three, 'ninety'), until: returns });
      sticker(c, 'Tests fail', { x: 366, y: 250, at: at(three, 'fail'), until: returns, variant: 'red', iconName: 'cross' });
      sk.slot(c, { x: 655, y: 214, w: 278, h: 70, at: at(three, 'count'), until: at(four, 'count') });
      sk.arrow(c, { from: [606, 150], to: [652, 236], dashed: true, at: at(three, 'count'), until: at(four, 'count') });
      sk.slot(c, { x: 45, y: 300, w: 278, h: 70, at: at(three, 'where'), until: returns + 0.6 });
      sk.arrow(c, { from: [350, 156], to: [300, 296], dashed: true, at: at(three, 'where'), until: returns + 0.6 });
      sticker(c, 'Predict', { x: 690, y: 320, at: at(three, 'prediction'), until: begin(four), variant: 'gold', iconName: 'question' });
      sticker(c, 'Pause and think', { x: 660, y: 380, at: at(three, 'pause'), until: begin(four), variant: 'violet', iconName: 'timer' });

      // Ninety percent done is not done: it goes back to be ordered again.
      stamp(c, 'Not done', { x: 380, y: 112, at: at(four, 'count'), until: returns, color: 'red', rotate: -8, small: true });
      sticker(c, 'Not released', { x: 680, y: 236, at: at(four, 'released'), variant: 'red', iconName: 'cross' });
      fx.moveTo(unfinished, returns, -305, 205, 0.8);
      sticker(c, 'Ordered again', { x: 45, y: 390, at: at(four, 'orders'), variant: 'cyan', iconName: 'sortAsc' });
      // Each artifact's commitment.
      [['Product Goal', 'goal'], ['Sprint Goal', 'goal2'], ['Definition of Done', 'done4']].forEach(([text, word], i) => {
        sk.goalFlag(c, { x: 40 + i * 305, y: 462, text, at: at(four, word) });
      });
    }

    // ----------------------------------------------------------------
    // Events: the sprint calendar, planning, the Daily Scrum, review, retro
    // ----------------------------------------------------------------

    function sprint() {
      const one = 'sprint-1';
      const two = 'sprint-2';
      const a = picture(one, two);
      sk.bracket(a, { x: 40, y: 76, w: 870, text: 'Sprint 1 · two weeks', at: at(one, 'timebox') });
      const days = sk.workdays(a, { x: 40, y: 120, at: begin(one) + 0.2 });
      sticker(a, 'Never more than a month', { x: 530, y: 12, at: at(one, 'month'), until: end(one), variant: 'gold', iconName: 'calendar' });
      sk.bracket(a, { x: 40, y: 350, w: 870, text: 'Sprint 2 starts right away', at: at(one, 'next'), next: true });
      sk.workdays(a, { x: 40, y: 400, at: at(one, 'next') + 0.2, first: 11 });
      sticker(a, 'No gaps', { x: 380, y: 488, at: at(one, 'gaps'), until: end(one), variant: 'cyan', iconName: 'check' });

      sk.flag(a, { x: 36, y: 238, text: 'Sprint Planning', at: at(two, 'planning') });
      days.forEach((x, i) => sk.dot(a, { x: x + 29, y: 206, at: at(two, 'daily') + i * 0.12 }));
      sk.flag(a, { x: 755, y: 238, text: 'Sprint Review', tone: 'review', at: at(two, 'review') });
      sk.flag(a, { x: 690, y: 284, text: 'Sprint Retrospective', tone: 'retro', at: at(two, 'retrospective') });
      sticker(a, 'Protect the Sprint Goal', { x: 300, y: 488, at: at(two, 'endanger'), variant: 'green', iconName: 'shield' });
    }

    function sprintPlanning() {
      const one = 'sprint_planning-1';
      const two = 'sprint_planning-2';
      const a = picture(one, two);
      sk.column(a, { x: 30, y: 30, w: 290, h: 490, title: 'Product Backlog', at: begin(one) + 0.1 });
      sk.column(a, { x: 335, y: 30, w: 290, h: 490, title: 'Sprint Backlog', at: begin(one) + 0.25 });
      const cards = backlogCards(a, { x: 45, y: 95, from: begin(one) + 0.4 });
      sk.badge(a, { x: 760, y: 70, role: 'Product Owner', iconName: 'globe', variant: 'po', at: begin(one) + 0.6 });
      sk.speech(a, { x: 650, y: 230, w: 290, text: 'The crowd meter first!', at: at(one, 'pitches'), until: end(one) });
      sk.banner(a, { x: 345, y: 90, w: 270, title: 'Sprint Goal', text: SPRINT_GOAL, at: at(one, 'writes') - 0.2, typeAt: at(one, 'writes') });

      cards.slice(0, 3).forEach((card, i) => fx.moveTo(card, at(two, 'pull') + i * 0.25, 300, 180, 0.6));
      [['3', -8], ['5', 0], ['8', 8]].forEach(([value, rotate], i) => sk.poker(a, { x: 670 + i * 90, y: 250, value, rotate, at: at(two, 'poker') + i * 0.2 }));
      ['Read swipe counts: 1 day', 'Draw the meter: 1 day', 'Test on a phone: half a day'].forEach((text, i) => {
        sk.note(a, { x: 650, y: 370 + i * 54, w: 268, text, tone: 'cyan', tilt: 0, at: at(two, 'break') + i * 0.25 });
      });
      sticker(a, 'Tasks: a day or less', { x: 560, y: 18, at: at(two, 'less'), variant: 'gold', iconName: 'timer' });

      // The three questions build the Sprint Backlog's three parts.
      const three = 'sprint_planning-3';
      const b = picture(three);
      sprintBacklogParts(b, {
        frame: begin(three) + 0.1, goal: at(three, 'goal'), why: at(three, 'why'), items: at(three, 'selected'),
        what: at(three, 'what'), tasks: at(three, 'tasks'), how: at(three, 'how'),
      });
      sticker(b, 'Built in Sprint Planning', { x: 500, y: 12, at: at(three, 'questions'), variant: 'pink', iconName: 'calendar' });
    }

    function dailyScrum() {
      const one = 'daily_scrum-1';
      const two = 'daily_scrum-2';
      const a = picture(one, two);
      [[90, 330], [240, 250], [424, 220], [608, 250], [758, 330]].forEach(([x, y], i) => {
        sk.badge(a, { x, y, role: 'Developer', iconName: 'pencil', at: begin(one) + 0.2 + i * 0.12 });
      });
      sk.timer(a, { x: 370, y: 390, minutes: 15, at: at(one, 'fifteen'), end: end(two) });
      sticker(a, 'Inspect progress', { x: 40, y: 40, at: at(one, 'inspect'), until: end(one), variant: 'cyan', iconName: 'search' });
      sticker(a, 'Adapt the plan', { x: 700, y: 40, at: at(one, 'adapt'), until: end(one), variant: 'green', iconName: 'loop' });

      sk.speech(a, { x: 20, y: 30, w: 290, who: 'Yesterday', text: 'I drew the meter.', at: at(two, 'yesterday') });
      sk.speech(a, { x: 325, y: 30, w: 290, who: 'Today', text: 'I hook up live data.', at: at(two, 'today') });
      sk.speech(a, { x: 630, y: 30, w: 300, who: 'Blockers', text: 'Still no data agreement.', at: at(two, 'blocking') });
      // The Scrum Master takes the blocker, and the stand-up moves on.
      const blocker = sk.note(a, { x: 600, y: 150, w: 250, text: 'Blocked: no data agreement', tone: 'red', at: at(two, 'blocked') });
      sk.badge(a, { x: 836, y: 190, role: 'Scrum Master', iconName: 'shield', variant: 'sm', at: at(two, 'grabs') });
      fx.moveTo(blocker, at(two, 'grabs') + 0.5, 200, 60, 0.6);
      fx.popOut(blocker, at(two, 'grabs') + 1.2);
      sticker(a, 'Scrum Master has it', { x: 540, y: 150, at: at(two, 'grabs') + 1.3, variant: 'green', iconName: 'shield' });

      // Not a status report: the Developers talk to each other and change today's plan.
      const three = 'daily_scrum-3';
      const b = picture(three);
      sk.badge(b, { x: 50, y: 70, role: 'Manager', iconName: 'user', at: at(three, 'status') - 0.2 });
      sk.doc(b, { x: 196, y: 84, text: 'Status report', at: at(three, 'report') });
      stamp(b, 'Not this', { x: 60, y: 214, at: at(three, 'managers'), color: 'red', rotate: -8 });
      sk.column(b, { x: 40, y: 300, w: 340, h: 220, title: "Today's plan", at: at(three, 'developers') });
      sk.note(b, { x: 55, y: 362, w: 300, text: 'Draw the meter', tone: 'cyan', tilt: 0, at: at(three, 'developers') + 0.3 });
      sk.note(b, { x: 55, y: 432, w: 300, text: 'Pair up: meter and its tests', tone: 'green', tilt: 0, at: at(three, 'change') });
      sk.speech(b, { x: 420, y: 40, w: 290, who: 'Developer', text: 'Can you pair with me on the meter?', at: at(three, 'talking') });
      sk.speech(b, { x: 630, y: 168, w: 270, who: 'Developer', text: "Sure! I'll write its tests.", at: at(three, 'sharing') });
      [420, 545, 670, 795].forEach((x, i) => sk.badge(b, { x, y: 330, role: 'Developer', iconName: 'pencil', at: at(three, 'developers') + i * 0.1 }));
      sticker(b, 'Plan changed', { x: 420, y: 476, at: at(three, 'plan'), variant: 'green', iconName: 'loop' });
    }

    function sprintReview() {
      const one = 'sprint_review-1';
      const two = 'sprint_review-2';
      const a = picture(one, two);
      sk.phone(a, { x: 355, y: 40, halls: HALLS, at: begin(one) + 0.1, colorOnly: true });
      sticker(a, 'Demo time', { x: 40, y: 20, at: at(one, 'demo'), until: end(one), variant: 'gold', iconName: 'phone' });
      [[80, 140, 'Student'], [80, 330, 'Student'], [760, 140, 'Dining manager']].forEach(([x, y, role], i) => {
        sk.badge(a, { x, y, role, iconName: 'user', at: at(one, 'stakeholders') + i * 0.15, until: end(one) });
      });
      sticker(a, 'Live demo', { x: 650, y: 20, at: at(one, 'live'), until: end(one), variant: 'green', iconName: 'video' });
      sk.deck(a, { x: 690, y: 330, at: at(one, 'slideshow') - 0.5, until: end(one) });
      stamp(a, 'Not a slideshow', { x: 655, y: 385, at: at(one, 'slideshow'), until: end(one), color: 'red', rotate: -8, small: true });

      sticker(a, 'They love it', { x: 40, y: 20, at: at(two, 'love'), variant: 'pink', iconName: 'sparkle' });
      sk.speech(a, { x: 30, y: 90, w: 300, who: 'Student', text: 'Can I filter menus by allergens?', at: at(two, 'allergens') });
      sk.speech(a, { x: 640, y: 90, w: 300, who: 'Student', text: "My screen reader can't tell how busy a hall is.", at: at(two, 'screen') });
      sticker(a, 'Color only', { x: 660, y: 300, at: at(two, 'color'), variant: 'red', iconName: 'warning' });
      sk.column(a, { x: 30, y: 270, w: 300, h: 250, title: 'Product Backlog', at: at(two, 'adds') - 0.3 });
      sk.card(a, { x: 45, y: 330, w: 270, text: 'Filter menus by allergens', tone: 'new', at: at(two, 'adds') + 0.2 });
      sk.card(a, { x: 45, y: 400, w: 270, text: 'Crowd level in words too', tone: 'new', at: at(two, 'adds') + 0.5 });

      // The Product Owner judges the value; the output is an updated Product Backlog.
      const three = 'sprint_review-3';
      const b = picture(three);
      sk.phone(b, { x: 30, y: 40, halls: HALLS, at: begin(three) + 0.1, colorOnly: true });
      sk.badge(b, { x: 420, y: 36, role: 'Product Owner', iconName: 'globe', variant: 'po', at: at(three, 'owner') });
      sk.listCard(b, {
        x: 334, y: 186, w: 290, title: 'Value check', text: 'Did the stories deliver?', iconName: 'search', at: at(three, 'judges'),
        items: [
          { text: 'Most students: yes', iconName: 'check', at: at(three, 'value') },
          { text: 'Screen-reader users: not yet', iconName: 'cross', at: at(three, 'promised') },
        ],
      });
      sk.column(b, { x: 640, y: 40, w: 290, h: 330, title: 'Product Backlog', at: at(three, 'output') });
      [['Crowd level in words too', 'new'], ['Filter menus by allergens', 'new'], [BACKLOG[1]], [BACKLOG[2]]].forEach(([text, tone], i) => {
        sk.card(b, { x: 655, y: 100 + i * 66, w: 254, text, tone, rank: i + 1, at: at(three, 'output') + 0.3 + i * 0.12 });
      });
      sticker(b, 'Updated', { x: 660, y: 386, at: at(three, 'updated'), variant: 'green', iconName: 'check' });
      sk.note(b, { x: 650, y: 444, w: 250, text: 'Ready for the next Sprint Planning', tilt: 1, at: at(three, 'ready') });
    }

    function sprintRetrospective() {
      const one = 'sprint_retrospective-1';
      const two = 'sprint_retrospective-2';
      const a = picture(one, two);
      ['Went well', 'Problems', 'Try next'].forEach((name, i) => sk.column(a, { x: 30 + i * 305, y: 30, w: 290, h: 250, title: name, at: begin(one) + 0.1 + i * 0.15 }));
      sk.note(a, { x: 50, y: 100, w: 250, text: 'Crowd meter shipped', tone: 'green', at: at(one, 'well') });
      sk.note(a, { x: 50, y: 180, w: 250, text: 'Great live demo', tone: 'green', tilt: 2, at: at(one, 'well') + 0.3 });
      sk.note(a, { x: 355, y: 100, w: 250, text: 'Bugs found on the last day', tone: 'pink', at: at(one, 'problems') });
      const gap = sk.note(a, { x: 355, y: 190, w: 250, text: 'Nobody checked accessibility', tone: 'pink', tilt: 2, at: at(one, 'problems') + 0.3 });

      fx.bump(gap, at(two, 'nobody'), 0.2);
      sticker(a, 'Stories focus on features', { x: 30, y: 340, at: at(two, 'features'), variant: 'white', iconName: 'list' });
      sticker(a, 'Qualities slip through', { x: 30, y: 400, at: at(two, 'slip'), variant: 'red', iconName: 'warning' });
      sk.note(a, { x: 660, y: 100, w: 250, text: 'Add a screen-reader check', tone: 'cyan', at: at(two, 'change') });
      sk.checklist(a, {
        x: 470, y: 290, w: 460, title: 'Definition of Done', at: at(two, 'change') + 0.3,
        items: [
          ...DONE.map((text) => ({ text, checkAt: at(two, 'change') + 0.3 })),
          { text: 'Checked with a screen reader', type: true, at: at(two, 'definition'), checkAt: at(two, 'definition') + 1.2 },
        ],
      });
      sticker(a, 'Sprint 2', { x: 40, y: 470, at: at(two, 'next'), variant: 'gold', iconName: 'forward' });

      // Product versus process: both feed the next Sprint Planning.
      const three = 'sprint_retrospective-3';
      const b = picture(three);
      sk.listCard(b, { x: 50, y: 60, w: 400, title: 'Sprint Review', text: 'Changes what the team builds next', iconName: 'list', at: at(three, 'review') });
      sk.listCard(b, { x: 510, y: 60, w: 400, title: 'Sprint Retrospective', text: 'Changes how the team works', iconName: 'gear', at: at(three, 'retrospective') });
      sk.arrow(b, { from: [250, 214], to: [420, 368], at: at(three, 'feed') });
      sk.arrow(b, { from: [710, 214], to: [540, 368], at: at(three, 'feed') + 0.15 });
      sk.banner(b, { x: 330, y: 376, w: 270, title: 'Next', text: 'Sprint Planning', at: at(three, 'planning') - 0.3 });
    }

    // ----------------------------------------------------------------
    // Theory again: every event inspects one thing and adapts another
    // ----------------------------------------------------------------

    function inspectAdapt() {
      const [one, two, three, four] = [1, 2, 3, 4].map((n) => `inspect_adapt-${n}`);
      const a = picture(one, four);
      sticker(a, 'Artifacts: transparency', { x: 30, y: 14, at: at(one, 'transparency'), until: begin(two), variant: 'cyan', iconName: 'eye' });
      sticker(a, 'Inspects', { x: 290, y: 66, at: at(one, 'inspect'), variant: 'white', iconName: 'search' });
      sticker(a, 'Adapts', { x: 650, y: 66, at: at(one, 'adapt'), variant: 'white', iconName: 'loop' });
      [
        { name: 'Sprint Planning', named: at(one, 'planning'), inspects: 'The Product Backlog and the Product Goal', seen: at(one, 'inspects'), adapts: 'The plan: a new Sprint Backlog', changed: at(one, 'adapts') },
        { name: 'Daily Scrum', tone: 'daily', named: at(two, 'daily'), inspects: 'Progress toward the Sprint Goal', seen: at(three, 'progress'), adapts: "The day's plan", changed: at(three, 'plan'), predict: true },
        { name: 'Sprint Review', tone: 'review', named: at(two, 'review'), inspects: 'The Increment', seen: at(three, 'increment'), adapts: 'The Product Backlog', changed: at(three, 'backlog'), predict: true },
        { name: 'Sprint Retrospective', tone: 'retro', named: at(three, 'retrospective'), inspects: 'How the team worked', seen: at(three, 'worked'), adapts: 'Its process and the Definition of Done', changed: at(three, 'process') },
      ].forEach((row, i) => {
        const y = 122 + i * 84;
        sk.flag(a, { x: 30, y: y + 16, text: row.name, tone: row.tone, at: row.named });
        if (row.predict) {
          sk.slot(a, { x: 290, y, w: 290, h: 64, at: at(two, 'inspect'), until: row.seen });
          sk.slot(a, { x: 650, y, w: 280, h: 64, at: at(two, 'adapt'), until: row.changed });
        }
        sk.card(a, { x: 290, y, w: 266, text: row.inspects, at: row.seen });
        sk.arrow(a, { from: [592, y + 32], to: [646, y + 32], at: row.changed - 0.3 });
        sk.card(a, { x: 650, y, w: 256, text: row.adapts, at: row.changed });
      });
      sticker(a, 'Your turn', { x: 30, y: 14, at: at(two, 'turn'), until: begin(three), variant: 'gold', iconName: 'question' });
      sticker(a, 'Pause and think', { x: 250, y: 14, at: at(two, 'pause'), until: begin(three), variant: 'violet', iconName: 'timer' });
      // The Sprint holds them all: learning at three speeds.
      sk.bracket(a, { x: 24, y: 452, w: 904, text: 'The Sprint holds them all', at: at(four, 'contains'), under: true });
      sticker(a, 'Every day', { x: 30, y: 14, at: at(four, 'day'), variant: 'cyan', iconName: 'calendar' });
      sticker(a, 'Every sprint', { x: 250, y: 14, at: at(four, 'sprint2'), variant: 'gold', iconName: 'loop' });
      sticker(a, 'Whole product', { x: 500, y: 14, at: at(four, 'product'), variant: 'green', iconName: 'pin' });
      stamp(a, 'Empiricism', { x: 700, y: 474, at: at(four, 'empiricism'), color: 'gold', rotate: -4, small: true });
    }

    // ----------------------------------------------------------------
    // Summary: the four parts, then the summary quiz
    // ----------------------------------------------------------------

    function summary() {
      const [one, two, three] = ['summary-1', 'summary-2', 'summary-3'];
      const a = picture(one, three);
      const quiz = begin(three) + 0.2;
      const tile = (x, y, options) => sk.listCard(a, { x, y, w: 440, h: 246, until: quiz, ...options });
      tile(30, 24, {
        title: 'Theory', text: 'Empiricism', iconName: 'eye', at: at(one, 'empiricism'),
        items: [['Transparency', 'transparency', 'eye'], ['Inspection', 'inspection', 'search'], ['Adaptation', 'adaptation', 'loop']]
          .map(([text, word, iconName]) => ({ text, iconName, at: at(one, word) })),
      });
      tile(490, 24, {
        title: 'Roles', text: 'Three share the work', iconName: 'team', at: at(one, 'roles'),
        items: [['Developers build', 'developers', 'pencil'], ['Product Owner maximizes value', 'owner', 'globe'], ['Scrum Master coaches', 'master', 'shield']]
          .map(([text, word, iconName]) => ({ text, iconName, at: at(one, word) })),
      });
      tile(30, 282, {
        title: 'Artifacts', text: 'Each with a commitment', iconName: 'list', at: at(two, 'artifacts'),
        items: [['Product Backlog: Product Goal', 'backlog'], ['Sprint Backlog: Sprint Goal', 'backlog2'], ['Increment: Definition of Done', 'increment']]
          .map(([text, word]) => ({ text, iconName: 'pin', at: at(two, word) })),
      });
      tile(490, 282, {
        title: 'Events', text: 'Inspect and adapt', iconName: 'calendar', at: at(two, 'events'), columns: 2,
        items: ['Sprint', 'Planning', 'Daily Scrum', 'Review', 'Retrospective']
          .map((text, i) => ({ text, iconName: 'calendar', at: at(two, 'events') + 0.2 + i * 0.2 })),
      });

      kit.kinetic(a, [{ text: 'Level', at: at(three, 'level') }, { text: 'up!', at: at(three, 'up'), color: 'gold' }], { y: 50, size: 84, punch: false });
      kit.confetti(a, { x: 480, y: 140, at: at(three, 'up') + 0.2, count: 40, seed: 11 });
      sk.listCard(a, {
        x: 230, y: 236, w: 500, title: 'Summary quiz', text: 'A brand-new team: a study-room booking app', iconName: 'question', at: at(three, 'quiz'),
        items: [
          { text: 'Seven situations', iconName: 'list', at: at(three, 'situation') },
          { text: 'Which part of Scrum fits?', iconName: 'search', at: at(three, 'decide') },
        ],
      });
    }

    intro();
    theory();
    team();
    productOwner();
    scrumMaster();
    productBacklog();
    sprintBacklog();
    increment();
    sprint();
    sprintPlanning();
    dailyScrum();
    sprintReview();
    sprintRetrospective();
    inspectAdapt();
    summary();
  };
})();
