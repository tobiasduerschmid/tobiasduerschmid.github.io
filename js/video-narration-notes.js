/* The notes page's Print button (_includes/video-narration-notes.html), shown
   only where scripts run; without them the browser's own Print command works. */
(function () {
  'use strict';
  const button = document.querySelector('[data-notes-print]');
  if (!button) return;
  button.hidden = false;
  button.addEventListener('click', () => window.print());
})();
