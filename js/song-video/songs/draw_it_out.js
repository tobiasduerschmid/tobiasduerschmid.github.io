/*
 * Choreography for "Draw It Out", the UML song
 * (storyboard: _data/songs/draw_it_out.yml).
 *
 * Every visual hits a sung word: `mark(lineId, word)` is that word's time in
 * the recording. The teaching rule: show exactly what the line says, one
 * idea per scene. Why we model comes in pictures from the lecture's building
 * metaphors (js/song-video/sketch-kit.js): a load-bearing wall, teammates
 * picturing four different buildings until one clear drawing aligns them,
 * a floor plan that keeps only what a question needs, a flaw that costs an
 * eraser on paper and the whole team in shipped code. Each diagram then
 * appears as real ArchUML notation on paper (js/song-video/model-kit.js),
 * with a picture beside it for what its parts are for. The chorus asks four
 * questions and answers each with the diagram's own sheet. The pop quiz
 * asks seven conceptual questions about one new system, a pizza app; each
 * answer the crowd sings appears as it is sung, after the quiz pause. Each
 * line's `visual` text in the storyboard describes this file.
 *
 * Layout: 960×540 stage; the section badge sits top-left, and nothing
 * essential goes below y = 460, where the player draws captions.
 */
(function () {
  'use strict';

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.draw_it_out = function choreograph({ song, kit, layers, student }) {
    const { fx, tween } = window.Timeline;
    const M = window.ModelKit;
    const S = window.SketchKit;
    // The architect (architect.js) wears the viewer's saved human or Prof
    // SE Gym face (student-avatar.js); without one, or for a Bruin, the
    // Gym's default human face. It steps into scenes where there is room
    // beside the content and works with what is on screen: points, taps,
    // ticks off, circles, traces, leans in, and thinks.
    const A = window.ArchitectKit;
    const ARCHITECT = { hero: student?.heroHead() };
    const { content, hud } = layers;
    const line = (id) => song.line(id);
    const mark = (id, word) => song.mark(id, word);
    const start = (id) => song.sectionStart(id);
    const end = (id) => song.sectionEnd(id);
    /** The scene boundary just before line `id` starts. */
    const before = (id) => line(id).start - 0.1;
    /**
     * A strip behind visibility signs (from the `first` sign's box down to the
     * `last`): a sign touches the name after it, so a ring would cover the
     * name's first letter.
     */
    const signStrip = (first, last = first) => ({ x: first.x - 3, y: first.y - 2, w: first.w + 5, h: last.y + last.h - first.y + 4 });

    function badge(text, sectionId) {
      kit.badge(hud, text, start(sectionId), end(sectionId));
    }

    // ----------------------------------------------------------------
    // Intro: "fix it later" turns an early choice into a load-bearing wall
    // ----------------------------------------------------------------

    function intro() {
      badge('Intro · Why draw first?', 'intro');

      // "Your colleague says: just keep coding, we'll fix it later!" You
      // code at the laptop while a colleague beside you gives the advice,
      // in a bubble from "says", held into the next line's "In" so it can
      // be read.
      const calendarAt = mark('intro-2', 'week') - 0.25;
      const a = kit.scene(content, 0.2, calendarAt, { exit: 'fade' });
      student?.appear({ from: 0.3, to: calendarAt, x: 60, y: 150, scale: 0.92 });
      S.teammate(a, {
        look: 'beard', x: 318, y: 250, size: 118, flip: true, seed: 3, at: mark('intro-1', 'colleague') - 0.1,
        moods: [[mark('intro-1', 'just'), 'happy']],
      });
      S.speech(a, 'Just keep coding, we’ll fix it later!', { x: 340, y: 156, w: 230, at: mark('intro-1', 'says'), tail: 'left' });
      // Through the opening bars a wall goes up in a hurry: one brick goes
      // down crooked, every course above leans on it, and the notes that
      // promise a fix get slapped onto the wall.
      S.brickWall(a, { x: 590, y: 190, w: 320, courses: 6, at: 0.6, every: 0.07, crooked: 1, flagAt: mark('intro-1', 'fix') });
      // The notes pile up in a quick stagger, so each stays up long enough to read.
      [
        ['TODO: fix later', 604, 168, -6, 'yellow'],
        ['hack, sorry', 760, 180, 5, 'pink'],
        ['FIXME', 640, 250, 3, 'yellow'],
        ['refactor later?', 786, 262, -4, 'green'],
      ].forEach(([text, x, y, rotate, tone], i) => S.sticky(a, text, { x, y, at: mark('intro-1', 'just') + i * 0.25, rotate, tone }));

      // "In week one, we implement peer-to-peer. In week nine, we need a
      // server." The rewired network holds through "That first choice", the
      // peer-to-peer design, so the server and its new links can be taken in.
      const wallAt = mark('intro-3', 'is');
      const b = kit.scene(content, calendarAt, wallAt + 0.1, { exit: 'fade' });
      S.calendar(b, {
        x: 70, y: 90, at: calendarAt,
        pages: [
          { at: 0, top: 'Week', big: '1' },
          { at: mark('intro-2', 'week_2'), top: 'Week', big: '9', tone: 'late' },
        ],
      });
      S.network(b, { x: 580, y: 250, r: 165, at: mark('intro-2', 'one'), linkAt: mark('intro-2', 'peer'), serverAt: mark('intro-2', 'server') });
      kit.sticker(b, 'Peer-to-peer', { x: 70, y: 260, at: mark('intro-2', 'peer_2'), variant: 'white', iconName: 'link', rotate: -3 });

      // "...is a load-bearing wall now." The wall holds the screen until
      // "we", so its labels can be read.
      const draft = mark('intro-4', 'we') + 0.05;
      // The building comes in once the network has faded, never over it.
      const c = kit.scene(content, wallAt + 0.1, draft - 0.15, { exit: 'fade' });
      S.section(c, {
        x: 330, y: 92, at: wallAt + 0.1, label: 'peer-to-peer', labelAt: wallAt + 0.25,
        weightAt: mark('intro-3', 'load'), crackAt: mark('intro-3', 'now'),
      });
      kit.sticker(c, 'Every floor rests on it', { x: 52, y: 160, at: wallAt + 0.1, variant: 'gold', iconName: 'stack', rotate: -3 });
      kit.stamp(c, 'Load-bearing', { x: 60, y: 236, at: mark('intro-3', 'load'), rotate: -8, shake: false, from: 1.6 });

      // "This time, we draw it out first."
      const d = kit.scene(content, draft - 0.15, start('verse-1') + 0.6, { exit: 'fade' });
      S.section(d, { x: 330, y: 110, at: draft - 0.15, blueprint: true });
      S.pencil(d, {
        route: [[350, 156], [480, 106], [610, 156], [610, 376], [350, 376], [468, 300], [492, 368]],
        at: draft, duration: 1, until: mark('intro-4', 'first'),
      });
      kit.kinetic(d, [
        { text: 'Draw', at: mark('intro-4', 'draw'), color: 'gold', iconName: 'pencil' },
        { text: 'it out', at: mark('intro-4', 'out') },
        { text: 'first', at: mark('intro-4', 'first'), color: 'gold' },
      ], { y: 30, size: 54 });
      // The architect glides in beside the plan, sketches along with the
      // drafting pencil, and ticks the finished plan off after "first".
      A.architect(d, {
        ...ARCHITECT, x: 664, y: 112, scale: 1, flip: true, entrance: 'right', at: draft - 0.15,
        moves: [[draft, 'sketch', { to: [610, 250], duration: 0.6 }], [mark('intro-4', 'first') + 0.25, 'check', { to: [560, 230] }]],
      });
    }

    // ----------------------------------------------------------------
    // Verse 1: a shared picture, a model, a cheap fix, a shared plan
    // ----------------------------------------------------------------

    function verse1() {
      badge('Verse 1 · Why we model', 'verse-1');
      const v = (n) => `verse-1-${n}`;

      // "Ask for a building" … "they're lost again": four teammates picture
      // four buildings, one house from a clear drawing, then four guesses
      // from a vague one.
      const team = kit.scene(content, start('verse-1'), before(v(3)), { exit: 'fade' });
      S.speech(team, 'Build us a building!', { x: 352, y: 34, at: mark(v(1), 'ask'), until: before(v(2)), tone: 'gold', tail: 'left' });
      // Each teammate's own building, the guess the vague sketch prompts, and
      // the words on which their bubble shows the house and the guess.
      const people = [
        { look: 'hoodie', x: 26, flip: false, own: 'tower', guess: 'shed', houseAt: 'all', guessAt: 'theyre' },
        { look: 'curls', x: 176, flip: false, own: 'mall', guess: 'garage', houseAt: 'four', guessAt: 'theyre' },
        { look: 'beard', x: 654, flip: true, own: 'factory', guess: 'doghouse', houseAt: 'see', guessAt: 'lost' },
        { look: 'hijab', x: 804, flip: true, own: 'museum', guess: 'warehouse', houseAt: 'one', guessAt: 'again' },
      ];
      people.forEach((person, i) => {
        const ownAt = mark(v(1), person.own);
        const guessAt = mark(v(2), person.guessAt);
        S.teammate(team, {
          look: person.look, x: person.x, y: 300, size: 130, flip: person.flip, seed: i + 1,
          at: mark(v(1), 'four') + i * 0.1,
          moods: [[ownAt, 'think'], [mark(v(2), 'house'), 'happy'], [guessAt, 'puzzled']],
        });
        S.thought(team, {
          x: person.x - 8, y: 138, w: 146, h: 108, tail: person.flip ? 'right' : 'left', at: ownAt - 0.15,
          pictures: [
            { at: ownAt, kind: person.own },
            { at: mark(v(2), person.houseAt), kind: 'house' },
            { at: guessAt, kind: person.guess },
          ],
          badges: [
            { at: mark(v(2), 'house'), until: mark(v(2), 'draw_2'), kind: 'check' },
            { at: guessAt, kind: 'question' },
          ],
        });
      });
      S.whiteboard(team, {
        x: 330, y: 132, w: 300, at: mark(v(2), 'draw') - 0.3,
        drawings: [
          { kind: 'house', at: mark(v(2), 'draw'), until: mark(v(2), 'draw_2') },
          { kind: 'vague', at: mark(v(2), 'vague') - 0.1, duration: 0.5 },
        ],
      });

      // "A model leaves some details out on purpose: it shows the part your
      // question is about." The floor plan drops furniture, wiring, sizes,
      // and labels; the pipes stay and glow for the plumber's question.
      const plan = kit.scene(content, before(v(3)), before(v(5)), { exit: 'fade' });
      S.floorPlan(plan, {
        x: 260, y: 104, w: 440, at: line(v(3)).start - 0.1,
        hide: {
          furniture: mark(v(3), 'leaves'), wiring: mark(v(3), 'some'),
          sizes: mark(v(3), 'details'), labels: mark(v(3), 'out'),
        },
        focus: { layer: 'pipes', at: mark(v(4), 'part') },
      });
      // The plumber's question comes first: it decides what the plan keeps.
      S.speech(plan, 'Where do the pipes run?', { x: 676, y: 70, w: 210, at: mark(v(3), 'leaves'), tail: 'left', tone: 'gold' });
      kit.sticker(plan, 'Left out on purpose', { x: 24, y: 150, at: mark(v(3), 'out'), variant: 'white', iconName: 'eye', rotate: -3 });
      // Under the sticker, the architect leans in as the details drop and
      // rings the pipes when the question picks them out.
      A.architect(plan, {
        ...ARCHITECT, x: 46, y: 190, scale: 0.84, tag: '', at: line(v(3)).start + 0.1,
        moves: [[mark(v(3), 'leaves'), 'inspect', { to: [480, 260], hold: 1.8 }], [mark(v(4), 'part'), 'circle', { to: [560, 300], rx: 14, ry: 10 }]],
      });

      // "Is there a flaw on paper? Rub it out, and you're already done."
      // versus "Is there a flaw in shipped code? To change the code, you
      // need everyone."
      const umlAt = before(v(7));
      const flaw = kit.scene(content, before(v(5)), umlAt, { exit: 'fade' });
      kit.sticker(flaw, 'On paper', { x: 60, y: 70, at: mark(v(5), 'paper'), variant: 'white', iconName: 'pencil', rotate: -3 });
      S.paperFlaw(flaw, {
        x: 60, y: 120, at: line(v(5)).start, flawAt: mark(v(5), 'flaw'),
        eraseAt: mark(v(5), 'rub'), fixAt: mark(v(5), 'done'),
      });
      kit.sticker(flaw, 'One eraser: done', { x: 90, y: 360, at: mark(v(5), 'done') + 0.2, variant: 'green', iconName: 'check', rotate: 2 });
      // The architect taps the pencil at the flaw and nods once it is fixed,
      // gone before the shipped app needs the middle of the stage.
      A.architect(flaw, {
        ...ARCHITECT, x: 392, y: 118, scale: 0.92, flip: true, at: line(v(5)).start, until: line(v(6)).start + 0.05,
        moves: [[mark(v(5), 'flaw'), 'tap', { to: [205, 250] }], [mark(v(5), 'done'), 'nod']],
      });
      kit.sticker(flaw, 'In shipped code', { x: 560, y: 70, at: mark(v(6), 'shipped'), variant: 'white', iconName: 'box', rotate: 3 });
      S.device(flaw, 'phone', { x: 640, y: 96, size: 180, at: mark(v(6), 'flaw') });
      const app = kit.place(kit.el('div', 'sk-app-label is-staged', flaw, 'Library app v1.0'), 730, 278);
      fx.fadeIn(app, mark(v(6), 'flaw') + 0.15, 0.2);
      kit.stamp(flaw, 'Shipped', { x: 446, y: 184, at: mark(v(6), 'shipped'), rotate: -10, shake: false, from: 1.5, small: true });
      S.bug(flaw, { route: [[708, 170], [770, 196], [716, 232], [784, 250]], at: mark(v(6), 'code'), duration: 2.2, size: 30 });
      people.forEach((person, i) => {
        S.teammate(flaw, {
          look: person.look, x: 548 + i * 84, y: 300, size: 78, flip: i > 1, seed: i + 5,
          at: mark(v(6), 'code') + i * 0.06, moods: [[mark(v(6), 'change'), 'worried']],
        });
      });
      kit.stamp(flaw, 'Rework for everyone', { x: 500, y: 404, at: mark(v(6), 'code'), rotate: -3, shake: false, from: 1.4, small: true });

      // "Use UML, the Unified Modeling Language." The four teammates come
      // back, and this time the whiteboard holds a UML class box that every
      // bubble shows the same way.
      const handAt = line(v(8)).start + 0.3;
      const notation = kit.scene(content, umlAt, handAt, { exit: 'fade' });
      const umlSaid = mark(v(7), 'uml');
      people.forEach((person, i) => {
        const sharedAt = umlSaid + 0.2 + i * 0.15;
        S.teammate(notation, {
          look: person.look, x: person.x, y: 300, size: 130, flip: person.flip, seed: i + 1,
          at: umlAt + i * 0.05, moods: [[sharedAt, 'happy']],
        });
        S.thought(notation, {
          x: person.x - 8, y: 138, w: 146, h: 108, tail: person.flip ? 'right' : 'left', at: umlSaid,
          pictures: [{ at: sharedAt, kind: 'umlClass' }],
          badges: [{ at: mark(v(7), 'language'), kind: 'check' }],
        });
      });
      S.whiteboard(notation, { x: 330, y: 132, w: 300, at: umlAt + 0.1, drawings: [] });
      M.diagram(notation, {
        kind: 'class', x: 346, y: 146, w: 268, fit: { w: 240, h: 160 }, scale: 1.2, tone: 'whiteboard', at: umlSaid,
        spec: `@startuml
class House {
  - floors: int
  - rooms: int
  + build()
}
@enduml`,
      });
      kit.kinetic(notation, [
        { text: 'U', at: umlSaid, color: 'gold' },
        { text: 'M', at: umlSaid + 0.12, color: 'gold' },
        { text: 'L', at: umlSaid + 0.24, color: 'gold' },
      ], { y: 26, size: 58, until: handAt - 0.3 });
      const expansion = kit.el('div', 'subtitle is-staged', notation, 'Unified Modeling Language');
      expansion.style.top = '96px';
      fx.rise(expansion, mark(v(7), 'unified'));

      // "Hand the model to your team and your coding agent too, then test
      // what comes back against the plan you drew."
      const hand = kit.scene(content, handAt, end('verse-1'), { exit: 'fade' });
      M.diagram(hand, {
        kind: 'class', x: 56, y: 140, w: 230, fit: { w: 202, h: 150 }, scale: 1.25, title: 'The plan', at: handAt,
        spec: `@startuml
class House {
  - floors: int
  - rooms: int
  + build()
}
@enduml`,
      });
      people.forEach((person, i) => {
        S.teammate(hand, {
          look: person.look, x: 560 + i * 92, y: 70, size: 84, flip: i > 1, seed: i + 9,
          at: mark(v(8), 'team') + i * 0.06, moods: [[mark(v(8), 'team'), 'happy']],
        });
      });
      kit.flow(hand, { from: [290, 200], to: [600, 120], bend: -40, color: 'gold', at: mark(v(8), 'team') });
      S.robot(hand, { x: 746, y: 268, size: 132, at: mark(v(8), 'agent'), typeAt: mark(v(8), 'agent') + 0.3, typeUntil: mark(v(9), 'back') });
      kit.flow(hand, { from: [292, 236], to: [742, 300], bend: -50, color: 'gold', at: mark(v(8), 'agent') });
      // Short rows, in right after the work comes back, so the card can be read before the chorus.
      S.checklist(hand, {
        x: 360, y: 286, w: 250, title: 'Tested against the plan', at: mark(v(8), 'too'),
        rows: ['floors', 'rooms', 'build()'].map((text, i) => ({ text, at: mark(v(9), 'then') + 0.2 + i * 0.12, ok: true })),
      });
      // The robot's work comes back first, then each row checks it.
      kit.flow(hand, { from: [744, 360], to: [646, 360], bend: 0, color: 'cyan', at: mark(v(9), 'then') });
    }

    // ----------------------------------------------------------------
    // Verse 2: when to draw a Class Diagram, and what each part is for
    // ----------------------------------------------------------------

    function verse2() {
      badge('Verse 2 · Class Diagram', 'verse-2');
      const v = (n) => `verse-2-${n}`;

      // "Class Diagram: the code view, to plan and discuss it with your team,
      // then document where the pieces go." The box appears as it is named
      // and the code it describes beside it; two teammates picture the same
      // box; then each compartment is named where it sits. "Will it change?
      // Make it private, hide it with a minus; plus is just for what the
      // others need from us." The signs light up with what they are for.
      // Holds until "Rectangle" is sung, so the "+ public" label can be read.
      const shapesAt = mark(v(5), 'rectangle') + 0.05;
      const a = kit.scene(content, start('verse-2'), shapesAt, { exit: 'fade' });
      const source = M.code(a, {
        x: 30, y: 112, w: 360, title: 'book.py', at: mark(v(1), 'code'),
        lines: [
          'class Book:',
          '    def __init__(self, title):',
          '        self.__title = title',
          '        self.__copies = 1',
          '    def borrow(self, member): …',
          '    def get_title(self): …',
        ],
      });
      // Far enough left that the labels beside its compartments stay clear of the stage's edge.
      const book = M.diagram(a, {
        kind: 'class', x: 416, y: 112, w: 280, fit: { w: 252, h: 190 }, scale: 1.3, at: line(v(1)).start - 0.1,
        spec: `@startuml
class Book {
  - title: String
  - copies: Integer
  + borrow(m: Member)
  + getTitle(): String
}
@enduml`,
      });
      kit.flow(a, { from: [392, 190], to: [414, 190], bend: 0, color: 'gold', at: mark(v(1), 'view') });
      // "to plan and discuss it with your team": two teammates beside the
      // sheet picture the same class box, gone before its labels need the room.
      const piecesAt = mark(v(2), 'where');
      [['hoodie', 724, false], ['hijab', 834, true]].forEach(([look, x, flip], i) => {
        S.teammate(a, {
          look, x, y: 262, size: 100, flip, seed: i + 13, at: mark(v(1), 'discuss') + i * 0.1, until: piecesAt - 0.15,
          moods: [[mark(v(1), 'discuss'), 'think'], [mark(v(2), 'team'), 'happy']],
        });
        S.thought(a, {
          x: x - 4, y: 140, w: 108, h: 82, tail: flip ? 'right' : 'left', at: mark(v(1), 'discuss') + 0.2 + i * 0.1, until: piecesAt - 0.15,
          pictures: [{ at: mark(v(2), 'team'), kind: 'umlClass' }],
          badges: [{ at: mark(v(2), 'team') + 0.2, kind: 'check' }],
        });
      });
      kit.sticker(a, 'Into the design doc', { x: 430, y: 340, at: mark(v(2), 'document'), until: mark(v(3), 'change'), variant: 'white', iconName: 'file', rotate: -2 });

      // "where the pieces go": the name, the attributes, and the operations,
      // each named in its own compartment until the signs take over.
      const rows = (d, labels) => d.union(labels.map((label) => d.textBox(label)));
      const attributes = rows(book, ['title: String', 'copies: Integer']);
      const operations = rows(book, ['borrow(m: Member)', 'getTitle(): String']);
      const signsAt = mark(v(3), 'change');
      book.ring(book.textBox('Book'), { at: piecesAt, until: signsAt, pad: 6 });
      book.callout(book.textBox('Book'), 'name', { side: 'right', at: piecesAt, until: signsAt, gap: 74 });
      book.ring(attributes, { at: mark(v(2), 'the'), until: signsAt, pad: 4 });
      book.callout(attributes, 'attributes: what it stores', { side: 'right', at: mark(v(2), 'the'), until: signsAt, gap: 14 });
      book.ring(operations, { at: mark(v(2), 'pieces'), until: mark(v(3), 'private'), pad: 4 });
      book.callout(operations, 'operations: what you can ask', { side: 'right', at: mark(v(2), 'pieces'), until: mark(v(3), 'private'), gap: 14 });
      source.mark(0, piecesAt, signsAt);
      source.mark(2, mark(v(2), 'the'), signsAt);
      source.mark(3, mark(v(2), 'the'), signsAt);
      source.mark(4, mark(v(2), 'pieces'), signsAt);
      source.mark(5, mark(v(2), 'pieces'), signsAt);

      // "Will it change? Make it private, hide it with a minus;"
      source.mark(3, signsAt, undefined, 'red');
      book.ring(book.textBox('copies: Integer'), { at: signsAt, until: mark(v(3), 'private'), pad: 3, tone: 'red' });
      book.band(signStrip(book.textBox('title: String', '-'), book.textBox('copies: Integer', '-')), { at: mark(v(3), 'private'), tone: 'red' });
      book.callout(attributes, '− private: free to change', { side: 'right', at: mark(v(3), 'private'), tone: 'red', gap: 14 });
      const [lockX, lockY] = book.stagePoint(attributes, 'left');
      S.padlock(a, { x: lockX - 48, y: lockY - 22, size: 44, at: mark(v(3), 'hide'), lockAt: mark(v(3), 'minus') });

      // "plus is just for what the others need from us."
      book.band(signStrip(book.textBox('borrow(m: Member)', '+'), book.textBox('getTitle(): String', '+')), { at: mark(v(4), 'plus'), tone: 'green' });
      book.callout(operations, '+ public: what others need', { side: 'right', at: mark(v(4), 'plus'), tone: 'green', gap: 14 });
      const [opsX, opsY] = book.stagePoint(operations, 'bottom');
      [['Catalog', 446], ['Checkout', 596]].forEach(([name, x], i) => {
        kit.sticker(a, name, { x, y: 396, at: mark(v(4), 'plus') + i * 0.1, variant: 'cyan', iconName: 'user', rotate: i ? 3 : -3 });
        kit.flow(a, { from: [x + 50, 392], to: [opsX - 30 + i * 60, opsY + 6], bend: 0, color: 'cyan', at: mark(v(4), 'plus') + 0.3 + i * 0.08 });
      });

      // "Is a Rectangle a Shape? Then inherit: is-a. An italic name:
      // abstract, not built, just built upon." Holds through "Want to swap
      // what's underneath?", until the interface is written.
      const storesAt = mark(v(7), 'write') - 0.1;
      const b = kit.scene(content, shapesAt, storesAt, { exit: 'fade' });
      const shapes = M.diagram(b, {
        kind: 'class', x: 330, y: 92, w: 300, fit: { w: 272, h: 330 }, scale: 1.2, at: shapesAt,
        spec: `@startuml
abstract class Shape {
  - color: Integer
  + area(): Real
}
class Rectangle {
  - width: Integer
  - height: Integer
  + area(): Real
}
Rectangle --|> Shape
@enduml`,
      });
      const inheritAt = mark(v(5), 'inherit');
      shapes.ring('Rectangle', { at: shapesAt + 0.2, until: inheritAt, tone: 'teal' });
      shapes.ring('Shape', { at: mark(v(5), 'shape'), until: inheritAt, tone: 'teal' });
      const triangle = shapes.union(shapes.boxes((box, item) => item.tag === 'polygon'));
      shapes.ring(triangle, { at: inheritAt, pad: 6, tone: 'violet' });
      shapes.callout(triangle, 'inherit: is-a', { side: 'right', at: inheritAt, tone: 'violet', gap: 30 });
      // Beside the Rectangle it describes.
      kit.sticker(b, 'A Rectangle is a Shape', { x: 650, y: 318, at: mark(v(5), 'is_2'), variant: 'violet', iconName: 'merge', rotate: 2 });
      shapes.ring(shapes.textBox('Shape'), { at: mark(v(6), 'italic'), until: mark(v(6), 'built'), pad: 3 });
      shapes.callout(shapes.textBox('Shape'), 'italic: abstract', { side: 'right', at: mark(v(6), 'abstract'), gap: 70 });
      const main = M.code(b, { x: 40, y: 150, w: 250, title: 'main.py', at: mark(v(6), 'not'), lines: ['s = Shape()', 'r = Rectangle()'] });
      main.mark(0, mark(v(6), 'built'), undefined, 'red');
      kit.stamp(b, 'No plain Shape', { x: 44, y: 262, at: mark(v(6), 'built'), rotate: -6, shake: false, from: 1.5, small: true });
      main.mark(1, mark(v(6), 'built_2'), undefined, 'green');
      shapes.callout('Rectangle', 'built upon Shape', { side: 'left', at: mark(v(6), 'upon'), tone: 'green', gap: 14 });

      // "Write an interface: it says what, but never how, so swap the class
      // right now." The app's code knows only the interface. The interface
      // lists what, the classes below it hold the how, and the app swaps
      // one store for the other without changing its call.
      const c = kit.scene(content, storesAt, end('verse-2') + 0.45, { exit: 'fade' });
      const stores = M.diagram(c, {
        kind: 'class', x: 30, y: 96, w: 500, fit: { w: 472, h: 300 }, scale: 1.25, at: storesAt,
        spec: `@startuml
interface BookStore {
  + getBook(id: Integer): Book
  + addBook(b: Book)
}
class SqlStore
class MemoryStore
SqlStore ..|> BookStore
MemoryStore ..|> BookStore
@enduml`,
      });
      stores.ring(stores.textBox('«interface»'), { at: mark(v(7), 'interface'), until: mark(v(8), 'what'), pad: 4 });
      const app = M.code(c, {
        x: 630, y: 130, w: 300, title: 'app.py', at: mark(v(7), 'interface') + 0.3,
        lines: ['def app(store: BookStore):', '    store.get_book(42)', 'app(SqlStore())'],
      });
      const promised = rows(stores, ['getBook(id: Integer): Book', 'addBook(b: Book)']);
      stores.ring(promised, { at: mark(v(8), 'what'), pad: 4 });
      stores.callout(promised, 'what: operations only', { side: 'right', at: mark(v(8), 'what'), gap: 14 });
      // The app calls only what the interface promises.
      app.mark(1, mark(v(8), 'what'));
      // ArchUML joins both realizations into one dashed trunk under one hollow triangle.
      const realization = stores.union(stores.boxes((box, item) => item.tag === 'polygon' || item.node.hasAttribute('stroke-dasharray')));
      stores.ring(realization, { at: mark(v(8), 'how'), until: mark(v(8), 'swap'), pad: 6, tone: 'violet' });
      stores.callout(realization, 'implements: the how', { side: 'right', at: mark(v(8), 'how'), tone: 'violet', gap: 14 });
      stores.ring('SqlStore', { at: mark(v(8), 'swap'), until: mark(v(8), 'class'), tone: 'red' });
      app.mark(2, mark(v(8), 'swap'), undefined, 'red');
      app.rewrite(2, 'app(MemoryStore())', mark(v(8), 'the'));
      stores.ring('MemoryStore', { at: mark(v(8), 'class'), tone: 'green' });
    }

    // ----------------------------------------------------------------
    // Verse 3: which line to draw between classes, and when
    // ----------------------------------------------------------------

    function verse3() {
      badge('Verse 3 · Class Diagram relationships', 'verse-3');
      const v = (n) => `verse-3-${n}`;
      const pair = (spec) => `@startuml\nlayout horizontal\n${spec}\n@enduml`;
      const diamond = (d) => d.union(d.boxes((box, item) => item.tag === 'polygon'));
      const sheet = { kind: 'class', x: 452, y: 92, w: 480, fit: { w: 452, h: 110 }, scale: 1.3 };

      // "Lines between the classes? Ask three questions, in order." Each
      // question lights up when it is sung and takes its answer when the
      // answer is sung; the diagram, a code card, and a picture beside it
      // show each answer.
      const verse3At = end('verse-2') + 0.45;
      // A beat into "Not sure", so "Rooms go too" can be read.
      const unsureAt = line(v(7)).start + 0.25;
      const a = kit.scene(content, verse3At, unsureAt, { exit: 'fade' });
      S.questions(a, {
        x: 26, y: 92, w: 400, title: 'Lines between the classes?', titleAt: verse3At,
        items: [
          { text: 'Does A reference B?', at: mark(v(2), 'does'), answer: 'association', answerAt: mark(v(2), 'association') },
          { text: 'Does A own B as a part?', at: mark(v(3), 'does'), answer: 'aggregation', answerAt: mark(v(3), 'aggregation') },
          { text: 'What if B cannot exist without A?', at: mark(v(5), 'what'), answer: 'composition', answerAt: mark(v(5), 'composition') },
        ],
      });
      kit.sticker(a, 'Three questions, in order', { x: 40, y: 380, at: mark(v(1), 'three'), variant: 'gold', iconName: 'list', rotate: -2 });

      // "Does A reference B? Then use association."
      const carAt = mark(v(3), 'own');
      const q1 = M.diagram(a, { ...sheet, at: mark(v(2), 'reference'), until: carAt - 0.1, spec: pair('class A\nclass B\nA --> B') });
      const bBox = q1.box('B');
      const head = { x: bBox.x - 18, y: bBox.y + bBox.h / 2 - 11, w: 18, h: 22 };
      q1.ring(head, { at: mark(v(2), 'b'), pad: 4, tone: 'teal' });
      q1.callout(head, 'A holds a reference to B', { side: 'below', at: mark(v(2), 'b') + 0.2, tone: 'teal', gap: 16 });
      // Below the diagram, clear of the car diagram that takes its place.
      M.code(a, { x: 520, y: 290, w: 340, title: 'a.py', at: mark(v(2), 'reference') + 0.15, until: carAt + 0.2, lines: ['class A:', '    b: B    # a field: the arrow'] });

      // "Does A own B as a part? Then use aggregation, a car owns wheels, a
      // library owns books." The parts outlive the whole: the wheels roll on,
      // and the books stay on the shelf.
      const libraryAt = mark(v(4), 'library');
      const houseAt = mark(v(5), 'exist');
      const q2 = M.diagram(a, { ...sheet, at: carAt, until: libraryAt - 0.1, spec: pair('class Car\nclass Wheel\nCar o-- "4" Wheel') });
      q2.ring(diamond(q2), { at: mark(v(3), 'part'), pad: 5 });
      q2.callout(diamond(q2), 'hollow diamond: aggregation', { side: 'below', at: mark(v(3), 'aggregation'), gap: 14 });
      const q2b = M.diagram(a, { ...sheet, spec: pair('class Library\nclass Book\nLibrary o-- "*" Book') });
      fx.fadeIn(q2b.node, libraryAt, 0.3);
      fx.fadeOut(q2b.node, houseAt, 0.25);
      q2b.ring(diamond(q2b), { at: libraryAt + 0.2, pad: 5 });
      S.car(a, { x: 460, y: 280, w: 220, at: mark(v(4), 'car'), until: houseAt, wheelsOffAt: mark(v(4), 'wheels') + 0.2 });
      // Up for under two seconds and drawn small, so the spines carry no titles.
      S.bookshelf(a, {
        x: 712, y: 238, w: 210, at: libraryAt, until: houseAt, keepAt: mark(v(4), 'books'),
        books: [
          { title: [], tone: 'cream', w: 44, h: 146 },
          { title: [], tone: 'ink', w: 38, h: 128 },
          { title: [], tone: 'red', w: 40, h: 136 },
          { title: [], tone: 'slate', w: 46, h: 142 },
        ],
      });
      kit.sticker(a, 'Parts that outlive the whole', { x: 480, y: 414, at: mark(v(4), 'wheels'), until: houseAt, variant: 'white', iconName: 'check', rotate: 2 });

      // "But what if B cannot exist without A? Then use composition, a house
      // and its rooms: delete the whole, they go."
      const q3 = M.diagram(a, { ...sheet, at: houseAt + 0.25, spec: pair('class House\nclass Room\nHouse *-- "1..*" Room') });
      q3.ring(diamond(q3), { at: mark(v(5), 'composition'), pad: 5, tone: 'red' });
      q3.callout(diamond(q3), 'filled diamond: composition', { side: 'below', at: mark(v(5), 'composition'), tone: 'red', gap: 14 });
      // Wide enough for its room labels to stay readable.
      S.roomyHouse(a, { x: 590, y: 236, w: 240, at: mark(v(6), 'house') - 0.2, demolishAt: mark(v(6), 'delete') });
      kit.sticker(a, 'Rooms go too', { x: 440, y: 410, at: mark(v(6), 'delete'), variant: 'red', iconName: 'trash', rotate: -2 });

      // "Not sure it's a part? Association's safe; save the hollow diamond
      // for when the whole-part counts." A team and its players: part or
      // not? The plain association is the safe choice; the hollow diamond is
      // kept for a real whole and its parts, like the car and its wheels.
      const b = kit.scene(content, unsureAt, end('verse-3'), { exit: 'fade' });
      const pairSheet = { kind: 'class', y: 110, w: 420, fit: { w: 392, h: 110 }, scale: 1.25 };
      const unsure = M.diagram(b, { ...pairSheet, x: 30, title: 'Part?', at: unsureAt, spec: pair('class Team\nclass Player\nTeam o-- "*" Player') });
      unsure.callout(diamond(unsure), 'is a player really a part?', { side: 'below', at: mark(v(7), 'part'), until: mark(v(8), 'hollow'), tone: 'white', gap: 14 });
      const safe = M.diagram(b, { ...pairSheet, x: 506, title: 'Safe', at: mark(v(7), 'associations') - 0.1, spec: pair('class Team\nclass Player\nTeam --> "*" Player') });
      safe.ring(safe.union(safe.boxes((box, item) => item.tag !== 'text')), { at: mark(v(7), 'safe'), pad: 4, tone: 'green' });
      safe.callout('Player', 'association: always safe', { side: 'below', at: mark(v(7), 'safe'), tone: 'green', gap: 14 });
      unsure.ring(diamond(unsure), { at: mark(v(8), 'hollow'), pad: 5 });
      unsure.callout(diamond(unsure), 'hollow diamond: only a real whole-part', { side: 'below', at: mark(v(8), 'diamond'), gap: 14 });
      kit.sticker(b, 'Car and wheels: a real whole-part', { x: 300, y: 352, at: mark(v(8), 'whole'), variant: 'gold', iconName: 'merge', rotate: -2 });
      // Between the two sheets, the architect thinks the question over and
      // ticks off the safe line.
      A.architect(b, {
        ...ARCHITECT, x: 420, y: 238, scale: 0.72, tag: '', at: unsureAt + 0.1, until: mark(v(8), 'whole') - 0.3,
        moves: [[unsureAt + 0.3, 'think', { hold: 1 }], [mark(v(7), 'safe'), 'check', { to: [716, 190] }]],
      });
    }

    // ----------------------------------------------------------------
    // Verse 4: when to draw a Sequence Diagram, and which arrow when
    // ----------------------------------------------------------------

    // One example run: the client asks the server for a book, the server
    // asks the database, the replies come back, and then the client logs
    // the view without waiting.
    const RUN = `@startuml
participant client: Client
participant server: Server
participant db: Database
participant log: Analytics
activate client
client -> server: getBook(42)
activate server
server -> db: find(42)
activate db
db --> server: row
deactivate db
server --> client: book
deactivate server
client ->> log: viewed(42)
deactivate client
@enduml`;

    function verse4() {
      badge('Verse 4 · Sequence Diagram', 'verse-4');
      const v = (n) => `verse-4-${n}`;

      // "Sequence Diagram: one run, one scenario, in time, to see who waits
      // on whom and where bottlenecks grow." One run, read top to bottom;
      // the waits light up on the lifelines and the slow database is ringed.
      const fragmentsAt = line(v(7)).start + 0.3;
      const a = kit.scene(content, start('verse-4'), fragmentsAt, { exit: 'fade' });
      const d = M.diagram(a, { kind: 'sequence', x: 190, y: 96, w: 746, fit: { w: 718, h: 318 }, scale: 1.6, title: 'One scenario: get book 42', spec: RUN, at: line(v(1)).start - 0.1 });
      const whoAt = line(v(2)).start;
      // Gone before the architect steps into its place.
      S.timeArrow(a, { x: 112, y: 120, h: 280, at: mark(v(1), 'one'), until: whoAt - 0.3 });
      const clientBox = d.box('client: Client');
      const serverBox = d.box('server: Server');
      const span = (label) => d.union(d.boxes((box, item) => item.route === d.routeOf(label)));
      const [callBox, replyBox, innerCall, innerReply] = ['getBook(42)', 'book', 'find(42)', 'row'].map(span);
      const syncAt = mark(v(3), 'answer');
      d.band({ x: clientBox.x + clientBox.w / 2 - 14, y: callBox.y, w: 28, h: replyBox.y + replyBox.h - callBox.y }, { at: mark(v(2), 'waits'), until: syncAt, tone: 'red' });
      d.band({ x: serverBox.x + serverBox.w / 2 - 14, y: innerCall.y, w: 28, h: innerReply.y + innerReply.h - innerCall.y }, { at: mark(v(2), 'whom'), until: syncAt, tone: 'red' });
      d.ring('db: Database', { at: mark(v(2), 'bottlenecks'), until: syncAt, tone: 'red' });
      d.callout('db: Database', 'bottleneck: both callers wait', { side: 'below', at: mark(v(2), 'bottlenecks'), until: syncAt + 0.35, tone: 'red', gap: 200 });
      // Left of the sheet, once the time arrow has gone, the architect leans
      // in on "whom" and rings the database, where the bottleneck grows.
      const [dbX, dbY] = d.stagePoint('db: Database', 'center');
      A.architect(a, {
        ...ARCHITECT, x: 16, y: 166, scale: 0.84, tag: '', at: whoAt + 0.1, until: syncAt + 0.3,
        moves: [[mark(v(2), 'whom'), 'inspect', { to: [dbX, dbY + 100], hold: 0.3 }], [mark(v(2), 'bottlenecks'), 'circle', { to: [dbX, dbY] }]],
      });

      // "Need the answer to go on? That's a synchronous call: you wait right
      // there until the reply comes back."
      const call = d.routeOf('getBook(42)');
      const reply = d.routeOf('book');
      const asyncAt = mark(v(5), 'around');
      d.ring(callBox, { at: syncAt, until: asyncAt, pad: 5 });
      d.callout(d.textBox('getBook(42)'), 'filled head: synchronous', { side: 'below', at: mark(v(3), 'synchronous'), until: asyncAt, gap: 14, dx: -24 });
      d.token(call, { at: mark(v(3), 'call'), duration: 0.5, until: mark(v(4), 'wait') + 0.3 });
      d.token(d.routeOf('find(42)'), { at: mark(v(4), 'right'), duration: 0.4, until: mark(v(4), 'until') });
      d.token(d.routeOf('row'), { at: mark(v(4), 'until'), duration: 0.35, until: mark(v(4), 'reply'), tone: 'teal' });
      d.token(reply, { at: mark(v(4), 'reply'), duration: 0.6, until: mark(v(4), 'back') + 0.4, tone: 'teal' });
      const waitTop = d.stagePoint(callBox, 'left');
      // Between the time arrow's place and the sheet, beside the waiting caller.
      S.hourglass(a, { x: 148, y: waitTop[1] - 4, size: 56, at: mark(v(4), 'wait'), doneAt: mark(v(4), 'back'), hideAt: asyncAt });
      const waiting = { x: clientBox.x + clientBox.w / 2 - 12, y: callBox.y, w: 24, h: replyBox.y + replyBox.h - callBox.y };
      d.band(waiting, { at: mark(v(4), 'wait'), until: asyncAt, tone: 'red' });
      d.callout(waiting, 'caller waits', { side: 'right', at: mark(v(4), 'wait'), until: asyncAt, tone: 'red', gap: 8, dy: 14 });
      // Gone before the asynchronous message under it lights up.
      d.callout(d.textBox('book'), 'dashed: the reply', { side: 'below', at: mark(v(4), 'reply'), until: asyncAt - 0.2, tone: 'teal', gap: 8 });

      // "No need to wait around? Then send and carry on: that's
      // asynchronous, the sender doesn't block."
      const async = d.routeOf('viewed(42)');
      const asyncSpan = span('viewed(42)');
      d.ring(asyncSpan, { at: asyncAt, pad: 5, tone: 'green' });
      const asyncPath = d.path(async).map(([px, py]) => d.stagePoint({ x: px, y: py, w: 0, h: 0 }, 'center'));
      S.paperPlane(a, { route: asyncPath, at: mark(v(5), 'send'), duration: 0.7 });
      // Right of the middle, leaving room under the client for the next label.
      d.callout(d.textBox('viewed(42)'), 'open head: asynchronous', { side: 'below', at: mark(v(6), 'asynchronous'), tone: 'green', gap: 22, dx: 110 });
      // The client's own bar, just below the message it sent: it never stopped.
      const afterSend = { x: clientBox.x + clientBox.w / 2 - 7, y: asyncSpan.y + asyncSpan.h + 2, w: 14, h: 16 };
      d.callout(afterSend, 'sender keeps going', { side: 'right', at: mark(v(6), 'the'), tone: 'green', gap: 8 });

      // "Exactly one path? Use an Alt Fragment. Zero or one time? Use an Opt
      // Fragment. Again while it's true? Use a Loop Fragment." The same
      // client and server stay put and only the frame around their messages
      // changes, drawn large enough to read its guard. Each fragment's code
      // card stacks up beside it, and its code lights up as the fragment is
      // named. The scene is gone as verse 5 sings its diagram's name.
      const b = kit.scene(content, fragmentsAt, line('verse-5-1').start + 0.1, { exit: 'fade' });
      const fragmentSheet = { kind: 'sequence', x: 24, y: 60, scale: 1.1 };
      const optAt = line(v(8)).start - 0.1;
      const loopAt = line(v(9)).start - 0.1;
      const alt = M.diagram(b, { ...fragmentSheet, at: fragmentsAt, until: optAt, spec: `@startuml
participant client: Client
participant server: Server
activate client
activate server
alt [found]
  server --> client: book
else [else]
  server --> client: 404
end
deactivate server
deactivate client
@enduml` });
      const opt = M.diagram(b, { ...fragmentSheet, until: loopAt, spec: `@startuml
participant client: Client
participant server: Server
activate client
opt [logged in]
  client -> server: borrow(42)
  activate server
  deactivate server
end
deactivate client
@enduml` });
      fx.fadeIn(opt.node, optAt, 0.3);
      const loop = M.diagram(b, { ...fragmentSheet, spec: `@startuml
participant client: Client
participant server: Server
activate client
loop [for each book]
  client -> server: renew(id)
  activate server
  deactivate server
end
deactivate client
@enduml` });
      fx.fadeIn(loop.node, loopAt, 0.3);
      const cards = { x: 492, w: 444 };
      // The singer says when to use each one; the cards only pair keyword and code.
      const altCode = M.code(b, { ...cards, y: 60, title: 'alt = if / else', at: fragmentsAt + 0.15, lines: ['if found: reply(book)', 'else: reply(404)'] });
      const optCode = M.code(b, { ...cards, y: 172, title: 'opt = if', at: optAt + 0.15, lines: ['if logged_in:', '    borrow(42)'] });
      const loopCode = M.code(b, { ...cards, y: 284, title: 'loop = for / while', at: loopAt + 0.15, lines: ['for book in books:', '    renew(book.id)'] });
      // Each guard lights up with the condition it stands for in the code.
      alt.ring(alt.textBox('[found]'), { at: mark(v(7), 'path'), pad: 4 });
      opt.ring(opt.textBox('[logged in]'), { at: mark(v(8), 'time'), pad: 4 });
      loop.ring(loop.textBox('[for each book]'), { at: mark(v(9), 'true'), pad: 4 });
      const renew = loop.routeOf('renew(id)');
      [0, 1, 2].forEach((i) => loop.token(renew, { at: mark(v(9), 'while') + i * 0.7, duration: 0.45, until: mark(v(9), 'while') + i * 0.7 + 0.55, label: `#${i + 1}` }));
      altCode.mark(0, mark(v(7), 'alt'));
      altCode.mark(1, mark(v(7), 'fragment'));
      optCode.mark(0, mark(v(8), 'opt'));
      loopCode.mark(0, mark(v(9), 'loop'));
    }

    // ----------------------------------------------------------------
    // Verse 5: when to draw a State Machine Diagram
    // ----------------------------------------------------------------

    function verse5() {
      badge('Verse 5 · State Machine Diagram', 'verse-5');
      const v = (n) => `verse-5-${n}`;
      const LATE = 'day passes [today > due] / send reminder';

      // "State Machine Diagram: when an object's response depends on its
      // state, draw its life, state by state." The diagram comes in on its
      // sung name, then one library book, then its states, one at a time.
      const machineAt = line(v(1)).start + 0.2;
      const fnAt = line(v(7)).start + 0.45;
      const a = kit.scene(content, machineAt, fnAt, { exit: 'fade' });
      const d = M.diagram(a, {
        kind: 'state', x: 20, y: 74, w: 920, fit: { w: 892, h: 210 }, scale: 1.2, title: 'State Machine Diagram: one library book', at: mark(v(1), 'machine'),
        spec: `@startuml
[*] --> Available
Available --> Borrowed : borrow / set due date
Borrowed --> Available : return
Borrowed --> Overdue : ${LATE}
Overdue --> Available : return / charge fee
@enduml`,
      });
      const tellsAt = mark(v(3), 'tells');
      S.libraryBook(a, {
        x: 40, y: 268, size: 120, at: mark(v(1), 'objects') - 0.2,
        states: [
          { at: 0, text: 'Available', tone: 'green' },
          { at: tellsAt + 0.4, text: 'Borrowed', tone: 'gold' },
          { at: tellsAt + 1, text: 'Overdue', tone: 'red' },
          { at: tellsAt + 1.7, text: 'Available', tone: 'green' },
        ],
      });
      kit.sticker(a, 'Its response depends on its state', { x: 200, y: 330, at: mark(v(1), 'response'), until: mark(v(1), 'draw') + 0.3, variant: 'gold', iconName: 'key', rotate: -2 });
      // The title sings the line's first "state"; the states ring on the last two.
      [['Available', 'life'], ['Borrowed', 'state_3'], ['Overdue', 'state_4']].forEach(([state, word]) => {
        d.ring(state, { at: mark(v(1), word), until: line(v(2)).start, tone: 'teal' });
      });

      // "One run? Sequence Diagram. Its whole life, every path? The State
      // Machine Diagram tells the object's story." One run beside the whole
      // life: a dot runs every transition, then copy #42 lives its story.
      // One message keeps the sheet short enough to fit under the machine
      // at full text size.
      const oneRun = M.diagram(a, {
        kind: 'sequence', x: 540, y: 244, w: 400, fit: { w: 372, h: 160 }, scale: 1, title: 'Sequence Diagram: one run', at: mark(v(2), 'one'), until: mark(v(2), 'path') + 0.4,
        spec: '@startuml\nparticipant member: Member\nparticipant book: Book\nmember -> book: borrow()\n@enduml',
      });
      oneRun.ring(oneRun.union(oneRun.boxes((box, item) => item.route && item.tag !== 'text')), { at: mark(v(2), 'diagram'), until: mark(v(2), 'whole'), pad: 4, tone: 'teal' });
      const routes = ['borrow / set due date', 'return', LATE, 'return / charge fee'].map((label) => d.routeOf(label));
      const arrow = (route) => d.union(d.boxes((box, item) => item.route === route && item.tag !== 'text'));
      // A token runs along every transition, tracing each path's own shape.
      routes.forEach((route, i) => {
        const at = mark(v(2), 'every') + i * 0.15;
        d.token(route, { at, duration: 0.8, until: at + 1.1, tone: 'teal' });
      });
      d.marker([
        { at: tellsAt, to: 'Available' },
        { at: tellsAt + 0.2, to: 'Borrowed', via: routes[0], duration: 0.5 },
        { at: tellsAt + 0.8, to: 'Overdue', via: routes[2], duration: 0.5 },
        { at: tellsAt + 1.4, to: 'Available', via: routes[3], duration: 0.6 },
      ], { label: '#42', until: line(v(4)).start });

      // "Can each state be reached? Can each state be left?" Every state lights
      // up, then a token leaves each one by a way out.
      ['Available', 'Borrowed', 'Overdue'].forEach((state, i) => d.ring(state, { at: mark(v(4), 'reached') + i * 0.15, until: mark(v(4), 'left'), tone: 'teal' }));
      [routes[0], routes[2], routes[3]].forEach((route, i) => {
        const at = mark(v(4), 'left') + i * 0.15;
        d.token(route, { at, duration: 0.7, until: at + 1, tone: 'violet' });
      });

      // "Trigger, guard, and action: when, and if, and do."
      const late = d.routeOf(LATE);
      const parts = mark(v(6), 'same');
      S.labelParts(a, {
        // A beat past "Same", so the last card can be read; gone before the coin lands.
        x: 200, y: 330, at: mark(v(5), 'trigger'), until: mark(v(6), 'trigger'),
        parts: [
          { text: 'day passes', meaning: 'trigger: when', at: mark(v(5), 'trigger'), tone: 'event' },
          { text: '[today > due]', meaning: 'guard: if', at: mark(v(5), 'guard'), tone: 'guard' },
          { text: '/ send reminder', meaning: 'action: do', at: mark(v(5), 'action'), tone: 'action' },
        ],
      });
      d.ring(arrow(late), { at: mark(v(5), 'trigger'), until: parts, pad: 6 });
      d.ring(d.textBox(LATE, 'day passes'), { at: mark(v(5), 'when'), until: parts, pad: 3, tone: 'teal' });
      d.ring(d.textBox(LATE, '[today > due]'), { at: mark(v(5), 'if'), until: parts, pad: 3 });
      d.ring(d.textBox(LATE, '/ send reminder'), { at: mark(v(5), 'do'), until: parts, pad: 3, tone: 'violet' });

      // "Same trigger, different end? The state it's in decides." Return from
      // Borrowed ends free; return from Overdue ends with a fee.
      d.ring(d.textBox('return'), { at: mark(v(6), 'same'), pad: 3, tone: 'teal' });
      d.ring(d.textBox('return / charge fee', 'return'), { at: mark(v(6), 'trigger'), pad: 3, tone: 'teal' });
      kit.sticker(a, 'Same trigger: return', { x: 40, y: 226, at: mark(v(6), 'same'), variant: 'cyan', iconName: 'resend', rotate: -2 });
      d.ring(d.textBox('return / charge fee', '/ charge fee'), { at: mark(v(6), 'different'), pad: 3, tone: 'violet' });
      S.coin(a, { x: 182, y: 300, at: mark(v(6), 'end') });
      kit.sticker(a, 'Different end: a fee', { x: 300, y: 226, at: mark(v(6), 'different'), variant: 'violet', iconName: 'cash', rotate: 2 });
      d.ring('Borrowed', { at: mark(v(6), 'state'), tone: 'red' });
      d.ring('Overdue', { at: mark(v(6), 'state'), tone: 'red' });
      kit.sticker(a, 'The current state decides', { x: 600, y: 226, at: mark(v(6), 'state'), variant: 'gold', iconName: 'key', rotate: -2 });

      // "Reacts the same each time? Skip the State Machine Diagram." Holds
      // through the instrumental bars, until verse 6's code view comes in.
      const b = kit.scene(content, fnAt, line('verse-6-1').start - 0.3, { exit: 'fade' });
      S.functionMachine(b, {
        x: 80, y: 150, name: 'to_fahrenheit(c)', at: fnAt,
        runs: [
          { at: fnAt + 0.1, input: '100', output: '212' },
          { at: fnAt + 0.9, input: '100', output: '212' },
        ],
      });
      kit.sticker(b, 'Same input, same answer, every time', { x: 80, y: 356, at: fnAt + 0.2, variant: 'cyan', iconName: 'loop', rotate: -2 });
      const pointless = M.diagram(b, {
        kind: 'state', x: 520, y: 140, w: 360, fit: { w: 332, h: 150 }, scale: 1.2, at: mark(v(7), 'skip') - 0.4,
        spec: `@startuml
[*] --> Ready
Ready --> Ready : convert
@enduml`,
      });
      pointless.cross(pointless.union(pointless.boxes(() => true)), { at: mark(v(7), 'skip') });
      kit.sticker(b, 'No history? Skip it.', { x: 560, y: 330, at: mark(v(7), 'skip'), variant: 'red', iconName: 'cross', rotate: 2 });
    }

    // ----------------------------------------------------------------
    // Verse 6: when to draw a Component Diagram
    // ----------------------------------------------------------------

    const RUNTIME = (store) => `@startuml
component Client {
  require "Books" as r1
}
component LibraryServer {
  provide "Books" as p1
  require "Storage" as r2
}
component ${store} {
  provide "Storage" as p2
}
r1 --> p1
r2 --> p2
@enduml`;

    function verse6() {
      badge('Verse 6 · Component Diagram', 'verse-6');
      const v = (n) => `verse-6-${n}`;
      const wide = { kind: 'component', x: 40, y: 84, w: 880, fit: { w: 852, h: 150 }, scale: 1.25 };

      // "Component Diagram: zoom out from the code to the parts you deploy,
      // and how they connect." The code view shrinks into the client as the
      // running parts appear.
      // A beat early, so the classes can be read before they zoom away.
      const verse6At = line(v(1)).start - 0.3;
      const a = kit.scene(content, verse6At, before(v(4)), { exit: 'fade' });
      const zoomAt = mark(v(1), 'code') + 0.1;
      const runtime = M.diagram(a, { ...wide, spec: RUNTIME('Database') });
      fx.fadeIn(runtime.node, zoomAt + 0.4, 0.4);
      const classes = M.diagram(a, {
        kind: 'class', x: 250, y: 110, w: 460, fit: { w: 432, h: 200 }, scale: 1.2, title: 'Code view: classes', at: verse6At,
        spec: `@startuml
layout horizontal
class LibraryApp
class BookList
class HttpClient
LibraryApp --> BookList
LibraryApp --> HttpClient
@enduml`,
      });
      const [clientX, clientY] = runtime.stagePoint('Client', 'center');
      classes.node.style.transformOrigin = '0 0';
      tween(classes.node, { translate: `${clientX - 250 - 46}px ${clientY - 110 - 20}px`, scale: 0.2, opacity: 0 }, zoomAt, 0.7, window.Timeline.EASE.inOut);
      const insideAt = mark(v(3), 'just');
      const devices = [['Client', 'laptop'], ['LibraryServer', 'server'], ['Database', 'database']].map(([name, kind], i) => {
        const [dx, dy] = runtime.stagePoint(name, 'bottom');
        return S.device(a, kind, { x: dx - 48, y: dy + 30, size: 96, at: mark(v(1), 'deploy') + i * 0.15, until: insideAt });
      });
      // Each ball-and-socket joint lights up on its own, where two parts connect.
      runtime.boxes((box, item) => item.tag === 'circle').forEach((joint, i) => {
        runtime.ring(joint, { at: mark(v(1), 'connect') + i * 0.15, until: line(v(2)).start + 0.6, pad: 8, round: 16, tone: 'teal' });
      });

      // "Can you deploy it alone? Then it's a component."
      ['Client', 'LibraryServer', 'Database'].forEach((name, i) => {
        runtime.ring(name, { at: mark(v(2), 'alone') + i * 0.15, until: insideAt, tone: 'teal' });
        fx.bump(devices[i], mark(v(2), 'alone') + i * 0.15, 0.12);
      });
      kit.sticker(a, 'Deploys alone: a component', { x: 560, y: 398, at: mark(v(2), 'component'), variant: 'green', iconName: 'bolt', rotate: 2 });

      // "Just a class inside? Keep it in the Class Diagram." The classes
      // inside the client go back to their own diagram.
      runtime.band(runtime.box('Client'), { at: insideAt, tone: 'violet' });
      const inside = M.diagram(a, {
        kind: 'class', x: 30, y: 262, w: 360, fit: { w: 332, h: 130 }, scale: 1.05, title: 'Class Diagram: inside Client', at: insideAt + 0.2,
        spec: `@startuml
layout horizontal
class LibraryApp
class BookList
LibraryApp --> BookList
@enduml`,
      });
      const [insideX, insideY] = runtime.stagePoint('Client', 'bottom');
      kit.flow(a, { from: [insideX, insideY + 6], to: [insideX, 258], bend: 0, color: 'violet', at: insideAt + 0.3 });
      inside.ring(inside.union(inside.boxes(() => true)), { at: mark(v(3), 'class_2'), pad: 6, tone: 'violet' });

      // "Provided: an interface the component offers; required: an interface
      // the component needs; when need meets offer, the pieces snap in place."
      const b = kit.scene(content, before(v(4)), end('verse-6'), { exit: 'fade' });
      const first = M.diagram(b, { ...wide, at: line(v(4)).start - 0.1, until: mark(v(7), 'swap'), spec: RUNTIME('Database') });
      const second = M.diagram(b, { ...wide, spec: RUNTIME('CloudDB') });
      fx.fadeIn(second.node, mark(v(7), 'swap'), 0.3);
      const balls = first.boxes((box, item) => item.tag === 'circle').sort((p, q) => p.x - q.x);
      const sockets = first.boxes((box, item) => item.tag === 'path').sort((p, q) => p.x - q.x);
      const plugAt = mark(v(5), 'need');
      first.ring(balls[0], { at: mark(v(4), 'provided'), until: plugAt, pad: 4, round: 14, tone: 'green' });
      first.callout(balls[0], 'ball: provided', { side: 'below', at: mark(v(4), 'provided'), until: plugAt + 0.4, tone: 'green', gap: 54, dx: 84 });
      first.ring(sockets[0], { at: mark(v(4), 'required'), until: plugAt, pad: 4, round: 14 });
      // Both labels clear the components' edges, so their outlines don't read as a box across the gap.
      first.callout(sockets[0], 'socket: required', { side: 'above', at: mark(v(4), 'required'), until: plugAt + 0.4, gap: 44 });
      // The plug holds through "The interface: a" and is gone before the contract card takes its place.
      S.plug(b, {
        x: 270, y: 262, w: 420, at: plugAt, until: mark(v(6), 'contract') - 0.35, snapAt: mark(v(5), 'snap'),
        labels: { left: 'Client needs', leftAt: plugAt, right: 'Server provides', rightAt: mark(v(5), 'offer') },
      });

      // "The interface: a contract, what to ask, not how it works: swap
      // what's behind it, and the client code still works."
      const terms = S.contract(b, {
        x: 330, y: 262, w: 300, title: 'Books interface', at: mark(v(6), 'contract'), until: mark(v(7), 'swap') - 0.1,
        lines: ['getBook(id) → Book', 'addBook(b)'],
      });
      const [getLine, addLine] = terms.querySelectorAll('li');
      fx.bump(getLine, mark(v(6), 'ask'), 0.18);
      fx.bump(addLine, mark(v(6), 'ask') + 0.15, 0.18);
      // The band and label sit on both sheets, so they read as one through
      // the swap: the second sheet's are already in place as it fades in.
      const hiddenUntil = mark(v(7), 'behind') + 0.4;
      first.band(first.box('LibraryServer'), { at: mark(v(6), 'not'), tone: 'violet' });
      first.callout('LibraryServer', 'how: hidden inside', { side: 'above', at: mark(v(6), 'how'), tone: 'violet', gap: 10 });
      second.band(second.box('LibraryServer'), { at: mark(v(7), 'swap') - 0.4, until: hiddenUntil, tone: 'violet' });
      second.callout('LibraryServer', 'how: hidden inside', { side: 'above', at: mark(v(7), 'swap') - 0.4, until: hiddenUntil, tone: 'violet', gap: 10 });
      // The sheet swaps Database for CloudDB, and the new store drops in below it.
      const newDb = S.device(b, 'database', { x: 740, y: 280, size: 100, at: mark(v(7), 'behind'), className: 'sk-device--cloud' });
      tween(newDb, [{ translate: '0 -60px' }, { translate: '0 0' }], mark(v(7), 'behind'), 0.4, window.Timeline.EASE.out);
      second.ring('CloudDB', { at: mark(v(7), 'behind'), tone: 'teal' });
      second.ring('Client', { at: mark(v(7), 'client'), tone: 'green' });
      second.callout('Client', 'client: unchanged', { side: 'below', at: mark(v(7), 'client'), tone: 'green', gap: 30 });
      M.code(b, { x: 40, y: 300, w: 360, title: 'client.py', at: mark(v(7), 'behind') + 0.3, lines: ['book = books.get_book(42)'] });
      // Bottom right, the architect points out the ball and the socket,
      // ticks off the snap, taps the contract, and nods at what the client
      // may ask, gone before the new database lands beside its head.
      A.architect(b, {
        ...ARCHITECT, x: 744, y: 232, scale: 0.76, flip: true, tag: '', at: line(v(4)).start + 0.2, until: mark(v(7), 'swap') - 0.6,
        moves: [
          [mark(v(4), 'provided'), 'point', { to: first.stagePoint(balls[0], 'center'), hold: 1 }],
          [mark(v(4), 'required'), 'point', { to: first.stagePoint(sockets[0], 'center'), hold: 0.8 }],
          [mark(v(5), 'snap'), 'check', { to: [480, 300] }],
          [mark(v(6), 'contract') + 0.1, 'tap', { to: [600, 330] }],
          [mark(v(6), 'ask'), 'nod'],
        ],
      });
    }

    // ----------------------------------------------------------------
    // Chorus: four questions, four diagrams
    // ----------------------------------------------------------------

    // The diagram that answers each chorus question, drawn large on its
    // answer and then parked in a corner, so the last line sees all four.
    const ANSWERS = [
      {
        kind: 'class', title: 'Class Diagram', ask: 'Which classes, how they relate?', word: 'class', corner: [24, 132],
        spec: `@startuml
layout horizontal
class Member {
  - name: String
  + borrow(b: Book)
}
class Book {
  - title: String
}
Member "1" --> "*" Book : borrows
@enduml`,
      },
      {
        kind: 'sequence', title: 'Sequence Diagram', ask: 'Who calls whom, in what order?', word: 'sequence', corner: [743, 132],
        spec: `@startuml
participant client: Client
participant server: LibraryServer
activate client
client -> server: getBook(42)
activate server
server --> client: book
deactivate server
deactivate client
@enduml`,
      },
      {
        kind: 'state', title: 'State Machine Diagram', ask: 'What state’s it in, what event moves it on?', word: 'state', corner: [24, 292],
        spec: `@startuml
[*] --> Available
Available --> Borrowed : borrow
Borrowed --> Available : return
@enduml`,
      },
      {
        kind: 'component', title: 'Component Diagram', ask: 'What runs, how it plugs together?', word: 'component', corner: [743, 292],
        spec: `@startuml
component Client {
  require "Books" as r1
}
component LibraryServer {
  provide "Books" as p1
}
r1 --> p1
@enduml`,
      },
    ];
    const THUMBNAIL = 0.42;

    function chorus(id, { recall = false, finale = false, cameo } = {}) {
      badge(finale ? 'Final chorus · Pick the diagram' : 'Chorus · Pick the diagram', id);
      const l = (n) => `${id}-${n}`;
      const { lines } = song.storyboard.sections.find((section) => section.id === id);
      // "Ask your question, then draw it out!" closes the first and last
      // choruses. Before a verse, its card holds a beat past the chorus.
      const closing = finale || lines.length > 5;
      const s = kit.scene(content, start(id), end(id) + (closing && !finale ? 0.25 : 0));
      const askAt = line(l(2)).start - 0.15;
      kit.kinetic(s, [
        { text: 'Draw', at: mark(l(1), 'draw'), color: 'gold', iconName: 'pencil' },
        { text: 'it out', at: mark(l(1), 'out') },
      ], { y: 150, size: 76, until: askAt });
      const cheap = kit.el('div', 'subtitle is-staged', s, 'while it’s cheap to change');
      cheap.style.top = '256px';
      fx.rise(cheap, mark(l(1), 'draw') + 0.3);
      fx.fadeOut(cheap, askAt, 0.25);

      const sheets = ANSWERS.map((answer, i) => {
        const n = i + 2;
        const next = lines[n];
        // The answer stays large into the next question (whose card rises
        // above it), so the diagram is up long enough to take in. The last
        // one parks before the closing card, which would cover it.
        const parkAt = !next ? end(id) : n < ANSWERS.length + 1 ? next.start + 0.5 : next.start - 0.4;
        S.question(s, answer.ask, { x: 250, y: 46, w: 460, at: line(l(n)).start, until: next ? next.start - 0.2 : end(id) });
        const sheet = M.diagram(s, { kind: answer.kind, x: 250, y: 132, w: 460, fit: { w: 432, h: 206 }, scale: 1.3, title: answer.title, spec: answer.spec });
        const shout = mark(l(n), answer.word);
        fx.slam(sheet.node, shout, { from: 1.5 });
        window.Timeline.camera.punch(shout + 0.05, 0.03);
        sheet.node.style.transformOrigin = '0 0';
        tween(sheet.node, { translate: `${answer.corner[0] - 250}px ${answer.corner[1] - 132}px`, scale: THUMBNAIL }, parkAt, 0.5, window.Timeline.EASE.inOut);
        return sheet;
      });

      // The architect joins the opening lines at one side (`cameo`), until
      // that side's corner is needed for a parked diagram: it raises the
      // drawing on "out", ticks off the Class Diagram, and from the right
      // traces the Sequence Diagram's first call.
      if (cameo) {
        const right = cameo === 'right';
        const [classes, seq] = sheets;
        const call = seq.path(seq.routeOf('getBook(42)')).map(([px, py]) => seq.stagePoint({ x: px, y: py, w: 0, h: 0 }, 'center'));
        A.architect(s, {
          ...ARCHITECT, x: right ? 800 : 18, y: 142, scale: 0.92, flip: right, entrance: cameo, tag: '',
          at: start(id) + 0.1, until: line(l(right ? 4 : 3)).start + 0.2,
          moves: [
            [mark(l(1), 'out'), 'present', { hold: 1.2 }],
            [mark(l(2), 'class'), 'check', { to: classes.stagePoint('Member', 'center') }],
            ...(right ? [[mark(l(3), 'sequence') + 0.2, 'trace', { route: call }]] : []),
          ],
        });
      }

      if (recall) {
        const [, seq, state] = sheets;
        seq.token(seq.routeOf('getBook(42)'), { at: mark(l(3), 'sequence') + 0.3, duration: 0.6, until: mark(l(3), 'diagram') + 0.3 });
        state.marker([
          { at: mark(l(4), 'state'), to: 'Available' },
          { at: mark(l(4), 'state') + 0.5, to: 'Borrowed', via: state.routeOf('borrow') },
        ], { until: line(l(5)).start - 0.2 });
      }

      // "Ask your question, then draw it out!"
      if (closing) {
        S.question(s, 'What do you need to know?', { x: 250, y: 160, w: 460, at: line(l(6)).start - 0.3 });
        kit.kinetic(s, [{ text: 'Draw it out!', at: mark(l(6), 'question'), color: 'gold', iconName: 'pencil' }], { y: 250, size: 52 });
        if (finale) kit.confetti(s, { x: 480, y: 250, at: mark(l(6), 'out'), count: 60, seed: 11 });
      }
    }

    // ----------------------------------------------------------------
    // Pop quiz: seven conceptual questions about one new system, a pizza
    // app, on the quiz cards the other songs use
    // ----------------------------------------------------------------

    /** The icon on each answer bar, in question order. */
    const QUIZ_ICONS = ['search', 'hourglass', 'folder', 'key', 'envelope', 'tag', 'plug'];

    /** Where a quiz question's diagram sits, right of its narrowed card. */
    const QUIZ_SHEET = { x: 496, y: 96, w: 440, fit: { w: 412, h: 280 }, scale: 1.4 };
    const quizPart = (spec) => `@startuml\n${spec}\n@enduml`;
    const PAYMENTS = (provider) => quizPart(`component App {\n  require "Payments" as r1\n}\ncomponent ${provider} {\n  provide "Payments" as p1\n}\nr1 --> p1`);

    /**
     * Beside a question with no diagram, the architect thinks it over,
     * pencil to chin, through the player's quiz pause, then answers the
     * answer bar as it is sung with `finish`, a [move, options] gesture.
     * A question whose answer the take never sings gets only the thinking.
     */
    const architectAnswers = (finish) => (s, entry) => {
      const think = (until) => [entry.start + 0.8, 'think', { hold: Math.max(0.6, until - entry.start - 1.3) }];
      A.architect(s, {
        ...ARCHITECT, x: 600, y: 92, scale: 1.1, flip: true, at: entry.start + 0.1,
        moves: entry.answer
          ? [think(entry.answer_at), [entry.answer_at, 'aha'], [entry.answer_at + 0.15, ...finish]]
          : [think(entry.end + 0.1)],
      });
    };

    /**
     * What sits beside each question, keyed by question number: the diagram
     * it is about, which draws on the question's scene and changes when its
     * answer is sung, or else the architect.
     */
    const QUIZ_FIGURES = {
      // The architect ticks the answer off, points at it, or rings it.
      2: architectAnswers(['check', { to: [440, 360], size: 20, hold: 1.2 }]),
      4: architectAnswers(['point', { to: [450, 380], hold: 1.6 }]),
      6: architectAnswers(['circle', { to: [440, 360], rx: 16, ry: 11, hold: 1 }]),
      // "Your diagram skips the database. Mistake?"
      1(s, entry) {
        M.diagram(s, {
          kind: 'component', ...QUIZ_SHEET, title: 'Pizza app: components', at: entry.start,
          spec: quizPart('component App {\n  require "Orders" as r1\n}\ncomponent Server {\n  provide "Orders" as p1\n}\nr1 --> p1'),
        });
        S.device(s, 'database', { x: 760, y: 330, size: 84, at: mark('quiz-1', 'database') });
        kit.sticker(s, 'Not in the diagram', { x: 560, y: 360, at: mark('quiz-1', 'database'), variant: 'white', rotate: -2 });
      },
      // "Customer gone, orders kept: filled diamond?"
      3(s, entry) {
        const swapAt = entry.answer_at + 0.3;
        const sheet = { kind: 'class', ...QUIZ_SHEET, title: 'Pizza app: classes' };
        const owned = M.diagram(s, { ...sheet, at: entry.start, until: swapAt, spec: quizPart('layout horizontal\nclass Customer\nclass Order\nCustomer "1" *-- "*" Order') });
        const diamond = owned.union(owned.boxes((box, item) => item.tag === 'polygon'));
        owned.ring(diamond, { at: mark('quiz-3', 'filled'), pad: 5, tone: 'red' });
        owned.cross(diamond, { at: entry.answer_at });
        const kept = M.diagram(s, { ...sheet, spec: quizPart('layout horizontal\nclass Customer\nclass Order\nCustomer "1" --> "*" Order') });
        fx.fadeIn(kept.node, swapAt, 0.3);
        kept.ring('Order', { at: swapAt + 0.2, tone: 'green' });
      },
      // "The receipt email is slow. Which arrowhead?" The head stays covered
      // until the crowd names it.
      5(s, entry) {
        const d = M.diagram(s, {
          kind: 'sequence', ...QUIZ_SHEET, title: 'Pizza app: checkout', at: entry.start,
          spec: quizPart('participant checkout: Checkout\nparticipant mail: Mailer\nactivate checkout\ncheckout ->> mail: sendReceipt()\ndeactivate checkout'),
        });
        const [hx, hy] = d.path(d.routeOf('sendReceipt()')).at(-1);
        const head = { x: hx - 16, y: hy - 10, w: 18, h: 20 };
        const [mx, my] = d.stagePoint(head, 'center');
        const mask = kit.place(kit.el('div', 'dio-quiz-mask is-staged', s, '?'), mx - 19, my - 19);
        fx.fadeIn(mask, entry.start + 0.3, 0.2);
        fx.fadeOut(mask, entry.answer_at, 0.2);
        d.ring(head, { at: entry.answer_at + 0.1, pad: 4, tone: 'green' });
      },
      // "New provider, same interface: does the app change?"
      7(s, entry) {
        const swapAt = mark('quiz-7', 'interface');
        const sheet = { kind: 'component', ...QUIZ_SHEET, title: 'Pizza app: payments' };
        const before = M.diagram(s, { ...sheet, at: entry.start, until: swapAt, spec: PAYMENTS('CardPayCo') });
        before.ring('CardPayCo', { at: mark('quiz-7', 'provider'), tone: 'red' });
        const after = M.diagram(s, { ...sheet, spec: PAYMENTS('QuickPay') });
        fx.fadeIn(after.node, swapAt, 0.3);
        after.ring('QuickPay', { at: swapAt + 0.1, tone: 'teal' });
        after.ring('App', { at: entry.answer_at, tone: 'green' });
      },
    };

    /** The outro takes over half a second before its line. */
    const outroAt = () => line('outro-1').start - 0.5;

    function quiz() {
      kit.badge(hud, 'Pop quiz · Help design it', start('quiz-intro'), end('quiz'));
      const intro = kit.scene(content, start('quiz-intro'), line('quiz-1').start - 0.1, { exit: 'fade' });
      // The title lands on "Pop quiz" and the cue right after it, ahead of
      // "Help design it!", so it can be read before the first card.
      kit.kinetic(intro, [{ text: 'Pop quiz!', at: mark('quiz-intro-1', 'pop'), color: 'gold', iconName: 'question' }], { y: 150, size: 80 });
      // The cards name the pizza app; the intro only asks for answers.
      const cue = kit.el('div', 'subtitle is-staged', intro, 'Help design it!');
      cue.style.top = '262px';
      fx.rise(cue, mark('quiz-intro-1', 'quiz') + 0.2);

      // Each card holds its question and, once the crowd sings it, the
      // answer, until the next card slides in. The player's quiz pause
      // stops each card before its answer.
      const { lines } = song.storyboard.sections.find((section) => section.id === 'quiz');
      lines.forEach((entry, i) => {
        const from = entry.start - 0.15;
        // Each card fades as the next one slides in, so the two never show through each other.
        const to = i + 1 < lines.length ? lines[i + 1].start - 0.1 : outroAt();
        const s = kit.scene(content, from, to, { enter: 'whip', exit: 'fade' });
        const figure = QUIZ_FIGURES[i + 1];
        const card = kit.el('div', `quiz-card dio-quiz-card${figure ? ' dio-quiz-card--figure' : ''}`, s);
        kit.el('div', 'quiz-count', card, `Quiz ${i + 1} / ${lines.length}`);
        kit.el('div', 'dio-quiz-label', card, 'Pizza app');
        kit.el('div', 'quiz-question', card, entry.text);
        if (entry.answer) {
          const answer = kit.el('div', 'quiz-answer is-staged', card);
          answer.append(kit.icon(QUIZ_ICONS[i]));
          answer.append(document.createTextNode(entry.answer));
          fx.slam(answer, entry.answer_at, { from: 1.6 });
          window.Timeline.camera.punch(entry.answer_at + 0.05, 0.03);
        }
        if (figure) figure(s, entry);
      });
    }

    // ----------------------------------------------------------------
    // Outro: the hook once more, framed by the four diagrams
    // ----------------------------------------------------------------

    function outro() {
      const s = kit.scene(content, outroAt(), song.duration);
      kit.kinetic(s, [
        { text: 'Draw', at: mark('outro-1', 'draw'), color: 'gold', iconName: 'pencil' },
        { text: 'it out', at: mark('outro-1', 'out') },
      ], { y: 46, size: 64 });
      const cheap = kit.el('div', 'subtitle is-staged', s, 'while it’s cheap to change');
      cheap.style.top = '132px';
      fx.rise(cheap, mark('outro-1', 'cheap'));
      // The take sings the hook twice; the stage punches in on the second.
      window.Timeline.camera.punch(mark('outro-2', 'draw') + 0.05, 0.03);
      // Framed by the four diagrams, the architect holds up the rolled
      // drawing on the first "Draw it out", runs the pencil round the four
      // diagrams between the hooks, sketches along with the second, and
      // bows on its "cheap".
      const thumbnailCentre = ({ corner: [x, y] }) => [x + 97, y + 4];
      const tour = [0, 1, 3, 2].map((i) => thumbnailCentre(ANSWERS[i]));
      A.architect(s, {
        ...ARCHITECT, x: 406, y: 152, scale: 0.92, at: outroAt() + 0.3,
        moves: [
          [mark('outro-1', 'draw'), 'present', { hold: 2.2 }],
          [mark('outro-1', 'change') + 0.6, 'trace', { route: tour, step: 0.7 }],
          [mark('outro-2', 'draw'), 'sketch', { to: [600, 80], duration: 1.2 }],
          [mark('outro-2', 'cheap'), 'bow'],
        ],
      });
      ANSWERS.forEach((answer, i) => {
        const thumbnail = M.diagram(s, { kind: answer.kind, x: answer.corner[0], y: answer.corner[1] - 48, w: 460, fit: { w: 432, h: 206 }, scale: 1.3, title: answer.title, spec: answer.spec });
        thumbnail.node.style.transformOrigin = '0 0';
        thumbnail.node.style.scale = String(THUMBNAIL);
        fx.fadeIn(thumbnail.node, outroAt() + 0.1 + i * 0.2, 0.3);
      });
    }

    intro();
    verse1();
    chorus('chorus-1', { cameo: 'right' });
    verse2();
    verse3();
    chorus('chorus-2', { recall: true, cameo: 'left' });
    verse4();
    verse5();
    verse6();
    chorus('chorus-3', { recall: true, finale: true });
    quiz();
    outro();
  };
})();
