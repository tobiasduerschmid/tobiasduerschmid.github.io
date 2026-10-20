/*
 * Choreography for "Small Tools, One Job Each", the shell scripting song
 * (storyboard: _data/songs/small_tools_one_job_each.yml).
 *
 * Every visual hits a sung word: `mark(lineId, word)` is that word's time in
 * the recording. The teaching rule for the visuals: show exactly what the
 * line says — the real command, what the shell does with it, and its result —
 * one idea per scene, so each picture can be read in the seconds the line
 * lasts. Each idea is drawn as one visual metaphor that carries the concept
 * itself (scissors for word splitting, a filing cabinet for PATH, a conveyor
 * belt for a pipeline; see js/song-video/shell-kit.js), always beside the
 * real notation. Stickers, stamps, and kinetic type only emphasize sung
 * words. Each line's `visual` text in the storyboard describes this file.
 *
 * Layout: 960×540 stage; the section badge sits top-left, the HUD terminal
 * (typed commands) top-right (x ≥ 600, y ≤ 116), and nothing essential goes
 * below y = 460, where the player draws captions.
 */
(function () {
  'use strict';

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.small_tools_one_job_each = function choreograph({ song, kit, layers, terminal, student }) {
    const { fx, tween, EASE, camera } = window.Timeline;
    const sh = window.ShellKit;
    const { content, hud } = layers;
    const line = (id) => song.line(id);
    const mark = (id, word) => song.mark(id, word);

    function badge(text, sectionId) {
      kit.badge(hud, text, song.sectionStart(sectionId), song.sectionEnd(sectionId));
    }

    function label(parent, className, text, x, y, at, until) {
      const node = kit.place(kit.el('div', `${className} is-staged`, parent, text), x, y);
      fx.pop(node, at, { from: 0.6, rotate: 0 });
      if (until !== undefined) fx.popOut(node, until);
      return node;
    }

    function counter(parent, { x, y, at, until, text, value }) {
      const node = kit.place(kit.el('div', 'sh-count is-staged', parent), x, y);
      kit.el('b', null, node, value);
      node.append(document.createTextNode(text));
      fx.pop(node, at, { rotate: -3 });
      if (until !== undefined) fx.popOut(node, until);
      return node;
    }

    // ----------------------------------------------------------------
    // Intro: three hundred trip photos, renamed by one line
    // ----------------------------------------------------------------

    function intro() {
      const end = song.sectionEnd('intro');
      const lineAt = mark('intro-4', 'the');
      const s = kit.scene(content, 0, lineAt + 0.6, { exit: 'fade' });
      const loop = 'for f in *.jpg; do mv "$f" "trip_$f"; done';
      const renamed = mark('intro-3', 'done');
      student?.appear({ from: 0.5, to: mark('intro-3', 'type') - 0.3, x: 665, y: 132, scale: 0.96 });
      const photos = [];
      for (let i = 0; i < 12; i++) {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const name = `IMG_${412 + i}.jpg`;
        photos.push(sh.photo(s, {
          x: 24 + col * 142, y: 92 + row * 118, name, variant: i, rotate: ((i * 37) % 9) - 4,
          at: 0.2 + i * 0.2,
          renames: [{ at: renamed + 0.035 * i, name: `trip_${name}` }],
        }));
      }
      counter(s, { x: 420, y: 52, at: mark('intro-1', 'hundred') + 0.4, until: mark('intro-2', 'rename'), value: '×300', text: 'trip pics' });

      // By hand: one rename at a time, and the weekend is gone.
      fx.bump(photos[0], mark('intro-2', 'rename'), 0.2);
      kit.sticker(s, '1 of 300…', { x: 66, y: 56, at: mark('intro-2', 'hand'), until: mark('intro-3', 'or'), variant: 'white', iconName: 'pencil', rotate: -5 });
      kit.sticker(s, 'Weekend: gone', { x: 250, y: 54, at: mark('intro-2', 'weekend'), until: mark('intro-3', 'or'), variant: 'pink', iconName: 'hourglass', rotate: 4 });
      for (const card of photos) tween(card, { opacity: 0.55 }, mark('intro-2', 'weekend') + 0.2, 0.4, EASE.inOut);
      for (const card of photos) tween(card, { opacity: 1 }, renamed - 0.2, 0.3, EASE.inOut);

      // One line in the shell renames all of them.
      const typeAt = mark('intro-3', 'type');
      // Reflow the gallery into two rows to make room for the full command
      // without shrinking either the command or the photo filenames.
      photos.forEach((card, i) => fx.moveTo(card, typeAt - 0.25,
        (i % 6) * 150 - (i % 4) * 142,
        72 + Math.floor(i / 6) * 126 - (92 + Math.floor(i / 4) * 118), 0.4));
      const win = sh.session(s, { x: 286, y: 344, w: 646, rows: 1, title: '~/trip', at: typeAt });
      win.run(mark('intro-3', 'one'), loop);
      kit.sticker(s, '1 line', { x: 52, y: 340, at: mark('intro-3', 'line'), until: lineAt + 0.4, variant: 'gold', iconName: 'terminal', rotate: 5 });
      counter(s, { x: 36, y: 408, at: renamed + 0.4, until: lineAt + 0.4, value: '300/300', text: 'renamed' });
      camera.punch(mark('intro-3', 'blink'), 0.03);

      // Exactly what you type, not what you think.
      commandExample(lineAt + 0.3, end);
    }

    // Contrast only the quotes: the same intended name is either two
    // arguments or one. Leave time to predict before revealing the folders.
    function commandExample(from, to) {
      const s = kit.scene(content, from, to);
      const typed = mark('intro-4', 'type');
      const reveal = line('intro-4').end + 1;
      student?.appear({ from, to, x: 42, y: 196, scale: 0.78 });
      sh.thought(s, { x: 34, y: 80, w: 238, text: 'One folder called trip photos', at: mark('intro-4', 'shell') });
      kit.kinetic(s, [
        { text: 'Exactly', at: mark('intro-4', 'exactly'), color: 'gold' },
        { text: 'what you type', at: typed },
      ], { y: 32, size: 40 });
      label(s, 'sh-note sh-note--white', 'How many folders?', 477, 92, typed, reveal - 0.3);
      sh.commandResult(s, {
        x: 296, y: 143, title: 'Without quotes', words: ['mkdir', 'trip', 'photos'],
        folders: ['trip', 'photos'], conclusion: '2 arguments · 2 folders',
        at: typed, resultAt: reveal,
      });
      sh.commandResult(s, {
        x: 296, y: 303, title: 'With quotes', words: ['mkdir', '"trip photos"'],
        folders: ['trip photos'], conclusion: '1 argument · 1 folder',
        at: reveal + 3.2, resultAt: reveal + 4.2,
      });
    }

    // ----------------------------------------------------------------
    // Verse 1: how the shell reads a line, finds a command, and paths
    // ----------------------------------------------------------------

    function verse1() {
      badge('Verse 1 · How the shell reads a line', 'verse-1');
      const start = song.sectionStart('verse-1');
      const end = song.sectionEnd('verse-1');

      // The shell reads a line; scissors cut it into words at the spaces.
      const quotesLine = line('verse-1-3').start;
      const a = kit.scene(content, start, quotesLine - 0.1);
      const shell = kit.place(kit.el('div', 'sh-badge is-staged', a), 294, 112);
      shell.append(kit.icon('gear'));
      shell.append(document.createTextNode('the shell: a command-line interpreter'));
      fx.pop(shell, mark('verse-1-1', 'shell'), { rotate: 0 });
      const words = sh.tokens(a, {
        y: 236, at: mark('verse-1-1', 'line'), splitAt: mark('verse-1-1', 'spaces'), size: 40,
        words: [
          { text: 'cp', label: 'command', labelAt: mark('verse-1-2', 'command'), tone: 'command' },
          { text: 'notes.txt', label: 'argument 1', labelAt: mark('verse-1-2', 'arguments'), tone: 'arg' },
          { text: 'backup.txt', label: 'argument 2', labelAt: mark('verse-1-2', 'arguments') + 0.25, tone: 'arg' },
        ],
      });
      fx.bump(words.row, mark('verse-1-1', 'reads'), 0.05);
      sh.scissors(a, { row: words, times: [mark('verse-1-1', 'splits'), mark('verse-1-1', 'at')], until: mark('verse-1-1', 'spaces') + 0.05 });

      // Quotes tape "my notes" into one argument; without them, it's two.
      const pathLine = line('verse-1-5').start;
      const b = kit.scene(content, quotesLine - 0.1, pathLine - 0.05);
      fx.pop(kit.chip(b, { name: 'my notes', x: 418, y: 110 }), mark('verse-1-3', 'file'));
      const quotes = mark('verse-1-3', 'quotes');
      const taped = sh.tokens(b, {
        y: 180, at: quotes - 0.1, splitAt: quotes + 0.35, size: 34,
        words: [
          { text: 'ls', label: 'command', tone: 'command' },
          { text: '"my notes"', label: '1 argument ✓', tone: 'good', tape: true, seam: 3.5, tapeAt: quotes + 0.05 },
        ],
      });
      sh.scissors(b, { row: taped, times: [quotes + 0.18], until: quotes + 0.4 });
      label(b, 'sh-note sh-note--gold', 'quotes tape it together', 646, 186, quotes + 0.25, pathLine - 0.3);
      const passes = mark('verse-1-4', 'sees');
      const loose = sh.tokens(b, {
        y: 316, at: passes - 0.2, splitAt: mark('verse-1-4', 'words') + 0.15, size: 34,
        words: [
          { text: 'ls', label: 'command', tone: 'command' },
          { text: 'my', label: 'argument 1', labelAt: mark('verse-1-4', 'my'), tone: 'bad' },
          { text: 'notes', label: 'argument 2', labelAt: mark('verse-1-4', 'notes'), tone: 'bad' },
        ],
      });
      sh.scissors(b, { row: loose, times: [passes + 0.1, mark('verse-1-4', 'words')], until: mark('verse-1-4', 'words') + 0.2 });
      kit.sticker(b, 'No quotes', { x: 104, y: 322, at: passes - 0.2, variant: 'red', iconName: 'warning', rotate: -5 });

      // A command that isn't built in: PATH's drawers, searched in order.
      const treeLine = line('verse-1-9').start;
      const c = kit.scene(content, pathLine - 0.05, treeLine - 0.05);
      terminal.window(pathLine, treeLine);
      kit.sticker(c, 'built-ins: cd, echo…', { x: 30, y: 74, at: mark('verse-1-5', 'built'), until: mark('verse-1-5', 'path') + 0.6, variant: 'white sticker--keepcase', rotate: -3 });
      const searches = mark('verse-1-5', 'checks');
      const env = kit.place(kit.el('div', 'sh-env is-staged', c), 28, 120);
      env.innerHTML = '<b>PATH</b>=/usr/local/bin:/usr/bin:/bin';
      fx.rise(env, mark('verse-1-5', 'path'), { distance: 14 });
      kit.sticker(c, 'environment variable', { x: 488, y: 126, at: mark('verse-1-6', 'environment'), until: treeLine - 0.3, variant: 'gold', rotate: 3 });
      const cabinet = sh.cabinet(c, {
        x: 40, y: 168, w: 250, at: searches,
        drawers: [
          { label: '/usr/local/bin', files: ['node', 'python3'] },
          { label: '/usr/bin', files: ['git', 'grep'] },
          { label: '/bin', files: ['cat', 'ls'] },
        ],
      });
      terminal.run(searches - 0.1, 'ls');
      // "directories, searched in order": one drawer per beat, ls found on "order".
      const listing = mark('verse-1-6', 'directories');
      const order = mark('verse-1-6', 'order');
      const hit = order + 0.1;
      const opens = [listing, (listing + order) / 2 - 0.1, order - 0.25];
      cabinet.open(0, opens[0], opens[1] - 0.05);
      cabinet.open(1, opens[1], opens[2] - 0.05);
      cabinet.open(2, opens[2], treeLine - 0.4);
      cabinet.verdict(0, opens[0] + 0.35, false, treeLine - 0.4);
      cabinet.verdict(1, opens[1] + 0.35, false, treeLine - 0.4);
      cabinet.verdict(2, hit, true, treeLine - 0.4);
      cabinet.hit(2, 1, hit);
      const scanner = kit.el('div', 'sh-scanner is-staged', c);
      scanner.append(kit.icon('search'));
      scanner.append(document.createTextNode('ls'));
      fx.pop(scanner, opens[0], { rotate: 0 });
      fx.popOut(scanner, hit + 0.8);
      sh.mover(scanner, [
        { x: 494, y: 222 },
        { at: opens[1] - 0.1, x: 494, y: 286, duration: 0.25 },
        { at: opens[2] - 0.1, x: 494, y: 350, duration: 0.25 },
      ]);

      // The current directory: a folder on the desk, not in the cabinet.
      const current = mark('verse-1-7', 'current');
      const desk = sh.desk(c, { x: 590, y: 200, w: 300, label: '~/cs35l', files: ['hello.sh'], at: current - 0.1 });
      label(c, 'sh-note sh-note--pink', 'current directory', 640, 168, current, treeLine - 0.4);
      kit.stamp(c, 'Not on PATH', { x: 600, y: 376, at: mark('verse-1-7', 'isn'), until: mark('verse-1-8', 'dot') - 0.1, rotate: -6, shake: false });
      terminal.run(mark('verse-1-7', 'list') - 0.25, 'hello.sh');
      terminal.run(mark('verse-1-7', 'list') + 0.25, 'zsh: command not found: hello.sh', { kind: 'error' });
      const dot = mark('verse-1-8', 'dot');
      terminal.run(dot - 0.1, './hello.sh');
      kit.flow(c, { from: [500, 420], to: [690, 270], bend: -20, color: 'gold', at: dot, label: './ = the one right here', labelAt: [318, 410] });
      desk.hit(0, mark('verse-1-8', 'slash'));
      desk.verdict(mark('verse-1-8', 'slash'), true);

      // The working directory on a map: you are here, .., ~, then two kinds of path.
      const d = kit.scene(content, treeLine - 0.05, end);
      const working = mark('verse-1-9', 'p');
      const tree = sh.tree(d, {
        x: 64, y: 116, dx: 92, dy: 46,
        nodes: [
          { id: 'root', name: '/', col: 0, row: 0, at: working - 0.1, root: true },
          { id: 'bin', name: 'bin', col: 1, row: 1, parent: 'root', at: working },
          { id: 'home', name: 'home', col: 1, row: 2, parent: 'root', at: working + 0.08 },
          { id: 'me', name: 'me', col: 2, row: 3, parent: 'home', at: working + 0.16 },
          { id: 'cs35l', name: 'cs35l', col: 3, row: 4, parent: 'me', at: working + 0.24 },
          { id: 'hw1', name: 'hw1', col: 4, row: 5, parent: 'cs35l', at: working + 0.32 },
          { id: 'tests', name: 'tests', col: 5, row: 6, parent: 'hw1', at: working + 0.4 },
        ],
      });
      const where = mark('verse-1-9', 'prints');
      tree.tag('hw1', '.', where, { tone: 'green', note: 'you are here', iconName: 'pin' });
      terminal.window(where - 0.3, end);
      terminal.run(where - 0.2, 'pwd');
      terminal.run(where + 0.25, '/home/me/cs35l/hw1', { kind: 'output' });
      tree.tag('cs35l', '..', mark('verse-1-10', 'parent'), { tone: 'cyan', note: 'parent' });
      tree.route(['hw1', 'cs35l'], mark('verse-1-10', 'dot_2'), { tone: 'cyan', until: mark('verse-1-11', 'slash') });
      tree.tag('me', '~', mark('verse-1-10', 'tilde'), { tone: 'gold', note: 'home', iconName: 'house' });

      sh.pathCard(d, {
        x: 626, y: 150, kind: 'absolute = full address', path: '/home/me/cs35l/hw1/tests',
        note: 'starts at the root, works from anywhere', tone: 'gold', iconName: 'envelope', at: mark('verse-1-11', 'slash'),
      });
      tree.route(['root', 'home', 'me', 'cs35l', 'hw1', 'tests'], mark('verse-1-11', 'root') - 0.35, { tone: 'gold', perHop: 0.16 });
      sh.pathCard(d, {
        x: 702, y: 270, kind: 'relative = directions', path: 'tests',
        note: 'starts from right here (.)', tone: 'cyan', iconName: 'forward', at: mark('verse-1-12', 'relative'),
      });
      tree.route(['hw1', 'tests'], mark('verse-1-12', 'starts'), { tone: 'cyan', perHop: 0.4 });
    }

    // ----------------------------------------------------------------
    // Chorus: small machines on a conveyor belt — stdout → stdin, stderr
    // through a side hatch, and an exit-code beacon on every machine
    // ----------------------------------------------------------------

    const PIPELINES = {
      names: {
        tools: [
          { cmd: 'sort names.txt', job: 'order' },
          { cmd: 'uniq', job: 'dedupe' },
          { cmd: 'wc -l', job: 'count' },
        ],
        data: [['ana', 'lee', 'sam', 'sam'], ['ana', 'lee', 'sam'], ['3']],
      },
      errors: {
        tools: [
          { cmd: 'grep ERROR app.log', job: 'filter' },
          { cmd: 'sort', job: 'order' },
          { cmd: 'uniq', job: 'dedupe' },
        ],
        data: [['ERROR timeout', 'ERROR disk', 'ERROR disk'], ['ERROR disk', 'ERROR disk', 'ERROR timeout'], ['ERROR disk', 'ERROR timeout']],
      },
    };

    function chorus(n, { pipeline, title = 'Chorus', final = false }) {
      const id = `chorus-${n}`;
      const ln = (i) => `${id}-${i}`;
      const from = song.sectionStart(id);
      const to = song.sectionEnd(id);
      badge(title, id);
      const s = kit.scene(content, from, to);
      const spec = PIPELINES[pipeline];

      // The Unix philosophy: small tools, one job each.
      const chain = mark(ln(2), 'chain');
      const philosophy = kit.el('div', 'subtitle is-staged', s, 'The Unix philosophy');
      philosophy.style.top = '96px';
      fx.rise(philosophy, mark(ln(1), 'unix'));
      fx.fadeOut(philosophy, chain - 0.1, 0.25);
      kit.kinetic(s, [
        { text: 'Small tools', at: mark(ln(1), 'small'), color: 'gold' },
        { text: 'one job each', at: mark(ln(1), 'one') },
      ], { y: 130, size: 46, until: chain });

      const MY = 214;
      const XS = [44, 382, 720];
      const W = 196;
      const BELT_Y = MY + 134;
      const pipelineAt = mark(ln(2), 'pipeline');
      sh.belt(s, {
        x1: 14, x2: 946, y: BELT_Y, at: mark(ln(1), 'tools'), flowFrom: pipelineAt,
        tints: [{ x: XS[0] + W, cls: 'sh-slip--cyan' }, { x: XS[1] + W, cls: 'sh-slip--gold' }, { x: XS[2] + W, cls: 'sh-slip--green' }],
      });
      const machines = spec.tools.map((tool, i) => sh.machine(s, {
        x: XS[i], y: MY, w: W, cmd: tool.cmd, job: tool.job,
        at: mark(ln(1), 'tools') + 0.12 * i, jobAt: mark(ln(1), ['one', 'job', 'each'][i]), spinFrom: pipelineAt,
      }));

      // Chain them in a pipeline: the belt starts, and text flows through.
      [0, 1].forEach((i) => {
        const sign = kit.place(kit.el('div', 'sh-pipe-sign is-staged', s), (XS[i] + W + XS[i + 1]) / 2 - 27, MY + 54);
        kit.el('code', null, sign, '|');
        kit.el('span', 'sh-pipe-sign-word', sign, 'pipe');
        fx.pop(sign, pipelineAt + 0.1 * i, { from: 0.6, rotate: 0 });
      });
      const cardAt = ['text', 'flow', 'through'];
      spec.data.forEach((lines, i) => {
        sh.dataCard(s, {
          x: i < 2 ? (XS[i] + W + XS[i + 1]) / 2 - 80 : 790, y: 84, w: i < 2 ? 160 : 140,
          title: i < 2 ? `out of ${spec.tools[i].cmd.split(' ')[0]}` : 'result', lines,
          at: mark(ln(2), cardAt[i]), tone: ['cyan', 'gold', 'green'][i],
        });
      });

      // Standard out feeds standard in.
      const exitLine = line(ln(5)).start;
      // At both pipes: stdout flush with the right edge of the machine it
      // leaves, stdin flush with the left edge of the machine it enters.
      [0, 1].forEach((i) => {
        const out = label(s, 'sh-pipe-label', 'stdout →', XS[i] + W, BELT_Y + 18, mark(ln(3), 'out') + 0.15 * i, exitLine);
        out.style.translate = '-100% 0';
        label(s, 'sh-pipe-label', '→ stdin', XS[i + 1], BELT_Y + 18, mark(ln(3), 'in') + 0.15 * i, exitLine);
      });
      fx.bump(machines[0].node, mark(ln(3), 'out'), 0.05);
      fx.bump(machines[1].node, mark(ln(3), 'in'), 0.05);

      // Errors take the side door: standard error, stream two, to the screen.
      const errors = mark(ln(4), 'errors');
      const door = mark(ln(4), 'door');
      machines[1].openHatch(mark(ln(4), 'side') - 0.15, exitLine);
      const err = kit.place(kit.el('div', 'sh-error is-staged', s), XS[1] + W / 2 - 70, MY + 98);
      err.append(kit.icon('warning'));
      err.append(document.createTextNode('error message'));
      fx.pop(err, errors, { rotate: 0 });
      tween(err, { translate: '0 92px' }, door - 0.1, 0.5, EASE.inOut);
      fx.fadeOut(err, exitLine, 0.25);
      const screen = kit.place(kit.el('div', 'sh-screen is-staged', s), XS[1] + W / 2 + 90, MY + 186);
      screen.append(kit.icon('terminal'));
      screen.append(document.createTextNode('your screen'));
      fx.rise(screen, door - 0.2, { distance: 10 });
      fx.fadeOut(screen, exitLine, 0.25);
      // Named beside the screen it reaches, clear of the stdout/stdin labels.
      label(s, 'sh-pipe-label sh-pipe-label--error', 'stderr = stream 2', XS[1] + W / 2 + 250, MY + 188, mark(ln(4), 'two'), exitLine);

      // Every command returns an exit code: zero means it worked.
      const exit = mark(ln(5), 'exit');
      machines.forEach((m, i) => m.lamp(exit + 0.15 * i, 0));
      kit.kinetic(s, [
        { text: 'exit 0', at: mark(ln(6), 'zero'), color: 'green', iconName: 'check' },
        { text: '= it worked', at: mark(ln(6), 'worked') },
      ], { y: 370, size: 34 });
      // Both rules stay up together, the failure rule below the success rule.
      machines[2].lamp(mark(ln(7), 'else'), 1);
      kit.kinetic(s, [
        { text: 'anything else', at: mark(ln(7), 'anything'), color: 'pink', iconName: 'cross' },
        { text: '= it didn’t', at: mark(ln(7), 'didn') },
      ], { y: 414, size: 34 });
      const zero2 = mark(ln(8), 'zero');
      machines[2].lamp(zero2, 0);
      machines.forEach((m) => fx.bump(m.node, zero2 + 0.05, 0.05));
      camera.punch(zero2 + 0.05, 0.04);
      if (final) kit.confetti(s, { x: 480, y: 300, at: mark(ln(8), 'worked'), seed: 21 });
    }

    // ----------------------------------------------------------------
    // Verse 2: a shell script, chmod +x, $1, variables, $?, if, for, &&
    // ----------------------------------------------------------------

    function verse2() {
      badge('Verse 2 · Your first shell script', 'verse-2');
      const start = song.sectionStart('verse-2');
      const end = song.sectionEnd('verse-2');

      // The script file; its shebang is an address label naming the interpreter.
      const varLine = line('verse-2-7').start;
      const a = kit.scene(content, start, varLine - 0.1);
      const script = sh.script(a, {
        x: 48, y: 120, w: 452, title: 'hello.sh', at: mark('verse-2-1', 'file'),
        lineAts: [mark('verse-2-2', 'shebang') - 0.2, mark('verse-2-1', 'commands') + 0.6],
        lines: [
          [{ t: '#!', id: 'bang', cls: 'sh-seg--key' }, { t: '/bin/bash', id: 'interp', cls: 'sh-seg--key' }],
          ['echo ', { t: '"Hello, ', cls: 'sh-seg--str' }, { t: '$1', id: 'one', cls: 'sh-seg--var' }, { t: '!"', cls: 'sh-seg--str' }],
        ],
      });
      const chmod = mark('verse-2-3', 'c');
      kit.sticker(a, 'Shell script', { x: 380, y: 96, at: mark('verse-2-1', 'script'), until: mark('verse-2-2', 'shebang'), variant: 'gold', iconName: 'file', rotate: 5 });
      script.glow(0, mark('verse-2-2', 'shebang'), chmod);
      script.mark('bang', mark('verse-2-2', 'hash'), chmod, 'gold');
      script.mark('interp', mark('verse-2-2', 'bin'), chmod, 'cyan');
      sh.addressLabel(a, {
        x: 300, y: 146, from: [226, 172], text: '/bin/bash', note: 'shebang',
        at: mark('verse-2-2', 'shebang'), to: chmod,
      });

      // chmod +x unlocks execution; without it, the door stays locked.
      terminal.window(line('verse-2-3').start - 0.3, varLine - 0.1);
      terminal.run(chmod - 0.15, 'chmod +x hello.sh');
      const runLine = line('verse-2-5').start;
      student?.appear({ from: runLine, to: varLine - 0.4, x: 170, y: 233, scale: 0.67 });
      sh.padlock(a, { x: 48, y: 238, at: chmod, openAt: mark('verse-2-3', 'x'), until: runLine });
      sh.perms(a, { x: 110, y: 242, before: '-rw-r--r--', after: '-rwxr-xr-x', at: chmod, changeAt: mark('verse-2-3', 'x'), until: runLine });
      kit.sticker(a, 'x = execute', { x: 462, y: 248, at: mark('verse-2-3', 'execute'), until: runLine, variant: 'green sticker--keepcase', iconName: 'check', rotate: 4 });
      const skip = mark('verse-2-4', 'skip');
      kit.sticker(a, 'Skip chmod?', { x: 640, y: 196, at: skip, until: runLine, variant: 'white sticker--keepcase', rotate: -4 });
      sh.padlock(a, { x: 620, y: 238, at: skip, until: runLine });
      label(a, 'sh-note sh-note--white sh-note--code', '-rw-r--r--  (no x)', 680, 252, skip + 0.1, runLine);
      kit.stamp(a, 'Permission denied', { x: 490, y: 314, at: mark('verse-2-4', 'denied'), until: runLine, rotate: -6, shake: false });

      // Running it with an argument fills in the $1 blank.
      const run = mark('verse-2-5', 'dot');
      terminal.run(run - 0.1, './hello.sh students');
      terminal.run(mark('verse-2-5', 'students') + 0.3, 'Hello, students!', { kind: 'output' });
      sh.tokens(a, {
        x: 548, y: 286, at: run, splitAt: mark('verse-2-5', 'students'), size: 30,
        words: [
          { text: './hello.sh', label: 'script', tone: 'command' },
          { text: 'students', label: '$1', labelAt: mark('verse-2-6', 'dollar'), tone: 'arg' },
        ],
      });
      const dollar = mark('verse-2-6', 'dollar');
      script.glow(1, dollar, varLine - 0.3, 'cyan');
      script.mark('one', dollar, varLine - 0.3, 'gold');
      script.fill('one', 'students', dollar + 0.15, varLine - 0.3);
      kit.flow(a, { from: [800, 278], to: [300, 262], bend: -70, color: 'cyan', at: dollar, until: varLine - 0.3 });
      kit.sticker(a, 'first argument', { x: 330, y: 330, at: mark('verse-2-6', 'first'), until: varLine - 0.3, variant: 'cyan', rotate: -3 });

      // A variable is a labeled box; spaces round = make NAME a command.
      const exitLine = line('verse-2-10').start;
      const b = kit.scene(content, varLine - 0.1, exitLine - 0.1);
      terminal.window(varLine - 0.1, exitLine - 0.1);
      const vars = sh.script(b, {
        x: 48, y: 116, w: 372, title: 'variables', at: mark('verse-2-7', 'name') - 0.1,
        lines: [
          ['NAME', { t: '=', id: 'eq' }, { t: '"my notes"', cls: 'sh-seg--str' }],
          ['NAME', { t: ' ', id: 'sp1', cls: 'sh-seg--space' }, '=', { t: ' ', id: 'sp2', cls: 'sh-seg--space' }, { t: '"my notes"', cls: 'sh-seg--str' }],
        ],
        lineAts: [mark('verse-2-7', 'name'), mark('verse-2-7', 'spaces')],
      });
      sh.variableBox(b, { x: 440, y: 104, name: 'NAME', value: 'my notes', at: mark('verse-2-7', 'name'), dropAt: mark('verse-2-7', 'value') });
      vars.glow(0, mark('verse-2-7', 'value'), undefined, 'green');
      vars.mark('eq', mark('verse-2-7', 'equals'), undefined, 'gold');
      vars.glow(1, mark('verse-2-7', 'spaces') + 0.1, undefined, 'red');
      vars.mark('sp1', mark('verse-2-7', 'round'), undefined, 'pink');
      vars.mark('sp2', mark('verse-2-7', 'round') + 0.1, undefined, 'pink');
      terminal.run(mark('verse-2-7', 'spaces') - 0.1, 'NAME = "my notes"');
      terminal.run(mark('verse-2-7', 'equals_2'), 'zsh: command not found: NAME', { kind: 'error' });
      kit.sticker(b, 'No spaces!', { x: 292, y: 198, at: mark('verse-2-7', 'equals_2'), variant: 'red', iconName: 'cross', rotate: 5 });

      // Quoted, the box arrives sealed; unquoted, word splitting cuts it in two.
      const quotes = mark('verse-2-8', 'quotes');
      const sealed = sh.tokens(b, {
        x: 70, y: 268, at: mark('verse-2-8', 'double') - 0.1, splitAt: quotes + 0.35, size: 30,
        words: [
          { text: 'ls', label: 'command', tone: 'command' },
          { text: '"$NAME"', label: '1 argument ✓', tone: 'good', tape: true, tapeAt: quotes + 0.05 },
        ],
      });
      sh.scissors(b, { row: sealed, times: [quotes + 0.15], until: quotes + 0.4 });
      const splitting = mark('verse-2-9', 'splitting');
      const spilled = sh.tokens(b, {
        x: 470, y: 268, at: splitting - 0.2, splitAt: mark('verse-2-9', 'cuts') + 0.1, size: 30,
        words: [
          { text: 'ls', label: 'command', tone: 'command' },
          { text: 'my', label: 'argument 1', labelAt: mark('verse-2-9', 'my') + 0.1, tone: 'bad' },
          { text: 'notes', label: 'argument 2', labelAt: mark('verse-2-9', 'two'), tone: 'bad' },
        ],
      });
      sh.scissors(b, { row: spilled, times: [splitting + 0.05, mark('verse-2-9', 'cuts')], until: mark('verse-2-9', 'cuts') + 0.15 });
      kit.sticker(b, 'word splitting', { x: 560, y: 226, at: splitting, variant: 'pink', iconName: 'scissors', rotate: -4 });
      label(b, 'sh-path sh-path--cyan', '$NAME, unquoted', 470, 378, splitting + 0.2);

      // $? holds the exit code; if is a decision on it; [ is the test command; fi.
      const forLine = line('verse-2-14').start;
      const c = kit.scene(content, exitLine - 0.1, forLine - 0.1);
      const dollarQ = mark('verse-2-10', 'dollar');
      const code = mark('verse-2-11', 'code');
      sh.exitBoard(c, {
        x: 712, y: 112, at: dollarQ, label: '$?',
        values: [{ at: dollarQ, code: 0, note: 'last exit code' }, { at: code, code: 0, note: 'set by the [ ] test' }],
      });
      kit.sticker(c, 'a.k.a. return code', { x: 704, y: 76, at: mark('verse-2-10', 'return'), until: forLine - 0.3, variant: 'white', rotate: -3 });
      const ifs = mark('verse-2-11', 'if');
      const block = sh.script(c, {
        x: 48, y: 120, w: 540, title: 'check.sh', at: ifs - 0.15,
        lines: [
          [{ t: 'if', cls: 'sh-seg--key' }, ' ', { t: '[', id: 'open' }, { t: ' ', id: 's1', cls: 'sh-seg--space' }, { t: '-f notes.txt', id: 'cond' }, { t: ' ', id: 's2', cls: 'sh-seg--space' }, { t: ']', id: 'close' }, '; ', { t: 'then', cls: 'sh-seg--key' }],
          ['  echo ', { t: '"found it"', cls: 'sh-seg--str' }],
          [{ t: 'fi', id: 'fi', cls: 'sh-seg--key' }],
        ],
      });
      block.mark('cond', mark('verse-2-11', 'checks'), mark('verse-2-12', 'bracket'), 'cyan');
      block.glow(1, mark('verse-2-11', 'zero'), forLine - 0.3, 'green');
      sh.decision(c, {
        x: 620, y: 236, cond: '[ -f notes.txt ]', thenText: 'echo "found it"', elseText: 'fi',
        at: mark('verse-2-11', 'checks') - 0.1, checkAt: code, yesAt: mark('verse-2-11', 'zero'),
      });
      const bracket = mark('verse-2-12', 'bracket');
      block.mark('open', bracket, undefined, 'pink');
      block.mark('close', bracket + 0.12, undefined, 'pink');
      kit.sticker(c, '[ = test command', { x: 60, y: 282, at: mark('verse-2-12', 'test'), until: forLine - 0.3, variant: 'pink', rotate: -4 });
      block.mark('s1', mark('verse-2-12', 'spaces'), undefined, 'gold');
      block.mark('s2', mark('verse-2-12', 'spaces') + 0.12, undefined, 'gold');
      kit.sticker(c, 'Spaces inside', { x: 290, y: 282, at: mark('verse-2-12', 'inside'), until: forLine - 0.3, variant: 'gold', rotate: 3 });
      block.mark('fi', mark('verse-2-13', 'f'), undefined, 'gold');
      // "fi" is "if" backwards: the two letters swap places.
      const flip = kit.place(kit.el('div', 'sh-tag sh-tag--gold is-staged', c), 60, 342);
      const letters = [kit.el('code', 'sh-tag-code', flip, 'i'), kit.el('code', 'sh-tag-code', flip, 'f')];
      fx.pop(flip, mark('verse-2-13', 'i_2') - 0.1, { rotate: 0 });
      const backwards = mark('verse-2-13', 'backwards');
      tween(letters[0], { translate: '11px 0' }, backwards, 0.4, EASE.inOut);
      tween(letters[1], { translate: '-11px 0' }, backwards, 0.4, EASE.inOut);
      kit.el('span', 'sh-tag-note', flip, 'if backwards ends it');

      // for f in *.jpg: the wildcard expands; the body stamps each file in turn.
      const chainLine = line('verse-2-18').start;
      const d = kit.scene(content, forLine - 0.1, chainLine - 0.1);
      const loop = sh.script(d, {
        x: 48, y: 120, w: 520, title: 'rename.sh', at: forLine - 0.1,
        lines: [
          [{ t: 'for', cls: 'sh-seg--key' }, ' f ', { t: 'in', cls: 'sh-seg--key' }, ' ', { t: '*.jpg', id: 'glob', cls: 'sh-seg--var' }, '; ', { t: 'do', cls: 'sh-seg--key' }],
          ['  mv ', { t: '"$f"', cls: 'sh-seg--str' }, ' ', { t: '"trip_$f"', cls: 'sh-seg--str' }],
          [{ t: 'done', cls: 'sh-seg--key' }],
        ],
      });
      loop.mark('glob', mark('verse-2-14', 'star'), mark('verse-2-15', 'loop'), 'gold');
      const expands = mark('verse-2-14', 'wildcard');
      kit.sticker(d, 'wildcard', { x: 280, y: 92, at: mark('verse-2-14', 'wildcard'), until: mark('verse-2-15', 'once'), variant: 'gold', iconName: 'sparkle', rotate: 4 });
      const moveAt = mark('verse-2-16', 'move');
      const PHOTOS = [[620, 112], [770, 204], [620, 296]];
      const stampAt = (i) => moveAt + 0.3 + 0.45 * i;
      PHOTOS.forEach(([px, py], i) => {
        const name = `IMG_${412 + i}.jpg`;
        const card = sh.photo(d, {
          x: px, y: py, name, variant: i, rotate: i % 2 ? 3 : -3,
          at: expands + 0.12 * i, renames: [{ at: stampAt(i), name: `trip_${name}` }],
        });
        kit.flyIn(card, expands + 0.12 * i, 260, 150, { duration: 0.45, fromScale: 0.4 });
      });
      label(d, 'sh-path sh-path--gold', '…297 more', 640, 404, expands + 0.5, chainLine - 0.3);
      kit.sticker(d, 'once per file', { x: 260, y: 272, at: mark('verse-2-15', 'loop'), until: chainLine - 0.3, variant: 'cyan', iconName: 'loop', rotate: -3 });
      sh.rubberStamp(d, {
        text: 'trip_', from: mark('verse-2-15', 'once') - 0.1, until: mark('verse-2-17', 'three'),
        stops: PHOTOS.map(([px, py], i) => ({ at: stampAt(i), x: px + 20, y: py })),
      });
      loop.glow(1, moveAt, mark('verse-2-16', 'done'), 'gold');
      loop.glow(2, mark('verse-2-16', 'done'), mark('verse-2-17', 'three') + 0.6, 'cyan');
      counter(d, { x: 70, y: 300, at: mark('verse-2-17', 'three'), until: chainLine - 0.3, value: '300/300', text: 'renamed' });
      kit.stamp(d, 'Weekend won', { x: 120, y: 356, at: mark('verse-2-17', 'weekend'), until: chainLine - 0.2, color: 'gold', rotate: -5, shake: false });

      // cd homework && ls: a boom gate that lifts only when cd exits 0.
      const e = kit.scene(content, chainLine - 0.1, end);
      terminal.window(chainLine - 0.1, end);
      const cdAt = mark('verse-2-18', 'c');
      terminal.run(cdAt - 0.1, 'cd homework && ls');
      sh.gate(e, {
        x: 120, y: 150, left: 'cd homework', right: 'ls', at: cdAt - 0.1,
        leftAt: cdAt, gateAt: mark('verse-2-18', 'and'), rightAt: mark('verse-2-18', 'l'),
        code: 0, codeAt: mark('verse-2-19', 'l'),
      });
      terminal.run(mark('verse-2-19', 'runs'), 'hw1.sh  notes.txt', { kind: 'output' });
      sh.dataCard(e, { x: 560, y: 156, w: 170, title: 'ls output', lines: ['hw1.sh', 'notes.txt'], at: mark('verse-2-19', 'runs'), tone: 'green' });
      const only = mark('verse-2-19', 'only');
      sh.gate(e, {
        x: 120, y: 310, left: 'cd homwork', right: 'ls', at: only - 0.1,
        leftAt: only - 0.1, gateAt: only, rightAt: only + 0.1,
        code: 1, codeAt: mark('verse-2-19', 'worked'),
      });
      kit.sticker(e, 'typo', { x: 120, y: 280, at: only, variant: 'pink', iconName: 'warning', rotate: -6 });
    }

    // ----------------------------------------------------------------
    // Bridge: "one job each" — collectible command cards fill a toolbox
    // ----------------------------------------------------------------

    // [line, command, its job, icon, category, its key flag or keys (optional)]
    const TOOLS = [
      ['bridge-2', 'ls', 'lists a directory', 'list', 'navigate'],
      ['bridge-3', 'cd', 'changes directory', 'enter', 'navigate'],
      ['bridge-4', 'pwd', 'prints where you are', 'pin', 'navigate'],
      ['bridge-5', 'mkdir', 'makes a directory', 'folderPlus', 'navigate', '-p: parents too'],
      ['bridge-6', 'touch', 'a new, empty file', 'filePlus', 'navigate'],
      ['bridge-7', 'cp', 'copies it', 'copy', 'files', '-r: directories'],
      ['bridge-8', 'mv', 'moves or renames', 'move', 'files'],
      ['bridge-9', 'rm', 'gone for good — no undo', 'trash', 'files'],
      ['bridge-10', 'cat', 'prints files back to back', 'pages', 'read'],
      ['bridge-11', 'less', 'one page at a time', 'eye', 'read', 'q: quit'],
      ['bridge-12', 'head·tail', 'first or last ten lines', 'lines', 'read'],
      ['bridge-13', 'grep', 'finds matching lines', 'search', 'text'],
      ['bridge-14', 'sed', 'swaps text as it streams', 'transfer', 'text'],
      ['bridge-15', 'sort', 'puts lines in order', 'sortAsc', 'text'],
      ['bridge-16', 'uniq', 'drops repeats next door', 'dedupe', 'text', 'sort first'],
      ['bridge-17', 'wc', 'counts lines and words', 'hash', 'text'],
      ['bridge-18', 'cut', 'cuts out columns', 'scissors', 'text'],
      ['bridge-19', 'find', 'searches for files', 'folder', 'files'],
      ['bridge-20', 'man', 'the manual', 'book', 'system'],
      ['bridge-21', 'chmod', 'read, write, execute', 'lock', 'system'],
      ['bridge-22', 'ssh', 'secure shell, far away', 'globe', 'system'],
      ['bridge-23', 'htop', 'what’s running', 'chart', 'system'],
    ];
    const CATEGORIES = {
      navigate: { label: 'Navigate', tone: 'blue' },
      files: { label: 'Files', tone: 'gold' },
      read: { label: 'Read', tone: 'green' },
      text: { label: 'Text', tone: 'cyan' },
      system: { label: 'System', tone: 'violet' },
    };

    function bridge() {
      badge('Bridge · One job each', 'bridge');
      const start = song.sectionStart('bridge');
      const end = song.sectionEnd('bridge');
      const s = kit.scene(content, start, end);
      const firstCall = line('bridge-2').start;
      kit.kinetic(s, [{ text: 'One job each', at: mark('bridge-1', 'one'), color: 'gold' }], { y: 196, size: 56, until: firstCall - 0.2 });
      const say = kit.el('div', 'subtitle is-staged', s, 'I call the command, you say what it does');
      say.style.top = '276px';
      fx.rise(say, mark('bridge-1', 'call'));
      fx.fadeOut(say, firstCall - 0.25, 0.2);

      const rows = Object.entries(CATEGORIES).map(([key, cat]) => ({
        label: cat.label, tone: cat.tone,
        items: TOOLS.filter((tool) => tool[4] === key).map((tool) => tool[1]),
      }));
      const box = sh.toolbox(s, { x: 16, y: 118, rows, at: firstCall - 0.3, tileW: 76, labelW: 92 });
      TOOLS.forEach(([lineId, cmd, gist, iconName, cat, flag], i) => {
        const entry = line(lineId);
        const next = i + 1 < TOOLS.length ? line(TOOLS[i + 1][0]).start : end - 0.4;
        const answer = Object.values(entry.marks).find((time) => time > entry.start + 0.25) ?? entry.start + 0.4;
        sh.toolCard(s, {
          cmd, gist, flag, iconName, category: CATEGORIES[cat].label, tone: CATEGORIES[cat].tone,
          number: i + 1, total: TOOLS.length, at: entry.start - 0.1, gistAt: answer, until: next - 0.05,
        });
        box.fill(cmd, next - 0.2, iconName);
      });
      kit.sticker(s, 'Toolbox: complete', { x: 250, y: 412, at: end - 1.2, until: end, variant: 'green', iconName: 'check', rotate: -3 });
    }

    // ----------------------------------------------------------------
    // Quiz: task → command, answered by the crowd
    // ----------------------------------------------------------------

    function quiz() {
      badge('Pop quiz', 'quiz');
      const { lines } = song.storyboard.sections.find((section) => section.id === 'quiz');
      const QUIZ_ICONS = ['check', 'pin', 'move', 'transfer', 'copy', 'search', 'dedupe', 'hash', 'lock', 'terminal', 'trash'];
      lines.forEach((entry, i) => {
        const from = entry.start - 0.15;
        const to = i + 1 < lines.length ? lines[i + 1].start - 0.15 : song.sectionEnd('quiz');
        const s = kit.scene(content, from, to, { enter: 'whip' });
        const cardNode = kit.el('div', 'quiz-card', s);
        kit.el('div', 'quiz-count', cardNode, `Quiz ${i + 1} / ${lines.length}`);
        kit.el('div', 'quiz-question', cardNode, entry.text);
        const answer = kit.el('div', 'quiz-answer is-staged', cardNode);
        answer.append(kit.icon(QUIZ_ICONS[i]));
        kit.el(entry.answer_code ? 'code' : 'span', 'quiz-answer-code', answer, entry.answer_code || entry.answer);
        fx.slam(answer, entry.answer_at, { from: 1.6 });
        camera.punch(entry.answer_at + 0.05, 0.03);
      });
    }

    // ----------------------------------------------------------------
    // Outro: small tools, one job each — and exit zero
    // ----------------------------------------------------------------

    function outro() {
      const start = song.sectionStart('outro');
      const end = song.duration;
      const s = kit.scene(content, start, end - 0.3, { exit: 'fade' });
      if (student) student.appear({ from: start + 0.3, to: end - 0.5, x: 64, y: 178, scale: 0.82 });
      kit.kinetic(s, [
        { text: 'Small tools', at: mark('outro-1', 'small'), color: 'gold' },
        { text: 'one job each', at: mark('outro-1', 'one') },
      ], { y: 74, size: 48 });
      const win = sh.session(s, { x: 370, y: 206, w: 380, rows: 2, title: '~', at: mark('outro-2', 'and') - 0.2 });
      win.run(mark('outro-2', 'and'), 'echo $?');
      win.run(mark('outro-2', 'zero'), '0', 'good');
      kit.stamp(s, 'exit 0', { x: 470, y: 330, at: mark('outro-3', 'exit'), color: 'green', rotate: -5, shake: false });
      const credit = kit.el('div', 'end-credit is-staged', s, 'SE Book · Shell Scripting');
      credit.style.top = '420px';
      fx.fadeIn(credit, mark('outro-3', 'zero') + 0.3, 0.4);
    }

    // ----------------------------------------------------------------

    intro();
    verse1();
    chorus(1, { pipeline: 'names' });
    verse2();
    chorus(2, { pipeline: 'errors' });
    bridge();
    quiz();
    chorus(3, { pipeline: 'names', title: 'Final chorus', final: true });
    outro();
  };
})();
