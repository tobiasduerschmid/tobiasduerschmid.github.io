/* The printable notes of a video narration (_includes/video-narration-notes.html).
   The page builds the narration's animated stage once, out of view, and
   copies each cue's picture at rest into its row, so the notes always show
   the current narration. Opened to export (#export), it then opens the print
   dialog, where the reader saves a PDF. Without scripts, every row describes
   its picture in words. */
(function () {
  'use strict';
  // A picture at rest: the pose just before its cue ends, as the stage audits check.
  const REST_LEAD = 0.3;
  const STAGE_WIDTH = 960;
  const timing = JSON.parse(document.getElementById('narration-timing').textContent);
  const status = document.querySelector('[data-notes-status]');
  const printButton = document.querySelector('[data-notes-print]');
  const slots = [...document.querySelectorAll('[data-vn-scene][data-vn-cue]')];

  // On screen a still scales to its slot; print sets a fixed size in CSS.
  const sizer = 'ResizeObserver' in window ? new ResizeObserver((entries) => {
    for (const entry of entries) entry.target.style.setProperty('--vn-still-scale', entry.contentRect.width / STAGE_WIDTH);
  }) : null;

  status.textContent = 'Drawing the pictures…';
  window.VideoNarrationStage.ready.then(() => {
    for (const slot of slots) {
      const cue = timing.scenes[slot.dataset.vnScene].cues[slot.dataset.vnCue];
      slot.replaceChildren(window.VideoNarrationStage.still(cue.end - REST_LEAD));
      slot.classList.add('has-still');
      if (sizer) sizer.observe(slot);
    }
    // The stills hold their own copies; the posed original is no longer needed.
    document.querySelector('.vn-notes-master').remove();
    status.textContent = 'The pictures are ready.';
    printButton.hidden = false;
    if (window.location.hash === '#export') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      window.print();
    }
  }, () => {
    status.textContent = 'The pictures could not be drawn, so each row describes its picture in words.';
    printButton.hidden = false;
  });
  printButton.addEventListener('click', () => window.print());
})();
