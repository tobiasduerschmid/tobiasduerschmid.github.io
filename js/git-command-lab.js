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

  function buildState(s) {
    return GitGraph.parseGitState(s.log, s.branches, s.head);
  }

  function makeCard(container, spec) {
    container.innerHTML = '';
    container.classList.add('git-command-lab');

    var header = document.createElement('div');
    header.className = 'git-command-lab__header';

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
    header.appendChild(btn);
    container.appendChild(header);

    if (spec.description) {
      var desc = document.createElement('p');
      desc.className = 'git-command-lab__desc';
      desc.textContent = spec.description;
      container.appendChild(desc);
    }

    var graphHost = document.createElement('div');
    graphHost.className = 'git-command-lab__graph';
    container.appendChild(graphHost);

    var beforeData = buildState(spec.before);
    var afterData  = buildState(spec.after);

    var graph = new GitGraph(graphHost);
    graph.render(beforeData);

    var applied = false;
    function update() {
      if (applied) {
        graph.render(buildState(spec.after));
        icon.textContent = '\u21BA';
        cmdEl.textContent = 'Undo';
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

    return {
      graph: graph,
      button: btn,
      reset: function () { applied = false; update(); },
    };
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

  window.GitCommandLab = {
    create:    makeCard,
    initFrom:  initFrom,
    openModal: openModal,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initFrom(document); });
  } else {
    initFrom(document);
  }
})();
