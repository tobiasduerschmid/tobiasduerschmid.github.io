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
    return GitGraph.parseGitState(s.log, s.branches, s.head, filesOverride !== undefined ? filesOverride : s.files);
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
    // Split on blank lines to paragraphs, but DON'T escape HTML because
    // descriptions may intentionally include tags. Authors who want literal
    // angle brackets can use HTML entities themselves.
    var paragraphs = md.split(/\n\s*\n/);
    return paragraphs.map(function (para) {
      var html = para
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      return '<p>' + html + '</p>';
    }).join('');
  }

  function makeCard(container, spec) {
    container.innerHTML = '';
    container.classList.add('git-command-lab');

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
    graphs.appendChild(graphHost);

    var afterHost = document.createElement('div');
    afterHost.className = 'git-command-lab__graph-after';
    afterHost.setAttribute('data-state-label', 'After');
    var afterState = buildState(spec.after);
    afterHost.innerHTML = GitGraph.renderWorkbench(afterState) + GitGraph.renderToSVG(afterState);
    graphs.appendChild(afterHost);

    var beforeData = buildState(spec.before);
    var afterData  = buildState(spec.after);

    var graph = new GitGraph(graphHost);
    graph.render(beforeData);

    var applied = false;
    function update() {
      if (applied) {
        graph.render(buildState(spec.after));
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
      } else {
        graph.render(buildState(spec.before));
        icon.textContent = '\u25B6';
        cmdEl.textContent = spec.command;
        btn.classList.remove('git-command-lab__btn--undo');
      }
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

    var modal = document.createElement('div');
    modal.className = 'git-command-lab-modal';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'git-command-lab-modal__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    modal.appendChild(closeBtn);

    var cardHost = document.createElement('div');
    modal.appendChild(cardHost);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKey);

    function tryRender() {
      if (!window.GitGraph) { setTimeout(tryRender, 30); return; }
      makeCard(cardHost, spec);
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
    backBtn.setAttribute('aria-label', 'Previous step');
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
    action.appendChild(graphHost);

    var graph = new GitGraph(graphHost);

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

    addPrintStep('Initial state', buildState(spec.initialState, effectiveFiles[0]), effectiveDescs[0], true);
    for (var si = 0; si < steps.length; si++) {
      addPrintStep(steps[si].command, buildState(steps[si].state, effectiveFiles[si + 1]), effectiveDescs[si + 1], false);
    }

    // ----- State update -----
    function update() {
      var isInitial = (stepIdx === -1);
      var isLast    = (stepIdx === steps.length - 1);

      // Description is the pre-computed "effective" value for this state —
      // the inherit-last-description behaviour lives in effectiveDescs so
      // Back and Forward stay consistent.
      descEl.innerHTML = mdToHtml(effectiveDescs[stepIdx + 1]);

      progressEl.textContent =
        'Step\u00A0' + (isInitial ? 0 : stepIdx + 1) + '\u00A0of\u00A0' + steps.length;

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

      var filesForStep = effectiveFiles[stepIdx + 1];
      var st = isInitial
        ? buildState(spec.initialState, filesForStep)
        : buildState(steps[stepIdx].state, filesForStep);
      graph.render(st);
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
