(function () {
  var COOKIE_NAME = 'se-bookmarks';
  var ACTIVE_COOKIE = 'se-bookmarks-active';
  var COOKIE_DAYS = 365;

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax;Secure';
  }

  function getCookie(name) {
    var nameEQ = name + '=';
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i].trim();
      if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
    }
    return null;
  }

  function isBookmarksActive() {
    return getCookie(ACTIVE_COOKIE) === 'true';
  }

  function setBookmarksActive(value) {
    setCookie(ACTIVE_COOKIE, value ? 'true' : 'false', COOKIE_DAYS);
  }

  function getBookmarks() {
    var raw = getCookie(COOKIE_NAME);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch (e) { return []; }
  }

  function saveBookmarks(bookmarks) {
    setCookie(COOKIE_NAME, JSON.stringify(bookmarks), COOKIE_DAYS);
  }

  function isBookmarked(url) {
    return getBookmarks().some(function (b) { return b.url === url; });
  }

  function addBookmark(url, title) {
    var bookmarks = getBookmarks();
    if (!bookmarks.some(function (b) { return b.url === url; })) {
      bookmarks.push({ url: url, title: title });
      saveBookmarks(bookmarks);
    }
  }

  function removeBookmark(url) {
    saveBookmarks(getBookmarks().filter(function (b) { return b.url !== url; }));
  }

  function toggleBookmark(url, title) {
    if (isBookmarked(url)) {
      removeBookmark(url);
      return false;
    } else {
      addBookmark(url, title);
      return true;
    }
  }

  window.SEBookmarks = {
    isBookmarksActive: isBookmarksActive,
    setBookmarksActive: setBookmarksActive,
    getBookmarks: getBookmarks,
    isBookmarked: isBookmarked,
    addBookmark: addBookmark,
    removeBookmark: removeBookmark,
    toggleBookmark: toggleBookmark
  };
})();
