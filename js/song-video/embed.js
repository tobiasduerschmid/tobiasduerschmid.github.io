/* Same-origin player sizing and chapter theme propagation. */
(function () {
  'use strict';
  if (window.songPlayerEmbeds) return;
  window.songPlayerEmbeds = true;

  const frames = Array.from(document.querySelectorAll('iframe.song-video-frame'));

  let fullscreenFrame = null;
  let restoreFullscreenPage = () => {};

  function resizeFullscreenFrame() {
    if (!fullscreenFrame) return;
    const viewport = window.visualViewport;
    fullscreenFrame.style.setProperty('--song-fullscreen-left', `${viewport?.offsetLeft || 0}px`);
    fullscreenFrame.style.setProperty('--song-fullscreen-top', `${viewport?.offsetTop || 0}px`);
    fullscreenFrame.style.setProperty('--song-fullscreen-width', `${viewport?.width || window.innerWidth}px`);
    fullscreenFrame.style.setProperty('--song-fullscreen-height', `${viewport?.height || window.innerHeight}px`);
  }

  function leaveFullscreenFrame() {
    if (!fullscreenFrame) return;
    const frame = fullscreenFrame;
    fullscreenFrame = null;
    frame.classList.remove('is-song-fullscreen');
    restoreFullscreenPage();
    restoreFullscreenPage = () => {};
  }

  function enterFullscreenFrame(frame) {
    if (fullscreenFrame === frame) return;
    leaveFullscreenFrame();
    const scroll = { x: window.scrollX, y: window.scrollY };
    const previous = [];
    for (let branch = frame; branch !== document.body; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch) continue;
        previous.push([sibling, sibling.inert]);
        sibling.inert = true;
      }
    }
    const oldPopover = frame.getAttribute('popover');
    // A popover raises the existing iframe into the top layer without moving
    // it in the DOM, which would reload its audio and lose playback position.
    if (frame.showPopover) {
      frame.setAttribute('popover', 'manual');
      try { frame.showPopover(); }
      catch (error) {
        // The fixed iframe still fills the viewport when top-layer promotion
        // is unavailable (for example while a document is being restored).
        if (oldPopover === null) frame.removeAttribute('popover');
        else frame.setAttribute('popover', oldPopover);
      }
    }
    document.documentElement.style.setProperty('--song-page-scroll-top', `${-scroll.y}px`);
    document.documentElement.classList.add('has-song-frame-fullscreen');
    fullscreenFrame = frame;
    frame.classList.add('is-song-fullscreen');
    resizeFullscreenFrame();
    restoreFullscreenPage = () => {
      if (frame.hidePopover && frame.matches(':popover-open')) frame.hidePopover();
      if (oldPopover === null) frame.removeAttribute('popover');
      else frame.setAttribute('popover', oldPopover);
      document.documentElement.classList.remove('has-song-frame-fullscreen');
      document.documentElement.style.removeProperty('--song-page-scroll-top');
      previous.forEach(([element, inert]) => { element.inert = inert; });
      window.scrollTo(scroll.x, scroll.y);
    };
  }

  function sendTheme(frame) {
    const figure = frame.closest('figure');
    const fontSize = Math.max(16, parseFloat(getComputedStyle(figure).fontSize));
    frame.contentWindow.postMessage({
      type: 'song-player:theme',
      dark: document.documentElement.classList.contains('dark-mode'),
      fontSize,
      hasTranscript: Boolean(figure.querySelector('.song-video-transcript')),
    }, window.location.origin);
  }

  function receiveMessage(event) {
    if (event.origin !== window.location.origin) return;
    const frame = frames.find((candidate) => candidate.contentWindow === event.source);
    if (!frame) return;
    if (event.data?.type === 'song-player:ready') sendTheme(frame);
    if (event.data?.type === 'song-player:fullscreen') {
      if (event.data.active === true) enterFullscreenFrame(frame);
      else if (fullscreenFrame === frame) leaveFullscreenFrame();
    }
    if (event.data?.type === 'song-player:playing') {
      frames.filter((other) => other !== frame).forEach((other) => {
        other.contentWindow.postMessage({ type: 'song-player:pause' }, window.location.origin);
      });
    }
    if (frame !== fullscreenFrame && event.data?.type === 'song-player:resize' && Number.isFinite(event.data.height)) {
      const borderHeight = frame.offsetHeight - frame.clientHeight;
      frame.style.height = `${Math.max(180, Math.min(20000, event.data.height)) + borderHeight}px`;
    }
  }

  frames.forEach((frame) => {
    frame.addEventListener('load', () => {
      const host = frame.closest('[data-song-fullscreen-host]');
      const continuing = host && frame.hasAttribute('src');
      if (fullscreenFrame === frame && !continuing) leaveFullscreenFrame();
      if (host && !continuing && document.fullscreenElement === host) void document.exitFullscreen();
      sendTheme(frame);
    });
  });
  window.addEventListener('message', receiveMessage);
  // A cached frame may finish before this deferred host script attaches.
  frames.forEach(sendTheme);
  const themeObserver = new MutationObserver(() => frames.forEach(sendTheme));
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', () => { resizeFullscreenFrame(); frames.forEach(sendTheme); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeFullscreenFrame);
    window.visualViewport.addEventListener('scroll', resizeFullscreenFrame);
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && fullscreenFrame) {
      event.preventDefault();
      fullscreenFrame.contentWindow.postMessage({ type: 'song-player:exit-fullscreen' }, window.location.origin);
    }
  });
  window.addEventListener('pagehide', leaveFullscreenFrame);

  // WebKit keeps a closed details element's native contents hidden in print.
  // Preserve the screen state across both print dialogs and print-media changes.
  const printMedia = window.matchMedia('print');
  let closedTranscripts = null;

  function revealPrintTranscripts() {
    if (closedTranscripts !== null) return;
    closedTranscripts = Array.from(document.querySelectorAll('details.song-video-transcript'))
      .filter((transcript) => !transcript.open);
    closedTranscripts.forEach((transcript) => { transcript.open = true; });
  }

  function restoreTranscripts() {
    if (closedTranscripts === null) return;
    closedTranscripts.forEach((transcript) => { transcript.open = false; });
    closedTranscripts = null;
  }

  window.addEventListener('beforeprint', revealPrintTranscripts);
  window.addEventListener('afterprint', restoreTranscripts);
  printMedia.addEventListener('change', (event) => {
    if (event.matches) revealPrintTranscripts();
    else restoreTranscripts();
  });
  if (printMedia.matches) revealPrintTranscripts();

  // Direct transcript links from the player reveal the native details element.
  function revealTranscript() {
    if (!window.location.hash) return;
    const target = document.getElementById(window.location.hash.slice(1));
    if (target?.matches('details.song-video-transcript')) target.open = true;
  }
  window.addEventListener('hashchange', revealTranscript);
  revealTranscript();
})();
