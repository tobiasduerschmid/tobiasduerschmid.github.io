/**
 * Pure merge and quota rules for SEBook Chrome profile sync.
 *
 * Chrome profile sync (chrome.storage.sync) holds about 100 kilobytes.
 * Values that do not fit stay in the browser that wrote them. A value that
 * already has a smaller copy in the profile keeps that smaller copy so the
 * profile is not emptied when a later edit is too large to sync.
 */

import { RESOURCE_LIMITS } from './sync-validation.js';

export const LIMITS = {
  quotaBytes: 100000,
  bytesPerItem: 8192,
  maxItems: 512,
  tombstoneRetentionMs: 90 * 24 * 60 * 60 * 1000,
  maxClockSkewMs: 5 * 60 * 1000,
};

/** V4 prevents page-clock writers and preserves V3 expanded-size accounting. */
export const FORMAT_VERSION = 4;

const KNOWN_RECORD_FIELDS = { value: true, updatedAt: true, deleted: true };
const KNOWN_META_FIELDS = { version: true, revision: true, chunks: true, omittedCount: true, updatedAt: true, expandedBytes: true };

export const META_KEY = 'm';

const SEPARATOR = '\u0000';

export function chunkKey(index) {
  return `c${index}`;
}

export function recordId(area, key, origin) {
  if (!isExactOrigin(origin)) throw new Error('An exact HTTP(S) origin is required.');
  return `${origin}${SEPARATOR}${area}${SEPARATOR}${key}`;
}

export function parseRecordId(id) {
  const origin = recordOrigin(id);
  if (!origin) return null;
  const start = origin.length + 1;
  const cut = id.indexOf(SEPARATOR, start);
  if (cut <= 0) return null;
  const area = id.slice(start, cut);
  const key = id.slice(cut + 1);
  if ((area !== 'local' && area !== 'cookie') || key === '') return null;
  return { origin, area, key };
}

function recordOrigin(id) {
  if (typeof id !== 'string') return null;
  const cut = id.indexOf(SEPARATOR);
  if (cut <= 0) return null;
  const origin = id.slice(0, cut);
  return isExactOrigin(origin) ? origin : null;
}

function isExactOrigin(origin) {
  if (typeof origin !== 'string') return false;
  try {
    const url = new URL(origin);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === origin;
  } catch (error) {
    return false;
  }
}

export function valueHash(text) {
  let hash = 2166136261;
  const value = String(text);
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export async function entryHash(entry) {
  if (!entry || entry.deleted) return 'deleted';
  // JSON preserves lone surrogates that UTF-8 alone would replace identically.
  const bytes = new TextEncoder().encode(JSON.stringify(entry.value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function legacyHash(entry) {
  return !entry || entry.deleted ? 'deleted' : `v:${valueHash(entry.value)}`;
}

async function matchesBaseline(entry, hash, remoteRecord) {
  if (typeof hash !== 'string' || !hash.startsWith('v:')) return hash === await entryHash(entry);
  // Old hashes cannot distinguish collisions. When the profile still matches
  // that baseline, compare actual values; ambiguous collisions preserve local data.
  if (remoteRecord && legacyHash(remoteRecord) === hash) return sameState(entry, remoteRecord);
  return legacyHash(entry) === hash;
}

export function syncItemBytes(key, value) {
  return new TextEncoder().encode(key + JSON.stringify(value)).byteLength;
}

export function maxChunkChars(index) {
  return LIMITS.bytesPerItem - chunkKey(index).length - 2;
}

export function chunkString(payload) {
  if (!payload) return { chunks: [], truncated: false };
  const chunks = [];
  let offset = 0;
  const maxChunks = LIMITS.maxItems - 1;
  while (offset < payload.length) {
    if (chunks.length >= maxChunks) return { chunks, truncated: true };
    const budget = maxChunkChars(chunks.length);
    if (budget <= 0) return { chunks, truncated: true };
    chunks.push(payload.slice(offset, offset + budget));
    offset += budget;
  }
  return { chunks, truncated: false };
}

export function joinChunks(chunks) {
  return chunks.join('');
}

export function packedBytes(meta, chunks) {
  let total = syncItemBytes(META_KEY, meta);
  chunks.forEach((chunk, index) => {
    total += syncItemBytes(chunkKey(index), chunk);
  });
  return total;
}

export function stableStringifyRecords(records) {
  const ordered = {};
  Object.keys(records || {}).sort().forEach((id) => {
    const canonical = canonicalRecord(records[id]);
    ordered[id] = canonical || records[id];
  });
  return JSON.stringify(ordered);
}

export function recordsEqual(left, right) {
  return stableStringifyRecords(left) === stableStringifyRecords(right);
}

export function pruneRecords(records, now, retentionMs = LIMITS.tombstoneRetentionMs) {
  const kept = {};
  Object.entries(records || {}).forEach(([id, record]) => {
    const canonical = canonicalRecord(record);
    if (!canonical) return;
    if (canonical.deleted && now - canonical.updatedAt > retentionMs) return;
    kept[id] = canonical;
  });
  return kept;
}

export function largestLiveId(records, skip) {
  let bestId = null;
  let bestSize = -1;
  Object.entries(records || {}).forEach(([id, record]) => {
    if (skip && skip.has(id)) return;
    if (!record || record.deleted || typeof record.value !== 'string') return;
    const size = record.value.length;
    if (size > bestSize || (size === bestSize && (bestId === null || id < bestId))) {
      bestId = id;
      bestSize = size;
    }
  });
  return bestId;
}

export async function stampMatchingLocalEntries(entries, stamps, { now = Infinity, remoteRecords = {}, origin } = {}) {
  return Promise.all(entries.map(async (entry) => {
    if (entry.writtenAt != null || !stamps) return entry;
    const id = recordId(entry.area, entry.key, origin);
    const stamp = stamps[id];
    if (!stamp || !await matchesBaseline(entry, stamp.hash)) return entry;
    const timestamp = boundedTimestamp(stamp.updatedAt, now);
    const legacy = typeof stamp.hash === 'string' && stamp.hash.startsWith('v:');
    // A legacy hash or invalid clock cannot prove this is the same pending edit.
    const writtenAt = legacy || timestamp !== stamp.updatedAt
      ? nextWriteTime(now, remoteRecords[id]?.updatedAt, timestamp) : timestamp;
    return { ...entry, writtenAt };
  }));
}

export function entriesWithLocalDeletes(entries, lastSynced, origin) {
  const result = entries.slice();
  const present = new Set(entries.map((entry) => recordId(entry.area, entry.key, origin)));
  Object.keys(lastSynced || {}).forEach((id) => {
    if (present.has(id)) return;
    const parsed = parseRecordId(id);
    if (!parsed || parsed.origin !== origin) return;
    result.push({ area: parsed.area, key: parsed.key, value: '', deleted: true });
  });
  return result;
}

export async function stampDivergedEntries(entries, { lastSynced = {}, stamps = {}, remoteRecords = {}, now, origin }) {
  return Promise.all(entries.map(async (entry) => {
    if (entry.writtenAt != null || !lastSynced) return entry;
    const id = recordId(entry.area, entry.key, origin);
    if (!Object.prototype.hasOwnProperty.call(lastSynced, id)) return entry;
    if (await matchesBaseline(entry, lastSynced[id], remoteRecords[id])) return entry;
    return { ...entry, writtenAt: nextWriteTime(now, remoteRecords[id]?.updatedAt, stamps[id]?.updatedAt) };
  }));
}

export async function prepareSiteEntries(entries, options) {
  // The page supplies values, never conflict clocks. Only worker-owned
  // baselines and quota stamps establish whether a value is a new edit.
  const values = [...foldLocal(Array.isArray(entries) ? entries : [], options.origin).values()]
    .map(({ area, key, value, deleted }) => ({ area, key, value, deleted }));
  const matched = await stampMatchingLocalEntries(values, options.stamps || {}, options);
  const withDeletes = entriesWithLocalDeletes(matched, options.lastSynced || {}, options.origin);
  const stamped = await stampDivergedEntries(withDeletes, options);
  return applyRetiredKeys(stamped, options.remoteRecords || {}, options.retired || [], options.now, options.origin);
}

function boundedTimestamp(timestamp, now) {
  // Repair clocks saved by older extensions without discarding their values.
  return Number.isSafeInteger(timestamp) && timestamp >= 0 && timestamp <= now + LIMITS.maxClockSkewMs
    ? timestamp : 0;
}

function nextWriteTime(now, ...previousTimes) {
  return Math.max(now, ...previousTimes.map((time) => boundedTimestamp(time, now) + 1));
}

/**
 * Keys the site no longer uses. A new key needs no entry here: every
 * localStorage key and cookie is synced. A removed key is listed so an
 * older profile copy cannot write it back.
 */
export function applyRetiredKeys(entries, remoteRecords, retired, now, origin) {
  const rules = Array.isArray(retired) ? retired : [];
  if (!rules.length) return entries;
  const byId = new Map();
  entries.forEach((entry) => {
    if (!entry || (entry.area !== 'local' && entry.area !== 'cookie')) return;
    if (typeof entry.key !== 'string' || entry.key === '') return;
    byId.set(recordId(entry.area, entry.key, origin), entry);
  });
  const ids = new Set([...byId.keys(), ...Object.keys(remoteRecords || {})]);
  ids.forEach((id) => {
    const parsed = parseRecordId(id);
    if (!parsed || parsed.origin !== origin || !matchesRetired(parsed.area, parsed.key, rules)) return;
    const local = byId.get(id);
    const remote = remoteRecords[id];
    if ((!local || local.deleted) && (!remote || remote.deleted)) return;
    byId.set(id, {
      area: parsed.area,
      key: parsed.key,
      value: '',
      deleted: true,
      writtenAt: nextWriteTime(now, remote?.updatedAt, local?.writtenAt),
    });
  });
  return [...byId.values()];
}

export function matchesRetired(area, key, retired) {
  return (retired || []).some((rule) => {
    if (!rule || rule.area !== area) return false;
    if (typeof rule.prefix === 'string' && rule.prefix !== '') return key.startsWith(rule.prefix);
    return typeof rule.key === 'string' && rule.key === key;
  });
}

/** Only this origin is editable. Preserve other namespaces; discard originless data. */
export function splitRecords(records, origin, now = Infinity) {
  const known = {};
  const opaque = {};
  Object.entries(records || {}).forEach(([id, record]) => {
    if (!record || typeof record !== 'object' || !recordOrigin(id)) return;
    const canonical = canonicalRecord({ ...record, updatedAt: boundedTimestamp(record.updatedAt, now) });
    const parsed = parseRecordId(id);
    if (parsed && parsed.origin === origin && canonical) {
      known[id] = canonical;
    }
    else opaque[id] = record;
  });
  return { known, opaque };
}

/**
 * Missing version is an older payload. A higher version must be applied
 * but not rewritten, so this copy cannot drop fields it does not know.
 */
export function payloadCompatibility(meta) {
  if (!meta || typeof meta.chunks !== 'number') return 'unreadable';
  if (meta.version == null) return 'current';
  if (typeof meta.version !== 'number' || meta.version < 1) return 'unreadable';
  if (meta.version > FORMAT_VERSION) return 'newer';
  return 'current';
}

export function nextMeta(previousMeta, fields) {
  const preserved = {};
  if (previousMeta && typeof previousMeta === 'object' && payloadCompatibility(previousMeta) !== 'newer') {
    Object.keys(previousMeta).forEach((key) => {
      if (KNOWN_META_FIELDS[key]) return;
      preserved[key] = previousMeta[key];
    });
  }
  return {
    ...preserved,
    version: FORMAT_VERSION,
    revision: fields.revision,
    chunks: fields.chunks,
    omittedCount: fields.omittedCount,
    updatedAt: fields.updatedAt,
    ...(fields.expandedBytes != null ? { expandedBytes: fields.expandedBytes } : {}),
  };
}

export async function hashesForRecords(records) {
  const hashes = {};
  for (const [id, record] of Object.entries(records || {})) {
    const canonical = canonicalRecord(record);
    if (!canonical) continue;
    hashes[id] = await entryHash(canonical);
  }
  return hashes;
}

export async function unsyncedStampsFor(mergedRecords, savedRecords) {
  const stamps = {};
  for (const [id, record] of Object.entries(mergedRecords || {})) {
    const wanted = canonicalRecord(record);
    if (!wanted || wanted.deleted) continue;
    const saved = canonicalRecord(savedRecords[id]);
    if (saved && sameState(wanted, saved)) continue;
    stamps[id] = { hash: await entryHash(wanted), updatedAt: wanted.updatedAt };
  }
  return stamps;
}

/**
 * Searches prefixes of a stable largest-first pruning order. A known fitting
 * candidate is retained even if compressed sizes are not strictly monotonic.
 * At most 16 whole-payload encodes are performed, including prior-copy restores.
 * `protectedIds` are dropped only after every unprotected live value is gone,
 * so a previously synced copy is not sacrificed to make room for brand-new data.
 * When a protected value is dropped, the previous profile copy is put back if
 * that smaller copy fits.
 */
export async function fitToQuota(records, options) {
  const source = records || {};
  if (Object.keys(source).length > RESOURCE_LIMITS.maxEntries + 2 * RESOURCE_LIMITS.maxRecords) {
    throw new RangeError('Merged profile has too many records.');
  }
  const protect = new Set(options.protectedIds || []);
  const keep = new Set(options.keepIds || []);
  const previous = options.previousRecords || {};
  const candidates = Object.keys(source).filter((id) => !keep.has(id) && source[id]
    && !source[id].deleted && typeof source[id].value === 'string');
  candidates.sort((left, right) => Number(protect.has(left)) - Number(protect.has(right))
    || source[right].value.length - source[left].value.length || (left < right ? -1 : left > right ? 1 : 0));
  const operations = [];
  const restored = [];
  for (const id of candidates) {
    const prior = canonicalRecord(previous[id]);
    const smaller = prior && JSON.stringify(prior).length < JSON.stringify(source[id]).length;
    operations.push({ id, replacement: smaller ? prior : null });
    if (smaller && !prior.deleted) restored.push({ id, replacement: null });
  }
  operations.push(...restored);
  const evaluate = async (count) => {
    const working = { ...source };
    const omitted = new Set();
    for (let index = 0; index < count; index++) {
      const { id, replacement } = operations[index];
      if (replacement) working[id] = replacement;
      else delete working[id];
      omitted.add(id);
    }
    return { records: working, omitted: [...omitted], encoded: await options.encode(working, omitted.size) };
  };
  const fits = (result) => result.encoded.ok && result.encoded.totalBytes <= options.quota;
  const initial = await evaluate(0);
  if (fits(initial)) return initial;
  if (!operations.length) return { ...initial, overQuota: true };
  let low = 0;
  let high = operations.length;
  let best = await evaluate(high);
  if (!fits(best)) return { ...best, overQuota: true };
  for (let attempts = 2; high - low > 1 && attempts < RESOURCE_LIMITS.maxEncodeAttempts; attempts++) {
    const middle = Math.floor((low + high) / 2);
    const trial = await evaluate(middle);
    if (fits(trial)) { high = middle; best = trial; }
    else low = middle;
  }
  return best;
}

export function mergeSiteSnapshot(localEntries, remoteRecords, now, origin) {
  const remote = splitRecords(remoteRecords, origin, now).known;
  const local = foldLocal(localEntries, origin);
  const ids = new Set([...Object.keys(remote), ...local.keys()]);
  const records = {};
  const apply = [];
  const replaced = [];

  ids.forEach((id) => {
    const parsed = parseRecordId(id);
    if (!parsed) return;
    const chosen = chooseRecord(local.get(id), remote[id], now);
    if (!chosen) return;
    records[id] = chosen.record;
    if (chosen.replaced != null) {
      replaced.push({ area: parsed.area, key: parsed.key, value: chosen.replaced });
    }
    if (!sameState(local.get(id), chosen.record)) {
      apply.push({
        area: parsed.area,
        key: parsed.key,
        value: chosen.record.deleted ? '' : chosen.record.value,
        deleted: !!chosen.record.deleted,
      });
    }
  });

  return { records, apply, replaced };
}

function chooseRecord(localEntry, remoteEntry, now) {
  if (!localEntry && !remoteEntry) return null;
  if (!remoteEntry) return { record: localToRecord(localEntry, now, null) };
  if (!localEntry) return { record: remoteEntry };
  if (localEntry.writtenAt != null && localEntry.writtenAt >= remoteEntry.updatedAt) {
    return { record: localToRecord(localEntry, localEntry.writtenAt, remoteEntry) };
  }
  if (sameState(localEntry, remoteEntry)) return { record: remoteEntry };
  return {
    record: remoteEntry,
    replaced: localEntry.deleted ? null : localEntry.value,
  };
}

function localToRecord(entry, now, remoteEntry) {
  const updatedAt = entry.writtenAt != null ? entry.writtenAt : now;
  const base = entry.deleted
    ? { deleted: true, updatedAt }
    : { updatedAt, value: entry.value };
  return { ...unknownFields(remoteEntry), ...base };
}

function sameState(localEntry, record) {
  if (!localEntry) return !!record.deleted;
  if (record.deleted) return !!localEntry.deleted;
  return !localEntry.deleted && localEntry.value === record.value;
}

function foldLocal(entries, origin) {
  const local = new Map();
  (entries || []).forEach((entry) => {
    if (!entry || (entry.area !== 'local' && entry.area !== 'cookie')) return;
    if (typeof entry.key !== 'string' || entry.key === '') return;
    if (!entry.deleted && typeof entry.value !== 'string') return;
    local.set(recordId(entry.area, entry.key, origin), {
      area: entry.area,
      key: entry.key,
      value: entry.deleted ? '' : entry.value,
      deleted: !!entry.deleted,
      writtenAt: entry.writtenAt == null ? null : entry.writtenAt,
    });
  });
  return local;
}

function canonicalRecord(record) {
  if (!record || typeof record !== 'object' || typeof record.updatedAt !== 'number') return null;
  const extras = unknownFields(record);
  if (record.deleted) return { deleted: true, updatedAt: record.updatedAt, ...extras };
  if (typeof record.value !== 'string') return null;
  return { updatedAt: record.updatedAt, value: record.value, ...extras };
}

function unknownFields(record) {
  const extras = {};
  if (!record || typeof record !== 'object') return extras;
  Object.keys(record).sort().forEach((key) => {
    if (KNOWN_RECORD_FIELDS[key] || record[key] === undefined) return;
    extras[key] = record[key];
  });
  return extras;
}
