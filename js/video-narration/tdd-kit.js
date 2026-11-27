/*
 * The Test-Driven Development narration's own objects (TddKit), built on the
 * wall kit and the architecture kit and styled by css/video-narration-tdd.css.
 * The lesson's code exists in four languages (Python with pytest, Java with
 * JUnit 5, C++ with GoogleTest, TypeScript with Jest; _data/explainers/
 * tdd_code.yml, which the stage page embeds as #narration-code). Every piece
 * that shows code or runner output draws one variant per language, marked
 * data-code-variant, and the stage shows the viewer's language
 * (data-code-language, css/video-narration-stage.css).
 *
 * The workbench keeps fixed places through the example and the rules: the
 * editor column (test card above code card) on the left, the side column
 * (the test list index card and one supporting object) on the right, and
 * the test runner's terminal along the bottom of the body. The terminal
 * grows upward when it has failure detail, so the editor column leaves it
 * room (WORKBENCH.editorBottom).
 */
(function () {
  'use strict';

  const { fx, tween, onFrame, EASE } = window.Timeline;
  const kit = window.SongKit;
  const wall = window.WallKit;
  const arch = window.ArchKit;
  const { el, svg, place, icon } = kit;

  /** The workbench's columns, in the picture body's coordinates (960×540). */
  const WORKBENCH = {
    editor: { x: 12, y: 12, w: 646 },
    side: { x: 672, y: 12, w: 276 },
    terminal: { x: 12, w: 936, bottom: 12 },
  };

  const CODE = JSON.parse(document.getElementById('narration-code').textContent);
  const LANGUAGES = Object.keys(CODE);
  const stageOf = (language) => CODE[language].stage;

  // ------------------------------------------------------------------
  // Language variants
  // ------------------------------------------------------------------

  /** One child of `parent` per language, each marked data-code-variant; `build(variant, language)` fills it. */
  function variants(parent, tag, className, build) {
    return Object.fromEntries(LANGUAGES.map((language) => {
      const node = el(tag, className, parent);
      node.dataset.codeVariant = language;
      build(node, language);
      return [language, node];
    }));
  }

  /** A line diff of two lists of lines: [{ text, op: 'same' | 'del' | 'add' }], removals before additions. */
  function diff(before, after) {
    const n = before.length;
    const m = after.length;
    const common = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
        common[i][j] = before[i] === after[j] ? common[i + 1][j + 1] + 1 : Math.max(common[i + 1][j], common[i][j + 1]);
      }
    }
    const out = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (before[i] === after[j]) {
        out.push({ text: after[j], op: 'same' });
        i += 1;
        j += 1;
      } else if (common[i + 1][j] >= common[i][j + 1]) {
        out.push({ text: before[i], op: 'del' });
        i += 1;
      } else {
        out.push({ text: after[j], op: 'add' });
        j += 1;
      }
    }
    while (i < n) out.push({ text: before[i++], op: 'del' });
    while (j < m) out.push({ text: after[j++], op: 'add' });
    return out;
  }

  /** A code row's height (css/video-narration-tdd.css, .td-row). */
  const ROW = 26;

  /** Grows a row from nothing at `at` (a line typed in); it is hidden until then (.td-row--grow). */
  function growIn(row, at, i = 0) {
    row.classList.add('td-row--grow');
    tween(row, [{ height: '0px', minHeight: '0px', opacity: 0 }, { height: `${ROW}px`, minHeight: `${ROW}px`, opacity: 1 }], at + i * 0.1, 0.3, EASE.out);
  }

  /** Shrinks a row to nothing at `at` (a removed line leaving). */
  function shrinkOut(row, at) {
    tween(row, [{ height: `${ROW}px`, minHeight: `${ROW}px`, opacity: 1 }, { height: '0px', minHeight: '0px', opacity: 0 }], at, 0.35, EASE.inOut);
  }

  // ------------------------------------------------------------------
  // The editor: test and code cards
  // ------------------------------------------------------------------

  /** The editor column: a vertical stack in which collapsing a card moves the next one up. */
  function editor(parent, { x = WORKBENCH.editor.x, y = WORKBENCH.editor.y, w = WORKBENCH.editor.w } = {}) {
    const node = place(el('div', 'td-editor', parent), x, y);
    node.style.width = `${w}px`;
    return node;
  }

  /**
   * A test or code card (`kind`: 'tests' or 'code') showing card `card` of
   * the lesson's code, in every language, titled with the language's file.
   *
   * With `base`, the card first shows card `base`, and changes into `card`
   * as a diff: at `strikeAt` the removed lines are struck out, at `swapAt`
   * they leave while the added lines type in (marked added until
   * `settleAt`); `hideRemoved` shows only the result, with its added lines
   * marked. `collapseAt` folds the card to its title line (`summary` then
   * follows the file name); `goneAt` takes it out of the column; `typeAt`
   * types every line in one by one. `marks` = [{ find, state, at, until }]
   * marks each language's lines that contain `find` (a string, or one per
   * language; case-insensitive with `anyCase`): state 'lit' lights them,
   * 'smell' underlines them with a red wavy line, 'added' marks them added.
   * `blank` = { text, fillAt } shows "?" in place of `text` until `fillAt`.
   */
  function card(parent, {
    kind, card: name, base, title, summary, at, until, how = 'rise',
    strikeAt, swapAt, settleAt, hideRemoved = false, collapseAt, goneAt, typeAt, marks = [], label, blank,
  }) {
    const node = el('div', `td-card td-card--${kind} code-card ak-code is-staged`, parent);
    if (label) {
      // A label is its words, or { text, at } to show it later (strings have an `at` method).
      const timed = typeof label === 'object';
      const tag = el('div', 'td-card-label', node, timed ? label.text : label);
      if (timed && label.at !== undefined) {
        tag.classList.add('is-staged');
        fx.rise(tag, label.at, { distance: 6, duration: 0.3 });
      }
    }
    const rows = {};
    variants(node, 'div', 'td-card-variant', (variant, language) => {
      const files = stageOf(language).files;
      const head = el('div', 'code-card-title ak-code-title td-card-title', variant);
      el('span', 'td-card-file', head, title || files[kind]);
      if (summary) {
        const note = el('span', 'td-card-summary is-staged', head, summary);
        fx.fadeIn(note, collapseAt ?? at, 0.3);
      }
      const body = el('div', 'ak-code-body td-card-body', variant);
      const cards = stageOf(language).cards;
      const all = base ? diff(cards[base], cards[name]) : cards[name].map((text) => ({ text, op: 'same' }));
      const lines = hideRemoved ? all.filter(({ op }) => op !== 'del') : all;
      const matches = (mark, text) => {
        const find = typeof mark.find === 'string' ? mark.find : mark.find[language];
        if (!find) return false;
        return mark.anyCase ? text.toLowerCase().includes(find.toLowerCase()) : text.includes(find);
      };
      let added = 0;
      rows[language] = lines.map(({ text, op }, i) => {
        const row = el('div', 'ak-code-row td-row', body);
        if (blank && text.includes(blank.text)) {
          // The expected value not yet decided: "?" in its place until `fillAt`.
          row.classList.add('td-row--blank');
          arch.codeLine(row, text.replace(blank.text, '?'), 'td-row-empty', language);
          arch.codeLine(row, text, 'td-row-full', language);
          wall.track(row, 'is-', [{ at: blank.fillAt, state: 'filled' }]);
        } else {
          arch.codeLine(row, text, '', language);
        }
        if (op === 'del') {
          if (strikeAt !== undefined) wall.track(row, 'is-', [{ at: strikeAt, state: 'removed' }]);
          if (swapAt !== undefined) shrinkOut(row, swapAt);
        } else if (op === 'add') {
          row.classList.add('ak-code-row--added');
          if (settleAt !== undefined) wall.track(row, 'is-', [{ at: settleAt, state: 'settled' }]);
          // Removed lines leave first, so the card never grows past its larger version.
          if (!hideRemoved) growIn(row, (swapAt ?? at) + (swapAt !== undefined ? 0.3 : 0), added);
          added += 1;
        } else if (typeAt !== undefined) {
          growIn(row, typeAt, i);
        }
        marks.filter((mark) => matches(mark, text)).forEach((mark) => {
          if (mark.state === 'added') row.classList.add('ak-code-row--added');
          else wall.track(row, 'is-', [{ at: mark.at, state: mark.state }, ...(mark.until !== undefined ? [{ at: mark.until, state: '' }] : [])]);
        });
        return row;
      });
      // Fold to the title line; max-height needs no measurement, so a variant
      // hidden while the stage was built folds the same way.
      if (collapseAt !== undefined) {
        tween(body, [{ maxHeight: '420px' }, { maxHeight: '0px', paddingTop: '0px', paddingBottom: '0px' }], collapseAt, 0.4, EASE.inOut);
        wall.track(body, 'is-', [{ at: collapseAt + 0.4, state: 'folded' }]);
      }
    });
    wall.show(node, at, until, how);
    if (goneAt !== undefined) leave(node, goneAt);
    return { node, rows };
  }

  /** Takes `node` out of its column at `at`: it fades while the space it held closes. */
  function leave(node, at) {
    tween(node, [{ maxHeight: '600px', opacity: 1, marginBottom: '0px' }, { maxHeight: '0px', opacity: 0, marginBottom: '-8px' }], at, 0.4, EASE.inOut);
  }

  /** A row in the editor column: an arrow down, labeled (code first, then test). */
  function flow(parent, { text, at, how = 'fade' }) {
    const node = el('div', 'td-flow is-staged', parent);
    node.append(icon('arrowDown'));
    el('span', null, node, text);
    wall.show(node, at, undefined, how);
    return node;
  }

  /** A row of tags in a column, or placed at (x, y): items = [{ text, at, tone }]; the row leaves at `until`. */
  function chips(parent, { items, x, y, until, tight = false }) {
    // `tight` packs a row closer, so three short tags fit along a narrow picture.
    const node = el('div', `td-chips${tight ? ' td-chips--tight' : ''}`, parent);
    if (x !== undefined) {
      place(node, x, y);
      node.style.position = 'absolute';
    }
    if (until !== undefined) fx.fadeOut(node, until - 0.25, 0.25);
    items.forEach(({ text, at, tone, iconName }) => {
      const chip = el('span', `td-chip${tone ? ` td-chip--${tone}` : ''} is-staged`, node);
      if (iconName) chip.append(icon(iconName));
      chip.append(document.createTextNode(text));
      fx.pop(chip, at, { from: 0.6 });
    });
    return node;
  }

  /**
   * What a call returns, in words every language shares: states = [{ at,
   * text, sum, tone }] replace each other in place (tone 'red' or 'green').
   * `stacked` puts the label, the value, and the sum on lines of their own,
   * for the side column.
   */
  function result(parent, { at, until, states, label, x, y, w, stacked = false }) {
    const node = el('div', `td-result${stacked ? ' td-result--stacked' : ''} is-staged`, parent);
    if (x !== undefined) {
      place(node, x, y);
      node.style.position = 'absolute';
      node.style.width = `${w}px`;
    }
    if (label) el('span', 'td-result-label', node, label);
    const words = el('span', 'td-result-words', node);
    states.forEach((entry, i) => {
      const line = el('span', `td-result-line${entry.tone ? ` td-result-line--${entry.tone}` : ''}`, words);
      el('code', 'td-result-call', line, entry.text);
      if (entry.sum) el('b', 'td-result-sum', line, entry.sum);
      wall.track(line, 'is-', [{ at: -Infinity, state: 'hidden' }, { at: entry.at, state: '' }, ...(states[i + 1] ? [{ at: states[i + 1].at, state: 'hidden' }] : [])]);
    });
    wall.show(node, at, until, 'rise');
    return node;
  }

  /** The job of split: two inputs, an arrow, and the output. */
  function job(parent, { x, y, w, at, inputsAt = [], outputAt }) {
    const node = place(el('div', 'td-job is-staged', parent), x, y);
    node.style.width = `${w}px`;
    el('div', 'td-job-title', node, 'The job: split');
    [['Bill in cents', 'for example 8000'], ['People', 'for example 3']].forEach(([name, example], i) => {
      const input = el('div', 'td-job-input is-staged', node);
      el('b', null, input, name);
      el('span', null, input, example);
      fx.rise(input, inputsAt[i] ?? at, { distance: 8, duration: 0.3 });
    });
    const arrow = el('div', 'td-job-arrow is-staged', node);
    arrow.append(icon('arrowDown'));
    const output = el('div', 'td-job-output is-staged', node);
    el('b', null, output, 'A list of shares in cents');
    el('span', null, output, 'one per person');
    fx.fadeIn(arrow, outputAt ?? at, 0.3);
    fx.rise(output, outputAt ?? at, { distance: 8, duration: 0.3 });
    wall.show(node, at, undefined, 'rise');
    return node;
  }

  /** Red, green, refactor in a row, with the arrow back labeled `next`. */
  function cycleStrip(parent, { x, y, at, until }) {
    const node = place(el('div', 'td-strip is-staged', parent), x, y);
    STATIONS.forEach((station, i) => {
      const chip = el('span', `td-strip-step td-station--${station.key}`, node);
      chip.append(icon(station.iconName));
      chip.append(document.createTextNode(station.word));
      if (i < 2) el('span', 'td-strip-arrow', node).append(icon('forward'));
    });
    const back = el('span', 'td-strip-back', node);
    back.append(icon('loop'));
    back.append(document.createTextNode('next test'));
    wall.show(node, at, until, 'fade');
    return node;
  }

  /**
   * A runner's failure message for `step`, in every language, headed by the
   * runner; `verdict` = { text, tone, at } judges it (tone 'good' or 'bad').
   */
  function message(parent, { x, y, w, step, verdict, after, at, until }) {
    const node = place(el('div', 'td-message is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'td-message-head', node);
    variants(head, 'span', 'td-message-runner', (runner, language) => {
      runner.textContent = stepLines(language, step).runner || stageOf(language).runner;
    });
    if (verdict) {
      const judge = el('span', `td-message-verdict td-message-verdict--${verdict.tone} is-staged`, head);
      judge.append(icon(verdict.tone === 'good' ? 'check' : 'cross'));
      judge.append(document.createTextNode(verdict.text));
      fx.pop(judge, verdict.at ?? at, { from: 0.6 });
    }
    variants(node, 'div', 'td-message-lines', (box, language) => {
      (stepLines(language, step).detail || []).forEach((text) => el('code', 'td-terminal-detail-line', box, text));
    });
    if (after) {
      const tail = el('div', 'td-message-after is-staged', node, after.text);
      fx.rise(tail, after.at, { distance: 6, duration: 0.3 });
    }
    wall.show(node, at, until, 'rise');
    return node;
  }

  /** A row of sticky notes in a column: items = [{ text, at }]; the row leaves at `until`. */
  function notes(parent, { items, until }) {
    const node = el('div', 'td-notes', parent);
    items.forEach(({ text, at, tone }) => {
      const note = el('div', `sk-note${tone ? ` sk-note--${tone}` : ''} td-note is-staged`, node, text);
      fx.pop(note, at, { from: 0.5, rotate: -1.5 });
    });
    if (until !== undefined) leave(node, until);
    return node;
  }

  /**
   * One pan of a trade-off as a card of its own, colored like the quality
   * cards: `effect` 'promoted' (what you get) or 'inhibited' (what it
   * costs); items = [{ name, why, at }].
   */
  function pan(parent, { x, y, w, title, effect = 'promoted', items, at, until }) {
    const node = place(el('div', `ak-pan ak-pan--${effect} td-pan is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'ak-pan-head', node);
    el('span', 'ak-quality-icon', head).append(icon(effect === 'promoted' ? 'arrowUp' : 'arrowDown'));
    el('b', 'ak-pan-title', head, title);
    const list = el('ul', 'ak-pan-items', node);
    // Each item grows in when it is named, so the pan holds no empty space before then.
    items.forEach(({ name, why, at: when = at }) => {
      const item = el('li', 'ak-pan-item td-pan-item', list);
      el('b', 'ak-pan-name', el('span', 'ak-pan-line', item), name);
      if (why) el('span', 'ak-pan-why', item, why);
      tween(item, [
        { maxHeight: '0px', opacity: 0, marginTop: '0px', paddingTop: '0px', borderTopWidth: '0px' },
        { maxHeight: '120px', opacity: 1, marginTop: '8px', paddingTop: '8px', borderTopWidth: '2px' },
      ], when, 0.35, EASE.out);
    });
    wall.show(node, at, until, 'rise');
    return node;
  }

  /** A small labeled card standing for a test or code file: tone 'tests' or 'code', with a verdict icon. */
  function token(parent, { x, y, w = 150, text, tone = 'tests', mark, at, until, how = 'pop' }) {
    const node = place(el('div', `td-token td-token--${tone} is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    node.append(icon(tone === 'tests' ? 'check' : 'code'));
    el('span', null, node, text);
    if (mark) {
      const sign = el('span', `td-token-mark td-token-mark--${mark.tone} is-staged`, node);
      sign.append(icon(mark.tone === 'good' ? 'check' : 'cross'));
      fx.pop(sign, mark.at, { from: 0.4 });
    }
    wall.show(node, at, until, how);
    return node;
  }

  /** A dashed outline where code will go: `text` in the middle, `question` added at `questionAt`. */
  function placeholder(parent, { text, h = 96, at, until, question, questionAt }) {
    const node = el('div', 'td-placeholder is-staged', parent);
    node.style.height = `${h}px`;
    el('span', 'td-placeholder-text', node, text);
    if (question) {
      const ask = el('span', 'td-placeholder-question is-staged', node);
      ask.append(icon('question'));
      ask.append(document.createTextNode(question));
      fx.pop(ask, questionAt, { from: 0.6 });
    }
    wall.show(node, at, undefined, 'fade');
    if (until !== undefined) tween(node, [{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0, marginTop: '0px' }], until, 0.35, EASE.inOut);
    return node;
  }

  // ------------------------------------------------------------------
  // The test list: an index card
  // ------------------------------------------------------------------

  /**
   * Beck's test list on a 5×3 index card. lines = [{ text, at }]; states =
   * [{ at, line, state }] with state 'now' (a marker tab), 'done' (checked
   * and struck through), or 'yours' (a "Your turn" tab).
   */
  function testList(parent, { x = WORKBENCH.side.x, y = WORKBENCH.side.y, w = WORKBENCH.side.w, title = 'Test list', lines, states = [], at, until, how = 'drop' }) {
    const node = place(el('div', 'td-list is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'td-list-title', node);
    head.append(icon('list'));
    head.append(document.createTextNode(title));
    const rows = lines.map(({ text, at: lineAt }) => {
      const row = el('div', 'td-list-line', node);
      const box = el('span', 'td-list-box', row);
      box.append(icon('check'));
      box.append(icon('forward'));
      el('span', 'td-list-text', row, text);
      el('span', 'td-list-marker', row, 'Your turn');
      if (lineAt !== undefined) {
        row.classList.add('is-staged');
        fx.rise(row, lineAt, { distance: 8, duration: 0.3 });
      }
      return row;
    });
    rows.forEach((row, i) => {
      const own = states.filter((entry) => entry.line === i).map(({ at: when, state }) => ({ at: when, state }));
      if (own.length) wall.track(row, 'is-', own);
    });
    wall.show(node, at, until, how);
    return { node, rows };
  }

  // ------------------------------------------------------------------
  // The test runner: a terminal along the bottom
  // ------------------------------------------------------------------

  const STATE_WORDS = { idle: 'Ready', red: 'Red', green: 'Green', build: 'Red · build failed' };
  const STATE_ICONS = { idle: 'terminal', red: 'cross', green: 'check', build: 'cross' };

  /** The runner's lines for `step` in `language`: { status, detail, build }. */
  function stepLines(language, step) {
    const value = stageOf(language).steps[step];
    return typeof value === 'string' ? { status: value } : (value || {});
  }

  /**
   * One state of the runner: a terminal panel anchored to the bottom of the
   * body. `tone`: idle, red, green, or build (red because the code does not
   * build); `step` names its lines in tdd_code.yml (status, and the failure
   * detail when `detail`); `tests` lists per-test rows [{ test, state }]
   * (state 'pass', 'fail', or 'wait'); `status` overrides the status line
   * with neutral words; `warn` adds a warning tag at `warnAt`.
   */
  function terminalState(parent, { tone, step, tests, detail = false, status, warn, warnAt, at, until, w = WORKBENCH.terminal.w, x = WORKBENCH.terminal.x }) {
    const node = el('div', `td-terminal td-terminal--${tone} is-staged`, parent);
    node.style.left = `${x}px`;
    node.style.bottom = `${WORKBENCH.terminal.bottom}px`;
    node.style.width = `${w}px`;
    const head = el('div', 'td-terminal-head', node);
    // A terminal window's title-bar dots, in grey so they never read as red or green.
    el('span', 'td-terminal-dots', head);
    const state = el('span', 'td-terminal-state', head);
    state.append(icon(STATE_ICONS[tone]));
    el('b', null, state, STATE_WORDS[tone]);
    variants(head, 'span', 'td-terminal-line', (line, language) => {
      const lines = step ? stepLines(language, step) : {};
      el('span', 'td-terminal-runner', line, lines.runner || stageOf(language).runner);
      el('code', 'td-terminal-status', line, status ?? lines.status ?? '');
    });
    // The runner's signal light at the end of the title bar: lit red or green with the verdict.
    const light = el('span', 'td-terminal-light', head);
    const lamp = window.TddArt.trafficLight(light);
    if (tone === 'green') lamp.classList.add('is-green');
    else if (tone !== 'idle') lamp.classList.add('is-red');
    if (tests) {
      const list = el('div', 'td-terminal-tests', node);
      tests.forEach(({ test, state: testState }) => {
        const row = el('div', `td-terminal-test td-terminal-test--${testState}`, list);
        row.append(icon(testState === 'pass' ? 'check' : testState === 'fail' ? 'cross' : 'question'));
        variants(row, 'code', 'td-terminal-test-name', (name, language) => { name.textContent = stageOf(language).tests[test]; });
      });
    }
    if (detail) {
      variants(node, 'div', 'td-terminal-detail', (box, language) => {
        const lines = stepLines(language, typeof detail === 'string' ? detail : step).detail || [];
        if (lines.length > 3) box.classList.add('td-terminal-detail--columns');
        lines.forEach((text) => el('code', 'td-terminal-detail-line', box, text));
      });
    }
    if (warn) {
      // On a line of its own: a runner's status line can fill the head's width.
      const tag = el('span', 'td-terminal-warn is-staged', el('div', 'td-terminal-warn-row', node));
      tag.append(icon('warning'));
      tag.append(document.createTextNode(warn));
      fx.pop(tag, warnAt ?? at, { from: 0.6 });
    }
    fx.fadeIn(node, at, 0.25);
    if (until !== undefined) fx.fadeOut(node, until - 0.2, 0.2);
    return node;
  }

  /** The runner through a picture: states = [{ at, ... }], each shown until the next begins. */
  function terminal(parent, states, until) {
    return states.map((state, i) => terminalState(parent, { ...state, until: states[i + 1]?.at ?? until }));
  }

  // ------------------------------------------------------------------
  // The story: a phone with the group chat, and the receipt
  // ------------------------------------------------------------------

  /**
   * A phone with the group chat "Ramen crew". `messageAt` shows your
   * message and the Split the bill button (pulsing at `pulseAt`); `billAt`
   * adds the bill card, its three share rows at `rowsAt` (one by one), and
   * the sum line at `sumAt`. `small` draws only the bill card's total, with
   * `centsAt` turning $80.00 into 8000 cents.
   */
  function phone(parent, { x, y, w = 300, at, until, how = 'rise', messageAt, pulseAt, billAt, rowsAt, sumAt, small = false, centsAt }) {
    const node = place(el('div', `td-phone${small ? ' td-phone--small' : ''} is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    const screen = el('div', 'td-phone-screen', node);
    el('span', 'td-phone-notch', screen);
    const header = el('div', 'td-chat-header', screen);
    const faces = el('span', 'td-chat-faces', header);
    ['p', 'm', 'y'].forEach((who) => el('span', `td-chat-face td-chat-face--${who}`, faces));
    el('b', null, header, 'Ramen crew');
    if (small) {
      const total = el('div', 'td-chat-bill td-chat-bill--total', screen);
      el('span', 'td-chat-bill-title', total, 'Bill');
      const dollars = el('b', 'td-chat-amount', total, '$80.00');
      if (centsAt !== undefined) {
        const cents = el('b', 'td-chat-amount td-chat-amount--cents is-staged', total, '8000 cents');
        fx.fadeOut(dollars, centsAt, 0.2);
        fx.fadeIn(cents, centsAt + 0.1, 0.3);
      }
    } else {
      const message = el('div', 'td-chat-message is-staged', screen);
      el('span', 'td-chat-who', message, 'You');
      el('span', null, message, 'I paid, splitting it now');
      const button = el('div', 'td-chat-button is-staged', screen);
      button.append(icon('receipt'));
      button.append(document.createTextNode('Split the bill'));
      fx.rise(message, messageAt ?? at, { distance: 8, duration: 0.3 });
      fx.rise(button, messageAt ?? at, { distance: 8, duration: 0.3 });
      if (pulseAt !== undefined) fx.bump(button, pulseAt, 0.1);
      if (billAt !== undefined) {
        const bill = el('div', 'td-chat-bill is-staged', screen);
        el('div', 'td-chat-bill-title', bill, '$80.00 split 3 ways');
        ['Priya', 'Mateo', 'You'].forEach((who, i) => {
          const row = el('div', 'td-chat-row is-staged', bill);
          el('span', null, row, who);
          el('b', null, row, '$26.66');
          fx.rise(row, (rowsAt ?? billAt) + i * 0.35, { distance: 6, duration: 0.25 });
        });
        const sum = el('div', 'td-chat-sum is-staged', bill);
        el('span', null, sum, 'Total of shares');
        el('b', null, sum, '$79.98');
        fx.rise(sum, sumAt ?? billAt, { distance: 6, duration: 0.3 });
        tween(button, [{ maxHeight: '60px', opacity: 1 }, { maxHeight: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' }], billAt, 0.3, EASE.inOut);
        fx.fadeIn(bill, billAt + 0.1, 0.3);
      }
    }
    wall.show(node, at, until, how);
    return node;
  }

  /** The restaurant's receipt: three items and the total; `circleAt` circles the total; `compact` drops the items. */
  function receipt(parent, { x, y, w = 260, at, until, how = 'slide', rotate = -3, circleAt, totalAt, compact = false }) {
    const node = place(el('div', 'td-receipt is-staged', parent), x, y);
    node.style.width = `${w}px`;
    node.style.rotate = `${rotate}deg`;
    el('div', 'td-receipt-name', node, 'Sawtelle Ramen');
    el('div', 'td-receipt-guests', node, '3 guests');
    (compact ? [] : [['Tonkotsu ×3', '$51.00'], ['Gyoza ×2', '$14.00'], ['Matcha soda ×3', '$15.00']]).forEach(([item, price]) => {
      const row = el('div', 'td-receipt-row', node);
      el('span', null, row, item);
      el('span', null, row, price);
    });
    const total = el('div', 'td-receipt-total', node);
    el('span', null, total, 'Total');
    el('b', null, total, '$80.00');
    if (totalAt !== undefined) {
      total.classList.add('is-staged');
      fx.rise(total, totalAt, { distance: 6, duration: 0.3 });
    }
    if (circleAt !== undefined) {
      const ring = svg('svg', { class: 'td-receipt-circle', viewBox: '0 0 120 44', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, total);
      const path = svg('path', { d: 'M8 26 C 6 8, 104 4, 114 18 C 120 32, 64 42, 18 38 C 6 36, 4 24, 16 14' }, ring);
      path.style.strokeDashoffset = '1';
      fx.draw(path, circleAt, 0.5);
    }
    el('div', 'td-receipt-edge', node);
    wall.show(node, at, until, how);
    return node;
  }

  // ------------------------------------------------------------------
  // The cycle
  // ------------------------------------------------------------------

  const STATIONS = [
    { key: 'red', word: 'Red', iconName: 'cross', angle: -90 },
    { key: 'green', word: 'Green', iconName: 'check', angle: 30 },
    { key: 'refactor', word: 'Refactor', iconName: 'broom', angle: 150 },
  ];

  /**
   * Red, green, refactor on a ring with arrows. `stations` = { red: { at,
   * text }, ... } shows each station at its time with an optional caption;
   * `checks` = { red: at, ... } puts a check on a station; `next` labels the
   * arrow from refactor back to red; `center` sits in the middle.
   */
  function cycle(parent, { x, y, r = 120, at, until, how = 'fade', stations, checks = {}, next, center }) {
    const size = r * 2 + 120;
    const node = place(el('div', 'td-cycle is-staged', parent), x - size / 2, y - size / 2);
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    const art = svg('svg', { class: 'td-cycle-ring', viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true' }, node);
    const c = size / 2;
    const point = (deg, radius = r) => [c + radius * Math.cos((deg * Math.PI) / 180), c + radius * Math.sin((deg * Math.PI) / 180)];
    // A broad, faint track under the arrows, so the ring reads as one loop.
    svg('circle', { class: 'td-cycle-track', cx: c, cy: c, r }, art);
    STATIONS.forEach((station, i) => {
      const nextStation = STATIONS[(i + 1) % 3];
      // Each arc starts and ends just clear of the station discs (radius 40px).
      const gap = (54 / r) * (180 / Math.PI);
      const from = station.angle + gap;
      const to = (nextStation.angle < station.angle ? nextStation.angle + 360 : nextStation.angle) - gap;
      const [x1, y1] = point(from);
      // The line stops at the arrowhead's base, so no round line end shows past its tip.
      const [x2, y2] = point(to - (16 / r) * (180 / Math.PI));
      // An arrow takes the color of the step it leads to: red to green is green.
      const tone = nextStation.key;
      const arc = svg('path', { class: `td-cycle-arc td-cycle-arc--${tone}`, d: `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}` }, art);
      // Hidden until drawn: the ring appears before its arrows do.
      arc.style.strokeDashoffset = '1';
      const end = point(to);
      const before = point(to - 6);
      const angle = Math.atan2(end[1] - before[1], end[0] - before[0]);
      const head = [[end[0], end[1]], [end[0] - 22 * Math.cos(angle - 0.48), end[1] - 22 * Math.sin(angle - 0.48)], [end[0] - 22 * Math.cos(angle + 0.48), end[1] - 22 * Math.sin(angle + 0.48)]];
      const arrowHead = svg('path', { class: `td-cycle-head td-cycle-head--${tone}`, d: `M${head.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L')} Z` }, art);
      const when = stations?.[nextStation.key]?.at ?? at;
      const arcAt = i === 2 && next?.at !== undefined ? next.at : when;
      fx.draw(arc, arcAt, 0.45);
      arrowHead.classList.add('is-staged');
      fx.fadeIn(arrowHead, arcAt + 0.35, 0.2);
    });
    STATIONS.forEach((station) => {
      const spec = stations?.[station.key] || {};
      const [sx, sy] = point(station.angle);
      const badge = place(el('div', `td-station td-station--${station.key} is-staged`, node), sx, sy);
      const disc = el('span', 'td-station-disc', badge);
      disc.append(icon(station.iconName));
      // Each station's words sit outside the ring (CSS), so no arc runs through them.
      const words = el('span', 'td-station-label', badge);
      el('b', 'td-station-word', words, station.word);
      if (spec.text) el('span', 'td-station-text', words, spec.text);
      fx.pop(badge, spec.at ?? at, { from: 0.5 });
      if (checks[station.key] !== undefined) {
        const tick = el('span', 'td-station-check is-staged', disc);
        tick.append(icon('check'));
        fx.pop(tick, checks[station.key], { from: 0.3 });
      }
    });
    if (next) {
      // Outside the ring, beside the arc from Refactor back to Red, never on it.
      const [nx, ny] = point(212, r + 70);
      const tag = place(el('span', 'td-cycle-next is-staged', node, next.text), nx, ny);
      fx.fadeIn(tag, next.at, 0.3);
    }
    if (center) {
      const mid = place(el('div', 'td-cycle-center is-staged', node, center.text), c, c);
      fx.pop(mid, center.at, { from: 0.6 });
    }
    wall.show(node, at, until, how);
    return node;
  }

  // ------------------------------------------------------------------
  // Runners side by side, step size, a run of results
  // ------------------------------------------------------------------

  /** A runner's line as a card shows it: its alignment runs of spaces become one space. */
  const compact = (line) => line.trim().replace(/\s{2,}/g, ' ');

  /**
   * The four runners in a 2 × 2 grid, each with its red and its green line;
   * the viewer's language is lit, and a click on another card switches the
   * lesson's code to that language. The terminal shows lines verbatim; these
   * cards drop the runners' alignment spaces so the four fit side by side.
   */
  function runnerCards(parent, { x, y, w = 456, h = 112, gap = 12, at, until }) {
    return LANGUAGES.map((language, i) => {
      const node = place(el('div', 'td-runner-card is-staged', parent), x + (i % 2) * (w + gap), y + Math.floor(i / 2) * (h + gap));
      node.style.width = `${w}px`;
      node.dataset.codeRunner = language;
      // A click on the card shows the lesson's code in its language (a
      // picture control, js/video-narration-stage.js).
      node.dataset.stageChoice = 'code-language';
      node.dataset.stageValue = language;
      const bar = el('div', 'td-runner-card-title', node);
      el('span', 'td-terminal-dots', bar);
      el('span', null, bar, CODE[language].label);
      const red = el('div', 'td-runner-card-line td-runner-card-line--red', node);
      red.append(icon('cross'));
      el('code', null, red, compact(stageOf(language).steps.sample_red));
      const green = el('div', 'td-runner-card-line td-runner-card-line--green', node);
      green.append(icon('check'));
      el('code', null, green, compact(stageOf(language).steps.sample_green));
      el('span', 'td-runner-card-yours', bar, 'Your language');
      el('span', 'td-runner-card-pick', bar, 'Use this language');
      wall.show(node, Array.isArray(at) ? at[i] : at, until, 'rise');
      return node;
    });
  }

  /**
   * A step-size ruler from small to large: marks = [{ pos (0 to 1), text,
   * sub, at }]; `back` = { text, at } draws an arrow toward small.
   */
  function stepScale(parent, { x, y, w, at, until, marks, back }) {
    const node = place(el('div', 'td-scale is-staged', parent), x, y);
    node.style.width = `${w}px`;
    el('div', 'td-scale-rule', node);
    el('span', 'td-scale-end td-scale-end--small', node, 'Small steps');
    el('span', 'td-scale-end td-scale-end--large', node, 'Large steps');
    marks.forEach(({ pos, text, sub, at: markAt }) => {
      const mark = el('div', 'td-scale-mark is-staged', node);
      mark.style.left = `${(pos * 100).toFixed(1)}%`;
      el('b', null, mark, text);
      if (sub) el('span', null, mark, sub);
      fx.rise(mark, markAt ?? at, { distance: 8, duration: 0.3 });
    });
    if (back) {
      const arrow = el('div', 'td-scale-back is-staged', node);
      arrow.append(icon('rewind'));
      arrow.append(document.createTextNode(back.text));
      fx.fadeIn(arrow, back.at, 0.3);
    }
    wall.show(node, at, until, 'fade');
    return node;
  }

  /** A run of runner results as chips (states: [{ tone, text, at }]) with a bracket over the last two. */
  function runTimeline(parent, { x, y, at, until, chips, bracket }) {
    const node = place(el('div', 'td-runs is-staged', parent), x, y);
    const row = el('div', 'td-runs-row', node);
    chips.forEach(({ tone, text, at: chipAt }) => {
      const chip = el('span', `td-run td-run--${tone} is-staged`, row);
      chip.append(icon(tone === 'red' ? 'cross' : 'check'));
      chip.append(document.createTextNode(text));
      fx.pop(chip, chipAt ?? at, { from: 0.6 });
    });
    if (bracket) {
      const mark = el('div', 'td-runs-bracket is-staged', node);
      el('span', null, mark, bracket.text);
      fx.fadeIn(mark, bracket.at, 0.3);
    }
    wall.show(node, at, until, 'fade');
    return node;
  }

  // ------------------------------------------------------------------
  // The evidence
  // ------------------------------------------------------------------

  /**
   * A study's findings as ranges: bars = [{ label, range: [from, to] (0 to
   * 1), text, tone, iconName, at }]. Each band spans its range on a track
   * from 0 to 100%, so a finding reported as "40 to 90%" never shows as one
   * number.
   */
  function bars(parent, { x, y, w, title, at, until, bars: items, tag, tagAt }) {
    const node = place(el('div', 'td-bars is-staged', parent), x, y);
    node.style.width = `${w}px`;
    el('div', 'td-bars-title', node, title);
    items.forEach(({ label, range: [from, to], text, tone, iconName, at: barAt }) => {
      const row = el('div', `td-bar td-bar--${tone} is-staged`, node);
      const head = el('div', 'td-bar-head', row);
      if (iconName) head.append(icon(iconName));
      el('span', 'td-bar-label', head, label);
      const track = el('div', 'td-bar-track', row);
      const fill = el('div', 'td-bar-fill', track);
      fill.style.left = `${(from * 100).toFixed(0)}%`;
      fill.style.width = `${((to - from) * 100).toFixed(0)}%`;
      el('b', 'td-bar-text', row, text);
      fx.rise(row, barAt ?? at, { distance: 8, duration: 0.3 });
      tween(fill, [{ scale: '0 1' }, { scale: '1 1' }], (barAt ?? at) + 0.1, 0.5, EASE.out);
    });
    if (tag) {
      const word = el('div', 'td-bars-tag is-staged', node, tag);
      fx.rise(word, tagAt ?? at, { distance: 6, duration: 0.3 });
    }
    wall.show(node, at, until, 'rise');
    return node;
  }

  /** A row of red, green, refactor turns: `turns` widths in units; steady rows draw them even. */
  function rhythm(parent, { x, y, w, title, turns, at, until, note, noteAt }) {
    const node = place(el('div', 'td-rhythm is-staged', parent), x, y);
    node.style.width = `${w}px`;
    el('div', 'td-rhythm-title', node, title);
    const row = el('div', 'td-rhythm-row', node);
    const total = turns.reduce((sum, value) => sum + value, 0);
    turns.forEach((value) => {
      const turn = el('span', 'td-rhythm-turn', row);
      turn.style.flexGrow = String(value / total);
      ['red', 'green', 'refactor'].forEach((step) => el('span', `td-rhythm-part td-rhythm-part--${step}`, turn));
    });
    if (note) {
      const tag = el('div', 'td-rhythm-note is-staged', node);
      tag.append(icon('arrowUp'));
      tag.append(document.createTextNode(note));
      fx.rise(tag, noteAt ?? at, { distance: 6, duration: 0.3 });
    }
    wall.show(node, at, until, 'rise');
    return node;
  }

  /**
   * A crowd of 100 figures in `columns` columns; the figures at the `lit`
   * positions light up at `litAt`, scattered through the crowd as people
   * are.
   */
  function figures(parent, { x, y, size = 18, gap = 5, columns = 20, lit, litAt, at, until }) {
    const node = place(el('div', 'td-figures is-staged', parent), x, y);
    node.style.width = `${columns * size + (columns - 1) * gap}px`;
    node.style.gap = `${gap}px`;
    for (let i = 0; i < 100; i += 1) {
      const figure = svg('svg', { class: 'td-figure', viewBox: '0 0 10 14', width: size, height: size * 1.4, 'aria-hidden': 'true' }, node);
      svg('circle', { cx: 5, cy: 3, r: 2.6 }, figure);
      svg('path', { d: 'M1 14 V9.5 A4 4 0 0 1 9 9.5 V14 Z' }, figure);
      if (lit.includes(i)) wall.track(figure, 'is-', [{ at: litAt, state: 'lit' }]);
    }
    wall.show(node, at, until, 'fade');
    return node;
  }

  /**
   * A pile of `count` test cards on a shelf, built bottom up from `at`, with
   * its label under the shelf. Piles with the same `room` (in cards) stand
   * on one shelf line, so their heights compare.
   */
  function testStack(parent, { x, y, w = 200, count, room = count, label, at, until }) {
    const node = place(el('div', 'td-stack is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const pile = el('div', 'td-stack-pile', node);
    pile.style.height = `${room * 50}px`;
    for (let i = 0; i < count; i += 1) {
      const card = el('div', `td-stack-card td-stack-card--tilt${i % 4} is-staged`, pile);
      card.append(icon('check'));
      el('span', null, card, 'test');
      fx.rise(card, at + i * 0.12, { distance: 14, duration: 0.3 });
    }
    el('div', 'td-stack-shelf', node);
    el('div', 'td-stack-label', node, label);
    wall.show(node, at, until, 'fade');
    return node;
  }

  // ------------------------------------------------------------------
  // Illustrations (tdd-art.js): placed, posed, and revealed on the timeline
  // ------------------------------------------------------------------

  /** Keeps one set of state classes on `root` at a time: poses = [{ at, pose: 'is-dead has-smoke' }]. */
  function pose(root, poses) {
    const sorted = [...poses].sort((a, b) => a.at - b.at);
    const classes = (entry) => (entry?.pose || '').split(' ').filter(Boolean);
    let shown = null;
    const update = (t) => {
      const entry = wall.latest(sorted, t);
      const current = entry && entry.at <= t ? entry : null;
      if (current === shown) return;
      classes(shown).forEach((name) => root.classList.remove(name));
      classes(current).forEach((name) => root.classList.add(name));
      shown = current;
    };
    update(-Infinity);
    onFrame(update);
  }

  /**
   * Illustration `name` (window.TddArt) at (x, y), `w` wide; its height
   * follows the art's viewBox. `poses` sets its state classes in turn,
   * `reveal` = [{ part, at }] keeps a part hidden until its time, and
   * `moves` = [{ part, at, duration, from: [dx, dy], to }] slides a part
   * from an offset to its drawn place (or `to` an offset). Returns
   * { node, root }.
   */
  function art(parent, name, { x, y, w, options, at, until, how = 'fade', poses = [], reveal = [], moves = [], className = '' }) {
    const node = place(el('div', `td-art td-art--${name} ${className} is-staged`, parent), x, y);
    const root = window.TddArt[name](node, options);
    const [, , vw, vh] = root.getAttribute('viewBox').split(/\s+/).map(Number);
    node.style.width = `${w}px`;
    node.style.height = `${((w * vh) / vw).toFixed(1)}px`;
    if (poses.length) pose(root, poses);
    reveal.forEach(({ part, at: partAt, duration = 0.35 }) => {
      root.querySelectorAll(`.${part}`).forEach((piece) => {
        piece.classList.add('is-staged');
        fx.fadeIn(piece, partAt, duration);
      });
    });
    moves.forEach(({ part, at: moveAt, duration = 0.6, from = [0, 0], to = [0, 0], rotate, easing = EASE.inOut }) => {
      // A move slides a part, or with `rotate` = [from, to] (degrees) turns it about its CSS pivot.
      const frames = rotate
        ? [{ rotate: `${rotate[0]}deg` }, { rotate: `${rotate[1]}deg` }]
        : [{ translate: `${from[0]}px ${from[1]}px` }, { translate: `${to[0]}px ${to[1]}px` }];
      root.querySelectorAll(`.${part}`).forEach((piece) => tween(piece, frames, moveAt, duration, easing));
    });
    wall.show(node, at, until, how);
    return { node, root };
  }

  /**
   * A paper note with a small illustration beside its words: `art` names
   * the picture (with `options` and `poses`), `artW` its width. The note is
   * cream paper with dark ink in both modes, like the wall kit's notes.
   */
  function spot(parent, { x, y, w = 260, art: name, artW = 96, options, poses = [], text, sub, at, until, how = 'pop', tone = 'paper', stack = false }) {
    // `stack` puts a larger picture above the words instead of beside them.
    const node = place(el('div', `td-spot td-spot--${tone}${stack ? ' td-spot--stack' : ''} is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    const picture = el('div', 'td-spot-art', node);
    picture.style.width = `${artW}px`;
    const root = window.TddArt[name](picture, options);
    if (poses.length) pose(root, poses);
    const words = el('div', 'td-spot-words', node);
    el('b', 'td-spot-text', words, text);
    if (sub) el('span', 'td-spot-sub', words, sub);
    wall.show(node, at, until, how);
    return { node, root };
  }

  /** The four rules' colors and emblems (kit icons): red to green to blue, as the cycle runs. */
  const RULE_LOOKS = {
    1: { tone: 'violet', iconName: 'target' },
    2: { tone: 'red', iconName: 'alarm' },
    3: { tone: 'green', iconName: 'flag' },
    4: { tone: 'blue', iconName: 'hardhat' },
  };

  /**
   * Rule n's plaque: a colored band with its emblem, number, and name over its
   * text. A `banner` is one slim band across the picture, the text beside the
   * name, so a metaphor picture can take the space below it.
   */
  function rulePlaque(parent, { x, y, w, n, name, text, banner = false, at, until, how = 'drop' }) {
    const look = RULE_LOOKS[n];
    const node = place(el('div', `td-plaque td-plaque--${look.tone}${banner ? ' td-plaque--banner' : ''} is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'td-plaque-head', node);
    el('span', 'td-plaque-emblem', head).append(icon(look.iconName));
    const title = el('span', 'td-plaque-title', head);
    el('span', 'td-plaque-number', title, `Rule ${n}`);
    el('b', 'td-plaque-name', title, name);
    if (text) el('p', 'td-plaque-text', banner ? head : node, text);
    wall.show(node, at, until, how);
    return node;
  }

  window.TddKit = {
    WORKBENCH, LANGUAGES, RULE_LOOKS, diff, variants, editor, card, leave, flow, chips, result, job,
    cycleStrip, message, token, notes, pan, placeholder, testList, terminalState, terminal, phone,
    receipt, cycle, runnerCards, stepScale, runTimeline, bars, rhythm, figures, testStack, pose, art,
    spot, rulePlaque,
  };
})();
