/**
 * UnixCommandLab — interactive "predict → run → reveal" cards for UNIX commands
 * whose effect isn't visible on the filesystem tree (cat, grep, sed, sort, uniq,
 * wc, awk, chmod, echo, export, read, etc.).
 *
 * Layout embodies the POSIX data-flow model: inputs on the left (stdin +
 * referenced files + env), command pill in the middle, outputs on the right
 * (stdout + stderr + modified files + exit status). Every card uses the same
 * schema so repeated exposure teaches the model by spatial repetition.
 *
 * Pedagogy (grounded in CLT, Mayer, ICAP):
 *   - Spatial contiguity: each stream has a fixed position; empty streams are
 *     hidden (coherence), so students never see "stdin: (empty)" clutter.
 *   - Signaling: stderr is always rendered in warm red; modified files get
 *     the fs-command-lab yellow-burst animation to mark "this changed".
 *   - Active → Constructive: the `predict: true` option renders a free-text
 *     box for the student to commit their stdout guess before the reveal.
 *     The prediction persists next to the actual output so self-comparison
 *     is visible.
 *   - Exit code is always shown even when stdout/stderr are empty — absence
 *     of output is a discriminable concept.
 *
 * Spec:
 *   {
 *     "command": "grep ERROR log.txt",
 *     "description": "markdown description (bold, italic, code, paragraphs)",
 *     "predict": true,                  // show prediction input (default false)
 *     "predictPrompt": "string",        // optional custom prompt
 *     "input": {
 *       "stdin":  "line1\nline2",       // multi-line stdin payload
 *       "files":  [ { "name": "log.txt", "content": "..." } ],
 *       "env":    [ { "name": "PATH", "value": "/usr/bin" } ]
 *     },
 *     "output": {
 *       "stdout": "lines matching ERROR",
 *       "stderr": "",
 *       "exit":   0,
 *       "files":  [ { "name": "out.txt", "content": "new content",
 *                     "before": "old content", "action": "overwrite|append|create" } ],
 *       "env":    [ { "name": "MY_VAR", "value": "hi", "action": "set|unset|modified" } ]
 *     },
 *     "notice": "one-sentence callout after reveal — 'notice that…'"
 *   }
 *
 * Usage:
 *   <div data-unix-command-lab>
 *     <script type="application/json"> { … spec … } </script>
 *   </div>
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Tiny markdown → HTML for descriptions (bold, italic, code, paragraphs).
  // Matches fs-command-lab.js so pages that mix the two look uniform.
  // ---------------------------------------------------------------------------
  function mdToHtml(md) {
    if (!md) return '';
    var safe = String(md)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    safe = safe
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s.,;:)!?]|$)/g, '$1<em>$2</em>');
    return safe
      .split(/\n\s*\n/)
      .map(function (p) { return '<p>' + p.replace(/\n/g, ' ').trim() + '</p>'; })
      .join('');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Inline-only markdown → HTML (no paragraph wrap). Use this inside
  // single-line contexts like <label> or inline callouts where a block
  // <p> wrapper would break layout.
  function mdInline(md) {
    if (md == null || md === '') return '';
    return String(md)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s.,;:)!?]|$)/g, '$1<em>$2</em>');
  }

  // Compare a student's free-text prediction against the canonical stdout.
  // Deliberately forgiving — we care that they got the lines right, not the
  // exact byte sequence. Specifically:
  //   - CRLF / CR / LF line endings all normalise to LF
  //     (covers Windows, legacy macOS, modern macOS/Linux)
  //   - leading/trailing whitespace *per line* is trimmed (incl. tabs and
  //     non-breaking space, since \s in JS includes \u00A0)
  //   - runs of internal whitespace collapse to a single space
  //   - any number of leading or trailing blank lines are dropped
  //     (interior blanks are preserved — they carry meaning)
  function normalizeForCompare(s) {
    var lines = String(s == null ? '' : s)
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map(function (line) { return line.replace(/\s+/g, ' ').trim(); });
    while (lines.length && lines[0] === '') lines.shift();
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Panel builders. Each returns a DOM element or null when the stream is empty.
  // Returning null means "don't render this panel at all" (coherence principle).
  // ---------------------------------------------------------------------------

  function makePanel(kind, label, icon) {
    var wrap = document.createElement('div');
    wrap.className = 'unix-lab__panel unix-lab__panel--' + kind;
    var header = document.createElement('div');
    header.className = 'unix-lab__panel-header';
    var iconEl = document.createElement('span');
    iconEl.className = 'unix-lab__panel-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.textContent = icon;
    var labelEl = document.createElement('span');
    labelEl.className = 'unix-lab__panel-label';
    labelEl.textContent = label;
    header.appendChild(iconEl);
    header.appendChild(labelEl);
    wrap.appendChild(header);
    return wrap;
  }

  function appendBody(panel, text, opts) {
    opts = opts || {};
    var body = document.createElement('pre');
    body.className = 'unix-lab__panel-body';
    if (opts.muted) body.classList.add('unix-lab__panel-body--muted');
    if (opts.strike) body.classList.add('unix-lab__panel-body--strike');
    body.textContent = text == null ? '' : text;
    panel.appendChild(body);
    return body;
  }

  function appendEmptyNote(panel, note) {
    var empty = document.createElement('div');
    empty.className = 'unix-lab__panel-empty';
    empty.textContent = note;
    panel.appendChild(empty);
    return empty;
  }

  function stdinPanel(stdin) {
    if (stdin == null || stdin === '') return null;
    var p = makePanel('stdin', 'stdin', '\u2190');    // left arrow
    appendBody(p, stdin);
    return p;
  }

  function fileInputPanel(file) {
    var p = makePanel('file-in', 'file · ' + file.name, '\uD83D\uDCC4'); // 📄
    appendBody(p, file.content);
    if (file.hint) {
      var hint = document.createElement('div');
      hint.className = 'unix-lab__panel-hint';
      hint.textContent = file.hint;
      p.appendChild(hint);
    }
    return p;
  }

  function envInputPanel(env) {
    var p = makePanel('env-in', 'environment', '\u2699');  // ⚙
    var body = document.createElement('div');
    body.className = 'unix-lab__env-list';
    env.forEach(function (e) {
      var row = document.createElement('div');
      row.className = 'unix-lab__env-row';
      row.innerHTML = '<code>' + escapeHtml(e.name) + '</code>=<code>' + escapeHtml(e.value) + '</code>';
      body.appendChild(row);
    });
    p.appendChild(body);
    return p;
  }

  function stdoutPanel(stdout) {
    var p = makePanel('stdout', 'stdout', '\u2192');  // right arrow
    if (stdout == null || stdout === '') {
      appendEmptyNote(p, '(empty — nothing printed)');
    } else {
      appendBody(p, stdout);
    }
    return p;
  }

  function stderrPanel(stderr) {
    if (stderr == null || stderr === '') return null;  // omit when empty
    var p = makePanel('stderr', 'stderr', '\u26A0');   // ⚠
    appendBody(p, stderr);
    return p;
  }

  function fileOutputPanel(file) {
    var action = file.action || (file.before != null ? 'overwrite' : 'create');
    var actionLabel = { create: 'created', overwrite: 'overwritten', append: 'appended', modify: 'modified' }[action] || action;
    var p = makePanel('file-out', 'file · ' + file.name, '\uD83D\uDCDD');  // 📝
    var tag = document.createElement('span');
    tag.className = 'unix-lab__panel-tag unix-lab__panel-tag--' + action;
    tag.textContent = actionLabel;
    p.querySelector('.unix-lab__panel-header').appendChild(tag);

    if (action === 'overwrite' && file.before != null) {
      // Show "before" struck out, then "after" as the new state.
      appendBody(p, file.before, { muted: true, strike: true });
      appendBody(p, file.content);
    } else if (action === 'append' && file.before != null) {
      // Show "before" muted, then the appended bytes highlighted.
      appendBody(p, file.before, { muted: true });
      appendBody(p, file.content);
    } else {
      appendBody(p, file.content);
    }
    // Optional metadata annotation on the "after" state (e.g. "mode after:
    // -rwxr-xr-x"). Rendered in the same hint style as input-file hints so
    // the two stay visually coherent.
    if (file.hint) {
      var hint = document.createElement('div');
      hint.className = 'unix-lab__panel-hint';
      hint.textContent = file.hint;
      p.appendChild(hint);
    }
    return p;
  }

  function envOutputPanel(env) {
    if (!env || !env.length) return null;
    var p = makePanel('env-out', 'environment', '\u2699');
    var body = document.createElement('div');
    body.className = 'unix-lab__env-list';
    env.forEach(function (e) {
      var row = document.createElement('div');
      row.className = 'unix-lab__env-row';
      var actionLabel = { set: '+', unset: '−', modified: '±' }[e.action || 'modified'] || '±';
      var action = document.createElement('span');
      action.className = 'unix-lab__env-action unix-lab__env-action--' + (e.action || 'modified');
      action.textContent = actionLabel;
      row.appendChild(action);
      if (e.action === 'unset') {
        row.appendChild(document.createTextNode(' '));
        var n = document.createElement('code');
        n.textContent = e.name;
        row.appendChild(n);
      } else {
        row.appendChild(document.createTextNode(' '));
        var pair = document.createElement('span');
        pair.innerHTML = '<code>' + escapeHtml(e.name) + '</code>=<code>' + escapeHtml(e.value) + '</code>';
        row.appendChild(pair);
      }
      body.appendChild(row);
    });
    p.appendChild(body);
    return p;
  }

  function exitBadge(code) {
    var ok = (code === 0 || code === undefined || code === null);
    var badge = document.createElement('div');
    badge.className = 'unix-lab__exit unix-lab__exit--' + (ok ? 'ok' : 'err');
    badge.innerHTML = '<span class="unix-lab__exit-label">exit:</span> ' +
      '<span class="unix-lab__exit-code">' + (ok ? 0 : code) + '</span>' +
      '<span class="unix-lab__exit-icon" aria-hidden="true">' + (ok ? '\u2713' : '\u2717') + '</span>';
    return badge;
  }

  // ---------------------------------------------------------------------------
  // Burst animation for newly-revealed output panels — matches fs-command-lab's
  // yellow-rising-falling drop-shadow on changed rows. Keeps the two labs
  // visually coherent.
  // ---------------------------------------------------------------------------
  var BURST_MS = 1000;
  var RISE = 0.22;
  var FALL = 0.45;
  function burstPanel(panel) {
    var start = (window.performance && performance.now) ? performance.now() : Date.now();
    var timer = setInterval(function () {
      var now = (window.performance && performance.now) ? performance.now() : Date.now();
      var p = (now - start) / BURST_MS;
      if (p >= 1) { panel.style.boxShadow = ''; clearInterval(timer); return; }
      var i;
      if (p < RISE)         i = p / RISE;
      else if (p < FALL)    i = 1;
      else { var q = (p - FALL) / (1 - FALL); i = 1 - (q * q); }
      var outer = (14 * i).toFixed(2);
      var inner = (4 * i).toFixed(2);
      var a = (0.9 * i).toFixed(3);
      panel.style.boxShadow =
        '0 0 ' + inner + 'px rgba(255,255,255,' + a + '), ' +
        '0 0 ' + outer + 'px rgba(255,200,28,' + a + ')';
    }, 16);
  }

  // ---------------------------------------------------------------------------
  // Card controller.
  // ---------------------------------------------------------------------------
  function makeCard(container, spec) {
    container.innerHTML = '';
    container.classList.add('unix-lab');

    var input = spec.input || {};
    var output = spec.output || {};

    // Top: description (if any).
    if (spec.description) {
      var desc = document.createElement('div');
      desc.className = 'unix-lab__desc';
      desc.innerHTML = mdToHtml(spec.description);
      container.appendChild(desc);
    }

    // Prediction row (before any run) — if spec.predict is truthy.
    var predictWrap = null;
    var predictInput = null;
    var predictReadout = null;
    if (spec.predict) {
      predictWrap = document.createElement('div');
      predictWrap.className = 'unix-lab__predict';
      var plabel = document.createElement('label');
      plabel.className = 'unix-lab__predict-label';
      plabel.innerHTML = mdInline(spec.predictPrompt || 'Predict what will appear on stdout:');
      predictInput = document.createElement('textarea');
      predictInput.className = 'unix-lab__predict-input';
      predictInput.rows = 2;
      predictInput.placeholder = 'Type your guess here, then run the command to compare…';
      plabel.htmlFor = 'unix-lab-predict-' + Math.random().toString(36).slice(2, 9);
      predictInput.id = plabel.htmlFor;
      predictWrap.appendChild(plabel);
      predictWrap.appendChild(predictInput);
      container.appendChild(predictWrap);
    }

    // Pipeline (inputs | button | outputs). `unix-lab__pipeline` is a 3-cell
    // grid that collapses to a vertical stack below ~720px.
    var pipeline = document.createElement('div');
    pipeline.className = 'unix-lab__pipeline';
    container.appendChild(pipeline);

    // Inputs column.
    var inCol = document.createElement('div');
    inCol.className = 'unix-lab__col unix-lab__col--in';
    pipeline.appendChild(inCol);

    if (input.env && input.env.length) inCol.appendChild(envInputPanel(input.env));
    var stdinP = stdinPanel(input.stdin);
    if (stdinP) inCol.appendChild(stdinP);
    if (input.files) {
      input.files.forEach(function (f) { inCol.appendChild(fileInputPanel(f)); });
    }
    if (!inCol.children.length) {
      // Still render a tiny placeholder so the pipeline stays visually balanced;
      // but mark it as a "no inputs" note.
      var none = document.createElement('div');
      none.className = 'unix-lab__no-inputs';
      none.textContent = 'no inputs (command reads nothing)';
      inCol.appendChild(none);
    }

    // Middle column: arrow + button + arrow.
    var midCol = document.createElement('div');
    midCol.className = 'unix-lab__col unix-lab__col--mid';
    pipeline.appendChild(midCol);

    var arrowIn = document.createElement('div');
    arrowIn.className = 'unix-lab__arrow unix-lab__arrow--in';
    arrowIn.innerHTML = '<span aria-hidden="true">\u25B6</span>';  // ▶
    midCol.appendChild(arrowIn);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'unix-lab__btn';
    var btnIcon = document.createElement('span');
    btnIcon.className = 'unix-lab__btn-icon';
    btnIcon.setAttribute('aria-hidden', 'true');
    btnIcon.textContent = '\u25B6';
    var btnCmd = document.createElement('code');
    btnCmd.className = 'unix-lab__btn-cmd';
    btnCmd.textContent = spec.command;
    btn.appendChild(btnIcon);
    btn.appendChild(btnCmd);
    midCol.appendChild(btn);

    var arrowOut = document.createElement('div');
    arrowOut.className = 'unix-lab__arrow unix-lab__arrow--out';
    arrowOut.innerHTML = '<span aria-hidden="true">\u25B6</span>';
    midCol.appendChild(arrowOut);

    // Outputs column. Before run: placeholder. After run: populated panels.
    var outCol = document.createElement('div');
    outCol.className = 'unix-lab__col unix-lab__col--out';
    pipeline.appendChild(outCol);

    var placeholder = document.createElement('div');
    placeholder.className = 'unix-lab__placeholder';
    placeholder.textContent = spec.predict
      ? 'Write your prediction above, then press Run to reveal the output.'
      : 'Press Run to see what the command produces.';
    outCol.appendChild(placeholder);

    // Notice (revealed after run, below pipeline).
    var notice = null;
    if (spec.notice) {
      notice = document.createElement('div');
      notice.className = 'unix-lab__notice';
      notice.innerHTML = '<strong>Notice:</strong> ' + mdToHtml(spec.notice).replace(/^<p>|<\/p>$/g, '');
      notice.style.display = 'none';
      container.appendChild(notice);
    }

    var revealed = false;

    function populateOutputs() {
      outCol.innerHTML = '';

      // If there was a prediction, show it as a muted read-only line at the
      // top of outputs so the student self-compares (research: generating a
      // guess + comparing beats re-reading the answer). If the prediction
      // matches stdout exactly (after whitespace normalisation), attach a
      // celebratory thumbs-up badge — positive reinforcement without
      // punishing misses (no red X on wrong answers, per the user's call).
      if (predictInput) {
        var user = predictInput.value.trim();
        if (user.length) {
          var pShow = document.createElement('div');
          pShow.className = 'unix-lab__prediction-show';
          pShow.innerHTML = '<span class="unix-lab__prediction-label">Your prediction</span>' +
            '<pre>' + escapeHtml(user) + '</pre>';

          // What does "matching" mean? If the command printed to stdout the
          // student is predicting stdout. If stdout is empty but the command
          // wrote to exactly one file (typical `cmd > out.txt` pattern), the
          // student is predicting the file content — the prompt usually says
          // so explicitly ("What will X contain?").
          var normUser = normalizeForCompare(user);
          var matchTarget = null;                       // 'stdout' | file name
          if ((output.stdout || '') !== '' &&
              normUser === normalizeForCompare(output.stdout)) {
            matchTarget = 'stdout';
          } else if ((!output.stdout || output.stdout === '') &&
                     output.files && output.files.length === 1 &&
                     normUser === normalizeForCompare(output.files[0].content)) {
            matchTarget = output.files[0].name;
          }
          if (matchTarget) {
            pShow.classList.add('unix-lab__prediction-show--match');
            var match = document.createElement('div');
            match.className = 'unix-lab__prediction-match';
            match.innerHTML = '<span class="unix-lab__thumb" aria-hidden="true">\uD83D\uDC4D</span>' +
              '<span class="unix-lab__match-label">Nailed it — your prediction matches ' +
              escapeHtml(matchTarget) + '</span>';
            pShow.appendChild(match);
          }

          outCol.appendChild(pShow);
        }
      }

      var bursts = [];

      var sOut = stdoutPanel(output.stdout);
      outCol.appendChild(sOut);

      var sErr = stderrPanel(output.stderr);
      if (sErr) { outCol.appendChild(sErr); bursts.push(sErr); }

      if (output.files && output.files.length) {
        output.files.forEach(function (f) {
          var fp = fileOutputPanel(f);
          outCol.appendChild(fp);
          bursts.push(fp);
        });
      }

      if (output.env && output.env.length) {
        var envP = envOutputPanel(output.env);
        if (envP) { outCol.appendChild(envP); bursts.push(envP); }
      }

      outCol.appendChild(exitBadge(output.exit));

      if (notice) notice.style.display = '';

      // Burst only on "change"-y panels (stderr, modified files, env). Keeping
      // stdout un-bursted reflects that stdout is the *expected* channel;
      // stderr / file side effects are the pedagogically surprising channels.
      setTimeout(function () { bursts.forEach(burstPanel); }, 60);
    }

    function clearOutputs() {
      outCol.innerHTML = '';
      outCol.appendChild(placeholder);
      if (notice) notice.style.display = 'none';
    }

    function update() {
      if (revealed) {
        populateOutputs();
        btnIcon.textContent = '\u21BA';
        btnCmd.textContent = 'Reset';
        btn.classList.add('unix-lab__btn--reset');
        if (predictInput) predictInput.readOnly = true;
      } else {
        clearOutputs();
        btnIcon.textContent = '\u25B6';
        btnCmd.textContent = spec.command;
        btn.classList.remove('unix-lab__btn--reset');
        if (predictInput) predictInput.readOnly = false;
      }
    }

    btn.addEventListener('click', function () {
      revealed = !revealed;
      update();
    });

    update();

    var controller = {
      button: btn,
      reset: function () { revealed = false; update(); },
      reveal: function () { revealed = true; update(); },
    };
    container._unixLab = controller;
    return controller;
  }

  // ---------------------------------------------------------------------------
  function readSpec(el, attr) {
    var raw = el.getAttribute(attr);
    if (raw && raw.trim() && raw.trim()[0] === '{') return JSON.parse(raw);
    var script = el.querySelector('script[type="application/json"]');
    if (script) return JSON.parse(script.textContent);
    throw new Error('No spec JSON for ' + attr + ' element');
  }

  function initFrom(root) {
    var nodes = (root || document).querySelectorAll('[data-unix-command-lab]');
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.getAttribute('data-unix-lab-init')) return;
      el.setAttribute('data-unix-lab-init', '1');
      try {
        makeCard(el, readSpec(el, 'data-unix-command-lab'));
      } catch (e) {
        console.error('UnixCommandLab init failed:', e, el);
      }
    });
  }

  if (typeof window !== 'undefined') {
    // Reset all cards for print so all content is in their "revealed" state
    // uniformly (the teacher handing out printouts gets the full picture).
    window.addEventListener('beforeprint', function () {
      document.querySelectorAll('.unix-lab').forEach(function (el) {
        if (el._unixLab && el._unixLab.reveal) el._unixLab.reveal();
      });
    });
  }

  window.UnixCommandLab = {
    create: makeCard,
    initFrom: initFrom,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initFrom(document); });
  } else {
    initFrom(document);
  }
})();
