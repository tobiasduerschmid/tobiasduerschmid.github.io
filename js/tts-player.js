/**
 * TTSPlayer — browser Text-to-Speech engine using Web Speech API.
 *
 * Automatically selects the best-sounding voice available
 * (Enhanced/Premium on macOS, Google Neural on Chrome, etc.)
 * and surfaces quality labels so users can pick wisely.
 *
 * Public API:
 *   TTSPlayer.speak(text, { rate, onUpdate, onEnd });
 *   TTSPlayer.pause() / resume() / stop()
 *   TTSPlayer.setRate(n)          — restarts from last word boundary
 *   TTSPlayer.setVoice(voice)     — SpeechSynthesisVoice object
 *   TTSPlayer.getVoices()         — sorted list: { voice, label, lang, score }
 *   TTSPlayer.onVoicesReady(fn)   — call fn once voice list is populated
 *   TTSPlayer.extractText(el)
 *   TTSPlayer.rateLabel()
 */
(function (window) {
  'use strict';

  var synth = window.speechSynthesis;
  var _text = '';
  var _offset = 0;
  var _rate = 1.0;
  var _voice = null;
  var _speaking = false;
  var _paused = false;
  var _restarting = false;   // true while cancel+setTimeout is in flight
  var _startTimer = null;    // pending setTimeout handle
  var _onUpdate = null;
  var _onEnd = null;
  var _voicesReadyCbs = [];
  var _voicesReady = false;

  /* ── Voice quality scoring ────────────────────────────────── */

  function _scoreVoice(v) {
    var n = v.name;
    var score = 0;
    // High-quality neural / enhanced voices
    if (/premium/i.test(n))  score += 40;
    if (/enhanced/i.test(n)) score += 30;
    if (/neural/i.test(n))   score += 25;
    if (/^google\s/i.test(n)) score += 20;  // Chrome's Google voices
    // Locale preference
    if (/^en-US/i.test(v.lang)) score += 10;
    else if (/^en/i.test(v.lang)) score += 5;
    // Local is usually better than network (and always available offline)
    if (v.localService) score += 3;
    return score;
  }

  // Label shown in the dropdown
  function _friendlyName(v) {
    var n = v.name;
    // Skip URI-style internal names (e.g. "com.apple.voice.compact.en-US.Zoe")
    if (/^com\.\w+\./.test(n)) return null;
    n = n.replace(/^Microsoft\s+/, '');   // "Microsoft Zira …" → "Zira …"
    n = n.replace(/\s+Desktop\b/, '');    // " Desktop" suffix
    n = n.replace(/\s+-\s+.*$/, '');      // " - English (United States)"
    n = n.replace(/\s*\(Standard\)\s*/i, ''); // "(Standard)" adds no info
    return n.trim() || null;
  }

  // Quality badge appended to the label
  function _badge(v) {
    var n = v.name;
    if (/premium/i.test(n))  return ' ★★★';
    if (/enhanced/i.test(n)) return ' ★★';
    if (/neural/i.test(n))   return ' ★★';
    if (/^google\s/i.test(n)) return ' ★';
    return '';
  }

  /* ── Voice list helpers ───────────────────────────────────── */

  function _getEnglishVoices() {
    if (!synth) return [];
    return synth.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
  }

  function _bestVoice(items) {
    if (!items.length) return null;
    return items.slice().sort(function (a, b) { return b.score - a.score; })[0];
  }

  /* ── Voice loading ────────────────────────────────────────── */

  function _notifyVoicesReady() {
    if (_voicesReady) return;
    _voicesReady = true;
    _voicesReadyCbs.forEach(function (fn) { fn(); });
    _voicesReadyCbs = [];
  }

  if (synth) {
    if (synth.getVoices().length > 0) {
      _notifyVoicesReady();
    } else {
      synth.addEventListener('voiceschanged', function onVC() {
        synth.removeEventListener('voiceschanged', onVC);
        _notifyVoicesReady();
      });
      setTimeout(_notifyVoicesReady, 1000); // fallback
    }
  }

  /* ── Playback ─────────────────────────────────────────────── */

  function _startFrom(offset) {
    if (!synth) return;

    var text = _text.slice(offset).trim();
    if (!text) {
      _speaking = false;
      _paused = false;
      if (_onUpdate) _onUpdate();
      if (_onEnd) _onEnd();
      return;
    }

    // Re-resolve voice by name at speak-time so the reference is never stale
    // (Chrome rebuilds its voice list internally; stored object refs can go dead)
    var activeVoice = null;
    if (_voice) {
      var fresh = synth.getVoices().filter(function (v) { return v.name === _voice.name; });
      activeVoice = fresh[0] || null;
    }

    var utt = new SpeechSynthesisUtterance(text);
    utt.rate = _rate;
    if (activeVoice) {
      utt.voice = activeVoice;
      utt.lang  = activeVoice.lang;
    } else {
      utt.lang = 'en-US';
    }

    utt.onboundary = function (e) {
      if (e.name === 'word') _offset = offset + e.charIndex;
    };
    utt.onstart = function () {
      _restarting = false;
      _speaking = true;
      _paused = false;
      if (_onUpdate) _onUpdate();
    };
    utt.onend = function () {
      // Ignore onend that fires because we called cancel() for a restart —
      // Chrome fires onend (not onerror) when cancel() stops an utterance.
      if (_restarting) return;
      _speaking = false;
      _paused = false;
      _offset = 0;
      if (_onUpdate) _onUpdate();
      if (_onEnd) _onEnd();
    };
    utt.onerror = function (e) {
      if (_restarting) return;
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      _speaking = false;
      _paused = false;
      if (_onUpdate) _onUpdate();
    };

    // Chrome bug: cancel() followed immediately by speak() can silently fail.
    // Use a flag + clearTimeout so rapid calls collapse into one speak().
    _restarting = true;
    if (_startTimer) { clearTimeout(_startTimer); _startTimer = null; }
    synth.cancel();
    _startTimer = setTimeout(function () {
      _startTimer = null;
      synth.speak(utt);
    }, 50);
  }

  /* ── Text extraction ──────────────────────────────────────── */

  function _extractText(el, skipSel) {
    if (!el) return '';
    var clone = el.cloneNode(true);
    var selectors = skipSel || [
      'script', 'noscript', 'style', 'nav', 'button', 'input', 'select', 'textarea',
      'pre', 'code',
      '.cap', '.highlight-toggle-container', '.navbar', '#sidebar',
      '#tts-bar', '.tts-bar', '.se-gym-container', '.alert'
    ];
    selectors.forEach(function (sel) {
      var nodes = clone.querySelectorAll(sel);
      for (var i = nodes.length - 1; i >= 0; i--) {
        var n = nodes[i];
        if (n.parentNode) n.parentNode.removeChild(n);
      }
    });
    // Use textContent (not innerText) — cloned nodes are detached from the
    // document so innerText returns "" in Chrome (it requires layout).
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  /* ── Public API ───────────────────────────────────────────── */

  window.TTSPlayer = {
    isSupported: function () {
      return !!(synth && window.SpeechSynthesisUtterance);
    },
    isSpeaking: function () { return _speaking; },
    isPaused:   function () { return _paused;   },
    getRate:    function () { return _rate;     },
    getVoice:   function () { return _voice;    },

    speak: function (text, opts) {
      opts = opts || {};
      _text = text;
      _offset = 0;
      _onEnd    = opts.onEnd    || null;
      _onUpdate = opts.onUpdate || null;
      if (opts.rate !== undefined) _rate = opts.rate;
      _startFrom(0);
    },

    pause: function () {
      if (synth && _speaking && !_paused) {
        synth.pause();
        _paused = true;
        if (_onUpdate) _onUpdate();
      }
    },

    resume: function () {
      if (synth && _paused) {
        synth.resume();
        _paused = false;
        if (_onUpdate) _onUpdate();
      }
    },

    stop: function () {
      if (_startTimer) { clearTimeout(_startTimer); _startTimer = null; }
      _restarting = false;
      if (synth) synth.cancel();
      _speaking = false;
      _paused   = false;
      _offset   = 0;
      if (_onUpdate) _onUpdate();
      _onUpdate = null;
      _onEnd    = null;
    },

    setRate: function (r) {
      r = Math.max(0.5, Math.min(2.5, r));
      _rate = Math.round(r * 10) / 10;
      if (_speaking || _paused) _startFrom(_offset);
    },

    setVoice: function (voice) {
      _voice = voice || null;
      if (_speaking || _paused) _startFrom(_offset);
    },

    /** Returns English voices sorted best-first, with quality scores and labels. */
    getVoices: function () {
      return _getEnglishVoices().map(function (v) {
        var label = _friendlyName(v);
        if (!label) return null;
        return { voice: v, label: label + _badge(v), lang: v.lang, score: _scoreVoice(v) };
      }).filter(Boolean).sort(function (a, b) { return b.score - a.score; });
    },

    /** Returns the single best-quality voice available. */
    bestVoice: function () {
      return _bestVoice(this.getVoices());
    },

    onVoicesReady: function (fn) {
      if (_voicesReady) { fn(); } else { _voicesReadyCbs.push(fn); }
    },

    extractText: _extractText,
    rateLabel:   function () { return _rate.toFixed(1) + 'x'; }
  };
})(window);
