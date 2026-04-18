(function () {
  var COOKIE_NAME = 'se-gym';
  var COOKIE_DAYS = 365;
  var ACTIVE_COOKIE = 'se-gym-active';

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

  function getGym() {
    var raw = getCookie(COOKIE_NAME);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch (e) { return []; }
  }

  function saveGym(gym) {
    setCookie(COOKIE_NAME, JSON.stringify(gym), COOKIE_DAYS);
  }

  function isInGym(type, id) {
    return getGym().some(function (item) { return item.type === type && item.id === id; });
  }

  function addToGym(type, id) {
    var gym = getGym();
    if (!gym.some(function (item) { return item.type === type && item.id === id; })) {
      gym.push({ type: type, id: id });
      saveGym(gym);
    }
  }

  function removeFromGym(type, id) {
    var gym = getGym().filter(function (item) { return !(item.type === type && item.id === id); });
    saveGym(gym);
  }

  function toggleGym(type, id) {
    if (isInGym(type, id)) {
      removeFromGym(type, id);
      return false;
    } else {
      addToGym(type, id);
      return true;
    }
  }

  // ==================== Performance Tracking ====================

  var PERF_COOKIE = 'analyze-performance';
  var STATS_KEY = 'se-gym-stats';

  function isPersonalGymActive() {
    return getCookie(ACTIVE_COOKIE) === 'true';
  }

  function setPersonalGymActive(value) {
    setCookie(ACTIVE_COOKIE, value ? 'true' : 'false', COOKIE_DAYS);
  }

  function clearGym() {
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

  function recordResult(key, correct) {
    if (!isAnalyzePerformance()) return;
    var stats = getStats();
    if (!stats[key]) stats[key] = { seen: 0, correct: 0 };
    stats[key].seen++;
    if (correct) stats[key].correct++;
    saveStats(stats);
  }

  function getQuestionStats(key) {
    var stats = getStats();
    return stats[key] || null;
  }

  window.PersonalGym = {
    getGym: getGym,
    saveGym: saveGym,
    isInGym: isInGym,
    addToGym: addToGym,
    removeFromGym: removeFromGym,
    toggleGym: toggleGym,
    isPersonalGymActive: isPersonalGymActive,
    setPersonalGymActive: setPersonalGymActive,
    clearGym: clearGym,
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
