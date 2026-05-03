/**
 * TTSPlayer — browser Text-to-Speech engine using Web Speech API.
 *
 * Automatically selects the best-sounding voice available
 * (Enhanced/Premium on macOS, Google Neural on Chrome, etc.)
 * and surfaces quality labels so users can pick wisely.
 *
 * Public API:
 *   TTSPlayer.speak(input, { rate, onUpdate, onEnd })
 *     input may be a plain string OR { text, markers } as produced by
 *     TTSPlayer.extract(el). Markers (heading positions) enable heading
 *     navigation; without them seekToHeading is a no-op.
 *   TTSPlayer.pause() / resume() / stop()
 *   TTSPlayer.setRate(n)            — restarts from last word boundary
 *   TTSPlayer.setVoice(voice)       — SpeechSynthesisVoice object
 *   TTSPlayer.seekRelative(seconds) — back/forward by ~seconds (rate-aware)
 *   TTSPlayer.seekToHeading(dir)    — 'next' | 'prev', uses extracted markers
 *   TTSPlayer.getMarkers()          — current extraction's markers (copy)
 *   TTSPlayer.getVoices()           — sorted list: { voice, label, lang, score }
 *   TTSPlayer.onVoicesReady(fn)     — call fn once voice list is populated
 *   TTSPlayer.extract(el)           — { text, markers }, DOM-aware
 *   TTSPlayer.extractText(el)       — plain text (alias for extract(el).text)
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

  // Chrome's TTS engine silently fails when an utterance is too long
  // (~32K chars) or runs longer than ~15s. Splitting the input into short
  // pieces and chaining them via onend keeps each utterance under both limits.
  var MAX_CHUNK_LENGTH = 240;
  var _chunks = [];
  var _chunkIdx = 0;
  var _chunkBase = 0;        // global offset within _text where _chunks[0] begins
  var _markers = [];         // [{ offset, type, level, label }]
  // Estimated chars-per-second at rate=1.0 (English ~150 wpm × 5 chars/word ÷ 60s).
  // Scales with _rate for seekRelative.
  var BASE_CHARS_PER_SEC = 12.5;

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

  // Split text into TTS-engine-sized pieces, preferring boundaries that
  // already sound like natural pauses. Order of preference per chunk:
  //   1. Sentence end (. ! ?)            — already a strong pause
  //   2. Clause end   (; : ,)            — already a light pause
  //   3. Word boundary (space)           — last resort, sounds clipped
  // Falling back to a word boundary is what produces the awkward
  // mid-sentence pauses; structural punctuation injected by _extract keeps
  // most chunks splitting at tier 1 even on long pages.
  // Chunks concatenate back to the input, so chunkStart math is exact.
  function _splitIntoChunks(text) {
    var chunks = [];
    var remaining = text;
    var minSplit = Math.floor(MAX_CHUNK_LENGTH / 3);
    while (remaining.length > MAX_CHUNK_LENGTH) {
      var win = remaining.slice(0, MAX_CHUNK_LENGTH);
      var splitAt;

      var lastSentence = Math.max(
        win.lastIndexOf('. '),
        win.lastIndexOf('! '),
        win.lastIndexOf('? ')
      );

      if (lastSentence >= minSplit) {
        splitAt = lastSentence + 2;
      } else {
        var lastClause = Math.max(
          win.lastIndexOf('; '),
          win.lastIndexOf(': '),
          win.lastIndexOf(', ')
        );
        if (lastClause >= minSplit) {
          splitAt = lastClause + 2;
        } else {
          var lastSpace = win.lastIndexOf(' ');
          splitAt = lastSpace > 0 ? lastSpace + 1 : MAX_CHUNK_LENGTH;
        }
      }

      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt);
    }
    if (remaining.length > 0) chunks.push(remaining);
    return chunks;
  }

  function _startFrom(offset) {
    if (!synth) return;

    var remaining = _text.slice(offset);
    if (!remaining.trim()) {
      _speaking = false;
      _paused = false;
      if (_onUpdate) _onUpdate();
      if (_onEnd) _onEnd();
      return;
    }

    _chunks = _splitIntoChunks(remaining);
    _chunkBase = offset;
    _chunkIdx = 0;

    // The cancel+setTimeout dance works around a Chrome race where speak()
    // called immediately after cancel() drops the new utterance. We only need
    // it when something is actually playing — for a fresh start, going through
    // setTimeout instead loses Chrome's transient user activation and the
    // first speak() silently aborts.
    if (_startTimer) { clearTimeout(_startTimer); _startTimer = null; }
    if (synth.speaking || synth.pending) {
      _restarting = true;
      synth.cancel();
      _startTimer = setTimeout(function () {
        _startTimer = null;
        _speakChunk();
      }, 50);
    } else {
      _restarting = false;
      _speakChunk();
    }
  }

  function _speakChunk() {
    if (!synth || _chunkIdx >= _chunks.length) {
      _speaking = false;
      _paused = false;
      _offset = 0;
      if (_onUpdate) _onUpdate();
      if (_onEnd) _onEnd();
      return;
    }

    var chunkText = _chunks[_chunkIdx];
    var chunkStart = _chunkBase;
    for (var k = 0; k < _chunkIdx; k++) chunkStart += _chunks[k].length;

    // Re-resolve voice by name at speak-time so the reference is never stale
    // (Chrome rebuilds its voice list internally; stored object refs can go dead)
    var activeVoice = null;
    if (_voice) {
      var fresh = synth.getVoices().filter(function (v) { return v.name === _voice.name; });
      activeVoice = fresh[0] || null;
    }

    var utt = new SpeechSynthesisUtterance(chunkText);
    utt.rate = _rate;
    if (activeVoice) {
      utt.voice = activeVoice;
      utt.lang  = activeVoice.lang;
    } else {
      utt.lang = 'en-US';
    }

    utt.onboundary = function (e) {
      if (e.name === 'word') _offset = chunkStart + e.charIndex;
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
      _chunkIdx++;
      if (_chunkIdx < _chunks.length) {
        _speakChunk();
      } else {
        _speaking = false;
        _paused = false;
        _offset = 0;
        if (_onUpdate) _onUpdate();
        if (_onEnd) _onEnd();
      }
    };
    utt.onerror = function (e) {
      if (_restarting) return;
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      _speaking = false;
      _paused = false;
      if (_onUpdate) _onUpdate();
    };

    synth.speak(utt);
  }

  /* ── Text extraction ──────────────────────────────────────── */

  // Tags that imply a strong pause (≈ sentence end) when leaving the element.
  var STRONG_PAUSE_TAGS = {
    H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
    P: 1, BLOCKQUOTE: 1, PRE: 1, HR: 1,
    SECTION: 1, ARTICLE: 1, HEADER: 1, FOOTER: 1, MAIN: 1, ASIDE: 1,
    TABLE: 1, FIGURE: 1, FIGCAPTION: 1,
    UL: 1, OL: 1, DL: 1
  };
  // Tags that imply a light pause (≈ comma) when leaving the element.
  var LIGHT_PAUSE_TAGS = {
    LI: 1, TR: 1, TD: 1, TH: 1, DT: 1, DD: 1
  };

  var DEFAULT_SKIP_SELECTORS = [
    'script', 'noscript', 'style', 'nav', 'button', 'input', 'select', 'textarea',
    '.cap', '.highlight-toggle-container', '.navbar', '#sidebar',
    '#tts-bar', '.tts-bar', '.se-gym-container', '.alert'
  ];

  // Walk a (cleaned) DOM subtree and produce both the spoken text and a list
  // of markers (currently just headings). Block-level elements get a strong
  // ". " on exit; list items / table cells get a light ", "; <pre> blocks
  // turn each non-empty code line into its own short sentence so each line
  // gets an audible pause. Punctuation is normalized at the end so we never
  // emit things like "Title.. ," or "Word, .".
  function _extract(el, skipSel) {
    if (!el) return { text: '', markers: [] };

    var clone = el.cloneNode(true);
    var selectors = skipSel || DEFAULT_SKIP_SELECTORS;
    for (var s = 0; s < selectors.length; s++) {
      var matches;
      try { matches = clone.querySelectorAll(selectors[s]); } catch (e) { continue; }
      for (var i = matches.length - 1; i >= 0; i--) {
        var n = matches[i];
        if (n.parentNode) n.parentNode.removeChild(n);
      }
    }

    var parts = [];
    var rawMarkers = [];

    function walk(node) {
      if (node.nodeType === 3) {  // TEXT_NODE
        if (node.nodeValue) parts.push(node.nodeValue);
        return;
      }
      if (node.nodeType !== 1) return;  // not ELEMENT_NODE
      var tag = node.tagName;

      if (tag === 'BR') { parts.push(', '); return; }

      if (tag === 'PRE') {
        // Each non-blank code line becomes its own short sentence so the
        // engine pauses at line breaks instead of running lines together.
        var raw = (node.textContent || '');
        var lines = raw.split(/\r?\n/);
        var pieces = [];
        for (var l = 0; l < lines.length; l++) {
          var line = lines[l].replace(/\s+/g, ' ').trim();
          if (line) pieces.push(line);
        }
        if (pieces.length) parts.push(pieces.join('. ') + '. ');
        return;
      }

      var isHeading = /^H[1-6]$/.test(tag);
      var headingLabel = isHeading ? (node.textContent || '').replace(/\s+/g, ' ').trim() : null;

      for (var c = 0; c < node.childNodes.length; c++) walk(node.childNodes[c]);

      if (headingLabel) {
        rawMarkers.push({ type: 'heading', level: parseInt(tag.charAt(1), 10), label: headingLabel });
      }

      if (STRONG_PAUSE_TAGS[tag]) parts.push('. ');
      else if (LIGHT_PAUSE_TAGS[tag]) parts.push(', ');
    }

    walk(clone);

    // Strip < > so Chrome's TTS doesn't interpret code like <iostream> or <T>
    // as SSML tags and halt mid-sentence. Then collapse whitespace.
    var text = parts.join('').replace(/[<>]/g, ' ').replace(/\s+/g, ' ');

    // Punctuation cleanup. Repeated injections plus original punctuation can
    // produce strings like ". , ", " : .", or ".. " — normalize them.
    text = text
      .replace(/\s+([.,!?;:])/g, '$1')                 // no space before punct
      .replace(/([.!?])(?:\s*[,;:])+/g, '$1')          // strong absorbs following light
      .replace(/(?:[,;:]\s*)+([.!?])/g, '$1')          // strong absorbs preceding light
      .replace(/([.!?])(?:\s*\1)+/g, '$1')             // collapse ".." or "?? " etc.
      .replace(/([,;:])(?:\s*\1)+/g, '$1')             // collapse ",,"
      .replace(/([.,!?;:])(?=\S)/g, '$1 ')             // ensure space after punct
      .replace(/\s+/g, ' ')
      .trim();

    // Locate each heading marker in the normalized text. Search forward from
    // the previous marker so duplicate heading text in body prose doesn't
    // pull a marker backward in document order.
    var markers = [];
    var searchFrom = 0;
    for (var k = 0; k < rawMarkers.length; k++) {
      var raw = rawMarkers[k];
      if (!raw.label) continue;
      var idx = text.indexOf(raw.label, searchFrom);
      if (idx >= 0) {
        markers.push({ offset: idx, type: raw.type, level: raw.level, label: raw.label });
        searchFrom = idx + raw.label.length;
      }
    }

    return { text: text, markers: markers };
  }

  function _extractText(el, skipSel) {
    return _extract(el, skipSel).text;
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

    speak: function (input, opts) {
      opts = opts || {};
      var text;
      var markers;
      if (typeof input === 'string') {
        text = input;
        markers = [];
      } else if (input && typeof input.text === 'string') {
        text = input.text;
        markers = Array.isArray(input.markers) ? input.markers.slice() : [];
      } else {
        return;
      }
      _text = text;
      _markers = markers;
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
      _text     = '';
      _chunks   = [];
      _chunkIdx = 0;
      _markers  = [];
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

    /**
     * Skip back/forward by approximately deltaSeconds. Conversion uses an
     * empirical chars-per-second baseline scaled by the current rate, so a
     * 10s skip at 2x covers roughly twice the text of a 10s skip at 1x.
     * Always restarts playback at the new position (matching audio-player
     * UX where skip controls work whether currently playing or paused);
     * no-op when stop() has cleared the text.
     */
    seekRelative: function (deltaSeconds) {
      if (!_text) return;
      var charsPerSec = BASE_CHARS_PER_SEC * _rate;
      var deltaChars = Math.round(charsPerSec * deltaSeconds);
      var newOffset = Math.max(0, Math.min(_text.length, _offset + deltaChars));
      _offset = newOffset;
      _startFrom(newOffset);
    },

    /**
     * Jump to the nearest heading marker. direction is 'next' or 'prev'.
     * 'next' past the last heading is a no-op so the user doesn't get
     * silently teleported to the end. 'prev' before the first heading
     * rewinds to the start of the document.
     */
    seekToHeading: function (direction) {
      if (!_text || !_markers.length) return;
      // Tolerance avoids re-selecting the heading we're currently inside
      // when the user mashes the button.
      var FUZZ = 5;
      var newOffset = null;
      if (direction === 'next') {
        for (var i = 0; i < _markers.length; i++) {
          if (_markers[i].type !== 'heading') continue;
          if (_markers[i].offset > _offset + FUZZ) { newOffset = _markers[i].offset; break; }
        }
        if (newOffset === null) return;
      } else {
        for (var j = _markers.length - 1; j >= 0; j--) {
          if (_markers[j].type !== 'heading') continue;
          if (_markers[j].offset < _offset - FUZZ) { newOffset = _markers[j].offset; break; }
        }
        if (newOffset === null) newOffset = 0;
      }
      _offset = newOffset;
      _startFrom(newOffset);
    },

    /** Returns a copy of the markers (heading positions) for the active text. */
    getMarkers: function () { return _markers.slice(); },

    /** Current playback offset as a fraction in [0, 1]. 0 if no text. */
    getProgress: function () {
      if (!_text || !_text.length) return 0;
      return Math.max(0, Math.min(1, _offset / _text.length));
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

    extract:     _extract,
    extractText: _extractText,
    rateLabel:   function () { return _rate.toFixed(1) + 'x'; }
  };
})(window);
