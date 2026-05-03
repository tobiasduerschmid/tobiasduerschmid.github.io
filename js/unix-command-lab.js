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
  // Amber reveal burst — CSS-driven (see `.unix-lab__burst` in the
  // stylesheet). The animation starts frame-perfect with no JS setInterval
  // lag, and the box-shadow values are hard-coded in the @keyframes so
  // they can't blend to grey at intermediate alphas. Re-triggering the
  // animation on subsequent clicks requires a class-clear + forced-reflow
  // dance; the `animationend` cleanup keeps the class list tidy.
  // Test once on load whether the user prefers reduced motion, and keep
  // the result live so preference changes take effect without a reload.
  // Used as a hard gate on ALL lab animations (bursts, confetti, …) so
  // even if CSS specificity somehow let a keyframe through, the JS never
  // triggers it in the first place.
  // Delegates to the site-wide helper installed in head.html, which
  // already honours the OS-level `prefers-reduced-motion` media query
  // AND the `?reduce-motion=1` URL override AND stamps the
  // `html.prm-reduce` class. Falls back to a local matchMedia check if
  // the helper somehow isn't present (e.g. a test harness).
  function prefersReducedMotion() {
    if (typeof window.__prefersReducedMotion === 'function') {
      return window.__prefersReducedMotion();
    }
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function burstPanel(panel) {
    if (!panel) return;
    if (prefersReducedMotion()) return;
    panel.classList.remove('unix-lab__burst');
    void panel.offsetWidth;  // force layout flush so the animation re-fires
    panel.classList.add('unix-lab__burst');
    var onEnd = function () {
      panel.classList.remove('unix-lab__burst');
      panel.removeEventListener('animationend', onEnd);
    };
    panel.addEventListener('animationend', onEnd);
  }

  // Confetti spray on a correct prediction. ~36 small rotating coloured
  // rectangles spawn on random points along the prediction panel's
  // *perimeter* (not its centre) and fly outward along the edge's normal
  // with tangential jitter — so the whole panel appears to burst open
  // around its rim. Pure CSS motion; this function just positions each
  // piece and stamps its target as `--tx` / `--ty` / `--rot`.
  function spawnConfetti(anchor) {
    if (!anchor || !anchor.getBoundingClientRect) return;
    if (prefersReducedMotion()) return;  // skip entirely under reduce-motion
    var rect = anchor.getBoundingClientRect();
    var host = document.createElement('div');
    host.className = 'unix-lab__confetti';
    host.style.left = rect.left + 'px';
    host.style.top = rect.top + 'px';
    host.style.width = rect.width + 'px';
    host.style.height = rect.height + 'px';

    var colors = ['#ff5252', '#ffeb3b', '#4ade80', '#4a9fd9', '#e0b24e', '#f1948a', '#b18ef0', '#ffffff'];
    // Mixed shape palette: strips (tall narrow), squares, and rounds.
    // Strips are weighted higher because real confetti is mostly strips.
    var shapes = ['strip', 'strip', 'strip', 'square', 'round'];
    var count = 36;
    var perimeter = 2 * (rect.width + rect.height);
    for (var i = 0; i < count; i++) {
      var piece = document.createElement('div');
      piece.className = 'unix-lab__confetti-piece';

      // Pick a position along the perimeter (uniform). Then figure out the
      // starting (x, y) on the border and the outward normal direction.
      var pos = Math.random() * perimeter;
      var x, y, nx, ny;
      if (pos < rect.width)                            { x = pos;                                y = 0;               nx = 0;  ny = -1; }
      else if (pos < rect.width + rect.height)         { x = rect.width;                         y = pos - rect.width; nx = 1;  ny = 0;  }
      else if (pos < 2 * rect.width + rect.height)     { x = rect.width - (pos - rect.width - rect.height); y = rect.height; nx = 0; ny = 1; }
      else                                             { x = 0;                                  y = rect.height - (pos - 2 * rect.width - rect.height); nx = -1; ny = 0; }

      piece.style.left = x + 'px';
      piece.style.top  = y + 'px';

      // Shape variety — strips, squares, rounds. Randomise size inside
      // each category so even same-shape pieces differ a bit.
      var shape = shapes[Math.floor(Math.random() * shapes.length)];
      var w, h, br;
      if (shape === 'strip')      { w = 4 + Math.random() * 3; h = 10 + Math.random() * 8;  br = 1; }
      else if (shape === 'square'){ w = 8 + Math.random() * 4; h = 8 + Math.random() * 4;   br = 2; }
      else                        { w = 7 + Math.random() * 5; h = w;                        br = 999; }
      piece.style.width = w.toFixed(1) + 'px';
      piece.style.height = h.toFixed(1) + 'px';
      piece.style.marginLeft = (-w / 2).toFixed(1) + 'px';
      piece.style.marginTop  = (-h / 2).toFixed(1) + 'px';
      piece.style.borderRadius = br + 'px';

      // Fly outward along the normal with some tangential scatter.
      var distance = 60 + Math.random() * 90;
      var tangential = (Math.random() - 0.5) * 80;
      var tx = nx * distance + (nx === 0 ? tangential : 0);
      var ty = ny * distance + (ny === 0 ? tangential : 0);
      var rot = Math.random() * 720 - 360;
      var drift = (Math.random() - 0.5) * 60;   // Final lateral drift
      piece.style.setProperty('--tx', tx.toFixed(1) + 'px');
      piece.style.setProperty('--ty', ty.toFixed(1) + 'px');
      piece.style.setProperty('--rot', rot.toFixed(0) + 'deg');
      piece.style.setProperty('--drift', drift.toFixed(1) + 'px');
      piece.style.backgroundColor = colors[i % colors.length];
      piece.style.animationDelay = (Math.random() * 70) + 'ms';
      // Slight duration variance so the fall de-syncs.
      piece.style.animationDuration = (1500 + Math.random() * 400) + 'ms';
      host.appendChild(piece);
    }
    document.body.appendChild(host);
    setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 1700);
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
    btn.setAttribute('aria-pressed', 'false');
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
    outCol.setAttribute('role', 'status');
    outCol.setAttribute('aria-live', 'polite');
    outCol.setAttribute('aria-atomic', 'false');
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
          //
          // Additional fallback for "expected outcome is empty" cases (most
          // notably the `sort data.txt > data.txt` clobber card): if the
          // actual result is an empty string and the student's prose answer
          // mentions the words "nothing" or "empty" (a perfectly valid way
          // to describe the outcome), accept that as a match too. This
          // rewards students who understood the destructive-open-before-run
          // behaviour even if they didn't literally type an empty string.
          var normUser = normalizeForCompare(user);
          var matchTarget = null;                       // 'stdout' | file name
          var mentionsEmpty = /\b(nothing|empty)\b/i.test(user);
          var singleFile = output.files && output.files.length === 1 ? output.files[0] : null;
          if ((output.stdout || '') !== '' &&
              normUser === normalizeForCompare(output.stdout)) {
            matchTarget = 'stdout';
          } else if ((!output.stdout || output.stdout === '') &&
                     singleFile &&
                     normUser === normalizeForCompare(singleFile.content)) {
            matchTarget = singleFile.name;
          } else if (mentionsEmpty &&
                     (!output.stdout || output.stdout === '') &&
                     singleFile &&
                     (singleFile.content === '' || singleFile.content == null)) {
            matchTarget = singleFile.name + ' (empty)';
          } else if (mentionsEmpty &&
                     (output.stdout === '' || output.stdout === null || output.stdout === undefined) &&
                     !singleFile) {
            matchTarget = 'stdout (empty)';
          }
          if (matchTarget) {
            pShow.classList.add('unix-lab__prediction-show--match');
            var match = document.createElement('div');
            match.className = 'unix-lab__prediction-match';
            match.setAttribute('role', 'status');
            match.setAttribute('aria-live', 'polite');
            match.innerHTML = '<span class="unix-lab__thumb" aria-hidden="true">\uD83D\uDC4D</span>' +
              '<span class="unix-lab__match-label">Nailed it — your prediction matches ' +
              escapeHtml(matchTarget) + '</span>';
            pShow.appendChild(match);
            // Confetti celebration! Fire once the panel is in the DOM so
            // getBoundingClientRect returns its actual position.
            setTimeout(function () { spawnConfetti(pShow); }, 0);
          }

          outCol.appendChild(pShow);
        }
      }

      // Every revealed panel gets the yellow glow burst — the visual punch
      // of a reveal is the point of the card, and the burst is the cue that
      // says "look here, something just appeared". Earlier we only bursted
      // stderr/files/env, but the inconsistency was more distracting than
      // useful: some cards popped, others felt flat. Now: the prediction
      // panel, stdout, stderr, modified files, env changes, and the
      // exit-code badge all burst. (The green match-flash on a correct
      // prediction still plays on the background; the burst just adds the
      // yellow pop around the panel.)
      var bursts = [];
      var predictionPanel = outCol.querySelector('.unix-lab__prediction-show');
      if (predictionPanel) bursts.push(predictionPanel);

      var sOut = stdoutPanel(output.stdout);
      outCol.appendChild(sOut);
      bursts.push(sOut);

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

      var badge = exitBadge(output.exit);
      outCol.appendChild(badge);
      bursts.push(badge);

      if (notice) notice.style.display = '';

      // Burst synchronously so the glow paints in the *same* frame as the
      // panels themselves — no ramp-up delay, no rAF lag. burstPanel()'s
      // first draw() call paints at full intensity; the setInterval that
      // follows handles the decay over the next ~900ms.
      bursts.forEach(burstPanel);
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
        btn.setAttribute('aria-pressed', 'true');
        if (predictInput) predictInput.readOnly = true;
      } else {
        clearOutputs();
        btnIcon.textContent = '\u25B6';
        btnCmd.textContent = spec.command;
        btn.classList.remove('unix-lab__btn--reset');
        btn.setAttribute('aria-pressed', 'false');
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
      // Print-only state: reveal outputs (so the printout is useful) but
      // keep the button showing the original command rather than "Reset".
      // The "Reset" label is meaningless on paper and hides information the
      // reader of a printed page actually wants — which command produced
      // this output.
      printReveal: function () {
        if (!revealed) { revealed = true; populateOutputs(); if (predictInput) predictInput.readOnly = true; }
        btnIcon.textContent = '\u25B6';
        btnCmd.textContent = spec.command;
        btn.classList.remove('unix-lab__btn--reset');
      },
      // Restore the normal revealed/unrevealed look after printing finishes.
      exitPrintMode: function () { update(); },
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
    // Print layout: reveal every card's outputs (so printouts show the full
    // picture) AND swap the button back from "Reset" to the original command
    // (the label "Reset" is meaningless on paper and hides useful info).
    window.addEventListener('beforeprint', function () {
      document.querySelectorAll('.unix-lab').forEach(function (el) {
        if (el._unixLab && el._unixLab.printReveal) el._unixLab.printReveal();
      });
    });
    window.addEventListener('afterprint', function () {
      document.querySelectorAll('.unix-lab').forEach(function (el) {
        if (el._unixLab && el._unixLab.exitPrintMode) el._unixLab.exitPrintMode();
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
