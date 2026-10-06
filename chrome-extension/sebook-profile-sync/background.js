import {
  LIMITS,
  META_KEY,
  chunkKey,
  fitToQuota,
  hashesForRecords,
  mergeSiteSnapshot,
  prepareSiteEntries,
  pruneRecords,
  recordsEqual,
  splitRecords,
  unsyncedStampsFor,
} from './sync-model.js';
import { decodeSyncPayload, encodeSyncPayload } from './sync-codec.js';

const SITE_URLS = [
  'https://tobiasduerschmid.github.io/*',
  'http://localhost/*',
  'http://127.0.0.1/*',
];

let chain = Promise.resolve();
let notifyTimer = 0;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return undefined;
  if (chrome.extension.inIncognitoContext) {
    sendResponse({ skipped: 'incognito' });
    return undefined;
  }
  enqueue(() => handleMessage(message)).then(sendResponse, (error) => {
    sendResponse({ error: error && error.message ? error.message : 'Sync failed.' });
  });
  return true;
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'status' || !senderAllowed(sender)) return undefined;
  if (chrome.extension.inIncognitoContext) {
    sendResponse({ installed: true, skipped: 'incognito' });
    return undefined;
  }
  enqueue(status).then(sendResponse, () => sendResponse({ installed: true, error: 'Status unavailable.' }));
  return true;
});

function enqueue(task) {
  const run = chain.then(task, task);
  chain = run.then(() => {}, () => {});
  return run;
}

async function handleMessage(message) {
  if (message.type === 'status') return status();
  if (message.type === 'pause') return pause();
  if (message.type === 'resume') return resume();
  if (message.type === 'wipe') return wipe();
  if (message.type === 'discard-backup') return discardBackup();
  if (message.type === 'hydrate' || message.type === 'push') {
    return syncEntries(message.entries || [], message.retired || []);
  }
  return { error: 'Unknown request.' };
}

async function syncEntries(entries, retired) {
  if (await isPaused()) return { paused: true, ...(await status()) };
  const remote = await readRemote();
  if (remote.error) return { error: remote.error };
  const parts = splitRecords(remote.records);
  const now = Date.now();
  const localState = await chrome.storage.local.get(['lastSynced', 'unsyncedStamps']);
  const prepared = prepareSiteEntries(entries, {
    stamps: localState.unsyncedStamps || {},
    lastSynced: localState.lastSynced || {},
    now,
    retired,
    remoteRecords: parts.known,
  });
  const merged = mergeSiteSnapshot(prepared, parts.known, now);
  if (remote.newer) {
    return { apply: merged.apply, revision: remote.revision, readOnly: true };
  }

  const fitted = await fitToQuota({ ...pruneRecords(merged.records, now), ...parts.opaque }, {
    protectedIds: Object.keys(parts.known),
    keepIds: Object.keys(parts.opaque),
    previousRecords: remote.records,
    quota: LIMITS.quotaBytes,
    encode: (records, omittedCount) => encodeSyncPayload(records, {
      revision: remote.revision + 1,
      omittedCount,
      updatedAt: now,
      previousMeta: remote.meta,
    }),
  });
  if (fitted.overQuota) {
    return { error: 'Chrome profile sync does not have room for this data.' };
  }

  let revision = remote.revision;
  let omittedCount = remote.omittedCount;
  const savedRecords = fitted.records;
  if (!recordsEqual(savedRecords, remote.records) || fitted.omitted.length !== remote.omittedCount) {
    fitted.encoded.meta.omittedCount = fitted.omitted.length;
    fitted.encoded.meta.revision = remote.revision + 1;
    await writeRemote(fitted.encoded);
    revision = fitted.encoded.meta.revision;
    omittedCount = fitted.omitted.length;
    scheduleNotify(revision);
  }

  await chrome.storage.local.set({
    lastSynced: hashesForRecords(pruneRecords(merged.records, now)),
    unsyncedStamps: unsyncedStampsFor(merged.records, savedRecords),
  });
  if (merged.replaced.length) await rememberReplaced(merged.replaced);

  return {
    apply: merged.apply,
    revision,
    omittedCount,
    replacedCount: merged.replaced.length,
    ...(await status()),
  };
}

async function readRemote() {
  const stored = await chrome.storage.sync.get(null);
  if (!stored[META_KEY]) return { records: {}, revision: 0, omittedCount: 0 };
  try {
    const decoded = await decodeSyncPayload(stored);
    if (!decoded) {
      return { records: {}, revision: 0, omittedCount: 0, meta: null, error: 'The Chrome profile copy could not be read.' };
    }
    return {
      records: decoded.records || {},
      revision: decoded.meta.revision || 0,
      omittedCount: decoded.meta.omittedCount || 0,
      meta: decoded.meta,
      newer: !!decoded.newer,
    };
  } catch (error) {
    return { records: {}, revision: 0, omittedCount: 0, error: 'The Chrome profile copy could not be read.' };
  }
}

async function writeRemote(encoded) {
  const payload = { [META_KEY]: encoded.meta };
  encoded.chunks.forEach((chunk, index) => {
    payload[chunkKey(index)] = chunk;
  });
  await chrome.storage.sync.set(payload);
  const existing = await chrome.storage.sync.get(null);
  const stale = Object.keys(existing).filter((key) => staleSyncKey(key, encoded.chunks.length));
  if (stale.length) await chrome.storage.sync.remove(stale);
}

function staleSyncKey(key, chunkCount) {
  if (key === META_KEY) return false;
  const match = /^c(\d+)$/.exec(key);
  if (!match) return true;
  return Number(match[1]) >= chunkCount;
}

async function pause() {
  await chrome.storage.local.set({ paused: true });
  scheduleNotifyControl('paused');
  return status();
}

async function resume() {
  await chrome.storage.local.set({ paused: false });
  scheduleNotifyControl('resumed');
  return status();
}

async function wipe() {
  await chrome.storage.local.set({ paused: true, lastSynced: {}, unsyncedStamps: {} });
  await chrome.storage.sync.clear();
  scheduleNotifyControl('paused');
  return status();
}

async function discardBackup() {
  await chrome.storage.local.set({ replacedBackup: {} });
  return status();
}

async function isPaused() {
  const stored = await chrome.storage.local.get('paused');
  return !!stored.paused;
}

async function rememberReplaced(replaced) {
  const data = await chrome.storage.local.get('replacedBackup');
  const backup = data.replacedBackup && typeof data.replacedBackup === 'object' ? { ...data.replacedBackup } : {};
  const now = Date.now();
  replaced.forEach((item) => {
    if (typeof item.value !== 'string' || item.value.length > 4000) return;
    backup[`${item.area}\u0000${item.key}`] = { value: item.value, at: now };
  });
  const newest = Object.entries(backup).sort((left, right) => (left[1].at || 0) - (right[1].at || 0)).slice(-30);
  const next = {};
  newest.forEach(([id, value]) => {
    next[id] = value;
  });
  await chrome.storage.local.set({ replacedBackup: next });
}

async function status() {
  const remote = await readRemote();
  const localState = await chrome.storage.local.get(['paused', 'replacedBackup']);
  const backup = localState.replacedBackup && typeof localState.replacedBackup === 'object'
    ? localState.replacedBackup
    : {};
  let bytesUsed = 0;
  try {
    bytesUsed = await chrome.storage.sync.getBytesInUse(null);
  } catch (error) {
    bytesUsed = 0;
  }
  const liveCount = Object.values(remote.records || {}).filter((record) => record && !record.deleted).length;
  return {
    installed: true,
    paused: !!localState.paused,
    omittedCount: remote.error ? 0 : remote.omittedCount || 0,
    keyCount: liveCount,
    bytesUsed,
    quota: LIMITS.quotaBytes,
    replacedCount: Object.keys(backup).length,
    revision: remote.revision || 0,
    error: remote.error || null,
  };
}

function scheduleNotify(revision) {
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    notifyTabs({ type: 'remote-changed', revision });
  }, 250);
}

function scheduleNotifyControl(type) {
  notifyTabs({ type });
}

async function notifyTabs(message) {
  const tabs = await chrome.tabs.query({ url: SITE_URLS });
  await Promise.all(tabs.map(async (tab) => {
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      // The tab has no content script yet.
    }
  }));
}

function senderAllowed(sender) {
  if (!sender || !sender.url) return false;
  try {
    const host = new URL(sender.url).hostname;
    return host === 'tobiasduerschmid.github.io' || host === 'localhost' || host === '127.0.0.1';
  } catch (error) {
    return false;
  }
}
