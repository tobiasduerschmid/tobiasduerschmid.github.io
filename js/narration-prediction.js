/* Prediction holds shared by audio and text-only narration sessions. The
   transport owns time/navigation; this module owns the learner's reveal choice. */
(function () {
  'use strict';
  if (window.NarrationPrediction) return;

  const keyOf = ({ sceneIndex, cueIndex }) => `${sceneIndex}/${cueIndex}`;

  /** Bind the authored prediction surface. A seek starts a fresh visit; normal
   * playback cannot leave a held cue until reveal or the opt-out is chosen. */
  function create(root, { storyboard, onReveal, onToggle }) {
    const panel = root.querySelector('[data-narration-prediction]');
    const setting = root.querySelector('[data-setting="prediction"]');
    if (!panel || !setting) return null;
    const reveal = panel.querySelector('[data-narration-action="reveal-prediction"]');
    const nextStep = root.querySelector('[data-narration-action="next-step"]');
    const status = root.querySelector('.nja-status');
    const hasPredictions = storyboard.scenes.some(scene => scene.cues.some(cue => cue.prediction));
    setting.closest('label').hidden = !hasPredictions;
    let held = null;
    let releasedKey = null;
    let shownKey = null;
    let enabled = setting.checked;

    function clear() {
      if (held) status.textContent = '';
      held = null;
      panel.hidden = true;
      if (nextStep) nextStep.disabled = false;
    }

    function shouldHold(frame) {
      return enabled && storyboard.scenes[frame.sceneIndex].cues[frame.cueIndex].prediction
        && keyOf(frame) !== releasedKey;
    }

    function hold(frame) {
      if (!shouldHold(frame)) return false;
      if (held && keyOf(held) === keyOf(frame)) return true;
      held = frame;
      panel.querySelector('.narration-prediction-prompt').textContent = storyboard.scenes[frame.sceneIndex].cues[frame.cueIndex].text;
      panel.hidden = false;
      if (nextStep) nextStep.disabled = true;
      status.textContent = 'Paused for your prediction. Take your time, then choose Reveal explanation.';
      return true;
    }

    reveal.addEventListener('click', () => {
      if (!held) return;
      const frame = held;
      releasedKey = keyOf(frame);
      clear();
      onReveal(frame);
    });
    // These are ordinary buttons/checkboxes, not song-player shortcuts.
    panel.addEventListener('keydown', event => { if (event.key !== 'Escape') event.stopPropagation(); });
    setting.addEventListener('change', () => window.NarrationPreferences.set({ predictions: setting.checked }));
    window.NarrationPreferences.subscribe(preferences => {
      setting.checked = preferences.predictions;
      if (enabled === preferences.predictions) return;
      enabled = preferences.predictions;
      clear();
      // Initial preferences arrive before the transport has presented a cue.
      if (shownKey === null) return;
      onToggle(enabled);
      if (!enabled) status.textContent = 'Pause and predict is off.';
    });

    return {
      hold, shouldHold,
      isHolding: () => held !== null,
      focusReveal: () => reveal.focus({ preventScroll: true }),
      update(frame) {
        const key = keyOf(frame);
        if (key !== shownKey) {
          releasedKey = null;
          if (held) clear();
        }
        shownKey = key;
      },
      reset() { releasedKey = null; clear(); },
      dismiss() { if (held) releasedKey = keyOf(held); clear(); },
    };
  }

  window.NarrationPrediction = { create };
})();
