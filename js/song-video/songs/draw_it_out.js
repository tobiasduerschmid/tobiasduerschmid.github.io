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
 * answer appears when the crowd sings it, after the quiz pause. Each line's `visual` text in the
 * storyboard describes this file.
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

      // "Just keep coding, we'll fix it later!"
      const a = kit.scene(content, 0.2, before('intro-2'), { exit: 'fade' });
      student?.appear({ from: 0.3, to: before('intro-2'), x: 60, y: 150, scale: 0.92 });
      S.speech(a, 'We’ll fix it later!', { x: 300, y: 104, at: mark('intro-1', 'coding'), tail: 'left' });
      // The notes pile up in a quick stagger, so each stays up long enough to read.
      [
        ['TODO: fix later', 600, 118, -6, 'yellow'],
        ['hack, sorry', 744, 150, 5, 'pink'],
        ['FIXME', 640, 240, 3, 'yellow'],
        ['refactor later?', 780, 270, -4, 'green'],
      ].forEach(([text, x, y, rotate, tone], i) => S.sticky(a, text, { x, y, at: mark('intro-1', 'just') + i * 0.25, rotate, tone }));

      // "Week one: peer-to-peer. Week nine: we need a server."
      const b = kit.scene(content, before('intro-2'), before('intro-3'), { exit: 'fade' });
      S.calendar(b, {
        x: 70, y: 90, at: line('intro-2').start,
        pages: [
          { at: 0, top: 'Week', big: '1' },
          { at: mark('intro-2', 'week_2'), top: 'Week', big: '9', tone: 'late' },
        ],
      });
      S.network(b, { x: 580, y: 250, r: 165, at: mark('intro-2', 'one'), linkAt: mark('intro-2', 'peer'), serverAt: mark('intro-2', 'server') });
      kit.sticker(b, 'Peer-to-peer', { x: 70, y: 260, at: mark('intro-2', 'peer_2'), variant: 'white', iconName: 'link', rotate: -3 });

      // "That first choice is a load-bearing wall now." The wall holds the
      // screen until "time", so its labels can be read.
      const draft = mark('intro-4', 'time');
      const c = kit.scene(content, before('intro-3'), draft - 0.15, { exit: 'fade' });
      S.section(c, {
        x: 330, y: 92, at: line('intro-3').start, label: 'peer-to-peer', labelAt: mark('intro-3', 'first'),
        weightAt: mark('intro-3', 'load'), crackAt: mark('intro-3', 'now'),
      });
      kit.sticker(c, 'Every floor rests on it', { x: 52, y: 160, at: mark('intro-3', 'first'), variant: 'gold', iconName: 'stack', rotate: -3 });
      kit.stamp(c, 'Load-bearing', { x: 60, y: 236, at: mark('intro-3', 'load'), rotate: -8, shake: false, from: 1.6 });

      // "This time, we draw it out first."
      const d = kit.scene(content, draft - 0.15, start('verse-1') + 0.6, { exit: 'fade' });
      S.section(d, { x: 330, y: 110, at: draft - 0.15, blueprint: true });
      S.pencil(d, {
        route: [[350, 156], [480, 106], [610, 156], [610, 376], [350, 376], [468, 300], [492, 368]],
        at: draft, duration: 1.3, until: mark('intro-4', 'first'),
      });
      kit.kinetic(d, [
        { text: 'Draw', at: mark('intro-4', 'draw'), color: 'gold', iconName: 'pencil' },
        { text: 'it out', at: mark('intro-4', 'out') },
        { text: 'first', at: mark('intro-4', 'first'), color: 'gold' },
      ], { y: 30, size: 54 });
    }

    // ----------------------------------------------------------------
    // Verse 1: a shared picture, a model, a cheap fix, a shared plan
    // ----------------------------------------------------------------

    function verse1() {
      badge('Verse 1 · Why we model', 'verse-1');
      const v = (n) => `verse-1-${n}`;

      // "Ask for a building" … "one notation for all of them": four teammates
      // picture four buildings, one house, four guesses, then one diagram.
      const team = kit.scene(content, start('verse-1'), before(v(4)), { exit: 'fade' });
      S.speech(team, 'Build us a building!', { x: 352, y: 34, at: mark(v(1), 'ask'), until: before(v(2)), tone: 'gold', tail: 'left' });
      // Each teammate's own building, the guess the vague sketch prompts, and
      // the words on which their bubble shows the house and the class box.
      const people = [
        { look: 'hoodie', x: 26, flip: false, own: 'tower', guess: 'shed', houseAt: 'all', guessAt: 'theyre', modelAt: 'one' },
        { look: 'curls', x: 176, flip: false, own: 'mall', guess: 'garage', houseAt: 'four', guessAt: 'theyre', modelAt: 'notation' },
        { look: 'beard', x: 654, flip: true, own: 'factory', guess: 'doghouse', houseAt: 'see', guessAt: 'lost', modelAt: 'for' },
        { look: 'hijab', x: 804, flip: true, own: 'museum', guess: 'warehouse', houseAt: 'one', guessAt: 'again', modelAt: 'all' },
      ];
      people.forEach((person, i) => {
        const ownAt = mark(v(1), person.own);
        const guessAt = mark(v(2), person.guessAt);
        const modelAt = mark(v(3), person.modelAt);
        S.teammate(team, {
          look: person.look, x: person.x, y: 300, size: 130, flip: person.flip, seed: i + 1,
          at: mark(v(1), 'four') + i * 0.1,
          moods: [[ownAt, 'think'], [mark(v(2), 'house'), 'happy'], [guessAt, 'puzzled'], [modelAt, 'happy']],
        });
        S.thought(team, {
          x: person.x - 8, y: 138, w: 146, h: 108, tail: person.flip ? 'right' : 'left', at: ownAt - 0.15,
          pictures: [
            { at: ownAt, kind: person.own },
            { at: mark(v(2), person.houseAt), kind: 'house' },
            { at: guessAt, kind: person.guess },
            { at: modelAt, kind: 'umlClass' },
          ],
          badges: [
            { at: mark(v(2), 'house'), until: mark(v(2), 'draw_2'), kind: 'check' },
            { at: guessAt, until: modelAt, kind: 'question' },
            { at: mark(v(3), 'them'), kind: 'check' },
          ],
        });
      });
      S.whiteboard(team, {
        x: 330, y: 132, w: 300, at: mark(v(2), 'draw') - 0.3,
        drawings: [
          { kind: 'house', at: mark(v(2), 'draw'), until: mark(v(2), 'draw_2') },
          { kind: 'vague', at: mark(v(2), 'vague') - 0.1, duration: 0.5, until: mark(v(3), 'uml') - 0.2 },
        ],
      });
      M.diagram(team, {
        kind: 'class', x: 346, y: 146, w: 268, fit: { w: 240, h: 160 }, scale: 1.2, tone: 'whiteboard', at: mark(v(3), 'uml'),
        spec: `@startuml
class House {
  - floors: int
  - rooms: int
  + build()
}
@enduml`,
      });
      kit.kinetic(team, [
        { text: 'U', at: mark(v(3), 'uml'), color: 'gold' },
        { text: 'M', at: mark(v(3), 'uml') + 0.12, color: 'gold' },
        { text: 'L', at: mark(v(3), 'uml') + 0.24, color: 'gold' },
      ], { y: 26, size: 58, until: before(v(4)) - 0.3 });
      const expansion = kit.el('div', 'subtitle is-staged', team, 'Unified Modeling Language');
      expansion.style.top = '96px';
      fx.rise(expansion, mark(v(3), 'unified'));

      // "A model leaves some details out on purpose: it shows the part your
      // question is about." The floor plan drops furniture, wiring, sizes,
      // and labels; the pipes stay and glow for the plumber's question.
      const plan = kit.scene(content, before(v(4)), before(v(6)), { exit: 'fade' });
      S.floorPlan(plan, {
        x: 260, y: 104, w: 440, at: line(v(4)).start - 0.1,
        hide: {
          furniture: mark(v(4), 'leaves'), wiring: mark(v(4), 'some'),
          sizes: mark(v(4), 'details'), labels: mark(v(4), 'out'),
        },
        focus: { layer: 'pipes', at: mark(v(5), 'part') },
      });
      // The plumber's question comes first: it decides what the plan keeps.
      S.speech(plan, 'Where do the pipes run?', { x: 676, y: 70, w: 210, at: mark(v(4), 'leaves'), tail: 'left', tone: 'gold' });
      kit.sticker(plan, 'Left out on purpose', { x: 24, y: 150, at: mark(v(4), 'out'), variant: 'white', iconName: 'eye', rotate: -3 });

      // "A flaw on paper? Rub it out, you're done." versus "A flaw in
      // shipped code? Rework for everyone."
      const handAt = line(v(8)).start + 0.3;
      const flaw = kit.scene(content, before(v(6)), handAt, { exit: 'fade' });
      kit.sticker(flaw, 'On paper', { x: 60, y: 70, at: mark(v(6), 'paper'), variant: 'white', iconName: 'pencil', rotate: -3 });
      S.paperFlaw(flaw, {
        x: 60, y: 120, at: line(v(6)).start, flawAt: mark(v(6), 'flaw'),
        eraseAt: mark(v(6), 'rub'), fixAt: mark(v(6), 'done'),
      });
      kit.sticker(flaw, 'One eraser: done', { x: 90, y: 360, at: mark(v(6), 'done') + 0.2, variant: 'green', iconName: 'check', rotate: 2 });
      kit.sticker(flaw, 'In shipped code', { x: 560, y: 70, at: mark(v(7), 'shipped'), variant: 'white', iconName: 'box', rotate: 3 });
      S.device(flaw, 'phone', { x: 640, y: 96, size: 180, at: mark(v(7), 'flaw') });
      const app = kit.place(kit.el('div', 'sk-app-label is-staged', flaw, 'Library app v1.0'), 730, 278);
      fx.fadeIn(app, mark(v(7), 'flaw') + 0.15, 0.2);
      kit.stamp(flaw, 'Shipped', { x: 446, y: 184, at: mark(v(7), 'shipped'), rotate: -10, shake: false, from: 1.5, small: true });
      S.bug(flaw, { route: [[708, 170], [770, 196], [716, 232], [784, 250]], at: mark(v(7), 'code'), duration: 2.2, size: 30 });
      people.forEach((person, i) => {
        S.teammate(flaw, {
          look: person.look, x: 548 + i * 84, y: 300, size: 78, flip: i > 1, seed: i + 5,
          at: mark(v(7), 'rework') + i * 0.06, moods: [[mark(v(7), 'rework'), 'worried']],
        });
      });
      kit.stamp(flaw, 'Rework for everyone', { x: 500, y: 404, at: mark(v(7), 'code'), rotate: -3, shake: false, from: 1.4, small: true });

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
      // Short rows, all in by "test", so the card can be read before the chorus.
      S.checklist(hand, {
        x: 360, y: 286, w: 250, title: 'Tested against the plan', at: mark(v(8), 'too'),
        rows: ['floors', 'rooms', 'build()'].map((text, i) => ({ text, at: mark(v(9), 'then') + i * 0.15, ok: true })),
      });
      kit.flow(hand, { from: [744, 360], to: [646, 360], bend: 0, color: 'cyan', at: mark(v(9), 'comes') });
    }

    // ----------------------------------------------------------------
    // Verse 2: the Class Diagram, part by part
    // ----------------------------------------------------------------

    function verse2() {
      badge('Verse 2 · Class Diagram', 'verse-2');
      const v = (n) => `verse-2-${n}`;
      const bookSpec = (copies) => `@startuml
class Book {
  - title: String
  - copies: ${copies}
  + borrow(m: Member)
  + getTitle(): String
}
@enduml`;

      // "Class Diagram, the code view: one box for every class, its name,
      // the attributes it stores, the operations you can ask."
      // Holds to the start of "Italic", so the "+ public" label can be read.
      const a = kit.scene(content, start('verse-2'), line(v(5)).start, { exit: 'fade' });
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
      const sheet = { x: 416, y: 112, w: 280, fit: { w: 252, h: 190 }, scale: 1.3 };
      const before1 = M.diagram(a, { kind: 'class', ...sheet, at: line(v(1)).start - 0.1, until: mark(v(3), 'free'), spec: bookSpec('Integer') });
      const after1 = M.diagram(a, { kind: 'class', ...sheet, spec: bookSpec('List<Copy>') });
      fx.fadeIn(after1.node, mark(v(3), 'free'), 0.3);
      kit.flow(a, { from: [392, 190], to: [414, 190], bend: 0, color: 'gold', at: mark(v(1), 'box') });
      const rows = (d, labels) => d.union(labels.map((label) => d.textBox(label)));
      const attributes = (d) => rows(d, ['title: String', d === before1 ? 'copies: Integer' : 'copies: List<Copy>']);
      const operations = (d) => rows(d, ['borrow(m: Member)', 'getTitle(): String']);
      // The three compartments stay marked together until "minus", a map of
      // the box to read back from.
      const minusAt = mark(v(3), 'minus');
      before1.ring(before1.textBox('Book'), { at: mark(v(2), 'name'), until: minusAt, pad: 6 });
      before1.callout(before1.textBox('Book'), 'name', { side: 'right', at: mark(v(2), 'name'), until: minusAt, gap: 74 });
      before1.ring(attributes(before1), { at: mark(v(2), 'attributes'), until: minusAt, pad: 4 });
      before1.callout(attributes(before1), 'attributes: what it stores', { side: 'right', at: mark(v(2), 'attributes'), until: minusAt, gap: 14 });
      before1.ring(operations(before1), { at: mark(v(2), 'operations'), until: minusAt, pad: 4 });
      before1.callout(operations(before1), 'operations: what you can ask', { side: 'right', at: mark(v(2), 'operations'), until: mark(v(3), 'private'), gap: 14 });
      source.mark(0, mark(v(2), 'name'), mark(v(2), 'attributes'));
      source.mark(2, mark(v(2), 'attributes'), mark(v(2), 'operations'));
      source.mark(3, mark(v(2), 'attributes'), mark(v(2), 'operations'));
      source.mark(4, mark(v(2), 'operations'), before(v(3)));
      source.mark(5, mark(v(2), 'operations'), before(v(3)));

      // "Minus means private: hidden, so it's free to change": the private
      // field changes from a count to a list; nothing outside depends on it.
      before1.band(signStrip(before1.textBox('title: String', '-'), before1.textBox('copies: Integer', '-')), { at: mark(v(3), 'minus'), tone: 'red' });
      before1.callout(attributes(before1), '− private', { side: 'right', at: mark(v(3), 'private'), tone: 'red', gap: 14 });
      const [lockX, lockY] = before1.stagePoint(attributes(before1), 'left');
      S.padlock(a, { x: lockX - 48, y: lockY - 22, size: 44, at: mark(v(3), 'hidden'), lockAt: mark(v(3), 'hidden') + 0.15 });
      source.rewrite(3, '        self.__copies = []', mark(v(3), 'free'));
      after1.ring(attributes(after1), { at: mark(v(3), 'free'), tone: 'red', pad: 4 });
      after1.callout(attributes(after1), 'changed: no one outside sees it', { side: 'right', at: mark(v(3), 'free'), tone: 'red', gap: 14 });

      // "plus means public: others call it, so its promise stays the same."
      after1.band(signStrip(after1.textBox('borrow(m: Member)', '+'), after1.textBox('getTitle(): String', '+')), { at: mark(v(4), 'plus'), tone: 'green' });
      after1.callout(operations(after1), '+ public: callers rely on it', { side: 'right', at: mark(v(4), 'plus') + 0.1, tone: 'green', gap: 14 });
      const [opsX, opsY] = after1.stagePoint(operations(after1), 'bottom');
      [['Catalog', 446], ['Checkout', 596]].forEach(([name, x], i) => {
        kit.sticker(a, name, { x, y: 396, at: mark(v(4), 'others') + i * 0.1, variant: 'cyan', iconName: 'user', rotate: i ? 3 : -3 });
        kit.flow(a, { from: [x + 50, 392], to: [opsX - 30 + i * 60, opsY + 6], bend: 0, color: 'cyan', at: mark(v(4), 'call') + i * 0.08 });
      });

      // "Italic name means abstract: you can't make a plain Shape. Hollow
      // triangle points to the parent: every Rectangle is a Shape."
      // The scene holds into "BookStore's an", so its last label can be read.
      const storesAt = mark(v(7), 'interface') - 0.2;
      const b = kit.scene(content, before(v(5)), storesAt, { exit: 'fade' });
      const shapes = M.diagram(b, {
        kind: 'class', x: 330, y: 92, w: 300, fit: { w: 272, h: 330 }, scale: 1.2, at: line(v(5)).start - 0.1,
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
      shapes.ring(shapes.textBox('Shape'), { at: mark(v(5), 'italic'), until: before(v(6)), pad: 3 });
      shapes.callout(shapes.textBox('Shape'), 'italic: abstract', { side: 'right', at: mark(v(5), 'abstract'), gap: 70 });
      M.code(b, { x: 40, y: 150, w: 230, title: 'main.py', at: mark(v(5), 'cant'), lines: ['s = Shape()'] });
      kit.stamp(b, 'No plain Shape', { x: 44, y: 236, at: mark(v(5), 'plain'), rotate: -6, shake: false, from: 1.5, small: true });
      const triangle = shapes.union(shapes.boxes((box, item) => item.tag === 'polygon'));
      shapes.ring(triangle, { at: mark(v(6), 'triangle'), pad: 6, tone: 'violet' });
      shapes.callout(triangle, 'points to the parent', { side: 'right', at: mark(v(6), 'points'), tone: 'violet', gap: 30 });
      shapes.callout(shapes.textBox('Rectangle'), 'every Rectangle is a Shape', { side: 'right', at: mark(v(6), 'parent') + 0.1, tone: 'violet', gap: 66 });

      // "BookStore's an interface: operations only, a contract to fulfill.
      // Dashed line, hollow triangle: implements. SQL store or memory store:
      // either will." Holds a moment into verse 3 for the last signature.
      const c = kit.scene(content, storesAt, end('verse-2') + 0.25, { exit: 'fade' });
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
      stores.ring(stores.textBox('«interface»'), { at: mark(v(7), 'interface'), until: before(v(8)), pad: 4 });
      const promised = rows(stores, ['getBook(id: Integer): Book', 'addBook(b: Book)']);
      stores.ring(promised, { at: mark(v(7), 'operations'), until: before(v(8)), pad: 4 });
      stores.callout(promised, 'operations only', { side: 'right', at: mark(v(7), 'operations'), until: mark(v(8), 'implements'), gap: 14 });
      S.contract(c, {
        x: 600, y: 112, w: 300, title: 'BookStore contract', at: mark(v(7), 'contract'),
        lines: ['getBook(id) → Book', 'addBook(b)'],
        signatures: [{ at: mark(v(8), 'sql'), name: 'SqlStore' }, { at: mark(v(8), 'memory'), name: 'MemoryStore' }],
      });
      // ArchUML joins both realizations into one dashed trunk under one hollow triangle.
      const realization = stores.union(stores.boxes((box, item) => item.tag === 'polygon' || item.node.hasAttribute('stroke-dasharray')));
      stores.ring(realization, { at: mark(v(8), 'dashed'), until: mark(v(8), 'sql') + 0.6, pad: 6, tone: 'violet' });
      stores.callout(realization, 'implements', { side: 'right', at: mark(v(8), 'implements'), tone: 'violet', gap: 14 });
      stores.ring('SqlStore', { at: mark(v(8), 'sql'), tone: 'green' });
      stores.ring('MemoryStore', { at: mark(v(8), 'memory'), tone: 'green' });
    }

    // ----------------------------------------------------------------
    // Verse 3: association, aggregation, composition
    // ----------------------------------------------------------------

    function verse3() {
      badge('Verse 3 · Class Diagram relationships', 'verse-3');
      const v = (n) => `verse-3-${n}`;
      const pair = (spec) => `@startuml\nlayout horizontal\n${spec}\n@enduml`;
      const diamond = (d) => d.union(d.boxes((box, item) => item.tag === 'polygon'));

      // "Lines between classes? Ask three questions, in order."
      // The relationships scene holds into "A reading list", so its last
      // label can be read.
      const listAt = mark(v(5), 'list');
      const a = kit.scene(content, start('verse-3'), listAt, { exit: 'fade' });
      S.questions(a, {
        x: 26, y: 92, w: 400, title: 'Lines between classes?', titleAt: mark(v(1), 'lines'),
        items: [
          { text: 'Does A reference B?', at: mark(v(2), 'does'), answer: 'association', answerAt: mark(v(2), 'association') },
          { text: 'Does A own B as a part?', at: mark(v(3), 'does'), answer: 'aggregation', answerAt: mark(v(3), 'aggregation') },
          { text: 'Can B not exist without A?', at: mark(v(4), 'can'), answer: 'composition', answerAt: mark(v(4), 'composition') },
        ],
      });
      kit.sticker(a, 'Three questions, in order', { x: 40, y: 380, at: mark(v(1), 'three'), variant: 'gold', iconName: 'list', rotate: -2 });

      // "Does A reference B? Association: a plain line, the arrow points at B."
      const q1 = M.diagram(a, {
        kind: 'class', x: 452, y: 92, w: 480, fit: { w: 452, h: 110 }, scale: 1.3, at: mark(v(2), 'association') - 0.3, until: before(v(3)),
        spec: pair('class A\nclass B\nA --> B'),
      });
      const b = q1.box('B');
      const head = { x: b.x - 18, y: b.y + b.h / 2 - 11, w: 18, h: 22 };
      q1.ring(head, { at: mark(v(2), 'arrow'), pad: 4, tone: 'teal' });
      q1.callout(head, 'A holds a reference to B', { side: 'below', at: mark(v(2), 'association'), tone: 'teal', gap: 16 });
      M.code(a, { x: 520, y: 290, w: 340, title: 'a.py', at: mark(v(2), 'association') + 0.2, until: before(v(3)), lines: ['class A:', '    b: B    # a field: the arrow'] });

      // "Does A own B as a part? Hollow diamond at the whole: aggregation, a
      // car and its wheels."
      const q2 = M.diagram(a, {
        kind: 'class', x: 452, y: 92, w: 480, fit: { w: 452, h: 110 }, scale: 1.3, at: mark(v(3), 'part'), until: mark(v(4), 'exist') - 0.1,
        spec: pair('class Car\nclass Wheel\nCar o-- "4" Wheel'),
      });
      q2.ring(diamond(q2), { at: mark(v(3), 'diamond'), pad: 5 });
      q2.callout(diamond(q2), 'hollow diamond at the whole', { side: 'below', at: mark(v(3), 'whole'), gap: 14 });
      S.car(a, { x: 570, y: 280, w: 240, at: mark(v(3), 'car'), until: mark(v(4), 'filled'), wheelsOffAt: mark(v(3), 'wheels') + 0.25 });
      kit.sticker(a, 'The wheels still exist', { x: 590, y: 410, at: mark(v(3), 'wheels'), until: mark(v(4), 'filled'), variant: 'white', iconName: 'check', rotate: 2 });

      // "Can B not exist without A? Filled diamond: composition. Delete the
      // whole, its parts go too."
      const q3 = M.diagram(a, {
        kind: 'class', x: 452, y: 92, w: 480, fit: { w: 452, h: 110 }, scale: 1.3, at: mark(v(4), 'exist'),
        spec: pair('class House\nclass Room\nHouse *-- "1..*" Room'),
      });
      q3.ring(diamond(q3), { at: mark(v(4), 'filled'), pad: 5, tone: 'red' });
      q3.callout(diamond(q3), 'filled: composition', { side: 'below', at: mark(v(4), 'composition'), tone: 'red', gap: 14 });
      // In the car's place once it has gone, in time for its rooms to be read.
      S.roomyHouse(a, { x: 600, y: 238, w: 220, at: mark(v(4), 'filled') + 0.25, demolishAt: mark(v(4), 'delete') });
      kit.sticker(a, 'Rooms go with the house', { x: 440, y: 410, at: mark(v(4), 'delete'), variant: 'red', iconName: 'trash', rotate: -2 });

      // "A reading list and its entries: filled diamond. Each entry points to
      // a book: delete the list, the entries go. The books stay on the shelf."
      const list = kit.scene(content, listAt - 0.3, end('verse-3'), { exit: 'fade' });
      const model = M.diagram(list, {
        kind: 'class', x: 120, y: 74, w: 720, fit: { w: 692, h: 104 }, scale: 1.3, at: mark(v(5), 'reading'),
        spec: pair('class ReadingList\nclass Entry\nclass Book\nReadingList "1" *-- "*" Entry\nEntry "*" --> "1" Book'),
      });
      model.ring(diamond(model), { at: mark(v(5), 'filled'), pad: 2, tone: 'red' });
      const book = model.box('Book');
      model.ring({ x: book.x - 20, y: book.y + book.h / 2 - 11, w: 20, h: 22 }, { at: mark(v(5), 'points'), pad: 4, tone: 'teal' });
      S.readingList(list, { x: 150, y: 236, w: 230, rows: ['Design Patterns', 'Clean Code', 'Refactoring'], at: mark(v(5), 'list'), goneAt: mark(v(6), 'delete') });
      // Five software-engineering classics; the list's entries point at three of them.
      const shelf = S.bookshelf(list, {
        x: 600, y: 222, at: mark(v(5), 'entries'), keepAt: mark(v(6), 'books'),
        books: [
          { title: ['Design', 'Patterns'], tone: 'cream', w: 44, h: 146 },
          { title: ['Clean Code'], tone: 'ink', w: 38, h: 128 },
          { title: ['Refactoring'], tone: 'red', w: 40, h: 136 },
          { title: ['The Pragmatic', 'Programmer'], tone: 'slate', w: 46, h: 142 },
          { title: ['The Mythical', 'Man-Month'], tone: 'teal', w: 46, h: 132 },
        ],
      });
      // Each entry's arrow lands on top of its own spine.
      [302, 335, 368].forEach((rowY, i) => {
        const { box } = shelf.spines[i];
        kit.flow(list, { from: [384, rowY], to: [box.x + box.w / 2, box.y - 8], bend: -40 + i * 10, color: 'cyan', at: mark(v(5), 'points') + i * 0.1, until: mark(v(6), 'delete') + 0.4 });
      });
      S.eraser(list, { x: 266, y: 330, at: mark(v(6), 'delete'), duration: 0.6, span: 120 });
      model.cross('ReadingList', { at: mark(v(6), 'list') });
      model.cross('Entry', { at: mark(v(6), 'entries') });
      model.ring('Book', { at: mark(v(6), 'books'), tone: 'green' });
      model.callout('Book', 'stays', { side: 'below', at: mark(v(6), 'stay'), tone: 'green', gap: 12 });
      kit.sticker(list, 'Still on the shelf', { x: 640, y: 418, at: mark(v(6), 'books'), variant: 'green', iconName: 'book', rotate: 2 });
    }

    // ----------------------------------------------------------------
    // Verse 4: the Sequence Diagram
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
      const runSheet = { kind: 'sequence', x: 190, y: 96, w: 746, fit: { w: 718, h: 318 }, scale: 1.6, spec: RUN };

      // "Sequence Diagram: one example run, top to bottom, in time. client
      // colon Client: the object, then its class, over a dashed lifeline."
      // The fragments take over right after "carries on", which gives the
      // alt frame, the first and fullest of three, a little more time.
      const fragmentsAt = mark(v(4), 'on') + 0.15;
      const a = kit.scene(content, start('verse-4'), fragmentsAt, { exit: 'fade' });
      const d = M.diagram(a, { ...runSheet, at: line(v(1)).start - 0.1 });
      S.timeArrow(a, { x: 112, y: 120, h: 280, at: mark(v(1), 'top') });
      const header = d.box('client: Client');
      const solidAt = mark(v(3), 'solid');
      d.ring(d.textBox('client: Client', 'client'), { at: mark(v(2), 'client'), until: solidAt, pad: 3, tone: 'teal' });
      d.callout(d.textBox('client: Client', 'client'), 'object', { side: 'above', at: mark(v(2), 'object'), until: solidAt, tone: 'teal', gap: 12, dx: -10 });
      d.ring(d.textBox('client: Client', 'Client'), { at: mark(v(2), 'class'), until: solidAt, pad: 3, tone: 'violet' });
      d.callout(d.textBox('client: Client', 'Client'), 'class', { side: 'above', at: mark(v(2), 'class'), until: solidAt, tone: 'violet', gap: 12, dx: 14 });
      const lifeline = { x: header.x + header.w / 2 - 7, y: header.y + header.h + 4, w: 14, h: d.view.y + d.view.h - header.y - header.h - 24 };
      d.ring(lifeline, { at: mark(v(2), 'over'), until: mark(v(3), 'synchronous'), pad: 3, round: 7 });
      d.callout(lifeline, 'lifeline', { side: 'right', at: mark(v(2), 'over'), until: mark(v(3), 'synchronous'), gap: 10, dy: -36 });

      // "Solid line, filled head: synchronous, the caller waits till it's
      // done, till the dashed reply comes back."
      const call = d.routeOf('getBook(42)');
      const reply = d.routeOf('book');
      d.ring(d.union(d.boxes((box, item) => item.route === call)), { at: mark(v(3), 'solid'), until: mark(v(4), 'open'), pad: 5 });
      d.callout(d.textBox('getBook(42)'), 'filled head: synchronous', { side: 'below', at: mark(v(3), 'synchronous'), until: mark(v(4), 'open'), gap: 14, dx: -24 });
      d.token(call, { at: mark(v(3), 'synchronous') + 0.2, duration: 0.5, until: mark(v(3), 'done') });
      d.token(d.routeOf('find(42)'), { at: mark(v(3), 'done') - 0.1, duration: 0.4, until: mark(v(4), 'dashed') });
      d.token(d.routeOf('row'), { at: mark(v(4), 'the'), duration: 0.4, until: mark(v(4), 'reply'), tone: 'teal' });
      d.token(reply, { at: mark(v(4), 'reply'), duration: 0.6, until: mark(v(4), 'back') + 0.4, tone: 'teal' });
      const waitTop = d.stagePoint(d.union(d.boxes((box, item) => item.route === call)), 'left');
      // Between the time arrow and the sheet, beside the waiting caller.
      S.hourglass(a, { x: 148, y: waitTop[1] - 4, size: 56, at: mark(v(3), 'waits'), doneAt: mark(v(4), 'back'), hideAt: mark(v(4), 'open') + 0.2 });
      // The wait sits on the caller's own lifeline, from the call to its reply.
      const callSpan = d.union(d.boxes((box, item) => item.route === call));
      const replySpan = d.union(d.boxes((box, item) => item.route === reply));
      const waiting = { x: header.x + header.w / 2 - 12, y: callSpan.y, w: 24, h: replySpan.y + replySpan.h - callSpan.y };
      d.band(waiting, { at: mark(v(3), 'caller'), until: mark(v(4), 'open'), tone: 'red' });
      d.callout(waiting, 'caller waits', { side: 'right', at: mark(v(3), 'caller'), until: mark(v(4), 'open'), tone: 'red', gap: 8, dy: 14 });
      d.callout(d.textBox('book'), 'dashed: the reply', { side: 'below', at: mark(v(4), 'till'), until: mark(v(4), 'open'), tone: 'teal', gap: 8 });

      // "Open head: asynchronous. It sends and carries on."
      const async = d.routeOf('viewed(42)');
      d.ring(d.union(d.boxes((box, item) => item.route === async)), { at: mark(v(4), 'open'), pad: 5, tone: 'green' });
      d.callout(d.textBox('viewed(42)'), 'open head: asynchronous', { side: 'below', at: mark(v(4), 'asynchronous'), tone: 'green', gap: 22 });
      const asyncPath = d.path(async).map(([px, py]) => d.stagePoint({ x: px, y: py, w: 0, h: 0 }, 'center'));
      S.paperPlane(a, { route: asyncPath, at: mark(v(4), 'asynchronous') + 0.2, duration: 0.7 });

      // "Alt is if-else: one branch runs. Opt is if: once or none. Loop
      // repeats while its guard is true: for each book, till we're done."
      // The same client and server stay put and only the frame around their
      // messages changes, drawn large enough to read its guard. Each
      // fragment's code card stacks up beside it, so all three stay
      // comparable after their diagrams have gone.
      const chainAt = mark(v(7), 'who') + 0.1;
      const b = kit.scene(content, fragmentsAt, chainAt + 0.3, { exit: 'fade' });
      const fragmentSheet = { kind: 'sequence', x: 24, y: 60, scale: 1.1 };
      const optAt = mark(v(5), 'opt') - 0.1;
      const loopAt = mark(v(6), 'loop') - 0.1;
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
      // The singer says what each one means; the cards only pair keyword and code.
      const altCode = M.code(b, { ...cards, y: 60, title: 'alt = if / else', at: fragmentsAt + 0.15, lines: ['if found: reply(book)', 'else: reply(404)'] });
      const optCode = M.code(b, { ...cards, y: 172, title: 'opt = if', at: optAt + 0.15, lines: ['if logged_in:', '    borrow(42)'] });
      const loopCode = M.code(b, { ...cards, y: 284, title: 'loop = for / while', at: loopAt + 0.15, lines: ['for book in books:', '    renew(book.id)'] });
      // Each guard lights up with the condition it stands for in the code.
      alt.ring(alt.textBox('[found]'), { at: mark(v(5), 'one'), pad: 4 });
      altCode.mark(0, mark(v(5), 'one'), optAt);
      opt.ring(opt.textBox('[logged in]'), { at: mark(v(5), 'if_2'), pad: 4 });
      optCode.mark(0, mark(v(5), 'if_2'), loopAt);
      loop.ring(loop.textBox('[for each book]'), { at: mark(v(6), 'guard'), pad: 4 });
      loopCode.mark(0, mark(v(6), 'guard'));
      const renew = loop.routeOf('renew(id)');
      [0, 1, 2].forEach((i) => loop.token(renew, { at: mark(v(6), 'repeats') + i * 0.8, duration: 0.5, until: mark(v(6), 'repeats') + i * 0.8 + 0.6, label: `#${i + 1}` }));

      // "Who waits on whom? That's where bottlenecks hide."
      // Holds until verse 5's "machine", so its last label can be read.
      const c = kit.scene(content, chainAt, mark('verse-5-1', 'machine'), { exit: 'fade' });
      const chain = M.diagram(c, { ...runSheet, title: 'Who waits on whom?', at: chainAt });
      const clientBox = chain.box('client: Client');
      const serverBox = chain.box('server: Server');
      const callBox = chain.union(chain.boxes((box, item) => item.route === chain.routeOf('getBook(42)')));
      const replyBox = chain.union(chain.boxes((box, item) => item.route === chain.routeOf('book')));
      const innerCall = chain.union(chain.boxes((box, item) => item.route === chain.routeOf('find(42)')));
      const innerReply = chain.union(chain.boxes((box, item) => item.route === chain.routeOf('row')));
      chain.band({ x: clientBox.x + clientBox.w / 2 - 14, y: callBox.y, w: 28, h: replyBox.y + replyBox.h - callBox.y }, { at: mark(v(7), 'waits'), tone: 'red' });
      chain.band({ x: serverBox.x + serverBox.w / 2 - 14, y: innerCall.y, w: 28, h: innerReply.y + innerReply.h - innerCall.y }, { at: mark(v(7), 'whom'), tone: 'red' });
      chain.ring('db: Database', { at: mark(v(7), 'who') + 0.4, tone: 'red' });
      chain.callout('db: Database', 'slow? everyone above waits', { side: 'below', at: mark(v(7), 'who') + 0.4, tone: 'red', gap: 200 });
    }

    // ----------------------------------------------------------------
    // Verse 5: the State Machine Diagram
    // ----------------------------------------------------------------

    function verse5() {
      badge('Verse 5 · State Machine Diagram', 'verse-5');
      const v = (n) => `verse-5-${n}`;
      const LATE = 'day passes [today > due] / send reminder';

      // "State Machine Diagram: one object and the states it moves through.
      // Black dot: the start. Rounded boxes: Available, Borrowed, Overdue."
      // Verse 4's last scene holds until "machine"; the machine itself holds
      // half a second into the last line, so the takeaways can be read.
      const machineAt = mark(v(1), 'machine');
      const fnAt = line(v(8)).start + 0.5;
      const a = kit.scene(content, machineAt, fnAt, { exit: 'fade' });
      const d = M.diagram(a, {
        kind: 'state', x: 20, y: 74, w: 920, fit: { w: 892, h: 210 }, scale: 1.2, at: machineAt,
        spec: `@startuml
[*] --> Available
Available --> Borrowed : borrow / set due date
Borrowed --> Available : return
Borrowed --> Overdue : ${LATE}
Overdue --> Available : return / charge fee
@enduml`,
      });
      S.libraryBook(a, {
        x: 44, y: 292, size: 96, at: mark(v(1), 'object'), dueAt: mark(v(4), 'due'), dueText: 'DAY 8',
        states: [
          { at: 0, text: 'Available', tone: 'green' },
          { at: mark(v(4), 'borrowed'), text: 'Borrowed', tone: 'gold' },
          { at: mark(v(5), 'overdue') + 0.4, text: 'Overdue', tone: 'red' },
          { at: mark(v(6), 'available_2') + 0.6, text: 'Available', tone: 'green' },
        ],
      });
      d.marker([
        { at: mark(v(1), 'states'), to: 'Available' },
        { at: mark(v(4), 'borrow'), to: 'Borrowed', via: d.routeOf('borrow / set due date') },
        { at: mark(v(5), 'overdue'), to: 'Overdue', via: d.routeOf(LATE) },
        { at: mark(v(6), 'available_2'), to: 'Available', via: d.routeOf('return / charge fee'), duration: 1.1 },
      ], { label: '#42' });
      const start0 = d.union(d.boxes((box, item) => item.tag === 'circle'));
      d.ring(start0, { at: mark(v(2), 'dot'), until: before(v(3)), pad: 6, round: 14 });
      d.callout(start0, 'start', { side: 'below', at: mark(v(2), 'dot'), until: mark(v(3), 'each'), gap: 12 });
      for (const [state, word] of [['Available', 'available'], ['Borrowed', 'borrowed'], ['Overdue', 'overdue']]) {
        d.ring(state, { at: mark(v(2), word), until: before(v(3)), tone: 'teal' });
      }

      // "Each arrow's a transition. Event: when! If! Slash, action: do!" (the
      // take drops the shouted "Guard:"; the cards still name all three parts)
      const late = d.routeOf(LATE);
      const setAt = mark(v(4), 'set');
      d.ring(d.union(d.boxes((box, item) => item.route === late && item.tag !== 'text')), { at: mark(v(3), 'transition'), until: setAt, pad: 6 });
      S.labelParts(a, {
        x: 200, y: 330, at: mark(v(3), 'event'), until: setAt,
        parts: [
          { text: 'day passes', meaning: 'event: when', at: mark(v(3), 'event'), tone: 'event' },
          { text: '[today > due]', meaning: 'guard: if', at: mark(v(3), 'if'), tone: 'guard' },
          { text: '/ send reminder', meaning: 'action: do', at: mark(v(3), 'slash'), tone: 'action' },
        ],
      });
      d.ring(d.textBox(LATE, 'day passes'), { at: mark(v(3), 'event'), until: setAt, pad: 3, tone: 'teal' });
      d.ring(d.textBox(LATE, '[today > due]'), { at: mark(v(3), 'if'), until: setAt, pad: 3 });
      d.ring(d.textBox(LATE, '/ send reminder'), { at: mark(v(3), 'slash'), until: setAt, pad: 3, tone: 'violet' });

      // "Borrow, slash, set the due date: now it's Borrowed. A day passes: is
      // the due date past? If yes, Overdue. If no, it holds fast."
      d.ring(d.textBox('borrow / set due date', '/ set due date'), { at: mark(v(4), 'set'), until: mark(v(5), 'day'), pad: 3, tone: 'violet' });
      S.calendar(a, {
        x: 790, y: 300, at: mark(v(4), 'due'),
        pages: [{ at: 0, top: 'Day', big: '8' }, { at: mark(v(5), 'passes') + 0.2, top: 'Day', big: '9', tone: 'late' }],
      });
      d.ring(d.textBox(LATE, '[today > due]'), { at: mark(v(5), 'past'), until: before(v(6)), pad: 3 });
      // The guard's answer sits right under the guard it answers.
      const guard = d.textBox(LATE, '[today > due]');
      d.callout(guard, '9 > 8: yes → Overdue', { side: 'below', at: mark(v(5), 'past'), until: mark(v(6), 'return'), tone: 'red', gap: 12 });
      d.callout(guard, 'no → stays Borrowed', { side: 'below', at: mark(v(5), 'if_2'), until: mark(v(6), 'available'), tone: 'white', gap: 44 });

      // "Return from Borrowed: Available. From Overdue: Available, plus a fee."
      d.token(d.routeOf('return'), { at: mark(v(6), 'return'), duration: 0.7, until: mark(v(6), 'from_2'), tone: 'teal' });
      d.ring(d.textBox('return'), { at: mark(v(6), 'return'), until: mark(v(6), 'from_2'), pad: 3, tone: 'teal' });
      d.ring(d.textBox('return / charge fee'), { at: mark(v(6), 'from_2'), until: mark(v(7), 'same'), pad: 3 });
      S.coin(a, { x: 150, y: 300, at: mark(v(6), 'fee') });

      // "Same event, different action: the state decides. That's the key."
      d.ring(d.textBox('return'), { at: mark(v(7), 'same'), pad: 3, tone: 'teal' });
      d.ring(d.textBox('return / charge fee', 'return'), { at: mark(v(7), 'same'), pad: 3, tone: 'teal' });
      // The three takeaways sit in one row right under the diagram.
      kit.sticker(a, 'Same event: return', { x: 40, y: 226, at: mark(v(7), 'same'), variant: 'cyan', iconName: 'resend', rotate: -2 });
      d.ring(d.textBox('return / charge fee', '/ charge fee'), { at: mark(v(7), 'different'), pad: 3, tone: 'violet' });
      kit.sticker(a, 'Different action: / charge fee', { x: 290, y: 226, at: mark(v(7), 'different'), variant: 'violet', iconName: 'cash', rotate: 2 });
      d.ring('Borrowed', { at: mark(v(7), 'action'), tone: 'red' });
      d.ring('Overdue', { at: mark(v(7), 'action'), tone: 'red' });
      kit.sticker(a, 'The current state decides', { x: 620, y: 226, at: mark(v(7), 'action'), variant: 'gold', iconName: 'key', rotate: -2 });

      // "Reacts the same, whatever came before? Then skip the State Machine Diagram."
      const b = kit.scene(content, fnAt, line('verse-6-1').start + 0.3, { exit: 'fade' });
      S.functionMachine(b, {
        x: 80, y: 150, name: 'to_fahrenheit(c)', at: fnAt,
        runs: [
          { at: fnAt + 0.1, input: '100', output: '212' },
          { at: fnAt + 0.9, input: '100', output: '212' },
        ],
      });
      kit.sticker(b, 'Same input, same answer, every time', { x: 80, y: 356, at: fnAt + 0.2, variant: 'cyan', iconName: 'loop', rotate: -2 });
      const pointless = M.diagram(b, {
        kind: 'state', x: 520, y: 140, w: 360, fit: { w: 332, h: 150 }, scale: 1.2, at: mark(v(8), 'then'),
        spec: `@startuml
[*] --> Ready
Ready --> Ready : convert
@enduml`,
      });
      pointless.cross(pointless.union(pointless.boxes(() => true)), { at: mark(v(8), 'skip') });
      kit.sticker(b, 'No history? Skip it.', { x: 560, y: 330, at: mark(v(8), 'then'), variant: 'red', iconName: 'cross', rotate: 2 });
    }

    // ----------------------------------------------------------------
    // Verse 6: the Component Diagram
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

      // "Component Diagram: zoom out to the run-time view, parts you deploy
      // and run on their own, not classes: client, server, database too."
      // Verse 5's last scene holds until just after this line starts.
      const verse6At = line(v(1)).start + 0.3;
      const a = kit.scene(content, verse6At, before(v(3)), { exit: 'fade' });
      // The code view shrinks into the client through "to the run-time
      // view", so its classes are up long enough to recognize first.
      const zoomAt = mark(v(1), 'out') + 0.4;
      const runtime = M.diagram(a, { ...wide, spec: RUNTIME('Database') });
      fx.fadeIn(runtime.node, zoomAt, 0.4);
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
      kit.sticker(a, 'Run-time view: running parts', { x: 330, y: 250, at: mark(v(1), 'view'), until: mark(v(2), 'not'), variant: 'gold', iconName: 'gear', rotate: -2 });
      const devices = [['Client', 'laptop'], ['LibraryServer', 'server'], ['Database', 'database']].map(([name, kind], i) => {
        const [dx, dy] = runtime.stagePoint(name, 'bottom');
        return S.device(a, kind, { x: dx - 48, y: dy + 30, size: 96, at: mark(v(2), 'deploy') + i * 0.15 });
      });
      kit.sticker(a, 'Each one runs on its own', { x: 330, y: 398, at: mark(v(2), 'own'), variant: 'green', iconName: 'bolt', rotate: 2 });
      kit.sticker(a, 'Not classes', { x: 60, y: 398, at: mark(v(2), 'not'), variant: 'red', iconName: 'cross', rotate: -3 });
      [['Client', 'client'], ['LibraryServer', 'server'], ['Database', 'database']].forEach(([name, word], i) => {
        runtime.ring(name, { at: mark(v(2), word), tone: 'teal' });
        fx.bump(devices[i], mark(v(2), word), 0.12);
      });

      // "The ball's a provided interface: what I offer. The socket's a
      // required interface: what I need."
      const b = kit.scene(content, before(v(3)), end('verse-6'), { exit: 'fade' });
      const first = M.diagram(b, { ...wide, at: line(v(3)).start - 0.1, until: mark(v(7), 'swap'), spec: RUNTIME('Database') });
      const second = M.diagram(b, { ...wide, spec: RUNTIME('CloudDB') });
      fx.fadeIn(second.node, mark(v(7), 'swap'), 0.3);
      const balls = first.boxes((box, item) => item.tag === 'circle').sort((p, q) => p.x - q.x);
      const sockets = first.boxes((box, item) => item.tag === 'path').sort((p, q) => p.x - q.x);
      first.ring(balls[0], { at: mark(v(3), 'provided'), until: mark(v(4), 'ball'), pad: 4, round: 14, tone: 'green' });
      first.callout(balls[0], 'provided: “I offer”', { side: 'below', at: mark(v(3), 'offer'), until: mark(v(4), 'ball'), tone: 'green', gap: 30, dx: -46 });
      first.ring(sockets[0], { at: mark(v(3), 'sockets'), until: mark(v(4), 'ball'), pad: 4, round: 14 });
      first.callout(sockets[0], 'required: “I need”', { side: 'above', at: mark(v(3), 'required'), until: mark(v(4), 'ball'), gap: 12 });

      // "Ball in socket, they snap: the client needs it, the server provides."
      // The plug holds through "An interface is a", until the contract card takes its place.
      S.plug(b, {
        x: 270, y: 262, w: 420, at: mark(v(4), 'ball'), until: mark(v(5), 'contract') - 0.1, snapAt: mark(v(4), 'snap'),
        labels: { left: 'Client needs', leftAt: mark(v(4), 'needs'), right: 'Server provides', rightAt: mark(v(4), 'provides') },
      });

      // "An interface is a contract: what you can ask, not how it works
      // inside. Get book, add book: all the client sees. The database? Out of
      // sight: swap it behind the interface, and the client code's still right."
      const terms = S.contract(b, {
        x: 330, y: 262, w: 300, title: 'Books interface', at: mark(v(5), 'contract'), until: mark(v(7), 'swap') - 0.1,
        lines: ['getBook(id) → Book', 'addBook(b)'],
      });
      const [getLine, addLine] = terms.querySelectorAll('li');
      fx.bump(getLine, mark(v(6), 'get'), 0.18);
      fx.bump(addLine, mark(v(6), 'add'), 0.18);
      first.band(first.box('LibraryServer'), { at: mark(v(5), 'inside'), until: mark(v(7), 'swap'), tone: 'violet' });
      first.callout('LibraryServer', 'inside: hidden', { side: 'above', at: mark(v(5), 'not'), until: mark(v(6), 'sees'), tone: 'violet', gap: 10 });
      // Beside the interface card it describes.
      kit.sticker(b, 'All the client sees', { x: 100, y: 300, at: mark(v(6), 'sees'), until: mark(v(7), 'swap'), variant: 'cyan', iconName: 'eye', rotate: -3 });
      first.dim(first.within('Database'), { from: mark(v(6), 'database') });
      first.callout('Database', 'out of sight', { side: 'below', at: mark(v(6), 'database'), until: mark(v(7), 'swap'), tone: 'white', gap: 12 });
      const oldDb = S.device(b, 'database', { x: 740, y: 280, size: 100, at: mark(v(7), 'swap') - 0.4 });
      tween(oldDb, { translate: '0 120px', opacity: 0 }, mark(v(7), 'swap'), 0.5, window.Timeline.EASE.in);
      const newDb = S.device(b, 'database', { x: 740, y: 280, size: 100, at: mark(v(7), 'behind'), className: 'sk-device--cloud' });
      tween(newDb, [{ translate: '0 -60px' }, { translate: '0 0' }], mark(v(7), 'behind'), 0.4, window.Timeline.EASE.out);
      second.ring('CloudDB', { at: mark(v(7), 'interface'), tone: 'teal' });
      second.ring('Client', { at: mark(v(7), 'and'), tone: 'green' });
      second.callout('Client', 'unchanged: still right', { side: 'below', at: mark(v(7), 'and'), tone: 'green', gap: 30 });
      M.code(b, { x: 40, y: 300, w: 360, title: 'client.py', at: mark(v(7), 'and'), lines: ['book = books.get_book(42)'] });
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

    function chorus(id, { recall = false, finale = false } = {}) {
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
     * The diagrams some questions are about, keyed by question number: each
     * draws on the question's scene and changes when its answer is sung.
     */
    const QUIZ_FIGURES = {
      // "Your diagram skips the database. Mistake?"
      1(s, entry) {
        M.diagram(s, {
          kind: 'component', ...QUIZ_SHEET, title: 'Pizza app: components', at: entry.start,
          spec: quizPart('component App {\n  require "Orders" as r1\n}\ncomponent Server {\n  provide "Orders" as p1\n}\nr1 --> p1'),
        });
        S.device(s, 'database', { x: 760, y: 330, size: 84, at: mark('quiz-1', 'database') });
        kit.sticker(s, 'Not in the diagram', { x: 560, y: 360, at: mark('quiz-1', 'database'), variant: 'white', rotate: -2 });
      },
      // "Delete a customer, but keep their orders. Filled diamond?"
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
      // "Your payment provider, same interface: does the app change?"
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
      kit.badge(hud, 'Pop quiz · Think, then shout it', start('quiz-intro'), end('quiz'));
      const intro = kit.scene(content, start('quiz-intro'), line('quiz-1').start - 0.1, { exit: 'fade' });
      kit.kinetic(intro, [{ text: 'Pop quiz!', at: mark('quiz-intro-1', 'pop'), color: 'gold', iconName: 'question' }], { y: 150, size: 80 });
      // The cards name the pizza app; the intro only asks for answers.
      const cue = kit.el('div', 'subtitle is-staged', intro, 'Think, then shout it!');
      cue.style.top = '262px';
      fx.rise(cue, mark('quiz-intro-1', 'pop'));

      // Each card holds its question and, once the crowd sings it, the
      // answer, until the next card whips in over it. The player's quiz
      // pause stops each card before its answer.
      const { lines } = song.storyboard.sections.find((section) => section.id === 'quiz');
      lines.forEach((entry, i) => {
        const from = entry.start - 0.15;
        const to = i + 1 < lines.length ? lines[i + 1].start + 0.3 : outroAt();
        const s = kit.scene(content, from, to, { enter: 'whip' });
        const figure = QUIZ_FIGURES[i + 1];
        const card = kit.el('div', `quiz-card dio-quiz-card${figure ? ' dio-quiz-card--figure' : ''}`, s);
        kit.el('div', 'quiz-count', card, `Quiz ${i + 1} / ${lines.length}`);
        kit.el('div', 'dio-quiz-label', card, 'Pizza app');
        kit.el('div', 'quiz-question', card, entry.text);
        const answer = kit.el('div', 'quiz-answer is-staged', card);
        answer.append(kit.icon(QUIZ_ICONS[i]));
        answer.append(document.createTextNode(entry.answer));
        fx.slam(answer, entry.answer_at, { from: 1.6 });
        window.Timeline.camera.punch(entry.answer_at + 0.05, 0.03);
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
      ], { y: 196, size: 64 });
      const cheap = kit.el('div', 'subtitle is-staged', s, 'while it’s cheap to change');
      cheap.style.top = '290px';
      fx.rise(cheap, mark('outro-1', 'cheap'));
      ANSWERS.forEach((answer, i) => {
        const thumbnail = M.diagram(s, { kind: answer.kind, x: answer.corner[0], y: answer.corner[1] - 48, w: 460, fit: { w: 432, h: 206 }, scale: 1.3, title: answer.title, spec: answer.spec });
        thumbnail.node.style.transformOrigin = '0 0';
        thumbnail.node.style.scale = String(THUMBNAIL);
        fx.fadeIn(thumbnail.node, outroAt() + 0.1 + i * 0.2, 0.3);
      });
    }

    intro();
    verse1();
    chorus('chorus-1');
    verse2();
    verse3();
    chorus('chorus-2', { recall: true });
    verse4();
    verse5();
    verse6();
    chorus('chorus-3', { recall: true, finale: true });
    quiz();
    outro();
  };
})();
