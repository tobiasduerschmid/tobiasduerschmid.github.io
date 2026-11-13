/* Render playlist editing; order rules, persistence, and media messaging live separately. */
(function () {
  'use strict';

  const root = document.getElementById('song-playlist');
  const element = (id) => root.querySelector(`#${id}`);
  const model = window.SongPlaylistModel;
  const preferences = window.SongPreferences;
  const collections = window.SongPlaylistCollection;
  const defaults = JSON.parse(document.getElementById('playlist-defaults').textContent);
  const catalog = new Map(Array.from(root.querySelectorAll('[data-song-id]'), (item) => [
    item.dataset.songId,
    { id: item.dataset.songId, title: item.dataset.title, shortTitle: item.dataset.shortTitle, topic: item.dataset.topic,
      thumbnail: item.querySelector('img')?.src,
      player: item.dataset.player, duration: Number(item.dataset.duration), credit: item.dataset.credit },
  ]));
  const catalogIds = [...catalog.keys()];
  const events = new AbortController();
  const restoreCollection = () => collections.restore(preferences.playlist(), catalogIds, defaults[0]?.songs ?? catalogIds, defaults[0]?.title || 'My playlist');
  let collection = restoreCollection();
  let ids = collections.current(collection).songs;
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
    element('playlist-current-title').textContent = song.shortTitle;
    element('playlist-current-topic').textContent = song.topic;
    element('playlist-player-empty').hidden = true;
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
      element('playlist-player-empty').hidden = false;
      element('playlist-current-topic').textContent = '';
      element('playlist-current-title').textContent = 'Choose a video from your playlist.';
    }
  }

  function createRow(id, index) {
    const row = element('playlist-row').content.firstElementChild.cloneNode(true);
    const song = catalog.get(id);
    const title = song.title;
    row.dataset.id = id;
    row.querySelector('.song-playlist-item-title').textContent = song.shortTitle;
    row.querySelector('.playlist-track-topic').textContent = song.topic;
    if (song.thumbnail) row.querySelector('img').src = song.thumbnail;
    else row.querySelector('img').hidden = true;
    row.querySelector('.playlist-track-duration').textContent = `${Math.floor(song.duration / 60)}:${String(Math.floor(song.duration % 60)).padStart(2, '0')}`;
    row.querySelector('summary').setAttribute('aria-label', `Options: ${title}`);
    for (const button of row.querySelectorAll('button')) {
      button.setAttribute('aria-label', `${button.dataset.action === 'play' ? 'Play' : button.textContent}: ${title}`);
      button.disabled = (button.dataset.action === 'up' && index === 0)
        || (button.dataset.action === 'down' && index === ids.length - 1);
    }
    return row;
  }

  function render() {
    reorder?.cancel();
    ids = collections.current(collection).songs;
    element('playlist-select').replaceChildren(...collection.playlists.map(item => {
      const option = document.createElement('option');
      option.value = item.id; option.textContent = item.name; option.selected = item.id === collection.activeId;
      return option;
    }));
    element('playlist-delete').disabled = collection.playlists.length === 1;
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
    const saved = preferences.savePlaylistCollection(collection);
    announce(`${message} ${saved ? 'Saved in this browser.' : 'Changes are kept for this visit only; your browser could not save them.'}`);
  }

  function edit(next, message) {
    commitCollection(collections.update(collection, { songs: next }), message);
  }

  function commitCollection(next, message) {
    previous = collection;
    collection = next;
    render();
    save(message);
  }

  function focusRow(id, action) {
    const row = Array.from(element('playlist-queue').children).find((item) => item.dataset.id === id);
    const preferred = row?.querySelector(`[data-action="${action}"]`);
    const target = preferred && !preferred.disabled ? preferred : row?.querySelector('[data-action="play"]');
    if (target) {
      const menu = target.closest('details');
      if (menu) menu.open = true;
      target.focus();
    } else element('playlist-new').focus();
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
    // Keep the reader's place in the library when building a mix.
    button.closest('li').querySelector('a').focus({ preventScroll: true });
  });
  listen(element('playlist-play'), 'click', () => selectVideo(ids[0], true));
  listen(element('playlist-clear'), 'click', () => {
    edit([], 'Cleared your playlist.');
    element('playlist-undo').focus();
  });
  listen(element('playlist-undo'), 'click', () => {
    const changedPlaylist = collection.activeId !== previous.activeId;
    collection = previous;
    if (changedPlaylist) resetPlayer();
    previous = null;
    render();
    save('Undid the last change.');
    element('playlist-select').focus();
  });
  const selectedDefault = () => defaults.find((item) => item.id === element('playlist-preset').value);
  listen(element('playlist-preset'), 'change', () => {
    element('playlist-preset-description').textContent = selectedDefault().description;
  });
  listen(element('playlist-load'), 'click', () => {
    const preset = selectedDefault();
    resetPlayer();
    edit(model.restore(null, catalogIds, preset.songs), `Loaded ${preset.title}.`);
  });
  function resetPlayer() {
    continuePlaylist = false;
    player.clear();
    current = null;
  }

  listen(element('playlist-select'), 'change', () => {
    resetPlayer();
    collection = collections.select(collection, element('playlist-select').value);
    previous = null;
    render();
    save(`Selected ${collections.current(collection).name}.`);
  });
  const dialog = element('playlist-name-dialog');
  let naming = 'create';
  let dialogOpener = null;
  function openNameDialog(mode, opener) {
    naming = mode;
    dialogOpener = opener;
    element('playlist-dialog-title').textContent = mode === 'create' ? 'New playlist' : 'Rename playlist';
    element('playlist-dialog-save').textContent = mode === 'create' ? 'Create playlist' : 'Save name';
    element('playlist-name').value = mode === 'create' ? '' : collections.current(collection).name;
    element('playlist-name-error').textContent = '';
    dialog.showModal();
    element('playlist-name').focus();
  }
  listen(element('playlist-new'), 'click', () => openNameDialog('create', element('playlist-new')));
  listen(element('playlist-rename'), 'click', () => openNameDialog('rename', element('playlist-select')));
  listen(element('playlist-dialog-cancel'), 'click', () => dialog.close());
  listen(dialog, 'close', () => dialogOpener?.focus());
  listen(element('playlist-name-form'), 'submit', (event) => {
    event.preventDefault();
    const name = element('playlist-name').value.trim();
    const duplicate = collection.playlists.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase() && (naming === 'create' || item.id !== collection.activeId));
    if (!name || duplicate) {
      element('playlist-name-error').textContent = !name ? 'Enter a playlist name.' : 'A playlist with this name already exists. Choose another name.';
      element('playlist-name').focus();
      return;
    }
    if (naming === 'create') {
      resetPlayer();
      commitCollection(collections.create(collection, crypto.randomUUID(), name), `Created ${name}. Add videos from the library below.`);
    } else commitCollection(collections.update(collection, { name }), `Renamed playlist to ${name}.`);
    dialogOpener = element('playlist-select');
    dialog.close();
  });
  listen(element('playlist-delete'), 'click', () => {
    const name = collections.current(collection).name;
    resetPlayer();
    commitCollection(collections.remove(collection), `Deleted ${name}. Use Undo change to restore it.`);
    element('playlist-undo').focus();
  });
  listen(element('playlist-catalog'), 'click', (event) => {
    const link = event.target.closest('[data-preview-song]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const id = link.dataset.previewSong;
    if (!ids.includes(id)) edit(model.add(ids, id), `Added ${catalog.get(id).title}.`);
    selectVideo(id, true);
    root.querySelector('.song-playlist-watch').scrollIntoView({ block: 'start' });
    element('playlist-frame').focus({ preventScroll: true });
  });
  // Native disclosures retain normal Tab/Enter behavior; Escape dismisses actions.
  listen(root, 'keydown', (event) => {
    if (event.key !== 'Escape') return;
    const menu = event.target.closest('.playlist-menu[open]');
    if (menu) { menu.open = false; menu.querySelector('summary').focus(); event.preventDefault(); }
  });
  listen(document, 'click', (event) => {
    if (!event.target.isConnected) return;
    for (const menu of root.querySelectorAll('.playlist-menu[open]')) {
      if (!menu.contains(event.target) || event.target.closest('button')) menu.open = false;
    }
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
  window.SongPlaylistLibrary.bind({ root, signal: events.signal });
  restoreQuizPreference();
  restoreAvatarPreference();
  listen(window, 'storage', (event) => {
    if (event.key === preferences.QUIZ_PAUSE_KEY || event.key === null) restoreQuizPreference();
    if (event.key === preferences.RANDOM_AVATAR_KEY || event.key === null) restoreAvatarPreference();
    if (event.key !== preferences.PLAYLIST_KEY && event.key !== null) return;
    collection = restoreCollection();
    resetPlayer();
    previous = null;
    render();
    announce('Playlist updated from browser storage.');
  });
  listen(window, 'pagehide', (event) => { if (!event.persisted) events.abort(); });
  element('playlist-load').disabled = defaults.length === 0;
  render();
})();
