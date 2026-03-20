(function () {
  var COOKIE_NAME = 'se-deck';
  var COOKIE_DAYS = 365;
  var ACTIVE_COOKIE = 'se-deck-active';

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
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

  function getDeck() {
    var raw = getCookie(COOKIE_NAME);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch (e) { return []; }
  }

  function saveDeck(deck) {
    setCookie(COOKIE_NAME, JSON.stringify(deck), COOKIE_DAYS);
  }

  function isInDeck(type, id) {
    return getDeck().some(function (item) { return item.type === type && item.id === id; });
  }

  function addToDeck(type, id) {
    var deck = getDeck();
    if (!deck.some(function (item) { return item.type === type && item.id === id; })) {
      deck.push({ type: type, id: id });
      saveDeck(deck);
    }
  }

  function removeFromDeck(type, id) {
    var deck = getDeck().filter(function (item) { return !(item.type === type && item.id === id); });
    saveDeck(deck);
  }

  function toggleDeck(type, id) {
    if (isInDeck(type, id)) {
      removeFromDeck(type, id);
      return false;
    } else {
      addToDeck(type, id);
      return true;
    }
  }

  // ==================== Performance Tracking ====================

  var PERF_COOKIE = 'analyze-performance';
  var STATS_KEY = 'se-deck-stats';

  function isPersonalDeckActive() {
    return getCookie(ACTIVE_COOKIE) === 'true';
  }

  function setPersonalDeckActive(value) {
    setCookie(ACTIVE_COOKIE, value ? 'true' : 'false', COOKIE_DAYS);
  }

  function clearDeck() {
    setCookie(COOKIE_NAME, '[]', COOKIE_DAYS);
  }

  function isAnalyzePerformance() {
    return getCookie(PERF_COOKIE) === 'true';
  }

  function setAnalyzePerformance(value) {
    setCookie(PERF_COOKIE, value ? 'true' : 'false', COOKIE_DAYS);
  }

  function hashQuestion(html) {
    // Strip HTML tags and normalize whitespace for stable hashing
    var clean = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    var hash = 2166136261; // FNV-1a offset basis
    for (var i = 0; i < clean.length; i++) {
      hash ^= clean.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(36);
  }

  function getStats() {
    try {
      var raw = localStorage.getItem(STATS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) { /* localStorage full or unavailable */ }
  }

  function clearStats() {
    try { localStorage.removeItem(STATS_KEY); } catch (e) { /* ignore */ }
  }

  function recordResult(questionHtml, correct) {
    if (!isAnalyzePerformance()) return;
    var h = hashQuestion(questionHtml);
    var stats = getStats();
    if (!stats[h]) stats[h] = { seen: 0, correct: 0 };
    stats[h].seen++;
    if (correct) stats[h].correct++;
    saveStats(stats);
  }

  function getQuestionStats(questionHtml) {
    var h = hashQuestion(questionHtml);
    var stats = getStats();
    return stats[h] || null;
  }

  window.PersonalDeck = {
    getDeck: getDeck,
    saveDeck: saveDeck,
    isInDeck: isInDeck,
    addToDeck: addToDeck,
    removeFromDeck: removeFromDeck,
    toggleDeck: toggleDeck,
    isPersonalDeckActive: isPersonalDeckActive,
    setPersonalDeckActive: setPersonalDeckActive,
    clearDeck: clearDeck,
    isAnalyzePerformance: isAnalyzePerformance,
    setAnalyzePerformance: setAnalyzePerformance,
    hashQuestion: hashQuestion,
    getStats: getStats,
    saveStats: saveStats,
    clearStats: clearStats,
    recordResult: recordResult,
    getQuestionStats: getQuestionStats
  };
})();
