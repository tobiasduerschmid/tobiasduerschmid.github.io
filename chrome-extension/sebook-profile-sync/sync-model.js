/**
 * Pure merge and quota rules for SEBook Chrome profile sync.
 *
 * Chrome profile sync (chrome.storage.sync) holds about 100 kilobytes.
 * Values that do not fit stay in the browser that wrote them. A value that
 * already has a smaller copy in the profile keeps that smaller copy so the
 * profile is not emptied when a later edit is too large to sync.
 */

export const LIMITS = {
  quotaBytes: 100000,
  bytesPerItem: 8192,
  maxItems: 512,
  tombstoneRetentionMs: 90 * 24 * 60 * 60 * 1000,
};

/** Bump only when older copies must not rewrite the profile payload. */
export const FORMAT_VERSION = 1;

const KNOWN_RECORD_FIELDS = { value: true, updatedAt: true, deleted: true };
const KNOWN_META_FIELDS = { version: true, revision: true, chunks: true, omittedCount: true, updatedAt: true };

export const META_KEY = 'm';

const SEPARATOR = '\u0000';

export function chunkKey(index) {
  return `c${index}`;
}

export function recordId(area, key) {
  return `${area}${SEPARATOR}${key}`;
}

export function parseRecordId(id) {
  if (typeof id !== 'string') return null;
  const cut = id.indexOf(SEPARATOR);
  if (cut <= 0) return null;
  const area = id.slice(0, cut);
  const key = id.slice(cut + 1);
  if ((area !== 'local' && area !== 'cookie') || key === '') return null;
  return { area, key };
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

export function entryHash(entry) {
  if (!entry || entry.deleted) return 'deleted';
  return `v:${valueHash(entry.value)}`;
}

export function syncItemBytes(key, value) {
  return key.length + JSON.stringify(value).length;
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

export function stampMatchingLocalEntries(entries, stamps) {
  return entries.map((entry) => {
    if (entry.writtenAt != null || !stamps) return entry;
    const stamp = stamps[recordId(entry.area, entry.key)];
    if (!stamp || stamp.hash !== entryHash(entry)) return entry;
    return { ...entry, writtenAt: stamp.updatedAt };
  });
}

export function entriesWithLocalDeletes(entries, lastSynced) {
  const result = entries.slice();
  const present = new Set(entries.map((entry) => recordId(entry.area, entry.key)));
  Object.keys(lastSynced || {}).forEach((id) => {
    if (present.has(id)) return;
    const parsed = parseRecordId(id);
    if (!parsed) return;
    result.push({ area: parsed.area, key: parsed.key, value: '', deleted: true });
  });
  return result;
}

export function stampDivergedEntries(entries, lastSynced, now) {
  return entries.map((entry) => {
    if (entry.writtenAt != null || !lastSynced) return entry;
    const id = recordId(entry.area, entry.key);
    if (!Object.prototype.hasOwnProperty.call(lastSynced, id)) return entry;
    if (lastSynced[id] === entryHash(entry)) return entry;
    return { ...entry, writtenAt: now };
  });
}

export function prepareSiteEntries(entries, options) {
  const matched = stampMatchingLocalEntries(entries || [], options.stamps || {});
  const withDeletes = entriesWithLocalDeletes(matched, options.lastSynced || {});
  const stamped = stampDivergedEntries(withDeletes, options.lastSynced || {}, options.now);
  return applyRetiredKeys(stamped, options.remoteRecords || {}, options.retired || [], options.now);
}

/**
 * Keys the site no longer uses. A new key needs no entry here: every
 * localStorage key and cookie is synced. A removed key is listed so an
 * older profile copy cannot write it back.
 */
export function applyRetiredKeys(entries, remoteRecords, retired, now) {
  const rules = Array.isArray(retired) ? retired : [];
  if (!rules.length) return entries;
  const byId = new Map();
  entries.forEach((entry) => {
    if (!entry || (entry.area !== 'local' && entry.area !== 'cookie')) return;
    if (typeof entry.key !== 'string' || entry.key === '') return;
    byId.set(recordId(entry.area, entry.key), entry);
  });
  const ids = new Set([...byId.keys(), ...Object.keys(remoteRecords || {})]);
  ids.forEach((id) => {
    const parsed = parseRecordId(id);
    if (!parsed || !matchesRetired(parsed.area, parsed.key, rules)) return;
    const local = byId.get(id);
    const remote = remoteRecords[id];
    if ((!local || local.deleted) && (!remote || remote.deleted)) return;
    byId.set(id, {
      area: parsed.area,
      key: parsed.key,
      value: '',
      deleted: true,
      writtenAt: now,
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

/** Known site records stay editable. Anything else is kept verbatim. */
export function splitRecords(records) {
  const known = {};
  const opaque = {};
  Object.entries(records || {}).forEach(([id, record]) => {
    if (!record || typeof record !== 'object') return;
    const canonical = canonicalRecord(record);
    if (parseRecordId(id) && canonical) known[id] = canonical;
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
  };
}

export function hashesForRecords(records) {
  const hashes = {};
  Object.entries(records || {}).forEach(([id, record]) => {
    const canonical = canonicalRecord(record);
    if (!canonical) return;
    hashes[id] = entryHash(canonical);
  });
  return hashes;
}

export function unsyncedStampsFor(mergedRecords, savedRecords) {
  const stamps = {};
  Object.entries(mergedRecords || {}).forEach(([id, record]) => {
    const wanted = canonicalRecord(record);
    if (!wanted || wanted.deleted) return;
    const saved = canonicalRecord(savedRecords[id]);
    if (saved && entryHash(saved) === entryHash(wanted)) return;
    stamps[id] = { hash: entryHash(wanted), updatedAt: wanted.updatedAt };
  });
  return stamps;
}

/**
 * Drops the largest live values until `encode` reports that the payload fits.
 * `protectedIds` are dropped only after every unprotected live value is gone,
 * so a previously synced copy is not sacrificed to make room for brand-new data.
 * When a protected value is dropped, the previous profile copy is put back if
 * that smaller copy fits.
 */
export async function fitToQuota(records, options) {
  const source = records || {};
  const working = { ...source };
  const omitted = [];
  const protect = new Set(options.protectedIds || []);
  const keep = new Set(options.keepIds || []);
  const previous = options.previousRecords || {};
  const quota = options.quota;
  let guard = Object.keys(source).length + 2;

  while (guard > 0) {
    guard -= 1;
    const encoded = await options.encode(working, omitted.length);
    if (encoded.ok && encoded.totalBytes <= quota) {
      return {
        records: working,
        omitted: omitted.filter((id) => !sameRecord(working[id], source[id])),
        encoded,
      };
    }
    const id = largestLiveId(working, combinedSkip(protect, keep)) || largestLiveId(working, keep);
    if (!id) return { records: working, omitted, encoded, overQuota: true };
    const removed = working[id];
    delete working[id];
    omitted.push(id);
    await restorePreviousIfSmaller(working, previous[id], removed, id, omitted.length, options, quota);
  }

  const encoded = await options.encode(working, omitted.length);
  return { records: working, omitted, encoded, overQuota: true };
}

export function mergeSiteSnapshot(localEntries, remoteRecords, now) {
  const remote = normalizeRemote(remoteRecords);
  const local = foldLocal(localEntries);
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

function foldLocal(entries) {
  const local = new Map();
  (entries || []).forEach((entry) => {
    if (!entry || (entry.area !== 'local' && entry.area !== 'cookie')) return;
    if (typeof entry.key !== 'string' || entry.key === '') return;
    if (!entry.deleted && typeof entry.value !== 'string') return;
    local.set(recordId(entry.area, entry.key), {
      area: entry.area,
      key: entry.key,
      value: entry.deleted ? '' : entry.value,
      deleted: !!entry.deleted,
      writtenAt: entry.writtenAt == null ? null : entry.writtenAt,
    });
  });
  return local;
}

function normalizeRemote(records) {
  const remote = {};
  Object.entries(records || {}).forEach(([id, record]) => {
    if (!parseRecordId(id)) return;
    const canonical = canonicalRecord(record);
    if (canonical) remote[id] = canonical;
  });
  return remote;
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

function combinedSkip(protect, keep) {
  return new Set([...protect, ...keep]);
}

function sameRecord(left, right) {
  return JSON.stringify(canonicalRecord(left) || null) === JSON.stringify(canonicalRecord(right) || null);
}

async function restorePreviousIfSmaller(working, previous, removed, id, omittedCount, options, quota) {
  const prior = canonicalRecord(previous);
  if (!prior || sameRecord(prior, removed)) return;
  const trial = { ...working, [id]: prior };
  const encoded = await options.encode(trial, omittedCount);
  if (encoded.ok && encoded.totalBytes <= quota) working[id] = prior;
}
