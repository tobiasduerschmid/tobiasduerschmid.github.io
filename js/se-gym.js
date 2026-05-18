(function () {
  var COOKIE_NAME = 'se-gym';
  var COOKIE_DAYS = 365;
  var ACTIVE_COOKIE = 'se-gym-active';
  var TIMED_PRACTICE_COOKIE = 'se-gym-timed-practice';
  var TIMED_MODE_COOKIE = 'se-gym-timer-mode';
  var TIMED_TOTAL_MINUTES_COOKIE = 'se-gym-timer-total-minutes';
  var TIMED_SECONDS_PER_QUESTION_COOKIE = 'se-gym-timer-seconds-per-question';
  var SHOW_DIFFICULTY_COOKIE = 'se-gym-show-difficulty';
  var SHOW_WORKOUT_HERO_COOKIE = 'se-gym-show-workout-hero';
  var ACTIVE_DIFFICULTIES_COOKIE = 'se-gym-active-difficulties';
  var DEFAULT_TIMED_TOTAL_MINUTES = 20;
  var DEFAULT_TIMED_SECONDS_PER_QUESTION = 60;
  var DIFFICULTY_LEVELS = ['basic', 'intermediate', 'advanced', 'expert'];

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

  function boundedNumber(value, fallback, min, max) {
    var parsed = parseInt(value, 10);
    if (!isFinite(parsed)) parsed = fallback;
    if (parsed < min) return min;
    if (parsed > max) return max;
    return parsed;
  }

  function normalizeTimedMode(value) {
    return value === 'per-question' ? 'per-question' : 'total';
  }

  function isTimedPractice() {
    return getCookie(TIMED_PRACTICE_COOKIE) === 'true';
  }

  function setTimedPractice(value) {
    setCookie(TIMED_PRACTICE_COOKIE, value ? 'true' : 'false', COOKIE_DAYS);
  }

  function getTimedPracticeMode() {
    return normalizeTimedMode(getCookie(TIMED_MODE_COOKIE));
  }

  function setTimedPracticeMode(value) {
    setCookie(TIMED_MODE_COOKIE, normalizeTimedMode(value), COOKIE_DAYS);
  }

  function getTimedPracticeTotalMinutes() {
    return boundedNumber(getCookie(TIMED_TOTAL_MINUTES_COOKIE), DEFAULT_TIMED_TOTAL_MINUTES, 1, 600);
  }

  function setTimedPracticeTotalMinutes(value) {
    setCookie(TIMED_TOTAL_MINUTES_COOKIE, String(boundedNumber(value, DEFAULT_TIMED_TOTAL_MINUTES, 1, 600)), COOKIE_DAYS);
  }

  function getTimedPracticeSecondsPerQuestion() {
    return boundedNumber(getCookie(TIMED_SECONDS_PER_QUESTION_COOKIE), DEFAULT_TIMED_SECONDS_PER_QUESTION, 1, 3600);
  }

  function setTimedPracticeSecondsPerQuestion(value) {
    setCookie(TIMED_SECONDS_PER_QUESTION_COOKIE, String(boundedNumber(value, DEFAULT_TIMED_SECONDS_PER_QUESTION, 1, 3600)), COOKIE_DAYS);
  }

  function isAnalyzePerformance() {
    return getCookie(PERF_COOKIE) === 'true';
  }

  function setAnalyzePerformance(value) {
    setCookie(PERF_COOKIE, value ? 'true' : 'false', COOKIE_DAYS);
  }

  function isShowDifficulty() {
    // Default: hidden during the question. Solution panels always show it.
    return getCookie(SHOW_DIFFICULTY_COOKIE) === 'true';
  }

  function setShowDifficulty(value) {
    setCookie(SHOW_DIFFICULTY_COOKIE, value ? 'true' : 'false', COOKIE_DAYS);
  }

  function isShowWorkoutHero() {
    // Default: keep workout cards visually focused. Desktop side heroes are opt-in.
    return getCookie(SHOW_WORKOUT_HERO_COOKIE) === 'true';
  }

  function setShowWorkoutHero(value) {
    setCookie(SHOW_WORKOUT_HERO_COOKIE, value ? 'true' : 'false', COOKIE_DAYS);
  }

  function normalizeDifficultyList(list) {
    if (!Array.isArray(list)) return [];
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var v = String(list[i] || '').toLowerCase();
      if (DIFFICULTY_LEVELS.indexOf(v) !== -1 && !seen[v]) {
        seen[v] = true;
        out.push(v);
      }
    }
    return out;
  }

  // Returns the set of difficulty levels the user wants to test in the next
  // workout. Default (cookie unset) = all four. Setting it to a subset is
  // how learners narrow a workout to e.g. just "advanced + expert" cards.
  // Cards without a difficulty are unaffected — those always run.
  function getActiveDifficulties() {
    var raw = getCookie(ACTIVE_DIFFICULTIES_COOKIE);
    if (raw == null) return DIFFICULTY_LEVELS.slice();
    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return DIFFICULTY_LEVELS.slice();
      return normalizeDifficultyList(parsed);
    } catch (e) { return DIFFICULTY_LEVELS.slice(); }
  }

  function setActiveDifficulties(list) {
    var normalized = normalizeDifficultyList(list);
    setCookie(ACTIVE_DIFFICULTIES_COOKIE, JSON.stringify(normalized), COOKIE_DAYS);
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
    isTimedPractice: isTimedPractice,
    setTimedPractice: setTimedPractice,
    getTimedPracticeMode: getTimedPracticeMode,
    setTimedPracticeMode: setTimedPracticeMode,
    getTimedPracticeTotalMinutes: getTimedPracticeTotalMinutes,
    setTimedPracticeTotalMinutes: setTimedPracticeTotalMinutes,
    getTimedPracticeSecondsPerQuestion: getTimedPracticeSecondsPerQuestion,
    setTimedPracticeSecondsPerQuestion: setTimedPracticeSecondsPerQuestion,
    isAnalyzePerformance: isAnalyzePerformance,
    setAnalyzePerformance: setAnalyzePerformance,
    isShowDifficulty: isShowDifficulty,
    setShowDifficulty: setShowDifficulty,
    isShowWorkoutHero: isShowWorkoutHero,
    setShowWorkoutHero: setShowWorkoutHero,
    getActiveDifficulties: getActiveDifficulties,
    setActiveDifficulties: setActiveDifficulties,
    DIFFICULTY_LEVELS: DIFFICULTY_LEVELS,
    hashQuestion: hashQuestion,
    getStats: getStats,
    saveStats: saveStats,
    clearStats: clearStats,
    recordResult: recordResult,
    getQuestionStats: getQuestionStats
  };
})();
