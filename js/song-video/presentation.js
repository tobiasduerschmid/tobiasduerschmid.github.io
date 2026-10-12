/* Optional fullscreen presentation, independent of native audio playback. */
(function () {
  'use strict';

  function bind({ player, listen, onResize, onError, onChange }) {
    const screen = player.querySelector('.song-player-screen');
    const button = player.querySelector('.song-player-fullscreen');
    // A playlist replaces the iframe document between songs. Its persistent
    // host owns fullscreen so that navigation cannot tear down the presentation.
    const frame = window.frameElement;
    const host = frame?.closest('[data-song-fullscreen-host]');
    const fullscreenTarget = host || screen;
    const fullscreenDocument = fullscreenTarget.ownerDocument;
    const orientation = window.screen.orientation;
    const touchScreen = window.matchMedia('(any-pointer: coarse)');
    let active = false;
    let fallback = false;
    let entering = false;
    let orientationRequested = false;
    let orientationGeneration = 0;
    let pageActive = true;
    let restoreBackground = () => {};
    let scrollPosition = null;

    function notifyParent(value) {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'song-player:fullscreen', active: value }, window.location.origin);
      }
    }

    function isolateScreen() {
      const previous = [];
      for (let branch = screen; branch !== document.body; branch = branch.parentElement) {
        for (const sibling of branch.parentElement.children) {
          if (sibling === branch) continue;
          previous.push([sibling, sibling.inert]);
          sibling.inert = true;
        }
      }
      return () => previous.forEach(([element, inert]) => { element.inert = inert; });
    }

    function resize() {
      if (!active) return;
      const viewport = window.visualViewport;
      const width = viewport?.width || window.innerWidth;
      const height = viewport?.height || window.innerHeight;
      const rotated = touchScreen.matches && height > width;
      screen.classList.toggle('is-rotated', rotated);
      screen.style.setProperty('--fullscreen-width', `${width}px`);
      screen.style.setProperty('--fullscreen-height', `${height}px`);
      screen.style.setProperty('--fullscreen-left', `${viewport?.offsetLeft || 0}px`);
      screen.style.setProperty('--fullscreen-top', `${viewport?.offsetTop || 0}px`);
      screen.style.setProperty('--fullscreen-surface-width', `${rotated ? height : width}px`);
      screen.style.setProperty('--fullscreen-surface-height', `${rotated ? width : height}px`);
      onResize();
    }

    function releaseOrientation() {
      orientationGeneration += 1;
      if (!orientationRequested) return;
      orientationRequested = false;
      orientation.unlock();
    }

    async function lockLandscape() {
      if (!touchScreen.matches || !orientation?.lock || !orientation?.unlock) return;
      const request = ++orientationGeneration;
      orientationRequested = true;
      try {
        await orientation.lock('landscape');
        if (request === orientationGeneration && !active) releaseOrientation();
      } catch (error) {
        // Unsupported or disallowed orientation locks use the rotated surface.
        if (request === orientationGeneration) orientationRequested = false;
      }
      if (request === orientationGeneration) resize();
    }

    function enterPresentation(useFallback) {
      if (active || !pageActive) return;
      active = true;
      fallback = useFallback;
      scrollPosition = { x: window.scrollX, y: window.scrollY };
      screen.classList.add('is-fullscreen');
      screen.classList.toggle('is-fallback-fullscreen', fallback);
      button.setAttribute('aria-label', 'Exit full screen');
      if (fallback) {
        document.documentElement.classList.add('has-song-player-fullscreen');
        screen.setAttribute('role', 'dialog');
        screen.setAttribute('aria-modal', 'true');
        screen.setAttribute('aria-label', 'Full screen music player');
        restoreBackground = isolateScreen();
        notifyParent(true);
      }
      resize();
      button.focus({ preventScroll: true });
      onChange(true);
      if (!fallback) void lockLandscape();
    }

    function leavePresentation(restoreFocus = true, notify = true) {
      if (!active) return;
      const wasFallback = fallback;
      active = false;
      fallback = false;
      releaseOrientation();
      screen.classList.remove('is-fullscreen', 'is-fallback-fullscreen', 'is-rotated');
      document.documentElement.classList.remove('has-song-player-fullscreen');
      screen.removeAttribute('role');
      screen.removeAttribute('aria-modal');
      screen.removeAttribute('aria-label');
      restoreBackground();
      restoreBackground = () => {};
      button.setAttribute('aria-label', 'Enter full screen');
      onChange(false);
      if (wasFallback && notify) notifyParent(false);
      onResize();
      if (restoreFocus) {
        window.scrollTo(scrollPosition.x, scrollPosition.y);
        button.focus({ preventScroll: true });
      }
    }

    async function exit() {
      if (!active) return true;
      if (fallback) leavePresentation();
      else {
        try { await fullscreenDocument.exitFullscreen(); }
        catch (error) { return false; }
      }
      return true;
    }

    async function toggle() {
      if (entering) return;
      if (active) {
        if (!(await exit())) onError('Use your browser’s full screen control to leave full screen.');
        return;
      }
      entering = true;
      try {
        if (fullscreenDocument.fullscreenEnabled && fullscreenTarget.requestFullscreen) {
          try {
            await fullscreenTarget.requestFullscreen({ navigationUI: 'hide' });
            enterPresentation(false);
          } catch (error) { enterPresentation(true); }
        } else enterPresentation(true);
      } finally { entering = false; }
    }

    function keyboard(event) {
      if (!active) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        void exit();
      } else if (event.key === 'Tab') {
        const controls = Array.from(screen.querySelectorAll('button, input, select, a[href]'))
          .filter((element) => !element.disabled && element.getClientRects().length);
        const first = controls[0];
        const last = controls[controls.length - 1];
        const focused = document.activeElement;
        const wrapBackward = event.shiftKey && (focused === first || focused === screen);
        const wrapForward = !event.shiftKey && focused === last;
        if (!screen.contains(focused) || wrapBackward || wrapForward) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    }

    button.hidden = false;
    listen(button, 'click', toggle);
    function adoptPresentation() {
      if (fullscreenDocument.fullscreenElement === fullscreenTarget) enterPresentation(false);
      else if (host && frame.classList.contains('is-song-fullscreen')) enterPresentation(true);
    }
    listen(fullscreenDocument, 'fullscreenchange', () => {
      if (fullscreenDocument.fullscreenElement === fullscreenTarget) enterPresentation(false);
      else if (active && !fallback) leavePresentation();
    });
    listen(document, 'keydown', keyboard);
    listen(window, 'resize', resize);
    if (window.visualViewport) {
      listen(window.visualViewport, 'resize', resize);
      listen(window.visualViewport, 'scroll', resize);
    }
    if (orientation) listen(orientation, 'change', resize);
    listen(window, 'message', (event) => {
      if (event.origin === window.location.origin && event.source === window.parent && event.data?.type === 'song-player:exit-fullscreen') void exit();
    });
    listen(window, 'pagehide', () => { pageActive = false; leavePresentation(false, !host); });
    listen(window, 'pageshow', () => { pageActive = true; adoptPresentation(); });
    adoptPresentation();
    return { isActive: () => active, exit, toggle };
  }

  window.SongFullscreen = { bind };
})();
