/** One language preference for every SEBook code selector. */
(function (global) {
  'use strict';
  const storageKey = 'sebook-code-language';
  const languages = ['python', 'java', 'cpp', 'typescript'];
  const listeners = new Set();

  function normalize(language) {
    const canonical = language === 'ts' ? 'typescript' : language;
    return languages.includes(canonical) ? canonical : null;
  }

  function read() {
    try { return normalize(global.localStorage.getItem(storageKey)) || 'python'; }
    catch (_) { return 'python'; }
  }

  let preferred = read();

  function notify(language) {
    if (language === preferred) return;
    global.dispatchEvent(new Event('sebook:before-code-language-change'));
    preferred = language;
    listeners.forEach(listener => listener());
    global.dispatchEvent(new Event('sebook:code-language-changed'));
  }

  // Return the selector's own ID (including the older "ts" alias).
  // An unsupported preference never replaces the saved choice with a fallback.
  function choose(available = languages, fallback) {
    return available.find(language => normalize(language) === preferred)
      || available.find(language => normalize(language) === 'python')
      || available.find(language => language === fallback)
      || available[0];
  }

  function set(language) {
    const canonical = normalize(language);
    if (!canonical) return false;
    let saved = false;
    try { global.localStorage.setItem(storageKey, canonical); saved = true; }
    catch (_) { /* The current page still works when browser storage is blocked. */ }
    notify(canonical);
    return saved;
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener();
    return () => listeners.delete(listener);
  }

  global.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) notify(read());
  });
  global.addEventListener('pageshow', event => {
    if (event.persisted) notify(read());
  });
  global.SEBookCodePreferences = { choose, set, subscribe };
})(window);
