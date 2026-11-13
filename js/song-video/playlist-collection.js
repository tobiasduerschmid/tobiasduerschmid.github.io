/* Named playlists and migration. No browser or persistence dependencies. */
(function () {
  'use strict';
  const cleanSongs = (songs, catalog) => [...new Set((Array.isArray(songs) ? songs : []).filter(id => catalog.includes(id)))];
  function restore(saved, catalog, defaults, name = 'My playlist') {
    if (saved?.version === 2 && Array.isArray(saved.playlists)) {
      const seen = new Set();
      const playlists = saved.playlists.filter(item => {
        if (!item || typeof item.id !== 'string' || !item.id || seen.has(item.id) || typeof item.name !== 'string' || !item.name.trim()) return false;
        seen.add(item.id);
        return true;
      }).map(item => ({ id: item.id, name: item.name.trim().slice(0, 60), songs: cleanSongs(item.songs, catalog) }));
      if (playlists.length) return { version: 2, activeId: playlists.some(item => item.id === saved.activeId) ? saved.activeId : playlists[0].id, playlists };
    }
    const songs = saved?.version === 1 && Array.isArray(saved.songs) ? saved.songs : defaults;
    return { version: 2, activeId: 'default', playlists: [{ id: 'default', name, songs: cleanSongs(songs, catalog) }] };
  }
  const current = collection => collection.playlists.find(item => item.id === collection.activeId);
  const update = (collection, change) => ({ ...collection, playlists: collection.playlists.map(item => item.id === collection.activeId ? { ...item, ...change } : item) });
  const select = (collection, id) => collection.playlists.some(item => item.id === id) ? { ...collection, activeId: id } : collection;
  function create(collection, id, name) {
    return { ...collection, activeId: id, playlists: [...collection.playlists, { id, name, songs: [] }] };
  }
  function remove(collection) {
    if (collection.playlists.length === 1) return collection;
    const playlists = collection.playlists.filter(item => item.id !== collection.activeId);
    return { ...collection, playlists, activeId: playlists[0].id };
  }
  const api = { restore, current, update, select, create, remove };
  if (typeof module !== 'undefined') module.exports = api;
  else window.SongPlaylistCollection = api;
})();
