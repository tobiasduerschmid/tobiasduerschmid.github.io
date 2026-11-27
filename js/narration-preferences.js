/* One site-wide cookie for every narration player's viewing preferences. */
(function () {
  'use strict';
  if (window.NarrationPreferences) return;

  const key = 'sebook-narration-preferences';
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const captionSizes = [1, 1.25, 1.5, 2];
  const listeners = new Set();

  function normalize(value) {
    return {
      captions: typeof value?.captions === 'boolean' ? value.captions : true,
      speed: speeds.includes(value?.speed) ? value.speed : 1,
      finalCheckOnly: value?.finalCheckOnly === true,
      captionSize: captionSizes.includes(value?.captionSize) ? value.captionSize : 1,
      landscape: typeof value?.landscape === 'boolean' ? value.landscape : true,
      predictions: typeof value?.predictions === 'boolean' ? value.predictions : true,
      motion: typeof value?.motion === 'boolean' ? value.motion : null,
      volume: typeof value?.volume === 'number' && value.volume >= 0 && value.volume <= 1 ? value.volume : 1,
      muted: value?.muted === true,
    };
  }

  function readCookie() {
    try {
      const entry = document.cookie.split(';').map(part => part.trim())
        .find(part => part.startsWith(`${key}=`));
      return entry ? entry.slice(key.length + 1) : null;
    } catch (_) { return null; } // Blocked storage must not disable playback.
  }

  function parse(cookie) {
    try { return normalize(JSON.parse(decodeURIComponent(cookie))); }
    catch (_) { return normalize(null); }
  }

  let lastCookie = readCookie();
  let current = parse(lastCookie);

  function apply(next) {
    if (Object.keys(next).every(key => next[key] === current[key])) return;
    current = next;
    listeners.forEach(listener => listener({ ...current }));
  }

  // Cookies have no storage event. Returning to an open tab (or a cached
  // history page) picks up choices and deletions made elsewhere. Comparing
  // the cookie also preserves this page's choices when storage is blocked.
  function refresh() {
    const cookie = readCookie();
    if (cookie === lastCookie) return;
    lastCookie = cookie;
    apply(parse(cookie));
  }

  function set(changes) {
    refresh();
    const next = normalize({ ...current, ...changes });
    const value = encodeURIComponent(JSON.stringify(next));
    try {
      document.cookie = `${key}=${value}; Max-Age=31536000; Path=/; SameSite=Lax`
        + (location.protocol === 'https:' ? '; Secure' : '');
    } catch (_) { /* Keep the controls usable for this page. */ }
    lastCookie = readCookie();
    apply(next);
    return lastCookie === value;
  }

  function subscribe(listener) {
    refresh();
    listeners.add(listener);
    listener({ ...current });
    return () => listeners.delete(listener);
  }

  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', refresh);
  window.cookieStore?.addEventListener('change', refresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  window.NarrationPreferences = { set, subscribe };
})();
