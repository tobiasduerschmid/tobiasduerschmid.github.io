/* Each pose is a complete state, so seeking backwards never leaves stale artwork. */
(function () {
  'use strict';

  function text(root, selector, value) {
    root.querySelectorAll(selector).forEach((element) => {
      if (element.textContent !== String(value)) element.textContent = value;
    });
  }

  const poses = {
    declarative(root, pose, progress) {
      const travel = Math.min(1, progress * 4);
      root.style.setProperty('--travel', travel);
      text(root, '.ra-memory [data-value="likes"], .ra-travel-value', pose === 'change' ? 1 : 0);
      text(root, '.ra-browser [data-value="likes"]', pose === 'change' && travel === 1 ? 1 : 0);
    },
    jsx() {},
    props(root, pose) {
      root.querySelectorAll('.ra-prop-output').forEach((element, index) => {
        element.textContent = pose === 'parent' ? '?' : ['React', 'Node.js'][index];
      });
    },
    state() {},
    events(root, pose, progress) {
      const committed = pose === 'commit';
      const clicked = pose === 'click';
      const travel = Math.min(1, progress * 4);
      root.style.setProperty('--travel', travel);
      text(root, '.ra-snapshot-label', committed ? 'Next render' : 'Current render');
      text(root, '.ra-snapshot-count', committed ? 1 : 0);
      text(root, '.ra-request-label', clicked ? 'Queued request' : committed ? 'Request processed' : 'Handler ready');
      text(root, '.ra-request-value', clicked ? 'next likes = 1' : committed ? 'state = 1' : 'handleLike');
      text(root, '.ra-commit-label', committed ? 'Commit the new button text' : clicked ? 'The current snapshot stays 0' : 'onClick receives handleLike');
      text(root, '[data-value="likes"]', committed && travel === 1 ? 1 : 0);
      root.querySelector('.ra-pointer').hidden = !clicked;
      root.querySelectorAll('[data-phase]').forEach((phase) => {
        phase.classList.toggle('is-active', phase.dataset.phase === (committed ? (travel === 1 ? 'commit' : 'render') : 'event'));
      });
    },
    updates(root, pose) {
      const answer = pose !== 'question';
      const updater = pose === 'updater';
      const result = answer ? updater ? 2 : 1 : '?';
      text(root, '.ra-operation', answer ? updater ? 'n => n + 1' : 'replace with 1' : '?');
      root.querySelectorAll('.ra-queue-result').forEach((element, index) => {
        element.textContent = answer ? updater ? index + 1 : 1 : '?';
      });
      text(root, '.ra-trace-first', answer ? 1 : '?');
      text(root, '.ra-trace-last, .ra-next-count', result);
    },
    shared(root, pose) {
      text(root, '[data-value="likes"]', pose === 'together' ? 1 : 0);
    },
    lists(root, pose) {
      const list = root.querySelector('.ra-keyed-list');
      const first = list.querySelector('.ra-item-react');
      const distance = first.offsetHeight + parseFloat(getComputedStyle(list).rowGap);
      // React's default commit reorders instantly; crossing full-width rows
      // would obscure their labels and imply an animation React does not add.
      root.style.setProperty('--item-offset', `${pose === 'map' ? 0 : distance}px`);
      text(root, '.ra-list-action', pose === 'map' ? 'map: one element per course' : 'reorder: preserve item identity');
    },
    effects(root, pose) {
      text(root, '.ra-tab-title', pose === 'outside' ? 'Courses' : 'Likes: 1');
    },
  };

  window.ReactAnimationArt = {
    render(root, sceneId, cue, progress, animate) {
      root.dataset.currentPose = cue.pose;
      text(root, '.nja-step', cue.step);
      text(root, '.nja-note', cue.note);
      root.querySelectorAll('[data-pose]').forEach((part) => {
        part.hidden = !part.dataset.pose.split(' ').includes(cue.pose);
      });
      root.querySelectorAll('[data-code-variant]').forEach((part) => {
        part.hidden = part.dataset.codeVariant !== (cue.variant || 'main');
      });
      root.querySelectorAll('.nja-code-line').forEach((line) => {
        line.classList.toggle('is-highlighted', (cue.focus || []).includes(Number(line.dataset.line)));
      });
      poses[sceneId](root, cue.pose, animate ? progress : 1);
    },
  };
})();
