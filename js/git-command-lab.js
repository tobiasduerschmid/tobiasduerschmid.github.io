/**
 * GitCommandLab — interactive before/after demo cards for git commands.
 *
 * Each card renders a GitGraph in a "before" state and a button labelled
 * with the git command. Clicking the button animates to the "after" state
 * and the button becomes "Undo". Clicking again animates back.
 *
 * Built on top of GitGraph (js/git-graph.js).
 *
 * Usage — inline in a page:
 *   <div data-git-command-lab>
 *     <script type="application/json">
 *       {
 *         "command": "git commit -m \"...\"",
 *         "description": "optional caption",
 *         "before": { "log": "...", "branches": "...", "head": "..." },
 *         "after":  { "log": "...", "branches": "...", "head": "..." }
 *       }
 *     </script>
 *   </div>
 *   <script>GitCommandLab.initFrom(document);</script>
 *
 * Usage — popup/modal (e.g. from the git tutorial):
 *   GitCommandLab.openModal({ command, description, before, after });
 */
(function () {
  'use strict';

  function buildState(s, filesOverride) {
    var state = GitGraph.parseGitState(s.log, s.branches, s.head, filesOverride !== undefined ? filesOverride : s.files);
    if (s.labelColors) state.labelColors = s.labelColors;
    if (s.highlights && state.commitMap) {
      var textures = { hatched: 1, crosshatch: 1, dotted: 1, grid: 1, striped: 1 };
      for (var hash in s.highlights) {
        if (!s.highlights.hasOwnProperty(hash)) continue;
        var cm = state.commitMap[hash];
        if (!cm) continue;
        var val = s.highlights[hash];
        var col, sec;
        if (val && typeof val === 'object') {
          col = val.color || null;
          sec = val.secondary || null;
          if (val.texture) cm.texture = val.texture;
        } else {
          var parts = String(val).trim().split(/\s+/);
          col = parts[0];
          if (parts[1] && textures[parts[1]]) cm.texture = parts[1];
        }
        function normalizeColor(c) {
          if (!c) return null;
          // Named colors arrive as `#lightblue` — strip `#` so SVG fill is valid CSS.
          return (c.charAt(0) === '#' && !/^#[0-9a-fA-F]{3,8}$/.test(c)) ? c.slice(1) : c;
        }
        if (col && !textures[col]) cm.highlight = normalizeColor(col);
        else if (col && textures[col]) cm.texture = col;
        if (sec) cm.highlightSecondary = normalizeColor(sec);
      }
    }
    return state;
  }

  // Minimal markdown → HTML for lab-card descriptions. Supports **bold**,
  // *italic*, `code`, and blank-line paragraph breaks. Single newlines inside
  // a paragraph collapse to a space (standard markdown behaviour).
  function mdToHtml(md) {
    var safe = String(md)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // Inline formatting — apply `code` first so ** and * inside a code span
    // are left alone.
    safe = safe
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s.,;:)!?]|$)/g, '$1<em>$2</em>');
    return safe
      .split(/\n\s*\n/)
      .map(function (p) { return '<p>' + p.replace(/\n/g, ' ').trim() + '</p>'; })
      .join('');
  }

  // Minimal markdown → HTML converter for card descriptions. Supports
  //   **bold**, *italic*, `code`, and paragraph breaks (blank line).
  // Existing HTML tags are preserved so authors can mix markdown with
  // inline HTML when they need to. Not user-supplied content.
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function mdToHtml(md) {
    if (!md) return '';
    // Extract fenced ```code blocks``` first so their contents are not
    // re-processed by the inline rules below. Each block is replaced by a
    // placeholder token that we swap back in after paragraph splitting.
    var codeBlocks = [];
    md = md.replace(/```(?:[a-zA-Z0-9_-]*)?\n?([\s\S]*?)```/g, function (_, body) {
      var esc = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      codeBlocks.push('<pre class="git-command-lab__code"><code>' + esc.replace(/\n$/, '') + '</code></pre>');
      return '\u0000CODEBLOCK' + (codeBlocks.length - 1) + '\u0000';
    });
    // Split on blank lines to paragraphs, but DON'T escape HTML because
    // descriptions may intentionally include tags. Authors who want literal
    // angle brackets can use HTML entities themselves.
    var paragraphs = md.split(/\n\s*\n/);
    var out = paragraphs.map(function (para) {
      var m = para.match(/^\u0000CODEBLOCK(\d+)\u0000$/);
      if (m) return codeBlocks[+m[1]];
      var html = para
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      return '<p>' + html + '</p>';
    }).join('');
    return out;
  }

  function makeScrollableRegionKeyboardReachable(el) {
    if (!el || el.hasAttribute('tabindex')) return;
    el.setAttribute('tabindex', '0');
  }

  function makeCard(container, spec) {
    container.innerHTML = '';
    container.classList.add('git-command-lab');
    // Card is a labeled group, not an image. role="group" lets AT users
    // navigate it as a unit while keeping its descendants (button,
    // status, details) accessible — which is what we want, since the
    // SVG graph is purely visual and the canonical text alternative
    // lives in the sr-only status + details below.
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', 'Git command demo: ' + spec.command);

    // Two-column layout: caption (description + optional rebase-file) on the
    // left, action column (button + graph) on the right. The button lives
    // with the graph so they're always adjacent — even when the row wraps to
    // a single column on narrow screens, the vertical order reads:
    // description → rebase-file → button → graph.
    var row = document.createElement('div');
    row.className = 'git-command-lab__row';
    container.appendChild(row);

    var caption = document.createElement('div');
    caption.className = 'git-command-lab__caption';

    if (spec.description) {
      var desc = document.createElement('div');
      desc.className = 'git-command-lab__desc';
      // Descriptions are authored markdown — we render a small subset
      // (**bold**, *italic*, `code`, and paragraph breaks from blank lines).
      desc.innerHTML = mdToHtml(spec.description);
      caption.appendChild(desc);
    }

    if (spec.rebaseFile) {
      var file = document.createElement('pre');
      file.className = 'git-command-lab__rebase-file';
      var fileHeader = document.createElement('div');
      fileHeader.className = 'git-command-lab__rebase-file-header';
      fileHeader.textContent = '~/.git/rebase-merge/git-rebase-todo';
      var fileBody = document.createElement('code');
      fileBody.textContent = spec.rebaseFile;
      file.appendChild(fileHeader);
      file.appendChild(fileBody);
      caption.appendChild(file);
    }

    // Only attach the caption column if there's something to show in it.
    if (caption.children.length) row.appendChild(caption);

    var action = document.createElement('div');
    action.className = 'git-command-lab__action';
    row.appendChild(action);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'git-command-lab__btn';
    btn.setAttribute('aria-pressed', 'false');
    var icon = document.createElement('span');
    icon.className = 'git-command-lab__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '\u25B6';
    var cmdEl = document.createElement('code');
    cmdEl.className = 'git-command-lab__cmd';
    cmdEl.textContent = spec.command;
    btn.appendChild(icon);
    btn.appendChild(cmdEl);
    action.appendChild(btn);

    // Pair of graph slots: the interactive one shows "before" initially and
    // animates to "after" when the button is clicked; the second one is a
    // static render of the "after" state that is hidden on screen but
    // revealed in print media (so printouts show before + after side by side).
    var graphs = document.createElement('div');
    graphs.className = 'git-command-lab__graphs';
    action.appendChild(graphs);

    var graphHost = document.createElement('div');
    graphHost.className = 'git-command-lab__graph';
    graphHost.setAttribute('data-state-label', 'Before');
    // GitGraph's live-a11y mode (see _liveA11y in js/git-graph.js) computes
    // a structural diff between consecutive states and announces it on a
    // polite sr-only live region inside the host ("commit X added", "HEAD
    // moved to Y", "branch Z deleted"). We keep that on — it's a much
    // better delta narration than anything we'd hand-write on click.
    graphHost.setAttribute('data-git-graph-live', 'true');
    graphHost.setAttribute('data-git-graph-label', 'Git command animation: ' + spec.command);
    graphs.appendChild(graphHost);

    var afterHost = document.createElement('div');
    afterHost.className = 'git-command-lab__graph-after';
    afterHost.setAttribute('data-state-label', 'After');
    afterHost.setAttribute('aria-hidden', 'true');
    var afterState = buildState(spec.after);
    afterHost.innerHTML = GitGraph.renderWorkbench(afterState) + GitGraph.renderToSVG(afterState);
    graphs.appendChild(afterHost);

    var beforeData = buildState(spec.before);
    var afterData  = buildState(spec.after);

    var graph = new GitGraph(graphHost);
    // Pre-reserve max left padding + max workbench height across the
    // lab's two states, so the first click never shifts node `cx`
    // horizontally (HEAD re-attaching to a longer-named branch) and
    // never grows the workbench's min-height pin (a new zone acquiring
    // rows). See GitGraph.prototype.reserveForStates.
    graph.reserveForStates([beforeData, afterData]);
    graph.render(beforeData);

    // Sighted-affordance details element. GitGraph's _liveA11y mode
    // (enabled via data-git-graph-live above) already maintains an
    // sr-only status region inside graphHost that announces deltas
    // ("commit X added", "HEAD moved to Y") on every render — that's
    // the canonical AT channel and a much better delta narrator than
    // anything we'd hand-write here. This <details> element duplicates
    // the verbose breakdown *visibly* so a low-vision-but-not-AT user
    // (or anyone curious) can drill in by clicking the disclosure. We
    // intentionally do NOT wire another aria-live region: stacking
    // polite announcements on top of GitGraph's would cross-talk.
    var detailsEl = document.createElement('details');
    detailsEl.className = 'git-command-lab__details';
    var detailsSummary = document.createElement('summary');
    detailsSummary.textContent = 'Full graph details (text)';
    detailsEl.appendChild(detailsSummary);
    var detailsBody = document.createElement('div');
    detailsBody.className = 'git-command-lab__details-body';
    detailsEl.appendChild(detailsBody);
    container.appendChild(detailsEl);

    function refreshDetails(data) {
      var a11y = (typeof GitGraph.describeData === 'function')
        ? (GitGraph.describeData(data) || {}) : {};
      // Include every text-alternative GitGraph builds for the current
      // state so the visible <details> element is a complete mirror of
      // what _liveA11y mode writes to its sr-only summary / details /
      // status nodes inside graphHost. Order: short overview at the top
      // (so a low-vision user reading top-to-bottom sees the headline
      // first), then the long structural breakdown. Empty fields are
      // omitted to avoid rendering blank lines.
      var lines = [];
      if (a11y.overview)    lines.push(a11y.overview);
      if (a11y.description && a11y.description !== a11y.overview) {
        lines.push(a11y.description);
      }
      if (a11y.details) lines.push(a11y.details);
      detailsBody.textContent = lines.join('\n\n');
    }
    refreshDetails(beforeData);

    var applied = false;
    function update() {
      var stateData;
      if (applied) {
        stateData = buildState(spec.after);
        graph.render(stateData);
        // When a spec declares `undoCommand`, show that as the button label
        // (an actual git command that reverses the demo — e.g. `git restore
        // --staged foo` for `git add foo`). Without it, fall back to the
        // generic "Undo <cmd>" label for reversible demos.
        if (spec.undoCommand) {
          icon.textContent = '\u25B6';
          cmdEl.textContent = spec.undoCommand;
        } else {
          icon.textContent = '\u21BA';
          cmdEl.textContent = 'Undo ' + spec.command;
        }
        btn.classList.add('git-command-lab__btn--undo');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        stateData = buildState(spec.before);
        graph.render(stateData);
        icon.textContent = '\u25B6';
        cmdEl.textContent = spec.command;
        btn.classList.remove('git-command-lab__btn--undo');
        btn.setAttribute('aria-pressed', 'false');
      }
      refreshDetails(stateData);
    }

    btn.addEventListener('click', function () {
      applied = !applied;
      update();
    });

    var controller = {
      graph: graph,
      button: btn,
      reset: function () { applied = false; update(); },
    };
    // Expose for the beforeprint hook so every card can be reset to its
    // "before" state before printing — otherwise cards the user has clicked
    // would print the "after" state where we want the "Before" panel.
    container._gcl = controller;
    return controller;
  }

  // Reset any cards that have been toggled so the printout's "Before" column
  // actually shows the before state.
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeprint', function () {
      document.querySelectorAll('.git-command-lab').forEach(function (el) {
        if (el._gcl && el._gcl.reset) el._gcl.reset();
      });
    });
  }

  function readSpec(el) {
    var attr = el.getAttribute('data-git-command-lab');
    if (attr && attr.trim() && attr.trim()[0] === '{') return JSON.parse(attr);
    var script = el.querySelector('script[type="application/json"]');
    if (script) return JSON.parse(script.textContent);
    throw new Error('No spec JSON found for git-command-lab element');
  }

  function initFrom(root) {
    if (!window.GitGraph) {
      setTimeout(function () { initFrom(root); }, 30);
      return;
    }
    var nodes = (root || document).querySelectorAll('[data-git-command-lab]');
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.getAttribute('data-gcl-init')) return;
      el.setAttribute('data-gcl-init', '1');
      try {
        makeCard(el, readSpec(el));
      } catch (e) {
        console.error('GitCommandLab init failed:', e, el);
      }
    });
  }

  function openModal(spec) {
    var prev = document.getElementById('git-command-lab-modal');
    if (prev) prev.remove();

    var overlay = document.createElement('div');
    overlay.id = 'git-command-lab-modal';
    overlay.className = 'git-command-lab-modal-overlay';

    // Modal needs role="dialog" + aria-modal="true" so screen readers
    // announce it as a dialog and (in some browsers) restrict virtual-
    // cursor navigation to its descendants. The accessible name comes
    // from the rendered card's title via aria-labelledby once the card
    // is mounted; until then the close button's label suffices.
    var modal = document.createElement('div');
    modal.className = 'git-command-lab-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Git command demo: ' + (spec && spec.command || ''));
    modal.setAttribute('tabindex', '-1');

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'git-command-lab-modal__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    modal.appendChild(closeBtn);

    var cardHost = document.createElement('div');
    modal.appendChild(cardHost);
    overlay.appendChild(modal);

    // Save the previously-focused element so we can restore on close
    // (WCAG 2.4.3 Focus Order). Without this, AT users tab into the
    // void after closing.
    var prevFocus = (document.activeElement instanceof HTMLElement) ? document.activeElement : null;
    document.body.appendChild(overlay);

    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), details > summary';
    function getFocusable() {
      var nodes = modal.querySelectorAll(FOCUSABLE);
      var out = [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.getAttribute('aria-hidden') === 'true') continue;
        if (n.offsetParent === null && n.tagName !== 'SUMMARY') continue;
        out.push(n);
      }
      return out;
    }

    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      if (prevFocus && document.body.contains(prevFocus) && typeof prevFocus.focus === 'function') {
        try { prevFocus.focus(); } catch (_) { /* ignore */ }
      }
    }

    // Keyboard handlers: Escape closes (WCAG 2.1.2 — provides a way out
    // of the trap), Tab / Shift+Tab wraps focus inside the modal.
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var focusable = getFocusable();
      if (!focusable.length) { e.preventDefault(); modal.focus(); return; }
      var first = focusable[0], last = focusable[focusable.length - 1];
      var active = document.activeElement;
      if (e.shiftKey && (active === first || active === modal || !modal.contains(active))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus();
      }
    }

    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKey);

    function tryRender() {
      if (!window.GitGraph) { setTimeout(tryRender, 30); return; }
      makeCard(cardHost, spec);
      // Move focus into the modal once content is rendered. The lab
      // card's primary control is the command button; focus it so the
      // user can press Space/Enter immediately.
      setTimeout(function () {
        var btn = cardHost.querySelector('.git-command-lab__btn');
        if (btn) btn.focus(); else closeBtn.focus();
      }, 0);
    }
    tryRender();

    return { close: close };
  }

  // ---------------------------------------------------------------------------
  // Multi-step card — walks through a sequence of commands, each with its own
  // resulting graph state.  The button always shows the *next* command; after
  // the last step it becomes "↺ Restart".
  //
  // Spec format:
  //   {
  //     description:  "Optional intro shown before any steps.",
  //     initialState: { log, branches, head },
  //     steps: [
  //       { command, description?, state: { log, branches, head } },
  //       ...
  //     ]
  //   }
  //
  // Descriptions are optional per-step.  If a step has no description the
  // previous description stays visible (so you only need to write text when
  // something meaningful changes).
  // ---------------------------------------------------------------------------

  function makeMultiCard(container, spec) {
    container.innerHTML = '';
    container.classList.add('git-command-lab', 'git-command-lab--multi');

    var steps = spec.steps;
    var stepIdx = -1;           // -1 = initial state (before any command)

    // ----- Caption + action row (interactive) -----
    var row = document.createElement('div');
    row.className = 'git-command-lab__row';
    container.appendChild(row);

    var caption = document.createElement('div');
    caption.className = 'git-command-lab__caption';
    row.appendChild(caption);

    var descEl = document.createElement('div');
    descEl.className = 'git-command-lab__desc';
    caption.appendChild(descEl);

    var progressEl = document.createElement('div');
    progressEl.className = 'git-command-lab__step-progress';
    progressEl.setAttribute('role', 'status');
    progressEl.setAttribute('aria-live', 'polite');
    progressEl.setAttribute('aria-atomic', 'true');
    caption.appendChild(progressEl);

    var action = document.createElement('div');
    action.className = 'git-command-lab__action';
    row.appendChild(action);

    // Button group: Back button + Forward/Restart button, right-aligned.
    var btnGroup = document.createElement('div');
    btnGroup.className = 'git-command-lab__btn-group';
    action.appendChild(btnGroup);

    var backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'git-command-lab__btn-back';
    backBtn.setAttribute('aria-label', 'Back to previous step');
    var backIcon = document.createElement('span');
    backIcon.className = 'git-command-lab__icon';
    backIcon.setAttribute('aria-hidden', 'true');
    backIcon.textContent = '\u2190';   // ←
    var backLabel = document.createElement('span');
    backLabel.className = 'git-command-lab__btn-back-label';
    backLabel.textContent = 'Back';
    backBtn.appendChild(backIcon);
    backBtn.appendChild(backLabel);
    btnGroup.appendChild(backBtn);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'git-command-lab__btn';
    var icon = document.createElement('span');
    icon.className = 'git-command-lab__icon';
    icon.setAttribute('aria-hidden', 'true');
    var cmdEl = document.createElement('code');
    cmdEl.className = 'git-command-lab__cmd';
    btn.appendChild(icon);
    btn.appendChild(cmdEl);
    btnGroup.appendChild(btn);

    var graphHost = document.createElement('div');
    graphHost.className = 'git-command-lab__graph';
    // Same opt-in as the single-step card so each step's render fires a
    // delta announcement on the polite live region.
    graphHost.setAttribute('data-git-graph-live', 'true');
    graphHost.setAttribute('data-git-graph-label', 'Multi-step git command animation');
    action.appendChild(graphHost);

    var graph = new GitGraph(graphHost);
    // Same render() wrap as the single-step card.
    function refreshGraphAria(data) {
      try {
        if (typeof GitGraph.describeData !== 'function' || !data) return;
        var a11y = GitGraph.describeData(data) || {};
        var label = a11y.description || a11y.label;
        if (!label) return;
        graphHost.setAttribute('role', 'img');
        graphHost.setAttribute('aria-label', label);
        var svg = graphHost.querySelector('svg');
        if (svg) {
          svg.setAttribute('aria-label', label);
          svg.removeAttribute('aria-hidden');
          var titleEl = svg.querySelector(':scope > title');
          if (titleEl) titleEl.textContent = label;
        }
      } catch (_) { /* leave the bundle's label */ }
    }
    var origRender = graph.render.bind(graph);
    graph.render = function (data) {
      var result = origRender(data);
      refreshGraphAria(data);
      return result;
    };

    // ----- Command output panel (sits below the graph within the action column) -----
    var outputEl = document.createElement('pre');
    outputEl.className = 'git-command-lab__output';
    outputEl.hidden = true;
    action.appendChild(outputEl);

    // ----- Print section: all steps pre-rendered as static SVGs -----
    // Hidden on screen; revealed by @media print.  Each cell shows the
    // command label, the effective description, and a static SVG graph.
    var printSection = document.createElement('div');
    printSection.className = 'git-command-lab__print-steps';
    container.appendChild(printSection);

    // Pre-compute effective descriptions for each cell (inherit last value
    // when a step has no description of its own).
    var effectiveDescs = [];
    var runningDesc = spec.description || '';
    effectiveDescs.push(runningDesc);                // cell 0 = initial state
    for (var pi = 0; pi < steps.length; pi++) {
      if (steps[pi].description) runningDesc = steps[pi].description;
      effectiveDescs.push(runningDesc);
    }

    // Same inheritance for file-state specs. A step that omits `state.files`
    // re-uses the previous step's files. Absence across the whole spec means
    // no workbench on any step.
    var effectiveFiles = [];
    var runningFiles = spec.initialState && spec.initialState.files ? spec.initialState.files : null;
    effectiveFiles.push(runningFiles);
    for (var fi = 0; fi < steps.length; fi++) {
      if (steps[fi].state && steps[fi].state.files !== undefined) runningFiles = steps[fi].state.files;
      effectiveFiles.push(runningFiles);
    }

    function addPrintStep(label, stateData, descText, isInitial) {
      var stepEl = document.createElement('div');
      stepEl.className = 'git-command-lab__print-step';

      var labelEl = document.createElement('div');
      labelEl.className = 'git-command-lab__print-step-label' +
        (isInitial ? ' git-command-lab__print-step-label--initial' : '');
      if (isInitial) {
        labelEl.textContent = label;
      } else {
        var codeEl = document.createElement('code');
        codeEl.textContent = label;
        labelEl.appendChild(codeEl);
      }
      stepEl.appendChild(labelEl);

      if (descText) {
        var descDiv = document.createElement('div');
        descDiv.className = 'git-command-lab__print-step-desc';
        descDiv.innerHTML = mdToHtml(descText);
        stepEl.appendChild(descDiv);
      }

      var graphDiv = document.createElement('div');
      graphDiv.className = 'git-command-lab__graph-static';
      graphDiv.innerHTML = GitGraph.renderWorkbench(stateData) + GitGraph.renderToSVG(stateData);
      stepEl.appendChild(graphDiv);

      printSection.appendChild(stepEl);
    }

    // Pre-build every state the lab will transition through and reserve
    // the graph's layout dimensions for the union. This keeps the first
    // click from shifting node `cx` (when HEAD re-attaches to a
    // longer-named branch after `git switch -c` or a `git rebase -i`
    // drop) and from growing the workbench's min-height pin (when a
    // previously-empty zone acquires rows, e.g. the first `git add -A`
    // in a step sequence). Without this, later clicks read smooth
    // because the pins have reached their max — but the first click
    // doesn't.
    var allStates = [buildState(spec.initialState, effectiveFiles[0])];
    for (var as = 0; as < steps.length; as++) {
      allStates.push(buildState(steps[as].state, effectiveFiles[as + 1]));
    }
    graph.reserveForStates(allStates);

    addPrintStep('Initial state', allStates[0], effectiveDescs[0], true);
    for (var si = 0; si < steps.length; si++) {
      addPrintStep(steps[si].command, allStates[si + 1], effectiveDescs[si + 1], false);
    }

    // ----- State update -----
    function update() {
      var isInitial = (stepIdx === -1);
      var isLast    = (stepIdx === steps.length - 1);

      // Description is the pre-computed "effective" value for this state —
      // the inherit-last-description behaviour lives in effectiveDescs so
      // Back and Forward stay consistent.
      descEl.innerHTML = mdToHtml(effectiveDescs[stepIdx + 1]);

      var stepOutput = (stepIdx >= 0 && steps[stepIdx].output) ? steps[stepIdx].output : '';
      outputEl.textContent = stepOutput;
      outputEl.hidden = !stepOutput;

      // "Step X of N" plus, when we just moved forward into a step, the
      // command that was applied \u2014 so the polite announcement on click
      // tells a screen-reader user *what changed*. (GitGraph's own delta
      // announcer is already wired up via data-git-graph-live above.)
      var stepLabel = 'Step\u00A0' + (isInitial ? 0 : stepIdx + 1) + '\u00A0of\u00A0' + steps.length;
      progressEl.textContent = (isInitial || !steps[stepIdx])
        ? stepLabel + ' (initial state).'
        : stepLabel + ': applied ' + steps[stepIdx].command + '.';

      if (isLast) {
        icon.textContent = '\u21BA';  // ↺
        cmdEl.textContent = 'Restart';
        btn.classList.add('git-command-lab__btn--restart');
      } else {
        icon.textContent = '\u25B6';  // ▶
        cmdEl.textContent = steps[stepIdx + 1].command;
        btn.classList.remove('git-command-lab__btn--restart');
      }

      backBtn.disabled = isInitial;

      // Reuse the pre-built state from `allStates` so we don't rebuild
      // spec data on every click, and so the reservation pass and the
      // render pass see the exact same object graph.
      graph.render(allStates[stepIdx + 1]);
    }

    btn.addEventListener('click', function () {
      stepIdx = (stepIdx === steps.length - 1) ? -1 : stepIdx + 1;
      update();
    });

    backBtn.addEventListener('click', function () {
      if (stepIdx > -1) {
        stepIdx--;
        update();
      }
    });

    update();

    var controller = {
      graph: graph,
      button: btn,
      reset: function () { stepIdx = -1; update(); },
    };
    container._gcl = controller;
    return controller;
  }

  function initFromMulti(root) {
    if (!window.GitGraph) {
      setTimeout(function () { initFromMulti(root); }, 30);
      return;
    }
    var nodes = (root || document).querySelectorAll('[data-git-command-lab-multi]');
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.getAttribute('data-gcl-multi-init')) return;
      el.setAttribute('data-gcl-multi-init', '1');
      try {
        var attr = el.getAttribute('data-git-command-lab-multi');
        var spec = (attr && attr.trim() && attr.trim()[0] === '{')
          ? JSON.parse(attr)
          : JSON.parse(el.querySelector('script[type="application/json"]').textContent);
        makeMultiCard(el, spec);
      } catch (e) {
        console.error('GitCommandLab multi-step init failed:', e, el);
      }
    });
  }

  window.GitCommandLab = {
    create:          makeCard,
    initFrom:        initFrom,
    openModal:       openModal,
    createMulti:     makeMultiCard,
    initFromMulti:   initFromMulti,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initFrom(document);
      initFromMulti(document);
    });
  } else {
    initFrom(document);
    initFromMulti(document);
  }
})();
