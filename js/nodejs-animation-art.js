/* Complete teaching states derived from narration time, including backward seeks. */
(function () {
  'use strict';

  function text(root, selector, value) {
    const node = root.querySelector(selector);
    if (node.textContent !== value) node.textContent = value;
  }

  function highlight(root, lines) {
    root.querySelectorAll('[data-line]').forEach((line) => {
      line.classList.toggle('is-highlighted', lines.includes(Number(line.dataset.line)));
    });
  }

  function poseIO(root, pose, progress, blocking) {
    const complete = ['complete', 'ready', 'run'].includes(pose);
    const reading = ['read', 'start', 'continue'].includes(pose);
    const readProgress = complete ? 1 : !reading ? 0 : blocking ? 0.1 + progress * 0.8
      : pose === 'continue' ? 0.45 + progress * 0.45 : 0.1 + progress * 0.35;
    root.style.setProperty('--read-progress', readProgress);
    root.querySelector('.nja-lock').hidden = !(blocking && reading);
    root.classList.toggle('is-blocked', blocking && reading);
    text(root, '.nja-file-state', complete ? 'Complete: text is ready' : reading ? 'Reading note.txt' : 'Not started');
    if (blocking) {
      text(root, '.nja-thread-state', complete ? 'Print text, then Next' : reading ? 'Waiting inside readFileSync' : 'Load file-system tools');
      text(root, '.nja-io-output', complete ? 'Hello from disk.\nNext' : '(nothing yet)');
      return;
    }
    const running = pose === 'run';
    const travel = running ? Math.min(1, progress * 6) : 0;
    root.querySelector('.nja-callback-token').hidden = !complete;
    const destination = root.querySelector('.nja-thread-slot').getBoundingClientRect();
    const origin = root.querySelector('.nja-ready-slot').getBoundingClientRect();
    root.style.setProperty('--callback-x', `${(destination.left - origin.left) * travel}px`);
    root.style.setProperty('--callback-y', `${(destination.top - origin.top) * travel}px`);
    text(root, '.nja-thread-state', running ? '' : pose === 'start' ? 'Start readFile, then return' : 'Available for ready work');
    text(root, '.nja-ready-state', running ? 'Dispatched to JavaScript' : complete ? '' : 'Waiting for the file');
    text(root, '.nja-io-output', running && travel === 1 ? 'Next\nHello from disk.' : pose === 'start' ? '(nothing yet)' : 'Next');
  }

  const poses = {
    runtime(root, pose) {
      root.querySelector('.nja-node').classList.toggle('is-emphasized', pose === 'tools');
    },
    syntax(root, pose) {
      const called = ['call', 'execute'].includes(pose);
      root.querySelector('.nja-greet-function').classList.toggle('is-active', called);
      text(root, '.nja-count-value', pose === 'execute' ? '0 → 1' : '0');
      text(root, '.nja-name-value', called ? 'name = "Sam"' : 'name');
      text(root, '.nja-function-state', { values: 'Not defined yet', define: 'Defined, not running', call: 'Call starts with Sam', execute: 'Body runs, then returns' }[pose]);
      text(root, '.nja-syntax-output', pose === 'execute' ? 'Hello Sam' : '(nothing yet)');
    },
    blocking(root, pose, progress) { poseIO(root, pose, progress, true); },
    nonblocking(root, pose, progress) { poseIO(root, pose, progress, false); },
    callbacks(root, pose) {
      const success = pose === 'success';
      const error = pose === 'error';
      root.querySelector('.nja-success-path').classList.toggle('is-active', success);
      root.querySelector('.nja-error-path').classList.toggle('is-active', error);
      text(root, '.nja-error-value', success ? 'null' : error ? 'Error: file missing' : 'error');
      text(root, '.nja-text-value', success ? '"Hello from disk."' : error ? 'unavailable' : 'text');
      text(root, '.nja-condition-value', success ? 'false: take the no path' : error ? 'true: take the yes path' : 'Which path?');
      text(root, '.nja-callback-name', pose === 'inline' ? '(error, text) => { ... }' : 'onFile(error, text)');
      text(root, '.nja-callback-output', error ? 'Error: file missing' : 'Hello from disk.');
    },
    await(root, pose) {
      const fulfilled = pose === 'fulfilled';
      const rejected = pose === 'rejected';
      text(root, '.nja-promise-state', pose);
      text(root, '.nja-promise-value', fulfilled ? '"Hello from disk."' : rejected ? 'Error: file missing' : 'Result not ready');
      text(root, '.nja-await-transition', fulfilled ? 'resume with the value' : rejected ? 'throw into catch' : 'wait for the outcome');
      text(root, '.nja-await-state', fulfilled ? 'Resumed after await' : rejected ? 'Running catch' : 'Paused at await');
      text(root, '.nja-await-value', fulfilled ? 'text = "Hello from disk."' : rejected ? 'error = Error object' : 'text not assigned yet');
      text(root, '.nja-await-output', fulfilled ? 'Hello from disk.' : rejected ? 'Error: file missing' : '(nothing yet)');
    },
    server(root, pose, progress) {
      const wire = root.querySelector('.nja-wire-line');
      const message = root.querySelector('.nja-message');
      const travel = Math.min(1, progress * 4);
      const distance = wire.clientHeight - message.offsetHeight;
      root.style.setProperty('--message-y', `${(pose === 'reply' ? 1 - travel : travel) * distance}px`);
      message.hidden = pose === 'register';
      text(root, '.nja-browser-response', pose === 'reply' ? 'Hello!' : pose === 'listen' ? 'Request sent' : 'No request yet');
      text(root, '.nja-server-state', pose === 'reply' ? 'Response sent; still listening' : pose === 'listen' ? 'Listening on port 3000' : 'Handler registered');
    },
    npm(root, pose) {
      text(root, '.nja-package-action', pose === 'install' ? 'npm installs' : 'require loads');
    },
    predict(root, pose, progress) {
      const shown = pose === 'question' ? 0 : Math.min(3, 1 + Math.floor(progress * 10));
      root.querySelectorAll('.nja-output-slots strong').forEach((slot, index) => {
        const value = index < shown ? ['A', 'C', 'B'][index] : '?';
        if (slot.textContent !== value) slot.textContent = value;
      });
      if (pose === 'answer') highlight(root, [shown === 1 ? 1 : shown === 2 ? 3 : 2]);
      text(root, '.nja-timer-state', shown === 3 ? 'Callback runs now' : 'Runs later');
      text(root, '.nja-prediction-state', pose === 'answer' ? 'A, C, B: finish the current code before the callback.' : 'What will appear in the output?');
    },
  };

  window.NodejsAnimationArt = {
    render(root, sceneId, cue, progress, animate) {
      root.dataset.currentPose = cue.pose;
      text(root, '.nja-step', cue.step);
      text(root, '.nja-note', cue.note);
      root.querySelectorAll('[data-pose]').forEach((part) => {
        part.hidden = !part.dataset.pose.split(' ').includes(cue.pose);
      });
      const alternate = ['inline', 'import'].includes(cue.pose);
      root.querySelectorAll('[data-code-variant]').forEach((part) => {
        part.hidden = (part.dataset.codeVariant === 'alternate') !== alternate;
      });
      highlight(root, cue.focus || []);
      // Reduced motion retains the whole teaching state, without token travel.
      poses[sceneId](root, cue.pose, animate ? progress : 1);
    },
  };
})();
