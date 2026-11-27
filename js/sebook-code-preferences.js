/** One language preference for every SEBook code selector. */
(function (global) {
  'use strict';
  if (global.SEBookCodePreferences) return;
  const storageKey = 'sebook-code-language';
  const languages = ['python', 'java', 'cpp', 'typescript'];
  const listeners = new Set();

  function normalize(language) {
    const canonical = language === 'ts' ? 'typescript' : language;
    return languages.includes(canonical) ? canonical : null;
  }

  function readCookie() {
    try {
      const entry = global.document.cookie.split(';').map(part => part.trim())
        .find(part => part.startsWith(`${storageKey}=`));
      return entry ? entry.slice(storageKey.length + 1) : null;
    } catch (_) { return null; }
  }

  function parse(cookie) {
    try { return normalize(decodeURIComponent(cookie)); }
    catch (_) { return null; }
  }

  let lastCookie = readCookie();

  function writeCookie(language) {
    try {
      global.document.cookie = `${storageKey}=${language}; Max-Age=31536000; Path=/; SameSite=Lax`
        + (global.location.protocol === 'https:' ? '; Secure' : '');
    } catch (_) { /* The current page remains usable with blocked cookies. */ }
    lastCookie = readCookie();
    return parse(lastCookie) === language;
  }

  // Preserve choices made before this preference moved from localStorage.
  // The cookie takes precedence; remove the old copy only after a safe save.
  let preferred = parse(lastCookie);
  try {
    const legacy = normalize(global.localStorage.getItem(storageKey));
    if (!preferred && legacy) {
      preferred = legacy;
      if (writeCookie(legacy)) global.localStorage.removeItem(storageKey);
    } else if (preferred) global.localStorage.removeItem(storageKey);
  } catch (_) { /* Storage may be unavailable. */ }
  preferred ||= 'python';

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
    const saved = writeCookie(canonical);
    notify(canonical);
    return saved;
  }

  function subscribe(listener) {
    refresh();
    listeners.add(listener);
    listener();
    return () => listeners.delete(listener);
  }

  function refresh() {
    const cookie = readCookie();
    if (cookie === lastCookie) return;
    lastCookie = cookie;
    notify(parse(cookie) || 'python');
  }

  global.cookieStore?.addEventListener('change', refresh);
  global.addEventListener('focus', refresh);
  global.addEventListener('pageshow', refresh);
  global.document.addEventListener('visibilitychange', () => {
    if (global.document.visibilityState === 'visible') refresh();
  });
  global.SEBookCodePreferences = { choose, set, subscribe };
})(window);
