/**
 * Runs in the page world before site scripts. Watches cookie and
 * localStorage writes, and reapplies display preferences after the
 * extension copies Chrome profile data into this origin.
 */
(function () {
  if (window.__sebookProfileSyncInstalled) return;
  window.__sebookProfileSyncInstalled = true;

  var CHANNEL = 'sebook-profile-sync';
  var pending = new Map();
  var suppress = false;
  var ackedSignature = null;
  var announceTimer = 0;

  function hostWindow() {
    try {
      if (window.top && window.top.location.origin === location.origin) return window.top;
    } catch (error) {}
    return window;
  }

  function entryId(area, key) {
    return area + '\u0000' + key;
  }

  function applyingFromExtension() {
    return !!(document.documentElement && document.documentElement.hasAttribute('data-sebook-sync-applying'));
  }

  function noteWrite(area, key, value, deleted) {
    if (suppress || applyingFromExtension()) return;
    pending.set(entryId(area, key), {
      area: area,
      key: key,
      value: deleted ? '' : String(value),
      deleted: !!deleted,
      writtenAt: Date.now(),
    });
    scheduleAnnounce();
  }

  function readRaw() {
    var entries = [];
    try {
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = localStorage.key(i);
        entries.push({ area: 'local', key: key, value: localStorage.getItem(key) });
      }
    } catch (error) {}
    var raw = '';
    try { raw = document.cookie || ''; } catch (error) {}
    if (!raw) return entries;
    raw.split(';').forEach(function (part) {
      var piece = part.trim();
      if (!piece) return;
      var eq = piece.indexOf('=');
      if (eq <= 0) return;
      var name = piece.slice(0, eq);
      var value = piece.slice(eq + 1);
      try { value = decodeURIComponent(value); } catch (error) {}
      entries.push({ area: 'cookie', key: name, value: value });
    });
    return entries;
  }

  function signature(entries) {
    var rows = entries.map(function (entry) {
      return [entry.area, entry.key, entry.deleted ? null : entry.value];
    });
    rows.sort(function (left, right) {
      if (left[0] !== right[0]) return left[0] < right[0] ? -1 : 1;
      if (left[1] !== right[1]) return left[1] < right[1] ? -1 : 1;
      return 0;
    });
    return JSON.stringify(rows);
  }

  function buildSnapshot() {
    var byId = new Map();
    readRaw().forEach(function (entry) {
      byId.set(entryId(entry.area, entry.key), {
        area: entry.area,
        key: entry.key,
        value: entry.value,
        deleted: false,
      });
    });
    pending.forEach(function (entry, id) {
      if (entry.deleted) {
        byId.set(id, entry);
        return;
      }
      var current = byId.get(id);
      if (current) current.writtenAt = entry.writtenAt;
      else byId.set(id, entry);
    });
    var entries = Array.from(byId.values());
    return {
      entries: entries,
      takenAt: Date.now(),
      signature: signature(entries),
      retired: readRetired(),
    };
  }

  function readRetired() {
    var catalog = window.__sebookStorageCatalog;
    if (!catalog || !Array.isArray(catalog.retired)) return [];
    return catalog.retired.slice();
  }

  function postToExtension(type, snapshot) {
    hostWindow().postMessage({
      channel: CHANNEL,
      to: 'extension',
      type: type,
      snapshot: snapshot || buildSnapshot(),
    }, location.origin);
  }

  function scheduleAnnounce() {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { postToExtension('local-change'); }, 50);
  }

  function writeCookie(name, value, deleted) {
    var expires = deleted
      ? 'Thu, 01 Jan 1970 00:00:00 GMT'
      : new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toUTCString();
    var encoded = deleted ? '' : encodeURIComponent(value);
    var suffixes = [''];
    if (location.protocol === 'https:') suffixes.push('; Secure');
    suffixes.forEach(function (suffix) {
      document.cookie = name + '=' + encoded + '; expires=' + expires + '; path=/; SameSite=Lax' + suffix;
    });
  }

  function writeChange(change) {
    if (change.area === 'local') {
      if (change.deleted) localStorage.removeItem(change.key);
      else localStorage.setItem(change.key, change.value);
      return;
    }
    if (change.area === 'cookie') writeCookie(change.key, change.value, change.deleted);
  }

  function applyChanges(changes, takenAt) {
    suppress = true;
    try {
      (changes || []).forEach(function (change) {
        var pendingEntry = pending.get(entryId(change.area, change.key));
        if (pendingEntry && pendingEntry.writtenAt > takenAt) return;
        writeChange(change);
      });
    } finally {
      suppress = false;
    }
    Array.from(pending.keys()).forEach(function (id) {
      if (pending.get(id).writtenAt <= takenAt) pending.delete(id);
    });
    ackedSignature = signature(readRaw());
    reapplyAndReveal();
  }

  function reapplyAndReveal() {
    ackedSignature = signature(readRaw());
    window.__sebookProfileSyncApplied = true;
    if (typeof window.__sebookApplyDisplayPreferences === 'function') {
      window.__sebookApplyDisplayPreferences();
    }
    if (typeof window.__sebookRevealProfileSync === 'function') {
      window.__sebookRevealProfileSync();
    }
    if (pending.size) scheduleAnnounce();
  }

  function parseCookieAssignment(cookieString) {
    var parts = String(cookieString).split(';');
    var pair = parts[0];
    var eq = pair.indexOf('=');
    if (eq <= 0) return null;
    var name = pair.slice(0, eq).trim();
    if (!name) return null;
    var deleted = false;
    for (var i = 1; i < parts.length; i += 1) {
      var attr = parts[i].trim();
      var lower = attr.toLowerCase();
      if (lower.indexOf('max-age=') === 0) {
        var age = Number(lower.slice('max-age='.length));
        if (isFinite(age) && age <= 0) deleted = true;
      } else if (lower.indexOf('expires=') === 0) {
        var when = Date.parse(attr.slice(attr.indexOf('=') + 1).trim());
        if (isFinite(when) && when <= Date.now()) deleted = true;
      }
    }
    var value = pair.slice(eq + 1).trim();
    try { value = decodeURIComponent(value); } catch (error) {}
    return { name: name, value: value, deleted: deleted };
  }

  function installLocalStorageHook() {
    var originalSet = Storage.prototype.setItem;
    var originalRemove = Storage.prototype.removeItem;
    var originalClear = Storage.prototype.clear;
    Storage.prototype.setItem = function (key, value) {
      originalSet.call(this, key, value);
      if (this !== localStorage) return;
      noteWrite('local', String(key), String(value), false);
    };
    Storage.prototype.removeItem = function (key) {
      originalRemove.call(this, key);
      if (this !== localStorage) return;
      noteWrite('local', String(key), '', true);
    };
    Storage.prototype.clear = function () {
      if (this === localStorage && !suppress && !applyingFromExtension()) {
        var now = Date.now();
        for (var i = 0; i < localStorage.length; i += 1) {
          var key = localStorage.key(i);
          pending.set(entryId('local', key), {
            area: 'local',
            key: key,
            value: '',
            deleted: true,
            writtenAt: now,
          });
        }
      }
      originalClear.call(this);
      if (this === localStorage) scheduleAnnounce();
    };
  }

  function installCookieHook() {
    var descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    if (!descriptor || !descriptor.configurable || !descriptor.set) return;
    var originalGet = descriptor.get;
    var originalSet = descriptor.set;
    Object.defineProperty(Document.prototype, 'cookie', {
      configurable: true,
      enumerable: descriptor.enumerable,
      get: function () { return originalGet.call(this); },
      set: function (value) {
        originalSet.call(this, value);
        if (this !== document) return;
        var parsed = parseCookieAssignment(value);
        if (!parsed) return;
        noteWrite('cookie', parsed.name, parsed.value, parsed.deleted);
      },
    });
  }

  installLocalStorageHook();
  installCookieHook();

  window.addEventListener('message', function (event) {
    if (event.origin !== location.origin) return;
    var data = event.data;
    if (!data || data.channel !== CHANNEL || data.to !== 'page') return;
    if (data.type === 'snapshot-request') {
      hostWindow().postMessage({
        channel: CHANNEL,
        to: 'extension',
        type: 'snapshot',
        requestId: data.requestId,
        snapshot: buildSnapshot(),
      }, location.origin);
      return;
    }
    if (data.type === 'apply') {
      applyChanges(data.changes, data.takenAt);
      hostWindow().postMessage({
        channel: CHANNEL,
        to: 'extension',
        type: 'applied',
        requestId: data.requestId,
      }, location.origin);
      return;
    }
    if (data.type === 'reapply') reapplyAndReveal();
  });

  window.addEventListener('sebook-storage-catalog', function () {
    scheduleAnnounce();
  });

  window.addEventListener('pagehide', function () {
    postToExtension('flush');
  });

  setInterval(function () {
    if (ackedSignature == null) return;
    if (signature(readRaw()) !== ackedSignature) scheduleAnnounce();
  }, 1500);
})();
