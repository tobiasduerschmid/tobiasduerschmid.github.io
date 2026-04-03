---
title: Bookmarks
layout: sebook
---

<style>
  #bookmarks-app {
    max-width: 700px;
    margin: 0 auto;
    padding: 0 0 40px 0;
  }

  .bookmarks-controls {
    background: #f8f9fa;
    border: 1px solid #e1e4e8;
    border-radius: 10px;
    padding: 16px;
    margin-bottom: 24px;
  }

  .bookmarks-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .bookmarks-info {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  /* Info button & tooltip (matches se-gym styles) */
  .bookmarks-info-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #888;
    color: #fff;
    font-size: 0.75em;
    font-weight: 700;
    cursor: pointer;
    position: relative;
    user-select: none;
    margin-left: 4px;
    flex-shrink: 0;
  }

  .bookmarks-info-btn:hover,
  .bookmarks-info-btn:focus {
    background: #555;
    outline: none;
  }

  .bookmarks-info-tooltip {
    display: none;
    position: absolute;
    left: -20px;
    top: calc(100% + 8px);
    background: #333;
    color: #fff;
    font-size: 1.2em;
    font-weight: 400;
    padding: 8px 12px;
    border-radius: 6px;
    width: 260px;
    max-width: 85vw;
    line-height: 1.4;
    z-index: 100;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }

  .bookmarks-info-tooltip::after {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 24px;
    border: 6px solid transparent;
    border-bottom-color: #333;
  }

  .bookmarks-info-btn:hover .bookmarks-info-tooltip,
  .bookmarks-info-btn:focus .bookmarks-info-tooltip {
    display: block;
  }

  #bookmarks-list-section h2 {
    color: #2774AE;
    font-weight: 700;
    border-bottom: 2px solid #e1e4e8;
    padding-bottom: 8px;
    margin-bottom: 16px;
    -webkit-text-stroke: 0;
  }

  .bookmark-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border: 1px solid #e1e4e8;
    border-radius: 8px;
    margin-bottom: 10px;
    background: #fff;
    transition: background 0.2s;
  }

  .bookmark-item:hover {
    background: #f6f8fa;
  }

  .bookmark-item a {
    color: #2774AE;
    text-decoration: none;
    font-weight: 500;
    flex: 1;
  }

  .bookmark-item a:hover {
    text-decoration: underline;
  }

  .bookmark-remove-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #999;
    font-size: 1em;
    padding: 2px 6px;
    border-radius: 4px;
    transition: color 0.2s, background 0.2s;
    margin-left: 12px;
    flex-shrink: 0;
  }

  .bookmark-remove-btn:hover {
    color: #c0392b;
    background: #ffeef0;
  }

  #no-bookmarks-msg {
    color: #666;
    font-style: italic;
    margin: 0;
  }

  html.dark-mode .bookmarks-controls {
    background: #1e2a35;
    border-color: #3a4a5a;
  }

  html.dark-mode .bookmarks-info-btn {
    background: #666;
  }

  html.dark-mode .bookmarks-info-btn:hover,
  html.dark-mode .bookmarks-info-btn:focus {
    background: #888;
  }

  html.dark-mode .bookmark-item {
    background: #1e2a35;
    border-color: #3a4a5a;
  }

  html.dark-mode .bookmark-item:hover {
    background: #25343f;
  }

  html.dark-mode #no-bookmarks-msg {
    color: #aaa;
  }

  html.dark-mode #bookmarks-list-section h2 {
    border-bottom-color: #3a4a5a;
  }
</style>

<div id="bookmarks-app">
  <p style="color:#666; margin-bottom:20px;">Bookmark SEBook pages for quick access. Enable bookmarks below, then use the <i class="fa-regular fa-bookmark"></i> icon on any SEBook page to save it here.</p>

  <div class="bookmarks-controls">
    <div class="bookmarks-toggle-row">
      <span class="bookmarks-info">
        <span class="toggle-label">Activate Bookmarks</span>
        <span class="bookmarks-info-btn" tabindex="0" aria-label="Info about bookmarks">?<span class="bookmarks-info-tooltip">When activated, a bookmark icon appears in the toolbar of every SEBook page. Click it to add or remove the page from your bookmarks list. Bookmarks are stored in a local browser cookie and are not shared with any server.</span></span>
      </span>
      <label class="switch">
        <input type="checkbox" id="activateBookmarksToggle" aria-label="Toggle bookmarks activation">
        <span class="slider round"></span>
      </label>
    </div>
  </div>

  <div id="bookmarks-list-section" style="display:none;">
    <h2>Your Bookmarks</h2>
    <div id="bookmarks-list">
      <p id="no-bookmarks-msg">No bookmarks yet. Visit any SEBook page and click the <i class="fa-regular fa-bookmark"></i> icon to add a bookmark.</p>
    </div>
  </div>
</div>

<script>
(function () {
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderBookmarks(listContainer, noMsg) {
    var bookmarks = window.SEBookmarks.getBookmarks();
    listContainer.querySelectorAll('.bookmark-item').forEach(function (el) { el.remove(); });
    if (bookmarks.length === 0) {
      noMsg.style.display = '';
      return;
    }
    noMsg.style.display = 'none';
    bookmarks.forEach(function (b) {
      var item = document.createElement('div');
      item.className = 'bookmark-item';

      var link = document.createElement('a');
      link.href = b.url;
      link.innerHTML = '<i class="fa-solid fa-bookmark" style="margin-right:8px; color:#2774AE;"></i>' + escapeHtml(b.title);

      var removeBtn = document.createElement('button');
      removeBtn.className = 'bookmark-remove-btn';
      removeBtn.title = 'Remove bookmark';
      removeBtn.setAttribute('aria-label', 'Remove bookmark for ' + escapeHtml(b.title));
      removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      removeBtn.addEventListener('click', function () {
        window.SEBookmarks.removeBookmark(b.url);
        renderBookmarks(listContainer, noMsg);
      });

      item.appendChild(link);
      item.appendChild(removeBtn);
      listContainer.appendChild(item);
    });
  }

  function init() {
    if (!window.SEBookmarks) return;

    var toggle = document.getElementById('activateBookmarksToggle');
    var listSection = document.getElementById('bookmarks-list-section');
    var listContainer = document.getElementById('bookmarks-list');
    var noMsg = document.getElementById('no-bookmarks-msg');

    if (!toggle || !listSection || !listContainer || !noMsg) return;

    var active = SEBookmarks.isBookmarksActive();
    toggle.checked = active;
    if (active) {
      listSection.style.display = '';
      renderBookmarks(listContainer, noMsg);
    }

    toggle.addEventListener('change', function () {
      SEBookmarks.setBookmarksActive(this.checked);
      listSection.style.display = this.checked ? '' : 'none';
      if (this.checked) renderBookmarks(listContainer, noMsg);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
