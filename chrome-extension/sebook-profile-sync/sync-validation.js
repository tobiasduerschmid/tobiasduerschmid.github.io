/** Resource limits apply to expanded data, independently of Chrome's gzip quota. */
export const RESOURCE_LIMITS = Object.freeze({
  maxEntries: 1024,
  maxRetiredRules: 128,
  maxKeyBytes: 1024,
  // Record IDs include an origin namespace as well as the bounded storage key.
  maxRecordIdBytes: 4096,
  maxValueBytes: 256 * 1024,
  maxSnapshotBytes: 1024 * 1024,
  maxRecords: 2048,
  maxExpandedBytes: 2 * 1024 * 1024,
  maxJsonDepth: 32,
  maxJsonNodes: 65536,
  maxEncodeAttempts: 16,
});

const encoder = new TextEncoder();

function stringBytes(value, limit, label) {
  if (typeof value !== 'string') throw new TypeError(`Invalid ${label}.`);
  // UTF-8 uses at least one byte per UTF-16 code unit; check before allocating.
  if (value.length > limit) throw new RangeError(`${label} exceeds the sync limit.`);
  const bytes = encoder.encode(value).byteLength;
  if (bytes > limit) throw new RangeError(`${label} exceeds the sync limit.`);
  return bytes;
}

function validKey(area, key) {
  if (area !== 'local' && area !== 'cookie') throw new TypeError('Invalid snapshot storage area.');
  if (!stringBytes(key, RESOURCE_LIMITS.maxKeyBytes, 'Snapshot key')) throw new TypeError('Empty snapshot key.');
}

/** Reject oversized input before copying, hashing, merging or compressing it. */
export function validateSiteSnapshot(entries, retired = []) {
  if (!Array.isArray(entries) || !Array.isArray(retired)) throw new TypeError('Invalid snapshot entries or retired rules.');
  if (entries.length > RESOURCE_LIMITS.maxEntries || retired.length > RESOURCE_LIMITS.maxRetiredRules) {
    throw new RangeError('Snapshot has too many entries or retired rules.');
  }
  let bytes = 2;
  const account = (value) => {
    bytes += encoder.encode(JSON.stringify(value)).byteLength + 1;
    if (bytes > RESOURCE_LIMITS.maxSnapshotBytes) throw new RangeError('Snapshot exceeds the expanded byte limit.');
    return value;
  };
  const checkedEntries = entries.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new TypeError('Invalid snapshot entry.');
    validKey(entry.area, entry.key);
    if (entry.deleted != null && typeof entry.deleted !== 'boolean') throw new TypeError('Invalid snapshot deletion.');
    if (!entry.deleted || entry.value != null) stringBytes(entry.value, RESOURCE_LIMITS.maxValueBytes, 'Snapshot value');
    // Conflict clocks are assigned by the worker, never copied from the page.
    return account({
      area: entry.area, key: entry.key, value: entry.deleted ? '' : entry.value,
      deleted: !!entry.deleted,
    });
  });
  const checkedRetired = retired.map((rule) => {
    if (!rule || typeof rule !== 'object') throw new TypeError('Invalid retired rule.');
    const field = rule.prefix != null ? 'prefix' : 'key';
    validKey(rule.area, rule[field]);
    return account({ area: rule.area, [field]: rule[field] });
  });
  return { entries: checkedEntries, retired: checkedRetired };
}

/** Bounds unknown fields too, while preserving compatible future record formats. */
export function validateSyncRecords(records) {
  if (!records || typeof records !== 'object' || Array.isArray(records)) throw new TypeError('Invalid profile records.');
  const ids = Object.keys(records);
  if (ids.length > RESOURCE_LIMITS.maxRecords) throw new RangeError('Too many profile records.');
  for (const id of ids) {
    stringBytes(id, RESOURCE_LIMITS.maxRecordIdBytes, 'Profile record ID');
    const areaStart = /^https?:\/\//.test(id) ? id.indexOf('\0') + 1 : 0;
    const separator = id.indexOf('\0', areaStart);
    const area = id.slice(areaStart, separator);
    if (area === 'local' || area === 'cookie') validKey(area, id.slice(separator + 1));
    const record = records[id];
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('Invalid profile record.');
    if (typeof record.value === 'string') stringBytes(record.value, RESOURCE_LIMITS.maxValueBytes, 'Profile value');
  }
  boundedJsonBytes(records);
}

function boundedJsonBytes(value) {
  let bytes = 0;
  let nodes = 0;
  const add = (amount) => {
    bytes += amount;
    if (bytes > RESOURCE_LIMITS.maxExpandedBytes) throw new RangeError('Profile exceeds the expanded byte limit.');
  };
  const visit = (item, depth) => {
    nodes++;
    if (depth > RESOURCE_LIMITS.maxJsonDepth || nodes > RESOURCE_LIMITS.maxJsonNodes) {
      throw new RangeError('Profile JSON complexity exceeds the sync limit.');
    }
    if (typeof item === 'string') stringBytes(item, RESOURCE_LIMITS.maxExpandedBytes, 'Profile field');
    if (item === null || typeof item !== 'object') {
      const json = JSON.stringify(item);
      if (json === undefined) throw new TypeError('Invalid profile JSON value.');
      add(encoder.encode(json).byteLength);
      return;
    }
    add(2);
    const keys = Object.keys(item);
    for (let index = 0; index < keys.length; index++) {
      if (index) add(1);
      if (!Array.isArray(item)) {
        stringBytes(keys[index], RESOURCE_LIMITS.maxRecordIdBytes, 'Profile field key');
        add(encoder.encode(JSON.stringify(keys[index])).byteLength + 1);
      }
      visit(item[keys[index]], depth + 1);
    }
  };
  visit(value, 0);
  return bytes;
}
