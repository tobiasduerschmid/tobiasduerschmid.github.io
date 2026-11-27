/* Closer looks: optional worked examples a lesson offers during one cue. While
   that cue plays, an offer shows beside the picture and a marker stays on the
   timeline. Opening one pauses the narration and puts its panel where the
   picture was; Continue resumes from the same moment. Ignoring it costs
   nothing. NarrationPlayer creates this for every narration kind; the panel's
   presentation belongs to NarrationCloserLookView. */
(function () {
  'use strict';

  const clock = time => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;

  /** Every closer look of a story in lesson order, with its cue start when timed. */
  function anchors(story, timing) {
    return story.scenes.flatMap((scene, sceneIndex) => scene.cues.flatMap((cue, cueIndex) => (cue.closer_look ? [{
      sceneIndex, cueIndex, ref: `${scene.id}/${cue.id}`, look: cue.closer_look, title: cue.closer_look.title,
      time: timing ? timing.scenes[sceneIndex].cues[cueIndex].start : null,
    }] : [])));
  }

  /** Returns null for a lesson without closer looks. `player` is the transport
   * session; `status` the player's polite status line; `isBlocked` says whether
   * another surface (a knowledge check, a prediction, study tools) has the stage. */
  function create(root, { story, timing, player, status, isBlocked = () => false }) {
    const looks = anchors(story, timing);
    if (!looks.length) return null;
    const video = root.querySelector('[data-vn-video]');
    const offer = root.querySelector('[data-closer-look-offer]');
    const offerTitle = offer.querySelector('[data-closer-look-offer-title]');
    const stage = root.querySelector('.nja-stage');
    const captions = root.querySelector('.nja-narration');
    const panels = new Map();
    const announced = new Set();
    const touchOnly = window.matchMedia('(pointer: coarse)').matches;
    let offered = null;
    let openLook = null;
    let time = 0;

    function panelOf(look) {
      if (!panels.has(look.ref)) {
        const panel = root.querySelector(`[data-closer-look="${CSS.escape(look.ref)}"]`);
        const view = window.NarrationCloserLookView.create(panel);
        bindLanguage(panel, view);
        bindPanel(panel, look);
        view.showStep(0);
        panels.set(look.ref, { panel, view });
      }
      return panels.get(look.ref);
    }

    // The panel's language follows the site's code-language preference.
    function bindLanguage(panel, view) {
      const select = panel.querySelector('[data-closer-look-language]');
      if (!select) return;
      const languages = [...select.options].map(option => option.value);
      const preferences = window.SEBookCodePreferences;
      if (!preferences) {
        view.showLanguage(select.value);
      } else {
        preferences.subscribe(() => {
          select.value = preferences.choose(languages);
          view.showLanguage(select.value);
        });
      }
      select.addEventListener('change', () => {
        if (preferences) preferences.set(select.value);
        view.showLanguage(select.value);
      });
    }

    function bindPanel(panel, look) {
      panel.addEventListener('click', event => {
        const action = event.target.closest('[data-closer-look-action]')?.dataset.closerLookAction;
        if (action === 'continue') close({ resume: true });
        else if (action === 'close') close();
        else if (action === 'replay') replay(look);
      });
      // Inside the panel, keys keep their native meaning. Escape bubbles to the
      // video, which closes the look wherever focus is in the player.
      panel.addEventListener('keydown', event => { if (event.key !== 'Escape') event.stopPropagation(); });
    }

    // The way back names the moment the narration continues from; a lesson
    // without a narration clock continues step by step and has no replay.
    function labelWayBack(panel, look, resumeAt) {
      const timed = Boolean(timing && player.play);
      panel.querySelectorAll('[data-closer-look-continue-time]').forEach(label => {
        label.textContent = timed ? `(${clock(resumeAt)})` : '';
      });
      panel.querySelectorAll('[data-closer-look-continue-label]').forEach(label => {
        label.textContent = timed ? 'Continue narration' : 'Continue lesson';
      });
      const replayButton = panel.querySelector('[data-closer-look-action="replay"]');
      replayButton.hidden = !timed;
      if (timed) replayButton.querySelector('[data-closer-look-replay-time]').textContent = `(${clock(look.time)})`;
    }

    /** Pause and show a look; `seek` first moves the narration to its cue (the timeline marker). */
    function open(look, { seek = false } = {}) {
      if (isBlocked()) return;
      if (seek) player.showCue(look.sceneIndex, look.cueIndex);
      else player.pause();
      if (openLook) hidePanel();
      const { panel, view } = panelOf(look);
      labelWayBack(panel, look, seek ? look.time : time);
      openLook = look;
      offer.hidden = true;
      stage.hidden = true;
      captions.hidden = true;
      panel.hidden = false;
      view.refresh();
      panel.querySelector('h3').focus({ preventScroll: true });
      panel.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }

    function hidePanel() {
      panels.get(openLook.ref).panel.hidden = true;
      stage.hidden = false;
      captions.hidden = false;
      openLook = null;
    }

    /** Close the open panel; `resume` continues the narration from where it paused. */
    function close({ resume = false, focus = true } = {}) {
      if (!openLook) return;
      hidePanel();
      syncOffer();
      if (resume && player.play) void player.play();
      if (!focus) return;
      const target = resume || offer.hidden
        ? (player.isFullscreen() ? video : root.querySelector('[data-action="play"]') || video)
        : offer;
      target.focus({ preventScroll: true });
    }

    function replay(look) {
      close({ focus: false });
      player.showCue(look.sceneIndex, look.cueIndex);
      void player.play();
      (player.isFullscreen() ? video : root.querySelector('[data-action="play"]') || video).focus({ preventScroll: true });
    }

    function syncOffer() {
      offer.hidden = !offered || Boolean(openLook) || isBlocked();
    }

    /** Called with every rendered frame: offer the look of the current cue. */
    function update(frame) {
      if (frame.time !== undefined) time = frame.time;
      const current = looks.find(look => look.sceneIndex === frame.sceneIndex && look.cueIndex === frame.cueIndex) || null;
      if (current !== offered) {
        offered = current;
        if (current) {
          offerTitle.textContent = current.title;
          offer.querySelector('[data-closer-look-offer-label]').textContent = current.look.offer;
          // One name for the visible offer and the hidden title (it starts with the visible label).
          offer.setAttribute('aria-label', `${current.look.offer}: ${current.title}`);
          if (!announced.has(current.ref)) {
            announced.add(current.ref);
            status.textContent = `Closer look available: ${current.title}.${touchOnly ? '' : ' Press E to open it.'}`;
          }
        }
      }
      syncOffer();
    }

    offer.addEventListener('click', () => { if (offered) open(offered); });
    window.SongKeyboard.bind({
      player: video,
      positionControl: root.querySelector('.nja-seek'),
      listen: (target, type, handler) => target.addEventListener(type, handler),
      actions: { e: () => (offered && !openLook && !isBlocked() ? (open(offered), true) : false) },
    });
    // Escape closes an open look before anything else (full screen keeps going).
    video.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !openLook || event.defaultPrevented) return;
      event.preventDefault();
      close();
    });

    return { update, open, close, isOpen: () => Boolean(openLook), looks };
  }

  window.NarrationCloserLook = { anchors, create };
})();
