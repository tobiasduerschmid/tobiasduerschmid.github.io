/**
 * Isolated-world coordinator. The page bridge owns the storage hooks;
 * this script talks to the extension service worker and asks the page
 * to apply the merged snapshot before revealing the document.
 */
(function () {
  if (window.__sebookProfileSyncCoordinator) return;
  window.__sebookProfileSyncCoordinator = true;

  var CHANNEL = 'sebook-profile-sync';
  var topFrame = false;
  try { topFrame = window.top === window; } catch (error) { topFrame = true; }
  if (chrome.extension.inIncognitoContext || !topFrame) return;

  var root = document.documentElement;
  if (root) root.classList.add('sebook-profile-sync-pending');

  var requestSerial = 0;
  var ready = false;
  var paused = false;
  var dirty = false;
  var latestSnapshot = null;
  var lastRevision = 0;
  var pushTimer = 0;
  var chain = Promise.resolve();

  function enqueue(task) {
    var run = chain.then(task, task);
    chain = run.then(function () {}, function () {});
    return run;
  }

  function reveal() {
    if (document.documentElement) {
      document.documentElement.classList.remove('sebook-profile-sync-pending');
    }
  }

  function postToPage(message) {
    window.postMessage(Object.assign({ channel: CHANNEL, to: 'page' }, message), location.origin);
  }

  function requestPage(type, extra, timeoutMs) {
    var requestId = requestSerial += 1;
    var limit = timeoutMs || 700;
    return new Promise(function (resolve) {
      var timer = setTimeout(function () {
        window.removeEventListener('message', onMessage);
        resolve(null);
      }, limit);
      function onMessage(event) {
        if (event.origin !== location.origin) return;
        var data = event.data;
        if (!data || data.channel !== CHANNEL || data.to !== 'extension') return;
        if (data.requestId !== requestId || data.type !== type) return;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(data);
      }
      window.addEventListener('message', onMessage);
      postToPage(Object.assign({ type: type === 'snapshot' ? 'snapshot-request' : type, requestId: requestId }, extra || {}));
    });
  }

  async function snapshotFromPage() {
    for (var attempt = 0; attempt < 20; attempt += 1) {
      var response = await requestPage('snapshot', null, 40);
      if (response && response.snapshot) return response.snapshot;
    }
    return { entries: fallbackEntries(), takenAt: Date.now() };
  }

  function fallbackEntries() {
    var entries = [];
    try {
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = localStorage.key(i);
        entries.push({ area: 'local', key: key, value: localStorage.getItem(key) });
      }
    } catch (error) {}
    return entries;
  }

  function applyDirectly(changes) {
    if (document.documentElement) document.documentElement.setAttribute('data-sebook-sync-applying', 'true');
    try {
      changes.forEach(function (change) {
        if (change.area === 'local') {
          if (change.deleted) localStorage.removeItem(change.key);
          else localStorage.setItem(change.key, change.value);
          return;
        }
        if (change.area !== 'cookie') return;
        var expires = change.deleted
          ? 'Thu, 01 Jan 1970 00:00:00 GMT'
          : new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toUTCString();
        var encoded = change.deleted ? '' : encodeURIComponent(change.value);
        var secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = change.key + '=' + encoded + '; expires=' + expires + '; path=/; SameSite=Lax' + secure;
      });
    } catch (error) {}
    finally {
      if (document.documentElement) document.documentElement.removeAttribute('data-sebook-sync-applying');
    }
  }

  async function applyOnPage(changes, takenAt) {
    if (changes && changes.length) {
      var response = await requestPage('applied', { type: 'apply', changes: changes, takenAt: takenAt });
      if (!response) applyDirectly(changes);
    }
    postToPage({ type: 'reapply' });
  }

  async function syncSnapshot(type, snapshot) {
    if (paused) return;
    var result = await chrome.runtime.sendMessage({
      type: type,
      entries: snapshot.entries,
      retired: snapshot.retired || [],
    });
    if (!result || result.skipped === 'incognito') {
      ready = true;
      reveal();
      return;
    }
    if (result.paused) {
      paused = true;
      ready = true;
      reveal();
      return;
    }
    if (result.error) {
      ready = true;
      reveal();
      return;
    }
    if (typeof result.revision === 'number') lastRevision = result.revision;
    await applyOnPage(result.apply, snapshot.takenAt);
    ready = true;
    if (dirty && latestSnapshot) {
      dirty = false;
      schedulePush(latestSnapshot);
    }
  }

  function schedulePush(snapshot) {
    latestSnapshot = snapshot;
    if (!ready || paused) {
      dirty = true;
      return;
    }
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      var snapshotToSend = latestSnapshot;
      enqueue(function () { return syncSnapshot('push', snapshotToSend); });
    }, 400);
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== location.origin) return;
    var data = event.data;
    if (!data || data.channel !== CHANNEL || data.to !== 'extension') return;
    if (data.type === 'local-change' && data.snapshot) schedulePush(data.snapshot);
    if (data.type === 'flush' && data.snapshot) {
      clearTimeout(pushTimer);
      enqueue(function () { return syncSnapshot('push', data.snapshot); });
    }
  });

  chrome.runtime.onMessage.addListener(function (message) {
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'paused') {
      paused = true;
      return;
    }
    if (message.type === 'resumed') {
      paused = false;
      ready = false;
      enqueue(function () {
        return snapshotFromPage().then(function (snapshot) { return syncSnapshot('hydrate', snapshot); });
      });
      return;
    }
    if (message.type === 'remote-changed') {
      if (message.revision === lastRevision) return;
      enqueue(function () {
        return snapshotFromPage().then(function (snapshot) { return syncSnapshot('hydrate', snapshot); });
      });
    }
  });

  setTimeout(reveal, 1500);
  enqueue(function () {
    return snapshotFromPage().then(function (snapshot) { return syncSnapshot('hydrate', snapshot); });
  });
})();
