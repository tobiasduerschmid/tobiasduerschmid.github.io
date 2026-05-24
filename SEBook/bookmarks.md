---
title: Bookmarks
layout: sebook
---


<div id="bookmarks-app">
  <p class="bookmarks-intro">Bookmark SEBook pages for quick access. Enable bookmarks below, then use the <i class="fa-regular fa-bookmark"></i> icon on any SEBook page to save it here.</p>

  <div class="bookmarks-controls">
    <div class="bookmarks-toggle-row">
      <span class="bookmarks-info">
        <span class="toggle-label">Activate Bookmarks</span>
        <button type="button" class="bookmarks-info-btn" aria-expanded="false" aria-label="Info about bookmarks">?<span class="bookmarks-info-tooltip">When activated, a bookmark icon appears in the toolbar of every SEBook page. Click it to add or remove the page from your bookmarks list. Bookmarks are stored in a local browser cookie and are not shared with any server.</span></button>
      </span>
      <label class="switch">
        <span class="sr-only">Toggle bookmarks activation</span>
        <input type="checkbox" id="activateBookmarksToggle" aria-label="Toggle bookmarks activation">
        <span class="slider round"></span>
      </label>
    </div>
  </div>

  <div id="bookmarks-list-section" class="is-hidden">
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
      noMsg.classList.remove('is-hidden');
      return;
    }
    noMsg.classList.add('is-hidden');
    bookmarks.forEach(function (b) {
      var item = document.createElement('div');
      item.className = 'bookmark-item';

      var link = document.createElement('a');
      link.href = b.url;
      link.innerHTML = '<i class="fa-solid fa-bookmark bookmark-item-icon"></i>' + escapeHtml(b.title);

      var removeBtn = document.createElement('button');
      removeBtn.className = 'bookmark-remove-btn';
      removeBtn.setAttribute('data-original-title', 'Remove bookmark');
      removeBtn.setAttribute('aria-label', 'Remove bookmark for ' + escapeHtml(b.title));
      removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      removeBtn.addEventListener('click', function () {
        if (!window.confirm('Remove bookmark for ' + b.title + '?')) return;
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

    document.querySelectorAll('.bookmarks-info-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var open = !btn.classList.contains('active');
        document.querySelectorAll('.bookmarks-info-btn.active').forEach(function (other) {
          other.classList.remove('active');
          other.setAttribute('aria-expanded', 'false');
        });
        btn.classList.toggle('active', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      btn.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' || event.keyCode === 27) {
          btn.classList.remove('active');
          btn.setAttribute('aria-expanded', 'false');
          btn.focus();
        }
      });
    });

    var active = SEBookmarks.isBookmarksActive();
    toggle.checked = active;
    if (active) {
      listSection.classList.remove('is-hidden');
      renderBookmarks(listContainer, noMsg);
    }

    toggle.addEventListener('change', function () {
      SEBookmarks.setBookmarksActive(this.checked);
      listSection.classList.toggle('is-hidden', !this.checked);
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
