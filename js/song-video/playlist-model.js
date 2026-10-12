/* Ordered, unique song IDs. No DOM, media, or browser-storage dependencies. */
(function () {
  'use strict';

  function availableSongs(ids, catalogIds) {
    return [...new Set(ids.filter((id) => catalogIds.includes(id)))];
  }

  /** Missing/malformed storage uses the default; a deliberately empty list stays empty. */
  function restore(saved, catalogIds, defaults) {
    const ids = saved?.version === 1 && Array.isArray(saved.songs) ? saved.songs : defaults;
    return availableSongs(ids, catalogIds);
  }

  function add(ids, id) {
    return ids.includes(id) ? [...ids] : [...ids, id];
  }

  function move(ids, id, offset) {
    const from = ids.indexOf(id);
    const to = from + offset;
    const result = [...ids];
    if (from < 0 || to < 0 || to >= ids.length) return result;
    result.splice(from, 1);
    result.splice(to, 0, id);
    return result;
  }

  function remove(ids, id) {
    return ids.filter((candidate) => candidate !== id);
  }

  function neighbor(ids, current, offset) {
    const index = ids.indexOf(current);
    return index < 0 ? null : ids[index + offset] ?? null;
  }

  const next = (ids, current) => neighbor(ids, current, 1);
  const previous = (ids, current) => neighbor(ids, current, -1);
  const api = { restore, add, move, remove, next, previous };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.SongPlaylistModel = api;
})();
