/*
 * Choreography for "Snapshots and Pointers" (storyboard:
 * _data/songs/snapshots_and_pointers.yml).
 *
 * Every visual hits a sung word: `mark(lineId, word)` is that word's time in
 * the recording. The teaching rule for the visuals: show exactly what the
 * line says — the real command in the terminal, the real GitGraph animation
 * for what it does — and let the music-video flourishes (stickers, stamps,
 * kinetic type, confetti) only emphasize words that are sung. Each line's
 * `visual` text in the storyboard describes what this file draws for it.
 *
 * Layout: 960×540 stage; the badge sits top-left, the terminal top-right
 * (x ≥ 600, y ≤ 116), and nothing essential goes below y = 460, where the
 * player draws captions.
 */
(function () {
  'use strict';

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.snapshots_and_pointers = function choreograph({ song, kit, layers, terminal, student }) {
    const { fx, tween, EASE, camera, onFrame } = window.Timeline;
    const { content, hud } = layers;
    const line = (id) => song.line(id);
    const mark = (id, word) => song.mark(id, word);

    // ----------------------------------------------------------------
    // Shared helpers
    // ----------------------------------------------------------------

    /** A GitGraph state in the command-lab format; commits newest first. */
    function gitState(commits, { head = 'main', files } = {}) {
      return {
        log: commits.join('\n'),
        branches: '',
        head: head ? `refs/heads/${head}` : '',
        files: files ? { untracked: [], unstaged: [], staged: [], stashed: [], ...files } : undefined,
      };
    }

    const label = (name) => `[data-label-key="branch:${name}"]`;
    const HEAD = '[data-label-key="head"]';
    const node = (hash) => `[data-hash="${hash}"]`;

    function viewfinder(parent) {
      const frame = kit.el('div', 'viewfinder is-staged', parent);
      for (const corner of ['tl', 'tr', 'bl', 'br']) kit.el('span', `viewfinder-corner viewfinder-corner--${corner}`, frame);
      return frame;
    }

    /** The camera-shutter blink over a station when a commit takes its picture. */
    function shutter(stationNode, at) {
      const blink = kit.el('div', 'shutter is-staged', stationNode);
      tween(blink, [{ opacity: 0 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], at, 0.36, EASE.inOut);
      camera.punch(at + 0.1, 0.025);
    }

    function badge(text, sectionId) {
      kit.badge(hud, text, song.sectionStart(sectionId), song.sectionEnd(sectionId));
    }

    // ----------------------------------------------------------------
    // Intro: the homework_final_final mess, then the Time Stone
    // ----------------------------------------------------------------

    function intro() {
      const end = song.sectionEnd('intro');
      const better = mark('intro-3', 'better');
      const pile = kit.scene(content, 0, better + 1.0, { exit: 'fade' });
      const cards = [
        { name: 'homework_final.txt', x: 240, y: 150, r: -6, at: mark('intro-1', 'homework') },
        { name: 'homework_final_2.txt', x: 420, y: 210, r: 4, at: mark('intro-1', 'homework_2') },
        { name: 'homework_really_done.txt', x: 280, y: 290, r: -3, at: mark('intro-1', 'homework_3') },
        { name: 'homework_v3_FINAL.txt', x: 560, y: 130, r: 7, at: mark('intro-2', 'folder') },
        { name: 'homework (1).txt', x: 110, y: 225, r: -9, at: mark('intro-2', 'copies') },
        { name: 'homework_FINAL_use_this.txt', x: 520, y: 330, r: 5, at: mark('intro-2', 'copies') + 0.32 },
      ];
      cards.forEach((card, i) => {
        const node = kit.place(kit.el('div', 'homework-card is-staged', pile), card.x, card.y);
        node.append(kit.icon('file'));
        node.append(document.createTextNode(card.name));
        fx.pop(node, card.at, { rotate: card.r });
        // Sucked into the Time Stone: every copy spirals to the centre.
        tween(node, {
          translate: `${480 - card.x - 130}px ${205 - card.y}px`, scale: 0.05, rotate: `${card.r + 300}deg`, opacity: 0,
        }, better + 0.05 * i, 0.7, EASE.in);
      });
      const trust = mark('intro-2', 'trust');
      kit.sticker(pile, 'Which one?!', { x: 690, y: 250, at: trust, until: better, variant: 'pink', rotate: 8 });
      camera.shake(trust + 0.05, 6);

      const title = kit.scene(content, better + 0.2, end, { enter: 'fade' });
      if (student) student.appear({ from: better + 0.55, to: end - 0.2, x: 42, y: 135, scale: 0.78 });
      kit.timeStone(title, { x: 480, y: 200, size: 230, from: better + 0.35, to: end });
      const time = mark('intro-3', 'time');
      const subtitle = kit.el('div', 'subtitle is-staged', title, 'The software engineer’s');
      subtitle.style.top = '338px';
      fx.rise(subtitle, time - 1.05);
      const magic = mark('intro-4', 'magic');
      kit.kinetic(title, [{ text: 'Time Stone', at: time, color: 'gold' }], { y: 368, size: 60, until: magic + 0.5 });
      fx.fadeOut(subtitle, magic + 0.5, 0.25);
      camera.punch(magic, 0.04);
      kit.kinetic(title, [
        { text: 'Snapshots', at: mark('intro-4', 'snapshots'), iconName: 'camera' },
        { text: '&', at: mark('intro-4', 'snapshots') + 0.3 },
        { text: 'pointers', at: mark('intro-4', 'pointers'), color: 'cyan', iconName: 'pointer' },
      ], { y: 362, size: 58 });
    }

    // ----------------------------------------------------------------
    // Verse 1: working tree → staging area → repository
    // ----------------------------------------------------------------

    function verse1() {
      badge('Verse 1 · Where your work lives', 'verse-1');
      const start = song.sectionStart('verse-1');
      const end = song.sectionEnd('verse-1');
      const run = mark('verse-1-11', 'run');
      terminal.window(mark('verse-1-5', 'add') - 0.4, end);

      const s = kit.scene(content, start, run + 0.25);
      const wt = kit.station(s, { x: 40, y: 132, w: 260, h: 226, label: 'Working tree', iconName: 'laptop' }).enter(start + 0.1);
      const sa = kit.station(s, { x: 350, y: 132, w: 260, h: 226, label: 'Staging area', iconName: 'camera' }).enter(start + 0.1, 0.1);
      const repo = kit.station(s, { x: 660, y: 132, w: 260, h: 226, label: 'Repository', iconName: 'stack' }).enter(start + 0.1, 0.2);
      const slotY = (i) => 180 + i * 42;
      const WT_X = 56;
      const SA_X = 366;
      const SNAP = [[790, 266], [678, 266], [790, 176], [678, 176]];

      // The working tree: the files you edit.
      wt.light(mark('verse-1-1', 'working'), mark('verse-1-3', 'staging'));
      const files = mark('verse-1-2', 'files');
      const type = mark('verse-1-2', 'type');
      const wtApp = kit.chip(s, { name: 'app.py', version: 'v1', versions: [{ at: type, text: 'v2' }], x: WT_X, y: slotY(0) });
      fx.pop(wtApp, files);
      fx.pop(kit.chip(s, { name: 'README.md', version: 'v1', x: WT_X, y: slotY(1) }), files + 0.15);
      kit.sticker(s, 'Edited', { x: 186, y: 178, at: type, until: type + 1.3, variant: 'gold', iconName: 'pencil', rotate: 6 });

      // The staging area: the next commit, lined up for the shot.
      const staging = mark('verse-1-3', 'staging');
      sa.light(staging, mark('verse-1-8', 'stamps'));
      fx.pop(viewfinder(sa.node), staging);
      kit.sticker(s, 'Next commit', { x: 470, y: 108, at: mark('verse-1-3', 'next_2'), until: mark('verse-1-9', 'fixed'), variant: 'gold', iconName: 'sparkle', rotate: 5 });

      // …which starts as a copy of the last commit.
      const c1 = kit.polaroid(s, { x: SNAP[0][0], y: SNAP[0][1], id: 'C1', caption: 'Initial commit' });
      fx.pop(c1, line('verse-1-4').start);
      const copy = mark('verse-1-4', 'copy');
      const saApp1 = kit.chip(s, { name: 'app.py', version: 'v1', x: SA_X, y: slotY(0) });
      kit.flyIn(saApp1, copy, SNAP[0][0], SNAP[0][1] + 20);
      const saReadme = kit.chip(s, { name: 'README.md', version: 'v1', x: SA_X, y: slotY(1) });
      kit.flyIn(saReadme, copy + 0.12, SNAP[0][0], SNAP[0][1] + 40);

      // git add copies the new version in; the rest stay as they were.
      const add = mark('verse-1-5', 'add');
      terminal.run(add - 0.2, 'git add app.py');
      const saApp2 = kit.chip(s, { name: 'app.py', version: 'v2', x: SA_X, y: slotY(0) });
      kit.flyIn(saApp2, add + 0.05, WT_X, slotY(0), { duration: 0.55 });
      fx.popOut(saApp1, add + 0.45);
      kit.sticker(s, 'Copy', { x: 280, y: 160, at: add + 0.05, until: add + 1.2, variant: 'cyan', rotate: -6 });
      const rest = mark('verse-1-6', 'rest');
      kit.sticker(s, 'Unchanged', { x: 486, y: 246, at: rest, until: mark('verse-1-7', 'commit'), variant: 'cyan', rotate: -5 });
      fx.bump(sa.node, mark('verse-1-6', 'next'), 0.06);

      // git commit takes the picture and stamps it with a message.
      const commit = mark('verse-1-7', 'commit');
      terminal.run(commit - 0.2, 'git commit -m "Add login page"');
      const picture = mark('verse-1-7', 'picture');
      shutter(sa.node, picture);
      const c2 = kit.polaroid(s, { x: SNAP[1][0], y: SNAP[1][1], id: 'C2', caption: 'Add login page', captionAt: mark('verse-1-8', 'stamps') });
      kit.flyIn(c2, picture + 0.12, 440, 220, { spin: -25 });
      fx.bump(c2, mark('verse-1-8', 'stamps'), 0.18);

      // One job per commit: stage the fix, commit; then the rest.
      const fixed = mark('verse-1-9', 'fixed');
      fx.pop(kit.chip(s, { name: 'auth.py', version: 'fix', x: WT_X, y: slotY(2) }), fixed);
      const cleaned = mark('verse-1-9', 'cleaned');
      fx.pop(kit.chip(s, { name: 'style.css', version: 'tidy', x: WT_X, y: slotY(3) }), cleaned);
      const stage = mark('verse-1-9', 'stage');
      terminal.run(stage - 0.1, 'git add auth.py');
      kit.flyIn(kit.chip(s, { name: 'auth.py', version: 'fix', x: SA_X, y: slotY(2) }), stage + 0.05, WT_X, slotY(2));
      const commit2 = mark('verse-1-9', 'commit');
      terminal.run(commit2 - 0.05, 'git commit -m "Fix login bug"');
      shutter(sa.node, commit2 + 0.2);
      kit.flyIn(kit.polaroid(s, { x: SNAP[2][0], y: SNAP[2][1], id: 'C3', caption: 'Fix login bug' }), commit2 + 0.28, 440, 220, { spin: 20 });
      const restAdd = mark('verse-1-9', 'rest') - 0.1;
      terminal.run(restAdd, 'git add style.css');
      kit.flyIn(kit.chip(s, { name: 'style.css', version: 'tidy', x: SA_X, y: slotY(3) }), restAdd + 0.1, WT_X, slotY(3));
      const two = mark('verse-1-10', 'two') + 0.2;
      terminal.run(two, 'git commit -m "Clean up styles"');
      shutter(sa.node, two + 0.25);
      kit.flyIn(kit.polaroid(s, { x: SNAP[3][0], y: SNAP[3][1], id: 'C4', caption: 'Clean up styles' }), two + 0.32, 440, 220, { spin: -20 });
      const one = mark('verse-1-10', 'one');
      kit.sticker(s, '1 job each', { x: 690, y: 370, at: one, until: run, variant: 'green', iconName: 'check', rotate: 4 });
      const history = mark('verse-1-10', 'history');
      repo.light(history, run);
      kit.sticker(s, 'Reads best', { x: 740, y: 408, at: history, until: run, variant: 'violet', iconName: 'sparkle', rotate: -4 });

      // git status lays it out: the SE Book graph with its status strip.
      const status = mark('verse-1-11', 'status');
      terminal.run(status - 0.15, 'git status');
      const statusScene = kit.scene(content, run, end + 0.2);
      const base = ['C4|C3|Clean up styles|HEAD -> main', 'C3|C2|Fix login bug|', 'C2||Add login page|'];
      const statusCard = kit.graph(statusScene, {
        x: 130, y: 120, scale: 0.92, title: 'git status', iconName: 'search', from: run, to: end + 0.2,
        keyframes: [
          { at: run, state: gitState(base, { files: {} }) },
          { at: mark('verse-1-12', 'staged'), state: gitState(base, { files: { staged: [{ status: 'modified', path: 'app.py' }] } }) },
          { at: mark('verse-1-12', 'changed'), state: gitState(base, { files: { staged: [{ status: 'modified', path: 'app.py' }], unstaged: [{ status: 'modified', path: 'README.md' }] } }) },
          { at: mark('verse-1-12', 'new'), state: gitState(base, { files: { staged: [{ status: 'modified', path: 'app.py' }], unstaged: [{ status: 'modified', path: 'README.md' }], untracked: ['notes.txt'] } }) },
        ],
      });
      // The status strip widens as rows arrive; start at its widest so the card doesn't jump.
      statusCard.style.minWidth = '640px';
    }

    // ----------------------------------------------------------------
    // Chorus: the pipeline, the hook, and a commit moving its branch
    // ----------------------------------------------------------------

    function chorus(n, { message, title = 'Chorus', final = false }) {
      const id = `chorus-${n}`;
      const ln = (i) => `${id}-${i}`;
      const from = song.sectionStart(id);
      const to = song.sectionEnd(id);
      badge(title, id);
      const hook = line(ln(5)).start;

      // Part 1: the pipeline from working tree to remote.
      const s = kit.scene(content, from, hook + 0.05, { exit: 'fade' });
      const Y = 170;
      const wt = kit.station(s, { x: 24, y: Y, w: 190, h: 124, label: 'Working tree', iconName: 'laptop', compact: true }).enter(from);
      const sa = kit.station(s, { x: 236, y: Y, w: 190, h: 124, label: 'Staging area', iconName: 'camera', compact: true }).enter(from, 0.06);
      kit.station(s, { x: 448, y: Y, w: 190, h: 124, label: 'Local repo', iconName: 'stack', compact: true }).enter(from, 0.12);
      kit.station(s, { x: 742, y: Y, w: 194, h: 124, label: 'Remote', iconName: 'cloud', remote: true, compact: true }).enter(from, 0.18);

      const edit = mark(ln(1), 'edit');
      wt.light(edit, mark(ln(2), 'add'));
      const wtChip = kit.chip(s, { name: 'app.py', version: 'v2', x: 40, y: Y + 42 });
      fx.pop(wtChip, edit);
      kit.sticker(s, 'Edit', { x: 64, y: Y + 85, at: edit, until: mark(ln(2), 'add') + 0.4, variant: 'gold', iconName: 'pencil', rotate: -6 });

      const add = mark(ln(2), 'add');
      kit.flow(s, { from: [119, Y], to: [331, Y], bend: -48, at: add, label: 'git add', labelAt: [188, Y - 66] });
      kit.flyIn(kit.chip(s, { name: 'app.py', version: 'v2', x: 252, y: Y + 56 }), add + 0.12, 40, Y + 42);
      sa.light(mark(ln(2), 'staging'), mark(ln(3), 'snapshots') + 0.4);
      kit.sticker(s, 'Next commit', { x: 290, y: Y + 92, at: mark(ln(2), 'next'), until: hook, variant: 'gold', iconName: 'sparkle', rotate: 4 });

      const commit = mark(ln(3), 'commit');
      kit.flow(s, { from: [331, Y], to: [543, Y], bend: -48, at: commit, label: 'git commit', labelAt: [394, Y - 66] });
      const snapshots = mark(ln(3), 'snapshots');
      shutter(sa.node, snapshots);
      const snap = kit.polaroid(s, { x: 466, y: Y + 36, id: 'C', caption: 'snapshot' });
      kit.flyIn(snap, snapshots + 0.12, 290, Y + 40, { spin: -20 });
      const machine = mark(ln(3), 'machine');
      const bracket = kit.place(kit.el('div', 'machine-bracket is-staged', s), 24, Y + 140);
      bracket.style.width = '614px';
      const bracketLabel = kit.el('div', 'machine-bracket-label', bracket);
      bracketLabel.append(kit.icon('laptop'));
      bracketLabel.append(document.createTextNode('On your machine'));
      fx.rise(bracket, machine - 0.1, { distance: 14, duration: 0.35 });

      const push = mark(ln(4), 'push');
      kit.flow(s, { from: [642, Y + 40], to: [738, Y + 40], bend: 0, at: push, label: 'git push', labelAt: [648, Y + 6] });
      kit.flyIn(kit.polaroid(s, { x: 800, y: Y + 36, id: 'C', caption: 'shared' }), push + 0.12, 466, Y + 36, { spin: 15 });
      const pull = mark(ln(4), 'pull');
      kit.flow(s, { from: [738, Y + 88], to: [642, Y + 88], bend: 0, color: 'cyan', at: pull, label: 'git pull', labelAt: [652, Y + 96] });
      kit.flyIn(kit.polaroid(s, { x: 530, y: Y + 46, id: 'T', caption: 'team’s', photoText: 'T' }), pull + 0.12, 800, Y + 46, { spin: -15 });

      // Part 2: the hook as kinetic type.
      const branchLine = line(ln(6)).start;
      const hookScene = kit.scene(content, hook - 0.05, branchLine + 0.1, { exit: 'fade' });
      const hookSize = final ? 58 : 54;
      kit.kinetic(hookScene, [
        { text: 'Commits', at: mark(ln(5), 'commits'), iconName: 'lock' },
        { text: 'never change', at: mark(ln(5), 'never'), color: 'gold' },
      ], { y: 178, size: hookSize });
      kit.kinetic(hookScene, [
        { text: 'only', at: mark(ln(5), 'only') },
        { text: 'pointers', at: mark(ln(5), 'pointers'), color: 'cyan', iconName: 'pointer' },
        { text: 'move', at: mark(ln(5), 'move'), color: 'cyan', rotate: -4 },
      ], { y: 278, size: hookSize });

      // Part 3: a branch is a label, HEAD is where you are, commit moves it.
      const g = kit.scene(content, branchLine, to + 0.2);
      const before = ['B|A|Initial commit|HEAD -> main', 'A||Repository init|'];
      const commitAt = mark(ln(8), 'commit');
      const card = kit.graph(g, {
        x: 226, y: 96, scale: 1.2, from: branchLine, to: to + 0.2,
        keyframes: [
          { at: branchLine, state: gitState(before) },
          { at: commitAt + 0.1, state: gitState([`C|B|${message}|HEAD -> main`, 'B|A|Initial commit|', 'A||Repository init|']) },
        ],
      });
      kit.pin(kit.sticker(g, 'Label', { at: mark(ln(6), 'label'), until: line(ln(7)).start + 0.6, variant: 'gold', iconName: 'tag', rotate: -6 }), card, label('main'), { dx: -18, dy: -46 });
      kit.pin(kit.sticker(g, 'You are here', { at: mark(ln(7), 'head'), until: commitAt + 0.2, variant: 'pink', iconName: 'pin', rotate: 5 }), card, HEAD, { dx: -40, dy: 26 });
      terminal.window(line(ln(8)).start - 0.35, to + 0.1);
      terminal.run(commitAt - 0.05, `git commit -m "${message}"`);
      kit.pin(kit.sticker(g, 'Moves with it', { at: mark(ln(8), 'moves'), variant: 'green', iconName: 'check', rotate: -4 }), card, label('main'), { dx: -150, dy: -44 });
      if (final) {
        if (student) student.appear({ from: branchLine + 0.3, to: to - 0.2, x: 24, y: 140, scale: 0.68 });
        confettiAt(g, mark(ln(8), 'moves') + 0.2);
      }
    }

    function confettiAt(parent, at) {
      kit.confetti(parent, { x: 300, y: 300, at, seed: 5 });
      kit.confetti(parent, { x: 660, y: 300, at: at + 0.15, seed: 9 });
    }

    // ----------------------------------------------------------------
    // Verse 2: a commit is a frozen snapshot with a hash for a name
    // ----------------------------------------------------------------

    function verse2() {
      badge('Verse 2 · Snapshots', 'verse-2');
      const start = song.sectionStart('verse-2');
      const end = song.sectionEnd('verse-2');
      const amendLine = line('verse-2-5').start;

      // The snapshot card: every tracked file, frozen, with who/when/why and a parent.
      const s = kit.scene(content, start, amendLine);
      // Far enough left that its whole "Parent" title shows beside the commit card.
      const parent = kit.place(kit.el('div', 'commit-card commit-card--ghost is-staged', s), 50, 168);
      const parentTitle = kit.el('div', 'commit-card-title', parent);
      parentTitle.append(document.createTextNode('Parent'));
      const card = kit.place(kit.el('div', 'commit-card is-staged', s), 150, 124);
      fx.rise(card, start + 0.1);
      const head = kit.el('div', 'commit-card-title', card);
      head.append(document.createTextNode('Commit'));
      head.append(kit.icon('camera'));
      const grid = kit.el('div', 'commit-card-files', card);
      const whole = mark('verse-2-1', 'whole');
      ['app.py', 'README.md', 'auth.py', 'style.css'].forEach((name, i) => {
        const file = kit.el('div', 'commit-card-file is-staged', grid);
        file.append(kit.icon('file'));
        file.append(document.createTextNode(name));
        fx.pop(file, whole + 0.09 * i);
      });
      const fields = [['who', 'you'], ['when', 'Fri 10:42'], ['why', 'Fix login bug']];
      for (const [key, value] of fields) {
        const row = kit.el('div', 'commit-card-field is-staged', card);
        kit.el('span', 'commit-card-key', row, key);
        kit.el('span', 'commit-card-value', row, value);
        fx.slideIn(row, mark('verse-2-2', key), { dx: 24, duration: 0.3 });
      }
      const frozen = mark('verse-2-1', 'frozen');
      const frost = kit.el('div', 'frost is-staged', card);
      fx.fadeIn(frost, frozen, 0.4);
      kit.sticker(s, 'Frozen', { x: 104, y: 104, at: frozen, until: amendLine, variant: 'cyan', iconName: 'snow', rotate: -8 });
      const link = mark('verse-2-2', 'link');
      fx.slideIn(parent, link, { dx: 50, dy: 20, duration: 0.4 });
      // Hangs on the parent card's corner, clear of the commit card's rows.
      kit.sticker(s, 'Parent', { x: 8, y: 208, at: link + 0.15, until: amendLine, variant: 'violet', iconName: 'pointer', rotate: -6 });

      // Its ID is a hash of all of that — change one byte, get a different ID.
      const hashAt = mark('verse-2-3', 'hash');
      const hashBar = kit.place(kit.el('div', 'hash-bar is-staged', s), 520, 196);
      kit.scramble(hashBar, { at: hashAt, settle: hashAt + 0.9, text: 'a3f2d9c 1e84b07 5c2a', seed: 3 });
      fx.pop(hashBar, hashAt);
      const idLabel = kit.place(kit.el('div', 'subtitle is-staged', s, 'Commit ID'), 520, 166);
      idLabel.style.right = 'auto';
      idLabel.style.textAlign = 'left';
      fx.fadeIn(idLabel, hashAt);
      const byte = mark('verse-2-4', 'byte');
      const changedFile = grid.children[1];
      tween(changedFile, [{ background: '#e2e8f0' }, { background: '#ff5fb0' }], byte, 0.2);
      kit.sticker(s, '1 byte changed', { x: 360, y: 100, at: byte, until: amendLine, variant: 'pink', rotate: 5 });
      const different = mark('verse-2-4', 'different');
      const newHash = kit.place(kit.el('div', 'hash-bar hash-bar--changed is-staged', s), 520, 268);
      kit.scramble(newHash, { at: different - 0.1, settle: different + 0.7, text: '7c19b0e 52da9f1 0e3b', seed: 11 });
      fx.pop(newHash, different - 0.1);
      kit.sticker(s, 'Different ID!', { x: 690, y: 330, at: different + 0.3, until: amendLine, variant: 'pink', iconName: 'warning', rotate: 6 });
      camera.punch(different, 0.03);

      // Commits can't be edited: amend makes a new one and moves the branch.
      const logLine = line('verse-2-7').start;
      const showAt = mark('verse-2-8', 'show');
      terminal.window(amendLine - 0.2, showAt + 1.6);
      const amend = mark('verse-2-5', 'amend');
      terminal.run(amend - 0.1, 'git commit --amend -m "Add login"');
      const g = kit.scene(content, amendLine - 0.1, showAt);
      const A = 'A||Repository init|';
      const B = 'B|A|Initial commit|';
      const card2 = kit.graph(g, {
        x: 120, y: 112, scale: 1.0, from: amendLine - 0.1, to: showAt,
        keyframes: [
          { at: amendLine - 0.1, state: gitState(['C|B|Add logn|HEAD -> main', B, A]) },
          { at: mark('verse-2-5', 'new'), state: gitState(["C'|B|Add login|", 'C|B|Add logn|HEAD -> main', B, A]) },
          { at: mark('verse-2-6', 'moves'), state: gitState(["C'|B|Add login|HEAD -> main", 'C|B|Add logn|', B, A]) },
          // The old commit is left alone: greyed out, but still in the graph.
          { at: mark('verse-2-6', 'old'), state: { ...gitState(["C'|B|Add login|HEAD -> main", 'C|B|Add logn|', B, A]), highlights: { C: '#64748b' } } },
        ],
      });
      kit.pin(kit.sticker(g, 'Can’t edit', { at: mark('verse-2-5', 'edited'), until: mark('verse-2-6', 'old') - 0.1, variant: 'red', iconName: 'lock', rotate: 5 }), card2, node('C'), { anchor: 'right', dx: 150, dy: -10 });
      kit.pin(kit.sticker(g, 'Old one: still there', { at: mark('verse-2-6', 'old'), until: logLine + 0.2, variant: 'white', iconName: 'search', rotate: -4 }), card2, node('C'), { anchor: 'right', dx: 110, dy: -10 });

      // git log walks back through the parents, newest on top.
      terminal.run(mark('verse-2-7', 'log') - 0.15, 'git log --oneline');
      terminal.run(mark('verse-2-7', 'walks'), "C' Add login", { kind: 'output' });
      terminal.run(mark('verse-2-7', 'parents'), 'B  Initial commit', { kind: 'output' });
      walker(g, card2, [["C'", mark('verse-2-7', 'walks')], ['B', mark('verse-2-7', 'back') + 0.25], ['A', mark('verse-2-7', 'parents') + 0.3]], showAt);
      kit.sticker(g, 'Newest on top', { x: 640, y: 128, at: mark('verse-2-7', 'newest'), until: showAt, variant: 'gold', iconName: 'sparkle', rotate: 4 });

      // git show compares a commit with its parent.
      terminal.run(showAt - 0.1, "git show C'");
      const hashLine = line('verse-2-9').start;
      const d = kit.scene(content, showAt, hashLine);
      const diff = kit.place(kit.el('div', 'code-card is-staged', d), 170, 140);
      diff.style.width = '560px';
      fx.rise(diff, showAt + 0.05);
      kit.el('div', 'code-card-title', diff, "app.py — C' vs. its parent");
      kit.el('div', 'code-line code-line--marker', diff, '@@ -1,2 +1,2 @@');
      kit.el('div', 'code-line', diff, ' def greet(name):');
      const removed = kit.el('div', 'code-line code-line--removed', diff, '-    print("Hello " + name)');
      const addedLine = kit.el('div', 'code-line code-line--added', diff, '+    print(f"Hello, {name}!")');
      const added = mark('verse-2-8', 'added');
      const dropped = mark('verse-2-8', 'dropped');
      fx.bump(addedLine, added, 0.06);
      fx.bump(removed, dropped, 0.06);
      kit.sticker(d, '+ Added', { x: 600, y: 268, at: added, until: hashLine, variant: 'green', rotate: -5 });
      kit.sticker(d, '− Dropped', { x: 590, y: 222, at: dropped, until: hashLine, variant: 'red', rotate: 6 });

      // A hash can't drift, so it's a name the whole team can share.
      const c = kit.scene(content, hashLine - 0.1, end + 0.2);
      const shared = kit.place(kit.el('div', 'hash-bar is-staged', c, 'a3f2d9c'), 340, 120);
      shared.prepend(kit.icon('lock'));
      fx.pop(shared, mark('verse-2-9', 'hash'));
      kit.sticker(c, 'Can’t drift', { x: 560, y: 108, at: mark('verse-2-9', 'drift'), variant: 'gold', iconName: 'lock', rotate: 6 });
      const share = mark('verse-2-9', 'share');
      const you = chatRow(c, { x: 90, y: 230, who: 'You', kind: 'you', html: 'it broke at <code>a3f2</code>', at: mark('verse-2-10', 'broke') });
      const sam = chatRow(c, { x: 470, y: 320, who: 'Sam', kind: 'sam', html: 'same snapshot, found it', at: mark('verse-2-10', 'find') });
      fx.pop(you.avatar, share);
      fx.pop(sam.avatar, share + 0.12);
      kit.sticker(c, 'Same snapshot', { x: 640, y: 390, at: mark('verse-2-10', 'find') + 0.3, variant: 'green', iconName: 'check', rotate: -5 });
    }

    function chatRow(parent, { x, y, who, kind, html, at }) {
      const row = kit.place(kit.el('div', 'chat', parent), x, y);
      const avatar = kit.el('div', `chat-avatar chat-avatar--${kind} is-staged`, row, who);
      const bubble = kit.el('div', 'chat-bubble is-staged', row);
      bubble.innerHTML = html;
      fx.pop(bubble, at, { from: 0.6, rotate: -2 });
      return { row, avatar, bubble };
    }

    /** A gold ring that hops from commit to commit (the `git log` walk). */
    function walker(parent, card, hops, until) {
      const ring = kit.el('div', 'walker-ring is-staged', parent);
      fx.fadeIn(ring, hops[0][1], 0.15);
      fx.fadeOut(ring, until - 0.3, 0.2);
      onFrame((t) => {
        let index = -1;
        hops.forEach(([, at], i) => { if (at <= t) index = i; });
        if (index < 0) return;
        const target = card.querySelector(`${node(hops[index][0])} .git-graph-node`);
        const frame = ring.offsetParent;
        if (!target || !frame) return;
        const box = target.getBoundingClientRect();
        const ref = frame.getBoundingClientRect();
        const scale = ref.width / frame.offsetWidth || 1;
        ring.style.left = `${((box.left + box.width / 2 - ref.left) / scale).toFixed(1)}px`;
        ring.style.top = `${((box.top + box.height / 2 - ref.top) / scale).toFixed(1)}px`;
      });
    }

    // ----------------------------------------------------------------
    // Verse 3: branches are labels; HEAD is you; merging
    // ----------------------------------------------------------------

    function verse3() {
      badge('Verse 3 · Pointers', 'verse-3');
      const start = song.sectionStart('verse-3');
      const end = song.sectionEnd('verse-3');
      const mergeLine = line('verse-3-7').start;
      terminal.window(mark('verse-3-2', 'creating') - 0.5, end);
      const A = 'A||Repository init|';
      const B = 'B|A|Initial commit|';

      // Labels on commits; switching moves HEAD and swaps your files.
      const s = kit.scene(content, start, mergeLine);
      const creating = mark('verse-3-2', 'creating');
      const commit = mark('verse-3-4', 'commit');
      const switchAt = mark('verse-3-5', 'switch');
      const dash = mark('verse-3-6', 'dash');
      const card = kit.graph(s, {
        x: 70, y: 112, scale: 1.0, from: start, to: mergeLine,
        keyframes: [
          { at: start, state: gitState(['C|B|Add login|HEAD -> main', B, A]) },
          { at: creating + 0.1, state: gitState(['C|B|Add login|HEAD -> main, feature', B, A]) },
          { at: commit + 0.1, state: gitState(['D|C|Add search|HEAD -> main', 'C|B|Add login|feature', B, A]) },
          { at: switchAt + 0.1, state: gitState(['D|C|Add search|main', 'C|B|Add login|HEAD -> feature', B, A], { head: 'feature' }) },
          { at: dash + 0.15, state: gitState(['D|C|Add search|main', 'C|B|Add login|HEAD -> ui, feature', B, A], { head: 'ui' }) },
        ],
      });
      kit.pin(kit.sticker(s, 'Sticky note', { at: mark('verse-3-1', 'label'), until: creating, variant: 'gold', iconName: 'tag', rotate: -6 }), card, label('main'), { dx: -10, dy: -46 });
      terminal.run(creating - 0.1, 'git branch feature');
      kit.sticker(s, 'Instant', { x: 610, y: 150, at: mark('verse-3-2', 'instant'), until: line('verse-3-3').start + 0.3, variant: 'gold', iconName: 'bolt', rotate: 5 });
      kit.sticker(s, '0 files copied', { x: 610, y: 200, at: mark('verse-3-2', 'nothing'), until: line('verse-3-3').start + 0.3, variant: 'cyan', rotate: -4 });
      kit.pin(kit.sticker(s, 'You are here', { at: mark('verse-3-3', 'here'), until: commit, variant: 'pink', iconName: 'pin', rotate: 5 }), card, HEAD, { dx: -16, dy: -46 });
      terminal.run(commit - 0.1, 'git commit -m "Add search"');
      kit.pin(kit.sticker(s, 'Slides up', { at: mark('verse-3-4', 'slides'), until: switchAt, variant: 'green', iconName: 'pointer', rotate: -4 }), card, label('main'), { dx: -136, dy: -40 });

      terminal.run(switchAt - 0.1, 'git switch feature');
      const files = kit.place(kit.el('div', 'station is-staged', s), 640, 270);
      files.style.width = '260px';
      files.style.height = '150px';
      const filesHead = kit.el('div', 'station-head', files);
      filesHead.append(kit.icon('laptop'));
      filesHead.append(document.createTextNode('Working tree'));
      fx.rise(files, switchAt);
      const swaps = mark('verse-3-5', 'swaps');
      fx.pop(kit.chip(files, { name: 'login.py', x: 16, y: 54 }), switchAt + 0.05);
      const search = kit.chip(files, { name: 'search.py', x: 16, y: 98 });
      fx.pop(search, switchAt + 0.12);
      tween(search, { opacity: 0, rotate: '90deg', scale: 0.5 }, swaps, 0.35, EASE.in);
      kit.sticker(s, 'Files swap', { x: 760, y: 238, at: swaps, until: dash, variant: 'cyan', iconName: 'forward', rotate: 6 });
      terminal.run(dash - 0.2, 'git switch -c ui');
      kit.sticker(s, 'New branch + switch', { x: 640, y: 200, at: dash + 0.2, until: mergeLine, variant: 'gold', iconName: 'bolt', rotate: -5 });

      // Both sides moved on: a merge commit with two parents.
      const ffLine = line('verse-3-8').start;
      const m = kit.scene(content, mergeLine - 0.1, ffLine);
      const mergeAt = mark('verse-3-7', 'merge');
      const parents = mark('verse-3-7', 'parents');
      const mergeCard = kit.graph(m, {
        x: 90, y: 104, scale: 0.94, from: mergeLine - 0.1, to: ffLine,
        keyframes: [
          { at: mergeLine - 0.1, state: gitState(['E|C|Add UI|ui', 'D|C|Add search|HEAD -> main', 'C||Add login|']) },
          { at: parents, state: gitState(["M|D E|Merge branch 'ui'|HEAD -> main", 'E|C|Add UI|ui', 'D|C|Add search|', 'C||Add login|']) },
        ],
      });
      terminal.run(mergeAt - 0.15, 'git merge ui');
      kit.pin(kit.sticker(m, '2 parents', { at: parents + 0.25, until: ffLine, variant: 'gold', iconName: 'merge', rotate: 5 }), mergeCard, node('M'), { anchor: 'right', dx: 160, dy: -12 });
      kit.sticker(m, 'Lines converge', { x: 640, y: 330, at: mark('verse-3-7', 'converge'), until: ffLine, variant: 'cyan', iconName: 'merge', rotate: -4 });
      camera.punch(parents + 0.05, 0.035);

      // If yours stood still: fast-forward — the label just slides.
      const conflictLine = line('verse-3-9').start;
      const f = kit.scene(content, ffLine - 0.1, conflictLine);
      const slides = mark('verse-3-8', 'slides');
      const ffCard = kit.graph(f, {
        x: 130, y: 112, scale: 1.05, from: ffLine - 0.1, to: conflictLine,
        keyframes: [
          { at: ffLine - 0.1, state: gitState(['D|C|Add docs|feature', 'C|B|Add tests|', 'B||Initial commit|HEAD -> main']) },
          { at: slides + 0.1, state: gitState(['D|C|Add docs|HEAD -> main, feature', 'C|B|Add tests|', 'B||Initial commit|']) },
        ],
      });
      kit.pin(kit.sticker(f, 'Stood still', { at: mark('verse-3-8', 'yours'), until: slides + 0.2, variant: 'white', iconName: 'pin', rotate: -5 }), ffCard, label('main'), { dx: 0, dy: 26 });
      terminal.run(slides - 0.2, 'git merge feature');
      kit.pin(kit.sticker(f, 'Fast-forward', { at: mark('verse-3-8', 'fast'), until: conflictLine, variant: 'gold', iconName: 'forward', rotate: 5 }), ffCard, label('main'), { dx: 0, dy: -50 });

      // Same lines changed on both sides: a conflict to resolve.
      const c = kit.scene(content, conflictLine - 0.1, end + 0.2);
      const same = mark('verse-3-9', 'same');
      const ours = codeCard(c, { x: 60, y: 128, width: 400, title: 'main: greet.py', lines: [['', 'return f"{last}, {first}"']], at: same });
      const theirs = codeCard(c, { x: 500, y: 128, width: 400, title: 'feature: greet.py', lines: [['', 'return f"{first} {last}"']], at: same + 0.15 });
      const conflict = mark('verse-3-9', 'conflict');
      const fixAt = mark('verse-3-10', 'fix');
      const merged = codeCard(c, {
        x: 200, y: 222, width: 560, title: 'greet.py after git merge', at: conflict - 0.1,
        lines: [
          ['', 'def format_name(first, last):'],
          ['marker', '<<<<<<< HEAD'],
          ['', '    return f"{last}, {first}"'],
          ['marker', '======='],
          ['', '    return f"{first} {last}"'],
          ['marker', '>>>>>>> feature'],
        ],
      });
      kit.stamp(c, 'Conflict!', { x: 630, y: 300, at: conflict, until: fixAt + 0.2, rotate: -8 });
      terminal.run(mark('verse-3-9', 'stops') - 0.2, 'git merge feature');
      terminal.run(mark('verse-3-9', 'stops') + 0.15, 'CONFLICT in greet.py', { kind: 'error' });
      // Fix the file: drop the markers and the losing line.
      for (const index of [1, 3, 4, 5]) {
        tween(merged.lines[index], { opacity: 0, height: '0px', paddingTop: '0px', paddingBottom: '0px' }, fixAt + 0.05 * index, 0.3, EASE.in);
      }
      fx.exit(ours, fixAt, { dx: 0, dy: -20 });
      fx.exit(theirs, fixAt, { dx: 0, dy: -20 });
      terminal.run(mark('verse-3-10', 'add') - 0.15, 'git add greet.py');
      terminal.run(mark('verse-3-10', 'commit') - 0.05, 'git commit');
      const done = mark('verse-3-10', 'done');
      kit.stamp(c, 'Merged', { x: 560, y: 330, at: done, color: 'green', rotate: -6, shake: false });
      kit.confetti(c, { x: 480, y: 330, at: done + 0.1, seed: 13 });
    }

    function codeCard(parent, { x, y, width, title, lines, at }) {
      const cardNode = kit.place(kit.el('div', 'code-card is-staged', parent), x, y);
      cardNode.style.width = `${width}px`;
      kit.el('div', 'code-card-title', cardNode, title);
      const lineNodes = lines.map(([kind, text]) => kit.el('div', `code-line${kind ? ` code-line--${kind}` : ''}`, cardNode, text));
      fx.rise(cardNode, at);
      cardNode.lines = lineNodes;
      return cardNode;
    }

    // ----------------------------------------------------------------
    // Bridge: remotes, a rejected push, force-push, and unsaved work
    // ----------------------------------------------------------------

    function bridge() {
      badge('Bridge · Remotes & safety', 'bridge');
      const start = song.sectionStart('bridge');
      const end = song.sectionEnd('bridge');
      terminal.window(start + 0.1, end);
      const rejectLine = line('bridge-5').start;
      // Keep the student between the two repositories while their laptop
      // pushes, fetches, and pulls. Leave before the wider rejected-push graphs.
      if (student) student.appear({ from: start + 0.35, to: rejectLine - 0.2, x: 400, y: 165, scale: 0.6 });

      // Push, fetch, pull: your laptop and the remote side by side.
      const s = kit.scene(content, start, rejectLine);
      const push = mark('bridge-1', 'push');
      const fetch = mark('bridge-2', 'fetch');
      const teams = mark('bridge-2', 'teams');
      const merge = mark('bridge-4', 'merge');
      const B = 'B||Initial commit|';
      const local = kit.graph(s, {
        x: 24, y: 120, scale: 0.86, title: 'Your laptop', iconName: 'laptop', from: start, to: rejectLine,
        keyframes: [
          { at: start, state: gitState(['C|B|Add search|HEAD -> main', 'B||Initial commit|origin/main']) },
          { at: push + 0.15, state: gitState(['C|B|Add search|HEAD -> main, origin/main', B]) },
          { at: teams, state: gitState(['T|C|Add avatars|origin/main', 'C|B|Add search|HEAD -> main', B]) },
          { at: merge + 0.1, state: gitState(['T|C|Add avatars|HEAD -> main, origin/main', 'C|B|Add search|', B]) },
        ],
      });
      kit.graph(s, {
        right: 24, y: 120, scale: 0.86, title: 'Remote', iconName: 'cloud', from: start, to: rejectLine,
        keyframes: [
          { at: start, state: gitState(['B||Initial commit|main'], { head: '' }) },
          { at: push + 0.3, state: gitState(['C|B|Add search|main', B], { head: '' }) },
          { at: fetch - 0.35, state: gitState(['T|C|Add avatars|main', 'C|B|Add search|', B], { head: '' }) },
        ],
      });
      terminal.run(push - 0.15, 'git push');
      kit.sticker(s, 'Teammate pushed', { x: 700, y: 400, at: fetch - 0.35, until: line('bridge-3').start, variant: 'pink', iconName: 'team', rotate: 5 });
      terminal.run(fetch - 0.1, 'git fetch');
      kit.sticker(s, 'Files untouched', { x: 70, y: 400, at: mark('bridge-2', 'touch'), until: line('bridge-4').start, variant: 'cyan', iconName: 'shield', rotate: -4 });
      kit.pin(kit.sticker(s, 'Stays put', { at: mark('bridge-3', 'stay'), until: merge, variant: 'white', iconName: 'pin', rotate: -5 }), local, label('main'), { dx: 0, dy: 26 });
      kit.pin(kit.sticker(s, 'Moved', { at: mark('bridge-3', 'origin'), until: merge, variant: 'gold', iconName: 'pointer', rotate: 5 }), local, label('origin/main'), { dx: 0, dy: -46 });
      const pull = mark('bridge-4', 'pull');
      terminal.run(pull - 0.1, 'git pull');
      kit.sticker(s, 'pull = fetch + merge', { x: 300, y: 400, at: pull, until: rejectLine, variant: 'gold', rotate: -3 });
      kit.sticker(s, 'Files change', { x: 70, y: 400, at: mark('bridge-4', 'change'), until: rejectLine, variant: 'green', iconName: 'forward', rotate: 4 });

      // Push rejected → pull, push again. Force-push? Better not.
      const slamLine = line('bridge-7').start;
      const r = kit.scene(content, rejectLine - 0.1, slamLine);
      const pull2 = mark('bridge-6', 'pull');
      const push2 = mark('bridge-6', 'push');
      const T = 'T||Add avatars|';
      kit.graph(r, {
        x: 24, y: 112, scale: 0.8, title: 'Your laptop', iconName: 'laptop', from: rejectLine - 0.1, to: slamLine,
        keyframes: [
          { at: rejectLine - 0.1, state: gitState(['L|T|Fix avatar|HEAD -> main', 'T||Add avatars|origin/main']) },
          { at: pull2 + 0.15, state: gitState(['M|L U|Merge origin/main|HEAD -> main', 'U|T|Add badges|origin/main', 'L|T|Fix avatar|', T]) },
          { at: push2 + 0.15, state: gitState(['M|L U|Merge origin/main|HEAD -> main, origin/main', 'U|T|Add badges|', 'L|T|Fix avatar|', T]) },
        ],
      });
      kit.graph(r, {
        right: 24, y: 112, scale: 0.8, title: 'Remote', iconName: 'cloud', from: rejectLine - 0.1, to: slamLine,
        keyframes: [
          { at: rejectLine - 0.1, state: gitState(['U|T|Add badges|main', T], { head: '' }) },
          { at: push2 + 0.3, state: gitState(['M|L U|Merge origin/main|main', 'U|T|Add badges|', 'L|T|Fix avatar|', T], { head: '' }) },
        ],
      });
      const push1 = mark('bridge-5', 'push');
      terminal.run(push1 - 0.1, 'git push');
      const rejected = mark('bridge-5', 'rejected');
      terminal.run(rejected + 0.05, '! [rejected] (fetch first)', { kind: 'error' });
      kit.stamp(r, 'Rejected', { x: 330, y: 330, at: rejected, until: pull2 - 0.1, rotate: -8 });
      kit.sticker(r, 'You don’t have U', { x: 700, y: 330, at: mark('bridge-5', 'havent'), until: pull2 + 0.3, variant: 'pink', iconName: 'warning', rotate: 5 });
      terminal.run(pull2 - 0.1, 'git pull');
      terminal.run(push2 - 0.05, 'git push');
      const force = mark('bridge-6', 'force');
      terminal.run(force, 'git push --force', { kind: 'struck' });
      kit.stamp(r, 'Better not', { x: 320, y: 330, at: mark('bridge-6', 'better'), until: slamLine, rotate: -7 });

      // What a force-push does: the remote's pointer slams onto your commit.
      const wipeLine = line('bridge-9').start;
      const w = kit.scene(content, slamLine - 0.1, wipeLine);
      const slams = mark('bridge-7', 'slams');
      const falls = mark('bridge-8', 'falls');
      const whatIf = kit.graph(w, {
        x: 250, y: 100, scale: 0.88, title: 'Remote, after git push --force', iconName: 'cloud', from: slamLine - 0.1, to: wipeLine,
        keyframes: [
          { at: slamLine - 0.1, state: gitState(['V|U|Add chat|main', 'U|T|Add badges|', T], { head: '' }) },
          { at: slams + 0.05, state: gitState(['X|T|Your work|main', 'V|U|Add chat|', 'U|T|Add badges|', T], { head: '' }) },
          { at: falls + 0.05, state: gitState(['X|T|Your work|main', T], { head: '' }) },
        ],
      });
      camera.shake(slams + 0.15, 10);
      for (const [hash, delay] of [['V', 0], ['U', 0.12]]) {
        const token = kit.el('div', 'falling-commit is-staged', w, hash);
        kit.pin(token, whatIf, `${node(hash)} .git-graph-node`, { dx: -22, dy: -22, anchorAt: falls + delay });
        tween(token, [{ opacity: 1 }, { opacity: 1 }], falls + delay, 0.01);
        kit.fall(token, falls + delay, { spin: delay ? -260 : 240, drift: delay ? -40 : 50 });
      }
      kit.sticker(w, 'Teammates’ work', { x: 680, y: 300, at: falls, until: wipeLine, variant: 'pink', iconName: 'team', rotate: 6 });
      kit.stamp(w, 'Don’t do it', { x: 300, y: 360, at: mark('bridge-8', 'dont'), until: wipeLine, rotate: -6 });

      // Uncommitted work isn't safe.
      const u = kit.scene(content, wipeLine - 0.1, end + 0.2);
      const wt = kit.station(u, { x: 60, y: 140, w: 330, h: 200, label: 'Working tree', iconName: 'laptop' }).enter(wipeLine - 0.1);
      const unsaved = kit.chip(u, { name: 'app.py', version: 'unsaved edits', x: 80, y: 220, dashed: true });
      fx.pop(unsaved, wipeLine);
      onFrame((t) => {
        const age = t - wipeLine;
        unsaved.style.rotate = age > 0 && age < 2.4 ? `${(2.2 * Math.sin(age * 22)).toFixed(2)}deg` : '';
      });
      kit.sticker(u, 'Not safe', { x: 250, y: 120, at: mark('bridge-9', 'safe'), variant: 'red', iconName: 'warning', rotate: 6 });
      kit.graph(u, {
        x: 470, y: 130, scale: 0.92, title: 'History', iconName: 'stack', from: wipeLine - 0.1, to: end + 0.2,
        keyframes: [{ at: wipeLine - 0.1, state: gitState(['C|B|Add search|HEAD -> main', 'B|A|Initial commit|', 'A||Repository init|']) }],
      });
      terminal.run(mark('bridge-10', 'restore') - 0.1, 'git restore app.py');
      terminal.run(mark('bridge-10', 'reset') - 0.05, 'git reset --hard');
      const wipe = mark('bridge-10', 'wipe');
      tween(unsaved, { opacity: 0, scale: 1.4, filter: 'blur(10px)' }, wipe, 0.45, EASE.in);
      kit.sticker(u, 'Wiped', { x: 160, y: 270, at: wipe + 0.1, variant: 'red', iconName: 'cross', rotate: -6 });
      kit.sticker(u, 'No trace', { x: 640, y: 420, at: mark('bridge-10', 'trace') - 0.2, variant: 'white', iconName: 'search', rotate: 4 });
      void wt;
    }

    // ----------------------------------------------------------------
    // Quiz: call and response
    // ----------------------------------------------------------------

    function quiz() {
      badge('Pop quiz', 'quiz');
      const { lines } = song.storyboard.sections.find((section) => section.id === 'quiz');
      const QUIZ_ICONS = ['laptop', 'camera', 'stack', 'pointer', 'cloud', 'lock'];
      lines.forEach((entry, i) => {
        const from = entry.start - 0.15;
        const to = i + 1 < lines.length ? lines[i + 1].start - 0.15 : song.sectionEnd('quiz');
        const s = kit.scene(content, from, to, { enter: 'whip' });
        const cardNode = kit.el('div', 'quiz-card', s);
        kit.el('div', 'quiz-count', cardNode, `Quiz ${i + 1} / ${lines.length}`);
        kit.el('div', 'quiz-question', cardNode, entry.text);
        const answer = kit.el('div', 'quiz-answer is-staged', cardNode);
        answer.append(kit.icon(QUIZ_ICONS[i]));
        answer.append(document.createTextNode(entry.answer));
        fx.slam(answer, entry.answer_at, { from: 1.6 });
        camera.punch(entry.answer_at + 0.05, 0.03);
      });
    }

    // ----------------------------------------------------------------
    // Outro: travel back to any commit — that's your Time Stone
    // ----------------------------------------------------------------

    function outro() {
      const start = song.sectionStart('outro');
      const end = song.duration;
      const s = kit.scene(content, start, end - 0.4, { exit: 'fade' });
      if (student) student.appear({ from: start + 0.35, to: end - 0.6, x: 36, y: 90, scale: 0.8 });
      kit.timeStone(s, { x: 480, y: 190, size: 220, from: start + 0.05, to: end - 0.4, spin: -1.6 });
      const travel = mark('outro-1', 'travel');
      const rewind = kit.el('div', 'layer rewind-lines is-staged', s);
      tween(rewind, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], travel, 2.2, EASE.linear);
      kit.sticker(s, 'Rewind', { x: 640, y: 110, at: travel, until: mark('outro-1', 'time'), variant: 'cyan', iconName: 'rewind', rotate: 6 });

      // HEAD hops back along a row of commits.
      const commits = ['A', 'B', 'C', 'D'];
      const row = kit.el('div', 'timeline-row is-staged', s);
      fx.fadeIn(row, travel - 0.1, 0.2);
      fx.fadeOut(row, mark('outro-1', 'time') - 0.1, 0.25);
      commits.forEach((hash, i) => {
        const dot = kit.el('div', 'timeline-dot', row, hash);
        dot.style.left = `${i * 120}px`;
      });
      const headPin = kit.el('div', 'timeline-head', row, 'HEAD');
      const back = mark('outro-1', 'back');
      onFrame((t) => {
        const p = window.Timeline.easeInOutCubic(window.Timeline.progress(t, back - 0.2, 1.6));
        headPin.style.left = `${(360 - 360 * p).toFixed(1)}px`;
      });

      kit.kinetic(s, [{ text: 'That’s your Time Stone', at: mark('outro-1', 'time'), color: 'gold' }], { y: 352, size: 48, until: mark('outro-2', 'snapshots') - 0.1 });
      kit.kinetic(s, [
        { text: 'Snapshots', at: mark('outro-2', 'snapshots'), iconName: 'camera' },
        { text: '&', at: mark('outro-2', 'snapshots') + 0.5 },
        { text: 'pointers', at: mark('outro-2', 'pointers'), color: 'cyan', iconName: 'pointer' },
      ], { y: 344, size: 58 });
      const credit = kit.el('div', 'end-credit is-staged', s, 'SE Book · Version Control with Git');
      credit.style.top = '420px';
      fx.fadeIn(credit, mark('outro-2', 'pointers') + 0.8, 0.5);
    }

    // ----------------------------------------------------------------

    intro();
    verse1();
    chorus(1, { message: 'Add login' });
    verse2();
    chorus(2, { message: 'Fix typo' });
    verse3();
    chorus(3, { message: 'Add search' });
    bridge();
    quiz();
    chorus(4, { message: 'Ship it', title: 'Final chorus', final: true });
    outro();
  };
})();
