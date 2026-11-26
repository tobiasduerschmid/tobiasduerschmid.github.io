/* The control bar every narration player shares
   (_includes/narration-player-controls.html), which is the song player's:
   five-second skips, mute and volume, captions and their size, the settings
   panel, keyboard shortcuts, controls that hide during playback in full
   screen, a landscape surface on portrait touch screens, and, where a player
   has a picture control, play and skip by click and double-click. Shortcuts,
   gestures, hiding, and the settings panel are the song player's own modules
   (js/song-video/), bound through their class hooks. The narration transport
   (js/narration-transport.js) binds this module to every player. */
(function () {
  'use strict';

  // Rotate the inner surface, not the native fullscreen element (whose
  // transform the browser resets). This also works without orientation-lock
  // support on iPhone. The viewer can keep device orientation in settings.
  function bindLandscape(root, video, listen) {
    const landscape = root.querySelector('.vn-landscape');
    const touch = window.matchMedia('(any-pointer: coarse)');
    let active = false;

    function resize() {
      const viewport = window.visualViewport;
      const width = viewport ? viewport.width : window.innerWidth;
      const height = viewport ? viewport.height : window.innerHeight;
      const rotated = active && landscape.checked && touch.matches && height > width;
      video.classList.toggle('is-rotated', rotated);
      if (!active) return;
      video.style.setProperty('--vn-surface-width', `${rotated ? height : width}px`);
      video.style.setProperty('--vn-surface-height', `${rotated ? width : height}px`);
      video.style.setProperty('--vn-viewport-width', `${width}px`);
      video.style.setProperty('--vn-viewport-height', `${height}px`);
      video.style.setProperty('--vn-viewport-left', `${viewport ? viewport.offsetLeft : 0}px`);
      video.style.setProperty('--vn-viewport-top', `${viewport ? viewport.offsetTop : 0}px`);
    }

    listen(root, 'narration-fullscreenchange', event => {
      active = event.detail.active;
      resize();
    });
    listen(landscape, 'change', resize);
    listen(window, 'resize', resize);
    listen(touch, 'change', resize);
    if (window.visualViewport) {
      listen(window.visualViewport, 'resize', resize);
      listen(window.visualViewport, 'scroll', resize);
    }
  }

  // A checkpoint (knowledge check or decision) replaces the picture. While it
  // is open, the control bar steps aside (css/narrated-explainer.css) and the
  // checkpoint's own buttons continue; in full screen, its exit button leaves
  // full screen.
  function bindCheckpoint(root, listen) {
    const checkpoint = root.querySelector('.narration-check');
    if (!checkpoint) return;
    new MutationObserver(() => {
      if (!checkpoint.hidden && !root.querySelector('.vn-settings').hidden) {
        root.querySelector('.vn-settings-close').click();
        checkpoint.querySelector('h3').focus({ preventScroll: true });
      }
    }).observe(checkpoint, { attributes: true, attributeFilter: ['hidden'] });
    // Keys typed in a checkpoint answer it; they never control playback.
    listen(checkpoint, 'keydown', event => { if (event.key !== 'Escape') event.stopPropagation(); });
    const exit = checkpoint.querySelector('.vn-check-exit');
    if (exit) listen(exit, 'click', () => root.querySelector('[data-action="fullscreen"]').click());
    // The checkpoint replaces the toolbar, so its heading is the return target
    // when the full-screen-only exit button disappears.
    listen(root, 'narration-fullscreenchange', event => {
      if (!event.detail.active && !checkpoint.hidden) checkpoint.querySelector('h3').focus({ preventScroll: true });
    });
  }

  // Escape closes the settings first; in full screen, a second Escape leaves it.
  function bindSettings(root, listen, visibility) {
    window.SongSettingsPanel.bind({
      player: root.querySelector('[data-vn-video]'), listen,
      panel: root.querySelector('.vn-settings'),
      toggle: root.querySelector('.vn-settings-toggle'),
      close: root.querySelector('.vn-settings-close'),
      ...(visibility && { onActivity: visibility.reveal, focusControl: visibility.focusControl }),
    });
  }

  // The mute button and the volume slider follow the audio, however its
  // volume changed; muting keeps the volume to return to.
  function bindSound(root, audio, listen) {
    const mute = root.querySelector('[data-action="mute"]');
    const volume = root.querySelector('.vn-volume');
    function sync() {
      const silent = audio.muted || audio.volume === 0;
      const label = silent ? 'Unmute narration' : 'Mute narration';
      mute.classList.toggle('is-muted', silent);
      mute.setAttribute('aria-label', label);
      mute.title = label;
      mute.setAttribute('data-original-title', label);
      volume.value = String(Math.round((audio.muted ? 0 : audio.volume) * 100));
      volume.setAttribute('aria-valuetext', `${volume.value}%`);
    }
    listen(mute, 'click', () => {
      if (audio.muted || audio.volume === 0) {
        audio.muted = false;
        if (audio.volume === 0) audio.volume = 1;
      } else audio.muted = true;
    });
    listen(volume, 'input', () => {
      audio.volume = Number(volume.value) / 100;
      audio.muted = audio.volume === 0;
    });
    listen(audio, 'volumechange', sync);
    sync();
  }

  /**
   * Binds the shared control bar of `root`. `player` is the transport's API;
   * a player without rendered speech has no audio, so keys and controls that
   * need the narration clock stay inactive.
   */
  function bind(root, player) {
    const video = root.querySelector('[data-vn-video]');
    if (!video) return;
    const audio = root.querySelector('audio');
    const seek = root.querySelector('.nja-seek');
    const cc = root.querySelector('.vn-cc');
    const feedback = root.querySelector('.vn-gesture-feedback');
    const listen = (target, type, handler, options) => target.addEventListener(type, handler, options);
    const visibility = audio ? window.SongControlsVisibility.bind({ player: root, audio, listen, hideWhileHovered: true }) : null;
    let feedbackTimer = 0;

    const togglePlayback = () => root.querySelector('[data-action="play"]').click();
    const toggleFullscreen = () => root.querySelector('[data-action="fullscreen"]').click();
    function skip(direction) {
      player.seekTo(Number(seek.value) + 5 * direction);
      if (!feedback) return;
      clearTimeout(feedbackTimer);
      feedback.textContent = direction < 0 ? '−5 seconds' : '+5 seconds';
      feedback.classList.toggle('is-back', direction < 0);
      feedback.hidden = false;
      feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 700);
    }
    function toggleCaptions() {
      const on = cc.getAttribute('aria-pressed') !== 'true';
      cc.setAttribute('aria-pressed', String(on));
      video.classList.toggle('are-captions-off', !on);
    }

    window.SongKeyboard.bind({
      player: video, positionControl: seek, listen,
      toggle: audio && togglePlayback,
      skip: audio && skip,
      seekToFraction: audio && (fraction => player.seekTo(Number(seek.max) * fraction)),
      fullscreen: toggleFullscreen,
      captions: cc && toggleCaptions,
    });
    root.querySelectorAll('[data-vn-skip]').forEach(button => listen(button, 'click', () => skip(Math.sign(Number(button.dataset.vnSkip)))));
    if (cc) listen(cc, 'click', toggleCaptions);
    listen(root.querySelector('.vn-caption-size'), 'change', event => video.style.setProperty('--vn-caption-scale', event.target.value));
    if (audio) bindSound(root, audio, listen);
    const picture = root.querySelector('.vn-picture-control');
    if (picture && audio) {
      const syncPicture = () => picture.setAttribute('aria-label', audio.paused ? 'Play video' : 'Pause video');
      picture.hidden = false;
      window.SongGestures.bind({ button: picture, screen: video, listen, toggle: togglePlayback, skip, revealControls: visibility.reveal });
      for (const type of ['play', 'pause', 'ended']) listen(audio, type, syncPicture);
      syncPicture();
    }
    if (visibility) listen(root, 'narration-fullscreenchange', event => visibility.setFullscreen(event.detail.active));
    bindSettings(root, listen, visibility);
    bindCheckpoint(root, listen);
    bindLandscape(root, video, listen);
  }

  window.NarrationPlayerControls = { bind };
})();
