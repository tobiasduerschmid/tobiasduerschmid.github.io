/* One self-contained SVG scene per lyric. Poses are pure functions of line time. */
(function () {
  'use strict';
  const clamp = n => Math.max(0, Math.min(1, n));
  const settle = n => 1 - Math.pow(1 - clamp(n), 3);

  window.AlwaysCodeScenes = function (kit, parent, { makeFace, makeCurtain }) {
    const svg = (tag, attrs, p) => kit.svg(tag, attrs, p);
    const group = (p, x = 0, y = 0, cls = '') => svg('g', { class: cls, transform: `translate(${x} ${y})` }, p);
    const text = (p, x, y, words, cls = 'ac-concept-label') => {
      const node = svg('text', { class: cls, x, y }, p);
      node.textContent = words;
      return node;
    };
    const panel = (p, x, y, w, h, cls = 'ac-concept-panel') => svg('rect', { class: cls, x, y, width: w, height: h, rx: 14 }, p);
    const path = (p, d, cls = 'ac-concept-wire') => svg('path', { class: cls, d }, p);
    const show = (node, visible) => node.classList.toggle('is-hidden', !visible);
    const place = (node, x, y) => node.setAttribute('transform', `translate(${x} ${y})`);
    const windowBox = (p, x, y, w, h, title) => {
      const node = group(p, x, y);
      panel(node, 0, 0, w, h);
      path(node, `M0 37 H${w}`, 'ac-panel-rule');
      text(node, 16, 27, title, 'ac-concept-small');
      return node;
    };
    const badge = (p, x, y, words) => {
      const node = group(p, x, y);
      panel(node, 0, 0, 146, 36, 'ac-pass-panel');
      text(node, 73, 25, words, 'ac-pass-label');
      return node;
    };
    const module = (p, x, y, title, color = 0) => {
      const node = group(p, x, y, `ac-crew ac-crew-${color}`);
      panel(node, 4, 6, 142, 94, 'ac-card-depth');
      panel(node, 0, 0, 142, 94, 'ac-card-body');
      text(node, 71, 30, title, 'ac-card-label');
      makeFace(kit, node, 71, 56, 24, 0.62);
      return node;
    };
    const scene = (title, build) => {
      const node = group(parent, 340, 113, 'ac-concept-scene is-hidden');
      const pose = build(node);
      return { node, title, pose };
    };

    return [
      scene('Hello, code!', p => {
        const code = windowBox(p, 55, 2, 450, 187, 'a familiar editor');
        const greeting = text(code, 27, 94, 'hello, code!', 'ac-code-large');
        text(code, 27, 150, '{ curiosity + practice }', 'ac-code-text');
        const wave = path(p, 'M15 55 Q-6 82 15 109 M0 45 Q-25 82 0 119', 'ac-greeting-wave');
        return t => { place(greeting, 0, -5 * Math.sin(Math.min(t, 1) * Math.PI)); show(wave, t < 1.2); };
      }),
      scene('Shell + Git: familiar tools', p => {
        const shell = windowBox(p, 5, 2, 275, 187, 'shell');
        const commands = ['$ pwd', '$ git status', '$ git diff'].map((line, i) => text(shell, 18, 78 + i * 43, line, 'ac-code-text'));
        const git = windowBox(p, 308, 2, 264, 187, 'git');
        path(git, 'M39 124 H221 M100 124 Q100 78 145 78 H221');
        [39, 100, 160, 221].forEach(cx => svg('circle', { class: 'ac-git-dot', cx, cy: 124, r: 9 }, git));
        const branch = svg('circle', { class: 'ac-git-dot ac-git-feature', cx: 173, cy: 78, r: 10 }, git);
        return t => { commands.forEach((n, i) => show(n, t >= i * 0.45)); show(branch, t > 0.8); };
      }),
      scene('Propose a change. Invite review.', p => {
        const diff = windowBox(p, 4, 2, 240, 181, 'pull request');
        text(diff, 18, 83, '− old behavior', 'ac-diff-old');
        text(diff, 18, 128, '+ proposed fix', 'ac-diff-new');
        const review = windowBox(p, 330, 2, 242, 181, 'review');
        text(review, 121, 88, 'Discuss', 'ac-centered-label');
        text(review, 121, 135, 'before merge', 'ac-centered-label');
        const mail = group(p);
        panel(mail, 0, 0, 58, 42, 'ac-mail');
        path(mail, 'M2 3 L29 24 L56 3', 'ac-mail-fold');
        return t => place(mail, 245 + 28 * settle(t / 1.1), 70 - 22 * Math.sin(clamp(t / 1.1) * Math.PI));
      }),
      scene('Pause for an impact review', p => {
        const proposal = windowBox(p, 12, 4, 256, 180, 'before merging');
        ['Callers?', 'Contracts?', 'Failure cases?'].forEach((s, i) => text(proposal, 23, 77 + i * 43, s));
        const lens = group(p);
        svg('circle', { class: 'ac-lens-glass', cx: 0, cy: 0, r: 36 }, lens);
        path(lens, 'M26 26 L53 53', 'ac-lens-handle');
        const stop = group(p, 370, 20);
        panel(stop, 0, 0, 154, 117, 'ac-pause-panel');
        [48, 91].forEach(x => panel(stop, x, 22, 17, 65, 'ac-pause-bar'));
        text(p, 447, 182, 'Think it through', 'ac-centered-label');
        return t => place(lens, 280, 64 + 82 * clamp(t / 2));
      }),
      scene('One change can reach other modules', p => {
        path(p, 'M156 99 H226 M226 51 V149 M226 51 H270 M226 149 H270 M412 51 H426 M412 149 H426');
        module(p, 12, 52, 'changed');
        module(p, 270, 4, 'caller', 1);
        module(p, 270, 102, 'caller', 2);
        const pulses = [0, 1].map(() => svg('circle', { class: 'ac-impact-pulse', cx: 0, cy: 0, r: 10 }, p));
        const flags = [badge(p, 426, 31, 'review'), badge(p, 426, 129, 'review')];
        return t => {
          pulses.forEach((pulse, i) => {
            const elapsed = Math.max(0, t - i * 0.5);
            const x = 156 + 70 * clamp(elapsed / 0.45) + 44 * clamp((elapsed - 0.65) / 0.25);
            const y = 99 + (i ? 48 : -48) * clamp((elapsed - 0.45) / 0.2);
            place(pulse, x, y);
          });
          flags.forEach((n, i) => show(n, t > 0.9 + i * 0.5));
        };
      }),
      scene('Make the reasoning visible', p => {
        const board = windowBox(p, 20, 0, 352, 190, 'explain the change');
        text(board, 24, 81, 'What changes?');
        text(board, 24, 125, 'Who is affected?');
        text(board, 24, 169, 'Why is it safe?');
        module(p, 420, 60, 'got it!', 1);
        const pointer = path(p, 'M386 170 L352 78', 'ac-pointer');
        return t => pointer.setAttribute('transform', `rotate(${-20 * clamp(t / 1.2)} 386 170)`);
      }),
      scene('Give each module a clear job', p => {
        const labels = ['parse', 'calculate', 'format'];
        const blocks = labels.map((s, i) => module(p, 20 + i * 197, 55, s, i));
        text(p, 288, 190, 'Focused responsibilities', 'ac-centered-label');
        return t => blocks.forEach((n, i) => {
          const messy = 1 - settle(t / 1.1);
          n.setAttribute('transform', `translate(${20 + i * 197} ${55 + (i - 1) * 32 * messy}) rotate(${(i - 1) * 13 * messy} 71 47)`);
        });
      }),
      scene('Test more than the happy path', p => {
        const cases = [['normal', '42'], ['boundary', '0'], ['invalid', '"oops"']];
        const checks = cases.map(([name, value], i) => {
          const n = windowBox(p, 8 + i * 194, 4, 174, 138, name);
          text(n, 87, 93, value, 'ac-test-input');
          return badge(p, 22 + i * 194, 157, '✓ PASS');
        });
        return t => checks.forEach((n, i) => show(n, t > 0.2 + i * 0.4));
      }),
      // The sequence art is generated by ArchUML; only message groups are revealed.
      scene('See the whole system: one request', p => {
        const diagram = window.AlwaysCodeSequence(kit, p);
        return t => diagram.messages.forEach((n, i) => show(n, t >= i * 0.48));
      }),
      scene('Swap the part. Keep the contract.', p => {
        panel(p, 170, 2, 241, 190, 'ac-socket');
        text(p, 290, 31, 'same interface', 'ac-centered-label');
        path(p, 'M18 112 H177 M405 112 H563');
        const old = module(p, 220, 65, 'v1', 0);
        const replacement = module(p, 220, 65, 'v2', 1);
        return t => {
          const progress = settle(t / 1.05);
          show(old, progress < 0.5); show(replacement, progress >= 0.5);
          place(old, 220, 65 - 50 * Math.min(1, progress * 2));
          place(replacement, 220, 65 - 50 * (1 - Math.max(0, (progress - 0.5) * 2)));
        };
      }),
      scene('Expose the interface. Hide the details.', p => {
        const api = windowBox(p, 9, 23, 273, 156, 'public interface');
        text(api, 136, 102, 'getResult()', 'ac-test-input');
        const details = windowBox(p, 343, 0, 213, 194, 'implementation');
        ['cache', 'helpers', 'algorithm'].forEach((s, i) => text(details, 20, 77 + i * 42, s));
        const anchor = group(p, 343, 0);anchor.setAttribute('transform', 'translate(343 0) scale(1.3 1.4)');
        const curtain = makeCurtain(kit, anchor);
        path(p, 'M285 103 H334');
        return t => curtain.setAttribute('transform', `scale(1 ${settle(t / 0.85)})`);
      }),
      scene('Refactor structure. Preserve behavior.', p => {
        const before = windowBox(p, 6, 3, 220, 142, 'before');
        text(before, 18, 81, 'A: x + x', 'ac-code-text');
        text(before, 18, 122, 'B: x + x', 'ac-code-text');
        const after = windowBox(p, 285, 3, 287, 142, 'after');
        const helper = text(after, 18, 78, 'double(x) = x + x', 'ac-code-text');
        const callers = text(after, 18, 122, 'A, B: double(x)', 'ac-code-text');
        badge(p, 42, 160, '✓ tests pass'); badge(p, 353, 160, '✓ tests pass');
        const piece = group(p, 239, 64);
        const arrow = kit.icon('transfer', 'ac-transfer-icon');
        arrow.setAttribute('width', '36'); arrow.setAttribute('height', '36');
        piece.appendChild(arrow);
        return t => { show(helper, t > 0.35); show(callers, t > 0.75); place(piece, 239 + 8 * Math.sin(clamp(t) * Math.PI), 64); };
      }),
    ];
  };
})();
