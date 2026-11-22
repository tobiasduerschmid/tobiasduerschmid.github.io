/* Chapter narration and its paired song share a stable fullscreen container. */
(function () {
  'use strict';
  if (window.NarrationSong) return;
  const sessions = new Map();

  function songTarget(root) {
    return Array.from(document.querySelectorAll('figure[data-narration]'))
      .find(figure => figure.dataset.narration === root.id)?.querySelector('iframe.song-video-frame');
  }

  function send(session, type, data = {}) {
    session.frame.contentWindow.postMessage({ type, ...data }, window.location.origin);
  }

  function syncFullscreen(session) {
    send(session, 'song-player:host-fullscreen', { active: session.player.isFullscreen() });
  }

  function startSong(session) {
    syncFullscreen(session);
    send(session, 'song-player:continue');
  }

  function showNarration(session) {
    send(session, 'song-player:pause');
    session.showingSong = false;
    session.frame.hidden = true;
    session.children.forEach(([child, hidden]) => { child.hidden = hidden; });
    session.root.classList.remove('is-showing-song');
    (session.root.querySelector('[data-action="play"]') || session.root.querySelector('.vn-settings-toggle'))
      .focus({ preventScroll: true });
  }

  function createSession(root, player, source) {
    const host = root.querySelector('[data-vn-video]');
    host.setAttribute('data-song-fullscreen-host', '');
    host.setAttribute('data-narration-song-host', '');
    const frame = document.createElement('iframe');
    frame.className = 'song-video-frame vn-song-frame';
    frame.title = source.title;
    frame.allowFullscreen = true;
    frame.hidden = true;
    const session = { root, player, frame, children: [], showingSong: false, ready: false };
    host.append(frame);
    sessions.set(root, session);
    window.SongPlayerEmbeds.register(frame);
    root.addEventListener('narration-fullscreenchange', () => syncFullscreen(session));
    frame.src = source.src;
    return session;
  }

  // Keep the narration DOM and media clock alive while its surface is replaced.
  function continueToSong(root, player) {
    const source = songTarget(root);
    if (!source) return false;
    root.querySelector('audio')?.pause();
    const session = sessions.get(root) || createSession(root, player, source);
    session.children = Array.from(session.frame.parentElement.children)
      .filter(child => child !== session.frame).map(child => [child, child.hidden]);
    session.children.forEach(([child]) => { child.hidden = true; });
    session.showingSong = true;
    root.classList.add('is-showing-song');
    session.frame.hidden = false;
    session.frame.focus({ preventScroll: true });
    if (session.ready) startSong(session);
    return true;
  }

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin) return;
    const session = Array.from(sessions.values()).find(item => item.frame.contentWindow === event.source);
    if (!session) return;
    if (event.data?.type === 'song-player:ready') {
      session.ready = true;
      if (session.showingSong) startSong(session);
    }
    if (!session.showingSong) return;
    if (event.data?.type === 'song-player:previous') showNarration(session);
    if (event.data?.type === 'song-player:toggle-host-fullscreen') void session.player.toggleFullscreen();
    if (event.data?.type === 'song-player:exit-host-fullscreen') void session.player.exitFullscreen();
  });

  window.NarrationSong = { hasSong: root => Boolean(songTarget(root)), continueToSong };
})();
