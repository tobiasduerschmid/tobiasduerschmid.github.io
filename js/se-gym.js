(function () {
  var COOKIE_NAME = 'se-gym';
  var COOKIE_DAYS = 365;
  var ACTIVE_COOKIE = 'se-gym-active';
  var TIMED_PRACTICE_COOKIE = 'se-gym-timed-practice';

  // ==================== Spaced Repetition constants ====================
  var DAILY_LAST_KEY = 'se-gym-daily-last';   // localStorage: date of last completed Workout of the Day
  var DAY_MS = 86400000;                       // milliseconds in one day
  var SRS_EF_DEFAULT = 2.5;                    // SM-2-lite starting ease factor
  var SRS_EF_MIN = 1.3;                         // SM-2 ease-factor floor
  var SRS_STEP1_DAYS = 1;                       // first interval after a correct answer
  var SRS_STEP2_DAYS = 3;                       // second interval after a correct answer

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

  function normalizeGymEntries(value) {
    if (!Array.isArray(value)) return [];
    var seen = {};
    var out = [];
    value.forEach(function (item) {
      if (!item) return;
      var type = item.type;
      if (type !== 'quiz' && type !== 'flashcard' && type !== 'difficult') return;
      var id = String(item.id || '');
      if (!id) return;
      if (type === 'difficult' && id !== 'difficult') return;
      var key = type + ':' + id;
      if (seen[key]) return;
      seen[key] = true;
      out.push({ type: type, id: id });
    });
    return out;
  }

  function getGym() {
    var raw = getCookie(COOKIE_NAME);
    if (!raw) return [];
    try { return normalizeGymEntries(JSON.parse(raw)); } catch (e) { return []; }
  }

  function saveGym(gym) {
    setCookie(COOKIE_NAME, JSON.stringify(normalizeGymEntries(gym)), COOKIE_DAYS);
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

  function plainObjectStore(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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
    // Default: show desktop side heroes. An explicit "false" cookie opts out.
    return getCookie(SHOW_WORKOUT_HERO_COOKIE) !== 'false';
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

  // ==================== SM-2-lite spaced repetition ====================

  // Pure function: given the prior record (or null for a new card), a
  // correctness flag, and the current time in epoch ms, return the SRS fields
  // to merge back into the stats record. Intervals are in days; due/last in ms.
  function scheduleNext(record, correct, nowMs) {
    var r = record || {};
    var ef = typeof r.ef === 'number' ? r.ef : SRS_EF_DEFAULT;
    var reps = typeof r.reps === 'number' ? r.reps : 0;
    var interval = typeof r.intervalDays === 'number' ? r.intervalDays : 0;
    var lapses = typeof r.lapses === 'number' ? r.lapses : 0;
    if (correct) {
      reps += 1;
      ef += 0.1;
      interval = reps === 1 ? SRS_STEP1_DAYS
        : reps === 2 ? SRS_STEP2_DAYS
          : Math.max(1, Math.round(interval * ef));
    } else {
      reps = 0;
      lapses += 1;
      ef = Math.max(SRS_EF_MIN, ef - 0.2);
      interval = 0; // relearn: due again immediately
    }
    ef = Math.max(SRS_EF_MIN, ef);
    return {
      reps: reps,
      ef: ef,
      intervalDays: interval,
      lapses: lapses,
      due: nowMs + interval * DAY_MS,
      last: nowMs
    };
  }

  // ==================== Workout-of-the-Day date helpers ====================

  function getDailyLast() {
    try { return localStorage.getItem(DAILY_LAST_KEY); } catch (e) { return null; }
  }

  function setDailyLast(value) {
    try { localStorage.setItem(DAILY_LAST_KEY, value); } catch (e) { /* localStorage full or unavailable */ }
  }

  // Today's local date as 'YYYY-MM-DD'.
  function todayStr() {
    var d = new Date();
    var mm = String(d.getMonth() + 1);
    var dd = String(d.getDate());
    if (mm.length < 2) mm = '0' + mm;
    if (dd.length < 2) dd = '0' + dd;
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  function hashQuestion(html) {
    // Strip HTML tags and normalize whitespace for stable hashing
    var clean = String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    var hash = 2166136261; // FNV-1a offset basis
    for (var i = 0; i < clean.length; i++) {
      hash ^= clean.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(36);
  }

  // ==================== Card corpus / canonical stats helpers ====================
  // Aggregate decks preserve sourceDeckId on each card, so stats and mastery roll
  // up to the underlying topic rather than the aggregate "master" deck.
  var MASTERY_PROFICIENT_DAYS = 7;
  var MASTERY_MASTERED_DAYS = 21;
  var DECK_MASTERED_CUTOFF = 0.8;
  var DECK_PROFICIENT_CUTOFF = 0.6;
  var MASTERY_STATE_LABELS = {
    mastered: 'Mastered',
    proficient: 'Proficient',
    learning: 'Learning',
    'not-started': 'Not started'
  };
  var renderedHashNormalizer = null;

  function cardStatsDeckId(deckId, data) {
    return (data && data.sourceDeckId) ? data.sourceDeckId : deckId;
  }

  function cardStatsId(data) {
    return data && data.id != null && data.id !== '' ? data.id : hashQuestion(data && data.question);
  }

  function cardStatsKey(cardType, deckId, data) {
    return cardType + ':' + cardStatsDeckId(deckId, data) + ':' + cardStatsId(data);
  }

  function renderedQuestionHash(html) {
    if (typeof document === 'undefined' || !document.createElement) return hashQuestion(html);
    if (!renderedHashNormalizer) renderedHashNormalizer = document.createElement('div');
    renderedHashNormalizer.innerHTML = html || '';
    return hashQuestion(renderedHashNormalizer.innerHTML);
  }

  function uniqueList(values) {
    var seen = {};
    return values.filter(function (value) {
      if (seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  function cardStatsKeyVariants(cardType, deckId, data) {
    var canonicalDeckId = cardStatsDeckId(deckId, data);
    var idPart = data && data.id != null && data.id !== '' ? data.id : null;
    var hashPart = hashQuestion(data && data.question);
    var renderedHashPart = renderedQuestionHash(data && data.question);
    var variants = [
      cardStatsKey(cardType, deckId, data),
      cardType + ':' + canonicalDeckId + ':' + hashPart,
      cardType + ':' + canonicalDeckId + ':' + renderedHashPart,
      cardType + ':' + deckId + ':' + hashPart,
      cardType + ':' + deckId + ':' + renderedHashPart,
      canonicalDeckId + ':' + hashPart,
      canonicalDeckId + ':' + renderedHashPart,
      deckId + ':' + hashPart,
      deckId + ':' + renderedHashPart
    ];
    if (idPart != null) {
      variants.push(
        cardType + ':' + canonicalDeckId + ':' + idPart,
        cardType + ':' + deckId + ':' + idPart,
        canonicalDeckId + ':' + idPart,
        deckId + ':' + idPart
      );
    }
    return uniqueList(variants);
  }

  function normalizeCardDifficulty(value) {
    var d = value ? String(value).toLowerCase() : '';
    return DIFFICULTY_LEVELS.indexOf(d) !== -1 ? d : 'untagged';
  }

  function nonNegativeInteger(value) {
    var n = typeof value === 'number' ? value : parseInt(value, 10);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.floor(n);
  }

  function statsRecordCounts(record) {
    var seen = nonNegativeInteger(record && record.seen);
    var correct = Math.min(seen, nonNegativeInteger(record && record.correct));
    return { seen: seen, correct: correct };
  }

  function visitCardData(cardData, cb) {
    var data = cardData || {};
    function visit(coll, cardType, listKey) {
      coll = coll || {};
      var ids = Object.keys(coll);
      ids.sort(function (a, b) { return (coll[a].isMaster ? 1 : 0) - (coll[b].isMaster ? 1 : 0); });
      ids.forEach(function (deckId) {
        var deck = coll[deckId] || {};
        (deck[listKey] || []).forEach(function (item) {
          cb({
            cardType: cardType,
            source: deck.title || deckId,
            deckId: deckId,
            data: item,
            key: cardStatsKey(cardType, deckId, item),
            isMaster: !!deck.isMaster
          });
        });
      });
    }
    visit(data.quizzes, 'quiz', 'questions');
    visit(data.flashcards, 'flashcard', 'cards');
  }

  function forEachAvailableCard(cardData, cb) {
    var seen = {};
    visitCardData(cardData, function (card) {
      if (seen[card.key]) return;
      seen[card.key] = true;
      cb(card);
    });
  }

  function addCorpusVariant(index, key, meta) {
    if (!index[key]) index[key] = [];
    if (!index[key].some(function (existing) { return existing.canonicalKey === meta.canonicalKey; })) {
      index[key].push(meta);
    }
  }

  function buildCardCorpus(cardData) {
    var data = cardData || {};
    var index = {};
    var cards = [];
    var seenCards = {};

    function visit(coll, cardType, listKey) {
      coll = coll || {};
      Object.keys(coll).forEach(function (deckId) {
        var deck = coll[deckId] || {};
        (deck[listKey] || []).forEach(function (item) {
          var sourceDeckId = cardStatsDeckId(deckId, item);
          var sourceDeck = coll[sourceDeckId] || deck;
          var canonicalKey = cardType + ':' + sourceDeckId + ':' + cardStatsId(item);
          var meta = {
            canonicalKey: canonicalKey,
            key: canonicalKey,
            deckId: sourceDeckId,
            deckTitle: sourceDeck.title || deck.title || sourceDeckId,
            deckType: cardType,
            cardType: cardType,
            source: sourceDeck.title || deck.title || sourceDeckId,
            isMaster: false,
            questionHtml: item.question,
            difficulty: normalizeCardDifficulty(item.difficulty),
            data: item
          };
          if (!seenCards[canonicalKey]) {
            cards.push(meta);
            seenCards[canonicalKey] = true;
          }
          cardStatsKeyVariants(cardType, deckId, item).forEach(function (key) {
            addCorpusVariant(index, key, meta);
          });
        });
      });
    }

    visit(data.quizzes, 'quiz', 'questions');
    visit(data.flashcards, 'flashcard', 'cards');
    return { cards: cards, index: index };
  }

  function keyInfo(cardData, key) {
    var data = cardData || {};
    var parts = String(key || '').split(':');
    if ((parts[0] === 'quiz' || parts[0] === 'flashcard') && parts.length >= 3) {
      return { deckType: parts[0], deckId: parts[1] };
    }
    var deckId = parts[0];
    return {
      deckType: data.quizzes && data.quizzes[deckId] ? 'quiz' : 'flashcard',
      deckId: deckId
    };
  }

  function addStatsToCanonicalBucket(cardData, buckets, key, record, meta) {
    var counts = statsRecordCounts(record);
    if (!counts.seen) return;
    var canonical = meta ? meta.canonicalKey : key;
    var bucket = buckets[canonical];
    if (!bucket) {
      if (meta) {
        bucket = {
          key: canonical,
          seen: 0,
          correct: 0,
          deckId: meta.deckId,
          deckTitle: meta.deckTitle,
          deckType: meta.deckType,
          cardType: meta.cardType,
          isMaster: meta.isMaster,
          questionHtml: meta.questionHtml,
          difficulty: meta.difficulty
        };
      } else {
        var info = keyInfo(cardData, key);
        var data = cardData || {};
        var deck = info.deckType === 'quiz'
          ? data.quizzes && data.quizzes[info.deckId]
          : data.flashcards && data.flashcards[info.deckId];
        bucket = {
          key: canonical,
          seen: 0,
          correct: 0,
          deckId: info.deckId,
          deckTitle: deck ? deck.title : info.deckId,
          deckType: info.deckType,
          cardType: info.deckType,
          isMaster: false,
          questionHtml: null,
          difficulty: 'untagged'
        };
      }
      buckets[canonical] = bucket;
    }
    bucket.seen += counts.seen;
    bucket.correct += counts.correct;
  }

  // Choose which corpus card a recorded key belongs to. Exactly one match is the
  // normal case (a canonical key, or a content-hash legacy key). More than one
  // means an ambiguous legacy id-key shared by same-named quiz and flashcard
  // decks (e.g. "git:1"): return the card whose canonical key IS the recorded
  // key if present (unambiguous), otherwise null so the caller treats it as an
  // unmatched legacy record instead of double-counting it into every candidate.
  function pickCanonicalMeta(key, metas) {
    if (!metas || !metas.length) return null;
    if (metas.length === 1) return metas[0];
    for (var i = 0; i < metas.length; i++) {
      if (metas[i].canonicalKey === key) return metas[i];
    }
    return null;
  }

  function getCanonicalStatsEntries(cardData, rawStats) {
    var stats = rawStats || getStats();
    var corpus = buildCardCorpus(cardData);
    var byCanonical = {};
    Object.keys(stats).forEach(function (key) {
      var record = stats[key];
      if (!record) return;
      addStatsToCanonicalBucket(cardData, byCanonical, key, record, pickCanonicalMeta(key, corpus.index[key]));
    });
    var allEntries = Object.keys(byCanonical).map(function (canonical) {
      var entry = byCanonical[canonical];
      entry.incorrect = entry.seen - entry.correct;
      entry.acc = entry.seen > 0 ? entry.correct / entry.seen : 0;
      entry.accPct = Math.round(entry.acc * 100);
      return entry;
    });
    return {
      allEntries: allEntries,
      entries: allEntries.filter(function (entry) { return entry.questionHtml != null; }),
      unmatchedEntries: allEntries.filter(function (entry) { return entry.questionHtml == null; }),
      corpus: corpus
    };
  }

  function mergeStatsRecords(current, legacy) {
    var legacyCounts = statsRecordCounts(legacy);
    if (!current) return Object.assign({}, legacy, legacyCounts);
    var currentCounts = statsRecordCounts(current);
    var latest = ((legacy.last || 0) > (current.last || 0)) ? legacy : current;
    var merged = Object.assign({}, latest);
    merged.seen = currentCounts.seen + legacyCounts.seen;
    merged.correct = currentCounts.correct + legacyCounts.correct;
    return merged;
  }

  function migrateStatsKeys(cardData) {
    var stats = getStats();
    var changed = false;
    var transfers = {};
    visitCardData(cardData, function (card) {
      var canonicalKey = card.key;
      cardStatsKeyVariants(card.cardType, card.deckId, card.data).forEach(function (variantKey) {
        if (variantKey === canonicalKey || !stats[variantKey]) return;
        if (!transfers[variantKey]) transfers[variantKey] = [];
        if (transfers[variantKey].indexOf(canonicalKey) === -1) transfers[variantKey].push(canonicalKey);
      });
    });
    Object.keys(transfers).forEach(function (variantKey) {
      // Only migrate a legacy key that maps to exactly one canonical question.
      // Ambiguous id-keys shared by a same-named quiz and flashcard are left in
      // place rather than duplicated into both canonical records; the read path
      // (pickCanonicalMeta) then reports them under "older records".
      var targets = transfers[variantKey];
      if (targets.length !== 1) return;
      stats[targets[0]] = mergeStatsRecords(stats[targets[0]], stats[variantKey]);
      delete stats[variantKey];
      changed = true;
    });
    if (changed) saveStats(stats);
  }

  function classifyMasteryStats(record) {
    if (!statsRecordCounts(record).seen) return 'new';
    var interval = typeof record.intervalDays === 'number' && isFinite(record.intervalDays) ? record.intervalDays : 0;
    var reps = typeof record.reps === 'number' && isFinite(record.reps) ? record.reps : 0;
    if (interval >= MASTERY_MASTERED_DAYS && reps >= 1) return 'mastered';
    if (interval >= MASTERY_PROFICIENT_DAYS) return 'proficient';
    return 'learning';
  }

  function computeMasteryByDeck(cardData, rawStats) {
    var stats = rawStats || getStats();
    var decks = {};
    forEachAvailableCard(cardData, function (card) {
      if (card.isMaster) return;
      var deckKey = card.cardType + ':' + card.deckId;
      var deck = decks[deckKey];
      if (!deck) {
        deck = decks[deckKey] = {
          deckId: card.deckId,
          title: card.source,
          cardType: card.cardType,
          total: 0,
          seen: 0,
          learning: 0,
          proficient: 0,
          mastered: 0
        };
      }
      deck.total++;
      var tier = classifyMasteryStats(stats[card.key]);
      if (tier === 'new') return;
      deck.seen++;
      if (tier === 'mastered') deck.mastered++;
      else if (tier === 'proficient') deck.proficient++;
      else deck.learning++;
    });
    var out = [];
    Object.keys(decks).forEach(function (id) {
      var deck = decks[id];
      if (deck.seen === 0) return;
      var masteredFrac = deck.total > 0 ? deck.mastered / deck.total : 0;
      var proficientFrac = deck.total > 0 ? (deck.mastered + deck.proficient) / deck.total : 0;
      if (masteredFrac >= DECK_MASTERED_CUTOFF) deck.state = 'mastered';
      else if (proficientFrac >= DECK_PROFICIENT_CUTOFF) deck.state = 'proficient';
      else deck.state = 'learning';
      out.push(deck);
    });
    return out;
  }

  function getStats() {
    try {
      var raw = localStorage.getItem(STATS_KEY);
      if (!raw) return {};
      var stats = plainObjectStore(JSON.parse(raw));
      // Migrate legacy records: pre-`lastAsked` entries keep their existing SRS
      // `last` timestamp when one exists, so recency-based workouts preserve
      // old practice order instead of flattening every legacy card to "now".
      var migrated = false;
      var now = Date.now();
      for (var k in stats) {
        if (Object.prototype.hasOwnProperty.call(stats, k)
            && stats[k] && typeof stats[k].lastAsked !== 'number') {
          stats[k].lastAsked = typeof stats[k].last === 'number' && isFinite(stats[k].last) ? stats[k].last : now;
          migrated = true;
        }
      }
      if (migrated) saveStats(stats);
      return stats;
    } catch (e) { return {}; }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(plainObjectStore(stats)));
    } catch (e) { /* localStorage full or unavailable */ }
  }

  function clearStats() {
    try { localStorage.removeItem(STATS_KEY); } catch (e) { /* ignore */ }
    // The daily-workout date is derived from practice, so clear it with the stats.
    try { localStorage.removeItem(DAILY_LAST_KEY); } catch (e) { /* ignore */ }
  }

  function recordResult(key, correct) {
    if (!isAnalyzePerformance()) return;
    var stats = getStats();
    if (!stats[key]) stats[key] = { seen: 0, correct: 0 };
    var rec = stats[key];
    var counts = statsRecordCounts(rec);
    rec.seen = counts.seen;
    rec.correct = counts.correct;
    rec.seen++;
    if (correct) rec.correct++;
    rec.lastAsked = Date.now();
    // Merge the SM-2-lite review schedule into the same record.
    var sched = scheduleNext(rec, correct, Date.now());
    rec.reps = sched.reps;
    rec.ef = sched.ef;
    rec.intervalDays = sched.intervalDays;
    rec.lapses = sched.lapses;
    rec.due = sched.due;
    rec.last = sched.last;
    saveStats(stats);
  }

  function getQuestionStats(key) {
    var stats = getStats();
    return stats[key] || null;
  }

  // ==================== Training log: activity, streak, weekly goal ====================
  // se-gym-activity localStorage maps a local date to that day's tally:
  //   { 'YYYY-MM-DD': { s: sessionsFinished, c: cardsPracticed }, ... }
  // It powers the consistency heatmap, the training streak, and the weekly goal.
  var ACTIVITY_KEY = 'se-gym-activity';
  var WEEKLY_GOAL_COOKIE = 'se-gym-weekly-goal'; // sessions/week target; 0 = no goal
  var DEFAULT_WEEKLY_GOAL = 3;

  function fmtDate(d) {
    var mm = String(d.getMonth() + 1);
    var dd = String(d.getDate());
    if (mm.length < 2) mm = '0' + mm;
    if (dd.length < 2) dd = '0' + dd;
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  // 'YYYY-MM-DD' for `daysAgo` days before today, in local time.
  function dateStrDaysAgo(daysAgo) {
    var d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return fmtDate(d);
  }

  function getActivity() {
    try {
      var raw = localStorage.getItem(ACTIVITY_KEY);
      return raw ? plainObjectStore(JSON.parse(raw)) : {};
    } catch (e) { return {}; }
  }

  function saveActivity(activity) {
    try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(plainObjectStore(activity))); } catch (e) { /* full/unavailable */ }
  }

  function clearActivity() {
    try { localStorage.removeItem(ACTIVITY_KEY); } catch (e) { /* ignore */ }
  }

  // Record one finished workout (a session) plus the cards practiced in it.
  function recordActivity(cardCount) {
    var activity = getActivity();
    var today = todayStr();
    var entry = activity[today] || { s: 0, c: 0 };
    entry.s += 1;
    entry.c += Math.max(0, cardCount | 0);
    activity[today] = entry;
    saveActivity(activity);
  }

  // Consecutive days with >=1 session, ending today (or yesterday if today is
  // not practiced yet — a streak only breaks once a full empty day passes).
  function computeStreak() {
    var activity = getActivity();
    function active(daysAgo) {
      var e = activity[dateStrDaysAgo(daysAgo)];
      return !!(e && e.s > 0);
    }
    var start = active(0) ? 0 : (active(1) ? 1 : -1);
    if (start === -1) return 0;
    var streak = 0;
    for (var d = start; active(d); d++) streak++;
    return streak;
  }

  // Local Monday-start week key for the given date (defaults to today).
  function weekStartStr(date) {
    var d = date ? new Date(date.getTime()) : new Date();
    var dow = (d.getDay() + 6) % 7; // 0 = Monday
    d.setDate(d.getDate() - dow);
    return fmtDate(d);
  }

  // Sessions practiced so far in the current Monday-start week.
  function getWeekSessions() {
    var activity = getActivity();
    var thisWeek = weekStartStr();
    var total = 0;
    Object.keys(activity).forEach(function (date) {
      var p = date.split('-');
      if (p.length !== 3) return;
      var dObj = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      if (weekStartStr(dObj) === thisWeek) total += (activity[date].s || 0);
    });
    return total;
  }

  function boundedGoal(value) {
    var n = parseInt(value, 10);
    if (!isFinite(n) || n < 0) return 0;
    if (n > 99) return 99;
    return n;
  }

  function getWeeklyGoal() {
    var raw = getCookie(WEEKLY_GOAL_COOKIE);
    if (raw == null) return DEFAULT_WEEKLY_GOAL;
    return boundedGoal(raw);
  }

  function setWeeklyGoal(value) {
    setCookie(WEEKLY_GOAL_COOKIE, String(boundedGoal(value)), COOKIE_DAYS);
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
    cardStatsKey: cardStatsKey,
    cardStatsKeyVariants: cardStatsKeyVariants,
    forEachAvailableCard: forEachAvailableCard,
    buildCardCorpus: buildCardCorpus,
    getCanonicalStatsEntries: getCanonicalStatsEntries,
    migrateStatsKeys: migrateStatsKeys,
    classifyMasteryStats: classifyMasteryStats,
    computeMasteryByDeck: computeMasteryByDeck,
    MASTERY_STATE_LABELS: MASTERY_STATE_LABELS,
    getStats: getStats,
    saveStats: saveStats,
    clearStats: clearStats,
    recordResult: recordResult,
    getQuestionStats: getQuestionStats,
    // Spaced repetition / Workout of the Day
    scheduleNext: scheduleNext,
    getDailyLast: getDailyLast,
    setDailyLast: setDailyLast,
    todayStr: todayStr,
    // Training log / streak / weekly goal
    recordActivity: recordActivity,
    getActivity: getActivity,
    clearActivity: clearActivity,
    computeStreak: computeStreak,
    getWeekSessions: getWeekSessions,
    getWeeklyGoal: getWeeklyGoal,
    setWeeklyGoal: setWeeklyGoal,
    dateStrDaysAgo: dateStrDaysAgo
  };
})();
