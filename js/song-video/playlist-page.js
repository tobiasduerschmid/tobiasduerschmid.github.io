/* Render playlist editing; order rules, persistence, and media messaging live separately. */
(function () {
  'use strict';

  const root = document.getElementById('song-playlist');
  const element = (id) => root.querySelector(`#${id}`);
  const model = window.SongPlaylistModel;
  const preferences = window.SongPreferences;
  const defaults = JSON.parse(document.getElementById('playlist-defaults').textContent);
  const catalog = new Map(Array.from(root.querySelectorAll('[data-song-id]'), (item) => [
    item.dataset.songId,
    { id: item.dataset.songId, title: item.querySelector('h3').textContent,
      player: item.dataset.player, duration: Number(item.dataset.duration), credit: item.dataset.credit },
  ]));
  const catalogIds = [...catalog.keys()];
  const events = new AbortController();
  let ids = model.restore(preferences.playlist(), catalogIds, defaults[0]?.songs ?? catalogIds);
  let previous = null;
  let current = null;
  let continuePlaylist = false;
  let reorder = null;

  const player = window.SongPlaylistPlayer.bind({
    frame: element('playlist-frame'), signal: events.signal,
    onPlaying: () => { continuePlaylist = true; announce(`Playing ${catalog.get(current).title}.`); },
    onPlayBlocked: () => announce('Video ready. Press Play in the video to continue.'),
    onNavigate: (direction) => {
      const id = model[direction](ids, current);
      if (id) { selectVideo(id, true, direction); announce(`Loading ${catalog.get(id).title}.`); }
    },
    onEnded: (id) => {
      if (!continuePlaylist) return;
      const next = model.next(ids, id);
      if (next) selectVideo(next, true);
      else { continuePlaylist = false; announce('Playlist finished.'); }
    },
  });

  function listen(target, type, handler) {
    target.addEventListener(type, handler, { signal: events.signal });
  }

  function announce(message) {
    element('playlist-status').textContent = message;
  }

  function markCurrentVideo() {
    player.configure({ previous: Boolean(model.previous(ids, current)), next: Boolean(model.next(ids, current)) });
    for (const row of element('playlist-queue').children) {
      const selected = row.dataset.id === current;
      row.querySelector('.song-playlist-current').hidden = !selected;
      if (selected) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    }
  }

  function selectVideo(id, play = false, focus = null) {
    current = id;
    const song = catalog.get(id);
    element('playlist-video').hidden = false;
    element('playlist-current-title').textContent = song.title;
    element('playlist-credit').textContent = song.credit;
    player.load(song, { play, focus });
    markCurrentVideo();
  }

  function reconcilePlayer() {
    if (current && ids.includes(current)) return;
    continuePlaylist = false;
    if (ids.length) selectVideo(ids[0]);
    else {
      current = null;
      player.clear();
      element('playlist-video').hidden = true;
      element('playlist-current-title').textContent = 'Choose a video from your playlist.';
    }
  }

  function createRow(id, index) {
    const row = element('playlist-row').content.firstElementChild.cloneNode(true);
    const title = catalog.get(id).title;
    row.dataset.id = id;
    row.querySelector('.song-playlist-item-title').textContent = title;
    for (const button of row.querySelectorAll('button')) {
      button.setAttribute('aria-label', `${button.textContent}: ${title}`);
      button.disabled = (button.dataset.action === 'up' && index === 0)
        || (button.dataset.action === 'down' && index === ids.length - 1);
    }
    return row;
  }

  function render() {
    reorder?.cancel();
    element('playlist-queue').replaceChildren(...ids.map(createRow));
    const seconds = Math.round(ids.reduce((sum, id) => sum + catalog.get(id).duration, 0));
    element('playlist-summary').textContent = `${ids.length} video${ids.length === 1 ? '' : 's'} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} at normal speed`;
    element('playlist-empty').hidden = ids.length > 0;
    element('playlist-play').disabled = ids.length === 0;
    element('playlist-clear').disabled = ids.length === 0;
    element('playlist-undo').disabled = previous === null;
    for (const button of root.querySelectorAll('[data-add-song]')) {
      const included = ids.includes(button.dataset.addSong);
      button.disabled = included;
      button.firstChild.textContent = included ? 'In playlist' : 'Add to playlist';
    }
    reconcilePlayer();
    markCurrentVideo();
  }

  function save(message) {
    const saved = preferences.savePlaylist(ids);
    announce(`${message} ${saved ? 'Saved in this browser.' : 'Changes are kept for this visit only; your browser could not save them.'}`);
  }

  function edit(next, message) {
    previous = ids;
    ids = next;
    render();
    save(message);
  }

  function focusRow(id, action) {
    const row = Array.from(element('playlist-queue').children).find((item) => item.dataset.id === id);
    const preferred = row?.querySelector(`[data-action="${action}"]`);
    const target = preferred && !preferred.disabled ? preferred : row?.querySelector('[data-action="play"]');
    if (target) target.focus();
    else element('playlist-load').focus();
  }

  function editRow(button) {
    const id = button.closest('[data-id]').dataset.id;
    const action = button.dataset.action;
    if (action === 'play') { selectVideo(id, true); return; }
    const index = ids.indexOf(id);
    if (action === 'remove') {
      edit(model.remove(ids, id), `Removed ${catalog.get(id).title}.`);
      focusRow(ids[Math.min(index, ids.length - 1)], 'play');
    } else {
      edit(model.move(ids, id, action === 'up' ? -1 : 1), `Moved ${catalog.get(id).title} ${action}.`);
      focusRow(id, action);
    }
  }

  listen(element('playlist-queue'), 'click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (button) editRow(button);
  });
  listen(element('playlist-catalog'), 'click', (event) => {
    const button = event.target.closest('[data-add-song]');
    if (!button || button.disabled) return;
    edit(model.add(ids, button.dataset.addSong), `Added ${catalog.get(button.dataset.addSong).title}.`);
    focusRow(button.dataset.addSong, 'play');
  });
  listen(element('playlist-play'), 'click', () => selectVideo(ids[0], true));
  listen(element('playlist-clear'), 'click', () => {
    edit([], 'Cleared your playlist.');
    element('playlist-undo').focus();
  });
  listen(element('playlist-undo'), 'click', () => {
    ids = previous;
    previous = null;
    render();
    save('Undid the last change.');
    element('playlist-load').focus();
  });
  const selectedDefault = () => defaults.find((item) => item.id === element('playlist-preset').value);
  listen(element('playlist-preset'), 'change', () => {
    element('playlist-preset-description').textContent = selectedDefault().description;
  });
  listen(element('playlist-load'), 'click', () => {
    const preset = selectedDefault();
    continuePlaylist = false;
    player.clear();
    current = null;
    edit(model.restore(null, catalogIds, preset.songs), `Loaded ${preset.title}.`);
  });
  const quizCheckbox = element('playlist-quiz-pause');
  function restoreQuizPreference() {
    quizCheckbox.checked = preferences.quizPause();
    player.configure({ quizPause: quizCheckbox.checked });
  }
  listen(quizCheckbox, 'change', () => {
    player.configure({ quizPause: quizCheckbox.checked });
    const saved = preferences.saveQuizPause(quizCheckbox.checked);
    announce(`Quiz pauses ${quizCheckbox.checked ? 'enabled' : 'disabled'}.${saved ? '' : ' Your browser could not save this preference; it applies for this visit.'}`);
  });
  const avatarSwitch = element('playlist-random-avatar');
  function restoreAvatarPreference() {
    avatarSwitch.checked = preferences.randomAvatar();
    player.configure({ randomAvatar: avatarSwitch.checked });
  }
  listen(avatarSwitch, 'change', () => {
    player.configure({ randomAvatar: avatarSwitch.checked });
    const saved = preferences.saveRandomAvatar(avatarSwitch.checked);
    announce(`Random avatar ${avatarSwitch.checked ? 'on' : 'off'}.${saved ? '' : ' Your browser could not save this preference; it applies for this visit.'}`);
  });
  reorder = window.SongPlaylistReorder.bind({
    list: element('playlist-queue'), signal: events.signal,
    onMove: (id, index) => {
      edit(model.move(ids, id, index - ids.indexOf(id)), `Moved ${catalog.get(id).title} to position ${index + 1}.`);
      focusRow(id, 'play');
    },
  });
  restoreQuizPreference();
  restoreAvatarPreference();
  listen(window, 'storage', (event) => {
    if (event.key === preferences.QUIZ_PAUSE_KEY || event.key === null) restoreQuizPreference();
    if (event.key === preferences.RANDOM_AVATAR_KEY || event.key === null) restoreAvatarPreference();
    if (event.key !== preferences.PLAYLIST_KEY && event.key !== null) return;
    ids = model.restore(preferences.playlist(), catalogIds, defaults[0]?.songs ?? catalogIds);
    previous = null;
    render();
    announce('Playlist updated from browser storage.');
  });
  listen(window, 'pagehide', (event) => { if (!event.persisted) events.abort(); });
  element('playlist-load').disabled = defaults.length === 0;
  render();
})();
