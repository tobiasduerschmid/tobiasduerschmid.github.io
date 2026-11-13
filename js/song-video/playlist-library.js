/* Search and categories narrow the complete library, never playlist membership. */
(function () {
  'use strict';
  function bind({ root, signal }) {
    const search = root.querySelector('#playlist-search');
    const buttons = [...root.querySelectorAll('[data-category-filter]')];
    const cards = [...root.querySelectorAll('[data-song-id]')];
    let category = '';
    function render() {
      const query = search.value.trim().toLocaleLowerCase();
      let count = 0;
      for (const card of cards) {
        const matches = (!category || card.dataset.category === category)
          && `${card.dataset.title} ${card.dataset.topic} ${card.dataset.category}`.toLocaleLowerCase().includes(query);
        card.hidden = !matches;
        if (matches) count++;
      }
      for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.categoryFilter === category));
      root.querySelector('#playlist-library-count').textContent = `${count} of ${cards.length} videos`;
      root.querySelector('#playlist-no-results').hidden = count > 0;
    }
    search.addEventListener('input', render, { signal });
    for (const button of buttons) button.addEventListener('click', () => { category = button.dataset.categoryFilter; render(); }, { signal });
    root.querySelector('#playlist-reset-search').addEventListener('click', () => { category = ''; search.value = ''; render(); search.focus(); }, { signal });
    render();
  }
  window.SongPlaylistLibrary = { bind };
})();
