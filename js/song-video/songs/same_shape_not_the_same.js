/*
 * Choreography for "Same Shape, Not the Same", the design patterns musical
 * (storyboard: _data/songs/same_shape_not_the_same.yml).
 *
 * Every visual hits a sung word: `mark(lineId, word)` is that word's time in
 * the recording. The teaching rule: show exactly what the line says, one idea
 * at a time. The story plays on a Broadway stage (review-stage.js) as a code
 * review: the intern's pull request calls a State a Strategy, and the lead
 * answers with three rounds in which two patterns that look alike explain
 * what each is for. Each pattern's structure is real ArchUML notation on the
 * upstage screen (model-kit.js), drawn as large as the screen allows; the
 * food app, the price tags each rival hangs on the other, the rulings, and
 * the quiz are pattern-kit.js pieces. The marquee over the screen names the
 * pattern of every verse, and a name plate glows over each singer.
 *
 * The cast are the singers of opera-cast.js, all dressed as developers: the
 * intern is the viewer's own hero in a blue hoodie, the lead a plum hoodie,
 * and each round's twins wear the same outfit (the shared shape) under
 * different name plates and with different props (what each one is for):
 * teal quarter-zips with headphones, charcoal hoodies, green hoodies. Every figure sings its own lines
 * and joins the crowd's. Each round's twins stand in the room's two side
 * spotlights through their ruling, and the judge of the ruling steps in
 * between them, centre stage; everyone lines up for the final chorus.
 *
 * Layout: 960×540 stage; the screen is ReviewStage.SCREEN, the section badge
 * sits top-left, stickers and badges that sum up a line sit on the stage floor
 * under the screen, and nothing essential goes below y = 460, where the
 * player draws captions.
 */
(function () {
  'use strict';

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.same_shape_not_the_same = function choreograph({ song, kit, layers, student }) {
    const C = window.OperaCast;
    const M = window.ModelKit;
    const P = window.PatternKit;
    const { SCREEN: S, FLOOR } = window.ReviewStage;
    const { content, hud } = layers;
    const line = (id) => song.line(id);
    const mark = (id, word) => song.mark(id, word);
    const start = (id) => song.sectionStart(id);
    const end = (id) => song.sectionEnd(id);
    // Stickers and badges that sum up a line stand on the floor under the screen.
    const SILL = S.y + S.h + 12;

    // ----------------------------------------------------------------
    // The cast
    // ----------------------------------------------------------------

    const LEFT = 100;
    const RIGHT = 860;
    const SCALE = 0.8;
    // The judge of a ruling stands centre stage between the two rivals, a
    // step upstage (smaller), below the verdict on the screen.
    const CENTER = 480;
    const JUDGE = 0.6;
    const PLATE_Y = 182;
    const VOICE = {
      intern: 'Intern', lead: 'Lead', strategy: 'Strategy', state: 'State',
      adapter: 'Adapter', facade: 'Façade', observer: 'Observer', mediator: 'Mediator',
    };
    const COSTUME = {
      intern: 'hero', lead: 'maintainer', strategy: 'tenor', state: 'tenor',
      adapter: 'backend', facade: 'backend', observer: 'coder', mediator: 'coder',
    };
    const FEMININE = new Set(['lead', 'strategy', 'adapter', 'mediator']);
    const plan = Object.fromEntries(Object.keys(VOICE).map((who) => [who, { stage: [], places: [], moves: [], holds: [] }]));
    const enter = (who, from, to, enterFrom, exitTo) => plan[who].stage.push([from, to, { enter: enterFrom, exit: exitTo }]);
    const place = (who, t, x, scale = SCALE, duration = 0.8) => plan[who].places.push([t, x, FLOOR, scale, duration]);
    const move = (who, t, name, options = {}) => plan[who].moves.push([t, name, options]);
    const hold = (who, t, side, prop) => plan[who].holds.push([t, side, prop]);
    const screenAt = (fx, fy) => [S.x + fx * S.w, S.y + fy * S.h];

    // One look per character for the whole song: a random human hero, with
    // the generator's no-facial-hair styles for the voices sung by a woman.
    const look = (feminine) => (avatar) => {
      const pick = (values) => values[Math.floor(Math.random() * values.length)];
      const state = avatar.randomAvatar(null, 'human');
      if (feminine) {
        const { hairStylesWithoutFacialHair, eyelashStylesWithoutFacialHair } = avatar.RANDOM_TRAIT_POLICY.facialHairCompatibility;
        state.appearance.hairStyle = pick(hairStylesWithoutFacialHair.filter((style) => avatar.ENUMS.hairStyle.includes(style)));
        state.appearance.eyelashStyle = pick(eyelashStylesWithoutFacialHair.filter((style) => avatar.ENUMS.eyelashStyle.includes(style)));
        state.appearance.facialHair = 'none';
      }
      return avatar.normalizeAvatar(state);
    };

    function badge(text, from, to) {
      kit.badge(hud, text, from, to);
    }

    // The marquee names what is on stage; each sign stays up until the next.
    const signs = [];
    const sign = (text, at) => signs.push([at, text]);

    /**
     * The two twins of a round: on stage, in their spotlights, under their
     * name plates, through their ruling; each bows as the crowd shouts its name.
     */
    function twins(a, b, { aAt, bAt, exitAt, aNamed, bNamed }) {
      enter(a, aAt, exitAt, 'left', 'left');
      enter(b, bAt, exitAt, 'right', 'right');
      place(a, 0, LEFT);
      place(b, 0, RIGHT);
      P.nameplate(content, VOICE[a], { x: LEFT, y: PLATE_Y, at: aAt + 0.5, until: exitAt });
      P.nameplate(content, VOICE[b], { x: RIGHT, y: PLATE_Y, at: bAt + 0.5, until: exitAt });
      move(a, aNamed, 'bow', { hold: 0.9 });
      move(b, bNamed, 'bow', { hold: 0.9 });
    }

    /** The judge of a ruling: walks on to centre stage while `who` is off, and back to `home` after. */
    function judge(who, { from, to, home, homeAt, enterFrom }) {
      place(who, from - 3, CENTER, JUDGE, 0.01);
      enter(who, from, to, enterFrom, enterFrom);
      place(who, homeAt, home, SCALE, 1);
    }

    /**
     * A price tag dropped on the chest of a rival standing at x, and the
     * crowd's "Ooh!" above them. The tags are drawn after the cast, so a
     * singer never hides a tag's words.
     */
    const tags = [];
    function roast(x, text, at, oohAt) {
      const side = x < CENTER ? 1 : -1;
      tags.push(() => P.priceTag(content, text, { x: x - 78, y: 292, at, until: at + 4.2, rotate: side * 3 }));
      P.ooh(content, { x: x - 55, y: 78, at: oohAt, until: oohAt + 1.4 });
    }

    /**
     * A sheet as large as the screen allows (its drawing never above
     * `scale`); `below` keeps room under the drawing for callouts there.
     */
    function wide(parent, spec, { at, until, title, kind = 'class', scale = 1.2, top = 4, h = S.h - 8, below = 0 }) {
      const fitH = h - 28 - (title ? 22 : 0) - below;
      const sheet = M.diagram(parent, { kind, spec, x: S.x + 4, y: S.y + top, w: S.w - 8, fit: { w: S.w - 36, h: fitH }, scale, title, at, until });
      sheet.body.style.paddingBottom = `${below}px`;
      return sheet;
    }

    // A judge walks on just before each ruling; the scene before it is gone
    // by then, so no singer ever crosses a card or sticker with words on it.
    const clearFor = (rulingId) => start(rulingId) - 1;

    /**
     * The points of the drawn connector from one class to another, or a
     * straight drop from the first box to the second if ArchUML drew none.
     */
    function route(diagram, from, to) {
      let id = null;
      diagram.boxes((box, item) => {
        if (!id && item.route && item.source === from && item.target === to) id = item.route;
        return false;
      });
      if (id) return diagram.path(id);
      const a = diagram.box(from);
      const b = diagram.box(to);
      return [[a.x + a.w / 2, a.y + a.h], [b.x + b.w / 2, b.y]];
    }

    // ArchUML specs: each pattern's structure, and the look-alikes the song
    // compares. ArchUML stacks a class chain top to bottom.
    const SPEC = {
      statusTwin: `@startuml
layout vertical
class Order
interface OrderStatus
class Placed
class Cooking
Order o--> OrderStatus
Placed ..|> OrderStatus
Cooking ..|> OrderStatus
@enduml`,
      splitTwin: `@startuml
layout vertical
class Checkout
interface SplitRule
class Even
class ByItem
Checkout o--> SplitRule
Even ..|> SplitRule
ByItem ..|> SplitRule
@enduml`,
      payment: `@startuml
layout vertical
class Checkout
interface Payment {
  + pay(total)
}
class CardPayment
class WalletPayment
Checkout --> Payment
CardPayment ..|> Payment
WalletPayment ..|> Payment
@enduml`,
      split: (extra) => `@startuml
layout vertical
class Checkout
interface SplitRule {
  + split(bill)
}
class Even
class ByItem
class OneTreats
${extra ? 'class ByPercent\n' : ''}Checkout o--> SplitRule
Even ..|> SplitRule
ByItem ..|> SplitRule
OneTreats ..|> SplitRule
${extra ? 'ByPercent ..|> SplitRule\n' : ''}@enduml`,
      stage: `@startuml
layout vertical
class Order
interface Stage
class Placed
class Cooking
class OnTheWay
Order o--> Stage
Placed ..|> Stage
Cooking ..|> Stage
OnTheWay ..|> Stage
@enduml`,
      stageMachine: `@startuml
[*] --> Placed
Placed --> Cooking : kitchen starts
Cooking --> OnTheWay : driver picks up
@enduml`,
      adapter: `@startuml
layout vertical
interface Kitchen {
  + send(order)
}
class TabletAdapter {
  + send(order)
}
class Tablet {
  + ticket(cents)
}
TabletAdapter ..|> Kitchen
TabletAdapter --> Tablet : converts
@enduml`,
      tangle: `@startuml
layout vertical
class Phone
class Web
class Payment
class Kitchen
class Driver
class Receipt
Phone --> Payment
Phone --> Kitchen
Phone --> Driver
Phone --> Receipt
Web --> Payment
Web --> Kitchen
Web --> Driver
Web --> Receipt
@enduml`,
      facade: `@startuml
layout vertical
class Phone
class Web
class OrderFacade
class Payment
class Kitchen
class Driver
class Receipt
Phone --> OrderFacade
Web --> OrderFacade
OrderFacade --> Payment
OrderFacade --> Kitchen
OrderFacade --> Driver
OrderFacade --> Receipt
@enduml`,
      observer: (watch) => `@startuml
layout vertical
class Order
interface Observer {
  + update(status)
}
class Phone
class Tablet
class DriverApp
${watch ? 'class Watch\n' : ''}Order o--> Observer : followers
Phone ..|> Observer
Tablet ..|> Observer
DriverApp ..|> Observer
${watch ? 'Watch ..|> Observer\n' : ''}@enduml`,
      mesh: `@startuml
layout vertical
class Kitchen
class Drivers
class Customer
Kitchen --> Drivers
Drivers --> Customer
Customer --> Kitchen
Kitchen --> Customer
Drivers --> Kitchen
@enduml`,
      hub: `@startuml
layout vertical
class Kitchen
class Drivers
class Customer
class DispatchHub {
  + notify(event)
}
Kitchen --> DispatchHub
Drivers --> DispatchHub
Customer --> DispatchHub
@enduml`,
      exporter: (formats) => `@startuml
layout vertical
class Exporter
interface Format {
  + write(report)
}
${formats.map((f) => `class ${f}`).join('\n')}
Exporter --> Format
${formats.map((f) => `${f} ..|> Format`).join('\n')}
@enduml`,
    };

    // ----------------------------------------------------------------
    // Intro: the pull request
    // ----------------------------------------------------------------

    function intro() {
      badge('Intro · Code review', 0.4, start('verse-1'));
      sign('Same shape', 0.6);
      enter('intern', 0.8, start('chorus-1') + 7, 'left', 'left');
      place('intern', 0, LEFT);
      enter('lead', mark('intro-4', 'review') - 0.2, start('chorus-1') + 7, 'right', 'right');
      place('lead', 0, RIGHT);

      // "Internship, week one: a food-delivery app. I know all twenty-three patterns!"
      const splash = kit.scene(content, mark('intro-1', 'food') - 0.2, mark('intro-3', 'first') - 0.1, { exit: 'fade' });
      const logo = P.card(splash, { x: S.x + 154, y: S.y + 96, w: 280, at: mark('intro-1', 'food'), tone: 'splash' });
      P.row(logo.body, 'Night Bites', { at: mark('intro-1', 'food'), tone: 'title' });
      P.row(logo.body, 'Late-night food delivery', { at: mark('intro-1', 'delivery') });
      const brag = P.card(splash, { x: S.x + 352, y: S.y + 34, w: 190, at: mark('intro-2', 'twenty'), tone: 'gold' });
      P.row(brag.body, '23 / 23 patterns', { at: mark('intro-2', 'twenty'), tone: 'title' });
      move('intern', mark('intro-2', 'know') - 0.1, 'chest', { hold: 1, pats: 2 });

      // "First PR: 'Order status, Strategy pattern.'" The pull request and
      // its class diagram: an order and its family of statuses.
      const prAt = mark('intro-3', 'first');
      const pr = kit.scene(content, prAt - 0.1, start('verse-1') + 0.3, { exit: 'fade' });
      const request = P.pr(pr, { x: S.x + 6, y: S.y + 6, w: 290, parts: ['Order status:', 'Strategy', 'pattern'], at: prAt });
      M.diagram(request.body, { kind: 'class', spec: SPEC.statusTwin, x: 0, y: 0, w: 262, fit: { w: 234, h: 206 }, scale: 1, at: mark('intro-3', 'order') });
      move('intern', mark('intro-3', 'pr'), 'present', { to: screenAt(0.25, 0.3), hold: 1.6 });

      // "Review comes back: That's not Strategy. That's State."
      P.review(pr, {
        x: S.x + 312, y: S.y + 70, w: 268, at: mark('intro-4', 'review'), until: mark('intro-6', 'same') - 0.1,
        lines: [
          { text: 'That’s not Strategy.', at: mark('intro-5', 'thats') },
          { text: 'That’s State.', at: mark('intro-5', 'thats_2'), tone: 'title' },
        ],
      });
      request.strike(1, mark('intro-5', 'strategy'));
      move('lead', mark('intro-5', 'not') - 0.1, 'point', { to: screenAt(0.24, 0.12), hold: 1.6 });

      // "Same shape, sure. But not the same." A Strategy beside it draws the
      // same boxes and arrows.
      M.diagram(pr, {
        kind: 'class', spec: SPEC.splitTwin, x: S.x + 306, y: S.y + 6, w: 276, fit: { w: 248, h: 236 }, scale: 1,
        title: 'A Strategy', at: mark('intro-6', 'same'),
      });
      kit.sticker(pr, 'Same boxes, same arrows', { x: S.x + 170, y: SILL, at: mark('intro-6', 'shape'), variant: 'gold', rotate: -2 });
      kit.stamp(pr, 'Changes requested', { x: S.x + 30, y: S.y + 150, at: mark('intro-6', 'not'), color: 'red', small: true, shake: false, from: 1.5, rotate: -8 });
      move('lead', mark('intro-6', 'not') - 0.1, 'finger', { hold: 1.2 });
      move('intern', mark('intro-6', 'same') - 0.1, 'mood', { hold: 2.4, brow: 0.8, smile: -0.3, look: 0.6 });
    }

    // ----------------------------------------------------------------
    // Verse 1: what a pattern is
    // ----------------------------------------------------------------

    function verse1() {
      const v = (n) => `verse-1-${n}`;
      badge('Verse 1 · What is a pattern?', start('verse-1'), start('chorus-1'));
      sign('Design patterns', line(v(1)).start - 0.4);

      // "A pattern's a fix for a problem that comes back, named, so one word
      // gives the team the plan of attack": three apps, one problem, one name.
      const a = kit.scene(content, line(v(1)).start - 0.2, line(v(3)).start - 0.1, { exit: 'fade' });
      ['Food app', 'Music app', 'Game'].forEach((name, i) => {
        const c = P.card(a, { x: S.x + 18 + i * 190, y: S.y + 18, w: 172, title: name, at: mark(v(1), 'a') + i * 0.18 });
        P.row(c.body, 'When this changes, tell the others', { at: mark(v(1), 'problem') + i * 0.2, tone: 'note' });
      });
      const named = P.card(a, { x: S.x + 144, y: S.y + 150, w: 300, title: 'One name for the whole plan', at: mark(v(2), 'named'), tone: 'rule' });
      P.row(named.body, 'Observer', { at: mark(v(2), 'word'), tone: 'title' });
      P.row(named.body, 'problem · roles · price', { at: mark(v(2), 'plan') });
      move('lead', mark(v(2), 'team') - 0.1, 'present', { to: screenAt(0.5, 0.65), hold: 1.6 });

      // "not code to copy: roles, and a price to track."
      const b = kit.scene(content, line(v(3)).start - 0.1, line(v(4)).start - 0.1, { exit: 'fade' });
      const copy = M.code(b, { x: S.x + 14, y: S.y + 40, w: 284, title: 'copy_paste.py', lines: ['class Observer:', '    def update(self): ...'], at: mark(v(3), 'code') });
      P.strike(copy.node, mark(v(3), 'copy'));
      const roles = P.card(b, { x: S.x + 316, y: S.y + 30, w: 256, title: 'Roles', at: mark(v(3), 'roles') });
      P.row(roles.body, 'who holds what', { at: mark(v(3), 'roles') });
      P.row(roles.body, 'who calls whom', { at: mark(v(3), 'roles') + 0.2 });
      P.priceTag(b, '+ classes · + hops to trace', { x: S.x + 330, y: S.y + 150, at: mark(v(3), 'price'), rotate: -4 });

      // "Lots of patterns hide the part that's likely to change behind an
      // interface, so the rest won't rearrange."
      const c = kit.scene(content, line(v(4)).start - 0.1, line(v(6)).start - 0.1, { exit: 'fade' });
      const hide = wide(c, SPEC.payment, { at: mark(v(4), 'lots'), scale: 1.1 });
      hide.ring(hide.union([hide.box('CardPayment'), hide.box('WalletPayment')]), { at: mark(v(4), 'likely'), tone: 'amber' });
      hide.callout('WalletPayment', 'likely to change', { side: 'right', at: mark(v(4), 'change'), tone: 'amber' });
      hide.ring('Payment', { at: mark(v(5), 'interface'), tone: 'violet' });
      hide.callout('Payment', 'the interface', { side: 'right', at: mark(v(5), 'interface'), tone: 'violet' });
      hide.callout('Checkout', 'stays the same', { side: 'right', at: mark(v(5), 'rest'), tone: 'green' });
      move('lead', mark(v(5), 'behind') - 0.1, 'point', { to: screenAt(0.5, 0.45), hold: 1.6 });

      // "When two draw the same boxes, don't go by the frame: the boxes show
      // how; the problem gives the name."
      const d = kit.scene(content, line(v(6)).start - 0.1, start('chorus-1') + 0.2, { exit: 'fade' });
      const pair = { kind: 'class', y: S.y + 4, w: 286, fit: { w: 258, h: 242 }, scale: 1 };
      M.diagram(d, { ...pair, spec: SPEC.splitTwin, x: S.x + 4, title: 'Strategy', at: mark(v(6), 'two') });
      M.diagram(d, { ...pair, spec: SPEC.statusTwin, x: S.x + 298, title: 'State', at: mark(v(6), 'draw') });
      kit.sticker(d, 'The boxes show how', { x: S.x + 40, y: SILL, at: mark(v(7), 'show'), variant: 'white', rotate: -2 });
      kit.sticker(d, 'The problem gives the name', { x: S.x + 290, y: SILL, at: mark(v(7), 'problem'), variant: 'gold', rotate: 2 });
      move('lead', mark(v(7), 'problem') - 0.1, 'operatic', { hold: 1.4 });
      move('intern', mark(v(7), 'name'), 'thumbs', { hold: 1.2 });
    }

    // ----------------------------------------------------------------
    // Choruses
    // ----------------------------------------------------------------

    /** The chorus's chant on the screen, then the round's card. */
    function chant(sectionId, n, round) {
      const id = (k) => `${sectionId}-${k}`;
      const phrases = [
        { text: 'Same shape?', at: mark(id(1), 'same'), color: 'gold' },
        { text: 'Not the same!', at: mark(id(1), 'not') },
        { text: 'What’s it for?', at: mark(id(2), 'whats'), color: 'gold' },
        { text: 'That’s the name!', at: mark(id(2), 'thats') },
      ];
      sign('Same shape?', start(sectionId));
      if (round) {
        badge('Chorus', start(sectionId), mark(id(3), 'round'));
        const a = kit.scene(content, line(id(1)).start - 0.2, mark(id(3), 'round') - 0.1, { exit: 'fade' });
        phrases.forEach((phrase, i) => kit.kinetic(a, [phrase], { y: S.y + 26 + i * 64, size: 46 }));
        const b = kit.scene(content, mark(id(3), 'round') - 0.1, end(sectionId) + 0.5, { exit: 'fade' });
        P.roundCard(b, { n, a: round[0], b: round[1], at: mark(id(3), 'round') });
      } else {
        // The final chorus: the whole cast lines up below, so the chant stays high.
        badge('Final chorus', start(sectionId), end(sectionId));
        const a = kit.scene(content, line(id(1)).start - 0.2, end(sectionId) + 0.3, { exit: 'fade' });
        kit.kinetic(a, phrases.slice(0, 2), { y: S.y + 36, size: 32 });
        kit.kinetic(a, phrases.slice(2), { y: S.y + 96, size: 32 });
      }
    }

    // ----------------------------------------------------------------
    // Round 1: Strategy and State
    // ----------------------------------------------------------------

    function round1() {
      const exitAt = line('interlude-1').start - 0.1;
      twins('strategy', 'state', {
        aAt: mark('chorus-1-3', 'strategy') - 0.3, bAt: mark('chorus-1-3', 'state') - 0.2, exitAt,
        aNamed: mark('ruling-1-1', 'strategy'), bNamed: mark('ruling-1-2', 'state'),
      });
      badge('Round 1 · Strategy vs. State', start('strategy') - 0.2, end('ruling-1'));

      // Strategy: "one job, a few ways to get through. Split the check:
      // even, by item, one treats the crew." The app's options, and the bill
      // each one splits.
      const s = (n) => `strategy-${n}`;
      sign('Strategy', line(s(1)).start - 0.3);
      move('strategy', mark(s(1), 'strategy') - 0.1, 'present', { to: screenAt(0.2, 0.4), hold: 1.2 });
      const a = kit.scene(content, line(s(1)).start - 0.2, mark(s(3), 'class') - 0.05, { exit: 'fade' });
      const app = P.phone(a, { x: S.x + 26, y: S.y + 2, w: 190, h: 296, at: mark(s(1), 'job') });
      P.sheetTitle(app, 'Split the check', { at: mark(s(2), 'split') });
      P.toggles(app, ['Even', 'By item', 'One treats'], { at: mark(s(2), 'even'), every: 0.42, pick: 1, pickAt: mark(s(2), 'crew') });
      const bill = P.card(a, { x: S.x + 240, y: S.y + 34, w: 326, title: 'Bill $60 · three friends', at: mark(s(1), 'few') });
      P.row(bill.body, 'Even: $20 · $20 · $20', { at: mark(s(2), 'even') });
      P.row(bill.body, 'By item: $12 · $18 · $30', { at: mark(s(2), 'item') });
      P.row(bill.body, 'One treats: $60 · $0 · $0', { at: mark(s(2), 'treats') });
      P.row(bill.body, 'Same job, three ways', { at: mark(s(2), 'crew'), tone: 'title' });

      // "Each way's a class, and they all fit one interface; checkout calls
      // the one you picked: no switch, no case."
      const b = kit.scene(content, mark(s(3), 'class') - 0.1, line('state-1').start - 0.1, { exit: 'fade' });
      const plain = wide(b, SPEC.split(false), { at: mark(s(3), 'class') - 0.1, until: mark(s(5), 'add') - 0.05, below: 40 });
      ['Even', 'ByItem', 'OneTreats'].forEach((name, i) => {
        plain.ring(name, { at: mark(s(3), 'class') + i * 0.15, until: mark(s(3), 'interface'), tone: 'green' });
      });
      plain.ring('SplitRule', { at: mark(s(3), 'interface'), until: mark(s(4), 'calls'), tone: 'violet' });
      plain.callout('SplitRule', 'one interface', { side: 'right', at: mark(s(3), 'interface'), until: mark(s(4), 'calls'), tone: 'violet' });
      plain.token(route(plain, 'Checkout', 'SplitRule'), { at: mark(s(4), 'calls'), duration: 0.5, until: mark(s(4), 'picked') + 0.1 });
      plain.ring('ByItem', { at: mark(s(4), 'picked'), tone: 'amber' });
      plain.callout('ByItem', 'the one you picked', { side: 'below', at: mark(s(4), 'picked'), tone: 'amber' });
      kit.sticker(b, 'No switch, no case', { x: S.x + 200, y: SILL, at: mark(s(4), 'switch'), until: mark(s(5), 'add'), variant: 'gold', rotate: -3 });
      move('strategy', mark(s(3), 'class') - 0.1, 'point', { to: screenAt(0.6, 0.45), hold: 1.4 });

      // "New way next week? Add a class. (Checkout? Untouched!)"
      const grown = wide(b, SPEC.split(true), { at: mark(s(5), 'add'), below: 40 });
      grown.ring('ByPercent', { at: mark(s(5), 'class'), tone: 'green' });
      grown.callout('ByPercent', 'new class', { side: 'below', at: mark(s(5), 'class'), tone: 'green' });
      P.diffBadge(b, 'checkout.py · 0 lines changed', { x: S.x + 166, y: SILL, at: mark(s(5), 'untouched') });
      move('strategy', mark(s(5), 'untouched'), 'thumbs', { hold: 1 });

      // "And State, your stages gossip: each one knows the next. (Ooh!)"
      move('strategy', mark(s(6), 'state') - 0.1, 'wag', { hold: 1.6, side: 'right', times: 3 });
      roast(RIGHT, 'Stages know each other', mark(s(6), 'knows'), mark(s(6), 'next'));
      move('state', mark(s(6), 'gossip'), 'mood', { hold: 1.6, brow: 0.9, smile: -0.4 });

      // State: "that PR's mine: taps depend on the stage. Cancel while it's
      // placed? Full refund. Cooking? Half. On the way? Too late. Edit,
      // Track, and Rate shift too;"
      const t = (n) => `state-${n}`;
      sign('State', line(t(1)).start - 0.2);
      move('state', mark(t(1), 'mine') - 0.1, 'chest', { hold: 0.8, pats: 1 });
      const c = kit.scene(content, line(t(1)).start - 0.1, line(t(5)).start - 0.05, { exit: 'fade' });
      const order = P.phone(c, { x: S.x + 26, y: S.y + 2, w: 190, h: 296, at: mark(t(1), 'taps'), until: line(t(4)).start - 0.1 });
      P.sheetTitle(order, 'Your order', { at: mark(t(1), 'taps') + 0.1 });
      P.tracker(order, {
        stages: ['Placed', 'Cooking', 'On the way'], at: mark(t(1), 'stage'),
        moves: [[mark(t(1), 'stage'), 0], [mark(t(2), 'cooking'), 1], [mark(t(3), 'way'), 2]],
      });
      P.buttons(order, ['Cancel'], { at: mark(t(2), 'cancel'), tone: 'alert' });
      P.results(order, [
        { at: mark(t(2), 'refund'), text: 'Full refund', tone: 'green' },
        { at: mark(t(2), 'half'), text: 'Half refund', tone: 'gold' },
        { at: mark(t(3), 'late'), text: 'Too late', tone: 'red' },
      ]);
      P.buttons(order, ['Edit', 'Track', 'Rate'], { at: mark(t(3), 'edit'), every: 0.3 });
      const rules = P.card(c, { x: S.x + 240, y: S.y + 30, w: 326, title: 'Tap Cancel while it’s…', at: mark(t(2), 'cancel'), until: line(t(4)).start - 0.05 });
      P.row(rules.body, 'Placed: full refund', { at: mark(t(2), 'refund'), tone: 'green' });
      P.row(rules.body, 'Cooking: half', { at: mark(t(2), 'half') });
      P.row(rules.body, 'On the way: too late', { at: mark(t(3), 'late'), tone: 'red' });
      P.row(rules.body, 'Edit, Track, Rate: by stage too', { at: mark(t(3), 'shift'), tone: 'note' });
      move('state', mark(t(2), 'cancel') - 0.1, 'point', { to: screenAt(0.14, 0.5), hold: 2.2 });

      // "if-else in every button? Nah. Here's what I do:"
      M.code(c, {
        x: S.x + 64, y: S.y + 50, w: 460, title: 'order.py',
        lines: ['def cancel(self):', '    if self.stage == "placed": ...', '    elif self.stage == "cooking": ...', '    # …again in edit, track, rate'],
        at: mark(t(4), 'if'),
      });
      kit.stamp(c, 'Nah', { x: S.x + 400, y: S.y + 180, at: mark(t(4), 'nah'), color: 'red', small: true, shake: false, from: 1.5, rotate: -10 });
      move('state', mark(t(4), 'nah') - 0.1, 'stop', { hold: 1 });

      // "each stage gets a class, with its own rule for each tap; order
      // delegates;"
      const d = kit.scene(content, line(t(5)).start - 0.05, mark(t(6), 'its') + 0.1, { exit: 'fade' });
      const classes = wide(d, SPEC.stage, { at: line(t(5)).start });
      ['Placed', 'Cooking', 'OnTheWay'].forEach((name, i) => {
        classes.ring(name, { at: mark(t(5), 'class') + i * 0.15, until: mark(t(6), 'order'), tone: 'green' });
      });
      classes.ring('Stage', { at: mark(t(5), 'rule'), tone: 'violet' });
      classes.callout('Stage', 'cancel() · edit() · track() · rate()', { side: 'right', at: mark(t(5), 'tap'), tone: 'violet' });
      classes.ring('Order', { at: mark(t(6), 'order'), tone: 'amber' });
      classes.token(route(classes, 'Order', 'Stage'), { at: mark(t(6), 'delegates'), duration: 0.5 });
      classes.callout('Order', 'delegates every tap', { side: 'right', at: mark(t(6), 'delegates'), tone: 'amber' });
      move('state', mark(t(5), 'class') - 0.1, 'point', { to: screenAt(0.5, 0.3), hold: 1.4 });

      // "its stage rolls it down the track." The order's stages as a state
      // machine, the current one lit as it moves on.
      const e = kit.scene(content, mark(t(6), 'its'), clearFor('ruling-1'), { exit: 'fade' });
      const machine = M.diagram(e, {
        kind: 'state', spec: SPEC.stageMachine, x: S.x + 4, y: S.y + 96, w: S.w - 8, fit: { w: S.w - 36, h: 120 }, scale: 1,
        title: 'The order’s stages', at: mark(t(6), 'its'),
      });
      machine.ring('Placed', { at: mark(t(6), 'stage'), until: mark(t(6), 'rolls') + 0.25, tone: 'amber' });
      machine.ring('Cooking', { at: mark(t(6), 'rolls') + 0.25, until: mark(t(6), 'track'), tone: 'amber' });
      machine.ring('OnTheWay', { at: mark(t(6), 'track'), tone: 'green' });

      // "Strategy? Callers need your whole menu to choose. (Ooh!)"
      move('state', mark(t(7), 'strategy') - 0.1, 'point', { to: [LEFT + 10, 300], hold: 1.6 });
      roast(LEFT, 'Callers must know every option', mark(t(7), 'callers'), mark(t(7), 'choose'));
      move('strategy', mark(t(7), 'menu'), 'shrug', { hold: 1.2 });
    }

    /**
     * A ruling on the screen: two questions, each answered by the crowd with
     * a name, over the judge at centre stage, who points to each in turn.
     */
    function ruling(sectionId, { judge: who, title, left, right, footer, signText }) {
      sign(signText, start(sectionId));
      const scene = kit.scene(content, start(sectionId) - 0.2, end(sectionId) + 0.4, { exit: 'fade' });
      const card = P.verdict(scene, {
        x: S.x + 12, y: S.y + 8, w: S.w - 24, title,
        left: { q: left.q, name: left.name, ask: left.ask, at: left.at },
        right: { q: right.q, name: right.name, ask: right.ask, at: right.at },
        at: start(sectionId) - 0.1,
      });
      if (footer) card.footer(footer.text, footer.at);
      move(who, left.ask, 'point', { to: screenAt(0.27, 0.35), hold: 1.6 });
      move(who, right.ask, 'point', { to: screenAt(0.73, 0.35), hold: 1.6 });
      return card;
    }

    function ruling1() {
      judge('lead', {
        from: start('ruling-1') - 0.9, to: start('chorus-2') + 5.4, enterFrom: 'right',
        home: RIGHT, homeAt: end('ruling-1') - 0.3,
      });
      ruling('ruling-1', {
        judge: 'lead', title: 'The ruling', signText: 'The ruling',
        left: { q: 'One job, a few ways to do it?', name: 'Strategy', ask: line('ruling-1-1').start, at: mark('ruling-1-1', 'strategy') },
        right: { q: 'What it does depends on the stage?', name: 'State', ask: line('ruling-1-2').start, at: mark('ruling-1-2', 'state') },
        footer: { text: 'Who picks? Just a clue. The problem decides.', at: mark('ruling-1-3', 'clue') },
      });
      move('lead', mark('ruling-1-3', 'problem'), 'finger', { hold: 1.2 });
    }

    // ----------------------------------------------------------------
    // Interlude: the intern sees it
    // ----------------------------------------------------------------

    function interlude() {
      const i = (n) => `interlude-${n}`;
      badge('Interlude', start('interlude'), end('interlude'));
      enter('intern', line(i(1)).start - 0.1, start('chorus-2') + 5.4, 'left', 'left');
      sign('PR #1', line(i(1)).start - 0.2);
      const scene = kit.scene(content, line(i(1)).start - 0.3, start('chorus-2') + 0.2, { exit: 'fade' });
      const request = P.pr(scene, { x: S.x + 134, y: S.y + 6, w: 320, parts: ['Order status:', 'Strategy', 'pattern'], at: line(i(1)).start + 0.3 });
      M.diagram(request.body, { kind: 'class', spec: SPEC.statusTwin, x: 0, y: 0, w: 292, fit: { w: 264, h: 222 }, scale: 1, at: line(i(1)).start + 0.6 });
      request.swap(1, 'State', mark(i(1), 'state'));
      kit.stamp(scene, 'Approved', { x: S.x + 330, y: S.y + 190, at: mark(i(2), 'im'), color: 'green', small: true, shake: false, from: 1.5, rotate: -8 });
      move('intern', mark(i(1), 'state') - 0.1, 'mood', { hold: 1.2, brow: 0.8, smile: 0.6 });
      move('intern', mark(i(2), 'in') - 0.2, 'thumbs', { hold: 1.2 });
    }

    // ----------------------------------------------------------------
    // Round 2: Adapter and Façade
    // ----------------------------------------------------------------

    function round2() {
      const exitAt = mark('ruling-2-4', 'intern') - 0.3;
      twins('adapter', 'facade', {
        aAt: mark('chorus-2-3', 'adapter') - 0.3, bAt: mark('chorus-2-3', 'facade') - 0.3, exitAt,
        aNamed: mark('ruling-2-2', 'adapter'), bNamed: mark('ruling-2-3', 'facade'),
      });
      hold('adapter', mark('chorus-2-3', 'adapter'), 'left', 'wrench');
      badge('Round 2 · Adapter vs. Façade', start('adapter') - 0.2, end('ruling-2'));

      // Adapter: "New spot's tablet won't take our call: we say 'order'; it
      // wants 'ticket,' in cents and all."
      const d = (n) => `adapter-${n}`;
      sign('Adapter', line(d(1)).start - 0.3);
      move('adapter', mark(d(1), 'adapter') - 0.1, 'present', { to: screenAt(0.3, 0.4), hold: 1.2 });
      const a = kit.scene(content, line(d(1)).start - 0.2, line(d(3)).start - 0.05, { exit: 'fade' });
      const ours = P.card(a, { x: S.x + 16, y: S.y + 40, w: 250, title: 'Our app says', at: mark(d(1), 'our') });
      P.row(ours.body, 'order(total=12.50)', { at: mark(d(2), 'order'), code: true });
      P.devices(a, [{ kind: 'tablet', label: 'New spot’s tablet', at: mark(d(1), 'tablet'), react: '✗ won’t take it', reactTone: 'red', reactAt: mark(d(1), 'call') }], { x: S.x + 380, y: S.y + 24, size: 64 });
      const theirs = P.card(a, { x: S.x + 300, y: S.y + 160, w: 270, title: 'Their tablet wants', at: mark(d(2), 'wants') });
      P.row(theirs.body, 'ticket(cents=1250)', { at: mark(d(2), 'ticket'), code: true });

      // "Outside, I'm the interface our app knows; inside, I call theirs,
      // converting as I go."
      const b = kit.scene(content, line(d(3)).start - 0.1, line('facade-1').start - 0.1, { exit: 'fade' });
      const notation = wide(b, SPEC.adapter, { at: mark(d(3), 'outside'), scale: 1.1 });
      notation.ring('Kitchen', { at: mark(d(3), 'interface'), tone: 'violet' });
      notation.callout('Kitchen', 'outside: what our app calls', { side: 'right', at: mark(d(3), 'app'), tone: 'violet' });
      notation.ring('TabletAdapter', { at: mark(d(4), 'inside'), tone: 'amber' });
      notation.callout('TabletAdapter', 'inside: converts each call', { side: 'right', at: mark(d(4), 'converting'), tone: 'amber' });
      notation.ring('Tablet', { at: mark(d(4), 'theirs'), tone: 'teal' });
      notation.callout('Tablet', 'their code', { side: 'right', at: mark(d(4), 'theirs'), tone: 'teal' });
      notation.token(route(notation, 'TabletAdapter', 'Tablet'), { at: mark(d(4), 'converting'), duration: 0.6, label: '1250¢' });
      move('adapter', mark(d(4), 'inside') - 0.1, 'point', { to: screenAt(0.5, 0.55), hold: 1.6 });

      // "(Our code? Untouched!) (Their code? Untouched!)"
      P.diffBadge(b, 'our app · 0 lines changed', { x: S.x + 20, y: SILL, at: mark(d(5), 'untouched') });
      P.diffBadge(b, 'their tablet · 0 lines changed', { x: S.x + 300, y: SILL, at: mark(d(5), 'untouched_2') });

      // "Façade, keep adding chores and you're a god-class door. (Ooh!)"
      move('adapter', mark(d(6), 'facade') - 0.1, 'point', { to: [RIGHT - 10, 300], hold: 1.6 });
      roast(RIGHT, 'Can grow into a god class', mark(d(6), 'god'), mark(d(6), 'door'));

      // Façade: "Each screen made four calls in a row: pay, kitchen, driver,
      // receipt. Each screen had to know."
      const f = (n) => `facade-${n}`;
      sign('Façade', line(f(1)).start - 0.2);
      move('facade', mark(f(1), 'facade') - 0.1, 'chest', { hold: 0.8, pats: 1 });
      const c = kit.scene(content, line(f(1)).start - 0.1, mark(f(3), 'knock') - 0.05, { exit: 'fade' });
      const tangle = wide(c, SPEC.tangle, { at: mark(f(1), 'screen'), top: 30, h: S.h - 60 });
      ['pay', 'kitchen', 'driver', 'receipt'].forEach((word, i) => {
        tangle.ring(['Payment', 'Kitchen', 'Driver', 'Receipt'][i], { at: mark(f(2), word), tone: 'amber' });
      });
      kit.sticker(c, 'Each screen had to know', { x: S.x + 180, y: SILL, at: mark(f(2), 'know'), variant: 'red', rotate: -2 });

      // "Now they knock once, 'place order,' and I run the four; screens stay
      // simple; the steps live behind my door."
      const e = kit.scene(content, mark(f(3), 'knock') - 0.05, clearFor('ruling-2'), { exit: 'fade' });
      const front = wide(e, SPEC.facade, { at: mark(f(3), 'knock') });
      front.token(route(front, 'Phone', 'OrderFacade'), { at: mark(f(3), 'knock'), duration: 0.5, until: mark(f(3), 'run') });
      front.ring('OrderFacade', { at: mark(f(3), 'place'), tone: 'amber' });
      front.callout('OrderFacade', 'placeOrder()', { side: 'right', at: mark(f(3), 'place'), tone: 'amber' });
      ['Payment', 'Kitchen', 'Driver', 'Receipt'].forEach((name, i) => {
        front.token(route(front, 'OrderFacade', name), { at: mark(f(3), 'run') + i * 0.1, duration: 0.5, until: mark(f(4), 'screens') });
      });
      kit.sticker(e, 'Screens stay simple', { x: S.x + 200, y: SILL, at: mark(f(4), 'simple'), variant: 'green', rotate: -2 });
      move('facade', mark(f(3), 'knock') - 0.1, 'point', { to: screenAt(0.5, 0.45), hold: 1.8 });

      // "You, Adapter? One more hop when they're debugging. (Ooh!)"
      move('facade', mark(f(5), 'adapter') - 0.1, 'point', { to: [LEFT + 10, 300], hold: 1.6 });
      roast(LEFT, 'One more layer to trace', mark(f(5), 'hop'), mark(f(5), 'debugging'));
    }

    function ruling2() {
      // "Intern? Round three is your call.": the twins bow out, the intern
      // walks on, and the lead goes back to her spot.
      judge('lead', {
        from: start('ruling-2') - 0.9, to: start('chorus-3') + 5.6, enterFrom: 'right',
        home: RIGHT, homeAt: mark('ruling-2-4', 'call'),
      });
      enter('intern', mark('ruling-2-4', 'intern') - 0.2, start('chorus-3') + 5.6, 'left', 'left');
      ruling('ruling-2', {
        judge: 'lead', title: 'Don’t count the classes: what is it for?', signText: 'The ruling',
        left: { q: 'Make their interface fit yours?', name: 'Adapter', ask: line('ruling-2-2').start, at: mark('ruling-2-2', 'adapter') },
        right: { q: 'A shortcut through a tangled system?', name: 'Façade', ask: line('ruling-2-3').start, at: mark('ruling-2-3', 'facade') },
        footer: { text: 'Round 3: the intern’s call', at: mark('ruling-2-4', 'round') },
      });
      move('lead', mark('ruling-2-4', 'intern') - 0.1, 'present', { to: [LEFT + 20, 330], hold: 1.2 });
    }

    // ----------------------------------------------------------------
    // Round 3: Observer and Mediator
    // ----------------------------------------------------------------

    function round3() {
      const exitAt = line('bridge-1').start - 0.1;
      twins('observer', 'mediator', {
        aAt: mark('chorus-3-3', 'observer') - 0.3, bAt: mark('chorus-3-3', 'mediator') - 0.3, exitAt,
        aNamed: mark('ruling-3-2', 'observer'), bNamed: mark('ruling-3-3', 'mediator'),
      });
      hold('observer', mark('chorus-3-3', 'observer'), 'left', 'magnifier');
      hold('mediator', mark('chorus-3-3', 'mediator'), 'right', 'clipboard');
      badge('Round 3 · Observer vs. Mediator', start('observer') - 0.2, end('ruling-3'));

      // Observer: "Status flips; who needs to know? Phone, tablet, driver: the
      // observers on the go."
      const o = (n) => `observer-${n}`;
      sign('Observer', line(o(1)).start - 0.3);
      move('observer', mark(o(1), 'observer') - 0.1, 'present', { to: screenAt(0.2, 0.4), hold: 1.2 });
      const a = kit.scene(content, line(o(1)).start - 0.2, line(o(3)).start - 0.05, { exit: 'fade' });
      const app = P.phone(a, { x: S.x + 26, y: S.y + 2, w: 190, h: 296, at: mark(o(1), 'status') - 0.3 });
      P.sheetTitle(app, 'Your order', { at: mark(o(1), 'status') - 0.2 });
      P.status(app, { at: mark(o(1), 'status') - 0.1, from: 'Cooking', to: 'Ready', flipAt: mark(o(1), 'flips') });
      kit.sticker(a, 'Who needs to know?', { x: S.x + 300, y: S.y + 24, at: mark(o(1), 'who'), variant: 'white', rotate: -2 });
      P.devices(a, [
        { kind: 'phone', label: 'Phone', at: mark(o(2), 'phone'), tag: 'observer', tagAt: mark(o(2), 'observers') },
        { kind: 'tablet', label: 'Tablet', at: mark(o(2), 'tablet'), tag: 'observer', tagAt: mark(o(2), 'observers') + 0.1 },
        { kind: 'driver', label: 'Driver', at: mark(o(2), 'driver'), tag: 'observer', tagAt: mark(o(2), 'observers') + 0.2 },
      ], { x: S.x + 244, y: S.y + 96, gap: 108, size: 54 });

      // "They subscribe; on each change, the order pings the list; each
      // reacts its own way. New screen? Just subscribe."
      const b = kit.scene(content, line(o(3)).start - 0.05, line('mediator-1').start - 0.1, { exit: 'fade' });
      const list = wide(b, SPEC.observer(false), { at: line(o(3)).start, until: mark(o(4), 'subscribe') - 0.05, below: 40 });
      const followers = list.textBox('followers');
      list.ring(followers, { at: mark(o(3), 'subscribe'), tone: 'teal', pad: 4 });
      list.callout(followers, 'the list', { side: 'right', at: mark(o(3), 'subscribe'), tone: 'teal' });
      list.ring('Order', { at: mark(o(3), 'order'), tone: 'amber' });
      const toObserver = route(list, 'Order', 'Observer');
      ['Phone', 'Tablet', 'DriverApp'].forEach((name, i) => {
        const box = list.box(name);
        list.token([...toObserver, [box.x + box.w / 2, box.y]], { at: mark(o(3), 'pings') + i * 0.12, duration: 0.7, until: mark(o(4), 'each') + 0.2 });
      });
      [['Phone', 'Banner', 'reacts'], ['Tablet', 'Ding!', 'own'], ['DriverApp', 'Pin', 'way']].forEach(([name, reaction, word]) => {
        list.callout(name, reaction, { side: 'below', at: mark(o(4), word), tone: 'white' });
      });
      const grown = wide(b, SPEC.observer(true), { at: mark(o(4), 'subscribe'), below: 40 });
      grown.ring('Watch', { at: mark(o(4), 'subscribe') + 0.1, tone: 'green' });
      grown.callout('Watch', 'new: just subscribes', { side: 'below', at: mark(o(4), 'subscribe') + 0.1, tone: 'green' });
      move('observer', mark(o(3), 'pings') - 0.1, 'point', { to: screenAt(0.5, 0.25), hold: 1.6 });

      // "(The order? Untouched!)"
      P.diffBadge(b, 'order.py · 0 lines changed', { x: S.x + 166, y: SILL, at: mark(o(5), 'untouched') });

      // "Mediator? Your hub keeps growing. God class! (Ooh!)"
      move('observer', mark(o(6), 'mediator') - 0.1, 'point', { to: [RIGHT - 10, 300], hold: 1.6 });
      roast(RIGHT, 'The hub can grow into a god class', mark(o(6), 'growing'), mark(o(6), 'class'));

      // Mediator: "Food's up, but no driver's free: keep it warm, ping the
      // customer: one rule, all three."
      const m = (n) => `mediator-${n}`;
      sign('Mediator', line(m(1)).start - 0.2);
      move('mediator', mark(m(1), 'mediator') - 0.1, 'chest', { hold: 0.8, pats: 1 });
      const c = kit.scene(content, line(m(1)).start - 0.1, line(m(3)).start - 0.05, { exit: 'fade' });
      P.devices(c, [
        { kind: 'kitchen', label: 'Kitchen', at: mark(m(1), 'foods'), react: 'Order up!', reactAt: mark(m(1), 'up') },
        { kind: 'driver', label: 'Driver 1', at: mark(m(1), 'drivers'), react: 'busy', reactTone: 'red', reactAt: mark(m(1), 'free') },
        { kind: 'driver', label: 'Driver 2', at: mark(m(1), 'drivers') + 0.12, react: 'busy', reactTone: 'red', reactAt: mark(m(1), 'free') + 0.1 },
        { kind: 'customer', label: 'Customer', at: mark(m(2), 'customer') },
      ], { x: S.x + 24, y: S.y + 34, gap: 140, size: 52 });
      const rule = P.card(c, { x: S.x + 120, y: S.y + 150, w: 350, title: 'One rule', at: mark(m(2), 'keep'), tone: 'rule' });
      P.row(rule.body, 'Food ready + no driver free', { at: mark(m(2), 'keep') });
      P.row(rule.body, '→ keep it warm', { at: mark(m(2), 'warm') });
      P.row(rule.body, '→ ping the customer', { at: mark(m(2), 'customer') });
      P.row(rule.body, 'needs all three', { at: mark(m(2), 'three'), tone: 'red' });

      // "Link 'em to each other? Rules scatter everywhere, so they all
      // report to me, and the rules live here. They never call each other.
      // New rule? Just change me."
      const e = kit.scene(content, line(m(3)).start - 0.05, line(m(4)).start - 0.05, { exit: 'fade' });
      wide(e, SPEC.mesh, { at: mark(m(3), 'link'), scale: 1.3 });
      kit.sticker(e, 'Rules everywhere', { x: S.x + 210, y: SILL, at: mark(m(3), 'scatter'), variant: 'red', rotate: -3 });
      const g = kit.scene(content, line(m(4)).start - 0.05, clearFor('ruling-3'), { exit: 'fade' });
      const hub = wide(g, SPEC.hub, { at: mark(m(4), 'report'), scale: 1.25, below: 40 });
      ['Kitchen', 'Drivers', 'Customer'].forEach((name, i) => {
        hub.token(route(hub, name, 'DispatchHub'), { at: mark(m(4), 'report') + i * 0.12, duration: 0.5, until: mark(m(4), 'rules') });
      });
      hub.ring('DispatchHub', { at: mark(m(4), 'rules'), tone: 'amber' });
      hub.callout('DispatchHub', 'the rules live here', { side: 'below', at: mark(m(4), 'here'), until: mark(m(5), 'new'), tone: 'amber' });
      hub.callout('DispatchHub', 'New rule? Change only the hub.', { side: 'below', at: mark(m(5), 'change'), tone: 'green' });
      kit.sticker(g, 'They never call each other', { x: S.x + 170, y: SILL, at: mark(m(5), 'never'), variant: 'white', rotate: -2 });
      move('mediator', mark(m(4), 'report') - 0.1, 'point', { to: screenAt(0.5, 0.55), hold: 1.6 });

      // "Observer? One ping sets off ten. Surprise! (Ooh!)"
      move('mediator', mark(m(6), 'observer') - 0.1, 'point', { to: [LEFT + 10, 300], hold: 1.6 });
      roast(LEFT, 'One update can set off a chain', mark(m(6), 'ten'), mark(m(6), 'surprise'));
    }

    function ruling3() {
      // The intern judges this round; the lead comes back for the bridge.
      judge('intern', {
        from: start('ruling-3') - 0.9, to: song.duration, enterFrom: 'left',
        home: LEFT, homeAt: end('ruling-3') - 0.3,
      });
      enter('lead', line('bridge-1').start + 0.8, song.duration, 'right', 'right');
      ruling('ruling-3', {
        judge: 'intern', title: 'The intern’s call', signText: 'My call',
        left: { q: 'One change, each reacts on its own?', name: 'Observer', ask: line('ruling-3-2').start, at: mark('ruling-3-2', 'observer') },
        right: { q: 'Each move depends on the rest?', name: 'Mediator', ask: line('ruling-3-3').start, at: mark('ruling-3-3', 'mediator') },
      });
      move('intern', mark('ruling-3-1', 'my') - 0.1, 'chest', { hold: 0.8, pats: 1 });
    }

    // ----------------------------------------------------------------
    // Bridge: the intern overcorrects; the lead's lesson
    // ----------------------------------------------------------------

    function bridge() {
      const l = (n) => `lesson-${n}`;
      badge('Bridge · When to use one', start('bridge') - 0.2, end('lesson'));
      sign('When?', start('bridge'));
      move('intern', mark('bridge-1', 'strategy') - 0.1, 'hop', { height: 14 });

      // "So I'm hyped: CSV export? Strategy too! Lead asks: 'How many
      // formats?' ...One."
      const a = kit.scene(content, start('bridge') - 0.1, mark(l(2), 'each') - 0.1, { exit: 'fade' });
      const sketch = M.diagram(a, {
        kind: 'class', spec: SPEC.exporter(['CSV']), x: S.x + 14, y: S.y + 6, w: 260, fit: { w: 232, h: 238 }, scale: 1.1,
        title: 'Intern’s sketch', at: mark('bridge-1', 'export'),
      });
      P.review(a, {
        x: S.x + 300, y: S.y + 40, w: 270, at: mark('bridge-2', 'how'), until: mark(l(1), 'then'),
        lines: [{ text: 'How many formats?', at: mark('bridge-2', 'how'), tone: 'title' }],
      });
      move('lead', mark('bridge-2', 'how') - 0.1, 'point', { to: screenAt(0.2, 0.5), hold: 1.6 });
      sketch.ring('CSV', { at: mark('bridge-3', 'one'), tone: 'amber' });
      sketch.callout('CSV', 'just one', { side: 'right', at: mark('bridge-3', 'one'), until: mark(l(1), 'nothing'), tone: 'amber' });
      move('intern', mark('bridge-3', 'one') - 0.1, 'shrug', { hold: 1 });

      // "One? Then nothing varies. Don't go pattern-maxxing."
      sketch.cross(sketch.union(sketch.boxes(() => true)), { at: mark(l(1), 'nothing') });
      sketch.callout('Format', 'nothing varies', { side: 'right', at: mark(l(1), 'varies'), tone: 'red' });
      P.gauge(a, { x: S.x + 360, y: S.y + 30, label: 'Pattern-maxxing', at: mark(l(1), 'dont') - 0.1, peakAt: mark(l(1), 'maxxing'), backAt: mark(l(2), 'each') - 0.6 });
      M.code(a, { x: S.x + 300, y: S.y + 170, w: 270, title: 'export.py', lines: ['def export_csv(report):', '    ...'], at: mark(l(1), 'varies') + 0.2 });
      move('lead', mark(l(1), 'maxxing') - 0.1, 'stop', { hold: 1 });

      // "Each pattern costs: more classes, one more hop to trace."
      const b = kit.scene(content, mark(l(2), 'each') - 0.1, line(l(3)).start - 0.05, { exit: 'fade' });
      P.priceTag(b, '+ classes', { x: S.x + 120, y: S.y + 40, at: mark(l(2), 'classes'), rotate: -5 });
      P.priceTag(b, '+1 hop to trace', { x: S.x + 330, y: S.y + 40, at: mark(l(2), 'hop'), rotate: 4 });

      // "Real change, here or planned? Use one. Not 'just in case.'"
      const c = kit.scene(content, line(l(3)).start - 0.05, line(l(4)).start + 0.2, { exit: 'fade' });
      P.roadmap(c, {
        x: S.x + 100, y: S.y + 40, w: 390, at: mark(l(3), 'real'),
        lanes: [
          { name: 'Now', tickets: ['CSV'] },
          { name: 'Next sprint', tickets: ['PDF', 'Excel'] },
          { name: 'Someday?', tickets: ['XML', 'Fax'], crossAt: mark(l(3), 'case') },
        ],
      });
      move('lead', mark(l(3), 'planned') - 0.1, 'point', { to: screenAt(0.5, 0.4), hold: 1.4 });

      // "Start plain. When one change keeps spreading file to file, refactor
      // toward the pattern. (That's when it's earned!) Stops paying? Pull it
      // out. (Lesson learned!)"
      const d = kit.scene(content, line(l(4)).start + 0.1, line(l(5)).start - 0.05, { exit: 'fade' });
      M.code(d, { x: S.x + 20, y: S.y + 20, w: 270, title: 'export.py', lines: ['def export_csv(report):', '    ...'], at: mark(l(4), 'plain') });
      P.fileFan(d, { x: S.x + 30, y: S.y + 150, files: ['export.py', 'report.py', 'email.py', 'admin.py', 'api.py'], at: mark(l(4), 'change'), every: 0.22 });
      const e = kit.scene(content, line(l(5)).start - 0.05, end('lesson') + 0.4, { exit: 'fade' });
      const earned = M.diagram(e, {
        kind: 'class', spec: SPEC.exporter(['CSV', 'PDF', 'Excel']), x: S.x + 20, y: S.y + 6, w: 380, fit: { w: 352, h: 260 }, scale: 1.1,
        at: mark(l(5), 'refactor'), until: mark(l(6), 'out') + 0.1,
      });
      kit.stamp(e, 'Earned', { x: S.x + 420, y: S.y + 150, at: mark(l(5), 'earned'), until: mark(l(6), 'stops'), color: 'green', small: true, shake: false, from: 1.5, rotate: -8 });
      earned.ring(earned.union(earned.boxes(() => true)), { at: mark(l(6), 'paying'), tone: 'red' });
      earned.cross(earned.union(earned.boxes(() => true)), { at: mark(l(6), 'pull') });
      M.code(e, { x: S.x + 160, y: S.y + 80, w: 270, title: 'export.py', lines: ['def export_csv(report):', '    ...'], at: mark(l(6), 'out') + 0.2 });
      kit.sticker(e, 'Lesson learned', { x: S.x + 220, y: SILL, at: mark(l(6), 'learned'), variant: 'gold', rotate: -3 });
      move('lead', mark(l(6), 'pull') - 0.1, 'present', { to: screenAt(0.5, 0.4), hold: 1.4 });
    }

    // ----------------------------------------------------------------
    // Pre-chorus and the final chorus
    // ----------------------------------------------------------------

    function finale() {
      badge('Pre-chorus', start('pre-chorus'), start('final-chorus'));
      sign('Just one', start('pre-chorus'));
      const a = kit.scene(content, start('pre-chorus') - 0.2, start('final-chorus') + 0.2, { exit: 'fade' });
      P.flipBadge(a, { x: S.x + 114, y: S.y + 104, front: '23 / 23 patterns', back: 'The one the problem needs', at: mark('pre-chorus-1', 'not'), flipAt: mark('pre-chorus-2', 'one') });
      move('intern', mark('pre-chorus-1', 'not') - 0.1, 'wag', { hold: 1.4 });

      // The final chorus: the whole cast in a line, each pattern pair side
      // by side under its name plates, then a bow on "That's the name!".
      chant('final-chorus', 0, null);
      const lineup = ['intern', 'strategy', 'state', 'adapter', 'facade', 'observer', 'mediator', 'lead'];
      const xs = [70, 185, 300, 415, 545, 660, 775, 890];
      const comeAt = start('final-chorus') - 1.2;
      const bowAt = mark('final-chorus-2', 'thats') - 0.1;
      const leaveAt = bowAt + 1.4;
      lineup.forEach((who, i) => {
        if (who === 'intern' || who === 'lead') {
          place(who, comeAt, xs[i], 0.62, 0.9);
          place(who, leaveAt, who === 'intern' ? LEFT : RIGHT, SCALE, 0.9);
        } else {
          // Every twin has left the stage by now; each walks on to its spot.
          place(who, comeAt - 2, xs[i], 0.62, 0.01);
          enter(who, comeAt, leaveAt, i < 4 ? 'left' : 'right', i < 4 ? 'left' : 'right');
          P.nameplate(content, VOICE[who], { x: xs[i], y: 250, at: comeAt + 0.6, until: leaveAt, tone: 'small' });
        }
        move(who, bowAt, 'bow', { hold: 0.9 });
      });
    }

    // ----------------------------------------------------------------
    // Pop quiz: all six answers on screen for every question
    // ----------------------------------------------------------------

    function quiz() {
      badge('Pop quiz', start('quiz-intro'), end('quiz'));
      sign('Pop quiz', start('quiz-intro'));
      const options = ['Strategy', 'State', 'Adapter', 'Façade', 'Observer', 'Mediator'];
      // Each answer card appears as the lead names it, and stays.
      const named = [
        mark('quiz-intro-1', 'strategy'), mark('quiz-intro-1', 'state'), mark('quiz-intro-2', 'adapter'),
        mark('quiz-intro-2', 'facade'), mark('quiz-intro-2', 'observer'), mark('quiz-intro-2', 'mediator'),
      ];
      const board = P.quiz(content, { options, at: start('quiz-intro'), until: end('quiz') + 0.4, times: named });
      const intro = P.card(board.board.querySelector('.pk-quiz-stage'), { x: 110, y: 40, w: 340, at: mark('quiz-intro-1', 'pop'), until: line('quiz-1').start - 0.1, tone: 'rule' });
      P.row(intro.body, 'Pick one for each problem', { at: mark('quiz-intro-1', 'pick'), tone: 'title' });
      P.row(intro.body, 'No diagrams: just the problem', { at: mark('quiz-intro-1', 'pick') + 0.3 });
      move('lead', mark('quiz-intro-1', 'pick'), 'present', { to: screenAt(0.5, 0.85), hold: 1.6 });

      const cases = [
        { id: 'quiz-1', name: 'Adapter', reason: 'Make it fit', picture: 'plug' },
        { id: 'quiz-2', name: 'State', reason: 'Depends where it’s at', picture: 'hero' },
        { id: 'quiz-3', name: 'Observer', reason: 'Ping the list', picture: 'stocks' },
        { id: 'quiz-4', name: 'Strategy', reason: 'One job, a few ways', picture: 'routes' },
        { id: 'quiz-5', name: 'Mediator', reason: 'Rules in one hub', picture: 'planes' },
        { id: 'quiz-6', name: 'Façade', reason: 'A shortcut in', picture: 'booking' },
      ];
      cases.forEach((c, i) => {
        const q = line(c.id);
        const next = cases[i + 1] ? line(cases[i + 1].id).start : end('quiz') + 0.3;
        const asked = board.ask(i + 1, cases.length, q.text, { at: q.start - 0.05, until: next - 0.05 });
        P.picture(asked.art, c.picture, { at: q.start + 0.2, answerAt: q.answer_at });
        board.light(c.name, { at: q.answer_at, until: next - 0.05, reason: c.reason });
        move(i % 2 ? 'intern' : 'lead', q.answer_at, 'point', { to: screenAt(0.08 + options.indexOf(c.name) * 0.168, 0.9), hold: 1.2 });
      });
    }

    // ----------------------------------------------------------------
    // Outro: six months later
    // ----------------------------------------------------------------

    function outro() {
      const o = (n) => `outro-${n}`;
      badge('Outro · Six months later', start('outro'));
      sign('Same shape', start('outro'));
      const a = kit.scene(content, start('outro') - 0.1, undefined, { exit: 'fade' });
      const request = P.pr(a, { x: S.x + 6, y: S.y + 6, w: 290, number: 42, author: 'new intern', parts: ['Strategy pattern'], at: mark(o(2), 'new') });
      M.diagram(request.body, { kind: 'class', spec: SPEC.statusTwin, x: 0, y: 0, w: 262, fit: { w: 234, h: 222 }, scale: 1, at: mark(o(2), 'pr') });
      P.review(a, {
        x: S.x + 312, y: S.y + 70, w: 268, who: 'You', at: mark(o(3), 'nice') - 0.1,
        lines: [
          { text: 'Nice diagram.', at: mark(o(3), 'nice') },
          { text: 'What’s it for?', at: mark(o(3), 'whats'), tone: 'title' },
        ],
      });
      move('intern', mark(o(1), 'reviewer') - 0.1, 'chest', { hold: 0.8, pats: 1 });
      move('intern', mark(o(3), 'whats') - 0.1, 'point', { to: screenAt(0.75, 0.4), hold: 1.6 });
      move('lead', mark(o(3), 'whats'), 'thumbs', { hold: 1.4 });
      move('intern', line(o(3)).end + 0.4, 'bow', { hold: 1 });
      move('lead', line(o(3)).end + 0.4, 'bow', { hold: 1 });
    }

    intro();
    verse1();
    chant('chorus-1', 1, ['Strategy', 'State']);
    round1();
    ruling1();
    interlude();
    chant('chorus-2', 2, ['Adapter', 'Façade']);
    round2();
    ruling2();
    chant('chorus-3', 3, ['Observer', 'Mediator']);
    round3();
    ruling3();
    bridge();
    finale();
    quiz();
    outro();

    // The marquee: each sign until the next one goes up.
    signs.sort((x, y) => x[0] - y[0]).forEach(([at, text], i) => P.marquee(content, text, { at, until: signs[i + 1]?.[0] }));

    // ----------------------------------------------------------------
    // Build the cast: every figure sings its own words and the crowd's.
    // ----------------------------------------------------------------

    /** Recolours a hoodie (its cloth, sleeves, hood, and pocket) in `suit`, a #rrggbb colour. */
    function wearSuitColour(node, suit) {
      const rgb = [1, 3, 5].map((i) => parseInt(suit.slice(i, i + 2), 16));
      const mix = (towards, amount) => `#${rgb.map((c) => Math.round(c + (towards - c) * amount).toString(16).padStart(2, '0')).join('')}`;
      const set = (selector, property, value) => node.querySelectorAll(selector).forEach((part) => part.style.setProperty(property, value));
      node.style.setProperty('--oc-cloth', suit);
      node.style.setProperty('--oc-cloth-light', mix(255, 0.4));
      node.style.setProperty('--oc-cloth-shade', mix(0, 0.45));
      [['top', 0.12, 0.25], ['sleeve', 0.08, 0.32]].forEach(([part, light, dark]) => {
        set(`.oc-${part}-stop-0`, 'stop-color', mix(255, light));
        set(`.oc-${part}-stop-1`, 'stop-color', suit);
        set(`.oc-${part}-stop-2`, 'stop-color', mix(0, dark));
      });
      set('.oc-hood', 'fill', mix(0, 0.15));
      set('.oc-hood-edge', 'stroke', mix(0, 0.35));
      set('.oc-hood-inside', 'stroke', mix(0, 0.55));
      set('.oc-pocket-patch', 'fill', mix(0, 0.08));
    }

    const crowd = C.wordsFor(song.storyboard, 'Crowd');
    for (const who of Object.keys(VOICE)) {
      const p = plan[who];
      if (!p.stage.length) continue;
      const head = who === 'intern' ? student?.heroHead() : student?.castHead(look(FEMININE.has(who)));
      const figure = C.figure(content, {
        role: COSTUME[who], hero: head, stage: p.stage, places: p.places, moves: p.moves, holds: p.holds,
        words: [...C.wordsFor(song.storyboard, VOICE[who]), ...crowd].sort((x, y) => x[0] - y[0]),
        seed: Object.keys(VOICE).indexOf(who),
      });
      // The intern is the viewer's SE Gym hero: their face, and their
      // outfit's colour on the hoodie.
      if (who === 'intern') student?.heroAppearance?.then((hero) => hero?.suit && wearSuitColour(figure.node, hero.suit)).catch(() => {});
    }
    for (const tag of tags) tag();
  };
})();
