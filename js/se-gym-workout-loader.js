/* Load the selected workout's full decks and optional question renderers. */
(function () {
  'use strict';

  var deckLoads = new Map();
  var scriptLoads = new Map();
  var engineLoads = new Map();
  var mathRenderQueue = Promise.resolve();
  var previousMathNodes = new WeakMap();

  function deckCollection(cardType) {
    return cardType === 'quiz' ? 'quizzes' : 'flashcards';
  }

  function hydrateDeck(collection, deckId, payload) {
    var deck = window.ALL_CARD_DATA[collection][deckId];
    var listKey = collection === 'quizzes' ? 'questions' : 'cards';
    var metadata = deck[listKey];
    var records = payload && payload[listKey];
    if (!Array.isArray(records) || records.length !== metadata.length) {
      throw new Error('The downloaded deck does not match this page. Refresh and try again.');
    }
    records.forEach(function (record, index) {
      var expected = metadata[index];
      if (!record || record.id !== expected.id || record.sourceDeckId !== expected.sourceDeckId
        || record.question !== expected.question) {
        throw new Error('The downloaded deck does not match this page. Refresh and try again.');
      }
    });
    // Aggregates and selected cards already reference these objects. Validate
    // the complete response before updating any of them, and retain identity.
    records.forEach(function (record, index) { Object.assign(metadata[index], record); });
  }

  function loadDeck(card) {
    var collection = deckCollection(card.cardType);
    var deckId = card.data.sourceDeckId || card.deckId;
    var urls = window.SEGymDeckUrls && window.SEGymDeckUrls[collection];
    var url = urls && urls[deckId];
    // Embedded/synthetic card sets already contain their full records.
    if (!url) return Promise.resolve();
    var key = collection + ':' + deckId;
    if (deckLoads.has(key)) return deckLoads.get(key);
    var pending = fetch(url).then(function (response) {
      if (!response.ok) throw new Error('Could not load the selected questions. Please try again.');
      return response.json();
    }).then(function (payload) {
      hydrateDeck(collection, deckId, payload);
    }).catch(function (error) {
      deckLoads.delete(key);
      throw error;
    });
    deckLoads.set(key, pending);
    return pending;
  }

  function loadScript(spec) {
    if (scriptLoads.has(spec.src)) return scriptLoads.get(spec.src);
    var pending = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = spec.src;
      if (spec.id) script.id = spec.id;
      if (spec.integrity) script.integrity = spec.integrity;
      if (spec.crossOrigin) script.crossOrigin = spec.crossOrigin;
      script.onload = function () { resolve(); };
      script.onerror = function () {
        script.remove();
        reject(new Error('Could not load a question renderer. Please try again.'));
      };
      document.head.appendChild(script);
    }).catch(function (error) {
      scriptLoads.delete(spec.src);
      throw error;
    });
    scriptLoads.set(spec.src, pending);
    return pending;
  }

  function engineIsReady(name) {
    if (name === 'uml') return !!(window.UMLShared && window.UMLAutoDescribe);
    if (name === 'writeIn') return !!window.WriteInQuiz;
    return !!(window.MathJax && typeof window.MathJax.typesetPromise === 'function');
  }

  function loadEngine(name) {
    if (engineLoads.has(name)) return engineLoads.get(name);
    var assets = window.SEGymWorkoutAssets || {};
    var scripts = name === 'mathjax' ? (assets.mathjax ? [assets.mathjax] : null) : assets[name];
    if (engineIsReady(name)) scripts = [];
    if (!scripts) return Promise.resolve();
    var pending = scripts.reduce(function (previous, spec) {
      return previous.then(function () { return loadScript(spec); });
    }, Promise.resolve()).then(function () {
      if (name === 'mathjax' && window.MathJax && window.MathJax.startup) {
        return window.MathJax.startup.promise;
      }
    }).catch(function (error) {
      engineLoads.delete(name);
      throw error;
    });
    engineLoads.set(name, pending);
    return pending;
  }

  function contentText(value) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    return Object.keys(value).map(function (key) { return contentText(value[key]); }).join('\n');
  }

  function ensureEngines(cards) {
    var content = cards.map(function (card) { return contentText(card.data); }).join('\n');
    var pending = [];
    if (/data-uml-|language-uml-|uml-[\w-]+-diagram-container|(?:language-|diagram-|```)(?:freeform|gitgraph|folder-tree|venn|er|crc)\b|```uml-/i.test(content)) {
      pending.push(loadEngine('uml'));
    }
    if (/\\\(|\\\[|\$\$|\$[^$\n]+\$/.test(content)) pending.push(loadEngine('mathjax'));
    if (cards.some(function (card) { return card.data.type === 'write-in'; })) pending.push(loadEngine('writeIn'));
    return Promise.all(pending).then(function () {});
  }

  function ensureCards(cards) {
    return Promise.all(cards.map(loadDeck)).then(function () { return ensureEngines(cards); });
  }

  function renderContent(root) {
    if (!root) return Promise.resolve();
    mathRenderQueue = mathRenderQueue.then(function () {
      if (!root.isConnected) return;
      if (window.UMLShared) window.UMLShared.renderAll();
      var math = window.MathJax;
      if (!math || typeof math.typesetPromise !== 'function') return;
      // Clear the previous card even after its nodes have been detached, so
      // MathJax does not retain every earlier question throughout a workout.
      var previous = previousMathNodes.get(root);
      if (previous && math.typesetClear) {
        var detached = previous.filter(function (node) { return !root.contains(node); });
        if (detached.length) math.typesetClear(detached);
      }
      var children = Array.from(root.children);
      previousMathNodes.set(root, children.length ? children : [root]);
      return math.typesetPromise([root]);
    }).catch(function (error) {
      console.error('Could not render question content:', error);
    });
    return mathRenderQueue;
  }

  window.SEGymWorkoutLoader = { ensureCards: ensureCards, renderContent: renderContent };
})();
